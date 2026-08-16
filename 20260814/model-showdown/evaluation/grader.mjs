import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const requiredExports = [
  "normalizeEvents",
  "reduceIncidentEvents",
  "applyFilters",
  "calculateMetrics",
  "buildDashboard",
];

const event = (eventId, incidentId, at, type, payload = {}) => ({
  eventId,
  incidentId,
  at,
  type,
  payload,
});

const create = (eventId, incidentId, at, title, service, severity) =>
  event(eventId, incidentId, at, "incident_created", { title, service, severity });

const clone = (value) => structuredClone(value);

async function exists(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function textOrEmpty(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

function errorText(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function scoreCheck(results, category, name, points, run) {
  try {
    run();
    results.push({ category, name, points, earned: points, passed: true });
  } catch (error) {
    results.push({ category, name, points, earned: 0, passed: false, detail: errorText(error) });
  }
}

async function scoreAsyncCheck(results, category, name, points, run) {
  try {
    await run();
    results.push({ category, name, points, earned: points, passed: true });
  } catch (error) {
    results.push({ category, name, points, earned: 0, passed: false, detail: errorText(error) });
  }
}

function functionalChecks(core, results) {
  scoreCheck(results, "core", "required ESM exports", 2, () => {
    assert.ok(core, "core.mjs could not be imported");
    for (const name of requiredExports) assert.equal(typeof core[name], "function", `missing export: ${name}`);
  });

  scoreCheck(results, "normalize", "shape, timestamp and validation precedence", 4, () => {
    const output = core.normalizeEvents([
      null,
      { eventId: "", incidentId: "I", at: "bad", type: "unknown", payload: {} },
      create("bad-local", "I", "2026-08-14T08:00:00", "Local", "api", "SEV-2"),
      create("bad-date", "I", "2026-02-30T08:00:00Z", "Rolled date", "api", "SEV-2"),
      create("offset", "I", "2026-08-14T16:00:00+08:00", "Offset", "api", "SEV-2"),
    ]);
    assert.deepEqual(output.rejectedEvents.map(({ index, eventId, reason }) => ({ index, eventId, reason })), [
      { index: 0, eventId: null, reason: "invalid_shape" },
      { index: 1, eventId: null, reason: "invalid_shape" },
      { index: 2, eventId: "bad-local", reason: "invalid_timestamp" },
      { index: 3, eventId: "bad-date", reason: "invalid_timestamp" },
    ]);
    assert.equal(output.validEvents.length, 1);
    assert.equal(output.validEvents[0].atMs, Date.parse("2026-08-14T08:00:00Z"));
    assert.deepEqual(core.normalizeEvents("not-an-array"), { validEvents: [], rejectedEvents: [] });
  });

  scoreCheck(results, "normalize", "supported event types and payload validation", 4, () => {
    const valid = [
      create("c", "I", "2026-08-14T08:00:00Z", "  Title  ", "api", "SEV-4"),
      event("o", "I", "2026-08-14T08:01:00Z", "owner_assigned", { owner: "Kim" }),
      event("s", "I", "2026-08-14T08:02:00Z", "severity_changed", { severity: "SEV-1" }),
      event("a", "I", "2026-08-14T08:03:00Z", "incident_acknowledged"),
      event("r", "I", "2026-08-14T08:04:00Z", "incident_resolved"),
      event("x", "I", "2026-08-14T08:05:00Z", "incident_reopened"),
      event("n", "I", "2026-08-14T08:06:00Z", "note_added", { text: "note" }),
    ];
    assert.equal(core.normalizeEvents(valid).validEvents.length, 7);
    const invalid = [
      create("c2", "I", "2026-08-14T08:00:00Z", "", "api", "SEV-2"),
      event("o2", "I", "2026-08-14T08:00:00Z", "owner_assigned", { owner: " " }),
      event("s2", "I", "2026-08-14T08:00:00Z", "severity_changed", { severity: "P0" }),
      event("n2", "I", "2026-08-14T08:00:00Z", "note_added", { text: 2 }),
      event("u2", "I", "2026-08-14T08:00:00Z", "incident_escalated", {}),
    ];
    assert.deepEqual(core.normalizeEvents(invalid).rejectedEvents.map((item) => item.reason), [
      "invalid_payload", "invalid_payload", "invalid_payload", "invalid_payload", "unsupported_type",
    ]);
  });

  scoreCheck(results, "normalize", "duplicate ownership and deterministic ordering", 4, () => {
    const raw = [
      event("same", "I", "bad", "incident_resolved"),
      event("z", "I", "2026-08-14T08:00:00Z", "incident_acknowledged"),
      event("same", "I", "2026-08-14T08:00:00Z", "incident_resolved"),
      event("a", "I", "2026-08-14T08:00:00Z", "incident_reopened"),
      event("same", "I", "2026-08-14T08:02:00Z", "incident_acknowledged"),
    ];
    const result = core.normalizeEvents(raw);
    assert.deepEqual(result.validEvents.map((item) => item.eventId), ["a", "same", "z"]);
    assert.deepEqual(result.rejectedEvents.map((item) => item.reason), ["invalid_timestamp", "duplicate_event_id"]);
  });

  scoreCheck(results, "normalize", "canonical output and input immutability", 3, () => {
    const raw = [create("e", "I", "2026-08-14T08:00:00Z", "Title", "svc", "SEV-2")];
    const before = clone(raw);
    const result = core.normalizeEvents(raw);
    assert.deepEqual(Object.keys(result.validEvents[0]).sort(), ["at", "atMs", "eventId", "incidentId", "payload", "type"]);
    assert.deepEqual(raw, before);
    assert.notEqual(result.validEvents[0], raw[0]);
  });

  scoreCheck(results, "reduce", "time cutoff, orphan handling, duplicate create and sort", 4, () => {
    const raw = [
      event("0", "ORPHAN", "2026-08-14T07:59:00Z", "owner_assigned", { owner: "Ghost" }),
      create("1", "Z-2", "2026-08-14T08:00:00Z", "Zulu", "edge", "SEV-2"),
      create("2", "A-1", "2026-08-14T08:01:00Z", "Alpha", "api", "SEV-3"),
      create("3", "A-1", "2026-08-14T08:02:00Z", "Overwrite", "bad", "SEV-1"),
      event("4", "Z-2", "2026-08-14T09:00:00Z", "incident_resolved"),
    ];
    const valid = core.normalizeEvents(raw).validEvents;
    const snapshot = core.reduceIncidentEvents(valid, Date.parse("2026-08-14T08:30:00Z"));
    assert.deepEqual(snapshot.map((item) => item.incidentId), ["A-1", "Z-2"]);
    assert.equal(snapshot[0].title, "Alpha");
    assert.equal(snapshot[1].status, "open");
  });

  scoreCheck(results, "reduce", "acknowledge, resolve and reopen lifecycle", 5, () => {
    const raw = [
      create("1", "I", "2026-08-14T08:00:00Z", "Lifecycle", "api", "SEV-1"),
      event("2", "I", "2026-08-14T08:05:00Z", "incident_acknowledged"),
      event("3", "I", "2026-08-14T08:10:00Z", "incident_resolved"),
      event("4", "I", "2026-08-14T08:15:00Z", "incident_acknowledged"),
      event("5", "I", "2026-08-14T08:20:00Z", "incident_reopened"),
      event("6", "I", "2026-08-14T08:25:00Z", "incident_resolved"),
    ];
    const [incident] = core.reduceIncidentEvents(core.normalizeEvents(raw).validEvents, Infinity);
    assert.equal(incident.status, "resolved");
    assert.equal(incident.acknowledgedAt, "2026-08-14T08:05:00Z");
    assert.equal(incident.resolvedAt, "2026-08-14T08:25:00Z");
    assert.equal(incident.updatedAt, "2026-08-14T08:25:00Z");
    const [reopened] = core.reduceIncidentEvents(core.normalizeEvents(raw).validEvents, Date.parse("2026-08-14T08:22:00Z"));
    assert.equal(reopened.status, "open");
    assert.equal(reopened.resolvedAt, null);
    assert.equal(reopened.acknowledgedAt, "2026-08-14T08:05:00Z");
  });

  scoreCheck(results, "reduce", "owner, severity, notes and canonical state", 4, () => {
    const raw = [
      create("1", "I", "2026-08-14T08:00:00Z", "Fields", "api", "SEV-3"),
      event("2", "I", "2026-08-14T08:03:00Z", "note_added", { text: "first" }),
      event("3", "I", "2026-08-14T08:04:00Z", "owner_assigned", { owner: "Jo" }),
      event("4", "I", "2026-08-14T08:05:00Z", "severity_changed", { severity: "SEV-1" }),
    ];
    const [incident] = core.reduceIncidentEvents(core.normalizeEvents(raw).validEvents, Infinity);
    assert.deepEqual(incident, {
      incidentId: "I", title: "Fields", service: "api", severity: "SEV-1", owner: "Jo", status: "open",
      createdAt: "2026-08-14T08:00:00Z", acknowledgedAt: null, resolvedAt: null,
      updatedAt: "2026-08-14T08:05:00Z", notes: [{ at: "2026-08-14T08:03:00Z", text: "first" }],
    });
  });

  scoreCheck(results, "reduce", "default Infinity and input immutability", 2, () => {
    const valid = core.normalizeEvents([
      create("1", "I", "2026-08-14T08:00:00Z", "Pure", "api", "SEV-2"),
      event("2", "I", "2026-08-14T08:05:00Z", "incident_resolved"),
    ]).validEvents;
    const before = clone(valid);
    assert.equal(core.reduceIncidentEvents(valid)[0].status, "resolved");
    assert.equal(core.reduceIncidentEvents(valid, Number.NaN)[0].status, "resolved");
    assert.deepEqual(valid, before);
  });

  scoreCheck(results, "filters", "case-insensitive search and AND/OR semantics", 4, () => {
    const incidents = [
      { incidentId: "I-1", title: "Card timeout", service: "Checkout", severity: "SEV-1", status: "open", owner: "Mina" },
      { incidentId: "I-2", title: "Card retries", service: "Checkout", severity: "SEV-2", status: "acknowledged", owner: "Omar" },
      { incidentId: "I-3", title: "Token expiry", service: "Identity", severity: "SEV-1", status: "open", owner: null },
    ];
    assert.deepEqual(core.applyFilters(incidents, {
      q: "miN", services: ["Checkout", "Identity"], severities: ["SEV-1"], statuses: ["open"],
    }).map((item) => item.incidentId), ["I-1"]);
    assert.deepEqual(core.applyFilters(incidents, { q: "i-3" }).map((item) => item.incidentId), ["I-3"]);
    assert.deepEqual(core.applyFilters(incidents, { severities: ["SEV-1", "SEV-2"] }).length, 3);
  });

  scoreCheck(results, "filters", "empty filters preserve order and input", 2, () => {
    const incidents = [{ incidentId: "Z" }, { incidentId: "A" }];
    const before = clone(incidents);
    assert.deepEqual(core.applyFilters(incidents), incidents);
    assert.deepEqual(core.applyFilters(incidents, { q: " ", services: [], statuses: [] }), incidents);
    assert.deepEqual(incidents, before);
  });

  scoreCheck(results, "metrics", "active, acknowledgement, MTTR and tie break", 4, () => {
    const incidents = [
      { severity: "SEV-1", status: "resolved", service: "zeta", acknowledgedAt: "2026-08-14T08:01:00Z", createdAt: "2026-08-14T08:00:00Z", resolvedAt: "2026-08-14T08:31:00Z" },
      { severity: "SEV-1", status: "open", service: "alpha", acknowledgedAt: null, createdAt: "2026-08-14T09:00:00Z", resolvedAt: null },
      { severity: "SEV-2", status: "resolved", service: "alpha", acknowledgedAt: "2026-08-14T09:05:00Z", createdAt: "2026-08-14T09:00:00Z", resolvedAt: "2026-08-14T10:00:00Z" },
    ];
    assert.deepEqual(core.calculateMetrics(incidents), {
      totalCount: 3, activeCount: 1, criticalActiveCount: 1, acknowledgementRatePct: 66.7,
      meanTimeToResolveMinutes: 45.5, topService: "alpha",
    });
  });

  scoreCheck(results, "metrics", "empty data and invalid MTTR interval", 3, () => {
    assert.deepEqual(core.calculateMetrics([]), {
      totalCount: 0, activeCount: 0, criticalActiveCount: 0, acknowledgementRatePct: 0,
      meanTimeToResolveMinutes: 0, topService: null,
    });
    const metrics = core.calculateMetrics([
      { severity: "SEV-3", status: "resolved", service: "svc", acknowledgedAt: null, createdAt: "bad", resolvedAt: "also-bad" },
    ]);
    assert.equal(metrics.meanTimeToResolveMinutes, 0);
  });

  scoreCheck(results, "build", "pipeline rejects bad data and scores filtered slice", 5, () => {
    const raw = [
      create("1", "I-1", "2026-08-14T08:00:00Z", "One", "api", "SEV-1"),
      event("2", "I-1", "2026-08-14T08:10:00Z", "incident_acknowledged"),
      event("3", "I-1", "2026-08-14T08:20:00Z", "incident_resolved"),
      create("4", "I-2", "2026-08-14T08:05:00Z", "Two", "edge", "SEV-2"),
      event("bad", "I-2", "not-a-time", "incident_resolved"),
    ];
    const dashboard = core.buildDashboard(raw, { services: ["api"] }, Date.parse("2026-08-14T08:15:00Z"));
    assert.deepEqual(dashboard.incidents.map((item) => item.incidentId), ["I-1"]);
    assert.equal(dashboard.incidents[0].status, "acknowledged");
    assert.deepEqual(dashboard.metrics, {
      totalCount: 1, activeCount: 1, criticalActiveCount: 1, acknowledgementRatePct: 100,
      meanTimeToResolveMinutes: 0, topService: "api",
    });
    assert.deepEqual(dashboard.rejectedEvents.map((item) => item.reason), ["invalid_timestamp"]);
  });
}

async function staticChecks(submissionDir, starterDir, results) {
  const required = ["index.html", "package.json", "README.md", "src/app.mjs", "src/core.mjs", "src/styles.css", "data/events.json", "tests/public.test.mjs"];
  await scoreAsyncCheck(results, "integrity", "required files exist", 1, async () => {
    const missing = [];
    for (const file of required) if (!(await exists(join(submissionDir, file)))) missing.push(file);
    assert.deepEqual(missing, [], `missing: ${missing.join(", ")}`);
  });

  await scoreAsyncCheck(results, "integrity", "package has no external dependencies", 1, async () => {
    const pkg = JSON.parse(await readFile(join(submissionDir, "package.json"), "utf8"));
    for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      assert.equal(Object.keys(pkg[key] ?? {}).length, 0, `${key} must stay empty`);
    }
  });

  await scoreAsyncCheck(results, "integrity", "provided dataset is unchanged", 2, async () => {
    assert.equal(await readFile(join(submissionDir, "data/events.json"), "utf8"), await readFile(join(starterDir, "data/events.json"), "utf8"));
  });

  await scoreAsyncCheck(results, "integrity", "public tests are unchanged", 1, async () => {
    assert.equal(await readFile(join(submissionDir, "tests/public.test.mjs"), "utf8"), await readFile(join(starterDir, "tests/public.test.mjs"), "utf8"));
  });

  const html = await textOrEmpty(join(submissionDir, "index.html"));
  const app = await textOrEmpty(join(submissionDir, "src/app.mjs"));
  const css = await textOrEmpty(join(submissionDir, "src/styles.css"));
  const readme = await textOrEmpty(join(submissionDir, "README.md"));
  const source = `${html}\n${app}`;

  scoreCheck(results, "wiring", "loads fixture and uses core pipeline", 2, () => {
    assert.match(app, /fetch\s*\(/);
    assert.match(app, /data\/events\.json/);
    assert.match(app, /buildDashboard|normalizeEvents/);
  });

  scoreCheck(results, "wiring", "URL query and browser history restoration", 1.5, () => {
    assert.match(app, /URLSearchParams/);
    assert.match(app, /pushState|replaceState/);
    assert.match(app, /popstate/);
  });

  scoreCheck(results, "wiring", "range replay and timed playback are wired", 1.5, () => {
    assert.match(source, /type\s*=\s*["']range["']|type=["']range["']/i);
    assert.match(app, /setInterval|setTimeout|requestAnimationFrame/);
    assert.match(app, /500/);
  });

  scoreCheck(results, "readiness", "controls expose accessible naming", 1.5, () => {
    assert.match(source, /<label|aria-label|aria-labelledby/i);
    assert.match(source, /<button/i);
  });

  scoreCheck(results, "readiness", "responsive and reduced-motion CSS", 1.5, () => {
    assert.match(css, /@media[^{}]*(max-width|width\s*[<:=])/i);
    assert.match(css, /prefers-reduced-motion/i);
  });

  scoreCheck(results, "readiness", "visible focus and flexible layout signals", 1, () => {
    assert.match(css, /:focus|:focus-visible/i);
    assert.match(css, /grid|flex|minmax|clamp/i);
  });

  scoreCheck(results, "readiness", "README records decisions, tests and limitations", 1, () => {
    assert.ok(readme.length >= 500, "README is too short");
    assert.match(readme, /test|測試/i);
    assert.match(readme, /limit|限制/i);
  });
}

function summarize(results) {
  const detailCategories = {};
  for (const check of results) {
    detailCategories[check.category] ??= { score: 0, max: 0 };
    detailCategories[check.category].score += check.earned;
    detailCategories[check.category].max += check.points;
  }
  const coreNames = new Set(["core", "normalize", "reduce", "filters", "metrics", "build"]);
  const aggregate = (predicate) => results.filter(predicate).reduce((value, check) => ({
    score: value.score + check.earned,
    max: value.max + check.points,
  }), { score: 0, max: 0 });
  const categories = {
    core_correctness: aggregate((check) => coreNames.has(check.category)),
    product_readiness: aggregate((check) => !coreNames.has(check.category)),
  };
  return {
    score: results.reduce((sum, check) => sum + check.earned, 0),
    max: results.reduce((sum, check) => sum + check.points, 0),
    categories,
    detailCategories,
    checks: results,
  };
}

export async function gradeSubmission(submissionDir, starterDir) {
  const results = [];
  let core = null;
  let importError = null;
  try {
    core = await import(`${pathToFileURL(join(submissionDir, "src/core.mjs")).href}?grade=${Date.now()}`);
  } catch (error) {
    importError = errorText(error);
  }

  if (core) {
    functionalChecks(core, results);
  } else {
    const functional = [
      ["core", "required ESM exports", 2],
      ["normalize", "shape, timestamp and validation precedence", 4],
      ["normalize", "supported event types and payload validation", 4],
      ["normalize", "duplicate ownership and deterministic ordering", 4],
      ["normalize", "canonical output and input immutability", 3],
      ["reduce", "time cutoff, orphan handling, duplicate create and sort", 4],
      ["reduce", "acknowledge, resolve and reopen lifecycle", 5],
      ["reduce", "owner, severity, notes and canonical state", 4],
      ["reduce", "default Infinity and input immutability", 2],
      ["filters", "case-insensitive search and AND/OR semantics", 4],
      ["filters", "empty filters preserve order and input", 2],
      ["metrics", "active, acknowledgement, MTTR and tie break", 4],
      ["metrics", "empty data and invalid MTTR interval", 3],
      ["build", "pipeline rejects bad data and scores filtered slice", 5],
    ];
    for (const [category, name, points] of functional) {
      results.push({ category, name, points, earned: 0, passed: false, detail: importError ?? "core import failed" });
    }
  }

  await staticChecks(submissionDir, starterDir, results);
  return summarize(results);
}

export function describeSubmissionPath(root, submissionDir) {
  return relative(root, submissionDir);
}
