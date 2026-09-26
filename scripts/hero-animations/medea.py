# -*- coding: utf-8 -*-
"""Idle-Animation für Medea, the Swamp Witch (96x73 + 6 px Rand oben = 96x79).

Ebenen (hinten -> vorne):
  1. Wolken (violett vervollständigt, grün, grau): brodeln, Wölkchen steigen auf
  2. Medea: ruhiges Atmen (Kapuze folgt verzögert), rotes Auge glimmt,
     die Schlangenaugen in der Robe blinzeln und wandern
  3. Austrittsgas an Kapuze/Ärmeln (klebt am Körper)
  4. Drei Giftschlangen: schlängeln sich unabhängig voneinander, Köpfe
     pendeln, Zungen züngeln
"""
import math
import sys
from PIL import Image
import numpy as np
import medea_layers as L

PAD = 6
N = 48
H0, W = L.H, L.W
H = H0 + PAD


def padded(a):
    return np.concatenate([np.zeros((PAD, W, 4), int), a])


BODY = padded(L.BODY)
EMIT = padded(L.EMIT)
CLOUDS = {k: padded(v) for k, v in L.CLOUD.items()}
CRE = padded(L.CRE)
SNAKES = {k: {(x, y + PAD) for x, y in m} for k, m in L.SNAKE_MASK.items()}
CLEAR = np.array([0, 0, 0, 0])


def wave(i, period, phase=0.0):
    return math.sin(2 * math.pi * i / period + phase)


# ---------------------------------------------------------------- Wolken
# Gas soll fließen statt wabbeln:
#  * Schlieren im Inneren steigen stetig auf (nach oben scrollendes Rauschen,
#    das die Tonstufe der Wolke um +-1 verschiebt; Kontur bleibt)
#  * am Rand laufen Kräuselwellen nach oben (Phase wandert mit der Zeit nach oben)
#  * Wind: der obere Teil der Wolke treibt seitlich, je höher desto mehr
#  * Fetzen lösen sich, treiben mit dem Wind davon und vergehen
CLOUD_PHASE = {'purple': 0.0, 'green': 2.1, 'grey': 4.2}
CLOUD_BASE = {'purple': 43 + PAD - 6, 'green': 62 + PAD - 6, 'grey': 62 + PAD - 6}
CLOUD_HEIGHT = {'purple': 36, 'green': 30, 'grey': 30}
WIND = {'purple': 1.0, 'green': -1.0, 'grey': 1.0}       # Hauptrichtung des Treibens
PAL = {'purple': [L.PURPLE_OUTLINE] + L.PURPLE[1:], 'green': L.GREEN, 'grey': L.GREY}

_rng = np.random.default_rng(11)
_n = _rng.random((24, W))
for _ in range(3):
    _n = (np.roll(_n, 1, 0) + 2 * _n + np.roll(_n, -1, 0)) / 4
    _n = (np.roll(_n, 1, 1) + 2 * _n + np.roll(_n, -1, 1)) / 4
FLOW_NOISE = (_n - _n.min()) / (_n.max() - _n.min())


def tone_index(pal, c):
    return min(range(4), key=lambda k: sum((int(c[j]) - pal[k][j]) ** 2 for j in range(3)))


