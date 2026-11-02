// Pixelart-Portierungen (Canvas), Batch 19 (dritte Welle, alle übrigen Effekte): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
//   dark_gear_spin_cw · dark_swarm · death_skulls · debt_flames · debt_incurred · diamond_sparkle · doom_counter · evolution_counter
// NICHT portiert (Gründe im Bericht): deadly_poison_heal, dragonegg_shimmer, disarm_snap, doomed_pirate_curse, duel_clash, elder_teaching, exorcism_light (laufen schon auf Canvas: `ppPunktBild` / `ppSalve` /
// `ppProjektil`), deck_shuffle_fx (echtes Kartenrücken-Bild ist Teil der Animation), escape_dodge (malt nichts, bewegt nur die Heldenkarte per CSS-Klasse).
// Gemeinsame Bausteine tragen das Präfix `ppFx19` / `PP_FX19_` (die Dateien teilen sich den globalen Namensraum). Genutzt (nur gelesen, zur Laufzeit): `ppFx11Kf/Aus/Glatt/Glow/Raffer/Teilchen/RadDrin`,
// `PP_FX11_RAD` (app-fx-11), `ppFx1Flamme` (app-fx-1). Je Effekt EINE Leinwand (`ppR1Leinwand`): ein Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s, Palettenfarben, Bayer-Dithering statt Alpha, kein Weichzeichner.
// Zonen-Animationen laufen beim Aufrufer 1000 ms (`onZoneAnim`, ohne `duration`): wo die DOM-Fassungen länger liefen (und hart abgeschnitten wurden), ist der Ablauf auf die Aufruferdauer gerafft.

// ── Bausteine ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Kugel/Funke mit Durchmesser `d` Rasterpixeln: winzig = 1 bzw. 2×2 Pixel, größer = dunkler Rand + hellerer Kern (+ gedithertes Schein-Ring, wenn `schein`). */
function ppFx19Kugel(g, x, y, d, kern, rand, schein, a) {
  if (d < 0.7 || a <= 0.03) return;
  if (d < 1.6) { g.put(x, y, kern, a); return; }
  if (d < 2.6) { g.block(Math.round(x) - 1, Math.round(y) - 1, 2, 2, kern, a); return; }
  if (schein && d >= 3) g.disc(x, y, d / 2 + 1.2, schein, a * 0.3);
  g.disc(x, y, d / 2, rand, a);
  g.disc(x - d * 0.06, y - d * 0.06, Math.max(1, d / 2 - 1), kern, a);
}
/** Sprite mit dunklem 1-Pixel-Umriss (erst Nachbarn in `umriss`, dann die Füllung); Mitte (cx, cy), Deckung `a` (gedithert). */
function ppFx19Umriss(g, zeilen, pal, cx, cy, a, umriss) {
  const h = zeilen.length, w = zeilen[0].length, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!pal[zeilen[j][i]]) continue;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (di || dj) {
      const jj = j + dj, ii = i + di;
      if (jj < 0 || ii < 0 || jj >= h || ii >= w || !pal[zeilen[jj][ii]]) g.put(x0 + ii, y0 + jj, umriss, a);
    }
  }
  g.spr(zeilen, pal, cx, cy, a);
}
/** Der Standard-Blitz hinter den Funkel-Effekten: Glow-Scheibe, Halbmesser `r0` Bildschirmpixel × Größe; Größe/Deckung laufen über `dauer` ms mit ease-out (Größe `gr` [[q, Wert]…], Deckung `de`). */
function ppFx19Blitz(g, t, cx, cy, S, dauer, gr, de, r0, stufen, a) {
  const u = t / dauer;
  if (u < 0 || u > 1) return;
  const r = r0 * ppFx11Kf(u, gr, ppFx11Aus) / S, o = ppFx11Kf(u, de, ppFx11Aus);
  if (r < 1 || o < 0.04) return;
  ppFx11Glow(g, cx, cy, r, r, stufen, o * a, 1);
}
const ppFx19Wahl = (liste) => liste[Math.floor(Math.random() * liste.length)];

