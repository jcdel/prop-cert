import immudb from '../services/immudbService.js';
import { isImmuDbNotFoundError } from '../utils/immudbUtils.js';
import { param, body, validationResult } from 'express-validator';

// Validation middleware for add product input
export const validateProduct = [
  body('sku')
    .exists().withMessage('SKU is required')
    .isString().withMessage('SKU must be a string')
    .matches(/^[A-Z0-9\-]+$/).withMessage('SKU must be uppercase, numbers or hyphens'),
  body('name')
    .exists().withMessage('Name is required')
    .isString().withMessage('Name must be a string')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('description')
    .optional()
    .isString().withMessage('Description must be a string'),
  body('price')
    .exists().withMessage('Price is required')
    .isFloat({ gt: 0 }).withMessage('Price must be a positive number'),
  body('quantity')
    .exists().withMessage('Quantity is required')
    .isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('category')
    .optional()
    .isString().withMessage('Category must be a string'),
  body('supplier')
    .optional()
    .isString().withMessage('Supplier must be a string'),
];

// Validation middleware for SKU param
export const validateSkuParam = [
  param('sku')
    .exists().withMessage('SKU is required')
    .isString().withMessage('SKU must be a string')
    .matches(/^[A-Z0-9\-]+$/).withMessage('SKU must be uppercase, numbers, or hyphens'),
];

export const addProduct = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array(),
      message: "Validation failed"
    });
  }

  try {
    const product = { ...req.body };
    const key = `product:${product.sku}`;
    const value = JSON.stringify(product);

    // Check if product already exists
    try {
      await immudb.verifiedGet(key);
      return res.status(409).json({ message: `Product with SKU ${product.sku} already exists` });
    } catch (err) {
      if (!isImmuDbNotFoundError(err)) {
        throw err;
      }
    }

    const result = await immudb.verifiedSet(key, value);

    return res.status(201).json({
      product,
      verification: result.txHash
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getProduct = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array(),
      message: 'Validation failed for SKU parameter',
      sku: req.params.sku,
    });
  }

  const { sku } = req.params;
  const key = `product:${sku}`;

  try {
    const productRes = await immudb.verifiedGet(key);

    if (!productRes.valEntry.val) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let product;
    try {
      product = JSON.parse(productRes.valEntry.val);
    } catch (parseErr) {
      console.error(`Corrupt product entry for SKU: ${sku}`, parseErr);
      return res.status(500).json({ message: 'Corrupt product data', sku });
    }

    product.current_stock = product.quantity || 0;

    // Calculate inventory from transactions
    let stock = 0;
    try {
      const txsHistory = await immudb.history(`transaction:${sku}`, 100);
      if (Array.isArray(txsHistory)) {
        for (const item of txsHistory) {
          try {
            const t = JSON.parse(item.valTxEntry.val);
            stock += t.quantity_change;
          } catch (jsonErr) {
            console.error(`Failed to parse transaction value for SKU ${sku}:`, jsonErr);
          }
        }
      }
      product.current_stock = stock;
    } catch (err) {
      console.error(`Failed to retrieve or process transaction history for SKU ${sku}:`, err);
    }

    return res.json({ product });
  } catch (err) {
    if (isImmuDbNotFoundError(err)) {
      console.error('No product found for SKU:', sku);
      return res.status(404).json({ message: `No product found for SKU: ${sku}` });
    } else {
      console.error('Error retrieving product for SKU:', sku, err);
      return res.status(500).json({ message: `Error retrieving product for SKU: ${sku}` });
    }
  }
}