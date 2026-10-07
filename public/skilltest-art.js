'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — PIXEL-ART (programmatisch gemalt, kein Bild-Asset)
//
//  Alles ist echtes Pixelwerk: kleine Leinwände, Pixel für Pixel mit
//  festen Paletten gesetzt, Verläufe nur über geordnetes Dithering
//  (Bayer 4×4), nie über weiche Farbübergänge. Die Leinwände werden von
//  CSS hart hochskaliert (image-rendering: pixelated).
//
//    recycler(lid)      Recycling-Container, Deckel 0 (zu) … 4 (weit offen) — der Deckel ist sein Mund
//    coin()             Goldmünze
//    torchFlame()       Fackelflamme, Spritesheet mit 6 Frames
//    torchHolder()      Wandhalterung der Fackel
//    torchGlow()        gedithertes Fackellicht
//    paintBoard(...)    Heimbasis: Dielen, Steinrahmen, Fackellicht
//    paintWall(...)     Kerkerwand hinter dem Ganzen
// ═══════════════════════════════════════════════════════════════════
(function (root) {
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  /** Wird das Pixel bei Deckung t (0…1) gesetzt? Geordnetes Dithering. */
  const dith = (x, y, t) => t > 0 && (BAYER[y & 3][x & 3] + 0.5) / 16 < t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function rngOf(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  function surface(w, h, existing) {
    const c = existing || document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return {
      c, g, w, h,
      px(x, y, col) { if (x < 0 || y < 0 || x >= w || y >= h) return; g.fillStyle = col; g.fillRect(x | 0, y | 0, 1, 1); },
      rect(x, y, rw, rh, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, rw | 0, rh | 0); },
      url() { return c.toDataURL('image/png'); },
    };
  }
  const cache = {};
  const cached = (key, make) => (cache[key] || (cache[key] = make()));

  // ── Recycling-Container ────────────────────────────────────────────
  const GREEN = ['#08261a', '#0f3a22', '#1b6b3b', '#27934f', '#37b865', '#6ae08e'];   // 0 = Kontur … 5 = Licht
  /** Kontinuierlicher Wert 1…5 → Palettenstufe mit Dithering zwischen den Stufen. */
  function ramp(v, x, y) {
    let b = Math.floor(v);
    if (dith(x, y, v - b)) b++;
    return GREEN[clamp(b, 1, 5)];
  }
  const LID_ANGLES = [0, 35, 70, 100, 125];

  function paintRecycler(lid) {
    const W = 64, H = 80;
    const s = surface(W, H);
    const { px, rect } = s;
    const OUT = GREEN[0], HY = 26, RY = 33, BY1 = 69;
    const R = rngOf(1234);

    // Bodenschatten (gedithert)
    for (let y = 73; y < 79; y++) for (let x = 4; x < 60; x++) {
      const dx = (x - 32) / 28, dy = (y - 76) / 3.2, d = dx * dx + dy * dy;
      if (d < 1 && dith(x, y, 0.55 * (1 - d))) px(x, y, 'rgba(0,0,0,.55)');
    }

    // Korpus: nach unten leicht verjüngt, links Licht → rechts Schatten, alles gedithert
    for (let y = RY + 3; y <= BY1; y++) {
      const inset = Math.floor((y - RY) / 12);
      const x0 = 8 + inset, x1 = 55 - inset, span = x1 - x0;
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / span;
        let v = 4.7 - 3.1 * t - 0.7 * ((y - RY) / (BY1 - RY));
        // senkrechte Rippen: Rille + Lichtkante
        for (const rx of [18, 27, 36, 45]) { if (x === rx) v -= 1.3; else if (x === rx + 1) v += 0.9; }
        px(x, y, ramp(v, x, y));
      }
      px(x0, y, OUT); px(x1, y, OUT);
    }
    rect(10, BY1, 44, 1, OUT);
    // Schmutz/Rost: dunkle Flecken, vor allem unten
    for (let i = 0; i < 26; i++) {
      const y = 50 + Math.floor(R() * 19), x = 12 + Math.floor(R() * 40);
      if (dith(x, y, 0.7)) px(x, y, GREEN[1]);
      if (R() < 0.4) px(x + 1, y, GREEN[2]);
    }
    // Dellen (Lichtkante oben links, Schatten unten rechts)
    for (const [dx, dy] of [[14, 38], [48, 56], [22, 63]]) { px(dx, dy, GREEN[5]); px(dx + 1, dy, GREEN[4]); px(dx + 1, dy + 1, GREEN[1]); px(dx + 2, dy + 1, GREEN[1]); }
    // Seitengriffe
    for (const [hx, flip] of [[5, 1], [56, -1]]) {
      rect(hx, 46, 3, 8, OUT); rect(hx + (flip > 0 ? 1 : 0), 47, 2, 6, '#7d8a99');
      px(hx + (flip > 0 ? 1 : 0), 47, '#c5d0dc'); px(hx + (flip > 0 ? 2 : 1), 52, '#4d5864');
    }

    // Frontplatte mit Recycling-Zeichen (Bevel + Dither-Schatten)
    const px0 = 16, py0 = 40, pw = 32, ph = 22;
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const t = (x + y) / (pw + ph);
      const c = t < 0.35 ? '#f2fbf5' : (t < 0.62 ? '#dff0e6' : '#bcd8c8');
      px(px0 + x, py0 + y, dith(px0 + x, py0 + y, (t % 0.27) / 0.27 * 0.5) && t > 0.3 ? '#cfe6d8' : c);
    }
    rect(px0 - 1, py0 - 1, pw + 2, 1, OUT); rect(px0 - 1, py0 + ph, pw + 2, 1, OUT);
    rect(px0 - 1, py0, 1, ph, OUT); rect(px0 + pw, py0, 1, ph, OUT);
    rect(px0, py0, pw, 1, '#ffffff'); rect(px0, py0, 1, ph, '#ffffff');
    rect(px0, py0 + ph - 1, pw, 1, '#8fb3a0'); rect(px0 + pw - 1, py0, 1, ph, '#8fb3a0');
    for (const [nx, ny] of [[px0 + 2, py0 + 2], [px0 + pw - 3, py0 + 2], [px0 + 2, py0 + ph - 3], [px0 + pw - 3, py0 + ph - 3]]) { px(nx, ny, '#6b8576'); }
    const cx = 32, cy = 51;
    for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) {
      const d = Math.sqrt(x * x + y * y), a = Math.atan2(y, x);
      if (d > 4.3 && d < 6.9 && Math.abs(a + 2.2) > 0.42 && Math.abs(a - 0.94) > 0.42) px(cx + x, cy + y, d < 5.4 ? '#1f9f52' : '#18823f');
    }
    for (const [ax, ay, pts] of [[26, 44, [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [0, 3]]],
      [37, 56, [[3, 0], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [0, 3], [1, 3], [2, 3], [3, 3]]]]) {
      pts.forEach(([dx, dy]) => px(ax + dx, ay + dy, '#127a3a'));
    }

    // Räder
    for (const wx of [12, 46]) {
      rect(wx, 70, 6, 5, '#14181d'); rect(wx + 1, 71, 4, 3, '#2d343c');
      px(wx + 1, 71, '#8a97a6'); px(wx + 2, 72, '#5b6672'); px(wx + 4, 73, '#0b0e11');
      rect(wx + 1, 69, 4, 1, '#3a434d');
    }

    // ── Der Mund: Oberkiefer = Deckel, Unterkiefer = Rand des Korpus ──
    const a = LID_ANGLES[lid] * Math.PI / 180;
    const L = 16.5, el = 25 * Math.PI / 180;
    const yf = Math.round(HY + L * (Math.cos(a) * Math.sin(el) - Math.sin(a) * Math.cos(el)));   // Vorderkante des Deckels
    const x0f = Math.round(6 + 2.5 * (1 - Math.cos(a))), x1f = 57 - Math.round(2.5 * (1 - Math.cos(a)));

    // Innenraum (sichtbar, sobald der Deckel auf ist)
    if (lid > 0) {
      for (let y = HY; y < RY; y++) for (let x = 10; x <= 53; x++) {
        px(x, y, dith(x, y, 0.35 + 0.1 * (y - HY)) ? '#0b2417' : '#040e08');
      }
      // glühende Augen im Dunkel
      if (lid >= 2) for (const ex of [21, 38]) { rect(ex, 28, 4, 2, '#ffe14a'); rect(ex, 30, 4, 1, '#ff9a1f'); px(ex + 1, 28, '#fffbe0'); }
    }
    // Rand des Korpus (Unterkiefer)
    rect(6, RY, 52, 1, GREEN[5]); rect(6, RY + 1, 52, 1, GREEN[4]); rect(6, RY + 2, 52, 1, GREEN[2]); rect(5, RY, 1, 3, OUT); rect(58, RY, 1, 3, OUT); rect(6, RY + 3, 52, 1, OUT);
    for (let x = 6; x < 58; x++) if (dith(x, RY + 1, 0.45)) px(x, RY + 1, GREEN[3]);
    // Zähne unten (zeigen nach oben)
    if (lid > 0) for (let x = 14; x <= 48; x += 6) { rect(x, RY - 1, 3, 1, '#eaf7ef'); px(x + 1, RY - 2, '#eaf7ef'); px(x + 2, RY - 1, '#9fc4ad'); }

    if (lid === 0) {
      // Deckel geschlossen: Oberseite, vorn die Kante mit Griff
      for (let y = HY - 6; y < RY; y++) {
        const t = (y - (HY - 6)) / (RY - 1 - (HY - 6));
        const xa = Math.round(lerp(11, 6, t)), xb = Math.round(lerp(52, 57, t));
        for (let x = xa; x <= xb; x++) px(x, y, ramp(2.6 + 2.2 * (1 - t) - 1.4 * ((x - xa) / (xb - xa)), x, y));
        px(xa, y, OUT); px(xb, y, OUT);
      }
      rect(11, HY - 7, 42, 1, OUT);
      rect(7, RY - 3, 50, 1, GREEN[5]); rect(6, RY - 2, 52, 2, GREEN[2]); rect(6, RY - 1, 52, 1, GREEN[1]);
      rect(24, RY - 4, 16, 3, '#9aa7b6'); rect(24, RY - 2, 16, 1, '#5b6672'); px(24, RY - 4, '#d4dde6'); rect(23, RY - 4, 1, 3, OUT); rect(40, RY - 4, 1, 3, OUT);
      // Nähte/Verstärkung
      for (const rx of [20, 31, 42]) for (let y = HY - 4; y < RY - 3; y++) px(rx, y, GREEN[2]);
    } else {
      // Deckel offen: Unterseite (dunkel, gerippt) zwischen Scharnier und Vorderkante
      const top = Math.min(yf, HY), bot = Math.max(yf, HY);
      for (let y = top; y <= bot; y++) {
        const t = bot === top ? 0 : (HY - y) / (HY - yf || 1);
        const xa = Math.round(lerp(11, x0f, clamp(t, 0, 1))), xb = Math.round(lerp(52, x1f, clamp(t, 0, 1)));
        for (let x = xa; x <= xb; x++) {
          let v = 1.7 + 1.0 * (1 - clamp(t, 0, 1)) + 0.5 * ((x - xa) / (xb - xa));
          if ((x - 12) % 9 === 0) v += 0.9;
          px(x, y, ramp(v, x, y));
        }
        px(xa, y, OUT); px(xb, y, OUT);
      }
      rect(x0f, yf - 1, x1f - x0f + 1, 1, OUT);
      // Lippe (Dicke des Deckels) an der Vorderkante
      rect(x0f + 1, yf, x1f - x0f - 1, 1, GREEN[5]); rect(x0f + 1, yf + 1, x1f - x0f - 1, 1, GREEN[3]);
      // Scharnier
      rect(10, HY, 44, 1, OUT);
      for (const hx of [14, 47]) { rect(hx, HY - 1, 4, 3, '#9aa7b6'); px(hx, HY - 1, '#d4dde6'); rect(hx, HY + 1, 4, 1, '#4d5864'); }
      // Zähne oben (hängen von der Vorderkante)
      for (let x = x0f + 6; x <= x1f - 8; x += 6) { rect(x, yf + 2, 3, 1, '#eaf7ef'); px(x + 1, yf + 3, '#eaf7ef'); px(x + 2, yf + 2, '#9fc4ad'); }
    }
    return s.url();
  }

  // ── Münze ──────────────────────────────────────────────────────────
  function paintCoin() {
    const s = surface(12, 12), { px } = s;
    const P = ['#4d2f00', '#a8650a', '#e69a12', '#ffcc33', '#fff0a0'];
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const dx = x - 5.5, dy = y - 5.5, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 5.9) continue;
      if (d > 5.0) { px(x, y, P[0]); continue; }
      let v = 3.3 - 0.45 * (dx + dy) / 4;                         // Licht oben links
      if (d > 4.0 && d <= 5.0) v -= 0.9;                          // Prägerand
      let b = Math.floor(v); if (dith(x, y, v - b)) b++;
      px(x, y, P[clamp(b, 1, 4)]);
    }
    for (const [x, y] of [[5, 3], [6, 3], [5, 4], [5, 5], [5, 6], [5, 7], [6, 8], [4, 8]]) px(x, y, P[1]);   // geprägtes „I"
    px(3, 2, P[4]); px(4, 2, P[4]); px(2, 3, P[4]);
    return s.url();
  }

  // ── Fackel ─────────────────────────────────────────────────────────
  const FLAME_W = 16, FLAME_H = 26, FLAME_FRAMES = 6;
  function paintFlame() {
    const s = surface(FLAME_W * FLAME_FRAMES, FLAME_H), { px } = s;
    const R = rngOf(99);
    const sway = [0, 1.2, 1.8, 0.6, -1.2, -0.6], height = [1, 1.08, 0.94, 1.12, 0.98, 0.9];
    for (let f = 0; f < FLAME_FRAMES; f++) {
      const ox = f * FLAME_W;
      const Hf = 21 * height[f], base = FLAME_H - 1;
      for (let y = 0; y < FLAME_H; y++) {
        const h = (base - y) / Hf;                                   // 0 unten … 1 Spitze
        if (h < 0 || h > 1.02) continue;
        const bulge = h < 0.28 ? 0.72 + 0.28 * (h / 0.28) : 1 - Math.pow((h - 0.28) / 0.74, 1.35);
        const hw = 6.1 * bulge + (R() - 0.5) * 0.9;
        const cx = FLAME_W / 2 - 0.5 + sway[f] * Math.pow(h, 1.6) + (R() - 0.5) * 0.4;
        for (let x = 0; x < FLAME_W; x++) {
          const dx = Math.abs(x - cx);
          if (dx > hw) continue;
          const heat = (1 - dx / Math.max(0.5, hw)) * (1 - 0.55 * h) + (h < 0.15 ? 0.12 : 0);
          let col;
          if (heat > 0.78) col = '#fff6c0';
          else if (heat > 0.5) col = '#ffd23f';
          else if (heat > 0.28) col = '#ff8f1f';
          else if (heat > 0.12) col = '#e2531b';
          else col = dith(x + f, y, 0.5) ? '#9c2415' : null;           // zerfaserter Rand
          if (col) px(ox + x, y, col);
        }
      }
      // Funken
      for (let k = 0; k < 3; k++) {
        const x = 3 + Math.floor(R() * 10), y = Math.floor(R() * 7);
        px(ox + x, y, k % 2 ? '#ffd23f' : '#ff8f1f');
      }
    }
    return { url: s.url(), w: FLAME_W, h: FLAME_H, frames: FLAME_FRAMES };
  }

  function paintHolder() {
    const W = 14, H = 26, s = surface(W, H), { px, rect } = s;
    const OUT = '#14161a';
    // Korb
    for (let y = 0; y < 6; y++) {
      const inset = Math.floor(y / 2), x0 = 1 + inset, x1 = 12 - inset;
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / (x1 - x0);
        const v = 3.4 - 2.2 * t + (y === 0 ? 0.9 : 0);
        const P = ['#14161a', '#2f343c', '#4d5560', '#7b8594', '#a9b3c1'];
        let b = Math.floor(v); if (dith(x, y, v - b)) b++;
        px(x, y, P[clamp(b, 1, 4)]);
      }
      px(x0, y, OUT); px(x1, y, OUT);
    }
    rect(4, 6, 6, 1, OUT);
    // Holzgriff
    for (let y = 7; y < 15; y++) for (let x = 5; x <= 8; x++) {
      const P = ['#2b1a0e', '#5a3a20', '#7a4e2c', '#a06a3c'];
      px(x, y, x === 5 ? P[3] : x === 6 ? P[2] : x === 7 ? P[1] : P[0]);
      if (x >= 6 && dith(x, y, 0.3)) px(x, y, P[1]);
    }
    // Wandplatte + Arm
    rect(5, 14, 4, 3, '#3a3f47'); rect(5, 14, 4, 1, '#6b7482');
    for (let y = 16; y < 26; y++) for (let x = 2; x <= 11; x++) {
      const t = (x - 2) / 9;
      const P = ['#14161a', '#2a2e35', '#3f454e', '#5b6470'];
      const v = 3.1 - 1.8 * t;
      let b = Math.floor(v); if (dith(x, y, v - b)) b++;
      px(x, y, P[clamp(b, 1, 3)]);
      if (y === 16 || y === 25) px(x, y, OUT);
    }
    for (let y = 16; y < 26; y++) { px(2, y, OUT); px(11, y, OUT); }
    px(4, 19, '#9aa7b6'); px(4, 20, '#14161a'); px(9, 19, '#9aa7b6'); px(9, 20, '#14161a');
    px(4, 23, '#9aa7b6'); px(4, 24, '#14161a'); px(9, 23, '#9aa7b6'); px(9, 24, '#14161a');
    return { url: s.url(), w: W, h: H };
  }

  function paintGlow() {
    const N = 48, s = surface(N, N), { px } = s;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - N / 2 + 0.5, y - N / 2 + 0.5) / (N / 2);
      if (d >= 1) continue;
      const t = Math.pow(1 - d, 1.7) * 0.9;
      if (dith(x, y, t)) px(x, y, 'rgba(255,168,64,.42)');
      if (d < 0.32 && dith(x + 1, y + 2, (0.32 - d) / 0.32 * 0.9)) px(x, y, 'rgba(255,214,120,.5)');
    }
    return { url: s.url(), w: N, h: N };
  }

  // ── Heimbasis: Dielen, Steinrahmen, Fackellicht ─────────────────────
  /**
   * Malt den Hintergrund der Heimbasis in `cv` (Größe in Pixelwerk-Einheiten).
   * `torches`: [{x, y}] in denselben Einheiten — dort fällt gedithertes Licht auf die Dielen.
   */
  function paintBoard(cv, w, h, torches, seed) {
    const s = surface(w, h, cv), { g, px, rect } = s;
    const R = rngOf(seed || 7);
    const F = 5;                                                       // Rahmenstärke
    const PH = 9;                                                      // Dielenhöhe
    const TONES = ['#5b3d27', '#4f3421', '#664529', '#46301f', '#583a25'];
    const GRAIN_D = '#3a2416', GRAIN_L = '#7b5638', SEAM = '#24160d', HILITE = '#80593a', NAIL = '#b7a68e';
    const inX = (x) => x >= F && x < w - F;

    // 1) Dielen
    for (let y = F; y < h - F; y += PH) {
      const ph = Math.min(PH, h - F - y);
      rect(F, y, w - 2 * F, ph, TONES[Math.floor(R() * TONES.length)]);
      // Maserung
      const n = Math.floor((w - 2 * F) / 6);
      for (let i = 0; i < n; i++) {
        let gx = F + Math.floor(R() * (w - 2 * F));
        const gy = y + 1 + Math.floor(R() * Math.max(1, ph - 2)), len = 5 + Math.floor(R() * 17), col = R() < 0.55 ? GRAIN_D : GRAIN_L;
        let yy = gy;
        for (let k = 0; k < len; k++, gx++) { if (inX(gx)) px(gx, yy, col); if (R() < 0.1) yy = clamp(yy + (R() < 0.5 ? -1 : 1), y + 1, y + ph - 2); }
      }
      // Astlöcher
      if (R() < 0.35) {
        const kx = F + 8 + Math.floor(R() * (w - 2 * F - 16)), ky = y + Math.floor(ph / 2);
        rect(kx - 2, ky - 1, 5, 3, GRAIN_D); rect(kx - 1, ky - 2, 3, 5, GRAIN_D); rect(kx - 1, ky - 1, 3, 3, '#2a190e'); px(kx, ky, '#150b04'); px(kx - 2, ky - 1, GRAIN_L);
      }
      rect(F, y, w - 2 * F, 1, HILITE);                                // Lichtkante oben
      rect(F, y + ph - 1, w - 2 * F, 1, SEAM);                         // Fuge unten
      // Stöße mit Nägeln
      for (let jx = F + Math.floor(R() * 60); jx < w - F - 4; jx += 55 + Math.floor(R() * 50)) {
        rect(jx, y, 1, ph, SEAM); px(jx + 1, y + 1, HILITE);
        for (const nx of [jx - 3, jx + 3]) for (const ny of [y + 2, y + ph - 3]) { if (inX(nx)) { px(nx, ny, NAIL); px(nx, ny + 1, SEAM); } }
      }
    }

    // 2) Licht und Schatten, nur gedithert
    const shade = (x, y, col, t) => { if (dith(x, y, t)) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } };
    for (let y = F; y < h - F; y++) for (let x = F; x < w - F; x++) {
      const d = Math.min(x - F, w - F - 1 - x, y - F, h - F - 1 - y);
      const vig = Math.max(0, 1 - d / 18) * 0.75;                        // Randverdunklung
      shade(x, y, 'rgba(12,6,2,.5)', vig);
      if (vig > 0.45) shade(x + 1, y + 2, 'rgba(12,6,2,.45)', vig - 0.25);
      const low = (y / h - 0.5) * 0.5;                                  // unten etwas dunkler
      if (low > 0) shade(x + 2, y, 'rgba(12,6,2,.4)', low);
      for (const t of torches || []) {
        const dist = Math.hypot(x - t.x, (y - t.y) * 1.15), r = 46;
        if (dist >= r) continue;
        const lt = Math.pow(1 - dist / r, 1.5) * 0.85;
        shade(x + 2, y, 'rgba(255,170,70,.22)', lt);
        if (dist < r * 0.4) shade(x, y + 1, 'rgba(255,205,110,.2)', (1 - dist / (r * 0.4)) * 0.9);
      }
    }

    // 3) Steinrahmen aus Quadern
    const STONE = ['#4a4952', '#54535c', '#605f69', '#6c6b75', '#3f3e46'], MORTAR = '#1c1b21';
    const quader = (x, y, bw, bh) => {
      const tone = STONE[Math.floor(R() * STONE.length)];
      rect(x, y, bw, bh, tone);
      rect(x, y, bw, 1, '#8a8892'); rect(x, y, 1, bh, '#797780');          // Licht oben/links
      rect(x, y + bh - 1, bw, 1, '#2b2a31'); rect(x + bw - 1, y, 1, bh, '#2b2a31'); // Schatten unten/rechts
      for (let i = 0; i < bw * bh * 0.1; i++) px(x + 1 + Math.floor(R() * Math.max(1, bw - 2)), y + 1 + Math.floor(R() * Math.max(1, bh - 2)), R() < 0.5 ? '#35343b' : '#6f6e78');
    };
    rect(0, 0, w, F, MORTAR); rect(0, h - F, w, F, MORTAR); rect(0, 0, F, h, MORTAR); rect(w - F, 0, F, h, MORTAR);
    for (let x = 0; x < w; x += 0) { const bw = Math.min(w - x, 12 + Math.floor(R() * 8)); quader(x, 0, bw, F); quader(w - x - bw, h - F, bw, F); x += bw; }
    for (let y = F; y < h - F; y += 0) { const bh = Math.min(h - F - y, 9 + Math.floor(R() * 5)); quader(0, y, F, bh); quader(w - F, y, F, bh); y += bh; }
    // Frame-Shading (gedithert) und innere Schattenkante
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x >= F && x < w - F && y >= F && y < h - F) continue;
      const lit = Math.max(0, 1 - (x + y) / (w + h) * 2.0);              // oben links heller
      shade(x, y, 'rgba(255,255,255,.12)', lit * 0.8);
      shade(x + 1, y, 'rgba(0,0,0,.3)', (1 - lit) * 0.7);
    }
    rect(F, F - 1, w - 2 * F, 1, '#140d07'); rect(F, h - F, w - 2 * F, 1, '#140d07'); rect(F - 1, F, 1, h - 2 * F, '#140d07'); rect(w - F, F, 1, h - 2 * F, '#140d07');
    for (let i = 1; i <= 2; i++) for (let x = F; x < w - F; x++) { shade(x, F + i - 1, 'rgba(0,0,0,.5)', 0.7 - 0.3 * i); shade(x, h - F - i, 'rgba(0,0,0,.5)', 0.7 - 0.3 * i); }
    for (let i = 1; i <= 2; i++) for (let y = F; y < h - F; y++) { shade(F + i - 1, y, 'rgba(0,0,0,.5)', 0.7 - 0.3 * i); shade(w - F - i, y, 'rgba(0,0,0,.5)', 0.7 - 0.3 * i); }
    // Ecknieten
    for (const [x, y] of [[1, 1], [w - 4, 1], [1, h - 4], [w - 4, h - 4]]) { rect(x, y, 3, 3, '#2b2a31'); rect(x, y, 2, 2, '#a9a8b2'); px(x, y, '#e1e0e8'); }
    // Außenkontur
    rect(0, 0, w, 1, '#0e0c0a'); rect(0, h - 1, w, 1, '#0e0c0a'); rect(0, 0, 1, h, '#0e0c0a'); rect(w - 1, 0, 1, h, '#0e0c0a');
  }

  // ── Kerkerwand ─────────────────────────────────────────────────────
  function paintWall(cv, w, h, seed) {
    const s = surface(w, h, cv), { g, px, rect } = s;
    const R = rngOf(seed || 11);
    const BH = 7, BW = 15;
    const TONES = ['#2a221d', '#312820', '#251e19', '#2d2520', '#362c23'];
    const MORTAR = '#0e0a07', HI = '#41342a', SH = '#17110d';
    rect(0, 0, w, h, MORTAR);
    for (let row = 0, y = 0; y < h; row++, y += BH) {
      let x = -(row % 2) * Math.floor(BW / 2) - Math.floor(R() * 3);
      while (x < w) {
        const bw = BW + Math.floor(R() * 4) - 1;
        const tone = TONES[Math.floor(R() * TONES.length)];
        rect(x + 1, y + 1, bw - 1, BH - 1, tone);
        rect(x + 1, y + 1, bw - 1, 1, HI); rect(x + 1, y + 1, 1, BH - 1, HI);
        rect(x + 1, y + BH - 1, bw - 1, 1, SH); rect(x + bw - 1, y + 1, 1, BH - 1, SH);
        for (let i = 0; i < bw * BH * 0.12; i++) px(x + 2 + Math.floor(R() * Math.max(1, bw - 3)), y + 2 + Math.floor(R() * (BH - 3)), R() < 0.5 ? SH : '#3a2f26');
        if (R() < 0.07) for (let k = 0; k < 3 + Math.floor(R() * 3); k++) px(x + 2 + Math.floor(R() * (bw - 3)), y + BH - 2, '#26301c');      // Moos
        x += bw;
      }
    }
    // Risse
    for (let i = 0; i < Math.floor(w / 60); i++) {
      let x = Math.floor(R() * w), y = Math.floor(R() * h);
      for (let k = 0; k < 6 + Math.floor(R() * 8); k++) { px(x, y, MORTAR); y++; if (R() < 0.5) x += R() < 0.5 ? -1 : 1; }
    }
    // Vignette: Mitte etwas heller, Ränder dunkel (nur gedithert)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w / 2), dy = (y - h * 0.45) / (h / 2), d = Math.sqrt(dx * dx * 0.8 + dy * dy);
      const t = clamp((d - 0.3) / 0.85, 0, 1) * 0.92;
      if (dith(x, y, t)) { g.fillStyle = 'rgba(4,2,1,.62)'; g.fillRect(x, y, 1, 1); }
      if (t > 0.5 && dith(x + 1, y + 2, t - 0.35)) { g.fillStyle = 'rgba(4,2,1,.5)'; g.fillRect(x, y, 1, 1); }
    }
  }

  root.SkillTestArt = {
    LID_FRAMES: LID_ANGLES.length,
    recycler: (lid) => cached('rec' + lid, () => paintRecycler(clamp(lid | 0, 0, LID_ANGLES.length - 1))),
    coin: () => cached('coin', paintCoin),
    torchFlame: () => cached('flame', paintFlame),
    torchHolder: () => cached('holder', paintHolder),
    torchGlow: () => cached('glow', paintGlow),
    paintBoard, paintWall,
  };
})(typeof window !== 'undefined' ? window : globalThis);