// ═════════════════════════════════════════════════════════════════
//  Dark Gear (`dark_gear_spin_cw`; Zahnrad dreht im Uhrzeigersinn, Gegenstück zu `dark_gear_spin_ccw`, app-fx-11) — PIXELART. Wie vorher: dunkelvioletter Schein (100×120 px) und ein 72-px-Zahnrad (acht Zähne),
//  das .3 → 1 hereinwächst, 280° im Uhrzeigersinn dreht und wieder schrumpft. Zahnrad = Geometrie je Rasterpixel (kein gedrehtes Bild). Ablauf auf die Aufruferdauer (1000 ms) gerafft.
// ═════════════════════════════════════════════════════════════════
const ppFx19GearCW = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX11_RAD, u = t / d.T;
  if (u > 1) return;
  const fs = ppFx11Kf(u, [[0, 0.3], [0.15, 1.2], [0.85, 1], [1, 1.5]], ppFx11Aus), fo = ppFx11Kf(u, [[0, 0], [0.15, 0.8], [0.85, 0.5], [1, 0]], ppFx11Aus);
  if (fo > 0.03) ppFx11Glow(g, sz.cx, sz.cy + 10 / S, 50 * fs * 0.78 / S, 60 * fs * 0.78 / S, [C.dunkel, C.mittel], fo * 0.9, 0.9);
  // Zahnrad (linear): Drehung 0 → 40° → 320° → 360° (Uhrzeigersinn), Größe .3 → 1 → 1 → .3, Deckung 0 → 1 → 1 → 0
  const rot = ppFx11Kf(u, [[0, 0], [0.15, 40], [0.85, 320], [1, 360]]) * Math.PI / 180;
  const sk = ppFx11Kf(u, [[0, 0.3], [0.15, 1], [0.85, 1], [1, 0.3]]), a = ppFx11Kf(u, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]);
  if (a < 0.03) return;
  const R = Math.ceil(12.2 * sk) + 2, B = 2 * R + 1, cx = Math.round(sz.cx), cy = Math.round(sz.cy - 1.5);
  const m = d.maske; m.fill(0);
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) m[(j + R) * B + i + R] = ppFx11RadDrin(i, j, rot, sk) ? 1 : 0;
  const innen = (i, j) => i >= -R && j >= -R && i <= R && j <= R && m[(j + R) * B + i + R] === 1;
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    if (!innen(i, j)) {
      if (innen(i - 1, j) || innen(i + 1, j) || innen(i, j - 1) || innen(i, j + 1)) g.put(cx + i, cy + j, C.schein, a * 0.55);     // dunkler Rand-Schein statt Schatten
      continue;
    }
    const r = Math.sqrt(i * i + j * j), kante = !(innen(i - 1, j) && innen(i + 1, j) && innen(i, j - 1) && innen(i, j + 1)), l = (i + j) / (12.2 * sk);
    let c;
    if (kante) c = C.rand;
    else if (r < 3.4 * sk) c = (r < 1.4 * sk) ? C.nabeMitte : C.nabe;
    else if (r < 4.6 * sk) c = C.rand;
    else c = l > 0.5 ? C.schatten : l < -0.45 ? C.licht : C.koerper;
    g.put(cx + i, cy + j, c, a);
  }
}, 1440, { breite: 150, hoehe: 170, ankerY: 85 }, {
  z: 10100,
  vorbereiten: (sz) => ({ T: Math.round(1400 * ppFx11Raffer(sz.props, 1400)), maske: new Uint8Array(33 * 33) }),
});

