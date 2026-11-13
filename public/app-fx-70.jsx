// app-fx-70: Life Serum als rosa Projektil und Säure-Spuckkugel (Acid Vial) — Pixelart-Leinwand, Trailer-Look
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Trailer (shot01.js, `pinkProj` / `acidOverlay`, Zug „Life Serum“ und „Säure“). Beide Karten waren im Spiel nur ein Zieleffekt (Life Serum: Herzen am Ziel; Acid Vial: Säure-GUSS von oben,
//  app-fx-9 — die Entscheidung vom 9.11.: „Acid Splash: Säure-Guss von oben statt Blasen und Fläschchen“). Jetzt der Trailer-Ablauf: Quelle LÄDT, das Projektil fliegt im Bogen, am Ziel der Einschlag.
//  Quelle = die HANDKARTE der gespielten Potion (`von: { owner, handIdx, pile: 'deleted' }`, app-board.jsx `vonAufloesen` → `vonHand`; die Kugel lädt über der Karte, Nutzer-Vorgabe 13.11.; die Karte fliegt serverseitig nach 250 ms Laden in den „Gelöscht"-Stapel, `_potion-hand-flight.js`). Fehlt der Handplatz: der „Gelöscht"-Stapel des Spielers. Im Spiel gibt es keinen
//  Potion-Token auf dem Brett, der schießt (ein Biomancy-Token macht nur Schaden mit `biomancy_vines`). Ziel = Zonenmitte (Helden: Brusthöhe, 0,2 Zonenhöhe über der Mitte).
//
//  life_serum_shot  (Life Serum)   Laden 0,6 s: rosa Kugel wächst von Radius 2 auf 9 (Rand Tinte, Rosa, Hellrosa, Creme-Kern), ein Ring läuft von 28 auf 12 Zellen zusammen, drei Herzen kreisen;
//                                  Flug 0,9 s im Bogen (Spitze Radius 8 mit Glanzpunkt, Schweif aus 8 Gliedern im Abstand 2 Bildern: Herzen/Kugeln im Wechsel);
//                                  Einschlag: 14 Strahlen (Tinte + Rosa/Creme, 0,3 s) auf dieser Leinwand, dazu der Heilimpuls `healing_hearts` (app-fx-50: Ringe, Splitter, Herzen) — er wird beim Einschlag
//                                  eingehängt. Gesamt 2,25 s; Einschlag bei 1,5 s.
//  acid_spit        (Acid Vial)    Laden 0,7 s: Säurekugel wächst von Radius 2 auf 7, sechs Funken flackern, Bläschen steigen auf; Flug 0,7 s im Bogen: Spitze Radius 4, Schweif aus 9 Gliedern
//                                  (Tinte/Dunkelrot/Rot, Tropfstummel), 14 dicke Tropfen lösen sich und fallen; Einschlag: drei Ringe (Creme, Rot, Dunkelrot), 14 Strahlen, Spritzer und ein
//                                  Tropfen-Nachspiel (1 s). Gesamt 2,4 s; Einschlag bei 1,4 s.
//  ENGINE-VERTRAG: die Kartenskripte warten Animationszeit + Vorlauf (`SCHADEN_MS` in acid-vial.js = 700 + 700 + 120, `HEIL_MS` in life-serum.js = 600 + 900 + 120), Zahl und HP-Balken kommen beim Einschlag.
//  PIXELGRÖSSE: Rasterzelle = Hero-Pixel des Ziels (`ppFxZelleFuer`); Trailer-Maße (Zellen bei einer 35 Zellen hohen Karte) werden mit rc = Zonenhöhe / (35 · Zelle) skaliert (0,75 … 1,5). Alles in ganzen
//  Zellen im 30-Hz-Takt (`ppTaktRaf`), feste Palettenfarben, Dither statt Alpha, Schmutzrechteck-Upload (`ppFx30Maler`). Eine Leinwand je Animation (Quelle bis Ziel, kein Layout im Takt).
//  RÜCKFALL (Retro, reduzierte Bewegung, `window.__ppFxAlt`, Kill-Switch `window.__ppFx70Aus`, keine Quelle gefunden): die bisherigen Fassungen — Acid Vial: der Säure-Guss (`acid_splash`, app-fx-9) und Life Serum:
//  der Heilimpuls (`healing_hearts`) — jeweils ZUM EINSCHLAGSZEITPUNKT (die Engine wartet unverändert), ohne Kugel. Server-seitig stellt eine Konstante (`SPUCKKUGEL` / `KUGEL`) den alten Ablauf ganz zurück.
//  Messung (nur Tests): `window.__ppFx70Info` (Start, Einschlag, Raster), `window.__ppFx70Messen = true` → `window.__ppFx70Zeiten` (ms je Bild).
// ═════════════════════════════════════════════════════════════════
const PP_FX70_ART = {
  serum:  { lade: 0.6, flug: 0.9, ende: 2.25, typ: 'life_serum_shot' },
  saeure: { lade: 0.7, flug: 0.7, ende: 2.45, typ: 'acid_spit' },
};
const PP_FX70_C = {
  creme: ppHex('#fffbd2'), tinte: ppHex('#12101f'), dred: ppHex('#780014'), rot: ppHex('#fe5154'), pink: ppHex('#f9b3b3'),
  hpk: ppHex('#fe6794'), hpk2: ppHex('#f8b4c8'),
};
// Einhänge-Daten für den Client (Zone mit eigenem Element, Mindestlebensdauer der Animation: Einschlag + Nachspiel + Reserve; der Rückfall zeigt seinen Effekt erst zum Einschlag)
try {
  if (typeof PP_SQUASH_ANIMS !== 'undefined') { PP_SQUASH_ANIMS.add('acid_spit'); PP_SQUASH_ANIMS.add('life_serum_shot'); }
  if (typeof PP_ANIM_MINDAUER !== 'undefined') { PP_ANIM_MINDAUER.acid_spit = 3100; PP_ANIM_MINDAUER.life_serum_shot = 2700; }
} catch (e) { /* ohne Tabellen: Standarddauer, Rückfall greift */ }

function ppFx70Aktiv() {
  try {
    if (window.__ppFx70Aus || window.__ppFxAlt || window.PP_RETRO || window._playAnimations === false) return false;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return typeof ppFx30Maler === 'function' && typeof ppFxZelleFuer === 'function';
  } catch (e) { return false; }
}

/** Geometrie einmal beim Einhängen: Raster, Quelle und Ziel in Zellen, Bogenhöhe. `null` = Rückfall (alte Fassung zum Einschlagszeitpunkt). */
function ppFx70Plan(props, art) {
  try {
    if (!ppFx70Aktiv() || props.prewarm) return null;
    if (typeof props.vonDx !== 'number' || typeof props.vonDy !== 'number') return null;
    if (!isFinite(props.x) || !isFinite(props.y) || !isFinite(props.vonDx) || !isFinite(props.vonDy)) return null;
    const A0 = PP_FX70_ART[art], kl = ppFx30Kl;
    const S = ppFxZelleFuer(props);
    const w = props.w > 0 ? props.w : 64, h = props.h > 0 ? props.h : 90;
    const held = !!(props.zoneEl && props.zoneEl.hasAttribute && props.zoneEl.hasAttribute('data-hero-zone'));
    const rc = kl(h / (35 * S), 0.75, 1.5), ro = kl(rc, 0.8, 1.3);
    const ax = props.x + props.vonDx, ay = props.y + props.vonDy - (props.vonHand ? 0.3 * (props.vonH || 90) : 0), bx = props.x, by = props.y - (held ? 0.2 * h : 0);
    const dist = Math.hypot(bx - ax, by - ay) / S;
    const arcH = Math.round((art === 'saeure' ? 0.3 : 0.2) * dist + 8 * rc);          // Bogenhöhe in Zellen (Trailer: Säure 200, Life Serum 130 Welteinheiten)
    const M = Math.ceil(72 * rc) * S, Mo = M + arcH * S;
    const lx = Math.floor((Math.min(ax, bx) - M) / S) * S, ly = Math.floor((Math.min(ay, by) - Mo) / S) * S;
    const gw = Math.min(900, Math.ceil((Math.max(ax, bx) + M - lx) / S)), gh = Math.min(700, Math.ceil((Math.max(ay, by) + M - ly) / S));
    if (gw < 12 || gh < 12) return null;
    return {
      art, S, lx, ly, gw, gh, rc, ro, held, arcH, lade: A0.lade, flug: A0.flug, ende: A0.ende, tHit: A0.lade + A0.flug,
      AX: Math.round((ax - lx) / S), AY: Math.round((ay - ly) / S), BX: Math.round((bx - lx) / S), BY: Math.round((by - ly) / S),
      salt: Math.floor(Math.random() * 1e6),
    };
  } catch (e) { return null; }
}

/** Zeichner: `malen(t)` für Zeit t (s, ganze Bilder) — alles in Rasterzellen der Leinwand. */
function ppFx70Zeichner(P, m) {
  const C = PP_FX70_C, rd = Math.round, H = ppFx30H, ease = ppFx30Ease, fl = ppFx30Fl, kl = ppFx30Kl;
  const { AX, AY, BX, BY, rc, ro, arcH, lade, flug, tHit, salt } = P;
  const lerp = (a, b, e) => a + (b - a) * e;
  const L0 = rd(6 * ro);                                                    // Anfangs-Aufstieg der Kugel beim Laden
  const pos = (tt) => { const e = kl((tt - lade) / flug, 0, 1); return [lerp(AX, BX, e), lerp(AY - L0, BY, e) - arcH * Math.sin(Math.PI * e)]; };
  const rr = (v) => Math.max(1, rd(v * ro));
  const strahlen = (X, Y, dt, n, kurz, lang, dTinte, dKern, farbe) => {      // Strahlenkranz (Trailer: L steigt in 0,1 s, fällt bis 0,3 s)
    if (dt >= 0.4) return;
    const Lq = ease(Math.min(1, dt / 0.1)) * (1 - Math.max(0, (dt - 0.1) / 0.2)), ri = rc * 0.8;
    for (let r = 0; r < n; r++) {
      const an = r * Math.PI * 2 / n + 0.2, len = Lq * (r % 2 ? kurz : lang) * ri, ex = rd(X + Math.cos(an) * len), ey = rd(Y + Math.sin(an) * len);
      m.linie(X, Y, ex, ey, Math.max(2, rd(dTinte * ri)), C.tinte);
      m.linie(X, Y, ex, ey, Math.max(1, rd(dKern * ri)), farbe(r));
    }
  };

  if (P.art === 'serum') {
    const herz = (x, y, c) => ppFx50Herz(m, x, y, 1, c, null);
    const kugel = (X, Y, r) => { m.disc(X, Y, r + 2, C.tinte); m.disc(X, Y, r + 1, C.hpk); m.disc(X, Y, r, C.hpk2); m.disc(X, Y, Math.max(1, r >> 1), C.creme); };
    return (t) => {
      if (t < lade) {                                                         // LADEN: Kugel wächst 2 → 9, Ring zieht sich zusammen, drei Herzen kreisen
        const u = t / lade, r = Math.max(2, rd((2 + u * 7) * ro)), X = AX, Y = AY - rd(u * L0);
        kugel(X, Y, r);
        m.ring(X, Y, rd((12 + 16 * (1 - u)) * ro), 1, C.hpk2, true);
        m.ring(X, Y, rd((24 + 20 * (1 - u)) * ro), 1, C.hpk, true);
        for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1; herz(rd(X + Math.cos(a) * (r + 8)), rd(Y + Math.sin(a) * (r + 5)), k % 2 ? C.hpk : C.hpk2); }
      } else if (t < tHit) {                                                  // FLUG: Schweif (8 Glieder, Abstand 2 Bilder), Spitze Radius 8
        for (let q = 8; q >= 1; q--) {
          const tt = t - q * 2 / 30; if (tt < lade) continue;
          const [px, py] = pos(tt);
          if (q % 2) herz(rd(px), rd(py + q), q % 4 === 1 ? C.hpk : C.hpk2); else m.disc(rd(px), rd(py + q), rr(5 - (q >> 1)), C.hpk);
        }
        const [gx, gy] = pos(t), X = rd(gx), Y = rd(gy), R = Math.max(5, rd(8 * ro));
        m.disc(X, Y, R, C.tinte); m.disc(X, Y, R - 1, C.hpk); m.disc(X, Y, R - 2, C.hpk2); m.disc(X - 1, Y - 1, Math.max(1, R - 5), C.creme);
      }
      const dt = t - tHit;                                                    // EINSCHLAG: Strahlen (Ringe/Herzen macht `healing_hearts`)
      if (dt >= 0 && dt < 0.4) strahlen(BX, BY, dt, 14, 26, 52, 6, 3, (r) => (r % 3 === 0 ? C.creme : (r % 2 ? C.hpk : C.hpk2)));
    };
  }

  // ── Säure ──
  const glob = (X, Y, r) => {
    m.disc(X, Y, r + 2, C.tinte); m.disc(X, Y, r + 1, C.dred); m.disc(X, Y, r, C.rot);
    m.disc(X - (r >> 2), Y - (r >> 2), Math.max(1, r >> 1), C.pink); m.disc(X - (r >> 1), Y - (r >> 1), Math.max(1, (r >> 3) + 1), C.creme);
  };
  // Bläschen beim Laden (Trailer: 40/s, 0,5–0,9 s Lebensdauer, Quadrate 1–2 Zellen, Rot/Dunkelrot/Rosa) — einmal gewürfelt
  const blasen = [], nB = ppFxN(Math.round(lade * 40 * 0.7));
  for (let i = 0; i < nB; i++) blasen.push({ t0: H(salt + 1, i) * lade, life: 0.5 + H(salt + 2, i) * 0.4, dx: (H(salt + 3, i) - 0.5) * 20 * ro, rise: (3 + H(salt + 4, i) * 9) * ro, sz: H(salt + 5, i) < 0.4 ? 2 : 1, c: [C.rot, C.dred, C.pink][i % 3] });
  // Spritzer beim Einschlag (aufwärts/auswärts, Schwerkraft) und Tropfen-Nachspiel (laufen am Ziel ab) — einmal gewürfelt
  const spr = [], nS = ppFxN(18);
  for (let i = 0; i < nS; i++) { const an = -Math.PI * (0.04 + H(salt + 11, i) * 0.92), sp = (34 + H(salt + 12, i) * 96) * ro; spr.push({ vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, life: 0.4 + H(salt + 13, i) * 0.45, sz: H(salt + 14, i) < 0.4 ? 2 : 1, c: [C.rot, C.dred, C.pink, C.rot][i % 4] }); }
  const trp = [], nT = ppFxN(9);
  for (let i = 0; i < nT; i++) trp.push({ t0: 0.12 + H(salt + 21, i) * 0.72, dx: (H(salt + 22, i) - 0.5) * (P.held ? 14 : 20) * ro, dy: (H(salt + 23, i) * 8 - 2) * ro, life: 0.4 + H(salt + 24, i) * 0.25, g: (70 + H(salt + 25, i) * 50) * ro, c: i % 2 ? C.rot : C.dred });
  return (t) => {
    const f = fl(t);
    if (t < lade) {                                                           // LADEN: Kugel 2 → 7, Funken flackern, Bläschen steigen
      const u = t / lade, r = Math.max(1, rd((2 + u * 5) * ro)), X = AX, Y = AY - rd((6 + u * 4) * ro * 0.6), w = f >> 1;
      for (const b of blasen) { const d = t - b.t0; if (d < 0 || d >= b.life) continue; if (d > b.life * 0.7 && f % 2) continue; m.rect(AX + rd(b.dx), AY - rd(b.rise * d / b.life * 2) - 1, b.sz, b.sz, b.c); }
      glob(X, Y, r);
      for (let k = 0; k < 6; k++) { if (H(salt + k, w + 700) > 0.2 + 0.6 * u) continue; const a0 = H(k, w + 710) * Math.PI * 2, rrr = r + 5 + H(k, w + 720) * 8; m.rect(rd(X + Math.cos(a0) * rrr), rd(Y + Math.sin(a0) * rrr), 2, 2, k % 2 ? C.pink : C.creme); }
    } else if (t < tHit) {                                                    // FLUG: Schweif (9 Glieder, Abstand 2 Bilder), 14 fallende Tropfen, Spitze
      for (let q = 9; q >= 1; q--) {
        const tt = t - q * 2 / 30; if (tt < lade) continue;
        const [px, py] = pos(tt), rm = rr(4 - (q >> 1)), X = rd(px), Y = rd(py + q * 1.8 * ro);
        m.disc(X, Y, rm + 1, C.tinte); m.disc(X, Y, rm, q % 2 ? C.dred : C.rot); m.rect(X, Y - rm - 3, 1, 3, q % 2 ? C.dred : C.rot);
      }
      for (let i = 0; i < 14; i++) {
        const te = lade + i * flug / 14, d2 = t - te; if (d2 < 0 || d2 > 0.8) continue;
        const [qx, qy] = pos(te), dx = (H(salt + 9, i) - 0.5) * 30 * d2 * ro, dy = 0.5 * 190 * d2 * d2 * ro, rd2 = rr(3 - (i % 2));
        m.disc(rd(qx + dx), rd(qy + dy), rd2 + 1, C.tinte); m.disc(rd(qx + dx), rd(qy + dy), rd2, i % 3 ? C.rot : C.dred);
      }
      const [gx, gy] = pos(t); glob(rd(gx), rd(gy), rr(4));
    }
    const dt = t - tHit;
    if (dt >= 0) {                                                            // EINSCHLAG: Ringe, Strahlen, Spritzer, Tropfen
      const X = BX, Y = BY, ri = rc * 0.8, th = (v) => Math.max(1, rd(v * ri));
      if (dt < 0.7) {
        m.ring(X, Y, rd(ease(dt / 0.3) * 30 * ri), dt < 0.08 ? th(3) : th(1), C.creme, false);
        if (dt > 0.03) m.ring(X, Y, rd(ease((dt - 0.03) / 0.4) * 44 * ri), th(2), C.rot, true);
        if (dt > 0.08) m.ring(X, Y, rd(ease((dt - 0.08) / 0.5) * 62 * ri), th(2), C.dred, true);
      }
      strahlen(X, Y, dt, 14, 26, 50, 5, 3, (r) => (r % 3 === 0 ? C.pink : C.rot));
      for (const s of spr) {
        if (dt >= s.life || (dt > s.life * 0.65 && f % 2)) continue;
        const x = rd(X + s.vx * dt), y = rd(Y - 4 * ri + s.vy * dt + 0.5 * 260 * ro * dt * dt);
        m.rect(x, y, s.sz, s.sz, s.c);
      }
      for (const d of trp) {
        const d3 = dt - d.t0; if (d3 < 0 || d3 >= d.life) continue;
        if (d3 > d.life * 0.7 && f % 2) continue;
        const y = rd(Y - 6 * ri + d.dy + 0.5 * d.g * d3 * d3 + d3 * 6 * ro), x = rd(X + d.dx);
        m.rect(x, y, 1, 2, d.c); m.rect(x, y, 1, 1, C.pink);
      }
    }
  };
}

