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
});
