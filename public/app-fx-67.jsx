// app-fx-67: Trailer-Looks im Spiel — Schadenszahlen als Pixelziffern, Stapel mit Dicke und Zähler-Pop, Bildschirmwackeln und Aufheller-Blitz (Pixelart, 30 Bilder/s)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Trailer-Renderer (shot01.js): `glyphCanvas`/`DN` + Render (Schadenszahlen), `stackCanvas`/`addSlot`/`discUpdate` (Stapel), `SHAKES`/`shakeAt` und die Überlagerung `drawOverlay` (Wackeln, Blitz).
//  Alles Pixelart, Palettenfarben (`ppSnapRgb`), nichts weich: kein Alpha, kein Blur, kein Drehen, keine stufenlose Skalierung von Bitmaps; Bewegung in ganzen Pixeln im 30-Hz-Takt (`ppTaktRaf`).
//  Notbremse: `window.__ppFx67Aus = true` schaltet ALLES hier ab (die alten Anzeigen laufen wie zuvor); einzeln: `__ppFx67ZahlAus`, `__ppFx67KantenAus`, `__ppFx67WackelnAus`.
//
//  ① SCHADENSZAHLEN  (`window.ppFx67Zahl({ el, amount, art })` → true, wenn die Pixelzahl läuft; sonst false und der Aufrufer zeigt die alte `.damage-number`)
//     Trailer: aufrechte 5×7-Pixelziffern (Rot #ff1a1a, Schatten dunkelrot, Kontur Tinte), Pop 0,5 / 1,7 / 1,35 / 1,1 / 1 in 5 Bildern, steigt 5 Weltpixel je Bild bis 60, steht bis Bild 30, flackert
//     Bild 31–40 (jedes zweite Bild aus), 41 Bilder = 1,37 s. Das Maß der Ziffern ist 1,3 · Hero-Pixel je Ziffernpixel (Trailer: K · 1,3), auf ganze Bildschirmpixel gerundet (je Bild neu, damit der Pop
//     in ganzen Pixeln läuft); Lage und Anstieg in Hero-Pixeln (Zelle S = `ppFxZelle`), der Anstieg 5/4,8 Zellen je Bild. Der Pop skaliert (wie im Trailer) vom Kopfpunkt der Figur aus (Abstand · Skala):
//     die Zahl „schießt" nach oben und setzt sich. Ausgangshöhe: ÜBER der HP-Zahl des Balkens (`PpFx52`, Oberkante 24 Zellen über dem Kopf) — im Trailer standen die Zahlen 30 Weltpixel höher (POP_UP).
//     Farben: Schaden Rot; Heilung Rosa (Trailer „+150"); „0" (abgefangen) in gedämpftem Grau. Kein Glüh-Schatten (der Pixelierer machte daraus einen schrägen Ring), kein Alpha.
//     Mehrere Zahlen am selben Ziel: freie „Plätze" nebeneinander (Mitte, rechts, links) und darüber, solange die älteren laufen (kein Übereinander).
//     Technik: je Zahl EIN kleines Sprite (Leinwand 1 Zelle = 1 Ziffernpixel, einmal gezeichnet, gecacht je Text/Art), nur `left/top/width/height` im Bildtakt (ganze Pixel), keine Zeichenarbeit je Bild.
//  ② STAPEL  (React-Baustein `PpStapelKanten`, siehe unten)
//  ③ WACKELN + BLITZ  (`window.ppFx67Wackeln({ amp, dur })`, `window.ppFx67Blitz()`, `window.ppFx67Treffer(betrag)`, `window.ppFx67Landung(el, variante)`)
//     Trailer `shakeAt`: je Stoß a = amp · (1 − dt/dur), x += round([1, −1, 0,7, −0,8][f % 4] · a), y += round([−0,6, 0,8, −1, 0,5][f % 4] · a), mehrere Stöße addieren sich. Hier: ganzzahliger `translate`
//     auf `.board-center` (Brett) und den Welt-Schichten (Zahlen, HP-Balken, Effekte), nichts gedreht/skaliert, Klickziele bleiben (nur Optik, am Ende exakt zurück: `ppFxHalte/ppFxLoese`).
//     Blitz `drawOverlay`: Vollbild-Aufhellung, 3 Bilder [1; 0,55; 0,25] Creme, Bayer-8×8-Dither (Zelle = Hero-Pixel), eine Kachel als Hintergrund — keine Leinwand je Bild.
//     Auslöser (dosiert): schwere Treffer (Schaden ab 150, gestaffelt; Blitz ab 300), Kreaturen-Landung (Summon 10/0,4 s) und andere Kartenlandungen (6/0,22 s), Feuerball-Einschlag (16/0,5 s + Blitz),
//     `play_screen_shake` der Engine (mittel 10/0,45 s, schwer 20/0,7 s) statt der weichen CSS-Fassung.
//     Schutz: Option „Screen Shake" im Profil (Browserspeicher `pp_fx67_wackeln`), `prefers-reduced-motion`, Retro, Animationen aus, Tutorial-Zoom: aus (dann bleibt alles wie vorher); Handy halb so stark, kein Blitz-Vollbild
//     in dichter Folge (mindestens 1,5 s Abstand, höchstens ein Blitz je 1,5 s: weniger als 1 Blitz/s Folge).
// ═════════════════════════════════════════════════════════════════
(function (root) {
  const TAKT = 1000 / 30;
  const rd = Math.round, fl = Math.floor, mx = Math.max, mn = Math.min;
  const kl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const palCache = {};
  const pal = (hex) => {
    if (palCache[hex]) return palCache[hex];
    const c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    let q = c;
    try { if (root.ppSnapRgb) { const r = root.ppSnapRgb(c[0], c[1], c[2]); if (r && r.length >= 3) q = [r[0], r[1], r[2]]; } } catch (e) { /* ungerastet */ }
    return (palCache[hex] = q);
  };
  const phone = () => { try { return !!(root.ppIsPhone && root.ppIsPhone()); } catch (e) { return false; } };
  const ruhig = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  /** Rückfall auf die alte Anzeige? (Notbremse, Animationen aus, Retro, reduzierte Bewegung, keine Palette) */
  function rueckfall() {
    try {
      if (root.__ppFx67Aus || root.__ppFxAlt || root._playAnimations === false || root.PP_RETRO || document.hidden) return true;
      if (typeof root.ppSnapRgb !== 'function') return true;
      if (root.PPPixelAnim && root.PPPixelAnim.KONFIG && root.PPPixelAnim.KONFIG.aktiv === false) return true;
      if (ruhig()) return true;
    } catch (e) { return true; }
    return false;
  }
  root.ppFx67Rueckfall = rueckfall;

  // ── Schalter „Screen Shake" (nur dieses Gerät; Profil → Settings) ──
  const OPT_KEY = 'pp_fx67_wackeln';
  function wackelnOption() { try { return root.localStorage.getItem(OPT_KEY) !== '0'; } catch (e) { return true; } }
  function setzeWackelnOption(an) { try { root.localStorage.setItem(OPT_KEY, an ? '1' : '0'); } catch (e) { /* ohne Speicher */ } return wackelnOption(); }
  root.ppFx67WackelnOption = wackelnOption; root.ppFx67SetzeWackelnOption = setzeWackelnOption;

  // ── EIN gemeinsamer 30-Hz-Takt für Zahlen, Wackeln und Blitz (läuft nur, solange etwas aktiv ist) ──
  const ZAHLEN = new Set();
  const STOESSE = [];
  let blitz = null, raf = 0;
  function lauf() { if (!raf) raf = (root.ppTaktRaf || root.requestAnimationFrame)(schritt); }
  function schritt(jetzt) {
    raf = 0;
    if (typeof jetzt !== 'number') jetzt = performance.now();
    const mess = root.__ppFx67Messen ? performance.now() : 0;
    const bild = fl(jetzt / TAKT + 1e-4);
    for (const z of Array.from(ZAHLEN)) { try { z.tick(jetzt, bild); } catch (e) { try { console.warn('PpFx67 Zahl', e); } catch (e2) { /* still */ } z.stopp(); } }
    try { wackelSchritt(jetzt, bild); } catch (e) { try { console.warn('PpFx67 Wackeln', e); } catch (e2) { /* still */ } wackelAbbruch(); }
    try { blitzSchritt(jetzt, bild); } catch (e) { try { console.warn('PpFx67 Blitz', e); } catch (e2) { /* still */ } blitzAbbruch(); }
    if (mess) (root.__ppFx67Zeiten || (root.__ppFx67Zeiten = [])).push([bild, +(performance.now() - mess).toFixed(3)]);
    if (ZAHLEN.size || STOESSE.length || blitz) lauf();
  }

  // ═════════════════════════════ ① SCHADENSZAHLEN ═════════════════════════════
  const POP = [0.5, 1.7, 1.35, 1.1, 1.0];
  const FARBEN = { schaden: ['#ff1a1a', '#8b0d0d'], heilung: ['#3ddc57', '#167927'], null: ['#d2d2db', '#686868'] };
  const KONTUR = '#12101f';
  const spriteCache = new Map();
  /** Sprite (Leinwand, 1 Pixel = 1 Ziffernpixel, Rand 2) für Text und Art, einmal gezeichnet. */
  function sprite(str, art) {
    const key = art + '|' + str, hit = spriteCache.get(key);
    if (hit) return hit;
    const F = root.PpFx52;
    if (!F || typeof F.maler !== 'function' || typeof F.glyph !== 'function') return null;
    const f = FARBEN[art] || FARBEN.schaden, w = str.length * 6 - 1 + 4, h = 12;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), id = g.createImageData(w, h), m = F.maler(id.data, w, h);
    F.glyph(m, str, 2, 2, 1, pal(f[0]), pal(f[1]), pal(KONTUR));
    g.putImageData(id, 0, 0);
    const r = { cv, w, h };
    if (spriteCache.size > 120) spriteCache.clear();
    spriteCache.set(key, r);
    return r;
  }
  function zahlSchicht() {
    let l = document.getElementById('pp-fx67-schicht');
    if (!l || !l.isConnected) {
      l = document.createElement('div'); l.id = 'pp-fx67-schicht'; l.className = 'fx-welt-lock'; l.setAttribute('aria-hidden', 'true'); l.setAttribute('data-pp-px', 'aus');
      l.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10200';
      document.body.appendChild(l);
    }
    return l;
  }
  const PLAETZE = new WeakMap();                        // Zielzone → belegte Plätze { idx, bis }
  const LEBEN = 41;                                     // Bilder (Trailer: q 0..40)
  const HOCH_MAX = 12.5;                                // Anstieg in Zellen (Trailer: 60 Weltpixel / K 4,8)

  /**
   * o = { el (Zielzone: Held- oder Support-Zone), amount (Betrag), art ('schaden' | 'heilung') }. true = läuft als Pixelzahl.
   * Bei Schaden zusätzlich Treffer-Wucht (Wackeln/Blitz) nach Betrag.
   */
  function zahl(o) {
    try {
      if (!o || !o.el || rueckfall() || root.__ppFx67ZahlAus || typeof root.ppFxZelle !== 'function') return false;
      const el = o.el; if (!el.isConnected) return false;
      const betrag = Math.max(0, Math.round(Number(o.amount) || 0));
      const art = betrag === 0 ? 'null' : (o.art === 'heilung' ? 'heilung' : 'schaden');
      const text = betrag === 0 ? '0' : (art === 'heilung' ? '+' : '-') + betrag;
      const sp = sprite(text, art); if (!sp) return false;
      const r = el.getBoundingClientRect();
      if (!(r.width > 8 && r.height > 8)) return false;
      const S = root.ppFxZelle(el), px = (root.ppFxHeldPixel ? root.ppFxHeldPixel(el).px : S) || S;
      const P = mx(2, rd(1.3 * px));                    // Bildschirmpixel je Ziffernpixel (Trailer: K · 1,3 = 1,3 Hero-Pixel)
      const fo = root.ppFxScrollOffset ? root.ppFxScrollOffset() : { dx: 0, dy: 0 };
      const kt = (el.hasAttribute('data-hero-zone') && root.ppFx52KopfOben) ? root.ppFx52KopfOben(el) : null;
      const ref = (kt != null ? mn(kt, r.top) : r.top) + fo.dy;                       // Kopfpunkt (Feldkoordinate)
      const cx = r.left + r.width / 2 + fo.dx;
      const d = 25 * S + sp.h * P / 2;                  // Abstand Kopfpunkt → Zahlenmitte im Ruhezustand: über der HP-Zahl des Balkens (Oberkante 24 Zellen)
      // Platz am Ziel: die ersten freien von Mitte, rechts, links, dann eine Reihe höher
      const jetzt = performance.now(), liste = (PLAETZE.get(el) || []).filter((p) => p.bis > jetzt);
      let idx = 0; while (liste.some((p) => p.idx === idx)) idx++;
      liste.push({ idx, bis: jetzt + LEBEN * TAKT }); PLAETZE.set(el, liste);
      const dx = [0, 1, -1][idx % 3] * (sp.w * P + 2 * S), dy = -fl(idx / 3) * (sp.h * P);
      const cv = document.createElement('canvas'); cv.width = sp.w; cv.height = sp.h;
      cv.getContext('2d').drawImage(sp.cv, 0, 0);
      cv.setAttribute('aria-hidden', 'true'); cv.setAttribute('data-pp-px', 'aus');
      cv.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;image-rendering:pixelated;display:none;';
      zahlSchicht().appendChild(cv);
      const winH = root.innerHeight || 1080, winW = root.innerWidth || 1920;
      const z = {
        t0: null, key: '', sichtbar: false,
        tick(jetzt2, bild) {
          if (z.t0 == null) z.t0 = jetzt2;
          const q = fl((jetzt2 - z.t0) / TAKT + 1e-4);
          if (q >= LEBEN) { z.stopp(); return; }
          const weg = q > 30 && (q & 1);
          if (weg) { if (z.sichtbar) { cv.style.display = 'none'; z.sichtbar = false; } return; }
          const sc = q < 5 ? POP[q] : 1, Pq = mx(1, rd(P * sc));
          const w = sp.w * Pq, h = sp.h * Pq;
          const lift = rd(mn(60, q * 5) / 4.8 * S);                                    // Trailer: 5 Weltpixel je Bild bis 60
          const hoch = mn(lift, rd(HOCH_MAX * S));
          let top = rd(ref + dy - hoch - sc * d - h / 2), left = rd(cx + dx - w / 2);
          const minTop = 2 + fo.dy, maxTop = winH - h - 2 + fo.dy;                      // im Bild bleiben (Gegnerreihe ganz oben)
          if (top < minTop) top = minTop; else if (top > maxTop) top = mx(minTop, maxTop);
          const minL = 2 + fo.dx, maxL = winW - w - 2 + fo.dx; if (left < minL) left = minL; else if (left > maxL) left = mx(minL, maxL);
          const k = left + '|' + top + '|' + Pq;
          if (k !== z.key) { z.key = k; cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
          if (!z.sichtbar) { cv.style.display = 'block'; z.sichtbar = true; }
        },
        stopp() { ZAHLEN.delete(z); try { cv.remove(); } catch (e) { /* weg */ } },
      };
      ZAHLEN.add(z); lauf();
      if (art === 'schaden') treffer(betrag);
      return { stopp: z.stopp };
    } catch (e) { try { console.warn('ppFx67Zahl', e); } catch (e2) { /* still */ } return false; }
  }
  root.ppFx67Zahl = zahl;

  // ═════════════════════════════ ③ WACKELN ═════════════════════════════
  const SHAKE_X = [1, -1, 0.7, -0.8], SHAKE_Y = [-0.6, 0.8, -1, 0.5];
  let wAlt = null;                                      // { brett, schichten: [[stil, alt]] } während des Wackelns
  let wLetzt = '';
  const WACKEL_DECKEL = 26;                             // Summe der Stöße höchstens so viele Pixel (1080p)
  function wackelnErlaubt() {
    try {
      if (rueckfall() || root.__ppFx67WackelnAus || !wackelnOption()) return false;
      if (document.querySelector('.board-center.tut-zoom')) return false;           // Tutorial-Zoom setzt `translate` selbst
      return !!document.querySelector('.board-center');
    } catch (e) { return false; }
  }
  /** Einen Stoß auslösen. amp in Pixeln bei 1080 Höhe (Trailer), dur in Sekunden. Rückgabe true = läuft. */
  function wackeln(o) {
    try {
      if (!o || !(o.amp > 0) || !(o.dur > 0) || !wackelnErlaubt()) return false;
      const skala = kl((root.innerHeight || 1080) / 1080, 0.6, 1.25) * (phone() ? 0.5 : 1);
      const amp = o.amp * skala; if (amp < 0.8) return false;
      STOESSE.push({ t0: null, amp, dur: o.dur * 1000, deckel: WACKEL_DECKEL * skala });
      if (STOESSE.length > 12) STOESSE.shift();
      lauf(); return true;
    } catch (e) { return false; }
  }
  root.ppFx67Wackeln = wackeln;
  function wackelZiele() {
    const l = [];
    const b = document.querySelector('.board-center'); if (b) l.push(b);
    const w = document.getElementById('pp-fx-welt-layer'); if (w) l.push(w);
    const z = document.getElementById('pp-fx67-schicht'); if (z) l.push(z);
    return l;
  }
  function wackelSchritt(jetzt, bild) {
    if (!STOESSE.length) { if (wAlt) wackelAbbruch(); return; }
    let x = 0, y = 0, dk = 0;
    for (let i = STOESSE.length - 1; i >= 0; i--) {
      const s = STOESSE[i]; if (s.t0 == null) s.t0 = jetzt;
      const dt = jetzt - s.t0;
      if (dt > s.dur) { STOESSE.splice(i, 1); continue; }
      const a = s.amp * (1 - dt / s.dur);
      x += rd(SHAKE_X[bild & 3] * a); y += rd(SHAKE_Y[bild & 3] * a); dk = mx(dk, s.deckel);
    }
    if (!STOESSE.length) { wackelAbbruch(); return; }
    x = kl(x, -dk, dk); y = kl(y, -dk, dk);
    if (!wAlt) {                                         // Ausgangswerte zählend merken (app-fx-60: zwei Animationen auf demselben Element)
      if (!wackelnErlaubt()) { STOESSE.length = 0; return; }
      wAlt = wackelZiele().map((el) => [el.style, typeof root.ppFxHalte === 'function' ? root.ppFxHalte(el.style, 'translate') : el.style.translate, el]);
      wLetzt = '';
    }
    const k = x + '|' + y;
    if (k !== wLetzt) { wLetzt = k; const v = (x || y) ? `${x}px ${y}px` : null; for (const [st, alt] of wAlt) st.translate = v == null ? alt : v; }
  }
  function wackelAbbruch() {
    STOESSE.length = 0;
    if (!wAlt) return;
    const a = wAlt; wAlt = null; wLetzt = '';
    for (const [st, alt] of a) { try { if (typeof root.ppFxLoese !== 'function' || root.ppFxLoese(st, 'translate')) st.translate = alt; } catch (e) { /* weg */ } }
  }

  // ═════════════════════════════ ③ BLITZ (Aufheller) ═════════════════════════════
  const BLITZ_STUFEN = [1, 0.55, 0.25];                 // Trailer: 3 Bilder
  const BAYER8 = (() => {                               // 8×8-Bayer (Trailer `BAYER`, Schwelle = Wert / 64)
    let m = [[0, 2], [3, 1]];
    for (let n = 2; n < 8; n *= 2) {
      const g = []; for (let y = 0; y < n * 2; y++) { g.push([]); for (let x = 0; x < n * 2; x++) g[y].push(4 * m[y % n][x % n] + [[0, 2], [3, 1]][fl(y / n)][fl(x / n)]); }
      m = g;
    }
    return m;
  })();
  const kachelUrl = {};
  function kachel(stufe) {                              // 8×8-Kachel Creme (Dither nach Bayer) für eine Stufe, als Bild-URL
    if (kachelUrl[stufe] != null) return kachelUrl[stufe];
    let url = '';
    try {
      const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8;
      const g = cv.getContext('2d'), id = g.createImageData(8, 8), c = pal('#fffbd2');
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (BAYER8[y][x] / 64 < stufe) { const i = (y * 8 + x) * 4; id.data[i] = c[0]; id.data[i + 1] = c[1]; id.data[i + 2] = c[2]; id.data[i + 3] = 255; }
      g.putImageData(id, 0, 0); url = cv.toDataURL('image/png');
    } catch (e) { /* ohne */ }
    return (kachelUrl[stufe] = url);
  }
  let blitzLetzt = -1e9;
  /** Vollbild-Aufheller (3 Bilder). Höchstens alle 1,5 s einer (Lichtempfindlichkeit); aus bei Rückfall, Option, Handy. */
  function blitzen() {
    try {
      const jetzt = performance.now();
      if (rueckfall() || root.__ppFx67WackelnAus || !wackelnOption() || phone() || jetzt - blitzLetzt < 1500) return false;
      if (blitz) return false;
      blitzLetzt = jetzt;
      const S = typeof root.ppFxZelle === 'function' ? root.ppFxZelle(null) : 3;
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true'); el.setAttribute('data-pp-px', 'aus');
      el.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:10300;image-rendering:pixelated;background-repeat:repeat;background-size:${8 * S}px ${8 * S}px;display:none;`;
      document.body.appendChild(el);
      blitz = { el, t0: null, q: -1 }; lauf(); return true;
    } catch (e) { return false; }
  }
  root.ppFx67Blitz = blitzen;
  function blitzSchritt(jetzt) {
    if (!blitz) return;
    if (blitz.t0 == null) blitz.t0 = jetzt;
    const q = fl((jetzt - blitz.t0) / TAKT + 1e-4);
    if (q >= BLITZ_STUFEN.length) { blitzAbbruch(); return; }
    if (q !== blitz.q) { blitz.q = q; blitz.el.style.backgroundImage = `url(${kachel(BLITZ_STUFEN[q])})`; blitz.el.style.display = 'block'; }
  }
  function blitzAbbruch() { if (blitz) { try { blitz.el.remove(); } catch (e) { /* weg */ } blitz = null; } }

  // ═════════════════════════════ Auslöser (Spielereignisse → Wucht) ═════════════════════════════
  // Treffer nach Betrag: Schwellen und Stärken an einer Stelle; Werte aus dem Trailer (Blitz 4, Landung 6, Quick 14, Feuerball 16, Heavy 20) auf Schadenshöhen gelegt.
  const TREFFER = [[450, 20, 0.5, true], [300, 14, 0.4, true], [200, 10, 0.35, false], [150, 6, 0.22, false]];
  function treffer(betrag) {
    try {
      for (const [ab, amp, dur, hell] of TREFFER) if (betrag >= ab) { wackeln({ amp, dur }); if (hell) blitzen(); return true; }
    } catch (e) { /* weg */ }
    return false;
  }
  root.ppFx67Treffer = treffer;
  /** Karte landet in einer Zone: Kreatur (variante 'summon') 10/0,4 s, sonst 6/0,22 s (Trailer: Summon / Kartenlandung). */
  root.ppFx67Landung = function (el, variante) {
    try { return wackeln(variante === 'summon' ? { amp: 10, dur: 0.4 } : { amp: 6, dur: 0.22 }); } catch (e) { return false; }
  };
  /** `play_screen_shake` der Engine: mittel 10/0,45 s, schwer 20/0,7 s (Trailer: Phoenix 20/0,7 s) + Blitz bei schwer. true = übernommen. */
  root.ppFx67EngineWackeln = function (intensitaet) {
    try {
      if (!wackelnOption()) return true;                                   // Profil-Schalter „Screen Shake" aus: auch die Engine-Stöße entfallen
      const schwer = intensitaet === 'heavy';
      const ok = wackeln(schwer ? { amp: 20, dur: 0.7 } : { amp: 10, dur: 0.45 });
      if (ok && schwer) blitzen();
      return ok;
    } catch (e) { return false; }
  };
  // Feuerball-Einschlag (Trailer: 16/0,5 s + Aufheller): `ppFx30Feuerball` wird umhüllt, der Einschlag liegt bei `landMs` (sonst 0,85 · Flugzeit)
  try {
    const f30 = root.ppFx30Feuerball;
    if (typeof f30 === 'function' && !f30._ppFx67) {
      const umhuellt = function (o) {
        const r = f30.apply(this, arguments);
        try {
          if (r && o) { const ms = kl(o.landMs > 0 ? o.landMs : 0.85 * (o.dur > 0 ? o.dur : 600), 160, 2500); setTimeout(() => { if (wackeln({ amp: 16, dur: 0.5 })) blitzen(); }, ms); }
        } catch (e) { /* weg */ }
        return r;
      };
      umhuellt._ppFx67 = true; root.ppFx30Feuerball = umhuellt;
    }
  } catch (e) { /* ohne Umhüllung */ }

  // ═════════════════════════════ ② STAPEL MIT DICKE + ZÄHLER-POP ═════════════════════════════
  // Trailer `stackCanvas(T)`: unter der Deckkarte stehen die Kanten von T Karten, je 1 Zeile, abwechselnd Creme / Grau, links und rechts 1 Pixel Tinte (Umriss), unten eine Tinte-Zeile.
  // Zeilen im Trailer: Deck 16, Potion-Deck 3, Ablage min(14, 1 + 2n) bei 170 Pixel Kartenhöhe. Hier: Zeilen je nach Kartenzahl in Stufen (Deck 1 + n·0,4 bis 16, Potion ceil(n/3) bis 3, Ablage wie Trailer),
  // je Zeile k = Kartenhöhe/170 Bildschirmpixel (gleiche Dicke relativ zur Karte), mindestens 1 Pixel. Die Deckfläche bleibt EXAKT an ihrem Platz (kein Versatz, keine schrägen Verschiebungen) — die Kanten hängen
  // gerade darunter, in die Lücke zur nächsten Zone (die nächste Zone liegt im Stapelkontext darüber und deckt einen Überstand ab). Die Zone selbst ändert ihr Maß nicht: Kartenflüge landen unverändert an der Zonenmitte.
  // Zähler-Pop (Ablage): bei jedem Zuwachs poppt die Zähler-Plakette [1,9; 1,5; 1,25; 1,1; 1] in 5 Bildern (Trailer `DISC.plq`): die DOM-Plakette ist in den ersten 4 Bildern ausgeblendet, eine Pixelplakette
  // (Creme-Rand, Tinte-Füllung, Pixelziffern 5×7) steht an ihrer Stelle in ganzen Zellen (Zelle je Bild = round(Grundzelle · Skala)); im 5. Bild (Skala 1) ist wieder die normale Plakette da.
  const KANTEN_TRAILER = (art, n) => {
    if (!(n > 0)) return 0;
    if (art === 'deck') return mn(16, 1 + Math.ceil(n * 0.4));
    if (art === 'potion') return mn(3, Math.ceil(n / 3));
    return mn(14, 1 + 2 * n);                                  // Ablage (Trailer `discUpdate`)
  };
  function kantenAus() { try { return !!(root.__ppFx67Aus || root.__ppFx67KantenAus || root.PP_RETRO); } catch (e) { return true; } }
  /** Kanten in die Leinwand zeichnen und platzieren (misst einmal: Karte und Zone). */
  function kantenZeichnen(cv, art, n) {
    const zone = cv.parentElement;
    if (!zone || kantenAus()) { cv.style.display = 'none'; return; }
    const karte = zone.querySelector('.board-stack') || zone.querySelector('.board-card');
    if (!karte) { cv.style.display = 'none'; return; }
    const zr = zone.getBoundingClientRect(), kr = karte.getBoundingClientRect();
    if (!(kr.width > 8 && kr.height > 8)) { cv.style.display = 'none'; return; }
    const sk = zone.offsetWidth > 0 ? zr.width / zone.offsetWidth : 1;                  // CSS-Zoom der Oberfläche (1 im Kampffeld)
    const k = kr.height / 170, px = mx(1, rd(KANTEN_TRAILER(art, n) * k)), w = rd(kr.width), h = px + 1;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d'), id = g.createImageData(w, h), d = id.data;
    const cre = pal('#fffbd2'), gra = pal('#9aa3b6'), dun = pal('#08060c');
    const setze = (x, y, c) => { const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
    for (let j = 0; j < px; j++) { const c = (j % 2 === 0) ? cre : gra; for (let x = 0; x < w; x++) setze(x, j, (x === 0 || x === w - 1) ? dun : c); }
    for (let x = 0; x < w; x++) setze(x, px, dun);
    g.putImageData(id, 0, 0);
    cv.style.width = (w / sk) + 'px'; cv.style.height = (h / sk) + 'px';
    cv.style.left = ((kr.left - zr.left) / sk - zone.clientLeft) + 'px'; cv.style.top = ((kr.bottom - zr.top) / sk - zone.clientTop) + 'px';
    cv.style.display = 'block';
  }

  const POP_PLAKETTE = [1.9, 1.5, 1.25, 1.1];                                              // + Bild 5 = 1 (normale Plakette)
  /** Zähler-Pop auf der Plakette der Ablage (Zone `zone`), Text = neue Zahl. */
  function plakettePop(zone, text) {
    try {
      if (rueckfall() || root.__ppFx67KantenAus || !zone) return false;
      const lab = zone.querySelector('.board-card-label'); if (!lab) return false;
      const r = lab.getBoundingClientRect(); if (!(r.width > 4 && r.height > 4)) return false;
      const c0 = mx(1, rd(1.3 * (typeof root.ppFxHeldPixel === 'function' ? (root.ppFxHeldPixel(null).px || 2) : 2)));      // Grundzelle: 1,3 Hero-Pixel wie die Zahlen
      const F = root.PpFx52; if (!F || typeof F.maler !== 'function' || typeof F.glyph !== 'function') return false;
      const str = String(text), tw = str.length * 6 - 1, wC = mx(tw + 6, rd(r.width / c0)), hC = mx(13, rd(r.height / c0));
      const cv = document.createElement('canvas'); cv.width = wC; cv.height = hC;
      const g = cv.getContext('2d'), id = g.createImageData(wC, hC), m = F.maler(id.data, wC, hC);
      m.rect(0, 0, wC, hC, pal('#fffbd2')); m.rect(1, 1, wC - 2, hC - 2, pal('#08060c'));
      F.glyph(m, str, rd((wC - tw) / 2), rd((hC - 7) / 2), 1, pal('#fffbd2'), null, null);
      g.putImageData(id, 0, 0);
      cv.setAttribute('aria-hidden', 'true'); cv.setAttribute('data-pp-px', 'aus');
      cv.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;image-rendering:pixelated;display:none;z-index:10139;';
      document.body.appendChild(cv);
      const mx0 = r.left + r.width / 2, my0 = r.top + r.height / 2, labSt = lab.style;
      const alt = typeof root.ppFxHalte === 'function' ? root.ppFxHalte(labSt, 'visibility') : labSt.visibility;
      let frei = false;
      const freigeben = () => { if (frei) return; frei = true; try { if (typeof root.ppFxLoese !== 'function' || root.ppFxLoese(labSt, 'visibility')) labSt.visibility = alt; } catch (e) { /* weg */ } };
      labSt.visibility = 'hidden';
      const z = {
        t0: null, key: '',
        tick(jetzt) {
          if (z.t0 == null) z.t0 = jetzt;
          const q = fl((jetzt - z.t0) / TAKT + 1e-4);
          if (q >= POP_PLAKETTE.length || !lab.isConnected) { z.stopp(); return; }
          const cq = mx(1, rd(c0 * POP_PLAKETTE[q])), w = wC * cq, h = hC * cq;
          const k = cq + '|' + q;
          if (k !== z.key) { z.key = k; cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.style.left = rd(mx0 - w / 2) + 'px'; cv.style.top = rd(my0 - h / 2) + 'px'; cv.style.display = 'block'; }
        },
        stopp() { ZAHLEN.delete(z); try { cv.remove(); } catch (e) { /* weg */ } freigeben(); },
      };
      ZAHLEN.add(z); lauf(); return true;
    } catch (e) { return false; }
  }
  root.ppFx67PlakettePop = plakettePop;

  /** React-Baustein: Kanten unter dem Stapel (Deck/Potion-Deck/Ablage) und Zähler-Pop der Ablage. `n` = Kartenzahl, `art` = 'deck' | 'potion' | 'discard'. */
  function PpStapelKanten({ n, art }) {
    const ref = React.useRef(null), vorher = React.useRef(null), nAkt = React.useRef(n);
    nAkt.current = n;
    const da = n > 0 && !kantenAus();
    React.useLayoutEffect(() => { if (ref.current && da) { try { kantenZeichnen(ref.current, art, n); } catch (e) { /* ohne Kanten */ } } }, [n, art, da]);
    React.useEffect(() => {                                                    // Maße ändern sich (Fenster, Brettmaßstab): neu zeichnen — gelesen wird nur dabei, nie im Takt
      const z = ref.current && ref.current.parentElement; if (!z || !da || typeof root.ResizeObserver !== 'function') return undefined;
      let r = 0;
      const ro = new root.ResizeObserver(() => { if (r) return; r = requestAnimationFrame(() => { r = 0; if (ref.current && nAkt.current > 0) { try { kantenZeichnen(ref.current, art, nAkt.current); } catch (e) { /* weg */ } } }); });
      ro.observe(z);
      return () => { try { ro.disconnect(); if (r) cancelAnimationFrame(r); } catch (e) { /* weg */ } };
    }, [art, da]);
    React.useEffect(() => {
      const v = vorher.current; vorher.current = n;
      if (art === 'discard' && v != null && n > v && n >= 2 && ref.current && ref.current.parentElement) plakettePop(ref.current.parentElement, n);
    }, [n, art]);
    if (!da) return null;
    return <canvas ref={ref} className="pp-stapel-kanten" aria-hidden="true" data-pp-px="aus" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', imageRendering: 'pixelated', display: 'none', zIndex: 7 }} />;
  }
  root.PpStapelKanten = PpStapelKanten;
})(typeof window !== 'undefined' ? window : globalThis);
