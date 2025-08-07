import 'dotenv/config';
import cron from 'node-cron';
import connectDB from './lib/db.js';

import SubscriptionPayment from './models/subscriptionPayment.js';
import {
  getBalanceTrx,
  transferTrx,
  delegateEnergyDynamic1D,
} from './utils/tronHelpers.js';


const TARGET_WALLET    = process.env.WALLETENERGYSUBSCRIPTION;
const DELETE_AFTER_MIN = 21;
const MAX_DAILY_ISSUE  = 262_000;


(async () => {
  try {
    await connectDB();
    console.log('[cron-subscription] MongoDB ready');
  } catch (err) {
    console.error('[cron-subscription] Mongo connect error:', err);
    process.exit(1);
  }
})();


cron.schedule('* * * * *', async () => {
  try {
    const pending = await SubscriptionPayment
      .find({ paymentStatus: 'pending' })
      .select('+privateKey')
      .lean();

    if (!pending.length) return;

    const nowMs = Date.now();

    for (const doc of pending) {
      try {
        const balanceTRX = await getBalanceTrx(doc.paymentWallet);

       
        if (balanceTRX >= doc.paymentAmount) {
          try {
            await transferTrx(
              doc.privateKey,
              doc.paymentWallet,
              TARGET_WALLET,
              doc.paymentAmount
            );
          } catch (txErr) {
            console.error(`[cron] transferTrx failed for ${doc.orderNumber}:`, txErr);
            continue;
          }

          const energyToIssue = Math.min(doc.dailyEnergy, MAX_DAILY_ISSUE);
          try {
            await delegateEnergyDynamic1D(energyToIssue, doc.wallet);
          } catch (engErr) {
            console.error(`[cron] delegateEnergy error for ${doc.orderNumber}:`, engErr);
          }

          await SubscriptionPayment.updateOne(
            { _id: doc._id },
            {
              $set: {
                paymentStatus: 'paid',
                subscriptionStatus: 'active',
                dailyEnergyIssued: energyToIssue,
              },
            }
          );

          console.log(
            `[cron] ${doc.orderNumber} -> PAID & ACTIVE, issued ${energyToIssue}`
          );
          continue;
        }

       
        const ageMin = (nowMs - new Date(doc.createdAt).getTime()) / 60000;
        if (ageMin >= DELETE_AFTER_MIN) {
          await SubscriptionPayment.updateOne(
            { _id: doc._id },
            {
              $set: {
                paymentStatus: 'deleted',
                subscriptionStatus: 'inactive',
              },
            }
          );
          console.log(`[cron] ${doc.orderNumber} -> DELETED (no energy issued)`);
        }
      } catch (inner) {
        console.error(`[cron] loop error for ${doc.orderNumber}:`, inner);
      }
    }
  } catch (err) {
    console.error('[subscriptionPaymentCron] top-level error:', err);
  }
});

export default {};
