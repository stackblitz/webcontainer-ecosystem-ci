import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { cac } from "cac";

import { CommandOptions } from "./types";
import { setupEnvironment } from "./utils";

const cli = cac();
cli
  .command("[...suites]", "run selected suites")
  .option(
    "--release <version>",
    "@webcontainer/api release to use from npm registry"
  )
  .action(async (suites: string[], options: CommandOptions) => {
    await assertSuites(suites);

    const { root, workspace } = await setupEnvironment();

    for (const suite of suites) {
      const { default: test } = (await import(
        `../tests/${suite}.ts`
      )) as typeof import("../tests/starters");

      await test({
        root,
        release: options.release,
        workspace: resolve(workspace, suite),
      });
    }
  });

cli.parse();

async function assertSuites(suites: string[]) {
  const directory = resolve(import.meta.dirname, "../tests");
  const tests = await readdir(directory);

  for (const suite of suites) {
    if (!tests.includes(`${suite}.ts`)) {
      throw new Error(`"${suite}" does not exist in ${directory}`);
    }
  }
}
