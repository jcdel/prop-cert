import immudb from '../services/immudbService.js';
import { isImmuDbNotFoundError } from '../utils/immudbUtils.js';

export const auditTransaction = async (req, res) => {
  const { transaction_id } = req.params;

  try {
    const txKey = `transaction:${transaction_id}`;
    const txRes = await immudb.verifiedGet(txKey);

    console.log('Audit transaction result:', txRes);

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