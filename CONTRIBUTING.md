# Contributing to Schema Forge Core

Thank you for contributing to Schema Forge Core.

This package represents the deterministic domain engine of Schema Forge. Contributions must preserve its purity, stability, and architectural boundaries.

---

## Core Principles

All contributions must follow these rules:

* **Pure logic only** (no hidden side effects)
* **No file system access in core modules**
* **No provider-specific coupling inside domain logic**
* **Deterministic outputs** (same input → same output)
* **Strong TypeScript typing required**
* **No runtime state mutation outside defined state models**

If a feature requires I/O, CLI behavior, environment access, or provider customization, it likely belongs in a higher-level package — not in `schema-forge-core`.

---

## Architecture Boundaries

Before submitting a change, verify:

### Allowed in Core

* DSL parsing logic
* Schema normalization
* Diff algorithm improvements
* Validation rules
* SQL generation logic (provider abstraction respected)
* SQL parsing into abstract operations
* State modeling and transformations

### Not Allowed in Core

* CLI commands
* File watchers
* Database drivers
* ORM integrations
* Environment-based branching
* Logging frameworks
* Direct filesystem writes in domain modules

Node-only utilities must remain isolated from pure domain logic.

---

## Development Setup

1. Clone the repository
2. Install dependencies
3. Run tests before submitting a PR

```bash
npm install
npm test
```

If you modify core logic, ensure:

* Existing tests pass
* New behavior includes test coverage
* Edge cases are covered

---

## Pull Request Guidelines

* Keep PRs small and focused
* Include meaningful tests
* Avoid unrelated refactors
* Do not modify public API without prior discussion
* Follow existing folder and naming conventions
* Preserve backward compatibility unless explicitly discussed

If introducing breaking changes:

* Open an issue first
* Provide migration rationale
* Update relevant documentation

---

## Testing Expectations

* Unit tests required for new logic
* Determinism must be validated
* Avoid snapshot tests unless necessary
* Prefer explicit structural assertions over loose equality checks

---

## Commit Style

Use Conventional Commits:

* `feat:`
* `fix:`
* `refactor:`
* `test:`
* `chore:`

Example:

```bash
feat(diff): detect column type changes
```

Commit messages should describe *intent*, not implementation detail.

---

## Code Quality Standards

* Explicit types (avoid `any`)
* Avoid implicit casting
* No unused exports
* Keep functions small and composable
* Prefer explicit transformations over mutation

---

## Discussion Before Major Changes

Open a discussion or issue if you plan to:

* Introduce new DSL syntax
* Change state file structure
* Modify diff algorithm semantics
* Add or alter provider behavior
* Introduce breaking API changes

Core stability is critical. Architectural integrity comes first.

---

Thank you for helping maintain the integrity of Schema Forge Core.
