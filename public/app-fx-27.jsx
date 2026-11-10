// app-fx-27: Heldenfigur dasht statt Karte (Rammen) — Pixelart im Look des Trailers
//
// ═════════════════════════════════════════════════════════════════
//  Rammen mit der FIGUR (`play_ram_animation`, `play_hero_clash`)
//
//  Vorher flog beim Rammen die KARTE des Helden (DOM-Karte `.ram-anim-card`, `ramCharge`), und die Zone blendete Karte + Figur aus. Jetzt bleibt die Karte stehen; nur die animierte Figur
//  (`HeroIdleSprite`, Sprite-Ebene) löst sich und fährt — Bahn und Zeitverlauf wie bisher (gleiche Dauer, Aufprall bei 12 % / Jetpack 45 % / rückwärts 26 %: der Server wartet in
//  `rammeBisKontakt` genau darauf, die Anteile dürfen sich nicht ändern), aber im Look des Trailers (shot01.js, `monPos` / `MONIA.ghosts` / `champPos`):
//    • Streckung beim Fahren (x1,5 breit, x0,78 hoch), Aufladen davor (x1,16 / x0,88)
//    • 4 Nachbilder: flache creme/hellblaue Silhouetten, im Schachbrett gedithert, je 2 Bilder (≈ 67 ms) hinter der Figur
//    • Aufprall-Federung in den ersten 4 Bildern nach dem Halt: [1,25 | 0,8] → [0,92 | 1,12] → [1,03 | 0,97] → [1 | 1]
//    • Bewegung in GANZEN Pixeln im 30-Hz-Takt (`ppTaktRaf`); keine Drehung, keine weichen Übergänge
//  Die Figur ist keine Karte: statt der Drehung der Karte gilt Spiegeln (Tail Slap: harter Schnitt über zwei dünne Zwischenbilder, Ausholen, mit dem Rücken voran) bzw. gar nichts.
//
//  Technik: die Figur steht in der Sprite-Ebene (`HeroSpriteEbene`) in einem `.hero-idle-platz`, der sich mit der Zone deckt (`zone._ppFigurPlatz`). Verschoben wird der Platz mit der
//  EINZELEIGENSCHAFT `translate` (in Koordinaten der Brettebene — so folgt die Figur Neigung, Brett-Scroll, Kamera und Maßstab von allein; Zonenlagen kommen aus
//  `HeroIdleAnims.lageInEbene`), gestreckt wird das Canvas der Figur mit der Einzeleigenschaft `scale` (Fußpunkt = Drehpunkt, im Canvas-Stil gesetzt). Beide kollidieren weder mit den
//  `transform`-Animationen (Einfahren, Auftritt, Quetschen) noch mit der Hover-Vergrößerung (`scale` des Platzes). Nachbilder sind Geschwister des Stehers im selben Platz.
//  Keine Figur (Held ohne Sheet, versteinert, eingefroren/gelähmt, unsichtbar, im Aufstiegs-Morph, tot) oder Ziel außerhalb der Brettebene → `ppFx27RammFigur` meldet `null`, der alte
//  Kartenpfad läuft unverändert.
//
//  Aufräumen: `ende()` setzt `translate`/`scale` zurück, nimmt die Nachbilder weg und gibt die Zone frei (`zone._ppRammt`). Verschwindet der Held mitten im Flug (Tod, Neuaufbau),
//  merkt der Takt das (`lebt()`), bindet sich an eine neu gemountete Figur oder beendet sich. Mehrere Rammen desselben Helden: die neue löst die laufende ab.
// ═════════════════════════════════════════════════════════════════
const PP_FX27_BILD = 1000 / 30;
const PP_FX27_FARBE = { creme: '#fffbd2', blau: '#b3d8f9', orange: '#ff9a1a', gelb: '#ffe23d', rot: '#ff491a', grau: '#9aa3b6', gift1: '#b3f9b8', gift2: '#75f091', gift3: '#cbff66', gift4: '#4bcd7c' };
const PP_FX27_FEDER = [[1.25, 0.8], [0.92, 1.12], [1.03, 0.97], [1, 1]];    // Aufprall-Federung (x/y-Streckung) in den ersten 4 Bildern nach dem Halt
const PP_FX27_FAHRT = [1.5, 0.78];                                           // Streckung beim Fahren
const PP_FX27_LADEN = [1.16, 0.88];                                          // Aufladen vor dem Start

