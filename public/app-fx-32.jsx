// app-fx-32: Heldentod im Trailer-Look — die Figur zerspringt in ihre Pixel
//
// ═════════════════════════════════════════════════════════════════
//  Wenn ein Held stirbt (HP ≤ 0), löst das Spiel die Figur nicht mehr schlagartig auf, sondern lässt sie zerspringen (Trailer: shot01.js, `dieAt`/`dieDur`/`dieStyle:'shatter'`,
//  Alice bei 121,4 s; Broghan 101,1 s, Kyli 140,6 s):
//    0 – 133 ms   Anhalten: die Figur steht still (Frame bleibt stehen), blitzt zweimal creme auf und wackelt (±1/±2 Sprite-Pixel)
//    ab 133 ms    Zerfall von unten nach oben (950 ms, die Füße zuerst, der Kopf zuletzt): jedes Sprite-Pixel (bei großen Figuren ein 2×2/3×3-Block) löst sich zu seiner Zeit — Takt `0,6·Höhe + 0,4·Bayer` wie im
//                 Trailer — und fliegt in seiner eigenen Farbe auseinander (Schwerkraft, kleine Splitter 50/100/150 %), fällt zum Boden und flimmert im letzten Drittel gedithert weg
//    dazu         vier graue Bodenringe (alle 250 ms, flache Ellipsen), Funken (creme/gelb/orange/rot), Rauch aus grauen Quadraten (grau → Asche → Rauch → dunkel), Wackeln klingt ab
//    Karte        bleibt hell, bis der Zerfall zu ~60 % durch ist, dann 4 Bilder lang ein Schachbrett-Schleier, dann die „Gefallen“-Verdunklung; statt des früheren Grabsteins steigen auf der Karte die Funken aus app-fx-37.jsx auf
//  Verträge: der Ton (`hero_ko`-Protokolleintrag → `hero_death`), die Zeiten des Servers und der Spielzustand sind unberührt — der Server wartet nach dem Tod auf nichts; die
//  Animation hängt nur am Zustandswechsel „Held liegt“ und läuft über die Wartezeit hinaus (~2,5 s) ohne etwas zu blockieren.
//
//  Technik: bis jetzt hängte `HeroIdleSprite` die Figur beim Tod einfach aus (`!isDead`). Ein MutationObserver auf der Sprite-Ebene sieht den entfernten `.hero-idle-platz`
//  (im Microtask nach dem React-Commit, vor dem nächsten Bild — es gibt keine Lücke, in der schon die dunkle Zone ohne Figur zu sehen wäre), erkennt den Tod (`platz._ppZone` hat ein `.hero-dead-marker`) und HÄNGT
//  DEN PLATZ WIEDER EIN. Seine alten Kinder sind per CSS ausgeblendet (`.pp-fx32-tot`); gezeigt wird eine EIGENE Leinwand (`.pp-fx32-steher`, gleiche Lage/Neigung/Maßstab wie der
//  Steher der Figur), die aus dem Pool des Platzes kommt (im Leerlauf angelegt und gewärmt, wie die Nachbild-Leinwände in app-fx-27.jsx — das erste Zeichnen in eine frisch
//  eingehängte Leinwand kostete 12–20 ms).
//  Zerlegung in Pixelstücke + Flugbahnen EINMAL je Sheet-Frame, im Leerlauf nach und nach für alle Frames vorausberechnet (Frame aus dem Sheet in eine kleine CPU-Leinwand, ein `getImageData`;
//  alle 48 Frames zusammen 3–10 ms, 0,4–2 MB je Held); beim Tod selbst nur Nachschlagen (<1 ms). Danach nur
//  Rechnung und Schreiben in einen Pixelpuffer (`Uint32Array` → `putImageData`) im 30-Hz-Takt (`ppTaktRaf`): ganze Pixel, harte Kanten, kein Alpha, keine CSS-Animation, kein
//  Lesen von der Leinwand, keine DOM-Knoten je Teilchen. Die Farben der Splitter sind die der Figur selbst (Kunst des Gestalters, nicht Oberfläche); Rauch/Funken/Ringe stehen in der Palette.
//
//  ZWEITER STIL „sturz“ (Einsinken + Brocken + Staubwolke, Trailer Broghan/Kyli): app-fx-71.jsx liefert `ppFx71Stil/BaueSturz/ZeichneSturz`; Rahmen (Beobachter, Pool, Verdunklung, Aufräumen) ist derselbe. Rückfall auf dieses Zerspringen bei Retro/reduzierter Bewegung/`__ppFx71Aus`.
//  Rückfall: Helden ohne Sheet haben keine Figur — dort bleibt alles beim Alten (Karte dunkelt ab). Auch ohne Animation (Figur unsichtbar/im Aufstiegs-Morph, Platz nicht
//  sichtbar, Fehler) läuft der alte Pfad; eine durch Hover/Zielwahl eingefahrene Figur steht für den Tod wieder da. Wird der Held währenddessen wiederbelebt (neue Figur im selben Zonenplatz), bricht die Animation sofort ab; die neue Figur steigt wie immer auf.
//  Das Gefallen-Aussehen der Zone setzt nur das Attribut `data-pp-stirbt` (1 = Karte hell, Schleier + Grabstein verborgen, 2 = Schachbrett-Schleier) zurück; Klassen fasst der Effekt nicht an.
// ═════════════════════════════════════════════════════════════════
const PP_FX32_BILD = 1000 / 30;
const PP_FX32_HALT = 4 * PP_FX32_BILD;          // Anhalten + Wackeln vor dem Zerfall
const PP_FX32_DAUER = 950;                      // Zerfall von unten nach oben
const PP_FX32_F = {
  creme: [255, 251, 210], grau: [154, 163, 182], asche: [89, 96, 110], rauch: [62, 62, 81], dunkel: [8, 6, 12],
  orange: [255, 154, 26], gelb: [255, 226, 61], rot: [255, 73, 26],
};
const PP_FX32_PAL = {};
for (const k of Object.keys(PP_FX32_F)) { const c = PP_FX32_F[k]; PP_FX32_PAL[k] = ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; }   // ABGR (little endian) für Uint32Array auf ImageData
const PP_FX32_RAUCH_RAMPE = [PP_FX32_PAL.grau, PP_FX32_PAL.asche, PP_FX32_PAL.rauch, PP_FX32_PAL.dunkel];
const PP_FX32_FUNKEN_RAMPE = [PP_FX32_PAL.creme, PP_FX32_PAL.gelb, PP_FX32_PAL.orange, PP_FX32_PAL.rot];
const PP_FX32_BAYER = (() => {
  const bay = (n) => {
    if (n === 1) return [[0]];
    const m = bay(n / 2), s = n / 2, r = [];
    for (let y = 0; y < n; y++) { r.push([]); for (let x = 0; x < n; x++) r[y].push(4 * m[y % s][x % s] + [[0, 2], [3, 1]][Math.floor(y / s)][Math.floor(x / s)]); }
    return r;
  };
  const b = bay(8), f = new Uint8Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) f[y * 8 + x] = b[y][x];
  return f;
})();
const PP_FX32_WACKELN = [1, -1, 0.6, -0.8];

