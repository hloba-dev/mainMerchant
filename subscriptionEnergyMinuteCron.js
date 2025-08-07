import 'dotenv/config';
import cron from 'node-cron';
import connectDB from './lib/db.js';

import SubscriptionPayment from './models/subscriptionPayment.js';
import {
  delegateEnergyDynamic1D,
  getEnergyBalance,
} from './utils/tronHelpers.js';

const TARGET_FREE = 262_000;
const BATCH_SIZE  = Number(process.env.TRON_RPC_BATCH) || 10;

async function processDoc(doc) {
  const dailyEnergy  = +doc.dailyEnergy || 0;
  const issued       = +doc.dailyEnergyIssued || 0;
  const remainingDB  = dailyEnergy - issued;
  if (remainingDB <= 0) return;

  const onChainFree  = +(await getEnergyBalance(doc.wallet)) || 0;
  const targetFree   = Math.min(TARGET_FREE, dailyEnergy);
  if (onChainFree >= targetFree) return;

  const lacking = targetFree - onChainFree;
  const toIssue = Math.min(lacking, remainingDB);
  if (toIssue <= 0) return;

  await delegateEnergyDynamic1D(toIssue, doc.wallet);
  await SubscriptionPayment.updateOne(
    { _id: doc._id },
    { $inc: { dailyEnergyIssued: toIssue } },
  );

  console.log(`[minuteCron] ${doc.orderNumber}: +${toIssue} energy`);
}


(async () => {
  await connectDB();
  console.log('[energyMinuteCron] MongoDB ready');
})();


cron.schedule('*/5 * * * *', async () => {
  try {
    const docs = await SubscriptionPayment.find({
      subscriptionStatus: 'active',
      $expr: { $lt: ['$dailyEnergyIssued', '$dailyEnergy'] },
    }).lean();

    if (!docs.length) return;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(processDoc));
    }
  } catch (err) {
    console.error('[energyMinuteCron] top-level error:', err);
  }
});

export default {};
