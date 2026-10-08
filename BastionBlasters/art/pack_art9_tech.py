"""pack_art9: Props und Figuren fuer Der Grosse Hammer (BW-11) und die Belagerungswerkstatt (BF-04)."""
from __future__ import annotations

import random

from pack_art9_kit import *


# =========================================================================== Zahnraeder


def gear(r=10, ramp='gold', teeth=10, spokes=5, hub=True, seed=1):
    """Zahnrad von vorn (Durchmesser 2r+5)"""
    n = int(2 * r + 6)
    c = Canvas(n, n)
    cx = cy = (n - 1) / 2.0
    Ro, Ri = r + 1.8, r - 0.6
    for y in range(n):
        for x in range(n):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)
            tooth = (ang * teeth / (2 * math.pi)) % 1.0 < 0.5
            lim = Ro if tooth else Ri
            if d > lim:
                continue
            hole = d < r * 0.30
            if hole:
                continue
            # Speichen: zwischen Nabe und Kranz Luecken
            if d > r * 0.45 and d < r * 0.78:
                sp = (ang * spokes / (2 * math.pi) + 0.0) % 1.0
                if 0.22 < sp < 0.78:
                    continue
            nx, ny = dx / max(1.0, d), dy / max(1.0, d)
            L = 0.55 - 0.42 * (nx * 0.6 + ny * 0.8) * (d / Ro) ** 2
            if d < r * 0.45:
                L += 0.1
            c.put_ramp(x, y, ramp, quant(max(0.0, min(1.0, L)), 1, 5, x, y))
    if hub:
        for y in range(n):
            for x in range(n):
                d = math.hypot(x - cx, y - cy)
                if d < r * 0.30:
                    pass
    c.outline()
    return c


def pipe_run(w=88, h=14, seed=2):
    """horizontale Rohrleitung mit Flanschen und Ventilrad (Wanddeko, w x h)"""
    c = Canvas(w, h)
    y0, y1 = h - 10, h - 3
    for x in range(w):
        for y in range(y0, y1 + 1):
            t = (y - y0) / float(y1 - y0)
            i = 5 if t < 0.15 else (4 if t < 0.4 else (3 if t < 0.65 else (2 if t < 0.85 else 1)))
            c.put_ramp(x, y, 'metal', i)
    for x in range(6, w, 22):
        for y in range(y0 - 1, y1 + 2):
            c.put_ramp(x, y, 'metal', 4)
            c.put_ramp(x + 1, y, 'metal', 4)
            c.put_ramp(x + 2, y, 'metal', 2)
        c.put_ramp(x, y0 - 1, 'metal', 5)
    # Ventilrad
    vx = w // 2 + 4
    c.rect(vx - 1, y0 - 4, vx, y0 - 1, 'metal', 3)
    for k in range(-3, 4):
        c.put_ramp(vx + k, y0 - 5, 'teamA', 4)
    c.put_ramp(vx - 3, y0 - 4, 'teamA', 3)
    c.put_ramp(vx + 3, y0 - 4, 'teamA', 3)
    c.outline()
    return c


def blueprint():
    """Bauplan an der Wand (22 x 18): Zeichnung eines riesigen Hammers"""
    c = Canvas(22, 18)
    for y in range(1, 16):
        for x in range(1, 21):
            c.put_ramp(x, y, 'ice', 3 if (x + y) % 9 else 2)
    # Hammer-Skizze
    for x in range(5, 17):
        c.put_ramp(x, 4, 'ice', 5)
        c.put_ramp(x, 7, 'ice', 5)
    c.put_ramp(5, 5, 'ice', 5)
    c.put_ramp(5, 6, 'ice', 5)
    c.put_ramp(16, 5, 'ice', 5)
    c.put_ramp(16, 6, 'ice', 5)
    vline(c, 10, 8, 14, 'ice', 5)
    vline(c, 12, 8, 14, 'ice', 5)
    hline(c, 3, 5, 15, 'ice', 4)
    hline(c, 17, 19, 3, 'ice', 4)
    c.put_ramp(2, 1, 'bone', 5)
    c.put_ramp(19, 16, 'bone', 3)
    # Reissnaegel
    for (x, y) in ((1, 1), (20, 1), (1, 15), (20, 15)):
        c.put_ramp(x, y, 'metal', 5)
    c.outline()
    return c


