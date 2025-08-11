import speakeasy from 'speakeasy';
import { signToken, verifyToken } from '../../utils/jwt.js';
import { rateLimitUtils } from '../../middlewares/loginRateLimit.js';

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (username === process.env.ADMIN_LOGIN && password === process.env.ADMIN_PASSWORD) {
    
      await rateLimitUtils.resetAttempts(req, 'login');
      
      const tempToken = signToken({ sub: 'admin', type: 'temp-2fa' }, '5m');
      return res.json({ message: 'Primary auth successful, proceed to 2FA', tempToken });
    }
    
    
    const attemptInfo = await rateLimitUtils.recordFailedAttempt(req, 'login');
    
    const remainingAttempts = attemptInfo.maxAttempts - attemptInfo.attempts;
    const response = {
      error: 'Неверный логин или пароль',
      attemptsLeft: Math.max(0, remainingAttempts)
    };
    
    
    if (remainingAttempts <= 0) {
      response.warning = 'IP адрес будет заблокирован на 15 минут';
    } else if (remainingAttempts <= 2) {
      response.warning = `Осталось попыток: ${remainingAttempts}`;
    }
    
    res.status(401).json(response);
  } catch (error) {
    console.error('Ошибка в login контроллере:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

export const verify2FA = async (req, res) => {
  try {
    const { token: twoFaToken, tempToken } = req.body;
    if (!tempToken) {
      return res.status(401).json({ error: 'Temporary token is missing.' });
    }

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
     
      const attemptInfo = await rateLimitUtils.recordFailedAttempt(req, '2fa');
      
      const remainingAttempts = attemptInfo.maxAttempts - attemptInfo.attempts;
      const response = {
        error: 'Неверный код 2FA',
        attemptsLeft: Math.max(0, remainingAttempts)
      };
      
      
      if (remainingAttempts <= 0) {
        response.warning = 'IP адрес будет заблокирован на 15 минут';
      } else if (remainingAttempts <= 2) {
        response.warning = `Осталось попыток: ${remainingAttempts}`;
      }
      
      return res.status(401).json(response);
    }

   
    await rateLimitUtils.resetAttempts(req, 'login');
    await rateLimitUtils.resetAttempts(req, '2fa');

    const accessToken = signToken({ sub: payload.sub, role: 'admin', type: 'access' }, '15m');
    const refreshToken = signToken({ sub: payload.sub, type: 'refresh' }, '7d');

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    });

    res.json({ accessToken, message: 'Login successful' });
  } catch (err) {
    console.error('Ошибка в verify2FA контроллере:', err);
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Invalid or expired temporary token' });
    } else {
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
};

export const refreshToken = (req, res) => {
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
};

export const logout = (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.status(200).json({ message: 'Logged out successfully' });
};

export const getLoginStatus = async (req, res) => {
  try {
    const loginInfo = await rateLimitUtils.getAttemptInfo(req, 'login');
    const twoFAInfo = await rateLimitUtils.getAttemptInfo(req, '2fa');
    
    res.json({
      login: {
        attempts: loginInfo.attempts,
        maxAttempts: loginInfo.maxAttempts,
        isBlocked: loginInfo.isBlocked,
        timeLeft: loginInfo.timeLeft,
        attemptsLeft: Math.max(0, loginInfo.maxAttempts - loginInfo.attempts)
      },
      twoFA: {
        attempts: twoFAInfo.attempts,
        maxAttempts: twoFAInfo.maxAttempts,
        isBlocked: twoFAInfo.isBlocked,
        timeLeft: twoFAInfo.timeLeft,
        attemptsLeft: Math.max(0, twoFAInfo.maxAttempts - twoFAInfo.attempts)
      }
    });
  } catch (error) {
    console.error('Ошибка в getLoginStatus:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}; 