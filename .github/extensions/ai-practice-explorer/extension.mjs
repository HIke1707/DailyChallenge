// Extension: ai-practice-explorer
// Canvas: display experiments.json as cards with filtering, stats, and in-place edits
// Persist changes back to artifacts/experiments.json (project-scoped artifact)

import { createServer } from "node:http";
import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const servers = new Map();

// Resolve artifact path relative to this file: <extension-dir>/artifacts/experiments.json
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT_DIR = path.join(__dirname, "artifacts");
const ARTIFACT_PATH = path.join(ARTIFACT_DIR, "experiments.json");

async function readExperiments() {
    try {
        const txt = await fs.readFile(ARTIFACT_PATH, "utf8");
        const data = JSON.parse(txt);
        if (!Array.isArray(data)) throw new Error("experiments.json must be an array");
        return data;
    } catch (err) {
        // Surface an actionable error via session.log if available later; throw CanvasError for action handlers
        throw new Error(`failed to read experiments artifact: ${err.message}`);
    }
}

async function writeExperiments(arr) {
    try {
        await fs.mkdir(ARTIFACT_DIR, { recursive: true });
        // Pretty-print for user readability
        await fs.writeFile(ARTIFACT_PATH, JSON.stringify(arr, null, 2), "utf8");
        return true;
    } catch (err) {
        throw new Error(`failed to write experiments artifact: ${err.message}`);
    }
}

function safeUpdateFields(target, patch) {
    const allowed = new Set(["date","title","type","score","hours","enjoyment","level","wouldRepeat","lesson"]);
    for (const key of Object.keys(patch)) {
        if (!allowed.has(key)) continue;
        target[key] = patch[key];
    }
}

