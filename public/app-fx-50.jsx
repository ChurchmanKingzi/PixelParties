// app-fx-50: Heilimpuls im Trailer-Look — Heal-Säulen (grün) und Heil-Burst als Pixelart-Leinwand
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Trailer (shot01.js, „Life Serum“ → Heilimpuls zu Monia): Ringe, Funken, Pluskreuze, Schockringe, Splitterkranz. Das Kartenbild von „Heal“ (data/card-art/native/Heal.png) zeigt ZWEI dicke grüne
//  Lichtsäulen, die von OBEN ins Bild kommen (eine an der Heilerin, eine am Ziel; hellgrün, dunkelgrüne Kontur). Der Ablauf des CSS-Originals (`heal-beam-rise` / `-strike`) bleibt, nur als Pixelart:
//   • RISE   (`play_heal_beam` Phase `rise`, 0,5 s): an der Quelle (Heldenzone der Heilerin bzw. Zone des Skeleton Healer) schießt eine Säule senkrecht nach OBEN aus dem Bild und steigt ab,
//            Bodenring (Ellipse, Creme + Grün), Plus-Kreuze und Quadrate an den Kanten.
//   • STRIKE (Phase `strike`, 0,42 s): eine gleiche Säule fällt von der OBERKANTE des sichtbaren Bereichs senkrecht auf die Zielzone (Spitze beschleunigt, steht dann kurz, schrumpft), Einschlag mit
//            Bodenringen und Spritzern. Quelle = Ziel (Selbstheilung): beide Säulen am selben Ort nacheinander.
//   • TREFFER — Registry-Animationen `heal_sparkle` (Heal, Skeleton Healer, Cure, Healing Melody, Tarleinn, Johanna … — ursprünglich grün, bleibt grün) und `healing_hearts` (Healing Potion, Life Serum,
//            Future Tech Doping …, rosa Herzen wie im Trailer): ersetzen die Canvas-Fassungen aus app-fx-13. Dauer 0,92 s (die Registry entfernt nach 1,0 s). Mitte = Mitte der Zielzone. `heal_sparkle`:
//            Creme- und Grünringe, Plus-Kreuze und Quadrate (Creme, Hell- und Mittelgrün), kreisende Kreuze; `healing_hearts`: Ringe Creme/Rosa, Herzen und Sterne.
//  Die HP-Zahl bleibt die des Spiels (`HealNumber`) — Zeitpunkt und Wert der HP-Änderung sind unverändert (Server: rise 500 ms, strike 350 ms, dann Treffer).
//  Technik: Rasterzellen (2–4 Bildschirmpixel nach Zonenhöhe wie app-fx-48; Karte ≈ 35 Zellen), 30 Bilder/s auf `ppTaktRaf`, Schmutzrechteck-Upload (`ppFx30Maler`), feste Palettenfarben, kein Alpha
//  (Ränder Bayer-gedithert, Ausklang = Blinken/Schrumpfen in Stufen), kein Weichzeichner, nichts gedreht. Die Säulen laufen in der Welt-Schicht (`ppFxWeltSchicht`, Feldkoordinaten) und reichen bis zur
//  Oberkante des sichtbaren Bereichs (Fenster-Oberkante + Feldversatz, plus Reserve für eine laufende Kamerafahrt). Eine schmale, hohe Leinwand je Phase.
//  Aufruf: `window.ppFx50Beam(phase, srcEl, tgtEl)` → true, wenn gezeichnet wird (der Aufrufer lässt dann den CSS-Strahl weg), sonst false.
//  Rückfall: `window.__ppFxAlt` (Registry-Einträge und Strahl bleiben alt) und `window._playAnimations === false`.
//  Messung (nur Tests): `window.__ppFx50Zeiten` sammelt [Art, ms] je Bild (Zeichnen + Hochladen).
// ═════════════════════════════════════════════════════════════════
const PP_FX50_BILD = 1000 / 30;
const PP_FX50_C = {
  hpk: ppHex('#fe6794'), hpk2: ppHex('#f8b4c8'), creme: ppHex('#fffbd2'), gruen: ppHex('#66ff71'), tinte: ppHex('#12101f'),
  g0: ppHex('#167927'), g1: ppHex('#00cc50'), g2: ppHex('#4ceb70'), g3: ppHex('#75f091'), g4: ppHex('#b3f9b8'),    // Grün: Kontur, Rand, Körper, hell, Kern
};
const PP_FX50_TREFFER_ENDE = 0.92;     // s; die Registry entfernt eine Zonen-Animation nach 1000 ms
const PP_FX50_RISE_ENDE = 0.5;         // s; Server: `strike` folgt nach 500 ms
const PP_FX50_STRIKE_DAUER = 0.42;     // s; Strahl-Phase `strike` → Registry-Animation `heal_sparkle` ≈ 350 ms + 100 ms Einhänge-Verzug
const PP_FX50_STRIKE_ENDE = 0.5;

