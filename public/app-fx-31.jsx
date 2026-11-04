// app-fx-31: Treffer-Reaktion der Heldenfigur und Schnitt/Aufprall von Angriffen im Trailer-Look
//
// ═════════════════════════════════════════════════════════════════
//  1. TREFFER-REAKTION DER FIGUR (`ppFx31Treffer`)
//
//  Vorher: nahm ein Held Schaden, blitzte nur die KARTE (`.damage-flashing`, ein roter, weich ausblendender Alpha-Schleier über der Zone) — die animierte Figur (`HeroIdleSprite`)
//  stand unbewegt daneben. Trailer (shot01.js: `HIT`/`BLOCK`-Tabellen, `h.hits`): die FIGUR reagiert — 2–3 Bilder weißer Gegenschlag-Blitz auf der Silhouette, dann rot, Quetschen
//  (breit/flach) und Zurückfedern (hoch/schmal) am Fußpunkt, ein Hüpfer und Wackeln nach links/rechts, alles in ganzen Bildern (30 Hz), nichts weich.
//  Aufruf: `flashDamageOnZone(selector, schaden)` in app-board.jsx ruft `window.ppFx31Treffer(zonenElement, schaden)`; liefert es `true`, bleibt der rote Karten-Schleier aus.
//  Stärke nach Schadenshöhe (Stufen leicht < 30, mittel < 100, schwer < 250, gewaltig darüber; bei 0 Schaden passiert nichts: der Aufruf kommt nur bei echtem HP-Verlust).
//  Technik (verträgt sich mit Rammen, Quetschen, Aufstieg, Versteinern):
//    • Blitz = eigene Leinwand `canvas.pp-fx31-blitz` im `.hero-idle-holo`, direkt NACH der Figur-Leinwand, deckungsgleich (Silhouette der aktuellen Figur-Leinwand, per
//      `source-in` in Creme/Rot gefärbt; 3. Art: im Schachbrett gedithert). Sie hängt am Platz und wird wie die Nachbild-Leinwände von app-fx-27 im Leerlauf vorab angelegt und aufgewärmt
//      (erstes Zeichnen in eine frische sichtbare Leinwand kostete sonst 12–20 ms).
//    • Quetschen/Hüpfer/Wackeln = die EINZELEIGENSCHAFTEN `translate`/`scale` des `.hero-idle-holo` (Drehpunkt Füße). Der Platz (`translate` des Rammens, app-fx-27) und die Figur-
//      Leinwand (`scale` des Rammens, Hover-`scale` des Platzes, `transform`-Animationen Auftritt/Einfahren/Quetschen) bleiben unberührt. Fährt die Figur gerade (`zone._ppRammt`),
//      gibt es NUR den Blitz (die Leinwand spiegelt dann die Streckung der Fahrt), kein Quetschen.
//    • Keine Reaktion (→ alter Schleier läuft): keine Figur (Held ohne Sheet), Figur eingefahren (Hover/Zielwahl), versteinert, unsichtbar, im Aufstiegs-Morph.
//
//  2. SCHNITT/AUFPRALL (`critical_slash`, `quick_slash`)
//  Die beiden Registry-Effekte werden durch Fassungen im Trailer-Look ersetzt (Zeiten/`ende` und Tonhinweise bleiben: Server wartet darauf nicht, die Töne hängen an ZONE_ANIM_SFX):
//    • Critical Strike: dreifacher Schnitt LÄNGS der Rammbahn (Angreifer → Ziel; Richtung aus `play_ram_animation`, mitgeschrieben im Umhüller um `ppFx27RammFigur`), spitz zulaufende
//      Linie mit dunkler Kontur (innen creme, außen hellblau), wächst in 3 Bildern, bleibt ~7 Bilder dick, flackert aus; dazu Aufprall-Sternfächer, drei Ringe (creme/hellblau/blau,
//      die äußeren gedithert), Splitter (Quadrate und Pluszeichen), Blitzscheibe im Schachbrett; ohne Schriftzug (der Trailer zeigt keinen).
//    • Quick Slash: ein Diagonalschnitt (Trailer: von rechts oben nach links unten durch die Figur) plus ein dünner Zweitschnitt, kleine Ringe, ein paar Splitter.
//  Alles auf `ppR1Leinwand` (Rasterpixel 3 px, Bayer-Dithering, 30 Hz, `data-pp-px="aus"`), Farben aus der Palette.
// ═════════════════════════════════════════════════════════════════
const PP_FX31_BILD = 1000 / 30;
const PP_FX31_C = { creme: '#fffbd2', tinte: '#12101f', hblau: '#b3d8f9', blau: '#4580f6', rot: '#fe5154', gelb: '#ffe23d', orange: '#ff9a1a', dunkelrot: '#c80000', dunkelrot2: '#8f0000', dunkelgruen: '#167927', dunkelgruen2: '#29663f' };
// Blitzfarben der Figur: Schaden DUNKELROT (Art 1 hell, Art 2 dunkler, Art 3 gedithert), Heilung DUNKELGRÜN (Art 1/2/3 entsprechend)
const PP_FX31_BLITZ = { schaden: { 1: 'dunkelrot', 2: 'dunkelrot2', 3: 'dunkelrot' }, heilung: { 1: 'dunkelgruen', 2: 'dunkelgruen2', 3: 'dunkelgruen' } };
// Heilung: nur Blitz, kein Quetschen/Hüpfen (Bild = [Blitz, sx, sy, Hüpfer, Wackeln])
const PP_FX31_HEILUNG = [[1, 1, 1, 0, 0], [1, 1, 1, 0, 0], [2, 1, 1, 0, 0], [2, 1, 1, 0, 0], [3, 1, 1, 0, 0], [0, 1, 1, 0, 0], [3, 1, 1, 0, 0], [0, 1, 1, 0, 0]];

