# -*- coding: utf-8 -*-
"""08 Live Fire Test – Gegner „Boom Boom Kaboom!“ (Structure Deck Boom Boom Kaboom), Held: Andras, the Human Weapon.

Bildidee: Scharfer Test im Labor, in dem Andras gebaut wurde. Die menschliche Waffe schwebt mit weit gespreizten
Arm-Schubflammen in der stählernen Prüfhalle, die Bombe unter ihr zielt senkrecht auf die Test-Puppe am Boden –
gleich macht es „Kaboom“. Die Flammen lecken bis an die schwarzen Rohrsäulen der Halle, auf dem Riffelblech
spiegelt sich das Feuer. (≠ „Life Serum“: keine Röhre; ≠ „Afterburner“: kein Himmelsflug.)

Quellen (MotiveGN.xcf):
  Ebenen 448 „Andras“ + 446 „Andras #1“ + 445 „Andras #2“ – Base-Andras der Heldenkarte (Szene „Sichtbar #145“ =
         Ebene 7, Lage 139,236): Figur mit Armkanonen, Brustflamme mit Bombe, zwei Schubflammen. Pixelgleich mit der
         Szene bis auf den Kartenrand (die Karte schneidet die Flammenspitzen ab). 447 „Andras #3“ (verwischte
         Variante der Brustflamme) nicht verwendet.
  Ebene 479 „Test Dummy“ – Prüfpuppe; die Ziffern „999“ auf ihrer Anzeige entfernt (kein Text), Anzeige dunkel.
  Ebene 551 „Life Serum“ – schwarze Rippenrohre der Laborhalle (Rohrstück, senkrecht gekachelt).
  Ebene 559 „Hintergrund“ – Riffelblech-Fliesen des Laborbodens (16-px-Kachel) als Wand und Boden.
Selbst gezeichnet: Hallenlicht/Abdunklung, Bodenkante, Feuerschein und Spiegelung, Schatten, Warnstreifen am Boden.

Skalierung (Tiefenebenen):
  Hintergrund 2× (125×175): Wand aus Riffelblech, Rohrsäulen, Boden, Feuerschein
  Vordergrund 3× (84×117):  Andras mit Flammen und Bombe, Test-Puppe, Schatten
"""
import math, random
import numpy as np
from common import *  # noqa

rnd = random.Random(8)
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32.0
B = 'MotiveGN'

# ------------------------------------------------------------------ Sprites
andras = sprite('o08_andras', B, [445, 446, 448])                    # 49×84
dummy = sprite('o08_dummy', B, [479]).copy()                         # 38×19
scr = dummy[2:9, 2:17, :3].astype(int)
bg_scr = tuple(np.array(sorted(map(tuple, scr.reshape(-1, 3)), key=lambda c: sum(c))[0]))   # dunkelste Farbe = Schirm
dummy[3:9, 3:16, :3] = bg_scr                                        # Anzeige ohne Ziffern „999“ (kein Text)
lab = parts(sprite('o08_lab', B, [551]), dil=1)[0]
pipe = lab[1:54, 5:25]
pipe = pipe[:, np.nonzero(pipe[..., 3].sum(0))[0].min():np.nonzero(pipe[..., 3].sum(0))[0].max() + 1]
PER = period(pipe[4:50], 0, 4, 20)[0]                                # Rippen-Periode des Rohrs
floor_src = layer(B, 559)[...,:3]
TILE = floor_src[170:186, 110:126].astype(float)                     # 16×16 Riffelblech-Kachel


def put(dst, s, x, y, f=1.0):
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            if s[j, i, 3] == 0: continue
            yy, xx = y + j, x + i
            if 0 <= yy < dst.shape[0] and 0 <= xx < dst.shape[1]:
                dst[yy, xx, :3] = np.clip(s[j, i, :3].astype(float) * f, 0, 255); dst[yy, xx, 3] = 255


# ================================================================== Geometrie (3×-Raster 84×117)
AX, AY = 0, 12                     # Andras-Sprite links oben → Canvas (−1, 36); Flammenspitzen am Bildrand
bomb_rows = np.nonzero(andras[:, 38:46, 3].sum(1))[0]
BOMB_TIP = AY + bomb_rows.max()    # Spitze der Bombe (3×-Raster)
DFEET = 104                        # Fuß der Test-Puppe (Canvas y 312)
DX = 42 - dummy.shape[1] // 2
FIRE = [(AX + 4, AY + 44), (AX + 79, AY + 44)]   # Flammenenden (Feuerschein-Zentren)

# ================================================================== Hintergrund 2× (125×175)
W2, H2 = 125, 175
FLOOR = 132                        # Wand/Boden-Kante (Canvas y 264)
bg = np.zeros((H2, W2, 4), np.uint8); bg[..., 3] = 255
for y in range(H2):
    for x in range(W2):
        c = TILE[y % 16, x % 16]
        if y < FLOOR:
            f = 0.30 + 0.10 * (y / FLOOR)                      # Wand: dunkle Halle
        else:
            k = y - FLOOR
            f = 0.42 + 0.18 * min(1, k / 30)                   # Boden etwas heller
        # Feuerschein der beiden Schubflammen und der Brustflamme
        L = 0.0
        for fx, fy in FIRE + [(42, AY + 30)]:
            dd = math.hypot(x + 0.5 - fx * 1.5, (y + 0.5 - fy * 1.5) * 1.1)
            L = max(L, max(0, 1 - dd / 46) ** 1.6)
        q = math.floor(L * 4 + BAY[y % 4, x % 4]) / 4
        col = c * f + np.array((255, 150, 50)) * 0.30 * q
        bg[y, x, :3] = np.clip(col, 0, 255)
# Bodenkante und Warnstreifen (gelb/schwarz) quer über den Boden unter der Puppe
for x in range(W2):
    bg[FLOOR, x, :3] = (24, 24, 30)
    bg[FLOOR + 1, x, :3] = (70, 70, 80)
for y in range(FLOOR + 22, FLOOR + 26):
    for x in range(W2):
        bg[y, x, :3] = (190, 150, 40) if ((x + y) // 3) % 2 == 0 else (30, 28, 30)
# Rohrsäulen links und rechts (senkrecht gekachelt, abgedunkelt)
ph = pipe.shape[0]
for cx in (6, W2 - 6 - pipe.shape[1]):
    for y in range(0, FLOOR):
        r = pipe[4 + (y % PER) + PER * 0][None] if y < FLOOR - 4 else pipe[ph - 4 + (y - FLOOR + 4)][None]
        put(bg, r, cx, y, 0.75)
    for i in range(pipe.shape[1] + 2):                        # Sockel
        for j in range(3):
            bg[FLOOR - 1 + j, cx - 1 + i, :3] = (34, 34, 40) if j else (90, 90, 100)

# ================================================================== Vordergrund 3× (84×117)
W3, H3 = 84, 117
fg = np.zeros((H3, W3, 4), np.uint8)
# Schatten der Puppe und Feuer-Spiegelung auf dem Boden
for i in range(-7, 8):
    x = 42 + i
    fg[DFEET, x, :3] = (20, 18, 22); fg[DFEET, x, 3] = 170
put(fg, dummy, DX, DFEET - dummy.shape[0] + 1)
put(fg, andras, AX, AY)

# ================================================================== zusammensetzen
cv = Canvas(250, 350)
cv.paste(up(bg, 2), 0, 0)
cv.paste(up(fg, 3), -1, 0)
save(cv, '08_live_fire_test.png')
print('ok', BOMB_TIP * 3, (DFEET - dummy.shape[0] + 1) * 3)
