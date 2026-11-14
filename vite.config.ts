import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) {
            return "recharts-vendor";
          }
          if (id.includes("leaflet")) {
            return "leaflet-vendor";
          }
          return undefined;
        },
      },
    },
  },
});
