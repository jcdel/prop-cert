
import { Client, verifyVerification } from '@codenotary/immudb-node';

class ImmudbService {
  constructor() {
    this.client = null;
  }

  /**
   * Initialize the immudb client connection
   */
  async initialize() {
    try {
      this.client = new Client({
        host: process.env.IMMUDB_HOST || 'localhost',
        port: process.env.IMMUDB_PORT ? parseInt(process.env.IMMUDB_PORT, 10) : 3322,
        user: process.env.IMMUDB_USER || 'immudb',
        password: process.env.IMMUDB_PASS || 'immudb',
        database: process.env.IMMUDB_DB || 'defaultdb',
      });
      console.log('🟢 Connected to immudb');
      return this.client;
    } catch (err) {
      console.error('🔴 Failed to connect to immudb:', err.message);
      throw new Error('Could not connect to immudb database');
    }
  }

  /**
   * Retry operation if session expired
   */
  async runWithSessionRetry(operation) {
    try {
      return await operation();
    } catch (err) {
      if (
        err?.message?.includes('7 PERMISSION_DENIED: session not found')
      ) {
        console.log('🔄 immudb session expired, re-initializing session...');
        await this.initialize();
        return await operation();
      }
      throw err;
    }
  }

  /**
   * Set a value for a key
   */
  async set(key, value) {
    return this.runWithSessionRetry(async () => {
      const entries = [{ key: Buffer.from(key), val: Buffer.from(value) }];
      return this.client.setValEntries({ kvms: entries });
    });
  }

  /**
   * Get a value by key
   */
  async get(key) {
    return this.runWithSessionRetry(async () => {
      return this.client.getValRef({ key: Buffer.from(key) });
    });
  }

  /**
   * Set a value for a key with verification
   */
  async verifiedSet(key, value) {
    return this.runWithSessionRetry(async () => {
      const entries = [{ key: Buffer.from(key), val: Buffer.from(value) }];
      const state = await this.client.getDbCurrentState();
      const result = await this.client.setValEntriesGetVerification({
        kvms: entries,
        refTxId: state.txId,
        refHash: state.txHash,
      });
      const verificationValid = verifyVerification(result.verification);
      result.txHash = state.txHash;
      if (!verificationValid) {
        throw new Error('ImmuDB verification failed during set operation');
      }
      return result;
    });
  }

  /**
   * Get a value by key with verification
   */
  async verifiedGet(key) {
    return this.runWithSessionRetry(async () => {
      const state = await this.client.getDbCurrentState();
      const result = await this.client.getValRefAndVerification({
        key: Buffer.from(key),
        refTxId: state.txId,
        refHash: state.txHash,
      });
      const verificationValid = verifyVerification(result.verification);
      if (!verificationValid) {
        throw new Error('ImmuDB verification failed during get operation');
      }
      return result;
    });
  }

  /**
   * Get history for a key
   */
  async history(key, limit = 1000) {
    return this.runWithSessionRetry(async () => {
      const options = {
        key: Buffer.from(key),
        sortDescending: true,
        limit,
      };
      return this.client.scanHistory(options);
    });
  }

  /**
   * Scan all DB entries from a starting transaction ID
   */
  async scanDbEntries(startTxId = 1) {
    return this.runWithSessionRetry(async () => {
      return this.client.scanDbEntries(startTxId);
    });
  }
}

const immudbService = new ImmudbService();
export default immudbService;