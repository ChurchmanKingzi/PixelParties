// app-fx-37: Gefallene Helden — Pixel-Funken statt Grabstein
//
// ═════════════════════════════════════════════════════════════════
//  Trailer (shot01.js, „Dauerhafte Aura: Funken steigen vom Helden auf“): ein Held strahlt weiter Funken ab, auch nachdem er gefallen ist — neun je Sekunde, jeder lebt 0,7–1,2 s, steigt mit
//  45–115 (Welt-px, Kartenhöhe 210) je Sekunde auf, leicht seitlich verweht, in den drei Farben des Helden; der Funke blinkt im Vierertakt zwischen Kreuz (zwei Bilder) und Quadrat (zwei Bilder).
//  Im Spiel ersetzt das den Grabstein (🪦) auf der gefallenen Heldenkarte: `<PpFx37Tote name=…>` hängt anstelle des Emojis ein `.hero-dead-marker` (Name bleibt: app-fx-32 erkennt am Marker den Tod,
//  `[data-pp-stirbt]` blendet ihn während des Zerspringens aus) mit EINER kleinen Leinwand in die Zone. Die Funken bleiben innerhalb der Karte (die Zone schneidet — `overflow: hidden`).
//
//  Farben: die zwei auffälligsten Farben der Figur (Sprite-Sheet, Frame 0, nach Sättigung × Häufigkeit gewichtet, einmal je Held im Leerlauf gelesen) plus Weiß — wie im Trailer drei Farben je Held.
//  Ohne Sheet: Creme / Gold / Weiß. Alle Farben werden von palette.js eingerastet (`fillStyle`).
//
//  Kosten (Vorgabe: Performance): Funken sind reine Rechnung aus der Zeit (kein Zustand, keine DOM-Knoten, keine CSS-Animation), ~10 sichtbare Funken, je ein bis fünf `fillRect`.
//  Ein Takt (`ppTaktRaf`, 30 Hz) je Leinwand, nur solange sie sichtbar ist (IntersectionObserver); Größenänderung nur per ResizeObserver, nie Layout im Takt lesen. Das erste Zeichnen läuft im Leerlauf.
//  `prefers-reduced-motion`: ein stehendes Bild. Gerastert: Zelle = ganze Bildschirmpixel (≥ 2), Positionen auf die Zelle gerundet — harte Kanten, kein Alpha.
// ═════════════════════════════════════════════════════════════════
const PP_FX37_TAKT = 1000 / 30;
const PP_FX37_ZYKLUS = 1500;          // ms je Durchlauf eines Funkens (Lebensdauer ≤ 1200 + Pause)
const PP_FX37_ANZAHL = 14;            // Funken je Durchlauf → im Mittel ~9 sichtbar (Trailer: 9/s)
const PP_FX37_FARBEN_STANDARD = ['#fffbd2', '#f8ca21', '#ffffff'];
const PP_FX37_FARBEN = new Map();     // Slug → Farben (Hex), einmal je Held

