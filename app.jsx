const { useState, useRef, useCallback, useEffect } = React;

/* ═══════════════════════════════════════════════════════════════
   MIND OS
   Data: goals[], nodes[], dumps[]
   node: { id, parentId, goalId, title, done, note, ts, updatedAt }
═══════════════════════════════════════════════════════════════ */
const KEY   = "mindos_v3";
const EMPTY = { goals:[], nodes:[], dumps:[] };
const load  = () => { try { return {...EMPTY,...JSON.parse(localStorage.getItem(KEY))}; } catch { return EMPTY; } };
const save  = d  => localStorage.setItem(KEY, JSON.stringify(d));
const uid   = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);

const ch    = (ns,id) => ns.filter(n=>n.parentId===id);
const desc  = (ns,id) => { const r=[],s=[id]; while(s.length){const c=s.pop();const x=ns.filter(n=>n.parentId===c);r.push(...x);s.push(...x.map(n=>n.id));} return r; };
const ancs  = (ns,id) => { const p=[];let c=ns.find(n=>n.id===id);while(c?.parentId){c=ns.find(n=>n.id===c.parentId);if(c)p.unshift(c);}return p; };
const pct   = (ns,gid) => { const l=ns.filter(n=>n.goalId===gid&&ch(ns,n.id).length===0&&n.parentId); if(!l.length)return 0; return Math.round(l.filter(n=>n.done).length/l.length*100); };
const hlth  = (ns,gid) => { const gn=ns.filter(n=>n.goalId===gid); if(!gn.length)return{e:"❄️",l:"Dormant",c:"#64748b",bg:"#f1f5f9",d:null}; const lat=Math.max(...gn.map(n=>n.updatedAt||n.ts||0)); const d=Math.floor((Date.now()-lat)/86400000); if(d<=7)return{e:"🔥",l:"Active",c:"#92400e",bg:"#fef3c7",d}; if(d<=30)return{e:"⚠️",l:"Cooling",c:"#9a3412",bg:"#ffedd5",d}; return{e:"❄️",l:"Dormant",c:"#64748b",bg:"#f1f5f9",d}; };
const dAgo  = d => d===null?"Never":d===0?"Today":d===1?"Yesterday":`${d}d ago`;

const moveNode=(nodes,id,dir)=>{
  const node=nodes.find(n=>n.id===id);if(!node)return nodes;
  const sibs=nodes.filter(n=>n.parentId===node.parentId&&n.goalId===node.goalId);
  const idx=sibs.findIndex(n=>n.id===id);
  const swapIdx=idx+dir;
  if(swapIdx<0||swapIdx>=sibs.length)return nodes;
  const swap=sibs[swapIdx];
  // swap ts to reorder (we sort by ts)
  const tsA=node.ts,tsB=swap.ts;
  return nodes.map(n=>n.id===id?{...n,ts:tsB}:n.id===swap.id?{...n,ts:tsA}:n);
};

const dueFmt=due=>{
  if(!due)return null;
  const today=new Date();today.setHours(0,0,0,0);
  const d=new Date(due+"T00:00:00");
  const diff=Math.round((d-today)/86400000);
  if(diff<0)return{label:`Overdue ${Math.abs(diff)}d`,cls:"overdue"};
  if(diff===0)return{label:"Due today",cls:"today"};
  if(diff<=7)return{label:`Due in ${diff}d`,cls:"upcoming"};
  return{label:due,cls:"upcoming"};
};

async function aiBreak(title, ctx) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,system:"Break a step into 3-5 smaller sub-steps. Return ONLY a JSON array of short strings.",messages:[{role:"user",content:`Step: "${title}"\nContext: ${ctx}`}]})});
    if(!r.ok) throw new Error("AI unavailable outside Claude.ai");
    return JSON.parse(((await r.json()).content?.[0]?.text||"[]").replace(/```json|```/g,"").trim());
  } catch {
    alert("✦ AI suggestions only work inside Claude.ai. Add sub-steps manually here.");
    return [];
  }
}

/* ─── DESIGN TOKENS ──────────────────────────────────────────── */
const F = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');`;

const S = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --ink:#09090b;
  --ink2:#27272a;
  --ink3:#52525b;
  --ink4:#a1a1aa;
  --line:#e4e4e7;
  --line2:#d4d4d8;
  --bg:#f4f4f5;
  --bg2:#e4e4e7;
  --white:#ffffff;
  --blue:#2563eb;
  --blue2:#1d4ed8;
  --blue-lt:#eff6ff;
  --blue-bd:#bfdbfe;
  --green:#16a34a;
  --green-lt:#f0fdf4;
  --green-bd:#bbf7d0;
  --amber:#d97706;
  --amber-lt:#fffbeb;
  --amber-bd:#fde68a;
  --red:#dc2626;
  --red-lt:#fef2f2;
  --orange:#ea580c;
  --purple:#7c3aed;
  --r4:4px;--r8:8px;--r12:12px;--r16:16px;--r20:20px;--r24:24px;--rfull:9999px;
}
html{height:100%}
body{
  font-family:'Inter',system-ui,sans-serif;
  font-size:14px;line-height:1.5;
  background:var(--bg);color:var(--ink);
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
  -webkit-tap-highlight-color:transparent;
}

/* ── SCREEN WRAPPER ── */
.app{min-height:100vh;display:flex;flex-direction:column;max-width:430px;margin:0 auto;background:var(--white);position:relative;box-shadow:0 0 0 1px var(--line)}

/* ── STATUS BAR ── */
.status-bar{height:44px;background:var(--white);display:flex;align-items:center;justify-content:space-between;padding:0 20px;flex-shrink:0}
.status-time{font-size:15px;font-weight:600;color:var(--ink)}
.status-icons{display:flex;gap:5px;align-items:center;font-size:12px;font-weight:600;color:var(--ink)}

/* ── NAV BAR ── */
.nav{
  background:rgba(255,255,255,.92);
  backdrop-filter:saturate(180%) blur(20px);
  -webkit-backdrop-filter:saturate(180%) blur(20px);
  border-bottom:1px solid rgba(0,0,0,.08);
  padding:0 16px;
  display:flex;align-items:center;justify-content:space-between;
  height:44px;flex-shrink:0;
  position:sticky;top:0;z-index:50;
}
.nav-title{font-size:17px;font-weight:600;color:var(--ink);letter-spacing:-.2px;flex:1;text-align:center}
.nav-side{min-width:72px;display:flex;align-items:center}
.nav-side.right{justify-content:flex-end}
.nav-action{background:none;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:500;color:var(--blue);padding:4px;line-height:1}
.nav-action.icon{font-size:20px;color:var(--ink3)}
.nav-back{display:flex;align-items:center;gap:2px;background:none;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:400;color:var(--blue);padding:4px 0}
.nav-back-arrow{font-size:20px;line-height:1}

/* ── TAB BAR ── */
.tabbar{
  background:rgba(255,255,255,.92);
  backdrop-filter:saturate(180%) blur(20px);
  -webkit-backdrop-filter:saturate(180%) blur(20px);
  border-top:1px solid rgba(0,0,0,.08);
  display:flex;align-items:flex-start;padding:8px 0 0;
  flex-shrink:0;position:sticky;bottom:0;z-index:50;
}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;cursor:pointer;font-family:inherit;padding:0 0 16px;-webkit-tap-highlight-color:transparent}
.tab-icon{font-size:23px;line-height:1;position:relative}
.tab-icon .badge{position:absolute;top:-4px;right:-10px;background:var(--red);color:#fff;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:var(--rfull);display:flex;align-items:center;justify-content:center;padding:0 3px;border:1.5px solid var(--white)}
.tab-label{font-size:10px;font-weight:500;color:var(--ink4);letter-spacing:.1px}
.tab.active .tab-label{color:var(--blue);font-weight:600}

/* ── SCROLL CONTENT ── */
.scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
.scroll::-webkit-scrollbar{display:none}
.pad{padding:0 16px}

/* ── SECTION HEADER ── */
.section-head{padding:20px 16px 8px;display:flex;align-items:center;justify-content:space-between}
.section-label{font-size:13px;font-weight:600;color:var(--ink4);text-transform:uppercase;letter-spacing:.6px}

/* ── INSET LIST ── */
.list{background:var(--white);border-radius:var(--r12);overflow:hidden;border:1px solid var(--line);margin:0 16px}
.list-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);min-height:50px;position:relative;transition:background .1s}
.list-item:last-child{border-bottom:none}
.list-item:active{background:var(--bg)}
.list-icon{width:30px;height:30px;border-radius:var(--r8);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
.list-body{flex:1;min-width:0}
.list-title{font-size:15px;font-weight:500;color:var(--ink);line-height:1.3}
.list-sub{font-size:13px;color:var(--ink4);margin-top:1px}
.list-right{font-size:13px;color:var(--ink4);display:flex;align-items:center;gap:6px;flex-shrink:0}
.chevron{color:var(--line2);font-size:16px;font-weight:400}
.list-sep{height:1px;background:var(--bg);margin:8px 0}

/* ── GOAL CARD ── */
.gcard{background:var(--white);border-radius:var(--r16);padding:16px;margin:0 16px 12px;border:1px solid var(--line);box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 8px rgba(0,0,0,.04);cursor:pointer;transition:transform .1s,box-shadow .1s;-webkit-tap-highlight-color:transparent}
.gcard:active{transform:scale(.98);box-shadow:0 1px 2px rgba(0,0,0,.04)}
.gcard-title{font-size:16px;font-weight:600;color:var(--ink);letter-spacing:-.2px;margin-bottom:12px;line-height:1.35}
.gcard-progress{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.gcard-track{flex:1;height:5px;background:var(--bg2);border-radius:var(--rfull);overflow:hidden}
.gcard-fill{height:100%;border-radius:var(--rfull);transition:width .5s cubic-bezier(.4,0,.2,1)}
.gcard-pct{font-size:12px;font-weight:700;min-width:30px;text-align:right}
.gcard-footer{display:flex;align-items:center;justify-content:space-between}
.gcard-meta{font-size:12px;color:var(--ink4)}
.health-tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 8px;border-radius:var(--rfull);letter-spacing:.1px}

/* ── STAT GRID ── */
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 16px;margin-bottom:8px}
.stat{background:var(--white);border-radius:var(--r16);padding:16px;border:1px solid var(--line);box-shadow:0 1px 3px rgba(0,0,0,.04)}
.stat-n{font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1;margin-bottom:4px}
.stat-l{font-size:12px;font-weight:500;color:var(--ink4);letter-spacing:.1px}

