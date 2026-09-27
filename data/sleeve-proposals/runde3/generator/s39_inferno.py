# -*- coding: utf-8 -*-
"""Sleeve 39 – „Inferno“ (Runde 3b, neu komponiert): Dante, der Wanderer der Hölle, steht vorne auf einem
Felsvorsprung; hinter ihm steigt über dem Lavasee der Dämon aus „Demons Gate“ mit weit ausgebreiteten Flügeln
auf (Flügel laufen aus dem Bild). Klare Tiefenstaffelung wie in „Count of the Deep“:
  vorne   Dante + Felsvorsprung            5×
  Mitte   Dämon + Flügel, Lavasee, Flamme  3×
  hinten  Höhlenhimmel (Dither-Verlauf, selbst erstellt)

Vollständigkeit (Regel B): Die Ebene „DANTE“ [503] (und ihre Kopien 501/502) zeigt Dante ohne Arme. Gesucht
über alle Ebenen der Datei (Palette/Template-Abgleich, nicht nur Nachbarebenen): Ebene „Ebene #727“ [270]
(weit oben im Stapel, bei „Masters Order“) ist der vollständige Dante mit Ärmeln und Händen; Haare, Umhang,
Schärpe und Gürtel entsprechen [503] (Mund geöffnet). Verwendet wird daher [270].
Der Dämon ist „Demons Gate“ [1496] + Flügel „Demons Gate #2“ [1497], genau so wie in der Kartenszene
„Sichtbar“ [116] zusammengesetzt (gleiches Koordinatensystem).

Quellen (Motive.xcf): 270 „Ebene #727“ (Dante komplett), 1496 „Demons Gate“, 1497 „Demons Gate #2“ (Flügel),
1536 „Fireball #3“ (Flamme). Lavasee und Felsvorsprung selbst gezeichnet (Regel D) in der Palette von
1550 „Lava“ bzw. 1044 „Hell“.
"""
import math
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
cv = Canvas(W2, H2)
YY, XX = np.mgrid[0:H2, 0:W2]

# ---------------------------------------------------------------- Hintergrund: Höhlenhimmel (Dither-Verlauf)
HOR = 190                                  # Horizont = hintere Kante des Lavasees
top_c, mid_c, low_c = np.array((8, 2, 4)), np.array((60, 8, 6)), np.array((170, 40, 10))
for y in range(HOR):
    t = y / HOR
    for x in range(W2):
        th = BAYER4[y % 4, x % 4]
        if t < 0.6:
            u = t / 0.6; c = mid_c if u > th else top_c
        else:
            u = (t - 0.6) / 0.4; c = low_c if u > th else mid_c
        cv.a[y, x] = c

