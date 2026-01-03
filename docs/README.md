# Seneschal documentation

## Architecture

- [Overview](architecture/overview.md) - System design and data flow

## Design decisions

Architectural Decision Records (ADRs) documenting key choices:

| ADR | Title | Status |
| --- | ----- | ------ |
| [001](decisions/001-separate-repos.md) | Separate repositories per domain | Accepted |
| [002](decisions/002-git-submodule.md) | Git submodule for shared code | Accepted |
| [003](decisions/003-vanilla-js.md) | Keep vanilla JavaScript | Accepted |
| [004](decisions/004-cloud-sync.md) | Google Drive sync with shared folder | Accepted |
| [005](decisions/005-single-oauth-app.md) | Single OAuth application | Accepted |
| [006](decisions/006-merge-strategy.md) | Last-write-wins merge strategy | Accepted |
| [007](decisions/007-scribe-merged.md) | Merge scribe into seneschal | Accepted |

## Implementation guides

- [Adding sync to existing projects](implementation/adding-sync.md)
- [Existing project analysis](implementation/existing-projects.md)
