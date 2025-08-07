import Subscription from '../../models/subscriptionPayment.js';

export const index = async (req, res, next) => {
  try {
    const {
      p   = 1,    // page
      pay = 'all',
      sub = 'all',
    } = req.query;

    const limit = 15;
    const skip  = (p - 1) * limit;

    const conditions = {};
    if (pay !== 'all') conditions.paymentStatus      = pay;
    if (sub !== 'all') conditions.subscriptionStatus = sub;

    const [list, total] = await Promise.all([
      Subscription.find(conditions)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Subscription.countDocuments(conditions),
    ]);

    res.render('subscriptions', {
      subs        : list,
      currentPage : +p,
      totalPages  : Math.ceil(total / limit) || 1,
      filterPay   : pay,
      filterSub   : sub,
    });
  } catch (e) {
    next(e);
  }
};

export const info = async (req, res, next) => {
  try {
    const sub = await Subscription.findById(req.params.id).lean();
    if (!sub) return res.status(404).json({ error: 'subscription not found' });
    res.json(sub);
  } catch (e) {
    next(e);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id, paymentStatus, subscriptionStatus, expiresAt, dailyEnergy } = req.body;
    const upd = {};
    if (paymentStatus)      upd.paymentStatus      = paymentStatus;
    if (subscriptionStatus) upd.subscriptionStatus = subscriptionStatus;
    if (expiresAt)          upd.expiresAt          = new Date(expiresAt);
    if (dailyEnergy)        upd.dailyEnergy        = +dailyEnergy;

    await Subscription.updateOne({ _id: id }, { $set: upd });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};
