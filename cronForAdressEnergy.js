import 'dotenv/config';
import cron from 'node-cron';
import connectDB from './lib/db.js';

import PaymentEnergy   from './models/PaymentEnergy.js';
import AdressForEnergy from './models/AdressForEnergy.js';


(async function run () {
  try {
    await connectDB();
  } catch (err) {
    console.error('[EnergyAddressCron] Mongo connect error:', err);
    process.exit(1);
  }

 
  function getYesterdayUTC() {
    const now   = new Date();
    const start = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 1,
      0, 0, 0, 0,
    ));
    const end   = new Date(start);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  async function syncAddresses() {
    const { start, end } = getYesterdayUTC();
    console.log(
      `[EnergyAddressCron] run ${new Date().toISOString()} ` +
      `(period ${start.toISOString()} – ${end.toISOString()})`,
    );

    try {
      const pays = await PaymentEnergy.find(
        { createdAt: { $gte: start, $lte: end } },
        'walletAddress privateKey userId',
      ).lean();

      for (const p of pays) {
        await AdressForEnergy.updateOne(
          { walletAddress: p.walletAddress },
          {
            $setOnInsert: {
              walletAddress: p.walletAddress,
              privateKey:    p.privateKey,
              userId:        p.userId || null,
              addedAt:       new Date(),
            },
          },
          { upsert: true },
        );
      }
      console.log(`[EnergyAddressCron] processed ${pays.length} payment(s)`);
    } catch (err) {
      console.error('[EnergyAddressCron] ERROR:', err);
    }
  }

  
  await syncAddresses();                     
  cron.schedule('30 3 * * *', syncAddresses); 
})();

export default {};
