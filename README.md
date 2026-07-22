# eslint

A [Dagger](https://dagger.io) toolchain — written in the `.dang` module
language — that lints your project with [ESLint](https://eslint.org), using
your project's own ESLint configuration and version.

## Functions

| Function | Description                                                    |
| -------- | -------------------------------------------------------------- |
| `lint`   | Lint the source (a `@check`).                                  |
| `fix`    | Fix linting issues; returns the changes as a `Changeset`.      |

## Usage

Install the module in your workspace:

```sh
dagger install github.com/dagger/eslint
```

Run the lint check:

```sh
dagger check              # run every check in the workspace
dagger check eslint:lint  # just the ESLint check
```

Fix linting issues — returns a changeset; approve it to apply the fixes to
your workspace (or pass `-y` to auto-apply):

```sh
dagger api call eslint fix
```

## Working directory awareness

Functions run from your current working directory within the workspace. The
whole workspace is mounted — so shared configuration like a root
`.eslintrc.*` or `eslint.config.*` still resolves — but ESLint itself runs
from the directory you invoke `dagger` from. Run from the workspace root to
cover everything, or from a subdirectory to scope `lint` and `fix` to that
subtree.

## Customization

The toolchain can be customized in your `dagger.json` to meet your needs:

```json
{
  "name": "my-module",
  "engineVersion": "...",
  "toolchains": [
    {
      "name": "eslint",
      "source": "github.com/dagger/eslint@main",
      "pin": "...",
      "customizations": [
        {
          "argument": "baseImageAddress",
          "default": "node:22"       # default: node:25-alpine; use any container image
        },
        {
          "argument": "packageManager",
          "default": "yarn"          # default: npm; alternatively use yarn, pnpm, or bun
        }
      ]
    }
  ]
}
```
