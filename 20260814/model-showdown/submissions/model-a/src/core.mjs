/**
 * Pure incident replay operations.  Keeping these functions free of DOM and
 * browser APIs makes the replay model usable by both the UI and Node tests.
 */

const SEVERITIES = new Set(["SEV-1", "SEV-2", "SEV-3", "SEV-4"]);
const EVENT_TYPES = new Set([
  "incident_created",
  "owner_assigned",
  "severity_changed",
  "incident_acknowledged",
  "incident_resolved",
  "incident_reopened",
  "note_added",
]);

const hasText = (value) => typeof value === "string" && value.trim().length > 0;

function isPayloadObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTimestamp(value) {
  if (!hasText(value)) return false;
  // Date.parse accepts a few timezone-less formats, so require the explicit
  // timezone that the event contract calls for before parsing it.
  const isoWithTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
  return isoWithTimezone.test(value) && Number.isFinite(Date.parse(value));
}

function isValidPayload(type, payload) {
  switch (type) {
    case "incident_created":
      return hasText(payload.title) && hasText(payload.service) && SEVERITIES.has(payload.severity);
    case "owner_assigned":
      return hasText(payload.owner);
    case "severity_changed":
      return SEVERITIES.has(payload.severity);
    case "note_added":
      return hasText(payload.text);
    case "incident_acknowledged":
    case "incident_resolved":
    case "incident_reopened":
      return true;
    default:
      return false;
  }
}

export function normalizeEvents(rawEvents) {
  const validEvents = [];
  const rejectedEvents = [];
  const seenEventIds = new Set();
  const source = Array.isArray(rawEvents) ? rawEvents : [];

  source.forEach((event, index) => {
    const eventId = event && typeof event.eventId === "string" && event.eventId.trim() ? event.eventId : null;
    const shapeIsValid = event !== null
      && typeof event === "object"
      && !Array.isArray(event)
      && hasText(event.eventId)
      && hasText(event.incidentId)
      && hasText(event.type)
      && hasText(event.at)
      && isPayloadObject(event.payload);

    if (!shapeIsValid) {
      rejectedEvents.push({ index, eventId, reason: "invalid_shape" });
      return;
    }

    if (!isTimestamp(event.at)) {
      rejectedEvents.push({ index, eventId, reason: "invalid_timestamp" });
      return;
    }

    if (!EVENT_TYPES.has(event.type)) {
      rejectedEvents.push({ index, eventId, reason: "unsupported_type" });
      return;
    }

    if (!isValidPayload(event.type, event.payload)) {
      rejectedEvents.push({ index, eventId, reason: "invalid_payload" });
      return;
    }

    if (seenEventIds.has(event.eventId)) {
      rejectedEvents.push({ index, eventId, reason: "duplicate_event_id" });
      return;
    }

    seenEventIds.add(event.eventId);
    validEvents.push({
      eventId: event.eventId,
      incidentId: event.incidentId,
      at: event.at,
      atMs: Date.parse(event.at),
      type: event.type,
      payload: event.payload,
    });
  });

  validEvents.sort((left, right) => left.atMs - right.atMs || (left.eventId < right.eventId ? -1 : left.eventId > right.eventId ? 1 : 0));
  return { validEvents, rejectedEvents };
}

export function reduceIncidentEvents(validEvents, atMs) {
  const cutoff = Number.isFinite(atMs) ? atMs : Number.POSITIVE_INFINITY;
  const states = new Map();
  const events = Array.isArray(validEvents) ? validEvents : [];

  for (const event of events) {
    if (!event || !Number.isFinite(event.atMs) || event.atMs > cutoff) continue;
    const current = states.get(event.incidentId);

    if (event.type === "incident_created") {
      if (current) continue;
      states.set(event.incidentId, {
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

    // An update received before creation has no state to update.
    if (!current) continue;

    current.updatedAt = event.at;
    switch (event.type) {
      case "owner_assigned":
        current.owner = event.payload.owner;
        break;
      case "severity_changed":
        current.severity = event.payload.severity;
        break;
      case "incident_acknowledged":
        if (current.acknowledgedAt === null) current.acknowledgedAt = event.at;
        if (current.status !== "resolved") current.status = "acknowledged";
        break;
      case "incident_resolved":
        current.status = "resolved";
        current.resolvedAt = event.at;
        break;
      case "incident_reopened":
        current.status = "open";
        current.resolvedAt = null;
        break;
      case "note_added":
        current.notes.push({ at: event.at, text: event.payload.text });
        break;
      default:
        break;
    }
  }

  return [...states.values()].sort((left, right) => (left.incidentId < right.incidentId ? -1 : left.incidentId > right.incidentId ? 1 : 0));
}

export function applyFilters(incidents, filters = {}) {
  const list = Array.isArray(incidents) ? incidents : [];
  const query = typeof filters.q === "string" ? filters.q.toLowerCase() : "";
  const services = Array.isArray(filters.services) ? filters.services : [];
  const severities = Array.isArray(filters.severities) ? filters.severities : [];
  const statuses = Array.isArray(filters.statuses) ? filters.statuses : [];

  return list.filter((incident) => {
    const searchable = [incident.incidentId, incident.title, incident.service, incident.owner]
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLowerCase();
    return (!query || searchable.includes(query))
      && (!services.length || services.includes(incident.service))
      && (!severities.length || severities.includes(incident.severity))
      && (!statuses.length || statuses.includes(incident.status));
  });
}

function roundToOne(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function calculateMetrics(incidents) {
  const list = Array.isArray(incidents) ? incidents : [];
  const totalCount = list.length;
  const active = list.filter((incident) => incident.status !== "resolved");
  const criticalActiveCount = active.filter((incident) => incident.severity === "SEV-1").length;
  const acknowledgementCount = list.filter((incident) => Boolean(incident.acknowledgedAt)).length;
  const resolveDurations = list
    .filter((incident) => incident.status === "resolved")
    .map((incident) => [Date.parse(incident.createdAt), Date.parse(incident.resolvedAt)])
    .filter(([created, resolved]) => Number.isFinite(created) && Number.isFinite(resolved))
    .map(([created, resolved]) => (resolved - created) / 60000);
  const serviceCounts = new Map();

  for (const incident of list) {
    if (typeof incident.service !== "string" || !incident.service) continue;
    serviceCounts.set(incident.service, (serviceCounts.get(incident.service) ?? 0) + 1);
  }

  let topService = null;
  let topCount = 0;
  for (const [service, count] of serviceCounts) {
    if (count > topCount || (count === topCount && (topService === null || service < topService))) {
      topService = service;
      topCount = count;
    }
  }

  return {
    totalCount,
    activeCount: active.length,
    criticalActiveCount,
    acknowledgementRatePct: totalCount ? roundToOne((acknowledgementCount / totalCount) * 100) : 0,
    meanTimeToResolveMinutes: resolveDurations.length
      ? roundToOne(resolveDurations.reduce((sum, duration) => sum + duration, 0) / resolveDurations.length)
      : 0,
    topService,
  };
}

export function buildDashboard(rawEvents, filters, atMs) {
  const { validEvents, rejectedEvents } = normalizeEvents(rawEvents);
  const replayedIncidents = reduceIncidentEvents(validEvents, atMs);
  const incidents = applyFilters(replayedIncidents, filters);
  return { incidents, metrics: calculateMetrics(incidents), rejectedEvents };
}
