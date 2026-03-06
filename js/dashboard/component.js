import {
  DASHBOARD_STATUS,
  addDashboardTile,
  createDashboardState,
  getDashboardSnapshot,
  moveDashboardTile,
  repositionDashboardTile,
  removeDashboardTile,
  updateDashboardTileScore
} from "./logic.js";
import { createGameTileElement, updateGameTileElementScore } from "./gameTile.js";

const FEEDBACK_LIMIT = 4;
const FEEDBACK_RESET_MS = 780;

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

function assertRootElement(root) {
  if (!root || !(root instanceof HTMLElement)) {
    throw new Error("Dashboard root element is required.");
  }
  return root;
}

function createDropSlot(insertionIndex) {
  const slot = createNode("li", "dashboard-drop-slot");
  slot.dataset.insertIndex = String(insertionIndex);
  slot.setAttribute("aria-hidden", "true");

  const marker = createNode("span", "dashboard-drop-slot-marker", "Drop tile here");
  slot.append(marker);
  return slot;
}

function renderEmptyState(tileList) {
  const empty = createNode("li", "dashboard-empty");
  empty.textContent = "No game tiles yet. Add one from the catalog to get started.";
  tileList.append(empty);
}

function updateStatusBanner(statusNode, snapshot) {
  statusNode.textContent = snapshot.lastAction.message;
  statusNode.classList.remove("is-idle", "is-success", "is-error");

  if (snapshot.lastAction.status === DASHBOARD_STATUS.SUCCESS) {
    statusNode.classList.add("is-success");
    return;
  }

  if (snapshot.lastAction.status === DASHBOARD_STATUS.ERROR) {
    statusNode.classList.add("is-error");
    return;
  }

  statusNode.classList.add("is-idle");
}

function updateAddControls(addButton, selectNode, snapshot) {
  const availableGames = snapshot.availableGames;

  selectNode.innerHTML = "";
  for (const game of availableGames) {
    const option = document.createElement("option");
    option.value = game.id;
    option.textContent = `${game.name} (${game.mode})`;
    selectNode.append(option);
  }

  const canAdd = availableGames.length > 0 && snapshot.canAddMoreTiles;
  selectNode.disabled = !canAdd;
  addButton.disabled = !canAdd;

  if (!canAdd) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "No additional games available";
    selectNode.append(placeholder);
  }
}

function clearDropTargetStyles(tileList) {
  const highlightedTargets = tileList.querySelectorAll(".dashboard-drop-slot.is-drop-target");
  highlightedTargets.forEach((slot) => slot.classList.remove("is-drop-target"));
}

function createFeedbackItem(message, tone) {
  const item = createNode("li", `dashboard-feedback-item is-${tone}`);
  item.textContent = message;
  return item;
}

function createShell(root) {
  root.innerHTML = "";

  const title = createNode("h1", "dashboard-title", "Mini Arcade Dashboard");
  const subtitle = createNode(
    "p",
    "dashboard-subtitle",
    "Build your game board by adding, removing, and rearranging tiles."
  );

  const layout = createNode("div", "dashboard-layout");

  const controlsPanel = createNode("section", "dashboard-panel dashboard-controls-panel");
  controlsPanel.setAttribute("aria-label", "Dashboard controls");

  const controlsTitle = createNode("h2", "dashboard-panel-title", "Catalog Controls");
  const controlsHelp = createNode(
    "p",
    "dashboard-panel-help",
    "Choose a game from the catalog and add it to your active tile board."
  );

  const toolbar = createNode("div", "dashboard-toolbar");
  toolbar.setAttribute("aria-label", "Dashboard tile controls");

  const select = document.createElement("select");
  select.id = "dashboardGameSelect";
  select.className = "dashboard-select";

  const addButton = createNode("button", "dashboard-add-button", "Add Tile");
  addButton.type = "button";
  addButton.id = "dashboardAddTileButton";

  toolbar.append(select, addButton);

  const status = createNode("p", "dashboard-status is-idle", "");
  status.id = "dashboardStatus";
  status.setAttribute("aria-live", "polite");
  status.setAttribute("role", "status");

  const feedbackTray = createNode("section", "dashboard-feedback-tray");
  feedbackTray.setAttribute("aria-label", "Recent interaction feedback");

  const feedbackTitle = createNode("h3", "dashboard-feedback-title", "Recent Actions");
  const feedbackList = createNode("ul", "dashboard-feedback-list");
  feedbackList.id = "dashboardFeedbackList";
  feedbackList.setAttribute("aria-live", "polite");
  feedbackList.setAttribute("aria-relevant", "additions");
  feedbackTray.append(feedbackTitle, feedbackList);

  controlsPanel.append(controlsTitle, controlsHelp, toolbar, status, feedbackTray);

  const boardPanel = createNode("section", "dashboard-panel dashboard-board-panel");
  boardPanel.setAttribute("aria-label", "Active game tiles");

  const boardHeader = createNode("div", "dashboard-board-header");
  const boardTitle = createNode("h2", "dashboard-panel-title", "Active Board");
  const boardCount = createNode("p", "dashboard-board-count", "");
  boardCount.id = "dashboardTileCount";

  const boardHelp = createNode(
    "p",
    "dashboard-panel-help",
    "Drag any tile and drop it between cards to rearrange your dashboard order."
  );

  const tileList = createNode("ol", "dashboard-grid");
  tileList.id = "dashboardTileList";
  tileList.setAttribute("aria-label", "Active game tiles");

  boardHeader.append(boardTitle, boardCount);
  boardPanel.append(boardHeader, boardHelp, tileList);

  layout.append(controlsPanel, boardPanel);
  root.append(title, subtitle, layout);

  return {
    addButton,
    select,
    status,
    feedbackList,
    tileList,
    boardCount,
    boardPanel
  };
}

