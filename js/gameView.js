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

function ensureRoot(root) {
  if (!(root instanceof HTMLElement)) {
    throw new Error("Game view root element is required.");
  }
  return root;
}

function buildFallbackContent(content, gameId) {
  const fallbackTitle = createNode("h1", "game-view-title", "Game Not Found");
  const fallbackSummary = createNode(
    "p",
    "game-view-summary",
    `The requested game '${gameId}' is unavailable. Return to the dashboard and choose another tile.`
  );
  content.append(fallbackTitle, fallbackSummary);
}

function buildGameHeader(content, game) {
  const heading = createNode("div", "game-runtime-header");

  const title = createNode("h1", "game-view-title", game.name);
  const summary = createNode("p", "game-view-summary", game.description);

  const meta = createNode("p", "game-view-meta");
  meta.textContent = `${game.mode} | ${game.difficulty}`;

  heading.append(title, summary, meta);
  content.append(heading);
}

export function createGameView(options = {}) {
  const root = ensureRoot(options.root);
  const onBack = typeof options.onBack === "function" ? options.onBack : () => {};
  const resolveGame = typeof options.resolveGame === "function" ? options.resolveGame : () => null;
  const mountGame = typeof options.mountGame === "function" ? options.mountGame : () => () => {};

  root.innerHTML = "";

  const header = createNode("div", "game-view-header");
  const backButton = createNode("button", "game-back-button", "Back To Dashboard");
  backButton.type = "button";
  backButton.addEventListener("click", () => onBack());

  const content = createNode("div", "game-view-content");
  header.append(backButton);
  root.append(header, content);

  let activeGameId = null;
  let activeTeardown = null;

  function unmountActiveGame() {
    if (typeof activeTeardown === "function") {
      activeTeardown();
    }
    activeTeardown = null;
    activeGameId = null;
  }

  function renderGame(gameId) {
    const game = resolveGame(gameId);
    unmountActiveGame();
    content.innerHTML = "";

    if (!game) {
      buildFallbackContent(content, gameId);
      return false;
    }

    buildGameHeader(content, game);

    const runtimeRoot = createNode("section", "game-runtime-root");
    runtimeRoot.setAttribute("aria-label", `${game.name} runtime`);
    content.append(runtimeRoot);

    activeGameId = game.id;
    activeTeardown = mountGame({ game, root: runtimeRoot });

    return true;
  }

  return {
    renderGame,
    unmountActiveGame
  };
}
