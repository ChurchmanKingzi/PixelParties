// app-fx-53: REACTION-BAR — Pixelart-Animation beim Auflösen der Kette (Impuls, Blitz, Goldring, Karte schiebt sich heraus und zerbröselt in Kacheln, Schließen-Wisch)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Prototyp „Ketten-Tempo und Reaction-Bar“ (Zeichenroutinen dort `ChainFx`). Die Karten der Leiste bleiben DOM (`ReactionChainOverlay`, app-board.jsx: echte Karten, echte Lage);
//  diese Datei legt EINE Leinwand (Raster = Hero-Pixel, `ppFxZelle`; vorher 2 px, Handy 3 px) darüber und lässt die Karte des gerade auflösenden Glieds zerbröseln. Alles Übrige sind kurze CSS-Stufenanimationen (`steps()`, style.css `.rc53`).
//  ABLAUF (Takt in Bildern zu 30 Hz, vom Server mit `_kettenTakt` getaktet): `reaction_chain_resolving_start` → Rahmen blinkt (Gold/Weiß) · je Glied `link_resolving`: Impuls (gestrichelter Funke
//  vom vorigen Glied), weißer Bayer-Blitz (75 % → 50 %), Goldring, Karte schiebt sich nach links heraus, Pfeilmarke ► · `link_resolved`: Karte zerfällt in Kacheln (fliegen gegen die Brettmitte,
//  Dither statt Alpha), die Leiste schließt die Lücke in 3 ganzen Schritten · `link_negated`: roter Ring, Wackeln, X-Zeichen, rote Kacheln nach 12 Bildern · `reaction_chain_done`: Ringblinken,
//  Dither-Wisch über die Leiste (8 Bilder), dann wird sie ausgehängt.
//  TON: `chain_add` zu Beginn (Rate 0,7) und Ende (1,3), je Glied `ping` mit steigender Tonhöhe (0,85 + 0,075·k), `spell_cast` (1,35, leise), `discard` beim Kartenflug, `negate`.
//  TECHNIK: 30 Hz auf `ppTaktRaf`, nur bei neuem Bild zeichnen, Schmutzrechteck, Palette `ppSnapRgb`, `data-pp-px="aus"`, Texturen der Karten vorab (beim Anketten) und im Leerlauf aufgewärmt,
//  Lage der Karten nur je Ereignis gelesen (nie im Takt). Handy (`ppIsPhone`): nur jede zweite Kachel.
//  RÜCKFALL (`aktiv()` = false: Retro, `__ppFxAlt`, „Play Animations aus“, reduzierte Bewegung, `__ppFx53Aus`): die schlichte Darstellung von heute (Glühen/Blitz per CSS) — mit den neuen kurzen Server-Delays.
//  Test: `window.__ppFx53Aus = true` schaltet die Leiste ab; `window.__ppFx53Messen = true` → `window.__ppFx53Zeiten` = Zeichenzeit je Bild (ms).
// ═════════════════════════════════════════════════════════════════
(function (root) {
  const MS = 1000 / 30;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rd = Math.round;
  function H(a, b) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const memo = new Map();
  function snap(hex) {
    if (memo.has(hex)) return memo.get(hex);
    const h = hex.replace('#', ''), r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    let c = [r, g, b];
    try { if (root.ppSnapRgb) { const q = root.ppSnapRgb(r, g, b); if (q && q.length >= 3) c = [q[0], q[1], q[2]]; } } catch (e) { /* ungerastet */ }
    memo.set(hex, c); return c;
  }
  const snapRGB = (r, g, b) => { const k = (r << 16) | (g << 8) | b; let v = memo.get(k); if (!v) { v = snap('#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')); memo.set(k, v); } return v; };
  let C = null, SPR = null;
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function init() {
    if (C) return;
    const N = { nacht: '#08060c', panel: '#1a1a2e', gold: '#fad54a', goldDD: '#5a3c14', weiss: '#ffffff', rot: '#fe5154', rotD: '#c0141c', rotDD: '#520a0c' };
    C = {}; for (const k in N) C[k] = snap(N[k]);
    const spr = (rows, map) => { const h = rows.length, w = Math.max(...rows.map((r) => r.length)), d = new Uint8ClampedArray(w * h * 4); rows.forEach((row, y) => [...row].forEach((ch, x) => { const c = map[ch]; if (!c) return; const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; })); return { w, h, d }; };
    SPR = {
      funke: spr(['.g.', 'gwg', '.g.'], { g: C.gold, w: C.weiss }),
      pfeil: spr(['#....', '##...', '#g#..', '#ggg#', '#g#..', '##...', '#....'], { '#': C.nacht, g: C.gold }),
      kreuz: spr(['#.......#', '##.....##', '#r#...#r#', '.#r#.#r#.', '..#r#r#..', '.#r#.#r#.', '#r#...#r#', '##.....##', '#.......#'], { '#': C.nacht, r: C.rot }),
    };
  }

  // ── Rastermaler mit Schmutzrechteck ──
  function maler(buf, gw, gh) {
    const d = { x0: gw, y0: gh, x1: 0, y1: 0 };
    const mark = (x0, y0, x1, y1) => { if (x0 < d.x0) d.x0 = x0; if (y0 < d.y0) d.y0 = y0; if (x1 > d.x1) d.x1 = x1; if (y1 > d.y1) d.y1 = y1; };
    const px = (x, y, c) => { if (x < 0 || y < 0 || x >= gw || y >= gh) return; mark(x, y, x + 1, y + 1); const i = (y * gw + x) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; };
    const rect = (x, y, w, h, c) => {
      let x0 = rd(x), y0 = rd(y), x1 = x0 + rd(w), y1 = y0 + rd(h); if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > gw) x1 = gw; if (y1 > gh) y1 = gh; if (x0 >= x1 || y0 >= y1) return;
      mark(x0, y0, x1, y1);
      for (let j = y0; j < y1; j++) { let i = (j * gw + x0) * 4; for (let q = x0; q < x1; q++, i += 4) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; } }
    };
    const dith = (x, y, w, h, level, c) => { x = rd(x); y = rd(y); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (BAY[(y + j) & 3][(x + i) & 3] < level) px(x + i, y + j, c); };
    const rahmen = (x, y, w, h, ringe) => { let o = 0; for (const [c, t] of ringe) { rect(x - o - t, y - o - t, w + 2 * (o + t), t, c); rect(x - o - t, y + h + o, w + 2 * (o + t), t, c); rect(x - o - t, y - o, t, h + 2 * o, c); rect(x + w + o, y - o, t, h + 2 * o, c); o += t; } };
    const linie = (x0, y0, x1, y1, c, dot) => { x0 = rd(x0); y0 = rd(y0); x1 = rd(x1); y1 = rd(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy, k = 0; for (let n = 0; n < 500; n++) { if (!dot || (k++ & 1) === 0) px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } };
    const blit = (img, x, y) => { x = rd(x); y = rd(y); for (let j = 0; j < img.h; j++) for (let i = 0; i < img.w; i++) { const s = (j * img.w + i) * 4; if (img.d[s + 3] < 128) continue; px(x + i, y + j, [img.d[s], img.d[s + 1], img.d[s + 2]]); } };
    return { px, rect, dith, rahmen, linie, blit, d };
  }

  // ── Texturen (Kartenbild → Raster, Palette) ──
  const texCache = new Map();
  function holeTex(name, w, h) {
    const k = name + '@' + w + 'x' + h, e = texCache.get(k);
    if (e) return e.tex || null;
    texCache.set(k, { tex: null });
    try {
      const url = typeof cardImageUrl === 'function' ? cardImageUrl(name) : null;
      if (!url) return null;
      const im = new Image();
      im.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
          g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, w, h);
          const id = g.getImageData(0, 0, w, h), d = id.data;
          for (let i = 0; i < d.length; i += 4) { const p = snapRGB(d[i], d[i + 1], d[i + 2]); d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255; }
          texCache.set(k, { tex: { w, h, d } });
        } catch (e2) { /* ohne Textur: kein Zerbröseln, die Karte verschwindet */ }
      };
      im.src = url;
    } catch (e) { /* weg */ }
    return null;
  }

  const phone = () => { try { return !!(root.ppIsPhone && root.ppIsPhone()); } catch (e) { return false; } };
  // Rasterzelle = Hero-Pixel der eigenen Reihe (`ppFxZelle`, app-board.jsx; Phase 2). Vorher fest 2, Handy 3. Wege/Größen, die vorher in Zellen zu 2 px gedacht waren, rechnen mit `2 / G` auf Bildschirmpixel zurück.
  const zelle = () => { try { if (typeof root.ppFxZelle === 'function') return root.ppFxZelle(null); } catch (e) { /* Rückfall */ } return phone() ? 3 : 2; };
  function aktiv() {
    try {
      if (root.PP_RETRO || root._playAnimations === false || root.__ppFxAlt || root.__ppFx53Aus || typeof ppFx30Maler !== 'function') return false;
      if (root.PPPixelAnim && root.PPPixelAnim.KONFIG && root.PPPixelAnim.KONFIG.aktiv === false) return false;
      if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      return true;
    } catch (e) { return false; }
  }

  const play = (n, o) => { try { if (root.playSFX) root.playSFX(n, Object.assign({ dedupe: 0, category: null }, o)); } catch (e) { /* still */ } };
  const NEG_BILDER = 12, KRUMEN = 9, RAUS = [2, 4, 5, 4, 3, 3];

  // ═════════ Lauf ═════════
  let S = null;   // { cv, g2, img, m, L, T, gw, gh, G, t0, links: Map(domIdx → rec), raf, letzte, vor, tStart, tDone, onGone, n, takt, k }
  function overlayEl() { return document.querySelector('.reaction-chain-overlay'); }
  function stopp() {
    if (!S) return;
    try { cancelAnimationFrame(S.raf); } catch (e) { /* weg */ }
    if (S.wurzel) S.wurzel.remove();
    S = null;
  }
  function anlegen(opts) {
    init();
    const ov = overlayEl(); if (!ov) return false;
    const cards = ov.querySelector('.reaction-chain-cards'); if (!cards) return false;
    const G = zelle();
    const r = ov.getBoundingClientRect(), rc = cards.getBoundingClientRect();
    if (!(rc.width > 8 && rc.height > 8)) return false;
    const L = Math.floor((rc.left - 230) / G) * G, T = Math.floor((r.top - 40) / G) * G;
    const gw = Math.min(260, Math.ceil((r.right + 30 - L) / G)), gh = Math.min(520, Math.ceil((r.bottom + 40 - T) / G));
    const wurzel = document.createElement('div');
    wurzel.setAttribute('aria-hidden', 'true'); wurzel.setAttribute('data-pp-px', 'aus');
    wurzel.style.cssText = `position:fixed;left:${L}px;top:${T}px;pointer-events:none;z-index:10050;`;
    const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh;
    cv.style.cssText = `width:${gw * G}px;height:${gh * G}px;image-rendering:pixelated;display:block;`;
    wurzel.appendChild(cv); document.body.appendChild(wurzel);
    const g2 = cv.getContext('2d'), img = g2.createImageData(gw, gh);
    S = { wurzel, cv, g2, img, m: maler(img.data, gw, gh), L, T, gw, gh, G, links: new Map(), raf: 0, letzte: -1, vor: null, tStart: performance.now(), tDone: 0, onGone: opts && opts.onGone, n: opts && opts.n || 0, takt: opts && opts.takt || 10, k: 0, phone: phone() };
    const takt = root.ppTaktRaf || root.requestAnimationFrame;
    const schritt = (jetzt) => {
      if (!S) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const fr = Math.floor(jetzt / MS + 1e-4);
      if (fr !== S.letzte) { S.letzte = fr; zeichne(jetzt); }
      if (S) S.raf = takt(schritt);
    };
    S.raf = takt(schritt);
    return true;
  }
  const cell = (px, ax) => (px - (ax === 'x' ? S.L : S.T)) / S.G;
  function rec(domIdx) {
    let r = S.links.get(domIdx);
    if (!r) {
      const el = document.querySelector(`.reaction-chain-overlay [data-chain-idx="${domIdx}"]`);
      if (!el) return null;
      r = { el, name: el.getAttribute('data-chain-card'), tRes: 0, tResolved: 0, tNeg: 0, k: S.k++, x0: 0, y0: 0, w: 0, h: 0, tex: null, ende: false };
      S.links.set(domIdx, r);
    }
    return r;
  }
  function lage(r) {
    const b = r.el.getBoundingClientRect(); const G = S.G;
    r.x0 = rd(cell(b.left, 'x')); r.y0 = rd(cell(b.top, 'y')); r.w = rd(b.width / G); r.h = rd(b.height / G);
    r.tw = r.w; r.th = r.h;
  }
  function framCards() { const c = overlayEl() && overlayEl().querySelector('.reaction-chain-cards'); if (!c) return null; const b = c.getBoundingClientRect(); return { x: rd(cell(b.left, 'x')), y: rd(cell(b.top, 'y')), w: rd(b.width / S.G), h: rd(b.height / S.G) }; }

  function zeichne(jetzt) {
    const mess = root.__ppFx53Messen ? performance.now() : 0;
    const { m, img, gw, gh, g2 } = S, buf = img.data;
    if (S.vor) for (let j = S.vor.y0; j < S.vor.y1; j++) buf.fill(0, (j * gw + S.vor.x0) * 4, (j * gw + S.vor.x1) * 4);
    const d = m.d; d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
    const fr = Math.floor((jetzt - S.tStart) / MS + 1e-4);
    const fc = framCards(), ph = S.phone, vk = 2 / S.G, av = rd(16 / S.G);   // vk: Tempo der Kacheln in Bildschirmpixeln wie bei Zelle 2; av: Abstand der Pfeilmarke links von der Karte (8 Zellen zu 2 px)
    // Rahmen blinkt zu Beginn (4 Bilder) und beim Schließen
    if (fc && fr < 4) m.rahmen(fc.x - 2, fc.y - 2, fc.w + 4, fc.h + 4, [[(fr & 1) ? C.gold : C.weiss, 1]]);
    for (const [idx, r] of S.links) {
      if (r.ende) continue;
      const u = r.tRes ? Math.floor((jetzt - r.tRes) / MS + 1e-4) : -99;
      const neg = !!r.tNeg, a = r.tResolved ? Math.floor((jetzt - r.tResolved) / MS + 1e-4) : (neg && jetzt - r.tNeg >= NEG_BILDER * MS ? Math.floor((jetzt - r.tNeg) / MS + 1e-4) - NEG_BILDER : -1);
      const x = r.x0, y = r.y0, w = r.w, h = r.h;
      if (a < 0 && r.tRes) {
        const un = neg ? Math.floor((jetzt - r.tNeg) / MS + 1e-4) : u;
        // Impuls (u −2..1): gestrichelter Funke läuft vom vorigen Glied (oder vom Kopf der Leiste) zur Karte
        if (!neg && u >= -2 && u <= 1) {
          const sy = r.vonY != null ? r.vonY : y - 6, ty = y + (h >> 1), t = clamp((u + 3) / 3), yy = lerp(sy, ty, t), sx = x - 4;
          m.linie(sx, lerp(sy, ty, Math.max(0, t - 0.55)), sx, yy, C.gold, true); m.blit(SPR.funke, sx - 1, rd(yy) - 1);
        }
        if (!neg) {
          if (u >= 0 && u <= 1) m.dith(x, y, w, h, u === 0 ? 12 : 8, C.weiss);
          if (u >= 1) m.rahmen(x, y, w, h, [[C.nacht, 1], [(u & 1) ? C.gold : C.weiss, 1], [C.goldDD, 1]]);
        } else {
          m.rahmen(x, y, w, h, [[C.nacht, 1], [(un & 1) ? C.rot : C.rotD, 1], [C.rotDD, 1]]);
          if (un >= 0) m.dith(x, y, w, h, 6, C.rotD);
          if (un >= 2) m.blit(SPR.kreuz, x + ((w - SPR.kreuz.w) >> 1), y + ((h - SPR.kreuz.h) >> 1));
        }
        if (u >= 1 || neg) m.blit(SPR.pfeil, x - av, y + ((h - SPR.pfeil.h) >> 1));
      }
      // Zerbröseln
      if (a >= 0) {
        if (!r.crumble) { r.crumble = true; r.el.style.visibility = 'hidden'; r.el.classList.add('rc53-weg'); }
        const tex = r.tex || (r.tex = holeTex(r.name, r.tw, r.th));
        const TS = Math.max(2, rd((ph ? 24 : 10) / S.G));   // Kachelkante: 10 px (Handy 24 px), in ganzen Zellen
        if (tex && a <= KRUMEN + 3) {
          const cols = Math.ceil(tex.w / TS), rows = Math.ceil(tex.h / TS);
          for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
            if (ph && ((tx + ty) & 1)) continue;
            const hh = H(r.k * 977 + tx * 31 + ty, 7), h2 = H(r.k * 131 + tx, ty + 99);
            const vx = -(1.6 + hh * 3.6), vy = -0.7 + h2 * 1.5 - ty * 0.05;
            const px0 = x - RAUS[5] + tx * TS + vx * a * 1.8 * vk, py0 = y + ty * TS + vy * a * 1.8 * vk + 0.28 * a * a * vk, life = 4 + hh * 3, lv = clamp((a - life) / 3) * 16;
            if (lv >= 16) continue;
            for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) {
              const sx = tx * TS + i, sy = ty * TS + j; if (sx >= tex.w || sy >= tex.h) continue;
              const xx = rd(px0) + i, yy = rd(py0) + j; if (BAY[yy & 3][xx & 3] < lv) continue;
              const si = (sy * tex.w + sx) * 4; m.px(xx, yy, (neg && ((xx + yy) & 1)) ? C.rotD : [tex.d[si], tex.d[si + 1], tex.d[si + 2]]);
            }
          }
        }
        if (a > KRUMEN + 3) { r.ende = true; if (S.onGone) { try { S.onGone(idx); } catch (e) { /* weg */ } } }
      }
    }
    // Schließen: Ringblinken, dann Dither-Wisch über die Leiste
    if (S.tDone) {
      const cq = Math.floor((jetzt - S.tDone) / MS + 1e-4);
      if (fc) {
        if (cq < 5) m.rahmen(fc.x - 2, fc.y - 2, fc.w + 4, fc.h + 4, [[cq < 2 ? C.weiss : C.gold, cq < 3 ? 2 : 1]]);
        if (cq >= 2) m.dith(fc.x - 3, fc.y - 4, fc.w + 6, fc.h + 12, clamp((cq - 2) / 6) * 16, C.nacht);
      }
      if (cq > 9) { stopp(); return; }
    }
    const ux0 = Math.min(S.vor ? S.vor.x0 : gw, d.x0), uy0 = Math.min(S.vor ? S.vor.y0 : gh, d.y0), ux1 = Math.max(S.vor ? S.vor.x1 : 0, d.x1), uy1 = Math.max(S.vor ? S.vor.y1 : 0, d.y1);
    if (ux1 > ux0 && uy1 > uy0) g2.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
    S.vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
    if (mess) (root.__ppFx53Zeiten || (root.__ppFx53Zeiten = [])).push(+(performance.now() - mess).toFixed(3));
  }

  // ═════════ Öffentliche Schnittstelle ═════════
  const FX = {
    aktiv,
    /** Beim Anketten: Texturen der Karten vorbereiten (kein Laden mitten in der Auflösung). */
    vorladen(namen) { try { if (!aktiv()) return; init(); const G = zelle(); for (const n of namen || []) holeTex(n, rd(80 / G), rd(112 / G)); } catch (e) { /* weg */ } },
    /** `reaction_chain_resolving_start` */
    start(o) {
      try {
        if (!aktiv()) return false;
        stopp();
        if (!anlegen(o)) return false;
        play('chain_add', { volume: 0.55, rate: 0.7 });
        return true;
      } catch (e) { return false; }
    },
    /** `reaction_chain_link_resolving` / `_resolved` / `_negated` für das Glied mit dem DOM-Index idx; art: 'resolving' | 'resolved' | 'negated'; o = { initial, hand } */
    link(idx, art, o) {
      try {
        if (!S) return false;
        const r = rec(idx); if (!r) return false;
        const now = performance.now();
        if (art === 'resolving') {
          lage(r); r.tRes = now;
          // Ausgangspunkt des Impulses: Mitte der vorigen (tiefer liegenden oder höheren) Karte, sonst Kopf der Leiste
          r.vonY = S.lastY != null ? S.lastY : null; S.lastY = r.y0 + (r.h >> 1);
          r.el.classList.add('rc53-pop');
          const k = S.k - 1;
          play('ping', { volume: 0.6, rate: Math.min(1.45, 0.85 + 0.075 * k) });
          setTimeout(() => play('spell_cast', { volume: 0.32, rate: 1.35 }), 2 * MS);
          if (!(o && o.initial)) setTimeout(() => play('discard', { volume: 0.5, rate: 1.15 }), 3 * MS);
        } else if (art === 'resolved') {
          if (!r.tRes) { lage(r); r.tRes = now; }
          r.tResolved = now;
        } else if (art === 'negated') {
          lage(r); r.tRes = now; r.tNeg = now; r.el.classList.add('rc53-neg');
          play('negate', { volume: 0.85, rate: 1.1 });
          if (!(o && o.initial)) setTimeout(() => play('discard', { volume: 0.45 }), 4 * MS);
        }
        return true;
      } catch (e) { return false; }
    },
    /** `reaction_chain_done`: Schließen-Wisch; cb nach dem Wisch (die Leiste wird ausgehängt). */
    fertig(cb) {
      try {
        if (!S) { if (cb) cb(); return false; }
        S.tDone = performance.now();
        play('chain_add', { volume: 0.6, rate: 1.3 }); setTimeout(() => play('ui_click', { volume: 0.4, rate: 1.2 }), MS);
        setTimeout(() => { try { if (cb) cb(); } catch (e) { /* weg */ } }, 10 * MS);
        return true;
      } catch (e) { if (cb) cb(); return false; }
    },
    abbrechen: stopp,
    laeuft: () => !!S,
  };
  root.ppFx53 = FX;
  root.ppFx53Warm = function () { try { if (aktiv()) { init(); const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.putImageData(g.createImageData(64, 64), 0, 0); } } catch (e) { /* weg */ } };
  setTimeout(() => { const ric = root.requestIdleCallback || ((fn) => setTimeout(fn, 60)); ric(() => root.ppFx53Warm(), { timeout: 4000 }); }, 3500);
})(window);
