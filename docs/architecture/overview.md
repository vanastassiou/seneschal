# Architecture overview

## System design

Seneschal is a personal project management system with four domain projects and
a central dashboard.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Google Drive                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ seneschal-sync/                                              ││
│  │   ├── seneschal-data.json                                   ││
│  │   ├── gardener-data.json                                    ││
│  │   ├── trainer-data.json                                     ││
│  │   ├── soapmaker-data.json                                   ││
│  │   └── attachments/{domain}/                                 ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
         ▲           ▲           ▲           ▲
         │           │           │           │
    ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
    │seneschal│ │gardener │ │ trainer │ │soapmaker│
    │dashboard│ │         │ │         │ │         │
    └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
         │           │           │           │
         └───────────┴───────────┴───────────┘
                          │
                          ▼
                 ┌────────────────┐
                 │ seneschal-core │
                 │   (submodule)  │
                 └────────────────┘
```

## Repositories

| Repo | Purpose | URL pattern |
| ---- | ------- | ----------- |
| seneschal-core | Shared schemas, sync engine, types | (submodule only) |
| seneschal | Dashboard + idea capture | `v.github.io/seneschal` |
| gardener | Garden planner + knowledge | `v.github.io/gardener` |
| trainer | Exercise tracker + knowledge | `v.github.io/trainer` |
| soapmaker | Soap calculator + knowledge | `v.github.io/soapmaker` |

## Independence principle

Each domain project:
- Has its own repository
- Deploys independently to GitHub Pages
- Stores data in its own IndexedDB/localStorage
- Syncs only its own `{domain}-data.json`
- Works fully offline without other projects

Seneschal is the only project that reads data from multiple domains (for the
dashboard). If seneschal doesn't exist, domain projects still function.

## Data flow

1. User interacts with domain project (e.g., gardener)
2. Changes saved to local IndexedDB
3. On sync, local data merged with Google Drive
4. Seneschal can read all `*-data.json` files for aggregation
