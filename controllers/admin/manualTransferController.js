import Payment from '../../models/Payment.js';
import Config from '../../models/Config.js';
import axios from 'axios';
import {
  tronWeb,
  delegateEnergyOneHour,
  sendUsdtFromEphemeralToMain,
  getUsdtBalance,
} from '../../utils/tronHelpers.js';

export const page = (req, res) => res.render('manual-transfer');

export const manualTransfer = async (req, res, next) => {
  try {
    const { paymentId, targetWallet } = req.body;
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

    const { currency, walletAddress, privateKey } = payment;

    if (currency === 'USDT') {
     
      const bal = await getUsdtBalance(walletAddress);
      if (bal === 0) return res.status(400).json({ error: 'Баланс USDT = 0' });
      const del = await delegateEnergyOneHour(walletAddress);
      if (del.errno) return res.status(500).json({ error: 'Ошибка делегирования энергии' });

      await new Promise((r) => setTimeout(r, 10_000));

      const txHash = await sendUsdtFromEphemeralToMain(
        privateKey,
        walletAddress,
        targetWallet,
        bal
      );
      return res.json({ message: 'USDT отправлены', txHash });
    }

    if (currency === 'TRX') {
      const balanceSun = await tronWeb.trx.getBalance(walletAddress);
      if (balanceSun <= 0) return res.status(400).json({ error: 'Баланс TRX = 0' });

      const tx = await tronWeb.transactionBuilder.sendTrx(
        targetWallet,
        balanceSun,
        walletAddress
      );
      const signedTx = await tronWeb.trx.sign(tx, privateKey);
      const receipt = await tronWeb.trx.sendRawTransaction(signedTx);
      return res.json({ message: 'TRX отправлены', receipt });
    }

    res.status(400).json({ error: 'Неподдерживаемая валюта' });
  } catch (e) {
    next(e);
  }
};

export const manualTransferToFreeze = async (req, res, next) => {
  try {
    const { paymentId } = req.body;
    
    
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

    
    const config = await Config.findOne();
    if (!config?.freezeWallet) {
      return res.status(500).json({ error: 'freezeWallet не настроен в конфигурации' });
    }

    const targetWallet = config.freezeWallet;
    const { currency, walletAddress, privateKey } = payment;
    let txHashOrReceipt;

    if (currency === 'USDT') {
      
      const bal = await getUsdtBalance(walletAddress);
      if (bal === 0) return res.status(400).json({ error: 'Баланс USDT = 0' });

      
      const del = await delegateEnergyOneHour(walletAddress);
      if ('errno' in del && del.errno !== 0) {
        return res.status(500).json({ error: 'Ошибка делегирования энергии' });
      }

      
      await new Promise((r) => setTimeout(r, 15_000));

      
      txHashOrReceipt = await sendUsdtFromEphemeralToMain(
        privateKey,
        walletAddress,
        targetWallet,
        bal
      );
    } else if (currency === 'TRX') {
      
      const balanceSun = await tronWeb.trx.getBalance(walletAddress);
      if (balanceSun <= 0) return res.status(400).json({ error: 'Баланс TRX = 0' });

      
      const tx = await tronWeb.transactionBuilder.sendTrx(
        targetWallet,
        balanceSun,
        walletAddress
      );
      const signedTx = await tronWeb.trx.sign(tx, privateKey);
      txHashOrReceipt = await tronWeb.trx.sendRawTransaction(signedTx);
    } else {
      return res.status(400).json({ error: 'Неподдерживаемая валюта' });
    }

    
    payment.status = 'completed';
    await payment.save();

   
    if (payment.url_callback) {
      try {
        console.group(`Callback для платежа ${payment._id} (manualTransferToFreeze)`);
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

    res.json({ 
      success: true, 
      message: `${currency} успешно переведены на freeze кошелёк`,
      paymentId,
      targetWallet,
      tx: txHashOrReceipt 
    });
  } catch (e) {
    next(e);
  }
};


