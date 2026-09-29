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
from anim_common import rgb, save_outputs, BOUNCE12, draw_bounce, ring8, sparkle_pixels

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
    'sparrow': dict(slug='sparrow-the-bumbling-buffoon', pads=(3, 3, 4, 4)),
    'pinta': dict(slug='pinta-the-singing-ship', pads=(8, 8, 10, 1)),
    'quisto': dict(slug='don-quisto-the-gold-seeker', knee=19, pads=(2, 14, 10, 1)),
    'sasza': dict(slug='sasza-the-snaka-adventurer', knee=17, pads=(3, 3, 3, 3)),
    'bulwark': dict(slug='diamond-the-bulwark-of-peace', knee=38, pads=(4, 4, 6, 2)),
    'cecilia': dict(slug='rescued-damsel-cecilia', pads=(5, 12, 3, 7)),
    'corruptor': dict(slug='bloom-the-continent-corruptor', pads=(12, 12, 12, 8)),
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


def clamp_chain(vals):
    out = [vals[0]]
    for v in vals[1:]:
        out.append(max(out[-1] - 1, min(out[-1] + 1, v)))
    return out


def figure_mask(base_fn):
    """Vereinigung aller Frames einer Figur + 1-px-Rand: hier dürfen Partikel nie hin."""
    fig = np.zeros((H, W), bool)
    for k in range(N):
        fig |= base_fn(k)[:, :, 3] > 0
    return fig | ring8(fig)


# ---------------------------------------------------------------- Sparrow
SP_BLINK = {'halb': [((5, 9), '03161d'), ((6, 9), '03161d'), ((9, 9), '03161d'), ((10, 9), '03161d')],
            'zu': [((x, 9), 'd8c6b5') for x in (5, 6, 9, 10)] + [((x, 10), '03161d') for x in (5, 6, 9, 10)]}
SP_COAT = {'090a0d', '302f3d', '20212b', '191921', '111217'}


def f_sparrow(i):
    """Er schwebt: der ganze Kerl steigt und sinkt, die Beine baumeln etwas nach, die Mantelschöße
    flattern, er blinzelt."""
    t = 2 * math.pi * i / N
    s = SRC.copy()
    blink(s, i, SP_BLINK)
    s[13, 8] = s[14, 8] = 0                               # der Sabberfaden wird eigens animiert
    dy = -round(2.4 * math.sin(2 * t))
    lag = -round(2.4 * math.sin(2 * t - 0.7))             # die Beine hängen einen Tick hinterher
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        dot(out, x + PL, y + PT + (lag if y >= 21 else dy), s[y, x])
    if lag > dy:                                          # die Beine hängen tiefer: die Lücke füllt das Bein
        for x in range(SW):
            if s[21, x, 3]:
                for k in range(lag - dy):
                    dot(out, x + PL, 21 + dy + k + PT, s[21, x])
    flutter(out, s, i, PL, PT + dy, list(range(12, 21)), range(0, 5), range(11, SW), amp=1.3, speed=4,
            ok=lambda c: hexc(c) in SP_COAT)
    a = i % 12                                            # er sabbert: der Faden wird länger, ein Tropfen reißt ab
    n = LY_DROOL[a]
    for k in range(n):
        dot(out, 8 + PL, 13 + k + PT + dy, rgb('ccffff' if k < n - 1 else '88ffff'))
    for e in range(9, N, 12):                             # der Tropfen fällt bis ganz nach unten
        k = (i - e) % N
        y0 = 16 + PT - round(2.4 * math.sin(2 * 2 * math.pi * e / N))
        y = y0 + 1 + 2 * k
        if y < H - 1 and k < 12:
            dot(out, 8 + PL, y, rgb('88ffff'))
    return out


# ---------------------------------------------------------------- Pinta
PI_WATER = {'11419b', '1b5fcd', '2573eb', 'b1f5ff', 'd9ffff'}
PI_EYE_OPEN = [(x, y) for y in (17, 18) for x in range(14, 19)] + [(x, 19) for x in range(16, 19)]
PI_BLINK = {'halb': [((x, 17), '404040') for x in range(14, 19)],
            'zu': [((x, 17), 'd7d7d7') for x in range(14, 19)] + [((x, 18), '404040') for x in range(14, 19)] +
                  [((x, 19), 'd7d7d7') for x in range(16, 19)]}
PI_NOTES = None


