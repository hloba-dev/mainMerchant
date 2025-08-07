import 'dotenv/config';
import { TronWeb } from 'tronweb';
import axios from 'axios';
import CleanWallet from '../models/CleanWallet.js';

const tronWeb = new TronWeb({ fullHost: process.env.TRON_FULL_NODE });

const tronWebReadOnly = new TronWeb({
  fullHost: process.env.TRON_FULL_NODE,
  privateKey: '1111111111111111111111111111111111111111111111111111111111111111',
});

const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS;



export async function delegateEnergyOneHour(tronAddress) {
  try { 
    return await feeSaver1H(tronAddress);
  } catch (fsErr) {
    console.warn('[FeeSaver-1H] fail:', fsErr.message);
    try {
      return await iTRX1H(tronAddress);
    } catch (itErr) {
      throw new Error(`FeeSaver error: ${fsErr.message} | iTRX error: ${itErr.message}`);
    }
  }
}

export async function delegateEnergyDynamic(energyAmount, tronAddress) {
  try {
    return await buyEnergyFeeSaver(energyAmount, tronAddress);
  } catch (fsErr) {
    console.warn('[FeeSaver] fail:', fsErr.message);
    try {
      return await buyEnergyITRX(energyAmount, tronAddress);
    } catch (itErr) {
      throw new Error(`FeeSaver error: ${fsErr.message} | iTRX error: ${itErr.message}`);
    }
  }
}

export async function delegateEnergyDynamic1D(energyAmount, tronAddress) {
  try {
    return await buyEnergyFeeSaver1D(energyAmount, tronAddress);
  } catch (fsErr) {
    console.warn('[FeeSaver] fail:', fsErr.message);
    try {
      return await buyEnergyITRX1D(energyAmount, tronAddress);
    } catch (itErr) {
      throw new Error(`FeeSaver error: ${fsErr.message} | iTRX error: ${itErr.message}`);
    }
  }
}



export async function sendUsdtFromEphemeralToMain(ephemeralPrivateKey, fromAddress, toAddress, amount) {
  const ephemeralTronWeb = new TronWeb({
    fullHost: process.env.TRON_FULL_NODE,
    privateKey: ephemeralPrivateKey,
  });
  const tokenAmount = Math.floor(amount * 1e6);
  const contract = await ephemeralTronWeb.contract().at(USDT_CONTRACT_ADDRESS);
  return contract.transfer(toAddress, tokenAmount).send();
}

export async function getUsdtBalance(address) {
  try {
    const contract = await tronWebReadOnly.contract().at(USDT_CONTRACT_ADDRESS);
    const balance = await contract.balanceOf(address).call();
    return parseFloat(balance.toString()) / 1e6;
  } catch (error) {
    console.error('Ошибка при получении USDT-баланса:', error);
    return 0;
  }
}
export async function getSenderAddress(payment) {
  try {
    const url =
      `https://api.trongrid.io/v1/accounts/${payment.walletAddress}` +
      `/transactions?direction=to&only_confirmed=true&limit=1`;

   
    const { data } = await axios.get(url, { validateStatus: s => s < 400 });

    console.log('TronGrid response:', JSON.stringify(data, null, 2));

    if (data?.data?.length) {
      const tx = data.data[0];
      console.log(
        'Найденная транзакция (TronGrid):',
        JSON.stringify(tx, null, 2)
      );

      const fullTx = await tronWeb.trx.getTransaction(tx.txID);
      console.log('Полная транзакция:', JSON.stringify(fullTx, null, 2));

      const contract = fullTx?.raw_data?.contract?.[0];
      const ownerHex = contract?.parameter?.value?.owner_address;

      if (ownerHex) {
        const senderAddress = tronWeb.address.fromHex(ownerHex);
        return senderAddress;                      
      }
    }
  } catch (err) {
    const status = err.response?.status ?? 'network';
    console.error(
      'Ошибка при получении адреса отправителя:',
      `HTTP ${status}: ${err.message}`
    );
  }
  return null;
}

export async function getUsdtSenderAddress({ walletAddress }) {
  const tsMin = new Date().setHours(0, 0, 0, 0);          

  const addrBase58 = walletAddress.toLowerCase();
  const addrHex    = TronWeb.address.toHex(walletAddress).toLowerCase();

  const url =
    `https://api.trongrid.io/v1/accounts/${walletAddress}/transactions/trc20` +
    `?limit=200&only_confirmed=true&contract_address=${USDT_CONTRACT_ADDRESS}`;

  
  let txs = [];
  try {
    const { data } = await axios.get(url, { validateStatus: s => s < 400 });
    txs = data?.data ?? [];                               
  } catch (err) {
    
    const status = err.response?.status ?? 'network';
    throw new Error(`HTTP ${status} from TronGrid`);
  }

  for (const tx of txs) {
    const toBase58 = (tx.to || '').toLowerCase();
    const toHex    = (tx.to_address || '').toLowerCase();
    if (toBase58 !== addrBase58 && toHex !== addrHex) continue;     

    if (+tx.block_timestamp < tsMin) continue;                      

    return TronWeb.address.fromHex(tx.from_address || tx.from);    
  }

  return null;                                                      
}



export async function transferTrx(privateKey, fromAddress, toAddress, amountTRX) {
  const amountSun = Math.floor(amountTRX * 1e6);
  if (amountSun <= 0) throw new Error('amountTRX must be > 0');
  const tx = await tronWeb.transactionBuilder.sendTrx(toAddress, amountSun, fromAddress);
  const signed = await tronWeb.trx.sign(tx, privateKey);
  return tronWeb.trx.sendRawTransaction(signed);
}