/** CSS-`cubic-bezier(x1,y1,x2,y2)` als Funktion u → Verlauf (dieselben Kurven wie die Keyframes in style.css). */
function ppFx27Bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) { const e = sx(t); if (Math.abs(e - x) < 1e-5) break; if (e < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}
const PP_FX27_D_EIN = ppFx27Bez(0.55, 0, 1, 1), PP_FX27_D_AUS = ppFx27Bez(0, 0, 0.4, 1);   // Durchbruch: beschleunigend zum Ziel / dahinter auslaufend
const PP_FX27_IO = ppFx27Bez(0.42, 0, 0.58, 1);                  // CSS `ease-in-out` (Standard-Rammen)
const PP_FX27_J_ZUG = ppFx27Bez(0.4, 0, 0.7, 1), PP_FX27_J_FLUG = ppFx27Bez(0.5, 0, 0.28, 1), PP_FX27_J_RUECK = ppFx27Bez(0.5, 0, 0.35, 1);   // Jetpack-Segmente aus `ramJetCharge`

/** Streckenzug aus [ms, Weg, Kurve des Segments, das hier beginnt]: Weg zur Zeit t. */
function ppFx27Spur(ks) {
  return (t) => {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 0; i < ks.length - 1; i++) {
      const a = ks[i], b = ks[i + 1];
      if (t < b[0]) { const u = (t - a[0]) / Math.max(1, b[0] - a[0]); return a[1] + (b[1] - a[1]) * (a[2] ? a[2](u) : u); }
    }
    return ks[ks.length - 1][1];
  };
}

/**
 * Zeitverlauf eines Rammens. Gibt `{ pose(t) → { p, spiegel, wackeln, laden }, ende, aufprall }`:
 * `p` = Weg (0 = auf der Zone, 1 = am Ziel), `spiegel` = Blickrichtung (1 | −1 | dünne Zwischenwerte), `wackeln` = Zittern in Pixeln, `laden` = Aufladen vor dem Start.
 * Die Anteile entsprechen den Keyframes in style.css (`ramCharge` 12 %, `ramJetCharge` 45 %, `ramBackCharge` 26 % Aufprall), der Server verlässt sich darauf.
 */
function ppFx27Zeitlinie(art, dur, pZiel, durch) {
  if (art === 'rueck') {
    // Tail Slap: gestuft wie `ramBackCharge` (steps(1)): [Prozent, Weg, Spiegel, Wackeln]; Umdrehen als harter Schnitt über zwei dünne Zwischenbilder
    const T = [[0, 0, 1, 0], [2, 0, 0.3, 0], [3, 0, -0.3, 0], [4, 0, -1, 0], [8, -0.04, -1, 0], [12, -0.09, -1, 0], [16, 0.2, -1, 0], [20, 0.55, -1, 0], [24, 0.88, -1, 0], [26, 1, -1, 0],
      [29, 0.97, -1, 3], [32, 1, -1, -3], [36, 1, -1, 0], [44, 0.7, -1, 0], [52, 0.4, -1, 0], [60, 0.15, -1, 0], [66, 0, -1, 0], [69, 0, -0.3, 0], [70.5, 0, 0.3, 0], [72, 0, 1, 0]];
    return {
      aufprall: dur * 0.26, ende: dur * 0.72 + PP_FX27_BILD,
      pose(t) {
        let k = T[0];
        for (let i = 0; i < T.length; i++) { if (t >= T[i][0] * dur / 100) k = T[i]; else break; }
        return { p: k[1], spiegel: k[2], wackeln: k[3], laden: t < dur * 0.02 };
      },
    };
  }
  if (art === 'jet') {
    const f = ppFx27Spur([[0, 0], [dur * 0.04, 0, PP_FX27_J_ZUG], [dur * 0.10, -0.07, PP_FX27_J_FLUG], [dur * 0.45, 1], [dur * 0.60, 1, PP_FX27_J_RUECK], [dur * 0.92, 0]]);
    return { aufprall: dur * 0.45, ende: dur * 0.92 + PP_FX27_BILD, pose(t) { return { p: f(t), spiegel: 1, wackeln: 0, laden: t < dur * 0.04 }; } };
  }
  if (durch && art !== 'jet' && art !== 'rueck' && pZiel > 0 && pZiel < 1) {
    // ANGRIFF (Trailer: Quick Attack, Critical Strike …): der Held rast DURCH das Ziel und hält dahinter. p = 1 ist der Haltepunkt hinter dem Ziel, `pZiel` die Zielmitte — dort ist
    // der Aufprall (12 %, wie bisher: der Server löst den Schaden zu diesem Zeitpunkt aus). Erst beschleunigend zum Ziel (ease-in), dahinter auslaufend (ease-out), dann zurück.
    const A = dur * 0.12, leg = Math.min(A, Math.max(dur * 0.07, 4 * PP_FX27_BILD)), s = A - leg;
    const R0 = dur * 0.22, nach = Math.max(2 * PP_FX27_BILD, Math.min(R0 - A - PP_FX27_BILD, dur * 0.05)), R1 = R0 + Math.max(dur * 0.09, 5 * PP_FX27_BILD);
    const f = ppFx27Spur([[0, 0], [s, 0, PP_FX27_D_EIN], [A, pZiel, PP_FX27_D_AUS], [A + nach, 1], [R0, 1, PP_FX27_IO], [R1, 0]]);
    return { aufprall: A, ende: R1 + PP_FX27_BILD, pose(t) { return { p: f(t), spiegel: 1, wackeln: 0, laden: t < s && s >= PP_FX27_BILD }; } };
  }
  // Standard (`ramCharge`): Aufprall bei 12 %, Rückweg 22 → 30 %. Ist die Strecke dabei kürzer als 4 Bilder (kurze Dauer), beginnt der Hinweg früher — der Aufprall bleibt auf 12 %.
  const A = dur * 0.12, leg = Math.min(A, Math.max(dur * 0.07, 4 * PP_FX27_BILD)), s = A - leg;
  const R0 = dur * 0.22, R1 = R0 + Math.max(dur * 0.08, 4 * PP_FX27_BILD);
  const f = ppFx27Spur([[0, 0], [s, 0, PP_FX27_IO], [A, 1], [R0, 1, PP_FX27_IO], [R1, 0]]);
  return { aufprall: A, ende: R1 + PP_FX27_BILD, pose(t) { return { p: f(t), spiegel: 1, wackeln: 0, laden: t < s && s >= PP_FX27_BILD }; } };
}

