// app-fx-58: Big Gwen — das Zifferblatt („The Great Clock Tower Big Gwen“, Aktivierung beim Ausspielen) als Pixelart-Leinwand
//
// ═════════════════════════════════════════════════════════════════
//  VORHER (app-board.jsx `onBigGwenClockActivation`, DOM): Zifferblatt aus `radial-gradient`, `border-radius`, Glüh-`box-shadow`, gedrehte/stufenlos skalierte Zeiger und Aufpop mit `rotate()`.
//  Die Pixel-Pipeline machte daraus ein flimmerndes, gerastertes Gelb-Oval; die Zeiger bekamen harte Schatten-Rahmen (Rechtecke), der Abdunkler (`position: fixed; inset: 0`) wurde von den Aufpop-
//  Keyframes (`translate(-50%, -50%) scale() rotate()`) aus dem Bild geschoben und lag als dunkler Raster-Fleck oben links über der Kopfleiste; die Zeiger standen auf 11:00 statt 11:55.
//  JETZT: EINE Leinwand über `.board-center`, Zelle = Hero-Pixel (S = max(2, round(Hero-Pixel)), `ppFx57HeldPixel`), Farben aus der Palette (`ppSnapRgb`), nur Bayer-Dithering (kein Alpha, keine Verläufe, keine
//  Drehung/Skalierung): Zifferblatt als Zellen-Sprite (Rand, Goldreif, Ziffernblatt mit römischen Ziffern aus einer 3×5-Schrift, Striche), Zeiger als ganzzahlige Linien (Minutenzeiger in fünf Rasten 11:55 → 12:00,
//  Stundenzeiger 11:55 → 12:00), Auftauchen/Verschwinden als Bayer-Auflösung, Glockenschlag als gerasterte Ringe + Aufblitzen, Abdunkler als gerasterter Vignetten-Verlauf (Dithering).
//  ABLAUF (2,3 s, wie bisher; Ton `ev_big_gwen_clock`: Tick 0 / 0,5 s, Schlag 0,9 s): 0–0,4 Auflösung ein · Rasten bei 0,2/0,4/0,6/0,8/1,0 s · Schlag 0,95–1,5 s · ab 1,6 s Goldrand-Pulse + Auflösung aus.
//  Gezeichnet wird nur bei Bildwechsel (30 Hz, `ppTaktRaf`); die Leinwand wird nach der Animation entfernt. Rückfall (Animationen aus, Retro, `__ppFxAlt`, reduzierte Bewegung, keine Palette): `ppFx58BigGwenStart()`
//  gibt `false` zurück, app-board.jsx zeigt dann die alte DOM-Fassung. `window.__ppFx58Aus = true` erzwingt das; `window.__ppFx58Zeiten` (Array vor dem Start gesetzt) sammelt die Zeichenzeit je Bild in ms.
// ═════════════════════════════════════════════════════════════════
(function (root) {
  const rd = Math.round, fl = Math.floor;
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const HEX = {
    vig: '#1f0f04', holz: '#270d0c', braun: '#5a341a', braunH: '#72541d',
    g0: '#a87c00', g1: '#c68206', g2: '#ffb91a', g3: '#ffe23d', g4: '#fff196',
    s0: '#d1a148', s1: '#e0c085', c0: '#f9ecb3', c1: '#fff8e8', glanz: '#fffbd2',
    tinte: '#12101f',
  };
  const memo = new Map();
  const farbe = (hex) => {   // packt eine Palettenfarbe als Little-Endian-RGBA (Uint32)
    if (memo.has(hex)) return memo.get(hex);
    const h = hex.replace('#', ''); let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    if (typeof root.ppSnapRgb === 'function') { const p = root.ppSnapRgb(r, g, b); r = p[0]; g = p[1]; b = p[2]; }
    const v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; memo.set(hex, v); return v;
  };
  // 3×5-Schrift für römische Ziffern
  const GL = { I: ['111', '010', '010', '010', '111'], V: ['101', '101', '101', '101', '010'], X: ['101', '101', '010', '101', '101'] };
  const ZIFFERN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

  /** Zifferblatt-Sprite (D × D Zellen, 0 = leer). */
  function bauenZifferblatt(D) {
    const sp = new Uint32Array(D * D), c = (D - 1) / 2, R = D / 2;
    const C = {}; for (const k in HEX) C[k] = farbe(HEX[k]);
    const reif = [C.braunH, C.g0, C.g1, C.g2, C.g3, C.g4], blatt = [C.s0, C.s1, C.c0, C.c1];
    const waehle = (tabelle, L, x, y) => { const f = cl(L) * (tabelle.length - 1), i = fl(f); return tabelle[Math.min(tabelle.length - 1, i + ((f - i) > BAY[y & 3][x & 3] / 16 ? 1 : 0))]; };
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const dx = x - c, dy = y - c, d = Math.sqrt(dx * dx + dy * dy); if (d > R - 0.3) continue;
      const lit = d > 0.5 ? (-dx - dy) / (d * 1.4142) : 0;
      let col;
      if (d > R - 3) col = C.holz;                                                  // äußerer Rand
      else if (d > R - 8) col = waehle(reif, 0.5 + 0.45 * lit, x, y);              // Goldreif (Licht von links oben)
      else if (d > R - 10.5) col = C.braun;                                          // dunkler Innenring
      else col = waehle(blatt, 0.62 + 0.22 * lit - 0.3 * (d / R) * (d / R), x, y);  // Ziffernblatt
      sp[y * D + x] = col;
    }
    const block = (x0, y0, w, h, col) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const X = rd(x0 + x), Y = rd(y0 + y); if (X >= 0 && Y >= 0 && X < D && Y < D) sp[Y * D + X] = col; } };
    // Stundenstriche (Viertel kräftiger)
    const tk = Math.max(2, rd(D / 40));
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, rr = R - 12.5 - tk, vier = i % 3 === 0, t = vier ? tk + 1 : tk;
      for (let s = 0; s < t + 2; s++) { const q = rr + s * 0.9; block(c + Math.sin(a) * q - t / 2 + 0.5, c - Math.cos(a) * q - t / 2 + 0.5, t, t, C.holz); }
    }
    // Ziffern
    const gs = D >= 160 ? 2 : 1, gap = 1;   // Ziffern (VIII = 15 Zellen breit) müssen nebeneinander auf den Ziffernkreis passen
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, z = ZIFFERN[i], w = z.length * 3 * gs + (z.length - 1) * gap, h = 5 * gs, q = R * 0.64;
      const ox = c + Math.sin(a) * q - w / 2, oy = c - Math.cos(a) * q - h / 2;
      for (let k = 0; k < z.length; k++) { const g = GL[z[k]]; for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (g[yy][xx] === '1') block(ox + k * (3 * gs + gap) + xx * gs, oy + yy * gs, gs, gs, C.tinte); }
    }
    return sp;
  }

  /** Dicke Linie aus ganzzahligen Quadraten (Zeiger). */
  function linie(setze, x0, y0, x1, y1, t) {
    const n = Math.max(1, rd(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) setze(rd(x - t / 2 + a + 0.01), rd(y - t / 2 + b + 0.01)); }
  }

  /** Spielstart der Aktivierung. `true` = läuft als Leinwand, `false` = Rückfall (alte DOM-Fassung). */
  root.ppFx58BigGwenStart = function () {
    try {
      if (root.__ppFx58Aus || root.__ppFxAlt || root._playAnimations === false || root.PP_RETRO || typeof root.ppSnapRgb !== 'function') return false;
      if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      const bc = document.querySelector('.board-center'); if (!bc) return false;
      const r = bc.getBoundingClientRect(); if (!(r.width > 60 && r.height > 60)) return false;
      const zone = document.querySelector('[data-hero-zone]');
      let hp = 2.8125; try { if (typeof root.ppFx57HeldPixel === 'function') hp = root.ppFx57HeldPixel(zone, zone ? zone.getBoundingClientRect().width : 66).px || hp; } catch (e) { /* Standard */ }
      let S = Math.max(2, rd(hp)); while ((r.width / S) * (r.height / S) > 140000) S++;
      const W = Math.ceil(r.width / S), H = Math.ceil(r.height / S);
      const D = Math.max(40, Math.min(rd(Math.min(420, Math.min(r.width, r.height) * 0.72) / S), Math.min(W, H) - 4)) | 1;   // ungerade: Mitte = Zelle
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.setAttribute('data-pp-px', 'aus'); cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = `position:fixed;left:${rd(r.left)}px;top:${rd(r.top)}px;width:${W * S}px;height:${H * S}px;pointer-events:none;z-index:10021;image-rendering:pixelated;`;
      const g = cv.getContext('2d'); if (!g) return false;
      const img = g.createImageData(W, H), buf = new Uint32Array(img.data.buffer);
      const C = {}; for (const k in HEX) C[k] = farbe(HEX[k]);
      const sprite = bauenZifferblatt(D), cx = (W - 1) / 2, cy = (H - 1) / 2, R = D / 2;
      const ox = rd(cx - (D - 1) / 2), oy = rd(cy - (D - 1) / 2);
      // Vignette: Dichte je Zelle (0–15) im Verlauf Mitte → Rand (wie der frühere Abdunkler: 45 % → 15 % bei 60 % → 0 bei 90 %)
      const vth = new Uint8Array(W * H), rx = W / 2, ry = H / 2;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2); const k = d < 0.6 ? 0.45 - (d / 0.6) * 0.30 : (d < 0.9 ? 0.15 * (1 - (d - 0.6) / 0.3) : 0); vth[y * W + x] = rd(k * 16); }
      const vigCache = new Uint32Array(W * H); let vigLv = -1;
      const vig = (lv) => { if (lv === vigLv) return; vigLv = lv; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; vigCache[i] = (vth[i] * lv / 16 > BAY[y & 3][x & 3] && vth[i] > 0) ? C.vig : 0; } };
      const zeiten = Array.isArray(root.__ppFx58Zeiten) ? root.__ppFx58Zeiten : null;
      const dauer = 2.3, t0 = performance.now(); let letzte = -1, id = 0, fertig = false;
      const raf = root.ppTaktRaf || root.requestAnimationFrame;
      const ende = () => { if (fertig) return; fertig = true; if (id) { try { cancelAnimationFrame(id); } catch (e) { /* weg */ } } cv.remove(); };
      const zeichne = (t) => {
        const lvIn = Math.min(16, fl(t / 0.4 * 16)), lvOut = t >= 1.6 ? Math.max(0, 16 - fl((t - 1.6) / 0.6 * 16)) : 16, lv = Math.min(lvIn, lvOut);
        vig(lv); buf.set(vigCache);
        const set = (x, y, col) => { if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = col; };
        const zeigt = (x, y) => BAY[y & 3][x & 3] < lv;
        // Zifferblatt
        for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) { const v = sprite[y * D + x]; if (v && zeigt(ox + x, oy + y)) buf[(oy + y) * W + ox + x] = v; }
        // Aufblitzen des Schlags (Bayer-Schleier aus Glanz über dem Blatt, nimmt ab)
        const tb = t - 0.95;
        if (tb >= 0 && tb < 0.3) {
          const dens = 9 * (1 - tb / 0.3);
          for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) if (sprite[y * D + x] && BAY[(oy + y) & 3][(ox + x) & 3] < dens && zeigt(ox + x, oy + y)) buf[(oy + y) * W + ox + x] = ((x + y) & 1) ? C.glanz : C.g4;
        }
        // Zeiger: Minutenzeiger in fünf Rasten (55 → 60 min), Stundenzeiger 11:55 → 12:00 (2,5° → 0°)
        const k = Math.min(5, fl(t / 0.2)), am = (-30 + 6 * k) * Math.PI / 180, ah = (-2.5 + 0.5 * k) * Math.PI / 180;
        const zs = (x, y) => { if (zeigt(x, y)) set(x, y, C.tinte); };
        const th = Math.max(3, rd(D / 30)), tm = Math.max(2, rd(D / 46));
        linie(zs, cx, cy, cx + Math.sin(ah) * R * 0.5, cy - Math.cos(ah) * R * 0.5, th);
        linie(zs, cx, cy, cx + Math.sin(am) * R * 0.76, cy - Math.cos(am) * R * 0.76, tm);
        const pr = Math.max(3, rd(D / 20));   // Nabe
        for (let y = -pr; y <= pr; y++) for (let x = -pr; x <= pr; x++) { const d = Math.sqrt(x * x + y * y); if (d <= pr && zeigt(rd(cx) + x, rd(cy) + y)) set(rd(cx) + x, rd(cy) + y, d > pr - 1.5 ? C.braun : (d > pr * 0.45 ? C.g3 : C.g1)); }
        // Glockenschlag: zwei gerasterte Ringe (Dichte nimmt ab)
        for (const [vz, grad] of [[0, 0], [0.12, 1]]) {
          const p = (t - 0.95 - vz) / 0.55; if (p <= 0 || p >= 1) continue;
          const rr = R * (0.25 + p * 1.15), dn = (1 - p) * 16, dt = 1.2 + (1 - p) * 1.6;
          const x0 = Math.max(0, fl(cx - rr - dt - 1)), x1 = Math.min(W - 1, Math.ceil(cx + rr + dt + 1)), y0 = Math.max(0, fl(cy - rr - dt - 1)), y1 = Math.min(H - 1, Math.ceil(cy + rr + dt + 1));
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2); if (Math.abs(d - rr) <= dt && BAY[y & 3][x & 3] < dn) buf[y * W + x] = grad ? C.g3 : C.glanz; }
        }
        // Verschwinden: Goldrand-Pulse (harte Ringe, ganze Zellen)
        if (t >= 1.6 && t < 1.95) { const st = fl((t - 1.6) / 0.07), rr = R + 1.5 + st * 2.2; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2); if (Math.abs(d - rr) < 1.2 && BAY[y & 3][x & 3] < 12) buf[y * W + x] = C.g2; } }
        g.putImageData(img, 0, 0);
      };
      const tick = () => {
        id = 0; if (fertig) return;
        const t = (performance.now() - t0) / 1000;
        if (t >= dauer) { ende(); return; }
        const fi = fl(t * 30);
        if (fi !== letzte) { letzte = fi; const a = performance.now(); try { zeichne(t); } catch (e) { console.error('[fx58] zeichnen fehlgeschlagen', e); ende(); return; } if (zeiten) zeiten.push([+t.toFixed(3), +(performance.now() - a).toFixed(2)]); }
        id = raf(tick);
      };
      document.body.appendChild(cv);
      zeichne(0); id = raf(tick);
      setTimeout(ende, dauer * 1000 + 200);
      return true;
    } catch (e) { console.error('[fx58] Start fehlgeschlagen', e); return false; }
  };
})(window);
