import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest setup — node environment for pure logic tests (i18n parity,
 * task parsers, quadrant classifier). Component tests can be added
 * later under happy-dom or jsdom; for now we keep it minimal so the
 * runner stays fast and dependency-light.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    deps: {
      inline: ["date-fns"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
