# -*- coding: utf-8 -*-
"""45 Spellstorm – geplanter Gegner „Chaos-Diamond“ (Deck-ID planned:chaos-diamond; das Deck spielt viele Zauber),
Held/Hauptmotiv: Chaos-Diamond, the Cracked Keeper (Base-Karte).

Idee (Zaubergewitter, ≠ Shop-Sleeve „Cracked Keeper“: dort frontal riesig in seiner Höhle vor rotem Felsriss):
Nacht über dem Geröll der Dark Land (Hintergrund seiner Karte). Chaos-Diamond steht frontal im Vordergrund, um ihn
entladen sich gleichzeitig mehrere Destruction-Spells – wie sein Heldeneffekt, der die obersten Zauber seines
Potion Decks auf einmal wirkt: links platzt Armageddon als Sternexplosion am Himmel und schleudert drei
Feuerschweife schräg auf den fernen Horizont, wo ein Feuerpilz (Destruction Magic) aufblüht; rechts fährt Chain
Lightning aus der tief hängenden Gewitterwolke in die Ebene. Der Himmel über ihm bleibt ruhig; die Zauberlichter
färben Wolkenunterseiten und Geröll (Glut links, Blitzlicht rechts, warmer Schein von oben).

Quellen (Motive.xcf):
  Held:     Ebene 241 „Chaos-Diamond #2“ (43×50, vollständige Figur; gegen „Sichtbar #228“ = Ebene 237 geprüft –
            dort liegen zusätzlich das halbtransparente rote Fadenkreuz 240 und die rote Blitzranke 238/239 der Karte
            darüber; beide bewusst weggelassen: das Fadenkreuz würde bei 2× quer über das ganze Bild laufen, die
            rote Ranke über dem Kopf ist das Motiv der Shop-Sleeve).
  Boden:    Ebene 1286 „Dark Land“ (16×16-Kacheln: Geröll x236/y180, violette Leere x384/y96).
  Zauber:   Ebene 577 „Armageddon“ (Sternexplosion 46×46, Feuerschweife 48/48/36 px, gespiegelt, −32° gedreht),
            Ebene 211 „Destruction Magic #4“ (Feuerpilz 27×24).
  Karte „Chain Lightning“: Blitz selbst gezeichnet in den Farben des Kartenblitzes (Weiß/Hellgelb), wie in 26.
Selbst gezeichnet: Himmelsverlauf, Wolkenbank, Höhenzug, Lichtschein, Blitze, Schatten.

Skalierung: alles in EINEM 2×-Raster (125×175 → 6 px je Sprite-Pixel im 750er-Bild), auch der Held
(43×50 → 258×300 px). 3× ist nicht möglich: die Kernmitte des Helden liegt auf Sprite-Spalte 21,5, bei 9-px-Blöcken
fiele die Gesichtsmitte auf 373,5/376,5. Gemessen am PNG: roter Kern x 354–395 → Gesichtsmitte x = 375,0.
"""
import math, random
import numpy as np
from kitI import *  # noqa

rnd = random.Random(45)
B = 'Motive'

# ------------------------------------------------------------------ Quellen
hero = keep('o45_chaos_diamond', crop_alpha(layer(B, 241)))            # 43×50, vollständige Figur
land = layer(B, 1286)                                                    # „Dark Land“
T_GRAVEL = land[180:196, 236:252].copy()                                 # 16×16-Kachel Geröll
arma_p = parts(crop_alpha(layer(B, 577)), dil=2)
streaks = sorted([p for p in arma_p if p.shape[1] <= 20 and p.shape[0] >= 33], key=lambda p: -p.shape[0])
burst = [p for p in arma_p if p.shape[:2] == (46, 46)][0]                # Sternexplosion
fcloud = [p for p in parts(crop_alpha(layer(B, 211)), dil=2) if p.shape[:2] == (24, 27)][0]
keep('o45_burst', burst); keep('o45_fcloud', fcloud)
for i, s_ in enumerate(streaks): keep('o45_streak%d' % i, s_)

