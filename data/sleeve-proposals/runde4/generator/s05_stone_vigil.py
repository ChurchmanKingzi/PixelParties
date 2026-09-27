# -*- coding: utf-8 -*-
"""05 Stone Vigil – Nachts auf dem Friedhofsplatz: drei steinerne Engelsstatuen halten Wache, mit Abstand vor
der mittleren kniet eine Betende, und hoch über der Statue schwebt die Undead Guardian Angel als Erscheinung
vor dem Vollmond. Dahinter ein Hügel mit Grabsteinen, Kreuzen und kahlen Bäumen im Nebel.

Quellen (Motive.xcf):
  Ebene 729 „Undead Guardian Angel“ + Ebene 730 „Ebene #396“ (Totenschädel-Gesicht) (Karte „Undead Guardian
  Angel“, Szene „Sichtbar #61“; Abweichungen nur durch das Kartenfenster unten) – 3×. Die Gruppe wird zerlegt:
  Engelsstatue (3× verwendet, Mitte weiter hinten), Betende (ohne die violette Glüh-Umrandung), Untote
  Engelin (nur der unverdeckte Oberkörper, schwebend, unten gedithert ausgeblendet).
  Szene 728 „Sichtbar #61“: Pflaster-Kachel 16×16 (x 298–314, y 236–252) (nachtblau abgedunkelt) – 3×
  Ebene 770 „Ebene #368“ (Grabsteine, Kreuze) und Ebene 224 „Fighting #7“ (kahle Bäume) – 2×, als
  Silhouetten im Hintergrund
Selbst gezeichnet: Nachthimmel, Sterne, Mond, Hügel, Nebel (2×-Raster 125×175); Schatten (3×).
Skalierung: Hintergrund 2×; Vordergrund (Gruppe + Pflaster) 3×.
"""
import math, random
import numpy as np
from common import *  # noqa

W, H = 250, 350
rnd = random.Random(5)

# ======================= Hintergrund (2×) =======================
GW, GH = 125, 175
bg = Canvas(GW, GH)
SKY = [(10, 10, 30), (18, 18, 46), (28, 26, 62), (44, 38, 80)]
for y in range(GH):
    t = min(1, y / 130)
    for x in range(GW):
        v = t * 3 + BAYER4[y % 4, x % 4] * 0.999
        bg.a[y, x] = SKY[min(3, int(v))]
# Mond hinter dem Heiligenschein
MX, MY, MR = 62.5, 55.0, 30
for y in range(GH):
    for x in range(GW):
        d = math.hypot(x + .5 - MX, y + .5 - MY)
        if d < MR:
            c = (236, 232, 208)
            if d > MR - 1.5 and (x + .5 < MX + 4): c = (208, 204, 186)
            bg.a[y, x] = c
        elif d < MR + 9:
            t = 1 - (d - MR) / 9
            if t * 1.2 > BAYER4[y % 4, x % 4] + 0.45: bg.a[y, x] = (70, 64, 104)
            elif t * 1.2 > BAYER4[y % 4, x % 4]: bg.a[y, x] = (48, 44, 84)
# Krater (dezent)
for (cx, cy, r) in [(50, 39, 4), (71, 45, 5), (57, 63, 3), (76, 33, 2.5), (45, 55, 2.5), (68, 71, 2)]:
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            if math.hypot(x + .5 - cx, y + .5 - cy) < r: bg.a[y, x] = (214, 210, 190)
    for x in range(int(cx - r + 1), int(cx + r)):
        y = int(cy + r - 1)
        if math.hypot(x + .5 - cx, y + .5 - cy) < r: bg.a[y, x] = (244, 242, 226)
# Sterne
for _ in range(38):
    x, y = rnd.randrange(GW), rnd.randrange(0, 92)
    if math.hypot(x - MX, y - MY) > MR + 12:
        bg.a[y, x] = (200, 200, 240) if rnd.random() < 0.7 else (150, 150, 200)
# Hügel
HILL = (22, 22, 44); HILL2 = (30, 30, 56)
def hill_top(x):
    return 101 - 8 * math.exp(-((x - 28) / 22.0) ** 2) - 6 * math.exp(-((x - 100) / 20.0) ** 2) + 1.5 * math.sin(x / 4.0)
for x in range(GW):
    t = int(hill_top(x))
    for y in range(t, GH): bg.a[y, x] = HILL
    bg.a[t, x] = HILL2
# Silhouetten: Grabsteine, Kreuze, kahle Bäume (2×)
def sil(s, col=(16, 16, 34), rim=(40, 40, 70)):
    out = s.copy(); out[..., :3] = col
    m = s[..., 3] > 0
    top = m & ~np.vstack([np.zeros((1, m.shape[1]), bool), m[:-1]])
    out[top, :3] = rim
    return out
