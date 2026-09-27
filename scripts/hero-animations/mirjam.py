# -*- coding: utf-8 -*-
"""Idle-Animation für Mirjam, the Fallen Cute Angel (Sprite aus MotiveMoe.xcf).

* Sie schlägt mit ihren dunklen Flügeln (Drehung um die Schultern,
  flap_common.rotate_part, Spitzen schwingen nach). Die hinter ihr verdeckten
  Flügelteile werden in Flügelfarbe ergänzt, kleine Lücken im gedrehten
  Flügel geschlossen – die Flügel bleiben geschlossene Flächen.
* Sie schwebt: die Figur samt Flügeln hebt und senkt sich (0..2 px),
  ihr Schatten am Boden bleibt liegen und wird kleiner/blasser, je höher sie ist.
* Lila Blitze als Partikel: kurze Zickzack-Blitze zucken aus ihrer
  erhobenen Hand und um sie herum auf (grell -> lila -> dunkellila, dann
  weg), dazu vereinzelte Funken; an der Hand knistert es.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import rotate_part, over, fill_pinholes

SRC = np.array(Image.open('src/mirjam-the-fallen-cute-angel.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
SHADOW_Y = 30
P = 5
PT = 8
H, W = SH + PT + 1, SW + 2 * P
HAND = (18, 8)
N = 48


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def lift(i):
    return int(round(1 - math.cos(2 * math.pi * i / 24)))      # 0..2


WING = {rgb(c) for c in ('16133a', '0a081a', '0c0b20', '272267', '0f0d28')}
WING_MASK = np.array([[SRC[y, x, 3] > 0 and y < SHADOW_Y and (x <= 6 or x >= 15) and tuple(SRC[y, x]) in WING
                       for x in range(SW)] for y in range(SH)])
PIVOTS = {-1: (6.0, 9.0), 1: (15.0, 9.0)}
WING_FILL = rgb('0a081a')                            # Innenfarbe der Flügel


def full_wing(side):
    """Flügel vervollständigen: was im Sprite hinter Mirjam liegt, wird von der
    Innenkante bis zur Körpermitte in Flügelfarbe ergänzt – nur solange Mirjam
    davor liegt (in Ruhe unsichtbar, beim Schlagen sonst ein Loch an der Wurzel)."""
    xs = np.arange(SW)[None, :]
    m = WING_MASK & ((xs <= 10) if side < 0 else (xs >= 11))
    img = SRC.copy()
    full = m.copy()
    for y in range(SH):
        row = np.nonzero(m[y])[0]
        if not len(row):
            continue
        rng = range(row.max() + 1, 11) if side < 0 else range(row.min() - 1, 10, -1)
        for x in rng:                                # nach innen, solange Mirjam davor liegt
            if not SRC[y, x, 3]:
                break
            img[y, x] = WING_FILL
            full[y, x] = True
    return img, full


WINGS = {side: full_wing(side) for side in (-1, 1)}


def close_gaps(part):
    """Leere Pixel mit mindestens drei Flügel-Nachbarn (4er) schließen."""
    a = part[:, :, 3] > 0
    for _ in range(2):
        fix = []
        for y in range(1, part.shape[0] - 1):
            for x in range(1, part.shape[1] - 1):
                if not a[y, x] and a[y - 1, x] + a[y + 1, x] + a[y, x - 1] + a[y, x + 1] >= 3:
                    fix.append((x, y))
        for x, y in fix:
            part[y, x] = WING_FILL
            a[y, x] = True
    return part


def wing_angle(i, r):
    p = 2 * math.pi * i / 16 - 0.04 * r
    s = math.sin(p)
    return 0.05 + 0.27 * (s * (1.2 if s < 0 else 0.9))
BOLT = [rgb('ffffff'), rgb('d9a8ff'), rgb('a15cff'), rgb('5a2a9e')]
GLOW = rgb('7a3cdc', 150)


def bolt_path(k):
    """Zickzack-Blitz: aus der Hand (gerade k) nach oben/außen oder frei um
    die Figur herum (ungerade k), Richtung grob nach außen."""
    if k % 2 == 0:
        ang = math.radians(-105 + rnd(k, 1) * 95)
        x, y = HAND[0] + P + 1, HAND[1] + PT - 1
    else:
        ang = rnd(k, 1) * 2 * math.pi
        r0 = 10 + rnd(k, 2) * 4
        cx, cy = SW / 2 + P, 12 + PT
        x, y = cx + math.cos(ang) * r0, cy + math.sin(ang) * r0 * 1.1
    pts = [(int(round(x)), int(round(y)))]
    length = (7 if k % 2 == 0 else 5) + int(rnd(k, 3) * 4)
    for j in range(length):
        a = ang + (0.9 if j % 2 else -0.9) * (0.6 + rnd(k, 10 + j) * 0.6)
        x += math.cos(a) * 1.2
        y += math.sin(a) * 1.2
        p = (int(round(x)), int(round(y)))
        if p != pts[-1]:
            # 8-Nachbarschaft sicherstellen
            while max(abs(p[0] - pts[-1][0]), abs(p[1] - pts[-1][1])) > 1:
                q = pts[-1]
                pts.append((q[0] + (p[0] > q[0]) - (p[0] < q[0]), q[1] + (p[1] > q[1]) - (p[1] < q[1])))
            pts.append(p)
    return pts


def inside(pts, m=2):
    return all(m <= x < W - m and m <= y < H - m for x, y in pts)


# nur Blitze, die samt Leuchten komplett ins Bild passen (nichts abgeschnitten)
BOLTS = []
for k in range(N // 3):
    for tries in range(12):
        path = bolt_path(k + 100 * tries)
        if inside(path):
            BOLTS.append((k * 3 + int(rnd(k, 7) * 2), path))
            break


def frame(i):
    out = np.zeros((H, W, 4), int)
    L = lift(i)
    # Schatten (bleibt am Boden, schrumpft beim Hochschweben)
    for y in range(SHADOW_Y, SH):
        xs = [x for x in range(SW) if SRC[y, x, 3]]
        if not xs:
            continue
        x0, x1 = min(xs) + (L + 1) // 2, max(xs) - (L + 1) // 2
        for x in range(x0, x1 + 1):
            out[y + PT, x + P] = (*SRC[y, x, :3], max(90, SRC[y, x, 3] - 30 * L))
    # Flügel (schlagen) und Figur
    for side in (-1, 1):
        img, m = WINGS[side]
        over(out, close_gaps(rotate_part(img, m, PIVOTS[side], lambda r, s=side: s * wing_angle(i, r),
                                         (H, W), (P, PT - L))))
    for y in range(SHADOW_Y):
        for x in range(SW):
            if SRC[y, x, 3] and not WING_MASK[y, x]:
                out[y + PT - L, x + P] = SRC[y, x]
    fill_pinholes(out)                               # keine Einzellöcher zwischen Arm und Flügel
    # Blitze dürfen vor den Flügeln zucken, nicht vor ihr
    free = np.array([[out[y, x, 3] == 0 or tuple(out[y, x]) in WING for x in range(W)] for y in range(H)])
    # Blitze
    for start, pts in BOLTS:
        t = (i - start) % N
        if t > 3:
            continue
        for j, (x, y) in enumerate(pts):
            if not (0 <= x < W and 0 <= y < H) or not free[y, x]:
                continue
            if t == 0:
                c = BOLT[0] if j % 3 else BOLT[1]
            elif t == 1:
                c = BOLT[1] if j % 2 else BOLT[2]
            elif t == 2:
                c = BOLT[2]
            else:
                if j % 2:
                    continue
                c = BOLT[3]
            out[y, x] = c
        if t <= 1:                                             # Leuchten um den Blitz
            for x, y in pts:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < W and 0 <= yy < H and free[yy, xx] and tuple(out[yy, xx]) not in BOLT:
                        out[yy, xx] = GLOW if out[yy, xx, 3] == 0 else rgb('3a1a70')
        if t == 1:                                             # Funken am Ende
            ex, ey = pts[-1]
            for s in range(2):
                sx = ex + int(round((rnd(start, 30 + s) - 0.5) * 4))
                sy = ey + int(round((rnd(start, 40 + s) - 0.5) * 4))
                if 1 <= sx < W - 1 and 1 <= sy < H - 1 and out[sy, sx, 3] == 0:
                    out[sy, sx] = BOLT[1]
    # Knistern an der Hand (bewegt sich mit)
    hx, hy = HAND[0] + P + 1, HAND[1] + PT - 1 - L
    for s in range(2):
        if rnd(i, 50 + s) > 0.45:
            sx = hx + int(round((rnd(i, 60 + s) - 0.3) * 3))
            sy = hy - int(rnd(i, 70 + s) * 3)
            if 1 <= sx < W - 1 and 1 <= sy < H - 1 and free[sy, sx]:
                out[sy, sx] = BOLT[1 if s else 0]
    fill_pinholes(out)                               # Einzellöcher in Blitz-Zickzacks
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'mirjam_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=8, check_edges=True)
