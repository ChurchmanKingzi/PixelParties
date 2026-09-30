# -*- coding: utf-8 -*-
"""40 Smog Drill – Gegner „Spell Industrialization“, Held: Victorica, the Eternal Empress.

Abenddämmerung über der verschmutzten Themse. Victorica (Base: rote Kuppelkrone, blau glühende Augen, violetter
Mantel, Thron-Armlehnen) thront auf der violetten Plattform ihres Mana-Mining-Bohrers (ihre Start-Fähigkeit), der
sich in den Fluss frisst, schwarzen Schlamm aufwirbelt und einen Ölfilm hinterlässt. Hinten links ragt Big Gwen – der
Uhrturm ihrer Heldenkarte – in den Smog, am anderen Ufer spucken goldene Pollution Spewer graue Schwaden, die sich
als Smogbänder über den Himmel legen (Pollution Tokens); die Sonne ist nur noch eine fahle Scheibe.

Quellen (MotiveBritain.xcf):
  Ebene 260 „Victorica“ + 247 „Ebene #7“ (blauer Augen-/Gesichtsschein) – die Base-Figur der Karte „Victorica, the
  Eternal Empress“ (Sichtbar #4 = Ebene 231, Lage 240,199; Kartenbild mit Streifenfilter, Figur deckungsgleich);
  die dunkelroten Blöcke links/rechts unten sind die Armlehnen ihres Throns.
  NICHT 259 „Victorica Skin“ und NICHT 97 „Ebene #116“ (Variante ohne Armlehnen/Augenschein aus Mana Mining).
  Ebenen 95 „Ebene #114“ (Plattform + Bohrer), 96 „Ebene #113“ (aufgewirbelter Schlamm) – Karte „Mana Mining“ (Sichtbar #29 = Ebene 92/93, Lage 352,89). Victorica steht dort als
  Variante 97 hinter der Plattformkante; hier sitzt die Base-Figur 260 mit ihrem Thron AUF der Plattform (gleiche
  Mitte x 390), damit sie ganz zu sehen ist.
  Ebene 270 „Ebene #4“ – Big Gwen (Uhrturm-Oberteil), Karte „The Great Clock Tower "Big Gwen"“.
  Ebene 221 „Pollution Spewer“ – Karte „Pollution Spewer“ (zweimal, einmal gespiegelt).
  Ebene 231 (Szene) – Wasserkachel 16×16 (x448–464/y292–308) und ein Baum (x207–237/y209–242) als Uferbäume.
Selbst gezeichnet: Himmel, Sonne, Smogbänder und Rauchfahnen, Ufermauer, Wasserspiegelungen, Gischtkranz, Ölfilm.

Skalierung (Tiefenebenen):
  Ferne (Himmel, Smog, Sonne, Big Gwen, Ufer, Bäume, Spewer, Rauch) – 1× (250×350)
  Fluss (Wasserfläche, Spiegelungen)                               – 2× (125×175)
  Vordergrund (Victorica 22×35 → 88×140 px, Plattform, Bohrer, Schlamm, Gischt, Ölfilm) – 4× (63×88)
"""
import math, random
import numpy as np
from gkit36_40 import *  # noqa

rnd = random.Random(40)
HOR = 206                                  # Horizont/Uferlinie im 250er-Raster

# ================================================================== Ferne 1× (250×350)
far = Plane(250, 350, 1)
SKY = [(0, (38, 32, 62)), (70, (74, 54, 86)), (140, (140, 92, 98)), (190, (206, 136, 92)), (HOR, (222, 162, 104))]


def sky_col(y):
    for (y0, c0), (y1, c1) in zip(SKY, SKY[1:]):
        if y <= y1:
            t = (y - y0) / max(1, (y1 - y0))
            return c0, c1, t
    return SKY[-1][1], SKY[-1][1], 0


for y in range(HOR):
    c0, c1, t = sky_col(y)
    for x in range(250):
        q = dith(t, x, y, 4)
        far.a[y, x, :3] = mix(c0, c1, q); far.a[y, x, 3] = 255
# fahle Sonne hinter dem Smog
SUNX, SUNY, SUNR = 188, 160, 15
for y in range(SUNY - SUNR - 8, SUNY + SUNR + 8):
    for x in range(SUNX - SUNR - 8, SUNX + SUNR + 8):
        d = math.hypot(x + 0.5 - SUNX, y + 0.5 - SUNY)
        if d < SUNR: far.blend(x, y, (246, 214, 156), 0.85)
        elif d < SUNR + 7: far.blend(x, y, (240, 190, 130), dith(0.5 * (1 - (d - SUNR) / 7), x, y, 4))