/** Zeichenschleife: 30 Bilder/s auf dem globalen Takt (`ppTaktRaf`), Schmutzrechteck-Upload; ruft `beiTreffer` einmal beim Einschlag. Gibt die Abbruchfunktion zurück. */
function ppFx70Schleife(cv, P, beiTreffer) {
  const gw = P.gw, gh = P.gh, ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), m = ppFx30Maler(img.data, gw, gh), TAKT = 1000 / 30;
  const malen = ppFx70Zeichner(P, m), takt = window.ppTaktRaf || window.requestAnimationFrame;
  const t0 = performance.now();
  let raf = 0, letzte = -1, aus = false, vor = null, getroffen = false;
  window.__ppFx70Info = { art: P.art, t0, tHit: P.tHit, S: P.S, gw, gh, rc: P.rc, A: [P.AX, P.AY], B: [P.BX, P.BY], arcH: P.arcH };
  const stopp = () => { if (aus) return; aus = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } };
  const schritt = (jetzt) => {
    if (aus) return;
    if (typeof jetzt !== 'number') jetzt = performance.now();
    const ms = jetzt - t0, sek = ms / 1000;
    if (sek >= P.ende) { stopp(); return; }
    if (!getroffen && sek >= P.tHit) { getroffen = true; window.__ppFx70Info.tTreffer = jetzt; try { beiTreffer(); } catch (e) { /* weiter */ } }
    const fr = Math.floor(jetzt / TAKT);
    if (fr !== letzte) {
      letzte = fr;
      const mess = window.__ppFx70Messen ? performance.now() : 0;
      const d = m.d, buf = img.data;
      if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); }
      d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
      malen(Math.floor(Math.max(0, ms) / TAKT + 1e-6) / 30);
      const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
      if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
      vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
      if (mess) (window.__ppFx70Zeiten || (window.__ppFx70Zeiten = [])).push([Math.round(ms), +(performance.now() - mess).toFixed(3)]);
    }
    raf = takt(schritt);
  };
  raf = takt(schritt);
  const netz = setTimeout(stopp, P.ende * 1000 + 1500);                      // Notnagel (Tab im Hintergrund: rAF ruht)
  return () => { clearTimeout(netz); stopp(); };
}

