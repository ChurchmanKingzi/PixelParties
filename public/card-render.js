'use strict';
// ═══════════════════════════════════════════════════════════════════
//  KARTEN-RENDERER — erzeugt jede Karte zur Laufzeit auf einem Canvas
//
//  Statt ~1.200 fertiger 750x1050-PNGs (264 MB) laedt der Browser nur noch
//    · cardgen/sprites.png  — alle Rahmen, Icons, Masken, Stempel (25 KB)
//    · die Kunst der Karte  — als Pixel-Raster (meist 76x51) oder Vollbild
//    · cardgen/glyphs.json  — die Umrisse der Schrift Pixel Intv (14 KB)
//  und setzt die Karte nach den Regeln des Karten-Templates (MSE) selbst
//  zusammen: Rahmen, Kunst mit Maske, Namenszeile, Regeltext, Werte, Symbole,
//  Seltenheits-Stempel und — bei Super Rares — die goldenen Rahmenelemente.
//  Foils (Schimmer, Texturen, silberner Rand der Rares) gehoeren dem dynamischen
//  Foil-Effekt des Spiels und werden hier bewusst NICHT gezeichnet; die Rahmen der
//  Super Rares (Gold) und Diamonds (Cyan) bleiben.
//
//  Massstab: Rahmen und Icons sind 10x-Pixel-Art und werden mit nearest
//  neighbour auf 750x1050 gebracht; Bilder in Feldern werden gestreckt
//  (Pixelmitte-Abtastung wie MSE). Schrift: MSE rechnet Punkt -> Pixel mit
//  96 dpi (px = pt * 4/3); Zeilenhoehe = Ascent+Descent des Fonts.
//
//  Reiner Browser-Code ohne Abhaengigkeiten. Aufruf:
//      await CardRender.init({ base: '/cardgen/' });
//      const canvas = CardRender.draw(spec, art);       // 750x1050
//  `spec` baut CardRender.specFromCard(karte, meta) aus cards.json.
// ═══════════════════════════════════════════════════════════════════
(function (root) {
  const W = 750, H = 1050;
  const PT = 4 / 3;                       // MSE: Punkt -> Pixel
  const UPM = 2048, ASC = 1900, DESC = 500;   // Pixel Intv (hhea)
  const LINE_U = ASC + DESC;
  const OPT = { dy: 0, dx: 0, slack: 0, trail: false, step: 0.05, hextra: 0, forcePt: 0, bsteps: 7, silverRim: true, nl: 'space', symDx: 0, symDy: 0, symMode: 'rule' };

  // ── Schrift: Umrisse und Vorschubbreiten aus cardgen/glyphs.json ──
  // Pixel Intv besteht nur aus Rechtecken, hat kein Kerning und Breiten in Vielfachen von 200 Einheiten.
  // Die Zeichen werden als Pfade gefuellt (statt fillText), damit Lage und Kantenglaettung auf jedem
  // Geraet identisch und auf Bruchteile eines Pixels genau sind.
  let GL = Object.create(null);          // Zeichen -> { d, a, path }
  const SPACE_U = 1000;
  // '*' ist in den Karten ein Aufzaehlungszeichen: im Template ein Symbol-Zeichen ohne Bild, belegt keine Breite.
  const ZERO_WIDTH = '*';

  // ── Symbole im Kartentext ──
  // Die Symbolschrift des Templates („PixelParties-text-replacements“) ersetzt die Namen der Zauberschulen im Text
  // durch ein Bild: aus „Destruction Magic“ wird das Flammen-Symbol usw. Vor dem Satz werden die Namen durch
  // Zeichen aus dem privaten Unicode-Bereich ersetzt; sie verhalten sich im Umbruch wie ein einzelnes Zeichen.
  // Bildgroesse wie in MSE: Symbolgroesse (Textfeld: 8.5, Faehigkeitsfelder: 10.5) / `image font size` (30) Pixel
  // je Bildpixel bei Schriftgroesse 20 — sie schrumpft mit dem Text mit.
  const SYMBOLS = [
    ['Destruction Magic', 'destruction'], ['Summoning Magic', 'summoning'], ['Magic Arts', 'arts'],
    ['Support Magic', 'support'], ['Decay Magic', 'decay'], ['Fighting', 'fighting'],
    // Kurzformen („Destruction Spells“, „Decay or Support Spell“) tragen dasselbe Symbol
    ['Destruction', 'destruction'], ['Summoning', 'summoning'], ['Support', 'support'], ['Decay', 'decay'],
  ];
  const SYM_FONT = 30, SYM_SPACE = 2;            // `image font size`, `horizontal space` der Symbolschrift
  const SYM_KEY = Object.create(null), SYM_CH = Object.create(null);
  const SYM_KEYS = [...new Set(SYMBOLS.map(x => x[1]))];
  SYMBOLS.forEach(([name, key]) => { SYM_CH[name] = String.fromCharCode(0xE000 + SYM_KEYS.indexOf(key)); });
  SYM_KEYS.forEach((key, i) => { SYM_KEY[String.fromCharCode(0xE000 + i)] = key; });
  // Das Symbol steht nur im Zusammenhang mit Spells („Magic Arts Spells“ -> „[Symbol] Spells“, auch „Decay or
  // Support Spell“ und „Destruction or Decay Magic Spell“: jede Schule der Aufzaehlung). Wird die Faehigkeit selbst
  // gemeint („Magic Arts 1“, „Fighting level“, „a Support Magic Ability“, „Support Zone“), bleibt der Name Text.
  const SYM_ALT = SYMBOLS.map(x => x[0]).join('|');       // laengere Namen stehen vor ihren Kurzformen
  const SYM_SEP = '(?:\\s*,\\s*|\\s+(?:or|and)\\s+)';
  const SYM_RE = new RegExp('\\b(' + SYM_ALT + ')(?=(?:' + SYM_SEP + '(?:' + SYM_ALT + '))*\\s+Spells?\\b)', 'g');
  const SYM_RE_ALL = new RegExp('\\b(' + SYMBOLS.slice(0, 6).map(x => x[0]).join('|') + ')\\b', 'g');   // nur zum Vergleichen (OPT.symMode = 'all')
  // Fighting nutzt sein Schwert-Symbol statt „Spells“ fuer Attacks: „Fighting Attacks“ und auf der Faehigkeitskarte
  // Fighting („Allows the use of Attacks up to Level 1 …“, in jeder Stufe) steht das Symbol vor „Attacks“.
  const SYM_FIGHT_RE = /\bFighting(?=\s+Attacks?\b)/g;
  const SYM_FIGHT_USE_RE = /(Allows the use of )(?=Attacks?\b)/g;
  const symbolize = t => {
    t = String(t == null ? '' : t);
    if (OPT.symMode === 'none') return t;
    t = t.replace(OPT.symMode === 'all' ? SYM_RE_ALL : SYM_RE, m => SYM_CH[m]);
    if (OPT.symMode === 'all') return t;
    return t.replace(SYM_FIGHT_RE, SYM_CH['Fighting']).replace(SYM_FIGHT_USE_RE, '$1' + SYM_CH['Fighting'] + ' ');
  };
  let symSize = 8.5;                              // Symbolgroesse des Textfelds, das gerade gesetzt wird
  function symAdv(ch) {                           // Breite in Font-Einheiten (haengt nicht von der Schriftgroesse ab)
    const r = sprites && sprites.rects['sym.' + SYM_KEY[ch]];
    if (!r) return 1400;
    return (r[2] * 10 + SYM_SPACE) * (symSize / SYM_FONT) * UPM / (20 * PT);
  }

  function adv(ch) {
    if (ch === ' ') return SPACE_U;
    if (ZERO_WIDTH.includes(ch)) return 0;
    if (SYM_KEY[ch]) return symAdv(ch);
    const g = GL[ch];
    return g ? g.a : 1400;
  }
  function unitsOf(s) { let n = 0; for (const c of s) n += adv(c); return n; }
  function glyphPath(ch) {
    const g = GL[ch];
    if (!g) return null;
    return g.path || (g.path = new Path2D(g.d));
  }
  // Ein Zeichen an Position (x, Grundlinie y); k = Pixel je Font-Einheit, sx = horizontale Stauchung
  function putGlyph(ctx, ch, x, y, k, sx) {
    const p = glyphPath(ch);
    if (!p) return;
    ctx.setTransform(k * sx, 0, 0, -k, x, y);
    ctx.fill(p);
  }

  // ── Farben (Style-Skript des Templates) ──
  const C = {
    white: 'rgb(255,255,255)', boss: 'rgb(200,0,0)', bossText: 'rgb(240,50,50)', token: 'rgb(50,50,50)',
    sapphire: 'rgb(8,211,239)', diamond: 'rgb(145,230,230)', diamondLight: 'rgb(178,238,238)', diamondMuted: 'rgb(116,184,184)', diamondDark: 'rgb(102,161,161)', artifact: 'rgb(182,38,0)', sup: 'rgb(255,221,0)',
    supArti: 'rgb(255,125,0)', rare: 'rgb(173,97,0)',
  };

  // Kartentypen (= `card type` des Templates)
  const isSuperhero = t => t === 'superhero';
  const isFullart = t => t === 'superhero' || t === 'fullartHero';
  const isHero3 = t => t === 'hero' || t === 'boss' || t === 'fullartHero';
  const isToken = t => t === 'token' || t === 'tokenCreature';
  const isArti2 = t => t === 'artifact' || t === 'artifactCreature';
  const isSmallbox = t => t === 'skill' || t === 'summon' || t === 'potion' || isToken(t) || isArti2(t);

  // ═════════════ Assets ═════════════
  let sprites = null;        // { img, rects }
  let initPromise = null;
  function loadImage(url) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('Bild nicht ladbar: ' + url));
      im.src = url;
    });
  }
  function init(opts) {
    if (initPromise) return initPromise;
    const base = (opts && opts.base) || '/cardgen/';
    artBase = base;
    initPromise = (async () => {
      const [img, json, glyphs] = await Promise.all([
        loadImage(base + 'sprites.png'),
        fetch(base + 'sprites.json').then(r => r.json()),
        fetch(base + 'glyphs.json').then(r => r.json()),
      ]);
      sprites = { img, rects: json.rects };
      GL = glyphs.glyphs;
    })();
    return initPromise;
  }

  // Sprite 1:1-Pixel-Art auf Zielrechteck (nearest neighbour)
  function sprite(ctx, key, dx, dy, dw, dh) {
    const r = sprites.rects[key];
    if (!r) return false;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprites.img, r[0], r[1], r[2], r[3], dx, dy, dw, dh);
    return true;
  }

  // Symbolbild in Zielgroesse: Flaechenmittel aus den 10x10-Bloecken des Originals (MSE skaliert weich);
  // einmal je Symbol und Groesse berechnet.
  const symBitmaps = new Map();
  function symbolBitmap(key, tw, th) {
    const id = key + ':' + tw + 'x' + th;
    let c = symBitmaps.get(id);
    if (c) return c;
    const r = sprites.rects['sym.' + key], bw = r[2], bh = r[3];
    const src = document.createElement('canvas'); src.width = bw; src.height = bh;
    const sctx = src.getContext('2d');
    sctx.drawImage(sprites.img, r[0], r[1], bw, bh, 0, 0, bw, bh);
    const sd = sctx.getImageData(0, 0, bw, bh).data;
    c = document.createElement('canvas'); c.width = tw; c.height = th;
    const cx = c.getContext('2d'), out = cx.createImageData(tw, th), od = out.data;
    const fx = bw / tw, fy = bh / th;
    for (let j = 0; j < th; j++) {
      const y0 = j * fy, y1 = y0 + fy;
      for (let i = 0; i < tw; i++) {
        const x0 = i * fx, x1 = x0 + fx;
        let R = 0, G = 0, B = 0, A = 0, T = 0;
        for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
          const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
          for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
            const w = (Math.min(x1, sx + 1) - Math.max(x0, sx)) * wy, p = (sy * bw + sx) * 4, a = sd[p + 3] / 255;
            R += sd[p] * a * w; G += sd[p + 1] * a * w; B += sd[p + 2] * a * w; A += a * w; T += w;
          }
        }
        const o = (j * tw + i) * 4;
        if (A > 0) { od[o] = R / A; od[o + 1] = G / A; od[o + 2] = B / A; od[o + 3] = 255 * A / T; }
      }
    }
    cx.putImageData(out, 0, 0);
    symBitmaps.set(id, c);
    return c;
  }
  // Ein Symbol in die Textzeile mit Grundlinie `baseY`: waagrecht in seiner Breite zentriert, senkrecht mittig
  // in der Zeilenhoehe (Ausrichtung „middle center“ der Symbolschrift).
  function putSymbol(ctx, ch, x, baseY, pt) {
    const key = SYM_KEY[ch], r = sprites.rects['sym.' + key];
    if (!r) return;
    const sc = symSize / SYM_FONT * pt / 20;
    const tw = Math.max(1, Math.floor(r[2] * 10 * sc)), th = Math.max(1, Math.floor(r[3] * 10 * sc));   // MSE schneidet ab
    const em = pt * PT;
    const cy = baseY - em * ASC / UPM + em * LINE_U / UPM / 2 + OPT.symDy;
    const boxW = adv(ch) * em / UPM;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(symbolBitmap(key, tw, th), Math.round(x + (boxW - tw) / 2 + OPT.symDx), Math.round(cy - th / 2));
  }

  // ═════════════ Textsatz ═════════════
  // Absaetze -> Woerter (in Font-Einheiten); bricht an Leerzeichen um.
  function wrapPara(words, limitU, spaceU) {
    const lines = []; let cur = [], curU = 0;
    for (const w of words) {
      const wu = w.u;
      if (!cur.length) { cur = [w]; curU = wu; continue; }
      if (curU + spaceU + wu + (OPT.trail ? spaceU : 0) <= limitU) { cur.push(w); curU += spaceU + wu; }
      else { lines.push({ words: cur, u: curU }); cur = [w]; curU = wu; }
    }
    if (cur.length) lines.push({ words: cur, u: curU });
    return lines;
  }

  // Text -> Absaetze. Ein Zeilenumbruch hinter einem Leerzeichen ist ein weicher Umbruch der Vorlage
  // (der Text wurde dort nur zur Lesbarkeit umgebrochen), alle anderen sind echte Absaetze.
  function paragraphs(text, soft) {
    let t = String(text == null ? '' : text);
    if (soft || OPT.nl === 'soft') t = t.replace(/ *\n */g, ' ');
    else t = t.replace(/ +\n/g, ' ');
    return t.split('\n').map(p => p.trim()).filter(Boolean)
      .map(p => p.split(/ +/).filter(Boolean).map(s => ({ s, u: unitsOf(s) })));
  }

  // Passende Schriftgroesse: wie MSE per Halbierung zwischen `min` und `size` (bsteps Schritte), das groesste
  // ausprobierte Mass, bei dem alles in die Box passt. Passt schon `size`, bleibt es dabei.
  function fitSize(paras, o) {
    const space = adv(' ');
    const fits = pt => {
      const em = pt * PT, limitU = o.width * UPM / em;
      let n = 0;
      for (const p of paras) n += wrapPara(p, limitU, space).length;
      const full = em * LINE_U / UPM;
      return (n - 1) * full * o.lineHeight + full <= o.height + 1e-6;   // die letzte Zeile zaehlt mit voller Hoehe
    };
    if (fits(o.size)) return o.size;
    let lo = o.min, hi = o.size;
    for (let i = 0; i < OPT.bsteps; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid; else hi = mid;
    }
    return lo;
  }

  // Zeichnet einen Textblock in eine Box (Regeltext, Faehigkeiten, Namensfelder mit Umbruch).
  function drawBlock(ctx, text, o) {
    symSize = o.symSize || 8.5;
    const paras = paragraphs(symbolize(text), o.soft);
    if (!paras.length || !paras[0].length) return;
    const innerW = o.width - (o.padL || 0) - (o.padR || 0) - OPT.slack;
    const innerH = o.height - (o.padT || 0) - (o.padB || 0);
    const pt = OPT.forcePt && o.main ? OPT.forcePt : o.fixed ? o.size : fitSize(paras, { size: o.size, min: o.min, width: innerW, height: innerH + OPT.hextra, lineHeight: o.lineHeight || 1 });
    const em = pt * PT, limitU = innerW * UPM / em, spaceU = adv(' ');
    root.CardRender.last.pt = pt;
    const lines = [];
    for (const p of paras) {
      const ls = wrapPara(p, limitU, spaceU);
      ls.forEach((l, i) => { l.last = i === ls.length - 1; lines.push(l); });
    }
    const pitch = em * LINE_U / UPM * (o.lineHeight || 1);
    const total = (lines.length - 1) * pitch + em * LINE_U / UPM;
    root.CardRender.last.n = lines.length; root.CardRender.last.h = total; root.CardRender.last.H = innerH;
    let top = o.top + (o.padT || 0);
    if (o.vAlign === 'middle') top += (innerH - total) / 2;
    ctx.fillStyle = o.color;
    const k = em / UPM;
    const base = em * ASC / UPM;
    const x0 = o.left + (o.padL || 0);
    lines.forEach((l, li) => {
      const y = top + li * pitch + base + OPT.dy;
      const gaps = l.words.length - 1;
      let gapU = spaceU;
      let lineU = l.u;
      if (o.align === 'justify' && !l.last && gaps > 0) { gapU = (limitU - (l.u - gaps * spaceU)) / gaps; lineU = limitU; }
      let x = x0;
      if (o.align === 'center') x = x0 + (innerW - lineU * em / UPM) / 2;
      for (let wi = 0; wi < l.words.length; wi++) {
        for (const ch of l.words[wi].s) {
          if (SYM_KEY[ch]) putSymbol(ctx, ch, x, y, pt); else putGlyph(ctx, ch, x + OPT.dx, y, k, 1);
          x += adv(ch) * k;
        }
        x += gapU * k;
      }
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Kurze Felder (Name, Werte, Faehigkeitsnamen): kein Umbruch ausser an `\n`. Passt der Text nicht in die Hoehe
  // der Box, wird die Schrift bis `min` verkleinert; ist eine Zeile danach noch zu breit, wird sie horizontal
  // gestaucht (MSE „shrink-overflow“).
  function drawLine(ctx, text, o) {
    const lines = String(text == null ? '' : text).split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const fitsH = pt => lines.length * pt * PT * LINE_U / UPM <= o.height + 1e-6;
    let pt = o.size;
    if (!fitsH(pt)) {
      let lo = o.min, hi = o.size;
      for (let i = 0; i < OPT.bsteps; i++) { const mid = (lo + hi) / 2; if (fitsH(mid)) lo = mid; else hi = mid; }
      pt = lo;
    }
    const em = pt * PT, k = em / UPM, pitch = em * LINE_U / UPM;
    const total = (lines.length - 1) * pitch + em * LINE_U / UPM;
    const top = o.vAlign === 'middle' ? o.top + (o.height - total) / 2 : o.top;
    ctx.fillStyle = o.color;
    lines.forEach((line, li) => {
      const u = unitsOf(line), natural = u * k;
      const sx = natural > o.width ? o.width / natural : 1;
      const w = natural * sx;
      let x = o.left;
      if (o.align === 'center') x = o.left + (o.width - w) / 2;
      else if (o.align === 'right') x = o.left + o.width - w;
      const y = top + li * pitch + em * ASC / UPM + OPT.dy;
      let cx = x + OPT.dx;
      for (const ch of line) { putGlyph(ctx, ch, cx, y, k, sx); cx += adv(ch) * k * sx; }
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Goldener Verlauf fuer Skin-Namen (oben hell, unten tief; harte Kante in der Mitte wie bei gebuerstetem Gold)
  function goldFill(ctx, top, height) {
    const g = ctx.createLinearGradient(0, top + height * 0.12, 0, top + height * 0.88);
    g.addColorStop(0, '#fffbd2'); g.addColorStop(0.4, '#ffe469'); g.addColorStop(0.5, '#ffc61c');
    g.addColorStop(0.54, '#fff1a3'); g.addColorStop(1, '#f5b800');
    return g;
  }

  // ═════════════ Farben je Karte ═════════════
  function nameColor(s) {
    const t = s.type, r = s.rarity;
    if (t === 'boss') return C.boss;
    if (isToken(t)) return C.token;
    if (isSuperhero(t)) return C.white;
    if (r === 'sapphire') return C.sapphire;
    if (r === 'super rare' && isArti2(t)) return C.supArti;
    if (r === 'super rare') return C.sup;
    if (isArti2(t)) return C.artifact;
    if (r === 'diamond') return C.diamond;
    return C.white;
  }
  function ruleColor(s) {
    const t = s.type;
    if (t === 'boss') return C.bossText;
    if (isToken(t)) return C.token;
    if (isArti2(t)) return C.artifact;
    if (s.rarity === 'diamond') return C.diamond;
    return C.white;
  }
  function skillColor(s) { return s.type === 'boss' ? C.boss : s.rarity === 'diamond' ? C.diamond : C.white; }
  function statColor(s) {
    const t = s.type;
    if (t === 'boss') return C.boss;
    if (isToken(t)) return C.token;
    if (isSuperhero(t)) return C.white;
    if (isArti2(t)) return C.artifact;
    if (s.rarity === 'diamond') return C.diamond;
    return C.white;
  }
  function levelColor(s) {
    if (s.rarity === 'diamond') return C.diamond;
    if (s.rarity === 'super rare' && s.type === 'artifact') return C.supArti;
    if (s.rarity === 'super rare') return C.sup;
    if (s.type === 'artifact') return C.artifact;
    return C.white;
  }

  const STAMP = { common: 'common', uncommon: 'uncommon', rare: 'rare', 'super rare': 'superRare', diamond: 'diamond', sapphire: 'sapphire' };

  // ═════════════ Karte zeichnen ═════════════
  // spec: { type, rarity, name, text, skillBox, skillBox2, hp, atk, level, school, kind }
  // art:  { src: CanvasImageSource, sx, sy, sw, sh } | null
  function draw(spec, art, target) {
    if (!sprites) throw new Error('CardRender.init() fehlt');
    const t = spec.type;
    const cv = target || document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    // 1) Rahmen
    sprite(ctx, 'frame.' + t, 0, 0, W, H);

    // 2) Kunst, gestreckt in ihr Feld und mit der Maske des Rahmens beschnitten
    if (art) {
      const full = isFullart(t);
      const box = full ? [0, 0, W, H] : [70, 170, 610, 400];
      const maskKey = t === 'superhero' ? 'mask.hero' : t === 'fullartHero' ? 'mask.fullart' : 'mask.art';
      const layer = document.createElement('canvas');
      layer.width = box[2]; layer.height = box[3];
      const lc = layer.getContext('2d');
      lc.imageSmoothingEnabled = false;
      lc.drawImage(art.src, art.sx || 0, art.sy || 0, art.sw || art.src.width, art.sh || art.src.height, 0, 0, box[2], box[3]);
      lc.globalCompositeOperation = 'destination-in';
      sprite(lc, maskKey, 0, 0, box[2], box[3]);
      ctx.drawImage(layer, box[0], box[1]);
    }

    // 3) Namenszeile (z 2) — Superhelden: breiter
    const sup = isSuperhero(t);
    drawLine(ctx, spec.name, {
      left: sup ? 48 : 103, top: 48, width: sup ? 654 : 544, height: 55, size: 50, min: 48,
      align: 'center', color: spec.nameGold ? goldFill(ctx, 48, 55) : nameColor(spec),
    });

    // 4) Faehigkeiten-Felder der Helden
    if (isHero3(t) || sup) {
      drawLine(ctx, spec.skillBox, {
        left: 90, top: isHero3(t) ? 600 : 585, width: sup ? 560 : 260, height: isHero3(t) ? 65 : 100,
        size: sup ? 20 : 22, min: 1, align: 'center', vAlign: 'middle', color: skillColor(spec),
      });
      if (isHero3(t)) drawLine(ctx, spec.skillBox2, {
        left: 400, top: 598, width: 260, height: 65, size: 22, min: 1, align: 'center', vAlign: 'middle', color: skillColor(spec),
      });
    }

    // 5) Zauberschule (links) und Stufe (rechts) — Zauber und Kreaturen
    if (t === 'spell' || t === 'summon') {
      if (spec.school) sprite(ctx, 'school.' + spec.school, 0, 550, 110, 110);
      if (spec.level != null) drawLine(ctx, String(spec.level), {
        left: 650, top: 550, width: 110, height: 110, size: 65, min: 1, align: 'center', vAlign: 'middle', color: levelColor(spec),
      });
    }
    // Kartenart-Symbol unten links (Falle, Reaktion, Flaeche, Anhang)
    if (spec.kind && (t === 'spell' || t === 'summon' || t === 'potion' || t === 'artifact')) {
      sprite(ctx, 'kind.' + spec.kind, 0, 950, 100, 100);
    }

    // 6) Goldene Rahmenelemente (die uebrigen Foil-Layer entfallen)
    if (t === 'superhero') sprite(ctx, 'rim.goldSuperhero', 0, 0, W, H);
    else if (t === 'fullartHero') sprite(ctx, 'rim.goldFullart', 0, 0, W, H);
    else if (spec.rarity === 'super rare') sprite(ctx, 'rim.superRare', 0, 0, W, H);
    else if (OPT.silverRim && spec.rarity === 'rare') sprite(ctx, 'rim.rare', 0, 0, W, H);
    // Diamond: der Rahmen aus dem Template (14 px oben/unten, 15 px links/rechts, Cyan); die Textur darueber entfaellt.
    // Die Ecken sind wie beim Gold-/Silberrahmen gebaut: je Ecke 2x2 Bloecke (Randstaerke), Eckblock und der
    // diagonal innen liegende Block gedaempft, die beiden Nachbarn am Rand dunkler. Beim Goldrahmen sind das
    // (213,185,76) und (196,156,0) zu den Randfarben (255,231,76)/(255,221,0) — hier 80 % bzw. 70 % des Cyans.
    if (spec.rarity === 'diamond') {
      const T = 14, S = 15;
      // Rand wie beim Goldrahmen in Zellen (hier 15 x 14 px, also ein Raster aus 50 x 75 Zellen) mit abwechselnd
      // zwei Toenen: ab der dritten Zelle jede zweite heller (Gold: (255,231,76) und (255,221,0)). Der Rand zwischen
      // den Eckbloecken ist die Basisfarbe; die hellere Zelle ist 30 % zum Weiss hin gemischt.
      const cols = W / S, rows = H / T;
      for (let i = 2; i < cols - 2; i++) {
        ctx.fillStyle = i % 2 === 0 ? C.diamondLight : C.diamond;
        ctx.fillRect(i * S, 0, S, T); ctx.fillRect(i * S, H - T, S, T);
      }
      for (let j = 2; j < rows - 2; j++) {
        ctx.fillStyle = j % 2 === 0 ? C.diamondLight : C.diamond;
        ctx.fillRect(0, j * T, S, T); ctx.fillRect(W - S, j * T, S, T);
      }
      [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]].forEach(([cx, cy, sx, sy]) => {
        [[0, 0, C.diamondMuted], [1, 0, C.diamondDark], [0, 1, C.diamondDark], [1, 1, C.diamondMuted]].forEach(([bx, by, col]) => {
          const x0 = cx + sx * bx * S, x1 = cx + sx * (bx + 1) * S, y0 = cy + sy * by * T, y1 = cy + sy * (by + 1) * T;
          ctx.fillStyle = col;
          ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), S, T);
        });
      });
    }

    // 7) Werte (HP, Angriff / Kosten)
    const stat = statColor(spec);
    if (isHero3(t) || sup || t === 'summon' || t === 'tokenCreature' || t === 'artifactCreature') {
      // Helden ohne feste Werte (Ascended Hero „stats equal its base Hero's“) zeigen „?“ in beiden Feldern
      const unknown = isHero3(t) || sup;
      if (spec.hp != null || unknown) drawLine(ctx, spec.hp != null ? String(spec.hp) : '?', {
        left: t === 'artifactCreature' ? 240 : (t === 'summon' || t === 'tokenCreature') ? 275 : t === 'boss' ? 160 : 201,
        top: 984, width: 194, height: 60, size: 38, min: 1, align: 'center', color: stat,
      });
    }
    if (isHero3(t) || sup || t === 'summon' || isArti2(t)) {
      if (spec.atk != null || isHero3(t) || sup) drawLine(ctx, spec.atk != null ? String(spec.atk) : '?', {
        left: t === 'artifact' ? 296 : 504, top: 984, width: isArti2(t) ? 150 : 94, height: 60, size: 38, min: 1, align: 'center', color: stat,
      });
    }

    // 8) Regeltext — Faehigkeiten haben drei Textfelder, alle anderen Karten eines
    if (t === 'skill3') {
      const boxes = [[605, 115, 0.9], [745, 115, 0.8], [885, 105, 0.9]];
      boxes.forEach(([top, height, lh], i) => drawBlock(ctx, spec.abilities && spec.abilities[i], {
        left: 80, top, width: 590, height, padL: 1, padT: 2, padR: 0, padB: 0,
        size: 20, min: 7, align: 'justify', vAlign: 'middle', lineHeight: lh, color: C.white, symSize: 10.5,
      }));
    } else {
      const rule = {
        top: isSmallbox(t) ? 620 : t === 'spell' ? 630 : isHero3(t) ? 685 : sup ? 675 : 789,
        height: isSmallbox(t) ? 350 : t === 'spell' ? 355 : isHero3(t) ? 290 : sup ? 295 : 174,
      };
      drawBlock(ctx, spec.text, {
        left: 95, top: rule.top, width: 560, height: rule.height, padL: 1, padT: 2, padR: 0, padB: 0,
        size: 20, min: 7, align: 'justify', vAlign: 'middle', lineHeight: 1, color: ruleColor(spec), main: true, soft: spec.soft,
      });
    }

    // 9) Seltenheits-Stempel unten rechts
    const stamp = STAMP[spec.rarity];
    if (stamp) {
      const white = isArti2(t) && (stamp !== 'diamond' && stamp !== 'sapphire');
      sprite(ctx, (white ? 'cornerW.' : 'corner.') + stamp, 689, 989, 45, 45);
    }
    return cv;
  }

  // ═════════════ cards.json -> Karten-Spezifikation ═════════════
  const SCHOOL_KEY = {
    'Destruction Magic': 'destruction', 'Support Magic': 'support', 'Summoning Magic': 'summoning',
    'Decay Magic': 'decay', 'Magic Arts': 'arts', 'Fighting': 'fight',
  };
  const SCHOOL_ORDER = ['decay', 'destruction', 'arts', 'summoning', 'support'];
  const KIND_BY_SUBTYPE = {
    spell:  { Reaction: 'quick', Surprise: 'trap', Area: 'area', Attachment: 'attachment' },
    artifact: { Equipment: 'attachmentArti', Reaction: 'quickArti', Surprise: 'trapArti', Area: 'areaArti' },
    potion: { Reaction: 'quickPotion', Surprise: 'trapPotion', Area: 'areaPotion', Attachment: 'attachmentPotion' },
  };
  // „1) … 2) … 3) …“ -> drei Faehigkeiten-Texte ohne Nummer
  function abilityTexts(effect) {
    const out = ['', '', ''];
    for (const line of String(effect || '').split('\n')) {
      const m = /^\s*([123])\)\s*(.*)$/.exec(line);
      if (m) out[+m[1] - 1] = (out[+m[1] - 1] ? out[+m[1] - 1] + ' ' : '') + m[2].trim();
    }
    return out;
  }
  function schoolKey(c) {
    const a = SCHOOL_KEY[c.spellSchool1], b = SCHOOL_KEY[c.spellSchool2];
    if (a && b && a !== b) {
      const [x, y] = [a, b].sort((p, q) => SCHOOL_ORDER.indexOf(p) - SCHOOL_ORDER.indexOf(q));
      return x + y[0].toUpperCase() + y.slice(1);
    }
    return a || b || null;
  }
  /**
   * @param {object} c     Karte aus cards.json
   * @param {object} [meta] reine Darstellungsdaten (data/card-render.json, cards[Name]): { r: Seltenheit, f: Rahmen, sb, sb2, soft: Zeilenumbrueche im Text sind nur Leerstellen }
   * @param {object} [over] { name } — Skins ersetzen nur Namen (und Kunst)
   */
  // Das Foil-Kennzeichen aus cards.json ist die Seltenheit, die das Spiel kennt (Foil-Effekt, Rahmenfarbe):
  // „diamond_rare“ -> Diamond, „secret_rare“ -> Super Rare. Es geht der aus alten Kartenbildern abgeleiteten
  // Seltenheit (card-render.json `r`) vor.
  const FOIL_RARITY = { diamond_rare: 'diamond', secret_rare: 'super rare' };
  function specFromCard(c, meta, over) {
    meta = meta || {}; over = over || {};
    let type;
    switch (c.cardType) {
      case 'Hero': type = meta.f || 'hero'; break;
      case 'Ascended Hero': type = meta.f || 'superhero'; break;
      case 'Ability': type = /^\s*1\)/m.test(c.effect) && /^\s*2\)/m.test(c.effect) && /^\s*3\)/m.test(c.effect) ? 'skill3' : 'skill'; break;
      case 'Spell': case 'Attack': type = 'spell'; break;
      case 'Creature': type = 'summon'; break;
      case 'Artifact': type = c.subtype === 'Creature' ? 'artifactCreature' : 'artifact'; break;
      case 'Potion': type = 'potion'; break;
      default: type = c.hp != null ? 'tokenCreature' : 'token';   // Token, Creature/Token
    }
    const kindMap = KIND_BY_SUBTYPE[type === 'summon' || c.cardType === 'Attack' ? 'spell' : type === 'artifact' ? 'artifact' : type === 'potion' ? 'potion' : 'spell'];
    const hero = c.cardType === 'Hero';
    const asc = c.cardType === 'Ascended Hero';
    return {
      type,
      rarity: FOIL_RARITY[c.foil] || meta.r || 'common',
      name: (over.name != null ? over.name : c.name).replace(/\s*\[(?:B|W)\]$/, ''),
      text: c.effect || '',
      soft: !!meta.soft,
      abilities: type === 'skill3' ? abilityTexts(c.effect) : null,
      skillBox: meta.sb != null ? meta.sb : hero ? (c.startingAbility1 || '') : asc ? [c.startingAbility1, c.startingAbility2].filter(Boolean).join('\n') : '',
      skillBox2: meta.sb2 != null ? meta.sb2 : (hero ? (c.startingAbility2 || '') : ''),
      hp: c.hp, atk: type === 'artifact' || type === 'artifactCreature' ? c.cost : c.atk,
      level: type === 'spell' || type === 'summon' ? c.level : null,
      school: type === 'spell' || type === 'summon' ? (c.cardType === 'Attack' ? 'fight' : schoolKey(c)) : null,
      kind: kindMap && kindMap[c.subtype] || null,
    };
  }

  // ═════════════ Kunst ═════════════
  // art.json: { atlas, a: { Schluessel: [x,y,w,h] }, b: { Schluessel: 'id.webp' } }
  //   a = natives Pixelraster im Atlas (EINE Datei), b = Vollaufloesung als Einzeldatei (nur bei Bedarf geladen)
  let artIndex = null, atlasImg = null, artBase = '/cardgen/';
  const fullCache = new Map();
  async function loadArtIndex() {
    if (artIndex) return artIndex;
    const idx = await fetch(artBase + 'art.json').then(r => r.json());
    atlasImg = await loadImage(artBase + idx.atlas);
    artIndex = idx;
    return idx;
  }
  /** Kunst zu einem Schluessel (Kartenname oder Skin-Name) — null, wenn es keine gibt. */
  async function getArt(key) {
    const idx = await loadArtIndex();
    const r = idx.a[key];
    if (r) return { src: atlasImg, sx: r[0], sy: r[1], sw: r[2], sh: r[3] };
    const f = idx.b[key];
    if (f) {
      if (!fullCache.has(f)) fullCache.set(f, loadImage(artBase + 'art/' + f));
      return { src: await fullCache.get(f) };
    }
    return null;
  }
  function hasArt(key) { return !!(artIndex && (artIndex.a[key] || artIndex.b[key])); }

  // ═════════════ Metadaten (Seltenheit, Rahmen, Faehigkeitstexte, Skin-Namen) ═════════════
  let meta = { cards: {}, skins: {} };
  async function loadMeta(url) {
    try { meta = await fetch(url || '/data/card-render.json').then(r => r.json()); } catch (e) { /* ohne Metadaten: alles Common */ }
    meta.cards = meta.cards || {}; meta.skins = meta.skins || {};
    return meta;
  }

  /**
   * Komplette Karte als Canvas.
   * @param {object} card  Karte aus cards.json
   * @param {object} [o]   { skin: Skin-Name } — Skins zeigen dieselbe Karte mit eigener Kunst und eigenem Namen
   * @returns {Promise<HTMLCanvasElement|null>} null, wenn die Kunst fehlt
   */
  async function renderCard(card, o) {
    o = o || {};
    const key = o.skin ? 'skin/' + o.skin : card.name;
    const art = await getArt(key);
    if (!art) return null;
    // Ein Skin zeigt die Karte seines Helden mit eigener Kunst und eigenem Namen; weicht seine Seltenheit oder
    // sein Rahmen von der Basiskarte ab (r / f im Skin-Eintrag), gilt der des Skins.
    const skin = o.skin ? (meta.skins[o.skin] || {}) : null;
    const m = Object.assign({}, meta.cards[card.name]);
    if (skin) { if (skin.r) m.r = skin.r; if (skin.f) m.f = skin.f; }
    const spec = specFromCard(card, m, skin ? { name: skin.name || o.skin } : null);
    // Skin-Holo: der Name steht golden auf der Karte (siehe unten, HOLO-TEXTUR); die schillernden Schichten
    // darueber zeichnet das Spiel als eigene DOM-Lage (SkinHolo in app-shared.jsx).
    if (skin && holoOn(skin)) spec.nameGold = true;
    return draw(spec, art);
  }

  // ═════════════ HOLO FUER SKINS UND FOIL-NAMEN ═════════════
  //  Skin-Karten bekommen ein eigenes Foil, das NUR Kunst und Namen betrifft (Rahmen, Werte und Text bleiben
  //  ruhig). Der Name steht golden auf der Karte; Super Rare und Diamond Rare tragen denselben Namensglanz.
  //
  //  Die KUNST bleibt lesbar — das Foil liegt auf ihren Flaechen und Umrissen, nicht ueber dem Motiv:
  //    · Konturen: wo auf dem NATIVEN Pixelraster der Kunst (meist 76x51) zwei Nachbarpixel stark verschieden sind
  //      (Umrisse, Kanten), liegt eine duenne Leuchtlinie auf der Pixelgrenze, in Regenbogenfarben.
  //    · Flaechen: jedes Pixel bekommt EINEN Highlight-Ton aus seiner eigenen Farbe (Farbton leicht verschoben, voll
  //      gesaettigt; Graustufen nach Helligkeit). Gleiche Farbe = gleicher Highlight. Dunkle Pixel (Umrisse, Schatten)
  //      bekommen nichts, die Zeichnung bleibt scharf.
  //    · Schraffur: eine feine Linienstruktur ueber dem ganzen Bild — sie braucht keine Textur, nur diese Flaechen
  //      als Maske (CSS, SkinHolo).
  //  Alle Texturen sind Pixel fuer Pixel auf die Kunst ausgerichtet (gleiche Streckung wie `draw`, nearest neighbour,
  //  keine Unschaerfe). Heraus kommen PNG-Blobs: `areas`, `edges`, `all` (Vereinigung beider als Maske fuers Glanzband
  //  und die Schraffur), `nameMask` (Umriss der Namensbuchstaben); das Spiel legt sie als CSS-Hintergruende/-Masken
  //  an die richtige Stelle (SkinHolo, app-shared.jsx).
  const HOLO = {
    on: true,
    dark: 0.16,          // unterhalb dieser Helligkeit (0..1) bekommt ein Pixel keinen Flaechen-Highlight
    full: 0.46,          // ab dieser Helligkeit voller Highlight
    neutral: 0.50,       // Staerke fuer Graustufen (Farben: bis 1,0, je nach Saettigung)
    hueShift: 0.05,      // Verschiebung des Farbtons gegenueber der Flaeche (Anteil des Farbkreises)
    steps: 24,           // Farbton in so viele Stufen gerastert: Flaechen gleicher Farbe bekommen exakt denselben Ton
    edge: 0.22,          // ab diesem Farbabstand (0..1) zweier Nachbarpixel liegt eine Kontur dazwischen
    edgeWidth: 0.5,      // Breite der Leuchtlinie in Anteilen eines nativen Pixels
  };
  /** Gilt das Holo fuer diesen Skin? (`data/card-render.json` -> skins[Name].holo = false schaltet es ab) */
  function holoOn(skinMeta) { return HOLO.on && !(skinMeta && skinMeta.holo === false); }

  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  function hsl2rgb(h, s, l) {                    // h 0..1
    const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }

  /** Geometrie je Kartentyp: Bildfeld (Kartenpixel), Rahmenmaske, Namenszeile */
  function holoGeometry(type) {
    const full = isFullart(type);
    // Telefone (Lite-Modus, wie in style.css): halbe Textur-Aufloesung
    const lite = typeof matchMedia === 'function' && matchMedia('(pointer: coarse) and (max-height: 600px)').matches;
    return {
      box: full ? [0, 0, W, H] : [70, 170, 610, 400],
      maskKey: type === 'superhero' ? 'mask.hero' : type === 'fullartHero' ? 'mask.fullart' : 'mask.art',
      scale: (full ? 0.6 : 1) * (lite ? 0.5 : 1),
      nameBox: { left: isSuperhero(type) ? 48 : 103, top: 48, width: isSuperhero(type) ? 654 : 544, height: 55 },
    };
  }

  // Rahmenmaske des Bildfelds in Texturgroesse, hart geschnitten: nur voll deckende Stellen zaehlen. Bei Vollbild-
  // Helden scheint das Bild blass durch die Textfelder; dort darf kein Highlight liegen (Lesbarkeit).
  const maskCache = new Map();
  function artMask(maskKey, tw, th) {
    const id = maskKey + ':' + tw + 'x' + th;
    let c = maskCache.get(id);
    if (c) return c;
    c = document.createElement('canvas'); c.width = tw; c.height = th;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    sprite(x, maskKey, 0, 0, tw, th);
    const im = x.getImageData(0, 0, tw, th), d = im.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 230 ? 255 : 0;
    x.putImageData(im, 0, 0);
    maskCache.set(id, c);
    return c;
  }

  /** Umriss der Namensbuchstaben: nur der Name, weiss, in einem Streifen ueber die ganze Kartenbreite (Hoehe 110 ab y = 20) */
  const NAME_STRIP = { x: 0, y: 20, w: W, h: 110 };
  function nameMaskCanvas(spec, geo) {
    const c = document.createElement('canvas'); c.width = NAME_STRIP.w; c.height = NAME_STRIP.h;
    drawLine(c.getContext('2d'), spec.name, {
      left: geo.nameBox.left, top: geo.nameBox.top - NAME_STRIP.y, width: geo.nameBox.width, height: geo.nameBox.height,
      size: 50, min: 48, align: 'center', color: '#fff',
    });
    return c;
  }

  /**
   * Die Holo-Schichten eines Skins als Canvas. null, wenn es zur Kunst nichts zu zeichnen gibt.
   * @returns {Promise<null|{ type, box, nameStrip, areas, edges, all, nameMask }>}  Koordinaten in Kartenpixeln (750x1050)
   */
  async function holoLayers(card, o) {
    o = o || {};
    if (!o.skin) return null;
    const art = await getArt('skin/' + o.skin);
    if (!art) return null;
    const skinMeta = meta.skins[o.skin] || {};
    if (!holoOn(skinMeta)) return null;
    const m = Object.assign({}, meta.cards[card.name]);
    if (skinMeta.r) m.r = skinMeta.r; if (skinMeta.f) m.f = skinMeta.f;
    const spec = specFromCard(card, m, { name: skinMeta.name || o.skin });
    const geo = holoGeometry(spec.type);
    const tw = Math.round(geo.box[2] * geo.scale), th = Math.round(geo.box[3] * geo.scale);

    // — natives Raster der Kunst (grosse Vollbilder auf <= 160 Pixel Breite herunterrechnen) —
    const sw = art.sw || art.src.width, sh = art.sh || art.src.height;
    const sc = sw > 160 ? 160 / sw : 1, nw = Math.max(1, Math.round(sw * sc)), nh = Math.max(1, Math.round(sh * sc));
    const nc = document.createElement('canvas'); nc.width = nw; nc.height = nh;
    const nx = nc.getContext('2d'); nx.imageSmoothingEnabled = sc < 1;
    nx.drawImage(art.src, art.sx || 0, art.sy || 0, sw, sh, 0, 0, nw, nh);
    const px = nx.getImageData(0, 0, nw, nh).data;

    // — Flaechen: je Pixel EIN Highlight-Ton aus der eigenen Farbe —
    const mk = () => { const c = document.createElement('canvas'); c.width = nw; c.height = nh; const g = c.getContext('2d'); return { c, g, im: g.createImageData(nw, nh) }; };
    const areas = mk(), union = mk();
    const STEPS = HOLO.steps;
    for (let i = 0; i < nw * nh; i++) {
      const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255, al = px[i * 4 + 3] / 255;
      if (al < 0.5) continue;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, d = mx - mn;
      const gate = smooth(HOLO.dark, HOLO.full, L);            // Umrisse und Schatten bleiben frei
      if (gate <= 0) continue;
      const S = d === 0 ? 0 : d / (1 - Math.abs(2 * L - 1));
      let h;
      if (S >= 0.18) {                                           // Farbflaeche: Farbton der Flaeche, ein Stueck weitergedreht
        h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = (h / 6 + HOLO.hueShift) % 1;
      } else {                                                   // Grau/Weiss: helle Flaechen eisig, dunklere violett
        h = 0.5 + 0.3 * (1 - L);
      }
      h = Math.round(h * STEPS) / STEPS % 1;
      const strength = gate * (HOLO.neutral + (1 - HOLO.neutral) * clamp01(S / 0.5));
      // Der Highlight behaelt die Saettigung der eigenen Farbe (Graustufen: ein Hauch) — er hebt die Flaeche an,
      // faerbt sie nicht um; volle Saettigung machte das Bild schrill.
      const rgb = hsl2rgb(h, clamp01(0.22 + 0.55 * S), 0.58), t = areas.im.data, u = union.im.data;
      t[i * 4] = rgb[0]; t[i * 4 + 1] = rgb[1]; t[i * 4 + 2] = rgb[2]; t[i * 4 + 3] = Math.round(255 * strength);
      u[i * 4] = u[i * 4 + 1] = u[i * 4 + 2] = 255; u[i * 4 + 3] = Math.round(255 * strength);
    }

    // — Konturen: Pixelgrenzen zwischen stark verschiedenen Nachbarn (Staerke = Farbabstand) —
    const segs = [];                                             // [x, y, vertikal?, Staerke] — Lage in nativen Pixelkanten
    const cdist = (i, j) => Math.hypot(px[i * 4] - px[j * 4], px[i * 4 + 1] - px[j * 4 + 1], px[i * 4 + 2] - px[j * 4 + 2]) / 441.67;
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const i = y * nw + x;
      if (x + 1 < nw) { const d = cdist(i, i + 1); if (d >= HOLO.edge) segs.push([x + 1, y, true, clamp01((d - HOLO.edge) / 0.4)]); }
      if (y + 1 < nh) { const d = cdist(i, i + nw); if (d >= HOLO.edge) segs.push([x, y + 1, false, clamp01((d - HOLO.edge) / 0.4)]); }
    }
    const cw = tw / nw, ch = th / nh, lw = Math.max(2, Math.round(Math.min(cw, ch) * HOLO.edgeWidth));
    // Leuchtlinie: weicher Hof, harter Kern; Farbton laeuft quer ueber das Bild (Regenbogen)
    const paintEdges = (g, rainbow) => {
      for (const pass of [0, 1]) for (const [x, y, vert, e] of segs) {
        const X = x * cw, Y = y * ch, grow = pass === 0 ? lw : 0;       // Hof: doppelt so breit
        const a = pass === 0 ? 0.22 * e : 0.45 + 0.4 * e;
        // Gold-Grundton mit bunten Ausreissern (Rosa, Tuerkis, Blau), wie auf einer echten Holo-Folie: der Ton haengt
        // an der Lage, nicht an der Kontur
        if (rainbow) { const w = 0.5 + 0.5 * Math.sin(6.2832 * ((X / tw) * 1.1 + (Y / th) * 0.7)), c = hsl2rgb((0.12 + 0.62 * w * w) % 1, 0.82, 0.74); g.fillStyle = 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; }
        else g.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        if (vert) g.fillRect(X - lw / 2 - grow / 2, Y - grow / 2, lw + grow, ch + grow);
        else g.fillRect(X - grow / 2, Y - lw / 2 - grow / 2, cw + grow, lw + grow);
      }
    };

    // — auf Texturgroesse strecken (nearest wie `draw`), mit der harten Rahmenmaske beschneiden —
    const mask = artMask(geo.maskKey, tw, th);
    const finish = c => {
      const g = c.getContext('2d');
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(mask, 0, 0);
      return c;
    };
    const stretch = layer => {
      layer.g.putImageData(layer.im, 0, 0);
      const c = document.createElement('canvas'); c.width = tw; c.height = th;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      g.drawImage(layer.c, 0, 0, tw, th);
      return c;
    };
    const edges = document.createElement('canvas'); edges.width = tw; edges.height = th;
    paintEdges(edges.getContext('2d'), true);
    const all = stretch(union);
    paintEdges(all.getContext('2d'), false);
    return {
      type: spec.type, box: geo.box, nameStrip: NAME_STRIP,
      areas: finish(stretch(areas)), edges: finish(edges), all: finish(all), nameMask: nameMaskCanvas(spec, geo),
    };
  }

  /** Nur der Namensumriss einer Karte (Super Rare / Diamond Rare tragen den Namensglanz ebenfalls). */
  function nameLayer(card) {
    const spec = specFromCard(card, meta.cards[card.name], null);
    return { type: spec.type, nameStrip: NAME_STRIP, nameMask: nameMaskCanvas(spec, holoGeometry(spec.type)) };
  }

  // Fertige Schichten fuers DOM: PNG-Blobs + die Lage in Prozent der Karte als CSS-Variablen. Je Skin einmal gerechnet
  // und gemerkt (LRU); zwei Skins gleichzeitig zu rechnen waere Verschwendung, darum reiht `holoFor` sie hintereinander ein
  // und laesst dem Browser zwischen zwei Skins Luft.
  const HOLO_MAX = 40, NAME_MAX = 80;
  const holoDone = new Map();        // Skin -> { vars, urls } (fertig)
  const holoWait = new Map();        // Skin -> Promise (in Arbeit)
  const nameDone = new Map();        // Kartenname -> { vars, urls }
  let holoChain = Promise.resolve();
  const toUrl = cv => new Promise(res => cv.toBlob(b => res(b ? URL.createObjectURL(b) : null), 'image/png'));
  const pc = (v, t) => (v / t * 100) + '%';
  function lru(map, key, val, max) {
    map.set(key, val);
    if (map.size > max) {
      const old = map.keys().next().value, o = map.get(old);
      map.delete(old);
      setTimeout(() => o.urls.forEach(u => URL.revokeObjectURL(u)), 60000);   // Karten, die ihn noch zeigen, behalten das Bild
    }
    return val;
  }
  function holoCached(skin) { return holoDone.get(skin) || null; }
  function nameCached(card) { return nameDone.get(card.name) || null; }
  function holoFor(card, skin) {
    if (!HOLO.on || !card || !skin) return Promise.resolve(null);
    const hit = holoDone.get(skin);
    if (hit) { holoDone.delete(skin); holoDone.set(skin, hit); return Promise.resolve(hit); }
    if (holoWait.has(skin)) return holoWait.get(skin);
    const job = holoChain.then(async () => {
      await new Promise(r => setTimeout(r, 0));
      const L = await holoLayers(card, { skin });
      if (!L) return null;
      const [areas, edges, all, name] = await Promise.all([L.areas, L.edges, L.all, L.nameMask].map(toUrl));
      if (!areas || !edges || !all || !name) return null;
      const b = L.box, s = L.nameStrip;
      return lru(holoDone, skin, {
        vars: {
          '--sh-ax': pc(b[0], W), '--sh-ay': pc(b[1], H), '--sh-aw': pc(b[2], W), '--sh-ah': pc(b[3], H),
          '--sh-ny': pc(s.y, H), '--sh-nh': pc(s.h, H),
          '--sh-areas': 'url(' + areas + ')', '--sh-edges': 'url(' + edges + ')',
          '--sh-all': 'url(' + all + ')', '--sh-name': 'url(' + name + ')',
        },
        urls: [areas, edges, all, name],
      }, HOLO_MAX);
    }).catch(err => { console.warn('[card-render] Holo', skin, err && err.message); return null; })
      .finally(() => holoWait.delete(skin));
    holoChain = job.catch(() => {});
    holoWait.set(skin, job);
    return job;
  }
  /** Namensglanz fuer Karten mit Foil (Super Rare / Diamond Rare): Umriss der Buchstaben + Lage. */
  function nameShimmerFor(card) {
    if (!HOLO.on || !card) return Promise.resolve(null);
    const hit = nameDone.get(card.name);
    if (hit) return Promise.resolve(hit);
    const key = 'n:' + card.name;
    if (holoWait.has(key)) return holoWait.get(key);
    const job = holoChain.then(async () => {
      await new Promise(r => setTimeout(r, 0));
      const L = nameLayer(card), url = await toUrl(L.nameMask);
      if (!url) return null;
      return lru(nameDone, card.name, {
        vars: { '--sh-ny': pc(L.nameStrip.y, H), '--sh-nh': pc(L.nameStrip.h, H), '--sh-name': 'url(' + url + ')' },
        urls: [url],
      }, NAME_MAX);
    }).catch(err => { console.warn('[card-render] Namensglanz', card.name, err && err.message); return null; })
      .finally(() => holoWait.delete(key));
    holoChain = job.catch(() => {});
    holoWait.set(key, job);
    return job;
  }

  root.CardRender = { OPT, last: {}, meta_card: (n, r) => { meta.cards[n] = Object.assign(meta.cards[n] || {}, { r: r === 'common' ? undefined : r }); }, meta_set: (k, name) => { meta.skins[k] = Object.assign(meta.skins[k] || {}, { name }); }, init, draw, specFromCard, renderCard, holoLayers, holoFor, holoCached, nameShimmerFor, nameCached, HOLO, getArt, hasArt, loadMeta, loadArtIndex, W, H, _adv: adv, _unitsOf: unitsOf, _paragraphs: paragraphs };
})(typeof window !== 'undefined' ? window : globalThis);
