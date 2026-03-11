function createNode(tagName, className, textContent = "") {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  if (textContent) {
    node.textContent = textContent;
  }
  return node;
}

function normalizeScore(score) {
  const parsed = Number.parseInt(score, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.floor(parsed));
}

function normalizeLabel(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function formatScore(score) {
  return normalizeScore(score).toLocaleString("en-US");
}

export function createGameTileElement(game, index, tileCount) {
  const gameName = normalizeLabel(game?.name, "Unknown Game");
  const gameDescription = normalizeLabel(game?.description, "No game description available.");
  const gameMode = normalizeLabel(game?.mode, "Arcade");
  const gameDifficulty = normalizeLabel(game?.difficulty, "Unknown");
  const normalizedScore = normalizeScore(game?.score);

  const item = createNode("li", "dashboard-tile");
  item.dataset.tileId = game?.id ?? "";
  item.dataset.position = String(index);
  item.dataset.score = String(normalizedScore);
  item.dataset.gameName = gameName;
  item.draggable = true;
  item.setAttribute("aria-label", `${gameName} tile with current score ${formatScore(normalizedScore)}`);

  const headingRow = createNode("div", "tile-heading-row");
  const heading = createNode("h3", "tile-title", gameName);
  const position = createNode("p", "tile-position", `Slot ${index + 1} of ${tileCount}`);
  const scoreBadge = createNode("p", "tile-score-badge", `Score ${formatScore(normalizedScore)}`);
  headingRow.append(heading, scoreBadge, position);

  const score = createNode("p", "tile-score", "Current Score");
  const scoreValue = createNode("strong", "tile-score-value", formatScore(normalizedScore));
  score.append(scoreValue);

  const summary = createNode("p", "tile-summary", gameDescription);
  const meta = createNode("p", "tile-meta", `${gameMode} | ${gameDifficulty}`);

  const dragHint = createNode("p", "tile-drag-hint", "Drag tile to a drop slot to rearrange.");

  const controls = createNode("div", "tile-controls");

  const playButton = createNode("button", "tile-button tile-button-primary", "Play");
  playButton.type = "button";
  playButton.dataset.action = "play";
  playButton.setAttribute("aria-label", `Open ${gameName} game view`);

  const moveLeftButton = createNode("button", "tile-button tile-button-secondary", "Move Left");
  moveLeftButton.type = "button";
  moveLeftButton.dataset.action = "move-left";
  moveLeftButton.disabled = index === 0;
  moveLeftButton.setAttribute("aria-label", `Move ${gameName} tile left`);

  const moveRightButton = createNode("button", "tile-button tile-button-secondary", "Move Right");
  moveRightButton.type = "button";
  moveRightButton.dataset.action = "move-right";
  moveRightButton.disabled = index === tileCount - 1;
  moveRightButton.setAttribute("aria-label", `Move ${gameName} tile right`);

  const removeButton = createNode("button", "tile-button tile-button-danger", "Remove");
  removeButton.type = "button";
  removeButton.dataset.action = "remove";
  removeButton.setAttribute("aria-label", `Remove ${gameName} tile from dashboard`);

  controls.append(playButton, moveLeftButton, moveRightButton, removeButton);
  item.append(headingRow, summary, meta, dragHint, score, controls);
  return item;
}

export function updateGameTileElementScore(tileElement, score) {
  if (!(tileElement instanceof HTMLElement)) {
    return false;
  }

  const normalizedScore = normalizeScore(score);
  const formattedScore = formatScore(normalizedScore);
  tileElement.dataset.score = String(normalizedScore);
  const value = tileElement.querySelector(".tile-score-value");
  const badge = tileElement.querySelector(".tile-score-badge");
  const gameName = normalizeLabel(tileElement.dataset.gameName, "Unknown Game");

  tileElement.setAttribute("aria-label", `${gameName} tile with current score ${formattedScore}`);

  if (value instanceof HTMLElement) {
    value.textContent = formattedScore;
  }

  if (badge instanceof HTMLElement) {
    badge.textContent = `Score ${formattedScore}`;
  }

  return value instanceof HTMLElement || badge instanceof HTMLElement;
}
