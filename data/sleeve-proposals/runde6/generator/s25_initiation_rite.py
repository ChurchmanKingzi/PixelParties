# -*- coding: utf-8 -*-
"""25 Initiation Rite – Gegner „Join our Cult!“ (sample-Structure Deck Join our Cult), Held: Klaus, the Cult Leader.

Idee (Porträt vor der Zeremonie): Klaus – Kapuze, blaues Haar, rotes Auge – steht groß im Vordergrund vor der
Tür seines Kultkellers, den Messer-Arm mit dem erhobenen Opferdolch ausgestreckt, der andere Arm hängt. Hinter
ihm im fackelbeleuchteten Gewölbe kniet der braunhaarige Neuling seiner Base-Karte in einem fahlen roten
Decay-Glühen („Join our Cult!“), links und rechts je zwei Kultisten in schwarzen Kutten. Kein Pentagramm.

Quellen:
  runde6/refs/klaus_body_front.png (Nutzer-Referenz, 20×25): Klaus' Körper von vorn. Übernommen bis auf den
      rechten Arm: der ausgestreckte rechte Ärmel (Zeilen 13–16, Spalten 16–19) wurde entfernt und derselbe Ärmel
      um 90° gedreht und auf 9 Zeilen verlängert als hängender Arm an die Schulter gesetzt – nur der Messer-Arm
      (links im Bild) bleibt ausgestreckt.
  MotiveGrailWar.xcf
    Ebene 526 „Kultisten“, rechte Gruppe (Box x 279–297, y 123–154) = Figurengruppe der Base-Karte
      (Kartenszene Sichtbar #48 = Ebene 738, Lage 222,66, weichgezeichnet): daraus der Dolch (Spalten 1–2,
      Zeilen 6–12; über die ausgestreckte Hand gesetzt) und der kniende Neuling (Zeilen 12–30 ohne Klaus-Pixel).
    Linke Gruppe derselben Ebene (Box x 249–263, y 116–171): die unteren zwei Kultisten (grauhaarig, kahl; Haar-
      spitze der oberen Kultistin entfernt); rechts gespiegelt, graues Haar braun getönt (symmetrische Aufstellung).
    Ebene 532 „Ebene #145“ – Kultkeller mit brennenden Fackeln, Tür und beleuchtetem Gang davor (Ausschnitt
      x 234–359, y 60–235); Ritualkreis (x 268–326, y 125–186) mit der Bodenkachel (16×16, x 282–298, y 108–124)
      übermalt, die fünf eingebauten Kultisten per 16-px-Periode aus den Nachbarspalten übermalt.
Selbst gezeichnet: Abdunklung, Fackelschein, rotes Bodenglühen, Bodenschatten.

Skalierung:
  Hintergrund (Gewölbe, Neuling, Kultisten, Licht)   – 2× (Raster 125×175)
  Vordergrund (Klaus 20×25 → 120×150, Schatten)      – 6× (Raster 42×59)
"""
import math, os
import numpy as np
from PIL import Image
from ekit_25_30 import *  # noqa

GW = 'MotiveGrailWar'
grp = sprite('o25_klaus_group', GW, [526], box=(279, 123, 297, 154))        # 18×31
cult = sprite('o25_cultists', GW, [526], box=(249, 116, 263, 171))          # 14×55

NOVICE = {(48, 7, 0), (188, 89, 56), (89, 31, 0), (229, 130, 81), (147, 64, 23), (237, 155, 122),
          (245, 171, 147), (48, 23, 0), (51, 0, 0)}


def is_novice_px(p):
    return tuple(int(v) for v in p[:3]) in NOVICE


# ---------------- Klaus von vorn (Nutzer-Referenz runde6/refs/klaus_body_front.png, 20×25)
REF = np.array(Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'refs',
                                       'klaus_body_front.png')).convert('RGBA'))
klaus = REF.copy()
seg = REF[13:17, 14:20].copy()                         # rechter Ärmel waagrecht (4 Zeilen × 6 Spalten)
klaus[13:17, 16:20] = 0
arm = np.rot90(seg, -1)                                # als hängender Ärmel senkrecht gestellt …
arm = np.concatenate([arm[:3], arm[2:4], arm[2:4], arm[3:]], 0)   # … und auf 9 Zeilen verlängert
for y in range(arm.shape[0]):
    for x in range(arm.shape[1]):
        if arm[y, x, 3]:
            klaus[13 + y, 15 + x] = arm[y, x]
for y in range(6, 13):                                 # Dolch der Kartengruppe über der ausgestreckten linken Hand
    for x in (1, 2):
        p = grp[y, x]
        if p[3] and tuple(int(v) for v in p[:3]) in ((191, 198, 198), (246, 246, 246)):
            klaus[y, x - 1] = p

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
X0, Y0 = 234, 60
bw, bh = grid(2)
bg = hall[Y0:Y0 + bh, X0:X0 + bw].copy()
bg[..., 3] = 255
TORCH = [(256 - X0, 96 - Y0), (336 - X0, 96 - Y0)]
NX, NY = 62.5, 76                  # Fußpunkt des Neulings (Canvas 125, 152)
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
        top = max(0.0, min(1.0, (14 - y) / 10))            # Dunkel über dem Gewölbe
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
# nur die beiden unteren Kultisten der Reihe (grauhaarig + kahl); die Haarspitze der oberen Kultistin entfernt
cult2 = cult[14:].copy()
for y in range(4):
    for x in range(cult2.shape[1]):
        c_ = cult2[y, x, :3].astype(int)
        if cult2[y, x, 3] and c_[0] > c_[2] + 40:
            cult2[y, x] = 0
cult = crop_alpha(cult2)
cult_r = flip(cult)
g_ = cult_r[..., :3].astype(int)                                      # rechte Reihe: graues Haar braun getönt
grey_hair = (cult_r[..., 3] > 0) & (np.abs(g_[..., 0] - g_[..., 2]) < 12) & (g_.max(-1) > 70)
grey_hair[12:] = False
cult_r[grey_hair, :3] = (cult_r[grey_hair, :3] * np.array([.9, .62, .42])).astype(np.uint8)
CY = 96                                                      # Fußzeile der Reihen (Canvas 192)
for cx, s in ((36, cult), (125 - 36, cult_r)):
    shadow(bg, cx, CY, 12)
    put(bg, s, int(cx - s.shape[1] / 2), CY - s.shape[0] + 1)

# ================================================================ 6×: Klaus im Vordergrund vor der Kellertür
fw, fh = grid(6)                                           # 42×59
fg = rgba(fw, fh)
KX, KB = 11, 53                                            # linke Kante, Fußzeile (Canvas x 66–186, y 318–323)
for x in range(KX + 5, KX + 16):
    if bay(x, KB + 1) < .8: setp(fg, x, KB + 1, (10, 5, 8), 190)
put(fg, klaus, KX, KB - klaus.shape[0] + 1)

print(finish([(bg, 2), (fg, 6)], '25_initiation_rite.png'))
