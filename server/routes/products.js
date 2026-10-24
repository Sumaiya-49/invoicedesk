import { Router } from 'express';
import { handle } from '../errors.js';
import { check, productSchema } from '../validation.js';
import { listProducts, createProduct, updateProduct, deleteProduct } from '../services/products.js';

const router = Router();

router.get('/', handle(async (req, res) => res.json(await listProducts(req.userId))));
router.post('/', handle(async (req, res) => res.status(201).json(await createProduct(req.userId, check(productSchema, req.body)))));
router.put('/:id', handle(async (req, res) => res.json(await updateProduct(req.userId, Number(req.params.id), check(productSchema, req.body)))));
router.delete('/:id', handle(async (req, res) => res.json(await deleteProduct(req.userId, Number(req.params.id)))));

export default router;
