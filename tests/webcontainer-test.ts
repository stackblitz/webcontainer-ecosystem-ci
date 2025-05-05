import { defineTest } from "../src/test";

export default defineTest({
  repo: "stackblitz/webcontainer-test",
  branch: "main",
  test: ["test"],
  beforeTest:
    "npx playwright install chromium firefox --with-deps --only-shell",
});
