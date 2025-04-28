import { RepoOptions, RunOptions } from "./types";
import { runInRepo } from "./utils";

export function defineTest(repoOptions: RepoOptions & Partial<RunOptions>) {
  return async function test(options: RunOptions & Partial<RepoOptions>) {
    await runInRepo({
      ...repoOptions,
      ...options,
    });
  };
}
