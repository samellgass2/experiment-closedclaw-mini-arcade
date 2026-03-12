const LAYOUT_STORAGE_KEY = "miniArcade.dashboard.layout.v1";
const LAYOUT_SCHEMA_VERSION = 1;
const DEFAULT_RECENT_PLAYS_LIMIT = 10;

const DEFAULT_GLOBAL_METRIC_GAME_DEFINITIONS = [
  {
    id: "anomaly",
    name: "Anomaly Detector",
    scalarScoreKeys: ["anomaly-detector-best-score"],
    summaryKeys: ["miniArcade.anomaly.summary.v1", "anomaly-summary"],
    historyKeys: ["miniArcade.anomaly.history.v1", "anomaly-history"]
  },
  {
    id: "clicker",
    name: "Combo Clicker",
    scalarScoreKeys: ["clicker-best-score"],
    summaryKeys: ["miniArcade.clicker.summary.v1", "clicker-summary"],
    historyKeys: ["miniArcade.clicker.history.v1", "clicker-history"]
  },
  {
    id: "color-match",
    name: "Color Match",
    scalarScoreKeys: ["color-match-best-score"],
    summaryKeys: ["miniArcade.color-match.summary.v1", "color-match-summary"],
    historyKeys: ["miniArcade.color-match.history.v1", "color-match-history"]
  },
  {
    id: "racing",
    name: "Top-Down Racing",
    scalarScoreKeys: ["mini-arcade-racing-best-lap"],
    summaryKeys: ["miniArcade.racing.summary.v1", "racing-summary"],
    historyKeys: ["miniArcade.racing.history.v1", "racing-history"]
  }
];

function warnPersistence(message, error) {
  if (typeof console === "undefined" || typeof console.warn !== "function") {
    return;
  }

  if (error) {
    console.warn(`[layout-persistence] ${message}`, error);
    return;
  }

  console.warn(`[layout-persistence] ${message}`);
}

function normalizeTileOrder(tileOrder, knownTileIds) {
  if (!Array.isArray(tileOrder)) {
    return [];
  }

  const allowed =
    knownTileIds instanceof Set
      ? knownTileIds
      : Array.isArray(knownTileIds)
        ? new Set(knownTileIds)
        : null;

  const normalized = [];
  const seen = new Set();

  for (const tileId of tileOrder) {
    if (typeof tileId !== "string" || tileId.length === 0 || seen.has(tileId)) {
      continue;
    }

    if (allowed && !allowed.has(tileId)) {
      continue;
    }

    seen.add(tileId);
    normalized.push(tileId);
  }

  return normalized;
}

function normalizeKnownTileTypeMap(knownTileTypes) {
  if (knownTileTypes instanceof Map) {
    return knownTileTypes;
  }

  if (knownTileTypes && typeof knownTileTypes === "object") {
    return new Map(Object.entries(knownTileTypes));
  }

  return new Map();
}

function normalizeTileType(tileType) {
  return tileType === "stats" ? "stats" : "game";
}

function normalizeTileEntries(tileEntries, knownTileIds, knownTileTypes) {
  const tileTypeMap = normalizeKnownTileTypeMap(knownTileTypes);
  const tileOrder = normalizeTileOrder(
    Array.isArray(tileEntries)
      ? tileEntries.map((entry) => (typeof entry === "string" ? entry : entry?.id))
      : [],
    knownTileIds
  );

  return tileOrder.map((tileId) => {
    const sourceEntry = Array.isArray(tileEntries)
      ? tileEntries.find((entry) => (typeof entry === "object" && entry !== null ? entry.id === tileId : false))
      : null;
    const mappedType = tileTypeMap.get(tileId);
    return {
      id: tileId,
      tileType: normalizeTileType(sourceEntry?.tileType ?? sourceEntry?.type ?? mappedType)
    };
  });
}

function isLayoutModel(candidate) {
  return (
    candidate &&
    typeof candidate === "object" &&
    !Array.isArray(candidate) &&
    Number.isInteger(candidate.version) &&
    (Array.isArray(candidate.tileOrder) || Array.isArray(candidate.tiles))
  );
}

