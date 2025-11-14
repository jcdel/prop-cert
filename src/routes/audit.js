import express from 'express';
import { auditTransaction } from '../controllers/auditController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

router.get('/verify/:transaction_id', auth, auditTransaction);

export default router;