export async function getBalanceTrx(wallet) {
  const balance = await tronWeb.trx.getBalance(wallet);
  return balance / 1e6;
}

export async function transferFunds(payment, targetWallet, balanceTRX) {
  const commission = 0;
  const amountSun = Math.floor((balanceTRX - commission) * 1e6);
  if (amountSun <= 0.1) throw new Error('Недостаточно средств для перевода с учётом комиссии');

  const epw = new TronWeb({
    fullHost: process.env.TRON_FULL_NODE,
    privateKey: payment.privateKey,
  });

  const tx = await epw.transactionBuilder.sendTrx(targetWallet, amountSun, payment.walletAddress);
  const signed = await epw.trx.sign(tx);
  return epw.trx.sendRawTransaction(signed);
}



export async function getEnergyBalance(addr) {
  try {
    const res = await tronWeb.trx.getAccountResources(addr);
    const limit = Number(res.EnergyLimit ?? res.energyLimit) || 0;
    const used = Number(res.EnergyUsed ?? res.energyUsed) || 0;
    return limit - used;
  } catch (err) {
    console.error('[getEnergyBalance] error:', err);
    return 0;
  }
}



export async function performAMLCheck(addressToCheck) {
  try {
    const existing = await CleanWallet.findOne({ walletAddress: addressToCheck });
    if (existing) return { passed: true, riskscore: 0, signals: {} };

    const amlUrl = 'https://api.getblock.net/rpc/v1/request';
    const accessToken = process.env.GETBLOCK_ACCESS_TOKEN;

    const init = await axios.post(
      amlUrl,
      {
        jsonrpc: '2.0',
        id: Date.now().toString(),
        method: 'checkup.checkaddr',
        params: { addr: addressToCheck, currency: 'TRX' },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'cache-control': 'no-cache',
        },
        validateStatus: () => true,
      }
    );

    if (init.data.error) throw new Error(init.data.error.message);
    const hash = init.data.result?.check?.hash;
    if (!hash) throw new Error('No check hash in AML response');

    let amlResult = null;
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const res = await axios.post(
        amlUrl,
        {
          jsonrpc: '2.0',
          id: Date.now().toString(),
          method: 'checkup.getresult',
          params: { hash },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'cache-control': 'no-cache',
          },
          validateStatus: () => true,
        }
      );
      if (res.data.error) throw new Error(res.data.error.message);
      if (res.data.result?.check?.status === 'SUCCESS') {
        amlResult = res.data.result.check;
        break;
      }
    }
    if (!amlResult) throw new Error('AML check result not available in time');

    const riskscore = amlResult.report?.riskscore ?? 1;
    const signals = amlResult.report?.signals ?? {};
    return { passed: riskscore < 0.2, riskscore, signals };
  } catch (err) {
    console.error('Ошибка в performAMLCheck:', err);
    return { passed: false, riskscore: 1, signals: {}, error: err.message };
  }
}



async function feeSaver1H(address) {
  const token = process.env.FEESAVER_API_TOKEN;
  if (!token) throw new Error('нет FEESAVER_API_TOKEN');
  const params = new URLSearchParams({ token, days: '1h', volume: '65000', target: address });
  const { data, status } = await axios.get(`https://api.feesaver.com/buyEnergy?${params}`);
  if (status !== 200 || data.err) throw new Error(data.err || status);
  if (data.status !== 'Filled') throw new Error('status ' + data.status);
  return { provider: 'FeeSaver', ...data };
}

async function iTRX1H(address) {
  return buyEnergyITRX(65000, address);
}

async function buyEnergyITRX(energyAmount, address, period = '1H') {
  const apiKey = process.env.ITRX_API_KEY;
  const apiSecret = process.env.ITRX_API_SECRET;

  const body = { energy_amount: energyAmount, period, receive_address: address };
  const jsonData = JSON.stringify(Object.fromEntries(Object.entries(body).sort()));
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const crypto = await import('crypto');
  const signature = crypto.createHmac('sha256', apiSecret).update(`${timestamp}&${jsonData}`).digest('hex');

  const { data } = await axios.post('https://itrx.io/api/v1/frontend/order', jsonData, {
    headers: {
      'API-KEY': apiKey,
      TIMESTAMP: timestamp,
      SIGNATURE: signature,
      'Content-Type': 'application/json',
    },
    validateStatus: () => true,
  });
  return data;
}

async function buyEnergyITRX1D(energyAmount, address) {
  return buyEnergyITRX(energyAmount, address, '1D');
}

async function buyEnergyFeeSaver(energy, address, days = '1h') {
  const token = process.env.FEESAVER_API_TOKEN;
  if (!token) throw new Error('нет FEESAVER_API_TOKEN');
  const params = new URLSearchParams({ token, days, volume: String(energy), target: address });
  const { data, status } = await axios.get(`https://api.feesaver.com/buyEnergy?${params}`);
  if (status !== 200 || data.err) throw new Error(data.err || status);
  if (data.status !== 'Filled') throw new Error('status ' + data.status);
  return { provider: 'FeeSaver', ...data };
}

async function buyEnergyFeeSaver1D(energy, address) {
  return buyEnergyFeeSaver(energy, address, '1d');
}

export {
  tronWeb
};
