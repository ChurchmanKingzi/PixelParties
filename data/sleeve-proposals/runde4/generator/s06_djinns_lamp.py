# -*- coding: utf-8 -*-
"""06 Djinn's Lamp – Stillleben mit Magie: Aus der Tülle einer goldenen Öllampe steigt Rauch auf, windet sich
nach oben und wird zum Leib von Sol Rym, dem Donner-Dschinn, der mit verschränkten Armen darüber schwebt; von
seinen Ellbogen zucken verästelte Blitze. Die Lampe steht auf einem roten Teppich mit Goldbordüre und Falten.

Quellen (Motive.xcf):
  Ebene 1509 „Sol Rym“ (Sol Rym, the Thunder Djinn – Halbfigur, wie auf der Karte aus der Wolke ragend)
  Ebene 1146 „Ebene #678“ (goldene Öllampe; Teil der Ebene, Zuckerstange verworfen)
  Ebene 1188 „Thieving #3“ (roter Teppich mit Goldbordüre)
  Blitzfarben nach Ebene 1514 „Chain Lightning“.
Selbst gezeichnet: Hintergrund (Verlauf, Schein, Sterne, Dielenboden), Rauchschweif, Blitze, Faltenwurf.

Skalierung:
  Vordergrund (Lampe, Teppich, Rauchschweif, Blitze, Dschinn): 6× (Raster 42×59, beschnitten auf 250×350)
  Hintergrund (Nachthimmel-Verlauf, Schein, Sterne, Dielenboden): 2× (Raster 125×175)
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

# Boden (dunkle Dielen) unter dem Teppich
FLY = 132
for y in range(FLY, 175):
    for x in range(125):
        c = (34, 24, 30) if (y - FLY) % 5 else (22, 14, 20)
        if (y - FLY) % 5 and (x + (y - FLY) // 5 * 11) % 23 == 0: c = (22, 14, 20)
        bg.a[y, x] = c
bg.a[FLY] = (52, 38, 48)
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


# Teppich (Thieving #3) – Texel 1:1 auf dem 6×-Raster, per 9-Slice auf Teppichgröße gebracht: Goldbordüre
# (hinten verkürzt = Perspektive), Mittelfeld gekachelt; jede Zeile hinten etwas schmaler (Trapez);
# sanfter Faltenwurf als zwei flache Wellen hell/dunkel.
carpet = sprite('b06_carpet', M, [1188])                 # 60×55
CH, CW = carpet.shape[:2]
rows = [1, 2, 4] + [20, 21, 22] + [CH - 6, CH - 5, CH - 4, CH - 3, CH - 2, CH - 1]   # hinten, Mitte, vorne
CY0 = 44
CY1 = CY0 + len(rows) - 1
W0, W1 = 32, 38
CXM = FW // 2
for jj, v in enumerate(rows):
    t = jj / (len(rows) - 1)
    w = int(round(W0 + (W1 - W0) * t))
    left = CXM - w // 2
    src = carpet[v, :, :3]
    line = np.concatenate([src[:6], np.array([src[6 + (k % 12)] for k in range(w - 12)]), src[-6:]])
    for k in range(w):
        c = line[k].astype(float)
        f = math.sin((k / w) * 7.5 - t * 1.6)
        c *= (1.10 if f > 0.8 else (0.80 if f < -0.8 else 1.0)) * (0.62 + 0.18 * t)   # nachts, hinten dunkler
        dot(left + k, CY0 + jj, tuple(np.clip(c, 0, 255).astype(np.uint8)))
# Schlagschatten des Teppichs auf den Dielen (1 Zeile unter der Vorderkante)
for k in range(W1):
    dot(CXM - W1 // 2 + k, CY1 + 1, (14, 8, 12))

# Lampe
lamp = [p for p in parts(sprite('b06_lamp_layer', M, [1146]), dil=1) if p.shape[:2] == (14, 23)][0]
LX, LY = (FW - 23) // 2 + 1, CY0 + 6 - 14               # Fuß steht mitten auf dem Teppich
# Schatten der Lampe auf dem Teppich
for i in range(LX + 7, LX + 19):
    for j in (LY + 14,):
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

# Blitze: verästelt, von den Ellbogen des Dschinns ausgehend, spiegelsymmetrisch.
# Heller Kern (1 Rasterpixel) + goldener Rand rechts/unten, Äste nur mit Kern.
CORE, RIM = (255, 252, 214), (232, 190, 44)
ax = 2 * DX + 11                                          # Spiegelachse ×2 (Dschinn-Mitte)
main = [(DX, DY + 15), (DX - 3, DY + 13), (DX - 4, DY + 10), (DX - 7, DY + 8), (DX - 8, DY + 4)]
branch = [(DX - 4, DY + 10), (DX - 7, DY + 12), (DX - 9, DY + 11), (DX - 10, DY + 14)]
twig = [(DX - 7, DY + 8), (DX - 10, DY + 7)]


def seg_pixels(path):
    out = []
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for st in range(n + 1):
            out.append((round(x0 + (x1 - x0) * st / max(n, 1)), round(y0 + (y1 - y0) * st / max(n, 1))))
    return out


for side in (0, 1):
    mir = (lambda p: [(ax - x, y) for x, y in p]) if side else (lambda p: p)
    core = seg_pixels(mir(main))
    thin = seg_pixels(mir(branch)) + seg_pixels(mir(twig))
    cs = set(core) | set(thin)
    for x, y in core:                                     # Rand zuerst (unten und zur Außenseite)
        for dx, dy in [(0, 1), (-1, 0) if side == 0 else (1, 0)]:
            if (x + dx, y + dy) not in cs and not (DX <= x + dx < DX + 12 and fg[y + dy, x + dx, 3]):
                dot(x + dx, y + dy, RIM)
    for x, y in core + thin:
        dot(x, y, CORE)
    ex, ey = mir(main)[-1]                                # Funken an den Spitzen
    dot(ex, ey - 1, RIM)
    bx, by = mir(branch)[-1]
    dot(bx, by + 1, RIM)

# ---------------- Zusammensetzen ----------------
cv = Canvas(250, 350)
cv.a[:] = up(np.dstack([bg.a, np.full((175, 125), 255, np.uint8)]), 2)[..., :3]
F = up(fg, G)[2:352, 1:251]
cv.paste(F, 0, 0)
print(save(cv, '06_djinns_lamp.png'))