const ppFx50Kl = (v, a, b) => Math.max(a, Math.min(b, v));

/** Zellgröße und Maßstab (Trailer-Karte = 35 Zellen hoch) aus der Zonenhöhe in Bildschirmpixeln. */
function ppFx50Mass(hoehe) {
  const h = hoehe > 8 ? hoehe : 100, S = ppFx50Kl(Math.round(h / 35), 2, 4);
  return { S, rc: h / (35 * S) };
}

/** Herz des Trailers (5 × 4 Quellpixel, `z` Zellen je Quellpixel), Mitte (x, y); `hell` = heller Punkt oben links. */
function ppFx50Herz(m, x, y, z, c, hell) {
  const x0 = x - 2 * z, y0 = y - 2 * z;
  m.rect(x0 + z, y0, z, z, c); m.rect(x0 + 3 * z, y0, z, z, c);
  m.rect(x0, y0 + z, 5 * z, z, c);
  m.rect(x0 + z, y0 + 2 * z, 3 * z, z, c);
  m.rect(x0 + 2 * z, y0 + 3 * z, z, z, c);
  if (hell) m.rect(x0 + z, y0 + z, z, z, hell);
}

/** Teilchen zeichnen (Art 0 Quadrat, 1 Kreuz, 2 Stern, 3 Funke = Kreuz/Quadrat im Vierertakt, 4 Herz); ab 72 % der Lebenszeit blinkt es im Zweiertakt aus. */
function ppFx50Teilchen(m, T, t, fl) {
  const rd = Math.round, C = PP_FX50_C;
  for (let i = 0; i < T.length; i++) {
    const s = T[i], dt = t - s.t0;
    if (dt < 0 || dt >= s.life) continue;
    if (dt > s.life * 0.72 && fl(dt) % 2) continue;
    const x = rd(s.x + s.vx * dt + 0.5 * s.ax * dt * dt), y = rd(s.y + s.vy * dt + 0.5 * s.ay * dt * dt);
    let kind = s.kind; if (kind === 3) kind = fl(dt) % 4 < 2 ? 1 : 0;
    if (kind === 0) m.rect(x, y, s.sz, s.sz, s.c);
    else if (kind === 1) { m.rect(x - 1, y, 3, 1, s.c); m.rect(x, y - 1, 1, 3, s.c); }
    else if (kind === 2) { m.rect(x - 2, y, 5, 1, s.c); m.rect(x, y - 2, 1, 5, s.c); m.rect(x - 1, y - 1, 3, 3, s.c); }
    else ppFx50Herz(m, x, y, s.sz, s.c, C.creme);
  }
}

