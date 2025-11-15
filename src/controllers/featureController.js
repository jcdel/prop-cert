import immudb from '../services/immudbService.js';
import { validationResult } from 'express-validator';
import { isImmuDbNotFoundError } from '../utils/immudbUtils.js';

export const getInventoryAtTimestamp = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { sku, timestamp } = req.params;
  const targetTime = new Date(timestamp);
  if (isNaN(targetTime.getTime())) {
    return res.status(400).json({ message: 'Invalid timestamp' });
  }
  // Helper to get YYYY-MM-DD string
  const getDateString = (date) => date.toISOString().slice(0, 10);
  const targetDateStr = getDateString(targetTime);

  try {
    const transactionKey = `transaction:${sku}`;

    const limit = 2500; //max limit for history
    const history = await immudb.history(transactionKey, limit);

    let inventoryAt = 0;
    const transactions = [];

    if (history && Array.isArray(history)) {
      for (const item of history) {
        if (!item.valTxEntry?.val) continue;
        try {
          const t = JSON.parse(item.valTxEntry?.val);
          if (!t.timestamp) continue;
          const tTime = new Date(t.timestamp);
          if (isNaN(tTime.getTime())) continue;
          
          if (getDateString(tTime) === targetDateStr) {
            inventoryAt += Number(t.quantity_change || 0);
            transactions.push(t);
          }
        } catch (parseErr) {
          console.error(`Failed to parse history item for SKU ${sku}:`, parseErr);
          continue;
        }
      }
    }

    return res.json({
      sku,
      timestamp: targetTime.toISOString(),
      inventory: inventoryAt,
      transactions,
    });
  } catch (e) {
    console.error('getInventoryAtTimestamp error:', e);

    if (typeof isImmuDbNotFoundError === 'function' && isImmuDbNotFoundError(e)) {
      return res.status(404).json({ message: 'No transactions found for SKU' });
    }
    return res.status(500).json({ error: e.message });
  }
};