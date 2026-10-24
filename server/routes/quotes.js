import { Router } from 'express';
import { handle } from '../errors.js';
import { check, quoteSchema, quoteStatusSchema } from '../validation.js';
import { listQuotes, createQuote, updateQuote, setQuoteStatus, deleteQuote, convertQuote } from '../services/quotes.js';

const router = Router();

router.get('/', handle(async (req, res) => res.json(await listQuotes(req.userId))));
router.post('/', handle(async (req, res) => res.status(201).json(await createQuote(req.userId, check(quoteSchema, req.body)))));
router.put('/:no', handle(async (req, res) => res.json(await updateQuote(req.userId, req.params.no, check(quoteSchema, req.body)))));
router.patch('/:no/status', handle(async (req, res) => res.json(await setQuoteStatus(req.userId, req.params.no, check(quoteStatusSchema, req.body).status))));
router.delete('/:no', handle(async (req, res) => res.json(await deleteQuote(req.userId, req.params.no))));

// POST /api/quotes/QT-0003/convert  -> creates an invoice from the quotation
router.post('/:no/convert', handle(async (req, res) => res.status(201).json(await convertQuote(req.userId, req.params.no))));

export default router;
