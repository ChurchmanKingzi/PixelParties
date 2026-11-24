#!/usr/bin/env node
// Baut campaign/dist/preview/index.html: eigenständige Testfassung der Kampagne zum Durchspielen im Browser.
// Sie bettet den ECHTEN Szenen-Interpreter aus public/app-campaign.jsx und die kompilierten Szenen ein (kein eval).
//
//   Karte      Erkundung: die begehbare Inselkarte des alten Artefakts (CalderaMap). Figuren in der Nähe stehen auf der
//              Karte, Begleiter (@follow) laufen hinter Rowan her. Eine Figur ansprechen startet ein Gespräch.
//   Gespräch   Hintergrund des Ortes und NUR die aktiven Figuren der Szene, groß. Sprecher werden automatisch eingeblendet.
//   Text       Typewriter, **fett**, *kursiv*, {farbe:Text}, [x!] = Schütteltext. Back (links unten) blättert zurück,
//              To Present (rechts unten) springt zur aktuellen Zeile, ein Klick geht im Rückblick eine Zeile vor.
//   Popups     "Kennengelernt", "Zuneigung gewonnen/verloren", "Deck erfahren". Ansichten: Personen, Deck, Sammlung.
//   Ton        Musik und Sounds der Website (public/music, public/sounds).
//   Duelle     Platzhalter (Sieg/Niederlage wählen); gespielt wird sonst genau wie in der Engine.
//
//   node campaign/tools/build.js && node campaign/tools/preview.js --assets <Ordner des alten Artefakts>
//   (Ordner mit engine.js und assets/{map,portraits,bg}; Musik und Sounds kommen aus public/)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const argv = process.argv.slice(2);
const ASSETS = argv.includes('--assets') ? argv[argv.indexOf('--assets') + 1] : null;
const jsx = fs.readFileSync(path.join(REPO, 'public', 'app-campaign.jsx'), 'utf8');
function grab(name) {
  const i = jsx.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('Engine-Funktion fehlt: ' + name);
  let depth = 0;
  for (let k = jsx.indexOf('{', i); k < jsx.length; k++) { if (jsx[k] === '{') depth++; else if (jsx[k] === '}' && !--depth) return jsx.slice(i, k + 1); }
  throw new Error('unbalanciert: ' + name);
}
const engine = ['cmpTime', 'cmpFmtTime', 'cmpDaypart', 'cmpCond', 'cmpFindLabel', 'cmpMakeRunner', 'cmpTravelCost'].map(grab).join('\n');
const dir = path.join(ROOT, 'dist', 'scenes');
const sceneFiles = fs.readdirSync(dir).sort();
const sceneScripts = sceneFiles.map(f => `<script>/* ${f} */\n(function(world,scene){${fs.readFileSync(path.join(dir, f), 'utf8')}\n})(defineWorld,defineScene);</script>`).join('\n');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ── welche Bilder, Porträts, Figuren braucht die Geschichte? ──
const need = { bg: new Set(), portraits: new Set(), sprites: new Set(), music: new Set(), sounds: new Set(), people: new Set() };
// Selbstgepixelte Figuren (campaign/sprites/<id>.png, Chroma-Key schon entfernt) ersetzen die alten Porträts, wo es sie gibt.
const PX = fs.existsSync(path.join(ROOT, 'sprites')) ? fs.readdirSync(path.join(ROOT, 'sprites')).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)) : [];
const store = { world: null };
new Function('world', 'scene', fs.readFileSync(path.join(dir, '00-world.js'), 'utf8'))(w => { store.world = w; }, () => {});
{
  const used = new Set([store.world.start.location]);
  for (const f of sceneFiles) {
    const m = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const x of m.matchAll(/\b(?:learn|goto): "([a-z0-9_]+)"/g)) used.add(x[1]);
    for (const x of m.matchAll(/\{ bg: "([a-z0-9_]+)"/g)) need.bg.add(x[1]);
    for (const x of m.matchAll(/(?:enter|say): "([a-z0-9_]+)"/g)) { need.portraits.add(x[1]); need.people.add(x[1]); }
    for (const x of m.matchAll(/sfx: "([a-z0-9_]+)"/g)) need.sounds.add(x[1]);
  }
  for (const id of used) {
    const l = store.world.locations[id]; if (!l) continue;
    if (l.background) need.bg.add(l.background);
    for (const o of l.objects || []) if (o.sprite) { need.portraits.add(o.sprite); need.people.add(o.sprite); }
  }
  for (const [k, f] of Object.entries(store.world.musicFiles || {})) if (k !== 'fun') need.music.add(f);
  for (const s of ['ui_click', 'ping', 'buff', 'debuff', 'reveal', 'victory', 'shop_purchase', 'ui_prompt_open', 'heavy_impact', 'draw']) need.sounds.add(s);
  need.portraits.delete('rowan'); need.people.delete('rowan');
  for (const id of [...need.portraits]) if (PX.includes(id)) { need.portraits.delete(id); need.sprites.add(id); }
}

// ── Daten für Personen-, Deck- und Sammlungsansicht ──
const cardsList = (() => { const c = readJson(path.join(REPO, 'data', 'cards.json')); return Array.isArray(c) ? c : (c.cards || Object.values(c)); })();
const cardBy = Object.fromEntries(cardsList.map(c => [c.name, c]));
const sys = readJson(path.join(ROOT, 'bible', 'system.json'));
const names = readJson(path.join(ROOT, 'src', 'names.json'));
const DATA = { px: PX, alias: readJson(path.join(ROOT, 'src', 'aliases.json')), people: {}, rowan: null, followers: store.world.followers || {}, stages: { friend: sys.FRIEND_STAGES, romance: sys.ROMANCE_STAGES }, startAff: sys.START_AFFINITY };
for (const id of need.people) {
  const f = path.join(ROOT, 'bible', 'cast', id + '.json'); if (!fs.existsSync(f)) continue;
  const c = readJson(f); let deck = null;
  const df = path.join(ROOT, 'bible', 'decks', id + '.json');
  if (fs.existsSync(df)) { const d = readJson(df); const g = d.gist && typeof d.gist === 'object' ? Object.entries(d.gist).slice(0, 3).map(([k, v]) => [k, String(v)]) : []; deck = { name: d.name, heroes: d.heroes, key: g }; }
  DATA.people[id] = { name: (names[id] || c.name), first: c.firstName, romance: !!c.romance, deck, bonds: Object.entries(c.bonds || {}).map(([w, b]) => ({ w, label: b.label, pub: !!b.public, from: b.from == null ? 0 : b.from })) };
}
{
  const d = readJson(path.join(ROOT, 'bible', 'decks', 'rowan.json'));
  const info = (n) => { const c = cardBy[n] || {}; return { type: (d.types && d.types[n]) || c.cardType || '', effect: c.effect || '' }; };
  DATA.rowan = {
    name: d.name,
    heroes: d.heroes.map(h => ({ name: h, abilities: [(cardBy[h] || {}).startingAbility1, (cardBy[h] || {}).startingAbility2].filter(Boolean), ...info(h) })),
    main: d.main.map(([n, name]) => ({ n, name, ...info(name) })),
    potions: (d.potions || []).map(([n, name]) => ({ n, name, ...info(name) })),
  };
}

