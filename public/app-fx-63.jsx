// app-fx-63: Ferocious Tiger Kick — „Tigertritt“: der Held dasht ans Ziel und tritt zu, ein brüllender Tigerkopf steht über dem Ziel, drei Krallenstreifen reißen, drei Sterne kreisen um das betäubte Ziel (Pixelart-Leinwand, Zelle = Hero-Pixel)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: abgesegneter Prototyp „Ferocious Tiger Kick v4“ (Zeichenroutinen `PpFx63`, auf den Rasterpinseln von `PpFx57` aufgebaut: Hash / Bayer / Palette; Dust-/Ring-/Funken-Bausteine aus dem Prototyp-Satz „OT“).
//  Alles ist eine reine Funktion des Bildes f (30 Hz, 34 Bilder ≈ 1,13 s, Bild 33 leer), gezeichnet in Rasterzellen auf EINER Leinwand um das Ziel: feste Palettenfarben (`ppSnapRgb`), Bayer-Dither statt Alpha, nichts gedreht/weich skaliert.
//  DER DASH gehört NICHT hierher: der Angreifer rast mit der vorhandenen Ramm-Figur (`play_ram_animation`, `durch: false`, Standard-Nachbilder, app-fx-27.jsx) BIS ZUM Ziel; Bild 0 dieser Leinwand ist der KONTAKT.
//  Die Engine schickt `play_zone_animation { type: 'tiger_kick', von }` unmittelbar nach dem Ramm-Ereignis (Mount-Vorlauf ≈ Weg bis zum Kontakt). Im Kontakt streckt sich der Angreifer in Bild 1–2 (1,2 × 0,96; `F.kick` in app-fx-27).
//  ABLAUF (Bild nach Kontakt, 30/s):
//    −1…1   Geschwindigkeitslinien vom Angreifer zum Kontakt (3 kurze, nur Bild 0–1 sichtbar: die Leinwand beginnt bei Bild 0), Weiß-Gelb-Dither-SCHLAGSTERN mit 8 Strahlen am Kontaktpunkt (0–3), Funken, 2 Boden-Ringe (0–6, 2–8), Staub
//    0–3    QUETSCHEN  Ziel 1,22 × 0,78 (Held: Sprite zellenweise auf der Leinwand, Karte nur verschoben/weiß geblitzt), fliegt 2 Zellen zurück (0–3), Shake ≤ 2 Zellen (Desktop), danach benommenes Wackeln (10–21)
//    0–13   TIGERKOPF  21 × 23–25 Zellen (handgesetztes Sprite, Zustände Maul zu/halb/auf), steht DIREKT ÜBER dem Kopf des Ziels (Unterkante 2 Zellen über dem Heldenkopf, bei Karten über der Kartenoberkante); Bild 0 zu 75 % (Bayer),
//           ab 1 voll, Bild 2 Maul voll auf = SCHADEN (Engine `_delay`), 3 zu (Schnappen), 4–8 brüllt (Atem-Pixel an den Mundwinkeln 4–10, 1 Zelle Wackler 5–8, Handy aus), 9–13 Bayer-Zerfall + Funken.
//           Ist oben kein Platz (Kopf-Oberkante < 16 Zellen vom Fensterrand), rutscht er seitlich neben den Kopf des Ziels (`window.__ppFx63Kopfpos = 'seite'` erzwingt das, nur Tests).
//           HUD: Der Kopf ist reine Effekt-Leinwand (z-index 10100) und verändert nichts am HUD; Zahlen (`.damage-number`, 10200) und Karten-/Brett-DOM bleiben davor bzw. darunter, wie bei allen Effekt-Leinwänden.
//    2–4    KRALLEN  3 schmale diagonale Schlitze (dunkler 1-Zellen-Kern, weiß-gelbe Kante) bei Bild 2/3/4, verblassen per Bayer ab 5/6/7
//    12–     STERNE  nicht mehr hier: der Stun-Status zeigt die kreisenden 7×7-Sterne (app-fx-64) ab Bild 12, solange der Stun aktiv ist (Engine setzt Stun bei Bild 12; bei Immunität keine Sterne)
//  BRETTABBILDUNG: Homografie Brettebene → Fenster aus den Mitten aller Zonen (`ppFx60Homografie`, app-fx-60); Einheit u des Prototyps: ein Sprite-Pixel = 4,84 u. Tiefenmaske: stehende Helden (außer dem Ziel) mit Tiefe 1000 − y.
//  PIXELGRÖSSE: Rasterzelle S = Hero-Pixel der Zielreihe (`ppFxZelleGedeckelt`, Regel in app-fx-57). Handy: Teilchen 50 %, kein Shake/Kopfwackler.
//  Rückfall (Animationen aus, Retro, `__ppFxAlt`, reduzierte Bewegung, `window.__ppFx63Aus`, fehlende Quelle/Zone/Homografie): die alte Fassung `explosion` + `tiger_impact` am Ziel.
//  Klang: `ZONE_ANIM_SFX.tiger_kick` (app-shared.jsx, gestaffelt; `attack_ram` kommt vom Dash). Aufwärmen (Trockenlauf der Zeichenroutinen, Kopf-Zellenlisten) im Leerlauf (`window.__ppFx63KeinAufwaermen` schaltet ab).
//  BLUT (`tiger_blood`, zweite Zonen-Animation am selben Ziel, `von` = Angreifer; nur beim 2. Angriff mit Heilung, die Engine sendet sie NACH dem Schaden): eigene Leinwand um Ziel UND Angreifer (z-index 10101), 26 Bilder — Blutfontäne am Treffer,
//  dicker Strahl im Bogen zum Mund des Angreifers (der ihn trinkt, roter Dither-Flash auf seiner Silhouette), Heilung der Engine bei Bild 19 (`BLUT_HEAL_MS` in ferocious-tiger-kick.js). Klang `ZONE_ANIM_SFX.tiger_blood`. Handy: halbe Teilchenzahl.
//  Rückfall (Animationen aus, Retro, reduzierte Bewegung, `__ppFx63Aus`, fehlende Quelle/Geometrie): KEIN Blut (die Heilung läuft trotzdem). Messung: `window.__ppFx63BlutZeiten` = [Bild, ms], `__ppFx63BlutT0`, `__ppFx63BlutGrund`.
//  Messung (nur Tests): `window.__ppFx63Messen = true` → `window.__ppFx63Zeiten` = [Bild, ms] (Bild −1 = Geometrie, −2 = Maske), `window.__ppFx63T0` = Startzeit (Bild 0) in performance.now().
// ═════════════════════════════════════════════════════════════════
(function (root) {
  let H = null, BAY = null, snapA = null;      // aus PpFx57 (app-fx-57: Hash, Bayer-Matrix, Palette), in `FX.init` gesetzt
  const FX = {};
  const rd = Math.round, fl = Math.floor, ab = Math.abs, mn = Math.min, mx = Math.max, sqrt = Math.sqrt, PI = Math.PI, hyp = Math.hypot;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const LEN = 34, DAMAGE_F = 2, STUN_F = 12; FX.LEN = LEN; FX.DAMAGE_F = DAMAGE_F; FX.STUN_F = STUN_F;
  let C = null;

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

  // ═════════ Tigerkopf: kleines 16-Bit-Icon-Sprite (21 Zellen breit), von Hand gesetzt; 1 Sprite-Zelle = 1 Spielzelle. Zustände: Maul zu / halb / ganz auf ═════════
  // Buchstaben → Palettentöne (TIGER_PAL; die beiden im Prototyp freien Töne S und H sind auf Palettentöne gesetzt). Kontur-Highlight oben links, Schatten unten rechts sind im Sprite enthalten.
  const TIGER_ROWS = {
    zu: [
      "..KKKK.........KKKK..",
      ".KHHHOK.......KLHHHK.",
      "KHLPPLOKKKKKKKLLPPLHK",
      "KHLPPLOHHHkHHHOLPPLOK",
      "KLOLOOHHLkkkLHHOOLOSK",
      "KDOOOOHLLLkLLLHOOOOSK",
      "KDOOkkLLkkkkkLLkkOOSK",
      "KLOSSkkSSOkOSSkkSSOSK",
      "KDSKKKKKKLOSKKKKKKLSK",
      "KkSKyGEYKLLSKYEGyKLkK",
      "KDkKyYEYKLLSKYEYyKkSK",
      "KLkOKKKKOOLOOKKKKLkSK",
      "KWDOLLLOKNNNKOLLLODWK",
      "KWwWDOSKNnnnNKLODWwWK",
      ".KWwWWWWKKnKKWWWWwWK.",
      "KKWWWKKKKKKKKKKKWWWKK",
      ".KKWKWFFFWWWFFFWKWKK.",
      "..KWKWWFfWWWfFWWKWK..",
      "..KKKWWWWWWWWWWWKKK..",
      "...KKWWWWWWWWWWWKK...",
      "....KWWWWWWWWWWWK....",
      ".....KWWWWWWWWWK.....",
      "......KKKKKKKKK......"
    ],
    halb: [
      "..KKKK.........KKKK..",
      ".KHHHOK.......KLHHHK.",
      "KHLPPLOKKKKKKKLLPPLHK",
      "KHLPPLOHHHkHHHOLPPLOK",
      "KLOLOOHHLkkkLHHOOLOSK",
      "KDOOOOHLLLkLLLHOOOOSK",
      "KDOOkkLLkkkkkLLkkOOSK",
      "KLOSSkkSSOkOSSkkSSOSK",
      "KDSKKKKKKLOSKKKKKKLSK",
      "KkSKyGEYKLLSKYEGyKLkK",
      "KDkKyYEYKLLSKYEYyKkSK",
      "KLkOKKKKOOLOOKKKKLkSK",
      "KWDOLLLOKNNNKOLLLODWK",
      "KWwWDOSKNnnnNKLODWwWK",
      ".KWwWWWWKKnKKWWWWwWK.",
      "KKWWWKKKKKKKKKKKWWWKK",
      ".KKWKrFFFfMfFFFrKWKK.",
      "..KWKRRFFfMfFFRRKWK..",
      "..KKKFRRFfMfFRRFKKK..",
      "...KKFFfKKKKKfFFKK...",
      "....KWWWWWWWWWWWK....",
      ".....KWWWWWWWWWK.....",
      "......KWWWWWWWK......",
      "......KKKKKKKKK......"
    ],
    auf: [
      "..KKKK.........KKKK..",
      ".KHHHOK.......KLHHHK.",
      "KHLPPLOKKKKKKKLLPPLHK",
      "KHLPPLOHHHkHHHOLPPLOK",
      "KLOLOOHHLkkkLHHOOLOSK",
      "KDOOOOHLLLkLLLHOOOOSK",
      "KDOOkkLLkkkkkLLkkOOSK",
      "KLOSSkkSSOkOSSkkSSOSK",
      "KDSKKKKKKLOSKKKKKKLSK",
      "KkSKyGEYKLLSKYEGyKLkK",
      "KDkKyYEYKLLSKYEYyKkSK",
      "KLkOKKKKOOLOOKKKKLkSK",
      "KWDOLLLOKNNNKOLLLODWK",
      "KWwWDOSKNnnnNKLODWwWK",
      ".KWwWWWWKKnKKWWWWwWK.",
      "KKWWWKKKKKKKKKKKWWWKK",
      ".KKWKrFFFfMfFFFrKWKK.",
      "..KWKRRFFfMfFFRRKWK..",
      "..KWKRRRFfMfFRRRKWK..",
      "..KKKFRRRFMFRRRFKKK..",
      "...KKFfRTTtTTRfFKK...",
      "...KKFFfTTtTTfFFKK...",
      "....KKKKKKKKKKKKK....",
      ".....KWWWWWWWWWK.....",
      "......KKKKKKKKK......"
    ]
  };
  const TIGER_PAL = { K: '#27180c', k: '#141414', S: '#aa5300', D: '#cf5f00', O: '#ff8b1a', L: '#f4ae64', H: '#e0c085', W: '#fffbd2', w: '#c5b7a0', P: '#e58092', p: '#e94e53', N: '#fe7476', n: '#ae264c', R: '#b62600', r: '#7a1900', M: '#311402', T: '#e58092', t: '#e94e53', F: '#ffffff', f: '#c5b7a0', Y: '#ffe23d', y: '#ff9a1a', E: '#141414', G: '#ffffff' };
  const HEADS = {};          // Zustand → { n, x: Int8Array, y: Int8Array, c: Array<[r, g, b]> } (Zellenlisten, im Leerlauf vorgebaut)
  const HW = TIGER_ROWS.auf.length >> 1, GR = TIGER_ROWS.auf[0].length;   // halbe Kopfhöhe (Mitte), Kopfbreite
  function headCells(state) {
    if (HEADS[state]) return HEADS[state];
    const rows = TIGER_ROWS[state], cx = rows[0].length >> 1, cy = HW, col = {}, xs = [], ys = [], cs = [];
    for (const k in TIGER_PAL) col[k] = snapA(TIGER_PAL[k]);
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) { const c = col[rows[y][x]]; if (c) { xs.push(x - cx); ys.push(y - cy); cs.push(c); } }
    return (HEADS[state] = { n: cs.length, x: Int8Array.from(xs), y: Int8Array.from(ys), c: cs });
  }
  function tigerHead(m, cx, cy, state, lv) { const h = headCells(state), X0 = rd(cx), Y0 = rd(cy); for (let i = 0; i < h.n; i++) m.pd(X0 + h.x[i], Y0 + h.y[i], h.c[i], lv); }
  // Sterne: handgezeichnet, 7×7 (Y gelb, y orange, W weiß)
  const STAR7 = ['...Y...', '..YWY..', 'YYYWYYy', '.YWWWy.', '..YYYy.', '.YYyYy.', '.Yy.yy.'];
  function star7(m, X, Y, lv) { for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) { const ch = STAR7[j][i]; if (ch === '.') continue; m.pd(X - 3 + i, Y - 3 + j, ch === 'Y' ? C.yel : ch === 'W' ? C.white : C.orange, lv); } }
  // Kralle: schmaler Schlitz — dunkler Kern (1 Zelle), weiß-gelbe Kante beidseits; von (x0,y0) nach (x1,y1), rev = Anteil sichtbar (Schweifung von der Spitze), lv = Dither
  function claw(m, x0, y0, x1, y1, rev, lv) {
    const L = hyp(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, ex = x0 + (x1 - x0) * rev, ey = y0 + (y1 - y0) * rev, px = -uy, py = ux, o = 1.25;
    m.linie(x0 + px * o + ux * 2, y0 + py * o + uy * 2, ex + px * o - ux * 2 * (rev > 0.9 ? 1 : 0), ey + py * o - uy * 2 * (rev > 0.9 ? 1 : 0), 1, C.cream, lv);
    m.linie(x0 - px * o + ux * 2, y0 - py * o + uy * 2, ex - px * o - ux * 2 * (rev > 0.9 ? 1 : 0), ey - py * o - uy * 2 * (rev > 0.9 ? 1 : 0), 1, C.yel, lv);
    m.linie(x0, y0, ex, ey, 1, C.ink, lv);
  }

  // ═════════ Bausteine: Boden-Ring, Staub, Funken, Geschwindigkeitslinien ═════════
  // Ring auf dem Boden (Radius R in Brett-Einheiten um (x, y)); half: 0 alle, −1 hintere Hälfte (Brett-y ≤ y), +1 vordere Hälfte; th Dicke in Zellen
  function ring(m, cam, x, y, R, th, col, lv, half) {
    if (R <= 0 || lv <= 0) return;
    const c0 = cam.proj(x, y, 0), n = mx(24, mn(160, rd(R * c0[2] * 3.4)));
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * 2 * PI, bx = x + Math.cos(a) * R, by = y + Math.sin(a) * R, p = cam.proj(bx, by, 0);
      if (prev) { const fr = (Math.sin(a) + Math.sin(prev.a)) >= 0; if (half === 0 || (half > 0) === fr) { m.setZ(1000 - by); m.linie(prev.p[0], prev.p[1], p[0], p[1], th, col, lv); } }
      prev = { p, a };
    }
  }
  function disc(m, X, Y, r, cols, lv) {   // gefüllte Scheibe mit 3-Ton-Schattierung (cols = [hell, mittel, dunkel])
    const ri = Math.ceil(r);
    for (let yy = -ri; yy <= ri; yy++) for (let xx = -ri; xx <= ri; xx++) {
      const d = hyp(xx, yy); if (d > r + 0.2) continue;
      const l = (-xx * 0.6 - yy * 0.8) / mx(1, r), c = l > 0.35 ? cols[0] : (l > -0.25 ? cols[1] : cols[2]);
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
      const u = t / d.life, rr = d.r0 + d.sp * (1 - Math.pow(1 - u, 2.2)), x = cx + Math.cos(d.a) * rr, y = cy + Math.sin(d.a) * rr, v = d.rise * sqrt(u) * 0.8 + 2;
      const c = cam.proj(x, y, v), size = d.size * (0.55 + 0.7 * mn(1, t / 5)) * mx(0.7, c[2] * 0.2 + 0.55) * (1 - 0.35 * u);
      const lv = u < 0.45 ? 16 : 16 * (1 - (u - 0.45) / 0.55);
      m.setZ(1000 - y); disc(m, rd(c[0]), rd(c[1]), size, tones[d.tone % tones.length], lv);
    }
  }
  // Funken: radiale Strahlen in Zellen um (X, Y); je Strahl Linie von p zurück
  function drawSparks(m, X, Y, seed, n, fe, life, vmin, vmax, cols) {
    m.setZ(0);
    for (let i = 0; i < n; i++) {
      const a = H(seed, i) * 2 * PI, v = lerp(vmin, vmax, H(seed + 1, i)), l = life * (0.55 + 0.45 * H(seed + 2, i)), t = fe - (H(seed + 3, i) * 1.5 | 0); if (t < 0 || t > l) continue;
      const d = v * (1 - Math.pow(1 - t / l, 2)) * l * 0.5, d0 = v * (1 - Math.pow(1 - mx(0, t - 1.2) / l, 2)) * l * 0.5;
      const px = X + Math.cos(a) * d, py = Y + Math.sin(a) * d * 0.9, qx = X + Math.cos(a) * d0, qy = Y + Math.sin(a) * d0 * 0.9;
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

  FX.init = () => {
    if (C) return;
    const B = root.PpFx57; B.ensure(); H = B.H; BAY = B.BAY; snapA = B.snap; C = {}; const s = snapA;
    C.white = [255, 255, 255]; C.cream = s('#fffbd2'); C.yel = s('#ffe23d'); C.orange = s('#ff9a1a'); C.orL = s('#ffd066'); C.tig1 = s('#ff8b1a'); C.tig2 = s('#f29a3e'); C.grau = s('#9aa3b6'); C.ink = s('#12101f');
    C.bl0 = s('#3a0000'); C.bl1 = s('#780000'); C.bl2 = s('#be0e0e'); C.bl3 = s('#ef2929'); C.bl4 = s('#ff6666'); C.bl5 = s('#fe7476');   // Blut: dunkel → hell (Palette)
    C.dust0 = s('#c5b7a0'); C.dust1 = s('#a89370'); C.dust2 = s('#886c44'); C.dust3 = s('#ebdcc1');
    FX.C = C;
    headCells('zu'); headCells('halb'); headCells('auf');
  };

  // ═════════ Plan (Einheiten u: ein Sprite-Pixel = 4,84 u; Koordinaten der Brettebene) ═════════
  // o = { A: [x, y] Fußpunkt des Angreifers, huA, zw (Breite der Angreiferzone in u), T: [x, y] Fußpunkt (Held) bzw. Kartenmitte, tgt: { hu, kind: 'hero' | 'card', wb, hb }, n (Teilchenfaktor), phone, seed, kopfpos }
  FX.plan = (o) => {
    const hero = o.tgt.kind === 'hero', thu = hero ? (o.tgt.hu || 150) : 150, hb = o.tgt.hb || 168, zw = o.zw || 120;
    const P = { o, n: o.n == null ? 1 : o.n, phone: !!o.phone, seed: o.seed || 1, A: o.A, T: o.T, huA: o.huA || 120, kind: o.tgt.kind, hero, hu: thu, hb, kopfpos: o.kopfpos || null };
    const T = o.T, A = o.A, dx = T[0] - A[0], dy = T[1] - A[1], len = hyp(dx, dy) || 1;
    P.Fh = [dx / len, dy / len];
    const kurz = mn(zw * 0.3, len * 0.4), kk = (len - kurz) / len; P.vec = [dx * kk, dy * kk];     // Haltepunkt des Dashs (wie ppFx27Figur: Stop VOR dem Ziel)
    const n = P.n, sd = P.seed * 37;
    P.dust = makeDust(sd + 100, mx(4, rd(10 * n)), thu, 0.25, 0.6); P.nSpark = mx(6, rd(16 * n)); P.Rmax = thu * 1.25;
    return P;
  };

  const SQ = [[1.22, 0.78], [1.22, 0.78], [1.10, 0.88], [1.14, 0.84], [0.92, 1.10], [1.03, 0.97], [1.01, 0.99], [1, 1]], KB = [1, 2, 2, 2, 1, 0, 0, 0], WIG = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, -1, -1, 1, 1, -1, -1, 1, 1, -1, 0];
  FX.pose = (f, P) => {
    if (f < 0 || f > 21) return { active: false, flash: 0, sx: 1, sy: 1, kb: 0, dx: 0, dy: 0, hideSprite: false };
    const q = f < 7 ? SQ[f] : [1, 1];
    return { active: true, flash: f === 0 ? 1 : f === 1 ? 2 : f === 2 ? 1 : f === 3 ? 3 : 0, sx: q[0], sy: q[1], kb: f < 8 ? KB[f] : 0, dx: WIG[f] || 0, dy: 0, hideSprite: true };
  };
  const SH = [[2, 0], [-2, 1], [1, -1], [-1, 1]];
  FX.shake = (f, P) => (f >= 0 && f < SH.length && !P.phone) ? SH[f] : [0, 0];

  // cam = { proj(x, y, v) → [Zelle x, Zelle y, Zellen je Einheit], top16: Zellenzeile des Fensterrands + 16 }; hook = { pile(m, pose) } malt das Ziel (Held-Sprite / Kartenviereck) mit Quetschung, Blitz und Rückstoß
  FX.draw = (m, f, P, cam, hook) => {
    m.setZ(0);
    const proj = cam.proj, T = P.T, A = P.A, hero = P.hero, thu = P.hu, ahu = P.huA, n = P.n, hb = P.hb;
    const pose = FX.pose(f, P), k0 = proj(T[0], T[1], 0)[2];
    const sA = proj(A[0], A[1], hero ? 0.45 * thu : 0), sT = proj(T[0], T[1], hero ? 0.45 * thu : 0);
    let ddx = sT[0] - sA[0], ddy = sT[1] - sA[1]; const dl = hyp(ddx, ddy) || 1; ddx /= dl; ddy /= dl;
    const S = hero ? proj(T[0], T[1], 0.45 * thu) : proj(T[0], T[1], 6), K = [S[0] - ddx * 3, S[1] - ddy * 3];
    const g0 = [T[0] - P.Fh[0] * 10, T[1] - P.Fh[1] * 10];
    const Hc = hero ? thu * k0 : hb * k0 * 1.14;                       // Zielhöhe in Zellen (Kralle, Abstand)
    // ───── Bodenschicht ─────
    const rings = (half) => {
      for (let i = 0; i < 2; i++) {
        const t = f - i * 2; if (f < 0 || t < 0) continue;
        const R = thu * 0.22 + P.Rmax * (1 - i * 0.2) * (1 - Math.pow(1 - clamp(t / 12), 2.2)), lv = t < 4 ? 16 : 16 * (1 - (t - 4) / 9), cols = i ? [C.tig2, C.cream] : [C.white, C.orL];
        ring(m, cam, g0[0], g0[1], R, 2, cols[0], lv, half); ring(m, cam, g0[0], g0[1], R * 0.92, 1, cols[1], lv * 0.8, half);
      }
    };
    rings(-1);
    pose.dxc = rd(ddx * pose.kb) + pose.dx; pose.dyc = rd(ddy * pose.kb); P.lastPose = pose;
    if (hook.pile && pose.active) { m.setZ(0); hook.pile(m, pose); }
    // ───── Staub des Kontakts (Boden, hinter/vor Figuren nach Tiefe) ─────
    rings(1);
    // ───── Tritt: Geschwindigkeitslinien vom Angreifer zum Kontakt (Bild 0–1; Bild −1 liegt vor dem Start der Leinwand) ─────
    if (f >= -1 && f <= 1) {
      const A2 = proj(A[0] + P.vec[0], A[1] + P.vec[1], 0.42 * ahu), mxp = (A2[0] + K[0]) / 2, myp = (A2[1] + K[1]) / 2;
      speedLines(m, f + 5, P.seed + 3, mxp, myp, ddx, ddy, 3, 5, 7, 13, [C.white, C.cream, C.yel]);
    }
    // Kopf-Platz: über dem KOPF des Ziels (Unterkante 2 Zellen darüber), nah am Ziel. Ist oben kein Platz (Kopf-Oberkante weniger als 16 Zellen unter dem Fensterrand),
    // rutscht er seitlich neben den Kopf des Ziels statt abgeschnitten zu werden ('seite' erzwingt das).
    const hsg = ddx >= -0.15 ? 1 : -1, topT = hero ? proj(T[0], T[1], thu) : proj(T[0], T[1] - hb / 2, 0);
    let hcx = S[0], hcy = topT[1] - 2 - HW;
    if (P.kopfpos === 'seite' || hcy - HW < cam.top16) { hcx = S[0] + hsg * (Hc * 0.5 + (GR >> 1) + 4); hcy = mx(cam.top16 + HW, topT[1] + 2); }
    P.kopf = [hcx, hcy];
    // ───── Wirkung ─────
    if (f >= 0) {
      drawDust(m, cam, g0[0], g0[1], P.dust, f, [[C.dust3, C.dust0, C.dust1], [C.dust0, C.dust1, C.dust2]]);
      // Tigerkopf brüllt ÜBER dem Ziel: Bild 0 zu 75 % sichtbar (Bayer 12/16), ab 1 voll; 2 weit auf (SCHADEN), 3 schnappt zu, 4–8 brüllt (1 Zelle Wackler), 9–13 Bayer-Auflösung
      if (f <= 13) {
        const st = ['halb', 'halb', 'auf', 'zu', 'halb', 'auf', 'auf', 'auf', 'halb', 'halb', 'halb', 'zu', 'zu', 'zu'][f], lvH = f === 0 ? 12 : f <= 8 ? 16 : [14, 11, 8, 5, 2][f - 9], jx = (f >= 5 && f <= 8 && !P.phone) ? ((f & 1) ? 1 : -1) : 0;
        m.setZ(0); tigerHead(m, hcx + jx, hcy, st, lvH);
        if (f >= 4 && f <= 10) for (const sg of [-1, 1]) for (let q = 0; q < 3; q++) {
          const age = f - 4 - q * 2; if (age < 0 || age > 5) continue;
          const X = rd(hcx + sg * (GR * 0.45 + age * 1.5 + q)), Y = rd(hcy + HW * 0.45 + age * 1.1 - (q & 1)), c = age < 3 ? C.white : C.grau;
          m.px(X, Y, c); if (age < 4) { m.px(X + sg, Y, c); m.pd(X, Y + 1, c, 9); }
        }
        if (f >= 9) drawSparks(m, hcx, hcy, P.seed * 11, mx(6, rd(10 * n)), f - 9, 6, 1.0, 2.6, [C.orL, C.tig1, C.cream]);
      }
      // Krallen: 3 schmale Schlitze, f 2/3/4, verblassen per Bayer
      const sdn = ddx >= 0 ? 1 : -1, cdx = sdn * 0.5, cdy = 0.866, Lc = Hc, pdx = -cdy, pdy = cdx, sp = Hc * 0.22 + 2;
      m.setZ(0);
      for (let i = 0; i < 3; i++) {
        const s0 = 2 + i, rev = clamp((f - s0 + 1) / 1.5); if (f < s0) continue;
        const lvc = f < s0 + 3 ? 16 : 16 * (1 - (f - s0 - 3) / 8); if (lvc <= 0) continue;
        const cx = S[0] + pdx * (i - 1) * sp, cy = S[1] + pdy * (i - 1) * sp;
        claw(m, cx - cdx * Lc / 2, cy - cdy * Lc / 2, cx + cdx * Lc / 2, cy + cdy * Lc / 2, rev, lvc);
      }
      drawSparks(m, K[0], K[1], P.seed * 3, P.nSpark, f, 8, 2.2, 4.6, [C.white, C.orL, C.orange]);
      // Tritt-Treffer: Weiß-Gelb-Dither-Schlagstern mit 8 Strahlen (f 0–3)
      if (f <= 3) {
        const s2 = [1, 0.8, 0.9, 0.5][f], R0 = 11 * s2, X = rd(K[0]), Y = rd(K[1]), col = [C.white, C.cream, C.white, C.yel][f], lvv = [16, 12, 12, 6][f]; m.setZ(0);
        for (let yy = -R0; yy <= R0; yy++) for (let xx = -R0; xx <= R0; xx++) { const d = hyp(xx, yy) / R0; if (d > 1) continue; m.pd(X + xx, Y + yy, col, lvv * (1 - d * 0.5)); }
        const Lr = [24, 17, 19, 10][f];
        for (let q = 0; q < 8; q++) { const a = q * PI / 4, l = (q & 1) ? Lr * 0.6 : Lr; m.linie(X, Y, X + Math.cos(a) * l, Y + Math.sin(a) * l * 0.9, (f === 0 && !(q & 1)) ? 2 : 1, (q & 1) ? C.yel : C.white, 16); }
      }
      // Sterne (Stun): kommen jetzt vom Status-Bild der betäubten Figur (app-fx-64, `PpFx64Sterne`) — erst wenn der Stun wirklich gesetzt ist (Engine, Bild 12), also nicht bei Immunität/Schild.
    }
  };
  /** Trockenlauf der Zeichenroutinen (Leerlauf): wärmt Code, Kopf-Zellenlisten und Wertetabellen, damit der erste Tritt nicht im kalten Code startet. */
  FX.trocken = () => {
    FX.init();
    const gw = 260, gh = 260, buf = new Uint8ClampedArray(gw * gh * 4), tq = new Float32Array(gw * gh), m = maler(buf, gw, gh, tq, 0, 0);
    const cam = { proj: (x, y, v) => [130 + x * 0.2, 150 + y * 0.2 - v * 0.2, 0.2], top16: 16 };
    for (const kind of ['hero', 'card']) for (const kopfpos of [null, 'seite']) {
      const P = FX.plan({ A: [-220, 0], huA: 150, zw: 120, T: [0, 0], tgt: { hu: 150, kind, wb: 120, hb: 168 }, n: 1, phone: false, seed: 3, kopfpos });
      for (let f = 0; f < LEN; f += 3) { buf.fill(0); FX.draw(m, f, P, cam, { pile: () => {} }); }
    }
  };

  // ═════════ BLUT-SPRITZER (Zonen-Animation `tiger_blood`, nur 2. Angriff der Runde MIT Heilung): Fontäne am Ziel, dicker Blutstrahl im Bogen zum Mund des Angreifers, der ihn „trinkt" ═════════
  // Ablauf (Bild b nach dem Ereignis, 30/s): 0–2 Aufplatzen am Treffer (Dither-Stern, Fontänensäule), 0–12 Tropfen im Bogen mit Schwerkraft, am Boden Dither-Flecken (verblassen); 2–10 der Strahl wächst vom Ziel zum Mund
  // (wellig, 3 Zellen breit, Perlen laufen mit, Tropfen lösen sich); 10 Strahl am Mund: Plopp-Kreuz, Spritzer, roter Dither-Flash auf dem Angreifer (10–15); 11–19 der Strahl wird vom Ziel her aufgesogen;
  // 19 = HEILUNG (Engine `BLUT_HEAL_MS`, danach `heal_sparkle`); bis 25 klingen Flecken/Spritzer aus.
  const BLUT_LEN = 26, BLUT_HEAL_F = 19; FX.BLUT_LEN = BLUT_LEN; FX.BLUT_HEAL_F = BLUT_HEAL_F;
  const easeOut2 = (x) => 1 - (1 - clamp(x)) * (1 - clamp(x));
  FX.blutPlan = (o) => {
    const n = o.n == null ? 1 : o.n, sd = (o.seed || 1) * 53 + 7, Hc = mx(24, o.Hc || 40), K = o.K, M = o.M, gy = o.gy, sgn = o.sgn || 1;
    const P = { n, phone: !!o.phone, sd, Hc, K, M, gy, sgn, drops: [], drips: [], mund: [], g: 1.5 * Hc / 40 };
    const g = P.g, nd = mx(10, rd(34 * n));
    for (let i = 0; i < nd; i++) {
      const ang = (H(sd, i) - 0.5) * 1.7 + sgn * 0.22, v = (0.4 + 0.6 * H(sd + 1, i)) * 8.2 * sqrt(Hc / 40), vx = Math.sin(ang) * v * 0.8, vy = -Math.cos(ang) * v, gyj = gy + rd((H(sd + 2, i) - 0.4) * 6);
      const dd = vy * vy - 2 * g * (K[1] - gyj), aL = dd > 0 ? (-vy + sqrt(dd)) / g : 0;
      P.drops.push({ a0: (H(sd + 3, i) * (i < nd * 0.6 ? 3 : 9)) | 0, vx, vy, gyj, aL, big: H(sd + 4, i) < 0.6, splat: H(sd + 5, i) < 0.65, life: 8 + ((H(sd + 6, i) * 5) | 0) });
    }
    const dx = M[0] - K[0], dy = M[1] - K[1], d = hyp(dx, dy); P.C1 = [(K[0] + M[0]) / 2 + sgn * mx(0.3 * d, 1.0 * Hc) * (1 - Math.abs(dx) / (d || 1)), (K[1] + M[1]) / 2 - (0.3 * d + 0.3 * Hc)];   // seitliche Ausbuchtung, damit auch ein senkrechter Weg (Angreifer genau über/unter dem Ziel) einen Bogen zeigt
    let L = 0, px = K[0], py = K[1];
    for (let i = 1; i <= 32; i++) { const t = i / 32, u = 1 - t, x = u * u * K[0] + 2 * u * t * P.C1[0] + t * t * M[0], y = u * u * K[1] + 2 * u * t * P.C1[1] + t * t * M[1]; L += hyp(x - px, y - py); px = x; py = y; }
    P.L = mx(8, L);
    // Schwälle: der Strahl besteht aus Klumpen, die vom Ziel zum Mund fliegen. In einem Schub (3 Stück, Bild 2 / 5 / 8) liegen sie dicht, vorn dick (Wellenfront), hinten dünn; dazwischen nur Einzeltropfen und Tropfenketten.
    // Jeder Klumpen zieht einen Schweif (Streifen aus Scheiben); er schrumpft zum Mund hin, sodass der Strahl zerfasert (Plateau-Rayleigh: Klumpen → Ketten → Tropfen).
    P.blobs = [];
    const nbur = mx(4, rd(9 * n)), starts = [2, 5, 8];
    for (let k = 0; k < 3; k++) for (let j = 0; j < nbur; j++) {
      const fr = j / nbur, hh = H(sd + 40 + k, j), r = (0.9 + 2.5 * Math.pow(1 - fr, 0.75)) * (k === 0 ? 1.15 : 1) * (0.55 + 0.95 * hh);
      P.blobs.push({ t0: starts[k] + 2.2 * fr + (H(sd + 44 + k, j) - 0.5) * 0.9, T: 7.4 + 0.8 * H(sd + 48, j + 17 * k), r, str: 0.6 - 0.4 * fr, lat: (H(sd + 52 + k, j) - 0.5) * 3.2, sat: H(sd + 56 + k, j) < 0.7, id: k * 31 + j });
    }
    const nsp = mx(3, rd(4 * n)); for (let g2 = 0; g2 < 3; g2++) for (let j = 0; j < nsp; j++) {
      const hh = H(sd + 60 + g2, j); P.blobs.push({ t0: starts[g2] + 2.4 + 0.7 * j / nsp * 1.2 + hh * 0.3, T: 7.8 + 0.8 * H(sd + 64, j + 9 * g2), r: 0.6 + 0.9 * H(sd + 66 + g2, j), str: 0.18, lat: (H(sd + 70 + g2, j) - 0.5) * 4.5, sat: false, id: 200 + g2 * 17 + j });
    }
    P.blobs.sort((u1, u2) => u1.t0 - u2.t0);
    const ndr = mx(4, rd(10 * n)); for (let i = 0; i < ndr; i++) P.drips.push({ t: 0.15 + 0.6 * H(sd + 10, i), s: 4 + 1.3 * i, vx: (H(sd + 11, i) - 0.5) * 0.7 });
    const nm = mx(4, rd(9 * n)); for (let i = 0; i < nm; i++) P.mund.push({ ang: -PI / 2 + (H(sd + 20, i) - 0.5) * 2.6, v: 1.4 + 3.2 * H(sd + 21, i), big: H(sd + 22, i) < 0.25 });
    return P;
  };
  const sq = (m, x, y, w, c, lv) => { const o = (w - 1) >> 1; for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) m.pd(x - o + i, y - o + j, c, lv == null ? 16 : lv); };
  function blutTropfen(m, x, y, big, c0, c1, c2, c3) {
    x = rd(x); y = rd(y);
    if (big) { m.px(x, y, c2); m.px(x + 1, y, c1); m.px(x, y + 1, c1); m.px(x + 1, y + 1, c0); m.px(x, y, c3); } else m.px(x, y, c2);
  }
  /** m: Maler (Zellen); f: Bild; P: Plan; hook.aura(m, lvFlaeche, lvRing) tönt den Angreifer (Silhouette) rot. */
  FX.blutDraw = (m, f, P, hook) => {
    m.setZ(0);
    const K = P.K, M = P.M, Hc = P.Hc, g = P.g, c0 = C.bl0, c1 = C.bl1, c2 = C.bl2, c3 = C.bl3, c4 = C.bl4, c5 = C.bl5;
    // ───── Boden: Flecken der gelandeten Tropfen (Dither-Fleck, verblasst) ─────
    for (const d of P.drops) {
      const age = f - d.a0; if (age < d.aL || !d.splat) continue;
      const s = age - d.aL, X = rd(K[0] + d.vx * d.aL), Y = d.gyj; if (s > d.life) continue;
      const lv = s < 5 ? 16 : 16 * (1 - (s - 5) / (d.life - 5)), w = s < 1 ? 3 : s < 2 ? 2 : 2 + (d.big ? 1 : 0);
      for (let i = -w; i <= w; i++) { m.pd(X + i, Y, Math.abs(i) >= w ? c0 : c1, lv); if (Math.abs(i) < w) m.pd(X + i, Y + 1, c0, lv * 0.7); }
      if (s < 3) { m.px(X - 1, Y - 1, c2); m.px(X + 1, Y - 1, c3); }
    }
    // ───── Aufplatzen am Treffer (Bild 0–2): Dither-Stern + Fontänensäule ─────
    if (f <= 2) {
      const R0 = [9, 12, 8][f], X = rd(K[0]), Y = rd(K[1]);
      for (let yy = -R0; yy <= R0; yy++) for (let xx = -R0; xx <= R0; xx++) { const d = hyp(xx, yy) / R0; if (d > 1) continue; m.pd(X + xx, Y + yy, d < 0.45 ? c4 : d < 0.75 ? c3 : c2, [16, 13, 8][f] * (1 - d * 0.55)); }
      for (let q = 0; q < 8; q++) { const a = q * PI / 4 + 0.2 * f, l = (q & 1) ? R0 * 0.8 : R0 * 1.6; m.linie(X, Y, X + Math.cos(a) * l, Y + Math.sin(a) * l * 0.9, (q & 1) ? 1 : 2, (q & 1) ? c3 : c2, 16); }
    }
    if (f <= 8) {
      // Fontäne: drei Strahlen im Bogen (Mitte kräftig, seitlich schwächer), Spitze wächst bis Bild 5, dann Dither-Zerfall
      const lv = f <= 5 ? 16 : 16 * (1 - (f - 5) / 4), tm = mn(7.5, 0.6 + f * 1.5), vs = sqrt(Hc / 40);
      if (lv > 0) for (const [vx, vy, th] of [[P.sgn * 0.5, -7.6, 3], [P.sgn * 0.5 - 2.7, -6.2, 2], [P.sgn * 0.5 + 2.9, -6.0, 2]]) {
        const pts = []; for (let a = 0; a <= tm + 1e-6; a += 0.5) pts.push([K[0] + vx * vs * a, K[1] + vy * vs * a + 0.5 * g * a * a]);
        for (let i = 1; i < pts.length; i++) m.linie(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], th + 2, c0, lv);
        for (let i = 1; i < pts.length; i++) m.linie(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], th, i < 3 ? c3 : c2, lv);
        for (let i = 1; i < pts.length; i += 2) m.px(rd(pts[i][0]) - 1, rd(pts[i][1]) - 1, c4);
      }
    }
    // ───── Tropfen der Fontäne ─────
    for (const d of P.drops) {
      const age = f - d.a0; if (age < 0 || age >= d.aL) continue;
      const x = K[0] + d.vx * age, y = K[1] + d.vy * age + 0.5 * g * age * age, X = rd(x), Y = rd(y);
      if (age >= 1) { const a2 = age - 1, tx = K[0] + d.vx * a2, ty = K[1] + d.vy * a2 + 0.5 * g * a2 * a2; m.linie(tx, ty, x, y, 1, c2, 16); }
      blutTropfen(m, X, Y, d.big, c1, c2, c3, c4);
    }
    // ───── Strahl: Klumpen im Bogen (Parabel) Ziel → Mund ─────
    const bez = (t) => { const u = 1 - t; return [u * u * K[0] + 2 * u * t * P.C1[0] + t * t * M[0], u * u * K[1] + 2 * u * t * P.C1[1] + t * t * M[1]]; };
    const dxs = [], dys = [], drs = [];   // Scheiben dieses Bildes (Mitte, Radius)
    const disc2 = (x, y, r) => { dxs.push(x); dys.push(y); drs.push(r); };
    // Ursprung: der Schwall quillt am Treffer (Masse pulsiert mit den Schüben)
    { let env = 0; for (const s0 of [2, 5, 8]) env = mx(env, 1 - clamp(Math.abs(f - (s0 + 1.1)) / 2.4)); if (f >= 1 && f <= 12 && env > 0) disc2(rd(K[0] + P.sgn * 1), rd(K[1] - 1), 1.5 + 2.4 * env); }
    let mouthArr = 0;
    for (const bl of P.blobs) {
      const age = f - bl.t0; if (age < 0) continue;
      const u = age / bl.T; if (u >= 1) { if (u < 1 + 1.6 / bl.T && bl.r > 0.8) mouthArr = mx(mouthArr, bl.r); continue; }
      const ue = u * (1.08 - 0.08 * u), p = bez(ue), q = bez(mn(1, ue + 0.01)), q0 = bez(mx(0, ue - 0.01)); let tx = q[0] - q0[0], ty = q[1] - q0[1]; const tl = hyp(tx, ty) || 1; tx /= tl; ty /= tl;
      const sh = clamp((u - 0.45) / 0.5), strk = bl.str * (1 - 0.7 * sh * sh * (3 - 2 * sh)) / bl.T;   // Schweiflänge in u: wird zum Mund hin kürzer → Kette aus Tropfen
      const rr = bl.r * (1 - 0.3 * u), lat = bl.lat * Math.sin(PI * ue), step = mx(0.8, rr * 0.7) / P.L, nsm = mx(1, Math.ceil(strk / step));
      for (let i = 0; i <= nsm; i++) {
        const w = nsm === 1 && strk < step ? 0 : i / nsm, ss = clamp(ue - strk * w), pp = bez(ss), tr = rr * (1 - 0.45 * w) * (0.72 + 0.56 * H(P.sd + 80 + i, bl.id));   // Schweif verjüngt sich (Tropfenform)
        disc2(rd(pp[0] - ty * lat), rd(pp[1] + tx * lat), tr);
        if (nsm === 1 && strk < step) break;
      }
      if (bl.sat && u > 0.1) { const sx = rd(p[0] - ty * (lat + (rr + 1.5) * (bl.lat > 0 ? 1 : -1)) - tx * 2), sy = rd(p[1] + tx * (lat + (rr + 1.5) * (bl.lat > 0 ? 1 : -1)) - ty * 2); m.px(sx, sy, c2); }
    }
    // Zeichnen: erst alle Ränder (Union-Kontur), dann Körper mit Schattierung (Licht oben links)
    for (let i = 0; i < dxs.length; i++) { const r = drs[i], ri = Math.ceil(r + 1), X = dxs[i], Y = dys[i]; for (let yy = -ri; yy <= ri; yy++) for (let xx = -ri; xx <= ri; xx++) if (hyp(xx, yy) <= r + 0.95) m.px(X + xx, Y + yy, c0); }
    for (let i = 0; i < dxs.length; i++) {
      const r = drs[i], ri = Math.ceil(r), X = dxs[i], Y = dys[i];
      for (let yy = -ri; yy <= ri; yy++) for (let xx = -ri; xx <= ri; xx++) {
        const dd = hyp(xx, yy); if (dd > r + 0.25) continue;
        const l = (-xx * 0.6 - yy * 0.8) / mx(1, r);
        m.px(X + xx, Y + yy, r < 1.3 ? c3 : (l > 0.55 && r >= 1.9 ? c4 : l > 0.1 ? c3 : l > -0.45 ? c2 : c1));
      }
    }
    // Plopp am Mund: jeder ankommende Klumpen spritzt kurz auf (der Angreifer trinkt)
    if (mouthArr > 0) { const X = rd(M[0]), Y = rd(M[1]), r = mouthArr * 1.1 + 1; for (let yy = -4; yy <= 4; yy++) for (let xx = -4; xx <= 4; xx++) { const dd = hyp(xx, yy); if (dd <= r) m.pd(X + xx, Y + yy, dd < r * 0.45 ? c4 : c3, 9); } }
    // Tropfen lösen sich vom Strahl und fallen (Schwerkraft)
    for (const dp of P.drips) {
      const age = f - dp.s; if (age < 0 || age > 11) continue; const p = bez(dp.t), x = p[0] + dp.vx * age, y = p[1] + 0.5 * g * 0.8 * age * age, lv = age < 7 ? 16 : 16 * (1 - (age - 7) / 4);
      if (age >= 1) { const a2 = age - 0.5, y2 = p[1] + 0.5 * g * 0.8 * a2 * a2; m.pd(rd(x - dp.vx * 0.5), rd(y2), c1, lv * 0.7); }
      m.pd(rd(x), rd(y), c3, lv); m.pd(rd(x) + 1, rd(y), c2, lv); m.pd(rd(x), rd(y) + 1, c2, lv); m.pd(rd(x) + 1, rd(y) + 1, c1, lv);
    }
    // ───── Mund: Plopp-Kreuz, Spritzer, roter Flash auf dem Angreifer ─────
    if (f >= 10 && f <= 18) {
      const X = rd(M[0]), Y = rd(M[1]), a = f - 10;
      if (a <= 2) { const L = [3, 5, 3][a]; for (let i = -L; i <= L; i++) { m.px(X + i, Y, i === 0 ? c5 : c4); m.px(X, Y + i, i === 0 ? c5 : c4); } m.px(X - 1, Y - 1, c3); m.px(X + 1, Y + 1, c3); m.px(X + 1, Y - 1, c3); m.px(X - 1, Y + 1, c3); }
      if (a <= 5) for (const d of P.mund) { const x = M[0] + Math.cos(d.ang) * d.v * a, y = M[1] + Math.sin(d.ang) * d.v * a + 0.5 * 0.8 * a * a; if (a < 5 || BAY[rd(y) & 3][rd(x) & 3] < 16 - (a - 5) * 6) blutTropfen(m, x, y, d.big && a < 3, c1, c2, c3, c4); }
      if (hook && hook.aura) hook.aura(m, [4, 7, 9, 7, 5, 6, 8, 5, 2][a], [8, 13, 16, 12, 8, 10, 14, 9, 4][a]);   // Flash pulsiert mit den ankommenden Schwällen
    }
  };
  /** Trockenlauf (Leerlauf): wärmt den Blut-Code. */
  FX.blutTrocken = () => {
    FX.init();
    const gw = 260, gh = 260, buf = new Uint8ClampedArray(gw * gh * 4), tq = new Float32Array(gw * gh), m = maler(buf, gw, gh, tq, 0, 0);
    const P = FX.blutPlan({ K: [160, 160], M: [60, 90], gy: 190, Hc: 40, n: 1, phone: false, seed: 3, sgn: 1 });
    for (let f = 0; f < BLUT_LEN; f += 4) { buf.fill(0); FX.blutDraw(m, f, P, { aura: () => {} }); }
  };

  root.PpFx63 = FX;
})(window);

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  SPIEL-HÜLLE: Brettabbildung (Homografie aus den Zonen), Leinwand in der Weltschicht, Takt, Ziel auf der Leinwand (Held-Sprite zellenweise / Kartenviereck), Shake, Aufräumen, Rückfall
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX63_TAKT = 1000 / 30;

