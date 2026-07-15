import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    ignorePatterns: ['.vscode/**'],
    singleQuote: true,
  },
  lint: {
    ignorePatterns: ['.vscode/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
  pack: {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: true,
  },
});
