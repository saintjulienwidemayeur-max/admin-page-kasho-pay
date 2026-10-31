import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// A plain single-page app: `npm run build` writes static files to dist/ (no server to run).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: true, port: 5174, strictPort: true },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
});
