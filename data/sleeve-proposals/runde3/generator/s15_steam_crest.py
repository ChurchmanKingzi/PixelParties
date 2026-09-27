# -*- coding: utf-8 -*-
"""Sleeve 15 – Wappen der Dampfzwerge (heraldische Komposition ohne Text), überarbeitet für Runde 3b.

Vor einem Wappenschild (geviert aus Lava und Stollenfels, Goldrand) steht der goldene Dampf-Panzer
des Steam Dwarf Engineer. Schildhalter sind zwei (gespiegelte) Zwergen-Mechaniker, die – wie auf der
Karte – mit dem Schraubenschlüssel an den Beinen des Panzers schrauben. Aus ihren Rückenrohren
steigen Dampfsäulen als Helmdecke neben dem Schild auf. Hinter allem ein Strahlenkranz, der vom
Schild ausgeht, darunter ein Krustenufer über der Lava.

Einheitliche Pixelgröße: ALLES 3× (Panzer, Mechaniker, Dampf, Lava-/Krusten-/Felstexturen,
Schildrand, Strahlen-Dithering). Panzer und Mechaniker stehen nebeneinander ohne Überdeckung – nur der
Schraubenschlüssel greift (wie im Original) an das Panzerbein.

Quellen (MotiveSteamDwarfs.xcf, Karte „Steam Dwarf Engineer“, Szene 400):
  Panzer (Engineer) = Ebene 419;  Mechaniker = Ebenen 417 (Schraubenschlüssel) + 418
  Dampf             = Ebene 415 (Dampfsäule, steigt auch auf der Karte aus dem Mechaniker)
  Lava / Kruste / Fels = Ebenen 444 / 445
Vollständigkeit (Regel B) mit c_util.fig_check gegen Szene 400 geprüft (1101/1113 Pixel, keine
fehlenden Ebenen außer dem Dampf).
"""
from c_util import *

K = 3
cv = Canvas(W, H, (26, 8, 10))

eng = figure('c15_eng', SD, [419])
mech = figure('c15_mech', SD, [417, 418])
steam = sprite('c14_steam1', SD, [415])
lava = tex('c14_lava', SD, 444, (100, 400, 116, 416))
crust = tex('c14_crust', SD, 445, (80, 280, 96, 296))
cliff = tex('c14_cliff', SD, 445, (72, 216, 104, 280))

GROUND = 300                        # Standlinie (Canvas-y)
SCX, STOP, SW, SH = W // 2, 48, 150, 204   # Schild: Mitte, Oberkante, Breite, Höhe
CY = STOP + SH // 2 - 12

