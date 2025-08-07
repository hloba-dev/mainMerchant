import { Payment, Config, performAMLCheck, transferFunds } from '../../services/paymentServiceApi.js';
import { tronWeb } from '../../services/walletService.js';

export const checkPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ message: 'Не указан paymentId' });

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: 'Платеж не найден' });

    const balanceSun = await tronWeb.trx.getBalance(payment.walletAddress);
    const balanceTRX = balanceSun / 1e6;

    if (balanceTRX < payment.amount + 1) {
      return res.json({
        paymentId,
        status: payment.status,
        balance: balanceTRX,
        message: 'Средств недостаточно для завершения платежа',
      });
    }

    const amlPassed = await performAMLCheck(payment);
    payment.amlPassed = amlPassed;

    const cfg = await Config.findOne();
    if (!cfg) throw new Error('Конфигурация не найдена');

    const target = amlPassed ? cfg.mainWallet : cfg.freezeWallet;
    payment.status = amlPassed ? 'completed' : 'frozen';

    const receipt = await transferFunds(payment, target, balanceTRX);
    await payment.save();

    res.json({
      paymentId,
      status: payment.status,
      amlPassed,
      balance: balanceTRX,
      transferReceipt: receipt,
    });
  } catch (e) {
    next(e);
  }
};

export const getPaymentInfo = async (req, res, next) => {
  try {
    const p = await Payment.findById(req.params.paymentId).exec();
    if (!p) return res.status(404).json({ error: 'Платёж не найден' });
    res.json(p);
  } catch (e) {
    next(e);
  }
};
