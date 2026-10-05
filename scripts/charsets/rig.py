# -*- coding: utf-8 -*-
"""Raster-Grundlagen für die RM2003-Laufsheets (Charsets).

Format wie RPG Maker 2000/2003: je Figur 3 Spalten (Schritt A | Stand | Schritt B) x 4 Zeilen
(Hoch | Rechts | Runter | Links); Standardzelle 24x32; ein Sheet = 4x2 Figuren (288x256).
Index 0 der Palette ist die Transparenz (hier das RTP-Grün 32,156,0).

Raster sind Textraster: jeder Buchstabe ist ein Palette-Platz, '.' ist durchsichtig.
"""
import sys
import numpy as np
from PIL import Image

DIRS = ('up', 'right', 'down', 'left')      # Zeilenfolge im RM2003-Charset
FRAMES = ('a', 'stand', 'b')                # Spaltenfolge
KEY = (32, 156, 0)                          # Transparenzfarbe (Palette-Index 0)
CELL = (24, 32)                             # RM2003-Standardzelle (Breite, Höhe)

PROBLEMS = []          # gesammelte Raster-Fehler; check() meldet sie gebündelt


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def G(text):
    """Mehrzeiliger Text -> Liste gleich langer Zeilen. Ungleiche Längen werden NICHT still aufgefüllt
    (das würde Pixel unbemerkt verschieben), sondern gesammelt gemeldet: check() wirft sie gebündelt."""
    rows = [r.rstrip() for r in text.strip('\n').split('\n')]
    lens = [len(r) for r in rows]
    w = max(set(lens), key=lens.count)          # häufigste Länge = Sollbreite
    if any(n != w for n in lens):
        f = sys._getframe(1)
        bad = ', '.join(f'Zeile {i} = {n}' for i, n in enumerate(lens) if n != w)
        PROBLEMS.append(f'{f.f_code.co_filename.split("/")[-1]}:{f.f_lineno}: Sollbreite {w}, abweichend: {bad}')
        rows = [r[:w].ljust(w, '.') for r in rows]
    return rows


def check():
    if PROBLEMS:
        raise ValueError('Fehlerhafte Raster:\n  ' + '\n  '.join(PROBLEMS))


def flip(rows):
    return [r[::-1] for r in rows]


def shift_row(r, k):
    """Zeile um k Spalten nach rechts (k<0: links) schieben, ohne Breite zu ändern."""
    if k == 0:
        return r
    w = len(r)
    if k > 0:
        return ('.' * k + r)[:w]
    return (r[-k:] + '.' * (-k))[:w]


class Canvas:
    def __init__(self, w=CELL[0], h=CELL[1]):
        self.w, self.h = w, h
        self.g = [['.'] * w for _ in range(h)]

    def stamp(self, rows, x, y):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in '. ':
                    continue
                xx, yy = x + i, y + j
                if 0 <= xx < self.w and 0 <= yy < self.h:
                    self.g[yy][xx] = ch
                else:
                    PROBLEMS.append(f'Pixel außerhalb der Zelle {self.w}x{self.h}: ({xx},{yy})')

    def mirrored(self):
        c = Canvas(self.w, self.h)
        c.g = [r[::-1] for r in self.g]
        return c

    def rgba(self, pal):
        a = np.zeros((self.h, self.w, 4), np.uint8)
        for y in range(self.h):
            for x in range(self.w):
                ch = self.g[y][x]
                if ch != '.':
                    if ch not in pal:
                        raise KeyError(f'Palette-Platz {ch!r} fehlt (x={x}, y={y})')
                    a[y, x, :3] = rgb(pal[ch])
                    a[y, x, 3] = 255
        return a

    def text(self):
        return '\n'.join(''.join(r) for r in self.g)


def save_rm2k3(rgba, path):
    """RM2000/2003-tauglich: 8-Bit-Palette, Index 0 = Transparenzgrün."""
    h, w = rgba.shape[:2]
    cols = {}
    idx = np.zeros((h, w), np.uint8)
    for y in range(h):
        for x in range(w):
            if rgba[y, x, 3] == 0:
                idx[y, x] = 0
            else:
                c = tuple(int(v) for v in rgba[y, x, :3])
                if c == KEY:
                    raise ValueError('Figurenfarbe kollidiert mit der Transparenzfarbe')
                if c not in cols:
                    if len(cols) >= 255:
                        raise ValueError('mehr als 255 Farben')
                    cols[c] = len(cols) + 1
                idx[y, x] = cols[c]
    pal = [KEY] + [c for c, _ in sorted(cols.items(), key=lambda kv: kv[1])]
    im = Image.fromarray(idx, 'P')
    im.putpalette([v for c in pal for v in c] + [0] * (768 - 3 * len(pal)))
    im.save(path, optimize=True)
    return len(pal)


def zoom(rgba, k, bg=(52, 66, 56, 255)):
    im = Image.fromarray(rgba, 'RGBA').resize((rgba.shape[1] * k, rgba.shape[0] * k), Image.NEAREST)
    b = Image.new('RGBA', im.size, bg)
    b.alpha_composite(im)
    return b
