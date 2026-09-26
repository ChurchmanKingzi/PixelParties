# -*- coding: utf-8 -*-
"""Ebenenzerlegung für Medea, the Swamp Witch (96x73).

BODY    Medea ohne Schlangen
SNAKES  die drei Schlangen außerhalb des Körpers (je eigene Maske)
EMIT    Gas, das direkt vor dem Körper liegt (Austritt an Kapuze/Ärmeln)
CLOUD_* violette / grüne / graue Wolke (hinter dem Körper)
Die violette Wolke war oben abgeschnitten und wird hier vervollständigt.
"""
import math
from PIL import Image
import numpy as np

G = np.array(Image.open('src/medea-the-swamp-witch.png').convert('RGBA')).astype(int)
REF = np.array(Image.open('src/medea-the-swamp-witch-ohne-gas.png').convert('RGBA')).astype(int)
H, W = G.shape[:2]
OFF_X, OFF_Y = 15, 27

CRE = np.zeros_like(G)
for y in range(REF.shape[0]):
    for x in range(REF.shape[1]):
        if REF[y, x, 3]:
            CRE[y + OFF_Y, x + OFF_X] = REF[y, x]

# ---------------------------------------------------------------- Schlangen
SNAKE_BOXES = {
    'S1': (38, 47, 53, 60, 46),     # x0, x1, y0, y1, Robenansatz-x (ab hier fest)
    'S2': (18, 37, 56, 66, None),
    'S3': (58, 77, 60, 70, None),
}


def is_snake_color(c):
    r, g, b, a = c
    if a == 0:
        return False
    greenish = g > r and g > b and g >= 25          # Grün-/Oliv-Schuppen, Kontur
    yellow = r > 200 and g > 200 and b < 80         # Augen
    white = r > 230 and g > 230 and b > 230         # Zähne
    return greenish or yellow or white


SNAKE_MASK = {}
for name, (x0, x1, y0, y1, _) in SNAKE_BOXES.items():
    m = set()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c = tuple(CRE[y, x])
            if name == 'S3' and y >= 68 and c[3] and c[3] < 255:
                m.add((x, y))                        # Schlagschatten mitnehmen
            elif is_snake_color(c):
                m.add((x, y))
    SNAKE_MASK[name] = m

BODY = CRE.copy()
for m in SNAKE_MASK.values():
    for x, y in m:
        BODY[y, x] = 0

# ---------------------------------------------------------------- Gas
DIFF = np.any(G != CRE, axis=2)
EMIT = np.zeros_like(G)
GAS = np.zeros_like(G)
for y in range(H):
    for x in range(W):
        if not DIFF[y, x]:
            continue
        if CRE[y, x, 3] > 0:
            EMIT[y, x] = G[y, x]
        else:
            GAS[y, x] = G[y, x]

PURPLE = [(0, 0, 0), (13, 0, 74), (45, 3, 128), (97, 54, 183)]
GREEN = [(0, 43, 0), (0, 78, 11), (0, 112, 32), (0, 187, 68)]
GREY = [(0, 0, 0), (17, 17, 17), (53, 53, 53), (127, 127, 127)]


def family(c):
    r, g, b = c[:3]
    if r == g == b == 0:
        return None                                # Kontur: nach Nachbarn
    if g > r + 10 and g > b:
        return 'green'
    if b > r + 15 and b > g + 15:
        return 'purple'
    return 'grey'


FAMILY_ORDER = ['purple', 'green', 'grey']
FAM = {}
for y in range(H):
    for x in range(W):
        if GAS[y, x, 3]:
            FAM[(x, y)] = family(GAS[y, x])