/** Rückfall: die bisherige Fassung (Säure-Guss / Heilimpuls) erst zum Einschlagszeitpunkt (Engine wartet unverändert) — der Guss trifft ~250 ms nach seinem Start. */
function PpFx70Rueckfall({ art, props }) {
  const [los, setLos] = useState(false);
  useEffect(() => {
    const A0 = PP_FX70_ART[art], t = setTimeout(() => setLos(true), Math.max(0, (A0.lade + A0.flug) * 1000 - (art === 'saeure' ? 250 : 30)));
    return () => clearTimeout(t);
  }, []);
  const Alt = ANIM_REGISTRY[art === 'saeure' ? 'acid_splash' : 'healing_hearts'];
  return los && Alt ? <Alt {...props} /> : null;
}

function ppFx70Komponente(art) {
  return function PpFx70Effekt(props) {
    const cvs = useRef(null);
    const [treffer, setTreffer] = useState(false);
    const plan = useMemo(() => ppFx70Plan(props, art), []);
    useEffect(() => {
      if (!plan || !cvs.current) return undefined;
      return ppFx70Schleife(cvs.current, plan, () => setTreffer(true));
    }, []);
    if (props.prewarm) return null;
    if (!plan) { window.__ppFx70Grund = 'Rückfall'; return <PpFx70Rueckfall art={art} props={props} />; }
    const Heilung = art === 'serum' ? ANIM_REGISTRY.healing_hearts : null;
    return (
      <>
        <div aria-hidden="true" data-pp-px="aus" style={{ position: 'fixed', left: plan.lx, top: plan.ly, pointerEvents: 'none', zIndex: 10130 }}>
          <canvas ref={cvs} width={plan.gw} height={plan.gh} style={{ width: plan.gw * plan.S, height: plan.gh * plan.S, imageRendering: 'pixelated', display: 'block' }} />
        </div>
        {treffer && Heilung ? <Heilung {...props} /> : null}
      </>
    );
  };
}
if (typeof ANIM_REGISTRY !== 'undefined') {
  ANIM_REGISTRY.life_serum_shot = ppFx70Komponente('serum');
  ANIM_REGISTRY.acid_spit = ppFx70Komponente('saeure');
}

