import 'dotenv/config';
import connectDB from './lib/db.js';
import cron from 'node-cron';
import axios from 'axios';
import mongoose from 'mongoose';
import { TronWeb } from 'tronweb';
import { delegateEnergyDynamic } from './utils/tronHelpers.js';


[
  'MONITOR_WALLET',
  'TRON_FULL_NODE',
  'PRIVATE_PASSWORD_MAIN',
  'MONGO_URI',
].forEach((k) => {
  if (!process.env[k]) {
    console.error(`[TRX-Watch] ENV ${k} not set → abort`);
    process.exit(1);
  }
});


const DelegLog = mongoose.model(
  'DelegLog',
  new mongoose.Schema(
    {
      txID:        { type: String, unique: true },
      amountTRX:   Number,
      toAddress:   String,
      delegatedAt: Date,
    },
    { collection: 'delegations_log' },
  ),
);


const tronWeb = new TronWeb({
  fullHost:  process.env.TRON_FULL_NODE,
  privateKey: process.env.PRIVATE_PASSWORD_MAIN,
});


const MONITOR_ADDR   = process.env.MONITOR_WALLET;
const MIN_AMOUNT_SUN = 10 * 1e6;     // 10 TRX
const ENERGY_AMOUNT  = 135_000;

const TRONGRID_URL  = 'https://api.trongrid.io';
const AXIOS_HEADERS = process.env.TRONGRID_API_KEY
  ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY }
  : {};


(async () => {
  await connectDB();

  await checkIncoming();
  cron.schedule('* * * * *', checkIncoming);
  console.log('[TRX-Watch] cron scheduled (every 1 min)');
})();


let isRunning = false;

async function checkIncoming() {
  if (isRunning) {
    console.log('[TRX-Watch] previous tick still running → skip');
    return;
  }
  isRunning = true;
  console.log('[TRX-Watch] tick', new Date().toLocaleString());

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const minTimestamp = startOfToday.getTime(); // ms epoch

  try {
    const url =
      `${TRONGRID_URL}/v1/accounts/${MONITOR_ADDR}/transactions` +
      '?only_to=true&only_confirmed=true&order_by=block_timestamp,desc&limit=200' +
      `&min_timestamp=${minTimestamp}`;

    const { data } = await axios.get(url, {
      headers: AXIOS_HEADERS,
      timeout: 10_000,
    });

    for (const tx of data?.data || []) {
      const type = tx.raw_data?.contract?.[0]?.type;
      if (type !== 'TransferContract') continue;

      const val        = tx.raw_data.contract[0].parameter.value;
      const amountSun  = val.amount ?? 0;
      const toAddr     = tronWeb.address.fromHex(val.to_address);
      const fromAddr   = tronWeb.address.fromHex(val.owner_address);

      if (toAddr !== MONITOR_ADDR)        continue;
      if (amountSun < MIN_AMOUNT_SUN)     continue;
      if (await DelegLog.exists({ txID: tx.txID || tx.txid })) continue;

      console.log(`[TRX-Watch] +${amountSun / 1e6} TRX from ${fromAddr} → delegate ${ENERGY_AMOUNT}`);

      try {
        await delegateEnergyDynamic(ENERGY_AMOUNT, fromAddr);
        console.log('[TRX-Watch] ✅ energy delegated');

        await DelegLog.create({
          txID: tx.txID || tx.txid,
          amountTRX: amountSun / 1e6,
          toAddress: fromAddr,
          delegatedAt: new Date(),
        });
      } catch (e) {
        console.error('[TRX-Watch] ❌ delegateEnergyDynamic error:', e.message);
      }
    }
  } catch (err) {
    if (err.response) {
      console.error(`[TRX-Watch] HTTP ${err.response.status}`, err.response.data?.message || err.response.data);
    } else {
      console.error('[TRX-Watch] ERROR', err.message);
    }
  } finally {
    isRunning = false;
  }
}
