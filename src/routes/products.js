import express from 'express';
import auth from '../middlewares/auth.js';
import { validateProduct, validateSkuParam, addProduct, getProduct } from '../controllers/productsController.js';

const router = express.Router();

router.post('/', auth, validateProduct, addProduct);
router.get('/:sku', auth, validateSkuParam, getProduct);

export default router;