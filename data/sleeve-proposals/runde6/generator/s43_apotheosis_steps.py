# -*- coding: utf-8 -*-
"""43 Apotheosis Steps – Gegner „To Attain Divinity“ (Structure Deck), Held: Archibald, the Archmage.

Nacht im Dschungel: Archibald steht auf dem Prozessionsweg zwischen den zwei brennenden Kohlebecken, hinter ihm
erhebt sich die goldene Stufenpyramide. Auf ihrer Spitze leuchtet die goldene Gestalt der Divinity-Karte, über
ihr steigt geisterhaft der geflügelte Dschungelgott auf (wie auf „Divinity“ und „Divine Gift of Sacrifice“) –
das Ziel, das der Erzmagier erreichen will.

Quellen:
  Motive.xcf  Ebene 436 „ARCHMAGE“ (Archibald: violetter Sternenhut, Bart, Stab) + Ebene 435 „Archmage #9“
              (violette Funkelsterne am Stab) – Base-Karte „Archibald, the Archmage“ = Rosettenfenster in
              Sichtbar #43 (Ebene 98, Lage 247,117); Komposit [435, 436] pixelgleich mit der Szene
              (354 deckende Pixel, 0 Abweichungen). NICHT Ebene 434 „Gandalf“ (graue Variante).
  MotiveSteamDwarfs.xcf  Karte „Divinity“ = Sichtbar #37 (Ebene 247, Lage 208,166):
              Ebene 248 „Divine Gift of Sacrifice“ (halbtransparenter Geistergott + goldene Gestalt mit Funkeln;
              hier nur der Geist, Deckkraft der Ebene übernommen und verstärkt),
              Ebene 252 „Teocuitlatl“ (die goldene Divinity-Gestalt mit Funkeln als eigenes Sprite),
              Ebene 305 „TEMPEL“ (goldene Stufenpyramide), Ebene 284 „Ebene #114“ (zwei Kohlebecken mit Feuer;
              der Held dazwischen gehört zu „Divine Gift of Sacrifice“ und ist weggelassen).
Selbst gezeichnet: Nachthimmel mit Sternen, Dschungel-Baumkronen als Silhouette, Feuerschein, Prozessionsweg aus
Steinplatten, Lichtschein der goldenen Gestalt.

Skalierung (Tiefenebenen):
  Hintergrund (Himmel, Geistergott, Pyramide, goldene Gestalt, Dschungel)   – 2×-Raster (125×175)
  Vordergrund (Archibald 25×31 → 100×124, Kohlebecken, Weg)                – 4×-Raster (63×88)
"""
import math, random
import numpy as np
from kitH import *  # noqa

BM, BS = 'Motive', 'MotiveSteamDwarfs'
rnd = random.Random(43)

arch = sprite('o43_archibald', BM, [435, 436])            # 20×32 inkl. Funkeln
gold = sprite('o43_divinity', BS, [252])                  # goldene Gestalt
temple = sprite('o43_temple', BS, [305])                  # 136×110
braz = sprite('o43_braziers', BS, [284])                  # 42×18
brazL, brazR = braz[:, 0:10], braz[:, 33:43]
ghost_raw = raw_cached('o43_ghost', BS, 248, (196, 125, 306, 183))       # Geist (Zeilen 0–57), ohne die goldene Gestalt


def is_warm(c):
    r, g, b = int(c[0]), int(c[1]), int(c[2])
    return (r > g + 25 and r > b + 25) or (r > 200 and g > 200 and b > 170)


# ================================================================== Hintergrund 2× (125×175)
w2, h2 = grid(2)
bg = rgba(w2, h2)
bg[..., 3] = 255
SKY = [(8, 10, 30), (14, 18, 46), (22, 28, 64), (30, 40, 80), (40, 54, 92)]
HOR = 132
for y in range(h2):
    t = min(y / HOR, 1.0) * (len(SKY) - 1)
    i = min(int(t), len(SKY) - 2)
    f = t - i
    for x in range(w2):
        bg[y, x, :3] = SKY[i + 1] if f > BAY[y % 4, x % 4] else SKY[i]
