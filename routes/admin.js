import 'dotenv/config';

import { Router } from 'express';

import  checkAdmin       from '../middlewares/checkAdmin.js';
import * as paymentCtrl      from '../controllers/admin/paymentController.js';
import * as reportCtrl       from '../controllers/admin/reportController.js';
import * as manualCtrl       from '../controllers/admin/manualTransferController.js';
import * as delegateCtrl     from '../controllers/admin/delegateController.js';
import * as yesterdayCtrl    from '../controllers/admin/yesterdayController.js';
import * as subCtrl          from '../controllers/admin/subscriptionController.js';

const router = Router();

router.use(checkAdmin);

router.get ('/'                         , paymentCtrl.index);
router.post('/updateConfig'             , paymentCtrl.updateConfig);
router.post('/addCleanWallet'           , paymentCtrl.addCleanWallet);
router.post('/getPrivateKey'            , paymentCtrl.getPrivateKey);
router.post('/updatePaymentStatus'      , paymentCtrl.updatePaymentStatus);
router.get ('/getPaymentInfo/:paymentId', paymentCtrl.getPaymentInfo);
router.post('/transferToFreeze'         , paymentCtrl.transferToFreeze);

router.get ('/reports'                  , reportCtrl.reports);

router.get ('/subscriptions'            , subCtrl.index);
router.get ('/subscriptions/:id'        , subCtrl.info);
router.post('/subscriptions/update'     , subCtrl.update);

router.get ('/manual-transfer'          , manualCtrl.page);
router.post('/manualTransfer'           , manualCtrl.manualTransfer);

router.get ('/delegate-energy'          , delegateCtrl.page);
router.post('/delegate-energy'          , delegateCtrl.delegateEnergy);

router.get ('/trx-yesterday'            , yesterdayCtrl.initPage);
router.post('/trx-yesterday/find'       , yesterdayCtrl.find);
router.post('/trx-yesterday/transfer'   , yesterdayCtrl.transfer);

router.get ('/logout'                   , paymentCtrl.logout);

export default router;