// ───────────────────────── 1. Treffer-Reaktion ─────────────────────────
// Bild = [Blitz (0 keiner | 1 creme | 2 rot | 3 creme gedithert), Streckung x, Streckung y, Hüpfer in px nach oben, Wackeln in px nach rechts] — die ersten acht Zeilen der mittleren Stufe
// sind die `HIT`-Tabelle des Trailers (shot01.js), die anderen Stufen daraus abgeleitet (leichter = kürzer/sanfter, schwerer = länger/kräftiger).
const PP_FX31_TREFFER = {
  leicht: [[1, 1.06, 0.93, 0, 0], [3, 1.03, 0.97, 0, 2], [0, 1.02, 0.99, 0, -2], [0, 1, 1, 0, 1]],
  mittel: [[1, 1.10, 0.85, 0, 0], [1, 1.15, 0.80, 0, 4], [2, 0.95, 1.10, 6, -4], [2, 0.95, 1.08, 8, 4], [3, 1.05, 0.95, 2, -3], [0, 1, 1, 0, 3], [0, 1, 1, 0, -2], [0, 1, 1, 0, 1]],
  schwer: [[1, 1.12, 0.78, 0, 0], [1, 1.16, 0.74, 0, 6], [2, 0.94, 1.14, 8, -6], [2, 0.94, 1.12, 10, 6], [2, 1.04, 0.95, 4, -5], [3, 1.06, 0.93, 3, 4], [0, 1.03, 0.98, 0, -4], [0, 1, 1, 0, 3], [0, 1, 1, 0, -2], [0, 1, 1, 0, 1]],
  gewaltig: [[1, 1.16, 0.72, 0, 0], [1, 1.2, 0.70, 0, 8], [1, 1.14, 0.80, 0, -8], [2, 0.92, 1.16, 10, 8], [2, 0.92, 1.14, 12, -8], [2, 0.95, 1.08, 6, 6], [3, 1.08, 0.92, 3, -5], [3, 1.04, 0.97, 0, 4],
    [0, 1.02, 0.99, 0, -3], [0, 1, 1, 0, 2], [0, 1, 1, 0, -1]],
};
function ppFx31Stufe(schaden) { return schaden < 30 ? 'leicht' : schaden < 100 ? 'mittel' : schaden < 250 ? 'schwer' : 'gewaltig'; }

