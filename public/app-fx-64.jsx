// app-fx-64: Stun-Sterne — vier Pixelsterne kreisen über dem Kopf jedes betäubten Helden, solange der Status `stunned` aktiv ist (EINE kleine Leinwand je Held, 30-Hz-Takt)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Trailer (shot01.js, Szene „Heavy Hit auf Mini“, Zug 8e „Betäubung: kreisende Sterne über dem Kopf“):
//    4 Sterne im Abstand von 90°, Winkel w = 5,5 rad/s (Umlauf 1,14 s), Ellipse (Halbachsen 17 × 5 Trailer-Bildpunkte ≈ 1 : 0,3), Mittelpunkt ≈ 5 Sprite-Pixel ÜBER der Figurenoberkante.
//    Die vorderen Sterne (unterer Halbkreis, sin ≥ 0) in vollem Gelb, die hinteren (oberer Halbkreis) dunkler; hinten zuerst gemalt. Alle Sterne gleich groß, volle Deckkraft (kein Alpha, kein Verlauf).
//  Sternbild: das 7×7-Sprite des Tigertritts (app-fx-63.jsx, `STAR7`: Gelb, Weiß im Kern, Orange als Schatten) — beide Stellen sind dieselbe Stun-Optik. Die Zeichenfolge steht hier doppelt
//    (app-fx-63 hält sie privat); wer das Sprite ändert, ändert beide. `window.__ppFx64Plus = true` (nur Tests/Vergleich) zeichnet stattdessen die Kreuzsterne des Trailers (Plus mit dunkler Kontur).
//  Zeigen: `HeroIdleSprite` (app-board.jsx) rendert `<PpFx64Sterne>` im `.hero-idle-holo` der Figur, solange `hero.statuses.stunned` gilt (nicht bei Versteinerung); die alten Blitze (`hfx-blitz`)
//    entfallen dann. Steht die Leinwand im Holo, macht sie Quetschen / Einfahren / Aufstiegs-Pose der Figur mit; stirbt der Held oder wird die Figur ausgehängt, geht sie mit.
//  AUSLÖSEN: wechselt der Status während der Darstellung auf `stunned` (nicht beim Laden/Neuaufbau eines schon betäubten Helden), läuft 10 Bilder lang (⅓ s) ein auffälligerer Auftritt:
//    die Sterne schrauben sich von 1,9 × Radius ein (gelbweißer Blitz in Bild 0–1) und acht kleine Kreuz-Funken fliegen aus der Kopfmitte nach außen. Danach der Dauerlauf.
//  PIXELGRÖSSE: die Leinwand hat das Raster des Heldensprites (1 Leinwandpunkt = 1 Sprite-Pixel, `image-rendering: pixelated`, gleiche Skalierung wie `.hero-idle-canvas`) — Rasterzelle = Hero-Pixel
//    exakt, Bewegung in ganzen Sprite-Pixeln im Bildtakt. Palette: feste Palettenfarben (`ppSnapRgb`).
//  KOSTEN: ALLE Leinwände teilen EINEN Takt (`ppTaktRaf`, ein Rückruf je 1/30 s); gemalt wird nur, solange die Leinwand sichtbar ist (IntersectionObserver); je Bild ein `clearRect` und
//    vier `drawImage` kleiner Vorlagen (9×9) — kein Layout lesen, kein DOM anfassen, nichts im Leerlauf ohne betäubten Helden (Takt hält an, sobald keine Leinwand mehr hängt).
//  Rückfall auf die alten Blitze (`hfx-blitz`): Retro (`PP_RETRO`), reduzierte Bewegung, Animationen aus (`_playAnimations === false`), `window.__ppFxAlt`, Kill-Switch `window.__ppFx64Aus`, keine Palette.
//  Messung (nur Tests): `window.__ppFx64Messen = true` → `window.__ppFx64Zeiten` = Dauer je Takt in ms, `window.__ppFx64Anzahl` = Zahl der Leinwände.
// ═════════════════════════════════════════════════════════════════
(function (root) {
  const TAKT = 1000 / 30;
  const STAR7 = ['...Y...', '..YWY..', 'YYYWYYy', '.YWWWy.', '..YYYy.', '.YYyYy.', '.Yy.yy.'];        // identisch mit STAR7 in app-fx-63.jsx
  // Nutzer-Feedback (13.11.): die 7×7-Sterne waren zu groß → hier 5×5 (Tigertritt, app-fx-63, behält sein 7×7-Sprite; `window.__ppFx64Gross = true` schaltet die 7×7 wieder ein)
  const STAR5 = ['..Y..', '.YWY.', 'YYWYy', '.YYy.', '.Y.y.'];
  const PLUS = ['.......', '...Y...', '...Y...', '.YYWYY.', '...Y...', '...Y...', '.......'];                // Trailer: Kreuz aus 5 × 1 + 1 × 5 Gelb, Kern Cremeweiß; die dunkle Kontur kommt aus `mach`
  const W_RAD = 5.5;                                // rad/s (Trailer: w = dt · 5,5)
  const INTRO = 10;                                 // Bilder des Auslöse-Auftritts
  const rd = Math.round, mx = Math.max, mn = Math.min;

  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const snap = (h) => { const c = hex(h); try { return root.ppSnapRgb ? root.ppSnapRgb(c[0], c[1], c[2]) : c; } catch (e) { return c; } };

  /** Kleine Vorlagen (Leinwände 9×9 mit Kontur), einmal gebaut: vorn / hinten / Blitz (Auslösen). */
  let VORLAGEN = null, VORLAGEN_PLUS = false;
  function vorlagen() {
    const plus = !!root.__ppFx64Plus;
    if (VORLAGEN && VORLAGEN_PLUS === plus) return VORLAGEN;
    const Y = snap('#ffe23d'), O = snap('#ff9a1a'), Wh = [255, 255, 255], Cr = snap('#fffbd2'), K = snap('#12101f');
    const Yb = snap('#c79e05'), Ob = snap('#aa5300');
    const sets = plus ? {
      vorn: { Y, W: Cr }, hinten: { Y: Yb, W: Cr }, blitz: { Y: Cr, W: Wh },
    } : {
      vorn: { Y, y: O, W: Wh }, hinten: { Y: Yb, y: Ob, W: Cr }, blitz: { Y: Cr, y: Y, W: Wh },
    };
    const rows = plus ? PLUS : (root.__ppFx64Gross ? STAR7 : STAR5), RN = rows.length, RO = (9 - RN) >> 1;
    const mach = (pal) => {                                                    // 9×9: das 5×5-Sprite (7×7 nur mit `__ppFx64Gross`) in der Mitte, rundum 1 Zelle dunkle Kontur (wie im Trailer: lesbar auf jedem Untergrund)
      const cv = document.createElement('canvas'); cv.width = 9; cv.height = 9;
      const g = cv.getContext('2d'), id = g.createImageData(9, 9), has = new Uint8Array(81);
      const put = (x, y, c) => { const i = (y * 9 + x) * 4; id.data[i] = c[0]; id.data[i + 1] = c[1]; id.data[i + 2] = c[2]; id.data[i + 3] = 255; has[y * 9 + x] = 1; };
      for (let y = 0; y < RN; y++) for (let x = 0; x < RN; x++) { const c = pal[rows[y][x]]; if (c) put(x + RO, y + RO, c); }
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
        if (has[y * 9 + x]) continue;
        let nb = false; for (let dy = -1; dy <= 1 && !nb; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < 9 && yy < 9 && has[yy * 9 + xx] === 1) { nb = true; break; } }
        if (nb) { const i = (y * 9 + x) * 4; id.data[i] = K[0]; id.data[i + 1] = K[1]; id.data[i + 2] = K[2]; id.data[i + 3] = 255; has[y * 9 + x] = 2; }
      }
      g.putImageData(id, 0, 0);
      return cv;
    };
    // Kreuz-Funke (3×3, Cremeweiß) für den Auslöse-Auftritt
    const fk = document.createElement('canvas'); fk.width = 3; fk.height = 3;
    { const g = fk.getContext('2d'), id = g.createImageData(3, 3); for (const [x, y] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) { const i = (y * 3 + x) * 4; id.data[i] = Cr[0]; id.data[i + 1] = Cr[1]; id.data[i + 2] = Cr[2]; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); }
    VORLAGEN_PLUS = plus;
    return (VORLAGEN = { vorn: mach(sets.vorn), hinten: mach(sets.hinten), blitz: mach(sets.blitz), funke: fk });
  }

  /** Läuft die neue Fassung? Sonst bleiben die alten Blitze (`hfx-blitz`). */
  function aktiv() {
    try {
      if (root.__ppFx64Aus || root.__ppFxAlt || root._playAnimations === false || root.PP_RETRO || typeof root.ppSnapRgb !== 'function') return false;
      if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch (e) { /* weiter */ }
    return true;
  }

  /**
   * Maße der Leinwand: Mitte über dem Kopf, Radius nach Kopfbreite. Einmal je Figur (`kern`, `mitteX` aus HeroIdleSprite).
   * Raster: `zf` Sprite-Pixel je Leinwandzelle. Normal 1 (Zelle = Sprite-Pixel = Hero-Pixel). Hat das Sheet einen kleineren Maßstab (`boardScale`, Bubbles 0,5), wäre ein Sprite-Pixel nur halb so groß wie
   * der Standard-Hero-Pixel und die Sterne winzig: dann ist eine Zelle `zf` = round(1 / boardScale) Sprite-Pixel, also wieder genau ein Standard-Hero-Pixel (alle Sterne gleich groß).
   * Kopfoberkante: `kern.oben` (HeroIdleAnims.kernRahmen: erste Zeile über der Gesichtsspalte, die in der Hälfte der Bilder eine Mindestbreite deckender Pixel hat), nicht `y0` (ein einzelner Pixel setzt es zu hoch) und nicht `faceY` (bei hohen Körpern mitten im Körper).
   */
  function geometrie(kern, mitteX, zf) {
    zf = zf > 1 ? zf : 1;
    const cx = rd(mitteX / zf);
    const kopfHalb = mn(14, mx(4, ((kern.kopfX1 || 0) > mitteX ? (kern.kopfX1 - mitteX) / zf : (kern.x1 - kern.x0) * 0.25 / zf)));
    const rx = mn(19, mx(8, rd(kopfHalb * 1.15 + 3)));                    // mit den 5×5-Sternen etwas enger als vorher (1,3·+4, min. 9): die Bahn bleibt am Kopf
    const ry = mx(3, rd(rx * 0.3));
    let oben = typeof kern.oben === 'number' ? kern.oben : kern.y0;
    if (typeof kern.kopfY === 'number') oben = mn(oben, kern.kopfY - 4);      // die Kopfoberkante liegt über der Gesichtsmitte (`faceY`), nie darunter (Brackle: Kopf wippt)
    const cy = rd(oben / zf) - 3;
    const hb = rd(rx * 1.9) + 6, hh = rd(ry * 1.9) + 6;                  // Platz für den Auftritt (1,9 × Radius) samt halber Sternbreite
    return { cx, cy, rx, ry, w: 2 * hb + 1, h: 2 * hh + 1, ox: hb, oy: hh, links: cx - hb, oben: cy - hh, zf };
  }

  // ───────── gemeinsamer Takt ─────────
  const liste = new Set();
  let raf = 0;
  function zeichne(o, t) {
    const g = o.g, V = o.v, cx = o.ctx;
    cx.clearRect(0, 0, g.w, g.h);
    const f = mx(0, Math.floor((t - o.t0) / TAKT));
    const intro = o.intro && f < INTRO;
    const u = intro ? f / INTRO : 1;
    const e = 1 - (1 - u) * (1 - u);                                      // schnell, dann ruhig (ease-out)
    const faktor = intro ? 1.9 - 0.9 * e : 1;
    const rx = rd(g.rx * faktor), ry = rd(g.ry * faktor);
    // Winkel: Takt des Trailers (5,5 rad/s); im Auftritt dreht es anfangs schneller
    const w = o.phase + (t / 1000) * W_RAD + (intro ? (1 - e) * 1.6 : 0);
    const blitz = intro && f < 2;
    for (const pass of [0, 1]) for (let k = 0; k < 4; k++) {
      const a = w + k * Math.PI / 2, sn = Math.sin(a);
      if ((sn >= 0) !== (pass === 1)) continue;
      const x = g.ox + rd(Math.cos(a) * rx), y = g.oy + rd(sn * ry);
      cx.drawImage(blitz ? V.blitz : (pass === 1 ? V.vorn : V.hinten), x - 4, y - 4);
    }
    if (intro && f < 8) {                                                 // acht Kreuz-Funken fliegen aus der Kopfmitte nach außen
      const rr = rd(g.rx * (0.5 + f * 0.28));
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.3; cx.drawImage(V.funke, g.ox + rd(Math.cos(a) * rr) - 1, g.oy + rd(Math.sin(a) * rr * 0.6) - 1); }
    }
  }
  function takt(t) {
    raf = 0;
    const mess = root.__ppFx64Messen ? performance.now() : 0;
    for (const o of liste) if (o.sichtbar) { try { zeichne(o, t); } catch (e) { /* weiter */ } }
    if (mess) { (root.__ppFx64Zeiten || (root.__ppFx64Zeiten = [])).push(+(performance.now() - mess).toFixed(3)); root.__ppFx64Anzahl = liste.size; }
    if (liste.size) raf = (root.ppTaktRaf || root.requestAnimationFrame)(takt);
  }
  function an(o) { liste.add(o); if (!raf) raf = (root.ppTaktRaf || root.requestAnimationFrame)(takt); }
  function ab(o) { liste.delete(o); if (!liste.size && raf) { try { root.cancelAnimationFrame(raf); } catch (e) { /* weg */ } raf = 0; } }

  /**
   * Die Sterne eines betäubten Helden. Props: `kern`, `mitteX` (Sprite-Raster, wie HeroIdleSprite), `s` (Kartenpixel je Sprite-Pixel), `intro` (Status wurde eben gesetzt).
   * Lage: absolut im Steher der Figur (links/oben in Sprite-Pixeln × `--board-scale`).
   */
  function PpFx64Sterne({ kern, mitteX, s, intro, zf }) {
    const ref = React.useRef(null);
    const g = React.useMemo(() => geometrie(kern, mitteX, zf), [kern, mitteX, zf]);
    const px = (n) => `calc(${+(n * (g.zf || 1) * s).toFixed(3)}px * var(--board-scale))`;
    const introEinmal = React.useRef(!!intro);
    React.useEffect(() => {
      const cv = ref.current; if (!cv) return undefined;
      const intro0 = introEinmal.current; introEinmal.current = false;      // der Auftritt läuft nur beim ersten Aufbau nach dem Statuswechsel
      const o = { g, ctx: cv.getContext('2d'), v: vorlagen(), t0: performance.now(), phase: Math.random() * Math.PI * 2, intro: intro0, sichtbar: true };
      o.ctx.imageSmoothingEnabled = false;
      let io = null;
      try { if (typeof IntersectionObserver !== 'undefined') { io = new IntersectionObserver((es) => { for (const e of es) o.sichtbar = e.isIntersecting; }); io.observe(cv); } } catch (e) { io = null; }
      // Ragt der Kopf über den oberen Rand der sichtbaren Fläche (Argos in der Gegnerreihe), rutscht die Leinwand nach unten, bis die obersten Sterne im Fenster liegen (einmal beim Aufbau und bei Größenänderung — kein Layout im Takt)
      const halten = () => {
        try {
          cv.style.top = px(g.oben);
          const r = cv.getBoundingClientRect(); if (!(r.height > 0)) return;
          // obere Grenze = Fensterrand ODER die Oberkante des nächsten beschneidenden Vorfahren (die Sprite-Ebene endet an der Brettkante: Köpfe darüber werden abgeschnitten, auch die Sterne)
          let grenze = 0;
          for (let e = cv.parentElement; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.overflowY !== 'visible' || (cs.clipPath && cs.clipPath !== 'none' && !/inset\(-/.test(cs.clipPath))) grenze = mx(grenze, e.getBoundingClientRect().top); }
          const zelle = r.height / g.h, hoch = r.top + (g.oy - g.ry - 4) * zelle, rand = grenze + 6;
          if (hoch < rand) cv.style.top = px(g.oben + Math.ceil((rand - hoch) / zelle));
        } catch (e) { /* ohne */ }
      };
      // Messen erst nach dem Auftauchen der Figur (`heroHoloAuftauchen` skaliert das Holo 0,36 s lang)
      const tHalten = setTimeout(halten, 700); root.addEventListener('resize', halten);
      zeichne(o, performance.now());                                      // sofort ein erstes Bild (kein leeres Bild bis zum nächsten Takt)
      an(o);
      return () => { ab(o); clearTimeout(tHalten); root.removeEventListener('resize', halten); if (io) io.disconnect(); };
    }, [g, s]);
    return <canvas ref={ref} width={g.w} height={g.h} aria-hidden="true" data-pp-px="aus" className="hero-idle-sterne"
      style={{ position: 'absolute', left: px(g.links), top: px(g.oben), width: px(g.w), height: px(g.h), imageRendering: 'pixelated', pointerEvents: 'none', display: 'block' }} />;
  }

  root.ppFx64Aktiv = aktiv;
  root.PpFx64Sterne = PpFx64Sterne;
  root.PpFx64 = { aktiv, geometrie, vorlagen, zeichne, liste };
})(window);
