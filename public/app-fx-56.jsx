// app-fx-56: Skill Test — Heimbasen (jeder Sitz hat seine eigene Boden-Hälfte), Pixelart, nur Optik
//
// ═════════════════════════════════════════════════════════════════
//  Das Skill-Test-Brett zeigt immer ZWEI Hälften auf einer geneigten Plane: unten die eigene, oben die des Fokus-Gegners (`oppIdx`). Jeder Sitz bekommt eine von 16 Heimbasen
//  (Burghof, Waldlichtung, Wüstenoase, Schneefeld, Vulkangestein, Sumpf, Bibliothek, Schmiede, Tempel, Hafenmole, Kristallhöhle, Zirkusmanege, Raumstation, Unterwasserruine,
//  Friedhof, Bauernhof). Die 6 Kampffelder (app-fx-55) bleiben den normalen Partien; im Skill Test steht hier statt eines Feldes die Basenfläche.
//
//  AUFBAU DER KACHELN (public/hb/<id>.png, 192×100 Kunstpixel, nahtlos in x, Zeile 50 = Mittellinie): obere Hälfte = Gegnerseite (Naht unten), untere = eigene Seite (Naht oben). Die Zeilen 43–56
//  (der Mittelweg) sind bei ALLEN Basen byteidentisch und zur Mittellinie spiegelsymmetrisch → jedes Paar passt an der Naht zusammen. Licht kommt in beiden Hälften von oben rechts
//  (die obere Hälfte ist neu schattiert, keine Spiegelung). `manifest.json`: Name und Ambient-Punkte je Hälfte (Glanzpunkte „twinkle“, treibende Teilchen „drift“).
//
//  ZUTEILUNG: `ppHbZuteilung(roomId, sitze)` = FNV-1a('hb|' + roomId) → mulberry32 → Fisher-Yates über die 16 Basen; Sitz i bekommt Platz i der Permutation. Deterministisch aus der roomId
//  (alle Clients, Zuschauer, Reload gleich, kein Server), jede Basis höchstens einmal je Raum (bis 16 Sitze), CPU-Sitze zählen mit. Test: `window.__ppHbForce = 'a,b,c,…'` (Basis-IDs je Sitz) oder 'aus'.
//
//  PERSPEKTIVE („Mode 7“, wie app-fx-55): Homographie lokal→Bildschirm aus der berechneten Plane-Transformation; jeder Leinwandpixel fragt per Rückprojektion GENAU EINEN Kachelpixel ab (Nearest-Neighbor,
//  keine Mischfarben). Gebacken wird nur bei Änderung der Projektion/Größe oder der Basen (Fokuswechsel), entprellt; im Takt wird nie Layout gelesen. Leinwand in halber Bildschirmauflösung.
//  Die Randabdunklung (Bayer in Kunstpixeln) ist mit eingebacken. Ambient: eine zweite Leinwand, 100-ms-Takt (Handy 200 ms, nur 4 Glanzpunkte, kein Drift), nur bei Bildwechsel, nur wenn sichtbar.
//  Aus bzw. statisch: `window.__ppBfAmbient === false`, prefers-reduced-motion, `_playAnimations === false`, `__ppFxAlt`; Retro: keine Basis.
//
//  AREAS: AreaBackgrounds (app-areas.jsx, Parameter `halbiert`) deckt im Skill Test nur die jeweilige Hälfte; die Schnittkanten liefert dieser Baustein als CSS-Variablen am Clip
//  (`--hb-naht-o` = untere Kante der oberen Hälfte, `--hb-naht-u` = obere Kante der unteren Hälfte, in px; je 7 Kunstpixel Mittelweg bleiben frei, damit die Naht sichtbar durchläuft).
//  ZONENRAHMEN: `.game-board[data-bf="hb"]` → die Regeln `.game-board[data-bf]` in style.css färben die Rahmen in Zonenfarben (wie bei den Feldern).
//  MINI-KACHELN: die Basis des Sitzes als Hintergrundbild (obere Kachelhälfte) hinter der Mini-Kachel.
//  VORBEREITUNG: `ppHbPrepMalen` malt die Basis des EIGENEN Sitzes als Boden der Heimbasis (statt des Holzbretts; Recycler, Fackeln, Banner bleiben).
//
//  Messung (nur Tests): `window.__ppHbBack` = Backzeiten (ms), `window.__ppHbZeit` = Zeichenzeit je Bildwechsel (ms).
// ═════════════════════════════════════════════════════════════════
const PP_HB_IDS = ['burghof', 'wald', 'wueste', 'schnee', 'vulkan', 'sumpf', 'bibliothek', 'schmiede', 'tempel', 'hafen', 'kristall', 'zirkus', 'station', 'unterwasser', 'friedhof', 'bauernhof'];
const PP_HB_TW = 192, PP_HB_TH = 100, PP_HB_MITTE = 50, PP_HB_NAHT = 7, PP_HB_F = 2;
const PP_HB_DIM = 0xFF0C0608;                                                   // #08060c als ABGR
const PP_HB_BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const ppHbBayer = (x, y) => (PP_HB_BAYER[y & 3][x & 3] + 0.5) / 16;
const ppHbHash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** Zuteilung: Sitz i → Basis-ID. Deterministisch aus roomId, keine Basis doppelt (bis 16 Sitze). */
function ppHbZuteilung(roomId, sitze) {
  let force = null;
  try { force = window.__ppHbForce || null; } catch (e) { /* ohne */ }
  if (force && force !== 'aus') { const l = String(force).split(','); if (l.every((x) => PP_HB_IDS.includes(x))) return Array.from({ length: sitze }, (_, i) => l[i % l.length]); }
  let h = 0x811c9dc5; const s = 'hb|' + String(roomId || '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  let a = h >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };   // mulberry32
  const p = PP_HB_IDS.slice();
  for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return Array.from({ length: sitze }, (_, i) => p[i % p.length]);
}
const ppHbAus = () => { try { return window.PP_RETRO || window.__ppHbForce === 'aus'; } catch (e) { return false; } };

// ── Laden: Manifest einmal, je Basis eine Kachel (Pixel als Uint32Array) ───────────────────────────────────────────
let ppHbManifestP = null; const ppHbBilder = {};
function ppHbManifest() {
  if (!ppHbManifestP) ppHbManifestP = fetch('/hb/manifest.json').then((r) => r.json()).then((l) => Object.fromEntries(l.map((m) => [m.id, m]))).catch(() => ({}));
  return ppHbManifestP;
}
function ppHbBild(id) {
  if (ppHbBilder[id]) return ppHbBilder[id];
  return (ppHbBilder[id] = new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
        res({ w: c.width, h: c.height, px: new Uint32Array(g.getImageData(0, 0, c.width, c.height).data.buffer), img: im });
      } catch (e) { res(null); }
    };
    im.onerror = () => res(null);
    im.src = '/hb/' + id + '.png';
  }));
}
/** Früh vorladen (Skill-Test-Raum startet): die Basen der vorhandenen Sitze (höchstens 8), nicht alle 16. */
let ppHbZuletzt = '';
window.ppHbVorladen = (roomId, sitze) => {
  if (ppHbAus() || !roomId) return; const k = roomId + '|' + sitze; if (k === ppHbZuletzt) return; ppHbZuletzt = k;
  ppHbManifest(); ppHbZuteilung(roomId, sitze).forEach((id) => ppHbBild(id));
};

