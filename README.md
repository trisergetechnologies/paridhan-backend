# paridhan-backend

API for Paridhan Emporium (storefront, dashboard, payments).

## Client prep — keep categories, fresh admin + seller

Removes **products, orders, carts, all customers, and all old accounts**. Keeps **categories** and **storefront settings**. Creates one admin and one seller named **Paridhan Emporium**.

```bash
export SEED_PASSWORD="your-secure-password"
# optional: SEED_ADMIN_EMAIL, SEED_SELLER_EMAIL
npm run seed:clean
```

Use this before client handoff when categories are already configured.

## Full client bootstrap (wipe entire database)

Creates **only** a platform admin and one seller named **Paridhan Emporium**. Deletes all users, categories, products, and orders.

```bash
export SEED_PASSWORD="your-secure-password"
npm run seed:client
```

| Role | Dashboard login | Default email |
|------|-----------------|---------------|
| Platform admin | Choose **Platform admin** | `admin@paridhanemporium.com` |
| Seller (Paridhan Emporium) | Choose **Seller** | `seller@paridhanemporium.com` |

## Other seed commands

| Command | Purpose |
|---------|---------|
| `npm run seed:clean` | Delete products/orders/customers; keep categories; new admin + seller |
| `npm run seed:client` | Full wipe → admin + Paridhan Emporium seller only |
| `npm run seed` | **Dev only** — 300 sample products, test customer, orders |
| `npm run seed:destroy` | Wipe all data, no re-seed |

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

Gateway (port 4601) proxies to this service (port 4600). See repo root and `paridhan-api-gateway` for full stack setup.
