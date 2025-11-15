import express from 'express';
import auth from '../middlewares/auth.js';
import { validateTransactionIdParam, auditTransaction } from '../controllers/auditController.js';

const router = express.Router();

router.get('/verify/:transaction_id', auth, validateTransactionIdParam, auditTransaction);

export default router;