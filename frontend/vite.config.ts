import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: path.resolve(__dirname, "build"),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/kapibot-entry.tsx"),
      name: "Kapibot",
      formats: ["iife"],
      fileName: () => "kapibot.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: "esbuild",
    sourcemap: false,
  },
});
