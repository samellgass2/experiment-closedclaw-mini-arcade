import {
  DASHBOARD_STATUS,
  addDashboardTile,
  createDashboardState,
  getDashboardSnapshot,
  moveDashboardTile,
  rearrangeDashboardTiles,
  removeDashboardTile
} from "./logic.js";

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

function renderEmptyState(tileList) {
  const empty = createNode("li", "dashboard-empty");
  empty.textContent = "No game tiles yet. Add one from the catalog to get started.";
  tileList.append(empty);
}

function createTile(game, index, tileCount) {
  const item = createNode("li", "dashboard-tile");
  item.dataset.tileId = game.id;
  item.dataset.position = String(index);
  item.draggable = true;

  const heading = createNode("h3", "tile-title", game.name);
  const summary = createNode("p", "tile-summary", game.description);
  const meta = createNode("p", "tile-meta", `${game.mode} | ${game.difficulty}`);

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
  item.append(heading, summary, meta, controls);
  return item;
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

function createShell(root) {
  root.innerHTML = "";

  const title = createNode("h1", "dashboard-title", "Mini Arcade Dashboard");
  const subtitle = createNode(
    "p",
    "dashboard-subtitle",
    "Build your game board by adding, removing, and rearranging tiles."
  );

  const toolbar = createNode("section", "dashboard-toolbar");
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

  const tileList = createNode("ol", "dashboard-grid");
  tileList.id = "dashboardTileList";
  tileList.setAttribute("aria-label", "Active game tiles");

  root.append(title, subtitle, toolbar, status, tileList);

  return {
    addButton,
    select,
    status,
    tileList
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

  function notifyChange() {
    if (typeof options.onChange === "function") {
      options.onChange(getDashboardSnapshot(state));
    }
  }

  function render() {
    const snapshot = getDashboardSnapshot(state);
    updateStatusBanner(ui.status, snapshot);
    updateAddControls(ui.addButton, ui.select, snapshot);

    ui.tileList.innerHTML = "";
    if (snapshot.tiles.length === 0) {
      renderEmptyState(ui.tileList);
      notifyChange();
      return snapshot;
    }

    for (const tile of snapshot.tiles) {
      ui.tileList.append(createTile(tile, tile.position, snapshot.tileCount));
    }

    notifyChange();
    return snapshot;
  }

  function handleAdd() {
    const tileId = ui.select.value;
    addDashboardTile(state, tileId);
    render();
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
      removeDashboardTile(state, tileId);
      render();
      return;
    }

    if (action === "move-left") {
      moveDashboardTile(state, tileId, "left");
      render();
      return;
    }

    if (action === "move-right") {
      moveDashboardTile(state, tileId, "right");
      render();
    }
  }

  function handleDragStart(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const tile = target.closest(".dashboard-tile");
    if (!(tile instanceof HTMLElement) || !tile.dataset.tileId) {
      return;
    }

    dragTileId = tile.dataset.tileId;
    tile.classList.add("is-dragging");
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

    const tile = target.closest(".dashboard-tile");
    if (!(tile instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    tile.classList.add("is-drop-target");
  }

  function handleDragLeave(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const tile = target.closest(".dashboard-tile");
    if (!(tile instanceof HTMLElement)) {
      return;
    }

    tile.classList.remove("is-drop-target");
  }

  function clearDragStyles() {
    const tiles = ui.tileList.querySelectorAll(".dashboard-tile");
    tiles.forEach((tile) => tile.classList.remove("is-drop-target", "is-dragging"));
  }

  function handleDrop(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const dropTile = target.closest(".dashboard-tile");
    if (!(dropTile instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    const sourceTileId =
      (event.dataTransfer && event.dataTransfer.getData("text/plain")) || dragTileId || "";

    if (!sourceTileId || !dropTile.dataset.tileId || sourceTileId === dropTile.dataset.tileId) {
      clearDragStyles();
      return;
    }

    const sourceIndex = state.tileIds.indexOf(sourceTileId);
    const targetIndex = state.tileIds.indexOf(dropTile.dataset.tileId);
    rearrangeDashboardTiles(state, sourceIndex, targetIndex);
    clearDragStyles();
    render();
  }

  function handleDragEnd() {
    dragTileId = null;
    clearDragStyles();
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
    getSnapshot: () => getDashboardSnapshot(state)
  };
}
