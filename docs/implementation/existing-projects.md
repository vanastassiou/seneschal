# Existing project analysis

## Overview

All three domain projects share common patterns:
- Vanilla JavaScript with ES6 modules
- No build step required
- Custom reactive state management
- AJV for JSON Schema validation (gardener, soapmaker)
- Static JSON data files

## Gardener

**Purpose**: Garden planning with seed inventory and planting calendar

**Tech stack**:
- Vanilla JS (ES6 modules)
- localStorage persistence
- AJV validation
- iCalendar export

**Storage**: localStorage with `gardener_` prefix

**Key files**:
| File | Purpose |
| ---- | ------- |
| `js/main.js` | Entry point, data loading |
| `js/state/state.js` | Proxy-based reactive state |
| `js/lib/persistence.js` | localStorage with auto-save |
| `data/schemas/*.json` | JSON Schema definitions |

**Data model**:
- Seeds: User's seed inventory
- Plants: Reference database (PNW-optimized)
- Climate settings: USDA zone or manual frost dates

**Export formats**: JSON, CSV, ICS (calendar)

## Trainer

**Purpose**: Workout logging, body measurements, fitness research

**Tech stack**:
- Vanilla JS (ES6 modules)
- Native IndexedDB
- Service Worker (offline PWA)
- Vitest for testing

**Storage**: IndexedDB `HealthTracker` database

**Key files**:
| File | Purpose |
| ---- | ------- |
| `js/app.js` | Orchestrator |
| `js/state.js` | Centralized state |
| `js/db.js` | IndexedDB operations |
| `data/schemas/*.json` | JSON Schema definitions |

**Data model**:
- Journal entries: Daily logs (workout, body, daily metrics)
- Programs: Workout templates
- Goals: Fitness targets
- Profile: User settings

**Export formats**: JSON

## Soapmaker

**Purpose**: Soap recipe calculator with lye calculations

**Tech stack**:
- Vanilla JS (ES6 modules)
- localStorage persistence
- AJV validation

**Storage**: localStorage key `soapCalculatorState`

**Key files**:
| File | Purpose |
| ---- | ------- |
| `js/main.js` | App orchestration |
| `js/state/state.js` | Proxy-based reactive state |
| `js/core/calculator.js` | Lye and property calculations |
| `js/core/optimizer.js` | Recipe optimization |
| `data/schemas/*.json` | JSON Schema definitions |

**Data model**:
- Recipe: Selected fats with percentages
- Additives: Fragrances, colorants
- Cupboard: Available fats for optimization

**Export formats**: JSON (implicit via state persistence)

## Common patterns

### State management

All projects use a Proxy-based reactive state:

```javascript
// Typical pattern
const state = createReactiveState(initialState);
state.subscribe('key', (newValue) => updateUI(newValue));
state.set('key', newValue);
```

### Persistence

```javascript
// gardener/soapmaker: localStorage
function saveState() {
  localStorage.setItem(KEY, JSON.stringify(state.export()));
}

// trainer: IndexedDB
async function saveJournal(entry) {
  const tx = db.transaction('journals', 'readwrite');
  await tx.objectStore('journals').put(entry);
}
```

### Data loading

All projects load static JSON on startup:

```javascript
const [plants, glossary] = await Promise.all([
  fetch('data/plants.json').then(r => r.json()),
  fetch('data/glossary.json').then(r => r.json())
]);
```

## Integration points for sync

### Gardener

Modify `js/lib/persistence.js`:
- Add sync engine import
- Call sync after `saveState()`
- Handle merge in `restoreState()`

### Trainer

Modify `js/db.js`:
- Add sync engine import
- Export all stores as single JSON
- Import merged data to stores

### Soapmaker

Modify `js/state/state.js`:
- Add sync engine import
- Call sync after state changes
- Merge incoming data with local state
