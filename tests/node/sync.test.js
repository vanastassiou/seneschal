/**
 * Node.js unit tests for sync.js
 *
 * Note: These tests mock the core module since it depends on browser APIs.
 * For full integration tests, use the browser-based test runner.
 */

import { jest } from '@jest/globals';

// Mock the core module before importing sync
jest.unstable_mockModule('../../core/js/index.js', () => ({
    createSyncEngine: jest.fn((config) => ({
        sync: jest.fn().mockResolvedValue({ status: 'synced' }),
        canSync: jest.fn().mockReturnValue(true),
        getStatus: jest.fn().mockReturnValue('idle'),
        onStatusChange: jest.fn().mockReturnValue(() => {}),
        getLastSync: jest.fn().mockReturnValue(null)
    })),
    createGoogleDriveProvider: jest.fn((config) => ({
        connect: jest.fn().mockResolvedValue(true),
        disconnect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(false),
        isFolderConfigured: jest.fn().mockReturnValue(false),
        selectFolder: jest.fn().mockResolvedValue({ id: 'folder-123', name: 'seneschal-sync' }),
        getFolder: jest.fn().mockReturnValue(null),
        handleAuthCallback: jest.fn().mockResolvedValue(true),
        fetchDomainData: jest.fn().mockResolvedValue({ version: 1, data: {} })
    })),
    hasOAuthCallback: () => false
}));

// Mock the db module
jest.unstable_mockModule('../../js/lib/db.js', () => ({
    exportAllData: jest.fn().mockResolvedValue({ version: 1, ideas: [], tags: [] }),
    mergeData: jest.fn().mockResolvedValue(undefined)
}));

// Import after mocking
const sync = await import('../../js/lib/sync.js');

describe('sync module exports', () => {
    test('should export initSync function', () => {
        expect(typeof sync.initSync).toBe('function');
    });

    test('should export checkOAuthCallback function', () => {
        expect(typeof sync.checkOAuthCallback).toBe('function');
    });

    test('should export handleOAuthCallback function', () => {
        expect(typeof sync.handleOAuthCallback).toBe('function');
    });

    test('should export connect function', () => {
        expect(typeof sync.connect).toBe('function');
    });

    test('should export disconnect function', () => {
        expect(typeof sync.disconnect).toBe('function');
    });

    test('should export isConnected function', () => {
        expect(typeof sync.isConnected).toBe('function');
    });

    test('should export isFolderConfigured function', () => {
        expect(typeof sync.isFolderConfigured).toBe('function');
    });

    test('should export selectFolder function', () => {
        expect(typeof sync.selectFolder).toBe('function');
    });

    test('should export getFolder function', () => {
        expect(typeof sync.getFolder).toBe('function');
    });

    test('should export sync function', () => {
        expect(typeof sync.sync).toBe('function');
    });

    test('should export canSync function', () => {
        expect(typeof sync.canSync).toBe('function');
    });

    test('should export getStatus function', () => {
        expect(typeof sync.getStatus).toBe('function');
    });

    test('should export onStatusChange function', () => {
        expect(typeof sync.onStatusChange).toBe('function');
    });

    test('should export getLastSync function', () => {
        expect(typeof sync.getLastSync).toBe('function');
    });

    test('should export fetchAllProjectData function', () => {
        expect(typeof sync.fetchAllProjectData).toBe('function');
    });

    test('should export default object with all functions', () => {
        expect(typeof sync.default).toBe('object');
        expect(typeof sync.default.initSync).toBe('function');
        expect(typeof sync.default.connect).toBe('function');
        expect(typeof sync.default.sync).toBe('function');
        expect(typeof sync.default.fetchAllProjectData).toBe('function');
    });
});

describe('sync initialization', () => {
    test('should return provider and syncEngine from initSync', () => {
        const mockConfig = {
            google: {
                clientId: 'test-client-id',
                apiKey: 'test-api-key'
            },
            redirectUri: 'http://localhost'
        };

        const result = sync.initSync(mockConfig);

        expect(result).toHaveProperty('provider');
        expect(result).toHaveProperty('syncEngine');
        expect(result.provider).not.toBeNull();
        expect(result.syncEngine).not.toBeNull();
    });

    test('should check OAuth callback status', () => {
        const result = sync.checkOAuthCallback();
        expect(typeof result).toBe('boolean');
    });
});

describe('sync operations after init', () => {
    beforeEach(() => {
        // Initialize sync before each test
        const mockConfig = {
            google: {
                clientId: 'test-client-id',
                apiKey: 'test-api-key'
            },
            redirectUri: 'http://localhost'
        };
        sync.initSync(mockConfig);
    });

    test('should return boolean for isConnected', () => {
        const result = sync.isConnected();
        expect(typeof result).toBe('boolean');
    });

    test('should return boolean for isFolderConfigured', () => {
        const result = sync.isFolderConfigured();
        expect(typeof result).toBe('boolean');
    });

    test('should return value or null for getFolder', () => {
        const result = sync.getFolder();
        expect(result === null || typeof result === 'object').toBe(true);
    });

    test('should return boolean for canSync', () => {
        const result = sync.canSync();
        expect(typeof result).toBe('boolean');
    });

    test('should return string for getStatus', () => {
        const result = sync.getStatus();
        expect(typeof result).toBe('string');
    });

    test('should return value or null for getLastSync', () => {
        const result = sync.getLastSync();
        expect(result === null || typeof result === 'number' || typeof result === 'string').toBe(true);
    });

    test('should return unsubscribe function for onStatusChange', () => {
        const unsubscribe = sync.onStatusChange(() => {});
        expect(typeof unsubscribe).toBe('function');
    });

    test('disconnect should not throw', () => {
        expect(() => sync.disconnect()).not.toThrow();
    });
});

describe('fetchAllProjectData', () => {
    test('should return null when not connected', async () => {
        // Reset to uninitialized state by calling initSync with new provider
        const mockConfig = {
            google: {
                clientId: 'test-client-id',
                apiKey: 'test-api-key'
            },
            redirectUri: 'http://localhost'
        };
        sync.initSync(mockConfig);

        // Provider is not connected, should return null
        const result = await sync.fetchAllProjectData();
        expect(result).toBeNull();
    });
});
