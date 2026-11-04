// Pixelart-Portierungen (Canvas), Batch 4: siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
//
//  Vorher: je Effekt dutzende bis hunderte CSS-animierte Elemente (Funken, Flammen, Splitter, Zeichen), die die Pixel-Pipeline beim Start einzeln buk (100–700 ms Hauptfaden-Blockade).
//  Jetzt: EINE Leinwand je Effekt (`ppR1Leinwand`, app-board.jsx), Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s, Dithering statt Alpha, Zeichen/Emojis als kleine Pixel-Sprites.
//
//  Typen: johanna_cleanse, idej_projection_absorb (samt Aliasse weapon_unleashing / weapon_absorption, die den Eintrag zur Laufzeit nachschlagen), golden_apple_burst, golden_explosion,
//  golden_feathers, goldify_transmute, golem_smash_ice, glass_shatter (+ pink_glass_shatter, dieselbe Bauart mit rosa Palette), golden_ankh_revival, hand_of_death_strike,
//  icy_grave_strike, heat_wave.  `glass_wall_up` ist schon eine einzelne Pixel-Leinwand (`ppGlasWand`, app-board.jsx) und bleibt unveraendert.
//  Alle Zeitachsen sind so gelegt, dass der Effekt innerhalb der Standard-Lebensdauer der Zonen-Animation (1000 ms bzw. der vom Server gesendeten `duration`) ausklingt.

// ── gemeinsame Bausteine ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const ppFx4P = (liste) => liste.map(ppHex);
const ppFx4Farben = (o) => { const r = {}; for (const k in o) r[k] = ppHex(o[k]); return r; };
/** Stueckweise lineare Kurve: pts = [[k0, v0], [k1, v1], …] (k aufsteigend), ausserhalb gehalten. */
function ppFx4Kurve(k, pts) {
  if (k <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (k <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * ((k - a) / ((b - a) || 1)); }
  }
  return pts[pts.length - 1][1];
}
const ppFx4Aus2 = (k) => { k = ppR1Klemme(k); return 1 - (1 - k) * (1 - k); };
const ppFx4Aus3 = (k) => { k = ppR1Klemme(k); return 1 - (1 - k) * (1 - k) * (1 - k); };
/** Zeichenfeld aus einer Funktion (x, y) → Zeichen ('.' = leer). */
function ppFx4Raster(w, h, fn) {
  const z = [];
  for (let y = 0; y < h; y++) { let s = ''; for (let x = 0; x < w; x++) s += fn(x, y) || '.'; z.push(s); }
  return z;
}
/** Pixelbild, ganzzahlig vergroessert (jedes Bildpunkt = m×m Rasterpixel). */
function ppFx4Bild(g, zeilen, pal, cx, cy, a, m = 1, spiegeln = false) {
  const h = zeilen.length, w = zeilen[0].length, x0 = Math.round(cx - (w * m) / 2), y0 = Math.round(cy - (h * m) / 2);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = pal[zeilen[j][i]];
    if (!c) continue;
    const ii = spiegeln ? w - 1 - i : i;
    if (m === 1) g.put(x0 + ii, y0 + j, c, a); else g.block(x0 + ii * m, y0 + j * m, m, m, c, a);
  }
}
/** Funke: n×n-Block, bei `halo` ein Kreuz in der Halo-Farbe (gedithert) drumherum statt Leuchten. */
function ppFx4Funke(g, x, y, n, c, halo, a) {
  const X = Math.round(x - n / 2), Y = Math.round(y - n / 2);
  if (halo) {
    g.block(X - 1, Y, 1, n, halo, a * 0.55); g.block(X + n, Y, 1, n, halo, a * 0.55);
    g.block(X, Y - 1, n, 1, halo, a * 0.55); g.block(X, Y + n, n, 1, halo, a * 0.55);
  }
  g.block(X, Y, n, n, c, a);
}
/** Wie `ppR1Leinwand`, aber `ende` darf eine Funktion der Eigenschaften sein (Effekte mit `duration` vom Server). */
function ppFx4Leinwand(malen, ende, mass, opt) {
  if (typeof ende === 'number') return ppR1Leinwand(malen, ende, mass, opt);
  return function Fx4Huelle(props) {
    const C = useMemo(() => ppR1Leinwand(malen, ende(props), mass, opt), []);
    return <C {...props} />;
  };
}
const PP_FX4_GOLD = ppFx4Farben({ dunkel: '#c68206', mitte: '#f9ac20', ora: '#ffb91a', warm: '#ffd066', gold: '#fad54a', hell: '#fbe181', creme: '#f9ecb3', blass: '#fff196', weiss: '#fffbd2', rein: '#ffffff' });

