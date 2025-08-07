import SubscriptionPayment from '../models/subscriptionPayment.js';
import EnergyAddr from '../models/AdressForEnergy.js';
import { generateOneTimeWalletUSDT } from './walletService.js';
import { startOfTodayUTC, generateOrderNumber } from '../utils/validators.js';

export async function allocateWallet() {
  const picked = await EnergyAddr.findOneAndDelete(
    { addedAt: { $lt: startOfTodayUTC() } },
    null,
    { sort: { addedAt: 1 } }
  ).lean();
  return picked || generateOneTimeWalletUSDT();
}


export async function list(page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const subscriptions = await SubscriptionPayment.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  const totalCount = await SubscriptionPayment.countDocuments();
  const totalPages = Math.ceil(totalCount / limit);
  return { subscriptions, currentPage: page, totalPages };
}

export function getById(id) {
  return SubscriptionPayment.findById(id).exec();
}

export async function update(id, payload) {
  const sub = await SubscriptionPayment.findById(id);
  if (!sub) return null;
  Object.assign(sub, payload);
  await sub.save();
  return sub;
}

export { SubscriptionPayment, generateOrderNumber };
