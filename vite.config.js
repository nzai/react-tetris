import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 编译时间戳，格式 YYYYMMDDHHmm，作为版本号注入全局常量
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const buildTime = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [react({ include: '**/*.{js,jsx}' })],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuild: {
      loader: { '.js': 'jsx' },
    },
  },
  css: {
    modules: {
      generateScopedName: '[hash:base64:4]',
    },
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  build: {
    outDir: 'docs',
    assetsInlineLimit: 8192,
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
});
