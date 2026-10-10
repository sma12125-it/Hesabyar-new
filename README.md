# حساب‌یار

Personal accounting for the browser. **Rial only**, RTL Persian, Liquid Glass, IndexedDB.

**Live:** https://sma12125-it.github.io/Hesabyar-new/

**Repo:** https://github.com/sma12125-it/hesabyar-new

If that URL 404s, enable Pages once (repo admin): [Settings → Pages](https://github.com/sma12125-it/hesabyar-new/settings/pages) → **Deploy from a branch** → `gh-pages` / `/` (root) → Save. The production build is already on `gh-pages`.

## Polish sprint (post Sprint 2)

QA, performance, swipe edit/delete, and a bank-loan calculator. Budget / report / voice are still placeholders.

### Swipe map (physical screen, RTL trailing = left)

Swipe is a **gesture that fires the action** — not an iOS-Mail sticky reveal. Action buttons never stay open.

The app is `dir="rtl"`, but finger movement uses **physical screen** coordinates (`clientX` / `translateX` do not flip):

| Finger (physical) | Row motion | Peek (~200ms) | Action |
| --- | --- | --- | --- |
| **Right** (+dx) | slides right | Red **حذف** on the left | Delete, after confirm dialog |
| **Left** (−dx) | slides left | Teal **ویرایش** on the right | Opens the matching edit sheet |
| Short swipe (below ~72px) | snaps back | none | No action |
| Cancel / release early | snaps fully closed | none | No action |

During the swipe (and for ~150–300ms after a commit) the matching color/label peeks, then the row **always snaps fully closed**. There are no leftover tappable Edit/Delete buttons.

Applies to:

- Transactions (home, account detail, all-tx). Transfers edit/delete **both legs**.
- **Active** accounts (archived accounts stay archive/restore only).
- Installment plans (active / completed / archived).
- Installment items: unpaid → edit amount/due date; paid → edit the linked expense. Delete is allowed on both.

Hard delete is allowed. Archive remains a secondary ⋯-menu action.

### Delete cascade

- **Transaction:** removed. Transfer deletes both legs. An installment *payment* expense is unlinked: the item returns to unpaid and stays on the plan.
- **Paid installment item:** the linked expense **and** the slot are removed (payment reversed **and** that month leaves the schedule). Remaining items are reindexed `1…n`.
- **Unpaid installment item:** slot removed, reindexed.
- **Plan:** plan + items + all linked payment expenses.
- **Account:** account + its txs; counterpart transfer legs on other accounts; installment payments from this account are unpaid (items remain). Plans that used it as default are pointed at another active account when one exists.

### Loan formula (`src/lib/loan.ts`)

Declining-balance **equal installment** (قسط مساوی / مانده‌نزولی), not simple interest `P × r × years`.

- Monthly rate `i = annualPercent / 100 / 12`
- `A = P × i × (1+i)^n / ((1+i)^n − 1)` when `i > 0`, else `P / n`
- Payments are integer Rials. Months `1…n−1` use `round(A)` with `interest = round(remaining × i)`. The **last** payment is `remaining + last interest` so principal is fully amortized.
- Zero-rate loans split principal evenly; leftover Rials go on the last item.

Create-plan sheet: **قسط ثابت** (same as before) or **وام بانکی** (principal, annual %, months → auto-generated table + total interest / total repayment).

### Performance

What was slow: 70–110px `backdrop-filter` on **every** list row, plus infinite wallpaper `filter`/`transform` animations (continuous compositor work on mobile Chrome), plus a full IndexedDB `refresh()` of all collections after every mutation, plus the status-bar clock re-rendering the whole tree every 30s.

What changed:

- List rows use `.lg-row` (tinted fill, **no** backdrop-filter). Hero / tab / sheet keep moderate glass blur (≈28–44px).
- Wallpaper animations are **off** by default; `prefers-reduced-motion` also kills remaining motion.
- Mutations update React state immediately and persist a patch; no full reload on the happy path.
- Status bar clock is isolated; transaction/account rows are memoized.

### Other correctness fixes

- Expense (quick entry) cannot exceed the account balance — same rule as transfer / pay installment.
- Transfer notes are optional; empty notes get a direction-aware title (`انتقال به` / `انتقال از`).
- Ledger dates use `tx.date` (not insert time) and sort by date then `createdAt`.

## Sprint 2

- Transfer sheet: from / to (active accounts), amount, optional note, date. Hard-rejects amount above source balance (error banner + disabled CTA). Writes `transferOut` + `transferIn` atomically. Transfers are excluded from income/expense totals.
- Balance formula: `openingBalance + income − expense − transferOut + transferIn`
- Installments (اقساط): monthly plans and items, list badges (معوق / به‌زودی / به‌روز), create, detail table, pay as expense in category «اقساط», insufficient-balance error, edit (amount/count/dates locked after first payment), archive
- Home: 7-day upcoming and overdue installment hints
- Entry: Home quick action + account detail for transfer; اقساط tab + Home shortcut

## Sprint 1

- Home: total balance of active accounts, recent transactions, quick actions
- Quick entry sheet: expense / income, category, account, optional note
- Accounts: empty state, create (name required), cash/bank, opening balance, detail, archive/restore
- First visit loads a local demo dataset (right-click the bell on Home to reset or wipe)
- Reports and voice input remain placeholders

## Local development

```bash
npm install
npm test
npm run dev
```

Production build uses Vite `base: '/hesabyar/'` for GitHub Pages:

```bash
npm run build
npm run preview
```

The deploy workflow publishes `dist` to `gh-pages` and also copies the built `index.html` + `assets/` onto `main` so **Settings → Pages → Deploy from `main` / (root)** works.

## Architecture

- **Frontend:** Vite + React 19 + TypeScript (Hosted on GitHub Pages as static SPA)
- **Frontend Storage:** IndexedDB (`hesabyar` database) for 100% offline-first functionality, optional client-side sync to Supabase
- **Backend Service:** Node.js Express server running REST API (`/api/v1`) and Model Context Protocol (`/mcp`)
- **Backend Persistence:** Supabase PostgreSQL (`snapshots` table) isolated per-user with Supabase Auth & Row Level Security
- **MCP Gateway:** Streamable HTTP / SSE transport on `/mcp` connecting AI models (ChatGPT, Claude, custom agents) directly to HesabYar REST API & business logic

---

## Backend & MCP Server Deployment Guide

### Why GitHub Pages Cannot Run the Backend
GitHub Pages is a static file hosting service. It does not execute Node.js runtimes, run server background processes, or maintain open HTTP/SSE connections. Therefore, the Node.js backend (Express REST API and `/mcp` server) must be hosted on an HTTPS-enabled Node.js service (e.g., Render, Railway, Fly.io, Cloud Run, or a VPS).

The existing frontend continues to run on GitHub Pages without any changes or breaking offline capabilities.

### Deployment Architecture (Single Service)
> 📘 **Render Quickstart:** For step-by-step instructions specifically for Render, see [Render Deployment Guide](docs/render-deployment.md).

The Express server, REST API (`/api/v1`), and MCP server (`/mcp`) run together as **one unified Node.js process** via `server.ts`.

```
ChatGPT / MCP Clients ──(HTTPS POST/SSE)──┐
                                          │
GitHub Pages Frontend ──(HTTPS REST)─────┼──>  [ HesabYar Node.js Server ]
                                          │           ├── /health
                                          │           ├── /api/v1/* (REST API)
                                          │           └── /mcp (MCP Server)
                                          │                     │
                                          └─────────────> [ Supabase Cloud ]
                                                          (Auth + Snapshots DB)
```

### Build and Start Commands
- **Install dependencies:**
  ```bash
  npm install
  ```
- **Run test suite:**
  ```bash
  npm test
  ```
- **Build production frontend:**
  ```bash
  npm run build
  ```
- **Start production server:**
  ```bash
  npm start
  ```
  *(Executes `tsx server.ts` binding to `0.0.0.0:${PORT}`)*

### Required Environment Variables

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional (default: 3000) | Port for the HTTP/MCP server | `3000` or `8080` |
| `NODE_ENV` | Recommended | Application environment mode | `production` |
| `SUPABASE_URL` | **Required** (for cloud sync) | Supabase project URL | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | **Required** (for cloud sync) | Supabase public/anon API key | `sb_publishable_...` |
| `HESABYAR_API_URL` | Optional | Internal API URL used by MCP gateway | Auto-derives `http://127.0.0.1:${PORT}/api/v1` |
| `ALLOW_DEV_TOKENS` | Optional | Development token bypass flag (**never** in prod) | `false` |

### Service Endpoints

- **Root Health Check:** `GET /health`
- **REST API Health Check:** `GET /api/v1/health`
- **OpenAPI 3.1 Spec:** `GET /api/v1/openapi.json`
- **Interactive REST API Docs:** `GET /api/v1/docs`
- **MCP Server Health Check:** `GET /mcp/health`
- **MCP Server Endpoint:** `POST /mcp` (Streamable HTTP / SSE)

### Post-Deployment Verification Steps

Replace `https://api.yourdomain.com` with your deployed backend URL:

1. **Verify Root Health:**
   ```bash
   curl -s -i https://api.yourdomain.com/health
   # Expected: HTTP 200 OK with JSON status: "ok"
   ```

2. **Verify MCP Health & Registered Tools:**
   ```bash
   curl -s -i https://api.yourdomain.com/mcp/health
   # Expected: HTTP 200 OK with "mcp": "HesabYar MCP Server", toolsCount: 30+
   ```

3. **Verify Security (Unauthorized Request Rejection):**
   ```bash
   curl -s -i https://api.yourdomain.com/api/v1/accounts
   # Expected: HTTP 401 Unauthorized (No anonymous access to financial records)
   ```

4. **Verify MCP Session Initialization:**
   ```bash
   curl -s -X POST https://api.yourdomain.com/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}},"id":1}'
   # Expected: HTTP 200 OK with JSON-RPC initialize response
   ```

