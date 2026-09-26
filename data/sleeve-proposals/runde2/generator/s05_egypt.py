# -*- coding: utf-8 -*-
"""Sleeve: Grabkammer des Pharaos – Ziegelwand und Ushabti aus „Ushabti of the Great Pharaoh“,
Auge aus „The Eye of Ren“, Totenmaske aus „Soul Shard Ren“, Wächter aus „Noble Mummy Guards“,
goldene Urnen aus „Sarcophagus of Sealed Magic“, Anubis aus „Soul Shard Khet“."""
import numpy as np
from kit import *

NW, NH = 125, 175
cv = Canvas(NW, NH)
ush_card = nat('Ushabti of the Great Pharaoh')
tile = ush_card[2:10, 0:8]
for y in range(NH):
    for x in range(NW):
        cv.a[y, x] = tile[y % 8, x % 8]

def brickless(c):
    h = hsv_of(c); sat = c.max(-1) - c.min(-1); v = c.max(-1)
    return ~((h[..., 0] >= 5) & (h[..., 0] <= 30) & (sat >= 70) & (v < 235))
eye = cutrule('The Eye of Ren', (16, 7, 63, 43),
              lambda c: (c.max(-1) < 70) | ((c.max(-1) > 215) & ((c.max(-1) - c.min(-1)) < 40)) |
                        ((c[..., 0] > 200) & (c[..., 1] > 200) & (c[..., 2] < 120)), largest=0)
ren = cutf('Soul Shard Ren', (15, 3, 52, 45), tol=22, largest=1, clear=[(15, 3, 18, 20)])
ush_f = cutrule('Ushabti of the Great Pharaoh', (30, 3, 49, 46), brickless)
ush_l = cutrule('Ushabti of the Great Pharaoh', (3, 12, 23, 47), brickless)
ush_r = cutrule('Ushabti of the Great Pharaoh', (55, 12, 75, 47), brickless)
guard = cutrule('Noble Mummy Guards', (7, 8, 40, 44), brickless)
urn = cutrule('Sarcophagus of Sealed Magic', (2, 23, 18, 39),
              lambda c: (hsv_of(c)[..., 0] > 25) & (hsv_of(c)[..., 0] < 50) & ((c.max(-1) - c.min(-1)) > 80))
anubis = cutf('Soul Shard Khet', (28, 13, 50, 40), tol=30, largest=1)
ha = hsv_of(anubis[..., :3].astype(int))
anubis[(ha[..., 0] > 190) & (ha[..., 0] < 240) & (ha[..., 1] > 60)] = 0

def put(s, x, y, k=1, fl=False, sh=0.45, anchor='tl'):
    s2 = up(flip(s) if fl else s, k)
    h, w = s2.shape[:2]
    if anchor == 'c': x -= w // 2
    if anchor == 'b': x -= w // 2; y -= h
    cv.paste(silhouette(s2, (40, 12, 0)), x + 1, y + 1, alpha=sh)
    cv.paste(s2, x, y)
    return x, y, w, h

# Sandstein-Band hinter dem Auge (Sand aus The Eye of Ren, wie auf der Karte)
eyecard = nat('The Eye of Ren')
PY0, PY1 = 4, 44
for y in range(PY0, PY1):
    for x in range(4, NW - 4):
        cv.a[y, x] = eyecard[2 + (y % 4), 8 + (x % 8)]
for x in range(3, NW - 3):
    cv.a[PY0 - 1, x] = (60, 30, 10); cv.a[PY1, x] = (60, 30, 10)
for y in range(PY0 - 1, PY1 + 1):
    cv.a[y, 3] = (60, 30, 10); cv.a[y, NW - 4] = (60, 30, 10)
put(eye, NW // 2, 6, 1, anchor='c', sh=0.0)

# Totenmaske groß in der Mitte
X0 = NW // 2
put(ren, X0, 48, 2, anchor='c', sh=0.5)
# Ushabti links/rechts, der mit Flamme darüber? -> Flammen-Ushabti je Seite gespiegelt
put(ush_f, 10, 56, 1, sh=0.5); put(ush_f, NW - 10 - ush_f.shape[1], 56, 1, fl=True, sh=0.5)
put(ush_l, 2, 104, 1); put(ush_r, NW - 2 - ush_r.shape[1], 104, 1)
# Wächter unten, einander zugewandt, dazwischen Anubis
put(guard, 26, 126, 1); put(guard, NW - 26 - guard.shape[1], 126, 1, fl=True)
put(anubis, X0, 160, 1, anchor='b')
put(urn, 6, 158, 1); put(urn, NW - 6 - urn.shape[1], 158, 1)

big = Canvas(W, H)
big.a[:] = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), 2)[..., :3]
for i, c in enumerate([(40, 20, 5), (180, 130, 20), (240, 200, 60), (40, 20, 5)]):
    big.a[i, :] = c; big.a[-1 - i, :] = c; big.a[:, i] = c; big.a[:, -1 - i] = c
print(save(big, '05_pharaoh_tomb.png'))