// ───────────────────────── Treffer ─────────────────────────
/** g: { CX, CY, rc, zx0, zy0, zx1, zy1 } in Zellen; profil: 'herz' (rosa Herzen) | 'gruen' (Heal: grün/creme, Kreuze). → malen(t Sekunden, ganze Bilder). */
function ppFx50TrefferZeichner(g, m, salt, profil) {
  const C = PP_FX50_C, rd = Math.round, H = ppFx30H, ease = ppFx30Ease, fl = ppFx30Fl;
  const { CX, CY, rc, zx0, zy0, zx1, zy1 } = g;
  const th = (v) => Math.max(1, rd(v * rc));
  const v = (w) => w / 4.8 * rc;
  const gr = profil === 'gruen';
  const cols = gr ? [C.g3, C.g4, C.creme, C.g2] : [C.hpk, C.hpk2, C.creme, C.gruen];
  const ringe = gr ? [C.creme, C.g2, C.g1] : [C.creme, C.hpk2, C.hpk];
  const pr = profil === 'herz' ? { splitter: 30, herzen: 22, spirale: 6 } : { splitter: 46, herzen: 14, spirale: 5 };
  const T = [];
  let id = 0; const R = (k) => H(salt + 7, id * 13 + k);
  // Splitterkranz: Kreuze und Quadrate fliegen aus, bremsen ab (a = −1,4 · v)
  for (let k = 0, n = ppFxN(pr.splitter); k < n; k++, id++) {
    const an = R(1) * Math.PI * 2, sp = v(150 + R(2) * 480);
    T.push({ t0: R(8) * 0.06, life: 0.3 + R(5) * 0.4, x: CX, y: CY, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.9, ax: -Math.cos(an) * sp * 1.4, ay: -Math.sin(an) * sp * 1.4 * 0.9,
      kind: R(6) < 0.3 ? 1 : 0, sz: R(3) < 0.4 ? 2 : 1, c: cols[Math.floor(R(7) * cols.length)] });
  }
  // aufsteigende Herzen und Sterne (Lebensdauer so, dass alles vor 0,92 s endet)
  for (let k = 0, n = ppFxN(pr.herzen); k < n; k++, id++) {
    T.push({ t0: R(1) * 0.2, life: 0.5 + R(2) * 0.2, x: CX + (R(3) - 0.5) * v(90), y: CY + (R(4) - 0.5) * v(70) + v(10), vx: v((R(5) - 0.5) * 70), vy: -v(60 + R(6) * 120), ax: 0, ay: 0,
      kind: gr ? (R(7) < 0.2 ? 2 : (R(7) < 0.7 ? 1 : 0)) : (R(7) < 0.25 ? 2 : 4), sz: 1, c: gr ? cols[Math.floor(R(9) * cols.length)] : (R(7) < 0.25 ? C.creme : (k % 2 ? C.hpk : C.hpk2)) });
  }
  const sp = pr.spirale;

  return (t) => {
    const q = fl(t);
    // 1) Aufleuchten der Zielzone: zwei Bilder Creme-Dither (50 % / 25 %; im Trailer 70 / 45 — die Zahl und die Karte sollen lesbar bleiben)
    if (q < 2) { const lv = q === 0 ? 0.5 : 0.25; for (let y = zy0; y < zy1; y++) for (let x = zx0; x < zx1; x++) if (ppBayer(x, y) < lv) m.rect(x, y, 1, 1, C.creme); }
    // 2) Schockringe: Creme (erste 0,1 s dick), dann Hell- und Mittelton (gedithert)
    if (t <= 0.4) m.ring(CX, CY, Math.max(1, rd(ease(t / 0.4) * 24 * rc)), t < 0.1 ? th(2) : th(1), ringe[0], false);
    if (t > 0.05 && t <= 0.55) m.ring(CX, CY, Math.max(1, rd(ease((t - 0.05) / 0.5) * 34 * rc)), th(2), ringe[1], true);
    if (t > 0.1 && t <= 0.7) m.ring(CX, CY, Math.max(1, rd(ease((t - 0.1) / 0.6) * 44 * rc)), th(2), ringe[2], true);
    // 3) Teilchen
    ppFx50Teilchen(m, T, t, fl);
    // 4) kreisende Herzen (Heal: Kreuze), steigen mit
    if (t < 0.8) {
      for (let k = 0; k < sp; k++) {
        if (t > 0.55 && q % 2) break;
        const a = k * (Math.PI * 2 / sp) + t * 3, rr = (8 + t * 36) * rc;
        const hx = rd(CX + Math.cos(a) * rr), hy = rd(CY - t * 22 * rc + Math.sin(a) * rr * 0.6);
        if (gr) { const c = k % 2 ? C.g3 : C.g4; m.rect(hx - 1, hy, 3, 1, c); m.rect(hx, hy - 1, 1, 3, c); m.rect(hx, hy, 1, 1, C.creme); }
        else ppFx50Herz(m, hx, hy, 1, k % 2 ? C.hpk : C.hpk2, C.creme);
      }
    }
  };
}

// ───────────────────────── Säulen ─────────────────────────
/** Ellipsenring (Bodenring): Mitte (cx, cy), Halbachsen rx, ry, Dicke th (Zellen); `dith` = jede zweite Zelle. */
function ppFx50Ellipse(m, cx, cy, rx, ry, th, c, dith) {
  if (rx < 1) return;
  const n = Math.ceil(Math.PI * 2 * Math.max(rx, ry) * 1.1);
  let lx = null, ly = null, k = 0;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
    if (x === lx && y === ly) continue;
    lx = x; ly = y; k++;
    if (!dith || (k & 1)) m.rect(x, y, th, th, c);
  }
}

