import { getGlobalHighScores } from "../persistence.js";

export const HIGH_SCORES_TILE_ID = "global-high-scores";
const DEFAULT_MAX_ITEMS = 6;

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

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function formatScore(value) {
  const parsed = Number.parseInt(value, 10);
  return (Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0).toLocaleString("en-US");
}

export function createHighScoresTileElement(tile, index, tileCount, options = {}) {
  const maxItems = toPositiveInteger(options.maxItems, DEFAULT_MAX_ITEMS);
  const tileTitle =
    typeof tile?.name === "string" && tile.name.trim().length > 0 ? tile.name.trim() : "Global High Scores";
  const perGame = getGlobalHighScores(options.metricsOptions).perGame.slice(0, maxItems);

  const item = createNode("li", "dashboard-tile dashboard-stats-tile");
  item.dataset.tileId = tile?.id ?? HIGH_SCORES_TILE_ID;
  item.dataset.position = String(index);
  item.dataset.tileType = "stats";
  item.draggable = true;
  item.setAttribute("aria-label", `${tileTitle} tile at slot ${index + 1} of ${tileCount}`);

  const headingRow = createNode("div", "tile-heading-row");
  const heading = createNode("h3", "tile-title", tileTitle);
  const position = createNode("p", "tile-position", `Slot ${index + 1} of ${tileCount}`);
  const badge = createNode("p", "tile-score-badge", "Global");
  headingRow.append(heading, badge, position);

  const summary = createNode(
    "p",
    "tile-summary",
    "Best score reached in each game across saved arcade results."
  );

  const scorePanel = createNode("div", "tile-score");
  const scoreLabel = createNode("span", "dashboard-stats-label", "Best Scores");
  const scoreValue = createNode("strong", "tile-score-value", String(perGame.length));
  scorePanel.append(scoreLabel, scoreValue);

  const list = createNode("ul", "dashboard-stats-list");
  if (perGame.length === 0) {
    const empty = createNode("li", "dashboard-stats-empty", "No high scores yet. Play a game to generate stats.");
    list.append(empty);
  } else {
    for (const entry of perGame) {
      const row = createNode("li", "dashboard-stats-item");
      const gameName = createNode("span", "dashboard-stats-game", entry.gameName);
      const gameScore = createNode("strong", "dashboard-stats-score", formatScore(entry.highScore));
      row.append(gameName, gameScore);
      list.append(row);
    }
  }

  item.append(headingRow, summary, scorePanel, list);
  return item;
}
