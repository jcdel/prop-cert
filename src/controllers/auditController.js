import immudb from '../services/immudbService.js';
import { validationResult } from 'express-validator';
import { isImmuDbNotFoundError } from '../utils/immudbUtils.js';

export const auditTransaction = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { transaction_id } = req.params;

  try {
    const txIdKey = `transaction:id:${transaction_id}`;
    const txRes = await immudb.verifiedGet(txIdKey);
    if (!txRes.valEntry?.val) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    let transaction;
    try {
      transaction = JSON.parse(txRes.valEntry.val);
    } catch (parseErr) {
      console.error(`Corrupt transaction entry for ID: ${transaction_id}`, parseErr);
      return res.status(500).json({ message: 'Corrupt transaction data', transaction_id });
    }
    res.json({ transaction, verification: true });
  } catch (e) {
    if (isImmuDbNotFoundError(e)) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.status(500).json({ error: e.message });
  }
};