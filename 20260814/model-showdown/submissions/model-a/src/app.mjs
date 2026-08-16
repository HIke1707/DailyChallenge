import {
  applyFilters,
  buildDashboard,
  calculateMetrics,
  normalizeEvents,
  reduceIncidentEvents,
} from "./core.mjs";

const app = document.querySelector("#app");
const SEVERITIES = ["SEV-1", "SEV-2", "SEV-3", "SEV-4"];
const STATUSES = ["open", "acknowledged", "resolved"];
const statusLabels = { open: "Open", acknowledged: "Acknowledged", resolved: "Resolved" };
const severityLabels = { "SEV-1": "SEV-1", "SEV-2": "SEV-2", "SEV-3": "SEV-3", "SEV-4": "SEV-4" };
const reasonLabels = {
  invalid_shape: "Invalid event shape",
  invalid_timestamp: "Invalid timestamp",
  unsupported_type: "Unsupported event type",
  invalid_payload: "Invalid payload",
  duplicate_event_id: "Duplicate event ID",
};
const eventLabels = {
  incident_created: "Incident created",
  owner_assigned: "Owner assigned",
  severity_changed: "Severity changed",
  incident_acknowledged: "Incident acknowledged",
  incident_resolved: "Incident resolved",
  incident_reopened: "Incident reopened",
  note_added: "Note added",
};
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
});
const clockFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

let rawEvents = [];
let validEvents = [];
let timelineMin = 0;
let timelineMax = 0;
let playbackTimer = null;
let loadState = "loading";
let loadError = "";
let state = {
  atMs: Number.NaN,
  filters: { q: "", services: [], severities: [], statuses: [] },
  selected: "",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return `${timeFormatter.format(new Date(value))} UTC`;
}

function formatClock(ms) {
  return Number.isFinite(ms) ? `${clockFormatter.format(new Date(ms))} UTC` : "—";
}

