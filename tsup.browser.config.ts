import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/browser.ts'],
  format: ['esm'],
  outDir: 'dist',
  splitting: false,
  sourcemap: true,
  clean: false,
  dts: true,
  minify: false,
  target: 'es2020',
  platform: 'browser',
});
