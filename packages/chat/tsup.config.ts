import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.ts',
  },
  format: ['cjs', 'esm', 'iife'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  globalName: 'SeaLink',
  outExtension({ format }) {
    if (format === 'iife') {
      return { js: '.browser.js' };
    }
    return {
      js: `.${format === 'cjs' ? 'js' : 'mjs'}`,
    };
  },
});
