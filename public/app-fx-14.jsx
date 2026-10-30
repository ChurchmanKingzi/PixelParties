// Pixelart-Portierungen (Canvas), Batch 14 (zweite Welle, Schwelle 50 ms): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte: lightning_rain, loyalty_birds, magic_hammer, mist_veil, monkee_shield, mummy_wrap, mushroom_spore, night_howl, orbital_laser_red, overheal_shock_equip, petrify, piranha_bites.
// Alle laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s) mit den Ankern und Zeiten der DOM-Fassungen in `ANIM_REGISTRY` (app-board.jsx, Keyframes in style.css).
// Pixelart-Regeln: nur Palettenfarben, Deckung < 1 = Bayer-Dithering, kein Weichzeichner/Schein/Verlauf (Schein = Dither-Stufen), Drehungen nur als berechnete Geometrie (Linien), Symbole als Pixelbilder.

// ── Bausteine (Präfix ppFx14) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const ppFx14R = (a, b) => a + Math.random() * (b - a);
const ppFx14Wahl = (l) => l[Math.floor(Math.random() * l.length)];
/** CSS-`cubic-bezier(x1, y1, x2, y2)` als Funktion u → Wert (Bisektion). */
function ppFx14Bez(x1, y1, x2, y2) {
  const kurve = (a, b, s) => 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (kurve(x1, x2, m) < x) lo = m; else hi = m; }
    return kurve(y1, y2, (lo + hi) / 2);
  };
}
const PP_FX14_E = {
  aus: ppFx14Bez(0, 0, 0.58, 1),       // ease-out
  ein: ppFx14Bez(0.42, 0, 1, 1),       // ease-in
  eio: ppFx14Bez(0.42, 0, 0.58, 1),    // ease-in-out
  hammer: ppFx14Bez(0.2, 0, 0.8, 0.4),
  laser: ppFx14Bez(0.4, 0, 0.2, 1),
};
/** Keyframes wie in CSS: `stops` = [[u, Wert], …]; `ease` wirkt je Abschnitt (wie `animation-timing-function`). */
function ppFx14Kf(u, stops, ease) {
  const e = ease || ((x) => x);
  if (u <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0]) {
      const [u0, v0] = stops[i - 1], [u1, v1] = stops[i];
      return v0 + (v1 - v0) * e((u - u0) / (u1 - u0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}
/** Schein als Dither-Stufen (von außen nach innen), Deckung `a` (gedithert); `kx`/`ky` schneiden optional auf ein Rechteck zu. Wie `g.glow`, nur schneller (Wurzel statt hypot). */
function ppFx14Glow(g, cx, cy, rx, ry, stufen, a = 1, p = 1, kx, ky) {
  cx = Math.round(cx); cy = Math.round(cy);
  if (rx < 0.6 || ry < 0.6 || a <= 0.02) return;
  const RX = Math.min(Math.ceil(rx), kx == null ? 1e9 : kx), RY = Math.min(Math.ceil(ry), ky == null ? 1e9 : ky), n = stufen.length, irx = 1 / rx, iry = 1 / ry;
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
/** Kugel/Korn aus zwei Tönen: Rand `c0`, Kern `c1`; unter 1,5 Rasterpixeln ein einzelner Punkt. */
function ppFx14Scheibe(g, cx, cy, r, c0, c1, a) {
  if (r < 0.75) { g.put(cx, cy, c1 || c0, a); return; }
  g.disc(cx, cy, r, c0, a);
  if (c1 && r >= 1.5) g.disc(cx, cy, r * 0.5, c1, a);
}
/** Wie `ppR1Leinwand`, nur dass die Laufzeit aus `duration` kommt (Standard `standard`) — der Aufrufer kürzt/verlängert ihn je nach Zauber. */
function ppFx14Dauer(malen, standard, mass, opt) {
  return function Fx14Dauer(props) {
    const C = useMemo(() => ppR1Leinwand(malen, props.duration || standard, mass, opt), []);
    return <C {...props} />;
  };
}
/** Zeichenreihen eines Pixelbilds in ein Wörterbuch Zeichen → Farbe. */
const ppFx14Pal = (o) => { const r = {}; for (const k in o) r[k] = ppHex(o[k]); return r; };

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Blitzregen (`lightning_rain`, Piercer of Heavens) — PIXELART. Acht gezackte Blitze fallen gestaffelt (60 ms + 110 ms je Blitz) vom oberen Bildrand auf leicht versetzte Punkte der Zielkarte:
//  je Blitz 260 ms flackernd sichtbar (weißer Kern, blauer Rand), dazu ein Aufschlagblitz (340 ms: Dither-Scheibe wächst .3 → 1,8 und blendet aus). Klang je Einschlag wie vorher (`elem_lightning`).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX14_BLITZ = { halo: ppHex('#77c8ee'), kern: ppHex('#ffffff'), schein: ['#66b6ff', '#b4dff8', '#ffffff'].map(ppHex) };
function ppFx14RegenBolzen(w, h) {
  return Array.from({ length: ppFxN(8) }, (_, i) => {
    const ox = (Math.random() - 0.5) * w * 0.9, oy = (Math.random() - 0.5) * h * 0.7, H = 900;
    const pts = [[ox + (Math.random() - 0.5) * 60, -H]];
    for (let k = 1; k <= 6; k++) { const t = k / 6; pts.push([ox + (1 - t) * (Math.random() - 0.5) * 70, -H + t * (H + oy)]); }
    pts[pts.length - 1] = [ox, oy];
    return { ox, oy, pts, delay: 60 + i * 110 + Math.random() * 40, width: 2 + Math.random() * 2, rate: 0.85 + Math.random() * 0.4 };
  });
}
const ppFx14RegenBild = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX14_BLITZ;
  for (const b of te) {
    const k = (t - b.delay) / 260;
    if (k >= 0 && k <= 1) {
      const a = ppFx14Kf(k, [[0, 0], [0.1, 1], [0.4, 0.9], [0.6, 0.3], [0.75, 0.8], [1, 0]], PP_FX14_E.aus);
      if (a > 0.04) {
        const kd = b.width > 3.2 ? 2 : 1, P = b.pts.map(([x, y]) => [cx + x / S, cy + y / S]);
        const ka = a >= 0.45 ? 1 : a / 0.45;                           // Kern bleibt hart, solange der Blitz hell ist; nur das Abklingen dithert
        for (let i = 1; i < P.length; i++) g.line(P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], C.halo, a * 0.6, kd + 1);
        for (let i = 1; i < P.length; i++) g.line(P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], C.kern, ka, kd);
      }
    }
    const f = (t - b.delay - 30) / 340;
    if (f >= 0 && f <= 1) {
      const e = PP_FX14_E.aus(f), r = (23 * (0.3 + 1.5 * e)) / S;
      ppFx14Glow(g, cx + b.ox / S, cy + b.oy / S, r, r, C.schein, 1 - e, 1.1);
    }
  }
}, 1400, (p) => {
  // Die Leinwand reicht vom oberen Fensterrand (Blitze beginnen 900 px über dem Ziel) bis unter den Einschlag.
  const v = ppR1FeldVersatz(p), w = p.w || 80, h = p.h || 110, oben = Math.min(Math.max(p.y - 930, v.dy), p.y - 60), halb = w * 0.45 + 100;
  return { breite: halb * 2, hoehe: p.y - oben + h * 0.35 + 70, ankerX: halb, ankerY: p.y - oben };
}, { z: 10100, vorbereiten: (sz) => sz.props.bolzen });
function ppFx14LightningRain(props) {
  const bolzen = useMemo(() => ppFx14RegenBolzen(props.w || 80, props.h || 110), []);
  useEffect(() => {
    // KEINE Kategorie und dedupe 0 (wie vorher): sonst fielen alle Einschläge innerhalb von 400 ms auf einen Klang zusammen.
    const timers = bolzen.map(b => setTimeout(() => { if (window.playSFX) window.playSFX('elem_lightning', { rate: b.rate, volume: 0.75, dedupe: 0 }); }, b.delay + 40));
    return () => timers.forEach(clearTimeout);
  }, []);
  const Bild = ppFx14RegenBild;
  return <Bild {...props} bolzen={bolzen} />;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Nebelschleier (`mist_veil`, Chasing the Legend / Stealthy Pursuit) — PIXELART. Vierzehn weiße Schwaden quellen rund um die Karte auf (Verzug 0–500 ms, 900–1500 ms lang, nie über die
//  Aufrufer-Dauer hinaus): wachsen .4 → 1,6, driften und steigen, Deckung 0 → .9 (30 %) → 0. Je Schwade eine gedithert Ellipse (zwei Weißtöne), kein Weichzeichner.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX14_NEBEL = ['#e5edfa', '#e5f5fa', '#ffffff'].map(ppHex);
const ppFx14Nebel = ppFx14Dauer((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const m of te.schwaden) {
    const u = (t - m.delay) / m.dur;
    if (u < 0 || u > 1) continue;
    const e = PP_FX14_E.aus(u), sc = 0.4 + 1.2 * e;
    const a = u < 0.3 ? 0.9 * PP_FX14_E.aus(u / 0.3) : 0.9 * (1 - PP_FX14_E.aus((u - 0.3) / 0.7));
    if (a < 0.04) continue;
    const mx = m.xOff - 20 + m.size / 2 + m.drift * e, my = m.yOff - 12 + m.size * 0.3 + m.rise * e;
    ppFx14Glow(g, cx + mx / S, cy + my / S, (m.size * sc) / 2 / S, (m.size * 0.6 * sc) / 2 / S, PP_FX14_NEBEL, a, 0.8);
  }
}, 1400, (p) => {
  const w = p.w || 80, h = p.h || 110, hx = w * 0.7 + 110, hy = h * 0.6 + 110;
  return { breite: hx * 2, hoehe: hy * 2 };
}, {
  z: 10099,
  vorbereiten: (sz) => {
    const D = sz.props.duration || 1400, w = sz.props.w || 80, h = sz.props.h || 110;
    return {
      schwaden: Array.from({ length: ppFxN(14) }, () => {
        const delay = Math.random() * 500, dur = 900 + Math.random() * 600;
        return { xOff: (Math.random() - 0.5) * w * 1.4, yOff: (Math.random() - 0.5) * h * 1.2, size: 30 + Math.random() * 40, drift: (Math.random() - 0.5) * 40, rise: -10 - Math.random() * 25, delay, dur: Math.max(250, Math.min(dur, D - delay)) };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Schutzring der Monkee (`monkee_shield`, Resilient Monkee) — PIXELART. Goldener Ring pulst in 900 ms auf (Größe .55 → 1,08 → .98 → 1,25, Deckung 0 → 1 → .85 → 0), innen ein gedithert Band und
//  außen ein dünner Rand statt der Leuchtschatten; in der Mitte ein Pixel-Schild (statt 🛡️), der aufpoppt, steht und nach oben ausblendet.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX14_SCHILD = [
  'ooooooooooo', 'ogggggggggo', 'ogbbbgbbbgo', 'ogbwbgbbbgo', 'ogbbbgbbbgo', 'ogggggggggo', 'ogbbbgbbbgo', 'ogbbbgbbbgo',
  '.ogbbgbbgo.', '.ogbbgbbgo.', '..ogbgbgo..', '...ogggo...', '....ooo....',
];
const PP_FX14_SCHILD_PAL = ppFx14Pal({ o: '#8b5b04', g: '#fad54a', b: '#4e82cb', w: '#b4dff8' });
const PP_FX14_GOLDRING = { rand: ppHex('#ffd066'), innen: ppHex('#fbe181'), aussen: ppHex('#f9ac20') };
const ppFx14Monkee = ppR1Leinwand((g, t, sz) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, u = t / 900, C = PP_FX14_GOLDRING;
  if (u > 1) return;
  const sc = ppFx14Kf(u, [[0, 0.55], [0.28, 1.08], [0.6, 0.98], [1, 1.25]], PP_FX14_E.aus), a = ppFx14Kf(u, [[0, 0], [0.28, 1], [0.6, 0.85], [1, 0]], PP_FX14_E.aus);
  const r = (46 * sc) / S;
  if (a > 0.04) {
    g.ring(cx, cy, r - 5, r - 1, C.innen, a * 0.3);       // innerer Schein als Dither-Band
    g.ring(cx, cy, r, r + 2, C.aussen, a * 0.35);         // äußerer Schein als schmaler Rand
    g.ring(cx, cy, r - 1, r, C.rand, a);                  // der Ring selbst (3 px = 1 Rasterpixel)
  }
  const ia = ppFx14Kf(u, [[0, 0], [0.3, 1], [0.7, 1], [1, 0]], PP_FX14_E.aus);
  if (ia > 0.04) {
    const dy = ppFx14Kf(u, [[0, 6], [0.3, 0], [0.7, 0], [1, -10]], PP_FX14_E.aus);
    g.spr(PP_FX14_SCHILD, PP_FX14_SCHILD_PAL, cx, cy + (dy - 2) / S, ia);
  }
}, 900, { breite: 150, hoehe: 150 }, { z: 10100 });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Treue-Vögel (`loyalty_birds`, Trial of Loyalty; verankert an der geholten Handkarte) — PIXELART. Vierzehn Teilchen (zwei Vögel je Herzchen) steigen ab der Kartenmitte auf: Verzug 0–320 ms,
//  620–1140 ms lang (nie über die Aufrufer-Dauer), Deckung 0 → 1 (20 %) → 0, Anstieg 10 px, dann bis 100 px; Vögel schlagen mit den Flügeln (zwei Bilder). Hinter allem ein weißer Lichtblitz (500 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX14_VOGEL = {
  klein: [['W.....W', 'WW...WW', '.WW.WW.', '..WWW..', '...W...'], ['...W...', '..WWW..', '.WWWWW.', 'WW.W.WW', 'W..W..W']],
  gross: [['W.......W', 'WW.....WW', '.WWW.WWW.', '..WWWWW..', '...WWW...', '....W....'], ['....W....', '..WWWWW..', '.WWWWWWW.', 'WWW.W.WWW', 'WW..W..WW', 'W...W...W']],
};
const PP_FX14_VOGEL_FARBE = [ppFx14Pal({ W: '#ffffff' }), ppFx14Pal({ W: '#b4dff8' })];
const PP_FX14_HERZ = {
  klein: ['.W.W.', 'WWWWW', 'WWWWW', '.WWW.', '..W..'],
  gross: ['.oo.oo.', 'oWWoWWo', 'oWWWWWo', '.oWWWo.', '..oWo..', '...o...'],
};
const PP_FX14_HERZ_PAL = ppFx14Pal({ W: '#ffffff', o: '#9aa3b6' });
const PP_FX14_LICHT = ['#e5edfa', '#ffffff'].map(ppHex);
const ppFx14Voegel = ppFx14Dauer((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const fu = t / 500;
  if (fu >= 0 && fu <= 1) {
    const e = PP_FX14_E.aus(fu), sc = 0.3 + 1.3 * e, a = fu < 0.5 ? 1 - 0.4 * (fu / 0.5) : 0.6 * (1 - (fu - 0.5) / 0.5);
    ppFx14Glow(g, cx, cy, (20 * sc) / S, (20 * sc) / S, PP_FX14_LICHT, a * 0.55, 1.1);
  }
  for (const p of te.teile) {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) continue;
    const a = ppFx14Kf(u, [[0, 0], [0.2, 1], [1, 0]], PP_FX14_E.aus), sc = ppFx14Kf(u, [[0, 0.3], [0.2, 1], [1, 0.2]], PP_FX14_E.aus);
    if (a < 0.04) continue;
    const dy = ppFx14Kf(u, [[0, 0], [0.2, -10], [1, -100]], PP_FX14_E.aus);
    const x = cx + (p.xOff + p.size / 2) / S, y = cy + (8 + p.size / 2 + dy) / S;
    if (sc < 0.55) { g.put(x, y, PP_FX14_HERZ_PAL.W, a); continue; }                                        // winzig: nur ein Punkt
    if (p.art === 'herz') g.spr(p.size < 14 ? PP_FX14_HERZ.klein : PP_FX14_HERZ.gross, PP_FX14_HERZ_PAL, x, y, a);
    else g.spr(PP_FX14_VOGEL[p.size < 17 ? 'klein' : 'gross'][Math.floor((t + p.flug) / 110) % 2], PP_FX14_VOGEL_FARBE[p.farbe], x, y, a);
  }
}, 1000, { breite: 260, hoehe: 230, ankerX: 130, ankerY: 165 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const D = sz.props.duration || 1000;
    return {
      teile: Array.from({ length: ppFxN(14) }, (_, i) => {
        const delay = Math.random() * 320, dur = 620 + Math.random() * 520, vogel = i % 3 !== 2;
        return { art: vogel ? 'vogel' : 'herz', farbe: Math.random() < 0.5 ? 0 : 1, flug: Math.random() * 220, xOff: -60 + Math.random() * 120, delay, dur: Math.max(300, Math.min(dur, D - delay - 20)), size: vogel ? 13 + Math.random() * 9 : 10 + Math.random() * 8 };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Hammerschlag (`magic_hammer`; Magic Hammer, Hammer Skeleton, Heavy Hit) — PIXELART. Ein Stahlhammer (55 × 80 px) fällt von 320 px über der Kartenoberkante in 340 ms auf die Zone, staucht sich beim Aufschlag
//  (38 %: Höhe .7, Breite 1,1), federt zurück, hält bis 64 % und fährt (ausblendend) wieder hoch. Aufschlagblitz (ab 330 ms, 450 ms: Dither-Ellipse wächst .3 → 2 × 1,3) und 14 Funken (ab 320–400 ms).
//  UNVERÄNDERT: die Zielzone wird nach 330 ms gequetscht (`ppZonenSquash`, Klasse `magic-hammer-squashed`, 650 ms) — das Zonen-Element kommt direkt aus `playAnimation` (`zoneEl`); die Lage der Zonen
//  wird beim Einhängen gemerkt (`ppZonenFrost`), damit eine Kamerafahrt vor dem Einschlag das Ziel nicht verschiebt. Aufschlag und Squash fallen wie vorher auf 330–340 ms.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX14_STAHL = ['#e6e6e6', '#b9b9b9', '#a8a8a8', '#7f7f7f', '#686868', '#535353', '#323232'].map(ppHex);
const PP_FX14_HAMMER = { blitz: ['#f9ecb3', '#fffbd2', '#ffffff'].map(ppHex), funken: ['#d2d2db', '#ffffff', '#a8a8a8', '#f0f075', '#f7f7ad'].map(ppHex) };
/** Hammerkopf wR × hR Rasterpixel, Mitte (cx, cy): Rand dunkel, oben eine helle Kante, Flächen in Stahlstufen von hell nach dunkel, links ein Licht-, rechts ein Schattenstreifen. */
function ppFx14Hammerkopf(g, cx, cy, wR, hR, a) {
  const x0 = Math.round(cx - wR / 2), y0 = Math.round(cy - hR / 2), S = PP_FX14_STAHL;
  for (let j = 0; j < hR; j++) {
    const f = j / hR, idx = f < 0.06 ? 0 : f < 0.18 ? 1 : f < 0.32 ? 2 : f < 0.52 ? 3 : f < 0.72 ? 4 : 5;
    for (let i = 0; i < wR; i++) {
      let k = idx;
      if (j === 0 || j === hR - 1 || i === 0 || i === wR - 1) k = 5;
      else if (j === 1) k = 0;
      else if (i === 1) k = Math.max(0, idx - 1);
      else if (i === wR - 2) k = Math.min(6, idx + 1);
      g.put(x0 + i, y0 + j, S[k], a);
    }
  }
}
const ppFx14Hammer = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX14_HAMMER, u = t / 1000, th = te.th;
  // Funken (unter dem Hammer)
  for (const s of te.funken) {
    const k = (t - s.delay) / s.dur;
    if (k < 0 || k > 1) continue;
    const e = PP_FX14_E.aus(k), a = k < 0.2 ? 1 : 1 - PP_FX14_E.aus((k - 0.2) / 0.8), px = s.size * 1.2 * (1 - e);
    if (px < 1.2 || a < 0.04) continue;
    const n = Math.max(1, Math.round(px / S));
    g.block(cx + (s.dx * e) / S - n / 2, cy + (s.dy * e) / S - n / 2, n, n, s.farbe, a);
  }
  // Aufschlagblitz: Ellipse, die breiter als hoch wächst
  const fu = (t - 330) / 450;
  if (fu >= 0 && fu <= 1) {
    const sx = ppFx14Kf(fu, [[0, 0.3], [0.35, 1.4], [1, 2]], PP_FX14_E.aus), sy = ppFx14Kf(fu, [[0, 0.3], [0.35, 1], [1, 1.3]], PP_FX14_E.aus), a = ppFx14Kf(fu, [[0, 1], [0.35, 0.85], [1, 0]], PP_FX14_E.aus);
    ppFx14Glow(g, cx, cy, (70 * sx) / S, (25 * sy) / S, C.blitz, a, 1.1);
  }
  // Hammerkopf
  if (u <= 1) {
    const E = PP_FX14_E.hammer;
    const ty = ppFx14Kf(u, [[0, -320], [0.34, 0], [0.38, 4], [0.44, 0], [0.64, 0], [1, -280]], E);
    const sy = ppFx14Kf(u, [[0.34, 1], [0.38, 0.7], [0.44, 1]], E), sx = ppFx14Kf(u, [[0.34, 1], [0.38, 1.1], [0.44, 1]], E);
    const a = ppFx14Kf(u, [[0, 1], [0.64, 1], [1, 0]], E);
    if (a > 0.04) ppFx14Hammerkopf(g, cx, cy + (-th / 2 - 40 + ty) / S, Math.max(4, Math.round((55 * sx) / S)), Math.max(4, Math.round((80 * sy) / S)), a);
  }
}, 1000, (p) => {
  const th = p.h || 90, oben = th / 2 + 80 + 320 + 24;
  return { breite: 340, hoehe: oben + 90, ankerX: 170, ankerY: oben };
}, {
  z: 10100,
  // Zielzone quetschen — wie vorher (Zeitpunkt, Suche, Schwelle, Klasse, Dauer).
  wirkung: ({ x, y, zoneEl }) => {
    const frost = ppZonenFrost();   // Lage der Zonen JETZT merken (Kamerafahrt vor dem Einschlag darf das Ziel nicht verschieben)
    const timer = setTimeout(() => {
      const els = document.querySelectorAll('[data-hero-zone],[data-support-zone]');
      let best = null, bestDist = Infinity;
      els.forEach(el => {
        const r = (frost.get(el) || el.getBoundingClientRect());
        const d = Math.abs(r.left + r.width / 2 - x) + Math.abs(r.top + r.height / 2 - y);
        if (d < bestDist) { bestDist = d; best = el; }
      });
      // Das Ziel-Element kommt direkt aus playAnimation: x/y liegen bei Weltverankerung im Welt-Koordinatensystem und passen nach einer Kamerafahrt nicht mehr zu den Bildschirm-Rechtecken
      if (zoneEl && zoneEl.isConnected) { best = zoneEl; bestDist = 0; }
      if (best && bestDist < 80) ppZonenSquash(best, 'magic-hammer-squashed', 650);
    }, 330);
    return () => clearTimeout(timer);
  },
  vorbereiten: (sz) => ({
    th: sz.props.h || 90,
    funken: Array.from({ length: ppFxN(14) }, () => {
      const w = -Math.PI * 0.15 + Math.random() * Math.PI * 1.3, v = 20 + Math.random() * 50;
      return { dx: Math.cos(w) * v, dy: -Math.abs(Math.sin(w) * v) - 5, size: 2 + Math.random() * 4, farbe: ppFx14Wahl(PP_FX14_HAMMER.funken), delay: 320 + Math.random() * 80, dur: 250 + Math.random() * 200 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Mumienbinden (`mummy_wrap`, Mummy Maker Machine) — PIXELART. Zwölf Binden (12–28 px lang, 3–5 px dick) fliegen aus 35 px Abstand zur Mitte, drehen sich und legen sich in 6–26 px Abstand um das Ziel
//  (Verzug i · 30 ms + bis 60, 400–700 ms; Drehung 0 → 180° → 300° → 360° als berechnete Linie, Länge .3 → 1,2 → 1 → .5, Deckung 0 → .9 → .8 → 0). Dazu ein Pixel-Geist (statt 👻), der aufpoppt (.3 → 1,4 → .6)
//  und nach oben ausblendet (600 ms ab 100 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX14_BINDE = ['#ccb799', '#a89370'].map(ppHex);
const PP_FX14_GEIST = {
  klein: ['.WWW.', 'WkWkW', 'WWWWW', 'WWWWw', 'WWWWw', 'W.W.W'],
  mittel: ['..WWWW..', '.WWWWWW.', 'WkkWWkkW', 'WkkWWkkW', 'WWWWWWWw', 'WWWkkWWw', 'WWWWWWWw', 'WW.WW.Ww', 'W..WW..w'],
  gross: ['...WWWWW...', '..WWWWWWW..', '.WWWWWWWWW.', 'WWkkWWWkkWW', 'WWkkWWWkkWW', 'WWkkWWWkkWW', 'WWWWWWWWWWw', 'WWWWkkkWWWw', 'WWWWkkkWWWw', 'WWWWWWWWWWw', 'WWW.WWW.WWw', 'WW..WWW..Ww'],
};
const PP_FX14_GEIST_PAL = ppFx14Pal({ W: '#ffffff', w: '#d2d2db', k: '#323232' });
const ppFx14Mumie = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const E = PP_FX14_E.ein;
  for (const s of te.binden) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const a = ppFx14Kf(u, [[0, 0], [0.4, 0.9], [0.7, 0.8], [1, 0]], E);
    if (a < 0.04) continue;
    const px = ppFx14Kf(u, [[0, s.sx], [0.4, 0], [0.7, s.ex], [1, s.ex]], E), py = ppFx14Kf(u, [[0, s.sy], [0.4, 0], [0.7, s.ey], [1, s.ey]], E);
    const rot = (ppFx14Kf(u, [[0, 0], [0.4, 180], [0.7, 300], [1, 360]], E) * Math.PI) / 180, lang = (s.breite * ppFx14Kf(u, [[0, 0.3], [0.4, 1.2], [0.7, 1], [1, 0.5]], E)) / 2 / S;
    const X = cx + px / S, Y = cy + py / S, dx = Math.cos(rot) * lang, dy = Math.sin(rot) * lang, d = s.hoch >= 4.2 ? 2 : 1;
    g.line(X - dx, Y - dy, X, Y, PP_FX14_BINDE[0], a, d);
    g.line(X, Y, X + dx, Y + dy, PP_FX14_BINDE[1], a, d);
  }
  const gu = (t - 100) / 600;
  if (gu >= 0 && gu <= 1) {
    const a = ppFx14Kf(gu, [[0, 0], [0.4, 1], [1, 0]], PP_FX14_E.aus), sc = ppFx14Kf(gu, [[0, 0.3], [0.4, 1.4], [1, 0.6]], PP_FX14_E.aus), dy = -15 * PP_FX14_E.aus(gu);
    if (a > 0.04) {
      if (sc < 0.55) g.put(cx, cy + dy / S, PP_FX14_GEIST_PAL.W, a);
      else g.spr(sc < 0.9 ? PP_FX14_GEIST.klein : sc < 1.2 ? PP_FX14_GEIST.mittel : PP_FX14_GEIST.gross, PP_FX14_GEIST_PAL, cx, cy + dy / S, a);
    }
  }
}, 1000, { breite: 190, hoehe: 190 }, {
  z: 9999,
  vorbereiten: () => ({
    binden: Array.from({ length: ppFxN(12) }, (_, i) => {
      const winkel = ((i / 12) * 360 + Math.random() * 30) * Math.PI / 180, dist = 6 + Math.random() * 20, delay = i * 30 + Math.random() * 60, dur = 400 + Math.random() * 300;
      return { breite: 12 + Math.random() * 16, hoch: 3 + Math.random() * 2, delay, dur: Math.min(dur, 1000 - delay - 10), sx: Math.cos(winkel) * 35, sy: Math.sin(winkel) * 35, ex: Math.cos(winkel) * dist, ey: Math.sin(winkel) * dist };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Sporenwolke (`mushroom_spore`, Afflicted Vermin / Toxic Trap) — PIXELART. Zwanzig Teilchen stieben vom Ziel nach außen und steigen auf: 65 % grüne Sporenwolken (zwei Grüntöne), 35 % kleine Pixel-Pilze (statt 🍄);
//  Verzug 0–150 ms, 400–700 ms (Wachsen .5 → 1,1 → .9 → .3, Deckung 0 → .9 → .7 → 0, Weg 30 % / 100 % / 120 %).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX14_PILZ = { klein: ['.RR.', 'RwRR', '.ss.', '.ss.'], gross: ['..RRRR..', '.RwRRwR.', 'RRRwRRRR', 'RwRRRRwR', '..ssss..', '..ssss..'] };
const PP_FX14_PILZ_PAL = ppFx14Pal({ R: '#e92f38', w: '#fffbd2', s: '#ebdcc1' });
const PP_FX14_SPORE = [['#3a5a25', '#5b9438'], ['#5b9438', '#80bf59'], ['#2f4e1d', '#5b9438']].map(p => p.map(ppHex));
const ppFx14Spore = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, E = PP_FX14_E.aus;
  for (const p of te.teile) {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) continue;
    const a = ppFx14Kf(u, [[0, 0], [0.25, 0.9], [0.7, 0.7], [1, 0]], E), sc = ppFx14Kf(u, [[0, 0.5], [0.25, 1.1], [0.7, 0.9], [1, 0.3]], E);
    if (a < 0.04) continue;
    const x = ppFx14Kf(u, [[0, 0], [0.25, p.tx * 0.3], [0.7, p.tx], [1, p.tx * 1.2]], E), y = ppFx14Kf(u, [[0, 0], [0.25, p.ty * 0.2], [0.7, p.ty * 0.7], [1, p.ty]], E);
    const X = cx + x / S, Y = cy + y / S;
    if (p.pilz) {
      if (sc < 0.45) g.put(X, Y, PP_FX14_PILZ_PAL.R, a);
      else g.spr(p.size + 2 < 13.5 ? PP_FX14_PILZ.klein : PP_FX14_PILZ.gross, PP_FX14_PILZ_PAL, X, Y, a);
    } else {
      ppFx14Scheibe(g, X, Y, (p.size * sc) / 2 / S, p.farbe[0], p.farbe[1], a * p.deckung);
    }
  }
}, 1000, { breite: 200, hoehe: 200 }, {
  z: 9999,
  vorbereiten: () => ({
    teile: Array.from({ length: ppFxN(20) }, () => {
      const w = Math.random() * Math.PI * 2, dist = 8 + Math.random() * 28, drift = -15 - Math.random() * 25, pilz = Math.random() < 0.35;
      return { tx: Math.cos(w) * dist, ty: Math.sin(w) * dist + drift, size: 5 + Math.random() * 8, delay: Math.random() * 150, dur: 400 + Math.random() * 300, pilz, farbe: ppFx14Wahl(PP_FX14_SPORE), deckung: 0.6 + Math.random() * 0.3 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Heulen in der Nacht (`night_howl`, Howling in the Night) — PIXELART, FENSTERFÜLLEND (`zoneType: 'board'`, Dauer 1600 ms; Mitte/Größe der Zone werden wie vorher ignoriert). ① Abdunklung (1400 ms, Deckung
//  0 → 1 → .9 → 0): dunkler Tonwert mit Vignette (innen .55, ab 85 % des Radius .92), gedithert und mit Farbwechsel zwischen den zwei Nachttönen; ② drei Verzerrungsschlieren (violette Bänder, 1200 ms ab
//  140 + 130 · i ms, verschieben, kippen und strecken sich); ③ sieben Augenpaare im Dunkeln (gelb, 420–740 ms ab 120–540 ms). Das Vollbild schreibt direkt in den Bildpuffer (`ppFx2Leinwand`).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX14_NACHT = { dunkel: ['#12101f', '#08060c'].map(ppHex), schliere: ppHex('#ac87de'), auge: ppHex('#ffd066'), augeHell: ppHex('#fff196'), augeRand: ppHex('#a87c00') };
const ppFx14NachtHeulen = ppFx2Leinwand((g, t, sz, te, buf) => {
  const S = sz.S, gw = sz.gw, gh = sz.gh, W = te.W, H = te.H, C = PP_FX14_NACHT, EIO = PP_FX14_E.eio;
  const env = ppFx14Kf(t / 1400, [[0, 0], [0.25, 1], [0.7, 0.9], [1, 0]], EIO), b32 = te.b32 || (te.b32 = new Uint32Array(buf.buffer, buf.byteOffset, buf.length >> 2)), bay = te.bay, ps = te.schliere;
  if (env > 0.003) {
    // Schnell: je Pixel ein 32-Bit-Wort (RGBA, Little-Endian) statt vier Byte-Schreibzugriffe
    const need = te.noetig, col = te.farbe;
    for (let i = 0, n = gw * gh; i < n; i++) if (env > need[i]) b32[i] = col[i];
  }
  // Verzerrungsschlieren: horizontaler Verlauf (Dreieck), gedithert; Versatz, Kippen und Strecken in Bildschirmpixeln, gerundet auf Rasterpixel
  for (let b = 0; b < 3; b++) {
    const k = (t - (140 + b * 130)) / 1200;
    if (k < 0 || k > 1) continue;
    const tx = ppFx14Kf(k, [[0, -0.08], [0.35, 0.04], [0.7, -0.03], [1, 0.06]], EIO) * 1.4 * W, tg = Math.tan((ppFx14Kf(k, [[0, 0], [0.35, -2.5], [0.7, 2], [1, 0]], EIO) * Math.PI) / 180);
    const sy = ppFx14Kf(k, [[0, 1], [0.35, 1.6], [0.7, 0.7], [1, 1]], EIO), op = ppFx14Kf(k, [[0, 0], [0.35, 1], [0.7, 0.8], [1, 0]], EIO);
    const mx = W / 2 + tx, my = (0.18 + b * 0.28 + 0.07) * H, hh = 0.07 * H * sy, halb = 0.7 * W;
    for (let X = 0; X < gw; X++) {
      const rel = (X + 0.5) * S - mx, tri = 1 - Math.abs(rel) / halb;
      if (tri <= 0) continue;
      const a0 = 0.34 * op * tri;                                   // .22 im Original; die Bayer-Stufen sind grob — etwas kräftiger, damit das Band lesbar bleibt
      if (a0 < 0.032) continue;
      const yc = my + rel * tg, Y0 = Math.max(0, Math.floor((yc - hh) / S)), Y1 = Math.min(gh - 1, Math.ceil((yc + hh) / S));
      for (let Y = Y0; Y <= Y1; Y++) {                              // direkt in den Puffer (Bayer-Schwelle aus der 4×4-Tabelle) — g.put wäre hier zehntausende Aufrufe je Bild
        if (bay[((Y & 3) << 2) | (X & 3)] < (Math.abs((Y + 0.5) * S - yc) < hh * 0.6 ? a0 : a0 * 0.5)) b32[Y * gw + X] = ps;
      }
    }
  }
  // Augenpaare
  for (const a of te.augen) {
    const k = (t - a.start) / a.dauer;
    if (k < 0 || k > 1) continue;
    const op = ppFx14Kf(k, [[0, 0], [0.3, 1], [0.75, 1], [1, 0]], EIO), sc = ppFx14Kf(k, [[0, 0.7], [0.3, 1], [1, 0.85]], EIO);
    if (op < 0.04) continue;
    const mx = ((a.x / 100) * W + a.g * 1.4) / S, my = ((a.y / 100) * H + a.g * 0.25) / S, rx = Math.max(1.4, (a.g * 0.5 * sc) / S), ry = Math.max(0.9, (a.g * 0.25 * sc) / S), ab = (a.g * 0.9 * sc) / S;
    for (const sg of [-1, 1]) {
      g.ell(mx + sg * ab, my, rx + 1.5, ry + 1.5, C.augeRand, op * 0.4);     // Schein als gedithert Rand
      g.ell(mx + sg * ab, my, rx, ry, C.auge, op);
      g.put(mx + sg * ab - 1, my - 1, C.augeHell, op);
    }
  }
}, 1600, ppFx2Voll, {
  z: 10050,
  vorbereiten: (sz) => {
    const gw = sz.gw, gh = sz.gh, S = sz.S, W = window.innerWidth || gw * S, H = window.innerHeight || gh * S;
    // Vignette: Kreis um (50 %, 45 %), Radius bis zur fernsten Ecke; Deckung .55 (Mitte) → .92 (ab 85 %). Je Rasterpixel die Deckungsschwelle `need` (Bayer ÷ Deckung): das Pixel ist an, sobald die Hülle sie übersteigt.
    const mx = W * 0.5, my = H * 0.45, R = Math.hypot(Math.max(mx, W - mx), Math.max(my, H - my));
    const pack = (c) => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0, PA = pack(PP_FX14_NACHT.dunkel[0]), PB = pack(PP_FX14_NACHT.dunkel[1]);
    const noetig = new Float32Array(gw * gh), farbe = new Uint32Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      const dy = (j + 0.5) * S - my, dy2 = dy * dy;
      for (let i = 0; i < gw; i++) {
        const dx = (i + 0.5) * S - mx, r = Math.min(1, Math.sqrt(dx * dx + dy2) / R / 0.85), idx = j * gw + i;
        noetig[idx] = ppBayer(i, j) / (0.55 + 0.37 * r);
        farbe[idx] = r > ppBayer(i + 1, j + 2) ? PB : PA;
      }
    }
    const bay = new Float32Array(16);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) bay[(j << 2) | i] = ppBayer(i, j);
    return {
      W, H, noetig, farbe, bay, schliere: pack(PP_FX14_NACHT.schliere),
      augen: Array.from({ length: ppFxN(7) }, () => ({ x: 8 + Math.random() * 84, y: 12 + Math.random() * 70, start: 120 + Math.random() * 420, dauer: 420 + Math.random() * 320, g: 7 + Math.random() * 9 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Orbitallaser, rot (`orbital_laser_red`, Siphem / Blood Moon under the Sea) — PIXELART. Strahl von 20 px unter dem oberen Fensterrand bis 40 px unter die Zielmitte, Ladekugel bei 24 px:
//  ① Ladekugel oben (260 ms: .3 → 1,25 → 1) ② Strahl ab 260 ms, 520 ms: wächst in 25 % von oben nach unten, Kern 10 px (Rosa → Rot → Dunkelrot) mit breitem Dither-Rand (44 px), blendet aus ③ Einschlagblitz ab 540 ms
//  (Dither-Scheibe .35 → 1,2 → 1,55 → 1,9; hier in 460 statt 580 ms, damit er vor dem Ende der Standard-Dauer 1000 ms verglüht) ④ 14 Glutfunken ab 260–400 ms. Die Ladekugel blendet mit dem Strahl aus.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX14_LASER = {
  kern: ['#f9b3b3', '#fe7476', '#e92f38', '#c0141c', '#8c0014'].map(ppHex),
  rand: ['#fe5154', '#c0141c', '#5b0102'].map(ppHex),
  kugel: { schein: ppHex('#c0141c'), rand: ppHex('#780014'), mitte: ppHex('#f03232'), licht: ppHex('#f0bfbc') },
  blitz: ['#c0141c', '#fe5154', '#fae5eb', '#ffffff'].map(ppHex),
  funken: [ppHex('#fae5eb'), ppHex('#f03232'), ppHex('#f03232')],
};
const ppFx14Laser = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX14_LASER, E = PP_FX14_E.aus;
  // Strahl (Leinwandkoordinaten: Reihe = Höhe ab Fensterrand / 3)
  const bu = (t - 260) / 520;
  let strahlEnde = 0;
  if (bu >= 0 && bu <= 1) {
    const L = te.boden - 20, frac = bu < 0.25 ? PP_FX14_E.laser(bu / 0.25) : 1;
    const op = ppFx14Kf(bu, [[0, 0], [0.25, 1], [0.75, 0.95], [1, 0]], PP_FX14_E.laser);
    strahlEnde = op;
    if (op > 0.04) {
      const y0 = Math.round(20 / S), y1 = Math.round((20 + L * frac) / S);
      for (let Y = y0; Y < y1; Y++) {
        const f = (Y * S - 20) / L, ki = f < 0.1 ? 0 : f < 0.3 ? 1 : f < 0.6 ? 2 : f < 0.85 ? 3 : 4, ri = f < 0.4 ? 0 : f < 0.75 ? 1 : 2;
        g.block(cx - 7, Y, 15, 1, C.rand[ri], op * 0.35);          // breiter Rand (44 px)
        g.block(cx - 4, Y, 9, 1, C.rand[ri], op * 0.35);           // dichterer Rand darin
        g.block(cx - 1, Y, 3, 1, C.kern[ki], op);                  // Kern (10 px)
        g.put(cx, Y, C.kern[Math.max(0, ki - 1)], op);
      }
    }
  }
  // Ladekugel (36 px) bei 24 px: wächst in 260 ms, hält, blendet mit dem Strahl aus
  {
    const ku = t / 260, kr = ((18 * (ku < 1 ? ppFx14Kf(ku, [[0, 0.3], [0.6, 1.25], [1, 1]], E) : 1)) / S), ka = (ku < 1 ? ppFx14Kf(ku, [[0, 0], [0.6, 1], [1, 0.95]], E) : 0.95) * (t > 780 ? ppR1Aus(t, 780, 900) : 1);
    if (ka > 0.04) {
      const ky = 24 / S;
      g.disc(cx, ky, kr + 2, C.kugel.schein, ka * 0.4);
      g.disc(cx, ky, kr, C.kugel.rand, ka);
      g.disc(cx, ky, kr * 0.75, C.kugel.mitte, ka);
      g.disc(cx - kr * 0.25, ky - kr * 0.25, Math.max(1, kr * 0.3), C.kugel.licht, ka);
    }
  }
  // Einschlagblitz
  const iu = (t - 540) / 460;
  if (iu >= 0 && iu <= 1) {
    const sc = ppFx14Kf(iu, [[0, 0.35], [0.25, 1.2], [0.6, 1.55], [1, 1.9]], E), a = ppFx14Kf(iu, [[0, 0], [0.25, 1], [0.6, 0.75], [1, 0]], E);
    if (a > 0.04) ppFx14Glow(g, cx, cy, (55 * sc) / S, (55 * sc) / S, C.blitz, a, 1.2);
  }
  // Glutfunken
  for (const s of te.funken) {
    const k = (t - s.delay) / s.dur;
    if (k < 0 || k > 1) continue;
    const e = E(k), a = k < 0.25 ? E(k / 0.25) : 1 - E((k - 0.25) / 0.75), px = s.size * (1 - 0.8 * e);
    if (a < 0.04) continue;
    const n = Math.max(1, Math.round(px / S));
    g.block(cx + (Math.cos(s.winkel) * s.dist * e) / S - n / 2, cy + (Math.sin(s.winkel) * s.dist * e) / S - n / 2, n, n, s.farbe, a);
  }
}, 1000, (p) => { const dy = ppR1FeldVersatz(p).dy; return { breite: 290, hoehe: Math.max(p.y - dy + 40, 180) + 120, ankerX: 145, ankerY: p.y - dy }; }, {   // Leinwand beginnt am oberen Fensterrand (Ebenenhöhe = Scrollstand), dort fängt der Strahl an
  z: 10100,
  vorbereiten: (sz) => ({
    boden: Math.max(sz.props.y - ppR1FeldVersatz(sz.props).dy + 40, 180),
    funken: Array.from({ length: ppFxN(14) }, (_, i) => {
      const delay = 260 + Math.random() * 140, dur = 420 + Math.random() * 240;
      return { winkel: Math.random() * Math.PI * 2, dist: 40 + Math.random() * 80, delay, dur: Math.min(dur, 990 - delay), size: 3 + Math.random() * 5, farbe: PP_FX14_LASER.funken[i % 3] };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Überheil-Schock (`overheal_shock_equip`, Overheal Shock) — PIXELART. 28 Teilchen im 80-px-Feld um das Ziel: sechs Pixel-Schädel (statt 💀) und 22 Kügelchen (grün/violett, zwei Töne), die nach außen stieben
//  und aufwärts driften (Verzug 0–400 ms, 600–1100 ms; Wachsen .5 → 1,2 → 0, Deckung 0 → 1 (30 %) → 0, Weg 30 % / 100 %).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX14_SCHAEDEL = ['.WWWWW.', 'WWWWWWW', 'WkkWkkW', 'WkkWkkW', 'WWWkWWW', '.WWWWWw', '..W.W.w'];
const PP_FX14_SCHAEDEL_PAL = ppFx14Pal({ W: '#e6e6e6', w: '#a8a8a8', k: '#323232' });
const PP_FX14_KUGEL = [['#75f091', '#4ceb70'], ['#b866ff', '#9544d5']].map(p => p.map(ppHex));
const ppFx14Ueberheil = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, E = PP_FX14_E.aus;
  for (const p of te.teile) {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) continue;
    const a = ppFx14Kf(u, [[0, 0], [0.3, 1], [1, 0]], E), sc = ppFx14Kf(u, [[0, 0.5], [0.3, 1.2], [1, 0]], E);
    if (a < 0.04) continue;
    const m = ppFx14Kf(u, [[0, 0], [0.3, 0.3], [1, 1]], E), X = cx + (p.x + p.tx * m) / S, Y = cy + (p.y + p.ty * m) / S;
    if (p.schaedel) {
      if (sc < 0.5) g.put(X, Y, PP_FX14_SCHAEDEL_PAL.W, a);
      else g.spr(PP_FX14_SCHAEDEL, PP_FX14_SCHAEDEL_PAL, X, Y, a);
    } else {
      ppFx14Scheibe(g, X, Y, (p.size * sc) / 2 / S + 0.2, p.farbe[1], p.farbe[0], a);
    }
  }
}, 1100, { breite: 270, hoehe: 270 }, {
  z: 9999,
  vorbereiten: () => ({
    teile: Array.from({ length: ppFxN(28) }, (_, i) => {
      const w = Math.random() * Math.PI * 2, dist = 15 + Math.random() * 40, farbe = PP_FX14_KUGEL[Math.random() < 0.5 ? 0 : 1];
      return { schaedel: i < 6, x: -40 + Math.random() * 80 + (i < 6 ? 8 : 0), y: -40 + Math.random() * 80 + (i < 6 ? 8 : 0), size: 5 + Math.random() * 9, delay: Math.random() * 400, dur: 600 + Math.random() * 500, tx: Math.cos(w) * dist, ty: Math.sin(w) * dist - 15, farbe };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Versteinerung (`petrify`, Medusa's Curse / Gorinthian War Counselor / Petrifying Potion) — PIXELART. ① grüner Medusa-Puls über der Zone (500 ms: Dither-Ellipse, Deckung 0 → 1 → 0) ② Steinschicht über
//  der ganzen Zone (ab 150 ms, 600 ms: wächst auf .85; Verlauf Hellgrau → Dunkelgrau → Grau, dunkler Rand), gedithert statt Multiplikation ③ Körnung (22 Pünktchen, ab 200 ms) ④ zehn Steinsplitter fallen
//  ab 500–900 ms nach unten. Die Steinschicht blendet in den letzten 170 ms der Dauer gedithert aus (vorher sprang sie hart weg).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX14_STEIN = { grau: ['#323232', '#535353', '#686868', '#7f7f7f', '#929292'].map(ppHex), gruen: ['#2ca058', '#4bcd7c'].map(ppHex), splitter: ['#7f7f7f', '#929292', '#686868', '#a8a8a8'].map(ppHex), koerner: ['#535353', '#686868', '#323232', '#7f7f7f'].map(ppHex) };
/** Helligkeit des Steinverlaufs (135°: Hellgrau 146 → Dunkelgrau 83 bei 45 % → 127 bei 80 % → 83) als Index in `PP_FX14_STEIN.grau` ([323232, 535353, 686868, 7f7f7f, 929292]). */
function ppFx14SteinTon(s) {
  const v = s < 0.45 ? 146 + (83 - 146) * (s / 0.45) : s < 0.8 ? 83 + (127 - 83) * ((s - 0.45) / 0.35) : 127 + (83 - 127) * ((s - 0.8) / 0.2);
  return v > 136 ? 4 : v > 115 ? 3 : v > 94 ? 2 : 1;
}
const ppFx14Stein = ppFx14Dauer((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX14_STEIN, D = te.D, aus = ppR1Aus(t, D - 170, D), hw = te.hw, hh = te.hh;
  // ① Medusa-Puls: Ellipse über Zone + 8 px Rand, auf das Rechteck zugeschnitten
  const pu = t / 500;
  if (pu >= 0 && pu <= 1) {
    const a = ppFx14Kf(pu, [[0, 0], [0.4, 1], [1, 0]], PP_FX14_E.aus);
    if (a > 0.04) ppFx14Glow(g, cx, cy, ((te.cw + 16) / 2) * 1.2 / S, ((te.ch + 16) / 2) * 1.2 / S, C.gruen, a * 0.7, 1, Math.ceil((te.cw + 16) / 2 / S), Math.ceil((te.ch + 16) / 2 / S));
  }
  // ② Steinschicht
  const su = (t - 150) / 600, se = su <= 0 ? 0 : su >= 1 ? 0.85 : ppFx14Kf(su, [[0, 0], [0.6, 1], [1, 0.85]], PP_FX14_E.aus);
  if (se > 0.02 && aus > 0.02) {
    const a = 0.8 * se * aus, ox = Math.round(cx - hw), oy = Math.round(cy - hh), w = te.wR, h = te.hR;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;                       // runde Ecken
        const rand = Math.min(i, w - 1 - i, j, h - 1 - j), unten = h - 1 - j;
        let c = C.grau[te.ton[j * w + i]], aa = a;
        if (rand === 0) { c = C.grau[0]; aa = a * 0.9; }                                           // innerer Schatten: dunkler Rand
        else if (rand === 1 || unten <= 2) { c = C.grau[1]; aa = a * 0.7; }
        g.put(ox + i, oy + j, c, aa);
      }
    }
    // ③ Körnung (Behälter erscheint 50 ms nach der Schicht)
    const ka = (t < 200 ? 0 : ppFx14Kf((t - 200) / 600, [[0, 0], [0.6, 1], [1, 0.85]], PP_FX14_E.aus)) * aus;
    if (ka > 0.02) for (const k of te.koerner) g.block(cx + k.x / S, cy + k.y / S, k.n, 1, k.farbe, k.deckung * ka);
  }
  // ④ Splitter: fallen, beschleunigen, blenden aus
  for (const c of te.splitter) {
    const u = (t - c.delay) / c.dur;
    if (u < 0 || u > 1) continue;
    const e = PP_FX14_E.ein(u), a = ppFx14Kf(u, [[0, 0], [0.2, 1], [1, 0]], PP_FX14_E.ein);
    if (a < 0.04) continue;
    g.block(cx + (c.sx + c.dx * e) / S, cy + (c.sy + c.dy * e) / S, c.n, 1, c.farbe, a);
    if (c.n > 1) g.put(cx + (c.sx + c.dx * e) / S, cy + (c.sy + c.dy * e) / S + 1, c.farbe, a * 0.6);
  }
}, 1000, (p) => ({ breite: (p.w || 100) + 160, hoehe: (p.h || 140) + 200, ankerY: ((p.h || 140) + 200) / 2 - 30 }), {
  z: 10100,
  vorbereiten: (sz) => {
    const S = sz.S, p = sz.props, cw = p.w || 100, ch = p.h || 140, D = Math.min(p.duration || 1000, 1000), wR = Math.max(3, Math.round(cw / S)), hR = Math.max(3, Math.round(ch / S));
    const ton = new Uint8Array(wR * hR);
    for (let j = 0; j < hR; j++) for (let i = 0; i < wR; i++) ton[j * wR + i] = ppFx14SteinTon((i / wR + j / hR) / 2);
    return {
      D, cw, ch, wR, hR, ton, hw: wR / 2, hh: hR / 2,
      koerner: Array.from({ length: ppFxN(22) }, () => { const size = 1 + Math.random() * 2.5; return { x: -cw / 2 + Math.random() * cw, y: -ch / 2 + Math.random() * ch, n: size > 2.6 ? 2 : 1, farbe: ppFx14Wahl(PP_FX14_STEIN.koerner), deckung: 0.45 + Math.random() * 0.35 }; }),
      splitter: Array.from({ length: ppFxN(10) }, () => {
        const w = Math.PI / 2 + (Math.random() - 0.5) * 1.6, v = 12 + Math.random() * 22, delay = 500 + Math.random() * 400, dur = 500 + Math.random() * 300, size = 3 + Math.random() * 4;
        return { sx: -cw / 2 + Math.random() * cw, sy: -ch / 2 + Math.random() * ch, dx: Math.cos(w) * v, dy: Math.sin(w) * v + 20, n: Math.max(1, Math.round(size / S)), farbe: ppFx14Wahl(PP_FX14_STEIN.splitter), delay, dur: Math.max(120, Math.min(dur, D - delay - 5)) };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Piranha-Bisse (`piranha_bites`, 500 Piranhas in a Monster Suit) — PIXELART. 22 kleine rote Bissmale (Halbellipse, Wölbung oben, Rot in drei Stufen) poppen zufällig über der Zone auf (Verzug i · 28 ms + bis 60, 280–460 ms:
//  Größe .3 → 1,15 → 1,4, Deckung 0 → 1 → 0); bei den ersten acht blitzt zusätzlich ein weißer Zahn (260 ms, ab +60 ms). Wie vorher stehen die Bissmale aufrecht (die Drehung war in der DOM-Fassung wirkungslos).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX14_BISS = ['#ff1a1a', '#be0e0e', '#520a0c'].map(ppHex), PP_FX14_ZAHN = ppHex('#ffffff');
/** Biss: Halbellipse (Wölbung oben) w Rasterpixel breit, 55 % so hoch; Zeilen oben hell, mittig rot, unten dunkel. */
function ppFx14Biss(g, cx, cy, w, a) {
  w = Math.max(1, Math.round(w));
  const h = Math.max(1, Math.round(w * 0.55)), y0 = Math.round(cy - h / 2);
  for (let j = 0; j < h; j++) {
    const abstand = (h - 1 - j + 0.5) / h, breit = Math.max(1, Math.round(w * Math.sqrt(Math.max(0, 1 - abstand * abstand))));
    g.block(Math.round(cx - breit / 2), y0 + j, breit, 1, h === 1 ? PP_FX14_BISS[1] : j === 0 ? PP_FX14_BISS[0] : j === h - 1 ? PP_FX14_BISS[2] : PP_FX14_BISS[1], a);
  }
}
const ppFx14Piranha = ppFx14Dauer((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, E = PP_FX14_E.aus;
  te.bisse.forEach((b, i) => {
    const u = (t - b.delay) / b.dur;
    if (u >= 0 && u <= 1) {
      const a = ppFx14Kf(u, [[0, 0], [0.35, 1], [1, 0]], E), sc = ppFx14Kf(u, [[0, 0.3], [0.35, 1.15], [1, 1.4]], E);
      if (a > 0.04) {
        const w = (b.size * sc) / S;
        if (w < 1) g.put(cx + b.x / S, cy + b.y / S, PP_FX14_BISS[1], a); else ppFx14Biss(g, cx + b.x / S, cy + b.y / S, w, a);
      }
    }
    if (i < 8) {
      const z = (t - b.delay - 60) / 260;
      if (z >= 0 && z <= 1) {
        const a = ppFx14Kf(z, [[0, 0], [0.5, 0.95], [1, 0]], E), sc = ppFx14Kf(z, [[0, 0.4], [0.5, 1.1], [1, 0.6]], E);
        if (a > 0.04) g.block(cx + b.zx / S, cy + b.zy / S - Math.round((6 * sc) / S / 2), 1, Math.max(1, Math.round((6 * sc) / S)), PP_FX14_ZAHN, a);
      }
    }
  });
}, 1000, (p) => ({ breite: (p.w || 110) * 0.84 + 90, hoehe: (p.h || 140) * 0.84 + 90 }), {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 110, ch = sz.props.h || 140, D = sz.props.duration || 1000;
    return {
      bisse: Array.from({ length: ppFxN(22) }, (_, i) => {
        const delay = i * 28 + Math.random() * 60, dur = 280 + Math.random() * 180, x = -cw * 0.42 + Math.random() * cw * 0.84, y = -ch * 0.42 + Math.random() * ch * 0.84;
        return { x, y, zx: x + (Math.random() - 0.5) * 6, zy: y + (Math.random() - 0.5) * 6, size: 5 + Math.random() * 5, delay, dur: Math.max(120, Math.min(dur, D - delay - 5)) };
      }),
    };
  },
});

// ── Registrierung ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
ppFxUeberschreiben('lightning_rain', ppFx14LightningRain);
ppFxUeberschreiben('mist_veil', ppFx14Nebel);
ppFxUeberschreiben('monkee_shield', ppFx14Monkee);
ppFxUeberschreiben('loyalty_birds', ppFx14Voegel);
ppFxUeberschreiben('magic_hammer', ppFx14Hammer);
ppFxUeberschreiben('mummy_wrap', ppFx14Mumie);
ppFxUeberschreiben('mushroom_spore', ppFx14Spore);
ppFxUeberschreiben('night_howl', ppFx14NachtHeulen);
ppFxUeberschreiben('orbital_laser_red', ppFx14Laser);
ppFxUeberschreiben('overheal_shock_equip', ppFx14Ueberheil);
ppFxUeberschreiben('petrify', ppFx14Stein);
ppFxUeberschreiben('piranha_bites', ppFx14Piranha);
