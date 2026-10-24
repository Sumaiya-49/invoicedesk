import { Router } from 'express';
import { handle } from '../errors.js';
import { check, signupSchema, loginSchema } from '../validation.js';
import { signLoginToken, requireLogin } from '../auth.js';
import { signup, login, getUser, toSeller } from '../services/users.js';

const router = Router();

// POST /api/auth/signup  -> creates the business account and logs in
router.post('/signup', handle(async (req, res) => {
  const userId = await signup(check(signupSchema, req.body));
  res.status(201).json({ token: signLoginToken(userId) });
}));

// POST /api/auth/login  -> returns a login token
router.post('/login', handle(async (req, res) => {
  const userId = await login(check(loginSchema, req.body));
  res.json({ token: signLoginToken(userId) });
}));

// GET /api/auth/me  -> the logged-in business
router.get('/me', requireLogin, handle(async (req, res) => {
  res.json(toSeller(await getUser(req.userId)));
}));

export default router;
