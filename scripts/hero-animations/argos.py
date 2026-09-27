# -*- coding: utf-8 -*-
"""Idle-Animation für Argos, the Eye of the Cosmos (MotiveBoons.xcf, Ebene
„Argos“, Pupille schwarz gefüllt).

Der Körper ist neu entworfen: eine schwarze, wabernde Schattenwolke wie ein
Lovecraft-Wesen, das Auge sitzt in ihrer Mitte.
* Die Wolke ist ein Feld aus einem pulsierenden Kern (Rand wogt über
  überlagerte Sinuswellen) und sieben langen, tentakelartigen Pseudopoden,
  die sich schlängeln, dabei länger und kürzer werden und spitz zulaufen.
* Zwei Töne: fast schwarzer, dichter Kern, halbtransparenter violett-
  schwarzer Rand; von den Tentakelspitzen lösen sich Schattenfetzen.
* Das Auge schwebt mit dem Kern leicht auf und ab.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import save_outputs

EYE = np.array(Image.open('src/argos-the-eye-of-the-cosmos.png').convert('RGBA')).astype(int)
EH, EW = EYE.shape[:2]
W, H = 134, 172
CX, CY = W / 2, H / 2
N = 48
CORE, RIM = (7, 5, 12, 235), (30, 16, 42, 165)
# Tentakel: (Winkel in Grad, Länge, Wurzelradius, Phase)
TENTACLES = [(-150, 36, 6.0, 0.0), (-100, 30, 5.2, 1.3), (-40, 38, 6.0, 2.6), (10, 42, 6.4, 3.9),
             (65, 36, 5.8, 5.1), (120, 42, 6.4, 0.7), (175, 34, 5.6, 2.0)]
CORE_R = 21.0                                        # Kernradius waagrecht (senkrecht x1,5)


def body_field(i):
    """Boolesche Maske der Wolke und Abstand zum Rand (für den Randton)."""
    p = 2 * math.pi * i / N
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    dx, dy = xx + 0.5 - CX, yy + 0.5 - CY - 1.2 * math.sin(p)
    ang = np.arctan2(dy / 1.5, dx)
    r = np.hypot(dx, dy / 1.5)
    edge = CORE_R + 1.8 * np.sin(3 * ang + p) + 1.1 * np.sin(5 * ang - 2 * p) + 0.8 * np.sin(8 * ang + 3 * p)
    field = edge - r                                  # > 0 = innen
    for a0, L, r0, ph in TENTACLES:
        a = math.radians(a0) + 0.18 * math.sin(p + ph)
        length = L * (0.85 + 0.15 * math.sin(p * 2 + ph))
        steps = 40
        pts = []
        for k in range(steps + 1):
            s = k / steps
            base = CORE_R - 3 + s * length            # vom Kernrand aus
            wob = 4.2 * s * math.sin(3.5 * s * math.pi - 2 * p - ph)
            nx, ny = -math.sin(a), math.cos(a)
            x = CX + math.cos(a) * base + nx * wob
            y = CY + (math.sin(a) * base + ny * wob) * 1.35 + 1.2 * math.sin(p)
            rad = max(0.6, r0 * (1 - s) ** 0.8)
            pts.append((x, y, rad))
        for x, y, rad in pts:
            d = rad - np.hypot(xx + 0.5 - x, yy + 0.5 - y)
            field = np.maximum(field, d)
    return field


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def frame(i):
    f = body_field(i)
    out = np.zeros((H, W, 4), int)
    out[f > 0] = RIM
    out[f > 1.0] = CORE
    # Schattenfetzen lösen sich von den Tentakelspitzen
    p = 2 * math.pi * i / N
    for k, (a0, L, r0, ph) in enumerate(TENTACLES):
        t = (i + k * 7) % 16
        if t >= 10:
            continue
        a = math.radians(a0) + 0.18 * math.sin(p + ph)
        dist = CORE_R - 3 + L * 0.95 + t * 0.7
        x = int(round(CX + math.cos(a) * dist))
        y = int(round(CY + math.sin(a) * dist * 1.35 - t * 0.3))
        for ddx, ddy in ((0, 0), (1, 0), (0, 1)) if t < 5 else ((0, 0),):
            xx, yy = x + ddx, y + ddy
            if 1 <= xx < W - 1 and 1 <= yy < H - 1 and out[yy, xx, 3] == 0:
                out[yy, xx] = (*RIM[:3], 150 - t * 12)
    # Auge in der Mitte
    oy = int(round(CY - EH / 2 + 1.2 * math.sin(p)))
    ox = int(round(CX - EW / 2))
    m = EYE[:, :, 3] > 0
    out[oy:oy + EH, ox:ox + EW][m] = EYE[m]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'argos_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=4,
                 check_edges=True)