const css = `
:root{--bg:#0d0b14;--panel:#1a1626;--panel2:#262038;--edge:#4a3f6b;--text:#ece6f5;--dim:#a79fc0;--gold:#e8c170;--cyan:#7fd6e8;--red:#d9576b;--green:#7fc98f;--title:"Pixelify Sans","Courier New",monospace;--body:"VT323","Courier New",monospace;color-scheme:dark}
*{box-sizing:border-box}
[hidden]{display:none!important}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--body);font-size:21px;line-height:1.25;padding-left:max(12px,env(safe-area-inset-left,0px));padding-right:max(12px,env(safe-area-inset-right,0px))}
button{font:inherit;color:var(--text);background:var(--panel2);border:2px solid var(--edge);padding:4px 12px;cursor:pointer;box-shadow:0 3px 0 #000;text-align:left}
button:hover:not(:disabled),button:focus-visible{border-color:var(--gold);outline:none}
button:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 #000}
button:disabled{opacity:.4;cursor:not-allowed}
#app{max-width:1000px;margin:0 auto;display:flex;flex-direction:column;gap:10px;padding-block:10px 24px;min-height:100%}
#top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-bottom:2px solid var(--edge);padding-bottom:8px}
#clock{font-family:var(--title);color:var(--gold);font-size:17px;flex:1 1 200px;min-width:0}
#where{font-family:var(--title);color:var(--cyan);font-size:15px}
#top .sm{font-family:var(--title);font-size:13px;padding:2px 8px}
#stage{position:relative;width:100%;aspect-ratio:16/9;max-height:64vh;background:#000;border:2px solid var(--edge);overflow:hidden}
#conv{position:absolute;inset:0;background:#07050b center/cover no-repeat;image-rendering:pixelated}
#conv::after{content:"";position:absolute;inset:0;background:linear-gradient(#0000 55%,#0008);pointer-events:none}
#cactors{position:absolute;inset:0;z-index:2}
.ca{position:absolute;bottom:0;transform:translateX(-50%);aspect-ratio:256/320;transition:left .35s steps(6),filter .2s steps(3)}
.ca.px{aspect-ratio:auto;bottom:3%}
.ca canvas{width:100%;height:100%;image-rendering:pixelated;display:block}
.ca.dim{filter:brightness(.55) saturate(.8)}
.ca.talk canvas{animation:talk .5s steps(1) infinite}
@keyframes talk{50%{transform:translateY(calc(var(--bob,4px) * -1))}}
.ca.ghost{background:linear-gradient(#a79fc0,#a79fc0) 50% 8%/34% 20% no-repeat,linear-gradient(#a79fc0,#a79fc0) 50% 92%/62% 66% no-repeat;opacity:.6}
#mapRoot{position:absolute;inset:0}
#bglabel{position:absolute;top:6px;left:8px;font-family:var(--title);font-size:12px;background:#08060dcc;color:var(--dim);padding:0 6px;z-index:5}
#toasts{position:absolute;top:8px;right:8px;display:flex;flex-direction:column;gap:8px;align-items:flex-end;z-index:30;pointer-events:none;max-width:78%}
.cm-tip:empty{display:none!important}
.toast{display:flex;gap:12px;align-items:center;background:#08060df2;border:3px solid var(--gold);padding:6px 16px 6px 6px;font-family:var(--title);font-size:20px;box-shadow:4px 4px 0 #000;animation:tin .25s steps(4)}
.toast.up{border-color:var(--green)}.toast.down{border-color:var(--red)}.toast.deck{border-color:var(--cyan)}
@keyframes tin{from{transform:translateX(30px);opacity:0}}
.toast canvas{width:64px;height:64px;image-rendering:pixelated;background:#120f1c;border:3px solid var(--edge);flex:0 0 auto}
.toast b{display:block;font-weight:600}.toast small{display:block;color:var(--dim);font-family:var(--body);font-size:22px;line-height:1.05}
.toast .up{color:var(--green)}.toast .dn{color:var(--red)}
#fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .28s steps(5);z-index:40}
#fade.on{opacity:1}
#box{position:relative;background:var(--panel);border:2px solid var(--edge);border-top:3px solid var(--gold);padding:14px 16px 44px;min-height:176px;display:flex;flex-direction:column;gap:8px;cursor:pointer}
#spk{align-self:flex-start;font-family:var(--title);font-size:16px;background:var(--gold);color:#1a1626;padding:0 10px;margin-top:-28px;box-shadow:3px 3px 0 #000}
#review{position:absolute;right:10px;top:-14px;font-family:var(--title);font-size:12px;background:var(--cyan);color:#1a1626;padding:0 8px;border:2px solid #000}
#txt{font-size:25px;white-space:pre-wrap;min-height:2.4em;overflow-wrap:anywhere}
#txt.think{color:var(--dim);font-style:italic}
#txt.old{color:#c9c2dc}
#txt em{font-style:italic;color:#f1dfae}
#txt strong{font-weight:400;color:#fff;text-shadow:1px 0 0 #fff}
.sk{display:inline-block;animation:sk .4s steps(2) infinite}
@keyframes sk{50%{transform:translateY(-2px)}}
@media (prefers-reduced-motion:reduce){.sk,.ca.talk canvas{animation:none}.ca{transition:none}}
#more{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);color:var(--gold);animation:bl 1s steps(1) infinite}
@keyframes bl{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){#more{animation:none}}
#choices{display:flex;flex-direction:column;gap:6px}
#choices small{color:var(--dim);font-family:var(--title);font-size:12px;margin-left:8px}
#prompt{color:var(--cyan)}
#bBack,#bPresent{position:absolute;bottom:8px;font-family:var(--title);font-size:13px;padding:2px 10px}
#bBack{left:10px}#bPresent{right:10px;background:var(--cyan);color:#1a1626;border-color:#000}
#bBack:disabled{opacity:.2;box-shadow:none;border-color:var(--edge);color:var(--dim);cursor:default}
#bar{display:flex;flex-direction:column;gap:8px}
#bar .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#bar .lbl{font-family:var(--title);font-size:13px;color:var(--dim);min-width:84px}
#bar button{font-size:19px}
#bar .go{background:var(--gold);color:#1a1626;border-color:#000;font-family:var(--title);font-size:15px}
#bar .near{font-family:var(--title);font-size:14px;color:var(--gold)}
.note{color:var(--dim);font-size:17px}
#overlay{position:fixed;inset:0;background:#000d;display:grid;place-items:center;padding:16px;z-index:50}
#overlay>div{max-width:760px;width:100%;background:var(--panel);border:3px solid var(--gold);padding:14px;max-height:90vh;overflow:auto}
#overlay h2{font-family:var(--title);color:var(--gold);margin:0 0 8px;font-size:20px}
#overlay pre{white-space:pre-wrap;font-family:var(--body);font-size:18px;margin:0 0 10px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.tabs button.on{border-color:var(--gold);color:var(--gold)}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.pcard{display:flex;gap:8px;align-items:center;padding:4px 6px}.pcard canvas{width:48px;height:48px;image-rendering:pixelated;background:#120f1c;border:2px solid var(--edge);flex:0 0 auto}
.pcard b{display:block;font-weight:400;line-height:1}.pcard small{color:var(--dim);font-size:16px;line-height:1}
.bar{height:8px;background:#0a0810;border:2px solid var(--edge);margin:3px 0}.bar i{display:block;height:100%;background:var(--gold)}
.det{display:grid;gap:6px}.det h3,.hh{font-family:var(--title);font-size:13px;letter-spacing:.08em;color:var(--gold);margin:8px 0 2px;font-weight:400}
.cl{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:3px 12px}.cl button{display:flex;gap:6px;padding:0 6px;font-size:17px}.cl .n{color:var(--gold);min-width:2ch}
.eff{border-left:3px solid var(--cyan);padding-left:8px;color:var(--dim);font-size:17px;margin-top:6px}
`;

