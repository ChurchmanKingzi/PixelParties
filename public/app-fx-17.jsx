// Pixelart-Portierungen (Canvas), Batch 17 (dritte Welle, alle übrigen Effekte): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte: anger_mark, annoying_cats, beer_bubbles, barrier_of_faith.
// Alle laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s): keine weichen Schatten, Scheine oder Verläufe, keine Emojis als Symbole —
// Zorn-Symbol, Katzen mit Flügel, Blasen und Schutzkuppel sind hart gezeichnete Pixelformen, Schein/Verlauf = Bayer-Dithering, Bewegung rechnet in Bildschirmpixeln und landet auf ganzen Rasterpixeln.
// Lebensdauer: alle vier laufen im Spiel als Zonen-Animation ohne `duration` vom Server → `onZoneAnim` räumt nach 1000 ms ab (`ZONEN_ANIM_DAUER` kennt sie nicht). Die alten Fassungen
// planten teils länger (Bier-Blasen bis 1300 ms, Katzen 3 Runden à ≥ 900 ms, Kuppel 1300 ms) und wurden hart abgeschnitten — hier ist jede Zeitachse auf ≤ 940 ms gestaucht (`ppFx17Fit`),
// damit der Ablauf zu Ende läuft (Ausblenden inklusive).
// Bereits Pixelart-Leinwand und deshalb hier NICHT angefasst: alliance_pact, animal_training_tame/_whip, ankhota_sandstorm, arcane_eyes_open, arnold_flex, atta_books, backstab_stab,
// bat_bite_drain, biseria_blizzard, black_flames, blessed_skill_burst (ppSalve/ppPunktBild/ppPunktFlug/ppR1Leinwand); anklage hängt mit dem Kartenbild (<img>) an einem echten DOM-Element.
// Bausteine aus app-fx-7.jsx (nur gelesen): ppFx7Bez (CSS-Kurven), ppFx7Kf (Keyframes).

// ── Bausteine (Präfix ppFx17) ───────────────────────────────────────────────────────────────────────────────────────────
const PP_FX17_ENDE = 940;
const ppFx17Eo = ppFx7Bez(0, 0, 0.58, 1);            // CSS ease-out
const ppFx17Eio = ppFx7Bez(0.42, 0, 0.58, 1);        // CSS ease-in-out
const ppFx17Pick = (l) => l[Math.floor(Math.random() * l.length)];
/** Stauchen: Start und Dauer so skalieren, dass `verzug + dauer` ≤ `ende` bleibt. */
function ppFx17Fit(verzug, dauer, ende) {
  const r = Math.min(1, (ende || PP_FX17_ENDE) / (verzug + dauer));
  return { verzug: verzug * r, dauer: dauer * r };
}
/** Runder Punkt mit Durchmesser `px` (Bildschirmpixel) um (x, y): 1 Rasterpixel, 2×2 oder Scheibe; Deckung `a` wird gedithert. */
function ppFx17Korn(g, x, y, px, c, a) {
  const d = px / (g.S || 3);
  if (d < 0.55 || a <= 0.02) return;
  if (d < 1.5) g.put(x, y, c, a);
  else if (d < 2.5) g.block(x - 1, y - 1, 2, 2, c, a);
  else g.disc(x, y, d / 2, c, a);
}
/** Pixelbild aus mehreren Teilen (je { bild, pal, x0, y0 } in Rasterpixeln) mit hartem Rand (1 Rasterpixel) in `rand`: erst alle Flächen, dann der Rand um alles Belegte. */
function ppFx17Gruppe(g, teile, rand, a) {
  const feld = new Map();
  for (const t of teile) {
    const h = t.bild.length, w = t.bild[0].length;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const c = t.pal[t.bild[j][i]];
      if (c) feld.set((t.y0 + j) * 4096 + (t.x0 + i), c);
    }
  }
  if (rand) {
    const raus = new Set();
    for (const k of feld.keys()) for (const dk of [1, -1, 4096, -4096]) if (!feld.has(k + dk)) raus.add(k + dk);
    for (const k of raus) { const y = Math.round(k / 4096), x = k - y * 4096; g.put(x, y, rand, a); }
  }
  for (const [k, c] of feld) { const y = Math.round(k / 4096), x = k - y * 4096; g.put(x, y, c, a); }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Anger Mark (`anger_mark`, Challenge / Anti-Magnet / Shield of Wisdom / Vena …) — PIXELART. Das rote Zornsymbol (vorher 💢, 52 px) poppt über der Zone auf und blendet aus:
