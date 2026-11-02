// Pixelart-Portierungen (Canvas), Batch 25 (dritte Welle, alle übrigen Effekte): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
//   snake_impact · spectral_armor · thought_bubbles · tiger_impact
// Gemeinsame Bausteine tragen das Präfix `ppFx25` / `PP_FX25_` (die Dateien teilen sich den globalen Namensraum). Je Effekt EINE Leinwand (`ppR1Leinwand`): ein Rasterpixel = 3 Bildschirmpixel,
// 30 Bilder/s, Palettenfarben, Bayer-Dithering statt Alpha, Symbole als Geometrie je Größe (Pixel werden einzeln berechnet; kein skaliertes Bild, keine Emojis), kein Weichzeichner.
//
// NICHT portiert (Grund):
//   · Läuft schon auf Canvas (ppSalve / ppPunktBild / eigene <canvas>): spearman_thrust, spellbook_pages, tidal_wave, time_distortion, trap_burn, the_melting, statue_magic (ppSalve);
//     spell_shackle_chains, spy_mark, tail_slap_hit, udp_impact (ppPunktBild); stowaway_tentacles (eigene Leinwand in der Komponente).
//   · stranglehold_squeeze: die Komponente zeichnet nichts (`return null`), sie setzt nach 50 ms nur die Klasse `.stranglehold-squeezed` an die Zielzone (Quetschen der echten Karte per CSS, 1200 ms).
//     Das ist untrennbar an das DOM-Element gebunden → unverändert gelassen.
// Zonen-Animationen laufen beim Aufrufer 1000 ms (`onZoneAnim`, ohne `duration`): die DOM-Fassungen von Tiger, Schlange und Gedankenblasen wurden dort hart abgeschnitten (1,2 s bzw. bis 1,3 s lang);
// die Zeitachsen hier sind auf die Aufruferdauer gerafft und enden bei ~960 ms.

// ── Bausteine ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Keyframes mit Weich-Übergang (wie `ease-in-out` je Abschnitt): st = [[Anteil 0..1, Wert], …]. */
function ppFx25Kf(q, st, e) {
  if (q <= st[0][0]) return st[0][1];
  for (let i = 1; i < st.length; i++) {
    if (q <= st[i][0]) {
      const a = st[i - 1], b = st[i];
      let u = (q - a[0]) / ((b[0] - a[0]) || 1);
      if (e) u = e(u);
      return a[1] + (b[1] - a[1]) * u;
    }
  }
  return st[st.length - 1][1];
}
const ppFx25Aus = (u) => 1 - (1 - u) * (1 - u);                     // CSS „ease-out" (grob)
const PP_FX25_AUSSEN = ppHex('#141414');