/** Kleine CPU-Leinwand zum einmaligen Lesen eines Frames (kein Lesen von sichtbaren/GPU-Leinwänden). */
let PP_FX32_KRATZER = null;
function ppFx32Kratzer(w, h) {
  if (!PP_FX32_KRATZER) { const c = document.createElement('canvas'); PP_FX32_KRATZER = { c, g: c.getContext('2d', { willReadFrequently: true }) }; }
  const k = PP_FX32_KRATZER;
  if (k.c.width !== w || k.c.height !== h) { k.c.width = w; k.c.height = h; }
  return k;
}

/**
 * Maße der Figur im Frame-Raster (wie `HeroIdleSprite`): Gesichtsmitte, Standlinie, Unterkante, Maßstab, Rand der Leinwand für Splitter/Ringe.
 * `zw` = Breite der Zone in Sprite-Pixeln (die Bodenringe richten sich nach der Karte, nicht nach dem Sprite: Flammen/Flügel machen Frames oft sehr breit).
 */
function ppFx32Geo(e, zw) {
  const m = e.meta, k = e.kern, fw = m.frameWidth, fh = m.frameHeight;
  const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const cw = Math.max(1, k.x1 - k.x0);
  const mitteX = zahl(m.anchorX) ?? zahl(m.faceX) ?? zahl(k.kopfX) ?? (k.x0 + cw / 2);
  const fussY = zahl(m.footY) ?? k.y1;
  const unterkante = Math.max(fussY, k.y1);
  const s = 2.8125 * (Number(m.boardScale) > 0 ? Number(m.boardScale) : 1);
  const sub = 1;                                                       // Leinwandpixel je Sprite-Pixel: EINS (Hero-Pixel-Regel, auch Partikel/Ringe auf dem Raster der Figur); vorher 2 bei kleinen Figuren (halbe Zellen)
  const mag = Math.max(0.7, Math.min(2.5, fh / 45));                   // große Figuren fliegen weiter
  zw = Math.max(12, Math.min(zw || 20, 60));
  const ring = zw * 0.8 + 3 * zw * 0.06;                              // größter Ringradius (Sprite-Pixel): die Ringe sind etwa anderthalb Karten breit
  const ML = Math.ceil(Math.max(10, fw * 0.4, ring - mitteX + 4)), MR = Math.ceil(Math.max(10, fw * 0.4, ring - (fw - mitteX) + 4)), MT = Math.ceil(14 * mag) + 4;
  const unten = Math.max(unterkante, fussY + Math.ceil(ring * 0.3) + 3);
  return { fw, fh, mitteX, fussY, unterkante, s, sub, mag, zw, ring, ML, MR, MT, unten, W: (fw + ML + MR) * sub, H: (MT + unten) * sub, y0: k.y0, y1: k.y1 };
}

