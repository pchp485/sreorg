import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Ordered array, not an object: Vite does prefix replacement, so the subpath
// aliases must be tried before the bare package names.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@sreorg\/core\/(.*)$/, replacement: resolve(__dirname, "packages/core/src/$1") },
      { find: /^@sreorg\/tax-india\/(.*)$/, replacement: resolve(__dirname, "packages/tax-india/src/$1") },
      { find: /^@sreorg\/growth\/(.*)$/, replacement: resolve(__dirname, "packages/growth/src/$1") },
      { find: "@sreorg/core", replacement: resolve(__dirname, "packages/core/src/index.ts") },
      { find: "@sreorg/tax-india", replacement: resolve(__dirname, "packages/tax-india/src/index.ts") },
      { find: "@sreorg/growth", replacement: resolve(__dirname, "packages/growth/src/index.ts") },
    ],
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
