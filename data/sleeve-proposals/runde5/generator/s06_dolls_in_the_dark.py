# -*- coding: utf-8 -*-
"""06 Dolls in the Dark – Held: Alice, the Puppeteer Girl (Base-Karte, NICHT „Transfer Student“).

Idee (Porträt/Ruhemoment, Grusel): Nachts in Alices Zimmer im Herrenhaus. Alice steht groß und frontal auf
dem violetten Läufer, die Arme ausgebreitet; an ihren Fäden sitzen ihre zwei Puppen. Das Zimmer dahinter liegt
im Dunkeln, nur ihr eigener violetter Magieschein beleuchtet Säulen, Bett und ihr Porträt an der Wand. In der
Finsternis glühen die roten Puppenaugen: die Geisterpuppe im Spiegel des Frisiertischs, eine Puppe, die im
offenen Schrank lauert, die Puppe auf dem Schrank, zwei auf den Säulenkapitellen neben ihrem Porträt und zwei am
Fuß der Säulen. Rechts glimmt der Ofen. Alice steht in der Bildmitte (Gesicht bei ~43 % der Höhe), der Läufer
läuft vor ihr bis zur Goldborte weiter. (Ihre Kreaturen = ihre Macht: Kartentext zählt die Kreaturen, Destruction + Summoning Magic.)

Quellen (MotiveBritain.xcf, Kartenszene „Sichtbar #53“ = Ebene 5, Lage 218,288, 76×50):
  Ebene 8 „Alice #6“  – Alice (dunkle Augen, Arme ausgebreitet) + ihre 2 Puppen + violette Fäden,
                        Box x 236–275, y 303–330, pixelgleich mit der Kartenszene geprüft (0 Abweichungen);
                        ohne den Kopf der Puppe darunter und ohne die rote Punktlinie über ihr. (Die Alice
                        links auf derselben Ebene mit türkisen Augen gehört zu „Mr. Jiggles“ – nicht verwendet.)
                      – außerdem: Geisterpuppe im Spiegel (alpha 76), liegende Puppe auf dem Schrank,
                        stehende Puppe (2× an den Säulenfüßen), sitzende Puppe (2× auf den Kapitellen, 1× verdunkelt im Schrank)
  Ebene 60 „Ebene #173“ – Zimmer (Wände, Säulen, Frisiertisch, Schrank, Bett, Standuhr, Regal, Ofen, Teppich)
  Ebene 59 „Alice #7“   – violetter Läufer (Mittelstück, Periode 9, nach vorn verlängert)
  Ebene 56 „Ebene #224“ – Alice-Porträt im Bilderrahmen, Kristallkugel
Skalierung: Zimmer mit allen Hintergrundpuppen und Licht 2× (Raster 125×175);
            Alice + ihre zwei Puppen + Fäden + Schatten 5× (Raster 50×70). Keine anderen Pixelgrößen.
Fäden: Originalpixel (1 px im 5×-Raster, dunkel/hell abwechselnd), außerhalb von Alice halbtransparent;
       sie beginnen an Alices Händen und enden an den Köpfen der Puppen.
"""

import math
from common import *  # noqa
import numpy as np
from xcfkit import over

D = 'MotiveBritain'
W, H = 250, 350


def bay(x, y):
    return BAYER4[y % 4, x % 4]


def rgba(w, h):
    return np.zeros((h, w, 4), np.uint8)


def keep_boxes(a, boxes):
    m = np.zeros(a.shape[:2], bool)
    for x0, y0, x1, y1 in boxes: m[y0:y1, x0:x1] = True
    b = a.copy(); b[~m] = 0
    return b


def put(dst, s, x, y):
    t = np.zeros_like(dst)
    h, w = s.shape[:2]
    t[y:y + h, x:x + w] = s
    return over(dst, t)


EMIS = {(236, 39, 65), (159, 17, 30), (209, 0, 0), (234, 42, 67), (159, 14, 32)}   # Puppenaugen/Schleifen

