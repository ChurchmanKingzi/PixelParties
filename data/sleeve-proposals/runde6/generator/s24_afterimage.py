# -*- coding: utf-8 -*-
"""24 Afterimage – Gegner „Idej Illusions“ (sample-Structure Deck Idej Illusions),
Held/Hauptmotiv: Idej Lord Daiyo (Base-Karte).

Idee (Porträt mit Transparenz): Daiyo, der grüne, halb durchsichtige Geist-Samurai seiner Karte, schwebt
groß vor dem Tempelpavillon der Kogarasu-Karte (Cover) im Abendrot; Kirschblüten treiben vorbei. Links und rechts
hinter ihm schweben zwei blassere, ins Türkis verschobene Nachbilder seiner selbst (ohne Schwert) – seine Idej
Projections (sie werden ihm zu Spielbeginn angelegt und fangen Schaden ab): Man weiß nicht, welcher der
echte ist. Der dunkle Innenraum des Pavillons liegt genau hinter ihm, damit das Grün leuchtet.

Quellen:
  MotiveSteamDwarfs.xcf  Kartenszene „Idej Lord Daiyo“ = Ebene 402 „Sichtbar #4“ (Lage 83,71, exakter Treffer):
                         Ebene 407 „Ebene #23“ (Daiyo, grün; in der Karte mit ~73 % Deckkraft über dem
                         Hintergrund – hier ebenso), Ebene 405 „Ebene #24“ (Hand am Griff, ~75 %),
                         Ebene 406 „Ebene #22“ (weißes Schwert, deckend). (Gleiche Figur wie MotiveJapan 160 „Daiyo“.)
                         Nicht verwendet: 403/404 (verblasste bzw. schwarze Variante, in der Karte ausgeblendet).
  MotiveJapan.xcf        Kogarasu-Kartenszene Ebene 3: Ebene 247 „Ebene“ (Abendhimmel mit Wolken),
                         236 „House Todugawin“ + 231 „Ebene #73“ + 237 „Ebene #149“ (Pavillon mit Shoji),
                         217 „Ebene #2“ (Kirschbaumreihe; weitere Reihen davor versetzt/gespiegelt),
                         142 „KIRSCHBLÜTEN“ (treibende Blüten).
Selbst gezeichnet: Abdunkelung des Himmels zum oberen Rand (gedithert), grüner Schein des Geistes auf dem
                         Pavillon-Inneren.
Skalierung: Hintergrund (Himmel, Pavillon, Kirschbäume, Blüten, grüner Schein) – 2×-Raster (125×175);
            Daiyo + Nachbilder (24×41 → 120×205) – 5×; die Nachbilder sind dieselbe 5×-Figur, nur blasser.
"""
import math
from common import *  # noqa
from dkit19_24 import *  # noqa

BS, BJ = 'MotiveSteamDwarfs', 'MotiveJapan'

# ---------------------------------------------------------------- Daiyo (Base) mit Deckkraft wie im Kartenbild
X0, Y0, X1, Y1 = 107, 77, 131, 118
body = layer(BS, 407)[Y0:Y1, X0:X1].copy()
hand = layer(BS, 405)[Y0:Y1, X0:X1].copy()
sword = layer(BS, 406)[Y0:Y1, X0:X1].copy()
Image.fromarray(over(over(body, sword), hand)).save(os.path.join(xcfkit.CACHE, 'o24_daiyo.png'))


def daiyo_on(dst, k, ox, oy, a_body, a_sword, with_sword=True, echo=False):
    """Daiyo in Pixelgröße k auf dst (RGB-Array des 250×350-Rasters) legen – Ebenen in Kartenreihenfolge
    (Körper, darüber Schwert, darüber Hand) mit eigener Deckkraft."""
    for s, a in (((body, a_body), (sword, a_sword), (hand, a_body)) if with_sword else ((body, a_body),)):
        u = up(hsv_shift(s, 45, 0.8, 1.15) if echo else s, k)
        h, w = u.shape[:2]
        X0_, Y0_ = max(0, ox), max(0, oy)
        X1_, Y1_ = min(dst.shape[1], ox + w), min(dst.shape[0], oy + h)
        u = u[Y0_ - oy:Y1_ - oy, X0_ - ox:X1_ - ox]
        sub = dst[Y0_:Y1_, X0_:X1_].astype(float)
        m = (u[..., 3] >= 128)[..., None]
        dst[Y0_:Y1_, X0_:X1_] = np.where(m, u[..., :3] * a + sub * (1 - a), sub).astype(np.uint8)


