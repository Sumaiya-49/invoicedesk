import { Router } from 'express';
import { handle } from '../errors.js';
import { check, creditNoteSchema, creditNoteUpdateSchema } from '../validation.js';
import { listCreditNotes, createCreditNote, updateCreditNote, deleteCreditNote } from '../services/creditNotes.js';

const router = Router();

router.get('/', handle(async (req, res) => res.json(await listCreditNotes(req.userId))));
router.post('/', handle(async (req, res) => res.status(201).json(await createCreditNote(req.userId, check(creditNoteSchema, req.body)))));

router.put('/:no', handle(async (req, res) => res.json(await updateCreditNote(req.userId, req.params.no, check(creditNoteUpdateSchema, req.body)))));
router.delete('/:no', handle(async (req, res) => res.json(await deleteCreditNote(req.userId, req.params.no))));

export default router;
