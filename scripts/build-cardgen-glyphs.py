#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Zieht die Umrisse der Schrift „Pixel Intv" fuer den Karten-Renderer aus der Font-Datei.

    python scripts/build-cardgen-glyphs.py            # schreibt public/cardgen/glyphs.json

Pixel Intv besteht nur aus achsenparallelen Rechtecken. Der Renderer fuellt diese Umrisse
als Vektorpfade, statt den Text vom Browser setzen zu lassen: Der Browser rastert Text je
nach System und Zoom mit eigenem Hinting und rundet die Grundlinie auf ganze Pixel, ein
gefuellter Pfad liegt dagegen auf jedem Geraet am selben (auch halben) Pixel. Das ist die
Voraussetzung dafuer, dass die Karte der Vorlage auf das Pixel folgt. Ausserdem braucht der
Renderer dadurch keine Webfont-Ladezeit.

Abhaengigkeit: fonttools (pip install fonttools).
"""
import json, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
font = TTFont(os.path.join(ROOT, 'data', 'Pixel Intv.otf'))
cmap = font.getBestCmap(); gs = font.getGlyphSet(); hmtx = font['hmtx']

# Alle Zeichen, die in Kartennamen, Texten und Faehigkeiten vorkommen (+ druckbares ASCII)
chars = set(chr(c) for c in range(33, 127))
for c in json.load(open(os.path.join(ROOT, 'data', 'cards.json'), encoding='utf-8')):
    for k in ('name', 'effect', 'startingAbility1', 'startingAbility2'):
        chars.update(c.get(k) or '')
chars -= set(' \n\r\t')

def num(v): return str(int(v)) if float(v).is_integer() else '%.1f' % v

glyphs = {}
for ch in sorted(chars):
    g = cmap.get(ord(ch))
    if not g: sys.exit('Zeichen ohne Glyphe: %r' % ch)
    pen = RecordingPen(); gs[g].draw(pen)
    d = []
    for op, args in pen.value:
        if op == 'moveTo': d.append('M%s %s' % tuple(num(v) for v in args[0]))
        elif op == 'lineTo': d.append('L%s %s' % tuple(num(v) for v in args[0]))
        elif op == 'closePath': d.append('Z')
        else: sys.exit('Kurven werden nicht unterstuetzt (%r in %r)' % (op, ch))
    glyphs[ch] = {'d': ''.join(d), 'a': hmtx[g][0]}

out = os.path.join(ROOT, 'public', 'cardgen', 'glyphs.json')
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w', encoding='utf-8') as fh:
    json.dump({'upm': font['head'].unitsPerEm, 'ascent': font['hhea'].ascent, 'descent': -font['hhea'].descent, 'glyphs': glyphs},
              fh, ensure_ascii=False, separators=(',', ':'))
print('%d Glyphen, %d Bytes' % (len(glyphs), os.path.getsize(out)))
