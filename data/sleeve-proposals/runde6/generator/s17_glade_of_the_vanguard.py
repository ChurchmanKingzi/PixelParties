# -*- coding: utf-8 -*-
"""17 – Gegner „Elven Vanguard“, Held: Maya, the Nature Fairy (Base). Entwurf."""
import math, random
from c_util import *  # noqa
import numpy as np
import xcfkit as X

S, G = 'MotiveSteamDwarfs', 'MotiveGrailWar'
rnd = random.Random(17)

# --- Maya (Base) = Ebene 11 „Maya #5“ (Teil x244–266/y441–461) unter der Rankenkrone 9 „Maya #2“ (Teil x238–271/y432–479)
m = layer(S, 11).copy(); k = np.zeros(m.shape[:2], bool); k[441:461, 244:266] = True; m[~k] = 0
v = layer(S, 9).copy(); k = np.zeros(v.shape[:2], bool); k[432:479, 238:271] = True; v[~k] = 0
va = v[..., 3].copy()
acc = X.over(X.over(np.zeros_like(m), m), v)
acc[..., 3] = np.where((acc[..., 3] >= 70), 255, 0)          # schwache Rankenenden (Alpha 35/36) entfallen
bb = bbox(acc); maya = acc[bb[1]:bb[3], bb[0]:bb[2]]
print('maya+ranken', maya.shape)

# --- Elfen (MotiveGrailWar) ---
def part(i, x, y):
    s = compose(G, [i], crop=False); return part_at(s, x, y, dil=0)
leader = part(555, 272, 110); archer = part(555, 250, 100); druid = part(139, 85, 240)
rider = part(142, 160, 165); forager = part(33, 125, 230)
print('elves', leader.shape, archer.shape, druid.shape, rider.shape, forager.shape)

# --- Wald (Ebene 589 „Berserker Wald“, 1×-Originalpixel → 2×-Ebene) ---
F = layer(G, 589); CR = layer(G, 141)
X0, Y0 = 0, 108
base = F[Y0:Y0 + 175, X0:X0 + 125].copy()
# Bäume einzeln freistellen: Krone (141) + Wurzeln (braune Pixel direkt darunter)
trees = []
cm = (CR[..., 3] > 0).astype(np.uint8)
import cv2
n, lab = cv2.connectedComponents(cv2.dilate(cm, np.ones((3, 3), np.uint8)), connectivity=8)
for c in range(1, n):
    ys, xs = np.where((lab == c) & (cm > 0))
    if len(ys) < 60: continue
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    y1r = min(F.shape[0], y1 + 5)
    xa, xb = max(0, x0 - 2), min(F.shape[1], x1 + 2)
    reg = F[y0:y1r, xa:xb].copy()
    msk = np.zeros(reg.shape[:2], bool)
    msk[:y1 - y0, x0 - xa:x1 - xa] = (lab[y0:y1, x0:x1] == c) & (cm[y0:y1, x0:x1] > 0)
    r_, g_ = reg[..., 0].astype(int), reg[..., 1].astype(int)
    root = (r_ > g_ + 6); root[:max(0, (y1 - y0) - 6)] = False
    mid = (x0 + x1) / 2 - xa
    root[:, :max(0, int(mid - 8))] = False; root[:, int(mid + 8):] = False   # nur die Wurzeln unter dem Stamm
    msk |= root
    reg[~msk] = 0
    trees.append((xa, y0, reg))
# Boden: Waldboden-Kachel (gespiegelt gekachelt); Bäume außerhalb des Lichtungsovals vollständig neu setzen
tile = F[96:128, 238:270].copy()
CX, CY, RX, RY = 62, 90, 50, 72
for y in range(175):
    for x in range(125):
        if True:                                    # ganzer Waldboden aus der Kachel, Bäume werden vollständig neu gesetzt
            tx, ty = x % 64, y % 64
            tx = tx if tx < 32 else 63 - tx; ty = ty if ty < 32 else 63 - ty
            base[y, x] = tile[ty, tx]
p2 = base.copy()
# Waldrand: ausgewählte vollständige Bäume ringsum (größte Laubbäume der Karte), dazu zwei Blumengruppen
def dirt(reg):                                   # Bäume am Erdplatz tragen braune Bodenreste mit – aussortieren
    r_, g_ = reg[..., 0].astype(int), reg[..., 1].astype(int)
    return int(((r_ > g_ + 6) & (reg[..., 3] > 0))[: reg.shape[0] - 7].sum())
big = sorted([t for t in trees if 26 <= t[2].shape[1] <= 32 and t[2].shape[0] >= 30 and dirt(t[2]) < 4],
             key=lambda t: (t[1], t[0]))
print('laubbäume', len(big))
RING = [(-2, -6), (33, -14), (64, -14), (98, -6), (-6, 34), (102, 40), (-4, 80), (100, 88),
        (-2, 124), (98, 128)]
for n, (x, y) in enumerate(RING):
    reg = big[(n * 5) % len(big)][2]
    put(p2, reg, x, y)
fl = F[112:134, 76:98].copy()
r_, g_, b_ = [fl[..., k].astype(int) for k in range(3)]
fl[~((r_ > g_ + 25) | (b_ > g_ + 10) | ((r_ > 170) & (g_ > 150))), 3] = 0
fl = fl[bbox(fl)[1]:bbox(fl)[3], bbox(fl)[0]:bbox(fl)[2]]
put(p2, fl, 88, 106)
# Lichtschein auf der Lichtung (gedithert aufgehellt)
for y in range(175):
    for x in range(125):
        e = ((x + 0.5 - CX) / RX) ** 2 + ((y + 0.5 - CY) / RY) ** 2
        if e < 1:
            lv = int((1 - e) * 2.2 + bayer(x, y))
            if lv: p2[y, x, :3] = mix(tuple(int(q) for q in p2[y, x, :3]), (170, 210, 110), (0, 0.12, 0.22, 0.3)[min(3, lv)])
# Elfen am Rand der Lichtung (Leader mit zwei Archern unten wie auf der Coverkarte, oben Druid und Rider)
def stand(s, cx, fy, fl=False):
    s = flip(s) if fl else s
    put(p2, s, int(cx - s.shape[1] / 2), fy - s.shape[0]); return (int(cx), fy - s.shape[0])
tops = []
tops.append(stand(archer, 40, 152)); tops.append(stand(archer, 84, 152, True)); tops.append(stand(leader, 62, 156))
# grüne Heilfunken über den Elfen (+HP)
GRN = [(200, 255, 170), (110, 220, 90)]
for (x, y) in tops:
    for (dx, dy) in [(-4, -4), (3, -7)]:
        px_, py_ = x + dx, y + dy
        for (a, b_) in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
            if 0 <= px_ + a < 125 and 0 <= py_ + b_ < 175:
                p2[py_ + b_, px_ + a] = list(GRN[0] if (a, b_) == (0, 0) else GRN[1]) + [255]
blit(cv := Canvas(250, 350), p2, 2)

# ---------- 4×: Maya in ihrer Rankenkrone ----------
p4 = rgba(63, 88)
put(p4, maya, (63 - maya.shape[1]) // 2, 12)
blit(cv, p4, 4, -1, 0)
print(save(cv, '17_glade_of_the_vanguard.png'))
