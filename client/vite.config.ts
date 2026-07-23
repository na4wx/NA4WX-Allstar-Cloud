import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev server proxies /api and /agent-adjacent browser calls to the
// Express server on :4000, so both can run side by side in development
// without CORS configuration -- in production these are typically
// served from the same origin by a reverse proxy instead.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  // preview (not dev) is what actually runs in production via pm2 --
  // Vite refuses requests whose Host header it doesn't recognize
  // unless the host is listed here. Add every hostname this is served
  // as (the reverse proxy's public domain, not localhost) here.
  preview: {
    host: "0.0.0.0",
    allowedHosts: ["allstar.na4wx.com"],
  },
});
