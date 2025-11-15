import immudb from '../services/immudbService.js';
import { validationResult } from 'express-validator';
import { isImmuDbNotFoundError } from '../utils/immudbUtils.js';

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
      return res.status(409).json({ message: `Product with SKU: ${product.sku} already exists` });
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
    // Retrieve product from immudb
    const productRes = await immudb.verifiedGet(key);
    if (!productRes.valEntry?.val) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let product;
    try {
      product = JSON.parse(productRes.valEntry.val);
    } catch (parseErr) {
      console.error(`Corrupt product entry for SKU: ${sku}`, parseErr);
      return res.status(500).json({ message: 'Corrupt product data', sku });
    }

    // Default to initial quantity if no transactions
    let calculatedStock = product.quantity || 0;

    // Calculate current stock from transaction history
    try {
      const txsHistory = await immudb.history(`transaction:${sku}`, 1000);
      if (Array.isArray(txsHistory)) {
        calculatedStock = 0;
        for (const item of txsHistory) {
          if (!item.valTxEntry?.val) continue;
          try {
            const t = JSON.parse(item.valTxEntry.val);
            if (typeof t.quantity_change === 'number') {
              calculatedStock += t.quantity_change;
            }
          } catch (jsonErr) {
            console.error(`Failed to parse transaction value for SKU ${sku}:`, jsonErr);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to retrieve or process transaction history for SKU ${sku}:`, err);
    }

    product.current_stock = calculatedStock;
    return res.json({ product });
  } catch (err) {
    if (isImmuDbNotFoundError(err)) {
      console.error('No product found for SKU:', sku);
      return res.status(404).json({ message: `No product found for SKU: ${sku}` });
    }
    console.error('Error retrieving product for SKU:', sku, err);
    return res.status(500).json({ message: `Error retrieving product for SKU: ${sku}` });
  }
}