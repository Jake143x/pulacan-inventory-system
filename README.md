# Web-Based Inventory Management System

Full-stack application with **two separate frontends**: **Internal Administrative Panel** (staff) and **Customer Web Portal**. Both use the same backend API on localhost.

## How it works

| App | URL | Who uses it |
|-----|-----|-------------|
| **Backend (API)** | http://localhost:3001 | Shared by both frontends |
| **Internal Administrative Panel** | http://localhost:5173 | Owner, Admin, Cashier — inventory, POS, orders, reports, AI, users, config |
| **Pulacan Hardware and Construction** (Customer Web Portal) | http://localhost:5174 | Customers — browse, cart, place order, order history, help |

- **One backend** serves both applications.
- **Staff** (Owner, Admin, Cashier) use the **Internal Administrative Panel** (5173). If a customer logs in there, they are directed to the Customer Web Portal.
- **Customers** use the **Customer Web Portal** (5174). If staff logs in there, they are directed to the Internal Administrative Panel.

## Project structure

```
pulucan/
├── backend/        # API (shared) — port 3001
├── frontend/       # Internal Administrative Panel — port 5173
├── customer/       # Pulacan Hardware and Construction (Customer Web Portal) — port 5174
└── package.json    # Run all: npm run dev
```

## Run on localhost (first time)

### 1. Install dependencies

```bash
cd c:\pulucan
npm install
cd backend && npm install
cd ..\frontend && npm install
cd ..\customer && npm install
cd ..
```

### 2. Set up database and seed data

```bash
cd backend
npx prisma generate
npx prisma db push
npm run seed
cd ..
```

### 3. Start backend + Internal Administrative Panel + Customer Web Portal

From project root:

```bash
npm run dev
```

This starts:

- **Backend** at http://localhost:3001
- **Internal Administrative Panel** at http://localhost:5173
- **Customer Web Portal** at http://localhost:5174

Open in browser:

- Staff (owner/admin/cashier): **http://localhost:5173** — Internal Administrative Panel
- Customers: **http://localhost:5174** — Customer Web Portal

## Run only what you need

- **Everything:** `npm run dev` (backend + admin panel + customer portal)
- **Backend only:** `cd backend && npm run dev`
- **Internal Administrative Panel only:** `cd frontend && npm run dev` (needs backend on 3001)
- **Customer Web Portal only:** `cd customer && npm run dev` (needs backend on 3001)

## Default logins (after seed)

| Role | Email | Password | Use |
|------|-------|----------|-----|
| Owner | owner@inventory.com | Owner123! | Internal Administrative Panel (5173) |
| Admin | admin@inventory.com | Admin123! | Internal Administrative Panel (5173) |
| Cashier | cashier@inventory.com | Cashier123! | Internal Administrative Panel (5173) |
| Customer | customer@inventory.com | Customer123! | Customer Web Portal (5174) |

## API documentation

See `backend/API.md` for endpoints.
