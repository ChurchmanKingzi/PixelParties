// app-fx-50: Heilimpuls im Trailer-Look — Aufladen, Flug und Heil-Burst als Pixelart-Leinwand
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Trailer (shot01.js, „Life Serum“ → Heilimpuls zu Monia): die Quelle lädt auf (Ringe, rosa/grüne Funken, Pluskreuze, kleine Herzen, wachsende Kugel mit drei kreisenden Herzen), ein
//  Impuls-Projektil (Kugel mit Herz-/Kugelschweif) fliegt im Bogen zum Ziel, beim Treffer: Schockringe (Creme, Rosa hell, Rosa), Pluskreuze und Quadrate wie ein Splitterkranz, aufsteigende
//  Herzen und sechs kreisende Herzen. Die HP-Zahl bleibt die des Spiels (`HealNumber`) — Zeitpunkt und Wert der HP-Änderung sind unverändert.
//
//  Drei Zeichner, alles auf Rasterzellen (Zelle = 2–4 Bildschirmpixel, nach Zonenhöhe wie app-fx-48; Karte ≈ 35 Zellen), 30 Bilder/s auf `ppTaktRaf`, Schmutzrechteck-Upload (`ppFx30Maler`),
//  feste Palettenfarben, kein Alpha (Ausklang = Blinken im Zweiertakt, Ringe teils gedithert), kein Weichzeichner, nichts gedreht:
//   • TREFFER  — Registry-Animationen `heal_sparkle` (Heal, Cure, Skeleton Healer, Tarleinn, Johanna …) und `healing_hearts` (Healing Potion, Life Serum, Future Tech Doping …): ersetzen die
//                Leinwand-Fassungen aus app-fx-13. Dauer 0,92 s (die Registry entfernt nach 1,0 s). Mitte = Mitte der Zielzone (Held oder Kreatur); `healing_hearts` mit mehr Herzen, `heal_sparkle`
//                mit mehr Splittern.
//   • LADEN    — `play_heal_beam` Phase `rise` (Heal, Skeleton Healer): statt des CSS-Strahls (`healBeamRise`, Verlauf + Schein, vom Laufzeit-Backer abgetastet) lädt über der Quelle die Kugel auf (0,5 s).
//   • FLUG     — `play_heal_beam` Phase `strike`: der Impuls fliegt im Bogen von der Quelle zum Ziel (0,42 s; die Registry-Animation `heal_sparkle` folgt ~0,45 s später und übernimmt den Treffer).
//  Aufruf des Strahls: `window.ppFx50Beam(phase, srcEl, tgtEl)` → true, wenn gezeichnet wird (der Aufrufer lässt dann den CSS-Strahl weg), sonst false.
//  Rückfall: `window.__ppFxAlt` (Registry-Einträge bleiben, Strahl → false) und `window._playAnimations === false`.
//  Kosten: eine Leinwand je Phase (≈ 100 × 100 Zellen), rein zeitabhängige Teilchen ohne Zustand, ≤ ~70 Teilchen und drei Ringe je Bild, Leinwand lebt < 1 s; Aufwärmen im Leerlauf.
//  Messung (nur Tests): `window.__ppFx50Zeiten` sammelt [Art, ms] je Bild (Zeichnen + Hochladen).
// ═════════════════════════════════════════════════════════════════
const PP_FX50_BILD = 1000 / 30;
const PP_FX50_C = {
  hpk: ppHex('#fe6794'), hpk2: ppHex('#f8b4c8'), creme: ppHex('#fffbd2'), gruen: ppHex('#66ff71'), tinte: ppHex('#12101f'),
};
const PP_FX50_TREFFER_ENDE = 0.92;     // s; die Registry entfernt eine Zonen-Animation nach 1000 ms
const PP_FX50_LADEN_ENDE = 0.62;       // s; die Kugel steht bis 0,58 s (der Flug beginnt nach 0,5 s und übernimmt am selben Ort)
const PP_FX50_FLUG_DAUER = 0.42;       // s; Strahl-Phase `strike` → Registry-Animation `heal_sparkle` ≈ 350 ms + 100 ms Einhänge-Verzug
const PP_FX50_FLUG_ENDE = 0.5;

