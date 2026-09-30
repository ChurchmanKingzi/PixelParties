# -*- coding: utf-8 -*-
"""16 „Rift over Earth“ – Gegner „Depths of the Cosmos“, Held: Argos, the Eye of the Cosmos (Base).

Bildidee (2. Überarbeitung nach Nutzer-Feedback): Argos steht groß oben in der Bildmitte – die rote Schlitzpupille
(Pupille schwarz gefüllt) vor seinem schwarzen, stacheligen Schattenkörper, wie in den Kosmos-Kartenszenen. Unter ihm
schwebt die würfelförmige Erde der Boons-Welt; ein roter Blickkegel fällt aus dem Schattenkörper auf den Würfel. Seine
Cosmic-Depths-Kreaturen arbeiten in klaren Gruppen: zwei Life-Searcher schweben gespiegelt über dem Würfel und tasten
ihn mit grünen Suchstrahlen ab (wie auf ihrer Karte), rechts streben zwei Analyzer-Sichelschiffe mit Bewegungsspur
zum Würfel, links trägt ein Gatherer einen Asteroiden heran.

Quellen (MotiveBoons.xcf):
  Argos (Base)    = Ebene 38 „Argos“ (Auge, Pupillenloch schwarz gefüllt) vor Ebene 41 „Ebene #22“ (schwarzer
                    Schattenkörper, 98×79) + 40 „Ebene #23“ (innere Form mit Schweif) – Lage wie in den Szenen
                    Sichtbar #10–#14 (Auge bei x169/y300, Körper bei x131/y286)
  Erde (Würfel)   = Ebene 74 „Ebene #3“ (36×36; vgl. Earthrise, runde4/generator/s22_earthrise.py)
  Life-Searcher   = Ebene 22 + Suchstrahl 23 (halbtransparent 45 % auf ganzen 2×-Pixeln), Karte Sichtbar #19
  Analyzer        = Ebene 34 (Sichelschiff, Karte „Analyzer from the Cosmic Depths“), gespiegelt/gedreht
  Gatherer        = Ebene 28 + ein Asteroid aus 29 (Karte „Gatherer from the Cosmic Depths“)
Selbst gezeichnet: Allverlauf, Sterne, roter Blickkegel und Randschein am Würfel (gedithert), Bewegungsspuren.

Reihenfolge: All < Blickkegel < Würfel < Argos < Kreaturen < Strahlen.

Skalierung (Ausgabe = 250×350-Raster × 3):
  All, Sterne                                                      – 1×
  Argos (Körper 196×158), Würfel, Blickkegel, alle Kreaturen, Strahlen – 2× (125×175)
"""
import math, random, os
from c_util import *  # noqa
import numpy as np
import cv2

B = 'MotiveBoons'
rnd = random.Random(16)

# --- Argos: kohärenter Schattenkörper mit Auge aus der Nutzer-Referenz refs/argos_body.png (113×167, RGBA) ---
# (in den exportierten xcf-Ebenen nicht gefunden; Ebenen 41/40 sind nur eine grobe Vorform). Pupille schwarz.
from PIL import Image
ref = np.array(Image.open(os.path.join(HERE, '..', 'refs', 'argos_body.png')).convert('RGBA'))
REX, REY = 53.5, 81.5                                  # Augenmitte in der Referenz (rotes Auge x43–63, y57–106)
cube = sprite('o16_cube', B, [74])                   # 36×36
search = parts(compose(B, [22]), dil=1)[0]           # 19×34
beam = [p for p in parts(compose(B, [23]), dil=1) if p.shape[0] == 29][0]
anal = [p for p in parts(compose(B, [34]), dil=1) if p.shape == (17, 18, 4)][0]
gath = parts(compose(B, [28]), dil=1)[0]
rock = parts(compose(B, [29]), dil=1)[0]

# ---------- 1×: All, Sterne ----------
cv = Canvas(250, 350)
SP = [(4, 4, 22), (6, 8, 34), (10, 12, 48), (14, 18, 64), (18, 24, 78)]
for y in range(350):
    for x in range(250):
        cv.a[y, x] = grad_pick(SP, 0.8 - 0.6 * math.hypot((x - 125) / 250, (y - 170) / 350), x, y)
