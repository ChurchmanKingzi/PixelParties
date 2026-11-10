// app-fx-61: Blow of the Venom Snake — „Giftstoß“: zwei Finger-Zähne stechen ins Ziel, ein kleiner Schlangenkopf schnappt zu, Gift-Adern kriechen über das Ziel (Pixelart-Leinwand, Zelle = Hero-Pixel)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: abgesegneter Prototyp „Blow of the Venom Snake v2“ (Zeichenroutinen `PpFx61`, auf den Rasterpinseln von `PpFx57` aufgebaut: Hash / Bayer / Palette). Alles ist eine reine Funktion des
//  Bildes f (30 Hz, 37 Bilder ≈ 1,23 s, Bild 36 leer), gezeichnet in Rasterzellen auf EINER Leinwand um das Ziel: feste Palettenfarben (`ppSnapRgb`), Bayer-Dither statt Alpha, nichts gedreht/weich skaliert.
//  DER DASH gehört NICHT hierher: der Angreifer rast mit der vorhandenen Ramm-Figur (`play_ram_animation`, `durch: false`, `trailType: 'poison'` → giftgrüne Nachbilder nur auf dem Hinweg, app-fx-27.jsx)
//  BIS ZUM Ziel; Bild 0 dieser Leinwand ist der KONTAKT. Die Engine schickt `play_zone_animation { type: 'venom_strike' }` unmittelbar nach dem Ramm-Ereignis (Mount-Vorlauf ≈ Weg bis zum Kontakt).
//  ABLAUF (Bild nach Kontakt, 30/s):
//    0–2    STICH      zwei Finger-Zähne (3 Zellen breit, ~10 lang, Abstand 4) stoßen aus Richtung des Angreifers ins Ziel (f 0: 9 Zellen davor, f 1: halb, f 2: drin), f 2 Weiß-Blitz an den Spitzen
//    2      QUETSCHEN  Held 0,80/1,14 (Sprite zellenweise auf der Leinwand), Karte Weißfüllung (f 2–3, Kartenviereck), Shake ≤ 1 Zelle (f 2–4, nicht am Handy)
//    2–10   SCHLANGENKOPF  kleiner Dither-Umriss um die Zähne (14–18 Zellen, Maul auf, gelbes Auge, rote Zunge züngelt f 3–4), f 5 SCHNAPPT ZU (= SCHADEN, Engine `_delay`), f 6–10 Bayer-Auflösung in grüne Pixel
//    2–34   INJEKTION  zwei dunkle Einstiche (roter → grüner Rand), von dort kriechen Gift-Adern in 3 Schüben (f 5–22) NUR über Zielpixel (Held-Silhouette bzw. Kartenviereck, gelber Kopf), grüne Dither-Tönung wandert mit,
//                      Tropfen perlen, Bläschen steigen; Adern pulsieren 2× (f 15, 22) und verblassen per Bayer (f 24–34)
//  Stufen 1–3 = 1./2./3. Angriff der Runde = 1/2/3 Poison-Stacks (`stacks` im Ereignis): mehr/verzweigtere Adern, mehr Tropfen, größerer Kopf (1,0 / 1,15 / 1,35), ab 3 doppelte Aderzüge + Schimmer.
//  BRETTABBILDUNG: Homografie Brettebene → Fenster aus den Mitten aller Zonen (`ppFx60Homografie`, app-fx-60 — exakt für die geneigte Perspektive und das flache Handy-Brett); Einheit u des Prototyps: ein Sprite-Pixel = 4,84 u.
//  Tiefenmaske: stehende Helden (außer dem Ziel) mit Tiefe 1000 − y, nur Tropfen und Schatten-Teilchen liegen dahinter. Ziel (Zielmaske für die Adern): Held = gequetschte Sprite-Zellen, Karte/Slot = Kartenviereck.
//  PIXELGRÖSSE: Rasterzelle S = Hero-Pixel der Zielreihe (`ppFxZelleGedeckelt`, Regel in app-fx-57). Handy: Teilchen 50 %, kein Shake.
//  Rückfall (Animationen aus, Retro, `__ppFxAlt`, reduzierte Bewegung, `window.__ppFx61Aus`, fehlende Quelle/Zone/Homografie): die alte Fassung `explosion` + `snake_impact` am Ziel.
//  Klang: `ZONE_ANIM_SFX.venom_strike` (app-shared.jsx, gestaffelt; `attack_ram` kommt vom Dash). Aufwärmen (Trockenlauf der Zeichenroutinen) im Leerlauf (`window.__ppFx61KeinAufwaermen` schaltet ab).
//  Messung (nur Tests): `window.__ppFx61Messen = true` → `window.__ppFx61Zeiten` = [Bild, ms] (Bild −1 = Geometrie, −2 = Maske), `window.__ppFx61T0` = Startzeit (Bild 0) in performance.now().
// ═════════════════════════════════════════════════════════════════
(function (root) {
  let H = null, BAY = null, snapA = null;      // aus PpFx57 (app-fx-57: Hash, Bayer-Matrix, Palette), in `FX.init` gesetzt
  const FX = {};
  const rd = Math.round, fl = Math.floor, ab = Math.abs, mn = Math.min, mx = Math.max, sqrt = Math.sqrt, PI = Math.PI, hyp = Math.hypot;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const LEN = 37, DAMAGE_F = 5, STAB_F = 2; FX.LEN = LEN; FX.DAMAGE_F = DAMAGE_F; FX.STAB_F = STAB_F;
  let C = null, BA = null, BB = null, IV = null, MOUTH = null, SPHL = null;

  // ── Rastermaler mit Tiefenmaske: Zellen unter einer NÄHEREN stehenden Figur bleiben frei (wie PpFx60.maler) ──
  function maler(buf, gw, gh, tq, ox, oy) {
    let Z = 0;
    const px = (x, y, c) => {
      x -= ox; y -= oy;
      if (x < 0 || y < 0 || x >= gw || y >= gh) return;
      const k = y * gw + x, t = tq[k]; if (t !== 0 && t < Z) return;
      const i = k * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
    };
    const pd = (x, y, c, lv) => { if (lv >= 16 || BAY[y & 3][x & 3] < lv) px(x, y, c); };
    const linie = (x0, y0, x1, y1, th, c, lv) => {
      x0 = rd(x0); y0 = rd(y0); x1 = rd(x1); y1 = rd(y1); const o = fl(th / 2); x0 -= o; y0 -= o; x1 -= o; y1 -= o;
      const dx = ab(x1 - x0), dy = -ab(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
      for (let n = 0; n < 700; n++) { for (let j = 0; j < th; j++) for (let i = 0; i < th; i++) pd(x0 + i, y0 + j, c, lv == null ? 16 : lv); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    };
    return { px, pd, linie, buf, tq, gw, gh, ox, oy, setZ: (z) => { Z = z; }, getZ: () => Z };
  }
  FX.maler = maler;

  FX.init = () => {
    if (C) return;
    const B = root.PpFx57; B.ensure(); H = B.H; BAY = B.BAY; snapA = B.snap; C = {}; const s = snapA;
    BA = ['#0f2412', '#167927', '#20ac37', '#3ddc57', '#75f091'].map(s);
    BB = ['#2f4e1d', '#5b9438', '#80bf59', '#b1ff1a', '#cbff66'].map(s);
    IV = ['#a89370', '#c5b7a0', '#ebdcc1', '#fffbd2'].map(s);
    MOUTH = ['#3a0000', '#7a1900', '#b62600'].map(s);
    C.out = s('#0a1a04'); C.eye = s('#fad54a'); C.pup = s('#141414'); C.tongue = s('#e73b41'); C.wound = s('#08060c'); C.red = s('#e73b41'); C.redD = s('#8c0014');
    C.g0 = s('#0f2412'); C.g1 = s('#167927'); C.g2 = s('#20ac37'); C.g3 = s('#3ddc57'); C.g4 = s('#75f091'); C.lime = s('#cbff66'); C.toxic = s('#b1ff1a'); C.yel = s('#ffe23d');
    C.white = [255, 255, 255]; C.cream = s('#fffbd2');
    SPHL = (() => { const v = [-0.5, -0.62, 0.6], n = hyp(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; })();
    FX.C = C;
  };

  // ═════════ Plan (Einheiten u: ein Sprite-Pixel = 4,84 u; Koordinaten der Brettebene) ═════════
  // o = { A: [x, y] Fußpunkt des Angreifers, huA (Höhe des Angreifers), T: [x, y] Fußpunkt (Held) bzw. Kartenmitte, tgt: { hu, kind: 'hero' | 'card', wb, hb }, stack 1..3, n (Teilchenfaktor), phone, seed }
  FX.plan = (o) => {
    const st = clamp((o.stack || 1) | 0, 1, 3) - 1, hero = o.tgt.kind === 'hero', hu = o.tgt.hu || 150;
    const P = { o, st, n: o.n == null ? 1 : o.n, phone: !!o.phone, seed: o.seed || 1, A: o.A, T: o.T, huA: o.huA || 120, kind: o.tgt.kind, hero, hu };
    const T = o.T, dx = T[0] - o.A[0], dy = T[1] - o.A[1], len = hyp(dx, dy) || 1, Fh = [dx / len, dy / len];
    // — Stichstelle, Wunden (lokale Koordinaten a, b auf dem Ziel), Adern —
    const sepV = ab(Fh[0]) > 0.6;                       // Angriff seitlich: Einstiche übereinander, sonst nebeneinander
    const sc = 4.84 * 2;                                // ± 2 Zellen Abstand (Zellen à 4,84 u)
    const cb = hero ? 0.58 * hu : 0, ca = 0;
    P.wounds = [[ca - (sepV ? 0 : sc * 0.5), cb - (sepV ? sc * 0.5 : 0)], [ca + (sepV ? 0 : sc * 0.5), cb + (sepV ? sc * 0.5 : 0)]];
    P.local = (a, b) => (hero ? [T[0] + a, T[1] + 6, b] : [T[0] + a, T[1] + b, 3]);
    P.stab = P.local(0, cb);
    const wb = o.tgt.wb || 120, hb = o.tgt.hb || 168;
    P.lo = hero ? [-0.46 * hu, 0.04 * hu, 0.46 * hu, 1.0 * hu] : [-0.40 * wb, -0.42 * hb, 0.40 * wb, 0.42 * hb];   // [a0, b0, a1, b1]
    const hs = P.seed * 77, nMain = [2, 3, 3][st], steps = [11, 15, 19][st], pBr = [0.08, 0.14, 0.14][st], passes = st >= 2 ? 2 : 1, L = 9.2;
    const angs = [-100, 55, -25, 150, 100, -145];
    P.veins = []; let vid = 0;
    const grow = (w, a, b, th, n, s0v, depth, pass, tmul) => {
      const br = { pts: [[a, b]], q: [s0v], w, pass, depth }; let ta = th;
      for (let i = 1; i <= n; i++) {
        ta += (H(hs + vid, i) - 0.5) * 0.9;
        let na = a + Math.cos(ta) * L, nb = b + Math.sin(ta) * L;
        if (na < P.lo[0] || na > P.lo[2]) { ta = PI - ta; na = clamp(na, P.lo[0], P.lo[2]); }
        if (nb < P.lo[1] || nb > P.lo[3]) { ta = -ta; nb = clamp(nb, P.lo[1], P.lo[3]); }
        a = na; b = nb; br.pts.push([a, b]); br.q.push(s0v + (1 - s0v) * 0.92 * (i / n) * (tmul || 1));
        if (depth < 2 && i > 1 && i < n - 1 && H(hs + vid * 3, i + 40) < pBr) { vid++; grow(w, a, b, ta + (H(hs + vid, 9) < 0.5 ? -1 : 1) * (0.6 + H(hs + vid, 10) * 0.5), mx(3, rd(n * (0.45 + 0.25 * H(hs + vid, 11)))), br.q[br.q.length - 1], depth + 1, pass, 1); }
      }
      P.veins.push(br);
    };
    for (let pass = 0; pass < passes; pass++) for (let w = 0; w < 2; w++) for (let k = 0; k < nMain; k++) {
      vid++; const a0 = angs[(k + (w ? 2 : 0) + pass) % angs.length] * PI / 180 + (H(hs + vid, 3) - 0.5) * 0.5;
      grow(w, P.wounds[w][0], P.wounds[w][1], a0, steps - (pass ? 2 : 0), pass ? 0.12 : 0, 0, pass);
    }
    // — Tropfen (perlen aus den Stichen, fallen), Bläschen —
    const nd = [4, 7, 10][st]; P.drops = [];
    for (let i = 0; i < mx(3, rd(nd * (P.phone ? 0.6 : 1))); i++) P.drops.push({ w: i & 1, f0: 5 + 3 * i - (st >= 1 ? i : 0), g: 2.7, vx: (H(hs + i, 61) - 0.5) * 1.2, r: H(hs + i, 62) < 0.3 ? 2 : 1 });
    const nb = [3, 4, 6][st]; P.bub = [];
    for (let i = 0; i < mx(2, rd(nb * (P.phone ? 0.7 : 1))); i++) P.bub.push({ w: i & 1, f0: 8 + i * 3 + H(hs + i, 70) * 3, life: 10 + H(hs + i, 71) * 4, dx: (H(hs + i, 72) - 0.5) * 10, ph: H(hs + i, 73) * 6, size: 2 + (H(hs + i, 74) < 0.4 ? 1 : 0) });
    P.hs = [1, 1.15, 1.35][st];
    return P;
  };

  const SQ = [0.80, 0.80, 0.90, 1.14, 1.06, 0.98, 1.03, 1.0], DXJ = [0, 0, 0, 1, -1, 1, -1, 0];
  FX.pose = (f, P) => {
    const j = f - STAB_F; if (j < 0 || j > 33) return { active: false, flash: 0, sx: 1, sy: 1, dx: 0, hideSprite: false };
    const sy = j < 8 ? SQ[j] : 1;
    return { active: true, flash: j === 0 ? 1 : j === 1 ? 2 : 0, sx: 1 + 0.36 * (1 - sy), sy, dx: j < 8 ? DXJ[j] : 0, hideSprite: true };
  };
  const SHK = [[1, 0], [-1, 1], [0, -1]];
  FX.shake = (f, P) => { const j = f - STAB_F; return (j >= 0 && j < 3 && !P.phone) ? SHK[j] : [0, 0]; };

  const lvl = (t, X, Y) => { const v = fl(t + 0.5 + (BAY[Y & 3][X & 3] / 16 - 0.47) * 0.75); return v < 0 ? 0 : v > 4 ? 4 : v; };
  function dagger(m, bx, by, dx, dy, px_, py_, L, W, lv) {   // spitz zulaufender Dolch (Elfenbein → Hellgrün), Basis (bx,by), Richtung d, Quer p
    for (let t = 0; t <= L; t += 0.5) {
      const u = t / L, hw = (W / 2) * (1 - Math.pow(u, 1.5)) + 0.35;
      for (let s = -hw; s <= hw; s += 0.5) {
        const X = rd(bx + dx * t + px_ * s), Y = rd(by + dy * t + py_ * s), edge = ab(s) > hw - 0.6, lit = s * (-px_ * 0.5 - py_ * 0.6) > 0;
        let c;
        if (u < 0.5) c = edge ? IV[lit ? 2 : 1] : IV[lit ? 3 : 2];
        else if (u < 0.75) c = edge ? (lit ? C.lime : IV[2]) : (lit ? IV[3] : C.lime);
        else c = edge ? C.g3 : (u > 0.92 ? C.toxic : C.lime);
        m.pd(X, Y, c, lv);
      }
    }
  }
  function bubble(m, X, Y, size, pop) {
    if (pop) { for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) m.px(X + dx, Y + dy, C.g4); return; }
    if (size <= 2) { m.px(X, Y, C.g3); m.px(X + 1, Y, C.g2); m.px(X, Y + 1, C.g2); m.px(X + 1, Y + 1, C.g1); m.px(X, Y, C.lime); return; }
    for (const [dx, dy] of [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3]]) m.px(X + dx, Y + dy, C.g2); m.px(X + 1, Y + 1, C.lime); m.px(X + 2, Y + 2, C.g0);
  }
  const STAMP = []; for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) { const d = hyp(xx, yy); if (d <= 3.2) STAMP.push(xx, yy, d < 1.6 ? 6 : 3); }   // Tönung um einen Eckpunkt (Radius 3: Stufen 6 / 3)
  // Fortschritt der Adern: 3 Schübe (f 5–9, 12–16, 18–22)
  const surge = (f) => (f < 5 ? 0 : f < 9 ? 0.38 * sm((f - 5) / 4) : f < 12 ? 0.38 : f < 16 ? 0.38 + 0.34 * sm((f - 12) / 4) : f < 18 ? 0.72 : f < 22 ? 0.72 + 0.28 * sm((f - 18) / 4) : 1);

  // Schlangenkopf-Umriss (Draufsicht-Spaten, Maul auf, Giftzähne vorn); (a, b) lokal in Kopfzellen, HS = Größe
  function snakeHead(m, f, P, cx, cy, dx, dy, px_, py_, lvAppear) {
    const HS = P.hs, mo = f < 2 ? 0 : f === 2 ? 0.55 : f < 5 ? 1 : 0.08, snap5 = f >= 5 ? 1 : 0;
    const R = 8.5 * HS;
    const x0 = fl(cx - 13 * HS - 3), x1 = Math.ceil(cx + 13 * HS + 3), y0 = fl(cy - 13 * HS - 3), y1 = Math.ceil(cy + 13 * HS + 3);
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
      const ex = X + 0.5 - cx, ey = Y + 0.5 - cy, a = (ex * dx + ey * dy) / HS, b = (ex * px_ + ey * py_) / HS;
      if (a < -8 || a > 9) continue;
      const hw = a < -3 ? 8 * sqrt(mx(0, 1 - Math.pow((a + 3) / 5, 2))) : lerp(8, 3.4, Math.pow((a + 3) / 12, 0.9));
      if (ab(b) > hw) continue;
      if (lvAppear < 16 && BAY[Y & 3][X & 3] >= lvAppear) continue;
      const edge = ab(b) > hw - 0.9 || a < -7.3 + 0 || (a > 8.2);
      let col;
      // Maul: aufgesperrtes Rot am Vorderende zwischen den Zähnen
      const mA = 5.6, mrx = 1.0 + 3.4 * mo, mry = 3.7 * (0.55 + 0.45 * mo) * (1 - 0.3 * snap5);
      const mq = (Math.pow((a - mA) / mrx, 2) + Math.pow(b / mry, 2));
      if (mq < 1 && mo > 0.1) col = mq > 0.55 ? MOUTH[0] : (mq > 0.25 ? MOUTH[1] : MOUTH[2]);
      else if (mq < 1.35 && mo > 0.1) col = C.out;
      else if (edge) col = C.out;
      else {
        const nx = ex / R / HS, ny = ey / R / HS, r2 = nx * nx + ny * ny, nz = sqrt(mx(0.05, 1 - mn(1, r2 * 0.9))), l = nx * SPHL[0] + ny * SPHL[1] + nz * SPHL[2];
        let t = 2 + (l - 0.55) * 3.6; if (((fl(a / 2.2) + fl(b / 2.2)) & 1) && ab(b) > 1.5) t -= 0.9;
        col = (a < -4 && ((fl(a / 3) & 1) === 0)) ? BB[lvl(t, X, Y)] : BA[lvl(t, X, Y)];
      }
      // Augen (gelb, Schlitzpupille) und Nüstern
      for (const sg of [-1, 1]) {
        const eb = sg * hw * 0.0 + sg * 5.2, ea = -1.2, ex2 = a - ea, eb2 = b - eb;
        if (ex2 * ex2 + eb2 * eb2 < 3.0) col = (ab(ex2) < 0.45 && ab(eb2) < 1.4 * 0.0 + 1.3) ? C.pup : ((ex2 * -0.5 + eb2 * -0.5 * sg) > 0.3 ? C.lime : C.eye);
        if (ex2 * ex2 + eb2 * eb2 < 4.8 && ex2 * ex2 + eb2 * eb2 >= 3.0 && col !== C.out) col = C.out;
      }
      m.px(X, Y, col);
    }
    // Zunge (gespalten): flackert f 3–4 seitlich aus dem Maul
    if (f === 3 || f === 4) {
      const ln = (f === 3 ? 5.5 : 8) * HS, bx = cx + dx * 5.6 * HS, by = cy + dy * 5.6 * HS, ex = bx + px_ * ln * 0.55 + dx * ln * 0.35, ey = by + py_ * ln * 0.55 + dy * ln * 0.35;
      m.linie(bx, by, ex, ey, 1, C.tongue, lvAppear); m.linie(ex, ey, ex + dx * 2.2 + px_ * 1.6, ey + dy * 2.2 + py_ * 1.6, 1, C.tongue, lvAppear); m.linie(ex, ey, ex + dx * 2.2 - px_ * 0.6, ey + dy * 2.2 - py_ * 0.6, 1, C.tongue, lvAppear);
    }
  }

  FX.draw = (m, f, P, cam, hook) => {
    m.setZ(0);
    const proj = cam.proj;
    const T = P.T, A = P.A, hero = P.hero, st = P.st;
    // Bildschirmrichtung Angreifer → Ziel (Zellen) und Quer
    const sA = proj(A[0], A[1], P.huA), sT = proj(T[0], T[1], hero ? 0.58 * P.hu : 0);
    let ddx = sT[0] - sA[0], ddy = sT[1] - sA[1]; const dl = hyp(ddx, ddy) || 1; ddx /= dl; ddy /= dl; const ppx = -ddy, ppy = ddx;
    const S = proj(P.stab[0], P.stab[1], P.stab[2]), Sx = S[0], Sy = S[1];
    const loc = (a, b) => { const w = P.local(a, b); return proj(w[0], w[1], w[2]); };
    // — Tint-Feld (wandert mit den Adernköpfen) und sichtbare Ader-Eckpunkte —
    const sg = surge(f), fadeLv = f < 24 ? 16 : 16 * (1 - (f - 24) / 11);
    const gw = m.gw, gh = m.gh, ox = m.ox, oy = m.oy;
    if (!P._tint || P._tint.length !== gw * gh) P._tint = new Uint8Array(gw * gh); const tint = P._tint; tint.fill(0);
    const vis = [];
    if (f >= 5 && fadeLv > 0) for (const br of P.veins) {
      const n = br.pts.length; let last = -1;
      for (let i = 0; i < n; i++) { if (br.q[i] <= sg + 1e-6) last = i; else break; }
      if (last < 1) continue;
      if (!br._sc) br._sc = br.pts.map((q) => loc(q[0], q[1]));   // Kamera steht: Zellenlage der Eckpunkte einmal je Ader (nicht je Bild)
      const pc = br._sc;
      vis.push({ br, pc, last, growing: sg < 0.999 && last < n - 1 });
      // Tönung um jeden Eckpunkt (Radius 5 Zellen, Stufen 11 / 7 / 4)
      for (let i = 0; i <= last; i++) { const cx = rd(pc[i][0]) - ox, cy = rd(pc[i][1]) - oy; for (let e = 0; e < STAMP.length; e += 3) { const X = cx + STAMP[e], Y = cy + STAMP[e + 1]; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue; const kk = Y * gw + X, lv = STAMP[e + 2]; if (lv > tint[kk]) tint[kk] = lv; } }
    }
    if (fadeLv < 16) for (let i = 0; i < tint.length; i++) if (tint[i]) tint[i] = mn(tint[i], rd(tint[i] * fadeLv / 16));
    // — Ziel (gequetscht, getönt) —
    const pose = FX.pose(f, P);
    if (hook.pile && pose.active) { m.setZ(0); hook.pile(m, pose, tint); }
    const drawStab = () => {
    // — Stich: zwei Finger-Zähne (f 0–10) und Kopf —
    m.setZ(0);
    const Lg = rd(10 * P.hs), depth = f < 1 ? 9 : f < 2 ? 3 : -1.5;          // Abstand der Spitzen vor der Stichstelle (Zellen)
    const dagLv = f < 6 ? 16 : f < 9 ? [11, 6, 2][f - 6] : 0;
    if (f >= 0 && dagLv > 0) {
      const sep = 2.0;
      for (const sgn of [-1, 1]) { const tx = Sx + ppx * sgn * sep - ddx * depth, ty = Sy + ppy * sgn * sep - ddy * depth; dagger(m, tx - ddx * Lg, ty - ddy * Lg, ddx, ddy, ppx, ppy, Lg, 3, dagLv); }
      // Kopf um die Zähne
      if (f >= 2 && f <= 8) {
        const jerk = f === 5 ? 2.0 : 0, hl = f === 2 ? 9 : f <= 5 ? 16 : [11, 6, 2][f - 6];
        const cxh = Sx - ddx * (Lg + 7.5 * P.hs - jerk) + 0, cyh = Sy - ddy * (Lg + 7.5 * P.hs - jerk);
        snakeHead(m, f, P, cxh, cyh, ddx, ddy, ppx, ppy, hl);
        // Dissolve-Pixel (grüne Splitter)
        if (f >= 6) for (let i = 0; i < 14; i++) { const an = H(P.seed + i, 3) * 2 * PI, r = (f - 5) * (1.3 + H(P.seed + i, 4) * 1.5), px0 = cxh + Math.cos(an) * (3 + H(P.seed + i, 5) * 8) * P.hs, py0 = cyh + Math.sin(an) * (3 + H(P.seed + i, 5) * 8) * P.hs; m.pd(rd(px0 + Math.cos(an) * r), rd(py0 + Math.sin(an) * r - (f - 5) * 0.5), i % 3 ? C.g3 : C.lime, 16 - (f - 5) * 4.2); }
      }
      // Weiß-Blitz an den Spitzen
      if (f >= 2 && f <= 4) { const j = f - 2, R0 = [6, 5, 3][j] * Math.max(1, P.hs * 0.9), lv = [15, 8, 4][j], col = j === 0 ? C.white : (j === 1 ? C.cream : C.lime); for (let yy = -R0; yy <= R0; yy++) for (let xx = -R0; xx <= R0; xx++) { const d = hyp(xx, yy) / R0; if (d > 1) continue; m.pd(rd(Sx) + xx, rd(Sy) + yy, col, lv * (1 - d * 0.7)); } if (j === 0) { for (const sgn of [-1, 1]) { const tx = Sx + ppx * sgn * 2, ty = Sy + ppy * sgn * 2; m.linie(tx - 4, ty, tx + 4, ty, 1, C.white); m.linie(tx, ty - 4, tx, ty + 4, 1, C.white); } } }
    }
    };
    drawStab();
    // — Wunden: dunkle Löcher mit rotem, dann grünem Rand —
    if (f >= 2 && fadeLv > 0) {
      const rim = f < 12 ? C.red : (f < 16 ? C.redD : C.g2), rim2 = f < 12 ? C.redD : C.g1;
      for (let w = 0; w < 2; w++) { const c = loc(P.wounds[w][0], P.wounds[w][1]), X = rd(c[0]), Y = rd(c[1]); const lvw = fadeLv;
        for (const [dx, dy, col] of [[-1, -1, rim2], [0, -1, rim], [1, -1, rim2], [-1, 0, rim], [1, 0, rim], [-1, 1, rim2], [0, 1, rim], [1, 1, rim2]]) if (f >= 3 || (dx + dy) & 1) m.pd(X + dx, Y + dy, col, lvw);
        m.pd(X, Y, C.wound, lvw); }
    }
    // — Adern (nur auf Zielpixeln): 1-Zellen-Linien, Wellen beim Pulsieren (f 15, 22), gelber Kopf —
    const PF = [15, 22];
    for (let pass = 0; pass < 2; pass++) for (const v of vis) {
      const { br, pc, last, growing } = v, n = br.pts.length - 1;
      for (let i = 1; i <= last; i++) {
        const x0 = rd(pc[i - 1][0]), y0 = rd(pc[i - 1][1]), x1 = rd(pc[i][0]), y1 = rd(pc[i][1]), q = br.q[i];
        let col = br.depth ? C.g4 : C.g3, glow = false;
        for (const pf of PF) { const qw = (f - pf) / 4.5; if (qw > -0.1 && qw < 1.15 && ab(q - qw * 1.0) < 0.14) glow = true; }
        if (glow) col = C.lime; else if (f >= 12 && f < 16 && (i & 3) === 0) col = C.g4;
        // Bresenham
        let ax = x0, ay = y0; const dx = ab(x1 - ax), dy = -ab(y1 - ay), sx = ax < x1 ? 1 : -1, sy = ay < y1 ? 1 : -1; let err = dx + dy;
        for (let it = 0; it < 80; it++) {
          const X = ax - ox, Y = ay - oy;
          if (pass === 0) { if (X >= -1 && Y >= -1 && X < gw && Y < gh && hook.onTarget(ax + 1, ay + 1) && (fadeLv >= 16 || BAY[ay & 3][ax & 3] < fadeLv)) { m.setZ(0); m.px(ax + 1, ay + 1, C.g0); } }
          else if (X >= 0 && Y >= 0 && X < gw && Y < gh && hook.onTarget(ax, ay) && (fadeLv >= 16 || BAY[ay & 3][ax & 3] < fadeLv)) { m.setZ(0); m.px(ax, ay, col); }
          if (ax === x1 && ay === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; ax += sx; } if (e2 <= dx) { err += dx; ay += sy; }
        }
      }
      if (pass === 1 && growing && f < 23) { const hx = rd(pc[last][0]), hy = rd(pc[last][1]); if (hook.onTarget(hx, hy)) { m.setZ(0); m.px(hx, hy, C.yel); if (st >= 1 && hook.onTarget(hx + 1, hy)) m.px(hx + 1, hy, C.lime); } }
    }
    // Stufe 3: Schimmer auf dem Ziel (Bayer-Funken auf den Adern)
    if (st >= 2 && f >= 10 && f < 30) for (let i = 0; i < 10; i++) { const br = P.veins[(i * 7 + f) % P.veins.length], j = (i * 5 + f * 3) % br.pts.length; if (br.q[j] > sg) continue; const c = loc(br.pts[j][0], br.pts[j][1]), X = rd(c[0]) + ((f + i) & 1), Y = rd(c[1]); if (hook.onTarget(X, Y) && (f < 24 || BAY[Y & 3][X & 3] < fadeLv)) m.px(X, Y, C.white); }
    // — Tropfen: perlen aus den Stichen, fallen auf den Boden (Spritzer 1 Bild) —
    for (const d of P.drops) {
      const a = f - d.f0; if (a < 0 || a > 16) continue;
      const w0 = P.wounds[d.w], base = P.local(w0[0] + 1, w0[1] - 2); const fall = mx(0, a - 2);
      const hgt = hero ? mx(0, base[2] - 0.5 * d.g * fall * fall) : 0, x = base[0] + d.vx * fall, y = base[1];
      const c = proj(x, y + (hero ? 0 : 0), hero ? hgt : 3); m.setZ(1000 - y - 30);
      const X = rd(c[0]), Y = rd(c[1]);
      if (hero && hgt <= 0 && fall > 0) { const tl = a - sqrt(2 * base[2] / d.g) - 2; if (tl > 2) continue; m.setZ(1000 - y); if (tl < 1) { m.px(X - 1, Y, C.g3); m.px(X, Y, C.lime); m.px(X + 1, Y, C.g3); } else m.pd(X, Y, C.g2, 8); continue; }
      if (a < 2) { m.px(X, Y, C.lime); if (a >= 1 || d.r === 2) m.px(X, Y + 1, C.g3); } else if (d.r === 2) { m.px(X, Y, C.lime); m.px(X, Y + 1, C.g3); m.px(X + 1, Y + 1, C.g2); } else { m.px(X, Y, C.lime); m.px(X, Y - 1, C.g3); }
    }
    // — Bläschen —
    for (const b of P.bub) {
      const age = f - b.f0; if (age < 0 || age > b.life) continue;
      const w0 = P.wounds[b.w], c0 = loc(w0[0], w0[1]), X = rd(c0[0] + b.dx + Math.round(Math.sin(age * 0.8 + b.ph))), Y = rd(c0[1] - 2 - age * 1.2);
      if (f >= 24 && BAY[Y & 3][X & 3] >= fadeLv) continue;
      m.setZ(0); bubble(m, X, Y, b.size, age >= b.life - 0.5);
    }
  };
  /** Trockenlauf der Zeichenroutinen (Leerlauf): wärmt Code und Wertetabellen, damit der erste Biss nicht im kalten Code startet. */
  FX.trocken = () => {
    FX.init();
    const gw = 200, gh = 200, buf = new Uint8ClampedArray(gw * gh * 4), tq = new Float32Array(gw * gh), m = maler(buf, gw, gh, tq, 0, 0);
    const cam = { proj: (x, y, v) => [100 + x * 0.2, 120 + y * 0.2 - v * 0.2, 0.2] }, hook = { onTarget: () => true, pile: () => {} };
    for (const kind of ['hero', 'card']) for (const stack of [1, 3]) {
      const P = FX.plan({ A: [-220, 0], huA: 150, T: [0, 0], tgt: { hu: 150, kind, wb: 120, hb: 168 }, stack, n: 1, phone: false, seed: 3 + stack });
      for (let f = 0; f < LEN; f += 4) { buf.fill(0); FX.draw(m, f, P, cam, hook); }
    }
  };
  root.PpFx61 = FX;
})(window);

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  SPIEL-HÜLLE: Brettabbildung (Homografie aus den Zonen), Leinwand in der Weltschicht, Takt, Ziel auf der Leinwand (Held-Sprite zellenweise / Kartenviereck), Shake, Aufräumen, Rückfall
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX61_TAKT = 1000 / 30;