const ppFx50Kl = (v, a, b) => Math.max(a, Math.min(b, v));

/** Zellgröße und Maßstab (Trailer-Karte = 35 Zellen hoch) aus der Zonenhöhe in Bildschirmpixeln. */
function ppFx50Mass(hoehe) {
  const h = hoehe > 8 ? hoehe : 100, S = ppFx50Kl(Math.round(h / 35), 2, 4);
  return { S, rc: h / (35 * S) };
}

/** Herz des Trailers (5 × 4 Quellpixel, `z` Zellen je Quellpixel), Mitte (x, y); `hell` = heller Punkt oben links. */
function ppFx50Herz(m, x, y, z, c, hell) {
  const x0 = x - 2 * z, y0 = y - 2 * z;
  m.rect(x0 + z, y0, z, z, c); m.rect(x0 + 3 * z, y0, z, z, c);
  m.rect(x0, y0 + z, 5 * z, z, c);
  m.rect(x0 + z, y0 + 2 * z, 3 * z, z, c);
  m.rect(x0 + 2 * z, y0 + 3 * z, z, z, c);
  if (hell) m.rect(x0 + z, y0 + z, z, z, hell);
}

/** Teilchen zeichnen (Art 0 Quadrat, 1 Kreuz, 2 Stern, 3 Funke = Kreuz/Quadrat im Vierertakt, 4 Herz); ab 72 % der Lebenszeit blinkt es im Zweiertakt aus. */
function ppFx50Teilchen(m, T, t, fl) {
  const rd = Math.round, C = PP_FX50_C;
  for (let i = 0; i < T.length; i++) {
    const s = T[i], dt = t - s.t0;
    if (dt < 0 || dt >= s.life) continue;
    if (dt > s.life * 0.72 && fl(dt) % 2) continue;
    const x = rd(s.x + s.vx * dt + 0.5 * s.ax * dt * dt), y = rd(s.y + s.vy * dt + 0.5 * s.ay * dt * dt);
    let kind = s.kind; if (kind === 3) kind = fl(dt) % 4 < 2 ? 1 : 0;
    if (kind === 0) m.rect(x, y, s.sz, s.sz, s.c);
    else if (kind === 1) { m.rect(x - 1, y, 3, 1, s.c); m.rect(x, y - 1, 1, 3, s.c); }
    else if (kind === 2) { m.rect(x - 2, y, 5, 1, s.c); m.rect(x, y - 2, 1, 5, s.c); m.rect(x - 1, y - 1, 3, 3, s.c); }
    else ppFx50Herz(m, x, y, s.sz, s.c, C.creme);
  }
}

/** Kugel wie im Trailer: Tinte (r+1), Rosa (r), Hellrosa (r−1), Creme-Glanz oben links. */
function ppFx50Kugel(m, X, Y, r) {
  const C = PP_FX50_C;
  m.disc(X, Y, r + 1, C.tinte); m.disc(X, Y, r, C.hpk); m.disc(X, Y, Math.max(1, r - 1), C.hpk2);
  m.disc(X - (r >> 2), Y - (r >> 2), Math.max(1, r >> 1), C.creme);
}

