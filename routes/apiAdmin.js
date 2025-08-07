import { Router } from 'express';
import speakeasy from 'speakeasy';
import checkAdminApi from '../middlewares/checkAdminApi.js';
import * as paySvc from '../services/paymentService.js';
import * as repSvc from '../services/reportService.js';
import Payment from '../models/Payment.js';
import CleanWallet from '../models/CleanWallet.js';
import { signToken, verifyToken } from '../utils/jwt.js';
import { delegateEnergy } from '../controllers/admin/delegateController.js';
import { manualTransfer } from '../controllers/admin/manualTransferController.js';
import Config from '../models/Config.js';
import * as subSvc from '../services/subscriptionService.js';

const router = Router();

// --- Новая JWT-схема с Refresh-токенами ---

// Шаг 1: Вход по логину и паролю
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_LOGIN && password === process.env.ADMIN_PASSWORD) {
    const tempToken = signToken({ sub: 'admin', type: 'temp-2fa' }, '5m');
    return res.json({ message: 'Primary auth successful, proceed to 2FA', tempToken });
  }
  res.status(401).json({ error: 'Неверный логин или пароль' });
});

// Шаг 2: Вход по 2FA-коду
router.post('/2fa', async (req, res) => {
  const { token: twoFaToken, tempToken } = req.body;
  if (!tempToken) {
    return res.status(401).json({ error: 'Temporary token is missing.' });
  }

  try {
    const payload = verifyToken(tempToken);
    if (payload.type !== 'temp-2fa') {
      return res.status(403).json({ error: 'Invalid temporary token type.' });
    }

    const verified = speakeasy.totp.verify({
      secret: process.env.ADMIN_2FA_SECRET,
      encoding: 'base32',
      token: twoFaToken,
    });

    if (!verified) {
      return res.status(401).json({ error: 'Неверный код 2FA' });
    }

    const accessToken = signToken({ sub: payload.sub, role: 'admin', type: 'access' }, '15m');
    const refreshToken = signToken({ sub: payload.sub, type: 'refresh' }, '7d');

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    });

    res.json({ accessToken, message: 'Login successful' });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired temporary token' });
  }
});

// Шаг 3a: Обновление токена (GET, на случай если фронт использует GET)
router.get('/refresh', (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token not found.' });
  }

  try {
    const payload = verifyToken(refreshToken);
    if (payload.type !== 'refresh') {
      return res.status(403).json({ error: 'Invalid refresh token.' });
    }
    const accessToken = signToken({ sub: payload.sub, role: 'admin', type: 'access' }, '15m');
    res.json({ accessToken });
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired refresh token.' });
  }
});

// Шаг 3: Обновление токена
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token not found.' });
  }

  try {
    const payload = verifyToken(refreshToken);
    if (payload.type !== 'refresh') {
      return res.status(403).json({ error: 'Invalid refresh token.' });
    }
    const accessToken = signToken({ sub: payload.sub, role: 'admin', type: 'access' }, '15m');
    res.json({ accessToken });
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired refresh token.' });
  }
});

// Шаг 4: Выход
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.status(200).json({ message: 'Logged out successfully' });
});


// --- Защищенные роуты ---

router.use(checkAdminApi);


router.get('/payments', async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page, 10)  || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const data  = await paySvc.list(page, limit);
    res.json(data);
  } catch (e) {
    next(e);
  }
});


router.get('/payments/:id', async (req, res, next) => {
  try {
    const payment = await paySvc.getById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Платёж не найден' });
    res.json(payment);
  } catch (e) {
    next(e);
  }
});


router.put('/payments/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newStatus } = req.body;
    if (!newStatus)
      return res.status(400).json({ error: 'Отсутствует newStatus' });

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

    const allowed = ['pending', 'wait', 'lesspay', 'completed', 'frozen', 'delete', 'refaund'];
    if (!allowed.includes(newStatus))
      return res.status(400).json({ error: 'Недопустимый статус' });

    payment.status = newStatus;
    await payment.save();

    res.json({ success: true, paymentId: id, newStatus });
  } catch (e) {
    next(e);
  }
});


router.get('/reports/today', async (req, res, next) => {
  try {
    const stats = await repSvc.todayStats();
    res.json(stats);
  } catch (e) {
    next(e);
  }
});


router.get('/config', async (req, res, next) => {
  try {
    const config = await Config.findOne().lean();
    if (!config) {
      // Если конфиг не найден, можно вернуть пустой объект или ошибку
      return res.status(404).json({ error: 'Конфигурация не найдена' });
    }
    res.json({ config });
  } catch (e) {
    next(e);
  }
});


router.put('/config', async (req, res, next) => {
  try {
    const updated = await paySvc.updateConfig(req.body);
    res.json({ success: true, config: updated });
  } catch (e) {
    next(e);
  }
});


router.get('/clean-wallets', async (req, res, next) => {
  try {
    const wallets = await CleanWallet.find().lean();
    res.json(wallets);
  } catch (e) {
    next(e);
  }
});


router.post('/clean-wallets', async (req, res, next) => {
  try {
    const wallet = await paySvc.addCleanWallet(req.body);
    res.json({ success: true, wallet });
  } catch (e) {
    next(e);
  }
});

//  Удалить «чистый» кошелёк
router.delete('/clean-wallets/:id', async (req, res, next) => {
  try {
    const deleted = await paySvc.deleteCleanWallet(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Wallet not found' });
    res.json({ success: true, id: req.params.id });
  } catch (e) {
    next(e);
  }
});


router.post('/delegate-energy', delegateEnergy);

router.post('/manual-transfer', manualTransfer);

router.get('/subscriptions', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const data = await subSvc.list(page, limit);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/subscriptions/:id', async (req, res, next) => {
  try {
    const sub = await subSvc.getById(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.json(sub);
  } catch (e) {
    next(e);
  }
});

router.put('/subscriptions/:id', async (req, res, next) => {
  try {
    const updated = await subSvc.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ success: true, subscription: updated });
  } catch (e) {
    next(e);
  }
});

export default router;
