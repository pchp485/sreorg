import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies API + WebSocket calls to the backend so the SPA and API
// share an origin during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": { target: "ws://localhost:8000", ws: true },
      "/health": "http://localhost:8000",
    },
  },
});
