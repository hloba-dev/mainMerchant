import { isEmail, isTronAddress, startOfTodayUTC } from '../../utils/validators.js';
import {
  SubscriptionPayment,
  allocateWallet,
  generateOrderNumber,
} from '../../services/subscriptionService.js';

const BASE_ENERGY = 131_000;
const PRICE_PER_BASE_UNIT = 20;
const MIN_DAILY_ENERGY = BASE_ENERGY;
const MAX_DAILY_ENERGY = 1_500_000;
const ALLOWED_DURATIONS = [7, 14, 21, 31];

export const createSubscriptionPayment = async (req, res, next) => {
  try {
    const { email, days, dailyEnergy, walletAddressForEnergy } = req.body;

    if (!email || !isEmail(email))
      return res.status(400).json({ message: 'invalid email' });

    const daysNum = Number(days);
    if (!ALLOWED_DURATIONS.includes(daysNum))
      return res
        .status(400)
        .json({ message: `days must be one of ${ALLOWED_DURATIONS.join(',')}` });

    const dailyEnergyNum = Number(dailyEnergy);
    if (
      isNaN(dailyEnergyNum) ||
      dailyEnergyNum < MIN_DAILY_ENERGY ||
      dailyEnergyNum > MAX_DAILY_ENERGY
    )
      return res.status(400).json({
        message: `dailyEnergy must be between ${MIN_DAILY_ENERGY} and ${MAX_DAILY_ENERGY}`,
      });

    if (!walletAddressForEnergy || !isTronAddress(walletAddressForEnergy))
      return res
        .status(400)
        .json({ message: 'invalid walletAddressForEnergy' });

    const ratio = dailyEnergyNum / BASE_ENERGY;
    const pricePerDay = PRICE_PER_BASE_UNIT * ratio;
    const paymentAmount = Number((pricePerDay * daysNum).toFixed(2));

    const expiresAt = new Date();
    expiresAt.setHours(0, 0, 0, 0);
    expiresAt.setDate(expiresAt.getDate() + daysNum);

    const { walletAddress: paymentWallet, privateKey } = await allocateWallet();

    const orderNumber = generateOrderNumber();
    await SubscriptionPayment.create({
      email,
      orderNumber,
      paymentStatus: 'pending',
      paymentAmount,
      subscriptionStatus: 'inactive',
      expiresAt,
      dailyEnergy: dailyEnergyNum,
      dailyEnergyIssued: 0,
      wallet: walletAddressForEnergy,
      paymentWallet,
      privateKey,
    });

    res.json({ paymentWallet, paymentAmount, days: daysNum, orderNumber });
  } catch (e) {
    next(e);
  }
};

export const checkSubscriptionPayment = async (req, res, next) => {
  try {
    const { orderNumber } = req.body;
    if (!orderNumber)
      return res.status(400).json({ message: 'orderNumber required' });

    const p = await SubscriptionPayment.findOne({ orderNumber }).lean();
    if (!p)
      return res
        .status(404)
        .json({ message: 'subscription payment not found' });

    res.json({
      paymentId: p._id,
      orderNumber: p.orderNumber,
      paymentStatus: p.paymentStatus,
      subscriptionStatus: p.subscriptionStatus,
      expiresAt: p.expiresAt,
      paymentAmount: p.paymentAmount,
    });
  } catch (e) {
    next(e);
  }
};
