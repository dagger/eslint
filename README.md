# Eslint Dagger Toolchain

## Installation

```
dagger toolchain install github.com/dagger/eslint
```

## Functions

- `lint`: Lint the source.
- `fix`: Fix linting issues.

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
          "argument": "source",
          "defaultPath": "/src",         # default: /; custom default path
          "ignore": ["**/node_modules"]  # custom ignore filter
        },
        {
          "argument": "baseImageAddress",
          "defaultPath": "node:22"       # default: node:25-alpine; use any container image 
        },
        {
          "argument": "packageManager",
          "defaultPath": "yarn"          # default: npm; alternatively use yarn, pnpm, or bun
        }
      ]
    }
  ]
}
```
