// Pixelart-Portierungen (Canvas), Batch 15 (zweite Welle, Schwelle 50 ms): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
//
//  Vorher: je Effekt zehn bis dreissig CSS-animierte Elemente (Rauchwolken, Sporen, Schaedel, Tropfen, Funken …), die die Pixel-Pipeline beim Start einzeln buk (50–130 ms Hauptfaden-Blockade).
//  Jetzt: EINE Leinwand je Effekt (`ppR1Leinwand`, app-board.jsx), Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s, Dithering statt Alpha und Weichzeichner, Zeichen/Emojis als kleine Pixel-Sprites.
//
//  Typen: plague_smoke, poison_pollen_rain, poison_skulls, puppet_swap_shishi (= Flame Strike, `ppR1FlameStrike`), red_lightning, shadow_summon, shield_block, slimy_heal_goo, smoke_vial,
//  snake_bite, soul_shard_dark_grant.  `ruestkammer_tor` bleibt UNVERAENDERT: die Komponente haengt an einem echten DOM-Kartenbild (`.rtor-karte` mit dem Kartenfoto, das wackelt und
//  durch das Portal faellt), Portal und Landung sind schon Canvas-Szenen (`ppSzene`) — kaum Kosten, und das Foto laesst sich nicht auf eine Leinwand legen, ohne es neu zu zeichnen.
//  Die DOM-Fassungen enden alle nach `ZONEN_ANIM_DAUER[typ] || 1000` ms (die Lebensdauer entfernt sie hart); die Zeitachsen hier sind so gelegt, dass sie innerhalb dieser Frist ausklingen
//  (die alten liefen teils 1,5–1,9 s und wurden bei 1000 ms abgeschnitten).

// ── gemeinsame Bausteine ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const ppFx15R = (a, b) => a + Math.random() * (b - a);
const ppFx15Wahl = (liste) => liste[Math.floor(Math.random() * liste.length)];
const ppFx15P = (liste) => liste.map(ppHex);
const ppFx15Ei = (u) => u * u;                                      // ease-in
const ppFx15Eio = (u) => u * u * (3 - 2 * u);                       // ease-in-out
/** Schnell: Dither-Schein von aussen nach innen (Stufen = Farben), Deckung `a`; wie `g.glow`, nur ohne Math.hypot. */
function ppFx15Glow(g, cx, cy, rx, ry, stufen, a = 1, p = 1) {
  if (rx < 0.6 || ry < 0.6 || a <= 0.02) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const RX = Math.ceil(rx), RY = Math.ceil(ry), n = stufen.length, irx = 1 / rx, iry = 1 / ry;
  for (let j = -RY; j <= RY; j++) {
    const v = j * iry, v2 = v * v;
    if (v2 >= 1) continue;
    for (let i = -RX; i <= RX; i++) {
      const u = i * irx, d2 = u * u + v2;
      if (d2 >= 1) continue;
      const w = 1 - Math.sqrt(d2), sv = (p === 1 ? w : Math.pow(w, p)) * n, k = Math.floor(sv), neu = (sv - k) > ppBayer(cx + i, cy + j) ? k + 1 : k;
      if (neu <= 0) continue;
      g.put(cx + i, cy + j, stufen[Math.min(n, neu) - 1], a);
    }
  }
}
/** Runder Punkt mit Durchmesser `d` Rasterpixeln (mind. 1); `halo` = gedithertes 1-Pixel-Rund um den Punkt statt Leuchten. */
function ppFx15Punkt(g, x, y, d, c, a = 1, halo = null) {
  d = Math.max(1, Math.round(d));
  if (halo && d >= 2) g.disc(x, y, d / 2 + 0.9, halo, a * 0.45);
  if (d === 1) g.put(x, y, c, a);
  else if (d === 2) g.block(x - 1, y - 1, 2, 2, c, a);
  else g.disc(x, y, d / 2 - 0.2, c, a);
}
/** Sprite mit gedithertem Rand: viermal in der Halo-Farbe um ein Pixel versetzt, dann das Bild. */
function ppFx15Rand(g, zeilen, pal, haloPal, cx, cy, a) {
  g.spr(zeilen, haloPal, cx - 1, cy, a * 0.6); g.spr(zeilen, haloPal, cx + 1, cy, a * 0.6);
  g.spr(zeilen, haloPal, cx, cy - 1, a * 0.6); g.spr(zeilen, haloPal, cx, cy + 1, a * 0.6);
  g.spr(zeilen, pal, cx, cy, a);
}
const ppFx15Einfarbig = (zeilen, farbe) => { const p = {}; for (const z of zeilen) for (const ch of z) if (ch !== '.') p[ch] = farbe; return p; };

