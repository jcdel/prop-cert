import express from 'express';
import auth from '../middlewares/auth.js';
import { validateInventoryAtParams } from '../utils/validator.js';
import { getInventoryAtTimestamp } from '../controllers/featureController.js';

const router = express.Router();

// GET /time-travel/:sku/at/:timestamp
// Authenticated route to get inventory at a specific timestamp
router.get(
	'/time-travel/:sku/at/:timestamp',
	auth,
	validateInventoryAtParams,
	getInventoryAtTimestamp
);

export default router;