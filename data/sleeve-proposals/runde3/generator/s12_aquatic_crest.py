# -*- coding: utf-8 -*-
"""12 Aquatic Crest – Wappen-Komposition ohne Text: Die Aquatic-Heldin steht auf einer Wasserfontäne und reckt
beide Fäuste – über ihr formt sich der große Wasserschild mit Eiskante wie ein Wappenschild. Zwei Paar
Wasserpfeile flankieren sie wie die Lanzen eines Wappens; dahinter, weit zurück, die weiße Burgmauer mit
zwei grünen Bannern im Lichtkranz.

Quellen (MotiveDeepsea.xcf):
  Ebene 16 „Aquatic Shield #2“ + 14 „Aquatic Shield #4“ – Wasserschild + Eiskante (Karte „Aquatic Shield“), 5×
  Ebene 8 „Aquatic Arrows #3“ + 7 „Aquatic Arrows #4“ – Heldin mit erhobenen Fäusten (gleiche Pose wie in der
    Karte „Aquatic Shield“: Ebenen 18+17), vollständig geprüft, 5×
  Ebene 23 „Aquatic Spear“ – Wasserfontäne/Gischtwolke (Karte „Aquatic Spear“), 5×
  Ebene 5 „Aquatic Arrows #9“ – lange Wasserpfeile (Karte „Aquatic Arrows“), 5×
  Ebene 260 „Lolek #1“ – grüne Banner, 2×;  Ebene 263 „Castle“ – weiße Ziegelmauer (Kachel 16×16), 2×
Skalierung: Hintergrund (Mauer, Banner, Lichtkranz) 2× und abgedunkelt; Schild, Heldin, Fontäne, Pfeile
  einheitlich 5×.
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
D = 'MotiveDeepsea'
cv = Canvas(W, H)
F = 5

# ---------- Hintergrund 2× ----------
NW, NH = 125, 175
bg = Canvas(NW, NH)
brick = sprite('b12_ds263_brick', D, [263], box=(88, 208, 104, 224))
bg.a[:] = tile_rgb(brick, NW, NH)
bg.a[:] = (bg.a.astype(float) * np.array([0.36, 0.33, 0.42])).astype(np.uint8)     # Dämmerlicht, weit hinten
# Strahlenkranz hinter dem Schild: harte Sektoren in drei Abstufungen (2×-Raster, kein Dithering)
CX, CY = 62, 50
LIGHT = np.array((236, 214, 150))           # goldener Schein (Bannergold)
for y in range(NH):
    for x in range(NW):
        ang = math.atan2(y + .5 - CY, x + .5 - CX)
        d = math.hypot(x + .5 - CX, y + .5 - CY)
        ray = (int((ang + math.pi) / (2 * math.pi) * 20) % 2 == 0)
        ring = 0 if d < 46 else (1 if d < 70 else (2 if d < 96 else 3))
        f = [0.55, 0.38, 0.22, 0.0][ring] * (1.0 if ray else 0.35)
        c = bg.a[y, x].astype(float)
        bg.a[y, x] = np.clip(c * (1 - f) + LIGHT * f, 0, 255)
ban = [p for p in parts(sprite('b12_ds260', D, [260]), dil=0, minpx=30) if p.shape[0] > 20]
B2 = darken(ban[0], 0.8)
bg.paste(B2, 6, 0)
bg.paste(flip(B2), NW - 6 - B2.shape[1], 0)
# Mauerfuß
bg.a[150:] = (bg.a[150:].astype(float) * 0.7).astype(np.uint8)
bg.a[150] = (150, 160, 190)
cv.a[:] = up(np.dstack([bg.a, np.full((NH, NW), 255, np.uint8)]), 2)[:H, :W, :3]

# ---------- Vordergrund 5× ----------
shield = sprite('b12_ds16_14', D, [16, 14])
S5 = up(shield, F)
pc(cv, S5, 125, 12 + S5.shape[0] // 2)

geyser = sprite('b12_ds23', D, [23])
G5 = up(geyser, F)
her = sprite('b12_ds8_7', D, [8, 7])
H5 = up(her, F)
gy = H - G5.shape[0] + 44
hy = gy - H5.shape[0] + F                # Füße stehen auf der Gischtkrone
cv.paste(H5, 125 - H5.shape[1] // 2, hy)
cv.paste(G5, 125 - G5.shape[1] // 2, gy)

# Wasserpfeile als Lanzen links/rechts (5×, Spitze nach unten)
arrows = parts(sprite('b12_ds5', D, [5]), dil=0, minpx=10)
arrows.sort(key=lambda p: -p.shape[0])
A5 = up(arrows[0], F)
for x in (10, 38):
    cv.paste(A5, x, 150 - (x - 10))
    cv.paste(A5, W - x - A5.shape[1], 150 - (x - 10))

vignette_grid(cv, 0.45, 0.6, 2)
print(save(cv, '12_aquatic_crest.png'))