const ppFx37Hash = (i, c, s) => {
  let h = (i * 374761393 + c * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Die zwei auffälligsten Farben einer Figur (Frame 0) + Weiß. Liest einmal Pixel (kleine CPU-Leinwand). */
function ppFx37Farben(eintrag) {
  try {
    const { img, meta } = eintrag;
    const fw = meta.frameWidth, fh = meta.frameHeight;
    const c = document.createElement('canvas');
    c.width = fw; c.height = fh;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, fw, fh, 0, 0, fw, fh);
    const d = g.getImageData(0, 0, fw, fh).data;
    const eimer = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      const r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      if (mx < 90) continue;                                    // sehr dunkel (Kontur)
      const sat = mx ? (mx - mn) / mx : 0;
      if (sat < 0.25 && mx < 235) continue;                     // Grau
      const k = ((r >> 5) << 6) | ((gg >> 5) << 3) | (b >> 5);
      const e = eimer.get(k) || { n: 0, r: 0, g: 0, b: 0, sat: 0 };
      e.n++; e.r += r; e.g += gg; e.b += b; e.sat += sat;
      eimer.set(k, e);
    }
    const liste = [...eimer.values()].map((e) => ({ w: e.n * (0.35 + e.sat / e.n), r: e.r / e.n, g: e.g / e.n, b: e.b / e.n })).sort((a, b) => b.w - a.w);
    const wahl = [];
    for (const e of liste) {
      if (wahl.every((o) => Math.abs(o.r - e.r) + Math.abs(o.g - e.g) + Math.abs(o.b - e.b) > 150)) wahl.push(e);
      if (wahl.length >= 2) break;
    }
    const hex = (e) => '#' + [e.r, e.g, e.b].map((v) => ('0' + Math.round(v).toString(16)).slice(-2)).join('');
    if (!wahl.length) return PP_FX37_FARBEN_STANDARD;
    const res = wahl.map(hex);
    res.push('#ffffff');
    if (res.length < 3) res.splice(1, 0, '#fffbd2');
    return res;
  } catch (e) { return PP_FX37_FARBEN_STANDARD; }
}

