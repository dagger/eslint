# eslint

A [Dagger](https://dagger.io) module, written in Dang, that lints your
JavaScript and TypeScript projects with [ESLint](https://eslint.org), using
each project's own ESLint configuration and version.

## Requirements

Requires Dagger v1.0.0-beta.22 or later.

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

Discovery scans the whole workspace once, reading only file names and
config text; it never runs ESLint or Node, so listing stays fast, and what is
a project does not depend on where you run `dagger`. That has limits:

- `node_modules` directories are never searched.
- A config inside a directory that the **nearest** enclosing config ignores
  globally is not a project, and neither is anything below it. A config in
  between starts a fresh scope: a grandparent's ignores do not reach past
  it. This is how ESLint 10 walks a tree. ESLint 9 and 8 (flat config) apply
  only the config found from where they run, so the module's split into
  projects gives the same answer as running ESLint inside each project
  directory. Either way no file is linted by nobody, and none twice.
- Only literal string patterns are read: an object holding just `ignores`
  (and optionally `name`), or `globalIgnores([...])`. Patterns built at
  runtime, ignores in an object that also has `files`, and legacy
  `.eslintrc` `ignorePatterns` are not seen.
- A config given only in `package.json` (`eslintConfig`), through `--config`,
  or under another file name is not found.
- A directory without its own config is linted as part of the project that
  encloses it.

Each project is linted from its own directory. Projects nested inside it are
skipped there (`--ignore-pattern <nested>/**`) and linted on their own, with
their own config, so no file is linted twice.

## Files

Each project holds the **files** ESLint lints in it, keyed by their path from
the workspace root. Each file is its own check. List them:

```sh
dagger check -l --all --eslint-project=app
```

Like projects, files are found from file names and config text only:
listing (`dagger check -l`, `dagger list`) runs no container at all, so it
installs nothing and runs neither ESLint nor Node. Files are:

- the extensions ESLint lints by default: `.js`, `.mjs` and `.cjs` with a
  flat config, `.js` with a legacy one;
- files matched by the literal `files` patterns of the project's config (for
  a legacy config, of its `overrides`, where a pattern without a slash
  matches a file name at any depth);
- `.ts`, `.tsx`, `.mts` and `.cts` files when the config names
  `typescript-eslint` (or `@vue/eslint-config-typescript`), `.vue` files
  when it names `eslint-plugin-vue`, and likewise `.svelte` and `.astro`,
  since those plugins' presets set `files` patterns the config text does not
  show. A flat config that names the extension in a literal `files` pattern
  of its own is taken at its word instead, as it may scope the preset;
- minus `.gitignore`d files, `node_modules`, nested projects and the
  config's literal global ignores (for a legacy config: `.eslintignore`,
  literal `ignorePatterns`, and dotfiles).

ESLint has the last word, and a check never passes with nothing behind it:

