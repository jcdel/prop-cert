import { v4 as uuidv4 } from 'uuid';
import immudb from '../services/immudbService.js';
import { validationResult } from 'express-validator';
import { isImmuDbNotFoundError } from '../utils/immudbUtils.js';

export const createTransaction = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { sku, type, reason, quantity } = req.body;
    // Check if product exists
    const productRes = await immudb.verifiedGet(`product:${sku}`);
    if (!productRes.valEntry?.val) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const transactionKey = `transaction:${sku}`;

    // Calculate current stock from transaction history
    let currentStock = 0;
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
      return res.status(400).json({ message: 'Insufficient stock' });
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

    res.status(201).json({ transaction, verification: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getHistory = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array(),
      message: 'Validation failed for parameters',
      sku: req.params.sku,
    });
  }

  const { sku } = req.params;
  let { size } = req.query;
  size = size === undefined ? 1000 : Number(size);

  try {
    const history = await immudb.history(`transaction:${sku}`, size);
    if (!Array.isArray(history) || history.length === 0) {
      return res.status(404).json({ message: `No transactions found for SKU: ${sku}`, sku });
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

    res.json({ sku, transactions, runningBalance });
  } catch (err) {
    if (isImmuDbNotFoundError(err)) {
      console.error('No transactions found for SKU:', sku, err);
      return res.status(404).json({ message: `No transactions found for SKU: ${sku}` });
    }
    return res.status(500).json({ message: `Error retrieving transactions for SKU: ${sku}` });
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
    res.json({ snapshot });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};