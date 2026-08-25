import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.js"],
    exclude: [...configDefaults.exclude, "e2e/**"]
  }
});