/** Rückfall auf die alte Fassung (`explosion` + `tiger_impact`): Animationen aus, Retro, Test-Schalter, reduzierte Bewegung, keine Palette. */
function ppFx63Rueckfall() {
  try {
    if (window.__ppFx63Aus || window.__ppFxAlt || window._playAnimations === false || window.PP_RETRO || typeof window.ppSnapRgb !== 'function' || !window.PpFx57 || !window.PpFx63) return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { /* weiter */ }
  return false;
}

/** Geometrie nicht möglich: Grund merken (Tests: `window.__ppFx63Grund`), Rückfall auf die alte Fassung. */
function ppFx63Fehl(g) { window.__ppFx63Grund = g; return null; }

/**
 * Geometrie einmal beim Start (kein Layout im Takt): Homografie aus allen Zonen, Maß der Brett-Einheit u (ein Sprite-Pixel des Ziels = 4,84 u), Leinwandrechteck um das Ziel samt Kopfbereich darüber, Zelle = Hero-Pixel,
 * Fußpunkte von Ziel und Angreifer in Einheiten, Plan. Gibt null zurück, wenn etwas fehlt (dann läuft die alte Fassung).
 */
function ppFx63Geometrie(props) {
  try {
    const FX = window.PpFx63; FX.init();
    const { x, y, w, zoneEl, vonEl } = props;
    const plane = document.querySelector('.board-plane');
    if (!plane || !zoneEl || !zoneEl.isConnected || !vonEl || !vonEl.isConnected) return ppFx63Fehl(1);
    if (typeof ppFx60Homografie !== 'function' || typeof ppFx60Layout !== 'function' || typeof ppFx59Figur !== 'function') return ppFx63Fehl(2);
    const phone = !!(window.ppIsPhone && window.ppIsPhone());
    const zr = zoneEl.getBoundingClientRect(), zcx = zr.left + zr.width / 2, zcy = zr.top + zr.height / 2;
    const ox = x - zcx, oy = y - zcy;                                                                       // Versatz Fenster → Welt (Scrollstand)
    // Referenzpunkte: alle Zonen (Held, Fähigkeit, Support, beide Seiten)
    const refs = [];
    document.querySelectorAll('[data-hero-zone],[data-support-zone],[data-ability-zone]').forEach((e) => {
      const l = ppFx60Layout(e, plane), r = e.getBoundingClientRect();
      if (l && r.width > 0) refs.push([l.x, l.y, r.left + r.width / 2, r.top + r.height / 2]);
    });
    if (refs.length < 8) return ppFx63Fehl(3);
    const Hm = ppFx60Homografie(refs); if (!Hm || !(Hm.rms < 6)) return ppFx63Fehl(4);
    let Xc = 0, Ym = 0; for (const r of refs) { Xc += r[0]; Ym += r[1]; } Xc /= refs.length; Ym /= refs.length;
    // Ziel: Held mit Sprite (Fußlinie der Figur) oder Karte/Slot (Viereck)
    const tFig = ppFx59Figur(zoneEl), kind = tFig ? 'hero' : 'card';
    const hp = ppFxHeldPixel(zoneEl, w), hpx = hp.px > 0 ? hp.px : 2.8125;
    const zl = ppFx60Layout(zoneEl, plane); if (!zl) return ppFx63Fehl(5);
    const pa = Hm.f(zl.x, zl.y), pb = Hm.f(zl.x + 1, zl.y), pxPerL = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1;
    const R = 4.84 * pxPerL / hpx;                                                                          // Einheiten je Layout-Pixel: ein Sprite-Pixel = 4,84 u
    const toW = (sx, sy) => { const L = Hm.inv(sx, sy); return [(L[0] - Xc) * R, (L[1] - Ym) * R]; };       // Fensterpunkt (Bodenebene) → Einheiten
    // Leinwandrechteck (Fensterpixel): Ziel samt Figur plus Rand für Kopf (≈ 27 Zellen darüber, 21 breit, seitlich bis ≈ 40 Zellen), Krallen, Sterne, Ringe und Staub
    let l0 = zr.left, t0 = zr.top, r0 = zr.right, b0 = zr.bottom;
    if (tFig) { const cr = tFig.hp.cv.getBoundingClientRect(); l0 = Math.min(l0, cr.left); t0 = Math.min(t0, cr.top); r0 = Math.max(r0, cr.right); b0 = Math.max(b0, cr.bottom); }
    if (props.blut) { const vb = vonEl.getBoundingClientRect(); l0 = Math.min(l0, vb.left); t0 = Math.min(t0, vb.top); r0 = Math.max(r0, vb.right); b0 = Math.max(b0, vb.bottom); }   // Blut: auch der Angreifer (Mund) gehört in die Leinwand
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
    const top16 = (oy - ly) / S + 16;                                                                       // Zellenzeile des Fensterrands + 16: darüber darf der Kopf nicht stehen
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
    let zw = 120; try { const lv = ppFx60Layout(vonEl, plane); if (lv && lv.w > 0) zw = lv.w * R; } catch (e) { /* Standardbreite */ }
    if (!tFig && !(hu > 0)) hu = 0;
    const nF = (window.ppFxN ? window.ppFxN(100) / 100 : 1) * (phone ? 0.5 : 1);
    const P = FX.plan({ A, huA, zw, T, tgt: { hu, kind, wb, hb }, n: nF, phone, seed: Math.floor(Math.random() * 1e6), kopfpos: window.__ppFx63Kopfpos || null });
    return { S, P, FX, lx, ly, gw, gh, ox, oy, zr, tFig, karte, quad, kind, phone, Hm, cell, proj, toW, zcx, R, top16, vonEl };
  } catch (e) { try { console.warn('[TigerKick]', e); } catch (e2) { /* weg */ } return ppFx63Fehl('Fehler ' + e.message); }
}

function PpFx63Leinwand({ geo, zoneEl }) {
  const cvs = useRef(null);
  const wurzelRef = useRef(null);
  useEffect(() => {
    const el = cvs.current, FX = geo.FX;
    if (!el) return undefined;
    const mess1 = window.__ppFx63Messen ? performance.now() : 0;
    const { S, P, gw, gh, tFig, karte, quad, phone, proj, cell, toW, ox, oy, top16 } = geo;
    const ctx = el.getContext('2d'), img = ctx.createImageData(gw, gh), buf = img.data, tq = new Float32Array(gw * gh);
    const m = FX.maler(buf, gw, gh, tq, 0, 0);
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const BAY = window.PpFx57.BAY, C = FX.C;
    const ruhig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const shakeAn = !phone && !ruhig && !window.__ppFx63KeinShake;
    const board = shakeAn ? document.querySelector('.board-center') : null;
    const wurzel = wurzelRef.current;
    const platz = tFig ? tFig.hp.platz : null;
    // ── Figur im Raster (Nächster-Nachbar, eine Zelle je Sprite-Pixel-Anteil), um die Fußlinie gestaucht und um (dx, dy) Zellen verschoben (wie app-fx-59/60/61) ──
    function figurZellen(fg, p, fn) {
      const s = fg.px, f0 = Math.max(0, Math.min(fg.fr, Math.max(1, (fg.eintrag.meta.frames | 0)) - 1));
      const sx0 = s.vert ? 0 : f0 * s.fw, sy0 = s.vert ? f0 * s.fh : 0, cps = fg.cps, oX = fg.oX, oY = fg.oY + (p.dy || 0), Lc = fg.L + (p.dy || 0), sy = p.sy, sx = p.sx, gxc = fg.gx;
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
    // Tiefenmaske der stehenden Helden (außer dem Ziel): Tiefe 1000 − y (Einheiten); Staub und Ringe liegen dahinter
    try {
      document.querySelectorAll('[data-hero-zone]').forEach((z) => {
        if (z === zoneEl) return;
        const fg = ppFx59Figur(z); if (!fg) return;
        const cr = fg.hp.cv.getBoundingClientRect(), zr2 = z.getBoundingClientRect();
        if (cr.right + ox < geo.lx || cr.left + ox > geo.lx + gw * S || cr.bottom + oy < geo.ly || cr.top + oy > geo.ly + gh * S) return;
        const d = beschreibe(fg, z), qd = 1000 - toW(zr2.left + zr2.width / 2, cr.top + fg.y1 * fg.hp.px)[1];
        figurZellen(d, { sx: 1, sy: 1, dx: 0, dy: 0 }, (X, Y) => { const k = Y * gw + X, t = tq[k]; if (t === 0 || qd < t) tq[k] = qd; });
      });
    } catch (e) { /* ohne Maske: Staub liegt dann über Figuren (nur Optik) */ }
    const ziel = tFig ? beschreibe(tFig, zoneEl) : null;
    // Ziel-Held (Sprite zellenweise mit Blitz/Quetschung/Rückstoß) bzw. Karte (Viereck: Weißfüllung, Cremefüllung per Dither)
    let tot = false;
    const pile = (mm, pose) => {
      const bl = pose.flash === 1 ? 16 : pose.flash === 2 ? 12 : pose.flash === 3 ? 6 : 0;
      if (ziel) {
        if (tot || !platz) return;
        ziel.fr = platz._ppFrame | 0;
        figurZellen(ziel, { sx: pose.sx, sy: pose.sy, dx: pose.dxc, dy: pose.dyc }, (X, Y, r, g, b) => {
          let col;
          if (pose.flash === 1) col = C.white; else if (bl && BAY[Y & 3][X & 3] < bl) col = C.cream; else col = [r, g, b];
          mm.px(X, Y, col);
        });
      } else if (quad) {
        const dx = pose.dxc, dy = pose.dyc, yA = Math.floor(Math.min(quad.tl[1], quad.tr[1])) + dy, yB = Math.ceil(Math.max(quad.bl[1], quad.br[1])) + dy, y0 = Math.max(0, yA);
        if (!bl) return;
        for (let Y = y0; Y < Math.min(gh, yB); Y++) {
          const t = Math.max(0, Math.min(1, (Y - dy + 0.5 - quad.tl[1]) / (quad.bl[1] - quad.tl[1]))), a = quad.tl[0] + (quad.bl[0] - quad.tl[0]) * t + dx, b = quad.tr[0] + (quad.br[0] - quad.tr[0]) * t + dx;
          for (let X = Math.max(0, Math.round(a)); X < Math.min(gw, Math.round(b)); X++) {
            if (pose.flash === 1) mm.px(X, Y, C.white); else if (BAY[Y & 3][X & 3] < bl) mm.px(X, Y, C.cream);
          }
        }
      }
    };
    const hook = { pile };
    const cam = { proj, top16 };
    // DOM-Seite: Karte ruckeln (ganze Zellen), Held ausblenden solange er im Raster gemalt wird, Brett schütteln
    const alt = { vis: platz ? platz.style.visibility : '', kTr: karte ? karte.style.transform : '', tr: board ? board.style.translate : '' };
    let kx = 1, ky = 1; if (karte) { const kr = karte.getBoundingClientRect(); if (kr.width > 0) kx = karte.offsetWidth / kr.width; if (kr.height > 0) ky = karte.offsetHeight / kr.height; }
    if (mess1) (window.__ppFx63Zeiten || (window.__ppFx63Zeiten = [])).push([-2, +(performance.now() - mess1).toFixed(3)]);
    const t0 = performance.now();
    if (window.__ppFx63Messen) window.__ppFx63T0 = t0;
    // Angreifer: Streckung in Bild 1–2 (1,2 × 0,96) — die Ramm-Figur (app-fx-27) liest `F.kick` in ihren Federungsbildern
    try { const vF = geo.vonEl && geo.vonEl._ppFigurFahrt; if (vF) vF.kick = true; } catch (e) { /* ohne Streckung */ }
    let raf = 0, letzte = -1, ende = false, key = '', figurWeg = false, platzAkt = platz;
    const zuruecksetzen = () => {
      try { if (platzAkt) platzAkt.style.visibility = alt.vis; if (karte) karte.style.transform = alt.kTr; if (board) board.style.translate = alt.tr; } catch (e) { /* weg */ }
    };
    const aufraeumen = () => { if (ende) return; ende = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } zuruecksetzen(); try { ctx.clearRect(0, 0, gw, gh); } catch (e) { /* weg */ } };
    const schritt = (jetzt) => {
      if (ende) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = Math.max(0, jetzt - t0);
      if (ms >= (FX.LEN + 1) * PP_FX63_TAKT) { aufraeumen(); return; }
      const fr = Math.floor(jetzt / PP_FX63_TAKT);
      if (fr !== letzte) {
        letzte = fr;
        const mess = window.__ppFx63Messen ? performance.now() : 0;
        const f = Math.min(FX.LEN - 1, Math.floor(ms / PP_FX63_TAKT + 1e-4));
        // Ziel-Held: neue Figur im Zonenplatz (Wiederbelebung/Neuaufbau) bzw. Tod (Zerfall läuft dann selbst) — ab da nicht mehr in die Leinwand malen
        if (tFig) { const cur = zoneEl._ppFigurPlatz; if (cur && cur !== platzAkt && cur.isConnected) { try { if (platzAkt) platzAkt.style.visibility = alt.vis; } catch (e) { /* weg */ } platzAkt = cur; key = ''; figurWeg = false; } if (platzAkt && (platzAkt._ppFx32Tot || !platzAkt.isConnected)) tot = true; }
        P.keineSterne = tFig ? tot : !!(karte && (!karte.isConnected || !zoneEl.contains(karte)));
        buf.fill(0);
        FX.draw(m, f, P, cam, hook);
        ctx.putImageData(img, 0, 0);
        const pose = P.lastPose || FX.pose(f, P), pa = pose.active && !tot;
        const sh = FX.shake(f, P), sxp = Math.round(sh[0] * S), syp = Math.round(sh[1] * S), pdx = pose.dxc || 0, pdy = pose.dyc || 0;
        const k2 = (pa ? 'a' : 'p') + '|' + pdx + '|' + pdy + '|' + sxp + '|' + syp;
        if (k2 !== key) {
          key = k2;
          if (platzAkt) { const weg = pa; if (weg !== figurWeg) { figurWeg = weg; platzAkt.style.visibility = weg ? 'hidden' : alt.vis; } }
          if (karte) karte.style.transform = (pdx || pdy) ? `translate(${(pdx * S * kx).toFixed(2)}px, ${(pdy * S * ky).toFixed(2)}px)` : alt.kTr;
          if (board) board.style.translate = (sxp || syp) ? `${sxp}px ${syp}px` : alt.tr;
          if (wurzel) wurzel.style.translate = (sxp || syp) && board ? `${sxp}px ${syp}px` : '';
        }
        if (mess) (window.__ppFx63Zeiten || (window.__ppFx63Zeiten = [])).push([f, +(performance.now() - mess).toFixed(3)]);
        if (window.__ppFx63Messen) (window.__ppFx63Kopf || (window.__ppFx63Kopf = {}))[f] = P.kopf ? [ppFx63R1(P.kopf[0]), ppFx63R1(P.kopf[1])] : null;
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    const netz = setTimeout(aufraeumen, (FX.LEN + 1) * PP_FX63_TAKT + 2500);                              // Notnagel (Tab im Hintergrund: rAF ruht)
    return () => { clearTimeout(netz); aufraeumen(); };
  }, []);
  return (
    <div ref={wurzelRef} aria-hidden="true" data-pp-px="aus" style={{ position: 'fixed', left: geo.lx, top: geo.ly, pointerEvents: 'none', zIndex: 10100 }}>
      <canvas ref={cvs} width={geo.gw} height={geo.gh} style={{ width: geo.gw * geo.S, height: geo.gh * geo.S, imageRendering: 'pixelated', display: 'block' }} />
    </div>
  );
}
const ppFx63R1 = (v) => Math.round(v * 10) / 10;

/** Rückfall: die alte Fassung — Explosion + Tiger (`tiger_impact`) am Ziel, wie vor dem Umbau. */
function PpFx63Alt(props) {
  const Ex = ANIM_REGISTRY.explosion, Ti = ANIM_REGISTRY.tiger_impact;
  return (<>{Ex ? <Ex {...props} /> : null}{Ti ? <Ti {...props} /> : null}</>);
}

/** Registry-Komponente: neuer Tigertritt oder der alte als Rückfall. Ohne Ziel-Element (Vorwärmen) wird nichts gezeichnet. */
function PpFx63Effekt(props) {
  const geo = useMemo(() => {
    if (props.prewarm || !(props.zoneEl && props.zoneEl.isConnected)) { window.__ppFx63Grund = props.prewarm ? 'Vorwärmen' : 'kein Ziel-Element'; return null; }
    if (ppFx63Rueckfall()) { window.__ppFx63Grund = 'Rückfall (Animationen aus / Retro / reduzierte Bewegung / Schalter)'; return null; }
    if (!props.vonEl) { window.__ppFx63Grund = 'keine Quelle'; return null; }
    const mess = window.__ppFx63Messen ? performance.now() : 0;
    const g = ppFx63Geometrie(props);
    if (mess) (window.__ppFx63Zeiten || (window.__ppFx63Zeiten = [])).push([-1, +(performance.now() - mess).toFixed(3)]);
    return g;
  }, []);
  if (props.prewarm) return null;
  if (!geo) return <PpFx63Alt {...props} />;
  return <PpFx63Leinwand geo={geo} zoneEl={props.zoneEl} />;
}
if (typeof ANIM_REGISTRY !== 'undefined') ANIM_REGISTRY.tiger_kick = PpFx63Effekt;

/** Blut-Spritzer (`tiger_blood`): eigene Leinwand um Ziel UND Angreifer; Fontäne am Treffer, Strahl zum Mund, roter Flash auf dem Angreifer. Rein Optik (Bild 19 = Heilung der Engine). */
function PpFx63BlutLeinwand({ geo, zoneEl }) {
  const cvs = useRef(null);
  useEffect(() => {
    const el = cvs.current, FX = geo.FX;
    if (!el) return undefined;
    const { S, P: TP, gw, gh, tFig, phone, proj, cell, vonEl } = geo;
    const ctx = el.getContext('2d'), img = ctx.createImageData(gw, gh), buf = img.data, tq = new Float32Array(gw * gh);
    const m = FX.maler(buf, gw, gh, tq, 0, 0), takt = window.ppTaktRaf || window.requestAnimationFrame, C = FX.C;
    const hero = TP.hero, thu = TP.hu, k0 = proj(TP.T[0], TP.T[1], 0)[2];
    const K = hero ? proj(TP.T[0], TP.T[1], 0.45 * thu) : proj(TP.T[0], TP.T[1], 6), M0 = proj(TP.A[0], TP.A[1], 0.84 * TP.huA);
    const gy = Math.round(hero ? proj(TP.T[0], TP.T[1], 0)[1] : proj(TP.T[0], TP.T[1] + TP.hb * 0.4, 0)[1]);
    const Hc = hero ? thu * k0 : TP.hb * k0 * 1.14;
    const BP = FX.blutPlan({ K: [K[0], K[1]], M: [M0[0], M0[1]], gy, Hc, n: TP.n, phone, seed: TP.seed, sgn: K[0] >= M0[0] ? 1 : -1 });
    if (window.__ppFx63Messen) window.__ppFx63BlutDbg = { K, M: M0, gy, Hc, huA: TP.huA, A: TP.A, S, gw, gh };
    // Angreifer-Silhouette (einmal bei Bild 10 gemessen, wenn der Dash längst zurück ist): Zellen der Figur + Rand
    let sil = null;
    const messeSil = () => {
      const out = { inn: [], rand: [] };
      try {
        // Figur direkt vom Platz lesen (nicht über `ppFx59Figur`: dessen Hero-Pixel-Plausibilitätsprüfung verwirft eine noch federnde Figur)
        const platz = vonEl && vonEl._ppFigurPlatz, cv = platz && platz.querySelector && platz.querySelector('canvas.hero-idle-canvas'), eintrag = platz && platz._ppEintrag, s = eintrag && ppFx57SheetPixel(eintrag);   // `.hero-idle-canvas`: die Figur selbst (das erste `canvas` im Platz kann ein Nachbild des Dashs sein)
        if (!cv || !(cv.width > 0) || !s) { if (window.__ppFx63Messen) window.__ppFx63BlutDbg.silFehler = 'keine Figur'; return out; }
        const r = cv.getBoundingClientRect(), c0 = cell(r.left, r.top), cps = (r.width / cv.width) / S, fr = Math.max(0, Math.min((platz._ppFrame | 0), Math.max(1, (eintrag.meta.frames | 0)) - 1));
        const sx0 = s.vert ? 0 : fr * s.fw, sy0 = s.vert ? fr * s.fh : 0, mk = new Uint8Array(gw * gh);
        const x0 = Math.max(0, Math.floor(c0[0])), x1 = Math.min(gw - 1, Math.ceil(c0[0] + s.fw * cps)), y0 = Math.max(0, Math.floor(c0[1])), y1 = Math.min(gh - 1, Math.ceil(c0[1] + s.fh * cps));
        for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
          const col = Math.floor((X + 0.5 - c0[0]) / cps), row = Math.floor((Y + 0.5 - c0[1]) / cps); if (col < 0 || col >= s.fw || row < 0 || row >= s.fh) continue;
          if (s.d[((sy0 + row) * s.w + sx0 + col) * 4 + 3] < 128) continue; mk[Y * gw + X] = 1; out.inn.push(X, Y);
        }
        for (let Y = Math.max(1, y0 - 1); Y <= Math.min(gh - 2, y1 + 1); Y++) for (let X = Math.max(1, x0 - 1); X <= Math.min(gw - 2, x1 + 1); X++) {
          const k = Y * gw + X; if (mk[k]) continue; if (mk[k - 1] || mk[k + 1] || mk[k - gw] || mk[k + gw]) out.rand.push(X, Y);
        }
      } catch (e) { if (window.__ppFx63Messen) window.__ppFx63BlutDbg.silFehler = String(e && e.message); /* ohne Silhouette: nur Strahl und Spritzer */ }
      return out;
    };
    const hook = { aura: (mm, lvF, lvR) => {
      if (!sil) { sil = messeSil(); if (window.__ppFx63Messen) { let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (let i = 0; i < sil.inn.length; i += 2) { a0 = Math.min(a0, sil.inn[i]); a1 = Math.max(a1, sil.inn[i]); b0 = Math.min(b0, sil.inn[i + 1]); b1 = Math.max(b1, sil.inn[i + 1]); } window.__ppFx63BlutDbg.sil = [sil.inn.length / 2, sil.rand.length / 2, a0, a1, b0, b1]; } }
      for (let i = 0; i < sil.inn.length; i += 2) mm.pd(sil.inn[i], sil.inn[i + 1], C.bl2, lvF);
      for (let i = 0; i < sil.rand.length; i += 2) mm.pd(sil.rand[i], sil.rand[i + 1], C.bl3, lvR);
    } };
    const t0 = performance.now();
    if (window.__ppFx63Messen) window.__ppFx63BlutT0 = t0;
    let raf = 0, letzte = -1, ende = false;
    const aufraeumen = () => { if (ende) return; ende = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } try { ctx.clearRect(0, 0, gw, gh); } catch (e) { /* weg */ } };
    const schritt = (jetzt) => {
      if (ende) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = Math.max(0, jetzt - t0);
      if (ms >= (FX.BLUT_LEN + 1) * PP_FX63_TAKT) { aufraeumen(); return; }
      const fr = Math.floor(jetzt / PP_FX63_TAKT);
      if (fr !== letzte) {
        letzte = fr;
        const mess = window.__ppFx63Messen ? performance.now() : 0, f = Math.min(FX.BLUT_LEN - 1, Math.floor(ms / PP_FX63_TAKT + 1e-4));
        buf.fill(0); FX.blutDraw(m, f, BP, hook); ctx.putImageData(img, 0, 0);
        if (mess) (window.__ppFx63BlutZeiten || (window.__ppFx63BlutZeiten = [])).push([f, +(performance.now() - mess).toFixed(3)]);
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    const netz = setTimeout(aufraeumen, (FX.BLUT_LEN + 1) * PP_FX63_TAKT + 2500);
    return () => { clearTimeout(netz); aufraeumen(); };
  }, []);
  return (
    <div aria-hidden="true" data-pp-px="aus" style={{ position: 'fixed', left: geo.lx, top: geo.ly, pointerEvents: 'none', zIndex: 10101 }}>
      <canvas ref={cvs} width={geo.gw} height={geo.gh} style={{ width: geo.gw * geo.S, height: geo.gh * geo.S, imageRendering: 'pixelated', display: 'block' }} />
    </div>
  );
}

/** Registry-Komponente `tiger_blood`: ohne Quelle/Geometrie, im Rückfall (Animationen aus, Retro, reduzierte Bewegung, `__ppFx63Aus`) wird KEIN Blut gezeichnet (die Heilung kommt trotzdem). */
function PpFx63BlutEffekt(props) {
  const geo = useMemo(() => {
    if (props.prewarm || !(props.zoneEl && props.zoneEl.isConnected) || !props.vonEl) { window.__ppFx63BlutGrund = 'kein Ziel/Quelle/Vorwärmen'; return null; }
    if (ppFx63Rueckfall()) { window.__ppFx63BlutGrund = 'Rückfall'; return null; }
    const g = ppFx63Geometrie({ ...props, blut: true });
    window.__ppFx63BlutGrund = g ? 'neu' : ('Geometrie ' + window.__ppFx63Grund);
    return g;
  }, []);
  if (props.prewarm || !geo) return null;
  return <PpFx63BlutLeinwand geo={geo} zoneEl={props.zoneEl} />;
}
if (typeof ANIM_REGISTRY !== 'undefined') ANIM_REGISTRY.tiger_blood = PpFx63BlutEffekt;

// Aufwärmen im Leerlauf: Trockenlauf der Zeichenroutinen (Hero und Karte, Kopf oben und seitlich), damit der erste Tritt nicht im kalten Code startet.
(function ppFx63Aufwaermen() {
  const los = () => {
    try {
      if (ppFx63Rueckfall() || window.__ppFx63KeinAufwaermen) return;
      const ric = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      ric(() => { try { window.PpFx63.trocken(); window.PpFx63.blutTrocken(); } catch (e) { /* weg */ } }, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 6000 }) : los()), 6500);
})();
