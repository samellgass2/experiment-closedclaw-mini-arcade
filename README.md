# experiment-mini-arcade

A lightweight browser mini-arcade project with a dashboard shell and multiple game logic modules implemented in modern JavaScript (`.mjs`/ES modules).

## Overview

The app is served as static files:

- `index.html`
- `css/styles.css`
- `js/` modules
- `assets/` graphics

The current default branch is `main`.

## Requirements

- Node.js `18+` (for the built-in Node test runner used by `tests/*.mjs`)
- A modern browser (Chrome, Edge, Firefox, Safari)
- Optional for local static hosting: Python 3 (`python3 -m http.server`)

## Setup

This repository currently has no `package.json`, so there are no npm dependencies to install.

1. Clone and switch to the default branch:

```bash
git clone <your-repo-url>
cd experiment-mini-arcade
git checkout main
```

2. Confirm your Node version:

```bash
node --version
```

## Run the Application

Serve the repository root as static files, then open the app in your browser.

```bash
python3 -m http.server 8000
```

Open:

- `http://localhost:8000/`

## Usage Guide

The default app view is the **Mini Arcade Dashboard**. It starts with an `Active Board` and `Catalog Controls` panel.

### Build and manage your board

1. In `Catalog Controls`, choose a game in the dropdown (`Top-Down Racing`, `Combo Clicker`, `Color Match`, `Anomaly Detector`).
2. Click `Add Tile` to place that game on the `Active Board`.
3. Remove any game tile with its `Remove` button.
4. Reorder tiles with either:
   - `Move Left` / `Move Right` buttons on each tile, or
   - drag-and-drop to a `Drop tile here` insertion slot between tiles.

Important behavior:

- Duplicate tiles are blocked (a game can appear only once on the board).
- The board has a max capacity (`tileCount/maxTiles` shown in the board header).
- When the board is full, add controls are disabled until you remove a tile.

### Launching games from the dashboard

In the current implementation, dashboard tiles are composition cards (arrangement + status) and do **not** include a direct `Play`/navigation action yet.

- You can organize which games are on your board and in what order.
- Score updates are supported through the dashboard API (`window.__MINI_ARCADE_DASHBOARD__.setGameScore(tileId, score)`), which updates tile score UI and feedback.

### UI feedback features

- `dashboardStatus` banner announces latest action and success/error state.
- `Recent Actions` keeps the newest interaction messages (up to 4 items).
- Board and tile pulse/highlight feedback appears after add/remove/move/score updates.
- Tile cards show slot position, mode/difficulty metadata, and current score badge/value.

## Technical Overview

### Architecture

The mini arcade is organized as a dashboard-first single-page web app with modular game domains and a shared persistence utility:

- `Dashboard` layer: hosts the composition UI where users choose, add, remove, and reorder game tiles.
- `Game Tiles` layer: each tile represents one game module and exposes metadata (name, mode, difficulty) plus live score state.
- `Games` layer: individual game domains (`anomaly`, `racing`, `clicker`, `color-match`) each maintain their own game rules and scoring logic.
- `Persistence Layer`: shared storage utilities in `js/storage/score.js` handle score read/write and normalization.

### Main Components

- `Dashboard`
  - Bootstrapped from `js/game.js` through `createDashboardComponent(...)`.
  - Uses dashboard state/logic functions for add/remove/reposition/move actions.
  - Exposes `window.__MINI_ARCADE_DASHBOARD__` for snapshot and score update hooks.
- `Game Tiles`
  - Built by dashboard UI modules (`js/dashboard/component.js`, `js/dashboard/gameTile.js`).
  - Render tile metadata, index position, and score values.
  - Act as composition cards in this build (arrangement + status), not direct game launch routes.
- `Games`
  - Implemented as separated modules under `js/anomaly/`, `js/racing/`, `js/clicker/`, and `js/color-match/`.
  - Encapsulate each game's state machine and scoring behavior.
  - Feed score updates into dashboard-visible tile state via integration points.
- `Persistence Layer`
  - Shared helpers (`resolveStorage`, `readScore`, `writeScore`) abstract browser storage access.
  - Uses browser `localStorage` when available, with safe fallbacks for non-browser/test contexts.
  - Persists best score/best lap style values for cross-session continuity.

### Technology Stack

- `React` (project specification target for UI composition patterns).
- `JavaScript` (ES modules are used across dashboard, games, and tests).
- `Local Storage` (browser `localStorage` via shared persistence helpers).
- `Node.js` test runner (`node --test`) for logic-level validation.

### Data Flow

1. App startup initializes dashboard state from catalog defaults and initial tile IDs.
2. User interactions (add/remove/reorder) dispatch to dashboard logic functions that mutate canonical dashboard state.
3. Dashboard component re-renders tile/order/status views from state snapshots.
4. Game modules compute score changes during gameplay and emit updates to the dashboard API (`setGameScore`).
5. Persistence helpers read/write score-related values through `localStorage` so best values survive reloads.

## Run Tests

Run all logic tests with Node's built-in test runner:

```bash
node --test tests/*.mjs
```

## Project Structure

- `index.html`: app entry page
- `css/styles.css`: global styles
- `js/game.js`: dashboard bootstrap
- `js/dashboard/`: dashboard UI + logic modules
- `js/anomaly/`, `js/racing/`, `js/clicker/`, `js/color-match/`: game modules
- `tests/*.mjs`: Node-based logic tests

## Notes

- There are no npm scripts yet because the project is currently static-file based.
- If a `package.json` is introduced later, setup and run commands should be updated accordingly.
