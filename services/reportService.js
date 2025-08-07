import Payment from '../models/Payment.js';

export async function todayStats() {
  const now         = new Date();
  const startOfDay  = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const usdtStats = await Payment.aggregate([
    {
      $match: {
        currency: 'USDT',
        status: 'completed',
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  const trxStats = await Payment.aggregate([
    {
      $match: {
        currency: 'TRX',
        status: 'completed',
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  const deletedCountToday = await Payment.countDocuments({
    status: 'delete',
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  return {
    totalUsdt: usdtStats[0]?.total ?? 0,
    countUsdt: usdtStats[0]?.count ?? 0,
    totalTrx: trxStats[0]?.total ?? 0,
    countTrx: trxStats[0]?.count ?? 0,
    deletedCountToday,
  };
}
