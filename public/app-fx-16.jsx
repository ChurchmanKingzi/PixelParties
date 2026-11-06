// Pixelart-Portierungen (Canvas), Batch 16 (zweite Welle, Schwelle 50 ms): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte: soul_shard_inferno, spiked_club_smash, spooky_ghost, steam_puff, sunglasses_drop, syringe_stab, toxic_fumes_gas, water_splash, water_wave, wind.
// Alle laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s): keine weichen Schatten, Scheine oder Verläufe — Schein/Dunst = Dither-Stufen (`ppFx7Glow`),
// Deckung = Bayer-Raster, Symbole (Flamme, Geist, Brille, Schädel, Keule, Spritze) = kleine Pixelbilder bzw. hart gefüllte Formen. Bewegung rechnet in Bildschirmpixeln und landet auf ganzen Rasterpixeln.
// Lebensdauer: die Zonen-Animationen laufen im Spiel 1000 ms (`onZoneAnim`, kein `duration` vom Server) und werden dann abgeräumt. Die alten DOM-Fassungen planten teils länger (Brille 1800 ms,
// Dunst bis ~1700 ms) und wurden abgeschnitten — hier ist jede Zeitachse auf ≤ 960 ms gestaucht (`ppFx16Fit`), damit der Ablauf zu Ende läuft statt hart abzubrechen.
// Bausteine aus app-fx-7.jsx (nur gelesen): ppFx7Kf (Keyframes), ppFx7Bez (CSS-Kurven), ppFx7Glow (schneller Dither-Schein).

