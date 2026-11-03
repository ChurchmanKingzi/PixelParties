// app-fx-30: Projektile/Feuerball im Trailer-Look
//
// ═════════════════════════════════════════════════════════════════
//  Feuerball (`play_projectile_animation` mit 🔥 oder 🐦‍🔥, ohne eigene Form/Klasse) — PIXELART, Trailer-Look.
//  Nutzer: Fireball, Pyraga, Victory Phoenix Cannon, der Standard-Rückfall für negierte Destruction-Zauber (`_standardZauberBilder`).
//  Vorher: ein gedrehtes Emoji mit weichem Schein (CSS-Animation, von pixel-anim.js gebacken); jetzt EINE Leinwand (Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s auf dem globalen Takt),
//  Maße wie in `ovFlameBall`/`fireSeq` des Trailer-Renderers (shot01.js), mit Faktor k auf die Kartengröße gerechnet:
//    0 – 0,20 s   Aufladen: Glut sammelt sich an der Quelle (Funken laufen auf die Mitte zu), der Ball wächst von Radius 3 auf 11 (· k)
//    0 – tA       Flug (tA = Landezeit, s. u.), langsam anfahrend (u^1,5); Kopf mit Feuerkern (rot · orange · gelb · creme), Flammenzungen nach hinten,
//                 ein Strom aus Flammenpartikeln, die aufsteigen und ausglühen (rein zeitabhängig, keine Zustände)
//    ab tA        Einschlag: creme/gelbe Ringe, orange (gedithert) und roter Ring, 24 Strahlen (0,3 s), 100 Funken (Quadrate/Kreuze), Brand aus Flammensäulen, Rauch
//  Landezeit tA: `landMs` (die Engine schickt die Wartezeit nach dem Abschuss mit, Fireball: 300 ms), sonst 0,85 · duration (wie die alte CSS-Fahrt). Der Server wartet unverändert.
//  Aufruf:  ppFx30Feuerball({ sx, sy, tx, ty, sw, sh, tw, th, sHeld, tHeld, dur, landMs, groesse, phoenix })  (Fensterkoordinaten; Welt-Hülle wie beim Kettenblitz)
//  Gibt eine Abbruchfunktion zurück (oder null: dann zeichnet der Aufrufer den alten Pfad). Farben: feste Palettenfarben, kein Alpha, kein Weichzeichner.
// ═════════════════════════════════════════════════════════════════
const PP_FX30_C = {
  creme: ppHex('#fffbd2'), gelb: ppHex('#ffe23d'), org: ppHex('#ff9a1a'), rot: ppHex('#fe5154'), dunkel: ppHex('#8b0d0d'),
  tinte: ppHex('#12101f'), rauch: ppHex('#3e3e51'), asche: ppHex('#59606e'), grau: ppHex('#9aa3b6'),
};
const PP_FX30_NACH = 1.25;                  // Länge des Ausklangs nach der Landung (s)

/** Ganzzahl-Hash → 0..1 (deterministisch, billig). */
function ppFx30H(a, b) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const ppFx30Ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const ppFx30Kl = (v, a, b) => Math.max(a, Math.min(b, v));

