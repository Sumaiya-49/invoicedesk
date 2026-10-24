import { Router } from 'express';
import { handle } from '../errors.js';
import { check, customerSchema } from '../validation.js';
import { listCustomers, createCustomer, updateCustomer, deleteCustomer } from '../services/customers.js';

const router = Router();

router.get('/', handle(async (req, res) => res.json(await listCustomers(req.userId))));
router.post('/', handle(async (req, res) => res.status(201).json(await createCustomer(req.userId, check(customerSchema, req.body)))));
router.put('/:id', handle(async (req, res) => res.json(await updateCustomer(req.userId, Number(req.params.id), check(customerSchema, req.body)))));
router.delete('/:id', handle(async (req, res) => res.json(await deleteCustomer(req.userId, Number(req.params.id)))));

export default router;