// ═════════════════════════════════════════════════════════════════
//  Johanna Cleanse (`johanna_cleanse`; auch String of Fine, Pharao-Divinity) — goldener Heiligenschein: warmer Schein (waechst .4 → 1,6), zwoelf Strahlen, die nach aussen schiessen,
//  und ein Schwarm heller Funken. (Im alten CSS blieben die Strahlen wegen einer nie gesetzten Variable senkrecht uebereinander stehen — hier sind es die gemeinten Sonnenstrahlen.)
// ═════════════════════════════════════════════════════════════════
const ppFx4Johanna = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, F = PP_FX4_GOLD;
  const hk = t / 1000;
  if (hk <= 1) {
    const sc = ppFx4Kurve(hk, [[0, 0.4], [0.35, 1.15], [0.7, 1.35], [1, 1.6]]), a = ppFx4Kurve(hk, [[0, 0], [0.35, 1], [0.7, 0.85], [1, 0]]);
    const r = (55 * sc) / S;
    g.glow(cx, cy, r, r, [F.warm, F.gold, F.creme], a * 0.7, 1.1);
  }
  teile.strahlen.forEach((b) => {
    const k = (t - b.delay) / 800;
    if (k < 0 || k > 1) return;
    const e = ppFx4Aus2(k), a = ppFx4Kurve(k, [[0, 0], [0.25, 1], [0.6, 1], [1, 0]]);
    const d = 15 + 40 * e, len = 70 * 1.0 * e, w = (b.winkel * Math.PI) / 180, dx = Math.sin(w), dy = -Math.cos(w);
    const v0 = Math.max(4, d - len / 2), v1 = d + len / 2;
    ppR1Band(g, cx + (dx * v0) / S, cy + (dy * v0) / S, cx + (dx * v1) / S, cy + (dy * v1) / S, (u) => (u > 0.45 ? { w: 1, c: F.weiss } : { w: 1, c: F.blass, a: 0.6 }), a);
  });
  teile.funken.forEach((s) => {
    const k = (t - s.delay) / 780;
    if (k < 0 || k > 1) return;
    const e = ppFx4Aus2(k), a = ppFx4Kurve(k, [[0, 0], [0.3, 1], [1, 0]]), sc = ppFx4Kurve(k, [[0, 0.4], [0.3, 1.1], [1, 0.2]]);
    const n = Math.max(1, Math.round((s.size * sc) / S));
    ppFx4Funke(g, cx + (Math.cos(s.winkel) * s.dist * e) / S, cy + (Math.sin(s.winkel) * s.dist * e) / S, n, F.weiss, n >= 2 ? F.gold : null, a);
  });
}, 1000, { breite: 270, hoehe: 270 }, {
  z: 10100,
  vorbereiten: () => ({
    strahlen: Array.from({ length: ppFxN(12) }, (_, i) => ({ winkel: (i / 12) * 360, delay: Math.random() * 80 })),
    funken: Array.from({ length: ppFxN(18) }, (_, i) => ({ winkel: (i / 18) * Math.PI * 2 + Math.random() * 0.4, dist: 40 + Math.random() * 30, size: 3 + Math.random() * 4, delay: Math.random() * 200 })),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Idej Projection (`idej_projection_absorb`, dazu `weapon_unleashing` / `weapon_absorption` mit eigenem Zeichen) — gruene Hologramm-Kuppel: Blitz, drei Ringe, Kuppel mit Rasterlinien
//  (waechst auf 1,18, haelt, loest sich auf) und in der Mitte ein Zeichen (Schild; `glyph` = Explosion bzw. Wirbel fuer die Waffen-Karten) als Pixel-Sprite.
// ═════════════════════════════════════════════════════════════════
const PP_FX4_GRUEN = ppFx4Farben({ dunkel: '#2ca058', mitte: '#4ceb70', ring: '#66ffa2', blitz: '#68fdc1', hell: '#b3f9cf', weiss: '#e5fae7' });
const PP_FX4_GLYPH_PAL = { o: PP_FX4_GRUEN.dunkel, g: PP_FX4_GRUEN.mitte, l: PP_FX4_GRUEN.hell, w: PP_FX4_GRUEN.weiss };
const PP_FX4_SCHILD = ppFx4Raster(13, 15, (x, y) => {
  const dx = Math.abs(x - 6), hw = y < 9 ? 6 : 14 - y;
  if (dx > hw) return '.';
  if (y === 0 || dx === hw) return 'o';
  if (dx === 0 && y < 11) return 'w';
  return x < 6 && y < 8 ? 'l' : 'g';
});
const PP_FX4_STOSS = ppFx4Raster(15, 15, (x, y) => {
  const dx = x - 7, dy = y - 7, r = Math.hypot(dx, dy), w = Math.atan2(dy, dx), R = 3.4 + 3.8 * Math.pow(Math.abs(Math.cos(4 * w)), 4);
  if (r > R) return '.';
  if (r > R - 1.1) return 'o';
  return r < 2.2 ? 'w' : r < 4 ? 'l' : 'g';
});
const PP_FX4_WIRBEL = (() => {
  const pts = [];
  for (let th = 0; th <= 3 * Math.PI; th += 0.06) { const r = 0.5 + th * 0.66; pts.push([7 + r * Math.cos(th), 7 + r * Math.sin(th)]); }
  return ppFx4Raster(15, 15, (x, y) => {
    let d = 9;
    for (const [px, py] of pts) { const q = Math.hypot(x - px, y - py); if (q < d) d = q; }
    return d < 0.7 ? 'l' : d < 1.3 ? 'g' : d < 1.9 ? 'o' : '.';
  });
})();
const ppFx4Idej = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, base = teile.base, C = PP_FX4_GRUEN;
  // Ringe: je 900 ms, Versatz 110 ms, .12 → 1,5, Deckung 0 → .95 (18 %) → 0
  [1.7, 2.3, 2.9].forEach((m, i) => {
    const k = (t - i * 110) / 900;
    if (k < 0 || k > 1) return;
    const sc = 0.12 + 1.38 * ppFx4Aus2(k), a = ppFx4Kurve(k, [[0, 0], [0.18, 0.95], [1, 0]]), r = (base * m / 2 * sc) / S;
    if (r < 1.5) return;
    g.ring(cx, cy, r - 1, r, C.ring, a);
    if (r > 4) g.ring(cx, cy, r - 2.2, r - 1, C.mitte, a * 0.45);
  });
  // Blitz (340 ms)
  const fk = t / 340;
  if (fk <= 1) {
    const sc = ppFx4Kurve(fk, [[0, 0.3], [0.35, 1], [1, 1.35]]), a = ppFx4Kurve(fk, [[0, 0], [0.35, 1], [1, 0]]), r = (base * 1.1 * sc * 0.75) / S;
    g.glow(cx, cy, r, r, [C.mitte, C.blitz, C.weiss], a, 1.1);
  }
  // Kuppel (880 ms): Verlauf in drei Stufen, Rasterlinien, heller Rand
  const dk = t / 880;
  if (dk <= 1) {
    const sc = ppFx4Kurve(dk, [[0, 0.18], [0.22, 1.18], [0.5, 0.98], [1, 1.3]]), a = ppFx4Kurve(dk, [[0, 0], [0.22, 1], [0.5, 1], [1, 0]]);
    const R = (base * 0.95 * sc) / S;
    if (R >= 2) {
      g.glow(cx, cy, R, R, [C.dunkel, C.mitte, C.blitz], a * 0.5, 0.75);
      const Y0 = Math.round(cy - R), Y1 = Math.round(cy + R);
      for (let Y = Y0; Y <= Y1; Y += 2) {
        const hb = Math.sqrt(Math.max(0, R * R - (Y - cy) * (Y - cy)));
        for (let X = Math.round(cx - hb); X <= Math.round(cx + hb); X++) g.put(X, Y, C.hell, a * 0.3);
      }
      g.ring(cx, cy, R - 1, R, C.hell, a);
    }
  }
  // Zeichen (880 ms)
  const gk = t / 880;
  if (gk <= 1) ppFx4Bild(g, teile.glyph, PP_FX4_GLYPH_PAL, cx, cy, ppFx4Kurve(gk, [[0, 0], [0.28, 1], [0.6, 1], [1, 0]]), 1);
}, 1000, (p) => { const base = Math.max(p.w || 72, 60); return { breite: Math.ceil(base * 4.4 + 24), hoehe: Math.ceil(base * 4.4 + 24) }; }, {
  z: 10130,
  vorbereiten: (sz) => {
    const gl = String(sz.props.glyph || ''), cp = gl ? gl.codePointAt(0) : 0;
    return { base: Math.max(sz.props.w || 72, 60), glyph: cp === 0x1F4A5 ? PP_FX4_STOSS : cp === 0x1F300 ? PP_FX4_WIRBEL : PP_FX4_SCHILD };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Golden Apple (`golden_apple_burst`; auch Tree of Golden Apples / Temporary Control) — warmer Schein ueber der Karte, aufsteigende Goldfunken in drei Toenen und trudelnde Blattgold-Flitter
//  (das Kippen = Breite in ganzen Pixeln). Lebensdauer = `duration` des Aufrufs (1500 ms), die Teilchen sind darueber verteilt.
// ═════════════════════════════════════════════════════════════════
const ppFx4Apfel = ppFx4Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, F = PP_FX4_GOLD, lz = teile.lz;
  const gk = t / (lz * 0.8);
  if (gk <= 1) {
    const sc = ppFx4Kurve(gk, [[0, 0.8], [0.3, 1.04], [1, 1.1]]), a = ppFx4Kurve(gk, [[0, 0], [0.3, 1], [1, 0]]);
    g.glow(cx, cy, (52 * sc) / S, (66 * sc) / S, [F.ora, F.warm], a * 0.5, 1);
  }
  teile.funken.forEach((f) => {
    const k = (t - f.delay) / f.dur;
    if (k < 0 || k > 1) return;
    const e = ppFx4Aus2(k), a = ppFx4Kurve(k, [[0, 0], [0.22, 1], [1, 0]]);
    ppFx4Funke(g, cx + (f.dx * e) / S, cy + (16 + f.dy * e) / S, f.size >= 8 ? 2 : 1, f.farbe, f.size >= 6 ? F.ora : null, a);
  });
  teile.flitter.forEach((fl) => {
    const k = (t - fl.delay) / fl.dur;
    if (k < 0 || k > 1) return;
    const e = k * k, a = ppFx4Kurve(k, [[0, 0], [0.2, 1], [1, 0]]);
    const w = Math.max(1, Math.round(Math.max(1, Math.round(fl.w / S) + 1) * Math.abs(Math.cos((fl.dreh * k * Math.PI) / 180)))), h = Math.max(3, Math.round(fl.h / S));
    const x0 = Math.round(cx + (fl.x + fl.w / 2) / S - w / 2), y0 = Math.round(cy + (-34 + fl.h / 2 + fl.dy * e) / S - h / 2);
    g.block(x0, y0, w, h, F.mitte, a);
    g.block(x0, y0, 1, h, F.creme, a);
    if (w >= 2) g.block(x0 + w - 1, y0 + 1, 1, h - 1, F.dunkel, a);
  });
}, (p) => Math.max(700, Number(p.duration) || 1500), { breite: 180, hoehe: 210, ankerX: 90, ankerY: 130 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const lz = Math.max(700, Number(sz.props.duration) || 1500), cols = ['#fbe181', '#ffb91a', '#fffbd2'].map(ppHex), n1 = ppFxN(34), n2 = ppFxN(12);
    return {
      lz,
      funken: Array.from({ length: n1 }, (_, i) => ({ dx: -46 + Math.random() * 92, dy: -(14 + Math.random() * 86), size: 4 + Math.random() * 6, delay: (i / n1) * (lz - 500) + Math.random() * 140, dur: 520 + Math.random() * 380, farbe: cols[i % 3] })),
      flitter: Array.from({ length: n2 }, (_, i) => ({ x: -40 + Math.random() * 80, dy: 40 + Math.random() * 46, w: 5 + Math.random() * 6, h: 8 + Math.random() * 9, delay: (i / n2) * (lz - 620) + Math.random() * 160, dur: 880 + Math.random() * 420, dreh: -220 + Math.random() * 440 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Golden Exploding Skull (`golden_explosion`) — weissgoldener Blitz, Goldkugel, Druckwelle (Ellipse), Goldfunken und fliegende Muenzen (die Muenz-Sprites des Spielgestalters). Auf 1000 ms gestaucht.
// ═════════════════════════════════════════════════════════════════
const ppFx4GoldExplosion = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, F = PP_FX4_GOLD, ww = teile.ww;
  const bk = t / 420;
  if (bk <= 1) {
    const sc = ppFx4Kurve(bk, [[0, 0.2], [0.2, 1], [1, 1.4]]), a = ppFx4Kurve(bk, [[0, 0], [0.2, 1], [1, 0]]), r = (ww * 0.55 * sc * 0.85) / S;
    g.glow(cx, cy, r, r, [F.ora, F.creme, F.rein], a, 1.1);
  }
  const ck = t / 720;
  if (ck <= 1) {
    const sc = ppFx4Kurve(ck, [[0, 0.15], [0.22, 1.05], [0.6, 0.92], [1, 0.35]]), a = ppFx4Kurve(ck, [[0, 0], [0.22, 1], [0.6, 0.9], [1, 0]]), r = (ww * 0.38 * sc) / S;
    g.glow(cx, cy, r * 1.7, r * 1.7, [F.mitte], a * 0.3, 1);
    g.glow(cx, cy, r, r, [F.dunkel, F.mitte, F.gold, F.weiss], a, 0.8);
  }
  const rk = (t - 80) / 620;
  if (rk >= 0 && rk <= 1) {
    const sc = ppFx4Kurve(rk, [[0, 0.25], [0.35, 1.1], [1, 2.2]]), a = ppFx4Kurve(rk, [[0, 0], [0.35, 1], [1, 0]]);
    g.ellRing(cx, cy, (ww * 0.5 * sc) / S, (ww * 0.28 * sc) / S, 1.4, F.hell, a);
  }
  teile.funken.forEach((f) => {
    const k = (t - f.delay) / f.dur;
    if (k < 0 || k > 1) return;
    const e = ppFx4Kurve(k, [[0, 0], [0.18, 0.35], [1, 1]]), a = ppFx4Kurve(k, [[0, 0], [0.18, 1], [1, 0]]), sc = ppFx4Kurve(k, [[0, 0.5], [0.18, 1], [1, 0.3]]);
    const n = Math.max(1, Math.round((f.groesse * sc) / S));
    ppFx4Funke(g, cx + (f.dx * e) / S, cy + (f.dy * e) / S, n, f.farbe, n >= 2 ? F.mitte : null, a);
  });
  teile.muenzen.forEach((m) => {
    const k = (t - m.delay) / m.dur;
    if (k < 0 || k > 1) return;
    const x = ppFx4Kurve(k, [[0, 0], [0.2, 0.45], [1, 1]]) * m.dx, y = ppFx4Kurve(k, [[0, 0], [0.2, 1], [1, -0.35]]) * m.hoch;
    const a = ppFx4Kurve(k, [[0, 0], [0.2, 1], [1, 0]]), gross = m.groesse >= 20, breite = (gross ? [7, 5, 1, 5] : [5, 3, 1, 3])[Math.floor(k * 10 + m.phase) % 4];
    ppR1Muenze(g, cx + x / S, cy + y / S, breite, gross, a, 0);
  });
}, 1000, (p) => { const R = Math.max(p.w || 80, 80) * 1.5 + 24; return { breite: R * 2, hoehe: R * 2 }; }, {
  z: 10145,
  vorbereiten: (sz) => {
    const ww = Math.max(sz.props.w || 80, 80), cols = ['#fffbd2', '#fad54a', '#f9ac20', '#ffffff', '#f9ac20'].map(ppHex);
    return {
      ww,
      funken: Array.from({ length: ppFxN(24) }, () => { const w = Math.random() * Math.PI * 2, d = ww * (0.5 + Math.random() * 0.8); return { dx: Math.cos(w) * d, dy: Math.sin(w) * d * 0.8, groesse: 3 + Math.random() * 7, farbe: cols[Math.floor(Math.random() * 5)], delay: Math.random() * 180, dur: 420 + Math.random() * 380 }; }),
      muenzen: Array.from({ length: ppFxN(7) }, () => ({ dx: (Math.random() - 0.5) * ww * 1.3, hoch: -(ww * (0.45 + Math.random() * 0.5)), groesse: 12 + Math.random() * 12, delay: 100 + Math.random() * 200, dur: 560 + Math.random() * 140, phase: Math.floor(Math.random() * 4) })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Harpthenean War Counselor (`golden_feathers`) — warmer Fluegelschlag-Blitz, dann 18 goldene Federn, die im Bogen vom Ziel wegtrudeln (Federn = Pixelketten in 45°-Schritten, drei Goldtoene).
// ═════════════════════════════════════════════════════════════════
const ppFx4Federn = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, F = PP_FX4_GOLD, cw = teile.cw;
  const fk = t / 460;
  if (fk <= 1) {
    const sc = ppFx4Kurve(fk, [[0, 0.35], [0.35, 1], [1, 1.25]]), a = ppFx4Kurve(fk, [[0, 0], [0.35, 1], [1, 0]]), r = (cw * 0.9 * sc * 0.85) / S;
    g.glow(cx, cy, r, r, [F.dunkel, F.warm, F.creme], a * 0.9, 1);
  }
  teile.federn.forEach((f) => {
    const k = (t - f.delay) / f.dur;
    if (k < 0 || k > 1) return;
    const e = ppFx4Aus3(k), a = ppFx4Kurve(k, [[0, 0], [0.18, 1], [0.7, 0.9], [1, 0]]), sc = 0.5 + 0.5 * k;
    const x = cx + (f.dx * e) / S, y = cy + (f.dy * e) / S, w = (Math.round((f.spin * k) / 45) * 45 * Math.PI) / 180;
    const L = Math.max(6, (f.size * 2 * sc) / S) / 2, dx = Math.cos(w) * L, dy = Math.sin(w) * L, bw = Math.max(1.6, (f.size * 0.6 * sc) / S);
    ppR1Band(g, x - dx, y - dy, x + dx, y + dy, (u) => ({ w: Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)) * bw * 1.3, c: u < 0.34 ? F.weiss : u < 0.7 ? F.warm : F.dunkel }), a);
  });
}, 1000, (p) => { const R = Math.max(p.w || 100, 100) * 0.9 + 100; return { breite: R * 2, hoehe: R * 2 }; }, {
  z: 10110,
  vorbereiten: (sz) => ({
    cw: sz.props.w || 100,
    federn: Array.from({ length: ppFxN(18) }, (_, i) => {
      const w = (i / 18) * Math.PI * 2 + Math.random() * 0.5, d = 45 + Math.random() * 95;
      return { dx: Math.cos(w) * d, dy: Math.sin(w) * d * 0.75 - 20, size: 13 + Math.random() * 13, spin: Math.random() * 900 - 450, delay: Math.random() * 240, dur: 480 + Math.random() * 280 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Goldify (`goldify_transmute`) — Phase 1: ein Goldglanz waechst ueber die Karte (gedithert, heller Rand), dann Blitz; Phase 2: Muenzen und Goldfunken sprengen nach aussen.
//  Auf 1000 ms gestaucht (die Engine wartet 1000 ms, danach verschwindet die Karte).
// ═════════════════════════════════════════════════════════════════
const ppFx4Goldify = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, F = PP_FX4_GOLD, cw = teile.cw, ch = teile.ch;
  const sk = t / 600;
  if (sk <= 1) {
    const sc = ppFx4Kurve(sk, [[0, 0.85], [0.5, 1.05], [0.85, 1.1], [1, 1.3]]), a = ppFx4Kurve(sk, [[0, 0], [0.5, 1], [0.85, 0.95], [1, 0]]);
    const w = Math.round((cw * sc) / S), h = Math.round((ch * sc) / S), x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const d = Math.min(1, Math.hypot((2 * (i + 0.5)) / w - 1, (2 * (j + 0.5)) / h - 1) / 1.25);
      const rand = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      g.put(x0 + i, y0 + j, rand ? F.hell : d < 0.4 ? F.gold : d < 0.75 ? F.ora : F.mitte, rand ? a * 0.7 : a * (0.55 - 0.3 * d));
    }
  }
  const bk = (t - 380) / 360;
  if (bk >= 0 && bk <= 1) {
    const sc = ppFx4Kurve(bk, [[0, 0.3], [0.3, 1.2], [1, 2]]), a = ppFx4Kurve(bk, [[0, 0], [0.3, 1], [1, 0]]), r = (60 * sc * 0.8) / S;
    g.glow(cx, cy, r, r, [F.gold, F.creme, F.weiss], a * 0.95, 1);
  }
  teile.muenzen.forEach((m) => {
    const k = (t - m.delay) / m.dur;
    if (k < 0 || k > 1) return;
    const e = ppFx4Aus2(k), a = ppFx4Kurve(k, [[0, 0], [0.2, 1], [1, 0]]), gross = m.size >= 24;
    ppR1Muenze(g, cx + (m.dx * e) / S, cy + (m.dy * e) / S, (gross ? [7, 5, 1, 5] : [5, 3, 1, 3])[Math.floor(k * 10 + m.phase) % 4], gross, a, 0);
  });
  teile.funken.forEach((s) => {
    const k = (t - s.delay) / s.dur;
    if (k < 0 || k > 1) return;
    const e = ppFx4Aus2(k), a = ppFx4Kurve(k, [[0, 0], [0.25, 1], [1, 0]]), n = Math.max(1, Math.round((s.size * ppFx4Kurve(k, [[0, 0.4], [0.25, 1], [1, 0.3]])) / S));
    ppFx4Funke(g, cx + (s.dx * e) / S, cy + (s.dy * e) / S, n, s.farbe, n >= 2 ? F.ora : null, a);
  });
}, 1000, (p) => { const R = Math.max(150, (p.h || 140) * 0.75 + 24); return { breite: R * 2, hoehe: R * 2 }; }, {
  z: 10100,
  vorbereiten: (sz) => {
    const cols = ['#fad54a', '#fbe181', '#fffbd2', '#ffb91a', '#ffe469'].map(ppHex);
    return {
      cw: sz.props.w || 100, ch: sz.props.h || 140,
      muenzen: Array.from({ length: ppFxN(14) }, () => { const w = Math.random() * Math.PI * 2, v = 45 + Math.random() * 50; return { dx: Math.cos(w) * v, dy: Math.sin(w) * v - 15, size: 18 + Math.random() * 12, delay: 400 + Math.random() * 140, dur: 440 + Math.random() * 120, phase: Math.floor(Math.random() * 4) }; }),
      funken: Array.from({ length: ppFxN(20) }, () => { const w = Math.random() * Math.PI * 2, v = 30 + Math.random() * 45; return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 3 + Math.random() * 5, delay: 400 + Math.random() * 180, dur: 360 + Math.random() * 180, farbe: cols[Math.floor(Math.random() * 5)] }; }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Golem Smash (`golem_smash_ice`) — Eis-Splitter beim Einschlag: heller Frostblitz, Stossring und 34 rautenfoermige Eissplitter, die nach aussen fliegen, absinken und ausdithern.
// ═════════════════════════════════════════════════════════════════
const PP_FX4_EIS = ppFx4Farben({ tief: '#2b457e', blau: '#4e82cb', mittel: '#4e77ca', kalt: '#68c6fd', eis: '#77c8ee', ring: '#b4dff8', hell: '#e5f5fa', weiss: '#ffffff', glas: '#bddcef', cyan: '#7fdfff' });
const ppFx4GolemEis = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX4_EIS;
  const fk = t / 380;
  if (fk <= 1) {
    const sc = ppFx4Kurve(fk, [[0, 0.3], [0.25, 1], [1, 1.9]]), a = ppFx4Kurve(fk, [[0, 0], [0.25, 1], [1, 0]]), r = (46 * sc * 0.8) / S;
    g.glow(cx, cy, r, r, [C.eis, C.ring, C.hell], a, 1);
  }
  const rk = t / 520;
  if (rk <= 1) {
    const r = (40 * ppFx4Kurve(rk, [[0, 0.3], [1, 2.6]])) / S, a = ppFx4Kurve(rk, [[0, 0.95], [1, 0]]);
    if (r > 1.5) { g.ring(cx, cy, r - 1, r, C.ring, a); if (r > 4) g.ring(cx, cy, r - 2.2, r - 1, C.eis, a * 0.4); }
  }
  teile.splitter.forEach((s) => {
    const k = (t - s.delay) / s.dur;
    if (k < 0 || k > 1) return;
    const e = ppFx4Kurve(k, [[0, 0], [0.5, 0.78], [1, 1]]), x = cx + (s.dx * e) / S, y = cy + (s.dy * e + 18 * k * k) / S, a = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
    const r = Math.max(0, Math.round(((s.size * (1 - 0.7 * k)) * 0.7) / S));
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (Math.abs(i) + Math.abs(j) <= r) g.put(x + i, y + j, (i + j < 0 || r === 0) && r > 0 ? C.hell : s.farbe, a);
    if (r === 0) g.put(x, y, s.farbe, a);
  });
}, 1100, { breite: 290, hoehe: 290 }, {
  z: 10100,
  vorbereiten: () => {
    const cols = ['#e5f5fa', '#b4dff8', '#77c8ee', '#bddcef', '#7bbeea'].map(ppHex);
    return { splitter: Array.from({ length: ppFxN(34) }, () => { const w = Math.random() * Math.PI * 2, v = 26 + Math.random() * 80; return { dx: Math.cos(w) * v, dy: Math.sin(w) * v * 0.85 - 6, size: 4 + Math.random() * 8, farbe: cols[Math.floor(Math.random() * 5)], delay: Math.random() * 60, dur: 420 + Math.random() * 380 }; }) };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Glass Sword / Shattered Trident (`glass_shatter` tuerkis, `pink_glass_shatter` rosa) — eine Glasscheibe blitzt auf (gedithert durchsichtig, helle Kanten), bekommt Risse (in drei Stufen),
//  zerspringt nach ~220 ms in dreieckige Scherben, die auseinanderfliegen und ausdithern; dazu ein Lichtring und Glasstaub. (Die Risse blieben im alten CSS nach dem Verschwinden der Scheibe
//  stehen — hier verschwinden sie mit ihr.)
// ═════════════════════════════════════════════════════════════════
const PP_FX4_GLAS_TUERKIS = {
  scherben: ppFx4P(['#6be9fa', '#6be9fa', '#b6eff7', '#07aec5', '#b6eff7']), staub: ppFx4P(['#e5f5fa', '#b6eff7', '#7fdfff']),
  ...ppFx4Farben({ a: '#b6eff7', b: '#77c8ee', c: '#e5f5fa', rand: '#7fdfff', riss: '#e5f5fa', ringA: '#e5f5fa', ringB: '#7fdfff', ringC: '#1788bd', tief: '#1788bd', weiss: '#ffffff' }),
};
const PP_FX4_GLAS_ROSA = {
  scherben: ppFx4P(['#f8b4df', '#f174ab', '#f3bad3', '#f174ab', '#f8b4df']), staub: ppFx4P(['#fae5eb', '#f3bad3', '#f8b4df']),
  ...ppFx4Farben({ a: '#f8b4df', b: '#f174ab', c: '#fae5eb', rand: '#f8b4df', riss: '#fae5eb', ringA: '#f1e5fa', ringB: '#f174ab', ringC: '#fc69c6', tief: '#c80480', weiss: '#ffffff' }),
};
function ppFx4Dreieck(g, cx, cy, n, ori, farben, a) {   // rechtwinkliges Dreieck, Kantenlaenge n (Raster), `ori` 0..3 = Lage der rechten Ecke
  const x0 = Math.round(cx - n / 2), y0 = Math.round(cy - n / 2);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let u = i, v = j;
    if (ori & 1) u = n - 1 - u;
    if (ori & 2) v = n - 1 - v;
    if (u > v) continue;
    const q = (u + v) / (2 * (n - 1) || 1);
    g.put(x0 + i, y0 + j, q < 0.3 ? farben[0] : q < 0.7 ? farben[1] : farben[2], a);
  }
}
function ppFx4GlasScherben(P) {
  const RISSE = [28, -63, 82, -18];   // CSS-Verlaufswinkel; der Strich steht senkrecht dazu
  return ppR1Leinwand((g, t, sz, teile) => {
    const S = sz.S, cx = sz.cx, cy = sz.cy;
    const pk = t / 340;
    let hw = 0, hh = 0;
    if (pk <= 1) {
      const sc = ppFx4Kurve(pk, [[0, 0.55], [0.3, 1.06], [0.62, 1], [0.78, 1.02], [1, 1.1]]), a = ppFx4Kurve(pk, [[0, 0], [0.3, 1], [0.78, 1], [1, 0]]);
      hw = (66 * sc) / S; hh = (48 * sc) / S;
      const w = Math.round(hw * 2), h = Math.round(hh * 2), x0 = Math.round(cx - hw), y0 = Math.round(cy - hh);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const u = (i / w + j / h) / 2;
        g.put(x0 + i, y0 + j, u < 0.2 ? P.weiss : u < 0.55 ? P.a : u < 0.85 ? P.b : P.c, a * (u < 0.2 ? 0.42 : 0.3));
      }
      g.block(x0, y0, w, 1, P.weiss, a); g.block(x0, y0, 1, h, P.weiss, a);
      g.block(x0, y0 + h - 1, w, 1, P.rand, a); g.block(x0 + w - 1, y0, 1, h, P.rand, a);
    }
    const ck = (t - 100) / 260;
    if (ck >= 0 && t < 400 && hw > 0) {
      const stufe = Math.min(3, Math.floor(ck * 3) + 1) / 3, a = stufe * ppR1Aus(t, 340, 400), L = Math.hypot(hw, hh) * stufe;
      RISSE.forEach((ang, i) => {
        const w = ((ang + 90) * Math.PI) / 180, dx = Math.sin(w), dy = -Math.cos(w);
        for (let s = -L; s <= L; s += 0.7) {
          const x = cx + dx * s, y = cy + dy * s;
          if (Math.abs(x - cx) <= hw && Math.abs(y - cy) <= hh) g.put(x, y, i === 2 ? P.riss : P.weiss, a);
        }
      });
      g.disc(cx, cy, 1.2, P.weiss, a);
    }
    const rk = (t - 220) / 600;
    if (rk >= 0 && rk <= 1) {
      const sx = ppFx4Kurve(rk, [[0, 0.3], [0.4, 1.4], [1, 2.1]]), sy = ppFx4Kurve(rk, [[0, 0.4], [0.4, 1.1], [1, 1.6]]), a = ppFx4Kurve(rk, [[0, 1], [0.4, 0.8], [1, 0]]);
      g.glow(cx, cy, (100 * sx * 0.75) / S, (60 * sy * 0.75) / S, [P.ringC, P.ringB, P.ringA], a * 0.85, 1);
    }
    teile.scherben.forEach((s) => {
      const k = (t - s.delay) / s.dur;
      if (k < 0 || k > 1) return;
      const e = ppFx4Kurve(k, [[0, 0], [0.3, 0.6], [1, 1]]), x = cx + (s.dx * e) / S, y = cy + ((s.dy + 26 * k) * e) / S;
      const n = Math.max(2, Math.round((s.size * (1.1 - 0.75 * k)) / S)), a = k < 0.25 ? 1 : 1 - (k - 0.25) / 0.75;
      ppFx4Dreieck(g, x, y, n, (s.ori + Math.floor((Math.abs(s.rot) * k) / 90)) & 3, [P.weiss, s.farbe, P.tief], a);
    });
    teile.staub.forEach((s) => {
      const k = (t - s.delay) / s.dur;
      if (k < 0 || k > 1) return;
      const e = ppFx4Aus2(k);
      g.block(cx + (s.dx * e) / S, cy + (s.dy * e) / S, s.size >= 4 ? 2 : 1, s.size >= 4 ? 2 : 1, s.farbe, 1 - k);
    });
  }, 1000, { breite: 420, hoehe: 340 }, {
    z: 10100,
    vorbereiten: () => ({
      scherben: Array.from({ length: ppFxN(22) }, () => { const w = Math.random() * Math.PI * 2, v = 34 + Math.random() * 78; return { dx: Math.cos(w) * v, dy: Math.sin(w) * v + 14, size: 8 + Math.random() * 14, rot: (Math.random() - 0.5) * 540, ori: Math.floor(Math.random() * 4), farbe: P.scherben[Math.floor(Math.random() * 5)], delay: 220 + Math.random() * 60, dur: 420 + Math.random() * 260 }; }),
      staub: Array.from({ length: ppFxN(16) }, () => { const w = Math.random() * Math.PI * 2, v = 20 + Math.random() * 50; return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 2 + Math.random() * 4, farbe: P.staub[Math.floor(Math.random() * 3)], delay: 230 + Math.random() * 60, dur: 300 + Math.random() * 200 }; }),
    }),
  });
}
const ppFx4GlasTuerkis = ppFx4GlasScherben(PP_FX4_GLAS_TUERKIS), ppFx4GlasRosa = ppFx4GlasScherben(PP_FX4_GLAS_ROSA);

// ═════════════════════════════════════════════════════════════════
//  Golden Ankh (`golden_ankh_revival`) — zwei goldene Blitze, dazu 12 aufsteigende Ankh-Kreuze (Pixel-Sprite, klein/gross) und 20 Goldfunken, die ueber dem Helden aufsteigen. Auf 1000 ms gestaucht.
// ═════════════════════════════════════════════════════════════════
const PP_FX4_ANKH_PAL = { G: PP_FX4_GOLD.gold, L: PP_FX4_GOLD.weiss, D: PP_FX4_GOLD.dunkel };
const PP_FX4_ANKH_GROSS = ['..GGG..', '.GL.LG.', '.G...G.', '.GL.LD.', '..GGD..', 'GGGGGDD', '..LGD..', '..LGD..', '..LGD..', '..LGD..', '..GGD..'];
const PP_FX4_ANKH_KLEIN = ['.GGG.', 'G...G', '.GGD.', 'GGGGD', '..GD.', '..GD.', '..GD.'];
const ppFx4Ankh = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, F = PP_FX4_GOLD;
  [[80, 800, 75, [F.ora, F.gold, F.blass]], [120, 600, 45, [F.gold, F.hell, F.weiss]]].forEach(([d, dur, rad, farben]) => {
    const k = (t - d) / dur;
    if (k < 0 || k > 1) return;
    const sc = ppFx4Kurve(k, [[0, 0.3], [0.5, 1.5], [1, 2]]) * 0.55, a = ppFx4Kurve(k, [[0, 1], [0.5, 0.7], [1, 0]]);
    g.glow(cx, cy, (rad * sc * 1.1) / S, (rad * sc * 1.1) / S, farben, a * 0.55, 1.6);
  });
  teile.ankhs.forEach((a) => {
    const k = (t - a.delay) / a.dur;
    if (k < 0 || k > 1) return;
    const y = a.startY + a.endY * ppFx4Aus2(k), al = ppFx4Kurve(k, [[0, 0], [0.15, 1], [0.8, 0.8], [1, 0]]);
    ppFx4Bild(g, a.size >= 20 ? PP_FX4_ANKH_GROSS : PP_FX4_ANKH_KLEIN, PP_FX4_ANKH_PAL, cx + (a.xOff + a.size / 2) / S, cy + (y + a.size / 2) / S, al, 1);
  });
  teile.funken.forEach((s) => {
    const k = (t - s.delay) / s.dur;
    if (k < 0 || k > 1) return;
    const y = s.startY + s.endY * ppFx4Aus2(k), al = ppFx4Kurve(k, [[0, 0], [0.15, 1], [0.8, 0.8], [1, 0]]), n = s.size >= 6 ? 2 : 1;
    ppFx4Funke(g, cx + (s.xOff + s.size / 2) / S, cy + (y + s.size / 2) / S, n, s.farbe, n >= 2 ? F.ora : null, al);
  });
}, 1000, { breite: 290, hoehe: 330, ankerX: 145, ankerY: 200 }, {
  z: 10100,
  vorbereiten: () => {
    const cols = ['#fad54a', '#fbe181', '#fffbd2', '#ffb91a', '#ffe469'].map(ppHex);
    return {
      ankhs: Array.from({ length: ppFxN(12) }, () => ({ xOff: -45 + Math.random() * 90, startY: 20 + Math.random() * 30, endY: -70 - Math.random() * 80, delay: 60 + Math.random() * 280, dur: 500 + Math.random() * 150, size: 14 + Math.random() * 16 })),
      funken: Array.from({ length: ppFxN(20) }, () => ({ xOff: -50 + Math.random() * 100, startY: 10 + Math.random() * 40, endY: -50 - Math.random() * 70, delay: 100 + Math.random() * 280, dur: 420 + Math.random() * 180, size: 3 + Math.random() * 7, farbe: cols[Math.floor(Math.random() * 5)] })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Hand of Death (`hand_of_death_strike`) und Icy Grave (`icy_grave_strike`) — derselbe Ablauf (1700 ms, Aufrufer sendet `duration: 1700`): dunkle Aura, ein riesiges Zeichen stuerzt von oben
//  auf das Ziel (Totenkopf bzw. Schneeflocke; als Pixel-Sprite in ganzzahligen Stufen 1–4×), ab 680 ms Einschlag: Blitze (Hand of Death) bzw. vier Eissaeulen (Icy Grave), weiss-roter bzw.
//  weiss-blauer Blitz, zwei Druckwellen, dann Totenkoepfe/Knochen/Funken bzw. Eiswuerfel/Flocken/Funken.
// ═════════════════════════════════════════════════════════════════
const PP_FX4_TOD = ppFx4Farben({ aura1: '#2a0404', aura2: '#55011a', dunkel: '#780014', blut: '#8c0014', rot: '#b5171c', hell: '#e92f38', pink: '#fc1c5f', rosa: '#fe6794', mattrot: '#fe5154', bleich: '#fae5eb', knochen: '#ec7f79', weiss: '#ffffff', schwarz: '#141414', grau: '#9aa3b6', licht: '#d2d2db' });
const PP_FX4_SCHAEDEL_PAL = { o: PP_FX4_TOD.rot, w: PP_FX4_TOD.bleich, s: PP_FX4_TOD.grau, k: PP_FX4_TOD.schwarz };
const PP_FX4_SCHAEDEL = ['...oooooooo...', '..owwwwwwwwo..', '.owwwwwwwwwwo.', 'owwwwwwwwwwwwo', 'owwkkkwwkkkwwo', 'owkkkkwwkkkkwo', 'owkkkkwwkkkkwo', 'owwwwwkkwwwwwo', '.owwwwwwwwwwo.', '..owwwwwwwwo..', '..owswswswwo..', '..owswswswwo..', '...oooooooo...'];
const PP_FX4_KNOCHEN = [ ['ww....ww', 'wwwwwwww', 'ww....ww'], ['ww.....', 'www....', '.www...', '..www..', '...www.', '....www', '.....ww'], ['www', 'www', '.w.', '.w.', '.w.', '.w.', 'www', 'www'], ['.....ww', '....www', '...www.', '..www..', '.www...', 'www....', 'ww.....'] ];
const PP_FX4_KLEINSCHAEDEL = ['.wwwww.', 'wwwwwww', 'wkkwkkw', 'wwwwwww', '.wwkww.', '.wswsw.', '..www..'];
const PP_FX4_KNOCHEN_PAL = { w: PP_FX4_TOD.bleich };
const PP_FX4_EISPAL = { o: PP_FX4_EIS.blau, l: PP_FX4_EIS.ring, g: PP_FX4_EIS.eis, w: PP_FX4_EIS.hell };
const PP_FX4_EISSTERN = ppFx4Raster(15, 15, (x, y) => {
  const dx = x - 7, dy = y - 7, ax = Math.abs(dx), ay = Math.abs(dy), achse = dx === 0 || dy === 0, diag = ax === ay;
  if (ax <= 1 && ay <= 1) return 'w';
  if (achse || diag) return Math.max(ax, ay) >= 6 ? 'g' : 'l';
  if ((ax === 4 && ay === 1) || (ay === 4 && ax === 1)) return 'l';
  return '.';
});
const PP_FX4_FLOCKE_KLEIN = ppFx4Raster(5, 5, (x, y) => { const ax = Math.abs(x - 2), ay = Math.abs(y - 2); return ax === 0 && ay === 0 ? 'w' : (ax === 0 || ay === 0 || ax === ay) ? 'l' : '.'; });
const PP_FX4_FLOCKE = ppFx4Raster(7, 7, (x, y) => { const ax = Math.abs(x - 3), ay = Math.abs(y - 3); return ax <= 0 && ay <= 0 ? 'w' : (ax === 0 || ay === 0 || ax === ay) ? (Math.max(ax, ay) === 3 ? 'g' : 'l') : '.'; });
const PP_FX4_EISSPLITTER = ppFx4Raster(9, 11, (x, y) => {
  const dx = x - 4, dy = y - 5, q = Math.abs(dx) / 4.3 + Math.abs(dy) / 5.3;
  if (q > 1) return '.';
  if (q > 0.74) return 'o';
  return dx === 0 ? 'w' : dx < 0 ? 'l' : 'g';
});
const PP_FX4_FUNKE_STERN = ppFx4Raster(5, 5, (x, y) => (x === 2 && y === 2) ? 'w' : (x === 2 || y === 2) ? 'l' : '.');

function ppFx4Schlag(eis) {
  const T = PP_FX4_TOD, C = PP_FX4_EIS, DESC = eis ? 760 : 750;
  const AURA = eis ? [C.tief, C.mittel, C.ring] : [T.aura1, T.aura2];
  const BLITZ = eis ? [C.tief, C.blau, C.kalt, C.hell, C.weiss] : [T.dunkel, T.rot, T.mattrot, T.bleich, T.weiss];
  const R1 = eis ? C.cyan : T.pink, R2 = eis ? C.blau : T.blut, R1k = eis ? C.hell : T.rosa;
  return ppR1Leinwand((g, t, sz, teile) => {
    const S = sz.S, cx = sz.cx, cy = sz.cy;
    // Aura (1500 ms)
    const ak = t / 1500;
    if (ak <= 1) {
      const sc = ppFx4Kurve(ak, [[0, 0.4], [0.22, 1], [0.7, 1.2], [1, 1.45]]), a = ppFx4Kurve(ak, [[0, 0], [0.22, 1], [0.7, 0.85], [1, 0]]), r = (130 * sc * 0.8) / S;
      g.glow(cx, cy, r, r, AURA, a * 0.6, 0.8);
    }
    // Eissaeulen (Icy Grave): Dreiecke mit heller Spitze, steigen aus dem Boden
    if (eis) teile.saeulen.forEach((sp) => {
      const k = (t - sp.delay) / sp.dur;
      if (k < 0 || k > 1) return;
      const ty = ppFx4Kurve(k, [[0, 0], [0.3, -30], [0.6, -50], [1, -50]]), sy = ppFx4Kurve(k, [[0, 0], [0.3, 0.8], [0.6, 1.05], [1, 1]]), a = ppFx4Kurve(k, [[0, 0], [0.3, 1], [0.6, 1], [1, 0]]);
      const H = Math.round((sp.h * sy) / S), W = 8, boden = Math.round((sp.h + ty) / S);
      for (let j = 0; j < H; j++) {
        const v = j / Math.max(1, H - 1), half = (W / 2) * (j + 1) / Math.max(1, H), y = cy + boden - H + j;
        for (let i = -Math.floor(half); i <= Math.floor(half); i++) g.put(cx + sp.x / S + i, y, i >= Math.floor(half) && half > 1.5 ? C.eis : v < 0.35 ? C.weiss : v < 0.7 ? C.hell : C.ring, a * (v > 0.7 ? 0.85 : 1));
      }
    });
    // Das grosse Zeichen stuerzt herab
    const dk = t / DESC;
    if (dk <= 1) {
      const ty = ppFx4Kurve(dk, [[0, -260], [0.28, -130], [0.68, 0], [0.85, 20], [1, 30]]), sc = ppFx4Kurve(dk, [[0, 0.55], [0.28, 0.85], [0.68, 1.15], [0.85, 1.35], [1, 1.55]]);
      const a = ppFx4Kurve(dk, [[0, 0], [0.28, 1], [0.68, 1], [0.85, 0.8], [1, 0]]), m = ppR1Klemme(Math.round((36 * sc) / 14), 1, 4);
      if (eis) ppFx4Bild(g, PP_FX4_EISSTERN, PP_FX4_EISPAL, cx, cy + (60 + ty) / S, a, m);
      else ppFx4Bild(g, PP_FX4_SCHAEDEL, PP_FX4_SCHAEDEL_PAL, cx, cy + (60 + ty) / S, a, m);
    }
    // Blitze (Hand of Death)
    if (!eis) teile.blitze.forEach((b) => {
      const k = (t - b.delay) / 320;
      if (k < 0 || k > 1) return;
      const a = ppFx4Kurve(k, [[0, 0], [0.25, 1], [0.6, 0.9], [1, 0]]), len = (190 * ppFx4Kurve(k, [[0, 0.05], [0.25, 1], [1, 1]])) / S, w = (b.ang * Math.PI) / 180;
      const dx = Math.sin(w), dy = -Math.cos(w);
      let px = cx, py = cy;
      const n = Math.max(2, Math.round(len / 5));
      for (let i = 1; i <= n; i++) {
        const u = i / n, zick = (i % 2 ? 1.5 : -1.5) * (1 - u), x = cx + dx * len * u + zick, y = cy + dy * len * u;
        ppR1Band(g, px, py, x, y, () => ({ w: u < 0.45 ? 2 : 1, c: u < 0.35 ? T.weiss : u < 0.7 ? T.rosa : T.pink }), a);
        px = x; py = y;
      }
    });
    // Einschlagblitz (850 ms ab 720)
    const fk = (t - 720) / 850;
    if (fk >= 0 && fk <= 1) {
      const sc = ppFx4Kurve(fk, [[0, 0.4], [0.12, 1], [0.5, 1.35], [1, 1.75]]), a = ppFx4Kurve(fk, [[0, 0], [0.12, 1], [0.5, 0.7], [1, 0]]), r = (140 * sc * 0.8) / S;
      g.glow(cx, cy, r, r, BLITZ, a * 0.62, 1.25);
    }
    // Druckwellen
    [[740, 950, 30, 6, R1], [800, 880, 40, 4, R2]].forEach(([d, dur, rad, dick, c], i) => {
      const k = (t - d) / dur;
      if (k < 0 || k > 1) return;
      const sc = ppFx4Kurve(k, [[0, 0.4], [0.16, 1.2], [1, 5.2]]), a = i === 0 ? ppFx4Kurve(k, [[0, 0], [0.16, 1], [1, 0]]) : ppFx4Kurve(k, [[0, 0], [0.16, 0.85], [1, 0]]);
      const r = (rad * sc) / S, th = Math.max(1, Math.round((dick * (1 - 0.8 * k)) / S));
      if (r > 1.5) { g.ring(cx, cy, r - th, r, c, a); if (i === 0 && th > 1) g.ring(cx, cy, r - th - 1, r - th, R1k, a * 0.5); }
    });
    // Truemmer
    teile.gross.forEach((s) => {
      const k = (t - s.delay) / s.dur;
      if (k < 0 || k > 1) return;
      const e = ppFx4Kurve(k, [[0, 0], [0.22, 0.4], [1, 1]]), x = cx + (Math.cos(s.angle) * s.dist * e) / S, y = cy + (Math.sin(s.angle) * s.dist * e - 22 * e) / S, a = ppFx4Kurve(k, [[0, 0], [0.22, 1], [1, 0]]);
      if (eis) ppFx4Bild(g, PP_FX4_EISSPLITTER, PP_FX4_EISPAL, x, y, a, 1); else ppFx4Bild(g, PP_FX4_KLEINSCHAEDEL, PP_FX4_KNOCHEN_PAL, x, y, a, 1);
    });
    teile.klein.forEach((s) => {
      const k = (t - s.delay) / s.dur;
      if (k < 0 || k > 1) return;
      const e = ppFx4Kurve(k, [[0, 0], [0.25, 0.4], [1, 1]]), x = cx + (Math.cos(s.angle) * s.dist * e) / S, y = cy + (Math.sin(s.angle) * s.dist * e - 10 * e) / S, a = ppFx4Kurve(k, [[0, 0], [0.25, 1], [1, 0]]);
      if (eis) {
        if (s.art === 2) ppFx4Bild(g, PP_FX4_FUNKE_STERN, { w: C.weiss, l: C.hell }, x, y, a, 1);
        else ppFx4Bild(g, s.size >= 22 ? PP_FX4_FLOCKE : PP_FX4_FLOCKE_KLEIN, PP_FX4_EISPAL, x, y, a, 1);
      } else if (s.art === 2) ppFx4Bild(g, PP_FX4_KLEINSCHAEDEL, PP_FX4_KNOCHEN_PAL, x, y, a, 1);
      else ppFx4Bild(g, PP_FX4_KNOCHEN[(s.phase + Math.floor((Math.abs(s.rot) * k) / 45)) & 3], PP_FX4_KNOCHEN_PAL, x, y, a, 1);
    });
    teile.funken.forEach((s) => {
      const k = (t - s.delay) / s.dur;
      if (k < 0 || k > 1) return;
      const e = ppFx4Kurve(k, [[0, 0], [0.22, 0.35], [1, 1]]), x = cx + (Math.cos(s.angle) * s.dist * e) / S, y = cy + (Math.sin(s.angle) * s.dist * e - 15 * e) / S, a = ppFx4Kurve(k, [[0, 0], [0.22, 1], [1, 0]]);
      const n = s.size >= 7 ? 2 : 1;
      ppFx4Funke(g, x, y, n, eis ? C.eis : T.pink, eis ? C.blau : T.blut, a);
      if (n === 2) g.put(x, y, eis ? C.weiss : T.bleich, a);
    });
  }, 1700, { breite: 440, hoehe: 480, ankerX: 220, ankerY: 270 }, {
    z: 10110,
    vorbereiten: () => {
      const ring = (n, d0, d1, dl0, dl1, du0, du1) => Array.from({ length: ppFxN(n) }, () => ({ angle: Math.random() * Math.PI * 2, dist: d0 + Math.random() * d1, delay: dl0 + Math.random() * dl1, dur: du0 + Math.random() * du1, size: 4 + Math.random() * 7, rot: -180 + Math.random() * 360, art: Math.floor(Math.random() * 3), phase: Math.floor(Math.random() * 4) }));
      return {
        gross: ring(eis ? 14 : 10, eis ? 70 : 65, eis ? 55 : 55, 760, 220, 500, 200),
        klein: ring(eis ? 22 : 18, eis ? 55 : 50, eis ? 85 : 85, 700, 280, 520, 180).map((s) => ({ ...s, size: eis ? 16 + Math.random() * 14 : 14 + Math.random() * 14 })),
        funken: ring(28, 55, 75, 720, 320, 480, 160),
        blitze: Array.from({ length: 5 }, (_, i) => ({ ang: -32 + i * 16, delay: 680 + i * 28 })),
        saeulen: [{ x: -60, h: 100, delay: 720, dur: 700 }, { x: 60, h: 100, delay: 760, dur: 700 }, { x: -30, h: 130, delay: 740, dur: 720 }, { x: 30, h: 130, delay: 780, dur: 720 }],
      };
    },
  });
}
const ppFx4HandOfDeath = ppFx4Schlag(false), ppFx4IcyGrave = ppFx4Schlag(true);

// ═════════════════════════════════════════════════════════════════
//  Heat Wave (`heat_wave`) — brettweit: ein Hitzeschleier (Dither) und ein Glutboden liegen ueber dem ganzen Spielfeld, 15 wabernde Windschwaden (rot, bzw. heiss orange-gelb) rollen quer
//  durch, dazwischen schlagen 44 Pixelflammen auf, Glut treibt mit dem Wind. Zeiten wie vorher (2800 ms), skaliert mit der `duration` des Aufrufs.
// ═════════════════════════════════════════════════════════════════
const PP_FX4_HITZE = ppFx4Farben({ kern: '#f87420', mitte: '#cc2b00', rand: '#5b0102', boden1: '#ff9a1a', boden2: '#ff491a', dunkelrot: '#8c0014', rot: '#c80000', heiss: '#ff9b3a', hellgelb: '#f7f7ad', gelb: '#f9ac20', creme: '#fffbd2', glut: '#f9ac20', funke: '#ff491a', flgelb: '#fad54a' });
const PP_FX4_WIND_KALT = [[0, 'dunkelrot', 0], [0.22, 'rot', 0.55], [0.6, 'boden2', 0.85], [0.88, 'heiss', 0.95], [1, 'heiss', 0]];
const PP_FX4_WIND_HEISS = [[0, 'kern', 0], [0.25, 'kern', 0.6], [0.65, 'gelb', 0.9], [0.9, 'hellgelb', 0.95], [1, 'creme', 0]];
function ppFx4Wind(g, xl, yc, len, hh, heiss, a) {
  const F = PP_FX4_HITZE, st = heiss ? PP_FX4_WIND_HEISS : PP_FX4_WIND_KALT, L = Math.max(2, Math.round(len)), R = Math.max(1, Math.round(hh));
  for (let i = 0; i < L; i++) {
    const X = Math.round(xl + i);
    if (X < 0) continue;
    if (X >= g.gw) break;
    const u = (i + 0.5) / L, env = Math.sqrt(Math.max(0, 1 - (2 * u - 1) * (2 * u - 1))), h = R * env;
    let c = F.kern, al = 0;
    for (let q = 1; q < st.length; q++) if (u <= st[q][0]) { const [u0, c0, a0] = st[q - 1], [u1, c1, a1] = st[q], f = (u - u0) / (u1 - u0); al = a0 + (a1 - a0) * f; c = F[f < 0.5 ? c0 : c1]; break; }
    const al2 = al * a;
    if (al2 <= 0.02) continue;
    for (let j = -Math.floor(h); j <= Math.floor(h); j++) g.put(X, yc + j, c, Math.abs(j) > h * 0.7 ? al2 * 0.6 : al2);
  }
}
function ppFx4Flamme(g, bx, by, w, h, a, ph) {
  const F = PP_FX4_HITZE, H = Math.max(3, Math.round(h)), W = Math.max(2, w);
  [[1, F.mitte], [0.74, F.kern], [0.5, F.flgelb], [0.26, F.creme]].forEach(([f, c]) => {
    const hh = Math.max(2, Math.round(H * (0.4 + 0.6 * f)));
    for (let j = 0; j < hh; j++) {
      const v = j / Math.max(1, hh - 1), half = Math.max(0.5, (W * f / 2) * Math.sin(Math.PI * Math.pow(v, 1.6))), sway = Math.sin(ph + v * 3.5) * (1 - v) * W * 0.12, y = by - hh + 1 + j;
      for (let i = Math.round(bx + sway - half); i <= Math.round(bx + sway + half); i++) g.put(i, y, c, a);
    }
  });
}
const ppFx4Hitzewelle = ppFx4Leinwand((g, t, sz, teile) => {
  const S = sz.S, gw = sz.gw, gh = sz.gh, F = PP_FX4_HITZE, dauer = teile.dauer;
  g.gw = gw;
  const env = ppFx4Kurve(t / dauer, [[0, 0], [0.25, 1], [0.7, 0.85], [1, 0]]);
  // Schleier (Dither ueber das ganze Feld)
  if (env > 0.02) {
    const A = teile.vA, B = teile.vB, Cc = teile.vC, cols = [F.kern, F.mitte, F.rand];
    for (let i = 0; i < A.length; i++) if (B[i] < env * A[i]) g.put(i % gw, (i / gw) | 0, cols[Cc[i]], 1);
    // Glutboden (untere 38 %)
    const Y0 = Math.round(gh * 0.62);
    for (let Y = Y0; Y < gh; Y++) {
      const b = (gh - 1 - Y) / (gh * 0.38), a = env * (b < 0.55 ? 0.4 - 0.24 * (b / 0.55) : 0.16 * (1 - (b - 0.55) / 0.45)), c = b < 0.4 ? F.boden1 : F.boden2;
      for (let X = 0; X < gw; X++) if (ppBayer(X, Y) < a) g.put(X, Y, c, 1);
    }
  }
  teile.winde.forEach((v) => {
    const k = (t - v.verzug) / v.lauf;
    if (k < 0 || k > 1) return;
    const e = 1 - Math.pow(1 - k, 2.2), ph = (t - v.verzug) / v.wabern, len = v.laenge / S, xl = -len + (gw + len) * e, a = ppFx4Kurve(k, [[0, 0], [0.12, 1], [0.8, 0.9], [1, 0]]);
    ppFx4Wind(g, xl, v.yy / S - (v.amp * Math.cos(Math.PI * ph)) / S, len, (v.hoehe / 2 * (1.025 - 0.225 * Math.cos(Math.PI * ph))) / S, v.heiss, a);
  });
  teile.flammen.forEach((f) => {
    const k = (t - f.verzug) / f.laenge;
    if (k < 0 || k > 1) return;
    const sx = ppFx4Kurve(k, [[0, 0.2], [0.2, 1], [0.45, 0.85], [0.7, 1.05], [1, 0.5]]), sy = ppFx4Kurve(k, [[0, 0.1], [0.2, 1.15], [0.45, 1.3], [0.7, 1], [1, 1.4]]);
    const a = ppFx4Kurve(k, [[0, 0], [0.2, 1], [0.45, 1], [0.7, 0.85], [1, 0]]), steig = k > 0.7 ? ((k - 0.7) / 0.3) * 0.35 * f.groesse * 1.7 : 0;
    ppFx4Flamme(g, f.fx / S, (f.fy + 0.2 * f.groesse * sy - steig) / S, (f.groesse * sx) / S, (f.groesse * 1.7 * sy) / S, a, (t - f.verzug) / 90 + f.fx);
  });
  teile.glut.forEach((q) => {
    const k = (t - q.verzug) / q.lauf;
    if (k < 0 || k > 1) return;
    const e = ppFx4Aus2(k), a = ppFx4Kurve(k, [[0, 0], [0.15, 1], [1, 0]]);
    ppFx4Funke(g, (q.gx + q.drift * e) / S, (q.gy - q.steig * e) / S, q.groesse >= 6 ? 2 : 1, F.glut, F.funke, a);
  });
}, (p) => p.duration || 2800, (p) => ({ breite: Math.max(p.w || 900, 320), hoehe: Math.max(p.h || 560, 240) }), {
  z: 10150,
  vorbereiten: (sz) => {
    const dauer = sz.props.duration || 2800, sf = dauer / 2800, gw = sz.gw, gh = sz.gh, W = gw * sz.S, H = gh * sz.S;
    const n = ppFxN(15), vA = new Float32Array(gw * gh), vB = new Float32Array(gw * gh), vC = new Uint8Array(gw * gh);
    for (let Y = 0; Y < gh; Y++) for (let X = 0; X < gw; X++) {
      const i = Y * gw + X, d = Math.min(1, Math.hypot((X / gw - 0.5) / 0.72, (Y / gh - 0.6) / 0.72));
      vA[i] = 0.14 + 0.18 * d; vB[i] = ppBayer(X, Y); vC[i] = d < 0.45 ? 0 : d < 0.8 ? 1 : 2;
    }
    return {
      dauer, vA, vB, vC,
      winde: Array.from({ length: n }, (_, i) => ({ yy: ((i + 0.5) / n) * H + (Math.random() - 0.5) * (H / n) * 0.8, laenge: W * (0.6 + Math.random() * 0.55), hoehe: 12 + Math.random() * 26, verzug: Math.round(Math.random() * 650) * sf, lauf: Math.round(1150 + Math.random() * 700) * sf, amp: 5 + Math.random() * 15, wabern: Math.round(380 + Math.random() * 320) * sf, heiss: Math.random() > 0.55 })),
      flammen: Array.from({ length: ppFxN(44) }, () => ({ fx: Math.random() * W, fy: H * 0.08 + Math.random() * H * 0.88, groesse: 24 + Math.random() * 36, verzug: Math.round(280 + Math.random() * 1100) * sf, laenge: Math.round(620 + Math.random() * 520) * sf })),
      glut: Array.from({ length: ppFxN(38) }, () => ({ gx: Math.random() * W * 0.6, gy: Math.random() * H, groesse: 3 + Math.random() * 4, verzug: Math.round(Math.random() * 1100) * sf, steig: 40 + Math.random() * 130, drift: W * (0.25 + Math.random() * 0.45), lauf: Math.round(800 + Math.random() * 700) * sf })),
    };
  },
});

// ── Registrierung ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
ppFxUeberschreiben('johanna_cleanse', ppFx4Johanna);
ppFxUeberschreiben('idej_projection_absorb', ppFx4Idej);
ppFxUeberschreiben('golden_apple_burst', ppFx4Apfel);
ppFxUeberschreiben('golden_explosion', ppFx4GoldExplosion);
ppFxUeberschreiben('golden_feathers', ppFx4Federn);
ppFxUeberschreiben('goldify_transmute', ppFx4Goldify);
ppFxUeberschreiben('golem_smash_ice', ppFx4GolemEis);
ppFxUeberschreiben('glass_shatter', ppFx4GlasTuerkis);
ppFxUeberschreiben('pink_glass_shatter', ppFx4GlasRosa);
ppFxUeberschreiben('golden_ankh_revival', ppFx4Ankh);
ppFxUeberschreiben('hand_of_death_strike', ppFx4HandOfDeath);
ppFxUeberschreiben('icy_grave_strike', ppFx4IcyGrave);
ppFxUeberschreiben('heat_wave', ppFx4Hitzewelle);