/**
 * Lichtsäule (senkrecht, wie auf dem Kartenbild von „Heal“): Mitte cx, Zeilen y0 (oben) … y1 (unten, exklusiv), Halbbreite hw (Zellen), Bild fr (für den Lauf im Kern), `kopf` 'unten' | 'oben' = helle Spitze.
 * Schichten von außen: Kontur (dunkelgrün, 1 Zelle), Rand (Mittelgrün, nach innen gedithert), Körper, Hellgrün, Kern (Creme/Hellgrün im Vierzeilen-Lauf nach oben).
 */
function ppFx50Saeule(m, cx, y0, y1, hw, fr, kopf) {
  if (y1 <= y0 || hw < 1) return;
  const C = PP_FX50_C, hgt = y1 - y0, eb = Math.max(1, Math.round(hw * 0.32)), hl = Math.max(1, Math.round(hw * 0.62)), kw = Math.max(1, Math.round(hw * 0.3));
  m.rect(cx - hw - 1, y0, 1, hgt, C.g0); m.rect(cx + hw + 1, y0, 1, hgt, C.g0);                    // Kontur
  m.rect(cx - hw, y0, 2 * hw + 1, hgt, C.g2);                                                     // Körper
  m.rect(cx - hw, y0, 1, hgt, C.g1); m.rect(cx + hw, y0, 1, hgt, C.g1);                           // Rand, äußerste Zelle
  for (let e = 1; e < eb; e++) for (let y = y0; y < y1; y++) {                                    // Rand nach innen gedithert
    if (ppBayer(cx + e, y) < 0.5 + 0.15 * (eb - e)) { m.rect(cx - hw + e, y, 1, 1, C.g1); }
    if (ppBayer(cx - e, y) < 0.5 + 0.15 * (eb - e)) { m.rect(cx + hw - e, y, 1, 1, C.g1); }
  }
  m.rect(cx - hl, y0, 2 * hl + 1, hgt, C.g3);                                                     // hell
  for (let y = y0; y < y1; y++) {                                                                  // Übergang Körper → hell gedithert (je eine Zelle)
    if (ppBayer(cx + hl + 1, y) < 0.5) m.rect(cx + hl + 1, y, 1, 1, C.g3);
    if (ppBayer(cx - hl - 1, y) < 0.5) m.rect(cx - hl - 1, y, 1, 1, C.g3);
  }
  let y = y0;                                                                                      // Kern: Bänder zu 4 Zeilen laufen nach oben
  while (y < y1) {
    const kk = Math.floor((y + fr * 2) / 4), ny = Math.min(y1, (kk + 1) * 4 - fr * 2);
    m.rect(cx - kw, y, 2 * kw + 1, ny - y, kk & 1 ? C.g3 : C.g4);
    y = ny;
  }
  if (kopf && hgt >= 3) {                                                                          // helle Spitze (3 Zeilen)
    const oben = kopf === 'oben', ya = oben ? y0 : y1 - 3, z = oben ? [C.creme, C.g4, C.g3] : [C.g3, C.g4, C.creme];
    for (let i = 0; i < 3; i++) m.rect(cx - hw, ya + i, 2 * hw + 1, 1, z[i]);
  }
}
const PP_FX50_SCHRUMPF = [1, 0.75, 0.5, 0.25];

/**
 * RISE: g { CX, YB, HW, rc } — Mitte, Fußzeile (Boden der Quelle), Halbbreite, Maßstab. → malen(t).
 * Die Spitze schießt in 0,26 s nach oben, ab 0,2 s löst sich der Fuß und steigt hinterher (wie `translateY(-100vh)` der CSS-Fassung); um 0,5 s ist die Säule oben.
 */
