// Pixelart-Portierungen (Canvas), Batch 23 (dritte Welle, alle übrigen Effekte): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte: pink_sky_puff, piranha_bite, poison_ooze, poison_tick, poison_vial, puppet_luck, puppet_swap_laki (Gold-Funkeln), puppet_swap_saras (Diamant-Funkeln), puppet_swap_vinny, puppet_preserve (Schutzblase).
// NICHT portiert (laufen schon auf Canvas): pink_hearts, prank_bucket, pythia_flames (`ppPunktBild`), point_blank_blast (`ppSalve`), polymorph_poof, redirect_aura, red_cut (`ppSzene`).
// Alle laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s) mit den Ankern, Zeiten und Zahlen der DOM-Fassungen in `ANIM_REGISTRY` (app-board.jsx, Keyframes
// in style.css). Alle Aufrufer laufen mit der Standard-Dauer 1000 ms (`onZoneAnim`); Teilchen, deren DOM-Fassung über 1000 ms hinausragte (und dort hart abgeschnitten wurde), laufen hier verkürzt aus
// (`ppFx23Lauf`). Pixelart-Regeln: nur Palettenfarben, Deckung < 1 = Bayer-Dithering, Schein/Verlauf = Dither-Dichte plus Farbstufen (`ppFx23Fleck`), Symbole (Totenkopf, Zähne) = Pixelbilder bzw. hart gefüllte Dreiecke.

// ── Bausteine (Präfix ppFx23 / PP_FX23) ───────────────────────────────────────────────────────────────────
const ppFx23Zufall = (a, b) => a + Math.random() * (b - a);
const ppFx23Wahl = (l) => l[Math.floor(Math.random() * l.length)];
const ppFx23Hex = (l) => l.map(ppHex);
const ppFx23Eo = (u) => 1 - (1 - u) * (1 - u);
/** Fortschritt u (0..1) eines Teilchens mit Verzug und Dauer; Dauer wird so gekürzt, dass es spätestens bei `ende` fertig ist (`null` = nicht sichtbar). */
function ppFx23Lauf(t, verzug, dauer, ende) {
  const d = Math.max(60, Math.min(dauer, ende - verzug));
  const u = (t - verzug) / d;
  return (u < 0 || u > 1) ? null : u;
}
/** CSS-`cubic-bezier(x1, y1, x2, y2)` als Funktion x → y (für `ppKf` als `ease`). */
function ppFx23Bez(x1, y1, x2, y2) {
  const kurve = (a, b, s) => 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (kurve(x1, x2, m) < x) lo = m; else hi = m; }
    return kurve(y1, y2, (lo + hi) / 2);
  };
}
const ppFx23EaseIn = ppFx23Bez(0.42, 0, 1, 1);
const ppFx23EaseKiefer = ppFx23Bez(0.34, 1.56, 0.64, 1);   // `cubic-bezier(0.34, 1.56, 0.64, 1)` der Kiefer (überschwingt)
/** Kleine Kugel mit Durchmesser `d` Rasterpixeln: 1 Pixel, 2×2 oder Scheibe (ab 3 mit Glanzpunkt). */
function ppFx23Kugel(g, x, y, d, c, hell, a = 1) {
  if (a <= 0.02 || d <= 0.3) return;
  if (d < 1.5) g.put(x, y, c, a);
  else if (d < 2.5) g.block(x - 1, y - 1, 2, 2, c, a);
  else { g.disc(x, y, d / 2 - 0.3, c, a); if (hell && d >= 3.5) g.put(x - d * 0.18, y - d * 0.18, hell, a); }
}
/** Schein um einen Ring (Radius r): Dichte fällt von dort auf `breite` Rasterpixel nach außen auf 0 (ersetzt `box-shadow`). */
function ppFx23Hof(g, cx, cy, r, breite, c, a) {
  if (a <= 0.01 || breite <= 0) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const R = Math.ceil(r + breite);
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    const ab = Math.sqrt(i * i + j * j) - r;
    if (ab <= 0 || ab > breite) continue;
    if ((1 - ab / breite) * a > ppBayer(cx + i, cy + j)) g.put(cx + i, cy + j, c, 1);
  }
}
/** Schein um eine Ellipse (Halbmesser rx, ry): Dichte fällt nach außen auf `breite` Rasterpixel auf 0 (Abstand genähert). */
function ppFx23HofEll(g, cx, cy, rx, ry, breite, c, a) {
  if (a <= 0.01 || breite <= 0 || rx < 1 || ry < 1) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const m = Math.min(rx, ry), RX = Math.ceil(rx + breite), RY = Math.ceil(ry + breite);
  for (let j = -RY; j <= RY; j++) for (let i = -RX; i <= RX; i++) {
    const e = Math.sqrt((i * i) / (rx * rx) + (j * j) / (ry * ry));
    if (e <= 1) continue;
    const ab = (e - 1) * m;
    if (ab > breite) continue;
    if ((1 - ab / breite) * a > ppBayer(cx + i, cy + j)) g.put(cx + i, cy + j, c, 1);
  }
}
/**
 * CSS-Verlauf (`radial-gradient` in einer Ellipse/einem Rechteck) als Dither-Fläche. o:
 *   S Rastermaß · sk Skalierung des Elements · hx, hy Halbmaße des Elements (px, vor der Skalierung) · rect (true = Rechteck, sonst Ellipse)
 *   rgx, rgy Radien des Verlaufs (px; rgy fehlt = Kreis) · ox, oy Mittelpunkt des Verlaufs gegen die Elementmitte (px)
 *   stops [[Lage 0..1 des Verlaufsradius, Dichte, Farbe ab dieser Lage], …] · a Gesamtdeckung
 */