// 2x2-Schachbrett-Muster (je Nachbild eine der beiden Phasen) zum Ausstanzen der Silhouette: bleibt nur jedes zweite Pixel
const PP_FX27_RASTER = [];
function ppFx27Raster(ctx, phase) {
  if (!PP_FX27_RASTER[phase]) {
    const c = document.createElement('canvas'); c.width = 2; c.height = 2;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) if (((x + y + phase) & 1)) g.fillRect(x, y, 1, 1);
    PP_FX27_RASTER[phase] = ctx.createPattern(c, 'repeat');
  }
  return PP_FX27_RASTER[phase];
}

/**
 * Staubwolke aus harten Pixeln: EIN Element am Fußpunkt (steht wie die Figur aufrecht in der Sprite-Ebene), alle Teilchen sind Einträge EINER `box-shadow`-Liste (Unschärfe 0, Spreizung =
 * halbe Kantenlänge: harte Quadrate). Die Teilchen laufen in 6 Stufen auseinander — aus JS im 30-Hz-Takt, je Stufe EIN Style-Schreiben. Vorher ein DOM-Knoten je Teilchen (6–12 je Wolke, 4 Wolken
 * je Fahrt): jeder Knoten und jedes Schreiben kostete einen Teil des ohnehin hohen Style-Neuaufbaus des Bretts (Trace 3.11.: +150–250 ms Style-Neuaufbau über 3 Fahrten, Einzelspitzen bis 27 ms).
 */