function normalizeLayoutModel(layoutModel, knownTileIds, knownTileTypes) {
  if (Array.isArray(layoutModel)) {
    const tiles = normalizeTileEntries(layoutModel, knownTileIds, knownTileTypes);
    // Allow saveLayout to accept a raw tile id list for convenience.
    return {
      version: LAYOUT_SCHEMA_VERSION,
      tileOrder: tiles.map((tile) => tile.id),
      tiles,
      updatedAt: new Date().toISOString()
    };
  }

  if (!layoutModel || typeof layoutModel !== "object") {
    return null;
  }

  const tiles = normalizeTileEntries(
    Array.isArray(layoutModel.tiles) ? layoutModel.tiles : layoutModel.tileOrder,
    knownTileIds,
    layoutModel.knownTileTypes ?? knownTileTypes
  );
  const tileOrder = tiles.map((tile) => tile.id);

  return {
    version: LAYOUT_SCHEMA_VERSION,
    tileOrder,
    tiles,
    updatedAt: new Date().toISOString()
  };
}

function resolveLayoutStorage(storageOverride) {
  if (storageOverride !== undefined) {
    return storageOverride;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch (error) {
    warnPersistence("localStorage is unavailable; using in-memory layout only.", error);
    return null;
  }
}

export { LAYOUT_SCHEMA_VERSION, LAYOUT_STORAGE_KEY, resolveLayoutStorage };

export function loadLayout(options = {}) {
  const defaultTileOrder = normalizeTileOrder(options.defaultTileOrder, options.knownTileIds);
  const storageKey = typeof options.storageKey === "string" && options.storageKey.length > 0 ? options.storageKey : LAYOUT_STORAGE_KEY;
  const storage = resolveLayoutStorage(options.storage);

  if (!storage || typeof storage.getItem !== "function") {
    return [...defaultTileOrder];
  }

  let rawValue = null;
  try {
    rawValue = storage.getItem(storageKey);
  } catch (error) {
    warnPersistence(`Could not read layout key '${storageKey}'. Falling back to defaults.`, error);
    return [...defaultTileOrder];
  }

  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return [...defaultTileOrder];
  }

  let parsed = null;
  try {
    parsed = JSON.parse(rawValue);
  } catch (error) {
    warnPersistence(`Layout key '${storageKey}' contained invalid JSON. Falling back to defaults.`, error);
    return [...defaultTileOrder];
  }

  if (!isLayoutModel(parsed)) {
    warnPersistence(
      `Layout key '${storageKey}' is invalid or from an unsupported schema. Falling back to defaults.`
    );
    return [...defaultTileOrder];
  }

  if (parsed.version !== LAYOUT_SCHEMA_VERSION) {
    warnPersistence(
      `Layout key '${storageKey}' uses schema version ${parsed.version}; expected ${LAYOUT_SCHEMA_VERSION}. Falling back to defaults.`
    );
    return [...defaultTileOrder];
  }

  if (Array.isArray(parsed.tileOrder)) {
    return normalizeTileOrder(parsed.tileOrder, options.knownTileIds);
  }

  const tiles = normalizeTileEntries(parsed.tiles, options.knownTileIds, options.knownTileTypes);
  return tiles.map((tile) => tile.id);
}

export function saveLayout(layoutModel, options = {}) {
  const storageKey = typeof options.storageKey === "string" && options.storageKey.length > 0 ? options.storageKey : LAYOUT_STORAGE_KEY;
  const storage = resolveLayoutStorage(options.storage);

  if (!storage || typeof storage.setItem !== "function") {
    warnPersistence("Cannot persist layout because localStorage is unavailable.");
    return false;
  }

  const normalizedModel = normalizeLayoutModel(layoutModel, options.knownTileIds, options.knownTileTypes);
  if (!normalizedModel) {
    warnPersistence("Cannot persist layout because the layout model is invalid.");
    return false;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(normalizedModel));
    return true;
  } catch (error) {
    warnPersistence(`Failed to persist layout key '${storageKey}'.`, error);
    return false;
  }
}

