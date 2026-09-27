# -*- coding: utf-8 -*-
"""37 Holy Cow – Ikonenbild: die heilige Kuh mit Heiligenschein steht auf einer Grashügelkuppe vor der
aufgehenden Sonne auf einem kleinen Sandstein-Sockel (Schrein), deren Strahlen sich hinter ihr auffächern; zwei
Verehrer knien als Paar links und rechts vor dem Sockel, beide der Kuh zugewandt (wie Akolythen).

Quellen (MotiveDeri.xcf, Karte „Sacred Cattle“, Szene Sichtbar #71 [52]):
  Ebene 176 „Sacred Cattle“     – Kuh mit Heiligenschein (1.0 in der Szene, vollständig)
  Ebene 174 „Sacred Cattle #3“  – zwei betende Männer übereinander; verwendet wird der untere, vollständige
                                   (beim oberen verdeckt der untere Beine/Knie).
  Ebene 175 (Fragezeichen) bewusst weggelassen (kein Text/Symbol).
  Der Betende blickt im Original nach links: links gespiegelt, rechts original → beide schauen zur Kuh.
  MotiveEgypt.xcf Ebene 166 „Ebene #122“ – Sandsteinkachel, zum Sockel 18×8 gekachelt (Umriss/Deckkante ergänzt).
Selbst gezeichnet: Morgenhimmel, Sonnenscheibe, Strahlenkranz, Hügel mit Grasbüscheln, Schatten.

Skalierung: EIN Raster 5× (50×70 Zellen) für alles (Himmel, Strahlen, Hügel, Sockel, Kuh, Verehrer, Schatten).
"""
import sys, os, math
from common import *  # noqa  (Runde-4-common zuerst laden)
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'runde3', 'generator'))
from a_util import sgrad, lowres, blow  # noqa

B = 'MotiveDeri'
G = 5
lo = lowres(G)                      # 50×70
W, H = lo.w, lo.h

cow = sprite('h37_cow', B, [176])
men = sprite('h37_men', B, [174])
# unterer, vollständiger Mann: die zweite Figur beginnt in Zeile 18 (Zeilen 18–35, geprüft per ASCII-Abzug)
man = [kit.trim(men[18:].copy())]

# --- Himmel ------------------------------------------------------------------------------------
sgrad(lo, 0, 62, [(58, 70, 132), (122, 104, 160), (226, 138, 138), (250, 190, 132), (255, 226, 160)])
CX, CY = 25, 28                                     # Mittelpunkt von Sonne/Strahlen (hinter dem Kuhkopf)
# Strahlenkranz: abwechselnd aufgehellte Keile
for y in range(0, 56):
    for x in range(W):
        a = math.atan2(y + .5 - CY, x + .5 - CX)
        k = int(math.floor((a + math.pi) / (2 * math.pi) * 24))
        d = math.hypot(x + .5 - CX, y + .5 - CY)
        if k % 2 == 0 and d > 9:
            c = lo.a[y, x].astype(float)
            t = 0.28 if d < 26 else 0.16
            lo.a[y, x] = (c * (1 - t) + np.array([255, 240, 190]) * t).astype(np.uint8)
# Sonnenscheibe
for y in range(CY - 11, CY + 12):
    for x in range(CX - 11, CX + 12):
        d = math.hypot(x + .5 - CX, y + .5 - CY)
        if d < 8.5: lo.px(x, y, (255, 184, 112) if d > 6.5 else (255, 204, 128))
        elif d < 10: lo.px(x, y, (250, 160, 110))

# ferne Hügelkette
for x in range(W):
    top = int(round(53 - 2.2 * (0.5 + 0.5 * math.sin(x / 9.0 + 1.2)) - 1.4 * (0.5 + 0.5 * math.sin(x / 4.1))))
    for y in range(top, 56): lo.px(x, y, (104, 128, 96))
    lo.px(x, top, (138, 156, 110))

# --- Vordergrund-Hügel (Kuppe unter der Kuh) ---------------------------------------------------
G1, G2, G3 = (86, 150, 62), (64, 122, 50), (44, 94, 42)
for x in range(W):
    dx = (x + .5 - CX) / 30.0
    top = int(round(50 + 7 * dx * dx))                  # flache Kuppe
    for y in range(top, H):
        # Rundung: zu den Seiten und nach unten dunkler (Bänder, harte Kanten)
        sh = (y - top) + abs(x + .5 - CX) * 0.35
        lo.px(x, y, G1 if sh < 5 else (G2 if sh < 14 else G3))
    lo.px(x, top, (132, 190, 86))
# Grasbüschel (gespiegelt verteilt)
for bx, by in ((21, 61), (9, 58), (15, 66), (3, 63)):
    for sx in (bx, W - 1 - bx):
        lo.px(sx, by, (132, 190, 86)); lo.px(sx - 1, by + 1, G1); lo.px(sx + 1, by + 1, G1)

# --- Schrein-Sockel: Sandsteinkachel (Egypt Ebene 166, 11×8) auf 18×8 gekachelt, mit Kante/Umriss --------
blk = sprite('h37_block', 'MotiveEgypt', [166])[1:8]          # oberste, lückenhafte Zeile weglassen
PW, PH = 18, 8
ped = np.zeros((PH, PW, 4), np.uint8)
for y in range(PH):
    for x in range(PW):
        ped[y, x] = blk[(y - 1) % blk.shape[0], x % blk.shape[1]] if y > 0 else (236, 214, 176, 255)
ped[..., 3] = 255
ped[:, 0, :3] = ped[:, -1, :3] = (70, 52, 36)                   # Umriss
ped[-1, :, :3] = (70, 52, 36)
ped[1, 1:-1, :3] = (ped[1, 1:-1, :3] * 0.8).astype(np.uint8)     # Schatten unter der Deckkante
GROUND = 56                                         # Standlinie von Sockel und Verehrern
PX0 = CX - PW // 2
for x in range(PX0 - 1, PX0 + PW + 2):              # Schatten des Sockels
    lo.a[GROUND, x] = (lo.a[GROUND, x] * 0.6).astype(np.uint8)
lo.paste(ped, PX0, GROUND - PH)

# --- Kuh auf dem Sockel -----------------------------------------------------------------------------
FY = GROUND - PH + 1                                # Hufe auf der Deckplatte
cx0 = CX - cow.shape[1] // 2
lo.paste(cow, cx0, FY - cow.shape[0])

# --- Verehrer: als Paar links und rechts vor dem Sockel, beide der Kuh zugewandt -------------------
# Der Betende blickt im Original (Kopf in Dreiviertelansicht) nach links → links gespiegelt, rechts original.
m = man[0]
for x0, spr in ((PX0 - m.shape[1] + 3, flip(m)), (PX0 + PW - 3, m)):
    for x in range(x0 + 1, x0 + spr.shape[1] - 1):
        lo.a[GROUND, x] = (lo.a[GROUND, x] * 0.6).astype(np.uint8)
    lo.paste(spr, x0, GROUND - spr.shape[0])

cv = Canvas(250, 350)
blow(cv, lo, G)
print(save(cv, '37_holy_cow.png'))
