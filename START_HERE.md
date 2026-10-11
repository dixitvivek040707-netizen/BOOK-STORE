# Start Enginuity Books (Windows - simple steps)

## First-time setup
1. Install **Node.js 18 or newer** from https://nodejs.org/.
2. Extract the downloaded ZIP. Open the folder named `enginuity-bookstore` (the folder containing `package.json`).
3. Double-click **`RUN_BACKEND.bat`**.
4. Keep the black terminal window open. Open Chrome and visit **http://localhost:3000**.
5. Test the backend at **http://localhost:3000/api/health**. It should show `{"status":"ok",...}`.

## Start it next time
Double-click `RUN_BACKEND.bat` again. No `npm install` is required; the project uses Node.js built-in modules only.

## Run from VS Code instead
1. Open the folder that contains `package.json`.
2. Select **Terminal → New Terminal**.
3. Run `npm start`.
4. Visit http://localhost:3000.

## Optional: enable protected admin API
The admin API is disabled unless `ADMIN_PASSWORD` is set to a unique password at least 14 characters long. In PowerShell, run this in the project folder before starting the server:

```powershell
$env:ADMIN_PASSWORD = "use-a-unique-password-of-14-or-more-characters"
npm start
```

Keep the password private. The admin API has no visual dashboard yet. After starting the server, sign in with `POST /api/admin/login` using JSON `{"password":"your-password"}`. The server sets an HttpOnly, SameSite=Strict session cookie. Use the authenticated cookie for `GET /api/admin/orders` and `POST /api/admin/logout`. Do not expose this prototype to the public internet as-is.

## Security check
Run `npm run security-check` in the project folder. This checks important local configuration and source patterns. It is a helpful checklist, not a guarantee that the site is secure or a substitute for a professional penetration test.

## Important limits
This is a local prototype, not production-ready commerce. JSON file storage is not suitable for concurrent production traffic, no payment processor is connected, and there is no complete admin UI, inventory workflow, backup system, or professional security review. Before public launch, use managed database storage, HTTPS behind a properly configured reverse proxy, production-grade sessions/rate limiting, backups, payment integration, and reviewed legal policies. Set `NODE_ENV=production` only when HTTPS is configured; HSTS and Secure cookies depend on that setting.


## Order tracking and delivery location

- Customers can use **Track order** on the homepage. They must enter the order ID shown after checkout and the same email address used to place the order.
- The tracking page shows the latest order status recorded by the store. It does **not** show a live courier GPS position.
- At checkout, **Share delivery location** is optional. The browser asks permission first. If accepted, approximate GPS coordinates are stored with the order and can be viewed only through the authenticated admin orders API. Customers can still order without sharing location.
- Browser geolocation requires `localhost` or HTTPS on a deployed website.
- An authenticated administrator can update an order status with `POST /api/admin/orders/status` using JSON such as `{"orderId":"ENG-...","status":"Shipped"}`. Allowed statuses: `Received`, `Confirmed`, `Packed`, `Shipped`, `Out for delivery`, `Delivered`, `Cancelled`.

## New bookstore discovery features
- The homepage now has subject shortcuts and a value-picks shelf.
- Book cards show calculated savings and have a wishlist heart (saved in this browser).
- The Study Note email signup saves subscriptions in `data/store.json` through the backend.
- See `FEATURES.md` for the complete feature list and what still needs a production integration.
