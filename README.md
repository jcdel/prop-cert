# Shop Inventory Management System (PropCert Tech Challenge)

An immutable inventory system using Immudb, Node.js, and Express.

---

## ✨ Features

- **Add and query products** with tamper-proof storage
- **Record IN/OUT/ADJUSTMENT transactions**, cryptographically verified
- **Query inventory history** with running balance and verification
- **API-key authentication**
- **Append-only inventorial data**, with verifiability proofs available via API

---

## 🚀 Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jcdel/prop-cert.git
   cd prop-cert
   ```

2. **Create a `.env` file:**
   ```env
   PORT=3000
   API_KEY_SECRET=your_secret_key
   IMMUDB_HOST=immudb
   IMMUDB_PORT=3322
   IMMUDB_USER=immudb
   IMMUDB_PASS=immudb
   IMMUDB_DB=defaultdb
   ```

3. **Build & Run via Docker Compose:**
   ```bash
   docker-compose up --build
   ```

4. **Access:**
   - API: [http://localhost:3000](http://localhost:3000)
   - Immudb: [localhost:3322](http://localhost:3322)

---

## 🔒 API Authentication

_All requests require an API key header:_
```
x-api-key: your_api_key
```

_Inventory transaction POSTs also require:_
```
x-user-email: example@user.email
```

---

## 🛠️ API Endpoints

| Method | Endpoint                                 | Description                                     |
|--------|------------------------------------------|-------------------------------------------------|
| POST   | `/api/product`                           | Add a product, returns verification hash        |
| GET    | `/api/product/:sku`                      | Get product details & current stock             |
| POST   | `/api/inventory/transaction`             | Record inventory IN/OUT/ADJUSTMENT              |
| GET    | `/api/inventory/history/:sku`            | Transaction history for a product               |
| GET    | `/api/audit/verify/:transaction_id`      | Verify a specific transaction                   |
| GET    | `/api/inventory/snapshot`                | Current inventory for all products              |

---

## 🏗️ Design Decisions

- **Keyspace:** Items prefixed by type (`product:SKU`, `transaction:SKU`).
- **Verified mutations:** All updates use Immudb's verified sets, with cryptographic proofs provided to the client.
- **Atomic stock calculation:** All SKU transactions are history-scanned for real-time balance.
- **Audit:** Every transaction logs performing user and timestamp.

---

## 📦 Postman Collection

See [`postman_collection.json`](./postman_collection.json) for ready-made API requests.
