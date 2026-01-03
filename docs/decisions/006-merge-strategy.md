# ADR-006: Last-write-wins merge strategy

## Status

Accepted

## Context

When syncing local data with cloud data, conflicts can occur:
- User edits on device A while offline
- User edits on device B while offline
- Both devices sync when online

Merge strategies considered:
1. Last-write-wins (compare timestamps, newer wins)
2. Operational transformation (merge concurrent changes)
3. CRDT (conflict-free replicated data types)
4. Manual conflict resolution (show diff to user)

## Decision

Use last-write-wins based on `updatedAt` timestamps.

## Rationale

**Simplicity**: For a personal productivity tool with a single user, conflicts
are rare. The most recent edit is almost always the intended state.

**Proven pattern**: Scribe uses this approach successfully. No user complaints
about lost data in practice.

**Predictable**: Users understand "newer wins". Complex merge logic can produce
surprising results that are harder to debug.

**Low stakes**: This is personal project tracking, not financial data.
Occasional data loss from a race condition is acceptable given the simplicity
benefit.

## Implementation

```javascript
function merge(local, remote) {
  const merged = new Map();

  // Add all remote items
  for (const item of remote) {
    merged.set(item.id, item);
  }

  // Override with local if newer
  for (const item of local) {
    const existing = merged.get(item.id);
    if (!existing || item.updatedAt > existing.updatedAt) {
      merged.set(item.id, item);
    }
  }

  return Array.from(merged.values());
}
```

## Consequences

- All records must have `updatedAt` timestamps
- Clocks should be reasonably synchronized (browser time)
- Simultaneous edits on multiple devices may lose data
- No undo for sync operations (backup before sync recommended)
