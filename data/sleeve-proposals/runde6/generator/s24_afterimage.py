# -*- coding: utf-8 -*-
"""24 Afterimage – Gegner „Idej Illusions“ (sample-Structure Deck Idej Illusions),
Held/Hauptmotiv: Idej Lord Daiyo (Base-Karte).

Idee (Porträt mit Transparenz): Daiyo, der grüne, halb durchsichtige Geist-Samurai seiner Karte, schwebt
groß vor dem Tempelpavillon der Kogarasu-Karte (Cover) im Abendrot; Kirschblüten treiben vorbei. Hinter ihm
verschieben sich zwei noch blassere Nachbilder seiner selbst nach links und rechts oben – seine Idej
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


def daiyo_on(dst, k, ox, oy, a_body, a_sword):
    """Daiyo in Pixelgröße k auf dst (RGB-Array des 250×350-Rasters) legen – Ebenen in Kartenreihenfolge
    (Körper, darüber Schwert, darüber Hand) mit eigener Deckkraft."""
    for s, a in ((body, a_body), (sword, a_sword), (hand, a_body)):
        u = up(s, k)
        h, w = u.shape[:2]
        sub = dst[oy:oy + h, ox:ox + w].astype(float)
        m = (u[..., 3] >= 128)[..., None]
        dst[oy:oy + h, ox:ox + w] = np.where(m, u[..., :3] * a + sub * (1 - a), sub).astype(np.uint8)


# ---------------------------------------------------------------- Hintergrund 2× (125×175), Abenddämmerung
GW, GH = grid(2)
CX = 121                    # Pavillonmitte (Ebenenkoordinaten)
BX0, BY0 = CX - GW // 2, 10
sky = layer(BJ, 247)
acc = np.zeros_like(sky)
# Himmel: Ebene 247 reicht nur bis y≈25 hinauf und ist 397 breit → nach oben mit der obersten Zeile auffüllen
sb = bbox(sky)
acc[:] = 0
acc[sb[1]:, :] = sky[sb[1]:, :]
acc[:sb[1], :] = sky[sb[1]:sb[1] + 1, :]
acc[..., 3] = 255
acc = over(acc, layer(BJ, 231)); acc = over(acc, layer(BJ, 236)); acc = over(acc, layer(BJ, 237))
trees = layer(BJ, 217)
tb = bbox(trees)
row = trees[tb[1]:tb[3], tb[0]:tb[2]]
rh, rw = row.shape[:2]


def plant(dst, s, x, y):
    t = np.zeros_like(dst); t[y:y + s.shape[0], x:x + s.shape[1]] = s
    return over(dst, t)


acc = over(acc, trees)
# weitere Reihen des Blütenhains nach vorn (versetzt, abwechselnd gespiegelt), bis zum unteren Bildrand
for j, (dy, dx) in enumerate(((20, -34), (20, 30), (38, -6), (52, -40), (52, 26), (66, -12))):
    acc = plant(acc, flip(row) if j % 2 == 0 else row, tb[0] + dx, tb[1] + dy)
acc = over(acc, layer(BJ, 142))
bg = acc[BY0:BY0 + GH, BX0:BX0 + GW].copy()
bg[..., 3] = 255
# Dämmerung: nach oben violett-dunkel, geordnet gedithert; unten (Hain) ebenfalls dunkler
for y in range(GH):
    for x in range(GW):
        t = max(0.0, 1 - y / 70) * 0.75 + max(0.0, (y - 130) / 45) * 0.55
        q = dith(min(1.0, t), x, y, 4)
        bg[y, x, :3] = (bg[y, x, :3] * (1 - q * 0.8) + np.array([34, 10, 40]) * q * 0.8).astype(np.uint8)
cv = Canvas(W, H)
blit(cv, bg, 2)

# ---------------------------------------------------------------- Nachbilder (Idej Projections) + Daiyo 5×
k = 5
dw, dh = (X1 - X0) * k, (Y1 - Y0) * k
DX, DY = (W - dw) // 2 + 5, 100
# grüner Schein hinter Daiyo (Raster 2×, gedithert)
gx, gy = (DX + dw / 2 - 5) / 2, (DY + 80) / 2
for y in range(GH):
    for x in range(GW):
        d = math.hypot((x + .5 - gx) / 34, (y + .5 - gy) / 46)
        if d < 1:
            q = dith((1 - d), x, y, 4) * 0.28
            c = cv.a[y * 2:(y + 1) * 2, x * 2:(x + 1) * 2].astype(float)
            cv.a[y * 2:(y + 1) * 2, x * 2:(x + 1) * 2] = (c * (1 - q) + np.array([80, 255, 110]) * q).astype(np.uint8)
daiyo_on(cv.a, k, DX - 70, DY - 15, 0.3, 0.3)
daiyo_on(cv.a, k, DX + 70, DY - 15, 0.3, 0.3)
daiyo_on(cv.a, k, DX, DY, 0.73, 1.0)
print(save(cv, '24_afterimage.png'))
