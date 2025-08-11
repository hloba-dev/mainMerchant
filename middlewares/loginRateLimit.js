import LoginAttempt from '../models/LoginAttempt.js';


function getRealIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.headers['x-client-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1'
  );
}


export const loginRateLimit = async (req, res, next) => {
  try {
    const ip = getRealIP(req);
    const isBlocked = await LoginAttempt.isBlocked(ip, 'login');
    
    if (isBlocked) {
      const attemptInfo = await LoginAttempt.getAttemptInfo(ip, 'login');
      
      return res.status(429).json({
        error: 'Слишком много неудачных попыток входа',
        message: `IP адрес заблокирован на ${Math.ceil(attemptInfo.timeLeft / 60)} минут`,
        timeLeft: attemptInfo.timeLeft,
        attempts: attemptInfo.attempts,
        maxAttempts: attemptInfo.maxAttempts,
        type: 'login_blocked'
      });
    }

    // Добавляем IP в req для использования в контроллере
    req.clientIP = ip;
    next();
  } catch (error) {
    console.error('Ошибка в loginRateLimit middleware:', error);
    next(); 
  }
};


export const twoFARateLimit = async (req, res, next) => {
  try {
    const ip = getRealIP(req);
    const isBlocked = await LoginAttempt.isBlocked(ip, '2fa');
    
    if (isBlocked) {
      const attemptInfo = await LoginAttempt.getAttemptInfo(ip, '2fa');
      
      return res.status(429).json({
        error: 'Слишком много неудачных попыток 2FA',
        message: `IP адрес заблокирован на ${Math.ceil(attemptInfo.timeLeft / 60)} минут`,
        timeLeft: attemptInfo.timeLeft,
        attempts: attemptInfo.attempts,
        maxAttempts: attemptInfo.maxAttempts,
        type: '2fa_blocked'
      });
    }

    
    req.clientIP = ip;
    next();
  } catch (error) {
    console.error('Ошибка в twoFARateLimit middleware:', error);
    next(); 
  }
};


export const rateLimitUtils = {
 
  async recordFailedAttempt(req, attemptType = 'login') {
    const ip = req.clientIP || getRealIP(req);
    return await LoginAttempt.incFailedAttempt(ip, attemptType);
  },

 
  async resetAttempts(req, attemptType = 'login') {
    const ip = req.clientIP || getRealIP(req);
    return await LoginAttempt.resetAttempts(ip, attemptType);
  },

  
  async getAttemptInfo(req, attemptType = 'login') {
    const ip = req.clientIP || getRealIP(req);
    return await LoginAttempt.getAttemptInfo(ip, attemptType);
  },

  
  async isBlocked(req, attemptType = 'login') {
    const ip = req.clientIP || getRealIP(req);
    return await LoginAttempt.isBlocked(ip, attemptType);
  },

  
  getRealIP
};

export default { loginRateLimit, twoFARateLimit, rateLimitUtils };
