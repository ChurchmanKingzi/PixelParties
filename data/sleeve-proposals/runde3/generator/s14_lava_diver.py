# -*- coding: utf-8 -*-
"""Sleeve 14 – Tauchgang im Lavasee (Querschnitt), überarbeitet für Runde 3b.

Querschnitt durch einen Lavasee: oben links steht der Steam Dwarf Brewer mit seinem angezapften
Fass auf einem Krustenvorsprung über der Glut und wartet; unten stapft der Steam Dwarf Diver über
den Seegrund. Aus seinen Helmrohren steigen Dampfblasen durch die Lava nach oben und brechen an der
Oberfläche als Dampfsäulen hervor, die aus dem Bild hinausschießen.

Einheitliche Pixelgröße: ALLES 4× (Figuren, Fass, Dampf, Lava-, Krusten- und Felstexturen,
selbst gezeichnete Blasen) – Querschnitt = eine Bildebene.

Quellen (MotiveSteamDwarfs.xcf):
  Diver   = Ebenen 420 (nur Helm-Teil, Box), 421–424          (Karte „Steam Dwarf Diver“, Szene 402)
  Brewer  = Ebenen 440–442 + liegendes Fass aus Ebene 443     (Karte „Steam Dwarf Brewer“, Szene 15)
  Dampf   = Ebene 414 „STEAM“ (Doppelsäule, untere Hälfte)
  Texturen = Lava + Felsnadeln (Ebene 444), Kruste + Felswand (Ebene 445)
  Blasen  = selbst gezeichnet (Palette aus Lava/Dampf)
Vollständigkeit (Regel B) mit c_util.fig_check gegen die Szenen 402 bzw. 15 geprüft.
"""
from c_util import *

K = 4
cv = Canvas(W, H)

# ---------- Texturen
lava = tex('c14_lava', SD, 444, (100, 400, 116, 416))          # 16×16 Lavakachel
crust = tex('c14_crust', SD, 445, (80, 280, 96, 296))          # 16×16 rote Kruste
cliff = tex('c14_cliff', SD, 445, (72, 216, 104, 280))         # 32×64 dunkle Felswand
sp = np.dstack([tex('c14_spike', SD, 444, (88, 448, 95, 462)), np.zeros((14, 7), np.uint8)])
spc = sp[..., :3].astype(int)
sp[..., 3] = np.where((spc.max(-1) - spc.min(-1)) < 30, 255, 0)
spike = trim(sp)                                                # graue Felsnadel 5×14

SURF = 152                      # Lavaoberfläche
FLOOR = 324                     # Seegrund (Oberkante Kruste)
LT = 140                        # Oberkante des Felsvorsprungs links

# Felswand hinten (über der Lava), nach oben dunkler
tile_fill(cv, cliff, 0, 0, W, SURF, k=K, ox=40)
shade_rows(cv, 0, SURF, 0.75, 0.15, (18, 6, 8), k=K)

# Lavasee im Querschnitt, nach unten dunkler/röter
tile_fill(cv, lava, 0, SURF, W, FLOOR, k=K, oy=2 * K)
shade_rows(cv, SURF + 40, FLOOR, 0.0, 0.75, (170, 40, 16), k=K)
shade_rows(cv, SURF + 120, FLOOR, 0.0, 0.3, (90, 14, 8), k=K)
cv.rect(0, SURF, W, SURF + K, (255, 246, 190))                  # glühende Oberfläche (1 Pixel = 4)

# Seegrund: Kruste
tile_fill(cv, crust, 0, FLOOR, W, H, k=K, oy=K)
shade_rows(cv, FLOOR, H, 0.2, 0.6, (30, 6, 8), k=K)
cv.rect(0, FLOOR, W, FLOOR + K, (255, 200, 110))

# Felsvorsprung links: Überhang auf der Lava, links massiv bis zum Grund (Schnittfläche)
def rock_mask(x, y):
    if y < LT: return False
    if x < 36: return True                       # Felssockel links bis zum Grund
    if x < 44 and y < FLOOR - 40: return True
    return x < 144 and y < SURF + 16 - (x >= 136) * 4
