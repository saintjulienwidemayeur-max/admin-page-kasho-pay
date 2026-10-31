import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { execSync } from "node:child_process";

// Which commit this site was built from (Cloudflare gives it in an environment variable), to tell versions apart when something breaks.
const build = (() => {
  const fromEnv = process.env["WORKERS_CI_COMMIT_SHA"] ?? process.env["CF_PAGES_COMMIT_SHA"];
  if (fromEnv) return fromEnv.slice(0, 7);
  try { return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "dev"; } catch { return "dev"; }
})();

// A plain single-page app: `npm run build` writes static files to dist/ (no server to run).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __BUILD__: JSON.stringify(build) },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: true, port: 5174, strictPort: true },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
});
