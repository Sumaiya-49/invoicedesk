import { Router } from 'express';
import { handle } from '../errors.js';
import { check, expenseSchema } from '../validation.js';
import { listExpenses, createExpense, updateExpense, deleteExpense } from '../services/expenses.js';

const router = Router();

router.get('/', handle(async (req, res) => res.json(await listExpenses(req.userId))));
router.post('/', handle(async (req, res) => res.status(201).json(await createExpense(req.userId, check(expenseSchema, req.body)))));
router.put('/:id', handle(async (req, res) => res.json(await updateExpense(req.userId, Number(req.params.id), check(expenseSchema, req.body)))));
router.delete('/:id', handle(async (req, res) => res.json(await deleteExpense(req.userId, Number(req.params.id)))));

export default router;
