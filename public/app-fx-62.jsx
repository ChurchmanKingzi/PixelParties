// app-fx-62: Strong Ox Headbutt — „Sprung-Kopfstoß“: der Anwender springt hoch, stürzt KOPF VORAN aufs Ziel, Ochsenkopf-Symbol, Ringe/Risse/Staub (Pixelart-Leinwand, Zelle = Hero-Pixel)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: abgesegneter Prototyp „Strong Ox Headbutt“ (Zeichenroutinen `PpFx62`, auf den Rasterpinseln von `PpFx57` aufgebaut: Hash / Bayer / Palette). Alles ist eine reine Funktion des Bildes f
//  (30 Hz, Bild 0 = KONTAKT, 40 Bilder nach dem Kontakt + 19 Bilder Anlauf davor), gezeichnet in Rasterzellen auf EINER Leinwand um Anwender und Ziel: feste Palettenfarben (`ppSnapRgb`), Bayer-Dither
//  statt Alpha, nichts gedreht/weich skaliert. ANDERS als beim Ramm-Dash (app-fx-27) rast hier KEINE DOM-Figur: der ANWENDER-HELD wird vollständig in die Leinwand gemalt (Sprite zellenweise, Streckung/Spiegelung
//  per Zeilenmapping, Neigung per Zeilenversatz, Höhe über die Brett-Homografie); sein DOM-Sprite (`.hero-idle-platz`) ist von Bild −19 bis 18 unsichtbar und danach wieder da (auch bei Abbruch/Unmount/Tod).
//  ABLAUF (Bild nach Kontakt, 30/s):
//   −19…−16 HOCKE     Streckung 1,16/0,88, Staub an den Füßen · −15…−7 SPRUNG Absprung, Höhe ≈ 2,3 Heldenhöhen (ease-out), 40 % des Wegs, Nachbilder
//   −7…−5   SCHEITEL  2 Bilder Hängen, Bild −5 Dreh-Bild · −4…0 ABSTURZ im Bogen KOPF VORAN (Figur senkrecht GESPIEGELT, gestreckt, Neigung in Flugrichtung, Nachbilder, Geschwindigkeitslinien); der Schatten bleibt am Boden
//   0–1     EINSCHLAG Weiß-Blitz mit Strahlen, Ziel weiß, Hit-Stop (Teilchenzeit steht, nur Blitz/Quetschung/Shake laufen), Shake bis 3 Zellen (nicht am Handy)
//   2       SCHADEN   (= Kontakt + 67 ms; Engine `_delay`); Ziel quetscht 1,28/0,70, fliegt 1–3 Zellen zurück, federt bis Bild 8, wackelt bis 14
//   2–5     RÜCKPRALL Anwender prallt aufrecht ab, Landung Bild 5 (1,25/0,8), Federung bis 8 · 9–13 RÜCKWEG linear zum Platz, Federung am Platz bis 17
//   0–36    WIRKUNG   Bodenringe (2/3/3), Risse (verblassen 22–36), Staub, Splitter, Funken; Ochsenkopf-Symbol (Hörner, Brauen, Augen, Nasenring, Dampf) voll 1–6, Bayer-Zerfall 7–11
//  Stärke `pow` 1–3 = 1./2./3. Angriff der Runde (Ringzahl, Risse, Staub, Splitter, Funken, Kopfgröße, Shake). Karte als Ziel: nicht gequetscht, nur verschoben und weiß geblitzt, Ringe am Boden.
//  BRETTABBILDUNG: Homografie Brettebene → Fenster aus den Mitten aller Zonen (`ppFx60Homografie`, app-fx-60); Einheit u des Prototyps: ein Sprite-Pixel = 4,84 u. Tiefenordnung: in der Luft Z oben, am Boden nach Brett-y;
//  stehende Helden (außer dem Anwender) liegen mit Tiefe 1000 − y in der Tiefenmaske.
//  PIXELGRÖSSE: Rasterzelle S = Hero-Pixel der Zielreihe (`ppFxZelleGedeckelt`, Regel in app-fx-57). Handy: Teilchen 50 %, Risse ×0,7, kein Shake. Der Anwender wird mit seinem Heimmaß (Hero-Pixel seiner Reihe) gemalt
//  und mit dem Verhältnis der Brett-Maßstäbe skaliert → kein Größensprung beim Aus-/Einblenden des DOM-Sprites.
//  ENGINE: ein Ereignis `play_zone_animation { type: 'ox_headbutt', owner, heroIdx, zoneSlot, von: { owner, heroIdx, el: true }, pow, cardName }`. Der Client entscheidet (`ppFx62Pruefe`, app-board.jsx `onZoneAnim`):
//  geht der neue Weg nicht (Retro, Animationen aus, `__ppFxAlt`, reduzierte Bewegung, `window.__ppFx62Aus`, fehlende Quelle/Zone, tote/versteinerte/unsichtbare/eingefrorene Quelle ohne Figur), spielt er selbst
//  die alte Kombination ab (`play_ram_animation` + `explosion` + `ox_impact`, auf den Schaden-Zeitpunkt der Engine gelegt).
//  Klang: `ZONE_ANIM_SFX.ox_headbutt` (app-shared.jsx, Funktion nach `pow`). Aufwärmen (Trockenlauf, Ochsenkopf-Zellenlisten) im Leerlauf (`window.__ppFx62KeinAufwaermen` schaltet ab).
//  Messung (nur Tests): `window.__ppFx62Messen = true` → `window.__ppFx62Zeiten` = [Bild, ms] (Bild −100 = Geometrie, −101 = Maske), `window.__ppFx62T0` = Startzeit (Bild −19) in performance.now().
// ═════════════════════════════════════════════════════════════════
(function (root) {
  let H = null, BAY = null, snapA = null, C = null, GHOST = null;
  const FX = {};
  const rd = Math.round, fl = Math.floor, ab = Math.abs, mn = Math.min, mx = Math.max, sqrt = Math.sqrt, PI = Math.PI, hyp = Math.hypot;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const LEN = 40, DAMAGE_F = 2, DASH0 = -19, MAXF = 18;      // letzter Bild-Index der Figurbewegung: 18
  FX.LEN = LEN; FX.DAMAGE_F = DAMAGE_F; FX.DASH0 = DASH0; FX.MAXF = MAXF;
  const FEDER = [[1.25, 0.8], [0.92, 1.12], [1.03, 0.97], [1, 1]], FAHRT = [1.5, 0.78];

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
      for (let n = 0; n < 900; n++) { for (let j = 0; j < th; j++) for (let i = 0; i < th; i++) pd(x0 + i, y0 + j, c, lv == null ? 16 : lv); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    };
    return { px, pd, linie, buf, tq, gw, gh, ox, oy, setZ: (z) => { Z = z; }, getZ: () => Z };
  }
  FX.maler = maler;

  FX.init = () => {
    if (C) return;
    const B = root.PpFx57; B.ensure(); H = B.H; BAY = B.BAY; snapA = B.snap; C = {}; const s = snapA, S = B.C;
    C.gelb = S.gelb; C.funke = S.funke; C.grau = S.grau;
    C.red = s('#e73b41'); C.yel = s('#ffe23d'); C.orange = s('#ff9a1a'); C.white = [255, 255, 255];
    C.cream = s('#fffbd2'); C.dark = s('#08060c'); C.ink = s('#12101f'); C.pink = s('#ec7f79');
    C.fur0 = s('#5a341a'); C.fur1 = s('#8e503a'); C.fur2 = s('#9d612f'); C.fur3 = s('#ca874e'); C.fur4 = s('#e0c085');
    C.horn0 = s('#a89370'); C.horn1 = s('#c5b7a0'); C.horn2 = s('#ebdcc1'); C.horn3 = s('#fffbd2');
    C.gold0 = s('#a87c00'); C.gold1 = s('#c79e05'); C.gold2 = s('#f8ca21'); C.gold3 = s('#fff196');
    C.dust0 = s('#c5b7a0'); C.dust1 = s('#a89370'); C.dust2 = s('#886c44'); C.dust3 = s('#ebdcc1'); C.rock1 = s('#7f7f7f'); C.rock2 = s('#b9b9b9'); C.earthL = s('#9d612f');
    GHOST = [C.cream, C.gelb, C.white, C.funke];
    FX.C = C;
  };

  // ═════════ gemeinsame Bausteine: Nachbilder, Boden (Schatten, Ringe, Risse), Staub, Splitter, Funken, Geschwindigkeitslinien ═════════
  // Nachbilder aus der Bewegungstabelle (jedes 2. Bild, nur wenn weit genug entfernt)
  function ghostsFrom(tab, i, cols, minDist) {
    const out = [], e = tab[i];
    for (let a = 0; a < 4; a++) { const h = tab[i - 2 * (a + 1)]; if (!h || !h.active) continue; if (hyp(h.dx - e.dx, h.dy - e.dy, (h.dv - e.dv) * 0.8) <= minDist) continue; out.push({ dx: h.dx, dy: h.dy, dv: h.dv || 0, sx: h.sx, sy: h.sy, flip: !!h.flip, lean: h.lean || 0, col: cols[a % cols.length], phase: a & 1 }); }
    return out;
  }
  // Schatten: Dither-Ellipse am Boden unter (x, y)
  function shadow(m, cam, x, y, rb, lv, z) {
    const c = cam.proj(x, y, 0), k = c[2], rx = rb * k, ry = rx * mx(0.3, cam.cosT * 0.95), X0 = rd(c[0]), Y0 = rd(c[1]);
    m.setZ(z);
    for (let yy = -Math.ceil(ry); yy <= Math.ceil(ry); yy++) for (let xx = -Math.ceil(rx); xx <= Math.ceil(rx); xx++) {
      const q = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry); if (q > 1) continue;
      m.pd(X0 + xx, Y0 + yy, C.dark, q > 0.62 ? lv * 0.45 : lv);
    }
  }
  // Ring auf dem Boden (Radius R in Brett-Einheiten um (x, y)); half: 0 alle, −1 hintere Hälfte, +1 vordere Hälfte; th Dicke in Zellen
  function ring(m, cam, x, y, R, th, col, lv, half) {
    if (R <= 0 || lv <= 0) return;
    const c0 = cam.proj(x, y, 0), n = mx(24, Math.min(160, rd(R * c0[2] * 3.4)));
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * 2 * PI, bx = x + Math.cos(a) * R, by = y + Math.sin(a) * R, p = cam.proj(bx, by, 0);
      if (prev) { const fr = (Math.sin(a) + Math.sin(prev.a)) >= 0; if (half === 0 || (half > 0) === fr) { m.setZ(1000 - by); m.linie(prev.p[0], prev.p[1], p[0], p[1], th, col, lv); } }
      prev = { p, a };
    }
  }
  // Boden-Rissmuster: Strahlen als Polylinien relativ zum Zentrum
  function makeCracks(seed, n, Lmin, Lmax) {
    const out = [];
    for (let i = 0; i < n; i++) {
      let a = (i / n) * 2 * PI + (H(seed, i) - 0.5) * 0.9, x = 0, y = 0; const pts = [[0, 0]], L = lerp(Lmin, Lmax, H(seed + 3, i + 7)), steps = mx(4, rd(L / 15)), br = [];
      for (let s = 1; s <= steps; s++) {
        a += (H(seed + 11, i * 20 + s) - 0.5) * 0.95; const sl = 15 + H(seed + 5, i * 20 + s) * 9; x += Math.cos(a) * sl; y += Math.sin(a) * sl; pts.push([x, y]);
        if (s > 1 && s < steps && H(seed + 17, i * 20 + s) < 0.28) { const ba = a + (H(seed + 19, i * 20 + s) < 0.5 ? -1 : 1) * (0.7 + H(seed + 23, i * 20 + s) * 0.5), bl = 2 + (H(seed + 29, i * 20 + s) * 2 | 0); const bp = [[x, y]]; let bx = x, by = y, aa = ba; for (let t = 0; t < bl; t++) { aa += (H(seed + 31, i * 40 + s * 4 + t) - 0.5) * 0.8; bx += Math.cos(aa) * 13; by += Math.sin(aa) * 13; bp.push([bx, by]); } br.push(bp); }
      }
      out.push({ pts, br });
    }
    return out;
  }
  function drawCracks(m, cam, cx, cy, cracks, frac, lv, z) {
    if (lv <= 0 || frac <= 0) return;
    m.setZ(z);
    const poly = (pts, th, col) => {
      const n = pts.length - 1; let prev = null;
      for (let i = 0; i <= n; i++) {
        const u = i / n; if (u > frac) { if (prev && i > 0) { const t = frac * n - (i - 1); if (t > 0) { const a = pts[i - 1], b = pts[i], q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], p0 = cam.proj(cx + a[0], cy + a[1], 0), p1 = cam.proj(cx + q[0], cy + q[1], 0); m.linie(p0[0], p0[1], p1[0], p1[1], th, col, lv); } } break; }
        const p = cam.proj(cx + pts[i][0], cy + pts[i][1], 0); if (prev) m.linie(prev[0], prev[1], p[0], p[1], th, col, lv); prev = p;
      }
    };
    for (const r of cracks) {
      poly(r.pts, 1, C.dark);
      poly(r.pts.map((p) => [p[0] + 3, p[1] + 3]), 1, C.dust1);   // Kante (helle Lippe, eine Zelle versetzt)
      for (const b of r.br) poly(b, 1, C.dark);
    }
  }
  function disc(m, X, Y, r, cols, lv) {   // gefüllte Scheibe mit 3-Ton-Schattierung (cols = [hell, mittel, dunkel])
    const ri = Math.ceil(r);
    for (let yy = -ri; yy <= ri; yy++) for (let xx = -ri; xx <= ri; xx++) {
      const d = hyp(xx, yy); if (d > r + 0.2) continue;
      const l = (-xx * 0.6 - yy * 0.8) / mx(1, r); const c = l > 0.35 ? cols[0] : (l > -0.25 ? cols[1] : cols[2]);
      m.pd(X + xx, Y + yy, c, lv);
    }
  }
  function makeDust(seed, n, hu, spMin, spMax) {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ a: H(seed, i) * 2 * PI, r0: (0.1 + 0.25 * H(seed + 1, i)) * hu, sp: lerp(spMin, spMax, H(seed + 2, i)) * hu, rise: (0.15 + 0.45 * H(seed + 3, i)) * hu, size: 1.8 + 3.2 * H(seed + 4, i), life: 13 + (H(seed + 5, i) * 9 | 0), t0: (H(seed + 6, i) * 2) | 0, tone: (H(seed + 7, i) * 3) | 0 });
    return out;
  }
  function drawDust(m, cam, cx, cy, dust, fe, tones) {
    for (const d of dust) {
      const t = fe - d.t0; if (t < 0 || t > d.life) continue;
      const u = t / d.life, rr = d.r0 + d.sp * (1 - Math.pow(1 - u, 2.2)), x = cx + Math.cos(d.a) * rr, y = cy + Math.sin(d.a) * rr, v = d.rise * Math.sqrt(u) * 0.8 + 2;
      const c = cam.proj(x, y, v), size = d.size * (0.55 + 0.7 * mn(1, t / 5)) * mx(0.7, c[2] * 0.2 + 0.55) * (1 - 0.35 * u);
      const lv = u < 0.45 ? 16 : 16 * (1 - (u - 0.45) / 0.55);
      m.setZ(1000 - y); disc(m, rd(c[0]), rd(c[1]), size, tones[d.tone % tones.length], lv);
    }
  }
  function makeDebris(seed, n, hu) {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ a: H(seed, i + 40) * 2 * PI, sp: (4 + 8 * H(seed + 1, i + 40)) * (hu / 150), up: (16 + 14 * H(seed + 2, i + 40)) * (hu / 150), r0: 0.1 * hu * H(seed + 3, i + 40), big: H(seed + 4, i + 40) < 0.35, t0: (H(seed + 5, i + 40) * 2) | 0, col: (H(seed + 6, i + 40) * 3) | 0 });
    return out;
  }
  function drawDebris(m, cam, cx, cy, deb, fe, g, cols) {
    for (const d of deb) {
      const t = fe - d.t0; if (t < 0 || t > 30) continue;
      const x = cx + Math.cos(d.a) * (d.r0 + d.sp * mn(t, 16)), y = cy + Math.sin(d.a) * (d.r0 + d.sp * mn(t, 16)) * 0.8;
      let v = d.up * t - 0.5 * g * t * t, landed = false; if (v < 0) { v = 0; landed = true; }
      const c = cam.proj(x, y, v), X = rd(c[0]), Y = rd(c[1]), col = cols[d.col];
      if (landed) { const tl = t - 2 * d.up / g; if (tl > 5) continue; m.setZ(1000 - y); m.pd(X, Y, col, tl < 2 ? 16 : 16 - (tl - 2) * 5); if (d.big && tl < 3) m.pd(X + 1, Y, cols[1], 16); continue; }
      m.setZ(0);
      if (d.big) { m.px(X, Y, cols[2]); m.px(X + 1, Y, cols[1]); m.px(X, Y + 1, cols[0]); m.px(X + 1, Y + 1, cols[0]); } else m.px(X, Y, col);
    }
  }
  // Funken: radiale Strahlen in Zellen um (X, Y); je Strahl Linie von p zurück
  function drawSparks(m, X, Y, seed, n, fe, life, vmin, vmax, cols, grav) {
    m.setZ(0);
    for (let i = 0; i < n; i++) {
      const a = H(seed, i) * 2 * PI, v = lerp(vmin, vmax, H(seed + 1, i)), l = life * (0.55 + 0.45 * H(seed + 2, i)), t = fe - (H(seed + 3, i) * 1.5 | 0); if (t < 0 || t > l) continue;
      const d = v * (1 - Math.pow(1 - t / l, 2)) * l * 0.5, d0 = v * (1 - Math.pow(1 - mx(0, t - 1.2) / l, 2)) * l * 0.5;
      const px = X + Math.cos(a) * d, py = Y + Math.sin(a) * d * 0.9 + (grav || 0) * t * t * 0.08, qx = X + Math.cos(a) * d0, qy = Y + Math.sin(a) * d0 * 0.9 + (grav || 0) * mx(0, t - 1.2) * mx(0, t - 1.2) * 0.08;
      const u = t / l, col = u < 0.3 ? cols[0] : u < 0.65 ? cols[1] : cols[2];
      if (u > 0.82 && BAY[rd(py) & 3][rd(px) & 3] > 8) continue;
      m.linie(qx, qy, px, py, 1, col, 16);
    }
  }
  // Geschwindigkeitslinien parallel zur Bewegung (dirX, dirY Einheitsvektor, Zellen); Mittelpunkt (cx, cy)
  function speedLines(m, f, seed, cx, cy, dirX, dirY, n, spread, lenMin, lenMax, cols) {
    const px = -dirY, py = dirX; m.setZ(0);
    for (let i = 0; i < n; i++) {
      const o = (H(seed + f * 7, i) - 0.5) * 2 * spread, l = lerp(lenMin, lenMax, H(seed + f * 3, i + 20)), back = (H(seed + f * 5, i + 40) * 0.9 + 0.1) * l * 1.2 + (H(seed + f, i + 60) - 0.5) * spread * 0.4;
      const x0 = cx + px * o - dirX * back, y0 = cy + py * o - dirY * back, x1 = x0 - dirX * l, y1 = y0 - dirY * l;
      m.linie(x0, y0, x1, y1, 1, cols[i % cols.length], 16);
    }
  }

  // ═════════ Plan (Einheiten u: ein Sprite-Pixel = 4,84 u; Koordinaten der Brettebene) ═════════
  // o = { att: { x, y, hu, w }, tgt: { x, y, hu, kind: 'hero' | 'card', wb }, pow 1..3, n (Teilchenfaktor), phone, seed }
  FX.plan = (o) => {
    const pw = clamp((o.pow || 2) | 0, 1, 3), pi = pw - 1;
    const P = { o, pw, pi, n: o.n == null ? 1 : o.n, phone: !!o.phone, seed: o.seed || 1, att: o.att, tgt: o.tgt, kind: o.tgt.kind };
    const A = [o.att.x, o.att.y], T = [o.tgt.x, o.tgt.y], hero = o.tgt.kind === 'hero', thu = o.tgt.hu || 150, ahu = o.att.hu || 150, zw = o.att.w || 120;
    const dx = T[0] - A[0], dy = T[1] - A[1], len = hyp(dx, dy) || 1, Fh = [dx / len, dy / len];
    Object.assign(P, { A, T, Fh, hero, hu: thu, ahu, len, zw });
    const cOff = hero ? 0.10 * zw : 0.04 * zw, dist = len - cOff;
    P.cOff = cOff; P.vec = [Fh[0] * dist, Fh[1] * dist]; P.Lc = [A[0] + P.vec[0], A[1] + P.vec[1]];
    const Hj = 2.3 * ahu, hc = hero ? 0.5 * thu : 6;
    P.Hj = Hj; P.hc = hc; P.sv = hero ? 0.55 * thu : 5;
    P.G0 = [T[0] - Fh[0] * cOff * 0.5, T[1] - Fh[1] * cOff * 0.5];
    // — Bewegungstabelle je Bild (Index f − DASH0) —
    const CR = [[1.10, 0.94], [1.16, 0.88], [1.16, 0.88], [1.18, 0.86]], HB = [0.45, 0.55, 0.25, 0], tab = [], absd = mx(8, zw * 0.17);
    let prev = null;
    for (let f = DASH0; f <= 20; f++) {
      const e = { active: true, f, dx: 0, dy: 0, dv: 0, sx: 1, sy: 1, flip: false, lean: 0, fahrt: false, fast: false, kind: '' };
      let p = 0, dv = 0;
      if (f > MAXF) { e.active = false; tab.push(e); continue; }
      if (f <= -16) { [e.sx, e.sy] = CR[f + 19]; e.kind = 'hocke'; }
      else if (f <= -7) {
        const u = (f + 15) / 8; dv = Hj * (1 - Math.pow(1 - u, 2)); p = 0.40 * u; e.kind = 'sprung'; e.fast = f >= -14;
        [e.sx, e.sy] = f <= -13 ? [0.82, 1.22] : f <= -10 ? [0.90, 1.12] : f <= -8 ? [0.96, 1.05] : [1, 1];
      } else if (f <= -5) {
        dv = Hj * (f === -7 ? 1 : f === -6 ? 0.995 : 0.985); p = 0.40 + 0.05 * (f + 7); e.kind = 'scheitel';
        [e.sx, e.sy] = f === -7 ? [1.04, 0.97] : f === -6 ? [1.1, 0.92] : [1.25, 0.6];
      } else if (f <= 1) {
        const k = mn(5, f + 5); dv = hc + (Hj * 0.985 - hc) * (1 - Math.pow(k / 5, 2)); p = k >= 5 ? 1 : 0.5 + 0.5 * Math.pow(k / 5, 1.5); e.kind = 'absturz'; e.flip = true; e.fast = f <= 0;
        [e.sx, e.sy] = f <= -4 ? [0.9, 1.3] : f <= 0 ? [0.78, 1.5] : [0.92, 1.25];
        if (f >= 0) { [e.sx, e.sy] = [0.92, 1.25]; }
        if (f === 0) [e.sx, e.sy] = [0.84, 1.42];
      } else if (f <= 5) {
        p = 1; dv = HB[f - 2] * ahu; e.kind = 'rueckprall';
        [e.sx, e.sy] = f === 2 ? [0.9, 1.12] : f === 3 ? [0.95, 1.05] : f === 4 ? [1, 1] : FEDER[0];
      } else if (f <= 9) { p = 1; e.kind = 'federung'; [e.sx, e.sy] = f === 6 ? FEDER[1] : f === 7 ? FEDER[2] : [1, 1]; }
      else if (f <= 13) { p = 1 - sm((f - 9) / 4); e.kind = 'rueck'; e.fahrt = true; e.fast = true; [e.sx, e.sy] = FAHRT; if (f === 13) { e.fahrt = false; [e.sx, e.sy] = FEDER[0]; } }
      else { p = 0; e.kind = 'federung'; [e.sx, e.sy] = FEDER[Math.min(3, f - 13)] || [1, 1]; }
      e.dx = rd(P.vec[0] * p); e.dy = rd(P.vec[1] * p); e.dv = dv; e.p = p;
      // Neigung in Flugrichtung (Kopf führt): Geschwindigkeit seit dem vorigen Bild
      if (prev && (e.kind === 'sprung' || e.kind === 'absturz')) {
        const vx = e.dx - prev.dx, vy = e.dy - prev.dy, vv = e.dv - prev.dv, vs = vy * 0.87 - vv; e.lean = clamp(vx / (ab(vs) + ab(vx) + 1e-3), -1, 1) * 0.30;
      }
      tab.push(e); prev = e;
    }
    for (let i = 0; i < tab.length; i++) { const e = tab[i]; e.ghosts = e.active && e.fast ? ghostsFrom(tab, i, GHOST, absd * 0.8) : []; }
    P.tab = tab;
    // — Staub-Wolken am Fuß (f, Brett-Ort, Größe) —
    P.puffs = [{ f: -16, x: A[0], y: A[1], n: 6 }, { f: -15, x: A[0], y: A[1], n: 9 }, { f: 5, x: P.Lc[0], y: P.Lc[1], n: 9 }, { f: 10, x: P.Lc[0], y: P.Lc[1], n: 6 }, { f: 13, x: A[0], y: A[1], n: 9 }];
    // — Wirkung —
    const n = P.n, sd = P.seed * 31;
    P.nRing = [2, 3, 3][pi]; P.Rmax = thu * [1.2, 1.5, 1.9][pi];
    P.cracks = makeCracks(sd, mx(4, rd([6, 8, 10][pi] * (P.phone ? 0.7 : 1))), 0.5 * thu, thu * [0.95, 1.1, 1.3][pi]);
    P.dust = makeDust(sd + 100, mx(4, rd([14, 22, 30][pi] * n)), thu, 0.35, 0.9);
    P.deb = makeDebris(sd + 200, mx(3, rd([8, 12, 18][pi] * n)), thu);
    P.nSpark = mx(6, rd([14, 20, 26][pi] * n)); P.HS = [1.1, 1.3, 1.5][pi];
    P.keyPts = [[A[0], A[1], 0], [A[0] + P.vec[0] * 0.45, A[1] + P.vec[1] * 0.45, Hj], [A[0] + P.vec[0] * 0.45, A[1] + P.vec[1] * 0.45, Hj + 1.3 * ahu], [P.Lc[0], P.Lc[1], hc + ahu * 1.5], [T[0], T[1], P.sv], [T[0] + P.Rmax, T[1], 0], [T[0] - P.Rmax, T[1], 0], [T[0], T[1] + P.Rmax * 0.8, 0], [T[0], T[1] - P.Rmax * 0.8, 0]];
    headCells(P.HS);   // Ochsenkopf einmal je Größe vorbacken (Plan läuft vor dem ersten Bild, im Leerlauf schon beim Aufwärmen)
    return P;
  };
  FX.dash = (f, P) => { const i = f - DASH0; return i >= 0 && i < P.tab.length ? P.tab[i] : { active: false, dx: 0, dy: 0, dv: 0, sx: 1, sy: 1, ghosts: [] }; };

  // ── Ziel: Quetschung, Rückstoß ──
  const SQ = [[1.28, 0.70], [1.28, 0.70], [1.16, 0.82], [0.86, 1.20], [0.94, 1.10], [1.04, 0.96], [1.02, 0.98], [1, 1]], KB = [1, 2, 3, 3, 2, 1, 1, 0], WIG = [0, 0, 0, 0, 0, 0, 0, 0, 1, -1, 1, -1, 1, 0, 0];
  FX.pose = (f, P) => {
    if (f < 0 || f > 14) return { active: false, flash: 0, sx: 1, sy: 1, kb: 0, dx: 0, dy: 0 };
    const q = f < 8 ? SQ[f] : [1, 1], kb = f < 8 ? KB[f] * (P.pw === 1 ? 0.67 : 1) + (P.pw === 3 && f >= 1 && f <= 4 ? 1 : 0) : 0;
    return { active: true, flash: f === 0 ? 1 : f === 1 ? 2 : f === 2 ? 3 : 0, sx: q[0], sy: q[1], kb, dx: WIG[f] || 0, dy: 0 };
  };
  const SH = [[3, 0], [-3, 1], [2, -2], [-2, 2], [1, -1], [-1, 1], [1, 0], [0, 1]];
  FX.shake = (f, P) => { if (f < 0 || f >= SH.length || P.phone) return [0, 0]; const a = P.pw === 1 ? 0.67 : 1; return [rd(SH[f][0] * a), rd(SH[f][1] * a)]; };

  // ═════════ Ochsenkopf (Symbol) ═════════
  const HORNS = (() => { const out = []; for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, x = (1 - t) * (1 - t) * 6.6 + 2 * (1 - t) * t * 14.6 + t * t * 15.4, y = (1 - t) * (1 - t) * -5.5 + 2 * (1 - t) * t * -5.2 + t * t * -15.6; pts.push([s * x, y, 3.6 * (1 - t) + 0.9, t]); } out.push(pts); } return out; })();
  // Der Kopf ist unabhängig vom Bild: einmal je Größe in Zellen (Farbe je Zelle samt Umriss) aufbauen und nur noch mit Dither-Stufe lv an (cx, cy) stempeln (Bayer-Muster hängt an der Kopf-Zelle, nicht am Bildschirm).
  const HEADS = new Map();
  function buildHead(HS) {
    const x0 = -Math.ceil(19 * HS), x1 = Math.ceil(19 * HS), y0 = -Math.ceil(19 * HS), y1 = Math.ceil(14 * HS);
    const gold = (u, v, X, Y) => { const l = -u * 0.6 - v * 0.8 + (BAY[Y & 3][X & 3] / 16 - 0.47) * 0.5; return l > 0.5 ? C.gold3 : l > 0.0 ? C.gold2 : l > -0.5 ? C.gold1 : C.gold0; };
    const fn = (X, Y) => {
      const u = (X + 0.5) / HS, v = (Y + 0.5) / HS, au = ab(u), s = u < 0 ? -1 : 1;
      // Augen
      const ex = au - 4.5, ey = v + 2.1; if (ex * ex / 4.0 + ey * ey / 1.9 < 1) return (ab(ex) < 0.7 && ab(ey) < 0.9) ? C.red : (ey < -0.45 ? C.orange : C.yel);
      // Brauen (wütend: innen tief)
      { const t = (au - 1.0) / 6.4; if (t >= 0 && t <= 1) { const by = -1.5 - 3.9 * t; if (ab(v - by) < 1.05 + 0.3 * (1 - t)) return C.ink; } }
      // Nasenring (Gold)
      { const ry = v - 9.2, d = hyp(u, ry); if (d < 3.4 && d > 1.9 && ry > -1.5) return gold(u, v, X, Y); }
      // Nüstern
      { const nx = au - 2.7, ny = v - 6.0; if (nx * nx / 2.2 + ny * ny / 1.3 < 1) return C.ink; }
      const mz = (u * u) / 36 + ((v - 6.2) * (v - 6.2)) / 27, sk = (u * u) / 73.96 + ((v + 1.2) * (v + 1.2)) / 96.04;
      if (mz < 1) { const l = -u * 0.3 - (v - 6) * 0.45 + (BAY[Y & 3][X & 3] / 16 - 0.47) * 0.5; return l > 0.1 ? C.fur4 : l > -0.35 ? C.fur3 : C.fur2; }
      if (sk < 1) {
        const nx = u / 8.6, ny = (v + 1.2) / 9.8, l = -0.5 * nx - 0.6 * ny + (BAY[Y & 3][X & 3] / 16 - 0.47) * 0.55;
        if (au < 1.3 && v < -1.5 && v > -9.5) return l > 0.1 ? C.fur3 : C.fur2;   // Stirnblesse
        return l > 0.42 ? C.fur3 : l > 0.0 ? C.fur2 : l > -0.42 ? C.fur1 : C.fur0;
      }
      { const ex2 = (au - 10.4) / 3.5, ey2 = (v + 3.4) / 2.0; if (ex2 * ex2 + ey2 * ey2 < 1) return (ab(au - 10.2) < 1.8 && ab(v + 3.3) < 0.7) ? C.pink : C.fur1; }
      if (au > 5 && v < -2.5 && au < 17 && v > -17) for (const hp of HORNS) for (let i = hp.length - 1; i >= 0; i--) { const q = hp[i], dd = hyp(u - q[0], v - q[1]); if (dd <= q[2] / 2 + 0.3) { const t = q[3], under = (v - q[1]) > q[2] * 0.12 || (s * (u - q[0]) < -q[2] * 0.15 && t < 0.6); return t > 0.85 ? C.horn3 : under ? (t < 0.4 ? C.horn0 : C.horn1) : (t < 0.4 ? C.horn1 : C.horn2); } }
      return null;
    };
    const w = x1 - x0 + 1, h = y1 - y0 + 1, mask = new Array(w * h), cells = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = fn(x0 + x, y0 + y);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : mask[y * w + x]);
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) { const c = at(x, y); if (c) cells.push([x0 + x, y0 + y, c]); else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) cells.push([x0 + x, y0 + y, C.ink]); }
    return cells;
  }
  function headCells(HS) { let cells = HEADS.get(HS); if (!cells) { cells = buildHead(HS); HEADS.set(HS, cells); } return cells; }
  function oxHead(m, cx, cy, HS, lv) {
    const cells = headCells(HS), X0 = rd(cx), Y0 = rd(cy);
    for (let i = 0; i < cells.length; i++) { const c = cells[i]; m.pd(X0 + c[0], Y0 + c[1], c[2], lv); }
  }

  // ═════════ Zeichnen ═════════
  // cam = { proj(x, y, v) → [Zelle x, Zelle y, Zellen je Einheit], cosT }; hook = { pile(m, pose, null) (Ziel), ghost(m, g, z) (Nachbild des Anwenders), attacker(m, d, z) (Anwender) }
  FX.draw = (m, f, P, cam, hook) => {
    m.setZ(0);
    const proj = cam.proj, T = P.T, A = P.A, hero = P.hero, pw = P.pw, pi = P.pi, n = P.n, ahu = P.ahu, thu = P.hu;
    const fe = f <= 1 ? 0 : f - 1, k0 = proj(T[0], T[1], 0)[2];
    const sA = proj(A[0], A[1], hero ? 0.5 * thu : 0), sT = proj(T[0], T[1], hero ? 0.5 * thu : 0);
    let ddx = sT[0] - sA[0], ddy = sT[1] - sA[1]; const dl = hyp(ddx, ddy) || 1; ddx /= dl; ddy /= dl;
    const D = FX.dash(f, P), pose = FX.pose(f, P);
    const g0 = P.G0, S2 = proj(P.Lc[0], P.Lc[1], P.hc), S = proj(T[0], T[1], P.sv);
    // ───── Bodenschicht ─────
    // Schatten des Anwenders
    if (D.active && f <= 17) {
      const fr = clamp(D.dv / P.Hj), rb = 0.34 * ahu * (1 - 0.4 * fr), lv = 11 - 6 * fr;
      shadow(m, cam, A[0] + D.dx, A[1] + D.dy, rb, lv, 1000 - (A[1] + D.dy));
    }
    // Risse
    if (f >= 0) { const frac = 0.3 + 0.7 * sm(fe / 4), lv = f < 22 ? 16 : 16 * (1 - (f - 22) / 15); drawCracks(m, cam, g0[0], g0[1], P.cracks, frac, lv, 1000 - g0[1] + 0.5); }
    // Boden-Blitzscheibe (flach, Dither)
    if (f >= 0 && f <= 3) {
      const R = P.Rmax * [0.55, 0.45, 0.32, 0.2][f], lv = [11, 8, 5, 3][f], col = f === 0 ? C.white : C.cream, c = proj(g0[0], g0[1], 0), rx = R * c[2], ry = rx * mx(0.3, cam.cosT * 0.95); m.setZ(1000 - g0[1] + 0.5);
      for (let yy = -Math.ceil(ry); yy <= Math.ceil(ry); yy++) for (let xx = -Math.ceil(rx); xx <= Math.ceil(rx); xx++) { const q = xx * xx / (rx * rx) + yy * yy / (ry * ry); if (q > 1) continue; m.pd(rd(c[0]) + xx, rd(c[1]) + yy, col, q > 0.7 ? lv * 0.4 : lv); }
    }
    // Ringe: hintere Hälfte (liegt hinter dem Ziel)
    const rings = (half) => {
      for (let i = 0; i < P.nRing; i++) {
        const t = fe - i * 2; if (f < 0 || t < 0) continue;
        const R = thu * 0.25 + (P.Rmax * (1 - i * 0.18)) * (1 - Math.pow(1 - clamp(t / 14), 2.2)), lv = t < 6 ? 16 : 16 * (1 - (t - 6) / 12);
        const cols = [[C.white, C.cream], [C.cream, C.dust3], [C.dust0, C.dust1]][i];
        ring(m, cam, g0[0], g0[1], R, 2, cols[0], lv, half);
        ring(m, cam, g0[0], g0[1], R * 0.93, 1, cols[1], lv * 0.85, half);
      }
    };
    rings(-1);
    // ───── Ziel (gequetscht) ─────
    if (hook.pile && pose.active) { m.setZ(0); pose.dxc = rd(ddx * pose.kb) + pose.dx; pose.dyc = rd(ddy * pose.kb); P.kbx = pose.dxc; P.kby = pose.dyc; hook.pile(m, pose, null); } else { P.kbx = 0; P.kby = 0; }
    // ───── Anwender ─────
    // Geschwindigkeitslinien (Rücklauf des Bogens), Richtung aus der Bildschirmbewegung
    const scrOf = (e) => proj(A[0] + e.dx, A[1] + e.dy, e.dv);
    if (D.active && (D.kind === 'sprung' || D.kind === 'absturz') && D.fast) {
      const e0 = scrOf(D), e1 = scrOf(P.tab[f - 1 - DASH0] || D); let vx = e0[0] - e1[0], vy = e0[1] - e1[1]; const vl = hyp(vx, vy) || 1; vx /= vl; vy /= vl;
      const cxf = e0[0], cyf2 = e0[1] - (D.kind === 'absturz' ? 0.7 : 0.5) * ahu * e0[2] * D.sy;
      speedLines(m, f, P.seed + 9, cxf, cyf2, vx, vy, mx(3, rd((D.kind === 'absturz' ? 12 : 7) * n)), 0.36 * ahu * e0[2], 6, 15, [C.cream, C.white, C.gelb, C.funke]);
    }
    // Nachbilder, Figur
    if (D.active) {
      m.setZ(0);
      for (let i = D.ghosts.length - 1; i >= 0; i--) { const g = D.ghosts[i]; hook.ghost(m, g, g.dv > 0.15 * ahu ? 0 : 1000 - (A[1] + g.dy)); }
      hook.attacker(m, D, D.dv > 0.12 * ahu || D.kind === 'absturz' ? 0 : 1000 - (A[1] + D.dy));
    }
    // Staub (Start/Landung/Rückweg)
    for (const pf of P.puffs) {
      const age = f - pf.f; if (age < 0 || age > 7) continue; const base = proj(pf.x, pf.y, 0); m.setZ(1000 - pf.y);
      for (let i = 0; i < pf.n; i++) { const an = H(P.seed * 5 + pf.f, i) * 2 * PI, r = (0.35 + H(P.seed * 7 + pf.f, i + 9) * 0.65) * 2.4, t = age + 1, X = rd(base[0] + Math.cos(an) * r * t * 1.3), Y = rd(base[1] - 1 + Math.sin(an) * r * t * 0.55 - t * 0.5); if (age > 4 && (i & 1)) continue; m.px(X, Y, (i % 3 === 0) ? C.grau : C.cream); }
    }
    // ───── Wirkung vor dem Ziel ─────
    rings(1);
    if (f >= 0) {
      drawDust(m, cam, g0[0], g0[1], P.dust, fe, [[C.dust3, C.dust0, C.dust1], [C.dust0, C.dust1, C.dust2], [C.cream, C.dust3, C.dust0]]);
      drawDebris(m, cam, g0[0], g0[1], P.deb, fe, 2.2 * (thu / 150), [C.earthL, C.rock1, C.rock2]);
      // Funken
      drawSparks(m, S[0], S[1], P.seed * 3, P.nSpark, fe, 9, 2.4, 5.2 * (1 + 0.15 * pi), [C.white, C.gelb, C.orange], 0);
      // Weiß-Blitz am Aufprallpunkt (Scheibe + Strahlen)
      if (f <= 3) {
        const s2 = [1, 0.85, 0.62, 0.4][f], R0 = (14 + 3 * pi) * s2 * (0.9 + 0.1 * (k0 * 5)), X = rd(S2[0]), Y = rd(S2[1]), col = [C.white, C.cream, C.gelb, C.orange][f], lvv = [16, 13, 9, 5][f];
        m.setZ(0);
        for (let yy = -Math.ceil(R0); yy <= Math.ceil(R0); yy++) for (let xx = -Math.ceil(R0); xx <= Math.ceil(R0); xx++) { const d = hyp(xx, yy) / R0; if (d > 1) continue; m.pd(X + xx, Y + yy, col, lvv * (1 - d * 0.55)); }
        const Lr = [26, 19, 12, 7][f] * (1 + 0.15 * pi);
        for (let i = 0; i < 8; i++) { const a = i * PI / 4 + (f ? 0.2 : 0), l = (i & 1) ? Lr * 0.62 : Lr; m.linie(X, Y, X + Math.cos(a) * l, Y + Math.sin(a) * l * 0.9, (f === 0 && !(i & 1)) ? 2 : 1, f < 2 ? C.white : C.gelb, 16); }
        // große Weiß-Dither-Haube über dem Aufprallbereich (Bildschirmblitz)
        const RB = (34 + 8 * pi) * (f === 0 ? 1 : 0.8), lb = f === 0 ? 5 : f === 1 ? 3 : f === 2 ? 1.5 : 0;
        if (lb > 0) { const RB2 = RB * RB; for (let yy = -RB; yy <= RB; yy++) for (let xx = -RB; xx <= RB; xx++) { const d2 = (xx * xx + yy * yy) / RB2; if (d2 > 1) continue; m.pd(X + xx, Y + yy, C.white, lb * (1 - d2)); } }
      }
      // Ochsenkopf: f 1–6 voll, 7–11 Bayer-Auflösung
      if (f >= 1 && f <= 11) {
        const lvO = f === 1 ? 11 : f <= 6 ? 16 : [12, 9, 6, 3, 1][f - 7], hx = S2[0], hy = S2[1] - 6 * P.HS * 0.5, jit = f === 1 ? 1 : 0;
        m.setZ(0); oxHead(m, hx + jit, hy, P.HS, lvO);
        // Dampf aus den Nüstern f 2–8
        if (f >= 2 && f <= 9) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
          const age = f - 2 - i * 2; if (age < 0 || age > 5) continue;
          const bx = hx + s * 2.7 * P.HS, by = hy + 6.4 * P.HS, X = rd(bx + s * (1 + age * 1.5)), Y = rd(by + 1 + age * 1.3 - (i & 1)), c = age < 3 ? C.white : C.grau;
          m.px(X, Y, c); if (age < 4) { m.px(X + s, Y, c); m.pd(X, Y + 1, c, 9); }
        }
        if (f >= 7) drawSparks(m, hx, hy, P.seed * 11, mx(8, rd(16 * n)), f - 7, 6, 1.2, 3.2, [C.horn3, C.fur3, C.gelb], 0.0);
      }
    }
  };

  /** Trockenlauf der Zeichenroutinen (Leerlauf): wärmt Code, Wertetabellen und die Ochsenkopf-Zellenlisten (alle drei Größen), damit der erste Kopfstoß nicht im kalten Code startet. */
  FX.trocken = () => {
    FX.init();
    for (const hs of [1.1, 1.3, 1.5]) headCells(hs);
    const gw = 360, gh = 300, buf = new Uint8ClampedArray(gw * gh * 4), tq = new Float32Array(gw * gh), m = maler(buf, gw, gh, tq, 0, 0);
    const cam = { proj: (x, y, v) => [180 + x * 0.2, 200 + y * 0.17 - v * 0.2, 0.2], cosT: 0.87 }, hook = { pile: () => {}, ghost: () => {}, attacker: () => {} };
    for (const kind of ['hero', 'card']) for (const pow of [1, 3]) {
      const P = FX.plan({ att: { x: -250, y: 120, hu: 150, w: 120 }, tgt: { x: 0, y: -90, hu: kind === 'hero' ? 150 : 0, kind, wb: 120 }, pow, n: 1, phone: false, seed: 5 + pow });
      for (let f = DASH0; f < LEN; f += 3) { buf.fill(0); FX.draw(m, f, P, cam, hook); }
    }
  };
  root.PpFx62 = FX;
})(window);

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  SPIEL-HÜLLE: Brettabbildung (Homografie aus den Zonen), Leinwand in der Weltschicht, Takt, Anwender + Ziel auf der Leinwand (Held-Sprite zellenweise / Kartenviereck), Shake, Aufräumen, Rückfall
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX62_TAKT = 1000 / 30;