function ppFx27Wolke(ebene, x, y, n, farben, opt) {
  if (!ebene || !ebene.isConnected) return;
  opt = opt || {};
  const w = document.createElement('div');
  w.className = 'pp-fx27-wolke';
  w.style.left = Math.round(x) + 'px'; w.style.top = Math.round(y) + 'px';
  const hoch = opt.hoch || 0, streu = opt.streu || 26, dauer = opt.dauer || 380;
  const teile = [];
  for (let i = 0; i < n; i++) {
    const an = Math.random() * Math.PI * 2, r = 0.35 + Math.random() * 0.65, g = (Math.random() < 0.3 ? 2 : 1) * (opt.pixel || 2);   // `opt.pixel` = Hero-Pixel der Sprite-Ebene
    teile.push({
      x0: Math.round((Math.random() - 0.5) * (opt.breit || 16)), y0: Math.round(-hoch - Math.random() * (opt.tief || 10)), g, c: farben[Math.floor(Math.random() * farben.length)],
      dx: Math.round(Math.cos(an) * streu * r), dy: Math.round(Math.sin(an) * streu * r * 0.6 + (opt.auf ? -opt.auf * r : 0)), d: Math.round(dauer * (0.6 + Math.random() * 0.4)),
    });
  }
  const k = document.createElement('i');
  w.appendChild(k);
  ebene.appendChild(w);
  const sk = 'var(--board-scale, 1)', t0 = performance.now(), raf = window.ppTaktRaf || window.requestAnimationFrame;
  let letzteStufe = -1;
  const schritt = () => {
    if (!w.isConnected) return;
    const alter = performance.now() - t0;
    let rest = 0, stufe = 99;
    const sh = [];
    for (let i = 0; i < teile.length; i++) {
      const t = teile[i], u = alter / t.d;
      if (u >= 1) continue;
      rest++;
      const st = Math.floor(u * 6) / 5;                             // 6 Stufen
      sh.push('calc(' + (t.x0 + Math.round(t.dx * st) + t.g / 2) + 'px * ' + sk + ') calc(' + (t.y0 + Math.round(t.dy * st) + t.g / 2) + 'px * ' + sk + ') 0 calc(' + (t.g / 2) + 'px * ' + sk + ') ' + t.c);
      stufe = Math.min(stufe, Math.floor(u * 6));
    }
    if (!rest) { w.remove(); return; }
    if (stufe !== letzteStufe || letzteStufe < 0) { letzteStufe = stufe; k.style.boxShadow = sh.join(','); }   // nur bei Stufenwechsel schreiben
    raf(schritt);
  };
  schritt();
}

/**
 * Nachbild-Leinwände (4 je Figur-Platz) werden EINMAL gebaut, bleiben im Platz (`visibility:hidden` statt Entfernen) und werden schon vorher im Leerlauf „aufgewärmt".
 * Grund (Messung 3.11.): das ERSTE Zeichnen in eine frisch eingehängte, sichtbare Leinwand kostete 12–20 ms (Ressourcen-Anlage der Compositing-Ebene) — 2–4 Ausreißer je Fahrt.
 */
function ppFx27GeisterPool(platz, steher, canvas) {
  let pool = platz._ppGeisterPool;
  if (pool && pool.length === 4 && pool.every(G => G.g.isConnected)) {
    for (const G of pool) {
      if (G.c.width !== canvas.width || G.c.height !== canvas.height) { G.c.width = canvas.width; G.c.height = canvas.height; G.schluessel = ''; }
      G.g.style.cssText = steher.style.cssText + ';visibility:hidden';
      G.c.style.cssText = canvas.style.cssText;
      G.c.style.imageRendering = 'pixelated'; G.c.style.scale = '';
    }
    return pool;
  }
  if (pool) for (const G of pool) { try { G.g.remove(); } catch (e) { /* weg */ } }
  pool = [];
  for (let i = 0; i < 4; i++) {
    const g = document.createElement('div');
    g.className = 'pp-fx27-geist';
    g.style.cssText = steher.style.cssText + ';visibility:hidden';
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    c.style.cssText = canvas.style.cssText;
    c.style.imageRendering = 'pixelated';
    c.style.scale = '';
    g.appendChild(c);
    platz.insertBefore(g, platz.firstChild);
    pool.push({ g, c, ctx: c.getContext('2d'), da: false, schluessel: '' });
  }
  platz._ppGeisterPool = pool;
  return pool;
}
/** Leerlauf-Aufwärmen: einmal in jede Nachbild-Leinwand zeichnen, solange sie (unsichtbar) im Platz hängt. */
function ppFx27Aufwaermen(platz) {
  try {
    if (!platz || !platz.isConnected || platz._ppGeisterPool) return;
    const steher = platz.querySelector('.hero-idle-steher'), canvas = platz.querySelector('canvas.hero-idle-canvas');
    if (!steher || !canvas || !canvas.width) return;
    const pool = ppFx27GeisterPool(platz, steher, canvas);
    for (const G of pool) { G.ctx.clearRect(0, 0, G.c.width, G.c.height); G.ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, G.c.width, G.c.height); G.ctx.clearRect(0, 0, G.c.width, G.c.height); }
  } catch (e) { /* weg */ }
}
(function ppFx27Beobachter() {
  const plan = (platz) => {
    const los = () => ppFx27Aufwaermen(platz);
    setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 1500 }) : los()), 900);
  };
  const haenge = (ebene) => {
    if (!ebene || ebene._ppFx27Beob) return;
    ebene._ppFx27Beob = true;
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType === 1 && n.classList && n.classList.contains('hero-idle-platz')) plan(n); } }).observe(ebene, { childList: true, subtree: true });
    ebene.querySelectorAll('.hero-idle-platz').forEach(plan);
  };
  const start = () => { if (window.HeroIdleAnims && window.HeroIdleAnims.abonniereEbene) { window.HeroIdleAnims.abonniereEbene(haenge); haenge(window.HeroIdleAnims.ebene()); } else setTimeout(start, 500); };
  start();
})();

