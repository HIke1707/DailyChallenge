import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyFilters,
  buildDashboard,
  calculateMetrics,
  normalizeEvents,
  reduceIncidentEvents,
} from "../src/core.mjs";

test("normalizeEvents handles edge cases and null/primitive inputs", () => {
  assert.deepEqual(normalizeEvents(null), { validEvents: [], rejectedEvents: [] });
  assert.deepEqual(normalizeEvents(undefined), { validEvents: [], rejectedEvents: [] });
  assert.deepEqual(normalizeEvents("invalid"), { validEvents: [], rejectedEvents: [] });
  assert.deepEqual(normalizeEvents(123), { validEvents: [], rejectedEvents: [] });
  assert.deepEqual(normalizeEvents({}), { validEvents: [], rejectedEvents: [] });

  const mixed = [
    null,
    123,
    "string",
    [],
    {},
    { eventId: "", incidentId: "INC-1", type: "incident_created", at: "2026-08-14T08:00:00Z", payload: { title: "T", service: "S", severity: "SEV-1" } },
    { eventId: "e1", incidentId: "", type: "incident_created", at: "2026-08-14T08:00:00Z", payload: { title: "T", service: "S", severity: "SEV-1" } },
    { eventId: "e2", incidentId: "INC-1", type: "", at: "2026-08-14T08:00:00Z", payload: { title: "T", service: "S", severity: "SEV-1" } },
    { eventId: "e3", incidentId: "INC-1", type: "incident_created", at: "", payload: { title: "T", service: "S", severity: "SEV-1" } },
    { eventId: "e4", incidentId: "INC-1", type: "incident_created", at: "2026-08-14T08:00:00Z", payload: null },
    { eventId: "e5", incidentId: "INC-1", type: "incident_created", at: "2026-08-14T08:00:00Z", payload: [] },
  ];

  const res = normalizeEvents(mixed);
  assert.equal(res.validEvents.length, 0);
  assert.equal(res.rejectedEvents.length, 11);
  for (const item of res.rejectedEvents) {
    assert.equal(item.reason, "invalid_shape");
  }
});

test("normalizeEvents enforces timestamp format with timezone Z or +/-HH:mm", () => {
  const items = [
    // missing timezone
    { eventId: "e1", incidentId: "INC-1", type: "incident_acknowledged", at: "2026-08-14 08:00:00", payload: {} },
    // invalid date
    { eventId: "e2", incidentId: "INC-1", type: "incident_acknowledged", at: "not-a-date", payload: {} },
    // valid with Z
    { eventId: "e3", incidentId: "INC-1", type: "incident_acknowledged", at: "2026-08-14T08:00:00Z", payload: {} },
    // valid with +08:00
    { eventId: "e4", incidentId: "INC-1", type: "incident_acknowledged", at: "2026-08-14T08:00:00+08:00", payload: {} },
    // valid with -05:00
    { eventId: "e5", incidentId: "INC-1", type: "incident_acknowledged", at: "2026-08-14T08:00:00-05:00", payload: {} },
  ];

  const res = normalizeEvents(items);
  assert.equal(res.rejectedEvents.length, 2);
  assert.equal(res.rejectedEvents[0].reason, "invalid_timestamp");
  assert.equal(res.rejectedEvents[1].reason, "invalid_timestamp");
  assert.equal(res.validEvents.length, 3);
});

test("normalizeEvents validates unsupported types and payload schemas", () => {
  const items = [
    // unsupported type
    { eventId: "e1", incidentId: "INC-1", type: "unknown_event", at: "2026-08-14T08:00:00Z", payload: {} },
    // incident_created invalid title
    { eventId: "e2", incidentId: "INC-1", type: "incident_created", at: "2026-08-14T08:00:00Z", payload: { title: "", service: "auth", severity: "SEV-1" } },
    // incident_created invalid service
    { eventId: "e3", incidentId: "INC-1", type: "incident_created", at: "2026-08-14T08:00:00Z", payload: { title: "Crash", service: "", severity: "SEV-1" } },
    // incident_created invalid severity
    { eventId: "e4", incidentId: "INC-1", type: "incident_created", at: "2026-08-14T08:00:00Z", payload: { title: "Crash", service: "auth", severity: "P0" } },
    // owner_assigned invalid owner
    { eventId: "e5", incidentId: "INC-1", type: "owner_assigned", at: "2026-08-14T08:00:00Z", payload: { owner: "" } },
    // severity_changed invalid severity
    { eventId: "e6", incidentId: "INC-1", type: "severity_changed", at: "2026-08-14T08:00:00Z", payload: { severity: "SEV-5" } },
    // note_added invalid text
    { eventId: "e7", incidentId: "INC-1", type: "note_added", at: "2026-08-14T08:00:00Z", payload: { text: "" } },
  ];

  const res = normalizeEvents(items);
  assert.equal(res.validEvents.length, 0);
  assert.equal(res.rejectedEvents[0].reason, "unsupported_type");
  for (let i = 1; i <= 6; i++) {
    assert.equal(res.rejectedEvents[i].reason, "invalid_payload");
  }
});

