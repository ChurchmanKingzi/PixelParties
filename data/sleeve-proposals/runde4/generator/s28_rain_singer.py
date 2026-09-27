# -*- coding: utf-8 -*-
"""28 Rain Singer – Wetter: Tempeste Moana steht in der Dämmerung auf einem Lavafelsen an der Küste und singt;
draußen auf dem Meer dreht sich unter der Gewitterwolke eine Wasserhose aus dem Regenvorhang.

Quellen (MotiveHawaii.xcf):
  Ebene 189 „Tempeste Moana“ – Karte „Tempeste Moana, the Rain Singer“ (vollständige Figur, singend)
  Ebene 57  „Ebene #121“ – dunkler Lavafelsen (oberer Teil, flache Kuppe als Standfläche)
  Ebene 174 „Ebene #158“ – Wirbelsturm / Wasserhose
  Ebene 158 „Ebene #40“  – Regenstriche (gekachelt, umgefärbt)
Selbst gezeichnet: Himmel, Gewitterwolke, Dämmerungsstreif, Meer, Gischt am Fuß der Wasserhose.

Skalierung:
  Hintergrund (Himmel, Wolken, Meer, Wasserhose, Regen): 3× (84×117-Raster)
  Vordergrund (Moana + Lavafelsen): 5× (50×70-Raster) – steht klar vorn.
"""
from s26_30_fkit import *  # noqa

HW = 'MotiveHawaii'

# ================================ Hintergrund 3× ================================================================
G = Ebene(3)                                    # 84 × 117
gw, gh = G.w, G.h
HOR = 76                                        # Horizont (Raster)

# Himmel: oben Sturmblau, zum Horizont warmes Dämmerungslicht (links stärker)
sky = [(22, 26, 48), (34, 38, 66), (52, 50, 80), (86, 64, 92), (140, 84, 96), (198, 116, 92), (236, 160, 104)]
for y in range(HOR):
    for x in range(gw):
        t = (y / HOR) ** 1.5 * (len(sky) - 1)
        t -= 0.8 * (x / gw) * (y / HOR)            # rechts (unter dem Sturm) dunkler
        i = int(min(len(sky) - 1, max(0, math.floor(t + B4[y % 4, x % 4] * 0.999))))
        G.a[y, x, :3] = sky[i]; G.a[y, x, 3] = 255

# Meer
sea = [(58, 60, 92), (40, 48, 80), (28, 38, 66), (20, 30, 54)]
vgrad(G, sea, HOR, gh)
G.rect(0, HOR, gw, HOR + 1, (120, 96, 110))
rng = np.random.RandomState(28)
for _ in range(120):
    y = rng.randint(HOR + 1, gh); x = rng.randint(0, gw)
    warm = x < 40 and rng.rand() < 0.7
    col = (214, 140, 108) if warm and y < HOR + 14 else (96, 110, 146)
    for i in range(rng.randint(2, 5)):
        if 0 <= x + i < gw: G.a[y, x + i, :3] = col

# Wasserhose (rechts, von der Wolke bis aufs Meer)
tor = sprite('f28_tornado', HW, [174])          # 46 × 32
th, tw = tor.shape[:2]
TX = 47
TY = HOR - th + 1
# Gischt am Fuß (selbst gezeichnet): Kuppel mit unregelmäßiger, nach oben ausfransender Oberkante
gcx = TX + tw * 0.45
gr = np.random.RandomState(3)
for xx in range(int(gcx - 11), int(gcx + 12)):
    e = 1 - ((xx + .5 - gcx) / 11) ** 2
    if e <= 0: continue
    hgt = 11 * e ** 0.7 * (0.7 + 0.3 * gr.rand())
    for yy in range(int(HOR - hgt), HOR + 2):
        t = (HOR + 1 - yy) / max(1, hgt)          # 0 unten … 1 oben
        dens = 1.0 if t < 0.35 else (1 - t) * 1.3
        if dens > B4[yy % 4, xx % 4]:
            G.px(xx, yy, (186, 196, 212) if t < 0.3 else ((150, 162, 186) if t < 0.65 else (118, 130, 160)))
