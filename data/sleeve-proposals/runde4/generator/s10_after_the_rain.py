# -*- coding: utf-8 -*-
"""10 After the Rain – Wetter: Die Gewitterwolken ziehen nach rechts ab (dort fällt noch Regen), die Sonne bricht
durch, ein großer Regenbogen spannt sich über den Himmel. Darunter reichen sich zwei Freunde auf der Kuppe eines
nassen Hügels die Hand; in den Pfützen spiegeln sich Himmel und Regenbogen.

Quellen:
  Motive 1439 „Friendship“ – nur die beiden Kinder (der kleine Regenbogen der Ebene wird verworfen), 4×
Selbst gezeichnet: Himmel, Wolken, Regenschleier, Sonnenstrahlen, Regenbogen (Farbfolge wie auf der Karte),
  Hügel, Gras, Pfützen mit Spiegelung, Glanzlichter.

Skalierung:
  Hintergrund (Himmel, Wolken, Regen, Regenbogen, ferne Hügel): 2× (Raster 125×175)
  Vordergrund (Hügelkuppe, Gras, Pfützen, Kinder, Schatten): 4× (Raster 63×88, beschnitten)
"""
from common import *  # noqa
import numpy as np, math

M = 'Motive'
BW, BH = 125, 175
yy, xx = np.mgrid[0:BH, 0:BW]
th = BAYER4[yy % 4, xx % 4]

# ---------------- Hintergrund 2× ----------------
bg = Canvas(BW, BH)
sky = [(52, 92, 170), (72, 122, 200), (104, 158, 222), (146, 192, 236), (190, 220, 244)]
t = np.clip((yy - 10) / 120, 0, 1) * (len(sky) - 1)
q = np.floor(t + th * 0.999).clip(0, len(sky) - 1).astype(int)
for k, c in enumerate(sky):
    bg.a[q == k] = c

# Sonnenschein oben links (Strahlen als gedithertes Aufhellen)
SUNX, SUNY = 26, 20
ang = np.arctan2(yy - SUNY, xx - SUNX)
dist = np.hypot(xx - SUNX, yy - SUNY)
for r, col in [(16, (214, 232, 246)), (10, (240, 246, 236)), (6, (255, 252, 224))]:
    g = np.clip(1 - (dist - r * 0.6) / (r * 0.4), 0, 1)
    bg.a[g > th] = col

# Regenbogen: 7 Bänder à 2 Rasterpixel, Mittelpunkt unter dem Horizont
RB = [(246, 0, 0), (246, 123, 0), (246, 246, 0), (0, 246, 0), (0, 197, 246), (0, 33, 246), (131, 0, 246)]   # Farben der Karte
RCX, RCY, ROUT = 62.5, 142, 74
rd = np.hypot(xx + 0.5 - RCX, (yy + 0.5 - RCY))
for k, col in enumerate(RB):
    band = (rd <= ROUT - 2 * k) & (rd > ROUT - 2 * (k + 1)) & (yy < 128)
    # zu den Enden hin (in den Dunst) ausdünnen
    fade = np.clip((RCY - 20 - yy) / 40, 0, 1)
    bg.a[band & (fade > th * 0.9)] = col
# heller Schein innen am Regenbogen
inner = (rd <= ROUT - 14) & (rd > ROUT - 17) & (yy < 124) & (th < 0.25)
bg.a[inner] = np.clip(bg.a[inner].astype(int) + 22, 0, 255).astype(np.uint8)

# Gewitterwolken (rechts oben, abziehend) + Regenschleier
def blob_cloud(cx, cy, lobes, dark, mid, lite):
    mask = np.zeros((BH, BW), bool)
    for bx, by, r in lobes:
        mask |= ((xx + 0.5 - cx - bx) ** 2 + ((yy + 0.5 - cy - by) * 1.3) ** 2) <= r * r
    top = mask & ~np.roll(mask, 2, 0)
    bot = mask & ~np.roll(mask, -2, 0)
    bg.a[mask] = mid
    bg.a[top] = lite
    bg.a[bot] = dark
    return mask


# Regen unter der rechten Wolke: kurze schräge Striche (1 Rasterpixel)
rng = np.random.RandomState(10)
for _ in range(70):
    x0, y0 = rng.randint(78, BW + 6), rng.randint(36, 96)
    if x0 - (y0 - 36) * 0.4 < 84: continue
    if np.hypot(x0 + 0.5 - RCX, y0 + 0.5 - RCY) < ROUT + 3: continue          # nicht vor dem Regenbogen
    for k in range(4):
        x, y = x0 - k // 2, y0 + k
        if 0 <= x < BW and 0 <= y < BH: bg.a[y, x] = (150, 168, 206) if k else (190, 204, 232)
