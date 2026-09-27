# -*- coding: utf-8 -*-
"""06 Djinn's Lamp – Stillleben mit Magie: Aus der Tülle einer goldenen Öllampe steigt Rauch auf, windet sich
nach oben und ballt sich zur Gewitterwolke, aus der Sol Rym, der Donner-Dschinn, mit verschränkten Armen
herauswächst; in der Wolke knistern Blitze. Die Lampe steht auf einem roten Teppich mit Goldbordüre.

Quellen (Motive.xcf):
  Ebene 1509 „Sol Rym“ (Sol Rym, the Thunder Djinn – Halbfigur, wie auf der Karte aus der Wolke ragend)
  Ebene 1146 „Ebene #678“ (goldene Öllampe; Teil der Ebene, Zuckerstange verworfen)
  Ebene 1188 „Thieving #3“ (roter Teppich mit Goldbordüre)
  Wolkenfarben nach Ebene 1519 „Ebene #639“ (Gewitterwolke der Sol-Rym-Karte), Blitzfarben nach 1514 „Chain Lightning“.
Selbst gezeichnet: Hintergrund (Verlauf, Schein, Sterne), Rauchfahne, Wolke, Blitze.

Skalierung:
  Vordergrund (Lampe, Teppich, Rauch, Wolke, Blitze, Dschinn): 6× (Raster 42×59, beschnitten auf 250×350)
  Hintergrund (Nachthimmel-Verlauf, Schein, Sterne): 2× (Raster 125×175)
"""
from common import *  # noqa
import numpy as np, math

M = 'Motive'
yy2, xx2 = np.mgrid[0:175, 0:125]

# ---------------- Hintergrund 2× ----------------
bg = Canvas(125, 175)
cols = [np.array(c) for c in [(10, 8, 26), (18, 14, 44), (26, 22, 64), (20, 16, 48)]]
t = np.clip(yy2 / 174, 0, 1) * (len(cols) - 1)
q = np.floor(t + BAYER4[yy2 % 4, xx2 % 4] * 0.999).clip(0, len(cols) - 1).astype(int)
for k, c in enumerate(cols):
    bg.a[q == k] = c
# Schein hinter dem Dschinn (türkis-blau), geordnet gedithert
d = np.sqrt((xx2 - 62.5) ** 2 + ((yy2 - 52) * 0.85) ** 2)
for r, col in [(58, (30, 40, 92)), (40, (40, 62, 124)), (26, (54, 86, 150))]:
    g = np.clip(1 - (d - r * 0.6) / (r * 0.4), 0, 1)
    m = g > BAYER4[yy2 % 4, xx2 % 4]
    bg.a[m] = col
# Sterne (einzelne Pixel + ein paar Kreuzsterne)
rng = np.random.RandomState(6)
for _ in range(38):
    x, y = rng.randint(4, 121), rng.randint(4, 110)
    if d[y, x] > 50:
        bg.px(x, y, (150, 150, 200) if rng.rand() < 0.7 else (230, 220, 160))
for x, y in [(14, 18), (108, 30), (20, 92), (104, 96)]:
    for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
        bg.px(x + dx, y + dy, (210, 210, 240) if (dx, dy) == (0, 0) else (120, 120, 170))

vignette(bg, 0.5, 0.55)

# ---------------- Vordergrund 6× ----------------
G = 6
FW, FH = 42, 59
fg = np.zeros((FH, FW, 4), np.uint8)


def put(img, x, y):
    """RGBA-Sprite hart (Alpha 0/255) auf das 6×-Raster setzen."""
    h, w = img.shape[:2]
    for j in range(h):
        for i in range(w):
            if img[j, i, 3] >= 128 and 0 <= y + j < FH and 0 <= x + i < FW:
                fg[y + j, x + i] = img[j, i]


def dot(x, y, c):
    if 0 <= x < FW and 0 <= y < FH:
        fg[y, x, :3] = c; fg[y, x, 3] = 255


# Teppich (Thieving #3) – vordere Kante, perspektivisch gestaucht (jede 2. Zeile)
carpet = sprite('b06_carpet', M, [1188])
cp = carpet[::2][:, :]                                   # Stauchung in der Tiefe
cp = cp[-8:]                                            # vorderer Teil mit Bordüre
cp = darken(cp, 0.85)
CY = FH - cp.shape[0]
cx0 = (FW - cp.shape[1]) // 2
for j in range(cp.shape[0]):
    for i in range(FW):
        sx = i - cx0
        if 0 <= sx < cp.shape[1]:
            fg[CY + j, i, :3] = cp[j, sx, :3]; fg[CY + j, i, 3] = 255
# Teppichrand hinten: dunkle Kante
for i in range(FW):
    if fg[CY, i, 3]: fg[CY, i, :3] = (70, 16, 22)

# Lampe
lamp = [p for p in parts(sprite('b06_lamp_layer', M, [1146]), dil=1) if p.shape[:2] == (14, 23)][0]
LX, LY = (FW - 23) // 2 + 1, CY - 14 + 3                # Fuß steht im Teppich
# Schatten der Lampe auf dem Teppich
for i in range(LX + 4, LX + 21):
    for j in (LY + 13, LY + 14):
        if 0 <= j < FH and fg[j, i, 3]:
            fg[j, i, :3] = (fg[j, i, :3] * 0.45).astype(np.uint8)