/**
 * Zerlegung eines Frames in Pixelstücke (Blöcke b×b Sprite-Pixel; b = 1, bei vielen Pixeln 2 oder 3). Einmal je Sheet/Frame, gemerkt.
 * Liefert { n, b, x, y, c } (Block links oben im Frame, Farbe als ABGR).
 */
function ppFx32Zerlege(e, frame, stein) {
  const cache = e._ppFx32Z || (e._ppFx32Z = new Map());
  const key = frame + '|' + (stein ? 1 : 0);
  const da = cache.get(key);
  if (da) return da;
  const m = e.meta, fw = m.frameWidth, fh = m.frameHeight;
  let quelle = e.img;
  if (stein && window.HeroIdleAnims && window.HeroIdleAnims.steinSheet) { const sc = window.HeroIdleAnims.steinSheet(e); if (sc) quelle = sc; }
  const k = ppFx32Kratzer(fw, fh), g = k.g;
  g.clearRect(0, 0, fw, fh);
  const vert = m.layout === 'vertical';
  g.drawImage(quelle, vert ? 0 : frame * fw, vert ? frame * fh : 0, fw, fh, 0, 0, fw, fh);
  const d = g.getImageData(0, 0, fw, fh).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] >= 96) n++;
  let b = n > 5200 ? 3 : (n > 2300 ? 2 : 1);
  try { if (b < 2 && n > 900 && window.ppIsPhone && window.ppIsPhone()) b = 2; } catch (er) { /* weg */ }
  const bw = Math.ceil(fw / b), bh = Math.ceil(fh / b), cap = bw * bh;
  const X = new Int16Array(cap), Y = new Int16Array(cap), C = new Uint32Array(cap);
  let q = 0;
  const halb = Math.ceil(b * b / 2);
  for (let by = 0; by < fh; by += b) {
    for (let bx = 0; bx < fw; bx += b) {
      let i = -1, cnt = 0;
      if (b === 1) { if (d[(by * fw + bx) * 4 + 3] >= 96) { i = (by * fw + bx) * 4; cnt = 1; } }
      else {
        const mx = Math.min(fw - 1, bx + (b >> 1)), my = Math.min(fh - 1, by + (b >> 1));
        for (let yy = by; yy < Math.min(fh, by + b); yy++) for (let xx = bx; xx < Math.min(fw, bx + b); xx++) {
          const j = (yy * fw + xx) * 4;
          if (d[j + 3] >= 96) { cnt++; if (i < 0) i = j; }
        }
        const jm = (my * fw + mx) * 4;
        if (cnt >= halb && d[jm + 3] >= 96) i = jm;
      }
      if (i < 0 || cnt < (b === 1 ? 1 : halb)) continue;
      X[q] = bx; Y[q] = by; C[q] = ((255 << 24) | (d[i + 2] << 16) | (d[i + 1] << 8) | d[i]) >>> 0;
      q++;
    }
  }
  const res = { n: q, b, x: X, y: Y, c: C, P: null };
  res.P = ppFx32Teilchen(e, res);
  if (cache.size >= 70) cache.delete(cache.keys().next().value);
  cache.set(key, res);
  return res;
}

