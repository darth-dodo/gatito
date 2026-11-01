import { defineConfig } from "vitest/config";
import process from "node:process";
import { fileURLToPath } from "node:url";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  // Keep Vite from obscuring Rust errors.
  clearScreen: false,
  // WINDOWSILL_DEBUG=1 at build time turns on the frame-time readout; only this one variable is exposed.
  define: {
    __WINDOWSILL_DEBUG__: JSON.stringify(process.env.WINDOWSILL_DEBUG ?? ""),
  },
  build: {
    rollupOptions: {
      // The app overlay, the New pet window, plus a browser demo of the same pets on a pretend desktop.
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        create: fileURLToPath(new URL("./create.html", import.meta.url)),
        demo: fileURLToPath(new URL("./demo.html", import.meta.url)),
      },
    },
  },
  // Tauri expects a fixed port.
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/brain/**"],
      thresholds: { "src/brain/**": { lines: 85 } },
    },
  },
});
