#!/usr/bin/env node
// Baut campaign/dist/preview/index.html: eine eigenständige Testfassung der Kampagne zum Durchspielen im Browser.
// Sie bettet den ECHTEN Szenen-Interpreter aus public/app-campaign.jsx und die kompilierten Szenen ein
// (kein eval). Hintergründe werden relativ als assets/bg/<name>.png geladen, wenn vorhanden.
// Duelle sind hier Platzhalter (Sieg/Niederlage wählen); gespielt wird sonst genau wie in der Engine.
//
//   node campaign/tools/build.js && node campaign/tools/preview.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const jsx = fs.readFileSync(path.join(ROOT, '..', 'public', 'app-campaign.jsx'), 'utf8');
function grab(name) {
  const i = jsx.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('Engine-Funktion fehlt: ' + name);
  let depth = 0;
  for (let k = jsx.indexOf('{', i); k < jsx.length; k++) { if (jsx[k] === '{') depth++; else if (jsx[k] === '}' && !--depth) return jsx.slice(i, k + 1); }
  throw new Error('unbalanciert: ' + name);
}
const engine = ['cmpTime', 'cmpFmtTime', 'cmpDaypart', 'cmpCond', 'cmpFindLabel', 'cmpMakeRunner', 'cmpTravelCost'].map(grab).join('\n');
const dir = path.join(ROOT, 'dist', 'scenes');
const sceneScripts = fs.readdirSync(dir).sort().map(f => `<script>/* ${f} */\n(function(world,scene){${fs.readFileSync(path.join(dir, f), 'utf8')}\n})(defineWorld,defineScene);</script>`).join('\n');

const css = `
:root{--bg:#0d0b14;--panel:#1a1626;--panel2:#262038;--edge:#4a3f6b;--text:#ece6f5;--dim:#a79fc0;--gold:#e8c170;--cyan:#7fd6e8;--red:#d9576b;--green:#7fc98f;--title:"Pixelify Sans","Courier New",monospace;--body:"VT323","Courier New",monospace;color-scheme:dark}
*{box-sizing:border-box}
[hidden]{display:none!important}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--body);font-size:21px;line-height:1.25;padding-block:0;padding-left:max(12px,env(safe-area-inset-left,0px));padding-right:max(12px,env(safe-area-inset-right,0px))}
button{font:inherit;color:var(--text);background:var(--panel2);border:2px solid var(--edge);padding:4px 12px;cursor:pointer;box-shadow:0 3px 0 #000;text-align:left}
button:hover:not(:disabled),button:focus-visible{border-color:var(--gold);outline:none}
button:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 #000}
button:disabled{opacity:.45;cursor:not-allowed}
#app{max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:10px;padding-block:10px 24px;min-height:100%}
#top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-bottom:2px solid var(--edge);padding-bottom:8px}
#clock{font-family:var(--title);color:var(--gold);font-size:17px;flex:1 1 220px;min-width:0}
#where{font-family:var(--title);color:var(--cyan);font-size:15px}
#top .sm{font-family:var(--title);font-size:13px;padding:2px 8px}
#stage{position:relative;width:100%;aspect-ratio:16/9;max-height:56vh;background:#000 center/cover no-repeat;border:2px solid var(--edge);image-rendering:pixelated;overflow:hidden}
#stage::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(#0000 0 3px,#0000000d 3px 4px);pointer-events:none}
#actors{position:absolute;left:8px;right:8px;bottom:8px;display:flex;flex-wrap:wrap;gap:6px;z-index:1}
.chip{font-family:var(--title);font-size:13px;background:#08060dcc;border:2px solid var(--cyan);color:var(--cyan);padding:0 6px}
#bglabel{position:absolute;top:6px;left:8px;font-family:var(--title);font-size:12px;background:#08060dcc;color:var(--dim);padding:0 6px;z-index:1}
#box{position:relative;background:var(--panel);border:2px solid var(--edge);border-top:3px solid var(--gold);padding:14px 16px 12px;min-height:150px;display:flex;flex-direction:column;gap:8px;cursor:pointer}
#spk{align-self:flex-start;font-family:var(--title);font-size:16px;background:var(--gold);color:#1a1626;padding:0 10px;margin-top:-28px;box-shadow:3px 3px 0 #000}
#txt{font-size:25px;white-space:pre-wrap;min-height:2.4em;overflow-wrap:anywhere}
#txt.think{color:var(--dim);font-style:italic}
#txt em{color:var(--gold);font-style:italic}
#more{position:absolute;right:12px;bottom:6px;color:var(--gold);animation:bl 1s steps(1) infinite}
@keyframes bl{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){#more{animation:none}}
#choices{display:flex;flex-direction:column;gap:6px}
#choices small{color:var(--dim);font-family:var(--title);font-size:12px;margin-left:8px}
#prompt{color:var(--cyan)}
#explore{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}
#explore section{background:var(--panel);border:2px solid var(--edge);padding:8px 10px;min-width:0}
#explore h3{font-family:var(--title);font-size:13px;letter-spacing:.1em;color:var(--gold);margin:0 0 6px;font-weight:400}
#explore .list{display:flex;flex-direction:column;gap:5px}
#explore small{color:var(--dim)}
.note{color:var(--dim);font-size:17px}
#overlay{position:fixed;inset:0;background:#000d;display:grid;place-items:center;padding:16px;z-index:50}
#overlay>div{max-width:560px;width:100%;background:var(--panel);border:3px solid var(--gold);padding:16px;max-height:90vh;overflow:auto}
#overlay h2{font-family:var(--title);color:var(--gold);margin:0 0 8px;font-size:20px}
#overlay pre{white-space:pre-wrap;font-family:var(--body);font-size:18px;margin:0 0 10px}
`;

