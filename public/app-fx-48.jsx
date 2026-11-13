// app-fx-48: Fähigkeits-Stufenaufstieg im Trailer-Look — Pixelart
//
// ═════════════════════════════════════════════════════════════════
//  Wird eine Fähigkeitskarte auf eine schon liegende Kopie DERSELBEN Fähigkeit gelegt (Stapelhöhe der Fähigkeitszone 1 → 2 oder 2 → 3), erscheint der „Zug 1“ des Trailers
//  (shot01.js: „Zug 1: Einschlag der Stapelkarte“, „Kraftstrom von der Karte zu Alice“, „Alice nimmt die Kraft auf“, `drawPillar`, Stapelzahl-Plakette). Zeiten ab dem Einschlag (t = 0):
//     0 – 0,55   Einschlag: creme Ring (erste 0,12 s dick), Heldenfarbe, gedithert Gold (r 74) und gedithert Heldenfarbe (r 58), 24 Strahlen (0,18 s), Splitterkranz (170), Sterne, Funkenflug
//     0 – 0,33   harte Rahmenringe um die Karte (Creme/Heldenfarbe im 2-Bilder-Takt, Gold, …); die ersten zwei Bilder ein Creme-Blitz (Dither 70 % / 45 %) auf der Karte
//     0,10 –     Kraftstrom: 24 Kugeln (Abstand 22 ms, je 0,32 s) fliegen auf Bögen von der Karte zur Brust des Helden; Schweif (6 Bilder), Kopf 5×5 Heldenfarbe/Gold mit cremem Kern; kleine Funken beim Eintreffen
//     0,10 – 0,45  Lichtsäule über der Karte (14 × 56 Quellpixel, Bayer-Dither, kern creme, Rand Heldenfarbe; wächst in 3 Stufen, wird dann schmaler) — aufrecht, wie die Figur
//     0,10 –      Stapelzahl-Plakette (13 × 13: dunkle Fläche, heller Rand, Ziffer 5 × 7) springt groß auf (Faktor 1,7 / 1,35 / 1,1) und blinkt nach ~1,3 s aus
//     0,99 – 1,76  „Der Held nimmt die Kraft auf“: drei Ringe um die Füße (Gold, Heldenfarbe, Creme; 0,45 s, Abstand 0,16 s), Funkenausbruch (130), kräftigere Funken-Aura bis ~1,5 s
//  Heldenfarbe = die auffälligste Farbe der Figur (`ppFx37Farben`, einmal je Held gelesen), sonst die Kartentypfarbe; alles auf die Palette gerastet.
//  Technik: EINE Leinwand je Aufstieg in der Welt-Hülle (`ppFxWeltSchicht`, wie Feuerball/Aufstieg), Rasterzelle = ganze Bildschirmpixel (2–4, nach Zonenhöhe; im Trailer misst die Karte 35
//  Rasterpixel), 30 Bilder/s auf `ppTaktRaf`, Schmutzrechteck-Upload, Teilchen rein zeitabhängig. Kein Alpha, keine Verläufe. Derselbe Schlüssel löst den laufenden Aufstieg ab.
//  Aufruf: `ppFx48Stufe({ selector | el, key, stufe, name, heroName })` → true, wenn der Effekt läuft (der Aufrufer lässt dann den Standard-Einschlag weg), sonst false (nichts gezeichnet).
//  Der Aufruf kommt aus dem Belegungs-Vergleich in app-board.jsx (GameBoard), nicht beim Platzieren selbst — so greift er für eigene Züge, Gegner, Effekte und Zuschauer gleich.
// ═════════════════════════════════════════════════════════════════
const PP_FX48_BILD = 1000 / 30;
const PP_FX48_N = 24, PP_FX48_T0 = 0.10, PP_FX48_GAP = 0.022, PP_FX48_DAUER = 0.32;
const PP_FX48_PU = PP_FX48_T0 + (PP_FX48_N - 1) * PP_FX48_GAP + PP_FX48_DAUER + 0.06;     // „nimmt die Kraft auf“ (≈ 0,99 s)
const PP_FX48_ENDE = PP_FX48_PU + 1.45;
const PP_FX48_PLAKETTE_AUS = 1.45;
const PP_FX48_GLYPHE = { 2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], 3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'] };
const PP_FX48_BAYER8 = (() => {
  const b2 = [[0, 2], [3, 1]]; let m = b2;
  for (let n = 0; n < 2; n++) { const s = m.length, o = []; for (let y = 0; y < s * 2; y++) { o.push([]); for (let x = 0; x < s * 2; x++) o[y].push(4 * m[y % s][x % s] + b2[Math.floor(y / s)][Math.floor(x / s)]); } m = o; }
  return m;
})();
let PP_FX48_FARBEN = null;
const PP_FX48_LAUF = {};
const PP_FX48_LETZT = new Map();

