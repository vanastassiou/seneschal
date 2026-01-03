# ADR-003: Keep vanilla JavaScript (no framework migration)

## Status

Accepted

## Context

The existing domain projects (gardener, trainer, soapmaker) are all built with
vanilla JavaScript:
- No build step required
- Native ES6 modules
- Custom reactive state management
- Direct DOM manipulation

The original plan proposed migrating to Astro + Svelte. This decision revisits
that approach.

## Decision

Keep vanilla JavaScript for existing projects. New projects may choose their
stack independently.

## Rationale

**Working code**: All three projects are functional and well-structured. A
framework migration would be a rewrite with no user-facing benefit.

**No build step**: Current projects serve directly from the file system. Adding
a build step increases complexity for deployment and development.

**Consistency**: All existing projects share the same patterns (state.js,
helpers.js, DOM rendering). This makes them easier to maintain together.

**Sync is additive**: Adding Google Drive sync doesn't require a framework. The
sync engine is a JavaScript module that works with any UI approach.

## When to use Astro

Consider Astro for:
- New projects with significant static content (knowledge bases)
- Projects requiring server-side rendering
- Projects where you want component-based architecture from the start

Seneschal (the dashboard) could use Astro since it's being built from scratch
and has simpler UI requirements.

## Consequences

- Existing projects receive sync capability without rewrite
- seneschal-core provides sync as vanilla JS modules
- Each project integrates sync into its existing state management