function ppFx23Fleck(g, cx, cy, o) {
  const { S, hx, hy, rect, rgx, ox = 0, oy = 0, stops, a = 1 } = o;
  const sk = o.sk == null ? 1 : o.sk, rgy = o.rgy || rgx;
  if (a <= 0.01 || sk <= 0.02) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const RX = Math.ceil(hx * sk / S) + 1, RY = Math.ceil(hy * sk / S) + 1, k = S / sk, n = stops.length, ende = stops[n - 1][0];
  for (let j = -RY; j <= RY; j++) {
    const py = j * k;
    for (let i = -RX; i <= RX; i++) {
      const px = i * k;
      if (rect ? (Math.abs(px) > hx || Math.abs(py) > hy) : ((px * px) / (hx * hx) + (py * py) / (hy * hy) > 1)) continue;
      const dx = (px - ox) / rgx, dy = (py - oy) / rgy, f = Math.sqrt(dx * dx + dy * dy);
      if (f >= ende) continue;
      let s = 0;
      while (s + 2 < n && f >= stops[s + 1][0]) s++;
      const q = (f - stops[s][0]) / ((stops[s + 1][0] - stops[s][0]) || 1), dichte = (stops[s][1] + (stops[s + 1][1] - stops[s][1]) * q) * a;
      if (dichte > ppBayer(cx + i, cy + j)) g.put(cx + i, cy + j, stops[s][2], 1);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════
//  Funkeln (puppet_swap_laki, puppet_luck: Gold · puppet_swap_saras: Diamant) — PIXELART, 1000 ms. Wie `GoldSparkleEffect` / `DiamondSparkleEffect`: ein Blitz (`.anim-gold-flash` 500 ms bzw.
//  `.anim-diamond-flash` 550 ms: .3 → 1,3 → 1,6 mal, Deckung 1 → .6 → 0; Gold in drei harten Ringen in den Münzfarben, Diamant als eisiger Verlauf = Dither-Stufen) und 12 bzw. 14 Funken, die vom Mittelpunkt
//  nach außen sprühen (12–37 bzw. 14–40 px, 3–8 px groß, schrumpfen von 1,2 auf 0, Deckung 1 bis 20 %, dann aus). Verzug 0–150 ms, Dauer .4–.8 s. Der Schein der Funken ist ein kleiner Dither-Hof.
// ═════════════════════════════════════════════════════════════════════════════════════
const PP_FX23_GOLD = ppFx23Hex(['#fad54a', '#fad54a', '#f7f7ad', '#ffffff', '#f29a3e']);
const PP_FX23_GOLDRING = ppFx23Hex(['#f29a3e', '#fad54a', '#f7f7ad']);
const PP_FX23_DIAMANT = ppFx23Hex(['#ffffff', '#bddcef', '#68c6fd', '#e5f5fa', '#b4dff8', '#d9c0ec']);
const PP_FX23_DIAMANTSCHEIN = ppFx23Hex(['#68c6fd', '#b4dff8', '#ffffff']);
function ppFx23Funkeln(diamant) {
  return ppR1Leinwand((g, t, sz, te) => {
    const S = sz.S, cx = sz.cx, cy = sz.cy;
    if (diamant) {
      const u = t / 550;
      if (u <= 1) {
        const [sc, op] = ppKf(u, [[0, [0.3, 1]], [0.5, [1.4, 0.7]], [1, [1.7, 0]]]);
        ppFx23Fleck(g, cx, cy, { S, sk: sc, hx: 22, hy: 22, rgx: 31.1, a: op,
          stops: [[0, 0.95, PP_FX23_DIAMANTSCHEIN[2]], [0.3, 0.65, PP_FX23_DIAMANTSCHEIN[1]], [0.55, 0.3, PP_FX23_DIAMANTSCHEIN[0]], [0.75, 0, PP_FX23_DIAMANTSCHEIN[0]]] });
      }
    } else {
      const u = t / 500;
      if (u <= 1) {
        const [sc, op] = ppKf(u, [[0, [0.3, 1]], [0.5, [1.3, 0.6]], [1, [1.6, 0]]]);   // harte Ringe: Halbmesser 19,2 / 13 / 6,2 px (22/46/68 % des Verlaufs, im 20-px-Kreis)
        g.disc(cx, cy, 19.2 * sc / S, PP_FX23_GOLDRING[0], op);
        g.disc(cx, cy, 13 * sc / S, PP_FX23_GOLDRING[1], op);
        g.disc(cx, cy, 6.2 * sc / S, PP_FX23_GOLDRING[2], op);
      }
    }
    for (const p of te.teile) {
      const u = ppFx23Lauf(t, p.verzug, p.dauer, 1000);
      if (u === null) continue;
      const f = ppFx23Eo(u), sc = 1.2 * (1 - f), op = u < 0.2 ? 1 : 1 - ppFx23Eo((u - 0.2) / 0.8);
      const d = p.size * sc / S, x = cx + p.dx * f / S, y = cy + p.dy * f / S;
      if (d >= 1.5) ppFx23Hof(g, x, y, d / 2, 2, p.farbe, op * 0.35);
      ppFx23Kugel(g, x, y, d, p.farbe, null, op);
    }
  }, 1000, { breite: 168, hoehe: 168 }, {
    z: 10100,
    vorbereiten: () => ({
      teile: Array.from({ length: ppFxN(diamant ? 14 : 12) }, () => {
        const w = Math.random() * Math.PI * 2, v = diamant ? ppFx23Zufall(14, 40) : ppFx23Zufall(12, 37);
        return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: ppFx23Zufall(3, 8), farbe: ppFx23Wahl(diamant ? PP_FX23_DIAMANT : PP_FX23_GOLD), verzug: Math.random() * 150, dauer: ppFx23Zufall(400, 800) };
      }),
    }),
  });
}
const ppFx23GoldFunkeln = ppFx23Funkeln(false);
const ppFx23DiamantFunkeln = ppFx23Funkeln(true);

// ═════════════════════════════════════════════════════════════════════════════════════
//  Schutzblase (puppet_swap_vinny, puppet_preserve; `ShieldBubbleEffect`) — PIXELART. Eine weiße Kuppel (110×130 px) schließt den Platz ein: Kern (Verlauf von links oben, Dither-Stufen weiß → hellblau),
//  harter Rand (Ellipsenring) mit Dither-Hof, und ein schräger heller Streifen, der über die Kuppel wandert. Die DOM-Fassung lief 1,3 s, wurde aber bei 1000 ms hart abgeschnitten — hier ist die ganze Kurve auf
//  1000 ms gestaucht (Kern .2 → 1 → 1,05 → 1,15 mal, Deckung 0 → .95 → .85 → 0; Rand .4 → 1,02 → 1,08 → 1,18, Deckung 0 → 1 → .6 → 0; Streifen −30 → +30 px, .85 → 1,1 mal).
// ═════════════════════════════════════════════════════════════════════════════════════
const PP_FX23_BLASE = ppFx23Hex(['#ffffff', '#e5f5fa', '#b3d8f9', '#e5edfa']);
const ppFx23Schutzblase = ppR1Leinwand((g, t, sz) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, u = Math.min(1, t / 1000), W = PP_FX23_BLASE[0], E = PP_FX23_BLASE[1], B = PP_FX23_BLASE[2], H = PP_FX23_BLASE[3];
  // Kern (mit Schein außen): radial-gradient(circle at 35% 30%, weiß .85 → #e5f5fa .55 @35 % → #b3d8f9 .18 @65 % → 0 @78 %), Radius 115,7 px
  const [sk, op] = ppKf(u, [[0, [0.2, 0]], [0.18, [1, 0.95]], [0.7, [1.05, 0.85]], [1, [1.15, 0]]]);
  ppFx23HofEll(g, cx, cy, 55 * sk / S, 65 * sk / S, 6, H, op * 0.22);
  ppFx23Fleck(g, cx, cy, { S, sk, hx: 55, hy: 65, rgx: 115.7, ox: -16.5, oy: -26, a: op,
    stops: [[0, 0.85, W], [0.35, 0.55, E], [0.65, 0.18, B], [0.78, 0, B]] });
  // schräger Glanzstreifen (115°-Verlauf: 38 % → 48 % hell .95 → 53 % .4 → 60 % aus), wandert von −30 nach +30 px
  const [tx, gs] = ppKf(u, [[0, [-30, 0.85]], [1, [30, 1.1]]]), go = ppKf(u, [[0, [0]], [0.25, [0.95]], [0.6, [0.6]], [1, [0]]])[0];
  if (go > 0.02) {
    const k = S / gs;
    for (let j = -Math.ceil(65 * gs / S); j <= Math.ceil(65 * gs / S); j++) for (let i = -Math.ceil(55 * gs / S) - 12; i <= Math.ceil(55 * gs / S) + 12; i++) {
      const lx = (i * S - tx) / gs, ly = j * k;
      if ((lx * lx) / (55 * 55) + (ly * ly) / (65 * 65) > 1) continue;
      const p = 0.5 + (lx * 0.9063 + ly * 0.4226) / 154.6;
      const dichte = p < 0.38 ? 0 : p < 0.48 ? (p - 0.38) / 0.1 * 0.95 : p < 0.53 ? 0.95 - (p - 0.48) / 0.05 * 0.55 : p < 0.6 ? 0.4 * (1 - (p - 0.53) / 0.07) : 0;
      if (dichte * go > ppBayer(Math.round(cx) + i, Math.round(cy) + j)) g.put(Math.round(cx) + i, Math.round(cy) + j, W, 1);
    }
  }
  // Rand: 2 px weißer Ring, innen ein dünner heller Saum, außen ein Dither-Hof
  const [sr, orr] = ppKf(u, [[0, [0.4, 0]], [0.22, [1.02, 1]], [0.85, [1.08, 0.6]], [1, [1.18, 0]]]);
  const rx = 55 * sr / S, ry = 65 * sr / S;
  ppFx23HofEll(g, cx, cy, rx, ry, 5, H, orr * 0.22);
  g.ellRing(cx, cy, rx - 1, ry - 1, 2, E, orr * 0.5);
  g.ellRing(cx, cy, rx, ry, 1, W, orr);
}, 1000, { breite: 240, hoehe: 270 }, { z: 10100 });

// ═════════════════════════════════════════════════════════════════════════════════════
//  Gift-Blasen (poison_tick, poison_vial; wie `.anim-beer-bubble`): violetter Blitz (`.anim-gold-flash`, 500 ms, .3 → 1,3 → 1,6 mal, Deckung 1 → .6 → 0; Verlauf = Dither-Dichte) und Blasen, die aus ±25 px
//  (Fläschchen ±30) um die Mitte aufsteigen (Start 10 px unter dem Anker; .5 → 1 → 1,1 → .4 mal, Deckung 0 → .9 → .7 → 0, 80 px hoch, seitlich schwankend). Das Fläschchen hat zusätzlich fünf Totenkopf-Blasen
//  (14 px, violette Scheibe .6 mit weißem Pixel-Totenkopf statt 💀). Verzug/Dauer der Blasen wie im Original, auf 1000 ms gekürzt.
// ═════════════════════════════════════════════════════════════════════════════════════
const PP_FX23_GIFT = ppFx23Hex(['#9544d5', '#702db3', '#b866ff', '#6618b4', '#c98aff']);
const PP_FX23_VIAL = ppFx23Hex(['#6618b4', '#903ae6', '#6618b4', '#a952ff', '#50008c']);
const PP_FX23_GIFTGLANZ = ppHex('#d9c0ec');
const PP_FX23_SCHAEDEL = ['.WWW.', 'WKWKW', 'WWWWW', '.WWW.', '.W.W.'];
const PP_FX23_SCHAEDELFARBE = { W: ppHex('#ffffff'), K: ppHex('#50008c') };
function ppFx23GiftBlase(g, t, b, cx, cy, S) {
  const u = ppFx23Lauf(t, b.verzug, b.dauer, 1000);
  if (u === null) return;
  const [op, dy, dx, sc] = ppKf(u, [[0, [0, 0, 0, 0.5]], [0.2, [0.9, -15, b.wobble, 1]], [0.6, [0.7, -45, -b.wobble * 0.5, 1.1]], [1, [0, -80, b.wobble, 0.4]]]);
  const d = b.size * sc / S, x = cx + (b.xOff + b.size / 2 + dx) / S, y = cy + (10 - b.size / 2 + dy) / S;
  if (b.schaedel) {
    if (d >= 2.5) g.disc(x, y, d / 2 - 0.2, b.farbe, op * 0.6); else ppFx23Kugel(g, x, y, d, b.farbe, null, op * 0.6);
    if (d >= 4) g.spr(PP_FX23_SCHAEDEL, PP_FX23_SCHAEDELFARBE, x, y, op);
  } else if (d >= 2.5) { g.disc(x, y, d / 2 - 0.2, b.farbe, op); if (d >= 3) g.put(x - d * 0.2, y - d * 0.2, PP_FX23_GIFTGLANZ, op); }
  else ppFx23Kugel(g, x, y, d, b.farbe, null, op);
}
function ppFx23Gift(vial) {
  const SKHOCH = ppHex('#9544d5');
  return ppR1Leinwand((g, t, sz, te) => {
    const S = sz.S, cx = sz.cx, cy = sz.cy, u = t / 500;
    if (u <= 1) {
      const [sc, op] = ppKf(u, [[0, [0.3, 1]], [0.5, [1.3, 0.6]], [1, [1.6, 0]]]);
      ppFx23Fleck(g, cx, cy, { S, sk: sc, hx: 20, hy: 20, rgx: 28.28, a: op,
        stops: vial ? [[0, 0.9, PP_FX23_VIAL[0]], [0.4, 0.4, PP_FX23_VIAL[4]], [0.7, 0, PP_FX23_VIAL[4]]] : [[0, 0.8, PP_FX23_GIFT[3]], [0.4, 0.3, PP_FX23_GIFT[3]], [0.7, 0, PP_FX23_GIFT[3]]] });
    }
    for (const b of te.blasen) ppFx23GiftBlase(g, t, b, cx, cy, S);
    if (vial) for (const b of te.schaedel) ppFx23GiftBlase(g, t, b, cx, cy, S);
  }, 1000, { breite: 168, hoehe: 168, ankerY: 120 }, {
    z: vial ? 10110 : 10100,      // Poison Vial liegt über gleichzeitigen Goldfunkeln (`gold_sparkle`, 10100): sonst deckt dessen Scheibe die Giftblasen zu (Tutorial 5, Alchemy + Poison Vial auf Fiona)
    vorbereiten: () => ({
      blasen: Array.from({ length: ppFxN(vial ? 12 : 14) }, () => vial
        ? { xOff: ppFx23Zufall(-30, 30), size: ppFx23Zufall(6, 16), verzug: Math.random() * 200, dauer: ppFx23Zufall(500, 1000), farbe: ppFx23Wahl(PP_FX23_VIAL), wobble: ppFx23Zufall(-10, 10) }
        : { xOff: ppFx23Zufall(-25, 25), size: ppFx23Zufall(4, 11), verzug: Math.random() * 250, dauer: ppFx23Zufall(400, 800), farbe: ppFx23Wahl(PP_FX23_GIFT), wobble: ppFx23Zufall(-8, 8) }),
      schaedel: vial ? Array.from({ length: 5 }, () => ({ xOff: ppFx23Zufall(-20, 20), size: 14, verzug: ppFx23Zufall(200, 500), dauer: ppFx23Zufall(600, 1000), farbe: SKHOCH, wobble: 0, schaedel: true })) : [],
    }),
  });
}
const ppFx23PoisonTick = ppFx23Gift(false);
const ppFx23PoisonVial = ppFx23Gift(true);

// ═════════════════════════════════════════════════════════════════════════════════════
//  Poison Ooze (`poison_ooze`) — PIXELART, 1000 ms: 14 violette Tropfen (6–16 px, Tropfenform mit Ecke unten links) lösen sich 10 px über dem Anker bei ±30 px, fallen 20–70 px (ease-in; .5 → 1 → .6 mal,
//  Deckung 0 → .7 → 0, Verzug 0–400 ms, Dauer .6–1,1 s), und ab 300 ms breitet sich eine violette Lache (50×20 px, Mitte 15 px unter dem Anker, .3 → 1,5 mal, Deckung 0 → .7 → 0 in .8 s) aus.
//  Lache und Tropfen mit Dither-Dichte statt Verlauf/Schein; was über 1000 ms hinausragte, läuft hier verkürzt aus.
// ═════════════════════════════════════════════════════════════════════════════════════
const PP_FX23_OOZE = ppFx23Hex(['#6618b4', '#903ae6', '#c98aff']);
const ppFx23PoisonOoze = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX23_OOZE;
  const up = ppFx23Lauf(t, 300, 800, 1000);
  if (up !== null) {
    const [sc, op] = [ppKf(up, [[0, [0.3]], [1, [1.5]]])[0], ppKf(up, [[0, [0]], [0.4, [0.7]], [1, [0]]])[0]];
    ppFx23Fleck(g, cx, cy + 15 / S, { S, sk: sc, hx: 25, hy: 10, rgx: 35.36, rgy: 14.14, a: op,
      stops: [[0, 0.6, C[1]], [0.7, 0.2, C[0]], [1.1, 0.2, C[0]]] });
  }
  for (const d of te.tropfen) {
    const u = ppFx23Lauf(t, d.verzug, d.dauer, 1000);
    if (u === null) continue;
    const [op, dy, sc] = ppKf(u, [[0, [0, -5, 0.5]], [0.2, [0.7, 0, 1]], [1, [0, d.endY, 0.6]]], ppFx23EaseIn);
    const r = d.size * sc / S, x = cx + (d.dx + d.size / 2) / S, y = cy + (-10 + d.size / 2 + dy) / S;
    if (r >= 2.5) {
      g.disc(x, y, r / 2 - 0.2, C[0], op);
      g.disc(x - r * 0.08, y - r * 0.1, r / 2 * 0.62, C[1], op);
      if (r >= 3) g.put(x - r * 0.22, y - r * 0.22, C[2], op);
      g.put(x - r / 2 + 0.4, y + r / 2 - 0.4, C[0], op);   // die Ecke unten links
    } else ppFx23Kugel(g, x, y, r, C[0], null, op);
  }
}, 1000, { breite: 168, hoehe: 132, ankerY: 36 }, {
  z: 10100,
  vorbereiten: () => ({
    tropfen: Array.from({ length: ppFxN(14) }, () => ({ dx: ppFx23Zufall(-30, 30), verzug: Math.random() * 400, dauer: ppFx23Zufall(600, 1100), size: ppFx23Zufall(6, 16), endY: ppFx23Zufall(20, 70) })),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════
//  Pollution Piranha: Biss (`piranha_bite`) — PIXELART, 650 ms (Rest = Spritzer bis 1000 ms): roter Aufbruch-Blitz über der Karte (Rechteck, Verlauf rot → dunkelrot als Dither-Dichte, .6 → 1 → 1,1 mal,
//  Deckung 0 → 1 → 0), zwei Reihen weißer Dreieckszähne (6 je Reihe, 11–13 × 16–21 px) schnappen von oben und unten zu (±75 px → ±6 px → ±14 px → ±75 px; die Kurve überschwingt wie das
//  `cubic-bezier(.34, 1.56, .64, 1)` des Originals, die Deckung 0 → 1 → 0 ebenfalls — die Zähne sind deshalb nur kurz rund um das Zuschnappen zu sehen) und acht rote Blutspritzer (6–15 px,
//  18–58 px weit; Verzug .15–.33 s, Dauer .5–.8 s, auf 1000 ms gekürzt). Zähne tragen unten einen dunkelroten Schlagschatten (eine Pixelreihe). Maße folgen der Zonengröße (`w`, `h`).
// ═════════════════════════════════════════════════════════════════════════════════════
const PP_FX23_BISS = ppFx23Hex(['#ffffff', '#b5171c', '#780014', '#e92f38', '#f3bad3']);
function ppFx23Zaehne(g, cx, cy, jawY, zaehne, oben, a, S) {
  if (a <= 0.02) return;
  const W = PP_FX23_BISS[0], D = PP_FX23_BISS[2], R = PP_FX23_BISS[4];
  for (let pass = 0; pass < 2; pass++) {
    for (const z of zaehne) {
      const h = Math.max(2, Math.round(z.sizeH / S)), bw = Math.max(2, Math.round(z.sizeW / S)), x0 = Math.round(cx + z.x / S), by = Math.round(cy + jawY / S);
      for (let j = 0; j < h; j++) {
        const w = Math.max(1, Math.ceil(bw * (1 - j / h))), y = oben ? by + j : by - 1 - j;
        const xa = x0 - Math.floor(w / 2);
        if (pass === 0) { if (j === h - 1) g.block(xa, oben ? y + 1 : y - 1, w, 1, D, a * 0.7); }
        else for (let i = 0; i < w; i++) g.put(xa + i, y, (w >= 3 && i === w - 1) ? R : W, a);
      }
    }
  }
}
const ppFx23PiranhaBite = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX23_BISS, u = t / 650;
  if (u <= 1) {
    const [sc, op] = ppKf(u, [[0, [0.6, 0]], [0.35, [1, 1]], [1, [1.1, 0]]]);
    const hx = (te.cw - 8) / 2, hy = (te.ch - 8) / 2;
    ppFx23Fleck(g, cx, cy, { S, sk: sc, hx, hy, rect: true, rgx: hx * 1.4142, rgy: hy * 1.4142, a: op,
      stops: [[0, 0.75, C[1]], [0.45, 0.55, C[2]], [0.8, 0, C[2]]] });
    const oy = ppKf(u, [[0, [-75]], [0.6, [-6]], [0.78, [-14]], [1, [-75]]], ppFx23EaseKiefer)[0];
    const by = ppKf(u, [[0, [75]], [0.6, [6]], [0.78, [14]], [1, [75]]], ppFx23EaseKiefer)[0];
    const jo = Math.max(0, Math.min(1, ppKf(u, [[0, [0]], [0.3, [1]], [1, [0]]], ppFx23EaseKiefer)[0]));
    ppFx23Zaehne(g, cx, cy, oy, te.zaehne, true, jo, S);
    ppFx23Zaehne(g, cx, cy, by, te.zaehne, false, jo, S);
  }
  for (const s of te.spritzer) {
    const v = ppFx23Lauf(t, s.verzug, s.dauer, 1000);
    if (v === null) continue;
    const [op, f, sc] = ppKf(v, [[0, [0, 0, 0.3]], [0.3, [1, 0.3, 0.45]], [1, [0, 1, 0.7]]]);
    const d = s.size * sc / S, x = cx + s.dx * f / S, y = cy + s.dy * f / S;
    if (d >= 2.5) { g.disc(x, y, d / 2 - 0.2, C[2], op); g.disc(x - d * 0.06, y - d * 0.06, d / 2 * 0.72, C[3], op); }
    else ppFx23Kugel(g, x, y, d, C[3], null, op);
  }
}, 1000, (p) => ({ breite: Math.max(240, (p.w || 100) * 1.25 + 90), hoehe: Math.max(240, (p.h || 140) * 1.25 + 120) }), {
  z: 10110,
  vorbereiten: (sz) => ({
    cw: sz.props.w || 100, ch: sz.props.h || 140,
    spritzer: Array.from({ length: ppFxN(8) }, () => {
      const w = Math.random() * Math.PI * 2, dist = ppFx23Zufall(18, 58);
      return { dx: Math.cos(w) * dist, dy: Math.sin(w) * dist + 8, size: ppFx23Zufall(6, 15), verzug: ppFx23Zufall(150, 330), dauer: ppFx23Zufall(500, 800) };
    }),
    zaehne: Array.from({ length: ppFxN(6) }, (_, i) => ({ x: -38 + i * 15 + (Math.random() - 0.5) * 2, sizeW: ppFx23Zufall(11, 13), sizeH: ppFx23Zufall(16, 21) })),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════
//  Pink Sky Puff (`pink_sky_puff`) — PIXELART, ~920 ms: sieben rosa Wölkchen (12–28 px breit, 72 % hoch) fliegen elliptisch (16–34 × 10–24 px, 8 px nach oben) vom Mittelpunkt nach außen
//  (.4 → 1 bei 22 % und 35 % des Wegs → 1,25 mal, Deckung 0 → 1 → 0; Verzug 0–160 ms, Dauer 760 ms). Der Verlauf (weiß → #fae5eb → rosa, ausfransend) ist Dither-Dichte mit drei harten Farbstufen.
// ═════════════════════════════════════════════════════════════════════════════════════
const PP_FX23_WOLKE = ppFx23Hex(['#ffffff', '#fae5eb', '#f3bad3']);
const ppFx23PinkSkyPuff = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX23_WOLKE;
  for (const f of te.flocken) {
    const u = (t - f.verzug) / 760;
    if (u < 0 || u > 1) continue;
    const [op, k, sc] = ppKf(u, [[0, [0, 0, 0.4]], [0.22, [1, 0.35, 1]], [1, [0, 1, 1.25]]]);
    ppFx23Fleck(g, cx + f.dx * k / S, cy + f.dy * k / S, { S, sk: sc, hx: f.g / 2, hy: f.g * 0.36, rgx: f.g * 0.73, ox: -0.08 * f.g, oy: -0.0864 * f.g, a: op,
      stops: [[0, 1, C[0]], [0.28, 1, C[1]], [0.55, 1, C[1]], [0.66, 0.5, C[2]], [0.78, 0, C[2]]] });
  }
}, 1000, { breite: 168, hoehe: 150 }, {
  z: 10100,
  vorbereiten: () => ({
    flocken: Array.from({ length: ppFxN(7) }, (_, i) => ({
      dx: Math.cos((i / 7) * Math.PI * 2) * (16 + Math.random() * 18), dy: Math.sin((i / 7) * Math.PI * 2) * (10 + Math.random() * 14) - 8,
      g: 12 + Math.random() * 16, verzug: Math.round(Math.random() * 160),
    })),
  }),
});

ppFxUeberschreiben('puppet_swap_laki', ppFx23GoldFunkeln);
ppFxUeberschreiben('puppet_luck', ppFx23GoldFunkeln);
ppFxUeberschreiben('puppet_swap_saras', ppFx23DiamantFunkeln);
ppFxUeberschreiben('puppet_swap_vinny', ppFx23Schutzblase);
ppFxUeberschreiben('puppet_preserve', ppFx23Schutzblase);
ppFxUeberschreiben('poison_tick', ppFx23PoisonTick);
ppFxUeberschreiben('poison_vial', ppFx23PoisonVial);
ppFxUeberschreiben('poison_ooze', ppFx23PoisonOoze);
ppFxUeberschreiben('piranha_bite', ppFx23PiranhaBite);
ppFxUeberschreiben('pink_sky_puff', ppFx23PinkSkyPuff);