/** Eigene Raster-Leinwand zum Ausstanzen der Silhouette (2×2-Schachbrett). */
let PP_FX31_RASTER = null;
function ppFx31Raster(ctx) {
  if (!PP_FX31_RASTER) {
    const c = document.createElement('canvas'); c.width = 2; c.height = 2;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(1, 0, 1, 1); g.fillRect(0, 1, 1, 1);
    PP_FX31_RASTER = ctx.createPattern(c, 'repeat');
  }
  return PP_FX31_RASTER;
}

/** Blitz-Leinwand im Holo des Platzes (angelegt, solange sie fehlt oder die Figur-Leinwand neu gemountet wurde). */
function ppFx31Blitz(platz) {
  const cv = platz.querySelector('canvas.hero-idle-canvas');
  if (!cv || !cv.width || !cv.parentNode) return null;
  let B = platz._ppFx31Blitz;
  if (B && B.c.isConnected && B.cv === cv) {
    if (B.c.width !== cv.width || B.c.height !== cv.height) { B.c.width = cv.width; B.c.height = cv.height; B.schluessel = ''; }
    return B;
  }
  if (B) { try { B.c.remove(); } catch (e) { /* weg */ } }
  const c = document.createElement('canvas');
  c.className = 'pp-fx31-blitz';
  c.width = cv.width; c.height = cv.height;
  c.style.cssText = 'position:absolute;left:0;top:0;display:block;pointer-events:none;image-rendering:pixelated;visibility:hidden;width:' + cv.style.width + ';height:' + cv.style.height
    + ';transform-origin:' + cv.style.transformOrigin;
  cv.parentNode.insertBefore(c, cv.nextSibling);
  B = { c, cv, ctx: c.getContext('2d'), schluessel: '', da: false };
  platz._ppFx31Blitz = B;
  return B;
}
/** Leerlauf-Aufwärmen: einmal in die (unsichtbare) Leinwand zeichnen. */
function ppFx31Aufwaermen(platz) {
  try {
    if (!platz || !platz.isConnected || platz._ppFx31Blitz) return;
    const B = ppFx31Blitz(platz);
    if (!B) return;
    B.ctx.drawImage(B.cv, 0, 0, B.cv.width, B.cv.height, 0, 0, B.c.width, B.c.height);
    B.ctx.globalCompositeOperation = 'source-in'; B.ctx.fillStyle = PP_FX31_C.creme; B.ctx.fillRect(0, 0, B.c.width, B.c.height);
    B.ctx.globalCompositeOperation = 'source-over'; B.ctx.clearRect(0, 0, B.c.width, B.c.height);
  } catch (e) { /* weg */ }
}
(function ppFx31Beobachter() {
  const plan = (platz) => {
    const los = () => ppFx31Aufwaermen(platz);
    setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 2000 }) : los()), 1300);
  };
  const haenge = (ebene) => {
    if (!ebene || ebene._ppFx31Beob) return;
    ebene._ppFx31Beob = true;
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType === 1 && n.classList && n.classList.contains('hero-idle-platz')) plan(n); } }).observe(ebene, { childList: true });
    ebene.querySelectorAll('.hero-idle-platz').forEach(plan);
  };
  const start = () => { if (window.HeroIdleAnims && window.HeroIdleAnims.abonniereEbene) { window.HeroIdleAnims.abonniereEbene(haenge); haenge(window.HeroIdleAnims.ebene()); } else setTimeout(start, 500); };
  start();
})();

/** Darf die Figur dieser Zone jetzt reagieren? */
function ppFx31KannTreffer(zone) {
  try {
    if (!zone || !zone.isConnected) return false;
    const platz = zone._ppFigurPlatz;
    if (!platz || !platz.isConnected || platz.style.display === 'none') return false;
    const cl = platz.classList;
    if (cl.contains('hero-idle-stein') || cl.contains('hero-idle-unsichtbar') || cl.contains('hero-idle-aufstieg') || cl.contains('hero-idle-weg')) return false;
    return !!(platz.querySelector('.hero-idle-holo') && platz.querySelector('canvas.hero-idle-canvas'));
  } catch (e) { return false; }
}

