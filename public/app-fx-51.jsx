// app-fx-51: Spielstart — Held-Ausbruch und Brettaufbau-Welle im Trailer-Look (Pixelart, nur Optik)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Trailer-Renderer (shot01.js): „Brett: gedithertes Aufbauen der übrigen Zonen“ (`drawSlot`), „Aufladen: Magiekreise und Blitzbögen“, „Ausbruch: Strahlenkranz,
//  drei Ringe“, „Schockwelle über das ganze Brett“, „Aufbau der Zonen: Wellenfront wandert nach außen“. Im Trailer dauert das ~5,8 s (Aufladen 1,15 s, Ausbruch, Welle 3,7 – 5,75 s);
//  im Spiel wartet man es bei JEDEM Spiel ab — darum ist es hier auf rund eine Sekunde zusammengezogen und läuft parallel zum Figuren-Auftritt (app-fx-46, 567 ms).
//
//  ZEITLEISTE (Effektzeit t ab dem ersten gemalten Bild; tB = Ausbruch):
//    0 – tB            AUFLADEN  kreisende, gestrichelte Magiekreise (36 + 24 Punkte) um die Heldenkarten, Blitzbögen zwischen den Helden, aufsteigende Funken.
//                      tB = Zeitpunkt, zu dem die erste Figur erscheint (`ppFx51Held`, aus `ppHeldAuftritt`), mindestens 0,10 s, höchstens 0,85 s (dann bricht es auch ohne Figur aus).
//                      Das Warten auf die Figuren-Sheets gibt es ohnehin — das Aufladen füllt es nur.
//    tB (+ 0…4 Bilder je Held)   AUSBRUCH  16 Strahlen lang/kurz (0,24 s), drei Ringe (0,46 s), Splitter, Funkenfontäne; die Figur steigt im selben Bild aus der Karte (`ppHeldAuftritt`)
//    tB                SCHOCKWELLE  gedithert über das ganze Brett (0,40 s; auf dem Handy weggelassen)
//    tB + 0,06 – +0,64 WELLE  gedithert aufbauender Schleier über den noch „unfertigen“ Zonen, Wellenfront (gold, gedithert) wandert von der Mitte nach außen (Ausbreitung 0,42 s, je Zelle 0,16 s)
//    Ende ≈ tB + 0,75; Spielbarkeit: nie gesperrt (keine Zeigersperre, Phase/Eingabe laufen unverändert, der Schleier liegt nur über der Optik) — Notbremse bei 2,0 s Echtzeit.
//  Trailer-Werte, die geändert wurden: REVEAL0 3,70 s → tB + 0,06 s; REVEAL_SPREAD 1,5 s → 0,42 s; REVEAL_DUR 0,55 s → 0,16 s; WIGGLE0 → BURST0 (1,15 s) → 0,10 – 0,85 s; Kamera-Schütteln
//  (amp 20) entfällt ganz (die Tutorial-Kamera fährt per Skript, der Schleier liegt in Feldkoordinaten); Bildschirm-Aufhellung (flash) und Kartensplitter entfallen.
//
//  TECHNIK: zwei Leinwände, Rasterzelle = 3 Bildschirmpixel (Handy: 4), 30 Bilder/s auf `ppTaktRaf`, nur bei neuem Bild zeichnen, Schmutzrechteck, feste Palettenfarben, Bayer-Dither statt Alpha.
//    • SCHLEIER: in `.fx-unter-figuren` (z 51, unter den Figuren, über dem Brett) in einer Welt-Hülle (`.fx-welt-lock`, Scrollstand zurückgenommen): Feld-Box von `.board-center`,
//      Zellen in Hintergrundfarbe (#08060c) außer an den Heldenkarten (Löcher: sie stehen von Anfang an da, wie im Trailer). Jede Zelle hat einen Auftauch-Eimer (Abstand zur Brettmitte);
//      je Bild werden nur die Eimer der laufenden Welle angefasst (jede Zelle ~5 Mal), Bayer-Schwelle in 5 Stufen. Die Zonen selbst werden NICHT animiert (kein Re-Layout).
//    • AUSBRUCH: in der Welt-Hülle des Fensters (`ppFxWeltSchicht`, über allem): Magiekreise, Blitze, Strahlen, Ringe, Splitter, Schockwelle, Wellenfront — rein zeitabhängig (keine Zustände).
//    • ANLAUF: `ppFx51Vorbereiten(gameState)` im Render von GameBoard (entscheidet, ob es läuft), `ppFx51Anlegen()` im Layout-Effekt — die Leinwände entstehen im ERSTEN requestAnimationFrame
//      nach dem Einhängen des Bretts (also vor dem ersten Bild des Bretts, aber NACH dem teuren Mounten; kein Layout-Lesen im Mount selbst). Die Zeit läuft in Bildern (je Takt höchstens 100 ms
//      Fortschritt), ein Ruckler beim Laden der Figuren frisst den Effekt also nicht auf.
//    • TUTORIAL: kein Schleier und kein Aufladen (das Brett steht schon, Textboxen laufen); nur Ausbruch (Strahlen, Ringe, Splitter) + Schockwelle, wenn die Figuren tatsächlich erscheinen
//      (`ppHeldAuftritt` meldet sie; solange `tutorialFigurenGesperrt` gilt, gibt es keine Meldung).
//    • Nicht im Retro-Modus, nicht bei reduzierter Bewegung / „Play Animations: aus“, nicht bei Wiedereintritt (`reconnected`), Zuschauern, Rätseln, `__ppFxAlt`; einmal je Raum.
//    • Test: `window.__ppFx51Aus = true` (vor dem Start) schaltet den Effekt ab (Vorher/Nachher). Handy-Profil (`ppIsPhone`): Zelle 4 px, Teilchen über `ppFxN`, keine Schockwelle, keine Funkenfontäne/-regen.
//  Messung (nur Tests): `window.__ppFx51Messen = true` → `window.__ppFx51Zeiten` = [[art, ms], …] (Zeichnen + Upload je Bild; art 'v' Schleier, 'b' Ausbruch).
// ═════════════════════════════════════════════════════════════════
const PP_FX51_TAKT = 1000 / 30;
const PP_FX51_ZD = 1.4;               // Zeitdehnung von Ausbruch und Schockwelle (1 = so schnell wie zuerst; Rückmeldung: etwas zu schnell)
const PP_FX51_CH_MIN = 0.22;           // kürzestes Aufladen (s)
const PP_FX51_CAP = 1.0;               // längstes Aufladen ohne Figur (s)
const PP_FX51_WELLE0 = 0.10;           // Wellenstart nach dem Ausbruch
const PP_FX51_SPREAD = 0.60;           // Ausbreitung der Welle von der Mitte bis in die Ecke
const PP_FX51_DAUER = 0.22;            // Aufbau einer Zelle
const PP_FX51_NACH = 1.05;             // Ende nach dem Ausbruch
const PP_FX51_NOT = 2000;              // Notbremse (Echtzeit, ms): spätestens dann ist alles aufgedeckt und aufgeräumt
const PP_FX51_MAXDT = 100;             // höchster Zeitfortschritt je Takt (ms)
const PP_FX51_BURST_BILDER = [0, 2, 1, 3, 2, 4];
const PP_FX51_PAARE = [[0, 1], [2, 3], [4, 5], [0, 2], [2, 4], [1, 3], [3, 5]];
const PP_FX51_FARBEN = [
  ['#fc69c6', '#ffffff', '#c98aff'], ['#66d9ff', '#ff9a1a', '#ffffff'], ['#f8ca21', '#a952ff', '#ec2d62'],
  ['#bddcef', '#66b6ff', '#ffffff'], ['#3866f0', '#b3d8f9', '#ffffff'], ['#66ff71', '#ffe23d', '#ffffff'],
];
const PP_FX51_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const ppFx51Kl = (v, a, b) => Math.max(a, Math.min(b, v));
const ppFx51Eo = (u) => 1 - Math.pow(1 - ppFx51Kl(u, 0, 1), 3);
const ppFx51Bild = (x) => Math.floor(x * 30 + 1e-4);
let PP_FX51_C = null;
const PP51 = { s: null, raum: null, modus: null, figuren: true, vorhanden: null, gespielt: null, tutGespielt: null };