const ui = String.raw`
const $ = (id) => document.getElementById(id);
const KEY = 'ppcampaign_preview_v1';
const W = STORY.world;
const WEEK = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
let S = null, busy = false, waiter = null, actors = [], bg = null, log = [];
const esc = (t) => String(t).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
function newState(){const st=W.start,known=[];for(const[id,l]of Object.entries(W.locations))if(l.known)known.push(id);if(known.indexOf(st.location)<0)known.push(st.location);return{v:1,day:st.day,minutes:cmpTime(st.time,480),location:st.location,flags:{},vars:{},items:{},coins:st.coins||0,known,locked:{},visited:{},scenesDone:{},eventsDone:{},duels:{},collection:{}};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function load(){try{const r=localStorage.getItem(KEY);if(r){const s=JSON.parse(r);if(s&&s.v===1)return s;}}catch(e){}return null;}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const mutate = (fn) => { fn(S); save(); renderTop(); };
function renderTop(){
  const loc = W.locations[S.location] || {};
  $('clock').textContent = 'Day ' + S.day + ' · ' + WEEK[(S.day-1)%7] + ' · ' + cmpFmtTime(S.minutes) + ' · ' + S.coins + ' cr';
  $('where').textContent = loc.name || S.location;
}
function setBg(name){ bg = name; const el = $('stage'); if(!name){el.style.backgroundImage='none';return;} el.style.backgroundImage='url("assets/bg/'+name+'.png")'; $('bglabel').textContent = name; }
function renderActors(){ $('actors').innerHTML = actors.map(a => '<span class="chip">'+esc(a)+'</span>').join(''); }
function castName(id){ const c = W.cast[id]; return c ? c.name : id; }
function say(l){
  return new Promise(res => {
    $('choices').innerHTML='';
    const sp = l.speaker || (l.speaker===undefined && l.think ? 'Rowan' : null);
    const name = l.name || (l.speaker ? castName(l.speaker) : null);
    $('spk').hidden = !name && !l.think; $('spk').textContent = name || 'Rowan';
    $('txt').className = l.think ? 'think' : ''; $('txt').innerHTML = md(l.text);
    $('more').hidden = false; log.push((name||'')+': '+l.text);
    waiter = () => { $('more').hidden = true; res(); };
  });
}
function choose(c){
  return new Promise(res => {
    const box = $('choices'); box.innerHTML = '';
    if (c.prompt) { $('spk').hidden = true; $('txt').className=''; $('txt').innerHTML = '<span id="prompt">'+md(c.prompt)+'</span>'; }
    c.options.forEach((o, i) => { const b = document.createElement('button'); b.innerHTML = md(o.text) + (o.hint ? '<small>'+esc(o.hint)+'</small>' : ''); b.onclick = (e) => { e.stopPropagation(); box.innerHTML=''; res(i); }; box.appendChild(b); });
    $('more').hidden = true;
  });
}
function addTime(m){ if(!m)return; mutate(s=>{s.minutes+=m;while(s.minutes>=1440){s.minutes-=1440;s.day++;}}); }
const io = {
  state: () => S, mutate, sleep, say, choose, addTime,
  setBg, clearActors(){actors=[];renderActors();},
  enter(id){const n=castName(id);if(actors.indexOf(n)<0)actors.push(n);renderActors();},
  exit(id){const n=castName(id);actors=actors.filter(a=>a!==n);renderActors();},
  move(){}, face(){}, dim(){}, music(){}, fx: async () => {}, revealCards: async () => {},
  applyReward: async (r) => { mutate(s=>{ if(r.coins) s.coins=Math.max(0,s.coins+r.coins); for(const f of r.flags||[]) s.flags[f]=true; }); },
  duel: (step) => new Promise(res => {
    $('spk').hidden=false; $('spk').textContent='DUEL';
    $('txt').className=''; $('txt').innerHTML='Duel vs. <strong>'+esc(step.opponentName||step.opponent)+'</strong>'+(step.ante?' (ante)':'')+'. <span class="note">Preview build: the real game plays this out. Pick the result to test the branches.</span>';
    const box=$('choices'); box.innerHTML='';
    [['I win',true],['I lose',false]].forEach(([t,v])=>{const b=document.createElement('button');b.textContent=t;b.onclick=(e)=>{e.stopPropagation();box.innerHTML='';res(v);};box.appendChild(b);});
    $('more').hidden=true;
  }),
  deckEdit: async () => {},
  gameOver: async (t) => { await new Promise(res => { showOverlay('The end of this build', t || '', res); }); },
  playScene: (id, nested) => playScene(id, nested),
  goTo: async (id, cost) => travel(id, cost, true),
};
const runner = cmpMakeRunner(io);
async function playScene(id, nested){
  const sc = STORY.scenes[id];
  if(!sc){ console.error('Scene missing', id); return null; }
  if(sc.once && S.scenesDone[id]) return null;
  if(!cmpCond(S, sc.when)) return null;
  if(!nested){ busy = true; renderExplore(); }
  if(sc.background!==undefined) setBg(sc.background);
  let res=null;
  try{ res = await runner.runSteps(sc.steps||[]); }catch(e){ console.error('Scene '+id,e); await say({text:'[Error in scene '+id+': '+e.message+']'}); }
  mutate(s=>{s.scenesDone[id]=true;});
  if(sc.time) addTime(sc.time);
  if(!nested){
    $('txt').innerHTML=''; $('spk').hidden=true; $('choices').innerHTML='';
    await afterScene();
    actors=[]; renderActors(); setBg((W.locations[S.location]||{}).background);
    busy=false; renderExplore();
  }
  return res;
}
async function afterScene(){
  const de=W.dayEnd;
  if(de&&S.minutes>=cmpTime(de.at,1439)){
    if(de.scene&&STORY.scenes[de.scene]) await playScene(de.scene,true); else mutate(s=>{s.day++;s.minutes=cmpTime(de.wake,420);});
    if(de.location) mutate(s=>{s.location=de.location;});
  }
  for(const ev of W.events||[]){
    if(!ev||!ev.scene)continue;
    if(ev.once!==false&&S.eventsDone[ev.id||ev.scene])continue;
    if(ev.at&&ev.at!==S.location)continue;
    if(ev.day!=null&&ev.day!==S.day)continue;
    if(ev.from!=null&&S.minutes<cmpTime(ev.from))continue;
    if(ev.to!=null&&S.minutes>=cmpTime(ev.to))continue;
    if(!cmpCond(S,ev.when))continue;
    mutate(s=>{s.eventsDone[ev.id||ev.scene]=true;});
    await playScene(ev.scene,true); break;
  }
}
async function travel(id,cost,fromScene){
  const loc=W.locations[id]; if(!loc) return;
  const c=cost!=null?cost:cmpTravelCost(W,S,id);
  mutate(s=>{s.location=id;s.visited[id]=(s.visited[id]||0)+1;if(s.known.indexOf(id)<0)s.known.push(id);});
  addTime(c); setBg(loc.background); actors=[]; renderActors();
  if(!fromScene) await arrive();
}
async function arrive(){
  busy=true; renderExplore();
  await afterScene();
  const loc=W.locations[S.location]||{}, arr=loc.onArrive;
  if(arr) for(const a of Array.isArray(arr)?arr:[{scene:arr}]){ if(!cmpCond(S,a.when))continue; if(a.once!==false&&S.scenesDone[a.scene])continue; await playScene(a.scene,true); break; }
  $('txt').innerHTML=''; $('spk').hidden=true; $('choices').innerHTML='';
  actors=[]; renderActors(); setBg((W.locations[S.location]||{}).background);
  busy=false; renderExplore();
}
function renderExplore(){
  const ex=$('explore'); ex.innerHTML=''; if(busy) { ex.hidden=true; return; } ex.hidden=false;
  const loc=W.locations[S.location]||{};
  const mk=(title,items)=>{const sec=document.createElement('section');sec.innerHTML='<h3>'+title+'</h3>';const l=document.createElement('div');l.className='list';if(!items.length){const p=document.createElement('div');p.className='note';p.textContent='Nobody and nothing here right now.';l.appendChild(p);}items.forEach(i=>l.appendChild(i));sec.appendChild(l);ex.appendChild(sec);};
  const btn=(label,sub,fn,off)=>{const b=document.createElement('button');b.innerHTML=esc(label)+(sub?' <small>'+esc(sub)+'</small>':'');b.disabled=!!off;b.onclick=async()=>{await fn();};return b;};
  const ppl=(loc.objects||[]).filter(o=>cmpCond(S,o.when)).map(o=>btn(o.label||o.id,'',()=>playScene(o.scene,false)));
  const act=(loc.actions||[]).filter(a=>cmpCond(S,a.when)).map(a=>btn(a.label,a.time?('+'+a.time+' min'):'',()=>a.scene?playScene(a.scene,false):Promise.resolve()));
  act.push(btn('Wait 15 minutes','',async()=>{busy=true;addTime(15);await afterScene();busy=false;renderExplore();}));
  const pls=S.known.filter(id=>id!==S.location&&W.locations[id]).map(id=>{const l=W.locations[id],locked=S.locked[id],ok=cmpCond(S,l.when);return btn(l.name||id,locked?(l.lockedText||'locked'):(!ok?(l.closedText||'closed'):('+'+cmpTravelCost(W,S,id)+' min')),()=>travel(id,undefined,false),locked||!ok);});
  mk('PEOPLE',ppl); mk('ACTIONS',act); mk('PLACES',pls);
}
function showOverlay(title,text,cb,extra){
  const o=$('overlay'); o.hidden=false; o.innerHTML='<div><h2>'+esc(title)+'</h2><pre>'+esc(text)+'</pre><button id="ovok">OK</button>'+(extra||'')+'</div>';
  $('ovok').onclick=()=>{o.hidden=true;o.innerHTML='';if(cb)cb();};
}
document.addEventListener('keydown',(e)=>{ if((e.key===' '||e.key==='Enter')&&waiter&&document.activeElement.tagName!=='BUTTON'){e.preventDefault();const w=waiter;waiter=null;w();}});
$('box').addEventListener('click',()=>{ if(waiter){const w=waiter;waiter=null;w();} });
$('bLog').onclick=()=>showOverlay('Log (last 60 lines)',log.slice(-60).join('\n'));
$('bDebug').onclick=()=>showOverlay('Flags and variables',Object.keys(S.flags).sort().join(', ')+'\n\n'+JSON.stringify(S.vars));
$('bTime').onclick=async()=>{ if(busy)return; busy=true; addTime(60); await afterScene(); busy=false; renderExplore(); };
$('bReset').onclick=()=>{ try{localStorage.removeItem(KEY);}catch(e){} location.reload(); };
(async()=>{
  S = load() || newState(); renderTop(); setBg((W.locations[S.location]||{}).background);
  await arrive();
})();
`;

