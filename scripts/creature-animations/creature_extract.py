# -*- coding: utf-8 -*-
"""Creature-Sprite aus ausgewählten Treffern von creature_scan.py zusammensetzen.

    python3 creature_extract.py <merged.json> <dump-ordner> <Kartenname> <Treffernummern> <ausgabe.png>
        Treffernummern: kommagetrennte Positionen wie im Prüfbild (creature_review.py sheet) —
        nach Übereinstimmung sortierte Liste der Treffer mit same >= 0.75.

Die Pixel stammen aus den Ebenen (sauber, ohne das Rauschen der Kartenkunst), die Lage der Figuren
zueinander aus der Kunst (Versatz / Maßstab), Stapelreihenfolge wie in der xcf (hoher Ebenenindex
= weiter unten, wird zuerst gezeichnet). Ausgabe: RGBA mit binärem Alpha, auf die Figur beschnitten.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image


def komponente(dump, h):
    """Pixel (RGBA, binäres Alpha) einer Figur an ihrer Stelle im Ebenenbild + Rahmen (x, y, w, h)."""
    a = np.array(Image.open(os.path.join(dump, h['file'], f"{h['i']:03d}.png")).convert('RGBA'))
    op = (a[..., 3] >= 250).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(op, np.ones((3, 3), np.uint8)), connectivity=8)
    x, y, w, hh = h['box']
    msk = (lab[y:y + hh, x:x + w] == h['k']) & (op[y:y + hh, x:x + w] > 0)
    out = np.zeros((hh, w, 4), np.uint8)
    out[msk, :3] = a[y:y + hh, x:x + w, :3][msk]
    out[msk, 3] = 255
    return out


def assemble(dump, teile):
    """teile: Treffer-Dicts. Gibt RGBA-Sprite im Ebenenmaßstab (1 Pixel = 1 Sprite-Pixel) zurück."""
    sc = max(set(t.get('scale', 1) for t in teile), key=[t.get('scale', 1) for t in teile].count)
    teile = [t for t in teile if t.get('scale', 1) == sc]
    pos = [(round(t['at'][0] / sc), round(t['at'][1] / sc)) for t in teile]
    ims = [komponente(dump, t) for t in teile]
    x0 = min(p[0] for p in pos); y0 = min(p[1] for p in pos)
    x1 = max(p[0] + im.shape[1] for p, im in zip(pos, ims)); y1 = max(p[1] + im.shape[0] for p, im in zip(pos, ims))
    can = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    for t, (px, py), im in sorted(zip(teile, pos, ims), key=lambda e: -e[0]['i']):
        m = im[..., 3] > 0
        sub = can[py - y0:py - y0 + im.shape[0], px - x0:px - x0 + im.shape[1]]
        sub[m] = im[m]
    return can, sc


if __name__ == '__main__':
    merged, dump, name, nums, out = sys.argv[1:6]
    hs = [h for h in json.load(open(merged, encoding='utf-8'))[name] if h['same'] >= 0.75][:12]
    can, sc = assemble(dump, [hs[int(k)] for k in nums.split(',')])
    ys, xs = np.nonzero(can[..., 3])
    can = can[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(can).save(out)
    print(name, '->', out, can.shape[1], 'x', can.shape[0], 'px, Maßstab in der Kunst', sc)