/** Ist für diese Zone gerade eine Figur da, die fahren darf? (ohne Nebenwirkung) */
function ppFx27KannFigur(zone) {
  try {
    if (!zone || !zone.isConnected || !window.HeroIdleAnims) return false;
    const platz = zone._ppFigurPlatz;
    if (!platz || !platz.isConnected || platz.style.display === 'none') return false;
    const cl = platz.classList;
    if (cl.contains('hero-idle-stein') || cl.contains('hero-idle-angehalten') || cl.contains('hero-idle-unsichtbar') || cl.contains('hero-idle-aufstieg')) return false;
    if (!platz.querySelector('canvas.hero-idle-canvas') || !platz.querySelector('.hero-idle-steher')) return false;
    return !!window.HeroIdleAnims.ebene();
  } catch (e) { return false; }
}

/**
 * Steuerung der Figur einer Zone. `pose({ p, spiegel, wackeln, laden })` setzt sie in den Takt (höchstens ein Bild je 1/30 s, doppelte Aufrufe im selben Bild zählen nicht);
 * `opt.voll`: p bezieht sich auf die volle Strecke Zonenmitte → Zonenmitte (Duell), sonst endet der Weg etwas vor dem Ziel (die Figur landet VOR dem Ziel, nicht in ihm).
 * `opt.art`: 'std' | 'jet' | 'rueck' | 'duell' | 'sterne' | 'gift' (Farben der Nachbilder und Funken; 'gift' = `trailType: 'poison'`, giftgrüne Geister nur auf dem Hinweg). Gibt `null`, wenn die Zone keine fahrbereite Figur hat.
 */
