import immudb from '../services/immudbService.js';
import { validationResult } from 'express-validator';
import { isImmuDbNotFoundError, responseHelper } from '../utils/immudbUtils.js';

export const auditTransaction = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return responseHelper(res, 400, 'Validation failed', { errors: errors.array() });
  }

  const { transaction_id } = req.params;

  try {
    const txIdKey = `transaction:id:${transaction_id}`;
    const txRes = await immudb.verifiedGet(txIdKey);
    if (!txRes.valEntry?.val) {
      return responseHelper(res, 404, 'Transaction not found');
    }
    let transaction;
    try {
      transaction = JSON.parse(txRes.valEntry.val);
    } catch (parseErr) {
      console.error(`Corrupt transaction entry for ID: ${transaction_id}`, parseErr);
      return responseHelper(res, 500, 'Corrupt transaction data', { transaction_id });
    }
    return responseHelper(res, 200, 'Transaction verified', { transaction, verification: true });
  } catch (e) {
    if (isImmuDbNotFoundError(e)) {
      return responseHelper(res, 404, 'Transaction not found');
    }
    return responseHelper(res, 500, e.message);
  }
};