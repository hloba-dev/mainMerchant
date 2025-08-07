import 'dotenv/config';
import cron from 'node-cron';
import axios from 'axios';
import pLimit from 'p-limit';

import connectDB from './lib/db.js';
import PaymentEnergy from './models/PaymentEnergy.js';
import Config from './models/Config.js';
import {
  tronWeb,
  delegateEnergyDynamic1D,
  getEnergyBalance,
} from './utils/tronHelpers.js';


(async () => {
  try {
    await connectDB();
    console.log('[cron-subscription] MongoDB ready');
  } catch (err) {
    console.error('[cron-subscription] Mongo connect error:', err);
    process.exit(1);
  }
})();


async function buyEnergyITRX(energyAmount, tronAddress) {
  const apiKey    = process.env.ITRX_API_KEY;
  const apiSecret = process.env.ITRX_API_SECRET;

  const bodyRaw = {
    energy_amount: energyAmount,
    period: '1H',
    receive_address: tronAddress,
  };

  const body = Object.fromEntries(Object.entries(bodyRaw).sort());
  const jsonData   = JSON.stringify(body);
  const timestamp  = Math.floor(Date.now() / 1000).toString();
  const { createHmac } = await import('crypto');
  const signature = createHmac('sha256', apiSecret)
    .update(`${timestamp}&${jsonData}`)
    .digest('hex');

  const { data } = await axios.post(
    'https://itrx.io/api/v1/frontend/order',
    jsonData,
    {
      headers: {
        'API-KEY': apiKey,
        TIMESTAMP: timestamp,
        SIGNATURE: signature,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    }
  );
  console.log('[ITRX] response:', data);
  return data;
}

async function buyEnergyFeeSaver(energy, address) {
  const token = process.env.FEESAVER_API_TOKEN;
  if (!token) throw new Error('нет FEESAVER_API_TOKEN');

  const qs = new URLSearchParams({
    token,
    days: '1h',
    volume: String(energy),
    target: address,
  }).toString();

  const { data, status } = await axios.get(
    `https://api.feesaver.com/buyEnergy?${qs}`,
    { validateStatus: () => true }
  );

  if (status !== 200 || data.err) throw new Error(data.err || status);
  if (data.status !== 'Filled')   throw new Error('status ' + data.status);
  return { provider: 'FeeSaver', ...data };
}

async function delegateEnergyDynamic(energyAmount, tronAddress) {
  try {
    return await buyEnergyFeeSaver(energyAmount, tronAddress);
  } catch (fsErr) {
    console.warn('[FeeSaver] fail:', fsErr.message);
    try {
      return await buyEnergyITRX(energyAmount, tronAddress);
    } catch (itErr) {
      throw new Error(
        `FeeSaver error: ${fsErr.message} | iTRX error: ${itErr.message}`
      );
    }
  }
}


async function deleteStalePayments() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 минут
  const res = await PaymentEnergy.updateMany(
    { status: 'pending', createdAt: { $lt: cutoff } },
    { $set: { status: 'delete' } }
  );
  const n = res.modifiedCount ?? res.nModified ?? 0;
  if (n) console.log(`[cleaner] ${n} pending→delete`);
}
cron.schedule('*/5 * * * *', deleteStalePayments);

async function transferFunds(payment, targetWallet, balanceTRX) {
  const commission = 0;
  const amountSun  = Math.floor((balanceTRX - commission) * 1e6);
  if (amountSun <= 0.1) throw new Error('Недостаточно средств для перевода');

  const tx = await tronWeb.transactionBuilder.sendTrx(
    targetWallet,
    amountSun,
    payment.walletAddress
  );
  const signed = await tronWeb.trx.sign(tx, payment.privateKey);
  return tronWeb.trx.sendRawTransaction(signed);
}


async function handlePayment(payment) {
  let balanceTRX = 0;
  try {
    const sun = await tronWeb.trx.getBalance(payment.walletAddress);
    balanceTRX = sun / 1e6;
  } catch (e) {
    console.warn(`[balance] ${payment._id}: ${e.message}`);
    return;
  }

  if (balanceTRX < payment.amount) return;

  try {
    payment.realAmount = balanceTRX;

    const deleg = await delegateEnergyDynamic(
      payment.amountEnergy,
      payment.walletAddressForEnergy
    );

    const cfg = await Config.findOne();
    if (!cfg) throw new Error('Config not found');
    const tr = await transferFunds(payment, cfg.energyWallet, balanceTRX);

    payment.status      = 'completed';
    payment.tx_id       = deleg?.txId || deleg?.transaction_id || deleg?.order_id || '';
    payment.transfer_id = tr?.txid   || tr?.transaction?.txID  || '';
    await payment.save();
    console.log(`[energy] ${payment._id} ✓ completed`);
  } catch (err) {
    console.error(`[energy] ${payment._id} ✗ ${err.message}`);
    payment.status = 'frozen';
    await payment.save();
  }

  if (payment.url_callback) {
    axios.post(
      payment.url_callback,
      {
        paymentId: payment._id,
        status:    payment.status,
        tx_id:     payment.tx_id,
        transfer:  payment.transfer_id,
      },
      { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true }
    ).catch((e) => console.warn(`[callback] ${payment._id}: ${e.message}`));
  }
}


const limit = pLimit(5);

cron.schedule('* * * * *', async () => {
  console.log('[cron] scan', new Date().toISOString());

  const pendings = await PaymentEnergy.find({
    status: { $in: ['pending', 'wait'] },
    currency: 'TRX',
  });

  await Promise.allSettled(pendings.map((p) => limit(() => handlePayment(p))));
});

export default {};