const ui = String.raw`
const $ = (id) => document.getElementById(id);
const KEY = 'ppcampaign_preview_v3';
const W = STORY.world;
const WEEK = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
let S = null, busy = false, waiter = null, view = 'conv', speakerId = null, actors = [], hist = [], review = null;
let CMAP = null, near = null, lastMapLoc = null, musicOverride = false;
const esc = (t) => String(t).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function newState(){const st=W.start,known=[];for(const[id,l]of Object.entries(W.locations))if(l.known)known.push(id);if(known.indexOf(st.location)<0)known.push(st.location);return{v:3,day:st.day,minutes:cmpTime(st.time,480),location:st.location,flags:{},vars:{},items:{},coins:st.coins||0,known,locked:{},visited:{},scenesDone:{},eventsDone:{},duels:{},collection:{},affLog:[]};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function load(){try{const r=localStorage.getItem(KEY);if(r){const s=JSON.parse(r);if(s&&s.v===3)return s;}}catch(e){}return null;}
const mutate = (fn) => { const b = { c: S.coins, it: Object.assign({}, S.items), co: Object.assign({}, S.collection) }; fn(S); save(); renderTop(); foundToasts(b); };
function foundToasts(b){
  try {
    if (S.coins !== b.c) { const d = S.coins - b.c; if (d > 0) toast('', '+' + d + ' SC', ''); else if (d < 0 && b.c !== undefined) toast('down', d + ' SC', ''); }
    for (const k of Object.keys(S.items)) if ((S.items[k] || 0) > (b.it[k] || 0)) toast('deck', 'Item found', esc(k));
    for (const k of Object.keys(b.it)) if ((S.items[k] || 0) < b.it[k]) toast('', 'Item handed over', esc(k));
    for (const k of Object.keys(S.collection)) if ((S.collection[k] || 0) > (b.co[k] || 0)) toast('up', 'Card found', esc(k));
  } catch (e) {}
}
function renderTop(){
  const loc = W.locations[S.location] || {};
  $('clock').textContent = 'Day ' + S.day + ' · ' + WEEK[(S.day-1)%7] + ' · ' + cmpFmtTime(S.minutes) + ' · ' + S.coins + ' SC';
  $('where').textContent = loc.name || S.location;
}
const PN = () => (S && S.vars && S.vars.pn) || 'Rowan';
const LN = () => (S && S.vars && S.vars.pl) || 'Vance';
function sub(s){
  if (s == null) return s;
  const f = PN(), l = LN();
  if (f === 'Rowan' && l === 'Vance') return s;
  const rr = f.slice(0, 3);
  return String(s).replace(/Vance, R\./g, l + ', ' + f.charAt(0).toUpperCase() + '.').replace(/Row-Row/g, rr + '-' + rr)
    .replace(/\bROWAN\b/g, f.toUpperCase()).replace(/\bVANCE\b/g, l.toUpperCase()).replace(/\bRowan\b/g, f).replace(/\bVance\b/g, l);
}
const castName = (id) => { const c = W.cast[id]; return c ? c.name : id; };
// Was Rowan über den Namen weiß: 'Olivia "Livvie" Thana' erscheint als 'Livvie Thana', bis der volle Name gefallen ist (@fullname).
function shownName(id){ if (S.names && S.names[id]) return S.names[id]; const p = DATA.people[id]; return (p && p.first) || castName(id); }
const knowsRel = (a, b) => !!(S.flags['rel_' + a + '_' + b] || S.flags['rel_' + b + '_' + a]);
const met = (id) => !!S.flags['met_' + id];
const following = () => Object.keys(DATA.followers).filter(id => S.flags['follow_' + id]);

// ───────── Ton: Musik und Sounds der Website ─────────
const MUSIC = W.musicFiles || {};
let audioOn = true, audioUnlocked = false, curMusic = null, musicEl = null;
try { audioOn = localStorage.getItem(KEY + '_snd') !== '0'; } catch (e) {}
function fadeTo(a, v, ms, done){ const from = a.volume, t0 = performance.now(); const id = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); try { a.volume = Math.max(0, Math.min(1, from + (v - from) * k)); } catch (e) {} if (k >= 1) { clearInterval(id); if (done) done(); } }, 50); }
function startMusic(key){
  const src = MUSIC[key]; if (!src || !audioOn || !audioUnlocked) return;
  const a = new Audio(src); a.loop = true; a.volume = 0; const p = a.play(); if (p && p.catch) p.catch(() => {});
  fadeTo(a, 0.3, 1100);
  if (musicEl) { const old = musicEl; fadeTo(old, 0, 800, () => old.pause()); }
  musicEl = a;
}
function setMusic(key){ if (!key || key === curMusic) return; curMusic = key; startMusic(key); }
let duckT = null;
function duck(ms){ if (!musicEl) return; const a = musicEl; try { a.volume = 0.05; } catch (e) {} clearTimeout(duckT); duckT = setTimeout(() => { if (musicEl === a) fadeTo(a, 0.3, 700); }, ms); }
function sfx(name, vol){ if (!audioOn || !audioUnlocked || !name) return; if (name === 'victory') { vol = 0.95; duck(3600); } const a = new Audio('sounds/' + name + '.ogg'); a.volume = vol == null ? 0.45 : vol; const p = a.play(); if (p && p.catch) p.catch(() => {}); }
window.playSFX = (n) => sfx(n);
function unlockAudio(){ if (audioUnlocked) return; audioUnlocked = true; if (curMusic) { const k = curMusic; curMusic = null; setMusic(k); } }
function toggleSound(){
  audioOn = !audioOn; try { localStorage.setItem(KEY + '_snd', audioOn ? '1' : '0'); } catch (e) {}
  $('bSnd').textContent = audioOn ? '♪ On' : '♪ Off';
  if (!audioOn) { if (musicEl) { const m = musicEl; musicEl = null; fadeTo(m, 0, 300, () => m.pause()); } }
  else { const k = curMusic; curMusic = null; setMusic(k); }
}
function locationMusic(){ if (musicOverride) return; const l = W.locations[S.location] || {}; setMusic(l.music || 'ship'); }

// ───────── Figuren: Ganzkörper-Sprites aus den Porträt-Sheets (Bild 256x320) ─────────
const figs = new Map(); let figChain = Promise.resolve();
function loadFig(id){
  if (figs.has(id)) return figs.get(id).p;
  const rec = { ok: false, big: null, small: null, px: null };
  const isPx = DATA.px.indexOf(id) >= 0;
  rec.p = figChain = figChain.then(() => new Promise(done => {
    const im = new Image();
    im.onload = () => {
      if (isPx) { try { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0); c.ppNative = true; rec.px = c; rec.small = c; rec.ok = true; } catch (e) { console.warn('sprite', id, e); } im.src = ''; done(rec); return; }
      try { const c = document.createElement('canvas'); c.width = 256; c.height = 320; c.getContext('2d').drawImage(im, 0, 0, 256, 320, 0, 0, 256, 320); rec.big = c; rec.ok = true;
        if (window.CalderaMap) { try { rec.small = window.CalderaMap.shrink(im, 0, 0, 256, 320); } catch (e) {} } } catch (e) { console.warn('figure', id, e); }
      im.src = ''; done(rec);
    };
    im.onerror = () => done(rec);
    im.src = (isPx ? 'assets/sprites/' : 'assets/portraits/') + id + '.png';
  }).then(r => { renderConv(); if (CMAP) { refreshMapPeople(true); followKey = ''; refreshFollowers(); } return r; }));
  figs.set(id, rec); return rec.p;
}
function headCanvas(id, size){
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const paint = () => { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, size, size); const r = figs.get(id); if (r && r.ok && r.px) g.drawImage(r.px, 0, 0, r.px.width, Math.min(r.px.height, r.px.width), 0, 0, size, size); else if (r && r.ok) g.drawImage(r.big, 52, 6, 152, 152, 0, 0, size, size); else { g.fillStyle = '#a79fc0'; g.fillRect(size * .3, size * .2, size * .4, size * .35); g.fillRect(size * .2, size * .6, size * .6, size * .4); } };
  paint(); if (!figs.has(id) || !figs.get(id).ok) loadFig(id).then(paint);
  return c;
}

// ───────── Gesprächsansicht: nur die aktiven Figuren, groß ─────────
let lastSpoke = {};
function layout(n){ if (n <= 1) return [50]; if (n === 2) return [30, 70]; return [20, 50, 80]; }
// Grundhöhe 82 % der früheren (damit Große hineinpassen); Faktoren je Figur: Baylee ist einen Kopf größer als alle, Inya und Georgie sind klein.
const HEIGHT = { inya: .86, tomi: .92 };   // nur für die alten Porträts; die Pixel-Sprites haben ihre Größe selbst
function actorHeight(n){ return n <= 2 ? 90 : n === 3 ? 82 : 72; }
const PXH = 32, PXW = 21;   // höchster und breitester Sprite der Reihe, bestimmt die gemeinsame Pixelgröße
function pxScale(n){ const st = $('stage'), H = st.clientHeight || 540, Wd = st.clientWidth || 976; const frac = n <= 2 ? 0.9 : 0.84; return Math.max(2, Math.min(Math.floor(H * frac / PXH), Math.floor(Wd / Math.max(2, n) / PXW))); }
function addActor(id){
  if (!id || id === 'rowan') return;
  if (!actors.includes(id)) {
    while (actors.length >= 3) { let ev = null, best = Infinity; for (const a of actors) { const k = lastSpoke[a] || 0; if (k < best) { best = k; ev = a; } } actors = actors.filter(a => a !== ev); }
    actors.push(id); loadFig(id);
  }
  lastSpoke[id] = hist.length;
  renderConv();
}
function expireActors(cur){ const n = actors.length; actors = actors.filter(a => a === cur || (hist.length - (lastSpoke[a] || 0)) <= 8); return actors.length !== n; }
function renderConv(){
  const box = $('cactors'); box.innerHTML = '';
  const xs = layout(actors.length), h = actorHeight(actors.length);
  actors.forEach((id, i) => {
    const el = document.createElement('div'); el.className = 'ca' + (speakerId && speakerId !== id ? ' dim' : '') + (speakerId === id ? ' talk' : '');
    el.style.left = xs[i] + '%';
    const r = figs.get(id);
    if (r && r.ok && r.px) { const S0 = pxScale(actors.length), S = S0 + (speakerId === id ? 1 : 0); el.classList.add('px'); el.style.width = (r.px.width * S) + 'px'; el.style.height = (r.px.height * S) + 'px'; el.style.setProperty('--bob', S0 + 'px'); const cv = document.createElement('canvas'); cv.width = r.px.width; cv.height = r.px.height; cv.getContext('2d').drawImage(r.px, 0, 0); el.appendChild(cv); }
    else if (r && r.ok) { el.style.height = Math.min(98, h * (HEIGHT[id] || 1) * (speakerId === id ? 1.08 : 1)) + '%'; const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320; cv.getContext('2d').drawImage(r.big, 0, 0); el.appendChild(cv); } else { el.style.height = h + '%'; el.classList.add('ghost'); loadFig(id); }
    box.appendChild(el);
  });
}
const pretty = (n) => String(n || '').replace(/_/g, ' ').replace(/\b[a-z]/g, c => c.toUpperCase());
let curBg = null;
function sceneBg(name){ if ((name || null) !== curBg) { actors = []; speakerId = null; renderConv(); } setBg(name); }
function setBg(name){ curBg = name || null; $('conv').style.backgroundImage = name ? 'url("assets/bg/' + name + '.png")' : 'none'; $('bglabel').textContent = pretty(name); }

// ───────── Text: Typewriter, Auszeichnung, Verlauf ─────────
function parseInline(raw){
  const segs = []; let i = 0, bold = false, italic = false, color = null, buf = '';
  const flush = () => { if (buf) { segs.push({ t: buf, b: bold, i: italic, c: color }); buf = ''; } };
  while (i < raw.length) {
    if (raw[i] === '{' && !color) { const close = raw.indexOf(':', i + 1); if (close > i + 1) { flush(); color = raw.slice(i + 1, close); i = close + 1; continue; } }
    if (raw[i] === '}' && color) { flush(); color = null; i++; continue; }
    if (raw[i] === '*' && raw[i + 1] === '*') { flush(); bold = !bold; i += 2; }
    else if (raw[i] === '*') { flush(); italic = !italic; i++; }
    else { buf += raw[i]; i++; }
  }
  flush(); return segs;
}
const plainLen = (segs) => segs.reduce((a, s) => a + s.t.length, 0);
function renderSegs(segs, count, shake){
  let left = count, out = '', k = 0;
  for (const s of segs) {
    if (left <= 0) break; const part = s.t.slice(0, left); left -= part.length;
    let h = '';
    if (shake) { for (const ch of part) h += '<span class="sk" style="animation-delay:' + ((k++ * 0.073) % 0.4).toFixed(2) + 's">' + (ch === '\n' ? '<br>' : esc(ch)) + '</span>'; } else h = esc(part);
    if (s.i) h = '<em>' + h + '</em>'; if (s.b) h = '<strong>' + h + '</strong>';
    if (s.c) h = '<span style="color:' + s.c + '">' + h + '</span>';
    out += h;
  }
  return out;
}
let typeTimer = null, typing = null, typingDone = true;
function showLine(h, old){
  clearInterval(typeTimer);
  $('spk').hidden = !h.name; $('spk').textContent = h.name || '';
  $('txt').className = (h.think ? 'think ' : '') + (old ? 'old' : '');
  const segs = parseInline(h.text);
  if (old) { $('txt').innerHTML = renderSegs(segs, 99999, h.shake); typingDone = true; return; }
  typing = { segs, len: plainLen(segs), n: 0, shake: h.shake }; typingDone = false;
  typeTimer = setInterval(() => { typing.n += 1; if (typing.n >= typing.len) { typing.n = typing.len; typingDone = true; clearInterval(typeTimer); } $('txt').innerHTML = renderSegs(typing.segs, typing.n, typing.shake); updateMore(); }, 20);
  $('txt').innerHTML = '';
}
function finishTyping(){ if (!typing || typingDone) return; clearInterval(typeTimer); typing.n = typing.len; typingDone = true; $('txt').innerHTML = renderSegs(typing.segs, typing.n, typing.shake); updateMore(); }
function updateMore(){ $('more').hidden = !(typingDone && waiter && review === null); }
function updateReview(){
  const L = hist.length - 1, live = review === null;
  $('review').hidden = live; $('choices').hidden = !live; $('bPresent').hidden = live;
  $('bBack').disabled = !(live ? L >= 1 : review >= 1);
  if (!hist.length) return;
  if (live) { showLine(hist[L], false); if (!waiter) finishTyping(); }
  else { showLine(hist[review], true); $('review').textContent = 'Earlier text · ' + (L - review) + ' back'; }
  updateMore();
}
function back(){ const L = hist.length - 1; if (L < 1) return; sfx('ui_click', .3); review = review === null ? L - 1 : Math.max(0, review - 1); updateReview(); }
function stepForward(){ if (review === null) return; sfx('ui_click', .3); review++; if (review >= hist.length - 1) review = null; updateReview(); }
function toPresent(){ if (review === null) return; sfx('ui_click', .3); review = null; updateReview(); }
function advance(){
  unlockAudio();
  if (review !== null) { stepForward(); return; }
  if (!typingDone) { finishTyping(); return; }
  if (waiter) { sfx('ui_click', .3); const w = waiter; waiter = null; w(); }
}
function say(l){
  return new Promise(res => {
    affNow = {};
    $('choices').innerHTML = '';
    const name = sub(l.name || (l.speaker ? ((l.alias && !met(l.speaker)) ? l.alias : shownName(l.speaker)) : (l.think ? 'Rowan' : null)));
    speakerId = l.speaker && l.speaker !== 'rowan' ? l.speaker : ((l.speaker === 'rowan' || l.think) ? '__rowan' : null);
    if (speakerId && speakerId !== '__rowan') { addActor(speakerId); markSeen(speakerId); }
    expireActors(speakerId);
    renderConv();
    hist.push({ name, text: sub(l.text), think: !!l.think, shake: !!l.shake }); if (hist.length > 300) hist.shift();
    review = null;
    waiter = () => { $('more').hidden = true; res(); };
    updateReview();
  });
}
function markSeen(id){ if (!DATA.people[id]) return; if (!S.seen) S.seen = {}; if (!S.seen[id]) { S.seen[id] = 1; save(); } }
function choose(c){
  return new Promise(res => {
    const box = $('choices'); box.innerHTML = ''; review = null; speakerId = null; renderConv(); affNow = {};
    clearInterval(typeTimer); typingDone = true;
    if (c.prompt) { $('spk').hidden = true; $('txt').className = ''; $('txt').innerHTML = '<span id="prompt">' + renderSegs(parseInline(sub(c.prompt)), 9999) + '</span>'; }
    c.options.forEach((o, i) => { const b = document.createElement('button'); const who = (o.who || []).filter(met).map(w => shownName(w).split(' ')[0]); b.innerHTML = renderSegs(parseInline(sub(o.text)), 9999) + ((o.hint || who.length) ? '<small>' + esc((who.length ? 'with ' + who.join(', ') : '') + (who.length && o.hint ? ' · ' : '') + (o.hint || '')) + '</small>' : ''); b.onclick = (e) => { e.stopPropagation(); unlockAudio(); sfx('ui_click', .4); box.innerHTML = ''; res(i); }; box.appendChild(b); });
    $('more').hidden = true; $('choices').hidden = false; $('bPresent').hidden = true; $('review').hidden = true; $('bBack').disabled = hist.length < 1;
  });
}
function addTime(m){ if (!m) return; mutate(s => { s.minutes += m; while (s.minutes >= 1440) { s.minutes -= 1440; s.day++; } }); }

// ───────── Popups: kennengelernt, Zuneigung, Deck ─────────
function toast(kind, head, sub, id){
  head = sub_(head); sub = sub_(sub);
  const t = document.createElement('div'); t.className = 'toast ' + kind;
  if (id) t.appendChild(headCanvas(id, 64));
  const d = document.createElement('div'); d.innerHTML = '<b>' + head + '</b>' + (sub ? '<small>' + sub + '</small>' : ''); t.appendChild(d);
  $('toasts').appendChild(t); setTimeout(() => t.remove(), 4800); while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  return t;
}
// Pro Textbox und Figur höchstens EIN Zuneigungs-Popup: weitere Änderungen derselben Figur seit dem letzten Text werden zusammengelegt.
let affNow = {};
function affHtml(nm, n, why){ return esc(nm) + ' <span class="' + (n >= 0 ? 'up' : 'dn') + '">' + (n > 0 ? '▲ +' : n < 0 ? '▼ ' : '● ') + n + '</span>'; }
const sub_ = (s) => (typeof s === 'string' ? sub(s) : s);
const aliasName = (id) => DATA.alias[id] || castName(id);
function popup(p){
  const nm = (p.type === 'aff' && !met(p.id)) ? aliasName(p.id) : shownName(p.id);
  if (p.type === 'met') { sfx('reveal', .5); toast('', 'New acquaintance', esc(p.name || nm), p.id); }
  else if (p.type === 'aff') {
    const prev = affNow[p.id];
    if (prev && prev.el.isConnected) {
      prev.n += p.n; prev.why = prev.why && p.why && prev.why !== p.why ? prev.why + ' · ' + p.why : (prev.why || p.why || '');
      prev.log.n = prev.n; prev.log.why = prev.why;
      prev.el.className = 'toast ' + (prev.n > 0 ? 'up' : prev.n < 0 ? 'down' : '');
      prev.el.querySelector('div').innerHTML = '<b>' + affHtml(nm, prev.n) + '</b><small>' + esc(prev.why) + '</small>';
      return;
    }
    const log = { id: p.id, n: p.n, why: p.why, day: S.day }; (S.affLog = S.affLog || []).push(log);
    sfx(p.n > 0 ? 'buff' : 'debuff', .45);
    const el = toast(p.n > 0 ? 'up' : p.n < 0 ? 'down' : '', affHtml(nm, p.n), esc(p.why || ''), p.id);
    affNow[p.id] = { el, n: p.n, why: p.why || '', log };
  }
  else if (p.type === 'deck') { sfx('ping', .5); const d = DATA.people[p.id]; toast('deck', 'Deck learned', esc((d && d.deck ? d.deck.name : '') + ' · ' + nm), p.id); }
}
function affection(id){ let v = (DATA.startAff[id] != null ? DATA.startAff[id] : DATA.startAff['default'] != null ? DATA.startAff['default'] : 8); v += (S.vars['aff_' + id] || 0); return Math.max(0, Math.min(100, v)); }
function stageOf(id, v){ const list = DATA.stages.friend; for (const s of list) if (v <= s.cap) return { name: s.name, cap: s.cap }; return { name: list[list.length - 1].name, cap: 100 }; }

const io = {
  state: () => S, mutate, sleep, say, choose, addTime, popup,
  setBg(n){ sceneBg(n); },
  clearActors(){ actors = []; renderConv(); },
  enter(id){ const sp = (W.cast[id] && W.cast[id].sprite) || id; addActor(sp); markSeen(sp); },
  exit(id){ actors = actors.filter(a => a !== id); renderConv(); },
  move(){}, face(){}, dim(){}, music(n){ if (MUSIC[n]) { musicOverride = true; setMusic(n); } },
  fx: async (name, ms) => { const f = $('fade'); if (name === 'fadeout') { f.classList.add('on'); await sleep(Math.min(ms || 400, 900)); } else if (name === 'fadein') { f.classList.remove('on'); await sleep(Math.min(ms || 400, 900)); } else if (name === 'flash' || name === 'shake') { await sleep(150); } }, revealCards: async () => {},
  applyReward: async (r) => { mutate(s => { if (r.coins) s.coins = Math.max(0, s.coins + r.coins); for (const f of r.flags || []) s.flags[f] = true; }); },
  duel: (step) => new Promise(res => {
    $('spk').hidden = false; $('spk').textContent = 'DUEL'; $('txt').className = '';
    $('txt').innerHTML = 'Duel vs. <strong>' + esc(met(step.opponent) ? (S.names && S.names[step.opponent]) || step.opponentName || step.opponent : aliasName(step.opponent)) + '</strong>' + (step.ante ? ' (ante)' : '') + '. <span class="note">Preview build: the real game plays this out. Pick the result to test the branches.</span>';
    const box = $('choices'); box.innerHTML = '';
    [['I win', true], ['I lose', false]].forEach(([t, v]) => { const b = document.createElement('button'); b.textContent = t; b.onclick = (e) => { e.stopPropagation(); sfx(v ? 'victory' : 'debuff', .5); box.innerHTML = ''; res(v); }; box.appendChild(b); });
    $('more').hidden = true;
  }),
  deckEdit: async () => {},
  gameOver: async (t) => { await new Promise(res => showPanel('The end of this build', '<pre>' + esc(t || '') + '</pre>', res)); },
  playScene: (id, nested) => playScene(id, nested),
  goTo: async (id, cost) => travel(id, cost, true),
};
const runner = cmpMakeRunner(io);

// ───────── Ablauf: Karte = Erkundung, Gespräch = Szene ─────────
async function fade(fn){ const f = $('fade'); f.classList.add('on'); await sleep(300); await fn(); await sleep(70); f.classList.remove('on'); }
function setView(v){ view = v; $('conv').hidden = v !== 'conv'; $('cactors').hidden = v !== 'conv'; $('mapRoot').hidden = v !== 'map'; if (CMAP) CMAP.pause(v !== 'map'); }
async function playScene(id, nested){
  const sc = STORY.scenes[id];
  if (!sc) { console.error('Scene missing', id); return null; }
  if (sc.once && S.scenesDone[id]) return null;
  if (!cmpCond(S, sc.when)) return null;
  if (sc.background !== undefined) sceneBg(sc.background);
  if (sc.music !== undefined) io.music(sc.music);
  let res = null;
  try { res = await runner.runSteps(sc.steps || []); } catch (e) { console.error('Scene ' + id, e); await say({ text: '[Error in scene ' + id + ': ' + e.message + ']' }); }
  mutate(s => { s.scenesDone[id] = true; });
  if (sc.time) addTime(sc.time);
  return res;
}
function dayEndDue(){ const de = W.dayEnd; return !!(de && S.minutes >= cmpTime(de.at, 1439)); }
function pickEvent(){
  for (const ev of W.events || []) {
    if (!ev || !ev.scene) continue;
    if (ev.once !== false && S.eventsDone[ev.id || ev.scene]) continue;
    if (ev.at && ev.at !== S.location) continue;
    if (ev.day != null && ev.day !== S.day) continue;
    if (ev.from != null && S.minutes < cmpTime(ev.from)) continue;
    if (ev.to != null && S.minutes >= cmpTime(ev.to)) continue;
    if (!cmpCond(S, ev.when)) continue;
    return ev;
  }
  return null;
}
function arriveScene(){ const loc = W.locations[S.location] || {}, arr = loc.onArrive; if (!arr) return null; for (const a of Array.isArray(arr) ? arr : [{ scene: arr }]) { if (!cmpCond(S, a.when)) continue; if (a.once !== false && S.scenesDone[a.scene]) continue; return a.scene; } return null; }
const hasPending = () => dayEndDue() || !!pickEvent();
async function afterScene(){
  const de = W.dayEnd;
  if (dayEndDue()) { if (de.scene && STORY.scenes[de.scene]) await playScene(de.scene, true); else mutate(s => { s.day++; s.minutes = cmpTime(de.wake, 420); }); if (de.location) mutate(s => { s.location = de.location; }); }
  let guard = 0, ev;
  while ((ev = pickEvent()) && guard++ < 6) { mutate(s => { s.eventsDone[ev.id || ev.scene] = true; }); await playScene(ev.scene, true); }
}
// Ein Gespräch: Überblendung ins Gespräch, Szene(n) spielen, danach zurück zur Karte.
// keepLoc: Ort, an dem Rowan nach dem Gespräch weiterläuft; steht er dort noch, kehrt er auf den Pixel zurück (kein Teleport zum Ortsanfang).
async function conversation(fn, preset, keepLoc){
  if (busy) return; busy = true; updateBar();
  const pos = CMAP && view === 'map' ? { map: CMAP.A.id, x: CMAP.P.x, y: CMAP.P.y } : null;
  await fade(async () => { actors = []; lastSpoke = {}; (preset || []).forEach(id => { actors.push(id); lastSpoke[id] = hist.length; loadFig(id); }); speakerId = null; setBg((W.locations[S.location] || {}).background); setView('conv'); renderConv(); $('choices').innerHTML = ''; });
  try { await fn(); await afterScene(); } catch (e) { console.error(e); }
  await fade(async () => { actors = []; speakerId = null; $('choices').innerHTML = ''; setView('map'); syncMap(pos, keepLoc); });
  busy = false; locationMusic(); refresh();
}
const followerIds = () => following().map(id => (W.cast[id] && W.cast[id].sprite) || id);
async function talkTo(o){
  if (busy) return;
  const sprite = o.sprite;
  await conversation(async () => {
    let alone = false;
    if (o.at && o.at !== S.location) {
      await travel(o.at, undefined, true);
      // Wer zu Fuß ankommt, erlebt zuerst die Ankunftsszene des Ortes; Szenen mit "alone" stehen für sich (danach spricht man die Person erneut an).
      const arr = arriveScene(); if (arr) { await playScene(arr, true); alone = !!(STORY.scenes[arr] && STORY.scenes[arr].alone); }
    }
    if (!alone && o.scene && cmpCond(S, o.when)) await playScene(o.scene, true);
  }, [sprite], o.at || S.location);
}
async function talkFollower(id){
  if (busy) return; const sc = DATA.followers[id]; if (!sc) return;
  await conversation(async () => { await playScene(sc, true); }, [id], S.location);
}
async function runAction(a){ if (busy || !a.scene) return; await conversation(async () => { await playScene(a.scene, true); }, [], S.location); }
async function travel(id, cost, fromScene){
  const loc = W.locations[id]; if (!loc) return;
  const c = cost != null ? cost : cmpTravelCost(W, S, id);
  mutate(s => { s.location = id; s.visited[id] = (s.visited[id] || 0) + 1; if (s.known.indexOf(id) < 0) s.known.push(id); });
  addTime(c); sceneBg(loc.background); musicOverride = false; if (!fromScene) locationMusic();
}
async function goPlace(id){
  if (busy) return;
  const info = placeInfo(id); if (!info || !info.ok || id === S.location) return;
  await conversation(async () => { await travel(id, undefined, true); const sc = arriveScene(); if (sc) await playScene(sc, true); }, []);
}
async function wait15(){ if (busy) return; addTime(15); if (hasPending()) await conversation(async () => {}, [], S.location); else refresh(); }
async function oneHour(){ if (busy) return; addTime(60); if (hasPending()) await conversation(async () => {}, [], S.location); else refresh(); }

// ───────── Karte (CalderaMap aus dem alten Artefakt) ─────────
let mapPeopleKey = '', alertFrame = 0, followKey = '';
function blankSprite(col){ const c = document.createElement('canvas'); c.width = 18; c.height = 22; const g = c.getContext('2d'); g.fillStyle = '#141020'; g.fillRect(5, 1, 8, 8); g.fillRect(3, 9, 12, 12); g.fillStyle = col; g.fillRect(6, 2, 6, 6); g.fillRect(4, 10, 10, 10); return c; }
function bangSprite(base, up){ const w = Math.max(18, base.width), h = Math.max(22, base.height); const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (base.ppNative) { c.ppNative = true; g.drawImage(base, Math.round((w - base.width) / 2), (h - base.height) + (up ? -1 : 0)); } else g.drawImage(base, 0, up ? -1 : 0); g.fillStyle = '#000'; g.fillRect(w - 6, 0, 5, 9); g.fillStyle = '#e8c170'; g.fillRect(w - 5, 1, 3, 5); g.fillRect(w - 5, 7, 3, 1); return c; }
function smallOf(id){ const r = figs.get(id) || (loadFig(id), figs.get(id)); return (r && r.small) || blankSprite('#a79fc0'); }
function mapPeople(){
  const list = [];
  for (const [lid, loc] of Object.entries(W.locations)) for (const o of (loc.objects || [])) {
    if (!cmpCond(S, o.when)) continue;
    if (S.flags['follow_' + o.sprite]) continue;
    let spr = smallOf(o.sprite); const alert = o.alert != null && cmpCond(S, o.alert);
    if (alert) spr = bangSprite(spr, alertFrame === 1);
    list.push({ id: o.id, name: o.label || o.id, sprite: spr, place: lid, alert, ready: !!(figs.get(o.sprite) && figs.get(o.sprite).ok) });
  }
  return list;
}
function refreshMapPeople(force){
  if (!CMAP) return;
  const list = mapPeople(), key = list.map(p => p.id + '@' + p.place + (p.alert ? '!' + alertFrame : '') + (p.ready ? 1 : 0)).join(',');
  if (!force && key === mapPeopleKey) return; mapPeopleKey = key;
  try { CMAP.setPeople(list.map(p => ({ id: p.id, name: p.name, sprite: p.sprite, place: p.place }))); } catch (e) { console.warn('setPeople', e); }
}
function refreshFollowers(){
  if (!CMAP) return; const ids = following(), key = ids.join(',') + '|' + ids.map(i => (figs.get(i) && figs.get(i).ok) ? 1 : 0).join('');
  if (key === followKey) return; followKey = key;
  try { CMAP.setFollowers(ids.map(id => ({ id, name: '', sprite: smallOf(id) }))); } catch (e) { console.warn('followers', e); }
}
function syncMap(pos, keepLoc){
  if (!CMAP) return;
  try {
    if (pos && keepLoc != null && S.location === keepLoc) { CMAP.goTo(pos.map, Math.floor(pos.x / 16), Math.floor((pos.y - 1) / 16)); lastMapLoc = S.location; }
    else if (lastMapLoc !== S.location) { CMAP.goPlace(S.location); lastMapLoc = S.location; }
  } catch (e) {}
  refreshMapPeople(true); followKey = ''; refreshFollowers(); updateBar();
}
function placeInfo(id){
  const loc = W.locations[id]; if (!loc) return null;
  if (!S.known.includes(id)) return { ok: false, why: 'You have not heard of this place yet.' };
  if (S.locked[id]) return { ok: false, why: loc.lockedText || 'Not reachable now.' };
  if (!cmpCond(S, loc.when)) return { ok: false, why: loc.closedText || 'Closed right now.' };
  return { ok: true, name: loc.name || id, cost: id === S.location ? 0 : cmpTravelCost(W, S, id) };
}
async function initMap(){
  if (!window.CalderaMap) { return; }
  try {
    CMAP = await window.CalderaMap.create({ stage: $('mapRoot'), base: 'assets/map/', hero: blankSprite('#e8c170'), minimap: false, german: false,
      canAct: () => view === 'map' && !busy && $('overlay').hidden,
      onPlace: (p) => { near = p; updateBar(); },
      onTalk: (npc) => { if (DATA.followers[npc.id]) { if (view === 'map') { sfx('ui_prompt_open', .4); talkFollower(npc.id); } return; } const all = Object.entries(W.locations).flatMap(([lid, l]) => (l.objects || []).map(o => Object.assign({}, o, { at: lid }))); const o = all.find(x => x.id === npc.id); if (o && view === 'map') { sfx('ui_prompt_open', .4); talkTo(o); } },
    });
    CMAP.pause(true);
    setInterval(() => { if (view === 'map') { alertFrame ^= 1; refreshMapPeople(); } }, 500);
  } catch (e) { console.warn('map failed', e); }
}

// ───────── Leiste unter der Karte ─────────
function updateBar(){
  const bar = $('bar'); bar.innerHTML = '';
  if (busy || view !== 'map') { bar.hidden = true; return; } bar.hidden = false;
  const loc = W.locations[S.location] || {};
  const mk = (t, fn, cls, dis) => { const b = document.createElement('button'); b.textContent = t; if (cls) b.className = cls; b.disabled = !!dis; b.onclick = () => { unlockAudio(); fn(); }; return b; };
  const r1 = document.createElement('div'); r1.className = 'row'; r1.innerHTML = '<span class="lbl">HERE</span><span class="near">' + esc(loc.name || S.location) + '</span>';
  for (const a of (loc.actions || []).filter(a => cmpCond(S, a.when))) r1.appendChild(mk(a.label + (a.time ? '  +' + a.time + ' min' : ''), () => runAction(a)));
  r1.appendChild(mk('Wait 15 minutes', wait15)); bar.appendChild(r1);
  const p = near && near.id, info = p && W.locations[p] ? placeInfo(p) : null;
  if (info && p !== S.location) { const r2 = document.createElement('div'); r2.className = 'row'; r2.innerHTML = '<span class="lbl">NEARBY</span><span class="near">' + esc(near.name) + '</span>'; r2.appendChild(mk(info.ok ? 'Go there  +' + info.cost + ' min' : info.why, () => goPlace(p), 'go', !info.ok)); bar.appendChild(r2); }
  const fl = following(); if (fl.length) { const r3 = document.createElement('div'); r3.className = 'row'; r3.innerHTML = '<span class="lbl">WITH YOU</span>'; for (const id of fl) { const sc = DATA.followers[id]; r3.appendChild(mk('Talk to ' + castName(id), () => talkFollower(id))); } bar.appendChild(r3); }
  const hint = document.createElement('div'); hint.className = 'note'; hint.textContent = 'Arrows / WASD: walk · Space: look and talk · talk to a person on the map to start a conversation'; bar.appendChild(hint);
}
function refresh(){ renderTop(); refreshFollowers(); refreshMapPeople(false); updateBar(); locationMusic(); }

// ───────── Ansichten: Personen, Deck, Sammlung ─────────
function showPanel(title, html, cb){
  const o = $('overlay'); o.hidden = false;
  o.innerHTML = '<div><h2>' + esc(title) + '</h2><div id="pbody">' + html + '</div><p><button id="ovok">Close</button></p></div>';
  $('ovok').onclick = () => { o.hidden = true; o.innerHTML = ''; if (cb) cb(); };
}
function openPanel(tab){
  unlockAudio(); sfx('ui_prompt_open', .35);
  const o = $('overlay'); o.hidden = false;
  const draw = (t, arg) => {
    const tabs = '<div class="tabs">' + [['people', 'People'], ['deck', 'Deck'], ['coll', 'Collection']].map(([k, n]) => '<button data-tab="' + k + '" class="' + (k === t ? 'on' : '') + '">' + n + '</button>').join('') + '</div>';
    o.innerHTML = '<div><h2>' + ({ people: 'People you know', deck: 'Your deck', coll: 'Your collection' }[t]) + '</h2>' + tabs + '<div id="pbody"></div><p><button id="ovok">Close</button></p></div>';
    o.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => draw(b.dataset.tab));
    $('ovok').onclick = () => { o.hidden = true; o.innerHTML = ''; };
    if (t === 'people') peoplePanel(arg, draw); else deckPanel(t === 'coll');
  };
  draw(tab || 'people');
}
function peoplePanel(sel, draw){
  const body = $('pbody'); const ids = Object.keys(DATA.people).filter(id => met(id) || (S.seen && S.seen[id]));
  if (sel && DATA.people[sel]) {
    const p = DATA.people[sel], v = affection(sel), st = stageOf(sel, v);
    let h = '<p><button id="pback">◀ All people</button></p><div class="det"><div class="pcard" id="pic"></div><b style="font-family:var(--title);font-size:22px;color:var(--gold)">' + esc(met(sel) ? shownName(sel) : aliasName(sel)) + '</b>' + (met(sel) ? '' : '<div class="note">You have not been introduced.</div>');
    const nts = (S.notes && S.notes[sel]) || [];
    h += '<div class="hh">WHAT YOU KNOW</div>' + (nts.length ? nts.map(x => '<div>· ' + esc(sub(x)) + '</div>').join('') : '<div class="note">' + (met(sel) ? 'Only that you have met.' : 'Nothing yet.') + '</div>');
    if (met(sel)) h += '<div class="hh">HOW YOU STAND</div><div>' + esc(st.name) + ' · ' + v + '/' + st.cap + '</div><div class="bar"><i style="width:' + v + '%"></i></div>';
    const log = (S.affLog || []).filter(a => a.id === sel).slice(-6).reverse();
    if (log.length) h += '<div class="note">' + log.map(a => (a.n > 0 ? '▲ +' : '▼ ') + a.n + ' ' + esc(a.why || '')).join(' · ') + '</div>';
    if (met(sel)) h += '<div class="hh">DECK</div>';
    if (met(sel) && S.flags['deck_known_' + sel] && p.deck) h += '<div><b>' + esc(p.deck.name) + '</b></div><div class="note">Heroes: ' + esc(p.deck.heroes.join(', ')) + '</div>' + p.deck.key.map(k => '<div class="eff"><b>' + esc(k[0]) + '</b>: ' + esc(k[1]) + '</div>').join('');
    else if (met(sel)) h += '<div class="note">You do not know what ' + esc(shownName(sel).split(' ')[0]) + ' plays yet. Ask, or guess from the clues.</div>';
    const bonds = p.bonds.filter(b => knowsRel(sel, b.w) && DATA.people[b.w]);
    if (met(sel)) h += '<div class="hh">RELATIONSHIPS YOU KNOW OF</div>' + (bonds.length ? bonds.map(b => '<div>' + esc(met(b.w) ? shownName(b.w) : aliasName(b.w)) + ' — ' + esc(b.label) + '</div>').join('') : '<div class="note">Nothing yet.</div>');
    h += '</div>'; body.innerHTML = h;
    $('pic').appendChild(headCanvas(sel, 48)); $('pback').onclick = () => draw('people');
    return;
  }
  if (!ids.length) { body.innerHTML = '<div class="note">You have not met anyone yet.</div>'; return; }
  const g = document.createElement('div'); g.className = 'pgrid';
  ids.forEach(id => { const p = DATA.people[id], v = affection(id), st = stageOf(id, v); const b = document.createElement('button'); b.className = 'pcard'; b.appendChild(headCanvas(id, 48)); const d = document.createElement('div'); d.style.minWidth = 0; d.innerHTML = met(id) ? ('<b>' + esc(shownName(id).split(' ')[0]) + '</b><small>' + esc(st.name) + ' · ' + v + '</small><div class="bar"><i style="width:' + v + '%"></i></div>' + (S.flags['deck_known_' + id] && p.deck ? '<small>' + esc(p.deck.name) + '</small>' : '')) : ('<b>' + esc(aliasName(id)) + '</b><small>not introduced</small>'); b.appendChild(d); b.onclick = () => draw('people', id); g.appendChild(b); });
  body.innerHTML = ''; body.appendChild(g);
}
function deckPanel(coll){
  const R = DATA.rowan, body = $('pbody');
  const byType = {}; for (const c of R.main) { const t = (c.type || 'Other').replace(/\s*\(.*$/, ''); (byType[t] = byType[t] || []).push(c); }
  const own = (c) => coll ? ((S.collection && S.collection[c.name]) || 0) + c.n : c.n;
  const nMain = R.main.reduce((a, c) => a + c.n, 0), nPot = R.potions.reduce((a, c) => a + c.n, 0), nAb = R.heroes.reduce((a, h) => a + h.abilities.length, 0);
  let h = coll ? '<div class="note">Everything you own. Cards you win in the story are added here.</div>' : '<div class="note">' + esc(R.name) + ' · ' + R.heroes.length + ' Heroes + ' + nAb + ' starting Abilities + ' + nMain + ' main deck + ' + nPot + ' potions = <b>' + (R.heroes.length + nAb + nMain + nPot) + ' cards</b></div>';
  h += '<div class="hh">HEROES (' + R.heroes.length + ') AND STARTING ABILITIES (' + nAb + ')</div><div class="cl">' + R.heroes.map(x => '<button data-c="h:' + esc(x.name) + '"><span class="n">1</span><span>' + esc(x.name) + '<br><span class="note">' + esc(x.abilities.join(' + ')) + '</span></span></button>').join('') + '</div>';
  for (const [t, list] of Object.entries(byType)) h += '<div class="hh">' + esc(t.toUpperCase()) + ' (' + list.reduce((a, c) => a + c.n, 0) + ')</div><div class="cl">' + list.map(c => '<button data-c="m:' + esc(c.name) + '"><span class="n">' + own(c) + '</span><span>' + esc(c.name) + '</span></button>').join('') + '</div>';
  h += '<div class="hh">POTION DECK (' + nPot + ')</div><div class="cl">' + R.potions.map(c => '<button data-c="p:' + esc(c.name) + '"><span class="n">' + own(c) + '</span><span>' + esc(c.name) + '</span></button>').join('') + '</div><div class="eff" id="ceff">Click a card to read its text.</div>';
  if (coll) { const its = Object.entries(S.items || {}); h += '<div class="hh">THINGS YOU CARRY</div>' + (its.length ? its.map(i => '<div>' + esc(i[0]) + (i[1] > 1 ? ' x' + i[1] : '') + '</div>').join('') : '<div class="note">Nothing but what you came with.</div>'); }
  body.innerHTML = h;
  body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const k = b.dataset.c.slice(0, 1), n = b.dataset.c.slice(2); const list = k === 'h' ? R.heroes : k === 'm' ? R.main : R.potions; const c = list.find(x => x.name === n); $('ceff').innerHTML = '<b>' + esc(n) + '</b> · ' + esc(c.type || '') + '<br>' + esc(c.effect || ''); });
}

document.addEventListener('keydown', (e) => {
  unlockAudio();
  if (view !== 'conv' || !$('overlay').hidden) return;
  if ((e.key === ' ' || e.key === 'Enter') && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); advance(); }
  if (e.key === 'ArrowLeft') back(); if (e.key === 'ArrowRight') stepForward();
});
document.addEventListener('pointerdown', unlockAudio, { once: true });
$('box').addEventListener('click', () => advance());
$('bBack').onclick = (e) => { e.stopPropagation(); back(); };
$('bPresent').onclick = (e) => { e.stopPropagation(); toPresent(); };
$('bPeople').onclick = () => openPanel('people'); $('bDeck').onclick = () => openPanel('deck'); $('bColl').onclick = () => openPanel('coll');
$('bLog').onclick = () => { showPanel('Log (last 60 lines)', '<pre>' + esc(hist.slice(-60).map(h => (h.name ? h.name + ': ' : '') + h.text).join('\n')) + '</pre>'); const b = $('pbody'); if (b) b.scrollTop = b.scrollHeight; const o = $('overlay'); if (o && o.firstChild) o.firstChild.scrollTop = o.firstChild.scrollHeight; };
$('bDebug').onclick = () => showPanel('Flags and variables', '<pre>' + esc(Object.keys(S.flags).sort().join(', ') + '\n\n' + JSON.stringify(S.vars)) + '</pre>');
$('bTime').onclick = () => oneHour();
$('bSnd').onclick = () => { unlockAudio(); toggleSound(); };
$('bReset').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); };
function askName(){
  return new Promise(res => {
    const o = $('overlay'); o.hidden = false;
    const fld = 'font:inherit;font-size:22px;padding:6px 10px;background:#1b1626;color:#f3e9c8;border:2px solid #c8a85a;width:100%;box-sizing:border-box';
    o.innerHTML = '<div><p style="font-size:22px">What name was written on your acceptance letter?</p>'
      + '<p style="display:flex;gap:12px;flex-wrap:wrap"><label style="flex:1;min-width:200px">First name<br><input id="pnIn" maxlength="14" value="' + esc(PN()) + '" style="' + fld + '"></label>'
      + '<label style="flex:1;min-width:200px">Last name<br><input id="plIn" maxlength="14" value="' + esc(LN()) + '" style="' + fld + '"></label></p>'
      + '<p style="text-align:center;margin-top:20px"><button id="pnOk" style="font:inherit;font-size:28px;padding:12px 56px">Start</button></p></div>';
    const clean = (v, d) => (v || '').replace(/[<>&]/g, '').trim().slice(0, 14) || d;
    const go = () => { S.vars = S.vars || {}; S.vars.pn = clean($('pnIn').value, 'Rowan'); S.vars.pl = clean($('plIn').value, 'Vance'); S.flags.pn_set = true; save(); o.hidden = true; o.innerHTML = ''; res(); };
    $('pnOk').onclick = go; for (const id of ['pnIn', 'plIn']) $(id).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    setTimeout(() => { try { $('pnIn').focus(); $('pnIn').select(); } catch (e) {} }, 50);
  });
}
(async () => {
  S = load() || newState(); renderTop(); $('bSnd').textContent = audioOn ? '♪ On' : '♪ Off';
  setBg((W.locations[S.location] || {}).background); setView('conv'); await initMap();
  setMusic((W.locations[S.location] || {}).music || 'ship');
  if (!S.flags.pn_set && !(new URLSearchParams(location.search).has('nopn'))) await askName();
  await conversation(async () => { const sc = arriveScene(); if (sc) await playScene(sc, true); }, []);
})();
`;

