import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      babel: {
        babelrc: true
      }
    })
  ],
  publicDir: "public",
  build: {
    outDir: "dist",
    sourcemap: true
  },
  server: {
    open: false
  }
});
