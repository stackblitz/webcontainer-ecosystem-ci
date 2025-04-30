import type { AGENTS } from "@antfu/ni";

export interface CommandOptions {
  release: string;
}

export type Task = string | (() => Promise<any>);

export interface RunOptions {
  workspace: string;
  root: string;
  release?: string;
  agent?: (typeof AGENTS)[number];
  agentVersion?: string;
  build?: Task | Task[];
  test?: Task | Task[];
  beforeInstall?: Task | Task[];
  beforeBuild?: Task | Task[];
  beforeTest?: Task | Task[];
}

export interface RepoOptions {
  repo: string;
  dir?: string;
  branch?: string;
  tag?: string;
  commit?: string;
  shallow?: boolean;
  overrides?: Overrides;
}

export interface Overrides {
  [key: string]: string | boolean;
}
