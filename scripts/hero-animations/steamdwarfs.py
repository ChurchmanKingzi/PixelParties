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
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}

V_ = {
    'quetza': dict(slug='quetzahuitl-receiver-of-sacrifices', pads=(22, 24, 6, 4)),
    'emerald': dict(slug='quetzahuitl-the-emerald-dragon', pads=(4, 4, 6, 6),
                    skin='Quetzahuitl, Receiver of Sacrifices'),
    'lyta': dict(slug='little-lyta-the-amazon-princess', knee=20, pads=(4, 2, 3, 1)),
    'pete': dict(slug='monsieur-pete-the-booty-raider', pads=(4, 4, 4, 1)),
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
QZ_BLINK = {'halb': [((72, 79), '051c09'), ((73, 79), '051c09')],
            'zu': [((72, 79), '112f12'), ((73, 79), '112f12'), ((72, 80), '051c09'), ((73, 80), '051c09'),
                   ((75, 83), '051c09')]}


def rot_wing(src, pivot, ang, span, oy, width=1.0):
    """Flügel um sein Schultergelenk drehen (ang in Grad, positiv = im Uhrzeigersinn), perspektivisch
    verkürzen (span <= 1) und quer zur Längsachse stauchen (width <= 1: der Flügel dreht sich um seine
    Längsachse und steht schmaler zum Betrachter). Rückwärts abgebildet mit 3x3-Überabtastung und
    Mehrheitsfarbe: keine Mischfarben, die Palette bleibt erhalten, nichts wird gedehnt."""
    m = src[:, :, 3] > 0
    cols, inv = np.unique(src[m][:, :3], axis=0, return_inverse=True)
    idx = np.full(src.shape[:2], -1)
    idx[m] = inv.ravel()
    ys, xs = np.nonzero(m)
    ax, ay = xs.mean() - pivot[0], ys.mean() - pivot[1]   # Längsachse: Gelenk -> Flügelmitte
    L = math.hypot(ax, ay)
    ax, ay = ax / L, ay / L
    Y, X = np.mgrid[0:H, 0:W]
    px_, py_ = pivot[0] + PL, pivot[1] + PT + oy
    a = math.radians(ang)
    c, s = math.cos(-a), math.sin(-a)
    votes = np.zeros((len(cols) + 1, H * W), int)
    for sx in (-0.33, 0.0, 0.33):
        for sy in (-0.33, 0.0, 0.33):
            dx, dy = X + sx - px_, Y + sy - py_
            rx, ry = dx * c - dy * s, dx * s + dy * c
            along = (rx * ax + ry * ay) / span
            perp = (-rx * ay + ry * ax) / (span * width)
            qx = np.rint(pivot[0] + along * ax - perp * ay).astype(int)
            qy = np.rint(pivot[1] + along * ay + perp * ax).astype(int)
            ok = (qx >= 0) & (qx < SW) & (qy >= 0) & (qy < SH)
            k = np.where(ok, idx[np.clip(qy, 0, SH - 1), np.clip(qx, 0, SW - 1)], -1)
            np.add.at(votes, (k.ravel() + 1, np.arange(H * W)), 1)
    best = votes.argmax(0)
    n = votes.max(0)
    rest = votes[1:].argmax(0) + 1
    take = (best == 0) & (n < 5) & (votes[1:].max(0) >= 4)
    best = np.where(take, rest, best)
    out = np.zeros((H, W, 4), int)
    sel = (best > 0).reshape(H, W)
    out[sel, :3] = cols[best.reshape(H, W)[sel] - 1]
    out[sel, 3] = 255
    return out


QZ_UNDER = {'c3a041': 'dccb8a', 'a58834': 'c2ab68', '8b6b26': 'a38b4d', '6c531d': '826c3c',
            '153816': '2f5427', '07220b': '1c3a1a', '375623': '4d7236'}


def wing_back(part):
    """Die Rückseite eines Flügels: die Federn blasser und heller (Unterseite), ihre Streifen laufen
    gespiegelt (jede Zeile wird zwischen Kontur und Knochen umgedreht), der Knochen heller."""
    out = part.copy()
    feather = lambda c: hexc(c) in ('c3a041', 'a58834', '8b6b26', '6c531d')
    for y in range(part.shape[0]):
        xs = [x for x in range(part.shape[1]) if part[y, x, 3] and feather(part[y, x])]
        runs, cur = [], []
        for x in xs:
            if cur and x != cur[-1] + 1:
                runs.append(cur)
                cur = []
            cur.append(x)
        if cur:
            runs.append(cur)
        for run in runs:
            for x, xr in zip(run, run[::-1]):
                out[y, x] = part[y, xr]
    for y, x in zip(*np.nonzero(out[:, :, 3])):
        h = hexc(out[y, x])
        if h in QZ_UNDER:
            out[y, x] = rgb(QZ_UNDER[h])
    return out


QZ_PIVOTS = ((51, 70), (58, 67))                        # Schultergelenke (links, rechts)
QZ_FLAP = [                                             # (Winkel nach außen/unten, Länge, Körper-y, Breite, Seite)
    (0, 1.0, 0, 1.0, 0), (-6, 1.0, 1, 1.0, 0), (-10, 1.0, 2, 1.0, 0), (-12, 1.0, 3, 1.0, 0),   # fällt, Flügel heben sich
    (40, 0.9, 0, 0.55, 0), (85, 0.72, -1, 0.6, 1),     # Schlag: schnell 3 px hoch, der Flügel dreht sich um seine
    (100, 0.62, -2, 1.0, 1), (95, 0.64, -2, 1.0, 1),   # Längsachse (schmal) und zeigt unten seine Rückseite
    (80, 0.7, -2, 0.85, 1), (60, 0.78, -2, 0.5, 1),    # Erholen: er dreht sich zurück …
    (45, 0.85, -1, 0.6, 0), (30, 0.9, -1, 0.85, 0),    # … und öffnet sich wieder mit der Vorderseite
    (18, 0.95, -1, 1.0, 0), (8, 0.98, 0, 1.0, 0), (3, 1.0, 0, 1.0, 0), (0, 1.0, 0, 1.0, 0)]
QZ_CACHE = {}


def f_quetza(i):
    global QZ
    if QZ is None:
        QZ = load('wingl'), load('wingr'), load('body')
    wl, wr, body = QZ
    body = body.copy()
    blink(body, i, QZ_BLINK)
    ang, span, dy, width, back = QZ_FLAP[i % 16]          # drei Schläge je Loop
    out = np.zeros((H, W, 4), int)
    wings = {}
    for part, pivot, side in ((wl, QZ_PIVOTS[0], -1), (wr, QZ_PIVOTS[1], 1)):
        key = (side, ang, span, dy, width, back)
        if key not in QZ_CACHE:
            if ang or span < 1 or width < 1 or back:
                QZ_CACHE[key] = rot_wing(wing_back(part) if back else part, pivot, side * ang, span, dy, width)
            else:
                QZ_CACHE[key] = np.zeros((H, W, 4), int)
                paste(QZ_CACHE[key], part, PL, PT + dy)
        wings[side] = QZ_CACHE[key]
    for layer in (wings[1], None, wings[-1]):             # rechter Flügel hinter, linker vor dem Körper
        if layer is None:
            paste(out, body, PL, PT + dy)
        else:
            m = layer[:, :, 3] > 0
            out[m] = layer[m]
    flutter(out, body, i, PL, PT + dy, list(range(70, 80)), [], range(76, SW), amp=1.2, speed=4,
            ok=lambda c: hexc(c) in QZ_CREST)
    return out


# ---------------------------------------------------------------- Emerald Dragon
EM_GOLD = {'facc59': 'fff679', '946c2d': 'facc59'}
EM_HEAD = 60                                            # ab hier: der Kopf (bleibt beim Zusammenziehen stehen)
EM_BLINK = {'halb': [((68, 20), '946c2d'), ((71, 23), '946c2d')],
            'zu': [((68, 20), '000000'), ((71, 23), '000000')]}


EM_PIECES = [(0, 28, 3), (28, 45, 2), (45, EM_HEAD, 1)]   # Leibstücke (Spalten) und wie weit sie nachrücken


def f_emerald(i):
    """Er schlängelt durch die Luft: der Kopf pendelt vor und zurück, der Leib zieht sich dabei
    zusammen, ohne schmaler zu werden – die Stücke rücken starr nach und schieben sich übereinander
    (das kopfnähere liegt oben); eine Welle läuft durch."""
    t = 2 * math.pi * i / N
    s = SRC.copy()
    blink(s, i, EM_BLINK)
    hover = -round(1.5 * math.sin(2 * t))
    lead = round(2.0 * math.sin(3 * t))                   # der Kopf pendelt dreimal je Loop vor und zurück
    pull = 0.5 - 0.5 * math.cos(3 * t)                    # der Leib zieht nach
    c = -12 + (SW + 24) * ((i % 24) / 24)                 # Leuchten läuft zweimal von links nach rechts
    out = np.zeros((H, W, 4), int)
    for x0, x1, reach in EM_PIECES + [(EM_HEAD, SW, 0)]:
        sh = lead + round(reach * pull)
        for x in range(x0, x1):
            k = 2 * math.pi * min(x, EM_HEAD) / 44
            dy = round(1.2 * (math.sin(k - 4 * t) - math.sin(k))) + hover
            for y in np.nonzero(s[:, x, 3])[0]:
                col = s[y, x]
                hx = hexc(col)
                if hx in EM_GOLD and abs(x - c) < 5:
                    col = rgb(EM_GOLD[hx])
                dot(out, x + sh + PL, y + PT + dy, col)
    return out


# ---------------------------------------------------------------- Little Lyta
LY_SPEAR = 20                                           # ab dieser Spalte: der Speer (steht still)
LY_HAIR = {'994c2e', 'fdeac0', 'f7bd8f', 'fcd7ab', 'ec9772'}
LY_FACE = {(6, 11): '303030', (7, 11): 'd5a462', (8, 11): 'd5a462', (11, 11): 'd5a462', (12, 11): 'd5a462',
           (13, 11): '303030', (6, 12): '303030', (13, 12): '303030', (9, 12): 'f6cd8b', (10, 12): 'f6cd8b',
           (7, 12): 'd0d4e0', (8, 12): '2f5fc0', (11, 12): '2f5fc0', (12, 12): 'd0d4e0',    # außen weiß, innen
           (7, 13): 'ffffff', (8, 13): '6aa8ff', (11, 13): '6aa8ff', (12, 13): 'ffffff'}   # blau, unten heller
LY_BLINK = {'halb': [((x, 12), '311800') for x in (7, 8, 11, 12)],
            'zu': [((x, 12), 'f6cd8b') for x in (7, 8, 11, 12)] + [((x, 13), '311800') for x in (7, 8, 11, 12)]}
HEART = {(0, 0): 'ff41ff', (2, 0): 'ffa4ff', (0, 1): 'ff41ff', (1, 1): 'ff74ff', (2, 1): 'ff74ff', (1, 2): 'ff41ff'}
HEART_BIG = {(-1, -1): 'ff41ff', (0, -1): 'ff74ff', (2, -1): 'ff74ff', (3, -1): 'ffa4ff',
             (-1, 0): 'ff41ff', (0, 0): 'ff74ff', (1, 0): 'ff74ff', (2, 0): 'ff74ff', (3, 0): 'ffa4ff',
             (0, 1): 'ff41ff', (1, 1): 'ff74ff', (2, 1): 'ff74ff', (1, 2): 'ff41ff'}
LY_DROOL = [2, 2, 3, 3, 3, 4, 4, 4, 4, 2, 2, 2]    # Länge des Sabberfadens (ab dem Mundwinkel)
LY_HEARTS = [((6, 11), -1, 0), ((11, 11), 1, 12)]       # (links oben, Flugrichtung, Phase)


def blink(s, i, table):
    st = BLINK.get(i)
    if st:
        for (x, y), c in table[st]:
            s[y, x] = rgb(c)


def lyta_wind(out, s, i, ox, oy):
    """Die blonde Mähne weht im Wind nach links: jedes zusammenhängende Haarstück einer Zeile rückt
    als Ganzes hinaus; wo es innen am Kopf anlag, wächst es nach (keine Lücke), außen bleibt nichts
    stehen. Der Kopf liegt davor."""
    t = 2 * math.pi * i / N
    gust = 0.5 - 0.5 * math.cos(2 * t)
    rows = list(range(0, 14))
    dxs = [round(2.2 * gust * (0.65 + 0.35 * math.sin(6 * t - 0.7 * y))) for y in rows]
    for k in range(1, len(dxs)):
        dxs[k] = max(dxs[k - 1] - 1, min(dxs[k - 1] + 1, dxs[k]))
    for y, dx in zip(rows, dxs):
        if not dx:
            continue
        hair = [x for x in range(LY_SPEAR) if s[y, x, 3] and hexc(s[y, x]) in LY_HAIR]
        runs, cur = [], []
        for x in hair:
            if cur and x != cur[-1] + 1:
                runs.append(cur)
                cur = []
            cur.append(x)
        if cur:
            runs.append(cur)
        for x in hair:
            out[y + oy, x + ox] = 0
        for run in runs:
            x0, x1 = run[0], run[-1]
            inner = x1 + 1 < LY_SPEAR and s[y, x1 + 1, 3] > 0     # rechts liegt der Kopf an
            for x in run:
                xx = x - dx
                if 0 <= xx + ox < out.shape[1] and not (s[y, xx, 3] and hexc(s[y, xx]) not in LY_HAIR if xx >= 0 else False):
                    out[y + oy, xx + ox] = s[y, x]
            if inner:
                for xx in range(x1 - dx + 1, x1 + 1):
                    out[y + oy, xx + ox] = s[y, x1]
        for x in range(LY_SPEAR):                          # der Kopf liegt vor der Mähne
            if s[y, x, 3] and hexc(s[y, x]) not in LY_HAIR:
                out[y + oy, x + ox] = s[y, x]


def f_lyta(i):
    s = SRC.copy()
    for (x, y), c in LY_FACE.items():                     # die Herzen weg: darunter ihre blauen Augen
        s[y, x] = rgb(c)
    blink(s, i, LY_BLINK)
    s[15, 11] = s[16, 11] = 0                             # der Sabberfaden wird eigens animiert
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    body = s.copy()
    body[:, LY_SPEAR:] = 0
    draw_bounce(out, body, b, KNEE, PT, PL)
    lyta_wind(out, body, i, PL, PT + b)
    paste(out, SRC, PL, PT, mask=_xs >= LY_SPEAR)
    a = i % 12                                            # der Sabberfaden: wird länger, ein Tropfen reißt ab
    n = LY_DROOL[a]
    for k in range(n):
        dot(out, 11 + PL, 15 + k + PT + b, rgb('b8f5ff' if k < n - 1 else '8beeff'))
    if a >= 9:
        dot(out, 11 + PL, 15 + 3 + (a - 8) + PT + b, rgb('8beeff'))
    for (hx0, hy0), side, ph in LY_HEARTS:               # die Herzen: eigene Partikel vor den Augen
        a = (i + ph) % 24
        if a < 14:                                        # vor dem Auge, schlägt zweimal
            shape, dx, dy = (HEART_BIG if a in (3, 4, 9, 10) else HEART), 0, 0
        elif a < 22:                                      # fliegt nach oben davon
            k = a - 13
            shape, dx, dy = HEART, side * round(0.8 * k), -round(1.3 * k)
        elif a == 22:
            shape, dx, dy = {(1, 1): 'ff74ff'}, 0, 0      # ploppt neu auf
        else:
            shape, dx, dy = HEART, 0, 0
        for (px, py), c in shape.items():
            dot(out, hx0 + px + dx + PL, hy0 + py + dy + PT, rgb(c))
    return out


# ---------------------------------------------------------------- Monsieur Pete
PE_BOB = [0, -1, -1, 0, 1, 2, 2, 1]                     # schnell rein und raus (ins Fass tiefer als hinaus)
PE_STROKES = [                                          # Freude-Striche: Pixel, Richtung nach außen
    ([(8, 0), (8, 1), (8, 2), (8, 3), (8, 4)], (0, -1)),
    ([(3, 2), (4, 3), (5, 4), (6, 5)], (-1, -1)),
    ([(15, 2), (16, 2), (17, 2), (18, 3), (19, 4), (20, 5), (20, 6), (20, 7)], (1, -1)),
    ([(14, 4), (15, 4), (16, 4), (17, 5), (18, 6), (18, 7), (18, 8)], (1, -1)),
    ([(0, 7), (1, 7), (2, 7), (3, 7), (4, 7)], (-1, 0)),
]
PE_BURST = [0, 1, 2]                                    # aufblitzen, nach außen rücken, weg (6er-Takt)
PE_PHASE = [0, 3, 1, 4, 2]
PE_TORSO = 21                                           # diese Rumpfzeile wächst beim Hochkommen aus dem Fass
PE_RIM = 20                                             # ab dieser Zeile verdeckt das Fass alles außer der Öffnung


def f_pete(i):
    barrel, hole, body = load('barrel'), load('hole'), load('body')
    yellow = (body[:, :, 0] == 0xff) & (body[:, :, 1] == 0xd5) & (body[:, :, 3] > 0)
    body[yellow] = 0
    dy = PE_BOB[i % 8]
    if (i // 2) % 2:                                      # lacht: der Mund unter dem Schnauzer geht auf
        body[16, 10] = body[16, 11] = rgb('2a0800')
        body[17, 10] = body[17, 11] = rgb('c0483a')
    inside = (hole[:, :, 3] > 0) | (body[:, :, 3] > 0)
    out = np.zeros((H, W, 4), int)
    paste(out, barrel, PL, PT)
    paste(out, hole, PL, PT)
    for y, x in zip(*np.nonzero(body[:, :, 3])):
        yy = y + dy
        if yy >= PE_RIM and not inside[yy, x]:            # taucht er ins Fass, verschwindet er hinter dem Rand
            continue
        dot(out, x + PL, yy + PT, body[y, x])
    for k in range(-dy):                                  # kommt er hoch, reicht der Rumpf weiter ins Fass
        y = 23 - k
        for x in np.nonzero(body[PE_TORSO, :, 3] & hole[y, :, 3])[0]:
            dot(out, x + PL, y + PT, body[PE_TORSO, x])
    for j, (pts, (ux, uy)) in enumerate(PE_STROKES):     # jeder Strich blitzt kurz auf und ist wieder weg
        a = (i + PE_PHASE[j]) % 6
        if a >= len(PE_BURST):
            continue
        d = PE_BURST[a]
        for x, y in pts:
            dot(out, x + ux * d + PL, y + uy * d + PT + dy, rgb('ffd500' if d < 2 else 'ffe766'))
    return out


FRAME = dict(quetza=f_quetza, emerald=f_emerald, lyta=f_lyta, pete=f_pete)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6 if W < 90 else 3, check_edges=True)
