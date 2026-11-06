// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  RANG-RAHMEN für Karten, Sleeves und Avatare (Upgrade-Stufen durch Duplikate)
//
//    1 Silber · 2 Gold · 3 Platin · 4 Diamant · 5 Rubin · 6 Saphir · 7 Smaragd · 8 Obsidian
//    (Kopien: 1 … 8; eine Kopie = Silber, acht = Obsidian)
//
//  Alles Pixelart: Jeder Rahmen wird aus Bausteinen (Bevel-Band, Eckplatten, Zierborten, Edelsteine, Kristalle, Blätter, Flügel,
//  Hörner) auf einen kleinen Canvas in KUNSTPIXELN gezeichnet; die Seite vergrößert ihn ganzzahlig (`image-rendering: pixelated`).
//  Je höher der Rang, desto breiter das Band und desto mehr Zierrat und Bewegung (Lichtstreifen, Funkeln, Glühen, Schweben).
//
//  Aufbau (Koordinaten in Kunstpixeln):
//     Leinwand = Bild (iw × ih) + Rand M ringsum (für Zierrat, der über die Kante hinausragt)
//     Band     = Ring um das Bild (Tiefe 1 … B), geschnittene Ecken, Licht von oben links
//     Ecken    = Platten + Zierrat je Rang (auf alle vier Ecken gespiegelt; Koordinaten u, v nach außen, s entlang der Kante nach innen)
//     Seiten   = Mitten-Zierrat je Rang (Karte: oben/unten, Sleeve: links/rechts, Avatar: alle vier)
//     Bewegung = Lichtstreifen, Funkeln an Edelsteinen, Glühpixel, schwebende Funken, Wellen
//
//  API (window.ppRankFrames):
//     RANKS                                Liste { id, name, copies, B, … }
//     M                                    Rand der Leinwand um das Bild (Kunstpixel)
//     create(rankIndex, kind, iw, ih)  →   { w, h, M, rank, draw(ctx, t, still) }      kind: 'card' | 'sleeve' | 'avatar'
//  Alle Farben stehen in der Spiel-Palette (data/palette.json).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  const M = 24;                       // Rand um das Bild für Zierrat (Kunstpixel)

  // ── Rang-Tabelle ───────────────────────────────────────────────────────────────────────────
  // ramp: Farbleiter des Materials (Kontur · dunkel · mittel · hell · Glanz). trim: Gold-Einfassung (gleiche Leiter).
  // gem: Edelstein (dunkel, mittel, hell, weiß). rows: Bandprofil von außen nach innen (Zahl = Leiterstufe, 't…' = Trim-Stufe).
  const GOLD = ['#332300', '#8b5b04', '#f9ac20', '#fad54a', '#f7f7ad'];
  const RANKS = [
    { id: 'silver',   name: 'Silver',   copies: 1, B: 3, ramp: ['#282834', '#59606e', '#9aa3b6', '#d2d2db', '#ffffff'], gem: ['#4e82cb', '#89abdc', '#bddcef', '#ffffff'], rows: [0, 4, 1] },
    { id: 'gold',     name: 'Gold',     copies: 2, B: 4, ramp: GOLD, gem: ['#8f0000', '#f03232', '#f9b3b3', '#ffffff'], rows: [0, 4, 2, 1] },
    { id: 'platinum', name: 'Platinum', copies: 3, B: 4, ramp: ['#223962', '#7e7d9b', '#b4cff8', '#e5edfa', '#ffffff'], gem: ['#702db3', '#b278ed', '#d9c0ec', '#ffffff'], rows: [0, 4, 3, 1] },
    { id: 'diamond',  name: 'Diamond',  copies: 4, B: 5, ramp: ['#14285a', '#4e82cb', '#7fdfff', '#e5f5fa', '#ffffff'], gem: ['#399edf', '#66d9ff', '#e5f5fa', '#ffffff'], rows: [0, 4, 3, 2, 1] },
    { id: 'ruby',     name: 'Ruby',     copies: 5, B: 5, ramp: ['#2a0404', '#710122', '#b21a29', '#ff6666', '#f0bfbc'], trim: GOLD, gem: ['#780014', '#fc1c5f', '#f8b4c8', '#ffffff'], rows: ['t0', 't3', 3, 2, 't1'] },
    { id: 'sapphire', name: 'Sapphire', copies: 6, B: 6, ramp: ['#14285a', '#02398c', '#4580f6', '#66b6ff', '#e5edfa'], trim: GOLD, gem: ['#02398c', '#3866f0', '#b4cff8', '#ffffff'], rows: ['t0', 't3', 3, 2, 1, 't1'] },
    { id: 'emerald',  name: 'Emerald',  copies: 7, B: 6, ramp: ['#0f2412', '#29663f', '#4bcd7c', '#75f091', '#e5fae7'], trim: GOLD, gem: ['#29663f', '#4bcd7c', '#b3f9cf', '#ffffff'], rows: ['t0', 't3', 3, 2, 1, 't1'] },
    { id: 'obsidian', name: 'Obsidian', copies: 8, B: 7, ramp: ['#08060c', '#291f3d', '#401a66', '#b278ed', '#d6bbf1'], trim: ['#08060c', '#401a66', '#b278ed', '#d6bbf1', '#ffffff'], gem: ['#5a023a', '#fb1ea9', '#f8b4df', '#ffffff'], glow: ['#5a023a', '#fb1ea9', '#f87420', '#ffd066'], rows: [0, 3, 2, 1, 2, 1, 0] },
  ];

  const c32 = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;   // little endian: R, G, B, A
  };
  const snap = (hex) => (root.ppSnap ? root.ppSnap(hex) : hex);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const putBuf = (buf, W, H, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; buf[y * W + x] = c; };

  // ═══ Ein Rahmen ═══════════════════════════════════════════════════════════════════════════════
  function create(rankIdx, kind, iw, ih) {
    const R = RANKS[rankIdx], B = R.B;
    const W = iw + 2 * M, Hh = ih + 2 * M;
    const ramp = R.ramp.map(h => c32(snap(h)));
    const trimC = (R.trim || R.ramp).map(h => c32(snap(h)));
    const gemC = R.gem.map(h => c32(snap(h)));
    const glowC = (R.glow || R.gem).map(h => c32(snap(h)));
    const base = new Uint32Array(W * Hh);              // Standbild (0 = durchsichtig)
    const rkey = new Int8Array(W * Hh).fill(-1);       // Leiterstufe der Metallpixel (Lichtstreifen), sonst -1
    const rcls = new Uint8Array(W * Hh);               // 1 = Material, 2 = Trim/Gold
    const glints = [], glows = [], sparks = [], motes = [];
    const idx = (x, y) => y * W + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh;
    const setK = (x, y, k) => { if (!inb(x, y)) return; k = clamp(k, 0, 4); base[idx(x, y)] = ramp[k]; rkey[idx(x, y)] = k; rcls[idx(x, y)] = 1; };
    const setT = (x, y, k) => { if (!inb(x, y)) return; k = clamp(k, 0, 4); base[idx(x, y)] = trimC[k]; rkey[idx(x, y)] = k; rcls[idx(x, y)] = R.trim ? 2 : 1; };
    const setG = (x, y, k) => { if (!inb(x, y)) return; base[idx(x, y)] = gemC[clamp(k, 0, 3)]; rkey[idx(x, y)] = -1; rcls[idx(x, y)] = 0; };
    const setC = (x, y, c) => { if (!inb(x, y)) return; base[idx(x, y)] = c; rkey[idx(x, y)] = -1; rcls[idx(x, y)] = 0; };

    // ── Koordinaten ──────────────────────────────────────────────────────────────────────────────
    const cx0 = M + Math.floor((iw - 1) / 2), cy0 = M + Math.floor((ih - 1) / 2);
    const cornerXY = (c, u, v) => (c === 0 ? [M - u, M - v] : c === 1 ? [M + iw - 1 + u, M - v] : c === 2 ? [M - u, M + ih - 1 + v] : [M + iw - 1 + u, M + ih - 1 + v]);
    const sideXY = (s, a, b) => (s === 'T' ? [cx0 + a, M - b] : s === 'B' ? [cx0 + a, M + ih - 1 + b] : s === 'L' ? [M - b, cy0 + a] : [M + iw - 1 + b, cy0 + a]);
    // Licht von oben links: Ecke/Seite unten oder rechts eine Stufe dunkler
    const makeCtx = (xy, dk, key) => {
      const wrap = (fn) => (p, q, k) => { const [x, y] = xy(p, q); fn(x, y, k); };
      return {
        key,
        k: wrap((x, y, k) => setK(x, y, k - dk)), kRaw: wrap((x, y, k) => setK(x, y, k)),
        t: wrap((x, y, k) => setT(x, y, k - dk)), tRaw: wrap((x, y, k) => setT(x, y, k)),
        g: wrap((x, y, k) => setG(x, y, k)), c: wrap((x, y, c) => setC(x, y, c)), tr: xy,
      };
    };
    const cornerCtx = (c) => makeCtx((u, v) => cornerXY(c, u, v), c === 3 ? 1 : 0, c);
    const sideCtx = (s) => makeCtx((a, b) => sideXY(s, a, b), (s === 'B' || s === 'R') ? 1 : 0, s);
    const forCorners = (fn) => { for (let c = 0; c < 4; c++) fn(cornerCtx(c), c); };
    // Seiten, die diese Bildart schmückt: Karte oben/unten, Sleeve links/rechts, Avatar alle vier
    const sideList = kind === 'avatar' ? ['T', 'B', 'L', 'R'] : kind === 'sleeve' ? ['L', 'R'] : ['T', 'B'];
    const forSides = (fn, sides) => { for (const s of (sides || sideList)) fn(sideCtx(s), s); };
    const halfSpan = (s) => ((s === 'T' || s === 'B') ? iw : ih) >> 1;     // halbe Kantenlänge (für Zierborten bis zur Mitte)
    // Beide Kanten einer Ecke als (s entlang nach innen, q nach außen)-Kontexte; span = halbe Länge der Kante
    const edgesOf = (c) => [
      { k: (s, q, k) => c.k(-s, q, k), t: (s, q, k) => c.t(-s, q, k), kRaw: (s, q, k) => c.kRaw(-s, q, k), g: (s, q, k) => c.g(-s, q, k), c: (s, q, col) => c.c(-s, q, col), tr: (s, q) => c.tr(-s, q), span: iw >> 1 },
      { k: (s, q, k) => c.k(q, -s, k), t: (s, q, k) => c.t(q, -s, k), kRaw: (s, q, k) => c.kRaw(q, -s, k), g: (s, q, k) => c.g(q, -s, k), c: (s, q, col) => c.c(q, -s, col), tr: (s, q) => c.tr(q, -s), span: ih >> 1 },
    ];

    // ── Bausteine ──────────────────────────────────────────────────────────────────────────────
    // Schliff-Edelstein (Achteck mit Facetten, Kontur, Glanzpunkt). opt.claws: Krappen aus Trim, opt.noGlint: kein Funkeln
    const gem = (ctx, mu, mv, r, opt) => {
      opt = opt || {};
      const lim = r + (r >> 1), inside = (du, dv) => Math.abs(du) <= r && Math.abs(dv) <= r && Math.abs(du) + Math.abs(dv) <= lim;
      for (let dv = -r; dv <= r; dv++) for (let du = -r; du <= r; du++) {
        if (!inside(du, dv)) continue;
        const rim = !inside(du + 1, dv) || !inside(du - 1, dv) || !inside(du, dv + 1) || !inside(du, dv - 1);
        const ad = Math.abs(du), av = Math.abs(dv);
        let k;
        if (rim) { ctx.kRaw(mu + du, mv + dv, 0); continue; }
        if (ad <= r * 0.34 && av <= r * 0.34) k = 2;                // Tafel
        else if (-dv > ad) k = 2;                                    // oben
        else if (-du > av) k = 1;                                    // links
        else k = 0;                                                  // rechts/unten
        if (opt.eye) { const d2 = du * du + dv * dv; k = d2 <= r * r * 0.3 ? 2 : d2 <= r * r * 0.62 ? 1 : 0; }   // Auge: Iris in Ringen
        ctx.g(mu + du, mv + dv, k);
      }
      if (opt.eye) for (let dv = -(r - 1); dv <= r - 1; dv++) ctx.kRaw(mu, mv + dv, 0);                     // Schlitzpupille
      if (r >= 2) ctx.g(mu - (r >> 1) - (opt.eye ? 1 : 0), mv - (r >> 1), 3);            // Glanzpunkt
      else if (r === 1) ctx.g(mu, mv, 3);
      if (opt.claws && r >= 2) for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const a = mu + su * (r + 1), b = mv + sv * (r + 1), kk = opt.dark ? 0 : 3;       // dunkle Krappen auf Gold, goldene auf Material
        ctx.t(a, b, kk); ctx.t(a - su, b, kk > 0 ? 2 : 1); ctx.t(a, b - sv, kk > 0 ? 2 : 1);
      }
      if (!opt.noGlint) { const [ax, ay] = ctx.tr(mu, mv); glints.push({ x: ax, y: ay, r }); }
    };
    // Platte mit Bevel (Ecken-/Seitenkoordinaten p0..p1, q0..q1), außen Kontur, dann Glanzkante, Fläche, innen dunkel
    const plate = (ctx, p0, q0, p1, q1, cham, useTrim, rim) => {
      for (let q = q0; q <= q1; q++) for (let p = p0; p <= p1; p++) {
        const ep = p1 - p, eq = q1 - q;
        if (cham && ep + eq < cham) continue;
        const eo = (cham && ep + eq === cham) ? 0 : Math.min(ep, eq);
        let k = eo === 0 ? 0 : eo === 1 ? 4 : eo === 2 ? 3 : 2;
        if (p === p0 || q === q0) k = Math.min(k, 1);
        if (rim && eo <= 1) (eo === 0 ? ctx.t : ctx.t)(p, q, eo === 0 ? 0 : 3);          // Gold-Einfassung um eine Platte aus Material
        else (useTrim ? ctx.t : ctx.k)(p, q, k);
      }
    };
    // Dorn/Splitter in Achsenrichtung (dp, dq) ab (p, q): Länge len, Breite w (verjüngt), Kanten hell/dunkel, Spitze Glanz
    const shard = (ctx, p, q, dp, dq, len, w, useTrim) => {
      const put = useTrim ? ctx.t : ctx.k;
      for (let s = 0; s < len; s++) {
        const half = Math.round((w * (1 - s / len) - 1) / 2);
        for (let o = -half; o <= half; o++) {
          const a = p + dp * s + (dq !== 0 ? o : 0), b = q + dq * s + (dp !== 0 ? o : 0);
          let k = o < 0 ? 3 : o > 0 ? 1 : 2;
          if (half === 0) k = 3;
          if (s === len - 1) k = 4;
          if (s === 0 && o !== 0) k = Math.max(0, k - 1);
          put(a, b, k);
        }
      }
    };
    // Diagonaler Kristall: Blöcke entlang der Diagonale (du, dv ∈ {±1}), nach außen verjüngt
    const dshard = (ctx, p, q, dp, dq, len, w, useTrim) => {
      const put = useTrim ? ctx.t : ctx.k;
      for (let s = 0; s < len; s++) {
        const sz = Math.max(1, Math.round(w * (1 - s / len)));
        for (let a = 0; a < sz; a++) for (let b = 0; b < sz; b++) {
          const k = s === len - 1 ? 4 : (a + b === 0 ? 3 : (a === sz - 1 && b === sz - 1 ? 1 : 2));
          put(p + dp * s + a, q + dq * s + b, k);
        }
      }
    };
    // Blatt entlang (dp, dq): Länge len, größte Breite w; Mittelrippe hell
    const leaf = (ctx, p, q, dp, dq, len, w) => {
      w = w || 3;
      for (let s = 0; s < len; s++) {
        const half = Math.round((w / 2) * Math.sin(Math.PI * (s + 0.6) / (len + 0.2)));
        for (let o = -half; o <= half; o++) {
          const a = p + dp * s + (dq !== 0 ? o : 0), b = q + dq * s + (dp !== 0 ? o : 0);
          ctx.k(a, b, o === 0 ? 4 : (o < 0 ? 3 : 2));
        }
      }
    };
    // Schmuckborte aus Bögen entlang einer Kante: s von s0 bis s1, Bögen der Breite per, Höhe h über der Linie q0
    const scallop = (ctx, s0, s1, q0, per, h, useTrim, hiK) => {
      const put = useTrim ? ctx.t : ctx.k;
      for (let s = s0; s < s1; s++) {
        const ph = ((s - s0) % per) / (per - 1), hh = Math.round(Math.sin(ph * Math.PI) * h);
        for (let o = 0; o <= hh; o++) put(s, q0 + o, o === hh ? (hiK == null ? 4 : hiK) : 2);
      }
    };

    // ── Band: Ring um das Bild mit Bevel, Gehrung (Avatar: abgeschrägt) und Textur ──────────────────
    const rows = R.rows;                                         // außen → innen
    const rowK = (d, lit) => {                                    // d: 1 = am Bild … B = außen
      const r = rows[B - d];
      if (typeof r === 'string') return { trim: true, k: parseInt(r.slice(1), 10) - (lit ? 0 : 1) };
      return { trim: false, k: r === 0 ? 0 : r - (lit ? 0 : 1) };
    };
    const tex = BAND_TEX[R.id];
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const dx = Math.max(M - x, x - (M + iw - 1), 0), dy = Math.max(M - y, y - (M + ih - 1), 0);
      if (dx === 0 && dy === 0) continue;
      let d = Math.max(dx, dy);
      if (kind === 'avatar' && dx > 0 && dy > 0) d = Math.max(d, Math.round((dx + dy) * 0.74));
      if (d > B) continue;
      const horiz = dy >= dx, lit = horiz ? y < M : x < M;
      const e = rowK(d, lit);
      let tpos = -1;
      if (dx === 0 || dy === 0) { const t0 = horiz ? x - M : y - M, len = horiz ? iw : ih; tpos = Math.min(t0, len - 1 - t0); }
      let kk = e.k, tr = e.trim;
      if (tex && tpos >= 0) { const o = tex(d, tpos, lit, tr, kk); if (o) { kk = o.k; tr = o.trim == null ? tr : o.trim; } }
      (tr ? setT : setK)(x, y, kk);
    }

    // ── Bildkante: gedithertes Dunkel, damit der Rahmen „sitzt“ ────────────────────────────────────
    for (let y = M; y < M + ih; y++) for (let x = M; x < M + iw; x++) {
      const e = Math.min(x - M, M + iw - 1 - x, y - M, M + ih - 1 - y);
      if (e > 1) continue;
      if (e === 0 || ((x + y) & 1) === 0) setC(x, y, ramp[0]);
    }

    // ── Zierrat des Ranges ────────────────────────────────────────────────────────────────────────
    const A = { forCorners, forSides, halfSpan, edgesOf, gem, plate, shard, dshard, leaf, scallop, setK, setT, setG, setC, kind, iw, ih, B, W, H: Hh, M, glints, glows, sparks, motes, ramp, trimC, gemC, glowC, R, cx0, cy0, sideCtx, cornerCtx, hasTrim: !!R.trim };
    if (RANK_ART[R.id]) RANK_ART[R.id](A);

    // ── Bewegung ──────────────────────────────────────────────────────────────────────────────────
    const metal = [];
    for (let i = 0; i < base.length; i++) if (rcls[i]) metal.push(i);
    const buf = new Uint32Array(W * Hh);
    const ST = { W, H: Hh, M, iw, ih, R, ramp, trimC, gemC, glowC, glows, sparks, motes, glints, aura: A.aura, base, buf, rkey, rcls, metal, put: (x, y, c) => putBuf(buf, W, Hh, x, y, c) };
    const sweepPeriod = 3.4 + (7 - rankIdx) * 0.3, sweepW = 3 + rankIdx * 0.4;
    return {
      w: W, h: Hh, M, rank: R,
      /** Zeichnet das Bild zur Zeit t (Sekunden) in ctx (Leinwand W × H). still = ohne Bewegung. */
      draw(ctx, t, still) {
        buf.set(base);
        if (!still) {
          const pos = -24 + ((t / sweepPeriod) % 1) * (W + Hh + 48);                  // Lichtstreifen: helle Diagonale
          for (const i of metal) {
            const x = i % W, y = (i / W) | 0, dd = Math.abs((x + y * 0.8) - pos);
            if (dd < sweepW) buf[i] = (rcls[i] === 2 ? trimC : ramp)[Math.min(4, rkey[i] + (dd < sweepW * 0.4 ? 2 : 1))];
          }
          for (let gi = 0; gi < glints.length; gi++) {                                   // Funkeln: Kreuz, zeitversetzt
            const g = glints[gi], ph = (t * 0.55 + gi * 0.37) % 1;
            if (ph < 0.16) { const len = ph < 0.08 ? 2 : 3; for (let s = -len; s <= len; s++) { if (s) { ST.put(g.x + s, g.y, gemC[3]); ST.put(g.x, g.y + s, gemC[3]); } } ST.put(g.x, g.y, gemC[3]); }
          }
          if (RANK_ANIM[R.id]) RANK_ANIM[R.id](ST, t);
        }
        const img = ctx.createImageData(W, Hh);
        new Uint32Array(img.data.buffer).set(buf);
        ctx.putImageData(img, 0, 0);
      },
    };
  }

  // ═══ Texturen des Bandes (Stufe an Position tpos entlang der Kante, symmetrisch) ═══════════════════
  // Rückgabe { k, trim? } ersetzt das Pixel, null lässt das Profil stehen.
  const BAND_TEX = {};
  BAND_TEX.gold = (d, t, lit, trim, k) => ((d === 2 || d === 3) ? { k: clamp(k + ((((t + d) >> 1) & 1) ? 1 : 0), 0, 4) } : null);        // gedrehtes Seil
