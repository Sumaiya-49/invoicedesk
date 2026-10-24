import { Router } from 'express';
import { z } from 'zod';
import { handle, AppError } from '../errors.js';
import { check } from '../validation.js';
import { readAction } from '../auth.js';
import { runAssistant } from '../ai/assistant.js';
import { executeWrite } from '../ai/writeTools.js';
import { AIUnavailableError, configuredProviders } from '../ai/llm.js';
import { listMessages, saveMessages, setMessageStatus, clearMessages } from '../services/chatHistory.js';

const router = Router();

// Simple per-user limit so one person can't use up the free AI quota: 40 messages per hour.
// (Kept in memory, so it resets when the server restarts. Good enough for this app.)
const LIMIT = 40;
const recent = new Map();
function rateLimit(userId) {
  const now = Date.now();
  const list = (recent.get(userId) || []).filter((t) => now - t < 3600_000);
  if (list.length >= LIMIT) throw new AppError(429, 'You’ve sent a lot of messages this hour. Please wait a bit and try again.');
  list.push(now);
  recent.set(userId, list);
}

const chatSchema = z.object({
  mode: z.enum(['read', 'write']),
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.string(), content: z.string() })).max(30).default([]),
});

// GET /api/chat/status -> which AI is available (the app shows "Simple mode" when none is)
router.get('/status', (_req, res) => res.json({ providers: configuredProviders() }));

// POST /api/chat  { mode, message, history }
router.post('/', handle(async (req, res) => {
  const body = check(chatSchema, req.body);
  rateLimit(req.userId);
  try {
    res.json(await runAssistant({ userId: req.userId, ...body }));
  } catch (err) {
    // No AI key, free limit reached on every provider, or providers down:
    // tell the app to use its built-in simple assistant instead of showing an error.
    if (err instanceof AIUnavailableError) return res.json({ fallback: true });
    throw err;
  }
}));

// Each preview can be confirmed once. (In memory: protects against double clicks.)
const usedTokens = new Set();

// POST /api/chat/confirm  { token }  -> runs the change the user just approved
router.post('/confirm', handle(async (req, res) => {
  const { token } = check(z.object({ token: z.string().min(10) }), req.body);
  if (usedTokens.has(token)) throw new AppError(409, 'This change was already saved.');
  const action = readAction(req.userId, token);
  const result = await executeWrite(req.userId, action);
  usedTokens.add(token);
  res.json(result);
}));

// ---- Saved conversation ----
const messageSchema = z.object({
  id: z.string().min(1).max(40),
  from: z.enum(['user', 'bot']),
  text: z.string().max(8000),
}).passthrough().refine((m) => JSON.stringify(m).length < 30_000, 'Message is too large');

// GET /api/chat/messages  -> earlier conversation
router.get('/messages', handle(async (req, res) => res.json(await listMessages(req.userId))));
// POST /api/chat/messages  { messages: [...] }
router.post('/messages', handle(async (req, res) => {
  const { messages } = check(z.object({ messages: z.array(messageSchema).min(1).max(10) }), req.body);
  res.status(201).json(await saveMessages(req.userId, messages));
}));
// PATCH /api/chat/messages/:id  { status }
router.patch('/messages/:id', handle(async (req, res) => {
  const { status } = check(z.object({ status: z.enum(['pending', 'saving', 'done', 'cancelled']) }), req.body);
  res.json(await setMessageStatus(req.userId, req.params.id, status));
}));
// DELETE /api/chat/messages  -> "Clear chat"
router.delete('/messages', handle(async (req, res) => res.json(await clearMessages(req.userId))));

export default router;
