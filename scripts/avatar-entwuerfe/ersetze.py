# -*- coding: utf-8 -*-
"""Ersetzt bestehende Shop-Avatare (freigestellte Sprites) durch quadratische Versionen mit Kartenhintergrund.

Ablauf je Avatar: Kartenbild auf das Sprite-Pixelraster (m Kartenpixel je Sprite-Pixel, Phase aus der Fundstelle)
zurückrechnen -> quadratischer Ausschnitt um den Sprite (Sprite füllt ~72 % der Kantenlänge, so bleibt der Zoom
der Originale erhalten) -> ganzzahlig vergrößert (Originale mit Faktor >= 10 behalten ihren Faktor, sonst ~240 px).
Aufruf:  python3 ersetze.py [ID ...] [--write]   (ohne --write nur nach data/shop/avatar-entwuerfe/ersatz/)
"""
import os, sys
import numpy as np
from PIL import Image
from erzeuge import ROOT, _LUT, norm
from ersatz import ERSATZ

FILL = 0.72


def orig_info(pid):
    a = np.array(Image.open(os.path.join(ROOT, 'data', 'shop', 'avatars', pid + '.png')).convert('RGBA'))
    h, w = a.shape[:2]
    k = 1
    for kk in range(2, 64):
        if h % kk == 0 and w % kk == 0:
            b = a.reshape(h // kk, kk, w // kk, kk, -1)
            if (b == b[:, :1, :, :1]).all():
                k = kk
    return w // k, h // k, k


def build(pid, card, m, x, y, orig=None):
    w, h, k = orig or orig_info(pid)
    art = np.array(Image.open(_LUT[norm(card)]).convert('RGB'))[168:568, 70:680]
    px, py = x % m, y % m
    a = art[py:, px:]
    nh, nw = a.shape[0] // m, a.shape[1] // m
    a = a[:nh * m, :nw * m].reshape(nh, m, nw, m, 3)
    c = a[:, m // 4:m - m // 4, :, m // 4:m - m // 4, :].transpose(0, 2, 1, 3, 4).reshape(nh, nw, -1, 3)
    nat = np.median(c, axis=2).astype(np.uint8)
    sx, sy = (x - px) // m, (y - py) // m
    side = int(np.ceil(max(w, h) / FILL))
    side += side % 2
    side = min(side, nh, nw)
    x0 = int(round(sx + w / 2 - side / 2)); y0 = int(round(sy + h / 2 - side / 2))
    x0 = max(0, min(nw - side, x0)); y0 = max(0, min(nh - side, y0))
    scale = k if k >= 10 else max(3, int(round(240 / side)))
    im = Image.fromarray(nat[y0:y0 + side, x0:x0 + side]).resize((side * scale, side * scale), Image.NEAREST)
    return im, side, scale


def main():
    write = '--write' in sys.argv
    ids = [a for a in sys.argv[1:] if not a.startswith('--')]
    out = os.path.join(ROOT, 'data', 'shop', 'avatar-entwuerfe', 'ersatz')
    os.makedirs(out, exist_ok=True)
    for pid, card, m, x, y in ERSATZ:
        if ids and pid not in ids:
            continue
        im, side, scale = build(pid, card, m, x, y)
        im.save(os.path.join(out, pid + '.png'))
        if write:
            im.save(os.path.join(ROOT, 'data', 'shop', 'avatars', pid + '.png'))
        print(pid, side, 'x', scale, '=', im.size)


if __name__ == '__main__':
    main()