# ================================================================== alles im 2×-Raster (125×175)
W, H = 125, 175
P = Plane(W, H, 2)
HOR = 126                                   # Horizont
TOP, MID, LOW = (8, 5, 18), (30, 16, 48), (78, 38, 88)
for y in range(HOR):
    t = y / HOR
    for x in range(W):
        c = mix(TOP, MID, dith(min(1, t / 0.55), x, y, 6)) if t < 0.55 else mix(MID, LOW, dith((t - 0.55) / 0.45, x, y, 6))
        P.a[y, x, :3] = c; P.a[y, x, 3] = 255


def cloud(cx, cy, rx, ry, col, a=1.0):
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d < 1:
                q = dith(min(1.0, (1 - d) * 2.5) * a, x, y, 4)
                if q > 0: P.blend(x, y, col, q)


def glow(cx, cy, r, col, a, ry=None):
    ry = ry or r
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            d = math.hypot((x - cx) / r, (y - cy) / ry)
            if d < 1:
                q = dith(a * (1 - d) ** 1.6, x, y, 4)
                if q > 0: P.blend(x, y, col, q)


# Gewitterwolken oben: Wolkenbank aus Ellipsen (Maske), Körper dunkel, Unterkanten im Zauberlicht
CL = np.zeros((H, W), bool)
for cx, cy, rx, ry in [(2, 4, 24, 12), (26, 0, 22, 10), (50, 2, 18, 9), (76, 0, 22, 10), (100, 6, 22, 14),
                       (120, 16, 16, 16), (108, 26, 14, 9), (90, 22, 12, 7), (14, 18, 14, 6), (38, 12, 10, 5)]:
    for y in range(H):
        for x in range(W):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d < 0.86 or (d < 1.0 and BAY[y % 4, x % 4] > (d - 0.86) / 0.14):
                CL[y, x] = True
for y in range(H):
    for x in range(W):
        if not CL[y, x]: continue
        # Abstand zur Unterkante (wie viele Wolkenpixel liegen darunter)
        n = 0
        while y + n + 1 < H and CL[y + n + 1, x] and n < 6: n += 1
        warm = x < 62
        rim = (128, 72, 78) if warm else (104, 84, 116)
        if n == 0: col = rim
        elif n <= 3: col = mix(rim, (46, 28, 60), dith(n / 3.5, x, y, 4))
        else: col = mix((46, 28, 60), (22, 13, 34), dith(min(1, (n - 3) / 3), x, y, 4))
        P.a[y, x, :3] = col
glow(16, 86, 40, (130, 54, 30), 0.25)       # Armageddon-Glut links
glow(104, 70, 30, (110, 100, 64), 0.18)     # Blitzlicht rechts

# Ferne: dunkler Höhenzug, davor die Ebene der Dark Land
for x in range(W):
    ridge = HOR - 3 + int(round(2.0 * math.sin(x * 0.09) + 1.4 * math.sin(x * 0.23 + 1)))
    for y in range(ridge, HOR + 1):
        P.a[y, x, :3] = (16, 11, 24)
for y in range(HOR + 1, H):
    t = (y - HOR - 1) / (H - HOR - 1)
    k = 0.40 + 0.50 * t ** 0.8
    for x in range(W):
        c = T_GRAVEL[y % 16, x % 16, :3].astype(float) * k + np.array((10, 3, 20)) * (1 - t)
        # Zauberlicht auf dem Geröll: Glut links (Armageddon), Blitz rechts, Sternexplosion von oben
        lo = max(0.0, 1 - math.hypot((x - 14) / 60, (y - HOR) / 26)); ly = max(0.0, 1 - math.hypot((x - 106) / 46, (y - HOR) / 18))
        lc = max(0.0, 1 - math.hypot((x - 62.5) / 50, (y - 160) / 16))
        c = c + np.array((70, 26, 0)) * dith(lo * 0.9, x, y, 4) + np.array((60, 58, 30)) * dith(ly * 0.8, x, y, 4) \
            + np.array((40, 22, 6)) * dith(lc * 0.6, x, y, 4)
        P.a[y, x, :3] = np.clip(c, 0, 255); P.a[y, x, 3] = 255
