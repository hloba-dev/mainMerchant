import 'dotenv/config';

export default function apiKeyGuard(req, res, next) {
  const apiKey = req.header('x-api-key');
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(403).json({ message: 'Неверный или отсутствует API-ключ' });
  }
  next();
}
