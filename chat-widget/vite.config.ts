import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3200",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "ZuupeeChatWidget",
      formats: ["iife"],
      fileName: () => "chat-widget.js",
    },
    cssCodeSplit: false,
    emptyOutDir: true,
  },
});
