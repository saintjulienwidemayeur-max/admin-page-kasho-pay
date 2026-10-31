# Kasho Pay Admin

The administration site of Kasho Pay. It is a **separate site** (own repository, own domain, own login with 2FA), not a page of the customer app.
It shows what Freda holds, the fee schedule customers pay, the customers, the cards the platform issued and everything administrators did.

```
 admin site (this repo)  ──►  kasho-pay-backend (Render)  ──►  Supabase + Freda Pay Issuing
 admin.kashopay.com           one API, one database              (same project as the Kasho Pay app)
```

The money logic and the database stay in one place (the backend). This site is only the screens: it holds no secret key, and the backend
refuses every admin request that does not come from this site's origin (`ADMIN_ORIGINS`).

## What it does
| Tab | |
| --- | --- |
| Overview | Master Wallet and Gateway balances read from Freda (live or sandbox), "do we hold enough?" (what customers hold against what Freda holds), customer, card and pending-operation numbers |
| Fees | the customer fee schedule: what customers pay for each operation (add, edit, remove) |
| Customers | search, details, **add / remove money** (reason + password + 2FA), suspend / reactivate |
| Cards | every card the platform issued: figures (issued, active, frozen, pending, money on cards), search by card name / last 4 digits / reference / customer, filter by state and brand, and a panel per card with its owner, the money moved to and from it and the purchases Freda reported. **Read only**: no card number or CVV exists in the system, only brand, last 4 digits and expiry |
| Transactions, Support | everything that moved, disputes and support messages |
| Audit log | what every administrator did (nobody can edit or delete it) |
| My account | change the password |

**No profit, margin or "advantage" figures.** The site used to estimate profit from Freda's public price list. With real money those estimates were not good enough, so they are gone: every number on the site is either a balance read from Freda, a balance in the database or a count. The backend still records the real fees Freda reports (`fee_htg`, `payout_fee_htg`, `provider_fee_usd` on the transactions and `card_events` for card purchases), so an accurate report can be built later on exact data; until then, compare with the statements in the Freda dashboard.

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
- **Sensitive actions** (money, suspending, fees, password) ask for the password again, in a field inside the same window as the action (there is never a second window on top of the first); every change is in the audit log.
- **Hosting**: strict headers in `public/_headers` (no inline or third-party scripts, no framing, `no-store`, `noindex`), system fonts, no analytics, no third-party requests.

## Project layout
```
src/App.tsx            login / 2FA / dashboard gate (lib/gate.ts), idle sign-out (lib/idle.ts)
src/pages/             login, 2FA setup and code screens, dashboard (left menu on a computer, drawer on a phone)
src/components/admin/  one file per tab (shared.tsx: money format, password field, tables)
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
- *The Cards tab shows "The backend does not have the admin tools yet"* while the other tabs work: the backend is older than the Cards API (`adminListCards`, `adminGetCard`). Deploy its latest version.
- *"Cannot reach the Kasho server at ..."*: the browser could not talk to that address: wrong `VITE_API_URL`, the backend is asleep (open `<backend>/health` to check), the backend does not allow this site, or its domain is missing from `connect-src` in `public/_headers`. The message ends with the exact origin of this site: put it in `ADMIN_ORIGINS` on the backend (Render > Environment) and redeploy it. The backend must also be the version that has the admin API.
- *"The backend does not have the admin tools yet"*: the backend that answered is an older version. Deploy the version with the admin API.
- *"The admin tools only work on the Kasho Pay admin site"*: the origin of this site is not in `ADMIN_ORIGINS` on the backend (exact `https://...` origin, no path, no trailing slash).
- *"The admin site is not set up on the server yet (ADMIN_ORIGINS)"*: `ADMIN_ORIGINS` is empty on the production backend.
- *"Something went wrong on this page"*: a screen crashed. The box shows the error and the version of the site (`v 1234567`, also at the bottom of the menu): send both, then press "Reload the page".
- Back on the login screen with a message: the session ended and the message says why (the server and Supabase both refused it, or 20 minutes without activity). A single "session expired" answer from the server that Supabase does not confirm does not sign you out: the screen shows the message and "Try again".
- A dark or frozen page after a window closes: every window (customer panel, add / remove money, suspend, fees, card panel, phone menu) exists in the page only while it is open and is dropped once its closing animation is over, a closed window can never cover the page or catch clicks (CSS in `src/components/ui/*` and `src/styles.css`), and `src/lib/layers.ts` puts a frozen page right by itself within a few seconds. If it ever happens again, send the version shown at the bottom of the menu (`v 1234567`) and what was clicked. The browser's own page translation is switched off on purpose (it breaks React pages): use the EN / FR switch.
- *"This account is not allowed to use the admin site"*: the account is not in the backend `admins` table.
