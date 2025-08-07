import 'dotenv/config';
import cron from 'node-cron';

import connectDB   from './lib/db.js';
import Payment     from './models/Payment.js';
import ClearAddr   from './models/ClearAddress.js';


function yesterdayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(),     0, 0, 0, 0);
  return { start, end };
}

async function syncClearAddresses() {
  const { start, end } = yesterdayRange();
  console.log(
    `[ClearAddressCron] run ${new Date().toISOString()} | range ${start.toISOString()} → ${end.toISOString()}`,
  );

  try {
    const goodPays = await Payment.find(
      {
        currency: 'USDT',
        createdAt: { $gte: start, $lt: end },
        $or: [{ amlPassed: true }, { status: 'delete' }],
      },
      'walletAddress privateKey userId',
    ).lean();

    let inserted = 0;
    for (const p of goodPays) {
      const res = await ClearAddr.updateOne(
        { walletAddress: p.walletAddress },
        {
          $setOnInsert: {
            walletAddress: p.walletAddress,
            privateKey:    p.privateKey,
            userId:        p.userId,
            addedAt:       new Date(),
          },
        },
        { upsert: true },
      );
      if (res.upsertedCount) inserted += 1;
    }

    console.log(
      `[ClearAddressCron] checked ${goodPays.length}, new saved: ${inserted}`,
    );
  } catch (err) {
    console.error('[ClearAddressCron] ERROR:', err);
  }
}


(async () => {
  await connectDB();
  await syncClearAddresses();               
  cron.schedule('30 3 * * *', syncClearAddresses); 
})();

export default {};