/**
 * Figur der Zone reagiert auf `schaden` (> 0). Gibt `true`, wenn die Reaktion läuft (der alte rote Karten-Schleier entfällt dann), sonst `false`.
 */
function ppFx31Treffer(zone, schaden, heilung) {
  if (!(schaden > 0) || window._playAnimations === false || !ppFx31KannTreffer(zone)) return false;
  const platz = zone._ppFigurPlatz, holo = platz.querySelector('.hero-idle-holo');
  const B = ppFx31Blitz(platz);
  if (!B) return false;
  if (zone._ppFx31) { try { zone._ppFx31.ende(); } catch (e) { /* weg */ } }
  const tab = heilung ? PP_FX31_HEILUNG : PP_FX31_TREFFER[ppFx31Stufe(schaden)], farben = PP_FX31_BLITZ[heilung ? 'heilung' : 'schaden'];
  const raf = window.ppTaktRaf || window.requestAnimationFrame;
  const R = { beendet: false, i: -1, t0: performance.now(), gesetzt: false };
  zone._ppFx31 = R;
  B.c.style.imageRendering = B.cv.style.imageRendering || 'pixelated';
  R.ende = () => {
    if (R.beendet) return;
    R.beendet = true;
    try { if (R.gesetzt) { holo.style.translate = ''; holo.style.scale = ''; } } catch (e) { /* weg */ }
    try { if (B.da) { B.c.style.visibility = 'hidden'; B.da = false; } } catch (e) { /* weg */ }
    if (zone._ppFx31 === R) zone._ppFx31 = null;
  };
  const zeichne = (art) => {
    const fr = platz._ppFrame | 0, schluessel = (heilung ? 'h' : 's') + art + '|' + fr;
    if (!B.da) { B.c.style.visibility = 'visible'; B.da = true; }
    if (schluessel === B.schluessel) return;
    B.schluessel = schluessel;
    const c = B.ctx, w = B.c.width, h = B.c.height;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, w, h);
    c.drawImage(B.cv, 0, 0, B.cv.width, B.cv.height, 0, 0, w, h);                      // Canvas → Canvas (GPU), kein Lesen von Pixeln
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = PP_FX31_C[farben[art] || 'dunkelrot'];
    c.fillRect(0, 0, w, h);
    if (art === 3) { c.globalCompositeOperation = 'destination-out'; c.fillStyle = ppFx31Raster(c); c.fillRect(0, 0, w, h); }
    c.globalCompositeOperation = 'source-over';
  };
  const schritt = () => {
    if (R.beendet) return;
    if (!zone.isConnected || zone._ppFigurPlatz !== platz || !platz.isConnected || !holo.isConnected || !ppFx31KannTreffer(zone)) { R.ende(); return; }
    const i = Math.floor((performance.now() - R.t0) / PP_FX31_BILD);
    if (i >= tab.length) { R.ende(); return; }
    if (i !== R.i) {
      R.i = i;
      const e = tab[i];
      if (!zone._ppRammt) {
        holo.style.translate = 'calc(' + e[4] + 'px * var(--board-scale, 1)) calc(' + (-e[3]) + 'px * var(--board-scale, 1))';
        holo.style.scale = e[1] + ' ' + e[2];
        R.gesetzt = true;
      } else if (R.gesetzt) { holo.style.translate = ''; holo.style.scale = ''; R.gesetzt = false; }
      if (e[0]) {
        if (zone._ppRammt) B.c.style.scale = B.cv.style.scale;                          // Fahrt: dieselbe Streckung wie die Figur
        else if (B.c.style.scale) B.c.style.scale = '';
        zeichne(e[0]);
      } else if (B.da) { B.c.style.visibility = 'hidden'; B.da = false; }
    }
    raf(schritt);
  };
  schritt();
  return true;
}
window.ppFx31Treffer = ppFx31Treffer;
/** Heilung: dunkelgrüner Blitz auf der Silhouette der Figur (gleicher Zeichenpfad wie der Treffer-Blitz, kein Quetschen). `true`, wenn er läuft. */
window.ppFx31Heilung = function (zone, betrag) { return ppFx31Treffer(zone, betrag > 0 ? betrag : 1, true); };

