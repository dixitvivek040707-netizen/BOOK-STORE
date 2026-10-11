# Enginuity Books

A responsive engineering textbook storefront with a custom editorial design, CSS 3D book covers, animated interactions, and a persistent Node.js backend. It uses only Node.js built-in modules, so there are no npm dependencies.

## Features

- Catalogue with 16 sample textbooks across common first-year subjects, CSE/IT, ECE, Electrical, Mechanical and Civil.
- Server-side search, branch filtering, year filtering and sorting.
- Responsive layout, CSS 3D book artwork, hover movement and reduced-motion support.
- Shopping bag with quantity controls and browser-local persistence.
- Checkout form with server-side validation and order totals calculated from trusted catalogue prices.
- `POST /api/orders` persists orders in `data/store.json`; `GET /api/orders?email=...` retrieves order IDs and details for that email.
- Custom favicon, privacy policy and terms and conditions starter pages.
- Health endpoint at `/api/health`.

## Run locally (Windows)

Requires Node.js 18 or newer. For the simplest setup, double-click `RUN_BACKEND.bat`, keep its terminal window open, and open <http://localhost:3000>. The backend health check is <http://localhost:3000/api/health>.

Alternatively, open this folder (the one containing `package.json`) in VS Code, open Terminal → New Terminal, and run:

```bash
npm start
```

No `npm install` is needed because this project uses Node.js built-in modules only. See `START_HERE.md` for step-by-step setup and the optional admin login setup.

## Security improvements in this prototype

- Security headers including Content Security Policy, frame protection, MIME-sniffing protection and Referrer Policy.
- No wildcard CORS; cross-origin browser POSTs are rejected.
- JSON request body size limits, input length/type checks and server-side price/quantity validation.
- Basic per-IP rate limits for catalogue, checkout and admin login.
- Optional admin API guarded by a strong `ADMIN_PASSWORD` environment variable and an HttpOnly, SameSite=Strict session cookie.
- Order records are not exposed through the former public email-only lookup endpoint; admin order listing requires an authenticated session.
- `.gitignore` excludes `.env` and log files. Never place API keys or real passwords in client-side JavaScript.
- Run `npm run security-check` for a lightweight local configuration checklist.

These protections are useful for local development, but the rate limiter and sessions are in-memory and are not production-grade. The security checklist is not a penetration test. Do not expose this demo to the public internet or use it to store real customer information without a proper security review and production infrastructure.

## API examples

```bash
curl http://localhost:3000/api/health
curl 'http://localhost:3000/api/books?q=physics&branch=All%20branches'
curl -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customer":{"name":"Sample Student","email":"student@example.com","address":"Hostel, Jaipur, 302001"},"items":[{"id":"b102","quantity":1}]}'
curl 'http://localhost:3000/api/orders?email=student@example.com'
```

## Before production launch

This is a functional prototype, not a production commerce platform. It does not process payments, calculate shipping/tax, manage inventory, authenticate administrators, or send emails. The JSON file is suitable for local demos only; on most serverless hosts, local disk may be ephemeral. Use a managed database (such as PostgreSQL), proper authentication and authorization, rate limiting, HTTPS, backups, payment-provider integration, email delivery, logging, and legally reviewed policies before taking real orders. Connect your own domain and hosting account, then verify all links, metadata, policies, pricing, and fulfilment details. The contact email on the storefront is intentionally a placeholder.

## Data file

Catalogue and order data are stored in `data/store.json`. Back up this file if you use the demo for testing.


## Order tracking and delivery location

- Customers can use **Track order** on the homepage. They must enter the order ID shown after checkout and the same email address used to place the order.
- The tracking page shows the latest order status recorded by the store. It does **not** show a live courier GPS position.
- At checkout, **Share delivery location** is optional. The browser asks permission first. If accepted, approximate GPS coordinates are stored with the order and can be viewed only through the authenticated admin orders API. Customers can still order without sharing location.
- Browser geolocation requires `localhost` or HTTPS on a deployed website.
- An authenticated administrator can update an order status with `POST /api/admin/orders/status` using JSON such as `{"orderId":"ENG-...","status":"Shipped"}`. Allowed statuses: `Received`, `Confirmed`, `Packed`, `Shipped`, `Out for delivery`, `Delivered`, `Cancelled`.