// ───────────────────────── Treffer ─────────────────────────
/** g: { CX, CY, rc, zx0, zy0, zx1, zy1 } in Zellen; profil: 'herz' | 'funke'. → malen(t Sekunden, ganze Bilder). */
function ppFx50TrefferZeichner(g, m, salt, profil) {
  const C = PP_FX50_C, rd = Math.round, H = ppFx30H, ease = ppFx30Ease, fl = ppFx30Fl;
  const { CX, CY, rc, zx0, zy0, zx1, zy1 } = g;
  const th = (v) => Math.max(1, rd(v * rc));
  const v = (w) => w / 4.8 * rc;
  const cols = [C.hpk, C.hpk2, C.creme, C.gruen];
  const pr = profil === 'herz' ? { splitter: 30, herzen: 22, spirale: 6 } : { splitter: 46, herzen: 12, spirale: 5 };
  const T = [];
  let id = 0; const R = (k) => H(salt + 7, id * 13 + k);
  // Splitterkranz: Kreuze und Quadrate fliegen aus, bremsen ab (a = −1,4 · v)
  for (let k = 0, n = ppFxN(pr.splitter); k < n; k++, id++) {
    const an = R(1) * Math.PI * 2, sp = v(150 + R(2) * 480);
    T.push({ t0: R(8) * 0.06, life: 0.3 + R(5) * 0.4, x: CX, y: CY, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.9, ax: -Math.cos(an) * sp * 1.4, ay: -Math.sin(an) * sp * 1.4 * 0.9,
      kind: R(6) < 0.3 ? 1 : 0, sz: R(3) < 0.4 ? 2 : 1, c: cols[Math.floor(R(7) * cols.length)] });
  }
  // aufsteigende Herzen und Sterne (Lebensdauer so, dass alles vor 0,92 s endet)
  for (let k = 0, n = ppFxN(pr.herzen); k < n; k++, id++) {
    T.push({ t0: R(1) * 0.2, life: 0.5 + R(2) * 0.2, x: CX + (R(3) - 0.5) * v(90), y: CY + (R(4) - 0.5) * v(70) + v(10), vx: v((R(5) - 0.5) * 70), vy: -v(60 + R(6) * 120), ax: 0, ay: 0,
      kind: R(7) < 0.25 ? 2 : 4, sz: 1, c: R(7) < 0.25 ? C.creme : (k % 2 ? C.hpk : C.hpk2) });
  }
  const sp = pr.spirale;

  return (t) => {
    const q = fl(t);
    // 1) Aufleuchten der Zielzone: zwei Bilder Creme-Dither (50 % / 25 %; im Trailer 70 / 45 — die Zahl und die Karte sollen lesbar bleiben)
    if (q < 2) { const lv = q === 0 ? 0.5 : 0.25; for (let y = zy0; y < zy1; y++) for (let x = zx0; x < zx1; x++) if (ppBayer(x, y) < lv) m.rect(x, y, 1, 1, C.creme); }
    // 2) Schockringe: Creme (erste 0,1 s dick), Hellrosa, Rosa (gedithert)
    if (t <= 0.4) m.ring(CX, CY, Math.max(1, rd(ease(t / 0.4) * 24 * rc)), t < 0.1 ? th(2) : th(1), C.creme, false);
    if (t > 0.05 && t <= 0.55) m.ring(CX, CY, Math.max(1, rd(ease((t - 0.05) / 0.5) * 34 * rc)), th(2), C.hpk2, true);
    if (t > 0.1 && t <= 0.7) m.ring(CX, CY, Math.max(1, rd(ease((t - 0.1) / 0.6) * 44 * rc)), th(2), C.hpk, true);
    // 3) Teilchen
    ppFx50Teilchen(m, T, t, fl);
    // 4) kreisende Herzen, steigen mit
    if (t < 0.8) {
      for (let k = 0; k < sp; k++) {
        if (t > 0.55 && q % 2) break;
        const a = k * (Math.PI * 2 / sp) + t * 3, rr = (8 + t * 36) * rc;
        ppFx50Herz(m, rd(CX + Math.cos(a) * rr), rd(CY - t * 22 * rc + Math.sin(a) * rr * 0.6), 1, k % 2 ? C.hpk : C.hpk2, C.creme);
      }
    }
  };
}

