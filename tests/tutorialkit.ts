import { defineTest } from "../src/test";

export default defineTest({
  repo: "stackblitz/tutorialkit",
  branch: "main",
  test: "test:e2e",
  build: "build",
  beforeTest:
    "pnpm --filter=tutorialkit-e2e exec playwright install chromium --with-deps",
});
