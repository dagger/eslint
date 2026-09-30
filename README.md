# eslint

A [Dagger](https://dagger.io) module, written in Dang, that lints your
JavaScript and TypeScript projects with [ESLint](https://eslint.org), using
each project's own ESLint configuration and version.

## Requirements

Requires Dagger v1.0.0-beta.15 or later.

## Install

```sh
dagger install github.com/dagger/eslint
```

## Projects

The module lints each **ESLint project** in your workspace separately. A
project is a directory holding an ESLint config file:

- flat config: `eslint.config.js`, `.mjs`, `.cjs`, `.ts`, `.mts` or `.cts`
- legacy config: `.eslintrc`, `.eslintrc.js`, `.cjs`, `.json`, `.yaml` or
  `.yml`

A project is keyed by its path from the workspace root (`.` for the root).
List the projects visible from where you stand:

```sh
dagger list eslint-projects -a
```

Discovery only reads file names and config text; it never runs ESLint or
Node, so listing stays fast. That has limits:

- `node_modules` directories are never searched.
- A config inside a directory that an enclosing flat config ignores globally
  is not a project. Only literal string patterns are read: an object holding
  just `ignores` (and optionally `name`), or `globalIgnores([...])`. Patterns
  built at runtime, or ignores in an object that also has `files`, are not
  seen.
- A config given only in `package.json` (`eslintConfig`), through `--config`,
  or under another file name is not found.
- A directory without its own config is linted as part of the project that
  encloses it.

Each project is linted from its own directory. Projects nested inside it are
skipped there (`--ignore-pattern <nested>/**`) and linted on their own, with
their own config, so no file is linted twice.

## Working directory

Which projects you see depends on where you run `dagger`:

- **At a project root:** that project and the projects below it.
- **Inside a project's subdirectory:** the enclosing project, plus any
  projects below where you stand.
- **Outside any project:** the projects below you.

So you don't need a flag to lint the project you are working in:

```sh
cd app/src && dagger check     # lints the app project
```

## Dependencies and the ESLint version

Each project runs the ESLint its own dependencies install:

1. **Where:** dependencies are installed at the nearest workspace root at or
   above the project (a `pnpm-workspace.yaml`, or a `package.json` with
   `"workspaces"`), else the nearest directory with a lockfile, else the
   nearest `package.json`. That tree is mounted, so `workspace:` and
   `catalog:` dependencies and shared configs resolve.
2. **With what:** the `packageManager` setting, or when it is empty, the
   `"packageManager"` field of that `package.json`, else the lockfile
   (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock`/`bun.lockb`), else npm. pnpm
   and yarn run through corepack, which is installed first on images that no
   longer ship it (Node 25 and later), and use the version `packageManager`
   names.
3. **Cached:** only the files the install reads (every `package.json`,
   lockfiles, `pnpm-workspace.yaml`, `.npmrc`, `.yarnrc*`, `.yarn/` releases,
   plugins and patches, `patches/`) are mounted for the install, so editing
   source does not re-run it. The package manager caches, the pnpm store and
   corepack's downloads are cache volumes. Browser downloads (Playwright,
   Puppeteer, Cypress) and git hook installs are skipped.
4. **Which ESLint:** the nearest `node_modules/.bin/eslint` from the project
   up to the install root, or `yarn eslint` under Yarn Plug'n'Play. If the
   project doesn't install ESLint, the check fails and says so. ESLint 9.34
   and later with a flat config gets `--concurrency auto`.

A project with no `package.json` at or above it installs nothing, and `npx`
fetches the latest ESLint, so a standalone ESLint config works without a Node
project.

Lifecycle scripts run during the install without the source mounted. If one
needs source files, pass `--ignore-scripts` in `installFlags`.

Failures name the project and the step: `install failed (pnpm install, exit
1)` with the end of the installer's output, or `eslint failed (exit 1)` with
ESLint's report.

## Checks

| Address                | Runs                              |
| ---------------------- | --------------------------------- |
| `eslint/projects/lint` | ESLint in each project (`@check`) |

```sh
dagger check                                  # every check in the workspace
dagger check --eslint                         # every ESLint project
dagger check eslint/projects/lint             # the same, by address
dagger check --eslint-project=app             # one project (repeatable)
dagger check --check lint                     # checks named lint, in every module
dagger check -l --all --eslint                # list one line per project
dagger check -l --all --eslint -f=cli         # ...as flags you can paste back
```

The selected projects are linted in parallel, and every failing project is
reported.

Run the check with `dagger check`, in CI especially: `dagger call` on a check
function does not fail the command when the check fails.

The flags for this module (see `dagger check --help`):

| Flag                      | Selects                                |
| ------------------------- | -------------------------------------- |
| `--eslint`, `--by-eslint` | checks from this module                |
| `--eslint-project=PATH`   | one project (repeatable)               |
| `--eslint-projects`       | every project                          |
| `--check NAME`            | checks with that name, in every module |

The short flag `--eslint-project` stays as long as no other installed module
has an item type with the same name. `dagger check --help` lists the flags in
effect.

## Fixing

Each project has a `fix` function that runs `eslint --fix` and returns the
changes as a `Changeset`, rooted at your working directory. It keeps the
fixes even when problems ESLint cannot fix remain, and leaves those for `lint`
to report. `fix` is not a generator, so it adds no check to `dagger check`.

Apply a project's fixes from the CLI with a Dagger script (run it from the
workspace root, since the changes are rooted where you run it):

```sh
dagger -c 'eslint | projects | get app | fix | export .'
```

## Using it from another module

`projects(ws)` returns a collection. Use `keys`, `get(key:)` and
`subset(keys:)` to select projects, and `batch` to run a function over the
selection:

```dang
let projects = eslint.projects(ws)
projects.keys                                    # ["app", "app/packages/ui"]
run(projects.batch.lint(ws))                     # lint every project
run(projects.subset(keys: ["app"]).batch.lint(ws))
run(projects.get(key: "app").lint(ws))           # one project
projects.get(key: "app").fix(ws)                 # its fixes, as a Changeset
```

A check called through a dependency returns a `Check` that has not run yet.
Wrap it to run it and raise its failure:

```dang
let run(check: Check!): Void {
  if (check.pass == false) {
    raise check.error.message ?? "check failed"
  }
  null
}
```

## Settings

Set these in your workspace `dagger.toml`:

```toml
[modules.eslint]
source = "github.com/dagger/eslint"
settings.baseImageAddress = "node:22"            # default: node:25-alpine; any image with Node
settings.packageManager = "pnpm"                 # default: "" (detect); npm, pnpm, yarn or bun
settings.installFlags = ["--ignore-scripts"]     # default: []; appended to the install command
settings.environment = ["NODE_OPTIONS=--max-old-space-size=4096"]  # default: []; KEY=VALUE for ESLint
```

Or from the CLI:

```sh
dagger settings eslint baseImageAddress node:22   # set
dagger settings -u eslint baseImageAddress        # unset, back to the default
```
