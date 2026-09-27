# -*- coding: utf-8 -*-
"""Sleeve: Ermittlungswand von Great Detective Doq – Fotos der Verdächtigen, verbunden mit rotem Faden
(Farben des Crimson-Skull-Spider-Fadens), Doqs Lupe vergrößert einen Ausschnitt.
Fotos, Ziegelwand und Lupe stammen pixelgenau aus den „Sichtbar“-Szenen bzw. Ebenen der xcf-Dateien
(Repo PixelPartiesSprites); die Szenen wurden per Bildabgleich mit den Kartenbildern gefunden."""
import numpy as np
from kit import *
from xcfkit import scene_sprite, sprite, part_at

# Karte -> (xcf-Datei, Szenen-Ebene, linke obere Ecke des Kartenbilds in der Szene)
SCENES = {
    'Great Detective Doq': ('Motive', 109, (100, 160)),
    'Kaito Sid the Phantom Thief': ('Motive', 849, (259, 98)),
    'Rakah the Loan Shark': ('MotiveDeepsea', 46, (204, 156)),
    'Devlin the Masked Butcher': ('MotiveGrailWar', 182, (207, 148)),
    'Criminal Monkee': ('MotiveIndia', 26, (122, 366)),
    'Black Marketeer': ('MotiveMoe', 590, (166, 277)),
}
def scene(card, box, key):
    b, s, loc = SCENES[card]
    return scene_sprite(key, b, s, loc, box)

cv = Canvas(W, H)
tile = scene('Great Detective Doq', (14, 2, 30, 10), 'mo_doq_wall')[..., :3]
T2 = up(np.dstack([tile, np.full(tile.shape[:2], 255, np.uint8)]), 2)
fill_tiles(cv, hsv_shift(T2, 0, 0.9, 0.78))
vignette(cv, 0.55, 0.35)

PAPER = (236, 230, 214); PAPER_S = (190, 180, 160); INK = (40, 30, 30)
photos = [  # (Karte, Ausschnitt, Position, Beschriftung)
    ('Kaito Sid the Phantom Thief', (24, 2, 64, 36), (14, 14), 'photo_kaito'),
    ('Rakah the Loan Shark', (12, 8, 58, 40), (140, 34), 'photo_rakah'),
    ('Devlin the Masked Butcher', (24, 3, 68, 35), (10, 140), 'photo_devlin'),
    ('Criminal Monkee', (8, 9, 52, 43), (142, 152), 'photo_monkee'),
    ('Black Marketeer', (16, 10, 56, 44), (62, 250), 'photo_marketeer'),
]
boxes = []
for n, b, (px, py), key in photos:
    img = up(scene(n, b, key), 2)
    h, w = img.shape[:2]
    fw, fh = w + 8, h + 16
    cv.paste(silhouette(np.full((fh, fw, 4), 255, np.uint8), (0, 0, 0)), px + 3, py + 3, alpha=0.45)
    cv.rect(px, py, px + fw, py + fh, PAPER)
    cv.rect(px, py + fh - 1, px + fw, py + fh, PAPER_S); cv.rect(px + fw - 1, py, px + fw, py + fh, PAPER_S)
    cv.paste(img, px + 4, py + 4)
    boxes.append((px, py, fw, fh))

