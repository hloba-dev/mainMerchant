import 'dotenv/config';
import cron from 'node-cron';
import axios from 'axios';

import connectDB        from './lib/db.js';
import Payment          from './models/Payment.js';
import Config           from './models/Config.js';
import { performAMLCheck } from './utils/amlHelpers.js';
import {
  tronWeb,
  getSenderAddress,
  transferFunds,
} from './utils/tronHelpers.js';

/* ───────────────── bootstrap ───────────────── */
(async () => {
  try {
    await connectDB();
    cron.schedule('* * * * *', handleTrxPayments);
  } catch (err) {
    console.error('[TRX-cron] Mongo connect error:', err);
    process.exit(1);
  }
})();

/* ───────────────── worker ───────────────── */
let isRunning = false;

async function handleTrxPayments() {
  if (isRunning) {
    console.log('[TRX-cron] previous tick still running → skip');
    return;
  }
  isRunning = true;
  console.log('[TRX-cron] start', new Date().toLocaleString());

  try {
    const pending = await Payment.find({ status: 'pending', currency: 'TRX' });
    console.log(`[TRX-cron] pending TRX: ${pending.length}`);

    for (const pay of pending) {
      const payId = pay._id.toString();
      console.log(`—--[${payId}]--—`);

      try {
        const sun     = await tronWeb.trx.getBalance(pay.walletAddress);
        const balance = sun / 1e6;
        console.log(`[${payId}] balance = ${balance}`);

        if (balance === 0) continue;

        pay.status     = 'wait';
        pay.realAmount = balance;
        await pay.save();
        await sendCallback(pay, { balance });

        const sender = await getSenderAddress(pay);
        if (!sender) { await revertToPending(pay); continue; }

        const aml = await performAMLCheck(sender);
        pay.amlPassed = aml.passed;
        pay.amlDetail = { riskscore: aml.riskscore, signals: aml.signals };

        const cfg = await Config.findOne();
        if (!cfg) { await revertToPending(pay); continue; }

        let targetWallet = cfg.mainWallet;
        if (balance < pay.amount)       pay.status = 'lesspay';
        else if (!aml.passed)           pay.status = 'frozen';
        else                            pay.status = 'completed';

        if (pay.status !== 'frozen') {
          console.log(`[${payId}] transfer ${balance} TRX → ${targetWallet}`);
          await transferFunds(pay, targetWallet, balance);
        } else {
          console.log(`[${payId}] frozen → средства оставлены на адресе`);
        }

        await pay.save();
        await sendCallback(pay, { balance });
      } catch (inner) {
        console.error(`[${payId}] inner error:`, inner);
      }
      console.log(`—--[${payId}] done--—\n`);
    }
  } catch (err) {
    console.error('[TRX-cron] global error:', err);
  } finally {
    isRunning = false;
  }
}


async function sendCallback(payment, extra) {
  if (!payment.url_callback) return;
  try {
    const resp = await axios.post(
      payment.url_callback,
      {
        paymentId: payment._id,
        status:    payment.status,
        amlPassed: payment.amlPassed,
        ...extra,
      },
      { timeout: 10_000, validateStatus: () => true },
    );
    console.log(`[${payment._id}] callback status = ${resp.status}`);
  } catch (err) {
    console.error(`[${payment._id}] callback fail:`, err.message);
  }
}

async function revertToPending(payment) {
  payment.status = 'pending';
  await payment.save();
}