- A listed file ESLint does not lint (an ignore or a `files` pattern built
  at runtime, a shared config's patterns) fails its check, saying `ESLint
  did not lint this file`.
- A file ESLint lints but discovery missed has no check. When the whole
  project runs, errors in it fail every check of the project, naming the
  file (`ESLint found errors in files without a check`).
- A project whose config (or `.eslintignore`, or tree) cannot be read has
  one file, its config, whose check fails naming it (`app/eslint.config.mjs:
  cannot read the ESLint config`). Discovery carries on for every other
  project.

## Working directory

Which projects you see depends on where you run `dagger`:

- **At a project root:** that project and the projects below it.
- **Inside a project's subdirectory:** the enclosing project, plus any
  projects below where you stand. A directory the project ignores counts as
  its subdirectory, even if it holds a config of its own.
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
   plugins and patches, `patches/`, and the directories that `file:`,
   `link:` and `portal:` dependencies point to) are mounted for the install,
   so editing source does not re-run it. When a `package.json` marks a
   dependency `injected`, or a local dependency lies outside the install root,
   the install gets the full source instead. The package manager caches, the pnpm store and
   corepack's downloads are cache volumes. Browser downloads (Playwright,
   Puppeteer, Cypress) and git hook installs are skipped.
4. **Which ESLint:** the nearest `node_modules/.bin/eslint` from the project
   up to the install root, or `yarn eslint` under Yarn Plug'n'Play. If the
   project doesn't install ESLint, the check fails and says so. ESLint runs
   with its default (single-threaded) concurrency; projects are linted in
   parallel with each other.

A project with no `package.json` at or above it installs nothing, and `npx`
fetches the latest ESLint, so a standalone ESLint config works without a Node
project.

Lifecycle scripts run during the install without the source mounted. If one
needs source files, pass `--ignore-scripts` in `installFlags`.

Failures name the file and ESLint's messages for it (`app/a.js: ESLint
found 1 error`), or the project and the step that failed for all its files:
`install failed (pnpm install, exit 1)` with the end of the installer's
output, or `eslint failed (exit 2)` with the end of ESLint's.

## Checks

| Address                      | Runs                           |
| ---------------------------- | ------------------------------ |
| `eslint/projects/files/lint` | ESLint on each file (`@check`) |

```sh
dagger check                                  # every check in the workspace
dagger check --eslint                         # every file of every ESLint project
dagger check eslint/projects/files/lint       # the same, by address
dagger check --eslint-project=app             # every file of one project (repeatable)
dagger check --eslint-file=app/src/index.js   # one file (repeatable)
dagger check --check lint                     # checks named lint, in every module
dagger check -l --all --eslint                # list one line per file
dagger check -l --all --eslint -f=cli         # ...as flags you can paste back
```

### One ESLint run per project

Each selected file has its own check, but all the checks of a project share
one ESLint run: they call the same helper with the project's file
collection as `dagger check` filtered it, so they build the same command,
and the engine runs it once. Projects run in parallel, each with its own
install and config.

- With no file of the project selected out, the run lints the project as a
  whole (`eslint .`, nested projects ignored), the same command `lint` on a
  project runs.
- Otherwise it names the selected files, sorted (`eslint a.js b.js`), and
  files left out are not linted.

ESLint runs with `--format json` and any exit code. Its report is indexed
once, by a small Node script in a pinned `node:24.11.1-alpine3.22` image
(not your base, which need not hold a Node it can run), into a small result
per selected file, so each check reads only its
own, however large the report. A file's check fails when ESLint reports an
error in it, listing its messages (warnings do not fail it). Every selected
file of the project fails together when the step before ESLint fails
(`install failed (pnpm install, exit 1)`), when ESLint itself cannot run
(`eslint failed (exit 2)`, such as a config that does not load, or `eslint
is not installed`), or when the whole-project run finds errors in a file
without a check. Logs belong to the check that started the shared run; the
others share its result.

Run the check with `dagger check`, in CI especially: `dagger call` on a check
function does not fail the command when the check fails.

The flags for this module (see `dagger check --help`):

| Flag                      | Selects                                |
| ------------------------- | -------------------------------------- |
| `--eslint`, `--by-eslint` | checks from this module                |
| `--eslint-project=PATH`   | one project (repeatable)               |
| `--eslint-file=PATH`      | one file (repeatable)                  |
| `--check NAME`            | checks with that name, in every module |

The short flags `--eslint-project` and `--eslint-file` stay as long as no
other installed module has an item type with the same name. `dagger check --help` lists the flags in
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

`projects(ws)` returns a collection of projects, and a project's
`files(ws)` a collection of its files. Use `keys`, `get(key:)` and
`subset(keys:)` to select them. `lint` on a collection of projects, on a
project and on a collection of files is a plain function, not a check: it
raises one error listing every failing file.

```dang
let projects = eslint.projects(ws)
projects.keys                                    # ["app", "app/packages/ui"]
projects.lint(ws)                                # lint every project
projects.subset(keys: ["app"]).lint(ws)
projects.get(key: "app").lint(ws)                # one whole project
let files = projects.get(key: "app").files(ws)
files.subset(keys: ["app/a.js", "app/b.js"]).lint(ws)  # named files, one run
projects.get(key: "app").fix(ws)                 # its fixes, as a Changeset
```

There is no `batch` namespace. A file's `lint` is the check; called
directly, it takes the file collection to share its run with as
`selection`, which only `dagger check` filters for you:

```dang
run(files.get(key: "app/a.js").lint(ws, selection: files))
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
