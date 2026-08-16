import {
  applyFilters,
  buildDashboard,
  calculateMetrics,
  normalizeEvents,
  reduceIncidentEvents,
} from "./core.mjs";

export {
  applyFilters,
  buildDashboard,
  calculateMetrics,
  normalizeEvents,
  reduceIncidentEvents,
};

const STEP_MS = 15 * 60 * 1000; // 15 minutes
const PLAYBACK_INTERVAL_MS = 500; // 500ms

class IncidentWorkbenchApp {
  constructor(rootEl) {
    this.root = rootEl;
    this.rawEvents = [];
    this.validEvents = [];
    this.rejectedEvents = [];
    this.allServices = [];

    this.minMs = 0;
    this.maxMs = 0;
    this.atMs = 0;

    this.filters = {
      q: "",
      services: [],
      severities: [],
      statuses: [],
    };

    this.selectedIncidentId = null;
    this.isPlaying = false;
    this.playbackTimer = null;
    this.isQualityModalOpen = false;

    this.init();
  }

  async init() {
    this.renderInitialShell();
    try {
      const response = await fetch("./data/events.json");
      if (!response.ok) {
        throw new Error(`Failed to load events data (HTTP ${response.status})`);
      }
      this.rawEvents = await response.json();

      const normalized = normalizeEvents(this.rawEvents);
      this.validEvents = normalized.validEvents;
      this.rejectedEvents = normalized.rejectedEvents;

      const serviceSet = new Set();
      for (const event of this.validEvents) {
        if (event.type === "incident_created" && event.payload?.service) {
          serviceSet.add(event.payload.service);
        }
      }
      this.allServices = Array.from(serviceSet).sort();

      if (this.validEvents.length > 0) {
        this.minMs = this.validEvents[0].atMs;
        this.maxMs = this.validEvents[this.validEvents.length - 1].atMs;
      } else {
        this.minMs = 0;
        this.maxMs = 0;
      }

      this.readUrlParams();

      window.addEventListener("popstate", () => {
        this.readUrlParams();
        this.updateView();
      });

      this.setupGlobalEventListeners();
      this.renderAppStructure();
      this.updateView();
    } catch (err) {
      this.renderErrorState(err.message);
    }
  }

  readUrlParams() {
    const params = new URLSearchParams(window.location.search);

    const atParam = params.get("at");
    if (atParam) {
      const parsedMs = !Number.isNaN(Number(atParam))
        ? Number(atParam)
        : Date.parse(atParam);
      if (!Number.isNaN(parsedMs)) {
        this.atMs = Math.max(this.minMs, Math.min(this.maxMs, parsedMs));
      } else {
        this.atMs = this.maxMs;
      }
    } else {
      this.atMs = this.maxMs;
    }

    this.filters.q = params.get("q") || "";

    const serviceParam = params.get("service");
    this.filters.services = serviceParam
      ? serviceParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const sevParam = params.get("severity");
    this.filters.severities = sevParam
      ? sevParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const statusParam = params.get("status");
    this.filters.statuses = statusParam
      ? statusParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    this.selectedIncidentId = params.get("selected") || null;
  }

  updateUrl(replace = true) {
    const params = new URLSearchParams();

    if (this.atMs !== this.maxMs) {
      params.set("at", new Date(this.atMs).toISOString());
    }

    if (this.filters.q.trim()) {
      params.set("q", this.filters.q.trim());
    }

    if (this.filters.services.length > 0) {
      params.set("service", this.filters.services.join(","));
    }

    if (this.filters.severities.length > 0) {
      params.set("severity", this.filters.severities.join(","));
    }

    if (this.filters.statuses.length > 0) {
      params.set("status", this.filters.statuses.join(","));
    }

    if (this.selectedIncidentId) {
      params.set("selected", this.selectedIncidentId);
    }

    const newQuery = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname;

    if (replace) {
      window.history.replaceState(null, "", newQuery);
    } else {
      window.history.pushState(null, "", newQuery);
    }
  }