function ppFx48Rgb(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
  if (!m) return [255, 251, 210];
  const r = parseInt(m[1].slice(0, 2), 16), g = parseInt(m[1].slice(2, 4), 16), b = parseInt(m[1].slice(4, 6), 16);
  return window.ppSnapRgb ? window.ppSnapRgb(r, g, b) : [r, g, b];
}
/** Feste Farben des Trailers (Creme, Tinte, Dunkel, Gold), einmal auf die Palette gerastet. */
function ppFx48Fest() {
  // ★ Ability-BLAU: Fähigkeiten tragen die Zonenfarbe Blau — statt Creme/Gold/Heldenfarbe: helles Blau (Ringe, Kern), mittleres Blau (Kugeln) und das Ability-Blau der Karte (alle Palette).
  return PP_FX48_FARBEN || (PP_FX48_FARBEN = { creme: ppFx48Rgb('#b4cff8'), tinte: ppFx48Rgb('#12101f'), dunkel: ppFx48Rgb('#08060c'), gold: ppFx48Rgb('#3866f0') });
}
/** Heldenfarben [Haupt, Zweit] als RGB; aus dem Cache von app-fx-37, sonst einmal aus dem Sheet der Figur; ohne Figur: Kartentypfarbe. */
function ppFx48Held(heroName, abilName) {
  const fest = ppFx48Fest();
  return [ppFx48Rgb('#4580f6'), ppFx48Rgb('#89abdc')];      // Ability-Blau (Haupt, Zweit) statt der Figurenfarbe; die Figurenfarbe unten bleibt als Rückfall-Code erhalten, wird aber nicht mehr erreicht
  try {
    const HA = window.HeroIdleAnims, slug = HA && HA.slug && heroName ? HA.slug(heroName) : null;
    if (slug && typeof PP_FX37_FARBEN !== 'undefined') {
      let f = PP_FX37_FARBEN.get(slug);
      if (!f && HA.schonDa && typeof ppFx37Farben === 'function') { const e = HA.schonDa(slug); if (e && e.meta && e.img) { f = ppFx37Farben(e); PP_FX37_FARBEN.set(slug, f); } }
      if (f && f.length) return [ppFx48Rgb(f[0]), ppFx48Rgb(f[1] || f[0])];
    }
  } catch (e) { /* Rückfall */ }
  try {
    const st = window.zoneLandStyle ? window.zoneLandStyle(abilName) : null;
    if (st && st.color) { const c = ppFx48Rgb(st.color); return [c, fest.creme]; }
  } catch (e) { /* Rückfall */ }
  return [fest.gold, fest.creme];
}

/**
 * Zeichner für einen Aufstieg. `g`: Geometrie in Rasterzellen der Leinwand (Karte, Held), `m`: Maler (ppFx30Maler), Farben `A`/`B` (Held), `stufe` (2|3), `salt`.
 * Gibt `malen(t)` zurück (t in Sekunden ab dem Einschlag, ganze Bilder).
 */
