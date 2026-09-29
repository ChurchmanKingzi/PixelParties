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
    'quetza': dict(slug='quetzahuitl-receiver-of-sacrifices', pads=(10, 10, 6, 3)),
    'emerald': dict(slug='quetzahuitl-the-emerald-dragon', pads=(3, 3, 6, 6),
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


def f_quetza(i):
    global QZ
    if QZ is None:
        QZ = load('wingl'), load('wingr'), load('body')
    wl, wr, body = QZ
    body = body.copy()
    blink(body, i, QZ_BLINK)
    ph = 3 * 2 * math.pi * i / N                          # drei kräftige Schläge je Loop
    lean = 8.0 * math.sin(ph)                             # > 0: Spitzen nach außen (Abschlag), < 0: innen
    squeeze = 1.0 - 0.2 * max(0.0, math.sin(ph))
    hover = -round(3.0 * math.sin(ph - 0.5) + 3.0 * math.sin(0.5))   # der Abschlag trägt ihn hoch
    out = np.zeros((H, W, 4), int)
    wing_rows(out, wl, -1, lean, squeeze, PL, PT + hover)
    wing_rows(out, wr, 1, lean, squeeze, PL, PT + hover)
    paste(out, body, PL, PT + hover)
    flutter(out, body, i, PL, PT + hover, list(range(70, 80)), [], range(76, SW), amp=1.2, speed=4,
            ok=lambda c: hexc(c) in QZ_CREST)
    return out


# ---------------------------------------------------------------- Emerald Dragon
EM_GOLD = {'facc59': 'fff679', '946c2d': 'facc59'}
EM_HEAD = 60                                            # ab hier: der Kopf (bleibt beim Zusammenziehen stehen)
EM_BLINK = {'halb': [((68, 20), '946c2d'), ((71, 23), '946c2d')],
            'zu': [((68, 20), '000000'), ((71, 23), '000000')]}


def f_emerald(i):
    t = 2 * math.pi * i / N
    s = SRC.copy()
    blink(s, i, EM_BLINK)
    hover = -round(1.5 * math.sin(t))
    pull = 0.5 - 0.5 * math.cos(2 * t)                    # zweimal je Loop: der Leib zieht sich zusammen
    squeeze = 1.0 - 0.1 * pull
    amp = 1.6 + 2.4 * pull                                # zusammengezogen wirft er größere Wellen
    c = -12 + (SW + 24) * ((i % 24) / 24)                 # Leuchten läuft zweimal von links nach rechts
    out = np.zeros((H, W, 4), int)
    for xd in range(SW):
        x = xd if xd >= EM_HEAD else EM_HEAD - round((EM_HEAD - xd) / squeeze)
        if x < 0:
            continue
        k = 2 * math.pi * x / 44
        dy = round(amp * math.sin(k - 2 * t) - 1.6 * math.sin(k)) + hover
        if xd >= EM_HEAD:                                 # der Kopf schwingt nur sanft mit
            dy = round(1.6 * (math.sin(2 * math.pi * EM_HEAD / 44 - 2 * t) - math.sin(2 * math.pi * EM_HEAD / 44))) + hover
        for y in np.nonzero(s[:, x, 3])[0]:
            col = s[y, x]
            hx = hexc(col)
            if hx in EM_GOLD and abs(x - c) < 5:
                col = rgb(EM_GOLD[hx])
            dot(out, xd + PL, y + PT + dy, col)
    return out


# ---------------------------------------------------------------- Little Lyta
LY_SPEAR = 20                                           # ab dieser Spalte: der Speer (steht still)
LY_HAIR = {'994c2e', 'fdeac0', 'f7bd8f', 'fcd7ab', 'ec9772'}
LY_FACE = {(6, 11): '303030', (7, 11): 'd5a462', (8, 11): 'd5a462', (11, 11): 'd5a462', (12, 11): 'd5a462',
           (13, 11): '303030', (6, 12): '303030', (13, 12): '303030', (9, 12): 'f6cd8b', (10, 12): 'f6cd8b',
           (7, 12): '203a8c', (8, 12): '203a8c', (11, 12): '203a8c', (12, 12): '203a8c',
           (7, 13): '4f9cf0', (8, 13): '4f9cf0', (11, 13): '4f9cf0', (12, 13): '4f9cf0'}
LY_BLINK = {'halb': [((x, 12), '311800') for x in (7, 8, 11, 12)],
            'zu': [((x, 12), 'f6cd8b') for x in (7, 8, 11, 12)] + [((x, 13), '311800') for x in (7, 8, 11, 12)]}
HEART = {(0, 0): 'ff41ff', (2, 0): 'ffa4ff', (0, 1): 'ff41ff', (1, 1): 'ff74ff', (2, 1): 'ff74ff', (1, 2): 'ff41ff'}
HEART_BIG = {(-1, -1): 'ff41ff', (0, -1): 'ff74ff', (2, -1): 'ff74ff', (3, -1): 'ffa4ff',
             (-1, 0): 'ff41ff', (0, 0): 'ff74ff', (1, 0): 'ff74ff', (2, 0): 'ff74ff', (3, 0): 'ffa4ff',
             (0, 1): 'ff41ff', (1, 1): 'ff74ff', (2, 1): 'ff74ff', (1, 2): 'ff41ff'}
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
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    body = s.copy()
    body[:, LY_SPEAR:] = 0
    draw_bounce(out, body, b, KNEE, PT, PL)
    lyta_wind(out, body, i, PL, PT + b)
    paste(out, SRC, PL, PT, mask=_xs >= LY_SPEAR)
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
PE_BURST = [0, 1, 1, 2, None, None]                     # nach außen platzen, weg, neu aufploppen
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