  togglePlayback() {
    if (this.isPlaying) {
      this.pausePlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback() {
    if (this.atMs >= this.maxMs) {
      this.atMs = this.minMs;
    }
    this.isPlaying = true;
    this.updateUrl(true);
    this.updatePlayControlsView();
    this.updateView();

    if (this.playbackTimer) clearInterval(this.playbackTimer);

    this.playbackTimer = setInterval(() => {
      if (this.atMs + STEP_MS >= this.maxMs) {
        this.atMs = this.maxMs;
        this.pausePlayback();
      } else {
        this.atMs += STEP_MS;
        this.updateUrl(true);
        this.updateView();
      }
    }, PLAYBACK_INTERVAL_MS);
  }

  pausePlayback() {
    this.isPlaying = false;
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.updateUrl(true);
    this.updatePlayControlsView();
    this.updateView();
  }

  setReplayTime(ms, isContinuous = false) {
    this.atMs = Math.max(this.minMs, Math.min(this.maxMs, ms));
    this.updateUrl(isContinuous);
    this.updateView();
  }

  formatIsoUtc(isoString) {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) return isoString;
      return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
    } catch {
      return isoString;
    }
  }

  formatMsUtc(ms) {
    if (!ms || Number.isNaN(ms)) return "—";
    return new Date(ms).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  }

  escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  renderInitialShell() {
    this.root.innerHTML = `
      <main class="workbench-root" aria-busy="true">
        <div class="state-box-center">
          <div class="loading-spinner" aria-hidden="true"></div>
          <h2>Loading Incident Stream...</h2>
          <p class="wb-subtitle">Ingesting event sequence and verifying integrity</p>
        </div>
      </main>
    `;
  }

  renderErrorState(message) {
    this.root.innerHTML = `
      <main class="workbench-root">
        <div class="state-box-center">
          <div style="color: var(--sev1); font-size: 2.5rem;">⚠️</div>
          <h2>Failed to Load Incident Stream</h2>
          <p class="wb-subtitle">${this.escapeHtml(message)}</p>
          <button id="btn-retry" class="btn-primary-action">Retry Ingestion</button>
        </div>
      </main>
    `;
    this.root.querySelector("#btn-retry")?.addEventListener("click", () => this.init());
  }

