# -*- coding: utf-8 -*-
"""Verkleinert den riesigen Plüschhasen Bubbles (120x125) auf Hero-Größe (1/3).

Pixelart-gerechte Blockreduktion 3x3 -> 1:
* Linien/Kontur haben Vorrang (>= 2 dunkle Pixel im Block -> Linie),
* sonst Transparenz (>= 5 leere Pixel) bzw. die häufigste Füllfarbe,
* danach wird eine geschlossene 1-px-Kontur um die Silhouette gezogen.
Ergebnis: src/bubbles-the-bouncy-bunny.png
"""
from collections import Counter
from PIL import Image
import numpy as np

SRC = np.array(Image.open('src/bubbles-the-bouncy-bunny-original.png').convert('RGBA')).astype(int)
F = 3
LINE = (13, 19, 26, 255)
DARK_MIN = 4                     # so viele dunkle Pixel (von 9) machen eine Linie


def is_dark(c):
    return c[3] and max(c[:3]) < 40


def dark_counts():
    h, w = SRC.shape[0] // F + 1, SRC.shape[1] // F + 1
    cnt = np.zeros((h, w), int)
    for by in range(h):
        for bx in range(w):
            blk = SRC[by * F:(by + 1) * F, bx * F:(bx + 1) * F].reshape(-1, 4)
            cnt[by, bx] = sum(1 for c in blk if is_dark(c))
    return cnt


def thin(mask):
    """Zhang-Suen-Skelettierung: Linien auf 1 px Breite ausdünnen."""
    m = mask.copy().astype(np.uint8)
    h, w = m.shape
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            rem = []
            for y in range(1, h - 1):
                for x in range(1, w - 1):
                    if not m[y, x]:
                        continue
                    p = [m[y - 1, x], m[y - 1, x + 1], m[y, x + 1], m[y + 1, x + 1],
                         m[y + 1, x], m[y + 1, x - 1], m[y, x - 1], m[y - 1, x - 1]]
                    b = sum(p)
                    a = sum(1 for k in range(8) if p[k] == 0 and p[(k + 1) % 8] == 1)
                    if not (2 <= b <= 6 and a == 1):
                        continue
                    if step == 0 and p[0] * p[2] * p[4] == 0 and p[2] * p[4] * p[6] == 0:
                        rem.append((y, x))
                    if step == 1 and p[0] * p[2] * p[6] == 0 and p[0] * p[4] * p[6] == 0:
                        rem.append((y, x))
            for y, x in rem:
                m[y, x] = 0
            changed = changed or bool(rem)
    return m


def reduce():
    h, w = SRC.shape[0] // F + 1, SRC.shape[1] // F + 1
    out = np.zeros((h, w, 4), int)
    for by in range(h):
        for bx in range(w):
            blk = SRC[by * F:(by + 1) * F, bx * F:(bx + 1) * F].reshape(-1, 4)
            if len(blk) == 0:
                continue
            dark = sum(1 for c in blk if is_dark(c))
            empty = sum(1 for c in blk if c[3] == 0)
            need = 7 if by <= 10 else DARK_MIN      # Ohren: heller Rand soll bleiben
            if dark >= need:
                out[by, bx] = LINE
            elif empty >= 5:
                continue
            else:
                cnt = Counter(tuple(c) for c in blk if c[3] and not is_dark(c))
                if cnt:
                    out[by, bx] = cnt.most_common(1)[0][0]
    # innere Linien (Gesicht, Pfoten, Naht): niedrige Schwelle, dann auf 1 px ausdünnen
    inner = (dark_counts() >= 2) & (out[..., 3] > 0)
    inner[:11, :] = False                                # Ohren ohne Innenlinien
    for y, x in zip(*np.where(thin(inner))):
        out[y, x] = LINE
    # geschlossene Kontur: opake Randpixel (Nachbar leer) werden Linie
    res = out.copy()
    hh, ww = out.shape[:2]
    for y in range(hh):
        for x in range(ww):
            if out[y, x, 3] and not is_dark(out[y, x]):
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if not (0 <= nx < ww and 0 <= ny < hh) or out[ny, nx, 3] == 0:
                        res[y, x] = LINE
                        break
    # auf Inhalt zuschneiden (1 px Rand)
    ys, xs = np.where(res[..., 3] > 0)
    return res[max(0, ys.min() - 1):ys.max() + 2, max(0, xs.min() - 1):xs.max() + 2]


def face_touchup(a):
    """Gesicht von Hand nachgezeichnet (Positionen aus dem Original / 3):
    Schlafaugen Zeile 14, kleines Lächeln Zeile 15/16, Kopf-Körper-Linie Zeile 18."""
    fill = tuple(int(v) for v in a[19, 20])
    shade = tuple(int(v) for v in a[19, 14])
    for y in range(15, 18):
        for x in range(13, 27):
            if a[y, x, 3] and is_dark(a[y, x]):
                a[y, x] = shade if x <= 15 else fill
    for x, y in ((17, 15), (18, 16), (19, 16), (20, 16), (21, 15)):
        a[y, x] = LINE
    for x in range(13, 27):
        a[18, x] = LINE
    # Bauchnaht gestrichelt wie die Stiche im Original
    for y in range(19, a.shape[0]):
        if is_dark(a[y, 19]) and a[y, 18, 3] and not is_dark(a[y, 18]):
            if y % 2:
                a[y, 19] = (88, 88, 88, 255)
    return a


if __name__ == '__main__':
    small = face_touchup(reduce())
    Image.fromarray(small.astype(np.uint8)).save('src/bubbles-the-bouncy-bunny.png')
    print('Größe:', small.shape[1], 'x', small.shape[0])