# Big Gwen (Uhrturm-Oberteil), links, dunstig abgetönt
L270 = layer('MotiveBritain', 270)
tower = L270[100:HOR + 77, 240:320].copy()             # Spitze … Schaft bis zur Horizontlinie
tower[..., 3] = np.where(tower[..., 3] >= 128, 255, 0)
TX, TY = 42 - (279 - 240), HOR - tower.shape[0]
haze = (150, 104, 104)
tw = tower.copy()
for y in range(tw.shape[0]):
    for x in range(tw.shape[1]):
        if tw[y, x, 3] == 0: continue
        c = tw[y, x, :3].astype(float)
        lum = c.mean()
        clock = (188 - 100 <= y <= 243 - 100) and c[0] > 200 and c[1] > 200   # Zifferblatt bleibt hell
        k = 0.30 if clock else 0.55
        c = c * (1 - k) + np.array(haze) * k
        c *= 0.78 if not clock else 1.0
        tw[y, x, :3] = np.clip(c, 0, 255)
far.paste(tw, TX, TY)

# Uferbäume (aus der Kartenszene freigestellt), dunkel im Gegenlicht
sc = layer('MotiveBritain', 231)
tree = sc[209:242, 207:237].copy()
trgb = tree[..., :3].astype(int)
tree[..., 3] = np.where(trgb[..., 2] > trgb[..., 0] + 80, 0, 255)
tree = darken(tint(tree, (60, 40, 70), 0.45), 0.55)
for tx in (98, 124, 150, 236):
    far.paste(tree, tx - 15, HOR - 30)

# Ufermauer (selbst gezeichnet: Deckstein-Kante + dunkle Mauer)
for x in range(250):
    far.a[HOR - 4, x, :3] = (96, 70, 86)
    far.a[HOR - 3, x, :3] = (70, 50, 70)
    for y in range(HOR - 2, HOR + 1):
        far.a[y, x, :3] = (44, 32, 52) if (x + (y % 2) * 3) % 7 else (34, 24, 42)

# Pollution Spewer am Ufer + Rauchfahnen (selbst gezeichnet, grau, gerastert)
spew = sprite('o40_spewer', 'MotiveBritain', [221])
SP = [(186, False), (212, False)]
SMOKE_D, SMOKE_L = (96, 92, 100), (150, 146, 150)


def puff(cx, cy, r, a):
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.2)
            if d < r:
                sh = 0.5 + 0.5 * ((x - cx) - (y - cy)) / (2 * r)      # oben rechts heller
                col = mix(SMOKE_D, SMOKE_L, max(0.0, min(1.0, sh)))
                q = dith(a * (1 - (d / r) ** 3), x, y, 4)
                if q > 0: far.blend(x, y, col, q)