# ---------------------------------------------------------------- Hintergrund 2× (125×175), späte Dämmerung
GW, GH = grid(2)
G = 132                     # Bodenlinie (Stammfüße der Kirschbäume = Unterkante des Pavillons, wie auf der Karte)
NX, NY = 121, 141           # Szenenpunkt (Pavillonmitte, Boden), der auf (62, G) abgebildet wird
bg = rgba(GW, GH)
sky = layer(BJ, 247)
for y in range(G + 1):
    for x in range(GW):
        bg[y, x, :3] = sky[40 + y, NX - 62 + x, :3]
        bg[y, x, 3] = 255


def scene_put(dst, s, sx0, sy0):
    """Sprite mit Szenenkoordinaten (linke obere Ecke sx0, sy0) im Raster platzieren."""
    put(dst, s, sx0 - NX + 62, sy0 - NY + G)


pav = compose(BJ, [236, 231, 237], crop=False)
pav[..., 3] = np.where(pav[..., 3] > 0, 255, 0)
scene_put(bg, pav[28:141, 80:162], 80, 28)
trees = layer(BJ, 217)[95:141, 70:172].copy()
row = crop_alpha(trees)
tb = bbox(trees)
scene_put(bg, row, 70 + tb[0], 95 + tb[1])
rw = row.shape[1]
scene_put(bg, flip(row), 70 + tb[0] - rw + 8, 95 + tb[1] + 1)       # Hain links fortgesetzt
scene_put(bg, flip(row), 70 + tb[0] + rw - 8, 95 + tb[1] + 1)       # und rechts
# Boden: dunkler Grund, darauf gefallene Blüten (Blütenpixel aus Ebene 142)
pet = layer(BJ, 142)
for y in range(G + 1, GH):
    for x in range(GW):
        t = (y - G) / (GH - G)
        bg[y, x, :3] = np.array([60, 28, 46]) * (1 - t) + np.array([24, 10, 24]) * t
        bg[y, x, 3] = 255
for y in range(G + 1, GH):
    for x in range(GW):
        q = pet[150 + (y - G), 80 + x]
        if q[3] > 0 and (x // 2 + y // 2) % 2 == 0:
            t = (y - G) / (GH - G)
            bg[y, x, :3] = (q[:3] * (0.85 - 0.45 * t)).astype(np.uint8)
# Dämmerung: Himmel und Hain gedämpft, nach oben dunkel-violett (gedithert)
for y in range(G + 1):
    for x in range(GW):
        t = max(0.0, 1 - y / 95) * 0.9
        q = dith(t, x, y, 4)
        c = bg[y, x, :3].astype(float) * 0.8
        bg[y, x, :3] = (c * (1 - q * 0.8) + np.array([30, 8, 38]) * q * 0.8).astype(np.uint8)
# treibende Blüten in der Luft (Ebene 142, 1:1)
for y in range(0, G):
    for x in range(GW):
        q = pet[110 + y % 150, 150 + x]
        if q[3] > 0 and y > 30:
            bg[y, x, :3] = (q[:3] * 0.8).astype(np.uint8)
cv = Canvas(W, H)
blit(cv, bg, 2)

# ---------------------------------------------------------------- Nachbilder (Idej Projections) + Daiyo 5×
k = 5
dw, dh = (X1 - X0) * k, (Y1 - Y0) * k
DX, DY = (W - dw) // 2 + 5, 120
# grüner Schein hinter Daiyo und auf dem Boden (Raster 2×, gedithert)
gx, gy = (DX + dw / 2 + 12) / 2, (DY + 90) / 2
for y in range(GH):
    for x in range(GW):
        d = math.hypot((x + .5 - gx) / 36, (y + .5 - gy) / 50)
        if d < 1:
            q = dith((1 - d), x, y, 4) * 0.3
            c = cv.a[y * 2:(y + 1) * 2, x * 2:(x + 1) * 2].astype(float)
            cv.a[y * 2:(y + 1) * 2, x * 2:(x + 1) * 2] = (c * (1 - q) + np.array([70, 255, 110]) * q).astype(np.uint8)
# Nachbilder: nur der Körper (die Projektionen tragen kein Schwert), höher und seitlich versetzt
daiyo_on(cv.a, k, DX - 70, DY - 34, 0.4, 0, with_sword=False, echo=True)
daiyo_on(cv.a, k, DX + 60, DY - 34, 0.4, 0, with_sword=False, echo=True)
daiyo_on(cv.a, k, DX, DY, 0.73, 1.0)
print(save(cv, '24_afterimage.png'))
