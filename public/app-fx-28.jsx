// app-fx-28: Kettenblitz-Canvas (Pixelart im Look des Trailers)
//
// ═════════════════════════════════════════════════════════════════
//  Kettenblitz (`qinglong_lightning`) — PIXELART, Trailer-Look. Chain Lightning, Cardinal Beast Qinglong, Bottled Lightning.
//
//  Der Server schickt je Sprung EIN Ereignis (`_kettenblitz-shared.js`: Ereignis, 400 ms warten, dann Schaden). Jeder Sprung ist hier eine eigenständige Instanz:
//  eine kleine Leinwand um die Strecke Quelle → Ziel (Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s auf dem globalen Takt, harte Kanten, keine Alpha-Überblendung),
//  die sich nach ~1,6 s selbst entfernt. Mehrere Sprünge laufen ohne Abstimmung nebeneinander (Sprung 2 startet, während Sprung 1 noch nachglüht).
//
//  Zeitplan je Sprung (t = Sekunden seit Start; Maße wie im Trailer-Renderer shot01.js, dort 480×270 Raster, hier mit Faktor k auf die Kartengröße gerechnet):
//    0 – 0,30   die Blitzspitze läuft von der Quelle zum Ziel (`min(1, t/0,30)`); der Blitz hat vier Schichten (dunkelblau, blau, hellblau, Kern creme), dazu eine
//               gestrichelte dunkle „Glimm“-Spur und bis zu 8 Abzweigungen; jeder Sprung hat seine eigene Zackenform, sie wechselt alle 2 Bilder (Flackern)
//    0,30–0,38  Blitz dick (7 · k), danach dünner (4 · k, bis 0,50), dann ganz dünn (2 · k) und im 2-Bilder-Takt blinkend, aus bei 0,64
//    0 – 0,5    Entladungsringe an der Quelle (nur beim ERSTEN Sprung): creme Ring, gelber Ring, Strahlenstern
//    ab 0,30    Einschlag am Ziel: creme + gelber Ring, hellblauer gedithert-gepunkteter Ring, 16 Strahlen (0,14 s); danach 0,12 – 1,0 s kleine hellblaue Bögen am Getroffenen
//    Funken     Splitter vom Einschlag (60), vom Blitz abgesprungene (24) und aufsteigende Glut (18); Quadrate und Kreuze in Creme/Gelb/Hellblau, Blinken im Ausklang
//
//  Besonderheit „Quelle = Ziel“ (Bottled Lightning hat keinen Wirker auf dem Brett: `start` fehlt, der erste Blitz beginnt am ersten Ziel selbst): der Blitz fällt dann von OBEN
//  auf das Ziel (Start über der Zielmitte, ohne Entladungsringe an der Quelle).
//
//  Aufruf:  ppFx28Kettenblitz({ sx, sy, tx, ty, step, tw, th, sw, sh, w })
//    sx, sy    Quelle (Mitte der Zone) und  tx, ty  Ziel — FENSTERkoordinaten (getBoundingClientRect), der Scrollstand des Feldes wird hier dazugerechnet
//              und die Leinwand in die Welt-Hülle (`ppFxWeltSchicht`, `.fx-welt-lock`) gehängt: sie bleibt auf ihren Zonen, auch wenn das Feld (Kamera, Finger) rollt
//    step      Nummer des Sprungs (0 = erster: Entladung an der Quelle; ändert auch die Zackenform)
//    tw, th    Breite/Höhe der Ziel-Zone in Bildschirmpixeln (bestimmt den Maßstab k; ohne Angabe 64 × 90);  sw, sh  dasselbe für die Quelle
//    tHeld, sHeld  true, wenn Ziel/Quelle eine HELDENzone ist (Sprite über Karte): der Anker rückt von der Zonenmitte um 0,2 Zonenhöhe zur Brust hinauf
//    w         false = Fenster- statt Weltkoordinaten (Standard true)
//  Gibt eine Funktion zurück, die den Effekt vorzeitig beendet (oder null, wenn Animationen aus sind). Ton: macht der Aufrufer (ein Geräusch je Sprung). Schadenszahlen: das Spiel selbst.
//  Farben: feste Palettenfarben (creme, gelb, hellblau, blau, dunkelblau). Kein Alpha, kein Weichzeichner.
// ═════════════════════════════════════════════════════════════════
const PP_FX28_C = { creme: ppHex('#fffbd2'), gelb: ppHex('#ffe23d'), hell: ppHex('#b3d8f9'), blau: ppHex('#4580f6'), dunkel: ppHex('#14285a') };
const PP_FX28_LT = 0.30;                  // Laufzeit der Spitze (s); der Server wartet danach noch 100 ms bis zum Schaden
const PP_FX28_ENDE = PP_FX28_LT + 1.3;    // Lebensdauer der Leinwand (s)