function ppFx27Figur(srcEl, tgtEl, opt) {
  opt = opt || {};
  if (!ppFx27KannFigur(srcEl) || !tgtEl || !tgtEl.isConnected) return null;
  const HA = window.HeroIdleAnims;
  const ls0 = HA.lageInEbene(srcEl), lt0 = HA.lageInEbene(tgtEl);
  if (!ls0 || !lt0) return null;
  if (srcEl._ppFigurFahrt) { try { srcEl._ppFigurFahrt.ende(); } catch (e) { /* weg */ } }
  const art = opt.art || 'std';
  const feuer = art === 'jet' || art === 'sterne';
  const gift = art === 'gift';   // `trailType: 'poison'` (Blow of the Venom Snake): giftgrüne Nachbilder, NUR auf dem Hinweg (ab dem Kontakt keine neuen — die Rückfahrt bleibt ohne Geister)
  const geister = feuer ? [PP_FX27_FARBE.creme, PP_FX27_FARBE.orange, PP_FX27_FARBE.gelb, PP_FX27_FARBE.orange]
    : gift ? [PP_FX27_FARBE.gift1, PP_FX27_FARBE.gift2, PP_FX27_FARBE.gift3, PP_FX27_FARBE.gift4]
    : [PP_FX27_FARBE.creme, PP_FX27_FARBE.blau, PP_FX27_FARBE.creme, PP_FX27_FARBE.blau];
  // Sprengpixel = Hero-Pixel in der Sprite-Ebene (Entwurfspixel der Figur = Canvas-Breite im Layout / Frame-Breite / --board-scale, normal 2,8125); einmal je Fahrt gelesen, nicht im Takt. Vorher fest 2.
  const heroPx = (() => { try { const cv = srcEl && srcEl._ppFigurPlatz && srcEl._ppFigurPlatz.querySelector('canvas'); const bs = parseFloat(document.documentElement.style.getPropertyValue('--board-scale')) || 1, q = cv && cv.width > 0 && cv.offsetWidth > 0 ? cv.offsetWidth / cv.width / bs : 0; return q > 1 && q < 8 ? q : 0; } catch (e) { return 0; } })();   // Entwurfspixel (die Wolke multipliziert mit --board-scale)
  const stauben = [PP_FX27_FARBE.creme, PP_FX27_FARBE.grau, PP_FX27_FARBE.creme, PP_FX27_FARBE.blau];
  const funken = [PP_FX27_FARBE.orange, PP_FX27_FARBE.gelb, PP_FX27_FARBE.creme, PP_FX27_FARBE.rot];
  const F = {
    platz: null, canvas: null, steher: null, geist: [], hist: [], beendet: false, bildNr: -1,
    letzt: null, ruhe: 99, seitFahrt: 99, wasFahrt: false, anteil: 1, pMax: 0, rueck: false,
  };
  srcEl._ppRammt = (srcEl._ppRammt || 0) + 1;
  srcEl._ppFigurFahrt = F;
  HA.markiere();

  // Weg in Koordinaten der Brettebene: Zonenmitte → Zielmitte; ohne `voll` endet die Figur ein Stück vor dem Ziel (höchstens 30 % der Zonenbreite, höchstens 40 % des Wegs)
  // (alle 5 Bilder neu gemessen: Layout lesen kostet nach jedem `translate`-Schreiben einen Neuaufbau; Zonen wandern in 170 ms nicht merklich)
  let vekAlter = 0;
  const vektor = () => {
    if (F.vek && F.vek.a) return F.vek;   // EINMAL messen: jedes Layout-Lesen nach einem `translate`-Schreiben erzwang einen Neuaufbau (2–14 ms, Messung 3.11.); die Zonen bewegen sich während einer Fahrt nicht gegeneinander (Scroll/Kamera tragen den Platz mit)
    vekAlter = 0;
    const a = HA.lageInEbene(srcEl), b = HA.lageInEbene(tgtEl);
    if (!a || !b) return F.vek || { x: 0, y: 0, a: ls0 };
    const dx = (b.x + b.w / 2) - (a.x + a.w / 2), dy = (b.y + b.h / 2) - (a.y + a.h / 2);
    const len = Math.hypot(dx, dy) || 1;
    let k = 1;
    if (opt.durch) { const ueber = Math.min(a.h * 0.85, len * 0.6); k = (len + ueber) / len; F.pZiel = len / (len + ueber); }   // Angriff: Haltepunkt HINTER dem Ziel
    else if (!opt.voll) { const kurz = Math.min(a.w * 0.3, len * 0.4); k = (len - kurz) / len; }
    F.anteil = k;
    return (F.vek = { x: dx * k, y: dy * k, a, len });
  };

  /** Figur-Elemente des aktuellen Platzes binden (neu gemountete Figur nach Neuaufbau eingeschlossen). */
  F.binde = () => {
    const platz = srcEl._ppFigurPlatz;
    if (!platz || !platz.isConnected) return false;
    if (platz === F.platz) return true;
    if (F.platz) F.freigeben(false);
    F.platz = platz;
    F.canvas = platz.querySelector('canvas.hero-idle-canvas');
    F.steher = platz.querySelector('.hero-idle-steher');
    if (!F.canvas || !F.steher) { F.platz = null; return false; }
    // Nachbilder: Geschwister des Stehers (stehen aufrecht wie er, malen vor der Figur), jedes mit eigener Leinwand — aus dem Pool des Platzes (s. ppFx27GeisterPool)
    F.geist = ppFx27GeisterPool(platz, F.steher, F.canvas);
    return true;
  };
  F.freigeben = (zurueck) => {
    if (F.platz) {
      try { F.platz.style.translate = ''; } catch (e) { /* weg */ }
      if (F.canvas) { try { F.canvas.style.scale = ''; } catch (e) { /* weg */ } }
    }
    for (const G of F.geist) { try { G.g.style.visibility = 'hidden'; G.da = false; } catch (e) { /* weg */ } }   // bleiben im Platz (Pool)
    F.geist = [];
    F.platz = F.canvas = F.steher = null;
    if (zurueck) F.hist.length = 0;
  };
  if (!F.binde()) { srcEl._ppRammt = Math.max(0, (srcEl._ppRammt || 1) - 1); srcEl._ppFigurFahrt = null; HA.markiere(); return null; }

  F.lebt = () => !F.beendet && srcEl.isConnected && F.binde();

  F.ende = () => {
    if (F.beendet) return;
    F.beendet = true;
    F.freigeben(true);
    srcEl._ppRammt = Math.max(0, (srcEl._ppRammt || 1) - 1);
    if (srcEl._ppFigurFahrt === F) srcEl._ppFigurFahrt = null;
    HA.markiere();
  };

  F.pose = (z) => {
    if (F.beendet) return;
    const nr = Math.floor(performance.now() / PP_FX27_BILD);
    if (nr === F.bildNr) return;
    F.bildNr = nr;
    if (!F.binde()) return;
    const v = vektor();
    const p = z.p || 0;
    let x = Math.round(v.x * p + (z.wackeln || 0)), y = Math.round(v.y * p);
    const schritt = F.letzt ? Math.hypot(x - F.letzt.x, y - F.letzt.y) : 0;
    const fahrt = schritt >= Math.max(2, v.a.w * 0.045);
    if (gift) { if (p > F.pMax) F.pMax = p; else if (p < F.pMax - 0.01) F.rueck = true; }   // Rückweg: p sinkt unter den bisherigen Höchstwert
    // Streckung: Fahrt → breit und flach; danach Federung in den ersten 4 Bildern; davor Aufladen
    let sx = 1, sy = 1;
    if (fahrt) { sx = PP_FX27_FAHRT[0]; sy = PP_FX27_FAHRT[1]; F.ruhe = -1; F.seitFahrt = 0; }
    else {
      F.ruhe++; F.seitFahrt++;
      if (F.ruhe >= 0 && F.ruhe < PP_FX27_FEDER.length) { sx = PP_FX27_FEDER[F.ruhe][0]; sy = PP_FX27_FEDER[F.ruhe][1]; }
      else if (z.laden) { sx = PP_FX27_LADEN[0]; sy = PP_FX27_LADEN[1]; }
    }
    // Staubwolke beim Start jeder Fahrt und beim Halt (wie die Sprengpixel der Trailer-Dashes)
    const ebene = HA.ebene();
    const fuss = { x: v.a.x + v.a.w / 2, y: v.a.y + v.a.h / 2 };
    if (fahrt && !F.wasFahrt) ppFx27Wolke(ebene, fuss.x + x, fuss.y + y, feuer ? 7 : 6, stauben, { streu: 22, breit: 18, tief: 6, dauer: 330, pixel: heroPx });
    if (!fahrt && F.wasFahrt) ppFx27Wolke(ebene, fuss.x + x, fuss.y + y, feuer ? 12 : 9, stauben, { streu: 34, breit: 20, tief: 6, dauer: 420, pixel: heroPx });
    if (art === 'sterne' && fahrt) ppFx27Wolke(ebene, fuss.x + x, fuss.y + y, 3, funken, { streu: 16, breit: 18, hoch: v.a.h * 0.25, tief: 18, dauer: 360, auf: 12, pixel: heroPx });
    F.wasFahrt = fahrt;
    F.letzt = { x, y };
    const sp = z.spiegel == null ? 1 : z.spiegel;
    F.hist.push({ x, y });
    if (F.hist.length > 12) F.hist.shift();
    F.platz.style.translate = x + 'px ' + y + 'px';
    F.canvas.style.scale = (sp * sx) + ' ' + sy;
    // Nachbilder: Stellung der Figur vor 2, 4, 6, 8 Bildern; nur während der Fahrt und bis 3 Bilder danach, nur wenn weit genug weg
    const n = F.hist.length, abstand = Math.max(8, v.a.w * 0.17);
    for (let i = 0; i < F.geist.length; i++) {
      const G = F.geist[i], h = F.hist[n - 1 - 2 * (i + 1)];
      const sichtbar = !!h && F.seitFahrt <= (gift ? 1 : 3) && !(gift && F.rueck) && Math.hypot(h.x - x, h.y - y) > abstand;
      if (!sichtbar) { if (G.da) { G.g.style.visibility = 'hidden'; G.da = false; } continue; }
      if (!G.da) { G.g.style.visibility = 'visible'; G.da = true; }
      G.g.style.translate = (h.x - x) + 'px ' + (h.y - y) + 'px';
      G.c.style.scale = (sp * PP_FX27_FAHRT[0]) + ' ' + PP_FX27_FAHRT[1];
      // Silhouette aus dem Sheet (nicht aus dem Canvas der Figur: Lesen vom Canvas kostete bis 15 ms), nur neu gemalt, wenn sich Frame oder Farbe ändern
      const e = F.platz._ppEintrag, fr = F.platz._ppFrame | 0, farbe = geister[i % geister.length], schluessel = fr + '|' + farbe;
      if (G.schluessel === schluessel || !e) continue;
      G.schluessel = schluessel;
      const c = G.ctx, w = G.c.width, hh = G.c.height, m = e.meta, vert = m.layout === 'vertical';
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, w, hh);
      c.drawImage(F.canvas, 0, 0, F.canvas.width, F.canvas.height, 0, 0, w, hh);   // Canvas → Canvas (GPU): das Sheet selbst zu lesen kostete beim ersten Mal je Leinwand 12–20 ms
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = farbe;
      c.fillRect(0, 0, w, hh);
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = ppFx27Raster(c, i & 1);
      c.fillRect(0, 0, w, hh);
      c.globalCompositeOperation = 'source-over';
    }
  };

  /** Körperhöhe über dem Fußpunkt in Bildschirmpixeln (für den Jetpack-Schweif, der auf Körperhöhe liegt, nicht an den Füßen). */
  F.koerperDy = () => {
    try {
      const r = F.steher.getBoundingClientRect(), z = srcEl.getBoundingClientRect();
      return (r.top + r.height * 0.5) - (z.top + z.height / 2);
    } catch (e) { return 0; }
  };
  vektor();
  return F;
}