function ppFx50RiseZeichner(g, m, salt) {
  const C = PP_FX50_C, rd = Math.round, H = ppFx30H, ease = ppFx30Ease, fl = ppFx30Fl;
  const { CX, YB, HW, rc } = g, L = Math.max(4, YB);                  // bis zur Oberkante der Leinwand (liegt über dem sichtbaren Bereich)
  const th = (w) => Math.max(1, rd(w * rc)), v = (w) => w / 4.8 * rc;
  const cols = [C.g3, C.g4, C.creme, C.g2];
  const tip = (t) => YB - L * ease(t / 0.26);
  const foot = (t) => (t < 0.2 ? YB : YB - L * Math.pow(ppFx50Kl((t - 0.2) / 0.3, 0, 1), 2));
  const T = [];
  let id = 0; const R = (k) => H(salt + 11, id * 13 + k);
  for (let t2 = 0, n = 0; t2 < 0.42; t2 += 1 / 40, id++, n++) {                                    // Kreuze und Quadrate an den Kanten, steigen mit
    const t0 = t2, lo = Math.max(0, YB - L * ease(t0 / 0.26)), seite = R(1) < 0.5 ? -1 : 1, sk = R(9);
    const f = R(2), yy = YB - f * (YB - lo);
    T.push({ t0, life: 0.22 + R(3) * 0.2, x: CX + seite * (HW + 2 + R(4) * 3), y: yy, vx: seite * v(R(5) * 40), vy: -v(60 + R(6) * 160), ax: 0, ay: 0, kind: sk < 0.45 ? 1 : (sk < 0.6 ? 3 : 0), sz: 1, c: cols[Math.floor(R(7) * cols.length)] });
  }
  for (let k = 0, n = ppFxN(22); k < n; k++, id++) {                                                // Spritzer am Boden
    const an = -Math.PI * (0.1 + R(1) * 0.8), sp = v(90 + R(2) * 260);
    T.push({ t0: 0, life: 0.2 + R(5) * 0.2, x: CX + (R(3) - 0.5) * 2 * HW, y: YB, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, ax: -Math.cos(an) * sp * 1.4, ay: -Math.sin(an) * sp * 1.4 + v(160),
      kind: R(6) < 0.35 ? 1 : 0, sz: R(3) < 0.4 ? 2 : 1, c: cols[Math.floor(R(7) * cols.length)] });
  }
  return (t) => {
    const q = fl(t);
    // 1) Bodenring (Ellipse): Creme (erste 0,1 s dick) und Grün (gedithert)
    if (t <= 0.4) ppFx50Ellipse(m, CX, YB, Math.max(1, rd(ease(t / 0.4) * 24 * rc)), Math.max(1, rd(ease(t / 0.4) * 10 * rc)), t < 0.1 ? th(2) : th(1), C.creme, false);
    if (t > 0.05 && t <= 0.5) ppFx50Ellipse(m, CX, YB, Math.max(1, rd(ease((t - 0.05) / 0.45) * 34 * rc)), Math.max(1, rd(ease((t - 0.05) / 0.45) * 14 * rc)), th(2), C.g2, true);
    // 2) Säule: Spitze schießt nach oben, der Fuß folgt; die letzten Bilder schrumpft sie in Stufen
    const y0 = Math.max(0, rd(tip(t))), y1 = rd(foot(t)) + 1, ende = ppFx50Kl((t - 0.4) / 0.1, 0, 1), hw = Math.max(1, rd(HW * PP_FX50_SCHRUMPF[Math.min(3, Math.floor(ende * 4))]));
    if (y1 > y0 && t < 0.5) ppFx50Saeule(m, CX, y0, Math.min(y1, YB + 1), hw, q, tip(t) > 0 ? 'oben' : null);
    // 3) Teilchen
    ppFx50Teilchen(m, T, t, fl);
  };
}

/**
 * STRIKE: g { CX, YT, YB, HW, rc } — Mitte, Zeile der Oberkante der Leinwand (über dem sichtbaren Bereich), Zeile des Einschlags (Füße der Zielzone), Halbbreite, Maßstab. → malen(t).
 * Die Spitze fällt in 0,16 s (beschleunigt) von oben auf das Ziel, die Säule steht bis 0,33 s und schrumpft dann in Stufen; ab dem Einschlag Bodenringe und Spritzer.
 */
