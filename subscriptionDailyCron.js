import 'dotenv/config';
import cron from 'node-cron';
import connectDB from './lib/db.js';

import SubscriptionPayment from './models/subscriptionPayment.js';
import { delegateEnergyDynamic1D } from './utils/tronHelpers.js';

const MAX_DAILY_ISSUE = 262_000;


function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}


(async () => {
  try {
    await connectDB();
    console.log('[cron-subscription] MongoDB ready');
  } catch (err) {
    console.error('[cron-subscription] Mongo connect error:', err);
    process.exit(1);
  }
})();


cron.schedule('0 3 * * *', async () => {
  try {
    const todayStart = startOfToday();

    
    const { modifiedCount: deactivated } = await SubscriptionPayment.updateMany(
      { subscriptionStatus: 'active', expiresAt: { $lt: todayStart } },
      { $set: { subscriptionStatus: 'inactive' } },
    );

    
    await SubscriptionPayment.updateMany(
      { subscriptionStatus: 'active' },
      { $set: { dailyEnergyIssued: 0 } },
    );

    
    const actives = await SubscriptionPayment.find({ subscriptionStatus: 'active' }).lean();

    let totalIssued = 0;
    for (const doc of actives) {
      const amount = Math.min(doc.dailyEnergy, MAX_DAILY_ISSUE);
      try {
        await delegateEnergyDynamic1D(amount, doc.wallet);
        await SubscriptionPayment.updateOne(
          { _id: doc._id },
          { $set: { dailyEnergyIssued: amount } },
        );
        totalIssued += amount;
      } catch (e) {
        console.error(`[dailyCron] delegateEnergy error for ${doc.orderNumber}:`, e);
      }
    }

    console.log(
      `[dailyCron] deactivated: ${deactivated}, active processed: ${actives.length}, energy total: ${totalIssued}`,
    );
  } catch (err) {
    console.error('[dailyCron] top-level error:', err);
  }
});

export default {};
