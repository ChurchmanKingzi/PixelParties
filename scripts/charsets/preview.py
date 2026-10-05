# -*- coding: utf-8 -*-
"""Vorschau: alle 12 Frames vergrößert (3 Spalten x 4 Zeilen) plus 1:1-Streifen.
Aufruf (aus scripts/charsets):  python3 preview.py Tobi [Zoom] [Ausgabedatei]"""
import sys
import numpy as np
from PIL import Image
import rig
import figure
import cast
rig.check()


def preview(names, k=10, path=None):
    names = [names] if isinstance(names, str) else list(names)
    blocks = [figure.char_block(cast.CAST[n]) for n in names]
    bigs = [rig.zoom(b, k) for b in blocks]
    ones = [rig.zoom(b, 2) for b in blocks]
    gap = 16
    w = sum(b.width for b in bigs) + gap * (len(bigs) - 1) + 24 + sum(o.width for o in ones) + 8 * (len(ones) - 1)
    canvas = Image.new('RGBA', (w, max(b.height for b in bigs)), (30, 36, 32, 255))
    x = 0
    for b in bigs:
        canvas.alpha_composite(b, (x, 0)); x += b.width + gap
    x += 8
    for o in ones:
        canvas.alpha_composite(o, (x, 0)); x += o.width + 8
    if path:
        canvas.save(path)
    return canvas


if __name__ == '__main__':
    name = sys.argv[1] if len(sys.argv) > 1 else 'Tobi'
    k = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    out = sys.argv[3] if len(sys.argv) > 3 else f'out/prev_{name}.png'
    preview(name, k, out)
    print('->', out)
