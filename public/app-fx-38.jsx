// app-fx-38: Alle übrigen Projektile als Pixelart-Leinwand
//
// ═════════════════════════════════════════════════════════════════
//  Betrifft `play_projectile_animation` (und `play_weapon_barrage`), soweit nicht schon app-fx-29/30 (Strahl, Feuerball, Sand) oder eine eigene Komponente (Dunkelstrahl, Surefire, Druck, Wasser,
//  Arkanpfeil) zuständig sind: Pfeil (Skeleton Archer), Speer (Javelin Throw), Energieblase (Energy Drain), Sandhandvoll (`sand`), Bombe, Kanonenkugel, Gewehrkugel, Schädel, Taube, Hammer,
//  Fels, Raketenfaust, Waschbär, Liebesherz, Liebespfeil, Bogenpfeil, Schwert — und die Waffen der Weapon Storm (Dolch, Schwert, Axt, Dreizack).
//  Vorher: Emoji bzw. SVG, gedreht und mit weichem Schein (`drop-shadow`, `radial-gradient`, `blur`), per CSS-Animation (von pixel-anim.js gebacken). Jetzt: EINE Leinwand je Schuss (Weapon Storm: eine für
//  alle Waffen), Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s auf dem globalen Takt, feste Paletten-Farben, kein Alpha, kein Weichzeichner, keine gedrehten Bilder:
//    • Jedes Geschoss ist eine Form aus Formeln (`ppFx38Formen`), einmal je (Art, Größe, Winkel) auf ein Zellgitter gerastert (harte Zellen, ein Rand aus Tinte) und gemerkt. Ausgerichtete Formen
//      (Pfeil, Speer, Schwert, Axt …) werden dabei GERASTERT gedreht — jede Zelle fragt die Form an ihrem gedrehten Ort — nie ein Bild gedreht. Der Hammer wirbelt in 36°-Schritten (10 Gitter).
//    • Weg wie die alte CSS-Fahrt (`projectileFly`): erst kurz sichtbar an der Quelle (10 %), dann anfahrend (ease-in) zum Ziel (bis 85 %), dort blinkt es aus (dither-artig: jedes zweite Bild).
//    • Schweif (rein zeitabhängig, keine Zustände): Teilchen aus quadratischen Zellen, die am Weg zurückbleiben und in Stufen ausglühen — Glut (Standard), Staub (Fels, Waschbär), Rosa (Herzen),
//      Raketenabgase (Faust), Federn (Taube), Rauch + Lunte (Bombe).
//  Aufruf: ppFx38({ s: [{ art, fs, sx, sy, tx, ty, dur, t0, ang, spiegel, farbe, kein, schweif }…] }) in Fensterkoordinaten; gibt eine Abbruchfunktion oder null (dann läuft der alte Pfad).
//  `ppFx38Art(ev)` ordnet ein Ereignis (Emoji/Form/Klasse) einer Art zu, sonst null.
// ═════════════════════════════════════════════════════════════════
const PP_FX38_C = {
  creme: ppHex('#fffbd2'), gelb: ppHex('#ffe23d'), org: ppHex('#ff9a1a'), rot: ppHex('#fe5154'), dunkel: ppHex('#8b0d0d'),
  tinte: ppHex('#12101f'), rauch: ppHex('#3e3e51'), asche: ppHex('#59606e'), grau: ppHex('#9aa3b6'), hell: ppHex('#d2d2db'), weiss: ppHex('#ffffff'),
  braun: ppHex('#9d612f'), braunH: ppHex('#ca874e'), sand: ppHex('#e0c085'), rosa: ppHex('#f8b4df'), pink: ppHex('#f174ab'), magenta: ppHex('#c80480'),
  haut: ppHex('#e0c085'), gold: ppHex('#c79e05'), gruen: ppHex('#4ceb70'),
};
const PP_FX38_S = 3;                       // Bildschirmpixel je Rasterzelle
const PP_FX38_TAKT = 1000 / 30;
const ppFx38Hash = (a, b) => ppFx30H(a, b);
const ppFx38Kl = (v, a, b) => Math.max(a, Math.min(b, v));

