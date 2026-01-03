/**
 * Unit tests for db.js (IndexedDB abstraction)
 *
 * Uses fake-indexeddb to run tests in Node.js environment.
 */

import { jest } from '@jest/globals';
import {
    generateId,
    createIdea,
    getIdea,
    updateIdea,
    deleteIdea,
    getAllIdeas,
    searchIdeas,
    filterIdeas,
    getAllTags,
    exportAllData,
    importData,
    mergeData,
    getSyncMeta,
    setSyncMeta,
    resetDB
} from '../../js/lib/db.js';

// Reset database between tests
beforeEach(async () => {
    await resetDB();
});

afterAll(async () => {
    await resetDB();
});

describe('generateId', () => {
    test('should generate a valid UUID', () => {
        const id = generateId();
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    test('should generate unique IDs', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
            ids.add(generateId());
        }
        expect(ids.size).toBe(100);
    });
});

describe('createIdea', () => {
    test('should create an idea with generated id and timestamps', async () => {
        const idea = await createIdea({
            type: 'note',
            title: 'Test Note',
            content: 'Test content'
        });

        expect(idea.id).toBeDefined();
        expect(idea.type).toBe('note');
        expect(idea.title).toBe('Test Note');
        expect(idea.content).toBe('Test content');
        expect(idea.createdAt).toBeDefined();
        expect(idea.updatedAt).toBeDefined();
    });

    test('should create ideas with different types', async () => {
        const project = await createIdea({ type: 'project', title: 'Project' });
        const media = await createIdea({ type: 'media', title: 'Book' });
        const note = await createIdea({ type: 'note', title: 'Note' });

        expect(project.type).toBe('project');
        expect(media.type).toBe('media');
        expect(note.type).toBe('note');
    });

    test('should create idea with tags and update tag counts', async () => {
        await createIdea({
            type: 'note',
            title: 'Tagged Note',
            tags: ['personal', 'work']
        });

        const tags = await getAllTags();
        expect(tags).toHaveLength(2);
        expect(tags.some(t => t.name === 'personal')).toBe(true);
        expect(tags.some(t => t.name === 'work')).toBe(true);
    });
});

describe('getIdea', () => {
    test('should retrieve an existing idea', async () => {
        const created = await createIdea({
            type: 'note',
            title: 'Test Note'
        });

        const retrieved = await getIdea(created.id);
        expect(retrieved.id).toBe(created.id);
        expect(retrieved.title).toBe('Test Note');
    });

    test('should return undefined for non-existent idea', async () => {
        const retrieved = await getIdea('non-existent-id');
        expect(retrieved).toBeUndefined();
    });
});

describe('updateIdea', () => {
    test('should update idea fields', async () => {
        const created = await createIdea({
            type: 'note',
            title: 'Original Title'
        });

        const updated = await updateIdea(created.id, {
            title: 'Updated Title',
            content: 'New content'
        });

        expect(updated.title).toBe('Updated Title');
        expect(updated.content).toBe('New content');
        expect(updated.updatedAt).not.toBe(created.updatedAt);
    });

    test('should throw error for non-existent idea', async () => {
        await expect(updateIdea('non-existent-id', { title: 'Test' }))
            .rejects.toThrow('Idea not found');
    });

    test('should handle tag changes correctly', async () => {
        const created = await createIdea({
            type: 'note',
            title: 'Note',
            tags: ['old-tag']
        });

        await updateIdea(created.id, {
            tags: ['new-tag']
        });

        const tags = await getAllTags();
        expect(tags.some(t => t.name === 'old-tag')).toBe(false);
        expect(tags.some(t => t.name === 'new-tag')).toBe(true);
    });
});

describe('deleteIdea', () => {
    test('should delete an existing idea', async () => {
        const created = await createIdea({
            type: 'note',
            title: 'To Delete'
        });

        await deleteIdea(created.id);

        const retrieved = await getIdea(created.id);
        expect(retrieved).toBeUndefined();
    });

    test('should update tag counts on delete', async () => {
        await createIdea({
            type: 'note',
            title: 'Tagged',
            tags: ['delete-test']
        });

        let tags = await getAllTags();
        expect(tags.some(t => t.name === 'delete-test')).toBe(true);

        const ideas = await getAllIdeas();
        await deleteIdea(ideas[0].id);

        tags = await getAllTags();
        expect(tags.some(t => t.name === 'delete-test')).toBe(false);
    });
});

describe('getAllIdeas', () => {
    test('should return empty array when no ideas exist', async () => {
        const ideas = await getAllIdeas();
        expect(ideas).toEqual([]);
    });

    test('should return all ideas sorted by updatedAt descending', async () => {
        await createIdea({ type: 'note', title: 'First' });
        await new Promise(resolve => setTimeout(resolve, 10));
        await createIdea({ type: 'note', title: 'Second' });
        await new Promise(resolve => setTimeout(resolve, 10));
        await createIdea({ type: 'note', title: 'Third' });

        const ideas = await getAllIdeas();
        expect(ideas).toHaveLength(3);
        expect(ideas[0].title).toBe('Third');
        expect(ideas[2].title).toBe('First');
    });
});

describe('searchIdeas', () => {
    beforeEach(async () => {
        await createIdea({ type: 'note', title: 'JavaScript Tutorial', content: 'Learn JS' });
        await createIdea({ type: 'note', title: 'Python Guide', content: 'Learn Python' });
        await createIdea({ type: 'project', title: 'Web App', description: 'JavaScript project' });
    });

    test('should find ideas by title', async () => {
        const results = await searchIdeas('javascript');
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results.some(r => r.title.toLowerCase().includes('javascript'))).toBe(true);
    });

    test('should find ideas by content', async () => {
        const results = await searchIdeas('python');
        expect(results.length).toBeGreaterThanOrEqual(1);
    });

    test('should find ideas by description', async () => {
        const results = await searchIdeas('javascript project');
        expect(results.length).toBeGreaterThanOrEqual(1);
    });

    test('should return empty array for no matches', async () => {
        const results = await searchIdeas('nonexistentterm');
        expect(results).toEqual([]);
    });
});