def flow_cloud(c, name, i):
    ph = CLOUD_PHASE[name]
    base, height, wind = CLOUD_BASE[name], CLOUD_HEIGHT[name], WIND[name]
    pal = PAL[name]
    out = np.zeros_like(c)
    for y in range(H):
        up = max(0.0, min(1.0, (base - y) / height))            # 0 unten .. 1 oben
        # Wind: obere Wolke treibt seitlich (langsame Böe, Grundrichtung wind)
        drift = up ** 1.3 * (1.2 * wind + 1.3 * wave(i, N, ph))
        for x in range(W):
            # Kräuselwellen, die nach oben laufen (Phase ~ +y)
            ripple_x = 1.1 * up * wave(i, N / 2, 0.32 * y + 0.08 * x + ph)
            ripple_y = 0.9 * wave(i, N / 2, 0.30 * y + 0.21 * x + ph + 1.3)
            sx = int(round(x - drift - ripple_x))
            sy = int(round(y - ripple_y))
            if not (0 <= sx < W and 0 <= sy < H) or c[sy, sx, 3] == 0:
                continue
            col = c[sy, sx]
            k = tone_index(pal, col)
            if k > 0:                                           # Kontur unverändert
                n = FLOW_NOISE[(y + i // 2) % 24, (x + int(ph * 7)) % W]
                if n > 0.7:
                    k = min(3, k + 1)
                elif n < 0.3:
                    k = max(1, k - 1)
                out[y, x] = (*pal[k], col[3])
            else:
                out[y, x] = col
    return out


PUFFS = {  # Wolke: [(x, y (ungepolstert), Startframe)]
    'purple': [(47.0, 5.0, 0), (56.0, 4.5, 16), (40.0, 9.0, 32), (63.0, 10.0, 8),
               (34.0, 14.0, 24), (68.0, 14.0, 40)],
    'green': [(19.0, 29.0, 4), (27.0, 30.0, 28), (12.0, 36.0, 16)],
    'grey': [(75.0, 29.0, 12), (84.0, 30.0, 36), (90.0, 37.0, 22)],
}
PUFF_LIFE = 18


def draw_puffs(out, name, i):
    pal = PAL[name]
    base_alpha = 185 if name == 'purple' else 150
    for cx, cy, start in PUFFS[name]:
        t = (i - start) % N
        if t >= PUFF_LIFE:
            continue
        f = t / PUFF_LIFE
        y0 = cy + PAD + 0.5 - t * 0.5
        x0 = cx + WIND[name] * t * 0.35 + 0.7 * math.sin(t * 0.5 + cx)   # treibt mit dem Wind
        r = 1.0 + 1.2 * min(1.0, f * 1.6)
        alpha = base_alpha if f < 0.45 else int(base_alpha * (1 - f) / 0.55)
        if alpha < 20:
            continue
        for y in range(int(y0 - r - 1), int(y0 + r + 2)):
            for x in range(int(x0 - r - 1), int(x0 + r + 2)):
                d = math.hypot(x - x0, y - y0)
                if d > r + 0.3 or not (0 <= x < W and 0 <= y < H):
                    continue
                if d > r - 0.5:
                    col = pal[0]
                elif (x - x0) + (y - y0) < -0.4:
                    col = pal[3]
                else:
                    col = pal[2]
                if out[y, x, 3] < alpha:
                    out[y, x] = (*col, alpha)


def clouds(i):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for name in ('purple', 'green', 'grey'):
        c = flow_cloud(CLOUDS[name], name, i)
        draw_puffs(c, name, i)
        img.alpha_composite(Image.fromarray(c.astype(np.uint8)))
    return img


# ---------------------------------------------------------------- Medea
def breath(i, lag=0):
    t = (i - lag) % N
    return 1 if 12 <= t < 36 else 0


def body_lag(x, y):
    """None = fest (Robensaum), sonst Verzögerung."""
    y0 = y - PAD
    if y0 >= 52:
        return None
    if y0 <= 41:
        return 2                     # Kapuze/Kopf
    if x <= 43 or x >= 58:
        return 1                     # Ärmel
    return 0


ROBE_EYES = [  # Augenpaare in der Robe (ungepolstert), Blinzel-Frames, Wanderung
    ([(44, 41), (45, 42)], (6, 7), None),
    ([(56, 40), (58, 40)], (19, 20, 21), None),
    ([(49, 49), (51, 49)], (40, 41), (26, 34, -1)),   # wandert kurz 1 px nach links
]
RED_EYE = [(52, 41), (53, 41)]
RED_GLOW = [(150, 0, 0), (200, 0, 0), (255, 60, 40)]


def medea_source(i):
    a = BODY.copy()
    for pts, blink, walk in ROBE_EYES:
        cols = [a[y + PAD, x].copy() for x, y in pts]
        under = [a[y + PAD, x - 1].copy() if a[y + PAD, x - 1, 0] < 150 else a[y + PAD, x + 1].copy()
                 for x, y in pts]
        shift = walk[2] if walk and walk[0] <= i % N < walk[1] else 0
        for (x, y), u in zip(pts, under):
            a[y + PAD, x] = u
        if i % N in blink:
            continue
        for (x, y), c in zip(pts, cols):
            a[y + PAD, x + shift] = c
    lv = int(round(1 + wave(i, 24)))
    for x, y in RED_EYE:
        if a[y + PAD, x, 0] > 100:
            a[y + PAD, x, :3] = RED_GLOW[lv]
    return a


def map_body(src, i):
    out = np.zeros_like(src)
    for y in range(H):
        for x in range(W):
            lag = body_lag(x, y)
            dy = 0 if lag is None else breath(i, lag)
            sy = y - dy
            if 0 <= sy < H:
                out[y, x] = src[sy, x]
    return out


# ---------------------------------------------------------------- Schlangen
TONGUE = (208, 38, 58, 255)


class Snake:
    def __init__(self, name, head_x, head_dir, anchor_x, period, phase,
                 sway_period, sway_phase, mouth, flicks):
        self.pts = SNAKES[name]
        self.head_x = head_x          # Grenze Kopf/Körper
        self.dir = head_dir           # -1: Kopf links, +1: Kopf rechts
        self.anchor_x = anchor_x      # ab hier (Robe) fest, sonst None
        self.period, self.phase = period, phase
        self.sway_period, self.sway_phase = sway_period, sway_phase
        self.mouth = (mouth[0], mouth[1] + PAD)
        self.flicks = flicks          # Startframes fürs Züngeln
        xs = [p[0] for p in self.pts]
        ys = [p[1] for p in self.pts]
        self.box = (min(xs) - 3, max(xs) + 3, min(ys) - 3, max(ys) + 3)

    def u(self, x):
        """Abstand vom Kopf entlang des Körpers (0 = Kopf)."""
        return max(0, (x - self.head_x) * -self.dir)

    def env(self, x):
        if self.anchor_x is None:
            return 1.0
        return max(0.0, min(1.0, abs(self.anchor_x - x) / 4))

    def offset(self, x, i):
        u = self.u(x)
        head_w = max(0.0, 1 - u / 3)                  # Hals geht weich in Körper über
        body = wave(i, self.period, self.phase - 0.55 * u)
        head = wave(i, self.period, self.phase + 0.6)
        dy = (head_w * head + (1 - head_w) * body) * self.env(x)
        dx = head_w * 1.1 * wave(i, self.sway_period, self.sway_phase) * self.env(x)
        return int(round(dx)), int(round(dy))

    def draw(self, out, i):
        layer = np.zeros_like(out)
        for x, y in self.pts:
            layer[y, x] = CRE[y, x]
        x0, x1, y0, y1 = self.box
        for x in range(max(0, x0), min(W, x1 + 1)):
            dx, dy = self.offset(x, i)
            for y in range(max(0, y0), min(H, y1 + 1)):
                sx, sy = x - dx, y - dy
                if 0 <= sx < W and 0 <= sy < H and layer[sy, sx, 3]:
                    if (sx, sy) in self.pts:
                        out[y, x] = layer[sy, sx]
        # Zunge
        t = None
        for s in self.flicks:
            if 0 <= (i - s) % N < 4:
                t = (i - s) % N
        if t is not None:
            hdx, hdy = self.offset(self.head_x, i)
            mx, my = self.mouth[0] + hdx, self.mouth[1] + hdy
            length = [1, 2, 2, 1][t]
            for k in range(length):
                out[my + k, mx] = TONGUE
            if length == 2:
                out[my + 2, mx - 1] = TONGUE
                out[my + 2, mx + 1] = TONGUE


SNAKE_LIST = [
    Snake('S1', head_x=42, head_dir=-1, anchor_x=46, period=16, phase=0.0,
          sway_period=24, sway_phase=1.0, mouth=(40, 60), flicks=(10, 34)),
    Snake('S2', head_x=23, head_dir=-1, anchor_x=None, period=24, phase=1.3,
          sway_period=48, sway_phase=0.0, mouth=(21, 63), flicks=(2, 22, 42)),
    Snake('S3', head_x=72, head_dir=1, anchor_x=None, period=16, phase=2.6,
          sway_period=24, sway_phase=3.0, mouth=(74, 67), flicks=(16, 30)),
]


# ---------------------------------------------------------------- Frame
def frame(i):
    img = clouds(i)
    body = map_body(medea_source(i), i)
    emit = map_body(EMIT, i)
    img.alpha_composite(Image.fromarray(body.astype(np.uint8)))
    img.alpha_composite(Image.fromarray(emit.astype(np.uint8)))
    snakes = np.zeros((H, W, 4), dtype=int)
    for s in SNAKE_LIST:
        s.draw(snakes, i)
    img.alpha_composite(Image.fromarray(snakes.astype(np.uint8)))
    return np.array(img)


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    ms = int(sys.argv[2]) if len(sys.argv) > 2 else 80
    frames = [frame(i) for i in range(N)]
    imgs = []
    for f in frames:
        im = Image.fromarray(f).resize((W * 6, H * 6), Image.NEAREST)
        b = Image.new('RGBA', im.size, (40, 30, 70, 255))
        b.alpha_composite(im)
        imgs.append(b.convert('RGB'))
    imgs[0].save(f'medea_idle_{tag}.gif', save_all=True, append_images=imgs[1:],
                 duration=ms, loop=0, disposal=2, optimize=False)
    Image.fromarray(np.concatenate(frames, axis=1)).save(f'medea_idle_sheet_{tag}.png')
    ch = [int((frames[k] != frames[k - 1]).any(axis=2).sum()) for k in range(N)]
    print('geänderte Pixel pro Frame:', ch)
