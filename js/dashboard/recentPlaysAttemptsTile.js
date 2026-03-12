import { getRecentPlays, getTotalAttempts } from "../persistence.js";

export const RECENT_PLAYS_ATTEMPTS_TILE_ID = "recent-plays-attempts";
const DEFAULT_MAX_RECENT_ITEMS = 5;

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

function formatCount(value) {
  const parsed = Number.parseInt(value, 10);
  return (Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0).toLocaleString("en-US");
}

function formatAbsoluteTimestamp(isoTimestamp) {
  const parsed = Date.parse(isoTimestamp);
  if (!Number.isFinite(parsed)) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(parsed));
}

function formatRelativeTimestamp(isoTimestamp) {
  const parsed = Date.parse(isoTimestamp);
  if (!Number.isFinite(parsed)) {
    return "Unknown time";
  }

  const deltaMs = parsed - Date.now();
  const absDeltaMs = Math.abs(deltaMs);

  if (absDeltaMs < 60 * 1000) {
    return "just now";
  }

  const formatter = new Intl.RelativeTimeFormat("en", {
    numeric: "auto"
  });

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (absDeltaMs < hourMs) {
    return formatter.format(Math.round(deltaMs / minuteMs), "minute");
  }

  if (absDeltaMs < dayMs) {
    return formatter.format(Math.round(deltaMs / hourMs), "hour");
  }

  if (absDeltaMs < 7 * dayMs) {
    return formatter.format(Math.round(deltaMs / dayMs), "day");
  }

  return formatAbsoluteTimestamp(isoTimestamp);
}

function createRecentPlayRow(play) {
  const row = createNode("li", "dashboard-stats-item");
  const gameName = createNode("span", "dashboard-stats-game", play.gameName);

  const timestamp = createNode("time", "dashboard-stats-score", formatRelativeTimestamp(play.playedAt));
  timestamp.dateTime = play.playedAt;
  timestamp.title = formatAbsoluteTimestamp(play.playedAt);

  row.append(gameName, timestamp);
  return row;
}

function createReorderControls(tileTitle, index, tileCount) {
  const controls = createNode("div", "tile-controls");

  const moveLeftButton = createNode("button", "tile-button tile-button-secondary", "Move Left");
  moveLeftButton.type = "button";
  moveLeftButton.dataset.action = "move-left";
  moveLeftButton.disabled = index === 0;
  moveLeftButton.setAttribute("aria-label", `Move ${tileTitle} tile left`);

  const moveRightButton = createNode("button", "tile-button tile-button-secondary", "Move Right");
  moveRightButton.type = "button";
  moveRightButton.dataset.action = "move-right";
  moveRightButton.disabled = index === tileCount - 1;
  moveRightButton.setAttribute("aria-label", `Move ${tileTitle} tile right`);

  const moveUpButton = createNode("button", "tile-button tile-button-secondary", "Move Up");
  moveUpButton.type = "button";
  moveUpButton.dataset.action = "move-up";
  moveUpButton.disabled = index === 0;
  moveUpButton.setAttribute("aria-label", `Move ${tileTitle} tile up`);

  const moveDownButton = createNode("button", "tile-button tile-button-secondary", "Move Down");
  moveDownButton.type = "button";
  moveDownButton.dataset.action = "move-down";
  moveDownButton.disabled = index === tileCount - 1;
  moveDownButton.setAttribute("aria-label", `Move ${tileTitle} tile down`);

  controls.append(moveLeftButton, moveRightButton, moveUpButton, moveDownButton);
  return controls;
}

export function createRecentPlaysAttemptsTileElement(tile, index, tileCount, options = {}) {
  const maxItems = toPositiveInteger(options.maxItems, DEFAULT_MAX_RECENT_ITEMS);
  const tileTitle =
    typeof tile?.name === "string" && tile.name.trim().length > 0 ? tile.name.trim() : "Recent Plays & Attempts";

  const recentPlays = getRecentPlays(maxItems, options.metricsOptions);
  const totalAttempts = getTotalAttempts(options.metricsOptions);

  const item = createNode("li", "dashboard-tile dashboard-stats-tile");
  item.dataset.tileId = tile?.id ?? RECENT_PLAYS_ATTEMPTS_TILE_ID;
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
    `Most recent ${maxItems} plays across all games plus the aggregate attempt count.`
  );

  const scorePanel = createNode("div", "tile-score");
  const scoreLabel = createNode("span", "dashboard-stats-label", "Total Attempts");
  const scoreValue = createNode("strong", "tile-score-value", formatCount(totalAttempts));
  scorePanel.append(scoreLabel, scoreValue);

  const attemptsState = createNode(
    "p",
    "tile-meta",
    totalAttempts > 0 ? "Across all games" : "No attempts recorded yet."
  );

  const list = createNode("ul", "dashboard-stats-list");
  if (recentPlays.length === 0) {
    const empty = createNode(
      "li",
      "dashboard-stats-empty",
      "No recent plays yet. Finish a game session to populate activity."
    );
    list.append(empty);
  } else {
    for (const play of recentPlays) {
      list.append(createRecentPlayRow(play));
    }
  }

  item.append(headingRow, summary, scorePanel, attemptsState, list, createReorderControls(tileTitle, index, tileCount));
  return item;
}

export { DEFAULT_MAX_RECENT_ITEMS };