describe('filterIdeas', () => {
    beforeEach(async () => {
        await createIdea({ type: 'note', title: 'Note 1', status: 'active' });
        await createIdea({ type: 'note', title: 'Note 2', status: 'completed' });
        await createIdea({ type: 'project', title: 'Project 1', status: 'active' });
        await createIdea({ type: 'media', title: 'Book 1', status: 'active', tags: ['reading'] });
    });

    test('should filter by type', async () => {
        const notes = await filterIdeas({ type: 'note' });
        expect(notes).toHaveLength(2);
        expect(notes.every(i => i.type === 'note')).toBe(true);
    });

    test('should filter by status', async () => {
        const active = await filterIdeas({ status: 'active' });
        expect(active).toHaveLength(3);
        expect(active.every(i => i.status === 'active')).toBe(true);
    });

    test('should filter by tag', async () => {
        const reading = await filterIdeas({ tag: 'reading' });
        expect(reading).toHaveLength(1);
        expect(reading[0].title).toBe('Book 1');
    });

    test('should combine multiple filters', async () => {
        const results = await filterIdeas({ type: 'note', status: 'active' });
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Note 1');
    });

    test('should return all ideas with no filters', async () => {
        const all = await filterIdeas();
        expect(all).toHaveLength(4);
    });
});

describe('getAllTags', () => {
    test('should return empty array when no tags exist', async () => {
        const tags = await getAllTags();
        expect(tags).toEqual([]);
    });

    test('should return tags sorted by count descending', async () => {
        await createIdea({ type: 'note', tags: ['common', 'rare'] });
        await createIdea({ type: 'note', tags: ['common'] });
        await createIdea({ type: 'note', tags: ['common'] });

        const tags = await getAllTags();
        expect(tags[0].name).toBe('common');
        expect(tags[0].count).toBe(3);
        expect(tags[1].name).toBe('rare');
        expect(tags[1].count).toBe(1);
    });
});

describe('exportAllData', () => {
    test('should export all data with version and timestamp', async () => {
        await createIdea({ type: 'note', title: 'Export Test', tags: ['test'] });

        const data = await exportAllData();

        expect(data.version).toBe(1);
        expect(data.exportedAt).toBeDefined();
        expect(data.ideas).toHaveLength(1);
        expect(data.tags).toHaveLength(1);
    });
});

describe('importData', () => {
    test('should import data and replace existing', async () => {
        await createIdea({ type: 'note', title: 'Existing' });

        const importedData = {
            version: 1,
            ideas: [
                { id: 'imported-1', type: 'note', title: 'Imported 1' },
                { id: 'imported-2', type: 'note', title: 'Imported 2' }
            ],
            tags: [
                { name: 'imported-tag', count: 1 }
            ]
        };

        const count = await importData(importedData);
        expect(count).toBe(2);

        const ideas = await getAllIdeas();
        expect(ideas).toHaveLength(2);
        expect(ideas.some(i => i.title === 'Existing')).toBe(false);
    });

    test('should throw error for invalid backup file', async () => {
        await expect(importData({})).rejects.toThrow('Invalid backup file');
        await expect(importData({ version: 1 })).rejects.toThrow('Invalid backup file');
    });
});

describe('mergeData', () => {
    test('should add new ideas from remote', async () => {
        const local = await createIdea({ type: 'note', title: 'Local' });

        await mergeData({
            ideas: [
                { id: 'remote-1', type: 'note', title: 'Remote', updatedAt: new Date().toISOString() }
            ]
        });

        const ideas = await getAllIdeas();
        expect(ideas).toHaveLength(2);
    });

    test('should keep local when local is newer', async () => {
        const local = await createIdea({ type: 'note', title: 'Local Updated' });

        // Remote has older timestamp
        const olderTime = new Date(Date.now() - 10000).toISOString();
        await mergeData({
            ideas: [
                { id: local.id, type: 'note', title: 'Remote Older', updatedAt: olderTime }
            ]
        });

        const retrieved = await getIdea(local.id);
        expect(retrieved.title).toBe('Local Updated');
    });

    test('should update local when remote is newer', async () => {
        const local = await createIdea({ type: 'note', title: 'Local' });

        // Wait and create newer remote
        await new Promise(resolve => setTimeout(resolve, 10));
        const newerTime = new Date().toISOString();

        await mergeData({
            ideas: [
                { id: local.id, type: 'note', title: 'Remote Newer', updatedAt: newerTime }
            ]
        });

        const retrieved = await getIdea(local.id);
        expect(retrieved.title).toBe('Remote Newer');
    });

    test('should handle null ideas gracefully', async () => {
        await expect(mergeData({})).resolves.toBeUndefined();
        await expect(mergeData({ ideas: null })).resolves.toBeUndefined();
    });
});

describe('sync metadata', () => {
    test('should set and get sync metadata', async () => {
        await setSyncMeta('lastSync', 1234567890);
        const value = await getSyncMeta('lastSync');
        expect(value).toBe(1234567890);
    });

    test('should return undefined for non-existent key', async () => {
        const value = await getSyncMeta('nonexistent');
        expect(value).toBeUndefined();
    });

    test('should overwrite existing metadata', async () => {
        await setSyncMeta('key', 'value1');
        await setSyncMeta('key', 'value2');
        const value = await getSyncMeta('key');
        expect(value).toBe('value2');
    });
});