// ── Pixelbilder ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const PP_FX15_SCHAEDEL = {
  klein: ['.hhhhb.', 'hhhhhbb', 'hoohoob', 'hoohoob', 'bhhhhbb', '.bhhhb.', '..b.b..'],
  gross: ['.hhhhhhb.', 'hhhhhhhbb', 'hhoohoobb', 'hhoohoobb', 'bhhhhhbbb', '.bhhbhbb.', '..bbbbb..', '..b.b.b..'],
};
const PP_FX15_SCHAEDEL_FARBE = { h: ppHex('#fff8e8'), b: ppHex('#e2d8cb'), o: ppHex('#0f2412') };
const PP_FX15_SCHAEDEL_HALO = { klein: ppFx15Einfarbig(PP_FX15_SCHAEDEL.klein, ppHex('#66ff71')), gross: ppFx15Einfarbig(PP_FX15_SCHAEDEL.gross, ppHex('#66ff71')) };
const PP_FX15_PILZ = ['.rrr.', 'rwrwr', 'rrrrr', '.sss.', '..s..'];
const PP_FX15_PILZ_FARBE = { r: ppHex('#e92f38'), w: ppHex('#ffffff'), s: ppHex('#f1e5fa') };
const PP_FX15_FUNKEL = ['..y..', '.ywy.', 'ywwwy', '.ywy.', '..y..'];
const PP_FX15_FUNKEL_FARBE = { y: ppHex('#e3ce36'), w: ppHex('#ffffff') };
const PP_FX15_HERZ = {
  gross: ['.oo.oo.', 'ohhoggo', 'ohggggo', 'ogggggo', '.ogggo.', '..ogo..', '...o...'],
  klein: ['.o.o.', 'ohggo', 'ogggo', '.ogo.', '..o..'],
};
const PP_FX15_HERZ_FARBE = { o: ppHex('#167927'), g: ppHex('#3ddc57'), h: ppHex('#b3f9b8') };
const PP_FX15_STERN = {   // ✦ ✧ ✶ ◆ ★ als 5×5-Sprites
  voll: ['..S..', '.SWS.', 'SWWWS', '.SWS.', '..S..'],
  hohl: ['..S..', '.S.S.', 'S...S', '.S.S.', '..S..'],
  kreuz: ['S.S.S', '.SWS.', 'SWWWS', '.SWS.', 'S.S.S'],
  fuenf: ['..S..', '..S..', 'SSWSS', '.SSS.', '.S.S.'],
};
const PP_FX15_STERN_FARBE = { S: ppHex('#c98aff'), W: ppHex('#ffffff') };
const PP_FX15_STERN_HALO = {};
for (const k in PP_FX15_STERN) PP_FX15_STERN_HALO[k] = ppFx15Einfarbig(PP_FX15_STERN[k], ppHex('#6618b4'));

