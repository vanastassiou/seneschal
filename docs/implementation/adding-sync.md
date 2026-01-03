# Adding sync to existing projects

This guide describes how to add Google Drive sync to an existing vanilla JS
project using seneschal-core.

## Prerequisites

- Existing project with state management
- Data stored in localStorage or IndexedDB
- seneschal-core added as git submodule

## Step 1: Add submodule

```bash
git submodule add https://github.com/v/seneschal-core.git core
```

## Step 2: Create config file

Create `js/lib/config.js` (gitignored):

```javascript
export const OAUTH_CLIENT_ID = 'your-google-oauth-client-id';
export const DOMAIN = 'gardener'; // or trainer, soapmaker, seneschal
```

Add to `.gitignore`:

```
js/lib/config.js
```

## Step 3: Import sync engine

In your main entry point:

```javascript
import { SyncEngine } from './core/src/sync/index.js';
import { GoogleDriveProvider } from './core/src/providers/google-drive.js';
import { OAUTH_CLIENT_ID, DOMAIN } from './lib/config.js';

const provider = new GoogleDriveProvider({
  clientId: OAUTH_CLIENT_ID,
  domain: DOMAIN
});

const sync = new SyncEngine({
  provider,
  domain: DOMAIN,
  getLocalData: () => state.exportData(),
  setLocalData: (data) => state.importData(data)
});
```

## Step 4: Add UI controls

Add sync button and status indicator:

```html
<button id="sync-btn" class="sync-button">
  <span class="sync-icon"></span>
  Sync
</button>
<span id="sync-status"></span>
```

## Step 5: Wire up events

```javascript
const syncBtn = document.getElementById('sync-btn');
const syncStatus = document.getElementById('sync-status');

// Initial auth check
if (sync.isAuthenticated()) {
  syncStatus.textContent = 'Connected';
}

// Sync button click
syncBtn.addEventListener('click', async () => {
  if (!sync.isAuthenticated()) {
    await sync.authenticate();
    await sync.selectFolder();
  }

  syncStatus.textContent = 'Syncing...';
  try {
    await sync.sync();
    syncStatus.textContent = 'Synced ' + new Date().toLocaleTimeString();
  } catch (error) {
    syncStatus.textContent = 'Sync failed';
    console.error('Sync error:', error);
  }
});
```

## Step 6: Auto-sync on changes

Optionally sync after state changes:

```javascript
// Debounced auto-sync
let syncTimeout;
state.subscribeAll(() => {
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    if (sync.isAuthenticated()) {
      sync.sync().catch(console.error);
    }
  }, 30000); // Sync 30 seconds after last change
});
```

## Data format requirements

Your state's `exportData()` must return:

```javascript
{
  version: 1,
  domain: 'gardener',
  updatedAt: new Date().toISOString(),
  data: {
    // Your domain-specific data
  }
}
```

Your state's `importData(data)` must handle this format and update local state.

## Testing locally

1. Serve project with HTTPS (required for OAuth)
2. Use `localhost` origin in Google Cloud Console
3. Test sync flow: authenticate, select folder, sync

## Settings UI

Add a settings panel for:
- Connect/disconnect Google Drive
- Change sync folder
- Manual sync trigger
- Last sync timestamp
- Export/import backup JSON
