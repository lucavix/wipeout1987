import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// On GitHub Pages the site lives under /wipeout1987/; locally it is served from the root.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/wipeout1987/' : '/',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { strictPort: true },
  build: { target: 'es2022' },
});