/** Rastermaler (RGBA-Puffer) mit Schmutzrechteck: gelöscht und hochgeladen wird nur, was das Bild davor und dieses berührt. */
function ppFx30Maler(buf, gw, gh) {
  const d = { x0: gw, y0: gh, x1: 0, y1: 0 };
  const rect = (x, y, w, h, c) => {
    let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > gw) x1 = gw; if (y1 > gh) y1 = gh;
    if (x0 >= x1 || y0 >= y1) return;
    if (x0 < d.x0) d.x0 = x0; if (y0 < d.y0) d.y0 = y0; if (x1 > d.x1) d.x1 = x1; if (y1 > d.y1) d.y1 = y1;
    const r = c[0], g = c[1], b = c[2];
    for (let j = y0; j < y1; j++) {
      let i = (j * gw + x0) * 4;
      for (let q = x0; q < x1; q++, i += 4) { buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; }
    }
  };
  /** Scheibe wie im Trailer (`disc`): Zeilenbreite sqrt(r² + 0,6 r − y²). */
  const disc = (X, Y, r, c) => {
    for (let yy = -r; yy <= r; yy++) { const xr = Math.round(Math.sqrt(Math.max(0, r * r + r * 0.6 - yy * yy))); rect(X - xr, Y + yy, 2 * xr + 1, 1, c); }
  };
  const linie = (x0, y0, x1, y1, th, c) => {
    const o = Math.floor(th / 2);
    x0 -= o; y0 -= o; x1 -= o; y1 -= o;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 500; n++) {
      rect(x0, y0, th, th, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  const ring = (cx, cy, r, th, c, dither) => {
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
  return { rect, disc, linie, ring, d };
}

/** Bildzahl seit 0 (Sekunden) im 30-Hz-Takt, gleitkomma-fest. */
const ppFx30Fl = (x) => Math.floor(x * 30 + 1e-4);

function ppFx30Feuerball(o) {
  try {
    if (!o || window._playAnimations === false) return null;
    if (!isFinite(o.sx) || !isFinite(o.sy) || !isFinite(o.tx) || !isFinite(o.ty)) return null;
    const S = 3, TAKT = 1000 / 30, C = PP_FX30_C, H = ppFx30H;
    const fo = (o.w === false || !window.ppFxScrollOffset) ? { dx: 0, dy: 0 } : window.ppFxScrollOffset();
    const welt = o.w !== false && !!window.ppFxWeltSchicht;
    const tw = o.tw > 0 ? o.tw : 64, thh = o.th > 0 ? o.th : 90, sw = o.sw > 0 ? o.sw : 64, shh = o.sh > 0 ? o.sh : 90;
    // Heldenzonen: Sprite oben, Karte unten — Anker rückt von der Zonenmitte 0,2 Zonenhöhe zur Brust hinauf (wie beim Kettenblitz)
    const ax = o.sx + fo.dx, ay = o.sy + fo.dy - (o.sHeld ? 0.2 * shh : 0), bx = o.tx + fo.dx, by = o.ty + fo.dy - (o.tHeld ? 0.2 * thh : 0);
    const k = Math.max(0.45, Math.min(1.5, (Math.min(tw, thh * 0.72) / S) / 40));
    const gr = ppFx30Kl(o.groesse > 0 ? o.groesse : 1, 0.7, 1.6);               // 1 = Fireball (Emoji 44 px); der Phönix-Schuss ist größer
    const dur = (o.dur > 0 ? o.dur : 600) / 1000;
    const tA = ppFx30Kl(o.landMs > 0 ? o.landMs / 1000 : 0.85 * dur, 0.16, 2.5);
    const ENDE = tA + PP_FX30_NACH, salt = Math.floor(Math.random() * 1e6);
    const M = Math.ceil(150 * k) * S;                                            // Rand für Ringe (bis 140 · k), Strahlen, Funken, Säulen
    const lx = Math.floor((Math.min(ax, bx) - M) / S) * S, ly = Math.floor((Math.min(ay, by) - M) / S) * S;
    const gw = Math.min(900, Math.ceil((Math.max(ax, bx) + M - lx) / S)), gh = Math.min(700, Math.ceil((Math.max(ay, by) + M - ly) / S));
    if (gw < 8 || gh < 8) return null;
    const AX = Math.round((ax - lx) / S), AY = Math.round((ay - ly) / S), BX = Math.round((bx - lx) / S), BY = Math.round((by - ly) / S);
    const dist = Math.hypot(BX - AX, BY - AY) || 1, fx = (BX - AX) / dist, fy = (BY - AY) / dist;   // Flugrichtung

    const wurzel = document.createElement('div');
    wurzel.setAttribute('aria-hidden', 'true');
    wurzel.setAttribute('data-pp-px', 'aus');
    wurzel.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;pointer-events:none;z-index:10130;`;
    const cv = document.createElement('canvas');
    cv.width = gw; cv.height = gh;
    cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
    wurzel.appendChild(cv);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(gw, gh);
    const m = ppFx30Maler(img.data, gw, gh);
    const rd = Math.round, RAMP = [C.creme, C.gelb, C.org, C.rot, C.dunkel], FL5 = [C.creme, C.gelb, C.org, C.rot];

    // ── Kopf: Weg (anfahrend), Radius (wächst im Aufladen), Bogen leicht nach oben ──
    const kb = Math.max(k, 0.65), R0 = 12 * kb * gr;
    const radius = (t) => Math.max(2, rd(3 * kb + (R0 - 3 * kb) * ppFx30Kl(t / 0.2, 0, 1)));
    const kopf = (t) => {
      const u = ppFx30Kl(t / tA, 0, 1), e = Math.pow(u, 1.5);
      return [AX + (BX - AX) * e, AY + (BY - AY) * e - 5 * kb * Math.sin(Math.PI * e)];
    };

    // ── der Feuerball (Portierung von ovFlameBall) ──
    const ball = (t) => {
      const tq = ppFx30Fl(t) / 30, f = ppFx30Fl(t) >> 1, RATE = 30;
      // Partikelstrom: je Bild 3 Flammenteilchen am Kopf, die aufsteigen und ausglühen; Alter bis 0,66 s
      for (let kk = Math.ceil(0.66 * RATE); kk >= 0; kk--) for (let j = 0; j < 3; j++) {
        const te = tq - kk / RATE; if (te < 0 || te > tA) continue;
        const id = Math.round(te * RATE) * 3 + j + salt % 977, age = t - te, life = 0.28 + 0.36 * H(id, 1), u = age / life; if (u >= 1) continue;
        const [hx, hy] = kopf(te), Rt = radius(te), a = H(id, 2) * Math.PI * 2, rr = Math.sqrt(H(id, 3)) * Rt * 0.8;
        const px = hx + Math.cos(a) * rr + Math.sin(age * 15 + id) * Rt * 0.32 * u, py = hy + Math.sin(a) * rr * 0.8 - (16 + 34 * H(id, 4)) * kb * age * (1 + u * 0.8);
        const rad = Math.max(1, rd(Rt * (0.1 + 0.2 * H(id, 5)) * (1 - u * 0.8))), v = u + (H(id, 6) - 0.5) * 0.22;
        m.disc(rd(px), rd(py), rad, v < 0.06 ? RAMP[0] : (v < 0.3 ? RAMP[1] : (v < 0.55 ? RAMP[2] : (v < 0.8 ? RAMP[3] : RAMP[4]))));
      }
      if (t > tA + 0.02) return;
      const [hx, hy] = kopf(t), [hx0, hy0] = kopf(Math.max(0, t - 0.05)), R = radius(t), X = rd(hx), Y = rd(hy);
      let ux = hx - hx0, uy = hy - hy0; const ul = Math.hypot(ux, uy); if (ul < 0.3) { ux = fx; uy = fy; } else { ux /= ul; uy /= ul; }   // im Stand: zum Ziel
      const zunge = (bx0, by0, dx, dy, len, w0, seed) => {
        const N = Math.max(2, rd(len));
        for (let s = 0; s < N; s++) {
          const v = s / N, w = Math.max(1, rd(w0 * Math.pow(1 - v, 0.8))), wob = Math.sin(s * 0.5 + f * 1.3 + seed) * R * 0.22 * v, x = rd(bx0 + dx * s - dy * wob), y = rd(by0 + dy * s + dx * wob);
          m.rect(x - w, y - w, 2 * w + 1, 2 * w + 1, v < 0.25 ? C.gelb : (v < 0.55 ? C.org : (v < 0.85 ? C.rot : C.dunkel)));
          if (v < 0.5 && w > 1) m.rect(x - (w >> 1), y - (w >> 1), w + 1, w + 1, v < 0.22 ? C.creme : C.gelb);
        }
      };
      for (let j = -3; j <= 3; j++) {                                          // Flammenzungen, rückwärts und aufwärts
        const ang = Math.atan2(-uy, -ux) + j * 0.32 + (H(j + 40, f) - 0.5) * 0.3, len = R * (1.7 + 1.8 * H(j + 50, f)) * (1 - Math.abs(j) * 0.13);
        zunge(X + Math.cos(ang) * R * 0.3, Y + Math.sin(ang) * R * 0.3, Math.cos(ang), Math.sin(ang) - 0.15, len, R * 0.42 * (1 - Math.abs(j) * 0.14), j * 3);
      }
      for (let q = 0; q < 7; q++) { const an = H(q, f) * Math.PI * 2, off = R * 0.4 * H(q + 9, f); m.disc(rd(X + Math.cos(an) * off), rd(Y + Math.sin(an) * off * 0.9), rd(R * (0.62 + 0.18 * H(q + 20, f))), q % 2 ? C.rot : C.dunkel); }
      for (const [col, fr, adv] of [[C.rot, 0.7, 0.0], [C.org, 0.58, 0.12], [C.gelb, 0.42, 0.2], [C.creme, 0.22, 0.27]]) {
        m.disc(rd(X + ux * R * adv + (H(rd(fr * 10), f) - 0.5) * R * 0.2), rd(Y + uy * R * adv + (H(rd(fr * 10) + 5, f) - 0.5) * R * 0.2), Math.max(1, rd(R * fr)), col);
      }
    };

    // ── Aufladen: Glut läuft an der Quelle auf die Mitte zu (3 Funken je Bild, 0,2 s) ──
    const laden = (t) => {
      if (t > 0.3) return;
      const w = ppFx30Fl(t);
      for (let q = 0; q < 14; q++) {
        const t0 = H(q + salt % 31, 3) * 0.16, life = 0.14; const d = t - t0; if (d < 0 || d >= life) continue;
        const an = H(q, 5 + salt % 13) * Math.PI * 2, r = (14 + H(q, 7) * 22) * k * (1 - d / life);
        const x = rd(AX + Math.cos(an) * r), y = rd(AY + Math.sin(an) * r * 0.85);
        m.rect(x, y, q % 3 ? 1 : 2, q % 3 ? 1 : 2, FL5[(q + w) % 4]);
      }
    };

    // ── Einschlag: Ringe, Strahlen, Funken, Brand, Rauch ──
    const fun = [], nF = ppFxN(100);
    for (let i = 0; i < nF; i++) { const an = H(salt + 11, i) * Math.PI * 2, sp = (70 + H(salt + 12, i) * 300) * k; fun.push({ vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.8, life: 0.3 + H(salt + 13, i) * 0.5, plus: H(salt + 14, i) < 0.3, sz: H(salt + 15, i) < 0.4 ? 2 : 1, c: FL5[Math.floor(H(salt + 16, i) * 4)] }); }
    const einschlag = (dt) => {
      const X = BX, Y = BY;
      if (dt < 0.9) {
        m.ring(X, Y, rd(ppFx30Ease(dt / 0.35) * 70 * k), dt < 0.12 ? Math.max(2, rd(5 * k)) : Math.max(1, rd(2 * k)), C.creme, false);
        if (dt > 0.04) m.ring(X, Y, rd(ppFx30Ease((dt - 0.04) / 0.45) * 54 * k), Math.max(1, rd(3 * k)), C.gelb, false);
        if (dt > 0.08) m.ring(X, Y, rd(ppFx30Ease((dt - 0.08) / 0.6) * 110 * k), Math.max(1, rd(3 * k)), C.org, true);
        if (dt > 0.18) m.ring(X, Y, rd(ppFx30Ease((dt - 0.18) / 0.65) * 140 * k), Math.max(1, rd(2 * k)), C.rot, true);
      }
      if (dt < 0.3) {
        const L = ppFx30Ease(Math.min(1, dt / 0.1)) * (1 - Math.max(0, (dt - 0.1) / 0.2));
        for (let r = 0; r < 24; r++) {
          const an = r * Math.PI / 12 + 0.1, len = L * (r % 2 ? 60 : 120) * k, ex = rd(X + Math.cos(an) * len), ey = rd(Y + Math.sin(an) * len);
          m.linie(X, Y, ex, ey, Math.max(2, rd(7 * k)), C.tinte);
          m.linie(X, Y, ex, ey, Math.max(1, rd(4 * k)), r % 3 === 0 ? C.creme : (r % 2 ? C.org : C.gelb));
        }
        m.disc(X, Y, Math.max(2, rd(14 * k * L)), C.creme);                    // Blitzkern im ersten Augenblick
      }
      // Funken (Quadrate/Kreuze mit Bremsung und Schwerkraft; im Ausklang jedes zweite Bild aus)
      for (let i = 0; i < fun.length; i++) {
        const q = fun[i];
        if (dt >= q.life || (dt > q.life * 0.7 && ppFx30Fl(dt) % 2)) continue;
        const br = 1 - 0.55 * (dt / q.life), x = rd(X + q.vx * dt * br), y = rd(Y + q.vy * dt * br + 140 * k * dt * dt);
        if (q.plus) { m.rect(x - 1, y, 3, 1, q.c); m.rect(x, y - 1, 1, 3, q.c); } else m.rect(x, y, q.sz, q.sz, q.c);
      }
      // Brand: sechs Flammensäulen aus harten Quadraten (Stufenleiter creme → rot), die gegen Ende auslodern
      if (dt > 0.05 && dt < 1.2) {
        const keep = dt < 0.5 ? 1 : Math.max(0, 1 - (dt - 0.5) / 0.7), w = ppFx30Fl(dt);
        for (let c = 0; c < 6; c++) for (let p = 0; p < 5; p++) {
          const id = c * 31 + p * 7 + (w >> 1) * 3 + salt % 101;
          if (H(id, 77) > keep) continue;
          const age = ((w + p * 2 + c) % 12) / 12, x = rd(X + (c - 2.5) * 11 * k + (H(id, 2) - 0.5) * 6 * k), y = rd(Y + 4 * k - age * (22 + H(id, 3) * 22) * k);
          const sz = Math.max(1, rd((2 + 2 * H(id, 4)) * k * (1 - age * 0.7)));
          m.rect(x - (sz >> 1), y - sz, sz, sz, age < 0.25 ? C.gelb : (age < 0.55 ? C.org : (age < 0.85 ? C.rot : C.dunkel)));
        }
      }
      // Rauch danach: graue Quadrate steigen langsam auf (Stufen Tinte → Rauch → Asche)
      if (dt > 0.3 && dt < 1.25) {
        const w = ppFx30Fl(dt) >> 1;
        for (let p = 0; p < 7; p++) {
          const id = p * 13 + w * 5 + salt % 53, age = ((dt - 0.3) * 1.1 + H(p, 8)) % 1, x = rd(X + (H(id, 1) - 0.5) * 40 * k), y = rd(Y - 6 * k - age * 30 * k);
          m.rect(x, y, Math.max(2, rd((3 + 2 * age) * k)), Math.max(2, rd((3 + 2 * age) * k)), age < 0.4 ? C.rauch : (age < 0.75 ? C.asche : C.grau));
        }
      }
    };

    const malen = (t) => {
      laden(t);
      if (t < tA + 0.66) ball(t);                                                // Partikelstrom glüht noch ~0,66 s nach der Landung aus
      if (t >= tA) einschlag(t - tA);
    };

    // Aufwärmen (`trocken`): nichts einhängen, nur die Bilder als einzelne Schritte zurückgeben — der Aufrufer führt sie im Leerlauf aus, damit der erste echte Schuss nicht im JIT-kalten Code startet.
    if (o.trocken) return [0.03, 0.1, 0.2, tA - 0.03, tA + 0.03, tA + 0.12, tA + 0.3, tA + 0.5, tA + 0.9].map((tt) => () => { m.d.x0 = gw; m.d.y0 = gh; m.d.x1 = 0; m.d.y1 = 0; img.data.fill(0); malen(tt); });
    (welt ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel);
    // ── Takt: 30 Bilder/s auf dem globalen Raster; Zeit in ganzen Bildern ──
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const t0 = performance.now();
    let raf = 0, letzte = -1, fertig = false, vor = null;
    const ende = () => { if (fertig) return; fertig = true; try { cancelAnimationFrame(raf); } catch {} wurzel.remove(); };
    const schritt = (jetzt) => {
      if (fertig) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = jetzt - t0;
      if (ms / 1000 >= ENDE) { ende(); return; }
      const fr = Math.floor(jetzt / TAKT);
      if (fr !== letzte) {
        letzte = fr;
        const d = m.d, buf = img.data;
        if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); }
        d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
        malen(Math.floor(Math.max(0, ms) / TAKT + 1e-6) / 30);
        // hochladen: Vereinigung aus dem Rechteck davor (löschen) und diesem (zeichnen)
        const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
        if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
        vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    setTimeout(ende, ENDE * 1000 + 1500);                                        // Notnagel (Tab im Hintergrund: rAF ruht)
    return ende;
  } catch (e) { try { console.warn('ppFx30Feuerball', e); } catch {} return null; }
}
window.ppFx30Feuerball = ppFx30Feuerball;
// Aufwärmen im Leerlauf (ein Bild je Leerlauf-Slot): Kosten der ersten Fahrt sinken auf das Niveau der folgenden
(function ppFx30Aufwaermen() {
  const los = () => {
    try {
      const schritte = ppFx30Feuerball({ sx: 100, sy: 300, tx: 300, ty: 100, tw: 70, th: 100, sw: 70, sh: 100, dur: 520, landMs: 300, trocken: true, w: false });
      if (!Array.isArray(schritte)) return;
      const ric = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      const weiter = () => { const f = schritte.shift(); if (!f) return; try { f(); } catch (e) {} ric(weiter, { timeout: 2500 }); };
      ric(weiter, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 4000 }) : los()), 2500);
})();

// ═════════════════════════════════════════════════════════════════
//  Sandstrahl (`play_projectile_animation` mit `projectileShape: 'sandStream'`) — PIXELART statt 314 einzeln CSS-animierter Elemente
//  Vorher: 280 Körner + 34 Schlieren als DOM-Elemente mit je eigener CSS-Animation (`sandStrahlFlug`, Alpha, Unschärfe-Kanal). `pixel-anim.js` backt jede startende Animation: Hauptfaden-Blockaden
//  von 50–500 ms beim Start (Messung 3.11.: Long Tasks 53–510 ms, größter Bildabstand bis 517 ms). Jetzt EINE Leinwand (Rasterpixel = 2 Bildschirmpixel, 30 Bilder/s auf dem globalen Takt),
//  gleiches Bild: Körner in vier Sandtönen fliegen einzeln von der Düse (eng) zum Ziel (gefächert), Schlieren entlang der Flugrichtung, ein blasser Staubkanal dazwischen (statt Unschärfe:
//  gedithertes Streupunktband). Zeiten wie die CSS-Fassung: Korn: Verzug 0 – 0,7 · Dauer, Flug 240–390 ms linear, Deckkraft 0 → 1 (10 %), 0,95 (85 %), → 0; Schlieren Flug 200–290 ms.
//  Deckkraft wird als Wahrscheinlichkeit gedithert (stabiler Hash je Teilchen), nicht als Alpha. Aufruf: ppFx30Sand({ sx, sy, tx, ty, dur }) (Fensterkoordinaten); gibt `null` zurück,
//  wenn nichts gezeichnet werden konnte (dann läuft der alte Pfad).
// ═════════════════════════════════════════════════════════════════
const PP_FX30_SAND = [ppHex('#f9ecb3'), ppHex('#e0c085'), ppHex('#ca874e'), ppHex('#9d612f')];
function ppFx30Sand(o) {
  try {
    if (!o || window._playAnimations === false) return null;
    if (!isFinite(o.sx) || !isFinite(o.sy) || !isFinite(o.tx) || !isFinite(o.ty)) return null;
    const S = 2, TAKT = 1000 / 30, H = ppFx30H, rd = Math.round;
    const fo = window.ppFxScrollOffset ? window.ppFxScrollOffset() : { dx: 0, dy: 0 };
    const welt = !!window.ppFxWeltSchicht;
    const ax = o.sx + fo.dx, ay = o.sy + fo.dy, bx = o.tx + fo.dx, by = o.ty + fo.dy;
    const dist = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / dist, uy = (by - ay) / dist, nx = -uy, ny = ux;
    const dauer = (o.dur > 0 ? o.dur : 950), strom = Math.round(dauer * 0.7);
    const ENDE = (strom + 400) / 1000 + 0.05;
    const nK = typeof ppFxN === 'function' ? ppFxN(280) : 280, nS = typeof ppFxN === 'function' ? ppFxN(34) : 34;
    const gauss = (id, q) => (H(id, q) + H(id, q + 1) + H(id, q + 2)) / 3 - 0.5;
    const M = 96;                                                               // Rand: Fächer (±32 px), Körner, Kanal
    const lx = Math.floor((Math.min(ax, bx) - M) / S) * S, ly = Math.floor((Math.min(ay, by) - M) / S) * S;
    const gw = Math.min(800, Math.ceil((Math.max(ax, bx) + M - lx) / S)), gh = Math.min(640, Math.ceil((Math.max(ay, by) + M - ly) / S));
    if (gw < 8 || gh < 8) return null;
    const P = (x, y) => [(x - lx) / S, (y - ly) / S];                           // Bildschirm → Raster
    // Teilchen einmal würfeln (deterministisch je Aufruf)
    const salt = Math.floor(Math.random() * 1e6);
    const kor = [], sch = [];
    for (let i = 0; i < nK; i++) {
      const id = i + salt * 7, start = gauss(id, 1) * 10, ende = gauss(id, 4) * 64;
      kor.push({ x: ax + nx * start + ux * H(id, 7) * 14, y: ay + ny * start + uy * H(id, 8) * 14, dx: (bx - ax) + nx * (ende - start), dy: (by - ay) + ny * (ende - start),
        g: Math.max(1, rd((1 + rd(H(id, 9) * 25) / 10) / S)), c: PP_FX30_SAND[Math.floor(H(id, 10) * 4)], verzug: Math.round(H(id, 11) * strom), flug: Math.round(240 + H(id, 12) * 150), id });
    }
    for (let i = 0; i < nS; i++) {
      const id = i + 5000 + salt * 3, start = gauss(id, 1) * 8, ende = gauss(id, 4) * 44;
      sch.push({ x: ax + nx * start, y: ay + ny * start, dx: (bx - ax) + nx * (ende - start), dy: (by - ay) + ny * (ende - start), l: 8 + H(id, 7) * 14, verzug: Math.round(H(id, 8) * strom), flug: Math.round(200 + H(id, 9) * 90), id });
    }
    const kanalN = 70, kanal = Array.from({ length: kanalN }, (_, i) => ({ p: H(i + salt, 21), q: (H(i + salt, 22) - 0.5) * 24, id: i + 900 }));
    const wurzel = document.createElement('div');
    wurzel.setAttribute('aria-hidden', 'true'); wurzel.setAttribute('data-pp-px', 'aus');
    wurzel.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;pointer-events:none;z-index:10090;`;
    const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh;
    cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
    wurzel.appendChild(cv);
    const ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), m = ppFx30Maler(img.data, gw, gh);
    // Deckkraft-Verlauf der Körner/Schlieren (Keyframes: 0 → 1 bei 10 %, 0,95 bei 85 %, → 0)
    const deck = (u) => (u <= 0 || u >= 1) ? 0 : (u < 0.1 ? u / 0.1 : (u < 0.85 ? 1 - 0.05 * ((u - 0.1) / 0.75) : 0.95 * (1 - (u - 0.85) / 0.15)));
    const malen = (t) => {
      const ms = t * 1000;
      // Staubkanal: gedithertes Streupunktband (Deckkraft 0 → 1 bei 15 %, 0,8 bei 70 %, → 0)
      const ku = ms / dauer, ka = ku <= 0 || ku >= 1 ? 0 : (ku < 0.15 ? ku / 0.15 : (ku < 0.7 ? 1 - 0.2 * ((ku - 0.15) / 0.55) : 0.8 * (1 - (ku - 0.7) / 0.3)));
      if (ka > 0.02) {
        const w = ppFx30Fl(t) >> 1;
        for (const k of kanal) {
          if (H(k.id + w * 13, 33) > ka * 0.55) continue;
          const [X, Y] = P(ax + ux * dist * k.p + nx * k.q, ay + uy * dist * k.p + ny * k.q);
          m.rect(rd(X), rd(Y), 1, 1, PP_FX30_SAND[1]);
        }
      }
      for (const k of sch) {
        const u = (ms - k.verzug) / k.flug, a = deck(u);
        if (a <= 0 || H(k.id, 5) > a) continue;
        const [X, Y] = P(k.x + k.dx * u, k.y + k.dy * u), [X0, Y0] = P(k.x + k.dx * u - ux * k.l, k.y + k.dy * u - uy * k.l);
        m.linie(rd(X0), rd(Y0), rd(X), rd(Y), 1, PP_FX30_SAND[0]);
      }
      for (const k of kor) {
        const u = (ms - k.verzug) / k.flug, a = deck(u);
        if (a <= 0 || H(k.id, 5) > a) continue;
        const [X, Y] = P(k.x + k.dx * u, k.y + k.dy * u);
        m.rect(rd(X), rd(Y), k.g, k.g, k.c);
      }
    };
    if (o.trocken) return [0.05, 0.2, 0.4, 0.7, 0.95].map((tt) => () => { m.d.x0 = gw; m.d.y0 = gh; m.d.x1 = 0; m.d.y1 = 0; img.data.fill(0); malen(tt); });
    (welt ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel);
    const takt = window.ppTaktRaf || window.requestAnimationFrame, t0 = performance.now();
    let raf = 0, letzte = -1, fertig = false, vor = null;
    const ende = () => { if (fertig) return; fertig = true; try { cancelAnimationFrame(raf); } catch {} wurzel.remove(); };
    const schritt = (jetzt) => {
      if (fertig) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = jetzt - t0;
      if (ms / 1000 >= ENDE) { ende(); return; }
      const fr = Math.floor(jetzt / TAKT);
      if (fr !== letzte) {
        letzte = fr;
        const d = m.d, buf = img.data;
        if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); }
        d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
        malen(Math.floor(Math.max(0, ms) / TAKT + 1e-6) / 30);
        const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
        if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
        vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    setTimeout(ende, ENDE * 1000 + 1500);
    return ende;
  } catch (e) { try { console.warn('ppFx30Sand', e); } catch {} return null; }
}
window.ppFx30Sand = ppFx30Sand;
