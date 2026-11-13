// app-fx-71: Trailer-Looks „Heldentod: Einsinken + Brocken + Staubwolke“ und „Phönix-Wiederbelebung“ (Pixelart-Leinwand, Zelle = Hero-Pixel)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Trailer (shot01.js). Alles ist eine reine Funktion des Bildes (30 Hz, `ppTaktRaf`), feste Palettenfarben (`ppSnapRgb`), Bayer-Dither statt Alpha, nichts gedreht / weich skaliert,
//  Bewegung in ganzen Pixeln. Kill-Schalter für beide Teile: `window.__ppFx71Aus = true` (Test/Notbremse). Rückfall außerdem bei Retro (`PP_RETRO`), reduzierter Bewegung, `__ppFxAlt`, Animationen aus.
//
//  TEIL 1 — HELDENTOD „sturz“ (Trailer: Broghan 101,1 s, Kyli 140,6 s; `dieStyle !== 'shatter'`, l. 2026, 2546–2547, 1943–1944)
//    Die Figur zerspringt nicht in Splitter, sondern SINKT gestaucht in den Boden (Breite 1 → 1,3, Höhe 1 − 0,75·u², in Zehnteln gestuft = Stop-Motion) und löst sich dabei von unten nach oben gedithert
//    auf (12 Stufen, Takt `0,6·(1 − y/H) + 0,4·Bayer`); sie wackelt (±3 Sprite-Pixel, klingt ab), sechs Bodenringe (alle 250 ms, r 60 + 6k), Brocken (36/s, je drei, cremeweiß → grau → Asche → dunkel) fallen aus dem
//    Rest des Körpers, eine Staubwolke (24/s, große graue Würfel auf dunkel) steigt am Fuß auf. Dauer des Einsinkens 1300 ms (Trailer `V_DIED = 1,3`).
//    Lage im Spiel: `app-fx-32.jsx` (Zerspringen) bleibt der Rahmen — Beobachter der Sprite-Ebene, Pool-Leinwand des Platzes, Vorrechnen der Pixelstücke, Gefallen-Verdunklung, Funken (app-fx-37). Dieses Modul liefert nur den zweiten
//    Stil: `ppFx71Stil(platz)` (Wahl), `ppFx71BaueSturz(Z)` (Brocken/Staub würfeln), `ppFx71ZeichneSturz(Z, t, f)` (ein Bild), `PP_FX71_DAUER_S`. app-fx-32 ruft sie, wenn sie da sind.
//    STILWAHL: Alice zerspringt (Trailer: `dieStyle: 'shatter'`), alle anderen Helden sinken ein (Broghan/Kyli sind die Trailer-Fassung). `window.__ppFx71Stil = 'sturz' | 'shatter'` erzwingt einen Stil (Test); die Liste `PP_FX71_STIL_FEST`
//    legt die Ausnahmen fest. Ohne Rückfall-Bedingung (s. o.) immer der alte Tod „Zerspringen“.
//    WARUM der Stil früher entfernt wurde (56c9eed8, 3.11.2026): keine Technik — es war eine reine Designentscheidung („alle Helden zerspringen in ihre Pixel“, dazu der Grabstein-Ersatz app-fx-37). Er lief mit p99 0,4 ms je Bild.
//    Engine: unberührt — der Server wartet nach dem Heldentod auf nichts (`hero_death`-Klang am `hero_ko`-Eintrag); die Animation hängt am Zustandswechsel „Held liegt“ und läuft über die Wartezeit hinaus.
//    Handy (`ppIsPhone`): Brocken und Staub halbiert. Pixelgröße: eine Leinwandzelle je Sprite-Pixel der Figur (= Hero-Pixel, wie das Zerspringen).
//
//  TEIL 2 — PHÖNIX-WIEDERBELEBUNG (Trailer: Cute Phoenix, Zug 8a, l. 2230–2244, 1917–1925, 2513–2520; Q 64,5–67,0)
//    Im Spiel stirbt Cute Phoenix normal (Karte fliegt in die Ablage, `creature_death`); die Wiederbelebung (`_reviveAfterDeath`, Engine `_wiederbelebungNachTod`) setzt sie nach der Frage „Revive?“ in IHREN Platz zurück.
//    Die Sprites der Kreaturen gibt es im Spiel nicht — der Zyklus läuft darum kartenbasiert am Platz:
//      `phoenix_zerfall`  (Zonen-Animation, gesendet vom Skript `cute-phoenix.js` im Todes-Hook, parallel zum Kartenflug in die Ablage): Flammenzerfall — 100 Flammenblöcke (50/s × 2) steigen auf, ~77 Funken/Herzen/Sterne
//                         (70/s), Asche (24/s); ~2,2 s Lebensdauer, reine Optik.
//      `phoenix_rebirth`  (Zonen-Animation, gesendet von `_wiederbelebungNachTod` anstelle von `holy_revival`, wenn der Stempel `animation` trägt): 0–1400 ms Flammensammeln (3 Ringe r 60 → 6 als Pixelringe, 160 Flämmchen/Herzen
//                         ziehen sich zur Mitte), ab 250 ms wächst das FEUER-EI (Ellipse, Dither-Verlauf Creme → Gelb → Orange → Rot → Dunkelrot, Tinte-Kontur, Flammenzungen, Pulsieren; 12 Wachstumsstufen in 900 ms), ab 800 ms laufen
//                         6 RISSE vom Mittelpunkt nach außen (Tinte 3 + Creme 1), ab 1150 ms wackelt das Ei, ab 1500 ms hellt es sich per Bayer-Dither auf — bei 1700 ms EXPLOSION: 5 Ringe (creme/gelb/orange/rosa/rot, 0,8 s), 32 Strahlen
//                         (0,24 s), 8 Flammensäulen (1,6 s), Funkenstoß, Herzen, aufsteigende Funken, 5 Bilder Creme-Dither-Blitz über dem Platz (deckt das Erscheinen der Karte). Dann steht die Karte da.
//    ENGINE-VERTRAG: `_wiederbelebungNachTod` wartet beim Phönix `reviveAfterDeath.animationMs` (= `PP_FX71_REBIRTH_MS` = 1800 ms: Explosionsbild 1700 ms + Mount-Vorlauf 100 ms) statt 620 ms, bevor die Karte wieder gesetzt wird; Gesamt-Lebensdauer
//    der Leinwand 3500 ms läuft parallel zum Weiterspielen. Andere Wiederbelebungen (Loyal Bone Dog, Extra Life/Trial of Coolness) behalten `holy_revival`.
//    Rückfall: Retro, reduzierte Bewegung, `__ppFx71Aus`, keine Palette → `phoenix_rebirth` spielt das alte `holy_revival`; `phoenix_zerfall` fällt dann aus (es gab vorher keinen). Der Klang kommt in beiden Fällen aus `ZONE_ANIM_SFX`.
//    Handy: Teilchenzahlen 40 %. Pixelgröße: Rasterzelle S = Hero-Pixel der Zonenreihe (`ppFxZelleGedeckelt`, Props `zelleS`).
// ═════════════════════════════════════════════════════════════════