// Aufwärmen im Leerlauf (ein Bild je Leerlauf-Slot, ohne Leinwand im DOM): die ersten echten Bilder (JIT, Zufallstabellen) kosten sonst bis zu 10 ms, bei sechs gleichzeitigen auf schwachen Geräten mehr
(function ppFx70Aufwaermen() {
  const los = () => {
    try {
      if (!ppFx70Aktiv()) return;
      const schritte = [];
      for (const art of ['saeure', 'serum']) {
        const A0 = PP_FX70_ART[art], gw = 320, gh = 220;
        const P = { art, S: 3, gw, gh, rc: 0.9, ro: 0.9, held: true, arcH: 50, lade: A0.lade, flug: A0.flug, tHit: A0.lade + A0.flug, AX: 40, AY: 170, BX: 270, BY: 100, salt: 7 };
        const m = ppFx30Maler(new Uint8ClampedArray(gw * gh * 4), gw, gh), malen = ppFx70Zeichner(P, m);
        for (const t of [0.2, 0.55, A0.lade + 0.1, A0.lade + A0.flug * 0.6, P.tHit + 0.03, P.tHit + 0.2, P.tHit + 0.5]) schritte.push(() => { m.d.x0 = gw; m.d.y0 = gh; m.d.x1 = 0; m.d.y1 = 0; malen(Math.floor(t * 30) / 30); });
      }
      const ric = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      const weiter = () => { const f = schritte.shift(); if (!f) return; try { f(); } catch (e) { /* weg */ } ric(weiter, { timeout: 2500 }); };
      ric(weiter, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 4000 }) : los()), 3000);
})();
