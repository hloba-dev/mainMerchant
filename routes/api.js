import { Router } from 'express';

import apiKeyGuard from '../middlewares/apiKeyGuard.js';

import * as walletCtrl   from '../controllers/api/walletController.js';
import * as paymentCtrl  from '../controllers/api/paymentController.js';
import * as energyCtrl   from '../controllers/api/energyController.js';
import * as subsCtrl     from '../controllers/api/subscriptionController.js';

import { getUsdtBalance } from '../utils/tronHelpers.js';
import { isTronAddress  } from '../utils/validators.js';

const router = Router();

router.use(apiKeyGuard);

router.post('/createWallet',      walletCtrl.createWalletTRX);
router.post('/createWalletUSDT',  walletCtrl.createWalletUSDT);

router.post('/checkPayment',      paymentCtrl.checkPayment);
router.get ('/getPaymentInfo/:paymentId', paymentCtrl.getPaymentInfo);

router.post('/createPaymentEnergy',  energyCtrl.createPaymentEnergy);
router.post('/checkPaymentEnergy',   energyCtrl.checkPaymentEnergy);

router.post('/createSubscriptionPayment', subsCtrl.createSubscriptionPayment);
router.post('/checkSubscriptionPayment',  subsCtrl.checkSubscriptionPayment);

router.post('/usdt-balance', async (req, res) => {
  const address = (req.body.address || '').trim();
  if (!isTronAddress(address))
    return res.status(400).json({ error: 'Invalid TRON address' });

  const balance = await getUsdtBalance(address);
  res.json({ hasBalance: balance > 0, balance });
});

export default router;
