import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  publicDir: "public",
  build: {
    outDir: "dist",
    sourcemap: true
  },
  server: {
    port: 3000,
    open: true
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
        importers: [
          {
            findFileUrl(url: string) {
              // Help resolve font files from node_modules/@material-design-icons/font
              if (url.startsWith("./material-icons")) {
                return new URL(
                  `file://${path.resolve(__dirname, "node_modules/@material-design-icons/font", url.slice(2))}`
                );
              }
              return null;
            }
          }
        ]
      }
    }
  }
});