// ═════════════════════════════════════════════════════════════════
//  Dark Swarm (`dark_swarm`; Afflicted Pests, Anti Magic Zone, Silence-Status) — PIXELART. Wie vorher: 22 dunkelviolette Kugeln (4–10 px, Kern hell / Rand dunkel, violetter Schein) fliegen aus der
//  Mitte 5–30 px weit, wachsen .3 → 1,2, schwingen zurück (0,6 × / 1,3 × Höhe) und sinken am Ende 10 px; je 300–600 ms nach 0–200 ms Verzug (ease-in-out je Abschnitt). Ebene 9999 wie vorher.
// ═════════════════════════════════════════════════════════════════
const PP_FX19_SCHWARM = { kern: ppHex('#9544d5'), rand: ppHex('#2b0b47'), schein: ppHex('#58238c') };
const ppFx19Schwarm = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX19_SCHWARM, e = ppFx11Glatt;
  d.teile.forEach((p) => {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) return;
    const px = ppFx11Kf(u, [[0, 0], [0.2, 0.3 * p.tx], [0.5, p.tx], [0.8, 0.6 * p.tx], [1, p.tx]], e);
    const py = ppFx11Kf(u, [[0, 0], [0.2, 0.3 * p.ty], [0.5, p.ty], [0.8, 1.3 * p.ty], [1, p.ty + 10]], e);
    const sc = ppFx11Kf(u, [[0, 0.3], [0.2, 1.2], [0.5, 1], [0.8, 0.8], [1, 0.2]], e);
    const op = ppFx11Kf(u, [[0, 0], [0.2, 0.95], [0.5, 1], [0.8, 0.8], [1, 0]], e);
    ppFx19Kugel(g, sz.cx + px / S, sz.cy + py / S, p.size * sc / S, C.kern, C.rand, C.schein, op);
  });
}, 1000, { breite: 150, hoehe: 150 }, {
  z: 9999,
  vorbereiten: () => ({
    teile: Array.from({ length: ppFxN(22) }, () => {
      const w = Math.random() * Math.PI * 2, dist = 5 + Math.random() * 25;
      return { tx: Math.cos(w) * dist, ty: Math.sin(w) * dist, size: 4 + Math.random() * 6, delay: Math.random() * 200, dur: 300 + Math.random() * 300 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Death Skulls (`death_skulls`; Hel the Bound Specter, Shield of Death) — PIXELART. Wie vorher: 20 Teilchen streuen aus ±35 px um die Mitte: 5 Totenköpfe (16–22 px, Pixel-Sprite statt Emoji, in drei
//  Größenstufen) und 15 dunkelviolette Kugeln (5–13 px); jedes fliegt per ease-out 12–47 px in zufällige Richtung (−15 px nach oben), wächst .5 → 1,2 (30 %) und schrumpft auf 0, Deckung 0 → 1 → 0.
//  Die DOM-Fassung lief bis 1,3 s und wurde bei 1,0 s abgeschnitten: Verzug und Dauer sind auf 75 % gerafft. Ebene 9999 wie vorher.
// ═════════════════════════════════════════════════════════════════
const PP_FX19_SCHAEDEL = { W: ppHex('#ebdcc1'), K: ppHex('#12101f') };
const PP_FX19_SCHAEDEL_G = ['.WWWWW.', 'WWWWWWW', 'WKKWKKW', 'WWWKWWW', '.WWWWW.', '..WKW..'];
const PP_FX19_SCHAEDEL_K = ['.WWW.', 'WKWKW', 'WWWWW', '.WKW.'];
const PP_FX19_TOD = { kern: ppHex('#9544d5'), rand: ppHex('#50008c'), schein: ppHex('#9544d5') };
const ppFx19DeathSkulls = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S;
  d.teile.forEach((p) => {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) return;
    const f = ppFx11Kf(u, [[0, 0], [0.3, 0.3], [1, 1]], ppFx11Aus);                       // Weg: 0 → 30 % bei 30 % → 100 % (ease-out je Abschnitt)
    const sc = ppFx11Kf(u, [[0, 0.5], [0.3, 1.2], [1, 0]], ppFx11Aus), op = ppFx11Kf(u, [[0, 0], [0.3, 1], [1, 0]], ppFx11Aus);
    const x = sz.cx + (p.x + p.size / 2 + p.tx * f) / S, y = sz.cy + (p.y + p.size / 2 + p.ty * f) / S, px = p.size * sc / S;
    if (p.schaedel) {
      if (op < 0.04) return;
      if (px >= 5.2) g.spr(PP_FX19_SCHAEDEL_G, PP_FX19_SCHAEDEL, x, y, op);
      else if (px >= 3.2) g.spr(PP_FX19_SCHAEDEL_K, PP_FX19_SCHAEDEL, x, y, op);
      else if (px >= 1.2) g.block(Math.round(x) - 1, Math.round(y) - 1, 2, 2, PP_FX19_SCHAEDEL.W, op);
    } else ppFx19Kugel(g, x, y, px, PP_FX19_TOD.kern, PP_FX19_TOD.rand, PP_FX19_TOD.schein, op);
  });
}, 1000, { breite: 210, hoehe: 210 }, {
  z: 9999,
  vorbereiten: () => ({
    teile: Array.from({ length: ppFxN(20) }, (_, i) => {
      const w = Math.random() * Math.PI * 2, dist = 12 + Math.random() * 35;
      return {
        x: -35 + Math.random() * 70, y: -35 + Math.random() * 70, size: i < 5 ? 16 + Math.random() * 6 : 5 + Math.random() * 8, schaedel: i < 5,
        delay: Math.random() * 300 * 0.75, dur: (500 + Math.random() * 500) * 0.75, tx: Math.cos(w) * dist, ty: Math.sin(w) * dist - 15,
      };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Debt-O-Tron Model Missing Parts (`debt_flames`; Flammen, Anzahl und Größe wachsen mit dem Schaden) — PIXELART. Wie vorher: ein Hitzeblitz (.anim-gold-flash, 500 ms, Orange; der Inline-Skalierwert der
//  DOM-Fassung wurde vom Keyframe überschrieben — also kein Mehrwachstum mit der Stufe) und 5–16 Flammen (16–40 px × 0,62–1,24): sie steigen 42–114 px auf, driften ±14 px, wachsen .55 → 1,12 → 1 → .5 und
//  blenden aus. Flammen = Pixelform `ppFx1Flamme` (rot → gelb-weiß, Dither). Die DOM-Fassung lief bis 1,08 s (hart abgeschnitten bei 1,0 s): Verzug 0–190, Dauer 460–760 ms.
// ═════════════════════════════════════════════════════════════════
const PP_FX19_HITZE = ['#ee6428', '#f29a3e', '#fad54a'].map(ppHex);
const ppFx19DebtFlames = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S;
  ppFx19Blitz(g, t, sz.cx, sz.cy, S, 500, [[0, 0.3], [0.5, 1.3], [1, 1.6]], [[0, 1], [0.5, 0.6], [1, 0]], 20.4, PP_FX19_HITZE, 0.8);
  d.flammen.forEach((f) => {
    const u = (t - f.delay) / f.dur;
    if (u < 0 || u > 1) return;
    const tx = ppFx11Kf(u, [[0, 0], [0.18, f.drift * 0.25], [0.6, f.drift * 0.7], [1, f.drift]], ppFx11Aus);
    const ty = ppFx11Kf(u, [[0, 6], [0.18, -4], [0.6, -f.hoehe * 0.62], [1, -f.hoehe]], ppFx11Aus);
    const sc = ppFx11Kf(u, [[0, 0.55], [0.18, 1.12], [0.6, 1], [1, 0.5]], ppFx11Aus), op = ppFx11Kf(u, [[0, 0], [0.18, 1], [0.6, 0.9], [1, 0]], ppFx11Aus);
    if (op < 0.04) return;
    const B = f.size * 0.78 * sc / S, H = f.size * 1.12 * sc / S, cx = sz.cx + (f.xOff + tx) / S, cy = sz.cy + ty / S;
    ppFx1Flamme(g, cx, cy + H / 2, B, H, op, f.seed + t / 220);
  });
}, 1000, { breite: 200, hoehe: 210, ankerY: 170 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const schaden = Math.max(1, Number(sz.props.damage) || 10);
    const stufe = Math.min(1, Math.log10(schaden / 10 + 1) / Math.log10(31));
    const anzahl = Math.round(5 + stufe * 11), basis = 16 + stufe * 24;
    return {
      flammen: Array.from({ length: anzahl }, () => ({
        xOff: (-18 - stufe * 26) + Math.random() * (36 + stufe * 52), size: basis * (0.62 + Math.random() * 0.62), delay: Math.random() * 190,
        dur: 460 + Math.random() * 300, drift: -14 + Math.random() * 28, hoehe: 42 + stufe * 46 + Math.random() * 26, seed: Math.random() * 6,
      })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Kent, the Indebted Apprentice (`debt_incurred`; rote Münzen steigen auf) — PIXELART. Wie vorher: roter Blitz (500 ms) und 3–12 rote Münzen (13–21 px; 5×5- bzw. 7×7-Scheibe, Kippen als Breitenfolge
//  5-3-1-3 statt Drehung): steigen 66 px auf (ease-out), driften ±20 px, wachsen .8 → 1,05, blenden bei 15 % ein und aus. Die DOM-Fassung lief bis 1,16 s (abgeschnitten bei 1,0 s): Verzug 0–200 ms, Dauer 560–780 ms.
// ═════════════════════════════════════════════════════════════════
const PP_FX19_ROTMUENZE = ['#e94e53', '#b21a29', '#b21a29', '#710122', '#f0bfbc'].map(ppHex);   // Fläche, Schatten, Schatten, Rand, Glanz
function ppFx19RotMuenze(g, cx, cy, breite, gross, a) {
  cx = Math.round(cx); cy = Math.round(cy);
  const R = gross ? 3 : 2, hb = Math.max(0, Math.floor(breite / 2));
  for (let j = -R; j <= R; j++) {
    const b = Math.abs(j) === R ? Math.max(0, hb - 1) : hb;
    for (let i = -b; i <= b; i++) {
      const rand = Math.abs(i) === b || Math.abs(j) === R, k = rand ? 3 : (i === -b + 1 && j === -R + 1 && b >= 2) ? 4 : (i > 0 && b >= 2) ? 1 : 0;
      g.put(cx + i, cy + j, PP_FX19_ROTMUENZE[k], a);
    }
  }
}
const ppFx19DebtIncurred = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S;
  ppFx19Blitz(g, t, sz.cx, sz.cy, S, 500, [[0, 0.3], [0.5, 1.3], [1, 1.6]], [[0, 1], [0.5, 0.6], [1, 0]], 20.4, [ppHex('#b21a29'), ppHex('#fe5154')], 0.7);
  d.muenzen.forEach((m) => {
    const u = (t - m.delay) / m.dur;
    if (u < 0 || u > 1) return;
    const e = 1 - Math.pow(1 - u, 2.2), sc = 0.8 + 0.25 * u, op = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
    if (op < 0.04) return;
    const w = Math.abs(Math.cos(Math.PI * (Math.abs(m.spin) * u / 180))), breite = w > 0.7 ? 5 : w > 0.3 ? 3 : 1;
    ppFx19RotMuenze(g, sz.cx + (m.xOff + m.drift * e) / S, sz.cy - 66 * e / S, m.size * sc >= 17 ? Math.min(7, breite + 2) : breite, m.size * sc >= 17, op);
  });
}, 1000, { breite: 150, hoehe: 160, ankerY: 115 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const anzahl = Math.max(3, Math.min(12, sz.props.count || 5));
    return { muenzen: Array.from({ length: anzahl }, () => ({ xOff: -22 + Math.random() * 44, size: 13 + Math.random() * 8, delay: Math.random() * 200, dur: 560 + Math.random() * 220, spin: -140 + Math.random() * 280, drift: -20 + Math.random() * 40 })) };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Diamond Sparkle (`diamond_sparkle`; Diamond Spider) — PIXELART. Wie vorher: eisweißer/cyanfarbener Blitz (44 px, 550 ms: .3 → 1,4 → 1,7, Deckung 1 → .7 → 0; Glow-Scheibe in drei Stufen) und 14 Funken
//  (3–8 px, Weiß/Eisblau, fliegen 14–40 px per ease-out, schrumpfen auf 0).
// ═════════════════════════════════════════════════════════════════
const PP_FX19_DIAMANT = ['#ffffff', '#bddcef', '#68c6fd', '#e5f5fa', '#b4dff8', '#d9c0ec'].map(ppHex);
const ppFx19Diamond = ppR1Leinwand((g, t, sz, d) => {
  ppFx19Blitz(g, t, sz.cx, sz.cy, sz.S, 550, [[0, 0.3], [0.5, 1.4], [1, 1.7]], [[0, 1], [0.5, 0.7], [1, 0]], 23.3, [ppHex('#68c6fd'), ppHex('#b4dff8'), ppHex('#ffffff')], 0.9);
  d.funken.forEach((p) => ppFx11Teilchen(g, sz.cx, sz.cy, t, p, sz.S));
}, 1000, { breite: 120, hoehe: 120 }, {
  z: 10100,
  vorbereiten: () => ({
    funken: Array.from({ length: ppFxN(14) }, () => {
      const w = Math.random() * Math.PI * 2, v = 14 + Math.random() * 26;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 3 + Math.random() * 5, color: ppFx19Wahl(PP_FX19_DIAMANT), delay: Math.random() * 150, dur: 400 + Math.random() * 400 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Evolution Counter (`evolution_counter`; Waflav-Familie; Bild von `GoldSparkleEffect`) — PIXELART. Wie vorher: der Goldblitz (.anim-gold-flash, 500 ms: .3 → 1,3 → 1,6, Deckung 1 → .6 → 0) aus harten
//  Ringen (Hellgold bis 22 % / Gold bis 46 % / Orange bis 68 % von 28 px) und 12 Funken (3–8 px; Gold, Hellgelb, Weiß, Orange), die 12–37 px weit fliegen.
// ═════════════════════════════════════════════════════════════════
const PP_FX19_GOLD = ['#fad54a', '#fad54a', '#f7f7ad', '#ffffff', '#f29a3e'].map(ppHex);
const ppFx19Evolution = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, u = t / 500;
  if (u >= 0 && u <= 1) {
    const sc = ppFx11Kf(u, [[0, 0.3], [0.5, 1.3], [1, 1.6]], ppFx11Aus), op = ppFx11Kf(u, [[0, 1], [0.5, 0.6], [1, 0]], ppFx11Aus);
    if (op > 0.04) {
      g.disc(sz.cx, sz.cy, 19.2 * sc / S, ppHex('#f29a3e'), op);
      g.disc(sz.cx, sz.cy, 13 * sc / S, ppHex('#fad54a'), op);
      g.disc(sz.cx, sz.cy, 6.2 * sc / S, ppHex('#f7f7ad'), op);
    }
  }
  d.funken.forEach((p) => ppFx11Teilchen(g, sz.cx, sz.cy, t, p, S));
}, 1000, { breite: 120, hoehe: 120 }, {
  z: 10100,
  vorbereiten: () => ({
    funken: Array.from({ length: ppFxN(12) }, () => {
      const w = Math.random() * Math.PI * 2, v = 12 + Math.random() * 25;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 3 + Math.random() * 5, color: ppFx19Wahl(PP_FX19_GOLD), delay: Math.random() * 150, dur: 400 + Math.random() * 400 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Doom Counter (`doom_counter`; Area-Zone mit der Doom Clock, 1500 ms) — PIXELART. Wie vorher: über der Zone (8 px über der Oberkante) springt ein Totenschädel mit rot glühenden Augen hoch, daneben ein rotes
//  „+1" (dunkler Umriss); der Block springt von 14 px tiefer hoch (.5 → 1,18 → 1), steigt dann 16 → 30 px und verblasst ab 70 %. Skalierung nur in zwei Sprite-Größen (klein unter 75 %), Deckung per Dither.
//  Licht von oben rechts wie auf der Karte.
// ═════════════════════════════════════════════════════════════════
const PP_FX19_DOOM_PAL = { H: ppHex('#fff8e8'), L: ppHex('#e2d8cb'), S: ppHex('#c5b7a0'), R: ppHex('#ff1a1a') };
const PP_FX19_DOOM_GROSS = ['..LLLLLLLLL..', '.LLLLLLLLLLH.', 'LLLLLLLLLLLLH', 'LLLLLLLLLLLLH', 'LLRRRLLLRRRLH', 'LLRRRLLLRRRLH', 'SLLLLLLLLLLLH', '.SLLLLLLLLLH.', '..SLLLLLLLH..', '...LSLSLSL...', '...SLSLSLS...'];
const PP_FX19_DOOM_KLEIN = ['.LLLLLLL.', 'LLLLLLLHL', 'LLRRLRRLH', 'LLRRLRRLH', 'LLLLLLLLH', '.LLLLLLH.', '..LLLLL..', '..L.L.L..'];
const PP_FX19_DOOM_PLUS = { '#': ppHex('#ef2929') };
const PP_FX19_DOOM_PLUS_G = ['..#..', '..#..', '#####', '..#..', '..#..'];
const PP_FX19_DOOM_EINS_G = ['.##.', '###.', '.##.', '.##.', '.##.', '.##.', '####'];
const PP_FX19_DOOM_PLUS_K = ['.#.', '###', '.#.'];
const PP_FX19_DOOM_EINS_K = ['.#.', '##.', '.#.', '.#.', '###'];
const ppFx19Doom = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, u = t / 1500;
  if (u < 0 || u > 1) return;
  const p = sz.props, oben = sz.cy - ((p.h || 60) / 2 + 8) / S;                      // Unterkante des Blocks (Rasterpixel)
  const ty = ppFx11Kf(u, [[0, 14], [0.14, -2], [0.24, 0], [0.7, -16], [1, -30]], ppFx11Aus);
  const sc = ppFx11Kf(u, [[0, 0.5], [0.14, 1.18], [0.24, 1], [0.7, 1], [1, 0.95]], ppFx11Aus);
  const op = ppFx11Kf(u, [[0, 0], [0.14, 1], [0.7, 1], [1, 0]], ppFx11Aus);
  if (op < 0.04) return;
  const my = oben - 20 / S + ty / S, klein = sc < 0.75;
  const sx = sz.cx - 19 / S, tx = sz.cx + 25 / S;
  ppFx11Glow(g, sx, my, 20 / S, 18 / S, [ppHex('#710122')], op * 0.35, 1);
  ppFx19Umriss(g, klein ? PP_FX19_DOOM_KLEIN : PP_FX19_DOOM_GROSS, PP_FX19_DOOM_PAL, sx, my, op, ppHex('#2a0404'));
  ppFx19Umriss(g, klein ? PP_FX19_DOOM_PLUS_K : PP_FX19_DOOM_PLUS_G, PP_FX19_DOOM_PLUS, tx - (klein ? 3 : 4), my, op, ppHex('#2a0404'));
  ppFx19Umriss(g, klein ? PP_FX19_DOOM_EINS_K : PP_FX19_DOOM_EINS_G, PP_FX19_DOOM_PLUS, tx + (klein ? 2 : 3), my, op, ppHex('#2a0404'));
}, 1500, (p) => ({ breite: 180, hoehe: 150, ankerX: 90, ankerY: 125 + ((p.h || 60) / 2 + 8) }), { z: 10100 });

ppFxUeberschreiben('dark_gear_spin_cw', ppFx19GearCW);
ppFxUeberschreiben('dark_swarm', ppFx19Schwarm);
ppFxUeberschreiben('death_skulls', ppFx19DeathSkulls);
ppFxUeberschreiben('debt_flames', ppFx19DebtFlames);
ppFxUeberschreiben('debt_incurred', ppFx19DebtIncurred);
ppFxUeberschreiben('diamond_sparkle', ppFx19Diamond);
ppFxUeberschreiben('evolution_counter', ppFx19Evolution);
ppFxUeberschreiben('doom_counter', ppFx19Doom);
