// Pixelart-Portierungen (Canvas), Batch 22 (dritte Welle, alle übrigen Effekte): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte: loom_swell, mini_hearts (+ Alias puppet_swap_pavi), modifier_sparkle (+ Alias puppet_swap_brammi).
// Alle laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s) mit den Ankern, Zeiten und Zahlen der DOM-Fassungen in `ANIM_REGISTRY` (app-board.jsx).
// Pixelart-Regeln: nur Palettenfarben, Deckung < 1 = Bayer-Dithering, keine Unschärfe / Verläufe, keine Drehung von Bildern (Herzen = kleine Sprites), Bewegung in ganzen Rasterpixeln.
// Nicht portiert (laufen schon auf Canvas — `ppSalve`/`ppPunktBild`/eigene Leinwand): liquid_rainbow, live_show_spot, looting_grab, man_eater_bite, man_eater_swarm, masterpiece_paint, mean_cat_bats,
// mimic_chomp, mind_control_hex, moth_dust, oracle_vision, overheat, patty_shuriken, pinaxolotl_bubbles.

// ── Bausteine (Präfix ppFx22 / PP_FX22) ─────────────────────────────────────────────────────────────────────────────────
const ppFx22Eio = (f) => (f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f));      // CSS `ease-in-out` (angenähert)
const ppFx22Zufall = (a, b) => a + Math.random() * (b - a);

