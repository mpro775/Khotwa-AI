import { defineConfig } from "vite";
export default defineConfig({
  build: {
    commonjsOptions: { include: [/node_modules/, /api-validators\.cjs$/] },
  },
  server: { proxy: { "/api": "http://127.0.0.1:3000" } },
});
