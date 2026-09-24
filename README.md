# Stockroom

**Stockroom** is a small-shop inventory and reorder workspace for independent makers, online sellers, and neighborhood retailers who are ready to move beyond spreadsheets—but do not need a full ERP.

It is a researched pivot from the household-inventory concept in the original feature notes. The Reddit signals and the reasoning behind that choice are documented in [`docs/market-research.md`](docs/market-research.md).

## What’s in the app

- **Sign in and account creation** with server-side sessions, HTTP-only cookies, and password hashing.
- **Private workspaces:** products, purchase orders, and movement history are always scoped to the signed-in user.
- **At-a-glance dashboard:** stock value, units on hand, catalog size, low-stock watchlist, seven-day movement chart, recent changes, and weekly bestsellers.
- **Product CRUD:** name, SKU, category, supplier, location, quantity, unit cost, reorder point, lead time, weekly sales pace, and a color/emoji marker.
- **Stock adjustments:** record sales, deliveries, and count corrections; changes are logged in the activity history.
- **Restock workflow:** create and edit draft/placed purchase orders, update their status, and receive an order to automatically add those units to stock.
- **Useful details:** low-stock suggestions estimate a starting order quantity from the item's reorder point, weekly sales, and supplier lead time; export the catalog as CSV.
- **Polished responsive UI:** sidebar navigation, search, mobile layouts, empty and loading states, optimistic product/stock/order updates, confirmation dialogs, and toast feedback.
- **Seeded demo workspace:** realistic sample products, suppliers, open purchase orders, and recent stock movements.

## Run locally

Requirements: **Node.js 22.5+** (uses Node's built-in SQLite module).

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal. The web app uses the relative `/api` path; Vite proxies those requests to the Express API at port `4174`.

### Demo sign-in

Use **Explore the demo workspace** on the sign-in page, or sign in with:

- Email: `demo@stockroom.app`
- Password: `stockroom24`

Demo data lives in `.data/stockroom.sqlite` and survives server restarts. Demo workspaces are shared by anyone using the demo account, so use a newly created account for private testing. The sample account is intentionally disposable.

### Build and run the production bundle

```bash
npm run build
npm start
```

The Express server serves the compiled `dist/` frontend and the API. Set `PORT` if your host supplies a port. SQLite is stored in `.data/` by default; mount a **persistent writable volume** there (or set `DATA_DIR`) in a deployment, otherwise data can be lost when the host replaces its filesystem. To disable public demo sign-in, set `DISABLE_DEMO=true`.

See [`.env.example`](.env.example) for optional environment variables. For a public launch, add HTTPS, backups, operational monitoring, a production database/volume strategy, and a payment provider before accepting real customer data or subscriptions.

## Monetization and validation

A simple flat-price plan around **US$12 per shop per month** is a hypothesis to test with the Reddit-sampled seller segment, not a validated price or a promise of subscriber demand. This prototype does not collect payments. Interview sellers, observe their existing stock/reorder process, and secure a few paid design partners before investing in billing or channel integrations. If starting in Kenya, test KES pricing and local payment preferences first—the Reddit examples reviewed here do not establish local demand. See [`docs/market-research.md`](docs/market-research.md) for the Reddit threads, links, and caveats.

## Stack

- React 19 + Vite
- Express 5 JSON API
- SQLite via Node `node:sqlite`
- Lucide icons and custom responsive CSS