put(lamp, LX, LY)

# ---------------- Dschinn mit Rauchschweif ----------------
SPX, SPY = LX + 1, LY + 1                                # Tülle der Lampe
djinn = sprite('b06_solrym', M, [1509])
dh = int(np.where(djinn[..., 3].any(1))[0].max()) + 1    # letzte deckende Zeile
CX = FW // 2
DX, DY = CX - 6, 5
WY = DY + dh - 1                                          # Hüfte (unterste Zeile des Dschinns)
put(djinn, DX, DY)

sm_cols = {'out': (40, 40, 86), 'dark': (78, 86, 150), 'base': (116, 130, 196), 'lite': (158, 172, 226),
           'hi': (206, 214, 246)}
tail = np.zeros((FH, FW), bool)
cxs = {}
for y in range(WY, SPY + 1):
    t = (y - WY) / (SPY - WY)                             # 0 an der Hüfte, 1 an der Tülle
    st = t * t * (3 - 2 * t)
    cx = CX + (SPX + 0.5 - CX) * st + 2.4 * math.sin(t * math.pi * 2)
    hw = 5.6 * (1 - t) ** 1.2 + 0.55
    cxs[y] = (cx, hw)
    for x in range(FW):
        if abs(x + 0.5 - cx) <= hw: tail[y, x] = True
# Rundungen/Schattierung des Schweifs: links hell, rechts dunkel, Umriss, schräge Wirbelbänder
for y in range(WY, SPY + 1):
    cx, hw = cxs[y]
    for x in range(FW):
        if not tail[y, x]: continue
        u = (x + 0.5 - cx) / max(hw, 0.6)                 # -1 … 1 über die Breite
        edge = (not tail[y, x - 1] if x > 0 else True) or (not tail[y, x + 1] if x < FW - 1 else True)
        band = ((y - WY) + int(u * 2.5)) % 5 == 0 and hw > 1.6 and abs(u) < 0.8
        if hw < 1.3: c = sm_cols['lite'] if (x + y) % 2 else sm_cols['base']
        elif edge: c = sm_cols['out']
        elif band: c = sm_cols['dark']
        elif u < -0.35: c = sm_cols['lite']
        elif u > 0.45: c = sm_cols['dark']
        else: c = sm_cols['base']
        dot(x, y, c)
    if (y - WY) % 5 == 1 and hw > 1.6:                    # Glanzpunkt links in jedem Wirbel
        dot(int(cx - hw * 0.55), y, sm_cols['hi'])
# Rauchkragen an der Hüfte: runde Bäusche verdecken den geraden Schnitt
for (bx, by, br) in [(-6, 0, 2.0), (-3, 1, 2.3), (0, 1, 2.4), (3, 1, 2.3), (6, 0, 2.0)]:
    x0, y0 = CX + bx, WY + by
    for j in range(int(y0 - br - 1), int(y0 + br + 2)):
        for i in range(int(x0 - br - 1), int(x0 + br + 2)):
            dx, dy = i + 0.5 - x0, j + 0.5 - y0
            dd = math.hypot(dx, dy)
            if dd > br: continue
            if dd > br - 0.8 and dy > -0.2: c = sm_cols['out']
            elif dd > br - 0.9: c = sm_cols['hi'] if dx < 0.5 else sm_cols['lite']
            elif dx + dy < 0: c = sm_cols['lite']
            else: c = sm_cols['base']
            dot(i, j, c)

# Blitze rechts und links des Dschinns (1 Rasterpixel breit)
Y1, Y2 = (255, 248, 160), (236, 220, 80)
bolts = [[(DX - 2, DY + 13), (DX - 5, DY + 12), (DX - 6, DY + 15), (DX - 9, DY + 14), (DX - 10, DY + 18)],
         [(DX + 13, DY + 13), (DX + 16, DY + 12), (DX + 17, DY + 15), (DX + 20, DY + 14), (DX + 21, DY + 18)],
         [(DX - 3, DY + 6), (DX - 5, DY + 4), (DX - 7, DY + 5)],
         [(DX + 14, DY + 6), (DX + 16, DY + 4), (DX + 18, DY + 5)]]
for b in bolts:
    for (x0, y0), (x1, y1) in zip(b, b[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for st in range(n + 1):
            x = round(x0 + (x1 - x0) * st / max(n, 1)); y = round(y0 + (y1 - y0) * st / max(n, 1))
            dot(x, y, Y1)
    dot(b[-1][0], b[-1][1], Y2)

# ---------------- Zusammensetzen ----------------
cv = Canvas(250, 350)
cv.a[:] = up(np.dstack([bg.a, np.full((175, 125), 255, np.uint8)]), 2)[..., :3]
F = up(fg, G)[2:352, 1:251]
cv.paste(F, 0, 0)
print(save(cv, '06_djinns_lamp.png'))
