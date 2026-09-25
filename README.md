# eslint

A [Dagger](https://dagger.io) module, written in Dang, that lints your
JavaScript and TypeScript projects with [ESLint](https://eslint.org), using
each project's own ESLint configuration and version.

## Requirements

Dagger engine `v1.0.0-beta.15` or later. That release is not out yet, so for
now this module only loads on a development engine.

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

Discovery only looks for those file names; it never runs ESLint or Node, so
listing stays fast. That has limits:

- `node_modules` directories are never searched.
- A config given only in `package.json` (`eslintConfig`), through `--config`,
  or under another file name is not found.
- A directory without its own config is linted as part of the project that
  encloses it.

Each project is linted from its own directory. Projects nested inside it are
skipped there (`--ignore-pattern <nested>/**`) and linted on their own, with
their own config, so no file is linted twice.

Dependencies are installed from the nearest `package.json` at or above the
project, with the configured package manager. The whole workspace is mounted
(without `node_modules`), so a shared config higher up still resolves. When
there is no `package.json`, nothing is installed and `npx` fetches ESLint on
demand, so a standalone ESLint config works without a Node project.

## Working directory

Which projects you see depends on where you run `dagger`:

- **At a project root:** that project and the projects below it.
- **Inside a project's subdirectory:** only the enclosing project.
- **Outside any project:** the projects below you.

So you don't need a flag to lint the project you are working in:

```sh
cd app/src && dagger check     # lints the app project, and nothing else
```

## Checks

| Address                | Runs                              |
| ---------------------- | --------------------------------- |
| `eslint/projects/lint` | ESLint in each project (`@check`) |

```sh
dagger check                                  # every check in the workspace
dagger check --eslint                         # every ESLint project
dagger check eslint/projects/lint             # the same, by address
dagger check --eslint --eslint-project=app    # one project (repeatable)
dagger check -l --all --eslint                # list one line per project
dagger check -l --all --eslint -f=cli         # ...as flags you can paste back
```

The selected projects are linted in parallel, and every failing project is
reported.

The flags for this module (see `dagger check --help`):

| Flag                      | Selects                              |
| ------------------------- | ------------------------------------ |
| `--eslint`, `--by-eslint` | checks from this module              |
| `--eslint-project=PATH`   | one project (repeatable)             |
| `--eslint-projects`       | every project                        |
| `--lint`, `--check-lint`  | checks named `lint`, in every module |

The short flag `--eslint-project` stays as long as no other installed module
has an item type with the same name. `dagger check --help` lists the flags in
effect.

## Fixing

Each project has a `fix` function that runs `eslint --fix` and returns the
changes as a `Changeset`, rooted at your working directory. It keeps the
fixes even when problems ESLint cannot fix remain, and leaves those for `lint`
to report. `fix` is not a generator, so it adds no check to `dagger check`.
`dagger call` can't reach a collection item yet, so for now call `fix` from
another module (below).

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
settings.baseImageAddress = "node:22"   # default: node:25-alpine; any image with Node
settings.packageManager = "yarn"        # default: npm; also yarn, pnpm or bun
```

Or from the CLI:

```sh
dagger settings eslint baseImageAddress node:22
```
