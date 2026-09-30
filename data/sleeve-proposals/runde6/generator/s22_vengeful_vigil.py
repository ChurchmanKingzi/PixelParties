# -*- coding: utf-8 -*-
"""22 Vengeful Vigil – Gegner „Guardians of the Treasure Cave“ (sample-Structure Deck Guardians of the
Treasure Cave), Held/Hauptmotiv: Mao, the Vengeful Guardian (Base-Karte).

Idee (Nachtwache nach dem Überfall): Vor dem vergitterten Tor der Schatzhöhle – dahinter glänzt noch der
Goldhaufen – liegen die gefallenen Guardian Beasts in ihrem Blut, genau die Leichen aus der Szene von „Dajan,
Conqueror of the Treasure Cave“ (Zhu, Tu, Hou, Gou, Yang, Long). Vorn sitzt groß Mao, die schwarze Katze mit dem
roten, blutigen Tuch, und blickt uns an: Sie ist die rachsüchtige Wächterin, die übrig blieb (Kartentext:
löscht Karten aus beiden Ablagestapeln, um die Effekte der Guardian Beasts auszulösen). Nacht: nur der warme
Schein vor dem Tor beleuchtet Hof und Tote.

Quellen (MotiveGuardianBeasts.xcf, wenn nicht anders angegeben):
  Ebene 35 „Mao“ = Base-Karte (schwarze Katze; 100 % in Kartenszene Ebene 2 „Sichtbar #37“, Lage 114,115).
           NICHT Ebene 34 „Mao-Kopie“ (graue Variante).
  Ebene 28 „Ascended Dajan #2“ (98 % in Ebene 5 „Sichtbar #35“ = Szene der Dajan-Karte): die toten Guardian
           Beasts mit Blutlachen – Tu (x 114–138, y 32–58), Zhu (96–132, 64–89), Hou (170–192, 42–60),
           Gou (161–180, 58–74), Yang (138–165, 72–102), Long (165–215, 66–95); einzeln ausgeschnitten und in ihrer
           Anordnung aus der Szene, 10 px weiter vorn, vor das Tor gelegt. Nicht verwendet: die lebenden Figuren derselben Ebene (Niu, Shu, Hu) und der
           goldene Krieger.
  Ebene 37 „Ebene #41“ (Wächterhof mit Gittertor; Ausschnitt x 90–215, y 5–180, ohne den FPS-Schriftzug).
  MotiveDeepsea.xcf Ebene 196 „Deepsea Treasure“ (nur der Goldüberlauf unten links, 16×10) hinter dem Gitter.
Selbst gezeichnet: Nachtabdunkelung mit warmem Torschein (geordnetes Dithering), Schatten unter Mao.
Skalierung: Hof, Tor, Gold und die toten Guardian Beasts – 2×-Raster (125×175);
            Mao 27×25 → 135×125 – 5× (Vordergrund, unterhalb aller Toten).
"""
import math
from common import *  # noqa
from dkit19_24 import *  # noqa

BG, BD = 'MotiveGuardianBeasts', 'MotiveDeepsea'

mao = crop_alpha(layer(BG, 35))
mao = part_at(mao, mao.shape[1] // 2 + 3, mao.shape[0] // 2, dil=1)   # ohne den losen Blutstrich
Image.fromarray(mao).save(os.path.join(xcfkit.CACHE, 'o22_mao.png'))
L28 = layer(BG, 28)
BOX = {'tu': (114, 32, 138, 58), 'zhu': (96, 64, 132, 89), 'hou': (170, 42, 192, 60),
       'gou': (161, 58, 180, 74), 'yang': (138, 72, 165, 102), 'long': (165, 66, 215, 95)}
import cv2


def largest(s, dil=2):
    """nur die größte zusammenhängende Figur im Ausschnitt (ohne angeschnittene Nachbarteile)"""
    m = (s[..., 3] > 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(m, np.ones((2 * dil + 1,) * 2, np.uint8)), connectivity=8)
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    out = s.copy(); out[(lab != k)] = 0
    return out


dead = {}
DOFF = {}
for k, (x0, y0, x1, y1) in BOX.items():
    s = largest(L28[y0:y1, x0:x1].copy())
    b = bbox(s)
    dead[k] = s[b[1]:b[3], b[0]:b[2]]
    DOFF[k] = (x0 + b[0], y0 + b[1])
for k, s in dead.items():
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'o22_dead_' + k + '.png'))

# ---------------------------------------------------------------- Hof 2× (125×175)
GW, GH = grid(2)
X0, Y0 = 90, 5
court = layer(BG, 37)[Y0:Y0 + GH, X0:X0 + GW].copy()
court[..., 3] = 255
GX0, GX1, GY0, GY1 = 144 - X0, 160 - X0, 15 - Y0, 48 - Y0      # Gittertor (Raster)
WB = 47 - Y0                                                    # Mauerfuß

# Goldhaufen hinter dem Gitter
tre = crop_alpha(layer(BD, 196))
heap = tre[24:34, 1:17].copy()
hc = heap[..., :3].astype(int)
heap[..., 3] = np.where((heap[..., 3] > 0) & (hc[..., 0] > 140) & (hc[..., 2] < 120), 255, 0)
hh, hw = heap.shape[:2]
inner = np.zeros((GH, GW), bool)
for y in range(GY0, GY1):
    for x in range(GX0, GX1):
        if court[y, x, :3].astype(int).max() < 40:
            inner[y, x] = True
            sy, sx = y - (GY1 - hh), x - GX0
            if 0 <= sy < hh and 0 <= sx < hw and heap[sy, sx, 3] > 0:
                court[y, x, :3] = heap[sy, sx, :3]
            else:
                court[y, x, :3] = (4, 3, 8)

# die Toten vor dem Tor: Anordnung wie in der Dajan-Szene, um 10 Zeilen vom Mauerfuß weg nach vorn gerückt
DY = 10
for k in BOX:
    ox, oy = DOFF[k]
    put(court, dead[k], ox - X0, oy - Y0 + DY)

# Nacht: abdunkeln; warmer Schein vor dem Tor
LX, LY = (GX0 + GX1) / 2, GY1 + 8
for y in range(GH):
    for x in range(GW):
        if inner[y, x]:
            continue
        d = math.hypot((x + .5 - LX) / 62, (y + .5 - LY) / 62)
        t = max(0.0, 1 - d)
        f = 0.22 + 0.62 * dith(t, x, y, 4)
        c = court[y, x, :3].astype(float)
        court[y, x, :3] = (c * f + np.array([16, 8, 30]) * (1 - f)).clip(0, 255).astype(np.uint8)

cv = Canvas(W, H)
blit(cv, court, 2)

# ---------------------------------------------------------------- Mao 5× vorn
FG = rgba(50, 70)
mw, mh = mao.shape[1], mao.shape[0]
mx, my = 11, 63 - mh                     # Kopfmitte (Spalte 14 der Figur) auf x = 125 (375 von 750)
for y in range(70):
    for x in range(50):
        d = ((x + .5 - (mx + mw / 2)) / 12) ** 2 + ((y + .5 - 62.5) / 1.8) ** 2
        if d < 1 and bay(x, y) < 0.7:
            FG[y, x] = (6, 2, 10, 150)
put(FG, mao, mx, my)
cv.paste(up(FG, 5), 0, 0)
print(save(cv, '22_vengeful_vigil.png'))
