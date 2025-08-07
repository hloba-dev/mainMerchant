import 'dotenv/config';

import Payment     from '../models/Payment.js';
import Config      from '../models/Config.js';
import CleanWallet from '../models/CleanWallet.js';
import {
  tronWeb,
  delegateEnergyOneHour,
  sendUsdtFromEphemeralToMain,
  getUsdtBalance,
  delegateEnergyDynamic,
  transferFunds,
} from '../utils/tronHelpers.js';

export async function list(page = 1, limit = 10) {
  const skip       = (page - 1) * limit;
  const payments   = await Payment.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
  const totalCount = await Payment.countDocuments();
  const totalPages = Math.ceil(totalCount / limit);
  const config     = await Config.findOne();
  return { payments, config, currentPage: page, totalPages };
}

export function getById(id) {
  return Payment.findById(id).exec();
}

export async function updateConfig({ mainWallet, freezeWallet, energyWallet }) {
  let cfg = await Config.findOne();
  if (!cfg) {
    cfg = await Config.create({ mainWallet, freezeWallet, energyWallet });
  } else {
    cfg.mainWallet   = mainWallet;
    cfg.freezeWallet = freezeWallet;
    cfg.energyWallet = energyWallet;
    await cfg.save();
  }
  return cfg;
}

export async function addCleanWallet({ walletAddress, exchange }) {
  let existing = await CleanWallet.findOne({ walletAddress });
  if (!existing) {
    existing = await CleanWallet.create({ walletAddress, exchange });
  }
  return existing;
}

export async function deleteCleanWallet(id) {
  return CleanWallet.findByIdAndDelete(id);
}

export {
  delegateEnergyDynamic,
  transferFunds,
  delegateEnergyOneHour,
  sendUsdtFromEphemeralToMain,
  getUsdtBalance,
  tronWeb,
};
