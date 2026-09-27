# -*- coding: utf-8 -*-
"""Sleeve 18 – Parade der weißen Armee, überarbeitet für Runde 3b.

Stellin, der ruhige Diktator, nimmt im Vordergrund die Parade ab. Hinter ihm marschieren die
Schneemann-Soldaten der „White Army“ (mit geschulterten Schneekanonen) in zwei Kolonnen vor dem
Eiskristall-Wall heran, in dessen Mitte der leuchtende Eisobelisk aufragt (Aufstellung wie auf der
Karte „The White Army“). Zwei Heli-Trooper kreisen über dem Wall.

Skalierung / Tiefenstaffelung (zwei Ebenen, statt der früheren 1×–4×-Staffelung):
  Vordergrund 6×: Stellin
  Hintergrund 3×: Soldaten, Heli-Trooper, Eiswall mit Obelisk, Schneefeld, Himmel-Dithering
  (Kolonnen mit gestaffelten Standlinien wie auf der Karte; Stellins Standlinie liegt klar davor.)

Quellen (MotiveRussia.xcf):
  Stellin       = Ebene 142 „Ebene #97“ (vollständig, vgl. Ebene 224/225)
  Soldat        = Ebene 224 „Ebene #34“ (Karte „The White Army“, Szene 191): Die Soldaten stehen dort
                  gestapelt und verdecken sich; ein vollständiger Soldat wird aus Kopf des obersten
                  (Zeilen 202–212) und Unterteil des untersten (Zeilen 235–238) zusammengesetzt –
                  die Zwischenzeilen sind bei allen identisch.
  Heli-Trooper  = Ebene 12 „Ebene #170“ (Karte „Mischief Militia - Heli Troopers“)
  Eiswall, Obelisk, Schnee = Ebene 230 „Hintergrund“ (Kulisse von „The White Army“)
"""
from c_util import *
import xcfkit as X

KB, KF = 3, 6
cv = Canvas(W, H)
BG = 230

# ---------- Soldat aus Ebene 224 zusammensetzen
p = os.path.join(X.CACHE, 'c18_soldier.png')
if os.path.exists(os.path.join(X.EXP, RU, 'layers.json')):
    a = X.layer(RU, 224)
    sold = np.concatenate([a[202:213, 262:284], a[235:239, 262:284]], 0).copy()
    sold[..., 3] = np.where(sold[..., 3] >= 128, 255, 0)
    sold = trim(sold)
    Image.fromarray(sold).save(p)
else:
    sold = np.array(Image.open(p).convert('RGBA'))
stellin = figure('c18_stellin', RU, [142])
heli = figure('c18_heli', RU, [12])

# ---------- Kulisse 3×: Eiswall mit Obelisk (Ebene 230), darüber Nachthimmel, darunter Schnee
WX0, WY0, WX1, WY1 = 252, 168, 336, 222              # 84×54 nativ
wall = tex('c18_wall', RU, BG, (WX0, WY0, WX1, WY1))
snowt = tex('c18_snow', RU, BG, (262, 226, 318, 246))   # 56×20 Schneefeld unterhalb des Walls
snowt = np.concatenate([snowt, snowt[:, ::-1]], 1)
wc = wall.astype(int)
is_wall = (wc[..., 2] - wc[..., 0] > 38) | (wc.max(-1) < 120)
# oberhalb der ersten Wallzeile je Spalte: Himmel statt Schneefläche
sky = np.zeros(is_wall.shape, bool)
for x in range(is_wall.shape[1]):
    ys = np.nonzero(is_wall[:, x])[0]
    top = ys.min() if len(ys) else is_wall.shape[0]
    sky[:top, x] = True
TOPY = 24                                             # Canvas-y der Wall-Ausschnitt-Oberkante
tile_fill(cv, snowt, 0, TOPY, W, H, k=KB)
blit(cv, wall, 0, TOPY, KB)
# Himmel: Nachtblau, geordnetes Dithering im 3×-Raster
SK = [(16, 20, 52), (30, 36, 84), (52, 60, 120), (86, 96, 164)]
for y in range(0, TOPY + WY1 * 0 + (WY1 - WY0) * KB, KB):
    for x in range(0, W, KB):
        j, i = (y - TOPY) // KB, x // KB
        if y >= TOPY and not (0 <= j < sky.shape[0] and i < sky.shape[1] and sky[j, i]): continue
        t = y / 110
        q = int(t * 3 + BAYER4[(y // KB) % 4, (x // KB) % 4] * 0.999)
        cv.rect(x, y, x + KB, y + KB, SK[min(q, 3)])

# Heli-Trooper über dem Wall (3×)
for (x, y, fl) in [(14, 6, False), (196, 18, True)]:
    put(cv, heli, x, y, KB, fl=fl, ol=(40, 40, 90))

# ---------- Formation 3×: zwei Marschkolonnen wie auf der Karte (je 4 Soldaten, Reihenabstand
# 11 native Zeilen, der vordere verdeckt den Unterkörper des hinteren), Kanonen nach außen
Sw, Sh = sold.shape[1] * KB, sold.shape[0] * KB
STEP = 11 * KB
FOOT = 252                                            # Standlinie des vordersten Soldaten
for x0, fl in [(2, False), (W - Sw - 2, True)]:
    for r in range(4):                                # von hinten nach vorn
        y = FOOT - Sh - (3 - r) * STEP
        for j in range(2):                            # Schatten im Schnee (3×)
            cv.rect(x0 + 5 * KB, y + Sh - KB + j * KB, x0 + Sw - 5 * KB, y + Sh + j * KB, (184, 184, 226))
        put(cv, sold, x0, y, KB, fl=fl, ol=(60, 56, 100))

# ---------- Stellin 6× im Vordergrund
Tw, Th = stellin.shape[1] * KF, stellin.shape[0] * KF
tx, ty = (W - Tw) // 2, H - Th - 10
for j in range(2):
    cv.rect(tx + 2 * KF, ty + Th - KF // 2 + j * KF // 2 * 2, tx + Tw - 2 * KF, ty + Th + KF // 2 + j * KF // 2 * 2, (176, 176, 220))
put(cv, stellin, tx, ty, KF, ol=(30, 20, 30))

print(save(cv, '18_white_parade.png'))