function ppFx51Rgb(hex) {
  try { return ppHex(window.ppSnap ? window.ppSnap(hex) : hex); } catch (e) { return ppHex(hex); }
}
function ppFx51Fest() {
  return PP_FX51_C || (PP_FX51_C = {
    creme: ppFx51Rgb('#fffbd2'), gold: ppFx51Rgb('#f8ca21'), bg: ppFx51Rgb('#08060c'),
    held: PP_FX51_FARBEN.map((t) => t.map(ppFx51Rgb)),
  });
}
const ppFx51Phone = () => { try { return !!(window.ppIsPhone && window.ppIsPhone()); } catch (e) { return false; } };
const ppFx51N = (n) => (typeof ppFxN === 'function' ? ppFxN(n) : n);

// ───────────────────────── Rasterwerkzeug (Burst-Leinwand) ─────────────────────────
/** Leinwand + RGBA-Puffer + Schmutzrechteck-Maler (ppFx30Maler) in einem Stück; `hoch(…)` lädt nur das hoch, was zwei Bilder lang berührt wurde. */
function ppFx51Flaeche(gw, gh) {
  const cv = document.createElement('canvas');
  cv.width = gw; cv.height = gh;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), m = ppFx30Maler(img.data, gw, gh);
  let vor = null;
  return {
    cv, m,
    /** Beginn eines Bildes: das Vorbild löschen. */
    neu() {
      const d = m.d, buf = img.data;
      if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); }
      d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
    },
    /** Ende eines Bildes: Vereinigung aus Vorbild und diesem Bild hochladen. */
    hoch() {
      const d = m.d;
      const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
      if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
      vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
    },
  };
}

// ───────────────────────── Schleier (Brettaufbau-Welle) ─────────────────────────
/**
 * g = { L, T, W, H (Feldpixel der Box), S, loecher: [{ x0, y0, x1, y1 }] (Feldpixel) } → { cv, gx0, gy0, gw, gh, voll(fr), schritt(fr, vorher) }
 * Bild fr = Bilder seit Wellenstart; vor dem Start (fr ≤ 0) ist alles bedeckt (außer den Löchern). Jede Zelle löst sich über DURF Bilder auf (Bayer-Schwelle in DURF Stufen), und zwar ab dem Bild
 * r = Abstand zur Brettmitte (Ecke = 1) · SPREAD · 30. Keine Tabellen: je Bild werden nur die Zellen des laufenden Rings (Zeilenweise aus der Ellipsengleichung) neu geschrieben — der Aufbau
 * der Leinwand kostet damit nur das Füllen (kein Durchlauf über alle Zellen im Mount-Bild).
 */