for _ in range(80):
    x, y = rnd.randrange(250), rnd.randrange(350)
    cv.a[y, x] = rnd.choice([(200, 210, 255), (120, 130, 200), (255, 255, 255)])
for (x, y) in [(34, 30), (218, 40), (26, 200), (226, 250), (40, 318), (210, 312)]:
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): cv.px(x + dx, y + dy, (170, 190, 255) if (dx or dy) else (255, 255, 255))

# ---------- 2×: Argos-Körper, nach außen zunehmend transparent (Alpha je ganzem 2×-Pixel) ----------
AXc, AYc = 62.5, 55                                    # Augenmitte im 2×-Raster (250er: x125, y110)
ox, oy = int(AXc - REX), int(AYc - REY)
for j in range(ref.shape[0]):
    for i in range(ref.shape[1]):
        a0 = ref[j, i, 3] / 255
        if a0 == 0: continue
        d = math.hypot((i + 0.5 - REX) / 1.0, (j + 0.5 - REY) / 1.25)
        fade = 1.0 if d < 20 else max(0.0, 1 - (d - 20) / 52) ** 1.2
        a_ = a0 * fade
        if a_ < 0.04: continue
        X_, Y_ = (ox + i) * 2, (oy + j) * 2
        if not (0 <= X_ < 250 and 0 <= Y_ < 350): continue
        blk = cv.a[Y_:Y_ + 2, X_:X_ + 2].astype(float)
        cv.a[Y_:Y_ + 2, X_:X_ + 2] = (blk * (1 - a_) + ref[j, i, :3] * a_).astype(np.uint8)

# ---------- 2×: Blickkegel, Kreaturen, Strahlen ----------
p2 = rgba(125, 175)
CS = 3                                                 # Würfel 3× (108×108), Vordergrund
CXp, CYp = 125 - 54, 212                               # Würfel im 250er-Raster: x71–179, y212–320
ecx = AXc
y0, y1 = int(AYc + 26), CYp // 2 + 2
for y in range(y0, y1):
    t = (y - y0) / max(1, y1 - y0)
    half = 4 + 16 * t
    for x in range(int(ecx - half), int(ecx + half) + 1):
        f = 1 - abs(x + 0.5 - ecx) / half
        lv = int(f * 2.4 + bayer(x, y))
        if lv:
            c = tuple(int(v) for v in cv.a[y * 2, x * 2])
            p2[y, x] = list(mix(c, (160, 26, 48), (0, 0.2, 0.34, 0.46)[min(3, lv)])) + [255]
S_L, S_R = (32, 52), (74, 52)                          # Life-Searcher über den oberen Würfelecken
put(p2, search, *S_L); put(p2, flip(search), *S_R)
def trail(x, y, dx, dy, n=8):
    for k in range(1, n):
        px_, py_ = x + dx * k, y + dy * k
        if 0 <= px_ < 125 and 0 <= py_ < 175 and p2[py_, px_, 3] == 0 and bayer(px_, py_) * n < n + 1 - k:
            p2[py_, px_] = list(mix(tuple(int(v) for v in cv.a[py_ * 2, px_ * 2]), (140, 230, 200), 0.55 - k * 0.05)) + [255]
for (x, y) in [(96, 110), (99, 134)]:                  # zwei Analyzer rechts, fliegen zum Würfel
    trail(x + 17, y + 2, 2, -1); trail(x + 17, y + 6, 2, -1)
    put(p2, flip(anal), x, y)
put(p2, gath, 4, 128); put(p2, rock, 22, 118)           # Gatherer links unten mit Asteroid
blit(cv, p2, 2)
for (sx, sy) in (S_L, S_R):
    cv.paste(up(beam, 2), (sx + 5) * 2, (sy + 33) * 2, alpha=0.45)

# ---------- 3×: Erdwürfel (vorn, größer), oben rot angestrahlt ----------
c3 = cube.copy()
for y in range(10):
    for x in range(36):
        if c3[y, x, 3] and bayer(x, y) < 0.55 - y * 0.05:
            c3[y, x, :3] = mix(tuple(int(v) for v in c3[y, x, :3]), (210, 50, 70), 0.35)
cv.paste(up(c3, CS), CXp, CYp)                        # Strahlen enden auf der Würfeloberfläche
print(save(cv, '16_rift_over_earth.png'))