graves = [p for p in parts(sprite('a05_graves', 'Motive', [770]), dil=1) if p.shape[0] > 8]
stones = [p for p in graves if p.shape[1] == 16]; crosses = [p for p in graves if p.shape[1] == 12]
trees = [p for p in parts(sprite('a05_trees', 'Motive', [224]), dil=0, minpx=30) if p.shape[1] < 20]   # zwei einzelne Bäume
trees.sort(key=lambda p: -p.shape[0])
def on_hill(s, x, sink=2):
    h, w = s.shape[:2]
    y = int(hill_top(x + w // 2)) - h + sink
    bg.paste(sil(s), x, y)
on_hill(trees[0], 10, 3)
on_hill(flip(trees[0]), 98, 3)
for (gx, s_) in [(30, stones[0]), (80, stones[1]), (44, crosses[0]), (100, crosses[1])]:
    on_hill(s_, gx, 3)
# Nebelband über dem Hügelfuß
for y in range(96, 122):
    for x in range(GW):
        if bg.a[y, x].tolist() in (list(HILL), list(HILL2)) or y > 110:
            t = 1 - abs(y - 110) / 11.0
            if t > 0 and t * 0.8 > BAYER4[y % 4, x % 4]:
                bg.a[y, x] = (52, 52, 86)

vignette(bg, 0.5, 0.6)          # Vignette im 2×-Raster des Hintergrunds
cv = Canvas(W, H)
cv.a[:] = up(np.dstack([bg.a, np.full((GH, GW), 255, np.uint8)]), 2)[:, :, :3]

# ======================= Vordergrund (3×) =======================
K = 3
FW, FH = 84, 117
fg = np.zeros((FH, FW, 4), np.uint8)
scene = layer('Motive', 728)
tile = scene[236:252, 298:314, :3].astype(float)
tile = (tile * np.array([0.52, 0.52, 0.66])).clip(0, 255).astype(np.uint8)
PLAZA = 78
for y in range(PLAZA, FH):
    for x in range(FW):
        fg[y, x, :3] = tile[(y - PLAZA) % 16, x % 16]; fg[y, x, 3] = 255
for x in range(FW):
    fg[PLAZA, x, :3] = (74, 70, 96); fg[PLAZA + 1, x, :3] = (30, 28, 44)
# Figuren aus der Gruppe lösen: zwei Statuen (links/rechts), Mittelstapel = Untote Engelin + Kopf der
# Mittelstatue + Betende. Mittelstatue = Kopie der (vollständigen) Seitenstatue; Betende ohne violette
# Glüh-Umrandung (Ebenen-Effekt); Engelin nur bis zu der Zeile, an der die Statue sie verdeckt.
P = parts(sprite('a05_group', 'Motive', [729, 730]), dil=0)
stack = max(P, key=lambda p: p.shape[0])
statue = P[0]
angel = stack[:22].copy()
woman = stack[36:].copy()
r_, g_, b_ = [woman[..., i].astype(int) for i in range(3)]
purple = ((r_ == 45) & (g_ == 0) & (b_ == 105)) | ((r_ >= 43) & (r_ <= 79) & (g_ >= 24) & (g_ <= 44) & (b_ >= 90) & (b_ <= 166))
woman[purple] = 0
woman = woman[:, :][np.any(woman[..., 3] > 0, 1)]
woman = woman[:, np.any(woman[..., 3] > 0, 0)]
sh, sw = statue.shape[:2]
def shadow(cx, cy, rx, ry):
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if 0 <= x < FW and 0 <= y < FH and ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 < 1 \
                    and 0.7 > BAYER4[y % 4, x % 4]:
                fg[y, x, :3] = (fg[y, x, :3] * 0.4).astype(np.uint8)
def put(spr, x, y, t=0.12):
    s2 = tint(spr, (40, 40, 90), t)
    m = s2[..., 3] > 0
    fg[y:y + spr.shape[0], x:x + spr.shape[1]][m] = s2[m]
# Mittelstatue weiter hinten (höher), Seitenstatuen weiter vorn: Dreieck in die Tiefe
CB, SB = 84, 96
shadow(42, CB, 10, 1.8); put(statue, 42 - sw // 2, CB - sh)
shadow(16, SB, 10, 2.0); put(statue, 16 - sw // 2, SB - sh)
shadow(68, SB, 10, 2.0); put(statue, 68 - sw // 2, SB - sh)
# Betende kniet mit Abstand vor der Mittelstatue
wh, ww = woman.shape[:2]
WB = 106
shadow(42, WB, 8, 1.6); put(woman, 42 - ww // 2, WB - wh, 0.08)
# Untote Engelin schwebt über der Mittelstatue vor dem Mond, der Unterleib verblasst (geordnet gedithert)
ah, aw = angel.shape[:2]
AX, AY = 42 - aw // 2, 24
for j in range(ah):
    for i in range(aw):
        if not angel[j, i, 3]: continue
        X, Y = AX + i, AY + j
        t = 1.0 if j < ah - 8 else 1 - (j - (ah - 8) + 1) / 9.0
        if t > BAYER4[Y % 4, X % 4]:
            fg[Y, X, :3] = angel[j, i, :3]; fg[Y, X, 3] = 255
big = up(fg, K)[1:351, 1:251]
cv.paste(big, 0, 0)

print(save(cv, '05_stone_vigil.png'))