// ── Rückfall (gemeinsam) ──
function ppFx71Rueckfall() {
  try {
    if (window.__ppFx71Aus || window.__ppFxAlt || window._playAnimations === false || window.PP_RETRO) return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { /* weiter */ }
  return false;
}
window.ppFx71Moeglich = () => !ppFx71Rueckfall() && typeof window.ppSnapRgb === 'function';

// ═════════════════════════════════════════════════════════════════════════════════════
//  TEIL 1: Heldentod „sturz“ (Einsinken + Brocken + Staubwolke)
// ═════════════════════════════════════════════════════════════════════════════════════
const PP_FX71_DAUER_S = 1300;                                  // Einsinken + Auflösen (Trailer V_DIED)
const PP_FX71_STIL_FEST = [[/^alice-/, 'shatter']];            // Ausnahmen: Alice zerspringt (Trailer `dieStyle: 'shatter'`); alle anderen sinken ein
const PP_FX71_BROCKEN_RAMPE = [PP_FX32_PAL.creme, PP_FX32_PAL.grau, PP_FX32_PAL.asche, PP_FX32_PAL.rauch];

/** Todesstil eines Helden (`platz._ppSchluessel` = Slug des Heldennamens): 'sturz' oder 'shatter' (alter Tod, Rückfall). */
function ppFx71Stil(platz) {
  try {
    if (ppFx71Rueckfall()) return 'shatter';
    const f = window.__ppFx71Stil;
    if (f === 'sturz' || f === 'shatter') return f;
    const k = String((platz && platz._ppSchluessel) || '');
    for (const [re, st] of PP_FX71_STIL_FEST) if (re.test(k)) return st;
    return 'sturz';
  } catch (e) { return 'shatter'; }
}

function ppFx71RectWH(buf, W, H, x, y, w, h, col) {
  const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  for (let yy = Math.max(0, y); yy < y1; yy++) { const o = yy * W; for (let xx = Math.max(0, x); xx < x1; xx++) buf[o + xx] = col; }
}

/** Auflösereihenfolge der Pixelstücke (wie im Trailer: `0,6·(1 − y/H) + 0,4·Bayer` — die Füße zuerst, der Kopf zuletzt); einmal je Zerlegung, gemerkt. */
function ppFx71Reihenfolge(D, g) {
  if (D._ppSC) return D._ppSC;
  const n = D.n, b = D.b, SC = new Float32Array(n), hoehe = Math.max(1, g.y1 - g.y0);
  for (let i = 0; i < n; i++) {
    const x = D.x[i], y = D.y[i], hy = Math.max(0, Math.min(1, (y + b / 2 - g.y0) / hoehe));
    SC[i] = 0.6 * (1 - hy) + 0.4 * PP_FX32_BAYER[((y & 7) << 3) | (x & 7)] / 64;
  }
  D._ppSC = SC;
  return SC;
}

/** Brocken und Staub eines Todes würfeln (einmal beim Start). Z: { D, g } → setzt Z.brocken, Z.staub, Z.rauch, Z.funken, Z.ende. */
function ppFx71BaueSturz(Z) {
  const D = Z.D, g = Z.g, sub = g.sub, hoehe = Math.max(1, g.y1 - g.y0), mag = g.mag;
  const phone = !!(window.ppIsPhone && window.ppIsPhone()), nf = phone ? 0.5 : 1;
  const T0 = PP_FX32_HALT, DS = PP_FX71_DAUER_S, grav = 85 * mag, breit = Math.max(8, g.zw * 0.6);
  ppFx71Reihenfolge(D, g);
  let ende = T0 + DS;
  // Brocken: alle 1/36 s drei Stück aus dem Rest des Körpers (Trailer „Brocken fallen“)
  const brocken = [];
  for (let ms = 0; ms < DS + 200; ms += 1000 / 36) {
    const u = Math.min(1, ms / DS), top = (1 - u) * hoehe * (1 - 0.75 * u * u);
    for (let k = 0; k < 3; k++) {
      if (nf < 1 && Math.random() >= nf) continue;
      const x = g.mitteX + (Math.random() - 0.5) * 2 * breit, y0 = g.fussY - (3.5 + Math.random() * Math.max(3.5, top));
      const vx = (Math.random() - 0.5) * 20 * mag, vy = -(Math.random() * 10) * mag, flo = g.fussY - Math.random() * 1.5;
      const dis = Math.max(0, vy * vy + 2 * grav * Math.max(0, flo - y0)), tl = (-vy + Math.sqrt(dis)) / grav * 1000;
      const life = Math.min(600 + Math.random() * 600, tl + 250), t0 = T0 + ms + Math.random() * 20;
      brocken.push({ t0, life, tl, x, y0, vx, vy, flo, sz: Math.max(1, Math.round(sub * (Math.random() < 0.5 ? 1.5 : 1.2))) });
      ende = Math.max(ende, t0 + life);
    }
  }
  // Staubwolke: große graue Würfel steigen am Fuß auf (Trailer „Staubwolke“), schrumpfen und flimmern weg
  const staub = [];
  for (let ms = 0; ms < DS + 800; ms += 1000 / 24) {
    if (nf < 1 && Math.random() >= nf) continue;
    const t0 = T0 + ms, life = 900 + Math.random() * 600;
    staub.push({ t0, life, x: g.mitteX + (Math.random() - 0.5) * 2 * breit * 1.2, y: g.fussY - (1 + Math.random() * 5), vx: (Math.random() - 0.5) * 8, vy: -(3 + Math.random() * 5), sz: Math.max(2, Math.round(sub * (Math.random() < 0.5 ? 2.4 : 2))) });
    ende = Math.max(ende, t0 + life);
  }
  Z.brocken = brocken; Z.staub = staub; Z.rauch = []; Z.funken = [];
  Z.ende = ende + PP_FX32_BILD;
}

/** Bodenringe (hinter allem): n Ringe im Abstand von 250 ms ab dem Anhalten (Trailer: r 60 + 6k, grau + Asche-Schachbrett). */
function ppFx71Ringe(Z, t, n) {
  const g = Z.g, buf = Z.pool.buf, W = g.W, H = g.H, sub = g.sub;
  const cxm = Math.round((g.mitteX + g.ML) * sub), cyf = Math.round((g.fussY + g.MT) * sub);
  for (let k = 0; k < n; k++) {
    const dt = t - (PP_FX32_HALT + k * 250);
    if (dt < 0 || dt >= 450) continue;
    const R = (g.zw * (0.8 + 0.06 * k)) * sub;
    const r1 = Math.round(ppFx32Eased(dt / 450) * R);
    ppFx32Ring(buf, W, H, cxm, cyf, r1, Math.round(r1 * 0.3), sub, PP_FX32_PAL.grau, false);
    if (dt > 80) { const r2 = Math.round(ppFx32Eased((dt - 80) / 400) * R * 0.75); ppFx32Ring(buf, W, H, cxm, cyf, r2, Math.round(r2 * 0.3), sub, PP_FX32_PAL.asche, true); }
  }
}

/** Stil „sturz“: ein Bild (t in ms seit Beginn, f = Bildnummer). */
function ppFx71ZeichneSturz(Z, t, f) {
  const pool = Z.pool, g = Z.g, buf = pool.buf, W = g.W, H = g.H, sub = g.sub, D = Z.D, b = D.b, ML = g.ML, MT = g.MT, SC = ppFx71Reihenfolge(D, g);
  buf.fill(0);
  ppFx71Ringe(Z, t, 6);
  // Staubwolke
  for (const r of Z.staub) {
    const dt = t - r.t0;
    if (dt < 0 || dt >= r.life) continue;
    const u = dt / r.life, sz = Math.max(1, Math.round(r.sz * (1 - 0.45 * u)));
    const px = Math.round((r.x + ML + r.vx * dt / 1000) * sub - sz / 2), py = Math.round((r.y + MT + r.vy * dt / 1000) * sub - sz / 2);
    if (u > 0.45 && PP_FX32_BAYER[((py & 7) << 3) | (px & 7)] < ((u - 0.45) / 0.55) * 64) continue;      // Dither-Ausblenden statt Alpha
    ppFx32Rect(buf, W, H, px, py, sz, PP_FX32_RAUCH_RAMPE[Math.min(3, (u * 4) | 0)]);
  }
  // Figur: gestaucht (Zehntelstufen), von unten nach oben aufgelöst (Zwölftelstufen)
  const du = Math.max(0, Math.min(1, (t - PP_FX32_HALT) / PP_FX71_DAUER_S));
  if (du < 1) {
    const dq = Math.round(du * 10) / 10, psx = 1 + 0.3 * dq, psy = 1 - 0.75 * dq * dq, thr = Math.round(du * 12) / 12;
    const ox = t < PP_FX32_HALT ? [1, -1, 2, -2][Math.min(3, f)] * sub : Math.round(PP_FX32_WACKELN[f % 4] * 2.5 * (1 - du) * sub);
    const blitz = f < 2, bs = b * sub, cb = PP_FX32_PAL.creme;
    for (let i = 0; i < D.n; i++) {
      if (SC[i] < thr) continue;
      const X = (g.mitteX + (D.x[i] - g.mitteX) * psx + ML) * sub + ox, Y = (g.fussY + (D.y[i] - g.fussY) * psy + MT) * sub;
      const x0 = Math.floor(X), y0 = Math.floor(Y);
      ppFx71RectWH(buf, W, H, x0, y0, Math.max(1, Math.ceil(X + bs * psx) - x0), Math.max(1, Math.ceil(Y + bs * psy) - y0), blitz ? cb : D.c[i]);
    }
  }
  // Brocken (vorn)
  for (const c of Z.brocken) {
    const dt = t - c.t0;
    if (dt < 0 || dt >= c.life) continue;
    const u = dt / c.life, ds = (dt > c.tl ? c.tl : dt) / 1000;
    const fx = c.x + c.vx * ds, fy = Math.min(c.flo, c.y0 + c.vy * ds + 0.5 * 85 * g.mag * ds * ds);
    const px = Math.round((fx + ML) * sub - c.sz / 2), py = Math.round((fy + MT) * sub - c.sz / 2);
    if (u > 0.62 && PP_FX32_BAYER[((py & 7) << 3) | (px & 7)] < ((u - 0.62) / 0.38) * 64) continue;
    ppFx32Rect(buf, W, H, px, py, c.sz, PP_FX71_BROCKEN_RAMPE[Math.min(3, (u * 4) | 0)]);
  }
  pool.ctx.putImageData(pool.img, 0, 0);
}

// ═════════════════════════════════════════════════════════════════════════════════════
//  TEIL 2: Phönix — Flammenzerfall (`phoenix_zerfall`) und Wiederbelebung (`phoenix_rebirth`)
// ═════════════════════════════════════════════════════════════════════════════════════
const PP_FX71_T_EXPLOSION = 1700;                              // Explosion (Bild 51) — die Engine setzt die Karte hier wieder
const PP_FX71_REBIRTH_MS = PP_FX71_T_EXPLOSION + 100;          // Engine-Wartezeit = Explosionsbild + Mount-Vorlauf (ZONE_ANIM_MOUNT_DELAY_MS)
const PP_FX71_REBIRTH_LEBEN = 3500;                            // Lebensdauer der Leinwand (Explosionsreste, Flammensäulen 1,6 s)
const PP_FX71_ZERFALL_LEBEN = 2300;
window.PP_FX71_REBIRTH_MS = PP_FX71_REBIRTH_MS;

let PP_FX71_C = null;
function ppFx71Farben() {
  if (PP_FX71_C) return PP_FX71_C;
  const sn = (hex) => { const r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return typeof window.ppSnapRgb === 'function' ? window.ppSnapRgb(r, gg, b) : [r, gg, b]; };
  const C = { cream: sn('#fffbd2'), ink: sn('#12101f'), dark: sn('#08060c'), grey: sn('#9aa3b6'), ash2: sn('#59606e'), yel: sn('#ffe23d'), org: sn('#ff9a1a'), red: sn('#fe5154'), dred: sn('#780014'), hpk: sn('#fe6794'), hpk2: sn('#f8b4c8') };
  C.flm = [C.yel, C.org, C.red, C.dred];          // Trailer FLM
  C.fl5 = [C.cream, C.yel, C.org, C.red];         // Trailer FL5
  C.asche = [C.grey, C.ash2, C.ash2, C.dark];
  C.herz = [C.hpk, C.hpk2, C.cream];
  C.fc = [C.org, C.yel, C.hpk, C.cream];          // Trailer cols von Cute Phoenix
  PP_FX71_C = C;
  return C;
}

function ppFx71Hash(a, b) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function ppFx71Rng(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const PP_FX71_BAY8 = (() => { const f = new Uint8Array(64); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) f[y * 8 + x] = PP_FX32_BAYER[y * 8 + x]; return f; })();
const ppFx71EaseOut = (u) => { u = Math.max(0, Math.min(1, u)); return 1 - Math.pow(1 - u, 3); };
const ppFx71Cl = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

/** Teilchen zeichnen (Zellen; Position aus Startwert + Geschwindigkeit + Beschleunigung, Ausblinken statt Alpha). p: { t0, life (ms), x0, y0, vx, vy, ax, ay (Zellen/s), kind, sz, sz2, ramp } */
function ppFx71Teilchen(g, parts, t, f, ox, oy) {
  for (const p of parts) {
    const dms = t - p.t0;
    if (dms < 0 || dms >= p.life) continue;
    if (dms > p.life * 0.72 && (f & 1)) continue;                      // Ausblinken statt Alpha
    const ds = dms / 1000, x = Math.round(ox + p.x0 + p.vx * ds + 0.5 * (p.ax || 0) * ds * ds), y = Math.round(oy + p.y0 + p.vy * ds + 0.5 * (p.ay || 0) * ds * ds);
    const col = p.ramp[Math.min(p.ramp.length - 1, Math.floor(dms / p.life * p.ramp.length))];
    if (p.kind === 'plus') { g.block(x - 1, y, 3, 1, col); g.block(x, y - 1, 1, 3, col); }
    else if (p.kind === 'star') { g.block(x - 2, y, 5, 1, col); g.block(x, y - 2, 1, 5, col); g.block(x - 1, y - 1, 3, 3, col); }
    else if (p.kind === 'heart') { g.block(x - 2, y - 1, 2, 2, col); g.block(x + 1, y - 1, 2, 2, col); g.block(x - 2, y, 5, 1, col); g.block(x - 1, y + 1, 3, 1, col); g.put(x, y + 2, col); }
    else { const z = p.sz2 != null && dms > p.life * 0.5 ? p.sz2 : p.sz; g.block(x, y, z, z, col); }
  }
}

/** Zerfall: die Flammen, in die der Phönix zerfällt (Trailer l. 2514/2515 + Funken l. 1284). cw/ch = Kartenbreite/-höhe in Zellen, ks = Geschwindigkeitsfaktor (3 / Zelle). */
function ppFx71ZerfallTeile(sz) {
  const C = ppFx71Farben(), S = sz.S, cw = sz.hw * 2, ch = sz.hh * 2, ks = 3 / S, rg = ppFx71Rng(Math.floor(Math.random() * 1e6) + 7);
  const nF = window.ppFxN ? window.ppFxN(100) / 100 : 1, parts = [];
  const P = (p) => parts.push(p);
  // Flammen (2 je 1/50 s, 0,05 … 1,07 s): Blöcke 4/3 → 1, steigen auf, Rampe Gelb → Orange → Rot → Dunkelrot
  for (let ti = 50; ti < 1070; ti += 20) for (let k = 0; k < 2; k++) {
    if (nF < 1 && rg() >= nF) continue;
    P({ t0: ti, life: 500 + rg() * 500, x0: (rg() - 0.5) * cw * 1.5, y0: ch * 0.5 - (0.1 + rg() * 0.7) * ch, vx: (rg() - 0.5) * 6 * ks, vy: -(8 + rg() * 16) * ks, kind: 'sq', sz: rg() < 0.5 ? 4 : 3, sz2: 1, ramp: C.flm });
  }
  // Funken / Herzen / Sterne (70/s bis 1,1 s)
  for (let ti = 0; ti < 1100; ti += 1000 / 70) {
    if (nF < 1 && rg() >= nF) continue;
    const q = rg();
    P({ t0: ti, life: 500 + rg() * 600, x0: (rg() - 0.5) * cw * 1.6, y0: ch * 0.5 - rg() * ch * 0.9, vx: (rg() - 0.5) * 12 * ks, vy: -(22 + rg() * 70) * ks, kind: q < 0.15 ? 'heart' : (q < 0.45 ? 'star' : 'sq'), sz: 1, ramp: C.fc });
  }
  // Asche (24/s, 0,12 … ~1,5 s)
  for (let ti = 120; ti < 1500; ti += 1000 / 24) {
    if (nF < 1 && rg() >= nF) continue;
    P({ t0: ti, life: 900 + rg() * 700, x0: (rg() - 0.5) * cw * 1.3, y0: ch * 0.5 - (0.15 + rg() * 0.5) * ch, vx: (rg() - 0.5) * 3 * ks, vy: -(2 + rg() * 5) * ks, kind: 'sq', sz: 2, sz2: 1, ramp: C.asche });
  }
  return { parts };
}
function ppFx71ZerfallMalen(g, t, sz, teile) {
  const f = Math.floor(t / (1000 / 30));
  ppFx71Teilchen(g, teile.parts, t, f, sz.cx, sz.cy);
}

/** Wiederbelebung: Teile (Flämmchen, Säulen, Explosion), einmal gewürfelt. */
function ppFx71RebirthTeile(sz) {
  const C = ppFx71Farben(), S = sz.S, cw = sz.hw * 2, ch = sz.hh * 2, ks = 3 / S, rg = ppFx71Rng(Math.floor(Math.random() * 1e6) + 11);
  const nF = window.ppFxN ? window.ppFxN(100) / 100 : 1, parts = [], TE = PP_FX71_T_EXPLOSION;
  const P = (p) => parts.push(p);
  const f = cw / 22 * 0.9 + 0.1;                                     // Größenfaktor zur Karte (22 Zellen = Standardkarte bei Zelle 3)
  // Flammensammeln: Flämmchen/Herzen ziehen sich in 0,4 s zur Mitte (Trailer l. 1286: 220, Radius 60–190, Ellipse 0,6)
  for (let k = 0, n = Math.round(160 * nF); k < n; k++) {
    const an = rg() * Math.PI * 2, r = (0.9 + rg() * 2.2) * cw, life = 400, t0 = rg() * (1400 - 100);
    P({ t0, life, x0: Math.cos(an) * r, y0: Math.sin(an) * r * 0.6, vx: -Math.cos(an) * r / (life / 1000), vy: -Math.sin(an) * r * 0.6 / (life / 1000) - 10 * ks, kind: rg() < 0.2 ? 'heart' : 'sq', sz: rg() < 0.3 ? 2 : 1, ramp: C.fc });
  }
  // Explosion: Funkenstoß (Trailer l. 1288/2518: 160 + 160 Funken, plus/sq, Rampe FL5), Herzen (30), aufsteigende Funken (200)
  for (let k = 0, n = Math.round(230 * nF); k < n; k++) {
    const an = rg() * Math.PI * 2, sp = (14 + rg() * 72) * ks * f;
    P({ t0: TE, life: 400 + rg() * 600, x0: 0, y0: 0, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.8 - 6 * ks, ay: 36 * ks, kind: rg() < 0.3 ? 'plus' : 'sq', sz: rg() < 0.4 ? 3 : 2, sz2: 1, ramp: C.fl5 });
  }
  for (let k = 0, n = Math.round(30 * nF); k < n; k++) {
    const an = rg() * Math.PI * 2, sp = (11 + rg() * 42) * ks * f;
    P({ t0: TE + rg() * 150, life: 900 + rg() * 700, x0: 0, y0: 0, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.7 - 8 * ks, ay: 11 * ks, kind: 'heart', sz: 1, ramp: C.herz });
  }
  for (let k = 0, n = Math.round(110 * nF); k < n; k++) {
    P({ t0: TE + rg() * 600, life: 700 + rg() * 900, x0: (rg() - 0.5) * cw * 1.4, y0: (rg() - 0.3) * ch * 0.9, vx: (rg() - 0.5) * 18 * ks, vy: -(30 + rg() * 60) * ks, kind: 'sq', sz: 1, ramp: C.fc });
  }
  // Flammensäulen (8 um den Platz, 1,6 s, ab 0,5 s ausdünnend; Trailer l. 2516)
  for (let c = 0; c < 8; c++) {
    const an = c / 8 * Math.PI * 2 + 0.2, cx = Math.cos(an) * cw * 1.15, cy = ch * 0.5 + Math.sin(an) * cw * 1.15 * 0.55;
    for (let ti = 0; ti < 1600; ti += 1000 / 34) {
      const keep = ti < 500 ? 1 : Math.max(0, 1 - (ti - 500) / 1100);
      if (rg() > keep * (nF < 1 ? nF + 0.2 : 1)) continue;
      P({ t0: TE + ti, life: 500 + rg() * 400, x0: cx + (rg() - 0.5) * cw * 0.35, y0: cy, vx: (rg() - 0.5) * 5 * ks, vy: -(9 + rg() * 14) * ks, kind: 'sq', sz: rg() < 0.5 ? 4 : 3, sz2: 1, ramp: C.flm });
    }
  }
  return { parts, f };
}

/** Das Feuer-Ei (Trailer l. 2230–2244): Ellipse mit Dither-Verlauf, Flammenzungen, Rissen, Aufhellen. (cx, cy) Mitte in Zellen, rx/ry Halbachsen, hat = Zeit bis zur Explosion (s). */
function ppFx71Ei(g, C, t, cx0, cy0, rx0, ry0) {
  const egg0 = 250, hat = (PP_FX71_T_EXPLOSION - t) / 1000, f = Math.floor(t / (1000 / 30)), fr = f >> 1;
  const gq = Math.round(ppFx71EaseOut(Math.min(1, (t - egg0) / 900)) * 12) / 12, pulse = 1 + 0.05 * Math.sin((t - egg0) / 1000 * 9);
  const wob = hat < 0.55 ? Math.round([1, -1, 0.6, -0.8][f % 4] * (1 + (0.55 - hat) * 5)) : 0;
  const rx = Math.max(1, Math.round(rx0 * gq * pulse)), ry = Math.max(1, Math.round(ry0 * gq * pulse)), cx = Math.round(cx0) + wob, cy = Math.round(cy0 - ry0 * 0.15 * gq);
  // Flammenzungen auf dem Ei
  for (let k = -rx; k <= rx; k += 2) {
    const kk = k / (rx * 0.85); if (Math.abs(kk) >= 1) continue;
    const top = -ry * Math.sqrt(1 - kk * kk) * 0.92, hgt = 2 + Math.floor(ppFx71Hash(k + 200, fr) * 7 * gq);
    g.block(cx + k, cy + Math.round(top) - hgt, 2, hgt + 2, k % 4 ? C.org : C.red);
    g.block(cx + k, cy + Math.round(top) - (hgt >> 1), 1, (hgt >> 1) + 1, C.yel);
  }
  // Körper: Dither-Verlauf Creme → Gelb → Orange → Rot → Dunkelrot, Tinte-Kontur
  for (let y = -ry; y <= ry; y++) for (let x = -rx - 3; x <= rx + 3; x++) {
    const ny = y / ry, w = 1 + 0.2 * ny, d = Math.hypot(x / (rx * w), ny); if (d > 1) continue;
    const dd = d + (ppFx71Hash(x * 31 + y * 7, fr) - 0.5) * 0.28;
    g.put(cx + x, cy + y, d > 0.93 ? C.ink : (dd > 0.82 ? C.dred : (dd > 0.64 ? C.red : (dd > 0.42 ? C.org : (dd > 0.2 ? C.yel : C.cream)))));
  }
  // Risse: laufen vom Eimittelpunkt nach außen und bleiben im Ei (die letzten 0,9 s)
  if (hat < 0.9) {
    const pr = ppFx71Cl(1 - hat / 0.9);
    const inEgg = (x, y) => { const ny = y / ry, w = 1 + 0.2 * ny; return Math.hypot(x / (rx * w), ny) < 0.9; };
    for (let c = 0; c < 6; c++) {
      let qx = Math.round((ppFx71Hash(c, 91) - 0.5) * rx * 0.3), qy = Math.round((ppFx71Hash(c, 92) - 0.5) * ry * 0.3), ang = c * Math.PI / 3 + 0.4 + (ppFx71Hash(c, 93) - 0.5) * 0.5;
      const segs = Math.max(1, Math.round(pr * 9));
      for (let m = 0; m < segs; m++) {
        ang += (ppFx71Hash(c * 11 + m, 77) - 0.5) * 1.2;
        const nx2 = Math.round(qx + Math.cos(ang) * ry * 0.14), ny2 = Math.round(qy + Math.sin(ang) * ry * 0.14);
        if (!inEgg(nx2, ny2)) break;
        g.line(cx + qx, cy + qy, cx + nx2, cy + ny2, C.ink, 1, 3); g.line(cx + qx, cy + qy, cx + nx2, cy + ny2, C.cream, 1, 1);
        qx = nx2; qy = ny2;
      }
    }
  }
  // Aufhellen: Bayer-Dither Creme (die letzten 0,2 s)
  if (hat < 0.2) {
    const lv = 24 + (0.2 - hat) * 150;
    for (let y = -ry; y <= ry; y++) for (let x = -rx - 3; x <= rx + 3; x++) {
      const ny = y / ry, w = 1 + 0.2 * ny; if (Math.hypot(x / (rx * w), ny) > 1) continue;
      if (PP_FX71_BAY8[((y + 64) & 7) * 8 + ((x + 64) & 7)] < lv) g.put(cx + x, cy + y, C.cream);
    }
  }
}

function ppFx71RebirthMalen(g, t, sz, teile) {
  const C = ppFx71Farben(), f = Math.floor(t / (1000 / 30)), S = sz.S, cw = sz.hw * 2, ch = sz.hh * 2, fk = teile.f, cx = sz.cx, cy = sz.cy, TE = PP_FX71_T_EXPLOSION;
  // 1) Flammensammeln: 3 Ringe r 60 → 6 (1,4 s, Schachbrett-Pixelringe in Flammenfarben)
  if (t < 1400) {
    const u = t / 1400, R0 = cw * 1.9, R1 = cw * 0.2;
    for (let k = 0; k < 3; k++) {
      const ph = (u * 2 + k / 3) % 1, r = Math.round(R0 + (R1 - R0) * ph), col = C.flm[k];
      if (r < 1) continue;
      const n = Math.max(16, Math.round(r * 7)); let lx = 1e9, ly = 1e9;
      for (let q = 0; q < n; q++) {
        const a = q / n * Math.PI * 2, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.82);
        if (x === lx && y === ly) continue; lx = x; ly = y;
        if ((x + y) & 1) continue; g.block(x, y, 2, 2, col);
      }
    }
  }
  // 2) Teilchen hinter dem Ei (Gather), dann Ei, dann Explosionsteilchen davor
  const vor = [], hinter = [];
  for (const p of teile.parts) (p.t0 < TE ? hinter : vor).push(p);
  ppFx71Teilchen(g, hinter, t, f, cx, cy);
  if (t >= 250 && t < TE + 40) ppFx71Ei(g, C, Math.min(t, TE - 1), cx, cy, cw * 0.46, ch * 0.54);
  // 3) Explosion: Ringe (0,8 s), 32 Strahlen (0,24 s), Blitz über dem Platz
  const dt = (t - TE) / 1000;
  if (dt >= 0) {
    const ring = (r, th, col, dith) => {
      r = Math.round(r); if (r < 1) return;
      const n = Math.max(16, Math.round(r * 7)); let lx = 1e9, ly = 1e9;
      for (let q = 0; q < n; q++) {
        const a = q / n * Math.PI * 2, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.82);
        if (x === lx && y === ly) continue; lx = x; ly = y;
        if (dith && ((x + y) & 1)) continue; g.block(x, y, th, th, col);
      }
    };
    if (dt < 0.8) {
      ring(ppFx71EaseOut(dt / 0.45) * 70 * fk * 0.5, dt < 0.12 ? 3 : 2, C.cream, false);
      if (dt > 0.05) ring(ppFx71EaseOut((dt - 0.05) / 0.5) * 54 * fk * 0.5, 2, C.yel, false);
      if (dt > 0.1) ring(ppFx71EaseOut((dt - 0.1) / 0.6) * 120 * fk * 0.5, 2, C.org, true);
      if (dt > 0.18) ring(ppFx71EaseOut((dt - 0.18) / 0.6) * 96 * fk * 0.5, 2, C.hpk, true);
      if (dt > 0.28) ring(ppFx71EaseOut((dt - 0.28) / 0.5) * 150 * fk * 0.5, 2, C.red, true);
    }
    if (dt < 0.24) {
      const L = dt < 0.12 ? ppFx71EaseOut(dt / 0.12) : 1 - (dt - 0.12) / 0.12;
      for (let r = 0; r < 32; r++) {
        const an = r * Math.PI / 16 + 0.05, len = L * (r % 2 ? 70 : 140) * fk * 0.5;
        g.line(cx, cy, Math.round(cx + Math.cos(an) * len), Math.round(cy + Math.sin(an) * len * 0.9), r % 3 === 0 ? C.cream : (r % 2 ? C.org : C.yel), 1, r % 2 ? 2 : 3);
      }
    }
    // Blitz: Creme-Dither über dem Kartenplatz (Bild 0: voll, danach 10/6/3 von 16) — deckt das Wiedererscheinen der Karte
    const fb = Math.floor(dt * 30), lv = [16, 16, 10, 6, 3][fb];
    if (lv != null) {
      const hw = Math.round(cw / 2) + 1, hh = Math.round(ch / 2) + 1;
      for (let y = -hh; y < hh; y++) for (let x = -hw; x < hw; x++) if (lv >= 16 || PP_FX32_BAYER[((cy + y) & 7) * 8 + ((cx + x) & 7)] / 4 < lv) g.put(cx + x, cy + y, C.cream);
    }
  }
  ppFx71Teilchen(g, vor, t, f, cx, cy);
}

