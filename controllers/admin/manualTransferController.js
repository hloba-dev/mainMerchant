import Payment from '../../models/Payment.js';
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
