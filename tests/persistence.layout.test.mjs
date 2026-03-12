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
  const knownTileIds = ["global-high-scores", "recent-plays-attempts", "racing", "clicker", "color-match", "anomaly"];
  const knownTileTypes = {
    "global-high-scores": "stats",
    "recent-plays-attempts": "stats",
    racing: "game",
    clicker: "game",
    "color-match": "game",
    anomaly: "game"
  };

  const saved = saveLayout(
    {
      tileOrder: ["global-high-scores", "clicker", "clicker", "anomaly", "unknown"]
    },
    {
      storage,
      knownTileIds,
      knownTileTypes
    }
  );

  assert.equal(saved, true);

  const parsed = JSON.parse(storage.getItem(LAYOUT_STORAGE_KEY));
  assert.equal(parsed.version, LAYOUT_SCHEMA_VERSION);
  assert.deepEqual(parsed.tileOrder, ["global-high-scores", "clicker", "anomaly"]);
  assert.deepEqual(parsed.tiles, [
    { id: "global-high-scores", tileType: "stats" },
    { id: "clicker", tileType: "game" },
    { id: "anomaly", tileType: "game" }
  ]);

  const loaded = loadLayout({
    storage,
    defaultTileOrder: ["global-high-scores", "racing", "clicker"],
    knownTileIds,
    knownTileTypes
  });

  assert.deepEqual(loaded, ["global-high-scores", "clicker", "anomaly"]);
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

function testLoadLayoutFromTypedTilesOnly() {
  const storage = createMemoryStorage({
    initialValues: {
      [LAYOUT_STORAGE_KEY]: JSON.stringify({
        version: LAYOUT_SCHEMA_VERSION,
        tiles: [
          { id: "global-high-scores", tileType: "stats" },
          { id: "clicker", tileType: "game" },
          { id: "clicker", tileType: "game" },
          { id: "unknown", tileType: "stats" }
        ]
      })
    }
  });

  const loaded = loadLayout({
    storage,
    defaultTileOrder: ["global-high-scores", "racing", "clicker"],
    knownTileIds: ["global-high-scores", "recent-plays-attempts", "racing", "clicker"]
  });

  assert.deepEqual(loaded, ["global-high-scores", "clicker"]);
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
  testLoadLayoutFromTypedTilesOnly();
  testStorageFailuresGracefullyFallback();
  testResetLayout();
  console.log("persistence.layout.test: ok");
}

run();
