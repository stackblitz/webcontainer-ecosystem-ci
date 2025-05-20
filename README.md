[![webcontainer-ecosystem-ci](https://github.com/stackblitz/webcontainer-ecosystem-ci/actions/workflows/ecosystem-ci.yml/badge.svg?event=schedule)](https://github.com/stackblitz/webcontainer-ecosystem-ci/actions/workflows/ecosystem-ci.yml?query=event%3Aschedule)

# webcontainer-ecosystem-ci

This repository is used to run tests for WebContainer ecosystem projects.

## GitHub workflow

### Scheduled

Workflows are scheduled to run automatically every Monday, Wednesday and Friday.

### Manually

- Open [workflow](../../actions/workflows/ecosystem-ci.yml)
- Click the 'Run workflow' button at the top right of the list
- Select the suite to run in the dropdown
- Start the workflow

### Shell script

- Clone this repo
- Run `pnpm i`
- Run `pnpm test` to execute all suites
- Or `pnpm test <suitename>` to select a specific suite
- Or `tsx ecosystem-ci.ts`

You can pass `--release <version>` to select a specific `@webcontainer/api` version to use.

The repositories are checked out into the `workspace` subdirectory as shallow clones.

## How to add a new integration test

- Check out the existing [tests](./tests) and add one yourself. Thanks to some utilities, it is really easy
- Once you are confidente the suite works, add it to the lists of suites in the [workflows](../../actions/)

## Credits

This project is inspired by and based on:

- https://github.com/vitest-dev/vitest-ecosystem-ci
- https://github.com/vitejs/vite-ecosystem-ci
