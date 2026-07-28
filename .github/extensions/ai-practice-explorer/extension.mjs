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
    // Simple single-file UI: fetch experiments, render cards, filter by type, show stats, and allow editing existing records.
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>AI Practice Explorer</title>
<style>
  body{font-family:var(--font-sans,system-ui);margin:0;padding:16px;background:var(--background-color-default,#fff);color:var(--text-color-default,#111)}
  .controls{display:flex;gap:1rem;align-items:center;margin-bottom:1rem}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
  .card{border:1px solid var(--border-color-default,#ddd);padding:12px;border-radius:8px;background:var(--color-white,#fff)}
  .stat{display:inline-block;margin-right:12px}
  label{display:block;font-size:12px;color:var(--text-color-muted,#666)}
  input[type="number"]{width:6rem}
  .save{margin-top:8px}
</style>
</head>
<body>
<h1>AI Practice Explorer</h1>
<div class="controls">
  <div>Filter: <select id="typeFilter"><option value="">(all)</option></select></div>
  <div id="stats"></div>
</div>
<div id="cards" class="cards"></div>
<script>
async function fetchJson(path, opts){
  const res = await fetch(path, opts);
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

let experiments = [];
let types = new Set();

function renderStats() {
  const stats = {count: experiments.length, totalHours:0, avgScore:0, avgEnjoy:0};
  let scoreSum=0, enjoySum=0;
  for(const e of experiments){ stats.totalHours += Number(e.hours||0); scoreSum += Number(e.score||0); enjoySum += Number(e.enjoyment||0); }
  stats.avgScore = experiments.length? (scoreSum/experiments.length).toFixed(2):"-";
  stats.avgEnjoy = experiments.length? (enjoySum/experiments.length).toFixed(2):"-";
  document.getElementById('stats').innerHTML = '<span class="stat">Count: ' + stats.count + '</span><span class="stat">Total hours: ' + stats.totalHours.toFixed(1) + '</span><span class="stat">Avg score: ' + stats.avgScore + '</span><span class="stat">Avg enjoyment: ' + stats.avgEnjoy + '</span>';
}

function renderCards() {
  const container = document.getElementById('cards');
  container.innerHTML = '';
  const filter = document.getElementById('typeFilter').value;
  const list = experiments.filter(e => !filter || e.type === filter);
  for(const e of list){
    const div = document.createElement('div'); div.className='card';
    div.innerHTML = '<strong>' + escapeHtml(e.title) + '</strong><div style="font-size:12px;color:#666">' + escapeHtml(e.type) + ' • ' + escapeHtml(e.date) + '</div><div style="margin-top:6px"><label>Score: <input type="number" step="1" id="score-' + e.id + '" value="' + (Number(e.score)||0) + '"></label><label>Hours: <input type="number" step="0.1" id="hours-' + e.id + '" value="' + (Number(e.hours)||0) + '"></label><label>Enjoyment: <input type="number" min="1" max="5" id="enjoy-' + e.id + '" value="' + (Number(e.enjoyment)||0) + '"></label><label>Level: <input type="number" min="1" max="3" id="level-' + e.id + '" value="' + (Number(e.level)||0) + '"></label><label><input type="checkbox" id="repeat-' + e.id + '" ' + (e.wouldRepeat? 'checked':'') + '> Would Repeat</label></div><div style="margin-top:6px"><em>' + escapeHtml(e.lesson||'') + '</em></div><div class="save"><button data-id="' + e.id + '">Save</button></div>';
    container.appendChild(div);
  }
  // attach save handlers
  container.querySelectorAll('button[data-id]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-id');
      const patch = {
        score: Number(document.getElementById('score-' + id).value||0),
        hours: Number(document.getElementById('hours-' + id).value||0),
        enjoyment: Number(document.getElementById('enjoy-' + id).value||0),
        level: Number(document.getElementById('level-' + id).value||0),
        wouldRepeat: document.getElementById('repeat-' + id).checked
      };
      btn.disabled = true; btn.textContent='Saving...';
      try{
        await fetchJson('/api/experiments/' + encodeURIComponent(id), { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(patch) });
        await loadAndRender();
      }catch(err){
        alert('Save failed: '+err.message);
      }finally{btn.disabled=false;btn.textContent='Save'}
    });
  });
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function loadAndRender(){
  experiments = await fetchJson('/api/experiments');
  // populate types
  types = new Set(experiments.map(e=>e.type).filter(Boolean));
  const sel = document.getElementById('typeFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="">(all)</option>';
  [...types].sort().forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; sel.appendChild(o); });
  if(current) sel.value=current;
  renderStats();
  renderCards();
}

document.getElementById('typeFilter').addEventListener('change', ()=>{ renderCards(); });

loadAndRender().catch(err=>document.body.appendChild(Object.assign(document.createElement('pre'),{textContent:err.stack||err}))); 
</script>
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

            if (base.pathname === "/api/experiments" && req.method === "GET") {
                const arr = await readExperiments();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(arr));
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
