# -*- coding: utf-8 -*-
"""06 Crimson Campaign – Gegner „Bloody King Zi“, Held: Timeless King Zi (Base-Version).
Feldherr im blutroten Abendlicht: Zi steht groß auf dem verschneiten Feld seiner Heimat, links und rechts von ihm
stecken seine zwei blau-goldenen Standarten (die Szepter seiner Kartenszene) im Schnee. Zi schwebt deutlich über seinem Schatten. Fern am
Horizont steht Skulltop Castle – das weiße Schloss mit Goldkuppeln und blauen Fahnen auf einem verschneiten
Riesenschädel – vor rot glühendem Himmel.

Quellen (MotiveGrailWar.xcf):
  Ebene 487 „Zi“: Base-Zi mit Sternumhang (26×28), in Sichtbar #169 (Ebene 30, Kartenbild „Timeless King Zi“,
      Lage 227,108) sichtbar (99 %, Kartenszene leicht abgedunkelt).
  Ebene 485 „Zi #2“: die zwei Szepter/Standarten seiner Kartenszene.
  Ebene 490 „Skulltop Castle“ + 496 „Gigantisaur Skull“ (das Schloss sitzt wie in Sichtbar #54 auf dem verschneiten
      Riesenschädel; = Referenz skulltop_castle_ref.png), leicht in Abendlicht getönt.
  Ebene 476 „Ebene #139“: Schneefläche seiner Kartenszene (als Bodentextur, rot getönt).
Selbst gezeichnet: Abendhimmel, ferner Bergkamm, Schneewellen, Schatten.

Skalierung (Ausgabe = 250×350-Raster × 3):
  Himmel, ferner Bergkamm                                  – 1× (250×350)
  Schneefeld, Skulltop Castle, Standarten, Schatten        – 2× (125×175)
  Zi                                                       – 6× (42×59)
"""
import math, random
from a_util import *  # noqa
import numpy as np

B = 'MotiveGrailWar'
zi = sprite('o06_zi', B, [487])                               # Base-Zi mit Sternumhang (26×28), = Sichtbar #169
std = parts(compose(B, [485]), dil=1)[0]                      # „Zi #2“: Standarte (7×36)
snow = compose(B, [476], crop=False)[284:309, 143:303]        # Schneefläche (ohne Eisgrate/Kanten)
castle = sprite('o06_skulltop', B, [490, 496])                # Skulltop Castle (490) auf dem Gigantisaur-Schädel (496), 50×63

# ---- Ebene 1: Abendhimmel, ferner Bergkamm (1×) ----------------------------------------------
cv = Canvas(250, 350)
HOR = 150                                                    # Horizont im 250er-Raster
SKY = [(52, 10, 22), (84, 16, 28), (122, 24, 30), (160, 38, 30), (196, 66, 36), (226, 110, 52), (240, 150, 80)]
for y in range(HOR + 10):
    t = min(1, y / HOR) * (len(SKY) - 1)
    i = min(len(SKY) - 2, int(t)); f = t - i
    for x in range(250):
        cv.a[y, x] = SKY[i + 1] if f > bayer(x, y) else SKY[i]
# ferner Bergkamm (selbst gezeichnet, 1×), verdeckt den Schlossfuß
RIDGE = (98, 40, 52)
for x in range(250):
    h = 9 + 5 * math.sin(x * 0.045 + 0.8) + 3 * math.sin(x * 0.13)
    top = int(HOR - h)
    for y in range(top, HOR + 10):
        cv.a[y, x] = RIDGE if y > top else (140, 64, 70)

# ---- Ebene 2: Schneefeld, Skulltop Castle, Standarten (2×, 125×175) -------------------------------------------
W2, H2 = 125, 175
p2 = rgba(W2, H2)
G0 = HOR // 2 + 2                                            # Schneefeld beginnt knapp unter dem Horizont
for y in range(G0, H2):
    for x in range(W2):
        c = snow[(y - G0) % snow.shape[0], x % snow.shape[1], :3].astype(float)
        depth = (y - G0) / (H2 - G0)
        # Abendlicht: hinten stark rot-violett, vorn heller rosa
        c = c * np.array([0.92, 0.62, 0.70]) * (0.72 + 0.25 * depth)
        p2[y, x] = list(np.clip(c, 0, 255).astype(np.uint8)) + [255]
# weiche Schneewellen (hellere Kämme, selbst gezeichnet)
for (y0, amp, ph) in [(G0 + 6, 2, 0.3), (G0 + 20, 3, 1.7), (G0 + 42, 3, 2.9)]:
    for x in range(W2):
        y = int(y0 + amp * math.sin(x * 0.09 + ph))
        p2[y, x, :3] = mix(p2[y, x, :3], (250, 200, 210), 0.45)
        p2[y + 1, x, :3] = mix(p2[y + 1, x, :3], (120, 60, 90), 0.25)
# Skulltop Castle – das Schloss auf dem verschneiten Riesenschädel – fern am Horizont rechts, im Abendlicht getönt
ck = castle.copy()
ck[..., :3] = (ck[..., :3] * 0.72 + np.array([236, 140, 110]) * 0.28).astype(np.uint8)
put(p2, ck, 68, G0 + 3 - ck.shape[0])
# Zis zwei Standarten stecken links und rechts im Schnee
SY = 118
put(p2, std, 14, SY - std.shape[0])
put(p2, std, W2 - 14 - std.shape[1], SY - std.shape[0])
for sx in (14 + 3.5, W2 - 14 - 3.5):
    shadow_ellipse(p2, sx, SY, 4, 1.0, col=(60, 10, 30), a=0.4)
# Bodenschatten unter Zi (250er-y 310 → 2×-Reihe 155); Zi selbst schwebt 36 px höher
shadow_ellipse(p2, 62.5, 155, 16, 2.6, col=(60, 10, 30), a=0.45)   # Zi schwebt deutlich darüber
blit(cv, p2, 2)

# ---- Ebene 3: Zi (6×, 42×59) --------------------------------------------------------------------
W6, H6 = 42, 59
p6 = rgba(W6, H6)
ZX, ZY = (W6 - zi.shape[1]) // 2, 46 - zi.shape[0]            # 6 Zeilen (36 px) über dem Schatten
put(p6, zi, ZX, ZY)
blit(cv, p6, 6, -1, -2)
print(save(cv, '06_crimson_campaign.png'))
print(preview('06_crimson_campaign.png', 'cosmic', 'ice', 'ruby', 'sapphire'))
