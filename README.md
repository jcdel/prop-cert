# Shop Inventory Management System (PropCert Tech Challenge)

An immutable inventory system using Immudb, Node.js and Express.

## Features

- Add and query products with tamper-proof storage
- Record IN/OUT/ADJUSTMENT transactions, cryptographically verified
- Query inventory history with running balance and verification
- API-key authentication
- All inventorial data is append-only, and all verification proofs exposed in API

## Setup

1. Clone the repo

2. Create `.env`:

```
PORT=3000
API_KEY_SECRET=your_secret_key
IMMUDB_HOST=immudb
IMMUDB_PORT=3322
IMMUDB_USER=immudb
IMMUDB_PASS=immudb
IMMUDB_DB=defaultdb
```

3. Build & Run via Docker Compose

```
docker-compose up --build
```

4. Visit [http://localhost:3000](http://localhost:3000) for API, Immudb on 3322.

## API Authentication

Every request must include:

```
x-api-key: your_api_key
```

## Endpoints

- `POST /api/product` — Add product, returns verification hash
- `GET /api/product/:sku` — Get details + current stock (calculated)
- `POST /api/inventory/transaction` — Record inventory IN/OUT/ADJUSTMENT
- `GET /api/inventory/history/:sku` — Transaction history for product
- `GET /api/audit/verify/:transaction_id` — Verify transaction
- `GET /api/inventory/snapshot` — Current inventory for all products

## Design Decisions

- Products and transactions prefixed by type in keyspace, e.g. `product:SKU`, `transaction:SKU`
- All mutations done as verified sets, proofs returned to client
- Transactions for each SKU are history-scanned to compute balance atomically
- Every transaction record stores performing user and timestamp for audit

## Postman

See [postman_collection.json](./postman_collection.json)