function formatNumber(value, suffix = "") {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function parseListParam(params, name) {
  return params.getAll(name).flatMap((value) => value.split(",")).filter(Boolean);
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const atValue = params.get("at");
  const numericAt = atValue === null ? Number.NaN : Number(atValue);
  const parsedAt = Number.isFinite(numericAt) ? numericAt : Date.parse(atValue ?? "");
  return {
    atMs: Number.isFinite(parsedAt) ? parsedAt : Number.NaN,
    filters: {
      q: params.get("q") ?? "",
      services: parseListParam(params, "service"),
      severities: parseListParam(params, "severity"),
      statuses: parseListParam(params, "status"),
    },
    selected: params.get("selected") ?? "",
  };
}

function clampAt(atMs) {
  if (!Number.isFinite(atMs)) return timelineMax;
  return Math.min(timelineMax, Math.max(timelineMin, atMs));
}

function syncUrl(mode = "push") {
  if (!window.history?.replaceState) return;
  const params = new URLSearchParams();
  params.set("at", Number.isFinite(state.atMs) ? new Date(state.atMs).toISOString() : "");
  params.set("q", state.filters.q);
  params.set("service", state.filters.services.join(","));
  params.set("severity", state.filters.severities.join(","));
  params.set("status", state.filters.statuses.join(","));
  params.set("selected", state.selected);
  const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history[mode === "replace" ? "replaceState" : "pushState"]({}, "", nextUrl);
}

function setStateFromUrl() {
  const urlState = readUrlState();
  state = { atMs: clampAt(urlState.atMs), filters: urlState.filters, selected: urlState.selected };
}

function getAllIncidents() {
  return reduceIncidentEvents(validEvents, Number.POSITIVE_INFINITY);
}

function getFilterOptions() {
  const incidents = getAllIncidents();
  return { services: [...new Set(incidents.map((incident) => incident.service).filter(Boolean))].sort() };
}

function renderCheckboxes(type, values, selected, labels = {}) {
  if (!values.length) return `<p class="filter-empty">No values yet</p>`;
  return values.map((value) => `
    <label class="check-row"><input type="checkbox" data-filter-type="${type}" value="${escapeHtml(value)}" ${selected.includes(value) ? "checked" : ""} /><span>${escapeHtml(labels[value] ?? value)}</span></label>
  `).join("");
}

function renderLoading() {
  app.innerHTML = `<main class="state-screen" aria-live="polite"><div class="loading-mark" aria-hidden="true"><span></span><span></span><span></span></div><p class="eyebrow">INCIDENT REPLAY WORKBENCH</p><h1>Loading event stream</h1><p>Normalizing event history and preparing the replay timeline…</p></main>`;
}

function renderError() {
  app.innerHTML = `<main class="state-screen error-state" aria-live="assertive"><div class="error-icon" aria-hidden="true">!</div><p class="eyebrow">DATA LOAD FAILED</p><h1>We could not load the event stream</h1><p>${escapeHtml(loadError || "The event source returned an unexpected response.")}</p><button class="button button-primary" data-action="retry">Retry loading</button></main>`;
}

function renderMetrics(metrics) {
  const cards = [
    { label: "Active", value: metrics.activeCount, detail: `${metrics.totalCount} total incidents`, tone: "cyan", icon: "↗" },
    { label: "SEV-1 active", value: metrics.criticalActiveCount, detail: "Critical incidents", tone: "red", icon: "!" },
    { label: "Ack rate", value: formatNumber(metrics.acknowledgementRatePct, "%"), detail: "Acknowledged incidents", tone: "green", icon: "✓" },
    { label: "Mean time to resolve", value: formatNumber(metrics.meanTimeToResolveMinutes, "m"), detail: "Resolved incidents", tone: "violet", icon: "◷" },
    { label: "Top service", value: metrics.topService ?? "—", detail: "By incident volume", tone: "amber", icon: "◆" },
  ];
  return cards.map((card) => `<article class="metric-card metric-${card.tone}"><div class="metric-top"><span>${card.label}</span><span class="metric-icon" aria-hidden="true">${card.icon}</span></div><strong>${escapeHtml(card.value)}</strong><small>${escapeHtml(card.detail)}</small></article>`).join("");
}

function renderIncidentCard(incident) {
  const selected = incident.incidentId === state.selected;
  return `<button class="incident-card ${selected ? "is-selected" : ""}" data-incident-id="${escapeHtml(incident.incidentId)}" aria-pressed="${selected}"><div class="incident-card-head"><span class="incident-id">${escapeHtml(incident.incidentId)}</span><span class="severity-pill severity-${escapeHtml(incident.severity)}">${escapeHtml(incident.severity)}</span></div><strong>${escapeHtml(incident.title)}</strong><div class="incident-card-meta"><span>${escapeHtml(incident.service)}</span><span>${escapeHtml(statusLabels[incident.status])}</span></div><div class="incident-card-foot"><span><i class="status-dot status-${escapeHtml(incident.status)}"></i>${escapeHtml(incident.owner ?? "Unassigned")}</span><time datetime="${escapeHtml(incident.updatedAt)}">${escapeHtml(formatDate(incident.updatedAt))}</time></div></button>`;
}

function eventDetail(event) {
  switch (event.type) {
    case "incident_created": return `${event.payload.title} · ${event.payload.service}`;
    case "owner_assigned": return `Owner set to ${event.payload.owner}`;
    case "severity_changed": return `Severity set to ${event.payload.severity}`;
    case "note_added": return event.payload.text;
    default: return "State transition recorded";
  }
}

function renderIncidentDetail(incident) {
  if (!incident) return `<section class="detail-panel empty-detail" aria-live="polite"><div class="empty-illustration" aria-hidden="true">⌁</div><h2>No incident selected</h2><p>Select an incident from the replay slice to inspect its current state and event trail.</p></section>`;
  const incidentEvents = validEvents.filter((event) => event.incidentId === incident.incidentId && event.atMs <= state.atMs);
  return `<section class="detail-panel" aria-labelledby="detail-title"><div class="detail-heading"><div><p class="eyebrow">INCIDENT DETAIL</p><h2 id="detail-title">${escapeHtml(incident.title)}</h2><p class="detail-id">${escapeHtml(incident.incidentId)} · ${escapeHtml(incident.service)}</p></div><span class="status-badge status-badge-${escapeHtml(incident.status)}"><i class="status-dot status-${escapeHtml(incident.status)}"></i>${escapeHtml(statusLabels[incident.status])}</span></div><div class="detail-facts"><div><span>Severity</span><strong class="severity-text severity-${escapeHtml(incident.severity)}">${escapeHtml(incident.severity)}</strong></div><div><span>Owner</span><strong>${escapeHtml(incident.owner ?? "Unassigned")}</strong></div><div><span>Created</span><strong>${escapeHtml(formatDate(incident.createdAt))}</strong></div><div><span>Last updated</span><strong>${escapeHtml(formatDate(incident.updatedAt))}</strong></div></div><div class="detail-section-heading"><h3>Event trail</h3><span>${incidentEvents.length} events up to replay time</span></div><ol class="event-trail">${incidentEvents.length ? incidentEvents.map((event) => `<li class="event-row"><span class="event-marker" aria-hidden="true"></span><div class="event-copy"><strong>${escapeHtml(eventLabels[event.type] ?? event.type)}</strong><span>${escapeHtml(eventDetail(event))}</span></div><time datetime="${escapeHtml(event.at)}">${escapeHtml(formatDate(event.at))}</time></li>`).join("") : `<li class="inline-empty">No events in this replay slice.</li>`}</ol>${incident.notes.length ? `<div class="notes-block"><h3>Notes</h3>${incident.notes.map((note) => `<p><span>${escapeHtml(formatDate(note.at))}</span>${escapeHtml(note.text)}</p>`).join("")}</div>` : ""}</section>`;
}

function renderDataQuality(rejectedEvents) {
  return `<section class="quality-panel" aria-labelledby="quality-title"><div class="quality-summary"><div class="quality-symbol" aria-hidden="true">${rejectedEvents.length ? "!" : "✓"}</div><div><p class="eyebrow">DATA QUALITY</p><h2 id="quality-title">${rejectedEvents.length ? `${rejectedEvents.length} rejected events` : "Event stream is clean"}</h2><p>${rejectedEvents.length ? "Invalid events are isolated and excluded from replay metrics." : "Every event passed normalization and validation."}</p></div></div>${rejectedEvents.length ? `<details class="rejection-details"><summary>View rejection reasons</summary><ul>${rejectedEvents.map((event) => `<li><span class="rejection-reason">${escapeHtml(reasonLabels[event.reason] ?? event.reason)}</span><code>${escapeHtml(event.eventId ?? `index ${event.index}`)}</code><span>row ${event.index + 1}</span></li>`).join("")}</ul></details>` : ""}</section>`;
}

function render(preserveFocus = false) {
  if (loadState === "loading") return renderLoading();
  if (loadState === "error") return renderError();
  const focusTarget = preserveFocus ? document.activeElement : null;
  const focusId = focusTarget?.id;
  const selectionStart = focusTarget?.selectionStart;
  const dashboard = buildDashboard(rawEvents, state.filters, state.atMs);
  const selectedIncident = dashboard.incidents.find((incident) => incident.incidentId === state.selected);
  const options = getFilterOptions();
  const isLive = state.atMs >= timelineMax;
  const activeFilterCount = state.filters.services.length + state.filters.severities.length + state.filters.statuses.length + (state.filters.q ? 1 : 0);
  app.innerHTML = `<div class="app-shell"><header class="topbar"><a class="brand" href="./" aria-label="Incident Replay Workbench home"><span class="brand-mark" aria-hidden="true">▦</span><span><strong>Incident Replay</strong><small>Workbench</small></span></a><div class="topbar-status"><span class="replay-chip"><i class="live-dot ${isLive ? "is-live" : ""}"></i>${isLive ? "LIVE EDGE" : "REPLAYING HISTORY"}</span><span class="health-chip ${dashboard.rejectedEvents.length ? "is-degraded" : ""}"><i></i>${dashboard.rejectedEvents.length ? "Degraded" : "Healthy"}</span></div></header><main><section class="hero-row"><div><p class="eyebrow">ON-CALL CONTROL ROOM <span>/</span> UTC</p><h1>Incident Replay<br /><em>Workbench</em></h1><p class="hero-copy">Reconstruct the exact state of your incident stream, one moment at a time.</p></div><div class="replay-clock"><span>REPLAY TIME</span><strong>${escapeHtml(formatDate(new Date(state.atMs).toISOString()))}</strong><small>${isLive ? "At the latest known event" : `${Math.round((timelineMax - state.atMs) / 60000)} min before live`}</small></div></section><section class="replay-panel panel" aria-labelledby="replay-heading"><div class="panel-heading"><div><p class="eyebrow">TIME MACHINE</p><h2 id="replay-heading">Replay control</h2></div><span class="range-caption">${escapeHtml(formatDate(new Date(timelineMin).toISOString()))} → ${escapeHtml(formatDate(new Date(timelineMax).toISOString()))}</span></div><div class="slider-wrap"><output for="replay-slider" class="slider-output">${escapeHtml(formatDate(new Date(state.atMs).toISOString()))}</output><input id="replay-slider" type="range" min="${timelineMin}" max="${Math.max(timelineMax, timelineMin + 60000)}" step="60000" value="${state.atMs}" aria-label="Replay time" /><div class="slider-ticks"><span>${escapeHtml(formatClock(timelineMin))}</span><span>${escapeHtml(formatClock(timelineMax))}</span></div></div><div class="replay-actions"><button class="button button-primary" data-action="toggle-play" aria-label="${playbackTimer ? "Pause replay" : "Play replay"}">${playbackTimer ? "Ⅱ  Pause" : "▶  Play replay"}</button><button class="button button-quiet" data-action="live" ${isLive ? "disabled" : ""}>↗ Return to live</button><span class="playback-note">Each tick advances <strong>15 minutes</strong></span></div></section><section class="metrics-grid" aria-label="Incident metrics">${renderMetrics(dashboard.metrics)}</section><section class="workspace-grid"><aside class="filter-panel panel" aria-labelledby="filter-heading"><div class="panel-heading compact"><div><p class="eyebrow">VIEW</p><h2 id="filter-heading">Filter incidents</h2></div>${activeFilterCount ? `<span class="filter-count">${activeFilterCount}</span>` : ""}</div><label class="search-field" for="search-input"><span aria-hidden="true">⌕</span><input id="search-input" type="search" autocomplete="off" placeholder="Search incidents…" value="${escapeHtml(state.filters.q)}" /><kbd>/</kbd></label><fieldset><legend>Service</legend>${renderCheckboxes("services", options.services, state.filters.services)}</fieldset><fieldset><legend>Severity</legend>${renderCheckboxes("severities", SEVERITIES, state.filters.severities, severityLabels)}</fieldset><fieldset><legend>Status</legend>${renderCheckboxes("statuses", STATUSES, state.filters.statuses, statusLabels)}</fieldset><button class="clear-button" data-action="clear-filters" ${activeFilterCount ? "" : "disabled"}>Clear all filters</button></aside><section class="incidents-panel panel" aria-labelledby="incidents-heading"><div class="panel-heading"><div><p class="eyebrow">REPLAY SLICE</p><h2 id="incidents-heading">Incidents <span class="heading-count">${dashboard.incidents.length}</span></h2></div><span class="sort-note">Updated latest first</span></div>${dashboard.incidents.length ? `<div class="incident-list">${dashboard.incidents.map(renderIncidentCard).join("")}</div>` : `<div class="list-empty"><div class="empty-illustration" aria-hidden="true">⌁</div><h3>No incidents match this view</h3><p>Try moving the replay time or clearing one of the filters.</p><button class="button button-quiet" data-action="clear-filters">Clear filters</button></div>`}</section>${renderIncidentDetail(selectedIncident)}</section>${renderDataQuality(dashboard.rejectedEvents)}</main><footer class="footer"><span>Incident Replay Workbench</span><span>Deterministic replay · ${validEvents.length} valid events</span></footer></div>`;
  if (focusId) {
    const nextFocus = document.getElementById(focusId);
    if (nextFocus) { nextFocus.focus(); if (typeof selectionStart === "number" && nextFocus.setSelectionRange) nextFocus.setSelectionRange(selectionStart, selectionStart); }
  }
}

function updateFilter(type, value, checked) {
  const key = type === "services" ? "services" : type === "severities" ? "severities" : "statuses";
  const values = new Set(state.filters[key]);
  if (checked) values.add(value); else values.delete(value);
  state.filters[key] = [...values];
  state.selected = "";
  syncUrl();
  render();
}

function stopPlayback() {
  if (playbackTimer !== null) { window.clearInterval(playbackTimer); playbackTimer = null; }
}

function startPlayback() {
  stopPlayback();
  if (state.atMs >= timelineMax) state.atMs = timelineMin;
  playbackTimer = window.setInterval(() => {
    const next = Math.min(timelineMax, state.atMs + 15 * 60 * 1000);
    state.atMs = next;
    syncUrl("replace");
    render();
    if (next >= timelineMax) stopPlayback();
  }, 500);
  render();
}

function handleAction(action) {
  switch (action) {
    case "retry": loadData(); break;
    case "toggle-play": playbackTimer === null ? startPlayback() : (stopPlayback(), render()); break;
    case "live": stopPlayback(); state.atMs = timelineMax; syncUrl(); render(); break;
    case "clear-filters": state.filters = { q: "", services: [], severities: [], statuses: [] }; state.selected = ""; syncUrl(); render(); break;
    default: break;
  }
}

async function loadData() {
  stopPlayback();
  loadState = "loading";
  renderLoading();
  try {
    const response = await fetch("./data/events.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Event stream returned HTTP ${response.status}.`);
    const parsed = await response.json();
    if (!Array.isArray(parsed)) throw new Error("Event stream must be a JSON array.");
    rawEvents = parsed;
    validEvents = normalizeEvents(rawEvents).validEvents;
    timelineMin = validEvents.length ? validEvents[0].atMs : 0;
    timelineMax = validEvents.length ? validEvents[validEvents.length - 1].atMs : 0;
    setStateFromUrl();
    syncUrl("replace");
    loadState = "ready";
    render();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unknown data loading error.";
    loadState = "error";
    renderError();
  }
}

if (app) {
  app.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) { handleAction(actionTarget.dataset.action); return; }
    const incidentTarget = event.target.closest("[data-incident-id]");
    if (incidentTarget) { state.selected = incidentTarget.dataset.incidentId; syncUrl(); render(); }
  });
  app.addEventListener("change", (event) => {
    if (event.target.matches("[data-filter-type]")) updateFilter(event.target.dataset.filterType, event.target.value, event.target.checked);
    else if (event.target.id === "replay-slider") { stopPlayback(); state.atMs = clampAt(Number(event.target.value)); syncUrl(); render(); }
    else if (event.target.id === "search-input") { state.filters.q = event.target.value; state.selected = ""; syncUrl(); render(); }
  });
  app.addEventListener("input", (event) => {
    if (event.target.id !== "search-input") return;
    state.filters.q = event.target.value;
    state.selected = "";
    syncUrl("replace");
    render(true);
  });
  app.addEventListener("keydown", (event) => {
    if (event.key === "/" && event.target.tagName !== "INPUT" && event.target.tagName !== "TEXTAREA") { event.preventDefault(); document.querySelector("#search-input")?.focus(); }
  });
  window.addEventListener("popstate", () => { if (loadState === "ready") { setStateFromUrl(); render(); } });
  renderLoading();
  loadData();
}

export { applyFilters, buildDashboard, calculateMetrics, normalizeEvents, reduceIncidentEvents };