for sx, fl in SP:
    s_ = flip(spew) if fl else spew
    h, w = s_.shape[:2]
    far.paste(s_, sx - w // 2, HOR - 4 - h + 1)
    # Mündung: Original zeigt nach rechts oben (x+8, y−6 ab Mitte), gespiegelt nach links oben
    mx = sx + (8 if not fl else -8); my = HOR - 4 - h + 2
    for i in range(14):
        t = i / 13
        cx = mx + (1 if not fl else -1) * 10 * t + 16 * t * t * (1 if not fl else 0.3)
        cy = my - 4 - 70 * t
        puff(cx, cy, 3 + 9 * t, 0.85 - 0.35 * t)

# Smogbänder über den Himmel (Pollution Tokens), gerastert
for (yc, hgt, a) in ((118, 16, 0.70), (84, 11, 0.55), (58, 8, 0.40), (182, 9, 0.45)):
    for y in range(yc - hgt, yc + hgt):
        for x in range(250):
            wv = yc + 3 * math.sin(x / 23.0 + yc) + 2 * math.sin(x / 9.0)
            d = abs(y - wv) / hgt
            if d >= 1: continue
            v = a * (1 - d * d) * (0.8 + 0.2 * math.sin(x / 5.0 + y))
            q = dith(v, x, y, 4)
            if q > 0: far.blend(x, y, (128, 118, 120), q)

# ================================================================== Fluss 2× (125×175)
riv = Plane(125, 175, 2)
WT = sc[292:308, 448:464, :3].astype(float)
H0 = HOR // 2
for y in range(H0, 175):
    t = (y - H0) / (175 - H0)
    for x in range(125):
        c = WT[y % 16, x % 16]
        c = c * 0.45 + np.array((52, 50, 64)) * 0.55                    # abendlich, trüb (verschmutzt)
        sk = np.array(sky_col(max(0, HOR - 2 * (y - H0) - 1))[0]) * 0.8
        k = 0.55 * (1 - t) ** 1.5
        c = c * (1 - k) + sk * k
        riv.a[y, x, :3] = np.clip(c, 0, 255); riv.a[y, x, 3] = 255
# Sonnenglitzer unter der Sonne
for y in range(H0, 175):
    for x in range(125):
        dx = abs(x + 0.5 - SUNX / 2) / (4 + (y - H0) * 0.10)
        if dx < 1 and (x + y) % 3 != 0:
            v = 0.55 * (1 - dx) * max(0.0, 1 - (y - H0) / 60)
            q = dith(v, x, y, 4)
            if q > 0: riv.blend(x, y, (240, 188, 120), q)
# Turmspiegelung (senkrecht, gebrochen, dunkel)
for y in range(H0, H0 + 40):
    for x in range(125):
        sx, sy = 2 * x, HOR - 2 * (y - H0) - 2
        if 0 <= sy < 350 and far.a[sy, sx, 3] and TX <= sx < TX + tw.shape[1]:
            ty_, tx_ = sy - TY, sx - TX
            if 0 <= ty_ < tw.shape[0] and tw[ty_, tx_, 3] and (y + x // 3) % 4 != 0:
                riv.blend(x, y, (60, 44, 66), 0.45 * (1 - (y - H0) / 40))
# Ufermauer-Kante im Wasser
for x in range(125): riv.a[H0, x, :3] = (30, 22, 38)

# ================================================================== Vordergrund 4× (63×88)
W4, H4 = 63, 88
fg = Plane(W4, H4, 4, ox=-1)
L = {i: layer('MotiveBritain', i) for i in (95, 96, 247, 260)}
sprite('o40_victorica', 'MotiveBritain', [260])
sprite('o40_drill', 'MotiveBritain', [95, 96])
# Victorica sitzt mit ihrem Thron AUF der Plattform (Unterkante 260 = Plattform-Oberkante 109), Mitte wie 97 (x 390)
TOP = 109 - 35                            # Kronenoberkante in Mana-Mining-Koordinaten
GX, GY = 31 - 390, 7 - TOP                # → 4×-Raster: Mitte x 31, Krone in Zeile 7
VDX, VDY = 390 - 278, TOP - 207
WL = 134 + GY                             # Wasserlinie (Zeile im 4×-Raster), knapp über der Bohrerspitze


def put(arr, dx, dy, rows=None):
    ys, xs = np.nonzero(arr[..., 3] >= 128)
    for y, x in zip(ys, xs):
        X, Y = x + dx, y + dy
        if not (0 <= X < W4 and 0 <= Y < H4) or Y > WL: continue
        if rows and not (rows[0] <= y < rows[1]): continue
        fg.px(X, Y, tuple(int(v) for v in arr[y, x, :3]), 255)


# (Wirbelstreifen 94 der Karte weggelassen: im 4×-Raster wirkten sie als dunkle Kästen neben dem Bohrer)
put(L[96], GX, GY)                         # aufgewirbelter Schlamm um den Bohrer
put(L[95], GX, GY)                         # Plattform + Bohrer
put(L[260], VDX + GX, VDY + GY)            # Victorica auf ihrem Thron
# Augen-/Gesichtsschein 247: weich, gerastert, nur leicht
g = L[247]
ys, xs = np.nonzero(g[..., 3] > 40)
for y, x in zip(ys, xs):
    X, Y = x + VDX + GX, y + VDY + GY
    a = g[y, x, 3] / 255.0
    q = dith(a * 0.55, X, Y, 4)
    if q > 0 and 0 <= X < W4 and 0 <= Y < H4:
        if fg.a[Y, X, 3]: fg.blend(X, Y, (120, 210, 255), q * 0.45)      # nur auf der Figur (Gesicht/Haar)
# Gischtkranz an der Wasserlinie (selbst gezeichnet)
row = L[95][WL - GY]
cx_ = np.nonzero(row[:, 3])[0]
c0, c1 = cx_.min() + GX, cx_.max() + GX
FOAM1, FOAM2 = (220, 230, 238), (150, 172, 198)
for X in range(c0 - 6, c1 + 7):
    fg.px(X, WL, FOAM1 if X % 3 else FOAM2, 255)
    if c0 - 4 <= X <= c1 + 4: fg.px(X, WL + 1, FOAM2 if X % 2 else FOAM1, 200)
for (X, Y) in ((c0 - 8, WL - 2), (c1 + 8, WL - 2), (c0 - 5, WL - 4), (c1 + 6, WL - 3), (c0 - 10, WL), (c1 + 10, WL),
               (c0 - 3, WL - 6), (c1 + 3, WL - 5)):
    fg.px(X, Y, FOAM1, 230)
# dunkler Ölfilm/Schlamm, der sich vom Bohrer aus auf dem Wasser ausbreitet (Verschmutzung)
for Y in range(WL + 2, WL + 9):
    k = Y - WL
    half = (c1 - c0) / 2 + 4 + k * 2.2
    cxm = (c0 + c1) / 2
    for X in range(int(cxm - half), int(cxm + half) + 1):
        d = abs(X + 0.5 - cxm) / half
        v = 0.55 * (1 - d) * (1 - k / 9)
        q = dith(v, X, Y, 4)
        if q > 0 and 0 <= X < W4 and Y < H4: fg.px(X, Y, (26, 24, 30), int(255 * q * 0.8))

cv = compose_planes([far, riv, fg])
save(cv, '40_smog_drill.png')
print('ok', WL, c0, c1)
