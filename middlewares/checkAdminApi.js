import { verifyToken } from '../utils/jwt.js';

export default function checkAdminApi(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.substring(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Authorization token missing' });
    }

    const payload = verifyToken(token);

    if (payload.role !== 'admin' || payload.type !== 'access') {
      return res.status(403).json({ error: 'Invalid admin token' });
    }

   
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
} 