# -*- coding: utf-8 -*-
"""25 Initiation Rite – Gegner „Join our Cult!“ (sample-Structure Deck Join our Cult), Held: Klaus, the Cult Leader.

Idee (Porträt-Close-up über der Zeremonie): Aus dem Dunkel über seinem Kultkeller erhebt sich Klaus groß als
Brustbild – Kapuze, blaues Haar, rotes Auge, erhobener Opferdolch –, links und rechts von ihm lodern die zwei
Wandfackeln. Klein darunter auf dem Steinboden des Gewölbes kniet der braunhaarige Neuling seiner Base-Karte in
einem fahlen roten Decay-Glühen („Join our Cult!“), flankiert von zwei gleich aufgestellten Reihen seiner
Kultisten in schwarzen Kutten. Kein Pentagramm.

Quellen (MotiveGrailWar.xcf):
  Ebene 526 „Kultisten“, rechte Gruppe (Box x 279–297, y 123–154) = die Figurengruppe der Base-Karte
      „Klaus, the Cult Leader“ (Kartenszene Sichtbar #48 = Ebene 738, Lage 222,66; die Karte zeigt sie
      weichgezeichnet/vergrößert). Auf der Karte existiert von Klaus nur der Kopf mit Kapuze, Dolch und Hand –
      sein Körper steckt hinter dem Neuling (Ebenen geprüft: scene_layers/card_region_layers der Szene 738 liefern
      keine weitere Klaus-Ebene). Daher:
        – Klaus-Brustbild = Zeilen 0–17 der Gruppe ohne die Haarpixel des Neulings; die so frei werdenden Stellen
          innerhalb der Kapuzen-Silhouette mit dem dunklen Kapuzeninneren (32,32,32) gefüllt und die Kutte in den
          Kapuzenfarben (Umriss 25/Saum 82/Fläche 42) um 6 Zeilen nach unten fortgesetzt, unten ins Dunkel
          aufgelöst (leichte Ergänzung, Farben und Pixelgröße des Sprites).
        – Neuling = Zeilen 12–30 der Gruppe ohne Klaus-Pixel (vollständig, er steht vor Klaus).
      Linke Gruppe derselben Ebene (Box x 249–263, y 116–171): drei Kultisten hintereinander; rechts gespiegelt und
      mit umgefärbtem Haar als zweite Reihe (symmetrische Aufstellung).
  Ebene 532 „Ebene #145“ – Kultkeller mit brennenden Fackeln (Ausschnitt x 234–359, y 26–201); Ritualkreis
      (x 268–326, y 125–186) mit der Bodenkachel (16×16, x 282–298, y 108–124) übermalt, die fünf eingebauten
      Kultisten per 16-px-Periode aus den Nachbarspalten übermalt.
Selbst gezeichnet: Dunkelheit über dem Gewölbe, Fackelschein, rotes Bodenglühen, Bodenschatten.

Skalierung:
  Hintergrund (Gewölbe, Neuling, Kultistenreihen, Licht)   – 2× (Raster 125×175)
  Vordergrund (Klaus-Brustbild 18×24 → 144×192)            – 8× (Raster 32×44)
"""
import math
import numpy as np
from ekit_25_30 import *  # noqa

GW = 'MotiveGrailWar'
grp = sprite('o25_klaus_group', GW, [526], box=(279, 123, 297, 154))        # 18×31
cult = sprite('o25_cultists', GW, [526], box=(249, 116, 263, 171))          # 14×55

NOVICE = {(48, 7, 0), (188, 89, 56), (89, 31, 0), (229, 130, 81), (147, 64, 23), (237, 155, 122),
          (245, 171, 147), (48, 23, 0), (51, 0, 0)}


def is_novice_px(p):
    return tuple(int(v) for v in p[:3]) in NOVICE


# ---------------- Klaus-Brustbild
bust = np.zeros((24, 18, 4), np.uint8)
for y in range(18):
    for x in range(18):
        p = grp[y, x]
        if p[3] and not is_novice_px(p):
            bust[y, x] = p
HOOD_IN, OUT, RIM, FILL, FILL2 = (32, 32, 32), (25, 25, 25), (82, 82, 82), (42, 42, 42), (50, 50, 50)
for y in range(12, 18):                          # Löcher (Haar des Neulings) innerhalb der Kapuze füllen
    xs = [x for x in range(18) if bust[y, x, 3]]
    lo = 2 if y >= 16 else min(xs)
    for x in range(lo, 17 if y >= 13 else max(xs)):
        if not bust[y, x, 3]:
            bust[y, x] = (*HOOD_IN, 255)
for y in range(18, 24):                          # Kutte: Schultern nach unten fortgesetzt
    lo, hi = max(0, 2 - (y - 17)), 17
    for x in range(lo, hi + 1):
        c = FILL if (x + y) % 4 else FILL2
        if x == lo or x == hi: c = OUT
        elif x == lo + 1: c = RIM
        bust[y, x] = (*c, 255)
