function asNonNegativeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
}

export function resolveStorage(storageOverride) {
  if (storageOverride) {
    return storageOverride;
  }

  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function readScore(storage, key, fallback = 0) {
  if (!storage || typeof storage.getItem !== "function" || typeof key !== "string" || !key.length) {
    return asNonNegativeInteger(fallback, 0);
  }

  try {
    const rawValue = storage.getItem(key);
    return asNonNegativeInteger(rawValue, fallback);
  } catch (_error) {
    return asNonNegativeInteger(fallback, 0);
  }
}

export function writeScore(storage, key, value) {
  if (!storage || typeof storage.setItem !== "function" || typeof key !== "string" || !key.length) {
    return false;
  }

  const normalizedValue = asNonNegativeInteger(value, 0);

  try {
    storage.setItem(key, String(normalizedValue));
    return true;
  } catch (_error) {
    return false;
  }
}
