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
  const OVER_GREEN = 'rgb(76,235,112)', OVER_RED = 'rgb(255,72,72)', OVER_OUTLINE = 'rgb(8,6,12)';   // aktuelle Werte: verringert / erhoeht, Kontur
  let TEXT_MASK = false;                      // waehrend `textLayer` gesetzt: aller Text weiss (Maske), siehe `draw(…, textOnly)`
  const INK_TRAIL_U = 200;                    // Vorschub minus Tintenbreite: 1 Schrift-Pixel Abstand hinter jedem Zeichen
  const OPT = { nameOutline: !/[?&]namenkontur=0/.test(typeof location !== 'undefined' ? location.search : ''), boldU: 50, statusOutline: 0.5, dy: 0, dx: 0, slack: 0, trail: false, step: 0.05, hextra: 0, forcePt: 0, bsteps: 7, silverRim: true, nl: 'space', symDx: 0, symDy: 0, symMode: 'rule', hardOutlines: true };

  // ── Schrift: Umrisse und Vorschubbreiten aus cardgen/glyphs.json ──
  // Pixel Intv besteht nur aus Rechtecken, hat kein Kerning und Breiten in Vielfachen von 200 Einheiten.
  // Die Zeichen werden als Pfade gefuellt (statt fillText), damit Lage und Kantenglaettung auf jedem
  // Geraet identisch und auf Bruchteile eines Pixels genau sind.
  let GL = Object.create(null);          // Zeichen -> { d, a, path }
  const SPACE_U = 1000;
  // '*' ist in den Karten ein Aufzaehlungszeichen: im Template ein Symbol-Zeichen ohne Bild, belegt keine Breite.
  const ZERO_WIDTH = '*';
  // Geschuetzter Zwischenraum: so breit wie ein Leerzeichen, aber kein Umbruchpunkt (`wordsOf` trennt nur an ' ') und ohne Zeichen.
  // Er klebt Wendungen zusammen, die nicht ueber zwei Zeilen reissen sollen (card-render.json `glue`, siehe `glueText`).
  const NBSP = '\u00A0';
  /** Wendungen aus card-render.json `glue` (z. B. ["Support Spell"]): die Leerzeichen darin werden geschuetzt, damit „[Symbol] Spell“
   *  im Umbruch ein Block bleibt. Vor `symbolize` angewendet — dessen Muster (`\s+Spells?`) erkennt den geschuetzten Zwischenraum. */
  function glueText(t, phrases) {
    if (!Array.isArray(phrases)) return t;
    for (const ph of phrases) {
      if (typeof ph !== 'string' || !/ /.test(ph)) continue;
      const esc = ph.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ +/g, ' +');
      t = t.replace(new RegExp(esc, 'g'), m => m.replace(/ +/g, NBSP));
    }
    return t;
  }

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
  // Allgemein (Al, 22.10.2026): Ein Schul-Symbol (auch eine Aufzaehlung „[A] or [B]“) bleibt im Umbruch mit „Spell(s)“ EIN Block, damit das Symbol
  // nie allein am Zeilenende steht („Support Spell“, „Decay or Support Spells“). Laeuft NACH dem Ersetzen der Namen durch Symbolzeichen,
  // damit mehrteilige Namen („Support Magic“) vorher noch normal erkannt werden.
  const GLUE_SYM_RE = /[\uE000-\uE0FF](?:(?:\s*,\s*|\s+(?:or|and)\s+)[\uE000-\uE0FF])*\s+Spells?\b/g;
  const symbolize = t => {
    t = String(t == null ? '' : t);
    if (OPT.symMode === 'none') return t;
    t = t.replace(OPT.symMode === 'all' ? SYM_RE_ALL : SYM_RE, m => SYM_CH[m]);
    if (OPT.symMode === 'all') return t;
    t = t.replace(SYM_FIGHT_RE, SYM_CH['Fighting']).replace(SYM_FIGHT_USE_RE, '$1' + SYM_CH['Fighting'] + ' ');
    return t.replace(GLUE_SYM_RE, m => m.replace(/\s+/g, NBSP));
  };
  // ── Statuseffekte im Regeltext (Als Vorgabe 20.10.) ──
  // Poison lila, Burn orange, Stun gelb, Negate grau, Bleed rot, Freeze eisblau, Blind mint: fett und farbig — aber NUR im Effekttext
  // (`drawBlock`), nie in Namen. Auch Kartennamen im Text bleiben unberuehrt: sie stehen in Anfuehrungszeichen („Poison Vial“,
  // „Rafflesia, the Poison Princess“, „Terror“), und alles zwischen Anfuehrungszeichen wird nicht gefaerbt.
  // `hell` steht auf dunklen und mittleren Textboxen (mit dunkler Kontur), `dunkel` auf hellen (Artifacts, Tokens, … — ohne Kontur, nur so
  // weit abgedunkelt, wie der Kontrast zum Untergrund es verlangt). Welcher Ton gilt, entscheidet `statusDarstellung` je Textbox anhand
  // ihrer tatsaechlichen Farbe (`boxHintergrund`), nicht nach Kartentyp: so liest sich jedes Wort auf jedem Rahmen. `fest` (Blind, weiss)
  // behaelt seinen Ton immer. Die Tooltips des Spiels lesen dieselbe Tabelle (`CardRender.STATUS_TERMS` / `statusMatches`).
  const STATUS_TERMS = [
    { key: 'poison', label: 'Poisoned', re: 'poison(?:s|ed|ing)?',        hell: '#c98aff', dunkel: '#7a2bd0' },
    { key: 'burn',   label: 'Burned',  re: 'burn(?:s|ed|ing)?',          hell: '#ff9b3a', dunkel: '#cf5f00' },
    { key: 'stun',   label: 'Stunned', re: 'stun(?:s|ned)?',             hell: '#ffe23d', dunkel: '#a87c00' },
    { key: 'negate', label: 'Negate', re: 'negat(?:e|es|ed|ing|ion)',   hell: '#9aa3b6', dunkel: '#59606e' },
    { key: 'bleed',  label: 'Bleeding', re: 'bleed(?:s|ing)?',            hell: '#ff5c5c', dunkel: '#c0141c' },
    { key: 'freeze', label: 'Frozen',  re: 'freez(?:e|es|ing)|frozen',   hell: '#7fdfff', dunkel: '#1788bd' },
    { key: 'blind',  label: 'Blinded', re: 'blind(?:s|ed)?',             hell: '#ffffff', dunkel: '#ffffff', fest: true },   // weiss (Als Vorgabe 20.10.), immer mit dunkler Kontur
  ];
  const STATUS_IDX = Object.create(null);
  STATUS_TERMS.forEach((t, i) => { STATUS_IDX[t.key] = i; });
  const STATUS_RE = new RegExp('\\b(?:' + STATUS_TERMS.map(t => '(' + t.re + ')').join('|') + ')\\b', 'gi');
  // „Fett“ in Pixel Intv: die Schrift hat 2 Pixel dicke Staemme, 1 Pixel duenne Balken und ueberall 1 Pixel breite Luecken (Counter)
  // — jedes Verbreitern um ein ganzes Schrift-Pixel (200 Einheiten) schliesst sie, aus „Frozen“ wird „Froze■“. Deshalb: das Zeichen
  // doppelt, nur `OPT.boldU` (50 = ein Viertel Schrift-Pixel, gut ein Bildpixel) versetzt und um dasselbe weiter vorgeschoben, dazu eine
  // dunkle Kontur von `OPT.statusOutline` Schrift-Pixeln (8 Richtungen) — die Woerter stehen kraeftig und scharf vor jedem Untergrund.
  /** Statusbegriffe in `text` ausserhalb von Anfuehrungszeichen: [{ start, end, key }] */
  function statusMatches(text) {
    const t = String(text == null ? '' : text), out = [], quoted = [];
    t.replace(/"[^"]*"/g, (m, i) => { quoted.push([i, i + m.length]); return m; });
    STATUS_RE.lastIndex = 0;
    let m;
    while ((m = STATUS_RE.exec(t))) {
      const a = m.index, b = a + m[0].length;
      if (quoted.some(([x, y]) => a >= x && b <= y)) continue;
      // „… cannot be negated“ nennt einen Schutz, keinen Status: nicht hervorheben (Als Vorgabe 20.10.)
      if (/\b(?:cannot|can't|can not) be\s+$/i.test(t.slice(Math.max(0, a - 16), a)) && /^negat/i.test(m[0])) continue;
      let k = 1;
      while (k < m.length && m[k] === undefined) k++;
      out.push({ start: a, end: b, key: STATUS_TERMS[k - 1].key });
    }
    return out;
  }
  // Kontrast nach WCAG (Verhaeltnis der relativen Leuchtdichten), fuer die Wahl des Tons je Untergrund
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const linC = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const leucht = c => 0.2126 * linC(c[0]) + 0.7152 * linC(c[1]) + 0.0722 * linC(c[2]);
  const kontrast = (a, b) => { const x = leucht(a), y = leucht(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const STATUS_MIN_CONTRAST = 4.5, STATUS_MAX_DARKEN = 0.6;      // so weit darf ein dunkler Ton abgedunkelt werden, bevor die helle Fassung gilt
  const STATUS_DISTINCT = 2.2, STATUS_EDGE = 3;                  // Mindestabstand des hellen Tons zum Untergrund; Mindestkontrast der Kontur zum Untergrund
  const OUT_DARK = 'rgb(8,6,12)', OUT_LIGHT = 'rgb(255,248,232)', OUT_DARK_RGB = [8, 6, 12], OUT_LIGHT_RGB = [255, 248, 232];
  /** Mittlere Farbe der Textbox, BEVOR Text darauf kommt (Fuellung des Rahmens); null, wenn nicht lesbar (Textmaske, kein Rahmen). */
  function boxHintergrund(ctx, o) {
    if (TEXT_MASK) return null;
    try {
      const x = Math.round(o.left + o.width * 0.1), y = Math.round(o.top + o.height * 0.1);
      const w = Math.max(1, Math.round(o.width * 0.8)), h = Math.max(1, Math.round(o.height * 0.8));
      const d = ctx.getImageData(x, y, w, h).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 5) { if (d[i + 3] < 200) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      return n > 40 ? [r / n, g / n, b / n] : null;
    } catch (e) { return null; }
  }
  /** Darstellung eines Begriffs auf diesem Untergrund: { color, outline: null | OUT_DARK | OUT_LIGHT }. Der Reihe nach:
   *   1. heller Untergrund (Artifacts): der tiefe Ton, bei Bedarf abgedunkelt, ohne Kontur;
   *   2. der helle Ton mit dunkler Kontur, wenn er sich vom Untergrund abhebt (der Normalfall auf dunklen und mittleren Boxen);
   *   3. gleicher Farbton wie der Untergrund (Bleed auf Rot, Poison auf Lila, Negate auf Grau): der tiefe Ton mit heller Kontur;
   *   4. Rueckfall: der helle Ton mit dunkler Kontur.
   *  `fest` (Blind, weiss) behaelt Ton und dunkle Kontur immer. `light`: Rueckfall ohne Messung. */
  function statusDarstellung(term, bg, light) {
    if (term.fest) return { color: term.hell, outline: OUT_DARK };
    if (!bg) return light ? { color: term.dunkel, outline: null } : { color: term.hell, outline: OUT_DARK };
    const dunkel = hexRgb(term.dunkel);
    const abgedunkelt = (von, bis) => { for (let f = von; f >= bis - 1e-9; f -= 0.05) { const c = dunkel.map(v => Math.round(v * f)); if (kontrast(c, bg) >= STATUS_MIN_CONTRAST) return c; } return null; };
    const tief = abgedunkelt(1, STATUS_MAX_DARKEN);
    if (tief) return { color: 'rgb(' + tief.join(',') + ')', outline: null };
    if (kontrast(hexRgb(term.hell), bg) >= STATUS_DISTINCT) return { color: term.hell, outline: OUT_DARK };
    if (kontrast(OUT_LIGHT_RGB, bg) >= STATUS_EDGE && kontrast(dunkel, OUT_LIGHT_RGB) >= STATUS_MIN_CONTRAST - 1) return { color: term.dunkel, outline: OUT_LIGHT };
    return { color: term.hell, outline: OUT_DARK };
  }
  /** Stil je Zeichen eines Absatzes (Index in STATUS_TERMS + 1, sonst 0); null ohne Treffer. */
  function statusStyles(p) {
    if (OPT.status === false) return null;
    const ms = statusMatches(p);
    if (!ms.length) return null;
    const st = new Array(p.length).fill(0);
    for (const m of ms) for (let i = m.start; i < m.end; i++) st[i] = STATUS_IDX[m.key] + 1;
    return st;
  }

  let symSize = 8.5;                              // Symbolgroesse des Textfelds, das gerade gesetzt wird
  function symAdv(ch) {                           // Breite in Font-Einheiten (haengt nicht von der Schriftgroesse ab)
    const r = sprites && sprites.rects['sym.' + SYM_KEY[ch]];
    if (!r) return 1400;
    return (r[2] * 10 + SYM_SPACE) * (symSize / SYM_FONT) * UPM / (20 * PT);
  }

  // Das „X" der variablen Kosten („4X", „X"): das Grossbuchstaben-X der Schrift ist 7 Schrift-Pixel hoch, die Ziffern nur 6 — beide
  // stehen auf derselben Grundlinie, das X ragte also oben einen Pixel heraus („etwas hoeher als die Zahlen", Als Befund 19.10.).
  // Fuer gedruckte Kosten gibt es deshalb ein X in Ziffernhoehe (6 Reihen, gleiche Strichstaerke, Pixelraster 200 Einheiten):
  //   XX..XX / .XXXX. / ..XX.. / ..XX.. / .XXXX. / XX..XX
  // Es liegt unter einem Zeichen aus dem privaten Bereich und wird nur ueber `drawLine(…, { costX: true })` eingesetzt.
  const COST_X = '\uE0F0';
  function costXPath() {
    const reihen = [[[0, 400], [800, 1200]], [[200, 1000]], [[400, 800]], [[400, 800]], [[200, 1000]], [[0, 400], [800, 1200]]];   // von unten nach oben
    return reihen.map((runs, i) => runs.map(([x0, x1]) => `M${x0} ${i * 200}L${x1} ${i * 200}L${x1} ${i * 200 + 200}L${x0} ${i * 200 + 200}Z`).join('')).join('');
  }

  function adv(ch) {
    if (ch === ' ' || ch === NBSP) return SPACE_U;
    if (ZERO_WIDTH.includes(ch)) return 0;
    if (SYM_KEY[ch]) return symAdv(ch);
    const g = GL[ch];
    return g ? g.a : 1400;
  }
  function unitsOf(s, st) { let n = 0, i = 0; for (const c of s) { n += adv(c) + (st && st[i] ? OPT.boldU : 0); i += c.length; } return n; }
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
      GL[COST_X] = { a: 1400, d: costXPath() };
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
    return t.split('\n').map(p => p.trim()).filter(Boolean).map(wordsOf);
  }
  // Absatz -> Woerter { s, u, st }; `st` (Stil je Zeichen, Statusbegriffe) nur an Woertern mit Treffer
  function wordsOf(p) {
    const st = statusStyles(p), out = [], re = / +/g;
    let a = 0, m;
    const push = b => {
      if (b <= a) return;
      const s = p.slice(a, b), w = st ? st.slice(a, b) : null, has = !!(w && w.some(Boolean));
      out.push({ s, st: has ? w : null, u: unitsOf(s, has ? w : null) });
    };
    while ((m = re.exec(p))) { push(m.index); a = m.index + m[0].length; }
    push(p.length);
    return out;
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
    const paras = paragraphs(symbolize(glueText(String(text == null ? '' : text), o.glue)), o.soft);
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
    ctx.fillStyle = TEXT_MASK ? '#fff' : o.color;
    // Statusbegriffe: Darstellung je Begriff nach der echten Farbe dieser Textbox (vor dem ersten Buchstaben gemessen)
    const bgBox = lines.some(l => l.words.some(w => w.st)) ? boxHintergrund(ctx, o) : null;
    const darst = STATUS_TERMS.map(t => statusDarstellung(t, bgBox, o.light));
    root.CardRender.last.bg = bgBox; root.CardRender.last.darst = darst;
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
        const word = l.words[wi];
        let ci = 0;
        for (const ch of word.s) {
          const sty = word.st ? word.st[ci] : 0;
          ci += ch.length;
          if (SYM_KEY[ch]) putSymbol(ctx, ch, x, y, pt);
          else if (sty) {
            // Statusbegriff: dunkle Kontur, dann Farbe der Tabelle (in der Textmaske bleibt es weiss), fett = zweimal, leicht versetzt
            const dd = darst[sty - 1];
            if (OPT.statusOutline && dd.outline && !TEXT_MASK) {
              const d = OPT.statusOutline * 200 * k;
              ctx.fillStyle = dd.outline;
              for (const [ox, oy] of [[-d, 0], [d, 0], [0, -d], [0, d], [-d, -d], [d, -d], [-d, d], [d, d]]) {
                putGlyph(ctx, ch, x + OPT.dx + ox, y + oy, k, 1);
                if (OPT.boldU) putGlyph(ctx, ch, x + OPT.dx + OPT.boldU * k + ox, y + oy, k, 1);
              }
            }
            if (!TEXT_MASK) ctx.fillStyle = dd.color;
            putGlyph(ctx, ch, x + OPT.dx, y, k, 1);
            if (OPT.boldU) putGlyph(ctx, ch, x + OPT.dx + OPT.boldU * k, y, k, 1);
            if (!TEXT_MASK) ctx.fillStyle = o.color;
          } else putGlyph(ctx, ch, x + OPT.dx, y, k, 1);
          x += (adv(ch) + (sty ? OPT.boldU : 0)) * k;
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
    const lines = String(text == null ? '' : text).split('\n').map(l => l.trim()).filter(Boolean).map(l => o.costX ? l.replace(/X/g, COST_X) : l);
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
    ctx.fillStyle = TEXT_MASK ? '#fff' : o.color;
    lines.forEach((line, li) => {
      // `ink`: nur die sichtbare Tinte zaehlt, nicht der Abstand hinter dem letzten Zeichen (1 Schrift-Pixel,
      // INK_TRAIL_U). Sonst sitzt eine zentrierte Zahl um ein halbes Schrift-Pixel zu weit links in ihrer Box.
      const u = unitsOf(line), natural = (u - (o.ink ? INK_TRAIL_U : 0)) * k;
      const sx = natural > o.width ? o.width / natural : 1;
      const w = natural * sx;
      let x = o.left;
      if (o.align === 'center') x = o.left + (o.width - w) / 2;
      else if (o.align === 'right') x = o.left + o.width - w;
      const y = top + li * pitch + em * ASC / UPM + OPT.dy;
      const paint = (ox, oy) => {
        let cx = x + OPT.dx + ox;
        for (const ch of line) { putGlyph(ctx, ch, cx, y + oy, k, sx); cx += adv(ch) * k * sx; }
      };
      // `outline`: dunkle Kontur um die Zahl (8 Richtungen, 0,7 Schrift-Pixel) — hebt farbige Werte (gruen/rot) auf jedem Rahmen ab
      if (o.outline && !TEXT_MASK) {
        const d = Math.max(2, Math.round(pt * PT * 200 / UPM * 0.7));
        ctx.fillStyle = o.outline;
        for (const [ox, oy] of [[-d, 0], [d, 0], [0, -d], [0, d], [-d, -d], [d, -d], [-d, d], [d, d]]) paint(ox, oy);
        ctx.fillStyle = TEXT_MASK ? '#fff' : o.color;
      }
      paint(0, 0);
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
  /** TEST (Al, 23.10.): Kontur der Kartennamen in einem dunkleren Ton der jeweiligen Karte — aus der Namensplatte des Rahmens abgetastet
   *  (mittlerer Farbwert eines Streifens am Rand der Platte, wo selten Schrift steht), auf 38 % Helligkeit abgedunkelt. Schalter: `OPT.nameOutline`
   *  (Standard an; `?namenkontur=0` in der Adresse schaltet aus). */
  function nameOutlineColor(ctx, sup) {
    try {
      const x0 = sup ? 56 : 108, ys = [62, 70, 78, 86, 94];
      const px = ys.map(y => Array.from(ctx.getImageData(x0, y, 1, 1).data));
      const hell = c => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
      px.sort((a, b) => hell(a) - hell(b));
      const m = px[Math.floor(px.length / 2)];
      return 'rgb(' + [0, 1, 2].map(i => Math.round(m[i] * 0.38)).join(',') + ')';
    } catch (e) { return null; }
  }
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

  // Gold-/Silber-/Diamant-Rahmen einer Karte (Schritt 6 von `draw`); auch fuer die Rahmenmaske des Rahmenglanzes (`rimLayer`)
  function drawRim(ctx, spec) {
    const t = spec.type;
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
  }

  // Bildmaske der Vollbild-Karten mit VOLL DECKENDEN Umrissen. Die Masken des Templates (`mask.fullart`, `mask.hero`) haben drei
  // Stufen: 0 = Umrisslinie der Boxen (Bild verdeckt, Rahmen voll sichtbar), 51 = Fuellung der Boxen (das Bild scheint zu
  // 20 % durch), 255 = Bildflaeche. Direkt INNEN an der Umrisslinie liegen aber noch die Bevel-Zeilen der Box (dunkle und
  // helle Innenkante) auf Stufe 51 — durch sie schien das Bild und machte die Umrandung fleckig. Hier werden sie hart:
  // Pixel im Abstand 1 zur Umrisslinie werden 0, im Abstand 2 jene, die nicht die Fuellfarbe der Box haben (zweite
  // Bevel-Zeile). Die Fuellung weiter innen (samt Dithering) bleibt halbtransparent. Einmal je Maske gerechnet (75x105 Pixel).
  const HARD_FRAME = { 'mask.fullart': 'frame.fullartHero', 'mask.hero': 'frame.superhero' };
  const hardMasks = new Map();
  function hardMask(maskKey) {
    if (hardMasks.has(maskKey)) return hardMasks.get(maskKey);
    let out = null;
    const mr = sprites.rects[maskKey], fr = sprites.rects[HARD_FRAME[maskKey]];
    if (HARD_FRAME[maskKey] && mr && fr && mr[2] === fr[2] && mr[3] === fr[3]) {
      const w = mr[2], h = mr[3];
      const read = r => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(sprites.img, r[0], r[1], w, h, 0, 0, w, h); return { g, im: g.getImageData(0, 0, w, h) }; };
      const m = read(mr), f = read(fr), a = m.im.data, c = f.im.data;
      const col = i => (c[i * 4] << 16) | (c[i * 4 + 1] << 8) | c[i * 4 + 2];
      // Fuellfarbe der Boxen = haeufigste Farbe auf Stufe 51
      const cnt = new Map();
      for (let i = 0; i < w * h; i++) if (a[i * 4 + 3] > 0 && a[i * 4 + 3] < 255) cnt.set(col(i), (cnt.get(col(i)) || 0) + 1);
      let fill = -1, best = 0;
      for (const [k, v] of cnt) if (v > best) { best = v; fill = k; }
      const zero = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] === 0;
      const near = (x, y, d) => { for (let yy = y - d; yy <= y + d; yy++) for (let xx = x - d; xx <= x + d; xx++) if (zero(xx, yy)) return true; return false; };
      const drop = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, al = a[i * 4 + 3];
        if (al === 0 || al === 255) continue;
        if (near(x, y, 1) || (col(i) !== fill && near(x, y, 2))) drop.push(i);
      }
      for (const i of drop) a[i * 4 + 3] = 0;
      m.g.putImageData(m.im, 0, 0);
      out = m.g.canvas;
    }
    hardMasks.set(maskKey, out);
    return out;
  }
  /** Maske des Bildfelds auf `lc` (destination-in), Vollbild-Karten mit deckenden Umrissen (OPT.hardOutlines). */
  function artMaskSprite(lc, maskKey, dw, dh) {
    const hm = OPT.hardOutlines ? hardMask(maskKey) : null;
    if (hm) { lc.imageSmoothingEnabled = false; lc.drawImage(hm, 0, 0, hm.width, hm.height, 0, 0, dw, dh); }
    else sprite(lc, maskKey, 0, 0, dw, dh);
  }

  // ═════════════ Stufe einer Ability hervorheben ═════════════
  // Fähigkeitskarten (`skill3`) haben drei Textboxen, je eine pro Stufe. Steht die Karte auf dem Brett, hebt `stufe` (1–3) die
  // Box ihrer aktuellen Stufe hervor (etwas heller, schmale blasse Kante) und graut die beiden anderen aus (teilentsaettigt, leicht
  // abgedunkelt). Erste Fassung: goldene 10-px-Kante und Dunkelheit .58 — „Grayout etwas zu dunkel, Rahmen zu praegnant"
  // (Als Befund 19.10.), daher jetzt 5 px, blasses Gold mit Deckkraft .55 und Dunkelheit .30.
  // Innenflaechen der Boxen im Rahmenraster (Kartenpixel): x 70–680, y 600–730 / 740–870 / 880–1000.
  const STUFEN_BOXEN = [[600, 130], [740, 130], [880, 120]];
  const STUFE = {
    heller: 'rgba(255,255,255,.10)',          // aktive Box: Aufhellung
    kante: 'rgba(255,238,160,.55)', kanteDicke: 5,
    grau: .8,                                  // inaktive Box: Anteil der Entsaettigung (0–1)
    dunkel: 'rgba(14,12,26,.30)',              // inaktive Box: Abdunklung
  };
  function markStufe(ctx, stufe) {
    const X = 70, B = 610, d = STUFE.kanteDicke;
    STUFEN_BOXEN.forEach(([y, h], i) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(X, y, B, h); ctx.clip();
      if (i + 1 === stufe) {
        ctx.fillStyle = STUFE.heller; ctx.fillRect(X, y, B, h);
        ctx.fillStyle = STUFE.kante;
        ctx.fillRect(X, y, B, d); ctx.fillRect(X, y + h - d, B, d); ctx.fillRect(X, y + d, d, h - 2 * d); ctx.fillRect(X + B - d, y + d, d, h - 2 * d);
      } else {
        ctx.globalAlpha = STUFE.grau;
        ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(X, y, B, h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = STUFE.dunkel; ctx.fillRect(X, y, B, h);
      }
      ctx.restore();
    });
  }

  // ═════════════ Karte zeichnen ═════════════
  // spec: { type, rarity, name, text, skillBox, skillBox2, hp, atk, level, school, kind }
  // art:  { src: CanvasImageSource, sx, sy, sw, sh } | null
  function draw(spec, art, target, textOnly) {
    if (!sprites) throw new Error('CardRender.init() fehlt');
    const t = spec.type;
    const cv = target || document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    // 1) Rahmen
    if (!textOnly) sprite(ctx, 'frame.' + t, 0, 0, W, H);

    // 2) Kunst, gestreckt in ihr Feld und mit der Maske des Rahmens beschnitten
    if (art && !textOnly) {
      const full = isFullart(t);
      const box = full ? [0, 0, W, H] : [70, 170, 610, 400];
      const maskKey = t === 'superhero' ? 'mask.hero' : t === 'fullartHero' ? 'mask.fullart' : 'mask.art';
      const layer = document.createElement('canvas');
      layer.width = box[2]; layer.height = box[3];
      const lc = layer.getContext('2d');
      lc.imageSmoothingEnabled = false;
      lc.drawImage(art.src, art.sx || 0, art.sy || 0, art.sw || art.src.width, art.sh || art.src.height, 0, 0, box[2], box[3]);
      lc.globalCompositeOperation = 'destination-in';
      artMaskSprite(lc, maskKey, box[2], box[3]);
      ctx.drawImage(layer, box[0], box[1]);
    }

    // 3) Namenszeile (z 2) — Superhelden: breiter
    const sup = isSuperhero(t);
    if (!textOnly) drawLine(ctx, spec.name, {
      left: sup ? 48 : 103, top: 48, width: sup ? 654 : 544, height: 55, size: 50, min: 48,
      align: 'center', color: spec.nameGold ? goldFill(ctx, 48, 55) : nameColor(spec),
      outline: OPT.nameOutline && !isArti2(t) ? nameOutlineColor(ctx, sup) : null,   // Artifacts: dunkle Schrift auf heller Platte — dort keine dunkle Kontur
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
      if (spec.school && !textOnly) sprite(ctx, 'school.' + spec.school, 0, 550, 110, 110);
      // `lvOver`: aktuelle Stufe (Hand: Rabatt gruen, Zuschlag rot), mit dunkler Kontur
      if (spec.level != null || spec.lvOver != null) drawLine(ctx, String(spec.lvOver != null ? spec.lvOver : spec.level), {
        left: 650, top: 550, width: 110, height: 110, size: 65, min: 1, align: 'center', vAlign: 'middle',
        color: spec.lvOver != null ? spec.lvColor : levelColor(spec), outline: spec.lvOver != null ? OVER_OUTLINE : null,
      });
    }
    // Kartenart-Symbol unten links (Falle, Reaktion, Flaeche, Anhang)
    if (!textOnly && spec.kind && (t === 'spell' || t === 'summon' || t === 'potion' || t === 'artifact')) {
      sprite(ctx, 'kind.' + spec.kind, 0, 950, 100, 100);
    }

    // 6) Goldene Rahmenelemente (die uebrigen Foil-Layer entfallen)
    if (!textOnly) drawRim(ctx, spec);

    // 7) Werte (HP, Angriff / Kosten) — `noHp` / `noAtk`: die Zahl weglassen (Brett: dort liegt der Live-Wert darueber)
    const stat = statColor(spec);
    if (isHero3(t) || sup || t === 'summon' || t === 'tokenCreature' || t === 'artifactCreature') {
      // Helden ohne feste Werte (Ascended Hero „stats equal its base Hero's“) zeigen „?“ in beiden Feldern
      const unknown = isHero3(t) || sup;
      // Helden: die Zahlen stehen exakt mittig in ihren Feldern (HP-Feld x 180–380, Angriffs-Feld x 470–670 im
      // Rahmen) — egal, wie viele Stellen sie haben. Frueher lagen sie ~18 px zu weit innen (HP zu weit rechts,
      // ATK zu weit links). Boss-Rahmen: unveraendert.
      const heroBox = (isHero3(t) || sup) && t !== 'boss';
      if (!spec.noHp && (spec.hp != null || unknown)) drawLine(ctx, spec.hp != null ? String(spec.hp) : '?', {
        left: heroBox ? 180 : t === 'artifactCreature' ? 240 : (t === 'summon' || t === 'tokenCreature') ? 275 : t === 'boss' ? 160 : 201,
        top: 984, width: heroBox ? 200 : 194, height: 60, size: 38, min: 1, align: 'center', color: stat, ink: heroBox,
      });
    }
    if (isHero3(t) || sup || t === 'summon' || isArti2(t)) {
      const heroBox = (isHero3(t) || sup) && t !== 'boss';
      // `costOver`: aktuelle Kosten eines Artifacts (sitzen im Wertefeld der Mitte), gruen/rot mit dunkler Kontur
      const kostet = isArti2(t) && spec.costOver != null;
      if (!spec.noAtk && (spec.atk != null || kostet || isHero3(t) || sup)) drawLine(ctx, kostet ? String(spec.costOver) : spec.atk != null ? String(spec.atk) : '?', {
        left: heroBox ? 470 : t === 'artifact' ? 296 : 504, top: 984, width: heroBox ? 200 : isArti2(t) ? 150 : 94,
        height: 60, size: 38, min: 1, align: 'center', color: kostet ? spec.costColor : stat, ink: heroBox,
        outline: kostet ? OVER_OUTLINE : null, costX: isArti2(t),
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
        size: 20, min: 7, align: 'justify', vAlign: 'middle', lineHeight: 1, color: ruleColor(spec), main: true, soft: spec.soft, glue: spec.glue,
        light: isArti2(t) || isToken(t),                 // helle Textbox (dunkle Schrift): dunkle Statusfarben
      });
    }

    if (t === 'skill3' && !textOnly && spec.stufe >= 1 && spec.stufe <= 3) markStufe(ctx, spec.stufe);

    // 9) Seltenheits-Stempel unten rechts
    const stamp = STAMP[spec.rarity];
    if (stamp && !textOnly) {
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
      glue: Array.isArray(meta.glue) ? meta.glue : null,   // Wendungen, die im Umbruch zusammenbleiben („Support Spell“ -> [Symbol] Spell in einer Zeile)
      abilities: type === 'skill3' ? abilityTexts(c.effect) : null,
      skillBox: meta.sb != null ? meta.sb : hero ? (c.startingAbility1 || '/') : asc ? [c.startingAbility1, c.startingAbility2].filter(Boolean).join('\n') : '',
      skillBox2: meta.sb2 != null ? meta.sb2 : (hero ? (c.startingAbility2 || '/') : ''),   // Helden ohne Start-Abilities (Quetzahuitl): Schrägstrich = „nicht vorhanden“
      // Artifacts: die Kosten stehen im Wertefeld der Mitte. Variable Kosten tragen `costLabel` („4X", „5X", „X") — es wird gedruckt
      // statt der Zahl in `cost` (die der Server weiter rechnet).
      hp: c.hp, atk: type === 'artifact' || type === 'artifactCreature' ? (c.costLabel || c.cost) : c.atk,
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
  let metaReady = false;               // Metadaten geladen (Voraussetzung fuer Entscheidungen nach Kartentyp)
  async function loadMeta(url) {
    try { meta = await fetch(url || '/data/card-render.json').then(r => r.json()); } catch (e) { /* ohne Metadaten: alles Common */ }
    meta.cards = meta.cards || {}; meta.skins = meta.skins || {};
    metaReady = true;
    return meta;
  }

  /**
   * Komplette Karte als Canvas.
   * @param {object} card  Karte aus cards.json
   * @param {object} [o]   { skin: Skin-Name } — Skins zeigen dieselbe Karte mit eigener Kunst und eigenem Namen
   *                       { hp: Zahl } — druckt diese HP statt der aus cards.json (Tooltip: aktuelle max. HP)
   *                       { noHp, noAtk: true } — laesst die gedruckte HP bzw. ATK weg (Brett: Live-Werte darueber)
   *                       { lv, kost: Zahl } — druckt diese aktuelle Stufe / Kosten (Hand): gruen = verringert, rot = erhoeht
   *                       { stufe: 1–3 } — Fähigkeitskarte: hebt die Box dieser Stufe hervor, die anderen beiden grau (Brett, Tooltip)
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
    if (o.hp != null) spec.hp = o.hp;
    if (o.noHp) spec.noHp = true;
    if (o.stufe >= 1 && o.stufe <= 3) spec.stufe = o.stufe;
    if (o.noAtk) spec.noAtk = true;
    // aktuelle Stufe / Kosten (Hand): gruen, wenn niedriger als gedruckt, rot, wenn hoeher; gleich -> unveraendert gedruckt
    if (o.lv != null && card.level != null && o.lv !== card.level) { spec.lvOver = o.lv; spec.lvColor = o.lv < card.level ? OVER_GREEN : OVER_RED; }
    // Variable Kosten („4X"): das X bleibt dran (aus 4X wird 8X); ein reines „X" hat keine Zahl, die man ersetzen koennte.
    if (o.kost != null && card.cost != null && o.kost !== card.cost && (!card.costLabel || /^\d/.test(card.costLabel))) {
      spec.costOver = o.kost + (card.costLabel ? String(card.costLabel).replace(/^\d+/, '') : '');
      spec.costColor = o.kost < card.cost ? OVER_GREEN : OVER_RED;
    }
    // Skin-Holo: der Name steht golden auf der Karte (siehe unten, HOLO-TEXTUR); die schillernden Schichten
    // darueber zeichnet das Spiel als eigene DOM-Lage (SkinHolo in app-shared.jsx).
    if (skin && holoOn(skin)) spec.nameGold = true;
    return draw(spec, art);
  }

  // ═════════════ DAUERHAFTER CACHE (IndexedDB) ═════════════
  //  Karten entstehen im Browser (siehe oben). Ohne Gedaechtnis muss nach JEDEM Refresh jede sichtbare Karte neu gezeichnet und als
  //  PNG kodiert werden (gemessen ~35-60 ms je Karte, auf dem Handy ein Vielfaches). Darum heben `card-image-shim.js` und die
  //  Foil-Funktionen unten ihre fertigen Bilder/Texturen als Blobs in IndexedDB auf und holen sie beim naechsten Besuch zurueck.
  //
  //  GUELTIGKEIT: der Server liefert einen Fingerabdruck aller Dateien, aus denen Karten entstehen (`/api/render-version`,
  //  render-version.js). Weicht der gemerkte Wert vom aktuellen ab, wird der ganze Vorrat verworfen — Updates gelten sofort,
  //  wie es server.js vorgibt. Ohne Version (Server alt, Fehler) oder ohne IndexedDB (privates Fenster, gesperrt) bleibt alles
  //  beim Alten: gezeichnet wird dann wie bisher, nur eben jedes Mal.
  //  GRENZE: hoechstens PC_MAX Byte (alle ~1.200 Karten waeren ~110 MB; gemerkt wird nur, was je angezeigt wurde). Ein
  //  Schreibfehler (Speicher voll) schaltet das Merken fuer die Sitzung ab.
  const PC = { db: null, on: false, used: 0, hits: 0, puts: 0, full: 0 };
  const PC_MAX = 170 * 1048576;
  const idbReq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const idbDone = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); });
  /** Cache oeffnen; bei neuer Render-Version den alten Vorrat leeren. @returns {Promise<boolean>} true, wenn gemerkt wird */
  async function openCache(version) {
    PC.on = false; PC.db = null;
    if (!version || typeof indexedDB === 'undefined') return false;
    try {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('pp-render-cache', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blockiert'));
      });
      const old = await idbReq(db.transaction('kv', 'readonly').objectStore('kv').get('__v'));
      if (old !== version) {
        const tx = db.transaction('kv', 'readwrite'), st = tx.objectStore('kv');
        st.clear(); st.put(version, '__v');
        await idbDone(tx);
      }
      PC.db = db; PC.used = 0; PC.on = true;
      try { const e = await navigator.storage.estimate(); PC.used = e.usage || 0; if (e.quota && e.quota < 64 * 1048576) PC.on = false; } catch (e) { /* ohne Schaetzung: ohne Pruefung */ }
    } catch (e) { PC.on = false; }
    return PC.on;
  }
  /** Gemerkten Wert holen (Blob, Objekt mit Blobs …) oder null. */
  function cacheGet(key) {
    if (!PC.on) return Promise.resolve(null);
    return new Promise(res => {
      try {
        const r = PC.db.transaction('kv', 'readonly').objectStore('kv').get(key);
        r.onsuccess = () => { if (r.result != null) PC.hits++; res(r.result == null ? null : r.result); };
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  /** Wert merken (ohne zu warten). `size` = grobe Groesse in Byte fuer die Obergrenze. */
  function cachePut(key, val, size) {
    if (!PC.on) return;
    size = size || 0;
    if (PC.used + size > PC_MAX) { PC.full++; return; }
    try {
      const tx = PC.db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(val, key);
      tx.onabort = tx.onerror = () => { PC.used -= size; if (tx.error && /quota/i.test(tx.error.name + ' ' + tx.error.message)) PC.on = false; };
      PC.used += size; PC.puts++;
    } catch (e) { PC.on = false; }
  }
  function cacheDel(key) {
    if (!PC.on) return;
    try { PC.db.transaction('kv', 'readwrite').objectStore('kv').delete(key); } catch (e) { /* egal */ }
  }
  function cacheStats() { return { on: PC.on, hits: PC.hits, puts: PC.puts, voll: PC.full, belegtMB: +(PC.used / 1048576).toFixed(1) }; }

  // ═════════════ HOLO FUER SKINS UND FOIL-NAMEN ═════════════
  //  Skin-Karten bekommen ein eigenes Foil, das NUR Kunst und Namen betrifft (Rahmen, Werte und Text bleiben
  //  ruhig). Der Name steht golden auf der Karte; Super Rare und Diamond Rare tragen denselben Namensglanz.
  //
  //  Die KUNST bekommt eine feine Schraffur und ein periodisch ueberlaufendes Glanzband. Beides liegt nur auf den
  //  helleren Flaechen des Bildes — dunkle Pixel (Umrisse, Schatten) bleiben unberuehrt, die Zeichnung bleibt scharf.
  //  Dafuer rechnet `holoLayers` eine MASKE aus dem NATIVEN Pixelraster der Kunst (meist 76x51): je Pixel eine
  //  Staerke aus seiner Helligkeit und Saettigung (Graustufen schwaecher), Pixel fuer Pixel auf die Kunst ausgerichtet
  //  (gleiche Streckung wie `draw`, nearest neighbour, keine Unschaerfe). Schraffur und Glanz selbst sind CSS.
  //  Heraus kommen zwei PNG-Blobs: `all` (die Maske) und `nameMask` (Umriss der Namensbuchstaben); das Spiel legt sie
  //  als CSS-Masken an die richtige Stelle (SkinHolo, app-shared.jsx).
  const HOLO = {
    on: true,
    dark: 0.16,          // unterhalb dieser Helligkeit (0..1) liegt nichts auf einem Pixel (Umrisse, Schatten)
    full: 0.46,          // ab dieser Helligkeit volle Staerke
    neutral: 0.50,       // Staerke fuer Graustufen (Farben: bis 1,0, je nach Saettigung)
    allText: true,       // Super/Diamond Rares: auch aller uebrige Text (nicht nur der Name) bekommt den Glanz (Grossansichten)
  };
  /** Gilt das Holo fuer diesen Skin? (`data/card-render.json` -> skins[Name].holo = false schaltet es ab) */
  function holoOn(skinMeta) { return HOLO.on && !(skinMeta && skinMeta.holo === false); }

  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  /** Telefon im Querformat (Lite, wie in style.css)? Dann rechnen die Texturen in halber Aufloesung (und werden so gemerkt). */
  const holoLite = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse) and (max-height: 600px)').matches;
  /** Geometrie je Kartentyp: Bildfeld (Kartenpixel), Rahmenmaske, Namenszeile */
  function holoGeometry(type) {
    const full = isFullart(type);
    // Telefone (Lite-Modus, wie in style.css): halbe Textur-Aufloesung
    const lite = holoLite();
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
   * @returns {Promise<null|{ type, box, nameStrip, all, nameMask }>}  Koordinaten in Kartenpixeln (750x1050); `nameMask` nur bei Skins
   */
  async function holoLayers(card, o) {
    o = o || {};
    const art = await getArt(o.skin ? 'skin/' + o.skin : card.name);
    if (!art) return null;
    // Skin: eigener Name/Rahmen aus card-render.json; ohne Skin (Fullart-, Super- und Diamond-Rare-Karten) die Karte selbst
    const skinMeta = o.skin ? (meta.skins[o.skin] || {}) : null;
    if (!holoOn(skinMeta)) return null;
    const m = Object.assign({}, meta.cards[card.name]);
    if (skinMeta) { if (skinMeta.r) m.r = skinMeta.r; if (skinMeta.f) m.f = skinMeta.f; }
    const spec = specFromCard(card, m, skinMeta ? { name: skinMeta.name || o.skin } : null);
    const geo = holoGeometry(spec.type);
    const tw = Math.round(geo.box[2] * geo.scale), th = Math.round(geo.box[3] * geo.scale);

    // — natives Raster der Kunst (grosse Vollbilder auf <= 160 Pixel Breite herunterrechnen) —
    const sw = art.sw || art.src.width, sh = art.sh || art.src.height;
    const sc = sw > 160 ? 160 / sw : 1, nw = Math.max(1, Math.round(sw * sc)), nh = Math.max(1, Math.round(sh * sc));
    const nc = document.createElement('canvas'); nc.width = nw; nc.height = nh;
    const nx = nc.getContext('2d'); nx.imageSmoothingEnabled = sc < 1;
    nx.drawImage(art.src, art.sx || 0, art.sy || 0, sw, sh, 0, 0, nw, nh);
    const px = nx.getImageData(0, 0, nw, nh).data;

    // — Maske: je Pixel eine Staerke aus Helligkeit und Saettigung; dunkle Pixel bleiben frei —
    const c0 = document.createElement('canvas'); c0.width = nw; c0.height = nh;
    const g0 = c0.getContext('2d'), im = g0.createImageData(nw, nh), u = im.data;
    for (let i = 0; i < nw * nh; i++) {
      const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255, al = px[i * 4 + 3] / 255;
      if (al < 0.5) continue;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, d = mx - mn;
      const gate = smooth(HOLO.dark, HOLO.full, L);
      if (gate <= 0) continue;
      const S = d === 0 ? 0 : d / (1 - Math.abs(2 * L - 1));
      const strength = gate * (HOLO.neutral + (1 - HOLO.neutral) * clamp01(S / 0.5));
      u[i * 4] = u[i * 4 + 1] = u[i * 4 + 2] = 255; u[i * 4 + 3] = Math.round(255 * strength);
    }
    g0.putImageData(im, 0, 0);

    // — auf Texturgroesse strecken (nearest wie `draw`), mit der harten Rahmenmaske beschneiden —
    const all = document.createElement('canvas'); all.width = tw; all.height = th;
    const ga = all.getContext('2d'); ga.imageSmoothingEnabled = false;
    ga.drawImage(c0, 0, 0, tw, th);
    ga.globalCompositeOperation = 'destination-in';
    ga.drawImage(artMask(geo.maskKey, tw, th), 0, 0);
    return { type: spec.type, box: geo.box, nameStrip: NAME_STRIP, all, nameMask: o.skin ? nameMaskCanvas(spec, geo) : null };
  }

  /** Nur der Namensumriss einer Karte (Super Rare / Diamond Rare tragen den Namensglanz ebenfalls). */
  function nameLayer(card) {
    const spec = specFromCard(card, meta.cards[card.name], null);
    return { type: spec.type, nameStrip: NAME_STRIP, nameMask: nameMaskCanvas(spec, holoGeometry(spec.type)) };
  }

  /**
   * Maske ALLEN Textes einer Karte AUSSER dem Namen (der hat seine eigene Maske): Faehigkeitsfelder, Stufe, Werte, Regeltext —
   * weiss auf durchsichtig, in voller Kartengroesse (750 x 1050). Eine halb so grosse Maske, weich gestreckt, liess die Glanzfarbe
   * um jeden Buchstaben ausfransen (gemessen: Regeltext sichtbar verschmiert); in voller Aufloesung bleiben die Kanten scharf.
   * Als PNG weniger als 50 KB. Symbole im Regeltext zaehlen mit (Alpha).
   */
  function textLayer(card) {
    const spec = specFromCard(card, meta.cards[card.name], null);
    TEXT_MASK = true;
    try { return draw(spec, null, null, true); } finally { TEXT_MASK = false; }
  }

  // Fertige Schichten fuers DOM: PNG-Blobs + die Lage in Prozent der Karte als CSS-Variablen. Je Skin einmal gerechnet
  // und gemerkt (LRU); zwei Skins gleichzeitig zu rechnen waere Verschwendung, darum reiht `holoFor` sie hintereinander ein
  // und laesst dem Browser zwischen zwei Skins Luft.
  const HOLO_MAX = 40, NAME_MAX = 80;
  const holoDone = new Map();        // Skin -> { vars, urls } (fertig)
  const holoWait = new Map();        // Skin -> Promise (in Arbeit)
  const nameDone = new Map();        // Kartenname -> { vars, urls }
  let holoChain = Promise.resolve();
  // PNG-Kodierung. `canvas.toBlob` kodiert im Leerlauf des Hauptthreads: auf einer belebten Seite (Animationen im Menue,
  // Deck-Editor beim Aufbauen) wartet jede Karte dadurch 1-6 s, obwohl die Kodierung selbst nur Millisekunden braucht — und
  // die Arbeiter der Warteschlange stehen die ganze Zeit still. Ein Web Worker kodiert unabhaengig vom Hauptthread
  // (gemessen: ~20 ms statt ~2,7 s je Karte). Er bekommt eine ImageBitmap-Kopie; wo Worker/OffscreenCanvas fehlen oder etwas
  // schiefgeht, faellt jede Karte einzeln auf `canvas.toBlob` zurueck.
  const ENC = { w: null, dead: false, n: 0, fails: 0, pend: new Map() };
  const ENC_SRC = 'self.onmessage=async e=>{const d=e.data;let blob=null;try{const o=new OffscreenCanvas(d.bmp.width,d.bmp.height);' +
    'o.getContext("2d").drawImage(d.bmp,0,0);blob=await o.convertToBlob({type:"image/png"})}catch(_){}try{d.bmp.close()}catch(_){}' +
    'self.postMessage({id:d.id,blob})}';
  function encRetire() {
    ENC.dead = true;
    if (ENC.w) { try { ENC.w.terminate(); } catch (e) {} ENC.w = null; }
    for (const r of ENC.pend.values()) r(null);
    ENC.pend.clear();
  }
  function encoder() {
    if (ENC.w || ENC.dead) return ENC.w;
    try {
      if (typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function' || typeof createImageBitmap !== 'function' ||
          !(OffscreenCanvas.prototype && 'convertToBlob' in OffscreenCanvas.prototype)) throw new Error('kein Worker-Encoder');
      const w = new Worker(URL.createObjectURL(new Blob([ENC_SRC], { type: 'text/javascript' })));
      w.onmessage = e => {
        const res = ENC.pend.get(e.data.id); if (!res) return;
        ENC.pend.delete(e.data.id);
        if (!e.data.blob && ++ENC.fails >= 3) encRetire();
        res(e.data.blob || null);
      };
      w.onerror = () => encRetire();
      ENC.w = w;
    } catch (e) { ENC.dead = true; }
    return ENC.w;
  }
  const toBlobMain = cv => new Promise(res => cv.toBlob(b => res(b || null), 'image/png'));
  async function toBlob(cv) {
    const w = encoder();
    if (w) {
      try {
        const bmp = await createImageBitmap(cv);
        const b = await new Promise(res => { const id = ++ENC.n; ENC.pend.set(id, res); w.postMessage({ id, bmp }, [bmp]); });
        if (b) return b;
      } catch (e) { /* weiter mit dem Hauptthread */ }
    }
    return toBlobMain(cv);
  }
  const urlOf = b => URL.createObjectURL(b);
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
      // Dauerhafter Cache: Texturen aus einem frueheren Besuch (gleiche Render-Version) statt neu zu rechnen
      const ck = 'h:' + skin + (holoLite() ? ':l' : '');
      let rec = await cacheGet(ck);
      if (!(rec && rec.all instanceof Blob && rec.name instanceof Blob && rec.box && rec.strip)) {
        const L = await holoLayers(card, { skin });
        if (!L) return null;
        const [all, name] = await Promise.all([L.all, L.nameMask].map(toBlob));
        if (!all || !name) return null;
        rec = { all, name, box: L.box, strip: L.nameStrip };
        cachePut(ck, rec, all.size + name.size);
      }
      const all = urlOf(rec.all), name = urlOf(rec.name), b = rec.box, s = rec.strip;
      return lru(holoDone, skin, {
        vars: {
          '--sh-ax': pc(b[0], W), '--sh-ay': pc(b[1], H), '--sh-aw': pc(b[2], W), '--sh-ah': pc(b[3], H),
          '--sh-ny': pc(s.y, H), '--sh-nh': pc(s.h, H),
          '--sh-all': 'url(' + all + ')', '--sh-name': 'url(' + name + ')',
        },
        urls: [all, name],
      }, HOLO_MAX);
    }).catch(err => { console.warn('[card-render] Holo', skin, err && err.message); return null; })
      .finally(() => holoWait.delete(skin));
    holoChain = job.catch(() => {});
    holoWait.set(skin, job);
    return job;
  }
  // — Schraffur fuer Karten OHNE Skin: Fullart-Karten (Ascended Heroes, Fullart-Helden) sowie Super und Diamond Rares.
  //   Nur das Bild (kein Name, kein Glanzband): dieselbe Maske wie beim Skin, aus der Kunst der Karte selbst. —
  const HATCH_MAX = 80;
  const hatchDone = new Map();       // Kartenname -> { vars, urls }
  const fullartMemo = new Map();     // Kartenname -> bool (haengt von den Metadaten ab, erst nach loadMeta gueltig)
  function isFullartCard(card) {
    let v = fullartMemo.get(card.name);
    if (v === undefined) { v = isFullart(specFromCard(card, meta.cards[card.name]).type); fullartMemo.set(card.name, v); }
    return v;
  }
  /** Bekommt die Karte die Schraffur? Fullart (nach Kartentyp) oder Super/Diamond Rare (Foil-Kennzeichen). Vor loadMeta: nein. */
  function hatchEligible(card) {
    if (!HOLO.on || !metaReady || !card || !card.name) return false;
    return card.foil === 'secret_rare' || card.foil === 'diamond_rare' || isFullartCard(card);
  }
  function hatchCached(card) { return hatchDone.get(card.name) || null; }
  function hatchFor(card) {
    if (!HOLO.on || !card) return Promise.resolve(null);
    const hit = hatchDone.get(card.name);
    if (hit) return Promise.resolve(hit);
    const key = 'h:' + card.name;
    if (holoWait.has(key)) return holoWait.get(key);
    const job = holoChain.then(async () => {
      await new Promise(r => setTimeout(r, 0));
      const ck = 'a:' + card.name + (holoLite() ? ':l' : '');
      let rec = await cacheGet(ck);
      if (!(rec && rec.all instanceof Blob && rec.box)) {
        const L = await holoLayers(card, {});
        if (!L) return null;
        const all = await toBlob(L.all);
        if (!all) return null;
        rec = { all, box: L.box };
        cachePut(ck, rec, all.size);
      }
      const all = urlOf(rec.all), b = rec.box;
      return lru(hatchDone, card.name, {
        vars: { '--sh-ax': pc(b[0], W), '--sh-ay': pc(b[1], H), '--sh-aw': pc(b[2], W), '--sh-ah': pc(b[3], H), '--sh-all': 'url(' + all + ')' },
        urls: [all],
      }, HATCH_MAX);
    }).catch(err => { console.warn('[card-render] Schraffur', card.name, err && err.message); return null; })
      .finally(() => holoWait.delete(key));
    holoChain = job.catch(() => {});
    holoWait.set(key, job);
    return job;
  }
  // — Rahmenglanz: Gold-, Silber- und Diamant-Rahmen glaenzen in ihrer Farbe. Die Maske ist die Form des Rahmens und
  //   haengt nur von Kartentyp und Seltenheit ab — es gibt hoechstens 5 Stueck, von allen Karten geteilt. —
  const rimMemo = new Map();         // Kartenname|Skin -> { kind, tone } | null
  const rimDone = new Map();         // kind -> { vars, urls }
  const rimWait = new Map();         // kind -> Promise
  /** Welchen Rahmen hat die Karte? -> { kind (Schluessel der Maske), tone: 'gold' | 'silver' | 'diamond' } oder null. Vor loadMeta: null. */
  function rimKind(card, skin) {
    if (!HOLO.on || !metaReady || !card || !card.name) return null;
    const id = card.name + '|' + (skin || '');
    if (rimMemo.has(id)) return rimMemo.get(id);
    const sk = skin ? (meta.skins[skin] || {}) : null;
    const m = Object.assign({}, meta.cards[card.name]);
    if (sk) { if (sk.r) m.r = sk.r; if (sk.f) m.f = sk.f; }
    const spec = specFromCard(card, m, null);
    const goldType = spec.type === 'superhero' || spec.type === 'fullartHero';
    let tone = null;
    if (spec.rarity === 'diamond') tone = 'diamond';
    else if (goldType || spec.rarity === 'super rare') tone = 'gold';
    else if (OPT.silverRim && spec.rarity === 'rare') tone = 'silver';
    const out = tone ? { kind: (goldType ? spec.type : 'n') + ':' + spec.rarity, tone, type: spec.type, rarity: spec.rarity } : null;
    rimMemo.set(id, out);
    return out;
  }
  /** Rahmenmaske zu einer Rahmenart (halbe Kartengroesse): nur der Rahmen, undurchsichtig. */
  function rimFor(rk) {
    if (!rk) return Promise.resolve(null);
    const hit = rimDone.get(rk.kind);
    if (hit) return Promise.resolve(hit);
    if (rimWait.has(rk.kind)) return rimWait.get(rk.kind);
    const job = holoChain.then(async () => {
      await new Promise(r => setTimeout(r, 0));
      const ck = 'r:' + rk.kind;
      let png = await cacheGet(ck);
      if (!(png instanceof Blob)) {
        const full = document.createElement('canvas'); full.width = W; full.height = H;
        drawRim(full.getContext('2d'), { type: rk.type, rarity: rk.rarity });
        const half = document.createElement('canvas'); half.width = W / 2; half.height = H / 2;
        const g = half.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(full, 0, 0, W / 2, H / 2);
        png = await toBlob(half);
        if (!png) return null;
        cachePut(ck, png, png.size);
      }
      const url = urlOf(png);
      const out = { vars: { '--sh-rim': 'url(' + url + ')' }, urls: [url] };
      rimDone.set(rk.kind, out);
      return out;
    }).catch(err => { console.warn('[card-render] Rahmenglanz', rk.kind, err && err.message); return null; })
      .finally(() => rimWait.delete(rk.kind));
    holoChain = job.catch(() => {});
    rimWait.set(rk.kind, job);
    return job;
  }
  function rimCached(rk) { return (rk && rimDone.get(rk.kind)) || null; }

  /** Namensglanz fuer Karten mit Foil (Super Rare / Diamond Rare): Umriss der Buchstaben + Lage. */
  function nameShimmerFor(card) {
    if (!HOLO.on || !card) return Promise.resolve(null);
    const hit = nameDone.get(card.name);
    if (hit) return Promise.resolve(hit);
    const key = 'n:' + card.name;
    if (holoWait.has(key)) return holoWait.get(key);
    const job = holoChain.then(async () => {
      await new Promise(r => setTimeout(r, 0));
      const ck = 'n:' + card.name;
      let rec = await cacheGet(ck);
      if (!(rec && rec.name instanceof Blob && rec.strip)) {
        const L = nameLayer(card), name = await toBlob(L.nameMask);
        if (!name) return null;
        rec = { name, strip: L.nameStrip };
        cachePut(ck, rec, name.size);
      }
      const url = urlOf(rec.name), strip = rec.strip;
      return lru(nameDone, card.name, {
        vars: { '--sh-ny': pc(strip.y, H), '--sh-nh': pc(strip.h, H), '--sh-name': 'url(' + url + ')' },
        urls: [url],
      }, NAME_MAX);
    }).catch(err => { console.warn('[card-render] Namensglanz', card.name, err && err.message); return null; })
      .finally(() => holoWait.delete(key));
    holoChain = job.catch(() => {});
    holoWait.set(key, job);
    return job;
  }

  /** Textglanz fuer Karten mit Foil (Super Rare / Diamond Rare): Maske allen Textes ausser dem Namen, ueber die ganze Karte. */
  const textDone = new Map();        // Kartenname -> { vars, urls }
  function textCached(card) { return textDone.get(card.name) || null; }
  function textShimmerFor(card) {
    if (!HOLO.on || !HOLO.allText || !card) return Promise.resolve(null);
    const hit = textDone.get(card.name);
    if (hit) return Promise.resolve(hit);
    const key = 't:' + card.name;
    if (holoWait.has(key)) return holoWait.get(key);
    const job = holoChain.then(async () => {
      await new Promise(r => setTimeout(r, 0));
      let rec = await cacheGet(key);
      if (!(rec && rec.text instanceof Blob)) {
        const text = await toBlob(textLayer(card));
        if (!text) return null;
        rec = { text };
        cachePut(key, rec, text.size);
      }
      const url = urlOf(rec.text);
      return lru(textDone, card.name, { vars: { '--sh-text': 'url(' + url + ')' }, urls: [url] }, NAME_MAX);
    }).catch(err => { console.warn('[card-render] Textglanz', card.name, err && err.message); return null; })
      .finally(() => holoWait.delete(key));
    holoChain = job.catch(() => {});
    holoWait.set(key, job);
    return job;
  }

  root.CardRender = { OPT, last: {}, meta_card: (n, r) => { meta.cards[n] = Object.assign(meta.cards[n] || {}, { r: r === 'common' ? undefined : r }); }, meta_set: (k, name) => { meta.skins[k] = Object.assign(meta.skins[k] || {}, { name }); }, init, draw, specFromCard, renderCard, holoLayers, holoFor, holoCached, nameShimmerFor, nameCached, textShimmerFor, textCached, textLayer, hatchFor, hatchCached, hatchEligible, rimKind, rimFor, rimCached, openCache, cacheGet, cachePut, cacheDel, cacheStats, toBlob, HOLO, getArt, hasArt, loadMeta, loadArtIndex, W, H, _adv: adv, _unitsOf: unitsOf, _paragraphs: paragraphs, STATUS_TERMS, statusMatches, _statusDarstellung: statusDarstellung, _kontrast: kontrast, STATUS_OUTLINES: { dark: OUT_DARK, light: OUT_LIGHT } };
})(typeof window !== 'undefined' ? window : globalThis);
