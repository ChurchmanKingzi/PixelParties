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

  const GRID = { card: [43, 60], sleeve: [43, 60], avatar: [35, 35] };   // Raster der Rahmen in Kunstpixeln

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

  // ═══ Ein Rahmen zeichnen ══════════════════════════════════════════════════════════════════════
  // Liefert einen Uint32Array (w × h, 0 = durchsichtig). Das Band liegt innen auf der Kante; „Bildbereich“ der Rezepte ist der Rest.
  function build(rankIdx, kind) {
    const R = RANKS[rankIdx], B = R.B, [W, H] = GRID[kind] || GRID.card;
    const iw = W - 2 * B, ih = H - 2 * B, M = B;                // Bildbereich (iw × ih), Band darum
    const ramp = R.ramp.map(h => c32(snap(h)));
    const trimC = (R.trim || R.ramp).map(h => c32(snap(h)));
    const gemC = R.gem.map(h => c32(snap(h)));
    const glowC = (R.glow || R.gem).map(h => c32(snap(h)));
    const buf = new Uint32Array(W * H);
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const put = (x, y, c) => { if (inb(x, y)) buf[y * W + x] = c; };
    const setK = (x, y, k) => put(x, y, ramp[clamp(k, 0, 4)]);
    const setT = (x, y, k) => put(x, y, trimC[clamp(k, 0, 4)]);
    const setG = (x, y, k) => put(x, y, gemC[clamp(k, 0, 3)]);

    // Koordinaten: Ecke (u, v nach außen; 0 = Bildecke des Bildbereichs, B = Kartenkante) und Kante (s entlang nach innen, q nach außen)
    const cx0 = M + ((iw - 1) >> 1), cy0 = M + ((ih - 1) >> 1);
    const cornerXY = (c, u, v) => (c === 0 ? [M - u, M - v] : c === 1 ? [M + iw - 1 + u, M - v] : c === 2 ? [M - u, M + ih - 1 + v] : [M + iw - 1 + u, M + ih - 1 + v]);
    const sideXY = (s, a, b) => (s === 'T' ? [cx0 + a, M - b] : s === 'B' ? [cx0 + a, M + ih - 1 + b] : s === 'L' ? [M - b, cy0 + a] : [M + iw - 1 + b, cy0 + a]);
    // Licht von oben links: unten/rechts eine Stufe dunkler
    const makeCtx = (xy, dk) => {
      const w = (fn) => (p, q, k) => { const [x, y] = xy(p, q); fn(x, y, k); };
      return { k: w((x, y, k) => setK(x, y, k - dk)), kRaw: w((x, y, k) => setK(x, y, k)), t: w((x, y, k) => setT(x, y, k - dk)), g: w((x, y, k) => setG(x, y, k)), c: w((x, y, c) => put(x, y, c)), tr: xy };
    };
    const cornerCtx = (c) => makeCtx((u, v) => cornerXY(c, u, v), c === 3 ? 1 : 0);
    const sideCtx = (s) => makeCtx((a, b) => sideXY(s, a, b), (s === 'B' || s === 'R') ? 1 : 0);
    const forCorners = (fn) => { for (let c = 0; c < 4; c++) fn(cornerCtx(c), c); };
    const sideList = kind === 'avatar' ? ['T', 'B', 'L', 'R'] : kind === 'sleeve' ? ['L', 'R'] : ['T', 'B'];
    const forSides = (fn) => { for (const s of sideList) fn(sideCtx(s), s); };
    const edgesOf = (c) => [
      { k: (s, q, k) => c.k(-s, q, k), t: (s, q, k) => c.t(-s, q, k), kRaw: (s, q, k) => c.kRaw(-s, q, k), c: (s, q, col) => c.c(-s, q, col), span: iw >> 1 },
      { k: (s, q, k) => c.k(q, -s, k), t: (s, q, k) => c.t(q, -s, k), kRaw: (s, q, k) => c.kRaw(q, -s, k), c: (s, q, col) => c.c(q, -s, col), span: ih >> 1 },
    ];

    // ── Bausteine ──────────────────────────────────────────────────────────────────────────────
    // Schliff-Edelstein: Achteck mit Facetten und Kontur (opt.eye: Auge mit Schlitzpupille, opt.claws: Krappen)
    const gem = (ctx, mu, mv, r, opt) => {
      opt = opt || {};
      const lim = r + (r >> 1), inside = (du, dv) => Math.abs(du) <= r && Math.abs(dv) <= r && Math.abs(du) + Math.abs(dv) <= lim;
      for (let dv = -r; dv <= r; dv++) for (let du = -r; du <= r; du++) {
        if (!inside(du, dv)) continue;
        const rim = !inside(du + 1, dv) || !inside(du - 1, dv) || !inside(du, dv + 1) || !inside(du, dv - 1);
        if (rim) { ctx.kRaw(mu + du, mv + dv, 0); continue; }
        const ad = Math.abs(du), av = Math.abs(dv);
        let k = (ad <= r * 0.34 && av <= r * 0.34) ? 2 : (-dv > ad ? 2 : (-du > av ? 1 : 0));
        if (opt.eye) { const d2 = du * du + dv * dv; k = d2 <= r * r * 0.3 ? 2 : d2 <= r * r * 0.62 ? 1 : 0; }
        ctx.g(mu + du, mv + dv, k);
      }
      if (opt.eye) for (let dv = -(r - 1); dv <= r - 1; dv++) ctx.kRaw(mu, mv + dv, 0);
      if (r >= 2) ctx.g(mu - (r >> 1) - (opt.eye ? 1 : 0), mv - (r >> 1), 3); else if (r === 1) ctx.g(mu, mv, 3);
    };
    // Platte mit Bevel (Ecken-/Seitenkoordinaten p0..p1, q0..q1): Kontur außen, Glanzkante, Fläche, innen dunkel; rim = Gold-Einfassung
    const plate = (ctx, p0, q0, p1, q1, cham, useTrim, rim) => {
      for (let q = q0; q <= q1; q++) for (let p = p0; p <= p1; p++) {
        const ep = p1 - p, eq = q1 - q;
        if (cham && ep + eq < cham) continue;
        const eo = (cham && ep + eq === cham) ? 0 : Math.min(ep, eq);
        let k = eo === 0 ? 0 : eo === 1 ? 4 : eo === 2 ? 3 : 2;
        if (p === p0 || q === q0) k = Math.min(k, 1);
        if (rim && eo <= 1) ctx.t(p, q, eo === 0 ? 0 : 3); else (useTrim ? ctx.t : ctx.k)(p, q, k);
      }
    };
    // Dorn/Splitter in Achsenrichtung (dp, dq) ab (p, q): Länge len, Breite w (verjüngt), Kanten hell/dunkel, Spitze Glanz
    const shard = (ctx, p, q, dp, dq, len, w, useTrim) => {
      const put2 = useTrim ? ctx.t : ctx.k;
      for (let s = 0; s < len; s++) {
        const half = Math.round((w * (1 - s / len) - 1) / 2);
        for (let o = -half; o <= half; o++) {
          let k = o < 0 ? 3 : o > 0 ? 1 : 2;
          if (half === 0) k = 3;
          if (s === len - 1) k = 4;
          put2(p + dp * s + (dq !== 0 ? o : 0), q + dq * s + (dp !== 0 ? o : 0), k);
        }
      }
    };
    const leaf = (ctx, p, q, dp, dq, len, w) => {
      for (let s = 0; s < len; s++) {
        const half = Math.round(((w || 3) / 2) * Math.sin(Math.PI * (s + 0.6) / (len + 0.2)));
        for (let o = -half; o <= half; o++) ctx.k(p + dp * s + (dq !== 0 ? o : 0), q + dq * s + (dp !== 0 ? o : 0), o === 0 ? 4 : (o < 0 ? 3 : 2));
      }
    };
    const glow = (ctx, p, q) => ctx.c(p, q, glowC[1]);                 // glühender Riss (Obsidian), fest eingebacken

    // ── Band: Ring innen auf der Kante, Gehrung (Avatar: abgeschrägte Ecken), Textur ───────────────
    const rowAt = (d, lit) => {                                       // d: 1 = innen … B = Kartenkante
      const r = R.rows[B - d];
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
        const t0 = horiz ? x - M : y - M, len = horiz ? iw : ih, o = tex(d, Math.min(t0, len - 1 - t0), kk, tr);
        if (o) { kk = o.k; if (o.trim != null) tr = o.trim; }
      }
      (tr ? setT : setK)(x, y, kk);
    }

    // ── Zierrat des Ranges ────────────────────────────────────────────────────────────────────────
    const A = { forCorners, forSides, edgesOf, gem, plate, shard, leaf, glow, B, iw, ih, kind, cx0, cy0 };
    const art = ART[R.id];
    if (art) art(A);
    return { buf, W, H };
  }

  // Textur des Bandes (Stufe an Position t entlang der Kante, symmetrisch); null lässt das Profil stehen
  const TEX = {};
  TEX.diamond = (d, t, k) => (d === 2 ? { k: clamp(k + ((t & 3) < 2 ? 1 : -1), 1, 4) } : null);        // Eisfacetten
  TEX.emerald = (d, t, k, tr) => (!tr && t % 6 === 3 ? { k: 4 } : null);                                // Ranken-Punkte
  TEX.obsidian = (d, t) => (d === 2 && (t % 7) < 4 ? { k: 3 } : null);                                  // Glasadern

  // ═══ Zierrat je Rang (alles innerhalb der Bildkante) ════════════════════════════════════════════
  // Ecken: Platte S × S an der Kartenecke (u, v von B-S+1 bis B). Kanten: Zierrat zeigt NACH INNEN (q ≤ 0), nie nach außen.
  const ART = {};
  ART.silver = (A) => {                                                           // Niete in der Ecke
    const B = A.B;
    A.forCorners((c) => { A.plate(c, B - 3, B - 3, B, B, 1); c.k(B - 1, B - 1, 4); });
  };
  ART.gold = (A) => {                                                             // Plättchen mit Rubin
    const B = A.B;
    A.forCorners((c) => { A.plate(c, B - 4, B - 4, B, B, 2); A.gem(c, B - 2, B - 2, 1); });
  };
  ART.platinum = (A) => {                                                         // Platte mit Veilchen-Stein, Perl-Zähne nach innen
    const B = A.B;
    A.forCorners((c) => {
      A.plate(c, B - 5, B - 5, B, B, 2); A.gem(c, B - 2, B - 2, 1);
      for (const e of A.edgesOf(c)) for (let s = 8; s < e.span - 1; s += 7) { e.k(s, 0, 4); e.k(s - 1, 0, 3); e.k(s + 1, 0, 3); e.k(s, -1, 3); }
    });
    A.forSides((c) => { A.gem(c, 0, B - 1, 1); });
  };
  ART.diamond = (A) => {                                                          // Kristallplatte, Eiszacken nach innen
    const B = A.B;
    A.forCorners((c) => {
      A.plate(c, B - 5, B - 5, B, B, 2); A.gem(c, B - 2, B - 2, 1);
      for (const e of A.edgesOf(c)) for (let s = 8, n = 0; s < e.span - 1; s += 5, n++) A.shard(e, s, 0, 0, -1, 2 + (n & 1), 3);
    });
    A.forSides((c) => { A.gem(c, 0, B - 1, 1); A.shard(c, 0, 0, 0, -1, 4, 3); });
  };
  ART.ruby = (A) => {                                                             // Goldplatte mit Rubin, Flammenzungen nach innen
    const B = A.B;
    A.forCorners((c) => {
      A.plate(c, B - 6, B - 6, B, B, 3, true); A.gem(c, B - 3, B - 3, 2);
      for (const e of A.edgesOf(c)) for (let s = 9, n = 0; s < e.span - 1; s += 8, n++) A.shard(e, s, 0, 0, -1, 3, 3, true);
    });
    A.forSides((c) => { A.gem(c, 0, B - 1, 1); A.shard(c, 3, 0, 0, -1, 3, 2, true); A.shard(c, -3, 0, 0, -1, 3, 2, true); });
  };
  ART.sapphire = (A) => {                                                         // Gold-gerahmte Platte, Saphir, Federn nach innen
    const B = A.B;
    A.forCorners((c) => {
      A.plate(c, B - 6, B - 6, B, B, 3, false, true); A.gem(c, B - 3, B - 3, 2);
      for (const e of A.edgesOf(c)) for (let s = 9; s < 18; s += 3) { A.shard(e, s, 0, 0, -1, 4 - ((s - 9) / 3 | 0), 2); }
    });
    A.forSides((c) => { A.gem(c, 0, B - 1, 1); A.shard(c, 3, 0, 0, -1, 4, 2); A.shard(c, -3, 0, 0, -1, 4, 2); });
  };
  ART.emerald = (A) => {                                                          // Gold-gerahmte Platte, Smaragd, Blätter nach innen
    const B = A.B;
    A.forCorners((c) => {
      A.plate(c, B - 6, B - 6, B, B, 3, false, true); A.gem(c, B - 3, B - 3, 2);
      for (const e of A.edgesOf(c)) for (let s = 10; s < e.span - 2; s += 9) A.leaf(e, s, 0, 0, -1, 3, 3);
    });
    A.forSides((c) => { A.gem(c, 0, B - 1, 1); A.leaf(c, 3, 0, 0, -1, 4, 3); A.leaf(c, -3, 0, 0, -1, 4, 3); });
  };
  ART.obsidian = (A) => {                                                         // schwarze Platte mit Auge, Dornen nach innen, glühende Risse
    const B = A.B;
    A.forCorners((c) => {
      A.plate(c, B - 7, B - 7, B, B, 3); A.gem(c, B - 3, B - 3, 2, { eye: true });
      for (const e of A.edgesOf(c)) {
        for (let s = 10, n = 0; s < e.span - 1; s += 5, n++) A.shard(e, s, 0, 0, -1, 3 + (n & 1), 3);
        for (let s = 9; s < e.span - 1; s++) if ((s * 5) % 11 < 4) A.glow(e, s, 2);
      }
    });
    A.forSides((c) => { A.gem(c, 0, B - 1, 2, { eye: true }); A.shard(c, 4, 0, 0, -1, 4, 3); A.shard(c, -4, 0, 0, -1, 4, 3); });
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
