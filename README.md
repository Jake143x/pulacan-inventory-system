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

### 3. Start backend + Internal Administrative Panel + Customer Web Portal (+ optional AI)

From project root:

```bash
npm run dev
```

This starts:

- **Backend** at http://localhost:3001
- **Internal Administrative Panel** at http://localhost:5173
- **Customer Web Portal** at http://localhost:5174
- **Python AI service** at http://127.0.0.1:8000 (optional; requires Python and `pip install -r ai/requirements.txt`)

To use the Python AI for the in-app Assistant, set in **backend/.env**:

```bash
AI_SERVICE_URL=http://127.0.0.1:8000
```

Then the backend forwards chat to the Python AI when it is running; if the Python service is down, the built-in Node chatbot is used automatically.

Open in browser:

- Staff (owner/admin/cashier): **http://localhost:5173** — Internal Administrative Panel
- Customers: **http://localhost:5174** — Customer Web Portal

**Tip:** If the in-editor browser shows "Connection Failed" or "ERR_CONNECTION_REFUSED", open the URL in **Chrome or Edge** instead. The app must have the backend running (step 3) and works best in an external browser.

**Troubleshooting:** If you see *Port 8000 already in use*, the dev script now frees it before starting the AI; if it still fails, run `npx kill-port 8000` then `npm run dev` again. If you see "Customer account" on a different port (e.g. 5177), that is the Staff app—open the Customer Web Portal link shown on the page (e.g. http://localhost:5174) or check the `[customer]` line in the terminal for the correct URL. **If the AI service does not start:** ensure Python is installed and in your PATH (on Windows try `py --version` or `python --version`), then install dependencies: `cd ai` then `py -m pip install -r requirements.txt` (or `python -m pip install -r requirements.txt`). The dev script will try `py` then `python` on Windows so the AI can start without opening extra tabs.

## Run only what you need

- **Everything (including Python AI):** `npm run dev` (backend + admin + customer + ai)
- **Backend only:** `cd backend && npm run dev`
- **Internal Administrative Panel only:** `cd frontend && npm run dev` (needs backend on 3001)
- **Customer Web Portal only:** `cd customer && npm run dev` (needs backend on 3001)
- **Python AI only:** `npm run dev:ai` (from project root; uses `py` or `python` on Windows)

## Default logins (after seed)

| Role | Email | Password | Use |
|------|-------|----------|-----|
| Owner | owner@inventory.com | Owner123! | Internal Administrative Panel (5173) |
| Admin | admin@inventory.com | Admin123! | Internal Administrative Panel (5173) |
| Cashier | cashier@inventory.com | Cashier123! | Internal Administrative Panel (5173) |
| Customer | customer@inventory.com | Customer123! | Customer Web Portal (5174) |

## API documentation

See `backend/API.md` for endpoints.

## AI: free and deployment-ready

The built-in AI (chat assistant, demand forecast, recommendations) **does not use OpenAI or any paid external API**. It runs entirely on your server and database:

- **In-app AI Assistant** (customer & staff): rule-based intent detection + live database lookups (products, orders, inventory). No API keys.
- **Demand forecast** (admin): uses your sales history and open-source logic (Node backend and optional Python/Prophet). No external AI service.
- **Python AI service** (optional): calls your backend API; no paid APIs.

When you publish to your domain, the AI will keep working with **no extra cost or API keys**. No OpenAI, no Anthropic, no third-party AI billing.
