import { cp, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const starter = join(root, "challenge", "starter");
const requested = process.argv[2];
const targets = requested === "both" ? ["model-a", "model-b"] : [requested];

if (!requested || targets.some((name) => !["model-a", "model-b"].includes(name))) {
  console.error("Usage: node scripts/prepare.mjs <model-a|model-b|both>");
  process.exitCode = 1;
} else {
  for (const name of targets) {
    const destination = join(root, "submissions", name);
    const entries = await readdir(destination);
    const material = entries.filter((entry) => entry !== ".gitkeep");
    if (material.length > 0) {
      throw new Error(`${name} is not empty; refusing to overwrite: ${material.join(", ")}`);
    }
    await rm(join(destination, ".gitkeep"), { force: true });
    await cp(starter, destination, { recursive: true, errorOnExist: true });
    console.log(`Prepared ${name}: ${destination}`);
  }
}
