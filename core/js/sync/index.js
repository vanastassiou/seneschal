/**
 * Sync engine for seneschal projects
 * Domain-agnostic synchronization with cloud providers
 */

/**
 * Sync status enum
 */
export const SyncStatus = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  ERROR: 'error'
};

/**
 * Create a sync engine for a specific domain
 * @param {Object} config - Sync engine configuration
 * @param {Object} config.provider - Sync provider instance
 * @param {string} config.domain - Domain name
 * @param {Function} config.getLocalData - Function that returns local data
 * @param {Function} config.setLocalData - Function that receives merged data
 * @param {Function} [config.getLastSync] - Optional: get last sync timestamp
 * @param {Function} [config.setLastSync] - Optional: set last sync timestamp
 */
export function createSyncEngine(config) {
  const { provider, domain, getLocalData, setLocalData } = config;

  let status = SyncStatus.IDLE;
  let listeners = [];
  let lastError = null;

  // Default last sync storage
  const getLastSync = config.getLastSync || (() => {
    const stored = localStorage.getItem(`${domain}-lastSync`);
    return stored || null;
  });

  const setLastSync = config.setLastSync || ((timestamp) => {
    localStorage.setItem(`${domain}-lastSync`, timestamp);
  });

  /**
   * Subscribe to status changes
   * @param {Function} listener - Callback(status, error)
   * @returns {Function} Unsubscribe function
   */
  function onStatusChange(listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify listeners of status change
   */
  function notifyStatusChange() {
    listeners.forEach((l) => l(status, lastError));
  }

  /**
   * Get current sync status
   */
  function getStatus() {
    return status;
  }

  /**
   * Get last error
   */
  function getError() {
    return lastError;
  }

  /**
   * Check if sync is possible
   */
  function canSync() {
    return navigator.onLine && provider.isConnected() && provider.isFolderConfigured();
  }

  /**
   * Perform sync
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function sync() {
    if (status === SyncStatus.SYNCING) {
      return { success: false, error: 'Sync already in progress' };
    }

    if (!provider.isConnected()) {
      return { success: false, error: 'Not connected to sync provider' };
    }

    if (!provider.isFolderConfigured()) {
      return { success: false, error: 'No sync folder configured' };
    }

    status = SyncStatus.SYNCING;
    lastError = null;
    notifyStatusChange();

    try {
      // Get local data
      const localData = await getLocalData();
      const lastSync = getLastSync();

      // Fetch remote data
      const remoteResult = await provider.fetch();
      const remoteData = remoteResult.data;

      // Merge
      const merged = mergeData(localData, remoteData, lastSync);

      // Save merged data locally
      await setLocalData(merged.local);

      // Push to remote if there were local changes
      if (merged.hasLocalChanges) {
        await provider.push({
          data: merged.local,
          lastModified: new Date().toISOString()
        });
      }

      // Update last sync time
      setLastSync(new Date().toISOString());

      status = SyncStatus.IDLE;
      notifyStatusChange();

      return { success: true };
    } catch (err) {
      console.error(`Sync failed for ${domain}:`, err);
      status = SyncStatus.ERROR;
      lastError = err.message;
      notifyStatusChange();
      return { success: false, error: err.message };
    }
  }

  /**
   * Merge local and remote data
   * Uses last-write-wins for individual items based on updatedAt
   */
  function mergeData(local, remote, lastSync) {
    // If remote is null/empty, just use local
    if (!remote) {
      return {
        local,
        hasLocalChanges: true
      };
    }

    // If local is null/empty, just use remote
    if (!local) {
      return {
        local: remote,
        hasLocalChanges: false
      };
    }

    // Handle array data (most common case for lists of items)
    if (Array.isArray(local) && Array.isArray(remote)) {
      return mergeArrays(local, remote);
    }

    // Handle object data with items array
    if (local.items && remote.items) {
      const mergedItems = mergeArrays(local.items, remote.items);
      return {
        local: { ...local, ...remote, items: mergedItems.local },
        hasLocalChanges: mergedItems.hasLocalChanges
      };
    }

    // For simple object data, use timestamp comparison
    const localTime = new Date(local.updatedAt || 0).getTime();
    const remoteTime = new Date(remote.updatedAt || 0).getTime();

    if (remoteTime > localTime) {
      return { local: remote, hasLocalChanges: false };
    }

    return { local, hasLocalChanges: localTime > remoteTime };
  }

  /**
   * Merge two arrays of items with id and updatedAt fields
   */
  function mergeArrays(local, remote) {
    const merged = new Map();
    let hasLocalChanges = false;

    // Add all local items
    for (const item of local) {
      merged.set(item.id, item);
    }

    // Merge remote items
    for (const remoteItem of remote) {
      const localItem = merged.get(remoteItem.id);

      if (!localItem) {
        // New from remote
        merged.set(remoteItem.id, remoteItem);
      } else {
        // Conflict resolution: last-write-wins
        const localTime = new Date(localItem.updatedAt || 0).getTime();
        const remoteTime = new Date(remoteItem.updatedAt || 0).getTime();

        if (remoteTime > localTime) {
          merged.set(remoteItem.id, remoteItem);
        } else if (localTime > remoteTime) {
          hasLocalChanges = true;
        }
      }
    }

    // Check for items only in local (new local items)
    for (const item of local) {
      const inRemote = remote.find((r) => r.id === item.id);
      if (!inRemote) {
        hasLocalChanges = true;
      }
    }

    return {
      local: Array.from(merged.values()),
      hasLocalChanges
    };
  }

  // Return sync engine interface
  return {
    domain,
    provider,
    sync,
    canSync,
    getStatus,
    getError,
    onStatusChange,
    getLastSync,
    setLastSync
  };
}

export default createSyncEngine;