const html = `<meta charset="utf-8">
<title>Academy Playtest</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600&family=VT323&display=swap">
<style>${css}</style>
<div id="app">
  <div id="top"><div id="clock"></div><div id="where"></div><button class="sm" id="bPeople">People</button><button class="sm" id="bDeck">Deck</button><button class="sm" id="bColl">Cards</button><button class="sm" id="bTime" title="Skip an hour">+1 h</button><button class="sm" id="bLog">Log</button><button class="sm" id="bDebug">Flags</button><button class="sm" id="bSnd">♪ On</button><button class="sm" id="bReset">Restart</button></div>
  <div id="stage">
    <div id="conv"></div><div id="cactors"></div>
    <div id="mapRoot" hidden></div>
    <div id="bglabel"></div>
    <div id="toasts"></div>
    <div id="fade"></div>
  </div>
  <div id="box"><div id="review" hidden></div><div id="spk" hidden></div><div id="txt"></div><div id="choices"></div><div id="more" hidden>▼</div><button id="bBack" title="Read the previous textbox again" disabled>◀ Back</button><button id="bPresent" hidden>To Present ▶▶</button></div>
  <div id="bar" hidden></div>
</div>
<div id="overlay" hidden></div>
<script>
const STORY={world:null,scenes:{}};
const DATA=${JSON.stringify(DATA)};
function defineWorld(def){const prev=STORY.world||{},d=def||{},m=Object.assign({},prev,d);m.locations=Object.assign({},prev.locations||{},d.locations||{});m.cast=Object.assign({},prev.cast||{},d.cast||{});m.events=(prev.events||[]).concat(d.events||[]);STORY.world=m;}
function defineScene(id,def){STORY.scenes[id]=Object.assign({id},def);}
${engine}
function cmpSfx(k){ var m = { coins: 'shop_purchase', item: 'reveal', itemLoss: 'debuff', spend: 'ui_click', learn: 'ping' }; if (m[k] && window.playSFX) window.playSFX(m[k]); }
</script>
<script src="engine.js"></script>
${sceneScripts}
<script>${ui}</script>
`;
const out = path.join(ROOT, 'dist', 'preview');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html, { encoding: 'utf8' });
const list = ['engine.js', 'assets/map/world.json', 'assets/map/ground.png', 'assets/map/objects.png',
  ...[...need.bg].sort().map(b => `assets/bg/${b}.png`), ...[...need.portraits].sort().map(p => `assets/portraits/${p}.png`), ...[...need.sprites].sort().map(p => `assets/sprites/${p}.png`),
  ...[...need.music].sort(), ...[...need.sounds].sort().map(s => `sounds/${s}.ogg`)];
