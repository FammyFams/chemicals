// @ts-check
import { defineConfig } from 'astro/config';

// Static output, client-side parsing. No SSR/backend in Phase 1.
// Served from GitHub Pages project site: https://fammyfams.github.io/chemicals/
export default defineConfig({
  output: 'static',
  site: 'https://fammyfams.github.io',
  base: '/chemicals',
});
