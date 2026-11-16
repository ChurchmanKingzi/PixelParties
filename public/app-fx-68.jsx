// app-fx-68: Held-Pose beim Wirken (Hüpfer + Silhouetten-Flackern) und Aufladen vor dem Dash — Pixelart im Look des Trailers
//
// ═════════════════════════════════════════════════════════════════
//  1. HELD WIRKT (`hero_cast` → `ppFx68Wirkt(zone, art)`)
//
//  Trailer (shot01.js: `castTab`, `castLift`, Flackern `fl(t) % 4 === 0`): jeder Held, der eine Karte ausspielt oder eine Fähigkeit nutzt, hüpft — `castTab` = [0, 8, 15, 17, 10, 4] Weltpixel über
//  6 Bilder (30 Hz) — und seine Silhouette blitzt creme auf. Im Spiel stand er bisher still. Der Server sendet `hero_cast { owner, heroIdx, art }` im Moment des Commits der Karte
//  (`_firePendingCardReveal`: Spell/Attack aus der Hand, Fähigkeits-Aktivierung; `art` = 'spell' | 'attack' | 'ability'); Kreaturen-Wirkungen, Artefakte, Tränke und Heldeneffekte senden es nicht.
//    • Hub in GANZEN HERO-PIXELN: castTab / 4,8 (Weltpixel je Sprite-Pixel) = [0, 2, 3, 4, 2, 1]; Verschiebung = Hero-Pixel der Figur (Canvas-Breite / Frame-Breite) × `--board-scale`.
//    • Flackern: Bild 0 und 4 volle Creme-Silhouette, Bild 2 im Schachbrett gedithert (eigene Leinwand `canvas.pp-fx68-flimmer` im `.hero-idle-holo`, wie der Treffer-Blitz von app-fx-31).
//    • Technik: die EINZELEIGENSCHAFT `translate` des `.hero-idle-holo` (Schatten bleibt am Boden, Stun-Sterne/Status-Symbole hüpfen mit). Kollidiert nicht mit dem Rammen (`translate` des Platzes,
//      `scale` der Figur-Leinwand) und nicht mit `transform`-Animationen (Auftritt, Aufstieg, Quetschen).
//    • VORRANG: Dash (`zone._ppRammt`), Treffer-Reaktion/Quetschen (`zone._ppFx31`), Tod (`hero-idle-abgeblendet`), Aufstiegs-Morph, Stun/Frost (`hero-idle-angehalten`), Versteinern, unsichtbar,
//      eingefahrene Figur → KEIN Hüpfen; beginnt während des Hüpfens ein Dash oder ein Treffer, gibt es den Holo sofort frei.
//
//  2. AUFLADEN VOR DEM DASH (`play_ram_animation` mit `lade`, `ppFx68Laden`)
//
//  Trailer (l.1943f.): 0,55 s Aufladen, drei pulsierende Bodenringe (r 10 → 34, Periode 0,2 s, Farben Held / Creme / Held-2, gedithert, erster Ring ein Creme-Ring), Silhouette flackert jedes 4. Bild.
//  Im Spiel: auf ~0,27 s GEKÜRZT (8 Bilder, 2 Ringe à 4 Bilder: Heldenfarbe, dann Creme; Creme-Startring in den ersten 3 Bildern; Flackern in Bild 0 (Zweitfarbe des Helden) und 4 (Creme)).
//  ENGINE-VERTRAG: der Server (`_engine.js` `_rammLadenAnmelden`) hängt jedem Ramm-Ereignis eines HELDEN `lade: 267` an und verlängert die nächste Wartezeit (`_delay`, `rammeBisKontakt`) um 267 ms.
//  Der Client hält die Figur `lade` ms in der Hocke (app-fx-27: `ppFx27RammFigur({ lade })`, Zeitlinie verschiebt sich komplett), DANN erst beginnt der Dash — der Kontakt (12 % der Dauer) und alle
//  Zonen-Animationen, die der Server nach dem Kontakt-Wartezeit sendet, liegen also genau wie vorher relativ zum Dash. Ohne Figur (Kartenpfad) wartet app-board.jsx dieselbe Zeit.
//  Kein Aufladen: Rückwärtsrammen (Tail Slap), Jetpack, Kreaturen als Rammer, ausdrücklich `lade: 0`, Folgedash derselben Figur binnen 1,8 s.
//
//  Pixelgröße: Rasterzelle S = Hero-Pixel (`ppFxZelle`); Ringradien aus dem Trailer × rch (= Zonenhöhe / (35 · S), wie app-fx-48 „Held nimmt die Kraft auf“). Palette: Heldenfarben aus `ppFx37Farben`
//  (auf die Palette gerastet), Creme. 30 Hz auf `ppTaktRaf`, ein Schmutzrechteck-Upload je Bild, Leinwand wird danach entfernt.
//  Rückfälle (alles wie vorher, nur der Server wartet bei `lade` ggf. länger): Retro, reduzierte Bewegung, `_playAnimations === false`, `__ppFxAlt`, `window.__ppFx68Aus`.
// ═════════════════════════════════════════════════════════════════
const PP_FX68_BILD = 1000 / 30;
const PP_FX68_CAST = [0, 8, 15, 17, 10, 4];                                           // Trailer: Hüpfer in Weltpixeln (6 Bilder)
const PP_FX68_CAST_PX = PP_FX68_CAST.map((v) => Math.round(v / 4.8));                  // in Hero-Pixeln (4,8 Weltpixel je Sprite-Pixel): [0, 2, 3, 4, 2, 1]
const PP_FX68_CAST_BLITZ = [1, 0, 2, 0, 1, 0];                                         // Silhouette je Bild: 0 keine | 1 creme | 2 creme im Schachbrett
const PP_FX68_CREME = '#fffbd2';

