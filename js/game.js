import { createDashboardComponent, DASHBOARD_DEFAULT_CATALOG } from "./dashboard/index.js";
import { mountRuntimeForGame } from "./gameRuntimes.js";
import { getActiveGameLoop, startGameLoop, stopActiveGameLoop } from "./gameLoopManager.js";
import { createGameView } from "./gameView.js";
import { loadLayout, resetLayout, saveLayout } from "./persistence.js";
import { createRouter, navigateToDashboard, navigateToGame } from "./router.js";

const DEV_MODE =
  typeof window !== "undefined" &&
  (window.location?.hostname === "localhost" ||
    window.location?.hostname === "127.0.0.1" ||
    window.location?.hostname === "" ||
    window.location?.protocol === "file:");

function devLifecycleLog(message, details) {
  if (!DEV_MODE) {
    return;
  }

  if (details !== undefined) {
    console.info(`[game-lifecycle] ${message}`, details);
  } else {
    console.info(`[game-lifecycle] ${message}`);
  }
}

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
  const knownTileIds = DASHBOARD_DEFAULT_CATALOG.map((game) => game.id);
  const defaultTileOrder = ["racing", "clicker"];
  const initialTileIds = loadLayout({
    defaultTileOrder,
    knownTileIds
  });
  let lastPersistedTileIds = [...initialTileIds];

  function persistLayoutFromSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.tileIds)) {
      return;
    }

    const nextTileIds = snapshot.tileIds;
    const orderUnchanged =
      nextTileIds.length === lastPersistedTileIds.length &&
      nextTileIds.every((tileId, index) => tileId === lastPersistedTileIds[index]);

    if (orderUnchanged) {
      return;
    }

    saveLayout(
      {
        tileOrder: nextTileIds
      },
      {
        knownTileIds
      }
    );
    lastPersistedTileIds = [...nextTileIds];
  }

  const component = createDashboardComponent({
    root: dashboardRoot,
    catalog: DASHBOARD_DEFAULT_CATALOG,
    initialTileIds,
    maxTiles: DASHBOARD_DEFAULT_CATALOG.length,
    onChange: (snapshot) => persistLayoutFromSnapshot(snapshot),
    onPlayTile: (gameId) => navigateToGame(gameId)
  });

  const gameHost = createGameView({
    root: gameRoot,
    onBack: () => navigateToDashboard(),
    resolveGame: (gameId) => catalogById.get(gameId) ?? null,
    mountGame: ({ game, root }) => {
      startGameLoop(game.id, (scope) =>
        mountRuntimeForGame({
          game,
          root,
          scope,
          onScoreChange: (score) => component.setGameScore(game.id, score)
        })
      );

      return () => {
        stopActiveGameLoop(`unmount-${game.id}`);
      };
    }
  });

  const router = createRouter({
    dashboardView,
    gameView,
    resolveGame: (gameId) => catalogById.get(gameId) ?? null,
    onRouteChange: (route) => {
      if (route.view === "dashboard") {
        gameHost.unmountActiveGame();
        stopActiveGameLoop("navigated-dashboard");

        const active = getActiveGameLoop();
        if (DEV_MODE && active) {
          console.warn("[game-lifecycle] Dashboard route reached with a lingering active game loop.", active);
        } else {
          devLifecycleLog("Dashboard route active with no running game loop.");
        }
        return;
      }

      devLifecycleLog(`Navigating to game route '${route.gameId}'.`);
      const rendered = gameHost.renderGame(route.gameId);
      if (!rendered) {
        navigateToDashboard();
      }
    }
  });
  router.start();

  window.__MINI_ARCADE_DASHBOARD__ = {
    getSnapshot: component.getSnapshot,
    setGameScore: component.setGameScore,
    resetLayout: () => {
      resetLayout();
      lastPersistedTileIds = [];
    },
    navigateToDashboard,
    navigateToGame
  };
}

initializeDashboard();
