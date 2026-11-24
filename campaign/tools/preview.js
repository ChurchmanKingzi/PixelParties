#!/usr/bin/env node
// Baut campaign/dist/preview/index.html: eigenständige Testfassung der Kampagne zum Durchspielen im Browser.
// Sie bettet den ECHTEN Szenen-Interpreter aus public/app-campaign.jsx und die kompilierten Szenen ein (kein eval).
//
//   Bühne    Hintergrund + Ganzkörper-Sprites der Figuren an ihren Orten; laufende Eingriffs-Szenen (`alert`)
//            lassen die Figur hüpfen und zeigen ein Ausrufezeichen. Anklicken startet die Szene.
//   Karte    die begehbare Inselkarte des alten Artefakts (CalderaMap, engine.js + assets/map). Der Spieler läuft
//            frei, Figuren stehen an ihren Orten, "Enter" geht in die Ortsansicht (mit Überblendung).
//   Text     jede Textbox lässt sich mit "Back" nochmal lesen (Verlauf der letzten 300 Zeilen).
//   Duelle   Platzhalter (Sieg/Niederlage wählen); gespielt wird sonst genau wie in der Engine.
//
//   node campaign/tools/build.js && node campaign/tools/preview.js --assets <Ordner des alten Artefakts>
//   (der Ordner enthält engine.js und assets/{map,portraits,bg}; die benötigten Dateien werden nach dist/preview kopiert
//    und in dist/preview/assets.json aufgelistet)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const ASSETS = argv.includes('--assets') ? argv[argv.indexOf('--assets') + 1] : null;
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

// welche Ortsbilder und Porträts braucht die Geschichte?
const need = { bg: new Set(), portraits: new Set() };
{
  const store = { world: null };
  new Function('world', 'scene', fs.readFileSync(path.join(dir, '00-world.js'), 'utf8'))(w => { store.world = w; }, () => {});
  const used = new Set([store.world.start.location]);
  const portraitsOf = (l) => { for (const o of l.objects || []) if (o.sprite) need.portraits.add(o.sprite); };
  for (const f of fs.readdirSync(dir)) {
    const m = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const x of m.matchAll(/\b(?:learn|goto): "([a-z0-9_]+)"/g)) used.add(x[1]);
    for (const x of m.matchAll(/\{ bg: "([a-z0-9_]+)"/g)) need.bg.add(x[1]);
    for (const x of m.matchAll(/enter: "([a-z0-9_]+)"/g)) need.portraits.add(x[1]);
  }
  for (const id of used) { const l = store.world.locations[id]; if (!l) continue; if (l.background) need.bg.add(l.background); portraitsOf(l); }
}