// ── Projektion (Homographie lokal → Bildschirm) ───────────────────────────────────────────────────────────────────
function ppHbLoeseH(src, dst) {
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
function ppHbInv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
const ppHbProj = (Hm, x, y) => { const d = Hm[6] * x + Hm[7] * y + 1; return [(Hm[0] * x + Hm[1] * y + Hm[2]) / d, (Hm[3] * x + Hm[4] * y + Hm[5]) / d]; };
function ppHbMatrix(t) {
  if (!t || t === 'none') return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const v = t.slice(t.indexOf('(') + 1, t.lastIndexOf(')')).split(',').map(parseFloat);
  if (t.startsWith('matrix3d')) return v;
  return [v[0], v[1], 0, 0, v[2], v[3], 0, 0, 0, 0, 1, 0, v[4], v[5], 0, 1];
}
function ppHbMessen(root, clip, plane) {
  const W = root.clientWidth, H = root.clientHeight, w = plane.offsetWidth, h = plane.offsetHeight;
  if (!W || !H || !w || !h) return null;
  const cs = getComputedStyle(plane), cc = getComputedStyle(clip);
  const to = cs.transformOrigin.split(' ').map(parseFloat), tx = to[0] || 0, ty = to[1] || 0;
  const M = ppHbMatrix(cs.transform), P = parseFloat(cc.perspective), po = cc.perspectiveOrigin.split(' ').map(parseFloat);
  const pl = plane.offsetLeft, pt = plane.offsetTop;
  const proj = (x, y) => {
    const X = x - tx, Y = y - ty;
    const xp = M[0] * X + M[4] * Y + M[12], yp = M[1] * X + M[5] * Y + M[13], zp = M[2] * X + M[6] * Y + M[14], wp = M[3] * X + M[7] * Y + M[15] || 1;
    let X2 = xp / wp + tx + pl, Y2 = yp / wp + ty + pt;
    if (P > 0) { const s = P / (P - zp / wp); X2 = po[0] + (X2 - po[0]) * s; Y2 = po[1] + (Y2 - po[1]) * s; }
    return [X2, Y2];
  };
  const Hm = ppHbLoeseH([[0, 0], [w, 0], [0, h], [w, h]], [proj(0, 0), proj(w, 0), proj(0, h), proj(w, h)]);
  const mid = plane.querySelector(':scope > .board-mid-row');
  const ymid = mid && mid.offsetParent === plane ? mid.offsetTop + mid.offsetHeight / 2 : h * 0.42;
  return { W, H, Hm, lxc: tx, ymid, S: h / 95 };
}

function ppHbStart(root, opt) {
  const clip = root.parentElement, plane = clip && clip.querySelector(':scope > .board-plane'), board = clip && clip.parentElement;
  if (!clip || !plane) return null;
  const phone = !!(window.ppIsPhone && window.ppIsPhone());
  let ruhig = false;
  try { ruhig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* bewegt */ }
  const STEP = phone ? 200 : 100, F = PP_HB_F;
  const mk = (z) => { const c = document.createElement('canvas'); c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges;z-index:' + z; return c; };
  const cvF = mk(0), cvA = mk(2); root.appendChild(cvF); root.appendChild(cvA);
  const gF = cvF.getContext('2d'), gA = cvA.getContext('2d');
  const raf = window.ppTaktRaf || window.requestAnimationFrame;
  const t0 = performance.now();
  let me = opt.me, opp = opt.opp, MAN = {}, geo = null, key = '', gestoppt = false, sichtbar = false, rafId = 0, tmr = 0, letzt = -1, inst = [], Sg = 6;
  const bewegt = () => !(ruhig || window.__ppBfAmbient === false || window._playAnimations === false || window.__ppFxAlt);

  function backen(g, tm, to) {
    const tb = performance.now(); const { W, H, Hm, lxc, ymid } = g;
    const M = ppHbInv3(Hm), Wc = Math.ceil(W / F), Hc = Math.ceil(H / F);
    cvF.width = Wc; cvF.height = Hc; cvA.width = Wc; cvA.height = Hc;
    const out = gF.createImageData(Wc, Hc), FB = new Uint32Array(out.data.buffer);
    const invS = 1 / Sg, TW = PP_HB_TW, TH = PP_HB_TH, MI = PP_HB_MITTE;
    const rx2 = new Float32Array(Wc); for (let x = 0; x < Wc; x++) { const rx = ((x + 0.5) / Wc - 0.5) / 0.75; rx2[x] = rx * rx; }
    const pm = tm.px, po = to.px;
    for (let cy = 0; cy < Hc; cy++) {
      const sy = (cy + 0.5) * F, ry = ((cy + 0.5) / Hc - 0.5) / 0.70, ry2 = ry * ry;
      const nx0 = M[1] * sy + M[2], ny0 = M[4] * sy + M[5], d0 = M[7] * sy + M[8], row = cy * Wc;
      for (let cx = 0; cx < Wc; cx++) {
        const sx = (cx + 0.5) * F, inv = 1 / (M[6] * sx + d0);
        const lx = (M[0] * sx + nx0) * inv, ly = (M[3] * sx + ny0) * inv;
        const ax = Math.floor(96 + (lx - lxc) * invS), rr = (ly - ymid) * invS;
        const ix = ((ax % TW) + TW) % TW; let r = Math.floor(MI + rr); if (r < 0) r = 0; else if (r > TH - 1) r = TH - 1;
        let col = (rr >= 0 ? pm : po)[r * TW + ix];
        const t2 = rx2[cx] + ry2;
        if (t2 > 0.3025) { const a = 0.14 * Math.min(1, (Math.sqrt(t2) - 0.55) / 0.45); if (a > ppHbBayer(ax, r)) col = PP_HB_DIM; }
        FB[row + cx] = col;
      }
    }
    gF.putImageData(out, 0, 0);
    if (Array.isArray(window.__ppHbBack)) window.__ppHbBack.push(performance.now() - tb);
    // Schnittkanten für Area-Szenen (nur die jeweilige Hälfte), je 7 Kunstpixel Mittelweg bleiben frei
    const yo = ppHbProj(Hm, lxc, ymid - PP_HB_NAHT * Sg)[1], yu = ppHbProj(Hm, lxc, ymid + PP_HB_NAHT * Sg)[1];
    clip.style.setProperty('--hb-naht-o', yo.toFixed(1) + 'px'); clip.style.setProperty('--hb-naht-u', yu.toFixed(1) + 'px');
    ambientAufbauen(g); letzt = -1; zeichnen(performance.now());
  }
  // ── Ambient ──────────────────────────────────────────────────────────────────────────────────────────────────
  const zuBild = (g, seite, ax, ay) => ppHbProj(g.Hm, g.lxc + (ax - 96) * Sg, g.ymid + (seite === 'me' ? ay : -ay) * Sg);
  const pixGr = (g, seite, ay) => { const ly = g.ymid + (seite === 'me' ? ay : -ay) * Sg, a = ppHbProj(g.Hm, g.lxc, ly), b = ppHbProj(g.Hm, g.lxc + Sg, ly), c = ppHbProj(g.Hm, g.lxc, ly + Sg); return [Math.abs(b[0] - a[0]), Math.abs(c[1] - a[1])]; };
  function ambientAufbauen(g) {
    inst = [];
    const Mi = ppHbInv3(g.Hm), sy = ppHbProj(g.Hm, g.lxc, g.ymid)[1], dd = (sx) => Mi[6] * sx + Mi[7] * sy + Mi[8];
    g.axL = 96 + ((Mi[1] * sy + Mi[2]) / dd(0) - g.lxc) / Sg; g.axR = 96 + ((Mi[0] * g.W + Mi[1] * sy + Mi[2]) / dd(g.W) - g.lxc) / Sg;
    g.sz = { me: [], opp: [] }; for (const s of ['me', 'opp']) for (let ay = 0; ay < 50; ay += 5) g.sz[s].push(pixGr(g, s, ay));
    for (const [seite, bid] of [['me', me], ['opp', opp]]) {
      const m = MAN[bid]; if (!m || !m.light) continue;
      for (const a of m.light[seite] || []) {
        if (a.t === 'twinkle') a.pts.forEach((p, i) => {
          if (phone && i >= 4) return;
          for (let k = -2; k <= 2; k++) {
            const ax = p[0] + k * PP_HB_TW; if (ax < g.axL - 2 || ax > g.axR + 2) continue;
            const [X, Y] = zuBild(g, seite, ax, p[1]), [pw, ph] = g.sz[seite][Math.min(9, Math.round(p[1] / 5))];
            inst.push({ a, X, Y, pw, ph, ph0: ppHbHash(p[0], i), per: a.per + ppHbHash(i, 5) * 1500 });
          }
        });
        else if (a.t === 'drift' && !phone) for (let i = 0; i < a.n; i++) inst.push({ a, seite, x0: ppHbHash(i, 3) * PP_HB_TW, y0: a.y0 + ppHbHash(i, 4) * (a.y1 - a.y0), v: 0.6 + ppHbHash(i, 8) * 0.8, col: a.cols[i % a.cols.length] });
      }
    }
  }
  function zeichnen(t) {
    const g = geo; if (!g) return false;
    const an = bewegt(), T = an ? Math.floor((t - t0) / STEP) * STEP : 0;
    if (T === letzt && !(letzt === -1)) return false;
    letzt = T; gA.clearRect(0, 0, cvA.width, cvA.height);
    if (!an) return true;
    const span = g.axR - g.axL;
    for (const p of inst) {
      const a = p.a;
      if (a.t === 'twinkle') {
        const l = ((T + p.ph0 * p.per) % p.per) / p.per; if (l > 0.12) continue;
        gA.fillStyle = l > 0.04 && l < 0.09 ? a.cols[1] : a.cols[0];
        gA.fillRect(Math.round(p.X / F), Math.round(p.Y / F), Math.max(1, Math.round(p.pw / F)), Math.max(1, Math.round(p.ph / F)));
      } else {
        const sp = (T / 1000) * p.v, ax = g.axL + (((p.x0 + sp * a.vx * 3) % span) + span) % span, ln = a.y1 - a.y0;
        const ay = a.y0 + ((((p.y0 - a.y0) + sp * a.vy * 3) % ln) + ln) % ln;
        const [X, Y] = zuBild(g, p.seite, ax, ay), [pw, ph] = g.sz[p.seite][Math.min(9, Math.max(0, Math.round(ay / 5)))];
        gA.fillStyle = p.col; gA.fillRect(Math.round(X / F), Math.round(Y / F), Math.max(1, Math.round(pw / F)), Math.max(1, Math.round(ph / F)));
      }
    }
    return true;
  }
  async function aktualisieren(erzwingen) {
    if (gestoppt) return;
    const g = ppHbMessen(root, clip, plane); if (!g) return;
    const k = [g.W, g.H, F, g.S.toFixed(2), g.lxc.toFixed(0), g.ymid.toFixed(0), me, opp, ...g.Hm.slice(0, 8).map((v) => v.toFixed(4))].join('|');
    if (k === key && !erzwingen) return;
    const [tm, to] = await Promise.all([ppHbBild(me), ppHbBild(opp), ppHbManifest().then((m) => { MAN = m; })]);
    if (gestoppt || !tm || !to) return;
    key = k; geo = g; Sg = g.S; backen(g, tm, to);
  }
  const planen = (ms) => { if (tmr) return; tmr = setTimeout(() => { tmr = 0; aktualisieren(); }, ms); };
  function takt(t) {
    rafId = 0; if (gestoppt || !sichtbar) return;
    const zm = window.__ppHbZeit;
    if (Array.isArray(zm)) { const a = performance.now(); if (zeichnen(t)) zm.push(performance.now() - a); } else zeichnen(t);
    if (bewegt()) rafId = raf(takt);
  }
  const anwerfen = () => { if (!rafId && sichtbar && !gestoppt && bewegt()) rafId = raf(takt); };
  let ro = null, mo = null, io = null;
  try { ro = new ResizeObserver(() => planen(0)); ro.observe(root); ro.observe(plane); } catch (e) { /* ohne */ }
  try { if (board) { mo = new MutationObserver(() => planen(150)); mo.observe(board, { attributes: true, attributeFilter: ['class', 'style'] }); } } catch (e) { /* ohne */ }
  try { io = new IntersectionObserver((es) => { sichtbar = es[es.length - 1].isIntersecting; if (sichtbar) anwerfen(); }); io.observe(cvF); } catch (e) { sichtbar = true; }
  requestAnimationFrame(() => { if (!gestoppt) aktualisieren(); });
  return {
    setzen(m, o) { if (m === me && o === opp) return; me = m; opp = o; requestAnimationFrame(() => aktualisieren(true)); },
    stopp() {
      gestoppt = true; if (rafId) { try { window.cancelAnimationFrame(rafId); } catch (e) { /* weg */ } } clearTimeout(tmr);
      if (ro) ro.disconnect(); if (mo) mo.disconnect(); if (io) io.disconnect();
      cvF.remove(); cvA.remove(); clip.style.removeProperty('--hb-naht-o'); clip.style.removeProperty('--hb-naht-u');
    },
  };
}

/** Mini-Kacheln des Skill-Test-Bretts: die Basis des Sitzes (obere Kachelhälfte) als Hintergrund hinter der Mini-Kachel. */
function ppHbMinis(alloc) {
  for (const e of document.querySelectorAll('.st-mini[data-st-seat]')) {
    const s = +e.dataset.stSeat, m = e.querySelector('.st-mini-main'); if (!m || !alloc[s]) continue;
    m.style.backgroundImage = 'url(/hb/' + alloc[s] + '.png)'; m.style.backgroundSize = 'auto 200%'; m.style.backgroundPosition = '0 0'; m.style.imageRendering = 'pixelated';
  }
}

function PpFx56Basen({ roomId, sitze, myIdx, oppIdx }) {
  const ref = React.useRef(null), motor = React.useRef(null);
  const alloc = React.useMemo(() => ppHbZuteilung(roomId, sitze), [roomId, sitze]);
  const aus = ppHbAus();
  const me = alloc[myIdx] || alloc[0], opp = alloc[oppIdx] || alloc[1 % alloc.length];
  React.useEffect(() => {
    const root = ref.current; if (aus || !root) return undefined;
    const gb = root.closest('.game-board'); if (gb) gb.setAttribute('data-bf', 'hb');
    window.ppHbVorladen(roomId, sitze);
    motor.current = ppHbStart(root, { me, opp });
    return () => { if (motor.current) motor.current.stopp(); motor.current = null; if (gb) gb.removeAttribute('data-bf'); };
  }, [aus, roomId, sitze]);
  React.useEffect(() => { if (motor.current) motor.current.setzen(me, opp); ppHbMinis(alloc); }, [me, opp, alloc]);
  if (aus) return null;
  return <div ref={ref} className="pp-bf pp-hb" aria-hidden="true" data-pp-px="aus" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0, background: '#08060c' }} />;
}

