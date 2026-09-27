# -*- coding: utf-8 -*-
"""12 Aquatic Crest – Wappen-Komposition ohne Text: der riesige Wasserschild (mit Eiszapfen) hängt wie ein
Wappen an der weißen Burgmauer zwischen zwei Bannern; davor steigt die Aquatic-Heldin auf einer Wasserfontäne
empor, links und rechts regnen Wasserpfeile.

Quellen (MotiveDeepsea.xcf):
  Ebene 16 „Aquatic Shield #2“ + 14 „Aquatic Shield #4“ (Schild + Eiszapfen, Karte „Aquatic Shield“), 4×
  Ebene 8 „Aquatic Arrows #3“ + 7 „Aquatic Arrows #4“ (Heldin mit leuchtenden Augen + Arme, Karte „Aquatic Arrows“), 5×
  Ebene 23 „Aquatic Spear“ – Wasserfontäne (Karte „Aquatic Spear“), 4×
  Ebene 5 „Aquatic Arrows #9“ – Wasserpfeile (Karte „Aquatic Arrows“), 3×
  Ebene 11 „Aquatic Arrows“ – Gischt (Karte „Aquatic Arrows“), 2×
  Ebene 260 „Lolek #1“ – grüne Banner, 3×
  Ebene 263 „Castle“ – weiße Ziegelmauer (Kachel 16×16, 2×) und Wasserbecken-Kachel (2×)
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
D = 'MotiveDeepsea'
cv = Canvas(W, H)

brick = sprite('b12_ds263_brick', D, [263], box=(88, 208, 104, 224))
cv.a[:] = np.repeat(np.repeat(tile_rgb(brick, W, H), 2, 0), 2, 1)[:H, :W]
cv.a[:] = (cv.a.astype(float) * np.array([0.62, 0.66, 0.78])).astype(np.uint8)     # kühles Dämmerlicht
# Wasserbecken unten
WY = 300
water = sprite('b12_ds263_water', D, [263], box=(96, 286, 112, 302))
wt = np.repeat(np.repeat(tile_rgb(water, W, H - WY), 2, 0), 2, 1)[:H - WY, :W]
cv.a[WY:] = wt
cv.a[WY - 4:WY] = (170, 170, 185); cv.a[WY - 4] = (220, 220, 230); cv.a[WY - 1] = (90, 90, 110)   # Beckenrand

# Lichtkranz hinter dem Schild (gedithert, Wasserfarben)
radial(cv, 125, 200, 112, (120, 160, 215), 0.7, power=0.7)
radial(cv, 125, 200, 76, (190, 220, 250), 0.6, power=0.9)

# Banner
ban = [p for p in parts(sprite('b12_ds260', D, [260]), dil=0, minpx=30) if p.shape[0] > 20]
B3 = up(ban[0], 3)
cv.paste(B3, 6, 0)
cv.paste(flip(B3), W - 6 - B3.shape[1], 0)

# Schild + Eiszapfen
shield = sprite('b12_ds16_14', D, [16, 14])
S5 = up(shield, 4)
sx, sy = 125 - S5.shape[1] // 2, 8
cv.paste(S5, sx, sy)

# Wasserpfeile links/rechts
arrows = parts(sprite('b12_ds5', D, [5]), dil=0, minpx=10)
arrows.sort(key=lambda p: -p.shape[0])
a0 = up(arrows[0], 3)
for x, y in ((14, 130), (50, 176), (W - 14 - a0.shape[1], 130), (W - 50 - a0.shape[1], 176)):
    cv.paste(a0, x, y)

# Fontäne + Heldin
geyser = sprite('b12_ds23', D, [23])
G5 = up(geyser, 4)
her = sprite('b12_ds8_7', D, [8, 7])
H5 = up(her, 5)
gx, gy = 125 - G5.shape[1] // 2, H - G5.shape[0] + 16
hx, hy = 125 - H5.shape[1] // 2 + 1, gy - H5.shape[0] + 3 * 5
cv.paste(H5, hx, hy)
cv.paste(G5, gx, gy)

# Gischt an der Wasserlinie
foam = sprite('b12_ds11', D, [11])
F2 = up(foam, 2)
cv.paste(F2, -20, WY + 14)
cv.paste(flip(F2), W - F2.shape[1] + 20, WY + 18)

vignette(cv, 0.45, 0.6)
print(save(cv, '12_aquatic_crest.png'))