// Herzen in vier Größen: `P` Fläche, `L` Glanz, `d` Schattenkante (Muster wie `love_burst`, app-fx-5.jsx)
const PP_FX22_HERZ = [
  ['PLP', 'PPP', '.d.'],
  ['PP.PP', 'PLPPP', 'PPPPP', '.PPP.', '..d..'],
  ['.PP.PP.', 'PLLPPPP', 'PLPPPPP', '.PPPPPd', '..dPPd.', '...d...'],
  ['.PPP.PPP.', 'PLLPPPPPP', 'PLPPPPPPP', 'PPPPPPPPd', '.PPPPPPd.', '..PPPPd..', '...ddd...', '....d....'],
];
/** Herz in Bildschirmpixeln Größe `px` (Schriftgröße), Mitte (x, y), Farbsatz `farbe` { P, L, d }. */
function ppFx22Herz(g, x, y, px, farbe, a = 1) {
  if (a <= 0.02 || px < 3) return;
  // Stufe nach Bildschirmpixeln wie bei Zelle 3 (Sprite 9/15/21/27 px); die Spritebreite (3/5/7/9 Zellen) folgt der Zelle des Ziels, damit das Herz auch bei Zelle 2 (720p, Handy) ~gleich groß bleibt
  const q = px < 10 ? 0 : px < 17 ? 1 : px < 24 ? 2 : 3;
  g.spr(PP_FX22_HERZ[Math.max(0, Math.min(3, Math.round(((9 + 6 * q) / (g.S || 3) - 3) / 2)))], farbe, x, y, a);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Mini Hearts (`mini_hearts`; Cute Annoyance Mini, Alias `puppet_swap_pavi`) — PIXELART. 12 lila Pixel-Herzen (14–24 px, zwei Lilatöne mit Glanz und Schattenkante) starten in einem engen Ring um die
//  Zonenmitte (14–36 px, 10 px nach unten versetzt), steigen mit eigenem Verzug (0–280 ms) und eigener Dauer (0,7–1,1 s, auf 1000 ms gekürzt) 36–68 px auf und driften seitlich (−14…+14 px).
//  Hüllkurve wie `miniHeartsFloat`: Deckung 0 → 1 (25 %) → 1 (70 %) → 0, Größe .5 → 1 → 1,05 → .85, je Abschnitt ease-out. Das Leuchten (text-shadow) entfällt.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX22_LILA = [
  { P: ppHex('#a952ff'), L: ppHex('#d6bbf1'), d: ppHex('#7e41ba') },
  { P: ppHex('#c98aff'), L: ppHex('#f1e5fa'), d: ppHex('#9544d5') },
];
const PP_FX22_HERZ_KF = [[0, [0, 0, 0, 0.5]], [0.25, [1, 0.4, 0.3, 1]], [0.7, [1, 0.85, 0.8, 1.05]], [1, [0, 1, 1, 0.85]]];   // Deckung, Anteil Drift, Anteil Aufstieg, Größe
const ppFx22MiniHearts = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const h of te.herzen) {
    const d = Math.max(60, Math.min(h.dur, 1000 - h.delay)), u = (t - h.delay) / d;
    if (u < 0 || u > 1) continue;
    const [op, fx, fy, sc] = ppKf(u, PP_FX22_HERZ_KF);
    // Die Schriftzeichen-Box sitzt mit der linken oberen Ecke auf (startX, startY): Herzmitte ≈ +0,4 / +0,55 Schriftgrößen.
    ppFx22Herz(g, cx + (h.startX + h.size * 0.4 + h.drift * fx) / S, cy + (h.startY + h.size * 0.55 - h.rise * fy) / S, h.size * sc * 0.8, PP_FX22_LILA[h.farbe], op);
  }
}, 1000, { breite: 180, hoehe: 220, ankerX: 90, ankerY: 130 }, {
  z: 10100,
  vorbereiten: () => ({
    herzen: Array.from({ length: ppFxN(12) }, () => {
      const w = Math.random() * Math.PI * 2, abstand = ppFx22Zufall(14, 36);
      return {
        startX: Math.cos(w) * abstand, startY: Math.sin(w) * abstand + 10, rise: ppFx22Zufall(36, 68), drift: ppFx22Zufall(-14, 14),
        size: ppFx22Zufall(14, 24), delay: Math.random() * 280, dur: ppFx22Zufall(700, 1100), farbe: Math.random() < 0.65 ? 0 : 1,
      };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Modifier Sparkle (`modifier_sparkle`; Stoneskin, Inconspicuous Lawn Gnome, Future Tech Magic Modifier, Alias `puppet_swap_brammi`) — PIXELART. `count` (3–18) Lila-Sternchen verteilen sich zufällig
//  über die Zone (±46 % der Breite/Höhe, mindestens 30 × 40 px), je 5–12 px groß, Verzug 0–340 ms, 560 ms Laufzeit: Größe .3 → 1,15 (40 %) → .4 und 10 px Aufstieg ab 40 %, Deckung 0 → 1 → 0
//  (ease-in-out). Statt der Farbverlauf-Scheibe: harte Scheibe (zwei Lilatöne, weißer Kern) mit vier Zacken, sobald sie groß genug ist; keine Drehung.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX22_FUNKEL = { rand: ppHex('#c98aff'), mitte: ppHex('#d6bbf1'), hell: ppHex('#e5edfa'), kern: ppHex('#ffffff') };
const PP_FX22_FUNKEL_KF = [[0, [0, 0.3, 0]], [0.4, [1, 1.15, 0]], [1, [0, 0.4, -10]]];   // Deckung, Größe, Aufstieg (px)
/** Sternchen mit Durchmesser `D` (Rasterpixel) bei (x, y). */
function ppFx22Funkel(g, x, y, D, a) {
  const C = PP_FX22_FUNKEL, r = Math.max(0.6, D * 0.46);
  x = Math.round(x); y = Math.round(y);
  g.disc(x, y, r, D >= 2 ? C.rand : C.mitte, a);
  if (D >= 2) g.disc(x, y, r * 0.66, C.mitte, a);
  if (D >= 3) {
    const arm = Math.round(r) + 2;
    g.put(x - arm, y, C.hell, a); g.put(x + arm, y, C.hell, a); g.put(x, y - arm, C.hell, a); g.put(x, y + arm, C.hell, a);
    g.disc(x, y, r * 0.34, C.hell, a);
  }
  g.put(x, y, C.kern, a);
}
const ppFx22ModifierSparkle = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const st of te.sterne) {
    const u = (t - st.delay) / 560;
    if (u < 0 || u > 1) continue;
    const [op, sc, dy] = ppKf(u, PP_FX22_FUNKEL_KF, ppFx22Eio);
    ppFx22Funkel(g, cx + (st.x + st.gr / 2) / S, cy + (st.y + st.gr / 2 + dy) / S, st.gr * sc * 1.4 / S, op);
  }
}, 900, (p) => {
  const rx = Math.max(p.w || 44, 30) * 0.46, ry = Math.max(p.h || 62, 40) * 0.46;
  return { breite: 2 * (rx + 24), hoehe: 2 * (ry + 26) };
}, {
  z: 10110,
  vorbereiten: (sz) => {
    const p = sz.props, n = Math.max(3, Math.min(p.count || 3, 18));
    const rx = Math.max(p.w || 44, 30) * 0.46, ry = Math.max(p.h || 62, 40) * 0.46;
    return { sterne: Array.from({ length: n }, () => ({ x: (Math.random() * 2 - 1) * rx, y: (Math.random() * 2 - 1) * ry, gr: ppFx22Zufall(5, 12), delay: Math.random() * 340 })) };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Looming Threat (`loom_swell`, Handkarten-Animation, `duration: 1100`) — PIXELART, der Schatten. Die ECHTE Handkarte schwillt weiter über die Klasse `loom-swell-card` an und wird dunkel (CSS, Keyframes
//  `loomSwellCard`; den Takt backt die globale Pixel-Pipeline für die EINE Karte) — Karte suchen, Klasse setzen und nach 1250 ms bzw. beim Abräumen entfernen: unverändert. Neu ist der dunkle Hof darüber
//  (vorher Farbverlauf-Ellipse 108 × 132 px): Dither-Schatten in zwei Violetttönen, Größe .9 → 1,4 (40 %) → 1,4 (60 %) → 1, Deckung 0 → 1 → 1 → 0 (ease-in-out), Dichte fällt von der Mitte (.65) über
//  .4 bei 60 % auf 0 bei 78 % des Eckenabstands — wie der radiale Verlauf, ohne Alpha.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX22_LOOM_FARBE = [ppHex('#2e0a51'), ppHex('#19062d')];
const PP_FX22_LOOM_KF = [[0, [0, 0.9]], [0.4, [1, 1.4]], [0.6, [1, 1.4]], [1, [0, 1]]];   // Deckung, Größe
const PP_FX22_LOOM_SCHATTEN = ppR1Leinwand((g, t, sz) => {
  const u = t / 1100;
  if (u > 1) return;
  const [op, sc] = ppKf(u, PP_FX22_LOOM_KF, ppFx22Eio);
  if (op <= 0.02) return;
  const S = sz.S, cx = Math.round(sz.cx), cy = Math.round(sz.cy);
  const hx = 54 * sc / S, hy = 66 * sc / S, Rx = hx * Math.SQRT2, Ry = hy * Math.SQRT2;       // Halbmaße der Box; Radien des Verlaufs („farthest-corner")
  const BX = Math.ceil(hx), BY = Math.ceil(hy);
  for (let j = -BY; j <= BY; j++) {
    if (Math.abs(j) > hy) continue;
    const v = j / Ry;
    for (let i = -BX; i <= BX; i++) {
      if (Math.abs(i) > hx) continue;
      const d = Math.sqrt((i / Rx) * (i / Rx) + v * v);
      const a = d < 0.6 ? 0.65 - 0.25 * (d / 0.6) : d < 0.78 ? 0.4 * (1 - (d - 0.6) / 0.18) : 0;
      if (a <= 0) continue;
      g.put(cx + i, cy + j, PP_FX22_LOOM_FARBE[d < 0.45 ? 0 : 1], a * op);
    }
  }
}, 1100, { breite: 192, hoehe: 228 }, {
  z: 10100,
  // Nebenwirkung 1:1: die Handkarte unter (x, y) suchen (beide Hände, nächster Mittelpunkt), Klasse setzen, nach 1250 ms bzw. beim Abräumen wieder entfernen.
  wirkung: ({ x, y }) => {
    let best = null, bestD = Infinity;
    document.querySelectorAll('.game-hand-me [data-hand-idx], .game-hand-opp [data-hand-idx]').forEach(el => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - x) + Math.abs(r.top + r.height / 2 - y);
      if (d < bestD) { bestD = d; best = el; }
    });
    if (!best || bestD > 120) return undefined;
    best.classList.add('loom-swell-card');
    const timer = setTimeout(() => best && best.classList.remove('loom-swell-card'), 1250);
    return () => { clearTimeout(timer); best && best.classList.remove('loom-swell-card'); };
  },
});
/** Hülle: Schatten-Leinwand plus die Keyframes der echten Handkarte (globales `<style>`, hängt nur an der Lebensdauer dieses Effekts — wie vorher im eigenen Block). */
function ppFx22LoomSwell(props) {
  return (
    <>
      <PP_FX22_LOOM_SCHATTEN {...props} />
      <style>{`
        .loom-swell-card { animation: loomSwellCard 1100ms ease-in-out; z-index: 50; position: relative; }
        @keyframes loomSwellCard {
          0%   { scale: 1;    filter: brightness(1)   saturate(1); }
          40%  { scale: 1.38; filter: brightness(.38) saturate(.7); }
          60%  { scale: 1.38; filter: brightness(.38) saturate(.7); }
          100% { scale: 1;    filter: brightness(1)   saturate(1); }
        }
      `}</style>
    </>
  );
}

ppFxUeberschreiben('mini_hearts', ppFx22MiniHearts);
ppFxUeberschreiben('puppet_swap_pavi', ppFx22MiniHearts);          // Alias in app-board.jsx (`ANIM_REGISTRY.puppet_swap_pavi = …mini_hearts`) hält sonst die alte Fassung
ppFxUeberschreiben('modifier_sparkle', ppFx22ModifierSparkle);
ppFxUeberschreiben('puppet_swap_brammi', ppFx22ModifierSparkle);   // dito (`puppet_swap_brammi = …modifier_sparkle`)
ppFxUeberschreiben('loom_swell', ppFx22LoomSwell);