# ferne Felszacken am Horizont (3×-Raster, selbst gezeichnet)
rng = np.random.RandomState(7)
h = 0; cols = []
for i in range(W2 // 3 + 1):
    h = max(1, min(9, h + rng.randint(-2, 3)))
    cols.append(h)
for i, hh in enumerate(cols):
    cv.rect(i * 3, HOR - hh * 3, i * 3 + 3, HOR, (28, 6, 6))
    cv.rect(i * 3, HOR - hh * 3, i * 3 + 3, HOR - hh * 3 + 3, (70, 16, 8))

# ---------------------------------------------------------------- Lavasee (selbst gezeichnet, 3×-Raster)
# Erkaltete Kruste mit glühenden Rissen, die nach vorn breiter werden; um den Dämon ein heller Glutteich.
# Begrenzte Palette aus den Farben der Lava-Textur [1550].
PAL = [(40, 8, 6), (92, 20, 8), (170, 46, 10), (240, 116, 22), (255, 206, 70)]
lake_h = H2 - HOR


def lake_block(bx, by):
    d = (by * 3 - HOR) / lake_h                          # 0 hinten … 1 vorn
    if True:
        x, y = bx * 3, by * 3
        sx = bx / (1.0 + 2.2 * d)                        # Perspektive: Muster vorne gestreckt
        n = (math.sin(sx * 0.9 + by * 0.35) + math.sin(sx * 0.37 - by * 0.8 + 1.3) +
             0.6 * math.sin(sx * 1.7 + by * 1.1)) / 2.6
        g = max(0.0, 1 - math.hypot(x - W2 / 2, (y - HOR - 8) * 2.4) / 115)
        v = 0.5 + 0.5 * n
        lvl = 0
        if v > 0.78: lvl = 3
        elif v > 0.66: lvl = 2
        elif v > 0.55: lvl = 1
        lvl = min(4, lvl + int(g * 5.2))
        cv.rect(x, y, x + 3, y + 3, PAL[lvl])


for by in range(HOR // 3, H2 // 3 + 1):
    for bx in range(W2 // 3 + 1):
        lake_block(bx, by)
cv.rect(0, HOR, W2, HOR + 3, (30, 6, 4))

# Glut über dem See
dither_blend(cv, (255, 120, 20), lambda x, y: max(0.0, 1 - abs(y - HOR) / 40) * 0.45, y0=HOR - 40, y1=HOR)

# ---------------------------------------------------------------- Dämon mit Flügeln (3×)
dem = compose(B, [1496, 1497])                            # wie in der Kartenszene zusammengesetzt
Image.fromarray(dem).save(os.path.join(xcfkit.CACHE, 'g39_demon.png'))
D = up(dem, 3)
dx = W2 // 2 - D.shape[1] // 2 - 1
# Körpermitte des Dämons exakt auf Bildmitte (Körper-bbox in Ebene 1496 relativ zur Flügel-bbox)
b_all = bbox(compose(B, [1496, 1497], crop=False)); b_d = bbox(layer(B, 1496))
body_cx = ((b_d[0] + b_d[2]) / 2 - b_all[0]) * 3
dx = int(W2 / 2 - body_cx)
dy = 34
# Flammen auf dem See zu beiden Seiten (3×)
fl = parts(lay(B, 1536), dil=1)
for f, fx in zip(fl[:1], (40,)):
    u = up(f, 3)
    cv.paste(u, fx - u.shape[1] // 2, HOR + 10 - u.shape[0])
# Schein hinter dem Dämon
cxd, cyd = W2 // 2, dy + 90
dither_blend(cv, (255, 90, 20), lambda x, y: max(0.0, 1 - math.hypot(x - cxd, (y - cyd) * 1.3) / 95) * 0.5,
             y0=0, y1=HOR)
cv.paste(D, dx, dy)
# Beine tauchen in den See: alles vom Dämon unterhalb der Seekante wieder mit Lava übermalen + Wellenkranz
body_bottom = dy + D.shape[0]
lvrow = HOR + 6
for by in range(lvrow // 3, (body_bottom + 3) // 3):          # Unterschenkel im Glutteich versinken lassen
    for bx in range((W2 // 2 - 42) // 3, (W2 // 2 + 42) // 3):
        lake_block(bx, by)
for x in range(W2 // 2 - 27, W2 // 2 + 27, 3):
    cv.rect(x, lvrow - 1, x + 3, lvrow + 2, (255, 220, 90) if (x // 3) % 2 else (250, 150, 30))

# ---------------------------------------------------------------- Vordergrund: Felsvorsprung + Dante (5×)
K = 5
# Oberkante des Vorsprungs im 5×-Raster (Spalte i = x 5i..5i+4): rechts Plateau, nach links abfallend
top = {}
prof = [350] * 8 + [345, 340, 335, 330, 325, 320, 315, 310, 305, 300, 300, 295, 295]
for i in range(W2 // K + 1):
    top[i] = prof[i] if i < len(prof) else (290 if i % 6 else 285)
rng = np.random.RandomState(3)
for i, y0 in top.items():
    for y in range(y0, H2, K):
        r = rng.rand()
        c = (46, 14, 10) if r < 0.15 else (22, 6, 6) if r < 0.3 else (34, 10, 8)
        cv.rect(i * K, y, i * K + K, y + K, c)
    if y0 < H2:
        cv.rect(i * K, y0, i * K + K, y0 + K, (160, 56, 16))          # angestrahlte Kante
        cv.rect(i * K, y0 + K, i * K + K, y0 + 2 * K, (84, 24, 10))
        if i in top and i - 1 in top and top[i - 1] > y0:              # Stufenflanke
            cv.rect(i * K, y0, i * K + K, top[i - 1], (160, 56, 16))

dante = lay(B, 270)
Image.fromarray(dante).save(os.path.join(xcfkit.CACHE, 'g39_dante.png'))
U = up(dante, K)
ddx = 150
feet = 290 + K
ddy = feet - U.shape[0]
sh = silhouette(U, (0, 0, 0))[::5]
cv.paste(sh, ddx + 8, feet - sh.shape[0] + 2, alpha=0.5)
cv.paste(U, ddx, ddy)

vignette(cv, 0.45, 0.6)
print(save(cv, '39_inferno.png'))
