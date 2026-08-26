import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Dev server proxies /api and /media to the Django backend so the SPA can
// call same-origin paths in both dev and prod (nginx does the same proxy
// in the docker-compose setup — see ../docker-compose.yml).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "ZhasylDala",
        short_name: "ZhasylDala",
        description: "Жылыжай өсімдіктерінің ауруын диагностикалау",
        theme_color: "#0F766E",
        background_color: "#EFEFEC",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    // Bind to all network interfaces, not just localhost, so a phone on
    // the same Wi-Fi can open http://<mac-lan-ip>:5173 directly.
    host: true,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/media": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
