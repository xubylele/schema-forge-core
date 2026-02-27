# Releasing Schema Forge Core

This document describes the release flow for `@xubylele/schema-forge-core` using a protected `main` branch and npm publication triggered by version tags.

The core package is the deterministic domain engine of Schema Forge. Releases must preserve API stability and architectural boundaries.

---

## Repository Rules

* All changes must go through Pull Requests to `main`.
* Direct commits to `main` are not allowed.
* The required status check is the **Test** job from the CI workflow.
* Public API changes require explicit review.

---

## Recommended Release Flow

### 1) Development and Pull Request

1. Create a branch from `main`.
2. Implement changes.
3. Add a changeset:

```bash
npx changeset
```

1. Open a PR to `main`.
2. Wait for CI (`Test` job) to pass.

PRs must include:

* Tests for new logic
* Updated types if needed
* Changeset entry
* No unrelated refactors

---

### 2) Versioning (Before Merge)

Version bump and changelog must be part of the PR being merged.

Recommended (Changesets):

```bash
npx changeset version
```

This updates:

* `package.json`
* `CHANGELOG.md`

Commit these changes in the PR branch and merge via Pull Request.

Manual versioning (if required):

* Update `package.json`
* Update `CHANGELOG.md`
* Commit before merge

---

### 3) Publication by Tag

Publishing to npm is triggered by pushing tags matching `v*` using `.github/workflows/publish.yml`.

Ensure you are on the correct commit in `main`:

```bash
VERSION=$(node -p "require('./package.json').version")
git tag "v$VERSION"
git push origin "v$VERSION"
```

When the tag is pushed, the workflow performs:

1. `npm ci`
2. `npm run build`
3. `npm publish --access public`

No direct commits are made by the workflow.

---

## Workflows

### `.github/workflows/ci.yml`

* Trigger: `pull_request` to `main`
* Required job: `Test`
* Steps:

  * `npm ci`
  * `npm test`
  * `npm run build`

---

### `.github/workflows/release-on-main.yml`

* Trigger: `push` to `main`
* Performs validation only
* Does not create commits or push changes

---

### `.github/workflows/publish.yml`

* Trigger: `push` of tags matching `v*`
* Publishes to npm using Trusted Publishing (OIDC)

Permissions required in workflow:

```yaml
permissions:
  contents: read
  id-token: write
```

---

## npm Configuration (Trusted Publishing)

This repository uses npm Trusted Publishing.

Requirements:

* Configure the GitHub repository in npm package settings
* Enable OIDC-based publishing
* No `NPM_TOKEN` required

The workflow relies on `id-token: write` to perform OIDC exchange.

---

## If You Use 2FA on npm

Trusted Publishing does not require interactive OTP in CI.

If manual publishing is required by policy:

1. Follow the same versioning and tagging flow.
2. Run `npm publish` locally after creating the tag.

---

## Breaking Changes Policy

If introducing a breaking change:

* Open an issue first
* Document migration impact
* Use `major` changeset
* Update README if necessary

Core API stability is critical.

---

## Release Checklist

1. PR with changes + changeset/versioning
2. CI `Test` passing
3. Merge PR to `main`
4. Create and push tag `vX.Y.Z`
5. Verify `publish.yml` execution
6. Confirm new version on npm

---

Releases of Schema Forge Core must remain deterministic, typed, and backward-compatible unless explicitly versioned as breaking.
