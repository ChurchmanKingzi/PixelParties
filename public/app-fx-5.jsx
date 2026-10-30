// Pixelart-Portierungen (Canvas), Batch 5: siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
//
// Typen dieser Datei: knife_throw_fly, last_resort_blast, lava_fountain, love_burst, lunar_eclipse_pulse, lure_beacon, massacre, mega_explosion, meteor_crash, moana_rain,
// moonlight_beam, music_notes. (`moe_heart` läuft schon über die Szenen-Leinwand `ppSzene` und bleibt unverändert.)
//
// Alle Effekte hängen an `ppR1Leinwand` (app-board.jsx): EINE Pixelart-Leinwand statt dutzender animierter DOM-Elemente (Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s, Dithering statt
// Alpha, feste Palette — nur Farben, die schon die alten Fassungen nutzten). Gleiche Anker (x, y = Zielmitte) und Zeitläufe wie vorher; Teilchen, deren Laufzeit über die Lebensdauer
// des Aufrufers (Standard 1000 ms, s. `onZoneAnim`) hinausreichte und die vorher hart abgeschnitten wurden, laufen jetzt in der verfügbaren Zeit zu Ende.

const PP_FX5_S = 3;
const ppFx5Zufall = (a, b) => a + Math.random() * (b - a);
const ppFx5Wahl = (liste) => liste[Math.floor(Math.random() * liste.length)];
const ppFx5Aus = (u) => 1 - (1 - u) * (1 - u);                         // ease-out (wie CSS `ease-out`, grob)
const ppFx5Hoch = (u, n) => 1 - Math.pow(1 - ppR1Klemme(u), n);       // stärkeres Abbremsen
const ppFx5Hex = (liste) => liste.map(ppHex);

/** Punkt mit Durchmesser `d` (Rasterpixel): 1 Pixel, 2×2-Block oder kleine Scheibe. */
function ppFx5Punkt(g, x, y, d, c, a = 1) {
  if (a <= 0 || d <= 0) return;
  if (d < 1.5) g.put(x, y, c, a);
  else if (d < 2.5) g.block(x - 1, y - 1, 2, 2, c, a);
  else g.disc(x, y, d / 2 - 0.3, c, a);
}
/** Ring mit Außenradius `r` und Dicke `dicke` (Rasterpixel). */
function ppFx5Ring(g, cx, cy, r, dicke, c, a = 1) {
  if (r < 0.6 || a <= 0) return;
  g.ring(cx, cy, Math.max(0, r - Math.max(1, dicke)), r, c, a);
}
/**
 * Verlaufsscheibe/-ellipse als Pixelart: `farben` von der MITTE nach außen (harte Bänder, an den Grenzen gedithert), `grenzen` = obere Grenze je Band (0..1, aufsteigend, zuletzt 1;
 * ohne Angabe gleich breit), `aus` = Anteil des äußeren Randes, der in die Leere ausdithert. Nie Alpha — Deckung `a` wird per Bayer-Raster gestreut.
 */
function ppFx5Verlauf(g, cx, cy, rx, ry, farben, a = 1, aus = 0, grenzen = null) {
  if (rx < 0.5 || ry < 0.5 || a <= 0) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const n = farben.length, RX = Math.ceil(rx), RY = Math.ceil(ry);
  const irx = 1 / rx, iry = 1 / ry;
  for (let j = -RY; j <= RY; j++) for (let i = -RX; i <= RX; i++) {
    const qx = i * irx, qy = j * iry, d2 = qx * qx + qy * qy;
    if (d2 > 1) continue;
    const d = Math.sqrt(d2);
    let u;
    if (grenzen) {
      let k = 0;
      while (k < n - 1 && d >= grenzen[k]) k++;
      const lo = k ? grenzen[k - 1] : 0;
      u = k + (d - lo) / ((grenzen[k] - lo) || 1);
    } else u = d * n;
    const v = u - 0.5, k0 = Math.floor(v), fr = Math.min(1, Math.max(0, (v - k0 - 0.5) * 3 + 0.5));
    const k = Math.min(n - 1, Math.max(0, k0 + (fr > ppBayer(cx + i, cy + j) ? 1 : 0)));
    let al = a;
    if (aus > 0 && d > 1 - aus) al *= (1 - d) / aus;
    g.put(cx + i, cy + j, farben[k], al);
  }
}
/** Gefülltes Vieleck (gerade-ungerade-Regel), `farbe(X, Y)` → [Farbe, Deckung] oder null. */
function ppFx5Flaeche(g, pts, farbe) {
  let y0 = 1e9, y1 = -1e9;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let Y = Math.floor(y0); Y <= Math.ceil(y1); Y++) {
    const xs = [];
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], q = pts[(k + 1) % pts.length];
      if ((p[1] <= Y + 0.5 && q[1] > Y + 0.5) || (q[1] <= Y + 0.5 && p[1] > Y + 0.5)) xs.push(p[0] + (Y + 0.5 - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let X = Math.round(xs[k]); X < Math.round(xs[k + 1]); X++) {
      const f = farbe(X, Y);
      if (f) g.put(X, Y, f[0], f[1]);
    }
  }
}
/** Teilchenbahn: gibt die Fortschritte zurück (u 0..1 über die Lebensdauer, `null` = nicht sichtbar). Dauer wird auf das Ende `ende` gekürzt. */
function ppFx5Lauf(t, delay, dur, ende) {
  const d = Math.max(60, Math.min(dur, ende - delay));
  const u = (t - delay) / d;
  return (u < 0 || u > 1) ? null : u;
}

// ── Pixel-Bilder ───────────────────────────────────────────────────────────
// Noten (♪ ♫ ♩ ♬) in zwei Größen, `X` = Farbe
const PP_FX5_NOTEN = {
  achtel: [['.XX.', '.X.X', '.X..', '.X..', 'XX..', 'XX..'],
           ['..XXX..', '..XXXX.', '..X..XX', '..X...X', '..X....', '..X....', '..X....', 'XXX....', 'XXX....']],
  doppel: [['.XXXXX', '.X...X', '.X...X', '.X...X', 'XX..XX', 'XX..XX'],
           ['..XXXXXXX', '..XXXXXXX', '..X.....X', '..X.....X', '..X.....X', '..X.....X', '..X.....X', 'XXX...XXX', 'XXX...XXX']],
  viertel: [['.X', '.X', '.X', '.X', 'XX', 'XX'],
            ['..X', '..X', '..X', '..X', '..X', '..X', 'XXX', 'XXX', 'XXX']],
  doppel2: [['.XXXXX', '.XXXXX', '.X...X', '.X...X', 'XX..XX', 'XX..XX'],
            ['..XXXXXXX', '..XXXXXXX', '..XXXXXXX', '..X.....X', '..X.....X', '..X.....X', '..X.....X', 'XXX...XXX', 'XXX...XXX']],
};
const PP_FX5_NOTENARTEN = ['achtel', 'doppel', 'viertel', 'doppel2'];
/** Note zeichnen: `groesse` = Schriftgröße in Bildschirmpixeln (wie vorher), Mitte (x, y). */
function ppFx5Note(g, art, groesse, x, y, c, a = 1, schatten = null) {
  const bild = PP_FX5_NOTEN[art][groesse >= 22 ? 1 : 0];
  if (schatten) g.spr(bild, { X: schatten }, x + 1, y + 1, a);
  g.spr(bild, { X: c }, x, y, a);
}
// Herzen in drei Größen: `P` Fläche, `L` Glanz, `d` Schattenkante
const PP_FX5_HERZ = [
  ['PP.PP', 'PLPPP', 'PPPPP', '.PPP.', '..d..'],
  ['.PP.PP.', 'PLLPPPP', 'PLPPPPP', '.PPPPPd', '..dPPd.', '...d...'],
  ['.PPP.PPP.', 'PLLPPPPPP', 'PLPPPPPPP', 'PPPPPPPPd', '.PPPPPPd.', '..PPPPd..', '...ddd...', '....d....'],
];
const PP_FX5_HERZFARBEN = [
  { P: ppHex('#fc69c6'), L: ppHex('#f8b4df'), d: ppHex('#ea2f80') },     // 💗
  { P: ppHex('#f174ab'), L: ppHex('#f1e5fa'), d: ppHex('#ea2f80') },     // 💖
  { P: ppHex('#f8b4df'), L: ppHex('#ffffff'), d: ppHex('#f174ab') },     // 🩷
  { P: ppHex('#ea2f80'), L: ppHex('#fc69c6'), d: ppHex('#b62600') },     // 💕 / 💞
];
function ppFx5Herz(g, x, y, groesse, farbe, a = 1) {
  g.spr(PP_FX5_HERZ[groesse < 19 ? 0 : groesse < 26 ? 1 : 2], farbe, x, y, a);
}