/**
 * Rast der Held DURCH sein Ziel (Angriff, wie im Trailer) oder fährt er nur BIS zum Ziel (explizites Ramm-Manöver, z. B. Phoenix Tackle)?
 * Vorrang hat das Feld `durch` im Ereignis (`play_ram_animation`, true/false) — ein Kartenskript kann es also festlegen. Ohne Angabe: Karten vom Typ Attack rasen durch;
 * Zauber, Artefakte, Heldeneffekte, Jetpack (`trailType:'fire'`) und Rückwärtsrammen (Tail Slap) nicht. Ausnahmen unter den Attacks: Capture und Forceful Revival
 * (kein Schlag auf das Ziel: Lasso bzw. Wiederbelebung).
 */
const PP_FX27_KEIN_DURCH = new Set(['Capture', 'Forceful Revival']);
function ppFx27Durch(ev) {
  if (ev.durch != null) return !!ev.durch;
  if (ev.rueckwaerts || ev.trailType === 'fire') return false;
  if (PP_FX27_KEIN_DURCH.has(ev.cardName)) return false;
  try { const c = (typeof CARDS_BY_NAME !== 'undefined') ? CARDS_BY_NAME[ev.cardName] : null; return !!c && c.cardType === 'Attack'; } catch (e) { return false; }
}
window.ppFx27Durch = ppFx27Durch;

