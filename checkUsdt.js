import dotenv from 'dotenv';
dotenv.config({ path: '/etc/nikiDimaHleb.env' });

import mongoose from 'mongoose';
import connectDB from './lib/db.js';
import TronwebPkg from 'tronweb';
import Payment from './models/Payment.js';

const TronWeb = TronwebPkg.TronWeb || TronwebPkg.default || TronwebPkg;

const DELAY_BETWEEN_WALLETS = 500;  
const RPC_TIMEOUT           = 1000; 


async function initDb() {
  await connectDB();
}


const tronWebReadOnly = new TronWeb({
  fullNode    : process.env.TRON_FULL_NODE,
  solidityNode: process.env.TRON_SOLIDITY_NODE,
  eventServer : process.env.TRON_EVENT_SERVER || process.env.TRON_SOLIDITY_NODE,
});
const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS;


async function getUsdtBalance(address) {
  try {
    tronWebReadOnly.setAddress(address);
    const contract = await tronWebReadOnly.contract().at(USDT_CONTRACT_ADDRESS);
    const raw      = await contract.balanceOf(address).call();   // BigNumber
    const balance  = Number(BigInt(raw.toString()) / 1_000_000n);
    return balance;                                              // целые USDT
  } catch (err) {
    console.error(`Ошибка USDT‑баланса ${address}:`, err.message);
    return null;
  }
}

function withTimeout(promise, ms, errMsg = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errMsg)), ms)),
  ]);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


async function checkBalances() {
  const payments = await Payment.find({ currency: 'USDT', status: { $ne: 'delete' } });
  console.log(`[Cron] found ${payments.length} USDT payments`);

  for (const p of payments) {
    try {
      const balance = await withTimeout(
        getUsdtBalance(p.walletAddress),
        RPC_TIMEOUT,
        'RPC >1 s',
      );

      if (balance !== null) {
        console.log(`${p.walletAddress}  →  ${balance} USDT`);
        p.realAmount = balance;
        await p.save();
      }
    } catch (e) {
      console.error(`⚠️  ${p.walletAddress} – ${e.message}`);
    }
    await sleep(DELAY_BETWEEN_WALLETS);
  }
}


(async () => {
  try {
    await initDb();
    await checkBalances();
  } catch (err) {
    console.error('[Cron] fatal:', err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
})();

export default {};
