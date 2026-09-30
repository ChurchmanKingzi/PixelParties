# -*- coding: utf-8 -*-
"""24 Afterimage – Gegner „Idej Illusions“ (sample-Structure Deck Idej Illusions),
Held/Hauptmotiv: Idej Lord Daiyo (Base-Karte).

Idee (Porträt mit Transparenz, Nacht): Daiyo, der grüne, halb durchsichtige Geist-Samurai seiner Karte,
schwebt groß vor dem nächtlichen Tempelpavillon der Kogarasu-Karte (Cover); Pavillon und Kirschblütenhain
liegen dunkel im Mondlicht, damit die grüne Geisterfigur leuchtet; nur wenige Blüten treiben. Rechts hinter
ihm, höher und deutlich seitlich versetzt, schwebt EIN Nachbild seiner selbst (nur der Körper, im Schachbrett
der 5×-Pixel gedithert) – seine Idej Projection (wird ihm zu Spielbeginn angelegt und fängt Schaden ab).

Quellen:
  MotiveSteamDwarfs.xcf  Kartenszene „Idej Lord Daiyo“ = Ebene 402 „Sichtbar #4“ (Lage 83,71, exakter Treffer):
                         Ebene 407 „Ebene #23“ (Daiyo, grün; in der Karte mit ~73 % Deckkraft über dem
                         Hintergrund – hier ebenso), Ebene 405 „Ebene #24“ (Hand am Griff, ~75 %),
                         Ebene 406 „Ebene #22“ (weißes Schwert, deckend). (Gleiche Figur wie MotiveJapan 160 „Daiyo“.)
                         Nicht verwendet: 403/404 (verblasste bzw. schwarze Variante, in der Karte ausgeblendet).
  MotiveJapan.xcf        Kogarasu-Kartenszene Ebene 3:
                         236 „House Todugawin“ + 231 „Ebene #73“ + 237 „Ebene #149“ (Pavillon mit Shoji),
                         217 „Ebene #2“ (Kirschbaumreihe; links/rechts gespiegelt fortgesetzt),
                         142 „KIRSCHBLÜTEN“ (wenige treibende und gefallene Blüten).
                         Pavillon und Bäume im Mondlicht abgedunkelt/violett getönt.
Selbst gezeichnet: Nachthimmel (geordnetes Dithering), Mond mit Hof, Boden, grüner Schein des Geistes.
Skalierung: Hintergrund (Himmel, Pavillon, Kirschbäume, Blüten, grüner Schein) – 2×-Raster (125×175);
            Daiyo (24×41 → 120×205) und sein Nachbild – 5×.
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


# ---------------------------------------------------------------- Hintergrund 2× (125×175), Nacht
GW, GH = grid(2)
G = 132                     # Bodenlinie (Stammfüße der Kirschbäume = Unterkante des Pavillons, wie auf der Karte)
NX, NY = 121, 141           # Szenenpunkt (Pavillonmitte, Boden), der auf (62, G) abgebildet wird
bg = rgba(GW, GH)
TOP, HORC = np.array([6, 6, 20]), np.array([38, 22, 62])
for y in range(G + 1):
    for x in range(GW):
        q = dith(y / G, x, y, 6)
        bg[y, x, :3] = TOP * (1 - q) + HORC * q
        bg[y, x, 3] = 255
# Mond (selbst gezeichnet) oben rechts mit gedithertem Hof
MX, MY, MR = 98, 24, 8
for y in range(0, 50):
    for x in range(70, GW):
        d = math.hypot(x + .5 - MX, y + .5 - MY)
        if d < MR:
            bg[y, x, :3] = (214, 214, 228) if d < MR - 1.2 or (x + y) % 3 else (170, 170, 196)
        elif d < MR + 9:
            q = dith((1 - (d - MR) / 9) * 0.6, x, y, 4)
            bg[y, x, :3] = (bg[y, x, :3] * (1 - q * 0.5) + np.array([120, 110, 170]) * q * 0.5).astype(np.uint8)


def scene_put(dst, s, sx0, sy0):
    """Sprite mit Szenenkoordinaten (linke obere Ecke sx0, sy0) im Raster platzieren."""
    put(dst, s, sx0 - NX + 62, sy0 - NY + G)


NIGHT = np.array([16, 10, 36])


def night(s, f):
    """Sprite im Mondlicht: abgedunkelt und ins Violettblau gezogen."""
    return shade(s, f, NIGHT)


pav = compose(BJ, [236, 231, 237], crop=False)
pav[..., 3] = np.where(pav[..., 3] > 0, 255, 0)
scene_put(bg, night(pav[28:141, 80:162], 0.42), 80, 28)
trees = layer(BJ, 217)[95:141, 70:172].copy()
row = crop_alpha(trees)
tb = bbox(trees)
scene_put(bg, night(row, 0.5), 70 + tb[0], 95 + tb[1])
rw = row.shape[1]
scene_put(bg, night(flip(row), 0.4), 70 + tb[0] - rw + 8, 95 + tb[1] + 1)       # Hain links fortgesetzt
scene_put(bg, night(flip(row), 0.4), 70 + tb[0] + rw - 8, 95 + tb[1] + 1)       # und rechts
# Boden: dunkler, ruhiger Grund mit wenigen gefallenen Blüten (Blütenpixel aus Ebene 142)
pet = layer(BJ, 142)
for y in range(G + 1, GH):
    for x in range(GW):
        t = (y - G) / (GH - G)
        q = dith(t, x, y, 4)
        bg[y, x, :3] = np.array([34, 18, 40]) * (1 - q) + np.array([12, 6, 18]) * q
        bg[y, x, 3] = 255
for y in range(G + 1, GH):
    for x in range(GW):
        c = pet[150 + (y - G), 80 + x]
        if c[3] > 0 and (x // 3 + y // 3) % 3 == 0:
            bg[y, x, :3] = (c[:3] * 0.45).astype(np.uint8)
# einzelne treibende Blüten in der Luft (Ebene 142, 1:1, nur jede dritte Gruppe)
for y in range(34, G - 10):
    for x in range(GW):
        c = pet[110 + y % 150, 150 + x]
        if c[3] > 0 and (x // 6 + y // 6) % 3 == 0:
            bg[y, x, :3] = (c[:3] * 0.7).astype(np.uint8)
cv = Canvas(W, H)
blit(cv, bg, 2)

# ---------------------------------------------------------------- Nachbild (Idej Projection) + Daiyo 5×
k = 5
dw, dh = (X1 - X0) * k, (Y1 - Y0) * k
DX, DY = 42, 116
# grüner Schein hinter Daiyo und auf dem Boden (Raster 2×, gedithert)
gx, gy = (DX + 7 * k + 45) / 2, (DY + 80) / 2
for y in range(GH):
    for x in range(GW):
        d = math.hypot((x + .5 - gx) / 34, (y + .5 - gy) / 48)
        if d < 1:
            q = dith((1 - d), x, y, 4) * 0.22
            c = cv.a[y * 2:(y + 1) * 2, x * 2:(x + 1) * 2].astype(float)
            cv.a[y * 2:(y + 1) * 2, x * 2:(x + 1) * 2] = (c * (1 - q) + np.array([70, 255, 110]) * q).astype(np.uint8)


def echo_on(dst, k, ox, oy, a):
    """Ein Nachbild: nur der Körper, im Schachbrett der 5×-Pixel gedithert (jeder zweite Pixel)."""
    b = body.copy()
    yy, xx = np.mgrid[0:b.shape[0], 0:b.shape[1]]
    b[((xx + yy) % 2) == 1, 3] = 0
    u = up(b, k)
    h, w = u.shape[:2]
    X0_, Y0_ = max(0, ox), max(0, oy)
    X1_, Y1_ = min(dst.shape[1], ox + w), min(dst.shape[0], oy + h)
    u = u[Y0_ - oy:Y1_ - oy, X0_ - ox:X1_ - ox]
    sub = dst[Y0_:Y1_, X0_:X1_].astype(float)
    m = (u[..., 3] >= 128)[..., None]
    dst[Y0_:Y1_, X0_:X1_] = np.where(m, u[..., :3] * a + sub * (1 - a), sub).astype(np.uint8)


# ein Nachbild rechts hinten, höher und deutlich seitlich versetzt
echo_on(cv.a, k, DX + 76, DY - 30, 0.55)
daiyo_on(cv.a, k, DX, DY, 0.73, 1.0)
print(save(cv, '24_afterimage.png'))