// ───────────────────────── Laden ─────────────────────────
/** g: { CX, CY, rc } (Mitte der Quelle in Zellen). → malen(t). */
function ppFx50LadenZeichner(g, m, salt) {
  const C = PP_FX50_C, rd = Math.round, H = ppFx30H, ease = ppFx30Ease, fl = ppFx30Fl;
  const { CX, CY, rc } = g;
  const th = (w) => Math.max(1, rd(w * rc));
  const v = (w) => w / 4.8 * rc;
  const cols = [C.hpk, C.hpk2, C.creme, C.gruen];
  const OY = CY - rd(5 * rc);                                   // die Kugel schwebt etwas über der Kartenmitte
  const T = [];
  let id = 0; const R = (k) => H(salt + 11, id * 13 + k);
  // Funkenstrom um die Quelle (Trailer: 22/s, Herzen 30 %, sonst Funken; hier Kreuze und Quadrate)
  for (let t2 = 0, n = 0; t2 < 0.5; t2 += 1 / 30, id++, n++) {
    for (let j = 0; j < (n % 3 === 2 ? 2 : 1); j++) {
      const sk = R(9 + j);
      T.push({ t0: t2, life: 0.3 + R(2) * 0.3, x: CX + (R(3) - 0.5) * v(110), y: OY + (R(4) - 0.5) * v(110) + v(10), vx: v((R(5) - 0.5) * 30), vy: -v(40 + R(6) * 100), ax: 0, ay: 0,
        kind: sk < 0.3 ? 4 : (sk < 0.6 ? 3 : 1), sz: 1, c: cols[Math.floor(R(7) * cols.length)] });
    }
  }
  for (let k = 0, n = ppFxN(26); k < n; k++, id++) {            // Splitter beim Start (Trailer: Token entsteht)
    const an = R(1) * Math.PI * 2, sp = v(130 + R(2) * 420);
    T.push({ t0: 0, life: 0.25 + R(5) * 0.25, x: CX, y: OY, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, ax: -Math.cos(an) * sp * 1.4, ay: -Math.sin(an) * sp * 1.4,
      kind: R(6) < 0.3 ? 1 : 0, sz: R(3) < 0.4 ? 2 : 1, c: cols[Math.floor(R(7) * cols.length)] });
  }

  return (t) => {
    // 1) Ringe beim Start: Creme (erste 0,1 s dick) und Rosa (gedithert)
    if (t <= 0.4) m.ring(CX, OY, Math.max(1, rd(ease(t / 0.4) * 18 * rc)), t < 0.1 ? th(2) : th(1), C.creme, false);
    if (t > 0.05 && t <= 0.5) m.ring(CX, OY, Math.max(1, rd(ease((t - 0.05) / 0.45) * 28 * rc)), th(2), C.hpk, true);
    // 2) Funken
    ppFx50Teilchen(m, T, t, fl);
    // 3) die Kugel wächst, drei Herzen kreisen
    if (t < 0.58) {
      const u = ppFx50Kl(t / 0.5, 0, 1), r = 2 + rd(u * 3 * rc);
      ppFx50Kugel(m, CX, OY, r);
      for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1; ppFx50Herz(m, rd(CX + Math.cos(a) * (r + 4 * rc + 3)), rd(OY + Math.sin(a) * (r + 3 * rc + 2)), 1, k % 2 ? C.hpk : C.hpk2, null); }
    }
  };
}

