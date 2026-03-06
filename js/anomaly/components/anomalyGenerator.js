function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeColor(hue, saturation, lightness) {
  return `hsl(${hue}deg ${saturation}% ${lightness}%)`;
}

export function generateRoundGrid(seed, layout, baseConfig) {
  const anomalyIndex = randomInt(layout.cells.length);
  const baseSaturation = clamp(54 + seed.level * 3, 54, 82);
  const baseLightness = clamp(72 - seed.level, 54, 72);
  const anomalyLightness = clamp(baseLightness - 6, 42, 68);

  const cells = layout.cells.map((cell, index) => {
    const isAnomaly = index === anomalyIndex;
    const hue = isAnomaly
      ? baseConfig.baseHue + seed.variantStrength
      : baseConfig.baseHue;

    return {
      ...cell,
      isAnomaly,
      label: isAnomaly ? "A" : "N",
      fill: makeColor(hue, baseSaturation, isAnomaly ? anomalyLightness : baseLightness),
      stroke: makeColor(hue - 10, clamp(baseSaturation + 8, 58, 90), clamp(baseLightness - 16, 28, 56))
    };
  });

  const anomalyCell = cells[anomalyIndex];

  return {
    anomalyCellId: anomalyCell.id,
    cells
  };
}
