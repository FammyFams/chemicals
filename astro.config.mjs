// @ts-check
import { defineConfig } from 'astro/config';

// Static output, client-side parsing. No SSR/backend in Phase 1.
export default defineConfig({
  output: 'static',
});