function ppFx48Zeichner(g, m, A, B, stufe, salt) {
  const F = ppFx48Fest(), cr = F.creme, go = F.gold, dunkel = F.dunkel;
  const rd = Math.round, H = ppFx30H, ease = ppFx30Ease, fl = ppFx30Fl;
  const { CX, CY, zx0, zy0, zx1, zy1, HX, HFY, rc, rch } = g;
  const th = (v, r) => Math.max(1, rd(v * r));
  const easeIO = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const kl = (v) => Math.max(0, Math.min(1, v));
  const HRY = rd(HFY - 10 / 4.8 * rch), HCY = HFY - 50 / 4.8 * rch;                  // Ring-Mitte (Füße) und Brust des Helden
  const zhh = (zy1 - zy0) / 2;
  const p = Math.max(1, rd(2 * rc));                                                  // Quellpixel der Lichtsäule in Zellen (Trailer: 2 Rasterpixel = 9,6 Weltpixel)
  const base = rd(CY + 0.83 * zhh);
  const ORB = [];
  for (let i = 0; i < PP_FX48_N; i++) {
    const h = (k) => H(i + (salt % 97) * 31, k), side = i % 2 ? -1 : 1;
    const x0 = CX + (h(1) - 0.5) * 60 / 4.8 * rc, y0 = CY - 40 / 4.8 * rc;
    const x1 = HX + (h(3) - 0.5) * 50 / 4.8 * rch, y1 = HCY + (h(4) - 0.5) * 50 / 4.8 * rch;
    ORB.push({ t0: PP_FX48_T0 + i * PP_FX48_GAP, x0, y0, x1, y1, cx: (x0 + x1) / 2 + side * (70 + h(2) * 110) / 4.8 * rc, cy: (y0 + y1) / 2, a: i % 3 ? A : go, x1e: x1, y1e: y1 });
  }
  const orbPos = (o, tt) => { const u = easeIO(kl((tt - o.t0) / PP_FX48_DAUER)); return [(1 - u) * (1 - u) * o.x0 + 2 * (1 - u) * u * o.cx + u * u * o.x1, (1 - u) * (1 - u) * o.y0 + 2 * (1 - u) * u * o.cy + u * u * o.y1]; };

  // ── Teilchen (einmal gewürfelt; Geschwindigkeiten in Zellen/s) ──
  const cols = [A, cr, go, A, B], T = [];
  const v = (w) => w / 4.8 * rc, vh = (w) => w / 4.8 * rch;
  let id = 0; const R = (k) => H(salt + 7, id * 13 + k);
  const einschlag = (x, y, n, spMin, spSpan, t0, vs, lifeMin, lifeSpan, big) => {
    for (let k = 0; k < n; k++, id++) {
      const an = R(1) * Math.PI * 2, sp = (spMin + R(2) * spSpan) * vs, sz = big ? (R(3) < 0.4 ? 2 : (R(4) < 0.15 ? 3 : 1)) : (R(3) < 0.4 ? 2 : 1);
      T.push({ t0, life: lifeMin + R(5) * lifeSpan, x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, ax: -Math.cos(an) * sp * 1.4, ay: -Math.sin(an) * sp * 1.4, kind: R(6) < 0.3 ? 1 : 0, sz, c: cols[Math.floor(R(7) * cols.length)] });
    }
  };
  einschlag(CX, CY, ppFxN(170), 180, 700, 0, v(1), 0.35, 0.45, true);                    // Splitterkranz der Karte
  for (let k = 0, n = ppFxN(14); k < n; k++, id++) T.push({ t0: R(1) * 0.2, life: 0.35, x: CX + (R(2) - 0.5) * 180 / 4.8 * rc, y: CY + (R(3) - 0.5) * 220 / 4.8 * rc, vx: 0, vy: -v(30), ax: 0, ay: 0, kind: 2, sz: 1, c: k % 2 ? cr : A });
  for (let k = 0, n = ppFxN(90); k < n; k++, id++) T.push({ t0: R(1) * 0.3, life: 0.6 + R(2) * 0.6, x: CX + (R(3) - 0.5) * 140 / 4.8 * rc, y: CY + (R(4) - 0.5) * 170 / 4.8 * rc, vx: v((R(5) - 0.5) * 50), vy: -v(100 + R(6) * 280), ax: 0, ay: 0, kind: 3, sz: 1, c: cols[Math.floor(R(7) * cols.length)] });
  for (const o of ORB) for (let k = 0, n = ppFxN(5); k < n; k++, id++) {                   // Eintreffen der Kugeln: kleine Funken
    const an = R(1) * Math.PI * 2, sp = vh(90 + R(2) * 160);
    T.push({ t0: o.t0 + PP_FX48_DAUER, life: 0.22, x: o.x1e, y: o.y1e, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, ax: 0, ay: 0, kind: k % 2 ? 1 : 0, sz: 1, c: cols[Math.floor(R(7) * cols.length)] });
  }
  for (let t2 = PP_FX48_T0 + 0.3; t2 < PP_FX48_PU + 0.5; t2 += (t2 < PP_FX48_PU ? 1 / 40 : 1 / 80), id++) {   // kräftigere Aura am Helden
    T.push({ t0: t2, life: 0.6 + R(1) * 0.6, x: HX + (R(2) - 0.5) * 130 / 4.8 * rch, y: HFY - R(3) * 40 / 4.8 * rch, vx: vh((R(4) - 0.5) * 40), vy: -vh(90 + R(5) * 220), ax: 0, ay: 0, kind: R(6) < 0.3 ? 2 : 3, sz: 1, c: cols[Math.floor(R(7) * cols.length)] });
  }
  { const n = ppFxN(130);
    for (let k = 0; k < n; k++, id++) {
      const an = R(1) * Math.PI * 2, sp = vh(160 + R(2) * 520), sz = R(3) < 0.4 ? 2 : 1;
      T.push({ t0: PP_FX48_PU, life: 0.3 + R(5) * 0.4, x: HX, y: HFY - 40 / 4.8 * rch, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, ax: -Math.cos(an) * sp * 1.4, ay: -Math.sin(an) * sp * 1.4, kind: R(6) < 0.3 ? 1 : 0, sz, c: cols[Math.floor(R(7) * cols.length)] });
    }
  }

  const rahmen = (x0, y0, x1, y1, c) => { m.rect(x0, y0, x1 - x0 + 1, 1, c); m.rect(x0, y1, x1 - x0 + 1, 1, c); m.rect(x0, y0, 1, y1 - y0 + 1, c); m.rect(x1, y0, 1, y1 - y0 + 1, c); };
  const band = Math.max(1, rd(4 / 4.8 * rc));

  return (t) => {
    const q = fl(t);
    // 1) Lichtsäule über der Karte (Quellpixel p × p Zellen), Bayer-Dither
    { const kk = Math.floor(q * 0.65);
      if (t >= 0 && kk <= 8) {
        const Hh = kk < 3 ? 56 * (kk + 1) / 3 : 56, Ww = kk <= 3 ? 14 : Math.max(2, 14 - (kk - 3) * 2);
        for (let y = 0; y < 56; y++) {
          const yb = 55 - y; if (yb >= Hh) continue;
          const dens = 1 - (yb / Hh) * 0.85, bz = PP_FX48_BAYER8[y & 7];
          for (let x = 0; x < 14; x++) {
            if (Math.abs(x - 6.5) > Ww / 2 || bz[x & 7] / 64 >= dens) continue;
            m.rect(CX - 7 * p + x * p, base - (56 - y) * p, p, p, Math.abs(x - 6.5) <= Ww * 0.25 ? cr : A);
          }
        }
      } }
    // 2) „Der Held nimmt die Kraft auf“ — drei Ringe um die Füße
    for (const [k, col] of [[0, go], [0.16, A], [0.32, cr]]) {
      const dt = t - PP_FX48_PU - k; if (dt < 0 || dt > 0.45) continue;
      m.ring(HX, HRY, rd(ease(dt / 0.45) * 46 * rch), th(2, rch), col, k > 0);
    }
    // 3) harte Rahmenringe um die Karte (10 Bilder) und Creme-Blitz
    if (q < 10) {
      const c0 = q % 2 ? cr : A, c2 = q % 2 ? A : cr, cs = [c0, go, c2];
      for (let i = 0; i < 3; i++) for (let j = 1; j <= band; j++) { const d = i * band + j; rahmen(zx0 - d, zy0 - d, zx1 + d - 1, zy1 + d - 1, cs[i]); }
      if (q < 2) { const lv = q === 0 ? 0.7 : 0.45; for (let y = zy0; y < zy1; y++) for (let x = zx0; x < zx1; x++) if (ppBayer(x, y) < lv) m.rect(x, y, 1, 1, cr); }
    }
    // 4) Einschlag: Ringe und Strahlen
    if (t < 0.55) {
      m.ring(CX, CY, rd(ease(t / 0.4) * 46 * rc), t < 0.12 ? th(3, rc) : th(1, rc), cr, false);
      if (t > 0.04) m.ring(CX, CY, rd(ease((t - 0.04) / 0.4) * 34 * rc), th(2, rc), A, false);
      if (t > 0.08) m.ring(CX, CY, rd(ease((t - 0.08) / 0.45) * 74 * rc), th(2, rc), go, true);
      if (t > 0.14) m.ring(CX, CY, rd(ease((t - 0.14) / 0.4) * 58 * rc), th(1, rc), A, true);
      if (t < 0.18) {
        const L = t < 0.09 ? ease(t / 0.09) : 1 - (t - 0.09) / 0.09;
        for (let r = 0; r < 24; r++) { const an = r * Math.PI / 12 + 0.07, len = L * (r % 2 ? 44 : 84) * rc; m.linie(CX, CY, rd(CX + Math.cos(an) * len), rd(CY + Math.sin(an) * len * 0.9), th(r % 2 ? 2 : 3, rc), r % 2 ? A : cr); }
      }
    }
    // 5) Kraftstrom: Kugeln auf Bögen von der Karte zum Helden
    for (let i = 0; i < ORB.length; i++) {
      const o = ORB[i]; if (t < o.t0 || t >= o.t0 + PP_FX48_DAUER) continue;
      for (let mm = 6; mm >= 1; mm--) { const tt = t - mm / 30; if (tt < o.t0) continue; const [x, y] = orbPos(o, tt); m.rect(rd(x), rd(y), mm < 3 ? 2 : 1, mm < 3 ? 2 : 1, mm % 2 ? cr : o.a); }
      const [x, y] = orbPos(o, t), X = rd(x), Y = rd(y);
      m.rect(X - 2, Y - 2, 5, 5, o.a); m.rect(X - 1, Y - 1, 3, 3, cr);
    }
    // 6) Teilchen (Ausklang: ab 72 % jedes zweite Bild aus)
    for (let i = 0; i < T.length; i++) {
      const s = T[i], dt = t - s.t0; if (dt < 0 || dt >= s.life) continue;
      if (dt > s.life * 0.72 && fl(dt) % 2) continue;
      const x = rd(s.x + s.vx * dt + 0.5 * s.ax * dt * dt), y = rd(s.y + s.vy * dt + 0.5 * s.ay * dt * dt);
      let kind = s.kind; if (kind === 3) kind = fl(dt) % 4 < 2 ? 1 : 0;           // Funke: Kreuz/Quadrat im Vierertakt
      if (kind === 0) m.rect(x, y, s.sz, s.sz, s.c);
      else if (kind === 2) { m.rect(x - 2, y, 5, 1, s.c); m.rect(x, y - 2, 1, 5, s.c); m.rect(x - 1, y - 1, 3, 3, s.c); }
      else { m.rect(x - 1, y, 3, 1, s.c); m.rect(x, y - 1, 1, 3, s.c); }
    }
    // 7) Stapelzahl-Plakette: springt groß auf, steht, blinkt aus
    if (q >= 3 && t < PP_FX48_PLAKETTE_AUS && !(t > PP_FX48_PLAKETTE_AUS - 0.25 && q % 2)) {
      const sc = q < 6 ? [1.7, 1.35, 1.1][q - 3] : 1;
      const px0 = CX - rd(6.5 * sc), pcy = CY + zhh - rd(5 / 4.8 * rc) - 6.5, py0 = rd(pcy - 6.5 * sc);          // Mitte der Plakette bleibt beim Aufspringen stehen
      const rect13 = (i0, j0, i1, j1, c) => { const x0 = px0 + Math.floor(i0 * sc), y0 = py0 + Math.floor(j0 * sc); m.rect(x0, y0, px0 + Math.floor(i1 * sc) - x0, py0 + Math.floor(j1 * sc) - y0, c); };
      rect13(0, 0, 13, 13, cr); rect13(1, 1, 12, 12, dunkel);
      const gl = PP_FX48_GLYPHE[stufe] || PP_FX48_GLYPHE[2];
      for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (gl[y][x] === '#') rect13(4 + x, 3 + y, 5 + x, 4 + y, cr);
    }
  };
}

