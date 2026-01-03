/**
 * Sync integration for seneschal
 * Connects seneschal-core sync engine to seneschal database
 */

import { createSyncEngine, createGoogleDriveProvider, hasOAuthCallback } from '../../core/js/index.js';
import { exportAllData, mergeData } from './db.js';

const DOMAIN = 'seneschal';

let provider = null;
let syncEngine = null;

/**
 * Initialize sync with application config
 * @param {Object} config - OAuth configuration
 */
export function initSync(config) {
  provider = createGoogleDriveProvider({
    domain: DOMAIN,
    clientId: config.google.clientId,
    apiKey: config.google.apiKey,
    redirectUri: config.redirectUri
  });

  syncEngine = createSyncEngine({
    provider,
    domain: DOMAIN,
    getLocalData: async () => exportAllData(),
    setLocalData: async (data) => {
      if (data) {
        await mergeData(data);
      }
    }
  });

  return { provider, syncEngine };
}

/**
 * Check if there's an OAuth callback to handle
 */
export function checkOAuthCallback() {
  return hasOAuthCallback();
}

/**
 * Handle OAuth callback after redirect
 */
export async function handleOAuthCallback() {
  if (!provider) {
    throw new Error('Sync not initialized. Call initSync first.');
  }
  return provider.handleAuthCallback();
}

/**
 * Connect to Google Drive
 */
export async function connect() {
  if (!provider) {
    throw new Error('Sync not initialized. Call initSync first.');
  }
  return provider.connect();
}

/**
 * Disconnect from Google Drive
 */
export function disconnect() {
  if (provider) {
    provider.disconnect();
  }
}

/**
 * Check if connected to Google Drive
 */
export function isConnected() {
  return provider?.isConnected() || false;
}

/**
 * Check if sync folder is configured
 */
export function isFolderConfigured() {
  return provider?.isFolderConfigured() || false;
}

/**
 * Open folder picker
 */
export async function selectFolder() {
  if (!provider) {
    throw new Error('Sync not initialized. Call initSync first.');
  }
  return provider.selectFolder();
}

/**
 * Get current sync folder
 */
export function getFolder() {
  return provider?.getFolder() || null;
}

/**
 * Perform sync
 */
export async function sync() {
  if (!syncEngine) {
    throw new Error('Sync not initialized. Call initSync first.');
  }
  return syncEngine.sync();
}

/**
 * Check if sync is possible
 */
export function canSync() {
  return syncEngine?.canSync() || false;
}

/**
 * Get sync status
 */
export function getStatus() {
  return syncEngine?.getStatus() || 'idle';
}

/**
 * Subscribe to sync status changes
 * @param {Function} listener - Callback(status, error)
 * @returns {Function} Unsubscribe function
 */
export function onStatusChange(listener) {
  if (!syncEngine) {
    return () => {};
  }
  return syncEngine.onStatusChange(listener);
}

/**
 * Get last sync timestamp
 */
export function getLastSync() {
  return syncEngine?.getLastSync() || null;
}

/**
 * Fetch data from all domain projects (for dashboard aggregation)
 * @returns {Promise<Object>}
 */
export async function fetchAllProjectData() {
  if (!provider || !provider.isConnected() || !provider.isFolderConfigured()) {
    return null;
  }

  const domains = ['gardener', 'trainer', 'soapmaker'];
  const projectData = {};

  for (const domain of domains) {
    try {
      const data = await provider.fetchDomainData(domain);
      projectData[domain] = data;
    } catch (e) {
      console.warn(`Failed to fetch ${domain} data:`, e);
      projectData[domain] = null;
    }
  }

  return projectData;
}

export default {
  initSync,
  checkOAuthCallback,
  handleOAuthCallback,
  connect,
  disconnect,
  isConnected,
  isFolderConfigured,
  selectFolder,
  getFolder,
  sync,
  canSync,
  getStatus,
  onStatusChange,
  getLastSync,
  fetchAllProjectData
};
