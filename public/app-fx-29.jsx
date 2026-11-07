// app-fx-29: Laser/Strahl (Alice-Laser, Broghan, Phatnir, Jiggles …) im Trailer-Look
//
// ═════════════════════════════════════════════════════════════════
//  Strahl (`play_beam_animation`) — PIXELART, Trailer-Look.
//
//  Vorher: SVG-Linie (dünn, ohne Kern) + ein einfarbiger runder Fleck und weiche Ringe am Ziel. Jetzt ein eigener Rastermaler (Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s auf dem
//  globalen Takt, harte Kanten, kein Alpha, kein Weichzeichner), Maße und Zeitplan wie im Trailer (shot01.js: `ovLaser`, Alices Laser auf Monia/Kyli, Broghans großer Laser):
//    0 – 0,10   Laden an der Quelle: wachsende Kugel aus ineinanderliegenden Quadraten (dunkel / Farbe / hell / Kern creme), gedithert-gepunkteter Ring, der sich zusammenzieht, Funken, die in die
//               Quelle gesogen werden
//    ab 0,04    Abschuss: Strahlenkranz (14 Strahlen, 0,16 s) und der Strahl läuft — die SPITZE wandert (Laufzeit 0,22 s), das hintere Ende bleibt an der Quelle. Strahl in vier Schichten:
//               dunkler Rand, Farbe (Farbe des Helden / der Karte), hell, Kern creme; darunter eine gestrichelte dunkle „Glimm“-Spur, die im 30-Hz-Takt entlangkriecht. Der Kopf hat einen
//               hellen Block und einen Funkenkranz (kleine Kreuze, wechseln alle 2 Bilder); entlang der Bahn springen Funken ab
//    0,26       Einschlag (Spitze am Ziel; der Server wartet danach 320 – 760 ms bis zum Schaden — die Zeit bleibt wie im alten Strahl): creme Ring (dick, dann dünn), Farbring, gedithert-
//               gepunkteter heller Ring, 16 Strahlen (0,14 s), Splitter und aufsteigende Glut; der Strahl steht noch, wird dünner (Dicke − 1 / − 2) und blinkt im 2-Bilder-Takt zum Ende hin
//    Der Heißpunkt am Einschlag (gedithertes Quadrat, flackernd) hält, solange der Strahl steht
//
//  Aufruf:  ppFx29Strahl({ ax, ay, bx, by, color, glow, dick, dauer, miss, wucht, tw, th, sw, sh, sHeld, tHeld })
//    ax, ay    Quelle und  bx, by  Ziel — FELD-(Welt-)Koordinaten (Fensterkoordinate + `ppFxScrollOffset()`, wie im Strahl-Handler); die Leinwand hängt in der Welt-Hülle (`.fx-welt-lock`)
//    color     CSS-Farbe des Strahls (#hex / rgb() / rgba()); Rand, Kern und Funken werden daraus abgeleitet und auf die Palette eingerastet. glow = Farbe des Rands (optional)
//    dick      `thickness` des Ereignisses (1 = Alice; 2,8 = Phatnir) · dauer = `duration` (ms) · miss = Strahl geht daneben (nur kleiner Aufprall) · wucht = `impactOpacity` (kleinere Einschläge)
//    tw, th, sw, sh  Zonengrößen (Bildschirmpixel; bestimmen den Maßstab)  ·  sHeld / tHeld: Quelle / Ziel ist eine HELDENzone (Sprite über Karte): Quelle rückt zum Gesicht hinauf, Ziel zur Brust
//    eigenerEinschlag = false: Einschlag NICHT zeichnen (der Aufrufer spielt eine eigene Einschlag-Animation, z. B. Disruption Ray)
//  Gibt eine Funktion zurück, die den Effekt vorzeitig beendet (oder null, wenn Animationen aus sind). Ton und Schadenszahlen: das Spiel selbst.
// ═════════════════════════════════════════════════════════════════
const PP_FX29_CREME = ppHex('#fffbd2'), PP_FX29_GELB = ppHex('#ffe23d');
const PP_FX29_T0 = 0.04;                    // Abschuss (s nach dem Ereignis)
const PP_FX29_LT = 0.22;                    // Laufzeit der Spitze; Einschlag bei T0 + LT = 0,26 s (der Server wartet nach dem Ereignis mindestens 320 ms bis zum Schaden)