for y in range(19, 24):                          # unten ins Dunkel auflösen (gedithert)
    for x in range(18):
        if bay(x, y) < (y - 18) / 5.5:
            bust[y, x, 3] = 0

# ---------------- Neuling (kniend)
novice = np.zeros((19, 18, 4), np.uint8)
for y in range(12, 31):
    for x in range(18):
        p = grp[y, x]
        if p[3] and (y >= 18 or is_novice_px(p)):
            novice[y - 12, x] = p

# ================================================================ 2×: Kultkeller
hall = layer(GW, 532).copy()
tile = hall[108:124, 282:298].copy()
for y in range(125, 186):
    for x in range(268, 326):
        hall[y, x] = tile[(y - 108) % 16, (x - 282) % 16]
boxes = [((246, 112, 266, 142), (16, 32, -16)), ((230, 126, 250, 160), (16, 32, 48)),
         ((325, 106, 347, 174), (-16, -32, -48))]
M = np.zeros(hall.shape[:2], bool)
for (x0, y0, x1, y1), _ in boxes: M[y0:y1, x0:x1] = True
src = hall.copy()
for (x0, y0, x1, y1), dxs in boxes:
    for y in range(y0, y1):
        for x in range(x0, x1):
            for dx in dxs:
                if not M[y, x + dx]:
                    hall[y, x] = src[y, x + dx]; break
X0, Y0 = 234, 26
bw, bh = grid(2)
bg = hall[Y0:Y0 + bh, X0:X0 + bw].copy()
bg[..., 3] = 255
TORCH = [(256 - X0, 96 - Y0), (336 - X0, 96 - Y0)]
NX, NY = 62.5, 142                 # Fußpunkt des Neulings (Canvas 125, 284)
out = bg[..., :3].astype(float)
for y in range(bh):
    for x in range(bw):
        lt = 0.4
        for tx, ty in TORCH:
            d = math.hypot((x + .5 - tx) / 28, (y + .5 - ty) / 32)
            lt += 0.5 * math.floor(max(0, 1 - d) ** 1.3 * 4 + bay(x, y)) / 4
        d = math.hypot((x + .5 - NX) / 30, (y + .5 - (NY - 8)) / 22)
        rg = math.floor(max(0, 1 - d) ** 1.1 * 4 + bay(x, y)) / 4
        c = out[y, x] * min(lt, 1.0) + np.array([140, 10, 18]) * rg * .6
        top = max(0.0, min(1.0, (46 - y) / 14))            # Dunkel über dem Gewölbe
        q = math.floor(top * 4 + bay(x, y)) / 4
        out[y, x] = c * (1 - q) + np.array([5, 3, 8]) * q
bg[..., :3] = out.clip(0, 255).astype(np.uint8)
for tx, ty in TORCH:                                       # Fackelflammen in Originalfarbe
    for y in range(ty - 8, ty + 3):
        for x in range(tx - 6, tx + 6):
            s_ = hall[Y0 + y, X0 + x, :3].astype(int)
            if s_[0] > 180 and s_[0] > s_[2] + 60:
                bg[y, x, :3] = s_


def shadow(a, cx, y, w):
    for x in range(int(cx - w / 2), int(cx + w / 2) + 1):
        if bay(x, y) < .7: setp(a, x, y, (14, 6, 10), 170)


# Neuling in der Mitte, zwei Kultistenreihen symmetrisch (rechts gespiegelt, Haar umgefärbt)
shadow(bg, NX, NY, 16)
put(bg, novice, int(NX - 9), NY - novice.shape[0] + 1)
cult_r = flip(cult)
hair = np.zeros(cult_r.shape[:2], bool)
hsv = cult_r[..., :3].astype(int)
hair = (hsv[..., 0] > hsv[..., 2] + 40) & (cult_r[..., 3] > 0)        # warme Töne = Haar/Haut
skin = (hsv[..., 0] > 200) & (hsv[..., 1] > 150)
cult_r = hsv_shift(cult_r, dh=-25, ds=.8, dv=.8, mask=hair & ~skin)
CY = 152                                                     # Fußzeile der Reihen (Canvas 304)
for cx, s in ((34, cult), (125 - 34, cult_r)):
    shadow(bg, cx, CY, 12)
    put(bg, s, int(cx - s.shape[1] / 2), CY - s.shape[0] + 1)

# ================================================================ 8×: Klaus
fw, fh = grid(8)                                           # 32×44
fg = rgba(fw, fh)
put(fg, bust, 16 - 9, 3)                                   # Canvas x 56–200, y 24–216

print(finish([(bg, 2), (fg, 8)], '25_initiation_rite.png'))