// ── Bausteine (Präfix ppFx16) ───────────────────────────────────────────────────────────────────────────────────────────
const PP_FX16_ENDE = 960;
const ppFx16R = (a, b) => a + Math.random() * (b - a);
const ppFx16Pick = (l) => l[Math.floor(Math.random() * l.length)];
const ppFx16Eo = ppFx7Bez(0, 0, 0.58, 1);            // CSS ease-out
const ppFx16Ei = ppFx7Bez(0.42, 0, 1, 1);            // CSS ease-in
const ppFx16Eio = ppFx7Bez(0.42, 0, 0.58, 1);        // CSS ease-in-out
const ppFx16Fall = ppFx7Bez(0.25, 0, 0.75, 0.35);    // Keule: cubic-bezier(.25, 0, .75, .35)
/** Stauchen: Start und Dauer so skalieren, dass `verzug + dauer` ≤ `ende` bleibt (Reihenfolge und Takt bleiben ähnlich). */
function ppFx16Fit(verzug, dauer, ende) {
  const r = Math.min(1, (ende || PP_FX16_ENDE) / (verzug + dauer));
  return { verzug: verzug * r, dauer: dauer * r };
}
/** Runder Punkt mit Durchmesser `px` (Bildschirmpixel): 1 Rasterpixel, 2×2 oder Scheibe. */
function ppFx16Korn(g, x, y, px, c, a) {
  const d = px / 3;
  if (d < 0.55 || a <= 0.02) return;
  if (d < 1.5) g.put(x, y, c, a);
  else if (d < 2.5) g.block(x - 1, y - 1, 2, 2, c, a);
  else g.disc(x, y, d / 2, c, a);
}
/** Dither-Scheibe in zwei bis vier Stufen (Rand → Mitte), Radius in Rasterpixeln, Deckung `a` gedithert. */
function ppFx16Kugel(g, x, y, r, stufen, a, p) {
  if (r < 0.8 || a <= 0.02) return;
  ppFx7Glow(g, x, y, r, r, stufen, a, p || 1);
}
/** Tastet eine Hülle `anim-flame-flash` ab: Skalierung .3 → 1,5 → 2, Deckung 1 → .7 → 0 (ease-out je Abschnitt). Gibt { sc, al } oder null. */
function ppFx16BlitzKurve(u) {
  if (u < 0 || u > 1) return null;
  return { sc: ppFx7Kf(u, [[0, 0.3], [0.5, 1.5], [1, 2]], ppFx16Eo), al: ppFx7Kf(u, [[0, 1], [0.5, 0.7], [1, 0]], ppFx16Eo) };
}
const ppFx16Hex = (l) => l.map(ppHex);

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Soul Shard Sekhem / Future Tech Bomb (`soul_shard_inferno`) — PIXELART. Feuerschlag, der mit `intensity` (1–8) wächst: Feuerblitz (Dither-Scheibe, 250 ms ab Start), innerer Blitz (120 ms),
//  ab 7 ein weißglühender Kern (60 ms), Flammensplitter, die von außen nach innen zusammenfliegen (Pixelflammen statt 🔥), Funken, ab 3 eine Säule aufsteigender Glut, ab 5 eine zweite
//  Welle (420 ms), ab 6 ein Druckring. Anzahl, Größe und Reichweite skalieren wie vorher; die langen Glutpunkte der Säule sind auf ≤ 960 ms gestaucht.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX16_FEUER = { dunkel: ppHex('#8b0d0d'), rot: ppHex('#ff491a'), orange: ppHex('#ff8b1a'), gelb: ppHex('#fad54a'), gold: ppHex('#ffd066'), hell: ppHex('#fbe181'), creme: ppHex('#f9ecb3'), weiss: ppHex('#fff8e8'), glut: ppHex('#cc2b00'), ring: ppHex('#ff9a1a') };
const PP_FX16_FLAMMENPAL = { o: ppHex('#ff491a'), r: ppHex('#ff8b1a'), Y: ppHex('#fad54a'), W: ppHex('#f9ecb3') };
const PP_FX16_FLAMME = {
  gross: ['...o...', '..oro..', '..orro.', '.orYro.', '.orYYo.', 'orrYYro', 'orYYWYo', 'orYWWYo', '.orYYo.'],
  klein: ['..o..', '.orr.', '.orYo', 'orYYo', 'orYWo', '.ooo.'],
  mini: ['.o.', 'orr', 'oYo', '.o.'],
  stern: ['..Y..', '..Y..', 'YYWYY', '..Y..', '..Y..'],
};
/** Flamme (art 'f'), Stern ('s') oder Punkt ('p') der Höhe `gr` Rasterpixel um (x, y) — Ersatz für 🔥 ✦ ·. */
function ppFx16Flamme(g, x, y, gr, a, art) {
  if (a <= 0.02) return;
  if (art === 'p' || gr < 2) { if (gr >= 1) g.block(x - 0.5, y - 0.5, 1, 1, PP_FX16_FLAMMENPAL.Y, a); return; }
  if (art === 's') g.spr(gr >= 3.5 ? PP_FX16_FLAMME.stern : ['.Y.', 'YWY', '.Y.'], PP_FX16_FLAMMENPAL, x, y, a);
  else g.spr(gr >= 7 ? PP_FX16_FLAMME.gross : gr >= 4.6 ? PP_FX16_FLAMME.klein : PP_FX16_FLAMME.mini, PP_FX16_FLAMMENPAL, x, y, a);
}
const ppFx16SoulShard = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, F = PP_FX16_FEUER, fl = d.flash;
  const blitz = (verzug, dauer, durchm, stufen, a0, p) => {
    const k = ppFx16BlitzKurve((t - verzug) / dauer);
    if (k) ppFx16Kugel(g, cx, cy, durchm / 2 * k.sc / S, stufen, k.al * a0, p);
  };
  blitz(250, 600, fl, [F.dunkel, F.rot, F.orange], 0.95, 1.05);          // äußerer Feuerblitz (CSS-Standardverzug 250 ms)
  blitz(120, 600, d.innen, [F.orange, F.gold, F.hell], 0.95, 1);          // innerer Blitz
  if (d.i >= 7) blitz(60, 500, 50, [F.gold, F.weiss], 1, 1);              // weißglühender Kern
  for (const f of d.flammen) {                                            // Flammensplitter: von außen nach innen
    const u = (t - f.verzug) / f.dauer;
    if (u < 0 || u > 1) continue;
    const e = ppFx16Ei(u), sc = 1.2 - 0.9 * e, a = u < 0.7 ? 1 : 1 - ppFx16Ei((u - 0.7) / 0.3);
    ppFx16Flamme(g, cx + (f.sx * (1 - e) + f.size * 0.5) / S, cy + (f.sy * (1 - e) + f.size * 0.55) / S, f.size * sc * 1.15 / S, a, f.art);
  }
  for (const s of d.funken) {
    const u = (t - s.verzug) / s.dauer;
    if (u < 0 || u > 1) continue;
    const e = ppFx16Eo(u), a = u < 0.2 ? 1 : 1 - ppFx16Eo((u - 0.2) / 0.8);
    ppFx16Korn(g, cx + s.dx * e / S, cy + s.dy * e / S, s.size * 1.2 * (1 - e), s.farbe, a);
  }
  for (const p of d.saeule) {                                             // aufsteigende Glut (holySparkleRise)
    const u = (t - p.verzug) / p.dauer;
    if (u < 0 || u > 1) continue;
    const ty = ppFx7Kf(u, [[0, 0], [0.2, -10], [1, -100]], ppFx16Eo), sc = ppFx7Kf(u, [[0, 0.3], [0.2, 1], [1, 0.2]], ppFx16Eo), a = ppFx7Kf(u, [[0, 0], [0.2, 1], [1, 0]], ppFx16Eo);
    ppFx16Kugel(g, cx + (p.x + p.size / 2) / S, cy + (p.y + p.size / 2 + ty) / S, p.size * sc / 2 / S, [F.glut, F.orange, F.gold], a * 0.95, 0.8);
  }
  if (d.i >= 5) blitz(420, 520, fl * 1.15, [F.glut, F.rot], 0.8, 1.1);   // zweite Welle
  if (d.i >= 6) {                                                         // Druckring
    const u = (t - 80) / 700;
    if (u >= 0 && u <= 1) {
      const e = ppFx16Eo(u), r = fl * 0.8 * e / S, dick = Math.max(1, Math.round((6 - 5 * e) / S * 1.3)), a = 0.9 * (1 - e);
      g.ring(cx, cy, Math.max(0, r - dick), r, F.ring, a);
      g.ring(cx, cy, Math.max(0, r - dick - 3), Math.max(0, r - dick), F.orange, a * 0.3);
    }
  }
}, 1000, (p) => {
  const i = Math.max(1, Math.min(p.intensity || 1, 8)), t = (i - 1) / 7, half = Math.ceil(Math.max((90 + 170 * t) * 1.15, (50 + 70 * t) * 1.2 + 30, 130));
  return { breite: half * 2, hoehe: half * 2 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const i = Math.max(1, Math.min(sz.props.intensity || 1, 8)), t = (i - 1) / 7, lerp = (a, b) => a + (b - a) * t;
    const radius = lerp(50, 120), fMin = lerp(10, 18), fMax = lerp(18, 36), F = PP_FX16_FEUER;
    return {
      i, flash: lerp(90, 260), innen: lerp(60, 170),
      flammen: Array.from({ length: Math.round(lerp(14, 38)) }, () => {
        const w = Math.random() * Math.PI * 2, dist = radius * (0.55 + Math.random() * 0.55), fi = ppFx16Fit(Math.random() * 220, 260 + Math.random() * 220);
        return { sx: Math.cos(w) * dist, sy: Math.sin(w) * dist, size: fMin + Math.random() * (fMax - fMin), art: ppFx16Pick(['f', 'f', 'f', 'f', 's', 'p']), ...fi };
      }),
      funken: Array.from({ length: Math.round(lerp(10, 30)) }, () => {
        const w = Math.random() * Math.PI * 2, v = (15 + Math.random() * 30) * (0.8 + t * 0.9), fi = ppFx16Fit(240 + Math.random() * 200, 320 + Math.random() * 280);
        return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 2 + Math.random() * (4 + t * 4), farbe: ppFx16Pick([F.rot, ppHex('#ff7d00'), ppHex('#ffb91a'), ppHex('#ff1a1a'), ppHex('#f9ac20'), F.hell]), ...fi };
      }),
      saeule: i < 3 ? [] : Array.from({ length: Math.round(lerp(0, 14)) }, () => {
        const fi = ppFx16Fit(80 + Math.random() * 320, 600 + Math.random() * 380);
        return { x: -22 + Math.random() * 44, y: 30 + Math.random() * 18, size: 6 + Math.random() * (8 + t * 8), ...fi };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  3-Headed Giant / Cykyran War Counselor (`spiked_club_smash`) — PIXELART. Eine grobe Holzkeule mit Stacheln fällt von oben aufs Ziel (Aufprall bei 380 ms, kurzes Eindellen bei 420 ms),
//  bleibt liegen und schwingt ab 700 ms wieder hinaus. Beim Aufprall: erdiger Staubring (Dither-Ellipse, Cremeweiß → Braun) und Holzsplitter. Nebenwirkung wie vorher: bei 375 ms
//  quetscht die Zone (Klasse `club-smash-squashed`, 700 ms). Die Keule kippt nicht mehr (-4°/6° entfallen: keine Drehung von Bildern).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX16_HOLZ = ppFx16Hex(['#27180c', '#3a2412', '#5a341a', '#6e4421', '#9d612f', '#ca874e']);
const PP_FX16_DORN = { o: ppHex('#886c44'), w: ppHex('#e2d8cb'), h: ppHex('#a89370') };
const PP_FX16_DORN_L = ['....h', '..hww', 'owwww', '..hww', '....h'];   // Spitze zeigt nach links (nach rechts gespiegelt)
const PP_FX16_DORN_U = ['hwwwh', '.hwh.', '..h..'];
/** Keule: (cx, oben) in Rasterpixeln, Breite W × Höhe H; Stachelpositionen wie vorher (Anteile der Höhe). */
function ppFx16Keule(g, cx, oben, W, H, a) {
  const P = PP_FX16_HOLZ, x0 = Math.round(cx - W / 2), y0 = Math.round(oben);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (j === 0 && (i === 0 || i === W - 1)) continue;
    if (j === H - 1 && (i === 0 || i === W - 1)) continue;
    let c;
    if (i === 0 || i === W - 1 || j === 0 || j === H - 1) c = P[0];
    else {
      const dd = Math.abs((i + 0.5) / W - 0.5);
      c = dd < 0.1 ? P[4] : dd < 0.26 ? P[3] : dd < 0.4 ? P[2] : P[1];
      if (j === 1) c = P[5];
      else if (j >= H - 3) c = P[0];
      else if ((i + 0.5) / W > 0.3 && (i + 0.5) / W < 0.68 && j > H * 0.08 && j < H * 0.86 && j % 4 === 2) c = P[Math.max(0, P.indexOf(c) - 1)];
    }
    g.put(x0 + i, y0 + j, c, a);
  }
  [0.46, 0.66, 0.86].forEach((f) => g.spr(PP_FX16_DORN_L, PP_FX16_DORN, x0 - 0.5, y0 + H * f, a));
  [0.54, 0.74, 0.94].forEach((f) => g.spr(PP_FX16_DORN_L, PP_FX16_DORN, x0 + W + 0.5, y0 + H * f, a, true));
  g.spr(PP_FX16_DORN_U, PP_FX16_DORN, x0 + W / 2, y0 + H + 1, a);
}
const PP_FX16_KEULE_KF = [[0, -340], [0.38, 0], [0.42, 7], [0.49, 0], [0.7, 0], [1, -300]];
const ppFx16Keulenflug = (u) => ppFx7Kf(u, PP_FX16_KEULE_KF, ppFx16Fall);
const ppFx16SpikedClub = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, u = t / 1000, B = 46 / S, Hk = 132 / S;
  const ty = ppFx16Keulenflug(u) / S;
  const sy = ppFx7Kf(u, [[0, 1], [0.38, 1], [0.42, 0.86], [0.49, 1], [1, 1]], ppFx16Fall), sx = ppFx7Kf(u, [[0, 1], [0.38, 1], [0.42, 1.08], [0.49, 1], [1, 1]], ppFx16Fall);
  const a = u < 0.7 ? 1 : 1 - ppFx7Kf((u - 0.7) / 0.3, [[0, 0], [1, 1]], ppFx16Fall);
  // Aufprall-Staubring (380 ms, 500 ms, ease-out): Ellipse 170 × 58, cremeweiß in der Mitte, braun außen
  const ur = (t - 380) / 500;
  if (ur >= 0 && ur <= 1) {
    const sxr = ppFx7Kf(ur, [[0, 0.25], [0.35, 1.5], [1, 2.3]], ppFx16Eo), syr = ppFx7Kf(ur, [[0, 0.25], [0.35, 1.05], [1, 1.5]], ppFx16Eo), al = ppFx7Kf(ur, [[0, 1], [0.35, 0.8], [1, 0]], ppFx16Eo);
    ppFx7Glow(g, cx, cy, 85 * sxr / S, 29 * syr / S, [ppHex('#ca874e'), ppHex('#e0c085'), ppHex('#fff8e8')], al * 0.85, 1.1);
  }
  // Keule: Unterkante bei Ziel-Oberkante (Mitte − halbe Zielhöhe), Höhe/Breite gestaucht beim Eindellen
  const H = Math.max(6, Math.round(Hk * sy)), W = Math.max(5, Math.round(B * sx)), unten = cy - sz.hh + ty + (Hk - H) / 2;
  if (a > 0.02) ppFx16Keule(g, cx, unten - H, W, H, a);
  for (const s of d.splitter) {
    const k = (t - s.verzug) / s.dauer;
    if (k < 0 || k > 1) continue;
    const e = ppFx16Eo(k), al = k < 0.2 ? 1 : 1 - ppFx16Eo((k - 0.2) / 0.8);
    ppFx16Korn(g, cx + s.dx * e / S, cy + s.dy * e / S, s.size * 1.2 * (1 - e), s.farbe, al);
  }
}, 1000, (p) => {
  const hh = (p.h || 90) / 2, oben = Math.ceil(hh + 132 + 340 + 12);
  return { breite: 400, hoehe: oben + 90, ankerX: 200, ankerY: oben };
}, {
  z: 10100,
  vorbereiten: () => ({
    splitter: Array.from({ length: ppFxN(16) }, () => {
      const w = -Math.PI * 0.1 + Math.random() * Math.PI * 1.2, v = 25 + Math.random() * 60;
      return { dx: Math.cos(w) * v, dy: -Math.abs(Math.sin(w) * v) - 6, size: 3 + Math.random() * 5, farbe: ppFx16Pick(ppFx16Hex(['#4a2a10', '#6e4421', '#9d612f', '#b29466', '#ebdcc1'])), verzug: 375 + Math.random() * 90, dauer: 280 + Math.random() * 220 };
    }),
  }),
  // Das Ziel wird beim Aufprall gequetscht (Lage jetzt merken: bis dahin kann die Kamera das Brett verschoben haben) — wie vorher.
  wirkung: ({ x, y, zoneEl }) => {
    const frost = ppZonenFrost();
    const timer = setTimeout(() => {
      let best = null, bestDist = Infinity;
      document.querySelectorAll('[data-hero-zone],[data-support-zone]').forEach((el) => {
        const r = (frost.get(el) || el.getBoundingClientRect());
        const dd = Math.abs(r.left + r.width / 2 - x) + Math.abs(r.top + r.height / 2 - y);
        if (dd < bestDist) { bestDist = dd; best = el; }
      });
      if (zoneEl && zoneEl.isConnected) { best = zoneEl; bestDist = 0; }
      if (best && bestDist < 80) {
        best.classList.add('club-smash-squashed');
        setTimeout(() => best.classList.remove('club-smash-squashed'), 700);
      }
    }, 375);
    return () => clearTimeout(timer);
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Deepsea Poltergeister (`spooky_ghost`) — PIXELART. Ein Pixelgeist (statt 👻) steigt schwankend durch den Platz auf (Keyframes wie `spookyGhostFloat`: Auftauchen, Wiegen links/rechts,
//  Ausblenden; von 1200 auf 1000 ms gestaucht), davor ein violetter Dunstblitz (Dither-Scheibe) und zehn Nebelwischer, die als helle Pixel (Lila/Türkis) aufsteigen und schwanken.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX16_GEIST_PAL = { o: ppHex('#7e41ba'), W: ppHex('#f1e5fa'), S: ppHex('#d6b3f9'), k: ppHex('#1a0a3a') };
const PP_FX16_GEIST = {
  gross: ['....ooooo....', '..ooWWWWWoo..', '.oWWWWWWWWSo.', '.oWWWWWWWWSo.', 'oWWWkkWWkkWSo', 'oWWWkkWWkkWSo', 'oWWWWWWWWWWSo', 'oWWWWWkkWWWSo', 'oWWWWWkkWWWSo', 'oWWWWWWWWWWSo', 'oWWWWWWWWWSSo', 'oWWWWWWWWSSSo', 'oWWWWWWWWSSSo', 'oWWWoWWWoWSSo', '.ooo.ooo.ooo.'],
  mittel: ['..ooooo..', '.oWWWWWo.', 'oWWWWWWSo', 'oWkWWkWSo', 'oWWWWWWSo', 'oWWWkWWSo', 'oWWWWWSSo', 'oWWWWWSSo', 'oWoWWoWSo', '.o.oo.oo.'],
};
const ppFx16Geist = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, u = Math.min(1, t / 1000);
  const st = (f) => ppFx7Kf(u, [[0, f[0]], [0.15, f[1]], [0.35, f[2]], [0.55, f[3]], [0.75, f[4]], [1, f[5]]], ppFx16Eio);
  // Dunstblitz (140 px, 900 ms ab 250 ms → gestaucht)
  const kb = ppFx16BlitzKurve((t - d.dunst.verzug) / d.dunst.dauer);
  if (kb) ppFx16Kugel(g, cx, cy, 70 * kb.sc / S, [ppHex('#58238c'), ppHex('#7e41ba'), ppHex('#c98aff')], kb.al * 0.6, 1.1);
  // Wischer
  for (const w of d.wischer) {
    const k = (t - w.verzug) / w.dauer;
    if (k < 0 || k > 1) continue;
    const py = k < 0.6 ? w.endY * 0.55 * ppFx16Eo(k / 0.6) : w.endY * (0.55 + 0.45 * ppFx16Eo((k - 0.6) / 0.4));
    const px = k < 0.6 ? w.wobble * ppFx16Eo(k / 0.6) : w.wobble * (1 - ppFx16Eo((k - 0.6) / 0.4));
    const a = ppFx7Kf(k, [[0, 0], [0.2, 0.9], [0.6, 0.6], [1, 0]], ppFx16Eo);
    ppFx16Kugel(g, cx + (w.x + w.size / 2 + px) / S, cy + (w.y + w.size / 2 + py) / S, w.size * 0.85 / S, [w.farbe[0], w.farbe[1]], a, 0.9);
  }
  // Geist: Box (-22, -4), 44 px Schrift ⇒ Mitte ≈ (0, +20); Schwanken und Aufsteigen wie `spookyGhostFloat`
  const gx = st([0, -6, 8, -6, 6, 0]), gy = 20 + st([10, 2, -18, -36, -54, -78]), gs = st([0.6, 1.05, 1, 1.02, 1, 0.75]), ga = st([0, 1, 1, 0.95, 0.8, 0]);
  if (ga > 0.03) {
    ppFx7Glow(g, cx + gx / S, cy + gy / S, 13, 15, [ppHex('#58238c'), ppHex('#7e41ba')], ga * 0.3, 1);
    g.spr(gs < 0.85 ? PP_FX16_GEIST.mittel : PP_FX16_GEIST.gross, PP_FX16_GEIST_PAL, cx + gx / S, cy + gy / S, ga);
  }
}, 1000, { breite: 300, hoehe: 300 }, {
  z: 10100,
  vorbereiten: () => ({
    dunst: ppFx16Fit(250, 900, 1000),
    wischer: Array.from({ length: ppFxN(10) }, () => {
      const fi = ppFx16Fit(Math.random() * 500, 700 + Math.random() * 500);
      return { x: -35 + Math.random() * 70, y: 20 + Math.random() * 20, endY: -70 - Math.random() * 50, size: 4 + Math.random() * 8, wobble: -12 + Math.random() * 24, farbe: Math.random() < 0.5 ? [ppHex('#7e41ba'), ppHex('#d6b3f9')] : [ppHex('#66a1a1'), ppHex('#91e6e6')], ...fi };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Steam Dwarfs (`steam_puff`; Brewer, Diver, Engineer, Miner, Engine) — PIXELART. Ein Auspuffstoß: zwölf graue Dampfwolken (Dither-Kugeln in zwei Grautönen, Deckung .55–.9) steigen auf,
//  wachsen (.4 → 1,8) und blenden aus; dazu fünf gelbe Funken. Der Dampf ist wie die alten Wolken über ~1700 ms gestreut, hier auf ≤ 960 ms gestaucht.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx16Dampf = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const p of d.wolken) {
    const k = (t - p.verzug) / p.dauer;
    if (k < 0 || k > 1) continue;
    const e = ppFx16Eo(k), sc = 0.4 + 1.4 * e, a = ppFx7Kf(k, [[0, 0], [0.25, p.deckung], [1, 0]], ppFx16Eo);
    ppFx16Kugel(g, cx + (p.sx + p.size / 2 + p.dx * e) / S, cy + (p.sy + p.size / 2 + p.dy * e) / S, p.size / 2 * sc * 0.8 / S, p.farben, a, 0.9);
  }
  for (const s of d.funken) {
    const k = (t - s.verzug) / s.dauer;
    if (k < 0 || k > 1) continue;
    const e = ppFx16Eo(k), sc = ppFx7Kf(k, [[0, 0.4], [0.3, 1], [1, 0.6]], ppFx16Eo), a = ppFx7Kf(k, [[0, 0], [0.3, 1], [1, 0]], ppFx16Eo);
    const px = cx + (s.size / 2 + s.dx * e) / S, py = cy + (20 + s.size / 2 + s.dy * e) / S;
    ppFx16Korn(g, px, py, s.size * sc * 1.3, ppHex('#fad54a'), a);
    if (a > 0.4 && s.size * sc > 3) ppFx16Korn(g, px, py, s.size * sc * 0.6, ppHex('#fffbd2'), a);
  }
}, 1000, { breite: 240, hoehe: 240, ankerX: 120, ankerY: 120 }, {
  z: 10100,
  vorbereiten: () => ({
    wolken: Array.from({ length: ppFxN(12) }, (_, i) => {
      const fi = ppFx16Fit(i * 45 + Math.random() * 100, 700 + Math.random() * 400), dunkel = Math.random() < 0.5;
      return { sx: -25 + Math.random() * 50, sy: 15 + Math.random() * 15, dx: -10 + Math.random() * 20, dy: -(30 + Math.random() * 40), size: 18 + Math.random() * 22, deckung: 0.55 + Math.random() * 0.35,
        farben: dunkel ? [ppHex('#d2d2db'), ppHex('#e6e6e6')] : [ppHex('#b9b9b9'), ppHex('#e6e6e6')], ...fi };
    }),
    funken: Array.from({ length: 5 }, () => ({ dx: -15 + Math.random() * 30, dy: -(5 + Math.random() * 20), size: 2 + Math.random() * 3, verzug: Math.random() * 150, dauer: 400 + Math.random() * 200 })),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Divine Gift of Coolness (`sunglasses_drop`) — PIXELART. Eine Pixel-Sonnenbrille (statt 🕶️) schwebt von oben (80 px) aufs Ziel, federt kurz nach, bleibt und blendet aus (Keyframes wie
//  `sunglassesDrop`, Größe .6 → 1 → 1,05 → .8 in zwei Pixelbild-Größen); zwölf Glitzerpunkte steigen danach auf. Das alte Skript plante 1800 ms, die Animation läuft aber nur 1000 ms —
//  hier auf 960 ms gestaucht (Aufsetzen bei ~480 ms), damit Landen, Nachfedern und Glitzern sichtbar zu Ende laufen.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX16_BRILLE_PAL = { o: ppHex('#59606e'), k: ppHex('#141414'), h: ppHex('#b9b9b9'), g: ppHex('#7f7f7f') };
const ppFx16BrilleBild = (arm, linse) => linse.map((z, r) => {      // zwei Gläser + Steg + Bügel (oben), `arm` Pixel breit
  const buegel = (r === 0 ? 'o' : '.').repeat(arm), steg = r < 2 ? 'ooo' : '...';
  return buegel + z + steg + z + buegel;
});
const PP_FX16_BRILLE = {
  gross: ppFx16BrilleBild(2, ['oooooooo', 'ohhkkkko', 'ohgkkkko', 'okkkkkko', '.okkkko.', '..oooo..']),
  klein: ppFx16BrilleBild(1, ['ooooooo', 'ohkkkko', 'okkkkko', '.okkko.', '..ooo..']),
};
const ppFx16Brille = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, u = Math.min(1, t / PP_FX16_ENDE);
  // Brille: 48 px Schrift, Box oben bei -70 ⇒ Mitte ≈ (0, -42)
  const ty = ppFx7Kf(u, [[0, -80], [0.5, 0], [0.65, -8], [0.75, 0], [0.85, 0], [1, 0]], ppFx16Eio);
  const sc = ppFx7Kf(u, [[0, 0.6], [0.5, 1], [0.75, 1.05], [0.85, 1], [1, 0.8]], ppFx16Eio), a = ppFx7Kf(u, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]], ppFx16Eio);
  if (a > 0.03) {
    const bild = sc < 0.85 ? PP_FX16_BRILLE.klein : PP_FX16_BRILLE.gross;
    g.spr(bild, PP_FX16_BRILLE_PAL, cx, cy + (-42 + ty) / S + 1, a);
    if (u > 0.45 && u < 0.62) g.put(cx - 4, cy + (-42 + ty) / S - 1, ppHex('#ffffff'), a);   // Glanz beim Aufsetzen
  }
  for (const s of d.glitzer) {
    const k = (t - s.verzug) / s.dauer;
    if (k < 0 || k > 1) continue;
    const ty2 = ppFx7Kf(k, [[0, 0], [0.2, -10], [1, -100]], ppFx16Eo), sc2 = ppFx7Kf(k, [[0, 0.3], [0.2, 1], [1, 0.2]], ppFx16Eo), a2 = ppFx7Kf(k, [[0, 0], [0.2, 1], [1, 0]], ppFx16Eo);
    const px = cx + (s.x + s.size / 2) / S, py = cy + (s.y + s.size / 2 + ty2) / S, n = s.size * sc2 / S;
    ppFx16Korn(g, px, py, s.size * sc2 * 1.2, s.farbe, a2);
    if (n >= 1.3 && a2 > 0.35) { g.put(px - 2, py, s.farbe, a2 * 0.7); g.put(px + 2, py, s.farbe, a2 * 0.7); g.put(px, py - 2, s.farbe, a2 * 0.7); g.put(px, py + 2, s.farbe, a2 * 0.7); }
  }
}, 1000, { breite: 168, hoehe: 252, ankerX: 84, ankerY: 198 }, {
  z: 10100,
  vorbereiten: () => ({
    glitzer: Array.from({ length: ppFxN(12) }, () => {
      const verzug = 440 + Math.random() * 200, dauer = Math.min(PP_FX16_ENDE - verzug, 260 + Math.random() * 260);
      return { x: -30 + Math.random() * 60, y: -5 + Math.random() * 15, size: 3 + Math.random() * 5, farbe: ppFx16Pick(ppFx16Hex(['#ffe23d', '#ffffff', '#fad54a', '#fbe181', '#ffffff'])), verzug, dauer };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Future Tech Doping (`syringe_stab`) — PIXELART. Eine große Spritze (Pixelform, schräg um 14° gekippt: Pixel einzeln nach der Drehung berechnet) fährt von schräg oben (38/-54 px, 28° → 14°)
//  ins Ziel, stoppt hart (45 % von 520 ms), federt 3 px nach unten und blendet aus; der Stempel drückt dabei durch. Gelbe Flüssigkeit, Nadel, Stempel; dazu fünf gelbe Tropfen im Fächer
//  nach oben (ab 300 ms, im 45-ms-Takt).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
/** Rotierte Baugruppe: Drehpunkt unten Mitte (px, py), Länge `laenge` nach oben, `halb` halbe Breite, Drehung in Grad (im Uhrzeigersinn); `farbe(lx, ly)` mit lx quer (Pixel), ly = Abstand vom Drehpunkt. */
function ppFx16Gedreht(g, px, py, grad, halb, laenge, farbe, a) {
  const w = grad * Math.PI / 180, c = Math.cos(w), s = Math.sin(w), R = Math.ceil(Math.hypot(halb, laenge)) + 1;
  for (let Y = Math.floor(py - R); Y <= Math.ceil(py + R); Y++) for (let X = Math.floor(px - R); X <= Math.ceil(px + R); X++) {
    const dx = X + 0.5 - px, dy = Y + 0.5 - py;
    const lx = dx * c + dy * s, ly = -(dy * c - dx * s);             // zurück in das Eigensystem (y nach oben)
    if (ly < 0 || ly >= laenge || Math.abs(lx) > halb) continue;
    const col = farbe(lx, ly);
    if (col) g.put(X, Y, col, a);
  }
}
const PP_FX16_SPRITZE = { rand: ppHex('#b29466'), tr: ppFx16Hex(['#fff8e8', '#f7e0b5', '#e0c085']), fl: ppFx16Hex(['#fff196', '#f8ca21']), st: ppFx16Hex(['#e5edfa', '#a5b0c0']), na: ppFx16Hex(['#ffffff', '#e5edfa']) };
const ppFx16Spritze = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, P = PP_FX16_SPRITZE, u = t / 520, b = d.basis, Hk = b * 1.05 / S, Wk = Math.max(5, Math.round(b * 0.22 / S));
  if (u <= 1) {
    const e = ppFx7Bez(0.2, 0.9, 0.35, 1);
    const kx = ppFx7Kf(u, [[0, 38], [0.45, 0], [0.55, -2], [1, 0]], e), ky = ppFx7Kf(u, [[0, -54], [0.45, 0], [0.55, 3], [1, -6]], e);
    const rot = ppFx7Kf(u, [[0, 28], [0.45, 14], [1, 14]], e), al = ppFx7Kf(u, [[0, 0], [0.22, 1], [0.45, 1], [1, 0]], e);
    const pl = ppFx7Kf(u, [[0, 0], [0.45, 0], [0.7, 0.38], [1, 0.42]], ppFx16Ei);      // Stempel drückt durch (Anteil seiner Höhe)
    if (al > 0.03) {
      const px = cx + kx / S, py = cy + (-b * 0.1 + ky) / S, Hh = Hk;
      // Eigensystem: ly 0 = Nadelspitze (Drehpunkt unten Mitte), Nadel bis .32·H, Zylinder .32·H … H (Flüssigkeit .36 … .86·H), Stempel .94·H … 1,14·H (sinkt um pl · .2·H)
      ppFx16Gedreht(g, px, py, rot, Wk / 2 + 0.5, Hh * 1.16, (lx, ly) => {
        const x = lx / Wk + 0.5, q = ly / Hh;
        const ps = (ly - Hh * (0.94 - pl * 0.2)) / (Hh * 0.2);                // Stempel (liegt über dem Zylinder)
        if (ps >= 0 && ps <= 1 && x > 0.28 && x < 0.72) return ps > 0.5 ? P.st[0] : P.st[1];
        if (q < 0.32) return Math.abs(lx) < 0.55 ? (lx < 0 ? P.na[0] : P.na[1]) : null;      // Nadel, 1 Rasterpixel breit
        if (q > 1 || Math.abs(lx) > Wk / 2) return null;
        if (Math.abs(lx) > Wk / 2 - 0.6 || q < 0.34 || q > 0.985) return P.rand;
        if (x > 0.18 && x < 0.82 && q > 0.36 && q < 0.86) return q > 0.61 ? P.fl[0] : P.fl[1];
        return x < 0.45 ? P.tr[0] : x < 0.75 ? P.tr[1] : P.tr[2];
      }, al);
    }
  }
  for (const tr of d.tropfen) {
    const k = (t - tr.verzug) / 380;
    if (k < 0 || k > 1) continue;
    const e = ppFx7Kf(k, [[0, 0], [0.3, 0.5], [1, 1]], ppFx16Eo), sc = ppFx7Kf(k, [[0, 0.5], [0.3, 1], [1, 0.4]], ppFx16Eo), a = ppFx7Kf(k, [[0, 0], [0.3, 1], [1, 0]], ppFx16Eo);
    ppFx16Korn(g, cx + tr.dx * e / S, cy + tr.dy * e / S, 3.2 * sc * 1.8 + 1.5, ppHex('#f8ca21'), a);
    if (a > 0.5 && sc > 0.8) g.put(cx + tr.dx * e / S, cy + tr.dy * e / S, ppHex('#f9ecb3'), a);
  }
}, 900, (p) => {
  const b = Math.max(p.w || 72, 60), half = Math.ceil(b * 1.2 + 80), ay = Math.ceil(b * 1.4 + 90);
  return { breite: half * 2, hoehe: ay + Math.ceil(b * 0.6 + 40), ankerX: half, ankerY: ay };
}, {
  z: 10120,
  vorbereiten: (sz) => {
    const basis = Math.max(sz.props.w || 72, 60);
    return { basis, tropfen: [0, 1, 2, 3, 4].map((i) => { const w = -Math.PI / 2 + (i - 2) * 0.42; return { dx: Math.cos(w) * basis * 0.38, dy: Math.sin(w) * basis * 0.38, verzug: 300 + i * 45 }; }) };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Toxic Fumes (`toxic_fumes_gas`) — PIXELART. Giftgas wallt über die Karte: ein grünlicher Dunst (Dither-Ellipse, wächst .6 → 1,2) und zehn Gaswolken (Violett und Grün, wachsen .3 → 1,5,
//  driften leicht nach oben, blenden aus), dazwischen steigen vier Pixel-Totenköpfe (statt ☠) auf. Wie der Dampf über ~1700 ms gestreut, hier auf ≤ 960 ms gestaucht.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX16_SCHAEDEL_PAL = { w: ppHex('#d6b3f9'), k: ppHex('#1a0a3a'), s: ppHex('#9544d5') };
const PP_FX16_SCHAEDEL = {
  gross: ['.swwws.', 'swwwwws', 'wkwwwkw', 'wkwwwkw', 'swwkwws', '.swwws.', '..wsw..'],
  klein: ['.www.', 'wkwkw', 'wwwww', '.w.w.'],
};
const ppFx16Gas = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, cw = d.cw, ch = d.ch;
  const kh = t / d.haze;
  if (kh >= 0 && kh <= 1) {
    const sc = ppFx7Kf(kh, [[0, 0.6], [0.4, 1.05], [0.8, 1.1], [1, 1.2]], ppFx16Eio), a = ppFx7Kf(kh, [[0, 0], [0.4, 0.9], [0.8, 0.7], [1, 0]], ppFx16Eio);
    ppFx7Glow(g, cx, cy, cw / 2 * 0.9 * sc / S, ch / 2 * 0.9 * sc / S, [ppHex('#167927'), ppHex('#3a5a25'), ppHex('#5b9438')], a * 0.55, 1.1);
  }
  for (const p of d.wolken) {
    const k = (t - p.verzug) / p.dauer;
    if (k < 0 || k > 1) continue;
    const sc = ppFx7Kf(k, [[0, 0.3], [0.3, 1], [0.7, 1.25], [1, 1.5]], ppFx16Eo), a = ppFx7Kf(k, [[0, 0], [0.3, 0.95], [0.7, 0.6], [1, 0]], ppFx16Eo);
    const dr = ppFx7Kf(k, [[0, 0], [0.3, 0.4], [0.7, 0.8], [1, 1]], ppFx16Eo);
    ppFx16Kugel(g, cx + (p.x + p.dx * dr) / S, cy + (p.y + p.dy * dr) / S, p.size / 2 * sc * 0.75 / S, p.farben, a * p.deckung, 0.85);
  }
  for (const s of d.schaedel) {
    const k = (t - s.verzug) / s.dauer;
    if (k < 0 || k > 1) continue;
    const ty = ppFx7Kf(k, [[0, 0], [0.3, -18], [0.7, -38], [1, -56]], ppFx16Eio), tx = ppFx7Kf(k, [[0, 0], [0.7, 3], [1, -2]], ppFx16Eio);
    const sc = ppFx7Kf(k, [[0, 0.5], [0.3, 1], [0.7, 1.05], [1, 0.8]], ppFx16Eio), a = ppFx7Kf(k, [[0, 0], [0.3, 1], [0.7, 0.8], [1, 0]], ppFx16Eio);
    if (a > 0.03) g.spr(s.size * sc >= 10 ? PP_FX16_SCHAEDEL.gross : PP_FX16_SCHAEDEL.klein, PP_FX16_SCHAEDEL_PAL, cx + (s.x + s.size * 0.4 + tx) / S, cy + (s.y + s.size * 0.5 + ty) / S, a);
  }
}, 1000, (p) => {
  const cw = p.w || 90, ch = p.h || 120;
  return { breite: cw + 170, hoehe: ch + 190, ankerX: (cw + 170) / 2, ankerY: ch / 2 + 110 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 90, ch = sz.props.h || 120;
    const farben = () => (Math.random() < 0.5
      ? ppFx16Pick([[ppHex('#702db3'), ppHex('#9544d5')], [ppHex('#702db3'), ppHex('#9544d5')], [ppHex('#9544d5'), ppHex('#d6b3f9')]])
      : ppFx16Pick([[ppHex('#3a5a25'), ppHex('#5b9438')], [ppHex('#167927'), ppHex('#5b9438')]]));
    return {
      cw, ch, haze: ppFx16Fit(0, 1200).dauer,
      wolken: Array.from({ length: ppFxN(10) }, () => {
        const fi = ppFx16Fit(Math.random() * 260, 900 + Math.random() * 500);
        return { x: -cw / 2 + Math.random() * cw, y: -ch / 2 + Math.random() * ch, size: 32 + Math.random() * 26, dx: -10 + Math.random() * 20, dy: -14 - Math.random() * 12, farben: farben(), deckung: 0.8, ...fi };
      }),
      schaedel: Array.from({ length: 4 }, () => {
        const fi = ppFx16Fit(200 + Math.random() * 400, 900 + Math.random() * 300);
        return { x: -cw / 2 + 10 + Math.random() * (cw - 20), y: ch / 3 + Math.random() * 10, size: 10 + Math.random() * 6, ...fi };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Jump in the River (`water_splash`) — PIXELART. Ein Heldensprung ins Wasser: ein blauer Spritzblitz (Dither-Ellipse 120 × 60, wie `anim-flame-flash`: 250 ms ab Start, .3 → 1,5 → 2),
//  drei Wellenringe (flache Ellipsen, wachsen .3 → 2,5 und blenden aus) und 24 Wassertropfen, die in einem Fächer nach oben spritzen und abfallen (Blau-/Cyantöne, 4–12 px).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX16_WASSER = ppFx16Hex(['#4e82cb', '#66b6ff', '#4e82cb', '#7bbeea', '#b3d8f9', '#2f539d']);
const ppFx16Spritzer = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const kb = ppFx16BlitzKurve((t - d.blitz.verzug) / d.blitz.dauer);
  if (kb) ppFx7Glow(g, cx, cy - 15 / S, 60 * kb.sc / S, 30 * kb.sc / S, [ppHex('#2f539d'), ppHex('#4e82cb')], kb.al * 0.85, 1.1);
  for (const r of d.ringe) {
    const k = (t - r.verzug) / r.dauer;
    if (k < 0 || k > 1) continue;
    const sc = ppFx7Kf(k, [[0, 0.3], [1, 2.5]], ppFx16Eo), a = ppFx7Kf(k, [[0, 0], [0.15, 0.7], [1, 0]], ppFx16Eo), rx = r.size / 2 * sc / S, ry = r.size * 0.35 / 2 * sc / S;
    g.ellRing(cx, cy + (-8 + r.size * 0.35 / 2) / S, rx, ry, 1, ppHex('#66b6ff'), a * 1.2);
  }
  for (const w of d.tropfen) {
    const k = (t - w.verzug) / w.dauer;
    if (k < 0 || k > 1) continue;
    const e = ppFx16Eo(k), a = k < 0.2 ? 1 : 1 - ppFx16Eo((k - 0.2) / 0.8);
    ppFx16Korn(g, cx + w.dx * e / S, cy + w.dy * e / S, w.size * 1.2 * (1 - e), w.farbe, a);
  }
}, 1000, { breite: 320, hoehe: 240, ankerX: 160, ankerY: 170 }, {
  z: 10100,
  vorbereiten: () => ({
    blitz: ppFx16Fit(250, 600, 1000),
    ringe: [0, 1, 2].map((i) => ({ size: 40 + i * 30, ...ppFx16Fit(i * 200, 800 + i * 200) })),
    tropfen: Array.from({ length: ppFxN(24) }, () => {
      const w = -Math.PI * 0.1 + Math.random() * Math.PI * 1.2, v = 25 + Math.random() * 55;
      return { dx: Math.cos(w) * v, dy: -Math.abs(Math.sin(w) * v) - 10, size: 4 + Math.random() * 8, farbe: ppFx16Pick(PP_FX16_WASSER), ...ppFx16Fit(Math.random() * 200, 500 + Math.random() * 400) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Dragolfin / Water Golem (`water_wave`) — PIXELART. Eine Wasserwelle rollt von links über das Ziel (900 ms): ein tiefer Wasserberg (Blob mit 115°-Farbband Dunkelblau → Hellblau → Weiß in
//  vier Stufen, Dither dazwischen; hellerer Rand unten), davor eine Schaumkrone (weiße Dither-Ellipse), ein Aufschlagring (ab 330 ms) und 22 Gischtpunkte, die nach oben davonspritzen.
//  Größe richtet sich wie vorher nach dem Ziel (`w`, `h`); die Leinwand deckt die ganze Laufstrecke der Welle ab (−3,1 … +2,2 Zielbreiten).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX16_WELLE = { band: ppFx16Hex(['#2b457e', '#4e82cb', '#77c8ee', '#e5f5fa']), halo: ppHex('#399edf'), schaum: ppHex('#ffffff'), schaum2: ppHex('#e5f5fa'), ring: ppHex('#b6eff7'), gischt: [ppHex('#7fdfff'), ppHex('#ffffff')] };
const PP_FX16_WELLE_STOPS = [0, 0.38, 0.68, 0.92, 1.5];
/** CSS-Blob `border-radius: 46% 54% 40% 60% / 60% 45% 55% 40%` in einer Box W × H: liegt (px, py) darin? */
function ppFx16Blob(px, py, W, H) {
  if (px < 0 || py < 0 || px >= W || py >= H) return false;
  let rx, ry, mx, my;
  if (px < W * 0.46 && py < H * 0.6) { rx = W * 0.46; ry = H * 0.6; mx = rx; my = ry; }
  else if (px >= W * 0.46 && px > W * 0.46 && W - px < W * 0.54 && py < H * 0.45) { rx = W * 0.54; ry = H * 0.45; mx = W - rx; my = ry; }
  else if (W - px < W * 0.4 && H - py < H * 0.55) { rx = W * 0.4; ry = H * 0.55; mx = W - rx; my = H - ry; }
  else if (px < W * 0.6 && H - py < H * 0.4) { rx = W * 0.6; ry = H * 0.4; mx = rx; my = H - ry; }
  else return true;
  const a = (px - mx) / rx, b = (py - my) / ry;
  return a * a + b * b <= 1;
}
const ppFx16Welle = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, cw = d.cw, ch = d.ch, u = t / 900, P = PP_FX16_WELLE;
  const eb = ppFx7Bez(0.3, 0.7, 0.35, 1);
  // Wasserberg
  if (u <= 1) {
    const Wp = 2.2 * cw, Hp = 1.5 * ch, tx = ppFx7Kf(u, [[0, -0.7], [0.55, 0], [1, 0.65]], eb), sy = ppFx7Kf(u, [[0, 0.7], [0.55, 1], [1, 0.75]], eb), al = ppFx7Kf(u, [[0, 0], [0.2, 1], [0.55, 1], [1, 0]], eb);
    if (al > 0.03) {
      const W = Wp / S, H = Hp * sy / S, x0 = cx + (-1.5 * cw + tx * Wp) / S, y0 = cy - H / 2;
      const dx = 0.906, dy = 0.423, Lg = Math.abs(W * dx) + Math.abs(H * dy), m = 6;
      for (let j = -m; j < H + m; j++) for (let i = -m; i < W + m; i++) {
        const X = Math.round(x0 + i), Y = Math.round(y0 + j), inn = ppFx16Blob(i, j, W, H);
        if (!inn) {                                                       // Schein (box-shadow) als dünner Dither-Saum
          if ((ppFx16Blob(i - 2, j, W, H) || ppFx16Blob(i + 2, j, W, H) || ppFx16Blob(i, j - 2, W, H) || ppFx16Blob(i, j + 2, W, H)) && ppBayer(X, Y) < 0.3 * al) g.put(X, Y, P.halo, 1);
          continue;
        }
        const p = ((i - W / 2) * dx + (j - H / 2) * dy) / Lg + 0.5, ST = PP_FX16_WELLE_STOPS;
        let q = 0; while (q < 3 && p > ST[q + 1]) q++;
        let c = P.band[q];
        if (q < 3 && p > ST[q]) { const f = (p - ST[q]) / (ST[q + 1] - ST[q]); if (f > ppBayer(X, Y)) c = P.band[q + 1]; }
        const rim = (j - (H - 26 / S)) / (26 / S);                       // heller Rand unten (inset-Glanz)
        if (rim > 0 && rim * 0.6 > ppBayer(X + 1, Y)) c = P.band[3];
        g.put(X, Y, c, al);
      }
    }
  }
  // Schaumkrone: Ellipse 2,2·cw × 0,5·ch, Licht bei 60 %/60 %
  const us = (t - 40) / 900;
  if (us >= 0 && us <= 1) {
    const tx = ppFx7Kf(us, [[0, -0.6], [0.6, 0.06], [1, 0.7]], eb), sx = ppFx7Kf(us, [[0, 0.8], [0.6, 1.1], [1, 1.2]], eb), al = ppFx7Kf(us, [[0, 0], [0.25, 1], [0.6, 0.9], [1, 0]], eb);
    const Wp = 2.2 * cw * sx / S, Hp = 0.5 * ch / S, x0 = cx + (-1.5 * cw + 1.1 * cw * (1 - sx) + tx * 2.2 * cw) / S, y0 = cy - 0.8 * ch / S;
    if (al > 0.03) for (let j = 0; j < Hp; j++) for (let i = 0; i < Wp; i++) {
      const ex = (i + 0.5) / Wp * 2 - 1, ey = (j + 0.5) / Hp * 2 - 1;
      if (ex * ex + ey * ey > 1) continue;
      const rr = Math.hypot((i / Wp - 0.6) / 0.85, (j / Hp - 0.6) / 0.85), v = (1 - rr / 0.75) * 0.95 * al;
      if (v <= 0.04) continue;
      g.put(Math.round(x0 + i), Math.round(y0 + j), v > 0.5 ? P.schaum : P.schaum2, Math.min(1, v * 1.15));
    }
  }
  // Aufschlagring (520 ms ab 330 ms)
  const ur = (t - 330) / 520;
  if (ur >= 0 && ur <= 1) {
    const sc = 0.35 + 1.0 * ppFx16Eo(ur), al = 0.95 * (1 - ppFx16Eo(ur));
    g.ellRing(cx, cy - 0 / S, 0.85 * cw * sc / S, 0.6 * ch * sc / S, 1.3, P.ring, al);
    g.ellRing(cx, cy, Math.max(1, 0.85 * cw * sc / S - 2), Math.max(1, 0.6 * ch * sc / S - 2), 1, P.halo, al * 0.4);
  }
  for (const w of d.gischt) {
    const k = (t - w.verzug) / w.dauer;
    if (k < 0 || k > 1) continue;
    const e = ppFx16Eo(k), a = ppFx7Kf(k, [[0, 0], [0.2, 1], [1, 0]], ppFx16Eo);
    const x = cx + w.dx * e / S, y = cy + w.dy * e / S;
    ppFx16Korn(g, x, y, w.size * (0.9 + 0.4 * (1 - e)), P.gischt[0], a);
    if (w.size > 7 && a > 0.4) ppFx16Korn(g, x, y, w.size * 0.5, P.gischt[1], a);
  }
}, 1000, (p) => {
  const cw = p.w || 100, ch = p.h || 140, l = Math.ceil(3.2 * cw + 60), r = Math.ceil(2.3 * cw + 60), o = Math.ceil(1.6 * ch + 30), un = Math.ceil(0.9 * ch + 30);
  return { breite: l + r, hoehe: o + un, ankerX: l, ankerY: o };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 100, ch = sz.props.h || 140;
    return {
      cw, ch,
      gischt: Array.from({ length: ppFxN(22) }, () => ({ dx: -cw * 0.9 + Math.random() * cw * 2.2, dy: -ch * (0.5 + Math.random() * 0.9), size: 4 + Math.random() * 9, ...ppFx16Fit(180 + Math.random() * 320, 460 + Math.random() * 380) })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Cloudy Slime (`wind`) — PIXELART. Ein sanfter Windwirbel um das Ziel: ein heller Windschein (Dither-Ellipse, wächst .3 → 1,6, 600 ms) und 14 Windstriche (kleine Pixelwellen statt der
//  Zeichen ~ ≈ ∿ ⌇ ·), die auf einer Kreisbahn nach innen spiralen (Radius 20–50 → ×0,6 → Mitte, steigen 15 px) und ausblenden. Verteilt über ~1380 ms, gestaucht auf ≤ 960 ms.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
/** Windstrich aus Pixeln: Art 0 = Welle, 1 = Doppelwelle, 2 = kurze Welle, 3 = Punkt; Länge `len` Rasterpixel, `ph` verschiebt die Welle. */
function ppFx16Windstrich(g, x, y, len, art, c, a, ph) {
  if (a <= 0.02) return;
  if (art === 3 || len < 2) { g.put(x, y, c, a); return; }
  const n = Math.max(3, Math.round(art === 2 ? len * 0.7 : len)), x0 = Math.round(x - n / 2);
  for (let i = 0; i < n; i++) {
    const yy = Math.round(Math.sin(i * 1.5 + ph) * 0.8);
    g.put(x0 + i, y + yy, c, a);
    if (art === 1) g.put(x0 + i, y + yy + 2, c, a * 0.85);
  }
}
const ppFx16Wind = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, F = ppHex('#bddcef'), H = ppHex('#e5f5fa');
  const u = t / 600;
  if (u >= 0 && u <= 1) {
    const sc = ppFx7Kf(u, [[0, 0.3], [0.5, 1.2], [1, 1.6]], ppFx16Eo), a = ppFx7Kf(u, [[0, 0.8], [0.5, 0.5], [1, 0]], ppFx16Eo);
    ppFx16Kugel(g, cx, cy, 30 * sc / S, [ppHex('#bddcef'), ppHex('#b3e8f9')], a * 0.55, 1);
  }
  for (const p of d.striche) {
    const k = (t - p.verzug) / p.dauer;
    if (k < 0 || k > 1) continue;
    const a1 = p.start, a2 = p.start + 2;
    const px = ppFx7Kf(k, [[0, Math.cos(a1) * p.radius], [0.5, Math.cos(a2) * p.radius * 0.6], [1, 0]], ppFx16Eo);
    const py = ppFx7Kf(k, [[0, Math.sin(a1) * p.radius], [0.5, Math.sin(a2) * p.radius * 0.6], [1, -15]], ppFx16Eo);
    const sc = ppFx7Kf(k, [[0, 1], [0.5, 1.2], [1, 0.3]], ppFx16Eo), a = ppFx7Kf(k, [[0, 0.9], [0.5, 1], [1, 0]], ppFx16Eo);
    ppFx16Windstrich(g, cx + (px + p.size * 0.3) / S, cy + (py + p.size * 0.5) / S, p.size * sc * 1.25 / S, p.art, k < 0.5 ? F : H, a, p.phase + k * 4);
  }
}, 1000, { breite: 168, hoehe: 168 }, {
  z: 10100,
  vorbereiten: () => ({
    striche: Array.from({ length: ppFxN(14) }, (_, i) => ({
      start: (i / 14) * Math.PI * 2, radius: 20 + Math.random() * 30, size: 6 + Math.random() * 8, art: ppFx16Pick([0, 1, 0, 2, 3]), phase: Math.random() * 6,
      ...ppFx16Fit(i * 40 + Math.random() * 60, 500 + Math.random() * 300),
    })),
  }),
});

ppFxUeberschreiben('soul_shard_inferno', ppFx16SoulShard);
ppFxUeberschreiben('spiked_club_smash', ppFx16SpikedClub);
ppFxUeberschreiben('spooky_ghost', ppFx16Geist);
ppFxUeberschreiben('steam_puff', ppFx16Dampf);
ppFxUeberschreiben('sunglasses_drop', ppFx16Brille);
ppFxUeberschreiben('syringe_stab', ppFx16Spritze);
ppFxUeberschreiben('toxic_fumes_gas', ppFx16Gas);
ppFxUeberschreiben('water_splash', ppFx16Spritzer);
ppFxUeberschreiben('water_wave', ppFx16Welle);
ppFxUeberschreiben('wind', ppFx16Wind);