// ───────────────────────── Flug ─────────────────────────
/** g: { AX, AY, BX, BY, rc } (Zellen). → malen(t). */
function ppFx50FlugZeichner(g, m, salt) {
  const C = PP_FX50_C, rd = Math.round, H = ppFx30H, fl = ppFx30Fl;
  const { AX, AY, BX, BY, rc } = g;
  const dist = Math.hypot(BX - AX, BY - AY), arc = Math.min(0.3 * dist, 26 * rc), T = PP_FX50_FLUG_DAUER;
  const r0 = 2 + rd(3 * rc);
  const pos = (tt) => {
    const u = ppFx50Kl(tt / T, 0, 1), e = Math.pow(u, 1.6);
    return [AX + (BX - AX) * e, AY + (BY - AY) * e - arc * Math.sin(Math.PI * e)];
  };
  return (t) => {
    const q = fl(t);
    if (t >= T + 0.02) return;
    // Funken, die der Impuls hinterlässt (je Bild eine Gruppe, 0,28 s sichtbar)
    for (let j = Math.max(0, q - 9); j <= q; j++) {
      const tj = j / 30, alter = t - tj; if (tj > T || alter >= 0.28) continue;
      if (alter > 0.2 && (q - j) % 2) continue;
      const [px, py] = pos(tj), a = H(j + salt, 3) * Math.PI * 2, d = (3 + H(j + salt, 4) * 5) * rc;
      const x = rd(px + Math.cos(a) * d), y = rd(py + Math.sin(a) * d + alter * 20 * rc), c = H(j + salt, 5) < 0.4 ? C.hpk2 : (H(j + salt, 5) < 0.7 ? C.creme : C.gruen);
      if (j % 2) { m.rect(x - 1, y, 3, 1, c); m.rect(x, y - 1, 1, 3, c); } else m.rect(x, y, 1, 1, c);
    }
    // Schweif: Herzen und Kugeln im Wechsel, 8 Stufen im Abstand von zwei Bildern
    for (let k = 8; k >= 1; k--) {
      const tt = t - k * 2 / 30; if (tt < 0) continue;
      const [px, py] = pos(tt), X = rd(px), Y = rd(py + k);
      if (k % 2) ppFx50Herz(m, X, Y, 1, k % 4 === 1 ? C.hpk : C.hpk2, null);
      else m.disc(X, Y, Math.max(1, rd((5 - (k >> 1)) * 0.8 * rc)), C.hpk);
    }
    if (t <= T) { const [gx, gy] = pos(t); ppFx50Kugel(m, rd(gx), rd(gy), r0); }
  };
}

// ───────────────────────── Läufer ─────────────────────────
/** Zeichenschleife: 30 Bilder/s auf dem globalen Takt, Schmutzrechteck-Upload. `malen(tSek)`; `ende` in ms; → Abbruchfunktion. */
function ppFx50Schleife(cv, gw, gh, art, bauen, ende, verzug, fertig) {
  const ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), m = ppFx30Maler(img.data, gw, gh);
  const malen = bauen(m);
  const takt = window.ppTaktRaf || window.requestAnimationFrame;
  const t0 = performance.now() + (verzug || 0);
  let raf = 0, letzte = -1, aus = false, vor = null;
  const stopp = () => { if (aus) return; aus = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } if (fertig) fertig(); };
  const schritt = (jetzt) => {
    if (aus) return;
    if (typeof jetzt !== 'number') jetzt = performance.now();
    const ms = jetzt - t0;
    if (ms >= ende) { stopp(); return; }
    const fr = Math.floor(jetzt / PP_FX50_BILD);
    if (fr !== letzte && ms >= 0) {
      letzte = fr;
      const zm = window.__ppFx50Zeiten, a0 = zm ? performance.now() : 0;
      const d = m.d, buf = img.data;
      if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); }
      d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
      malen(Math.floor(Math.max(0, ms) / PP_FX50_BILD + 1e-6) / 30);
      const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
      if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
      vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
      if (zm) zm.push([art, +(performance.now() - a0).toFixed(3)]);
    }
    raf = takt(schritt);
  };
  raf = takt(schritt);
  const netz = setTimeout(stopp, ende + (verzug || 0) + 1500);     // Notnagel (Tab im Hintergrund: rAF ruht)
  return () => { clearTimeout(netz); stopp(); };
}

