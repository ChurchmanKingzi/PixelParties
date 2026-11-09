// app-fx-55: Kampffelder — der Boden des Bretts in der Perspektive der `.board-plane` (Pixelart, nur Optik)
//
// ═════════════════════════════════════════════════════════════════
//  Statt des schwarzen Bretts steht jede Partie auf einem von sechs neutralen Kampfräumen (Steinarena, Gladiatoren-Sand, Tempelboden, Burghof bei Nacht,
//  Kristallhöhle, Bibliotheks-Mosaik); das Tutorial hat sein eigenes Feld (Übungshalle). Reine Draufsicht: der ganze Boden ist Spielfläche, Wand-/Horizontmotive
//  gibt es nicht; Dekoration nur als Bodenmuster und als Rand-/Eckobjekte (Feuerschalen, Kisten, Fässer, Säulenbasen …) AM sichtbaren Brettrand.
//
//  AUSWAHL: `ppFx55Wahl(roomId, tutorial)` = FNV-1a(roomId) mod 6 — beide Spieler und Zuschauer haben dieselbe roomId, also dasselbe Feld, ohne Server. Tutorial (`isTutorial`)
//  immer „dojo“; das Dojo kommt in der normalen Rotation nie vor. Rätsel (`isPuzzle` ohne Tutorial) nehmen den Hash wie normale Partien. Test: `?bf=<id>` oder
//  `window.__ppBfForce = '<id>'` (`aus` = kein Feld). Eine Area-Karte (AreaBackgrounds, deckend) ersetzt das Feld komplett: dann wird nichts gebacken (`verdeckt`).
//
//  PERSPEKTIVE („Mode 7“): die Plane ist per CSS geneigt (rotateX, Zoom, Perspektive auf `.board-plane-clip`). Ein Bild als Kind der Plane würde der Compositor bilinear
//  filtern (Mischfarben, Palettenverstoß); darum backe ich den Boden selbst: die Projektion ist eine Homographie lokal→Bildschirm, aus dem berechneten Stil
//  (Transform-Matrix, Transform-Origin, Offsets der Plane, Perspective/-Origin des Clips) für die vier Ecken der Plane gerechnet. Jeder Leinwandpixel fragt per Rückprojektion
//  GENAU EINEN Kachelpixel ab (Nearest-Neighbor) — Pixel werden zur Ferne kleiner, Kreise werden zu Ellipsen, Fugen laufen auf den Fluchtpunkt zu, keine Mischfarbe.
//    • Boden: Kachel `bg.png` (192×100 Kunstpixel, nahtlos in x), 1 Kunstpixel = Plane-Höhe/95 lokale px, mittig an Heldenachse und Mittelzeile.
//    • Randstücke: `edge_l.png` (30 px breit, rechts gespiegelt) am sichtbaren Brettrand, ebenfalls in der Perspektive; Randabdunklung (Bayer in Kunstpixeln) mit eingebacken.
//    • EINE Leinwand (Boden) in halber Bildschirmauflösung (Kunstpixel sind ≥ 4 px groß; 4× weniger Backen/Hochladen). Optional zwei Puls-Masken (Runen/Adern; per `visibility`).
//    • Gebacken wird nur bei Änderung der Projektion/Größe (Schlüssel), entprellt; im Takt wird nie Layout gelesen. `board-flat-measure` (Messfenster des Bretts) wird übersprungen.
//    • Ambient (Flammen auf den Feuerschalen, Funken, Staub, Funkeln, Runenpuls): eine zweite Leinwand, im Bildschirmraum nachprojiziert, 100-ms-Takt (Handy 200 ms), nur bei
//      Bildwechsel, nur wenn sichtbar. Handy-Profil (`ppIsPhone`): nur Flammen und Pulse. Aus bei Retro (dann gar kein Feld), `prefers-reduced-motion`, „Play Animations: aus“,
//      `__ppFxAlt` und `window.__ppBfAmbient = false` → statisches Bild.
//  LADEN: pro Feld nur das gewählte (≈ 6–12 KB); `ppBfVorladen(roomId, tutorial)` wird beim Eintreffen von game_started/game_state gerufen (app-main.jsx), der Baustein backt
//  im ersten Bild nach dem Einhängen — beim Spielstart liegt der Brettaufbau-Schleier (app-fx-51) ohnehin darüber.
//  ZONENRAHMEN: solange ein Feld aktiv ist, trägt `.game-board` das Attribut `data-bf="<id>"`; style.css färbt dann die Zonenrahmen in ihrer Zonenfarbe (helle Palettentöne).
//
//  Messung (nur Tests): `window.__ppBfBack` = Backzeiten (ms), `window.__ppBfZeit` = Zeichenzeit je Bildwechsel (ms).
// ═════════════════════════════════════════════════════════════════
const PP_BF_FELDER = ['stein', 'sand', 'tempel', 'hof', 'kristall', 'mosaik'];       // Rotation; 'dojo' nur im Tutorial
const PP_BF_TW = 192, PP_BF_TH = 100, PP_BF_EW = 30;
const PP_BF_F = 2;                                                                    // Leinwandauflösung = Bildschirm / F
const PP_BF_DIM = 0xFF0C0608;                                                         // #08060c als ABGR
const PP_BF_BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const ppBfBayer = (x, y) => (PP_BF_BAYER[y & 3][x & 3] + 0.5) / 16;
const ppBfHash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** Feld zur Raum-ID: FNV-1a mod 6 (deterministisch, bei allen Spielern gleich); Tutorial → 'dojo'; Test-Schalter siehe Kopf. */
function ppFx55Wahl(roomId, tutorial) {
  let f = null;
  try { f = window.__ppBfForce || new URLSearchParams(window.location.search).get('bf'); } catch (e) { /* ohne */ }
  if (f === 'aus') return null;
  if (f && (PP_BF_FELDER.includes(f) || f === 'dojo')) return f;
  if (tutorial) return 'dojo';
  let h = 0x811c9dc5; const s = String(roomId || '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return PP_BF_FELDER[h % PP_BF_FELDER.length];
}

// ── Laden: pro Feld einmal (Meta, Kachel, Randstück, Puls-Masken) → Pixel als Uint32Array ─────────────────────────────
const ppBfDaten = {};
function ppBfPixel(url) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
        res({ w: c.width, h: c.height, px: new Uint32Array(g.getImageData(0, 0, c.width, c.height).data.buffer) });
      } catch (e) { res(null); }
    };
    im.onerror = () => res(null);
    im.src = url;
  });
}
function ppBfLaden(id) {
  if (ppBfDaten[id]) return ppBfDaten[id].p;
  const base = '/bf/' + id + '/';
  const d = { fertig: null };
  d.p = (async () => {
    const meta = await fetch(base + 'meta.json').then((r) => r.json());
    const puls = (meta.anim || []).find((a) => a.t === 'pulse');
    const [kachel, rand, hell, halb] = await Promise.all([ppBfPixel(base + 'bg.png'), ppBfPixel(base + 'edge_l.png'),
      puls ? ppBfPixel(base + puls.src + '-lit.png') : null, puls ? ppBfPixel(base + puls.src + '-half.png') : null]);
    d.fertig = { meta, kachel, rand: rand && rand.w === PP_BF_EW ? rand : null, hell, halb, puls: puls || null };
    return d.fertig;
  })().catch(() => null);
  ppBfDaten[id] = d;
  return d.p;
}
/** Früh vorladen (Raumbeitritt / erster Spielzustand): nur das Feld dieser Partie. */
let ppBfZuletzt = '';
window.ppBfVorladen = (roomId, tutorial) => { if (window.PP_RETRO) return; const k = roomId + '|' + !!tutorial; if (k === ppBfZuletzt) return; ppBfZuletzt = k; const id = ppFx55Wahl(roomId, tutorial); if (id) ppBfLaden(id); };

