const LAYOUT_STORAGE_KEY = "miniArcade.dashboard.layout.v1";
const LAYOUT_SCHEMA_VERSION = 1;

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

function isLayoutModel(candidate) {
  return (
    candidate &&
    typeof candidate === "object" &&
    !Array.isArray(candidate) &&
    Number.isInteger(candidate.version) &&
    Array.isArray(candidate.tileOrder)
  );
}

function normalizeLayoutModel(layoutModel, knownTileIds) {
  if (Array.isArray(layoutModel)) {
    // Allow saveLayout to accept a raw tile id list for convenience.
    return {
      version: LAYOUT_SCHEMA_VERSION,
      tileOrder: normalizeTileOrder(layoutModel, knownTileIds)
    };
  }

  if (!layoutModel || typeof layoutModel !== "object") {
    return null;
  }

  const tileOrder = normalizeTileOrder(layoutModel.tileOrder, knownTileIds);

  return {
    version: LAYOUT_SCHEMA_VERSION,
    tileOrder,
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

  return normalizeTileOrder(parsed.tileOrder, options.knownTileIds);
}

export function saveLayout(layoutModel, options = {}) {
  const storageKey = typeof options.storageKey === "string" && options.storageKey.length > 0 ? options.storageKey : LAYOUT_STORAGE_KEY;
  const storage = resolveLayoutStorage(options.storage);

  if (!storage || typeof storage.setItem !== "function") {
    warnPersistence("Cannot persist layout because localStorage is unavailable.");
    return false;
  }

  const normalizedModel = normalizeLayoutModel(layoutModel, options.knownTileIds);
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
