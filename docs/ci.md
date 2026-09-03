# CI and package verification

The repository's active `CI` workflow verifies every pull request and every push to `main`. It does not publish packages or create releases.

## Deployed contract

Source: [`.github/workflows/ci.yml`](https://github.com/Shevanio/shevanio-engram/blob/main/.github/workflows/ci.yml)

| Item | Live contract |
| ---- | ------------- |
| Triggers | Every `pull_request`; pushes to `main` |
| Required job | `verify` |
| Runner | `ubuntu-latest` |
| Node.js | 22 |
| Install | `npm install --ignore-scripts --no-package-lock --no-audit --no-fund` |
| Tests | `npm test` |
| Package check | `npm pack --dry-run --json` |
| Workflow permissions | `contents: read` only |

GitHub Actions is enabled, the workflow is active, and the repository's default workflow token permission is read-only. The workflow cannot approve pull requests.

## Run the local equivalent

```bash
npm install --ignore-scripts --no-package-lock --no-audit --no-fund
npm test
npm pack --dry-run --json
```

For a consumer-facing preflight that guarantees package lifecycle scripts do not run, use:

```bash
npm pack --dry-run --json --ignore-scripts
```

Both pack commands are dry runs. They must report `LICENSE`, `NOTICE`, and `TRADEMARKS.md`, omit `assets/engram-logo-only.png`, and leave no `.tgz` file.

## Main branch protection

`main` requires the exact live `verify` check with strict, up-to-date status checks. The rule applies to administrators. Force pushes and branch deletion are disabled, and there is no required approval count.

Inspect the live rule with:

```bash
gh api repos/Shevanio/shevanio-engram/branches/main/protection
```

## Publication boundary

This repository has no publish workflow or release automation. CI installs dependencies, runs tests, and performs a package dry run only. It does not call `npm publish`, create tags or GitHub releases, configure environments, or use publishing credentials.
