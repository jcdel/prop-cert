import express from "express";
import cors from "cors";
import immudb from './services/immudbService.js';
import productRoutes from "./routes/products.js";
import inventoryRoutes from "./routes/inventory.js";
import auditRoutes from "./routes/audit.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/product', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/audit', auditRoutes);

app.get('/health', async (req, res) => {
  try {

    const key = 'status';
    const value = 'Service is healthy';
    await immudb.set(key, value);
    const result = await immudb.get(key);  
 
    let valueString = null;
    if (result && result.valTxEntry && result.valTxEntry.val) {
      valueString = result.valTxEntry.val.toString();
    }
    res.json({ connected: true, value: valueString });
} catch (err) {
    res.status(500).json({ connected: false, error: err.message });
}
});

// INITIALIZE IMMUDB BEFORE STARTING SERVER!
const startServer = async () => {
  await immudb.initialize();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 API running on port ${PORT}`);
  });
};

startServer();