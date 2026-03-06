export const DASHBOARD_STATUS = {
  IDLE: "IDLE",
  SUCCESS: "SUCCESS",
  ERROR: "ERROR"
};

export const DASHBOARD_DEFAULT_CATALOG = [
  {
    id: "racing",
    name: "Top-Down Racing",
    description: "Hit your lap target with clean corner exits and fast split times.",
    difficulty: "Medium",
    mode: "Time Trial"
  },
  {
    id: "clicker",
    name: "Combo Clicker",
    description: "Build score multipliers before the round timer expires.",
    difficulty: "Easy",
    mode: "Arcade"
  },
  {
    id: "color-match",
    name: "Color Match",
    description: "Tune RGB channels to match a hidden target color profile.",
    difficulty: "Medium",
    mode: "Precision"
  },
  {
    id: "anomaly",
    name: "Anomaly Detector",
    description: "Scan telemetry tiles and select the abnormal data record.",
    difficulty: "Hard",
    mode: "Puzzle"
  }
];

function cloneCatalogEntry(game) {
  return {
    id: game.id,
    name: game.name,
    description: game.description,
    difficulty: game.difficulty,
    mode: game.mode
  };
}

function normalizeCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return DASHBOARD_DEFAULT_CATALOG.map(cloneCatalogEntry);
  }

  const normalized = [];
  const seen = new Set();

  for (const item of catalog) {
    if (!item || typeof item.id !== "string" || item.id.length === 0 || seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    normalized.push(
      cloneCatalogEntry({
        id: item.id,
        name: typeof item.name === "string" && item.name.length > 0 ? item.name : item.id,
        description:
          typeof item.description === "string" && item.description.length > 0
            ? item.description
            : "No description provided.",
        difficulty:
          typeof item.difficulty === "string" && item.difficulty.length > 0
            ? item.difficulty
            : "Unknown",
        mode: typeof item.mode === "string" && item.mode.length > 0 ? item.mode : "Arcade"
      })
    );
  }

  return normalized.length > 0 ? normalized : DASHBOARD_DEFAULT_CATALOG.map(cloneCatalogEntry);
}

function normalizeInitialTiles(initialTileIds, catalogIds) {
  if (!Array.isArray(initialTileIds)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];

  for (const tileId of initialTileIds) {
    if (typeof tileId !== "string" || tileId.length === 0) {
      continue;
    }

    if (!catalogIds.has(tileId) || seen.has(tileId)) {
      continue;
    }

    seen.add(tileId);
    normalized.push(tileId);
  }

  return normalized;
}

function findCatalogGame(state, tileId) {
  return state.catalogById.get(tileId) ?? null;
}

function createResult(accepted, state, reason, data = {}) {
  return {
    accepted,
    reason,
    state,
    ...data
  };
}

export function createDashboardState(options = {}) {
  const catalog = normalizeCatalog(options.catalog);
  const catalogById = new Map(catalog.map((game) => [game.id, cloneCatalogEntry(game)]));
  const initialTileIds = normalizeInitialTiles(options.initialTileIds, new Set(catalogById.keys()));

  return {
    catalog,
    catalogById,
    maxTiles: Number.isFinite(options.maxTiles) ? Math.max(1, Math.floor(options.maxTiles)) : catalog.length,
    tileIds: [...initialTileIds],
    lastAction: {
      status: DASHBOARD_STATUS.IDLE,
      message: "Add games to build your dashboard."
    }
  };
}

export function getDashboardAvailableGames(state) {
  return state.catalog.filter((game) => !state.tileIds.includes(game.id));
}

export function addDashboardTile(state, tileId, insertionIndex = state.tileIds.length) {
  if (typeof tileId !== "string" || tileId.length === 0) {
    state.lastAction = {
      status: DASHBOARD_STATUS.ERROR,
      message: "Select a valid game before adding a tile."
    };
    return createResult(false, state, "invalid-tile-id");
  }

  if (!findCatalogGame(state, tileId)) {
    state.lastAction = {
      status: DASHBOARD_STATUS.ERROR,
      message: "That game is not available in the catalog."
    };
    return createResult(false, state, "unknown-game");
  }

  if (state.tileIds.includes(tileId)) {
    state.lastAction = {
      status: DASHBOARD_STATUS.ERROR,
      message: "That game tile is already on your dashboard."
    };
    return createResult(false, state, "duplicate-tile");
  }

  if (state.tileIds.length >= state.maxTiles) {
    state.lastAction = {
      status: DASHBOARD_STATUS.ERROR,
      message: "Dashboard is full. Remove a tile before adding another."
    };
    return createResult(false, state, "dashboard-full");
  }

  const index = Math.max(0, Math.min(state.tileIds.length, Math.floor(insertionIndex)));
  state.tileIds.splice(index, 0, tileId);

  const addedGame = findCatalogGame(state, tileId);
  state.lastAction = {
    status: DASHBOARD_STATUS.SUCCESS,
    message: `${addedGame.name} added to dashboard.`
  };

  return createResult(true, state, "tile-added", {
    tileId,
    index
  });
}