test("reduceIncidentEvents complex lifecycle (create, ack, re-assign, resolve, reopen, note)", () => {
  const events = [
    // uncreated event ignored
    { eventId: "e0", incidentId: "INC-99", at: "2026-08-14T07:50:00Z", atMs: 100, type: "incident_acknowledged", payload: {} },
    // created
    { eventId: "e1", incidentId: "INC-1", at: "2026-08-14T08:00:00Z", atMs: 1000, type: "incident_created", payload: { title: "API down", service: "gateway", severity: "SEV-2" } },
    // duplicate created ignored
    { eventId: "e2", incidentId: "INC-1", at: "2026-08-14T08:01:00Z", atMs: 1001, type: "incident_created", payload: { title: "API down new", service: "gateway2", severity: "SEV-1" } },
    // owner assigned
    { eventId: "e3", incidentId: "INC-1", at: "2026-08-14T08:05:00Z", atMs: 1005, type: "owner_assigned", payload: { owner: "Alice" } },
    // acknowledged
    { eventId: "e4", incidentId: "INC-1", at: "2026-08-14T08:10:00Z", atMs: 1010, type: "incident_acknowledged", payload: {} },
    // severity changed
    { eventId: "e5", incidentId: "INC-1", at: "2026-08-14T08:15:00Z", atMs: 1015, type: "severity_changed", payload: { severity: "SEV-1" } },
    // note added
    { eventId: "e6", incidentId: "INC-1", at: "2026-08-14T08:20:00Z", atMs: 1020, type: "note_added", payload: { text: "Investigating root cause" } },
    // resolved
    { eventId: "e7", incidentId: "INC-1", at: "2026-08-14T08:30:00Z", atMs: 1030, type: "incident_resolved", payload: {} },
    // reopened
    { eventId: "e8", incidentId: "INC-1", at: "2026-08-14T08:40:00Z", atMs: 1040, type: "incident_reopened", payload: {} },
  ];

  // At 1005 ms: open, owner Alice, SEV-2, not acked
  const at1005 = reduceIncidentEvents(events, 1005);
  assert.equal(at1005.length, 1);
  assert.equal(at1005[0].status, "open");
  assert.equal(at1005[0].owner, "Alice");
  assert.equal(at1005[0].severity, "SEV-2");
  assert.equal(at1005[0].acknowledgedAt, null);
  assert.equal(at1005[0].resolvedAt, null);
  assert.equal(at1005[0].updatedAt, "2026-08-14T08:05:00Z");

  // At 1030 ms: resolved, SEV-1, acked at 1010, resolved at 1030
  const at1030 = reduceIncidentEvents(events, 1030);
  assert.equal(at1030[0].status, "resolved");
  assert.equal(at1030[0].severity, "SEV-1");
  assert.equal(at1030[0].acknowledgedAt, "2026-08-14T08:10:00Z");
  assert.equal(at1030[0].resolvedAt, "2026-08-14T08:30:00Z");
  assert.equal(at1030[0].notes.length, 1);

  // At 1040 ms: reopened -> status open, resolvedAt null, acknowledgedAt kept
  const at1040 = reduceIncidentEvents(events, 1040);
  assert.equal(at1040[0].status, "open");
  assert.equal(at1040[0].resolvedAt, null);
  assert.equal(at1040[0].acknowledgedAt, "2026-08-14T08:10:00Z");
  assert.equal(at1040[0].updatedAt, "2026-08-14T08:40:00Z");
});

test("calculateMetrics handles empty lists and single incident cases", () => {
  assert.deepEqual(calculateMetrics([]), {
    totalCount: 0,
    activeCount: 0,
    criticalActiveCount: 0,
    acknowledgementRatePct: 0,
    meanTimeToResolveMinutes: 0,
    topService: null,
  });

  const single = [
    {
      incidentId: "INC-1",
      severity: "SEV-2",
      status: "acknowledged",
      service: "payment",
      createdAt: "2026-08-14T08:00:00Z",
      acknowledgedAt: "2026-08-14T08:05:00Z",
      resolvedAt: null,
    },
  ];

  assert.deepEqual(calculateMetrics(single), {
    totalCount: 1,
    activeCount: 1,
    criticalActiveCount: 0,
    acknowledgementRatePct: 100,
    meanTimeToResolveMinutes: 0,
    topService: "payment",
  });
});

test("buildDashboard processes real data/events.json properly", () => {
  const rawData = JSON.parse(readFileSync(new URL("../data/events.json", import.meta.url), "utf-8"));
  const dashboard = buildDashboard(rawData, {}, Infinity);

  assert.ok(dashboard.incidents.length > 0);
  assert.ok(dashboard.rejectedEvents.length > 0);
  assert.ok(typeof dashboard.metrics.totalCount === "number");
  assert.ok(dashboard.metrics.totalCount === dashboard.incidents.length);
  assert.ok(dashboard.metrics.activeCount <= dashboard.metrics.totalCount);
});
