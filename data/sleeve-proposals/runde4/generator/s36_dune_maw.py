# -*- coding: utf-8 -*-
"""36 Dune Maw – ein riesiger Sandwurm bricht bei Abendrot aus seinem Sandtrichter, vorne flieht der
Forscher Iman mit hochgerissenen Armen auf uns zu.

Quellen (MotiveEgypt.xcf):
  Ebene 44 „Ebene #82“  – Sandwurm (Karte mit Wurm im Trichter, Sichtbar #42 [27]: Ebene 44 = 1.0)
  Ebene 47 „Ebene #92“  – Sandtrichter derselben Karte (liegt im Stapel unter dem Wurm; Lage 1:1 übernommen)
  Ebene 23 „Iman“        – Forscher (Sichtbar #46 [19]: 1.0, vollständig, keine weiteren Teile)
Selbst gezeichnet: Abendhimmel, Sonne, Dünenkämme, Sandboden mit Rippeln, fliegende Sandbrocken, Schatten.

Skalierung: EIN Raster 4× (63×88 Zellen) für alles – Himmel, Dünen, Boden, Trichter, Wurm, Iman,
Sandspritzer und Schatten; einmal hochskaliert.
"""
import sys, os, math
from common import *  # noqa  (Runde-4-common zuerst laden)
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'runde3', 'generator'))
from a_util import put, sgrad, lowres, blow  # noqa

B = 'MotiveEgypt'
G = 4
lo = lowres(G)                      # 63×88
W, H = lo.w, lo.h

# --- Bauteile -------------------------------------------------------------------------------
pitworm = sprite('h36_pitworm', B, [44, 47])     # Wurm über Trichter, Originallage
worm = sprite('h36_worm', B, [44])
iman = sprite('h36_iman', B, [23])
# Lage des Wurms im Verbund: Wurm-bbox (398,17) / Trichter-bbox (394,28) → Verbund-Ursprung (394,17)
WX, WY = 398 - 394, 0

# --- Himmel (Bänder, je Rasterzeile eine Farbe) ---------------------------------------------
HOR = 33                                          # Horizont (Rasterzeile)
sgrad(lo, 0, HOR, [(52, 34, 78), (120, 56, 88), (212, 104, 74), (246, 168, 92), (252, 214, 140)])
# Sonne tief am Horizont rechts, halb hinter den Dünen (links steht der Wurmkopf)
SX, SY, SR = 51, HOR - 4, 6
for y in range(SY - SR - 3, SY + SR + 4):
    for x in range(SX - SR - 3, SX + SR + 4):
        d = math.hypot(x + .5 - SX, y + .5 - SY)
        if d < SR: lo.px(x, y, (255, 238, 184))
        elif d < SR + 1.4: lo.px(x, y, (253, 214, 140))

# ferne Dünenkämme (zwei Lagen, selbst gezeichnet)
def ridge(y0, amp, per, ph, col, col_lit):
    for x in range(W):
        t = y0 - amp * (0.5 + 0.5 * math.sin((x + ph) / per * 2 * math.pi)) \
            - amp * 0.35 * (0.5 + 0.5 * math.sin((x * 2.3 + ph) / per * 2 * math.pi))
        top = int(round(t))
        for y in range(top, HOR + 1):
            lo.px(x, y, col)
        lo.px(x, top, col_lit)

ridge(HOR - 1, 4.0, 40, 11, (150, 88, 70), (196, 118, 82))
ridge(HOR + 1, 2.5, 27, 3, (170, 112, 72), (214, 150, 92))

# Sandboden: Grundfarbe + Rippellinien, nach vorne weiter auseinander
SAND, RIP, LIT = (208, 174, 104), (186, 150, 82), (226, 196, 128)
for y in range(HOR + 1, H):
    for x in range(W):
        lo.px(x, y, SAND)
yy, k = HOR + 3, 0
while yy < H:
    for x in range(W):
        w = 0.5 + 0.5 * math.sin((x + 7 * k) / (6 + k) * 2 * math.pi)
        dy = int(round(w * 1.0))
        if (x + 3 * k) % (9 + k) < 6 + k // 2:
            lo.px(x, yy + dy, RIP)
            lo.px(x, yy + dy - 1, LIT)
    k += 1
    yy += 3 + k
# warmer Abendschein auf dem Boden unter der Sonne
for y in range(HOR + 1, HOR + 10):
    for x in range(W):
        if abs(x - SX) < 14 - (y - HOR) and (x + y) % 2 == 0:
            lo.px(x, y, (214, 168, 96))

# --- Trichter + Wurm ------------------------------------------------------------------------------
PX = (W - worm.shape[1]) // 2 - WX - 4            # Wurm etwas links: Kopf über Iman, Leib rechts
PY = 20
lo.paste(pitworm, PX, PY)
wmask = np.zeros((H, W), bool)
wm = worm[..., 3] > 0
wmask[PY + WY:PY + WY + wm.shape[0], PX + WX:PX + WX + wm.shape[1]] = wm[:H - PY - WY, :W - PX - WX]

# Sandbrocken, die beim Ausbruch hochgeschleudert werden (selbst gezeichnet, Sandfarben)
rng = np.random.RandomState(36)
hx, hy = PX + WX + 30, PY + 44                    # Austrittsstelle am Trichterloch
for i in range(34):
    a = math.radians(rng.uniform(200, 340))
    r = rng.uniform(6, 26)
    x = int(round(hx + r * math.cos(a) * 1.3)); y = int(round(hy + r * math.sin(a) * 0.9))
    if not (0 <= x < W and 0 <= y < H) or wmask[y, x]: continue
    c = [(204, 170, 98), (182, 146, 76), (136, 108, 45)][i % 3]
    lo.px(x, y, c)
    if i % 4 == 0: lo.px(x + 1, y, (94, 72, 35))

# --- Iman vorne links --------------------------------------------------------------------------------
IX, IY = 7, H - 7                                    # Fußlinie (vorne links, unter dem Wurmkopf)
# Schatten (Sonne hinten rechts → nach vorne links)
for x in range(max(0, IX - 5), min(W, IX + iman.shape[1] + 1)):
    for y in (IY - 1, IY):
        if (x + y) % 2 == 0 or (IX - 3 < x < IX + iman.shape[1] - 3 and y == IY - 1):
            c = lo.a[y, x].astype(float) * 0.62
            lo.px(x, y, tuple(int(v) for v in c))
lo.paste(iman, IX, IY - iman.shape[0])

cv = Canvas(250, 350)
blow(cv, lo, G)
print(save(cv, '36_dune_maw.png'))
