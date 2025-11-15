import immudb from '../services/immudbService.js';
import { param, validationResult } from 'express-validator';
import { isImmuDbNotFoundError } from '../utils/immudbUtils.js';

export const validateTransactionIdParam = [
  param('transaction_id')
    .exists().withMessage('transaction_id is required')
    .bail()
    .isUUID(4).withMessage('transaction_id must be a valid UUID (v4)'),
];

export const auditTransaction = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { transaction_id } = req.params;

  try {

    const txIdKey = `transaction:id:${transaction_id}`;
    const txRes = await immudb.verifiedGet(txIdKey);

    if (!txRes.valEntry.val) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const transaction = JSON.parse(txRes.valEntry.val);

    res.json({
      transaction,
      verification: true,
    });
  } catch (e) {
    if (isImmuDbNotFoundError(e)) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.status(500).json({ error: e.message });
  }
};