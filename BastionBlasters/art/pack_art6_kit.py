"""pack_art6 Werkzeug: kleine Zeichenhelfer, die von den Sprites und Dioramen des Packs geteilt werden."""
from __future__ import annotations

from cards_art import *


def dither(c, x0, y0, x1, y1, ramp, a, b, phase=0):
    """Rechteck mit Schachbrett aus zwei Rampentönen"""
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            c.put_ramp(x, y, ramp, a if (x + y + phase) % 2 == 0 else b)


def robe(c, cx, y0, y1, w0, w1, ramp, lo=1, hi=4, lean=0.0, hem=True):
    """Gewand als Trapez (Licht von links), w0/w1 = halbe Breite oben/unten, lean verschiebt unten"""
    for y in range(int(y0), int(y1) + 1):
        t = (y - y0) / max(1, (y1 - y0))
        half = w0 + (w1 - w0) * t
        mid = cx + lean * t
        left, right = int(round(mid - half)), int(round(mid + half))
        for x in range(left, right + 1):
            u = (x - left) / max(1, (right - left))
            L = 0.98 - 0.78 * u - 0.12 * t
            idx = quant(L, lo, hi, x, y)
            if x == right:
                idx = lo
            c.put_ramp(x, y, ramp, idx)
        if hem and y == y1:
            for x in range(left, right + 1):
                c.put_ramp(x, y, ramp, max(0, lo - 1) if x % 2 else lo)


def ring(c, cx, cy, rx, ry, th, ramp, lo=2, hi=5, ang=0.0):
    """schattierter Ring (Heiligenschein), ang in Grad, th = Dicke relativ (0..1) zum Radius"""
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    R = int(max(rx, ry)) + 2
    inner = 1.0 - th
    for y in range(int(cy) - R, int(cy) + R + 1):
        for x in range(int(cx) - R, int(cx) + R + 1):
            qx, qy = x + 0.5 - cx, y + 0.5 - cy
            u = qx * ca + qy * sa
            v = -qx * sa + qy * ca
            d = math.hypot(u / rx, v / ry)
            if inner <= d <= 1.0:
                nx, ny = qx / (rx + 0.01), qy / (ry + 0.01)
                L = 0.55 - 0.5 * (nx * 0.55 + ny * 0.8)
                c.put_ramp(x, y, ramp, quant(max(0, min(1, L)), lo, hi, x, y))


def sparkle(c, x, y, ramp='gold', big=True):
    c.put_ramp(x, y, ramp, 5)
    for (dx, dy) in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        c.put_ramp(x + dx, y + dy, ramp, 4)
    if big:
        c.put_ramp(x - 2, y, ramp, 3)
        c.put_ramp(x + 2, y, ramp, 3)
        c.put_ramp(x, y - 2, ramp, 3)
        c.put_ramp(x, y + 2, ramp, 3)


def eye(c, x, y, h=2):
    """schlichtes Auge: 1 x h Pixel, kein Weiß"""
    for k in range(h):
        c.put_ramp(x, y + k, 'coal', 1)


def hand(c, x, y, ramp='skin', idx=4):
    c.rect(x, y, x + 1, y + 1, ramp, idx)
    c.put_ramp(x, y, ramp, min(5, idx + 1))


def shoes(c, x0, x1, y, ramp='wood', lit=3):
    for x in range(x0, x1 + 1):
        c.put_ramp(x, y, ramp, lit if x < x0 + 2 else lit - 1)
        c.put_ramp(x, y + 1, ramp, 1)


def mask_canvas(c):
    """Silhouette als Canvas (nur zum Prüfen)"""
    s = Canvas(c.w, c.h)
    s.px[:, :, 3] = c.px[:, :, 3]
    s.px[c.px[:, :, 3] > 0, :3] = INK
    return s


def droplet(world, x, y, col=4, depth=9000):
    for k in range(2):
        if 0 <= y + k < world.h and 0 <= x < world.w:
            world.px[y + k, x, :3] = RAMPS['sky'][col if k else 5]
            world.depth[y + k, x] = depth


def wput(world, x, y, ramp, idx, depth=9000):
    """einzelner Pixel direkt in die Welt (ganz vorn)"""
    if 0 <= x < world.w and 0 <= y < world.h:
        world.px[y, x, :3] = RAMPS[ramp][max(0, min(5, idx))]
        world.depth[y, x] = depth


def wspark(world, x, y, ramp='gold', big=False, depth=9000):
    wput(world, x, y, ramp, 5, depth)
    for (dx, dy) in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        wput(world, x + dx, y + dy, ramp, 4, depth)
    if big:
        for (dx, dy) in ((-2, 0), (2, 0), (0, -2), (0, 2)):
            wput(world, x + dx, y + dy, ramp, 3, depth)


def heal_cross(world, x, y, ramp='leaf', depth=9000):
    for (dx, dy) in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
        wput(world, x + dx, y + dy, ramp, 5 if (dx, dy) == (0, 0) else 4, depth)
    for (dx, dy) in ((-2, 0), (2, 0), (0, -2), (0, 2)):
        wput(world, x + dx, y + dy, ramp, 3, depth)