/** Vorbereitungs-Screen: Basis des eigenen Sitzes als Boden der Heimbasis (Leinwand wie `StBoardBackdrop`: w × h Kunstpixel, per CSS hochskaliert). Gibt true zurück, wenn gemalt wurde. */
async function ppHbPrepMalen(cv, host, roomId, sitze, seat) {
  if (ppHbAus() || !cv || !host) return false;
  const bild = await ppHbBild(ppHbZuteilung(roomId, sitze)[Math.max(0, seat)] || PP_HB_IDS[0]); if (!bild) return false;
  const P = Math.max(2, Math.ceil(host.clientHeight / 50));                 // 50 Zeilen der eigenen Hälfte füllen die Höhe
  const w = Math.max(60, Math.ceil(host.clientWidth / P)), h = Math.max(40, Math.ceil(host.clientHeight / P));
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), out = g.createImageData(w, h), FB = new Uint32Array(out.data.buffer);
  const x0 = Math.floor((PP_HB_TW - (w % PP_HB_TW)) / 2) % PP_HB_TW;       // mittig anlegen
  for (let y = 0; y < h; y++) {
    const r = PP_HB_MITTE + Math.min(y, 49), row = y * w;
    for (let x = 0; x < w; x++) FB[row + x] = bild.px[r * PP_HB_TW + ((x + x0) % PP_HB_TW)];
  }
  g.putImageData(out, 0, 0);
  return true;
}
window.ppHbZuteilung = ppHbZuteilung;
window.ppHbPrepMalen = ppHbPrepMalen;
window.PpFx56Basen = React.memo(PpFx56Basen);
