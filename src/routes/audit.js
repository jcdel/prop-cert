import express from 'express';
import auth from '../middlewares/auth.js';
import { validateTransactionIdParam } from '../utils/validator.js';
import { auditTransaction } from '../controllers/auditController.js';

const router = express.Router();

// GET /verify/:transaction_id
// Authenticated route to verify a transaction by its ID
router.get(
	'/verify/:transaction_id',
	auth,
	validateTransactionIdParam,
	auditTransaction
);

export default router;