function ppFx68An() {
  try {
    if (window.__ppFx68Aus || window.__ppFxAlt || window._playAnimations === false || window.PP_RETRO) return false;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  } catch (e) { /* weiter */ }
  return true;
}
window.ppFx68An = ppFx68An;

let PP_FX68_RASTER = null;
function ppFx68Raster(ctx) {
  if (!PP_FX68_RASTER) {
    const c = document.createElement('canvas'); c.width = 2; c.height = 2;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(1, 0, 1, 1); g.fillRect(0, 1, 1, 1);
    PP_FX68_RASTER = ctx.createPattern(c, 'repeat');
  }
  return PP_FX68_RASTER;
}

// ───────────────────────── Silhouetten-Leinwand der Figur ─────────────────────────
/** Flimmer-Leinwand im Holo des Platzes (deckungsgleich mit der Figur-Leinwand; angelegt, solange sie fehlt oder die Figur neu gemountet wurde). */
function ppFx68Flimmer(platz) {
  const cv = platz.querySelector('canvas.hero-idle-canvas');
  if (!cv || !cv.width || !cv.parentNode) return null;
  let B = platz._ppFx68Fl;
  if (B && B.c.isConnected && B.cv === cv) {
    if (B.c.width !== cv.width || B.c.height !== cv.height) { B.c.width = cv.width; B.c.height = cv.height; B.schluessel = ''; }
    return B;
  }
  if (B) { try { B.c.remove(); } catch (e) { /* weg */ } }
  const c = document.createElement('canvas');
  c.className = 'pp-fx68-flimmer';
  c.width = cv.width; c.height = cv.height;
  c.style.cssText = 'position:absolute;left:0;top:0;display:block;pointer-events:none;image-rendering:pixelated;visibility:hidden;width:' + cv.style.width + ';height:' + cv.style.height
    + ';transform-origin:' + cv.style.transformOrigin;
  cv.parentNode.insertBefore(c, cv.nextSibling);
  B = { c, cv, ctx: c.getContext('2d'), schluessel: '', da: false };
  platz._ppFx68Fl = B;
  return B;
}
/** Silhouette der Figur in Creme (art 1) bzw. im Schachbrett (art 2) auf die Flimmer-Leinwand; sichtbar. */
function ppFx68Zeige(platz, B, art, farbe) {
  farbe = farbe || PP_FX68_CREME;
  const fr = platz._ppFrame | 0, schluessel = art + '|' + fr + '|' + B.cv.style.scale + '|' + farbe;
  if (B.c.style.scale !== B.cv.style.scale) B.c.style.scale = B.cv.style.scale || '';     // fährt/duckt die Figur gerade (Aufladen), duckt die Silhouette mit
  if (!B.da) { B.c.style.visibility = 'visible'; B.da = true; }
  if (schluessel === B.schluessel) return;
  B.schluessel = schluessel;
  const c = B.ctx, w = B.c.width, h = B.c.height;
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, w, h);
  c.drawImage(B.cv, 0, 0, B.cv.width, B.cv.height, 0, 0, w, h);                              // Canvas → Canvas (GPU), kein Lesen von Pixeln
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = farbe;
  c.fillRect(0, 0, w, h);
  if (art === 2) { c.globalCompositeOperation = 'destination-out'; c.fillStyle = ppFx68Raster(c); c.fillRect(0, 0, w, h); }
  c.globalCompositeOperation = 'source-over';
}
function ppFx68Verberge(B) { try { if (B && B.da) { B.c.style.visibility = 'hidden'; B.da = false; } } catch (e) { /* weg */ } }