export function resetLayout(options = {}) {
  const storageKey = typeof options.storageKey === "string" && options.storageKey.length > 0 ? options.storageKey : LAYOUT_STORAGE_KEY;
  const storage = resolveLayoutStorage(options.storage);

  if (!storage || typeof storage.removeItem !== "function") {
    warnPersistence("Cannot reset layout because localStorage is unavailable.");
    return false;
  }

  try {
    storage.removeItem(storageKey);
    return true;
  } catch (error) {
    warnPersistence(`Failed to reset layout key '${storageKey}'.`, error);
    return false;
  }
}

function toNonNegativeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Math.floor(fallback));
  }

  return Math.max(0, Math.floor(parsed));
}

function toTimestampMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 ? Math.floor(value) : null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveGlobalMetricDefinitions(options = {}) {
  if (!Array.isArray(options.gameDefinitions)) {
    return DEFAULT_GLOBAL_METRIC_GAME_DEFINITIONS;
  }

  const normalized = [];
  for (const definition of options.gameDefinitions) {
    if (!definition || typeof definition.id !== "string" || definition.id.length === 0) {
      continue;
    }

    normalized.push({
      id: definition.id,
      name:
        typeof definition.name === "string" && definition.name.length > 0
          ? definition.name
          : definition.id,
      scalarScoreKeys: Array.isArray(definition.scalarScoreKeys) ? definition.scalarScoreKeys : [],
      summaryKeys: Array.isArray(definition.summaryKeys) ? definition.summaryKeys : [],
      historyKeys: Array.isArray(definition.historyKeys) ? definition.historyKeys : []
    });
  }

  return normalized.length > 0 ? normalized : DEFAULT_GLOBAL_METRIC_GAME_DEFINITIONS;
}

function readStorageRawValue(storage, key) {
  if (!storage || typeof storage.getItem !== "function" || typeof key !== "string" || key.length === 0) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch (error) {
    warnPersistence(`Could not read global-metrics key '${key}'.`, error);
    return null;
  }
}

function readStorageJsonValue(storage, key) {
  const rawValue = readStorageRawValue(storage, key);
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    warnPersistence(`Global-metrics key '${key}' contained invalid JSON. Ignoring value.`, error);
    return null;
  }
}

function getFirstObjectFromKeys(storage, keys) {
  for (const key of keys) {
    const value = readStorageJsonValue(storage, key);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
  }

  return null;
}

function getFirstHistoryFromKeys(storage, keys) {
  for (const key of keys) {
    const value = readStorageJsonValue(storage, key);
    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === "object") {
      const nested = value.history ?? value.entries ?? value.results ?? value.plays;
      if (Array.isArray(nested)) {
        return nested;
      }
    }
  }

  return [];
}

function pickFirstInteger(candidate, keys, fallback = 0) {
  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }

  for (const key of keys) {
    const value = candidate[key];
    if (value == null) {
      continue;
    }
    return toNonNegativeInteger(value, fallback);
  }

  return fallback;
}

function pickFirstTimestamp(candidate, keys) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  for (const key of keys) {
    const timestampMs = toTimestampMs(candidate[key]);
    if (timestampMs !== null) {
      return timestampMs;
    }
  }

  return null;
}

function mapHistoryEntry(entry, gameId, gameName) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const playedAtMs = pickFirstTimestamp(entry, [
    "playedAt",
    "playedAtMs",
    "finishedAt",
    "completedAt",
    "timestamp",
    "at"
  ]);
  if (playedAtMs === null) {
    return null;
  }

  return {
    gameId,
    gameName,
    score: pickFirstInteger(entry, ["score", "points", "totalScore", "bestScore"], 0),
    playedAt: new Date(playedAtMs).toISOString(),
    playedAtMs
  };
}

