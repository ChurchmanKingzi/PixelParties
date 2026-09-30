# -*- coding: utf-8 -*-
"""41 Rampart of Deri – Gegner „Steam Dwarf Mines“ (Structure Deck), Held: Layn, Defender of Deri.

Layn steht groß hinter der grauen Zinnenbrüstung seiner Base-Karte, die Hände auf der Mauer, und bewacht den
Zugang zur Lavamine der Steam Dwarfs, die sich hinter ihm tief unten öffnet: Miner und Brewer mit ihren
Dampfpfeifen, der Steam Dwarf Dragon Pilot (Cover-Karte) im goldenen Drachenpanzer; die Dampfsäulen steigen
aus dem Schacht hinter seinem Rücken auf. (Layn: „erhöhe die HP jeder Kreatur, die du beschwörst“ – der
Verteidiger und seine Zwergenarmee.)

Quellen:
  MotiveDeri.xcf  Ebene 250 „Layn“ (Kopf, Krone mit Rubin und Quasten, Oberkörper, Brüstungsreihe),
                  Ebene 245 „Layn #1“ (Hände auf der Zinne), Ebene 246 „Zinnen“ (Zinnen links/mittig/rechts).
                  Base-Karte „Layn, Defender of Deri“ = Balkon-Ausschnitt von Sichtbar #83 (Ebene 1, um 238,285);
                  Komposit [246, 250, 245] im Ausschnitt x 217–259, y 262–308 pixelgleich mit der Szene
                  (1613 deckende Pixel, 0 Abweichungen). NICHT „Ascended Layn“ (Ebenen 203/204).
  MotiveSteamDwarfs.xcf  Ebene 445 „Ebene #1“ (Lavamine, Hintergrund der Steam-Dwarf-Karten),
                  Steam Dwarf Miner [437, 438, 439] (Sichtbar 435), Steam Dwarf Brewer [440, 441] (Sichtbar 15),
                  Steam Dwarf Dragon Pilot [429] (Sichtbar 400, Cover-Karte), Dampffahnen Ebene 431 „Ebene #6“
                  (in den Szenen halbtransparent über den Pfeifen der Zwerge – hier geordnet gedithert).
Selbst gezeichnet: Lichtführung (Lavaschein von unten, Abdunklung zum Rand), untere Mauerkante der Brüstung
(Verlängerung der Brüstungs-Unterreihe), Kontaktschatten der Zwerge.

Skalierung (Tiefenebenen):
  Hintergrund (Lavamine, Zwerge, Drachenpilot, Dampf)          – 2×-Raster (125×175)
  Vordergrund (Layn, Brüstung mit Zinnen)                      – 6×-Raster (42×59)
"""
import numpy as np
from kitH import *  # noqa

BD, BS = 'MotiveDeri', 'MotiveSteamDwarfs'

# ------------------------------------------------------------------ Sprites
layn = sprite('o41_layn', BD, [246, 250, 245], box=(217, 262, 259, 308))   # 42×46 inkl. Brüstung
mine = sprite('o41_mine', BS, [445])                                        # 320×240
miner = sprite('o41_miner', BS, [437, 438, 439])
brewer = sprite('o41_brewer', BS, [440, 441])
pilot = sprite('o41_pilot', BS, [429])
steam = sprite('o41_steam', BS, [431])
PUFFS = parts(steam, dil=1)                  # zwei Dreier-Dampffahnen
lava = sprite('o41_lava', BS, [444])          # Lavafeld (320×240)

# ================================================================== Hintergrund 2× (125×175)
# Aus den Kacheln der Lavamine (Ebene 445, 16 px periodisch) aufgebaut: hinten die Felswand, davor eine Galerie
# (roter Felsboden) mit den Zwergen, darunter die Felskante, die in den Schacht hinter Layn abfällt.
w2, h2 = grid(2)
bg = rgba(w2, h2)
bg[..., 3] = 255
CLIFF = mine[52:84, 0:16, :3]                # Felswand-Kachel (16×32)
STRIP = mine[28:52, 0:16, :3]                # Galerieboden: Kante oben, roter Fels, Abbruchkante unten
FACE = mine[49:108, 0:16, :3]                # Felswand unter der Galerie


