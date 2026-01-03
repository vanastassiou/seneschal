# ADR-001: Separate repositories per domain

## Status

Accepted

## Context

The system consists of multiple domain projects (gardener, trainer, soapmaker)
plus a central dashboard (seneschal). We need to decide how to organize the
code.

Options considered:
1. Monorepo with all projects as packages
2. Separate repositories per project

## Decision

Use separate repositories for each domain project.

## Rationale

**GitHub Pages constraint**: Each GitHub Pages site requires its own repository.
A monorepo would result in a single deployment URL, preventing independent
hosting of each domain project.

**Independence**: Domain projects should function without each other. Separate
repos enforce this boundary at the version control level.

**Release cycles**: Each project can be versioned and released independently.

**Simplicity**: For a personal project, managing separate small repos is simpler
than monorepo tooling (nx, turborepo, lerna).

## Consequences

- Shared code requires a mechanism (git submodule chosen)
- Cross-project changes require multiple commits
- Each repo needs its own CI/CD configuration
