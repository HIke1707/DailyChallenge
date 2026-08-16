import {
  applyFilters,
  buildDashboard,
  calculateMetrics,
  normalizeEvents,
  reduceIncidentEvents,
} from "./core.mjs";

// Imports are intentionally present so the required data path is explicit.
// Replace this starter state with the complete interactive application.
const app = document.querySelector("#app");

if (app) {
  app.innerHTML = `
    <main class="starter-shell">
      <p class="eyebrow">MODEL SHOWDOWN / 2026-08-14</p>
      <h1>Incident Replay Workbench</h1>
      <p>Starter ready. Implement the product described in <code>challenge/TASK.md</code>.</p>
    </main>
  `;
}

export {
  applyFilters,
  buildDashboard,
  calculateMetrics,
  normalizeEvents,
  reduceIncidentEvents,
};