// ═════════════════════════════════════════════════════════════════
//  Knife Throw (`knife_throw_fly`, Knife Throw) — PIXELART auf einer Leinwand. Ein Pixel-Messer (Spitze voran, Kontur, Stahl, Parierstange, Griff) fliegt in 180 ms von links oder
//  rechts auf das Ziel (weiße Flugspur dahinter), schlägt unterhalb der Kartenmitte ein: Aufblitzen (Dither-Scheibe), roter Stoßring, Blutspritzer fächern gegen die Flugrichtung,
//  dunkle Flecken bleiben stehen, das Messer steckt, bis es zuletzt wegdithert. ENDE 1000.
// ═════════════════════════════════════════════════════════════════
const PP_FX5_MESSER = ppFx5Hex(['#1a1a2e', '#ffffff', '#e5edfa', '#b4cff8', '#7e7d9b', '#f9ac20', '#c68206', '#7d3911', '#4a2a10']);
function ppFx5MesserZeichnen(g, tx, ty, dir, a) {
  const [K, W, L, M, D, GO, GD, GR, GG] = PP_FX5_MESSER;
  const P = (i, dy, c) => g.put(tx - dir * i, ty + dy, c, a);        // i = Abstand hinter der Spitze
  P(-1, 0, K); P(0, -1, K); P(1, -1, K); P(0, 1, K); P(1, 1, K);
  for (let i = 2; i <= 8; i++) { P(i, -2, K); P(i, 2, K); }
  for (let i = 0; i <= 8; i++) {
    P(i, 0, i === 8 ? D : W);
    if (i >= 2) { P(i, -1, i === 8 ? D : L); P(i, 1, i === 8 ? D : M); }
  }
  for (let dy = -2; dy <= 2; dy++) P(9, dy, dy === 0 ? GO : (Math.abs(dy) === 1 ? GO : GD));      // Parierstange
  P(9, -3, K); P(9, 3, K);
  for (let i = 10; i <= 14; i++) { P(i, -2, K); P(i, 2, K); P(i, -1, GR); P(i, 0, GR); P(i, 1, GG); }   // Griff
  P(15, -1, K); P(15, 0, K); P(15, 1, K);
}
const ppFx5MesserWurf = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, FLUG = 180, ENDE = 1000, dir = teile.dir;
  const ausblenden = ppR1Aus(t, 850, ENDE), iy = cy + 5, ix = cx;
  const weiss = PP_FX5_MESSER[1];
  // Stoßring (460 ms ab Einschlag): Mitte (+1, +15 px), Radius 15 px · Zoom .5 → 3.4, Rand 3 → .5 px
  const rk = (t - FLUG) / 460;
  if (rk >= 0 && rk <= 1) {
    const sc = 0.5 + 2.9 * ppFx5Aus(rk), a = 0.95 * (1 - rk);
    ppFx5Ring(g, ix + 0.3, iy, 15 * sc / S, Math.max(1, 3 * (1 - rk) / S + 0.4), PP_FX5_FLECK[1], a);
  }
  // Fleckenbild (bleibt): dunkle Pfützen
  for (const f of teile.flecken) {
    const u = (t - f.delay) / 900;
    if (u < 0 || u > 1) continue;
    const [op, sc] = ppKf(u, [[0, [0, .2]], [.2, [.95, 1.1]], [.65, [.8, 1]], [1, [0, 1]]]);
    ppFx5Fleck(g, cx + (f.fx + f.size / 2) / S, cy + (f.fy + f.size * .35) / S, f.size / 2 * sc / S, f.size * .35 * sc / S, f.farbe, op * (1 - Math.max(0, (t - 850) / 150)));
  }
  // Einschlagblitz (300 ms): 52 px, Zoom .4 → 1.15 → 1.7
  const bk = (t - FLUG) / 300;
  if (bk >= 0 && bk <= 1) {
    const [op, sc] = ppKf(bk, [[0, [0, .4]], [.25, [1, 1.15]], [1, [0, 1.7]]]);
    ppFx5Verlauf(g, ix, iy + 0.5, 26 * sc / S, 26 * sc / S, [weiss, PP_FX5_BLITZ], op, 0.3, [0.4, 1]);
  }
  // Spritzer
  for (const d of teile.spritzer) {
    const u = ppFx5Lauf(t, d.delay, d.dur, ENDE - 20);
    if (u === null) continue;
    const e = u < 0.2 ? 0.35 * (u / 0.2) : 0.35 + 0.65 * ppFx5Aus((u - 0.2) / 0.8);
    const sc = u < 0.2 ? 0.3 + 0.7 * (u / 0.2) : 1 - 0.45 * ((u - 0.2) / 0.8), a = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8;
    ppFx5Punkt(g, cx + d.dx * e / S, cy + (d.dy * e + 14 * u * u) / S, d.size * sc / S * 1.1, d.farbe, a * (u > 0.2 ? 1 : 1));
  }
  // Flugspur + Messer
  const u = ppR1Klemme(t / FLUG), e = ppFx5Hoch(u, 2.5), spitze = ix + dir * 7 - dir * 100 * (1 - e);
  const a = (u < 0.15 ? u / 0.15 : 1) * ausblenden;
  if (t < FLUG + 20) {
    const lang = 20;
    for (let j = 0; j < lang; j++) g.put(spitze - dir * (16 + j), iy - 1, weiss, 0.8 * (1 - j / lang) * (1 - u * 0.6));
  }
  if (a > 0) ppFx5MesserZeichnen(g, spitze, iy - 1, dir, a);
}, 1000, { breite: 720, hoehe: 240 }, {
  z: 10100,
  vorbereiten: () => {
    const FLUG = 180, dir = Math.random() < 0.5 ? 1 : -1, basis = dir === 1 ? Math.PI : 0;
    return {
      dir,
      spritzer: Array.from({ length: ppFxN(26) }, () => {
        const w = basis + (Math.random() - 0.5) * 1.9, v = 34 + Math.random() * 56;
        return { dx: Math.cos(w) * v, dy: Math.sin(w) * v * 0.5 - 6 + Math.random() * 26, size: 4 + Math.random() * 8, delay: FLUG + Math.random() * 110, dur: 380 + Math.random() * 260,
          farbe: ppFx5Wahl(PP_FX5_BLUT) };
      }),
      flecken: Array.from({ length: ppFxN(8) }, () => ({ fx: -26 + Math.random() * 52, fy: 4 + Math.random() * 24, size: 7 + Math.random() * 12, delay: FLUG + 30 + Math.random() * 120, farbe: ppFx5Wahl(PP_FX5_FLECK) })),
    };
  },
});
const PP_FX5_BLUT = ppFx5Hex(['#8f0000', '#c0141c', '#780000', '#e92f38', '#8f0000']);
const PP_FX5_FLECK = ppFx5Hex(['#780000', '#c0141c', '#8f0000']);
const PP_FX5_BLITZ = ppHex('#f9b3b3');
/** Unregelmäßiger Fleck (zwei verschobene Ellipsen), harte Kanten. */
function ppFx5Fleck(g, x, y, rx, ry, c, a = 1) {
  if (a <= 0 || rx < 0.6) return;
  g.ell(x, y, rx, Math.max(0.8, ry), c, a);
  g.ell(x + rx * 0.35, y - ry * 0.25, rx * 0.6, Math.max(0.8, ry * 0.7), c, a);
}

