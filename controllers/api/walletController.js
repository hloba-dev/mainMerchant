import {
  generateOneTimeWallet,
  generateOneTimeWalletUSDT,
} from '../../services/walletService.js';
import Payment from '../../models/Payment.js';
import { startOfTodayUTC } from '../../utils/validators.js';
import ClearAddr from '../../models/ClearAddress.js';

export const createWalletTRX = async (req, res, next) => {
  try {
    const { userId, amount, url_callback, currency } = req.body;
    const { walletAddress, privateKey } = await generateOneTimeWallet();

    const p = await Payment.create({
      userId,
      walletAddress,
      privateKey,
      amount,
      url_callback,
      status: 'pending',
      currency,
    });
    res.json({ walletAddress, paymentId: p._id });
  } catch (e) {
    next(e);
  }
};

export const createWalletUSDT = async (req, res, next) => {
  try {
    const { userId, amount, url_callback, currency } = req.body;

    const picked = await ClearAddr.findOneAndDelete({
      addedAt: { $lt: startOfTodayUTC() },
    }).lean();

    let walletAddress, privateKey;
    if (picked) {
      ({ walletAddress, privateKey } = picked);
    } else {
      ({ walletAddress, privateKey } = await generateOneTimeWalletUSDT());
    }

    const p = await Payment.create({
      userId,
      walletAddress,
      privateKey,
      amount,
      url_callback,
      status: 'pending',
      currency: currency || 'USDT',
    });
    res.json({ walletAddress, paymentId: p._id });
  } catch (e) {
    next(e);
  }
};