/** Pool des Platzes: eigene Leinwand im Platz (unsichtbar), im Leerlauf angelegt und gewärmt. */
function ppFx32Pool(platz) {
  if (platz._ppFx32Pool) return platz._ppFx32Pool;
  const e = platz._ppEintrag;
  if (!e || !e.meta || !e.kern) return null;
  const orig = platz.querySelector('.hero-idle-steher');
  if (!orig) return null;
  // Zonenbreite in Sprite-Pixeln (Layout lesen: einmal, im Leerlauf, nicht beim Tod)
  let zw = 20;
  try {
    const bsk = parseFloat(getComputedStyle(platz).getPropertyValue('--board-scale')) || 1, pw = parseFloat(platz.style.width) || 0;
    if (pw > 0) zw = pw / (2.8125 * (Number(e.meta.boardScale) > 0 ? Number(e.meta.boardScale) : 1) * bsk);
  } catch (er) { /* Standard */ }
  const g = ppFx32Geo(e, zw);
  const st = document.createElement('div');
  st.className = 'pp-fx32-steher';
  st.style.cssText = orig.style.cssText + ';visibility:hidden';
  const cv = document.createElement('canvas');
  cv.width = g.W; cv.height = g.H;
  cv.style.left = 'calc(' + (-g.ML * g.s).toFixed(3) + 'px * var(--board-scale))';
  cv.style.top = 'calc(' + (-g.MT * g.s).toFixed(3) + 'px * var(--board-scale))';
  cv.style.width = 'calc(' + (g.W / g.sub * g.s).toFixed(3) + 'px * var(--board-scale))';
  cv.style.height = 'calc(' + (g.H / g.sub * g.s).toFixed(3) + 'px * var(--board-scale))';
  st.appendChild(cv);
  platz.appendChild(st);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(g.W, g.H);
  ctx.putImageData(img, 0, 0);                                            // wärmen: erste Ressourcen-Anlage jetzt, nicht beim Tod
  const pool = { st, cv, ctx, img, buf: new Uint32Array(img.data.buffer), g };
  platz._ppFx32Pool = pool;
  return pool;
}

/**
 * Alle Frames eines Sheets nach und nach im Leerlauf zerlegen (ein Frame je freiem Leerlauf-Fenster, ~1–3 ms): der Tod trifft die Figur in einem beliebigen Frame, und die erste
 * Zerlegung eines Frames kostete 2–10 ms (Sheet lesen, Blöcke bilden, Flugbahnen würfeln) — das gehört nicht in den Takt, in dem der Held fällt.
 */
function ppFx32Vorrechnen(e, platz) {
  if (e._ppFx32Vor) return;
  const frames = Math.max(1, e.meta.frames | 0), v = (e._ppFx32Vor = { next: platz._ppFrame | 0, fertig: 0 });
  const leer = window.requestIdleCallback ? (f, o) => window.requestIdleCallback(f, o) : (f) => setTimeout(() => f({ timeRemaining: () => 8, didTimeout: true }), 60);
  const schritt = (dl) => {
    try {
      if (dl.timeRemaining() >= 3 || dl.didTimeout) { ppFx32Zerlege(e, v.next % frames, false); v.next++; v.fertig++; }
    } catch (er) { return; }
    if (v.fertig < frames) setTimeout(() => leer(schritt, { timeout: 4000 }), 100);
  };
  setTimeout(() => leer(schritt, { timeout: 4000 }), 300);
}

/** Einmalig im Leerlauf: den Zerlege-Pfad an einem Spielzeug-Sheet durchlaufen (Code übersetzen, CPU-Leinwand anlegen), damit der erste echte Tod nicht dafür zahlt. */
let PP_FX32_WARM = false;
function ppFx32Aufwaermen() {
  if (PP_FX32_WARM) return;
  PP_FX32_WARM = true;
  try {
    const c = document.createElement('canvas'); c.width = 32; c.height = 16;
    const g = c.getContext('2d'); g.fillStyle = '#808898'; g.fillRect(2, 2, 12, 12); g.fillStyle = '#fffbd2'; g.fillRect(20, 3, 8, 10);
    const e = { img: c, meta: { frameWidth: 16, frameHeight: 16, frames: 2, layout: 'horizontal' }, kern: { x0: 2, y0: 2, x1: 14, y1: 14 } };
    ppFx32Zerlege(e, 0, false); ppFx32Zerlege(e, 1, false);
    const Z = { D: e._ppFx32Z.get('0|0'), g: ppFx32Geo(e, 20) };
    ppFx32Baue(Z);
  } catch (er) { /* weg */ }
}

/** Leerlauf-Vorbereitung eines Platzes: Pool anlegen und das Lesen des Sheets einmal anstoßen (erster Frame), damit der Tod selbst nichts mehr anlegt. */
function ppFx32Bereite(platz, nochmal) {
  try {
    if (!platz || !platz.isConnected || platz._ppFx32Tot || platz._ppFx32Pool) return;
    ppFx32Aufwaermen();
    if (!platz._ppEintrag) { if (!nochmal) setTimeout(() => ppFx32Bereite(platz, true), 2500); return; }
    ppFx32Pool(platz);
    ppFx32Zerlege(platz._ppEintrag, platz._ppFrame | 0, false);
    ppFx32Vorrechnen(platz._ppEintrag, platz);
  } catch (er) { /* weg */ }
}

