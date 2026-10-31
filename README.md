# Kasho Pay Admin

The administration site of Kasho Pay. It is a **separate site** (own repository, own domain, own login with 2FA), not a page of the customer app.
It shows what Freda holds and charges, the profit and loss, the fees, the customers and everything administrators did.

```
 admin site (this repo)  ──►  kasho-pay-backend (Render)  ──►  Supabase + Freda Pay Issuing
 admin.kashopay.com           one API, one database              (same project as the Kasho Pay app)
```

The money logic and the database stay in one place (the backend). This site is only the screens: it holds no secret key, and the backend
refuses every admin request that does not come from this site's origin (`ADMIN_ORIGINS`).

## What it does
| Tab | |
| --- | --- |
| Overview | Master Wallet and Gateway balances read from Freda, profit and loss (our fees, Freda's share, net profit, margin), day chart, per-operation table, "do we hold enough?", customer numbers |
| Fees | margin analysis (what we charge against what Freda charges), the customer fee schedule, Freda's price plans |
| Customers | search, details, **add / remove money** (reason + password + 2FA), suspend / reactivate |
| Transactions, Support | everything that moved, disputes and support messages |
| Audit log | what every administrator did (nobody can edit or delete it) |
| My account | change the password |

Made for a computer first: a fixed menu on the left, a wide work area that uses large screens (up to 4K), and the page open in the address (`#fees`) so the Back button, a refresh and a shared link all work; the browser tab shows the page name. On a tablet or phone the menu becomes a drawer behind the Menu button and the tables scroll sideways inside their own box.

English and French (switch in the menu, or at the top right on a phone; `?i18n-debug=1` lists untranslated texts in the console).
Roles: a `super` administrator can do everything; an `admin` can read everything and manage the customer fee schedule.

## Run it locally
```bash
cp .env.example .env.local     # Supabase URL + publishable key (same as the Kasho Pay app) and the backend URL
npm install
npm run dev                    # http://localhost:5174
```
On the backend set `ADMIN_ORIGINS=http://localhost:5174` (or leave it empty in development: the tools are then open to any origin).

## Deploy (Cloudflare)
1. Cloudflare dashboard > Workers & Pages > Create > import this repository.
2. Build command `npm run build`, deploy command `npx wrangler deploy` (`wrangler.jsonc` publishes `dist/` as a single-page app). Keep the Worker name `admin-page-kasho-pay` (the one in `wrangler.jsonc`): a different name in the dashboard makes the build fail.
3. **Build variables** (Settings > Build > Variables and secrets: the build section, not the "Variables and secrets" of the runtime, which is greyed out for a static site: that is normal). Add all three, with exactly these names:
   - `VITE_SUPABASE_URL`: the Supabase project URL, `https://<project>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: the publishable (anon) key, never the service role key
   - `VITE_API_URL`: the backend URL, `https://...` (for example the Render address)

   The values are baked into the page when it is **built**: after adding or changing one, start a new build (Deployments > the build > Retry build, or push a commit). If one is missing the site says so on its first screen.
4. Settings > Domains: add the domain, for example `admin.kashopay.com`.
5. On Render (backend) set `ADMIN_ORIGINS=https://admin.kashopay.com` (no trailing slash) and redeploy. Without it the admin tools are off in production.
6. If the backend has its own domain (not `*.onrender.com`), add it to `connect-src` in `public/_headers` before building.

Any other static host works too: publish `dist/`, answer every path with `index.html`, and send the headers of `public/_headers`.

## First sign-in
1. Supabase SQL editor: run `20261101000000_admin_panel.sql` (backend repo, `supabase/migrations`), then create the super administrator account (backend `OPERATIONS.md`, section 8).
2. Open the site and sign in. The first time it asks to **set up 2FA**: scan the QR code with an authenticator app and enter the first code. From then on every sign-in asks for the code. Do this right away.
3. My account > change the password.

## Security
- **Own origin**: the session lives on this site's origin, so nothing running in the customer app can read it. The backend answers admin requests only to `ADMIN_ORIGINS`, and this site can only call the admin tools and `changePassword`.
- **Who gets in**: a Supabase account that is listed in the backend `admins` table, has a verified 2FA factor and has passed the code. The site only follows what the backend says (`adminStatus`); a customer account is signed out at once.
- **Session**: kept in `sessionStorage` (closing the tab or the browser signs out), and signed out after 20 minutes without a click, key press or scroll (also after a laptop sleeps).
- **Sensitive actions** (money, suspending, fees, prices, password) ask for the password again; every change is in the audit log.
- **Hosting**: strict headers in `public/_headers` (no inline or third-party scripts, no framing, `no-store`, `noindex`), system fonts, no analytics, no third-party requests.

## Project layout
```
src/App.tsx            login / 2FA / dashboard gate (lib/gate.ts), idle sign-out (lib/idle.ts)
src/pages/             login, 2FA setup and code screens, dashboard (left menu on a computer, drawer on a phone)
src/components/admin/  one file per tab
src/lib/api.ts         backend client (Bearer token) and the types of its answers
src/lib/i18n/          English / French runtime and dictionary
public/_headers        security headers          wrangler.jsonc   Cloudflare settings
```

## Checks
```bash
npm run typecheck      # TypeScript
npm test               # dictionary and security-header checks
npm run build          # type check + production build into dist/
```

## If something does not work
- *"This site is not configured yet. The build is missing: ..."*: the screen names the variables the build did not get. Add them as build variables (exact names, `VITE_API_URL` must start with `https://`) and build again.
- *"Cannot reach the Kasho server at ..."*: the browser could not talk to that address: wrong `VITE_API_URL`, the backend is asleep, the backend does not allow this site (`ADMIN_ORIGINS` or `CORS_ORIGIN` on the server), or its domain is missing from `connect-src` in `public/_headers`.
- *"The backend does not have the admin tools yet"*: the backend that answered is an older version. Deploy the version with the admin API.
- *"The admin tools only work on the Kasho Pay admin site"*: the origin of this site is not in `ADMIN_ORIGINS` on the backend (exact `https://...` origin, no path, no trailing slash).
- *"The admin site is not set up on the server yet (ADMIN_ORIGINS)"*: `ADMIN_ORIGINS` is empty on the production backend.
- *"This account is not allowed to use the admin site"*: the account is not in the backend `admins` table.
