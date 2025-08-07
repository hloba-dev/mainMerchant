export default function primaryAuthGuard(req, res, next) {
  if (!req.session?.primaryAuthPassed) {
    return res.status(403).json({ error: 'Primary authentication step required' });
  }
  next();
} 