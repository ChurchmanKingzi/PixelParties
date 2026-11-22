// app-fx-65: Kartenflug Deck → Ablage (Mill) im Trailer-Look — Pixelart, Schatten am Boden, Abhebe-Funken, Schweif, Umdrehen im Flug, Schockringe bei der Landung
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Trailer-Renderer (shot01.js, „Mill-Karten": `makeFlyCard`, `fcPos`, `FC_MILL`, `DISC_EV`): die Karte hebt verdeckt vom Deck ab, schwebt im Bogen zum Ablagestapel und dreht sich im Flug um;
//  unter ihr läuft ein Schachbrett-Schatten, der mit der Flughöhe vom Boden wegwandert; beim Abheben stieben Funken, hinter ihr zieht ein Schweif, bei der Landung laufen zwei Schockringe und Funken aus.
//
//  ABLAUF je Karte (ms ab Start der Karte; Start der Karte i = i · `versatz` = 200, wie der Server es annimmt):
//    0         ABHEBEN   1 Bild helle Dither-Blende auf der Karte, 14 Funken (Quadrate und Kreuze, Creme/Grau) stieben vom Deck, die Karte wächst in Stufen
//    0–560     FLUG      Mitte der Karte: lerp(Deck, Ablage, easeInOutCubic(u)) − sin(π u) · Bogen; Bogen = 0,92 Kartenbreiten (Trailer: 110 px bei 120 px Karte, höchstens 40 % des Weges)
//              GRÖSSE    Trailer: 1 + round(sin(π · min(1, 1,1 u)) · 6) · 0,02 (bis 12 %). Hier drei feste Größen (Pixelart: kein stufenloses Skalieren der Kartenbilder) – Grundmaß, +1 Stufe, +2 Stufen;
//                        eine Stufe = 2 · n Zellen Breite (n = max(1, round(0,04 · Kartenbreite / Zelle))), ändert die Größe des Elements, nie ein `scale()` (kein bilineares Skalieren auf der GPU)
//              UMDREHEN  (Karte kommt verdeckt aus dem Deck) Bild 0–1 Rücken voll · Bild 2–4 Rücken 75/50/25 % breit · Bild 5 Mindestbreite (2 Zellen) MIT Seitenwechsel · Bild 6–8 Vorderseite 25/50/75 % · ab Bild 9 voll;
//                        Bild wird gestaucht (`object-fit: fill`, nie zugeschnitten/gespiegelt), bei ≤ 50 % Breite helle 1-Zellen-Kante links/rechts (harte Ringe). Trailer: 5 Bilder bei 0,10–0,38 u.
//              SCHATTEN  Schachbrett-Raster (Dither statt Alpha, Zelle = Hero-Pixel), Kartengröße, Versatz (8 + 52 · sin(π u)) · Kartenbreite/120 nach rechts, · 1,2 nach unten: die Karte „schwebt"
//              SCHWEIF   je Bild ein bis zwei Quadrate (Creme/Grau, 0,20–0,35 s, blinken in der zweiten Hälfte aus) um die Karte, 12 Bilder Tiefe
//    560       LANDUNG   die Karte ist weg (der Ablagestapel wächst genau jetzt: `setXHidden`-Zähler in app-board.jsx), zwei Schockringe (Creme 2 → 1 Zelle dick, Akzent gedithert; Radius easeOutCubic 0 → 30 bzw. 20 Zellen
//                        je 40 Zellen Kartenbreite, 0,45 s), 30 Funken in Akzentfarben; nach der LETZTEN Karte steigen bis zu 12 Sterne vom Stapel auf (Trailer: Ende des Mill)
//    HALTEN    (`halten` > 0, Magenta-Aufdecken): Reise 700 ms, die Karte bleibt `halten` ms auf dem Stapel liegen (Grundgröße, Schatten flach), blinkt dann 300 ms aus (Dither-Blinken, kein Alpha)
//  EINE Leinwand je Aufruf (Schweif, Funken, Ringe, Sterne), Zelle S = Hero-Pixel der Zielreihe (`ppFxZelle`), 30 Hz auf dem globalen Takt (`ppTaktRaf`), nur bei neuem Bild zeichnen, Schmutzrechteck
//  (`ppFx30Maler`), feste Palettenfarben, kein Alpha/Blur. Die Karten selbst bleiben DOM (`.card-flight`, echtes Kartenbild, Rarity-Rahmen wie bisher), ihre Lage nur in ganzen Zellen im Bildtakt.
//
//  API (wiederverwendbar, z. B. für Ablage → Gelöscht, Gelöscht → Ablage, Ablage → Deck):
//    `window.PpFx65.kartenFlug({ von, nach, karten:[{ name, rarity }], owner, versatz = 200, reise = 560, halten = 0, akzent = 'violett'|'rot'|'gruen', umdrehen = true, rueckseite = url,
//                                 start:{ b, h }, masse:{ b, h }, bilder: (name) => url, z })` → Handle { stopp() } oder `null` (Rückfall: Aufrufer spielt die alte CSS-Fassung).
//      `von`/`nach` = Element (Mitte, Bildschirmkoordinaten) oder { x, y }. `umdrehen` zeigt zuerst `rueckseite` (Standard: das Bild im Quellstapel); ohne Rückseite fliegt die Karte offen.
//    Rückfall (`null`): Animationen aus (`_playAnimations === false`), Retro (`PP_RETRO`), reduzierte Bewegung, `__ppFxAlt`, Notbremse `window.__ppFx65Aus`, fehlende Palette/Malerbausteine, zu große Leinwand.
//  Messung (nur Tests): `window.__ppFx65Messen = true` → `window.__ppFx65Zeiten` = [Bildnummer, ms Zeichnen+Pose] je Bild.
// ═════════════════════════════════════════════════════════════════
(function (root) {
  const TAKT = 1000 / 30, rd = Math.round, fl = Math.floor, mn = Math.min, mx = Math.max;
  // Flip-Stufen [Vorderseite?, Breitenanteil]: Rücken 75/50/25 %, Mindestbreite (2 Zellen) mit Seitenwechsel, Vorderseite 25/50/75 %, dann voll (Trailer: 5 Bilder, hier 8 — lesbarer)
  const FLIP = [[0, 0.75], [0, 0.5], [0, 0.25], [1, 0], [1, 0.25], [1, 0.5], [1, 0.75]];
  const kl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeIO = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOut = (u) => 1 - Math.pow(1 - kl(u, 0, 1), 3);

  // ── Palette (Trailer: C.cream / C.grey / C.dark; Akzente) ──
  const palCache = {};
  const pal = (hex) => {
    if (palCache[hex]) return palCache[hex];
    const c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    let q = c;
    try { if (root.ppSnapRgb) q = Array.from(root.ppSnapRgb(c[0], c[1], c[2])); } catch (e) { /* ungerastert */ }
    return (palCache[hex] = q);
  };
  const AKZENT = {
    // Ablage: violett wie der bisherige Flug-Schein (Funken Violett/Creme/Rosa, Ring 2 Rosa gedithert wie im Trailer)
    violett: { ring: '#f8b4c8', funken: ['#c98aff', '#fffbd2', '#f8b4c8', '#c98aff'], schweif: '#c98aff' },
    // Gelöscht: rötlich (bisher rot-violetter Schein)
    rot: { ring: '#fe6794', funken: ['#fe6794', '#fffbd2', '#ae264c', '#fe6794'], schweif: '#fe6794' },
    // zurück ins Deck: grün (bisher grüner Schein)
    gruen: { ring: '#66ffa2', funken: ['#66ffa2', '#fffbd2', '#4bcd7c', '#66ffa2'], schweif: '#66ffa2' },
  };
  const creme = () => pal('#fffbd2'), grau = () => pal('#9aa3b6'), dunkel = () => pal('#08060c');

  /** Rückfall auf die alte CSS-Fassung? */
  function rueckfall() {
    try {
      if (root.__ppFx65Aus || root.__ppFxAlt || root._playAnimations === false || root.PP_RETRO) return true;
      if (typeof root.ppSnapRgb !== 'function' || typeof root.ppFx30Maler !== 'function' || typeof root.ppFx30H !== 'function') return true;
      if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    } catch (e) { return true; }
    return false;
  }

  const zelleVon = (p) => { try { return typeof root.ppFxZelle === 'function' ? root.ppFxZelle(p) : 3; } catch (e) { return 3; } };
  const mitte = (v) => {
    try {
      if (!v) return null;
      if (typeof v.getBoundingClientRect === 'function') { const r = v.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }
      return isFinite(v.x) && isFinite(v.y) ? { x: v.x, y: v.y } : null;
    } catch (e) { return null; }
  };

  // Schachbrett (2 × 2) als Bild-URL: ein Quadrat gefüllt, eines leer — Dither statt Alpha
  const schachCache = {};
  function schach(farbe) {
    const k = farbe.join(',');
    if (schachCache[k]) return schachCache[k];
    let url = '';
    try {
      const c = document.createElement('canvas'); c.width = 2; c.height = 2;
      const g = c.getContext('2d'); g.fillStyle = `rgb(${farbe[0]},${farbe[1]},${farbe[2]})`; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
      url = c.toDataURL();
    } catch (e) { /* ohne Schatten */ }
    return (schachCache[k] = url);
  }

  // ───────────────────────── Ablauf ─────────────────────────
  const AKTIV = new Set();
  let raf = 0;
  function lauf() { if (!raf) raf = (root.ppTaktRaf || root.requestAnimationFrame)(schritt); }
  function schritt() {
    raf = 0;
    const jetzt = performance.now();
    for (const b of Array.from(AKTIV)) {
      try { b.tick(jetzt); } catch (e) { try { console.warn('PpFx65', e); } catch (e2) { /* still */ } b.stopp(); }
    }
    if (AKTIV.size) lauf();
  }

  /** Eine Flug-Gruppe (alle Karten eines Ereignisses) bauen; `trocken`: nur die Zeichenroutine (Aufwärmen), nichts im Dokument. */
  function bauen(o, trocken) {
    const von = mitte(o.von), nach = mitte(o.nach);
    if (!von || !nach) return null;
    const karten = Array.isArray(o.karten) ? o.karten : [];
    if (!karten.length) return null;
    const S = zelleVon({ x: nach.x, y: nach.y });
    const grund = o.masse && o.masse.b > 0 ? o.masse : (typeof root.flugMass === 'function' ? (() => { const g = root.flugMass('stapel'); return { b: g.b, h: g.h }; })() : { b: 64, h: 90 });
    const startM = o.start && o.start.b > 0 ? o.start : grund;
    const bB = mx(2 * S, rd(grund.b / S) * S), hB = mx(2 * S, rd(grund.h / S) * S);       // Grundmaß in ganzen Zellen (Landung)
    const bS = mx(2 * S, rd(startM.b / S) * S), hS = mx(2 * S, rd(startM.h / S) * S);     // Startmaß
    const f = kl(bB / 120, 0.3, 1.25), fz = mx(f, 0.55);                                    // Trailer-Karte: 120 px breit; alle Maße darauf bezogen
    const n1 = mx(1, rd(0.04 * bB / S)), stufe = 2 * n1 * S;                                // eine Größenstufe: 2 · n Zellen Breite
    const reise = mx(200, o.reise > 0 ? o.reise : 560), versatz = o.versatz >= 0 ? o.versatz : 200, halten = o.halten > 0 ? o.halten : 0, aus = halten > 0 ? 300 : 0;
    const dist = Math.hypot(nach.x - von.x, nach.y - von.y);
    // Bogen nach oben (Trailer); ist darüber kein Platz im Fenster (Handy: Gegner-Stapel am oberen Rand), flacher bzw. nach unten — die Karte verlässt den Bildschirm nie
    let bogen = mn(0.92 * bB, 0.4 * dist);
    { const hh = hB * 1.14 / 2, hoch = mn(von.y, nach.y) - hh - 2, tief = (root.innerHeight || 1080) - mx(von.y, nach.y) - hh - 2;
      if (hoch < bogen * 0.6) bogen = -mn(bogen, mx(0, tief)); else bogen = mn(bogen, hoch); }
    const ak = AKZENT[o.akzent] || AKZENT.violett;
    const CR = creme(), GR = grau(), DK = dunkel(), AKF = ak.funken.map(pal), AKR = pal(ak.ring), AKS = pal(ak.schweif);
    const H = root.ppFx30H, salz = fl(Math.random() * 1e6) % 9973;
    const umdrehen = o.umdrehen !== false && !!o.rueckseite;
    const n = karten.length;
    const spaetestes = (n - 1) * versatz + reise + halten + aus;           // Ende der letzten Karte
    const sterne = n >= 3 ? 12 : 6;
    const endeSterne = (n - 1) * versatz + reise + halten + aus + 300 + 1500;
    const ende = mx(spaetestes + 480, endeSterne);

    // Fläche der Leinwand: Weg + Rand (Funken bis ~0,45 s · 210 px/s, Ringe bis 0,75 Kartenbreiten, Sterne bis ~120 px hoch)
    const M = rd(bB * 0.9 + 170 * fz + 40);
    const lx = fl((mn(von.x, nach.x) - M) / S) * S, ly = fl((mn(von.y, nach.y) - M - mx(0, bogen)) / S) * S;
    const gw = Math.ceil((mx(von.x, nach.x) + M - lx) / S), gh = Math.ceil((mx(von.y, nach.y) + M + mx(0, -bogen) - ly) / S);
    if (gw < 8 || gh < 8 || gw > 1100 || gh > 760) return null;

    const cv = document.createElement('canvas');
    cv.width = gw; cv.height = gh;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), m = root.ppFx30Maler(img.data, gw, gh);
    const cx = (x) => fl((x - lx) / S), cy = (y) => fl((y - ly) / S);

    // ── Karten (DOM) ──
    const z0 = o.z || 10200;
    const wurzel = document.createElement('div');
    wurzel.setAttribute('aria-hidden', 'true'); wurzel.setAttribute('data-pp-px', 'aus');
    wurzel.style.cssText = `position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:${z0};`;   // eigener Stapelkontext auf Höhe der Kartenflüge: die Kinder ordnen sich nur untereinander
    const oben = document.createElement('div');
    oben.setAttribute('aria-hidden', 'true'); oben.setAttribute('data-pp-px', 'aus');
    oben.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;width:${gw * S}px;height:${gh * S}px;pointer-events:none;z-index:${z0 + 2 * n + 60};`;
    cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
    oben.appendChild(cv);
    const bildUrl = typeof o.bilder === 'function' ? o.bilder : (root.cardImageUrl || (() => null));
    const cs = karten.map((k, i) => {
      const c = { i, name: k.name, t0: i * versatz, seed: salz + i * 131, grp: { b: bB, h: hB }, last: { w: -1, h: -1, tr: '', sh: '', fl: '', face: '' } };
      c.flip = umdrehen;
      if (trocken) return c;
      const sh = document.createElement('div');
      sh.setAttribute('data-pp-px', 'aus');
      sh.style.cssText = `position:fixed;left:0;top:0;width:${bB}px;height:${hB}px;display:none;pointer-events:none;z-index:${n - i};background-image:url(${schach(DK)});background-size:${2 * S}px ${2 * S}px;image-rendering:pixelated;`;
      const el = document.createElement('div');
      el.className = 'card-flight pp-fx65-karte';
      el.setAttribute('data-pp-px', 'aus');
      el.style.cssText = `position:fixed;left:0;top:0;width:${bS}px;height:${hS}px;display:none;pointer-events:none;z-index:${2 * n - i + 1};overflow:hidden;`;
      const url = bildUrl(k.name);
      const vorn = document.createElement('div'); vorn.style.cssText = 'position:absolute;inset:0;';
      if (url) {
        const im = document.createElement('img');
        im.src = url; im.draggable = false; im.alt = '';
        im.style.cssText = 'width:100%;height:100%;display:block;object-fit:fill;';
        vorn.appendChild(im);
        try { if (root.ppFlugRarity) root.ppFlugRarity(im, k.name, k.rarity, o.owner, ende + 2000); } catch (e) { /* ohne Rarity-Rahmen */ }
      } else {
        vorn.style.cssText += 'background:#1a0a3a;';
        vorn.innerHTML = `<div style="color:#f8b4df;font-size:8px;padding:4px;text-align:center;word-break:break-word;">${String(k.name || '').replace(/[<>&]/g, '')}</div>`;
      }
      el.appendChild(vorn);
      let hinten = null;
      if (umdrehen) {
        hinten = document.createElement('div'); hinten.style.cssText = 'position:absolute;inset:0;';
        const bi = document.createElement('img'); bi.src = o.rueckseite; bi.draggable = false; bi.alt = '';
        bi.style.cssText = 'width:100%;height:100%;display:block;object-fit:fill;';
        hinten.appendChild(bi); el.appendChild(hinten);
      }
      const blende = document.createElement('div');
      blende.style.cssText = `position:absolute;inset:0;display:none;background-image:url(${schach(CR)});background-size:${2 * S}px ${2 * S}px;image-rendering:pixelated;`;
      el.appendChild(blende);
      c.sh = sh; c.el = el; c.vorn = vorn; c.hinten = hinten; c.blende = blende;
      wurzel.appendChild(sh); wurzel.appendChild(el);
      return c;
    });

    // ── Pose der Karte i zur Zeit `age` (ms seit ihrem Start) ──
    const pose = (c, age, fr) => {
      const u = age / reise;
      if (u < 0) return null;
      if (u >= 1) {
        if (halten <= 0) return null;
        const a2 = age - reise;
        if (a2 >= halten + aus) return null;
        if (a2 >= halten && (((fr + c.i) & 1) === 1) && a2 > halten + aus * 0.35) return null;      // Blinken statt Alpha
        return { x: nach.x, y: nach.y, lvl: 0, sx: 1, vorn: true, air: 0, u: 1, blende: false };
      }
      const e = easeIO(u), q = Math.sin(Math.PI * Math.min(1, u * 1.1));
      const lvl = q >= 0.8 ? 2 : q >= 0.25 ? 1 : 0;
      let vorn = true, sx = 1;
      if (c.flip) {
        // Flip in ganzen Bildern (Zelle für Zelle schmaler, Seitenwechsel bei Mindestbreite, wieder breiter): Bild 0–1 Rücken voll, dann 8 Stufen
        const k = fl(age / TAKT + 1e-4) - 2, st = k < 0 ? [0, 1] : k < FLIP.length ? FLIP[k] : [1, 1];
        vorn = !!st[0]; sx = st[1];
      }
      return { x: von.x + (nach.x - von.x) * e, y: von.y + (nach.y - von.y) * e - Math.sin(Math.PI * u) * bogen, lvl, sx, vorn, air: Math.sin(Math.PI * u), u, blende: age < TAKT };
    };
    const rast = (v) => rd(v / S) * S;

    // ── Zeichnen: Schweif, Abhebe-Funken, Landung (Ringe + Funken), Sterne ──
    const ring = (X, Y, r, th, col, dither) => { if (r >= 1) m.ring(X, Y, r, th, col, dither); };
    const teil = (X, Y, kreuz, col) => { if (kreuz) { m.rect(X - 1, Y, 3, 1, col); m.rect(X, Y - 1, 1, 3, col); } else m.rect(X, Y, 1, 1, col); };
    const malen = (now, fr, t0) => {
      for (const c of cs) {
        const age = now - t0 - c.t0;
        if (age < 0) continue;
        const frC = fl(age / TAKT + 1e-4), tq = frC * TAKT;
        // Schweif: je Bild 1–2 Quadrate um die Mitte der Karte (Trailer: 34 Hz, ±30/±35 px, Leben 0,2–0,35 s)
        const letzter = fl(reise / TAKT), np = bB < 80 ? 2 : 1;
        for (let s = mx(0, frC - 12); s <= mn(frC, letzter); s++) {
          for (let p = 0; p < np; p++) {
            const id = c.seed + s * 4 + p, leben = (0.2 + 0.15 * H(id, 1)) * 1000, alter = tq - s * TAKT;
            if (alter >= leben) continue;
            if (alter > leben * 0.72 && ((frC - s) & 1)) continue;
            const q = (() => { const uu = kl(s * TAKT / reise, 0, 1), ee = easeIO(uu); return { x: von.x + (nach.x - von.x) * ee, y: von.y + (nach.y - von.y) * ee - Math.sin(Math.PI * uu) * bogen }; })();
            const px = q.x + (H(id, 2) - 0.5) * 60 * fz, py = q.y + (H(id, 3) - 0.5) * 70 * fz;
            const col = H(id, 4) < 0.15 ? AKS : (H(id, 4) < 0.58 ? CR : GR);
            m.rect(cx(px), cy(py), 1, 1, col);
          }
        }
        // Abhebe-Funken (14, Creme/Grau, 30 % Kreuze): vom Deck
        const nF = typeof root.ppFxN === 'function' ? root.ppFxN(14) : 14;
        for (let k = 0; k < nF; k++) {
          const w = H(c.seed + 500 + k, 11) * Math.PI * 2, sp = (60 + H(c.seed + 500 + k, 12) * 150) * fz, leben = 0.25 + 0.2 * H(c.seed + 500 + k, 13), a = tq / 1000;
          if (a >= leben) continue;
          if (a > leben * 0.72 && (frC & 1)) continue;
          teil(cx(von.x + Math.cos(w) * sp * a), cy(von.y + Math.sin(w) * sp * a), H(c.seed + 500 + k, 14) < 0.3, (k & 1) ? CR : GR);
        }
        // Landung: zwei Schockringe + Funken in Akzentfarben
        const al = age - reise - (halten > 0 ? 0 : 0);
        if (al >= 0) {
          const dt = fl(al / TAKT + 1e-4) * TAKT / 1000, X = cx(nach.x), Y = cy(nach.y), k = mx(0.45, (bB / S) / 40);
          if (dt < 0.45) {
            ring(X, Y, rd(easeOut(dt / 0.4) * 30 * k), dt < 0.1 ? 2 : 1, CR, false);
            if (dt > 0.05) ring(X, Y, rd(easeOut((dt - 0.05) / 0.4) * 20 * k), 1, AKR, true);
          }
          const nL = typeof root.ppFxN === 'function' ? root.ppFxN(30) : 30;
          for (let j = 0; j < nL; j++) {
            const w = H(c.seed + 900 + j, 21) * Math.PI * 2, sp = (60 + H(c.seed + 900 + j, 22) * 200) * fz, leben = 0.25 + 0.3 * H(c.seed + 900 + j, 23);
            if (dt >= leben) continue;
            if (dt > leben * 0.72 && (frC & 1)) continue;
            teil(cx(nach.x + Math.cos(w) * sp * dt), cy(nach.y + Math.sin(w) * sp * dt), H(c.seed + 900 + j, 24) < 0.3, AKF[j % AKF.length]);
          }
        }
      }
      // Sterne nach der letzten Landung (Trailer: 12 Sterne, 0,8–1,3 s, steigen mit 30–90 px/s)
      const aL = now - t0 - ((n - 1) * versatz + reise + halten + aus);
      if (aL >= 0) {
        const nS = typeof root.ppFxN === 'function' ? root.ppFxN(sterne) : sterne;
        for (let j = 0; j < nS; j++) {
          const d0 = H(salz + 1300 + j, 31) * 300, leben = (0.8 + 0.5 * H(salz + 1300 + j, 32)) * 1000, a = (aL - d0) / 1000;
          if (a < 0 || a * 1000 >= leben) continue;
          if (a * 1000 > leben * 0.72 && (fl(aL / TAKT) & 1)) continue;
          const x0 = nach.x + (H(salz + 1300 + j, 33) - 0.5) * 90 * fz, y0 = nach.y + (H(salz + 1300 + j, 34) - 0.5) * 100 * fz;
          const X = cx(x0 + (H(salz + 1300 + j, 35) - 0.5) * 16 * fz * a), Y = cy(y0 - (30 + 60 * H(salz + 1300 + j, 36)) * fz * a), col = (j & 1) ? CR : AKR;
          m.rect(X - 2, Y, 5, 1, col); m.rect(X, Y - 2, 1, 5, col); m.rect(X - 1, Y - 1, 3, 3, col);
        }
      }
    };

    // ── Takt ──
    const b = { t0: 0, letzte: -1, vor: null, fertig: false };
    const stopp = () => {
      if (b.fertig) return; b.fertig = true; AKTIV.delete(b);
      try { wurzel.remove(); oben.remove(); } catch (e) { /* weg */ }
    };
    b.stopp = stopp;
    b.tick = (jetzt) => {
      if (b.fertig) return;
      const now = jetzt - b.t0;
      if (now >= ende) { stopp(); return; }
      const fr = fl(jetzt / TAKT);
      if (fr === b.letzte) return;
      b.letzte = fr;
      const mess = root.__ppFx65Messen ? performance.now() : 0;
      // Karten: Lage in ganzen Zellen
      for (const c of cs) {
        const age = now - c.t0, p = pose(c, age, fr);
        if (!p) { if (c.el && c.el.style.display !== 'none') { c.el.style.display = 'none'; c.sh.style.display = 'none'; } continue; }
        const w0 = p.lvl === 0 ? bS : null;
        // Größe: Start → Grundmaß in Stufen (Abheben bei 0 = Startmaß, +1/+2 Stufen in der Luft, Landung = Grundmaß)
        const wBase = p.u >= 1 || p.u > 0.62 ? bB : bS, hBase = p.u >= 1 || p.u > 0.62 ? hB : hS;
        const wL = wBase + p.lvl * stufe, hL = rd(hBase * (wL / wBase) / S) * S;
        const wS = mx(S * 2, rd(wL * p.sx / S) * S);
        const px = rast(p.x - wS / 2), py = rast(p.y - hL / 2);
        const so = (8 + 52 * p.air) * f, sx2 = rast(p.x - bB / 2 + so), sy2 = rast(p.y - hB / 2 + so * 1.2);
        if (c.el.style.display === 'none') { c.el.style.display = 'block'; c.sh.style.display = 'block'; }
        const L = c.last;
        if (L.w !== wS) { c.el.style.width = wS + 'px'; L.w = wS; }
        if (L.h !== hL) { c.el.style.height = hL + 'px'; L.h = hL; }
        const tr = `translate(${px}px,${py}px)`;
        if (L.tr !== tr) { c.el.style.transform = tr; L.tr = tr; }
        const P2 = 2 * S, sh = `translate(${sx2}px,${sy2}px)`;
        if (L.sh !== sh) {
          c.sh.style.transform = sh; L.sh = sh;
          c.sh.style.backgroundPosition = `${(((-sx2) % P2) + P2) % P2}px ${(((-sy2) % P2) + P2) % P2}px`;
        }
        const fa = p.vorn ? 'v' : 'h';
        if (L.face !== fa) { L.face = fa; c.vorn.style.display = p.vorn || !c.hinten ? 'block' : 'none'; if (c.hinten) c.hinten.style.display = p.vorn ? 'none' : 'block'; }
        const ka = p.sx <= 0.5 ? '1' : '0';
        if (L.ka !== ka) { L.ka = ka; c.el.style.boxShadow = p.sx <= 0.5 ? `inset ${S}px 0 0 0 rgb(${CR.join(',')}),inset ${-S}px 0 0 0 rgb(${CR.join(',')})` : 'none'; }   // helle Kante beim Flip (harte Ringe, kein Blur)
        const bl = p.blende ? '1' : '0';
        if (L.fl !== bl) { L.fl = bl; c.blende.style.display = p.blende ? 'block' : 'none'; }
        void w0;
      }
      // Leinwand
      const d = m.d, buf = img.data;
      if (b.vor) { for (let j = b.vor.y0; j < b.vor.y1; j++) buf.fill(0, (j * gw + b.vor.x0) * 4, (j * gw + b.vor.x1) * 4); }
      d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
      malen(jetzt, fr, b.t0);
      const ux0 = mn(b.vor ? b.vor.x0 : gw, d.x0), uy0 = mn(b.vor ? b.vor.y0 : gh, d.y0), ux1 = mx(b.vor ? b.vor.x1 : 0, d.x1), uy1 = mx(b.vor ? b.vor.y1 : 0, d.y1);
      if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
      b.vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
      if (mess) (root.__ppFx65Zeiten || (root.__ppFx65Zeiten = [])).push([fr, +(performance.now() - mess).toFixed(3)]);
    };
    b.malenTrocken = (ms) => { m.d.x0 = gw; m.d.y0 = gh; m.d.x1 = 0; m.d.y1 = 0; img.data.fill(0); malen(ms, fl(ms / TAKT), 0); };
    b.wurzel = wurzel; b.oben = oben; b.ende = ende; b.S = S; b.cs = cs;
    return b;
  }

  /** Kartenflug starten. Gibt { stopp } zurück oder null (Rückfall auf die alte Fassung). */
  function kartenFlug(o) {
    try {
      if (!o || rueckfall()) return null;
      const o2 = { ...o };
      if (o2.umdrehen !== false && !o2.rueckseite) {                         // Rückseite aus dem Quellstapel (Deck mit Hülle des Spielers)
        try {
          const q = o.von && typeof o.von.querySelector === 'function' ? (o.von.tagName === 'IMG' ? o.von : o.von.querySelector('img')) : null;
          if (q && q.getAttribute('src')) o2.rueckseite = q.currentSrc || q.getAttribute('src');
        } catch (e) { /* offen fliegen */ }
      }
      const b = bauen(o2, false);
      if (!b) return null;
      b.t0 = performance.now();
      const dok = document.body;
      dok.appendChild(b.wurzel); dok.appendChild(b.oben);
      AKTIV.add(b);
      try { b.tick(b.t0); } catch (e) { /* erstes Bild kommt mit dem Takt */ }   // erstes Bild SOFORT: die Handkarte wird im selben Augenblick verdeckt (Potion-Abflug, app-fx-70) — sonst bis zu 33 ms leer
      lauf();
      setTimeout(() => b.stopp(), b.ende + 2500);                            // Notnagel (Tab im Hintergrund: der Takt ruht)
      return { stopp: b.stopp, ende: b.ende };
    } catch (e) { try { console.warn('PpFx65.kartenFlug', e); } catch (e2) { /* still */ } return null; }
  }

  root.PpFx65 = { kartenFlug, rueckfall, AKZENT };

  // Aufwärmen im Leerlauf: Zeichenroutine ein paar Mal trocken laufen lassen, damit der erste echte Flug nicht im JIT-kalten Code startet
  (function aufwaermen() {
    const los = () => {
      try {
        if (rueckfall() || root.__ppFx65KeinAufwaermen) return;
        const b = bauen({ von: { x: 200, y: 600 }, nach: { x: 60, y: 600 }, karten: [{ name: 'x' }, { name: 'y' }, { name: 'z' }], rueckseite: 'x', akzent: 'violett', masse: { b: 96, h: 135 } }, true);
        if (!b) return;
        const schritte = [60, 200, 420, 640, 820, 1100, 1500, 2100].map((ms) => () => b.malenTrocken(ms));
        const ric = root.requestIdleCallback || ((fn) => setTimeout(fn, 60));
        const weiter = () => { const fn = schritte.shift(); if (!fn) return; try { fn(); } catch (e) { /* weg */ } ric(weiter, { timeout: 2500 }); };
        ric(weiter, { timeout: 2500 });
      } catch (e) { /* weg */ }
    };
    setTimeout(() => (root.requestIdleCallback ? root.requestIdleCallback(los, { timeout: 4000 }) : los()), 3500);
  })();
})(window);