function ppFx50StrikeZeichner(g, m, salt) {
  const C = PP_FX50_C, rd = Math.round, H = ppFx30H, ease = ppFx30Ease, fl = ppFx30Fl;
  const { CX, YT, YB, HW, rc } = g, TI = 0.16;
  const th = (w) => Math.max(1, rd(w * rc)), v = (w) => w / 4.8 * rc;
  const cols = [C.g3, C.g4, C.creme, C.g2];
  const T = [];
  let id = 0; const R = (k) => H(salt + 13, id * 13 + k);
  for (let k = 0, n = ppFxN(40); k < n; k++, id++) {                                                // Einschlag: Splitter, die nach oben/außen spritzen
    const an = -Math.PI * (0.02 + R(1) * 0.96), sp = v(140 + R(2) * 420);
    T.push({ t0: TI + R(8) * 0.03, life: 0.18 + R(5) * 0.22, x: CX + (R(3) - 0.5) * HW, y: YB, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.9, ax: -Math.cos(an) * sp * 1.2, ay: v(220),
      kind: R(6) < 0.3 ? 1 : 0, sz: R(3) < 0.4 ? 2 : 1, c: cols[Math.floor(R(7) * cols.length)] });
  }
  for (let t2 = 0.04, n = 0; t2 < 0.34; t2 += 1 / 40, id++, n++) {                                  // Kreuze und Quadrate an den Kanten der Säule
    const t0 = t2, seite = R(1) < 0.5 ? -1 : 1, tipY = YT + (YB - YT) * Math.pow(ppFx50Kl(t0 / TI, 0, 1), 2), sk = R(9);
    T.push({ t0, life: 0.2 + R(3) * 0.15, x: CX + seite * (HW + 2 + R(4) * 3), y: YT + R(2) * Math.max(1, tipY - YT), vx: seite * v(R(5) * 30), vy: v(20 + R(6) * 60), ax: 0, ay: 0, kind: sk < 0.45 ? 1 : (sk < 0.6 ? 3 : 0), sz: 1, c: cols[Math.floor(R(7) * cols.length)] });
  }
  return (t) => {
    const q = fl(t);
    // 1) Säule von oben: Spitze beschleunigt, dann steht sie und schrumpft in Stufen
    if (t < 0.42) {
      const tip = rd(YT + (YB - YT) * Math.pow(ppFx50Kl(t / TI, 0, 1), 2)), ende = ppFx50Kl((t - 0.3) / 0.12, 0, 1), hw = Math.max(1, rd(HW * PP_FX50_SCHRUMPF[Math.min(3, Math.floor(ende * 4))]));
      ppFx50Saeule(m, CX, YT, tip + 1, hw, q, 'unten');
    }
    // 2) Einschlag: Bodenringe (Creme dick, dann Grün gedithert)
    const dt = t - TI;
    if (dt >= 0 && dt <= 0.3) ppFx50Ellipse(m, CX, YB, Math.max(1, rd(ease(dt / 0.26) * 26 * rc)), Math.max(1, rd(ease(dt / 0.26) * 11 * rc)), dt < 0.08 ? th(2) : th(1), C.creme, false);
    if (dt > 0.04 && dt <= 0.3) ppFx50Ellipse(m, CX, YB, Math.max(1, rd(ease((dt - 0.04) / 0.26) * 36 * rc)), Math.max(1, rd(ease((dt - 0.04) / 0.26) * 15 * rc)), th(2), C.g2, true);
    // 3) Teilchen
    ppFx50Teilchen(m, T, t, fl);
  };
}

// ───────────────────────── Läufer ─────────────────────────
/** Zeichenschleife: 30 Bilder/s auf dem globalen Takt, Schmutzrechteck-Upload. `malen(tSek)`; `ende` in ms; → Abbruchfunktion. */
function ppFx50Schleife(cv, gw, gh, art, bauen, ende, verzug, fertig) {
  const ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), m = ppFx30Maler(img.data, gw, gh);
  const malen = bauen(m);
  const takt = window.ppTaktRaf || window.requestAnimationFrame;
  const t0 = performance.now() + (verzug || 0);
  let raf = 0, letzte = -1, aus = false, vor = null;
  const stopp = () => { if (aus) return; aus = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } if (fertig) fertig(); };
  const schritt = (jetzt) => {
    if (aus) return;
    if (typeof jetzt !== 'number') jetzt = performance.now();
    const ms = jetzt - t0;
    if (ms >= ende) { stopp(); return; }
    const fr = Math.floor(jetzt / PP_FX50_BILD);
    if (fr !== letzte && ms >= 0) {
      letzte = fr;
      const zm = window.__ppFx50Zeiten, a0 = zm ? performance.now() : 0;
      const d = m.d, buf = img.data;
      if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); }
      d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
      malen(Math.floor(Math.max(0, ms) / PP_FX50_BILD + 1e-6) / 30);
      const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
      if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
      vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
      if (zm) zm.push([art, +(performance.now() - a0).toFixed(3)]);
    }
    raf = takt(schritt);
  };
  raf = takt(schritt);
  const netz = setTimeout(stopp, ende + (verzug || 0) + 1500);     // Notnagel (Tab im Hintergrund: rAF ruht)
  return () => { clearTimeout(netz); stopp(); };
}

