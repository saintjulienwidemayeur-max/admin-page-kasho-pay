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
});