// ── Formen: Gitterfarbe 0 = leer, 1.. = Eintrag der Palette der Art; (u, v) in Zellen, u = vorwärts, v = abwärts; R = halbe Größe in Zellen ──
const ppFx38Scheibe = (u, v, cx, cy, r) => { const a = u - cx, b = v - cy; return a * a + b * b <= r * r; };
const ppFx38Streifen = (u, v, u0, u1, v0, v1) => u >= u0 && u <= u1 && v >= v0 && v <= v1;
const ppFx38Dreieck = (u, v, ax, ay, bx, by, cx, cy) => {      // Punkt im Dreieck
  const d1 = (u - bx) * (ay - by) - (ax - bx) * (v - by), d2 = (u - cx) * (by - cy) - (bx - cx) * (v - cy), d3 = (u - ax) * (cy - ay) - (cx - ax) * (v - ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
const PP_FX38_FORMEN = {
  // Kugeln
  kugel: { pal: ['asche', 'grau', 'rauch'], f: (u, v, R) => {
    if (!ppFx38Scheibe(u, v, 0, 0, R * 0.95)) return 0;
    if (ppFx38Scheibe(u, v, -0.3 * R, -0.35 * R, 0.24 * R)) return 2;                                    // Glanzpunkt
    if (u + v > 0.45 * R) return (((Math.round(u) + Math.round(v)) & 1) ? 3 : 1);                         // Schatten unten rechts, gedithert
    return 1;
  } },
  geschoss: { pal: ['gold', 'creme', 'org'], f: (u, v, R) => {
    if (!ppFx38Scheibe(u, v, 0, 0, R * 0.8)) return 0;
    if (ppFx38Scheibe(u, v, 0.05 * R, 0, R * 0.38)) return 2;
    return u + v > 0.2 * R ? 3 : 1;
  } },
  bombe: { pal: ['rauch', 'grau', 'braun', 'asche'], f: (u, v, R) => {
    const cy = 0.2 * R, r = 0.72 * R;
    if (ppFx38Scheibe(u, v, 0, cy, r)) {
      if (ppFx38Scheibe(u, v, -0.28 * r, cy - 0.3 * r, 0.22 * r)) return 2;
      if (u + (v - cy) > 0.5 * r) return (((Math.round(u) + Math.round(v)) & 1) ? 4 : 1);
      return 1;
    }
    if (ppFx38Streifen(u, v, -0.2 * R, 0.2 * R, cy - r - 0.12 * R, cy - r * 0.8)) return 4;                // Hals
    const uc = (-0.5 * R - v) * 0.9;
    if (v <= -0.5 * R && v >= -0.9 * R && Math.abs(u - uc) <= 0.55) return 3;                              // Lunte
    return 0;
  } },
  schaedel: { pal: ['creme', 'hell', 'tinte', 'grau'], f: (u, v, R) => {
    const kopf = (u * u) / ((0.7 * R) * (0.7 * R)) + ((v + 0.2 * R) * (v + 0.2 * R)) / ((0.62 * R) * (0.62 * R)) <= 1;
    const kiefer = ppFx38Streifen(u, v, -0.4 * R, 0.4 * R, 0.25 * R, 0.78 * R);
    if (!kopf && !kiefer) return 0;
    if (ppFx38Scheibe(u, v, -0.28 * R, -0.12 * R, 0.19 * R) || ppFx38Scheibe(u, v, 0.28 * R, -0.12 * R, 0.19 * R)) return 3;   // Augenhöhlen
    if (ppFx38Dreieck(u, v, 0, 0.05 * R, -0.09 * R, 0.24 * R, 0.09 * R, 0.24 * R)) return 3;                               // Nase
    if (kiefer && v > 0.42 * R && Math.abs((u + 0.4 * R) % (0.2 * R)) < 0.5) return 4;                                    // Zähne (Fugen)
    return (u + v > 0.55 * R) ? 2 : 1;
  } },
  fels: { pal: ['asche', 'grau', 'rauch', 'hell'], f: (u, v, R) => {
    const w = Math.atan2(v, u), r = R * (0.72 + 0.28 * ppFx38Hash(Math.floor((w + Math.PI) * 1.6), 7));
    if (u * u + v * v > r * r) return 0;
    if (u + v < -0.5 * R && ((Math.round(u) + Math.round(v)) & 1) === 0) return 4;
    return (u + v > 0.35 * R) ? 3 : 1;
  } },
  taube: { pal: ['weiss', 'hell', 'org', 'tinte'], f: (u, v, R, va) => {
    if (va & 1) u = -u;
    if (ppFx38Scheibe(u, v, 0.42 * R, -0.22 * R, 0.24 * R)) return (ppFx38Scheibe(u, v, 0.5 * R, -0.26 * R, 0.5) ? 4 : 1);   // Kopf + Auge
    if (ppFx38Dreieck(u, v, 0.62 * R, -0.28 * R, 0.62 * R, -0.12 * R, 0.92 * R, -0.18 * R)) return 3;                      // Schnabel
    if (ppFx38Dreieck(u, v, -0.15 * R, -0.05 * R, -0.65 * R, -0.95 * R, 0.25 * R, -0.05 * R)) return 2;                    // Flügel oben
    if ((u * u) / ((0.55 * R) * (0.55 * R)) + ((v - 0.03 * R) * (v - 0.03 * R)) / ((0.3 * R) * (0.3 * R)) <= 1) return 1;  // Körper
    if (ppFx38Dreieck(u, v, -0.45 * R, 0, -0.95 * R, -0.12 * R, -0.95 * R, 0.3 * R)) return 2;                             // Schwanz
    return 0;
  } },
  hammer: { pal: ['grau', 'hell', 'braun', 'asche'], f: (u, v, R) => {
    if (ppFx38Streifen(u, v, 0.3 * R, 0.9 * R, -0.45 * R, 0.45 * R)) return (v < -0.2 * R ? 2 : (u > 0.7 * R ? 4 : 1));   // Kopf
    if (ppFx38Streifen(u, v, -0.9 * R, 0.3 * R, -0.5, 0.5)) return 3;                                                      // Stiel
    return 0;
  } },
  faust: { pal: ['haut', 'org', 'creme', 'dunkel'], f: (u, v, R) => {
    const x = Math.max(Math.abs(u) - 0.38 * R, 0), y = Math.max(Math.abs(v) - 0.3 * R, 0), koerper = x * x + y * y <= (0.3 * R) ** 2 && Math.abs(u) <= 0.68 * R && Math.abs(v) <= 0.6 * R;
    const daumen = ppFx38Streifen(u, v, -0.6 * R, -0.05 * R, -0.85 * R, -0.5 * R);
    if (!koerper && !daumen) return 0;
    if (koerper && u > -0.05 * R && [-0.36, -0.12, 0.12, 0.36].some((q) => Math.abs(v - q * R) < 0.5)) return 4;     // Fingerfugen
    if (koerper && v > 0.38 * R) return 2;                                                                            // Schatten unten
    if (koerper && u < -0.3 * R && v < -0.1 * R && v > -0.4 * R) return 3;                                            // Glanz
    return 1;
  } },
  waschbaer: { pal: ['grau', 'asche', 'tinte', 'weiss'], f: (u, v, R) => {
    if (ppFx38Scheibe(u, v, -0.5 * R, -0.62 * R, 0.26 * R) || ppFx38Scheibe(u, v, 0.5 * R, -0.62 * R, 0.26 * R)) return 2;  // Ohren
    if (!ppFx38Scheibe(u, v, 0, 0.03 * R, 0.78 * R)) return 0;
    if (ppFx38Scheibe(u, v, -0.3 * R, -0.12 * R, 0.5) || ppFx38Scheibe(u, v, 0.3 * R, -0.12 * R, 0.5)) return 4;           // Augen
    if (ppFx38Streifen(u, v, -0.68 * R, 0.68 * R, -0.28 * R, 0.05 * R)) return 3;                                          // Maske
    if (ppFx38Streifen(u, v, -0.5, 0.5, 0.22 * R, 0.3 * R + 0.5)) return 3;                                                // Nase
    if (ppFx38Scheibe(u, v, 0, 0.38 * R, 0.3 * R)) return 4;                                                               // Schnauze
    return 1;
  } },
  herz: { pal: ['pink', 'rosa', 'magenta', 'weiss'], f: (u, v, R) => {
    const x = u / (0.85 * R), y = -(v / (0.8 * R)) + 0.12, a = x * x + y * y - 1;
    if (a * a * a - x * x * y * y * y > 0) return 0;
    if (ppFx38Scheibe(u, v, -0.38 * R, -0.3 * R, 0.17 * R)) return 4;
    if (u + v > 0.45 * R) return (((Math.round(u) + Math.round(v)) & 1) ? 3 : 1);
    if (u + v < -0.3 * R) return 2;
    return 1;
  } },
  // ausgerichtete Formen (u = Flugrichtung)
  liebespfeil: { rot: true, pal: ['pink', 'rosa', 'magenta', 'braun'], f: (u, v, R) => {
    if (ppFx38Dreieck(u, v, 0.55 * R, -0.34 * R, 1.0 * R, 0, 0.55 * R, 0.34 * R)) return 1;                                  // Spitze
    if (ppFx38Streifen(u, v, -0.7 * R, 0.6 * R, -0.5, 0.5)) return 4;                                                         // Schaft
    if (ppFx38Scheibe(u, v, -0.82 * R, -0.22 * R, 0.24 * R) || ppFx38Scheibe(u, v, -0.82 * R, 0.22 * R, 0.24 * R)) return 2; // Herz hinten
    if (ppFx38Dreieck(u, v, -1.0 * R, -0.34 * R, -1.0 * R, 0.34 * R, -0.62 * R, 0)) return 3;
    return 0;
  } },
  pfeil: { rot: true, pal: ['hell', 'grau', 'asche', 'braunH'], f: (u, v, R, va) => {
    const hw = Math.max(1.6, R * 0.2), schaft = (va & 1) ? 4 : 2;
    if (ppFx38Dreieck(u, v, 0.55 * R, -hw, 1.0 * R, 0, 0.55 * R, hw)) return 1;                                              // Spitze
    if (ppFx38Streifen(u, v, -0.7 * R, 0.6 * R, -0.5, 0.5)) return schaft;                                                  // Schaft
    if (ppFx38Dreieck(u, v, -1.0 * R, -hw, -0.62 * R, 0, -1.0 * R, hw)) return 3;                                           // Befiederung
    if (ppFx38Dreieck(u, v, -0.8 * R, -hw, -0.42 * R, 0, -0.8 * R, hw)) return 2;
    return 0;
  } },
  speer: { rot: true, pal: ['hell', 'grau', 'braunH', 'asche'], f: (u, v, R) => {
    if (ppFx38Dreieck(u, v, 0.58 * R, 0, 0.7 * R, -1.3, 0.7 * R, 1.3) || ppFx38Dreieck(u, v, 0.7 * R, -1.3, 1.0 * R, 0, 0.7 * R, 1.3)) return v < 0 ? 1 : 2;   // Blatt (Raute)
    if (ppFx38Streifen(u, v, 0.5 * R, 0.62 * R, -1.1, 1.1)) return 4;                                                                                           // Zwinge
    if (ppFx38Streifen(u, v, -1.0 * R, 0.55 * R, -0.5, 0.5)) return 3;                                                                                           // Schaft
    return 0;
  } },
  schwert: { rot: true, pal: ['hell', 'grau', 'gold', 'braun'], f: (u, v, R) => {
    if (ppFx38Dreieck(u, v, 0.85 * R, -0.22 * R - 0.4, 1.0 * R, 0, 0.85 * R, 0.22 * R + 0.4)) return 1;
    if (ppFx38Streifen(u, v, -0.15 * R, 0.85 * R, -0.22 * R - 0.4, 0.22 * R + 0.4)) return (v > 0 ? 2 : 1);                  // Klinge
    if (ppFx38Streifen(u, v, -0.3 * R, -0.1 * R, -0.55 * R, 0.55 * R)) return 3;                                              // Parierstange
    if (ppFx38Streifen(u, v, -0.85 * R, -0.3 * R, -0.5, 0.5)) return 4;                                                      // Griff
    if (ppFx38Scheibe(u, v, -0.95 * R, 0, 0.5 + 0.1 * R)) return 3;                                                          // Knauf
    return 0;
  } },
  dolch: { rot: true, pal: ['hell', 'grau', 'gold', 'braun'], f: (u, v, R) => {
    if (ppFx38Dreieck(u, v, 0.2 * R, -0.26 * R - 0.4, 1.0 * R, 0, 0.2 * R, 0.26 * R + 0.4)) return v > 0 ? 2 : 1;
    if (ppFx38Streifen(u, v, -0.05 * R, 0.2 * R, -0.5 * R, 0.5 * R)) return 3;
    if (ppFx38Streifen(u, v, -0.8 * R, -0.05 * R, -0.5, 0.5)) return 4;
    return 0;
  } },
  axt: { rot: true, pal: ['grau', 'hell', 'braun', 'asche'], f: (u, v, R) => {
    if (ppFx38Streifen(u, v, -0.9 * R, 0.8 * R, -0.5, 0.5)) return 3;
    const a = (u - 0.35 * R) / (0.35 * R), b = v / (0.85 * R);
    if (a * a + b * b <= 1 && u >= 0.15 * R) return v < -0.3 * R ? 2 : (u > 0.55 * R ? 4 : 1);
    return 0;
  } },
  dreizack: { rot: true, pal: ['gold', 'gelb', 'org', 'braun'], f: (u, v, R) => {
    if (ppFx38Streifen(u, v, -0.9 * R, 0.5 * R, -0.5, 0.5)) return 4;
    if (ppFx38Streifen(u, v, 0.4 * R, 0.55 * R, -0.55 * R, 0.55 * R)) return 3;                                             // Quersteg
    if (ppFx38Streifen(u, v, 0.5 * R, 1.0 * R, -0.5, 0.5)) return 1;                                                         // Mittelzinke
    if (ppFx38Streifen(u, v, 0.5 * R, 0.9 * R, -0.58 * R - 0.5, -0.58 * R + 0.5) || ppFx38Streifen(u, v, 0.5 * R, 0.9 * R, 0.58 * R - 0.5, 0.58 * R + 0.5)) return 2;
    return 0;
  } },
};

const PP_FX38_GITTER = new Map();
/** Form auf ein Zellgitter rastern (zellweise gedreht), Rand aus Tinte; gemerkt je Art/Größe/Winkel/Variante. */
function ppFx38Gitter(art, R, wi, va, farben) {
  const key = art + '|' + R + '|' + wi + '|' + va + '|' + (farben || '');
  let g = PP_FX38_GITTER.get(key);
  if (g) return g;
  const F = PP_FX38_FORMEN[art], ext = Math.ceil(R * 1.15 + 3), N = ext * 2 + 1;
  const ca = Math.cos(wi * Math.PI / 180), sa = Math.sin(wi * Math.PI / 180);
  const c = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x - ext, dy = y - ext;
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    c[y * N + x] = F.f(u, v, R, va);
  }
  const rand = 255;                                              // Rand = Tinte, nur um Formen, die keinen eigenen dunklen Rand haben
  const out = new Uint8Array(c);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (c[y * N + x]) continue;
    if ((x > 0 && c[y * N + x - 1]) || (x < N - 1 && c[y * N + x + 1]) || (y > 0 && c[(y - 1) * N + x]) || (y < N - 1 && c[(y + 1) * N + x])) out[y * N + x] = rand;
  }
  g = { N, ext, c: out, pal: (farben || F.pal).map((n) => (typeof n === 'string' ? PP_FX38_C[n] : n)) };
  PP_FX38_GITTER.set(key, g);
  return g;
}
const PP_FX38_RAND = ppHex('#12101f');

