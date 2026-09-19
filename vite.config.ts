import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@lexical") || id.includes("node_modules/lexical")) return "lexical";
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "react";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
});
