import express from 'express';
import auth from '../middlewares/auth.js';
import { auditTransaction } from '../controllers/auditController.js';

const router = express.Router();

router.get('/verify/:transaction_id', auth, auditTransaction);

export default router;