def note_templates():
    a = load('notes')
    import cv2
    n, lab = cv2.connectedComponents((a[:, :, 3] > 0).astype(np.uint8), connectivity=8)
    res = []
    for k in range(1, n):
        ys, xs = np.nonzero(lab == k)
        res.append({(x - xs.min(), y - ys.min()): a[y, x] for y, x in zip(ys, xs)})
    return res


PI_SAIL = {'696969', 'f5f5f5', '9b9b9b', 'd7d7d7', 'b9b9b9'}
PI_SAILS = [(0, 14, 6, 24, 1.6, 0.0), (14, 26, 1, 28, 2.2, 0.6), (26, 99, 4, 22, 1.6, 1.2)]   # Spalten, Zeilen, Bauch, Phase
PI_MOUTH = {'zu': [((7, 24), '370f05'), ((8, 24), '370f05'), ((7, 25), 'cd733c'), ((8, 25), 'cd733c'),
                   ((8, 26), 'b95f3c')],
            'halb': [((7, 25), '6c0000'), ((8, 25), '6c0000'), ((8, 26), 'b95f3c')]}
PI_SING = ['auf', 'auf', 'halb', 'zu', 'halb', 'auf', 'auf', 'auf', 'halb', 'zu', 'zu', 'halb']


def sails(s, i):
    """Die Segel blähen sich im Wind: in jeder Zeile rückt die windabgewandte (linke) Kante des Segels
    samt Kontur nach außen, bauchig (in der Segelmitte am weitesten), dazwischen wächst Segeltuch nach."""
    t = 2 * math.pi * i / N
    out = s.copy()
    sail = lambda y, x: s[y, x, 3] > 0 and hexc(s[y, x]) in PI_SAIL
    for x0, x1, top, bot, amp, ph in PI_SAILS:
        wind = 0.5 - 0.5 * math.cos(2 * t - ph)
        for y in range(top, bot + 1):
            dx = round(amp * math.sin(math.pi * (y - top) / (bot - top)) * wind)
            if not dx:
                continue
            xs = [x for x in range(max(1, x0), min(SW, x1)) if sail(y, x) and not sail(y, x - 1)]
            for xl in xs:                                 # linke Kante jedes Segelstücks
                if xl + 1 >= SW or not sail(y, xl + 1):
                    continue
                edge, cloth = s[y, xl], s[y, xl + 1]
                for k in range(1, dx + 1):
                    out[y, xl - k + 1] = cloth
                out[y, xl - dx] = edge
    return out