# ganz hinten am Horizont ein schmales Band der violetten Leere (Dark Land), im Zauberlicht leicht aufgehellt
T_VOID = land[96:112, 384:400].copy()
for y in range(HOR + 1, HOR + 4):
    for x in range(W):
        c = T_VOID[y % 16, x % 16, :3].astype(float) * (0.75 + 0.1 * (y - HOR))
        P.a[y, x, :3] = np.clip(c, 0, 255)

# ------------------------------------------------------------------ Zauber
# Armageddon: Sternexplosion hoch über ihm am Himmel; Feuerschweife fallen schräg nach links unten auf den
# fernen Horizont, wo ein Feuerpilz (Destruction Magic) aufblüht
glow(30, 40, 34, (150, 70, 30), 0.30)
P.paste(burst, 8, 16)
for s_, (x, y) in zip(streaks[1:4], [(26, 40), (4, 56), (36, 62)]):
    P.paste(rotate(flip(s_), -32), x, y)
glow(22, HOR + 1, 20, (210, 96, 30), 0.45, 8)
P.paste(fcloud, 10, HOR - 20)

# Chain Lightning (in den Farben des Kartenblitzes) rechts aus der tiefen Wolke in die Ebene
CORE, EDGE = (255, 255, 255), (255, 255, 122)


def bolt(p0, p1, width, seed, branches=2, core=CORE, edge=EDGE):
    r = random.Random(seed)
    (x0, y0), (x1, y1) = p0, p1
    n = max(4, int(math.hypot(x1 - x0, y1 - y0) / 5))
    pts = [(x0, y0)]
    for i in range(1, n):
        t = i / n
        pts.append((round(x0 + (x1 - x0) * t + r.choice((-4, -3, -2, 2, 3, 4))), round(y0 + (y1 - y0) * t + r.choice((-1, 0, 1)))))
    pts.append((x1, y1))
    segs = list(zip(pts, pts[1:]))
    for (a_, b_) in segs:
        k = max(abs(b_[0] - a_[0]), abs(b_[1] - a_[1]), 1)
        for st in range(k + 1):
            px_ = round(a_[0] + (b_[0] - a_[0]) * st / k); py_ = round(a_[1] + (b_[1] - a_[1]) * st / k)
            if width >= 2:
                P.px(px_ + 1, py_, edge); P.px(px_ - 1, py_, edge) if width >= 3 else None; P.px(px_, py_, core)
            else:
                P.px(px_, py_, edge)
    for bi in range(branches):
        a_, b_ = segs[r.randrange(1, len(segs) - 1)]
        dx = r.choice((-1, 1)); x, y = a_
        for st in range(r.randrange(4, 8)):
            x += dx * r.choice((1, 1, 2)); y += r.choice((1, 1, 0))
            P.px(x, y, edge)
    return pts


HIT = (106, HOR + 5)
glow(HIT[0], HIT[1], 18, (240, 230, 130), 0.45, 6)
glow(104, 34, 10, (200, 196, 140), 0.40, 5)                      # Austritt an der Wolkenunterkante
pts = bolt((104, 33), HIT, 3, 7, 4)
BR = min(pts, key=lambda q: abs(q[1] - 66))                     # Abzweig der Kette an einem Knick des Hauptblitzes
bolt(BR, (BR[0] - 14, BR[1] + 26), 1, 17, 1)

# ------------------------------------------------------------------ Held
FEET = 160
HX, HY = 41, FEET - hero.shape[0] + 1        # Kernmitte 41+21,5 = 62,5 → x 375
for xx in range(-22, 23):
    for yy in range(-2, 2):
        if (xx / 22.5) ** 2 + ((yy + 0.3) / 2.2) ** 2 <= 1:
            P.px(62 + xx, FEET + yy, (8, 6, 14), 170)
P.paste(hero, HX, HY)

cv = compose_planes([P])
save(cv, '45_spellstorm.png')
