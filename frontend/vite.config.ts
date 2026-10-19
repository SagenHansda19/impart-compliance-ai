import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev: `npm run dev` proxies /api to the backend. Production: nginx does the same (see nginx.conf.template).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 8000, proxy: { "/api": process.env.BACKEND_URL ?? "http://localhost:8080" } },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], globals: true },
});