export function createDashboardComponent(options = {}) {
  const root = assertRootElement(options.root ?? document.getElementById("dashboardApp"));
  const state = createDashboardState({
    catalog: options.catalog,
    initialTileIds: options.initialTileIds,
    maxTiles: options.maxTiles
  });

  const ui = createShell(root);
  let dragTileId = null;
  let feedbackTimeoutId = null;

  function notifyChange() {
    if (typeof options.onChange === "function") {
      options.onChange(getDashboardSnapshot(state));
    }
  }

  function render() {
    const snapshot = getDashboardSnapshot(state);
    updateStatusBanner(ui.status, snapshot);
    updateAddControls(ui.addButton, ui.select, snapshot);
    ui.boardCount.textContent = `${snapshot.tileCount}/${snapshot.maxTiles} Tiles`;

    ui.tileList.innerHTML = "";
    if (snapshot.tiles.length === 0) {
      renderEmptyState(ui.tileList);
      notifyChange();
      return snapshot;
    }

    ui.tileList.append(createDropSlot(0));
    for (const tile of snapshot.tiles) {
      ui.tileList.append(createGameTileElement(tile, tile.position, snapshot.tileCount));
      ui.tileList.append(createDropSlot(tile.position + 1));
    }

    notifyChange();
    return snapshot;
  }

  function pushFeedbackMessage(message, tone) {
    const normalizedTone = tone === "error" ? "error" : tone === "success" ? "success" : "neutral";
    const item = createFeedbackItem(message, normalizedTone);
    ui.feedbackList.prepend(item);

    while (ui.feedbackList.childElementCount > FEEDBACK_LIMIT) {
      const last = ui.feedbackList.lastElementChild;
      if (!last) {
        break;
      }
      last.remove();
    }
  }

  function pulseElement(element, className) {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  function clearTransientFeedbackStyles() {
    ui.status.classList.remove("is-feedback-success", "is-feedback-error", "is-feedback-neutral");
    ui.boardPanel.classList.remove("is-feedback-add", "is-feedback-remove", "is-feedback-move");
    const highlightedTiles = ui.tileList.querySelectorAll(
      ".dashboard-tile.is-feedback-added, .dashboard-tile.is-feedback-moved, .dashboard-tile.is-feedback-score"
    );
    highlightedTiles.forEach((tile) =>
      tile.classList.remove("is-feedback-added", "is-feedback-moved", "is-feedback-score")
    );
  }

  function scheduleFeedbackReset() {
    if (feedbackTimeoutId) {
      window.clearTimeout(feedbackTimeoutId);
    }
    feedbackTimeoutId = window.setTimeout(() => {
      clearTransientFeedbackStyles();
      feedbackTimeoutId = null;
    }, FEEDBACK_RESET_MS);
  }

  function applyTileFeedback(tileId, className) {
    if (typeof tileId !== "string" || tileId.length === 0) {
      return;
    }
    const tile = ui.tileList.querySelector(`.dashboard-tile[data-tile-id="${tileId}"]`);
    if (!(tile instanceof HTMLElement)) {
      return;
    }
    pulseElement(tile, className);
  }

  function commitActionFeedback(result, options = {}) {
    const snapshot = render();
    const tone =
      snapshot.lastAction.status === DASHBOARD_STATUS.ERROR
        ? "error"
        : snapshot.lastAction.status === DASHBOARD_STATUS.SUCCESS
          ? "success"
          : "neutral";

    pushFeedbackMessage(snapshot.lastAction.message, tone);

    const statusFeedbackClass =
      tone === "error" ? "is-feedback-error" : tone === "success" ? "is-feedback-success" : "is-feedback-neutral";
    pulseElement(ui.status, statusFeedbackClass);

    if (typeof options.boardFeedbackClass === "string") {
      pulseElement(ui.boardPanel, options.boardFeedbackClass);
    }

    if (result.accepted && typeof options.tileFeedbackClass === "string") {
      applyTileFeedback(result.tileId, options.tileFeedbackClass);
    }

    scheduleFeedbackReset();
    return result;
  }

  function resolveTileIdFromDrop(event) {
    return (event.dataTransfer && event.dataTransfer.getData("text/plain")) || dragTileId || "";
  }

  function clearDragStyles() {
    dragTileId = null;
    clearDropTargetStyles(ui.tileList);
    const tiles = ui.tileList.querySelectorAll(".dashboard-tile");
    tiles.forEach((tile) => tile.classList.remove("is-dragging"));
    ui.tileList.classList.remove("is-sorting");
  }

  function handleAdd() {
    const tileId = ui.select.value;
    const result = addDashboardTile(state, tileId);
    commitActionFeedback(result, {
      boardFeedbackClass: "is-feedback-add",
      tileFeedbackClass: "is-feedback-added"
    });
  }

  function handleTileAction(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest("button[data-action]");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const tileElement = button.closest(".dashboard-tile");
    if (!(tileElement instanceof HTMLElement)) {
      return;
    }

    const tileId = tileElement.dataset.tileId;
    if (!tileId) {
      return;
    }

    const action = button.dataset.action;
    if (action === "remove") {
      const result = removeDashboardTile(state, tileId);
      commitActionFeedback(result, {
        boardFeedbackClass: "is-feedback-remove"
      });
      return;
    }

    if (action === "move-left") {
      const result = moveDashboardTile(state, tileId, "left");
      commitActionFeedback(result, {
        boardFeedbackClass: "is-feedback-move",
        tileFeedbackClass: "is-feedback-moved"
      });
      return;
    }

    if (action === "move-right") {
      const result = moveDashboardTile(state, tileId, "right");
      commitActionFeedback(result, {
        boardFeedbackClass: "is-feedback-move",
        tileFeedbackClass: "is-feedback-moved"
      });
    }
  }

  function handleDragStart(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest("button")) {
      event.preventDefault();
      return;
    }

    const tile = target.closest(".dashboard-tile");
    if (!(tile instanceof HTMLElement) || !tile.dataset.tileId) {
      return;
    }

    dragTileId = tile.dataset.tileId;
    tile.classList.add("is-dragging");
    ui.tileList.classList.add("is-sorting");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragTileId);
    }
  }

  function handleDragOver(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const slot = target.closest(".dashboard-drop-slot");
    if (!(slot instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    clearDropTargetStyles(ui.tileList);
    slot.classList.add("is-drop-target");
  }

  function handleDragLeave(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const slot = target.closest(".dashboard-drop-slot");
    if (!(slot instanceof HTMLElement)) {
      return;
    }

    if (event.relatedTarget instanceof Node && slot.contains(event.relatedTarget)) {
      return;
    }

    slot.classList.remove("is-drop-target");
  }

  function handleDrop(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      clearDragStyles();
      return;
    }

    event.preventDefault();
    const sourceTileId = resolveTileIdFromDrop(event);

    if (!sourceTileId) {
      clearDragStyles();
      return;
    }

    const slot = target.closest(".dashboard-drop-slot");
    if (slot instanceof HTMLElement && typeof slot.dataset.insertIndex === "string") {
      const insertIndex = Number.parseInt(slot.dataset.insertIndex, 10);
      const result = repositionDashboardTile(state, sourceTileId, insertIndex);
      clearDragStyles();
      commitActionFeedback(result, {
        boardFeedbackClass: "is-feedback-move",
        tileFeedbackClass: "is-feedback-moved"
      });
      return;
    }

    const dropTile = target.closest(".dashboard-tile");
    if (dropTile instanceof HTMLElement && typeof dropTile.dataset.position === "string") {
      const insertIndex = Number.parseInt(dropTile.dataset.position, 10);
      const result = repositionDashboardTile(state, sourceTileId, insertIndex);
      clearDragStyles();
      commitActionFeedback(result, {
        boardFeedbackClass: "is-feedback-move",
        tileFeedbackClass: "is-feedback-moved"
      });
      return;
    }

    clearDragStyles();
  }

  function handleDragEnd() {
    clearDragStyles();
  }

  function setGameScore(tileId, score) {
    const result = updateDashboardTileScore(state, tileId, score);
    const snapshot = getDashboardSnapshot(state);
    updateStatusBanner(ui.status, snapshot);

    if (!result.accepted) {
      notifyChange();
      return result;
    }

    const tile = ui.tileList.querySelector(`.dashboard-tile[data-tile-id="${tileId}"]`);
    if (!(tile instanceof HTMLElement) || !updateGameTileElementScore(tile, result.score)) {
      commitActionFeedback(result, {
        tileFeedbackClass: "is-feedback-score"
      });
      return result;
    }

    pushFeedbackMessage(snapshot.lastAction.message, "success");
    pulseElement(ui.status, "is-feedback-success");
    applyTileFeedback(tileId, "is-feedback-score");
    scheduleFeedbackReset();
    notifyChange();
    return result;
  }

  function bindEvents() {
    ui.addButton.addEventListener("click", handleAdd);
    ui.tileList.addEventListener("click", handleTileAction);

    ui.tileList.addEventListener("dragstart", handleDragStart);
    ui.tileList.addEventListener("dragover", handleDragOver);
    ui.tileList.addEventListener("dragleave", handleDragLeave);
    ui.tileList.addEventListener("drop", handleDrop);
    ui.tileList.addEventListener("dragend", handleDragEnd);
  }

  bindEvents();
  render();

  return {
    state,
    render,
    getSnapshot: () => getDashboardSnapshot(state),
    setGameScore
  };
}