function collectGameMetricRecord(storage, definition) {
  const summary = getFirstObjectFromKeys(storage, definition.summaryKeys);
  const history = getFirstHistoryFromKeys(storage, definition.historyKeys);

  let scalarHighScore = 0;
  for (const scoreKey of definition.scalarScoreKeys) {
    scalarHighScore = Math.max(
      scalarHighScore,
      toNonNegativeInteger(readStorageRawValue(storage, scoreKey), 0)
    );
  }

  const historyEntries = history
    .map((entry) => mapHistoryEntry(entry, definition.id, definition.name))
    .filter(Boolean);
  const historyHighScore = historyEntries.reduce(
    (highest, entry) => Math.max(highest, toNonNegativeInteger(entry.score, 0)),
    0
  );
  const summaryHighScore = pickFirstInteger(summary, ["highScore", "bestScore", "topScore", "score"], 0);

  const attemptsFromSummary = pickFirstInteger(
    summary,
    ["totalAttempts", "attempts", "playCount", "gamesPlayed", "sessionsPlayed"],
    0
  );
  const attempts = Math.max(attemptsFromSummary, historyEntries.length);
  const highScore = Math.max(scalarHighScore, summaryHighScore, historyHighScore);

  const lastPlayedAtMs = pickFirstTimestamp(summary, ["lastPlayedAt", "updatedAt", "lastAttemptAt", "playedAt"]);
  if (historyEntries.length === 0 && lastPlayedAtMs !== null) {
    historyEntries.push({
      gameId: definition.id,
      gameName: definition.name,
      score: Math.max(highScore, pickFirstInteger(summary, ["lastScore", "recentScore"], 0)),
      playedAt: new Date(lastPlayedAtMs).toISOString(),
      playedAtMs: lastPlayedAtMs
    });
  }

  return {
    gameId: definition.id,
    gameName: definition.name,
    highScore,
    attempts,
    recentPlays: historyEntries
  };
}

function collectGlobalMetricRecords(options = {}) {
  const storage = resolveLayoutStorage(options.storage);
  if (!storage || typeof storage.getItem !== "function") {
    return [];
  }

  const definitions = resolveGlobalMetricDefinitions(options);
  return definitions.map((definition) => collectGameMetricRecord(storage, definition));
}

/**
 * Returns score-oriented aggregates for stats widgets.
 * Shape: { perGame: [{ gameId, gameName, highScore }], overall: { gameId, gameName, highScore } | null }.
 */
export function getGlobalHighScores(options = {}) {
  const perGame = collectGlobalMetricRecords(options)
    .filter((record) => record.highScore > 0)
    .map((record) => ({
      gameId: record.gameId,
      gameName: record.gameName,
      highScore: record.highScore
    }))
    .sort((a, b) => b.highScore - a.highScore);

  return {
    perGame,
    overall: perGame.length > 0 ? perGame[0] : null
  };
}

/**
 * Returns the most recent play records across games.
 * Each item shape: { gameId, gameName, score, playedAt } where playedAt is an ISO timestamp.
 */
export function getRecentPlays(limit = DEFAULT_RECENT_PLAYS_LIMIT, options = {}) {
  const normalizedLimit = toNonNegativeInteger(limit, DEFAULT_RECENT_PLAYS_LIMIT);
  if (normalizedLimit === 0) {
    return [];
  }

  return collectGlobalMetricRecords(options)
    .flatMap((record) => record.recentPlays)
    .sort((a, b) => b.playedAtMs - a.playedAtMs)
    .slice(0, normalizedLimit)
    .map((record) => ({
      gameId: record.gameId,
      gameName: record.gameName,
      score: record.score,
      playedAt: record.playedAt
    }));
}

/**
 * Returns the sum of attempts across all games derived from summary attempt counts
 * and/or history length when summary counters are unavailable.
 */
export function getTotalAttempts(options = {}) {
  return collectGlobalMetricRecords(options).reduce((total, record) => total + record.attempts, 0);
}

export { DEFAULT_GLOBAL_METRIC_GAME_DEFINITIONS };
