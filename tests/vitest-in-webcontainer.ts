import { defineTest } from "../src/test";

export default defineTest({
  repo: "vitest-tests/vitest-in-webcontainer",
  branch: "main",
  test: "test",
  beforeTest: "npx playwright install chromium --with-deps --only-shell",
});
