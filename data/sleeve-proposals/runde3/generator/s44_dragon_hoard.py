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


def dglow(col, cx, cy, r, amt, y1=H2, sy=1.0):
    """Lichtschein im 3×-Raster gedithert"""
    for by in range(max(0, (cy - r) // K), min(y1, cy + r) // K + 1):
        for bx in range(max(0, (cx - r) // K), min(W2, cx + r) // K + 1):
            d = math.hypot(bx * K + 1 - cx, (by * K + 1 - cy) * sy) / r
            a = max(0.0, 1 - d) * amt
            q = math.floor(a * 4 + BAYER4[by % 4, bx % 4]) / 4
            if q > 0:
                y0, x0 = by * K, bx * K
                sub = cv.a[y0:y0 + K, x0:x0 + K].astype(float)
                cv.a[y0:y0 + K, x0:x0 + K] = (sub * (1 - q) + np.array(col) * q).astype(np.uint8)


# ---------------------------------------------------------------- Ziegelwand (3×), im Dunkeln
brick = gro[80:110, 210:254]
wall = mirror_tile(brick, W2 // K + 2, H2 // K + 2, ox=4)
cv.a[:] = up(rgba(wall), K)[:H2, :W2, :3]
cv.a[:] = hsv_shift(rgba(cv.a), 0, 0.6, 0.3)[..., :3]
# nach oben ins Schwarze
for by in range(0, 60):
    t = 1 - by / 60
    for bx in range(W2 // K + 1):
        if t * 1.1 > BAYER4[by % 4, bx % 4]:
            cv.rect(bx * K, by * K, bx * K + K, by * K + K, (10, 6, 4))

EGX, EGY = 125, 200
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
cv.paste(darken(H3, 0.8), (W2 - H3.shape[1]) // 2 + 20, 262 - H3.shape[0])
E = up(egg, K)
ex, ey = EGX - E.shape[1] // 2, 272 - E.shape[0]
cv.paste(E, ex, ey)
c3 = up(chest, K)
cv.paste(silhouette(c3, (30, 12, 0)), 14 + K, 268 - c3.shape[0] + K, alpha=0.5)
cv.paste(c3, 14, 268 - c3.shape[0])
m3 = up(mimic, K)
cv.paste(silhouette(m3, (30, 12, 0)), 186 + K, 262 - m3.shape[0] + K, alpha=0.5)
cv.paste(m3, 186, 262 - m3.shape[0])
cv.paste(flip(H3), (W2 - H3.shape[1]) // 2 - 30, 300 - H3.shape[0] + 26)    # bettet Ei, Truhe, Mimic ein
cv.paste(H3, (W2 - H3.shape[1]) // 2 + 6, H2 + 30 - H3.shape[0])             # vorderer Haufen, unten angeschnitten

# Edelsteine (3×) vorn, jeder mit farbigem Schein
spots = [(40, 318), (92, 338), (150, 322), (206, 336), (238, 300)]
for col, (gx, gy) in zip(glows, spots):
    dglow(col, gx, gy - 18, 34, 0.7)
for g, (gx, gy) in zip(gems, spots):
    u = up(g, K)
    cv.paste(silhouette(u, (60, 20, 0)), gx - u.shape[1] // 2 + K, gy - u.shape[0] + K, alpha=0.5)
    cv.paste(u, gx - u.shape[1] // 2, gy - u.shape[0])

vignette(cv, 0.45, 0.6)
print(save(cv, '44_dragon_hoard.png'))
