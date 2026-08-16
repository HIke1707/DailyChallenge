import test from "node:test";
import assert from "node:assert/strict";
import {
  applyFilters,
  buildDashboard,
  calculateMetrics,
  normalizeEvents,
  reduceIncidentEvents,
} from "../src/core.mjs";

const events = [
  {
    eventId: "evt-3",
    incidentId: "INC-1",
    at: "2026-08-14T08:30:00Z",
    type: "incident_resolved",
    payload: {},
  },
  {
    eventId: "evt-1",
    incidentId: "INC-1",
    at: "2026-08-14T08:00:00Z",
    type: "incident_created",
    payload: { title: "Checkout latency", service: "checkout", severity: "SEV-1" },
  },
  {
    eventId: "evt-2",
    incidentId: "INC-1",
    at: "2026-08-14T08:10:00Z",
    type: "incident_acknowledged",
    payload: {},
  },
];

test("normalizeEvents sorts without mutating input", () => {
  const copy = structuredClone(events);
  const result = normalizeEvents(events);
  assert.deepEqual(result.validEvents.map((event) => event.eventId), ["evt-1", "evt-2", "evt-3"]);
  assert.equal(result.rejectedEvents.length, 0);
  assert.equal(result.validEvents[0].atMs, Date.parse("2026-08-14T08:00:00Z"));
  assert.deepEqual(events, copy);
});

test("normalizeEvents rejects a later duplicate and an invalid payload", () => {
  const result = normalizeEvents([
    ...events,
    { ...events[0], at: "2026-08-14T09:00:00Z" },
    {
      eventId: "evt-4",
      incidentId: "INC-2",
      at: "2026-08-14T09:00:00Z",
      type: "severity_changed",
      payload: { severity: "urgent" },
    },
  ]);
  assert.deepEqual(result.rejectedEvents.map(({ eventId, reason }) => ({ eventId, reason })), [
    { eventId: "evt-3", reason: "duplicate_event_id" },
    { eventId: "evt-4", reason: "invalid_payload" },
  ]);
});

test("reduceIncidentEvents respects replay time", () => {
  const { validEvents } = normalizeEvents(events);
  const [incident] = reduceIncidentEvents(validEvents, Date.parse("2026-08-14T08:15:00Z"));
  assert.equal(incident.status, "acknowledged");
  assert.equal(incident.resolvedAt, null);
  assert.equal(incident.acknowledgedAt, "2026-08-14T08:10:00Z");
});

test("filters use AND between fields and search owner", () => {
  const incidents = [
    { incidentId: "INC-1", title: "Checkout latency", service: "checkout", severity: "SEV-1", status: "open", owner: "Mina" },
    { incidentId: "INC-2", title: "Webhook lag", service: "billing", severity: "SEV-2", status: "resolved", owner: "Noah" },
  ];
  assert.deepEqual(
    applyFilters(incidents, { q: "MIN", services: ["checkout"], statuses: ["open"] }).map((item) => item.incidentId),
    ["INC-1"],
  );
});

test("calculateMetrics follows the documented rounding and tie break", () => {
  const incidents = [
    {
      severity: "SEV-1", status: "resolved", service: "zeta", acknowledgedAt: "2026-08-14T08:10:00Z",
      createdAt: "2026-08-14T08:00:00Z", resolvedAt: "2026-08-14T08:31:00Z",
    },
    {
      severity: "SEV-1", status: "open", service: "alpha", acknowledgedAt: null,
      createdAt: "2026-08-14T09:00:00Z", resolvedAt: null,
    },
  ];
  assert.deepEqual(calculateMetrics(incidents), {
    totalCount: 2,
    activeCount: 1,
    criticalActiveCount: 1,
    acknowledgementRatePct: 50,
    meanTimeToResolveMinutes: 31,
    topService: "alpha",
  });
});

test("buildDashboard calculates metrics after filters", () => {
  const dashboard = buildDashboard(events, { statuses: ["resolved"] }, Infinity);
  assert.equal(dashboard.incidents.length, 1);
  assert.equal(dashboard.metrics.activeCount, 0);
});
