# حساب‌یار

Personal accounting for the browser. **Rial only**, RTL Persian, Liquid Glass, IndexedDB.

**Live:** https://sma12125-it.github.io/hesabyar/

**Repo:** https://github.com/sma12125-it/hesabyar

If that URL 404s, enable Pages once (repo admin): [Settings → Pages](https://github.com/sma12125-it/hesabyar/settings/pages) → **Deploy from a branch** → `gh-pages` / `/` (root) → Save. The production build is already on `gh-pages`.

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

- Vite + React + TypeScript
- Persistence: IndexedDB (`hesabyar` database) — no server
- Visual system: `src/styles/tokens.css` + `src/styles/glass-v2.css` (Liquid Glass; row blur reduced for mobile)
- GitHub Pages deploy: `.github/workflows/deploy.yml` publishes `dist` from `main`