tile_fill(cv, crust, 0, LT, 148, FLOOR, k=K, mask=rock_mask)
for y in range(LT, FLOOR):                       # dunkle Unterkante / Schattenseite
    for x in range(0, 148):
        if rock_mask(x, y) and not rock_mask(x, y + K):
            cv.a[y, x] = (40, 10, 12)
        elif rock_mask(x, y) and not rock_mask(x + K, y) and x > 40:
            cv.a[y, x] = (70, 16, 14)
cv.rect(0, LT, 144, LT + K, (255, 170, 90))     # Glutkante oben

# Felsnadeln auf dem Grund (4×)
for x in (60, 84, 228):
    S = up(spike, K)
    cv.paste(S, x, FLOOR - S.shape[0] + 2 * K)

# ---------- Figuren
diver = figure('c14_diver', SD, [(420, (266, 172, 294, 214)), 421, 422, 423, 424])
brewer = figure('c14_brewer', SD, [440, 441, 442, (443, (271, 467, 289, 483))])
steam = sprite('c14_steam1', SD, [415])                          # Dampfsäule 31×80

# Taucher auf dem Grund
dh, dw = diver.shape[0] * K, diver.shape[1] * K
dx, dy = 124, FLOOR - dh + 2 * K
# Rohröffnungen oben (nativ): Spalten der beiden Rohre im Helm
rows = np.nonzero(diver[..., 3].any(1))[0]
top_cols = np.nonzero(diver[rows[0] + 1, :, 3] > 0)[0]
pipe_l = dx + (top_cols.min() + 1) * K
pipe_r = dx + (top_cols.max() - 1) * K

# Dampfblasen (selbst gezeichnet, 4×): steigen von den Rohren bis zur Oberfläche, werden größer
BUB_O, BUB_M, BUB_L = (150, 40, 20), (236, 226, 214), (255, 255, 250)
def bubble(cx, cy, r):
    """runde Blase mit r nativen Pixeln Radius (1..3), Kontur dunkelrot, Glanzpunkt"""
    shapes = {1: ["oo", "oo"],
              2: [".oo.", "oLMo", "oMMo", ".oo."],
              3: [".ooo.", "oLMMo", "oMMMo", "oMMMo", ".ooo."]}
    pat = shapes[r]
    for j, row in enumerate(pat):
        for i, ch in enumerate(row):
            if ch == '.': continue
            c = BUB_O if ch == 'o' else BUB_L if ch == 'L' else BUB_M
            if r == 1: c = BUB_M
            cv.rect(cx + i * K, cy + j * K, cx + (i + 1) * K, cy + (j + 1) * K, c)
# Blasenkette: (x-Versatz nativ, y) von unten nach oben
chain = [(pipe_r - K, dy - 3 * K, 1), (pipe_r + 2 * K, dy - 6 * K, 1), (pipe_r - 2 * K, dy - 10 * K, 2),
         (pipe_r + 2 * K, dy - 15 * K, 3),
         (pipe_l - 2 * K, dy - 3 * K, 1), (pipe_l - 4 * K, dy - 7 * K, 2), (pipe_l - 2 * K, dy - 12 * K, 2)]
for x, y, r in chain:
    if y > SURF + 2 * K: bubble(x, y, r)

# Dampf bricht an der Oberfläche hervor: untere Hälfte der Doppelsäule, 4×, schießt aus dem Bild
St = up(steam, K)
sx = min(W - St.shape[1] + 4 * K, pipe_r - St.shape[1] // 2)
cv.paste(St, sx, SURF + 2 * K - St.shape[0])
# Aufbrodeln an der Oberfläche (helle Blasenkuppen, 4×)
for i, x in enumerate(range(sx + 6 * K, sx + St.shape[1] - 6 * K, 3 * K)):
    cv.rect(x, SURF - K, x + 2 * K, SURF + K, BUB_M if i % 2 else (255, 246, 190))

put(cv, diver, dx, dy, K, ol=(40, 6, 6))

# Brewer mit liegendem, angezapftem Fass auf dem Vorsprung
bw, bh = brewer.shape[1] * K, brewer.shape[0] * K
bx, by = 4, LT - bh + K
put(cv, brewer, bx, by, K, ol=(30, 8, 8))

print(save(cv, '14_lava_diver.png'))