// ═════════════════════════════════════════════════════════════════
//  Ferocious Tiger Kick (`tiger_impact`; Zonen-Animation am Ziel) — PIXELART. Wie vorher (1,2 s): ein Tigerkopf (🐯, 64 px) wächst .3 → 1,2 → 1 (20 % / 35 %), steht und blendet bis 1,3 aus.
//  Der Kopf ist Geometrie je Größe (Ellipsen, Streifen und Gesicht je Rasterpixel aus Radius berechnet, dunkler Umriss) — kein skaliertes Bild. Gerafft auf 960 ms (Aufruferdauer 1000 ms).
// ═════════════════════════════════════════════════════════════════
const PP_FX25_TIGER = { fell: ppHex('#f29a3e'), schatten: ppHex('#ee6428'), weiss: ppHex('#ffffff'), weissSchatten: ppHex('#d2d2db'), streifen: ppHex('#222222'), ohr: ppHex('#e58092'), nase: ppHex('#710122'), auge: ppHex('#141414'), licht: ppHex('#fad54a') };
/** Farbe des Tigerkopfes im Punkt (u, v) in Einheiten des Radius R (R in Rasterpixeln; null = außerhalb). */
function ppFx25TigerFarbe(u, v, R) {
  const C = PP_FX25_TIGER, m = 0.55 / R;                                   // Mindestbreite eines Strichs: ein Rasterpixel
  const balken = (x, c, hw) => Math.abs(x - c) <= Math.max(hw, m);
  const kopf = (u * u) / (0.92 * 0.92) + ((v - 0.1) * (v - 0.1)) / (0.8 * 0.8) <= 1;
  if (!kopf) {
    const au = Math.abs(u), ohrD = (au - 0.62) * (au - 0.62) + (v + 0.68) * (v + 0.68);
    if (ohrD <= 0.3 * 0.3) return ohrD <= 0.15 * 0.15 ? C.ohr : C.fell;
    return null;
  }
  const au = Math.abs(u);
  // Gesicht von oben nach unten
  if (v > -0.22 && v < 0.02 && au > 0.25 && au < 0.47 && balken(au, 0.36, 0.1) && balken(v, -0.1, 0.1)) return C.auge;                  // Augen
  if (v > -0.72 && v < -0.2 && (balken(u, 0, 0.07) || (balken(au, 0.27, 0.06) && v > -0.64 && v < -0.3))) return C.streifen;           // Stirnstreifen
  if (au > 0.66 && (balken(v, -0.12, 0.07) || (balken(v, 0.18, 0.07) && au > 0.7))) return C.streifen;                                // Wangenstreifen
  if (v > 0.2 && v < 0.33 && au <= 0.14 - (v - 0.2) * 0.9) return C.nase;                                                           // Nase
  if (v > 0.3 && v < 0.62 && balken(u, 0, 0.05)) return C.streifen;                                                                  // Mund: Mittelstrich …
  if (v > 0.5 && v < 0.64 && au < 0.3 && balken(v, 0.55 + au * 0.25, 0.045)) return C.streifen;                                      // … und zwei Bögen
  // Schnauze: zwei weiße Backenpolster
  const bx = au - 0.22, schnauze = (bx * bx) / (0.3 * 0.3) + ((v - 0.44) * (v - 0.44)) / (0.26 * 0.26) <= 1 || (au < 0.2 && v > 0.2 && v < 0.62);
  if (schnauze) return (u + v > 0.5) ? C.weissSchatten : C.weiss;
  return (u * 0.7 + v > 0.62) ? C.schatten : C.fell;
}
const ppFx25Tiger = ppR1Leinwand((g, t, sz, d) => {
  const u = t / 960;
  if (u > 1) return;
  // 1,2-s-Keyframes: Deckung 0 → 1 (20 %) … 1 (70 %) → 0, Größe .3 → 1,2 (20 %) → 1 (35 %) → 1 → 1,3
  const a = ppFx25Kf(u, [[0, 0], [0.2, 1], [0.7, 1], [1, 0]], ppR1Weich), sk = ppFx25Kf(u, [[0, 0.3], [0.2, 1.2], [0.35, 1], [0.7, 1], [1, 1.3]], ppR1Weich);
  if (a < 0.04) return;
  const R = Math.max(2, Math.round(10.2 * sk)), B = 2 * R + 5, N = R + 2, cx = Math.round(sz.cx), cy = Math.round(sz.cy);
  const f = d.farbe;
  for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) f[(j + N) * B + i + N] = ppFx25TigerFarbe(i / R, j / R, R);
  for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) {
    const c = f[(j + N) * B + i + N];
    if (c) { g.put(cx + i, cy + j, c, a); continue; }
    const ok = (ii, jj) => ii >= -N && jj >= -N && ii <= N && jj <= N && f[(jj + N) * B + ii + N];
    if (ok(i - 1, j) || ok(i + 1, j) || ok(i, j - 1) || ok(i, j + 1)) g.put(cx + i, cy + j, PP_FX25_AUSSEN, a);
  }
}, 1000, { breite: 150, hoehe: 150 }, {
  z: 10100,
  vorbereiten: () => ({ farbe: new Array(40 * 40).fill(null) }),
});