/** Rückfall auf die alte Fassung: Animationen aus, Retro, Test-Schalter, reduzierte Bewegung, keine Palette. */
function ppFx62Rueckfall() {
  try {
    if (window.__ppFx62Aus || window.__ppFxAlt || window._playAnimations === false || window.PP_RETRO || typeof window.ppSnapRgb !== 'function' || !window.PpFx57 || !window.PpFx62) return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { /* weiter */ }
  return false;
}
window.ppFx62Rueckfall = ppFx62Rueckfall;

/**
 * Vorprüfung im Ereignis (app-board.jsx `onZoneAnim`): geht der neue Kopfstoß mit diesem Anwender (`vEl`, Heldenzone) und diesem Ziel (`tEl`, Held- oder Support-Zone)? Gibt null zurück, wenn ja, sonst den Grund.
 * Dann spielt der Client die alte Kombination (Ramm-Anlauf + Explosion + Ochsen-Symbol) selbst. Prüft billig (kein Homografie-Aufbau); scheitert die Geometrie später doch, zeigt die Hülle den alten Einschlag.
 */
function ppFx62Pruefe(vEl, tEl) {
  try {
    if (ppFx62Rueckfall()) return 'Rückfall (Animationen aus / Retro / reduzierte Bewegung / Schalter)';
    if (!vEl || !tEl || !vEl.isConnected || !tEl.isConnected) return 'Zone fehlt';
    if (!document.querySelector('.board-plane')) return 'keine Brettebene';
    if (typeof ppFx60Homografie !== 'function' || typeof ppFx60Layout !== 'function' || typeof ppFx59Figur !== 'function' || typeof ppFx57SheetPixel !== 'function') return 'Bausteine fehlen';
    if (!(window.ppFx27KannFigur && window.ppFx27KannFigur(vEl))) return 'Quelle ohne fahrbereite Figur (tot / versteinert / unsichtbar / eingefroren)';
    if (!ppFx59Figur(vEl)) return 'Quelle ohne Sprite';
  } catch (e) { return 'Fehler ' + e.message; }
  return null;
}
window.ppFx62Pruefe = ppFx62Pruefe;

/** Geometrie nicht möglich: Grund merken (Tests: `window.__ppFx62Grund`), Rückfall auf den alten Einschlag. */
function ppFx62Fehl(g) { window.__ppFx62Grund = g; return null; }

/** Zeilen des Ruhebilds (Bild 0 des Sheets, Alpha ≥ 160): Heldenhöhe im Ruhebild in Sprite-Pixeln (nicht über alle Frames gemessen), einmal je Sheet. */
function ppFx62Ruhe(eintrag, px) {
  if (eintrag._pp62) return eintrag._pp62;
  let i0 = px.fh, i1 = 0;
  try {
    for (let y = 0; y < px.fh; y++) for (let x = 0; x < px.fw; x++) if (px.d[(y * px.w + x) * 4 + 3] >= 160) { if (y + 1 > i1) i1 = y + 1; if (y < i0) i0 = y; }
  } catch (e) { /* Standard */ }
  eintrag._pp62 = i1 > i0 ? { y0: i0, y1: i1, h: i1 - i0 } : { y0: px.y0, y1: px.fh, h: px.fh - px.y0 };
  return eintrag._pp62;
}

/**
 * Sprite zellenweise (Nächster Nachbar) auf das Raster: `d` = { px (Sheet-Pixel), y1 (Fußzeile), faceXs (Abstand Sprite-Linkskante → Fußpunkt in Sprite-Pixeln) }, `fr` Bild des Sheets,
 * `foot` [Zelle x, Zelle y] = Fußpunkt, `scale` = Zellen je Sprite-Pixel, `o` = { sx, sy (Streckung um die Fußlinie), flip (senkrecht gespiegelt: Zeilenreihenfolge umgekehrt), lean (Zeilenversatz, Neigung), dx, dy }.
 * Ruft `fn(X, Y, r, g, b)` je gedeckter Zelle.
 */
function ppFx62Figur(d, fr, foot, scale, o, gw, gh, fn) {
  const s = d.px, fw = s.fw, y1 = d.y1, f0 = Math.max(0, Math.min(fr | 0, (d.nF || 1) - 1)), sx0 = s.vert ? 0 : f0 * fw, sy0 = s.vert ? f0 * s.fh : 0;
  const sxs = scale * (o.sx || 1), sy = o.sy || 1, flip = !!o.flip, hC = y1 * scale * sy, lean = o.lean || 0;
  const left = foot[0] - d.faceXs * sxs + (o.dx || 0), footY = foot[1] + (o.dy || 0);
  const r0 = Math.max(0, Math.floor(footY - hC)), r1 = Math.min(gh - 1, Math.ceil(footY) - 1);
  for (let Y = r0; Y <= r1; Y++) {
    const t = (footY - (Y + 0.5)) / hC; if (t < 0 || t >= 1) continue;
    const srow = flip ? Math.floor(t * y1) : Math.floor((1 - t) * y1); if (srow < 0 || srow >= y1) continue;
    const shift = Math.round(flip ? -lean * hC * t : lean * hC * t), rowBase = (sy0 + srow) * s.w + sx0;
    for (let X = Math.max(0, Math.floor(left + shift)); X <= Math.min(gw - 1, Math.ceil(left + shift + fw * sxs)); X++) {
      const sc = Math.floor((X + 0.5 - left - shift) / sxs); if (sc < 0 || sc >= fw) continue;
      const i = (rowBase + sc) * 4; if (s.d[i + 3] < 128) continue;
      fn(X, Y, s.d[i], s.d[i + 1], s.d[i + 2]);
    }
  }
}

/**
 * Geometrie einmal beim Start (kein Layout im Takt): Homografie aus allen Zonen, Maß der Brett-Einheit u (ein Sprite-Pixel des Ziels = 4,84 u), Leinwandrechteck um alle Schlüsselpunkte (Anwender-Bahn, Ziel, Ringe),
 * Zelle = Hero-Pixel, Fußpunkte von Ziel und Anwender in Einheiten, Plan. Gibt null zurück, wenn etwas fehlt (dann läuft der alte Einschlag).
 */
function ppFx62Geometrie(props) {
  try {
    const FX = window.PpFx62; FX.init();
    const { x, y, w, zoneEl, vonEl } = props;
    const plane = document.querySelector('.board-plane');
    if (!plane || !zoneEl || !zoneEl.isConnected || !vonEl || !vonEl.isConnected) return ppFx62Fehl(1);
    if (typeof ppFx60Homografie !== 'function' || typeof ppFx60Layout !== 'function' || typeof ppFx59Figur !== 'function') return ppFx62Fehl(2);
    const phone = !!(window.ppIsPhone && window.ppIsPhone());
    const zr = zoneEl.getBoundingClientRect(), zcx = zr.left + zr.width / 2, zcy = zr.top + zr.height / 2;
    const ox = x - zcx, oy = y - zcy;                                                                       // Versatz Fenster → Welt (Scrollstand)
    const refs = [];
    document.querySelectorAll('[data-hero-zone],[data-support-zone],[data-ability-zone]').forEach((e) => {
      const l = ppFx60Layout(e, plane), r = e.getBoundingClientRect();
      if (l && r.width > 0) refs.push([l.x, l.y, r.left + r.width / 2, r.top + r.height / 2]);
    });
    if (refs.length < 8) return ppFx62Fehl(3);
    const Hm = ppFx60Homografie(refs); if (!Hm || !(Hm.rms < 6)) return ppFx62Fehl(4);
    let Xc = 0, Ym = 0; for (const r of refs) { Xc += r[0]; Ym += r[1]; } Xc /= refs.length; Ym /= refs.length;
    // Ziel: Held mit Sprite (Fußlinie der Figur) oder Karte/Slot (Viereck); Anwender: Held mit Sprite
    const tFig = ppFx59Figur(zoneEl), kind = tFig ? 'hero' : 'card', vFig = ppFx59Figur(vonEl);
    if (!vFig) return ppFx62Fehl(6);
    const hp = ppFxHeldPixel(zoneEl, w), hpx = hp.px > 0 ? hp.px : 2.8125;
    const zl = ppFx60Layout(zoneEl, plane); if (!zl) return ppFx62Fehl(5);
    const pa = Hm.f(zl.x, zl.y), pb = Hm.f(zl.x + 1, zl.y), pxPerL = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1;
    const R = 4.84 * pxPerL / hpx;                                                                          // Einheiten je Layout-Pixel: ein Sprite-Pixel = 4,84 u
    const toW = (sx, sy) => { const L = Hm.inv(sx, sy); return [(L[0] - Xc) * R, (L[1] - Ym) * R]; };       // Fensterpunkt (Bodenebene) → Einheiten
    let T, hu = 0, wb = 120, hb = 168, karte = null, quadW = null;
    if (tFig) {
      const cr = tFig.hp.cv.getBoundingClientRect();
      T = toW(zcx, cr.top + tFig.y1 * tFig.hp.px); hu = ppFx62Ruhe(tFig.hp.eintrag, tFig.px).h * 4.84;
    } else {
      karte = zoneEl.querySelector('.board-card');
      const l = ppFx60Layout(karte || zoneEl, plane) || zl;
      T = [(l.x - Xc) * R, (l.y - Ym) * R]; wb = l.w * R; hb = l.h * R; quadW = l;
    }
    // Anwender: Fußpunkt (Zonenmitte, Fußlinie der ruhenden Figur), Ruhehöhe, Zonenbreite
    const vr = vonEl.getBoundingClientRect(), vcr = vFig.hp.cv.getBoundingClientRect();
    const A = toW(vr.left + vr.width / 2, vcr.top + vFig.y1 * vFig.hp.px);
    const ruheA = ppFx62Ruhe(vFig.hp.eintrag, vFig.px), huA = ruheA.h * 4.84;
    const vl = ppFx60Layout(vonEl, plane), zw = vl ? vl.w * R : 120;
    const nF = (window.ppFxN ? window.ppFxN(100) / 100 : 1) * (phone ? 0.5 : 1);
    const P = FX.plan({ att: { x: A[0], y: A[1], hu: huA, w: zw }, tgt: { x: T[0], y: T[1], hu, kind, wb }, pow: props.pow || 1, n: nF, phone, seed: Math.floor(Math.random() * 1e6) });
    // Leinwandrechteck (Weltpixel) um alle Schlüsselpunkte samt Rand (0,9 Zielhöhen + 12 Zellen), dann Zelle (gedeckelt)
    const S0 = ppFxZelleFuer({ zelleS: props.zelleS, zoneEl, w, x, y });
    const wpx = (px2, py2, v) => { const X = Xc + px2 / R, Y = Ym + py2 / R, a = Hm.f(X, Y), b = Hm.f(X + 1, Y), k = Math.hypot(b[0] - a[0], b[1] - a[1]) / R; return [a[0] + ox, a[1] + oy - v * k, k]; };
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (const q of P.keyPts) { const c = wpx(q[0], q[1], q[2]), mg = 0.9 * P.hu * c[2] + 12 * S0; bx0 = Math.min(bx0, c[0] - mg); bx1 = Math.max(bx1, c[0] + mg); by0 = Math.min(by0, c[1] - mg); by1 = Math.max(by1, c[1] + mg); }
    if (tFig) { const cr = tFig.hp.cv.getBoundingClientRect(); bx0 = Math.min(bx0, cr.left + ox - 6 * S0); bx1 = Math.max(bx1, cr.right + ox + 6 * S0); by0 = Math.min(by0, cr.top + oy - 6 * S0); by1 = Math.max(by1, cr.bottom + oy + 6 * S0); }
    const S = ppFxZelleGedeckelt({ zelleS: props.zelleS, zoneEl, w, x, y }, { breite: bx1 - bx0, hoehe: by1 - by0 });
    const lx = Math.round(bx0), ly = Math.round(by0);
    const gw = Math.min(900, Math.ceil((bx1 - bx0) / S)), gh = Math.min(700, Math.ceil((by1 - by0) / S));
    const cell = (sx, sy) => [(sx + ox - lx) / S, (sy + oy - ly) / S];
    const proj = (px2, py2, v) => {                                                                         // Einheiten (x, y, Höhe v) → [Zelle x, Zelle y, Zellen je Einheit]
      const X = Xc + px2 / R, Y = Ym + py2 / R, a = Hm.f(X, Y), b = Hm.f(X + 1, Y), k = Math.hypot(b[0] - a[0], b[1] - a[1]) / R / S, c = cell(a[0], a[1]);
      return [c[0], c[1] - v * k, k];
    };
    // Neigung des Bretts (Verhältnis senkrecht/waagerecht) für flache Ellipsen (Schatten, Bodenblitz); flaches Handy-Brett → 1
    const q0 = Hm.f(Xc, Ym), qx = Hm.f(Xc + 1, Ym), qy = Hm.f(Xc, Ym + 1), cosT = Math.max(0.3, Math.min(1, Math.hypot(qy[0] - q0[0], qy[1] - q0[1]) / (Math.hypot(qx[0] - q0[0], qx[1] - q0[1]) || 1)));
    // Quadviereck der Karte (Zellen)
    let quad = null;
    if (quadW) { const pt = (dx, dy) => { const p = Hm.f(quadW.x + dx, quadW.y + dy); return cell(p[0], p[1]); }; quad = { tl: pt(-quadW.w / 2, -quadW.h / 2), tr: pt(quadW.w / 2, -quadW.h / 2), bl: pt(-quadW.w / 2, quadW.h / 2), br: pt(quadW.w / 2, quadW.h / 2) }; }
    return { S, P, FX, lx, ly, gw, gh, ox, oy, zr, tFig, vFig, karte, quad, kind, phone, Hm, cell, proj, toW, cosT, A, zcx, R };
  } catch (e) { try { console.warn('[OxHeadbutt]', e); } catch (e2) { /* weg */ } return ppFx62Fehl('Fehler ' + e.message); }
}

/** Figur im Platz verstecken (mit Zähler: überlappende Animationen stellen den ursprünglichen Wert erst beim letzten Zeigen wieder her). */
function ppFx62Weg(p) { if (!p) return; if (!p._pp62N) p._pp62Vis = p.style.visibility; p._pp62N = (p._pp62N || 0) + 1; p.style.visibility = 'hidden'; }
function ppFx62Da(p) { if (!p || !p._pp62N) return; p._pp62N--; if (!p._pp62N) p.style.visibility = p._pp62Vis || ''; }

function PpFx62Leinwand({ geo, zoneEl, vonEl }) {
  const cvs = useRef(null);
  const wurzelRef = useRef(null);
  useEffect(() => {
    const el = cvs.current, FX = geo.FX;
    if (!el) return undefined;
    const mess1 = window.__ppFx62Messen ? performance.now() : 0;
    if (window.__ppFx62Messen) window.__ppFx62Gross = [geo.gw, geo.gh, geo.S];
    const { S, P, gw, gh, tFig, vFig, karte, quad, phone, proj, cell, toW, ox, oy, cosT } = geo;
    const ctx = el.getContext('2d'), img = ctx.createImageData(gw, gh), buf = img.data, tq = new Float32Array(gw * gh);
    const m = FX.maler(buf, gw, gh, tq, 0, 0);
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const BAY = window.PpFx57.BAY, snapA = window.PpFx57.snap, C = FX.C;
    const ruhig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const shakeAn = !phone && !ruhig && !window.__ppFx62KeinShake;
    const board = shakeAn ? document.querySelector('.board-center') : null;
    const wurzel = wurzelRef.current;
    // Figurbeschreibung: Sprite, Heimmaß (Zellen je Sprite-Pixel), Fußpunkt (Zelle), Abstand Linkskante → Fuß in Sprite-Pixeln
    const beschreibe = (fg, e) => {
      const r = fg.hp.cv.getBoundingClientRect(), z = e.getBoundingClientRect(), c0 = cell(r.left, r.top), ft = cell(z.left + z.width / 2, r.top + fg.y1 * fg.hp.px), cps = fg.hp.px / S;
      return { px: fg.px, y1: fg.y1, cps, faceXs: (ft[0] - c0[0]) / cps, foot: ft, nF: Math.max(1, (fg.hp.eintrag.meta.frames | 0)) };
    };
    // Tiefenmaske der stehenden Helden (außer dem Anwender): Tiefe 1000 − y (Einheiten)
    try {
      document.querySelectorAll('[data-hero-zone]').forEach((z) => {
        if (z === vonEl) return;
        const fg = ppFx59Figur(z); if (!fg) return;
        const cr = fg.hp.cv.getBoundingClientRect(), zr2 = z.getBoundingClientRect();
        if (cr.right + ox < geo.lx || cr.left + ox > geo.lx + gw * S || cr.bottom + oy < geo.ly || cr.top + oy > geo.ly + gh * S) return;
        const d = beschreibe(fg, z), qd = 1000 - toW(zr2.left + zr2.width / 2, cr.top + fg.y1 * fg.hp.px)[1], fr0 = fg.hp.platz._ppFrame | 0;
        ppFx62Figur(d, fr0, d.foot, d.cps, { sx: 1, sy: 1 }, gw, gh, (X, Y) => { const k = Y * gw + X, t = tq[k]; if (t === 0 || qd < t) tq[k] = qd; });
      });
    } catch (e) { /* ohne Maske: Teilchen liegen dann über Figuren (nur Optik) */ }
    const dA = beschreibe(vFig, vonEl), dT = tFig ? beschreibe(tFig, zoneEl) : null;
    const kA = proj(geo.A[0], geo.A[1], 0)[2];                                                              // Brett-Maßstab am Heimplatz des Anwenders
    let platzV = vFig.hp.platz, platzT = tFig ? tFig.hp.platz : null, totV = false, totT = false, wegV = false, wegT = false, cardKey = '';
    // Anwender: Figur an einer Brett-Stelle (Einheiten x, y, Höhe v); Maßstab = Heimmaß · Brett-Maßstab(x, y) / Brett-Maßstab(Heimplatz); Fuß auf ganze Zellen
    const zeichneAnwender = (mm, d, ghost) => {
      const g = proj(P.A[0] + d.dx, P.A[1] + d.dy, d.dv || 0), k = proj(P.A[0] + d.dx, P.A[1] + d.dy, 0)[2], sc = dA.cps * k / kA;
      ppFx62Figur(dA, platzV._ppFrame | 0, [Math.round(g[0]), Math.round(g[1])], sc, { sx: d.sx, sy: d.sy, flip: d.flip, lean: d.lean }, gw, gh, ghost
        ? (X, Y) => { if (((X + Y + ghost.phase) & 1) === 0) return; mm.px(X, Y, ghost.col); }
        : (X, Y, r, gg, b) => mm.px(X, Y, [r, gg, b]));
    };
    const hook = {
      ghost: (mm, g, z) => { if (totV) return; mm.setZ(z + 0.5); zeichneAnwender(mm, g, g); },
      attacker: (mm, d, z) => { if (totV) return; mm.setZ(z); zeichneAnwender(mm, d, null); },
      pile: (mm, pose) => {
        if (dT) {
          if (totT || !platzT) return;
          ppFx62Figur(dT, platzT._ppFrame | 0, dT.foot, dT.cps, { sx: pose.sx, sy: pose.sy, dx: pose.dxc, dy: pose.dyc }, gw, gh, (X, Y, r, g, b) => {
            let col;
            if (pose.flash === 1) col = C.white; else if (pose.flash === 2 && BAY[Y & 3][X & 3] < 12) col = C.cream; else if (pose.flash === 3 && BAY[Y & 3][X & 3] < 6) col = C.cream; else col = [r, g, b];
            mm.px(X, Y, col);
          });
        } else if (quad) {
          const dx = pose.dxc || 0, dy = pose.dyc || 0, yA = Math.floor(Math.min(quad.tl[1], quad.tr[1])), yB = Math.ceil(Math.max(quad.bl[1], quad.br[1]));
          if (!pose.flash) return;
          for (let Y = Math.max(0, yA); Y < Math.min(gh, yB); Y++) {
            const t = Math.max(0, Math.min(1, (Y + 0.5 - quad.tl[1]) / (quad.bl[1] - quad.tl[1]))), a = quad.tl[0] + (quad.bl[0] - quad.tl[0]) * t, b = quad.tr[0] + (quad.br[0] - quad.tr[0]) * t;
            for (let X = Math.max(0, Math.round(a)); X < Math.min(gw, Math.round(b)); X++) {
              const X2 = X + dx, Y2 = Y + dy; if (X2 < 0 || Y2 < 0 || X2 >= gw || Y2 >= gh) continue;
              if (pose.flash === 1) mm.px(X2, Y2, C.white); else if (pose.flash === 2) { if (BAY[Y & 3][X & 3] < 11) mm.px(X2, Y2, C.cream); } else if (pose.flash === 3 && BAY[Y & 3][X & 3] < 6) mm.px(X2, Y2, C.cream);
            }
          }
        }
      },
    };
    const cam = { proj, cosT };
    // DOM-Seite: Karte ruckeln (ganze Zellen), Figuren ausblenden solange sie im Raster gemalt werden, Brett schütteln
    const alt = { kTr: karte ? karte.style.transform : '', tr: board ? board.style.translate : '' };
    let kx = 1, ky = 1; if (karte) { const kr = karte.getBoundingClientRect(); if (kr.width > 0) kx = karte.offsetWidth / kr.width; if (kr.height > 0) ky = karte.offsetHeight / kr.height; }
    if (mess1) (window.__ppFx62Zeiten || (window.__ppFx62Zeiten = [])).push([-101, +(performance.now() - mess1).toFixed(3)]);
    const t0 = performance.now();
    if (window.__ppFx62Messen) window.__ppFx62T0 = t0;
    let raf = 0, letzte = -1e9, ende = false, key = '';
    const zuruecksetzen = () => {
      try {
        if (wegV) { wegV = false; ppFx62Da(platzV); }
        if (wegT) { wegT = false; ppFx62Da(platzT); }
        if (karte) karte.style.transform = alt.kTr; if (board) board.style.translate = alt.tr;
      } catch (e) { /* weg */ }
    };
    const aufraeumen = () => { if (ende) return; ende = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } zuruecksetzen(); try { ctx.clearRect(0, 0, gw, gh); } catch (e) { /* weg */ } };
    const total = (FX.LEN - FX.DASH0 + 1) * PP_FX62_TAKT;
    const schritt = (jetzt) => {
      if (ende) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = Math.max(0, jetzt - t0);
      if (ms >= total) { aufraeumen(); return; }
      const fr = Math.floor(jetzt / PP_FX62_TAKT);
      if (fr !== letzte) {
        letzte = fr;
        const mess = window.__ppFx62Messen ? performance.now() : 0;
        const f = Math.min(FX.LEN - 1, Math.floor(ms / PP_FX62_TAKT + 1e-4) + FX.DASH0);
        // Figuren: neue Figur im Zonenplatz (Wiederbelebung/Neuaufbau) bzw. Tod (Zerfall läuft dann selbst) — ab da nicht mehr in die Leinwand malen
        { const cur = vonEl._ppFigurPlatz; if (cur && cur !== platzV && cur.isConnected) { if (wegV) { wegV = false; ppFx62Da(platzV); } platzV = cur; key = ''; } if (platzV && (platzV._ppFx32Tot || !platzV.isConnected)) totV = true; }
        if (tFig) { const cur = zoneEl._ppFigurPlatz; if (cur && cur !== platzT && cur.isConnected) { if (wegT) { wegT = false; ppFx62Da(platzT); } platzT = cur; key = ''; } if (platzT && (platzT._ppFx32Tot || !platzT.isConnected)) totT = true; }
        buf.fill(0);
        const pose = FX.pose(f, P), D = FX.dash(f, P);
        FX.draw(m, f, P, cam, hook);
        const mess2 = mess ? performance.now() : 0;
        ctx.putImageData(img, 0, 0);
        if (mess) (window.__ppFx62Zeiten || (window.__ppFx62Zeiten = [])).push([f + 1000, +(mess2 - mess).toFixed(3)]);   // nur Zeichnen (ohne putImageData/DOM); Bild + 1000
        const sh = FX.shake(f, P), sxp = Math.round(sh[0] * S), syp = Math.round(sh[1] * S);
        const aV = D.active && !totV, aT = pose.active && !totT, kbx = P.kbx || 0, kby = P.kby || 0;
        const k2 = (aV ? 'v' : 'p') + (aT ? 't' : 'p') + '|' + kbx + '|' + kby + '|' + sxp + '|' + syp;
        if (k2 !== key) {
          key = k2;
          if (platzV && aV !== wegV) { wegV = aV; if (aV) ppFx62Weg(platzV); else ppFx62Da(platzV); }
          if (platzT && aT !== wegT) { wegT = aT; if (aT) ppFx62Weg(platzT); else ppFx62Da(platzT); }
          if (karte) karte.style.transform = (kbx || kby) ? `translate(${(kbx * S * kx).toFixed(2)}px, ${(kby * S * ky).toFixed(2)}px)` : alt.kTr;
          if (board) board.style.translate = (sxp || syp) ? `${sxp}px ${syp}px` : alt.tr;
          if (wurzel) wurzel.style.translate = (sxp || syp) && board ? `${sxp}px ${syp}px` : '';
        }
        if (mess) (window.__ppFx62Zeiten || (window.__ppFx62Zeiten = [])).push([f, +(performance.now() - mess).toFixed(3)]);
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    const netz = setTimeout(aufraeumen, total + 2500);                                                      // Notnagel (Tab im Hintergrund: rAF ruht)
    return () => { clearTimeout(netz); aufraeumen(); };
  }, []);
  return (
    <div ref={wurzelRef} aria-hidden="true" data-pp-px="aus" style={{ position: 'fixed', left: geo.lx, top: geo.ly, pointerEvents: 'none', zIndex: 10100 }}>
      <canvas ref={cvs} width={geo.gw} height={geo.gh} style={{ width: geo.gw * geo.S, height: geo.gh * geo.S, imageRendering: 'pixelated', display: 'block' }} />
    </div>
  );
}

/** Spätrückfall (Geometrie scheitert erst beim Einhängen): der alte Einschlag (Explosion + Ochsen-Symbol) am Ziel — der Ramm-Anlauf fehlt dann. */
function PpFx62Alt(props) {
  const Ex = ANIM_REGISTRY.explosion, Ox = ANIM_REGISTRY.ox_impact;
  return (<>{Ex ? <Ex {...props} /> : null}{Ox ? <Ox {...props} /> : null}</>);
}

/** Registry-Komponente: neuer Kopfstoß oder (Spätrückfall) der alte Einschlag. Ohne Ziel-Element (Vorwärmen) wird nichts gezeichnet. */
function PpFx62Effekt(props) {
  const geo = useMemo(() => {
    if (props.prewarm || !(props.zoneEl && props.zoneEl.isConnected)) { window.__ppFx62Grund = props.prewarm ? 'Vorwärmen' : 'kein Ziel-Element'; return null; }
    if (ppFx62Rueckfall()) { window.__ppFx62Grund = 'Rückfall (Animationen aus / Retro / reduzierte Bewegung / Schalter)'; return null; }
    if (!props.vonEl) { window.__ppFx62Grund = 'keine Quelle'; return null; }
    const mess = window.__ppFx62Messen ? performance.now() : 0;
    const g = ppFx62Geometrie(props);
    if (mess) (window.__ppFx62Zeiten || (window.__ppFx62Zeiten = [])).push([-100, +(performance.now() - mess).toFixed(3)]);
    return g;
  }, []);
  if (props.prewarm) return null;
  if (!geo) return <PpFx62Alt {...props} />;
  return <PpFx62Leinwand geo={geo} zoneEl={props.zoneEl} vonEl={props.vonEl} />;
}
if (typeof ANIM_REGISTRY !== 'undefined') ANIM_REGISTRY.ox_headbutt = PpFx62Effekt;

// Aufwärmen im Leerlauf: Trockenlauf der Zeichenroutinen (Held und Karte, Stärke 1 und 3) samt Ochsenkopf-Zellenlisten, damit der erste Kopfstoß nicht im kalten Code startet.
(function ppFx62Aufwaermen() {
  const los = () => {
    try {
      if (ppFx62Rueckfall() || window.__ppFx62KeinAufwaermen) return;
      const ric = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      ric(() => { try { window.PpFx62.trocken(); } catch (e) { /* weg */ } }, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 6000 }) : los()), 7000);
})();