/** Leerlauf-Aufwärmen: einmal in die (unsichtbare) Leinwand zeichnen (erstes Zeichnen in eine frisch eingehängte sichtbare Leinwand kostete 12–20 ms). */
function ppFx68Aufwaermen(platz) {
  try {
    if (!platz || !platz.isConnected || platz._ppFx68Fl) return;
    const B = ppFx68Flimmer(platz);
    if (!B) return;
    B.ctx.drawImage(B.cv, 0, 0, B.cv.width, B.cv.height, 0, 0, B.c.width, B.c.height);
    B.ctx.globalCompositeOperation = 'source-in'; B.ctx.fillStyle = PP_FX68_CREME; B.ctx.fillRect(0, 0, B.c.width, B.c.height);
    B.ctx.globalCompositeOperation = 'destination-out'; B.ctx.fillStyle = ppFx68Raster(B.ctx); B.ctx.fillRect(0, 0, B.c.width, B.c.height);
    B.ctx.globalCompositeOperation = 'source-over'; B.ctx.clearRect(0, 0, B.c.width, B.c.height);
  } catch (e) { /* weg */ }
}
(function ppFx68Beobachter() {
  const plan = (platz) => {
    const los = () => ppFx68Aufwaermen(platz);
    setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 2500 }) : los()), 1600);
  };
  const haenge = (ebene) => {
    if (!ebene || ebene._ppFx68Beob) return;
    ebene._ppFx68Beob = true;
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType === 1 && n.classList && n.classList.contains('hero-idle-platz')) plan(n); } }).observe(ebene, { childList: true });
    ebene.querySelectorAll('.hero-idle-platz').forEach(plan);
  };
  const start = () => { if (window.HeroIdleAnims && window.HeroIdleAnims.abonniereEbene) { window.HeroIdleAnims.abonniereEbene(haenge); haenge(window.HeroIdleAnims.ebene()); } else setTimeout(start, 500); };
  start();
})();

// ───────────────────────── 1. Held wirkt ─────────────────────────
/** Darf die Figur dieser Zone jetzt hüpfen? (Vorrang haben Dash, Treffer, Tod, Aufstieg, Stun/Frost …) */
function ppFx68KannWirken(zone) {
  try {
    if (!zone || !zone.isConnected || zone._ppRammt || zone._ppFx31) return false;
    const platz = zone._ppFigurPlatz;
    if (!platz || !platz.isConnected || platz.style.display === 'none') return false;
    const cl = platz.classList;
    if (cl.contains('hero-idle-stein') || cl.contains('hero-idle-unsichtbar') || cl.contains('hero-idle-aufstieg') || cl.contains('hero-idle-weg')
      || cl.contains('hero-idle-angehalten') || cl.contains('hero-idle-abgeblendet') || platz.hasAttribute('data-squash')) return false;   // `data-squash`: Quetschen durch eine Zonen-Animation
    return !!(platz.querySelector('.hero-idle-holo') && platz.querySelector('canvas.hero-idle-canvas'));
  } catch (e) { return false; }
}
window.ppFx68KannWirken = ppFx68KannWirken;