// ═════════════════════════════════════════════════════════════════
//  Blow of the Venom Snake (`snake_impact`; Zonen-Animation am Ziel) — PIXELART. Wie vorher (1,2 s, gleiche Keyframes wie der Tiger): eine Schlange (🐍, 64 px) wächst .3 → 1,2 → 1, steht,
//  blendet bis 1,3 aus. Der Körper ist eine S-förmige Kurve (Catmull-Rom), die je Größe als Reihe gestempelter Scheiben gezeichnet wird (dunkler Umriss, Grün, helle Bänderung, Glanz oben links);
//  vorn ein breiterer Kopf mit Auge und gespaltener roter Zunge. Kein skaliertes Bild. Gerafft auf 960 ms.
// ═════════════════════════════════════════════════════════════════
const PP_FX25_SCHLANGE = { rand: ppHex('#18300a'), koerper: ppHex('#167927'), band: ppHex('#80bf59'), schatten: ppHex('#29663f'), licht: ppHex('#cbff66'), auge: ppHex('#fad54a'), pupille: ppHex('#141414'), zunge: ppHex('#e73b41') };
/** Stützpunkte der Körperlinie (Einheitsquadrat −1…1): Schwanz unten links → S-Schlinge → Kopf oben rechts. */
const PP_FX25_SCHLANGE_PFAD = [[-0.8, 0.78], [-0.35, 0.94], [0.25, 0.92], [0.76, 0.7], [0.86, 0.3], [0.5, 0.02], [-0.2, -0.02], [-0.72, -0.2], [-0.8, -0.58], [-0.4, -0.84], [0.12, -0.84], [0.5, -0.66]];
/** Catmull-Rom durch die Stützpunkte, `n` Stücke je Abschnitt → dichte Punktfolge (Einheitsquadrat). */
function ppFx25Kurve(pts, n) {
  const out = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)];
    for (let s = 0; s < n; s++) {
      const q = s / n, q2 = q * q, q3 = q2 * q;
      out.push([0, 1].map((c) => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * q + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * q2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * q3)));
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
const PP_FX25_SCHLANGE_KURVE = ppFx25Kurve(PP_FX25_SCHLANGE_PFAD, 8);
const ppFx25Schlange = ppR1Leinwand((g, t, sz) => {
  const u = t / 960;
  if (u > 1) return;
  const a = ppFx25Kf(u, [[0, 0], [0.2, 1], [0.7, 1], [1, 0]], ppR1Weich), sk = ppFx25Kf(u, [[0, 0.3], [0.2, 1.2], [0.35, 1], [0.7, 1], [1, 1.3]], ppR1Weich);
  if (a < 0.04) return;
  const C = PP_FX25_SCHLANGE, R = Math.max(2, 10.2 * sk), cx = Math.round(sz.cx), cy = Math.round(sz.cy), K = PP_FX25_SCHLANGE_KURVE, n = K.length;
  const breite = (k) => R * (0.075 + 0.11 * Math.min(1, k / (n * 0.35)));                      // Schwanz dünn → Körper dick
  const P = (k) => [cx + K[k][0] * R, cy + K[k][1] * R * 0.95];
  const rr = (k) => Math.max(0.9, breite(k));
  for (let k = 0; k < n; k++) { const p = P(k); g.disc(p[0], p[1], rr(k) + 1, C.rand, a); }                // Umriss
  for (let k = 0; k < n; k++) { const p = P(k); g.disc(p[0], p[1], rr(k), C.koerper, a); }               // Körper
  for (let k = 0; k < n; k++) {                                                                          // Bänderung + Glanz
    const p = P(k), r = rr(k);
    if (Math.floor(k / 4) % 2 === 0) g.disc(p[0] - r * 0.25, p[1] - r * 0.25, r * 0.62, C.band, a);
    if (r >= 1.6) g.put(p[0] - r * 0.5, p[1] - r * 0.55, C.licht, a);
  }
  for (let k = 0; k < n; k += 2) { const p = P(k), r = rr(k); if (r >= 1.6) g.put(p[0] + r * 0.55, p[1] + r * 0.6, C.schatten, a); }   // Schatten unten rechts
  // Kopf: breiter als der Körper, in Laufrichtung der letzten Punkte
  const e = P(n - 1), q = P(n - 6), dx = e[0] - q[0], dy = e[1] - q[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hr = Math.max(1.6, R * 0.27), hx = e[0] + ux * hr * 0.6, hy = e[1] + uy * hr * 0.6;
  g.disc(hx, hy, hr + 1, C.rand, a); g.disc(hx, hy, hr, C.koerper, a); g.disc(hx - hr * 0.3, hy - hr * 0.3, hr * 0.55, C.band, a);
  // Zunge: zwei rote Pixelzacken nach vorn
  const zx = hx + ux * (hr + 1), zy = hy + uy * (hr + 1), zl = Math.max(2, Math.round(R * 0.28));
  g.line(zx, zy, zx + ux * zl, zy + uy * zl, C.zunge, a);
  const sx = -uy, sy = ux;
  g.put(zx + ux * (zl + 1) + sx, zy + uy * (zl + 1) + sy, C.zunge, a); g.put(zx + ux * (zl + 1) - sx, zy + uy * (zl + 1) - sy, C.zunge, a);
  // Auge
  g.put(hx + sx * hr * 0.35 - ux * 0.3, hy + sy * hr * 0.35 - uy * 0.3, C.auge, a);
  if (hr >= 2.2) g.put(hx - sx * hr * 0.35, hy - sy * hr * 0.35, C.pupille, a);
}, 1000, { breite: 150, hoehe: 150 }, { z: 10100 });

// ═════════════════════════════════════════════════════════════════
//  Brilliant Idea (`thought_bubbles`; Zonen-Animation am Wirker) — PIXELART. Wie vorher: fünf Symbole (drei Gedankenblasen 💭, Glühbirne 💡, Funkeln ✨; 14–24 px) steigen 35–55 px auf, wachsen
//  .4 → 1,1 → 1 und blenden aus (0,9 s, versetzt um 0–0,4 s). Hier sind die Symbole kleine Geometrien je Größe (Wolke aus Scheiben mit zwei Schweif-Kreisen, Birne mit Sockel und Strahlen,
//  Stern als Astroide); der Versatz ist auf 0–200 ms gerafft, jedes Symbol läuft 760 ms (Ende < 960 ms, Aufruferdauer 1000 ms).
// ═════════════════════════════════════════════════════════════════
const PP_FX25_GEDANKE = { wolke: ppHex('#ffffff'), wolkeRand: ppHex('#9aa3b6'), wolkeSchatten: ppHex('#d2d2db'), birne: ppHex('#fad54a'), birneLicht: ppHex('#f7f7ad'), birneRand: ppHex('#8e503a'), sockel: ppHex('#9aa3b6'), sockelRand: ppHex('#59606e'), stern: ppHex('#fad54a'), sternHell: ppHex('#f7f7ad'), sternKern: ppHex('#ffffff') };
function ppFx25Wolke(g, cx, cy, r, a) {
  const C = PP_FX25_GEDANKE, teile = [[0, 0.05, 0.62], [-0.52, 0.14, 0.4], [0.5, 0.1, 0.44], [0.02, -0.34, 0.42]];
  for (const [dx, dy, rad] of teile) g.disc(cx + dx * r, cy + dy * r, Math.max(1, rad * r) + 1, C.wolkeRand, a);
  g.disc(cx - 0.45 * r, cy + 0.82 * r, Math.max(0.7, 0.2 * r) + 1, C.wolkeRand, a); g.disc(cx - 0.78 * r, cy + 1.08 * r, Math.max(0.5, 0.12 * r) + 1, C.wolkeRand, a);
  for (const [dx, dy, rad] of teile) g.disc(cx + dx * r, cy + dy * r, Math.max(1, rad * r), C.wolkeSchatten, a);
  for (const [dx, dy, rad] of teile) g.disc(cx + dx * r - 0.5, cy + dy * r - 0.5, Math.max(0.8, rad * r - 1), C.wolke, a);
  g.disc(cx - 0.45 * r, cy + 0.82 * r, Math.max(0.7, 0.2 * r), C.wolke, a); g.disc(cx - 0.78 * r, cy + 1.08 * r, Math.max(0.5, 0.12 * r), C.wolke, a);
}
function ppFx25Birne(g, cx, cy, r, a) {
  const C = PP_FX25_GEDANKE;
  g.disc(cx, cy - 0.25 * r, 0.62 * r + 1, C.birneRand, a);
  const bw = Math.max(2, Math.round(0.5 * r)), bh = Math.max(2, Math.round(0.5 * r));
  g.block(cx - bw / 2 - 1, cy + 0.3 * r - 1, bw + 2, bh + 2, C.sockelRand, a);
  g.disc(cx, cy - 0.25 * r, 0.62 * r, C.birne, a);
  g.block(cx - bw / 2, cy + 0.3 * r, bw, bh, C.sockel, a);
  g.disc(cx - 0.2 * r, cy - 0.4 * r, Math.max(0.6, 0.22 * r), C.birneLicht, a);
  if (r >= 3.2) {                                                                // Strahlen: drei kurze Striche
    const l = Math.max(1, Math.round(r * 0.28));
    for (const w of [-0.9, 0, 0.9]) { const dx = Math.sin(w), dy = -Math.cos(w); g.line(cx + dx * r * 0.95, cy - 0.25 * r + dy * r * 0.95, cx + dx * (r * 0.95 + l), cy - 0.25 * r + dy * (r * 0.95 + l), C.stern, a); }
  }
}
function ppFx25Stern(g, cx, cy, r, a, kern = true) {
  const C = PP_FX25_GEDANKE, R = Math.ceil(r) + 1;
  cx = Math.round(cx); cy = Math.round(cy);
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    const w = Math.sqrt(Math.abs(i) / (r + 0.5)) + Math.sqrt(Math.abs(j) / (r + 0.5));
    if (w > 1) continue;
    g.put(cx + i, cy + j, (kern && Math.abs(i) + Math.abs(j) <= 1) ? C.sternKern : (w < 0.78 ? C.sternHell : C.stern), a);
  }
}
const PP_FX25_BLASEN = [
  { art: 'wolke', x: -15, verzug: 0, size: 20, rise: -40 },
  { art: 'birne', x: 10, verzug: 100, size: 24, rise: -55 },
  { art: 'wolke', x: -5, verzug: 200, size: 16, rise: -35 },
  { art: 'stern', x: 15, verzug: 75, size: 14, rise: -50 },
  { art: 'wolke', x: -20, verzug: 175, size: 18, rise: -45 },
];
const ppFx25Gedanken = ppR1Leinwand((g, t, sz) => {
  const S = sz.S;
  for (const b of PP_FX25_BLASEN) {
    const u = (t - b.verzug) / 760;
    if (u < 0 || u > 1) continue;
    // 0,9-s-Keyframes (ease-out je Abschnitt): Deckung 0 → 1 → .9 → 0, Größe .4 → 1,1 → 1 → .6, Steigen 0 → 30 % → 80 % → 100 % der Höhe
    const a = ppFx25Kf(u, [[0, 0], [0.25, 1], [0.7, 0.9], [1, 0]], ppFx25Aus), sk = ppFx25Kf(u, [[0, 0.4], [0.25, 1.1], [0.7, 1], [1, 0.6]], ppFx25Aus);
    const h = ppFx25Kf(u, [[0, 0], [0.25, 0.3], [0.7, 0.8], [1, 1]], ppFx25Aus);
    if (a < 0.04) continue;
    const r = Math.max(1, b.size * 0.56 / S * sk), cx = sz.cx + (b.x + b.size * 0.58) / S, cy = sz.cy + (-10 + b.size * 0.6 + b.rise * h) / S;
    if (b.art === 'wolke') ppFx25Wolke(g, cx, cy, r, a);
    else if (b.art === 'birne') ppFx25Birne(g, cx, cy, r, a);
    else { ppFx25Stern(g, cx, cy, r, a); ppFx25Stern(g, cx + r * 0.95, cy - r * 0.85, r * 0.45, a, false); ppFx25Stern(g, cx - r * 0.9, cy + r * 0.75, r * 0.38, a, false); }
  }
}, 1000, { breite: 150, hoehe: 150, ankerX: 75, ankerY: 118 }, { z: 9999 });

// ── Registrierung ────────────────────────────────────────────────────────────
// spectral_armor: die Leinwandfassung der Spectral-Armor-Animation ist die von `emergency_spell_armor` (app-fx-11.jsx, vorher ein Alias auf genau diese Komponente): gleicher Ablauf
// (700 ms, türkiser Heiligenschein, Ritterschild + Schwerter als Geometrie, 14 Funken) UND dieselbe Nebenwirkung (Klasse `.spectral-armor-teal` 700 ms an der getroffenen Karte).
ppFxUeberschreiben('spectral_armor', ppFx11Ruestung);
ppFxUeberschreiben('snake_impact', ppFx25Schlange);
ppFxUeberschreiben('thought_bubbles', ppFx25Gedanken);
ppFxUeberschreiben('tiger_impact', ppFx25Tiger);
