import express from 'express';
import auth from '../middlewares/auth.js';
import { validateProduct, validateSkuParam } from '../utils/validator.js';
import { addProduct, getProduct } from '../controllers/productsController.js';

const router = express.Router();

// POST /
// Authenticated route to add a new product
router.post(
	'/',
	auth,
	validateProduct,
	addProduct
);

// GET /:sku
// Authenticated route to get a product by SKU
router.get(
	'/:sku',
	auth,
	validateSkuParam,
	getProduct
);

export default router;