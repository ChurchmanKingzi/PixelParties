# -*- coding: utf-8 -*-
"""Sleeve: Göttliches Gleichgewicht – die goldene Waage vor ihrer Galaxie, beides direkt aus den Ebenen von
MotiveEgypt.xcf (Karte „Divine Gift of Balance“, Repo PixelPartiesSprites). In den Schalen: die Sonne aus
„Light Ball“ und der Mond aus „The Cosmic Depths“ (aus den Kartenbildern freigestellt)."""
import numpy as np
from PIL import Image
from kit import Canvas, up, silhouette, save, cutrule, fill_holes
from xcfkit import sprite

E = 'MotiveEgypt'
NW, NH = 84, 117
cv = Canvas(NW, NH)
gal = sprite('eg_galaxy', E, [84])                       # Kartenhintergrund, 320×240
cx, cy = 145, 118                                         # Galaxienkern
cv.a[:] = gal[cy - 62:cy - 62 + NH, cx - NW // 2:cx - NW // 2 + NW, :3]

scale = sprite('eg_scale', E, [83])                       # Waage, 60×39
sun_full = cutrule('Light Ball', (30, 14, 68, 50),
                   lambda c: ((c[..., 0] > 200) & (c[..., 1] > 200) & (c[..., 2] < 200)) | (c.min(-1) > 235), largest=1)
sun = np.array(Image.fromarray(sun_full).resize((11, 11), Image.NEAREST))
moon = fill_holes(cutrule('The Cosmic Depths', (34, 1, 50, 17),
                          lambda c: (c.max(-1) > 90) & ((c.max(-1) - c.min(-1)) < 70), largest=1))

sx, sy = (NW - scale.shape[1]) // 2, 44
pany = sy + 24                                            # Oberkante der Schalen
for body, px in ((sun, sx + 7), (moon, sx + 53)):
    cv.paste(body, px - body.shape[1] // 2, pany - body.shape[0] + 2)
cv.paste(silhouette(scale, (5, 10, 40)), sx + 1, sy + 1, alpha=0.5)
cv.paste(scale, sx, sy)

big = Canvas(250, 350)
u = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), 3)[..., :3]
big.a[:] = u[:350, :250]
for i, c in enumerate([(40, 25, 0), (230, 160, 20), (255, 230, 120), (40, 25, 0)]):
    big.a[i, :] = c; big.a[-1 - i, :] = c; big.a[:, i] = c; big.a[:, -1 - i] = c
print(save(big, '10_divine_balance.png'))
