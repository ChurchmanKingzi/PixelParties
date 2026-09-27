# -*- coding: utf-8 -*-
"""38 Thing in the Hull – Luftbild: das Holzschiff fährt nachts bugvoran durch schwarzes Wasser; unter der
Oberfläche zeichnet sich der Schatten eines Ungeheuers ab, ein gewaltiger Tentakel wölbt sich aus dem Meer
über den Bug auf den Kapitän zu, der dort mit hochgerissenen Armen steht; rings ums Schiff stoßen kleine
Tentakel aus dem Wasser.

Quellen (MotiveIndia.xcf, Karte „Panicking Captain“, Szene Sichtbar #63 [25]):
  Ebene 396 „Ebene #24“ (Rumpf) + 394 „Ebene #45“ + 395 „Ebene #2“ (Deck: Kanonen, Gitter, Fahnen, Säbel)
      – Bughälfte des Schiffs; das Heck ist im Original abgeschnitten und liegt hier außerhalb des Bildes.
  Ebene 385 „Panicking Captain #3“ – großer Tentakel (vertikal gespiegelt)
  Ebenen 383 (Hut) + 384 (Arme) + 387 (Körper) + 388 (Schatten) – Kapitän, geprüft gegen Sichtbar #63;
      das kleine Zündfunken-Teil aus 384 (gehört zur Kanone) entfernt.
  Ebene 391 „Ebene #5“ – zwei kleine Tentakel (Karte „The Thing in the Hull“)
  Ebene 402 „Ebene #59“ – dunkler Umriss des Ungeheuers unter Wasser (als halbtransparenter Schatten)
  Ebene 403 „Hintergrund-Kopie“ – Meereskachel
Selbst gezeichnet: Bugwelle/Kielwasser, Schaumringe um die Tentakel, Wasserglanz.

Skalierung: EIN Raster 1× (250×350) für alles – Meer, Schatten, Schiff, Kapitän, Tentakel, Schaum.
"""
import sys, os, math
from common import *  # noqa  (Runde-4-common zuerst laden)

B = 'MotiveIndia'
cv = Canvas(250, 350)
W, H = 250, 350
FOAM, FOAM2 = (150, 176, 190), (96, 124, 142)     # Schaum (aufgehellte Meeresfarben)

ship = sprite('h38_ship', B, [394, 395, 396])
tent = sorted(parts(sprite('h38_tentacle', B, [385]), dil=1), key=lambda p: -p.shape[0] * p.shape[1])[0]
capt_all = sprite('h38_captain', B, [383, 384, 387, 388])
cp = sorted(parts(capt_all, dil=0), key=lambda p: -p.shape[0] * p.shape[1])
capt = cp[0]                                    # Kapitän ohne den kleinen Zündfunken
small = parts(sprite('h38_small', B, [391]), dil=1)
shadow = sprite('h38_shadow', B, [402])
print('ship', ship.shape, 'tent', tent.shape, 'capt', capt.shape, 'small', [s.shape for s in small])

# --- Meer ------------------------------------------------------------------------------------------
# dunkler Meeresteil der Kachel: senkrechte Periode 76, waagrecht gespiegelt auf 250 verbreitert
sea = layer(B, 403)[130:206, 330:505, :3]
sea = widen(sea, W)
for y in range(H):
    cv.a[y] = sea[y % 76]
# Ungeheuer-Schatten unter Wasser (selbst gezeichnet, 1×): dunkler Leib vor dem Bug, Arme laufen zum Schiff
DARK = np.array((3, 9, 14))
def shade(x, y, t):
    if 0 <= x < W and 0 <= y < H and t > BAYER4[y % 4, x % 4]:
        cv.a[y, x] = (cv.a[y, x] * 0.35 + DARK * 0.65).astype(np.uint8)
MX, MY = 125, 58
for y in range(0, 140):
    for x in range(W):
        d = ((x - MX) / 62) ** 2 + ((y - MY) / 50) ** 2
        if d < 1: shade(x, y, min(1, (1 - d) * 2.2))
for k, a0 in enumerate((200, 225, 250, 290, 315, 340, 130, 50)):
    a = math.radians(a0 + 90 + 180)
    for i in range(0, 120):
        r = 40 + i
        bend = math.sin(i / 18.0 + k) * 0.35
        x = int(round(MX + r * math.cos(a + bend * i / 120)))
        y = int(round(MY + r * math.sin(a + bend * i / 120) * 1.1))
        wdt = max(1, int(9 - i / 14))
        for dx in range(-wdt, wdt + 1):
            for dy in range(-wdt, wdt + 1):
                if dx * dx + dy * dy <= wdt * wdt: shade(x + dx, y + dy, 0.75 - i / 260)

