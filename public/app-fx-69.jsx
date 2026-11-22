// app-fx-69: Beschwörungskreis, gedithertes Kartenerscheinen, Lichtsäule und Kraftstrom-Kugeln (Kreaturen, Biomancy-Token, Alchemy) — Pixelart-Leinwand im Trailer-Look
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Trailer (shot01.js „Zug 2: Beschwörungskreis“, „Kraftstrom von Alice in den Kreis“, `ditherCard`, `drawPillar`; „Zug 3a: Alchemy“; „Zug 3: Biomancy-Strom“).
//  Alles ist eine reine Funktion des Bildes f (30 Hz, `ppTaktRaf`): feste Palettenfarben (`ppSnapRgb`), Bayer-Dither statt Alpha, nichts gedreht / weich skaliert, Bewegung in ganzen Zellen.
//  Rasterzelle S = Hero-Pixel der Reihe der Zone (`ppFxZelle`); alle Trailer-Maße in Zellen werden mit rc = Zonenhöhe / (35 · S) auf das Spiel umgerechnet (wie app-fx-48).
//
//  1. BESCHWÖRUNG (`window.ppFx69Beschwoerung(zoneEl, { color, bio })` → true, wenn der Look läuft; sonst false → der Aufrufer (spawnZoneLandFx, Variante 'summon') spielt den alten CSS-Kreis).
//     Ausgelöst vom Belegungs-Vergleich in app-board.jsx (GameBoard) — also für JEDE Kreatur, die in einer Support-Zone landet: eigene und gegnerische Seite, aus Hand, Deck, Ablage, Wiederbelebung, Token.
//     Zeitbasis t = 0: der Platz ist belegt (Spielzustand). Liegt noch ein Kartenflug in der Luft (`.hand-to-board-fly`, oder die Zonenkarte ist von einem Pile-Flug verborgen), läuft der
//     Kreis währenddessen und die Landung folgt, sobald die Karte angekommen ist; sonst landet sie nach 5 Bildern (0,15 s Kreisaufbau). Der Look ist reine Optik — die Engine wartet nicht darauf.
//       0 – 0,5 s     Kreis wächst (easeOutBack 1,4): dunkle Dither-Bodenfläche (Ink 59 %, Dunkelgrün 22 %), Außenring (2 Zellen, Creme/Grün im 8er-Takt), Innenring 0,72 (Gold/Creme),
//                     24 Runenstriche (jeder zweite), Pentagramm mit Eckquadraten; liegt in der BRETTEBENE (Homografie der Zonen-Ecken), Radius 1,05 Zonenbreiten; die Karten darüber verdecken ihn
//       0,05 – ~0,6   Kraftstrom: Kugeln (Abstand 0,02 s, je 0,32 s) auf Bögen von der Brust des Helden dieser Zone in die Zone (Schweif 6 Bilder, Kopf 5 × 5 grün/gold, Kern creme);
//                     „Held nimmt Kraft auf“: drei Ringe um die Füße (Gold, Grün, Creme; 0,45 s, Abstand 0,16 s)
//       Landung tL    Karte baut sich gedithert auf (Bayer, 7 Bilder; die ersten zwei Bilder mit Creme-Blitz 70 % / 45 %), harte Rahmenringe um die Karte (10 Bilder), Schockringe (Creme, Grün, Gold,
//                     Grün gedithert; 0,6 s), 28 Strahlen (0,2 s), Lichtsäule (14 × 56 Quellpixel, Bayer-Dither, Kern Creme, Rand Grün; wächst in 3 Stufen, wird dann schmaler; 15 Bilder),
//                     Splitter und aufsteigende Funken; der Kreis bleibt 0,45 s und schrumpft in 0,3 s
//     BIOMANCY-TOKEN (`bio`): kein Kreis, keine Säule — Trailer „Token entsteht“: Ringe Lime 40 / Grün 30 / Creme 62 (gedithert), 20 Strahlen (Lime/Grün), Karte baut sich gedithert auf.
//  2. KRAFTSTROM-EREIGNISSE (`window.ppFx69Zone(payload, myIdx)` → true, wenn gespielt; aus `onZoneAnim` in app-board.jsx, VOR dem normalen Verteiler):
//       `biomancy_bloom` mit `kraftstrom: true` (Engine: `placeBiomancyToken`, _biomancy-shared.js): 16 Kugeln (0,02 s / 0,30 s; Lime, Grün, Creme) aus der Biomancy-Fähigkeitskarte (`quelle: 'ability'`)
//                         bzw. dem Helden (`quelle: 'hero'`, Kyli) in die Zone, kleine Funken beim Eintreffen. Die Blumen entfallen dann. Der Token landet 600 ms später (Engine) mit dem Token-Look oben.
//       `alchemy_kraftstrom` (Engine: alchemy.js, 600 ms vor dem Ziehen): die Fähigkeitskarte leuchtet 0,3 s (Punktringe R 32: 40 + 24 Punkte in 6 Trankfarben kreisen, Strahlenblitz, aufsteigende
//                         Funken, einströmende Punkte), 14 Kugeln (0,01 s / 0,22 s, Bogen nach oben) fließen ins Potion Deck, dort ab 0,2 s Ringe (Creme, Orange) + 10 Strahlen. Die Engine wartet `ALCHEMY_VORLAUF_MS` = 320 ms (vorher 600).
//  Rückfall (Animationen aus, Retro, `__ppFxAlt`, reduzierte Bewegung, `window.__ppFx69Aus`, keine Palette, Zone nicht messbar): false → alter Kreis (CSS) bzw. Blumen / nichts.
//  Handy (`ppIsPhone`): Teilchen 40 % (`ppFxN`), weniger Kugeln. Foil-Ebenen werden nicht berührt (die echte Karte samt Foil wird nur kurz ausgeblendet; gezeichnet wird das Kartenbild).
//  Messung (nur Tests): `window.__ppFx69Messen = true` → `window.__ppFx69Zeiten` = [Art, Bild, ms]; `window.__ppFx69Manuell = true` → kein Takt, Bild für Bild über `window.__ppFx69Lauf.zeichne(f)` / `.ende()`.
// ═════════════════════════════════════════════════════════════════
(function (root) {
  'use strict';
  const FX = {};
  const rd = Math.round, fl = Math.floor, mn = Math.min, mx = Math.max, PI = Math.PI;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeOutBack = (t, k = 1.9) => 1 + (k + 1) * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2);
  const TAKT = 1000 / 30;
  const fr = (s) => fl(s * 30 + 1e-4);
  FX.TAKT = TAKT;
  FX.ALCHEMY_VORLAUF_MS = 320;

  function H(a, b) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const BAYER8 = (() => {
    const b2 = [[0, 2], [3, 1]]; let m = b2;
    for (let n = 0; n < 2; n++) { const s = m.length, o = []; for (let y = 0; y < s * 2; y++) { o.push([]); for (let x = 0; x < s * 2; x++) o[y].push(4 * m[y % s][x % s] + b2[Math.floor(y / s)][Math.floor(x / s)]); } m = o; }
    return m;
  })();

  // ── Palette (Trailer-Farben, auf die 256 Farben gerastet) ──
  const memo = new Map();
  function snap(hex) {
    if (memo.has(hex)) return memo.get(hex);
    const h = hex.replace('#', ''), r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const p = typeof root.ppSnapRgb === 'function' ? root.ppSnapRgb(r, g, b) : [r, g, b];
    memo.set(hex, p); return p;
  }
  let C = null;
  function farben() {
    if (C) return C;
    C = { cream: snap('#fffbd2'), ink: snap('#12101f'), dark: snap('#08060c'), gold: snap('#f8ca21'), green: snap('#4ceb70'), dgreen: snap('#29663f'), lime: snap('#b1ff1a'),
      yel: snap('#ffe23d'), org: snap('#ff9a1a'), cyan: snap('#66d9ff'), pink: snap('#fe6794') };
    C.alc = [C.org, C.yel, snap('#4ceb70'), C.cyan, C.pink, C.cream];                   // Trankfarben (Alchemy)
    return C;
  }

  // ── Rastermaler für die Zellenleinwand: Schmutzrechteck, optionale Verdeckungsmaske (1 = von einer Karte verdeckt) ──
  function maler(buf, gw, gh) {
    const d = { x0: gw, y0: gh, x1: 0, y1: 0 };
    const o = { occ: null };
    const rect = (x, y, w, h, c) => {
      let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > gw) x1 = gw; if (y1 > gh) y1 = gh;
      if (x0 >= x1 || y0 >= y1) return;
      if (x0 < d.x0) d.x0 = x0; if (y0 < d.y0) d.y0 = y0; if (x1 > d.x1) d.x1 = x1; if (y1 > d.y1) d.y1 = y1;
      const r = c[0], g = c[1], b = c[2], occ = o.occ;
      for (let j = y0; j < y1; j++) {
        let i = (j * gw + x0) * 4;
        for (let q = x0; q < x1; q++, i += 4) { if (occ && occ[j * gw + q]) continue; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; }
      }
    };
    const linie = (x0, y0, x1, y1, th, c) => {
      const off = Math.floor(th / 2);
      x0 -= off; y0 -= off; x1 -= off; y1 -= off;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (let n = 0; n < 600; n++) {
        rect(x0, y0, th, th, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    };
    const ring = (cx, cy, r, th, c, dither) => {
      if (r < 1) return;
      let x = r, y = 0, err = 1 - r;
      while (x >= y) {
        if (!dither || ((cx + x + cy + y) & 1) === 0) { rect(cx + x, cy + y, th, th, c); rect(cx - x, cy - y, th, th, c); }
        if (!dither || ((cx + y + cy + x) & 1) === 0) { rect(cx + y, cy + x, th, th, c); rect(cx - y, cy - x, th, th, c); }
        if (!dither || ((cx - y + cy + x) & 1) === 0) { rect(cx - y, cy + x, th, th, c); rect(cx + y, cy - x, th, th, c); }
        if (!dither || ((cx - x + cy + y) & 1) === 0) { rect(cx - x, cy + y, th, th, c); rect(cx + x, cy - y, th, th, c); }
        y++;
        if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
      }
    };
    return { rect, linie, ring, d, o };
  }

  // ── Projektive Abbildung Einheitsquadrat → Viereck (TL, TR, BR, BL) und ihre Umkehrung ──
  function quadMap(q) {
    const [x0, y0] = q[0], [x1, y1] = q[1], [x2, y2] = q[2], [x3, y3] = q[3];
    const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    let a, b, c, d, e, f, g, h;
    if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) { a = x1 - x0; b = x3 - x0; c = x0; d = y1 - y0; e = y3 - y0; f = y0; g = 0; h = 0; }
    else {
      const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, den = dx1 * dy2 - dx2 * dy1 || 1e-9;
      g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den;
      a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0; d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
    }
    const A = e - f * h, B = c * h - b, Cc = b * f - c * e, D = f * g - d, E = a - c * g, F = c * d - a * f, G = d * h - e * g, Hh = b * g - a * h, I = a * e - b * d;
    return {
      f: (u, v) => { const w = g * u + h * v + 1; return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]; },
      inv: (x, y) => { const w = G * x + Hh * y + I; return w === 0 ? null : [(A * x + B * y + Cc) / w, (D * x + E * y + F) / w]; },
    };
  }

  /** Die vier Bildschirmpunkte (TL, TR, BR, BL) der Layoutbox mehrerer Elemente samt Brett-Perspektive: erst alle Marken setzen, dann alle lesen (ein Layout), dann alle entfernen. */
  function vierecke(els) {
    const marks = els.map((el) => {
      try {
        const w = el.offsetWidth, h = el.offsetHeight; if (!(w > 0 && h > 0)) return null;
        if (getComputedStyle(el).position === 'static') return null;
        const ms = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => { const m = document.createElement('i'); m.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;margin:0;padding:0;border:0;visibility:hidden;pointer-events:none`; el.appendChild(m); return m; });
        return { w, h, ms };
      } catch (e) { return null; }
    });
    const out = marks.map((mk) => {
      if (!mk) return null;
      const q = mk.ms.map((m) => { const r = m.getBoundingClientRect(); return [r.left, r.top]; });
      return q.every((p) => isFinite(p[0]) && isFinite(p[1])) ? { Q: q, w: mk.w, h: mk.h } : null;
    });
    for (const mk of marks) if (mk) for (const m of mk.ms) m.remove();
    return out;
  }
  const aabbQuad = (r) => [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]];

  // ── Leinwand-Hülle: Zellenleinwand (oder 1:1) mit Schmutzrechteck-Upload ──
  function leinwand(wurzel, gw, gh, S, lx, ly, occ) {
    const cv = document.createElement('canvas');
    cv.width = gw; cv.height = gh;
    cv.setAttribute('data-pp-px', 'aus');
    cv.style.cssText = `position:absolute;left:${lx}px;top:${ly}px;width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
    wurzel.appendChild(cv);
    const ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), m = maler(img.data, gw, gh);
    let vor = null;
    return {
      cv, ctx, img, m, gw, gh,
      anfang() { const d = m.d, buf = img.data; if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); } d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0; },
      ende() {
        const d = m.d, ux0 = mn(vor ? vor.x0 : gw, d.x0), uy0 = mn(vor ? vor.y0 : gh, d.y0), ux1 = mx(vor ? vor.x1 : 0, d.x1), uy1 = mx(vor ? vor.y1 : 0, d.y1);
        if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
        vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
      },
    };
  }

  /** Rückfall: Animationen aus, Retro, Test-Schalter, reduzierte Bewegung, keine Palette / Welt-Schicht. */
  function rueckfall() {
    try {
      if (root.__ppFx69Aus || root.__ppFxAlt || root._playAnimations === false || root.PP_RETRO || typeof root.ppSnapRgb !== 'function' || typeof root.ppFxWeltSchicht !== 'function') return true;
      if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    } catch (e) { /* weiter */ }
    return false;
  }
  FX.rueckfall = rueckfall;
  const phoneJa = () => { try { return !!(root.ppIsPhone && root.ppIsPhone()); } catch (e) { return false; } };
  const nFaktor = () => { try { return root.ppFxN ? root.ppFxN(100) / 100 : 1; } catch (e) { return 1; } };
  const fehl = (g) => { root.__ppFx69Grund = g; return false; };

  let AKTIV = 0;                       // gleichzeitig laufende Beschwörungen (ab 5: ohne Bodenscheibe und Kugeln)

  /** Takt: ruft `bild(f)` bei jedem neuen 30-Hz-Bild; `ende()` beendet. Manuell (Tests): keine Schleife, `window.__ppFx69Lauf`. */
  function takten(bild, aufraeumen, maxMs, huelle) {
    let raf = 0, letzte = -1, aus = false;
    const stopp = () => { if (aus) return; aus = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } try { aufraeumen(); } catch (e) { /* weg */ } };
    if (root.__ppFx69Manuell) {
      const lauf = { zeichne: (f) => { try { bild(f); } catch (e) { console.warn('[fx69]', e); } }, ende: stopp, start: performance.now(), el: huelle || null };
      root.__ppFx69Lauf = lauf; (root.__ppFx69Laeufe || (root.__ppFx69Laeufe = [])).push(lauf);
      return stopp;
    }
    const t0 = performance.now(), takt = root.ppTaktRaf || root.requestAnimationFrame;
    const schritt = (jetzt) => {
      if (aus) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const f = Math.max(0, fl((jetzt - t0) / TAKT + 1e-6));
      if (f !== letzte) {
        letzte = f;
        const m0 = root.__ppFx69Messen ? performance.now() : 0;
        let weiter = true;
        try { weiter = bild(f) !== false; } catch (e) { console.warn('[fx69]', e); weiter = false; }
        if (m0) (root.__ppFx69Zeiten || (root.__ppFx69Zeiten = [])).push(['bild', f, +(performance.now() - m0).toFixed(3)]);
        if (!weiter) { stopp(); return; }
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    setTimeout(stopp, maxMs);                           // Notnagel (Tab im Hintergrund: rAF ruht)
    return stopp;
  }

  /** Teilchen zeichnen (rein zeitabhängig): { t0, life, x, y, vx, vy, ax, ay, kind 0 Quadrat | 1 Kreuz | 2 Stern | 3 Funke (Wechsel), sz, c }. Ausklang: ab 72 % jedes zweite Bild aus. */
  function teilchenZeichnen(m, T, t) {
    for (let i = 0; i < T.length; i++) {
      const s = T[i], dt = t - s.t0; if (dt < 0 || dt >= s.life) continue;
      if (dt > s.life * 0.72 && fl(dt * 30 + 1e-4) % 2) continue;
      const x = rd(s.x + s.vx * dt + 0.5 * s.ax * dt * dt), y = rd(s.y + s.vy * dt + 0.5 * s.ay * dt * dt);
      let kind = s.kind; if (kind === 3) kind = fl(dt * 30 + 1e-4) % 4 < 2 ? 1 : 0;
      if (kind === 0) m.rect(x, y, s.sz, s.sz, s.c);
      else if (kind === 2) { m.rect(x - 2, y, 5, 1, s.c); m.rect(x, y - 2, 1, 5, s.c); m.rect(x - 1, y - 1, 3, 3, s.c); }
      else { m.rect(x - 1, y, 3, 1, s.c); m.rect(x, y - 1, 1, 3, s.c); }
    }
  }

  /** Kraftstrom-Kugeln (Trailer `ORB2_*`/`OB3_*`/`ALO_*`): n Kugeln, je `dauer` s, Abstand `gap`; von → nach als { x, y, sx, sy } (Mitte und Streuung in Zellen), seitlicher Bogen `bog` (Zellen) oder hoch (`hoch`). */
  function orbsPlanen(n, t0, gap, dauer, von, nach, salt, farbenListe, bog, hoch) {
    const O = [];
    for (let i = 0; i < n; i++) {
      const h = (k) => H(i + (salt % 97) * 31, k), side = i % 2 ? -1 : 1;
      const x0 = von.x + (h(11) - 0.5) * von.sx, y0 = von.y + (h(12) - 0.5) * von.sy, x1 = nach.x + (h(8) - 0.5) * nach.sx, y1 = nach.y + (h(9) - 0.5) * nach.sy;
      const cx = (x0 + x1) / 2 + (hoch ? side * (20 + h(13) * 40) * bog : side * (80 + h(13) * 130) * bog), cy = (y0 + y1) / 2 - (hoch ? (60 + h(14) * 60) * bog : 0);
      O.push({ t0: t0 + i * gap, dauer, x0, y0, x1, y1, cx, cy, a: farbenListe[i % farbenListe.length] });
    }
    return O;
  }
  const orbPos = (o, tt) => { const u = easeIO((tt - o.t0) / o.dauer); return [(1 - u) * (1 - u) * o.x0 + 2 * (1 - u) * u * o.cx + u * u * o.x1, (1 - u) * (1 - u) * o.y0 + 2 * (1 - u) * u * o.cy + u * u * o.y1]; };
  function orbsZeichnen(m, O, t, cream) {
    for (let i = 0; i < O.length; i++) {
      const o = O[i]; if (t < o.t0 || t >= o.t0 + o.dauer) continue;
      for (let mm = 6; mm >= 1; mm--) { const tt = t - mm / 30; if (tt < o.t0) continue; const [x, y] = orbPos(o, tt), q = mm < 3 ? 2 : 1; m.rect(rd(x), rd(y), q, q, mm % 2 ? cream : o.a); }
      const [x, y] = orbPos(o, t), X = rd(x), Y = rd(y);
      m.rect(X - 2, Y - 2, 5, 5, o.a); m.rect(X - 1, Y - 1, 3, 3, cream);
    }
  }
  /** Funken beim Eintreffen jeder Kugel (Trailer: 4 je Kugel, 0,22 s). */
  function orbFunken(T, O, farbenListe, salt, anzahl) {
    let id = 0;
    for (const o of O) for (let k = 0; k < anzahl; k++, id++) {
      const an = H(salt + id, 1) * PI * 2, sp = (80 + H(salt + id, 2) * 140) / 4.8 * 3;
      T.push({ t0: o.t0 + o.dauer, life: 0.22, x: o.x1, y: o.y1, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, ax: 0, ay: 0, kind: k % 2 ? 1 : 0, sz: 1, c: farbenListe[(id + k) % farbenListe.length] });
    }
  }

  // ───────────────────────── Zonen und Welt-Koordinaten ─────────────────────────
  const fo0 = () => (root.ppFxScrollOffset ? root.ppFxScrollOffset() : { dx: 0, dy: 0 });
  const heldEl = (zoneEl) => {
    try {
      const ow = zoneEl.getAttribute('data-support-owner') || zoneEl.getAttribute('data-ability-owner'), hi = zoneEl.getAttribute('data-support-hero') || zoneEl.getAttribute('data-ability-hero');
      return ow != null && hi != null ? document.querySelector(`[data-hero-zone][data-hero-owner="${ow}"][data-hero-idx="${hi}"]`) : null;
    } catch (e) { return null; }
  };
  const sichtbar = (r) => r && r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < root.innerHeight && r.left < root.innerWidth;

  // Biomancy-Token: das Kraftstrom-Ereignis merkt die Zone; die Landung (Beschwörung) liest es und zeigt den Token-Look statt des Kreises
  const BIO = new Map();
  const bioSchluessel = (own, hi, slot) => own + ':' + hi + ':' + slot;
  const bioHolen = (zoneEl) => {
    try {
      const k = bioSchluessel(zoneEl.getAttribute('data-support-owner'), zoneEl.getAttribute('data-support-hero'), zoneEl.getAttribute('data-support-slot')), t = BIO.get(k);
      if (t != null && performance.now() - t < 3000) { BIO.delete(k); return true; }
    } catch (e) { /* kein Token */ }
    return false;
  };

  // ═════════════════════════════════════════════════════════════════════════════════════
  //  1. BESCHWÖRUNG
  // ═════════════════════════════════════════════════════════════════════════════════════
  const MAXBACK = (() => { let m = 1; for (let i = 0; i <= 100; i++) m = mx(m, easeOutBack(i / 100, 1.4)); return m; })();
  const KARTE_BILDER = 7, SAEULE_BILDER = 15, ENDE_NACH = 0.85;

  /** Karte im Platz: das oberste `.board-card` mit Bild (Name wie am Platz); null, wenn keins da ist. */
  function karteImPlatz(zoneEl) {
    const ks = Array.from(zoneEl.querySelectorAll('.board-card'));
    for (let i = ks.length - 1; i >= 0; i--) { const im = ks[i].querySelector('img'); if (im && im.complete && im.naturalWidth > 0) return { karte: ks[i], img: im }; }
    return null;
  }
  const karteVerborgen = (k) => { try { const cs = getComputedStyle(k); return cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05; } catch (e) { return false; } };

  function beschwoerung(zoneEl, opt) {
    try {
      opt = opt || {};
      if (rueckfall()) return fehl('Rückfall (Animationen aus / Retro / reduzierte Bewegung / Schalter)');
      if (!zoneEl || !zoneEl.isConnected) return fehl('kein Element');
      const r0 = zoneEl.getBoundingClientRect();
      if (!sichtbar(r0)) return fehl('Zone nicht im Bild');
      const mess0 = root.__ppFx69Messen ? performance.now() : 0;
      const F = farben(), phone = phoneJa(), nF = nFaktor(), bio = opt.bio != null ? !!opt.bio : bioHolen(zoneEl);
      const salz = Math.floor(Math.random() * 1e6) % 9973;
      const kosten = AKTIV >= 5;                                                      // viele gleichzeitig: Bodenscheibe und Kugeln entfallen
      const fo = fo0();
      const S = root.ppFxZelle ? root.ppFxZelle(zoneEl) : 3;
      const heroEl = heldEl(zoneEl), hr = heroEl ? heroEl.getBoundingClientRect() : null;
      const heldDa = !!(hr && hr.width > 4 && hr.height > 4) && !kosten && !bio;

      // Nachbarn (belegte Zonen in der Nähe) verdecken den Kreis; die Zielkarte selbst erst, wenn sie fertig aufgebaut ist
      const nah = [];
      try {
        const rx0 = r0.left - 2.4 * r0.width, rx1 = r0.right + 2.4 * r0.width, ry0 = r0.top - 2 * r0.height, ry1 = r0.bottom + 2 * r0.height;
        document.querySelectorAll('[data-hero-zone],[data-support-zone],[data-ability-zone],[data-surprise-zone]').forEach((e) => {
          if (e === zoneEl || nah.length >= 14 || !e.querySelector('.board-card')) return;
          const q = e.getBoundingClientRect(); if (q.right < rx0 || q.left > rx1 || q.bottom < ry0 || q.top > ry1) return;
          nah.push(e);
        });
      } catch (e) { /* ohne Nachbarn */ }
      const vq = vierecke([zoneEl, ...nah]);
      const Zq = vq[0] || { Q: aabbQuad(r0), w: r0.width, h: r0.height };
      const toW = (Q) => Q.map((p) => [p[0] + fo.dx, p[1] + fo.dy]);
      const ZQ = toW(Zq.Q), zmap = quadMap(ZQ);
      const wL = Zq.w, hL = Zq.h;

      // Maße in Zellen: rc = Zonenhöhe / 35 Zellen (Trailer-Karte), rch = Höhe der Heldenzone
      const Hz = r0.height, rc = Hz / (35 * S), rch = hr ? hr.height / (35 * S) : rc;
      const p = mx(1, rd(1.9 * rc));                                                  // Quellpixel der Lichtsäule in Zellen
      const zx = r0.left + r0.width / 2 + fo.dx, zy = r0.top + r0.height / 2 + fo.dy, hx = hr ? hr.left + hr.width / 2 + fo.dx : zx, hy = hr ? hr.top + hr.height / 2 + fo.dy : zy;
      const zx0 = r0.left + fo.dx, zy0 = r0.top + fo.dy, zx1 = r0.right + fo.dx, zy1 = r0.bottom + fo.dy;
      const M = mx(40, Math.ceil(84 * mx(rc, heldDa ? rch : rc))), up = mx(M, bio ? 0 : 56 * p + 4);
      const minX = mn(zx, heldDa ? hx : zx) - M * S, maxX = mx(zx, heldDa ? hx : zx) + M * S;
      const minY = mn(zy, heldDa ? hy : zy) - up * S, maxY = mx(zy, heldDa ? hy : zy) + M * S;
      const lx = fl(minX / S) * S, ly = fl(minY / S) * S;
      const gw = mn(1100, Math.ceil((maxX - lx) / S)), gh = mn(900, Math.ceil((maxY - ly) / S));
      if (gw < 12 || gh < 12) return fehl('Leinwand zu klein');
      const c = (x, y) => [rd((x - lx) / S), rd((y - ly) / S)];
      const [CX, CY] = c(zx, zy), [HX, HFY] = c(hx, hy), [cx0, cy0] = c(zx0, zy0);
      const [cx1, cy1] = c(zx1, zy1);
      const th = (v, r) => mx(1, rd(v * r));
      const HRY = rd(HFY - 10 / 4.8 * rch), HCY = HFY - 50 / 4.8 * rch, zhh = (cy1 - cy0) / 2, zww = (cx1 - cx0) / 2;
      const base = rd(CY + 0.83 * zhh);
      const band = mx(1, rd(4 / 4.8 * rc));

      // ── Boden: Kreis in der Brettebene (Radius Rc in Layout-Pixeln), eigene Leinwand A unter der Karte ──
      const Rc = 1.05 * wL;
      let A = null;
      const RcZ = (Rc / wL) * (Math.hypot(ZQ[1][0] - ZQ[0][0], ZQ[1][1] - ZQ[0][1]) + Math.hypot(ZQ[2][0] - ZQ[3][0], ZQ[2][1] - ZQ[3][1])) / 2 / S;    // Radius in Zellen (Mittel)
      if (!bio && !kosten) {
        let ax0 = 1e9, ay0 = 1e9, ax1 = -1e9, ay1 = -1e9;
        for (let k = 0; k < 48; k++) {
          const a = k / 48 * PI * 2, pt = zmap.f(0.5 + Math.cos(a) * Rc * MAXBACK * 1.03 / wL, 0.5 + Math.sin(a) * Rc * MAXBACK * 1.03 / hL);
          ax0 = mn(ax0, pt[0]); ay0 = mn(ay0, pt[1]); ax1 = mx(ax1, pt[0]); ay1 = mx(ay1, pt[1]);
        }
        const alx = fl((ax0 - 8 * S) / S) * S, aly = fl((ay0 - 8 * S) / S) * S, agw = mn(700, Math.ceil((ax1 + 8 * S - alx) / S)), agh = mn(700, Math.ceil((ay1 + 8 * S - aly) / S));
        if (agw >= 8 && agh >= 8) A = { lx: alx, ly: aly, gw: agw, gh: agh };
      }
      let occN = null, occAlle = null, dist = null, aCx = 0, aCy = 0;
      if (A) {
        const n = A.gw * A.gh; dist = new Float32Array(n); occN = new Uint8Array(n); occAlle = new Uint8Array(n);
        const nq = [];
        for (let i = 1; i < vq.length; i++) if (vq[i]) { const Q = toW(vq[i].Q); nq.push({ m: quadMap(Q), x0: mn(Q[0][0], Q[1][0], Q[2][0], Q[3][0]), x1: mx(Q[0][0], Q[1][0], Q[2][0], Q[3][0]), y0: mn(Q[0][1], Q[1][1], Q[2][1], Q[3][1]), y1: mx(Q[0][1], Q[1][1], Q[2][1], Q[3][1]) }); }
        for (let j = 0; j < A.gh; j++) for (let i = 0; i < A.gw; i++) {
          const X = A.lx + (i + 0.5) * S, Y = A.ly + (j + 0.5) * S, id = j * A.gw + i;
          const uv = zmap.inv(X, Y);
          if (uv) { dist[id] = Math.hypot((uv[0] - 0.5) * wL, (uv[1] - 0.5) * hL) / Rc; if (uv[0] >= 0 && uv[0] < 1 && uv[1] >= 0 && uv[1] < 1) occAlle[id] = 1; } else dist[id] = 9;
          for (let k = 0; k < nq.length; k++) { const q = nq[k]; if (X < q.x0 || X > q.x1 || Y < q.y0 || Y > q.y1) continue; const w = q.m.inv(X, Y); if (w && w[0] >= 0 && w[0] < 1 && w[1] >= 0 && w[1] < 1) { occN[id] = 1; occAlle[id] = 1; break; } }
        }
        aCx = rd((zmap.f(0.5, 0.5)[0] - A.lx) / S); aCy = rd((zmap.f(0.5, 0.5)[1] - A.ly) / S);
      }
      const ptA = (fr2, a, rho) => {                                                  // Punkt auf dem Kreis (Anteil `fr2` von R, Winkel `a`) → Zelle der Leinwand A
        const q = zmap.f(0.5 + Math.cos(a) * fr2 * rho * Rc / wL, 0.5 + Math.sin(a) * fr2 * rho * Rc / hL);
        return [rd((q[0] - A.lx) / S), rd((q[1] - A.ly) / S)];
      };

      // ── Kraftstrom (Held → Zone) und „Held nimmt Kraft auf“ ──
      const kugeln = phone ? 12 : 20;
      const ORB = heldDa ? orbsPlanen(kugeln, 0.05, 0.02, 0.32, { x: HX, y: HCY, sx: 70 / 4.8 * rch, sy: 40 / 4.8 * rch }, { x: CX, y: CY, sx: zww * 2, sy: zhh * 1.2 }, salz, [F.green, F.gold, F.green], rc / 4.8) : [];
      // ── Teilchen ──
      const T = [], cols = [F.green, F.cream, F.gold, F.green, F.dgreen];
      let tid = 0;
      const R7 = (k) => H(salz + 7, tid * 13 + k);
      const splitter = (x, y, n, spMin, spSpan, t0, life0, lifeSpan, big) => {
        for (let k = 0; k < n; k++, tid++) {
          const an = R7(1) * PI * 2, sp = (spMin + R7(2) * spSpan) / 4.8 * rc, sz = big ? (R7(3) < 0.4 ? 2 : (R7(4) < 0.15 ? 3 : 1)) : (R7(3) < 0.4 ? 2 : 1);
          T.push({ t0, life: life0 + R7(5) * lifeSpan, x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, ax: -Math.cos(an) * sp * 1.4, ay: -Math.sin(an) * sp * 1.4, kind: R7(6) < 0.3 ? 1 : 0, sz, c: cols[fl(R7(7) * cols.length)] });
        }
      };
      let tL = null, fL = null;                                                       // Landezeit (s): erst beim Start bekannt, wenn ein Flug läuft
      const teilchenLandung = () => {
        splitter(CX, CY, ppN(bio ? 44 : 70), 160, 620, tL, 0.3, 0.5, true);
        for (let k = 0, n = ppN(bio ? 40 : 70); k < n; k++, tid++) T.push({ t0: tL + R7(1) * 0.3, life: 0.6 + R7(2) * 0.6, x: CX + (R7(3) - 0.5) * 140 / 4.8 * rc, y: CY + (R7(4) - 0.5) * 170 / 4.8 * rc, vx: (R7(5) - 0.5) * 50 / 4.8 * rc, vy: -(100 + R7(6) * 280) / 4.8 * rc, ax: 0, ay: 0, kind: 3, sz: 1, c: cols[fl(R7(7) * cols.length)] });
        for (let k = 0, n = ppN(10); k < n; k++, tid++) T.push({ t0: tL + R7(1) * 0.2, life: 0.35, x: CX + (R7(2) - 0.5) * 180 / 4.8 * rc, y: CY + (R7(3) - 0.5) * 220 / 4.8 * rc, vx: 0, vy: -30 / 4.8 * rc, ax: 0, ay: 0, kind: 2, sz: 1, c: k % 2 ? F.cream : F.green });
      };
      function ppN(n) { return mx(2, rd(n * nF)); }
      if (heldDa) orbFunken(T, ORB, [F.green, F.cream, F.gold], salz, phone ? 2 : 4);

      // ── Leinwände: Wurzel in der Welt-Schicht ──
      const wurzel = document.createElement('div');
      wurzel.setAttribute('aria-hidden', 'true'); wurzel.setAttribute('data-pp-px', 'aus'); wurzel.className = 'card-flight';
      wurzel.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:10125;';
      const La = A ? leinwand(wurzel, A.gw, A.gh, S, A.lx, A.ly) : null;
      let Lb = null;                                                                  // Karte (1:1), erst bei der Landung
      const Lc = leinwand(wurzel, gw, gh, S, lx, ly);
      const welt = root.ppFxWeltSchicht();
      welt.appendChild(wurzel);
      AKTIV++;

      // ── echte Karte: ausblenden, bis sie sich aufgebaut hat ──
      const ppHalte = (st) => { try { if (root.ppFxHalte) root.ppFxHalte(st, 'visibility'); } catch (e) { /* ohne */ } };
      const kp = karteImPlatz(zoneEl);
      const karte = kp ? kp.karte : null, kStil = karte ? karte.style : null;
      let karteHalt = false;
      const fliegt = !!document.querySelector('.hand-to-board-fly');
      let wartet = false;                                                              // Zonenkarte von einem Flug verborgen: warten, bis sie sichtbar wird
      if (karte) {
        if (karteVerborgen(karte)) wartet = true;
        else { ppHalte(kStil); karteHalt = true; kStil.visibility = 'hidden'; }
      }
      const startMs = performance.now();
      if (root.__ppFx69Messen) (root.__ppFx69Log || (root.__ppFx69Log = [])).push({ t: Math.round(startMs), owner: zoneEl.getAttribute('data-support-owner'), name: zoneEl.getAttribute('data-card-name'), fliegt, wartet, bio, kosten });
      if (!wartet) { tL = fliegt ? 0.5 : 0.15; fL = fr(tL); }
      const frei = () => { if (!karteHalt) return; karteHalt = false; try { if (root.ppFxLoese ? root.ppFxLoese(kStil, 'visibility') : true) kStil.visibility = ''; } catch (e) { /* weg */ } };
      const aufraeumen = () => { frei(); try { wurzel.remove(); } catch (e) { /* weg */ } AKTIV = mx(0, AKTIV - 1); };

      // Kartentextur (Bild auf Bildschirmgröße, geglättet wie die Karte auf dem Brett) und Viereck der Karte in Bildschirmpixeln der Welt-Schicht
      let tex = null, kb = null;
      const kartePrep = () => {
        if (tex || !kp) return;
        const w = mx(24, Math.ceil((Math.hypot(ZQ[1][0] - ZQ[0][0], ZQ[1][1] - ZQ[0][1]) + Math.hypot(ZQ[2][0] - ZQ[3][0], ZQ[2][1] - ZQ[3][1])) / 2)), h = mx(34, Math.ceil((Math.hypot(ZQ[3][0] - ZQ[0][0], ZQ[3][1] - ZQ[0][1]) + Math.hypot(ZQ[2][0] - ZQ[1][0], ZQ[2][1] - ZQ[1][1])) / 2));
        const tc = document.createElement('canvas'); tc.width = w; tc.height = h;
        const tg = tc.getContext('2d', { willReadFrequently: true }); tg.imageSmoothingEnabled = true; tg.drawImage(kp.img, 0, 0, kp.img.naturalWidth, kp.img.naturalHeight, 0, 0, w, h);
        tex = { d: tg.getImageData(0, 0, w, h).data, w, h };
        const bx0 = fl(mn(ZQ[0][0], ZQ[1][0], ZQ[2][0], ZQ[3][0])) - 1, by0 = fl(mn(ZQ[0][1], ZQ[1][1], ZQ[2][1], ZQ[3][1])) - 1, bx1 = Math.ceil(mx(ZQ[0][0], ZQ[1][0], ZQ[2][0], ZQ[3][0])) + 1, by1 = Math.ceil(mx(ZQ[0][1], ZQ[1][1], ZQ[2][1], ZQ[3][1])) + 1;
        kb = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 };
        Lb = leinwand(wurzel, kb.w, kb.h, 1, kb.x, kb.y);
        wurzel.insertBefore(Lb.cv, Lc.cv);                                            // Reihenfolge: Boden – Karte – Rest
      };
      const kartenBild = (k, lv) => {                                                // Karte baut sich gedithert auf: k = Bild seit Landung
        if (!Lb) return;
        Lb.anfang();
        const q = mn(16, rd(clamp((k + 1) / KARTE_BILDER) * 16)), thr = q / 16 * 64, buf = Lb.img.data, W = kb.w, td = tex.d, tw = tex.w, thh = tex.h;
        for (let y = 0; y < kb.h; y++) for (let x = 0; x < W; x++) {
          const sxw = kb.x + x + 0.5, syw = kb.y + y + 0.5, uv = zmap.inv(sxw, syw);
          if (!uv || uv[0] < 0 || uv[0] >= 1 || uv[1] < 0 || uv[1] >= 1) continue;
          const bay = BAYER8[fl((kb.y + y) / S) & 7][fl((kb.x + x) / S) & 7], i = (y * W + x) * 4;
          if (lv > 0 && bay / 64 < lv) { buf[i] = F.cream[0]; buf[i + 1] = F.cream[1]; buf[i + 2] = F.cream[2]; buf[i + 3] = 255; }
          else if (q >= 16 || bay < thr) { const ti = ((fl(uv[1] * thh)) * tw + fl(uv[0] * tw)) * 4; if (td[ti + 3] < 128) continue; buf[i] = td[ti]; buf[i + 1] = td[ti + 1]; buf[i + 2] = td[ti + 2]; buf[i + 3] = 255; }
        }
        const d = Lb.m.d; d.x0 = 0; d.y0 = 0; d.x1 = W; d.y1 = kb.h;
        Lb.ende();
      };

      // ── ein Bild ──
      const rahmen = (m, x0, y0, x1, y1, col) => { m.rect(x0, y0, x1 - x0 + 1, 1, col); m.rect(x0, y1, x1 - x0 + 1, 1, col); m.rect(x0, y0, 1, y1 - y0 + 1, col); m.rect(x1, y0, 1, y1 - y0 + 1, col); };
      const farbR = bio ? [F.lime, F.green, F.cream, F.green] : [F.cream, F.green, F.gold, F.green];
      const grossR = bio ? [40, 30, 62, 62] : [45, 34, 74, 58];                         // Radien in Zellen (Trailer: Token 40/30/62; Beschwörung 50/38/82/64, auf 0,9 gekürzt wie die Ringe der Fähigkeiten)
      let kartenFertig = false, schlussBild = null;
      const bild = (f) => {
        const t = f / 30;
        // Zonenkarte sichtbar geworden (Flug zu Ende)? → Landung jetzt
        if (wartet) {
          if (!karte || !karte.isConnected || !karteVerborgen(karte) || performance.now() - startMs > 1700) {
            wartet = false; tL = f / 30 + 0.02; fL = f + 1;
            if (karte && karte.isConnected && !karteHalt) { ppHalte(kStil); karteHalt = true; kStil.visibility = 'hidden'; }
          }
        }
        const gelandet = tL != null && f >= fL;
        const k = gelandet ? f - fL : -1;
        if (tL != null && !teilchenFertig) { teilchenLandung(); teilchenFertig = true; }
        if (!tex && (gelandet || f >= 1)) kartePrep();                               // Textur und Karten-Leinwand schon im ersten Bild nach dem Start (verteilt die Kosten, die Landung bleibt billig)

        // — Boden (Leinwand A) —
        if (La) {
          La.anfang();
          const mA = La.m, grow = easeOutBack(clamp(t / 0.5), 1.4);
          const tEnd = (tL != null ? tL : (t + 0.6)) + 0.45, shrink = t > tEnd ? 1 - easeIO(clamp((t - tEnd) / 0.3)) : 1, rho = grow * shrink;
          mA.o.occ = (gelandet && k >= KARTE_BILDER) ? occAlle : occN;
          if (rho * Rc > 3) {
            const rot = f;
            const bw = A.gw;
            for (let j = 0; j < A.gh; j++) for (let i = 0; i < bw; i++) {
              const d = dist[j * bw + i]; if (d > rho) continue;
              const bay = BAYER8[(j - aCy + 64) & 7][(i - aCx + 64) & 7];
              if (bay < 38) mA.rect(i, j, 1, 1, F.ink);
              else if (d * d <= 0.5 * rho * rho && bay < 52) mA.rect(i, j, 1, 1, F.dgreen);
            }
            const ringP = (fr2, thk, colf, skip) => {
              const n = mx(24, rd(fr2 * rho * RcZ * 2.4));
              for (let pass = 0; pass < 2; pass++) for (let q = 0; q < n; q++) {
                if (skip && skip(q)) continue;
                const [x, y] = ptA(fr2, q / n * PI * 2, rho);
                if (pass === 0) mA.rect(x - 1, y - 1, thk + 2, thk + 2, F.ink); else mA.rect(x, y, thk, thk, colf(q));
              }
            };
            ringP(1, 2, (q) => ((q + rot) % 8 < 2 ? F.cream : F.green), null);
            ringP(0.72, 1, (q) => (q % 2 ? F.gold : F.cream), (q) => (q - rot + 200) % 4 === 0);
            for (let q = 0; q < 24; q++) {                                           // Runenstriche
              if ((q + rot) % 2) continue;
              const a = q / 24 * PI * 2 + rot * 0.02, [x0, y0] = ptA(0.78, a, rho), [x1, y1] = ptA(0.94, a, rho);
              mA.linie(x0, y0, x1, y1, 3, F.ink); mA.linie(x0, y0, x1, y1, 1, F.cream);
            }
            const pv = (q) => ptA(0.7, -PI / 2 + rot * 0.04 + q * PI * 2 / 5, rho);   // Pentagramm
            for (const [col, thk, off] of [[F.ink, 4, -1], [F.green, 2, 0]]) for (let q = 0; q < 5; q++) { const [ax, ay] = pv(q), [bx, by] = pv((q + 2) % 5); mA.linie(ax + off, ay + off, bx + off, by + off, thk, col); }
            for (let q = 0; q < 5; q++) { const [ax, ay] = pv(q); mA.rect(ax - 3, ay - 3, 7, 7, F.ink); mA.rect(ax - 2, ay - 2, 5, 5, (q + rot) % 3 ? F.cream : F.gold); }
          }
          La.ende();
        }

        // — Karte baut sich auf (Leinwand B, 1:1) —
        if (gelandet && Lb && !kartenFertig) {
          if (k < KARTE_BILDER) kartenBild(k, k === 0 ? 0.7 : (k === 1 ? 0.45 : 0));
          else { kartenFertig = true; try { Lb.cv.remove(); } catch (e) { /* weg */ } Lb = null; frei(); }
        }

        // — Rest (Leinwand C) —
        const m = Lc.m; Lc.anfang();
        // Held nimmt Kraft auf: drei Ringe um die Füße
        if (heldDa) for (const [q0, col] of [[0, F.gold], [0.16, F.green], [0.32, F.cream]]) {
          const dt = t - q0; if (dt < 0 || dt > 0.45) continue;
          m.ring(HX, HRY, rd(easeOut(dt / 0.45) * 46 * rch * 0.7), th(2, rch), col, q0 > 0);
        }
        orbsZeichnen(m, ORB, t, F.cream);
        if (gelandet) {
          const dt = t - tL;
          // Lichtsäule (nur Beschwörung)
          if (!bio) {
            const kk = fl(k * 0.6);
            if (kk <= 8) {
              const Hh = kk < 3 ? 56 * (kk + 1) / 3 : 56, Ww = kk <= 3 ? 14 : mx(2, 14 - (kk - 3) * 2);
              for (let y = 0; y < 56; y++) {
                const yb = 55 - y; if (yb >= Hh) continue;
                const dens = 1 - (yb / Hh) * 0.85, bz = BAYER8[y & 7];
                for (let x = 0; x < 14; x++) {
                  if (Math.abs(x - 6.5) > Ww / 2 || bz[x & 7] / 64 >= dens) continue;
                  m.rect(CX - 7 * p + x * p, base - (56 - y) * p, p, p, Math.abs(x - 6.5) <= Ww * 0.25 ? F.cream : F.green);
                }
              }
            }
          }
          // harte Rahmenringe um die Karte (10 Bilder)
          if (k < 10) {
            const c0 = k % 2 ? F.cream : F.green, c2 = k % 2 ? F.green : F.cream, cs = [c0, F.gold, c2];
            for (let i = 0; i < 3; i++) for (let j = 1; j <= band; j++) { const d = i * band + j; rahmen(m, cx0 - d, cy0 - d, cx1 + d - 1, cy1 + d - 1, cs[i]); }
          }
          // Schockringe und Strahlen
          if (dt < 0.6) {
            const rr = (i, t0, dur, rad) => rd(easeOut((dt - t0) / dur) * rad * rc * 0.62);
            m.ring(CX, CY, rr(0, 0, 0.42, grossR[0]), dt < 0.12 ? th(3, rc) : th(1, rc), farbR[0], false);
            if (dt > 0.04) m.ring(CX, CY, rr(1, 0.04, 0.42, grossR[1]), th(2, rc), farbR[1], false);
            if (dt > 0.08) m.ring(CX, CY, rr(2, 0.08, 0.48, grossR[2]), th(2, rc), farbR[2], true);
            if (dt > 0.14 && !bio) m.ring(CX, CY, rr(3, 0.14, 0.45, grossR[3]), th(1, rc), farbR[3], true);
            if (bio && dt > 0.14) m.ring(CX, CY, rr(3, 0.14, 0.45, grossR[3] * 0.8), th(1, rc), farbR[1], true);
            const rayT = bio ? 0.18 : 0.2;
            if (dt < rayT) {
              const L = dt < rayT / 2 ? easeOut(dt / (rayT / 2)) : 1 - (dt - rayT / 2) / (rayT / 2), nr = bio ? 20 : 28;
              for (let r = 0; r < nr; r++) {
                const an = r * PI * 2 / nr + 0.05, len = L * (bio ? (r % 2 ? 34 : 62) : (r % 2 ? 48 : 92)) * rc * 0.55;
                m.linie(CX, CY, rd(CX + Math.cos(an) * len), rd(CY + Math.sin(an) * len * 0.9), th(r % 2 ? 1 : 2, rc), bio ? (r % 2 ? F.green : F.lime) : (r % 2 ? F.green : F.cream));
              }
            }
          }
        }
        teilchenZeichnen(m, T, t);
        Lc.ende();
        if (gelandet && f - fL > fr(ENDE_NACH)) return false;                       // fertig
        return true;
      };
      let teilchenFertig = false;
      const bildMess = (f) => bild(f);
      bild(0);                                                                       // Bild 0 sofort (die echte Karte ist schon verborgen, kein Doppelbild)
      if (mess0) (root.__ppFx69Zeiten || (root.__ppFx69Zeiten = [])).push(['start', -1, +(performance.now() - mess0).toFixed(3)]);
      const stopp = takten(bildMess, aufraeumen, 6000, wurzel);
      root.__ppFx69Grund = 'neu';
      return true;
    } catch (e) { try { console.warn('[fx69] Beschwoerung', e); } catch (e2) { /* still */ } return fehl('Fehler ' + (e && e.message)); }
  }
  root.ppFx69Beschwoerung = beschwoerung;
  /** Landet auf dieser Zone gerade ein Biomancy-Token (Kraftstrom-Ereignis hat sie gemerkt)? Dann spielt der Token-Look; sonst false. Der Belegungs-Vergleich kennt nur den Potion-Namen, darum der Umweg über die Marke. */
  root.ppFx69BioLandung = function (zoneEl) { try { return bioHolen(zoneEl) ? beschwoerung(zoneEl, { bio: true }) : false; } catch (e) { return false; } };

  // ═════════════════════════════════════════════════════════════════════════════════════
  //  2. KRAFTSTROM-EREIGNISSE (Biomancy-Token, Alchemy)
  // ═════════════════════════════════════════════════════════════════════════════════════
  /** Gemeinsamer Lauf für die Ereignisse: Leinwand um die Elemente, `malen(m, t)` je Bild, Ende nach `dauer` s. */
  function strom(els, dauer, malen, vorbereiten) {
    const fo = fo0(), S = root.ppFxZelle ? root.ppFxZelle(els[0]) : 3;
    const rs = els.map((e) => e.getBoundingClientRect());
    if (!rs.every((r) => r.width > 4 && r.height > 4)) return false;
    const rc = rs[0].height / (35 * S), rmax = mx(...rs.map((r) => r.height / (35 * S)));
    const M = mx(40, Math.ceil(70 * rmax)) * S;
    const lx = fl((mn(...rs.map((r) => r.left)) + fo.dx - M) / S) * S, ly = fl((mn(...rs.map((r) => r.top)) + fo.dy - M) / S) * S;
    const gw = mn(1100, Math.ceil((mx(...rs.map((r) => r.right)) + fo.dx + M - lx) / S)), gh = mn(900, Math.ceil((mx(...rs.map((r) => r.bottom)) + fo.dy + M - ly) / S));
    if (gw < 12 || gh < 12) return false;
    const cell = (r) => [(r.left + r.width / 2 + fo.dx - lx) / S, (r.top + r.height / 2 + fo.dy - ly) / S];
    const geo = { S, rc, rmax, cells: rs.map((r, i) => ({ x: cell(r)[0], y: cell(r)[1], w: r.width / S, h: r.height / S, rc: r.height / (35 * S), el: els[i] })) };
    const wurzel = document.createElement('div');
    wurzel.setAttribute('aria-hidden', 'true'); wurzel.setAttribute('data-pp-px', 'aus'); wurzel.className = 'card-flight';
    wurzel.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:10125;';
    const L = leinwand(wurzel, gw, gh, S, lx, ly);
    root.ppFxWeltSchicht().appendChild(wurzel);
    const plan = vorbereiten(geo);
    const bild = (f) => { L.anfang(); malen(L.m, f / 30, geo, plan); L.ende(); return f / 30 < dauer; };
    bild(0);
    takten(bild, () => { try { wurzel.remove(); } catch (e) { /* weg */ } }, dauer * 1000 + 3000, wurzel);
    return true;
  }

  function zoneBiomancy(p, myIdx) {
    const lbl = (o) => ownerLbl(o, myIdx);
    const ziel = document.querySelector(`[data-support-zone][data-support-owner="${lbl(p.owner)}"][data-support-hero="${p.heroIdx}"][data-support-slot="${p.zoneSlot}"]`);
    if (!ziel) return false;
    let quelle = null;
    if (p.quelle !== 'hero') {
      document.querySelectorAll(`[data-ability-zone][data-ability-owner="${lbl(p.owner)}"][data-ability-hero="${p.heroIdx}"]`).forEach((e) => { if (!quelle && e.getAttribute('data-card-name') === 'Biomancy') quelle = e; });
    }
    if (!quelle) quelle = document.querySelector(`[data-hero-zone][data-hero-owner="${lbl(p.owner)}"][data-hero-idx="${p.heroIdx}"]`);
    if (!quelle || !sichtbar(ziel.getBoundingClientRect())) return false;
    if (root.ppBattleCamFocus) root.ppBattleCamFocus(ziel);
    const F = farben(), salz = Math.floor(Math.random() * 1e6) % 9973, hero = quelle.hasAttribute('data-hero-zone');
    const ok = strom([quelle, ziel], 0.7 + 0.35, (m, t, geo, plan) => { orbsZeichnen(m, plan.O, t, F.cream); teilchenZeichnen(m, plan.T, t); }, (geo) => {
      const [a, b] = geo.cells, k = geo.rc / 4.8;
      const n = phoneJa() ? 9 : 16;
      const O = orbsPlanen(n, 0.0, 0.02, 0.30, { x: a.x, y: hero ? a.y - 50 / 4.8 * a.rc : a.y, sx: 60 * a.rc / 4.8, sy: hero ? 40 * a.rc / 4.8 : 60 * a.rc / 4.8 }, { x: b.x, y: b.y, sx: 100 * b.rc / 4.8, sy: 130 * b.rc / 4.8 }, salz, [F.green, F.lime, F.green], k);
      const T = []; orbFunken(T, O, [F.green, F.lime, F.cream], salz + 5, phoneJa() ? 2 : 4);
      return { O, T };
    });
    if (ok) BIO.set(bioSchluessel(lbl(p.owner), p.heroIdx, p.zoneSlot), performance.now());
    return ok;
  }

  function zoneAlchemy(p, myIdx) {
    const lbl = (o) => ownerLbl(o, myIdx), q = p.quelle || {};
    const sel = (q.zoneKind === 'support')
      ? `[data-support-zone][data-support-owner="${lbl(q.owner != null ? q.owner : p.owner)}"][data-support-hero="${q.heroIdx}"][data-support-slot="${q.zoneIdx}"]`
      : `[data-ability-zone][data-ability-owner="${lbl(q.owner != null ? q.owner : p.owner)}"][data-ability-hero="${q.heroIdx}"][data-ability-slot="${q.zoneIdx}"]`;
    const quelle = document.querySelector(sel), deck = document.querySelector(p.owner === myIdx ? '[data-my-potion-deck]' : '[data-opp-potion-deck]');
    if (!quelle || !deck) return false;
    if (!sichtbar(quelle.getBoundingClientRect())) return false;
    if (root.ppBattleCamFocus) root.ppBattleCamFocus(quelle);
    const F = farben(), salz = Math.floor(Math.random() * 1e6) % 9973, AL_DUR = 0.3, nF = nFaktor();
    return strom([quelle, deck], AL_DUR + 0.5, (m, t, geo, plan) => {
      const [a, b] = geo.cells, rot = fl(t * 30 + 1e-4), ac = F.alc;
      // Karte leuchtet: Punktringe in Trankfarben, Strahlenblitz
      if (t < AL_DUR + 0.1) {
        const R = rd((32 + 5 * Math.sin(t * 14)) * a.rc * 0.85), cx = rd(a.x), cy = rd(a.y);
        const n1 = mx(16, rd(40 * mn(1, a.rc * 0.85))), n2 = mx(10, rd(24 * mn(1, a.rc * 0.85)));
        for (let k = 0; k < n1; k++) { if ((k + rot) % 3 === 2) continue; const an = k / n1 * PI * 2; m.rect(rd(cx + Math.cos(an) * R), rd(cy + Math.sin(an) * R * 1.15), 2, 2, ac[(k + rot) % ac.length]); }
        for (let k = 0; k < n2; k++) { if ((k - rot + 48) % 4 === 0) continue; const an = k / n2 * PI * 2; m.rect(rd(cx + Math.cos(an) * R * 0.66), rd(cy + Math.sin(an) * R * 0.66 * 1.15), 1, 1, ac[(k + 2) % ac.length]); }
        if (t < 0.12) { const L = t < 0.06 ? easeOut(t / 0.06) : 1 - (t - 0.06) / 0.06; for (let r = 0; r < 14; r++) { const an = r * PI / 7 + 0.2, len = L * (r % 2 ? 26 : 48) * a.rc; m.linie(cx, cy, rd(cx + Math.cos(an) * len), rd(cy + Math.sin(an) * len * 0.9), r % 2 ? 2 : 3, r % 2 ? ac[r % ac.length] : F.cream); } }
      }
      orbsZeichnen(m, plan.O, t, F.cream);
      // Potion Deck: Ringe und Strahlen beim Eintreffen
      const dt = t - plan.tDeck;
      if (dt >= 0 && dt < 0.4) {
        const cx = rd(b.x), cy = rd(b.y);
        m.ring(cx, cy, rd(easeOut(dt / 0.34) * 30 * b.rc), dt < 0.1 ? mx(1, rd(2 * b.rc)) : mx(1, rd(b.rc)), F.cream, false);
        if (dt > 0.04) m.ring(cx, cy, rd(easeOut((dt - 0.04) / 0.34) * 20 * b.rc), mx(1, rd(b.rc)), F.org, false);
        if (dt < 0.12) { const L = dt < 0.06 ? easeOut(dt / 0.06) : 1 - (dt - 0.06) / 0.06; for (let r = 0; r < 10; r++) { const an = r * PI / 5 + 0.3, len = L * (r % 2 ? 18 : 32) * b.rc; m.linie(cx, cy, rd(cx + Math.cos(an) * len), rd(cy + Math.sin(an) * len * 0.9), r % 2 ? 1 : 2, r % 2 ? ac[r % ac.length] : F.cream); } }
      }
      teilchenZeichnen(m, plan.T, t);
    }, (geo) => {
      const [a, b] = geo.cells, T = [], ac = F.alc;
      const n = phoneJa() ? 8 : 14;
      const O = orbsPlanen(n, 0.0, 0.01, 0.22, { x: a.x, y: a.y, sx: 60 * a.rc / 4.8, sy: 70 * a.rc / 4.8 }, { x: b.x, y: b.y, sx: 60 * b.rc / 4.8, sy: 70 * b.rc / 4.8 }, salz, ac, mx(0.5, a.rc / 4.8), true);
      // aufsteigende Funken und einströmende Punkte am Kartenplatz
      const R = (i, k) => H(salz + i, k);
      for (let i = 0, N = mx(4, rd(42 * nF)); i < N; i++) T.push({ t0: i / N * AL_DUR, life: 0.3 + R(i, 1) * 0.3, x: a.x + (R(i, 2) - 0.5) * 100 / 4.8 * a.rc, y: a.y + (R(i, 3) - 0.5) * 130 / 4.8 * a.rc, vx: (R(i, 4) - 0.5) * 40 / 4.8 * a.rc, vy: -(70 + R(i, 5) * 200) / 4.8 * a.rc, ax: 0, ay: 0, kind: R(i, 6) < 0.3 ? 2 : 3, sz: 1, c: ac[fl(R(i, 7) * ac.length)] });
      for (let i = 0, N = mx(4, rd(36 * nF)); i < N; i++) { const an = R(i + 99, 1) * PI * 2, r = (70 + R(i + 99, 2) * 60) / 4.8 * a.rc, life = 0.34;
        T.push({ t0: R(i + 99, 3) * (AL_DUR - 0.12), life, x: a.x + Math.cos(an) * r, y: a.y + Math.sin(an) * r * 0.9, vx: -Math.cos(an) * r / life, vy: -Math.sin(an) * r * 0.9 / life, ax: 0, ay: 0, kind: 0, sz: R(i + 99, 4) < 0.3 ? 2 : 1, c: ac[fl(R(i + 99, 5) * ac.length)] }); }
      return { O, T, tDeck: 0.2 };
    });
  }

  /** Einstieg für `onZoneAnim`: true = das Ereignis ist erledigt (der Aufrufer macht nichts weiter). */
  root.ppFx69Zone = function (pl, myIdx) {
    try {
      if (!pl) return false;
      const art = pl.type === 'alchemy_kraftstrom' ? 'alchemy' : (pl.type === 'biomancy_bloom' && pl.kraftstrom === true ? 'bio' : null);
      if (!art) return false;
      // Biomancy aus dem Gelöscht-Stapel (`quelle: 'stapel'`, app-fx-70): kein Kraftstrom — der Kartenflug Stapel → Zone ist der Hauptakt; hier wird nur die Zone für den Token-Look der Landung gemerkt
      if (art === 'bio' && pl.quelle === 'stapel' && !rueckfall()) { BIO.set(bioSchluessel(ownerLbl(pl.owner, myIdx), pl.heroIdx, pl.zoneSlot), performance.now()); return true; }
      if (rueckfall()) return art === 'alchemy';                                      // Alchemy hat keinen alten Look: still weglassen; Biomancy → Blumen
      return (art === 'alchemy' ? zoneAlchemy(pl, myIdx) : zoneBiomancy(pl, myIdx)) || art === 'alchemy';
    } catch (e) { try { console.warn('[fx69] Zone', e); } catch (e2) { /* still */ } return pl && pl.type === 'alchemy_kraftstrom'; }
  };
  root.PpFx69 = FX;

  // Aufwärmen im Leerlauf: trockener Lauf der Zeichner auf einer Wegwerf-Leinwand (JIT)
  (function warm() {
    const los = () => {
      try {
        const gw = 220, gh = 200, buf = new Uint8ClampedArray(gw * gh * 4), m = maler(buf, gw, gh), F = farben();
        const O = orbsPlanen(14, 0, 0.02, 0.3, { x: 40, y: 150, sx: 20, sy: 10 }, { x: 160, y: 80, sx: 30, sy: 20 }, 3, [F.green, F.gold], 0.4);
        const T = [{ t0: 0, life: 0.5, x: 100, y: 100, vx: 30, vy: -40, ax: 0, ay: 0, kind: 3, sz: 1, c: F.green }];
        const ric = root.requestIdleCallback || ((fn) => setTimeout(fn, 60)), ts = [0.01, 0.1, 0.2, 0.35, 0.5];
        const weiter = () => { const t = ts.shift(); if (t == null) return; try { buf.fill(0); orbsZeichnen(m, O, t, F.cream); teilchenZeichnen(m, T, t); m.ring(100, 100, 30, 2, F.cream, true); m.linie(10, 10, 90, 60, 3, F.ink); } catch (e) { /* weg */ } ric(weiter, { timeout: 2500 }); };
        ric(weiter, { timeout: 2500 });
      } catch (e) { /* weg */ }
    };
    setTimeout(() => (root.requestIdleCallback ? root.requestIdleCallback(los, { timeout: 4000 }) : los()), 3500);
  })();
})(window);
