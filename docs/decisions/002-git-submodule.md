# ADR-002: Git submodule for shared code

## Status

Accepted

## Context

With separate repositories, we need a mechanism to share:
- Base schemas (plan, implementation, common definitions)
- Sync engine (OAuth, Google Drive provider, merge logic)
- TypeScript types

Options considered:
1. npm package (publish to npm or GitHub Packages)
2. Git submodule
3. Copy-paste (duplicate code in each repo)

## Decision

Use a git submodule (`seneschal-core`) included in each project.

## Rationale

**No publish step**: Submodules update with a simple `git pull`. No need to
version, publish, and update dependencies.

**Atomic changes**: When developing, you can modify shared code and consuming
project in the same session, then commit both.

**Visibility**: Shared code is visible in the project directory, not hidden in
`node_modules`.

**Simplicity**: For a personal project with one developer, submodules provide
the right balance of sharing without ceremony.

## Trade-offs

npm package would be better if:
- Multiple developers needed isolated versioning
- Semantic versioning of shared code was required
- Projects needed to pin specific versions

## Consequences

- Each project includes `core/` directory pointing to seneschal-core
- GitHub Actions workflow needs `submodules: true` in checkout
- Developers must run `git submodule update --init` after clone