//  Größe .3 → 1,2 (20 %) → 1 (35–70 %) → 1,3 (100 %), Deckung 0 → 1 (20 %) → 1 bis 70 % → 0, ease-in-out je Abschnitt, 1000 ms. Das Zeichen sind vier spitze Blütenblätter
//  (breit auf der Diagonale, zu den Achsen hin auslaufend), dunkelroter Rand, Licht oben links, Schatten unten rechts — in ganzen Rasterpixeln neu gezeichnet, nichts skaliert.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX17_ZORN = { rand: ppHex('#5b0102'), rot: ppHex('#ef2929'), dunkel: ppHex('#be0e0e'), hell: ppHex('#ff6666') };
/** Zornsymbol mit „Radius" R (Rasterpixel) um (cx, cy), Deckung `a` (gedithert). */
function ppFx17Zorn(g, cx, cy, R, a) {
  const P = PP_FX17_ZORN;
  cx = Math.round(cx); cy = Math.round(cy);
  if (a <= 0.02 || R < 1) return;
  if (R < 2.5) {                                          // winzig: Pluszeichen
    for (const [i, j] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) g.put(cx + i, cy + j, P.rot, a);
    return;
  }
  const Rn = Math.round(R), T = R * 0.6, n = Rn + 1, voll = new Set();
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const r = Math.sqrt(i * i + j * j);
    if (r > R + 0.35 || r < 0.5) continue;
    const th = Math.atan2(Math.abs(j), Math.abs(i)), dick = T * Math.pow(Math.sin(2 * th), 1.6);
    if (r >= R - dick) voll.add(j * 256 + i);
  }
  for (let j = -n - 1; j <= n + 1; j++) for (let i = -n - 1; i <= n + 1; i++) {
    const k = j * 256 + i;
    if (voll.has(k)) continue;
    if (voll.has(k + 1) || voll.has(k - 1) || voll.has(k + 256) || voll.has(k - 256)) g.put(cx + i, cy + j, P.rand, a);
  }
  for (const k of voll) {
    const j = Math.round(k / 256), i = k - j * 256, licht = (i + j) / (R * 1.4);
    g.put(cx + i, cy + j, licht < -0.55 ? P.hell : licht > 0.5 ? P.dunkel : P.rot, a);
  }
}
const ppFx17AngerMark = ppR1Leinwand((g, t, sz) => {
  const u = t / 1000;
  if (u > 1) return;
  const sc = ppFx7Kf(u, [[0, 0.3], [0.2, 1.2], [0.35, 1], [0.7, 1], [1, 1.3]], ppFx17Eio);
  const op = ppFx7Kf(u, [[0, 0], [0.2, 1], [0.7, 1], [1, 0]], ppFx17Eio);
  ppFx17Zorn(g, sz.cx, sz.cy, 7.5 * sc, op);
}, 1000, { breite: 132, hoehe: 132 }, { z: 10100 });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Beer (`beer_bubbles`, Beer / Waitress) — PIXELART. Ein goldener Blitz (drei harte Ringe: hell, gold, orange; Größe .3 → 1,3 → 1,6, Deckung 1 → .6 → 0 in 500 ms) und 18 Bierbläschen
//  (4–12 px, fünf Gelb-/Weißtöne mit hellem Glanzpunkt), die versetzt aufsteigen (80 px, seitliches Wiegen, erst größer, dann kleiner, Deckung .9 → .7 → 0). Kein Schein, kein Verlauf.
//  Zeiten (Start bis 300 ms, Dauer 500–1000 ms) auf ≤ 940 ms gestaucht.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX17_BIER = ppFx17Hex(['#fad54a', '#f8ca21', '#fff8e8', '#fbe181', '#ffffff']);
function ppFx17Hex(l) { return l.map(ppHex); }
const PP_FX17_BIERBLITZ = ppFx17Hex(['#f29a3e', '#fad54a', '#f7f7ad']);   // außen → innen
const ppFx17BierBlasen = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const bu = t / 500;                                                       // Goldblitz
  if (bu >= 0 && bu <= 1) {
    const sc = ppFx7Kf(bu, [[0, 0.3], [0.5, 1.3], [1, 1.6]], ppFx17Eo), a = ppFx7Kf(bu, [[0, 1], [0.5, 0.6], [1, 0]], ppFx17Eo);
    if (a > 0.03) {
      g.disc(cx, cy, 19.2 * sc / S, PP_FX17_BIERBLITZ[0], a);
      g.disc(cx, cy, 13 * sc / S, PP_FX17_BIERBLITZ[1], a);
      g.disc(cx, cy, 6.2 * sc / S, PP_FX17_BIERBLITZ[2], a);
    }
  }
  for (const b of d.blasen) {
    const u = (t - b.verzug) / b.dauer;
    if (u < 0 || u > 1) continue;
    const ty = ppFx7Kf(u, [[0, 0], [0.2, -15], [0.6, -45], [1, -80]], ppFx17Eo);
    const tx = ppFx7Kf(u, [[0, 0], [0.2, b.wiegen], [0.6, -b.wiegen / 2], [1, b.wiegen]], ppFx17Eo);
    const sc = ppFx7Kf(u, [[0, 0.5], [0.2, 1], [0.6, 1.1], [1, 0.4]], ppFx17Eo);
    const a = ppFx7Kf(u, [[0, 0], [0.2, 0.9], [0.6, 0.7], [1, 0]], ppFx17Eo);
    const px = b.size * sc;
    const x = cx + (b.xOff + b.size / 2 + tx) / S, y = cy + (10 - b.size / 2 + ty) / S;
    ppFx17Korn(g, x, y, px, b.farbe, a);
    if (px / S >= 2.6) g.put(x - 0.7, y - 0.7, PP_FX17_BIER[4], a);          // Glanzpunkt
  }
}, 1000, { breite: 132, hoehe: 171, ankerX: 66, ankerY: 129 }, {
  z: 10100,
  vorbereiten: () => ({
    blasen: Array.from({ length: ppFxN(18) }, () => {
      const fi = ppFx17Fit(Math.random() * 300, 500 + Math.random() * 500);
      return { xOff: -25 + Math.random() * 50, size: 4 + Math.random() * 8, farbe: ppFx17Pick(PP_FX17_BIER), wiegen: -8 + Math.random() * 16, ...fi };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Trial of Annoyance (`annoying_cats`) — PIXELART. Drei geflügelte Katzen (Tigerkatze, graue Katze von vorn, schwarze Katze; vorher 🪽 + 🐈/🐱/🐈‍⬛) schwirren auf eigenen Bahnen um die Zone
//  (je Katze eine Lissajous-ähnliche Schleife mit ungleichen Radien, wie die alten Keyframes annoyCatOrbit0–2), blenden ein und aus; der Flügel schlägt schneller als die Bahn (±1 Rasterpixel,
//  alle 180–260 ms). Hellblauer harter Rand um jede Katze wie vorher. Der Server schickt je gegnerischem Helden ein Ereignis (dreimal drei Katzen). Die alten Katzen flogen 3 Runden à ≥ 900 ms,
//  zu sehen waren wegen des Abräumens nach 1000 ms aber nur etwa 0,8 Runden — hier fliegt jede Katze EINE volle Runde, auf ≤ 940 ms gestaucht.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX17_KATZENRAND = ppHex('#7fdfff');
const PP_FX17_SEITE = ['x.x....x..', 'xooooooox.', 'oeooooooox', 'oooooooooo', '.ooooooooo', '.oo.oo.oo.', '.xx.xx.xx.'];
const PP_FX17_GESICHT = ['xo...ox', 'xooooox', 'ooooooo', 'oeooeoo', 'ooonooo', 'xooooox', '.xxxxx.'];
const PP_FX17_FLUEGEL = { oben: ['....WW', '..WWWW', '.WWWWB', 'WWWWBB', '.WWBB.', '..WB..', '...B..'], unten: ['......', '....WW', '..WWWW', '.WWWWB', 'WWWWBB', '.WWBB.', '..WB..'] };
const PP_FX17_FLUEGELPAL = { W: ppHex('#ffffff'), B: ppHex('#b4dff8') };
const PP_FX17_KATZEN = [
  { bild: PP_FX17_SEITE, pal: { o: ppHex('#f29a3e'), x: ppHex('#cf5f00'), e: ppHex('#282834') } },
  { bild: PP_FX17_GESICHT, pal: { o: ppHex('#d2d2db'), x: ppHex('#535353'), e: ppHex('#282834'), n: ppHex('#e92f38') } },
  { bild: PP_FX17_SEITE, pal: { o: ppHex('#282834'), x: ppHex('#535353'), e: ppHex('#fad54a') } },
];
// Bahnen (Bildschirmpixel, wie annoyCatOrbit0–2): [[u, dx, dy], …], linear
const PP_FX17_BAHN = [
  [[0, 0, 0], [0.25, 30, -14], [0.5, -6, -26], [0.75, -32, -8], [1, 0, 0]],
  [[0, 0, 0], [0.25, -26, -20], [0.5, 18, -32], [0.75, 34, 6], [1, 0, 0]],
  [[0, 0, 0], [0.25, 14, 22], [0.5, -30, 10], [0.75, -10, -24], [1, 0, 0]],
];
const ppFx17Lin = (x) => x;
const ppFx17AnnoyingCats = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  d.katzen.forEach((k, i) => {
    const u = (t - k.verzug) / k.dauer;
    if (u < 0 || u > 1) return;
    const bahn = PP_FX17_BAHN[i % 3];
    const dx = ppFx7Kf(u, bahn.map(p => [p[0], p[1]]), ppFx17Lin), dy = ppFx7Kf(u, bahn.map(p => [p[0], p[2]]), ppFx17Lin);
    const a = ppFx7Kf(u, [[0, 0], [0.1, 1], [0.9, 1], [1, 0]], ppFx17Lin);
    if (a <= 0.03) return;
    // Flügel: pendelt zwischen -2 und +2 px (ease-in-out, alternate); pro Rasterpixel zwei Stellungen
    const p = ((t - k.verzug) / k.flap) % 2, f = ppFx17Eio(p < 1 ? p : 2 - p), fy = Math.round((-2 + 4 * f) / S);
    const katze = PP_FX17_KATZEN[i % 3], kw = katze.bild[0].length, kh = katze.bild.length, fw = 6;
    const gw = fw + 1 + kw;
    const mx = cx + (dx + k.size) / S, my = cy + (dy + k.size * 0.58) / S;     // Mitte der Gruppe (Text links oben am Anker, ≈ 2 × Schriftgröße breit)
    const x0 = Math.round(mx - gw / 2), y0 = Math.round(my - kh / 2);
    ppFx17Gruppe(g, [
      { bild: PP_FX17_FLUEGEL[fy < 0 ? 'oben' : 'unten'], pal: PP_FX17_FLUEGELPAL, x0, y0 },
      { bild: katze.bild, pal: katze.pal, x0: x0 + fw + 1, y0 },
    ], PP_FX17_KATZENRAND, a);
  });
}, 1000, { breite: 240, hoehe: 192 }, {
  z: 10100,
  vorbereiten: () => ({
    katzen: Array.from({ length: 3 }, (_, i) => {
      const fi = ppFx17Fit(i * 120 + Math.random() * 90, 900 + i * 160 + Math.random() * 200);
      return { size: 15 + Math.random() * 6, flap: 180 + i * 40, ...fi };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Barrier of Faith (`barrier_of_faith`; vorher nur ein Alias auf `shield_bubble`) — PIXELART. Eine weiße Schutzkuppel (110 × 130 px) legt sich um den Helden:
//  Kern (Bayer-gedithertes Weiß → Hellblau, Lichtpunkt oben links, Innenglanz am Rand) wächst .2 → 1 (18 %) → 1,05 → 1,15, Deckung 0 → .95 → .85 → 0; der weiße Rand (ein Rasterpixel dick)
//  .4 → 1,02 → 1,08 → 1,18; ein schräger heller Streifen wandert 60 px über die Kuppel (nur innerhalb ihrer Ellipse); dazu ein gedithertes Außenleuchten statt des weichen Scheins.
//  Ursprünglich 1,3 s ease-out, hier auf 940 ms gestaucht (abgeräumt wird nach 1000 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX17_KUPPEL = { weiss: ppHex('#ffffff'), hell: ppHex('#e5f5fa'), blau: ppHex('#b3d8f9'), halo: ppHex('#e5edfa') };
const ppFx17Barrier = ppR1Leinwand((g, t, sz) => {
  const S = sz.S, cx = Math.round(sz.cx), cy = Math.round(sz.cy), P = PP_FX17_KUPPEL;
  const u = t / PP_FX17_ENDE;
  if (u > 1) return;
  const RXP = 55, RYP = 65;                                                  // Halbachsen in Bildschirmpixeln (110 × 130)
  const sK = ppFx7Kf(u, [[0, 0.2], [0.18, 1], [0.7, 1.05], [1, 1.15]], ppFx17Eo), oK = ppFx7Kf(u, [[0, 0], [0.18, 0.95], [0.7, 0.85], [1, 0]], ppFx17Eo);
  const sR = ppFx7Kf(u, [[0, 0.4], [0.22, 1.02], [0.85, 1.08], [1, 1.18]], ppFx17Eo), oR = ppFx7Kf(u, [[0, 0], [0.22, 1], [0.85, 0.6], [1, 0]], ppFx17Eo);
  const sG = ppFx7Kf(u, [[0, 0.85], [1, 1.1]], ppFx17Eo), tG = ppFx7Kf(u, [[0, -30], [1, 30]], ppFx17Eo);
  const oG = ppFx7Kf(u, [[0, 0], [0.25, 0.95], [0.6, 0.6], [1, 0]], ppFx17Eo);
  // Außenleuchten (statt box-shadow): gedithertes Weiß-Blau um den Rand, Breite ≈ 28 px, Stärke nach Rand/Kern
  const rxR = RXP * sR / S, ryR = RYP * sR / S, rxK = RXP * sK / S, ryK = RYP * sK / S;
  const halo = Math.max(oK * 0.85, oR * 0.7), reich = 26 / S;
  if (halo > 0.04) {
    const mR = Math.sqrt(rxK * ryK), sOut = 1 + reich / mR, RY = Math.ceil(ryK * sOut);
    for (let j = -RY; j <= RY; j++) {
      const v2 = j * j / (ryK * ryK), au = sOut * sOut - v2;
      if (au <= 0) continue;
      const iIn = Math.floor(rxK * Math.sqrt(Math.max(0, 1 - v2))), iOut = Math.ceil(rxK * Math.sqrt(au));
      for (let i = iIn; i <= iOut; i++) {
        const sK2 = Math.sqrt(i * i / (rxK * rxK) + v2);
        if (sK2 <= 1) continue;
        const aus = (sK2 - 1) * mR / reich;                                  // Abstand zum Kern in „Reichweiten"
        if (aus >= 1) continue;
        const w = (1 - aus) * (1 - aus) * halo * 0.6;
        if (w > 0.03) { g.put(cx + i, cy + j, P.halo, w); if (i) g.put(cx - i, cy + j, P.halo, w); }
      }
    }
  }
  // Kern: Verlauf um den Lichtpunkt (35 % / 30 %), farthest-corner-Radius 115,7 px (lokal, vor der Skalierung); Innenglanz am Rand
  if (oK > 0.02) {
    const RX = Math.ceil(rxK), RY = Math.ceil(ryK), fx = -16.5, fy = -26;
    for (let j = -RY; j <= RY; j++) for (let i = -RX; i <= RX; i++) {
      const s2 = i * i / (rxK * rxK) + j * j / (ryK * ryK);
      if (s2 > 1) continue;
      const lx = i * S / sK, ly = j * S / sK, dd = Math.sqrt((lx - fx) * (lx - fx) + (ly - fy) * (ly - fy)) / 115.7;
      let a = dd < 0.35 ? 0.85 - 0.3 * (dd / 0.35) : dd < 0.65 ? 0.55 - 0.37 * ((dd - 0.35) / 0.3) : dd < 0.78 ? 0.18 * (1 - (dd - 0.65) / 0.13) : 0;
      const rand = 1 - Math.sqrt(s2);                                        // 0 am Rand
      a = Math.max(a, rand < 0.18 ? 0.55 * (1 - rand / 0.18) : 0);
      if (a < 0.04) continue;
      g.put(cx + i, cy + j, dd < 0.22 || rand < 0.08 ? P.weiss : dd < 0.5 ? P.hell : P.blau, a * oK);
    }
  }
  // Streifen (115°, zwischen 38 % und 60 % des Verlaufs): wandert mit seiner eigenen Ellipse nach rechts
  if (oG > 0.03) {
    const rxG = RXP * sG / S, ryG = RYP * sG / S, mx = cx + tG / S, RX = Math.ceil(rxG), RY = Math.ceil(ryG), L = 154.7;
    for (let j = -RY; j <= RY; j++) for (let i = -RX; i <= RX; i++) {
      if (i * i / (rxG * rxG) + j * j / (ryG * ryG) > 1) continue;
      const p = 0.5 + ((i * S / sG) * 0.906 + (j * S / sG) * 0.423) / L;
      const a = p < 0.38 ? 0 : p < 0.48 ? 0.95 * ((p - 0.38) / 0.1) : p < 0.53 ? 0.95 - 0.55 * ((p - 0.48) / 0.05) : p < 0.6 ? 0.4 * (1 - (p - 0.53) / 0.07) : 0;
      if (a > 0.04) g.put(Math.round(mx) + i, cy + j, P.weiss, a * oG);
    }
  }
  if (oR > 0.03) g.ellRing(cx, cy, rxR, ryR, 1, P.weiss, oR);
}, 1000, { breite: 198, hoehe: 231 }, { z: 10100 });

// ── Registrierung ───────────────────────────────────────────────────────────────────────────────────────────────────────
ppFxUeberschreiben('anger_mark', ppFx17AngerMark);
ppFxUeberschreiben('beer_bubbles', ppFx17BierBlasen);
ppFxUeberschreiben('annoying_cats', ppFx17AnnoyingCats);
ppFxUeberschreiben('barrier_of_faith', ppFx17Barrier);