function ppFx51Schleier(g) {
  const S = g.S, C = ppFx51Fest(), DURF = Math.max(2, Math.round(PP_FX51_DAUER * 30)), K = PP_FX51_SPREAD * 30, NR = Math.round(K) + 1;
  const gx0 = Math.floor(g.L / S) * S, gy0 = Math.floor(g.T / S) * S;
  const gw = Math.max(8, Math.min(800, Math.ceil((g.L + g.W - gx0) / S))), gh = Math.max(8, Math.min(800, Math.ceil((g.T + g.H - gy0) / S)));
  const cv = document.createElement('canvas');
  cv.width = gw; cv.height = gh;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), u32 = new Uint32Array(img.data.buffer);
  const COL = (((255 << 24) | (C.bg[2] << 16) | (C.bg[1] << 8) | C.bg[0]) >>> 0);
  const lochZeilen = [];                                       // je Zeile die Spannen [x0, x1) der Löcher (Heldenkarten)
  for (let y = 0; y < gh; y++) lochZeilen.push(null);
  for (const h of g.loecher || []) {
    const x0 = Math.max(0, Math.floor((h.x0 - gx0) / S)), x1 = Math.min(gw, Math.ceil((h.x1 - gx0) / S)), y0 = Math.max(0, Math.floor((h.y0 - gy0) / S)), y1 = Math.min(gh, Math.ceil((h.y1 - gy0) / S));
    for (let y = y0; y < y1; y++) (lochZeilen[y] || (lochZeilen[y] = [])).push(x0, x1);
  }
  const imLoch = (y, x) => { const z = lochZeilen[y]; if (!z) return false; for (let i = 0; i < z.length; i += 2) if (x >= z[i] && x < z[i + 1]) return true; return false; };
  const cx0 = (g.L + g.W / 2 - gx0) / S, cy0 = (g.T + g.H / 2 - gy0) / S, hx = Math.max(1, g.W / 2 / S), hy = Math.max(1, g.H / 2 / S), W2 = Math.SQRT2;
  const loeschen = () => {
    u32.fill(COL);
    for (let y = 0; y < gh; y++) { const z = lochZeilen[y]; if (z) for (let i = 0; i < z.length; i += 2) u32.fill(0, y * gw + z[i], y * gw + z[i + 1]); }
  };
  /** Alle Zellen mit Eimer r0 ≤ r ≤ r1 mit Stufe q = fr - r neu schreiben (je Zeile höchstens zwei Spannen aus der Ellipsengleichung, Ränder um 1,5 Zellen weiter, dann exakt geprüft); Rückgabe: Schmutzrechteck. */
  const band = (r0, r1, fr) => {
    const dLo = r0 <= 0 ? -1 : (r0 - 0.5) / K, dHi = r1 >= NR - 1 ? 9 : (r1 + 0.5) / K;
    const qLo = dLo < 0 ? -1 : 2 * dLo * dLo, qHi = 2 * dHi * dHi;
    let x0 = gw, y0 = gh, x1 = 0, y1 = 0;
    const spanne = (y, dyy, xa, xb) => {
      for (let x = Math.max(0, xa); x <= xb && x < gw; x++) {
        const dx = (x + 0.5 - cx0) / hx, d = Math.min(1, Math.sqrt(dx * dx + dyy) / W2), r = Math.min(NR - 1, Math.round(d * K));
        if (r < r0 || r > r1 || imLoch(y, x)) continue;
        const q = fr - r, thr = q >= DURF ? 16 : (q <= 0 ? 0 : Math.floor(q * 16 / DURF));
        u32[y * gw + x] = PP_FX51_BAYER[((y & 3) << 2) | (x & 3)] >= thr ? COL : 0;
        if (x < x0) x0 = x; if (x + 1 > x1) x1 = x + 1; if (y < y0) y0 = y; if (y + 1 > y1) y1 = y + 1;
      }
    };
    for (let y = 0; y < gh; y++) {
      const dy = (y + 0.5 - cy0) / hy, dyy = dy * dy, aMax = qHi - dyy;
      if (aMax <= 0) continue;
      const xOut = Math.sqrt(aMax) * hx, aMin = qLo - dyy, xIn = aMin > 0 ? Math.sqrt(aMin) * hx : 0;
      if (xIn <= 2) { spanne(y, dyy, Math.floor(cx0 - xOut - 1.5), Math.ceil(cx0 + xOut + 1.5)); continue; }
      spanne(y, dyy, Math.floor(cx0 - xOut - 1.5), Math.ceil(cx0 - xIn + 1.5));
      spanne(y, dyy, Math.floor(cx0 + xIn - 1.5), Math.ceil(cx0 + xOut + 1.5));
    }
    return { x0, y0, x1, y1 };
  };
  const voll = (fr) => {                                       // ganzes Bild neu (Anfang, Neu-Messung)
    loeschen();
    if (fr > 0) band(0, Math.min(NR - 1, fr - 1), fr);
    ctx.putImageData(img, 0, 0);
  };
  const schritt = (fr, vorher) => {                            // Ring der laufenden Welle (Vorgänger-Bild eingeschlossen: übersprungene Bilder verlieren nichts)
    const r0 = Math.max(0, (vorher == null ? fr - 1 : vorher) - DURF), r1 = Math.min(NR - 1, fr - 1);
    if (r1 < r0) return;
    const d = band(r0, r1, fr);
    if (d.x1 > d.x0 && d.y1 > d.y0) ctx.putImageData(img, 0, 0, d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
  };
  return { cv, gx0, gy0, gw, gh, voll, schritt };
}

