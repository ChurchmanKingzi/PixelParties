# -*- coding: utf-8 -*-
"""35 Pyre of the Warband – Gegner „Sacrificial Demons“ (sample-Structure Deck Sacrificial Demons), Held: Calamitusk,
the Chaorc War Chief (Base).

Idee: Nacht im Krater des Chaorc-Lagers (ORKLAGER seiner Kartenszene). Ganz vorn steht Calamitusk groß und vom
Feuer hinter ihm rot umrandet; direkt hinter ihm ist sein Kriegsbanner mit dem Flammenauge in den Boden gerammt
(auf der Heldenkarte hält er es – hier steht es hinter ihm, damit er selbst das Hauptmotiv bleibt). Weit hinten im
Krater lodert das große Opferfeuer (Pyre Grill Master), links davon ein rot vermummter Chaorc, rechts Asriel, the
Sapling Sacrificer (Cover-Karte) mit blutigem Opfermesser – alle mit Bodenschatten im Feuerschein. Opfer bringen,
damit neue Chaorcs kommen.

Quellen:
  MotiveHawaii.xcf Ebene 137 „Calamitustk-Kopie“ – Base-Calamitusk, geprüft gegen Szene 132 „Sichtbar #17“
                   (Kartenbild, Lage 136,105; 11 px Abweichung nur am Bannerstab, der dort vor seiner Hand liegt);
                   138 „Calamitustk“ weicht in 152 px ab (nicht verwendet). Ebene 133 „Ebene #53“ – sein Banner
                   (Querstange im Kartenbild vom Kartenrand verdeckt), hier einzeln hinter ihm aufgepflanzt.
                   Ebene 123 (Flammen) + 130 (Scheitholz-Kreuz, rechter Teil) – Lagerfeuer der Pyre-Grill-Karte.
                   Ebene 129 „Ebene #60“ – rot vermummter Chaorc. Ebene 269 „Ebene #4“ – Kachel Lagerboden (16×16)
                   und Kraterhang (16×16).
  MotiveGrailWar.xcf Ebene 156 „Asriel“ – Asriel mit blutigem Messer (Szene 151, Karte Asriel, Lage 256,81).
Selbst gezeichnet: Nachthimmel mit Feuerschein, Kraterrand-Kante, Lichtschein, Bodenschatten, roter Lichtsaum
(Oberkanten-Pixel von Calamitusk im 6×-Raster aufgehellt/getönt).

Skalierung (Tiefenebenen):
  Hintergrund: Himmel, Kraterhang, Boden, Feuer, Chaorc, Asriel, Schatten   – 2× (125×175)
  Mittelgrund: Banner mit Stab und Schatten                                – 3× (84×117); 108×129 px
  Vordergrund: Calamitusk + Bodenschatten                                  – 6× (42×59); 132×126 px
"""
import math, random
import numpy as np
from kit_f import *  # noqa

H = 'MotiveHawaii'
rnd = random.Random(35)

cala = sprite('o35_calamitusk_body', H, [137])                 # 22×21
banner = sprite('o35_banner', H, [133])                          # 36×43
def _pyre():
    logs = layer(H, 130).copy(); logs[:, :150] = 0                # nur das Scheitholz-Kreuz unter dem Feuer
    a = xcfkit.over(logs, layer(H, 123))                           # Flammen (123) liegen über dem Holz (130)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    return trim(a)


pyre = cached('o35_pyre', _pyre)                                   # 50×42
chaorc = sprite('o35_chaorc', H, [129])
asriel = sprite('o35_asriel', 'MotiveGrailWar', [156])
dirt = cached('o35_dirt', lambda: layer(H, 269)[60:76, 120:136].copy())
slope = cached('o35_slope', lambda: layer(H, 269)[160:176, 66:82].copy())