/** Hero-Pixel in Entwurfspixeln (Canvas-Layoutbreite / Frame-Breite / `--board-scale`), normal 2,8125; 0 = unbekannt. */
function ppFx68HeroPx(cv) {
  try {
    const bs = parseFloat(document.documentElement.style.getPropertyValue('--board-scale')) || 1;
    const q = cv && cv.width > 0 && cv.offsetWidth > 0 ? cv.offsetWidth / cv.width / bs : 0;
    return q > 1 && q < 8 ? q : 0;
  } catch (e) { return 0; }
}

/**
 * Der Held der Zone wirkt: hüpft 6 Bilder lang (castTab in Hero-Pixeln) und blitzt. `true`, wenn es läuft.
 */
function ppFx68Wirkt(zone, art) {
  if (!ppFx68An() || !zone || !zone.isConnected || !zone._ppFigurPlatz) return false;
  // Ein Dash-Angriff sendet `hero_cast` im selben Atemzug wie sein Ramm-Ereignis (das Aufladen hat Vorrang): erst nach ~1,5 Bildern prüfen, ob die Figur inzwischen fährt/lädt.
  // Während der Zielwahl/beim Hover ist die Figur eingeklappt (`hero-idle-weg`) und taucht nach dem Klick wieder auf (`hero-idle-zurueck`, 0,36 s): der Hüpfer wartet darauf (höchstens ~0,5 s, danach entfällt der Hüpfer: er käme zu spät).
  const versuch = (n) => {
    try {
      const cl = zone._ppFigurPlatz && zone._ppFigurPlatz.classList;
      if (zone.isConnected && cl && (cl.contains('hero-idle-weg') || cl.contains('hero-idle-zurueck')) && n < 9) { setTimeout(() => versuch(n + 1), 50); return; }
    } catch (e) { /* weiter */ }
    ppFx68WirktJetzt(zone, art);
  };
  setTimeout(() => versuch(0), 45);
  return true;
}
function ppFx68WirktJetzt(zone, art) {
  if (!ppFx68An() || !ppFx68KannWirken(zone) || zone._ppFx68Laden) return false;
  const platz = zone._ppFigurPlatz, holo = platz.querySelector('.hero-idle-holo'), cv = platz.querySelector('canvas.hero-idle-canvas');
  const px = ppFx68HeroPx(cv) || 2.8125;
  const B = ppFx68Flimmer(platz);
  if (zone._ppFx68) { try { zone._ppFx68.ende(); } catch (e) { /* weg */ } }
  const raf = window.ppTaktRaf || window.requestAnimationFrame;
  const R = { beendet: false, i: -1, t0: performance.now(), gesetzt: false, art: art || '' };
  zone._ppFx68 = R;
  if (B) B.c.style.imageRendering = B.cv.style.imageRendering || 'pixelated';
  R.ende = () => {
    if (R.beendet) return;
    R.beendet = true;
    try { if (R.gesetzt && !zone._ppFx31) holo.style.translate = ''; } catch (e) { /* weg */ }                 // (läuft eine Treffer-Reaktion, gehört der Holo ihr — sie räumt selbst auf; der Dash nutzt den Platz, nicht den Holo)
    if (!zone._ppFx68Laden) ppFx68Verberge(B);                                         // (läuft gerade das Aufladen, gehört die Silhouette ihm)
    if (zone._ppFx68 === R) zone._ppFx68 = null;
  };
  const schritt = () => {
    if (R.beendet) return;
    // Vorrang: Dash, Treffer, Tod, Aufstieg, Stun … (oder die Figur wurde neu gemountet) → sofort frei geben
    if (!ppFx68KannWirken(zone) || zone._ppFigurPlatz !== platz || !holo.isConnected) { R.ende(); return; }
    const i = Math.floor((performance.now() - R.t0) / PP_FX68_BILD + 1e-6);
    if (i >= PP_FX68_CAST_PX.length) { R.ende(); return; }
    if (i !== R.i) {
      R.i = i;
      const zm = window.__ppFx68Zeit, a0 = zm ? performance.now() : 0;                  // Messung (nur Tests): Dauer je Bild in ms
      const n = PP_FX68_CAST_PX[i];
      holo.style.translate = n ? '0px calc(' + (-n * px).toFixed(4) + 'px * var(--board-scale, 1))' : '0px 0px';
      R.gesetzt = true;
      const bl = PP_FX68_CAST_BLITZ[i];
      if (B && bl) ppFx68Zeige(platz, B, bl); else ppFx68Verberge(B);
      if (zm) zm.push(performance.now() - a0);
    }
    raf(schritt);
  };
  schritt();
  return true;
}
window.ppFx68Wirkt = ppFx68Wirkt;

