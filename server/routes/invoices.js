import { Router } from 'express';
import { handle } from '../errors.js';
import { check, invoiceSchema, invoiceUpdateSchema, paymentSchema, remindSchema } from '../validation.js';
import {
  listInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, addPayment, markUnpaid, markReminded,
} from '../services/invoices.js';

const router = Router();

router.get('/', handle(async (req, res) => res.json(await listInvoices(req.userId))));
router.get('/:no', handle(async (req, res) => res.json(await getInvoice(req.userId, req.params.no))));
router.post('/', handle(async (req, res) => res.status(201).json(await createInvoice(req.userId, check(invoiceSchema, req.body)))));
router.put('/:no', handle(async (req, res) => res.json(await updateInvoice(req.userId, req.params.no, check(invoiceUpdateSchema, req.body)))));
router.delete('/:no', handle(async (req, res) => res.json(await deleteInvoice(req.userId, req.params.no))));

// POST /api/invoices/INV-0005/payments  { amount, method, date }
router.post('/:no/payments', handle(async (req, res) => res.status(201).json(await addPayment(req.userId, req.params.no, check(paymentSchema, req.body)))));

// POST /api/invoices/INV-0006/unpaid  (removes its payments)
router.post('/:no/unpaid', handle(async (req, res) => res.json(await markUnpaid(req.userId, req.params.no))));

// POST /api/invoices/reminders  { nos: ['INV-0007'] }
router.post('/reminders', handle(async (req, res) => res.json(await markReminded(req.userId, check(remindSchema, req.body).nos))));

export default router;
