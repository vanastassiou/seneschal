/**
 * Seneschal - Main Application
 * Dashboard and idea management with sync support
 */

import * as db from './lib/db.js';
import * as sync from './lib/sync.js';
import { showToast } from './ui/components/toast.js';

// =============================================================================
// State
// =============================================================================

let ideas = [];
let currentPanel = 'dashboard';
let editingIdeaId = null;
let syncInitialized = false;

// =============================================================================
// DOM Elements
// =============================================================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// =============================================================================
// Initialization
// =============================================================================

async function init() {
  // Load ideas
  await loadIdeas();

  // Try to initialize sync (config may not exist)
  try {
    const configModule = await import('./lib/config.js');
    sync.initSync(configModule.config);
    syncInitialized = true;

    // Handle OAuth callback
    if (sync.checkOAuthCallback()) {
      try {
        await sync.handleOAuthCallback();
        showToast('Connected to Google Drive', 'success');
      } catch (e) {
        showToast('Connection failed: ' + e.message, 'error');
      }
    }
  } catch (e) {
    console.log('Sync not configured (config.js missing)');
    syncInitialized = false;
  }

  updateSyncUI();

  // Set up event listeners
  setupNavigation();
  setupIdeaForm();
  setupSettings();
  setupSearch();

  // Update UI
  updateDashboard();
  renderIdeasList();

  // Apply saved theme
  const savedTheme = localStorage.getItem('seneschal-theme');
  if (savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
    $('#theme-toggle').checked = savedTheme === 'dark';
  }
}

// =============================================================================
// Data Loading
// =============================================================================

async function loadIdeas() {
  try {
    ideas = await db.getAllIdeas();
  } catch (e) {
    console.error('Failed to load ideas:', e);
    showToast('Failed to load ideas', 'error');
  }
}

// =============================================================================
// Navigation
// =============================================================================

function setupNavigation() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      showPanel(panel);
    });
  });
}

function showPanel(panelName) {
  currentPanel = panelName;

  // Update nav buttons
  $$('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === panelName);
  });

  // Update panels
  $$('.panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `${panelName}-panel`);
  });
}

// =============================================================================
// Dashboard
// =============================================================================

function updateDashboard() {
  // Ideas summary
  const ideasSummary = $('#ideas-summary');
  const projectCount = ideas.filter(i => i.type === 'project').length;
  const mediaCount = ideas.filter(i => i.type === 'media').length;
  const noteCount = ideas.filter(i => i.type === 'note').length;

  ideasSummary.innerHTML = `
    <div class="summary-stats">
      <div class="stat"><span class="stat-value">${projectCount}</span> Projects</div>
      <div class="stat"><span class="stat-value">${mediaCount}</span> Media</div>
      <div class="stat"><span class="stat-value">${noteCount}</span> Notes</div>
    </div>
    <p class="stat-total">${ideas.length} total ideas</p>
  `;

  // Projects summary (placeholder for aggregation)
  const projectsSummary = $('#projects-summary');
  if (sync.isConnected() && sync.isFolderConfigured()) {
    projectsSummary.innerHTML = `
      <p>Click "Sync Projects" to fetch data from your other projects.</p>
    `;
    $('#sync-projects-btn').disabled = false;
  } else {
    projectsSummary.innerHTML = `
      <p class="muted">Connect to Google Drive in Settings to sync projects.</p>
    `;
    $('#sync-projects-btn').disabled = true;
  }

  // Sync summary
  updateSyncSummary();
}

function updateSyncSummary() {
  const syncSummary = $('#sync-summary');
  const connected = sync.isConnected();
  const folderConfigured = sync.isFolderConfigured();

  let statusText = 'Not connected';
  if (connected && folderConfigured) {
    const lastSync = sync.getLastSync();
    statusText = lastSync
      ? `Last sync: ${formatDate(lastSync)}`
      : 'Connected - Ready to sync';
  } else if (connected) {
    statusText = 'Connected - Select folder';
  }

  syncSummary.querySelector('.sync-status').textContent = statusText;

  // Sync projects button
  const syncBtn = $('#sync-projects-btn');
  syncBtn.disabled = !connected || !folderConfigured;
  syncBtn.onclick = handleSyncProjects;
}

