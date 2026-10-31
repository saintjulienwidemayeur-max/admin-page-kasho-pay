// Run: npm test
// public/_headers is the only protection the hosting adds to this site: keep it strict.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
const value = (name: string) => new RegExp(`^\\s+${name}:\\s*(.+)$`, "mi").exec(headers)?.[1]?.trim() ?? "";
const csp = value("Content-Security-Policy");
const directive = (d: string) => new RegExp(`(?:^|;)\\s*${d}\\s+([^;]+)`).exec(csp)?.[1]?.trim() ?? "";

test("the site cannot be framed, sniffed or indexed", () => {
  assert.equal(value("X-Frame-Options"), "DENY");
  assert.equal(value("X-Content-Type-Options"), "nosniff");
  assert.equal(value("Referrer-Policy"), "no-referrer");
  assert.match(value("X-Robots-Tag"), /noindex/);
  assert.match(value("Strict-Transport-Security"), /max-age=\d{7,}/);
  assert.equal(directive("frame-ancestors"), "'none'");
});

test("scripts only come from the site itself", () => {
  assert.equal(directive("script-src"), "'self'");
  assert.equal(directive("default-src"), "'self'");
  assert.equal(directive("object-src"), "'none'");
  assert.equal(directive("base-uri"), "'none'");
  assert.ok(!/unsafe-eval|unsafe-inline/.test(directive("script-src")), "no inline or eval scripts");
});

test("the page may only talk to itself, Supabase and the backend", () => {
  const connect = directive("connect-src").split(/\s+/);
  assert.ok(connect.includes("'self'") && connect.includes("https://*.supabase.co"));
  for (const c of connect) assert.ok(c === "'self'" || c.startsWith("https://"), `connect-src must be https only: ${c}`);
  assert.ok(!connect.includes("*") && !connect.includes("https:"), "no wildcard for everything");
});

test("pages are never cached, built files can be, and no rule clashes with another", () => {
  const rules = [...headers.matchAll(/^(\/\S*)\n((?:[ \t]+.+\n?)+)/gm)].map((m) => ({ path: m[1]!, body: m[2]! }));
  const rule = (path: string) => rules.find((r) => r.path === path)?.body ?? "";
  assert.match(rule("/"), /Cache-Control: no-store/);
  assert.match(rule("/index.html"), /Cache-Control: no-store/);
  assert.match(rule("/assets/*"), /Cache-Control: public, max-age=31536000, immutable/);
  // Cloudflare merges the headers of all matching rules: a Cache-Control on /* would be glued to the ones above
  assert.ok(!/Cache-Control/i.test(rule("/*")), "no Cache-Control on /*");
});
