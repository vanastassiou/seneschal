# ADR-005: Single OAuth application for all projects

## Status

Accepted

## Context

Each project needs OAuth to access Google Drive. Options:
1. Single OAuth app shared by all projects
2. Separate OAuth app per project

## Decision

Use a single Google Cloud project with one OAuth client ID shared by all
domain projects.

## Rationale

**Simpler setup**: One Google Cloud project to configure instead of four.

**User experience**: User sees one consent screen mentioning the app name,
not multiple different apps.

**No runtime dependency**: The OAuth client ID is just a configuration string.
Projects don't call each other or share tokens.

**Token isolation**: Each project runs on its own origin (GitHub Pages URL),
so tokens are stored separately per origin in the browser. Projects can't
access each other's tokens.

## Configuration

Google Cloud Console setup:
1. Create project: "seneschal-suite"
2. Enable APIs: Google Drive, Google Picker
3. Create OAuth 2.0 Client ID (Web application)
4. Authorized JavaScript origins: `https://v.github.io`
5. Store client ID in each project's config (gitignored)

## Consequences

- Single point of configuration in Google Cloud Console
- If OAuth app is deleted, all projects lose sync (unlikely for personal use)
- Adding a new domain project requires updating authorized origins
