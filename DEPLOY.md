# Deploying Pulacan Inventory System to Render.com

This guide walks you through publishing the **Pulacan Inventory System** (backend API, admin dashboard, and customer shop) to [Render](https://render.com/).

## What Gets Deployed

| Component | Type on Render | Description |
|-----------|----------------|-------------|
| **pulacan-db** | PostgreSQL | Database (Prisma) |
| **pulacan-api** | Web Service | Node.js API (Express + Prisma) |
| **pulacan-admin** | Static Site | Admin dashboard (React) |
| **pulacan-customer** | Static Site | Customer shop (React) |

---

## Option A: Deploy with Blueprint (recommended)

### 1. Push your code to GitHub

Make sure your project is in a Git repo and pushed to GitHub (or GitLab).

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Create a Render account and connect the repo

1. Go to [render.com](https://render.com/) and sign up / log in.
2. Click **New** → **Blueprint**.
3. Connect your GitHub (or GitLab) account and select the repository that contains `render.yaml`.
4. Render will detect the `render.yaml` in the root and show the services and database.

### 3. Add required environment variables

Render will prompt for any `sync: false` variables.

**For `pulacan-api` (Backend):**

- **API_BASE_URL**  
  Set this **after** the first deploy, to your API’s public URL, e.g.  
  `https://pulacan-api.onrender.com`  
  (no trailing slash). Used for product image URLs in emails/API responses.

**For `pulacan-admin` (Admin dashboard):**

- **VITE_API_URL**  
  Your API base URL including `/api`, e.g.  
  `https://pulacan-api.onrender.com/api`

**For `pulacan-customer` (Customer shop):**

- **VITE_API_URL**  
  Same as admin:  
  `https://pulacan-api.onrender.com/api`

### 4. Deploy

1. Click **Apply** to create the database and all services.
2. Wait for the **API** to deploy first (it runs migrations and starts the server).
3. Once the API is live, set **API_BASE_URL** on `pulacan-api` and **VITE_API_URL** on both static sites (see above), then trigger a **Manual Deploy** for the two static sites so they build with the correct API URL.

### 5. Seed the database (optional)

To create roles and an initial admin user, run the seed from your machine using the **external** database URL from Render:

1. In Render Dashboard → **pulacan-db** → **Info** → copy **External Database URL**.
2. Locally:

```bash
cd backend
set DATABASE_URL=postgresql://...   # paste External Database URL (Windows)
# Or on macOS/Linux:
# export DATABASE_URL="postgresql://..."
npx prisma db push
npx tsx prisma/seed.ts
```

Use the same `DATABASE_URL` if you need to run migrations from your machine later.

---

## Option B: Manual setup (without Blueprint)

### 1. Create the database

1. **New** → **PostgreSQL**.
2. Name: `pulacan-db`, Region: **Oregon** (or your choice), Plan: **Free**.
3. Create. Copy the **Internal Database URL** (use this for the API on Render).

### 2. Create the Backend Web Service

1. **New** → **Web Service**.
2. Connect the repo, choose the same repository.
3. Settings:
   - **Name:** `pulacan-api`
   - **Region:** Oregon (or same as DB)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npx prisma migrate deploy && node dist/index.js`
4. **Environment:**
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = paste the **Internal Database URL** from step 1
   - `JWT_SECRET` = generate a long random string (e.g. 32+ chars)
   - `API_BASE_URL` = `https://pulacan-api.onrender.com` (use your actual URL after first deploy)
5. **Health Check Path:** `/api/health`
6. Create Web Service. After deploy, note the URL (e.g. `https://pulacan-api.onrender.com`).

### 3. Create the Admin Static Site

1. **New** → **Static Site**.
2. Connect the same repo.
3. **Name:** `pulacan-admin`
4. **Root Directory:** `frontend`
5. **Build Command:** `npm install && npm run build`
6. **Publish Directory:** `dist`
7. **Environment:** `VITE_API_URL` = `https://pulacan-api.onrender.com/api` (your real API URL)
8. Create Static Site.

### 4. Create the Customer Static Site

1. **New** → **Static Site** again.
2. Same repo. **Name:** `pulacan-customer`
3. **Root Directory:** `customer`
4. **Build Command:** `npm install && npm run build`
5. **Publish Directory:** `dist`
6. **Environment:** `VITE_API_URL` = `https://pulacan-api.onrender.com/api`
7. Create Static Site.

### 5. Seed the database (optional)

Same as Option A, step 5: use the **External Database URL** from the Render Postgres dashboard and run `npx prisma db push` and `npx tsx prisma/seed.ts` from the `backend` folder locally.

---

## Environment variables reference

### Backend (`pulacan-api`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string (from Render Postgres) |
| `JWT_SECRET` | Yes | Secret for signing JWTs (use a long random string) |
| `NODE_ENV` | - | Set to `production` on Render |
| `API_BASE_URL` | Yes* | Public API URL (e.g. `https://pulacan-api.onrender.com`) for upload/image links |
| `JWT_EXPIRES_IN` | - | Optional, default `7d` |
| `RATE_LIMIT_ENABLED` | - | Optional, `1` to enable |
| `RATE_LIMIT_MAX` | - | Optional |
| `LOW_STOCK_THRESHOLD_DEFAULT` | - | Optional, number |

\* Set after first deploy so product image URLs point to your live API.

### Admin & Customer (build-time)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Full API base URL, e.g. `https://pulacan-api.onrender.com/api` |

---

## Free tier notes

- **Postgres (free):** Data is removed after 90 days unless upgraded.
- **Web Service (free):** Spins down after ~15 min of no traffic; first request may be slow (cold start).
- **Static sites:** Free tier is usually sufficient for admin and customer UIs.

For production, consider a **Starter** (or higher) plan for the API and database to avoid cold starts and data loss.

---

## Troubleshooting

- **API returns 503 or doesn’t start**  
  Check **Logs** for the `pulacan-api` service. Ensure `DATABASE_URL` is the **Internal** URL and `JWT_SECRET` is set. Confirm migrations run: `npx prisma migrate deploy` in the start command.

- **Admin/Customer can’t reach API**  
  Ensure `VITE_API_URL` is set to `https://YOUR-API-URL.onrender.com/api` (with `/api`) and that you redeployed the static sites after setting it.

- **CORS errors**  
  The backend uses `cors({ origin: true, credentials: true })`, so any origin is allowed. If you restrict origins later, add your Render static site URLs.

- **Product images 404**  
  Set `API_BASE_URL` on the API to your live API URL (e.g. `https://pulacan-api.onrender.com`). Uploaded files are stored on the API’s filesystem; on free tier the disk is ephemeral, so consider moving uploads to object storage (e.g. S3) for production.

---

## Links

- [Render Dashboard](https://dashboard.render.com/)
- [Render Blueprint Spec](https://docs.render.com/blueprint-spec)
- [Render Postgres](https://render.com/docs/databases)
