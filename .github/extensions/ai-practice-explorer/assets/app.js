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

function computeSuggestion(groupStats){
  const now = Date.now();
  const LIST = [];
  for(const [type,st] of groupStats.entries()){
    if(st.count === 0){ LIST.push({type,score: 999}); continue; }
    const daysSince = st.lastDate ? Math.max(0, (now - st.lastDate) / (1000*60*60*24)) : 30;
    const recencyFactor = Math.min(1, daysSince/30);
    const score = (st.avgEnjoy || 0) * 1.2 + recencyFactor * 1.8 - (st.count * 0.25);
    LIST.push({type,score});
  }
  LIST.sort((a,b)=>b.score - a.score);
  return LIST.length? LIST[0].type : null;
}

function renderMiniDashboard(groupStats){
  const el = document.getElementById('miniDashboard'); el.innerHTML='';
  for(const [type,st] of groupStats.entries()){
    const card = document.createElement('div'); card.className='mini-card';
    const scorePct = Math.max(0,Math.min(100, (st.avgScore||0)))/100;
    const enjoyPct = Math.max(0,Math.min(5, (st.avgEnjoy||0)))/5;
    card.innerHTML = '<h3>' + escapeHtml(type) + '</h3>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:6px">' +
      '<svg width="48" height="48" viewBox="0 0 36 36">' +
      '<path d="M18 2a16 16 0 1 1 0 32 16 16 0 1 1 0-32" fill="#f6f0ea" stroke="#efe1d0" stroke-width="2"></path>' +
      '<path d="M18 2a16 16 0 1 1 0 32 16 16 0 1 1 0-32" fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="' + (scorePct*100) + ' 100" transform="rotate(-90 18 18)"></path>' +
      '</svg><div style="font-size:12px;color:var(--muted)">S:' + ((st.avgScore||0).toFixed(1)) + '<br>E:' + ((st.avgEnjoy||0).toFixed(2)) + '</div></div>';
    el.appendChild(card);
  }
  const suggestion = computeSuggestion(groupStats);
  if(suggestion){ const s = document.createElement('div'); s.className='mini-card'; s.innerHTML = '<h3>Suggested</h3><p style="margin-top:6px">Try: <strong>' + escapeHtml(suggestion) + '</strong></p>'; el.insertBefore(s, el.firstChild); }
}

function openModal(html){
  let m = document.getElementById('modal');
  if(!m){ m = document.createElement('div'); m.id='modal'; m.style.position='fixed'; m.style.left=0; m.style.top=0; m.style.right=0; m.style.bottom=0; m.style.background='rgba(0,0,0,0.3)'; m.style.display='flex'; m.style.alignItems='center'; m.style.justifyContent='center'; m.innerHTML = '<div id="modalInner" style="background:var(--card-bg);padding:14px;border-radius:12px;max-width:900px;max-height:80vh;overflow:auto;"></div>'; document.body.appendChild(m); }
  document.getElementById('modalInner').innerHTML = html + '<div style="text-align:right;margin-top:8px"><button id="closeModal" style="padding:6px 10px;border-radius:8px;background:#eee;border:none;">Close</button></div>';
  document.getElementById('closeModal').onclick = ()=>{ m.remove(); };
}