// ── Projektion ───────────────────────────────────────────────────────────────────────────────────────────────────────
function ppBfLoeseH(src, dst) {           // Homographie aus 4 Punkten (3×3 zeilenweise, h22 = 1)
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
  }
  const n = 8;
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const h = new Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * h[c]; h[i] = s / A[i][i]; }
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
function ppBfInv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
const ppBfProj = (Hm, lx, ly) => { const d = Hm[6] * lx + Hm[7] * ly + 1; return [(Hm[0] * lx + Hm[1] * ly + Hm[2]) / d, (Hm[3] * lx + Hm[4] * ly + Hm[5]) / d]; };
function ppBfMatrix(t) {                  // CSS-Transform (berechneter Wert) → 4×4 spaltenweise
  if (!t || t === 'none') return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const v = t.slice(t.indexOf('(') + 1, t.lastIndexOf(')')).split(',').map(parseFloat);
  if (t.startsWith('matrix3d')) return v;
  return [v[0], v[1], 0, 0, v[2], v[3], 0, 0, 0, 0, 1, 0, v[4], v[5], 0, 1];
}
/** Projektion der Plane: Eckpunkte lokal → Koordinaten im Clip (= im Root). Nur aus berechneten Stilen und Offsets, keine Sonden im DOM. */
function ppBfMessen(root, clip, plane, board) {
  const W = root.clientWidth, H = root.clientHeight, w = plane.offsetWidth, h = plane.offsetHeight;
  if (!W || !H || !w || !h) return null;
  const cs = getComputedStyle(plane), cc = getComputedStyle(clip);
  const to = cs.transformOrigin.split(' ').map(parseFloat), tx = to[0] || 0, ty = to[1] || 0;
  const M = ppBfMatrix(cs.transform);
  const P = parseFloat(cc.perspective), po = cc.perspectiveOrigin.split(' ').map(parseFloat);
  const pl = plane.offsetLeft, pt = plane.offsetTop;
  const proj = (x, y) => {
    const X = x - tx, Y = y - ty;
    const xp = M[0] * X + M[4] * Y + M[12], yp = M[1] * X + M[5] * Y + M[13], zp = M[2] * X + M[6] * Y + M[14], wp = M[3] * X + M[7] * Y + M[15] || 1;
    let X2 = xp / wp + tx + pl, Y2 = yp / wp + ty + pt;
    if (P > 0) { const s = P / (P - zp / wp); X2 = po[0] + (X2 - po[0]) * s; Y2 = po[1] + (Y2 - po[1]) * s; }
    return [X2, Y2];
  };
  const Hm = ppBfLoeseH([[0, 0], [w, 0], [0, h], [w, h]], [proj(0, 0), proj(w, 0), proj(0, h), proj(w, h)]);
  const mid = plane.querySelector(':scope > .board-mid-row');
  const ymid = mid && mid.offsetParent === plane ? mid.offsetTop + mid.offsetHeight / 2 : h * 0.42;
  return { W, H, Hm, lxc: tx, ymid, w, h, S: h / 95 };
}

