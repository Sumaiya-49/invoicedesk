import { Router } from 'express';
import { handle } from '../errors.js';
import { check, settingsSchema } from '../validation.js';
import { loadAll, loadSampleData } from '../services/account.js';
import { updateSettings } from '../services/users.js';

const router = Router();

// GET /api/data  -> everything the app shows, in one request
router.get('/data', handle(async (req, res) => res.json(await loadAll(req.userId))));

// PUT /api/settings  -> invoice template: logo, colour, layout, terms
router.put('/settings', handle(async (req, res) => res.json(await updateSettings(req.userId, check(settingsSchema, req.body)))));

// POST /api/sample-data  -> fills an empty account with the sample business
router.post('/sample-data', handle(async (req, res) => {
  await loadSampleData(req.userId);
  res.status(201).json(await loadAll(req.userId));
}));

export default router;
