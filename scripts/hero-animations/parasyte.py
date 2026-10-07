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
* Die Klingen sitzen starr an ihrer Armspitze und schwingen als Ganzes mit.
* Dazu schlägt jede Klinge mehrmals pro Loop zu (2-4x, teils gleichzeitig): kurz ausholen, in drei Frames durchziehen, zurückkehren —
  wie das Schwert bei Toras, mit Schwungspur: Nachbilder der Klinge (heller Stahl, verblassend) bleiben drei Frames hängen.
* Das weiße Monsterauge glimmt; ab und zu blitzt der Stahl einer Klinge auf.
Aufruf (aus scripts/hero-animations):  python3 parasyte.py final 90
"""
import math
import sys
from PIL import Image
import numpy as np
import cv2
from anim_common import rgb, save_outputs, sparkle_pixels
from flap_common import fill_pinholes, rotate_part

SRC = np.array(Image.open('src/parasytic-shapeshifter.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
N = 48
K2 = 0.45
SLEW = 0.7
PAD = 28                                          # beim Rendern großzügiger Rand; am Ende auf den Inhalt zugeschnitten
PL = PR = PT = PB = PAD
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
        elif _near(p, STEEL_PAL, 8):
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
    a['cycles'] = int(_rng.choice([2, 3, 4], p=[0.3, 0.4, 0.3]))
    a['cycles2'] = a['cycles'] + int(_rng.choice([1, 2]))                  # zweite, schnellere Welle: nie ein ruhiger Moment
    a['phase2'] = float(_rng.uniform(0, 2 * math.pi))
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
        w2 = 2 * math.pi * a['cycles2'] * i / N
        gs = []
        for idx, k in enumerate(a['path']):
            u = idx / max(1, L - 1)
            f = u ** 1.15
            wave = math.sin(w - 0.3 * idx + a['phase']) - math.sin(-0.3 * idx + a['phase'])
            wave += 0.5 * (math.sin(w2 - K2 * idx + a['phase2']) - math.sin(-K2 * idx + a['phase2']))
            g = a['amp'] * a.get('boost', 1.0) * f * wave * 0.5 * a['dir']
            if gs:                                                  # Nachbarpixel dürfen sich um höchstens SLEW px gegeneinander verschieben -> Strang reißt nie
                g = min(gs[-1] + SLEW, max(gs[-1] - SLEW, g))
            gs.append(g)
        for idx, k in enumerate(a['path']):
            tx, ty = SK_TAN[k]
            g = gs[idx]
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
    piv = (float(np.mean([q[0] for q in _clusters[c]])), float(np.mean([q[1] for q in _clusters[c]])))   # Klingenbasis = Drehpunkt
    BLADE_PARTS.append(dict(mask=m, sk=int(lk), piv=piv, name=f'b{c}',
                            hi=next((pt for pt in pts if tuple(SRC[pt[1], pt[0], :3]) == (255, 255, 255)), None)))
for _bp in BLADE_PARTS:                                     # Arme mit Klinge schlackern kräftiger
    ARMS[ARM_OF[_bp['sk']]]['boost'] = 1.5
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


# ── Hiebe der Klingen (wie Toras' Schwert) ───────────────────────────────────
SLASH_T = 10                                                # Länge eines Hiebs in Frames (kurz: es wird oft zugeschlagen)
SLASH_AMP = 1.15                                            # Schlagwinkel (rad)
PERIODS = [16, 16, 12, 24, 16, 24]                          # Abstand zwischen zwei Hieben je Klinge (teilt 48 -> 3x/4x/2x pro Loop)
STARTS = [2, 2, 1, 6, 5, 12]                                # Hiebstart in der Periode; gleiche Werte = gleichzeitig. Frame 0 bleibt Ruhe
_cx, _cy = SW * 0.5, SH * 0.5
_order = sorted(range(len(BLADE_PARTS)), key=lambda k: math.atan2(BLADE_PARTS[k]['piv'][1] - _cy, BLADE_PARTS[k]['piv'][0] - _cx))


def _lead_sign(bp):
    """+1/-1: Drehsinn, bei dem die GEBOGENE (konvexe) Seite der Klinge vorangeht.
    Sehne Basis -> Spitze; der Schwerpunkt der Klinge liegt zur konvexen Seite hin neben der Sehne."""
    ys, xs = np.nonzero(bp['mask'])
    px, py = bp['piv']
    r = np.hypot(xs - px, ys - py)
    t = int(r.argmax())
    dx, dy = xs[t] - px, ys[t] - py
    n = math.hypot(dx, dy) or 1.0
    dx, dy = dx / n, dy / n
    cx, cy = xs.mean() - px, ys.mean() - py
    along = cx * dx + cy * dy
    sx, sy = cx - along * dx, cy - along * dy                    # Versatz des Schwerpunkts quer zur Sehne = konvexe Seite
    return 1 if (sx * -dy + sy * dx) > 0 else -1                  # Bewegungsrichtung bei positivem Winkel (Uhrzeigersinn): (-dy, dx)


for rank, k in enumerate(_order):                           # reihum versetzt; konvexe Seite immer voran
    BLADE_PARTS[k]['start'] = STARTS[rank % len(STARTS)]
    BLADE_PARTS[k]['period'] = PERIODS[rank % len(PERIODS)]
    BLADE_PARTS[k]['sign'] = _lead_sign(BLADE_PARTS[k])


def _ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def swing_angle(bp, i):
    """Winkel der Klinge im Frame i (rad): ausholen, durchziehen, kurz halten, zurück — alle `period` Frames."""
    t = (i - bp['start']) % bp['period']
    if t >= SLASH_T:
        return 0.0
    sg = bp['sign']
    S = SLASH_AMP * sg
    if t < 2:
        return -0.45 * sg * _ease((t + 1) / 2)
    if t < 5:
        return -0.45 * sg + (S + 0.45 * sg) * (0.4, 0.8, 1.0)[t - 2]
    if t == 5:
        return S + 0.1 * sg
    return S * (1 - _ease((t - 5) / 5.0))


AFTER = [('e6ebf0', 235), ('c4ccd4', 190), ('a2adb8', 140), ('7f8b98', 95)]   # Nachbilder: jung -> alt


def wobble(bp, i):
    """Eigenes Schlackern der Klinge um ihre Basis (rad); in Frame 0 genau 0."""
    w = 2 * math.pi * bp['wc'] * i / N
    return bp['wamp'] * (math.sin(w + bp['wph']) - math.sin(bp['wph'])) + 0.5 * bp['wamp'] * (math.sin(2 * w + 1.7 * bp['wph']) - math.sin(1.7 * bp['wph']))


for _k, _bp in enumerate(BLADE_PARTS):
    _bp['wc'] = [2, 3, 3, 2, 4, 3][_k % 6]
    _bp['wph'] = 1.3 * _k + 0.4
    _bp['wamp'] = 0.32


def blade_layer(s, bp, ang, shift):
    return rotate_part(s, bp['mask'], bp['piv'], ang, (H, W), (PL + shift[0], PT + shift[1]))


def afterimages(out, s, bp, shift, i):
    """Schwungspur: die Klinge in den Winkeln der letzten Frames (und dazwischen), nach hinten verblassend."""
    ghost = np.zeros((H, W, 4), int)
    for k in range(len(AFTER) - 1, -1, -1):                 # alt zuerst, jung überschreibt
        a_hi, a_lo = swing_angle(bp, i - k), swing_angle(bp, i - k - 1)
        diff = abs(a_hi - a_lo)
        if diff < 0.22 or abs(a_hi) < abs(a_lo):             # nur beim schnellen Durchziehen nach vorn (nicht beim Zurückgehen)
            continue
        n = max(2, int(diff / 0.1) + 1)
        c = rgb(AFTER[k][0])
        for j in range(n):
            a = a_lo + (a_hi - a_lo) * (j + 0.5) / n + wobble(bp, i - k)
            m = blade_layer(s, bp, a, shift)[:, :, 3] > 0
            ghost[m] = (c[0], c[1], c[2], AFTER[k][1])
    put = (ghost[:, :, 3] > 0) & (out[:, :, 3] == 0)
    out[put] = ghost[put]


def _line(p, q):
    (x0, y0), (x1, y1) = p, q
    n = max(abs(x1 - x0), abs(y1 - y0))
    return [(int(round(x0 + (x1 - x0) * t / n)), int(round(y0 + (y1 - y0) * t / n))) for t in range(1, n)] if n > 1 else []


def bridge_strands(out, s, off):
    """Wo ein Strang beim Schlackern auseinanderklafft (Nachbarn > 1 px entfernt), Lücke mit Strangfarbe samt Kontur schließen."""
    bridges = []
    for a in ARMS:
        path = a['path']
        for j in range(len(path) - 1):
            k0, k1 = path[j], path[j + 1]
            p = (int(round(SK_LIST[k0][0] + off[k0][0])), int(round(SK_LIST[k0][1] + off[k0][1])))
            q = (int(round(SK_LIST[k1][0] + off[k1][0])), int(round(SK_LIST[k1][1] + off[k1][1])))
            for (x, y) in _line(p, q):
                bridges.append((x, y, tuple(SRC[SK_LIST[k0][1], SK_LIST[k0][0], :3])))
    for x, y, c in bridges:
        yy, xx = y + PT, x + PL
        if out[yy, xx, 3] == 0:
            out[yy, xx] = (c[0], c[1], c[2], 255)
    for x, y, c in bridges:                                                           # Kontur um die Brücke
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            yy, xx = y + PT + dy, x + PL + dx
            if out[yy, xx, 3] == 0:
                out[yy, xx] = (OUTLINE_COL[0], OUTLINE_COL[1], OUTLINE_COL[2], 255)


def frame(i):
    s = SRC.copy()
    glow = rgb(['ffffff', 'eef8ff', 'd4eaff', 'eef8ff'][((i + 1) // 2) % 4])          # Monsterauge glimmt
    for x, y in EYE:
        s[y, x] = glow
    out = np.zeros((H, W, 4), int)
    off = arm_offsets(i)
    shifts = [(int(round(off[bp['sk']][0])), int(round(off[bp['sk']][1]))) for bp in BLADE_PARTS]
    for y, x in zip(*np.nonzero(HUMAN)):                                              # Mensch: fest
        out[y + PT, x + PL] = s[y, x]
    TM = FLESH & ~BLADE
    for (qx, qy), k in FIELD.items():                                                 # Stränge: rückwärts abtasten
        dx, dy = off[k]
        px, py = int(round(qx - dx)), int(round(qy - dy))
        if 0 <= px < SW and 0 <= py < SH and TM[py, px]:
            kp = FIELD.get((px, py))
            if kp is not None and not _verwandt(ARM_OF[k], ARM_OF[kp]):             # nie Pixel eines fremden Arms greifen
                continue
            out[qy + PT, qx + PL] = s[py, px]
    bridge_strands(out, s, off)
    for bp, sh in zip(BLADE_PARTS, shifts):                                           # Klingen: mit der Spitze, im Hieb gedreht
        ang = swing_angle(bp, i) + wobble(bp, i)
        if ang == 0.0:
            for y, x in zip(*np.nonzero(bp['mask'])):
                out[y + sh[1] + PT, x + sh[0] + PL] = s[y, x]
        else:
            lay = blade_layer(s, bp, ang, sh)
            m = lay[:, :, 3] > 0
            out[m] = lay[m]
    before = out[:, :, 3] > 0
    fill_pinholes(out)
    out[ORIG_HOLES & ~before] = 0                                                     # Lücken des Sprites bleiben Lücken
    for bp, sh in zip(BLADE_PARTS, shifts):                                           # Schwungspur nur auf leeren Pixeln
        afterimages(out, s, bp, sh, i)
    for bp, (sx, sy), start in zip(BLADE_PARTS, shifts, GLINT_START):                 # Stahl blitzt auf
        if bp['hi'] is None:
            continue
        gx, gy = bp['hi']
        ang = swing_angle(bp, i) + wobble(bp, i)
        if ang:                                                                       # Glanzpunkt dreht mit
            ca, sa = math.cos(ang), math.sin(ang)
            rx, ry = gx - bp['piv'][0], gy - bp['piv'][1]
            gx, gy = int(round(bp['piv'][0] + rx * ca - ry * sa)), int(round(bp['piv'][1] + rx * sa + ry * ca))
        for (px, py), c in sparkle_pixels(i, N, [(gx + sx + PL, gy + sy + PT, start)], rgb('e8f4ff'), rgb('ffffff')).items():
            if 0 < px < W - 1 and 0 < py < H - 1:
                out[py, px] = c
    return out


FACE_X, FACE_Y, FOOT_Y = 43.5, 31.0, 50.0       # Gesichtsmitte / Standlinie (Unterkante des Menschen) im Sprite


def crop_frames(frames):
    """Alle Frames auf die Vereinigung ihrer Inhalte zuschneiden (2 px Rand)."""
    ys = [np.nonzero(f[:, :, 3] > 0)[0] for f in frames]
    xs = [np.nonzero(f[:, :, 3] > 0)[1] for f in frames]
    y0, y1 = min(a.min() for a in ys) - 2, max(a.max() for a in ys) + 3
    x0, x1 = min(a.min() for a in xs) - 2, max(a.max() for a in xs) + 3
    pads = dict(padTop=int(PT - y0), padLeft=int(PL - x0), padRight=int(x1 - (PL + SW)), padBottom=int(y1 - (PT + SH)))
    return [f[y0:y1, x0:x1] for f in frames], pads


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    print(f'{len(ARMS)} Arme, {len(BLADE_PARTS)} Klingen (Hiebstart: {[(bp["start"], bp["period"]) for bp in BLADE_PARTS]})')
    frames = [frame(i) for i in range(N)]
    frames, pads = crop_frames(frames)
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'parasyte_idle_{tag}', frames, ms, scale=6, check_edges=True)
    h, w = frames[0].shape[:2]
    meta = {"hero": "Parasytic ???", "sheet": "parasytic.png", "frameWidth": w, "frameHeight": h, "frames": N, "frameMs": ms,
            "loop": True, "layout": "horizontal", "skinOf": "???, the Shapeshifter", **pads,
            "faceX": pads['padLeft'] + FACE_X, "faceY": pads['padTop'] + FACE_Y, "footY": pads['padTop'] + FOOT_Y}
    print('JSON:', meta)
