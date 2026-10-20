"""Gemeinsame Konstanten und Hilfen für die Post-Bausteine."""
import os

import numpy as np

W = 1080
H = int(os.environ.get("PP_CANVAS_H", 1350))      # 1350 = Feed (4:5), 1920 = Reel (9:16)
U = 7                      # Raster (= px je Kartenpixel)
NAVY = (14, 10, 28)
INK = (7, 6, 13)
WHITE = (244, 244, 240)
BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def cell_visible(alpha, cx, cy):
    """Ordered Dithering: Zelle (cx, cy) im globalen Raster sichtbar bei Deckkraft alpha ∈ [0,1]."""
    return alpha > BAYER4[cy & 3, cx & 3]
