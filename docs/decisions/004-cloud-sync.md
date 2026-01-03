# ADR-004: Google Drive sync with shared folder

## Status

Accepted

## Context

Projects need cloud sync for:
- Cross-device access
- Backup
- Data aggregation in seneschal dashboard

Sync approaches considered:
1. Shared Google Drive folder (all projects sync to same folder)
2. Separate folders + manifest (each project has own folder)
3. Custom backend (server-side sync)

## Decision

Use a shared Google Drive folder where each project writes its own data file.

## Rationale

**Simplicity**: User picks one folder, all projects use it. No manifest
management or multiple folder selections.

**Independence preserved**: Each project only reads/writes its own
`{domain}-data.json`. Projects don't depend on each other at runtime.

**Easy aggregation**: Seneschal can read all `*-data.json` files from the same
folder for dashboard display.

**Existing pattern**: This matches scribe's current Google Drive integration,
so the sync engine can be reused.

**No backend**: Static hosting on GitHub Pages means no server-side sync.
Google Drive provides the "backend" for free.

## Folder structure

```
seneschal-sync/
├── seneschal-data.json
├── gardener-data.json
├── trainer-data.json
├── soapmaker-data.json
└── attachments/
    ├── seneschal/
    ├── gardener/
    ├── trainer/
    └── soapmaker/
```

## Consequences

- Single OAuth flow per browser session
- All projects share Google Drive storage quota
- User must grant Drive access on first use of any project
