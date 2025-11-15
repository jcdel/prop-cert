import cors from "cors";
import express from "express";
import auditRoutes from "./routes/audit.js";
import immudb from './services/immudbService.js';
import productRoutes from "./routes/products.js";
import inventoryRoutes from "./routes/inventory.js";
import { isImmuDbNotFoundError } from './utils/immudbUtils.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/product', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/audit', auditRoutes);

app.get('/health', async (req, res) => {
  const KEY = 'health:status';
  const DEFAULT_VALUE = 'Service is healthy';

  const parseValue = (getResult) => {
    return getResult?.valTxEntry?.val?.toString() ?? null;
  };

  try {
    const result = await immudb.get(KEY);
    const valueString = parseValue(result);
    return res.json({ connected: true, value: valueString });
  } catch (err) {
    if (isImmuDbNotFoundError(err)) {
      try {
        await immudb.set(KEY, Buffer.from(DEFAULT_VALUE));
        return res.json({ connected: true, value: DEFAULT_VALUE });
      } catch (setErr) {

        // If set failed (possible race or transient error), try to read again.
        try {
          const retry = await immudb.get(KEY);
          const valueString = parseValue(retry);
          return res.json({ connected: true, value: valueString });
        } catch (retryErr) {
          console.error('Failed to set or re-read health key from immudb:', setErr, retryErr);
          return res.status(500).json({ connected: false, error: (setErr.message || retryErr.message) });
        }
      }
    }

    // Any other error reading immudb
    console.error('Error reading health key from immudb:', err);
    return res.status(500).json({ connected: false, error: err.message });
  }
});

// Initialize immudb and start server
const startServer = async () => {
  await immudb.initialize();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 API running on port ${PORT}`);
  });
};

startServer();