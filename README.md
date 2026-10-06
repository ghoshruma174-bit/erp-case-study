# Industrial ERP / Sales Workflow

A small, relational sales and inventory ERP case study. The main business process is:

**Customer Enquiry → Quotation → Accepted Quotation → Sales Order → Inventory Reservation → Dispatch**

The backend owns validation, quotation calculations, role authorization, and stock changes. PostgreSQL constraints and transactions protect the business records; the React app is a simple interface to those APIs.

## Technology

- React 19 and Vite
- Node.js 20 or newer
- Express 5 REST API
- PostgreSQL 14 or newer (developed and verified with PostgreSQL 18)
- Prisma 6 ORM and migrations
- JWT authentication
- bcryptjs password hashing
- Node's built-in test runner for database-backed integration tests

No separate `pg` package is required for Prisma.

## Requirements

- Node.js 20+
- npm
- PostgreSQL 14+

## Project layout

```text
erp-case-study/
  backend/
    prisma/
      migrations/
      schema.prisma
      seed.js
    src/
      config/
      controllers/
      middleware/
      routes/
      services/
      utils/
      app.js
    tests/
    .env.example
    package.json
    prisma.config.ts
    server.js
  frontend/
    src/
      components/
      context/
      pages/
      services/
      App.jsx
      main.jsx
    .env.example
    package.json
  README.md
```

## PostgreSQL setup

Create two project-specific databases: `erp_case_study` for application data and `erp_case_study_shadow` for Prisma development migration checks. The shadow database is separate from the application database; Prisma uses it to compare schema changes. Neither database setup nor migration commands delete unrelated databases.

For a local PostgreSQL installation where you can connect as `postgres`, create a dedicated login role and both databases. Choose a password locally and use that same password in the backend environment file:

```sql
CREATE ROLE erp_app LOGIN PASSWORD 'choose-a-local-password';
CREATE DATABASE erp_case_study OWNER erp_app ENCODING 'UTF8';
CREATE DATABASE erp_case_study_shadow OWNER erp_app ENCODING 'UTF8';
```

If those project resources already exist, do not create them again; use the existing role and databases. The example connection URL shape is:

```text
postgresql://erp_app:YOUR_LOCAL_PASSWORD@localhost:5432/erp_case_study?schema=public
```

## Environment variables

Create the backend's private environment file from the example:

```powershell
Set-Location .\backend
Copy-Item .env.example .env
```

Edit `backend/.env` and set the actual local database role password in both URLs. Replace the development JWT secret with a long random value. Do not share or commit this file.

```env
PORT=5050
DATABASE_URL="postgresql://erp_app:YOUR_LOCAL_PASSWORD@localhost:5432/erp_case_study?schema=public"
SHADOW_DATABASE_URL="postgresql://erp_app:YOUR_LOCAL_PASSWORD@localhost:5432/erp_case_study_shadow?schema=public"
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_URL=http://localhost:5173
```

`backend/.env.example` contains placeholders only. The frontend defaults to `http://localhost:5050/api`; to override it, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL`.

## Backend setup and run

From PowerShell:

```powershell
Set-Location .\backend
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

The backend listens on `http://localhost:5050` and verifies its PostgreSQL connection before it starts accepting requests. Check it at `http://localhost:5050/api/health`.

For subsequent runs, use `npm run dev`. After changing `prisma/schema.prisma`, create a named migration with:

```powershell
npm run db:migrate -- --name describe-your-change
```

The Prisma client can be regenerated with `npm run db:generate`; demo data can be safely re-seeded with `npm run db:seed`. The seed uses bcrypt hashes and upserts users/products without resetting already-existing stock quantities.

## Frontend setup and run

In a second PowerShell window:

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Open `http://localhost:5173`. To create a production bundle, run `npm run build` from the frontend directory.

## Demo accounts

The seed creates these development-only users:

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@example.com` | `Admin@123` |
| SALES_USER | `sales@example.com` | `Sales@123` |

Passwords are stored as bcrypt hashes. Change these demo credentials before using the application outside local evaluation.

## Five-minute demo

1. Sign in as `sales@example.com`.
2. Create a customer and a multi-product enquiry.
3. Create a draft quotation, mark it sent, then accept it.
4. Convert the accepted quotation to a Sales Order.
5. Sign out and sign in as `admin@example.com`.
6. Open Sales Orders and confirm the order; stock becomes reserved while physical stock stays unchanged.
7. Enter vehicle and driver details and dispatch the order.
8. Confirm the order is `DISPATCHED`; physical and reserved stock have both decreased by the dispatched quantity.

## API overview

All APIs except `GET /api/health` and `POST /api/auth/login` require:

```text
Authorization: Bearer <JWT>
```

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/login` | Public | Authenticate and receive a JWT |
| GET | `/api/auth/me` | Authenticated | Return the current user's id, email, and role |
| GET | `/api/products` | Authenticated | List product master data and available stock |
| GET | `/api/inventory` | Authenticated | List physical, reserved, and derived available quantities |
| PATCH | `/api/inventory/:productId` | ADMIN | Adjust physical stock without changing reserved stock |
| GET | `/api/customers` | Authenticated | List customers |
| POST | `/api/customers` | SALES_USER | Create a customer |
| GET | `/api/enquiries` | Authenticated | List enquiries with customer and product lines |
| POST | `/api/enquiries` | SALES_USER | Create a customer enquiry |
| PATCH | `/api/enquiries/:id/status` | SALES_USER | Mark an enquiry WON or LOST |
| GET | `/api/quotations` | Authenticated | List quotations with line amounts and totals |
| POST | `/api/quotations` | SALES_USER | Create a quotation; amounts are calculated by the backend |
| PATCH | `/api/quotations/:id/status` | SALES_USER | Move DRAFT → SENT → ACCEPTED or REJECTED |
| POST | `/api/quotations/:id/convert` | SALES_USER | Convert an ACCEPTED quotation to one Sales Order |
| GET | `/api/sales-orders` | Authenticated | List Sales Orders with item and inventory details |
| POST | `/api/sales-orders/:id/confirm` | ADMIN | Reserve all order stock and confirm the order |
| POST | `/api/sales-orders/:id/dispatch` | ADMIN | Dispatch a confirmed order and deduct its stock |

