import { createDashboardComponent, DASHBOARD_DEFAULT_CATALOG } from "./dashboard/index.js";
import { createGameView } from "./gameView.js";
import { createRouter, navigateToDashboard, navigateToGame } from "./router.js";

function initializeDashboard() {
  const dashboardRoot = document.getElementById("dashboardApp");
  const dashboardView = document.getElementById("dashboardView");
  const gameRoot = document.getElementById("gameViewApp");
  const gameView = document.getElementById("gameView");

  if (!dashboardRoot) {
    throw new Error("Missing required dashboard root element: dashboardApp");
  }
  if (!dashboardView || !gameRoot || !gameView) {
    throw new Error("Missing required app view root elements.");
  }

  const catalogById = new Map(DASHBOARD_DEFAULT_CATALOG.map((game) => [game.id, game]));

  const component = createDashboardComponent({
    root: dashboardRoot,
    catalog: DASHBOARD_DEFAULT_CATALOG,
    initialTileIds: ["racing", "clicker"],
    maxTiles: DASHBOARD_DEFAULT_CATALOG.length,
    onPlayTile: (gameId) => navigateToGame(gameId)
  });

  const gameHost = createGameView({
    root: gameRoot,
    onBack: () => navigateToDashboard(),
    resolveGame: (gameId) => catalogById.get(gameId) ?? null
  });

  const router = createRouter({
    dashboardView,
    gameView,
    resolveGame: (gameId) => catalogById.get(gameId) ?? null,
    onRouteChange: (route) => {
      if (route.view === "game") {
        const rendered = gameHost.renderGame(route.gameId);
        if (!rendered) {
          navigateToDashboard();
        }
      }
    }
  });
  router.start();

  window.__MINI_ARCADE_DASHBOARD__ = {
    getSnapshot: component.getSnapshot,
    setGameScore: component.setGameScore,
    navigateToDashboard,
    navigateToGame
  };
}

initializeDashboard();
