# Seneschal architecture refactor

## Overview

Add cloud sync to existing domain projects and create seneschal as a central
dashboard. Each project remains independent and deployable to GitHub Pages.

## Decisions

| Decision | Choice |
| -------- | ------ |
| Repo structure | Separate repos per domain |
| Shared code | Git submodule (`seneschal-core`) |
| Tech stack | Vanilla JS for existing projects, Astro optional for seneschal |
| Scribe | Merged into seneschal |
| Hosting | GitHub Pages + GitHub Actions |
| Cloud sync | Google Drive, shared folder |
| Sync code | Extracted from scribe to seneschal-core |

See [docs/decisions/](docs/decisions/) for detailed rationale.

## Target structure

```
github.com/v/
├── seneschal-core/     # Shared schemas + sync engine (submodule)
├── seneschal/          # Dashboard + ideas (scribe merged)
├── gardener/           # Garden planner (existing, add sync)
├── trainer/            # Exercise tracker (existing, add sync)
└── soapmaker/          # Soap calculator (existing, add sync)
```

## Cloud sync architecture

All projects sync to one Google Drive folder:

```
Google Drive/
└── seneschal-sync/
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

---

## Phase 1: Create seneschal-core

Create shared repo with schemas and sync engine extracted from scribe.

### Structure

```
seneschal-core/
├── schemas/
│   ├── common-definitions.schema.json
│   ├── plan.schema.json
│   └── implementation.schema.json
├── js/
│   ├── sync/
│   │   ├── index.js              # Main sync engine
│   │   └── merge.js              # Last-write-wins merge
│   ├── providers/
│   │   ├── index.js              # Provider interface
│   │   └── google-drive.js       # Google Drive implementation
│   ├── oauth/
│   │   └── index.js              # OAuth2 PKCE flow
│   └── attachments/
│       └── index.js              # Attachment sync
├── package.json
└── README.md
```

### Files to extract from scribe

| Scribe path | Core path |
| ----------- | --------- |
| `js/sync.js` | `js/sync/index.js` |
| `js/providers/google-drive.js` | `js/providers/google-drive.js` |
| `js/oauth.js` | `js/oauth/index.js` |
| `js/attachment-sync.js` | `js/attachments/index.js` |

### Modifications needed

1. Make domain-agnostic (pass domain name as config)
2. Export as ES modules
3. Add provider interface for extensibility

---

## Phase 2: Create seneschal dashboard

New project for dashboard and idea capture (scribe merged).

### Structure

```
seneschal/
├── core/                           # Git submodule -> seneschal-core
├── index.html
├── js/
│   ├── main.js                     # Entry point
│   ├── state/
│   │   └── state.js                # Reactive state
│   ├── ui/
│   │   ├── dashboard.js            # Project status overview
│   │   ├── ideas.js                # Idea capture (scribe)
│   │   └── settings.js             # Sync settings
│   └── lib/
│       ├── config.js               # OAuth credentials (gitignored)
│       └── constants.js
├── css/
│   └── styles.css
├── data/
│   └── schemas/
│       ├── idea.schema.json
│       └── engagement.schema.json
├── docs/                           # Architecture and decisions
└── .github/
    └── workflows/
        └── deploy.yml
```

### Dashboard features

1. **Sync Projects**: Fetch all `*-data.json`, display summary
2. **Quick Stats**: Plans active, sessions logged, ideas captured
3. **Recent Activity**: Timeline across all domains
4. **Idea Inbox**: Quick capture + list

### Idea types (from scribe)

- **Project**: Interest level, effort, resources, deadline, status
- **Media**: Type, recommender, URL, status, rating
- **Note**: Freeform text with tags

---

## Phase 3: Add sync to gardener

Existing vanilla JS project. Add sync without rewriting.

### Changes

1. Add seneschal-core as submodule
2. Create `js/lib/config.js` (gitignored) with OAuth client ID
3. Modify `js/lib/persistence.js`:
   - Import sync engine
   - Add `syncState()` function
   - Call sync after save (debounced)
4. Add sync UI to settings panel:
   - Connect/disconnect Google Drive
   - Manual sync button
   - Sync status indicator

### Data export format

```javascript
{
  version: 1,
  domain: 'gardener',
  updatedAt: '2025-01-03T...',
  data: {
    seeds: [...],
    climateSettings: {...}
  }
}
```

---

## Phase 4: Add sync to trainer

Existing vanilla JS project with IndexedDB storage.

### Changes

1. Add seneschal-core as submodule
2. Create `js/lib/config.js` with OAuth client ID
3. Modify `js/db.js`:
   - Add `exportAllData()` and `importAllData()`
   - Aggregate all stores into single export
4. Create `js/sync-integration.js`:
   - Import sync engine
   - Bridge between sync engine and db.js
5. Add sync UI to settings

### Data export format

```javascript
{
  version: 1,
  domain: 'trainer',
  updatedAt: '2025-01-03T...',
  data: {
    journals: [...],
    programs: [...],
    goals: [...],
    profile: {...}
  }
}
```

---

## Phase 5: Add sync to soapmaker

Existing vanilla JS project with localStorage.

### Changes

1. Add seneschal-core as submodule
2. Create `js/lib/config.js` with OAuth client ID
3. Modify `js/state/state.js`:
   - Add export/import methods for sync
   - Call sync after state changes (debounced)
4. Add sync UI to settings

### Data export format

```javascript
{
  version: 1,
  domain: 'soapmaker',
  updatedAt: '2025-01-03T...',
  data: {
    recipe: [...],
    recipeAdditives: [...],
    cupboardFats: [...],
    excludedFats: [...]
  }
}
```

---

## Implementation order

1. **seneschal-core**: Extract sync engine from scribe
2. **gardener**: Add sync (test pattern)
3. **trainer**: Add sync
4. **soapmaker**: Add sync
5. **seneschal**: Create dashboard with scribe merged

---

## Files to migrate from current seneschal/schemas

| Current path | Destination |
| ------------ | ----------- |
| `common-definitions.schema.json` | seneschal-core |
| `plan.schema.json` | seneschal-core |
| `implementation.schema.json` | seneschal-core |
| `scribe/plan.schema.json` | seneschal `data/schemas/idea.schema.json` |
| `scribe/implementation.schema.json` | seneschal `data/schemas/engagement.schema.json` |
| `gardener/*` | Already in gardener repo |
| `trainer/*` | Already in trainer repo |
| `soapmaker/*` | Already in soapmaker repo |

---

## GitHub Actions workflow (for projects needing build)

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

---

## OAuth setup

Single Google Cloud project shared by all domains:

1. Create project in Google Cloud Console (e.g., "seneschal-suite")
2. Enable Google Drive API and Google Picker API
3. Create OAuth 2.0 Client ID (Web application)
4. Add authorized JavaScript origins:
   - `https://v.github.io`
   - `http://localhost:8080` (development)
5. Store client ID in each project's `js/lib/config.js` (gitignored)