fs.writeFileSync(path.join(out, 'assets.json'), JSON.stringify(list, null, 1));
let n = 0;
const enginePatch = (src) => {
  const a = "const sx = sheet.width >= 36 ? frame * 18 : 0, oy = sheet.width >= 36 ? 0 : frame;";
  if (!src.includes(a)) throw new Error('engine.js: drawFigure nicht gefunden');
  const b = "if (sheet.ppNative) { const w = sheet.width, h = sheet.height, nx = Math.round(wx - w / 2 - cam.x), ny = Math.round(wy - h + 1 - cam.y) + (frame ? 1 : 0); if (face < 0) { g.save(); g.translate(nx + w, ny); g.scale(-1, 1); g.drawImage(sheet, 0, 0); g.restore(); } else g.drawImage(sheet, nx, ny); return; }\n      " + a;
  return src.replace(a, b);
};
// Kartenkorrekturen: Dialog und Karte müssen zusammenpassen (Salon mit gepolsterten blauen Bänken statt roter Theatersitze).
const worldPatch = (D) => {
  const idx = (n) => D.names.indexOf(n);
  const lounge = D.maps && D.maps['ferry__0'];
  if (lounge && idx('i_seats') >= 0 && idx('i_sofa_blue') >= 0) {
    for (const o of lounge.objs) if (o[0] === idx('i_seats')) o[0] = idx('i_sofa_blue');
    for (const pl of lounge.places || []) if (pl.id === 'ferry_lounge') pl.text = 'A long saloon so full of sun that you stop on the bottom stair. Padded blue benches run along the walls, duffel bags piled on every seat, and at the far end a galley hatch with a steel urn and the only real card table on the ship.';
  }
  return D;
};
for (const f of list) {
  let src = null;
  if (/^(music|sounds)\//.test(f)) src = path.join(REPO, 'public', f); else if (/^assets\/sprites\//.test(f)) src = path.join(ROOT, f.replace('assets/', '')); else if (ASSETS) src = path.join(ASSETS, f);
  if (!src) continue;
  if (!fs.existsSync(src)) { console.log('  fehlt: ' + f); continue; }
  const dst = path.join(out, f); fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (f === 'engine.js') fs.writeFileSync(dst, enginePatch(fs.readFileSync(src, 'utf8')));
  else if (f === 'assets/map/world.json') fs.writeFileSync(dst, JSON.stringify(worldPatch(JSON.parse(fs.readFileSync(src, 'utf8')))));
  else fs.copyFileSync(src, dst);
  n++;
}
console.log('preview: ' + (html.length / 1024).toFixed(0) + ' KB -> campaign/dist/preview/index.html · Assets kopiert: ' + n + '/' + list.length);