def water_layer(i):
    """Neu gezeichnetes Meer unter dem Schiff: zwei überlagerte Wellenzüge laufen durch, auf den Kämmen
    Schaum, darunter wird das Wasser dunkler, Glitzer wandert mit."""
    t = 2 * math.pi * i / N
    out = np.zeros((H, W, 4), int)
    span = {29: (6, 37), 30: (6, 37), 31: (8, 35), 32: (11, 32), 33: (15, 28)}
    surf = {}
    for x in range(span[29][0], span[29][1] + 1):
        surf[x] = 30 + round(0.7 * math.sin(0.55 * x - 4 * t) + 0.45 * math.sin(0.95 * x + 2 * t) - 0.2)
    for x, y0 in surf.items():
        for y in range(y0, 34):
            lo, hi = span[y]
            if not lo <= x <= hi:
                continue
            d = y - y0
            crest = d == 0 and surf.get(x - 1, 99) >= y0 and surf.get(x + 1, 99) >= y0
            c = 'd9ffff' if crest else 'b1f5ff' if d == 0 else '2573eb' if d == 1 else '1b5fcd' if d == 2 else '11419b'
            if y == 33 and (x + i // 3) % 3 == 0:
                continue                                  # der untere Rand franst aus
            out[y + PT, x + PL] = rgb(c)
    for k in range(4):                                    # Glitzer wandert mit den Wellen
        gx = 10 + (k * 7 + i // 2) % 24
        gy = surf.get(gx, 30) + 1
        if gy <= 32:
            out[gy + PT, gx + PL] = rgb('d9ffff')
    return out


def pinta_base(i):
    t = 2 * math.pi * i / N
    s = SRC.copy()
    blink(s, i, PI_BLINK)
    st = PI_SING[i % 12]                                  # sie singt: der Mund am Bug geht auf und zu
    if st != 'auf':
        for (x, y), c in PI_MOUTH[st]:
            s[y, x] = rgb(c)
    water = np.array([[s[y, x, 3] > 0 and hexc(s[y, x]) in PI_WATER for x in range(SW)] for y in range(SH)])
    s[water] = 0
    face = s.copy()
    s = sails(s, i)
    fm = (face[:, :, 3] > 0) & (_ys >= 13) & (_ys <= 19) & (_xs >= 13) & (_xs <= 20) & \
        ~np.isin(np.array([[hexc(c) for c in row] for row in face]), list(PI_SAIL))
    s[fm] = face[fm]                                      # das Auge liegt immer über dem ganzen Segel
    for y, x in zip(*np.nonzero(fm)):                     # samt seinem Rand aus Segeltuch
        for yy, xx in ((y, x - 1), (y, x + 1)):
            if not fm[yy, xx] and face[yy, xx, 3] and hexc(face[yy, xx]) in PI_SAIL and 13 <= xx <= 20:
                s[yy, xx] = face[yy, xx]
    bob = 1 if math.sin(2 * t) > 0.25 else 0              # das Schiff taucht sacht ein und hebt sich wieder
    sway = round(2.4 * math.sin(t))                       # und treibt auf den Wellen vor und zurück
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if y + bob < 31:
            dot(out, x + sway + PL, y + bob + PT, s[y, x])
    wl = water_layer(i)
    m = wl[:, :, 3] > 0
    out[m] = wl[m]
    return out


def f_pinta(i):
    """Die Pinta singt: der Mund im Segel geht auf und zu, Noten steigen neben ihr auf; das Auge
    blinzelt, das Schiff taucht sacht ein, die Wellen darunter wogen, Schaumkronen laufen darüber."""
    global PI_NOTES
    if PI_NOTES is None:
        fig = figure_mask(pinta_base)
        tpl = note_templates()
        rng = np.random.default_rng(7)
        PI_NOTES, tries = [], 0
        while len(PI_NOTES) < 9 and tries < 20000:
            tries += 1
            e, L = int(rng.integers(N)), int(rng.integers(12, 18))
            k = int(rng.integers(len(tpl)))
            x0, y0 = rng.uniform(0, W - 4), rng.uniform(H * 0.25, H * 0.7)
            ph, drift = rng.uniform(0, 6.3), rng.uniform(-0.25, 0.25)
            path = [(int(round(x0 + drift * a + 1.2 * math.sin(0.5 * a + ph))), int(round(y0 - 0.8 * a))) for a in range(L)]
            ok = all(1 <= x + dx < W - 1 and 1 <= y + dy < H - 1 and not fig[y + dy, x + dx]
                     for x, y in path for (dx, dy) in tpl[k])
            if ok and sum(1 for r in PI_NOTES if min((e - r[0]) % N, (r[0] - e) % N) <= 3) < 2:
                PI_NOTES.append((e, L, k, path))
        PI_NOTES = (tpl, PI_NOTES)
    tpl, notes = PI_NOTES
    out = pinta_base(i)
    for e, L, k, path in notes:
        a = (i - e) % N
        if a < L:
            x, y = path[a]
            for (dx, dy), c in tpl[k].items():
                if a >= L - 3 and (dx + dy + a) % 2:              # verblasst am Ende
                    continue
                dot(out, x + dx, y + dy, c)
    return out


# ---------------------------------------------------------------- Don Quisto
QU_BLINK = {'halb': [((7, 9), '000000')],
            'zu': [((7, 9), 'c69863'), ((11, 9), 'c69863'), ((7, 10), '000000'), ((11, 10), '000000')]}
QU_MUZZLE = 25                                          # letzte Spalte der Handkanone
QU_HOT = {'692110', '592500', '591000', '593e00', '591b00'}
QU_SHOTS = (6, 22, 38)                                  # Schüsse
QU_EMBER = ['4a1406', '7a200c', 'a8301a', 'd8481c', 'f47a22', 'ffb440', 'fff0a0']


def _hash(*v):
    h = 2166136261
    for k in v:
        h = ((h ^ (k & 0xffffffff)) * 16777619) & 0xffffffff
    return h
QU_FLASH = {0: {(0, 0): 'ffffff', (1, 0): 'ffffff', (0, -1): 'fff6a0', (0, 1): 'fff6a0', (2, 0): 'fff6a0',
                (1, -1): 'ffd23c', (1, 1): 'ffd23c', (3, 0): 'ffd23c', (2, -2): 'ff8a1e', (2, 2): 'ff8a1e',
                (4, 0): 'ff8a1e', (0, -2): 'ffd23c', (0, 2): 'ffd23c'},
            1: {(0, 0): 'fff6a0', (1, 0): 'ffd23c', (2, 0): 'ff8a1e', (0, -1): 'ff8a1e', (0, 1): 'ff8a1e',
                (3, -1): 'ee2d24', (3, 1): 'ee2d24'},
            2: {(1, 0): 'ee2d24', (2, -1): 'a02010'}}
QU_SMOKE = None


def quisto_base(i):
    s = SRC.copy()
    blink(s, i, QU_BLINK)
    since = min((i - st) % N for st in QU_SHOTS)
    heat = max(0.0, 1.0 - since / 10)                      # nach dem Schuss glüht die Mündung, kühlt ab
    glow = 0.5 + 0.5 * math.sin(2 * math.pi * i / 8)      # und glimmt immer
    for y in range(SH):
        for x in range(QU_MUZZLE - 2, QU_MUZZLE + 1):
            if s[y, x, 3] and hexc(s[y, x]) in QU_HOT:    # Glut: nie einfarbig – Verlauf, zur Mitte heißer,
                lvl = 1 + 2.4 * heat + 0.8 * glow + (x - QU_MUZZLE + 1) * 0.8 - 0.35 * abs(y - 12.5)
                lvl += (_hash(x, y, i // 2) % 3) - 1      # jedes Pixel flackert für sich
                s[y, x] = rgb(QU_EMBER[max(0, min(len(QU_EMBER) - 1, round(lvl)))])
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, B24[i % 24], KNEE, PT, PL)
    return out


def f_quisto(i):
    """Don Quisto federt und blinzelt; seine Handkanone ist glühend heiß: die Mündung glimmt, aus der
    Öffnung kräuselt Rauch; dreimal je Loop feuert sie (Mündungsfeuer, danach quillt eine Rauchwolke)."""
    global QU_SMOKE
    out = quisto_base(i)
    b = B24[i % 24]
    t = 2 * math.pi * i / N
    my = 12 + PT + b                                      # Mündungsfeuer
    for st in QU_SHOTS:
        a = (i - st) % N
        if a in QU_FLASH:
            for (dx, dy), c in QU_FLASH[a].items():
                dot(out, QU_MUZZLE + 1 + dx + PL, my + dy, rgb(c))
        if 1 <= a < 13:                                   # danach quillt Rauch aus der Öffnung und zieht davon
            k = a - 1
            cx, cy = QU_MUZZLE + 2 + 0.6 * k, 12.5 + PT + b - 0.5 * k
            r = 1.0 + 0.16 * k
            for yy in range(int(cy - 2), int(cy + 3)):
                for xx in range(int(cx - 2), int(cx + 3)):
                    if math.hypot(xx - cx, yy - cy) <= r:
                        c = 'b8b2aa' if (xx + yy) % 2 else '9a948c'
                        if xx > QU_MUZZLE or (0 <= xx + PL < W and not out[yy, xx + PL, 3]):
                            dot(out, xx + PL, yy, rgb(c, max(50, 220 - 15 * k)))
    for w in range(0, N, 2):                              # aus der glimmenden Öffnung qualmt es stetig
        a = (i - w) % N
        L = 13 + _hash(w) % 5
        if a < L:
            j = _hash(w, 7)
            x = QU_MUZZLE + 1.5 + 0.55 * a + 0.4 * math.sin(0.8 * a + j)
            y = my - 1.5 + (j % 4) - 0.7 * a
            r = 0.9 + 0.13 * a                            # die Schwaden wachsen und verblassen
            al = max(50, 215 - 12 * a)
            for yy in range(int(y - 2), int(y + 3)):
                for xx in range(int(x - 2), int(x + 3)):
                    if math.hypot(xx - x, yy - y) <= r and xx > QU_MUZZLE and 0 <= xx + PL < W:
                        c = 'c8c2ba' if (xx + yy + a) % 3 else '8e8880'
                        if out[yy, xx + PL, 3] < al:
                            dot(out, xx + PL, yy, rgb(c, al))
    return out


# ---------------------------------------------------------------- Sas'Za
SZ_BLINK = {'halb': [((x, 9), '311800') for x in (8, 9, 12, 13)],
            'zu': [((x, 9), 'f6bd98') for x in (8, 9, 12, 13)] + [((x, 10), '311800') for x in (8, 9, 12, 13)]}
SZ_HAIR = {'172145', '788cd2', '4863c2', '3d58b7', '1e2c5b', '2d4187', 'a2b0e0'}
SZ_SCALES = {'3f5d1d', '6c8527', '0c3304', '311800', '0f0a04'}


def f_sasza(i):
    """Sas'Za atmet und blinzelt, ihre blauen Haarspitzen wippen, der Schlangenleib unten wogt sacht."""
    s = SRC.copy()
    for y in range(8, 21):                                # die Bogensehne von Spitze zu Spitze (hinter ihr)
        if not s[y, 4, 3]:
            s[y, 4] = rgb('d8ccb0')
    blink(s, i, SZ_BLINK)
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL)
    flutter(out, s, i, PL, PT + b, list(range(0, 8)), range(3, 7), range(14, SW), amp=1.2, speed=5,
            ok=lambda c: hexc(c) in SZ_HAIR)
    t = 2 * math.pi * i / N
    for x in range(5, 16):                                # der Schlangenleib wogt: Spalten wandern sacht
        dy = round(0.9 * (math.sin(3 * t - 0.8 * x) - math.sin(-0.8 * x)))
        if dy <= 0:
            continue
        seg = [y for y in range(20, SH) if s[y, x, 3] and hexc(s[y, x]) in SZ_SCALES]
        if seg:
            dot(out, x + PL, max(seg) + dy + PT, s[max(seg), x])
    return out


def blend(out, x, y, c):
    """Halbtransparentes Pixel c über out legen."""
    if not (0 <= y < out.shape[0] and 0 <= x < out.shape[1]):
        return
    a = c[3] / 255
    if not out[y, x, 3]:
        out[y, x] = c
        return
    out[y, x, :3] = [int(c[k] * a + out[y, x, k] * (1 - a)) for k in range(3)]
    out[y, x, 3] = 255


# ---------------------------------------------------------------- Diamond, the Bulwark of Peace
BW_CRYSTAL = {'68a6a6', '80cccc', '91e6e6', 'b8e6e6'}
BW_SPARKLES = [(49, 3, 0), (21, 16, 8), (54, 16, 16), (7, 23, 24), (67, 23, 32), (36, 28, 40)]
BW_FIRE = ['ca2c29', 'f47b22', 'f6e70e', 'f7f5b8']
BW = None
BW_EMBERS = None
BW_SPK = None


def bw_sparkles():
    """Viele Glitzersterne auf den türkisen Kristallen: feste Kristallpixel (mindestens 6 px
    auseinander), gleichmäßig über den Loop verteilt – fast immer blitzt irgendwo einer."""
    global BW_SPK
    if BW_SPK is None:
        body = load('body')
        ys, xs = np.nonzero(body[:, :, 3])
        cand = [(x, y) for y, x in zip(ys, xs) if hexc(body[y, x]) in BW_CRYSTAL and y >= 2 and 2 <= x < SW - 2]
        rng = np.random.default_rng(11)
        rng.shuffle(cand)
        pts = [(x, y) for x, y, _ in BW_SPARKLES]
        for x, y in cand:
            if len(pts) >= 18:
                break
            if all(math.hypot(x - px, y - py) >= 6 for px, py in pts):
                pts.append((x, y))
        BW_SPK = [(x, y, round(k * N / len(pts))) for k, (x, y) in enumerate(pts)]
    return BW_SPK


def purple(c):
    r, g, b = int(c[0]), int(c[1]), int(c[2])
    return (b >= r and g < 0.7 * b + 10) or r + g + b < 30


def bulwark_fire(i, b):
    """Das Feuer am Fuß lodert: jede Spalte schlägt eigene Zungen nach oben (unten bleibt es stehen),
    die Farben folgen streng von außen nach innen: rot, orange, gelb, fast weiß."""
    fire = BW[2]
    m = fire[:, :, 3] > 0
    cols = [x for x in range(SW) if m[:, x].any()]
    new = np.zeros_like(m)
    for x in cols:
        ys = np.nonzero(m[:, x])[0]
        top, bot = ys.min(), ys.max()
        u = 1.3 * math.sin(2 * math.pi * (3 * i / N) + 1.7 * x) + 1.0 * math.sin(2 * math.pi * (5 * i / N) - 0.9 * x)
        new[max(0, top - round(max(-1.0, u + 0.6))):bot + 1, x] = True
    out = np.zeros((H, W, 4), int)
    ys, xs = np.nonzero(new)
    for y, x in zip(ys, xs):                              # Tiefe = Abstand zum Rand (4er-Nachbarschaft)
        d = 0
        while d < 3 and all(new[y + dy * (d + 1), x + dx * (d + 1)] if 0 <= y + dy * (d + 1) < SH and
                            0 <= x + dx * (d + 1) < SW else False for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            d += 1
        dot(out, x + PL, y + PT, rgb(BW_FIRE[d]))
    return out


def bulwark_base(i):
    global BW
    if BW is None:
        BW = load('gas'), load('body'), load('fire')
    gas, body, _ = BW
    t = 2 * math.pi * i / N
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    s = body.copy()
    g = (i % 24) * 3.6 - 14                               # Schimmer läuft schräg über die Kristalle
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if hexc(s[y, x]) in BW_CRYSTAL and abs(x + y * 0.6 - g) < 1.5:
            s[y, x, :3] = (s[y, x, :3] * 0.45 + np.array([235, 255, 255]) * 0.55).astype(int)
    fig = np.zeros((H, W, 4), int)
    draw_bounce(fig, s, b, KNEE, PT, PL)
    m = fig[:, :, 3] > 0
    out[m] = fig[m]
    for y, x in zip(*np.nonzero(gas[:, :, 3])):           # die Gaswolke liegt vor ihm und wallt hin und her
        c = gas[y, x]
        dx = round(1.4 * math.sin(2 * t - 0.45 * y) - 1.4 * math.sin(-0.45 * y)) if purple(c) else 0
        dot(out, x + dx + PL, y + PT, c)
    f = bulwark_fire(i, b)
    m = f[:, :, 3] > 0
    out[m] = f[m]
    return out


def f_bulwark(i):
    """Diamond, the Bulwark of Peace atmet, über seine Kristalle läuft ein Schimmer und Glitzersterne
    blitzen auf den Spitzen; das Feuer an seinem Fuß lodert (Funken steigen auf), die giftige
    Gaswolke wallt und stößt Schwaden aus."""
    global BW_EMBERS
    if BW_EMBERS is None:
        region = np.zeros((H, W), bool)
        region[PT + 30:PT + 58, PL + 38:PL + 60] = True
        emb = rising(bulwark_base, 12, 17, [rgb('f7f5b8'), rgb('f6e70e'), rgb('f47b22'), rgb('ca2c29')],
                     life=(5, 9), region=region)
        pregion = np.zeros((H, W), bool)
        pregion[PT + 36:PT + 62, 0:PL + 34] = True
        puffs = rising(bulwark_base, 14, 23, [rgb('8410ff', 200), rgb('7410d2', 170), rgb('6000ba', 130),
                                              rgb('420080', 90)], life=(7, 12), vy=(0.4, 0.7), region=pregion)
        BW_EMBERS = emb, puffs
    out = bulwark_base(i)
    b = B24[i % 24]
    for (x, y), c in sparkle_pixels(i, N, [(x + PL, y + PT + (b if y < KNEE else 0), t0) for x, y, t0 in bw_sparkles()],
                                    rgb('e0ffff'), rgb('91e6e6')).items():
        dot(out, x, y, c)
    draw_parts(out, BW_EMBERS[0], i)
    for e, steps in BW_EMBERS[1]:                         # Gasschwaden: 2x2, halbtransparent
        a = (i - e) % N
        if a < len(steps):
            for (x, y), c in steps[a].items():
                for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
                    if not out[y + dy, x + dx, 3]:
                        dot(out, x + dx, y + dy, c)
    return out


# ---------------------------------------------------------------- Rescued Damsel Cecilia
CE_PIVOT = (-6, -13)                                    # Aufhängung des Seils (oberhalb des Bildes)
CE_GRIP = (23, 50)                                      # hier hält sie das Seil
CE_HEART = {'fa7dff', 'fca7ff', 'f836ff'}
CE = None


def f_cecilia(i):
    """Die gerettete Cecilia schwingt mit dem Ritter im Arm am Seil hin und her (das Seil dreht sich
    um seine Aufhängung, die beiden hängen daran); die Herzchen um sie schweben auf und ab, das Herz
    in ihrem Auge pocht."""
    global CE
    if CE is None:
        rope, body, knight, blush = load('rope'), load('body'), load('knight'), load('blush')
        upper = rope.copy()
        upper[CE_GRIP[1] + 2:] = 0
        lower = rope.copy()
        lower[:CE_GRIP[1] + 2] = 0
        fig = np.zeros_like(body)
        for part in (lower, body, knight):
            m = part[:, :, 3] > 0
            fig[m] = part[m]
        import cv2
        hm = np.array([[fig[y, x, 3] > 0 and hexc(fig[y, x]) in CE_HEART for x in range(SW)] for y in range(SH)])
        n, lab = cv2.connectedComponents(hm.astype(np.uint8), connectivity=8)
        hearts = []
        for k in range(1, n):
            ys, xs = np.nonzero(lab == k)
            hearts.append({(x, y): fig[y, x].copy() for y, x in zip(ys, xs)})
        fig[hm] = 0
        CE = upper, fig, blush, hearts
    upper, fig, blush, hearts = CE
    t = 2 * math.pi * i / N
    ang = 9.0 * math.sin(2 * t)                           # zwei weite Schwünge je Loop
    a = math.radians(ang)
    gx, gy = CE_GRIP[0] - CE_PIVOT[0], CE_GRIP[1] - CE_PIVOT[1]
    dx = round(gx * math.cos(a) - gy * math.sin(a) - gx)
    dy = round(gx * math.sin(a) + gy * math.cos(a) - gy)
    out = rot_wing(upper, CE_PIVOT, ang, 1.0, 0) if ang else np.zeros((H, W, 4), int)
    if not ang:
        paste(out, upper, PL, PT)
    paste(out, fig, PL + dx, PT + dy)
    for y, x in zip(*np.nonzero(blush[:, :, 3])):
        blend(out, x + PL + dx, y + PT + dy, blush[y, x])
    for k, h in enumerate(hearts):
        cx = sum(x for x, _ in h) / len(h)
        cy = sum(y for _, y in h) / len(h)
        eye = 25 <= cx <= 29 and cy > 56                  # das Herz im Auge pocht an Ort und Stelle
        hy = 0 if eye else -round(1.5 * (0.5 - 0.5 * math.cos(3 * t + 1.3 * k)) * 2)
        big = eye and (i % 12) in (0, 1, 6)
        for (x, y), c in h.items():
            dot(out, x + PL + dx, y + PT + dy + hy, c)
        if big:
            for (x, y), c in h.items():
                for ex, ey in ((-1, 0), (1, 0)):
                    if (x + ex, y + ey) not in h:
                        dot(out, x + ex + PL + dx, y + ey + PT + dy, rgb('f836ff'))
    return out


# ---------------------------------------------------------------- Bloom, the Continent Corruptor
CO = None
CO_POLLEN = None
CO_RED = {'210000', '390000', '760000', '530000', '420000', '330000', '660000', '800000', 'b50000'}
CO_VINE = {'17414d', '19653b', '144f2e', '228a50'}
CO_HEAD = 24                                            # bis hierher schwankt die Blüte


CO_BASE = 48                                            # Fußzeile: darunter bleibt die Pflanze stehen
CO_COUGH = (4, 12, 20, 28, 36, 44)                      # Pollenstöße: die Blume hustet sie aus
CO_SCALE = [1.0, 0.97, 0.95, 1.08, 1.06, 1.04, 1.02, 1.01]   # ducken, strecken, zurücksinken
CO_V = [(11, 6), (16, 16), (23, 6)]                     # Blütenkelch: hier kommen die Pollen heraus
CO_LEAN = lambda i: 2.2 * math.sin(2 * 2 * math.pi * i / N)


def co_scale(i):
    a = min((i - c + 3) % N for c in CO_COUGH)
    return CO_SCALE[a] if a < len(CO_SCALE) else 1.0


def co_map(x, y, i):
    """Pflanzen- in Bildkoordinaten: gestreckt/geduckt über dem Fuß, oben schwankt die Blüte."""
    sc = co_scale(i)
    yd = CO_BASE - (CO_BASE - y) * sc if y < CO_BASE else y
    lean = CO_LEAN(i)
    dx = lean * ((CO_HEAD - y) / CO_HEAD) ** 1.2 if y < CO_HEAD else 0
    return x + dx + PL, yd + PT


def corruptor_base(i):
    global CO
    if CO is None:
        CO = load('stem'), load('leaves'), load('flower'), load('glow')
    stem, leaves, flower, glow = CO
    lean = CO_LEAN(i)
    sc = co_scale(i)
    chomp = (i % 8) in (4, 5)                             # das Maul schnappt
    plant = np.zeros((SH, SW, 4), int)
    for part in (stem, leaves, flower):
        p = part.copy()
        if part is flower and chomp:                      # Oberkiefer (Zeilen 37–41) klappt 1 px herunter
            jaw = np.zeros(p.shape[:2], bool)
            jaw[37:42, 10:19] = p[37:42, 10:19, 3] > 0
            q = p.copy()
            for y, x in sorted(zip(*np.nonzero(jaw)), reverse=True):
                q[y + 1, x] = p[y, x]
            p = q
        m = p[:, :, 3] > 0
        plant[m] = p[m]
    out = np.zeros((H, W, 4), int)
    top = min(np.nonzero(plant[:, :, 3].any(1))[0])
    for yd in range(0, SH + 4):                           # jede Zielzeile holt sich ihre Quellzeile (Strecken
        ys = round(CO_BASE - (CO_BASE - yd) / sc) if yd < CO_BASE else yd   # wiederholt Zeilen, Ducken lässt aus)
        if not top <= ys < SH:
            continue
        dx = round(lean * ((CO_HEAD - ys) / CO_HEAD) ** 1.2) if ys < CO_HEAD else 0
        for x in np.nonzero(plant[ys, :, 3])[0]:
            dot(out, x + dx + PL, yd + PT, plant[ys, x])
        for x in np.nonzero(glow[ys, :, 3])[0]:           # das Leuchten liegt halbtransparent darüber
            blend(out, x + dx + PL, yd + PT, glow[ys, x])
    src = out[PT:PT + SH, PL:PL + SW].copy()
    flutter(out, src, i, PL, PT, list(range(21, 37)), range(0, 12), range(21, SW), amp=1.2, speed=4,
            ok=lambda c: hexc(c) in CO_VINE)             # die Ranken peitschen
    return out


def f_corruptor(i):
    """Bloom, the Continent Corruptor: die riesige Blume schwankt, das Maul im Stängel schnappt, die Ranken
    peitschen. Sechsmal je Loop hustet sie Pollen aus: sie duckt sich, streckt sich ruckartig als Ganzes, und
    aus dem ganzen Blütenkelch schießt ein Pollenstoß hoch, der ringsum herabrieselt."""
    global CO_POLLEN
    if CO_POLLEN is None:
        fig = figure_mask(corruptor_base)
        rng = np.random.default_rng(29)
        CO_POLLEN = []
        for c in CO_COUGH:
            n, tries = 0, 0
            while n < 34 and tries < 8000:
                tries += 1
                u = rng.uniform(0, 1)                     # Startpunkt auf dem Blütenkelch (V)
                (ax, ay), (bx, by) = (CO_V[0], CO_V[1]) if u < 0.5 else (CO_V[1], CO_V[2])
                v = u * 2 if u < 0.5 else u * 2 - 1
                sx, sy = ax + (bx - ax) * v, ay + (by - ay) * v
                x, y = co_map(sx, sy, c)
                side = -1 if u < 0.5 else 1
                vx, vy = side * rng.uniform(0.2, 1.3), rng.uniform(-2.8, -1.6)
                e = c + int(rng.integers(0, 2))
                path = []
                for a in range(44):
                    path.append((int(round(x)), int(round(y))))
                    x, y = x + vx + 0.3 * math.sin(0.5 * a + u * 9), y + vy
                    vy = min(1.1, vy + 0.26)
                    vx *= 0.95
                    if y > H - 3:
                        break
                ok = all(1 <= x < W - 1 and 1 <= y < H - 1 for x, y in path) and \
                    all(not fig[y, x] for x, y in path[5:])
                if ok and len(path) > 14:
                    CO_POLLEN.append((e, path, int(rng.integers(3))))
                    n += 1
    out = corruptor_base(i)
    for e, path, kind in CO_POLLEN:
        a = (i - e) % N
        if a < len(path):
            x, y = path[a]
            c = rgb('ffff00', 150 + 40 * kind) if (a + kind) % 5 else rgb('ffffa0', 230)
            blend(out, x, y, c)
    return out


FRAME = dict(quetza=f_quetza, emerald=f_emerald, lyta=f_lyta, pete=f_pete, sparrow=f_sparrow, pinta=f_pinta,
             quisto=f_quisto, sasza=f_sasza, bulwark=f_bulwark, cecilia=f_cecilia, corruptor=f_corruptor)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6 if W < 90 else 3, check_edges=True)