const html = `<title>Pixel Academy: Day 1</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600&family=VT323&display=swap">
<style>${css}</style>
<div id="app">
  <div id="top"><div id="clock"></div><div id="where"></div><button class="sm" id="bTime" title="Skip an hour">+1 h</button><button class="sm" id="bLog">Log</button><button class="sm" id="bDebug">Flags</button><button class="sm" id="bReset">Restart</button></div>
  <div id="stage"><div id="bglabel"></div><div id="actors"></div></div>
  <div id="box"><div id="spk" hidden></div><div id="txt"></div><div id="choices"></div><div id="more" hidden>▼</div></div>
  <div id="explore"></div>
</div>
<div id="overlay" hidden></div>
<script>
const STORY={world:null,scenes:{}};
function defineWorld(def){const prev=STORY.world||{},d=def||{},m=Object.assign({},prev,d);m.locations=Object.assign({},prev.locations||{},d.locations||{});m.cast=Object.assign({},prev.cast||{},d.cast||{});m.events=(prev.events||[]).concat(d.events||[]);STORY.world=m;}
function defineScene(id,def){STORY.scenes[id]=Object.assign({id},def);}
${engine}
function cmpSfx(){}
</script>
${sceneScripts}
<script>${ui}</script>
`;
const out = path.join(ROOT, 'dist', 'preview');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html, { encoding: 'utf8' });
console.log('preview: ' + (html.length / 1024).toFixed(0) + ' KB -> campaign/dist/preview/index.html');
