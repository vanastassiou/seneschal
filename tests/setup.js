/**
 * Jest test setup
 * Sets up fake-indexeddb and polyfills for testing in Node.js
 */

import 'fake-indexeddb/auto';
import crypto from 'crypto';

// Polyfill crypto.randomUUID for jsdom
if (!globalThis.crypto) {
    globalThis.crypto = {};
}
if (!globalThis.crypto.randomUUID) {
    globalThis.crypto.randomUUID = () => crypto.randomUUID();
}

// Polyfill structuredClone for jsdom
if (!globalThis.structuredClone) {
    globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}