function ppFx37Start(cv, name) {
  const raf = window.ppTaktRaf || window.requestAnimationFrame;
  let ruhig = false;
  try { ruhig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* bewegt */ }
  const ctx = cv.getContext('2d');
  const salz = [...String(name || '')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 17);
  let farben = PP_FX37_FARBEN_STANDARD;
  let W = 0, H = 0, dpr = 1, zelle = 2, gestoppt = false, sichtbar = false, bereit = false, id = 0, idleId = 0, t0 = -1;
  const HA = window.HeroIdleAnims;
  const slug = HA && HA.slug ? HA.slug(name) : null;

  // Farben: aus dem Cache, sonst nach dem Laden des Sheets (im Leerlauf, einmal je Held)
  const farbenHolen = () => {
    if (!slug || !HA) return;
    if (PP_FX37_FARBEN.has(slug)) { farben = PP_FX37_FARBEN.get(slug); return; }
    const berechne = (e) => {
      if (!e || !e.meta || !e.img) return;
      const leer = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 1500 }) : (f) => setTimeout(f, 100);
      leer(() => { if (!PP_FX37_FARBEN.has(slug)) PP_FX37_FARBEN.set(slug, ppFx37Farben(e)); if (!gestoppt) farben = PP_FX37_FARBEN.get(slug); });
    };
    const da = HA.schonDa && HA.schonDa(slug);
    if (da) berechne(da); else if (HA.hole) HA.hole(slug).then(berechne).catch(() => {});
  };

  function groesse(w, h) {                    // nur bei Größenänderung (ResizeObserver) — nie im Takt
    const d = window.devicePixelRatio || 1;
    W = w; H = h;
    const bw = Math.max(1, Math.round(w * d)), bh = Math.max(1, Math.round(h * d));
    dpr = d;
    // Zelle: ganze Bildschirmpixel, ~2,4 je Skala-Einheit (Pixelraster des Spiels), mindestens 2
    const bs = parseFloat(getComputedStyle(cv).getPropertyValue('--board-scale')) || 1;
    zelle = Math.max(2, Math.round(2.4 * bs * d));
    if (bw !== cv.width || bh !== cv.height) { cv.width = bw; cv.height = bh; if (bereit) zeichnen(performance.now()); }
  }
  function zeichnen(t) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!(W > 0 && H > 0)) return;
    if (t0 < 0) t0 = t;
    const lauf = ruhig ? 900 : t - t0;
    const BW = cv.width, BH = cv.height, sk = BH / 210;          // 1 Welt-px des Trailers (Kartenhöhe 210) in Leinwandpixeln
    const frame = Math.floor(lauf / PP_FX37_TAKT);
    const kreuz = (frame % 4) < 2;
    for (let i = 0; i < PP_FX37_ANZAHL; i++) {
      const phase = (i / PP_FX37_ANZAHL) * PP_FX37_ZYKLUS + ppFx37Hash(i, 0, salz) * 60;
      const tt = lauf + phase, c = Math.floor(tt / PP_FX37_ZYKLUS), a = tt - c * PP_FX37_ZYKLUS;
      const leben = 700 + ppFx37Hash(i, c, salz + 1) * 500;
      if (a >= leben) continue;
      const u = a / leben;
      if (u > 0.78 && (frame & 1)) continue;                      // Blinken im Ausklang (statt Alpha)
      const x0 = BW * (0.5 + (ppFx37Hash(i, c, salz + 2) - 0.5) * 0.94), y0 = BH * (0.5 + ppFx37Hash(i, c, salz + 3) * 0.3);
      const vx = (ppFx37Hash(i, c, salz + 4) - 0.5) * 20, vy = -(45 + ppFx37Hash(i, c, salz + 5) * 70);
      const x = Math.round((x0 + vx * a / 1000 * sk) / zelle) * zelle, y = Math.round((y0 + vy * a / 1000 * sk) / zelle) * zelle;
      if (x < -2 * zelle || y < -2 * zelle || x > BW + zelle || y > BH + zelle) continue;
      ctx.fillStyle = farben[Math.floor(ppFx37Hash(i, c, salz + 6) * farben.length) % farben.length];
      if (kreuz) { ctx.fillRect(x, y, zelle, zelle); ctx.fillRect(x - zelle, y, zelle, zelle); ctx.fillRect(x + zelle, y, zelle, zelle); ctx.fillRect(x, y - zelle, zelle, zelle); ctx.fillRect(x, y + zelle, zelle, zelle); }
      else ctx.fillRect(x, y, zelle, zelle);
    }
  }
  let letzter = -1;
  function tick(t) {
    id = 0;
    if (gestoppt || !sichtbar) return;
    const fr = Math.floor(t / PP_FX37_TAKT);
    if (fr !== letzter) {                                         // nur bei neuem 30-Hz-Bild zeichnen (auch bei 60-Hz-Rückfall)
      letzter = fr;
      const zm = window.__ppFx37Zeit;                             // nur Tests: Kosten je Bild sammeln
      if (zm) { const a = performance.now(); zeichnen(t); zm.push(performance.now() - a); } else zeichnen(t);
    }
    id = raf(tick);
  }
  function anwerfen() { if (!id && bereit && sichtbar && !gestoppt && !ruhig) id = raf(tick); }

  let ro = null, io = null;
  try { ro = new ResizeObserver((es) => { const r = es[es.length - 1].contentRect; if (r.width > 0) groesse(r.width, r.height); }); ro.observe(cv); } catch (e) { /* ohne */ }
  try { io = new IntersectionObserver((es) => { sichtbar = es[es.length - 1].isIntersecting; if (sichtbar) anwerfen(); }); io.observe(cv); } catch (e) { sichtbar = true; }
  const los = () => {
    idleId = 0; if (gestoppt) return;
    if (!(W > 0)) groesse(cv.clientWidth, cv.clientHeight);
    bereit = true;
    farbenHolen();
    zeichnen(performance.now());
    anwerfen();
  };
  if (window.requestIdleCallback) idleId = window.requestIdleCallback(los, { timeout: 400 }); else idleId = setTimeout(los, 60);
  return () => {
    gestoppt = true;
    if (id) { try { cancelAnimationFrame(id); } catch (e) { /* weg */ } id = 0; }
    if (idleId) { try { window.cancelIdleCallback ? window.cancelIdleCallback(idleId) : clearTimeout(idleId); } catch (e) { /* weg */ } }
    if (ro) ro.disconnect();
    if (io) io.disconnect();
  };
}

function PpFx37ToteInnen({ name }) {
  const ref = React.useRef(null);
  React.useEffect(() => (ref.current ? ppFx37Start(ref.current, name) : undefined), [name]);
  return <div className="hero-dead-marker pp-fx37-tote" data-pp-px="aus" aria-hidden="true"><canvas ref={ref} /></div>;
}
window.PpFx37Tote = React.memo(PpFx37ToteInnen);