  renderAppStructure() {
    const rejectedCount = this.rejectedEvents.length;

    this.root.innerHTML = `
      <main class="workbench-root">
        <!-- 1. Header -->
        <header class="wb-header" role="banner">
          <div class="wb-header-left">
            <div class="wb-brand">
              <div class="wb-logo-icon" aria-hidden="true">⚡</div>
              <h1 class="wb-title">Incident Replay Workbench</h1>
            </div>
            <p class="wb-subtitle">Deterministic time-travel simulation &amp; post-mortem reconstruction</p>
          </div>
          <div class="wb-header-right">
            <button id="btn-data-health" class="health-badge-btn" aria-haspopup="dialog" aria-expanded="false">
              <span class="health-dot ${rejectedCount > 0 ? "has-issues" : ""}"></span>
              <span id="health-badge-text">Data Quality: ${rejectedCount > 0 ? `${rejectedCount} Filtered` : "100% Healthy"}</span>
            </button>
            <span id="live-mode-badge" class="live-pill" role="status">● LIVE STREAM</span>
          </div>
        </header>

        <!-- 2. KPI Cards Grid -->
        <section class="kpi-grid" aria-label="Operational Metrics" role="region" aria-live="polite">
          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Active Incidents</span>
            </div>
            <div id="kpi-active" class="kpi-value">0</div>
            <div class="kpi-desc">Open &amp; acknowledged</div>
          </div>

          <div class="kpi-card kpi-sev1">
            <div class="kpi-header">
              <span class="kpi-label">SEV-1 Active</span>
            </div>
            <div id="kpi-sev1" class="kpi-value">0</div>
            <div class="kpi-desc">Critical active incidents</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Ack Rate</span>
            </div>
            <div id="kpi-ack" class="kpi-value">0%</div>
            <div class="kpi-desc">Incidents acknowledged</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">MTTR</span>
            </div>
            <div id="kpi-mttr" class="kpi-value">0<span style="font-size: 0.9rem; margin-left: 2px;">m</span></div>
            <div class="kpi-desc">Mean Time to Resolve</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Top Service</span>
            </div>
            <div id="kpi-top-service" class="kpi-value" style="font-size: 1.5rem;">—</div>
            <div class="kpi-desc">Highest incident count</div>
          </div>
        </section>

        <!-- 3. Replay Controls -->
        <section class="replay-bar" aria-label="Replay Controls" role="region">
          <div class="replay-bar-top">
            <div class="replay-controls-group">
              <button id="btn-play-pause" class="btn-primary-action" aria-label="Play replay">
                ▶ Play
              </button>
              <button id="btn-step-back" class="btn-secondary-action" aria-label="Step back 15 minutes" title="-15 min">
                -15m
              </button>
              <button id="btn-step-fwd" class="btn-secondary-action" aria-label="Step forward 15 minutes" title="+15 min">
                +15m
              </button>
              <button id="btn-live" class="btn-secondary-action" aria-label="Jump to live point">
                回到 Live
              </button>
            </div>
            <div class="current-time-display">
              <span class="time-label">Replay Point:</span>
              <time id="replay-time-display" class="time-value">
                ${this.formatMsUtc(this.atMs)}
              </time>
            </div>
          </div>

          <div class="replay-slider-container">
            <div class="slider-wrapper">
              <input
                id="replay-slider"
                type="range"
                class="time-slider"
                min="${this.minMs}"
                max="${this.maxMs}"
                step="60000"
                value="${this.atMs}"
                aria-label="Replay time slider"
              />
            </div>
            <div class="slider-labels">
              <span>Earliest: ${this.formatMsUtc(this.minMs)}</span>
              <span>Live: ${this.formatMsUtc(this.maxMs)}</span>
            </div>
          </div>
        </section>

        <!-- 4. Filter Toolbar -->
        <section class="filter-toolbar" aria-label="Filters" role="search">
          <div class="filter-row-top">
            <div class="search-input-wrapper">
              <span class="search-icon" aria-hidden="true">🔍</span>
              <input
                id="search-input"
                type="text"
                class="search-input"
                placeholder="Search incidents (ID, title, service, owner)..."
                value="${this.escapeHtml(this.filters.q)}"
                aria-label="Search incidents"
              />
              <button id="btn-clear-search" class="search-clear-btn" aria-label="Clear search input" style="display: ${this.filters.q ? "flex" : "none"};">✕</button>
            </div>

            <button id="btn-clear-filters" class="btn-clear-all" aria-label="Clear all active filters" style="display: none;">✕ 一鍵清除篩選</button>
          </div>

          <div class="filter-row-bottom">
            <!-- Severity Filter -->
            <div class="filter-group">
              <span class="filter-group-label">Severity</span>
              <div class="filter-pills" role="group" aria-label="Severity filter">
                ${["SEV-1", "SEV-2", "SEV-3", "SEV-4"]
                  .map(
                    (sev) => `
                  <button
                    type="button"
                    class="filter-pill ${sev.toLowerCase()}"
                    data-filter="severity"
                    data-value="${sev}"
                    aria-pressed="false"
                  >
                    ${sev}
                  </button>
                `
                  )
                  .join("")}
              </div>
            </div>

            <!-- Status Filter -->
            <div class="filter-group">
              <span class="filter-group-label">Status</span>
              <div class="filter-pills" role="group" aria-label="Status filter">
                ${[
                  { id: "open", label: "Open" },
                  { id: "acknowledged", label: "Acknowledged" },
                  { id: "resolved", label: "Resolved" },
                ]
                  .map(
                    (st) => `
                  <button
                    type="button"
                    class="filter-pill status-${st.id}"
                    data-filter="status"
                    data-value="${st.id}"
                    aria-pressed="false"
                  >
                    ${st.label}
                  </button>
                `
                  )
                  .join("")}
              </div>
            </div>

            <!-- Service Filter -->
            ${
              this.allServices.length > 0
                ? `
              <div class="filter-group">
                <span class="filter-group-label">Service</span>
                <div class="filter-pills" role="group" aria-label="Service filter">
                  ${this.allServices
                    .map(
                      (svc) => `
                    <button
                      type="button"
                      class="filter-pill"
                      data-filter="service"
                      data-value="${svc}"
                      aria-pressed="false"
                    >
                      ${svc}
                    </button>
                  `
                    )
                    .join("")}
                </div>
              </div>
            `
                : ""
            }
          </div>
        </section>

        <!-- 5 & 6. Main Workbench: Incidents List + Details Panel -->
        <div class="wb-main-layout">
          <!-- Left: Incidents List Panel -->
          <section class="incidents-panel" aria-label="Incidents List" role="region">
            <div class="panel-header">
              <h2 class="panel-title">
                <span>Incidents</span>
                <span id="incidents-count-badge" class="panel-count">0</span>
              </h2>
              <span id="filter-state-label" style="font-size: 0.75rem; color: var(--text-muted);">
                All active slice
              </span>
            </div>

            <div id="incidents-list-container" class="incidents-list-wrapper" role="listbox" aria-label="Incident entries" tabindex="0">
              <!-- Dynamically populated -->
            </div>
          </section>

          <!-- Right: Details Panel -->
          <aside class="detail-panel" aria-label="Incident Detail &amp; History" role="region">
            <div class="panel-header">
              <h2 class="panel-title">
                <span>Incident Inspector</span>
              </h2>
              <span id="detail-incident-id-badge" class="panel-count" style="display: none;"></span>
            </div>

            <div id="detail-content-container" class="detail-content-wrapper">
              <!-- Dynamically populated -->
            </div>
          </aside>
        </div>

        <!-- 7. Data Quality Modal Container -->
        <div id="quality-modal-container"></div>
      </main>
    `;
  }

