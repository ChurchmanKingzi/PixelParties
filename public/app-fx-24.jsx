// Pixelart-Portierungen (Canvas), Batch 24 (dritte Welle, alle übrigen Effekte): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte dieser Datei: sand_reset, shield_bubble, sky_crack. Alle laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s): keine
// weichen Schatten, Scheine oder Verläufe — Schein = Dither-Stufen, Deckung = Bayer-Raster, Symbole (Dünen, Funkel) = kleine Pixelbilder.
// Die übrigen Typen der Welle (reflection_mirror, regeneration_bloom, revenge_rage, reverse_trap_ton, ruse_peek, secret_room_open, shipwrecked_attach, shrink_squeeze,
// shroomasaur_spores, silence_cut, sinister_idol, sky_dig, sky_shaman_chant, slave_chains) laufen schon auf Leinwänden (`ppSalve`/`ppPunktBild`/`ppSzene`/eigener Canvas) — unverändert.

// ── Bausteine (Präfix ppFx24) ───────────────────────────────────────────────────────────────────────────────────────────
const ppFx24Pick = (l) => l[Math.floor(Math.random() * l.length)];

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Sand-Rückstellung (`sand_reset`) — PIXELART. Eine Kreatur zerfällt zu Sand (Ushabti / Maker Machine / Surprise-Reset): 18 Sandhäufchen (statt 🏜) und wenige Glitzer (statt ✨)
//  stieben vom Zonenmittelpunkt strahlenförmig auseinander und steigen dabei auf (Versatz 0–250 ms, 450–750 ms Flug, Ende spätestens bei 1000 ms = Standarddauer der Zonen-Animation).
//  Wie vorher: Flugbahn ease-out, die Teilchen schrumpfen (Häufchen mittel → klein → ein Pixel), Deckung .9 → .7 (60 %) → 0.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX24_SAND = { L: ppHex('#f9ecb3'), M: ppHex('#e0c085'), D: ppHex('#ca874e'), K: ppHex('#9d612f'), Y: ppHex('#f7f7ad'), W: ppHex('#ffffff') };
const PP_FX24_DUENE = {
  mittel: ['.LLM.', 'LMMDD', 'DDDKK'],
  klein: ['LMM', 'DDK'],
};
const PP_FX24_FUNKEL = { gross: ['..W..', '..Y..', 'WYWYW', '..Y..', '..W..'], klein: ['.Y.', 'YWY', '.Y.'] };
const ppFx24SandReset = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX24_SAND;
  for (const p of te.teilchen) {
    const u = (t - p.verzug) / p.dauer;
    if (u < 0 || u > 1) continue;
    const e = 1 - (1 - u) * (1 - u);                                   // ease-out
    const sc = 1 - 0.7 * e;
    const eo = (v) => 1 - (1 - v) * (1 - v);
    const a = u < 0.6 ? 0.9 - 0.2 * eo(u / 0.6) : 0.7 * (1 - eo((u - 0.6) / 0.4));
    const x = cx + (p.tx * e) / S, y = cy + (p.ty * e) / S;
    if (p.funkel) { g.spr(sc > 0.6 ? PP_FX24_FUNKEL.gross : PP_FX24_FUNKEL.klein, PP_FX24_SAND, x, y, a); continue; }
    const stufe = sc > 0.65 ? 0 : sc > 0.4 ? 1 : 2;
    if (p.gross) { if (stufe === 0) g.spr(PP_FX24_DUENE.mittel, PP_FX24_SAND, x, y, a); else if (stufe === 1) g.spr(PP_FX24_DUENE.klein, PP_FX24_SAND, x, y, a); else g.put(x, y, C.M, a); }
    else { if (stufe === 0) g.spr(PP_FX24_DUENE.klein, PP_FX24_SAND, x, y, a); else g.put(x, y, stufe === 1 ? C.M : C.D, a); }
  }
}, 1000, { breite: 150, hoehe: 150 }, {
  z: 9999,
  vorbereiten: () => ({
    teilchen: Array.from({ length: ppFxN(18) }, (_, i) => {
      const w = ((i / 18) * 360 + Math.random() * 20) * Math.PI / 180, dist = 10 + Math.random() * 30, drift = -20 - Math.random() * 30;
      return { tx: Math.cos(w) * dist, ty: Math.sin(w) * dist + drift, verzug: Math.random() * 250, dauer: 450 + Math.random() * 300,
        funkel: Math.random() >= 0.8, gross: (3 + Math.random() * 5) >= 5.5 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Schutzblase (`shield_bubble`; auch Barrier of Faith, Guardian Beast Gou, Bubbles, Escape Device …) — PIXELART. Eine weiße Schutzkuppel (110 × 130 px) um den Platz:
//  ① KERN: gedithertes Weiß/Hellblau, links oben am hellsten (Lichtpunkt bei 35 %/30 %), zum Rand hin durchsichtig, dazu ein heller Innenrand und ein Dither-Hof außen;
//  ② RAND: ein Pixelring (links oben weiß, rechts unten hellblau), der aufschwingt; ③ GLANZ: ein steiler heller Streifen (65°) wandert in 1000 ms über die Kuppel.
//  Die alte Fassung lief 1300 ms, wurde aber von `onZoneAnim` nach 1000 ms (Standarddauer) abgeräumt — die Kurven sind auf 1000 ms gestaucht, die Blase blendet jetzt sauber aus.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX24_BLASE = { weiss: ppHex('#ffffff'), hell: ppHex('#e5f5fa'), blau: ppHex('#b3d8f9') };
const ppFx24ShieldBubble = ppR1Leinwand((g, t, sz) => {
  const u = t / 1000, C = PP_FX24_BLASE, RX0 = 55 / sz.S, RY0 = 65 / sz.S;
  const cx = Math.round(sz.cx), cy = Math.round(sz.cy);
  // ① Kern + Hof
  const oK = ppKf(u, [[0, [0]], [0.18, [0.95]], [0.7, [0.85]], [1, [0]]])[0];
  const sK = ppKf(u, [[0, [0.2]], [0.18, [1]], [0.7, [1.05]], [1, [1.15]]])[0];
  if (oK > 0.02) {
    const rx = RX0 * sK, ry = RY0 * sK, hof = 7 * sK, hx = -0.3 * rx, hy = -0.4 * ry, Rg = (115.7 / sz.S) * sK;
    const RX = Math.ceil(rx + hof), RY = Math.ceil(ry + hof), mittel = (rx + ry) / 2;
    for (let j = -RY; j <= RY; j++) for (let i = -RX; i <= RX; i++) {
      const e = (i * i) / (rx * rx) + (j * j) / (ry * ry);
      if (e > 1) {
        // Hof außen: Dither-Stufen von Hellblau nach Weiß zum Rand hin
        const d = (Math.sqrt(e) - 1) * mittel;
        if (d >= hof) continue;
        const a = oK * 0.55 * Math.pow(1 - d / hof, 1.4);
        g.put(cx + i, cy + j, d < hof * 0.35 ? C.hell : C.blau, a);
        continue;
      }
      const pos = Math.hypot(i - hx, j - hy) / Rg;
      let a1 = pos < 0.35 ? 0.8 - (0.3 * pos) / 0.35 : pos < 0.65 ? 0.5 - (0.34 * (pos - 0.35)) / 0.3 : pos < 0.78 ? 0.16 * (1 - (pos - 0.65) / 0.13) : 0;
      const tiefe = (1 - Math.sqrt(e)) * mittel;                                     // Abstand zum Rand nach innen: heller Innenrand (9 px = 3 Rasterpixel)
      const a2 = tiefe < 3 ? 0.75 * (1 - tiefe / 3) : 0;
      const a = oK * (1 - (1 - a1) * (1 - a2));
      if (a <= 0) continue;
      g.put(cx + i, cy + j, a2 > a1 ? C.weiss : pos < 0.22 ? C.weiss : pos < 0.5 ? C.hell : C.blau, a);
    }
  }
  // ③ Glanz: steiler Streifen (Gradient 115°), nur innerhalb der Kuppel
  const oG = ppKf(u, [[0, [0]], [0.25, [0.95]], [0.6, [0.6]], [1, [0]]])[0];
  if (oG > 0.03) {
    const sG = ppKf(u, [[0, [0.85]], [1, [1.1]]])[0], tx = ppKf(u, [[0, [-30]], [1, [30]]])[0] / sz.S;
    const rx = RX0 * sG, ry = RY0 * sG, RX = Math.ceil(rx), RY = Math.ceil(ry);
    const ca = 0.906, sa = 0.423, p = tx * ca;                                       // Streifen senkrecht zur Richtung 115° (cos 25°, sin 25°)
    for (let j = -RY; j <= RY; j++) for (let i = -RX; i <= RX; i++) {
      if ((i * i) / (rx * rx) + (j * j) / (ry * ry) > 1) continue;
      const s = i * ca + j * sa - p;                                                  // Abstand zum Streifenscheitel (Raster)
      let a;
      if (s <= 0) a = s > -5.1 ? 0.95 * (1 + s / 5.1) : 0;
      else a = s < 2.6 ? 0.95 - 0.55 * (s / 2.6) : s < 6.2 ? 0.4 * (1 - (s - 2.6) / 3.6) : 0;
      if (a > 0) g.put(cx + i, cy + j, a > 0.5 ? C.weiss : C.hell, a * oG);
    }
  }
  // ② Rand
  const oR = ppKf(u, [[0, [0]], [0.22, [1]], [0.85, [0.6]], [1, [0]]])[0];
  if (oR > 0.02) {
    const sR = ppKf(u, [[0, [0.4]], [0.22, [1.02]], [0.85, [1.08]], [1, [1.18]]])[0];
    const rx = RX0 * sR, ry = RY0 * sR, RX = Math.ceil(rx), RY = Math.ceil(ry), rx2 = Math.max(0.5, rx - 1), ry2 = Math.max(0.5, ry - 1);
    for (let j = -RY; j <= RY; j++) for (let i = -RX; i <= RX; i++) {
      const o = (i * i) / (rx * rx + rx * 0.6) + (j * j) / (ry * ry + ry * 0.6);
      if (o > 1 || (i * i) / (rx2 * rx2) + (j * j) / (ry2 * ry2) <= 1) continue;
      g.put(cx + i, cy + j, i * 0.6 + j * 0.8 < 3 ? C.weiss : C.blau, oR);
    }
  }
}, 1000, { breite: 210, hoehe: 240 });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Himmelsriss (`sky_crack`; Hole in the Sky, negierter Guss) — PIXELART. Ein kleiner roter Treppenriss reißt auf dem Ziel auf (720 ms): fünf Äste aus der Mitte (dunkler Rand 3 Pixel,
//  roter Kern, helle Glanzpunkte), er wächst von .15 auf 1,08 und setzt sich auf 1, darunter ein roter Dither-Hof (Dunkelrot → Rot), der wächst und verblasst.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX24_RISS = [
  [[0, 0], [10, 0], [10, -8], [22, -8], [22, -16], [34, -16]],
  [[0, 0], [-8, 0], [-8, 10], [-20, 10], [-20, 18], [-30, 18], [-30, 28]],
  [[0, 0], [0, -12], [-10, -12], [-10, -24], [-18, -24]],
  [[0, 0], [12, 0], [12, 10], [20, 10], [20, 22], [32, 22]],
  [[0, 0], [-12, 0], [-12, -6], [-26, -6]],
];
const PP_FX24_RISSFARBE = { rand: ppHex('#3a0000'), kern: ppHex('#f03232'), glanz: ppHex('#ff8566'), hof: [ppHex('#520a0c'), ppHex('#8c0014'), ppHex('#c0141c')] };
const ppFx24SkyCrack = ppR1Leinwand((g, t, sz) => {
  const u = t / 720, C = PP_FX24_RISSFARBE, S = sz.S, cx = Math.round(sz.cx), cy = Math.round(sz.cy);
  // Hof: Kreis r = 48 px (Verlauf 0,75 → 0,45 bei 34 px → 0 bei 49 px), Deckung 0 → 1 (30 %) → 0, Größe .4 → 1 → 1,3
  const oH = ppKf(u, [[0, [0]], [0.3, [1]], [1, [0]]])[0];
  if (oH > 0.02) {
    const sH = ppKf(u, [[0, [0.4]], [0.3, [1]], [1, [1.3]]])[0], R = 49 * sH / S, R1 = 34 * sH / S, Ri = Math.ceil(R);
    for (let j = -Ri; j <= Ri; j++) for (let i = -Ri; i <= Ri; i++) {
      const d = Math.sqrt(i * i + j * j);
      if (d >= R) continue;
      const a = d < R1 ? 0.75 - 0.3 * (d / R1) : 0.45 * (1 - (d - R1) / (R - R1));
      g.put(cx + i, cy + j, d < R * 0.3 ? C.hof[2] : d < R * 0.62 ? C.hof[1] : C.hof[0], a * oH);
    }
  }
  // Riss: drei Lagen (Rand 6 px, Kern 3 px, Glanz 1 px) als Pixelketten
  const oR = ppKf(u, [[0, [0]], [0.25, [1]], [0.6, [1]], [1, [0]]])[0];
  if (oR > 0.02) {
    const sR = ppKf(u, [[0, [0.15]], [0.25, [1.08]], [0.6, [1]], [1, [1]]])[0];
    const aeste = PP_FX24_RISS.map((a) => ppR1Kette(a.map(([x, y]) => [cx + (x * sR) / S, cy + (y * sR) / S])));
    for (const k of aeste) for (const [x, y] of k) g.block(x - 1, y - 1, 3, 3, C.rand, oR);
    for (const k of aeste) for (const [x, y] of k) g.put(x, y, C.kern, oR);
    for (const k of aeste) for (let i = 2; i < k.length; i += 3) g.put(k[i][0], k[i][1], C.glanz, oR);
  }
}, 720, { breite: 150, hoehe: 150 });

ppFxUeberschreiben('sand_reset', ppFx24SandReset);
ppFxUeberschreiben('shield_bubble', ppFx24ShieldBubble);
ppFxUeberschreiben('sky_crack', ppFx24SkyCrack);