// ── Schweife ──
const PP_FX38_RAMPEN = {
  glut: [PP_FX38_C.creme, PP_FX38_C.gelb, PP_FX38_C.org, PP_FX38_C.rot],
  staub: [PP_FX38_C.grau, PP_FX38_C.asche, PP_FX38_C.rauch, PP_FX38_C.tinte],
  braun: [PP_FX38_C.sand, PP_FX38_C.braunH, PP_FX38_C.braun, PP_FX38_C.rauch],
  rosa: [PP_FX38_C.weiss, PP_FX38_C.rosa, PP_FX38_C.pink, PP_FX38_C.magenta],
  weiss: [PP_FX38_C.weiss, PP_FX38_C.hell, PP_FX38_C.grau, PP_FX38_C.asche],
  rauch: [PP_FX38_C.grau, PP_FX38_C.asche, PP_FX38_C.rauch, PP_FX38_C.tinte],
  blase: [PP_FX38_C.weiss, PP_FX38_C.gruen, PP_FX38_C.gruen, PP_FX38_C.asche],
};
// Art → Standardschweif
const PP_FX38_SCHWEIF = { kugel: 'rauch', geschoss: 'glut', bombe: 'rauch', schaedel: 'rauch', fels: 'staub', taube: 'weiss', hammer: 'glut', faust: 'rakete', waschbaer: 'braun', herz: 'rosa', liebespfeil: 'rosa', pfeil: null, speer: null, schwert: 'glut', dolch: 'glut', axt: 'glut', dreizack: 'glut', blase: null, sand: null };

