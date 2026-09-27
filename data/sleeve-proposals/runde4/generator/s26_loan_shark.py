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

Skalierung: EIN Raster für alles – 5× (50×70-Raster): Rakah, Hai-Spiegelbild, Flossen, Mond, Wasser.
Der Hai-Stummel (die 5 obersten Zeilen des gedrehten Hais, abgeschnittenes Schwanzende) liegt unter der Wasserlinie
verborgen, damit Figur und Spiegelbild ausgewogen sind.
"""
from s26_30_fkit import *  # noqa

D = 'MotiveDeepsea'
K = 5
E = Ebene(K)                       # 50 × 70
Wd, Hd = E.w, E.h
cx = 24                            # Bildmitte (Raster)
WL = 30                            # Wasserlinie / Füße

# --- Himmel ---------------------------------------------------------------------------------------------
vgrad(E, [(8, 10, 28), (14, 20, 46), (22, 34, 70), (34, 50, 92)], 0, 26)
# Mond hinter Rakah (blassgelb, nicht rot), mit Hof
MX, MY, MR = cx + 1.0, 16, 13
for y in range(0, 26):
    for x in range(Wd):
        d = math.hypot(x + .5 - MX, y + .5 - MY)
        if d < MR:
            # leichte Schattierung: unten-rechts etwas dunkler
            t = ((x - MX) + (y - MY)) / (2 * MR)
            c = (236, 228, 196) if t + B4[y % 4, x % 4] * 0.35 < 0.35 else (214, 204, 170)
            if d > MR - 1.2: c = (200, 190, 158)
            E.a[y, x, :3] = c
        elif d < MR + 4:
            if (MR + 4 - d) / 4 * 0.6 > B4[y % 4, x % 4]:
                E.a[y, x, :3] = mix(E.a[y, x, :3], (90, 100, 128), 0.55)
# ein paar Mondkrater (dunklere Flecken)
for (x, y) in [(15, 11), (16, 11), (34, 9), (35, 19), (36, 19), (14, 20)]:
    E.a[y, x, :3] = (196, 186, 150)
# Sterne
for (x, y) in [(6, 6), (11, 14), (42, 5), (45, 15), (7, 21), (38, 3)]:
    E.a[y, x, :3] = (150, 160, 200)

# --- Meer ------------------------------------------------------------------------------------------------
HOR = 25
vgrad(E, [(30, 46, 86), (22, 36, 72), (16, 28, 58), (12, 20, 44), (8, 14, 32)], HOR, Hd)
E.rect(0, HOR, Wd, HOR + 1, (44, 62, 104))
rng = np.random.RandomState(26)
# Wellenstriche (horizontal, 2–5 Zellen)
for _ in range(40):
    y = rng.randint(HOR + 2, Hd); x = rng.randint(0, Wd)
    L = rng.randint(2, 6)
    col = mix(E.a[y, min(x, Wd - 1), :3], (70, 92, 140), 0.55)
    for i in range(L):
        if 0 <= x + i < Wd: E.a[y, x + i, :3] = col
# Mondglitzern auf der Wasserfläche (unter dem Mond, nach vorn breiter)
for y in range(HOR + 1, Hd):
    t = (y - HOR) / (Hd - HOR)
    hw = 3 + 8 * t
    dens = 0.55 - 0.35 * t
    for x in range(int(cx - hw), int(cx + hw) + 1):
        inR = (cx - 12 <= x <= cx + 13) and (WL + 1 <= y <= WL + 36)   # hier liegt das Spiegelbild (verdeckt)
        if 0 <= x < Wd and (y % 2 == 0) and rng.rand() < dens * (1 - abs(x - cx) / hw) and not inR:
            L = rng.randint(1, 4)
            for i in range(L):
                if 0 <= x + i < Wd: E.a[y, x + i, :3] = (188, 186, 170) if rng.rand() < .4 else (120, 132, 160)

# --- Sandbank, auf der Rakah steht -----------------------------------------------------------------------
sand_hi, sand, sand_lo = (120, 110, 92), (84, 76, 66), (52, 48, 50)
for x in range(cx - 13, cx + 15):
    e = abs(x - cx - 1) / 14
    top = WL - (2 if e < 0.55 else 1 if e < 0.85 else 0)
    for y in range(top, WL + 1):
        E.a[y, x, :3] = sand_hi if y == top else (sand if y < WL else sand_lo)
# Spiegelung der Sandbank (1 Zeile dunkel)
for x in range(cx - 12, cx + 14):
    if (x % 3): E.a[WL + 1, x, :3] = (40, 44, 60)

# --- zwei Flossen („Land Sharks“ ohne Melone) umkreisen das Spiegelbild ------------------------------------------
pair = parts(sprite('f26_landsharks', D, [50]), dil=1)[0]      # 11 × 28: Melone links, Flosse rechts
hat, fin = parts(pair, dil=0)
def wake(x0, y, w):
    for i in range(w):
        if (i % 2 == 0): E.px(x0 + i, y, (96, 116, 160))
FY = 58
E.put(flip(fin), 4, FY, 'bl'); wake(3, FY, 12)
E.put(fin, Wd - 4 - fin.shape[1], FY, 'bl'); wake(Wd - 15, FY, 12)

# --- Spiegelbild: der Hai (kopfüber, Rückenflosse auf Rakahs Flossenseite) -----------------------------------
shark = [p for p in parts(sprite('f26_shark_l53', D, [53]), dil=1) if p.shape[1] == 40][0]
R = flip(rot90(fill_holes(shark), 1))   # Maul unten, Rückenflosse rechts; Kiemen-Löcher geschlossen
R = R[5:]                                # Schwanzstummel bleibt unter der Wasserlinie verborgen
R = darken(tint(R, (22, 34, 70), 0.25), 0.95)
rh, rw = R.shape[:2]
x0, y0 = cx - rw // 2 + 1, WL + 1
WAVE = [0, 0, 1, 1, 0, 0, -1, -1]         # sanftes Verwellen in ganzen Zellen
for j in range(rh):
    row = R[j:j + 1].copy()
    if j % 6 == 4:                        # dünne, geditherte Wellenlinie quer durchs Spiegelbild
        for i in range(rw):
            if B4[(y0 + j) % 4, (x0 + i) % 4] < 0.5 and row[0, i, 3]:
                row[0, i, :3] = (40, 58, 96)
    E.paste(row, x0 + WAVE[j % 8], y0 + j)

# --- Rakah --------------------------------------------------------------------------------------------------
rak = sprite('f26_rakah', D, [51, 52])          # 23 × 24, mit Rückenflosse
E.put(rak, cx + 1, WL - 1, 'b')

cv = Canvas(W, H)
onto(cv, E)
print(save(cv, '26_loan_shark.png'))
