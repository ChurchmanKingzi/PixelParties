#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Baut die Pixel-Emoji-Schrift aus glyphen.json (siehe extract.js).

    python3 scripts/pixel-emoji/build_font.py

Ergebnis:
  public/fonts/pp-pixel-emoji.woff2   COLRv0/CPAL-Farbschrift (Chrome, Edge, Firefox) + OpenType-SVG (Safari); Silhouette als Rueckfall
  public/style.css                    der Block zwischen /* PIXEL-EMOJI:BEGIN */ und /* PIXEL-EMOJI:END */ wird neu geschrieben

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
    glyphen = json.load(io.open(os.path.join(HIER, 'glyphen.json'), encoding='utf-8'))
    order = ['.notdef']; cmap = {}; gl = {}; metriken = {}
    gl['.notdef'] = TTGlyphPen(None).glyph(); metriken['.notdef'] = (UPEM, 0)
    farben = []            # CPAL-Palette (RGBA 0..1)
    farb_index = {}
    def palette(hexfarbe):
        if hexfarbe not in farb_index:
            farb_index[hexfarbe] = len(farben)
            h = hexfarbe.lstrip('#'); farben.append((int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, 1.0))
        return farb_index[hexfarbe]
    colr = {}; svg_docs = []; codepunkte = []
    for cp_hex, g in glyphen.items():
        cp = int(cp_hex, 16)
        zeilen = g['z']; h = len(zeilen); w = max(len(r) for r in zeilen)
        zelle = UPEM // max(w, h, 12)
        breite = UPEM if not g.get('mono') else int(UPEM * 0.94)
        x_off = (breite - w * zelle) // 2
        y_unten = DESC + (UPEM - h * zelle) // 2
        def fu(x0, y0, x1, y1):      # Zellen → Font-Einheiten (y nach oben)
            return (x_off + x0 * zelle, y_unten + (h - y1) * zelle, x_off + x1 * zelle, y_unten + (h - y0) * zelle)
        name = 'u%04X' % cp
        if g.get('mono'):
            ebenen = [('#', None)]
        else:
            buchst = sorted({c for r in zeilen for c in r if c in g['pal']})
            ebenen = [(c, g['pal'][c]) for c in buchst]
        alle = []; layer_namen = []; svg_rects = []
        for i, (c, farbe) in enumerate(ebenen):
            rs = [fu(*r) for r in rechtecke(zeilen, c)]
            if not rs: continue
            alle += rs
            ln = '%s.l%d' % (name, i)
            gl[ln] = rechteck_glyph(rs); metriken[ln] = (breite, 0); order.append(ln)
            layer_namen.append((ln, 0xFFFF if farbe is None else palette(farbe)))
            for (x0, y0, x1, y1) in rs:
                svg_rects.append('<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>' % (x0, -y1, x1 - x0, y1 - y0, 'currentColor' if farbe is None else farbe))
        if not alle: continue
        gl[name] = rechteck_glyph(alle); metriken[name] = (breite, 0); order.append(name)
        colr[name] = layer_namen; cmap[cp] = name; codepunkte.append(cp)
        svg_docs.append((name, '<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><g id="glyphGID">' + ''.join(svg_rects) + '</g></svg>'))
    fb = FontBuilder(UPEM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(gl)
    fb.setupHorizontalMetrics({n: (metriken[n][0], 0) for n in order})
    fb.setupHorizontalHeader(ascent=ASC, descent=DESC, lineGap=0)
    fb.setupNameTable({'familyName': FAMILIE, 'styleName': 'Regular', 'uniqueFontIdentifier': FAMILIE + ' 1.0', 'fullName': FAMILIE, 'psName': 'PPPixelEmoji-Regular', 'version': 'Version 1.0'})
    fb.setupOS2(sTypoAscender=ASC, sTypoDescender=DESC, usWinAscent=ASC, usWinDescent=-DESC, sTypoLineGap=0, fsType=0)
    fb.setupPost()
    font = fb.font
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
    bloecke = ['/* PIXEL-EMOJI:BEGIN — erzeugt von scripts/pixel-emoji/build_font.py, nicht von Hand aendern */']
    for fam in FAMILIEN:
        bloecke.append("@font-face { font-family: '%s'; src: url('/fonts/pp-pixel-emoji.woff2') format('woff2'); unicode-range: %s; font-display: swap; }" % (fam, ur))
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
    print('%d Glyphen, %d Farben, %d Ebenen → public/fonts/pp-pixel-emoji.woff2 (%d Bytes)' % (len(cps), len(farben), sum(1 for n in order if '.l' in n), os.path.getsize(os.path.join(ziel, 'pp-pixel-emoji.woff2'))))

if __name__ == '__main__':
    main()
