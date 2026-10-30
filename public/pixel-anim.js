'use strict';
// ═══════════════════════════════════════════════════════════════════════════════════════════
//  PIXEL-ANIMATION (W86z) — die zentrale Pixelart-Pipeline fuer BEWEGUNG
//
//  Al: ALLE Animationen im Spiel sind Pixelart.  Dieses Modul macht aus jeder CSS-/WAAPI-Animation und jedem CSS-Uebergang
//  eine Bildfolge im 30-Bilder-Takt, deren Einzelbilder pixelkonform sind — ohne dass die Animation einzeln angefasst wird:
//
//    Takt         Bewegung in festen Bildern (30/s, global im Gleichschritt), jedes Bild ein gehaltener Wert (`steps(1)`).
//    Fade         Deckkraft (`opacity`) wird ein Bayer-Dither (4x4, Zellen aus Kunstpixeln, 8 Stufen): Maske statt Alpha.
//    Skalierung   `scale` landet auf Vielfachen von 1/raster (Kunstpixel = ganze Bildschirmpixel), an der Oberflaeche auf ganzen Groessen.
//    Verschiebung `translate` landet auf ganzen Kunstpixeln (PX = 2 CSS-px, wie `PP_PX_GROESSE` des Pixelierers; Szenen: `--pp-raster`).
//    Drehung      Blattelemente aus Pixelbildern werden je Winkelstufe ins Kunstpixelraster neu gesampelt (RotSprite-artig,
//                 siehe `drehen`); alles andere dreht nur in Viertelschritten (0/90/180/270 Grad: verlustfrei).
//    Farbe        Farben der Bildfolge rasten auf die 256er-Palette (window.ppSnapCss, palette.js); Schein-Schatten werden harte Ringe.
//
//  WIE (Kurzfassung — Details in cards/effects/CARD_API.md, Abschnitt „Welle 86 / W86z"):
//    • `PPPixelAnim.backenAlle(wurzel)` — alle Animationen unter `wurzel` jetzt umbauen (Pixelierer + Registry rufen das);
//      `anhaengen(wurzel)` betreut eine Wurzel dauerhaft (Areas).
//    • Dokumentweit (`global()`, beim Laden): `animationstart` / `transitionrun` und `Element.prototype.animate` backen Animationen und
//      Uebergaenge, die irgendwo im Spiel starten (Menues, Kampfbrett, Zielmarkierungen, Statusanzeigen …) — ohne MutationObserver ueber das
//      ganze Dokument.
//    • Eine Animation „backen" heisst: ihre Bilder werden an einer Probe-Animation (gleiche Keyframes, WAAPI) im 30-Hz-Raster
//      abgetastet (`getComputedStyle`), die Werte quantisiert und als neue Keyframes (`effect.setKeyframes`) eingesetzt.
//      Dauer, Fuellmodus, Richtung, Wiederholung und Ereignisse bleiben; Delay und Dauer rutschen auf ganze Takte (hoechstens ~17 ms).
//    • Ausnahme: `data-pp-px="aus"` an einem Vorfahren (schon handgemachte Pixelart), Retro-Modus (`PP_RETRO`: hat eigene Pipeline).
//
//  CSS-HILFSSET (reines CSS, ohne JS-Aufruf): `--pp-dither-1 … --pp-dither-15` (Masken-Bilder), `.pp-dither-N`, die Keyframes
//  `ppFadeIn` / `ppFadeOut` / `ppFadeInOut` und die Klassen `.pp-fade-in|out|inout` (Dauer `--pp-fade-ms`) — fuer statische Keyframes.
//
//  Reine Funktionen (kein DOM) stehen unter `PPPixelAnim.rein` und werden in test/pixel-anim.test.js geprueft.
// ═══════════════════════════════════════════════════════════════════════════════════════════
(function (root) {
  const KONFIG = {
    takt: 30,            // Bilder pro Sekunde
    px: 2,               // Kunstpixel in CSS-px (== PP_PX_GROESSE in app-shared.jsx); Szenen mit eigenem Raster: Variable --pp-raster
    maxBilder: 90,       // Obergrenze gehaltener Bilder je Animation und Durchlauf (lange Schleifen laufen dann langsamer als 30 Hz)
    budget: 7000,        // Abtastungen je backenAlle()-Aufruf (Schutz fuer Szenen mit hunderten Elementen)
    drehStufe: 15,       // Winkelraster (Grad) fuer ANIMIERTE Drehungen mit Sprite; ruhende Drehungen: 1 Grad
    ssK: 3,              // Supersampling je Achse beim Neusampeln gedrehter Sprites
    spriteMax: 400,      // groesste Kantenlaenge (Kunstpixel) eines gedrehten Sprites; darueber: Viertelschritt-Rueckfall
    ditherPx: 2,         // Zelle der Dithermaske in CSS-px
    ditherSchritt: 2,    // Dither-Stufen der ANIMIERTEN Deckkraft: 1 = alle 16, 2 = 8 Stufen (halb so viele Stilwechsel je Fade; Standard)
    dither: true,        // false: Deckkraft nur ein/aus (ab 50 %), keine Masken (Messung/Notbremse)
    ditherMin: 400,      // Elemente mit kleinerer Flaeche (px², z. B. 20 x 20) blenden nur ein/aus statt zu dithern (billiger, bei Partikeln unsichtbar; 0 = alle dithern)
    globalMaxBilder: 40, // dokumentweit (Oberflaeche): hoechstens so viele Bilder je Durchlauf (Umgebungsteilchen mit langen Schleifen laufen dann ~10 Bilder/s)
    sofortMs: 10,        // dokumentweit: Zeitfenster (ms je Takt) fuer sofortiges Backen einmaliger Animationen mit vielen Abtastungen (W86u1)
    globalSofort: 14,    // dokumentweit: Animationen mit mehr Abtastungen werden in Zeitscheiben (~6 ms je ~30 ms) nachgebacken statt sofort
    stufenMax: 800,      // Szenen: reine Stufenfolgen (`steps(n)`) bis zu so vielen Stufen je Durchlauf werden exakt an den Stufengrenzen gebacken
    globalMaxDauer: 8000,// dokumentweit (Oberflaeche) werden nur Animationen/Uebergaenge bis zu dieser Dauer (ms) gebacken (Countdown-Balken u. ae. bleiben)
    direkt: true,        // Blaetter ohne Kinder animieren `mask-image` selbst statt ueber eine vererbte Variable
    hauptfaden: true,    // W86p: gebackene Animationen mit einer wirkungslosen, nicht kompositierbaren Eigenschaft (scroll-margin-top, wechselt je Bild) auf den Hauptthread zwingen —
                         // Compositor-Animationen malen die Ebene mit festem Raster und skalieren/verschieben sie bilinear: Mischfarben und Halbalpha an jeder Kante (Palettenverstoss)
    aktiv: true,
  };
  const TAKT_MS = () => 1000 / KONFIG.takt;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rund4 = (v) => Math.round(v * 10000) / 10000;

  // ════════════════════════════════════════════════════════════════════════
  //  1) REINE FUNKTIONEN
  // ════════════════════════════════════════════════════════════════════════
  const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  /** Deckkraft 0..1 → Dither-Stufe 0..16 (0 = unsichtbar, 16 = voll; dazwischen Bayer-Raster 1..15). */
  function ditherStufe(a) {
    if (!(a > 0)) return 0;
    if (a >= 1) return 16;
    if (a < 1 / 32) return 0;
    if (a > 31 / 32) return 16;
    return clamp(Math.round(a * 16), 1, 15);
  }
  /** Ist Pixel (x, y) bei Stufe `stufe` (0..16) gesetzt? */
  const ditherAn = (stufe, x, y) => BAYER4[y & 3][x & 3] < stufe;

  /** Dither-Kachel als SVG-Text (4x4 Zellen a `zelle` px, scharfkantig); gesetzte Zellen deckend, Rest leer. */
  function ditherKachelSvg(stufe, zelle, farbe) {
    zelle = zelle || KONFIG.ditherPx;
    const g = 4 * zelle;
    const fuell = farbe ? ` fill='${farbe}'` : '';
    let r = '';
    for (let y = 0; y < 4; y++) {
      let x = 0;
      while (x < 4) {
        if (!ditherAn(stufe, x, y)) { x++; continue; }
        let x2 = x; while (x2 < 4 && ditherAn(stufe, x2, y)) x2++;
        r += `<rect x='${x * zelle}' y='${y * zelle}' width='${(x2 - x) * zelle}' height='${zelle}'${fuell}/>`;
        x = x2;
      }
    }
    return `<svg xmlns='http://www.w3.org/2000/svg' width='${g}' height='${g}' shape-rendering='crispEdges'>${r}</svg>`;
  }
  const _farbKachelCache = new Map();
  /** `url(...)` einer Dither-Kachel in fester Farbe `farbe` (CSS-Farbtext, schon auf die Palette gerastet) — fuer halbdurchsichtige Hintergrundfarben. */
  function ditherFarbe(stufe, farbe) {
    const k = stufe + '|' + farbe;
    let u = _farbKachelCache.get(k);
    if (!u) {
      u = 'url("data:image/svg+xml,' + encodeURIComponent(ditherKachelSvg(stufe, KONFIG.ditherPx, farbe)) + '")';
      if (_farbKachelCache.size > 400) _farbKachelCache.clear();
      _farbKachelCache.set(k, u);
    }
    return u;
  }
  const _maskeCache = new Map();
  /** `url("data:image/svg+xml,…")` der Dither-Maske (Stufe 0..16, gemerkt). Stufe 0 = leer, 16 = voll. */
  function ditherMaske(stufe, zelle) {
    zelle = zelle || KONFIG.ditherPx;
    const k = stufe + ':' + zelle;
    let u = _maskeCache.get(k);
    if (!u) {
      u = 'url("data:image/svg+xml,' + encodeURIComponent(ditherKachelSvg(stufe, zelle)) + '")';
      _maskeCache.set(k, u);
    }
    return u;
  }

  /** Oberste Ebene an `,` trennen (Klammern/Anfuehrungszeichen beachten). */
  function listeTeilen(s) {
    const out = []; let d = 0, q = '', cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { cur += c; if (c === q && s[i - 1] !== '\\') q = ''; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(') d++; else if (c === ')') d--;
      if (c === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += c;
    }
    if (cur.trim() !== '' || out.length) out.push(cur.trim());
    return out;
  }

  /** Auf ganze Kunstpixel (Vielfache von `raster` px) runden. */
  const snapPx = (v, raster) => { const r = raster || KONFIG.px; return (v < 0 ? -1 : 1) * Math.round(Math.abs(v) / r) * r || 0; };   // spiegelsymmetrisch: -1 px und +1 px werden beide ein Kunstpixel

  /**
   * Skalierungsfaktor auf Vielfache von 1/raster legen: ein Kunstpixel (raster px) wird dann 1, 2, 3 … ganze Bildschirmpixel breit
   * (bei raster = 2: Schritte von 0,5 → Pixelgroesse 1, 2, 3 px). Gebrochene Zwischenwerte laesst der Browser weich zeichnen: eine skalierte
   * Ebene wird mit ihrer Rastergroesse gerastert und danach bilinear gestreckt — jede Pixelkante bekommt Alpha. Unter 0,25 → 0 (ausgeblendet).
   * `groessePx` bleibt fuer Aufrufer, die die Elementgroesse kennen (aktuell ungenutzt).
   */
  function snapScale(s, groessePx, raster) {
    const r = raster || KONFIG.px, a = Math.abs(s);
    if (!(a >= 0.5 / r)) return 0;
    const n = Math.max(1, Math.round(a * r));
    return (s < 0 ? -1 : 1) * n / r;
  }

  /**
   * Weiche Variante fuer Oberflaechen (Hover-Vergroesserung 1,05, atmende Pulse 1,03 …): Faktor so, dass die gezeichnete GROESSE
   * (`groessePx * s`) ein ganzes Vielfaches des Kunstpixels ist. Kleine Aenderungen bleiben sichtbar (ein 120-px-Knopf wird bei 1,04 um
   * 4 px breiter statt gar nicht), allerdings ohne die Pixelpitch-Garantie von `snapScale`. Ohne Groesse: wie `snapScale`.
   */
  function snapScaleGroesse(s, groessePx, raster) {
    const r = raster || KONFIG.px, a = Math.abs(s);
    if (!(a >= 0.02)) return 0;
    if (!(groessePx >= 4)) return snapScale(s, groessePx, r);
    const n = Math.max(1, Math.round(a * groessePx / r));
    return (s < 0 ? -1 : 1) * n * r / groessePx;
  }

  /** 2D-Matrix (CSS-Reihenfolge a b c d e f) → {tx, ty, rot (Grad), sx, sy, scherung}; null bei nicht endlicher Matrix. */
  function zerlegen(m) {
    let [a, b, c, d] = m; const tx = m[4], ty = m[5];
    if (![a, b, c, d, tx, ty].every(Number.isFinite)) return null;
    let sx = Math.hypot(a, b);
    if (sx) { a /= sx; b /= sx; }
    let sch = a * c + b * d;
    c -= a * sch; d -= b * sch;
    let sy = Math.hypot(c, d);
    if (sy) { c /= sy; d /= sy; sch /= sy; }
    if (a * d - b * c < 0) { sx = -sx; a = -a; b = -b; sch = -sch; }
    return { tx, ty, rot: Math.atan2(b, a) * 180 / Math.PI, sx, sy, sch };
  }
  /** Gegenstueck zu `zerlegen` (ohne Scherung): Matrix [a b c d e f]. */
  function zusammensetzen(z) {
    const r = z.rot * Math.PI / 180, co = Math.cos(r), si = Math.sin(r);
    return [co * z.sx, si * z.sx, -si * z.sy, co * z.sy, z.tx, z.ty];
  }
  /** `matrix(…)`/`none` → [a b c d e f]; `matrix3d` mit Bewegung nur in der Ebene wird auf 2D gekuerzt; sonst null. */
  function matrixLesen(s) {
    if (!s || s === 'none') return [1, 0, 0, 1, 0, 0];
    let m = /^matrix\(([^)]*)\)$/.exec(s);
    if (m) { const v = m[1].split(',').map(parseFloat); return v.length === 6 && v.every(Number.isFinite) ? v : null; }
    m = /^matrix3d\(([^)]*)\)$/.exec(s);
    if (m) {
      const v = m[1].split(',').map(parseFloat);
      if (v.length !== 16 || !v.every(Number.isFinite)) return null;
      if (Math.abs(v[2]) + Math.abs(v[3]) + Math.abs(v[6]) + Math.abs(v[7]) + Math.abs(v[8]) + Math.abs(v[9]) + Math.abs(v[11]) > 1e-6 || Math.abs(v[10] - 1) > 1e-6) return null;
      return [v[0], v[1], v[4], v[5], v[12], v[13]];
    }
    return null;
  }
  const rechtwinklig = (deg) => { const q = Math.abs(deg) % 90; return q < 0.25 || q > 89.75; };
  /** Winkel (Grad) auf das naechste Vielfache von `schritt` (Standard 90 = verlustfrei). */
  const winkelSnap = (deg, schritt) => Math.round(deg / (schritt || 90)) * (schritt || 90) || 0;

  /** Zahl kurz ausgeben (max. 3 Nachkommastellen, kein -0). */
  const zk = (v) => String(Math.round(v * 1000) / 1000 + 0).replace(/^-0$/, '0');

  /**
   * Quantisierte 2D-Transformation (Matrix `m`, Element `breite` x `hoehe` px) → { z, css }.
   *   Verschiebung auf Kunstpixel, Skalierung auf ganze Kunstpixel-Groessen, Scherung entfaellt,
   *   Drehung auf `drehSchritt` Grad (Standard 90).
   */
  function transformQuantisieren(m, breite, hoehe, raster, drehSchritt, weich) {
    const z = zerlegen(m); if (!z) return null;
    const sk = weich ? snapScaleGroesse : snapScale;
    const q = {
      tx: snapPx(z.tx, raster), ty: snapPx(z.ty, raster),
      rot: drehSchritt === 0 ? Math.round(z.rot * 100) / 100 : winkelSnap(z.rot, drehSchritt === undefined ? 90 : drehSchritt),
      sx: sk(z.sx, breite, raster), sy: sk(z.sy, hoehe, raster), sch: 0,
    };
    return { z: q, css: transformCss(q) };
  }
  function transformCss(q) {
    const t = [];
    if (q.tx || q.ty) t.push(`translate(${zk(q.tx)}px, ${zk(q.ty)}px)`);
    if (q.rot) t.push(`rotate(${zk(q.rot)}deg)`);
    if (q.sx !== 1 || q.sy !== 1) t.push(q.sx === q.sy ? `scale(${rund4(q.sx)})` : `scale(${rund4(q.sx)}, ${rund4(q.sy)})`);
    return t.length ? t.join(' ') : 'none';
  }

  /** Laengen (`12.4px`) in einem Wert auf Vielfache von `schritt` px runden (Layout-Eigenschaften; Groessen 4, Lagen 2, sonst 1). */
  const laengenRunden = (v, schritt) => String(v).replace(/(-?\d*\.?\d+)px/g, (_, n) => zk(Math.round(parseFloat(n) / (schritt || 1)) * (schritt || 1)) + 'px');

  // ── Neusampeln eines Pixelbilds unter einer linearen Abbildung (Drehung/Skalierung) ──
  /**
   * Quelle `src` ({w, h, data: RGBA}, Kunstpixel; ihre linke obere Ecke liegt bei (qx, qy) px relativ zur Elementbox) wird unter
   * der linearen Abbildung L = [a b c d] um den Ursprung O = [ox, oy] (px, Elementbox) ins Kunstpixelraster neu gesampelt:
   * je Zielpixel K x K Teilproben rueckwaerts in die Quelle, die haeufigste Farbe gewinnt, deckend ab 40 % Trefferflaeche.
   * Das ist RotSprite im Kleinen: Kanten bleiben hart, Farben bleiben Farben der Quelle (also Palettenfarben), Strichstaerke bleibt.
   * Ergebnis {w, h, data, x0, y0} (x0/y0 = linke obere Ecke px relativ zur Elementbox, Vielfache des Rasters) oder null.
   */
  function drehen(src, qx, qy, L, O, opt) {
    opt = opt || {};
    const P = opt.raster || KONFIG.px, K = opt.ssK || KONFIG.ssK, maxK = opt.max || KONFIG.spriteMax;
    const [a, b, c, d] = L, det = a * d - b * c;
    if (!(Math.abs(det) > 1e-9)) return null;
    // Drehpunkt auf die naechste Gitterecke: so bilden 90-Grad-Drehungen das Pixelraster verlustfrei auf sich ab (Fehler hoechstens ein halbes Kunstpixel).
    const ox = Math.round(O[0] / P) * P, oy = Math.round(O[1] / P) * P;
    const sw = src.w * P, sh = src.h * P;
    const ecken = [[qx, qy], [qx + sw, qy], [qx, qy + sh], [qx + sw, qy + sh]].map(([x, y]) => [ox + a * (x - ox) + c * (y - oy), oy + b * (x - ox) + d * (y - oy)]);
    const x0 = Math.floor(Math.min(...ecken.map(e => e[0])) / P + 1e-6) * P, x1 = Math.ceil(Math.max(...ecken.map(e => e[0])) / P - 1e-6) * P;
    const y0 = Math.floor(Math.min(...ecken.map(e => e[1])) / P + 1e-6) * P, y1 = Math.ceil(Math.max(...ecken.map(e => e[1])) / P - 1e-6) * P;
    const w = Math.max(1, Math.round((x1 - x0) / P)), h = Math.max(1, Math.round((y1 - y0) / P));
    if (w > maxK || h > maxK) return null;
    const ia = d / det, ib = -b / det, ic = -c / det, id = a / det;       // Inverse
    const out = new Uint8ClampedArray(w * h * 4);
    const need = Math.max(1, Math.ceil(K * K * 0.4));
    const farben = new Int32Array(K * K), zaehl = new Int32Array(K * K);
    const sd = src.data;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let n = 0, nf = 0;
        for (let v = 0; v < K; v++) {
          const Y = y0 + (j + (v + 0.5) / K) * P - oy;
          for (let u = 0; u < K; u++) {
            const X = x0 + (i + (u + 0.5) / K) * P - ox;
            const sxp = ox + ia * X + ic * Y, syp = oy + ib * X + id * Y;
            const cx = Math.floor((sxp - qx) / P), cy = Math.floor((syp - qy) / P);
            if (cx < 0 || cy < 0 || cx >= src.w || cy >= src.h) continue;
            const o = (cy * src.w + cx) * 4;
            if (sd[o + 3] < 128) continue;
            n++;
            const key = (sd[o] << 16) | (sd[o + 1] << 8) | sd[o + 2];
            let f = 0; while (f < nf && farben[f] !== key) f++;
            if (f === nf) { farben[nf] = key; zaehl[nf] = 0; nf++; }
            zaehl[f]++;
          }
        }
        if (n < need) continue;
        let best = 0; for (let f = 1; f < nf; f++) if (zaehl[f] > zaehl[best]) best = f;
        const o = (j * w + i) * 4, key = farben[best];
        out[o] = (key >> 16) & 255; out[o + 1] = (key >> 8) & 255; out[o + 2] = key & 255; out[o + 3] = 255;
      }
    }
    return { w, h, data: out, x0, y0 };
  }

  // ── CSS-Farbfilter (brightness/contrast/saturate/grayscale/sepia/invert/hue-rotate) auf Pixelfarben angewandt ──
  // Ein Filter auf einem Bild-Element mischt zur Laufzeit Farben, die nicht in der Palette stehen. Hier wird er EINMAL in die Pixel des
  // gemalten Sprites gerechnet (danach rastet `ppSnapRgb` ein) und das Element zeigt das fertige Bild ohne `filter`.
  const FILTER_NUR_FARBE = /^(?:\s*(?:brightness|contrast|saturate|grayscale|sepia|invert|hue-rotate)\([^()]*\)\s*)+$/;
  function farbFilterLesen(text) {
    const out = [];
    for (const m of String(text).matchAll(/(brightness|contrast|saturate|grayscale|sepia|invert|hue-rotate)\(([^()]*)\)/g)) {
      let v = parseFloat(m[2]);
      if (/%/.test(m[2])) v /= 100;
      if (m[1] === 'hue-rotate' && /rad/.test(m[2])) v = v * 180 / Math.PI; else if (m[1] === 'hue-rotate' && /turn/.test(m[2])) v *= 360;
      out.push([m[1], Number.isFinite(v) ? v : 1]);
    }
    return out;
  }
  /** [r,g,b] (0..255) durch die Filterkette schicken. */
  function farbFilterAnwenden(liste, r, g, b) {
    let R = r / 255, G = g / 255, B = b / 255;
    const k = (v) => Math.max(0, Math.min(1, v));
    for (const [n, a] of liste) {
      if (n === 'brightness') { R *= a; G *= a; B *= a; }
      else if (n === 'contrast') { R = (R - 0.5) * a + 0.5; G = (G - 0.5) * a + 0.5; B = (B - 0.5) * a + 0.5; }
      else if (n === 'invert') { const t = Math.min(1, a); R = R * (1 - t) + (1 - R) * t; G = G * (1 - t) + (1 - G) * t; B = B * (1 - t) + (1 - B) * t; }
      else {
        let m;
        if (n === 'grayscale') { const t = 1 - Math.min(1, a); m = [0.2126 + 0.7874 * t, 0.7152 - 0.7152 * t, 0.0722 - 0.0722 * t, 0.2126 - 0.2126 * t, 0.7152 + 0.2848 * t, 0.0722 - 0.0722 * t, 0.2126 - 0.2126 * t, 0.7152 - 0.7152 * t, 0.0722 + 0.9278 * t]; }
        else if (n === 'sepia') { const t = 1 - Math.min(1, a); m = [0.393 + 0.607 * t, 0.769 - 0.769 * t, 0.189 - 0.189 * t, 0.349 - 0.349 * t, 0.686 + 0.314 * t, 0.168 - 0.168 * t, 0.272 - 0.272 * t, 0.534 - 0.534 * t, 0.131 + 0.869 * t]; }
        else if (n === 'saturate') { m = [0.213 + 0.787 * a, 0.715 - 0.715 * a, 0.072 - 0.072 * a, 0.213 - 0.213 * a, 0.715 + 0.285 * a, 0.072 - 0.072 * a, 0.213 - 0.213 * a, 0.715 - 0.715 * a, 0.072 + 0.928 * a]; }
        else { const w = a * Math.PI / 180, c = Math.cos(w), s = Math.sin(w); m = [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]; }
        const nr = m[0] * R + m[1] * G + m[2] * B, ng = m[3] * R + m[4] * G + m[5] * B, nb = m[6] * R + m[7] * G + m[8] * B;
        R = nr; G = ng; B = nb;
      }
      R = k(R); G = k(G); B = k(B);
    }
    return [Math.round(k(R) * 255), Math.round(k(G) * 255), Math.round(k(B) * 255)];
  }

  const rein = {
    KONFIG, BAYER4, ditherStufe, ditherAn, ditherKachelSvg, ditherMaske, ditherFarbe, listeTeilen, snapPx, snapScale, zerlegen, zusammensetzen,
    matrixLesen, snapScaleGroesse, rechtwinklig, winkelSnap, farbFilterLesen, farbFilterAnwenden, FILTER_NUR_FARBE, transformQuantisieren, transformCss, laengenRunden, drehen, zk,
  };

  // Ohne DOM (Node-Tests, Pruefskripte) endet das Modul hier.
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined' && module.exports) module.exports = { rein };
    return;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  2) CSS-HILFSSET
  // ════════════════════════════════════════════════════════════════════════
  function cssHilfsset() {
    const g = 4 * KONFIG.ditherPx;
    let v = '', k = '';
    for (let s = 1; s <= 15; s++) {
      v += `--pp-dither-${s}:${ditherMaske(s)};`;
      k += `.pp-dither-${s}{-webkit-mask-image:var(--pp-dither-${s});mask-image:var(--pp-dither-${s});-webkit-mask-size:${g}px ${g}px;mask-size:${g}px ${g}px;-webkit-mask-repeat:repeat;mask-repeat:repeat;}\n`;
    }
    // Acht Stufen je Ein-/Ausblenden (gerade Dither-Stufen). Jede Stufe ein gehaltenes Bild: `steps(1)` je Intervall.
    const S = [2, 4, 6, 8, 10, 12, 14];
    const m = (s) => `-webkit-mask-image:var(--pp-dither-${s});mask-image:var(--pp-dither-${s});`;
    const frei = '-webkit-mask-image:none;mask-image:none;';
    const stufen = (liste) => liste.map((s, i) => `${((i + 1) * 100 / 8).toFixed(3)}%{opacity:1;${m(s)}}`).join('');
    const kfRaus = S.slice().reverse();
    return `:root{${v}}\n${k}`
      + `@keyframes ppFadeIn{0%{opacity:0;${m(1)}}${stufen(S)}100%{opacity:1;${frei}}}\n`
      + `@keyframes ppFadeOut{0%{opacity:1;${frei}}${stufen(kfRaus)}100%{opacity:0;${m(1)}}}\n`
      + `@keyframes ppFadeInOut{0%{opacity:0;${m(1)}}${S.map((s, i) => `${(((i + 1) * 100 / 8) * 0.4).toFixed(3)}%{opacity:1;${m(s)}}`).join('')}40%{opacity:1;${frei}}60%{opacity:1;${frei}}`
      + `${kfRaus.map((s, i) => `${(60 + (i + 1) * 5).toFixed(3)}%{opacity:1;${m(s)}}`).join('')}100%{opacity:0;${m(1)}}}\n`
      + '.pp-fade-in{animation:ppFadeIn var(--pp-fade-ms,300ms) steps(1,end) both;}\n'
      + '.pp-fade-out{animation:ppFadeOut var(--pp-fade-ms,300ms) steps(1,end) forwards;}\n'
      + '.pp-fade-inout{animation:ppFadeInOut var(--pp-fade-ms,900ms) steps(1,end) both;}\n';
  }
  function cssEinhaengen() {
    try {
      if (document.getElementById('pp-dither-css')) return;
      const el = document.createElement('style');
      el.id = 'pp-dither-css';
      el.textContent = cssHilfsset();
      (document.head || document.documentElement).appendChild(el);
    } catch (e) { /* ohne Hilfsset: nur die Klassen fehlen */ }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  3) BILDER-REGISTER (fuer gedrehte Sprites)
  //     app-shared.jsx meldet jedes gemalte Pixelbild (data-URL → kleines Canvas); `drehen` liest daraus die Pixel.
  // ════════════════════════════════════════════════════════════════════════
  const _bilder = new Map();         // url → { canvas, w, h }
  const BILDER_MAX = 1500;
  function bildRegistrieren(url, canvas) {
    if (!url || !canvas) return;
    if (_bilder.size >= BILDER_MAX) _bilder.delete(_bilder.keys().next().value);
    _bilder.set(url, canvas);
  }
  const bildVon = (url) => _bilder.get(url) || null;

  // ════════════════════════════════════════════════════════════════════════
  //  4) ANIMATIONEN BACKEN
  // ════════════════════════════════════════════════════════════════════════
  const gebacken = new WeakSet();            // Animation-Objekte
  const stat = { gebacken: 0, uebersprungen: 0, bilder: 0, ms: 0, sprites: 0, rueckfall: 0, t_probe: 0, t_bauen: 0, t_setzen: 0, t_maske: 0, t_groesse: 0 };
  const META = new Set(['offset', 'computedOffset', 'easing', 'composite']);
  const kebab = (k) => k === 'cssFloat' ? 'float' : k === 'cssOffset' ? 'offset' : k.replace(/^webkit/, '-webkit').replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
  const camel = (k) => k === 'float' ? 'cssFloat' : k.replace(/^-webkit-/, 'webkit-').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const LAYOUT = /^(left|top|right|bottom|width|height|min-width|min-height|max-width|max-height|margin(-(top|right|bottom|left))?|padding(-(top|right|bottom|left))?|border(-(top|right|bottom|left))?-width|font-size|letter-spacing|line-height|outline-offset|background-position(-x|-y)?|gap|row-gap|column-gap|inset|flex-basis)$/;
  const FARBE = /^(color|background-color|border(-(top|right|bottom|left))?-color|outline-color|fill|stroke|stop-color|flood-color|caret-color|text-decoration-color|column-rule-color)$/;
  const TRANSFORM = new Set(['transform', 'translate', 'scale', 'rotate']);

  function istSvgInnen(el) { return el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg'; }
  /** Groesse eines Pseudoelements (px aus dem berechneten Stil; sonst die des Wirts). */
  function pseudoGroesse(cs, el) {
    const w = parseFloat(cs.width), h = parseFloat(cs.height);
    const [ew, eh] = groesseVon(el);
    return [Number.isFinite(w) && w > 0 ? w : ew, Number.isFinite(h) && h > 0 ? h : eh];
  }
  function groesseVon(el) {
    if (el instanceof HTMLElement) return [el.offsetWidth, el.offsetHeight];
    try { const r = el.getBoundingClientRect(); return [r.width, r.height]; } catch (e) { return [0, 0]; }
  }
  function rasterVon(cs) {
    const v = parseFloat(cs.getPropertyValue('--pp-raster'));
    return v > 0 ? v : KONFIG.px;
  }
  function ursprungVon(cs, w, h) {
    const p = String(cs.transformOrigin || '').split(/\s+/).map(parseFloat);
    return [Number.isFinite(p[0]) ? p[0] : w / 2, Number.isFinite(p[1]) ? p[1] : h / 2];
  }

  /** Ist diese Keyframe-Folge schon pixelkonform (gehaltene Bilder ≤ ~30 Hz, keine Zwischenwerte)? Dann nichts tun. */
  function istKonform(kfs, props, dauer, strikt) {
    let schritte = 0;
    for (let i = 0; i < kfs.length - 1; i++) {
      const m = /^steps\(\s*(\d+)/.exec(String(kfs[i].easing || ''));
      if (!m) return false;
      schritte += +m[1];
    }
    if (schritte / dauer * 1000 > KONFIG.takt + 3) return false;
    // ★ W86a (Szenen, `strikt`): auch die STUFEN muessen im Raster liegen. `steps(n)` mit n > 1 zwischen verschiedenen Werten von opacity/
    // transform/… ergibt Zwischenwerte (Halb-Alpha, Bruchpixel); und Stufen/Dauern, die nicht auf ganze Takte fallen, wechseln auf
    // beliebigen 60-Hz-Bildern statt im 30-Hz-Gleichschritt. Beides wird dann gebacken (Dither, Kunstpixel, Takt); reine Stufenfolgen
    // (`steps(n)`) auch lange Schleifen exakt, an den Stufengrenzen (`stufenZeiten`).
    if (strikt) {
      const T = TAKT_MS(), ausser = (x) => Math.abs(x / T - Math.round(x / T)) * T;
      if (ausser(dauer) > 0.5) return false;
      for (let i = 0; i < kfs.length - 1; i++) {
        const n = +/^steps\(\s*(\d+)/.exec(String(kfs[i].easing || ''))[1];
        const o0 = kfs[i].computedOffset != null ? kfs[i].computedOffset : kfs[i].offset, o1 = kfs[i + 1].computedOffset != null ? kfs[i + 1].computedOffset : kfs[i + 1].offset;
        if (!(o1 > o0)) continue;
        const stufe = (o1 - o0) * dauer / n;
        if (ausser(o0 * dauer) > 1.5 || ausser(stufe) > 1.5 || stufe < T - 1.5) return false;
        if (n > 1) for (const p of props) {
          if (/^background(Position|Size)?$/.test(p) || /^mask/.test(p)) continue;        // Sprite-Blaetter: gehaltene Stufen sind gewollt
          if (kfs[i][p] !== kfs[i + 1][p]) return false;
        }
      }
    }
    for (const kf of kfs) {
      for (const p of props) {
        const v = kf[p]; if (v == null) continue;
        if (p === 'opacity') { const o = parseFloat(v); if (o > 0.03 && o < 0.97) return false; continue; }
        if (p === 'transform') {
          let m; try { m = matrixLesen(String(new DOMMatrix(String(v)).toString())); } catch (e) { return false; }
          const z = m && zerlegen(m); if (!z || !rechtwinklig(z.rot) || z.sch > 0.01) return false;
          if (Math.abs(z.sx * 2 - Math.round(z.sx * 2)) > 0.02 || Math.abs(z.sy * 2 - Math.round(z.sy * 2)) > 0.02) return false;
          continue;
        }
        if (p === 'rotate' || p === 'scale' || p === 'filter' || p === 'boxShadow' || p === 'textShadow' || p === 'backdropFilter') {
          if (String(v) !== 'none' && !(p === 'rotate' && /^(0|90|180|270|-90)deg$/.test(String(v)))) return false;
        }
        if (FARBE.test(kebab(p)) && /rgba\(/.test(String(v)) && !/,\s*1\)/.test(String(v))) return false;
      }
    }
    return true;
  }

  /** Eigenschaften, die diese Animation steuert (camelCase aus getKeyframes). */
  function eigenschaften(kfs) {
    const s = new Set();
    for (const kf of kfs) for (const k of Object.keys(kf)) if (!META.has(k)) s.add(k);
    return [...s];
  }

  // ── Weichzeichner aus Schatten/Filtern entfernen (Pixelart: kein Schein) ──
  function filterBereinigen(v) {
    if (!v || v === 'none') return v;
    const rest = v.replace(/drop-shadow\((?:[^()]|\([^()]*\))*\)/g, '').replace(/blur\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    return rest || 'none';
  }
  /** `box-shadow`/`text-shadow` mit Unschaerfe → harter Ring (Kunstpixel breit) bzw. weg; Alpha < 0,35 faellt weg. */
  function schattenHart(v, raster) {
    if (!v || v === 'none') return v;
    const out = [];
    for (const teil of listeTeilen(v)) {
      const farbe = /(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})/.exec(teil);
      const nums = (teil.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
      if (!farbe || nums.length < 2) { out.push(teil); continue; }
      const [x, y, blur = 0, streu = 0] = nums;
      const al = (/^rgba/.test(farbe[1]) ? parseFloat(farbe[1].split(',')[3]) : 1);
      const inset = /inset/.test(teil) ? 'inset ' : '';
      if (blur === 0) { out.push(teil); continue; }
      if (!(al >= 0.35)) continue;
      const ring = Math.max(raster, snapPx(streu + blur / 3, raster));
      out.push(`${inset}${zk(snapPx(x, raster))}px ${zk(snapPx(y, raster))}px 0 ${zk(ring)}px ${farbe[1].replace(/,\s*[\d.]+\)$/, ',1)').replace(/^rgba/, 'rgba')}`);
    }
    return out.length ? out.join(', ') : 'none';
  }
  const snapFarben = (v) => (root.ppSnapCss ? root.ppSnapCss(v) : v);

  // ── Dither-Maske am Element vorbereiten ──
  // Eine Maske (mask-image) schneidet ALLES an der Elementbox ab, auch Kinder, die darueber hinausragen oder spaeter hinausfliegen
  // (Pixel-Halos, Funken) — `mask-clip: no-clip` haette das verhindert, malt aber weich (Alpha an jeder Dither-Kante). Darum bekommt
  // jedes malende Blatt der Teilbaums seine EIGENE Maske, gesteuert ueber eine vererbte Variable `--pp-dmN` (die Keyframes setzen nur
  // diese Variable und `opacity` 0/1). Elemente mit Kindern geben ihre eigene Malerei (Hintergrund, Rahmen, Maske) an ein Koerper-Kind
  // `i.pp-px-body` ab. Ueber 40 Nachfahren: nur die Elementmaske (Randabschnitt ist dort unkritisch).
  const maskeZustand = new WeakMap();   // Element → { vn, orig }
  let _dmZaehler = 0;
  const MASKE_NACHFAHREN_MAX = 40;
  const MALT_NICHT = new Set(['STYLE', 'SCRIPT', 'TEMPLATE', 'LINK', 'META']);
  function maskeListen(st, cs, orig, bildAusdruck) {
    const g = 4 * KONFIG.ditherPx;
    const lst = (n, dflt) => orig ? dflt + ', ' + (cs.getPropertyValue(n) || '') : dflt;
    // Ebenen: Dither zuoberst, darunter die bisherige Maske (Schnittmenge).
    st.setProperty('mask-image', orig ? bildAusdruck + ', ' + orig : bildAusdruck);
    st.setProperty('mask-size', lst('mask-size', `${g}px ${g}px`));
    st.setProperty('mask-repeat', lst('mask-repeat', 'repeat'));
    st.setProperty('mask-position', lst('mask-position', '0 0'));
    st.setProperty('mask-composite', orig ? 'intersect, ' + (cs.getPropertyValue('mask-composite') || 'add') : 'add');
  }
  function origMaske(el, cs) {
    // Inline-Wert zuerst: er behaelt `var(--pp-dmN)`-Verweise (der berechnete Wert waere schon die aufgeloeste url()).
    const inl = el.style.getPropertyValue('mask-image');
    if (inl && inl !== 'none') return inl;
    const mi = cs.getPropertyValue('mask-image') || cs.getPropertyValue('-webkit-mask-image') || 'none';
    return mi && mi !== 'none' ? mi : null;
  }
  function hatEigeneMalerei(cs) {
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    const m = /rgba?\(([^)]*)\)/.exec(cs.backgroundColor || '');
    if (m) { const v = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat); if (v.length < 4 || v[3] > 0) return true; }
    return false;
  }
  /** Eigene Malerei von `el` (Hintergrund-Ebenen, Hintergrundfarbe, Radius) in ein Kind verschieben; gibt das Kind zurueck. */
  function koerperKind(el, cs) {
    const k = document.createElement('i');
    k.className = 'pp-px-body'; k.setAttribute('aria-hidden', 'true'); k.setAttribute('data-pp-px', 'aus');
    const bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
    const ks = k.style;
    ks.cssText = `position:absolute;left:${-bl}px;top:${-bt}px;width:${el.offsetWidth}px;height:${el.offsetHeight}px;box-sizing:border-box;pointer-events:none;z-index:0;`;
    for (const pr of ['background-image', 'background-size', 'background-position', 'background-repeat', 'background-origin', 'background-clip', 'background-color', 'image-rendering', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'])
      ks.setProperty(pr, cs.getPropertyValue(pr));
    const orig = origMaske(el, cs);
    if (orig) for (const pr of ['mask-image', 'mask-size', 'mask-position', 'mask-repeat']) ks.setProperty(pr, cs.getPropertyValue(pr));
    const es = el.style;
    es.setProperty('background-image', 'none'); es.setProperty('background-color', 'transparent');
    if (orig) es.setProperty('mask-image', 'none');
    el.insertBefore(k, el.firstChild);
    return k;
  }
  /** Blatt (oder Element mit eigener Teilbaum-Maske): Maske `var(--vn)` setzen. */
  function maskeBlatt(c, vn) {
    const cs = getComputedStyle(c);
    maskeListen(c.style, cs, origMaske(c, cs), `var(${vn})`);
  }
  function maskeKinder(el, vn, tiefe) {
    if (tiefe > 6) return;
    for (const c of Array.from(el.children)) {
      if (MALT_NICHT.has(c.tagName)) continue;
      const ccs = getComputedStyle(c);
      if (ccs.display === 'none') continue;
      if (ccs.display === 'contents') { maskeKinder(c, vn, tiefe + 1); continue; }
      if (c instanceof SVGElement && c.tagName.toLowerCase() !== 'svg') continue;
      const hatKinder = Array.from(c.children).some(x => !MALT_NICHT.has(x.tagName) && getComputedStyle(x).display !== 'none') && !(c instanceof SVGElement);
      if (hatKinder) {
        if (hatEigeneMalerei(ccs)) { const k = koerperKind(c, ccs); maskeBlatt(k, vn); }
        maskeKinder(c, vn, tiefe + 1);
      } else maskeBlatt(c, vn);
    }
  }
  function maskeVorbereiten(el, cs, weich) {
    let z = maskeZustand.get(el);
    if (z) return z;
    const vn = '--pp-dm' + (++_dmZaehler);
    z = { vn, benutzer: 0, weich: !!weich };
    maskeZustand.set(el, z);
    const hatKinder = !(el instanceof SVGElement) && Array.from(el.children).some(x => !MALT_NICHT.has(x.tagName) && getComputedStyle(x).display !== 'none');
    const viele = hatKinder && el.querySelectorAll('*').length > MASKE_NACHFAHREN_MAX;
    if (hatKinder && !viele) {
      el.style.setProperty(vn, ditherMaske(16));        // Grundzustand = volle Maske
      if (hatEigeneMalerei(cs)) { const k = koerperKind(el, cs); maskeBlatt(k, vn); }
      maskeKinder(el, vn, 0);
    } else if (!hatKinder && KONFIG.direkt) {
      // Blatt ohne Kinder: die Keyframes setzen `mask-image` selbst (keine vererbte Variable → Stilwechsel bleibt auf das Element begrenzt)
      z.direkt = true; z.orig = origMaske(el, cs);
      maskeListen(el.style, cs, z.orig, ditherMaske(16));
    } else {
      el.style.setProperty(vn, ditherMaske(16));
      maskeListen(el.style, cs, origMaske(el, cs), `var(${vn})`);
    }
    return z;
  }

  /** Oberflaechen-Fades: die Maske bleibt nur, solange eine gebackene Animation sie braucht (danach wieder wie vorher, keine dauerhafte Maske an Knoepfen/Listen). */
  function maskeBenutzt(el, z, anim) {
    z.benutzer++;
    const fertig = () => {
      if (--z.benutzer > 0) return;
      try {
        const st = el.style;
        for (const pr of ['mask-image', 'mask-size', 'mask-repeat', 'mask-position', 'mask-composite', z.vn]) st.removeProperty(pr);
        maskeZustand.delete(el);
      } catch (e) { /* weg */ }
    };
    try { anim.finished.then(fertig, fertig); } catch (e) { fertig(); }
  }

  /** Breite/Hoehe eines absolut positionierten Elements auf Vielfache von 4 legen (Mitte bleibt) — Voraussetzung fuer saubere Kanten beim Skalieren. */
  const _groesseGemacht = new WeakSet();
  function groesseAusrichten(el, cs) {
    if (_groesseGemacht.has(el) || !(el instanceof HTMLElement) || spriteZustand.has(el)) return;
    _groesseGemacht.add(el);
    if (cs.position !== 'absolute' && cs.position !== 'fixed') return;
    // ★ W86a: Szenen (Raster = Szenenpixel, `--pp-raster`): die Groessen sind schon N Szenenpixel (calc(N * var(--px))), die Skalierung geht in
    // Schritten von 1/raster (snapScale) — N x raster x n/raster ist eine ganze Zahl. Auf Vielfache von 4 px zu runden wuerde das zerstoeren.
    if (cs.getPropertyValue('--pp-raster')) return;
    const l = parseFloat(cs.left), t = parseFloat(cs.top), cw = parseFloat(cs.width), ch = parseFloat(cs.height);
    if (!Number.isFinite(l) || !Number.isFinite(t) || !Number.isFinite(cw) || !Number.isFinite(ch)) return;
    // Aussenmass exakt (offsetWidth rundet): Inhaltsbreite + Innenabstand + Rahmen, falls content-box
    const border = cs.boxSizing === 'border-box';
    const ex = border ? 0 : (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    const ey = border ? 0 : (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    const Wx = cw + ex, Hx = ch + ey;
    const W4 = Math.max(4, Math.round(Wx / 4) * 4), H4 = Math.max(4, Math.round(Hx / 4) * 4);
    const st = el.style;
    if (Math.abs(W4 - Wx) < 1e-3 && Math.abs(H4 - Hx) < 1e-3 && Number.isInteger(l) && Number.isInteger(t)) return;
    st.setProperty('width', zk(W4 - ex) + 'px'); st.setProperty('height', zk(H4 - ey) + 'px');
    st.setProperty('left', Math.round(l - (W4 - Wx) / 2) + 'px'); st.setProperty('top', Math.round(t - (H4 - Hx) / 2) + 'px');
    st.setProperty('right', 'auto'); st.setProperty('bottom', 'auto');
  }

  /** Eine Animation (CSSAnimation, CSSTransition oder WAAPI) in pixelkonforme gehaltene Bilder umbauen. */
  // Nachbacken in Zeitscheiben (nur Oberflaeche): viele lange Schleifen auf einmal (Titelbild: ~180 schwebende Teilchen) wuerden den ersten
  // Frame blockieren. Die Animation laeuft solange unveraendert weiter; beim Nachbacken bleibt ihre Zeitachse erhalten.
  const _warte = [];
  let _wartePlan = false, _fenster = 0, _verbraucht = 0;
  function _arbeiten() {
    _wartePlan = false;
    const t0 = performance.now();
    while (_warte.length && performance.now() - t0 < 6) {
      const [anim, weich] = _warte.shift();
      try { if (anim.playState !== 'idle' && anim.playState !== 'finished') backen(anim, null, weich, true); } catch (e) { /* weg */ }
    }
    if (_warte.length) _planen();
  }
  function _planen() {
    if (_wartePlan) return;
    _wartePlan = true;
    setTimeout(_arbeiten, 24);                 // ~6 ms Arbeit je ~30 ms: rund ein Fuenftel eines Kerns, Titelbild in ~3 s fertig
  }

  function backenPruefen(anim, budget, weich, sofort) {
    if (!KONFIG.aktiv || (gebacken.has(anim) && !sofort)) return null;
    gebacken.add(anim);
    let eff;
    try { eff = anim.effect; } catch (e) { return null; }
    if (!eff || typeof eff.getKeyframes !== 'function' || !eff.target) return null;   // W86u1: ::before/::after (eff.pseudoElement) werden mitgebacken
    const el = eff.target;
    if (!(el instanceof Element) || !el.isConnected) return null;
    if (el.closest('[data-pp-px="aus"]')) { stat.uebersprungen++; return null; }
    let kfs, t;
    try { kfs = eff.getKeyframes(); t = eff.getComputedTiming(); } catch (e) { return null; }
    const dauer = +t.duration;
    if (!(dauer > 0) || !Number.isFinite(dauer) || kfs.length < 2) return null;
    if (weich && dauer > KONFIG.globalMaxDauer) { stat.uebersprungen++; return null; }
    if (weich && !sofort && Math.min(KONFIG.globalMaxBilder, Math.ceil(dauer / TAKT_MS())) > KONFIG.globalSofort) {
      // W86u1: einmalige Animationen (Schadensblitz, Ringe, Zielmarkierungen …) sofort backen — sie sind vorbei, bevor eine Warteschlange voller Schleifen
      // (Umgebungsteilchen) sie erreicht, und liefen sonst ganz weich. Nur ein Zeitfenster von ~10 ms je Takt; der Rest wartet (einmalige vorn).
      const jetzt = performance.now();
      if (jetzt - _fenster > TAKT_MS()) { _fenster = jetzt; _verbraucht = 0; }
      const schleife = !(+t.iterations <= 1);
      if (schleife || _verbraucht > KONFIG.sofortMs) { _warte.unshift([anim, weich]); _planen(); return null; }   // zuletzt gestartet = zuerst gebacken (Zielmarkierung vor 100 Umgebungsteilchen)
    }
    const props = eigenschaften(kfs);
    if (!props.length) return null;
    const strikt = !!(el.closest && el.closest('.pp-pixel-scene'));       // Szenen (Areas): strengere Pruefung, Stufenfolgen exakt (W86a)
    if (istKonform(kfs, props, dauer, strikt)) {
      // Schon gehaltene Bilder: nicht neu abtasten, aber Delay/Start aufs Raster legen (Spriteschleifen mit Dauern wie 200/400/800 ms
      // laufen dann im Gleichschritt mit den gebackenen Animationen)
      try {
        const T = TAKT_MS(), d0 = +eff.getTiming().delay || 0, d2 = Math.round(d0 / T) * T;
        if (Math.abs(d2 - d0) > 1e-3) eff.updateTiming({ delay: d2 });
        startAusrichten(anim);
      } catch (e) { /* bleibt */ }
      stat.uebersprungen++; return null;
    }
    return { anim, eff, el, kfs, props, dauer, budget, weich, strikt };
  }
  /** Eine Animation backen (Einzelweg: Pruefen, Abtasten, Bauen). Der Stapelweg (`backenAlle`) tastet viele Animationen gemeinsam ab. */
  function backen(anim, budget, weich, sofort) {
    const v = backenPruefen(anim, budget, weich, sofort);
    if (!v) return false;
    const t0 = performance.now();
    let ok = false;
    try { ok = backenInnen(v.anim, v.eff, v.el, v.kfs, v.props, v.dauer, v.budget, v.weich, v.strikt); } catch (e) { if (KONFIG.debug) console.warn('[PPPixelAnim]', e); }
    stat.ms += performance.now() - t0;
    if (weich && !sofort) _verbraucht += performance.now() - t0;
    if (ok) stat.gebacken++;
    return ok;
  }
  /**
   * ★ Stapel: viele Animationen GEMEINSAM backen. Jede Abtastung (`probe.currentTime` setzen, `getPropertyValue` lesen) erzwingt einen
   * Stil-Neuaufbau; je Animation und Zeitpunkt nacheinander kostet das N x Bilder Neuaufbauten. Hier wird je ZEITPUNKT erst jede Probe gesetzt und
   * dann gelesen — ein Neuaufbau fuer alle (gemessen: 200 Animationen 730 ms -> 56 ms, gleiche Werte). Auch die Schreibzugriffe des Bauens
   * (Groessen, Keyframes) kommen erst danach, sie verwerfen die Stile nicht mehr zwischen den Proben.
   */
  function backenStapel(liste, budget) {
    const t0 = performance.now();
    const ctxs = [];
    for (const a of liste) {
      const v = backenPruefen(a, budget, false, false);
      if (!v) continue;
      let c = false;
      try { c = backenProbeVorbereiten(v.anim, v.eff, v.el, v.kfs, v.props, v.dauer, v.budget, v.weich, v.strikt); } catch (e) { if (KONFIG.debug) console.warn('[PPPixelAnim]', e); }
      if (c) ctxs.push(c);
    }
    if (!ctxs.length) return 0;
    const tp0 = performance.now();
    let maxN = 0;
    for (const c of ctxs) if (c.zeiten.length > maxN) maxN = c.zeiten.length;
    for (let j = 0; j <= maxN; j++) {
      for (const c of ctxs) if (j <= c.zeiten.length) backenProbeSetzen(c, j);
      for (const c of ctxs) if (j <= c.zeiten.length) backenProbeLesen(c, j);
    }
    for (const c of ctxs) c.probe.cancel();
    stat.t_probe += performance.now() - tp0;
    let n = 0;
    for (const c of ctxs) {
      let ok = false;
      try { ok = backenProbeFertig(c); } catch (e) { if (KONFIG.debug) console.warn('[PPPixelAnim]', e); }
      if (ok) { stat.gebacken++; n++; }
    }
    stat.ms += performance.now() - t0;
    return n;
  }

  /**
   * ★ W86a (Szenen): Bildzeiten reiner Stufenfolgen. Hat jedes Intervall `steps(n)`, wechselt der Wert nur an den Stufengrenzen: dort (auf ganze
   * Takte gerundet) liegen die Bilder, abgetastet jeweils knapp NACH der Grenze. So tickt eine lange Schleife (`steps(189)` ueber 47 s) exakt im
   * Raster, ohne dass 1400 Takte abgetastet werden muessten. null = keine reine Stufenfolge oder zu viele Stufen.
   */
  function stufenZeiten(kfs, D2, T, maxN) {
    let n = 0;
    const iv = [];
    for (let i = 0; i < kfs.length - 1; i++) {
      const m = /^steps\(\s*(\d+)\s*(?:,\s*(?:jump-)?end\s*)?\)$/.exec(String(kfs[i].easing || ''));
      if (!m) return null;
      const o0 = kfs[i].computedOffset != null ? kfs[i].computedOffset : kfs[i].offset, o1 = kfs[i + 1].computedOffset != null ? kfs[i + 1].computedOffset : kfs[i + 1].offset;
      iv.push([o0, o1, +m[1]]); n += +m[1];
    }
    if (n > maxN) return null;
    const grid = [], probe = [];
    const setze = (tb) => {
      const g = Math.round(tb / T) * T;
      if (grid.length && g <= grid[grid.length - 1] + 1e-6) { probe[probe.length - 1] = tb + 0.02; return; }          // zwei Grenzen im selben Takt: die spaetere gilt
      grid.push(g); probe.push(tb + 0.02);
    };
    setze(0);
    for (const [o0, o1, k] of iv) for (let j = 0; j < k; j++) { const tb = (o0 + (o1 - o0) * j / k) * D2; if (tb > 1e-6 && tb < D2 - 1e-6) setze(tb); }
    return { grid, probe };
  }
  /**
   * Bildzeiten (ms, Aktivphase) einer Animation: Vielfache von `schritt` ab Start. Delay und Dauer werden beim Backen auf ganze Takte
   * gelegt (`backenInnen`), Start und Ende liegen also wie jedes Zwischenbild auf dem globalen 30-Hz-Raster; `startAusrichten` schiebt
   * den Start auf dieses Raster (hoechstens ein halber Takt = ~17 ms).
   */
  function bildZeiten(D, schritt) {
    const a = [0];
    for (let c = schritt; c < D - 1e-6; c += schritt) a.push(c);
    return a;
  }
  function startAusrichten(anim) {
    const T = TAKT_MS();
    const tun = () => {
      try {
        if (anim.playState !== 'running' || anim.startTime == null) return;
        const neu = Math.floor(anim.startTime / T + 1e-6) * T;     // ★ W86a: abrunden (nie spaeter als jetzt) — sonst steht das erste Bild noch im Ausgangszustand
        if (Math.abs(neu - anim.startTime) > 1e-3) anim.startTime = neu;
      } catch (e) { /* bleibt unausgerichtet */ }
    };
    try { anim.ready.then(tun, () => {}); } catch (e) { /* ohne */ }
  }

  function backenProbeVorbereiten(anim, eff, el, kfs, props, dauer, budget, weich, strikt) {
    const pe = eff.pseudoElement || null;                       // W86u1: Animation auf ::before/::after — gleiche Pipeline, nur ohne Inline-Eingriffe am Wirt
    const cs = pe ? getComputedStyle(el, pe) : getComputedStyle(el);
    const [W, H] = pe ? pseudoGroesse(cs, el) : groesseVon(el);
    const raster = rasterVon(cs);
    const svgInnen = istSvgInnen(el);
    const T = TAKT_MS();
    const delay0 = +t0Timing(eff).delay || 0;
    // ── Delay und Dauer auf ganze Takte legen (Start, Zwischenbilder und Ende liegen dann alle auf dem 30-Hz-Raster) ──
    const delay2 = Math.round(delay0 / T) * T;
    const D2 = Math.max(T, Math.round(dauer / T) * T);
    // ── Abtastraster ──
    let stride = Math.max(1, Math.ceil(D2 / T / (weich ? Math.min(KONFIG.maxBilder, KONFIG.globalMaxBilder) : KONFIG.maxBilder)));
    if (budget && budget.rest !== undefined) {
      const anteil = Math.max(6, Math.floor(budget.rest / Math.max(1, budget.offen)));
      stride = Math.max(stride, Math.ceil(D2 / T / anteil));
    }
    let zeiten = bildZeiten(D2, stride * T), probeZeiten = null;
    if (strikt) {
      const sz = stufenZeiten(kfs, D2, T, KONFIG.stufenMax);
      if (sz && (!budget || budget.rest === undefined || sz.grid.length <= Math.max(zeiten.length * 3, budget.rest / 4))) { zeiten = sz.grid; probeZeiten = sz.probe; }
    }
    if (budget && budget.rest !== undefined) { budget.rest -= zeiten.length + 1; budget.offen = Math.max(1, budget.offen - 1); }
    // ── Probe: gleiche Keyframes als eigene WAAPI-Animation → abtasten ──
    const probeKfs = kfs.map(k => { const o = Object.assign({}, k); o.offset = k.computedOffset != null ? k.computedOffset : k.offset; delete o.computedOffset; return o; });
    let probe;
    try { probe = new Animation(new KeyframeEffect(el, probeKfs, Object.assign({ duration: D2, fill: 'both', easing: 'linear' }, pe ? { pseudoElement: pe } : {})), document.timeline); }
    catch (e) { return false; }
    probe.pause();
    return { anim, eff, el, props, dauer, weich, strikt, pe, cs, W, H, raster, svgInnen, T, delay0, delay2, D2, zeiten, probeZeiten, probe, kProps: props.map(kebab), roh: [] };
  }
  /** Probe auf den j-ten Zeitpunkt stellen. */
  function backenProbeSetzen(c, j) {
    c.probe.currentTime = j < c.zeiten.length ? (c.probeZeiten ? c.probeZeiten[j] : c.zeiten[j]) : c.D2 - 1e-3;
  }
  /** Werte der Probe zum eingestellten Zeitpunkt lesen. */
  function backenProbeLesen(c, j) {
    const w = {};
    for (let q = 0; q < c.kProps.length; q++) w[c.props[q]] = c.cs.getPropertyValue(c.kProps[q]);
    c.roh.push(w);
  }
  /** Einzelweg: eine Animation vorbereiten, abtasten, fertig bauen. */
  function backenInnen(anim, eff, el, kfs, props, dauer, budget, weich, strikt) {
    const c = backenProbeVorbereiten(anim, eff, el, kfs, props, dauer, budget, weich, strikt);
    if (!c) return false;
    const tp0 = performance.now();
    for (let j = 0; j <= c.zeiten.length; j++) { backenProbeSetzen(c, j); backenProbeLesen(c, j); }
    c.probe.cancel();
    stat.t_probe += performance.now() - tp0;
    return backenProbeFertig(c);
  }
  /** Aus den gelesenen Rohwerten die gebackenen Keyframes bauen und einsetzen. */
  function backenProbeFertig(c) {
    const { anim, eff, el, props, weich, pe, cs, W, H, raster, svgInnen, delay0, delay2, D2, zeiten, roh } = c, dauer = c.dauer;
    const tp1 = performance.now();
    // ── Quantisieren ──
    const rahmen = frameBauen(roh, props, el, cs, W, H, raster, svgInnen, weich, anim, pe);
    const tp2 = performance.now(); stat.t_bauen += tp2 - tp1;
    if (!rahmen) return false;
    // ── Gleiche Bilder zusammenfassen, Keyframes setzen ──
    const offs = zeiten.map(z => z / D2).concat([1]);
    const frames = [];
    let letzte = null;
    // W86p: nur Animationen, die skalieren (Faktor != 1): Ebenen mit reiner Verschiebung ganzer Pixel bleiben auch als Compositor-Animation scharf
    const hauptfaden = KONFIG.hauptfaden && (roh.some(w => { const m = matrixLesen(w.transform || 'none'); const z = m && zerlegen(m); return z && (Math.abs(Math.abs(z.sx) - 1) > 0.02 || Math.abs(Math.abs(z.sy) - 1) > 0.02); })
      || roh.some(w => w.scale && w.scale !== 'none' && w.scale !== '1') || roh.some(w => w.rotate && w.rotate !== 'none' && w.rotate !== '0deg'));
    for (let j = 0; j < rahmen.length; j++) {
      const s = JSON.stringify(rahmen[j]);
      const ende = j === rahmen.length - 1;
      if (s === letzte && !ende) continue;
      frames.push(Object.assign({ offset: offs[j], easing: 'steps(1, end)', composite: 'replace' }, hauptfaden ? { scrollMarginTop: (frames.length % 2) + 'px' } : null, rahmen[j]));
      letzte = s;
    }
    if (frames.length < 2) frames.push(Object.assign({}, frames[0], { offset: 1 }));
    frames[0].offset = 0; frames[frames.length - 1].offset = 1;
    try {
      eff.setKeyframes(frames);
      const neu = {};
      if (Math.abs(D2 - dauer) > 1e-3) neu.duration = D2;
      if (Math.abs(delay2 - delay0) > 1e-3) neu.delay = delay2;
      if (neu.duration !== undefined || neu.delay !== undefined) eff.updateTiming(neu);
    } catch (e) { return false; }
    startAusrichten(anim);
    stat.t_setzen += performance.now() - tp2;
    stat.bilder += frames.length;
    return true;
  }
  const t0Timing = (eff) => eff.getTiming();

  /** Rohwerte je Bild → quantisierte Keyframe-Eigenschaften (camelCase). */
  function frameBauen(roh, props, el, cs, W, H, raster, svgInnen, weich, anim, pe) {
    const n = roh.length;
    const aus = roh.map(() => ({}));
    const hatT = props.includes('transform');
    // ── Transformationen ──
    let sprite = null;
    if (hatT && !svgInnen && !pe && !props.includes('rotate') && !props.includes('translate') && !props.includes('scale')) {
      // Drehung, die nicht in Viertelschritten liegt: Blatt-Element als gedrehtes Sprite (siehe Abschnitt 6) — sonst unten Viertelschritt-Rueckfall.
      const mats = roh.map(w => matrixLesen(w.transform));
      if (mats.every(Boolean) && mats.some(m => { const z = zerlegen(m); return z && !rechtwinklig(z.rot); }) && spriteMoeglich(el, cs)) {
        const sp = spriteBilder(el, cs, mats, W, H, raster, true);
        if (sp && spriteAnwenden(el, cs, sp, sp.bilder.find(b => b && b.url) ? sp.bilder.find(b => b && b.url).url : '')) sprite = sp;
        else stat.rueckfall++;
      }
    }
    if (sprite) {
      for (let j = 0; j < n; j++) {
        const b = sprite.bilder[j];
        aus[j].transform = b && (b.tx || b.ty) ? `translate(${zk(b.tx)}px, ${zk(b.ty)}px)` : 'none';
        aus[j].backgroundImage = b && b.url ? `url("${b.url}")` : 'none';
      }
      el.style.setProperty('transform', aus[0].transform);
    }
    if (!sprite && props.some(p => TRANSFORM.has(p))) {
      // Skaliert das Element irgendwann (Faktor != 1)? Dann Groesse auf Vielfache von 4 (ganze Pixelkanten, s. groesseAusrichten)
      if ((roh.some(w => { const m = matrixLesen(w.transform || 'none'); const z = m && zerlegen(m); return z && (Math.abs(Math.abs(z.sx) - 1) > 0.02 || Math.abs(Math.abs(z.sy) - 1) > 0.02); })
          || roh.some(w => w.scale && w.scale !== 'none' && w.scale !== '1')) && !weich && !pe) { const tg = performance.now(); groesseAusrichten(el, cs); stat.t_groesse += performance.now() - tg; }
      for (let j = 0; j < n; j++) {
        const w = roh[j];
        if (hatT) {
          const m = matrixLesen(w.transform);
          if (!m) aus[j].transform = w.transform;
          else {
            const q = transformQuantisieren(m, W, H, raster, 90, weich);
            aus[j].transform = q ? q.css : w.transform;
          }
        }
        if (props.includes('translate')) {
          const s = String(w.translate || 'none');
          if (s === 'none') aus[j].translate = 'none';
          else { const v = s.split(/\s+/).map(parseFloat); aus[j].translate = `${zk(snapPx(v[0] || 0, raster))}px ${zk(snapPx(v[1] || 0, raster))}px`; }
        }
        if (props.includes('scale')) {
          const s = String(w.scale || 'none');
          if (s === 'none') aus[j].scale = 'none';
          else { const v = s.split(/\s+/).map(parseFloat); const sk = weich ? snapScaleGroesse : snapScale; const sx = sk(v[0], W, raster), sy = sk(v.length > 1 ? v[1] : v[0], H, raster); aus[j].scale = sx === sy ? String(rund4(sx)) : `${rund4(sx)} ${rund4(sy)}`; }
        }
        if (props.includes('rotate')) {
          const s = String(w.rotate || 'none');
          aus[j].rotate = s === 'none' ? 'none' : winkelSnap(parseFloat(s) || 0, 90) + 'deg';
        }
      }
    }
    // ── Deckkraft → Dither ──
    if (props.includes('opacity')) {
      const q = KONFIG.ditherSchritt || 1;
      const stufen = roh.map(w => { const st = ditherStufe(parseFloat(w.opacity)); return st > 0 && st < 16 && q > 1 ? Math.max(q, Math.min(16 - q, Math.round(st / q) * q)) : st; });
      // Oberflaeche (weich): Elemente mit Kindern oder eigener Maske bekommen keine Dither-Maske (sie schneidet ueberstehende Kinder ab) — dort nur ein/aus
      const peMaske = pe && cs.maskImage && cs.maskImage !== 'none';   // Pseudoelement mit eigener Maske: nur ein/aus
      const mitKindern = weich && !pe && (Array.from(el.children).some(x => !MALT_NICHT.has(x.tagName)) || !!origMaske(el, cs));
      const brauchtMaske = KONFIG.dither && !svgInnen && !mitKindern && !peMaske && W * H >= KONFIG.ditherMin && stufen.some(s => s > 0 && s < 16);
      if (brauchtMaske) {
        const tm = performance.now(); const z = pe ? { direkt: true, orig: null } : maskeVorbereiten(el, cs, weich); stat.t_maske += performance.now() - tm;
        if (weich && !pe) maskeBenutzt(el, z, anim);
        for (let j = 0; j < n; j++) {
          const s = stufen[j];
          aus[j].opacity = s === 0 ? '0' : '1';
          const tile = ditherMaske(s === 0 ? 1 : s);
          if (z.direkt) aus[j].maskImage = z.orig ? tile + ', ' + z.orig : tile; else aus[j][z.vn] = tile;
          if (pe) { aus[j].maskSize = `${4 * KONFIG.ditherPx}px ${4 * KONFIG.ditherPx}px`; aus[j].maskRepeat = 'repeat'; aus[j].maskPosition = '0 0'; }   // am Pseudoelement nur ueber die Keyframes setzbar
        }
      } else {
        for (let j = 0; j < n; j++) aus[j].opacity = (svgInnen ? parseFloat(roh[j].opacity) >= 0.5 : stufen[j] >= 8) ? '1' : '0';
      }
    }
    // ── Rest ──
    for (const p of props) {
      if (TRANSFORM.has(p) || p === 'opacity') continue;
      const k = kebab(p);
      for (let j = 0; j < n; j++) {
        let v = roh[j][p];
        if (v == null) continue;
        if (LAYOUT.test(k)) v = laengenRunden(v, /^(width|height|min-|max-)/.test(k) ? 4 : /^(left|top|right|bottom|margin|inset)/.test(k) ? 2 : 1);
        else if (k === 'filter' || k === '-webkit-filter') v = root.PPPixelHart ? root.PPPixelHart.filter(v) : filterBereinigen(v);   // W86u1: harte drop-shadows bleiben, Weichzeichner weg
        else if (k === 'backdrop-filter' || k === '-webkit-backdrop-filter') v = 'none';
        else if (k === 'box-shadow') v = root.PPPixelHart ? root.PPPixelHart.box(v) : schattenHart(v, raster);
        else if (k === 'text-shadow') v = root.PPPixelHart ? root.PPPixelHart.text(v) : schattenHart(v, raster);
        if (FARBE.test(k) || k === 'box-shadow' || k === 'text-shadow' || k === 'filter') v = snapFarben(v);
        aus[j][p] = v;
      }
    }
    if (!pe && !svgInnen && (props.includes('width') || props.includes('height'))) { try { ringBacken(el, cs, aus, raster, n); } catch (e) { if (KONFIG.debug) console.warn('[PPPixelAnim.ring]', e); } }
    return aus;
  }

  /**
   * ★ W86p: Ring mit animierter GROESSE (`border-radius: 50 %` + `border`, durchsichtige Flaeche — Druckwellen, Zielringe): der Browser malt den Bogen als
   * Vektor, jede Randpixel bekommt Teildeckkraft (Mischfarben ausserhalb der Palette). Je Bild wird der Ring stattdessen als Pixelbild gemalt (Kunstpixel-
   * Raster, Palettenfarbe, deckend) und der Rand durchsichtig gesetzt; die Groesse (Layout) bleibt unveraendert.
   */
  const _ringCache = new Map();
  function ringBild(nx, ny, d, rgb) {
    const key = nx + 'x' + ny + ':' + d + ':' + rgb.join(',');
    let u = _ringCache.get(key);
    if (u !== undefined) return u;
    const [cv, g] = neuesCanvas(nx, ny);
    const id = g.createImageData(nx, ny), dat = id.data;
    const ax = nx / 2, ay = ny / 2, bx = Math.max(0.0001, ax - d), by = Math.max(0.0001, ay - d);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const ux = x + 0.5 - ax, uy = y + 0.5 - ay;
      const aussen = (ux * ux) / (ax * ax) + (uy * uy) / (ay * ay) <= 1;
      const innen = ax - d > 0.5 && ay - d > 0.5 && (ux * ux) / (bx * bx) + (uy * uy) / (by * by) < 1;
      if (aussen && !innen) { const i = (y * nx + x) * 4; dat[i] = rgb[0]; dat[i + 1] = rgb[1]; dat[i + 2] = rgb[2]; dat[i + 3] = 255; }
    }
    g.putImageData(id, 0, 0);
    try { u = cv.toDataURL('image/png'); } catch (e) { u = ''; }
    if (_ringCache.size > 300) _ringCache.clear();
    _ringCache.set(key, u);
    return u;
  }
  function ringBacken(el, cs, aus, raster, n) {
    const bw = parseFloat(cs.borderTopWidth) || 0;
    if (!(bw > 0) || cs.borderTopStyle !== 'solid') return;
    const bc = farbeRgba(cs.borderTopColor);
    if (!bc || bc[3] < 0.5) return;
    const bg = farbeRgba(cs.backgroundColor);
    if ((bg && bg[3] > 0.03) || (cs.backgroundImage && cs.backgroundImage !== 'none')) return;
    const rr = cs.borderTopLeftRadius || '0px';
    const rund = /%/.test(rr) ? parseFloat(rr) >= 45 : parseFloat(rr) >= Math.min(el.offsetWidth, el.offsetHeight) / 2 - 1;
    if (!rund) return;
    if (!(raster > 0)) raster = KONFIG.px;
    const rgb = root.ppSnapRgb ? root.ppSnapRgb(bc[0] | 0, bc[1] | 0, bc[2] | 0) : [bc[0] | 0, bc[1] | 0, bc[2] | 0];
    const bb = cs.boxSizing === 'border-box';
    const mass = (v, fallback) => { const f = parseFloat(v); return f >= 0 ? f : fallback; };
    const W0 = el.offsetWidth, H0 = el.offsetHeight;
    const d = Math.max(1, Math.round(bw / raster));
    const bilder = [];
    for (let j = 0; j < n; j++) {
      const w = mass(aus[j].width, bb ? W0 : W0 - 2 * bw), h = mass(aus[j].height, bb ? H0 : H0 - 2 * bw);
      const AW = bb ? w : w + 2 * bw, AH = bb ? h : h + 2 * bw;
      const nx = Math.max(2, Math.round(AW / raster)), ny = Math.max(2, Math.round(AH / raster));
      const u = ringBild(nx, ny, d, rgb);
      if (!u) return;
      bilder.push(u);
    }
    for (let j = 0; j < n; j++) { aus[j].backgroundImage = `url("${bilder[j]}")`; aus[j].borderColor = 'transparent'; }
    const st = el.style;
    st.setProperty('background-size', '100% 100%'); st.setProperty('background-origin', 'border-box'); st.setProperty('background-repeat', 'no-repeat');
    st.setProperty('image-rendering', 'pixelated');
    stat.ringe = (stat.ringe || 0) + 1;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  6) DREHUNG ALS SPRITE (RotSprite-artig)
  //     Gedrehte Elemente, die nur aus Pixelbildern/Farbflaechen bestehen, werden einmal ins Kunstpixelraster gemalt (`malen`) und je Winkel/
  //     Skalierung neu gesampelt (`drehen`, rein). Das Element zeigt dann das fertige Bild (Hintergrund) und dreht NICHT mehr per CSS —
  //     jedes Bild ist Pixelart, die Kanten bleiben hart. Alles, was nicht so einfach ist (Text, SVG, bewegte Kinder), dreht nur in
  //     Viertelschritten (verlustfrei).
  // ════════════════════════════════════════════════════════════════════════
  const spriteZustand = new WeakMap();         // Element → { url, w, h } (schon umgebaut)
  const _farbBildCache = new Map();            // url|farbe → data-URL des eingefaerbten Zeichens
  const _drehCache = new Map();                // Schluessel → Ergebnis von drehen()
  const _spriteUrlCache = new Map();           // Schluessel → data-URL
  const _imgCache = new Map();                 // url → HTMLImageElement (geladen) | null
  const CACHE_MAX = 600;

  const farbeRgba = (s) => {
    const m = /rgba?\(([^)]*)\)/.exec(s || ''); if (!m) return null;
    const v = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
  };
  const hash = (data) => { let h = 2166136261; for (let i = 0; i < data.length; i += 7) h = Math.imul(h ^ data[i], 16777619); return (h >>> 0).toString(36); };

  /** Quelle (Registry-Canvas oder geladenes <img>) als Zeichenquelle; null, wenn nicht sofort verfuegbar. */
  function bildQuelle(url) {
    const c = bildVon(url);
    if (c) return c;
    if (_imgCache.has(url)) { const im = _imgCache.get(url); return im && im.complete && im.naturalWidth ? im : null; }
    try { const im = new Image(); im.src = url; _imgCache.set(url, im); if (_imgCache.size > 200) _imgCache.delete(_imgCache.keys().next().value); return im.complete && im.naturalWidth ? im : null; }
    catch (e) { return null; }
  }
  const quellW = (q) => q.naturalWidth || q.width, quellH = (q) => q.naturalHeight || q.height;

  function neuesCanvas(w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
    return [cv, g];
  }
  /** Eckenradien (Kunstpixel) aus einem ImageData-Canvas ausstanzen. */
  function eckenRunden(g, sw, sh, r) {
    // r = [tl, tr, br, bl]
    const id = g.getImageData(0, 0, sw, sh), d = id.data;
    const aus = (x, y, rr, cx, cy) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; return dx * dx + dy * dy > rr * rr; };
    const ecke = (rr, x0, y0, cx, cy) => {
      for (let y = y0; y < y0 + rr && y < sh; y++) for (let x = x0; x < x0 + rr && x < sw; x++) if (aus(x, y, rr, cx, cy)) d[(y * sw + x) * 4 + 3] = 0;
    };
    const m = Math.min(sw, sh) / 2;
    const [tl, tr, br, bl] = r.map(v => Math.min(Math.round(v), Math.floor(m)));
    if (tl > 0) ecke(tl, 0, 0, tl, tl);
    if (tr > 0) ecke(tr, sw - tr, 0, sw - tr, tr);
    if (br > 0) ecke(br, sw - br, sh - br, sw - br, sh - br);
    if (bl > 0) ecke(bl, 0, sh - bl, bl, sh - bl);
    g.putImageData(id, 0, 0);
  }

  /** Eigene Malerei eines Elements (Hintergrundfarbe, -bilder, Rahmen, Maske) → Canvas in Kunstpixeln; null wenn nicht darstellbar. */
  function eigeneMalerei(el, cs, P, W, H) {
    const sw = Math.max(1, Math.round(W / P)), sh = Math.max(1, Math.round(H / P));
    const [cv, g] = neuesCanvas(sw, sh);
    const bc = farbeRgba(cs.backgroundColor);
    if (bc && bc[3] >= 0.5) { g.fillStyle = `rgb(${bc[0]},${bc[1]},${bc[2]})`; g.fillRect(0, 0, sw, sh); }
    const bi = cs.backgroundImage;
    if (bi && bi !== 'none') {
      const teile = listeTeilen(bi);
      const sizes = listeTeilen(cs.backgroundSize || 'auto'), poss = listeTeilen(cs.backgroundPosition || '0% 0%'), reps = listeTeilen(cs.backgroundRepeat || 'repeat');
      for (let i = teile.length - 1; i >= 0; i--) {
        const m = /^url\((["']?)([\s\S]*)\1\)$/.exec(teile[i]);
        if (!m) return null;                                   // Verlauf o. ae.: nicht darstellbar
        const q = bildQuelle(m[2]); if (!q) return null;
        const iw = quellW(q), ih = quellH(q);
        const tok = (sizes[i % sizes.length] || 'auto').split(/\s+/);
        let lw, lh;
        const mass = (t, ganz, nat) => t === 'auto' || t == null ? null : /%$/.test(t) ? parseFloat(t) / 100 * ganz : /px$/.test(t) ? parseFloat(t) / P : nat;
        if (tok[0] === 'cover' || tok[0] === 'contain') {
          const k = tok[0] === 'cover' ? Math.max(sw / iw, sh / ih) : Math.min(sw / iw, sh / ih); lw = iw * k; lh = ih * k;
        } else {
          lw = mass(tok[0], sw, iw); lh = mass(tok[1] || 'auto', sh, ih);
          if (lw == null && lh == null) { lw = iw; lh = ih; }
          else if (lw == null) lw = lh * iw / ih; else if (lh == null) lh = lw * ih / iw;
        }
        lw = Math.max(1, Math.round(lw)); lh = Math.max(1, Math.round(lh));
        const pt = (poss[i % poss.length] || '0% 0%').split(/\s+/);
        const pos = (t, frei) => /%$/.test(t) ? parseFloat(t) / 100 * frei : /px$/.test(t) ? parseFloat(t) / P : 0;
        const dx = Math.round(pos(pt[0], sw - lw)), dy = Math.round(pos(pt[1] || pt[0], sh - lh));
        const rp = (reps[i % reps.length] || 'repeat').split(/\s+/)[0];
        if (rp === 'no-repeat') g.drawImage(q, 0, 0, iw, ih, dx, dy, lw, lh);
        else if (rp === 'repeat' || rp === 'repeat-x' || rp === 'repeat-y') {
          const x0 = rp === 'repeat-y' ? dx : ((dx % lw) - lw) % lw, y0 = rp === 'repeat-x' ? dy : ((dy % lh) - lh) % lh;
          const xe = rp === 'repeat-y' ? dx + 1 : sw, ye = rp === 'repeat-x' ? dy + 1 : sh;
          for (let y = y0; y < ye; y += lh) for (let x = x0; x < xe; x += lw) g.drawImage(q, 0, 0, iw, ih, x, y, lw, lh);
        } else return null;
      }
    }
    // Rahmen (gleichmaessig)
    const bw = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map(parseFloat);
    const bcf = farbeRgba(cs.borderTopColor);
    if (bw.some(v => v > 0) && cs.borderTopStyle !== 'none' && bcf && bcf[3] >= 0.3) {
      g.fillStyle = `rgb(${bcf[0]},${bcf[1]},${bcf[2]})`;
      const w = bw.map(v => v > 0 ? Math.max(1, Math.round(v / P)) : 0);
      g.fillRect(0, 0, sw, w[0]); g.fillRect(sw - w[1], 0, w[1], sh); g.fillRect(0, sh - w[2], sw, w[2]); g.fillRect(0, 0, w[3], sh);
    }
    // Eckenradius
    const rad = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius]
      .map(v => /%$/.test(v) ? parseFloat(v) / 100 * Math.min(W, H) / P : (parseFloat(v) || 0) / P);
    if (rad.some(v => v > 0.4)) eckenRunden(g, sw, sh, rad);
    // Maske (nur die Pixelierer-Ellipse: ein PNG; Dither-Kacheln dieses Moduls zaehlen nicht)
    const mi = cs.maskImage;
    if (mi && mi !== 'none') {
      const urls = listeTeilen(mi).map(t => /^url\((["']?)([\s\S]*)\1\)$/.exec(t)).filter(Boolean).map(m => m[2]).filter(u => !/^data:image\/svg\+xml/.test(u));
      for (const u of urls) {
        const q = bildQuelle(u); if (!q) return null;
        const [mc, mg] = neuesCanvas(sw, sh);
        mg.drawImage(q, 0, 0, quellW(q), quellH(q), 0, 0, sw, sh);
        g.globalCompositeOperation = 'destination-in'; g.drawImage(mc, 0, 0); g.globalCompositeOperation = 'source-over';
      }
    }
    return { cv, g, sw, sh };
  }

  /** Element samt statischer Kinder → { w, h, data, qx, qy, kinder:[Element] } (Kunstpixel, linke obere Ecke bei (qx, qy) px relativ zur Box) oder null. */
  function malen(el, P, tiefe) {
    tiefe = tiefe || 0;
    if (tiefe > 4) return null;
    const cs = getComputedStyle(el);
    const W = el.offsetWidth, H = el.offsetHeight;
    if (!(W > 0 && H > 0)) return null;
    // echter Text oder Bild-/Canvas-Inhalt
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.nodeValue.trim()) { const c = farbeRgba(cs.color); if (!c || c[3] > 0.05) return null; }
    }
    if (el instanceof SVGElement) return null;
    const eig = eigeneMalerei(el, cs, P, W, H);
    if (!eig) return null;
    let x0 = 0, y0 = 0, x1 = W, y1 = H;
    const teile = [], kinder = [];
    for (const c of el.children) {
      if (MALT_NICHT.has(c.tagName)) continue;
      const ccs = getComputedStyle(c);
      if (ccs.display === 'none') continue;
      if (!(c instanceof HTMLElement) || ccs.transform !== 'none' || (ccs.opacity !== '1' && ccs.opacity !== '0') || c.getAnimations().length || c.offsetParent !== el) return null;
      if (ccs.opacity === '0' || ccs.visibility === 'hidden') continue;
      const k = malen(c, P, tiefe + 1); if (!k) return null;
      const cx = c.offsetLeft + k.qx, cy = c.offsetTop + k.qy;
      teile.push({ k, cx, cy }); kinder.push(c, ...k.kinder);
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx + k.w * P); y1 = Math.max(y1, cy + k.h * P);
    }
    // Eigene Box (+ Kinder) auf eine gemeinsame Leinwand
    const ux = Math.floor(x0 / P) * P, uy = Math.floor(y0 / P) * P;
    const w = Math.max(1, Math.ceil((x1 - ux) / P)), h = Math.max(1, Math.ceil((y1 - uy) / P));
    if (w > KONFIG.spriteMax || h > KONFIG.spriteMax) return null;
    const [cv, g] = neuesCanvas(w, h);
    // Reihenfolge wie im DOM: erst die Box selbst (Hintergrund), dann die Kinder; negative z-Index-Kinder (Halos) liegen darunter
    g.drawImage(eig.cv, Math.round(-ux / P), Math.round(-uy / P));
    for (const t of teile) g.drawImage(t.k.cv, Math.round((t.cx - ux) / P), Math.round((t.cy - uy) / P));
    const id = g.getImageData(0, 0, w, h);
    return { w, h, data: id.data, cv, qx: ux, qy: uy, kinder };
  }

  /** Zu welchem Element-Typ passt der Sprite-Weg? absolut/fix positioniert, HTML, ohne Text, ohne eigene Variablen-Spielereien. */
  function spriteMoeglich(el, cs) {
    if (!(el instanceof HTMLElement) || spriteZustand.has(el)) return false;
    const pos = cs.position;
    if (pos !== 'absolute' && pos !== 'fixed') return false;
    if (cs.display === 'none' || cs.display === 'contents') return false;
    // `malen` malt nur Hintergruende/Rahmen, nie <img>/<canvas>/<video>-Inhalt — ein Element mit Kartenbild darin (fliegende Karten: Ziehen, Suchen) wuerde zum leeren Sprite und seine echten Kinder verschwaenden.
    if (el.querySelector('img, canvas, video')) return false;
    return true;
  }

  /** Bild aus Sprite-Ergebnis in die gemeinsame Huelle (hx, hy, hw, hh: px relativ zur Box; Vielfache des Rasters) setzen → data-URL. */
  function spriteUrl(res, schluessel, hx, hy, hw, hh, P) {
    const k = schluessel + '|' + hx + ',' + hy + ',' + hw + ',' + hh;
    let u = _spriteUrlCache.get(k);
    if (u !== undefined) return u;
    const nw = Math.round(hw / P), nh = Math.round(hh / P);
    const [cv, g] = neuesCanvas(nw, nh);
    const id = g.createImageData(res.w, res.h); id.data.set(res.data);
    const [tc, tg] = neuesCanvas(res.w, res.h); tg.putImageData(id, 0, 0);
    g.drawImage(tc, Math.round((res.x0 - hx) / P), Math.round((res.y0 - hy) / P));
    try { u = cv.toDataURL('image/png'); } catch (e) { u = ''; }
    if (_spriteUrlCache.size > CACHE_MAX) _spriteUrlCache.delete(_spriteUrlCache.keys().next().value);
    _spriteUrlCache.set(k, u);
    return u;
  }

  /**
   * Gedrehtes/skaliertes Blatt-Element als Sprite-Bildfolge.  `mats` = Matrix je Bild (CSS, um den Transform-Ursprung `O`).
   * `animiert`: Winkel auf `drehStufe` Grad rastern (sonst 1 Grad).  Liefert { bilder:[{url, tx, ty}|null], kasten:{x,y,w,h}, quelle } oder null.
   */
  function spriteBilder(el, cs, mats, W, H, raster, animiert, filterListe) {
    const quelle = malen(el, raster, 0);
    if (!quelle) return null;
    if (filterListe && filterListe.length) {                 // Farbfilter einmal in die Quellpixel rechnen (und auf die Palette rasten)
      const d = quelle.data, snap = root.ppSnapRgb;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3]) {
        const c = farbFilterAnwenden(filterListe, d[i], d[i + 1], d[i + 2]), q = snap ? snap(c[0], c[1], c[2]) : c;
        d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2];
      }
    }
    const O = ursprungVon(cs, W, H);
    const qkey = (filterListe && filterListe.length ? 'F' : '') + hash(quelle.data) + ':' + quelle.w + 'x' + quelle.h + ':' + quelle.qx + ',' + quelle.qy;
    const ergebnisse = [];
    for (const m of mats) {
      const z = m && zerlegen(m);
      if (!z) { ergebnisse.push(null); continue; }
      const rot = animiert ? winkelSnap(z.rot, KONFIG.drehStufe) : Math.round(z.rot);
      const sx = snapScale(z.sx, W, raster), sy = snapScale(z.sy, H, raster);
      const tx = snapPx(z.tx, raster), ty = snapPx(z.ty, raster);
      if (!sx || !sy) { ergebnisse.push({ leer: true, tx, ty }); continue; }
      const L = zusammensetzen({ rot, sx, sy, tx: 0, ty: 0 }).slice(0, 4);
      const key = qkey + '|' + L.map(v => v.toFixed(4)).join(',') + '|' + O.map(v => v.toFixed(1)).join(',') + '|' + raster;
      let r = _drehCache.get(key);
      if (r === undefined) {
        r = drehen({ w: quelle.w, h: quelle.h, data: quelle.data }, quelle.qx, quelle.qy, L, O, { raster });
        if (_drehCache.size > CACHE_MAX) _drehCache.delete(_drehCache.keys().next().value);
        _drehCache.set(key, r);
      }
      ergebnisse.push({ r, key, tx, ty });
    }
    // gemeinsame Huelle
    let hx0 = Infinity, hy0 = Infinity, hx1 = -Infinity, hy1 = -Infinity;
    for (const e of ergebnisse) if (e && e.r) { hx0 = Math.min(hx0, e.r.x0); hy0 = Math.min(hy0, e.r.y0); hx1 = Math.max(hx1, e.r.x0 + e.r.w * raster); hy1 = Math.max(hy1, e.r.y0 + e.r.h * raster); }
    if (!Number.isFinite(hx0)) { hx0 = 0; hy0 = 0; hx1 = raster; hy1 = raster; }
    const hw = hx1 - hx0, hh = hy1 - hy0;
    if (hw / raster > KONFIG.spriteMax || hh / raster > KONFIG.spriteMax) return null;
    const bilder = ergebnisse.map(e => e ? { url: e.r ? spriteUrl(e.r, e.key, hx0, hy0, hw, hh, raster) : '', tx: e.tx, ty: e.ty } : null);
    stat.sprites++;
    return { bilder, kasten: { x: hx0, y: hy0, w: hw, h: hh }, quelle };
  }

  /** Element auf den Sprite-Kasten umbauen (Groesse, Lage, Hintergrund); gemalte Kinder ausblenden. */
  function spriteAnwenden(el, cs, sp, bildUrl) {
    const st = el.style;
    const links = parseFloat(cs.left), oben = parseFloat(cs.top);
    if (!Number.isFinite(links) || !Number.isFinite(oben)) return false;
    st.setProperty('left', zk(links + sp.kasten.x) + 'px'); st.setProperty('top', zk(oben + sp.kasten.y) + 'px');
    st.setProperty('right', 'auto'); st.setProperty('bottom', 'auto');
    st.setProperty('width', sp.kasten.w + 'px'); st.setProperty('height', sp.kasten.h + 'px');
    st.setProperty('box-sizing', 'border-box'); st.setProperty('padding', '0'); st.setProperty('border-width', '0');
    st.setProperty('border-radius', '0'); st.setProperty('background-color', 'transparent');
    st.setProperty('background-image', bildUrl ? `url("${bildUrl}")` : 'none');
    st.setProperty('background-size', '100% 100%'); st.setProperty('background-repeat', 'no-repeat');
    st.setProperty('background-position', '0 0'); st.setProperty('background-origin', 'border-box'); st.setProperty('background-clip', 'border-box');
    st.setProperty('image-rendering', 'pixelated');
    const z = maskeZustand.get(el);
    if (z) maskeListen(st, cs, null, `var(${z.vn})`); else st.setProperty('mask-image', 'none');
    for (const c of sp.quelle.kinder) c.style.setProperty('display', 'none');
    for (const c of el.children) if (!MALT_NICHT.has(c.tagName)) c.style.setProperty('display', 'none');
    spriteZustand.set(el, { kasten: sp.kasten });
    return true;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  5) ANBINDUNG: Wurzeln, Ereignisse
  // ════════════════════════════════════════════════════════════════════════
  function animationenUnter(wurzel) {
    try {
      if (wurzel.getAnimations) return wurzel.getAnimations({ subtree: true });
    } catch (e) { /* alt */ }
    return document.getAnimations().filter(a => a.effect && a.effect.target && wurzel.contains(a.effect.target));
  }
  /** Alle (noch nicht gebackenen) Animationen unter `wurzel` jetzt umbauen. Gibt die Zahl der umgebauten zurueck. */
  function backenAlle(wurzel) {
    if (!KONFIG.aktiv || !wurzel || root._playAnimations === false) return 0;
    let n = 0;
    try {
      const alle = animationenUnter(wurzel).filter(a => !gebacken.has(a));
      const budget = { rest: KONFIG.budget, offen: alle.length };
      n = backenStapel(alle, budget);
    } catch (e) { if (KONFIG.debug) console.warn('[PPPixelAnim]', e); }
    return n;
  }

  // ── Statische Reste: halbe Deckkraft, Alpha-Hintergruende, gebrochene/gedrehte Transformationen ──
  // Alles, was nicht von einer Animation gesteuert wird (die backt `backen`), aber ruhend halbdurchsichtig oder unscharf steht:
  //   opacity < 1            → Dither-Maske (wie in der Animation)
  //   rgba()-Hintergrundfarbe → Dither-Kachel in der (palettengerasteten) Farbe
  //   transform              → Verschiebung auf Kunstpixel, Skalierung auf 1/raster-Schritte, Drehung als Sprite (sonst unveraendert)
  function statisch(wurzel) {
    if (!KONFIG.aktiv || !wurzel || !wurzel.querySelectorAll || root._playAnimations === false) return 0;
    const animOpa = new Set(), animTr = new Set();
    for (const a of animationenUnter(wurzel)) {
      let el, kfs;
      try { el = a.effect && a.effect.target; kfs = a.effect.getKeyframes(); } catch (e) { continue; }
      if (!el) continue;
      for (const k of kfs) { if ('opacity' in k) animOpa.add(el); if ('transform' in k || 'rotate' in k || 'scale' in k || 'translate' in k) animTr.add(el); }
    }
    const liste = [wurzel, ...wurzel.querySelectorAll('*')];
    const auftraege = [];
    let svgN = 0;
    for (const el of liste) {                                    // ── SVG: Weichzeichner-Filter an Formen entfernen, harte Kanten ──
      if (!(el instanceof SVGElement) || (el.closest && el.closest('[data-pp-px="aus"]'))) continue;
      const cs2 = getComputedStyle(el);
      const f = cs2.filter;
      if (f && /blur\(|drop-shadow\(/.test(f)) { el.style.setProperty('filter', filterBereinigen(f)); svgN++; }
      if (cs2.mixBlendMode && cs2.mixBlendMode !== 'normal') { el.style.setProperty('mix-blend-mode', 'normal'); svgN++; }
      // Farben mit Alpha an SVG-Formen (stroke/fill): ab 50 % deckend in der Farbe, darunter weg; Linien mindestens 1 px dick (Haarlinien malt der Browser weich)
      if (el.ownerSVGElement) {
        for (const pr of ['stroke', 'fill']) {
          const c = farbeRgba(cs2.getPropertyValue(pr));
          if (c && c[3] > 0.03 && c[3] < 0.97) { el.style.setProperty(pr, c[3] >= 0.5 ? `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})` : 'none'); svgN++; }
        }
        const sw = parseFloat(cs2.strokeWidth);
        if (sw > 0 && sw < 1 && cs2.stroke !== 'none') { el.style.setProperty('stroke-width', '1px'); svgN++; }
      }
      // Deckkraft von SVG-Formen: ein/aus ab 50 % (Masken gibt es nur an HTML-Elementen und der <svg>-Wurzel)
      if (el.ownerSVGElement) for (const pr of ['opacity', 'fill-opacity', 'stroke-opacity']) {
        const v = parseFloat(cs2.getPropertyValue(pr));
        if (v > 0.03 && v < 0.97 && !animOpa.has(el)) { el.style.setProperty(pr, v >= 0.5 ? '1' : '0'); svgN++; }
      }
      if (el.tagName.toLowerCase() === 'svg' || el.ownerSVGElement) el.setAttribute('shape-rendering', 'crispEdges');
    }
    for (const el of liste) {                                    // ── Lesen ──
      if (!(el instanceof HTMLElement) || MALT_NICHT.has(el.tagName) || el.tagName === 'IMG' || el.tagName === 'CANVAS') continue;
      if (el.closest('[data-pp-px="aus"]')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      const a = { el };
      const op = parseFloat(cs.opacity);
      if (op > 0.03 && op < 0.97 && !animOpa.has(el)) a.opa = op;
      if (!cs.backgroundImage || cs.backgroundImage === 'none') {
        const bc = farbeRgba(cs.backgroundColor);
        if (bc && bc[3] > 0.03 && bc[3] < 0.97) a.bg = bc;
      } else {
        // ★ W86p: Bild UND halbdurchsichtige Grundfarbe (z. B. Partikel-Regel `background: url(schatten), var(--color) !important` mit rgba-Farbe): die Farbe
        // mischte sich mit dem Untergrund (Farbe ausserhalb der Palette). Wie bei SVG-Formen: ab 50 % deckend in der Farbe, darunter weg.
        const bc = farbeRgba(cs.backgroundColor);
        if (bc && bc[3] > 0.03 && bc[3] < 0.97) a.bgUnter = bc;
      }
      if (animTr.has(el)) {
        // Die Animation uebernimmt die Transformation — der ruhende Inline-Wert vor ihrem Start (Delay) darf trotzdem nicht gedreht stehen.
        const inl = el.style.transform;
        if (inl && /rotate|skew|matrix/.test(inl)) a.basis = inl;
      } else if (cs.transform !== 'none') {
        const m = matrixLesen(cs.transform);
        if (m) {
          const z = zerlegen(m);
          const W = el.offsetWidth, H = el.offsetHeight, P = rasterVon(cs);
          const q = z && transformQuantisieren(m, W, H, P, 0);
          const dreht = z && !rechtwinklig(z.rot);
          const anders = q && (Math.abs(q.z.sx - z.sx) > 0.01 || Math.abs(q.z.sy - z.sy) > 0.01 || Math.abs(q.z.tx - z.tx) > 0.05 || Math.abs(q.z.ty - z.ty) > 0.05);
          if (z && (dreht || anders)) a.tr = { m, z, q, W, H, P, dreht };
        }
      }
      // Farbmischung mit dem Hintergrund (mix-blend-mode) und reine Farbfilter sind keine Pixelart: Mischmodus → normal, Filter → ins Sprite gerechnet
      if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') a.misch = true;
      if (cs.filter && cs.filter !== 'none' && FILTER_NUR_FARBE.test(cs.filter)) a.farbFilter = cs.filter;
      // Einfarbige Pixel-Zeichen (PxZeichen/PxIcon: `background: currentColor` + Sprite als `mask`): der Browser streckt Masken weich → jede Pixelkante
      // bekommt Alpha. Als eingefaerbtes Bild (`image-rendering: pixelated`) bleiben die Kanten hart.
      if (cs.maskImage && cs.maskImage !== 'none' && (!cs.backgroundImage || cs.backgroundImage === 'none')) {
        const mm = /^url\((["']?)([\s\S]*)\1\)$/.exec(cs.maskImage.trim());
        const bcol = farbeRgba(cs.backgroundColor);
        if (mm && bildVon(mm[2]) && bcol && bcol[3] >= 0.5) a.maskBild = { url: mm[2], farbe: bcol, groesse: cs.maskSize, lage: cs.maskPosition, wdh: cs.maskRepeat };
      }
      if (el.classList.contains('pp-px') && cs.display === 'inline-block' && /em\)?$|calc\(/.test((el.getAttribute('style') || '').match(/width:\s*([^;]*)/) ? el.getAttribute('style').match(/width:\s*([^;]*)/)[1] : '')) a.pxBox = [el.offsetWidth, el.offsetHeight];
      if (a.opa !== undefined || a.bg || a.bgUnter || a.tr || a.basis || a.maskBild || a.pxBox || a.misch || a.farbFilter) auftraege.push(a);
    }
    let n = 0;
    for (const a of auftraege) {                                 // ── Schreiben ──
      const el = a.el, cs = getComputedStyle(el);
      try {
        if (a.misch) { el.style.setProperty('mix-blend-mode', 'normal'); n++; }
        if (a.farbFilter) {
          if (spriteMoeglich(el, cs)) {
            const W = el.offsetWidth, H = el.offsetHeight, P = rasterVon(cs);
            const sp = spriteBilder(el, cs, [[1, 0, 0, 1, 0, 0]], W, H, P, false, farbFilterLesen(a.farbFilter));
            if (sp && spriteAnwenden(el, cs, sp, sp.bilder[0] && sp.bilder[0].url)) { el.style.setProperty('filter', 'none'); n++; } else stat.rueckfall++;
          } else stat.rueckfall++;
        }
        if (a.pxBox) {   // Pixel-Zeichen (PxZeichen/PxIcon) mit em-Mass: feste gerade Pixelgroesse
          el.style.setProperty('width', Math.max(2, Math.round(a.pxBox[0] / 2) * 2) + 'px'); el.style.setProperty('height', Math.max(2, Math.round(a.pxBox[1] / 2) * 2) + 'px'); n++;
        }
        if (a.maskBild) {
          const m = a.maskBild, k = m.url + '|' + m.farbe.join(',');
          let u = _farbBildCache.get(k);
          if (u === undefined) {
            const q = bildVon(m.url), [cv, g] = neuesCanvas(q.width, q.height);
            const rgb = root.ppSnapRgb ? root.ppSnapRgb(m.farbe[0], m.farbe[1], m.farbe[2]) : m.farbe;
            g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; g.fillRect(0, 0, cv.width, cv.height);
            g.globalCompositeOperation = 'destination-in'; g.drawImage(q, 0, 0);
            try { u = cv.toDataURL('image/png'); } catch (e) { u = ''; }
            if (_farbBildCache.size > 400) _farbBildCache.clear();
            _farbBildCache.set(k, u);
          }
          if (u) {
            const st = el.style;
            st.setProperty('background-color', 'transparent'); st.setProperty('background-image', `url("${u}")`);
            st.setProperty('background-size', m.groesse); st.setProperty('background-position', m.lage); st.setProperty('background-repeat', m.wdh);
            st.setProperty('image-rendering', 'pixelated'); st.setProperty('mask-image', 'none'); st.setProperty('-webkit-mask-image', 'none');
            n++;
          }
        }
        if (a.basis) {
          try {
            const m = new DOMMatrix(a.basis), P = rasterVon(cs);
            const q = transformQuantisieren([m.a, m.b, m.c, m.d, m.e, m.f], el.offsetWidth, el.offsetHeight, P, 90);
            if (q) { el.style.setProperty('transform', q.css); n++; }
          } catch (e) { /* Prozent o. ae.: bleibt */ }
        }
        if (a.tr) {
          let gemacht = false;
          if (a.tr.dreht && spriteMoeglich(el, cs)) {
            const sp = spriteBilder(el, cs, [a.tr.m], a.tr.W, a.tr.H, a.tr.P, false);
            if (sp && spriteAnwenden(el, cs, sp, sp.bilder[0] && sp.bilder[0].url)) {
              const b = sp.bilder[0]; el.style.setProperty('transform', b && (b.tx || b.ty) ? `translate(${zk(b.tx)}px, ${zk(b.ty)}px)` : 'none'); gemacht = true;
            } else stat.rueckfall++;
          }
          if (!gemacht && !a.tr.dreht) el.style.setProperty('transform', a.tr.q.css);
          else if (!gemacht) stat.rueckfall++;
          n++;
        }
        if (a.opa !== undefined) {
          const stufe = ditherStufe(a.opa);
          const z = maskeVorbereiten(el, cs);
          el.style.setProperty('opacity', stufe === 0 ? '0' : '1');
          el.style.setProperty(z.vn, ditherMaske(stufe === 0 ? 1 : stufe));
          n++;
        }
        if (a.bgUnter) {
          const c = a.bgUnter;
          el.style.setProperty('background-color', c[3] >= 0.5 ? snapFarben(`rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`) : 'transparent', 'important');
          n++;
        }
        if (a.bg) {
          const stufe = ditherStufe(a.bg[3]);
          const farbe = snapFarben(`rgb(${Math.round(a.bg[0])},${Math.round(a.bg[1])},${Math.round(a.bg[2])})`);
          const st = el.style;
          st.setProperty('background-color', 'transparent');
          if (stufe > 0) {
            st.setProperty('background-image', ditherFarbe(stufe, farbe));
            st.setProperty('background-size', `${4 * KONFIG.ditherPx}px ${4 * KONFIG.ditherPx}px`);
            st.setProperty('background-repeat', 'repeat'); st.setProperty('background-position', '0 0'); st.setProperty('image-rendering', 'pixelated');
          }
          n++;
        }
      } catch (e) { if (KONFIG.debug) console.warn('[PPPixelAnim.statisch]', e); }
    }
    return n + svgN;
  }

  // ── Geometrie auf ganze Pixel ──
  // Kanten auf halben Pixeln werden vom Browser weich ueberblendet (Alpha am Rand jedes Sprites, jeder Dither-Zelle). Skaliert ein Element
  // um seine Mitte auf n/2-fache Groesse (siehe snapScale), liegen seine Kanten nur dann auf ganzen Pixeln, wenn Breite/Hoehe durch 4 teilbar
  // sind (Faktor 1,5 · 4k = 6k). Absolut/fix gesetzte Elemente mit Bruchzahlen oder ungeraden Massen in `left/top/right/bottom/margin-*`
  // und `width/height` (Inline-Stil, px) bekommen darum gerade Werte bzw. Vielfache von 4; die Mitte bleibt dabei an ihrem Platz (left/top
  // wandern um die halbe Aenderung). Prozent, calc() und Variablen bleiben unberuehrt.
  const POS_PROPS = ['left', 'top', 'right', 'bottom', 'margin-left', 'margin-top', 'margin-right', 'margin-bottom'];
  function geometrieRunden(wurzel) {
    if (!KONFIG.aktiv || !wurzel || !wurzel.querySelectorAll) return 0;
    let n = 0;
    const liste = wurzel.matches && wurzel.matches('[style]') ? [wurzel, ...wurzel.querySelectorAll('[style]')] : wurzel.querySelectorAll('[style]');
    for (const el of liste) {
      if (el.closest && el.closest('[data-pp-px="aus"]')) continue;
      const st = el.style;
      const px = (pr) => { const v = st.getPropertyValue(pr); return v && /^-?\d*\.?\d+px$/.test(v) ? parseFloat(v) : null; };
      const abs = st.position === 'absolute' || st.position === 'fixed';
      // Groesse: Vielfache von 4 (mindestens 4); die Mitte bleibt, indem left/top um die halbe Aenderung wandern
      for (const [gr, lage] of [['width', 'left'], ['height', 'top']]) {
        const f = px(gr); if (f == null || f <= 0) continue;
        const g = Math.max(4, Math.round(f / 4) * 4);
        if (g === f) continue;
        st.setProperty(gr, g + 'px'); n++;
        const l = px(lage);
        if (abs && l != null && st.getPropertyValue(lage === 'left' ? 'right' : 'bottom') === '') st.setProperty(lage, zk(l - (g - f) / 2) + 'px');
      }
      for (const pr of POS_PROPS) {
        const v = px(pr);
        if (v == null || (Number.isInteger(v) && v % 2 === 0)) continue;
        st.setProperty(pr, Math.round(v / 2) * 2 + 'px'); n++;                // gerade: bei Faktor 1,5 bleiben die Kanten ganzzahlig
      }
    }
    return n;
  }

  /**
   * Wurzel dauerhaft betreuen (Areas, eigene Overlays): sofort + fuer jeden spaeter eingehaengten Knoten Geometrie runden (`opt.geometrie`,
   * Standard an), Statisches umbauen (`opt.statisch`, Standard an) und alle Animationen backen. Nur EIN MutationObserver je Wurzel, nur
   * childList. Gibt die Abmeldung zurueck. (GameAnimationRenderer / app-shared.jsx `ppPixeliererAnhaengen` ruft dasselbe in seiner Reihenfolge.)
   */
  function anhaengen(wurzel, opt) {
    opt = opt || {};
    if (!wurzel || !KONFIG.aktiv) return () => {};
    const tun = (k) => {
      try {
        if (opt.geometrie !== false) geometrieRunden(k);
        if (opt.statisch !== false) statisch(k);
        backenAlle(k);
      } catch (e) { if (KONFIG.debug) console.warn('[PPPixelAnim.anhaengen]', e); }
    };
    tun(wurzel);
    let wartend = null;
    const neue = new Set();
    const mo = new MutationObserver((liste) => {
      for (const m of liste) for (const n of m.addedNodes) if (n.nodeType === 1) neue.add(n);
      if (wartend || !neue.size) return;
      wartend = requestAnimationFrame(() => {
        wartend = null;
        const jetzt = Array.from(neue); neue.clear();
        for (const n of jetzt) if (n.isConnected) tun(n);
      });
    });
    mo.observe(wurzel, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (wartend) cancelAnimationFrame(wartend); };
  }

  /**
   * Gedrehtes (und skaliertes) Pixelbild fuer eigene Pixelart-Animationen — der Helfer fuer EINZELNE Animationen, die nicht auf die
   * automatische Umstellung warten: `quelle` = Canvas / <img> (geladen) / { w, h, data }; `grad` = Winkel; Ergebnis { url, w, h, ox, oy }
   * (url = data-URL des Kunstpixel-Bildes, w/h in Kunstpixeln; (ox, oy) = Lage der linken oberen Ecke in px relativ zur MITTE der
   * Quelle). Anzeigen: `<div style={{ position:'absolute', left: ox, top: oy, width: w*raster, height: h*raster, background:`url(${url}) 0 0/100% 100% no-repeat`,
   * imageRendering:'pixelated' }} />`.  `opt`: { raster: 2, stufe: Winkelraster in Grad (0 = ohne), skala: 1 }.
   */
  function drehSpriteUrl(quelle, grad, opt) {
    opt = opt || {};
    const P = opt.raster || KONFIG.px;
    let src = quelle;
    if (quelle && !quelle.data) {                       // Canvas oder <img>
      const w = quelle.naturalWidth || quelle.width, h = quelle.naturalHeight || quelle.height;
      const [cv, g] = neuesCanvas(w, h); g.drawImage(quelle, 0, 0);
      src = { w, h, data: g.getImageData(0, 0, w, h).data };
    }
    const wPx = src.w * P, hPx = src.h * P;
    const rot = opt.stufe ? winkelSnap(grad, opt.stufe) : grad;
    const s = opt.skala || 1;
    const L = zusammensetzen({ rot, sx: s, sy: s, tx: 0, ty: 0 }).slice(0, 4);
    const r = drehen(src, 0, 0, L, [wPx / 2, hPx / 2], { raster: P });
    if (!r) return null;
    const [cv, g] = neuesCanvas(r.w, r.h);
    const id = g.createImageData(r.w, r.h); id.data.set(r.data); g.putImageData(id, 0, 0);
    return { url: cv.toDataURL('image/png'), w: r.w, h: r.h, ox: r.x0 - Math.round(wPx / P / 2) * P, oy: r.y0 - Math.round(hPx / P / 2) * P };
  }

  /**
   * Canvas-Gegenstueck zur Dither-Maske: `zeichnen(ctx)` malt in ein Hilfs-Canvas (w x h), das mit dem Bayer-Raster der Deckkraft `alpha`
   * (0..1, Zellen `raster` px) ausgestanzt auf `ziel` (2D-Kontext) bei (x, y) landet — statt `globalAlpha`.
   */
  function canvasDither(ziel, alpha, zeichnen, x, y, w, h, raster) {
    const P = raster || KONFIG.px, stufe = ditherStufe(alpha);
    if (stufe === 0) return;
    if (stufe >= 16) { ziel.save(); ziel.translate(x, y); zeichnen(ziel); ziel.restore(); return; }
    const [cv, g] = neuesCanvas(Math.ceil(w), Math.ceil(h));
    zeichnen(g);
    const id = g.getImageData(0, 0, cv.width, cv.height), d = id.data;
    for (let j = 0; j < cv.height; j++) for (let i = 0; i < cv.width; i++) {
      const o = (j * cv.width + i) * 4;
      if (d[o + 3] && !ditherAn(stufe, Math.floor(i / P), Math.floor(j / P))) d[o + 3] = 0;
      else if (d[o + 3]) d[o + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    ziel.drawImage(cv, x, y);
  }

  // ── 30-Hz-Schleife fuer JS-getriebene Animationen (Canvas, Zustandsschritte) ──
  // `requestAnimationFrame` laeuft mit der Bildwiederholrate (60/120 Hz). Pixelart-Animationen aus Skript rufen stattdessen `ppTaktRaf(cb)`:
  // der Rueckruf kommt hoechstens einmal je Takt (1/30 s, global ausgerichtet wie alle gebackenen Animationen) mit demselben Zeitstempel wie
  // rAF; Abbruch mit `cancelAnimationFrame(id)` (negative Nummern gehoeren hierher). Ausgeschaltet (Retro): normales rAF.
  const _taktListe = new Map();
  let _taktLaeuft = false, _taktLetzt = -1, _taktId = 0;
  function _taktTick(t) {
    const k = Math.floor(t / TAKT_MS());
    if (k !== _taktLetzt) {
      _taktLetzt = k;
      const l = [..._taktListe]; _taktListe.clear();
      for (const [, cb] of l) { try { cb(t); } catch (e) { console.error(e); } }
    }
    if (_taktListe.size) requestAnimationFrame(_taktTick); else _taktLaeuft = false;
  }
  function taktRaf(cb) {
    if (!KONFIG.aktiv) return requestAnimationFrame(cb);
    const id = -(++_taktId);
    _taktListe.set(id, cb);
    if (!_taktLaeuft) { _taktLaeuft = true; requestAnimationFrame(_taktTick); }
    return id;
  }
  root.ppTaktRaf = taktRaf;
  try {
    const c0 = root.cancelAnimationFrame;
    root.cancelAnimationFrame = function (id) { if (id < 0) { _taktListe.delete(id); return undefined; } return c0.call(root, id); };
  } catch (e) { /* ohne */ }

  let _global = false;
  /** Dokumentweit: jede startende CSS-Animation / jeden CSS-Uebergang / jedes `el.animate()` backen (ohne MutationObserver). */
  function global() {
    if (_global) return; _global = true;
    // Skript-Animationen (`element.animate(…)`, z. B. Karten-Fluege) senden kein `animationstart`: den Aufruf selbst abfangen.
    try {
      const orig = Element.prototype.animate;
      Element.prototype.animate = function (kfs, opts) {
        const a = orig.call(this, kfs, opts);
        try { if (KONFIG.aktiv && root._playAnimations !== false) backen(a, null, true); } catch (e) { /* bleibt ungebacken */ }
        return a;
      };
    } catch (e) { /* ohne */ }
    const behandeln = (e, art) => {
      if (!KONFIG.aktiv || root._playAnimations === false) return;
      const el = e.target; if (!(el instanceof Element) || !el.getAnimations) return;
      let liste; try { liste = e.pseudoElement ? el.getAnimations({ subtree: true }).filter(x => x.effect && x.effect.target === el && x.effect.pseudoElement === e.pseudoElement) : el.getAnimations(); } catch (x) { return; }   // W86u1: ::before/::after
      for (const a of liste) {
        if (gebacken.has(a)) continue;
        if (art === 'a' ? (a.animationName === e.animationName) : (a.transitionProperty === e.propertyName)) backen(a, null, true);
      }
    };
    document.addEventListener('animationstart', (e) => behandeln(e, 'a'), true);
    document.addEventListener('transitionrun', (e) => behandeln(e, 't'), true);
  }

  const api = {
    rein, KONFIG, stat, backen, backenAlle, anhaengen, statisch, geometrieRunden, global, taktRaf, drehSpriteUrl, canvasDither, ditherMaske, ditherStufe, bildRegistrieren, bildVon, cssHilfsset,
    _test: { malen, eigeneMalerei, spriteBilder }, snapPx, snapScale, drehen, aus: (el) => el && el.setAttribute && el.setAttribute('data-pp-px', 'aus'),
  };
  root.PPPixelAnim = api;
  if (root.PP_RETRO) KONFIG.aktiv = false;     // Retro-Modus: eigene Pipeline (retro-core.js), Look bleibt unveraendert
  cssEinhaengen();
  if (KONFIG.aktiv) global();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