BAND_TEX.platinum = (d, t, lit, trim, k) => (d === 3 ? { k: (t % 8 < 2 ? 4 : 1) } : (d === 2 && t % 8 === 0 ? { k: 4 } : null));      // Gravurlinie mit Nieten
  BAND_TEX.diamond = (d, t, lit, trim, k) => (d >= 2 && d <= 4 ? { k: clamp(k + (((t + d) & 3) < 2 ? 1 : -1), 1, 4) } : null);   // Facetten
  BAND_TEX.ruby = (d, t, lit, trim, k) => (!trim && t % 8 === 4 ? { k: 4 } : null);
  BAND_TEX.sapphire = (d, t, lit, trim, k) => (!trim && (d === 3 || d === 4) ? { k: clamp(k + (((t + d * 2) % 8) < 3 ? 1 : 0), 1, 4) } : null);   // Seil-Schraffur
  BAND_TEX.emerald = (d, t, lit, trim, k) => (d === 3 ? { k: 4 - ((t % 12) < 2 ? 0 : 1) } : null);
  BAND_TEX.obsidian = (d, t, lit, trim, k) => (d === 4 && (t % 9) < 5 ? { k: 4, trim: false } : null);

  // ═══ Zierrat je Rang ════════════════════════════════════════════════════════════════════════════
  const RANK_ART = {};
  const RANK_ANIM = {};

  // Hilfen für die Rezepte
  const spark = (A, x, y, period, phase, size) => A.sparks.push({ x, y, period, phase, size: size || 2 });

  // 1 SILBER — schlichte Eckplatten mit Niete
  RANK_ART.silver = (A) => {
    A.forCorners((c) => {
      A.plate(c, -1, -1, 6, 6, 2);
      c.k(2, 2, 4); c.k(3, 2, 3); c.k(2, 3, 3); c.k(3, 3, 1);
    });
  };

  // 2 GOLD — größere Platten mit Rubin-Intarsie, Zierdorne, Perlenreihe, kleiner Schmuckknauf in den Seitenmitten
  RANK_ART.gold = (A) => {
    A.forCorners((c) => {
      A.plate(c, -1, -1, 9, 9, 3);
      A.gem(c, 4, 4, 2, { claws: true, dark: true });
      A.shard(c, 10, 2, 1, 0, 5, 4); A.shard(c, 2, 10, 0, 1, 5, 4); A.shard(c, 10, 7, 1, 0, 3, 2); A.shard(c, 7, 10, 0, 1, 3, 2);
      for (const e of A.edgesOf(c)) for (let s = 13; s < e.span - 2; s += 5) { e.k(s, A.B + 2, 4); e.k(s, A.B + 1, 2); }
    });
    A.forSides((c) => {
      A.gem(c, 0, A.B + 2, 2, { claws: true, dark: true });
      A.shard(c, 4, A.B + 1, 1, 0, 6, 3); A.shard(c, -4, A.B + 1, -1, 0, 6, 3);
    });
  };

  // 3 PLATIN — kühle Platten mit Veilchen-Gem, Schnörkel (Voluten) entlang der Kanten, Perlkette mit Rautenknoten, Gem-Krone in den Seitenmitten
  RANK_ART.platinum = (A) => {
    // Volute: kleine Spirale (Position, Höhe über der Kante), s nach innen
    const CURL = [[0, 0], [1, 0], [2, 0], [3, 1], [4, 2], [4, 3], [3, 4], [2, 4], [1, 3], [2, 2]];
    A.forCorners((c) => {
      A.plate(c, -1, -1, 10, 10, 4);
      A.gem(c, 5, 5, 3, { claws: false });
      A.shard(c, 11, 2, 1, 0, 6, 4); A.shard(c, 2, 11, 0, 1, 6, 4); A.dshard(c, 11, 11, 1, 1, 4, 3);
      for (const e of A.edgesOf(c)) {
        for (const [ds, q] of CURL) { e.k(12 + ds, A.B + 1 + q, ds + q < 4 ? 3 : 4); }                                         // Volute am Plattenende
        for (let s = 18; s < e.span - 1; s++) {
          e.k(s, A.B + 2, 3);                                                                                                   // Kette
          if ((s - 18) % 8 === 4) {                                                                                             // Rautenknoten mit Veilchen-Kern
            e.k(s, A.B + 4, 4); e.k(s - 1, A.B + 3, 4); e.k(s + 1, A.B + 3, 4); e.k(s - 2, A.B + 2, 3); e.k(s + 2, A.B + 2, 3);
            e.k(s - 1, A.B + 1, 4); e.k(s + 1, A.B + 1, 4); e.k(s, A.B, 4); e.g(s, A.B + 2, 1); e.k(s, A.B + 3, 3);
          }
        }
      }
    });
    A.forSides((c) => {
      A.gem(c, 0, A.B + 3, 3);
      A.shard(c, 5, A.B + 2, 1, 0, 8, 3); A.shard(c, -5, A.B + 2, -1, 0, 8, 3);
      A.shard(c, 0, A.B + 7, 0, 1, 5, 3); A.dshard(c, 6, A.B + 5, 1, 1, 4, 3); A.dshard(c, -9, A.B + 5, -1, 1, 4, 3);
      for (const o of [-8, 8]) { c.k(o, 3, 4); c.k(o, 2, 3); c.k(o, 4, 3); }
    });
  };

  // 4 DIAMANT — Kristallbüschel in den Ecken, Eisfacetten im Band, Kristallkamm in den Seitenmitten, funkelnde Sterne
  RANK_ART.diamond = (A) => {
    A.forCorners((c) => {
      A.plate(c, -1, -1, 10, 10, 4);
      A.gem(c, 5, 5, 3, { claws: false });
      A.shard(c, 11, 2, 1, 0, 10, 4); A.shard(c, 2, 11, 0, 1, 10, 4); A.dshard(c, 11, 11, 1, 1, 8, 4);
      A.shard(c, 11, 8, 1, 0, 5, 2); A.shard(c, 8, 11, 0, 1, 5, 2);
      for (const e of A.edgesOf(c)) for (let s = 14; s < e.span - 1; s += 8) A.shard(e, s, A.B + 1, 0, 1, 4 + ((s / 8) & 1) * 3, 3);   // Eiszapfen-Reihe
    });
    A.forSides((c) => {
      A.shard(c, 0, A.B + 1, 0, 1, 11, 5); A.shard(c, -6, A.B + 1, 0, 1, 7, 3); A.shard(c, 6, A.B + 1, 0, 1, 7, 3);
      A.gem(c, 0, 3, 2, { noGlint: false });
    });
    for (const [x, y, ph] of [[M + 6, M - 4, 0], [M + A.iw - 7, M - 6, .3], [M - 5, M + A.ih - 8, .6], [M + A.iw + 6, M + A.ih - 5, .15], [M + (A.iw >> 1) + 8, M + A.ih + 6, .45], [M - 7, M + (A.ih >> 1), .75]]) spark(A, x, y, 1.9, ph, 3);
  };
  RANK_ANIM.diamond = (S, t) => sparkle(S, t, S.gemC[3], S.ramp[3]);

  // 5 RUBIN — Gold-Klauen halten große Rubine, Flammenzungen, Goldschmuck, atmende Edelsteine
  RANK_ART.ruby = (A) => {
    A.forCorners((c) => {
      A.plate(c, -1, -1, 12, 12, 4, true);
      A.gem(c, 6, 6, 3, { claws: true, dark: true });
      A.gem(c, 10, 2, 1, { noGlint: true }); A.gem(c, 2, 10, 1, { noGlint: true });
      A.shard(c, 13, 3, 1, 0, 9, 4, true); A.shard(c, 3, 13, 0, 1, 9, 4, true); A.dshard(c, 13, 13, 1, 1, 8, 4, true);
      A.shard(c, 13, 9, 1, 0, 5, 2, true); A.shard(c, 9, 13, 0, 1, 5, 2, true);
      for (const e of A.edgesOf(c)) { A.scallop(e, 14, e.span - 1, A.B + 1, 6, 2, true, 3); for (let s = 18; s < e.span - 2; s += 12) A.gem(e, s, A.B + 4, 1, { noGlint: true }); }
    });
    A.forSides((c) => {
      A.gem(c, 0, A.B + 4, 3, { claws: true, dark: true });
      A.shard(c, 6, A.B + 3, 1, 0, 9, 3, true); A.shard(c, -6, A.B + 3, -1, 0, 9, 3, true);
      A.shard(c, 7, A.B + 6, 1, 0, 6, 2, true); A.shard(c, -7, A.B + 6, -1, 0, 6, 2, true);
      A.gem(c, 0, 2, 1, { noGlint: true });
    });
  };
  RANK_ANIM.ruby = (S, t) => { gemBreath(S, t); };

  // 6 SAPHIR — Federflügel (Gold-gespitzt) über Gold-gerahmten Saphiren, Wellenband, Perlen
  RANK_ART.sapphire = (A) => {
    const wing = (c, vertical) => {
      for (let i = 0; i < 4; i++) {
        const len = 13 - i * 2.5 | 0;
        if (!vertical) { A.shard(c, 15, 1 + i * 3, 1, 0, len, 3); c.t(15 + len, 1 + i * 3, 4); }
        else { A.shard(c, 1 + i * 3, 15, 0, 1, len, 3); c.t(1 + i * 3, 15 + len, 4); }
      }
    };
    A.forCorners((c) => {
      A.plate(c, -1, -1, 13, 13, 5, false, true);
      A.gem(c, 7, 7, 4, { claws: true });
      for (const [p, q] of [[2, 12], [12, 2], [12, 12]]) { c.t(p, q, 4); c.t(p + 1, q, 3); c.t(p, q + 1, 3); }
      wing(c, false); wing(c, true);
      for (const e of A.edgesOf(c)) for (let s = 18; s < e.span - 2; s += 8) { e.t(s, A.B + 2, 4); e.t(s + 1, A.B + 2, 3); e.t(s, A.B + 3, 3); e.t(s - 1, A.B + 2, 3); e.t(s, A.B + 1, 3); }
    });
    A.forSides((c) => {
      A.gem(c, 0, A.B + 3, 4, { claws: true });
      for (let i = 0; i < 4; i++) { const len = 12 - i * 2; A.shard(c, 7, A.B + 1 + i * 2, 1, 0, len, 3); A.shard(c, -7, A.B + 1 + i * 2, -1, 0, len, 3); c.t(7 + len, A.B + 1 + i * 2, 4); c.t(-7 - len, A.B + 1 + i * 2, 4); }
    });
  };
  RANK_ANIM.sapphire = (S, t) => { waveShimmer(S, t); gemBreath(S, t); };

  // 7 SMARAGD — Ranken und Blätter in Gold gefasst, Smaragde, glimmende Runen im Band, schwebende Blätter
  RANK_ART.emerald = (A) => {
    A.forCorners((c) => {
      A.plate(c, -1, -1, 14, 14, 5, false, true);
      A.gem(c, 7, 7, 4, { claws: true });
      A.leaf(c, 15, 4, 1, 0, 10, 5); A.leaf(c, 4, 15, 0, 1, 10, 5);
      A.leaf(c, 15, 10, 1, 0, 6, 3); A.leaf(c, 10, 15, 0, 1, 6, 3);
      A.dshard(c, 15, 15, 1, 1, 7, 4, true);
      for (const [p, q] of [[3, 14], [14, 3]]) { c.t(p, q, 4); c.t(p + 1, q, 3); c.t(p, q + 1, 3); }
      for (const e of A.edgesOf(c)) for (let s = 17, n = 0; s < e.span - 2; s += 6, n++) {
        A.leaf(e, s, A.B + 1, 0, 1, 5, 3);                                  // Blätter außen
        if (n % 2) { e.t(s + 3, A.B + 2, 4); e.t(s + 3, A.B + 3, 3); }
      }
    });
    A.forSides((c) => {
      A.gem(c, 0, A.B + 3, 4, { claws: true });
      A.leaf(c, 6, A.B + 2, 1, 0, 9, 5); A.leaf(c, -6, A.B + 2, -1, 0, 9, 5);
      A.leaf(c, 4, A.B + 5, 1, 1 - 1, 7, 3);
      A.leaf(c, 0, A.B + 8, 0, 1, 6, 4);
      for (const o of [-3, 3]) { c.t(o, A.B + 6, 4); c.t(o, A.B + 7, 3); }
    });
    for (const [x, y, ph] of [[M + 8, M - 7, 0], [M + A.iw - 8, M + A.ih + 7, .5], [M - 7, M + (A.ih >> 1) + 5, .25], [M + A.iw + 7, M + (A.ih >> 1) - 5, .75]]) spark(A, x, y, 2.3, ph, 3);
  };
  RANK_ANIM.emerald = (S, t) => { runeGlow(S, t); drift(S, t, S.gemC[2], S.gemC[1], 6); sparkle(S, t, S.gemC[3], S.gemC[2]); gemBreath(S, t); };

  // 8 OBSIDIAN — Hörner und Dornen aus schwarzem Glas, Augen-Edelsteine, glühende Risse, Glutfunken, pulsierender Schein
  RANK_ART.obsidian = (A) => {
    const glow = (ctx, p, q, ph) => { ctx.c(p, q, A.glowC[1]); const [gx, gy] = ctx.tr(p, q); A.glows.push({ x: gx, y: gy, ph }); };
    A.forCorners((c) => {
      A.plate(c, -1, -1, 15, 15, 6);
      A.gem(c, 8, 8, 4, { eye: true });
      A.shard(c, 16, 2, 1, 0, 8, 7); A.shard(c, 2, 16, 0, 1, 8, 7); A.dshard(c, 16, 16, 1, 1, 8, 7);
      A.shard(c, 16, 10, 1, 0, 7, 4); A.shard(c, 10, 16, 0, 1, 7, 4);
      // glühende Risse: von der Augen-Platte in die Ecke und über die Platte
      for (const pts of [[[12, 12], [13, 12], [13, 13], [14, 13], [14, 14]], [[4, 1], [5, 2], [6, 2], [7, 3]], [[1, 4], [2, 5], [2, 6], [3, 7]], [[13, 5], [12, 6], [12, 7], [13, 8]], [[5, 13], [6, 12], [7, 12], [8, 13]]]) pts.forEach(([p, q], i) => glow(c, p, q, p * 5 + q * 3 + i));
      for (const e of A.edgesOf(c)) {
        for (let s = 17, n = 0; s < e.span - 1; s += 6, n++) A.shard(e, s, A.B + 1, 0, 1, 4 + (n % 2) * 3, 3);                     // Dornenreihe
        for (let s = 17; s < e.span - 2; s++) if ((s * 7) % 13 < 9) glow(e, s, A.B - 3 + [0, 0, 1, 1, 0, -1, -1, 0][s & 7], s);        // Riss im Band
      }
    });
    A.forSides((c) => {
      A.gem(c, 0, A.B + 5, 4, { eye: true });
      A.shard(c, 6, A.B + 3, 1, 0, 12, 6); A.shard(c, -6, A.B + 3, -1, 0, 12, 6);
      A.dshard(c, 8, A.B + 8, 1, 1, 8, 5); A.dshard(c, -8, A.B + 8, -1, 1, 8, 5);
      A.shard(c, 3, A.B + 9, 0, 1, 8, 4); A.shard(c, -3, A.B + 9, 0, 1, 8, 4);
      for (const [p, q] of [[3, A.B + 1], [-3, A.B + 1], [6, A.B + 5], [-6, A.B + 5]]) glow(c, p, q, p + q);
    });
    // Aura: zwei Reihen gedithertes Glühen außen am Band
    A.aura = [];
    for (let y = 0; y < A.H; y++) for (let x = 0; x < A.W; x++) {
      const dx = Math.max(M - x, x - (M + A.iw - 1), 0), dy = Math.max(M - y, y - (M + A.ih - 1), 0), d = Math.max(dx, dy);
      if (d === A.B + 1 && ((x + y) & 1) === 0) A.aura.push(y * A.W + x);
      if (d === A.B + 2 && (x & 1) === 0 && (y & 1) === 0) A.aura.push(-(y * A.W + x) - 1);   // zweite Reihe (dünner), negativ kodiert
    }
  };
  RANK_ANIM.obsidian = (S, t) => { crackGlow(S, t); drift(S, t, S.glowC[2], S.glowC[1], 9); aura(S, t); eyeBlink(S, t); };

  // ── Bewegung ────────────────────────────────────────────────────────────────────────────────
  function sparkle(S, t, white, tint) {                           // Sterne (Kreuz + Diagonalpunkte), zeitversetzt
    for (const sp of S.sparks) {
      const ph = ((t / sp.period) + sp.phase) % 1;
      if (ph > 0.3) continue;
      const len = ph < 0.1 ? 1 : ph < 0.2 ? sp.size : 1;
      for (let s = 1; s <= len; s++) { S.put(sp.x + s, sp.y, tint); S.put(sp.x - s, sp.y, tint); S.put(sp.x, sp.y + s, tint); S.put(sp.x, sp.y - s, tint); }
      S.put(sp.x, sp.y, white);
      if (len >= 2) { S.put(sp.x + 1, sp.y + 1, tint); S.put(sp.x - 1, sp.y - 1, tint); S.put(sp.x + 1, sp.y - 1, tint); S.put(sp.x - 1, sp.y + 1, tint); }
    }
  }
  function gemBreath(S, t) {                                      // Edelsteine „atmen“: heller Kern wechselt langsam
    const k = Math.sin(t * 2.2) > 0.2 ? 2 : 1;
    S.glints.forEach((g) => { if (g.r >= 2) S.put(g.x, g.y, S.gemC[k]); });
  }
  function waveShimmer(S, t) {                                    // Welle läuft über das Band (nur Material, nicht Gold)
    for (const i of S.metal) {
      if (S.rcls[i] !== 1) continue;
      const x = i % S.W, y = (i / S.W) | 0;
      if (Math.sin((x + y) * 0.45 - t * 4.2) > 0.9) S.buf[i] = S.ramp[Math.min(4, S.rkey[i] + 1)];
    }
  }
  function runeGlow(S, t) {                                       // Runen im Band pulsieren
    for (const g of S.glows) { const k = Math.sin(t * 2 + g.ph) > 0 ? 3 : 2; S.put(g.x, g.y, S.gemC[k]); }
  }
  function crackGlow(S, t) {                                      // Glühleiter der Risse (dunkelrot → magenta → orange → gelb)
    for (const g of S.glows) { const v = (Math.sin(t * 3 + g.ph * 0.7) + 1) * 0.5; S.put(g.x, g.y, S.glowC[Math.min(3, Math.floor(v * 4))]); }
  }
  function drift(S, t, c1, c2, n) {                               // schwebende Funken/Blätter im Außenrand
    for (let i = 0; i < n; i++) {
      const seed = i * 97 + 13, per = 3.2 + (i % 4) * 0.6, ph = ((t / per) + (seed % 100) / 100) % 1;
      const side = i % 4, W = S.W, H = S.H;
      let x, y;
      if (side === 0) { x = S.M - 3 - ((seed >> 2) % 6) + Math.sin(ph * 9 + i) * 1.5; y = S.M + (S.ih) * (1 - ph); }
      else if (side === 1) { x = S.M + S.iw + 3 + ((seed >> 3) % 6) + Math.sin(ph * 9 + i) * 1.5; y = S.M + S.ih * (1 - ph); }
      else if (side === 2) { x = S.M + ((seed >> 2) % S.iw) + Math.sin(ph * 7) * 1.5; y = S.M - 4 - ph * 9; }
      else { x = S.M + ((seed >> 3) % S.iw) + Math.sin(ph * 7) * 1.5; y = S.M + S.ih + 4 + ph * 9; }
      S.put(x, y, ph < 0.6 ? c1 : c2); if (ph < 0.3) S.put(x, y - 1, c2);
    }
  }
  function aura(S, t) {                                           // pulsierender Schein: zwei Dither-Reihen, Farbe wechselt sanft
    if (!S.aura) return;
    const v = (Math.sin(t * 2.4) + 1) * 0.5;
    for (const e of S.aura) {
      const i = e >= 0 ? e : -e - 1;
      if (S.base[i] !== 0) continue;
      S.buf[i] = e >= 0 ? S.glowC[v > 0.55 ? 1 : 0] : S.glowC[v > 0.55 ? 0 : 0];
    }
  }
  function eyeBlink(S, t) {                                       // die Augen schließen sich kurz (Schlitz wird zum Strich)
    const ph = (t * 0.4) % 1;
    if (ph > 0.06) return;
    S.glints.forEach((g) => { if (g.r >= 4) for (let dv = -2; dv <= 2; dv++) for (let du = -3; du <= 3; du++) if (Math.abs(dv) >= 1) S.put(g.x + du, g.y + dv, S.ramp[1]); });
  }

  root.ppRankFrames = { RANKS, M, create };
})(typeof window !== 'undefined' ? window : globalThis);
