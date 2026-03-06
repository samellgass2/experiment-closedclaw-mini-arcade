import { isRecordAnomaly } from "./anomalyEvaluator.js";

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeColor(hue, saturation, lightness) {
  return `hsl(${hue}deg ${saturation}% ${lightness}%)`;
}

function jitter(value, amount) {
  return value + (Math.random() * 2 - 1) * amount;
}

function clampToDecimals(value, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function createBaseline(seed) {
  return {
    temperature: clampToDecimals(22 + seed.level * 0.35 + Math.random() * 3, 2),
    latency: clampToDecimals(45 + seed.level * 1.6 + Math.random() * 8, 2),
    errorRate: clampToDecimals(1.2 + Math.random() * 1.4 + seed.level * 0.08, 3)
  };
}

function createNormalRecord(baseline, thresholds) {
  return {
    temperature: clampToDecimals(jitter(baseline.temperature, thresholds.temperatureTolerance * 0.55), 2),
    latency: clampToDecimals(jitter(baseline.latency, thresholds.latencyTolerance * 0.52), 2),
    errorRate: clampToDecimals(jitter(baseline.errorRate, thresholds.errorRateTolerance * 0.45), 3)
  };
}

function createAnomalousRecord(baseline, thresholds, strengthFactor) {
  const metricIndex = randomInt(3);
  const record = createNormalRecord(baseline, thresholds);
  const direction = Math.random() < 0.5 ? -1 : 1;

  if (metricIndex === 0) {
    record.temperature = clampToDecimals(
      baseline.temperature + direction * thresholds.temperatureTolerance * (2.75 + strengthFactor),
      2
    );
  } else if (metricIndex === 1) {
    record.latency = clampToDecimals(
      baseline.latency + direction * thresholds.latencyTolerance * (2.75 + strengthFactor),
      2
    );
  } else {
    record.errorRate = clampToDecimals(
      Math.max(0, baseline.errorRate + direction * thresholds.errorRateTolerance * (2.75 + strengthFactor)),
      3
    );
  }

  return record;
}

function createCellLabel(record) {
  return `${record.temperature.toFixed(1)}|${record.latency.toFixed(0)}|${record.errorRate.toFixed(2)}`;
}

export function generateRoundGrid(seed, layout, baseConfig) {
  const anomalyIndex = randomInt(layout.cells.length);
  const baseSaturation = clamp(54 + seed.level * 3, 54, 82);
  const baseLightness = clamp(72 - seed.level, 54, 72);
  const anomalyLightness = clamp(baseLightness - 6, 42, 68);
  const thresholds = baseConfig.dataset;
  const baseline = createBaseline(seed);
  const strengthFactor = clamp(seed.variantStrength / 16, 0.1, 2);
  const recordsByCellId = {};

  const cells = layout.cells.map((cell, index) => {
    const isAnomaly = index === anomalyIndex;
    const hue = isAnomaly
      ? baseConfig.baseHue + seed.variantStrength
      : baseConfig.baseHue;
    const record = isAnomaly
      ? createAnomalousRecord(baseline, thresholds, strengthFactor)
      : createNormalRecord(baseline, thresholds);
    recordsByCellId[cell.id] = record;

    return {
      ...cell,
      isAnomaly,
      label: createCellLabel(record),
      fill: makeColor(hue, baseSaturation, isAnomaly ? anomalyLightness : baseLightness),
      stroke: makeColor(hue - 10, clamp(baseSaturation + 8, 58, 90), clamp(baseLightness - 16, 28, 56))
    };
  });

  const anomalyCell = cells.find((cell) => isRecordAnomaly(recordsByCellId[cell.id], baseline, thresholds));

  return {
    anomalyCellId: anomalyCell ? anomalyCell.id : cells[anomalyIndex].id,
    baseline,
    recordsByCellId,
    cells
  };
}
