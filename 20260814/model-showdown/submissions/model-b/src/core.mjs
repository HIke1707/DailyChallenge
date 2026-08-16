/**
 * Core business logic for Incident Replay Workbench.
 * Pure ES module with zero DOM dependencies.
 */

const VALID_SEVERITIES = new Set(["SEV-1", "SEV-2", "SEV-3", "SEV-4"]);
const SUPPORTED_TYPES = new Set([
  "incident_created",
  "owner_assigned",
  "severity_changed",
  "incident_acknowledged",
  "incident_resolved",
  "incident_reopened",
  "note_added",
]);

const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Validates and normalizes raw event stream.
 * Rejection reason precedence:
 * 1. invalid_shape
 * 2. invalid_timestamp
 * 3. unsupported_type
 * 4. invalid_payload
 * 5. duplicate_event_id
 */
export function normalizeEvents(rawEvents) {
  if (!Array.isArray(rawEvents)) {
    return { validEvents: [], rejectedEvents: [] };
  }

  const validEvents = [];
  const rejectedEvents = [];
  const seenValidEventIds = new Set();

  for (let i = 0; i < rawEvents.length; i++) {
    const item = rawEvents[i];

    // 1. invalid_shape
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item) ||
      typeof item.eventId !== "string" ||
      item.eventId.length === 0 ||
      typeof item.incidentId !== "string" ||
      item.incidentId.length === 0 ||
      typeof item.type !== "string" ||
      item.type.length === 0 ||
      typeof item.at !== "string" ||
      item.at.length === 0 ||
      typeof item.payload !== "object" ||
      item.payload === null ||
      Array.isArray(item.payload)
    ) {
      const eventId =
        typeof item === "object" &&
        item !== null &&
        typeof item.eventId === "string" &&
        item.eventId.length > 0
          ? item.eventId
          : null;
      rejectedEvents.push({ index: i, eventId, reason: "invalid_shape" });
      continue;
    }

    const { eventId, incidentId, type, at, payload } = item;

    // 2. invalid_timestamp
    if (!ISO_TIMESTAMP_REGEX.test(at)) {
      rejectedEvents.push({ index: i, eventId, reason: "invalid_timestamp" });
      continue;
    }
    const atMs = Date.parse(at);
    if (Number.isNaN(atMs)) {
      rejectedEvents.push({ index: i, eventId, reason: "invalid_timestamp" });
      continue;
    }

    // 3. unsupported_type
    if (!SUPPORTED_TYPES.has(type)) {
      rejectedEvents.push({ index: i, eventId, reason: "unsupported_type" });
      continue;
    }

    // 4. invalid_payload
    let isPayloadValid = true;
    switch (type) {
      case "incident_created":
        if (
          typeof payload.title !== "string" ||
          payload.title.length === 0 ||
          typeof payload.service !== "string" ||
          payload.service.length === 0 ||
          !VALID_SEVERITIES.has(payload.severity)
        ) {
          isPayloadValid = false;
        }
        break;
      case "owner_assigned":
        if (typeof payload.owner !== "string" || payload.owner.length === 0) {
          isPayloadValid = false;
        }
        break;
      case "severity_changed":
        if (!VALID_SEVERITIES.has(payload.severity)) {
          isPayloadValid = false;
        }
        break;
      case "note_added":
        if (typeof payload.text !== "string" || payload.text.length === 0) {
          isPayloadValid = false;
        }
        break;
      case "incident_acknowledged":
      case "incident_resolved":
      case "incident_reopened":
        // No extra payload fields required
        break;
      default:
        isPayloadValid = false;
    }

    if (!isPayloadValid) {
      rejectedEvents.push({ index: i, eventId, reason: "invalid_payload" });
      continue;
    }

    // 5. duplicate_event_id
    if (seenValidEventIds.has(eventId)) {
      rejectedEvents.push({ index: i, eventId, reason: "duplicate_event_id" });
      continue;
    }

    seenValidEventIds.add(eventId);
    validEvents.push({
      eventId,
      incidentId,
      at,
      atMs,
      type,
      payload: { ...payload },
    });
  }

  // Sort validEvents: ascending atMs, then ascending eventId lexicographically
  validEvents.sort((a, b) => {
    if (a.atMs !== b.atMs) {
      return a.atMs - b.atMs;
    }
    return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
  });

  return { validEvents, rejectedEvents };
}

/**
 * Replays valid events up to atMs and returns reduced incident states.
 */