// ───────────────────────── Registry: Treffer ─────────────────────────
/** Komponente für `ANIM_REGISTRY` (Eigenschaften x, y = Mitte der Zielzone in Fenster- bzw. Feldkoordinaten, w, h = Zonenmaß). */
function ppFx50TrefferKomponente(profil) {
  return function Fx50Treffer(props) {
    const cvs = useRef(null);
    const geo = useMemo(() => {
      const w = props.w > 0 ? props.w : 64, h = props.h > 0 ? props.h : 90, { S, rc } = ppFx50Mass(h);
      const Rz = Math.ceil(50 * rc) + 3, lx = Math.floor((props.x - Rz * S) / S) * S, ly = Math.floor((props.y - Rz * S) / S) * S;
      const CX = Math.round((props.x - lx) / S), CY = Math.round((props.y - ly) / S), hw = Math.max(2, Math.round(w / S / 2)), hh = Math.max(2, Math.round(h / S / 2));
      return { S, lx, ly, gw: Rz * 2, gh: Rz * 2, g: { CX, CY, rc, zx0: CX - hw, zy0: CY - hh, zx1: CX + hw, zy1: CY + hh }, salt: Math.floor(Math.random() * 1e6) };
    }, []);
    useEffect(() => {
      const el = cvs.current;
      if (!el || window._playAnimations === false) return undefined;
      return ppFx50Schleife(el, geo.gw, geo.gh, 'treffer', (m) => ppFx50TrefferZeichner(geo.g, m, geo.salt, profil), PP_FX50_TREFFER_ENDE * 1000, 0, null);
    }, []);
    return (
      <div aria-hidden="true" data-pp-px="aus" style={{ position: 'fixed', left: geo.lx, top: geo.ly, pointerEvents: 'none', zIndex: 10100 }}>
        <canvas ref={cvs} width={geo.gw} height={geo.gh} style={{ width: geo.gw * geo.S, height: geo.gh * geo.S, imageRendering: 'pixelated', display: 'block' }} />
      </div>
    );
  };
}
ppFxUeberschreiben('heal_sparkle', ppFx50TrefferKomponente('funke'));
ppFxUeberschreiben('healing_hearts', ppFx50TrefferKomponente('herz'));

// ───────────────────────── Strahl: Laden + Flug ─────────────────────────
/** Mitte eines Elements in Koordinaten der Schicht (Fenster + Feldversatz, wenn im Feld). */
function ppFx50Mitte(el) {
  const r = el.getBoundingClientRect();
  if (!(r.width > 0) || !(r.height > 0)) return null;
  const wa = window.ppFxWeltAnker ? window.ppFxWeltAnker(el) : { welt: false, dx: 0, dy: 0 };
  return { x: r.left + r.width / 2 + wa.dx, y: r.top + r.height / 2 + wa.dy, h: r.height, welt: !!wa.welt, dx: wa.dx, dy: wa.dy };
}

