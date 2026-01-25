import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: "public",
  build: {
    outDir: "dist",
    sourcemap: true
  },
  server: {
    open: false
  },
  css: {
    preprocessorOptions: {
      scss: {
        // api: "modern-compiler",
        // importers: [
        //   {
        //     findFileUrl(url: string) {
        //       // Help resolve font files from node_modules/@material-design-icons/font
        //       if (url.startsWith("./material-icons")) {
        //         return new URL(
        //           `file://${path.resolve(__dirname, "node_modules/@material-design-icons/font", url.slice(2))}`
        //         );
        //       }
        //       return null;
        //     }
        //   }
        // ]
      }
    }
  }
});
