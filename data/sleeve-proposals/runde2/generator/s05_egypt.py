# -*- coding: utf-8 -*-
"""Sleeve: Grabkammer des Pharaos – alle Figuren und Texturen direkt aus den Ebenen von
MotiveEgypt.xcf (Repo PixelPartiesSprites): Ren, Auge von Ren, Ushabti, Royal Mummy Guards, Khet,
goldene Urnen, Ziegelwand und Sandplatte."""
import numpy as np
from kit import Canvas, up, flip, silhouette, save
from xcfkit import sprite, parts, split_x, scene_sprite

B = 'MotiveEgypt'
NW, NH = 125, 175
cv = Canvas(NW, NH)

wall = sprite('eg_wall', B, [185])[0:16, 0:16]          # Ziegelwand (Periode 16×8 → 16×16-Kachel)
sand = scene_sprite('eg_eyeofren_wall', B, 61, (431, 332), (0, 0, 76, 10))   # Mauer der Eye-of-Ren-Karte
for y in range(NH):
    for x in range(NW):
        cv.a[y, x] = wall[y % 16, x % 16, :3]

ren = sprite('eg_ren', B, [188])
eye = sprite('eg_eye', B, [99])
ush = parts(sprite('eg_ushabti', B, [168]))             # links, Mitte (mit Flamme), rechts
grd = split_x(sprite('eg_guards', B, [183]))            # zwei Wächter
khet = sprite('eg_khet', B, [214])
urns = parts(sprite('eg_urns', B, [181]), dil=0)             # vier Urnen

def put(s, x, y, fl=False, sh=0.45, anchor='tl'):
    s2 = flip(s) if fl else s
    h, w = s2.shape[:2]
    if anchor == 'c': x -= w // 2
    if anchor == 'b': x -= w // 2; y -= h
    if sh: cv.paste(silhouette(s2, (40, 12, 0)), x + 1, y + 1, alpha=sh)
    cv.paste(s2, x, y)

# Sandsteintafel mit dem Auge
PY0, PY1 = 4, 44
for y in range(PY0, PY1):
    for x in range(4, NW - 4):
        cv.a[y, x] = sand[2 + y % 4, 8 + x % 8, :3]
for x in range(3, NW - 3):
    cv.a[PY0 - 1, x] = (60, 30, 10); cv.a[PY1, x] = (60, 30, 10)
for y in range(PY0 - 1, PY1 + 1):
    cv.a[y, 3] = (60, 30, 10); cv.a[y, NW - 4] = (60, 30, 10)
put(eye, NW // 2, PY0 + (PY1 - PY0 - eye.shape[0]) // 2, anchor='c', sh=0)

X0 = NW // 2
put(up(ren, 2), X0, 50, anchor='c', sh=0.5)
put(ush[1], 10, 58, sh=0.5); put(ush[1], NW - 10 - ush[1].shape[1], 58, fl=True, sh=0.5)
put(ush[0], 4, 104); put(ush[2], NW - 4 - ush[2].shape[1], 104)
put(grd[0], 26, 126); put(grd[1], NW - 26 - grd[1].shape[1], 126)
put(khet, X0, 160, anchor='b')
put(urns[0], 5, 159); put(urns[1], 17, 161); put(urns[-1], NW - 5 - urns[-1].shape[1], 159); put(urns[-2], NW - 17 - urns[-2].shape[1], 161)

big = Canvas(250, 350)
big.a[:] = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), 2)[..., :3]
for i, c in enumerate([(40, 20, 5), (180, 130, 20), (240, 200, 60), (40, 20, 5)]):
    big.a[i, :] = c; big.a[-1 - i, :] = c; big.a[:, i] = c; big.a[:, -1 - i] = c
print(save(big, '05_pharaoh_tomb.png'))