// ── Zeichnen in den Pixelpuffer (ganze Pixel, Palette, kein Alpha) ──
function ppFx32Rect(buf, W, H, x, y, s, col) {
  const x1 = Math.min(W, x + s), y1 = Math.min(H, y + s);
  for (let yy = Math.max(0, y); yy < y1; yy++) { const o = yy * W; for (let xx = Math.max(0, x); xx < x1; xx++) buf[o + xx] = col; }
}
function ppFx32Plus(buf, W, H, x, y, u, col) {
  ppFx32Rect(buf, W, H, x, y, u, col);
  ppFx32Rect(buf, W, H, x - u, y, u, col); ppFx32Rect(buf, W, H, x + u, y, u, col);
  ppFx32Rect(buf, W, H, x, y - u, u, col); ppFx32Rect(buf, W, H, x, y + u, u, col);
}
/** Flache Ellipse (Bodenring), `luecke`: nur jedes zweite Pixel (Schachbrett) für den zweiten, helleren Ring. */
function ppFx32Ring(buf, W, H, cx, cy, rx, ry, dick, col, schach) {
  if (rx < 1) return;
  const n = Math.max(12, Math.ceil(rx * 5));
  let lx = -9999, ly = -9999;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = cx + Math.round(Math.cos(a) * rx), y = cy + Math.round(Math.sin(a) * ry);
    if (x === lx && y === ly) continue;
    lx = x; ly = y;
    if (schach && ((x + y) & 1)) continue;
    ppFx32Rect(buf, W, H, x - (dick >> 1), y - (dick >> 1), dick, col);
  }
}
const ppFx32Eased = (u) => { u = Math.max(0, Math.min(1, u)); return 1 - Math.pow(1 - u, 3); };

/**
 * Flugbahnen aller Pixelstücke eines Frames (Startzeit, Geschwindigkeit, Lebensdauer, Landezeit, Größe). Hängt nur an Sheet und Frame, nicht an der Zone — wird zusammen mit der
 * Zerlegung im Leerlauf vorausberechnet (Zufall steckt hier, nicht im Bild); beim Tod selbst ist es nur noch ein Nachschlagen.
 */
function ppFx32Teilchen(e, D) {
  const g = ppFx32Geo(e, 20), n = D.n, b = D.b, mag = g.mag, sub = g.sub;
  const VX = new Float32Array(n), VY = new Float32Array(n), TS = new Float32Array(n), LIFE = new Float32Array(n), TL = new Float32Array(n), FLO = new Float32Array(n), SZ = new Uint8Array(n);
  const hoehe = Math.max(1, g.y1 - g.y0), grav = 100 * mag;
  let ende = 0;
  for (let i = 0; i < n; i++) {
    const x = D.x[i], y = D.y[i];
    const hy = Math.max(0, Math.min(1, (y + b / 2 - g.y0) / hoehe));
    const sc = 0.6 * (1 - hy) + 0.4 * PP_FX32_BAYER[((y & 7) << 3) | (x & 7)] / 64;   // wie im Trailer: 0,6·(1 − y/H) + 0,4·Bayer — die Füße zuerst, der Kopf zuletzt
    TS[i] = PP_FX32_HALT + sc * PP_FX32_DAUER;
    VX[i] = ((x + b / 2 - g.mitteX) * 0.25 + (Math.random() - 0.5) * 16) * mag;
    VY[i] = -(6 + Math.random() * 45) * mag;
    const flo = Math.max(g.fussY + 1 - b, y);
    FLO[i] = flo;
    const dis = Math.max(0, VY[i] * VY[i] + 2 * grav * (flo - y));
    TL[i] = (-VY[i] + Math.sqrt(dis)) / grav * 1000;
    LIFE[i] = Math.min(700 + Math.random() * 700, TL[i] + 160);   // am Boden löst sich der Splitter schnell auf (keine liegende Pixelspur)
    const r = Math.random();
    SZ[i] = Math.max(1, Math.round(b * sub * (r < 0.45 ? 0.5 : (r < 0.9 ? 1 : 1.5))));
    if (TS[i] + LIFE[i] > ende) ende = TS[i] + LIFE[i];
  }
  return { VX, VY, TS, LIFE, TL, FLO, SZ, grav, ende };
}