const css = `
:root{--bg:#0d0b14;--panel:#1a1626;--panel2:#262038;--edge:#4a3f6b;--text:#ece6f5;--dim:#a79fc0;--gold:#e8c170;--cyan:#7fd6e8;--red:#d9576b;--title:"Pixelify Sans","Courier New",monospace;--body:"VT323","Courier New",monospace;color-scheme:dark}
*{box-sizing:border-box}
[hidden]{display:none!important}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--body);font-size:21px;line-height:1.25;padding-left:max(12px,env(safe-area-inset-left,0px));padding-right:max(12px,env(safe-area-inset-right,0px))}
button{font:inherit;color:var(--text);background:var(--panel2);border:2px solid var(--edge);padding:4px 12px;cursor:pointer;box-shadow:0 3px 0 #000;text-align:left}
button:hover:not(:disabled),button:focus-visible{border-color:var(--gold);outline:none}
button:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 #000}
button:disabled{opacity:.45;cursor:not-allowed}
#app{max-width:1000px;margin:0 auto;display:flex;flex-direction:column;gap:10px;padding-block:10px 24px;min-height:100%}
#top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-bottom:2px solid var(--edge);padding-bottom:8px}
#clock{font-family:var(--title);color:var(--gold);font-size:17px;flex:1 1 220px;min-width:0}
#where{font-family:var(--title);color:var(--cyan);font-size:15px}
#top .sm{font-family:var(--title);font-size:13px;padding:2px 8px}
#stage{position:relative;width:100%;aspect-ratio:16/9;max-height:62vh;background:#000;border:2px solid var(--edge);overflow:hidden}
#scene{position:absolute;inset:0;background:#07050b center/cover no-repeat;image-rendering:pixelated}
#scene::after{content:"";position:absolute;inset:0;background:linear-gradient(#0000 60%,#0007);pointer-events:none}
#mapRoot{position:absolute;inset:0}
#bglabel{position:absolute;top:6px;left:8px;font-family:var(--title);font-size:12px;background:#08060dcc;color:var(--dim);padding:0 6px;z-index:5}
.fig{position:absolute;transform:translateX(-50%);background:none;border:0;padding:0;box-shadow:none;cursor:pointer;aspect-ratio:256/320;z-index:2}
.fig canvas{height:100%;width:100%;image-rendering:pixelated;display:block}
.fig.actor{cursor:default;z-index:3}
.fig.flip canvas{transform:scaleX(-1)}
.fig .tag{position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);font-family:var(--title);font-size:12px;white-space:nowrap;background:#08060dd9;border:2px solid var(--cyan);color:var(--cyan);padding:0 6px;opacity:0;pointer-events:none}
.fig:hover .tag,.fig:focus-visible .tag,.fig.talk .tag{opacity:1}
.fig.talk{filter:brightness(1.12)}
.fig.talk canvas{animation:talk .5s steps(1) infinite}
@keyframes talk{50%{transform:translateY(-3px)}}
.fig.alert{animation:hop .7s steps(1) infinite}
@keyframes hop{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-9px)}}
.bang{position:absolute;left:50%;top:-26px;transform:translateX(-50%);min-width:24px;text-align:center;font-family:var(--title);font-weight:600;font-size:22px;line-height:24px;color:#1a1626;background:var(--gold);border:2px solid #000;box-shadow:3px 3px 0 #000}
.bang::after{content:"";position:absolute;left:50%;bottom:-9px;margin-left:-4px;border:4px solid transparent;border-top-color:var(--gold)}
.fig.missing{background:linear-gradient(#a79fc0,#a79fc0) 50% 10%/38% 22% no-repeat,linear-gradient(#a79fc0,#a79fc0) 50% 90%/60% 58% no-repeat;opacity:.8}
@media (prefers-reduced-motion:reduce){.fig.alert,.fig.talk canvas{animation:none}}
#fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .28s steps(5);z-index:20}
#fade.on{opacity:1}
#maphud{position:absolute;left:8px;right:8px;bottom:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;z-index:6;pointer-events:none}
#maphud>*{pointer-events:auto}
#nearname{font-family:var(--title);font-size:14px;background:#08060dd9;border:2px solid var(--gold);color:var(--gold);padding:2px 10px}
#hint{font-family:var(--title);font-size:12px;background:#08060dd9;border:2px solid var(--edge);color:var(--dim);padding:2px 8px}
#enter{font-family:var(--title);font-size:14px;background:var(--gold);color:#1a1626;border-color:#000}
#box{position:relative;background:var(--panel);border:2px solid var(--edge);border-top:3px solid var(--gold);padding:14px 16px 12px;min-height:150px;display:flex;flex-direction:column;gap:8px;cursor:pointer}
#spk{align-self:flex-start;font-family:var(--title);font-size:16px;background:var(--gold);color:#1a1626;padding:0 10px;margin-top:-28px;box-shadow:3px 3px 0 #000}
#review{position:absolute;right:10px;top:-14px;font-family:var(--title);font-size:12px;background:var(--cyan);color:#1a1626;padding:0 8px;border:2px solid #000}
#txt{font-size:25px;white-space:pre-wrap;min-height:2.4em;overflow-wrap:anywhere}
#txt.think{color:var(--dim);font-style:italic}
#txt.old{color:#c9c2dc}
#txt em{color:var(--gold);font-style:italic}
#more{position:absolute;right:12px;bottom:6px;color:var(--gold);animation:bl 1s steps(1) infinite}
@keyframes bl{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){#more{animation:none}}
#choices{display:flex;flex-direction:column;gap:6px}
#choices small{color:var(--dim);font-family:var(--title);font-size:12px;margin-left:8px}
#prompt{color:var(--cyan)}
#bar{display:flex;flex-wrap:wrap;gap:8px}
#bar button{font-size:19px}
#bar .go{background:var(--gold);color:#1a1626;border-color:#000;font-family:var(--title);font-size:15px}
.note{color:var(--dim);font-size:17px}
#overlay{position:fixed;inset:0;background:#000d;display:grid;place-items:center;padding:16px;z-index:50}
#overlay>div{max-width:560px;width:100%;background:var(--panel);border:3px solid var(--gold);padding:16px;max-height:90vh;overflow:auto}
#overlay h2{font-family:var(--title);color:var(--gold);margin:0 0 8px;font-size:20px}
#overlay pre{white-space:pre-wrap;font-family:var(--body);font-size:18px;margin:0 0 10px}
`;