// ───────────────────────── Registry: Treffer ─────────────────────────
/** Komponente für `ANIM_REGISTRY` (Eigenschaften x, y = Mitte der Zielzone in Fenster- bzw. Feldkoordinaten, w, h = Zonenmaß). */
function ppFx50TrefferKomponente(profil) {
  return function Fx50Treffer(props) {
    const cvs = useRef(null);
    const geo = useMemo(() => {
      const w = props.w > 0 ? props.w : 64, h = props.h > 0 ? props.h : 90, { S, rc } = ppFx50Mass(h);
      const Rz = Math.ceil(50 * rc) + 3, lx = Math.floor((props.x - Rz * S) / S) * S, ly = Math.floor((props.y - Rz * S) / S) * S;
      const CX = Math.round((props.x - lx) / S), CY = Math.round((props.y - ly) / S), hw = Math.max(2, Math.round(w / S / 2)), hh = Math.max(2, Math.round(h / S / 2));
      return { S, lx, ly, gw: Rz * 2, gh: Rz * 2, g: { CX, CY, rc, zx0: CX - hw, zy0: CY - hh, zx1: CX + hw, zy1: CY + hh }, salt: Math.floor(Math.random() * 1e6) };
    }, []);
    useEffect(() => {
      const el = cvs.current;
      if (!el || window._playAnimations === false) return undefined;
      return ppFx50Schleife(el, geo.gw, geo.gh, 'treffer', (m) => ppFx50TrefferZeichner(geo.g, m, geo.salt, profil), PP_FX50_TREFFER_ENDE * 1000, 0, null);
    }, []);
    return (
      <div aria-hidden="true" data-pp-px="aus" style={{ position: 'fixed', left: geo.lx, top: geo.ly, pointerEvents: 'none', zIndex: 10100 }}>
        <canvas ref={cvs} width={geo.gw} height={geo.gh} style={{ width: geo.gw * geo.S, height: geo.gh * geo.S, imageRendering: 'pixelated', display: 'block' }} />
      </div>
    );
  };
}
ppFxUeberschreiben('heal_sparkle', ppFx50TrefferKomponente('gruen'));
ppFxUeberschreiben('healing_hearts', ppFx50TrefferKomponente('herz'));

// ───────────────────────── Strahl: Rise + Strike ─────────────────────────
/** Mitte eines Elements in Koordinaten der Schicht (Fenster + Feldversatz, wenn im Feld); `top` = Oberkante des sichtbaren Bereichs in denselben Koordinaten. */
function ppFx50Mitte(el) {
  const r = el.getBoundingClientRect();
  if (!(r.width > 0) || !(r.height > 0)) return null;
  const wa = window.ppFxWeltAnker ? window.ppFxWeltAnker(el) : { welt: false, dx: 0, dy: 0 };
  return { x: r.left + r.width / 2 + wa.dx, y: r.top + r.height / 2 + wa.dy, w: r.width, h: r.height, welt: !!wa.welt, dx: wa.dx, dy: wa.dy, top: wa.dy };
}

