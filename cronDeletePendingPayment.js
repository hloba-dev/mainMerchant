import 'dotenv/config';
import cron from 'node-cron';

import connectDB from './lib/db.js';
import Payment   from './models/Payment.js';

let isRunning = false;

async function deleteOldPending() {
  if (isRunning) {
    console.log('[CleanPending] previous run still working → skip');
    return;
  }
  isRunning = true;

  const tsBorder = new Date(Date.now() - 30 * 60 * 1_000); // 30 минут назад
  try {
    const res = await Payment.updateMany(
      { status: 'pending', createdAt: { $lt: tsBorder } },
      { $set: { status: 'delete' } },
    );
    console.log(`[CleanPending] updated ${res.modifiedCount || res.nModified} docs`);
  } catch (err) {
    console.error('[CleanPending] ERROR:', err);
  } finally {
    isRunning = false;
  }
}

/* ─────── bootstrap & scheduler ─────── */
(async () => {
  try {
    await connectDB();

    await deleteOldPending();
    cron.schedule('*/5 * * * *', deleteOldPending);
    console.log('[CleanPending] cron scheduled (every 5 min)');
  } catch (err) {
    console.error('[CleanPending] Mongo connect error:', err);
    process.exit(1);
  }
})();

export default {};
