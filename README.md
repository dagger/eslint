# eslint

A [Dagger](https://dagger.io) toolchain — written in the `.dang` module
language — that lints your project with [ESLint](https://eslint.org), using
your project's own ESLint configuration and version.

## Projects

The toolchain lints each **ESLint project** in your workspace separately. A
project is a directory holding an ESLint config — a flat config
(`eslint.config.{js,mjs,cjs,ts,mts,cts}`) or a legacy `.eslintrc`,
`.eslintrc.{js,cjs,json,yaml,yml}` — keyed by its path from the workspace
root (`.` for the root). `node_modules` is never searched.

Projects are discovered from your current working directory: every project at
or below it, plus the enclosing project when the directory holds no config of
its own. List them with:

```sh
dagger list eslint-projects -a
```

Each project is linted from its own directory. Projects nested inside it are
ignored there (`--ignore-pattern <nested>/**`) and linted on their own, with
their own config, so no file is linted twice.

Dependencies are installed from the nearest `package.json` at or above the
project, using the configured package manager, with the whole workspace
mounted so shared configuration still resolves. When there is no
`package.json`, the install is skipped and `npx` fetches ESLint on demand — a
standalone ESLint config works without a Node project.

## Usage

Install the module in your workspace:

```sh
dagger install github.com/dagger/eslint
```

Run the lint check:

```sh
dagger check                                    # run every check in the workspace
dagger check --eslint                           # every ESLint project
dagger check eslint/projects/lint               # the same, by address
dagger check --eslint --eslint-project=web      # one project (repeatable)
dagger check -l --all --eslint                  # list one line per project
```

All selected projects are linted in parallel, and every failing project is
reported.

The key flag is `--eslint-project` while no other installed module has an item
type with the same name; `dagger check --help` lists the flags in effect.

### Fixing

Each project has a `fix` function that runs `eslint --fix` and returns the
changes as a `Changeset`, rooted at your working directory. Problems ESLint
cannot fix are left in place for `lint` to report. `fix` is not a generator,
so it adds no check to `dagger check`; call it from another module, e.g.
`eslint.projects(ws).get(key: "web").fix(ws)`.

## Customization

Configure the toolchain with settings in your workspace `dagger.toml`:

```toml
[modules.eslint]
source = "github.com/dagger/eslint"
settings.baseImageAddress = "node:22"   # default: node:25-alpine; any image with Node
settings.packageManager = "yarn"        # default: npm; also yarn, pnpm or bun
```

Or with `dagger settings eslint baseImageAddress node:22`.

## Requirements

Dagger engine `v1.0.0-beta.15` or later.
