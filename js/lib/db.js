/**
 * IndexedDB abstraction for Seneschal
 * Stores ideas with full-text search and filtering
 */

const DB_NAME = 'seneschal';
const DB_VERSION = 1;

let db = null;

/**
 * Open the database
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onblocked = () => reject(new Error('Database blocked'));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Ideas store
      if (!database.objectStoreNames.contains('ideas')) {
        const ideasStore = database.createObjectStore('ideas', { keyPath: 'id' });
        ideasStore.createIndex('type', 'type', { unique: false });
        ideasStore.createIndex('status', 'status', { unique: false });
        ideasStore.createIndex('createdAt', 'createdAt', { unique: false });
        ideasStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Tags store for autocomplete
      if (!database.objectStoreNames.contains('tags')) {
        database.createObjectStore('tags', { keyPath: 'name' });
      }

      // Sync metadata
      if (!database.objectStoreNames.contains('sync')) {
        database.createObjectStore('sync', { keyPath: 'key' });
      }
    };
  });
}

/**
 * Promisify IDB request
 * @param {IDBRequest} request
 * @returns {Promise}
 */
function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// =============================================================================
// Ideas CRUD
// =============================================================================

/**
 * Generate UUID v4
 * @returns {string}
 */
export function generateId() {
  return crypto.randomUUID();
}

/**
 * Create a new idea
 * @param {Object} idea
 * @returns {Promise<Object>}
 */
export async function createIdea(idea) {
  const database = await openDB();
  const now = new Date().toISOString();

  const newIdea = {
    id: generateId(),
    ...idea,
    createdAt: now,
    updatedAt: now
  };

  const tx = database.transaction(['ideas', 'tags'], 'readwrite');
  const ideasStore = tx.objectStore('ideas');
  await promisify(ideasStore.add(newIdea));

  // Update tag counts
  if (newIdea.tags?.length) {
    await updateTagCounts(tx.objectStore('tags'), newIdea.tags, 1);
  }

  return newIdea;
}

/**
 * Get idea by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getIdea(id) {
  const database = await openDB();
  const tx = database.transaction('ideas', 'readonly');
  const store = tx.objectStore('ideas');
  return promisify(store.get(id));
}

/**
 * Update an idea
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateIdea(id, updates) {
  const database = await openDB();
  const tx = database.transaction(['ideas', 'tags'], 'readwrite');
  const ideasStore = tx.objectStore('ideas');
  const tagsStore = tx.objectStore('tags');

  const existing = await promisify(ideasStore.get(id));
  if (!existing) {
    throw new Error(`Idea not found: ${id}`);
  }

  // Handle tag changes
  const oldTags = existing.tags || [];
  const newTags = updates.tags || oldTags;
  const removedTags = oldTags.filter(t => !newTags.includes(t));
  const addedTags = newTags.filter(t => !oldTags.includes(t));

  if (removedTags.length) {
    await updateTagCounts(tagsStore, removedTags, -1);
  }
  if (addedTags.length) {
    await updateTagCounts(tagsStore, addedTags, 1);
  }

  const updatedIdea = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString()
  };

  await promisify(ideasStore.put(updatedIdea));
  return updatedIdea;
}

/**
 * Delete an idea
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteIdea(id) {
  const database = await openDB();
  const tx = database.transaction(['ideas', 'tags'], 'readwrite');
  const ideasStore = tx.objectStore('ideas');
  const tagsStore = tx.objectStore('tags');

  const existing = await promisify(ideasStore.get(id));
  if (existing?.tags?.length) {
    await updateTagCounts(tagsStore, existing.tags, -1);
  }

  await promisify(ideasStore.delete(id));
}

/**
 * Get all ideas
 * @returns {Promise<Object[]>}
 */
