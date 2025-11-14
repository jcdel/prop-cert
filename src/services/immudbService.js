import {
  Client,
  verifyVerification,
} from '@codenotary/immudb-node';

class ImmudbService {
  constructor() {
    this.client = null;
  }

  async initialize() {
      try {
        this.client = new Client({
          host: process.env.IMMUDB_HOST || 'localhost',
          port: process.env.IMMUDB_PORT ? parseInt(process.env.IMMUDB_PORT, 10) : 3322,
          user: process.env.IMMUDB_USER || 'immudb',
          password: process.env.IMMUDB_PASS || 'immudb',
          database: process.env.IMMUDB_DB || 'defaultdb',
        });
        console.log("🟢 Connected to immudb");
        return this.client;
      } catch (err) {
        console.error("🔴 Failed to connect to immudb:", err.message);
        throw new Error('Could not connect to immudb database');
      }
  }

  async runWithSessionRetry(operation) {
    try {
      return await operation();
    } catch (err) {
      if (
        err &&
        err.message &&
        err.message.includes("7 PERMISSION_DENIED: session not found")
      ) {

        console.log('🔄 immudb session expired, re-initializing session...');

        await this.initialize();
        return await operation();
      }
      throw err;
    }
  }

  async set(key, value) {

    return await this.runWithSessionRetry(async () => {

      const entries = [
        {key: Buffer.from(key), val: Buffer.from(value) }
      ];
      return await this.client.setValEntries({kvms: entries });
    });
  }

  async get(key) {

    return await this.runWithSessionRetry(async () => {
      return await this.client.getValRef({ key: Buffer.from(key) });
    });
  }

  async verifiedSet(key, value) {

    return await this.runWithSessionRetry(async () => {

      const entries = [
        {key: Buffer.from(key), val: Buffer.from(value) }
      ];

      const state = await this.client.getDbCurrentState();
      const result = await this.client.setValEntriesGetVerification({
        kvms: entries,
        refTxId: state.txId,
        refHash: state.txHash
      });

      const verificationValid = verifyVerification(result.verification);
      //console.log('Set Verification:', result.verification);

      result.txHash = state.txHash; // Attach current txHash for reference

      if (!verificationValid) {
        throw new Error('ImmuDB verification failed during set operation');
      }

      return result;
    });
  }

  async verifiedGet(key) {

    return await this.runWithSessionRetry(async () => {

      const state = await this.client.getDbCurrentState();
      const result = await this.client.getValRefAndVerification({
        key: Buffer.from(key),
        refTxId: state.txId,
        refHash: state.txHash
      });

      const verificationValid = verifyVerification(result.verification);
      //console.log('Set Verification:', result.verification);

      if (!verificationValid) {
        throw new Error('ImmuDB verification failed during get operation');
      }

      return result;
    });
  }

  async history(key, limit = 50) {

    return await this.runWithSessionRetry(async () => {

      const options = {
        key: Buffer.from(key),
        sortDescending: true,
        limit,
      };
      return this.client.scanHistory(options);
    });
  }

  async scanDbEntries(startTxId = 1) {

    return await this.runWithSessionRetry(async () => {

      return this.client.scanDbEntries(startTxId);
    });
  }
}

const immudbService = new ImmudbService();
export default immudbService;