// ───────────────────────── 2. Schnitt / Aufprall ─────────────────────────
// Letzte Rammbahn (Angreifer → Ziel) mitschreiben: der Schnitt des Critical Strike liegt längs dieser Bahn (Trailer). Die Richtung wird erst beim Einhängen des Schnitts gemessen.
const PP_FX31_RAMM = { src: null, tgt: null, t: 0 };
(function ppFx31RammMerken() {
  const orig = window.ppFx27RammFigur;
  if (typeof orig !== 'function' || orig._ppFx31) return;
  const neu = function (ev) { try { PP_FX31_RAMM.src = ev.srcEl; PP_FX31_RAMM.tgt = ev.tgtEl; PP_FX31_RAMM.t = performance.now(); } catch (e) { /* weg */ } return orig.apply(this, arguments); };
  neu._ppFx31 = true;
  window.ppFx27RammFigur = neu;
})();

const PP_FX31_ZIEL = new WeakMap();   // props → { hero, dy (Anheben auf Körpermitte, px), dir [x, y] }
function ppFx31Ziel(p, schnell) {
  let z = PP_FX31_ZIEL.get(p);
  if (z) return z;
  const w = Math.max(p.w || 60, 40), h = Math.max(p.h || 80, 48);
  z = { hero: false, dy: 0, dir: schnell ? [-0.58, 0.81] : [-0.6, 0.8], h };
  try {
    const off = (p.welt && window.ppFxScrollOffset) ? window.ppFxScrollOffset() : { dx: 0, dy: 0 };
    let best = null, bd = 1e9;
    document.querySelectorAll('[data-hero-zone]').forEach((el) => {
      const r = el.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 + off.dx - p.x, r.top + r.height / 2 + off.dy - p.y);
      if (d < bd) { bd = d; best = el; }
    });
    if (best && bd < Math.max(w, h) * 0.55) {
      z.hero = true;
      z.dy = Math.round(h * 0.42);                                                        // Körpermitte der Figur liegt über der Kartenmitte (Füße stehen auf ihr)
      if (!schnell && PP_FX31_RAMM.tgt === best && performance.now() - PP_FX31_RAMM.t < 2500 && PP_FX31_RAMM.src && PP_FX31_RAMM.src.isConnected) {
        const a = PP_FX31_RAMM.src.getBoundingClientRect(), b = best.getBoundingClientRect();
        const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2), l = Math.hypot(dx, dy);
        if (l > 8) z.dir = [dx / l, dy / l];
      }
    }
  } catch (e) { /* Mitte der Zone, feste Richtung */ }
  PP_FX31_ZIEL.set(p, z);
  return z;
}

