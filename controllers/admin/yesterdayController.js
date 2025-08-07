import { tronWeb, transferFunds } from '../../utils/tronHelpers.js';
import Payment from '../../models/Payment.js';

export const initPage = (req, res) => {
  req.session.yesterdayAddresses = null;
  req.session.transferResults = null;
  res.render('trx-yesterday', { step: 'initial', addresses: [], transferResults: [], errorMessage: null });
};

export const find = async (req, res, next) => {
  const addresses = [];
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);

    const payments = await Payment.find({
      currency: 'USDT',
      createdAt: { $gte: start, $lte: end },
    }).sort({ createdAt: 1 });

    for (const pay of payments) {
      const balanceSun = await tronWeb.trx.getBalance(pay.walletAddress);
      const balanceTRX = balanceSun / 1e6;
      await new Promise((r) => setTimeout(r, 1000));
      if (balanceTRX >= 1) {
        addresses.push({
          paymentId: pay._id.toString(),
          address: pay.walletAddress,
          privateKey: pay.privateKey,
          balance: balanceTRX,
        });
      }
    }
    req.session.yesterdayAddresses = addresses;
    res.render('trx-yesterday', { step: 'found', addresses, transferResults: [], errorMessage: null });
  } catch (e) {
    next(e);
  }
};

export const transfer = async (req, res, next) => {
  try {
    const addresses = req.session.yesterdayAddresses || [];
    if (!addresses.length) {
      return res.render('trx-yesterday', {
        step: 'done',
        addresses: [],
        transferResults: [],
        errorMessage: 'Нет адресов для перевода (список пуст).',
      });
    }

    const mainWallet = process.env.MAIN_WALLETTOTRX;
    if (!mainWallet) throw new Error('MAIN_WALLETTOTRX не задан в .env!');

    const transferResults = [];
    for (const item of addresses) {
      try {
        const receipt = await transferFunds(
          { walletAddress: item.address, privateKey: item.privateKey },
          mainWallet,
          item.balance,
        );
        await new Promise((r) => setTimeout(r, 1000));
        transferResults.push({ ...item, status: `Успешно, txId=${receipt?.txid || '?'}` });
      } catch (err) {
        transferResults.push({ ...item, status: `Ошибка: ${err.message}` });
      }
    }
    res.render('trx-yesterday', { step: 'done', addresses: [], transferResults, errorMessage: null });
  } catch (e) {
    next(e);
  }
};