/** Leinwand-Komponenten über `ppR1Leinwand` (Zelle = Hero-Pixel, 30-Hz-Takt, `data-pp-px="aus"`, Weltschicht-Anker durch `playAnimation`). */
function ppFx71Mass(props) {
  const w = Math.max(40, props.w || 66), h = Math.max(50, props.h || 90), E = Math.round(w * 3.4 + 90);
  return { breite: 2 * E, hoehe: Math.round(h * 4.2 + 160), ankerX: E, ankerY: Math.round(h * 2.9 + 80) };
}
const PpFx71ZerfallLeinwand = typeof ppR1Leinwand === 'function' ? ppR1Leinwand(ppFx71ZerfallMalen, PP_FX71_ZERFALL_LEBEN - 100, ppFx71Mass, { z: 10100, vorbereiten: ppFx71ZerfallTeile }) : null;
const PpFx71RebirthLeinwand = typeof ppR1Leinwand === 'function' ? ppR1Leinwand(ppFx71RebirthMalen, PP_FX71_REBIRTH_LEBEN - 100, ppFx71Mass, { z: 10100, vorbereiten: ppFx71RebirthTeile }) : null;

function PpFx71Zerfall(props) {
  if (props.prewarm || ppFx71Rueckfall() || typeof window.ppSnapRgb !== 'function' || !PpFx71ZerfallLeinwand) return null;
  return <PpFx71ZerfallLeinwand {...props} />;
}
function PpFx71Rebirth(props) {
  if (props.prewarm) return null;
  if (ppFx71Rueckfall() || typeof window.ppSnapRgb !== 'function' || !PpFx71RebirthLeinwand) {
    const Alt = ANIM_REGISTRY.holy_revival;     // Rückfall: das alte goldene Licht (Retro, reduzierte Bewegung, Schalter)
    return Alt ? <Alt {...props} /> : null;
  }
  return <PpFx71RebirthLeinwand {...props} />;
}
if (typeof ANIM_REGISTRY !== 'undefined') {
  ANIM_REGISTRY.phoenix_zerfall = PpFx71Zerfall;
  ANIM_REGISTRY.phoenix_rebirth = PpFx71Rebirth;
}
// Klang (animationsrelativ, `playSFXForZoneAnim` rechnet den Mount-Vorlauf drauf): Flammenzerfall = Brand; Wiederbelebung = Brand beim Sammeln, Revive-Klang bei der Explosion
try {
  if (typeof ZONE_ANIM_SFX !== 'undefined') {
    ZONE_ANIM_SFX.phoenix_zerfall = { name: 'burn', opts: { rate: 0.9, volume: 0.7 } };
    ZONE_ANIM_SFX.phoenix_rebirth = [
      { name: 'burn', opts: { rate: 0.8, volume: 0.45, delay: 60, category: null, dedupe: 0 } },
      { name: 'revive', opts: { delay: PP_FX71_T_EXPLOSION - 80, category: null, dedupe: 0 } },
    ];
  }
} catch (e) { /* ohne Klangtabelle */ }