cm = blob_cloud(102, 22, [(-26, 8, 9), (-14, 2, 12), (0, -3, 14), (14, 1, 13), (28, 6, 11), (-4, 10, 13),
                          (14, 12, 11), (-18, 12, 8)], (56, 60, 84), (84, 90, 116), (124, 130, 158))
# innere Schattierung der Wolke: untere Hälfte dunkler (gedithert)
sh = cm & (yy > 30) & (th < np.clip((yy - 30) / 14, 0, 1))
bg.a[sh] = (68, 72, 98)
# helle Restwolke links
blob_cloud(26, 62, [(-10, 0, 6), (-2, -2, 7), (7, 0, 6)], (170, 186, 216), (220, 230, 244), (250, 252, 255))

# ferne Hügel
for base, amp, fr, ph, col in [(128, 5, 0.06, 0.8, (104, 156, 110)), (136, 4, 0.05, 2.4, (78, 138, 84))]:
    for x in range(BW):
        h = int(base - amp * (0.6 * math.sin(x * fr + ph) + 0.4 * math.sin(x * fr * 2.6 + ph)))
        bg.a[h:, x] = col
        bg.a[h, x] = np.clip(np.array(col) + 30, 0, 255)

cv = Canvas(250, 350)
cv.a[:] = up(bg.a, 2)

# ---------------- Vordergrund 5× ----------------
FW, FH = 63, 88
fg = np.zeros((FH, FW, 4), np.uint8)
CREST = 75
tops = {}
for x in range(FW):
    u = (x + 0.5 - 31.5) / 31.5
    top = CREST + 8 * u * u
    tops[x] = int(round(top))
    for y in range(tops[x], FH):
        d = y - tops[x]
        c = (150, 214, 96) if d == 0 else ((96, 176, 70) if d < 3 else (70, 146, 58))
        fg[y, x] = (*c, 255)
# Grasbüschel (Pixel) an der Kante und dunklere Flecken
for x in range(0, FW, 3):
    y = tops[x] - 1
    if 0 <= y < FH and (x * 7) % 5 < 3:
        fg[y, x] = (120, 196, 84, 255)
for (x, y) in [(6, 84), (15, 81), (48, 82), (56, 85), (24, 86), (38, 85), (4, 80), (31, 80)]:
    if fg[y, x, 3]: fg[y, x, :3] = (58, 124, 50)
# Pfützen mit Spiegelung (Himmel + Regenbogenstreifen)
for (px, py, rx) in [(12, 84, 6), (50, 85, 6)]:
    for x in range(px - rx, px + rx + 1):
        for y in (py, py + 1):
            if abs(x - px) <= rx - (y - py) and 0 <= x < FW and 0 <= y < FH:
                fg[y, x, :3] = (150, 196, 236) if y == py else (104, 158, 222)
    fg[py + 1, px + rx - 2, :3] = (236, 244, 252)                        # Glanz

kids_layer = sprite('b10_friendship', M, [1439])
# Regenbogen der Ebene entfernen: seine 7 reinen Farben (aus den Randspalten/-zeilen gelesen)
pal = {tuple(c) for c in kids_layer[:, :10, :3][kids_layer[:, :10, 3] > 0]}
pal |= {tuple(c) for c in kids_layer[:6, :, :3][kids_layer[:6, :, 3] > 0]}
kids = kids_layer[9:31, 15:44].copy()
rm = np.array([[tuple(kids[j, i, :3]) in pal for i in range(kids.shape[1])] for j in range(kids.shape[0])])
kids[rm] = 0
kids = trim(kids)
KX = 32 - kids.shape[1] // 2
KY = CREST + 1 - kids.shape[0]
# Schatten
for i in range(-1, kids.shape[1] + 1):
    X, Y = KX + i, CREST
    if 0 <= X < FW and fg[Y, X, 3]: fg[Y, X, :3] = (70, 130, 60)
for j in range(kids.shape[0]):
    for i in range(kids.shape[1]):
        if kids[j, i, 3] >= 128: fg[KY + j, KX + i] = kids[j, i]
cv.paste(up(fg, 4)[:350, 1:251], 0, 0)
print(kids.shape)
print(save(cv, '10_after_the_rain.png'))
