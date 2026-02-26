# Connecting This Project to Supabase

This guide walks you through using **Supabase** as the database so you can **run the app locally** (on your machine) while the data lives in Supabase.

---

## Run locally with Supabase (summary)

1. Create a Supabase project and get the **Session pooler** connection string (see below).
2. In `backend/.env`, set `DATABASE_URL` to that string (with your real password and `?sslmode=require`).
3. From `backend/` run: `npx prisma generate` → `npx prisma db push` → `npm run db:seed`.
4. Start the backend: `npm run dev`. Your local API will use the Supabase database.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in or sign up.
2. Click **New project**.
3. Choose your **organization**, set a **project name** (e.g. `pulucan`), set a **database password** (save it somewhere safe), and pick a **region**.
4. Click **Create new project** and wait until the project is ready.

---

## 2. Get the database connection string (for local run)

Your app runs on your PC (IPv4), so use the **Session pooler** URL, not the Direct connection.

1. In the Supabase dashboard, open your project (**pulacan-inventory-system**).
2. Click **Connect** (top bar) or go to **Project Settings** (gear) → **Database**.
3. Find **Connection string** and set the dropdown to **URI**.
4. Change the **connection type** dropdown from **Direct connection** to **Session** (pooler, port 5432). The URI in the box will change to a `…pooler.supabase.com` address.
5. Copy that full URI. Replace `[YOUR-PASSWORD]` with your **database password** (the one you set when creating the project, or reset in Database Settings).
6. If the URI does not already end with `?sslmode=require`, add it.

Example format:
```txt
postgresql://postgres.XXXXXXXX:[YOUR-PASSWORD]@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require
```

**Alternative – direct connection:**

- In **Connection string**, switch to **Session mode** or use the **Direct connection** string (port **5432**).
- Use this URL when running `prisma migrate deploy` or `prisma db push` if the pooler URL gives connection issues.

---

## 3. Configure the backend

1. Open the backend folder:
   ```bash
   cd backend
   ```
2. Create or edit the `.env` file and set `DATABASE_URL` to your Supabase connection string:
   ```env
   DATABASE_URL="postgresql://postgres.[project-ref]:YOUR_PASSWORD@aws-0-xx.pooler.supabase.com:6543/postgres?pgbouncer=true"
   ```
   Use your real password and the exact URL from Supabase (with or without `?pgbouncer=true` as shown in the dashboard).

3. **Optional:** Keep a separate `.env.local` or use different env files for local vs production so you can switch between SQLite (local) and Supabase (production) by changing `DATABASE_URL`.

---

## 4. Run migrations and seed (first time)

1. **Generate the Prisma client:**
   ```bash
   npm run prisma:generate
   ```
   or:
   ```bash
   npx prisma generate
   ```

2. **Push the schema to Supabase** (creates/updates tables):
   ```bash
   npx prisma db push
   ```
   Or, if you use migrations:
   ```bash
   npx prisma migrate deploy
   ```
   (If you don’t have migrations yet, run `npx prisma migrate dev --name init` once locally to create them, then use `migrate deploy` for Supabase.)

3. **Seed the database** (roles, sample users, products, etc.):
   ```bash
   npm run db:seed
   ```
   or:
   ```bash
   npx tsx prisma/seed.ts
   ```

---

## 5. Run the backend

```bash
npm run dev
```

The API will use the Supabase PostgreSQL database. Your frontend and customer app should keep using the same API URL; only `DATABASE_URL` in the backend changes.

---

## 6. (Optional) Use Supabase for other features

- **Auth:** You can later replace or complement your current JWT auth with [Supabase Auth](https://supabase.com/docs/guides/auth).
- **Storage:** Use [Supabase Storage](https://supabase.com/docs/guides/storage) for product images instead of (or in addition to) `imageUrl` links.
- **Realtime:** Use [Supabase Realtime](https://supabase.com/docs/guides/realtime) for live updates (e.g. orders, notifications).

For now, only the **database** is connected; auth and app logic stay in your Express backend.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| **Can't reach database server** | 1) In Supabase dashboard, check if the project is **paused** (free tier) and click **Restore project**. 2) Copy the **exact** connection string again from Project Settings → Database → **Connection string** → **URI**. 3) Use **Session mode** (port 5432) or **Direct** from the dropdown and paste into `DATABASE_URL`. |
| **Tenant or user not found** | You’re likely using the **pooler** URL with the wrong user. Use the string from the dashboard as-is (it uses `postgres.[project-ref]` for pooler). Or use the **Direct** connection (host `db.xxx.supabase.co`, user `postgres`) for migrations. |
| **Connection timeout / refused** | Use the **Direct** connection string (host `db.xxx.supabase.co:5432`) for migrations; ensure your IP is allowed under Database → Settings if you have restrictions. |
| **SSL required** | Add `?sslmode=require` to the end of `DATABASE_URL` if your URL doesn’t already include it. |
| **Password with special characters** | URL-encode the password in `DATABASE_URL` (e.g. `#` → `%23`). |
| **`prisma migrate` errors** | Run `npx prisma db push` first to sync the schema, or create a fresh migration with `npx prisma migrate dev --name init` and then use `migrate deploy` on Supabase. |

**Get the correct URL:** In Supabase go to **Project Settings** (gear) → **Database** → **Connection string** → choose **URI**, then pick **Session** (pooler, port 5432) or **Direct** (port 5432). Paste into `.env` as `DATABASE_URL` and add `?sslmode=require` if needed.

**If "Pooler settings" closes the modal:** In the **Connect** / Connection string area, look for a **dropdown** (e.g. "Method" or "Connection type") that currently says "Direct connection". Change it to **"Session"** or **"Transaction"**. The URI in the box will update to the pooler URL — copy that full string (replace `[YOUR-PASSWORD]` with your database password) into `DATABASE_URL`. Do not click "Pooler settings"; use only the dropdown.

**If you see "Tenant or user not found":** The project ref or region in the URL is wrong. 1) In the Supabase dashboard, check the browser URL: `.../project/XXXXXXXX` — that `XXXXXXXX` is your exact project ref (use it in the username as `postgres.XXXXXXXX`). 2) In **Project Settings** → **General**, note your **Region** (e.g. "Southeast Asia (Singapore)" → use `ap-southeast-1` in the host; "East US" → `us-east-1`). 3) Reset your database password in **Database Settings** and use the new password in the URI (no special characters to avoid encoding issues).
