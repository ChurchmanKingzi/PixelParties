# -*- coding: utf-8 -*-
"""Kartenschrift (public/cardgen/glyphs.json, 200 Einheiten = 1 Pixel) als Pixelmaske rastern."""
import json, os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
_G = json.load(open(os.path.join(ROOT, 'public', 'cardgen', 'glyphs.json'), encoding='utf-8'))
GL = _G['glyphs']
UNIT = 200
SS = 8  # Überabtastung, danach per Mehrheit hart auf Pixel gesetzt
_cache = {}


def _parse(d):
    polys, cur = [], []
    toks = d.replace('M', ' M ').replace('L', ' L ').replace('Z', ' Z ').split()
    i = 0
    while i < len(toks):
        t = toks[i]
        if t in ('M', 'L'):
            x, y = toks[i + 1].split(',') if ',' in toks[i + 1] else (toks[i + 1], toks[i + 2])
            adv = 2 if ',' not in toks[i + 1] else 2
            cur.append((float(x), float(y)))
            i += 2 if ',' in toks[i + 1] else 3
            if t == 'M' and len(cur) > 1:
                polys.append(cur[:-1]); cur = [cur[-1]]
        elif t == 'Z':
            polys.append(cur); cur = []; i += 1
        else:
            i += 1
    return polys


def _glyph(ch):
    if ch in _cache:
        return _cache[ch]
    g = GL.get(ch)
    if g is None:
        g = GL.get('?')
    adv = g['a'] // UNIT
    # Pfad: "M400 0L0 0..." – Zahlenpaare mit Leerzeichen
    import re
    polys = []
    for sub in re.findall(r'M[^M]*', g['d']):
        pts = [(float(a), float(b)) for a, b in re.findall(r'(-?[\d.]+)\s+(-?[\d.]+)', sub)]
        if len(pts) >= 3:
            polys.append(pts)
    H = 1400 // UNIT + 2
    hh, ww = H * SS, adv * SS + 2 * SS
    acc = np.zeros((hh, ww), bool)
    for pts in polys:
        # y nach oben -> nach unten drehen; Teilpfade per Even-Odd (XOR) kombinieren, damit Löcher (a, e, o, 9 …) offen bleiben
        q = [(x / UNIT * SS + SS, (1400 - y) / UNIT * SS) for x, y in pts]
        one = Image.new('L', (ww, hh), 0)
        ImageDraw.Draw(one).polygon(q, fill=255)
        acc ^= np.asarray(one) > 127
    big = Image.fromarray((acc * 255).astype(np.uint8))
    a = np.asarray(big).astype(float) / 255
    h, w = a.shape
    a = a[:h // SS * SS, :w // SS * SS].reshape(h // SS, SS, w // SS, SS).mean(axis=(1, 3)) > 0.5
    _cache[ch] = (a, adv)
    return _cache[ch]


def text_mask(s, scale=1, spacing=1, track=0):
    """Pixelmaske (bool) eines Textes; Zeichenabstand `spacing` px (vor Skalierung)."""
    cols, x, parts = [], 0, []
    for ch in s:
        if ch == ' ':
            x += 3 + spacing
            continue
        g, adv = _glyph(ch)
        parts.append((x, g))
        x += adv + spacing
    w = max(1, x - spacing + 2)
    h = max((g.shape[0] for _, g in parts), default=8)
    m = np.zeros((h, w + 2), bool)
    for ox, g in parts:
        gh, gw = g.shape
        m[:gh, ox:ox + gw] |= g
    # leere Ränder kappen
    ys, xs = np.where(m)
    if len(xs):
        m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    if scale > 1:
        m = np.kron(m, np.ones((scale, scale), bool))
    return m


if __name__ == '__main__':
    for s in ('Tribulations', 'Clash of Heroes', '9 Rarity Skins'):
        m = text_mask(s)
        print(s, m.shape)
