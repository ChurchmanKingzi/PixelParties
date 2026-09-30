# -*- coding: utf-8 -*-
"""41 Rampart of Deri – Gegner „Steam Dwarf Mines“ (Structure Deck), Held: Layn, Defender of Deri.

Layn steht groß hinter der grauen Zinnenbrüstung seiner Base-Karte, die Hände auf der Mauer, und bewacht die
Minenhalle der Steam Dwarfs, die sich hinter ihm als EINE zusammenhängende Tiefe öffnet: vorn quert eine steinerne
Förderbrücke mit Schienen die Halle, ihre Pfeiler stehen im Lavafluss am Grund; auf der Brücke steht als Blickpunkt
der Steam Dwarf Dragon Pilot (Cover-Karte). Weiter hinten arbeiten auf zwei versetzten Felsbänken der Wand der
Exterminator (sein Flammenstrahl schießt über die Kante hinab) und der Brewer; ihre Dampffahnen steigen ins Dunkel.
(Layn: „erhöhe die HP jeder Kreatur, die du beschwörst“ – der Verteidiger und seine Zwergenarmee.)

Quellen:
  MotiveDeri.xcf  Ebene 250 „Layn“ (Kopf, Krone mit Rubin und Quasten, Oberkörper, Brüstungsreihe),
                  Ebene 245 „Layn #1“ (Hände auf der Zinne), Ebene 246 „Zinnen“ (Zinnen links/mittig/rechts).
                  Base-Karte „Layn, Defender of Deri“ = Balkon-Ausschnitt von Sichtbar #83 (Ebene 1, um 238,285);
                  Komposit [246, 250, 245] pixelgleich mit der Szene (0 Abweichungen); hier Ausschnitt x 213–263,
                  y 262–308. NICHT „Ascended Layn“ (Ebenen 203/204).
  MotiveSteamDwarfs.xcf  Ebene 445 „Ebene #1“ (Felswand-Kachel der Lavamine, auch als Mauerwerk von Brücke und
                  Pfeilern), Ebene 444 „Ebene #32“ (Lava-Kachel), Steam Dwarf Exterminator [433 Flammenstrahl, 434 Zwerg]
                  (Sichtbar 430; das brennende Opfer 432 ist weggelassen),
                  Steam Dwarf Brewer [440, 441] (Sichtbar 15), Steam Dwarf Dragon Pilot [429] (Sichtbar 400,
                  Cover-Karte), Dampffahnen Ebene 431 „Ebene #6“ (in den Szenen halbtransparent – hier als echte
                  Mischfarbe je ganzem Pixel).
Selbst gezeichnet: Felsbänke mit Kante und Schlagschatten, Brückenfahrbahn mit Schienen und Schwellen, Pfeiler,
Lava-Uferlinie, Widerschein, Abdunklung zum Rand, Kontaktschatten, Schattenzeile unter der Brüstung.

Skalierung (Tiefenebenen):
  Hintergrund (Felswand, Felsbänke, Exterminator, Brewer, Dampf, Lavafluss)     – 2×-Raster (125×175)
  Mittelgrund (Förderbrücke, Pfeiler, Dragon Pilot 30×52 → 90×156)       – 3×-Raster (84×117)
  Vordergrund (Layn, Brüstung mit Zinnen, 50×32 → 250×160)               – 5×-Raster (50×70)
"""
import numpy as np
from kitH import *  # noqa

BD, BS = 'MotiveDeri', 'MotiveSteamDwarfs'

# ------------------------------------------------------------------ Sprites
layn = sprite('o41_layn5', BD, [246, 250, 245], box=(213, 262, 263, 308))  # 50×32 inkl. Brüstung
mine = sprite('o41_mine', BS, [445])                                        # 320×240
exterminator = sprite('o41_ext', BS, [433, 434])      # Steam Dwarf Exterminator mit Flammenstrahl (20×47)
brewer = sprite('o41_brewer', BS, [440, 441])
pilot = sprite('o41_pilot', BS, [429])
steam = sprite('o41_steam', BS, [431])
PUFFS = parts(steam, dil=1)                  # zwei Dreier-Dampffahnen
lava = sprite('o41_lava', BS, [444])          # Lavafeld (320×240)