export function removeDashboardTile(state, tileId) {
  if (typeof tileId !== "string" || tileId.length === 0) {
    state.lastAction = {
      status: DASHBOARD_STATUS.ERROR,
      message: "Unable to remove tile: missing tile identifier."
    };
    return createResult(false, state, "invalid-tile-id");
  }

  const index = state.tileIds.indexOf(tileId);
  if (index < 0) {
    state.lastAction = {
      status: DASHBOARD_STATUS.ERROR,
      message: "Tile is not currently on the dashboard."
    };
    return createResult(false, state, "tile-not-found");
  }

  state.tileIds.splice(index, 1);
  const removedGame = findCatalogGame(state, tileId);
  state.lastAction = {
    status: DASHBOARD_STATUS.SUCCESS,
    message: `${removedGame ? removedGame.name : "Game"} removed from dashboard.`
  };

  return createResult(true, state, "tile-removed", {
    tileId,
    index
  });
}

export function rearrangeDashboardTiles(state, fromIndex, toIndex) {
  const safeFrom = Number.isFinite(fromIndex) ? Math.floor(fromIndex) : -1;
  const safeTo = Number.isFinite(toIndex) ? Math.floor(toIndex) : -1;

  if (
    safeFrom < 0 ||
    safeFrom >= state.tileIds.length ||
    safeTo < 0 ||
    safeTo >= state.tileIds.length
  ) {
    state.lastAction = {
      status: DASHBOARD_STATUS.ERROR,
      message: "Unable to rearrange tiles with the requested positions."
    };
    return createResult(false, state, "out-of-range");
  }

  if (safeFrom === safeTo) {
    state.lastAction = {
      status: DASHBOARD_STATUS.IDLE,
      message: "Tile order unchanged."
    };
    return createResult(false, state, "no-op");
  }

  const [tileId] = state.tileIds.splice(safeFrom, 1);
  state.tileIds.splice(safeTo, 0, tileId);

  const movedGame = findCatalogGame(state, tileId);
  state.lastAction = {
    status: DASHBOARD_STATUS.SUCCESS,
    message: `${movedGame ? movedGame.name : "Tile"} moved to position ${safeTo + 1}.`
  };

  return createResult(true, state, "tile-moved", {
    tileId,
    fromIndex: safeFrom,
    toIndex: safeTo
  });
}

export function moveDashboardTile(state, tileId, direction) {
  const currentIndex = state.tileIds.indexOf(tileId);
  if (currentIndex < 0) {
    state.lastAction = {
      status: DASHBOARD_STATUS.ERROR,
      message: "Unable to move tile because it is not on the dashboard."
    };
    return createResult(false, state, "tile-not-found");
  }

  const offset = direction === "left" ? -1 : direction === "right" ? 1 : 0;
  const targetIndex = currentIndex + offset;
  if (offset === 0) {
    state.lastAction = {
      status: DASHBOARD_STATUS.ERROR,
      message: "Unsupported move direction."
    };
    return createResult(false, state, "invalid-direction");
  }

  if (targetIndex < 0 || targetIndex >= state.tileIds.length) {
    state.lastAction = {
      status: DASHBOARD_STATUS.IDLE,
      message: "Tile is already at the edge of the dashboard."
    };
    return createResult(false, state, "edge-no-op");
  }

  return rearrangeDashboardTiles(state, currentIndex, targetIndex);
}

export function getDashboardSnapshot(state) {
  const tiles = state.tileIds.map((tileId, index) => {
    const game = findCatalogGame(state, tileId);
    return {
      id: tileId,
      position: index,
      name: game ? game.name : tileId,
      description: game ? game.description : "",
      difficulty: game ? game.difficulty : "",
      mode: game ? game.mode : ""
    };
  });

  return {
    tileIds: [...state.tileIds],
    tileCount: state.tileIds.length,
    availableCount: state.catalog.length - state.tileIds.length,
    maxTiles: state.maxTiles,
    canAddMoreTiles: state.tileIds.length < state.maxTiles,
    tiles,
    availableGames: getDashboardAvailableGames(state).map(cloneCatalogEntry),
    lastAction: {
      status: state.lastAction.status,
      message: state.lastAction.message
    }
  };
}