/** Emoji/Form/Klasse → Art (oder null: alter Pfad). */
function ppFx38Art(ev) {
  const e = String(ev.emoji || '').replace(/️/g, '');
  if (ev.projectileShape) return ({ arrow: 'pfeil', javelin: 'speer', bubble: 'blase', sand: 'sand' })[ev.projectileShape] || null;
  if (ev.projectileClass) return ev.projectileClass === 'projectile-love-heart' ? 'herz' : null;
  return ({ '💣': 'bombe', '⚫': 'kugel', '•': 'geschoss', '💀': 'schaedel', '🕊': 'taube', '🔨': 'hammer', '🪨': 'fels', '🤜': 'faust', '🦝': 'waschbaer', '💘': 'liebespfeil',
    '🏹': 'pfeil', '⚔': 'schwert', '🗡': 'dolch', '🪓': 'axt', '🔱': 'dreizack' })[e] || null;
}

const PP_FX38_STANDARD_FS = { kugel: 46, geschoss: 26, bombe: 32, schaedel: 40, taube: 22, hammer: 28, fels: 26, faust: 42, waschbaer: 72, herz: 96, liebespfeil: 44, pfeil: 28, schwert: 30, dolch: 28, axt: 28, dreizack: 28 };
const PP_FX38_FAKTOR = { kugel: 0.5, geschoss: 0.55, bombe: 0.6, schaedel: 0.6, taube: 1.15, hammer: 0.95, fels: 0.55, faust: 0.62, waschbaer: 0.55, herz: 0.45, liebespfeil: 0.8, pfeil: 0.85, schwert: 0.8, dolch: 0.75, axt: 0.7, dreizack: 0.75 };
/** Halbgröße in Zellen aus der Schriftgröße des Emojis. */
function ppFx38R(art, fs) {
  const f = typeof fs === 'string' ? parseFloat(fs) : fs;
  const px = f > 0 ? f : PP_FX38_STANDARD_FS[art] || 40;
  return ppFx38Kl(Math.round(px * (PP_FX38_FAKTOR[art] || 0.6) / PP_FX38_S), 2, 16);
}