// ───────────────────────── Ausbruch (Burst-Leinwand) ─────────────────────────
/** Zeichnet ein Bild des Ausbruchs. `sz` = Sitzung (Helden mit Zellmitte, tb, Brettbox in Zellen), t = Effektzeit (s). */
function ppFx51Malen(m, sz, t) {
  const C = ppFx51Fest(), H = ppFx30H, rd = Math.round, fr = ppFx51Bild(t), phone = sz.phone, hel = sz.helden, spiel = sz.modus === 'spiel';
  const sp = (id, a, b) => H(id * 977 + a, b);
  // — Aufladen: Magiekreise (kreisend, gestrichelt), Funken, Blitzbögen —
  const aufEnde = (h) => (h.tb != null ? h.tb + 1 / 30 : Infinity);
  if (spiel) {
    for (const h of hel) {
      if (t < 0 || t >= aufEnde(h)) continue;
      const u = ppFx51Kl(t / 0.55, 0, 1), rot = Math.floor(fr / 2), k = h.k, R = (21 + 10 * u * u) * k, s2 = u > 0.55 ? 2 : 1, c0 = h.c[0], c1 = h.c[1];
      const n1 = phone ? 24 : 36, n2 = phone ? 16 : 24;
      for (let q = 0; q < n1; q++) {
        if ((q + rot) % 3) continue;
        const a = q / n1 * Math.PI * 2;
        m.rect(rd(h.x + Math.cos(a) * R), rd(h.y + Math.sin(a) * R), s2, s2, (q + rot) % 6 === 0 ? c0 : C.creme);
      }
      for (let q = 0; q < n2; q++) {
        if ((((q - rot) % 4) + 4) % 4) continue;
        const a = q / n2 * Math.PI * 2;
        m.rect(rd(h.x + Math.cos(a) * R * 0.68), rd(h.y + Math.sin(a) * R * 0.68), s2, s2, c1);
      }
      // aufsteigende Lade-Funken (je Bild einer, rein zeitabhängig)
      const kk = Math.max(k, 0.6), vorne = phone ? 6 : 12;
      for (let b = Math.max(0, fr - vorne); b <= fr; b++) {
        const id = h.i * 1009 + b, alter = (fr - b) / 30, leben = 0.30 + 0.25 * sp(id, 1, 3);
        if (alter >= leben || H(id, 9) > 0.35 + 0.65 * u) continue;
        const x = h.x + (sp(id, 1, 1) - 0.5) * h.w * 1.1, y = h.y + (sp(id, 1, 2) - 0.5) * h.h * 1.1 - (20 + 57 * sp(id, 1, 4)) * kk * alter;
        m.rect(rd(x), rd(y), sp(id, 1, 5) < 0.2 ? 2 : 1, sp(id, 1, 5) < 0.2 ? 2 : 1, [C.creme, c0, c1][Math.floor(sp(id, 1, 6) * 3)]);
      }
    }
    // Blitzbögen zwischen den Helden (Zickzack, Heldenfarbe versetzt unter Creme)
    const tB = sz.tB;
    if (t >= 0.04 && (tB == null || t < tB)) {
      const u = ppFx51Kl(t / 0.55, 0, 1), w = Math.floor(fr / 2), nMax = phone ? 3 : 7;
      let gezeichnet = 0;
      for (let pi = 0; pi < PP_FX51_PAARE.length && gezeichnet < nMax; pi++) {
        const A = sz.nachI[PP_FX51_PAARE[pi][0]], B = sz.nachI[PP_FX51_PAARE[pi][1]];
        if (!A || !B || H(pi, w) > 0.12 + 0.6 * u) continue;
        gezeichnet++;
        const ax = rd(A.x), ay = rd(A.y), bx = rd(B.x), by = rd(B.y), n = Math.max(4, rd(Math.hypot(bx - ax, by - ay) / 6)), nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
        let px = ax, py = ay;
        for (let q = 1; q <= n; q++) {
          const f = q / n; let qx = ax + (bx - ax) * f, qy = ay + (by - ay) * f;
          if (q < n) { const off = (H(pi * 31 + q, w + 7) - 0.5) * 7; qx += nx / nl * off; qy += ny / nl * off; }
          qx = rd(qx); qy = rd(qy);
          m.linie(px + 1, py, qx + 1, qy, 1, A.c[0]); m.linie(px, py, qx, qy, 1, C.creme);
          px = qx; py = qy;
        }
      }
    }
  }
  // — Ausbruch je Held —
  for (const h of hel) {
    if (h.tb == null) continue;
    const dt = (t - h.tb) / PP_FX51_ZD;
    if (dt < 0 || dt > 0.62) continue;
    const k = h.k, c0 = h.c[0], c1 = h.c[1], c2 = h.c[2], dk = Math.max(0.55, Math.min(1, k * 1.1));
    if (dt <= 0.46) {
      if (dt < 0.24) {                                          // Strahlenkranz, lang/kurz im Wechsel
        const L = dt < 0.12 ? ppFx51Eo(dt / 0.12) : 1 - (dt - 0.12) / 0.12;
        for (let r = 0; r < 16; r++) {
          const lang = r % 2 === 0, a = r * Math.PI / 8 + 0.1 + h.i * 0.37, len = L * (lang ? 64 : 38) * k;
          m.linie(rd(h.x), rd(h.y), rd(h.x + Math.cos(a) * len), rd(h.y + Math.sin(a) * len * 0.9), Math.max(1, rd((lang ? 3 : 2) * dk)), lang ? C.creme : c0);
        }
      }
      m.ring(rd(h.x), rd(h.y), Math.max(1, rd(ppFx51Eo(dt / 0.4) * 34 * k)), 1, C.creme, false);
      if (dt > 0.04) m.ring(rd(h.x), rd(h.y), Math.max(1, rd(ppFx51Eo((dt - 0.04) / 0.38) * 24 * k)), 1, c0, false);
      if (dt > 0.08) m.ring(rd(h.x), rd(h.y), Math.max(1, rd(ppFx51Eo((dt - 0.08) / 0.38) * 52 * k)), Math.max(1, rd(2 * dk)), c1, true);
    }
    // Splitter (radial, bremsend) und Funkenfontäne (steigt, fällt)
    const nS = ppFx51N(26), kk = Math.max(k, 0.55);
    for (let j = 0; j < nS; j++) {
      const id = h.i * 331 + j, leben = 0.30 + 0.30 * sp(id, 2, 1);
      if (dt >= leben) continue;
      if (dt > leben * 0.72 && (fr & 1)) continue;
      const a = sp(id, 2, 2) * Math.PI * 2, v = (66 + 250 * sp(id, 2, 3)) * kk, f = dt - 0.7 * dt * dt, g = 53 * dt * dt * 0.5 * kk;
      const x = rd(h.x + Math.cos(a) * v * f), y = rd(h.y + Math.sin(a) * v * f + g), col = [C.creme, c0, c1, c2][Math.floor(sp(id, 2, 4) * 4)];
      if (sp(id, 2, 5) < 0.3) { m.rect(x - 1, y, 3, 1, col); m.rect(x, y - 1, 1, 3, col); } else { const z = sp(id, 2, 6) < 0.4 ? 2 : 1; m.rect(x, y, z, z, col); }
    }
    if (!phone) {
      const nF = ppFx51N(12);
      for (let j = 0; j < nF; j++) {
        const id = h.i * 211 + j, t0 = 0.03 + 0.12 * sp(id, 3, 1), alter = dt - t0, leben = 0.40 + 0.30 * sp(id, 3, 2);
        if (alter < 0 || alter >= leben) continue;
        const spread = (sp(id, 3, 3) - 0.5) * 80 / 3 * kk, vy = (40 + 87 * sp(id, 3, 4)) * kk;
        m.rect(rd(h.x + spread * (1 + 1.5 * alter)), rd(h.y + h.h * 0.35 - vy * alter + 173 * alter * alter * kk * 0.5), 1, 1, [C.creme, c0, c1, c2][Math.floor(sp(id, 3, 5) * 4)]);
      }
    }
  }
  // — Schockwelle über das ganze Brett, Wellenfront, Funkenregen —
  const tB = sz.tB;
  if (tB != null) {
    const dtB = (t - tB) / PP_FX51_ZD, B = sz.box;
    if (!phone && dtB >= 0 && dtB < 0.40) {                   // Ellipse mit den Halbachsen des Bretts: erreicht alle Ränder zugleich, wird nicht an der Leinwandkante abgeschnitten
      const e = ppFx51Eo(dtB / 0.40) * 1.25, ell = (cx, cy, rx, ry, th, c) => {
        const n = ppFx51Kl(rd(Math.PI * 2 * Math.max(rx, ry) * 1.2), 24, 900);
        for (let q = 0; q < n; q++) { const a = q / n * Math.PI * 2, X = rd(cx + Math.cos(a) * rx), Y = rd(cy + Math.sin(a) * ry); if (((X + Y) & 1) === 0) m.rect(X, Y, th, th, c); }
      };
      ell(B.cx, B.cy, e * B.hx, e * B.hy, 2, C.creme);
      if (dtB > 0.05) ell(B.cx, B.cy, e * B.hx * 0.86, e * B.hy * 0.86, 1, C.gold);
    }
    if (spiel) {
      const df = (t - (tB + PP_FX51_WELLE0)) / PP_FX51_SPREAD;
      if (df > 0 && df < 1.12) {
        const rx = df * Math.SQRT2 * B.hx, ry = df * Math.SQRT2 * B.hy, n = ppFx51Kl(rd(Math.PI * 2 * Math.max(rx, ry) * 0.9), 40, phone ? 360 : 640), dz = sz.S >= 4 ? 1 : 2;
        for (let q = 0; q < n; q++) {
          const a = q / n * Math.PI * 2, X = rd(B.cx + Math.cos(a) * rx), Y = rd(B.cy + Math.sin(a) * ry);
          if (((X + Y) & 1) === 0 && X >= 0 && Y >= 0 && X < sz.bgw && Y < sz.bgh) m.rect(X, Y, dz, dz, C.gold);
        }
        const nSt = ppFx51N(4);                                 // Funkeln, wo sich Zonen gerade aufbauen
        for (let q = 0; q < nSt; q++) {
          const id = fr * 7 + q, a = H(id, 11) * Math.PI * 2, X = rd(B.cx + Math.cos(a) * rx * 0.97), Y = rd(B.cy + Math.sin(a) * ry * 0.97);
          if (X < 1 || Y < 1 || X >= sz.bgw - 1 || Y >= sz.bgh - 1) continue;
          m.rect(X - 1, Y, 3, 1, C.creme); m.rect(X, Y - 1, 1, 3, C.creme);
        }
      }
      if (!phone && dtB > 0.05 && dtB < 0.75) {                 // Funkenregen übers Brett
        const nR = ppFx51N(26);
        for (let q = 0; q < nR; q++) {
          const id = 7000 + q, t0 = 0.05 + 0.45 * H(id, 1), alter = dtB - t0, leben = 0.4 + 0.3 * H(id, 2);
          if (alter < 0 || alter >= leben) continue;
          const X = rd(B.l + H(id, 3) * B.w), Y = rd(B.t + H(id, 4) * B.h + (13 + 40 * H(id, 5)) * alter);
          m.rect(X, Y, H(id, 6) < 0.25 ? 2 : 1, H(id, 6) < 0.25 ? 2 : 1, q & 1 ? C.creme : C.gold);
        }
      }
    }
  }
}

