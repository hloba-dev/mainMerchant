import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'default_jwt_secret';

export function signToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, SECRET, { expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}   