// ── Flammen von oben (Sprites aus Buchstaben) ──────────────────────────────────────────────────────────────────────
const PP_BF_FLAMMENFARBE = { r: '#ee6428', o: '#ff9b3a', y: '#ffd61a', w: '#fff196' };
const PP_BF_FLAMMEN = [
  ['..r....', '.roor..', 'royyor.', '.oywyo.', 'royyor.', '.roor..', '...r...'], ['....r..', '..roor.', '.royyor', '.oywyo.', '.royyor', '..roor.', '..r....'],
  ['...r...', '.roor..', '.royor.', 'roywyor', '.royor.', '.roor..', '..r.r..'], ['..r.r..', '.rooor.', 'royyyor', '.oywyo.', 'royyor.', '.roor..', '.......'],
];
const PP_BF_FLAMMEN_K = [
  ['..r..', '.oyo.', 'royor', '.oyo.', '..r..'], ['.r...', '.oyo.', 'roywr', '.oyo.', '...r.'], ['..r..', 'royo.', '.oyor', '.oyo.', '.r.r.'], ['...r.', '.oyo.', 'royor', '.oyo.', '..r..'],
];
let ppBfSprites = null;
function ppBfSpriteLeinwand(rows) {
  const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[0].length; i++) { const col = PP_BF_FLAMMENFARBE[rows[j][i]]; if (col) { g.fillStyle = col; g.fillRect(i, j, 1, 1); } }
  return c;
}