def tile_rows(y0, y1, tile, ox=0):
    th, tw = tile.shape[:2]
    for y in range(y0, min(y1, h2)):
        for x in range(w2):
            bg[y, x, :3] = tile[(y - y0) % th, (x + ox) % tw]


G0 = 54                                      # Oberkante des Galeriebodens
LAVA0 = 124                                  # Lavasee am Grund des Schachts (hinter der Brüstung)
tile_rows(0, G0, CLIFF, ox=5)
tile_rows(G0 - 2, G0 + 22, STRIP)
tile_rows(G0 + 22, LAVA0, FACE[3:], ox=9)
LAVA = lava[90:122, 64:96, :3]               # reine Lava (Ebene 444)
RIM = mine[112:118, 0:16, :3]                # roter Fels als Uferkante
tile_rows(LAVA0, LAVA0 + 3, RIM)
tile_rows(LAVA0 + 3, h2, LAVA)
for x in range(w2):                          # ausgefranste Uferlinie (Dither wie in den Kartenszenen)
    for d in range(3):
        if BAY[(LAVA0 + 3 + d) % 4, x % 4] < 0.5 - d * 0.2:
            bg[LAVA0 + 3 + d, x, :3] = RIM[d % 6, x % 16]


def blend_put(s, x, y, a):
    """Halbtransparenter Dampf: echte Mischfarbe je ganzem Pixel (wie die Deckkraft der Dampfebenen)."""
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            X, Y = x + i, y + j
            if s[j, i, 3] and 0 <= X < w2 and 0 <= Y < h2:
                bg[Y, X, :3] = (bg[Y, X, :3] * (1 - a) + s[j, i, :3] * a).astype(np.uint8)


def dwarf(s, x, feet, puff=None, px=0, alpha=0.55):
    """Zwerg mit Füßen auf Zeile `feet`, Kontaktschatten, Dampffahne an den Pfeifen (Unterkante = Pfeifenspitze)."""
    h, w = s.shape[:2]
    y = feet - h
    for i in range(3, w - 3):
        setp(bg, x + i, feet, (70, 16, 10))
    if puff is not None:
        blend_put(puff, x + px, y + 3 - puff.shape[0], alpha)
    put(bg, darken(s, 0.92), x, y)          # leicht ins Dämmerlicht der Mine gesetzt


# Licht (vor den Figuren): Schacht dunkel, Ränder abgedunkelt, Lavasee hell, warmer Widerschein an der Wand
lava_px = bg[LAVA0:].copy()
shade(bg, 0.85)
dark_vignette(bg, strength=0.6, r0=0.3, cy=h2 * 0.35)
bg[LAVA0:] = lava_px
for y in range(LAVA0 - 16, LAVA0):           # zwei gedithert verlaufende Stufen
    t = (y - (LAVA0 - 16)) / 16
    for x in range(w2):
        q = 0.22 if t > 0.5 else 0.11
        if BAY[y % 4, x % 4] < min(1, t * 2 if t <= 0.5 else (t - 0.5) * 2) + 0.001 or t > 0.5:
            bg[y, x, :3] = (bg[y, x, :3] * (1 - q) + np.array((255, 130, 40)) * q).astype(np.uint8)

pA, pB = PUFFS[0], PUFFS[1]
# Gruppe als Dreieck: der Drachenpilot (Cover-Karte) hinten in der Mitte, Miner und Brewer vorn links/rechts
dwarf(pilot, 48, G0 + 11, pA, px=-9)
dwarf(miner, 16, G0 + 16, pB, px=-19)
dwarf(brewer, 85, G0 + 17, pA, px=-18)

# ================================================================== Vordergrund 6× (42×59)
w6, h6 = grid(6)
fg = rgba(w6, h6)
lay = layn.copy()
lay[-1, :, :3] = (lay[-2, :, :3] * 0.45).astype(np.uint8)   # unterste Schattenzeile über die volle Breite
lay[-1, :, 3] = 255
lh, lw = lay.shape[:2]
LY = h6 - lh + 2                              # Brüstung reicht mit ihrer Fußzeile in die Rahmenzone
put(fg, lay, 0, LY)

cv = Canvas(W, H)
blit(cv, bg, 2)
blit(cv, fg, 6)
print(save(cv, '41_rampart_of_deri.png'))