G.paste(tint(tor, (60, 64, 90), 0.18), TX, TY)

# Gewitterwolke (nach der Wasserhose gezeichnet, damit deren Trichter in der Wolke verschwindet):
# Unterkante aus hängenden Wolkenballen, über der Wasserhose eine tiefer hängende Wallwolke;
# Schattierung nach Abstand zur Unterkante, Rand links vom Dämmerlicht angestrahlt.
rs = np.random.RandomState(7)
lobes = []
x = -3.0
while x < gw + 6:
    r = 4 + rs.rand() * 3.5
    lobes.append((x, 24 + (x / gw) * 8 + rs.rand() * 2, r)); x += r * 1.25
lobes.append((TX + tw * 0.5, TY + 3, 13))                  # Wallwolke über dem Trichter
base = np.zeros(gw)
for xx in range(gw):
    b = 18 + (xx / gw) * 8
    for (lx, ly, r) in lobes:
        dx = xx + .5 - lx
        if abs(dx) < r: b = max(b, ly + math.sqrt(r * r - dx * dx) * 0.8)
    base[xx] = b
cl_dark, cl_mid, cl_lo = (18, 20, 34), (32, 34, 52), (50, 50, 72)
for xx in range(gw):
    rim = mix((164, 104, 106), (84, 82, 104), min(1, xx / 50))
    for yy in range(0, int(base[xx]) + 1):
        d = base[xx] - yy
        if d < 1.2: c = rim
        elif d < 3 + B4[yy % 4, xx % 4] * 1.5: c = cl_lo
        elif d < 7 + B4[yy % 4, xx % 4] * 3: c = cl_mid
        else: c = cl_dark
        G.a[yy, xx, :3] = c
# einzelne hellere Ballenkanten im Wolkeninneren
for (lx, ly, r) in lobes[:-1]:
    for a in np.linspace(3.5, 5.4, 10):
        X, Y = int(lx + math.cos(a) * r), int(ly - 6 + math.sin(a) * r)
        if 0 <= X < gw and 0 <= Y < gh and Y < base[X] - 3: G.a[Y, X, :3] = cl_lo

# Regen: Striche aus Ebene 158, gekachelt, rechts dicht, links spärlich
rain = sprite('f28_rain158', HW, [158])
ry, rx = np.where(rain[..., 3] > 0)
for oy in range(-rain.shape[0], gh, rain.shape[0]):
    for ox in range(0, gw, rain.shape[1]):
        for y, x in zip(ry, rx):
            X, Y = ox + x, oy + y
            if not (0 <= X < gw and 0 <= Y < gh): continue
            if Y < 30: continue                                    # erst unter der Wolkenkante
            dens = 0.25 + 0.75 * (X / gw)
            if (hash((X // 1, (Y - y) // 7)) % 100) / 100 > dens: continue
            G.a[Y, X, :3] = mix(G.a[Y, X, :3], (170, 190, 220), 0.55)

cv = Canvas(W, H)
onto(cv, G)

# ================================ Vordergrund 5× =================================================================
F = Ebene(5)                                    # 50 × 70
rock = sprite('f28_rock121', HW, [57])          # 66 × 61, flache Kuppe in Spalten 12–34, Zeilen 0–3
RTOP = 59                                       # Oberkante der Kuppe
RX = -7
rk = rock.copy()
# Kuppe vom Dämmerlicht links angestrahlt (Oberkante eine Stufe heller)
for x in range(rk.shape[1]):
    col = rk[:, x, 3] > 0
    if col.any():
        y0 = int(np.argmax(col))
        rk[y0, x, :3] = (96, 80, 84) if x < 36 else (70, 66, 76)
F.paste(rk, RX, RTOP)
moana = sprite('f28_moana189', HW, [189])       # 25 × 20
MX = RX + 23                                    # Mitte der Kuppe
F.put(moana, MX, RTOP + 1, 'b')
onto(cv, F)

print(save(cv, '28_rain_singer.png'))
