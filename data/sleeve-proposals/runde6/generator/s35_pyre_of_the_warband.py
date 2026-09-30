# -*- coding: utf-8 -*-
"""35 Pyre of the Warband – Gegner „Sacrificial Demons“ (sample-Structure Deck Sacrificial Demons), Held: Calamitusk,
the Chaorc War Chief (Base).

Idee: Nacht im Krater des Chaorc-Lagers (ORKLAGER seiner Kartenszene). Vorn steht Calamitusk groß mit seinem
Kriegsbanner mit dem Flammenauge; hinter ihm lodert das große Opferfeuer des Lagers (Pyre Grill Master). Am Feuer
wartet links ein rot vermummter Chaorc, rechts steht Asriel, the Sapling Sacrificer (Cover-Karte des Decks) mit
seinem blutigen Opfermesser – Opfer bringen, damit neue Chaorcs und Dämonen kommen. Vorn wie auf der Heldenkarte die
brennende Kiste und der Geldsack, rechts ein Kistenstapel des Lagers.

Quellen:
  MotiveHawaii.xcf Ebene 137 „Calamitustk-Kopie“ + 133 „Ebene #53“ (Banner) – Base-Calamitusk, geprüft gegen Szene
                   132 „Sichtbar #17“ (Kartenbild, Lage 136,105; Banner-Querstange im Kartenbild vom Kartenrand
                   verdeckt, Figur sonst pixelgleich). 138 „Calamitustk“ weicht in 152 px ab (nicht verwendet).
                   Ebene 123 (Flammen) + 130 (Scheitholz-Kreuz, rechter Teil) – großes Lagerfeuer der Pyre-Grill-Karte.
                   Ebene 129 „Ebene #60“ – rot vermummter Chaorc. Ebene 139 (Feuer) + 141 „ORKLAGER“ (Kiste, Geldsack,
                   Kistenstapel) – wie auf der Heldenkarte.
                   Ebene 269 „Ebene #4“ – Kachel Lagerboden (16×16) und Kraterhang (16×16).
  MotiveGrailWar.xcf Ebene 156 „Asriel“ – Asriel mit blutigem Messer (Szene 151, Karte Asriel, Lage 256,81).
Selbst gezeichnet: Nachthimmel mit Feuerschein, Kraterrand-Kante, Lichtschein, Bodenschatten.

Skalierung (Tiefenebenen):
  Hintergrund: Himmel, Kraterhang, Boden, Feuer, Chaorc, Asriel, Kisten     – 2× (125×175)
  Mittelgrund: brennende Kiste, Geldsack                                    – 3× (84×117)
  Vordergrund: Calamitusk mit Banner                                       – 4× (63×88); 152×208 px
"""
import math, random
import numpy as np
from kit_f import *  # noqa

H = 'MotiveHawaii'
rnd = random.Random(35)

cala = sprite('o35_calamitusk', H, [133, 137])                   # 38×52
def _pyre():
    logs = layer(H, 130).copy(); logs[:, :150] = 0                # nur das Scheitholz-Kreuz unter dem Feuer
    a = xcfkit.over(logs, layer(H, 123))                           # Flammen (123) liegen über dem Holz (130)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    return trim(a)