export async function getAllIdeas() {
  const database = await openDB();
  const tx = database.transaction('ideas', 'readonly');
  const store = tx.objectStore('ideas');
  const ideas = await promisify(store.getAll());
  return ideas.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Search ideas by text
 * @param {string} query
 * @returns {Promise<Object[]>}
 */
export async function searchIdeas(query) {
  const ideas = await getAllIdeas();
  const lowerQuery = query.toLowerCase();

  return ideas.filter(idea => {
    const searchFields = [
      idea.title,
      idea.content,
      idea.description,
      idea.notes,
      idea.recommender,
      idea.reason,
      ...(idea.tags || [])
    ];

    return searchFields.some(field =>
      field && field.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Filter ideas by type and/or status
 * @param {Object} filters
 * @returns {Promise<Object[]>}
 */
export async function filterIdeas(filters = {}) {
  const ideas = await getAllIdeas();

  return ideas.filter(idea => {
    if (filters.type && idea.type !== filters.type) return false;
    if (filters.status && idea.status !== filters.status) return false;
    if (filters.tag && !idea.tags?.includes(filters.tag)) return false;
    return true;
  });
}

// =============================================================================
// Tags
// =============================================================================

/**
 * Update tag counts
 * @param {IDBObjectStore} store
 * @param {string[]} tags
 * @param {number} delta
 */
async function updateTagCounts(store, tags, delta) {
  for (const tag of tags) {
    const existing = await promisify(store.get(tag));
    if (existing) {
      existing.count = Math.max(0, existing.count + delta);
      if (existing.count === 0) {
        await promisify(store.delete(tag));
      } else {
        await promisify(store.put(existing));
      }
    } else if (delta > 0) {
      await promisify(store.add({ name: tag, count: delta }));
    }
  }
}

/**
 * Get all tags sorted by usage
 * @returns {Promise<Object[]>}
 */
export async function getAllTags() {
  const database = await openDB();
  const tx = database.transaction('tags', 'readonly');
  const store = tx.objectStore('tags');
  const tags = await promisify(store.getAll());
  return tags.sort((a, b) => b.count - a.count);
}

// =============================================================================
// Export / Import
// =============================================================================

/**
 * Export all data
 * @returns {Promise<Object>}
 */
export async function exportAllData() {
  const database = await openDB();

  const tx = database.transaction(['ideas', 'tags'], 'readonly');
  const ideas = await promisify(tx.objectStore('ideas').getAll());
  const tags = await promisify(tx.objectStore('tags').getAll());

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    ideas,
    tags
  };
}

/**
 * Import data (replaces existing)
 * @param {Object} data
 * @returns {Promise<number>}
 */
export async function importData(data) {
  if (!data.version || !Array.isArray(data.ideas)) {
    throw new Error('Invalid backup file');
  }

  const database = await openDB();
  const tx = database.transaction(['ideas', 'tags'], 'readwrite');

  // Clear existing
  await promisify(tx.objectStore('ideas').clear());
  await promisify(tx.objectStore('tags').clear());

  // Import ideas
  const ideasStore = tx.objectStore('ideas');
  for (const idea of data.ideas) {
    ideasStore.add(idea);
  }

  // Import tags
  if (data.tags) {
    const tagsStore = tx.objectStore('tags');
    for (const tag of data.tags) {
      tagsStore.add(tag);
    }
  }

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  return data.ideas.length;
}

/**
 * Merge data (for sync)
 * Uses last-write-wins based on updatedAt
 * @param {Object} data
 * @returns {Promise<void>}
 */
export async function mergeData(data) {
  if (!data.ideas) return;

  const database = await openDB();
  const tx = database.transaction(['ideas', 'tags'], 'readwrite');
  const ideasStore = tx.objectStore('ideas');

  for (const remoteIdea of data.ideas) {
    const localIdea = await promisify(ideasStore.get(remoteIdea.id));

    if (!localIdea) {
      // New idea from remote
      ideasStore.add(remoteIdea);
    } else if (remoteIdea.updatedAt > localIdea.updatedAt) {
      // Remote is newer
      ideasStore.put(remoteIdea);
    }
    // Otherwise keep local
  }

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// =============================================================================
// Sync metadata
// =============================================================================

/**
 * Get sync metadata
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function getSyncMeta(key) {
  const database = await openDB();
  const tx = database.transaction('sync', 'readonly');
  const result = await promisify(tx.objectStore('sync').get(key));
  return result?.value;
}

/**
 * Set sync metadata
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
export async function setSyncMeta(key, value) {
  const database = await openDB();
  const tx = database.transaction('sync', 'readwrite');
  await promisify(tx.objectStore('sync').put({ key, value }));
}

// =============================================================================
// Testing utilities
// =============================================================================

/**
 * Close database connection (for testing)
 */
export function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Reset database (for testing)
 * Closes connection and deletes the database
 * @returns {Promise<void>}
 */
export async function resetDB() {
  closeDB();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
