import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gradeSubmission } from "../evaluation/grader.mjs";
import { buildComparison, normalizeManualReview, renderMarkdown } from "../evaluation/report.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const submissionsDir = join(root, "submissions");
const starterDir = join(root, "challenge", "starter");
const reportsDir = join(root, "reports");
const manualFile = join(root, "evaluation", "manual-review.json");

async function readManualReview() {
  try {
    return JSON.parse(await readFile(manualFile, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw new Error(`Cannot parse evaluation/manual-review.json: ${error.message}`);
  }
}

async function isSubmitted(name) {
  try {
    await readFile(join(submissionsDir, name, "package.json"));
    const core = await readFile(join(submissionsDir, name, "src", "core.mjs"), "utf8");
    const app = await readFile(join(submissionsDir, name, "src", "app.mjs"), "utf8");
    return !core.includes("TODO: normalizeEvents") && !app.includes("Starter ready");
  } catch {
    return false;
  }
}

const manualInput = await readManualReview();
const submissions = {};

for (const name of ["model-a", "model-b"]) {
  if (!(await isSubmitted(name))) {
    submissions[name] = {
      status: "not_submitted",
      automated: null,
      manual: normalizeManualReview(null),
      total: { status: "pending", score: null, max: 100 },
    };
    continue;
  }

  console.log(`Grading ${name}...`);
  const automated = await gradeSubmission(join(submissionsDir, name), starterDir);
  const manual = normalizeManualReview(manualInput[name]);
  submissions[name] = {
    status: "graded",
    automated,
    manual,
    total: {
      status: manual.status === "complete" ? "complete" : "pending",
      score: manual.status === "complete" ? automated.score + manual.score : null,
      max: 100,
    },
  };
}

const payload = {
  schemaVersion: 1,
  rubricVersion: "2026-08-14.1",
  generatedAt: new Date().toISOString(),
  submissions,
};
payload.comparison = buildComparison(submissions);

await mkdir(reportsDir, { recursive: true });
await writeFile(join(reportsDir, "automated-results.json"), `${JSON.stringify(payload, null, 2)}\n`);
await writeFile(join(reportsDir, "comparison-report.md"), renderMarkdown(payload));

console.log(`Wrote ${join(reportsDir, "automated-results.json")}`);
console.log(`Wrote ${join(reportsDir, "comparison-report.md")}`);
for (const [name, result] of Object.entries(submissions)) {
  console.log(`${name}: ${result.status === "graded" ? `${result.automated.score}/65 automated` : "not submitted"}`);
}
