# Inventory Management System – API Documentation

Base URL (local): `http://localhost:3001/api`

All protected endpoints require header: `Authorization: Bearer <token>`.

---

## Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Login. Body: `{ email, password }`. Returns `{ token, user }`. |
| POST | /auth/register | Register (customer). Body: `{ email, password, fullName }`. |
| GET | /auth/me | Current user (requires auth). |

---

## Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /products?page=&limit=&search= | No | List products (paginated). |
| GET | /products/:id | No | Get one product. |
| POST | /products | Owner/Admin | Create product. Body: name, sku?, description?, unitPrice, initialQuantity?, lowStockThreshold?. |
| PATCH | /products/:id | Owner/Admin | Update product. |
| DELETE | /products/:id | Owner/Admin | Delete product. |

---

## Inventory

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /inventory?page=&limit=&lowStock= | Owner/Admin | List inventory (optional lowStock=true). |
| GET | /inventory/low-stock | Owner/Admin | Low stock items only. |
| PATCH | /inventory/:productId | Owner/Admin | Update quantity or lowStockThreshold. |

---

## POS

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /pos/transaction | Owner/Cashier | Create sale. Body: `{ items: [{ productId, quantity }] }`. Deducts stock. |

---

## Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /orders | Customer | Place order (status PENDING_APPROVAL). Body: `{ items: [{ productId, quantity }] }`. |
| GET | /orders?page=&limit=&status= | User | List orders (customer: own; cashier/owner: all). |
| GET | /orders/pending | Cashier/Owner | Pending orders only. |
| GET | /orders/:id | User | Order detail. |
| PATCH | /orders/:id/approve | Cashier/Owner | Approve or reject. Body: `{ action: "approve" \| "reject" }`. |

---

## Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /reports/sales?startDate=&endDate= | Owner/Admin | Sales list + summary. |
| GET | /reports/inventory | Owner/Admin | Inventory + low stock count. |
| GET | /reports/best-selling?startDate=&endDate= | Owner/Admin | Best selling products. |
| GET | /reports/revenue-trends?startDate=&endDate= | Owner/Admin | Revenue by day. |

---

## AI

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /ai/predict | Owner/Admin | Generate demand predictions. |
| GET | /ai/predictions | Owner/Admin | Latest predictions. |
| POST | /ai/chat | User | Chatbot. Body: `{ message }`. Returns `{ reply }`. |

---

## Config

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /config | Owner/Admin | All config key-value. |
| PUT | /config | Owner/Admin | Update. Body: `{ LOW_STOCK_THRESHOLD: "10", ... }`. |

---

## Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /users?page=&limit=&search= | Owner/Admin | List users. |
| GET | /users/:id | Owner/Admin | Get user. |
| PATCH | /users/:id | Owner/Admin | Update fullName, isActive, roleName, password?. |

---

## Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /notifications?page=&limit=&unread= | User | List notifications. |
| PATCH | /notifications/:id/read | User | Mark read. |
| PATCH | /notifications/read-all | User | Mark all read. |

---

## Errors

Responses use status codes and JSON: `{ error: "message", code?: "..." }`.

- 400 Validation / bad request  
- 401 Unauthorized (missing or invalid token)  
- 403 Forbidden (role)  
- 404 Not found  
- 429 Too many requests (rate limit)  
- 500 Server error  
