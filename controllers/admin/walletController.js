import CleanWallet from '../../models/CleanWallet.js';
import * as paySvc from '../../services/paymentService.js';

export const getCleanWallets = async (req, res, next) => {
  try {
    const wallets = await CleanWallet.find().lean();
    res.json(wallets);
  } catch (e) {
    next(e);
  }
};

export const addCleanWallet = async (req, res, next) => {
  try {
    const wallet = await paySvc.addCleanWallet(req.body);
    res.json({ success: true, wallet });
  } catch (e) {
    next(e);
  }
};

export const deleteCleanWallet = async (req, res, next) => {
  try {
    const deleted = await paySvc.deleteCleanWallet(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Wallet not found' });
    res.json({ success: true, id: req.params.id });
  } catch (e) {
    next(e);
  }
}; 