/** Rauch und Funken eines Todes anlegen (klein; einmal beim Start). */
function ppFx32Baue(Z) {
  if (Z.stil === 'sturz' && typeof ppFx71BaueSturz === 'function') { ppFx71BaueSturz(Z); return; }   // zweiter Stil „Einsinken“ (app-fx-71.jsx)
  const D = Z.D, g = Z.g, mag = g.mag, sub = g.sub;
  const hoehe = Math.max(1, g.y1 - g.y0);
  let ende = D.P.ende;
  // Rauch: graue Quadrate steigen am Fuß langsam auf (Trailer „Staubwolke“, hier lockerer)
  const rauch = [];
  const nR = Math.round(18 * (D.n > 300 ? 1 : 0.7));
  for (let i = 0; i < nR; i++) {
    const t0 = PP_FX32_HALT + (i / nR) * (PP_FX32_DAUER + 150) + Math.random() * 40, life = 1000 + Math.random() * 800;
    rauch.push({ t0, life, x: g.mitteX + (Math.random() - 0.5) * g.zw * 0.8, y: g.fussY - Math.random() * g.fh * 0.25, vx: (Math.random() - 0.5) * 8, vy: -(3 + Math.random() * 6), sz: (Math.random() < 0.5 ? 3 : 2) * sub * (g.fw > 70 ? 1.5 : 1) | 0 });
    ende = Math.max(ende, t0 + life);
  }
  // Funken: ein Stoß beim Zerfallsbeginn
  const funken = [];
  const nF = Math.round(16 * Math.min(1.5, mag));
  for (let i = 0; i < nF; i++) {
    const an = Math.random() * Math.PI * 2, sp = (30 + Math.random() * 70) * mag;
    funken.push({ t0: PP_FX32_HALT + Math.random() * 160, life: 320 + Math.random() * 320, x: g.mitteX + (Math.random() - 0.5) * g.zw * 0.5, y: g.y0 + hoehe * (0.2 + Math.random() * 0.6), vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.8 - 20 * mag, plus: Math.random() < 0.3 });
    ende = Math.max(ende, funken[i].t0 + funken[i].life);
  }
  Z.P = D.P;
  Z.rauch = rauch; Z.funken = funken;
  Z.ende = ende + PP_FX32_BILD;
}

