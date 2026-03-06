function normalizedDelta(value, baseline, tolerance) {
  if (tolerance <= 0) {
    return 0;
  }

  return Math.abs(value - baseline) / tolerance;
}

export function computeDeviationProfile(record, baseline, thresholds) {
  const temperature = normalizedDelta(
    record.temperature,
    baseline.temperature,
    thresholds.temperatureTolerance
  );

  const latency = normalizedDelta(
    record.latency,
    baseline.latency,
    thresholds.latencyTolerance
  );

  const errorRate = normalizedDelta(
    record.errorRate,
    baseline.errorRate,
    thresholds.errorRateTolerance
  );

  const maxMetricDeviation = Math.max(temperature, latency, errorRate);
  const totalDeviation = temperature + latency + errorRate;

  return {
    temperature,
    latency,
    errorRate,
    maxMetricDeviation,
    totalDeviation
  };
}

export function isRecordAnomaly(record, baseline, thresholds) {
  const profile = computeDeviationProfile(record, baseline, thresholds);
  const exceedsSingleMetric = profile.maxMetricDeviation >= thresholds.minSingleMetricDeviation;
  const exceedsTotal = profile.totalDeviation >= thresholds.totalDeviationThreshold;

  return exceedsSingleMetric && exceedsTotal;
}

export function evaluateSelectedCell(roundGrid, cellId, thresholds) {
  const record = roundGrid.recordsByCellId[cellId];
  if (!record) {
    return {
      isAnomaly: false,
      profile: null
    };
  }

  const profile = computeDeviationProfile(record, roundGrid.baseline, thresholds);

  return {
    isAnomaly: isRecordAnomaly(record, roundGrid.baseline, thresholds),
    profile
  };
}
