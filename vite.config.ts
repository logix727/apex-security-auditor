import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => ({
  resolve: {
    alias: mode === 'mock' ? {
      '@tauri-apps/api/core': path.resolve(__dirname, './src/mocks/tauri-core.ts'),
      '@tauri-apps/api/event': path.resolve(__dirname, './src/mocks/tauri-core.ts'),
      '@tauri-apps/api/path': path.resolve(__dirname, './src/mocks/tauri-core.ts'),
      '@tauri-apps/api/window': path.resolve(__dirname, './src/mocks/tauri-core.ts'),
      '@tauri-apps/plugin-dialog': path.resolve(__dirname, './src/mocks/tauri-core.ts'),
      '@tauri-apps/plugin-fs': path.resolve(__dirname, './src/mocks/tauri-core.ts'),
      '@tauri-apps/plugin-opener': path.resolve(__dirname, './src/mocks/tauri-core.ts')
    } : {}
  },
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  optimizeDeps: {
    exclude: mode === 'mock' ? ['@tauri-apps/api', '@tauri-apps/plugin-dialog', '@tauri-apps/plugin-fs', '@tauri-apps/plugin-opener'] : []
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/e2e/**'],
  },
}));
