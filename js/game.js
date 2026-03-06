import { createDashboardComponent, DASHBOARD_DEFAULT_CATALOG } from "./dashboard/index.js";

function initializeDashboard() {
  const root = document.getElementById("dashboardApp");
  if (!root) {
    throw new Error("Missing required dashboard root element: dashboardApp");
  }

  const component = createDashboardComponent({
    root,
    catalog: DASHBOARD_DEFAULT_CATALOG,
    initialTileIds: ["racing", "clicker"],
    maxTiles: DASHBOARD_DEFAULT_CATALOG.length
  });

  window.__MINI_ARCADE_DASHBOARD__ = {
    getSnapshot: component.getSnapshot
  };
}

initializeDashboard();
