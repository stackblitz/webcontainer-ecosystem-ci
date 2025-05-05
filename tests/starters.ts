import { defineTest } from "../src/test";

export default defineTest({
  repo: "stackblitz/starters",
  branch: "main",

  test: [
    "test -- --project chromium",

    // firefox is flaky, run it without parallelism
    "test -- --project firefox --no-file-parallelism",
  ],
  beforeTest:
    "npx playwright install chromium firefox --with-deps --only-shell",
});