const ui = String.raw`
const $ = (id) => document.getElementById(id);
const KEY = 'ppcampaign_preview_v2';
const W = STORY.world;
const WEEK = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
let S = null, busy = false, waiter = null, actors = [], bg = null, mode = 'scene', speakerId = null;
let hist = [], review = null;           // Verlauf der Textboxen und Position beim Zurückblättern
const esc = (t) => String(t).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function newState(){const st=W.start,known=[];for(const[id,l]of Object.entries(W.locations))if(l.known)known.push(id);if(known.indexOf(st.location)<0)known.push(st.location);return{v:1,day:st.day,minutes:cmpTime(st.time,480),location:st.location,flags:{},vars:{},items:{},coins:st.coins||0,known,locked:{},visited:{},scenesDone:{},eventsDone:{},duels:{},collection:{}};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function load(){try{const r=localStorage.getItem(KEY);if(r){const s=JSON.parse(r);if(s&&s.v===1)return s;}}catch(e){}return null;}
let rq = 0;
const mutate = (fn) => { fn(S); save(); renderTop(); if(!rq){rq=requestAnimationFrame(()=>{rq=0;refresh();});} };
function renderTop(){
  const loc = W.locations[S.location] || {};
  $('clock').textContent = 'Day ' + S.day + ' · ' + WEEK[(S.day-1)%7] + ' · ' + cmpFmtTime(S.minutes) + ' · ' + S.coins + ' cr';
  $('where').textContent = loc.name || S.location;
}

// ───────── Figuren: Ganzkörper-Sprites aus den Porträt-Sheets (23 Ausdrücke x 10 Outfits, Bild 256x320) ─────────
const figs = new Map();       // id -> { big: canvas, small: canvas, ok }
let figChain = Promise.resolve();
function loadFig(id){
  if(figs.has(id)) return figs.get(id).p;
  const rec = { ok:false, big:null, small:null };
  rec.p = figChain = figChain.then(() => new Promise(done => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = 256; c.height = 320;
        c.getContext('2d').drawImage(im, 0, 0, 256, 320, 0, 0, 256, 320);
        rec.big = c; rec.ok = true;
        if (window.CalderaMap) { try { rec.small = window.CalderaMap.shrink(im, 0, 0, 256, 320); } catch(e){} }
      } catch(e) { console.warn('figure', id, e); }
      im.src = ''; done(rec);
    };
    im.onerror = () => done(rec);
    im.src = 'assets/portraits/' + id + '.png';
  }).then(r => { scheduleStage(); return r; }));
  figs.set(id, rec);
  return rec.p;
}
let sq = 0; function scheduleStage(){ if(sq) return; sq = requestAnimationFrame(()=>{sq=0;renderStage();}); }
function figEl(o, cls){
  const rec = figs.get(o.sprite); if(!rec) loadFig(o.sprite);
  const b = document.createElement(cls.includes('actor') ? 'div' : 'button');
  b.className = 'fig ' + cls; b.dataset.id = o.id; b.dataset.sprite = o.sprite;
  b.style.left = (o.x == null ? 50 : o.x) + '%';
  b.style.bottom = (100 - (o.y == null ? 100 : o.y)) + '%';
  b.style.height = ((o.h || 60) / 180 * 100) + '%';
  if (o.flip) b.classList.add('flip');
  const r = figs.get(o.sprite);
  if (r && r.ok) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320; cv.getContext('2d').drawImage(r.big, 0, 0); b.appendChild(cv); }
  else b.classList.add('missing');
  const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = o.label || o.id; b.appendChild(tag);
  if (cls.includes('alert')) { const bang = document.createElement('span'); bang.className = 'bang'; bang.textContent = '!'; b.appendChild(bang); }
  if (o.sprite && speakerId && (o.sprite === speakerId || o.id === speakerId)) b.classList.add('talk');
  return b;
}
function locationPeople(id){ const loc = W.locations[id] || {}; return (loc.objects || []).filter(o => cmpCond(S, o.when)); }
function renderStage(){
  const el = $('scene'); el.querySelectorAll('.fig').forEach(n => n.remove());
  const hide = new Set(actors.map(a => a.id));
  if (!busy || true) for (const o of locationPeople(S.location)) {
    if (hide.has(o.sprite)) continue;
    const alert = o.alert != null && cmpCond(S, o.alert);
    const b = figEl(o, alert ? 'alert' : '');
    if (o.scene) b.onclick = () => { if (!busy && mode === 'scene') runScene(o.scene); };
    el.appendChild(b);
  }
  for (const a of actors) el.appendChild(figEl({ id: a.id, sprite: a.sprite, x: a.x, y: a.y, h: a.h, flip: a.flip, label: castName(a.id) }, 'actor'));
}
function setBg(name){ bg = name; const el = $('scene'); el.style.backgroundImage = name ? 'url("assets/bg/' + name + '.png")' : 'none'; $('bglabel').textContent = name || ''; }
function castName(id){ const c = W.cast[id]; return c ? c.name : id; }

// ───────── Textbox mit Verlauf ─────────
function showLine(h, old){
  $('spk').hidden = !h.name; $('spk').textContent = h.name || '';
  $('txt').className = (h.think ? 'think ' : '') + (old ? 'old' : ''); $('txt').innerHTML = md(h.text);
}
function updateReview(){
  const L = hist.length - 1, live = review === null;
  $('review').hidden = live;
  $('choices').hidden = !live;
  $('more').hidden = !(live && waiter);
  $('bBack').disabled = !(live ? L >= 1 : review >= 1);
  if (!hist.length) return;
  if (live) showLine(hist[L], false);
  else { showLine(hist[review], true); $('review').textContent = 'Earlier text (' + (L - review) + ' back)'; }
}
function back(){
  const L = hist.length - 1; if (L < 1) return;
  review = review === null ? L - 1 : Math.max(0, review - 1);
  $('bFwd').hidden = false; updateReview();
}
function fwd(){
  if (review === null) return;
  review++; if (review >= hist.length - 1) { review = null; $('bFwd').hidden = true; }
  updateReview();
}
function advance(){ if (review !== null) { review = null; $('bFwd').hidden = true; updateReview(); return; } if (waiter) { const w = waiter; waiter = null; w(); } }
function say(l){
  return new Promise(res => {
    $('choices').innerHTML = '';
    const name = l.name || (l.speaker ? castName(l.speaker) : (l.think ? 'Rowan' : null));
    speakerId = l.speaker || null; scheduleStage();
    hist.push({ name, text: l.text, think: !!l.think }); if (hist.length > 300) hist.shift();
    review = null; $('bFwd').hidden = true;
    waiter = () => { $('more').hidden = true; res(); };
    updateReview();
  });
}
function choose(c){
  return new Promise(res => {
    const box = $('choices'); box.innerHTML = ''; review = null; $('bFwd').hidden = true;
    if (c.prompt) { $('spk').hidden = true; $('txt').className = ''; $('txt').innerHTML = '<span id="prompt">' + md(c.prompt) + '</span>'; }
    c.options.forEach((o, i) => { const b = document.createElement('button'); b.innerHTML = md(o.text) + (o.hint ? '<small>' + esc(o.hint) + '</small>' : ''); b.onclick = (e) => { e.stopPropagation(); box.innerHTML = ''; res(i); }; box.appendChild(b); });
    $('more').hidden = true; updateReview(); $('choices').hidden = false;
  });
}
function addTime(m){ if(!m)return; mutate(s=>{s.minutes+=m;while(s.minutes>=1440){s.minutes-=1440;s.day++;}}); }

const io = {
  state: () => S, mutate, sleep, say, choose, addTime,
  setBg(n){ setBg(n); },
  clearActors(){ actors = []; scheduleStage(); },
  enter(id, st){ const c = W.cast[id] || {}; actors = actors.filter(a => a.id !== id).concat([{ id, sprite: (c.sprite || id), x: st.x != null ? st.x : 50, y: st.y != null ? st.y : 100, h: st.h || c.h || 64, flip: !!st.flip }]); loadFig(c.sprite || id); scheduleStage(); },
  exit(id){ actors = actors.filter(a => a.id !== id); scheduleStage(); },
  move(id, st){ actors = actors.map(a => a.id === id ? Object.assign({}, a, { x: st.x != null ? st.x : a.x, y: st.y != null ? st.y : a.y }) : a); scheduleStage(); },
  face(){}, dim(){}, music(){}, fx: async () => {}, revealCards: async () => {},
  applyReward: async (r) => { mutate(s=>{ if(r.coins) s.coins=Math.max(0,s.coins+r.coins); for(const f of r.flags||[]) s.flags[f]=true; }); },
  duel: (step) => new Promise(res => {
    $('spk').hidden=false; $('spk').textContent='DUEL';
    $('txt').className=''; $('txt').innerHTML='Duel vs. <strong>'+esc(step.opponentName||step.opponent)+'</strong>'+(step.ante?' (ante)':'')+'. <span class="note">Preview build: the real game plays this out. Pick the result to test the branches.</span>';
    const box=$('choices'); box.innerHTML='';
    [['I win',true],['I lose',false]].forEach(([t,v])=>{const b=document.createElement('button');b.textContent=t;b.onclick=(e)=>{e.stopPropagation();box.innerHTML='';res(v);};box.appendChild(b);});
    $('more').hidden=true;
  }),
  deckEdit: async () => {},
  gameOver: async (t) => { await new Promise(res => showOverlay('The end of this build', t || '', res)); },
  playScene: (id, nested) => playScene(id, nested),
  goTo: async (id, cost) => travel(id, cost, true),
};
const runner = cmpMakeRunner(io);
async function playScene(id, nested){
  const sc = STORY.scenes[id];
  if(!sc){ console.error('Scene missing', id); return null; }
  if(sc.once && S.scenesDone[id]) return null;
  if(!cmpCond(S, sc.when)) return null;
  if(!nested){ busy = true; refresh(); }
  if(sc.background!==undefined) setBg(sc.background);
  let res=null;
  try{ res = await runner.runSteps(sc.steps||[]); }catch(e){ console.error('Scene '+id,e); await say({text:'[Error in scene '+id+': '+e.message+']'}); }
  mutate(s=>{s.scenesDone[id]=true;});
  if(sc.time) addTime(sc.time);
  if(!nested){
    $('choices').innerHTML=''; speakerId=null;
    await afterScene();
    actors=[]; setBg((W.locations[S.location]||{}).background);
    busy=false; refresh();
  }
  return res;
}
async function runScene(id){ await playScene(id,false); }
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
  addTime(c); setBg(loc.background); actors=[];
  if(!fromScene) await arrive();
}
async function arrive(){
  busy=true; refresh();
  await afterScene();
  const loc=W.locations[S.location]||{}, arr=loc.onArrive;
  if(arr) for(const a of Array.isArray(arr)?arr:[{scene:arr}]){ if(!cmpCond(S,a.when))continue; if(a.once!==false&&S.scenesDone[a.scene])continue; await playScene(a.scene,true); break; }
  $('choices').innerHTML=''; speakerId=null; actors=[]; setBg((W.locations[S.location]||{}).background);
  busy=false; refresh();
}

// ───────── Karte (CalderaMap aus dem alten Artefakt) ─────────
let CMAP = null, near = null, mapPeopleKey = '', alertFrame = 0;
function blankSprite(col){ const c=document.createElement('canvas');c.width=18;c.height=22;const g=c.getContext('2d');g.fillStyle='#141020';g.fillRect(5,1,8,8);g.fillRect(3,9,12,12);g.fillStyle=col;g.fillRect(6,2,6,6);g.fillRect(4,10,10,10);return c; }
function bangSprite(base, up){ const c=document.createElement('canvas');c.width=18;c.height=22;const g=c.getContext('2d');g.drawImage(base,0,up?-1:0);g.fillStyle='#000';g.fillRect(12,0,5,9);g.fillStyle='#e8c170';g.fillRect(13,1,3,5);g.fillRect(13,7,3,1);return c; }
function mapPeople(){
  const list=[];
  for(const [lid,loc] of Object.entries(W.locations)){
    if(!(loc.objects&&loc.objects.length)) continue;
    for(const o of loc.objects){
      if(!cmpCond(S,o.when)) continue;
      const rec=figs.get(o.sprite)||(loadFig(o.sprite),figs.get(o.sprite));
      let spr=(rec&&rec.small)||blankSprite('#a79fc0');
      const alert=o.alert!=null&&cmpCond(S,o.alert);
      if(alert) spr=bangSprite(spr,alertFrame===1);
      list.push({id:o.id,name:o.label||o.id,sprite:spr,place:lid,alert,scene:o.scene,loc:lid});
    }
  }
  return list;
}
function refreshMapPeople(force){
  if(!CMAP) return;
  const list=mapPeople();
  const key=list.map(p=>p.id+'@'+p.place+(p.alert?'!'+alertFrame:'')+(figs.get(p.id)?1:0)).join(',');
  if(!force&&key===mapPeopleKey) return; mapPeopleKey=key;
  try{ CMAP.setPeople(list.map(p=>({id:p.id,name:p.name,sprite:p.sprite,place:p.place}))); }catch(e){ console.warn('setPeople',e); }
}
function placeInfo(id){
  const loc=W.locations[id]; if(!loc) return null;
  if(!S.known.includes(id)) return { ok:false, why:'You have not heard of this place yet.' };
  if(S.locked[id]) return { ok:false, why:loc.lockedText||'Not reachable now.' };
  if(!cmpCond(S,loc.when)) return { ok:false, why:loc.closedText||'Closed right now.' };
  return { ok:true, name:loc.name||id, cost:id===S.location?0:cmpTravelCost(W,S,id) };
}
function updateHud(){
  const en=$('enter'), nm=$('nearname'), hint=$('hint');
  const p=near&&near.id; const info=p&&placeInfo(p);
  nm.hidden=!near; nm.textContent=near?near.name:'';
  en.hidden=!(info); if(info){ en.disabled=!info.ok; en.textContent=info.ok?('Enter ▸'+(info.cost?'  +'+info.cost+' min':'')):info.why; }
  hint.textContent = near&&!info ? 'Not part of this build yet.' : 'Arrows / WASD: walk · Space: look and talk · tap a person to talk';
}
async function initMap(){
  if(!window.CalderaMap){ $('bMap').hidden=true; return; }
  try{
    CMAP=await window.CalderaMap.create({ stage:$('mapRoot'), base:'assets/map/', hero:blankSprite('#e8c170'), minimap:false, german:false,
      canAct:()=>mode==='map'&&!busy,
      onPlace:(p)=>{ near=p; updateHud(); },
      onTalk:(npc)=>{ const o=Object.values(W.locations).flatMap(l=>l.objects||[]).find(x=>x.id===npc.id); const loc=Object.entries(W.locations).find(([k,l])=>(l.objects||[]).some(x=>x.id===npc.id)); if(o&&loc&&mode==='map') talkFromMap(loc[0],o); },
    });
    CMAP.pause(true); refreshMapPeople(true);
    setInterval(()=>{ if(mode==='map'){ alertFrame^=1; refreshMapPeople(); } },500);
  }catch(e){ console.warn('map failed',e); $('bMap').hidden=true; }
}
async function fade(fn){ const f=$('fade'); f.classList.add('on'); await sleep(300); await fn(); await sleep(60); f.classList.remove('on'); }
function setMode(m){
  mode=m; $('mapRoot').hidden=m!=='map'; $('scene').hidden=m!=='scene'; $('maphud').hidden=m!=='map';
  if(CMAP) CMAP.pause(m!=='map'); refresh();
}
async function openMap(){
  if(!CMAP||busy||mode==='map') return;
  await fade(async()=>{ setMode('map'); try{ CMAP.goPlace(S.location); }catch(e){} refreshMapPeople(true); updateHud(); });
}
async function enterLocation(id){
  const info=placeInfo(id); if(!info||!info.ok) return;
  await fade(async()=>{ setMode('scene'); if(id!==S.location){ await travel(id,undefined,false); } else { refresh(); } });
}
async function talkFromMap(locId,o){
  await fade(async()=>{ setMode('scene'); if(locId!==S.location){ await travel(locId,undefined,false); } });
  if(o.scene && cmpCond(S,o.when)) await runScene(o.scene);
}

// ───────── Leiste unter der Bühne ─────────
function refresh(){
  renderTop(); renderStage();
  const bar=$('bar'); bar.innerHTML='';
  if(mode!=='scene'||busy){ bar.hidden=true; return; }
  bar.hidden=false;
  const loc=W.locations[S.location]||{};
  for(const a of (loc.actions||[]).filter(a=>cmpCond(S,a.when))){ const b=document.createElement('button'); b.textContent=a.label+(a.time?'  +'+a.time+' min':''); b.onclick=()=>{ if(a.scene) runScene(a.scene); }; bar.appendChild(b); }
  const w=document.createElement('button'); w.textContent='Wait 15 minutes'; w.onclick=async()=>{busy=true;addTime(15);await afterScene();busy=false;refresh();}; bar.appendChild(w);
  if(CMAP){ const m=document.createElement('button'); m.className='go'; m.textContent='Walk the map ▸'; m.onclick=openMap; bar.appendChild(m); }
  else { for(const id of S.known.filter(i=>i!==S.location&&W.locations[i])){ const info=placeInfo(id); const b=document.createElement('button'); b.textContent=(W.locations[id].name||id); b.disabled=!info.ok; b.onclick=()=>enterLocation(id); bar.appendChild(b); } }
  $('bMap').disabled=!CMAP||busy;
}
function showOverlay(title,text,cb,extra){
  const o=$('overlay'); o.hidden=false; o.innerHTML='<div><h2>'+esc(title)+'</h2><pre>'+esc(text)+'</pre><button id="ovok">OK</button>'+(extra||'')+'</div>';
  $('ovok').onclick=()=>{o.hidden=true;o.innerHTML='';if(cb)cb();};
}
document.addEventListener('keydown',(e)=>{
  if(mode!=='scene') return;
  if((e.key===' '||e.key==='Enter')&&document.activeElement.tagName!=='BUTTON'){ if(waiter||review!==null){ e.preventDefault(); advance(); } }
  if(e.key==='ArrowLeft'&&(hist.length)){ back(); } if(e.key==='ArrowRight'&&review!==null){ fwd(); }
});
$('box').addEventListener('click',()=>advance());
$('bBack').onclick=(e)=>{ e.stopPropagation(); back(); };
$('bFwd').onclick=(e)=>{ e.stopPropagation(); fwd(); };
$('bMap').onclick=()=>{ if(mode==='scene') openMap(); else enterLocation(S.location); };
$('enter').onclick=()=>{ if(near) enterLocation(near.id); };
$('bLog').onclick=()=>showOverlay('Log (last 60 lines)',hist.slice(-60).map(h=>(h.name?h.name+': ':'')+h.text).join('\n'));
$('bDebug').onclick=()=>showOverlay('Flags and variables',Object.keys(S.flags).sort().join(', ')+'\n\n'+JSON.stringify(S.vars));
$('bTime').onclick=async()=>{ if(busy)return; busy=true; addTime(60); await afterScene(); busy=false; refresh(); };
$('bReset').onclick=()=>{ try{localStorage.removeItem(KEY);}catch(e){} location.reload(); };
(async()=>{
  S = load() || newState(); renderTop(); setBg((W.locations[S.location]||{}).background);
  setMode('scene'); await initMap();
  await arrive();
})();
`;