  setupGlobalEventListeners() {
    this.root.addEventListener("click", (e) => {
      const target = e.target;

      // Play / Pause button
      if (target.closest("#btn-play-pause")) {
        this.togglePlayback();
        return;
      }

      // Step back
      if (target.closest("#btn-step-back")) {
        this.pausePlayback();
        this.setReplayTime(this.atMs - STEP_MS);
        return;
      }

      // Step fwd
      if (target.closest("#btn-step-fwd")) {
        this.pausePlayback();
        this.setReplayTime(this.atMs + STEP_MS);
        return;
      }

      // Live button
      if (target.closest("#btn-live")) {
        this.pausePlayback();
        this.setReplayTime(this.maxMs);
        return;
      }

      // Clear search
      if (target.closest("#btn-clear-search")) {
        this.filters.q = "";
        const searchInput = this.root.querySelector("#search-input");
        if (searchInput) searchInput.value = "";
        this.updateUrl(false);
        this.updateView();
        return;
      }

      // Clear all filters
      if (target.closest("#btn-clear-filters") || target.closest("#btn-empty-reset-filters")) {
        this.filters.q = "";
        this.filters.services = [];
        this.filters.severities = [];
        this.filters.statuses = [];
        const searchInput = this.root.querySelector("#search-input");
        if (searchInput) searchInput.value = "";
        this.updateUrl(false);
        this.updateView();
        return;
      }

      // Filter pills
      const pill = target.closest(".filter-pill");
      if (pill) {
        const type = pill.dataset.filter;
        const val = pill.dataset.value;
        if (!type || !val) return;

        let targetArray = [];
        if (type === "severity") targetArray = this.filters.severities;
        else if (type === "status") targetArray = this.filters.statuses;
        else if (type === "service") targetArray = this.filters.services;

        const idx = targetArray.indexOf(val);
        if (idx >= 0) {
          targetArray.splice(idx, 1);
        } else {
          targetArray.push(val);
        }

        this.updateUrl(false);
        this.updateView();
        return;
      }

      // Incident card selection
      const incCard = target.closest(".incident-card-item");
      if (incCard) {
        const incId = incCard.dataset.incidentId;
        if (incId) {
          if (this.selectedIncidentId === incId) {
            this.selectedIncidentId = null;
          } else {
            this.selectedIncidentId = incId;
          }
          this.updateUrl(false);
          this.updateView();
        }
        return;
      }

      // Data quality modal open
      if (target.closest("#btn-data-health")) {
        this.isQualityModalOpen = true;
        this.updateModalView();
        return;
      }

      // Data quality modal close
      if (target.closest("#btn-close-modal") || target.id === "quality-modal-backdrop") {
        this.isQualityModalOpen = false;
        this.updateModalView();
        return;
      }
    });

    // Window-level Escape key listener for modal
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isQualityModalOpen) {
        this.isQualityModalOpen = false;
        this.updateModalView();
      }
    });

    // Keyboard support for incident cards
    this.root.addEventListener("keydown", (e) => {
      const incCard = e.target.closest(".incident-card-item");
      if (incCard && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        const incId = incCard.dataset.incidentId;
        if (incId) {
          if (this.selectedIncidentId === incId) {
            this.selectedIncidentId = null;
          } else {
            this.selectedIncidentId = incId;
          }
          this.updateUrl(false);
          this.updateView();
        }
      }
    });

    // Search input typing
    this.root.addEventListener("input", (e) => {
      if (e.target.id === "search-input") {
        this.filters.q = e.target.value;
        const clearBtn = this.root.querySelector("#btn-clear-search");
        if (clearBtn) {
          clearBtn.style.display = this.filters.q ? "flex" : "none";
        }
        this.updateUrl(true);
        this.updateView();
      } else if (e.target.id === "replay-slider") {
        this.pausePlayback();
        this.setReplayTime(Number(e.target.value), true);
      }
    });

    this.root.addEventListener("change", (e) => {
      if (e.target.id === "replay-slider") {
        this.pausePlayback();
        this.setReplayTime(Number(e.target.value), false);
      }
    });
  }

  updatePlayControlsView() {
    const playBtn = this.root.querySelector("#btn-play-pause");
    if (playBtn) {
      playBtn.textContent = this.isPlaying ? "⏸ Pause" : "▶ Play";
      playBtn.setAttribute("aria-label", this.isPlaying ? "Pause replay" : "Play replay");
    }
  }

  updateModalView() {
    const modalContainer = this.root.querySelector("#quality-modal-container");
    const healthBtn = this.root.querySelector("#btn-data-health");
    if (healthBtn) {
      healthBtn.setAttribute("aria-expanded", String(this.isQualityModalOpen));
    }

    if (!modalContainer) return;

    if (!this.isQualityModalOpen) {
      modalContainer.innerHTML = "";
      return;
    }

    const rejectedCount = this.rejectedEvents.length;

    modalContainer.innerHTML = `
      <div id="quality-modal-backdrop" class="wb-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="wb-modal-card">
          <div class="wb-modal-header">
            <h2 id="modal-title" class="wb-modal-title">
              <span>🛡️ Data Quality &amp; Ingestion Quarantine</span>
            </h2>
            <button id="btn-close-modal" class="btn-close-modal" aria-label="Close data quality modal">✕</button>
          </div>
          <div class="wb-modal-body">
            <div class="rejected-summary-grid">
              <div class="rejected-stat-box">
                <div class="rejected-stat-val">${this.rawEvents.length}</div>
                <div class="rejected-stat-label">Total Ingested Events</div>
              </div>
              <div class="rejected-stat-box">
                <div class="rejected-stat-val" style="color: var(--status-resolved);">${this.validEvents.length}</div>
                <div class="rejected-stat-label">Valid Events Processed</div>
              </div>
              <div class="rejected-stat-box">
                <div class="rejected-stat-val" style="color: ${rejectedCount > 0 ? "var(--sev1)" : "var(--status-resolved)"};">${rejectedCount}</div>
                <div class="rejected-stat-label">Rejected / Quarantined</div>
              </div>
            </div>

            <p style="font-size: 0.85rem; color: var(--text-muted);">
              Every incoming raw event is normalized and validated against strict schema rules. All malformed timestamps, unsupported types, invalid payloads, and duplicate event IDs are quarantined below to prevent KPI corruption.
            </p>

            ${
              rejectedCount > 0
                ? `
              <div class="rejected-table-wrapper">
                <table class="rejected-table">
                  <thead>
                    <tr>
                      <th>Raw Index</th>
                      <th>Event ID</th>
                      <th>Rejection Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.rejectedEvents
                      .map(
                        (r) => `
                      <tr>
                        <td>#${r.index}</td>
                        <td>${r.eventId ? this.escapeHtml(r.eventId) : "&lt;null&gt;"}</td>
                        <td><span class="reason-chip">${r.reason}</span></td>
                      </tr>
                    `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
                : `<p style="color: var(--status-resolved); font-weight: 600;">No rejected events found. All event records are fully valid.</p>`
            }
          </div>
        </div>
      </div>
    `;
  }

  updateView() {
    const dashboard = buildDashboard(this.rawEvents, this.filters, this.atMs);
    const { incidents, metrics } = dashboard;

    const isLive = this.atMs >= this.maxMs;
    const progressPct =
      this.maxMs > this.minMs
        ? ((this.atMs - this.minMs) / (this.maxMs - this.minMs)) * 100
        : 100;

    // 1. Header & Live Indicator
    const liveBadge = this.root.querySelector("#live-mode-badge");
    if (liveBadge) {
      liveBadge.className = `live-pill ${isLive ? "" : "simulating"}`;
      liveBadge.textContent = isLive ? "● LIVE STREAM" : "⏱ REPLAY MODE";
    }

    // 2. KPIs
    const kpiActive = this.root.querySelector("#kpi-active");
    if (kpiActive) kpiActive.textContent = metrics.activeCount;

    const kpiSev1 = this.root.querySelector("#kpi-sev1");
    if (kpiSev1) {
      kpiSev1.textContent = metrics.criticalActiveCount;
      kpiSev1.className = `kpi-value ${metrics.criticalActiveCount > 0 ? "critical" : ""}`;
    }

    const kpiAck = this.root.querySelector("#kpi-ack");
    if (kpiAck) kpiAck.textContent = `${metrics.acknowledgementRatePct}%`;

    const kpiMttr = this.root.querySelector("#kpi-mttr");
    if (kpiMttr) {
      kpiMttr.innerHTML = `${metrics.meanTimeToResolveMinutes}<span style="font-size: 0.9rem; margin-left: 2px;">m</span>`;
    }

    const kpiTopService = this.root.querySelector("#kpi-top-service");
    if (kpiTopService) {
      kpiTopService.textContent = metrics.topService ?? "—";
      kpiTopService.style.fontSize =
        metrics.topService && metrics.topService.length > 9 ? "1.2rem" : "1.5rem";
    }

    // 3. Replay Controls
    this.updatePlayControlsView();

    const timeDisplay = this.root.querySelector("#replay-time-display");
    if (timeDisplay) {
      timeDisplay.textContent = this.formatMsUtc(this.atMs);
      timeDisplay.setAttribute("datetime", new Date(this.atMs).toISOString());
    }

    const slider = this.root.querySelector("#replay-slider");
    if (slider && document.activeElement !== slider) {
      slider.value = String(this.atMs);
    }
    if (slider) {
      slider.style.background = `linear-gradient(to right, var(--primary) 0%, var(--primary) ${progressPct}%, #1e293b ${progressPct}%, #1e293b 100%)`;
    }

    // 4. Filters UI update
    const hasActiveFilters =
      Boolean(this.filters.q.trim()) ||
      this.filters.services.length > 0 ||
      this.filters.severities.length > 0 ||
      this.filters.statuses.length > 0;

    const clearFiltersBtn = this.root.querySelector("#btn-clear-filters");
    if (clearFiltersBtn) {
      clearFiltersBtn.style.display = hasActiveFilters ? "inline-flex" : "none";
    }

    const filterLabel = this.root.querySelector("#filter-state-label");
    if (filterLabel) {
      filterLabel.textContent = hasActiveFilters ? "Filtered view" : "All active slice";
    }

    // Update active filter pill states
    const pills = this.root.querySelectorAll(".filter-pill");
    pills.forEach((pill) => {
      const type = pill.dataset.filter;
      const val = pill.dataset.value;
      let isActive = false;
      if (type === "severity") isActive = this.filters.severities.includes(val);
      else if (type === "status") isActive = this.filters.statuses.includes(val);
      else if (type === "service") isActive = this.filters.services.includes(val);

      pill.classList.toggle("active", isActive);
      pill.setAttribute("aria-pressed", String(isActive));
    });

    // 5. Incidents List
    const incidentsCountBadge = this.root.querySelector("#incidents-count-badge");
    if (incidentsCountBadge) {
      incidentsCountBadge.textContent = incidents.length;
    }

    const incidentsContainer = this.root.querySelector("#incidents-list-container");
    if (incidentsContainer) {
      if (incidents.length === 0) {
        incidentsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <h3 class="empty-state-title">No Incidents Found</h3>
            <p class="empty-state-desc">
              No incidents match the active filters and replay timestamp.
            </p>
            ${
              hasActiveFilters
                ? `<button id="btn-empty-reset-filters" class="btn-secondary-action" style="margin-top: 8px;">Reset Filters</button>`
                : ""
            }
          </div>
        `;
      } else {
        incidentsContainer.innerHTML = incidents
          .map(
            (inc) => `
          <article
            class="incident-card-item ${inc.incidentId === this.selectedIncidentId ? "selected" : ""}"
            data-incident-id="${inc.incidentId}"
            role="option"
            aria-selected="${inc.incidentId === this.selectedIncidentId}"
            tabindex="0"
          >
            <div class="incident-card-top">
              <div class="incident-id-tags">
                <span class="incident-id-badge">${this.escapeHtml(inc.incidentId)}</span>
                <span class="sev-badge ${inc.severity.toLowerCase()}">${inc.severity}</span>
                <span class="status-badge ${inc.status}">${inc.status}</span>
              </div>
            </div>
            <h3 class="incident-card-title">${this.escapeHtml(inc.title)}</h3>
            <div class="incident-card-meta">
              <div class="meta-service-owner">
                <span class="service-tag">${this.escapeHtml(inc.service)}</span>
                <span class="owner-tag ${!inc.owner ? "unassigned" : ""}">
                  ${inc.owner ? `👤 ${this.escapeHtml(inc.owner)}` : "👤 Unassigned"}
                </span>
              </div>
              <time class="meta-time" datetime="${inc.updatedAt}">
                Updated ${this.formatIsoUtc(inc.updatedAt).split(" ")[1] ?? ""}
              </time>
            </div>
          </article>
        `
          )
          .join("");
      }
    }

    // 6. Selected Incident & Details Panel
    const selectedIncident = this.selectedIncidentId
      ? incidents.find((inc) => inc.incidentId === this.selectedIncidentId) || null
      : null;

    const detailBadge = this.root.querySelector("#detail-incident-id-badge");
    if (detailBadge) {
      if (selectedIncident) {
        detailBadge.style.display = "inline-block";
        detailBadge.textContent = selectedIncident.incidentId;
      } else {
        detailBadge.style.display = "none";
      }
    }

    const detailContainer = this.root.querySelector("#detail-content-container");
    if (detailContainer) {
      if (!selectedIncident) {
        detailContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <h3 class="empty-state-title">No Incident Selected</h3>
            <p class="empty-state-desc">
              Click on an incident from the list to inspect its details, lifecycle timestamps, notes, and historical event trajectory.
            </p>
          </div>
        `;
      } else {
        const incidentTimeline = this.validEvents.filter(
          (e) => e.incidentId === selectedIncident.incidentId && e.atMs <= this.atMs
        );

        detailContainer.innerHTML = `
          <!-- Title & Status Header -->
          <div class="detail-title-section">
            <div class="detail-title-row">
              <span class="detail-incident-id">${this.escapeHtml(selectedIncident.incidentId)}</span>
              <div style="display: flex; gap: 6px;">
                <span class="sev-badge ${selectedIncident.severity.toLowerCase()}">${selectedIncident.severity}</span>
                <span class="status-badge ${selectedIncident.status}">${selectedIncident.status}</span>
              </div>
            </div>
            <h3 class="detail-incident-heading">${this.escapeHtml(selectedIncident.title)}</h3>
          </div>

          <!-- Metadata Fields -->
          <div class="detail-meta-grid">
            <div class="detail-meta-item">
              <span class="detail-meta-label">Service</span>
              <span class="detail-meta-val">${this.escapeHtml(selectedIncident.service)}</span>
            </div>
            <div class="detail-meta-item">
              <span class="detail-meta-label">Assigned Owner</span>
              <span class="detail-meta-val">${selectedIncident.owner ? this.escapeHtml(selectedIncident.owner) : "Unassigned"}</span>
            </div>
            <div class="detail-meta-item">
              <span class="detail-meta-label">Created At</span>
              <span class="detail-meta-val">${this.formatIsoUtc(selectedIncident.createdAt)}</span>
            </div>
            <div class="detail-meta-item">
              <span class="detail-meta-label">Acknowledged At</span>
              <span class="detail-meta-val">${selectedIncident.acknowledgedAt ? this.formatIsoUtc(selectedIncident.acknowledgedAt) : "Not Acknowledged"}</span>
            </div>
            <div class="detail-meta-item">
              <span class="detail-meta-label">Resolved At</span>
              <span class="detail-meta-val">${selectedIncident.resolvedAt ? this.formatIsoUtc(selectedIncident.resolvedAt) : "Open"}</span>
            </div>
            <div class="detail-meta-item">
              <span class="detail-meta-label">Last Updated At</span>
              <span class="detail-meta-val">${this.formatIsoUtc(selectedIncident.updatedAt)}</span>
            </div>
          </div>

          <!-- Notes Section -->
          ${
            selectedIncident.notes.length > 0
              ? `
            <div class="detail-notes-section">
              <h4 class="section-subtitle">Investigation Notes (${selectedIncident.notes.length})</h4>
              <div class="notes-list">
                ${selectedIncident.notes
                  .map(
                    (n) => `
                  <div class="note-item">
                    <time class="note-time">${this.formatIsoUtc(n.at)}</time>
                    <p class="note-text">${this.escapeHtml(n.text)}</p>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          <!-- Chronological Event Trail -->
          <div class="timeline-section">
            <h4 class="section-subtitle">Event Trail as of Replay Point (${incidentTimeline.length} events)</h4>
            <div class="timeline-list">
              ${incidentTimeline
                .map((evt) => {
                  let payloadDesc = "";
                  switch (evt.type) {
                    case "incident_created":
                      payloadDesc = `Incident created with severity <strong>${evt.payload.severity}</strong> in service <strong>${this.escapeHtml(evt.payload.service)}</strong>`;
                      break;
                    case "owner_assigned":
                      payloadDesc = `Owner assigned to <strong>${this.escapeHtml(evt.payload.owner)}</strong>`;
                      break;
                    case "severity_changed":
                      payloadDesc = `Severity changed to <strong>${evt.payload.severity}</strong>`;
                      break;
                    case "incident_acknowledged":
                      payloadDesc = `Incident acknowledged by responder`;
                      break;
                    case "incident_resolved":
                      payloadDesc = `Incident marked as resolved`;
                      break;
                    case "incident_reopened":
                      payloadDesc = `Incident reopened`;
                      break;
                    case "note_added":
                      payloadDesc = `Note: <em>${this.escapeHtml(evt.payload.text)}</em>`;
                      break;
                    default:
                      payloadDesc = JSON.stringify(evt.payload);
                  }

                  return `
                  <div class="timeline-node">
                    <div class="timeline-dot"></div>
                    <div class="timeline-node-header">
                      <span class="timeline-event-type">${evt.type.replace(/_/g, " ").toUpperCase()}</span>
                      <time class="timeline-event-time">${this.formatIsoUtc(evt.at)}</time>
                    </div>
                    <div class="timeline-event-body">${payloadDesc}</div>
                  </div>
                `;
                })
                .join("")}
            </div>
          </div>
        `;
      }
    }
  }
}

// Bootstrap application on DOM ready
const appContainer = document.querySelector("#app");
if (appContainer) {
  new IncidentWorkbenchApp(appContainer);
}
