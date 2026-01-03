# seneschal-core

Shared sync engine and schemas for seneschal projects (gardener, trainer, soapmaker).

## Overview

This module provides:

- **Sync engine**: Bidirectional sync with Google Drive
- **OAuth flow**: Google OAuth 2.0 with PKCE
- **Base schemas**: Common JSON schemas for all projects
- **Merge logic**: Last-write-wins conflict resolution

## Installation

Add as a git submodule in your project:

```bash
git submodule add https://github.com/v/seneschal-core.git core
```

For local development without pushing to GitHub:

```bash
# Create a symlink instead
ln -s /path/to/seneschal-core core
```

## Sync engine

```javascript
import { createSyncEngine, createGoogleDriveProvider } from './core/js/index.js';

// Create provider
const provider = createGoogleDriveProvider({
  domain: 'gardener',
  clientId: 'your-google-client-id',
  apiKey: 'your-google-api-key',
  redirectUri: window.location.origin + window.location.pathname
});

// Create sync engine
const sync = createSyncEngine({
  provider,
  domain: 'gardener',
  getLocalData: () => state.exportData(),
  setLocalData: (data) => state.importData(data)
});

// Check for OAuth callback on page load
if (hasOAuthCallback()) {
  await provider.handleAuthCallback();
}

// Connect to Google Drive
await provider.connect();

// Select sync folder
await provider.selectFolder();

// Sync
const result = await sync.sync();
```

## OAuth

```javascript
import { isAuthenticated, hasOAuthCallback } from './core/js/index.js';

// Check auth status
if (isAuthenticated('google')) {
  // Already connected
}

// Handle OAuth callback (check on page load)
if (hasOAuthCallback()) {
  await provider.handleAuthCallback();
}
```

## Schemas

Base schemas for plan/implementation pattern:

- `schemas/common-definitions.schema.json` - Shared types (UUID, timestamp, tags)
- `schemas/plan.schema.json` - Base plan schema
- `schemas/implementation.schema.json` - Base implementation schema

## Data format

Each domain syncs to `{domain}-data.json`:

```json
{
  "domain": "gardener",
  "version": 1,
  "data": { ... },
  "lastModified": "2025-01-03T12:00:00.000Z"
}
```

## Folder structure

All projects sync to a shared Google Drive folder:

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

## Setting up OAuth

### 1. Create Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "seneschal-suite")
3. Enable these APIs:
   - Google Drive API
   - Google Picker API

### 2. Create OAuth credentials

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "OAuth client ID"
3. Application type: Web application
4. Name: "seneschal-suite"
5. Authorized JavaScript origins:
   - `http://localhost:8080` (for development)
   - `https://yourusername.github.io` (for production)
6. Click Create and copy the Client ID

### 3. Create API key

1. Click "Create Credentials" > "API key"
2. Restrict the key to Google Drive API and Picker API
3. Copy the API key

### 4. Add credentials to your app

Create a config file in your project (add to `.gitignore`):

```javascript
// js/lib/config.js
export const config = {
    google: {
        clientId: 'your-client-id.apps.googleusercontent.com',
        apiKey: 'your-api-key'
    },
    redirectUri: window.location.origin + window.location.pathname
};
```

## How sync works

1. **Connect**: User clicks Connect, OAuth flow starts
2. **Select folder**: User picks or creates `seneschal-sync` folder
3. **Sync**:
   - Fetch remote `{domain}-data.json`
   - Compare `lastModified` timestamps
   - Merge using last-write-wins
   - Push updated data back to Drive
4. **Status**: UI shows sync status (idle, syncing, synced, error)

## Architecture

```
js/
├── index.js           # Main exports
├── sync/
│   └── index.js       # Sync engine with merge logic
├── providers/
│   ├── google-drive.js   # Google Drive provider
│   └── google-picker.js  # Folder picker
└── oauth/
    └── index.js       # OAuth 2.0 PKCE flow
```

## Development

This is a shared module. To test changes:

1. Make changes in seneschal-core
2. Test in a consuming project (gardener, trainer, etc.)
3. Commit changes to both repos
