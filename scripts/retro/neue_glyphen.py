#!/usr/bin/env python3
# Handgemachte Farb-Rastergrafiken (16x16) fuer Zeichen, die als Einfarb-Glyphen zu unrecht weiss waren: ⭐ 🎶 ➕ ♟.
# Form per Supersampling, Licht von oben links, Dithering-Band zwischen den Toenen, dunkle Kontur. Schreibt in scripts/pixel-emoji/glyphen.json.
import json, os
from PIL import Image, ImageDraw
N, S = 16, 8
HIER = os.path.join(os.path.dirname(__file__), '..', 'pixel-emoji')

SLATE = {'A': '#a9bccd', 'B': '#7d93a8', 'C': '#566b80', 'D': '#e2edf5', 'E': '#26323f'}

def maske(zeichne):
    im = Image.new('L', (N * S, N * S), 0); d = ImageDraw.Draw(im)
    zeichne(d, lambda v: v * S)
    out = im.resize((N, N), Image.BOX)
    return [[1 if out.getpixel((x, y)) >= 110 else 0 for x in range(N)] for y in range(N)]

def schattiere(fill, pal, licht=(0.6, 0.8), glanz=()):
    ys = [y for y in range(N) for x in range(N) if fill[y][x]]; xs = [x for y in range(N) for x in range(N) if fill[y][x]]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    br = max(max(xs) - min(xs), max(ys) - min(ys)) / 2 or 1
    def rand(x, y):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            xx, yy = x + dx, y + dy
            if not (0 <= xx < N and 0 <= yy < N) or not fill[yy][xx]: return True
        return False
    g = [['.'] * N for _ in range(N)]
    for y in range(N):
        for x in range(N):
            if not fill[y][x]: continue
            if rand(x, y): g[y][x] = 'E'; continue
            t = ((x - cx) * licht[0] + (y - cy) * licht[1]) / br
            if t < -0.35: c = 'A'
            elif t < -0.15: c = 'A' if (x + y) % 2 == 0 else 'B'
            elif t < 0.2: c = 'B'
            elif t < 0.4: c = 'B' if (x + y) % 2 == 0 else 'C'
            else: c = 'C'
            g[y][x] = c
    for x, y in glanz:
        if 0 <= x < N and 0 <= y < N and g[y][x] in 'AB': g[y][x] = 'D'
    return {'z': [''.join(r) for r in g], 'pal': pal}

def plus(d, s):
    d.rectangle([s(5.5), s(1), s(10.5) - 1, s(15) - 1], fill=255); d.rectangle([s(1), s(5.5), s(15) - 1, s(10.5) - 1], fill=255)
def bauer(d, s):
    d.ellipse([s(4.4), s(0.8), s(11.6), s(7.6)], fill=255)                    # Kopf
    d.rectangle([s(3.8), s(7.0), s(12.2) - 1, s(8.8) - 1], fill=255)          # Kragen
    d.polygon([(s(5.4), s(8.6)), (s(10.6), s(8.6)), (s(12), s(12.6)), (s(4), s(12.6))], fill=255)   # Koerper
    d.rectangle([s(2.2), s(12.0), s(13.8) - 1, s(15.0) - 1], fill=255)       # Sockel
def noten_grid():
    """Zwei gebalkte Achtelnoten (♫) von Hand: Balken, zwei breite Hälse, zwei Köpfe."""
    g = [['.'] * N for _ in range(N)]
    def setz(x, y, c):
        if 0 <= x < N and 0 <= y < N: g[y][x] = c
    # Balken (Zeilen 1-4, Spalten 4-13), leicht fallend nach rechts durch Ton
    for x in range(4, 14):
        setz(x, 1, 'E'); setz(x, 4, 'E')
        setz(x, 2, 'A' if x < 8 else 'B'); setz(x, 3, 'B' if x < 8 else 'C')
    for x in (4, 13):
        setz(x, 2, 'E'); setz(x, 3, 'E')
    # Hälse (3 breit: Kontur - Füllung - Kontur), Zeilen 5-11
    for y in range(5, 12):
        for x0, f in ((4, 'A'), (11, 'B')):
            setz(x0, y, 'E'); setz(x0 + 1, y, f if y < 9 else 'C' if f == 'B' else 'B'); setz(x0 + 2, y, 'E')
    # Köpfe: Ellipsen (6 x 5) mit Licht oben links
    def kopf(cx0, cy0):
        for dy in range(5):
            for dx in range(6):
                ecke = (dx in (0, 5) and dy in (0, 4))
                if ecke: continue
                rand = dx in (0, 5) or dy in (0, 4)
                c = 'E' if rand else ('A' if (dx + dy) <= 3 else ('B' if (dx + dy) <= 5 else 'C'))
                setz(cx0 + dx, cy0 + dy, c)
        setz(cx0 + 1, cy0 + 1, 'E'); setz(cx0 + 2, cy0 + 1, 'D'); setz(cx0 + 1, cy0 + 2, 'D')
    kopf(1, 10); kopf(8, 10)
    return {'z': [''.join(r) for r in g], 'pal': SLATE}

GRAU = {'A': '#c9c9c9', 'B': '#999999', 'C': '#666666', 'D': '#ffffff', 'E': '#2b2b2b'}
neu = {
    '2795': schattiere(maske(plus), GRAU, glanz=((2, 6), (6, 2))),
    '265F': schattiere(maske(bauer), GRAU, glanz=((7, 3), (6, 4))),
    '1F3B6': noten_grid(),
}
if __name__ == '__main__':
    p = os.path.join(HIER, 'glyphen.json'); k = json.load(open(p, encoding='utf-8'))
    for cp, g in neu.items():
        alt = k.get(cp, {})
        g['zeichen'] = alt.get('zeichen', chr(int(cp, 16)))
        k[cp] = g
        print(cp); print('\n'.join(g['z']))
    json.dump(k, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