/** Ganzzahl-Hash → 0..1 (billig, deterministisch). */
function ppFx28H(a, b) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const ppFx28Ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/** Kleiner Rastermaler (RGBA-Puffer). Alles ganzzahlig, harte Kanten; `rect` füllt Rechtecke. */
function ppFx28Maler(buf, gw, gh) {
  const rect = (x, y, w, h, c) => {
    let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > gw) x1 = gw; if (y1 > gh) y1 = gh;
    for (let j = y0; j < y1; j++) {
      let i = (j * gw + x0) * 4;
      for (let q = x0; q < x1; q++, i += 4) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; }
    }
  };
  /** Pixelkette mit Quadratpinsel `th` (links oben versetzt um th/2, wie im Trailer). */
  const linie = (x0, y0, x1, y1, th, c) => {
    const o = Math.floor(th / 2);
    x0 -= o; y0 -= o; x1 -= o; y1 -= o;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 900; n++) {
      rect(x0, y0, th, th, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  /** Ring (Mittelpunktkreis), `th` = Strichstärke, `dither` = nur jedes zweite Pixel (Schachbrett). */
  const ring = (cx, cy, r, th, c, dither) => {
    let x = r, y = 0, err = 1 - r;
    while (x >= y) {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) {
        if (!dither || ((cx + a + cy + b) & 1) === 0) rect(cx + a, cy + b, th, th, c);
      }
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  };
  return { rect, linie, ring };
}

/** Bildzahl seit `t0` (Sekunden) im 30-Hz-Takt, gleitkomma-fest. */
const ppFx28Fl = (x) => Math.floor(x * 30 + 1e-4);

function ppFx28Kettenblitz(o) {
  try {
    if (!o || window._playAnimations === false) return null;
    const S = 3, TAKT = 1000 / 30, C = PP_FX28_C;
    const fo = (o.w === false || !window.ppFxScrollOffset) ? { dx: 0, dy: 0 } : window.ppFxScrollOffset();
    const welt = o.w !== false && !!window.ppFxWeltSchicht;
    if (!isFinite(o.tx) || !isFinite(o.ty)) return null;
    const tw = o.tw > 0 ? o.tw : 64, thh = o.th > 0 ? o.th : 90;
    // Heldenzonen enthalten Sprite (oben) und Karte (unten): die Mitte liegt an den Füßen des Sprites — der Blitz soll an die Brust (0,2 Zonenhöhe höher). Support-Zonen: Kartenmitte.
    const bx = o.tx + fo.dx, by = o.ty + fo.dy - (o.tHeld ? 0.2 * thh : 0);                // Ziel (Feldkoordinaten)
    // Maßstab: im Trailer ist eine Heldenkarte ~40 Rasterpixel breit; hier die Zielzone in Rasterpixeln. Kartenbreite bestimmt k (nicht die ggf. höhere Zone).
    const k = Math.max(0.45, Math.min(1.5, (Math.min(tw, thh * 0.72) / S) / 40));
    const step = o.step | 0, salt = Math.floor(Math.random() * 1e6);
    // Quelle: fehlt sie oder liegt sie auf dem Ziel (Bottled Lightning: erster Blitz am ersten Ziel), fällt der Blitz von oben herab.
    let ax = isFinite(o.sx) ? o.sx + fo.dx : bx, ay = isFinite(o.sy) ? o.sy + fo.dy - (o.sHeld ? 0.2 * (o.sh > 0 ? o.sh : 90) : 0) : by;
    const vonOben = Math.hypot(ax - bx, ay - by) < Math.max(24, 8 * k * S);
    if (vonOben) { ax = bx + (ppFx28H(salt, 3) - 0.5) * 40 * k * S; ay = by - Math.max(150, Math.min(300, thh * 2.2)); }
    const entlade = step === 0 && !vonOben && o.entlade !== false;
    // Leinwand: Umschlag der Strecke plus Rand für Ringe, Strahlen, Funken, Abzweigungen
    const M = Math.ceil(100 * k) * S;
    const lx = Math.floor((Math.min(ax, bx) - M) / S) * S, ly = Math.floor((Math.min(ay, by) - M) / S) * S;
    const gw = Math.min(900, Math.ceil((Math.max(ax, bx) + M - lx) / S)), gh = Math.min(700, Math.ceil((Math.max(ay, by) + M - ly) / S));
    if (gw < 4 || gh < 4) return null;
    const AX = Math.round((ax - lx) / S), AY = Math.round((ay - ly) / S), BX = Math.round((bx - lx) / S), BY = Math.round((by - ly) / S);

    // ── Funken (einmal gewürfelt): Splitter vom Einschlag, abgesprungene vom Blitz, aufsteigende Glut ──
    const cols = [C.gelb, C.creme, C.hell, C.gelb, C.creme], teile = [];
    const nA = ppFxN(60), nB = ppFxN(24), nC = ppFxN(18);
    for (let i = 0; i < nA; i++) { const an = ppFx28H(salt, 10 + i) * Math.PI * 2, sp = (50 + ppFx28H(salt, 200 + i) * 190) * k;
      teile.push({ t0: PP_FX28_LT, life: 0.3 + ppFx28H(salt, 400 + i) * 0.45, x: BX, y: BY, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, ay: 220 * k, plus: ppFx28H(salt, 600 + i) < 0.3, sz: ppFx28H(salt, 800 + i) < 0.4 ? 2 : 1, c: cols[Math.floor(ppFx28H(salt, 1000 + i) * cols.length)] }); }
    for (let i = 0; i < nB; i++) { const f = ppFx28H(salt, 1200 + i);
      teile.push({ t0: PP_FX28_LT + ppFx28H(salt, 1400 + i) * 0.2, life: 0.25 + ppFx28H(salt, 1600 + i) * 0.3, x: AX + (BX - AX) * f, y: AY + (BY - AY) * f, vx: (ppFx28H(salt, 1800 + i) - 0.5) * 60 * k, vy: (ppFx28H(salt, 2000 + i) - 0.5) * 60 * k, ay: 100 * k, plus: ppFx28H(salt, 2200 + i) < 0.3, sz: 1, c: cols[Math.floor(ppFx28H(salt, 2400 + i) * cols.length)] }); }
    for (let i = 0; i < nC; i++) {
      teile.push({ t0: PP_FX28_LT + 0.1 + ppFx28H(salt, 2600 + i) * 0.3, life: 0.5 + ppFx28H(salt, 2800 + i) * 0.4, x: BX + (ppFx28H(salt, 3000 + i) - 0.5) * 20 * k, y: BY + (10 + ppFx28H(salt, 3200 + i) * 10) * k, vx: (ppFx28H(salt, 3400 + i) - 0.5) * 14 * k, vy: -(14 + ppFx28H(salt, 3600 + i) * 34) * k, ay: 0, plus: true, sz: 1, c: cols[Math.floor(ppFx28H(salt, 3800 + i) * cols.length)] }); }

    // ── DOM: Wurzel mit Leinwand, in der Welt-Hülle ──
    const wurzel = document.createElement('div');
    wurzel.setAttribute('aria-hidden', 'true');
    wurzel.setAttribute('data-pp-px', 'aus');
    wurzel.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;pointer-events:none;z-index:10130;`;
    const cv = document.createElement('canvas');
    cv.width = gw; cv.height = gh;
    cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
    wurzel.appendChild(cv);
    (welt ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(gw, gh);
    const m = ppFx28Maler(img.data, gw, gh);

    const LT = PP_FX28_LT, rd = (v) => Math.round(v);
    const dick = Math.max(2, Math.round(7 * k)), amp = 14 * k, seg = Math.max(3, 6 * k), glimm = Math.max(4, Math.round(9 * k));

    // Blitz: gezackter Zug A → B mit Spitze `frac`; Schichten, Glimm-Spur, Abzweigungen (Seeds wie im Trailer: Sprung · 100 + Flackerbild)
    const blitz = (seed, th, frac) => {
      const dx = BX - AX, dy = BY - AY, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, n = Math.max(6, rd(len / seg));
      const pts = [[AX, AY]];
      for (let i = 1; i < n; i++) { const f = i / n, off = (ppFx28H(seed, i) - 0.5) * 2 * amp * Math.sqrt(Math.sin(Math.PI * f)); pts.push([rd(AX + dx * f + nx * off), rd(AY + dy * f + ny * off)]); }
      pts.push([BX, BY]);
      let spitze = pts.length - 1;
      if (frac < 1) { spitze = Math.max(1, Math.ceil(pts.length * frac) - 1); pts.length = spitze + 1; }
      const gt = th + glimm;                                       // Glimmen: gestrichelte, dicke Spur
      let cnt = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        let x0 = pts[i][0], y0 = pts[i][1]; const x1 = pts[i + 1][0], y1 = pts[i + 1][1], ddx = Math.abs(x1 - x0), ddy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = ddx + ddy;
        for (let q = 0; q < 300; q++) {
          if ((cnt++ & 3) < 2) m.rect(x0 - Math.floor(gt / 2), y0 - Math.floor(gt / 2), gt, gt, C.dunkel);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err; if (e2 >= ddy) { err += ddy; x0 += sx; } if (e2 <= ddx) { err += ddx; y0 += sy; }
        }
      }
      for (const [c, w] of [[C.dunkel, th + 4], [C.blau, th + 2], [C.hell, th], [C.creme, Math.max(1, th - 2)]]) {
        for (let i = 0; i < pts.length - 1; i++) m.linie(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c);
      }
      const ang0 = Math.atan2(dy, dx), nb = frac < 1 ? 5 : 8;
      for (let b = 0; b < nb; b++) {
        const idx = Math.floor(n * (0.1 + 0.8 * ppFx28H(seed, 50 + b)));
        if (idx > spitze) continue;                                // Abzweigungen nur hinter der Spitze
        const [px, py] = pts[Math.min(pts.length - 1, idx)], ang = ang0 + (ppFx28H(seed, 60 + b) < 0.5 ? -1 : 1) * (0.5 + ppFx28H(seed, 70 + b) * 0.7), bl = (16 + ppFx28H(seed, 80 + b) * 34) * k;
        let qx = px, qy = py;
        for (let j = 1; j <= 4; j++) {
          const a2 = ang + (ppFx28H(seed, 90 + b * 7 + j) - 0.5) * 0.9, x2 = rd(px + Math.cos(a2) * bl * j / 4), y2 = rd(py + Math.sin(a2) * bl * j / 4);
          m.linie(qx, qy, x2, y2, 2, C.blau); m.linie(qx, qy, x2, y2, 1, C.creme); qx = x2; qy = y2;
        }
      }
    };
    // Entladung / Einschlag: Ringe + Strahlenstern
    const strahlen = (X, Y, dt, rN, ringHell, drehung, rayT) => {
      m.ring(X, Y, rd(ppFx28Ease(dt / 0.4) * 40 * k * (ringHell ? 0.9 : 1)), dt < 0.1 ? Math.max(1, rd(3 * k)) : 1, C.creme, false);
      if (dt > 0.05 - (ringHell ? 0.01 : 0)) m.ring(X, Y, rd(ppFx28Ease((dt - 0.05) / 0.4) * 28 * k), Math.max(1, rd(2 * k)), C.gelb, false);
      if (ringHell && dt > 0.08) m.ring(X, Y, rd(ppFx28Ease((dt - 0.08) / 0.45) * 50 * k), Math.max(1, rd(2 * k)), C.hell, true);
      if (dt < rayT) {
        const L = dt < rayT / 2 ? ppFx28Ease(dt / (rayT / 2)) : 1 - (dt - rayT / 2) / (rayT / 2);
        for (let r = 0; r < rN; r++) {
          const an = r * Math.PI * 2 / rN + drehung, len = L * (r % 2 ? 34 : 60) * k;
          m.linie(X, Y, rd(X + Math.cos(an) * len), rd(Y + Math.sin(an) * len), Math.max(1, rd((r % 2 ? 2 : 3) * k)), r % 2 ? C.gelb : C.creme);
        }
      }
    };

    const malen = (t) => {
      // 1) Entladung an der Quelle (nur erster Sprung)
      if (entlade && t < 0.5) strahlen(AX, AY, t, 20, false, 0.2, 0.16);
      // 2) der Blitz
      if (t >= 0 && t <= LT + 0.34 && !(t > LT + 0.2 && ppFx28Fl(t) % 2)) {
        const th = t < LT + 0.08 ? dick : (t < LT + 0.2 ? Math.max(2, rd(4 * k)) : Math.max(1, rd(2 * k)));
        blitz(step * 100 + (salt % 7) * 1000 + Math.floor(ppFx28Fl(t) / 2), th, Math.min(1, t / LT));
      }
      // 3) Einschlag am Ziel
      const dh = t - LT;
      if (dh >= 0 && dh < 0.55) strahlen(BX, BY, dh, 16, true, step * 0.4, 0.14);
      // 4) Nachglühen: kleine Bögen am Getroffenen
      if (dh >= 0.12 && dh <= 1.0) {
        const w = Math.floor(ppFx28Fl(dh) / 2);
        for (let q = 0; q < 3; q++) {
          if (ppFx28H(step * 10 + q + salt, w + 400) > 0.7 - 0.5 * Math.min(1, (dh - 0.12) / 0.8)) continue;
          const a0 = ppFx28H(q + salt, w + 410) * Math.PI * 2, len = (8 + ppFx28H(q + salt, w + 420) * 14) * k, r0 = 8 * k;
          let qx = BX + Math.cos(a0) * r0, qy = BY + Math.sin(a0) * r0;
          for (let j = 1; j <= 3; j++) {
            const a2 = a0 + (ppFx28H(q + salt, w * 5 + j) - 0.5) * 1.2, x2 = rd(BX + Math.cos(a2) * (r0 + len * j / 3)), y2 = rd(BY + Math.sin(a2) * (r0 + len * j / 3));
            m.linie(rd(qx), rd(qy), x2, y2, 1, C.hell); qx = x2; qy = y2;
          }
        }
      }
      // 5) Funken (Blinken im Ausklang: ab 70 % der Lebensdauer jedes zweite Bild aus)
      for (const q of teile) {
        const d = t - q.t0;
        if (d < 0 || d >= q.life || (d > q.life * 0.7 && ppFx28Fl(d) % 2)) continue;
        const x = rd(q.x + q.vx * d), y = rd(q.y + q.vy * d + 0.5 * q.ay * d * d);
        if (q.plus) { m.rect(x - 1, y, 3, 1, q.c); m.rect(x, y - 1, 1, 3, q.c); } else m.rect(x, y, q.sz, q.sz, q.c);
      }
    };

    // ── Takt: 30 Bilder/s auf dem globalen Raster (wie ppR1Leinwand); Zeit in ganzen Bildern ──
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const t0 = performance.now();
    let raf = 0, letzte = -1, fertig = false;
    const ende = () => { if (fertig) return; fertig = true; try { cancelAnimationFrame(raf); } catch {} wurzel.remove(); };
    const schritt = (jetzt) => {
      if (fertig) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = jetzt - t0;
      if (ms / 1000 >= PP_FX28_ENDE) { ende(); return; }
      const fr = Math.floor(jetzt / TAKT);
      if (fr !== letzte) {
        letzte = fr;
        img.data.fill(0);
        malen(Math.floor(Math.max(0, ms) / TAKT + 1e-6) / 30);
        ctx.putImageData(img, 0, 0);
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    setTimeout(ende, PP_FX28_ENDE * 1000 + 1500);                  // Notnagel (Tab im Hintergrund: rAF ruht)
    return ende;
  } catch (e) { try { console.warn('ppFx28Kettenblitz', e); } catch {} return null; }
}
window.ppFx28Kettenblitz = ppFx28Kettenblitz;
