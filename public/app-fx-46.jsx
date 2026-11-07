// app-fx-46: Auftritt der Held-Figuren (Brett) als Skript im 30-Hz-Takt statt als CSS-Animation
//
// ═════════════════════════════════════════════════════════════════
//  Wenn eine Figur auf dem Brett erscheint (`HeroIdleSprite`, app-board.jsx), steigt sie aus der Karte empor (Canvas `.hero-idle-canvas`: 100 % der Höhe → 0
//  in zehn Stufen), leuchtet auf (brightness 2,2 → 1,5 → 1) und ihr Bodenschatten (`.hero-idle-schatten`) wächst von 30 % auf volle Breite. Das waren drei
//  CSS-Animationen (`heroIdleAuftritt`, `heroIdleSchatten`, `heroIdleKlipp`), die der Laufzeit-Backer (pixel-anim.js) bei JEDER Figur abtasten musste
//  (Größe lesen, Probe-Animation, Filter-/Skalierungs-Quantisierung: ~3,5 ms je Auftritt). Filter und prozentuale/gebrochene Skalierung sind nie „schon
//  konform" und lassen sich nicht statisch vorbacken (die Werte hängen an der Figurengröße) — darum rechnet `ppHeldAuftritt` dieselben Bilder selbst:
//    • 17 Bilder (567 ms) im Takt von `ppTaktRaf`, die Stufen/Zeiten sind die, die der Backer aus den alten Keyframes abgetastet hat (steps(10) je
//      Abschnitt, Schatten ease-out);
//    • Versatz und Schattenbreite auf ganzen Hero-Pixeln (Canvas-Höhe / Frame-Höhe; ohne Angabe Kunstpixel 2 px), die Deckkraft des Schattens nur ein/aus (`visibility`; seine Fläche ist < 400 px²);
//    • geschrieben wird nur, wenn sich das Bild ändert, inline `transform`/`filter` am Canvas und `transform`/`visibility` am Schatten; am Ende wird alles
//      wieder entfernt (der Beschnitt `heroIdleKlipp` am Steher ist statisches CSS, `steps(1, end)`, gleiche Dauer).
//  Spielstart (app-fx-51): `ppHeldAuftritt(platz, zone)` meldet die Figur an `ppFx51Held` und beginnt höchstens 0,13 s später, damit der Auftritt im Bild des Held-Ausbruchs startet.
//  Nicht im Retro-Modus (hat eigenes CSS), nicht bei reduzierter Bewegung, nicht beim Aufstiegs-Morph (`hero-idle-aufstieg`: dort steht die Figur sofort).
//  Reine Bildfunktion (für Tests/Messung): `PpFx46.heldBild(f, hoehe, breite)` → { y, hell, sx, sichtbar }.
// ═════════════════════════════════════════════════════════════════
(function () {
  const TAKT = 1000 / 30;
  const BILDER = 17;            // 567 ms
  const KNICK = 0.7;            // Aufstieg endet bei 70 %, danach nur noch Aufleuchten

  // cubic-bezier(0, 0, .58, 1) (CSS `ease-out`): y zu x
  function easeOut(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const x1 = 0, y1 = 0, x2 = 0.58, y2 = 1;
    const bx = (t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const by = (t) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 30; i++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; }
    return by(t);
  }
  const snap2 = (v, q) => { const k = q > 0 ? q : 2; return Math.round(v / k) * k; };   // ganze Hero-Pixel (q = Schichtpixel der Figur), ohne q Kunstpixel 2
  const stufe10 = (p) => Math.min(10, Math.floor(p * 10 + 1e-9));   // steps(10, end): Wert springt am Ende jedes Zehntels

  /** Bild f (0 … BILDER - 1): Versatz nach unten (px), Helligkeit, Schattenskalierung (X), Schatten sichtbar? */
  function heldBild(f, hoehe, breite, q) {
    const u = (f + 0.001) / BILDER;
    let y, hell;
    if (u < KNICK) {
      const i = stufe10(u / KNICK);
      y = snap2(hoehe * (1 - i / 10), q);
      hell = 2.2 + (1.5 - 2.2) * (i / 10);
    } else {
      const i = stufe10((u - KNICK) / (1 - KNICK));
      y = 0;
      hell = 1.5 + (1 - 1.5) * (i / 10);
    }
    const e = easeOut(u);
    const sb = snap2(breite * (0.3 + 0.7 * e), q);
    const sx = breite > 0 ? Math.min(1, Math.max(0, sb / breite)) : 1;
    return { y, hell: Math.round(hell * 100) / 100, sx: Math.round(sx * 10000) / 10000, sichtbar: e >= 0.40625 };
  }

  function ppHeldAuftritt(platz, zone) {
    if (!platz || window.PP_RETRO) return;
    try { if (window.PPPixelAnim && window.PPPixelAnim.KONFIG && window.PPPixelAnim.KONFIG.aktiv === false) return; } catch (e) { /* weiter */ }
    try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { /* weiter */ }
    if (platz.classList.contains('hero-idle-aufstieg')) return;
    const cv = platz.querySelector('canvas.hero-idle-canvas'), sch = platz.querySelector('.hero-idle-schatten');
    if (!cv) return;
    if (platz._ppAuftritt) platz._ppAuftritt();          // ein früherer Lauf (Ebene neu eingehängt): abbrechen und sauber beenden
    // Maße einmal lesen (gebrochene Pixel wie in der Vorlage: translateY(100 %) bezog sich auf die ungerundete Höhe)
    const h = parseFloat(getComputedStyle(cv).height);
    const b = sch ? parseFloat(getComputedStyle(sch).width) : 0;
    if (!(h > 0)) return;
    const qPx = cv.height > 0 ? h / cv.height : 0;   // Hero-Pixel in der Sprite-Ebene (Schichtpixel je Sprite-Pixel): Versatz und Schattenbreite auf ganzen Hero-Pixeln
    const raf = window.ppTaktRaf || window.requestAnimationFrame;
    // Spielstart (app-fx-51): der Auftritt beginnt im Bild des Ausbruchs (Aufschub höchstens 0,13 s; solange steht die Figur wie im ersten Bild verborgen)
    let verz = 0;
    try { if (zone && window.ppFx51Held) verz = window.ppFx51Held(platz, zone) || 0; } catch (e) { verz = 0; }
    let t0 = performance.now() + verz, letzt = -1, id = 0, fertig = false;
    let cvT = '', cvF = '', schT = '', schV = '';
    const setze = (f) => {
      const bild = heldBild(f, h, b, qPx);
      const t = bild.y ? 'translateY(' + bild.y + 'px)' : '';
      const fi = bild.hell > 1.0001 ? 'brightness(' + bild.hell + ')' : '';
      if (t !== cvT) { cvT = t; cv.style.transform = t; }
      if (fi !== cvF) { cvF = fi; cv.style.filter = fi; }
      if (sch) {
        const st = bild.sx < 0.9999 ? 'scaleX(' + bild.sx + ')' : '';
        const sv = bild.sichtbar ? '' : 'hidden';
        if (st !== schT) { schT = st; sch.style.transform = st; }
        if (sv !== schV) { schV = sv; sch.style.visibility = sv; }
      }
    };
    const aufraeumen = () => {
      if (fertig) return; fertig = true;
      if (id) { try { cancelAnimationFrame(id); } catch (e) { /* weg */ } id = 0; }
      if (cvT) cv.style.transform = '';
      if (cvF) cv.style.filter = '';
      if (sch) { if (schT) sch.style.transform = ''; if (schV) sch.style.visibility = ''; }
      if (platz._ppAuftritt === aufraeumen) platz._ppAuftritt = null;
    };
    platz._ppAuftritt = aufraeumen;
    setze(0);
    letzt = 0;
    const schritt = (now) => {
      id = 0;
      if (fertig) return;
      if (!platz.isConnected) { aufraeumen(); return; }
      const f = Math.max(0, Math.floor((now - t0) / TAKT));
      if (f >= BILDER) { aufraeumen(); return; }
      if (f !== letzt) { letzt = f; setze(f); }
      id = raf(schritt);
    };
    id = raf(schritt);
  }

  window.ppHeldAuftritt = ppHeldAuftritt;
  window.PpFx46 = { heldBild, BILDER };
})();