function ppFx29H(a, b) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const ppFx29Ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const ppFx29Fl = (x) => Math.floor(x * 30 + 1e-4);

/** CSS-Farbe (#rgb, #rrggbb, rgb(), rgba()) → [r, g, b] oder null. */
function ppFx29Lies(css) {
  if (typeof css !== 'string') return null;
  const s = css.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = /^#([0-9a-f]{6})/i.exec(s);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (m) return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])];
  return null;
}
const ppFx29Mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
const ppFx29Rast = (c) => (window.ppSnapRgb ? window.ppSnapRgb(c[0], c[1], c[2]) : c.map(v => Math.round(v)));

/** Farbstufen eines Strahls aus seiner Farbe: dunkel (Rand/Glimmen), rand (Farbe), hell, kern (creme) + Funkenfarben. Maße wie im Trailer (rot: dunkelrot / rot / rosa / creme). */
function ppFx29Palette(color, glow) {
  const basis = ppFx29Lies(color) || [255, 34, 34];
  let rand = basis;
  if (Math.min(basis[0], basis[1], basis[2]) > 190) rand = ppFx29Mix(basis, [255, 214, 90], 0.5);     // fast weiß (Mondlicht): goldener Rand, sonst wäre der Strahl flach
  const tint = ppFx29Lies(glow) || rand;
  const dunkel = ppFx29Mix(tint, [10, 6, 16], 0.5);
  const hell = ppFx29Mix(rand, PP_FX29_CREME, 0.62);
  const kern = PP_FX29_CREME;
  const warm = rand[0] >= rand[1] && rand[0] >= rand[2];
  const R = ppFx29Rast(rand), K = kern;
  return { dunkel: ppFx29Rast(dunkel), rand: R, hell: ppFx29Rast(hell), kern: K, funken: warm ? [R, K, ppFx29Rast(hell), PP_FX29_GELB, R] : [R, K, ppFx29Rast(hell), R, K] };
}

