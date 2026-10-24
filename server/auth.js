import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from './errors.js';

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return process.env.JWT_SECRET;
};

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const checkPassword = (plain, hash) => bcrypt.compare(plain, hash);

/** Login token, valid for 7 days. The browser sends it back as "Authorization: Bearer <token>". */
export const signLoginToken = (userId) => jwt.sign({ uid: userId, kind: 'login' }, secret(), { expiresIn: '7d' });

/** Express middleware: only lets logged-in users through and sets req.userId. */
export function requireLogin(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError(401, 'Please log in'));
  try {
    const payload = jwt.verify(token, secret());
    if (payload.kind !== 'login') throw new Error('wrong token');
    req.userId = payload.uid;
    next();
  } catch {
    next(new AppError(401, 'Your session has expired. Please log in again.'));
  }
}

// ---- Assistant confirm tokens ----
// When the assistant wants to change data, the exact change is signed into a token and shown as a preview.
// The change only runs when the user clicks Confirm and the browser sends this token back.
// Signing means the browser can't alter the change, and it expires after 10 minutes.
export const signAction = (userId, action) => jwt.sign({ uid: userId, kind: 'action', action }, secret(), { expiresIn: '10m' });

export function readAction(userId, token) {
  let payload;
  try {
    payload = jwt.verify(token, secret());
  } catch {
    throw new AppError(400, 'This preview has expired. Please ask the assistant again.');
  }
  if (payload.kind !== 'action' || payload.uid !== userId) throw new AppError(403, 'This action belongs to another account');
  return payload.action;
}