export function reduceIncidentEvents(validEvents, atMs) {
  const targetMs =
    typeof atMs === "number" && Number.isFinite(atMs) ? atMs : Infinity;
  const events = Array.isArray(validEvents) ? validEvents : [];

  const incidentMap = new Map();

  for (const event of events) {
    if (event.atMs > targetMs) {
      continue;
    }

    if (event.type === "incident_created") {
      // Ignore if incident already created
      if (incidentMap.has(event.incidentId)) {
        continue;
      }
      incidentMap.set(event.incidentId, {
        incidentId: event.incidentId,
        title: event.payload.title,
        service: event.payload.service,
        severity: event.payload.severity,
        owner: null,
        status: "open",
        createdAt: event.at,
        acknowledgedAt: null,
        resolvedAt: null,
        updatedAt: event.at,
        notes: [],
      });
      continue;
    }

    // Ignore other events if incident not created yet
    if (!incidentMap.has(event.incidentId)) {
      continue;
    }

    const incident = incidentMap.get(event.incidentId);
    incident.updatedAt = event.at;

    switch (event.type) {
      case "owner_assigned":
        incident.owner = event.payload.owner;
        break;
      case "severity_changed":
        incident.severity = event.payload.severity;
        break;
      case "incident_acknowledged":
        if (incident.acknowledgedAt === null) {
          incident.acknowledgedAt = event.at;
        }
        if (incident.status !== "resolved") {
          incident.status = "acknowledged";
        }
        break;
      case "incident_resolved":
        incident.status = "resolved";
        incident.resolvedAt = event.at;
        break;
      case "incident_reopened":
        incident.status = "open";
        incident.resolvedAt = null;
        break;
      case "note_added":
        incident.notes.push({
          at: event.at,
          text: event.payload.text,
        });
        break;
    }
  }

  const result = Array.from(incidentMap.values());
  result.sort((a, b) =>
    a.incidentId < b.incidentId ? -1 : a.incidentId > b.incidentId ? 1 : 0
  );
  return result;
}

/**
 * Filters incidents by search query and attribute criteria.
 */
export function applyFilters(incidents, filters) {
  if (!Array.isArray(incidents)) {
    return [];
  }
  if (!filters || typeof filters !== "object") {
    return [...incidents];
  }

  const query = typeof filters.q === "string" ? filters.q.trim().toLowerCase() : "";
  const services = Array.isArray(filters.services) && filters.services.length > 0 ? new Set(filters.services) : null;
  const severities = Array.isArray(filters.severities) && filters.severities.length > 0 ? new Set(filters.severities) : null;
  const statuses = Array.isArray(filters.statuses) && filters.statuses.length > 0 ? new Set(filters.statuses) : null;

  return incidents.filter((incident) => {
    if (query) {
      const matchId = (incident.incidentId || "").toLowerCase().includes(query);
      const matchTitle = (incident.title || "").toLowerCase().includes(query);
      const matchService = (incident.service || "").toLowerCase().includes(query);
      const matchOwner = (incident.owner || "").toLowerCase().includes(query);
      if (!matchId && !matchTitle && !matchService && !matchOwner) {
        return false;
      }
    }

    if (services && !services.has(incident.service)) {
      return false;
    }

    if (severities && !severities.has(incident.severity)) {
      return false;
    }

    if (statuses && !statuses.has(incident.status)) {
      return false;
    }

    return true;
  });
}

/**
 * Calculates operational KPIs from a set of incidents.
 */
export function calculateMetrics(incidents) {
  const list = Array.isArray(incidents) ? incidents : [];
  const totalCount = list.length;

  let activeCount = 0;
  let criticalActiveCount = 0;
  let acknowledgedCount = 0;
  const resolveDurations = [];
  const serviceCounts = new Map();

  for (const incident of list) {
    const isActive = incident.status !== "resolved";
    if (isActive) {
      activeCount++;
      if (incident.severity === "SEV-1") {
        criticalActiveCount++;
      }
    }

    if (incident.acknowledgedAt !== null) {
      acknowledgedCount++;
    }

    if (
      incident.status === "resolved" &&
      typeof incident.createdAt === "string" &&
      typeof incident.resolvedAt === "string"
    ) {
      const createdMs = Date.parse(incident.createdAt);
      const resolvedMs = Date.parse(incident.resolvedAt);
      if (!Number.isNaN(createdMs) && !Number.isNaN(resolvedMs) && resolvedMs >= createdMs) {
        resolveDurations.push((resolvedMs - createdMs) / 60000);
      }
    }

    if (typeof incident.service === "string" && incident.service.length > 0) {
      serviceCounts.set(
        incident.service,
        (serviceCounts.get(incident.service) || 0) + 1
      );
    }
  }

  const acknowledgementRatePct =
    totalCount > 0
      ? Math.round((acknowledgedCount / totalCount) * 1000) / 10
      : 0;

  const meanTimeToResolveMinutes =
    resolveDurations.length > 0
      ? Math.round(
          (resolveDurations.reduce((sum, d) => sum + d, 0) /
            resolveDurations.length) *
            10
        ) / 10
      : 0;

  let topService = null;
  let maxCount = -1;
  for (const [svc, count] of serviceCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      topService = svc;
    } else if (count === maxCount) {
      if (topService === null || svc < topService) {
        topService = svc;
      }
    }
  }

  return {
    totalCount,
    activeCount,
    criticalActiveCount,
    acknowledgementRatePct,
    meanTimeToResolveMinutes,
    topService,
  };
}

/**
 * Aggregates full dashboard model at given replay slice and filter state.
 */
export function buildDashboard(rawEvents, filters, atMs) {
  const { validEvents, rejectedEvents } = normalizeEvents(rawEvents);
  const reducedIncidents = reduceIncidentEvents(validEvents, atMs);
  const filteredIncidents = applyFilters(reducedIncidents, filters);
  const metrics = calculateMetrics(filteredIncidents);

  return {
    incidents: filteredIncidents,
    metrics,
    rejectedEvents,
  };
}
