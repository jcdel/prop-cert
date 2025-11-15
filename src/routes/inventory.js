import express from 'express';
import auth from '../middlewares/auth.js';
import { validateTransaction, validateGetHistory, createTransaction, getHistory, getSnapshot } from '../controllers/inventoryController.js';

const router = express.Router();

router.post('/transaction', auth, validateTransaction,createTransaction);
router.get('/history/:sku', auth, validateGetHistory, getHistory);
router.get('/snapshot', auth, getSnapshot);

export default router;