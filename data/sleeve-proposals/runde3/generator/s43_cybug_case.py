# -*- coding: utf-8 -*-
"""Sleeve 43 – „Cybug Collection“: Schaukasten eines Insektensammlers – die mechanischen Cybugs liegen als
Präparate auf rotem Samt mit Goldborte in einem Holzrahmen hinter Glas: oben groß die Cybug BEE, darunter
SCARAB und LADYBUG, unten der CENTIPEDE. Die Präparate werfen Schatten auf den Samt (sie stecken auf Nadeln),
über das Glas laufen zwei schräge Lichtreflexe.

Quellen (Motive.xcf): 387 „Cybug BEE“, 393 „Cybug SCARAB“ (fliegender Scarab), 1342 „Cybug LADYBUG“,
390 „Cybug CENTIPEDE“ (ganzer Körper), 1188 „Thieving #3“ (roter Samtteppich mit Goldborte),
1157 „Trade #2“ (Holzbalken der Theke) als Rahmen.
"""
import math
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
cv = Canvas(W2, H2)

vel = lay(B, 1188)
wood = lay(B, 1157)[67:79, 0:80]
# Samt: Innenmuster gespiegelt gekachelt (1×)
cv.a[:] = mirror_tile(vel[6:49, 6:54, :3], W2, H2)
# Goldborte (Rand des Teppichs), 5 px, innen am Rahmen
F = 12
top = vel[0:5, 6:54, :3]; side = vel[6:49, 0:5, :3]
cv.a[F:F + 5, F:W2 - F] = mirror_tile(top, W2 - 2 * F, 5)
cv.a[H2 - F - 5:H2 - F, F:W2 - F] = mirror_tile(top[::-1], W2 - 2 * F, 5)
cv.a[F:H2 - F, F:F + 5] = mirror_tile(side, 5, H2 - 2 * F)
cv.a[F:H2 - F, W2 - F - 5:W2 - F] = mirror_tile(side[:, ::-1], 5, H2 - 2 * F)
for (x, y) in ((F, F), (W2 - F - 5, F), (F, H2 - F - 5), (W2 - F - 5, H2 - F - 5)):
    cv.a[y:y + 5, x:x + 5] = vel[0:5, 0:5, :3]
# Holzrahmen (1×), Gehrung an den Ecken
wt = wood[..., :3]
hb = mirror_tile(wt, W2, F)
vb = mirror_tile(np.rot90(wt).copy(), F, H2)
for y in range(H2):
    for x in range(W2):
        d = min(x, y, W2 - 1 - x, H2 - 1 - y)
        if d < F:
            if min(y, H2 - 1 - y) <= min(x, W2 - 1 - x):
                cv.a[y, x] = hb[y if y < F else y - (H2 - F), x]
            else:
                cv.a[y, x] = vb[y, x if x < F else x - (W2 - F)]
# Rahmenkanten: außen dunkel, innen Schattenfuge
cv.a[0, :] = cv.a[-1, :] = (60, 34, 12); cv.a[:, 0] = cv.a[:, -1] = (60, 34, 12)
cv.a[F - 1, F - 1:W2 - F + 1] = (70, 40, 14); cv.a[F - 1:H2 - F + 1, F - 1] = (70, 40, 14)
cv.a[H2 - F, F - 1:W2 - F + 1] = (200, 150, 80); cv.a[F - 1:H2 - F + 1, W2 - F] = (200, 150, 80)
# Schatten des Rahmens auf dem Samt (oben/links)
dither_blend(cv, (30, 0, 10), lambda x, y: max(0.0, 1 - (min(x, y) - F) / 10) * 0.6,
             x0=F, y0=F, x1=W2 - F, y1=H2 - F)

bee = lay(B, 387)
scarab = parts(lay(B, 393), dil=1)[0]
# LADYBUG: die durchscheinenden Flügel liegen halbtransparent in der Ebene -> per Bayer-Dithering deckend machen
_l = layer(B, 1342); _b = bbox(_l); _l = _l[_b[1]:_b[3], _b[0]:_b[2]].copy()
_al = _l[..., 3].astype(float) / 255
_yy, _xx = np.mgrid[0:_l.shape[0], 0:_l.shape[1]]
_l[..., 3] = np.where(_al >= 0.5, 255, np.where(_al * 1.6 > BAYER4[_yy % 4, _xx % 4] + 0.05, 255, 0))
lady = _l

centi = [p for p in parts(lay(B, 390), dil=1) if p.shape == (47, 74, 4)][0]
for n, s in dict(bee=bee, scarab=scarab, ladybug=lady, centipede=centi).items():
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'g43_%s.png' % n))


def pin(s, k, x, y):
    u = up(s, k)
    cv.paste(silhouette(u, (50, 0, 12)), x + 4, y + 5, alpha=0.55)
    cv.paste(u, x, y)


pin(bee, 3, (W2 - 204) // 2, 18)
pin(scarab, 3, 18, 166)
pin(lady, 3, W2 - 18 - 84, 162)
pin(centi, 2, (W2 - 148) // 2 + 8, H2 - 16 - 94)

# Glasreflexe
for x0, wd in ((40, 18), (70, 7)):
    dither_blend(cv, (255, 255, 255),
                 lambda x, y, x0=x0, wd=wd: 0.16 if 0 <= (x + y * 0.55 - x0 - 120) < wd else 0.0,
                 x0=F, y0=F, x1=W2 - F, y1=H2 - F)
print(save(cv, '43_cybug_case.png'))
