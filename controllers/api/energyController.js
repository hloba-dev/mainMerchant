import { allocateWallet, PaymentEnergy } from '../../services/energyPaymentService.js';
import { isTronAddress, startOfTodayUTC } from '../../utils/validators.js';

export const createPaymentEnergy = async (req, res, next) => {
  try {
    const { userId, amount, amountEnergy, url_callback, walletAddressForEnergy } = req.body;

    if (!walletAddressForEnergy || !isTronAddress(walletAddressForEnergy))
      return res.status(400).json({ message: 'walletAddressForEnergy is required' });

    const amountNum = Number(amount);
    const amountEnergyNum = Number(amountEnergy);
    if (!amount || isNaN(amountNum) || amountNum <= 0)
      return res.status(400).json({ message: 'amount must be positive number' });
    if (!amountEnergy || isNaN(amountEnergyNum) || amountEnergyNum <= 0)
      return res.status(400).json({ message: 'amountEnergy must be positive number' });

    const { walletAddress, privateKey } = await allocateWallet();

    const p = await PaymentEnergy.create({
      userId: userId ?? null,
      walletAddress,
      walletAddressForEnergy,
      privateKey,
      amount: amountNum,
      amountEnergy: amountEnergyNum,
      url_callback: url_callback ?? null,
      status: 'pending',
      currency: 'TRX',
    });
    res.json({ walletAddress, paymentId: p._id });
  } catch (e) {
    next(e);
  }
};

export const checkPaymentEnergy = async (req, res, next) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ message: 'Не указан paymentId' });

    const p = await PaymentEnergy.findById(paymentId).lean();
    if (!p) return res.status(404).json({ message: 'Платёж не найден' });

    res.json({ paymentId, status: p.status });
  } catch (e) {
    next(e);
  }
};