function ppFx55Start(root, id, opt) {
  const clip = root.parentElement, plane = clip && clip.querySelector(':scope > .board-plane'), board = clip && clip.parentElement;
  if (!clip || !plane) return () => {};
  const phone = !!(window.ppIsPhone && window.ppIsPhone());
  let ruhig = false;
  try { ruhig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* bewegt */ }
  const STEP = phone ? 200 : 100;
  const mk = (z) => { const c = document.createElement('canvas'); c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges;z-index:' + z; return c; };
  const cvF = mk(0), cvP1 = mk(1), cvP2 = mk(1), cvA = mk(2);
  root.appendChild(cvF); root.appendChild(cvP1); root.appendChild(cvP2); root.appendChild(cvA);
  cvP1.style.visibility = cvP2.style.visibility = 'hidden';
  const gF = cvF.getContext('2d'), gA = cvA.getContext('2d');
  if (!ppBfSprites) ppBfSprites = { gross: PP_BF_FLAMMEN.map(ppBfSpriteLeinwand), klein: PP_BF_FLAMMEN_K.map(ppBfSpriteLeinwand) };
  const raf = window.ppTaktRaf || window.requestAnimationFrame;
  const t0 = performance.now();
  let D = null, geo = null, key = '', gestoppt = false, sichtbar = false, rafId = 0, tmr = 0, letzt = -1, inst = [], Fk = PP_BF_F, S = 6, statisch = false;
  const bewegt = () => !(ruhig || opt.statisch || window.__ppBfAmbient === false || window._playAnimations === false || window.__ppFxAlt);

  function messen() {
    if (board && board.classList.contains('board-flat-measure')) return null;
    return ppBfMessen(root, clip, plane, board);
  }
  // ── Backen: Boden + Randstücke + Randabdunklung (+ Puls-Masken) in halber Bildschirmauflösung ──────────────────────
  function backen(g) {
    const tb = performance.now();
    const { W, H, Hm, lxc, ymid } = g;
    const M = ppBfInv3(Hm), F = Fk, Wc = Math.ceil(W / F), Hc = Math.ceil(H / F);
    const hatP = !!(D.hell && D.halb);
    cvF.width = Wc; cvF.height = Hc;
    if (hatP) { cvP1.width = Wc; cvP1.height = Hc; cvP2.width = Wc; cvP2.height = Hc; } else { cvP1.width = cvP2.width = 0; }
    cvA.width = Wc; cvA.height = Hc;
    const outF = gF.createImageData(Wc, Hc), FB = new Uint32Array(outF.data.buffer);
    let o1 = null, o2 = null, P1 = null, P2 = null;
    if (hatP) { o1 = cvP1.getContext('2d').createImageData(Wc, Hc); P1 = new Uint32Array(o1.data.buffer); o2 = cvP2.getContext('2d').createImageData(Wc, Hc); P2 = new Uint32Array(o2.data.buffer); }
    const tpx = D.kachel.px, epx = D.rand ? D.rand.px : null, invS = 1 / S, AX0 = 96 - lxc * invS, AY0 = 50 - ymid * invS;
    const TW = PP_BF_TW, TH = PP_BF_TH, EW = PP_BF_EW;
    const dimA = (D.meta.dim && D.meta.dim.rand) || 0.2;
    const rx2 = new Float32Array(Wc); for (let x = 0; x < Wc; x++) { const rx = ((x + 0.5) / Wc - 0.5) / 0.75; rx2[x] = rx * rx; }
    for (let cy = 0; cy < Hc; cy++) {
      const sy = (cy + 0.5) * F, ry = ((cy + 0.5) / Hc - 0.5) / 0.70, ry2 = ry * ry;
      const nx0 = M[1] * sy + M[2], ny0 = M[4] * sy + M[5], d0 = M[7] * sy + M[8];
      const lxL = nx0 / d0, lxR = (M[0] * W + nx0) / (M[6] * W + d0), row = cy * Wc;
      for (let cx = 0; cx < Wc; cx++) {
        const sx = (cx + 0.5) * F, inv = 1 / (M[6] * sx + d0);
        const lx = (M[0] * sx + nx0) * inv, ly = (M[3] * sx + ny0) * inv;
        const axf = AX0 + lx * invS, ayf = AY0 + ly * invS, ixr = Math.floor(axf), iyr = Math.floor(ayf);
        let col = 0;
        if (epx) {                                  // Randstück: Abstand vom sichtbaren Brettrand in Kunstpixeln
          const uL = (lx - lxL) * invS, uR = (lxR - lx) * invS;
          if (uL < EW || uR < EW) {
            const eu = Math.floor(uL < uR ? uL : uR), ev = ((iyr % TH) + TH) % TH;
            if (eu >= 0 && eu < EW) col = epx[ev * EW + eu];
            if (!(col >>> 24)) col = 0;
          }
        }
        let ix = ixr % TW; if (ix < 0) ix += TW; let iy = iyr % TH; if (iy < 0) iy += TH;
        const ti = iy * TW + ix;
        if (!col) col = tpx[ti];
        if (P1) { const v = D.hell.px[ti]; if (v >>> 24) P1[row + cx] = v; }
        if (P2) { const v = D.halb.px[ti]; if (v >>> 24) P2[row + cx] = v; }
        const t2 = rx2[cx] + ry2;
        if (t2 > 0.3025) { const a = dimA * Math.min(1, (Math.sqrt(t2) - 0.55) / 0.45); if (a > ppBfBayer(ixr, iyr)) col = PP_BF_DIM; }
        FB[row + cx] = col;
      }
    }
    gF.putImageData(outF, 0, 0);
    if (o1) cvP1.getContext('2d').putImageData(o1, 0, 0);
    if (o2) cvP2.getContext('2d').putImageData(o2, 0, 0);
    const ms = performance.now() - tb;
    if (Array.isArray(window.__ppBfBack)) window.__ppBfBack.push(ms);
    ambientAufbauen(g); letzt = -1; zeichnen(performance.now());
  }

  // ── Ambient: Bildschirmraum, aus Kunstpixel-/Randkoordinaten nachprojiziert ─────────────────────────────────────
  function randX(g, seite, ly) {                       // lokales x des sichtbaren Randes in Zeile ly
    const sy = ppBfProj(g.Hm, g.lxc, ly)[1], M = g.Minv || (g.Minv = ppBfInv3(g.Hm)), sx = seite === 'l' ? 0 : g.W, d = M[6] * sx + M[7] * sy + M[8];
    return (M[0] * sx + M[1] * sy + M[2]) / d;
  }
  const kunstZuBild = (g, ax, ay) => ppBfProj(g.Hm, g.lxc + (ax - 96) * S, g.ymid + (ay - 50) * S);
  const randZuBild = (g, seite, u, v) => { const ly = g.ymid + (v - 50) * S, lx0 = randX(g, seite, ly); return ppBfProj(g.Hm, seite === 'l' ? lx0 + u * S : lx0 - u * S, ly); };
  const pixelGroesse = (g, lx, ly) => { const a = ppBfProj(g.Hm, lx, ly), b = ppBfProj(g.Hm, lx + S, ly), c = ppBfProj(g.Hm, lx, ly + S); return [Math.abs(b[0] - a[0]), Math.abs(c[1] - a[1])]; };
  function ambientAufbauen(g) {
    inst = [];
    const wArt = (randX(g, 'r', g.ymid) - randX(g, 'l', g.ymid)) / S, scale = Math.max(0.6, wArt / 132);
    for (const a of D.meta.anim || []) {
      if (a.t === 'flameE') { for (const seite of ['l', 'r']) inst.push({ a, seite, seed: seite === 'l' ? 1 : 3 }); }
      else if (a.t === 'pulse') inst.push({ a });
      else if (phone) continue;
      else if (a.t === 'sparksE') { for (const seite of ['l', 'r']) for (let i = 0; i < a.n; i++) inst.push({ a, seite, ph: ppBfHash(seite === 'l' ? 1 : 2, i + 5), v: 0.7 + ppBfHash(i, 3) * 0.6 }); }
      else if (a.t === 'dust') { const n = Math.round(a.n * scale); for (let i = 0; i < n; i++) inst.push({ a, x0: ppBfHash(i, 3) * wArt, y0: a.y0 + ppBfHash(i, 4) * (a.y1 - a.y0), ph: ppBfHash(i, 7), v: 0.6 + ppBfHash(i, 8) * 0.8, col: a.cols[Math.floor(ppBfHash(i, 9) * a.cols.length)] }); }
      else if (a.t === 'glintAt') { const nk = Math.ceil(wArt / PP_BF_TW / 2) + 1; for (let k = -nk; k <= nk; k++) a.pts.forEach((p, i) => inst.push({ a, ax: p[0] + k * PP_BF_TW, ay: p[1], ph: ppBfHash(p[0] + k * 17, i), per: 2600 + ppBfHash(i, 13) * 3400 })); }
    }
    inst.wArt = wArt;
  }
  function zeichnen(t) {
    const g = geo; if (!g || !D) return false;
    const an = bewegt();
    const T = an ? Math.floor((t - t0) / STEP) * STEP : 0;
    if (T === letzt && an === !statisch) return false;
    letzt = T; statisch = !an;
    const F = Fk;
    for (const p of inst) if (p.a.t === 'pulse') {                 // Pulse: drei Zustände per visibility (kein Zeichnen); statisch: aus
      const ph = (T % p.a.period) / p.a.period, st = !an ? 0 : ph < 0.35 ? 0 : ph < 0.5 ? 1 : ph < 0.8 ? 2 : 1;
      cvP1.style.visibility = st === 2 ? 'visible' : 'hidden'; cvP2.style.visibility = st === 1 ? 'visible' : 'hidden';
    }
    gA.imageSmoothingEnabled = false;
    gA.clearRect(0, 0, cvA.width, cvA.height);
    const dyn = an ? inst : inst.filter((p) => p.a.t === 'flameE');   // statisch: nur die ruhenden Flammen (ein Bild)
    for (const p of dyn) {
      const a = p.a;
      if (a.t === 'flameE') {
        const s = Math.floor(T / 100), f = (s * 3 + p.seed + (((s * 5 + p.seed) % 4) === 0 ? 1 : 0)) & 3, sp = (a.small ? ppBfSprites.klein : ppBfSprites.gross)[f];
        const [X, Y] = randZuBild(g, p.seite, a.x, a.y), [pw, ph] = pixelGroesse(g, g.lxc, g.ymid + (a.y - 50) * S);
        const w = Math.max(1, Math.round(sp.width * pw / F)), h = Math.max(1, Math.round(sp.height * ph / F));
        gA.drawImage(sp, Math.round(X / F - w / 2), Math.round(Y / F - h / 2), w, h);
      } else if (a.t === 'sparksE') {
        const life = ((T / 1000) * 0.8 * p.v + p.ph) % 1;
        if (life < 0.85) {
          const ang = p.ph * 6.28, u = a.x + Math.cos(ang) * life * 7 + Math.sin(life * 6 + p.ph * 9) * 1.5, v = a.y - life * a.rise + Math.sin(ang) * life * 4;
          const [X, Y] = randZuBild(g, p.seite, u, v), [pw, ph] = pixelGroesse(g, g.lxc, g.ymid + (v - 50) * S);
          gA.fillStyle = life < 0.3 ? '#ffd61a' : life < 0.6 ? '#ff9b3a' : '#bd440f';
          gA.fillRect(Math.round(X / F), Math.round(Y / F), Math.max(1, Math.round(pw / F)), Math.max(1, Math.round(ph / F)));
        }
      } else if (a.t === 'dust') {
        const sp = a.speed * p.v, Wa = inst.wArt;
        const x = (((p.x0 + (T / 1000) * sp * 3 * a.dir) % Wa) + Wa) % Wa, y = a.y0 + ((p.y0 - a.y0 + (T / 1000) * sp * 1.1) % (a.y1 - a.y0));
        const wob = Math.floor(Math.sin((T / 1000) * 0.8 * p.v + p.ph * 6) * 1.5);
        const [X, Y] = kunstZuBild(g, 96 - Wa / 2 + Math.floor(x), Math.floor(y) + wob), [pw, ph] = pixelGroesse(g, g.lxc, g.ymid + (y - 50) * S);
        gA.fillStyle = p.col; gA.fillRect(Math.round(X / F), Math.round(Y / F), Math.max(1, Math.round(pw / F)), Math.max(1, Math.round(ph / F)));
      } else if (a.t === 'glintAt') {
        const l = ((T + p.ph * p.per) % p.per) / p.per;
        if (l < 0.1) {
          const [X, Y] = kunstZuBild(g, p.ax, p.ay), [pw, ph] = pixelGroesse(g, g.lxc, g.ymid + (p.ay - 50) * S);
          const w = Math.max(1, Math.round(pw / F)), h = Math.max(1, Math.round(ph / F)), x = Math.round(X / F), y = Math.round(Y / F);
          gA.fillStyle = a.cols[1];
          if (l > 0.03 && l < 0.08) { gA.fillRect(x - w, y, 3 * w, h); gA.fillRect(x, y - h, w, 3 * h); gA.fillStyle = a.cols[0]; gA.fillRect(x, y, w, h); } else gA.fillRect(x, y, w, h);
        }
      }
    }
    return true;
  }
  function aktualisieren() {
    if (gestoppt || !D) return;
    const g = messen(); if (!g) return;
    const k = [g.W, g.H, Fk, g.S.toFixed(2), g.lxc.toFixed(0), g.ymid.toFixed(0), ...g.Hm.slice(0, 8).map((v) => v.toFixed(4))].join('|');
    if (k === key) return;
    key = k; geo = g; S = g.S; backen(g);
  }
  const planen = (ms) => { if (tmr) return; tmr = setTimeout(() => { tmr = 0; aktualisieren(); }, ms); };
  function takt(t) {
    rafId = 0;
    if (gestoppt || !sichtbar) return;
    const zm = window.__ppBfZeit;
    if (Array.isArray(zm)) { const a = performance.now(); if (zeichnen(t)) zm.push(performance.now() - a); } else zeichnen(t);
    if (bewegt()) rafId = raf(takt);
  }
  const anwerfen = () => { if (!rafId && sichtbar && !gestoppt && bewegt()) rafId = raf(takt); };

  let ro = null, mo = null, io = null;
  try { ro = new ResizeObserver(() => planen(0)); ro.observe(root); ro.observe(plane); } catch (e) { /* ohne */ }
  try { if (board) { mo = new MutationObserver(() => planen(150)); mo.observe(board, { attributes: true, attributeFilter: ['class', 'style'] }); } } catch (e) { /* ohne */ }
  try { io = new IntersectionObserver((es) => { sichtbar = es[es.length - 1].isIntersecting; if (sichtbar) anwerfen(); }); io.observe(cvF); } catch (e) { sichtbar = true; }
  // Daten (meist schon vorgeladen) → im ersten Bild backen (nicht im Mount selbst)
  ppBfLaden(id).then((d) => {
    if (gestoppt || !d || !d.kachel) return;
    D = d; requestAnimationFrame(() => { if (!gestoppt) aktualisieren(); });
  });
  return () => {
    gestoppt = true; if (rafId) { try { (window.cancelAnimationFrame)(rafId); } catch (e) { /* weg */ } } clearTimeout(tmr);
    if (ro) ro.disconnect(); if (mo) mo.disconnect(); if (io) io.disconnect();
    cvF.remove(); cvP1.remove(); cvP2.remove(); cvA.remove();
  };
}

/** Deckt gerade eine Area-Szene (AreaBackgrounds: Schicht mit `isolation: isolate` direkt im Clip) das Feld? Maßgeblich ist, was AreaBackgrounds WIRKLICH zeigt (nur die Areas der beiden
 *  sichtbaren Seiten) — im Skill Test (5–8 Sitze) liegen Areas anderer Sitze in `areaZones`, ohne dass eine Szene erscheint; die Prop `verdeckt` des Aufrufers (jede Area irgendwo) wäre dort falsch. */
const ppFx55Abgedeckt = (clip) => !!(clip && clip.querySelector(':scope > div[style*="isolation: isolate"]'));
function PpFx55Feld({ roomId, tutorial }) {
  const ref = React.useRef(null);
  const [verdeckt, setVerdeckt] = React.useState(false);
  const id = React.useMemo(() => (window.PP_RETRO ? null : ppFx55Wahl(roomId, tutorial)), [roomId, tutorial]);
  React.useLayoutEffect(() => {
    const root = ref.current, clip = root && root.parentElement;
    if (!root || !clip) return undefined;
    const pruefen = () => setVerdeckt(ppFx55Abgedeckt(clip));
    pruefen();
    let mo = null;
    try { mo = new MutationObserver(pruefen); mo.observe(clip, { childList: true }); } catch (e) { /* ohne */ }
    return () => { if (mo) mo.disconnect(); };
  }, [id]);
  React.useEffect(() => {
    const root = ref.current;
    if (!id || verdeckt || !root) return undefined;
    const gb = root.closest('.game-board');
    if (gb) gb.setAttribute('data-bf', id);
    const stopp = ppFx55Start(root, id, {});
    return () => { stopp(); if (gb) gb.removeAttribute('data-bf'); };
  }, [id, verdeckt]);
  if (!id) return null;
  return <div ref={ref} className="pp-bf" aria-hidden="true" data-pp-px="aus" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0, background: '#08060c', display: verdeckt ? 'none' : undefined }} />;
}
window.ppFx55Wahl = ppFx55Wahl;
window.__ppBfMessen = ppBfMessen;        // Prüfhaken (Testskripte): Projektion der Plane
window.PpFx55Feld = React.memo(PpFx55Feld);
