import { Router } from 'express';
import * as authCtl from '../controllers/authController.js';

const router = Router();

router
  .route('/evninv0v23sFWFW')
  .get(authCtl.loginForm)
  .post(authCtl.login);

router
  .route('/rberbszrh45aeegr')
  .get(authCtl.tfaForm)
  .post(authCtl.tfaVerify);

export default router;