/** Rastermaler auf einem RGBA-Puffer: Rechteck, Pixelkette mit Quadratpinsel, Ring (optional gedithert). Alles ganzzahlig, harte Kanten. */
function ppFx29Maler(buf, gw, gh) {
  const rect = (x, y, w, h, c) => {
    let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > gw) x1 = gw; if (y1 > gh) y1 = gh;
    for (let j = y0; j < y1; j++) {
      let i = (j * gw + x0) * 4;
      for (let q = x0; q < x1; q++, i += 4) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; }
    }
  };
  const linie = (x0, y0, x1, y1, th, c) => {
    const o = Math.floor(th / 2);
    x0 -= o; y0 -= o; x1 -= o; y1 -= o;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 1400; n++) {
      rect(x0, y0, th, th, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  /** Glimm-Spur: Pixelkette, aber nur Gruppen von 2 aus 4 Pixeln (gestrichelt); `ph` schiebt die Striche (kriechen im 30-Hz-Takt). */
  const gestrichelt = (x0, y0, x1, y1, th, c, ph) => {
    const o = Math.floor(th / 2);
    x0 -= o; y0 -= o; x1 -= o; y1 -= o;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, cnt = ph | 0;
    for (let n = 0; n < 1400; n++) {
      if ((cnt++ & 3) < 2) rect(x0, y0, th, th, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  const ring = (cx, cy, r, th, c, dither) => {                       // ohne Zwischenfelder (kein Muell pro Bild)
    let x = r, y = 0, err = 1 - r;
    const pkt = (a, b) => { if (!dither || ((cx + a + cy + b) & 1) === 0) rect(cx + a, cy + b, th, th, c); };
    while (x >= y) {
      pkt(x, y); pkt(y, x); pkt(-y, x); pkt(-x, y); pkt(-x, -y); pkt(-y, -x); pkt(y, -x); pkt(x, -y);
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  };
  return { rect, linie, gestrichelt, ring };
}

function ppFx29Strahl(o) {
  try {
    if (!o || window._playAnimations === false || window.__ppFxAlt) return null;
    const S = ppFxZelleFuer({ x: o.bx, y: o.by }), TAKT = 1000 / 30, T0 = PP_FX29_T0, LT = PP_FX29_LT, HIT = T0 + LT;
    if (![o.ax, o.ay, o.bx, o.by].every(isFinite)) return null;
    const welt = !!window.ppFxWeltSchicht;
    const tw = o.tw > 0 ? o.tw : 64, thh = o.th > 0 ? o.th : 90, sw = o.sw > 0 ? o.sw : 64, shh = o.sh > 0 ? o.sh : 90;
    // Maßstab: Zonenbreite in Rasterpixeln gegen die ~40 Rasterpixel breite Karte im Trailer
    const kz = Math.max(0.45, Math.min(1.5, (Math.min(tw, thh * 0.72) / S) / 40));
    const k = kz;
    const miss = !!o.miss;
    // Heldenzonen enthalten Sprite (oben) und Karte (unten), Mitte = Füße des Sprites: Quelle (Augen) 0,3 Zonenhöhe höher, Ziel (Brust) 0,2 höher
    const axw = o.ax, ayw = o.ay - (o.sHeld ? 0.3 * shh : 0);
    const bxw = o.bx, byw = o.by - (o.tHeld && !miss ? 0.2 * thh : 0);
    const wucht = typeof o.wucht === 'number' ? Math.max(0.3, Math.min(1, 0.55 + 0.45 * o.wucht)) : 1;   // Laser Volley dämpft die Einschläge (impactOpacity 0,4)
    const salt = Math.floor(Math.random() * 1e6);
    const pal = ppFx29Palette(o.color, o.glow);
    const th0 = Math.max(1, Math.round(3 * (o.dick > 0 ? o.dick : 1) * kz));          // Dicke der hellen Schicht (Trailer: Alice 3, dann 2, dann 1)
    const stay = Math.max(0.5, Math.min(0.9, (o.dauer > 0 ? o.dauer / 1000 : 1.5) - HIT - 0.35));   // so lange steht der Strahl nach dem Einschlag
    const LIFE = HIT + Math.max(stay, 1.0) + 0.1;
    // Leinwand: Umschlag von Quelle und Ziel plus Rand für Ringe, Strahlen, Funken
    const M = (Math.ceil(72 * k) + th0 * 2) * S;
    const lx = Math.floor((Math.min(axw, bxw) - M) / S) * S, ly = Math.floor((Math.min(ayw, byw) - M) / S) * S;
    const gw = Math.min(900, Math.ceil((Math.max(axw, bxw) + M - lx) / S)), gh = Math.min(700, Math.ceil((Math.max(ayw, byw) + M - ly) / S));
    if (gw < 4 || gh < 4) return null;
    const AX = Math.round((axw - lx) / S), AY = Math.round((ayw - ly) / S), BX = Math.round((bxw - lx) / S), BY = Math.round((byw - ly) / S);
    const dx = BX - AX, dy = BY - AY, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;

    // ── Funken (einmal gewürfelt) ──
    const cols = pal.funken, teile = [];
    const farbe = (i, n) => cols[Math.floor(ppFx29H(salt, n + i) * cols.length)];
    const nSog = ppFxN(18), nMund = ppFxN(16), nSplit = ppFxN(Math.round(54 * wucht)), nGlut = ppFxN(Math.round(14 * wucht));
    for (let i = 0; i < nSog; i++) { const an = ppFx29H(salt, 10 + i) * Math.PI * 2, r = (14 + ppFx29H(salt, 40 + i) * 18) * k, life = 0.12;       // Sog in die Quelle
      teile.push({ t0: ppFx29H(salt, 70 + i) * 0.06, life, x: AX + Math.cos(an) * r, y: AY + Math.sin(an) * r, vx: -Math.cos(an) * r / life, vy: -Math.sin(an) * r / life, ay: 0, plus: false, sz: ppFx29H(salt, 100 + i) < 0.3 ? 2 : 1, c: farbe(i, 130) }); }
    for (let i = 0; i < nMund; i++) { const an = ppFx29H(salt, 200 + i) * Math.PI * 2, sp = (50 + ppFx29H(salt, 230 + i) * 110) * k;                  // Mündungsfunken
      teile.push({ t0: T0, life: 0.2 + ppFx29H(salt, 260 + i) * 0.2, x: AX, y: AY, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, ay: 80 * k, plus: ppFx29H(salt, 290 + i) < 0.3, sz: 1, c: farbe(i, 320) }); }
    for (let f = 0; f * (1 / 30) < LT; f++) for (let j = 0; j < 2; j++) {                                                                    // Funken, die die Spitze abwirft
      const t = T0 + f / 30 + ppFx29H(salt, 400 + f * 2 + j) * 0.02, h = Math.min(1, (t - T0) / LT);
      teile.push({ t0: t, life: 0.2 + ppFx29H(salt, 500 + f * 2 + j) * 0.2, x: AX + dx * h + (ppFx29H(salt, 600 + f * 2 + j) - 0.5) * 8 * k, y: AY + dy * h + (ppFx29H(salt, 700 + f * 2 + j) - 0.5) * 8 * k,
        vx: (ppFx29H(salt, 800 + f * 2 + j) - 0.5) * 50 * k, vy: (ppFx29H(salt, 900 + f * 2 + j) - 0.5) * 50 * k, ay: 0, plus: false, sz: 1, c: farbe(f * 2 + j, 1000) }); }
    for (let f = 0; f < Math.floor(stay * 30); f++) {                                                                                         // Funken entlang des stehenden Strahls
      const t = HIT + f / 30, h = ppFx29H(salt, 1100 + f);
      teile.push({ t0: t, life: 0.2 + ppFx29H(salt, 1200 + f) * 0.2, x: AX + dx * h, y: AY + dy * h, vx: (ppFx29H(salt, 1300 + f) - 0.5) * 36 * k, vy: (ppFx29H(salt, 1400 + f) - 0.5) * 36 * k, ay: 0, plus: false, sz: 1, c: farbe(f, 1500) }); }
    for (let i = 0; i < nSplit; i++) { const an = ppFx29H(salt, 1600 + i) * Math.PI * 2, sp = (50 + ppFx29H(salt, 1700 + i) * 190) * k * (miss ? 0.6 : 1);   // Splitter vom Einschlag
      teile.push({ t0: HIT, life: 0.3 + ppFx29H(salt, 1800 + i) * 0.45, x: BX, y: BY, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, ay: 220 * k, plus: ppFx29H(salt, 1900 + i) < 0.3, sz: ppFx29H(salt, 2000 + i) < 0.4 ? 2 : 1, c: farbe(i, 2100) }); }
    for (let i = 0; i < nGlut; i++) {                                                                                                        // aufsteigende Glut
      teile.push({ t0: HIT + 0.08 + ppFx29H(salt, 2300 + i) * 0.3, life: 0.5 + ppFx29H(salt, 2400 + i) * 0.4, x: BX + (ppFx29H(salt, 2500 + i) - 0.5) * 16 * k, y: BY + (4 + ppFx29H(salt, 2600 + i) * 8) * k, vx: (ppFx29H(salt, 2700 + i) - 0.5) * 12 * k, vy: -(14 + ppFx29H(salt, 2800 + i) * 30) * k, ay: 0, plus: true, sz: 1, c: farbe(i, 2900) }); }

    // ── DOM: Wurzel mit Leinwand, in der Welt-Hülle (beim Aufwärmen `trocken`: nur ein Puffer, nichts im DOM) ──
    let wurzel = null, cv = null, ctx = null, img;
    if (o.trocken) img = { data: new Uint8ClampedArray(gw * gh * 4) };
    else {
      wurzel = document.createElement('div');
      wurzel.setAttribute('aria-hidden', 'true');
      wurzel.setAttribute('data-pp-px', 'aus');
      wurzel.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;pointer-events:none;z-index:10130;`;
      cv = document.createElement('canvas');
      cv.width = gw; cv.height = gh;
      cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
      wurzel.appendChild(cv);
      (welt ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel);
      ctx = cv.getContext('2d');
      img = ctx.createImageData(gw, gh);
    }
    const m = ppFx29Maler(img.data, gw, gh), rd = Math.round;
    const C = pal;

    // Kugel aus ineinanderliegenden Quadraten (wie im Trailer: „Alice lädt auf“)
    const kugel = (X, Y, r) => {
      m.rect(X - r - 1, Y - r - 1, 2 * r + 3, 2 * r + 3, C.dunkel);
      m.rect(X - r, Y - r, 2 * r + 1, 2 * r + 1, C.rand);
      m.rect(X - (r >> 1) - 1, Y - (r >> 1) - 1, r + 3, r + 3, C.hell);
      m.rect(X - (r >> 2), Y - (r >> 2), (r >> 1) + 1, (r >> 1) + 1, C.kern);
    };
    // Einschlag- bzw. Mündungsringe + Strahlenstern (Maße des Trailers, mit k skaliert)
    const stern = (X, Y, dt, rN, ringe, drehung, rayT, mass) => {
      if (ringe) {
        m.ring(X, Y, rd(ppFx29Ease(dt / 0.4) * 40 * k * mass), dt < 0.1 ? Math.max(1, rd(3 * k)) : 1, C.kern, false);
        if (dt > 0.04) m.ring(X, Y, rd(ppFx29Ease((dt - 0.04) / 0.4) * 28 * k * mass), Math.max(1, rd(2 * k)), C.rand, false);
        if (dt > 0.08 && mass > 0.7) m.ring(X, Y, rd(ppFx29Ease((dt - 0.08) / 0.5) * 52 * k * mass), Math.max(1, rd(2 * k)), C.hell, true);
      }
      if (dt < rayT) {
        const L = dt < rayT / 2 ? ppFx29Ease(dt / (rayT / 2)) : 1 - (dt - rayT / 2) / (rayT / 2);
        for (let r = 0; r < rN; r++) {
          const an = r * Math.PI * 2 / rN + drehung, ln = L * (r % 2 ? 34 : 60) * k * mass;
          m.linie(X, Y, rd(X + Math.cos(an) * ln), rd(Y + Math.sin(an) * ln), Math.max(1, rd((r % 2 ? 2 : 3) * k * (mass > 0.7 ? 1 : 0.7))), r % 2 ? C.rand : C.kern);
        }
      }
    };

    const malen = (t) => {
      const fr = ppFx29Fl(t);
      // 1) Laden an der Quelle: wachsende Kugel, sich zusammenziehender gepunkteter Ring
      if (t < T0 + 0.08) {
        const u = Math.min(1, t / (T0 + 0.04)), r = Math.max(1, rd((1 + u * 4) * k));
        kugel(AX, AY, r);
        m.ring(AX, AY, rd((10 + 14 * (1 - u)) * k), 1, C.hell, true);
      }
      // 2) Strahl: Spitze läuft, hinteres Ende bleibt; nach dem Einschlag dünner und zum Ende blinkend
      if (t >= T0 && t < HIT + stay) {
        const u = (t - HIT) / stay, laeuft = t < HIT;
        const th = laeuft || u < 0.25 ? th0 : (u < 0.5 ? Math.max(1, th0 - 1) : Math.max(1, th0 - 2));
        if (!(u > 0.75 && fr % 2)) {
          const h = Math.min(1, (t - T0) / LT), HX = rd(AX + dx * h), HY = rd(AY + dy * h);
          const gt = th + 5;
          m.gestrichelt(AX, AY, HX, HY, gt, C.dunkel, fr);                                         // Glimm-Spur
          m.linie(AX, AY, HX, HY, th + 4, C.dunkel);
          m.linie(AX, AY, HX, HY, th + 2, C.rand);
          m.linie(AX, AY, HX, HY, th, C.hell);
          m.linie(AX, AY, HX, HY, Math.max(1, th - 2), C.kern);
          if (laeuft) {                                                                            // Kopf: heller Block + Funkenkranz
            const hb = th + 3;
            m.rect(HX - (hb >> 1) - 1, HY - (hb >> 1) - 1, hb + 2, hb + 2, C.rand);
            m.rect(HX - (hb >> 1), HY - (hb >> 1), hb, hb, C.kern);
            const w = fr >> 1;
            for (let q = 0; q < 6; q++) {
              const an = ppFx29H(salt + q, w) * Math.PI * 2, ra = (th + 3 + ppFx29H(salt + q, w + 50) * 7) * 1, px = rd(HX + Math.cos(an) * ra), py = rd(HY + Math.sin(an) * ra), cc = cols[q % cols.length];
              m.rect(px - 1, py, 3, 1, cc); m.rect(px, py - 1, 1, 3, cc);
            }
          }
        }
      }
      // 3) Abschuss: Strahlenkranz an der Quelle (14 Strahlen, 0,16 s)
      if (t >= T0 && t < T0 + 0.16) stern(AX, AY, t - T0, 14, false, 0.1, 0.16, 0.5);
      // 4) Einschlag: Ringe + Strahlen; Heißpunkt, solange der Strahl steht
      const dh = t - HIT;
      if (dh >= 0) {
        if (dh < 0.55 && o.eigenerEinschlag !== false) stern(BX, BY, dh, 16, !miss, 0.2, 0.14, miss ? 0.5 : wucht);
        if (dh < stay && !(dh / stay > 0.75 && fr % 2) && !miss) {
          const r = Math.max(2, th0 + 1 + (fr % 4 < 2 ? 1 : 0));
          for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
            if (Math.abs(xx) + Math.abs(yy) > r + 1) continue;
            if (((xx + yy + fr) & 1) === 0) m.rect(BX + xx, BY + yy, 1, 1, Math.abs(xx) + Math.abs(yy) <= (r >> 1) ? C.kern : C.hell);
          }
        }
      }
      // 5) Funken (Blinken im Ausklang: ab 70 % der Lebensdauer jedes zweite Bild aus)
      for (const q of teile) {
        const d = t - q.t0;
        if (d < 0 || d >= q.life || (d > q.life * 0.7 && fr % 2)) continue;
        const x = rd(q.x + q.vx * d), y = rd(q.y + q.vy * d + 0.5 * q.ay * d * d);
        if (q.plus) { m.rect(x - 1, y, 3, 1, q.c); m.rect(x, y - 1, 1, 3, q.c); } else m.rect(x, y, q.sz, q.sz, q.c);
      }
    };

    if (o.trocken) { for (let f = 0; f <= (o.trocken | 0); f++) { img.data.fill(0); malen(f / 30); } return null; }   // Aufwärmen: den Maler einmal durchlaufen lassen (JIT), nichts zeichnen

    // ── Takt: 30 Bilder/s auf dem globalen Raster (wie ppR1Leinwand); Zeit in ganzen Bildern ──
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const t0 = performance.now();
    let raf = 0, letzte = -1, fertig = false;
    const ende = () => { if (fertig) return; fertig = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } wurzel.remove(); };
    const ppFx29Schritt = (jetzt) => {
      if (fertig) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = jetzt - t0;
      if (ms / 1000 >= LIFE) { ende(); return; }
      const f = Math.floor(jetzt / TAKT);
      if (f !== letzte) {
        letzte = f;
        img.data.fill(0);
        malen(Math.floor(Math.max(0, ms) / TAKT + 1e-6) / 30);
        ctx.putImageData(img, 0, 0);
      }
      raf = takt(ppFx29Schritt);
    };
    raf = takt(ppFx29Schritt);
    setTimeout(ende, LIFE * 1000 + 1500);                  // Notnagel (Tab im Hintergrund: rAF ruht)
    return ende;
  } catch (e) { try { console.warn('ppFx29Strahl', e); } catch (e2) { /* weg */ } return null; }
}
window.ppFx29Strahl = ppFx29Strahl;

/** Aufwärmen im Leerlauf (Ruckler-Regel): der erste Strahl nach dem Laden kostete 12 ms im Maler (Schleifen noch im Interpreter) und die Farbableitung suchte erst dann die Palette ab.
 *  Zwei trockene Durchläufe (große und kleine Zone, schmaler und breiter Strahl, normaler und gedämpfter Einschlag) — kein DOM, keine Leinwand. */
function ppFx29Aufwaermen() {
  try {
    const los = () => {
      for (const v of [{ dick: 1, tw: 49, th: 58, wucht: undefined, color: '#ff1a1a' }, { dick: 2.8, tw: 90, th: 110, wucht: 0.4, color: '#4ceb70', glow: '#68c6fd', miss: true }, { dick: 1, tw: 60, th: 80, color: 'rgba(255,248,232,0.92)' }]) {
        ppFx29Strahl({ ax: 100, ay: 400, bx: 160, by: 120, sw: 60, sh: 80, sHeld: true, tHeld: true, dauer: 1500, trocken: 45, ...v });
      }
    };
    setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 4000 }) : los()), 2500);
  } catch (e) { /* weg */ }
}
ppFx29Aufwaermen();
