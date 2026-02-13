import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackRouter({}),
    react(),
    VitePWA({
      devOptions: { enabled: true },
      manifest: {
        description: "SizePanic - PWA Application",
        name: "SizePanic",
        short_name: "SizePanic",
        theme_color: "#0c0c0c",
      },
      pwaAssets: { config: true, disabled: false },
      registerType: "autoUpdate",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 4002,
  },
});
