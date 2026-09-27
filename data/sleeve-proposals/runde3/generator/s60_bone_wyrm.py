# -*- coding: utf-8 -*-
"""60 Bone Wyrm – in der Abenddämmerung bricht der Knochenwurm Bakhm aus einem Sandtrichter der Wüste; der
Abenteurer Iman reißt erschrocken die Arme hoch, Sand spritzt auf.

Quellen (MotiveEgypt.xcf):
  Knochenwurm: „Bakhm #4“ (i41) + Schwanzspitze „Bakhm #1“ (i42) in Leinwandlage zusammengesetzt (gegen Szene
  „Sichtbar #52“ geprüft: dort nur noch Sandtrichter Ebene #96 und Sandboden dahinter).
  Abenteurer: „Iman“ (i23, vollständig laut „Sichtbar #46“).
  Wüstenboden: Sandkachel Ebene #91 (i93, 16×16-Periode), 4×.
  Sandtrichter, Sandspritzer, Dünen und Himmel: selbst gezeichnet in den Farben der Sandkachel (Bayer-Dithering).

Skalierung: Wurm, Abenteurer, Sandboden, Trichter und Spritzer 4× (eine Ebene); ferne Dünen 2×, Himmel 1×.
"""
from common import *
from bkit import vgrad, radial
import numpy as np

B = 'MotiveEgypt'
W, H = 250, 350
cv = Canvas(W, H)
rng = np.random.default_rng(60)
SAND = [np.array(c) for c in ((132, 101, 49), (148, 117, 49), (165, 130, 57), (173, 146, 66), (189, 158, 82))]

# --- Abendhimmel (1×) ------------------------------------------------------------------------------------
vgrad(cv, [(0, (24, 26, 64)), (0.35, (60, 46, 96)), (0.7, (170, 92, 82)), (1, (236, 160, 92))], y0=0, y1=176)
radial(cv, 180, 172, 40, (250, 206, 120), 0.8, power=1.0)          # tief stehende Sonne am Horizont
for _ in range(20):
    x, y = rng.integers(1, 249), rng.integers(1, 60)
    cv.a[y, x] = (200, 200, 230)

# --- ferne Dünen (2×-Raster) --------------------------------------------------------------------------
def dune(base, amp, fr, ph, col, lit):
    for x in range(0, W, 2):
        top = base - 2 * int(round(amp * (0.5 + 0.5 * np.sin(x * fr + ph)) + 1.5 * np.sin(x * 0.07 + ph)))
        cv.a[top:180, x:x + 2] = col
        cv.a[top:top + 2, x:x + 2] = lit
dune(164, 9, 0.021, 0.6, (112, 66, 70), (170, 104, 86))
dune(176, 6, 0.03, 2.2, (138, 88, 66), (196, 132, 86))

# --- Wüstenboden: Sandkachel 4×, nach vorne heller --------------------------------------------------------
K = 4
GY = 180
tile = up(compose(B, [93])[:16, :16, :3], K)
for y in range(GY, H):
    t = (y - GY) / (H - GY)
    row = np.tile(tile[(y - GY) % (16 * K)], (W // (16 * K) + 2, 1))[:W]
    cv.a[y] = (row * (0.62 + 0.38 * t) + np.array([30, 6, 10]) * (1 - t)).clip(0, 255).astype(np.uint8)
cv.a[GY:GY + 2] = (120, 80, 60)

# --- Knochenwurm (4×) und Sandtrichter (4×-Raster) ----------------------------------------------------------
wyrm = sprite('h60_wyrm', B, [41, 42])
Wm = up(wyrm, K)
WX = 8
WYt = 318 - Wm.shape[0]                              # Unterkante des Wurms in der Trichtermitte
CX, CY = WX + 40 * K, 306                            # Trichtermitte unter dem Wurmansatz
RX, RY = 24, 7                                       # Halbachsen in Rasterpixeln
PIT = [SAND[4], SAND[3], np.array((104, 74, 40)), np.array((76, 52, 32)), np.array((54, 36, 24)), np.array((36, 24, 18))]
def pit(front_only=False):
    for gy in range(-RY - 2, RY + 3):
        for gx in range(-RX - 2, RX + 3):
            d = np.sqrt((gx / RX) ** 2 + (gy / RY) ** 2)
            if d > 1.15: continue
            x, y = CX + gx * K, CY + gy * K
            if front_only:
                if gy <= 0 or d < 0.86: continue
                k = 0 if d > 1.0 else 1                                  # vorderer Wall, hell
            else:
                k = 2 + int(np.clip((1.0 - d) / 0.6 * 3 + 0.5 * (BAYER4[gy % 4, gx % 4] - 0.5), 0, 3))   # Trichter
                if d > 1.0: k = 0 if gy < 0 else 1                       # Auswurfwall
            if 0 <= x < W and 0 <= y < H:
                cv.a[y:y + K, x:x + K] = PIT[k]
pit()
cv.paste(Wm, WX, WYt)
pit(front_only=True)                                  # vorderer Wall verdeckt den Wurmansatz

# --- Sandspritzer (4×-Blöcke) ---------------------------------------------------------------------------
for _ in range(40):
    a = rng.uniform(np.pi * 1.08, np.pi * 1.92)
    r = rng.uniform(1.05, 2.0)
    x = int(CX + np.cos(a) * RX * K * r) // K * K
    y = int(CY + np.sin(a) * RY * K * r * 3.2) // K * K
    if 0 <= x < W - K and GY < y < H - K and Wm[min(max(y - WYt, 0), Wm.shape[0] - 1), min(max(x - WX, 0), Wm.shape[1] - 1), 3] == 0:
        cv.a[y:y + K, x:x + K] = SAND[rng.integers(2, 5)]

# --- Abenteurer (4×), links vorne --------------------------------------------------------------------------
iman = up(sprite('h60_iman', B, [23]), K)
IX, IF = 52, 346
for x in range(IX - iman.shape[1] // 2 + K, IX + iman.shape[1] // 2 - K, K):
    y = IF - 2
    cv.a[y:y + K, x:x + K] = (cv.a[y:y + K, x:x + K] * 0.55).astype(np.uint8)
cv.paste(iman, IX - iman.shape[1] // 2, IF - iman.shape[0])

vignette(cv, 0.4, 0.62)
save(cv, '60_bone_wyrm.png')