/** Spitz zulaufendes Band mit Kontur: innen creme, außen hellblau, dann Tinte (Trailer `ovSlash`). A → B in Rasterpixeln, `anteil` = wie weit die Linie schon gezogen ist, `dick` = größte Breite. */
function ppFx31Band(g, ax, ay, bx, by, anteil, dick, C) {
  const L = Math.hypot(bx - ax, by - ay) * anteil;
  if (L < 1) return;
  const ux = (bx - ax) / Math.hypot(bx - ax, by - ay), uy = (by - ay) / Math.hypot(bx - ax, by - ay), nx = -uy, ny = ux;
  const n = Math.ceil(L * 1.6);
  for (let i = 0; i <= n; i++) {
    const f = i / n, hw = Math.max(0.5, (dick / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, f)), 0.6));
    const px = ax + ux * L * f, py = ay + uy * L * f, reich = hw + 2;
    for (let q = -reich; q <= reich + 1e-6; q += 0.6) {
      const d = Math.abs(q);
      g.put(px + nx * q, py + ny * q, d <= hw ? C.creme : d <= hw + 1.2 ? C.hblau : C.tinte);
    }
  }
}
/** Ring aus Pixeln (Rasterpixel), `grob` = Schachbrett statt voll. */
function ppFx31Ring(g, cx, cy, r, dicke, farbe, grob) { if (r >= 1) g.ring(cx, cy, Math.max(0, r - dicke), r, farbe, grob ? 0.5 : 1); }
/** Strahlenfächer: Speichen mit Tinte darunter (Trailer: 12 Stück, lang/kurz im Wechsel). */
function ppFx31Faecher(g, cx, cy, laenge, anzahl, dreh, C, farbenKurz) {
  for (let r = 0; r < anzahl; r++) {
    const an = r * Math.PI * 2 / anzahl + dreh, len = laenge * (r % 2 ? 0.5 : 1), x1 = cx + Math.cos(an) * len, y1 = cy + Math.sin(an) * len;
    g.line(cx, cy, x1, y1, C.tinte, 1, 3);
    g.line(cx, cy, x1, y1, r % 2 ? farbenKurz : (r % 3 === 0 ? C.creme : C.hblau), 1, 1);
  }
}

function ppFx31Malen(g, t, sz, teile) {
  const S = sz.S, C = teile.C, krit = teile.krit, hh = teile.hh / S;
  const cx = sz.cx, cy = sz.cy - teile.hoch / S;
  const q = Math.floor(t / PP_FX31_BILD), dt = t / 1000;
  // Blitzscheibe im Schachbrett (3 Bilder), Trailer: ganzes Bild blitzt creme
  if (q < 3) g.disc(cx, cy, hh * (krit ? 0.5 : 0.32), C.creme, [1, 0.55, 0.25][q]);
  // Schnitte
  const dx = teile.dir[0], dy = teile.dir[1], nx = -dy, ny = dx;
  const hl = hh * (krit ? 1.05 : 0.86);
  const Ax = cx - dx * hl, Ay = cy - dy * hl, Bx = cx + dx * hl, By = cy + dy * hl;
  if (krit) {
    if (q < 13) {
      const anteil = q < 3 ? (q + 1) / 3 : 1, dick = q < 7 ? 7 : q < 10 ? 4 : 2;
      if (!(q >= 8 && q % 2)) ppFx31Band(g, Ax, Ay, Bx, By, anteil, dick, C);
      if (q >= 1 && q < 9) {
        const o1x = nx * hh * 0.2 + dx * hh * 0.02, o1y = ny * hh * 0.2 + dy * hh * 0.02, o2x = -nx * hh * 0.25, o2y = -ny * hh * 0.25;
        const a = Math.min(1, q / 3);
        ppFx31Band(g, Ax + o1x, Ay + o1y, Bx + o1x, By + o1y, a, 4, C);
        ppFx31Band(g, Ax + o2x, Ay + o2y, Bx + o2x, By + o2y, a, 2, C);
      }
    }
  } else if (q < 10) {
    const anteil = q < 3 ? (q + 1) / 3 : 1, dick = q < 5 ? 5 : q < 8 ? 3 : 1;
    if (!(q >= 5 && q % 2)) ppFx31Band(g, Ax, Ay, Bx, By, anteil, dick, C);
    if (q >= 1 && q < 6) ppFx31Band(g, Ax + hh * 0.2, Ay - hh * 0.06, Bx + hh * 0.2, By - hh * 0.06, Math.min(1, q / 3), 2, C);
  }
  // Ringe (creme voll, hellblau + blau gedithert) und Sternfächer
  const ease = (u) => { u = Math.max(0, Math.min(1, u)); return 1 - Math.pow(1 - u, 3); };
  const k = krit ? 1 : 0.7;                                   // Quick Slash: kürzere Zeiten
  if (krit) {
    if (dt < 0.8) {
      ppFx31Ring(g, cx, cy, Math.round(ease(dt / 0.35) * hh * 0.95), dt < 0.1 ? 3 : 1.5, C.creme, false);
      if (dt > 0.04) ppFx31Ring(g, cx, cy, Math.round(ease((dt - 0.04) / 0.5) * hh * 1.45), 2, C.hblau, true);
      if (dt > 0.1) ppFx31Ring(g, cx, cy, Math.round(ease((dt - 0.1) / 0.6) * hh * 1.85), 1.5, C.blau, true);
    }
    if (dt < 0.3) { const L = ease(dt / 0.1) * (1 - Math.max(0, (dt - 0.1) / 0.2)); ppFx31Faecher(g, cx, cy, L * hh * 1.0, 12, 0.2, C, C.hblau); }
  } else {
    if (dt < 0.3 * k + 0.1) {
      ppFx31Ring(g, cx, cy, Math.round(ease(dt / 0.25) * hh * 0.6), dt < 0.08 ? 2 : 1, C.creme, false);
      if (dt > 0.03) ppFx31Ring(g, cx, cy, Math.round(ease((dt - 0.03) / 0.25) * hh * 0.42), 1, C.hblau, true);
    }
  }
  // Splitter: Quadrate und Pluszeichen, bremsen ab
  for (const s of teile.splitter) {
    const u = (dt - s.t0) / s.leben;
    if (u < 0 || u > 1) continue;
    const e = 1 - Math.pow(1 - u, 2), x = cx + s.vx * e / S, y = cy + s.vy * e / S, f = s.farbe;
    if (u > 0.75 && (Math.floor(t / PP_FX31_BILD) & 1)) continue;                       // flackert aus
    if (s.plus) { g.put(x, y, f); g.put(x - 1, y, f); g.put(x + 1, y, f); g.put(x, y - 1, f); g.put(x, y + 1, f); }
    else g.block(x, y, s.gross, s.gross, f);
  }
}

