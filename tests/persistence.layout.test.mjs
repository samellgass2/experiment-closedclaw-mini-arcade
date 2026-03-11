import assert from "node:assert/strict";

import {
  LAYOUT_SCHEMA_VERSION,
  LAYOUT_STORAGE_KEY,
  loadLayout,
  resetLayout,
  saveLayout
} from "../js/persistence.js";

function createMemoryStorage(options = {}) {
  const values = new Map(Object.entries(options.initialValues ?? {}));

  return {
    getItem(key) {
      if (options.throwOnGet) {
        throw new Error("getItem failed");
      }
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (options.throwOnSet) {
        throw new Error("setItem failed");
      }
      values.set(key, String(value));
    },
    removeItem(key) {
      if (options.throwOnRemove) {
        throw new Error("removeItem failed");
      }
      values.delete(key);
    }
  };
}

function testLoadFallbackToDefaultWithoutStoredLayout() {
  const tileOrder = loadLayout({
    storage: createMemoryStorage(),
    defaultTileOrder: ["racing", "clicker"],
    knownTileIds: ["racing", "clicker", "color-match", "anomaly"]
  });

  assert.deepEqual(tileOrder, ["racing", "clicker"]);
}

function testSaveAndLoadLayoutRoundTrip() {
  const storage = createMemoryStorage();
  const knownTileIds = ["racing", "clicker", "color-match", "anomaly"];

  const saved = saveLayout(
    {
      tileOrder: ["clicker", "clicker", "anomaly", "unknown"]
    },
    {
      storage,
      knownTileIds
    }
  );

  assert.equal(saved, true);

  const parsed = JSON.parse(storage.getItem(LAYOUT_STORAGE_KEY));
  assert.equal(parsed.version, LAYOUT_SCHEMA_VERSION);
  assert.deepEqual(parsed.tileOrder, ["clicker", "anomaly"]);

  const loaded = loadLayout({
    storage,
    defaultTileOrder: ["racing", "clicker"],
    knownTileIds
  });

  assert.deepEqual(loaded, ["clicker", "anomaly"]);
}

function testLoadFallbackOnMalformedJson() {
  const storage = createMemoryStorage({
    initialValues: {
      [LAYOUT_STORAGE_KEY]: "{bad-json"
    }
  });

  const loaded = loadLayout({
    storage,
    defaultTileOrder: ["racing", "clicker"],
    knownTileIds: ["racing", "clicker", "color-match", "anomaly"]
  });

  assert.deepEqual(loaded, ["racing", "clicker"]);
}

function testLoadFallbackOnOlderSchema() {
  const storage = createMemoryStorage({
    initialValues: {
      [LAYOUT_STORAGE_KEY]: JSON.stringify({
        version: 0,
        tileOrder: ["anomaly", "racing"]
      })
    }
  });

  const loaded = loadLayout({
    storage,
    defaultTileOrder: ["racing", "clicker"],
    knownTileIds: ["racing", "clicker", "color-match", "anomaly"]
  });

  assert.deepEqual(loaded, ["racing", "clicker"]);
}

function testStorageFailuresGracefullyFallback() {
  const loaded = loadLayout({
    storage: createMemoryStorage({ throwOnGet: true }),
    defaultTileOrder: ["racing"],
    knownTileIds: ["racing", "clicker"]
  });
  assert.deepEqual(loaded, ["racing"]);

  const saved = saveLayout(
    {
      tileOrder: ["clicker"]
    },
    {
      storage: createMemoryStorage({ throwOnSet: true }),
      knownTileIds: ["racing", "clicker"]
    }
  );
  assert.equal(saved, false);
}

function testResetLayout() {
  const storage = createMemoryStorage({
    initialValues: {
      [LAYOUT_STORAGE_KEY]: JSON.stringify({
        version: LAYOUT_SCHEMA_VERSION,
        tileOrder: ["clicker"]
      })
    }
  });

  const reset = resetLayout({ storage });
  assert.equal(reset, true);
  assert.equal(storage.getItem(LAYOUT_STORAGE_KEY), null);
}

function run() {
  testLoadFallbackToDefaultWithoutStoredLayout();
  testSaveAndLoadLayoutRoundTrip();
  testLoadFallbackOnMalformedJson();
  testLoadFallbackOnOlderSchema();
  testStorageFailuresGracefullyFallback();
  testResetLayout();
  console.log("persistence.layout.test: ok");
}

run();