# ---------------------------------------------------------------- Hintergrund: Zimmer (2×)
AX = 282                        # Symmetrieachse des Zimmers (Bett, Läufer, Säulenpaare)
RX0, RY0 = AX - 62, 238         # Fenster 125×175 im Ebenen-Koordinatensystem
l8 = layer(D, 8)
room = layer(D, 60).copy()
# Läufer (Ebene 59) nach vorn verlängert: Mittelstück (Periode 9) wiederholt, Endborte nach unten versetzt
rug = layer(D, 59)
E = 24
rug2 = np.zeros_like(rug)
rug2[:341] = rug[:341]
for y in range(341, 341 + E):
    rug2[y] = rug[y - 9 * math.ceil((y - 340) / 9)]
rug2[341 + E:] = rug[341:rug.shape[0] - E]
acc = over(room, rug2)
acc = over(acc, layer(D, 56))                               # Bild im Rahmen (Alice-Porträt), Kristallkugel
gh8 = keep_boxes(l8, [(227, 291, 237, 302)])                # Geister-Puppe im Spiegel (alpha 76)
ward = keep_boxes(l8, [(243, 283, 256, 295)])               # liegende Puppe auf dem Schrank
ward[np.all(ward[..., :3] == (209, 0, 0), -1)] = 0             # (ohne die gepunkteten roten Fäden)
acc = over(acc, gh8); acc = over(acc, ward)
# im offenen, schwarzen Schrank (x 242–253, y 295–305) lauert eine Puppe: fast schwarz, nur die Augen glühen
sit = [p for p in parts(l8, dil=0, minpx=2) if p.shape[:2] == (12, 12)][0]
lurk = sit.copy()
isred = np.zeros(lurk.shape[:2], bool)
for c in EMIS: isred |= np.all(lurk[..., :3] == c, -1)
lurk[~isred, :3] = (lurk[~isred, :3] * 0.12).astype(np.uint8)
lurk = lurk[:11]
acc = put(acc, lurk, 242, 295)
# zwei stehende Puppen am Fuß der hinteren Säulen (gespiegelt, symmetrisch zur Achse)
dolls = parts(l8, dil=0, minpx=2)
stand = [p for p in dolls if p.shape[:2] == (12, 8)][0]
acc = put(acc, stand, 248, 311)
acc = put(acc, flip(stand), 2 * AX - 248 - 8, 311)
# zwei sitzende Puppen oben auf den Kapitellen der hinteren Säulen (x 259–268 / 291–300, Oberkante y 273)
TOPS = [(258, 261, sit), (290, 261, flip(sit))]
for px, py, sp in TOPS:
    acc = put(acc, sp, px, py)
bg = acc[RY0:RY0 + 175, RX0:RX0 + 125].copy()
bg[..., 3] = 255

rgb = bg[..., :3]
emis = np.zeros(bg.shape[:2], bool)
for c in EMIS:
    emis |= np.all(rgb == c, -1)
# (Bild im Rahmen soll nicht glühen)
emis[257 - RY0:272 - RY0, 272 - RX0:289 - RX0] = False
ghost = np.zeros(bg.shape[:2], bool)
gm = gh8[291:302, 227:237, 3] > 0
ghost[291 - RY0:302 - RY0, 227 - RX0:237 - RX0] = gm

# Licht: violetter Schein um Alice, nach außen Finsternis (weich, im 2×-Raster)
LX, LY = 62.5, 84
GLOW = np.array([64, 16, 104])
dollm = np.zeros(bg.shape[:2], bool)                       # Puppen im Hintergrund (bleiben blass sichtbar)
for sp in (ward,):
    dollm |= sp[RY0:RY0 + 175, RX0:RX0 + 125, 3] > 0
for (px, py) in ((248, 311), (2 * AX - 248 - 8, 311)):
    dollm[py - RY0:py - RY0 + 12, px - RX0:px - RX0 + 8] |= stand[..., 3] > 0 if px == 248 else flip(stand)[..., 3] > 0
for px, py, sp in TOPS:
    dollm[py - RY0:py - RY0 + 12, px - RX0:px - RX0 + 12] |= sp[..., 3] > 0