function ppFx50Haengen(lx, ly, gw, gh, S, welt) {
  const wurzel = document.createElement('div');
  wurzel.setAttribute('aria-hidden', 'true'); wurzel.setAttribute('data-pp-px', 'aus');
  wurzel.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;pointer-events:none;z-index:10100;`;
  const cv = document.createElement('canvas');
  cv.width = gw; cv.height = gh;
  cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
  wurzel.appendChild(cv);
  (welt && window.ppFxWeltSchicht ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel);
  return { wurzel, cv };
}

function ppFx50Beam(phase, srcEl, tgtEl) {
  try {
    if (window._playAnimations === false || window.__ppFxAlt || typeof ppFx30Maler !== 'function') return false;
    const salt = Math.floor(Math.random() * 1e6);
    if (phase === 'rise') {
      const a = srcEl && ppFx50Mitte(srcEl);
      if (!a) return false;
      const { S, rc } = ppFx50Mass(a.h), Rz = Math.ceil(46 * rc) + 4;
      const lx = Math.floor((a.x - Rz * S) / S) * S, ly = Math.floor((a.y - Rz * S) / S) * S, gw = Rz * 2, gh = Rz * 2;
      const CX = Math.round((a.x - lx) / S), CY = Math.round((a.y - ly) / S);
      const { wurzel, cv } = ppFx50Haengen(lx, ly, gw, gh, S, a.welt);
      ppFx50Schleife(cv, gw, gh, 'laden', (m) => ppFx50LadenZeichner({ CX, CY, rc }, m, salt), PP_FX50_LADEN_ENDE * 1000, 0, () => wurzel.remove());
      return true;
    }
    if (phase === 'strike') {
      const b = tgtEl && ppFx50Mitte(tgtEl);
      if (!b) return false;
      let a = srcEl && ppFx50Mitte(srcEl);
      const { S, rc } = ppFx50Mass(b.h);
      if (!a || Math.hypot(a.x - b.x, a.y - b.y) < 6 * S) a = { x: b.x, y: b.y - b.h * 1.2 };       // Quelle fehlt (oder = Ziel): der Impuls fällt von oben ein
      const arc = Math.min(0.3 * Math.hypot(b.x - a.x, b.y - a.y) / S, 26 * rc), M = Math.ceil(16 * rc) + 6;
      const lx = Math.floor((Math.min(a.x, b.x) - M * S) / S) * S, ly = Math.floor((Math.min(a.y, b.y) - (M + arc) * S) / S) * S;
      const gw = Math.min(900, Math.ceil((Math.max(a.x, b.x) + M * S - lx) / S)), gh = Math.min(700, Math.ceil((Math.max(a.y, b.y) + M * S - ly) / S));
      if (gw < 8 || gh < 8) return false;
      const g = { AX: Math.round((a.x - lx) / S), AY: Math.round((a.y - ly) / S) - Math.round(5 * rc), BX: Math.round((b.x - lx) / S), BY: Math.round((b.y - ly) / S), rc };
      const { wurzel, cv } = ppFx50Haengen(lx, ly, gw, gh, S, b.welt);
      ppFx50Schleife(cv, gw, gh, 'flug', (m) => ppFx50FlugZeichner(g, m, salt), PP_FX50_FLUG_ENDE * 1000, 0, () => wurzel.remove());
      return true;
    }
  } catch (e) { try { console.warn('ppFx50Beam', e); } catch (er) { /* still */ } }
  return false;
}
window.ppFx50Beam = ppFx50Beam;

// Aufwärmen im Leerlauf: trockene Läufe der drei Zeichner auf Wegwerf-Puffern + ein Hochladen in eine Wegwerf-Leinwand, damit der erste echte Heilimpuls nicht im JIT-kalten Code startet
(function ppFx50Aufwaermen() {
  const los = () => {
    try {
      if (typeof ppFx30Maler !== 'function') return;
      const gw = 150, gh = 150, buf = new Uint8ClampedArray(gw * gh * 4), m = ppFx30Maler(buf, gw, gh);
      const progs = [
        [ppFx50TrefferZeichner({ CX: 75, CY: 75, rc: 1, zx0: 60, zy0: 55, zx1: 90, zy1: 95 }, m, 7, 'herz'), [0.01, 0.06, 0.15, 0.3, 0.5, 0.8]],
        [ppFx50TrefferZeichner({ CX: 75, CY: 75, rc: 1, zx0: 60, zy0: 55, zx1: 90, zy1: 95 }, m, 9, 'funke'), [0.03, 0.2, 0.6]],
        [ppFx50LadenZeichner({ CX: 75, CY: 75, rc: 1 }, m, 5), [0.01, 0.1, 0.3, 0.55]],
        [ppFx50FlugZeichner({ AX: 20, AY: 120, BX: 130, BY: 40, rc: 1 }, m, 3), [0.02, 0.1, 0.25, 0.4]],
      ];
      const schritte = [];
      for (const [fn, ts] of progs) for (const t of ts) schritte.push(() => { buf.fill(0); m.d.x0 = gw; m.d.y0 = gh; m.d.x1 = 0; m.d.y1 = 0; fn(t); });
      schritte.push(() => { const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh; cv.getContext('2d').putImageData(new ImageData(buf, gw, gh), 0, 0); });
      const ric = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      const weiter = () => { const fn = schritte.shift(); if (!fn) return; try { fn(); } catch (e) { /* weg */ } ric(weiter, { timeout: 2500 }); };
      ric(weiter, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 4000 }) : los()), 3500);
})();
