import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy lets you use /api locally without CORS headaches.
// In production we use VITE_API_BASE and skip the proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8788",
        changeOrigin: true
      },
      "/health": {
        target: "http://localhost:8788",
        changeOrigin: true
      },
      "/healthz": {
        target: "http://localhost:8788",
        changeOrigin: true
      }
    }
  }
});