/** Geometrie aus den Zonenelementen (Fensterkoordinaten + Feldversatz → Zellen einer Leinwand). null, wenn nicht zeichenbar. */
function ppFx48Geometrie(el, heroEl) {
  const r = el.getBoundingClientRect(), hr = heroEl.getBoundingClientRect();
  if (!r.width || !r.height || !hr.width || !hr.height) return null;
  const fo = window.ppFxScrollOffset ? window.ppFxScrollOffset() : { dx: 0, dy: 0 };
  const Hz = r.height, S = (typeof ppFxZelle === 'function') ? ppFxZelle(el) : Math.max(2, Math.min(4, Math.round(Hz / 35)));   // Rasterzelle = Hero-Pixel (ppFxZelle)
  const rc = Hz / (35 * S), rch = hr.height / (35 * S);
  const cardX = r.left + r.width / 2 + fo.dx, cardY = r.top + r.height / 2 + fo.dy, heroX = hr.left + hr.width / 2 + fo.dx, feetY = hr.top + hr.height / 2 + fo.dy;
  const p = Math.max(1, Math.round(2 * rc)), M = Math.max(40, Math.ceil(95 * Math.max(rc, rch))), up = Math.max(M, 56 * p + 4);
  const minX = Math.min(cardX, heroX) - M * S, maxX = Math.max(cardX, heroX) + M * S;
  const minY = Math.min(cardY, feetY) - up * S, maxY = Math.max(cardY, feetY) + M * S;
  const lx = Math.floor(minX / S) * S, ly = Math.floor(minY / S) * S;
  const gw = Math.min(1100, Math.ceil((maxX - lx) / S)), gh = Math.min(900, Math.ceil((maxY - ly) / S));
  const c = (x, y) => [Math.round((x - lx) / S), Math.round((y - ly) / S)];
  const [CX, CY] = c(cardX, cardY), [HX, HFY] = c(heroX, feetY);
  const [zx0, zy0] = c(r.left + fo.dx, r.top + fo.dy), [zx1, zy1] = c(r.right + fo.dx, r.bottom + fo.dy);
  return { S, lx, ly, gw, gh, g: { CX, CY, HX, HFY, zx0, zy0, zx1: Math.max(zx0 + 4, zx1), zy1: Math.max(zy0 + 4, zy1), rc, rch } };
}