Request validation and business errors return JSON with a `message`, for example:

```json
{ "message": "Insufficient inventory for 5 HP Three-Phase Induction Motor: 1 available, 2 requested" }
```

## Important business and database rules

- `Customer`, `Enquiry`, `EnquiryItem`, `Quotation`, `QuotationItem`, `SalesOrder`, `SalesOrderItem`, `Dispatch`, and `DispatchItem` are relational tables connected by foreign keys; workflow records are not stored as JSON.
- A quotation belongs to the same customer as its enquiry. A unique quotation reference on `SalesOrder` prevents duplicate conversion.
- Only ACCEPTED quotations can be converted. Status transitions are checked by the backend.
- Quotation amounts use PostgreSQL `Decimal` columns and are calculated server-side. For each line, the backend calculates quantity × unit price, applies discount, adds GST to the discounted amount, rounds the final line to two decimal places, then sums the lines. The default GST when omitted is 18%; the current frontend sends 18% explicitly.
- `availableQuantity` is never stored. It is always computed as `physicalQuantity - reservedQuantity`.
- Inventory rows have PostgreSQL check constraints preventing negative quantities and reserved stock above physical stock. Product and transaction line quantities, percentages, and money values are also constrained.
- Admin confirmation locks the Sales Order row and then locks its inventory rows in product-id order using PostgreSQL `SELECT ... FOR UPDATE` inside a Prisma transaction. After a lock is acquired, the service checks current available stock, increments reserved quantities, and changes the order status in that same transaction. If any item fails, PostgreSQL rolls back all changes. Concurrent confirmations for the same product therefore serialize: a second request sees the first reservation and cannot reserve beyond remaining stock.
- Reserving does not change physical stock. Dispatch locks the order and stock rows, requires a CONFIRMED order and enough reserved quantity, then decreases physical and reserved quantities and records the dispatch in one transaction.
- A dispatch is for the full confirmed order and can be recorded only once. Cancelled and already-dispatched orders are rejected.
- Role checks run in backend middleware; hiding buttons in React is only a usability measure, not an authorization control.
- JWTs expire after eight hours. The frontend keeps the token in `sessionStorage` for the browser session; a production deployment should consider secure, HttpOnly cookies and HTTPS.

## ER diagram

```mermaid
erDiagram
    User {
        string id PK
        string email UK
        string role
    }
    Customer ||--o{ Enquiry : raises
    Customer ||--o{ Quotation : receives
    Customer ||--o{ SalesOrder : places
    Enquiry ||--o{ EnquiryItem : contains
    Product ||--o{ EnquiryItem : requested
    Enquiry ||--o{ Quotation : quoted
    Quotation ||--o{ QuotationItem : contains
    Product ||--o{ QuotationItem : quoted
    Product ||--o| Inventory : stocked_as
    Quotation ||--o| SalesOrder : converts_to
    SalesOrder ||--o{ SalesOrderItem : contains
    Product ||--o{ SalesOrderItem : ordered
    SalesOrder ||--o| Dispatch : dispatched_by
    Dispatch ||--o{ DispatchItem : contains
    Product ||--o{ DispatchItem : shipped
```

`User` is currently standalone because records are not yet attributed to their creator. It contains the unique email, bcrypt password hash, and role needed by authentication and RBAC.

## Tests

Run database-backed integration tests from the backend folder:

```powershell
Set-Location .\backend
npm test
```

Tests require the local PostgreSQL databases to be migrated and seeded. They start an ephemeral HTTP server, create uniquely named test records, exercise the live REST endpoints and database transactions, and clean up their fixtures. The suite covers:

- Admin and sales login, wrong password, missing/invalid JWT, and `/api/auth/me`.
- Multi-product enquiries and backend-calculated quotation totals.
- Draft/rejected conversion rejection and duplicate order prevention.
- Admin-only reservation, insufficient-stock rollback, and duplicate confirmation.
- Concurrent reservations (80 and 50 against 100 available); exactly one succeeds.
- Reserved/physical quantity consistency through dispatch, overship rejection, cancelled-order rejection, and duplicate dispatch prevention.
- Existing API reads and role restrictions.

The frontend production build can be checked with `npm run build` in `frontend`.
