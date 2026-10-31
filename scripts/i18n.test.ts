// Run: npm test
// The French dictionary: no empty texts, every pattern compiles and only uses capture groups it really has.
import test from "node:test";
import assert from "node:assert/strict";
import { FR, MONTHS_FR, PATTERNS } from "../src/lib/i18n/fr.ts";

test("every French text is filled in", () => {
  for (const [en, fr] of Object.entries(FR)) {
    assert.ok(fr.trim().length > 0, `empty French text for: ${en}`);
    assert.ok(en === en.trim(), `the key has spaces around it (it can never match): "${en}"`);
  }
  assert.equal(Object.keys(MONTHS_FR).length, 12);
});

test("every pattern is anchored and only uses the capture groups it has", () => {
  for (const [re, rep] of PATTERNS) {
    assert.ok(re.source.startsWith("^") && re.source.endsWith("$"), `not anchored: ${re}`);
    const groups = new RegExp(`${re.source}|`).exec("")!.length - 1;
    for (const m of rep.matchAll(/\$(\d)/g)) assert.ok(Number(m[1]) >= 1 && Number(m[1]) <= groups, `${re} uses $${m[1]} but has ${groups} group(s)`);
  }
});

test("the main screens are translated", () => {
  for (const en of ["Sign in", "Password", "Verify", "Sign out", "Overview", "Fees", "Customers", "Audit log", "My account", "Add money", "Remove money", "Suspend"]) assert.ok(FR[en], en);
  const tr = (t: string) => { const m = PATTERNS.map(([re, rep]) => { const x = re.exec(t); return x ? rep.replace(/\$(\d)/g, (_, n) => x[Number(n)] ?? "") : null; }).find(Boolean); return m ?? null; };
  assert.equal(tr("Top-up via MonCash"), "Recharge via MonCash");
  assert.equal(tr("Signed in as a@b.c. Open your authenticator app and enter the 6-digit code."), "Connecté en tant que a@b.c. Ouvrez votre application d'authentification et saisissez le code à 6 chiffres.");
  assert.equal(tr("One adjustment is limited to $10000.00."), "Un ajustement est limité à $10000.00.");
  // the setup messages the site shows when something is missing
  assert.match(tr("This site is not configured yet. The build is missing: VITE_API_URL. Add the missing build variables (Cloudflare: Settings > Build > Variables and secrets), then build again.")!, /^Ce site n'est pas encore configuré\. Il manque au build : VITE_API_URL\./);
  assert.equal(tr("Cannot reach the Kasho server at kasho-pay-backend.onrender.com. Check your connection, then check that the backend allows this site: ADMIN_ORIGINS must contain https://admin.kashopay.com"), "Impossible de joindre le serveur Kasho sur kasho-pay-backend.onrender.com. Vérifiez votre connexion, puis vérifiez que le serveur autorise ce site : ADMIN_ORIGINS doit contenir https://admin.kashopay.com");
  for (const en of ["The backend does not have the admin tools yet. Deploy its latest version (the admin API), then try again.", "The admin tools only work on the Kasho Pay admin site.", "The admin site is not set up on the server yet (ADMIN_ORIGINS).", "This action is not available from the admin site."]) assert.ok(FR[en], en);
});