function ppFx48Stufe(o) {
  try {
    if (!o || window._playAnimations === false || window.__ppFxAlt || typeof ppFx30Maler !== 'function') return false;
    const stufe = o.stufe | 0;
    if (stufe < 2 || stufe > 3) return false;
    const el = o.el || (o.selector ? document.querySelector(o.selector) : null);
    if (!el || !el.isConnected) return false;
    const jetzt = performance.now();
    if (o.key) {
      const l = PP_FX48_LETZT.get(o.key);
      if (l != null && jetzt - l < 400) return true;                                   // schon gestartet (Doppelauslösung): der Standard-Einschlag bleibt trotzdem weg
      PP_FX48_LETZT.set(o.key, jetzt);
    }
    const ow = el.getAttribute('data-ability-owner'), hi = el.getAttribute('data-ability-hero');
    const heroEl = o.heroEl || document.querySelector(`[data-hero-zone][data-hero-owner="${ow}"][data-hero-idx="${hi}"]`);
    if (!heroEl) return false;
    if (window.ppBattleCamFocus) window.ppBattleCamFocus(el);
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return false;
    const geo = ppFx48Geometrie(el, heroEl);
    if (!geo || geo.gw < 12 || geo.gh < 12) return false;
    const [A, B] = ppFx48Held(o.heroName, o.name);
    const salt = Math.floor(Math.random() * 1e6);
    return ppFx48Spielen(geo, A, B, stufe, salt, o.key, o.verzug > 0 ? o.verzug : (document.querySelector('.hand-to-board-fly') ? 0.5 : 0));
  } catch (e) { try { console.warn('ppFx48Stufe', e); } catch (er) { /* weg */ } return false; }
}

