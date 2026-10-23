#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Baut die Pixel-Emoji-Schrift aus glyphen.json (siehe extract.js).

    python3 scripts/pixel-emoji/build_font.py

Ergebnis:
  public/fonts/pp-pixel-emoji.woff2   COLRv0/CPAL-Farbschrift (Chrome, Edge, Firefox) + OpenType-SVG (Safari); Silhouette als Rueckfall
  public/style.css                    der Block zwischen /* PIXEL-EMOJI:BEGIN */ und /* PIXEL-EMOJI:END */ wird neu geschrieben

Eingabe: glyphen.json (Spiel-Zeichen inkl. Text-Symbole, Schluessel = Codepunkt) UND glyphen-alle.json (ALLE Unicode-Emojis; Schluessel = Folge, z. B. 1F468-200D-1F469;
`aliase` = weniger qualifizierte Schreibweisen). Einzelne Codepunkte stehen im cmap, Folgen (Hautfarben, ZWJ, Flaggen, Tag-Folgen) als Ligaturen (GSUB `ccmp`).
Jedes Pixel ist ein Rechteck; Farben stehen als Ebenen (COLR). Einfarbige Symbole nutzen die Vordergrundfarbe des Textes
(Palettenindex 0xFFFF), folgen also `color`. Voraussetzung: pip install fonttools brotli
"""
import io, json, os, re, sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.colorLib.builder import buildCOLR, buildCPAL
from fontTools.ttLib import newTable
from fontTools.ttLib.tables.S_V_G_ import SVGDocument

HIER = os.path.dirname(os.path.abspath(__file__))
WURZEL = os.path.abspath(os.path.join(HIER, '..', '..'))
UPEM = 1024
ASC, DESC = 896, -128
FAMILIE = 'PP Pixel Emoji'
# Familien des Spiels, denen die Zeichen zusaetzlich untergeschoben werden (gleicher Name = eine zusammengesetzte Schrift)
FAMILIEN = ['PP Pixel Emoji', 'Pixel Intv', 'Press Start 2P', 'Orbitron', 'Rajdhani', 'Roboto', 'Orbit']

def rechtecke(zeilen, buchstabe):
    """Zusammenhaengende Rechtecke (x0, y0, x1, y1) in Zellen fuer einen Buchstaben: Zeilenlaeufe, dann vertikal verschmolzen."""
    h = len(zeilen)
    laeufe = []
    for y, r in enumerate(zeilen):
        x = 0
        while x < len(r):
            if r[x] == buchstabe:
                x0 = x
                while x < len(r) and r[x] == buchstabe: x += 1
                laeufe.append((x0, x, y))
            else: x += 1
    offen = {}   # (x0,x1) -> [y0, y1]
    fertig = []
    for y in range(h):
        jetzt = {(a, b) for a, b, yy in laeufe if yy == y}
        for k in list(offen):
            if k not in jetzt or offen[k][1] != y:
                fertig.append((k[0], offen[k][0], k[1], offen[k][1])); del offen[k]
        for k in jetzt:
            if k in offen: offen[k][1] = y + 1
            else: offen[k] = [y, y + 1]
    for k, (y0, y1) in offen.items(): fertig.append((k[0], y0, k[1], y1))
    return fertig

def rechteck_glyph(rechtecke_fu):
    pen = TTGlyphPen(None)
    for (x0, y0, x1, y1) in rechtecke_fu:        # Font-Einheiten, y nach oben; im Uhrzeigersinn (aussen)
        pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    return pen.glyph()

def main():
    kern = json.load(io.open(os.path.join(HIER, 'glyphen.json'), encoding='utf-8'))
    alle_pfad = os.path.join(HIER, 'glyphen-alle.json')
    alle = json.load(io.open(alle_pfad, encoding='utf-8')) if os.path.exists(alle_pfad) else {'glyphen': {}, 'aliase': {}}
    # Eintraege: Schluessel (Tupel Codepunkte) -> Glyph. Der Kern gewinnt bei Doppelungen (handverlesene Spiel-Zeichen).
    eintraege = {}
    for cp_hex, g in kern.items(): eintraege[(int(cp_hex, 16),)] = g
    for k, g in alle['glyphen'].items():
        cps = tuple(int(x, 16) for x in k.split('-'))
        einzel = tuple(c for c in cps if c != 0xFE0F)
        if len(einzel) == 1: cps = einzel                       # einzelner Codepunkt (mit oder ohne FE0F): ein cmap-Eintrag
        if cps not in eintraege: eintraege[cps] = g
    aliase = {tuple(int(x, 16) for x in a.split('-')): tuple(int(x, 16) for x in k.split('-')) for a, k in alle['aliase'].items()}
    order = ['.notdef']; cmap = {}; gl = {}; metriken = {}
    gl['.notdef'] = TTGlyphPen(None).glyph(); metriken['.notdef'] = (UPEM, 0)
    farben = []            # CPAL-Palette (RGBA 0..1)
    farb_index = {}
    # Spiel-Palette (256 Farben, scripts/palette): jede Glyphenfarbe rastet auf die naechste Palettenfarbe ein
    import math
    pal_hex = [f['hex'] for f in json.load(io.open(os.path.join(WURZEL, 'data', 'palette.json'), encoding='utf-8'))['farben']]
    def _lab(c):
        def lin(v): v /= 255; return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
        r, g, b = (lin(x) for x in c)
        x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047; y = 0.2126 * r + 0.7152 * g + 0.0722 * b; z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
        f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
        x, y, z = f(x), f(y), f(z)
        return (116 * y - 16, 500 * (x - y), 200 * (y - z))
    pal_lab = [_lab([int(h[i:i + 2], 16) for i in (1, 3, 5)]) for h in pal_hex]
    snap_cache = {}
    def snap(hexfarbe):
        if os.environ.get('PE_OHNE_PALETTE'): return hexfarbe     # nur zum Vergleichen
        if hexfarbe not in snap_cache:
            l = _lab([int(hexfarbe[i:i + 2], 16) for i in (1, 3, 5)])
            snap_cache[hexfarbe] = min(zip(pal_hex, pal_lab), key=lambda p: (l[0] - p[1][0]) ** 2 + (l[1] - p[1][1]) ** 2 + (l[2] - p[1][2]) ** 2)[0]
        return snap_cache[hexfarbe]
    def palette(hexfarbe):
        hexfarbe = snap(hexfarbe)
        if hexfarbe not in farb_index:
            farb_index[hexfarbe] = len(farben)
            h = hexfarbe.lstrip('#'); farben.append((int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, 1.0))
        return farb_index[hexfarbe]
    colr = {}; svg_docs = []; codepunkte = []; glyph_von = {}
    for cps, g in eintraege.items():
        cp = cps[0]
        zeilen = g['z']; h = len(zeilen); w = max(len(r) for r in zeilen)
        zelle = UPEM // max(w, h, 12)
        breite = UPEM if not g.get('mono') else int(UPEM * 0.94)
        x_off = (breite - w * zelle) // 2
        y_unten = DESC + (UPEM - h * zelle) // 2
        def fu(x0, y0, x1, y1):      # Zellen → Font-Einheiten (y nach oben)
            return (x_off + x0 * zelle, y_unten + (h - y1) * zelle, x_off + x1 * zelle, y_unten + (h - y0) * zelle)
        name = 'u' + '_'.join('%04X' % c for c in cps)
        if g.get('mono'):
            ebenen = [('#', None)]
        else:
            buchst = sorted({c for r in zeilen for c in r if c in g['pal']})
            ebenen = [(c, g['pal'][c]) for c in buchst]
        alle_r = []; layer_namen = []; svg_rects = []
        for i, (c, farbe) in enumerate(ebenen):
            rs = [fu(*r) for r in rechtecke(zeilen, c)]
            if not rs: continue
            alle_r += rs
            ln = '%s.l%d' % (name, i)
            gl[ln] = rechteck_glyph(rs); metriken[ln] = (breite, 0); order.append(ln)
            layer_namen.append((ln, 0xFFFF if farbe is None else palette(farbe)))
            # eine <path> je Farbe (statt eines <rect> je Rechteck): die SVG-Tabelle (Safari) wird so ein Vielfaches kleiner
            d = ''.join('M%d %dh%dv%dh%dz' % (x0, -y1, x1 - x0, y1 - y0, x0 - x1) for (x0, y0, x1, y1) in rs)
            svg_rects.append('<path fill="%s" d="%s"/>' % ('currentColor' if farbe is None else farbe, d))
        if not alle_r: continue
        gl[name] = rechteck_glyph(alle_r); metriken[name] = (breite, 0); order.append(name)
        colr[name] = layer_namen; glyph_von[cps] = name
        if len(cps) == 1: cmap[cp] = name; codepunkte.append(cp)
        svg_docs.append((name, '<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><g id="glyphGID">' + ''.join(svg_rects) + '</g></svg>'))
    # Unsichtbare Bausteine: Variantenselektor, ZWJ, Tag-Zeichen (Teilgebiets-Flaggen) — null Breite, damit Folgen und lose Zeichen nichts verschieben
    for cp in [0xFE0F, 0x200D] + list(range(0xE0020, 0xE0080)):
        name = 'u%04X' % cp
        if name in gl: continue
        gl[name] = TTGlyphPen(None).glyph(); metriken[name] = (0, 0); order.append(name); cmap[cp] = name; codepunkte.append(cp)
    # Ligaturen fuer Folgen (inkl. der weniger qualifizierten Schreibweisen)
    def komp(cp): return cmap.get(cp)
    lig_regeln = set()
    def lig(cps, ziel):
        teile = [komp(c) for c in cps]
        if None in teile or len(teile) < 2 or ziel not in gl: return
        lig_regeln.add((tuple(teile), ziel))
    for cps, name in glyph_von.items():
        if len(cps) > 1: lig(cps, name)
    for a_cps, k_cps in aliase.items():
        k = tuple(c for c in k_cps if c != 0xFE0F) if len([c for c in k_cps if c != 0xFE0F]) == 1 else k_cps
        if k in glyph_von and len(a_cps) > 1: lig(a_cps, glyph_von[k])
    fb = FontBuilder(UPEM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(gl)
    # ★ lsb = linke Kante des Glyphen. Mit lsb 0 verschiebt FreeType (Chrome/Opera) JEDE Ebene eines Farbzeichens so, dass ihre linke Kante bei x = 0 liegt —
    #   Fuellungen und Kontur rutschen gegeneinander (Muenze/Herz/Schild sahen „kaputt" aus, mit Geisterkontur). Deshalb die echte Kante eintragen.
    def _lsb(n):
        co = getattr(gl[n], 'coordinates', None)
        return min(x for x, _ in co) if co and len(co) else 0
    fb.setupHorizontalMetrics({n: (metriken[n][0], _lsb(n)) for n in order})
    fb.setupHorizontalHeader(ascent=ASC, descent=DESC, lineGap=0)
    fb.setupNameTable({'familyName': FAMILIE, 'styleName': 'Regular', 'uniqueFontIdentifier': FAMILIE + ' 1.0', 'fullName': FAMILIE, 'psName': 'PPPixelEmoji-Regular', 'version': 'Version 1.0'})
    fb.setupOS2(sTypoAscender=ASC, sTypoDescender=DESC, usWinAscent=ASC, usWinDescent=-DESC, sTypoLineGap=0, fsType=0)
    fb.setupPost(keepGlyphNames=False)      # Format 3: keine Glyphnamen (spart >1 MB, Browser brauchen sie nicht)
    font = fb.font
    if lig_regeln:
        from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
        fea = ['languagesystem DFLT dflt;', 'languagesystem latn dflt;', 'feature ccmp {']
        for teile, ziel in sorted(lig_regeln, key=lambda r: (-len(r[0]), r[0])):
            fea.append('  sub %s by %s;' % (' '.join(teile), ziel))
        fea.append('} ccmp;')
        addOpenTypeFeaturesFromString(font, '\n'.join(fea))
    font['COLR'] = buildCOLR(colr)
    font['CPAL'] = buildCPAL([farben])
    svg = newTable('SVG ')
    gids = font.getReverseGlyphMap()
    svg.docList = []
    for name, doc in sorted(svg_docs, key=lambda e: gids[e[0]]):
        gid = gids[name]
        svg.docList.append(SVGDocument(doc.replace('glyphGID', 'glyph%d' % gid), gid, gid, False))
    font['SVG '] = svg
    ziel = os.path.join(WURZEL, 'public', 'fonts'); os.makedirs(ziel, exist_ok=True)
    ttf = os.path.join(ziel, 'pp-pixel-emoji.ttf')
    font.save(ttf)
    from fontTools.ttLib import TTFont
    f2 = TTFont(ttf); f2.flavor = 'woff2'; f2.save(os.path.join(ziel, 'pp-pixel-emoji.woff2')); os.remove(ttf)
    # unicode-range
    cps = sorted(codepunkte); teile = []; i = 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1: j += 1
        teile.append('U+%X' % cps[i] if i == j else 'U+%X-%X' % (cps[i], cps[j])); i = j + 1
    ur = ', '.join(teile)
    # Inhalts-Hash als Versionsparameter: die Schrift wird vom Server fuer ein Jahr gecacht (`/fonts`, immutable) und wechselt nur mit neuem Inhalt die URL
    import hashlib
    v = hashlib.sha1(open(os.path.join(ziel, 'pp-pixel-emoji.woff2'), 'rb').read()).hexdigest()[:10]
    url = '/fonts/pp-pixel-emoji.woff2?v=' + v
    bloecke = ['/* PIXEL-EMOJI:BEGIN — erzeugt von scripts/pixel-emoji/build_font.py, nicht von Hand aendern */']
    for fam in FAMILIEN:
        bloecke.append("@font-face { font-family: '%s'; src: url('%s') format('woff2'); unicode-range: %s; font-display: block; }" % (fam, url, ur))
    # Bedienelemente ohne eigene Schrift (Browser-Standard Arial) bekommen die Pixel-Zeichen vorangestellt; `:where` = Spezifitaet 0, jede Klasse darf weiter ueberschreiben.
    bloecke.append("/* Bedienelemente ohne eigene Schrift: Emoji trotzdem als Pixelart */")
    bloecke.append(":where(button, input, select, textarea, option) { font-family: 'PP Pixel Emoji', Arial, sans-serif; }")
    bloecke.append('/* PIXEL-EMOJI:END */')
    css_pfad = os.path.join(WURZEL, 'public', 'style.css')
    css = io.open(css_pfad, encoding='utf-8').read()
    neu = '\n'.join(bloecke)
    if '/* PIXEL-EMOJI:BEGIN' in css:
        css = re.sub(r'/\* PIXEL-EMOJI:BEGIN.*?/\* PIXEL-EMOJI:END \*/', lambda m: neu, css, flags=re.S)
    else:
        # hinter dem ersten @font-face-Block ('Pixel Intv') einfuegen
        m = re.search(r"@font-face \{[^}]*Pixel Intv[^}]*\}\n", css)
        css = css[:m.end()] + '\n' + neu + '\n' + css[m.end():]
    io.open(css_pfad, 'w', encoding='utf-8', newline='').write(css)
    html_pfad = os.path.join(WURZEL, 'public', 'index.html')
    html = io.open(html_pfad, encoding='utf-8').read()
    html2 = re.sub(r'/fonts/pp-pixel-emoji\.woff2(\?v=[0-9a-f]+)?', url, html)
    if html2 != html: io.open(html_pfad, 'w', encoding='utf-8', newline='').write(html2)
    print('%d Glyphen, %d Farben, %d Ebenen → public/fonts/pp-pixel-emoji.woff2 (%d Bytes)' % (len(cps), len(farben), sum(1 for n in order if '.l' in n), os.path.getsize(os.path.join(ziel, 'pp-pixel-emoji.woff2'))))

if __name__ == '__main__':
    main()