for _ in range(4):                                  # Konturpixel zuordnen
    for (x, y), f in list(FAM.items()):
        if f is None:
            votes = [FAM.get((x + dx, y + dy)) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
            votes = [v for v in votes if v]
            if votes:
                # Gleichstand deterministisch auflösen (nicht vom String-Hashing abhängig)
                FAM[(x, y)] = max(sorted(set(votes), key=FAMILY_ORDER.index), key=votes.count)
for (x, y), f in FAM.items():
    if f is None:
        FAM[(x, y)] = 'purple' if y < 40 else ('green' if x < 48 else 'grey')

CLOUD = {k: np.zeros_like(G) for k in ('purple', 'green', 'grey')}
for (x, y), f in FAM.items():
    CLOUD[f][y, x] = GAS[y, x]

# ---------------------------------------------------------------- Vervollständigung oben
# Reihe runder Bäusche über der abgeschnittenen Oberkante (x 29..73, y ~16)
LOBES = [(34.5, 17.0, 5.0), (42.5, 13.5, 6.0), (51.0, 12.0, 6.6), (59.5, 13.5, 6.0),
         (67.5, 16.5, 5.2), (47.0, 8.5, 4.0), (56.0, 8.0, 3.8)]
CUT_Y = 18                  # bis hier wird die abgeschnittene Kante ersetzt
BLEND_TO = 26               # bis hier weicher Übergang ins Original
LOBE_ALPHA = 185
LIGHT_DIR = (-0.6, -0.8)


def lobe_field(x, y, lobes):
    """Bester Bausch (größte Eindringtiefe) und zweitbester."""
    scores = sorted(((r - math.hypot(x - cx, y - cy), k) for k, (cx, cy, r) in enumerate(lobes)),
                    reverse=True)
    return scores[0], scores[1]


def render_lobes(lobes, alpha):
    """Bäusche im Stil der Wolke: Kontur oben/seitlich, 3 Töne, Licht von oben links."""
    out = np.zeros((H, W, 4), dtype=int)
    inside = set()
    for y in range(H):
        for x in range(W):
            (s1, _), _ = lobe_field(x, y, lobes)
            if s1 >= 0 or (y > CUT_Y and y <= BLEND_TO and 29 <= x <= 73):
                inside.add((x, y))
    for x in range(W):                               # Lücken unter den Bäuschen füllen
        ys = [y for y in range(H) if (x, y) in inside and y <= CUT_Y]
        if ys:
            for y in range(min(ys), BLEND_TO + 1):
                inside.add((x, y))
    for (x, y) in inside:
        (s1, k1), (s2, k2) = lobe_field(x, y, lobes)
        edge = y <= CUT_Y + 1 and any((x + dx, y + dy) not in inside
                                      for dx, dy in ((1, 0), (-1, 0), (0, -1)))
        cx, cy, r = lobes[k1]
        nx, ny = (x - cx) / r, (y - cy) / r
        lit = nx * LIGHT_DIR[0] + ny * LIGHT_DIR[1]
        if edge:
            col = PURPLE[0]
        elif s1 >= 0 and s1 - s2 < 0.6 and s2 > 0.3:
            col = PURPLE[1]                          # Furche zwischen Bäuschen
        elif lit > 0.5:
            col = PURPLE[3]
        elif lit > -0.35:
            col = PURPLE[2]
        else:
            col = PURPLE[1]
        out[y, x] = (*col, alpha if not edge else min(255, alpha + 40))
    return out


def complete_purple(cloud):
    c = cloud.copy()
    lobes = render_lobes(LOBES, LOBE_ALPHA)
    for y in range(H):
        for x in range(W):
            orig = c[y, x].copy()
            if y <= CUT_Y:
                c[y, x] = lobes[y, x]
            elif y <= BLEND_TO and lobes[y, x, 3] and (
                    orig[3] > 0 or lobe_field(x, y, LOBES)[0][0] >= 0):
                # weicher Übergang: schwache Originalpixel durch Bausch ersetzen,
                # kräftige behalten; Deckkraft interpolieren
                t = (y - CUT_Y) / (BLEND_TO - CUT_Y)
                if orig[3] < 150:
                    c[y, x] = lobes[y, x]
                    c[y, x, 3] = int(LOBE_ALPHA * (1 - t) + max(orig[3], 110) * t)
    return c


CLOUD['purple'] = complete_purple(CLOUD['purple'])

# Weichere Outline: Schwarz -> dunkles Indigo, etwas durchscheinender
PURPLE_OUTLINE = (13, 0, 74)
OUTLINE_MAX_ALPHA = 160


def soften_outline(cloud):
    c = cloud.copy()
    for y in range(H):
        for x in range(W):
            if c[y, x, 3] and max(c[y, x, :3]) <= 20:
                c[y, x, :3] = PURPLE_OUTLINE
                c[y, x, 3] = min(c[y, x, 3], OUTLINE_MAX_ALPHA)
    return c


CLOUD['purple'] = soften_outline(CLOUD['purple'])

if __name__ == '__main__':
    for k, m in SNAKE_MASK.items():
        print(k, len(m))
    print('emit', int((EMIT[..., 3] > 0).sum()), {k: int((v[..., 3] > 0).sum()) for k, v in CLOUD.items()})
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for k in ('purple', 'green', 'grey'):
        img.alpha_composite(Image.fromarray(CLOUD[k].astype(np.uint8)))
    img.alpha_composite(Image.fromarray(BODY.astype(np.uint8)))
    img.alpha_composite(Image.fromarray(EMIT.astype(np.uint8)))
    sn = np.zeros_like(G)
    for m in SNAKE_MASK.values():
        for x, y in m:
            sn[y, x] = CRE[y, x]
    img.alpha_composite(Image.fromarray(sn.astype(np.uint8)))
    img.save('medea_recomposed.png')