// ═════════════════════════════════════════════════════════════════
//  Last Resort (`last_resort_blast`) — PIXELART. Riesige Feuerkugel (Reichweite R = 3,1 × Zielgröße) auf einer Leinwand: weißer Kern (380 ms), gestufter Feuerball (gelbweiß → orange →
//  rot → dunkelrot, 980 ms, wächst .12 → .75 → 1,05 → 1,3), zwei Druckwellen-Ringe (760 ms, ab 0/190 ms), 26 Trümmerstücke (kleine Striche in Treppenwinkeln, ab 60–220 ms) und 14
//  Funken fliegen nach außen. ENDE 1400.
// ═════════════════════════════════════════════════════════════════
const PP_FX5_FEUER = ppFx5Hex(['#fffbd2', '#f9ac20', '#ff491a', '#8b0d0d']);
const ppFx5LastResort = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, R = teile.R, ENDE = 1400;
  const [kernW, kernG] = [ppHex('#ffffff'), ppHex('#fffbd2')];
  // ① Kern (380 ms): Durchmesser .7 R, Zoom .1 → 1 → 1,5
  const ku = t / 380;
  if (ku >= 0 && ku <= 1) {
    const [op, sc] = ppKf(ku, [[0, [0, .1]], [.12, [1, 1]], [1, [0, 1.5]]]);
    ppFx5Verlauf(g, cx, cy, R * 0.35 * sc / S, R * 0.35 * sc / S, [kernW, kernG], op, 0.35, [0.62, 1]);
  }
  // ② Feuerball (980 ms)
  const bu = t / 980;
  if (bu >= 0 && bu <= 1) {
    const [op, sc] = ppKf(bu, [[0, [0, .12]], [.14, [1, .75]], [.48, [.8, 1.05]], [1, [0, 1.3]]]);
    const r = R / 2 * sc / S;
    ppFx5Verlauf(g, cx, cy, r, r, PP_FX5_FEUER, op, 0.04, [0.37, 0.7, 0.9, 1]);
  }
  // ③ Druckwellen
  [0, 190].forEach((d) => {
    const wu = (t - d) / 760;
    if (wu < 0 || wu > 1) return;
    const [op, sc] = ppKf(wu, [[0, [0, .1]], [.18, [.95, .1 + 1.35 * .18]], [1, [0, 1.45]]]);
    const r = R / 2 * (0.1 + 1.35 * ppFx5Aus(wu)) / S;
    ppFx5Ring(g, cx, cy, r, 6, PP_FX5_FEUER[1], op * 0.3);
    ppFx5Ring(g, cx, cy, r, 2, ppHex('#f9ecb3'), op);
  });
  // ④ Trümmer: kurze Striche, drehen in Treppenschritten
  const farben = [ppHex('#6a1c14'), ppHex('#cf5f00'), ppHex('#e0c085')];
  teile.splitter.forEach((s) => {
    const u = ppFx5Lauf(t, s.delay, s.dur, ENDE);
    if (u === null) return;
    const e = ppFx5Hoch(u, 2.2), op = u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88, sc = 1.15 - 0.45 * u;
    const w = Math.round((s.dreh * u) / 45) * Math.PI / 4, l = s.laenge * sc / S / 2, x = cx + s.dx * e / S, y = cy + s.dy * e / S;
    const dx = Math.cos(w) * l, dy = Math.sin(w) * l;
    g.line(x - dx, y - dy, x, y, farben[0], op, s.breite >= 6 ? 2 : 1);
    g.line(x, y, x + dx * 0.6, y + dy * 0.6, farben[1], op, s.breite >= 6 ? 2 : 1);
    g.line(x + dx * 0.6, y + dy * 0.6, x + dx, y + dy, farben[2], op, 1);
  });
  // ⑤ Funken
  teile.funken.forEach((f) => {
    const u = ppFx5Lauf(t, f.delay, f.dur, ENDE);
    if (u === null) return;
    const e = ppFx5Aus(u), op = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85, d = f.gr * (1.4 - 1.0 * u) / S;
    ppFx5Punkt(g, cx + f.dx * e / S, cy + f.dy * e / S, d, PP_FX5_FEUER[1], op);
    if (d >= 2) g.put(cx + f.dx * e / S, cy + f.dy * e / S, kernG, op);
  });
}, 1400, (p) => {
  const R = Math.max(Math.max(p.w || 80, 80), Math.max(p.h || 110, 110)) * 3.1, E = Math.ceil(R * 1.12);
  return { breite: 2 * E, hoehe: 2 * E };
}, {
  z: 10260,
  vorbereiten: (sz) => {
    const w = Math.max(sz.props.w || 80, 80), h = Math.max(sz.props.h || 110, 110), R = Math.max(w, h) * 3.1;
    return {
      R,
      splitter: Array.from({ length: ppFxN(26) }, () => {
        const wi = Math.random() * Math.PI * 2, weite = R * (0.3 + Math.random() * 0.55);
        return { dx: Math.cos(wi) * weite, dy: Math.sin(wi) * weite * 0.8 + h * (0.25 + Math.random() * 0.5), laenge: 7 + Math.random() * 18, breite: 3 + Math.random() * 6,
          dreh: -720 + Math.random() * 1440, delay: 60 + Math.random() * 160, dur: 700 + Math.random() * 560 };
      }),
      funken: Array.from({ length: ppFxN(14) }, () => {
        const wi = Math.random() * Math.PI * 2, weite = R * (0.45 + Math.random() * 0.6);
        return { dx: Math.cos(wi) * weite, dy: Math.sin(wi) * weite, gr: 3 + Math.random() * 5, dur: 900 + Math.random() * 600, delay: 40 + Math.random() * 260 };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Lava Fountain (`lava_fountain`, The Seventh Circle of Hell) — PIXELART. Eine Lavafontäne bricht aus dem Ziel: Dunst (gestufte Scheibe), glühender Lavateich auf dem Boden, Bodenrisse
//  (Pixelketten), fünf Strahlen (Pixel-Flammenform von dunkelrot unten bis hellgelb oben, wachsen in 200 ms, zittern, fallen zusammen), Kappe an der Spitze, 58 Lavatropfen (steigen
//  und fallen), zwei Stoßringe. Die alte Fassung wurde nach 1000 ms hart gekappt — jetzt dithert alles ab ~820 ms aus. ENDE 1000.
// ═════════════════════════════════════════════════════════════════
const PP_FX5_LAVA = ppFx5Hex(['#f8f8bd', '#ffeb1a', '#f9ac20', '#f87420', '#c0141c', '#8c0014']);
const PP_FX5_STRAHLFORM = [[32, 100], [4, 70], [20, 42], [34, 22], [50, 0], [66, 22], [80, 42], [96, 70], [68, 100]];
const ppFx5Lava = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, ENDE = 1000, C = PP_FX5_LAVA;
  const aus = ppR1Aus(t, 820, ENDE), boden = cy + 38 / S;
  // Dunst (1500 ms): 300 px, Mitte (0, −80)
  const hu = t / 1500;
  if (hu <= 1) {
    const [op, sc] = ppKf(hu, [[0, [0, .5]], [.3, [1, 1]], [1, [0, 1.25]]]);
    ppFx5Verlauf(g, cx, cy - 80 / S, 150 * sc / S, 150 * sc / S, [C[3], C[4]], op * 0.4 * aus, 0.4, [0.55, 1]);
  }
  // Lavateich (1600 ms): 240 × 84 px
  const pu = t / 1600;
  if (pu <= 1) {
    const [op, sc] = ppKf(pu, [[0, [0, .3]], [.22, [1, 1]], [1, [0, 1.25]]]);
    ppFx5Verlauf(g, cx, boden, 120 * sc / S, 42 * sc / S, [C[0], C[1], C[3], C[4]], op * aus, 0.15, [0.22, 0.45, 0.75, 1]);
  }
  // Bodenrisse (1100 ms ab 60 ms)
  const ru = (t - 60) / 1100;
  if (ru >= 0 && ru <= 1) {
    const [op, sc] = ppKf(ru, [[0, [0, 0]], [.25, [1, 1]], [1, [0, 1.1]]]);
    teile.risse.forEach((r) => {
      const len = r.len * sc / S, ca = Math.cos(r.rad), sn = Math.sin(r.rad) * 0.42;
      for (let k = 0; k <= len; k++) {
        const f = k / Math.max(1, len), c = f < 0.3 ? C[0] : f < 0.7 ? C[3] : C[4];
        g.put(cx + ca * k, boden + sn * k, c, op * aus * (f > 0.8 ? 0.6 : 1));
      }
    });
  }
  // Strahlen: Pixel-Flammenform, Farbe nach Höhe (unten dunkel, oben hell)
  teile.strahlen.forEach((s) => {
    const u = ppFx5Lauf(t, s.delay, s.dur, ENDE + 200);
    if (u === null) return;
    const [op, sy, sx] = ppKf(u, [[0, [0, .04, 1]], [.2, [1, 1, 1]], [.6, [1, .92, 1.08]], [1, [0, .25, .7]]]);
    const bx = cx + s.k * 30 / S, H = s.h * sy / S, Bw = s.w * sx / S;
    const pts = PP_FX5_STRAHLFORM.map(([px, py]) => [bx + (px / 100 - 0.5) * Bw, boden - (1 - py / 100) * H]);
    ppFx5Flaeche(g, pts, (X, Y) => {
      const v = H > 0 ? (boden - Y) / H + (ppBayer(X, Y) - 0.5) * 0.12 : 0;
      return [v < 0.07 ? C[5] : v < 0.27 ? C[4] : v < 0.54 ? C[3] : v < 0.84 ? C[2] : C[0], op * aus];
    });
  });
  // Kappe an der Spitze (1100 ms ab 260 ms): 116 × 70 px, Mitte (0, −191)
  const kuu = (t - 260) / 1100;
  if (kuu >= 0 && kuu <= 1) {
    const [op, sc, dy] = ppKf(kuu, [[0, [0, .2, 0]], [.35, [1, 1.1, 0]], [1, [0, 1.5, -16]]]);
    ppFx5Verlauf(g, cx, cy - 191 / S + dy / S, 58 * sc / S, 35 * sc / S, [C[0], C[1], C[3]], op * aus, 0.2, [0.25, 0.5, 1]);
  }
  // Tropfen
  teile.tropfen.forEach((d) => {
    const u = ppFx5Lauf(t, d.delay, d.dur, ENDE);
    if (u === null) return;
    let x, y;
    if (u < 0.52) { const e = ppFx5Aus(u / 0.52); x = d.dx * 0.6 * e; y = -d.hoch * e; }
    else { const e = ppFx5Aus((u - 0.52) / 0.48); x = d.dx * (0.6 + 0.4 * e); y = -d.hoch + (d.hoch + 34) * e; }
    const op = u < 0.1 ? u / 0.1 : u < 0.52 ? 1 : 1 - (u - 0.52) / 0.48;
    ppFx5Punkt(g, cx + x / S, cy + (30 + d.size * 0.6 + y) / S, d.size / S * 1.1, d.farbe, op * aus);
  });
  // Stoßringe (760 ms ab 140/290 ms): 172 × 48 px, Mitte (0, 36)
  [0, 1].forEach((i) => {
    const ku = (t - 140 - i * 150) / 760;
    if (ku < 0 || ku > 1) return;
    const sc = 0.2 + 1.7 * ppFx5Aus(ku);
    g.ellRing(cx, boden, 86 * sc / S, 24 * sc / S, Math.max(1, 3 * sc / S * 0.7), i ? C[3] : C[1], 0.95 * (1 - ku) * aus);
  });
}, 1000, { breite: 440, hoehe: 400, ankerY: 290 }, {
  z: 10100,
  vorbereiten: () => ({
    strahlen: [{ k: 0, w: 40, h: 230, delay: 0 }, { k: -1, w: 24, h: 150, delay: 70 }, { k: 1, w: 24, h: 160, delay: 50 }, { k: -2, w: 16, h: 100, delay: 140 }, { k: 2, w: 16, h: 110, delay: 120 }]
      .map(j => ({ ...j, dur: 1000 + Math.round(Math.random() * 160) })),
    tropfen: Array.from({ length: ppFxN(58) }, () => ({ dx: Math.round((Math.random() - 0.5) * 220), hoch: 80 + Math.random() * 190, delay: Math.round(40 + Math.random() * 520), dur: Math.round(820 + Math.random() * 480),
      size: 4 + Math.round(Math.random() * 6), farbe: ppFx5Wahl(PP_FX5_LAVA) })),
    risse: Array.from({ length: 7 }, (_, i) => ({ rad: (i / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.3, len: 44 + Math.random() * 40 })),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Love Burst (`love_burst`; Love Shot, Molinda, Spirit of the Heart Bow) — PIXELART. 22 Pixel-Herzen (drei Größen, vier Rosa-Töne mit Glanz und Schattenkante) steigen aus der Zielmitte
//  nach außen (leicht nach oben), wachsen kurz und schrumpfen beim Verblassen (Dither-Aus). Kein Schein, keine Drehung. ENDE 1000.
// ═════════════════════════════════════════════════════════════════
const ppFx5LoveBurst = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  teile.herzen.forEach((h) => {
    const u = ppFx5Lauf(t, h.delay, h.dur, 1000);
    if (u === null) return;
    const [op, f, sc] = ppKf(u, [[0, [0, 0, .4]], [.2, [1, .25, 1.1]], [.7, [1, .85, 1]], [1, [0, 1, .85]]]);
    ppFx5Herz(g, cx + h.dx * f / S, cy + h.dy * f / S, h.size * sc * 1.1, h.farbe, op);
  });
}, 1000, { breite: 300, hoehe: 300 }, {
  z: 10100,
  vorbereiten: () => ({
    herzen: Array.from({ length: ppFxN(22) }, () => {
      const w = Math.random() * Math.PI * 2, dist = 24 + Math.random() * 70;
      const sorte = ppFx5Wahl([0, 0, 0, 1, 3, 3, 2]);
      return { size: 14 + Math.random() * 18, delay: Math.random() * 280, dur: 700 + Math.random() * 500, dx: Math.cos(w) * dist, dy: Math.sin(w) * dist - 18, farbe: PP_FX5_HERZFARBEN[sorte] };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Lunar Eclipse (`lunar_eclipse_pulse`) — PIXELART. Blasser Mondhof hinter der Karte (gestufte Scheibe, 1100 ms), eine Mondscheibe schwebt von oben herein (Pixel-Kugel mit Glanz und
//  Dither-Schein, 1000 ms), sieben Mondstrahlen stechen fächerförmig nach unten (Pixellinien, Deckung läuft zum Ende aus), 14 Lichttropfen rieseln an der Karte vorbei. ENDE 1000.
// ═════════════════════════════════════════════════════════════════
const PP_FX5_MOND = ppFx5Hex(['#fff8e8', '#fffbd2', '#f9ecb3', '#f7e0b5']);
const ppFx5MondFinsternis = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, M = PP_FX5_MOND;
  // Mondhof (1100 ms): 110 px
  const hu = t / 1100;
  if (hu <= 1) {
    const [op, sc] = ppKf(hu, [[0, [0, .55]], [.4, [1, 1.08]], [1, [0, 1.25]]]);
    ppFx5Verlauf(g, cx, cy, 55 * sc / S, 55 * sc / S, [M[0], M[1]], op * 0.38, 0.3, [0.55, 1]);
  }
  // Strahlen
  teile.strahlen.forEach((r) => {
    const u = ppFx5Lauf(t, r.delay, r.dur, 1000);
    if (u === null) return;
    const lang = ppKf(u, [[0, [0]], [.35, [1]], [1, [1]]])[0], op = ppKf(u, [[0, [0]], [.35, [1]], [.8, [.85]], [1, [0]]])[0];
    const rad = r.winkel * Math.PI / 180, n = r.len * lang / S, sx = Math.sin(rad), sy = Math.cos(rad), y0 = cy - 58 / S;
    for (let k = 0; k <= n; k++) {
      const f = k / Math.max(1, r.len / S), c = f < 0.6 ? M[0] : M[1];
      g.put(cx + sx * k, y0 + sy * k, c, op * (f < 0.6 ? 0.95 : 0.95 - 0.9 * (f - 0.6) / 0.4));
    }
  });
  // Mondscheibe (1000 ms): 36 px, Mitte (0, −56), steigt von +14 auf −6
  const mu = t / 1000;
  if (mu <= 1) {
    const [op, sc, dy] = ppKf(mu, [[0, [0, .4, 14]], [.35, [1, 1.15, 0]], [1, [.85, 1, -6]]]);
    const r = 18 * sc / S, my = cy - 56 / S + dy / S;
    ppFx5Verlauf(g, cx, my, r + 3.5, r + 3.5, [M[0]], op * 0.28, 0.7);
    g.disc(cx, my, r, M[3], op);
    g.disc(cx - r * 0.12, my - r * 0.12, r * 0.82, M[2], op);
    g.disc(cx - r * 0.22, my - r * 0.22, r * 0.55, M[1], op);
    g.disc(cx - r * 0.3, my - r * 0.3, r * 0.28, M[0], op);
  }
  // Tropfen
  teile.tropfen.forEach((d) => {
    const u = ppFx5Lauf(t, d.delay, d.dur, 1000);
    if (u === null) return;
    const e = u * u, op = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8;
    const w = Math.max(1, Math.round(d.size / S)), h = Math.max(1, Math.round(d.size * 1.4 * (1 + 0.2 * u) / S));
    g.block(cx + d.xOff / S, cy + (d.startY + d.endY * e) / S, w, h, u < 0.5 ? M[0] : M[2], op);
  });
}, 1000, { breite: 240, hoehe: 240 }, {
  z: 10100,
  vorbereiten: () => ({
    tropfen: Array.from({ length: ppFxN(14) }, () => ({ xOff: -30 + Math.random() * 60, startY: -30 + Math.random() * 10, endY: 70 + Math.random() * 30, delay: 120 + Math.random() * 320, dur: 650 + Math.random() * 300, size: 3 + Math.random() * 4 })),
    strahlen: Array.from({ length: ppFxN(7) }, (_, i) => ({ winkel: -45 + i * 15 + (Math.random() * 6 - 3), len: 70 + Math.random() * 30, delay: Math.random() * 150, dur: 700 + Math.random() * 250 })),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Lure Beacon (`lure_beacon`, Alluring Light) — PIXELART. Das Anlock-Leuchten auf dem Opfer: gestufter Goldhalo (2,4 s, wächst .5 → 1,05, dithert aus), vier Lichtbalken durch die Mitte
//  (0°/45°/90°/135°, Mitte hell, Enden laufen aus; atmen in 2,4-s-Takt, gestaffelt), vier nacheinander startende Pulsringe (1,9-s-Takt, wiederholt), pulsierender Kern (0,55 s hin und
//  zurück). Läuft wie vorher bis zur Lebensdauer des Aufrufers (1200/2400 ms).
// ═════════════════════════════════════════════════════════════════
const PP_FX5_LOCK = ppFx5Hex(['#fffbd2', '#ffd066', '#f9ecb3', '#fff196', '#fbe181', '#fff8e8']);
const ppFx5Lockruf = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, R = teile.R, C = PP_FX5_LOCK;
  // Halo (2400 ms, einmal)
  const hu = t / 2400;
  if (hu <= 1) {
    const op = ppKf(hu, [[0, [0]], [.18, [1]], [.7, [.85]], [1, [0]]])[0], sc = ppKf(hu, [[0, [.5]], [.7, [1.05]], [1, [1.15]]])[0];
    ppFx5Verlauf(g, cx, cy, R * 1.2 * sc / S, R * 1.2 * sc / S, [C[0], C[1]], op * 0.36, 0.45, [0.55, 1]);
  }
  // Lichtbalken
  const breit = Math.max(6, R * 0.1) / S;
  teile.strahlen.forEach((w, i) => {
    const tl = t - (i % 4) * 140;
    if (tl < 0) return;
    const u = (tl % 2400) / 2400, op = ppKf(u, [[0, [0]], [.25, [.9]], [.6, [.35]], [1, [0]]])[0];
    if (op <= 0.02) return;
    const rad = w * Math.PI / 180, dx = Math.cos(rad) * R * 0.95 / S, dy = Math.sin(rad) * R * 0.95 / S;
    ppR1Band(g, cx - dx, cy - dy, cx + dx, cy + dy, (v) => { const e = Math.abs(2 * v - 1); return { w: 1 + (breit - 1) * Math.pow(1 - e, 0.8), c: e < 0.3 ? C[5] : C[3], a: Math.pow(1 - e, 0.5) }; }, op);
  });
  // Pulsringe (1,9 s Takt, ab 0/240/480/720 ms)
  [0, 240, 480, 720].forEach((d) => {
    const tl = t - d;
    if (tl < 0) return;
    const u = (tl % 1900) / 1900, op = ppKf(u, [[0, [0]], [.22, [.95]], [1, [0]]])[0], sc = 0.3 + 1.3 * ppFx5Aus(u), r = R * 0.75 * sc / S;
    ppFx5Ring(g, cx, cy, r - 1, 4, C[4], op * 0.3);
    ppFx5Ring(g, cx, cy, r, Math.max(1.2, 3 * sc / S + 0.6), C[3], op);
  });
  // Kern (0,55 s hin, 0,55 s zurück)
  const ph = (t % 1100) / 1100, w = ph < 0.5 ? ph * 2 : 2 - ph * 2, kr = R * 0.31 * (0.82 + 0.36 * w) / S, ko = 0.5 + 0.5 * w;
  ppFx5Verlauf(g, cx, cy, kr * 1.6, kr * 1.6, [C[1]], ko * 0.25, 0.6);
  ppFx5Verlauf(g, cx, cy, kr, kr, [C[5], C[1]], ko, 0.3, [0.55, 1]);
}, 2400, (p) => { const R = Math.max(Math.max(p.w || 90, p.h || 120) * 1.15, 90), E = Math.ceil(R * 1.5); return { breite: 2 * E, hoehe: 2 * E }; }, {
  z: 10050,
  vorbereiten: (sz) => ({
    R: Math.max(Math.max(sz.props.w || 90, sz.props.h || 120) * 1.15, 90),
    strahlen: Array.from({ length: ppFxN(8) }, (_, i) => i * 45),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Massacre (`massacre`) — PIXELART. Zehn blutige Schnitte nacheinander (je ~58 ms versetzt, 150–240 ms lang): Pixelband in Treppenwinkel, Mitte weiß, außen rot, dunkelroter Rand;
//  wächst auf 125 % und zieht sich zurück. Dazu 26 Blutspritzer, die in einem Fächer nach oben fliegen und fallen, und ein roter Nachhall (gestufte Scheibe, ab 300 ms). ENDE 1000.
// ═════════════════════════════════════════════════════════════════
const PP_FX5_BLUTROT = ppFx5Hex(['#ffffff', '#ff6666', '#f03232', '#c0141c', '#8c0014']);
const ppFx5Massaker = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX5_BLUTROT;
  // Nachhall (620 ms ab 300 ms): 92 px
  const nu = (t - 300) / 620;
  if (nu >= 0 && nu <= 1) {
    const [op, sc] = ppKf(nu, [[0, [0, .5]], [.4, [1, 1.05]], [1, [0, 1.25]]]);
    ppFx5Verlauf(g, cx, cy, 46 * sc / S, 46 * sc / S, [C[3], C[4]], op * 0.45, 0.4, [0.6, 1]);
  }
  // Schnitte
  teile.schnitte.forEach((c) => {
    const u = (t - c.start) / c.dauer;
    if (u < 0 || u > 1) return;
    const [op, sx] = ppKf(u, [[0, [0, 0]], [.35, [1, 1.25]], [1, [0, .6]]]);
    const rad = c.winkel * Math.PI / 180, L = c.laenge * sx / 2 / S, mx = cx + c.vx / S, my = cy + (c.vy + c.dicke / 2) / S, dx = Math.cos(rad) * L, dy = Math.sin(rad) * L;
    const bw = c.dicke >= 3.2 ? 2.2 : 1.2;
    ppR1Band(g, mx - dx, my - dy, mx + dx, my + dy, (v) => { const e = Math.abs(2 * v - 1); return { w: bw + 2.2, c: C[3], a: (1 - e * e) * 0.6 }; }, op);
    ppR1Band(g, mx - dx, my - dy, mx + dx, my + dy, (v) => { const e = Math.abs(2 * v - 1); return { w: bw, c: e < 0.3 ? C[0] : e < 0.65 ? C[1] : C[2], a: Math.pow(1 - e, 0.5) }; }, op);
  });
  // Spritzer
  teile.tropfen.forEach((d) => {
    const u = ppFx5Lauf(t, d.start, d.dauer, 1000);
    if (u === null) return;
    const e = ppFx5Hoch(u, 2.2), op = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85, sc = 1 - 0.65 * u, rad = d.winkel * Math.PI / 180;
    const x = cx + Math.cos(rad) * d.weite * e / S, y = cy + (Math.sin(rad) * d.weite * e + 26 * u * u) / S, n = d.groesse * sc / S;
    ppFx5Punkt(g, x, y, n * 1.1, d.farbe, op);
    if (n >= 1.6) g.put(x, y + 1, d.farbe, op);
  });
}, 1000, { breite: 280, hoehe: 280 }, {
  z: 10100,
  vorbereiten: () => ({
    schnitte: Array.from({ length: 10 }, (_, i) => ({ winkel: -80 + Math.random() * 160, laenge: 46 + Math.random() * 44, dicke: 2 + Math.random() * 2.5, vx: -18 + Math.random() * 36, vy: -18 + Math.random() * 36,
      start: i * 58 + Math.random() * 22, dauer: 150 + Math.random() * 90 })),
    tropfen: Array.from({ length: ppFxN(26) }, () => ({ winkel: -150 + Math.random() * 120, weite: 18 + Math.random() * 46, groesse: 2 + Math.random() * 4.5, start: 60 + Math.random() * 520, dauer: 380 + Math.random() * 320,
      farbe: ppFx5Wahl(ppFx5Hex(['#c0141c', '#8c0014', '#ef2929', '#780000'])) })),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Mega Explosion (`mega_explosion`; Sentient Bomb Golems, End of the Future, Remote Detonator) — PIXELART. Die normale Explosion, 2,9-fach (Wrapper-Zoom `scale(2.9)`): Rauch (7 graue
//  Dither-Blasen), gelb-oranger Blitz, weißer Kern, Druckwelle, 38 Funken (Scheiben mit hellem Kern), 8 schwere Brocken (Quadrate, steigen und fallen), 12 aufsteigende Glutpunkte —
//  dazu der weite goldene Stoßring (700 ms, bis 2,4 × 60 px × 2,9). Eigene `opacity` des Aufrufers wirkt auf alles. ENDE 1000.
// ═════════════════════════════════════════════════════════════════
const PP_FX5_EXPL = ppFx5Hex(['#ff491a', '#ff8b1a', '#fad54a', '#ff1a1a', '#f9ac20', '#ffffff', '#fbe181']);
const PP_FX5_EXPL_HELL = { '#ff491a': '#ff8b1a', '#ff8b1a': '#fad54a', '#fad54a': '#f9ecb3', '#ff1a1a': '#ff491a', '#f9ac20': '#fad54a', '#ffffff': '#ffffff', '#fbe181': '#f9ecb3' };
const ppFx5MegaExplosion = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, K = 2.9, cx = sz.cx, cy = sz.cy, ENDE = 1000, wa = teile.wa;
  const gelb = ppHex('#fad54a'), orange = ppHex('#f87420'), weiss = ppHex('#ffffff'), creme = ppHex('#f9ecb3'), kupfer = ppHex('#f9ac20'), gold = ppHex('#ffd066'), glut = ppHex('#ff7d00');
  // Rauch
  teile.rauch.forEach((r) => {
    const u = ppFx5Lauf(t, r.delay, r.dur, ENDE);
    if (u === null) return;
    const e = ppFx5Aus(u), op = ppKf(u, [[0, [0]], [.3, [.9]], [1, [0]]])[0], sc = 0.4 + 1.1 * e, rr = r.size * K * sc / 2 / S;
    ppFx5Verlauf(g, cx + r.dx * e * K / S, cy + r.dy * e * K / S, rr, rr, [r.ton], op * wa, 0.5);
  });
  // Blitz (500 ms): 90 px
  const fu = t / 500;
  if (fu <= 1) {
    const [op, sc] = ppKf(fu, [[0, [1, .2]], [.4, [.8, 1.6]], [1, [0, 2.2]]]), r = 45 * K * sc / S;
    ppFx5Verlauf(g, cx, cy, r, r, [gelb, orange], op * 0.9 * wa, 0.45, [0.5, 1]);
  }
  // Druckwelle (460 ms ab 40 ms): 64 px, Rand 5 px (zoomt mit)
  const wu = (t - 40) / 460;
  if (wu >= 0 && wu <= 1) {
    const [op, sc] = ppKf(wu, [[0, [1, .25]], [.7, [.9, 1.7]], [1, [0, 2.6]]]), r = 32 * K * sc / S;
    ppFx5Ring(g, cx, cy, r, 5 * K * sc / S, kupfer, op * wa);
    ppFx5Ring(g, cx, cy, r - 5 * K * sc / S, 4, glut, op * 0.4 * wa);
  }
  // Kern (300 ms): 56 px
  const ku = t / 300;
  if (ku <= 1) {
    const [op, sc] = ppKf(ku, [[0, [1, .2]], [.45, [1, 1.35]], [1, [0, 1.6]]]), r = 28 * K * sc / S;
    ppFx5Verlauf(g, cx, cy, r, r, [weiss, creme, gelb], op * wa, 0.15, [0.35, 0.65, 1]);
  }
  // Funken
  teile.funken.forEach((p) => {
    const u = ppFx5Lauf(t, p.delay, p.dur, ENDE);
    if (u === null) return;
    const e = ppFx5Aus(u), op = u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8, sc = 1.2 * (1 - e), d = p.size * K * sc / S;
    const x = cx + p.dx * e * K / S, y = cy + p.dy * e * K / S;
    if (d < 1) return;
    ppFx5Punkt(g, x, y, d, p.farbe, op * wa);
    if (d >= 6) ppFx5Punkt(g, x - 0.5, y - 0.5, d * 0.5, p.hell, op * wa);
  });
  // Brocken: Quadrate, steigen (bis 55 %) und fallen
  teile.brocken.forEach((b) => {
    const u = ppFx5Lauf(t, b.delay, b.dur, ENDE);
    if (u === null) return;
    let x, y, op = 1;
    if (u < 0.55) { const e = ppFx5Aus(u / 0.55); x = b.dx * e; y = b.dy * e; }
    else { const e = ppFx5Aus((u - 0.55) / 0.45); x = b.dx * (1 + 0.3 * e); y = b.dy + (b.dy * -0.8 + 40) * e; op = 1 - e; }
    const n = Math.max(2, Math.round(b.size * K / S));
    g.block(cx + x * K / S - n / 2, cy + y * K / S - n / 2, n, n, b.farbe, op * wa);
    g.block(cx + x * K / S - n / 2, cy + y * K / S - n / 2, n, 1, ppHex('#8e503a'), op * 0.7 * wa);
  });
  // Glut
  teile.glut.forEach((p) => {
    const u = ppFx5Lauf(t, p.delay, p.dur, ENDE);
    if (u === null) return;
    const e = ppFx5Aus(u), op = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    ppFx5Punkt(g, cx + p.dx * e * K / S, cy + p.dy * e * K / S, p.size * K / S, p.farbe, op * wa);
  });
  // weiter Stoßring (700 ms): 120 px, Rand 4 px
  const mu = t / 700;
  if (mu <= 1) {
    const sc = 0.3 + 2.1 * ppFx5Aus(mu), op = 0.95 * (1 - mu), r = 60 * K * sc / S;
    ppFx5Ring(g, cx, cy, r - 2, 7 * sc, glut, op * 0.35 * wa);
    ppFx5Ring(g, cx, cy, r, Math.max(1.5, 4 * K * sc / S), gold, op * wa);
  }
}, 1000, { breite: 880, hoehe: 880 }, {
  z: 10160,
  vorbereiten: (sz) => {
    const o = sz.props.opacity;
    return {
      wa: (typeof o === 'number' && o >= 0 && o <= 1) ? o : 1,
      rauch: Array.from({ length: ppFxN(7) }, (_, i) => ({ dx: -26 + Math.random() * 52, dy: -(22 + Math.random() * 30), size: 30 + Math.random() * 22, delay: 180 + i * 35, dur: 560 + Math.random() * 160, ton: ppHex(Math.random() < 0.5 ? '#59606e' : '#3e3e51') })),
      funken: Array.from({ length: ppFxN(38) }, () => {
        const w = Math.random() * Math.PI * 2, v = 30 + Math.random() * 75, k = Math.floor(Math.random() * 7), c = PP_FX5_EXPL[k];
        return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 4 + Math.random() * 9, farbe: c, hell: ppHex(Object.values(PP_FX5_EXPL_HELL)[k]), delay: Math.random() * 80, dur: 380 + Math.random() * 420 };
      }),
      brocken: Array.from({ length: ppFxN(8) }, () => {
        const w = -Math.PI * (0.15 + Math.random() * 0.7), v = 45 + Math.random() * 45;
        return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 6 + Math.random() * 6, farbe: ppHex(ppFx5Wahl(['#68332a', '#7d3911', '#323232', '#b62600'])), delay: 40 + Math.random() * 60, dur: 620 + Math.random() * 200 };
      }),
      glut: Array.from({ length: ppFxN(12) }, () => ({ dx: -34 + Math.random() * 68, dy: -(30 + Math.random() * 45), size: 3 + Math.random() * 3, farbe: ppHex(ppFx5Wahl(['#ffe469', '#f9ac20', '#ff7d00'])), delay: 220 + Math.random() * 180, dur: 450 + Math.random() * 250 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Meteor Crash (`meteor_crash`, 1700 ms) — PIXELART. Ein glühender Felsbrocken (Pixel-Kugel, Kontur, Glutkern; 44 px, bei Wucht 3: 64 px) fällt in 520 ms von schräg oben rechts (außerhalb
//  des Bildes) auf das Ziel, beschleunigt, mit Feuerschweif (Pixelband) entgegen der Flugbahn. Einschlag bei ~510 ms: Aufschlagblitz (gestufte Scheibe), zwei Druckwellen (Ringe, die
//  dünn werden), glühender Bodenriss (Ellipse, glimmt aus bis ~1600 ms), Erdbrocken und Glut fliegen fächernd nach oben.
// ═════════════════════════════════════════════════════════════════
const PP_FX5_METEOR = ppFx5Hex(['#27180c', '#7d3911', '#ff9a1a', '#f9ecb3', '#ff7d00', '#ff491a', '#ffd066', '#fff8e8', '#f9ac20', '#fbc86a', '#cc2b00', '#311402']);
const ppFx5Meteor = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX5_METEOR, k = teile.k, w = teile.w, size = teile.size;
  // Bodenriss (1100 ms ab 520 ms)
  const cu = (t - 520) / 1100;
  if (cu >= 0 && cu <= 1) {
    const [op, sc] = ppKf(cu, [[0, [1, .3]], [.3, [.95, 1]], [1, [0, 1.15]]]), fw = w * (1.6 + k * 0.2);
    ppFx5Verlauf(g, cx, cy, fw / 2 * sc / S, fw * 0.21 * sc / S, [C[4], C[10], C[11]], op * 0.85, 0.25, [0.4, 0.7, 1]);
  }
  // Druckwellen
  [[510, w * (3 + k * 0.8), 14], [640, w * (2.2 + k * 0.6), 5]].forEach(([d, fw, bw0]) => {
    const wu = (t - d) / 700;
    if (wu < 0 || wu > 1) return;
    const e = ppFx5Hoch(wu, 3), r = fw / 2 * (0.08 + 0.92 * e) / S, bw = (bw0 * (1 - wu) + wu) / S * 1.2;
    ppFx5Ring(g, cx, cy, r - 1, Math.max(2, bw * 2.2), C[4], (1 - wu) * 0.3);
    ppFx5Ring(g, cx, cy, r, Math.max(1, bw), C[9], 1 - wu);
  });
  // Aufschlagblitz (520 ms ab 500 ms)
  const fu = (t - 500) / 520;
  if (fu >= 0 && fu <= 1) {
    const sc = 0.2 + 1.5 * ppFx5Aus(fu), fw = w * (2.2 + k * 0.5);
    ppFx5Verlauf(g, cx, cy, fw / 2 * sc / S, fw / 2 * sc / S, [C[7], C[8], C[5]], 1 - fu, 0.3, [0.2, 0.5, 1]);
  }
  // Trümmer
  teile.truemmer.forEach((d) => {
    const u = ppFx5Lauf(t, d.delay, d.dur, 1700);
    if (u === null) return;
    const e = ppFx5Aus(u), op = u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8, sc = 1.2 * (1 - e), n = d.size * sc / S;
    if (n < 0.8) return;
    ppFx5Punkt(g, cx + d.dx * e / S, cy + d.dy * e / S, n, d.farbe, op);
  });
  // Brocken im Flug
  if (t < 525) {
    const u = t / 520, p = Math.pow(ppR1Klemme(u), 2.2), [op, sc] = ppKf(u, [[0, [0, .55]], [.08, [1, .55 + .5 * .08]], [.92, [1, .55 + .5 * .92]], [1, [0, 1.05]]], true);
    const rx = teile.sx * (1 - p) / S, ry = teile.sy * (1 - p) / S, r = size * sc / 2 / S, x = cx + rx, y = cy + ry;
    // Schweif: entgegen der Flugrichtung (Richtung zum Start)
    const len = Math.hypot(teile.sx, teile.sy) || 1, ux = teile.sx / len, uy = teile.sy / len, L = size * 5 * sc / S, bw = size * 0.9 * sc / S;
    ppR1Band(g, x, y, x + ux * L, y + uy * L, (v) => ({ w: Math.max(1, bw * (1 - 0.65 * v)), c: v < 0.35 ? C[4] : v < 0.65 ? C[5] : C[6], a: Math.pow(1 - v, 1.2) }), op);
    ppFx5Verlauf(g, x, y, r + 3, r + 3, [C[4]], op * 0.35, 0.6);
    g.disc(x, y, r, C[0], op);
    g.disc(x - r * 0.08, y - r * 0.08, r * 0.82, C[1], op);
    g.disc(x - r * 0.2, y - r * 0.2, r * 0.55, C[2], op);
    g.disc(x - r * 0.3, y - r * 0.3, r * 0.26, C[3], op);
  }
}, 1700, (p) => {
  const k = Math.min(Math.max(p.intensity || 1, 1), 3), w = p.w || 80, E = Math.ceil(Math.max(w * (2.2 + k * 0.5) / 2 * 1.7, w * (3 + k * 0.8) / 2, 60 + 40 * k + 170) + 40);
  const ax = Math.ceil(Math.min(Math.max(p.x, E), 1600)), rw = Math.ceil(Math.max(E, Math.min(window.innerWidth - p.x + 90, 1700))), at = Math.ceil(Math.max(E, Math.min(p.y + 110, 1000)));
  return { breite: ax + rw, hoehe: at + E, ankerX: ax, ankerY: at };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const p = sz.props, k = Math.min(Math.max(p.intensity || 1, 1), 3);
    return {
      k, w: p.w || 80, size: 34 + k * 10,
      sx: Math.max(320, window.innerWidth - p.x + 60), sy: -(p.y + 80),
      truemmer: Array.from({ length: 22 + k * 8 }, () => {
        const a = Math.PI + Math.random() * Math.PI, sp = 40 + Math.random() * (70 + k * 20);
        return { dx: Math.cos(a) * sp, dy: Math.sin(a) * sp * 0.8, size: 4 + Math.random() * 7, farbe: ppHex(ppFx5Wahl(['#6b4a2a', '#9d612f', '#ff8b1a', '#ffd966', '#3a2412', '#ff491a'])), delay: 520 + Math.random() * 80, dur: 420 + Math.random() * 320 };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Moana Rain (`moana_rain`, Tempeste Moana) — PIXELART. Blauer Regen prasselt schräg (≈18°) aufs Ziel: bläulicher Dunst (Dither-Scheibe), 46 Regenstriche (Pixelketten, Kopf unten hell,
//  Schweif läuft aus), dazwischen steigen Pixel-Noten (♪ ♫ ♩ ♬, weiß mit blauem Schatten) auf, am Boden spritzt ein Ring (ab 480 ms). Teilchen laufen in der Lebensdauer (1000 ms) zu Ende.
// ═════════════════════════════════════════════════════════════════
const PP_FX5_REGEN = ppFx5Hex(['#e5edfa', '#b3d8f9', '#66b6ff', '#b4dff8', '#399edf']);
const ppFx5MoanaRegen = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, ENDE = 1000, C = PP_FX5_REGEN, aus = ppR1Aus(t, 900, ENDE);
  const mu = t / 1100;
  if (mu <= 1) {
    const [op, sc] = ppKf(mu, [[0, [0, .5]], [.3, [1, 1]], [1, [0, 1.3]]]);
    ppFx5Verlauf(g, cx, cy, 70 * sc / S, 50 * sc / S, [C[2]], op * 0.4, 0.5);
  }
  // Regenstriche
  const sn = Math.sin(18 * Math.PI / 180), cs = Math.cos(18 * Math.PI / 180);
  teile.tropfen.forEach((d) => {
    const u = ppFx5Lauf(t, d.delay, d.dur, ENDE);
    if (u === null) return;
    const op = u < 0.15 ? u / 0.15 : u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15;
    const x0 = cx + (d.left + 1 - 26 + 52 * u) / S, y0 = cy + (-110 + 120 * u) / S, n = d.len / S;
    for (let j = 0; j <= n; j++) {
      const f = j / n;
      g.put(x0 + sn * j, y0 + cs * j, f > 0.92 ? C[0] : d.farbe, op * (0.15 + 0.85 * f) * aus);
    }
  });
  // Noten
  teile.noten.forEach((n) => {
    const u = ppFx5Lauf(t, n.delay, n.dur, ENDE);
    if (u === null) return;
    const op = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75, e = ppFx5Aus(u);
    ppFx5Note(g, n.art, n.size, cx + n.left / S, cy + (10 + n.size * 0.5 - 70 * e) / S, C[0], op * aus, C[2]);
  });
  // Spritzer-Ring (520 ms ab 480 ms): 92 × 32 px
  const su = (t - 480) / 520;
  if (su >= 0 && su <= 1) {
    const sc = 0.3 + 1.5 * ppFx5Aus(su);
    g.ellRing(cx, cy, 46 * sc / S, 16 * sc / S, 1.2, C[3], 0.9 * (1 - su) * aus);
  }
}, 1000, { breite: 300, hoehe: 240, ankerY: 135 }, {
  z: 10100,
  vorbereiten: () => ({
    tropfen: Array.from({ length: ppFxN(46) }, () => ({ left: Math.round(Math.random() * 130 - 65), len: 18 + Math.random() * 26, farbe: ppFx5Wahl(PP_FX5_REGEN), delay: Math.round(Math.random() * 520), dur: Math.round(340 + Math.random() * 220) })),
    noten: Array.from({ length: ppFxN(7) }, (_, i) => ({ art: PP_FX5_NOTENARTEN[i % 4], left: Math.round(Math.random() * 100 - 50), delay: Math.round(Math.random() * 500), dur: Math.round(800 + Math.random() * 400), size: 16 + Math.random() * 12 })),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Moonlight Beam (`moonlight_beam`, Moonlight Butterfly, 1400 ms) — PIXELART. Bläuliches Mondlicht fällt von oben aufs Ziel: oben eine kalte Mondscheibe (Pixel-Kugel mit Dither-Schein),
//  ein nach unten aufgefächerter Lichtschacht (Trapez, wächst in 360 ms von oben herab, Deckung läuft von dünn zu kräftig, gedithert) mit hellem Kern, Staubfunken, die im Licht nach
//  oben treiben (Endlosschleife), und unten ein Lichtteich auf dem Ziel (Ellipse).
// ═════════════════════════════════════════════════════════════════
const PP_FX5_MONDLICHT = ppFx5Hex(['#e5f5fa', '#bddcef', '#89abdc', '#b4cff8', '#b3d8f9', '#e5edfa', '#66b6ff']);
const ppFx5Mondlicht = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX5_MONDLICHT, { ww, hh, hoehe } = teile, ENDE = 1400;
  // Mondscheibe (1400 ms)
  const mu = t / 1400;
  if (mu <= 1) {
    const [op, sc] = ppKf(mu, [[0, [0, .6]], [.22, [1, 1]], [.76, [.95, .93]], [1, [0, .9]]]), r = ww * 0.16 * sc / S, my = cy - (hoehe + ww * 0.04) / S;
    ppFx5Verlauf(g, cx, my, r + 5, r + 5, [C[3]], op * 0.4, 0.75);
    g.disc(cx, my, r, C[2], op);
    g.disc(cx - r * 0.1, my - r * 0.1, r * 0.8, C[1], op);
    g.disc(cx - r * 0.25, my - r * 0.25, r * 0.45, C[0], op);
  }
  // Schacht + Kern: Trapez, wächst von oben (Zoom Y .12 → 1 in 26 %), Deckung 0 → 1 (26 %) → .9 (72 %) → 0
  const schacht = (delay, links, breit, hoch, form, farbe) => {
    const u = (t - delay) / 1400;
    if (u < 0 || u > 1) return;
    const [op, sy] = ppKf(u, [[0, [0, .12]], [.26, [1, 1]], [.72, [.9, 1]], [1, [0, 1]]]);
    const top = cy - hoehe / S, H = hoch * sy / S, Wd = breit / S, x0 = cx + links / S;
    const pts = form.map(([px, py]) => [x0 + px / 100 * Wd, top + py / 100 * H]);
    ppFx5Flaeche(g, pts, (X, Y) => {
      const v = H > 0 ? (Y - top) / H : 0, al = farbe(v) * op;
      return al > 0.02 ? [v < 0.5 ? C[4] : v < 0.85 ? C[3] : C[2], Math.min(0.62, al * 1.25)] : null;
    });
    // helle Kanten
    const [a0, a1, b0, b1] = [pts[0], pts[3], pts[1], pts[2]];
    g.line(a0[0], a0[1], a1[0], a1[1], C[5], 0.5 * op); g.line(b0[0], b0[1], b1[0], b1[1], C[5], 0.5 * op);
  };
  schacht(0, -ww * 0.52, ww * 1.04, hoehe + hh * 0.35, [[40, 0], [60, 0], [96, 100], [4, 100]], (v) => ppKf(v, [[0, [.05]], [.35, [.30]], [.78, [.42]], [1, [.12]]], true)[0]);
  schacht(120, -ww * 0.2, ww * 0.4, hoehe + hh * 0.3, [[42, 0], [58, 0], [88, 100], [12, 100]], (v) => ppKf(v, [[0, [.1]], [.45, [.45]], [1, [.25]]], true)[0]);
  // Staub
  teile.staub.forEach((s) => {
    const u = (((t - s.delay) / s.dur) % 1 + 1) % 1, op = u < 0.18 ? u / 0.18 : 1 - (u - 0.18) / 0.82;
    ppFx5Punkt(g, cx + (s.links + s.weite * u) / S, cy + (-s.start - 70 * u) / S, s.groesse / S * 1.1, C[0], op * ppR1Aus(t, 1150, ENDE));
  });
  // Lichtteich (1400 ms ab 160 ms): ww·.96 × ww·.34, Mitte (0, hh·.14 + ww·.17)
  const pu = (t - 160) / 1400;
  if (pu >= 0 && pu <= 1) {
    const [op, sc] = ppKf(pu, [[0, [0, .4]], [.3, [1, 1]], [.8, [.85, 1.05]], [1, [0, 1.1]]]);
    ppFx5Verlauf(g, cx, cy + (hh * 0.14 + ww * 0.17) / S, ww * 0.48 * sc / S, ww * 0.17 * sc / S, [C[5], C[3]], op * 0.75, 0.35, [0.5, 1]);
  }
}, 1400, (p) => {
  const ww = Math.max(p.w || 90, 90), hh = Math.max(p.h || 120, 120), hoehe = hh * 2.3, oben = Math.ceil(hoehe + ww * 0.3 + 12), unten = Math.ceil(hh * 0.14 + ww * 0.4 + 24), br = Math.ceil(ww * 1.1 + 40);
  return { breite: br, hoehe: oben + unten, ankerY: oben };
}, {
  z: 10150,
  vorbereiten: (sz) => {
    const ww = Math.max(sz.props.w || 90, 90), hh = Math.max(sz.props.h || 120, 120), hoehe = hh * 2.3;
    return {
      ww, hh, hoehe,
      staub: Array.from({ length: ppFxN(16) }, () => ({ links: (Math.random() - 0.5) * ww * 0.82, start: Math.random() * hoehe * 0.75, groesse: 2 + Math.random() * 4, dur: 1500 + Math.random() * 1100, delay: -Math.random() * 1600, weite: (Math.random() - 0.5) * 14 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Music Notes (`music_notes`; Deepsea Siren, Healing Melody, Pinta, Elana …) — PIXELART. Eine rosa-violette Dither-Scheibe pulsiert (ab 250 ms), 32 Pixel-Noten (♪ ♫ ♩ ♬ in bunten
//  Palettenfarben, zwei Größen, mit dunklem Schatten) steigen fächernd auf und verblassen, 16 bunte Funken steigen in ganzen Pixeln. Laufzeiten sind auf die Lebensdauer (1000 ms) gekürzt. ENDE 1000.
// ═════════════════════════════════════════════════════════════════
const PP_FX5_BUNT = ppFx5Hex(['#f174ab', '#ff9b3a', '#68c6fd', '#fad54a', '#c98aff', '#66ffa2']);
const ppFx5Noten = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, ENDE = 1000;
  // Scheibe (600 ms ab 250 ms): 100 px, Zoom .3 → 1,5 → 2
  const fu = (t - 250) / 600;
  if (fu >= 0 && fu <= 1) {
    const [op, sc] = ppKf(fu, [[0, [1, .3]], [.5, [.7, 1.5]], [1, [0, 2]]]);
    ppFx5Verlauf(g, cx, cy, 50 * sc / S, 50 * sc / S, [ppHex('#c98aff'), ppHex('#fc69c6')], op * 0.4, 0.4, [0.5, 1]);
  }
  // Noten
  teile.noten.forEach((n) => {
    const u = ppFx5Lauf(t, n.delay, n.dur, ENDE);
    if (u === null) return;
    const e = ppFx5Aus(u), op = ppKf(u, [[0, [0]], [.15, [n.opacity]], [.5, [n.opacity]], [1, [0]]], true)[0];
    const x = n.startX + (n.endX - n.startX) * e, y = n.startY + (n.endY - n.startY) * e;
    ppFx5Note(g, n.art, n.size * ppKf(u, [[0, [.3]], [.15, [1.1]], [.5, [1]], [1, [.5]]])[0] * 1.1, cx + x / S, cy + y / S, n.farbe, op, ppHex('#323232'));
  });
  // Funken
  teile.funken.forEach((s) => {
    const u = ppFx5Lauf(t, s.delay, s.dur, ENDE);
    if (u === null) return;
    const op = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8, rise = u < 0.2 ? -10 * (u / 0.2) : -10 - 90 * ppFx5Aus((u - 0.2) / 0.8), sc = u < 0.2 ? 0.3 + 0.7 * (u / 0.2) : 1 - 0.8 * ((u - 0.2) / 0.8);
    ppFx5Punkt(g, cx + s.xOff / S, cy + (s.startY + rise) / S, s.size * sc / S * 1.2, s.farbe, op);
  });
}, 1000, { breite: 280, hoehe: 260, ankerY: 200 }, {
  z: 10100,
  vorbereiten: () => ({
    noten: Array.from({ length: ppFxN(32) }, () => {
      const w = Math.random() * Math.PI * 2, dist = 20 + Math.random() * 60;
      return { startX: Math.cos(w) * dist * 0.4, startY: Math.random() * 20 - 10, endX: Math.cos(w) * dist, endY: -40 - Math.random() * 120, size: 16 + Math.random() * 20, delay: Math.random() * 600, dur: 700 + Math.random() * 500,
        art: ppFx5Wahl(PP_FX5_NOTENARTEN), opacity: 0.7 + Math.random() * 0.3, farbe: ppFx5Wahl(PP_FX5_BUNT) };
    }),
    funken: Array.from({ length: ppFxN(16) }, () => ({ xOff: -40 + Math.random() * 80, startY: 10 + Math.random() * 20, delay: 100 + Math.random() * 500, dur: 500 + Math.random() * 400, size: 3 + Math.random() * 5, farbe: ppFx5Wahl(PP_FX5_BUNT) })),
  }),
});

ppFxUeberschreiben('knife_throw_fly', ppFx5MesserWurf);
ppFxUeberschreiben('last_resort_blast', ppFx5LastResort);
ppFxUeberschreiben('lava_fountain', ppFx5Lava);
ppFxUeberschreiben('love_burst', ppFx5LoveBurst);
ppFxUeberschreiben('lunar_eclipse_pulse', ppFx5MondFinsternis);
ppFxUeberschreiben('lure_beacon', ppFx5Lockruf);
ppFxUeberschreiben('massacre', ppFx5Massaker);
ppFxUeberschreiben('mega_explosion', ppFx5MegaExplosion);
ppFxUeberschreiben('meteor_crash', ppFx5Meteor);
ppFxUeberschreiben('moana_rain', ppFx5MoanaRegen);
ppFxUeberschreiben('moonlight_beam', ppFx5Mondlicht);
ppFxUeberschreiben('music_notes', ppFx5Noten);