for _ in range(70):                                       # Sterne
    x, y = rnd.randrange(w2), rnd.randrange(0, 110)
    bg[y, x, :3] = (200, 210, 255) if rnd.random() < 0.25 else (110, 124, 170)

CX2 = w2 // 2
TOPY = 74                                                  # Oberkante der Pyramide (y 152)
th, tw = temple.shape[:2]
temple_x = CX2 - tw // 2 + 1

# Geistergott: Mitte über der Pyramidenspitze, Deckkraft der Ebene ×2.2, in 4 Stufen quantisiert
gh, gw = ghost_raw.shape[:2]
GX, GY = CX2 - gw // 2, 12
for j in range(gh):
    for i in range(gw):
        a = ghost_raw[j, i, 3] / 255.0
        if a <= 0 or is_warm(ghost_raw[j, i]):
            continue
        q = 0.6 if a > 0.3 else (0.4 if a > 0.12 else 0.0)
        X, Y = GX + i, GY + j
        col = ghost_raw[j, i, :3] * 0.45 + np.array((110, 210, 175)) * 0.55     # geisterhaftes Jadegrün
        if q > 0 and 0 <= X < w2 and 0 <= Y < h2:
            bg[Y, X, :3] = (bg[Y, X, :3] * (1 - q) + col * q).astype(np.uint8)



def canopy(base, amp, ph, cols):
    """Baumkronen-Silhouette: runde Buckel, heller Saum oben, darunter dunkel."""
    for x in range(w2):
        top = base - amp * abs(math.sin(x * 0.19 + ph)) - 2 * abs(math.sin(x * 0.53 + ph * 2))
        for y in range(int(top), h2):
            d = y - top
            bg[y, x, :3] = cols[2] if d < 1 else (cols[1] if d < 2 + BAY[y % 4, x % 4] * 3 else cols[0])


canopy(122, 6, 0.4, [(10, 24, 26), (16, 36, 34), (24, 50, 44)])          # ferner Dschungel hinter der Pyramide
put(bg, temple, temple_x, TOPY)
put(bg, gold, CX2 - gold.shape[1] // 2 + 1, TOPY - gold.shape[0] + 2)
canopy(128, 5, 2.2, [(6, 16, 16), (10, 26, 22), (20, 42, 32)])            # nähere Kronen verdecken den Pyramidenfuß

# ================================================================== Vordergrund 4× (63×88)
w5, h5 = grid(4)
fg = rgba(w5, h5)
FEET = 79                                                  # Standzeile (y 312–316)
PAV = [(34, 30, 38), (48, 42, 48), (70, 62, 64), (24, 20, 28)]
for y in range(FEET - 1, h5):
    for x in range(w5):
        row = y - (FEET - 1)
        brick = ((x + (row // 3) * 3) % 7 == 0) or (row % 3 == 2)
        c = PAV[3] if brick else (PAV[2] if row == 0 else PAV[1] if row < 3 else PAV[0])
        fg[y, x, :3] = c
        fg[y, x, 3] = 255
ah, aw = arch.shape[:2]
AX = w5 // 2 - aw // 2 - 1
put(fg, arch, AX, FEET - ah)
bh, bw = brazL.shape[:2]
put(fg, brazL, 8, FEET - bh)
put(fg, brazR, w5 - 8 - bw, FEET - bh)

cv = Canvas(W, H)
blit(cv, bg, 2)
# Feuerschein der Kohlebecken auf dem Weg (Endraster = 5×-Blöcke, zwei Stufen)
for fx in (8 + bw / 2, w5 - 8 - bw / 2):
    glow(fg, fx, FEET + 1, 12, (255, 140, 50), 0.35, ry=4, steps=2)
blit(cv, fg, 4)
print(save(cv, '43_apotheosis_steps.png'))
