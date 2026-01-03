/**
 * Google Drive sync provider for seneschal projects
 * Domain-agnostic: pass domain name in config
 */

import { getToken, startAuth, handleCallback, isAuthenticated, logout } from '../oauth/index.js';
import { getSavedFolder, pickFolder, saveFolder, clearFolder } from './google-picker.js';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file'
];

const API_BASE = 'https://www.googleapis.com';

/**
 * Create a Google Drive provider for a specific domain
 * @param {Object} config - Provider configuration
 * @param {string} config.domain - Domain name (gardener, trainer, soapmaker, seneschal)
 * @param {string} config.clientId - Google OAuth client ID
 * @param {string} config.apiKey - Google API key (for picker)
 * @param {string} config.redirectUri - OAuth redirect URI
 * @param {string} [config.clientSecret] - OAuth client secret (optional)
 */
export function createGoogleDriveProvider(config) {
  const { domain, clientId, apiKey, redirectUri, clientSecret } = config;

  const DATA_FILE = `${domain}-data.json`;
  const ATTACHMENTS_FOLDER = `attachments/${domain}`;

  let fileId = null;
  let attachmentsFolderId = null;

  /**
   * Check if connected to Google Drive
   */
  function isConnected() {
    return isAuthenticated('google');
  }

  /**
   * Start OAuth flow
   */
  async function connect() {
    await startAuth('google', clientId, SCOPES, redirectUri);
  }

  /**
   * Handle OAuth callback
   */
  async function handleAuthCallback() {
    return handleCallback('google', clientId, redirectUri, clientSecret);
  }

  /**
   * Disconnect from Google Drive
   */
  function disconnect() {
    logout('google');
    fileId = null;
    attachmentsFolderId = null;
  }

  /**
   * Check if a folder is configured for sync
   */
  function isFolderConfigured() {
    return getSavedFolder(domain) !== null;
  }

  /**
   * Open folder picker
   */
  async function selectFolder() {
    const folder = await pickFolder(clientId, apiKey, `Select folder for ${domain} sync`);
    if (folder) {
      saveFolder(domain, folder);
      // Reset cached IDs when folder changes
      fileId = null;
      attachmentsFolderId = null;
    }
    return folder;
  }

  /**
   * Get current folder
   */
  function getFolder() {
    return getSavedFolder(domain);
  }

  /**
   * Clear folder selection
   */
  function removeFolder() {
    clearFolder(domain);
    fileId = null;
    attachmentsFolderId = null;
  }

  /**
   * Make authenticated API request
   */
  async function apiRequest(path, options = {}) {
    const token = getToken('google');
    if (!token) {
      throw new Error('Not authenticated with Google');
    }

    const response = await window.fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || 'API request failed');
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * Find or create the data file
   */
  async function getOrCreateDataFile() {
    if (fileId) return fileId;

    const folder = getSavedFolder(domain);
    if (!folder) {
      throw new Error('No folder selected. Please select a folder in Settings.');
    }

    const query = `name='${DATA_FILE}' and '${folder.id}' in parents and trashed=false`;
    const searchResult = await apiRequest(
      `/drive/v3/files?q=${encodeURIComponent(query)}`
    );

    if (searchResult?.files?.length > 0) {
      fileId = searchResult.files[0].id;
      return fileId;
    }

    const metadata = {
      name: DATA_FILE,
      parents: [folder.id],
      mimeType: 'application/json'
    };

    const createResult = await apiRequest('/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    });

    fileId = createResult.id;
    return fileId;
  }

  /**
   * Find or create the attachments folder
   */
  async function getOrCreateAttachmentsFolder() {
    if (attachmentsFolderId) return attachmentsFolderId;

    const folder = getSavedFolder(domain);
    if (!folder) {
      throw new Error('No folder selected. Please select a folder in Settings.');
    }

    // First find or create 'attachments' folder
    let attachmentsParent;
    const attachmentsQuery = `name='attachments' and '${folder.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const attachmentsResult = await apiRequest(
      `/drive/v3/files?q=${encodeURIComponent(attachmentsQuery)}`
    );

    if (attachmentsResult?.files?.length > 0) {
      attachmentsParent = attachmentsResult.files[0].id;
    } else {
      const createResult = await apiRequest('/drive/v3/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'attachments',
          parents: [folder.id],
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      attachmentsParent = createResult.id;
    }

    // Now find or create domain subfolder
    const domainQuery = `name='${domain}' and '${attachmentsParent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const domainResult = await apiRequest(
      `/drive/v3/files?q=${encodeURIComponent(domainQuery)}`
    );

    if (domainResult?.files?.length > 0) {
      attachmentsFolderId = domainResult.files[0].id;
    } else {
      const createResult = await apiRequest('/drive/v3/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: domain,
          parents: [attachmentsParent],
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      attachmentsFolderId = createResult.id;
    }

    return attachmentsFolderId;
  }

  /**
   * Fetch data from Google Drive
   */
  async function fetch() {
    const id = await getOrCreateDataFile();

    try {
      const response = await apiRequest(`/drive/v3/files/${id}?alt=media`);
      if (!response || typeof response !== 'object') {
        return { data: null, lastModified: null };
      }
      return {
        data: response.data || null,
        lastModified: response.lastModified || null
      };
    } catch (err) {
      return { data: null, lastModified: null };
    }
  }

  /**
   * Push data to Google Drive
   * @param {Object} syncData - Data to sync
   * @param {*} syncData.data - Domain-specific data
   * @param {string} syncData.lastModified - ISO timestamp
   */
  async function push(syncData) {
    const id = await getOrCreateDataFile();

    const payload = {
      domain,
      version: syncData.version || 1,
      data: syncData.data,
      lastModified: syncData.lastModified || new Date().toISOString()
    };

    const metadata = {
      mimeType: 'application/json'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

    const token = getToken('google');
    const response = await window.fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload data to Google Drive');
    }

    return true;
  }

  /**
   * Upload attachment to Google Drive
   */
  async function uploadAttachment(attachmentId, filename, blob, mimeType) {
    const folderId = await getOrCreateAttachmentsFolder();

    const metadata = {
      name: `${attachmentId}-${filename}`,
      parents: [folderId],
      mimeType: mimeType || 'application/octet-stream'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const token = getToken('google');
    const response = await window.fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload attachment');
    }

    const result = await response.json();
    return result.id;
  }

  /**
   * Download attachment from Google Drive
   */
  async function downloadAttachment(remoteId) {
    const token = getToken('google');
    const response = await window.fetch(
      `https://www.googleapis.com/drive/v3/files/${remoteId}?alt=media`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download attachment');
    }

    return response.blob();
  }

  /**
   * Delete attachment from Google Drive
   */
  async function deleteAttachment(remoteId) {
    await apiRequest(`/drive/v3/files/${remoteId}`, {
      method: 'DELETE'
    });
  }

  /**
   * List all attachments
   */
  async function listAttachments() {
    const folderId = await getOrCreateAttachmentsFolder();

    const query = `'${folderId}' in parents and trashed=false`;
    const result = await apiRequest(
      `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size)`
    );

    return (result.files || []).map((file) => {
      const dashIndex = file.name.indexOf('-');
      const id = dashIndex > 0 ? file.name.substring(0, dashIndex) : file.name;
      const filename = dashIndex > 0 ? file.name.substring(dashIndex + 1) : file.name;

      return {
        id,
        remoteId: file.id,
        filename,
        mimeType: file.mimeType,
        size: parseInt(file.size, 10)
      };
    });
  }

  /**
   * List all domain data files in the folder (for seneschal aggregation)
   */
  async function listAllDomainFiles() {
    const folder = getSavedFolder(domain);
    if (!folder) {
      return [];
    }

    const query = `'${folder.id}' in parents and name contains '-data.json' and trashed=false`;
    const result = await apiRequest(
      `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`
    );

    return (result.files || []).map((file) => {
      const domainName = file.name.replace('-data.json', '');
      return {
        domain: domainName,
        fileId: file.id
      };
    });
  }

  /**
   * Fetch data for a specific domain (for seneschal aggregation)
   */
  async function fetchDomainData(domainFileId) {
    try {
      const response = await apiRequest(`/drive/v3/files/${domainFileId}?alt=media`);
      return response;
    } catch {
      return null;
    }
  }

  // Return provider interface
  return {
    name: 'google-drive',
    domain,
    isConnected,
    isFolderConfigured,
    connect,
    handleAuthCallback,
    disconnect,
    selectFolder,
    getFolder,
    removeFolder,
    fetch,
    push,
    uploadAttachment,
    downloadAttachment,
    deleteAttachment,
    listAttachments,
    listAllDomainFiles,
    fetchDomainData
  };
}

export default createGoogleDriveProvider;