function ppFx48Spielen(geo, A, B, stufe, salt, key, verzug) {
  const { S, lx, ly, gw, gh } = geo, welt = !!window.ppFxWeltSchicht;
  if (key && PP_FX48_LAUF[key]) { try { PP_FX48_LAUF[key](); } catch (e) { /* weg */ } }
  const wurzel = document.createElement('div');
  wurzel.setAttribute('aria-hidden', 'true');
  wurzel.setAttribute('data-pp-px', 'aus');
  wurzel.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;pointer-events:none;z-index:10130;`;
  const cv = document.createElement('canvas');
  cv.width = gw; cv.height = gh;
  cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
  wurzel.appendChild(cv);
  const ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), m = ppFx30Maler(img.data, gw, gh);
  const malen = ppFx48Zeichner(geo.g, m, A, B, stufe, salt);
  (welt ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel);
  const takt = window.ppTaktRaf || window.requestAnimationFrame;
  const t0 = performance.now() + verzug * 1000;
  let raf = 0, letzte = -1, fertig = false, vor = null;
  const ende = () => { if (fertig) return; fertig = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } wurzel.remove(); if (key && PP_FX48_LAUF[key] === ende) delete PP_FX48_LAUF[key]; };
  if (key) PP_FX48_LAUF[key] = ende;
  const schritt = (jetzt) => {
    if (fertig) return;
    if (typeof jetzt !== 'number') jetzt = performance.now();
    const ms = jetzt - t0;
    if (ms / 1000 >= PP_FX48_ENDE) { ende(); return; }
    const fr = Math.floor(jetzt / PP_FX48_BILD);
    if (fr !== letzte && ms >= 0) {
      letzte = fr;
      const d = m.d, buf = img.data;
      if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); }
      d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
      const zm = window.__ppFx48Zeit, a0 = zm ? performance.now() : 0;
      malen(Math.floor(Math.max(0, ms) / PP_FX48_BILD + 1e-6) / 30);
      const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
      if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
      vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
      if (zm) zm.push(performance.now() - a0);
    }
    raf = takt(schritt);
  };
  raf = takt(schritt);
  setTimeout(ende, (PP_FX48_ENDE + verzug) * 1000 + 1500);                           // Notnagel (Tab im Hintergrund: rAF ruht)
  return true;
}
window.ppFx48Stufe = ppFx48Stufe;

// Aufwärmen im Leerlauf: ein trockener Lauf auf einer Wegwerf-Leinwand, damit der erste echte Aufstieg nicht im JIT-kalten Code startet
(function ppFx48Aufwaermen() {
  const los = () => {
    try {
      if (typeof ppFx30Maler !== 'function') return;
      const gw = 260, gh = 220, buf = new Uint8ClampedArray(gw * gh * 4), m = ppFx30Maler(buf, gw, gh);
      const malen = ppFx48Zeichner({ CX: 70, CY: 150, HX: 190, HFY: 150, zx0: 60, zy0: 135, zx1: 80, zy1: 165, rc: 0.9, rch: 0.9 }, m, ppFx48Fest().gold, ppFx48Fest().creme, 2, 5);
      const ric = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      const schritte = [0.01, 0.05, 0.12, 0.2, 0.4, 0.7, 1.0, 1.1, 1.5, 2.0];
      const weiter = () => { const t = schritte.shift(); if (t == null) return; try { buf.fill(0); m.d.x0 = gw; m.d.y0 = gh; m.d.x1 = 0; m.d.y1 = 0; malen(t); } catch (e) { /* weg */ } ric(weiter, { timeout: 2500 }); };
      ric(weiter, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 4000 }) : los()), 3000);
})();
