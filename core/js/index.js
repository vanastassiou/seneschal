/**
 * seneschal-core
 * Shared sync engine and schemas for seneschal projects
 */

// Sync engine
export { createSyncEngine, SyncStatus } from './sync/index.js';

// Providers
export { createGoogleDriveProvider } from './providers/google-drive.js';
export {
  pickFolder,
  getSavedFolder,
  saveFolder,
  clearFolder,
  createFolder
} from './providers/google-picker.js';

// OAuth
export {
  getToken,
  isAuthenticated,
  logout,
  startAuth,
  handleCallback,
  hasOAuthCallback
} from './oauth/index.js';