// ───────────────────────── Sitzung ─────────────────────────
function ppFx51HeldKey(zone) {
  const o = zone && zone.getAttribute && zone.getAttribute('data-hero-owner'), idx = parseInt(zone && zone.getAttribute && zone.getAttribute('data-hero-idx'), 10);
  if (!o || !(idx >= 0)) return null;
  return { o, idx, i: (idx % 3) * 2 + (o === 'opp' ? 1 : 0), key: o + idx };
}
const ppFx51Uhr = (s) => (s.phase === 'laeuft' ? s.t + Math.min(performance.now() - s.tLetzt, s.langsam >= 2 ? 400 : PP_FX51_MAXDT) / 1000 : 0);

/** Zeitpunkt des Ausbruchs für diese Figur festlegen (beim ersten Aufruf auch tB) → Aufschub des Figuren-Auftritts in ms. */
function ppFx51Plan(s, hk) {
  const tNow = ppFx51Uhr(s);
  if (s.tB == null) {
    s.tB = s.modus === 'tut' ? tNow : ppFx51Kl(Math.max(tNow, PP_FX51_CH_MIN), 0, PP_FX51_CAP);
    s.tW0 = s.tB + PP_FX51_WELLE0;
  }
  if (s.tb[hk.key] == null) s.tb[hk.key] = Math.max(tNow, s.tB) + PP_FX51_BURST_BILDER[hk.i % 6] / 30;
  if (s.modus === 'tut') s.tEnde = Math.max(s.tEnde || 0, s.tb[hk.key] + 0.7);
  return Math.round(ppFx51Kl(s.tb[hk.key] - tNow, 0, 0.25) * 1000);
}

function ppFx51Erlaubt() {
  try {
    if (window.PP_RETRO || window._playAnimations === false || window.__ppFxAlt || window.__ppFx51Aus || typeof ppFx30Maler !== 'function') return false;
    if (window.PPPixelAnim && window.PPPixelAnim.KONFIG && window.PPPixelAnim.KONFIG.aktiv === false) return false;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
  } catch (e) { return false; }
}

/** Render von GameBoard (einmal je Einhängen): entscheidet, ob der Spielstart-Effekt läuft. */
window.ppFx51Vorbereiten = function (gs, o) {
  try {
    ppFx51Abbruch();
    PP51.modus = null; PP51.raum = null;
    if (!gs || !ppFx51Erlaubt() || gs.isSpectator || gs.reconnected || (gs.isPuzzle && !gs.isTutorial)) return 0;      // Tutorials laufen als Rätsel (`isPuzzle`), eigene Rätsel nicht
    const raum = gs.roomId != null ? String(gs.roomId) : 'x';
    PP51.raum = raum; PP51.figuren = !(o && o.figuren === false);
    if (gs.isTutorial) { PP51.modus = 'tut'; if (raum === 'x') PP51.tutGespielt = null; return 1; }
    if ((gs.turn || 1) > 1 || (raum !== 'x' && PP51.gespielt === raum)) return 0;
    const me = gs.players && gs.players[gs.myIndex], opp = gs.players && gs.players[1 - gs.myIndex], vor = {};
    for (let i = 0; i < 3; i++) { vor['me' + i] = !!(me && me.heroes && me.heroes[i] && me.heroes[i].name); vor['opp' + i] = !!(opp && opp.heroes && opp.heroes[i] && opp.heroes[i].name); }
    PP51.vorhanden = vor; PP51.modus = 'spiel';
    PP51.s = ppFx51NeueSitzung('spiel', raum);
    return 1;
  } catch (e) { return 0; }
};

