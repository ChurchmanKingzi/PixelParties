# -*- coding: utf-8 -*-
"""47 Frozen Throne – der coole Eiskönig von Coolhalla thront mit Sonnenbrille auf seinem Thron aus Eiszapfen
auf dem Gletscher; hinter ihm flackert das Nordlicht über dem Eismeer, Schnee treibt vorbei.

Quellen (MotiveCoolhalla.xcf):
  Eiskönig samt Eisthron: Ebene #86 (i142, eine Ebene; gegen Szene „Sichtbar #25“ geprüft – vollständig, dort nur
  der Höhlenhintergrund Ebene #87 dahinter).
  Eisschollen am Horizont: Ebene #2 (i256, Eisfläche) 1×, nachtblau umgefärbt.
  Nachthimmel, Nordlicht, Gletscherkante, Schnee: selbst gezeichnet (Bayer-Dithering, Spielfarben der Eis-Ebenen).

Skalierung: Eiskönig/Thron 4×, Gletscherkante, Schatten und vordere Schneeflocken im 4×-Raster; Nordlicht, Eismeer und Himmel 1× (weit
hinten), mittlere Schneeflocken 2×.
"""
from common import *
from bkit import vgrad, radial
import numpy as np

B = 'MotiveCoolhalla'
W, H = 250, 350
cv = Canvas(W, H)
YY, XX = np.mgrid[0:H, 0:W]

# --- Nachthimmel ----------------------------------------------------------------------------------------
vgrad(cv, [(0, (6, 8, 26)), (0.35, (12, 20, 48)), (0.62, (20, 44, 74)), (0.72, (40, 84, 104))], y0=0, y1=250)
rng = np.random.default_rng(47)
for _ in range(40):
    x, y = rng.integers(1, 249), rng.integers(1, 150)
    cv.a[y, x] = (180, 200, 230) if rng.random() < 0.75 else (240, 250, 255)

# --- kalter Schein hinter dem Thron ---------------------------------------------------------------------------
radial(cv, 125, 190, 130, (36, 70, 112), 0.55, power=1.1)
radial(cv, 125, 190, 90, (60, 104, 146), 0.45, power=1.2)

# --- Nordlicht: ein großer Vorhang aus senkrechten Strahlen (1×, gedithert) ------------------------------------
AUR = [np.array(c) for c in ((26, 80, 84), (40, 150, 116), (90, 220, 160), (180, 255, 214))]
VIO = np.array((90, 60, 130))
def curtain(y0, amp, ph, fr, length, strength):
    for x in range(W):
        base = y0 + amp * np.sin(x * fr + ph) + 5 * np.sin(x * 0.09 + ph * 2)
        ray = 0.6 + 0.4 * np.sin(x * 0.7 + ph) * np.sin(x * 0.19 + 1.3 * ph)       # Strahlstruktur
        for y in range(int(base - length), int(base) + 14):
            if not (0 <= y < 250): continue
            if y <= base:
                t = min(1.0, max(0.0, (y - (base - length)) / length))              # 0 oben .. 1 Unterkante
                v = strength * ray * t ** 1.4
            else:
                v = strength * 0.45 * (1 - (y - base) / 14)                          # Schein unter der Kante
            if v <= BAYER4[y % 4, x % 4] * 0.9 + 0.06: continue
            lvl = min(3, int(v * 3.3)) if y <= base else 0
            c = AUR[lvl]
            if y <= base and t < 0.3: c = VIO                                        # violetter oberer Saum
            cv.a[y, x] = (cv.a[y, x] * 0.3 + c * 0.7).astype(np.uint8)
curtain(118, 26, 0.6, 0.024, 100, 1.1)

# --- Eismeer mit Schollen am Horizont (Ebene #2, 1×) ------------------------------------------------------
HOR = 212
sea = compose(B, [256])
sea = sea[:, 100:100 + W] if sea.shape[1] >= 100 + W else sea
cv.a[HOR:H] = (14, 30, 52)
ice = sea.copy()
c = ice[..., :3].astype(float)
ice[..., :3] = (c * np.array([0.34, 0.42, 0.55]) + np.array([4, 10, 26])).clip(0, 255).astype(np.uint8)
cv.paste(ice, 0, HOR - 10)
# Nordlicht-Schimmer auf dem Wasser
for y in range(HOR + 12, 250, 3):
    for x in range(0, W, 2):
        if (np.sin(x * 0.028 + 0.4) > 0.2) and ((x // 2 + y) % 5 == 0):
            cv.a[y, x:x + 2] = (50, 150, 120)

vignette(cv, 0.45, 0.6)                       # nur Himmel/Meer (1×-Ebene)

# --- Gletscher (4×-Raster wie der Thron): Schneefläche mit Stufenkante -----------------------------------
P = 4
GT = 262
prof = {}
for bx in range(0, W, P):
    k = bx // P
    prof[bx] = GT + P * int(round(1.6 * np.sin(k * 0.37) + 1.2 * np.sin(k * 1.1 + 1) + 1.0))
SNOW = [np.array(c) for c in ((70, 96, 150), (104, 132, 186), (150, 170, 220), (206, 218, 248))]
for bx in range(0, W, P):
    top = prof[bx]
    for by in range(top, H, P):
        dpt = (by - top) // P
        t = (by - top) / (H - GT)                                  # oben hell, nach vorne kräftiger blau
        lvl = 2 if t + (BAYER4[(by // P) % 4, (bx // P) % 4] - 0.5) * 0.5 < 0.45 else 1
        lvl = 3 if dpt == 0 else lvl
        cv.a[by:by + P, bx:bx + P] = SNOW[lvl]

# --- Eiskönig auf dem Thron (5×) --------------------------------------------------------------------------
king = sprite('h47_iceking', B, [142])
K = up(king, 4)
KX, KY = 125 - K.shape[1] // 2, 338 - K.shape[0]
# Schlagschatten auf dem Schnee (4×-Blöcke)
FY = 336
for bx in range(0, W, P):
    for by in range(FY - 8, FY + 8, P):
        if ((bx + 2 - 125) / (K.shape[1] * 0.56)) ** 2 + ((by + 2 - FY) / 9) ** 2 < 1:
            cv.a[by:by + P, bx:bx + P] = SNOW[0]
cv.paste(K, KX, KY)

# --- Schnee: hinten 2×, vorne 5× ---------------------------------------------------------------------------
for _ in range(34):
    x, y = rng.integers(0, W // 2) * 2, rng.integers(0, 250 // 2) * 2
    if cv.a[y, x].mean() < 150: cv.a[y:y + 2, x:x + 2] = (200, 214, 240)
for x, y in ((16, 40), (224, 76), (32, 172), (216, 204), (12, 300), (232, 312), (60, 104), (188, 20)):
    cv.a[y:y + 4, x:x + 4] = (232, 240, 255)

save(cv, '47_frozen_throne.png')
