import { Router } from 'express';
import checkAdminApi from '../middlewares/checkAdminApi.js';
import { loginRateLimit, twoFARateLimit } from '../middlewares/loginRateLimit.js';
import { delegateEnergy } from '../controllers/admin/delegateController.js';
import { manualTransfer, manualTransferToFreeze } from '../controllers/admin/manualTransferController.js';
import * as subSvc from '../services/subscriptionService.js';
import * as reportService from '../services/reportService.js';
import * as authController from '../controllers/admin/authController.js';
import * as paymentController from '../controllers/admin/paymentController.js';
import * as configController from '../controllers/admin/configController.js';
import * as walletController from '../controllers/admin/walletController.js';
import * as subscriptionController from '../controllers/admin/subscriptionController.js';


const router = Router();


router.post('/login', loginRateLimit, authController.login);
router.post('/2fa', twoFARateLimit, authController.verify2FA);
router.get('/refresh', authController.refreshToken);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);
router.get('/login-status', authController.getLoginStatus);



router.use(checkAdminApi);


router.get('/payments', paymentController.listPayments);
router.get('/payments/:id', paymentController.getPaymentById);
router.put('/payments/:id/status', paymentController.updatePaymentStatusApi);


router.get('/reports/today', async (req, res, next) => {
    try {
      const stats = await reportService.todayStats();
      res.json(stats);
    } catch (e) {
      next(e);
    }
  });


router.get('/config', configController.getConfig);
router.put('/config', configController.updateConfig);


router.get('/clean-wallets', walletController.getCleanWallets);
router.post('/clean-wallets', walletController.addCleanWallet);
router.delete('/clean-wallets/:id', walletController.deleteCleanWallet);


router.post('/delegate-energy', delegateEnergy);
router.post('/manual-transfer', manualTransfer);
router.post('/manual-transfer-to-freeze', manualTransferToFreeze);

// Subscriptions
router.get('/subscriptions', subscriptionController.listSubscriptions);
router.get('/subscriptions/:id', subscriptionController.getSubscriptionById);
router.put('/subscriptions/:id', subscriptionController.updateSubscription);


export default router;
