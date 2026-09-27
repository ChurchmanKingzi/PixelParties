# -*- coding: utf-8 -*-
"""09 Siren's Song – Querschnitt an der Wasserlinie bei sternklarer Nacht (kein Mond): Die Deepsea-Sirene sitzt
auf einem Felsen und singt, ihre Noten ziehen in einem Bogen zum Schiffbrüchigen, der sich rechts an ein Fass
klammert. Unter der Oberfläche sieht man, was sie verschweigt: Beine und Fass hängen im dunklen Wasser, am
Grund liegen die Gräten früherer Opfer und Wrackplanken.

Quellen:
  MotiveDeepsea.xcf: Ebene 327 „Siren“ + Ebene 325 „Ebene #164“ (dunkelrote Ranken der Sirene, gehören laut
    Szene „Sichtbar #74“ / Karte „Deepsea Siren“ zur Figur), 4×;  Ebene 324 „Ebene #167“ (Noten), 4×;
    Ebene 386 „Ebene #194“ (Fels-Kachel 16×16, kühl getönt), 4×;  Ebene 320 „Skeleton“ (Fischgräten), 4×
  MotiveGrailWar.xcf: Ebene 559 „Doomed Pirate“ (Szene „Sichtbar #34“, vollständig), 4×
  MotiveSteamDwarfs.xcf: Ebene 211 „Shipwrecked“ (Fass + Planken), 4×
  Himmel, Sterne, Wasser: selbst gezeichnet (Himmel 2×-Raster, Wasserlinie/Grund 4×-Raster),
  Farben aus MotiveDeepsea Ebene 391 „Hintergrund“.
Skalierung: Himmel/Sterne und Unterwasser-Verlauf 2×; Felsen, Sirene, Noten, Pirat, Fass, Planken, Gräten,
  Wasserlinie und Grund einheitlich 4×.
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
D = 'MotiveDeepsea'
F = 4
cv = Canvas(W, H)
WL = 180                                  # Wasserlinie (Vielfaches von 4)
rng = np.random.RandomState(5)

# ---------- Himmel (2×) ----------
NW, NH = 125, 175
bg = Canvas(NW, NH)
vgrad(bg, [(0, (6, 10, 30)), (0.4, (18, 40, 90)), (0.78, (48, 86, 140)), (1, (96, 128, 172))], 0, 0, NW, WL // 2)
for _ in range(38):
    x, y = rng.randint(NW), rng.randint(WL // 2 - 14)
    bg.a[y, x] = (200, 215, 240) if rng.rand() < 0.6 else (130, 160, 210)
for (x, y) in ((96, 12), (20, 22), (110, 44), (70, 6)):     # hellere Kreuzsterne
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
        bg.a[y + dy, x + dx] = (230, 240, 255) if (dx, dy) == (0, 0) else (140, 170, 220)
# Unterwasser-Verlauf
vgrad(bg, [(0, (22, 65, 125)), (0.35, (18, 44, 100)), (0.75, (10, 26, 64)), (1, (5, 12, 32))], 0, WL // 2, NW, NH)
# schwache Lichtbahnen unter Wasser
for y in range(WL // 2, NH):
    for x in range(NW):
        u = x - (86 - 0.35 * (y - WL // 2))
        t = max(0, 1 - abs(u) / 5) * max(0, 1 - (y - WL // 2) / 60) * 0.5
        if t > BAYER4[y % 4, x % 4]:
            bg.a[y, x] = np.clip(bg.a[y, x].astype(int) + (18, 26, 32), 0, 255)
cv.a[:] = up(np.dstack([bg.a, np.full((NH, NW), 255, np.uint8)]), 2)[:H, :W, :3]

# ---------- Grund (4×) ----------
GY = 324
for x in range(0, W, F):
    i = x // F
    top = GY + F * int(round(1.5 * math.sin(i / 4.0) + math.sin(i / 1.7)))
    cv.a[top:, x:x + F] = (14, 30, 58)
    cv.a[top:top + F, x:x + F] = (36, 64, 96)

# ---------- Felsen (4×, Kachel aus Ebene #194) ----------
rock = sprite('b09_ds386', D, [386])
rt = rock[40:56, 60:76]
RT = tile_rgb(rt, W // F + 1, H // F + 1)
RT = lum_tint(np.dstack([RT, np.full(RT.shape[:2], 255, np.uint8)]), (14, 16, 38), (150, 146, 190))[..., :3]
# Silhouette je 4er-Spalte: Oberkante (native Zeilen)
prof = {}
for i in range(0, 30):                   # x 0..120
    x = i * F
    if i < 3: top = 26 + i * 3                                        # Felsspitze links
    elif i < 17: top = 36 + int(round(0.8 * math.sin(i / 1.6)))      # Sitzplatte
    elif i < 23: top = 36 + (i - 16) * 2
    else: top = 48 + (i - 23) * 5
    prof[i] = top
for i, top in prof.items():
    for j in range(top, H // F + 1):
        y, x = j * F, i * F
        c = RT[j, i]
        if j == top: c = (140, 130, 170)                                   # Sternenlicht-Kante
        elif i in prof and (i + 1 not in prof or prof.get(i + 1, 99) > j) and j < top + 20: c = (24, 22, 48)
        cv.a[y:y + F, x:x + F] = c

# ---------- Sirene (4×) ----------
sir = sprite('b09_ds325_327', D, [325, 327])
S4 = up(sir, F)
seat = min(prof[i] for i in range(4, 18)) * F
sx = 58 - S4.shape[1] // 2
cv.paste(S4, sx, seat - S4.shape[0] + 3 * F)

# Noten im Bogen vom Mund der Sirene zum Schiffbrüchigen
notes = parts(sprite('b09_ds324', D, [324]), dil=1)
arc = [(100, 74), (130, 44), (162, 34), (194, 50)]
for p, (x, y) in zip(notes[1:5], arc):
    cv.paste(up(p, F), x, y)

# ---------- Wasserlinie + Unterwasser-Tönung ----------
def underwater(y0=WL + F):
    a = cv.a[y0:].astype(float)
    a = a * np.array([0.45, 0.62, 0.9]) + np.array([4, 16, 40])
    cv.a[y0:] = a.clip(0, 255).astype(np.uint8)

# Pirat am Fass (rechts), halb im Wasser
deb = parts(sprite('b09_sd211', 'MotiveSteamDwarfs', [211]), dil=0, minpx=6)
barrel = [p for p in deb if p.shape[0] >= 13 and p.shape[1] >= 12][0]
planks = [p for p in deb if p.shape[0] < 12 and p.shape[1] >= 8]
pir = sprite('b09_gw559', 'MotiveGrailWar', [559])
P4 = up(pir, F); B4 = up(barrel, F)
px, py = 156, WL - 17 * F
bx, by = 126, WL - 9 * F

# Planken und Gräten am Grund (werden mit abgetönt)
fishbone = sprite('b09_ds320', D, [320])
cv.paste(up(flip(fishbone), F), 128, GY - 14 * F)
cv.paste(up(planks[0], F), 20, GY - 5 * F)
cv.paste(up(flip(planks[1]), F), 196, GY - 2 * F)

cv.paste(P4, px, py)
cv.paste(B4, bx, by)
underwater()

# Wasseroberfläche: Wellenlinie im 4×-Raster, Ringe um Pirat und Fass
for x in range(0, W, F):
    i = x // F
    if x < prof.get(i, -1) * 0 + 0: pass
    cv.a[WL:WL + F, x:x + F] = (120, 170, 215) if (i % 5) in (0, 1, 3) else (70, 120, 180)
    if i % 7 == 2: cv.a[WL - F:WL, x:x + F] = (160, 200, 235)
# Fels-Silhouette über Wasserlinie darf nicht überlagert werden -> Felsspalten wieder herstellen
for i, top in prof.items():
    if top * F <= WL:
        cv.a[WL:WL + F, i * F:i * F + F] = (46, 56, 96)
for x in range(bx - F, px + P4.shape[1] + F, F):
    if (x // F) % 2 == 0: cv.a[WL - F:WL, x:x + F] = (190, 220, 245)

vignette_grid(cv, 0.45, 0.6, 2)
print(save(cv, '09_siren_song.png'))