# --- Schiff (Bug nach oben) ------------------------------------------------------------------
S = rot90(ship, 2)
SX, SY = (W - S.shape[1]) // 2, H - S.shape[0] + 14     # Heck-Schnittkante unterhalb des Bildrands
# Bugwelle + Kielwasser (selbst gezeichnet, Schaumfarben aus der Meereskachel aufgehellt)
tip_x = SX + S.shape[1] // 2
for i in range(0, 150):
    for side in (-1, 1):
        x = tip_x + side * (4 + int(i * 0.62))
        y = SY + 6 + i
        # Schaumlinie: 1 px breit, hell/dunkel abwechselnd, mit Lücken
        if (i // 5) % 4 != 3:
            cv.px(x, y, FOAM if i % 2 == 0 else FOAM2)
            if i < 20: cv.px(x - side, y, FOAM2)
for k in range(3):                                         # Bugschaum vorn
    cv.px(tip_x - 1 + k, SY + 2, FOAM)
cv.paste(silhouette(S, (4, 8, 14)), SX + 3, SY + 3, alpha=0.5)   # Schlagschatten aufs Wasser
cv.paste(S, SX, SY)

# --- Kapitän am Bug -------------------------------------------------------------------------------
# freie Deckfläche vorn, knapp vor der ersten Gitterreihe
CX, CY = W // 2, SY + 94
cv.paste(capt, CX - capt.shape[1] // 2, CY - capt.shape[0])

# --- Ding im Rumpf: rote Augen in der dunklen Ladeluke, Tentakel quellen heraus (Ebene 390) ------------
# Luke im ungedrehten Schiff: x 62–78, y 84–111 → nach 180°-Drehung x 62–78, y 128–155 (gleiche Größe);
# die Figur (Augen + Tentakel, aufrecht; zugeschnitten ab (438,243)) sitzt relativ zur Luke wie im Original (Versatz −6/0).
hull = sprite('h38_hullthing', B, [390], box=(430, 240, 490, 277))
cv.paste(hull, SX + 62 - 6, SY + 128)

# --- großer Tentakel: steigt links neben dem Bug senkrecht aus dem Wasser (gerade Unterkante =
#     Wasserlinie) und krümmt sich mit der Spitze bis knapp über den Kopf des Kapitäns ---------------------
T = tent
m = T[..., 3] > 0
ys, xs = np.where(m)
j = np.argmax(xs); tipx, tipy = xs[j], ys[j]              # Spitze (ganz rechts oben)
TX, TY = CX - 12 - tipx, CY - capt.shape[0] - 6 - tipy
cv.paste(silhouette(T, (2, 6, 12)), TX + 6, TY + 7, alpha=0.45)
cv.paste(T, TX, TY)
# Schaumkranz um die Austrittsstelle (Unterkante)
bot = np.where(m[-1])[0]
bx0, bx1, by = TX + bot[0], TX + bot[-1], TY + T.shape[0]
Sm = np.zeros((H, W), bool)
Sm[SY:SY + S.shape[0], SX:SX + S.shape[1]] = (S[..., 3] > 0)[:H - SY]
for x in range(bx0 - 4, bx1 + 5):
    if Sm[by, x]: continue                                 # kein Schaum auf dem Rumpf
    cv.px(x, by, FOAM if x % 2 == 0 else FOAM2)
    if x % 3 == 0 and not Sm[by + 1, x]: cv.px(x, by + 1, FOAM2)
for x in (bx0 - 6, bx0 - 5, bx1 + 6, bx1 + 7):
    cv.px(x, by - 1, FOAM2)

# --- kleine Tentakel rings ums Schiff (gespiegelt verteilt) ----------------------------------------------
def foam_ring(cx, cy, rx, ry):
    for a in range(0, 360, 6):
        x = int(round(cx + rx * math.cos(math.radians(a)))); y = int(round(cy + ry * math.sin(math.radians(a))))
        if 30 < a < 150: continue                          # vorne verdeckt der Tentakel selbst
        cv.px(x, y, FOAM if (a // 6) % 2 == 0 else FOAM2)

for (x, y, s) in ((40, 300, small[1]), (W - 40, 300, flip(small[1]))):
    foam_ring(x, y, s.shape[1] // 2 + 3, 3)
    cv.paste(s, x - s.shape[1] // 2, y - s.shape[0] + 2)

vignette(cv, 0.45, 0.6)
print(save(cv, '38_thing_in_the_hull.png'))