/** Rückfall auf die alte Fassung (`explosion` + `snake_impact`): Animationen aus, Retro, Test-Schalter, reduzierte Bewegung, keine Palette. */
function ppFx61Rueckfall() {
  try {
    if (window.__ppFx61Aus || window.__ppFxAlt || window._playAnimations === false || window.PP_RETRO || typeof window.ppSnapRgb !== 'function' || !window.PpFx57 || !window.PpFx61) return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { /* weiter */ }
  return false;
}

/** Geometrie nicht möglich: Grund merken (Tests: `window.__ppFx61Grund`), Rückfall auf die alte Fassung. */
function ppFx61Fehl(g) { window.__ppFx61Grund = g; return null; }

/**
 * Geometrie einmal beim Start (kein Layout im Takt): Homografie aus allen Zonen, Maß der Brett-Einheit u (ein Sprite-Pixel des Ziels = 4,84 u), Leinwandrechteck um das Ziel, Zelle = Hero-Pixel,
 * Fußpunkte von Ziel und Angreifer in Einheiten, Plan. Gibt null zurück, wenn etwas fehlt (dann läuft die alte Fassung).
 */
function ppFx61Geometrie(props) {
  try {
    const FX = window.PpFx61; FX.init();
    const { x, y, w, zoneEl, vonEl } = props;
    const plane = document.querySelector('.board-plane');
    if (!plane || !zoneEl || !zoneEl.isConnected || !vonEl || !vonEl.isConnected) return ppFx61Fehl(1);
    if (typeof ppFx60Homografie !== 'function' || typeof ppFx60Layout !== 'function' || typeof ppFx59Figur !== 'function') return ppFx61Fehl(2);
    const phone = !!(window.ppIsPhone && window.ppIsPhone());
    const zr = zoneEl.getBoundingClientRect(), zcx = zr.left + zr.width / 2, zcy = zr.top + zr.height / 2;
    const ox = x - zcx, oy = y - zcy;                                                                       // Versatz Fenster → Welt (Scrollstand)
    // Referenzpunkte: alle Zonen (Held, Fähigkeit, Support, beide Seiten)
    const refs = [];
    document.querySelectorAll('[data-hero-zone],[data-support-zone],[data-ability-zone]').forEach((e) => {
      const l = ppFx60Layout(e, plane), r = e.getBoundingClientRect();
      if (l && r.width > 0) refs.push([l.x, l.y, r.left + r.width / 2, r.top + r.height / 2]);
    });
    if (refs.length < 8) return ppFx61Fehl(3);
    const Hm = ppFx60Homografie(refs); if (!Hm || !(Hm.rms < 6)) return ppFx61Fehl(4);
    let Xc = 0, Ym = 0; for (const r of refs) { Xc += r[0]; Ym += r[1]; } Xc /= refs.length; Ym /= refs.length;
    // Ziel: Held mit Sprite (Fußlinie der Figur) oder Karte/Slot (Viereck)
    const tFig = ppFx59Figur(zoneEl), kind = tFig ? 'hero' : 'card';
    const hp = ppFxHeldPixel(zoneEl, w), hpx = hp.px > 0 ? hp.px : 2.8125;
    const zl = ppFx60Layout(zoneEl, plane); if (!zl) return ppFx61Fehl(5);
    const pa = Hm.f(zl.x, zl.y), pb = Hm.f(zl.x + 1, zl.y), pxPerL = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1;
    const R = 4.84 * pxPerL / hpx;                                                                          // Einheiten je Layout-Pixel: ein Sprite-Pixel = 4,84 u
    const toW = (sx, sy) => { const L = Hm.inv(sx, sy); return [(L[0] - Xc) * R, (L[1] - Ym) * R]; };       // Fensterpunkt (Bodenebene) → Einheiten
    // Leinwandrechteck (Fensterpixel): Ziel samt Figur plus Rand für Zähne/Kopf (≈ 41 Zellen zum Angreifer hin), Adern, Tropfen und Bläschen
    let l0 = zr.left, t0 = zr.top, r0 = zr.right, b0 = zr.bottom;
    if (tFig) { const cr = tFig.hp.cv.getBoundingClientRect(); l0 = Math.min(l0, cr.left); t0 = Math.min(t0, cr.top); r0 = Math.max(r0, cr.right); b0 = Math.max(b0, cr.bottom); }
    const S0 = ppFxZelleFuer({ zelleS: props.zelleS, zoneEl, w, x, y }), padZ = 56;
    const S = ppFxZelleGedeckelt({ zelleS: props.zelleS, zoneEl, w, x, y }, { breite: r0 - l0 + 2 * padZ * S0, hoehe: b0 - t0 + 2 * padZ * S0 });
    const pad = padZ * S;
    const lx = Math.round(l0 - pad + ox), ly = Math.round(t0 - pad + oy);
    const gw = Math.min(900, Math.ceil((r0 - l0 + 2 * pad) / S)), gh = Math.min(700, Math.ceil((b0 - t0 + 2 * pad) / S));
    const cell = (sx, sy) => [(sx + ox - lx) / S, (sy + oy - ly) / S];
    const proj = (px, py, v) => {                                                                           // Einheiten (x, y, Höhe v) → [Zelle x, Zelle y, Zellen je Einheit]
      const X = Xc + px / R, Y = Ym + py / R, a = Hm.f(X, Y), b = Hm.f(X + 1, Y), k = Math.hypot(b[0] - a[0], b[1] - a[1]) / R / S, c = cell(a[0], a[1]);
      return [c[0], c[1] - v * k, k];
    };
    let T, hu = 0, wb = 120, hb = 168, quad = null, karte = null;
    if (tFig) {
      const cr = tFig.hp.cv.getBoundingClientRect();
      T = toW(zcx, cr.top + tFig.y1 * tFig.hp.px); hu = (tFig.y1 - tFig.y0) * 4.84;
    } else {
      karte = zoneEl.querySelector('.board-card');
      const l = ppFx60Layout(karte || zoneEl, plane) || zl;
      T = [(l.x - Xc) * R, (l.y - Ym) * R]; wb = l.w * R; hb = l.h * R;
      const pt = (dx, dy) => { const p = Hm.f(l.x + dx, l.y + dy); return cell(p[0], p[1]); };
      quad = { tl: pt(-l.w / 2, -l.h / 2), tr: pt(l.w / 2, -l.h / 2), bl: pt(-l.w / 2, l.h / 2), br: pt(l.w / 2, l.h / 2) };
    }
    // Angreifer: Zonenmitte + Fußabstand (an einer ruhenden Figur gemessen: der Angreifer selbst fährt gerade, sein Sprite-Canvas ist gestreckt), Höhe aus dem Sheet
    const vr = vonEl.getBoundingClientRect(), vcx = vr.left + vr.width / 2, vcy = vr.top + vr.height / 2;
    let footDy = null;
    const fussVon = (e) => { const fg = ppFx59Figur(e); if (!fg) return null; const cr = fg.hp.cv.getBoundingClientRect(), r = e.getBoundingClientRect(); return (cr.top + fg.y1 * fg.hp.px) - (r.top + r.height / 2); };
    if (tFig) footDy = fussVon(zoneEl);
    if (footDy == null) document.querySelectorAll('[data-hero-zone]').forEach((e) => { if (footDy == null && e !== vonEl && e !== zoneEl) footDy = fussVon(e); });
    if (footDy == null) footDy = vr.height * 0.3;
    const A = toW(vcx, vcy + footDy);
    let huA = 120;
    try { const eA = vonEl._ppFigurPlatz && vonEl._ppFigurPlatz._ppEintrag, pxA = eA && ppFx57SheetPixel(eA); if (pxA) huA = (ppFx59SheetFuss(eA, pxA) - pxA.y0) * 4.84; } catch (e) { /* Standardhöhe */ }
    if (!tFig && !(hu > 0)) hu = 0;
    const nF = (window.ppFxN ? window.ppFxN(100) / 100 : 1) * (phone ? 0.5 : 1);
    const P = FX.plan({ A, huA, T, tgt: { hu, kind, wb, hb }, stack: props.stacks || 1, n: nF, phone, seed: Math.floor(Math.random() * 1e6) });
    return { S, P, FX, lx, ly, gw, gh, ox, oy, zr, tFig, karte, quad, kind, phone, Hm, cell, proj, toW, zcx, R };
  } catch (e) { try { console.warn('[VenomStrike]', e); } catch (e2) { /* weg */ } return ppFx61Fehl('Fehler ' + e.message); }
}

function PpFx61Leinwand({ geo, zoneEl }) {
  const cvs = useRef(null);
  const wurzelRef = useRef(null);
  useEffect(() => {
    const el = cvs.current, FX = geo.FX;
    if (!el) return undefined;
    const mess1 = window.__ppFx61Messen ? performance.now() : 0;
    const { S, P, gw, gh, tFig, karte, quad, phone, proj, cell, toW, Hm, ox, oy } = geo;
    const ctx = el.getContext('2d'), img = ctx.createImageData(gw, gh), buf = img.data, tq = new Float32Array(gw * gh), tmask = new Uint8Array(gw * gh);
    const m = FX.maler(buf, gw, gh, tq, 0, 0);
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const BAY = window.PpFx57.BAY, snapA = window.PpFx57.snap, C = FX.C;
    const ruhig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const shakeAn = !phone && !ruhig && !window.__ppFx61KeinShake;
    const board = shakeAn ? document.querySelector('.board-center') : null;
    const wurzel = wurzelRef.current;
    const platz = tFig ? tFig.hp.platz : null;
    // ── Figur im Raster (Nächster-Nachbar, eine Zelle je Sprite-Pixel-Anteil), um die Fußlinie gestaucht (wie app-fx-59/60) ──
    function figurZellen(fg, p, fn) {
      const s = fg.px, f0 = Math.max(0, Math.min(fg.fr, Math.max(1, (fg.eintrag.meta.frames | 0)) - 1));
      const sx0 = s.vert ? 0 : f0 * s.fw, sy0 = s.vert ? f0 * s.fh : 0, cps = fg.cps, oX = fg.oX, oY = fg.oY, Lc = fg.L, sy = p.sy, sx = p.sx, gxc = fg.gx;
      const wCells = s.fw * cps, hCells = s.fh * cps;
      const c0 = Math.max(0, Math.floor(gxc + (oX - gxc) * sx + p.dx)), c1 = Math.min(gw - 1, Math.ceil(gxc + (oX + wCells - gxc) * sx + p.dx));
      const r0 = Math.max(0, Math.floor(Lc - (Lc - oY) * sy)), r1 = Math.min(gh - 1, Math.ceil(Lc) - 1, Math.ceil(Lc - (Lc - (oY + hCells)) * sy));
      for (let Y = r0; Y <= r1; Y++) {
        if (Y + 0.5 > Lc) continue;
        const yo = Lc - (Lc - (Y + 0.5)) / sy, srow = Math.floor((yo - oY) / cps); if (srow < 0 || srow >= s.fh) continue;
        for (let X = c0; X <= c1; X++) {
          const xo = gxc + (X + 0.5 - gxc - p.dx) / sx, scol = Math.floor((xo - oX) / cps); if (scol < 0 || scol >= s.fw) continue;
          const i = ((sy0 + srow) * s.w + sx0 + scol) * 4; if (s.d[i + 3] < 128) continue;
          fn(X, Y, s.d[i], s.d[i + 1], s.d[i + 2]);
        }
      }
    }
    const beschreibe = (fg, e) => {
      const r = fg.hp.cv.getBoundingClientRect(), z = e.getBoundingClientRect(), c0 = cell(r.left, r.top), ft = cell(z.left + z.width / 2, r.top + fg.y1 * fg.hp.px);
      return { px: fg.px, eintrag: fg.hp.eintrag, fr: fg.hp.platz._ppFrame | 0, cps: fg.hp.px / S, oX: c0[0], oY: c0[1], L: ft[1], gx: ft[0] };
    };
    // Tiefenmaske der stehenden Helden (außer dem Ziel): Tiefe 1000 − y (Einheiten); nur Tropfen und Schatten-Teilchen mit Tiefe liegen dahinter
    try {
      document.querySelectorAll('[data-hero-zone]').forEach((z) => {
        if (z === zoneEl) return;
        const fg = ppFx59Figur(z); if (!fg) return;
        const cr = fg.hp.cv.getBoundingClientRect(), zr2 = z.getBoundingClientRect();
        if (cr.right + ox < geo.lx || cr.left + ox > geo.lx + gw * S || cr.bottom + oy < geo.ly || cr.top + oy > geo.ly + gh * S) return;
        const d = beschreibe(fg, z), qd = 1000 - toW(zr2.left + zr2.width / 2, cr.top + fg.y1 * fg.hp.px)[1];
        figurZellen(d, { sx: 1, sy: 1, dx: 0 }, (X, Y) => { const k = Y * gw + X, t = tq[k]; if (t === 0 || qd < t) tq[k] = qd; });
      });
    } catch (e) { /* ohne Maske: Tropfen liegen dann über Figuren (nur Optik) */ }
    const ziel = tFig ? beschreibe(tFig, zoneEl) : null;
    // Ziel-Held (Sprite zellenweise mit Blitz/Quetschung/Tönung) bzw. Karte (Viereck: Weißfüllung, Dither-Tönung)
    const greenMemo = new Map();
    const greenify = (c) => { const k = c[0] << 16 | c[1] << 8 | c[2]; let r = greenMemo.get(k); if (!r) { r = snapA('#' + [c[0] * 0.30, c[1] * 0.85 + 38, c[2] * 0.25].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')); greenMemo.set(k, r); } return r; };
    let tot = false;
    const pile = (mm, pose, tint) => {
      if (ziel) {
        if (tot || !platz) return;
        ziel.fr = platz._ppFrame | 0;
        figurZellen(ziel, pose, (X, Y, r, g, b) => {
          let col;
          if (pose.flash === 1) col = C.white; else if (pose.flash === 2 && BAY[Y & 3][X & 3] < 12) col = C.cream;
          else { col = [r, g, b]; const lv = tint[Y * gw + X]; if (lv && BAY[Y & 3][X & 3] < lv) col = greenify(col); }
          mm.px(X, Y, col); tmask[Y * gw + X] = 1;
        });
      } else if (quad) {
        const dx = pose.dx, yA = Math.floor(Math.min(quad.tl[1], quad.tr[1])), yB = Math.ceil(Math.max(quad.bl[1], quad.br[1])), y0 = Math.max(0, yA);
        for (let Y = y0; Y < Math.min(gh, yB); Y++) {
          const t = Math.max(0, Math.min(1, (Y + 0.5 - quad.tl[1]) / (quad.bl[1] - quad.tl[1]))), a = quad.tl[0] + (quad.bl[0] - quad.tl[0]) * t + dx, b = quad.tr[0] + (quad.br[0] - quad.tr[0]) * t + dx;
          for (let X = Math.max(0, Math.round(a)); X < Math.min(gw, Math.round(b)); X++) {
            tmask[Y * gw + X] = 1;
            if (pose.flash === 1) mm.px(X, Y, C.white);
            else if (pose.flash === 2) { if (BAY[Y & 3][X & 3] < 11) mm.px(X, Y, C.cream); }
            else { const lv = tint[Y * gw + X]; if (lv && BAY[Y & 3][X & 3] < lv * 0.8) mm.px(X, Y, ((X + Y) & 1) ? C.g1 : C.g0); }
          }
        }
      }
    };
    const hook = { onTarget: (X, Y) => X >= 0 && Y >= 0 && X < gw && Y < gh && tmask[Y * gw + X] === 1, pile };
    const cam = { proj };
    // DOM-Seite: Karte ruckeln (ganze Zellen), Held ausblenden solange er im Raster gemalt wird, Brett schütteln
    const alt = { vis: platz ? ppFxHalte(platz.style, 'visibility') : '', kTr: karte ? ppFxHalte(karte.style, 'transform') : '', tr: board ? ppFxHalte(board.style, 'translate') : '' };   // Ausgangswerte zählend merken: zwei gleichzeitige Animationen (app-fx-60 `ppFxHalte`)
    let kx = 1; if (karte) { const kr = karte.getBoundingClientRect(); if (kr.width > 0) kx = karte.offsetWidth / kr.width; }
    if (mess1) (window.__ppFx61Zeiten || (window.__ppFx61Zeiten = [])).push([-2, +(performance.now() - mess1).toFixed(3)]);
    const t0 = performance.now();
    if (window.__ppFx61Messen) window.__ppFx61T0 = t0;
    let raf = 0, letzte = -1, ende = false, key = '', figurWeg = false, platzAkt = platz;
    const zuruecksetzen = () => {
      try { if (platzAkt && ppFxLoese(platzAkt.style, 'visibility')) platzAkt.style.visibility = alt.vis; if (karte && ppFxLoese(karte.style, 'transform')) karte.style.transform = alt.kTr; if (board && ppFxLoese(board.style, 'translate')) board.style.translate = alt.tr; } catch (e) { /* weg */ }
    };
    const aufraeumen = () => { if (ende) return; ende = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } zuruecksetzen(); try { ctx.clearRect(0, 0, gw, gh); } catch (e) { /* weg */ } };
    const schritt = (jetzt) => {
      if (ende) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = Math.max(0, jetzt - t0);
      if (ms >= (FX.LEN + 1) * PP_FX61_TAKT) { aufraeumen(); return; }
      const fr = Math.floor(jetzt / PP_FX61_TAKT);
      if (fr !== letzte) {
        letzte = fr;
        const mess = window.__ppFx61Messen ? performance.now() : 0;
        const f = Math.min(FX.LEN - 1, Math.floor(ms / PP_FX61_TAKT + 1e-4));
        // Ziel-Held: neue Figur im Zonenplatz (Wiederbelebung/Neuaufbau) bzw. Tod (Zerfall läuft dann selbst) — ab da nicht mehr in die Leinwand malen
        if (tFig) { const cur = zoneEl._ppFigurPlatz; if (cur && cur !== platzAkt && cur.isConnected) { try { if (platzAkt) platzAkt.style.visibility = alt.vis; } catch (e) { /* weg */ } platzAkt = cur; key = ''; figurWeg = false; } if (platzAkt && (platzAkt._ppFx32Tot || !platzAkt.isConnected)) tot = true; }
        buf.fill(0); tmask.fill(0);
        const pose = FX.pose(f, P);
        FX.draw(m, f, P, cam, hook);
        ctx.putImageData(img, 0, 0);
        const sh = FX.shake(f, P), sxp = Math.round(sh[0] * S), syp = Math.round(sh[1] * S);
        const k2 = (pose.active && !tot ? 'a' : 'p') + '|' + pose.dx + '|' + sxp + '|' + syp;
        if (k2 !== key) {
          key = k2;
          if (platzAkt) { const weg = pose.active && !tot; if (weg !== figurWeg) { figurWeg = weg; platzAkt.style.visibility = weg ? 'hidden' : alt.vis; } }
          if (karte) karte.style.transform = pose.dx ? `translate(${(pose.dx * S * kx).toFixed(2)}px, 0px)` : alt.kTr;
          if (board) board.style.translate = (sxp || syp) ? `${sxp}px ${syp}px` : alt.tr;
          if (wurzel) wurzel.style.translate = (sxp || syp) && board ? `${sxp}px ${syp}px` : '';
        }
        if (mess) (window.__ppFx61Zeiten || (window.__ppFx61Zeiten = [])).push([f, +(performance.now() - mess).toFixed(3)]);
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    const netz = setTimeout(aufraeumen, (FX.LEN + 1) * PP_FX61_TAKT + 2500);                              // Notnagel (Tab im Hintergrund: rAF ruht)
    return () => { clearTimeout(netz); aufraeumen(); };
  }, []);
  return (
    <div ref={wurzelRef} aria-hidden="true" data-pp-px="aus" style={{ position: 'fixed', left: geo.lx, top: geo.ly, pointerEvents: 'none', zIndex: 10100 }}>
      <canvas ref={cvs} width={geo.gw} height={geo.gh} style={{ width: geo.gw * geo.S, height: geo.gh * geo.S, imageRendering: 'pixelated', display: 'block' }} />
    </div>
  );
}

/** Rückfall: die alte Fassung — Explosion + Schlange (`snake_impact`) am Ziel, wie vor dem Umbau. */
function PpFx61Alt(props) {
  const Ex = ANIM_REGISTRY.explosion, Sn = ANIM_REGISTRY.snake_impact;
  return (<>{Ex ? <Ex {...props} /> : null}{Sn ? <Sn {...props} /> : null}</>);
}

/** Registry-Komponente: neuer Giftstoß oder der alte als Rückfall. Ohne Ziel-Element (Vorwärmen) wird nichts gezeichnet. */
function PpFx61Effekt(props) {
  const geo = useMemo(() => {
    if (props.prewarm || !(props.zoneEl && props.zoneEl.isConnected)) { window.__ppFx61Grund = props.prewarm ? 'Vorwärmen' : 'kein Ziel-Element'; return null; }
    if (ppFx61Rueckfall()) { window.__ppFx61Grund = 'Rückfall (Animationen aus / Retro / reduzierte Bewegung / Schalter)'; return null; }
    if (!props.vonEl) { window.__ppFx61Grund = 'keine Quelle'; return null; }
    const mess = window.__ppFx61Messen ? performance.now() : 0;
    const g = ppFx61Geometrie(props);
    if (mess) (window.__ppFx61Zeiten || (window.__ppFx61Zeiten = [])).push([-1, +(performance.now() - mess).toFixed(3)]);
    return g;
  }, []);
  if (props.prewarm) return null;
  if (!geo) return <PpFx61Alt {...props} />;
  return <PpFx61Leinwand geo={geo} zoneEl={props.zoneEl} />;
}
if (typeof ANIM_REGISTRY !== 'undefined') ANIM_REGISTRY.venom_strike = PpFx61Effekt;

// Aufwärmen im Leerlauf: Trockenlauf der Zeichenroutinen (Hero und Karte, Stufe 1 und 3), damit der erste Giftstoß nicht im kalten Code startet.
(function ppFx61Aufwaermen() {
  const los = () => {
    try {
      if (ppFx61Rueckfall() || window.__ppFx61KeinAufwaermen) return;
      const ric = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      ric(() => { try { window.PpFx61.trocken(); } catch (e) { /* weg */ } }, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 6000 }) : los()), 6500);
})();
