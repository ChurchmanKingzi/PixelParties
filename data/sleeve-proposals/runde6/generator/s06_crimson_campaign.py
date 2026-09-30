# -*- coding: utf-8 -*-
"""06 Crimson Campaign – Gegner „Bloody King Zi“, Held: Timeless King Zi (Base-Version).
Feldherr im blutroten Abendlicht: Zi steht groß auf dem verschneiten Schlachtfeld seiner Heimat, hinter ihm hat sich
seine Legion mit roten Helmbüschen und Speeren aufgereiht, flankiert von seinen zwei blau-goldenen Standarten (die
Szepter seiner Kartenszene). Fern am Horizont erhebt sich im Dunst Blood Rock, das Deckcover, vor rot glühendem
Himmel.

Quellen:
  MotiveGrailWar.xcf Ebene 487 „Zi“: Base-Zi mit Sternumhang (26×28), in Sichtbar #169 (Ebene 30, Kartenbild
      „Timeless King Zi“, Lage 227,108) sichtbar (99 %, Kartenszene leicht abgedunkelt).
  MotiveGrailWar.xcf Ebene 485 „Zi #2“: die zwei Szepter/Standarten seiner Kartenszene.
  MotiveGrailWar.xcf Ebene 214 „Legionäre“: Reihe identischer Legionäre (Periode 18 px), einzeln gesetzt.
  MotiveGrailWar.xcf Ebene 476 „Ebene #139“: Schneefläche seiner Kartenszene (als Bodentextur, rot getönt).
  MotiveDeepsea.xcf Ebene 75 „Blood Rock“: das Schloss des Deckcovers, weit hinten im Dunst.
Selbst gezeichnet: Abendhimmel, ferner Bergkamm, Dunst, Schneewellen, Schatten.

Skalierung (Ausgabe = 250×350-Raster × 3):
  Himmel, Bergkamm, Blood Rock (fern, im Dunst)             – 1× (250×350)
  Schneefeld, Legion, Standarten, Schatten                 – 2× (125×175)
  Zi                                                       – 6× (42×59)
"""
import math, random
from a_util import *  # noqa
import numpy as np

B = 'MotiveGrailWar'
zi = sprite('o06_zi', B, [487])                               # Base-Zi mit Sternumhang (26×28), = Sichtbar #169
std = parts(compose(B, [485]), dil=1)[0]                      # „Zi #2“: Standarte (7×36)
legion = compose(B, [214])                                    # „Legionäre“: 5 gleiche Soldaten, Periode 18
soldier = trimmed(legion[:, 0:19].copy())
snow = compose(B, [476], crop=False)[284:309, 143:303]        # Schneefläche (ohne Eisgrate/Kanten)
castle = sprite('o06_bloodrock', 'MotiveDeepsea', [75])       # Blood Rock (189×132)

# ---- Ebene 1: Abendhimmel, Bergkamm, Blood Rock (1×) ----------------------------------------------
cv = Canvas(250, 350)
HOR = 150                                                    # Horizont im 250er-Raster
SKY = [(52, 10, 22), (84, 16, 28), (122, 24, 30), (160, 38, 30), (196, 66, 36), (226, 110, 52), (240, 150, 80)]
for y in range(HOR + 10):
    t = min(1, y / HOR) * (len(SKY) - 1)
    i = min(len(SKY) - 2, int(t)); f = t - i
    for x in range(250):
        cv.a[y, x] = SKY[i + 1] if f > bayer(x, y) else SKY[i]
# Blood Rock weit hinten rechts, im roten Dunst (zur Himmelsfarbe hin gemischt)
cz = castle[:, 58:134].copy()                               # Mittelteil: Bergfried mit Treppengiebel
hz = np.array(SKY[4])
cz[..., :3] = (cz[..., :3] * 0.6 + hz * 0.4).astype(np.uint8)
cv.paste(cz[:84], 156, HOR - 76)
# ferner Bergkamm (selbst gezeichnet, 1×), verdeckt den Schlossfuß
RIDGE = (98, 40, 52)
for x in range(250):
    h = 10 + 6 * math.sin(x * 0.045 + 0.8) + 3 * math.sin(x * 0.13) + (5 if 150 < x < 220 else 0) * math.sin((x - 150) / 70 * math.pi)
    top = int(HOR - h)
    for y in range(top, HOR + 10):
        cv.a[y, x] = RIDGE if y > top else (140, 64, 70)

# ---- Ebene 2: Schneefeld, Legion, Standarten (2×, 125×175) -------------------------------------------
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
# Legion in einer Reihe, Standarten an den Enden
LY = 110                                                     # Fußlinie der Legion (2×-Raster)
xs = [16, 30, 44, 58, 72, 86, 100]
for x in xs:
    put(p2, darken(soldier, 0.82), x, LY - soldier.shape[0])
    shadow_ellipse(p2, x + 9.5, LY, 7, 1.2, col=(60, 10, 30), a=0.35)
put(p2, std, 11, LY - std.shape[0] - 2)
put(p2, std, W2 - 11 - std.shape[1], LY - std.shape[0] - 2)
# Bodenschatten unter Zi (Füße bei 250er-y 310 → 2×-Reihe 155)
shadow_ellipse(p2, 62.5, 155, 20, 3.5, col=(60, 10, 30), a=0.5)
blit(cv, p2, 2)

# ---- Ebene 3: Zi (6×, 42×59) --------------------------------------------------------------------
W6, H6 = 42, 59
p6 = rgba(W6, H6)
ZX, ZY = (W6 - zi.shape[1]) // 2, 52 - zi.shape[0]
put(p6, zi, ZX, ZY)
blit(cv, p6, 6, -1, -2)
print(save(cv, '06_crimson_campaign.png'))
print(preview('06_crimson_campaign.png', 'cosmic', 'ice', 'ruby', 'sapphire'))