const html = `<meta charset="utf-8">
<title>Academy Playtest</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600&family=VT323&display=swap">
<style>${css}</style>
<div id="app">
  <div id="top"><div id="clock"></div><div id="where"></div><button class="sm" id="bBack" title="Read the previous textbox again" disabled>◀ Back</button><button class="sm" id="bFwd" hidden>Forward ▶</button><button class="sm" id="bMap">Map</button><button class="sm" id="bTime" title="Skip an hour">+1 h</button><button class="sm" id="bLog">Log</button><button class="sm" id="bDebug">Flags</button><button class="sm" id="bReset">Restart</button></div>
  <div id="stage">
    <div id="scene"></div>
    <div id="mapRoot" hidden></div>
    <div id="bglabel"></div>
    <div id="maphud" hidden><span id="nearname" hidden></span><button id="enter" hidden></button><span id="hint"></span></div>
    <div id="fade"></div>
  </div>
  <div id="box"><div id="review" hidden></div><div id="spk" hidden></div><div id="txt"></div><div id="choices"></div><div id="more" hidden>▼</div></div>
  <div id="bar"></div>
</div>
<div id="overlay" hidden></div>
<script>
const STORY={world:null,scenes:{}};
function defineWorld(def){const prev=STORY.world||{},d=def||{},m=Object.assign({},prev,d);m.locations=Object.assign({},prev.locations||{},d.locations||{});m.cast=Object.assign({},prev.cast||{},d.cast||{});m.events=(prev.events||[]).concat(d.events||[]);STORY.world=m;}
function defineScene(id,def){STORY.scenes[id]=Object.assign({id},def);}
${engine}
function cmpSfx(){}
</script>
<script src="engine.js"></script>
${sceneScripts}
<script>${ui}</script>
`;
const out = path.join(ROOT, 'dist', 'preview');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html, { encoding: 'utf8' });
const list = ['engine.js', 'assets/map/world.json', 'assets/map/ground.png', 'assets/map/objects.png',
  ...[...need.bg].sort().map(b => `assets/bg/${b}.png`), ...[...need.portraits].sort().map(p => `assets/portraits/${p}.png`)];
fs.writeFileSync(path.join(out, 'assets.json'), JSON.stringify(list, null, 1));
if (ASSETS) {
  let n = 0;
  for (const f of list) { const src = path.join(ASSETS, f); if (!fs.existsSync(src)) { console.log('  fehlt im Quellordner: ' + f); continue; } const dst = path.join(out, f); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); n++; }
  console.log(`assets: ${n}/${list.length} Dateien nach dist/preview kopiert`);
}
console.log('preview: ' + (html.length / 1024).toFixed(0) + ' KB -> campaign/dist/preview/index.html (' + list.length + ' Asset-Dateien nötig)');