function ppFx51NeueSitzung(modus, raum) {
  return { modus, raum, phase: 'wartet', erzeugt: performance.now(), t: 0, tLetzt: 0, tB: null, tW0: null, tb: {}, tEnde: null, helden: [], nachI: [], tut: modus === 'tut', neuMessen: true, geplant: false };
}

/** Layout-Effekt von GameBoard: nach dem Einhängen des Bretts im ersten Bild anlegen. */
window.ppFx51Anlegen = function () {
  try {
    const s = PP51.s;
    if (!s || s.phase !== 'wartet' || s.geplant || s.modus !== 'spiel') return;
    if (!PP51.figuren) { s.tB = PP_FX51_CH_MIN; s.tW0 = s.tB + PP_FX51_WELLE0; }
    ppFx51Plane(s);
  } catch (e) { /* ohne Effekt */ }
};
function ppFx51Plane(s) {
  s.geplant = true;
  requestAnimationFrame(() => ppFx51Start(s));
  setTimeout(() => { if (s.phase === 'wartet') ppFx51Ende(s); }, 4000);       // Brett kam nie (verworfener Render): aufräumen
}

window.ppFx51Abbruch = function () {
  try { const s = PP51.s; if (s) ppFx51Ende(s); } catch (e) { /* weg */ }
};

/** Aus `ppHeldAuftritt`: eine Figur erscheint. Gibt den Aufschub (ms) zurück, damit ihr Auftritt im Bild des Ausbruchs beginnt. */
window.ppFx51Held = function (platz, zone) {
  try {
    if (!PP51.modus) return 0;
    const hk = ppFx51HeldKey(zone);
    if (!hk) return 0;
    let s = PP51.s;
    if (PP51.modus === 'tut') {
      if (!s || s.phase === 'fertig') {
        if (PP51.tutGespielt === PP51.raum || !ppFx51Erlaubt()) return 0;
        s = PP51.s = ppFx51NeueSitzung('tut', PP51.raum);
        PP51.tutGespielt = PP51.raum;
        ppFx51Plane(s);
      }
      s.tut = true;
    } else if (!s || s.phase === 'fertig') return 0;
    if (s.phase === 'laeuft' && s.tut && !s.helden.some((h) => h.key === hk.key)) s.neuMessen = true;
    return ppFx51Plan(s, hk);
  } catch (e) { return 0; }
};

/** Messen: Brettbox und Heldenzonen in Feldkoordinaten (Fenster + Scrollstand des Feldes). */
function ppFx51Messen(s) {
  const bc = document.querySelector('.board-center');
  if (!bc) return null;
  const S = ppFx51Phone() ? 4 : 3, fo = window.ppFxScrollOffset ? window.ppFxScrollOffset() : { dx: 0, dy: 0 }, r = bc.getBoundingClientRect();
  const L = r.left + fo.dx - bc.scrollLeft + 0, T = r.top + fo.dy - bc.scrollTop;   // Inhaltsursprung des Feldes in Feldkoordinaten
  const W = Math.min(2400, Math.max(bc.clientWidth, bc.scrollWidth)), Hh = Math.min(2400, Math.max(bc.clientHeight, bc.scrollHeight));
  if (!(W > 40 && Hh > 40)) return null;
  const zonen = [];
  for (const el of document.querySelectorAll('[data-hero-zone]')) {
    const hk = ppFx51HeldKey(el);
    if (!hk) continue;
    if (s.modus === 'spiel' && PP51.vorhanden && !PP51.vorhanden[hk.key]) continue;
    if (s.modus === 'tut' && s.tb[hk.key] == null) continue;
    const q = el.getBoundingClientRect();
    if (!(q.width > 4 && q.height > 4)) continue;
    zonen.push({ hk, x: q.left + fo.dx, y: q.top + fo.dy, w: q.width, h: q.height });
  }
  return { S, L, T, W, H: Hh, zonen, fo };
}

function ppFx51Start(s) {
  const mi = window.__ppFx51Messen ? performance.now() : 0;
  try {
    if (s.phase !== 'wartet') return;
    const bc = document.querySelector('.board-center');
    if (!bc || !document.body) { ppFx51Ende(s); return; }
    const mA = mi ? performance.now() : 0;
    const gm = ppFx51Messen(s);
    const mB = mi ? performance.now() : 0;
    if (!gm) { ppFx51Ende(s); return; }
    s.S = gm.S; s.phone = ppFx51Phone();
    const unter = s.modus === 'spiel' ? document.querySelector('.fx-unter-figuren') : null;
    s.unter = unter;
    s.phase = 'laeuft';
    s.tStart = s.tLetzt = performance.now();
    s.bauen = (gm2) => ppFx51Bauen(s, gm2);
    const mC = mi ? performance.now() : 0;
    s.bauen(gm);
    const mD = mi ? performance.now() : 0;
    if (s.modus === 'spiel' && unter && s.schleier) { unter.appendChild(s.schleierWurzel); s.schleier.voll(-1); }
    (window.ppFxWeltSchicht ? window.ppFxWeltSchicht() : document.body).appendChild(s.burstWurzel);
    if (mi) window.__ppFx51Teile = { vorMessen: +(mA - mi).toFixed(1), messen: +(mB - mA).toFixed(1), bauen: +(mD - mC).toFixed(1), anhaengen: +(performance.now() - mD).toFixed(1) };
    try { s.ro = new ResizeObserver(() => { s.neuMessen = true; }); s.ro.observe(bc); const klip = bc.querySelector('.board-plane-clip'); if (klip) s.ro.observe(klip); } catch (e) { s.ro = null; }
    s.neuMessen = false;
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const schritt = (jetzt) => {
      if (s.phase !== 'laeuft') return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      ppFx51Tick(s, jetzt);
      if (s.phase === 'laeuft') s.id = takt(schritt);
    };
    s.id = takt(schritt);
    s.notnagel = setTimeout(() => ppFx51Ende(s), PP_FX51_NOT + 1500);
    if (mi) (window.__ppFx51Zeiten || (window.__ppFx51Zeiten = [])).push(['i', +(performance.now() - mi).toFixed(3)]);
  } catch (e) { try { console.warn('ppFx51Start', e); } catch (e2) { /* still */ } ppFx51Ende(s); }
}

