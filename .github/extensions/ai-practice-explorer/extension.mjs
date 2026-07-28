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
  </div>
</div>
<div class="mini-dashboard" id="miniDashboard"></div>
<div id="groups"></div>
<script>
function showError(msg){ const b = document.getElementById('errorBanner'); b.style.display='block'; b.querySelector('.msg').textContent = msg; }
function hideError(){ document.getElementById('errorBanner').style.display='none'; }
document.getElementById('dismissBanner').addEventListener('click', hideError);

async function fetchJson(path, opts){
  try{ const res = await fetch(path, opts); if(!res.ok){ const body = await res.text(); throw new Error(body || res.statusText); } return res.json(); }
  catch(err){ showError('載入資料失敗：' + (err.message||err)); throw err; }
}

let experiments = [];

function groupByType(items){ const map = new Map(); for(const it of items){ const t = it.type||'unknown'; if(!map.has(t)) map.set(t,[]); map.get(t).push(it); } return map; }

function statsForGroup(arr){ const count = arr.length; const totalHours = arr.reduce((s,x)=>s+(Number(x.hours)||0),0); const avgScore = count? (arr.reduce((s,x)=>s+(Number(x.score)||0),0)/count):0; const avgEnjoy = count? (arr.reduce((s,x)=>s+(Number(x.enjoyment)||0),0)/count):0; return {count,totalHours,avgScore,avgEnjoy}; }

function computeSuggestion(groupStats){ // prefer types with high avgEnjoy but lower exposure
  const scores = Array.from(groupStats.entries()).map(([type,st])=>({type,score:st.avgEnjoy - (st.count/10)}));
  scores.sort((a,b)=>b.score - a.score);
  return scores.length? scores[0].type : null;
}

function renderMiniDashboard(groupStats){ const el = document.getElementById('miniDashboard'); el.innerHTML=''; for(const [type,st] of groupStats.entries()){ const d = document.createElement('div'); d.className='mini-card'; d.innerHTML = `<h3>${escapeHtml(type)}</h3><p>Avg Enjoy: ${st.avgEnjoy.toFixed(2)} • Avg Score: ${st.avgScore.toFixed(2)}</p>`; el.appendChild(d); } const suggestion = computeSuggestion(groupStats); if(suggestion){ const s = document.createElement('div'); s.className='mini-card'; s.innerHTML=`<h3>Suggested</h3><p>Try: <strong>${escapeHtml(suggestion)}</strong></p>`; el.insertBefore(s, el.firstChild); } }

function renderGroups(filteredTypes, repeatOnly, sortKey){ const groups = groupByType(experiments); const groupStats = new Map(); for(const [type,arr] of groups.entries()) groupStats.set(type, statsForGroup(arr));
  renderMiniDashboard(groupStats);
  // prepare ordering
  let entries = Array.from(groups.entries()).filter(([t])=> !filteredTypes.size || filteredTypes.has(t));
  // apply repeatOnly filter
  if(repeatOnly) entries = entries.map(([t,arr])=>[t,arr.filter(x=>x.wouldRepeat)]).filter(([t,arr])=>arr.length>0);
  // compute stats for ordering
  entries = entries.map(([t,arr])=>[t,arr,statsForGroup(arr)]);
  // sort
  entries.sort((a,b)=>{
    const aSt = a[2], bSt = b[2];
    if(sortKey==='score') return bSt.avgScore - aSt.avgScore;
    if(sortKey==='enjoyment') return bSt.avgEnjoy - aSt.avgEnjoy;
    if(sortKey==='hours') return bSt.totalHours - aSt.totalHours;
    // default date: newest first by max date in group
    const ad = Math.max(...a[1].map(x=>new Date(x.date).getTime()));
    const bd = Math.max(...b[1].map(x=>new Date(x.date).getTime()));
    return bd - ad;
  });

  const container = document.getElementById('groups'); container.innerHTML='';
  for(const [type,arr,st] of entries){
    const g = document.createElement('div'); g.className='group-row';
    const header = document.createElement('div'); header.className='row-title'; header.innerHTML = `<div>${escapeHtml(type)} (${st.count})</div><div style="font-size:12px;color:var(--muted)">AvgE:${st.avgEnjoy.toFixed(2)} • AvgS:${st.avgScore.toFixed(2)}</div>`;
    const row = document.createElement('div'); row.className='row-scroll';
    // sort items in row by date desc
    arr.sort((a,b)=> new Date(b.date)-new Date(a.date));
    for(const e of arr){ const card = document.createElement('div'); card.className='card'; card.innerHTML = `<h4>${escapeHtml(e.title)}</h4><div class="meta">${escapeHtml(e.date)}</div><div class="fields">`+
        `<label>Score<input type="number" step="1" id="score-${e.id}" value="${Number(e.score)||0}"></label>`+
        `<label>Hours<input type="number" step="0.1" id="hours-${e.id}" value="${Number(e.hours)||0}"></label>`+
        `<label>Enjoy<input type="number" min="1" max="5" id="enjoy-${e.id}" value="${Number(e.enjoyment)||0}"></label>`+
        `</div><div class="lesson">${escapeHtml(e.lesson||'')}</div><div class="save"><button class="save-btn" data-id="${e.id}">Save</button></div>`;
      row.appendChild(card);
    }
    g.appendChild(header); g.appendChild(row); container.appendChild(g);
  }
  // attach save handlers
  container.querySelectorAll('button[data-id]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-id');
      const patch = {
        score: Number(document.getElementById('score-' + id).value||0),
        hours: Number(document.getElementById('hours-' + id).value||0),
        enjoyment: Number(document.getElementById('enjoy-' + id).value||0),
        level: Number(document.getElementById('level-' + id)?.value||0),
        wouldRepeat: document.getElementById('repeat-' + id)?.checked || false
      };
      btn.disabled=true; btn.textContent='Saving...';
      try{ await fetchJson('/api/experiments/' + encodeURIComponent(id), { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(patch) }); hideError(); await loadAndRender(); }
      catch(err){ /* banner shown by fetchJson */ }
      finally{ btn.disabled=false; btn.textContent='Save'; }
    });
  });
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function loadAndRender(){
  try{ experiments = await fetchJson('/api/experiments'); } catch(err){ return; }
  // build type filter options
  const types = Array.from(new Set(experiments.map(e=>e.type).filter(Boolean))).sort();
  const sel = document.getElementById('typeFilter'); const cur = sel.value; sel.innerHTML = '<option value="">(all)</option>'; types.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; sel.appendChild(o); }); if(cur) sel.value=cur;
  // controls
  const repeatOnly = document.getElementById('repeatOnly').checked;
  const sortKey = document.getElementById('sortSelect').value;
  const filteredTypes = new Set(); if(document.getElementById('typeFilter').value) filteredTypes.add(document.getElementById('typeFilter').value);
  renderGroups(filteredTypes, repeatOnly, sortKey);
}

document.getElementById('typeFilter').addEventListener('change', ()=>loadAndRender());
document.getElementById('repeatOnly').addEventListener('change', ()=>loadAndRender());
document.getElementById('sortSelect').addEventListener('change', ()=>loadAndRender());

loadAndRender();
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