def tool_board():
    """Lochwand mit Werkzeug-Silhouetten (30 x 18): Hammer, Zange, Saege, Schluessel"""
    c = Canvas(30, 18)
    block(c, 0, 0, 29, 17, 'wood', hi=4, mid=3, lo=2, deep=1)
    # Hammer
    c.rect(4, 3, 4, 13, 'wood', 1)
    c.rect(2, 2, 7, 4, 'metal', 4)
    # Schluessel
    c.rect(12, 4, 12, 14, 'metal', 3)
    ellipse(c, 12, 4, 2.4, 2.4, 'metal', lo=2, hi=5)
    c.put_ramp(12, 4, 'wood', 1)
    # Saege
    poly(c, [(17, 3), (24, 3), (24, 6), (17, 12)], 'metal', lo=2, hi=5)
    c.rect(24, 3, 26, 5, 'wood', 1)
    # Zange
    c.line(21, 8, 24, 15, 'wood', 1)
    c.line(24, 8, 21, 15, 'wood', 1)
    c.outline()
    return c


# =========================================================================== Der Grosse Hammer


def giant_hammer(HW=50, H=84):
    """Riesenhammer, Stiel nach unten (HW+4 x H). Kopf HW breit, Stiel 9 breit, Messingringe, Teamfarben-Schild, Oesen."""
    W = HW + 4
    c = Canvas(W, H)
    mid = W // 2
    x0, x1 = mid - 4, mid + 4
    top = 4
    bot = 22
    # Stiel
    for y in range(bot + 2, H - 2):
        for x in range(x0, x1 + 1):
            u = (x - x0) / float(x1 - x0)
            i = 4 if u < 0.2 else (3 if u < 0.55 else (2 if u < 0.85 else 1))
            if texture_noise(x, y // 3, 5) > 0.82 and i > 1:
                i -= 1
            c.put_ramp(x, y, 'wood', i)
    # Lederwickel am Stiel
    for y in range(bot + 22, H - 8, 4):
        for x in range(x0, x1 + 1):
            c.put_ramp(x, y, 'dirt', 4 if x < x0 + 3 else 2)
            c.put_ramp(x, y + 1, 'dirt', 2 if x < x0 + 3 else 1)
    # Knauf
    ellipse(c, mid, H - 3, 6.2, 2.6, 'wood', lo=1, hi=4)
    c.rect(mid - 6, H - 4, mid + 6, H - 3, 'metal', 2)
    c.rect(mid - 6, H - 4, mid + 6, H - 4, 'metal', 4)
    # Kopf: Mittelblock + Schlagkappen
    capw = 11
    for y in range(top - 1, bot + 2):
        for x in range(2, W - 2):
            cap = x < 2 + capw or x > W - 3 - capw
            if not cap and (y < top + 1 or y > bot - 1):
                continue
            if cap and (y < top - 1 or y > bot + 1):
                continue
            if cap and (x in (2, 3, W - 3, W - 4)) and (y < top + 2 or y > bot - 2):
                continue
            u = (x - 2) / float(W - 4)
            v = (y - top) / float(bot - top)
            L = 0.86 - 0.50 * v - 0.10 * u
            if x in (2 + capw, 3 + capw, W - 3 - capw, W - 4 - capw):
                L -= 0.45
            if x in (4 + capw, W - 5 - capw):
                L += 0.15
            idx = quant(max(0.0, min(1.0, L)), 1, 5, x, y)
            if y <= top:
                idx = 5
            c.put_ramp(x, y, 'metal', idx)
    for y in range(top, bot + 1):
        c.put_ramp(2, y, 'metal', 5)
        c.put_ramp(3, y, 'metal', 4)
        c.put_ramp(W - 3, y, 'metal', 1)
    # Messingbaender
    for x in (mid - 9, mid - 8, mid + 8, mid + 9):
        for y in range(top + 2, bot - 1):
            c.put_ramp(x, y, 'gold', 5 if x in (mid - 9, mid + 8) else 3)
    # Schild in Teamfarben mit goldener Raute
    for y in range(top + 3, bot - 2):
        for x in range(mid - 7, mid + 7):
            c.put_ramp(x, y, 'teamA', 3 if x < mid else 2)
    cy = (top + bot) // 2
    for k in range(0, 5):
        hline(c, mid - k, mid + k - 1, cy - 4 + k, 'gold', 4 if k > 0 else 5)
        hline(c, mid - k, mid + k - 1, cy + 4 - k, 'gold', 3)
    c.put_ramp(mid - 2, cy - 2, 'gold', 5)
    # Nieten
    for (x, y) in ((9, top + 3), (9, bot - 3), (W - 10, top + 3), (W - 10, bot - 3)):
        c.put_ramp(x, y, 'metal', 5)
        c.put_ramp(x + 1, y + 1, 'metal', 1)
    # Oesen fuer die Seile: oben und unten an beiden Kappen
    for (ex, ey) in ((6, 1), (W - 7, 1), (6, bot + 3), (W - 7, bot + 3)):
        for (dx, dy) in ((-1, 0), (0, -1), (1, -1), (2, 0), (2, 1), (-1, 1), (0, 2), (1, 2)):
            c.put_ramp(ex + dx, ey + dy, 'gold', 4 if dy <= 0 else 3)
    # Hals
    for x in range(x0 - 2, x1 + 3):
        c.put_ramp(x, bot + 1, 'metal', 2)
        c.put_ramp(x, bot + 2, 'metal', 1)
    c.outline()
    return c


# =========================================================================== Gnome


def gnome(pose='pull', hat='teamA', beard='bone', coat='ice', seed=0):
    """Gnom (24 x 30, blickt nach rechts). pose: pull (lehnt sich zurueck, haelt Seil) | work (Schraubenschluessel)."""
    c = Canvas(32 if pose == 'shovel' else 26, 30)
    lean = 3 if pose == 'pull' else 0
    # Stiefel + Beine
    hipx, hipy = 12 - lean // 2, 21
    thick_line(c, hipx, hipy, hipx - 5 - lean, 27, 3.6, coat, lo=0, hi=2)
    thick_line(c, hipx + 1, hipy, hipx + 5, 27, 3.6, coat, lo=1, hi=3)
    for (fx, fl) in ((hipx - 6 - lean, 'wood'), (hipx + 5, 'wood')):
        for dx in range(-2, 4):
            c.put_ramp(fx + dx, 28, fl, 2 if dx < 2 else 1)
            c.put_ramp(fx + dx, 29, fl, 0)
        c.put_ramp(fx + 3, 27, fl, 3)
    # Koerper (leicht nach hinten geneigt)
    thick_line(c, hipx, hipy - 1, hipx - lean, 12, 9.0, coat, lo=1, hi=4)
    for k in range(9):
        c.put_ramp(hipx - 4 + k - lean // 2, 22, 'wood', 2 if k % 2 else 1)
    c.put_ramp(hipx, 22, 'gold', 5)
    # Hemdbrust
    thick_line(c, hipx - lean + 1, 12, hipx - lean + 1, 15, 4.0, 'bone', lo=3, hi=5)
    # Arme
    sx, sy = hipx - lean + 3, 13
    if pose == 'pull':
        hx, hy = 20, 10
        thick_line(c, sx, sy, hx, hy, 2.8, 'skin', lo=2, hi=5)
        c.rect(hx, hy - 1, hx + 1, hy + 1, 'skin', 5)
        thick_line(c, sx - 2, sy + 1, hx - 4, hy + 3, 2.8, 'skin', lo=1, hi=4)
    elif pose == 'shovel':
        hx, hy = 18, 18
        # Schaufelstiel (schraeg nach unten), Blatt mit Ladung am Boden
        thick_line(c, hx - 5, hy - 2, hx + 7, hy + 9, 1.8, 'wood', lo=2, hi=4)
        poly(c, [(hx + 5, hy + 9), (hx + 11, hy + 8), (hx + 12, hy + 11), (hx + 7, hy + 12)], 'metal', lo=1, hi=5)
        ellipse(c, hx + 9, hy + 7, 3.0, 2.4, 'dirt', lo=0, hi=2)
        thick_line(c, sx, sy, hx, hy, 2.8, 'skin', lo=2, hi=5)
        thick_line(c, sx - 2, sy + 1, hx - 5, hy - 2, 2.8, 'skin', lo=1, hi=4)
    else:
        hx, hy = 19, 17
        thick_line(c, sx, sy, hx, hy, 2.8, 'skin', lo=2, hi=5)
        thick_line(c, hx, hy, hx + 4, hy - 8, 1.8, 'metal', lo=2, hi=5)
        c.rect(hx + 2, hy - 11, hx + 6, hy - 8, 'metal', 4)
        c.put_ramp(hx + 4, hy - 10, 'metal', 1)
        c.put_ramp(hx + 3, hy - 9, 'metal', 1)
    # Bart + Kopf
    bx, by = hipx - lean + 1, 12
    poly(c, [(bx - 3, by - 2), (bx + 5, by - 2), (bx + 5, by + 5), (bx + 1, by + 8), (bx - 2, by + 5)], beard, lo=3, hi=5)
    ellipse(c, bx + 1, by - 5, 4.4, 3.8, 'skin', lo=2, hi=5)
    ellipse(c, bx + 5.5, by - 4, 1.7, 1.5, 'skin', lo=3, hi=5)    # Nase
    c.put_ramp(bx + 4, by - 6, 'coal', 1)
    c.put_ramp(bx + 1, by - 6, 'coal', 1)
    # Zipfelmuetze
    poly(c, [(bx - 4, by - 7), (bx + 6, by - 7), (bx + 3, by - 14), (bx - 3, by - 13), (bx - 8, by - 9)], hat, lo=1, hi=4)
    hline(c, bx - 4, bx + 6, by - 7, hat, 1)
    c.put_ramp(bx - 1, by - 9, hat, 5)
    if hat == 'metal':
        pass
    c.outline()
    return c


def gnome_goggles(coat='ice'):
    """Ingenieur-Gnom: Schweisserbrille ueber der Muetze, Schraubenschluessel (wie work, mit Brille)"""
    c = gnome('work', hat='metal', beard='fire', coat=coat)
    return c


# =========================================================================== Belagerungswerkstatt


def boiler():
    """Messing-Dampfkessel (40 x 46): Feuertuer, Manometer, Kamin mit Dampf, Nieten"""
    c = Canvas(40, 46)
    # Kamin
    c.rect(26, 2, 31, 10, 'metal', 3)
    c.rect(26, 2, 27, 10, 'metal', 4)
    c.rect(30, 2, 31, 10, 'metal', 1)
    c.rect(24, 0, 33, 2, 'metal', 2)
    c.rect(24, 0, 33, 0, 'metal', 5)
    # Kesselkoerper (stehender Zylinder)
    for y in range(8, 42):
        for x in range(4, 36):
            u = (x - 4) / 31.0
            L = 0.92 - 0.75 * u + (0.1 if y < 14 else 0)
            if y < 11:
                continue
            idx = quant(max(0.0, min(1.0, L)), 1, 5, x, y)
            c.put_ramp(x, y, 'gold', idx)
    # Kuppel oben
    ellipse(c, 20, 13, 16.2, 6.0, 'gold', lo=1, hi=5, clip=lambda x, y: y <= 12)
    # Metallbaender + Nieten
    for yy in (16, 32):
        for x in range(4, 36):
            c.put_ramp(x, yy, 'metal', 4 if x < 14 else (3 if x < 26 else 2))
            c.put_ramp(x, yy + 1, 'metal', 2 if x < 26 else 1)
        for x in range(6, 35, 4):
            c.put_ramp(x, yy - 1, 'metal', 5)
    # Fuss
    c.rect(2, 41, 37, 44, 'metal', 2)
    c.rect(2, 41, 37, 41, 'metal', 4)
    c.rect(2, 44, 37, 44, 'metal', 0)
    # Feuertuer
    round_rect(c, 9, 33, 22, 41, 'coal', lo=0, hi=3, radius=2)
    for y in range(35, 41):
        for x in range(11, 21):
            c.put_ramp(x, y, 'fire', 5 if (y > 37 and 13 < x < 18) else (4 if y > 36 else 3))
    for x in range(12, 21, 2):
        vline(c, x, 35, 40, 'coal', 1)
    # Manometer
    ellipse(c, 14, 24, 5.0, 5.0, 'metal', lo=2, hi=5)
    ellipse(c, 14, 24, 3.6, 3.6, 'bone', lo=3, hi=5)
    c.line(14, 24, 16, 22, 'coal', 1)
    c.line(14, 24, 15, 24, 'fire', 3)
    c.put_ramp(11, 22, 'leaf', 4)
    c.put_ramp(17, 26, 'fire', 4)
    # Ventil + Rohr rechts
    c.rect(28, 21, 33, 23, 'metal', 3)
    c.rect(34, 20, 38, 24, 'metal', 2)
    c.put_ramp(35, 20, 'metal', 5)
    c.outline()
    return c


def steam_puff(f=0, size=1):
    """Dampfwolke (Dither, ohne Umriss)"""
    n = 14 if size == 1 else 20
    c = Canvas(n, n - 2)
    cx, cy = n / 2.0, (n - 2) / 2.0
    for y in range(n - 2):
        for x in range(n):
            d = math.hypot((x - cx) / (n * 0.46), (y - cy) / (n * 0.36))
            if d < 1.0:
                blob = (math.sin(x * 0.9 + f) + math.cos(y * 0.8)) * 0.18
                if d + blob < 0.95:
                    if d < 0.55:
                        c.put_ramp(x, y, 'bone', 5)
                    elif (x + y) % 2 == 0:
                        c.put_ramp(x, y, 'bone', 4)
                    elif d < 0.8:
                        c.put_ramp(x, y, 'bone', 3)
    return c


def battering_ram():
    """unfertiger Rammbock auf Raedern (60 x 34): Stamm mit Eisenkopf, Dach nur halb beplankt"""
    c = Canvas(60, 34)
    # Raeder
    for wx in (11, 41):
        ellipse(c, wx, 28, 6.0, 6.0, 'wood', lo=1, hi=4)
        ellipse(c, wx, 28, 3.2, 3.2, 'wood', lo=0, hi=2)
        for a in range(0, 360, 60):
            r = math.radians(a + 20)
            c.put_ramp(wx + int(round(math.cos(r) * 5)), 28 + int(round(math.sin(r) * 5)), 'wood', 4)
        c.put_ramp(wx, 28, 'metal', 5)
    # Unterbau
    c.rect(4, 22, 48, 24, 'wood', 3)
    c.rect(4, 22, 48, 22, 'wood', 4)
    c.rect(4, 24, 48, 24, 'wood', 1)
    # Gestell (Dachsparren, Latten fehlen teilweise)
    for x in (8, 22, 36, 46):
        c.rect(x, 7, x + 1, 22, 'wood', 3)
        c.rect(x, 7, x, 22, 'wood', 4)
    for (x0, x1) in ((8, 22), (22, 36), (36, 46)):
        c.line(x0, 7, (x0 + x1) // 2, 3, 'wood', 4)
        c.line((x0 + x1) // 2, 3, x1, 7, 'wood', 3)
    # Dach-Planken: links fertig, rechts fehlend
    for x in range(8, 36):
        for y in range(6, 9):
            c.put_ramp(x, y, 'wood', 4 if y == 6 else (3 if y == 7 else 2))
    # Querbalken
    c.rect(8, 14, 46, 14, 'wood', 2)
    # Ramme (Stamm) haengt in Ketten
    c.line(14, 8, 14, 15, 'metal', 3)
    c.line(38, 8, 38, 15, 'metal', 3)
    thick_line(c, 6, 17, 50, 17, 6.0, 'wood', lo=1, hi=4)
    # Eisenkopf (Widderkopf)
    poly(c, [(49, 13), (58, 15), (58, 20), (49, 21)], 'metal', lo=1, hi=5)
    c.put_ramp(58, 14, 'bone', 5)
    poly(c, [(52, 12), (56, 10), (55, 14)], 'metal', lo=2, hi=5)      # Horn
    c.put_ramp(55, 16, 'coal', 0)
    c.rect(47, 14, 49, 20, 'metal', 3)
    # Schraubenschluessel im Holz + Nieten
    c.line(24, 20, 29, 12, 'metal', 4)
    c.rect(28, 10, 31, 12, 'metal', 4)
    c.put_ramp(29, 11, 'wood', 1)
    c.outline()
    return c


def seesaw_mallet():
    """Wippe mit Riesenschlegel (44 x 28): Schlegel links oben, Fels rechts unten"""
    c = Canvas(44, 28)
    # Drehpunkt (Boecklein)
    poly(c, [(22, 12), (17, 26), (27, 26)], 'wood', lo=1, hi=4)
    c.rect(16, 25, 28, 27, 'wood', 2)
    # Brett, links hoch, rechts tief
    thick_line(c, 3, 10, 41, 21, 3.4, 'wood', lo=2, hi=5)
    # Schlegel auf dem linken Ende
    c.rect(2, 1, 3, 9, 'wood', 3)
    block(c, 0, 0, 13, 6, 'wood', hi=5, mid=4, lo=3, deep=2)
    c.rect(0, 0, 1, 6, 'metal', 4)
    c.rect(12, 0, 13, 6, 'metal', 2)
    # Fels / Gewicht rechts
    ellipse(c, 38, 17, 4.6, 4.2, 'stone', lo=1, hi=5)
    c.put_ramp(36, 15, 'stone', 5)
    c.outline()
    return c


def workbench():
    """Werkbank mit Schraubstock, Plan und Zahnraedern (36 x 22)"""
    c = Canvas(36, 22)
    block(c, 1, 9, 34, 13, 'wood', hi=5, mid=4, lo=3, deep=2)
    block(c, 3, 14, 6, 21, 'wood', hi=3, mid=2, lo=1, deep=0)
    block(c, 29, 14, 32, 21, 'wood', hi=3, mid=2, lo=1, deep=0)
    block(c, 7, 15, 28, 18, 'wood', hi=3, mid=2, lo=1, deep=0)
    # Schraubstock
    block(c, 3, 3, 9, 8, 'metal', hi=5, mid=4, lo=2, deep=1)
    c.rect(1, 5, 2, 6, 'metal', 3)
    # Plan (aufgerollt)
    ellipse(c, 17, 7, 5.0, 2.4, 'bone', lo=3, hi=5)
    c.put_ramp(20, 7, 'ice', 3)
    # Zahnrad-Stapel
    for (x, y, col) in ((26, 8, 'gold'), (30, 7, 'metal')):
        ellipse(c, x, y, 2.8, 2.0, col, lo=2, hi=5)
        c.put_ramp(x, y, 'coal', 1)
    c.outline()
    return c


def wrench_big():
    """riesiger Schraubenschluessel an Haken (10 x 22)"""
    c = Canvas(10, 22)
    thick_line(c, 5, 6, 5, 20, 3.0, 'metal', lo=2, hi=5)
    ellipse(c, 5, 4, 4.0, 4.0, 'metal', lo=1, hi=5)
    c.rect(4, 0, 6, 3, 'coal', 0)
    ellipse(c, 5, 20, 2.4, 2.4, 'metal', lo=1, hi=4)
    c.outline()
    return c


from pack_art9_hall import pad_bottom   # noqa: E402  (fuer Wanddeko)
