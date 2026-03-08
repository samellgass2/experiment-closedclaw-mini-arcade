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
