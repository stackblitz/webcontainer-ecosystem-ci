[![webcontainer-ecosystem-ci](https://github.com/stackblitz/webcontainer-ecosystem-ci/actions/workflows/ecosystem-ci.yml/badge.svg?event=schedule)](https://github.com/stackblitz/webcontainer-ecosystem-ci/actions/workflows/ecosystem-ci.yml?query=event%3Aschedule)

# webcontainer-ecosystem-ci

This repository is used to run tests for WebContainer ecosystem projects

## Github workflow

### Scheduled

Workflows are sheduled to run automatically every Monday, Wednesday and Friday.

### Manually

- open [workflow](../../actions/workflows/ecosystem-ci.yml)
- click 'Run workflow' button on top right of the list
- select suite to run in dropdown
- start workflow

### Shell script

- clone this repo
- run `pnpm i`
- run `pnpm test` to run all suites
- or `pnpm test <suitename>` to select a suite
- or `tsx ecosystem-ci.ts`

You can pass `--release <version>` to select a specific `@webcontainer/api` version to use.

The repositories are checked out into `workspace` subdirectory as shallow clones

## How to add a new integration test

- check out the existing [tests](./tests) and add one yourself. Thanks to some utilities it is really easy
- once you are confidente the suite works, add it to the lists of suites in the [workflows](../../actions/)

## Credits

This project is inspired and based on:

- https://github.com/vitest-dev/vitest-ecosystem-ci
- https://github.com/vitejs/vite-ecosystem-ci