/**
 * Ein Schuss / eine Salve. `o.s` = Liste von Geschossen:
 *   { art, fs, sx, sy, tx, ty, dur (ms), t0 (ms Versatz), ang (Grad, sonst Flugrichtung), spiegel, farbe ({hi,mid,lo,glow} der Blase), kein (kein Schweif), schweif, groesse }
 */
function ppFx38(o) {
  try {
    if (!o || !o.s || !o.s.length || window._playAnimations === false) return null;
    const S = PP_FX38_S, rd = Math.round, H = ppFx38Hash;
    const fo = window.ppFxScrollOffset ? window.ppFxScrollOffset() : { dx: 0, dy: 0 };
    const welt = !!window.ppFxWeltSchicht;
    const salz = Math.floor(Math.random() * 1e6);
    const L = [];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, ende = 0;
    for (let i = 0; i < o.s.length; i++) {
      const p = o.s[i];
      if (![p.sx, p.sy, p.tx, p.ty].every(isFinite)) continue;
      const art = p.art;
      const R = art === 'blase' ? ppFx38Kl(Math.round((parseFloat(p.fs) || 14) / 5.5), 2, 4) : (art === 'sand' ? 8 : ppFx38R(art, p.fs));
      const ax = p.sx + fo.dx, ay = p.sy + fo.dy, bx = p.tx + fo.dx, by = p.ty + fo.dy;
      const wi = rd(p.ang != null ? p.ang : Math.atan2(by - ay, bx - ax) * 180 / Math.PI);
      const dur = Math.max(120, p.dur || 600);
      const marg = (R * 2.6 + 12) * S;
      x0 = Math.min(x0, ax - marg, bx - marg); y0 = Math.min(y0, ay - marg, by - marg); x1 = Math.max(x1, ax + marg, bx + marg); y1 = Math.max(y1, ay + marg, by + marg);
      ende = Math.max(ende, (p.t0 || 0) + dur + 400);
      L.push({ p, art, R, ax, ay, bx, by, wi, dur, t0: p.t0 || 0, id: i * 977 + salz % 9973, schweif: p.kein ? null : (p.schweif !== undefined ? p.schweif : PP_FX38_SCHWEIF[art]) });
    }
    if (!L.length) return null;
    const lx = Math.floor(x0 / S) * S, ly = Math.floor(y0 / S) * S;
    const gw = Math.min(900, Math.ceil((x1 - lx) / S)), gh = Math.min(700, Math.ceil((y1 - ly) / S));
    if (gw < 8 || gh < 8) return null;
    for (const q of L) { q.AX = (q.ax - lx) / S; q.AY = (q.ay - ly) / S; q.BX = (q.bx - lx) / S; q.BY = (q.by - ly) / S; }
    const wurzel = document.createElement('div');
    wurzel.setAttribute('aria-hidden', 'true'); wurzel.setAttribute('data-pp-px', 'aus');
    wurzel.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;pointer-events:none;z-index:10120;`;
    const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh;
    cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
    wurzel.appendChild(cv);
    const ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), m = ppFx30Maler(img.data, gw, gh);

    // Lage zur Zeit ms (relativ zum Start des Geschosses): 0–10 % an der Quelle, 10–85 % anfahrend, ab 85 % am Ziel
    const lage = (q, ms) => {
      const u = ms / q.dur, e = u <= 0.1 ? 0 : (u >= 0.85 ? 1 : Math.pow((u - 0.1) / 0.75, 1.7));
      return [q.AX + (q.BX - q.AX) * e, q.AY + (q.BY - q.AY) * e];
    };
    const zeichneGitter = (g, X, Y, schablone) => {
      const N = g.N, e = g.ext, c = g.c, pal = g.pal;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const k = c[y * N + x];
        if (!k) continue;
        m.rect(X - e + x, Y - e + y, 1, 1, k === 255 ? PP_FX38_RAND : pal[k - 1]);
      }
    };
    const malen = (T) => {
      const frame = Math.floor(T / PP_FX38_TAKT + 1e-4);
      for (const q of L) {
        const ms = T - q.t0, art = q.art;
        if (ms < 0 || ms > q.dur + 200) continue;
        const u = ms / q.dur, [X0, Y0] = lage(q, ms), X = rd(X0), Y = rd(Y0);
        // Schweif (rein zeitabhängig): Teilchen werden in Zeitschlitzen (40/s) geboren und bleiben am Weg zurück
        if (q.schweif && ms > 0) {
          const lebt = 280, slot0 = Math.floor(ms / 25);
          if (q.schweif === 'rakete') {
            const dx = q.BX - q.AX, dy = q.BY - q.AY, d = Math.hypot(dx, dy) || 1, fx = dx / d, fy = dy / d;
            const ramp = PP_FX38_RAMPEN.glut;
            for (let k = 0; k < 14; k++) {
              const a = k * 0.55, w = (frame + k) & 3, br = Math.max(1, rd((1 - k / 15) * (q.R * 0.5)) + (((w & 1) && k > 3) ? 0 : 1));
              const fxp = X - fx * (q.R * 0.7 + k * 1.6) + ((H(k, frame >> 1) - 0.5) * 1.5), fyp = Y - fy * (q.R * 0.7 + k * 1.6) + ((H(k + 40, frame >> 1) - 0.5) * 1.5);
              void a;
              m.rect(rd(fxp - br / 2), rd(fyp - br / 2), br, br, ramp[Math.min(3, (k / 4) | 0)]);
            }
          } else {
            const ramp = PP_FX38_RAMPEN[q.schweif] || PP_FX38_RAMPEN.glut;
            for (let k = 0; k < 14; k++) {
              const s = slot0 - k, tb = s * 25, a = ms - tb;
              if (s < 0 || a < 0 || a > lebt) continue;
              const [bx2, by2] = lage(q, tb), uu = a / lebt;
              const sz = uu < 0.5 ? (q.R > 6 ? 2 : 1) : 1;
              const px = rd(bx2 + (H(s + q.id, 1) - 0.5) * q.R * 0.9), py = rd(by2 + (H(s + q.id, 2) - 0.5) * q.R * 0.9 - uu * 3);
              if (uu > 0.65 && ((px + py + frame) & 1)) continue;                    // Ausklang: Schachbrett-Blinken statt Alpha
              m.rect(px, py, sz, sz, ramp[Math.min(3, (uu * 4) | 0)]);
            }
          }
        }
        if (u > 0.85 && (frame & 1)) continue;                                      // Ausblinken am Ziel (jedes zweite Bild)
        if (ms < 66 && (frame & 1)) continue;                                       // Einblinken an der Quelle
        if (art === 'blase') {
          const f = q.p.farbe || {};
          const hi = ppFx38Farbe(f.hi, 'gruenH'), mid = ppFx38Farbe(f.mid, 'gruen'), lo = ppFx38Farbe(f.lo, 'gruenD'), gl = ppFx38Farbe(f.glow, 'gruen'), r = q.R;
          m.disc(X, Y, r, lo); m.disc(X, Y, r - 1, mid); m.rect(X - r + 2, Y - r + 1, 2, 1, PP_FX38_C.weiss); m.rect(X - r + 1, Y - r + 2, 1, 1, hi);
          if (frame & 1) { m.rect(X - r - 1, Y, 1, 1, gl); m.rect(X + r + 1, Y, 1, 1, gl); m.rect(X, Y - r - 1, 1, 1, gl); m.rect(X, Y + r + 1, 1, 1, gl); }
          continue;
        }
        if (art === 'sand') {                                                       // Handvoll Körner, die beim Flug auffächert
          const farbe = [PP_FX38_C.creme, PP_FX38_C.sand, PP_FX38_C.braunH, PP_FX38_C.braun];
          const dx = q.BX - q.AX, dy = q.BY - q.AY, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, fl = ppFx38Kl((u - 0.1) / 0.75, 0, 1);
          for (let k = 0; k < 26; k++) {
            const a = H(k, q.id) * 6.283, r = Math.sqrt(H(k, q.id + 1)) * (4 + fl * 6), g = H(k, q.id + 2) < 0.3 ? 2 : 1;
            m.rect(rd(X0 + Math.cos(a) * r * 1.2 + nx * 0 - dx / d * H(k, 5) * 4), rd(Y0 + Math.sin(a) * r * 0.8 + ny * 0 - dy / d * H(k, 6) * 4), g, g, farbe[k & 3]);
          }
          continue;
        }
        let wi = q.wi, va = q.p.spiegel ? 1 : 0;
        const F = PP_FX38_FORMEN[art];
        if (art === 'hammer') wi = ((frame * 36) % 360);
        else if (!F.rot) wi = 0;
        else if (art === 'pfeil' && q.p.farbe === 'bogen') va = 1;
        const Rz = art === 'herz' ? q.R + ((frame >> 2) & 1) : q.R;                  // Herz pocht (zwei Größen im Viertakt)
        const g = ppFx38Gitter(art, Rz, wi, va, art === 'geschoss' && q.p.farbe ? ppFx38Geschossfarben(q.p.farbe) : null);
        zeichneGitter(g, X, Y);
        if (art === 'bombe') {                                                      // Lunte sprüht
          const sx2 = X + rd(0.36 * q.R), sy2 = Y - rd(0.9 * q.R), w = frame & 3, ramp = PP_FX38_RAMPEN.glut;
          m.rect(sx2, sy2, 1, 1, ramp[w]); if (w < 2) { m.rect(sx2 - 1, sy2, 1, 1, ramp[w + 1]); m.rect(sx2 + 1, sy2, 1, 1, ramp[w + 1]); m.rect(sx2, sy2 - 1, 1, 1, ramp[w + 1]); }
        }
      }
    };
    const fertig = () => { for (const q of L) if (!q.fertig) return false; return true; };
    if (o.trocken) return [0.05, 0.3, 0.6, 0.9].map((f) => () => { m.d.x0 = gw; m.d.y0 = gh; m.d.x1 = 0; m.d.y1 = 0; img.data.fill(0); malen(f * ende); });
    (welt ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel);
    const takt = window.ppTaktRaf || window.requestAnimationFrame, t0 = performance.now();
    let raf = 0, letzte = -1, vor = null, aus = false;
    const stopp = () => { if (aus) return; aus = true; try { cancelAnimationFrame(raf); } catch {} wurzel.remove(); };
    const schritt = (jetzt) => {
      if (aus) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = jetzt - t0;
      if (ms >= ende) { stopp(); return; }
      const fr = Math.floor(jetzt / PP_FX38_TAKT);
      if (fr !== letzte) {
        letzte = fr;
        const d = m.d, buf = img.data;
        if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); }
        d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
        malen(Math.floor(Math.max(0, ms) / PP_FX38_TAKT + 1e-6) * PP_FX38_TAKT);
        const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
        if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
        vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
      }
      raf = takt(schritt);
    };
    void fertig;
    raf = takt(schritt);
    setTimeout(stopp, ende + 1500);
    return stopp;
  } catch (e) { try { console.warn('ppFx38', e); } catch {} return null; }
}

/** CSS-Farbe (Hex/rgb) → [r,g,b]; sonst Standard aus der Palette. */
function ppFx38Farbe(c, std) {
  try {
    if (typeof c === 'string') {
      const h = /#([0-9a-f]{6})/i.exec(c);
      let hex = h ? '#' + h[1] : null;
      if (!hex) { const r = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(c); if (r) hex = '#' + [r[1], r[2], r[3]].map((v) => ('0' + (+v).toString(16)).slice(-2)).join(''); }
      if (hex) return ppHex(window.ppSnap ? window.ppSnap(hex) : hex);       // Laufzeitfarbe → Palette
    }
  } catch (e) { /* Standard */ }
  return PP_FX38_C[std];
}
function ppFx38Geschossfarben(c) {
  const k = ppFx38Farbe(c, 'haut');
  return [k, PP_FX38_C.creme, PP_FX38_C.org];
}
window.ppFx38 = ppFx38;
window.ppFx38Art = ppFx38Art;
window.ppFx38Gitter = ppFx38Gitter;
window.PP_FX38_FORMEN = PP_FX38_FORMEN;