/* ── HERO CARD ── */
.hero{margin:16px 16px 8px;background:linear-gradient(135deg,var(--blue) 0%,var(--blue2) 100%);border-radius:var(--r20);padding:20px;color:#fff;position:relative;overflow:hidden;box-shadow:0 4px 16px rgba(37,99,235,.35)}
.hero::after{content:'';position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,.07);pointer-events:none}
.hero-greet{font-size:13px;font-weight:500;opacity:.8;margin-bottom:4px}
.hero-line{font-size:20px;font-weight:700;letter-spacing:-.4px;line-height:1.25;margin-bottom:14px}
.hero-stats{display:flex;gap:20px}
.hero-stat-n{font-size:22px;font-weight:800;letter-spacing:-.5px}
.hero-stat-l{font-size:11px;font-weight:500;opacity:.7;margin-top:1px}

/* ── CAPTURE BOX ── */
.capture{background:var(--white);border-radius:var(--r16);padding:14px 16px;margin:0 16px;border:1px solid var(--line);box-shadow:0 1px 4px rgba(0,0,0,.04)}
.capture.focused{border-color:var(--blue);box-shadow:0 0 0 3px rgba(37,99,235,.12)}
.capture textarea{width:100%;border:none;outline:none;font-size:15px;font-family:inherit;color:var(--ink);resize:none;line-height:1.55;background:transparent}
.capture textarea::placeholder{color:var(--ink4)}
.capture-footer{display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
.capture-hint{font-size:12px;color:var(--ink4)}

/* ── BUTTONS ── */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;cursor:pointer;font-family:inherit;font-weight:600;transition:opacity .1s;-webkit-tap-highlight-color:transparent}
.btn:active{opacity:.7}
.btn-blue{background:var(--blue);color:#fff;border-radius:var(--r12);padding:12px 20px;font-size:15px}
.btn-blue:disabled{opacity:.4}
.btn-block{width:100%}
.btn-sm{padding:7px 14px;font-size:13px;border-radius:var(--r8)}
.btn-xs{padding:5px 10px;font-size:12px;border-radius:var(--r8)}
.btn-ghost{background:var(--bg);border-radius:var(--r8);padding:7px 14px;font-size:13px;color:var(--ink3);border:1px solid var(--line)}
.btn-red-ghost{background:var(--red-lt);border-radius:var(--r8);padding:5px 10px;font-size:13px;color:var(--red);border:none}
.btn-row{display:flex;gap:8px}
.pill{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:var(--rfull);font-size:13px;font-weight:500;border:none;cursor:pointer;font-family:inherit;transition:opacity .1s}
.pill:active{opacity:.7}
.pill-blue{background:var(--blue-lt);color:var(--blue)}
.pill-green{background:var(--green-lt);color:var(--green)}
.pill-red{background:var(--red-lt);color:var(--red)}
.pill-gray{background:var(--bg2);color:var(--ink3)}
.pill-purple{background:#f5f3ff;color:var(--purple)}

/* ── STEPS (goal detail) ── */
.steps{margin:0 16px}

/* depth-0 = top-level steps, rendered as cards */
.step-card{
  background:var(--white);
  border-radius:var(--r16);
  border:1px solid var(--line);
  box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.04);
  margin-bottom:8px;
  overflow:hidden;
  transition:box-shadow .15s;
}
.step-card:has(.step-check.on:only-of-type){opacity:.7}

/* The root row inside a card */
.step-root-row{
  display:flex;align-items:flex-start;gap:10px;
  padding:13px 14px;cursor:pointer;
  transition:background .1s;
}
.step-root-row:active{background:var(--bg)}

/* Children container — indented tree lines */
.step-children{
  border-top:1px solid var(--line);
  padding:4px 0;
  background:#f8f8fa;
}

/* Each child row */
.step-row{
  display:flex;align-items:flex-start;gap:0;
  padding:0;border-bottom:1px solid var(--line);
  transition:background .1s;position:relative;
}
.step-row:last-child{border-bottom:none}
.step-row:active{background:rgba(37,99,235,.04)}

/* Tree spine for each depth level */
.step-spine{
  display:flex;flex-shrink:0;
  align-items:stretch;
}
.spine-gap{width:14px;flex-shrink:0;position:relative}
/* vertical line running through each spine gap */
.spine-gap.has-line::before{
  content:'';position:absolute;
  left:50%;top:0;bottom:0;
  width:1.5px;
  background:var(--line2);
  transform:translateX(-50%);
}
/* the L-shaped connector at the node */
.spine-hook{
  width:20px;flex-shrink:0;position:relative;
  display:flex;align-items:center;
}
/* vertical part of L */
.spine-hook::before{
  content:'';position:absolute;
  left:50%;top:0;bottom:50%;
  width:1.5px;background:var(--line2);
  transform:translateX(-50%);
}
/* horizontal part of L */
.spine-hook::after{
  content:'';position:absolute;
  left:50%;top:50%;
  width:10px;height:1.5px;
  background:var(--line2);
}
/* last child — L stops, no line below */
.spine-hook.last-child::before{
  bottom:50%;
}
/* child that has siblings below — line continues */
.spine-gap.sibling-line::before{background:var(--line2)}

.step-content{
  flex:1;min-width:0;
  display:flex;align-items:flex-start;gap:10px;
  padding:10px 12px 10px 0;
  cursor:pointer;
}

/* checkboxes */
.step-check{
  width:20px;height:20px;min-width:20px;
  border-radius:50%;
  border:2px solid var(--line2);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;flex-shrink:0;margin-top:2px;
  transition:all .15s;
}
.step-check.on{background:var(--green);border-color:var(--green)}
.step-check.on::after{content:'✓';font-size:11px;color:#fff;font-weight:700}
.step-check.sq{border-radius:var(--r4)}
/* root-level check is slightly bigger */
.step-root-row .step-check{width:22px;height:22px;min-width:22px}

.step-body{flex:1;min-width:0}

/* Depth-based text colour — fades as you go deeper */
.step-title{font-size:14px;color:var(--ink2);line-height:1.4}
.step-title.done{text-decoration:line-through;color:var(--ink4)}
.step-title.parent{font-weight:600;color:var(--ink)}
.step-title.root-title{font-size:16px;font-weight:600;letter-spacing:-.1px;color:var(--ink)}

/* ── DEPTH 1: Tasks — white, blue accent, solid checkbox ── */
.step-row[data-depth="1"]{background:#ffffff;border-left:3px solid #2563eb}
.step-row[data-depth="1"] .step-title{color:var(--ink);font-weight:600}
.step-row[data-depth="1"] .step-check{border-color:#2563eb}
.step-row[data-depth="1"] .step-check.on{background:#2563eb;border-color:#2563eb}
.step-row[data-depth="1"] .spine-gap.has-line::before,.step-row[data-depth="1"] .spine-hook::before,.step-row[data-depth="1"] .spine-hook::after{background:#93c5fd}

/* ── DEPTH 2: Sub-tasks — light blue tint, indigo accent ── */
.step-row[data-depth="2"]{background:#eff6ff;border-left:3px solid #6366f1}
.step-row[data-depth="2"] .step-title{color:var(--ink2);font-weight:400}
.step-row[data-depth="2"] .step-check{border-color:#6366f1}
.step-row[data-depth="2"] .step-check.on{background:#6366f1;border-color:#6366f1}
.step-row[data-depth="2"] .spine-gap.has-line::before,.step-row[data-depth="2"] .spine-hook::before,.step-row[data-depth="2"] .spine-hook::after{background:#a5b4fc}

/* ── DEPTH 3: Sub-sub-tasks — light purple tint, purple accent ── */
.step-row[data-depth="3"]{background:#f5f3ff;border-left:3px solid #8b5cf6}
.step-row[data-depth="3"] .step-title{color:var(--ink3);font-weight:400}
.step-row[data-depth="3"] .step-check{border-color:#8b5cf6}
.step-row[data-depth="3"] .step-check.on{background:#8b5cf6;border-color:#8b5cf6}
.step-row[data-depth="3"] .spine-gap.has-line::before,.step-row[data-depth="3"] .spine-hook::before,.step-row[data-depth="3"] .spine-hook::after{background:#c4b5fd}

/* ── DEPTH 4+: Deepest — faint violet, muted ── */
.step-row[data-depth="4"]{background:#faf5ff;border-left:3px solid #a78bfa}
.step-row[data-depth="4"] .step-title{color:var(--ink4);font-weight:400}
.step-row[data-depth="4"] .step-check{border-color:#a78bfa}
.step-row[data-depth="4"] .step-check.on{background:#a78bfa;border-color:#a78bfa}
.step-row[data-depth="4"] .spine-gap.has-line::before,.step-row[data-depth="4"] .spine-hook::before,.step-row[data-depth="4"] .spine-hook::after{background:#ddd6fe}
.step-note-area{
  width:100%;border:none;outline:none;
  font-size:13px;font-family:inherit;color:var(--ink3);
  resize:none;background:transparent;margin-top:4px;line-height:1.5
}
.step-note-area::placeholder{color:var(--ink4)}
.step-pills{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.expand-btn{
  background:var(--bg);border:1px solid var(--line);
  border-radius:var(--rfull);cursor:pointer;
  font-size:11px;font-weight:600;color:var(--ink3);
  padding:2px 8px;font-family:inherit;flex-shrink:0;margin-top:3px;
  transition:all .1s;
}
.expand-btn:hover{background:var(--bg2)}

/* reorder buttons */
.step-reorder{display:flex;flex-direction:column;gap:1px;flex-shrink:0;opacity:0;transition:opacity .12s}
.step-root-row:hover .step-reorder,.step-content:hover .step-reorder{opacity:1}
.reorder-btn{background:none;border:none;cursor:pointer;color:var(--ink4);font-size:11px;line-height:1;padding:1px 3px;font-family:inherit;transition:color .1s}
.reorder-btn:hover{color:var(--ink)}
.reorder-btn:disabled{opacity:.2;cursor:default}

/* add row */
.add-step-btn{
  display:flex;align-items:center;gap:10px;
  width:100%;padding:12px 14px;
  border:none;background:none;cursor:pointer;font-family:inherit;
  border-top:1px solid var(--line);
  transition:background .1s;
}
.add-step-btn:active{background:var(--bg)}
.add-step-icon{
  width:22px;height:22px;min-width:22px;
  background:var(--blue);border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  color:#fff;font-size:16px;font-weight:700;flex-shrink:0;
}
.add-step-input{flex:1;border:none;outline:none;font-size:15px;font-family:inherit;color:var(--ink);background:transparent}
.add-step-input::placeholder{color:var(--ink4)}

/* add-child row (inline, inside children area) */
.add-child-row{
  display:flex;align-items:center;gap:0;
  border-top:1px solid var(--line);
  padding:0;background:var(--blue-lt);
}
.add-child-input{
  flex:1;border:none;outline:none;
  font-size:14px;font-family:inherit;color:var(--ink);
  background:transparent;padding:10px 12px 10px 0;
}
.add-child-input::placeholder{color:var(--blue)}

/* ── DUMP ── */
.dump-card{background:var(--white);border-radius:var(--r12);padding:14px;margin:0 16px 10px;border:1px solid var(--line);box-shadow:0 1px 3px rgba(0,0,0,.04)}
.dump-text{font-size:15px;color:var(--ink);line-height:1.5;margin-bottom:10px}
.dump-footer{display:flex;align-items:center;justify-content:space-between}
.dump-time{font-size:12px;color:var(--ink4)}

/* ── GOAL DETAIL HEADER ── */
.detail-header{padding:16px;background:var(--white);border-bottom:1px solid var(--line)}
.detail-title-input{width:100%;border:none;outline:none;font-size:22px;font-weight:700;font-family:inherit;color:var(--ink);letter-spacing:-.4px;resize:none;line-height:1.3;background:transparent}
.detail-progress{display:flex;align-items:center;gap:10px;margin-top:12px}
.detail-track{flex:1;height:6px;background:var(--bg2);border-radius:var(--rfull);overflow:hidden}
.detail-fill{height:100%;border-radius:var(--rfull);transition:width .5s}

/* ── TODAY HERO ── */
.today-hero{margin:16px 16px 8px;background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);border-radius:var(--r20);padding:20px;color:#fff;box-shadow:0 4px 16px rgba(49,46,129,.35)}
.today-task{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);transition:background .1s}
.today-task:active{background:var(--bg)}
.today-task:last-child{border-bottom:none}
.today-check{width:22px;height:22px;min-width:22px;border-radius:50%;border:2px solid var(--line2);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin-top:1px;transition:all .15s}
.today-check.on{background:var(--green);border-color:var(--green)}
.today-check.on::after{content:'✓';font-size:12px;color:#fff;font-weight:700}

/* ── SHEET ── */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;display:flex;align-items:flex-end;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.sheet{background:var(--white);border-radius:20px 20px 0 0;width:100%;max-height:85vh;overflow-y:auto;padding:0 16px 40px;box-shadow:0 -8px 40px rgba(0,0,0,.15)}
.sheet-handle{width:36px;height:4px;background:var(--line2);border-radius:var(--rfull);margin:12px auto 20px}
.sheet-title{font-size:18px;font-weight:700;color:var(--ink);margin-bottom:16px;letter-spacing:-.3px}
.sheet-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--line)}
.sheet-row:last-child{border-bottom:none}
.sheet-row-label{font-size:15px;font-weight:500;color:var(--ink)}
.sheet-row-sub{font-size:13px;color:var(--ink4);margin-top:2px}

/* ── WELCOME ── */
.welcome{min-height:100vh;display:flex;flex-direction:column;background:var(--white);max-width:430px;margin:0 auto}
.welcome-top{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px 32px;text-align:center}
.welcome-logo{width:72px;height:72px;background:var(--blue);border-radius:22px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:24px;box-shadow:0 8px 24px rgba(37,99,235,.3)}
.welcome-h1{font-size:32px;font-weight:800;color:var(--ink);letter-spacing:-.8px;margin-bottom:10px;line-height:1.15}
.welcome-p{font-size:16px;color:var(--ink3);line-height:1.6;max-width:300px}
.welcome-bottom{padding:16px 16px 40px;border-top:1px solid var(--line)}
.welcome-input-wrap{background:var(--bg);border-radius:var(--r16);padding:14px 16px;margin-bottom:12px;border:1.5px solid transparent;transition:all .15s}
.welcome-input-wrap.focus{background:var(--white);border-color:var(--blue);box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.welcome-input{width:100%;border:none;outline:none;font-size:16px;font-family:inherit;color:var(--ink);resize:none;line-height:1.55;background:transparent;min-height:56px}
.welcome-input::placeholder{color:var(--ink4)}
.welcome-input-hint{font-size:12px;color:var(--ink4);margin-bottom:12px;text-align:center}
.welcome-or{display:flex;align-items:center;gap:10px;margin:16px 0}
.welcome-or-line{flex:1;height:1px;background:var(--line)}
.welcome-or-text{font-size:13px;color:var(--ink4);font-weight:500}
.welcome-goto{display:flex;align-items:center;gap:12px;width:100%;background:var(--white);border:1px solid var(--line);border-radius:var(--r16);padding:14px 16px;cursor:pointer;font-family:inherit;box-shadow:0 1px 3px rgba(0,0,0,.04);text-align:left;transition:background .1s}
.welcome-goto:active{background:var(--bg)}
.welcome-goto-icon{width:40px;height:40px;background:var(--blue-lt);border-radius:var(--r12);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.welcome-goto-text{flex:1}
.welcome-goto-label{font-size:15px;font-weight:600;color:var(--ink)}
.welcome-goto-sub{font-size:13px;color:var(--ink4)}

/* ── PIN ── */
.pin-screen{min-height:100vh;background:var(--white);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;max-width:430px;margin:0 auto}
.pin-app{font-size:24px;font-weight:800;color:var(--ink);letter-spacing:-.5px;margin-bottom:6px}
.pin-sub{font-size:15px;color:var(--ink4);text-align:center;margin-bottom:40px}
.pin-dots{display:flex;gap:16px;margin-bottom:40px}
.pin-dot{width:14px;height:14px;border-radius:50%;background:var(--line2);transition:all .15s}
.pin-dot.on{background:var(--blue);transform:scale(1.1)}
.pin-dot.err{background:var(--red);animation:shake .35s ease}
@keyframes shake{0%,100%{transform:translateX(0) scale(1)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
.pin-grid{display:grid;grid-template-columns:repeat(3,76px);gap:12px;justify-content:center}
.pin-key{width:76px;height:76px;border-radius:50%;border:none;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:var(--bg);transition:all .1s;-webkit-tap-highlight-color:transparent}
.pin-key:active{background:var(--bg2);transform:scale(.93)}
.pin-key-num{font-size:28px;font-weight:400;color:var(--ink);letter-spacing:-.5px;line-height:1}
.pin-key-alpha{font-size:9px;font-weight:600;color:var(--ink4);letter-spacing:.8px}
.pin-key.del{background:transparent;box-shadow:none}
.pin-key.del .pin-key-num{font-size:22px;color:var(--ink3)}
.pin-key.blank{opacity:0;pointer-events:none}
.pin-err{font-size:14px;color:var(--red);margin-top:16px;min-height:20px;text-align:center}
.pin-step{font-size:13px;color:var(--ink4);margin-bottom:24px;font-weight:500}


/* ── REORDER ── */
.step-reorder{display:flex;flex-direction:column;gap:1px;flex-shrink:0;opacity:0;transition:opacity .12s}
.step-row:hover .step-reorder{opacity:1}
.reorder-btn{background:none;border:none;cursor:pointer;color:var(--ink4);font-size:11px;line-height:1;padding:1px 3px;font-family:inherit;transition:color .1s}
.reorder-btn:hover{color:var(--ink)}
.reorder-btn:disabled{opacity:.2;cursor:default}

/* ── DUE DATE ── */
.due-date{font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:3px;margin-top:3px}
.due-date.overdue{color:var(--red)}
.due-date.today{color:var(--amber)}
.due-date.upcoming{color:var(--ink4)}
.due-date.done-d{color:var(--green)}
input[type=date].date-input{border:none;outline:none;font-size:12px;font-family:inherit;color:var(--blue);background:transparent;padding:0;cursor:pointer;width:auto}

/* ── SEARCH ── */
.search-bar{display:flex;align-items:center;gap:10px;background:var(--bg);border-radius:var(--r12);padding:10px 14px;margin:12px 16px 4px;border:1.5px solid transparent;transition:all .15s}
.search-bar.focused{background:var(--white);border-color:var(--blue);box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.search-icon{font-size:16px;color:var(--ink4);flex-shrink:0}
.search-input{flex:1;border:none;outline:none;font-size:15px;font-family:inherit;color:var(--ink);background:transparent}
.search-input::placeholder{color:var(--ink4)}
.search-clear{background:var(--bg2);border:none;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;color:var(--ink4);flex-shrink:0}
.search-result{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);cursor:pointer;transition:background .1s}
.search-result:active{background:var(--bg)}
.search-result:last-child{border-bottom:none}
.search-highlight{background:#fef9c3;color:#92400e;border-radius:2px;padding:0 1px}
.search-empty{padding:40px 24px;text-align:center;color:var(--ink4);font-size:15px}


/* ── ZOOM / FOCUS ── */
.zoom-trail{display:flex;align-items:center;gap:4px;padding:10px 16px 6px;flex-wrap:wrap;overflow-x:auto}
.zoom-trail::-webkit-scrollbar{display:none}
.zoom-crumb{font-size:13px;color:var(--blue);cursor:pointer;white-space:nowrap;font-weight:500;background:none;border:none;font-family:inherit;padding:2px 4px;border-radius:var(--r4);transition:background .1s}
.zoom-crumb:hover{background:var(--blue-lt)}
.zoom-crumb.root-crumb{color:var(--ink4)}
.zoom-sep{font-size:12px;color:var(--line2);flex-shrink:0}
.zoom-current{font-size:13px;color:var(--ink);font-weight:600;white-space:nowrap;padding:2px 4px}
.zoom-banner{display:flex;align-items:center;justify-content:space-between;margin:0 16px 6px;padding:10px 14px;background:var(--blue-lt);border-radius:var(--r12);border:1px solid var(--blue-bd)}
.zoom-banner-text{font-size:13px;color:var(--blue);font-weight:500}
.zoom-banner-count{font-size:12px;color:var(--blue);opacity:.7}
.zoom-exit{background:var(--blue);color:#fff;border:none;border-radius:var(--r8);padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity .1s}
.zoom-exit:active{opacity:.7}
.pill-zoom{background:#f0f9ff;color:#0369a1}
@keyframes zoomIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
.zoom-in{animation:zoomIn .18s ease forwards}
@keyframes zoomOut{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
.zoom-out{animation:zoomOut .18s ease forwards}

/* ── MISC ── */
.mt{margin-top:8px}.mt2{margin-top:16px}.mb{margin-bottom:8px}.mb2{margin-bottom:16px}
.row{display:flex;gap:8px;align-items:center}.f1{flex:1}
.spin{display:inline-block;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.up{animation:up .2s ease forwards}
@keyframes fade{from{opacity:0}to{opacity:1}}
.fade{animation:fade .15s ease forwards}
`;

const ALPHA = {1:"",2:"ABC",3:"DEF",4:"GHI",5:"JKL",6:"MNO",7:"PQRS",8:"TUV",9:"WXYZ",0:" "};

/* ════════════════════════════ PIN ══════════════════════════════ */
function Pin({mode,onDone,onSkip}){
  const [entered,setEntered]=useState([]);
  const [stage,setStage]=useState("enter"); // enter | confirm
  const [first,setFirst]=useState("");
  const [err,setErr]=useState("");
  const [shake,setShake]=useState(false);

  const press=n=>{
    if(entered.length>=4)return;
    const next=[...entered,n]; setEntered(next); setErr("");
    if(next.length<4)return;
    const pin=next.join("");
    setTimeout(()=>{
      if(mode==="unlock"){
        if(pin===localStorage.getItem("mindos_pin")){onDone();}
        else doErr("Incorrect PIN");
      } else {
        if(stage==="enter"){setFirst(pin);setEntered([]);setStage("confirm");}
        else if(pin===first){localStorage.setItem("mindos_pin",pin);onDone();}
        else doErr("PINs don't match. Try again.");
      }
    },120);
  };
  const doErr=msg=>{setShake(true);setTimeout(()=>{setShake(false);setEntered([]);if(mode==="setup")setStage("enter");setFirst("");setErr(msg);},400)};
  const del=()=>{setEntered(e=>e.slice(0,-1));setErr("");};
  const KEYS=[1,2,3,4,5,6,7,8,9,null,0,"⌫"];

  const label=mode==="unlock"?"Enter PIN":stage==="enter"?"New PIN":"Confirm PIN";
  const sub=mode==="unlock"?"Enter your PIN to continue":stage==="enter"?"Choose a 4-digit PIN":"Type it again to confirm";

  return(
    <div className="pin-screen fade">
      <div className="pin-app">Mind OS</div>
      <div className="pin-sub">{sub}</div>
      {mode==="setup"&&<div className="pin-step">Step {stage==="enter"?1:2} of 2</div>}
      <div className="pin-dots">
        {[0,1,2,3].map(i=><div key={i} className={`pin-dot${entered.length>i?" on":""}${shake?" err":""}`}/>)}
      </div>
      <div className="pin-grid">
        {KEYS.map((k,i)=>{
          if(k===null)return <div key={i} className="pin-key blank"/>;
          if(k==="⌫")return <button key={i} className="pin-key del" onClick={del}><span className="pin-key-num">{k}</span></button>;
          return <button key={i} className="pin-key" onClick={()=>press(k)}>
            <span className="pin-key-num">{k}</span>
            {ALPHA[k]&&<span className="pin-key-alpha">{ALPHA[k]}</span>}
          </button>;
        })}
      </div>
      <div className="pin-err">{err}</div>
      {mode==="setup"&&<button className="btn btn-ghost" style={{marginTop:20}} onClick={onSkip}>Skip</button>}
    </div>
  );
}

/* ════════════════════════════ WELCOME ══════════════════════════ */
function Welcome({onCapture,onGoToApp}){
  const [text,setText]=useState("");
  const [foc,setFoc]=useState(false);
  const submit=()=>{if(text.trim()){onCapture(text.trim());setText("");}};

  return(
    <div className="welcome fade">
      <div className="welcome-top">
        <div className="welcome-logo">📓</div>
        <div className="welcome-h1">Mind OS</div>
        <div className="welcome-p">Never let an idea die because you didn't know the next step.</div>
      </div>
      <div className="welcome-bottom">
        <div className={`welcome-input-wrap${foc?" focus":""}`}>
          <textarea
            className="welcome-input"
            value={text}
            onChange={e=>setText(e.target.value)}
            onFocus={()=>setFoc(true)}
            onBlur={()=>setFoc(false)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit();}}}
            placeholder="What's on your mind?"
            autoFocus
          />
        </div>
        <div className="welcome-input-hint">
          {text.trim()?"Press Enter to save to Brain Dump →":"Type freely — anything on your mind"}
        </div>
        {text.trim()&&<button className="btn btn-blue btn-block mb2" onClick={submit}>Save to Brain Dump →</button>}
        <div className="welcome-or">
          <div className="welcome-or-line"/><span className="welcome-or-text">or</span><div className="welcome-or-line"/>
        </div>
        <button className="welcome-goto" onClick={onGoToApp}>
          <div className="welcome-goto-icon">🎯</div>
          <div className="welcome-goto-text">
            <div className="welcome-goto-label">Go to my Goals</div>
            <div className="welcome-goto-sub">See your plans and tasks</div>
          </div>
          <span className="chevron">›</span>
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════ STEP BODY (shared inner UI) ══════ */
function StepBody({node,nodes,isRoot,isCard,onUpdate,onDelete,onAdd,onMove,onZoom,siblings}){
  const [active,setActive]     = useState(false);
  const [adding,setAdding]     = useState(false);
  const [editingNote,setEditingNote] = useState(false);
  const [showDate,setShowDate] = useState(false);
  const [aiLoad,setAiLoad]     = useState(false);
  const [newTxt,setNewTxt]     = useState("");
  const [open,setOpen]         = useState(true);
  const addRef = useRef(null);

  const kids   = ch(nodes,node.id);
  const isLeaf = kids.length===0;
  const hasNote = !!(node.note?.trim());

  const toggle = e => {
    e.stopPropagation();
    const nd = !node.done;
    onUpdate(node.id,{done:nd});
    desc(nodes,node.id).forEach(d=>onUpdate(d.id,{done:nd}));
  };

  const submitAdd = () => {
    if(!newTxt.trim()){setAdding(false);return;}
    onAdd(node.id,newTxt.trim());
    setNewTxt("");
    setTimeout(()=>addRef.current?.focus(),40);
  };

  const doAI = async e => {
    e.stopPropagation(); setAiLoad(true);
    const ctx = ancs(nodes,node.id).map(n=>n.title).join(" → ");
    const items = await aiBreak(node.title,ctx);
    items.forEach(s=>onAdd(node.id,s));
    setAiLoad(false); setOpen(true); setActive(false);
  };

  // sorted kids
  const sortedKids = kids.slice().sort((a,b)=>a.ts-b.ts);

  return(
    <>
      {/* ── Row header ── */}
      <div
        className={isCard?"step-root-row":"step-content"}
        onClick={()=>setActive(a=>!a)}
      >
        {/* checkbox */}
        <div
          className={`step-check${node.done?" on":""}${!isLeaf?" sq":""}`}
          onClick={toggle}
        />
        <div className="step-body">
          <div className={`step-title${node.done?" done":""}${!isLeaf?" parent":""}${isCard?" root-title":""}`}>
            {node.title}
          </div>
          {(hasNote||editingNote)&&(
            <textarea className="step-note-area" rows={1}
              value={node.note||""}
              onChange={e=>onUpdate(node.id,{note:e.target.value})}
              onFocus={()=>setEditingNote(true)}
              onBlur={()=>setEditingNote(false)}
              onClick={e=>e.stopPropagation()}
              placeholder="Add a note…"
            />
          )}
          {node.due&&!node.done&&(()=>{const df=dueFmt(node.due);return df?<div className={`due-date ${df.cls}`}>📅 {df.label}</div>:null;})()}
          {node.done&&node.due&&<div className="due-date done-d">✓ Done</div>}
          {active&&(
            <div className="step-pills" onClick={e=>e.stopPropagation()}>
              <button className="pill pill-blue" onClick={()=>{setAdding(a=>!a);setActive(false);}}>+ Sub-step</button>
              <button className="pill pill-gray" onClick={()=>{setEditingNote(true);setActive(false);}}>📝 Note</button>
              <button className="pill pill-gray" onClick={e=>{e.stopPropagation();setShowDate(s=>!s);setActive(false);}}>📅 Date</button>
              {!isLeaf&&onZoom&&<button className="pill pill-zoom" onClick={e=>{e.stopPropagation();onZoom(node.id);setActive(false);}}>⤢ Focus</button>}
              {isLeaf&&<button className="pill pill-purple" onClick={doAI} disabled={aiLoad}>{aiLoad?<><span className="spin">◌</span> AI…</>:"✦ AI"}</button>}
              <button className="pill pill-red" onClick={e=>{e.stopPropagation();if(kids.length>0&&!window.confirm("Delete with sub-steps?"))return;onDelete(node.id);}}>Delete</button>
            </div>
          )}
          {showDate&&(
            <div style={{marginTop:6,display:"flex",alignItems:"center",gap:8}} onClick={e=>e.stopPropagation()}>
              <span style={{fontSize:12,color:"var(--ink4)"}}>Due:</span>
              <input type="date" className="date-input" value={node.due||""}
                onChange={e=>{onUpdate(node.id,{due:e.target.value});setShowDate(false);}}/>
              {node.due&&<button className="pill pill-red" style={{padding:"2px 7px",fontSize:11}} onClick={()=>{onUpdate(node.id,{due:""});setShowDate(false);}}>Clear</button>}
            </div>
          )}
        </div>
        {/* reorder */}
        {onMove&&(
          <div className="step-reorder" onClick={e=>e.stopPropagation()}>
            <button className="reorder-btn" onClick={()=>onMove(node.id,-1)}>▲</button>
            <button className="reorder-btn" onClick={()=>onMove(node.id,1)}>▼</button>
          </div>
        )}
        {/* expand toggle */}
        {kids.length>0&&(
          <button className="expand-btn" onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}>
            {open?`▾ ${kids.length}`:`▸ ${kids.length}`}
          </button>
        )}
      </div>

      {/* ── Children tree ── */}
      {open&&kids.length>0&&(
        <div className="step-children">
          {sortedKids.map((k,i)=>{
            const isLast = i===sortedKids.length-1;
            return(
              <TreeRow key={k.id} node={k} nodes={nodes} goalId={node.goalId}
                depth={1} isLast={isLast} spineDepths={[]}
                onUpdate={onUpdate} onDelete={onDelete} onAdd={onAdd}
                onMove={onMove} onZoom={onZoom}/>
            );
          })}
        </div>
      )}

      {/* ── Inline add child ── */}
      {adding&&(
        <div className="add-child-row">
          <div style={{width:14,flexShrink:0}}/>
          <div className="add-step-icon" style={{width:18,height:18,fontSize:13}}>+</div>
          <input ref={addRef} className="add-child-input" value={newTxt}
            onChange={e=>setNewTxt(e.target.value)}
            placeholder="New sub-step… (Enter to add)"
            onKeyDown={e=>{if(e.key==="Enter")submitAdd();if(e.key==="Escape"){setAdding(false);setNewTxt("");}}}
            autoFocus/>
          {newTxt.trim()&&<button className="pill pill-blue" style={{marginRight:8,flexShrink:0}} onClick={submitAdd}>Add</button>}
        </div>
      )}
    </>
  );
}

/* ── TreeRow: renders a child row with spine lines ── */
function TreeRow({node,nodes,goalId,depth,isLast,spineDepths,onUpdate,onDelete,onAdd,onMove,onZoom}){
  const [open,setOpen]     = useState(true);
  const [active,setActive] = useState(false);
  const [adding,setAdding] = useState(false);
  const [editingNote,setEditingNote] = useState(false);
  const [showDate,setShowDate] = useState(false);
  const [aiLoad,setAiLoad] = useState(false);
  const [newTxt,setNewTxt] = useState("");
  const addRef = useRef(null);

  const kids   = ch(nodes,node.id);
  const isLeaf = kids.length===0;
  const hasNote = !!(node.note?.trim());
  const sortedKids = kids.slice().sort((a,b)=>a.ts-b.ts);

  const toggle = e => {
    e.stopPropagation();
    const nd=!node.done;
    onUpdate(node.id,{done:nd});
    desc(nodes,node.id).forEach(d=>onUpdate(d.id,{done:nd}));
  };

  const submitAdd = () => {
    if(!newTxt.trim()){setAdding(false);return;}
    onAdd(node.id,newTxt.trim());
    setNewTxt(""); setTimeout(()=>addRef.current?.focus(),40);
  };

  const doAI = async e => {
    e.stopPropagation(); setAiLoad(true);
    const ctx=ancs(nodes,node.id).map(n=>n.title).join(" → ");
    const items=await aiBreak(node.title,ctx);
    items.forEach(s=>onAdd(node.id,s));
    setAiLoad(false); setOpen(true); setActive(false);
  };

  // Build spine: for each ancestor depth, show a line if that ancestor had siblings below
  const spineSegments = spineDepths.map((hasLine,i)=>(
    <div key={i} className={`spine-gap${hasLine?" has-line":""}`}/>
  ));

  return(
    <div>
      <div className="step-row" data-depth={Math.min(depth,4)}>
        {/* spine */}
        <div className="step-spine">
          {spineSegments}
          <div className={`spine-hook${isLast?" last-child":""}`}/>
        </div>
        {/* content */}
        <div className="step-content" onClick={()=>setActive(a=>!a)}>
          <div className={`step-check${node.done?" on":""}${!isLeaf?" sq":""}`} onClick={toggle}/>
          <div className="step-body">
            <div className={`step-title${node.done?" done":""}${!isLeaf?" parent":""}`}>{node.title}</div>
            {(hasNote||editingNote)&&(
              <textarea className="step-note-area" rows={1}
                value={node.note||""}
                onChange={e=>onUpdate(node.id,{note:e.target.value})}
                onFocus={()=>setEditingNote(true)}
                onBlur={()=>setEditingNote(false)}
                onClick={e=>e.stopPropagation()}
                placeholder="Add a note…"
              />
            )}
            {node.due&&!node.done&&(()=>{const df=dueFmt(node.due);return df?<div className={`due-date ${df.cls}`}>📅 {df.label}</div>:null;})()}
            {active&&(
              <div className="step-pills" onClick={e=>e.stopPropagation()}>
                <button className="pill pill-blue" onClick={()=>{setAdding(a=>!a);setActive(false);}}>+ Sub-step</button>
                <button className="pill pill-gray" onClick={()=>{setEditingNote(true);setActive(false);}}>📝 Note</button>
                <button className="pill pill-gray" onClick={e=>{e.stopPropagation();setShowDate(s=>!s);setActive(false);}}>📅 Date</button>
                {!isLeaf&&onZoom&&<button className="pill pill-zoom" onClick={e=>{e.stopPropagation();onZoom(node.id);setActive(false);}}>⤢ Focus</button>}
                {isLeaf&&<button className="pill pill-purple" onClick={doAI} disabled={aiLoad}>{aiLoad?<><span className="spin">◌</span> AI…</>:"✦ AI"}</button>}
                <button className="pill pill-red" onClick={e=>{e.stopPropagation();if(kids.length>0&&!window.confirm("Delete?"))return;onDelete(node.id);}}>Delete</button>
              </div>
            )}
            {showDate&&(
              <div style={{marginTop:6,display:"flex",alignItems:"center",gap:8}} onClick={e=>e.stopPropagation()}>
                <span style={{fontSize:12,color:"var(--ink4)"}}>Due:</span>
                <input type="date" className="date-input" value={node.due||""}
                  onChange={e=>{onUpdate(node.id,{due:e.target.value});setShowDate(false);}}/>
                {node.due&&<button className="pill pill-red" style={{padding:"2px 7px",fontSize:11}} onClick={()=>{onUpdate(node.id,{due:""});setShowDate(false);}}>Clear</button>}
              </div>
            )}
          </div>
          {onMove&&(
            <div className="step-reorder" onClick={e=>e.stopPropagation()}>
              <button className="reorder-btn" onClick={()=>onMove(node.id,-1)}>▲</button>
              <button className="reorder-btn" onClick={()=>onMove(node.id,1)}>▼</button>
            </div>
          )}
          {kids.length>0&&(
            <button className="expand-btn" onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}>
              {open?`▾ ${kids.length}`:`▸ ${kids.length}`}
            </button>
          )}
        </div>
      </div>

      {/* children */}
      {open&&sortedKids.length>0&&sortedKids.map((k,i)=>{
        const childIsLast = i===sortedKids.length-1;
        // pass down spine info: previous levels' "has more siblings" flags
        const childSpine = [...spineDepths, !isLast];
        return(
          <TreeRow key={k.id} node={k} nodes={nodes} goalId={goalId}
            depth={depth+1} isLast={childIsLast} spineDepths={childSpine}
            onUpdate={onUpdate} onDelete={onDelete} onAdd={onAdd}
            onMove={onMove} onZoom={onZoom}/>
        );
      })}

      {/* inline add */}
      {adding&&(
        <div className="step-row" data-depth={Math.min(depth,4)}>
          <div className="step-spine">
            {spineDepths.map((hl,i)=><div key={i} className={`spine-gap${hl?" has-line":""}`}/>)}
            <div className="spine-hook last-child"/>
          </div>
          <div className="add-child-row" style={{flex:1,borderTop:"none",borderBottom:"1px solid var(--line)"}}>
            <input ref={addRef} className="add-child-input" value={newTxt}
              onChange={e=>setNewTxt(e.target.value)}
              placeholder="Sub-step… (Enter to add)"
              onKeyDown={e=>{if(e.key==="Enter")submitAdd();if(e.key==="Escape"){setAdding(false);setNewTxt("");}}}
              autoFocus/>
            {newTxt.trim()&&<button className="pill pill-blue" style={{marginRight:8,flexShrink:0}} onClick={submitAdd}>Add</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step: top-level card wrapper ── */
function Step({node,nodes,goalId,depth,onUpdate,onDelete,onAdd,onMove,onZoom}){
  return(
    <div className="step-card">
      <StepBody node={node} nodes={nodes} isRoot={false} isCard
        onUpdate={onUpdate} onDelete={onDelete} onAdd={onAdd}
        onMove={onMove} onZoom={onZoom}/>
    </div>
  );
}

/* ════════════════════════════ GOAL DETAIL ══════════════════════ */
function GoalDetail({db,setDb,goalId,onBack}){
  const goal=db.goals.find(g=>g.id===goalId);
  const allNodes=db.nodes.filter(n=>n.goalId===goalId);
  const root=allNodes.find(n=>!n.parentId);
  const [title,setTitle]=useState(goal?.title||"");
  const [adding,setAdding]=useState(false);
  const [txt,setTxt]=useState("");
  const [focusId,setFocusId]=useState(null); // zoom state
  const [zoomAnim,setZoomAnim]=useState(""); // "zoom-in" | "zoom-out"
  const addRef=useRef(null);
  useEffect(()=>setTitle(goal?.title||""),[goalId]);
  useEffect(()=>{setFocusId(null);setZoomAnim("");},[goalId]);

  const upd=useCallback((id,ch_)=>{setDb(d=>{const n={...d,nodes:d.nodes.map(x=>x.id===id?{...x,...ch_,updatedAt:Date.now()}:x)};save(n);return n;});},[]);
  const del=useCallback((id)=>{setDb(d=>{const kill=[id,...desc(d.nodes,id).map(n=>n.id)];const n={...d,nodes:d.nodes.filter(x=>!kill.includes(x.id))};save(n);return n;});},[]);
  const add=useCallback((pid,text)=>{const nn={id:uid(),parentId:pid,goalId,title:text,done:false,note:"",ts:Date.now(),updatedAt:Date.now()};setDb(d=>{const n={...d,nodes:[...d.nodes,nn]};save(n);return n;});},[goalId]);
  const saveTitle=()=>{if(title.trim()&&title.trim()!==goal?.title)setDb(d=>{const n={...d,goals:d.goals.map(g=>g.id===goalId?{...g,title:title.trim()}:g),nodes:d.nodes.map(nd=>nd.goalId===goalId&&!nd.parentId?{...nd,title:title.trim()}:nd)};save(n);return n;});};

  const doZoom=(id)=>{setZoomAnim("zoom-in");setFocusId(id);setAdding(false);};
  const doZoomOut=(id)=>{setZoomAnim("zoom-out");setFocusId(id||null);setAdding(false);};
  const doZoomRoot=()=>{setZoomAnim("zoom-out");setFocusId(null);setAdding(false);};

  if(!goal||!root)return null;

  // Which node is the current "root" of the view
  const viewRoot = focusId ? allNodes.find(n=>n.id===focusId) : root;
  const nodes = focusId
    ? [viewRoot,...desc(allNodes,focusId)] // only focused subtree
    : allNodes;

  // Breadcrumb trail to focused node
  const trail = focusId ? ancs(allNodes,focusId).concat(viewRoot) : [];

  const p=pct(allNodes,goalId);
  const leaves=allNodes.filter(n=>ch(allNodes,n.id).length===0&&n.parentId);
  const done=leaves.filter(n=>n.done).length;
  const isComplete=p===100&&leaves.length>0;

  // Local progress within focus scope
  const focusLeaves=focusId?nodes.filter(n=>ch(nodes,n.id).length===0&&n.parentId):leaves;
  const focusDone=focusLeaves.filter(n=>n.done).length;

  const submitAdd=()=>{
    if(!txt.trim()){setAdding(false);return;}
    add(viewRoot?.id,txt.trim());
    setTxt("");
    setTimeout(()=>addRef.current?.focus(),40);
  };

  return(
    <div className="scroll up">
      {/* Header — shows goal title + overall progress */}
      <div className="detail-header">
        <textarea className="detail-title-input" value={title}
          onChange={e=>setTitle(e.target.value)} onBlur={saveTitle}
          onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();saveTitle();}}} rows={1}/>
        {leaves.length>0&&(
          <div className="detail-progress">
            <div className="detail-track">
              <div className="detail-fill" style={{width:p+"%",background:isComplete?"var(--green)":"var(--blue)"}}/>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:isComplete?"var(--green)":"var(--blue)",minWidth:34}}>{p}%</span>
            <span style={{fontSize:12,color:"var(--ink4)"}}>{done}/{leaves.length}</span>
          </div>
        )}
      </div>

      {/* Breadcrumb trail when zoomed in */}
      {focusId&&trail.length>0&&(
        <div className="zoom-trail">
          <button className="zoom-crumb root-crumb" onClick={doZoomRoot}>Goal</button>
          {trail.slice(0,-1).map((n,i)=>(
            <span key={n.id} style={{display:"flex",alignItems:"center",gap:4}}>
              <span className="zoom-sep">›</span>
              <button className="zoom-crumb" onClick={()=>doZoomOut(n.id===root.id?null:n.id)}>
                {n.title.length>18?n.title.slice(0,18)+"…":n.title}
              </button>
            </span>
          ))}
          <span className="zoom-sep">›</span>
          <span className="zoom-current">
            {viewRoot.title.length>20?viewRoot.title.slice(0,20)+"…":viewRoot.title}
          </span>
        </div>
      )}

      {/* Focused scope banner */}
      {focusId&&(
        <div className="zoom-banner">
          <div>
            <div className="zoom-banner-text">⤢ Focused on: {viewRoot?.title}</div>
            {focusLeaves.length>0&&<div className="zoom-banner-count">{focusDone}/{focusLeaves.length} steps in this section</div>}
          </div>
          <button className="zoom-exit" onClick={doZoomRoot}>Exit Focus</button>
        </div>
      )}

      <div style={{height:12}}/>

      {/* Steps — filtered to current scope */}
      <div className={`steps ${zoomAnim}`} onAnimationEnd={()=>setZoomAnim("")}>
        {ch(nodes,viewRoot.id).sort((a,b)=>a.ts-b.ts).map(k=>(
          <Step key={k.id} node={k} nodes={nodes} goalId={goalId} depth={0}
            onUpdate={upd} onDelete={del} onAdd={add}
            onMove={(id,dir)=>{setDb(d=>{const n={...d,nodes:moveNode(d.nodes,id,dir)};save(n);return n;});}}
            onZoom={doZoom}
          />
        ))}
        {adding?(
          <div className="add-step-btn">
            <div className="add-step-icon">+</div>
            <input ref={addRef} className="add-step-input" value={txt}
              onChange={e=>setTxt(e.target.value)}
              placeholder={focusId?"New step here…":"New step…"}
              onKeyDown={e=>{if(e.key==="Enter")submitAdd();if(e.key==="Escape"){setAdding(false);setTxt("");}}}
              autoFocus/>
            {txt.trim()&&<button className="pill pill-blue" style={{flexShrink:0}} onClick={submitAdd}>Add</button>}
          </div>
        ):(
          <button className="add-step-btn" onClick={()=>{setAdding(true);setTxt("");}}>
            <div className="add-step-icon">+</div>
            <span style={{fontSize:15,color:"var(--ink4)"}}>Add step…</span>
          </button>
        )}
      </div>
      <div style={{height:32}}/>
    </div>
  );
}

/* ════════════════════════════ GOALS TAB ════════════════════════ */
function GoalsTab({db,setDb,onOpen,making,setMaking,onCreate}){
  const [txt,setTxt]=useState("");
  const goals=db.goals||[];

  const create=()=>{
    if(!txt.trim())return;
    const gid=uid();
    const root={id:uid(),parentId:null,goalId:gid,title:txt.trim(),done:false,note:"",ts:Date.now(),updatedAt:Date.now()};
    setDb(d=>{const n={...d,goals:[...d.goals,{id:gid,title:txt.trim(),ts:Date.now()}],nodes:[...d.nodes,root]};save(n);return n;});
    setTxt("");setMaking(false);if(onCreate)onCreate(gid);else onOpen(gid);
  };

  const del=(id,e)=>{e.stopPropagation();if(!window.confirm("Delete goal?"))return;setDb(d=>{const n={...d,goals:d.goals.filter(g=>g.id!==id),nodes:d.nodes.filter(x=>x.goalId!==id)};save(n);return n;});};

  return(
    <div className="scroll">
      <div style={{height:8}}/>
        {making&&(
          <div style={{padding:"12px 16px"}} className="up">
            <div className={`capture focused`}>
              <input value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&create()}
                placeholder="What do you want to achieve?" autoFocus
                style={{width:"100%",border:"none",outline:"none",fontSize:16,fontFamily:"inherit",color:"var(--ink)",background:"transparent"}}/>
            </div>
            <div style={{marginTop:10}}><button className="btn btn-blue btn-block" onClick={create} disabled={!txt.trim()}>Create Goal →</button></div>
          </div>
        )}

        {goals.length===0&&!making&&(
          <div style={{padding:"60px 24px",textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:16}}>🎯</div>
            <div style={{fontSize:20,fontWeight:700,color:"var(--ink)",letterSpacing:"-.4px",marginBottom:8}}>No goals yet</div>
            <div style={{fontSize:15,color:"var(--ink4)",lineHeight:1.6}}>Tap <strong>＋</strong> to add your first goal<br/>or turn a Brain Dump into one.</div>
          </div>
        )}

        {goals.length>0&&<div style={{height:16}}/>}
        {goals.map(g=>{
          const ns=db.nodes.filter(n=>n.goalId===g.id);
          const p=pct(ns,g.id);const h=hlth(ns,g.id);
          const leaves=ns.filter(n=>ch(ns,n.id).length===0&&n.parentId);
          const done=leaves.filter(n=>n.done).length;
          const complete=p===100&&leaves.length>0;
          return(
            <div key={g.id} className="gcard up" onClick={()=>onOpen(g.id)}>
              <div className="gcard-title">{g.title}</div>
              <div className="gcard-progress">
                <div className="gcard-track"><div className="gcard-fill" style={{width:p+"%",background:complete?"var(--green)":"var(--blue)"}}/></div>
                <span className="gcard-pct" style={{color:complete?"var(--green)":"var(--blue)"}}>{p}%</span>
              </div>
              <div className="gcard-footer">
                <span className="gcard-meta">{leaves.length?`${done} of ${leaves.length} steps`:"No steps yet"}</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span className="health-tag" style={{background:h.bg,color:h.c}}>{h.e} {h.l}</span>
                  <button className="btn-red-ghost" style={{padding:"3px 6px",fontSize:13}} onClick={e=>del(g.id,e)}>✕</button>
                </div>
              </div>
              <div style={{fontSize:12,color:"var(--ink4)",marginTop:6}}>Last activity: {dAgo(h.d)}</div>
            </div>
          );
        })}
        <div style={{height:16}}/>
    </div>
  );
}

/* ════════════════════════════ DUMP TAB ═════════════════════════ */
function DumpTab({db,setDb,onMakeGoal}){
  const [txt,setTxt]=useState("");
  const [foc,setFoc]=useState(false);
  const dumps=db.dumps||[];
  const ago=ts=>{const s=Date.now()-ts;if(s<60000)return"just now";if(s<3600000)return~~(s/60000)+"m ago";if(s<86400000)return~~(s/3600000)+"h ago";return~~(s/86400000)+"d ago";};

  const capture=()=>{
    if(!txt.trim())return;
    const item={id:uid(),text:txt.trim(),ts:Date.now(),promoted:false};
    setDb(d=>{const n={...d,dumps:[item,...(d.dumps||[])]};save(n);return n;});
    setTxt("");
  };
  const promote=dump=>{const id=onMakeGoal(dump.text);if(id)setDb(d=>{const n={...d,dumps:d.dumps.map(x=>x.id===dump.id?{...x,promoted:true}:x)};save(n);return n;});};
  const del=id=>setDb(d=>{const n={...d,dumps:d.dumps.filter(x=>x.id!==id)};save(n);return n;});
  const unpromoted=dumps.filter(d=>!d.promoted);
  const promoted=dumps.filter(d=>d.promoted);

  return(
    <div className="scroll">
        <div style={{padding:"12px 16px 0"}}>
          <div className={`capture${foc?" focused":""}`}>
            <textarea value={txt} onChange={e=>setTxt(e.target.value)}
              onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();capture();}}}
              placeholder="What's on your mind? Just write…" rows={3} autoFocus/>
            <div className="capture-footer">
              <span className="capture-hint">{txt.trim()?"↵ Enter to save":"Type freely"}</span>
              <button className="btn btn-blue btn-sm" onClick={capture} disabled={!txt.trim()}>Save</button>
            </div>
          </div>
        </div>

        {unpromoted.length===0&&promoted.length===0&&(
          <div style={{padding:"48px 24px",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:14}}>💭</div>
            <div style={{fontSize:19,fontWeight:700,color:"var(--ink)",letterSpacing:"-.3px",marginBottom:8}}>Empty your mind</div>
            <div style={{fontSize:15,color:"var(--ink4)",lineHeight:1.6}}>Write anything — ideas, worries,<br/>plans. No structure needed.</div>
          </div>
        )}

        {unpromoted.length>0&&<div style={{height:14}}/>}
        {unpromoted.map(d=>(
          <div key={d.id} className="dump-card up">
            <div className="dump-text">{d.text}</div>
            <div className="dump-footer">
              <span className="dump-time">{ago(d.ts)}</span>
              <div className="btn-row">
                <button className="pill pill-blue" onClick={()=>promote(d)}>→ Goal</button>
                <button className="pill pill-gray" onClick={()=>del(d.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {promoted.length>0&&(
          <div style={{padding:"0 16px"}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--ink4)",textTransform:"uppercase",letterSpacing:".5px",margin:"16px 0 10px"}}>Converted</div>
            {promoted.map(d=>(
              <div key={d.id} className="dump-card" style={{opacity:.4}}>
                <div className="dump-text" style={{fontSize:14}}>{d.text}</div>
                <div className="dump-footer"><span className="dump-time">{ago(d.ts)}</span><span style={{fontSize:12,fontWeight:600,color:"var(--green)"}}>✓ Goal created</span></div>
              </div>
            ))}
          </div>
        )}
        <div style={{height:16}}/>
    </div>
  );
}

/* ════════════════════════════ TODAY TAB ════════════════════════ */
function TodayTab({db,setDb,onOpen}){
  const nodes=db.nodes||[];const goals=db.goals||[];
  const foc=nodes.filter(n=>n.inFocus&&ch(nodes,n.id).length===0&&!n.done);
  const dueTodayAuto=nodes.filter(n=>{
    if(!n.due||n.done||n.inFocus||ch(nodes,n.id).length>0)return false;
    const df=dueFmt(n.due);
    return df&&(df.cls==="today"||df.cls==="overdue");
  });
  const doneFoc=nodes.filter(n=>n.inFocus&&n.done&&ch(nodes,n.id).length===0);
  const toggle=id=>setDb(d=>{const n={...d,nodes:d.nodes.map(x=>x.id===id?{...x,done:!x.done,updatedAt:Date.now()}:x)};save(n);return n;});
  const unstar=id=>setDb(d=>{const n={...d,nodes:d.nodes.map(x=>x.id===id?{...x,inFocus:false}:x)};save(n);return n;});
  const star=id=>setDb(d=>{const n={...d,nodes:d.nodes.map(x=>x.id===id?{...x,inFocus:true}:x)};save(n);return n;});
  const gName=gid=>goals.find(g=>g.id===gid)?.title||"";
  const sugg=nodes.filter(n=>ch(nodes,n.id).length===0&&n.parentId&&!n.done&&!n.inFocus).slice(0,5);
  const total=foc.length+doneFoc.length;
  const prog=total?Math.round(doneFoc.length/total*100):0;
  const hr=new Date().getHours();

  return(
    <div className="scroll">
        <div className="today-hero">
          <div style={{fontSize:13,fontWeight:500,opacity:.75,marginBottom:4}}>{hr<12?"Morning":"Afternoon"} focus</div>
          <div style={{fontSize:22,fontWeight:700,letterSpacing:"-.4px",marginBottom:total?14:0,lineHeight:1.2}}>
            {total===0?"Nothing planned yet.":doneFoc.length===total?"All done! 🎉":`${foc.length} task${foc.length!==1?"s":""} remaining`}
          </div>
          {total>0&&<>
            <div style={{height:5,background:"rgba(255,255,255,.2)",borderRadius:9,overflow:"hidden"}}><div style={{height:"100%",background:"#fff",borderRadius:9,width:prog+"%",transition:"width .4s"}}/></div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.65)",marginTop:6}}>{doneFoc.length} of {total} done · {prog}%</div>
          </>}
        </div>

        {foc.length===0&&doneFoc.length===0&&(
          <div style={{padding:"32px 24px",textAlign:"center"}}>
            <div style={{fontSize:14,color:"var(--ink4)",lineHeight:1.7}}>Tap a step inside a goal<br/>to add it to today's list.</div>
          </div>
        )}

        {(foc.length>0||doneFoc.length>0)&&(
          <div style={{margin:"16px 16px 0"}}>
            <div className="list" style={{margin:0}}>
              {foc.map(t=>(
                <div key={t.id} className="today-task">
                  <div className="today-check" onClick={()=>toggle(t.id)}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:500,color:"var(--ink)"}}>{t.title}</div>
                    <div style={{fontSize:12,color:"var(--ink4)",marginTop:2}}>{gName(t.goalId)}</div>
                  </div>
                  <button style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"var(--ink4)",padding:4}} onClick={()=>unstar(t.id)}>✕</button>
                </div>
              ))}
              {doneFoc.map(t=>(
                <div key={t.id} className="today-task" style={{opacity:.4}}>
                  <div className="today-check on"/>
                  <div style={{fontSize:15,fontWeight:500,color:"var(--ink4)",textDecoration:"line-through",flex:1}}>{t.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sugg.length>0&&foc.length<5&&(
          <div style={{margin:"20px 16px 0"}}>
            <div className="section-label" style={{padding:"0 0 8px",fontSize:12}}>From your plans</div>
            <div className="list" style={{margin:0}}>
              {sugg.map(t=>(
                <div key={t.id} className="list-item">
                  <div className="list-body"><div className="list-title">{t.title}</div><div className="list-sub">{gName(t.goalId)}</div></div>
                  <button className="pill pill-blue" style={{flexShrink:0}} onClick={()=>star(t.id)}>+ Today</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {dueTodayAuto.length>0&&(
          <div style={{margin:"20px 16px 0"}}>
            <div className="section-label" style={{padding:"0 0 8px",fontSize:12,color:"var(--red)"}}>⚠ Overdue / Due Today</div>
            <div className="list" style={{margin:0}}>
              {dueTodayAuto.map(t=>{
                const df=dueFmt(t.due);
                return(
                  <div key={t.id} className="list-item">
                    <div className="list-body">
                      <div className="list-title">{t.title}</div>
                      <div style={{fontSize:12,marginTop:3,display:"flex",gap:8}}>
                        <span style={{color:"var(--ink4)"}}>{gName(t.goalId)}</span>
                        {df&&<span className={`due-date ${df.cls}`} style={{marginTop:0}}>📅 {df.label}</span>}
                      </div>
                    </div>
                    <button className="pill pill-blue" style={{flexShrink:0}} onClick={()=>star(t.id)}>+ Today</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div style={{height:16}}/>
    </div>
  );
}

/* ════════════════════════════ DASH TAB ═════════════════════════ */
function DashTab({db,onOpen}){
  const goals=db.goals||[];const nodes=db.nodes||[];const dumps=db.dumps||[];
  const leaves=nodes.filter(n=>ch(nodes,n.id).length===0&&n.parentId);
  const done=leaves.filter(n=>n.done).length;
  const open=leaves.filter(n=>!n.done).length;
  const focN=nodes.filter(n=>n.inFocus&&!n.done&&ch(nodes,n.id).length===0).length;
  const hr=new Date().getHours();
  const greet=hr<5?"Still up?":hr<12?"Good morning,":hr<17?"Good afternoon,":"Good evening,";
  const dormant=goals.filter(g=>hlth(nodes,g.id).l==="Dormant"&&hlth(nodes,g.id).d!==null);

  return(
    <div className="scroll">
        <div className="hero">
          <div className="hero-greet">{greet}</div>
          <div className="hero-line">Never let an idea die.</div>
          <div className="hero-stats">
            <div><div className="hero-stat-n">{goals.length}</div><div className="hero-stat-l">Goals</div></div>
            <div><div className="hero-stat-n">{done}</div><div className="hero-stat-l">Done</div></div>
            <div><div className="hero-stat-n">{focN}</div><div className="hero-stat-l">Focus</div></div>
          </div>
        </div>

        <div className="stat-grid mt">
          <div className="stat"><div className="stat-n" style={{color:"var(--blue)"}}>{goals.length}</div><div className="stat-l">Active Goals</div></div>
          <div className="stat"><div className="stat-n" style={{color:"var(--green)"}}>{done}</div><div className="stat-l">Steps Done</div></div>
          <div className="stat"><div className="stat-n" style={{color:"var(--ink3)"}}>{open}</div><div className="stat-l">Remaining</div></div>
          <div className="stat"><div className="stat-n" style={{color:"var(--amber)"}}>{focN}</div><div className="stat-l">In Focus</div></div>
        </div>

        {goals.length>0&&(
          <>
            <div className="section-head"><span className="section-label">Goals</span></div>
            <div className="list">
              {goals.map(g=>{
                const ns=nodes.filter(n=>n.goalId===g.id);const p=pct(ns,g.id);
                return(
                  <div key={g.id} className="list-item" style={{cursor:"pointer"}} onClick={()=>onOpen(g.id)}>
                    <div className="list-body">
                      <div className="list-title">{g.title}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:5}}>
                        <div style={{flex:1,height:4,background:"var(--bg2)",borderRadius:9,overflow:"hidden"}}>
                          <div style={{height:"100%",width:p+"%",background:p===100?"var(--green)":"var(--blue)",borderRadius:9,transition:"width .5s"}}/>
                        </div>
                        <span style={{fontSize:12,fontWeight:700,color:p===100?"var(--green)":"var(--blue)",minWidth:28}}>{p}%</span>
                      </div>
                    </div>
                    <span className="chevron">›</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {dormant.length>0&&(
          <>
            <div className="section-head"><span className="section-label">❄️ Needs Attention</span></div>
            <div className="list">
              {dormant.map(g=>{
                const h=hlth(nodes,g.id);
                return(
                  <div key={g.id} className="list-item" style={{cursor:"pointer"}} onClick={()=>onOpen(g.id)}>
                    <div className="list-icon" style={{background:"#f1f5f9",fontSize:18}}>❄️</div>
                    <div className="list-body"><div className="list-title">{g.title}</div><div className="list-sub">Last active: {dAgo(h.d)}</div></div>
                    <span className="chevron">›</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {dumps.filter(d=>!d.promoted).length>0&&(
          <>
            <div className="section-head"><span className="section-label">Brain Dump</span></div>
            <div className="list">
              <div className="list-item">
                <div className="list-icon" style={{background:"#f5f3ff",fontSize:18}}>💭</div>
                <div className="list-body">
                  <div className="list-title">{dumps.filter(d=>!d.promoted).length} ideas waiting</div>
                  <div className="list-sub">Turn them into goals</div>
                </div>
                <span className="chevron">›</span>
              </div>
            </div>
          </>
        )}

        {goals.length===0&&(
          <div style={{padding:"40px 24px",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:14}}>🌱</div>
            <div style={{fontSize:19,fontWeight:700,color:"var(--ink)",letterSpacing:"-.3px",marginBottom:8}}>Nothing here yet</div>
            <div style={{fontSize:15,color:"var(--ink4)",lineHeight:1.6}}>Create your first goal to get started.</div>
          </div>
        )}
        <div style={{height:16}}/>
    </div>
  );
}

/* ════════════════════════════ SETTINGS ═════════════════════════ */
function Settings({onClose,onGoals,onSetPin,onRemovePin,hasPin}){
  return(
    <div className="overlay fade" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="sheet-title">Settings</div>
        <div className="sheet-row" style={{cursor:"pointer"}} onClick={()=>{onGoals();onClose();}}>
          <div><div className="sheet-row-label">🎯  Goals</div><div className="sheet-row-sub">Jump to your goals</div></div>
          <span className="chevron">›</span>
        </div>
        <div className="sheet-row">
          <div><div className="sheet-row-label">🔒  PIN Lock</div><div className="sheet-row-sub">{hasPin?"Enabled":"Not set"}</div></div>
          <div style={{display:"flex",gap:8}}>
            {hasPin&&<button className="btn btn-red-ghost" onClick={()=>{onRemovePin();onClose();}}>Remove</button>}
            <button className="btn btn-ghost" onClick={()=>{onSetPin();onClose();}}>{hasPin?"Change":"Set PIN"}</button>
          </div>
        </div>
        <div className="sheet-row">
          <div className="sheet-row-label" style={{color:"var(--ink4)"}}>Version</div>
          <div style={{fontSize:14,color:"var(--ink4)"}}>Mind OS 1.0</div>
        </div>
        <button className="btn btn-ghost btn-block mt2" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* ════════════════════════════ SEARCH ══════════════════════════ */
function SearchTab({db,onOpen}){
  const [q,setQ]=useState("");
  const [foc,setFoc]=useState(false);
  const ref=useRef(null);
  const nodes=db.nodes||[];const goals=db.goals||[];

  const results=q.trim().length<2?[]:nodes.filter(n=>{
    if(!n.title||n.type==="root"||!n.parentId)return false;
    return n.title.toLowerCase().includes(q.toLowerCase());
  }).slice(0,40);

  const highlight=(text,q)=>{
    if(!q.trim())return text;
    const idx=text.toLowerCase().indexOf(q.toLowerCase());
    if(idx===-1)return text;
    return <>{text.slice(0,idx)}<span className="search-highlight">{text.slice(idx,idx+q.length)}</span>{text.slice(idx+q.length)}</>;
  };

  const goalOf=gid=>goals.find(g=>g.id===gid);
  const pathOf=id=>ancs(nodes,id).filter(n=>n.parentId).map(n=>n.title).join(" › ");

  return(
    <div className="scroll">
      <div className={`search-bar${foc?" focused":""}`}>
        <span className="search-icon">🔍</span>
        <input ref={ref} className="search-input" value={q} onChange={e=>setQ(e.target.value)}
          onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
          placeholder="Search steps across all goals…" autoFocus/>
        {q&&<button className="search-clear" onClick={()=>{setQ("");ref.current?.focus();}}>✕</button>}
      </div>

      {q.trim().length<2&&(
        <div className="search-empty">
          <div style={{fontSize:36,marginBottom:12}}>🔍</div>
          <div style={{fontWeight:600,color:"var(--ink)",marginBottom:6}}>Search your plans</div>
          <div style={{fontSize:14}}>Type at least 2 characters to search steps across all goals.</div>
        </div>
      )}

      {q.trim().length>=2&&results.length===0&&(
        <div className="search-empty">No steps found for "<strong>{q}</strong>"</div>
      )}

      {results.length>0&&(
        <div style={{background:"var(--white)",borderRadius:"var(--r12)",margin:"8px 16px",border:"1px solid var(--line)",overflow:"hidden"}}>
          {results.map(n=>{
            const g=goalOf(n.goalId);const path=pathOf(n.id);
            return(
              <div key={n.id} className="search-result" onClick={()=>g&&onOpen(n.goalId)}>
                <div className={`step-check${n.done?" on":""}`} style={{marginTop:2,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,color:n.done?"var(--ink4)":"var(--ink)",textDecoration:n.done?"line-through":"none",lineHeight:1.35}}>
                    {highlight(n.title,q)}
                  </div>
                  <div style={{fontSize:12,color:"var(--ink4)",marginTop:3}}>
                    {g?.title}{path&&<span> › {path}</span>}
                  </div>
                  {n.due&&!n.done&&(()=>{const df=dueFmt(n.due);return df?<div className={`due-date ${df.cls}`}>📅 {df.label}</div>:null;})()}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{height:16}}/>
    </div>
  );
}

/* ════════════════════════════ ROOT ═════════════════════════════ */

const TAB_META = {
  dash:   { title:"Home",       right:"settings" },
  dump:   { title:"Brain Dump", right:null        },
  goals:  { title:"Goals",      right:"add"       },
  today:  { title:"Today",      right:null        },
  search: { title:"Search",     right:null        },
};

function App(){
  const [db,setDb_]      = useState(load);
  const [hasPin,setHasPin] = useState(()=>!!localStorage.getItem("mindos_pin"));
  const [screen,setScreen] = useState(()=>localStorage.getItem("mindos_pin")?"pin":"welcome");
  const [tab,setTab]       = useState("dash");
  const [goalId,setGoalId] = useState(null);
  const [showSettings,setShowSettings] = useState(false);
  const [pinSetup,setPinSetup]         = useState(false);
  const [making,setMaking]             = useState(false);
  const [time,setTime] = useState(()=>new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));

  useEffect(()=>{
    const t=setInterval(()=>setTime(new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})),30000);
    return ()=>clearInterval(t);
  },[]);

  const setDb=useCallback(d=>{
    if(typeof d==="function"){setDb_(p=>{const r=d(p);save(r);return r;});}
    else{setDb_(d);save(d);}
  },[]);

  const createGoal=useCallback(title=>{
    if(!title?.trim())return null;
    const gid=uid();
    const root={id:uid(),parentId:null,goalId:gid,title:title.trim(),done:false,note:"",ts:Date.now(),updatedAt:Date.now()};
    setDb_(p=>{const n={...p,goals:[...p.goals,{id:gid,title:title.trim(),ts:Date.now()}],nodes:[...p.nodes,root]};save(n);return n;});
    return gid;
  },[]);

  const openGoal=id=>{setGoalId(id);setTab("goal");setMaking(false);};
  const goGoals =()=>{setGoalId(null);setTab("goals");setMaking(false);};

  const TABS=[
    {id:"dash",   ic:"🏠", label:"Home"},
    {id:"dump",   ic:"💭", label:"Dump"},
    {id:"goals",  ic:"🎯", label:"Goals"},
    {id:"today",  ic:"☀️", label:"Today"},
    {id:"search", ic:"🔍", label:"Search"},
  ];
  const dumpBadge=(db.dumps||[]).filter(d=>!d.promoted).length;
  const isGoal = tab==="goal"&&goalId;
  const meta = TAB_META[tab]||{title:"",right:null};

  /* ── screens that take over full display ── */
  if(screen==="pin") return(
    <><style>{F}{S}</style><Pin mode="unlock" onDone={()=>setScreen("welcome")}/></>
  );
  if(pinSetup) return(
    <><style>{F}{S}</style><Pin mode="setup" onDone={()=>{setHasPin(true);setPinSetup(false);}} onSkip={()=>setPinSetup(false)}/></>
  );
  if(screen==="welcome") return(
    <><style>{F}{S}</style>
      <Welcome
        onCapture={text=>{
          const item={id:uid(),text:text.trim(),ts:Date.now(),promoted:false};
          setDb_(p=>{const n={...p,dumps:[item,...(p.dumps||[])]};save(n);return n;});
          setScreen("app");setTab("dump");
        }}
        onGoToApp={()=>{setScreen("app");setTab("goals");}}
      />
    </>
  );

  /* ── main app shell ── */
  return(
    <>
      <style>{F}{S}</style>
      <div className="app">

        {/* Status bar */}
        <div className="status-bar">
          <span className="status-time">{time}</span>
          <span className="status-icons">●●● 5G 🔋</span>
        </div>

        {/* Nav bar */}
        <div className="nav">
          <div className="nav-side">
            {isGoal
              ? <button className="nav-back" onClick={()=>{setGoalId(null);setTab("goals");}}>
                  <span className="nav-back-arrow">‹</span> Goals
                </button>
              : <div style={{width:72}}/>
            }
          </div>
          <div className="nav-title">
            {isGoal ? (db.goals.find(g=>g.id===goalId)?.title||"Goal") : meta.title}
          </div>
          <div className="nav-side right">
            {isGoal && null}
            {!isGoal && meta.right==="settings" &&
              <button className="nav-action icon" onClick={()=>setShowSettings(true)}>⚙️</button>}
            {!isGoal && meta.right==="add" &&
              <button className="nav-action" onClick={()=>setMaking(m=>!m)}>{making?"Done":"＋"}</button>}
          </div>
        </div>

        {/* Page content */}
        {isGoal
          ? <GoalDetail db={db} setDb={setDb} goalId={goalId} onBack={()=>{setGoalId(null);setTab("goals");}}/>
          : <>
              {tab==="dash"  && <DashTab  db={db} onOpen={openGoal}/>}
              {tab==="dump"  && <DumpTab  db={db} setDb={setDb} onMakeGoal={t=>{const id=createGoal(t);if(id)openGoal(id);return id;}}/>}
              {tab==="goals" && <GoalsTab db={db} setDb={setDb} onOpen={openGoal} making={making} setMaking={setMaking} onCreate={id=>openGoal(id)}/>}
              {tab==="today"  && <TodayTab  db={db} setDb={setDb} onOpen={openGoal}/>}
              {tab==="search" && <SearchTab db={db} onOpen={openGoal}/>}
            </>
        }

        {/* Tab bar — hidden in goal detail */}
        {!isGoal && (
          <div className="tabbar">
            {TABS.map(t=>(
              <button key={t.id} className={`tab${tab===t.id?" active":""}`}
                onClick={()=>{setGoalId(null);setTab(t.id);setMaking(false);}}>
                <div className="tab-icon">
                  {t.ic}
                  {t.id==="dump"&&dumpBadge>0&&<span className="badge">{dumpBadge}</span>}
                </div>
                <span className="tab-label">{t.label}</span>
              </button>
            ))}
          </div>
        )}

      </div>

      {/* Settings sheet */}
      {showSettings&&(
        <Settings hasPin={hasPin} onClose={()=>setShowSettings(false)}
          onGoals={()=>{goGoals();setShowSettings(false);}}
          onSetPin={()=>{setPinSetup(true);setShowSettings(false);}}
          onRemovePin={()=>{localStorage.removeItem("mindos_pin");setHasPin(false);}}/>
      )}
    </>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