function ppFx31Schnitt(krit) {
  return ppR1Leinwand(ppFx31Malen, krit ? 1100 : 520, (p) => {
    const z = ppFx31Ziel(p, !krit);
    const E = Math.ceil(z.h * (krit ? 2.1 : 1.3)) + 24;
    return { breite: 2 * E, hoehe: 2 * E, ankerX: E, ankerY: E + z.dy };
  }, {
    z: krit ? 10120 : 10100,
    vorbereiten: (sz) => {
      const p = sz.props, z = ppFx31Ziel(p, !krit), hex = ppHex, F = PP_FX31_C;
      const C = { creme: hex(F.creme), tinte: hex(F.tinte), hblau: hex(F.hblau), blau: hex(F.blau), dunkelrot: hex('#780014'), gelbcreme: hex('#f8f8bd') };
      const farben = krit ? [C.creme, C.hblau, C.blau, C.creme] : [C.creme, C.hblau, C.creme, hex(F.gelb)];
      const n = ppFxN(krit ? 46 : 16), hh = z.h;
      return { krit, hh, hoch: z.dy, dir: z.dir, noLabel: !!p.noLabel, C,
        splitter: Array.from({ length: n }, () => {
          const an = Math.random() * Math.PI * 2, v = (krit ? 90 : 50) + Math.random() * (krit ? 330 : 160);
          return { t0: Math.random() * 0.06, leben: 0.3 + Math.random() * (krit ? 0.45 : 0.25), vx: Math.cos(an) * v, vy: Math.sin(an) * v * 0.7, plus: Math.random() < 0.3,
            gross: Math.random() < 0.4 ? 2 : 1, farbe: farben[Math.floor(Math.random() * farben.length)] };
        }) };
    },
  });
}
(function ppFx31Anmelden() {
  try {
    if (typeof ppFxUeberschreiben === 'function') {
      ppFxUeberschreiben('critical_slash', ppFx31Schnitt(true));
      ppFxUeberschreiben('quick_slash', ppFx31Schnitt(false));
    }
  } catch (e) { /* alte Fassungen bleiben */ }
})();
