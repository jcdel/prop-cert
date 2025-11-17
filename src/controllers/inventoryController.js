import { v4 as uuidv4 } from 'uuid';
import immudb from '../services/immudbService.js';
import { validationResult } from 'express-validator';
import { isImmuDbNotFoundError, responseHelper } from '../utils/immudbUtils.js';

export const createTransaction = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return responseHelper(res, 400, 'Validation failed', { errors: errors.array() });
  }

  try {
    const { sku, type, reason, quantity } = req.body;
    // Check if product exists
    const productKey = `product:${sku}`;
    const productRes = await immudb.verifiedGet(productKey);
    if (!productRes.valEntry?.val) {
      return responseHelper(res, 404, 'Product not found');
    }

    const transactionKey = `transaction:${sku}`;

    let currentStock  = 0;
    try {
      const history = await immudb.history(transactionKey, 1000);
      if (Array.isArray(history)) {
        for (const item of history) {
          if (!item.valTxEntry?.val) continue;
          try {
            const t = JSON.parse(item.valTxEntry.val);
            if (typeof t.quantity_change === 'number') {
              currentStock += t.quantity_change;
            }
          } catch (parseErr) {
            console.error(`Error parsing item value for SKU ${sku}:`, parseErr);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to retrieve/process history for SKU ${sku}:`, err);
    }

    // Determine quantity change based on transaction type
    let qChange;
    if (type === 'IN') {
      qChange = Math.abs(Number(quantity));
    } else if (type === 'OUT') {
      qChange = -Math.abs(Number(quantity));
    } else {
      qChange = Number(quantity);
    }

    if (type === 'OUT' && currentStock + qChange < 0) {
      return responseHelper(res, 400, 'Insufficient stock');
    }

    const transaction = {
      transaction_id: uuidv4(),
      sku,
      type,
      quantity_change: qChange,
      reason,
      performed_by: req.user?.email || 'unknown',
      timestamp: new Date().toISOString(),
    };

    // Store transaction by SKU
    await immudb.verifiedSet(transactionKey, JSON.stringify(transaction));
    
    // Store transaction by transaction ID for audit lookup
    const transactionIdKey = `transaction:id:${transaction.transaction_id}`;
    await immudb.verifiedSet(transactionIdKey, JSON.stringify(transaction));

    //update product
    await immudb.verifiedSet(productKey, JSON.stringify({ ...JSON.parse(productRes.valEntry.val), quantity: currentStock +  qChange}));

    return responseHelper(res, 201, 'Created', { transaction, verification: true });
  } catch (e) {
    return responseHelper(res, 500, e.message);
  }
};

export const getHistory = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return responseHelper(res, 400, 'Validation failed', { errors: errors.array(), sku: req.params.sku });
  }

  const { sku } = req.params;
  let { size } = req.query;
  size = size === undefined ? 1000 : Number(size);

  try {
    const history = await immudb.history(`transaction:${sku}`, size);
    if (!Array.isArray(history) || history.length === 0) {
      return responseHelper(res, 404, `No transactions found for SKU: ${sku}`, { sku });
    }

    let runningBalance = 0;
    const transactions = history.map(item => {
      if (!item.valTxEntry?.val) return null;
      let tx;
      try {
        tx = JSON.parse(item.valTxEntry.val);
      } catch (parseErr) {
        console.warn('Skipping malformed transaction in SKU:', sku, parseErr);
        return null;
      }
      if (typeof tx.quantity_change === 'number') {
        runningBalance += tx.quantity_change;
      }
      return {
        ...tx,
        verification: true,
      };
    }).filter(Boolean); // Remove any nulls from parse failures

    return responseHelper(res, 200, 'Success', { sku, transactions, runningBalance });
  } catch (err) {
    if (isImmuDbNotFoundError(err)) {
      return responseHelper(res, 404, `No transactions found for SKU: ${sku}`);
    }
    return responseHelper(res, 500, `Error retrieving transactions for SKU: ${sku}`);
  }
};

export const getSnapshot = async (req, res) => {
  try {
    const dbEntries = await immudb.scanDbEntries(1);
    const productSkus = dbEntries
      .map(entry => entry.key.toString('utf8'))
      .filter(key => key.startsWith('product:'))
      .map(key => key.replace('product:', ''));

    const snapshot = [];
    for (const sku of productSkus) {
      const productRes = await immudb.verifiedGet(`product:${sku}`);
      let currentQuantity = 0;
      let lastTxTimestamp = null;
      try {
        const txs = await immudb.history(`transaction:${sku}`, 1000);
        if (Array.isArray(txs) && txs.length > 0) {
          for (const tx of txs) {
            if (!tx.valTxEntry?.val) continue;
            const txObj = JSON.parse(tx.valTxEntry.val);
            if (typeof txObj.quantity_change === 'number') {
              currentQuantity += txObj.quantity_change;
            }
            lastTxTimestamp = txObj.timestamp;
          }
        }
      } catch (error) {
        // Optionally log error
      }
      snapshot.push({
        sku,
        product: productRes.valEntry?.val ? JSON.parse(productRes.valEntry.val) : null,
        current_quantity: currentQuantity,
        last_transaction_timestamp: lastTxTimestamp,
      });
    }
    return responseHelper(res, 200, 'Success.', { snapshot });
  } catch (e) {
    return responseHelper(res, 500, e.message);
  }
};