async function handleSyncProjects() {
  showToast('Syncing projects...', 'info');

  try {
    // First sync seneschal data
    await sync.sync();

    // Then fetch other project data
    const projectData = await sync.fetchAllProjectData();

    if (projectData) {
      displayProjectData(projectData);
      showToast('Projects synced', 'success');
    }
  } catch (e) {
    showToast('Sync failed: ' + e.message, 'error');
  }
}

function displayProjectData(projectData) {
  const summary = $('#projects-summary');
  const items = [];

  if (projectData.gardener) {
    const seedCount = Object.keys(projectData.gardener.seeds || {}).length;
    items.push(`<div class="project-stat">Gardener: ${seedCount} seeds</div>`);
  }

  if (projectData.trainer) {
    const programCount = projectData.trainer.programs?.length || 0;
    const journalCount = projectData.trainer.journals?.length || 0;
    items.push(`<div class="project-stat">Trainer: ${programCount} programs, ${journalCount} journal entries</div>`);
  }

  if (projectData.soapmaker) {
    const recipeCount = projectData.soapmaker.recipe?.length || 0;
    items.push(`<div class="project-stat">Soapmaker: ${recipeCount} recipe items</div>`);
  }

  summary.innerHTML = items.length
    ? items.join('')
    : '<p class="muted">No project data available</p>';
}

// =============================================================================
// Ideas List
// =============================================================================

