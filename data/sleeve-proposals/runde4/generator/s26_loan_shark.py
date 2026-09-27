# -*- coding: utf-8 -*-
"""26 Loan Shark – Spiegelung: Rakah, der Kredithai mit Melone, steht nachts vor dem Vollmond auf einer
Sandbank; sein Spiegelbild im dunklen Wasser ist ein Hai (kopfüber). Links und rechts ziehen
zwei Haiflossen („Land Sharks“) durchs Wasser.

Quellen (MotiveDeepsea.xcf):
  Ebene 51 „Rakah“ + Ebene 52 „Rakah #4“ (Rückenflosse) – Karte „Rakah, the Loan Shark“; gegen „Sichtbar #104“
      (Ebene 37) geprüft: 0 abweichende Pixel.
  Ebene 53 „Rakah #3“ – der Hai derselben Karte (Spiegelbild, 90° gedreht, gespiegelt, abgedunkelt)
  Ebene 50 „Rakah #2“ – Haiflosse („Land Sharks“; die Melone daneben wird nicht verwendet)
Selbst gezeichnet: Himmel, Mond, Meer, Wellenstriche, Mondglitzern, Sandbank.

Skalierung: EIN Raster für alles – 4× (63×88-Raster): Rakah, Hai-Spiegelbild, Flossen, Mond, Wasser.
"""
from s26_30_fkit import *  # noqa

D = 'MotiveDeepsea'
K = 4
E = Ebene(K)                       # 63 × 88
Wd, Hd = E.w, E.h
cx = 31                            # Bildmitte (Raster)
WL = 33                            # Wasserlinie / Füße

# --- Himmel ---------------------------------------------------------------------------------------------
vgrad(E, [(8, 10, 28), (14, 20, 46), (22, 34, 70), (34, 50, 92)], 0, 28)
# Mond hinter Rakah (blassgelb, nicht rot), mit Hof
MX, MY, MR = cx + 0.5, 19, 12
for y in range(0, 28):
    for x in range(Wd):
        d = math.hypot(x + .5 - MX, y + .5 - MY)
        if d < MR:
            # leichte Schattierung: unten-rechts etwas dunkler
            t = ((x - MX) + (y - MY)) / (2 * MR)
            c = (236, 228, 196) if t + B4[y % 4, x % 4] * 0.35 < 0.35 else (214, 204, 170)
            if d > MR - 1.2: c = (200, 190, 158)
            E.a[y, x, :3] = c
        elif d < MR + 5:
            if (MR + 5 - d) / 5 * 0.6 > B4[y % 4, x % 4]:
                E.a[y, x, :3] = mix(E.a[y, x, :3], (90, 100, 128), 0.55)
# ein paar Mondkrater (dunklere Flecken)
for (x, y) in [(26, 12), (27, 12), (35, 10), (38, 21), (39, 21), (22, 22), (36, 25)]:
    E.a[y, x, :3] = (196, 186, 150)
# Sterne
for (x, y) in [(8, 7), (14, 16), (52, 6), (56, 18), (9, 24), (47, 3)]:
    E.a[y, x, :3] = (150, 160, 200)

# --- Meer ------------------------------------------------------------------------------------------------
HOR = 28
vgrad(E, [(30, 46, 86), (22, 36, 72), (16, 28, 58), (12, 20, 44), (8, 14, 32)], HOR, Hd)
E.rect(0, HOR, Wd, HOR + 1, (44, 62, 104))
rng = np.random.RandomState(26)
# Wellenstriche (horizontal, 2–5 Zellen)
for _ in range(60):
    y = rng.randint(HOR + 2, Hd); x = rng.randint(0, Wd)
    L = rng.randint(2, 6)
    col = mix(E.a[y, min(x, Wd - 1), :3], (70, 92, 140), 0.55)
    for i in range(L):
        if 0 <= x + i < Wd: E.a[y, x + i, :3] = col
# Mondglitzern auf der Wasserfläche (unter dem Mond, nach vorn breiter)
for y in range(HOR + 1, Hd):
    t = (y - HOR) / (Hd - HOR)
    hw = 4 + 10 * t
    dens = 0.55 - 0.35 * t
    for x in range(int(cx - hw), int(cx + hw) + 1):
        inR = (cx - 12 <= x <= cx + 13) and (WL + 2 <= y <= WL + 42)   # hier liegt das Spiegelbild (verdeckt)
        if 0 <= x < Wd and (y % 2 == 0) and rng.rand() < dens * (1 - abs(x - cx) / hw) and not inR:
            L = rng.randint(1, 4)
            for i in range(L):
                if 0 <= x + i < Wd: E.a[y, x + i, :3] = (188, 186, 170) if rng.rand() < .4 else (120, 132, 160)

# --- Sandbank, auf der Rakah steht -----------------------------------------------------------------------
sand_hi, sand, sand_lo = (120, 110, 92), (84, 76, 66), (52, 48, 50)
for x in range(cx - 15, cx + 16):
    e = abs(x - cx) / 15
    top = WL - (2 if e < 0.55 else 1 if e < 0.85 else 0)
    for y in range(top, WL + 1):
        E.a[y, x, :3] = sand_hi if y == top else (sand if y < WL else sand_lo)
# Spiegelung der Sandbank (1 Zeile dunkel)
for x in range(cx - 14, cx + 15):
    if (x % 3): E.a[WL + 1, x, :3] = (40, 44, 60)

# --- zwei Flossen („Land Sharks“ ohne Melone) umkreisen das Spiegelbild ------------------------------------------
pair = parts(sprite('f26_landsharks', D, [50]), dil=1)[0]      # 11 × 28: Melone links, Flosse rechts
hat, fin = parts(pair, dil=0)
def wake(x0, y, w):
    for i in range(w):
        if (i % 2 == 0): E.px(x0 + i, y, (96, 116, 160))
FY = 62
E.put(flip(fin), 7, FY, 'bl'); wake(6, FY, 13)
E.put(fin, Wd - 7 - fin.shape[1], FY, 'bl'); wake(Wd - 19, FY, 13)

# --- Spiegelbild: der Hai (kopfüber, Rückenflosse auf Rakahs Flossenseite) -----------------------------------
shark = [p for p in parts(sprite('f26_shark_l53', D, [53]), dil=1) if p.shape[1] == 40][0]
R = flip(rot90(fill_holes(shark), 1))   # Maul unten, Rückenflosse rechts; Kiemen-Löcher geschlossen
R = tint(R, (26, 40, 80), 0.22)
rh, rw = R.shape[:2]
x0, y0 = cx - rw // 2 + 1, WL + 2
# Wellen: jede 4. Zeile um eine Zelle versetzt
for j in range(rh):
    row = R[j:j + 1].copy()
    dx = 1 if j % 4 == 2 else 0
    E.paste(row, x0 + dx, y0 + j)

# --- Rakah --------------------------------------------------------------------------------------------------
rak = sprite('f26_rakah', D, [51, 52])          # 23 × 24, mit Rückenflosse
E.put(rak, cx + 1, WL - 1, 'b')

cv = Canvas(W, H)
onto(cv, E)
print(save(cv, '26_loan_shark.png'))