function ppFx50Haengen(lx, ly, gw, gh, S, welt) {
  const wurzel = document.createElement('div');
  wurzel.setAttribute('aria-hidden', 'true'); wurzel.setAttribute('data-pp-px', 'aus');
  wurzel.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;pointer-events:none;z-index:10100;`;
  const cv = document.createElement('canvas');
  cv.width = gw; cv.height = gh;
  cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
  wurzel.appendChild(cv);
  (welt && window.ppFxWeltSchicht ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel);
  return { wurzel, cv };
}

/** Maße einer Säulen-Leinwand: Mitte (x, y_boden) in Schichtkoordinaten; Oberkante `top` des sichtbaren Bereichs minus Reserve (Kamerafahrt), unten eine Reserve für Ringe. */
function ppFx50SaeulenFlaeche(a, boden, S, rc, hw) {
  const reserve = Math.min(160, Math.round(window.innerHeight * 0.2)), rand = Math.ceil(36 * rc) + 2;
  const lx = Math.floor((a.x - (hw + rand) * S) / S) * S, ly = Math.floor((a.top - reserve) / S) * S;
  const gw = (hw + rand) * 2 + 1, gh = Math.min(700, Math.ceil((boden + 14 * rc * S - ly) / S));
  const cx = Math.round((a.x - lx) / S), yb = Math.round((boden - ly) / S), oben = Math.max(0, Math.round((a.top - ly) / S));
  return { lx, ly, gw, gh, cx, yb, oben };
}

function ppFx50Beam(phase, srcEl, tgtEl) {
  try {
    if (window._playAnimations === false || window.__ppFxAlt || typeof ppFx30Maler !== 'function') return false;
    const salt = Math.floor(Math.random() * 1e6);
    if (phase === 'rise') {
      const a = srcEl && ppFx50Mitte(srcEl);
      if (!a) return false;
      const { S, rc } = ppFx50Mass(a.h), hw = Math.max(3, Math.round(a.w / S * 0.3));
      const f = ppFx50SaeulenFlaeche(a, a.y + a.h * 0.35, S, rc, hw);
      if (f.gh < 12 || f.yb - f.oben < 8) return false;
      const { wurzel, cv } = ppFx50Haengen(f.lx, f.ly, f.gw, f.gh, S, a.welt);
      ppFx50Schleife(cv, f.gw, f.gh, 'rise', (m) => ppFx50RiseZeichner({ CX: f.cx, YB: f.yb, HW: hw, rc }, m, salt), PP_FX50_RISE_ENDE * 1000 + 60, 0, () => wurzel.remove());
      return true;
    }
    if (phase === 'strike') {
      const b = tgtEl && ppFx50Mitte(tgtEl);
      if (!b) return false;
      const { S, rc } = ppFx50Mass(b.h), hw = Math.max(3, Math.round(b.w / S * 0.3));
      const f = ppFx50SaeulenFlaeche(b, b.y + b.h * 0.35, S, rc, hw);
      if (f.gh < 12 || f.yb - f.oben < 8) return false;
      const { wurzel, cv } = ppFx50Haengen(f.lx, f.ly, f.gw, f.gh, S, b.welt);
      ppFx50Schleife(cv, f.gw, f.gh, 'strike', (m) => ppFx50StrikeZeichner({ CX: f.cx, YT: 0, YB: f.yb, HW: hw, rc }, m, salt), PP_FX50_STRIKE_ENDE * 1000, 0, () => wurzel.remove());
      return true;
    }
  } catch (e) { try { console.warn('ppFx50Beam', e); } catch (er) { /* still */ } }
  return false;
}
window.ppFx50Beam = ppFx50Beam;

// Aufwärmen im Leerlauf: trockene Läufe der drei Zeichner auf Wegwerf-Puffern + ein Hochladen in eine Wegwerf-Leinwand, damit der erste echte Heilimpuls nicht im JIT-kalten Code startet
(function ppFx50Aufwaermen() {
  const los = () => {
    try {
      if (typeof ppFx30Maler !== 'function') return;
      const gw = 150, gh = 150, buf = new Uint8ClampedArray(gw * gh * 4), m = ppFx30Maler(buf, gw, gh);
      const progs = [
        [ppFx50TrefferZeichner({ CX: 75, CY: 75, rc: 1, zx0: 60, zy0: 55, zx1: 90, zy1: 95 }, m, 7, 'herz'), [0.01, 0.06, 0.15, 0.3, 0.5, 0.8]],
        [ppFx50TrefferZeichner({ CX: 75, CY: 75, rc: 1, zx0: 60, zy0: 55, zx1: 90, zy1: 95 }, m, 9, 'gruen'), [0.01, 0.06, 0.15, 0.3, 0.5, 0.8]],
        [ppFx50RiseZeichner({ CX: 75, YB: 140, HW: 7, rc: 1 }, m, 5), [0.01, 0.1, 0.25, 0.4, 0.47]],
        [ppFx50StrikeZeichner({ CX: 75, YT: 0, YB: 120, HW: 7, rc: 1 }, m, 3), [0.02, 0.1, 0.2, 0.3, 0.4]],
      ];
      const schritte = [];
      for (const [fn, ts] of progs) for (const t of ts) schritte.push(() => { buf.fill(0); m.d.x0 = gw; m.d.y0 = gh; m.d.x1 = 0; m.d.y1 = 0; fn(t); });
      schritte.push(() => { const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh; cv.getContext('2d').putImageData(new ImageData(buf, gw, gh), 0, 0); });
      const ric = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      const weiter = () => { const fn = schritte.shift(); if (!fn) return; try { fn(); } catch (e) { /* weg */ } ric(weiter, { timeout: 2500 }); };
      ric(weiter, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 4000 }) : los()), 3500);
})();