// ═════════════════════════════════════════════════════════════════
//  Plague Smoke (`plague_smoke`) — dunkle Seuchenwolken quellen um die Mitte auf, ziehen leicht nach oben und loesen sich auf. 18 Wolken (Dither-Scheiben in vier Dunkelstufen),
//  gestaffelt ueber ~380 ms, je 480–650 ms. (Alt: bis 1,9 s, bei 1000 ms hart abgeschnitten.)
// ═════════════════════════════════════════════════════════════════
const PP_FX15_RAUCH = ppFx15P(['#141414', '#222222', '#323232']);
const ppFx15PlagueSmoke = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const c of T.wolken) {
    const u = (t - c.delay) / c.dur;
    if (u <= 0 || u >= 1) continue;
    const [px, py, sc] = ppKf(u, [[0, [0, 5, 0.4]], [0.5, [c.dx, c.dy, 1]], [1, [c.dx * 1.3, c.dy - 15, 1.2]]], ppFx15Eio);
    const op = ppKf(u, [[0, [0]], [0.2, [c.op]], [0.5, [c.op]], [1, [0]]], true)[0], r = (c.size * sc) / 2 / S;
    ppFx15Glow(g, cx + px / S, cy + py / S, r, r, PP_FX15_RAUCH, Math.min(1, op * 1.25), 0.55);   // Deckung hoeher: gleich gedithert uebereinanderliegende Wolken summieren sich nicht
  }
}, 1000, { breite: 240, hoehe: 240 }, {
  z: 10100,
  vorbereiten: () => {
    const n = ppFxN(18);
    return { wolken: Array.from({ length: n }, (_, i) => ({ dx: ppFx15R(-30, 30), dy: ppFx15R(-15, 15), size: ppFx15R(25, 60), delay: i * (340 / n) + ppFx15R(0, 40), dur: ppFx15R(480, 640), op: ppFx15R(0.5, 0.9) })) };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Poison Pollen Rain (`poison_pollen_rain`) — violett-gelber Aufschlagschein (400 ms), 24 Sporen rieseln von 40 px ueber der Mitte etwa 55 px nach unten (violett / gelb, mit leichtem Seitwind),
//  ein Fuenftel davon sind Pixel-Pilze und Funkeln (statt der Emoji-Zeichen). Sporen 450–700 ms, gestaffelt ueber 250 ms.
// ═════════════════════════════════════════════════════════════════
const PP_FX15_SPORE_LILA = ppFx15P(['#9544d5', '#702db3', '#b866ff', '#9544d5']), PP_FX15_SPORE_GELB = ppFx15P(['#e3ce36', '#e3ce36', '#ffe469', '#c79e05']);
const PP_FX15_POLLEN_SCHEIN = ppFx15P(['#e3ce36', '#9544d5']);
const ppFx15Pollen = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const fk = t / 400;
  if (fk >= 0 && fk <= 1) {
    const [sc, op] = ppKf(fk, [[0, [0.5, 0]], [0.3, [1.2, 0.8]], [1, [1.5, 0]]]), r = (30 * sc) / S;
    ppFx15Glow(g, cx, cy, r, r, PP_FX15_POLLEN_SCHEIN, op * 0.8, 0.9);
  }
  for (const s of T.sporen) {
    const u = (t - s.delay) / s.dur;
    if (u <= 0 || u >= 1) continue;
    const [px, py, sc, op] = ppKf(u, [[0, [0, 0, 0.5, 0]], [0.15, [s.wobble * 0.3, 8, 1, 0.9]], [0.7, [s.wobble, 35, 0.9, 0.7]], [1, [s.wobble * 1.3, 55, 0.4, 0]]], ppFx15Ei);
    const X = cx + (s.xOff + px) / S, Y = cy + (-40 + (s.emoji ? (s.size + 4) / 2 : s.size / 2) + py) / S;
    if (s.emoji === 'pilz') g.spr(PP_FX15_PILZ, PP_FX15_PILZ_FARBE, X, Y, op);
    else if (s.emoji) g.spr(PP_FX15_FUNKEL, PP_FX15_FUNKEL_FARBE, X, Y, op);
    else ppFx15Punkt(g, X, Y, (s.size * sc) / S + 0.8, s.farbe, Math.min(1, op * 1.15), s.farbe);
  }
}, 1000, { breite: 240, hoehe: 210 }, {
  z: 10100,
  vorbereiten: () => ({
    sporen: Array.from({ length: ppFxN(24) }, () => {
      const emoji = Math.random() < 0.2 ? (Math.random() < 0.5 ? 'pilz' : 'funkel') : null;
      return { xOff: ppFx15R(-35, 35), size: ppFx15R(4, 11), delay: ppFx15R(0, 250), dur: ppFx15R(450, 700), wobble: ppFx15R(-6, 6), emoji, farbe: ppFx15Wahl(Math.random() < 0.5 ? PP_FX15_SPORE_LILA : PP_FX15_SPORE_GELB) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Poison Skulls (`poison_skulls`, Poisoned Meat) — fuenf Pixel-Totenschaedel (gruener Rand statt Leuchten) kreisen auf einer flachen Ellipse (Hoehe 32 % der Breite) ueber der Karte
//  (38 % der Hoehe oberhalb der Mitte) und werden dabei durchsichtig (gedithert); darunter ein gruener Giftdunst (Dither-Ellipse). Eine Umrundung in ~800 ms (alt: 1,5 Umdrehungen in 1,5 s,
//  bei 1000 ms abgeschnitten). Die Leinwand sitzt am Mittelpunkt der Bahn (x, y − 0,38 h), Breite nach der Bahn (`w`).
// ═════════════════════════════════════════════════════════════════
const PP_FX15_GIFT_DUNST = ppFx15P(['#167927', '#3ddc57']);
const ppFx15SkullsLeinwand = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, rx = T.rx;
  const hk = t / 900;
  if (hk >= 0 && hk <= 1) {
    const [sc, op] = ppKf(hk, [[0, [0.4, 0]], [0.25, [1, 1]], [1, [1.3, 0]]]);
    ppFx15Glow(g, cx, cy + 1 / S, (rx * 1.2 * sc) / S, (15 * sc) / S, PP_FX15_GIFT_DUNST, op * 0.7, 0.9);
  }
  const lst = [];
  for (const s of T.schaedel) {
    const u = (t - s.delay) / s.dur;
    if (u <= 0 || u >= 1) continue;
    const w = ((s.phase + 400 * u) * Math.PI) / 180, op = u < 0.1 ? u / 0.1 : 1 - (u - 0.1) / 0.9;
    lst.push({ x: cx + (Math.cos(w) * rx) / S, y: cy + (Math.sin(w) * rx * 0.32) / S, op, art: s.art });
  }
  lst.sort((a, b) => a.y - b.y);                                                  // hinten (oben) zuerst
  for (const k of lst) ppFx15Rand(g, PP_FX15_SCHAEDEL[k.art], PP_FX15_SCHAEDEL_FARBE, PP_FX15_SCHAEDEL_HALO[k.art], k.x, k.y, k.op);
}, 1000, (p) => { const rx = Math.max(34, (p.w || 80) * 0.55), b = Math.ceil(rx * 1.7 + 36) * 2; return { breite: b, hoehe: 150 }; }, {
  z: 10100,
  vorbereiten: (sz) => ({
    rx: Math.max(34, (sz.props.w || 80) * 0.55),
    schaedel: Array.from({ length: 5 }, (_, i) => ({ phase: (i / 5) * 360, delay: i * 45, dur: 740 + (i % 3) * 40, art: i % 2 ? 'gross' : 'klein' })),
  }),
});
function ppFx15Skulls(props) { return React.createElement(ppFx15SkullsLeinwand, { ...props, y: props.y - (props.h || 110) * 0.38 }); }

// ═════════════════════════════════════════════════════════════════
//  Red Lightning (`red_lightning`, Chaos-Diamond) — roter Lichtblitz: greller Schein (weiss → rot, 780 ms), roter Stossring (640 ms, .3 → 2,1), drei gezackte Blitze (rote 2-Pixel-Linie mit
//  weissem Kern, 520 ms, flackern, um 70 ms versetzt) bei x = −38 / 4 / 40 von oben (−70) nach unten (+70). Zacken zufaellig je Aufruf wie vorher.
// ═════════════════════════════════════════════════════════════════
const PP_FX15_ROT_SCHEIN = ppFx15P(['#780014', '#c0141c', '#ff1a1a', '#ffffff']);
const ppFx15RedLightning = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const gk = t / 780;
  if (gk >= 0 && gk <= 1) {
    const [sc, op] = ppKf(gk, [[0, [0.3, 0]], [0.14, [0.95, 1]], [1, [1.35, 0]]]), r = (90 * sc) / S;
    ppFx15Glow(g, cx, cy, r, r, PP_FX15_ROT_SCHEIN, op * 0.9, 1.5);
  }
  const rk = t / 640;
  if (rk >= 0 && rk <= 1) {
    const [sc, op] = ppKf(rk, [[0, [0.3, 0.95]], [1, [2.1, 0]]]), r = (50 * sc) / S, c = ppHex('#e92f38');
    g.ellRing(cx, cy, r + 1.5, r + 1.5, 1, ppHex('#ff6666'), op * 0.5);              // harter Rand statt Schein
    g.ellRing(cx, cy, r, r, 2, c, op);
  }
  for (const b of T.blitze) {
    const u = (t - b.verzug) / 520;
    if (u <= 0 || u >= 1) continue;
    const op = ppKf(u, [[0, [0]], [0.08, [1]], [0.22, [0.25]], [0.36, [1]], [0.6, [0.4]], [1, [0]]], true)[0];
    for (let i = 1; i < b.pts.length; i++) {
      const x0 = cx + (b.dx + b.pts[i - 1][0]) / S, y0 = cy + b.pts[i - 1][1] / S, x1 = cx + (b.dx + b.pts[i][0]) / S, y1 = cy + b.pts[i][1] / S;
      g.line(x0 - 1, y0, x1 - 1, y1, ppHex('#ff1a1a'), op * 0.55, 3);               // Hof
      g.line(x0, y0, x1, y1, ppHex('#ff1a1a'), op, 2);
      g.line(x0, y0, x1, y1, ppHex('#ffffff'), op, 1);
    }
  }
}, 800, { breite: 306, hoehe: 306 }, {
  z: 10100,
  vorbereiten: () => ({
    blitze: [-38, 4, 40].map((dx, i) => {
      const pts = [];
      let px = 0;
      for (let k = 0; k <= 7; k++) { px += (Math.random() - 0.5) * 22; pts.push([px, -70 + k * 20]); }
      return { dx, pts, verzug: i * 70 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Shadow Summon (`shadow_summon`) — dunkelviolette Tentakel steigen unter der Karte auf (16 Pixel-Zeichen ▓ ░ ▒ ◆ ● als gedithert gefuellte Bloecke / Raute / Punkt, 60 px hoch, 400–800 ms),
//  ab 250 ms ein violetter Schein (600 ms, waechst .3 → 1,8), ab 300 ms zehn Funken, die nach aussen stieben (300–550 ms).
// ═════════════════════════════════════════════════════════════════
const PP_FX15_SCHATTEN_SCHEIN = ppFx15P(['#2b0b47', '#47117e', '#58238c']);
const PP_FX15_SCHATTEN_WISP = ppFx15P(['#7e41ba', '#58238c', '#58238c', '#1a0a3a', '#7e41ba']);
const ppFx15ShadowSummon = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const fk = (t - 250) / 600;
  if (fk >= 0 && fk <= 1) {
    const [sc, op] = ppKf(fk, [[0, [0.3, 1]], [0.5, [1.4, 0.6]], [1, [1.8, 0]]]), r = (35 * sc) / S;
    ppFx15Glow(g, cx, cy, r, r, PP_FX15_SCHATTEN_SCHEIN, op * 0.9, 0.9);
  }
  for (const w of T.tentakel) {
    const u = (t - w.delay) / w.dur;
    if (u <= 0 || u >= 1) continue;
    const [ty, sc] = ppKf(u, [[0, [0, 0.5]], [0.3, [-20, 1.1]], [0.7, [-40, 0.9]], [1, [-60, 0.3]]]);
    const op = ppKf(u, [[0, [0]], [0.3, [0.9]], [0.7, [0.7]], [1, [0]]], true)[0];
    const X = cx + (w.xOff + w.size * 0.4) / S, Y = cy + (40 - w.size * 0.6 + ty) / S, n = Math.max(1, Math.round((w.size * sc) / S)), c = PP_FX15_SCHATTEN_WISP[0];
    if (w.art === 'punkt') { ppFx15Punkt(g, X, Y, n + 0.5, c, op, PP_FX15_SCHATTEN_SCHEIN[1]); continue; }
    if (w.art === 'raute') {
      const R = Math.max(1, n / 2);
      for (let j = -Math.ceil(R); j <= Math.ceil(R); j++) { const hb = Math.round(R - Math.abs(j)); if (hb >= 0) g.block(X - hb, Y + j, hb * 2 + 1, 1, c, op); }
      continue;
    }
    g.block(X - n / 2 - 1, Y - n / 2 - 1, n + 2, n + 2, PP_FX15_SCHATTEN_SCHEIN[1], op * 0.4);                 // Rand
    g.block(X - n / 2, Y - n / 2, n, n, c, op * w.dichte);                                                    // ▓ 75 %, ▒ 50 %, ░ 25 %
  }
  for (const w of T.wisps) {
    const u = (t - w.delay) / w.dur;
    if (u <= 0 || u >= 1) continue;
    const e = 1 - (1 - u) * (1 - u), r = (w.size * (1.2 - 1.2 * u)) / S, op = u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8;
    if (r >= 0.4) ppFx15Punkt(g, cx + (w.dx * e) / S, cy + (w.dy * e) / S, Math.max(1, r * 2), w.farbe, op);
  }
}, 1000, { breite: 240, hoehe: 240 }, {
  z: 10100,
  vorbereiten: () => ({
    tentakel: Array.from({ length: ppFxN(16) }, () => {
      const art = ppFx15Wahl([['block', 0.75], ['block', 0.25], ['block', 0.5], ['raute'], ['punkt']]);
      return { xOff: ppFx15R(-30, 30), size: ppFx15R(6, 16), delay: ppFx15R(0, 200), dur: ppFx15R(400, 790), art: art[0], dichte: art[1] || 1 };
    }),
    wisps: Array.from({ length: ppFxN(10) }, () => {
      const w = Math.random() * Math.PI * 2, v = ppFx15R(10, 35);
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: ppFx15R(2, 6), farbe: ppFx15Wahl(PP_FX15_SCHATTEN_WISP), delay: ppFx15R(300, 450), dur: ppFx15R(300, 550) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Shield Block (`shield_block`) — eine blaue Barriere (Sechseck 84 × 100 px: gedithert gefuellt, harter heller Rand, innen heller Saum, aussen ein gedithertes blaues Band statt Leuchten)
//  schlaegt in 620 ms auf (Groesse .55 → 1,06 → 1), haelt kurz und verglueht; Aufprallblitz (ab 90 ms, 300 ms), Wellenring (ab 110 ms, 460 ms) und zehn Funken (120–240 ms Start, 300–500 ms).
// ═════════════════════════════════════════════════════════════════
const PP_FX15_SCHILD = { rand: ppHex('#e5f5fa'), saum: ppHex('#b3d8f9'), hell: ppHex('#b3d8f9'), mitte: ppHex('#66b6ff'), tief: ppHex('#6d9bf8'), aussen: ppHex('#68c6fd'), aussen2: ppHex('#7bbeea') };
const PP_FX15_FUNKEN_BLAU = ppFx15P(['#e5f5fa', '#b3d8f9', '#68c6fd', '#e5f5fa']);
const PP_FX15_SCHILD_BLITZ = ppFx15P(['#b3d8f9', '#e5f5fa', '#ffffff']);
const ppFx15ShieldBlock = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, F = PP_FX15_SCHILD;
  const pk = t / 620;
  if (pk >= 0 && pk <= 1) {
    const [sc, op] = ppKf(pk, [[0, [0.55, 0]], [0.18, [1.06, 1]], [0.38, [0.98, 0.95]], [0.7, [1, 0.85]], [1, [1.04, 0]]]);
    const HW = (38.64 / S) * sc, HH = (50 / S) * sc, sl = HH / 2 / HW, kos = 1 / Math.sqrt(1 + sl * sl);
    const RX = Math.ceil(HW) + 3, RY = Math.ceil(HH) + 3;
    for (let j = -RY; j <= RY; j++) for (let i = -RX; i <= RX; i++) {
      const ax = Math.abs(i), ay = Math.abs(j);
      const tiefe = Math.min(HW - ax + 0.5, (HH - ax * sl - ay) * kos + 0.5);                 // Abstand zum Rand nach innen (negativ = ausserhalb)
      if (tiefe < -2) continue;
      if (tiefe < 0) { g.put(cx + i, cy + j, tiefe > -1 ? F.aussen : F.aussen2, op * (tiefe > -1 ? 0.7 : 0.35)); continue; }   // Band aussen
      if (tiefe < 1) { g.put(cx + i, cy + j, F.rand, op); continue; }                          // harter Rand
      if (tiefe < 2.5) { g.put(cx + i, cy + j, F.saum, op * 0.7); continue; }                    // innerer Saum
      const gr = ((i / HW) * 0.34 + (j / HH) * 0.94 + 1) / 2;                                    // Verlauf 160°: oben links hell → unten rechts violettblau
      g.put(cx + i, cy + j, gr < 0.3 ? F.hell : gr < 0.7 ? F.mitte : F.tief, op * (gr < 0.3 ? 0.65 : gr < 0.7 ? 0.45 : 0.55));
    }
  }
  const bk = (t - 90) / 300;
  if (bk >= 0 && bk <= 1) {
    const [sc, op] = ppKf(bk, [[0, [0.4, 0]], [0.35, [1.2, 1]], [1, [1.6, 0]]]), r = (18 * sc) / S;
    ppFx15Glow(g, cx, cy, r, r, PP_FX15_SCHILD_BLITZ, op * 0.95, 0.9);
  }
  const wk = (t - 110) / 460;
  if (wk >= 0 && wk <= 1) {
    const [sc, op] = ppKf(wk, [[0, [0.4, 0.9]], [1, [1.7, 0]]]), r = (30 * sc) / S;
    g.ellRing(cx, cy, r + 1, r + 1, 1, F.aussen, op * 0.6);
    g.ellRing(cx, cy, r, r, 1.5, F.aussen2, op);
  }
  for (const f of T.funken) {
    const u = (t - f.delay) / f.dur;
    if (u <= 0 || u >= 1) continue;
    const e = 1 - (1 - u) * (1 - u), sc = 1 - 0.7 * e, op = 0.95 * (1 - u), n = Math.max(1, Math.round((f.size * sc) / S));
    const X = cx + (f.dx * e) / S, Y = cy + (f.dy * e) / S;
    if (n >= 2) g.block(X - n / 2 - 1, Y - n / 2 - 1, n + 2, n + 2, F.aussen, op * 0.4);
    g.block(X - n / 2, Y - n / 2, n, n, f.farbe, op);
  }
}, 760, { breite: 240, hoehe: 240 }, {
  z: 10100,
  vorbereiten: () => ({
    funken: Array.from({ length: ppFxN(10) }, () => {
      const w = Math.random() * Math.PI * 2, weite = ppFx15R(26, 56);
      return { dx: Math.cos(w) * weite, dy: Math.sin(w) * weite * 0.7 - 8, size: ppFx15R(3, 7), delay: ppFx15R(120, 240), dur: ppFx15R(300, 500), farbe: ppFx15Wahl(PP_FX15_FUNKEN_BLAU) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Slimy Heal Goo (`slimy_heal_goo`) — leuchtend gruener Aufschlagschein (Ellipse 0,9 w × 0,7 h, 360 ms), sechs Schleimklekse bleiben haften (Dither-Ellipsen in drei Gruentoenen, ohne Drehung),
//  16 Tropfen spritzen im Faecher (−30° … 180°) nach aussen, acht Pixel-Herzen (statt des Herz-Emojis) steigen auf. Zeitachsen auf ≤ 1000 ms gelegt (Herzen alt bis 1,6 s).
// ═════════════════════════════════════════════════════════════════
const PP_FX15_GOO_SCHEIN = ppFx15P(['#5bbd7e', '#92d3a9', '#e5fae7']);
const PP_FX15_GOO_KLEKS = ppFx15P(['#1a4128', '#20ac37', '#75f091']);
const PP_FX15_GOO_FARBEN = ppFx15P(['#5bbd7e', '#92d3a9', '#92d3a9', '#75f091', '#20ac37', '#87cc00', '#b3f9cf', '#29663f']);
const ppFx15SlimyHeal = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, cw = sz.props.w || 100, ch = sz.props.h || 140;
  const fk = t / 360;
  if (fk >= 0 && fk <= 1) {
    const [sc, op] = ppKf(fk, [[0, [0.4, 0]], [0.25, [1.05, 0.95]], [1, [1.35, 0]]]);
    ppFx15Glow(g, cx, cy, (cw * 0.45 * sc) / S, (ch * 0.35 * sc) / S, PP_FX15_GOO_SCHEIN, op * 0.9, 0.9);
  }
  for (const s of T.kleckse) {
    const u = (t - s.delay) / s.dur;
    if (u <= 0 || u >= 1) continue;
    const [sc, op, ty] = ppKf(u, [[0, [0.2, 0, 0]], [0.3, [1.2, 1, 0]], [0.6, [1, 0.95, 0]], [1, [1.05, 0, 8]]]);
    const X = cx + (s.x + s.rx) / S, Y = cy + (s.y + s.ry + ty) / S, rx = (s.rx * sc) / S, ry = (s.ry * sc) / S;
    if (rx < 0.6 || ry < 0.6) continue;
    g.ell(X, Y, rx + 1, ry + 1, PP_FX15_GOO_KLEKS[2], op * 0.4);                             // harter Schein
    g.ell(X, Y, rx, ry, PP_FX15_GOO_KLEKS[0], op);
    g.ell(X, Y - 0.5, rx * 0.8, ry * 0.7, PP_FX15_GOO_KLEKS[1], op);
    g.ell(X - rx * 0.15, Y - ry * 0.25, rx * 0.4, ry * 0.35, PP_FX15_GOO_KLEKS[2], op);
  }
  for (const d of T.tropfen) {
    const u = (t - d.delay) / d.dur;
    if (u <= 0 || u >= 1) continue;
    const [f, sc, op] = ppKf(u, [[0, [0, 0.4, 0]], [0.15, [0.18, 1.1, 1]], [0.8, [0.92, 0.95, 1]], [1, [1, 0.55, 0]]]);
    ppFx15Punkt(g, cx + (d.dx * f) / S, cy + (d.dy * f) / S, (d.size * sc) / S, d.farbe, op, d.farbe);
  }
  for (const h of T.herzen) {
    const u = (t - h.delay) / h.dur;
    if (u <= 0 || u >= 1) continue;
    const [ty, sc, op] = ppKf(u, [[0, [0, 0.6, 0]], [0.3, [-12, 1, 1]], [1, [-50, 0.9, 0]]]);
    g.spr(h.size * sc >= 17 ? PP_FX15_HERZ.gross : PP_FX15_HERZ.klein, PP_FX15_HERZ_FARBE, cx + (h.xOff + h.size / 2) / S, cy + (h.startY + h.size / 2 + ty) / S, op);
  }
}, 1000, (p) => { const cw = p.w || 100, ch = p.h || 140; return { breite: Math.ceil(Math.max(240, cw * 1.4 + 60)), hoehe: Math.ceil(Math.max(250, ch * 1.4 + 60)) }; }, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 100, ch = sz.props.h || 140, nd = ppFxN(16), nh = ppFxN(8);
    return {
      tropfen: Array.from({ length: nd }, (_, i) => {
        const w = -Math.PI / 6 + Math.random() * ((Math.PI * 7) / 6), v = ppFx15R(30, 80);
        return { dx: Math.cos(w) * v, dy: Math.sin(w) * v + 16, size: ppFx15R(5, 12), delay: i * (190 / nd) + ppFx15R(0, 50), dur: ppFx15R(380, 600), farbe: ppFx15Wahl(PP_FX15_GOO_FARBEN) };
      }),
      kleckse: Array.from({ length: ppFxN(6) }, () => ({ x: -cw * 0.32 + Math.random() * cw * 0.64, y: -ch * 0.28 + Math.random() * ch * 0.56, rx: ppFx15R(8, 18), ry: ppFx15R(5, 11), delay: ppFx15R(60, 220), dur: ppFx15R(520, 720) })),
      herzen: Array.from({ length: nh }, (_, i) => ({ xOff: ppFx15R(-36, 36), startY: ppFx15R(10, 40), delay: 110 + i * (240 / nh) + ppFx15R(0, 60), dur: ppFx15R(520, 600), size: ppFx15R(14, 24) })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Smoke Vial (`smoke_vial`) — graue Rauchwolke ueber dem Ziel: erst ein Dunstschleier (Dither-Ellipse ueber der ganzen Karte, 1,1 w × 1,1 h), dann neun Qualmwolken (zwei mittig, sieben verstreut;
//  wachsen .4 → 1,35, treiben nach oben, loesen sich auf) in drei Grautoenen. Wolken gestaffelt ueber ~320 ms, je 520–650 ms (alt: bis 1,2 s, bei 1000 ms abgeschnitten).
// ═════════════════════════════════════════════════════════════════
const PP_FX15_QUALM = ppFx15P(['#222222', '#323232', '#535353']), PP_FX15_QUALM_DUNKEL = ppFx15P(['#141414', '#222222', '#323232']);
const ppFx15SmokeVial = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, cw = sz.props.w || 100, ch = sz.props.h || 140;
  const hk = t / 1000;
  if (hk >= 0 && hk <= 1) {
    const op = ppKf(hk, [[0, [0]], [0.25, [0.95]], [0.8, [0.6]], [1, [0]]])[0];
    ppFx15Glow(g, cx, cy, (cw * 0.62) / S, (ch * 0.62) / S, PP_FX15_QUALM_DUNKEL, op * 0.8, 0.7);
  }
  for (const p of T.wolken) {
    const u = (t - p.delay) / p.dur;
    if (u <= 0 || u >= 1) continue;
    const [sc, op, f] = ppKf(u, [[0, [0.4, 0, 0]], [0.3, [1.05, 0.95, 0]], [0.7, [1.2, 0.85, 0.6]], [1, [1.35, 0, 1]]]), r = (p.size * sc) / 2 / S;
    ppFx15Glow(g, cx + (p.x + p.drift * f) / S, cy + (p.y + p.rise * f) / S, r, r, p.hell ? PP_FX15_QUALM : PP_FX15_QUALM_DUNKEL, op * 0.9, 0.85);
  }
}, 1000, (p) => { const cw = p.w || 100, ch = p.h || 140; return { breite: Math.ceil(Math.max(260, cw * 1.8 + 40)), hoehe: Math.ceil(Math.max(280, ch * 1.8 + 40)) }; }, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 100, ch = sz.props.h || 140, n = ppFxN(9);
    return {
      wolken: Array.from({ length: n }, (_, i) => {
        const mitte = i < 2;
        return {
          x: mitte ? -cw * 0.05 + (Math.random() - 0.5) * 12 : ppFx15R(-cw * 0.45, cw * 0.45), y: mitte ? -ch * 0.05 + (Math.random() - 0.5) * 14 : ppFx15R(-ch * 0.45, ch * 0.45),
          size: (mitte ? 1 : 0.65) * (cw * 0.7 + Math.random() * cw * 0.25), delay: i * (300 / n) + ppFx15R(0, 30), dur: ppFx15R(520, 640), drift: ppFx15R(-9, 9), rise: -ppFx15R(8, 26), hell: Math.random() < 0.55,
        };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Snake Bite (`snake_bite`, Guardian Beast She) — zwei Elfenbein-Giftzaehne (6 × 19 Rasterpixel, hell → beige) schnappen von oben zu: fahren in 650 ms schraeg herein (Neigung als Zeilenversatz,
//  keine Drehung), schliessen sich bei ~320 ms in der Mitte, halten und ziehen sich zurueck; gruener Giftblitz (ab 250 ms, 550 ms), acht Giftsabber fallen nach dem Biss, 14 Spritzer.
//  Der Zahn bleibt bei jedem Aufruf gleich lang (kein Zufall), Tropfen und Spritzer sind zufaellig.
// ═════════════════════════════════════════════════════════════════
const PP_FX15_ZAHN = ppFx15P(['#ffffff', '#fff8e8', '#f7e0b5', '#ccb799']);
const PP_FX15_BISS_SCHEIN = ppFx15P(['#167927', '#87cc00', '#cbff66']);
const PP_FX15_BISS_FARBEN = ppFx15P(['#87cc00', '#cbff66', '#87cc00', '#f7f7ad', '#cbff66']);
const PP_FX15_TROPFEN = ppFx15P(['#cbff66', '#87cc00', '#5b9438']);
function ppFx15Zahn(g, x, y, sc, neigung, a) {   // (x, y) = Mitte der oberen Kante, neigung = Zeilenversatz je Zeile (Rasterpixel)
  const H = Math.max(2, Math.round(19 * sc)), W = 6 * sc, C = PP_FX15_ZAHN;
  for (let j = 0; j < H; j++) {
    const f = (j + 0.5) / H, br = f < 0.6 ? W * (1 - 0.12 * (f / 0.6)) : W * 0.88 * (1 - (f - 0.6) / 0.4), n = Math.max(1, Math.round(br));
    const x0 = Math.round(x + neigung * j - n / 2), Y = Math.round(y) + j, c = f < 0.25 ? C[0] : f < 0.55 ? C[1] : f < 0.8 ? C[2] : C[3];
    g.put(x0 - 1, Y, PP_FX15_BISS_SCHEIN[2], a * 0.4); g.put(x0 + n, Y, PP_FX15_BISS_SCHEIN[2], a * 0.4);      // gedithertes Leuchten am Rand
    g.block(x0, Y, n, 1, c, a);
    if (n >= 3) g.put(x0 + n - 1, Y, f < 0.55 ? C[2] : C[3], a);                                              // Schatten rechts
  }
}
const ppFx15SnakeBite = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const bk = (t - 250) / 550;
  if (bk >= 0 && bk <= 1) {
    const [sc, op] = ppKf(bk, [[0, [0.4, 0]], [0.3, [1.4, 1]], [0.7, [1.7, 0.55]], [1, [2, 0]]]), r = (55 * sc) / S;
    ppFx15Glow(g, cx, cy, r, r, PP_FX15_BISS_SCHEIN, op * 0.85, 1);
  }
  const u = t / 650;
  if (u >= 0 && u <= 1) {
    for (const seite of [-1, 1]) {
      const [tx, ty, grad, sc, op] = ppKf(u, [[0, [-22, -28, -22, 0.7, 0]], [0.35, [0, 0, 8, 1.05, 1]], [0.5, [2, 4, 12, 1, 1]], [0.62, [0, 0, 8, 1, 1]], [1, [-26, -38, -25, 0.6, 0]]], ppFx15Eio);
      ppFx15Zahn(g, cx + (seite * (25 - tx)) / S, cy + (-78 + ty) / S, sc, seite * Math.tan((grad * Math.PI) / 180), op);
    }
  }
  for (const d of T.tropfen) {
    const k = (t - d.delay) / d.dur;
    if (k <= 0 || k >= 1) continue;
    const [fall, sc, op] = ppKf(k, [[0, [-4, 0.6, 0]], [0.2, [2, 1, 1]], [1, [d.fall, 0.8, 0]]], ppFx15Ei);
    const X = cx + d.dx / S, Y = cy + fall / S, w = Math.max(1, Math.round((d.size * sc) / S)), h = Math.max(2, Math.round((d.size * 1.4 * sc) / S));
    g.block(X - w / 2, Y - h / 2, w, Math.max(1, h - 1), PP_FX15_TROPFEN[1], op);
    g.block(X - w / 2, Y - h / 2, w, 1, PP_FX15_TROPFEN[0], op);
    g.block(X - w / 2, Y + h / 2 - 1, w, 1, PP_FX15_TROPFEN[2], op);
  }
  for (const s of T.spritzer) {
    const k = (t - s.delay) / s.dur;
    if (k <= 0 || k >= 1) continue;
    const e = 1 - (1 - k) * (1 - k), r = (s.size * (1.2 - 1.2 * k)) / S, op = k < 0.2 ? 1 : 1 - (k - 0.2) / 0.8;
    if (r >= 0.4) ppFx15Punkt(g, cx + (s.dx * e) / S, cy + (s.dy * e) / S, Math.max(1, r * 2), s.farbe, op, s.farbe);
  }
}, 1000, { breite: 300, hoehe: 300 }, {
  z: 10100,
  vorbereiten: () => ({
    tropfen: Array.from({ length: ppFxN(8) }, () => ({ dx: ppFx15R(-22, 22), fall: ppFx15R(22, 48), size: ppFx15R(4, 8), delay: ppFx15R(340, 450), dur: ppFx15R(350, 520) })),
    spritzer: Array.from({ length: ppFxN(14) }, () => {
      const w = Math.random() * Math.PI * 2, v = ppFx15R(14, 40);
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v - 4, size: ppFx15R(3, 8), farbe: ppFx15Wahl(PP_FX15_BISS_FARBEN), delay: ppFx15R(320, 430), dur: ppFx15R(320, 540) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Soul Shard Dark Grant (`soul_shard_dark_grant`) — dunkelviolette Schein-Wellen (130 px ab 250 ms, 80 px ab 180 ms, je 600 ms), 14 Dunkel-Funken steigen aus der Karte (bis ~100 px, 500–700 ms)
//  und sieben violette Pixel-Sterne (statt ✦ ✧ ✶ ◆ ★) schweben im Kreis nach aussen (450–650 ms).  Kuerzer als alt (bis 1,5 s, bei 1000 ms abgeschnitten).
// ═════════════════════════════════════════════════════════════════
const PP_FX15_DUNKEL_SCHEIN1 = ppFx15P(['#19062d', '#2b0b47', '#47117e', '#58238c']), PP_FX15_DUNKEL_SCHEIN2 = ppFx15P(['#2b0b47', '#47117e', '#9544d5']);
const ppFx15SoulShard = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const flash = (verzug, px, stufen, p) => {
    const k = (t - verzug) / 600;
    if (k < 0 || k > 1) return;
    const [sc, op] = ppKf(k, [[0, [0.3, 1]], [0.5, [1.5, 0.7]], [1, [2, 0]]]), r = (px / 2 * sc) / S;
    ppFx15Glow(g, cx, cy, r, r, stufen, op * 0.9, p);
  };
  flash(250, 130, PP_FX15_DUNKEL_SCHEIN1, 1);
  flash(180, 80, PP_FX15_DUNKEL_SCHEIN2, 1);
  for (const m of T.funken) {
    const u = (t - m.delay) / m.dur;
    if (u <= 0 || u >= 1) continue;
    const [ty, sc, op] = ppKf(u, [[0, [0, 0.3, 0]], [0.2, [-10, 1, 1]], [1, [-100, 0.2, 0]]]), d = (m.size * sc) / S;
    ppFx15Punkt(g, cx + (m.xOff + m.size / 2) / S, cy + (m.startY + m.size / 2 + ty) / S, Math.max(1, d), ppHex('#b866ff'), op * m.op, ppHex('#6e00cc'));
  }
  for (const r of T.sterne) {
    const u = (t - r.delay) / r.dur;
    if (u <= 0 || u >= 1) continue;
    const [f, op] = ppKf(u, [[0, [0, 0]], [0.15, [0.15, 0.95]], [0.5, [0.5, 0.95]], [1, [1, 0]]]);
    ppFx15Rand(g, PP_FX15_STERN[r.art], PP_FX15_STERN_FARBE, PP_FX15_STERN_HALO[r.art], cx + (r.endX * f) / S, cy + (r.endY * f) / S, op);
  }
}, 1000, { breite: 300, hoehe: 300 }, {
  z: 10100,
  vorbereiten: () => ({
    funken: Array.from({ length: ppFxN(14) }, () => ({ xOff: ppFx15R(-22, 22), startY: ppFx15R(30, 40), size: ppFx15R(5, 11), delay: ppFx15R(0, 250), dur: ppFx15R(500, 700), op: ppFx15R(0.55, 0.9) })),
    sterne: Array.from({ length: ppFxN(7) }, () => {
      const w = Math.random() * Math.PI * 2, d = ppFx15R(32, 50);
      return { endX: Math.cos(w) * d, endY: Math.sin(w) * d - 10, delay: ppFx15R(80, 280), dur: ppFx15R(450, 650), art: ppFx15Wahl(['voll', 'hohl', 'kreuz', 'voll', 'fuenf']) };
    }),
  }),
});

// ── Registrierung ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
ppFxUeberschreiben('plague_smoke', ppFx15PlagueSmoke);
ppFxUeberschreiben('poison_pollen_rain', ppFx15Pollen);
ppFxUeberschreiben('poison_skulls', ppFx15Skulls);
ppFxUeberschreiben('puppet_swap_shishi', ppR1FlameStrike);   // Shishi tauscht: Flame Strike (Canvas, `ppR1FlammenSchlag`); die Aufrufprops (x, y, w, h) sind dieselben, `skala` entfaellt (= 1)
ppFxUeberschreiben('red_lightning', ppFx15RedLightning);
ppFxUeberschreiben('shadow_summon', ppFx15ShadowSummon);
ppFxUeberschreiben('shield_block', ppFx15ShieldBlock);
ppFxUeberschreiben('slimy_heal_goo', ppFx15SlimyHeal);
ppFxUeberschreiben('smoke_vial', ppFx15SmokeVial);
ppFxUeberschreiben('snake_bite', ppFx15SnakeBite);
ppFxUeberschreiben('soul_shard_dark_grant', ppFx15SoulShard);
