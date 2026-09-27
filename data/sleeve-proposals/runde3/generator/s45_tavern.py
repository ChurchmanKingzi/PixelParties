# -*- coding: utf-8 -*-
"""Sleeve 45 – „Last Round“: Gruppenbild in der Taverne. Hinter der Theke der Wirt im Anzug und die blonde
Kellnerin, dahinter die Rückwand der Taverne mit Gläserregal, Flaschen, Ofen und Schrank; vor der Theke prostet
Chuck mit dem Bierkrug, rechts sitzt der Alte mit dem Schwert auf seinem Stuhl, in der Mitte Kohta mit seinem Glas; seine Flasche steht
auf der Theke.

Quellen (Motive.xcf): 1010 „Ebene #213“ (Tavernenraum: Rückwand, Regal, Dielen), 987 „Lilly #7“ (Theke mit Krug),
988 „Chuck #2“ (Krüge), 991 „Chuck #1“ (Wirt), 992 „Haste #5“ (Kellnerin), 982 „Chuck“ (Chuck mit Bier),
999 „Old Couple“ (Alter mit Schwert auf Stuhl), 1007 „Kohta #3“ (Kohta mit Glas und Flasche, Stuhl).
"""
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
K = 4
cv = Canvas(W2, H2)
room = layer(B, 1010)[76:316, 118:420, :3]

# Rückwand (2×): Ziegel, Gläserregal, Flaschen, Ofen, Schrank
wall = room[12:62, 80:205]
WALL_H = 100
cv.a[:WALL_H] = up(rgba(wall), 2)[..., :3][:WALL_H, :W2]
# darunter Holzvertäfelung aus den Dielen (2×)
planks = room[118:178, 100:200]
cv.a[WALL_H:] = mirror_tile(up(rgba(planks), 2)[..., :3], W2, H2 - WALL_H)
# warmes Licht von oben/Ofen, Schatten nach unten
dither_blend(cv, (255, 190, 90), lambda x, y: max(0.0, 1 - ((x - 40) ** 2 + (y - 60) ** 2) ** 0.5 / 110) * 0.35)
dither_blend(cv, (20, 10, 5), lambda x, y: max(0.0, (y - 200) / 200) * 0.6, y0=200)


def fig(name, idx, part=None):
    s = lay(B, idx)
    if part is not None: s = parts(s, dil=1)[part]
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'g45_%s.png' % name))
    return s


host = fig('host', 991)
maid = fig('maid', 992)
counter = fig('counter', 987, 1)
mugs = parts(lay(B, 988), dil=1)
chuck = fig('chuck', 982, 0)
oldman = fig('oldman', 999, 1)
kohta_all = fig('kohta', 1007, 0)
kp = sorted(parts(kohta_all, dil=0), key=lambda p: p.shape[0])
bottle, kohta = kp[0], kp[-1]           # Flasche vom Tisch getrennt -> auf die Theke
chair = fig('chair', 1007, 1)

CTOP = 214                                     # Oberkante Theke
# hinter der Theke
h = up(host, K); cv.paste(h, 64, CTOP - h.shape[0] + 24)
m = up(maid, K); cv.paste(m, 150, CTOP - m.shape[0] + 22)
# Theke 3× über die ganze Breite
c = up(counter, 3)
cw = c.shape[1]
cv.paste(c, (W2 - cw) // 2, CTOP)
if cw < W2:                                    # Enden mit gespiegeltem Stück füllen
    cv.paste(flip(c[:, :(W2 - cw) // 2 + 2]), 0, CTOP)
# zusätzliche Krüge auf der Theke
for mg, x in zip(mugs, (28, 190)):
    u = up(mg, 3); cv.paste(u, x, CTOP + 6 - u.shape[0] + 12)


def front(s, cx, feet, k=K, fl=False):
    u = up(flip(s) if fl else s, k)
    x, y = int(cx - u.shape[1] / 2), feet - u.shape[0]
    sh = silhouette(u, (15, 8, 3))[::4]
    cv.paste(sh, x + 4, feet - sh.shape[0] + 3, alpha=0.4)
    cv.paste(u, x, y)


front(kohta, 128, 318, k=3)
b = up(bottle, 3); cv.paste(b, 112, CTOP + 14 - b.shape[0])
front(chuck, 52, 344)
front(oldman, 204, 344, fl=True)

vignette(cv, 0.45, 0.6)
frame(cv, ((20, 10, 4), (120, 72, 30), (220, 170, 100), (20, 10, 4)))
print(save(cv, '45_tavern.png'))