# ================================================================== Hintergrund 2× (125×175)
# Eine zusammenhängende Minenhalle: hinten die Felswand (Kacheln der Lavamine, 16 px periodisch) mit zwei
# Felsbänken, auf denen Exterminator und Brewer arbeiten; unten der Lavafluss am Grund der Halle.
w2, h2 = grid(2)
bg = rgba(w2, h2)
bg[..., 3] = 255
CLIFF = mine[52:84, 0:16, :3]                # Felswand-Kachel (16×32)
LAVA = lava[90:122, 64:96, :3]               # reine Lava (Ebene 444)
LAVA0 = 118                                  # Lavaspiegel am Grund der Halle (y 236)


def tile_rows(y0, y1, tile, ox=0, oy=0):
    th, tw = tile.shape[:2]
    for y in range(y0, min(y1, h2)):
        for x in range(w2):
            bg[y, x, :3] = tile[(y - y0 + oy) % th, (x + ox) % tw]


tile_rows(0, LAVA0, CLIFF, ox=5)
tile_rows(LAVA0, h2, LAVA)
lava_px = bg[LAVA0:].copy()
shade(bg[:LAVA0], 0.8)
dark_vignette(bg, strength=0.7, r0=0.25, cy=h2 * 0.3)
bg[LAVA0:] = lava_px                         # der Lavafluss bleibt hell
# Lava: Uferkante als dunkle Linie, darüber warmer Widerschein an der Wand (zwei gedithert verlaufende Stufen)
for x in range(w2):
    bg[LAVA0, x, :3] = (70, 20, 12)
    if BAY[(LAVA0 + 1) % 4, x % 4] < 0.5:
        bg[LAVA0 + 1, x, :3] = (150, 40, 16)
for y in range(LAVA0 - 22, LAVA0):
    t = (y - (LAVA0 - 22)) / 22
    q = 0.28 * t
    for x in range(w2):
        if BAY[y % 4, x % 4] < 0.35 + t * 0.65:
            bg[y, x, :3] = (bg[y, x, :3] * (1 - q) + np.array((255, 120, 40)) * q).astype(np.uint8)

ROCKTOP = [(118, 98, 96), (92, 74, 76)]      # Felsbank: helle Oberkante, darunter Kante und Schlagschatten


def ledge(x0, x1, y):
    """Felsbank aus der Wand: 3 Zeilen Oberfläche (oben hell), 3 Zeilen Stirnseite, Schatten an der Wand darunter."""
    rows = [ROCKTOP[0], ROCKTOP[1], ROCKTOP[1], (70, 54, 58), (58, 44, 50), (44, 32, 38), (16, 10, 14), (16, 10, 14)]
    for j, c in enumerate(rows):
        a0, a1 = (x0 + (1 if j in (0, 5) else 0), x1 - (1 if j in (0, 5) else 0))
        if j >= 6:
            a0, a1 = x0 + 2, x1 - 1
        for x in range(a0, a1):
            if 0 <= x < w2:
                bg[y + j, x, :3] = c


def blend_put(s, x, y, a):
    """Halbtransparenter Dampf: echte Mischfarbe je ganzem Pixel (wie die Deckkraft der Dampfebenen)."""
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            X, Y = x + i, y + j
            if s[j, i, 3] and 0 <= X < w2 and 0 <= Y < h2:
                bg[Y, X, :3] = (bg[Y, X, :3] * (1 - a) + s[j, i, :3] * a).astype(np.uint8)


