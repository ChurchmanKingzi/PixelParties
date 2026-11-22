// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  RANG-RAHMEN für Karten, Sleeves und Avatare (Upgrade durch Duplikate)
//
//  Zieht man ein Item, das man schon hat, bekommt es dauerhaft einen Rahmen: Rang = Kopien über das Original hinaus
//    1 Silber · 2 Gold · 3 Platin · 4 Diamant · 5 Rubin · 6 Saphir · 7 Smaragd · 8 Obsidian (Maximum)
//  Es gibt EINE Rahmenstufe, überall gleich (Shop, Duell, Hand, Profil). Je höher der Rang, desto breiter das Band und desto mehr Zierrat.
//
//  Alles Pixelart: Jeder Rahmen wird aus Bausteinen (Bevel-Band, Eckplatten, Edelsteine, Dorne, Blätter, Federn) auf einen kleinen Canvas
//  in KUNSTPIXELN gezeichnet (Karte/Sleeve 43 × 60, Avatar 35 × 35) und mit harter Kante auf das Bild skaliert. Der Rahmen liegt komplett
//  INNERHALB der Bildkante (nichts ragt heraus) — darum lässt er sich fest in das Bild einbacken, und jedes `<img>` im Spiel zeigt ihn
//  ohne weiteren Aufwand. Die Verhältnisse (Bandbreite, Eckgröße) sind bei jeder Bildgröße gleich.
//
//  API (window.ppRankFrames):
//     RANKS                         [{ id, name, dupes }]
//     rankOf(dupes)                 Rang-Index 0 … 7 oder null (keine Kopie → kein Rahmen)
//     frameCanvas(rank, kind)       Standbild des Rahmens (kind: 'card' | 'sleeve' | 'avatar'), zwischengespeichert
//     bake(source, w, h, rank, kind)  Canvas w × h: das Bild mit dem Rahmen darüber
//     bakeUrl(url, kind, rank)      Promise<data-URL> desselben (zwischengespeichert), für <img src> und CSS-Hintergründe
//  Alle Farben stehen in der Spiel-Palette (data/palette.json).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  // Raster der Rahmen: Karten/Sleeves 150 × 210 (= das 5-px-Raster der 750 × 1050-Karte, Feinheit 3,5 gegenüber dem Entwurf 43 × 60), Avatar 35 × 35
  const GRID = { card: [150, 210], sleeve: [150, 210], avatar: [35, 35] };
  const FINE = { card: 3.5, sleeve: 3.5, avatar: 1 };

  // ramp: Farbleiter des Materials (Kontur · dunkel · mittel · hell · Glanz). trim: Gold-Einfassung. gem: Edelstein (dunkel, mittel, hell, weiß).
  // rows: Bandprofil von außen nach innen (Zahl = Leiterstufe, 't…' = Trim-Stufe). B = Bandbreite in Kunstpixeln.
  const GOLD = ['#332300', '#8b5b04', '#f9ac20', '#fad54a', '#f7f7ad'];
  const RANKS = [
    { id: 'silver',   name: 'Silver',   dupes: 1, B: 2, ramp: ['#282834', '#59606e', '#9aa3b6', '#d2d2db', '#ffffff'], gem: ['#4e82cb', '#89abdc', '#bddcef', '#ffffff'], rows: [4, 1] },
    { id: 'gold',     name: 'Gold',     dupes: 2, B: 2, ramp: GOLD, gem: ['#8f0000', '#f03232', '#f9b3b3', '#ffffff'], rows: [4, 2] },
    { id: 'platinum', name: 'Platinum', dupes: 3, B: 3, ramp: ['#223962', '#7e7d9b', '#b4cff8', '#e5edfa', '#ffffff'], gem: ['#702db3', '#b278ed', '#d9c0ec', '#ffffff'], rows: [4, 3, 1] },
    { id: 'diamond',  name: 'Diamond',  dupes: 4, B: 3, ramp: ['#14285a', '#4e82cb', '#7fdfff', '#e5f5fa', '#ffffff'], gem: ['#399edf', '#66d9ff', '#e5f5fa', '#ffffff'], rows: [4, 3, 1] },
    { id: 'ruby',     name: 'Ruby',     dupes: 5, B: 3, ramp: ['#2a0404', '#710122', '#b21a29', '#ff6666', '#f0bfbc'], trim: GOLD, gem: ['#780014', '#fc1c5f', '#f8b4c8', '#ffffff'], rows: ['t3', 2, 't1'] },
    { id: 'sapphire', name: 'Sapphire', dupes: 6, B: 3, ramp: ['#14285a', '#02398c', '#4580f6', '#66b6ff', '#e5edfa'], trim: GOLD, gem: ['#02398c', '#3866f0', '#b4cff8', '#ffffff'], rows: ['t3', 3, 't1'] },
    { id: 'emerald',  name: 'Emerald',  dupes: 7, B: 3, ramp: ['#0f2412', '#29663f', '#4bcd7c', '#75f091', '#e5fae7'], trim: GOLD, gem: ['#29663f', '#4bcd7c', '#b3f9cf', '#ffffff'], rows: ['t3', 3, 't1'] },
    { id: 'obsidian', name: 'Obsidian', dupes: 8, B: 4, ramp: ['#08060c', '#291f3d', '#401a66', '#b278ed', '#d6bbf1'], trim: ['#08060c', '#401a66', '#b278ed', '#d6bbf1', '#ffffff'], gem: ['#5a023a', '#fb1ea9', '#f8b4df', '#ffffff'], glow: ['#5a023a', '#fb1ea9', '#f87420', '#ffd066'], rows: [3, 2, 1, 0] },
  ];

  const c32 = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;   // little endian: R, G, B, A
  };
  const snap = (hex) => (root.ppSnap ? root.ppSnap(hex) : hex);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ═══ Ein Rahmen zeichnen ═════════════════════════════════════════════════════════════�
  // Liefert einen Uint32Array (w × h, 0 = durchsichtig). Das Band liegt innen auf der Kante; „Bildbereich“ der Rezepte ist der Rest.
  // Alle Maße der Rezepte stehen in GROBEN Pixeln (Entwurfsraster 43 × 60); `k(n)` rechnet sie in Rasterpixel der Ausgabe um (Faktor F).
  // Karten/Sleeves haben F = 3,5 (150 × 210 = das 5-px-Raster der Karte selbst), der Avatar F = 1.
  function build(rankIdx, kind) {
    const R = RANKS[rankIdx], F = FINE[kind] || 1, [W, H] = GRID[kind] || GRID.card;
    const k = (n) => (n === 0 ? 0 : Math.sign(n) * Math.max(1, Math.round(Math.abs(n) * F)));
    const B = k(R.B);
    const iw = W - 2 * B, ih = H - 2 * B, M = B;                // Bildbereich (iw × ih), Band darum
    const ramp = R.ramp.map(h => c32(snap(h)));
    const trimC = (R.trim || R.ramp).map(h => c32(snap(h)));
    const gemC = R.gem.map(h => c32(snap(h)));
    const glowC = (R.glow || R.gem).map(h => c32(snap(h)));
    const buf = new Uint32Array(W * H);
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const put = (x, y, c) => { if (inb(x, y)) buf[y * W + x] = c; };
    const setK = (x, y, v) => put(x, y, ramp[clamp(v, 0, 4)]);
    const setT = (x, y, v) => put(x, y, trimC[clamp(v, 0, 4)]);
    const setG = (x, y, v) => put(x, y, gemC[clamp(v, 0, 3)]);

    // Koordinaten: Ecke (u, v nach außen; 0 = Bildecke des Bildbereichs, B = Kartenkante) und Kante (s entlang nach innen, q nach außen)
    const cx0 = M + ((iw - 1) >> 1), cy0 = M + ((ih - 1) >> 1);
    const cornerXY = (c, u, v) => (c === 0 ? [M - u, M - v] : c === 1 ? [M + iw - 1 + u, M - v] : c === 2 ? [M - u, M + ih - 1 + v] : [M + iw - 1 + u, M + ih - 1 + v]);
    const sideXY = (s, a, b2) => (s === 'T' ? [cx0 + a, M - b2] : s === 'B' ? [cx0 + a, M + ih - 1 + b2] : s === 'L' ? [M - b2, cy0 + a] : [M + iw - 1 + b2, cy0 + a]);
    // Licht von oben links: unten/rechts eine Stufe dunkler
    const makeCtx = (xy, dk) => {
      const w = (fn) => (p, q, v) => { const [x, y] = xy(p, q); fn(x, y, v); };
      return { k: w((x, y, v) => setK(x, y, v - dk)), kRaw: w((x, y, v) => setK(x, y, v)), t: w((x, y, v) => setT(x, y, v - dk)), g: w((x, y, v) => setG(x, y, v)), c: w((x, y, c) => put(x, y, c)), tr: xy };
    };
    const cornerCtx = (c) => makeCtx((u, v) => cornerXY(c, u, v), c === 3 ? 1 : 0);
    const sideCtx = (s) => makeCtx((a, b2) => sideXY(s, a, b2), (s === 'B' || s === 'R') ? 1 : 0);
    const forCorners = (fn) => { for (let c = 0; c < 4; c++) fn(cornerCtx(c), c); };
    const sideList = kind === 'avatar' ? ['T', 'B', 'L', 'R'] : kind === 'sleeve' ? ['L', 'R'] : ['T', 'B'];
    const forSides = (fn) => { for (const s of sideList) fn(sideCtx(s), s); };
    // Karten: Name (oben) und Werte (unten) bleiben frei — Zierrat nach innen gibt es nur an den senkrechten Kanten
    const edgesOf = (c) => [
      { k: (s, q, v) => c.k(-s, q, v), t: (s, q, v) => c.t(-s, q, v), kRaw: (s, q, v) => c.kRaw(-s, q, v), c: (s, q, col) => c.c(-s, q, col), span: iw >> 1 },
      { k: (s, q, v) => c.k(q, -s, v), t: (s, q, v) => c.t(q, -s, v), kRaw: (s, q, v) => c.kRaw(q, -s, v), c: (s, q, col) => c.c(q, -s, col), span: ih >> 1 },
    ].slice(kind === 'card' ? 1 : 0);
    const bw = Math.max(1, Math.round(F * 0.55));                      // Breite einer Bevel-Stufe (Kontur bleibt 1 Rasterpixel)

    // ── Bausteine (Maße in Rasterpixeln; die Rezepte rechnen mit k() um) ────────────────────────────
    // Schliff-Edelstein: Achteck mit Facetten und Kontur (opt.eye: Auge mit Schlitzpupille)
    const gem = (ctx, mu, mv, r, opt) => {
      opt = opt || {};
      const lim = r + (r >> 1), inside = (du, dv) => Math.abs(du) <= r && Math.abs(dv) <= r && Math.abs(du) + Math.abs(dv) <= lim;
      for (let dv = -r; dv <= r; dv++) for (let du = -r; du <= r; du++) {
        if (!inside(du, dv)) continue;
        const rim = !inside(du + 1, dv) || !inside(du - 1, dv) || !inside(du, dv + 1) || !inside(du, dv - 1);
        if (rim) { ctx.kRaw(mu + du, mv + dv, 0); continue; }
        const ad = Math.abs(du), av = Math.abs(dv);
        let v = (ad <= r * 0.34 && av <= r * 0.34) ? 2 : (-dv > ad ? 2 : (-du > av ? 1 : 0));
        if (opt.eye) { const d2 = du * du + dv * dv; v = d2 <= r * r * 0.3 ? 2 : d2 <= r * r * 0.62 ? 1 : 0; }
        ctx.g(mu + du, mv + dv, v);
      }
      if (opt.eye) for (let dv = -(r - 1); dv <= r - 1; dv++) ctx.kRaw(mu, mv + dv, 0);
      if (r >= 3) { const g = Math.max(1, r >> 2); for (let dv = 0; dv < g + 1; dv++) for (let du = 0; du < g + 1; du++) ctx.g(mu - (r >> 1) - (opt.eye ? 1 : 0) + du, mv - (r >> 1) + dv, 3); }
      else if (r >= 2) ctx.g(mu - (r >> 1) - (opt.eye ? 1 : 0), mv - (r >> 1), 3); else if (r === 1) ctx.g(mu, mv, 3);
    };
    // Platte mit Bevel (Ecken-/Seitenkoordinaten p0..p1, q0..q1): Kontur außen (1 px), Glanzkante, Fläche, innen dunkel; rim = Gold-Einfassung
    const plate = (ctx, p0, q0, p1, q1, cham, useTrim, rim) => {
      for (let q = q0; q <= q1; q++) for (let p = p0; p <= p1; p++) {
        const ep = p1 - p, eq = q1 - q;
        if (cham && ep + eq < cham) continue;
        const eo = (cham && ep + eq === cham) ? 0 : Math.min(ep, eq);
        let v = eo === 0 ? 0 : eo <= bw ? 4 : eo <= 2 * bw ? 3 : 2;
        if (p === p0 || q === q0) v = Math.min(v, 1);
        if (rim && eo <= bw) ctx.t(p, q, eo === 0 ? 0 : 3); else (useTrim ? ctx.t : ctx.k)(p, q, v);
      }
    };
    // Dorn/Splitter in Achsenrichtung (dp, dq) ab (p, q): Länge len, Breite w (verjüngt), Kanten hell/dunkel, Spitze Glanz
    const shard = (ctx, p, q, dp, dq, len, w, useTrim) => {
      const put2 = useTrim ? ctx.t : ctx.k;
      for (let s = 0; s < len; s++) {
        const half = Math.round((w * (1 - s / len) - 1) / 2);
        for (let o = -half; o <= half; o++) {
          let v = o < 0 ? 3 : o > 0 ? 1 : 2;
          if (half === 0) v = 3;
          if (s === len - 1 || (o === -half && F > 1)) v = Math.max(v, 3) + (s === len - 1 ? 1 : 0);
          if (o === half && half > 0 && F > 1) v = 0;
          put2(p + dp * s + (dq !== 0 ? o : 0), q + dq * s + (dp !== 0 ? o : 0), v);
        }
      }
    };
    const leaf = (ctx, p, q, dp, dq, len, w) => {
      for (let s = 0; s < len; s++) {
        const half = Math.round(((w || 3) / 2) * Math.sin(Math.PI * (s + 0.6) / (len + 0.2)));
        for (let o = -half; o <= half; o++) ctx.k(p + dp * s + (dq !== 0 ? o : 0), q + dq * s + (dp !== 0 ? o : 0), (o === half && half > 0 && F > 1) ? 0 : (o === 0 ? 4 : (o < 0 ? 3 : 2)));
      }
    };
    const glow = (ctx, p, q) => ctx.c(p, q, glowC[1]);                 // glühender Riss (Obsidian), fest eingebacken

    // ── Band: Ring innen auf der Kante, Gehrung (Avatar: abgeschrägte Ecken), Textur ───────────────
    const nRows = R.rows.length;
    const rowAt = (d, lit) => {                                       // d: 1 = innen … B = Kartenkante
      let ri = nRows - 1 - Math.min(nRows - 1, Math.floor((d - 1) / (B / nRows)));
      const r = R.rows[ri];
      if (typeof r === 'string') return { trim: true, k: parseInt(r.slice(1), 10) - (lit ? 0 : 1) };
      return { trim: false, k: r === 0 ? 0 : r - (lit ? 0 : 1) };
    };
    const tex = TEX[R.id];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = Math.max(M - x, x - (M + iw - 1), 0), dy = Math.max(M - y, y - (M + ih - 1), 0);
      if (dx === 0 && dy === 0) continue;
      let d = Math.max(dx, dy);
      if (kind === 'avatar' && dx > 0 && dy > 0) d = Math.max(d, Math.round((dx + dy) * 0.74));
      if (d > B) continue;
      const horiz = dy >= dx, lit = horiz ? y < M : x < M, e = rowAt(d, lit);
      let kk = e.k, tr = e.trim;
      if (tex && (dx === 0 || dy === 0)) {
        const t0 = horiz ? x - M : y - M, len = horiz ? iw : ih, o = tex(d, Math.min(t0, len - 1 - t0), kk, tr, F);
        if (o) { kk = o.k; if (o.trim != null) tr = o.trim; }
      }
      // Feine Raster: 1 px Kontur an der Außenkante und zur Bildseite hin (die Karte bekommt eine klare Linie wie Kartenrahmen sonst auch)
      if (F > 1 && (d === B || d === 1)) { kk = 0; tr = false; }
      (tr ? setT : setK)(x, y, kk);
    }

    // ── Zierrat des Ranges ──────────────────────────────────────────────────────────────�
    const A = { forCorners, forSides, edgesOf, gem, plate, shard, leaf, glow, B, iw, ih, kind, cx0, cy0, k, F };
    const art = ART[R.id];
    if (art) art(A);
    return { buf, W, H };
  }

  // Textur des Bandes (Stufe an Position t entlang der Kante, symmetrisch); null lässt das Profil stehen. F: Feinheit des Rasters.
  const TEX = {};
  const texU = (t, F) => Math.floor(F > 1 ? t / (F / 2) : t);          // Position in Musterschritten (feine Raster: doppelt so fein wie der grobe Entwurf)
  TEX.diamond = (d, t, v, tr, F) => (d === Math.round(2 * (F || 1)) ? { k: clamp(v + ((texU(t, F) & 3) < 2 ? 1 : -1), 1, 4) } : null);   // Eisfacetten
  TEX.emerald = (d, t, v, tr, F) => (!tr && texU(t, F) % 6 === 3 ? { k: 4 } : null);                                                       // Ranken-Punkte
  TEX.obsidian = (d, t, v, tr, F) => (d === Math.round(2 * (F || 1)) && (texU(t, F) % 7) < 4 ? { k: 3 } : null);                           // Glasadern

  // ═══ Zierrat je Rang (alles innerhalb der Bildkante) ════════════════════════════════════════════
  // Ecken: Platte S × S an der Kartenecke (u, v von B-S+1 bis B). Kanten: Zierrat zeigt NACH INNEN (q ≤ 0), nie nach außen.
  // Maße in groben Pixeln, mit A.k() ins Raster der Ausgabe umgerechnet.
  const ART = {};
  ART.silver = (A) => {                                                           // Niete in der Ecke
    const B = A.B, k = A.k;
    A.forCorners((c) => { A.plate(c, B - k(3), B - k(3), B, B, k(1)); const m = B - k(1.4); for (let a = 0; a < Math.max(1, k(1) - 1); a++) for (let b2 = 0; b2 < Math.max(1, k(1) - 1); b2++) c.k(m - a, m - b2, 4); });
  };
  ART.gold = (A) => {                                                             // Plättchen mit Rubin
    const B = A.B, k = A.k;
    A.forCorners((c) => { A.plate(c, B - k(4), B - k(4), B, B, k(2)); A.gem(c, B - k(2), B - k(2), k(1)); });
  };
  ART.platinum = (A) => {                                                         // Platte mit Veilchen-Stein, Perl-Zähne nach innen
    const B = A.B, k = A.k;
    A.forCorners((c) => {
      A.plate(c, B - k(5), B - k(5), B, B, k(2)); A.gem(c, B - k(2), B - k(2), k(1));
      for (const e of A.edgesOf(c)) for (let s = k(8); s < e.span - k(1); s += k(7)) {
        if (A.F === 1) { e.k(s, 0, 4); e.k(s - 1, 0, 3); e.k(s + 1, 0, 3); e.k(s, -1, 3); continue; }
        const z = Math.max(1, k(1) - 1);
        for (let a = -z; a <= z; a++) for (let b2 = 0; b2 <= z; b2++) e.k(s + a, -b2, 4 - (Math.abs(a) === z ? 1 : 0));
      }
    });
    A.forSides((c) => { A.gem(c, 0, B - k(1), k(1)); });
  };
  ART.diamond = (A) => {                                                          // Kristallplatte, Eiszacken nach innen
    const B = A.B, k = A.k;
    A.forCorners((c) => {
      A.plate(c, B - k(5), B - k(5), B, B, k(2)); A.gem(c, B - k(2), B - k(2), k(1));
      for (const e of A.edgesOf(c)) for (let s = k(8), n = 0; s < e.span - k(1); s += k(5), n++) A.shard(e, s, 0, 0, -1, k(2 + (n & 1)), k(3));
    });
    A.forSides((c) => { A.gem(c, 0, B - k(1), k(1)); if (A.kind !== 'card') A.shard(c, 0, 0, 0, -1, k(4), k(3)); });
  };
  ART.ruby = (A) => {                                                             // Goldplatte mit Rubin, Flammenzungen nach innen
    const B = A.B, k = A.k;
    A.forCorners((c) => {
      A.plate(c, B - k(6), B - k(6), B, B, k(3), true); A.gem(c, B - k(3), B - k(3), k(2));
      for (const e of A.edgesOf(c)) for (let s = k(9), n = 0; s < e.span - k(1); s += k(8), n++) A.shard(e, s, 0, 0, -1, k(3), k(3), true);
    });
    A.forSides((c) => { A.gem(c, 0, B - k(1), k(1)); if (A.kind !== 'card') { A.shard(c, k(3), 0, 0, -1, k(3), k(2), true); A.shard(c, -k(3), 0, 0, -1, k(3), k(2), true); } });
  };
  ART.sapphire = (A) => {                                                         // Gold-gerahmte Platte, Saphir, Federn nach innen
    const B = A.B, k = A.k;
    A.forCorners((c) => {
      A.plate(c, B - k(6), B - k(6), B, B, k(3), false, true); A.gem(c, B - k(3), B - k(3), k(2));
      for (const e of A.edgesOf(c)) for (let n = 0; n < 3; n++) A.shard(e, k(9 + 3 * n), 0, 0, -1, k(4 - n), k(2));
    });
    A.forSides((c) => { A.gem(c, 0, B - k(1), k(1)); if (A.kind !== 'card') { A.shard(c, k(3), 0, 0, -1, k(4), k(2)); A.shard(c, -k(3), 0, 0, -1, k(4), k(2)); } });
  };
  ART.emerald = (A) => {                                                          // Gold-gerahmte Platte, Smaragd, Blätter nach innen
    const B = A.B, k = A.k;
    A.forCorners((c) => {
      A.plate(c, B - k(6), B - k(6), B, B, k(3), false, true); A.gem(c, B - k(3), B - k(3), k(2));
      for (const e of A.edgesOf(c)) for (let s = k(10); s < e.span - k(2); s += k(9)) A.leaf(e, s, 0, 0, -1, k(3), k(3));
    });
    A.forSides((c) => { A.gem(c, 0, B - k(1), k(1)); if (A.kind !== 'card') { A.leaf(c, k(3), 0, 0, -1, k(4), k(3)); A.leaf(c, -k(3), 0, 0, -1, k(4), k(3)); } });
  };
  ART.obsidian = (A) => {                                                         // schwarze Platte mit Auge, Dornen nach innen, glühende Risse
    const B = A.B, k = A.k;
    A.forCorners((c) => {
      A.plate(c, B - k(7), B - k(7), B, B, k(3)); A.gem(c, B - k(3), B - k(3), k(2), { eye: true });
      for (const e of A.edgesOf(c)) {
        for (let s = k(10), n = 0; s < e.span - k(1); s += k(5), n++) A.shard(e, s, 0, 0, -1, k(3 + (n & 1)), k(3));
        for (let s = k(9); s < e.span - k(1); s++) if (((A.F === 1 ? s : Math.floor(s * 2 / A.F)) * 5) % 11 < 4) A.glow(e, s, k(2));
      }
    });
    A.forSides((c) => { A.gem(c, 0, B - k(1), k(2), { eye: true }); if (A.kind !== 'card') { A.shard(c, k(4), 0, 0, -1, k(4), k(3)); A.shard(c, -k(4), 0, 0, -1, k(4), k(3)); } });
  };

  // ═══ Zwischenspeicher und Einbacken ═════════════════════════════════════════════════════════════
  const frameCache = new Map();
  /** Standbild des Rahmens als Canvas (Raster GRID[kind]), zwischengespeichert. */
  function frameCanvas(rank, kind) {
    const key = rank + '|' + kind;
    let cv = frameCache.get(key);
    if (cv) return cv;
    const f = build(rank, kind);
    cv = document.createElement('canvas'); cv.width = f.W; cv.height = f.H;
    const g = cv.getContext('2d'), img = g.createImageData(f.W, f.H);
    new Uint32Array(img.data.buffer).set(f.buf);
    g.putImageData(img, 0, 0);
    frameCache.set(key, cv);
    return cv;
  }
  /** Canvas w × h: die Quelle (Bild/Canvas) mit dem Rahmen darüber (harte Kante, kein Glätten). */
  function bake(source, w, h, rank, kind) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(source, 0, 0, w, h);
    g.drawImage(frameCanvas(rank, kind), 0, 0, w, h);
    return cv;
  }
  const urlCache = new Map();
  /** Promise<data-URL> von Bild + Rahmen (zwischengespeichert). Schlägt das Laden fehl, liefert sie die Original-URL. */
  function bakeUrl(url, kind, rank) {
    const key = rank + '|' + kind + '|' + url;
    if (urlCache.has(key)) return urlCache.get(key);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try { resolve(bake(img, img.naturalWidth || 200, img.naturalHeight || 200, rank, kind).toDataURL('image/png')); } catch { resolve(url); }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
    urlCache.set(key, p);
    return p;
  }
  /** Rang-Index aus der Kopienzahl (0 = keine Kopie → kein Rahmen → null). */
  const rankOf = (dupes) => (dupes > 0 ? Math.min(RANKS.length, Math.floor(dupes)) - 1 : null);

  root.ppRankFrames = { RANKS, GRID, rankOf, frameCanvas, bake, bakeUrl };
})(typeof window !== 'undefined' ? window : globalThis);