// ───────────────────────── 2. Aufladen vor dem Dash ─────────────────────────
/** Heldenfarben [Haupt, Zweit] als RGB (Cache von app-fx-37, sonst einmal aus dem Sheet); Rückfall Gold/Orange. */
function ppFx68Farben(heroName) {
  const rgb = (hex) => (typeof ppFx48Rgb === 'function' ? ppFx48Rgb(hex) : (window.ppSnapRgb ? window.ppSnapRgb(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)) : [255, 226, 61]));
  try {
    const HA = window.HeroIdleAnims, slug = HA && HA.slug && heroName ? HA.slug(heroName) : null;
    if (slug && typeof PP_FX37_FARBEN !== 'undefined') {
      let f = PP_FX37_FARBEN.get(slug);
      if (!f && HA.schonDa && typeof ppFx37Farben === 'function') { const e = HA.schonDa(slug); if (e && e.meta && e.img) { f = ppFx37Farben(e); PP_FX37_FARBEN.set(slug, f); } }
      if (f && f.length) return [rgb(f[0]), rgb(f[1] || f[0])];
    }
  } catch (e) { /* Rückfall */ }
  return [rgb('#ffe23d'), rgb('#ff9a1a')];
}

/**
 * Aufladen vor dem Dash des Helden `srcEl` (Heldenzone): 2 harte Bodenringe in Zellen `S` + Silhouetten-Flackern, `ms` lang (Server: `lade`, normal 267 ms = 8 Bilder). Die Hocke der Figur kommt aus
 * app-fx-27 (`ppFx27RammFigur({ lade })`); hier nur Ringe und Flackern (`o.nurRinge`: ohne Flackern, z. B. Strong Ox Headbutt, dessen Figur in die Effekt-Leinwand wandert). Gibt `true`, wenn gezeichnet wird.
 */
