import { defineConfig } from "vitest/config";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  // Keep Vite from obscuring Rust errors.
  clearScreen: false,
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
