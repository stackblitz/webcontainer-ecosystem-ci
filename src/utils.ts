import { existsSync, lstatSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import actionsCore from "@actions/core";
import { detect, AGENTS, getCommand } from "@antfu/ni";
import { x } from "tinyexec";

import { Overrides, RepoOptions, RunOptions, Task } from "./types";

const isGitHubActions = !!process.env.GITHUB_ACTIONS;

let cwd = process.cwd();
let env = process.env;

function cd(dir: string) {
  cwd = resolve(cwd, dir);
}

export async function runInRepo(options: RunOptions & RepoOptions) {
  const {
    build,
    test,
    repo,
    branch,
    tag,
    commit,
    beforeInstall,
    beforeBuild,
    beforeTest,
  } = options;

  const dir = resolve(
    options.workspace,
    options.dir || repo.substring(repo.lastIndexOf("/") + 1),
  );

  const overrides = options.overrides || {};

  if (options.release) {
    overrides["@webcontainer/api"] = options.release;
  }

  await setupRepo({ repo, dir, branch, tag, commit });

  if (options.agent == null) {
    const detectedAgent = await detect({ cwd: dir, autoInstall: false });

    if (detectedAgent == null) {
      throw new Error(`Failed to detect packagemanager in ${dir}`);
    }

    options.agent = detectedAgent;
  }

  if (!AGENTS.includes(options.agent)) {
    throw new Error(
      `Invalid agent ${options.agent}. Allowed values: ${Object.values(
        AGENTS,
      ).join(", ")}`,
    );
  }

  const agent = options.agent;
  const beforeInstallCommand = toCommand(beforeInstall, agent);
  const beforeBuildCommand = toCommand(beforeBuild, agent);
  const beforeTestCommand = toCommand(beforeTest, agent);
  const buildCommand = toCommand(build, agent);
  const testCommand = toCommand(test, agent);

  const pkgFile = join(dir, "package.json");
  const pkg = JSON.parse(await readFile(pkgFile, "utf-8"));

  await beforeInstallCommand?.(pkg.scripts);

  await applyPackageOverrides(dir, pkg, overrides, options);
  await beforeBuildCommand?.(pkg.scripts);
  await buildCommand?.(pkg.scripts);

  if (test) {
    await beforeTestCommand?.(pkg.scripts);
    await testCommand?.(pkg.scripts);
  }

  return { dir };
}

async function setupRepo(options: RepoOptions) {
  if (options.branch == null) {
    options.branch = "main";
  }

  if (options.shallow == null) {
    options.shallow = true;
  }

  const { dir, shallow, tag, branch, commit } = options;

  let { repo } = options;

  if (!dir) {
    throw new Error("setupRepo must be called with options.dir");
  }

  if (!repo.includes(":")) {
    repo = `https://github.com/${repo}.git`;
  }

  let needClone = true;

  if (existsSync(dir)) {
    const _cwd = cwd;
    cd(dir);

    let currentClonedRepo: string | undefined;

    try {
      currentClonedRepo = await $`git ls-remote --get-url`;
    } catch {
      // when not a git repo
    }
    cd(_cwd);

    if (repo === currentClonedRepo) {
      needClone = false;
    } else {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  if (needClone) {
    await $`git -c advice.detachedHead=false clone ${
      shallow ? "--depth=1 --no-tags" : ""
    } --branch ${tag || branch} ${repo} ${dir}`;
  }

  cd(dir);
  await $`git clean -fdxq`;
  await $`git fetch ${shallow ? "--depth=1 --no-tags" : "--tags"} origin ${
    tag ? `tag ${tag}` : `${commit || branch}`
  }`;

  if (shallow) {
    await $`git -c advice.detachedHead=false checkout ${
      tag ? `tags/${tag}` : `${commit || branch}`
    }`;
  } else {
    await $`git checkout ${branch}`;
    await $`git merge FETCH_HEAD`;

    if (tag || commit) {
      await $`git reset --hard ${tag || commit}`;
    }
  }
}

export async function $(literals: TemplateStringsArray, ...values: any[]) {
  const fullCmd = literals.reduce(
    (result, current, i) =>
      result + current + (values?.[i] != null ? `${values[i]}` : ""),
    "",
  );

  const [cmd, ...options] = fullCmd.split(" ");

  if (isGitHubActions) {
    actionsCore.startGroup(`${cwd} $> ${fullCmd}`);
  } else {
    console.log(`${cwd} $> ${fullCmd}`);
  }

  const proc = x(cmd, options, {
    nodeOptions: {
      env,
      stdio: "pipe",
      cwd,
    },
  });

  if (proc.process?.stdin) {
    process.stdin.pipe(proc.process.stdin);
  }

  proc.process?.stdout?.pipe(process.stdout);
  proc.process?.stderr?.pipe(process.stderr);

  const result = await proc;

  if (isGitHubActions) {
    actionsCore.endGroup();
  }

  return result.stdout;
}

export async function setupEnvironment() {
  const root = import.meta.dirname;
  const workspace = resolve(root, "workspace");

  const cwd = process.cwd();
  env = {
    ...process.env,
    CI: "true",
    NODE_OPTIONS: "--max-old-space-size=6144", // GITHUB CI has 7GB max, stay below
    ECOSYSTEM_CI: "true", // flag for tests, can be used to conditionally skip irrelevant tests
  };

  if (!existsSync(workspace)) {
    await mkdir(workspace, { recursive: true });
  }

  return { root, workspace, cwd };
}

function toCommand(
  task: Task | Task[] | void,
  agent: NonNullable<RunOptions["agent"]>,
): ((scripts: any) => Promise<any>) | void {
  return async (scripts: any) => {
    const tasks = Array.isArray(task) ? task : [task];

    for (const task of tasks) {
      if (task == null || task === "") {
        continue;
      }

      if (typeof task === "string") {
        const scriptOrBin = task.trim().split(/\s+/)[0];

        if (scripts?.[scriptOrBin] != null) {
          const runTaskWithAgent = getCommand(agent, "run", [task]);

          await $`${runTaskWithAgent.command} ${runTaskWithAgent.args.join(
            " ",
          )}`;
        } else {
          await $`${task}`;
        }
      } else if (typeof task === "function") {
        await task();
      } else {
        throw new Error(
          `invalid task, expected string or function but got ${typeof task}: ${task}`,
        );
      }
    }
  };
}

export async function applyPackageOverrides(
  dir: string,
  pkg: any,
  overrides: Overrides = {},
  options: RunOptions & RepoOptions,
) {
  const useFileProtocol = (v: string) =>
    isLocalOverride(v) ? `file:${resolve(v)}` : v;

  // remove boolean flags
  overrides = Object.fromEntries(
    Object.entries(overrides)
      .filter(([_, value]) => typeof value === "string")
      .map(([key, value]) => [key, useFileProtocol(value as string)]),
  );
  await $`git clean -fdxq`; // remove current install

  const agent = await detect({ cwd: dir, autoInstall: false });

  if (!agent) {
    throw new Error(`failed to detect packageManager in ${dir}`);
  }

  /**
   * Remove version from agent string:
   * yarn@berry => yarn
   * pnpm@6, pnpm@7 => pnpm
   * .
   */
  const pm = agent?.split("@")[0];

  await overridePackageManagerVersion(pkg, pm, options.agentVersion);

  if (pm === "pnpm") {
    pkg.devDependencies ||= {};
    pkg.devDependencies = {
      ...pkg.devDependencies,
      ...overrides, // overrides must be present in devDependencies or dependencies otherwise they may not work
    };

    pkg.pnpm ||= {};
    pkg.pnpm.overrides = {
      ...pkg.pnpm.overrides,
      ...overrides,
    };
  } else if (pm === "yarn") {
    pkg.resolutions = {
      ...pkg.resolutions,
      ...overrides,
    };
  } else if (pm === "npm") {
    pkg.overrides = {
      ...pkg.overrides,
      ...overrides,
    };

    // npm does not allow overriding direct dependencies, force it by updating the blocks themselves
    for (const [name, version] of Object.entries(overrides)) {
      if (pkg.dependencies?.[name]) {
        pkg.dependencies[name] = version;
      }

      if (pkg.devDependencies?.[name]) {
        pkg.devDependencies[name] = version;
      }
    }
  } else {
    throw new Error(`unsupported package manager detected: ${pm}`);
  }

  const pkgFile = join(dir, "package.json");
  await writeFile(pkgFile, JSON.stringify(pkg, null, 2), "utf-8");

  // use of `ni` command here could cause lockfile violation errors so fall back to native commands that avoid these
  if (pm === "pnpm") {
    await $`pnpm install --prefer-frozen-lockfile --prefer-offline --strict-peer-dependencies false`;
  } else if (pm === "yarn") {
    await $`yarn install`;
  } else if (pm === "npm") {
    await $`npm install`;
  } else {
    throw new Error(`Unable to resolve install command for ${pm}`);
  }
}

function isLocalOverride(v: string): boolean {
  if (!v.includes("/") || v.startsWith("@")) {
    // not path-like (either a version number or a package name)
    return false;
  }

  try {
    return !!lstatSync(v)?.isDirectory();
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    return false;
  }
}

/**
 * Utility to override packageManager version.
 *
 * @param pkg parsed package.json
 * @param pm package manager to override eg. `pnpm`
 * @returns {boolean} true if pkg was updated, caller is responsible for writing it to disk
 */
async function overridePackageManagerVersion(
  pkg: { [key: string]: any },
  pm: string,
  agentVersion?: string,
): Promise<boolean> {
  const overrideWithVersion: string | undefined = agentVersion;

  if (overrideWithVersion) {
    console.warn(
      `Changing pkg.packageManager and pkg.engines.${pm} to enforce use of ${pm}@${overrideWithVersion}`,
    );

    // corepack reads this and uses pnpm @ newVersion then
    pkg.packageManager = `${pm}@${overrideWithVersion}`;

    if (!pkg.engines) {
      pkg.engines = {};
    }

    pkg.engines[pm] = overrideWithVersion;

    if (pkg.devDependencies?.[pm]) {
      /**
       * If for some reason the pm is in devDependencies, that would be a local version that'd be preferred over our forced global
       * so ensure it here too.
       */
      pkg.devDependencies[pm] = overrideWithVersion;
    }

    return true;
  }

  return false;
}