pyre = cached('o35_pyre', _pyre)                                   # 50×42
chaorc = sprite('o35_chaorc', H, [129])
asriel = sprite('o35_asriel', 'MotiveGrailWar', [156])
bag = cached('o35_bag', lambda: parts(layer(H, 141), dil=1)[5])
def _burning():
    a = compose(H, [139, 141], box=(128, 106, 160, 146))
    return part_at(a, a.shape[1] // 2, a.shape[0] - 2, dil=0)       # nur die brennende Kiste der Heldenkarte


burning = cached('o35_burning_crate', _burning)
dirt = cached('o35_dirt', lambda: layer(H, 269)[60:76, 120:136].copy())
slope = cached('o35_slope', lambda: layer(H, 269)[160:176, 66:82].copy())

# ---------------- Hintergrund 2× (125×175) -------------------------------------------------------------------
bw, bh = grid(2)
bg = rgba(bw, bh, (0, 0, 0))
RIM = 30                                                         # Oberkante Kraterhang (2×) → y 60
FLOOR = 50                                                       # Beginn Kraterboden → y 100
bands(bg, 0, RIM + 4, [(10, 6, 14), (22, 10, 20), (46, 16, 22), (84, 28, 24)], soft=0.5)
for _ in range(16):
    x, y = rnd.randrange(3, bw - 3), rnd.randrange(3, 26)
    bg[y, x, :3] = (170, 150, 170) if rnd.random() < .4 else (100, 80, 110)
for y in range(bh):
    for x in range(bw):
        rim = RIM + 3 * math.sin(x / 9.0) + 2 * math.sin(x / 4.0 + 1)
        if y >= FLOOR:
            c = dirt[y % 16, x % 16, :3].astype(float)
            t = (y - FLOOR) / (bh - FLOOR)
            c = c * (0.34 + 0.3 * t)
            bg[y, x, :3] = c.clip(0, 255).astype(np.uint8)
        elif y >= rim:
            c = slope[y % 16, x % 16, :3].astype(float)
            t = (y - rim) / (FLOOR - rim)
            c = c * (0.3 + 0.12 * t)
            if y - rim < 1: c = c * 1.5
            bg[y, x, :3] = c.clip(0, 255).astype(np.uint8)
for x in range(bw):                                              # Hangfuß
    bg[FLOOR, x, :3] = (bg[FLOOR, x, :3] * 0.6).astype(np.uint8)
# Feuerschein
PX, PB = 62, 64                                                  # Feuer-Mitte (Spalte), Fußzeile (2×) → y 128
glow(bg, PX, PB - 18, 60, (255, 120, 40), 0.5, ry=46)
glow(bg, PX, PB + 4, 52, (255, 150, 60), 0.35, ry=30)
shade_ellipse(bg, PX, PB - 1, 26, 2.2, 0.55)
put(bg, pyre, PX - pyre.shape[1] // 2, PB - pyre.shape[0])
# Kistenstapel des Lagers rechts auf halber Tiefe
crate = cached('o35_crate', lambda: parts(layer(H, 141), dil=1)[4])
crD = mul(crate, (0.62, 0.52, 0.46), (14, 4, 0))
shade_ellipse(bg, 98, 110, 15, 1.8, 0.5)
put(bg, crD, 84, 110 - 16)
put(bg, crD, 98, 110 - 16)
put(bg, crD, 91, 110 - 32)
# Chaorc links, Asriel rechts am Feuer
for s, cx in ((chaorc, 26), (asriel, 99)):
    shade_ellipse(bg, cx, PB - 1, s.shape[1] / 2 + 1, 1.5, 0.5)
    lit = mul(s, (1.12, 1.0, 0.9), (18, 6, 0))
    put(bg, lit, cx - s.shape[1] // 2, PB - s.shape[0])

# ---------------- Mittelgrund 3× (84×117): brennende Kiste, Geldsack ------------------------------------------
mw, mh = grid(3)
mg = rgba(mw, mh)
MF = 108                                                          # Fußlinie → y 324
bx = mw - 9 - burning.shape[1]
shade_ellipse(mg, bx + burning.shape[1] / 2, MF, 10, 1.5, 0.5)
for sx0, s in ((bx, burning), (9, bag)):
    for y in range(MF - 2, MF + 2):
        for x in range(sx0 - 1, sx0 + s.shape[1] + 1):
            d = ((x + .5 - sx0 - s.shape[1] / 2) / (s.shape[1] / 2 + 1)) ** 2 + ((y + .5 - MF + 0.5) / 1.6) ** 2
            if d < 1: mg[y, x] = (0, 0, 0, 110)
put(mg, burning, bx, MF - burning.shape[0])
put(mg, mul(bag, (0.8, 0.72, 0.66)), 9, MF - bag.shape[0])

# ---------------- Vordergrund 4× (63×88): Calamitusk -------------------------------------------------------------
fw, fh = grid(4)
fg = rgba(fw, fh)
CF = 82                                                           # Füße → y 328
CX = 4
for y in range(CF - 1, CF + 1):                                   # Bodenschatten (4×)
    for x in range(CX + 14, CX + 40):
        d = ((x + .5 - CX - 27) / 13) ** 2 + ((y + .5 - CF + 0.5) / 1.2) ** 2
        if d < 1: fg[y, x] = (0, 0, 0, 120)
cl = mul(cala, (1.08, 1.0, 0.95), (10, 4, 0))                    # leichter Feuerschein von hinten
put(fg, cl, CX, CF - cala.shape[0])

st = Stack()
st.add(bg, 2)
st.add(mg, 3)
st.add(fg, 4, ox=2)
save(st.canvas(), '35_pyre_of_the_warband.png')
if __name__ == '__main__':
    print(preview('35_pyre_of_the_warband.png', 'industrial', 'iron', 'lava', 'onyx'))