function renderGroups(filteredTypes, repeatOnly, sortKey){
  const groups = groupByType(experiments);
  const groupStats = new Map();
  for(const [type,arr] of groups.entries()){
    const st = statsForGroup(arr);
    st.lastDate = arr.reduce((mx,x)=> Math.max(mx, new Date(x.date).getTime()), 0);
    groupStats.set(type, st);
  }
  renderMiniDashboard(groupStats);
  let entries = Array.from(groups.entries()).filter(([t])=> !filteredTypes.size || filteredTypes.has(t));
  if(repeatOnly) entries = entries.map(([t,arr])=>[t,arr.filter(x=>x.wouldRepeat)]).filter(([t,arr])=>arr.length>0);
  entries = entries.map(([t,arr])=>[t,arr,statsForGroup(arr)]);
  entries.sort((a,b)=>{
    const aSt = a[2], bSt = b[2];
    if(sortKey==='score') return bSt.avgScore - aSt.avgScore;
    if(sortKey==='enjoyment') return bSt.avgEnjoy - aSt.avgEnjoy;
    if(sortKey==='hours') return bSt.totalHours - aSt.totalHours;
    const ad = Math.max(...a[1].map(x=>new Date(x.date).getTime()));
    const bd = Math.max(...b[1].map(x=>new Date(x.date).getTime()));
    return bd - ad;
  });

  const container = document.getElementById('groups'); container.innerHTML='';
  for(const [type,arr,st] of entries){
    const g = document.createElement('div'); g.className='group-row';
    const header = document.createElement('div'); header.className='row-title'; header.innerHTML = '<div>' + escapeHtml(type) + ' (' + st.count + ')</div><div style="font-size:12px;color:var(--muted)">AvgE:' + st.avgEnjoy.toFixed(2) + ' • AvgS:' + st.avgScore.toFixed(2) + '</div>';
    const viewAllBtn = document.createElement('button'); viewAllBtn.textContent='View all'; viewAllBtn.style.marginLeft='8px'; viewAllBtn.style.padding='6px 8px'; viewAllBtn.style.borderRadius='8px'; viewAllBtn.style.border='1px solid #eee'; viewAllBtn.onclick = ()=>{
      const pageSize = 10; let page = 0; const items = arr.slice().sort((a,b)=> new Date(b.date)-new Date(a.date));
      function renderPage(){ const start = page*pageSize; const slice = items.slice(start,start+pageSize); const rows = slice.map(it=>'<div style="padding:8px;border-bottom:1px solid #f2eee6"><strong>' + escapeHtml(it.title) + '</strong> <span style="color:var(--muted);font-size:12px">' + escapeHtml(it.date) + '</span><div style="font-size:13px;color:var(--muted)">Score:' + it.score + ' Enjoy:' + it.enjoyment + ' Hours:' + it.hours + '</div></div>').join(''); const controls = '<div style="display:flex;justify-content:space-between;margin-top:8px"><button id="prevPage" ' + (page===0?'disabled':'') + '>Prev</button><div>Page ' + (page+1) + ' / ' + Math.ceil(items.length/pageSize) + '</div><button id="nextPage" ' + (start+pageSize>=items.length?'disabled':'') + '>Next</button></div>'; openModal('<h3>' + escapeHtml(type) + ' — all (' + items.length + ')</h3>' + rows + controls); document.getElementById('prevPage').onclick = ()=>{ page = Math.max(0,page-1); renderPage(); }; document.getElementById('nextPage').onclick = ()=>{ page = Math.min(Math.ceil(items.length/pageSize)-1,page+1); renderPage(); }; }
    };
    header.appendChild(viewAllBtn);
    const row = document.createElement('div'); row.className='row-scroll';
    arr.sort((a,b)=> new Date(b.date)-new Date(a.date));
    for(const e of arr){ const card = document.createElement('div'); card.className='card'; card.innerHTML = '<h4>' + escapeHtml(e.title) + '</h4><div class="meta">' + escapeHtml(e.date) + '</div><div class="fields">' +
        '<label>Score<input type="number" step="1" id="score-' + e.id + '" value="' + (Number(e.score)||0) + '"></label>' +
        '<label>Hours<input type="number" step="0.1" id="hours-' + e.id + '" value="' + (Number(e.hours)||0) + '"></label>' +
        '<label>Enjoy<input type="number" min="1" max="5" id="enjoy-' + e.id + '" value="' + (Number(e.enjoyment)||0) + '"></label>' +
        '</div><div class="lesson">' + escapeHtml(e.lesson||'') + '</div><div class="save"><button class="save-btn" data-id="' + e.id + '">Save</button></div>';
      row.appendChild(card);
    }
    g.appendChild(header); g.appendChild(row); container.appendChild(g);
  }
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
      catch(err){ }
      finally{ btn.disabled=false; btn.textContent='Save'; }
    });
  });
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function loadAndRender(){
  try{ experiments = await fetchJson('/api/experiments'); } catch(err){ return; }
  const types = Array.from(new Set(experiments.map(e=>e.type).filter(Boolean))).sort();
  const sel = document.getElementById('typeFilter'); const cur = sel.value; sel.innerHTML = '<option value="">(all)</option>'; types.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; sel.appendChild(o); }); if(cur) sel.value=cur;
  const repeatOnly = document.getElementById('repeatOnly').checked;
  const sortKey = document.getElementById('sortSelect').value;
  const filteredTypes = new Set(); if(document.getElementById('typeFilter').value) filteredTypes.add(document.getElementById('typeFilter').value);
  renderGroups(filteredTypes, repeatOnly, sortKey);
}

document.getElementById('typeFilter').addEventListener('change', ()=>loadAndRender());
document.getElementById('repeatOnly').addEventListener('change', ()=>loadAndRender());
document.getElementById('sortSelect').addEventListener('change', ()=>loadAndRender());

const addBtn = document.getElementById('addBtn');
if(addBtn){
  addBtn.addEventListener('click', ()=>{
    const types = Array.from(new Set(experiments.map(e=>e.type).filter(Boolean))).sort();
    const typeOptions = ['<option value="">(select)</option>'].concat(types.map(t=>'<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>')).join('');
    const form = '\n      <h3>Add Experiment</h3>\n      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">\n        <label>Title<input id="new_title" type="text"></label>\n        <label>Date<input id="new_date" type="date" value="' + new Date().toISOString().slice(0,10) + '"></label>\n        <label>Type<select id="new_type">' + typeOptions + '</select></label>\n        <label>Score<input id="new_score" type="number" value="0"></label>\n        <label>Hours<input id="new_hours" type="number" step="0.1" value="0"></label>\n        <label>Enjoy<input id="new_enjoy" type="number" min="1" max="5" value="3"></label>\n        <label>Level<input id="new_level" type="number" min="1" max="3" value="1"></label>\n        <label style="grid-column:1/-1">Lesson<input id="new_lesson" type="text"></label>\n        <label style="display:flex;align-items:center;gap:8px"><input id="new_repeat" type="checkbox"> Would Repeat</label>\n      </div>\n      <div style="text-align:right;margin-top:8px"><button id="submitAdd" style="padding:6px 10px;border-radius:8px;background:var(--accent);color:#fff;border:none">Create</button></div>\n    ';
    openModal(form);
    document.getElementById('submitAdd').onclick = async ()=>{
      const rec = {
        title: document.getElementById('new_title').value,
        date: document.getElementById('new_date').value,
        type: document.getElementById('new_type').value || 'misc',
        score: Number(document.getElementById('new_score').value||0),
        hours: Number(document.getElementById('new_hours').value||0),
        enjoyment: Number(document.getElementById('new_enjoy').value||0),
        level: Number(document.getElementById('new_level').value||1),
        wouldRepeat: !!document.getElementById('new_repeat').checked,
        lesson: document.getElementById('new_lesson').value || ''
      };
      try{
        const created = await fetchJson('/api/experiments', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(rec) });
        hideError();
        const m = document.getElementById('modal'); if(m) m.remove();
        await loadAndRender();
      }catch(err){ }
    };
  });
}

loadAndRender();
