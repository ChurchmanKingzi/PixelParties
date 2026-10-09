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
  const OPT = { dy: 0, dx: 0, slack: 0, trail: false, step: 0.05, hextra: 0, forcePt: 0, bsteps: 7, silverRim: true, nl: 'space', symDx: 0, symDy: 0 };

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
  ];
  const SYM_FONT = 30, SYM_SPACE = 2;            // `image font size`, `horizontal space` der Symbolschrift
  const SYM_KEY = Object.create(null), SYM_CH = Object.create(null);
  SYMBOLS.forEach(([name, key], i) => { const ch = String.fromCharCode(0xE000 + i); SYM_KEY[ch] = key; SYM_CH[name] = ch; });
  const SYM_RE = new RegExp('\\b(' + SYMBOLS.map(x => x[0]).join('|') + ')\\b', 'g');
  const symbolize = t => String(t == null ? '' : t).replace(SYM_RE, m => SYM_CH[m]);
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
    sapphire: 'rgb(8,211,239)', diamond: 'rgb(145,230,230)', artifact: 'rgb(182,38,0)', sup: 'rgb(255,221,0)',
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
      align: 'center', color: nameColor(spec),
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
    // Diamond: der Rahmen aus dem Template (14 px oben/unten, 15 px links/rechts, Cyan); die Textur darueber entfaellt
    if (spec.rarity === 'diamond') {
      ctx.fillStyle = C.diamond;
      ctx.fillRect(0, 0, W, 14); ctx.fillRect(0, H - 14, W, 14);
      ctx.fillRect(0, 14, 15, H - 28); ctx.fillRect(W - 15, 14, 15, H - 28);
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
    return draw(spec, art);
  }

  root.CardRender = { OPT, last: {}, meta_card: (n, r) => { meta.cards[n] = Object.assign(meta.cards[n] || {}, { r: r === 'common' ? undefined : r }); }, meta_set: (k, name) => { meta.skins[k] = Object.assign(meta.skins[k] || {}, { name }); }, init, draw, specFromCard, renderCard, getArt, hasArt, loadMeta, loadArtIndex, W, H, _adv: adv, _unitsOf: unitsOf, _paragraphs: paragraphs };
})(typeof window !== 'undefined' ? window : globalThis);