function renderHtml(instanceId) {
    // Enhanced UI: grouped by type with horizontal rows, top mini-dashboard, and controls
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>AI Practice Explorer</title>
<style>
  :root{
    --bg:#fbf6f0; --card-bg:#fff; --card-border:#efe1d0; --accent:#d97706; --muted:#6b5b49; --soft:#f8efe6;
    --text:#2b2b2b; --radius:10px; --card-small-w:200px;
  }
  body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; margin:0;padding:18px;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}
  h1{font-size:18px;margin:0 0 8px;font-weight:700;color:var(--text)}
  .banner{display:none;padding:10px 14px;border-radius:8px;background:#fff4e6;border:1px solid #f5d9b8;color:#8a4b00;margin-bottom:10px}
  .controls{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px}
  .controls .left{display:flex;gap:10px;align-items:center}
  select,input[type=checkbox]{padding:6px;border-radius:8px;border:1px solid var(--card-border);background:transparent}
  .controls .right{display:flex;gap:8px;align-items:center}
  .mini-dashboard{display:flex;gap:10px;align-items:stretch;margin-bottom:12px}
  .mini-card{background:var(--card-bg);border:1px solid var(--card-border);padding:10px;border-radius:10px;min-width:120px}
  .mini-card h3{margin:0;font-size:13px}
  .mini-card p{margin:6px 0 0;font-size:13px;color:var(--muted)}
  .group-row{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
  .group-row .row-title{font-weight:700;color:var(--muted);display:flex;justify-content:space-between;align-items:center}
  .row-scroll{display:flex;gap:10px;overflow-x:auto;padding:8px 0}
  .card{width:var(--card-small-w);background:var(--card-bg);border:1px solid var(--card-border);padding:10px;border-radius:12px;box-shadow:0 6px 18px rgba(43,43,43,0.04);flex:0 0 auto}
  .card h4{margin:0;font-size:13px}
  .meta{font-size:11px;color:var(--muted);margin-top:6px}
  .fields{display:flex;flex-direction:column;gap:6px;margin-top:8px}
  label{font-size:12px;color:var(--muted);display:flex;justify-content:space-between;align-items:center}
  input[type="number"], input[type="text"]{padding:6px;border-radius:8px;border:1px solid #efe6dd;min-width:68px;font-size:12px;text-align:right}
  .save{margin-top:8px;text-align:right}
  button.save-btn{background:var(--accent);color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px}
  .lesson{margin-top:6px;font-size:12px;color:var(--muted)}
</style>
</head>
<body>
<h1>AI Practice Explorer</h1>
<div id="errorBanner" class="banner" role="alert"><span class="msg"></span> <button id="dismissBanner" style="float:right;background:none;border:none;color:var(--muted);cursor:pointer">✕</button></div>
<div class="controls">
  <div class="left">
    Type: <select id="typeFilter"><option value="">(all)</option></select>
    <label style="display:flex;align-items:center;gap:6px;margin-left:6px"><input type="checkbox" id="repeatOnly"> Only Would Repeat</label>
  </div>
  <div class="right">
    Sort: <select id="sortSelect"><option value="date">Date</option><option value="score">Avg Score</option><option value="enjoyment">Avg Enjoy</option><option value="hours">Total Hours</option></select>
    <button id="addBtn" style="margin-left:8px;padding:6px 10px;border-radius:8px;border:none;background:var(--accent);color:#fff;cursor:pointer">＋ Add</button>
  </div>
</div>
<div class="mini-dashboard" id="miniDashboard"></div>
<div id="groups"></div>
<script src="/assets/app.js"></script>
</body>
</html>`;
}


async function startServer(instanceId) {
    const server = createServer(async (req, res) => {
        try {
            const base = new URL(req.url, `http://127.0.0.1`);
            // Routes:
            // GET / -> UI
            // GET /api/experiments -> list
            // POST /api/experiments/:id -> patch existing record
            // GET /api/stats -> simple stats
            if (base.pathname === "/") {
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(renderHtml(instanceId));
                return;
            }

            // Serve static assets from the extension's assets/ folder (e.g., /assets/app.js)
            if (base.pathname.startsWith("/assets/")) {
                const rel = base.pathname.replace(/^\/assets\//, "");
                const fp = path.join(__dirname, 'assets', rel);
                try {
                    const buf = await fs.readFile(fp);
                    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
                    res.end(buf);
                    return;
                } catch (e) {
                    res.statusCode = 404; res.end('not found'); return;
                }
            }

            if (base.pathname === "/api/experiments" && req.method === "GET") {
                const arr = await readExperiments();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(arr));
                return;
            }

            // Create new experiment: POST /api/experiments with JSON body
            if (base.pathname === "/api/experiments" && req.method === "POST") {
                const body = await new Promise((resolve, reject) => {
                    let b = "";
                    req.on('data', c => b += c.toString());
                    req.on('end', () => resolve(b));
                    req.on('error', reject);
                });
                const rec = JSON.parse(body || '{}');
                if (!rec.id) {
                    // generate id
                    const slug = (rec.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    rec.id = `${(rec.date || new Date().toISOString().slice(0,10)).replace(/-/g,'')}-${slug}`;
                }
                const arr = await readExperiments();
                if (arr.find(x => x.id === rec.id)) {
                    res.statusCode = 409; res.end(JSON.stringify({ error: 'exists' })); return;
                }
                // enforce schema defaults
                rec.score = rec.score || 0;
                rec.hours = rec.hours || 0;
                rec.enjoyment = rec.enjoyment || 0;
                rec.level = rec.level || 1;
                rec.wouldRepeat = !!rec.wouldRepeat;
                arr.push(rec);
                await writeExperiments(arr);
                res.statusCode = 201;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(rec));
                return;
            }

            if (base.pathname.startsWith("/api/experiments/") && req.method === "POST") {
                const id = decodeURIComponent(base.pathname.replace("/api/experiments/", ""));
                const body = await new Promise((resolve, reject) => {
                    let b = "";
                    req.on('data', c => b += c.toString());
                    req.on('end', () => resolve(b));
                    req.on('error', reject);
                });
                const patch = JSON.parse(body || '{}');
                const arr = await readExperiments();
                const idx = arr.findIndex(x => x.id === id);
                if (idx === -1) {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'not_found' }));
                    return;
                }
                // Only update allowed fields, do not create new records
                safeUpdateFields(arr[idx], patch);
                await writeExperiments(arr);
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(arr[idx]));
                return;
            }

            if (base.pathname === "/api/stats" && req.method === "GET") {
                const arr = await readExperiments();
                const count = arr.length;
                const totalHours = arr.reduce((s,x)=>s+(Number(x.hours)||0),0);
                const avgScore = count? (arr.reduce((s,x)=>s+(Number(x.score)||0),0)/count):0;
                const types = {};
                for(const a of arr){ types[a.type] = (types[a.type]||0)+1 }
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ count, totalHours, avgScore, types }));
                return;
            }

            // unknown
            res.statusCode = 404; res.end('not found');
        } catch (err) {
            // session.log is not available in this lexical scope; fallback to header
            res.statusCode = 500; res.setHeader('Content-Type','application/json');
            res.end(JSON.stringify({ error: err.message }));
        }
    });

    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/` };
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "ai-practice-explorer",
            displayName: "AI Practice Explorer",
            description: "Browse and edit recorded experiments (no external network).",
            actions: [
                {
                    name: "refresh",
                    description: "Reload the experiments artifact from disk",
                    handler: async (ctx) => {
                        // return simple confirmation; UI reads /api/experiments directly
                        try {
                            await readExperiments();
                            return { ok: true };
                        } catch (err) {
                            throw new CanvasError("read_failed", err.message);
                        }
                    }
                }
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(ctx.instanceId);
                    servers.set(ctx.instanceId, entry);
                }
                return { title: "AI Practice Explorer", url: entry.url };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((r) => entry.server.close(() => r()));
                }
            }
        })
    ]
});