pict = np.zeros(bg.shape[:2], bool)                          # Bild (Rahmen + Alice-Porträt) leicht beleuchtet
_b = bg[257 - RY0:272 - RY0, 272 - RX0:289 - RX0, :3].astype(int)
pict[257 - RY0:272 - RY0, 272 - RX0:289 - RX0] = ((((_b[..., 0] - _b[..., 2] > 25) & (_b.min(-1) < 110)) | (_b[..., 2] - _b[..., 0] > 25))
                                                  | (layer(D, 56)[257:272, 272:289, 3] > 0))
out = rgb.astype(float)
EYE = np.array([255, 36, 56])
for y in range(175):
    for x in range(125):
        d = math.hypot((x + .5 - LX) / 56, (y + .5 - LY) / (76 if y < LY else 96))
        t = max(0.0, 1 - d)
        f = 0.07 + 0.88 * t ** 1.25
        c = out[y, x]
        if emis[y, x]:                                            # glühende Augen
            c = c * 0.35 + EYE * 0.65 if c[0] > 200 else c * 1.1
        elif ghost[y, x]:
            c = c * 0.85 + np.array([0, 10, 20])
        elif dollm[y, x]:
            c = c * max(f, 0.42) + np.array([4, 4, 16])
        elif pict[y, x]:
            c = c * max(f, 0.5)
        else:
            g = math.floor((t ** 1.5) * 4 + bay(x, y)) / 4          # violetter Schein in Stufen, gedithert
            c = c * f + GLOW * g * 0.55 + (1 - f) * np.array([4, 1, 12])
        # warmer Schein der Ofenglut (rechts) und kalter Schein des Spiegelgeists (links)
        for (gx_, gy_, r_, col_, k_) in ((329 - RX0, 317 - RY0, 9, (255, 110, 40), 0.32),
                                        (231.5 - RX0, 296 - RY0, 8, (150, 190, 230), 0.22)):
            dd = math.hypot(x + .5 - gx_, (y + .5 - gy_) * 1.5) / r_
            if dd < 1 and not emis[y, x]:
                st = math.floor(((1 - dd) ** 1.5) * 3 + bay(x, y)) / 3   # 3 Stufen, gedithert
                c = c + np.array(col_) * st * k_
        out[y, x] = c
bgl = np.dstack([out.clip(0, 255).astype(np.uint8), np.full((175, 125), 255, np.uint8)])

cv = Canvas(W, H)
cv.paste(up(bgl, 2), 0, 0)

# ---------------------------------------------------------------- Alice mit ihren Puppen (5×)
grp = sprite('h06_alice_group', D, [8], box=(236, 303, 276, 331)).copy()   # Alice #6 (Base-Karte)
assert grp.shape[:2] == (28, 40)
grp[24:, 249 - 236:265 - 236] = 0                  # Kopf der Puppe darunter (gehört nicht dazu)
grp = part_at(grp, 20, 10, dil=0)
gh, gw = grp.shape[:2]
# Fäden: 1 px, dunkel/hell abwechselnd (Originalpixel), halbtransparent außerhalb von Alice
F1, F2 = (75, 1, 117), (154, 47, 231)
for y in range(gh):
    for x in range(gw):
        if grp[y, x, 3] and tuple(grp[y, x, :3]) in (F1, F2) and not (248 <= x + 236 <= 263):
            grp[y, x, 3] = 185
AL = rgba(50, 70)
gx, gyb = 5, 49                                    # Gruppe x 236–275 (Alice 248–263) genau mittig, Oberkante y 21 → Gesicht bei ~43 % der Höhe
for y in range(70):
    for x in range(50):
        d = ((x + .5 - 25) / 19) ** 2 + ((y + .5 - (gyb - 2.5)) / 3.6) ** 2
        if d < 1 and 0.6 > bay(x, y):
            AL[y, x] = (8, 0, 18, 170)
tmp = rgba(50, 70)
tmp[gyb - gh:gyb, gx:gx + gw] = grp
AL = over(AL, tmp)
cv.paste(up(AL, 5), 0, 0)

print(save(cv, '06_dolls_in_the_dark.png'))