pA, pB = PUFFS[1], PUFFS[3]                  # die beiden hohen Dreier-Fahnen
# Exterminator links auf der unteren Felsbank: steht auf der Bank, sein Flammenstrahl schießt nach vorn über die
# Kante hinab (Flamme vor der Stirnseite, wie auf der Karte vor seinem Körper)
MY = 62                                      # Oberfläche der unteren Felsbank (y 124)
ledge(10, 42, MY)
ex = 16
EFEET = 29                                   # unterste Körperzeile (Tank) im Sprite; darunter nur die Flamme
blend_put(pA, ex + 10 - pA.shape[1] // 2, MY - EFEET + 2 - pA.shape[0], 0.5)
put(bg, exterminator, ex, MY - EFEET - 1)
# Brewer höher und weiter hinten auf einer zweiten Bank, versetzt zur Mitte hin
BY = 38                                      # (y 76)
ledge(34, 62, BY)
bx = 36
blend_put(pB, bx + 12 - pB.shape[1] // 2, BY - 28 + 3 - pB.shape[0], 0.45)
put(bg, darken(brewer, 0.9), bx, BY - 28)

# ================================================================== Mittelgrund 3× (84×117): Förderbrücke
w3, h3 = grid(3)
mid = rgba(w3, h3)
DECK = 60                                    # Oberfläche der Brücke (y 180)
STONE = [(120, 104, 100), (96, 80, 80), (74, 60, 62), (52, 40, 46), (28, 20, 26)]
PILLARS = [(10, 17), (38, 46), (67, 74)]
TEX = mine[52:84, 0:16, :3]                   # Felswand-Kachel als Mauerwerk der Brücke (auf dem 3×-Raster)
for x in range(w3):
    mid[DECK, x, :3] = STONE[0]
    mid[DECK + 1, x, :3] = STONE[1]
    for y in range(DECK + 2, DECK + 7):      # Stirnseite
        mid[y, x, :3] = (TEX[(y - DECK) % 32, x % 16] * 0.9).astype(np.uint8)
    mid[DECK + 7, x, :3] = STONE[4]
    for y in range(DECK, DECK + 8):
        mid[y, x, 3] = 255
# Schienen auf der Brücke (Förderbahn): zwei dunkle Schienenlinien mit hellem Glanz, Schwellen darunter
for x in range(w3):
    if x % 4 == 0:
        mid[DECK + 1, x, :3] = (70, 52, 44)
    mid[DECK, x, :3] = (150, 146, 150) if x % 6 else (110, 106, 110)
for (x0, x1) in PILLARS:                     # Pfeiler bis in den Lavafluss
    for y in range(DECK + 8, h3):
        for x in range(x0, x1):
            e = (x - x0) / (x1 - x0 - 1)
            c = TEX[(y - DECK) % 32, x % 16].astype(float) * (0.75 if e > 0.6 else 0.95)
            if x == x0 or x == x1 - 1:
                c = np.array(STONE[4], float)
            depth = y - (DECK + 8)
            if y * 3 >= LAVA0 * 2 - 12:       # Fuß im Lavaschein
                c = c * 0.75 + np.array((230, 90, 30)) * 0.25
            mid[y, x, :3] = c.astype(np.uint8)
            mid[y, x, 3] = 255
    for x in range(x0, x1):                  # Schlagschatten der Fahrbahn am Pfeilerkopf
        mid[DECK + 8, x, :3] = STONE[4]
# Dragon Pilot (Cover-Karte) als Blickpunkt auf der Brücke, rechts der Mitte
ph, pw = pilot.shape[:2]
PX = 43
for x in range(PX + 3, PX + pw - 3):
    mid[DECK, x, :3] = (40, 30, 30)          # Kontaktschatten auf der Fahrbahn
put(mid, pilot, PX, DECK + 1 - ph)

# ================================================================== Vordergrund 5× (50×70)
w5, h5 = grid(5)
fg = rgba(w5, h5)
lay = layn.copy()
lay[-1, :, :3] = (lay[-2, :, :3] * 0.45).astype(np.uint8)   # unterste Schattenzeile über die volle Breite
lay[-1, :, 3] = 255
lh, lw = lay.shape[:2]
LY = h5 - lh + 2                             # Brüstung reicht mit ihrer Fußzeile in die Rahmenzone
put(fg, lay, 0, LY)

cv = Canvas(W, H)
blit(cv, bg, 2)
blit(cv, mid, 3)
blit(cv, fg, 5)
print(save(cv, '41_rampart_of_deri.png'))