function renderIdeasList(filteredIdeas = null) {
  const list = $('#ideas-list');
  const displayIdeas = filteredIdeas || ideas;

  if (displayIdeas.length === 0) {
    list.innerHTML = '<p class="empty-state">No ideas yet. Click "New Idea" to get started.</p>';
    return;
  }

  list.innerHTML = displayIdeas.map(idea => `
    <div class="idea-item" data-id="${idea.id}">
      <div class="idea-icon ${idea.type}">${getTypeIcon(idea.type)}</div>
      <div class="idea-content">
        <div class="idea-title">${escapeHtml(idea.title || idea.content?.substring(0, 50) || 'Untitled')}</div>
        <div class="idea-meta">
          ${idea.status ? `<span class="status">${idea.status}</span>` : ''}
          ${idea.tags?.length ? `<div class="idea-tags">${idea.tags.slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="idea-date">${formatDate(idea.updatedAt)}</div>
    </div>
  `).join('');

  // Add click handlers
  list.querySelectorAll('.idea-item').forEach(item => {
    item.addEventListener('click', () => {
      editIdea(item.dataset.id);
    });
  });
}

function getTypeIcon(type) {
  switch (type) {
    case 'project': return 'P';
    case 'media': return 'M';
    case 'note': return 'N';
    default: return '?';
  }
}

// =============================================================================
// Search and Filter
// =============================================================================

function setupSearch() {
  const searchInput = $('#search-input');
  const typeFilter = $('#type-filter');
  const statusFilter = $('#status-filter');

  searchInput.addEventListener('input', handleSearchFilter);
  typeFilter.addEventListener('change', handleSearchFilter);
  statusFilter.addEventListener('change', handleSearchFilter);

  // New idea button
  $('#new-idea-btn').addEventListener('click', () => openIdeaModal());
}

async function handleSearchFilter() {
  const query = $('#search-input').value.trim();
  const type = $('#type-filter').value;
  const status = $('#status-filter').value;

  let filtered = ideas;

  if (query) {
    filtered = await db.searchIdeas(query);
  } else if (type || status) {
    filtered = await db.filterIdeas({ type, status });
  }

  renderIdeasList(filtered);
}

// =============================================================================
// Idea Form
// =============================================================================

function setupIdeaForm() {
  const modal = $('#idea-modal');
  const form = $('#idea-form');
  const typeSelect = $('#idea-type');

  // Close button
  modal.querySelector('.close-btn').addEventListener('click', closeIdeaModal);
  modal.querySelector('[data-action="cancel"]').addEventListener('click', closeIdeaModal);

  // Type change updates fields
  typeSelect.addEventListener('change', () => {
    updateTypeSpecificFields(typeSelect.value);
  });

  // Form submit
  form.addEventListener('submit', handleIdeaSubmit);

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeIdeaModal();
  });
}

function openIdeaModal(idea = null) {
  const modal = $('#idea-modal');
  const form = $('#idea-form');

  editingIdeaId = idea?.id || null;
  $('#modal-title').textContent = idea ? 'Edit Idea' : 'New Idea';

  // Reset form
  form.reset();

  if (idea) {
    $('#idea-type').value = idea.type;
    $('#idea-title').value = idea.title || '';
    $('#idea-tags').value = idea.tags?.join(', ') || '';
    populateTypeFields(idea);
  }

  updateTypeSpecificFields($('#idea-type').value);
  modal.showModal();
}

function closeIdeaModal() {
  $('#idea-modal').close();
  editingIdeaId = null;
}

function updateTypeSpecificFields(type) {
  const container = $('#type-specific-fields');

  switch (type) {
    case 'project':
      container.innerHTML = `
        <div class="form-group">
          <label for="idea-description">Description</label>
          <textarea id="idea-description"></textarea>
        </div>
        <div class="form-group">
          <label for="idea-status">Status</label>
          <select id="idea-status">
            <option value="someday">Someday</option>
            <option value="next">Next</option>
            <option value="active">Active</option>
            <option value="done">Done</option>
            <option value="dropped">Dropped</option>
          </select>
        </div>
        <div class="form-group">
          <label for="idea-interest">Interest (1-5)</label>
          <input type="number" id="idea-interest" min="1" max="5" value="3">
        </div>
        <div class="form-group">
          <label for="idea-effort">Effort</label>
          <select id="idea-effort">
            <option value="trivial">Trivial</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="epic">Epic</option>
          </select>
        </div>
      `;
      break;

    case 'media':
      container.innerHTML = `
        <div class="form-group">
          <label for="idea-media-type">Media Type</label>
          <select id="idea-media-type">
            <option value="book">Book</option>
            <option value="film">Film</option>
            <option value="show">Show</option>
            <option value="podcast">Podcast</option>
            <option value="music">Music</option>
            <option value="game">Game</option>
            <option value="article">Article</option>
          </select>
        </div>
        <div class="form-group">
          <label for="idea-recommender">Recommender</label>
          <input type="text" id="idea-recommender">
        </div>
        <div class="form-group">
          <label for="idea-reason">Why recommended</label>
          <textarea id="idea-reason"></textarea>
        </div>
        <div class="form-group">
          <label for="idea-status">Status</label>
          <select id="idea-status">
            <option value="queued">Queued</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </div>
        <div class="form-group">
          <label for="idea-url">URL</label>
          <input type="url" id="idea-url">
        </div>
        <div class="form-group">
          <label for="idea-notes">Notes</label>
          <textarea id="idea-notes"></textarea>
        </div>
      `;
      break;

    case 'note':
      container.innerHTML = `
        <div class="form-group">
          <label for="idea-content">Content</label>
          <textarea id="idea-content" required></textarea>
        </div>
      `;
      // Hide title for notes
      $('#idea-title').parentElement.style.display = 'none';
      return;
  }

  // Show title for non-notes
  $('#idea-title').parentElement.style.display = 'block';
}

function populateTypeFields(idea) {
  setTimeout(() => {
    if (idea.type === 'project') {
      $('#idea-description').value = idea.description || '';
      $('#idea-status').value = idea.status || 'someday';
      $('#idea-interest').value = idea.interest || 3;
      $('#idea-effort').value = idea.effort || 'medium';
    } else if (idea.type === 'media') {
      $('#idea-media-type').value = idea.mediaType || 'book';
      $('#idea-recommender').value = idea.recommender || '';
      $('#idea-reason').value = idea.reason || '';
      $('#idea-status').value = idea.status || 'queued';
      $('#idea-url').value = idea.url || '';
      $('#idea-notes').value = idea.notes || '';
    } else if (idea.type === 'note') {
      $('#idea-content').value = idea.content || '';
    }
  }, 0);
}

async function handleIdeaSubmit(e) {
  e.preventDefault();

  const type = $('#idea-type').value;
  const tags = $('#idea-tags').value
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(t => t);

  let ideaData = { type, tags };

  if (type === 'project') {
    ideaData = {
      ...ideaData,
      title: $('#idea-title').value,
      description: $('#idea-description')?.value || '',
      status: $('#idea-status')?.value || 'someday',
      interest: parseInt($('#idea-interest')?.value) || 3,
      effort: $('#idea-effort')?.value || 'medium'
    };
  } else if (type === 'media') {
    ideaData = {
      ...ideaData,
      title: $('#idea-title').value,
      mediaType: $('#idea-media-type')?.value || 'book',
      recommender: $('#idea-recommender')?.value || '',
      reason: $('#idea-reason')?.value || '',
      status: $('#idea-status')?.value || 'queued',
      url: $('#idea-url')?.value || '',
      notes: $('#idea-notes')?.value || ''
    };
  } else if (type === 'note') {
    ideaData = {
      ...ideaData,
      content: $('#idea-content').value
    };
  }

  try {
    if (editingIdeaId) {
      await db.updateIdea(editingIdeaId, ideaData);
      showToast('Idea updated', 'success');
    } else {
      await db.createIdea(ideaData);
      showToast('Idea created', 'success');
    }

    await loadIdeas();
    renderIdeasList();
    updateDashboard();
    closeIdeaModal();
  } catch (e) {
    showToast('Failed to save: ' + e.message, 'error');
  }
}

function editIdea(id) {
  const idea = ideas.find(i => i.id === id);
  if (idea) {
    openIdeaModal(idea);
  }
}

// =============================================================================
// Settings
// =============================================================================

function setupSettings() {
  // Theme toggle
  $('#theme-toggle').addEventListener('change', (e) => {
    const theme = e.target.checked ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('seneschal-theme', theme);
  });

  // Connect button
  $('#connect-btn').addEventListener('click', handleConnect);

  // Folder name input
  $('#set-folder-btn').addEventListener('click', handleSetFolder);
  $('#folder-name-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSetFolder();
  });
  $('#change-folder-btn').addEventListener('click', () => {
    $('#folder-display').classList.add('hidden');
    $('#folder-input-group').classList.remove('hidden');
  });

  // Sync now button
  $('#sync-now-btn').addEventListener('click', handleSyncNow);

  // Export/Import
  $('#export-btn').addEventListener('click', handleExport);
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', handleImport);
}

function updateSyncUI() {
  const statusBadge = $('#sync-status');
  const connectBtn = $('#connect-btn');
  const folderConfig = $('#folder-config');
  const syncActions = $('#sync-actions');
  const folderPending = $('#folder-pending');
  const syncPending = $('#sync-pending');
  const connectHelp = $('#connect-help');

  // Step elements
  const stepConnect = $('#step-connect');
  const stepFolder = $('#step-folder');
  const stepSync = $('#step-sync');

  // Check if sync is configured
  if (!syncInitialized) {
    statusBadge.textContent = 'Not configured';
    statusBadge.classList.remove('connected');
    connectBtn.textContent = 'Setup Required';
    connectBtn.disabled = true;
    connectHelp.textContent = 'OAuth credentials not configured.';
    folderConfig.classList.add('hidden');
    folderPending.classList.remove('hidden');
    syncActions.classList.add('hidden');
    syncPending.classList.remove('hidden');

    // Reset step states
    stepConnect.classList.remove('completed');
    stepFolder.classList.remove('completed');
    stepSync.classList.remove('completed');

    // Show setup instructions
    const syncSettings = $('#sync-settings');
    if (!syncSettings.querySelector('.setup-instructions')) {
      const instructions = document.createElement('div');
      instructions.className = 'setup-instructions';
      instructions.innerHTML = `
        <p>To enable sync, create your config file:</p>
        <ol>
          <li>Copy <code>js/lib/config.example.js</code> to <code>js/lib/config.js</code></li>
          <li>Add your Google OAuth credentials from the Google Cloud Console</li>
          <li>Refresh this page</li>
        </ol>
      `;
      syncSettings.appendChild(instructions);
    }

    updateSyncSummary();
    return;
  }

  // Remove any setup instructions since we're configured
  const existingInstructions = $('#sync-settings .setup-instructions');
  if (existingInstructions) {
    existingInstructions.remove();
  }

  connectBtn.disabled = false;
  const connected = sync.isConnected();
  const folderConfigured = sync.isFolderConfigured();

  if (connected) {
    // Step 1: Connected
    statusBadge.textContent = 'Connected';
    statusBadge.classList.add('connected');
    connectBtn.textContent = 'Disconnect';
    connectHelp.textContent = 'You are signed in with Google.';
    stepConnect.classList.add('completed');

    // Step 2: Folder
    folderConfig.classList.remove('hidden');
    folderPending.classList.add('hidden');

    if (folderConfigured) {
      // Folder configured
      const folder = sync.getFolder();
      $('#folder-name').textContent = folder?.name || 'seneschal-sync';
      $('#folder-display').classList.remove('hidden');
      $('#folder-input-group').classList.add('hidden');
      stepFolder.classList.add('completed');

      // Step 3: Sync ready
      syncActions.classList.remove('hidden');
      syncPending.classList.add('hidden');
      stepSync.classList.add('completed');

      const lastSync = sync.getLastSync();
      $('#last-sync').textContent = lastSync
        ? `Last sync: ${formatDate(lastSync)}`
        : '';
    } else {
      // Folder not configured yet
      $('#folder-display').classList.add('hidden');
      $('#folder-input-group').classList.remove('hidden');
      stepFolder.classList.remove('completed');

      // Step 3: Waiting for folder
      syncActions.classList.add('hidden');
      syncPending.classList.remove('hidden');
      stepSync.classList.remove('completed');
    }
  } else {
    // Not connected
    statusBadge.textContent = 'Not connected';
    statusBadge.classList.remove('connected');
    connectBtn.textContent = 'Connect';
    connectHelp.textContent = 'Sign in with your Google account to enable sync.';
    stepConnect.classList.remove('completed');

    // Step 2: Waiting for connection
    folderConfig.classList.add('hidden');
    folderPending.classList.remove('hidden');
    stepFolder.classList.remove('completed');

    // Step 3: Waiting for folder
    syncActions.classList.add('hidden');
    syncPending.classList.remove('hidden');
    stepSync.classList.remove('completed');
  }

  updateSyncSummary();
}

async function handleConnect() {
  if (sync.isConnected()) {
    sync.disconnect();
    showToast('Disconnected', 'info');
  } else {
    try {
      await sync.connect();
      showToast('Connected to Google Drive', 'success');
    } catch (e) {
      showToast('Connection failed: ' + e.message, 'error');
    }
  }
  updateSyncUI();
  updateDashboard();
}

async function handleSetFolder() {
  const folderName = $('#folder-name-input').value.trim();
  if (!folderName) {
    showToast('Please enter a folder name', 'warning');
    return;
  }

  try {
    $('#set-folder-btn').disabled = true;
    $('#set-folder-btn').textContent = 'Setting up...';

    await sync.setFolderByName(folderName);
    showToast(`Folder "${folderName}" configured`, 'success');
    updateSyncUI();
    updateDashboard();
  } catch (e) {
    showToast('Failed to set folder: ' + e.message, 'error');
  } finally {
    $('#set-folder-btn').disabled = false;
    $('#set-folder-btn').textContent = 'Set Folder';
  }
}

async function handleSyncNow() {
  showToast('Syncing...', 'info');

  try {
    await sync.sync();
    await loadIdeas();
    renderIdeasList();
    updateDashboard();
    showToast('Sync complete', 'success');
    updateSyncUI();
  } catch (e) {
    showToast('Sync failed: ' + e.message, 'error');
  }
}

async function handleExport() {
  try {
    const data = await db.exportAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `seneschal-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showToast('Data exported', 'success');
  } catch (e) {
    showToast('Export failed: ' + e.message, 'error');
  }
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (confirm(`Import ${data.ideas?.length || 0} ideas? This will replace existing data.`)) {
      const count = await db.importData(data);
      await loadIdeas();
      renderIdeasList();
      updateDashboard();
      showToast(`Imported ${count} ideas`, 'success');
    }
  } catch (e) {
    showToast('Import failed: ' + e.message, 'error');
  }

  e.target.value = '';
}

// =============================================================================
// Utilities
// =============================================================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}

// =============================================================================
// Start
// =============================================================================

init();
