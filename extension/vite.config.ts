import { defineConfig } from "vite";
import { resolve } from "path";

// Vite config for Chrome MV3 extension with multiple entry points
// - panel.html (React UI)
// - content_script.ts (DOM injection)
// - service_worker.ts (background)
export default defineConfig({
  base: "",
  root: ".",
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, "src/panel.html"),
        content_script: resolve(__dirname, "src/content_script.tsx"),
        service_worker: resolve(__dirname, "src/service_worker.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
