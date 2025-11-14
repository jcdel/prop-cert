import immudb from '../services/immudbService.js';
import { isImmuDbNotFoundError } from '../utils/immudbUtils.js';
import { v4 as uuidv4 } from 'uuid';
import { query, param, body, validationResult } from 'express-validator';

// Validation middleware (customize as needed)
export const validateTransaction = [
  body('sku').isString().notEmpty(),
  body('type').isIn(['IN', 'OUT', 'ADJUSTMENT']),
  body('quantity').isInt(),
  body('reason').isString().optional(),
];

// Validation middleware for getHistory endpoint
export const validateGetHistory = [
  param('sku')
    .exists().withMessage('SKU is required')
    .isString().withMessage('SKU must be a string')
    .matches(/^[A-Z0-9\-]+$/).withMessage('SKU must be uppercase, numbers, or hyphens'),
  query('size')
    .optional()
    .isInt({ min: 1 }).withMessage('Size must be a positive integer'),
];

export const createTransaction = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {

    const {
      sku,
      type,
      reason,
      quantity,
    } = req.body;

    const productRes = await immudb.verifiedGet(`product:${sku}`);
    if (!productRes.valEntry.val)
      return res.status(404).json({ message: 'Product not found' });

    const transactionKey = `transaction:${sku}`;

    // Get running stock
    let current = 0;
    try {
      const history = await immudb.history(transactionKey, 1000);

      if (history) {
        for (const item of history) {
          try {
            const t = JSON.parse(item.valTxEntry.val);
            current += t.quantity_change;
          } catch (parseErr) {
            console.error(`Error parsing item value for SKU ${sku}:`, parseErr);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to retrieve/process history for SKU ${sku}:`, err);
      //return res.status(500).json({ message: 'Error retrieving stock history' });
    }

    let qChange =
      type === 'IN'
        ? +Math.abs(quantity)
        : type === 'OUT'
        ? -Math.abs(quantity)
        : quantity;

    if (type === 'OUT' && current + qChange < 0) {
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

    await immudb.verifiedSet(
      transactionKey,
      JSON.stringify(transaction)
    );

    res.status(201).json({
      transaction,
      verification: true,
    });
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

    if (!history || !history.length) {
      return res.status(404).json({ message: 'No transactions found for SKU: ' + sku, sku });
    }

    let runningBalance = 0;
    const transactions = history.map(item => {
      let tx;
      try {
        tx = JSON.parse(item.valTxEntry.val);
      } catch (parseErr) {
        // Skip corrupted entries, or you can return 500 if you want to be strict
        console.warn('Skipping malformed transaction in SKU:', sku, parseErr);
        return null;
      }
      runningBalance += tx.quantity_change;
      return {
        ...tx,
        verification: true,
      };
    }).filter(Boolean); // Remove any nulls from parse failures

    res.json({ sku, transactions, runningBalance });
  } catch (err) {
    if (isImmuDbNotFoundError(err)) {
      console.error('No transactions found for SKU:', sku, err);
      return res.status(404).json({ message: 'No transactions found for SKU: ' + sku });
    } else {
      console.error('Error retrieving transactions for SKU:', sku, err);
      return res.status(500).json({ message: 'Error retrieving transactions for SKU: ' + sku });
    }
  }
};

export const getSnapshot = async (req, res) => {
  try {

    const dbEntries = await immudb.scanDbEntries(1);
    const productSkus = dbEntries
      .map(entry => entry.key.toString('utf8'))
      .filter(key => key.startsWith('product:'))
      .map(key => key.replace('product:', ''));
    //console.log('productSkus:', productSkus);

    const snapshot = [];

    for (const sku of productSkus) {
      const productRes = await immudb.verifiedGet(`product:${sku}`);
      //console.log('productRes for snapshot:', productRes);

      let quantity = 0;
      let lastTxTs = null;

      try {

        const txs = await immudb.history(`transaction:${sku}`, 1000);
        //console.log('txsssssssssssssss for snapshot:', txs);
       
        if (txs && txs.length > 0) {
          for (const tx of txs) {
            const txObj = JSON.parse(tx.valTxEntry.val);

            //console.log('txObj for snapshot:', txObj);
            quantity += txObj.quantity_change;
            lastTxTs = txObj.timestamp;
          }
        }
        
      } catch (error) {
        console.error(`Error retrieving transactions for SKU ${sku}:`, error);
      }

      snapshot.push({
        sku,
        product: productRes.valEntry.val ? JSON.parse(productRes.valEntry.val) : null,
        current_quantity: quantity,
        last_transaction_timestamp: lastTxTs,
      });
    }

    res.json({ snapshot });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};