# ---------------- Hintergrund 2× (125×175) -------------------------------------------------------------------
bw, bh = grid(2)
bg = rgba(bw, bh, (0, 0, 0))
RIM = 22                                                         # Oberkante Kraterhang (2×) → y 44
FLOOR = 38                                                       # Beginn Kraterboden → y 76
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
            c = c * (0.3 + 0.36 * t)
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
PX, PB = 62, 63                                                  # Feuer-Mitte (Spalte), Fußzeile (2×) → y 126
glow(bg, PX, PB - 18, 62, (255, 120, 40), 0.5, ry=44)
glow(bg, PX, PB + 6, 58, (255, 150, 60), 0.38, ry=34)
glow(bg, 62.5, 150, 46, (200, 90, 40), 0.3, ry=22)              # Feuerlicht auf dem Boden um Calamitusk
shade_ellipse(bg, PX, PB - 0.5, 24, 2.4, 0.5)
put(bg, pyre, PX - pyre.shape[1] // 2, PB - pyre.shape[0])
# Chaorc links, Asriel rechts am Feuer, mit Schatten vom Feuer weg
for s_, cx, dx in ((chaorc, 28, -3), (asriel, 97, 3)):
    shade_ellipse(bg, cx + dx, PB - 0.5, s_.shape[1] / 2 + 3, 1.6, 0.45)
    lit = mul(s_, (1.12, 1.0, 0.9), (18, 6, 0))
    put(bg, lit, cx - s_.shape[1] // 2, PB - s_.shape[0])

# ---------------- Mittelgrund 3× (84×117): aufgepflanztes Banner -------------------------------------------------
mw, mh = grid(3)
mg = rgba(mw, mh)
BB = 84                                                           # Stabfuß (3×) → y 252, hinter Calamitusk
bx = (mw - banner.shape[1]) // 2 + 3
for y in range(BB - 1, BB + 2):                                   # Schatten am Stabfuß
    for x in range(bx + 2, bx + 14):
        d = ((x + .5 - bx - 7.5) / 6) ** 2 + ((y + .5 - BB) / 1.3) ** 2
        if d < 1: mg[y, x] = (0, 0, 0, 110)
put(mg, mul(banner, (0.92, 0.88, 0.86)), bx, BB - banner.shape[0] + 1)

# ---------------- Vordergrund 6× (42×59): Calamitusk -------------------------------------------------------------
fw, fh = grid(6)
fg = rgba(fw, fh)
CF = 55                                                           # Füße → y 330
CX = (fw - cala.shape[1]) // 2
for y in range(CF - 1, CF + 1):                                   # Bodenschatten (6×), nach vorn geworfen
    for x in range(CX - 2, CX + cala.shape[1] + 3):
        d = ((x + .5 - CX - cala.shape[1] / 2) / (cala.shape[1] / 2 + 3)) ** 2 + ((y + .5 - CF + 0.3) / 1.2) ** 2
        if d < 1: fg[y, x] = (0, 0, 0, 120)
cl = mul(cala, (1.3, 1.18, 1.12), (14, 6, 0))                     # im Feuerschein etwas aufgehellt
m = cl[..., 3] > 0
rim = m.copy(); rim[1:] &= ~m[:-1]; rim[0] = m[0]                 # Oberkanten-Pixel: roter Lichtsaum vom Feuer
rimx = m.copy(); rimx[:, :-1] &= ~m[:, 1:]                        # rechte Außenkante
for yy, xx in zip(*np.where(rim | rimx)):
    cl[yy, xx, :3] = (cl[yy, xx, :3] * 0.45 + np.array([230, 96, 40]) * 0.55).astype(np.uint8)
put(fg, cl, CX, CF - cala.shape[0])

st = Stack()
st.add(bg, 2)
st.add(mg, 3)
st.add(fg, 6, ox=-1)
save(st.canvas(), '35_pyre_of_the_warband.png')
if __name__ == '__main__':
    print(preview('35_pyre_of_the_warband.png', 'industrial', 'iron', 'lava', 'onyx'))