/** Leinwände und Zellmaße aus der Messung (neu) aufbauen; Schleierstand bleibt erhalten, wenn schon etwas gezeichnet wurde. */
function ppFx51Bauen(s, gm) {
  const S = gm.S, C = ppFx51Fest(), alt = s.schleierWurzel, altB = s.burstWurzel;
  s.S = S;
  // Schleier: Welt-Hülle (`.fx-welt-lock`) in `.fx-unter-figuren` (die nimmt den Scrollstand des Feldes zurück); Ausbruch: schlichte Fixed-Hülle in der Welt-Schicht des Fensters (die ist schon eine Welt-Hülle)
  const wurzel = (cv, gx0, gy0, welt) => {
    const w = document.createElement('div');
    w.setAttribute('aria-hidden', 'true'); w.setAttribute('data-pp-px', 'aus');
    if (welt) { w.className = 'fx-welt-lock'; w.style.cssText = 'position:fixed;inset:0;pointer-events:none;'; cv.style.cssText = `position:absolute;left:${gx0}px;top:${gy0}px;`; }
    else { w.style.cssText = `position:fixed;left:${gx0}px;top:${gy0}px;pointer-events:none;`; cv.style.cssText = ''; }
    cv.style.cssText += `width:${cv.width * S}px;height:${cv.height * S}px;image-rendering:pixelated;display:block;`;
    w.appendChild(cv);
    return w;
  };
  // Heldenzonen → Löcher im Schleier, Zellmitten für den Ausbruch
  const loecher = gm.zonen.map((z) => ({ x0: z.x - 2 * S, y0: z.y - 2 * S, x1: z.x + z.w + 2 * S, y1: z.y + z.h + 2 * S }));
  if (s.modus === 'spiel' && s.unter) {
    const sch = ppFx51Schleier({ L: gm.L, T: gm.T, W: gm.W, H: gm.H, S, loecher });
    s.schleier = sch; s.schleierWurzel = wurzel(sch.cv, sch.gx0, sch.gy0, true);
  } else { s.schleier = null; s.schleierWurzel = null; }
  // Ausbruch-Leinwand: Brettbox plus Rand oben/unten (Strahlen der äußeren Helden)
  const RAND = 96, bl = Math.floor((gm.L - 30) / S) * S, bt = Math.floor((gm.T - RAND) / S) * S;
  const bgw = Math.max(8, Math.min(900, Math.ceil((gm.L + gm.W + 30 - bl) / S))), bgh = Math.max(8, Math.min(700, Math.ceil((gm.T + gm.H + RAND - bt) / S)));
  const fl = ppFx51Flaeche(bgw, bgh);
  s.burst = fl; s.bgw = bgw; s.bgh = bgh;
  s.burstWurzel = wurzel(fl.cv, bl, bt, false);
  s.helden = gm.zonen.map((z) => {
    const cols = C.held[z.hk.i % 6], wz = z.w / S, k = ppFx51Kl(wz / 40, 0.25, 1.3);
    return { key: z.hk.key, i: z.hk.i, x: (z.x + z.w / 2 - bl) / S, y: (z.y + z.h / 2 - bt) / S, w: z.w / S, h: z.h / S, k, c: cols, get tb() { return s.tb[z.hk.key] == null ? null : s.tb[z.hk.key]; } };
  });
  s.nachI = []; for (const h of s.helden) s.nachI[h.i] = h;
  const cxB = (gm.L + gm.W / 2 - bl) / S, cyB = (gm.T + gm.H / 2 - bt) / S, hx = gm.W / 2 / S, hy = gm.H / 2 / S;
  s.box = { cx: cxB, cy: cyB, hx, hy, rmax: Math.hypot(hx, hy), l: (gm.L - bl) / S, t: (gm.T - bt) / S, w: gm.W / S, h: gm.H / S };
  s.bgw = bgw; s.bgh = bgh;
  s.gm = gm;
  if (alt && alt.parentNode) { if (s.schleierWurzel) alt.parentNode.replaceChild(s.schleierWurzel, alt); else alt.remove(); }
  if (altB && altB.parentNode) altB.parentNode.replaceChild(s.burstWurzel, altB);
}

function ppFx51Tick(s, jetzt) {
  const mess = window.__ppFx51Messen ? performance.now() : 0;
  // Eile: ruckelt das Gerät (zwei Takte mit > 90 ms Abstand, z. B. weil das Brett noch aufgebaut wird), läuft die Zeit in echten Sekunden weiter (Schritte bis 400 ms) und der Ausbruch
  // kommt sofort — der Schleier hängt dann höchstens ~0,8 s länger, statt im Zeitlupen-Takt (je Takt 100 ms) mehrere Sekunden über dem Brett zu stehen.
  const echt = jetzt - s.tLetzt;
  if (echt > 90) s.langsam = (s.langsam || 0) + 1;
  const dt = Math.min(echt, s.langsam >= 2 ? 400 : PP_FX51_MAXDT);
  s.tLetzt = jetzt;
  s.t += Math.max(0, dt) / 1000;
  if (jetzt - s.tStart > PP_FX51_NOT) { ppFx51Ende(s); return; }
  if (s.tB == null && s.modus === 'spiel' && (s.t >= PP_FX51_CAP || s.langsam >= 2)) { s.tB = Math.min(s.t, PP_FX51_CAP); s.tW0 = s.tB + PP_FX51_WELLE0; }
  // geänderte Maße (Layout rückt nach dem Mounten zurecht) oder neu gemeldete Tutorial-Helden: neu messen und aufbauen
  if (s.neuMessen) {
    s.neuMessen = false;
    const gm = ppFx51Messen(s);
    if (gm) {
      const alteBox = s.gm, geaendert = !alteBox || Math.abs(alteBox.L - gm.L) > 2 || Math.abs(alteBox.T - gm.T) > 2 || Math.abs(alteBox.W - gm.W) > 2 || Math.abs(alteBox.H - gm.H) > 2 || alteBox.zonen.length !== gm.zonen.length
        || alteBox.zonen.some((z, i) => Math.abs(z.x - gm.zonen[i].x) > 2 || Math.abs(z.y - gm.zonen[i].y) > 2);
      if (geaendert) { s.bauen(gm); if (s.schleier) s.schleier.voll(s.tW0 == null ? -1 : ppFx51Bild(s.t - s.tW0)); s.vorFr = null; }
    }
  }
  if (s.tB != null && !s.ausgebrochen) {
    s.ausgebrochen = true;
    PP51.gespielt = s.raum;
    if (s.modus === 'spiel') for (const h of s.helden) if (s.tb[h.key] == null) s.tb[h.key] = s.tB + PP_FX51_BURST_BILDER[h.i % 6] / 30;
    if (s.tEnde == null) s.tEnde = s.tB + PP_FX51_NACH;
  }
  ppFx51Ton(s);
  const t = s.t, fr = ppFx51Bild(t);
  if (fr !== s.letztesBild) {
    s.letztesBild = fr;
    // Schleier
    if (s.schleier && s.tW0 != null) {
      const frW = ppFx51Bild(t - s.tW0);
      if (frW !== s.vorFr) {
        const m0 = window.__ppFx51Messen ? performance.now() : 0;
        s.schleier.schritt(frW, s.vorFr);
        s.vorFr = frW;
        if (m0) (window.__ppFx51Zeiten || (window.__ppFx51Zeiten = [])).push(['v', +(performance.now() - m0).toFixed(3)]);
      }
    }
    // Ausbruch
    const m1 = window.__ppFx51Messen ? performance.now() : 0;
    s.burst.neu();
    ppFx51Malen(s.burst.m, { modus: s.modus, helden: s.helden, nachI: s.nachI, tB: s.tB, box: s.box, S: s.S, bgw: s.bgw, bgh: s.bgh, phone: s.phone }, t);
    const m2 = m1 ? performance.now() : 0;
    s.burst.hoch();
    if (m1) { const z = window.__ppFx51Zeiten || (window.__ppFx51Zeiten = []), m3 = performance.now(); z.push(['b', +(m3 - m1).toFixed(3)]); z.push(['bm', +(m2 - m1).toFixed(3)]); z.push(['bu', +(m3 - m2).toFixed(3)]); }
  }
  if (s.tEnde != null && t >= s.tEnde) ppFx51Ende(s);
  if (mess) (window.__ppFx51Zeiten || (window.__ppFx51Zeiten = [])).push(['t', +(performance.now() - mess).toFixed(3)]);
}

