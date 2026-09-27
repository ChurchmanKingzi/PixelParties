# -*- coding: utf-8 -*-
"""Sleeve 44 – „Dragon's Hoard“ (Runde 3b überarbeitet): Stillleben in der dunklen Schatzkammer. Das glühende
Flaming Dragonegg liegt eingebettet im Goldberg und erhellt die Kammer; links eine Schatztruhe, rechts lauert ein
Mimic zwischen den Münzen, vorne funkeln Edelsteine mit farbigem Schein.

Skalierung (Regel A): ALLES 3× – Ei, Mimic, Truhe, Goldberge, Edelsteine und die Ziegelwand. Licht/Schein als
Dither im 3×-Raster.

Vollständigkeit (Regel B): Ei [2] vollständig (in der Szene „Sichtbar #317“ nur im Lavasee versunken, daher match
0.53); Truhe [1386] und Goldberg [1378] wie in „Wealth“ (Sichtbar [122]); Mimic [914] ist eine geschlossene Figur.

Quellen (Motive.xcf): 2 „Flaming Dragonegg“, 914 „Mimic“, 1378 „Wealth #2“ (Goldhaufen), 1386 „Treasure Chest“,
Edelsteine 1171 Ruby, 1173 Emerald, 1175 Sapphire, 1177 Topaz, 1181 Amethyst mit ihren Leucht-Ebenen
1172/1174/1176/1178/1182 (Farbe des Scheins), 1081 „Schatzgrotte“ (Ziegelwand).
"""
import math
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
K = 3
cv = Canvas(W2, H2)
gro = layer(B, 1081)[75:315, 39:359, :3]


def dglow(col, cx, cy, r, amt, sy=1.0):
    """Lichtschein, fein gedithert (wie der Himmel in 13/34)"""
    dither_blend(cv, col, lambda x, y: max(0.0, 1 - math.hypot(x - cx, (y - cy) * sy) / r) * amt,
                 x0=cx - r, y0=int(cy - r / sy), x1=cx + r, y1=int(cy + r / sy))


# ---------------------------------------------------------------- Ziegelwand (3×), im Dunkeln
brick = gro[80:110, 210:254]
wall = mirror_tile(brick, W2 // K + 2, H2 // K + 2, ox=4)
cv.a[:] = up(rgba(wall), K)[:H2, :W2, :3]
cv.a[:] = hsv_shift(rgba(cv.a), 0, 0.6, 0.5)[..., :3]
# nach oben ins Dunkle: Abdunkelung in Stufen je Ziegelreihe-Drittel (3er-Bänder, kein Raster-Muster)
for by in range(H2 // K + 1):
    f = min(1.0, 0.18 + 0.82 * (by * K / 230) ** 1.4)
    cv.a[by * K:by * K + K] = (cv.a[by * K:by * K + K] * f).astype(np.uint8)

EGX, EGY = 125, 190
dglow((255, 160, 40), EGX, EGY, 150, 0.55, sy=0.9)

# ---------------------------------------------------------------- Schätze
egg = lay(B, 2); mimic = lay(B, 914); heap = lay(B, 1378); chest = lay(B, 1386)
gem_ids = (1171, 1175, 1173, 1181, 1177)
gems = [lay(B, i) for i in gem_ids]
glows = []
for i in gem_ids:
    g = layer(B, i + 1); m = g[..., 3] > 200
    glows.append(tuple(int(v) for v in g[m][:, :3].mean(0)))
for n, s in dict(egg=egg, mimic=mimic, heap=heap, chest=chest).items():
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'g44_%s.png' % n))

H3 = up(heap, K)                                    # 357×105
# hinterer Goldberg (etwas dunkler), Ei, Goldberg davor, vorderer Goldberg
cv.paste(darken(H3, 0.75), (W2 - H3.shape[1]) // 2 + 20, 180)
E = up(egg, K)
ex, ey = EGX - E.shape[1] // 2, 262 - E.shape[0]
cv.paste(E, ex, ey)
c3 = up(chest, K)
cv.paste(silhouette(c3, (30, 12, 0)), 12 + K, 262 - c3.shape[0] + K, alpha=0.5)
cv.paste(c3, 12, 262 - c3.shape[0])
m3 = up(mimic, K)
cv.paste(silhouette(m3, (30, 12, 0)), 184 + K, 258 - m3.shape[0] + K, alpha=0.5)
cv.paste(m3, 184, 258 - m3.shape[0])
cv.paste(flip(H3), (W2 - H3.shape[1]) // 2 - 30, 240)    # bettet Ei, Truhe, Mimic ein
cv.paste(H3, (W2 - H3.shape[1]) // 2 + 6, H2 + 30 - H3.shape[0])             # vorderer Haufen, unten angeschnitten

# Edelsteine (3×) vorn, jeder mit farbigem Schein
spots = [(28, 326), (78, 344), (132, 330), (184, 344), (230, 328)]
for col, (gx, gy) in zip(glows, spots):
    dglow(col, gx, gy - 18, 34, 0.7)
for g, (gx, gy) in zip(gems, spots):
    u = up(g, K)
    cv.paste(silhouette(u, (60, 20, 0)), gx - u.shape[1] // 2 + K, gy - u.shape[0] + K, alpha=0.5)
    cv.paste(u, gx - u.shape[1] // 2, gy - u.shape[0])

vignette(cv, 0.45, 0.6)
print(save(cv, '44_dragon_hoard.png'))