/** Ein Bild des Todes in den Puffer schreiben (t in ms seit Beginn). */
function ppFx32Zeichne(Z, t, f) {
  if (Z.stil === 'sturz' && typeof ppFx71ZeichneSturz === 'function') { ppFx71ZeichneSturz(Z, t, f); return; }   // zweiter Stil „Einsinken“ (app-fx-71.jsx)
  const pool = Z.pool, g = Z.g, buf = pool.buf, W = g.W, H = g.H, sub = g.sub, D = Z.D, P = Z.P, b = D.b, ML = g.ML, MT = g.MT;
  buf.fill(0);
  const cxm = Math.round((g.mitteX + ML) * sub), cyf = Math.round((g.fussY + MT) * sub);
  // Bodenringe (hinter allem)
  for (let k = 0; k < 4; k++) {
    const dt = t - (PP_FX32_HALT + k * 250);
    if (dt < 0 || dt >= 450) continue;
    const R = (g.zw * (0.8 + 0.06 * k)) * sub;
    const r1 = Math.round(ppFx32Eased(dt / 450) * R);
    ppFx32Ring(buf, W, H, cxm, cyf, r1, Math.round(r1 * 0.3), sub, PP_FX32_PAL.grau, false);
    if (dt > 80) { const r2 = Math.round(ppFx32Eased((dt - 80) / 400) * R * 0.75); ppFx32Ring(buf, W, H, cxm, cyf, r2, Math.round(r2 * 0.3), sub, PP_FX32_PAL.asche, true); }
  }
  // Rauch
  for (const r of Z.rauch) {
    const dt = t - r.t0;
    if (dt < 0 || dt >= r.life) continue;
    const u = dt / r.life;
    if (u > 0.6 && PP_FX32_BAYER[((((r.y * sub) | 0) & 7) << 3) | (((r.x * sub) | 0) & 7)] < ((u - 0.6) / 0.4) * 64) continue;   // Dither-Ausblenden statt Alpha
    const px = Math.round((r.x + ML + r.vx * dt / 1000) * sub), py = Math.round((r.y + MT + r.vy * dt / 1000) * sub);
    ppFx32Rect(buf, W, H, px, py, r.sz, PP_FX32_RAUCH_RAMPE[Math.min(3, (u * 4) | 0)]);
  }
  // Wackeln: im Anhalten ±1/±2 Sprite-Pixel, im Zerfall abklingend (Trailer: `hdx`)
  const du = Math.max(0, Math.min(1, (t - PP_FX32_HALT) / PP_FX32_DAUER));
  const ox = Math.round((f < 4 ? [1, -1, 2, -2][f] : PP_FX32_WACKELN[f % 4] * 2 * (1 - du)) * sub);
  const blitz = f < 2;
  // Teilchen
  const bs = b * sub;
  const cb = PP_FX32_PAL.creme;
  for (let i = 0; i < D.n; i++) {
    const dt = t - P.TS[i];
    if (dt < 0) {
      ppFx32Rect(buf, W, H, (D.x[i] + ML) * sub + ox, (D.y[i] + MT) * sub, bs, blitz ? cb : D.c[i]);
      continue;
    }
    if (dt >= P.LIFE[i]) continue;
    const ds = (dt > P.TL[i] ? P.TL[i] : dt) / 1000, sz = P.SZ[i];
    const fx = D.x[i] + P.VX[i] * ds, fy = Math.min(P.FLO[i], D.y[i] + P.VY[i] * ds + 0.5 * P.grav * ds * ds);
    const px = Math.round((fx + ML + b / 2) * sub - sz / 2 + ox * (1 - Math.min(1, dt / 200))), py = Math.round((fy + MT + b / 2) * sub - sz / 2);
    const u = dt / P.LIFE[i];
    if (u > 0.62 && PP_FX32_BAYER[((py & 7) << 3) | (px & 7)] < ((u - 0.62) / 0.38) * 64) continue;
    ppFx32Rect(buf, W, H, px, py, sz, D.c[i]);
  }
  // Funken (vorn)
  for (const s of Z.funken) {
    const dt = t - s.t0;
    if (dt < 0 || dt >= s.life) continue;
    const u = dt / s.life, ds = dt / 1000;
    if (u > 0.5 && ((f + ((s.x * 7) | 0)) & 1)) continue;                                  // Blinken im Ausklang
    const px = Math.round((s.x + ML + s.vx * ds) * sub), py = Math.round((s.y + MT + s.vy * ds + 60 * ds * ds) * sub);
    const col = PP_FX32_FUNKEN_RAMPE[Math.min(3, (u * 4) | 0)];
    if (s.plus) ppFx32Plus(buf, W, H, px, py, sub, col); else ppFx32Rect(buf, W, H, px, py, sub, col);
  }
  pool.ctx.putImageData(pool.img, 0, 0);
}

function ppFx32Ende(Z, abbruch) {
  if (Z.fertig) return;
  Z.fertig = true;
  try { if (Z.zone._ppFx32Tod === Z) Z.zone._ppFx32Tod = null; } catch (er) { /* weg */ }
  try { Z.zone.removeAttribute('data-pp-stirbt'); } catch (er) { /* weg */ }
  try { if (Z.platz.parentNode) Z.platz.parentNode.removeChild(Z.platz); } catch (er) { /* weg */ }
}

/**
 * Der Tod einer Figur: `platz` ist der soeben entfernte `.hero-idle-platz`. Gibt true zurück, wenn der Zerfall läuft (Platz wieder eingehängt); sonst false (alter Pfad).
 */
