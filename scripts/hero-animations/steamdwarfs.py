# -*- coding: utf-8 -*-
"""Idle-Animationen für die Nachzügler aus MotiveSteamDwarfs.xcf (und Sas'Za aus Motive.xcf).

Aufruf: python3 steamdwarfs.py <tag> [ms] <variante>

Frame 0 ist immer die Ruhepose.

* quetza:   Quetzahuitl, Receiver of Sacrifices schlägt langsam mit den großen Federflügeln (Zeile für
            Zeile geschert und im Abschlag perspektivisch gestaucht, nie gedehnt), der Abschlag trägt
            ihn nach oben; die Federkrone am Kopf flattert.
* emerald:  Quetzahuitl the Emerald Dragon schwebt, eine Welle läuft durch den Schlangenleib, über die
            goldenen Ringe läuft ein Leuchten.
* lyta:     Little Lyta, the Amazon Princess schluchzt (federt im Takt, der Mund zittert), eine Träne
            rinnt über die Wange, der Federkopfschmuck flattert; ihr Speer steht daneben.
* pete:     Monsieur Pete, the Booty Raider hüpft vor Freude im Fass und lacht; die gelben
            Freude-Striche über ihm platzen bei jedem Hüpfer nach außen und ploppen neu auf.
"""
import math
import os
import sys
import numpy as np
from PIL import Image
from anim_common import rgb, save_outputs, BOUNCE12, draw_bounce, ring8