# rote Fäden zwischen Nadeln (Fadenfarben aus Crimson Skull Spider)
TH = [(149, 5, 3), (112, 2, 0)]
pins = [(x + w // 2, y + 3) for (x, y, w, h) in boxes]
def line(p, q):
    (x0, y0), (x1, y1) = p, q
    n = int(max(abs(x1 - x0), abs(y1 - y0)))
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        cv.rect(x, y, x + 2, y + 2, TH[(i // 3) % 2])
for a, b in [(0, 1), (0, 2), (1, 3), (2, 3), (2, 4), (3, 4), (0, 3)]:
    line(pins[a], pins[b])
# Nadeln: roter Kopf (Farben aus dem Faden) mit Glanzpunkt
for (x, y) in pins:
    cv.rect(x - 3, y - 3, x + 4, y + 4, (60, 0, 0)); cv.rect(x - 2, y - 2, x + 3, y + 3, (190, 20, 10)); cv.px(x - 1, y - 1, (255, 170, 150))

# Doqs Lupe (Ebene „Doq“ aus Motive.xcf): Ring aus der linken, unverdeckten Hälfte gespiegelt ergänzt, Griff original
doq = part_at(sprite('mo_doq_layer', 'Motive', [1437]), 8, 10).astype(int)
r_, g_, b_ = doq[..., 0], doq[..., 1], doq[..., 2]
yy, xx = np.mgrid[:doq.shape[0], :doq.shape[1]]
ringm = (b_ > r_ + 30) & (b_ > g_) & (doq[..., 3] > 0) & (xx <= 6) & (yy <= 16)
ringm[:, :7] |= ringm[:, :7]                                   # linke Hälfte (Spalten 0–6)
ringm = ringm | np.pad(ringm[:, :6][:, ::-1], ((0, 0), (7, doq.shape[1] - 13)))[:, :doq.shape[1]]
ringm &= ((xx - 6) ** 2 + (yy - 9.5) ** 2) > 4.2 ** 2        # Glasinneres frei lassen
band = (np.abs(xx - yy + 1) <= 2) & (xx >= 12) & (yy >= 14)
handm = band & (((b_ > r_ + 20) | (doq[..., :3].min(-1) > 150)) & (doq[..., 3] > 0))
full = np.zeros(doq.shape, np.uint8); full[..., :3] = doq[..., :3]; full[..., 3] = (ringm | handm) * 255
# Griff dort, wo Doqs Hand ihn verdeckt, mit dem sichtbaren Griffstück (4 px weiter unten) ergänzen
for y in range(18, 13, -1):
    for x in range(11, doq.shape[1] - 4):
        if not full[y, x, 3] and y + 4 < doq.shape[0] and full[y + 4, x + 4, 3] and x - y >= -3:
            full[y, x] = full[y + 4, x + 4]
_n, _lab, _st, _ = cv2.connectedComponentsWithStats((full[..., 3] > 0).astype(np.uint8), connectivity=8)
full[..., 3] = (_lab == 1 + int(np.argmax(_st[1:, cv2.CC_STAT_AREA]))) * 255
K = 5
R = up(full, K)
ys, xs = np.where(full[:15, :15, 3] > 0)
rcx, rcy = (xs.min() + xs.max() + 1) / 2, (ys.min() + ys.max() + 1) / 2
cxl, cyl = 200, 194          # maskiertes Monkee-Gesicht
mx, my = int(cxl - rcx * K), int(cyl - rcy * K)
# Linse: vergrößerter Ausschnitt (2×) dessen, was darunter liegt, leicht aufgehellt
rad = int((xs.max() - xs.min() + 1) / 2 * K) - K
src = cv.a.copy()
for y in range(cyl - rad, cyl + rad):
    for x in range(cxl - rad, cxl + rad):
        if (x - cxl) ** 2 + (y - cyl) ** 2 < rad * rad:
            sx = cxl + (x - cxl) // 2; sy = cyl + (y - cyl) // 2
            c = src[sy, sx].astype(int)
            cv.a[y, x] = np.clip(c * 0.85 + np.array([200, 225, 255]) * 0.15, 0, 255).astype(np.uint8)
cv.paste(silhouette(R, (0, 0, 0)), mx + 3, my + 3, alpha=0.45)
cv.paste(R, mx, my)

for i, c in enumerate([(30, 20, 15), (120, 90, 50), (170, 140, 90), (30, 20, 15)]):
    cv.a[i, :] = c; cv.a[-1 - i, :] = c; cv.a[:, i] = c; cv.a[:, -1 - i] = c
print(save(cv, '08_detective_board.png'))
