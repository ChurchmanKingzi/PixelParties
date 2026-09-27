# -*- coding: utf-8 -*-
"""Sleeve 44 – „Dragon's Hoard“: Stillleben in der Schatzkammer. Auf einem Goldberg thront glühend das
Flaming Dragonegg, davor liegen die sieben Edelsteine (Ruby, Emerald, Sapphire, Topaz, Cobalt, Amethyst, Amber) mit
ihrem farbigen Schein, links Truhe und Geldsäcke – und rechts grinst zwischen den Schätzen ein Mimic. Hintergrund:
goldene Ziegelwand mit den steinernen Wandfratzen und Flechtboden aus der „Schatzgrotte“.

Quellen (Motive.xcf): 2 „Flaming Dragonegg“, 914 „Mimic“, 1378 „Wealth #2“ (Goldhaufen), 1379 „Wealth“
(Truhe mit Säcken), 1386 „Treasure Chest“, 1171/1173/1175/1177/1179/1181/1183 Edelsteine und ihre Leucht-Ebenen
1172/1174/1176/1178/1180/1182/1184 (Farbe des Scheins), 1081 „Schatzgrotte“ (Ziegelwand, Wandfratzen, Flechtboden).
"""
import math
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
cv = Canvas(W2, H2)
gro = layer(B, 1081)[75:315, 39:359, :3]

# ---------- Wand (2×) und Boden (2×)
brick = gro[80:110, 210:254]
WALL = 236
cv.a[:WALL] = mirror_tile(up(rgba(brick), 2)[..., :3], W2, WALL, ox=6)
floor = gro[150:190, 258:316]
cv.a[WALL:] = mirror_tile(up(rgba(floor), 2)[..., :3], W2, H2 - WALL)
cv.a[WALL - 2:WALL] = (90, 40, 10)
cv.a[:] = (hsv_shift(rgba(cv.a), 0, 0.55, 0.42)[..., :3])            # Gewölbe im Dunkeln
# Dämmerlicht: Wand oben dunkel, Glut um das Ei
dither_blend(cv, (8, 3, 0), lambda x, y: max(0.0, 1 - y / 160) * 0.6, y1=WALL)
EGX, EGY = 125, 176
dither_blend(cv, (255, 170, 40), lambda x, y: max(0.0, 1 - math.hypot(x - EGX, (y - EGY) * 0.9) / 125) * 0.55)

# Wandfratzen (Stein, 3×) links und rechts oben
faces = parts(rgba(gro[56:76, 120:150].copy()), dil=0)
face_box = gro[56:76, 124:146]
# Fratze freistellen: Graustufen-Pixel (Stein) der Ebene
fa = rgba(face_box.copy()); c = face_box.astype(int)
stone = (c.max(-1) - c.min(-1) < 40) | ((c[..., 0] > 150) & (c[..., 1] < 60))
fa[..., 3] = np.where(stone, 255, 0)
fa = max(parts(fa, dil=0), key=lambda p: (p[..., 3] > 0).sum())
fu = up(fa, 3)
for x in (26, W2 - 26 - fu.shape[1]):
    paste_shadow(cv, fu, x, 40, dx=3, dy=3, alpha=0.5)

# ---------- Schätze
heap = lay(B, 1378)
egg = lay(B, 2)
mimic = lay(B, 914)
wealth = lay(B, 1379)
chest = lay(B, 1386)
gems = [lay(B, i) for i in (1171, 1173, 1175, 1177, 1179, 1181, 1183)]
glows = []
for i in (1172, 1174, 1176, 1178, 1180, 1182, 1184):
    g = layer(B, i); m = g[..., 3] > 200
    glows.append(tuple(int(v) for v in g[m][:, :3].mean(0)))
for n, s in dict(egg=egg, mimic=mimic, heap=heap, wealth=wealth, chest=chest).items():
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'g44_%s.png' % n))

h2 = up(heap, 2)
cv.paste(h2, (W2 - h2.shape[1]) // 2, 262 - h2.shape[0])            # hinterer Goldberg
e4 = up(egg, 4)
cv.paste(silhouette(e4, (60, 20, 0)), EGX - e4.shape[1] // 2 + 4, 244 - e4.shape[0] + 4, alpha=0.4)
cv.paste(e4, EGX - e4.shape[1] // 2, 244 - e4.shape[0])
# Goldhaufen vor dem Fuß des Eis (das Ei liegt eingebettet)
cv.paste(flip(h2), (W2 - h2.shape[1]) // 2 - 6, 272 - h2.shape[0] + 22)
# vorderer Goldberg (gespiegelt), halb unten angeschnitten
cv.paste(flip(h2), (W2 - h2.shape[1]) // 2 + 10, H2 - 40)
w2 = up(wealth, 2)
cv.paste(w2, 8, 286 - w2.shape[0])
c3 = up(chest, 2)
cv.paste(c3, 60, 300 - c3.shape[0])
m4 = up(mimic, 4)
paste_shadow(cv, m4, W2 - 12 - m4.shape[1], 300 - m4.shape[0], dx=4, dy=0, alpha=0.4)

# Edelsteine (2×) im Vordergrund, jeder mit gedithertem Schein in seiner Farbe
spots = [(52, 322), (84, 336), (112, 318), (140, 338), (26, 342), (168, 322), (112, 290)]
for g, col, (gx, gy) in zip(gems, glows, spots):
    u = up(g, 2)
    cx, cy = gx, gy - u.shape[0] // 2
    dither_blend(cv, col, lambda x, y, cx=cx, cy=cy: max(0.0, 1 - math.hypot(x - cx, y - cy) / 20) * 0.75,
                 x0=cx - 22, y0=cy - 22, x1=cx + 22, y1=cy + 22)
for g, (gx, gy) in zip(gems, spots):
    u = up(g, 2)
    paste_shadow(cv, u, gx - u.shape[1] // 2, gy - u.shape[0], dx=2, dy=2, col=(60, 20, 0), alpha=0.5)

vignette(cv, 0.5, 0.6)
frame(cv)
print(save(cv, '44_dragon_hoard.png'))