N = 48
OUT = os.environ.get('SD_OUT', '.')
B24 = [BOUNCE12[(k // 2) % 12] for k in range(24)]  # gemächlich: ein Federn je 24 Frames

V_ = {
    'quetza': dict(slug='quetzahuitl-receiver-of-sacrifices', pads=(8, 8, 6, 2)),
    'emerald': dict(slug='quetzahuitl-the-emerald-dragon', pads=(3, 3, 5, 5),
                    skin='Quetzahuitl, Receiver of Sacrifices'),
    'lyta': dict(slug='little-lyta-the-amazon-princess', knee=20, pads=(2, 2, 3, 1)),
    'pete': dict(slug='monsieur-pete-the-booty-raider', pads=(4, 4, 7, 1)),
}
V = next((v for v in sys.argv[2:] if v in V_), 'quetza')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load()
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C['pads']
H, W = SH + PT + PB, SW + PL + PR
_ys, _xs = np.mgrid[0:SH, 0:SW]


def hexc(c):
    return '%02x%02x%02x' % tuple(int(v) for v in c[:3])


def dot(out, x, y, c):
    if 0 <= y < out.shape[0] and 0 <= x < out.shape[1]:
        out[y, x] = c


def lighten(c, f):
    return [int(c[k] + (255 - c[k]) * f) for k in range(3)] + [int(c[3])]


def paste(out, a, ox, oy, mask=None):
    """a (Sprite-Koordinaten) deckend nach out, um (ox, oy) versetzt."""
    m = a[:, :, 3] > 0
    if mask is not None:
        m &= mask
    for y, x in zip(*np.nonzero(m)):
        dot(out, x + ox, y + oy, a[y, x])


def flutter(out, s, i, ox, oy, rows, left, right, amp=2.0, speed=6, ok=None, clamp=True):
    """Zipfel flattern nach außen: je Zeile schiebt sich die Spitze um 0..amp px hinaus und zurück
    (Welle von oben nach unten), das Original bleibt darunter – nichts reißt."""
    t = 2 * math.pi * i / N
    env = 0.5 - 0.5 * math.cos(2 * t)
    for side, xs in ((-1, left), (1, right)):
        dxs = [round(amp * env * (0.5 + 0.5 * math.sin(speed * t - 0.9 * k + (0 if side < 0 else 1.7))))
               for k in range(len(rows))]
        if clamp:
            for k in range(1, len(dxs)):
                dxs[k] = max(dxs[k - 1] - 1, min(dxs[k - 1] + 1, dxs[k]))
        for k, y in enumerate(rows):
            if dxs[k]:
                for x in xs:
                    if s[y, x, 3] and (ok is None or ok(s[y, x])):
                        dot(out, x + side * dxs[k] + ox, y + oy, s[y, x])


def rising(base_fn, count, seed, pal, life=(9, 15), vy=(0.7, 1.1), region=None, fall=False, wob=(0.5, 1.0)):
    """Partikel, die die Figur nie berühren (Vereinigung aller Frames + 1-px-Rand): steigen auf (oder
    fallen, fall=True), wackeln seitlich und laufen durch die Palette pal (Anfang -> Ende)."""
    fig = np.zeros((H, W), bool)
    for k in range(N):
        fig |= base_fn(k)[:, :, 3] > 0
    fig |= ring8(fig)
    rng = np.random.default_rng(seed)
    res, tries = [], 0
    while len(res) < count and tries < 30000:
        tries += 1
        e = int(rng.integers(N))
        L = int(rng.integers(*life))
        v, ph, wb = rng.uniform(*vy), rng.uniform(0, 6.3), rng.uniform(*wob)
        x0 = rng.uniform(1, W - 2)
        y0 = rng.uniform(1, H * 0.5) if fall else rng.uniform(H * 0.3, H - 2)
        steps, ok = [], True
        for a in range(L):
            x = int(round(x0 + wb * math.sin(0.6 * a + ph)))
            y = int(round(y0 + v * a)) if fall else int(round(y0 - v * a))
            if not (1 <= x < W - 2 and 1 <= y < H - 2) or fig[y, x] or (region is not None and not region[y, x]):
                ok = False
                break
            steps.append({(x, y): pal[min(len(pal) - 1, int(len(pal) * a / L))]})
        if not ok:
            continue
        if sum(1 for r in res if min((e - r[0]) % N, (r[0] - e) % N) <= 1) >= 3:
            continue
        res.append((e, steps))
    return res


def draw_parts(out, system, i):
    for e, steps in system:
        a = (i - e) % N
        if a < len(steps):
            for (x, y), c in steps[a].items():
                out[y, x] = c


# ---------------------------------------------------------------- Quetzahuitl
QZ_ROOT = 72                                            # Flügelwurzel: darunter bleibt alles stehen
QZ_CREST = {'d7dc79', '0c2609', '2f5427'}              # Federkrone rechts am Kopf


def wing_rows(out, part, side, lean, squeeze, ox, oy, root=QZ_ROOT):
    """Flügel, der nach oben absteht: jede Zeile über der Wurzel wird als Ganzes waagrecht verschoben
    (außen am stärksten, side -1 = links) und die Höhe perspektivisch gestaucht (squeeze <= 1).
    Rückwärts abgebildet: jede Zielzeile holt sich genau eine Quellzeile – nichts wird gedehnt."""
    rows = [y for y in range(part.shape[0]) if part[y, :, 3].any()]
    top = min(rows)
    for yd in range(top, part.shape[0]):
        if yd >= root:
            ys = yd
        else:
            ys = root - round((root - yd) / squeeze)
            if ys < top:
                continue
        h = max(0, root - ys) / (root - top)
        dx = side * round(lean * h ** 1.3)
        for x in np.nonzero(part[ys, :, 3])[0]:
            dot(out, x + dx + ox, yd + oy, part[ys, x])


QZ = None


def f_quetza(i):
    global QZ
    if QZ is None:
        QZ = load('wingl'), load('wingr'), load('body')
    wl, wr, body = QZ
    ph = 2 * 2 * math.pi * i / N                          # zwei langsame Schläge je Loop
    lean = 4.0 * math.sin(ph)                             # > 0: Spitzen nach außen (Abschlag)
    squeeze = 1.0 - 0.09 * max(0.0, math.sin(ph))
    hover = -round(1.6 * math.sin(ph - 0.5) + 1.6 * math.sin(0.5))   # der Abschlag trägt ihn hoch
    out = np.zeros((H, W, 4), int)
    wing_rows(out, wl, -1, lean, squeeze, PL, PT + hover)
    wing_rows(out, wr, 1, lean, squeeze, PL, PT + hover)
    paste(out, body, PL, PT + hover)
    flutter(out, body, i, PL, PT + hover, list(range(70, 80)), [], range(76, SW), amp=1.2, speed=4,
            ok=lambda c: hexc(c) in QZ_CREST)
    return out


# ---------------------------------------------------------------- Emerald Dragon
EM_GOLD = {'facc59': 'fff679', '946c2d': 'facc59'}


def f_emerald(i):
    t = 2 * math.pi * i / N
    hover = -round(1.5 * math.sin(t))
    c = -12 + (SW + 24) * ((i % 24) / 24)                 # Leuchten läuft zweimal von links nach rechts
    out = np.zeros((H, W, 4), int)
    for x in range(SW):
        k = 2 * math.pi * x / 44
        dy = round(1.6 * (math.sin(k - 2 * t) - math.sin(k))) + hover
        for y in np.nonzero(SRC[:, x, 3])[0]:
            col = SRC[y, x]
            hx = hexc(col)
            if hx in EM_GOLD and abs(x - c) < 5:
                col = rgb(EM_GOLD[hx])
            dot(out, x + PL, y + PT + dy, col)
    return out


# ---------------------------------------------------------------- Little Lyta
LY_SPEAR = 19                                           # ab dieser Spalte: der Speer (steht still)
LY_FEATHER = {'994c2e', 'fdeac0', 'f7bd8f', 'fcd7ab', 'ec9772'}
LY_SOB = [0, -1, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0]          # kurzes Aufschluchzen


def f_lyta(i):
    s = SRC.copy()
    sob = (i // 12) % 2 == 1                              # jede zweite Viertelrunde schluchzt sie
    b = LY_SOB[i % 12] if sob else B24[i % 24]
    if sob and i % 2:                                     # der Mund zittert
        s[15, 9] = s[15, 10] = rgb('ff6098')
    k = i % 16                                            # die Träne rinnt über die Wange
    fig = SRC[:, :, 3] > 0
    fig[:, LY_SPEAR:] = False
    out = np.zeros((H, W, 4), int)
    body = s.copy()
    body[:, LY_SPEAR:] = 0
    draw_bounce(out, body, b, KNEE, PT, PL)
    paste(out, SRC, PL, PT, mask=_xs >= LY_SPEAR)
    flutter(out, s, i, PL, PT + b, list(range(1, 13)), range(0, 5), range(15, LY_SPEAR), amp=1.2, speed=5,
            ok=lambda c: hexc(c) in LY_FEATHER)
    if 4 <= k < 12:
        y = 16 + (k - 4) // 2
        dot(out, 11 + PL, y + PT + b, rgb('b8f5ff'))
        if y > 16:
            dot(out, 11 + PL, y - 1 + PT + b, rgb('8beeff'))
    return out


# ---------------------------------------------------------------- Monsieur Pete
PE_HOP = {k + st: d for st in (4, 20, 36) for k, d in enumerate([-1, -2, -3, -3, -2, -1])}
PE_LAUGH = set(range(3, 12)) | set(range(19, 28)) | set(range(35, 44))
PE_STROKES = [                                          # Freude-Striche: Pixel, Richtung nach außen
    ([(8, 0), (8, 1), (8, 2), (8, 3), (8, 4)], (0, -1)),
    ([(3, 2), (4, 3), (5, 4), (6, 5)], (-1, -1)),
    ([(15, 2), (16, 2), (17, 2), (18, 3), (19, 4), (20, 5), (20, 6), (20, 7)], (1, -1)),
    ([(14, 4), (15, 4), (16, 4), (17, 5), (18, 6), (18, 7), (18, 8)], (1, -1)),
    ([(0, 7), (1, 7), (2, 7), (3, 7), (4, 7)], (-1, 0)),
]
PE_BURST = [0, 1, 1, 2, None, None]                     # nach außen platzen, weg, neu aufploppen
PE_TORSO = 21                                           # diese Rumpfzeile wächst beim Hüpfen aus dem Fass


def f_pete(i):
    barrel, hole, body = load('barrel'), load('hole'), load('body')
    yellow = (body[:, :, 0] == 0xff) & (body[:, :, 1] == 0xd5) & (body[:, :, 3] > 0)
    body[yellow] = 0
    dy = PE_HOP.get(i, 0)
    if i in PE_LAUGH and i % 2:                           # lacht: der Mund geht auf
        for x in range(9, 13):
            body[18, x] = rgb('311800')
    out = np.zeros((H, W, 4), int)
    paste(out, barrel, PL, PT)
    paste(out, hole, PL, PT)
    paste(out, body, PL, PT + dy)
    for k in range(-dy):                                  # der Rumpf reicht weiter ins Fass
        y = 23 - k
        for x in np.nonzero(body[PE_TORSO, :, 3] & hole[y, :, 3])[0]:   # nur in der Fassöffnung
            dot(out, x + PL, y + PT, body[PE_TORSO, x])
    for j, (pts, (ux, uy)) in enumerate(PE_STROKES):
        a = (i - 4 - j % 2) % 16
        d = PE_BURST[a] if a < len(PE_BURST) else 0
        if d is None:
            continue
        for x, y in pts:
            dot(out, x + ux * d + PL, y + uy * d + PT + dy, rgb('ffd500' if d < 2 else 'ffe766'))
    return out


FRAME = dict(quetza=f_quetza, emerald=f_emerald, lyta=f_lyta, pete=f_pete)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6 if W < 90 else 3, check_edges=True)
