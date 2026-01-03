# ADR-007: Merge scribe into seneschal

## Status

Accepted

## Context

The domain project pattern is:
- Interactive tool + knowledge repository
- Examples: gardener (planner + gardening knowledge), trainer (tracker +
  fitness knowledge), soapmaker (calculator + soap knowledge)

Scribe doesn't fit this pattern:
- It captures ideas across all domains
- It has no domain-specific knowledge
- Ideas in scribe often spawn projects in other domains

## Decision

Merge scribe functionality into seneschal instead of maintaining it as a
separate project.

## Rationale

**Natural fit**: A seneschal (steward) manages current work AND receives
requests for new work. Capturing ideas fits the dashboard role.

**Workflow alignment**: Ideas captured in seneschal can naturally flow to
domain projects when they mature.

**Reduced project count**: One less repository to maintain.

**No knowledge domain**: Scribe has no expertise to encapsulate. It's purely
organizational, which matches seneschal's purpose.

## What seneschal becomes

1. **Dashboard**: View status of all domain projects
2. **Idea inbox**: Capture project ideas, media recommendations, notes
3. **Aggregator**: Pull data from domain projects for unified view

## Scribe features preserved

- Three idea types: project, media, note
- Status tracking (someday, planned, active, completed, dropped)
- Tags and attachments
- Cloud sync via Google Drive

## Consequences

- Scribe repository will be archived or deleted
- Existing scribe data needs migration path to seneschal
- Seneschal becomes more than a passive dashboard
