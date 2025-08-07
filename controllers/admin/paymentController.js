import 'dotenv/config';
import axios from 'axios';

import * as paySvc from '../../services/paymentService.js';
import Payment from '../../models/Payment.js';
import Config from '../../models/Config.js';
import CleanWallet from '../../models/CleanWallet.js';
import {
  delegateEnergyOneHour,
  sendUsdtFromEphemeralToMain,
  getUsdtBalance,
  tronWeb,
} from '../../utils/tronHelpers.js';

export const index = async (req, res, next) => {
  try {
    const { page = 1 } = req.query;
    res.render('admin', await paySvc.list(+page));
  } catch (e) {
    next(e);
  }
};

export const updateConfig = async (req, res, next) => {
  try {
    await paySvc.updateConfig(req.body);
    res.redirect('/irishkachikipiki7843');
  } catch (e) {
    next(e);
  }
};

export const addCleanWallet = async (req, res, next) => {
  try {
    await paySvc.addCleanWallet(req.body);
    res.redirect('/reports');
  } catch (e) {
    next(e);
  }
};

export const getPrivateKey = async (req, res, next) => {
  try {
    const { paymentId, password } = req.body;
    if (password !== process.env.PRIVATE_PASSWORD)
      return res.status(403).json({ error: 'Неверный пароль' });

    const p = await paySvc.getById(paymentId);
    if (!p) return res.status(404).json({ error: 'Платеж не найден' });

    res.json({ privateKey: p.privateKey });
  } catch (e) {
    next(e);
  }
};

export const updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentId, newStatus } = req.body;
    if (!paymentId || !newStatus)
      return res.status(400).json({ error: 'Отсутствует paymentId или newStatus' });

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

    const allowed = ['pending', 'wait', 'lesspay', 'completed', 'frozen', 'delete', 'refaund'];
    if (!allowed.includes(newStatus))
      return res.status(400).json({ error: 'Недопустимый статус' });

    payment.status = newStatus;
    await payment.save();

    if (payment.url_callback) {
      try {
        console.group(`Callback для платежа ${payment._id} (updatePaymentStatus)`);
        const body = {
          paymentId: payment._id,
          status: payment.status,
          amlPassed: payment.amlPassed,
          balance: payment.realAmount || 0,
        };

        const resp = await axios.post(payment.url_callback, body, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json, text/plain, */*',
            Referer: 'https://1.moneycame.com/',
          },
          validateStatus: () => true,
        });

        console.log('HTTP статус:', resp.status);
        const raw = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
        console.log('Raw response:', raw);
        const parsed = resp.data;
        console.log('Parsed:', JSON.stringify(parsed, null, 2));
        console.groupEnd();
      } catch (err) {
        console.error(`Ошибка callback для ${payment._id}:`, err.message);
      }
    }

    res.json({ success: true, paymentId, newStatus });
  } catch (e) {
    next(e);
  }
};

export const getPaymentInfo = async (req, res, next) => {
  try {
    const p = await paySvc.getById(req.params.paymentId);
    if (!p) return res.status(404).json({ error: 'Платёж не найден' });
    res.json(p);
  } catch (e) {
    next(e);
  }
};

export const transferToFreeze = async (req, res, next) => {
  const { paymentId } = req.body;
  try {
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: 'Платёж не найден' });
    if (payment.status !== 'frozen')
      return res.status(400).json({ error: 'Статус платежа не "frozen"' });

    const config = await Config.findOne();
    if (!config?.freezeWallet)
      return res.status(500).json({ error: 'freezeWallet не настроен' });

    const targetWallet = config.freezeWallet;
    const { currency, walletAddress, privateKey } = payment;
    let txHashOrReceipt;

    if (currency === 'USDT') {
      const del = await delegateEnergyOneHour(walletAddress);
      if ('errno' in del && del.errno !== 0)
        return res.status(500).json({ error: 'Ошибка делегирования энергии' });

      await new Promise((r) => setTimeout(r, 20_000));
      const amount = await getUsdtBalance(walletAddress);
      if (amount === 0) return res.status(400).json({ error: 'Баланс USDT = 0' });

      txHashOrReceipt = await sendUsdtFromEphemeralToMain(
        privateKey,
        walletAddress,
        targetWallet,
        amount
      );
    } else if (currency === 'TRX') {
      const balanceSun = await tronWeb.trx.getBalance(walletAddress);
      if (balanceSun <= 0) return res.status(400).json({ error: 'Баланс TRX = 0' });

      const tx = await tronWeb.transactionBuilder.sendTrx(
        targetWallet,
        balanceSun,
        walletAddress
      );
      const signed = await tronWeb.trx.sign(tx, privateKey);
      txHashOrReceipt = await tronWeb.trx.sendRawTransaction(signed);
    } else {
      return res.status(400).json({ error: 'Неподдерживаемая валюта' });
    }

    payment.status = 'completed';
    await payment.save();

    if (payment.url_callback) {
      try {
        console.group(`Callback для платежа ${payment._id} (transferToFreeze)`);
        const body = {
          paymentId: payment._id,
          status: payment.status,
          amlPassed: payment.amlPassed,
          balance: payment.realAmount || 0,
        };

        const resp = await axios.post(payment.url_callback, body, {
          headers: { 'Content-Type': 'application/json' },
          validateStatus: () => true,
        });

        console.log('HTTP статус:', resp.status);
        const raw = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
        console.log('Raw response:', raw);
        const parsed = resp.data;
        console.log('Parsed:', JSON.stringify(parsed, null, 2));
        console.groupEnd();
      } catch (err) {
        console.error(`Ошибка callback для ${payment._id}:`, err.message);
      }
    }

    res.json({ success: true, tx: txHashOrReceipt });
  } catch (e) {
    next(e);
  }
};

export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send('Ошибка выхода');
    res.redirect('/evninv0v23sFWFW');
  });
};
