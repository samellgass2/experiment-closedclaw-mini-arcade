const DASHBOARD_HASH = "#dashboard";
const GAME_HASH_PREFIX = "#game/";

function normalizeGameId(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function parseRoute(hash) {
  if (typeof hash !== "string" || hash.length === 0 || hash === "#" || hash === DASHBOARD_HASH) {
    return { view: "dashboard" };
  }

  if (hash.startsWith(GAME_HASH_PREFIX)) {
    const gameId = normalizeGameId(hash.slice(GAME_HASH_PREFIX.length));
    if (gameId) {
      return { view: "game", gameId };
    }
  }

  return { view: "dashboard" };
}

function ensureElement(node, name) {
  if (!(node instanceof HTMLElement)) {
    throw new Error(`Router requires a valid element for ${name}.`);
  }
  return node;
}

function applyViewVisibility(route, dashboardView, gameView) {
  const showDashboard = route.view === "dashboard";
  dashboardView.hidden = !showDashboard;
  gameView.hidden = showDashboard;
}

/**
 * Navigate to the dashboard shell route.
 */
export function navigateToDashboard() {
  if (window.location.hash !== DASHBOARD_HASH) {
    window.location.hash = DASHBOARD_HASH;
  } else {
    window.dispatchEvent(new Event("hashchange"));
  }
}

/**
 * Navigate to a specific game route by catalog game id.
 */
export function navigateToGame(gameId) {
  const normalizedGameId = normalizeGameId(gameId);
  if (!normalizedGameId) {
    navigateToDashboard();
    return;
  }

  const nextHash = `${GAME_HASH_PREFIX}${normalizedGameId}`;
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  } else {
    window.dispatchEvent(new Event("hashchange"));
  }
}

export function createRouter(options = {}) {
  const dashboardView = ensureElement(options.dashboardView, "dashboardView");
  const gameView = ensureElement(options.gameView, "gameView");
  const resolveGame = typeof options.resolveGame === "function" ? options.resolveGame : () => null;
  const onRouteChange = typeof options.onRouteChange === "function" ? options.onRouteChange : () => {};

  let currentRoute = { view: "dashboard" };

  function applyRouteFromHash() {
    const requestedRoute = parseRoute(window.location.hash);

    if (requestedRoute.view === "game") {
      const game = resolveGame(requestedRoute.gameId);
      if (!game) {
        currentRoute = { view: "dashboard" };
        if (window.location.hash !== DASHBOARD_HASH) {
          window.location.replace(DASHBOARD_HASH);
        }
      } else {
        currentRoute = { view: "game", gameId: requestedRoute.gameId };
      }
    } else {
      currentRoute = { view: "dashboard" };
    }

    applyViewVisibility(currentRoute, dashboardView, gameView);
    onRouteChange({ ...currentRoute });
  }

  return {
    start() {
      window.addEventListener("hashchange", applyRouteFromHash);
      applyRouteFromHash();
    },
    stop() {
      window.removeEventListener("hashchange", applyRouteFromHash);
    },
    getCurrentRoute() {
      return { ...currentRoute };
    }
  };
}
