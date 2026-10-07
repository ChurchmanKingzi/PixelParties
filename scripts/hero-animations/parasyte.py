# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin „Parasytic ???“ (Parasyte) von ???, the Shapeshifter.

Quelle ist allein das fertige Sprite (src/parasytic-shapeshifter.png): Tentakel, Klingen und Mensch werden
daraus an den Farben erkannt (rote Muskelstränge samt dunkelroter Kontur, Stahlklingen, alles andere = Mensch).
Frame 0 ist die Ruhepose (der Sprite genau wie gezeichnet).

JEDER Tentakelarm bewegt sich einzeln:
* Die Stränge bilden ein Netz aus 1-px-Linien. Es wird in Arme zerlegt (Abschnitte zwischen zwei Knoten bzw.
  Spitzen). Jeder Arm hat seine eigene Phase, Frequenz und Stärke, und ist an Körper und Verzweigungen fest.
* Der Arm schwingt quer zu seiner Richtung, als Welle, die zur freien Spitze hinausläuft (peitschend);
  Arme, die an beiden Enden festsitzen, wölben sich in der Mitte.
* Die Klingen sitzen starr an ihrer Spitze und schwingen als Ganzes mit (ganzzahlige Verschiebung).
* Das weiße Monsterauge glimmt; ab und zu blitzt der Stahl einer Klinge auf.
Aufruf (aus scripts/hero-animations):  python3 parasyte.py final 90
"""
import math
import sys
from PIL import Image
import numpy as np
import cv2
from anim_common import rgb, save_outputs, sparkle_pixels
from flap_common import fill_pinholes

SRC = np.array(Image.open('src/parasytic-shapeshifter.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
N = 48
PL = PR = 7
PT, PB = 7, 6
H, W = SH + PT + PB, SW + PL + PR
OPAQUE = SRC[:, :, 3] > 0

FLESH_PAL = [rgb(c)[:3] for c in ('3a1117', '8e2a35', 'b8454d', 'd9696f', 'efb0a8')]
STEEL_PAL = [rgb(c)[:3] for c in ('1c2026', '78808b', 'b4bbc4', 'e8ecf0', 'ffffff')]
OUTLINE_COL = rgb('3a1117')[:3]


def _near(p, pal, tol=34):
    return min(sum((int(p[k]) - c[k]) ** 2 for k in range(3)) for c in pal) <= tol * tol


# ── Teile erkennen ───────────────────────────────────────────────────────────
def classify():
    flesh = np.zeros((SH, SW), bool)
    steel = np.zeros((SH, SW), bool)
    for y, x in zip(*np.nonzero(OPAQUE)):
        p = SRC[y, x]
        if _near(p, FLESH_PAL):
            flesh[y, x] = True
        elif _near(p, STEEL_PAL):
            steel[y, x] = True
    # Stahl nur als zusammenhängende Klinge (>= 8 px); kleine weiße Reste (Auge, Glanz) gehören nicht dazu
    n, lab = cv2.connectedComponents(steel.astype(np.uint8), connectivity=8)
    blade = np.zeros_like(steel)
    for k in range(1, n):
        m = lab == k
        if m.sum() >= 8:
            blade |= m
    # Fleisch: nur Komponenten mit mindestens einer Fleischfarbe-Füllung (keine verirrten Pixel des Menschen)
    return flesh, blade


FLESH, BLADE = classify()
FILL = FLESH & ~np.array([[tuple(SRC[y, x, :3]) == OUTLINE_COL for x in range(SW)] for y in range(SH)])
TENT = FLESH | BLADE
HUMAN = OPAQUE & ~TENT
_hdist = cv2.distanceTransform((~HUMAN).astype(np.uint8), cv2.DIST_L2, 5)


# ── Arme: Baum ab dem Körper ─────────────────────────────────────────────────
# Die Stränge sind 1-px-Linien (FILL). Von den Körperansätzen aus wird ein kürzester-Weg-Baum über sie gelegt;
# in jedem Zweig setzt sich der Arm in Richtung des längsten Unterzweigs fort, jeder Seitenzweig wird ein eigener
# Arm. Ein Arm reitet auf seinem Elternarm mit (die Verschiebung an der Abzweigung) und schlenkert zusätzlich selbst.
import heapq

SK_LIST = [(x, y) for y, x in np.argwhere(FILL)]
SK_IDX = {p: k for k, p in enumerate(SK_LIST)}
_SQ2 = math.sqrt(2.0)


def _build_tree():
    n = len(SK_LIST)
    nb = [[] for _ in range(n)]
    for k, (x, y) in enumerate(SK_LIST):
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if (dx or dy) and (x + dx, y + dy) in SK_IDX:
                    nb[k].append((SK_IDX[(x + dx, y + dy)], _SQ2 if dx and dy else 1.0))
    # Wurzeln: Strangpixel am Körper; Komponenten ohne Körperkontakt bekommen ihr körpernächstes Pixel
    roots = {k for k, (x, y) in enumerate(SK_LIST) if _hdist[y, x] <= 2.5}
    ncomp, lab = cv2.connectedComponents(FILL.astype(np.uint8), connectivity=8)
    for c in range(1, ncomp):
        ks = [k for k, (x, y) in enumerate(SK_LIST) if lab[y, x] == c]
        if ks and not any(k in roots for k in ks):
            roots.add(min(ks, key=lambda k: _hdist[SK_LIST[k][1], SK_LIST[k][0]]))
    dist = [None] * n
    parent = [-1] * n
    heap = [(0.0, k) for k in roots]
    for _, k in heap:
        dist[k] = 0.0
    heapq.heapify(heap)
    while heap:
        d, k = heapq.heappop(heap)
        if d > dist[k]:
            continue
        for q, c in nb[k]:
            if dist[q] is None or d + c < dist[q] - 1e-9:
                dist[q] = d + c
                parent[q] = k
                heapq.heappush(heap, (d + c, q))
    children = [[] for _ in range(n)]
    for k in range(n):
        if parent[k] >= 0:
            children[parent[k]].append(k)
    order = sorted(range(n), key=lambda k: -(dist[k] or 0))
    height = [0.0] * n                                     # längster Weg nach außen
    for k in order:
        for c in children[k]:
            height[k] = max(height[k], height[c] + (_SQ2 if SK_LIST[c][0] != SK_LIST[k][0] and SK_LIST[c][1] != SK_LIST[k][1] else 1.0))
    arms = []
    arm_of = [-1] * n
    starts = [k for k in sorted(range(n), key=lambda k: dist[k] or 0) if parent[k] < 0 or max(children[parent[k]], key=lambda c: height[c]) != k]
    for k in starts:
        path = [k]
        while children[path[-1]]:
            path.append(max(children[path[-1]], key=lambda c: height[c]))
        ai = len(arms)
        for q in path:
            arm_of[q] = ai
        arms.append(dict(path=path, fork=parent[k]))        # fork: Pixel des Elternarms, an dem er sitzt (-1: am Körper)
    return arms, arm_of


ARMS, ARM_OF = _build_tree()
_rng = np.random.RandomState(11)
for a in ARMS:                                              # eigene Phase, Frequenz (Perioden pro Loop), Stärke und Richtung je Arm
    L = len(a['path'])
    a['phase'] = float(_rng.uniform(0, 2 * math.pi))
    a['cycles'] = int(_rng.choice([1, 2, 3], p=[0.35, 0.4, 0.25]))
    a['amp'] = float(np.clip(0.14 * L + 1.0, 0.0, 4.2)) if L >= 4 else 0.0
    a['dir'] = 1 if _rng.rand() < 0.5 else -1


def _tangent(path, i):
    p0 = SK_LIST[path[max(0, i - 2)]]
    p1 = SK_LIST[path[min(len(path) - 1, i + 2)]]
    tx, ty = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(tx, ty) or 1.0
    return tx / L, ty / L


SK_TAN = [(0.0, 0.0)] * len(SK_LIST)
SK_POS = [0] * len(SK_LIST)
for a in ARMS:
    for i, k in enumerate(a['path']):
        SK_TAN[k] = _tangent(a['path'], i)
        SK_POS[k] = i
ARM_ORDER = sorted(range(len(ARMS)), key=lambda ai: (0 if ARMS[ai]['fork'] < 0 else 1))


ARM_PARENT = [ARM_OF[a['fork']] if a['fork'] >= 0 else -1 for a in ARMS]


def _verwandt(a, b):
    """Derselbe Arm, oder Elternarm/Seitenarm an einer Abzweigung."""
    return a == b or ARM_PARENT[a] == b or ARM_PARENT[b] == a


def arm_offsets(i):
    """Verschiebung (dx, dy) je Strangpixel; Frame 0 = Ruhe. Seitenarme sitzen auf der Verschiebung ihrer Abzweigung."""
    off = np.zeros((len(SK_LIST), 2))
    done = set()

    def do(ai):
        if ai in done:
            return
        a = ARMS[ai]
        base = np.zeros(2)
        if a['fork'] >= 0:
            fa = ARM_OF[a['fork']]
            do(fa)
            base = off[a['fork']]
        L = len(a['path'])
        w = 2 * math.pi * a['cycles'] * i / N
        for idx, k in enumerate(a['path']):
            u = idx / max(1, L - 1)
            f = u ** 1.15
            wave = math.sin(w - 0.3 * idx + a['phase']) - math.sin(-0.3 * idx + a['phase'])
            tx, ty = SK_TAN[k]
            g = a['amp'] * f * wave * 0.5 * a['dir']
            off[k] = (base[0] - ty * g, base[1] + tx * g)
        done.add(ai)

    for ai in range(len(ARMS)):
        do(ai)
    return off


def _nearest_sk(points):
    if not SK_LIST:
        return np.zeros(len(points), int), np.full(len(points), 99.0)
    P = np.array(points, float)
    S = np.array(SK_LIST, float)
    d = ((P[:, None, :] - S[None, :, :]) ** 2).sum(2)
    return d.argmin(1), np.sqrt(d.min(1))


FIELD_PTS = [(x, y) for y in range(SH) for x in range(SW)]
_idx, _dist = _nearest_sk(FIELD_PTS)
FIELD = {}                                                  # Zielpixel -> Strangpixel (Strangpixel immer, leere Pixel nur nahe daran)
for (x, y), k, d in zip(FIELD_PTS, _idx, _dist):
    if d <= 4.0 or (FLESH[y, x] and not BLADE[y, x]):
        FIELD[(x, y)] = int(k)

# Klingen: jede sitzt an der freien Spitze eines Arms (Blatt des Astbaums). Stahlpixel nahe einer Spitze sind
# Klingenbasen; jedes Stahlpixel gehört zur nächsten Basis, kleine Reste (von Strängen verdeckte Klingenteile)
# schlagen wir der nächsten größeren Klinge zu — so zerfällt keine Klinge, und anstoßende bleiben getrennt.
LEAVES = [a['path'][-1] for a in ARMS if len(a['path']) >= 2]
_by, _bx = np.nonzero(BLADE)
_bpts = list(zip(_bx.tolist(), _by.tolist()))
_leaf_xy = np.array([SK_LIST[k] for k in LEAVES], float) if LEAVES else np.zeros((0, 2))


def _leaf_dist(pt):
    if not len(_leaf_xy):
        return 99.0
    return float(np.sqrt(((_leaf_xy - np.array(pt, float)) ** 2).sum(1).min()))


_base = [pt for pt in _bpts if _leaf_dist(pt) <= 2.4]
_bm = np.zeros((SH, SW), np.uint8)
for x, y in _base:
    _bm[y, x] = 1
_nb, _blab = cv2.connectedComponents(cv2.dilate(_bm, np.ones((3, 3), np.uint8)), connectivity=8)
_clusters = [[pt for pt in _base if _blab[pt[1], pt[0]] == c] for c in range(1, _nb)]
_clusters = [c for c in _clusters if c]
_owner = {}
for pt in _bpts:
    _owner[pt] = min(range(len(_clusters)), key=lambda c: min((pt[0] - q[0]) ** 2 + (pt[1] - q[1]) ** 2 for q in _clusters[c]))
_size = {c: sum(1 for o in _owner.values() if o == c) for c in range(len(_clusters))}
_big = [c for c, n in _size.items() if n >= 30]
for c in [c for c in _size if c not in _big]:               # kleine Klingenreste -> nächste große Klinge
    if not _big:
        break
    pts = [pt for pt, o in _owner.items() if o == c]
    tgt = min(_big, key=lambda b: min((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 for p in pts for q in _clusters[b]))
    for pt in pts:
        _owner[pt] = tgt
BLADE_PARTS = []
for c in sorted({o for o in _owner.values()}):
    pts = [pt for pt, o in _owner.items() if o == c]
    m = np.zeros((SH, SW), bool)
    for pt in pts:
        m[pt[1], pt[0]] = True
    lk = min(LEAVES, key=lambda k: min((SK_LIST[k][0] - q[0]) ** 2 + (SK_LIST[k][1] - q[1]) ** 2 for q in _clusters[c]))
    BLADE_PARTS.append(dict(mask=m, sk=int(lk), name=f'b{c}',
                            hi=next((pt for pt in pts if tuple(SRC[pt[1], pt[0], :3]) == (255, 255, 255)), None)))
GLINT_START = [6, 14, 22, 30, 38, 43]       # in Frame 0 blitzt nichts (Ruhepose = Sprite)

# Monsterauge: weiße Pixel im Fleisch, die nicht zur Klinge gehören
_fd = cv2.distanceTransform((~FILL).astype(np.uint8), cv2.DIST_L2, 5)
EYE = [(x, y) for y, x in zip(*np.nonzero(OPAQUE & ~BLADE)) if min(SRC[y, x, :3]) >= 235 and _fd[y, x] <= 4.5 and _hdist[y, x] >= 0]


def _orig_holes():
    tmp = np.zeros((H, W, 4), int)
    tmp[PT:PT + SH, PL:PL + SW] = SRC
    filled = tmp.copy()
    fill_pinholes(filled)
    return (filled[:, :, 3] > 0) & (tmp[:, :, 3] == 0)


ORIG_HOLES = _orig_holes()


def frame(i):
    s = SRC.copy()
    glow = rgb(['ffffff', 'eef8ff', 'd4eaff', 'eef8ff'][((i + 1) // 2) % 4])          # Monsterauge glimmt
    for x, y in EYE:
        s[y, x] = glow
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(HUMAN)):                                              # Mensch: fest
        out[y + PT, x + PL] = s[y, x]
    off = arm_offsets(i)
    TM = FLESH & ~BLADE
    for (qx, qy), k in FIELD.items():                                                 # Stränge: rückwärts abtasten
        dx, dy = off[k]
        px, py = int(round(qx - dx)), int(round(qy - dy))
        if 0 <= px < SW and 0 <= py < SH and TM[py, px]:
            kp = FIELD.get((px, py))
            if kp is not None and not _verwandt(ARM_OF[k], ARM_OF[kp]):             # nie Pixel eines fremden Arms greifen
                continue
            out[qy + PT, qx + PL] = s[py, px]
    shifts = []
    for bp in BLADE_PARTS:                                                            # Klingen: starr mit der Spitze
        dx, dy = off[bp['sk']]
        sx, sy = int(round(dx)), int(round(dy))
        shifts.append((sx, sy))
        for y, x in zip(*np.nonzero(bp['mask'])):
            out[y + sy + PT, x + sx + PL] = s[y, x]
    before = out[:, :, 3] > 0
    fill_pinholes(out)
    out[ORIG_HOLES & ~before] = 0                                                     # Lücken des Sprites bleiben Lücken
    for bp, (sx, sy), start in zip(BLADE_PARTS, shifts, GLINT_START):                 # Stahl blitzt auf
        if bp['hi'] is None:
            continue
        gx, gy = bp['hi']
        for (px, py), c in sparkle_pixels(i, N, [(gx + sx + PL, gy + sy + PT, start)], rgb('e8f4ff'), rgb('ffffff')).items():
            if 0 < px < W - 1 and 0 < py < H - 1:
                out[py, px] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    print(f'{len(ARMS)} Arme (laengste: {sorted((len(a["path"]) for a in ARMS), reverse=True)[:8]}), {len(BLADE_PARTS)} Klingen, Auge: {EYE}')
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'parasyte_idle_{tag}', frames, ms, scale=6, check_edges=True)