# ---------- Strahlenkranz (3×-Raster): 20 Strahlen, glühend zur Mitte hin
C = [(26, 8, 10), (48, 14, 14), (78, 22, 18), (120, 36, 20)]
for y in range(0, H, K):
    for x in range(0, W, K):
        cx, cy = x + K / 2, y + K / 2
        a = math.atan2(cy - CY, cx - SCX)
        r = math.hypot(cx - SCX, cy - CY)
        on = int((a / (2 * math.pi) * 20 + 0.25) % 2) == 0
        t = max(0.0, 1 - r / 260) * (1.0 if on else 0.45)
        i = int(t * 3 + BAYER4[(y // K) % 4, (x // K) % 4] * 0.999)
        cv.rect(x, y, x + K, y + K, C[min(i, 3)])

# ---------- Positionen (native Lage aus der Karte: Mechaniker direkt links am Panzer)
Ew, Eh = eng.shape[1] * K, eng.shape[0] * K
Mw, Mh = mech.shape[1] * K, mech.shape[0] * K
ex, ey = SCX - Ew // 2, GROUND - Eh
ov = 7 * K                                      # Schraubenschlüssel greift 7 Pixel ins Panzerbein
lx, rx = ex - Mw + ov, ex + Ew - ov
my = GROUND - Mh + K

# ---------- Helmdecke: Dampfsäulen aus den Rückenrohren (oberstes Rohr: Spalten 6–9, Zeile 0)
St = up(steam, K)
bot = np.nonzero(steam[-1, :, 3] > 0)[0]
tipc = int(bot.mean())                          # Spalte der Säulenspitze
px = lx + 7 * K - tipc * K - K
py = my + 2 * K - St.shape[0]
cv.paste(St, px, py)
cv.paste(flip(St), W - px - St.shape[1], py)

# ---------- Wappenschild (Heater-Form) auf dem 3×-Raster: Maske in nativen Zellen, Goldrand + Kontur
GOLD_D, GOLD, GOLD_L, EDGE = (136, 96, 32), (216, 172, 72), (250, 226, 130), (26, 20, 6)
import cv2
gw, gh = W // K, H // K
gx, gy = np.meshgrid(np.arange(gw) + 0.5, np.arange(gh) + 0.5)
cxn, topn, hwn, hn = SCX / K, STOP / K, SW / 2 / K, SH / K
u = (gx - cxn) / hwn; v = (gy - topn) / hn
w_ = np.clip((v - 0.45) / 0.55, 0, 1)
field = (v >= 0) & (v <= 1) & (np.abs(u) <= np.sqrt(np.clip(1 - w_ ** 1.7, 0, 1)))
ker = np.ones((3, 3), np.uint8)
rim = cv2.dilate(field.astype(np.uint8), ker) > 0
edge = cv2.dilate(rim.astype(np.uint8), ker) > 0
inner = cv2.erode(field.astype(np.uint8), ker) > 0
cyn = CY / K
L3 = up(np.dstack([darken(np.dstack([lava, np.full(lava.shape[:2], 255, np.uint8)]), 0.85)[..., :3],
                   np.full(lava.shape[:2], 255, np.uint8)]), K)
F3 = up(np.dstack([cliff, np.full(cliff.shape[:2], 255, np.uint8)]), K)
for j in range(gh):
    for i in range(gw):
        x, y = i * K, j * K
        if field[j, i]:
            if not inner[j, i] or abs(i + 0.5 - cxn) < 0.6 or abs(j + 0.5 - cyn) < 0.6:
                cv.rect(x, y, x + K, y + K, GOLD_D)          # Innenkante + Teilungslinien
                continue
            T = L3 if (i + 0.5 < cxn) == (j + 0.5 < cyn) else F3
            ty, tx = y % T.shape[0], x % T.shape[1]
            cv.a[y:y + K, x:x + K] = T[ty:ty + K, tx:tx + K, :3]
        elif rim[j, i]:
            cv.rect(x, y, x + K, y + K, GOLD_L if j + 0.5 < cyn else GOLD)
        elif edge[j, i]:
            cv.rect(x, y, x + K, y + K, EDGE)

# ---------- Krustenufer und Lava
tile_fill(cv, crust, 0, GROUND - 2 * K, W, GROUND + 6 * K, k=K)
cv.rect(0, GROUND - 2 * K, W, GROUND - K, (255, 170, 90))
shade_rows(cv, GROUND - K, GROUND + 6 * K, 0.0, 0.5, (30, 6, 8), k=K)
tile_fill(cv, lava, 0, GROUND + 6 * K, W, H, k=K)
cv.rect(0, GROUND + 6 * K, W, GROUND + 7 * K, (255, 246, 190))
shade_rows(cv, GROUND + 7 * K, H, 0.1, 0.6, (120, 22, 12), k=K)

# ---------- Figuren mit dunkler Kontur (1 Pixel = 3) und Schlagschatten
put(cv, eng, ex, ey + K, K, ol=(20, 8, 6), shadow=(12, 4, 6), sdx=1, sdy=1, salpha=0.6)
put(cv, mech, lx, my, K, ol=(20, 8, 6), shadow=(12, 4, 6), sdx=1, sdy=1, salpha=0.6)
put(cv, mech, rx, my, K, fl=True, ol=(20, 8, 6), shadow=(12, 4, 6), sdx=-1, sdy=1, salpha=0.6)

print(save(cv, '15_steam_crest.png'))