/** Klänge zur Zeitleiste (wie im Trailer: Aufladen → Wucht + Aufstieg beim Ausbruch → Zauberklang je Held → „reveal“ beim Aufdecken). Jeder höchstens einmal; Lautstärke/Stumm regelt playSFX. */
function ppFx51Ton(s) {
  if (!window.playSFX) return;
  const z = s.ton || (s.ton = {}), t = s.t, ton = (id, name, vol) => { if (z[id]) return; z[id] = 1; try { window.playSFX(name, { volume: vol, dedupe: 0 }); } catch (e) { /* stumm */ } };
  if (s.modus === 'spiel' && s.tB == null) ton('lade', 'match_start', 0.55);
  if (s.tB == null) return;
  const tut = s.modus === 'tut';
  if (t >= s.tB) ton('wumms', 'heavy_impact', tut ? 0.7 : 0.9);
  if (t >= s.tB + 0.05) ton('auf', 'ascension', tut ? 0.3 : 0.4);
  for (const h of s.helden) if (h.i % 2 === 0 && s.tb[h.key] != null && t >= s.tb[h.key]) ton('h' + h.key, 'spell_cast', 0.35);   // drei statt sechs, sonst wird es ein Klangbrei
  if (!tut && s.tW0 != null && t >= s.tW0) ton('welle', 'reveal', 0.5);
}

function ppFx51Ende(s) {
  if (!s || s.phase === 'fertig') return;
  const war = s.phase;
  s.phase = 'fertig';
  try { if (s.id) cancelAnimationFrame(s.id); } catch (e) { /* weg */ }
  try { clearTimeout(s.notnagel); } catch (e) { /* weg */ }
  try { if (s.ro) s.ro.disconnect(); } catch (e) { /* weg */ }
  try { if (s.schleierWurzel) s.schleierWurzel.remove(); } catch (e) { /* weg */ }
  try { if (s.burstWurzel) s.burstWurzel.remove(); } catch (e) { /* weg */ }
  s.schleier = null; s.burst = null; s.schleierWurzel = null; s.burstWurzel = null;
  if (PP51.s === s && war === 'wartet' && s.modus === 'spiel') PP51.s = null;
}

// Aufwärmen im Leerlauf: Schleier und Ausbruch auf Probemaßen ohne DOM durchrechnen — das erste Spiel startet nicht im JIT-kalten Code (kein Zugriff aufs Layout, keine Leinwand im Dokument)
(function ppFx51Aufwaermen() {
  const los = () => {
    try {
      if (!ppFx51Erlaubt()) return;
      const S = ppFx51Phone() ? 4 : 3, W = ppFx51Phone() ? 700 : 1000, Hh = ppFx51Phone() ? 260 : 560;
      const schritte = [];
      const sch = ppFx51Schleier({ L: 60, T: 100, W, H: Hh, S, loecher: [{ x0: 200, y0: 150, x1: 260, y1: 240 }] });
      const fl = ppFx51Flaeche(Math.ceil(W / S), Math.ceil(Hh / S));
      const heldenProbe = [0, 1, 2, 3, 4, 5].map((i) => ({ key: 'x' + i, i, x: 40 + 55 * i, y: 60 + 20 * (i % 2), w: 20, h: 28, k: 0.5, c: ppFx51Fest().held[i], tb: 0.1 }));
      const nachI = []; for (const h of heldenProbe) nachI[h.i] = h;
      const box = { cx: W / S / 2, cy: Hh / S / 2, hx: W / S / 2, hy: Hh / S / 2, rmax: Math.hypot(W, Hh) / S / 2, l: 0, t: 0, w: W / S, h: Hh / S };
      schritte.push(() => sch.voll(-1));
      for (const q of [2, 6, 11, 17]) schritte.push(() => sch.schritt(q, q - 2));
      for (const q of [0.05, 0.12, 0.3, 0.55]) schritte.push(() => { fl.neu(); ppFx51Malen(fl.m, { modus: 'spiel', helden: heldenProbe, nachI, tB: 0.1, box, S, bgw: Math.ceil(W / S), bgh: Math.ceil(Hh / S), phone: ppFx51Phone() }, q); fl.hoch(); });
      const ric = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
      const weiter = () => { const fn = schritte.shift(); if (!fn) return; try { fn(); } catch (e) { /* weg */ } ric(weiter, { timeout: 2500 }); };
      ric(weiter, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 4000 }) : los()), 2500);
})();