function ppFx68Laden(o) {
  try {
    if (!o || !ppFx68An() || typeof ppFx30Maler !== 'function') return false;
    const srcEl = o.srcEl, ms = o.ms > 0 ? o.ms : 267;
    if (!srcEl || !srcEl.isConnected) return false;
    const r = srcEl.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return false;
    if (srcEl._ppFx68Laden) { try { srcEl._ppFx68Laden(); } catch (e) { /* weg */ } }
    const S = (typeof ppFxZelle === 'function') ? ppFxZelle(srcEl) : 3;
    const fo = window.ppFxScrollOffset ? window.ppFxScrollOffset() : { dx: 0, dy: 0 }, welt = !!window.ppFxWeltSchicht;
    const rch = r.height / (35 * S);                                                   // Zonenhöhe in Trailer-Rasterpixeln (35) → Zellen
    const cx = r.left + r.width / 2 + fo.dx, cy = r.top + r.height / 2 + fo.dy;
    const M = Math.max(14, Math.ceil(38 * rch));                                       // Radius des größten Rings (34 · rch) + Rand
    const lx = Math.floor((cx - M * S) / S) * S, ly = Math.floor((cy - M * S) / S) * S;
    const gw = 2 * M + 2, gh = 2 * M + 2;
    const HX = Math.round((cx - lx) / S), HY = Math.round((cy - ly) / S) - Math.round(10 / 4.8 * rch);   // Ring-Mitte an den Füßen (wie app-fx-48)
    const platz = srcEl._ppFigurPlatz;
    const [A, A2] = ppFx68Farben(platz && platz.getAttribute ? platz.getAttribute('data-held') : null);
    const css = (c) => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    const creme = (typeof ppFx48Rgb === 'function') ? ppFx48Rgb(PP_FX68_CREME) : [255, 251, 210];
    const wurzel = document.createElement('div');
    wurzel.setAttribute('aria-hidden', 'true');
    wurzel.setAttribute('data-pp-px', 'aus');
    wurzel.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;pointer-events:none;z-index:10130;`;
    const cv = document.createElement('canvas');
    cv.width = gw; cv.height = gh;
    cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
    wurzel.appendChild(cv);
    const ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), m = ppFx30Maler(img.data, gw, gh);
    (welt ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel);
    // Flackern der Figur (nur mit Figur): Creme-Silhouette in Bild 0 und 4 (Trailer: jedes 4. Bild)
    const B = (!o.nurRinge && platz && platz.isConnected && window.ppFx27KannFigur && window.ppFx27KannFigur(srcEl)) ? ppFx68Flimmer(platz) : null;
    if (B) B.c.style.imageRendering = B.cv.style.imageRendering || 'pixelated';
    const th = Math.max(1, Math.round(2 * rch)), ease = (u) => 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 3), lerp = (a, b, t) => a + (b - a) * t;
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const t0 = performance.now(), nBilder = Math.max(1, Math.round(ms / PP_FX68_BILD));
    let raf = 0, letzte = -1, fertig = false, vor = null;
    const ende = () => {
      if (fertig) return; fertig = true;
      try { cancelAnimationFrame(raf); } catch (e) { /* weg */ }
      wurzel.remove(); ppFx68Verberge(B);
      if (srcEl._ppFx68Laden === ende) srcEl._ppFx68Laden = null;
    };
    srcEl._ppFx68Laden = ende;
    const zeichneBild = (q) => {
      const d = m.d, buf = img.data;
      if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); }
      d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
      // Puls (4 Bilder): Radius 10 → 34 (× rch), Farbe Heldenfarbe, dann Creme; gedithert (Schachbrett)
      const ph = (q % 4) / 4, farbe = (Math.floor(q / 4) % 2) ? creme : A;
      m.ring(HX, HY, Math.round(lerp(10, 34, ph) * rch), th, farbe, true);
      if (q < 3) m.ring(HX, HY, Math.round(ease(q / 3) * 30 * rch), th, creme, false);   // erster Ring: Creme, voll
      const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
      if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
      vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
    };
    const schritt = (jetzt) => {
      if (fertig) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const q = Math.floor((performance.now() - t0) / PP_FX68_BILD + 1e-6);
      if (q >= nBilder || !srcEl.isConnected) { ende(); return; }
      if (q !== letzte) {
        letzte = q;
        const zm = window.__ppFx68Zeit, a0 = zm ? performance.now() : 0;
        zeichneBild(q);
        // Flackern jedes 4. Bild, abwechselnd in der Zweitfarbe des Helden und in Creme (Trailer: Silhouette orange / creme / orange …)
        if (B) { if (q % 4 === 0 && platz.isConnected && B.cv.isConnected) ppFx68Zeige(platz, B, 1, q % 8 === 0 ? css(A2) : PP_FX68_CREME); else ppFx68Verberge(B); }
        if (zm) zm.push(performance.now() - a0);
      }
      raf = takt(schritt);
    };
    schritt();
    setTimeout(ende, ms + 1500);                                                       // Notnagel (Tab im Hintergrund: rAF ruht)
    return true;
  } catch (e) { try { console.warn('ppFx68Laden', e); } catch (er) { /* weg */ } return false; }
}
window.ppFx68Laden = ppFx68Laden;