/**
 * `play_ram_animation` mit der Figur eines Helden. `ev`: { srcEl, tgtEl, dur, trailType, rueckwaerts }. Gibt `null` (kein Figurenpfad — der Aufrufer fährt die Karte) oder
 * `{ anteil, koerperDy }` zurück (Anteil des Wegs, auf dem die Figur landet; Höhe des Körpers über der Zonenmitte in Bildschirmpixeln — für den Jetpack-Schweif).
 */
function ppFx27RammFigur(ev) {
  const dur = ev.dur || 1600;
  const art = ev.rueckwaerts ? 'rueck' : (ev.trailType === 'fire' ? 'jet' : (ev.trailType === 'fire_stars' ? 'sterne' : (ev.trailType === 'poison' ? 'gift' : 'std')));
  const durch = ppFx27Durch(ev);
  const fig = ppFx27Figur(ev.srcEl, ev.tgtEl, { art, durch: durch && art !== 'jet' && art !== 'rueck' });
  if (!fig) return null;
  const zl = ppFx27Zeitlinie(art, dur, fig.pZiel, durch);
  const raf = window.ppTaktRaf || window.requestAnimationFrame;
  const t0 = performance.now();
  const schritt = () => {
    if (fig.beendet) return;
    const t = performance.now() - t0;
    if (!fig.lebt() || t >= zl.ende) { fig.ende(); return; }
    fig.pose(zl.pose(t));
    raf(schritt);
  };
  fig.pose(zl.pose(0));
  raf(schritt);
  return { anteil: fig.anteil, koerperDy: fig.koerperDy() };
}
window.ppFx27RammFigur = ppFx27RammFigur;
window.ppFx27Figur = ppFx27Figur;
window.ppFx27KannFigur = ppFx27KannFigur;
