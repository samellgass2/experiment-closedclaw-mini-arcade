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

function buildGameContent(game) {
  const fragment = document.createDocumentFragment();

  const title = createNode("h1", "game-view-title", game.name);
  const summary = createNode("p", "game-view-summary", game.description);
  const panel = createNode("section", "game-view-panel");
  panel.setAttribute("aria-label", `${game.name} details`);
  panel.innerHTML = `
    <p><strong>Mode:</strong> ${game.mode}</p>
    <p><strong>Difficulty:</strong> ${game.difficulty}</p>
    <p>This workspace currently uses a shared game-view host. Hook game-specific runtime here in follow-up workflows.</p>
  `;

  fragment.append(title, summary, panel);
  return fragment;
}

export function createGameView(options = {}) {
  const root = ensureRoot(options.root);
  const onBack = typeof options.onBack === "function" ? options.onBack : () => {};
  const resolveGame = typeof options.resolveGame === "function" ? options.resolveGame : () => null;

  root.innerHTML = "";

  const header = createNode("div", "game-view-header");
  const backButton = createNode("button", "game-back-button", "Back To Dashboard");
  backButton.type = "button";
  backButton.addEventListener("click", () => onBack());

  const content = createNode("div", "game-view-content");
  header.append(backButton);
  root.append(header, content);

  function renderGame(gameId) {
    const game = resolveGame(gameId);
    content.innerHTML = "";

    if (!game) {
      const fallbackTitle = createNode("h1", "game-view-title", "Game Not Found");
      const fallbackSummary = createNode(
        "p",
        "game-view-summary",
        "The requested game was unavailable. Return to the dashboard and choose another tile."
      );
      content.append(fallbackTitle, fallbackSummary);
      return false;
    }

    content.append(buildGameContent(game));
    return true;
  }

  return { renderGame };
}
