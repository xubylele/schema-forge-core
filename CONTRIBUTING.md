# Contributing to Schema Forge Core

Thank you for contributing.

## Principles

- Keep logic pure
- No file system access
- No provider-specific coupling
- Deterministic outputs
- Strong typing required

## Development Setup

1. Clone the repository
2. Install dependencies
3. Run tests before submitting PR

```bash
npm install
npm test
```

## Pull Requests

- Small, focused PRs
- Include tests
- Do not modify public API without discussion
- Follow existing folder structure

## What Not To Do

- Do not add CLI logic
- Do not introduce DB drivers
- Do not introduce ORM dependencies

## Commit Style

Use conventional commits:

- feat:
- fix:
- refactor:
- test:
- chore:

Example:

```bash
feat(diff): detect column type changes
```