function ppFx32Tod(platz) {
  try {
    if (!platz || platz._ppFx32Tot) return false;
    const zone = platz._ppZone, e = platz._ppEintrag, HA = window.HeroIdleAnims;
    if (!zone || !e || !HA || !zone.isConnected) return false;
    const ebene = HA.ebene();
    if (!ebene || !ebene.isConnected) return false;
    if (!zone.querySelector('.hero-dead-marker')) return false;               // kein Tod (Held entfernt/ausgetauscht, Brett abgebaut)
    const cl = platz.classList;
    if (platz.style.display === 'none' || cl.contains('hero-idle-unsichtbar') || cl.contains('hero-idle-aufstieg')) return false;   // eingefahrene Figur (Hover/Zielwahl) stirbt trotzdem sichtbar: der Held fällt, die Figur steht für den Tod wieder da
    if (zone._ppFx32Tod) ppFx32Ende(zone._ppFx32Tod, true);
    const stein = cl.contains('hero-idle-stein');
    const D = ppFx32Zerlege(e, platz._ppFrame | 0, stein);
    if (!D.n) return false;
    const pool = ppFx32Pool(platz);
    if (!pool) return false;
    const g = pool.g;
    const Z = { platz, zone, e, g, D, pool, stil: (typeof ppFx71Stil === 'function' && typeof PP_FX71_DAUER_S === 'number' ? ppFx71Stil(platz) : 'shatter'), fertig: false, t0: performance.now(), f: -1, veil: 0, zaehler: 0 };
    ppFx32Baue(Z);
    // Platz wieder einhängen: alte Kinder per CSS weg, nur die eigene Leinwand zeigen. Fx27-Pool nicht noch anlegen lassen.
    platz._ppFx32Tot = true;
    platz._ppGeisterPool = platz._ppGeisterPool || [];
    cl.add('pp-fx32-tot');
    cl.remove('hero-idle-zurueck');
    platz.style.translate = '';
    try { const oc = platz.querySelector('canvas.hero-idle-canvas'); if (oc && oc.style.imageRendering) pool.cv.style.imageRendering = oc.style.imageRendering; } catch (er) { /* Standard: pixelated */ }   // wie die Figur: beim Verkleinern weich, sonst scharf
    pool.st.style.visibility = 'visible';
    ebene.appendChild(platz);
    zone._ppFx32Tod = Z;
    zone.setAttribute('data-pp-stirbt', '1');
    ppFx32Zeichne(Z, 0, 0);
    Z.f = 0;
    const raf = window.ppTaktRaf || window.requestAnimationFrame;
    const schritt = () => {
      if (Z.fertig) return;
      const t = performance.now() - Z.t0;
      // Wiederbelebt (neue Figur im Zonenplatz) / Zone weg / kein Grabstein mehr (Held lebt oder ist gelöscht): abbrechen
      const neu = zone._ppFigurPlatz;
      if (!zone.isConnected || !platz.isConnected || (neu && neu !== platz && neu.isConnected)
        || ((++Z.zaehler % 6) === 0 && !zone.querySelector('.hero-dead-marker'))) { ppFx32Ende(Z, true); return; }
      if (t >= Z.ende) { ppFx32Ende(Z, false); return; }
      const f = Math.floor(t / PP_FX32_BILD);
      if (f !== Z.f) {
        Z.f = f;
        const dz = Z.stil === 'sturz' ? PP_FX71_DAUER_S : PP_FX32_DAUER, v = t >= PP_FX32_HALT + dz ? 0 : (t >= PP_FX32_HALT + dz * 0.62 ? 2 : 1);   // Karte: hell → Schachbrett-Schleier → Gefallen-Verdunklung
        if (v !== Z.veil) {
          Z.veil = v;
          // Schachbrett-Schleier in Hero-Pixel-Zellen (vorher fest `4px · --board-scale`: gebrochene, gröbere Zelle als die Figur): Zelle dieser Zone = Rasterzelle der Effekte (`ppFxZelle`)
          if (v === 2 && !window.PP_RETRO) { try { zone.style.setProperty('--pp-zelle', (typeof ppFxZelle === 'function' ? ppFxZelle(zone) : 3) + 'px'); } catch (e) { /* Rückfall in style.css: 2 px */ } }
          if (v === 0) { zone.removeAttribute('data-pp-stirbt'); zone.style.removeProperty('--pp-zelle'); } else zone.setAttribute('data-pp-stirbt', String(v));
        }
        ppFx32Zeichne(Z, t, f);
      }
      raf(schritt);
    };
    raf(schritt);
    return true;
  } catch (er) {
    try { console.warn('[Heldentod]', er); } catch (e2) { /* weg */ }
    return false;
  }
}
window.ppFx32Tod = ppFx32Tod;

(function ppFx32Beobachter() {
  const plan = (platz) => {
    if (platz._ppFx32Geplant) return;
    platz._ppFx32Geplant = true;
    setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(() => ppFx32Bereite(platz), { timeout: 2500 }) : ppFx32Bereite(platz)), 500);
  };
  const haenge = (ebene) => {
    if (!ebene || ebene._ppFx32Beob) return;
    ebene._ppFx32Beob = true;
    new MutationObserver((ms) => {
      for (const m of ms) {
        for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList && n.classList.contains('hero-idle-platz') && !n._ppFx32Tot) plan(n);
        for (const n of m.removedNodes) if (n.nodeType === 1 && n.classList && n.classList.contains('hero-idle-platz') && !n._ppFx32Tot) ppFx32Tod(n);
      }
    }).observe(ebene, { childList: true });
    ebene.querySelectorAll('.hero-idle-platz').forEach(plan);
  };
  const start = () => { if (window.HeroIdleAnims && window.HeroIdleAnims.abonniereEbene) { window.HeroIdleAnims.abonniereEbene(haenge); haenge(window.HeroIdleAnims.ebene()); } else setTimeout(start, 500); };
  start();
})();
