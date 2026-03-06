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

export function createGameTileElement(game, index, tileCount) {
  const item = createNode("li", "dashboard-tile");
  item.dataset.tileId = game.id;
  item.dataset.position = String(index);
  item.dataset.score = String(normalizeScore(game.score));
  item.draggable = true;

  const heading = createNode("h3", "tile-title", game.name);
  const summary = createNode("p", "tile-summary", game.description);
  const meta = createNode("p", "tile-meta", `${game.mode} | ${game.difficulty}`);
  const score = createNode("p", "tile-score");
  score.innerHTML = `Current Score: <strong class="tile-score-value">${item.dataset.score}</strong>`;

  const controls = createNode("div", "tile-controls");

  const moveLeftButton = createNode("button", "tile-button tile-button-secondary", "Move Left");
  moveLeftButton.type = "button";
  moveLeftButton.dataset.action = "move-left";
  moveLeftButton.disabled = index === 0;
  moveLeftButton.setAttribute("aria-label", `Move ${game.name} tile left`);

  const moveRightButton = createNode("button", "tile-button tile-button-secondary", "Move Right");
  moveRightButton.type = "button";
  moveRightButton.dataset.action = "move-right";
  moveRightButton.disabled = index === tileCount - 1;
  moveRightButton.setAttribute("aria-label", `Move ${game.name} tile right`);

  const removeButton = createNode("button", "tile-button tile-button-danger", "Remove");
  removeButton.type = "button";
  removeButton.dataset.action = "remove";
  removeButton.setAttribute("aria-label", `Remove ${game.name} tile from dashboard`);

  controls.append(moveLeftButton, moveRightButton, removeButton);
  item.append(heading, summary, meta, score, controls);
  return item;
}

export function updateGameTileElementScore(tileElement, score) {
  if (!(tileElement instanceof HTMLElement)) {
    return false;
  }

  const normalizedScore = normalizeScore(score);
  tileElement.dataset.score = String(normalizedScore);
  const value = tileElement.querySelector(".tile-score-value");
  if (value instanceof HTMLElement) {
    value.textContent = String(normalizedScore);
    return true;
  }

  return false;
}
