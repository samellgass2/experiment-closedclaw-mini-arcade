import assert from "node:assert/strict";

import { readScore, resolveStorage, writeScore } from "../js/storage/score.js";

function createMemoryStorage() {
  return {
    map: new Map(),
    getItem(key) {
      return this.map.has(key) ? this.map.get(key) : null;
    },
    setItem(key, value) {
      this.map.set(key, String(value));
    }
  };
}

function testReadWriteRoundTrip() {
  const storage = createMemoryStorage();

  const writeAccepted = writeScore(storage, "test-score", 42.9);
  assert.equal(writeAccepted, true);
  assert.equal(storage.getItem("test-score"), "42");
  assert.equal(readScore(storage, "test-score"), 42);
}

function testReadFallsBackForInvalidStoredValues() {
  const storage = createMemoryStorage();
  storage.setItem("broken-score", "not-a-number");

  assert.equal(readScore(storage, "broken-score", 7), 7);
  assert.equal(readScore(storage, "missing-score", 5), 5);
}

function testWriteHandlesStorageFailures() {
  const throwingStorage = {
    setItem() {
      throw new Error("write denied");
    }
  };

  assert.equal(writeScore(throwingStorage, "score", 10), false);
}

function testResolveStorage() {
  const provided = createMemoryStorage();
  assert.equal(resolveStorage(provided), provided);
  assert.equal(resolveStorage(null), null, "non-browser environments should not resolve localStorage");
}

function run() {
  testReadWriteRoundTrip();
  testReadFallsBackForInvalidStoredValues();
  testWriteHandlesStorageFailures();
  testResolveStorage();
  console.log("storage.score.test: ok");
}

run();
