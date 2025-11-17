import { v4 as uuidv4 } from 'uuid';
import immudb from '../services/immudbService.js';
import { validationResult } from 'express-validator';
import { isImmuDbNotFoundError, responseHelper } from '../utils/immudbUtils.js';

export const addProduct = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return responseHelper(res, 400, 'Validation failed', { errors: errors.array() });
  }

  try {
    const product = { ...req.body };
    const key = `product:${product.sku}`;
    const value = JSON.stringify(product);

    // Check if product already exists
    try {
      await immudb.verifiedGet(key);
      return responseHelper(res, 409, `Product with SKU: ${product.sku} already exists`);
    } catch (err) {
      if (!isImmuDbNotFoundError(err)) {
        throw err;
      }
    }

    const result = await immudb.verifiedSet(key, value);

    const transactionKey = `transaction:${product.sku}`;
    const transaction = {
      transaction_id: uuidv4(),
      sku: product.sku,
      type: 'IN',
      quantity_change: product.quantity,
      reason: 'Initial stock',
      performed_by: req.user?.email || 'unknown',
      timestamp: new Date().toISOString(),
    };

    // Store transaction initial stock for a product
    await immudb.verifiedSet(transactionKey, JSON.stringify(transaction));

    return responseHelper(res, 201, 'Created', { product, verification: result.txHash });
  } catch (e) {
    return responseHelper(res, 500, e.message);
  }
};

export const getProduct = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return responseHelper(res, 400, 'Validation failed', { errors: errors.array(), sku: req.params.sku });
  }

  const { sku } = req.params;
  const key = `product:${sku}`;

  try {
    // Retrieve product from immudb
    const productRes = await immudb.verifiedGet(key);
    if (!productRes.valEntry?.val) {
      return responseHelper(res, 404, 'Product not found');
    }

    let product;
    try {
      product = JSON.parse(productRes.valEntry.val);
    } catch (parseErr) {
      console.error(`Corrupt product entry for SKU: ${sku}`, parseErr);
      return responseHelper(res, 500, 'Corrupt product data', { sku });
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
    }

    product.current_stock = calculatedStock;

    //product.current_stock = product.quantity;
    return responseHelper(res, 200, 'Success', { product });
  } catch (err) {
    if (isImmuDbNotFoundError(err)) {
      console.error('No product found for SKU:', sku);
      return responseHelper(res, 404, `No product found for SKU: ${sku}`);
    }
    console.error('Error retrieving product for SKU:', sku, err);
    return responseHelper(res, 500, `Error retrieving product for SKU: ${sku}`);
  }
};