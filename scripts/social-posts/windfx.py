"""Wind-Show für „Champion, the Stormbringer“: Tornado hinter der Karte, wirbelnde Blätter und Kleinteile, Windböen, flatterndes Banner
und ein Opener, in dem eine Blätterwand weggeweht wird. Alles ist periodisch mit der Schleife (loop Bilder), damit das Video nahtlos läuft.

    hinten (vor dem Hintergrund, hinter der Karte):  Tornado + Teile auf der Rückseite der Kreisbahn
    vorne  (vor Karte und Sprite):                   Teile auf der Vorderseite, quer fliegende Teile, Böen-Streifen
    Banner:                                          Fahnenwelle (spaltenweise Versatz, an Böen stärker)
    Opener:                                          Blätterwand, die ab t_gust nach rechts weggeblasen wird
Licht kommt wie überall von oben rechts."""
import math

import numpy as np
from PIL import Image

from pxcommon import BAYER4

# Pixelbilder (Zeichen → Farbe: D = dunkel/Kontur, G = Mitte, L = Licht oben rechts, W = hell)
SHAPES = {
    'leaf': ["...DD.",
             "..DGLD",
             ".DGGGD",
             "DGGGD.",
             "DGDD..",
             "DD...."],
    'oak': [".DDD.",
            "DGLGD",
            "DGGGD",
            "DGGGD",
            ".DDD."],
    'twig': ["......D",
             "....DDG",
             ".DDDG..",
             "D......"],
    'pebble': [".DD.",
               "DGLD",
               "DGGD",
               ".DD."],
    'scrap': ["WWWD",
              "WLWD",
              "WWDD",
              "DDD."],
    'feather': ["....WW.",
                ".WWWWL.",
                "WW....."],
}
PALETTES = {
    'green': {'D': (28, 74, 34), 'G': (66, 150, 52), 'L': (150, 216, 100), 'W': (200, 240, 160)},
    'autumn': {'D': (112, 48, 20), 'G': (214, 108, 30), 'L': (250, 186, 70), 'W': (255, 220, 120)},
    'dry': {'D': (72, 44, 24), 'G': (142, 92, 52), 'L': (196, 152, 104), 'W': (220, 190, 150)},
    'stone': {'D': (50, 52, 64), 'G': (112, 116, 132), 'L': (190, 196, 214), 'W': (225, 228, 240)},
    'paper': {'D': (118, 112, 128), 'G': (200, 196, 208), 'L': (255, 252, 250), 'W': (244, 240, 236)},
    'white': {'D': (150, 146, 186), 'G': (200, 198, 232), 'L': (255, 255, 255), 'W': (240, 240, 252)},
}
KIND_VARIANTS = {'leaf': ['green', 'autumn', 'dry'], 'oak': ['green', 'autumn', 'dry'], 'twig': ['dry'], 'pebble': ['stone'],
                 'scrap': ['paper'], 'feather': ['white']}
STORM_PAL = [(40, 42, 84), (88, 92, 148), (138, 144, 198), (208, 212, 246)]


def ease_out(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


class WindFX:
    def __init__(self, W, H, U, fps, loop, geom, seed=5):
        self.W, self.H, self.U, self.fps, self.loop, self.g = W, H, U, fps, loop, geom
        self.cw, self.ch = -(-W // U), -(-H // U)
        self.cx, self.cy = geom['center']
        rng = np.random.default_rng(seed)
        self._cache = {}
        yy, xx = np.mgrid[0:self.ch, 0:self.cw]
        self.BAY = np.tile(BAYER4, (self.ch // 4 + 1, self.cw // 4 + 1))[:self.ch, :self.cw]
        # Tornado
        self.t_top, self.t_bot = 330, 1430                                  # Höhe des Trichters in px
        # Teile, die den Tornado umkreisen (v = Höhe im Trichter 0 oben … 1 unten, steigen pro Schleife einmal nach oben)
        kinds = ['leaf', 'oak', 'leaf', 'oak', 'twig', 'pebble', 'scrap', 'feather']
        self.orbit = []
        for _ in range(120):
            k = kinds[int(rng.integers(len(kinds)))]
            self.orbit.append(dict(kind=k, var=KIND_VARIANTS[k][int(rng.integers(len(KIND_VARIANTS[k])))], v=rng.uniform(0, 1),
                                   rf=rng.uniform(0.95, 1.6), K=int(rng.choice([1, 2, 3, 3, 4])), dir=int(rng.choice([1, 1, 1, -1])),
                                   a0=rng.uniform(0, 2 * math.pi), px=int(rng.integers(6, 10)), tum=rng.uniform(0, 8), rise=int(rng.choice([1, 1, 2]))))
        # quer fliegende Teile
        self.cross = []
        for _ in range(34):
            k = kinds[int(rng.integers(len(kinds)))]
            self.cross.append(dict(kind=k, var=KIND_VARIANTS[k][int(rng.integers(len(KIND_VARIANTS[k])))], y=rng.uniform(80, H - 80),
                                   amp=rng.uniform(40, 160), ky=int(rng.choice([1, 2, 3])), K=int(rng.choice([1, 1, 2])), off=rng.uniform(0, 1),
                                   px=int(rng.integers(5, 10)), tum=rng.uniform(0, 8), ph=rng.uniform(0, 1)))
        # Böen-Streifen
        self.streaks = [dict(y=int(rng.uniform(60, H - 60) // U * U), L=int(rng.integers(14, 52)), K=int(rng.choice([2, 3, 3, 4])),
                             off=rng.uniform(0, 1), th=int(rng.choice([1, 1, 2])), col=int(rng.integers(3))) for _ in range(20)]
        # Opener: Blätterwand
        self.wall = []
        for _ in range(620):
            k = kinds[int(rng.choice([0, 1, 0, 1, 2, 4, 6, 7]))]
            self.wall.append(dict(kind=k, var=KIND_VARIANTS[k][int(rng.integers(len(KIND_VARIANTS[k])))], x=rng.uniform(-60, W + 60),
                                  y=rng.uniform(-60, H + 60), px=int(rng.integers(8, 13)), tum=rng.uniform(0, 8), sp=rng.uniform(1700, 4200),
                                  ky=rng.uniform(0, 1), amp=rng.uniform(40, 160), z=rng.uniform(0, 1)))
        self.wall.sort(key=lambda c: c['z'])

    # ───────── Teile ─────────
    def _stamp(self, kind, var, idx, px):
        key = (kind, var, idx % 8, px)
        if key not in self._cache:
            rows = SHAPES[kind]
            pal = PALETTES[var]
            h, w = len(rows), len(rows[0])
            a = np.zeros((h, w, 4), dtype=np.uint8)
            for y, row in enumerate(rows):
                for x, ch in enumerate(row):
                    if ch in pal:
                        a[y, x] = pal[ch] + (255,)
            a = np.rot90(a, (idx % 8) % 4)
            if (idx % 8) >= 4:
                a = a[:, ::-1]
            im = Image.fromarray(np.ascontiguousarray(a), 'RGBA')
            self._cache[key] = im.resize((im.width * px, im.height * px), Image.NEAREST)
        return self._cache[key]

    def _put(self, canvas, kind, var, idx, px, x, y):
        im = self._stamp(kind, var, idx, px)
        canvas.paste(im, (int(round(x - im.width / 2)), int(round(y - im.height / 2))), im)

    # ───────── Tornado ─────────
    def _fun(self, v, ph):
        """Mitte und Halbbreite (px) des Trichters in der Höhe v (0 oben … 1 unten)."""
        w = 40 + 560 * (1 - v) ** 1.3
        xc = self.W / 2 + 70 * np.sin(2 * math.pi * (v * 1.1 + ph))
        y = self.t_top + (self.t_bot - self.t_top) * v
        return xc, w, y

    def _funnel_field(self, ph):
        U, cw = self.U, self.cw
        y0c, y1c = int(self.t_top / U), int(self.t_bot / U)
        rows = np.arange(y0c, y1c)
        v = (rows - y0c) / float(y1c - y0c)
        xc, w, _ = self._fun(v, ph)
        X = np.arange(cw)[None, :] + 0.5
        d = (X * U - xc[:, None]) / w[:, None]
        inside = np.abs(d) <= 1.0
        theta = np.arcsin(np.clip(d, -1, 1))
        bands = np.sin(5.0 * (theta + 2 * math.pi * 2 * ph) + 9.0 * v[:, None])        # schraubenförmige Streifen, drehen sich mit der Schleife
        return y0c, y1c, rows, v, d, inside, bands

    def _draw_wisps(self, canvas, ph):
        """Feine helle Wirbelstreifen des Trichters VOR der Karte (nur wenige Zellen), damit der Tornado über das ganze Bild zieht."""
        U, cw = self.U, self.cw
        y0c, y1c, rows, v, d, inside, bands = self._funnel_field(ph)
        vis = inside & (bands > 0.72) & (self.BAY[y0c:y1c, :cw] < 0.36 + 0.3 * (bands > 0.93)) & (np.abs(d) < 0.97)
        lay = np.zeros((len(rows), cw, 4), dtype=np.uint8)
        lay[..., :3] = (214, 210, 255)
        lay[..., 3] = np.where(vis, 255, 0)
        im = Image.fromarray(lay, 'RGBA').resize((cw * U, len(rows) * U), Image.NEAREST).crop((0, 0, self.W, len(rows) * U))
        canvas.paste(im, (0, y0c * U), im)

    def _draw_tornado(self, canvas, ph):
        U, cw = self.U, self.cw
        y0c, y1c, rows, v, d, inside, bands = self._funnel_field(ph)
        lvl = 1.3 + 0.95 * bands + 0.8 * d                                                 # rechts heller (Licht von oben rechts)
        lvl = np.where(np.abs(d) > 0.93, 0.0, lvl)                                         # dunkler Rand
        lo = np.clip(np.floor(lvl), 0, 2).astype(int)
        idx = lo + ((lvl - np.floor(lvl)) > self.BAY[y0c:y1c, :cw])
        idx = np.clip(idx, 0, 3)
        pal = np.asarray(STORM_PAL, dtype=np.uint8)
        rgb = pal[idx]
        alpha = (0.92 - 0.35 * v[:, None]) * np.clip((1 - np.abs(d)) * 5 + 0.25, 0, 1)
        vis = inside & (self.BAY[y0c:y1c, :cw] < alpha)
        lay = np.zeros((len(rows), cw, 4), dtype=np.uint8)
        lay[..., :3] = rgb
        lay[..., 3] = np.where(vis, 255, 0)
        im = Image.fromarray(lay, 'RGBA').resize((cw * U, len(rows) * U), Image.NEAREST).crop((0, 0, self.W, len(rows) * U))
        canvas.paste(im, (0, y0c * U), im)

    # ───────── Zeichnen ─────────
    def _orbit_pos(self, p, ph):
        v = (p['v'] - p['rise'] * ph) % 1.0                                                 # steigt nach oben
        xc, w, y = self._fun(v, ph)
        a = p['a0'] + p['dir'] * 2 * math.pi * p['K'] * ph
        x = xc + p['rf'] * w * math.cos(a)
        yy = y + 0.16 * p['rf'] * w * math.sin(a)
        z = math.sin(a) * p['dir']
        return x, yy, z, v

    def _orbit_draw(self, canvas, f, back):
        ph = (f % self.loop) / float(self.loop)
        items = []
        for p in self.orbit:
            x, y, z, v = self._orbit_pos(p, ph)
            if v < 0.04 or v > 0.96:
                continue                                                                       # beim Umbruch oben/unten nicht zeigen
            if (z < 0) != back:
                continue
            items.append((z, p, x, y))
        for z, p, x, y in sorted(items, key=lambda a: a[0]):
            px = p['px'] + (1 if z > 0.5 else 0)
            self._put(canvas, p['kind'], p['var'], int(f * 0.3 + p['tum']), px, x, y)

    def draw_behind(self, canvas, f):
        ph = (f % self.loop) / float(self.loop)
        self._draw_tornado(canvas, ph)
        self._orbit_draw(canvas, f, back=True)

    def draw_front(self, canvas, f):
        ph = (f % self.loop) / float(self.loop)
        W, U = self.W, self.U
        self._draw_wisps(canvas, ph)
        self._orbit_draw(canvas, f, back=False)
        for c in self.cross:                                                                    # quer fliegende Teile
            s = (c['K'] * ph + c['off']) % 1.0
            x = -80 + (W + 160) * s
            y = c['y'] + c['amp'] * math.sin(2 * math.pi * (c['ky'] * ph + c['ph']))
            self._put(canvas, c['kind'], c['var'], int(f * 0.3 + c['tum']), c['px'], x, y)
        cols = [(255, 255, 255), (214, 210, 255), (168, 160, 240)]
        pal_dark = (60, 56, 120)
        for s_ in self.streaks:                                                                 # Böen-Streifen
            s = (s_['K'] * ph + s_['off']) % 1.0
            L = s_['L'] * U
            x = -L + (W + 2 * L) * s
            h = s_['th'] * U
            col = cols[s_['col']]
            canvas.paste(Image.new('RGBA', (L, h), col + (255,)), (int(x), s_['y']))
            canvas.paste(Image.new('RGBA', (int(L * 0.7), h), pal_dark + (255,)), (int(x - L * 0.7 - U), s_['y'] + U // 2 if h > U else s_['y']))

    def draw_logo(self, canvas, f):
        """Banner als flatternde Fahne: spaltenweiser Versatz, an der Böe stärker (alles periodisch mit der Schleife)."""
        lx, ly, lw, lh = self.g['logo_rect']
        im = np.asarray(self.g['logo_img'])
        ph = (f % self.loop) / float(self.loop)
        step = 3
        amp = 1.5 + 2.6 * max(0.0, math.sin(2 * math.pi * (ph + 0.1))) ** 2                    # in Schritten à 3 px
        pad = int(math.ceil(amp)) * step + step
        out = np.zeros((lh + 2 * pad, lw, 4), dtype=np.uint8)
        for x0 in range(0, lw, step):
            dy = int(round(amp * math.sin(2 * math.pi * (x0 / 340.0 - 3 * ph)))) * step
            out[pad + dy:pad + dy + lh, x0:x0 + step] = im[:, x0:x0 + step]
        flag = Image.fromarray(out, 'RGBA')
        canvas.paste(flag, (lx, ly - pad), flag)

    # ───────── Opener ─────────
    def opener_fx(self, img, f, t_gust):
        """Blätterwand verdeckt das erste Bild und raschelt; ab t_gust bläst eine Böe sie nach rechts weg (links zuerst)."""
        ts = f / float(self.fps)
        T_END = t_gust + 1.5
        if ts >= T_END:
            return img
        out = img.convert('RGBA')
        rng = np.random.default_rng(4000 + f)
        for c in self.wall:
            tau = ts - t_gust - 0.30 * (c['x'] / self.W)
            if tau <= 0:
                x, y = c['x'] + rng.uniform(-6, 6), c['y'] + rng.uniform(-6, 6)
            else:
                x = c['x'] + c['sp'] * tau * (0.4 + tau) + 80 * tau
                y = c['y'] + c['amp'] * math.sin(2 * math.pi * (1.5 * tau + c['ky'])) * min(1.0, tau * 2)
                if x > self.W + 150:
                    continue
            self._put(out, c['kind'], c['var'], int(ts * 14 + c['tum']), c['px'], x, y)
        if t_gust <= ts < t_gust + 0.9:                                                          # Böe: lange Streifen quer durchs Bild
            for k in range(26):
                y = int(rng.uniform(40, self.H - 40) // self.U * self.U)
                L = int(rng.integers(30, 90)) * self.U
                x = -L + (self.W + 2 * L) * ((ts - t_gust) / 0.7 * (0.7 + 0.6 * rng.random()))
                out.paste(Image.new('RGBA', (L, self.U), (255, 255, 255, 255)), (int(x), y))
        return out.convert('RGB')


# ══════════════════════════════════════════════════════════════════════════════════════════════
#  Wind-SHOW: ein Tornado, der ins Bild kommt, mit dem Interface spielt und wieder geht (einmalige Zeitleiste, nahtloser Loop)
#    0.0 –  1.4  Sturmstoß (Opener): Blitz, Druckwelle, Speedlines und ein Wirbel aus Blättern fliegen von Champion nach außen
#    1.4 –  4.0  Brise
#    4.0 – 13.6  Champion beschwört vor seinem ausgestreckten Arm einen Tornado: er wächst, löst sich, wandert unten durchs Bild, saugt das Link-Schild ein,
#                zieht rechts hoch, jagt am oberen Rand nach links und reißt das Banner mit; Böen rütteln Karte und Champion
#   13.6 – 15.4  Gegenwind von rechts, Banner und Schild sind zurück
#   15.0 – 18.5  großer Tornado hinter der Karte (Champion bleibt frei), Kleinteile kreisen
#   18.5 – 19.4  Sprengung aller Teile nach außen (Druckwelle)
#   19.4 –   D   Blätter und Speedlines ziehen sich zusammen und leiten in den Sturmstoß vom ersten Bild über (nahtloser Loop)
# ══════════════════════════════════════════════════════════════════════════════════════════════
def _smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


class WindShow(WindFX):
    SHOCKS = (0.0, 4.5, 18.5)
    T_GUST = 0.0
    # (t, xc, y_bot, Höhe, Breite oben); 'hand' = vor Champions ausgestreckter Hand (Versatz in px), siehe twister()
    TW_KEYS = [(4.0, 'hand', 'hand', 70, 45), (4.9, 'hand', 'hand', 250, 140), (5.8, 150, 1150, 440, 230), (6.6, 380, 1500, 440, 230),
               (7.4, 540, 1560, 440, 240), (8.4, 760, 1560, 460, 250), (9.4, 940, 1300, 640, 320), (10.6, 960, 900, 720, 330),
               (11.4, 760, 480, 430, 260), (12.0, 380, 470, 430, 260), (12.8, 40, 470, 430, 260), (13.6, -250, 600, 300, 180)]
    HAND_OFF = (-95, 85)                                                                 # Tornado entsteht links neben der Fingerspitze, Fuß knapp darunter
    GUSTS = [(0.0, 22), (4.5, 16), (5.6, 10), (9.6, 12), (12.3, 16), (13.9, -12), (18.5, 18)]       # (Sekunde, Stärke px): rütteln Karte und Champion

    def __init__(self, W, H, U, fps, loop, geom, D, seed=5):
        super().__init__(W, H, U, fps, loop, geom, seed)
        self.D = D
        n = int(D * fps) + 2
        ts = np.arange(n) / fps
        w = 140 + sum(a * np.exp(-(((ts - t0) / wd) ** 2)) for t0, a, wd in ((4.4, 1800, 0.5), (5.5, 900, 0.4), (9.5, 1200, 0.5), (12.0, 1500, 0.5),
                                                                              (13.8, -1600, 0.5), (18.4, 1000, 0.4)))
        self.X = np.cumsum(w) / fps                                                    # Windweg: bestimmt die Position der quer fliegenden Teile
        rng = np.random.default_rng(seed + 7)
        self.amb = []
        for c in self.cross:
            self.amb.append(dict(c, x0=rng.uniform(0, W + 200), kx=rng.uniform(0.6, 1.4), fall=rng.uniform(10, 50)))
        self.hand_fn = geom.get('hand_fn')
        # Sturmstoß (Opener und Schluss): Blätter wirbeln spiralig von Champion nach außen, dazu Speedlines
        self.burst = []
        for _ in range(190):
            k = ['leaf', 'oak', 'leaf', 'oak', 'twig', 'scrap', 'feather'][int(rng.integers(7))]
            self.burst.append(dict(kind=k, var=KIND_VARIANTS[k][int(rng.integers(len(KIND_VARIANTS[k])))], a=rng.uniform(0, 2 * math.pi),
                                   s=rng.uniform(900, 2800), k=rng.uniform(-1.3, 1.3), px=int(rng.integers(6, 12)), tum=rng.uniform(0, 8)))
        self.lines = [dict(a=rng.uniform(0, 2 * math.pi), v=rng.uniform(1600, 3800), L=rng.uniform(160, 460), col=int(rng.integers(3))) for _ in range(70)]

    # ───────── Zeitleisten ─────────
    def _key(self, k):
        """Schlüsselbild mit absoluten Werten; 'hand' wird zur Handposition (mit Versatz) zum Zeitpunkt des Schlüsselbilds."""
        t, xc, yb, Ht, wt = k
        if xc == 'hand' and self.hand_fn is not None:
            hx, hy = self.hand_fn(t)
            xc, yb = hx + self.HAND_OFF[0], hy + self.HAND_OFF[1]
        return t, xc, yb, Ht, wt

    def twister(self, t):
        keys = [self._key(k) for k in self.TW_KEYS]
        if t < keys[0][0] or t > keys[-1][0]:
            return None
        for a, b in zip(keys[:-1], keys[1:]):
            if a[0] <= t <= b[0]:
                u = _smooth((t - a[0]) / (b[0] - a[0]))
                st = [a[i] + (b[i] - a[i]) * u for i in range(1, 5)]                          # (xc, y_bot, H, w_top)
                if t < keys[1][0] and self.hand_fn is not None:                              # solange er „geschaffen“ wird, folgt er der Hand
                    hx, hy = self.hand_fn(t)
                    st[0], st[1] = hx + self.HAND_OFF[0] + self.sprite_dx(int(t * self.fps)), hy + self.HAND_OFF[1]
                return tuple(st)
        return None

    def big(self, t):
        """Großer Tornado hinter der Karte: Stärke 0 … 1 (wächst 15.0–16.2, hält bis 18.5)."""
        if t < 15.0 or t >= 18.5:
            return 0.0
        return _smooth((t - 15.0) / 1.2)

    def plate_dx(self, f):
        t = f / float(self.fps)
        dx = 0.0
        for tg, a in self.GUSTS:
            tau = t - tg
            if tau >= 0:
                dx += a * math.exp(-tau / 0.28) * math.cos(2 * math.pi * 4.5 * tau)
        return int(round(dx / self.U)) * self.U

    def sprite_dx(self, f):
        return int(round(0.55 * self.plate_dx(f) / self.U)) * self.U

    # ───────── Trichter mit freien Parametern ─────────
    def _draw_funnel(self, canvas, xc0, y_top, y_bot, w_top, t, sway=60.0, alpha=0.9):
        U, cw, ch = self.U, self.cw, self.ch
        y0c, y1c = int(y_top / U), int(y_bot / U)
        if y1c - y0c < 3:
            return
        rows = np.arange(y0c, y1c)
        v = (rows - y0c) / float(y1c - y0c)
        ph = t / 4.32
        w = 20 + w_top * (1 - v) ** 1.3
        xc = xc0 + sway * np.sin(2 * math.pi * (v * 1.1 + ph))
        X = np.arange(cw)[None, :] + 0.5
        d = (X * U - xc[:, None]) / w[:, None]
        inside = np.abs(d) <= 1.0
        theta = np.arcsin(np.clip(d, -1, 1))
        bands = np.sin(5.0 * (theta + 2 * math.pi * 2 * ph) + 9.0 * v[:, None])
        lvl = 1.3 + 0.95 * bands + 0.8 * d
        lvl = np.where(np.abs(d) > 0.93, 0.0, lvl)
        r0, r1 = max(0, y0c), min(ch, y1c)
        if r1 <= r0:
            return
        sl = slice(r0 - y0c, r1 - y0c)
        bay = self.BAY[r0:r1, :cw]
        lv = lvl[sl]
        lo = np.clip(np.floor(lv), 0, 2).astype(int)
        idx = np.clip(lo + ((lv - np.floor(lv)) > bay), 0, 3)
        rgb = np.asarray(STORM_PAL, dtype=np.uint8)[idx]
        a_ = (alpha - 0.3 * v[sl, None]) * np.clip((1 - np.abs(d[sl])) * 5 + 0.25, 0, 1)
        vis = inside[sl] & (bay < a_)
        lay = np.zeros((r1 - r0, cw, 4), dtype=np.uint8)
        lay[..., :3] = rgb
        lay[..., 3] = np.where(vis, 255, 0)
        im = Image.fromarray(lay, 'RGBA').resize((cw * U, (r1 - r0) * U), Image.NEAREST).crop((0, 0, self.W, (r1 - r0) * U))
        canvas.paste(im, (0, r0 * U), im)

    def _tw_geom(self, st):
        xc, yb, Ht, wt = st
        return xc, yb - Ht, yb, wt

    def _orbit_state_for(self, p, t, geom):
        xc0, y_top, y_bot, w_top = geom
        ph = t / 4.32
        v = (p['v'] - p['rise'] * ph) % 1.0
        w = 20 + w_top * (1 - v) ** 1.3
        xc = xc0 + 60.0 * math.sin(2 * math.pi * (v * 1.1 + ph))
        y = y_top + (y_bot - y_top) * v
        a = p['a0'] + p['dir'] * 2 * math.pi * p['K'] * ph
        x = xc + p['rf'] * w * math.cos(a)
        yy = y + 0.16 * p['rf'] * w * math.sin(a)
        z = math.sin(a) * p['dir']
        return x, yy, z, v

    def _orbit_draw_for(self, canvas, t, f, geom, back, scale=0.9, count=70, burst=None):
        items = []
        for p in self.orbit[:count]:
            x, y, z, v = self._orbit_state_for(p, t, geom)
            if v < 0.04 or v > 0.96:
                continue
            if burst is not None:                                                    # Sprengung: radial vom Trichtermittelpunkt weg
                tau = t - burst
                cx0, cy0 = geom[0], (geom[1] + geom[2]) / 2
                d = math.hypot(x - cx0, y - cy0) or 1.0
                dist = 900 * tau + 0.5 * 4200 * tau * tau
                x, y = x + (x - cx0) / d * dist, y + (y - cy0) / d * dist
                if x < -200 or x > self.W + 200 or y < -200 or y > self.H + 200:
                    continue
                z = 1.0 if not back else -1.0
            if (z < 0) != back:
                continue
            items.append((z, p, x, y))
        for z, p, x, y in sorted(items, key=lambda a: a[0]):
            px = max(4, int(round(p['px'] * scale)) + (1 if z > 0.5 else 0))
            self._put(canvas, p['kind'], p['var'], int(f * 0.3 + p['tum']), px, x, y)

    # ───────── Zeichnen ─────────
    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        b = self.big(t)
        if b > 0:                                                                    # großer Tornado hinter der Karte
            self._draw_funnel(canvas, self.W / 2, self.t_top, self.t_bot, 560 * b, t, alpha=0.92)
            self._orbit_draw_for(canvas, t, f, (self.W / 2, self.t_top, self.t_bot, 560 * b), back=True, scale=1.0, count=110)
        elif 18.5 <= t < 19.4:
            self._orbit_draw_for(canvas, t, f, (self.W / 2, self.t_top, self.t_bot, 560), back=True, scale=1.0, count=110, burst=18.5)

    def _breeze(self, canvas, t, f):
        """Quer fliegende Teile im Windweg und Böen-Streifen (Stärke folgt dem Wind)."""
        k = min(len(self.X) - 1, int(t * self.fps))
        Xt = self.X[k]
        W = self.W
        for c in self.amb:
            x = ((c['x0'] + c['kx'] * Xt) % (W + 240)) - 120
            y = (c['y'] + c['fall'] * t + c['amp'] * math.sin(2 * math.pi * (c['ky'] * t / 4.3 + c['ph']))) % (self.H + 160) - 80
            self._put(canvas, c['kind'], c['var'], int(f * 0.3 + c['tum']), c['px'], x, y)
        speed = abs(self.X[min(len(self.X) - 1, k + 1)] - self.X[k]) * self.fps
        n = int(min(len(self.streaks), speed / 160))                                   # mehr Streifen bei stärkerem Wind
        sign = 1 if self.X[min(len(self.X) - 1, k + 1)] >= self.X[k] else -1
        for s_ in self.streaks[:n]:
            s = (s_['K'] * t / 4.32 * 2 + s_['off']) % 1.0
            L = s_['L'] * self.U
            x = -L + (W + 2 * L) * (s if sign > 0 else 1 - s)
            h = s_['th'] * self.U
            canvas.paste(Image.new('RGBA', (L, h), ((255, 255, 255), (214, 210, 255), (168, 160, 240))[s_['col']] + (255,)), (int(x), s_['y']))

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        self._breeze(canvas, t, f)
        st = self.twister(t)
        if st is not None:
            geom = self._tw_geom(st)
            self._orbit_draw_for(canvas, t, f, geom, back=True, scale=0.9, count=60)
            self._draw_funnel(canvas, geom[0], geom[1], geom[2], geom[3], t, sway=40.0 + 0.1 * geom[3])
            self._orbit_draw_for(canvas, t, f, geom, back=False, scale=0.9, count=60)
        b = self.big(t)
        if b > 0:
            self._orbit_draw_for(canvas, t, f, (self.W / 2, self.t_top, self.t_bot, 560 * b), back=False, scale=1.0, count=110)
        elif 18.5 <= t < 19.4:
            self._orbit_draw_for(canvas, t, f, (self.W / 2, self.t_top, self.t_bot, 560), back=False, scale=1.0, count=110, burst=18.5)

    # ───────── Banner und Link-Schild ─────────
    def _flag(self, im, amp, t, step=3, speed=3.0):
        arr = np.asarray(im)
        h, w = arr.shape[:2]
        pad = int(math.ceil(amp)) * step + step
        out = np.zeros((h + 2 * pad, w, 4), dtype=np.uint8)
        for x0 in range(0, w, step):
            dy = int(round(amp * math.sin(2 * math.pi * (x0 / 340.0 - speed * t / 4.32)))) * step
            out[pad + dy:pad + dy + h, x0:x0 + step] = arr[:, x0:x0 + step]
        return Image.fromarray(out, 'RGBA'), pad

    def draw_logo(self, canvas, f):
        t = f / float(self.fps)
        lx, ly, lw, lh = self.g['logo_rect']
        amp = 1.2 + 0.9 * math.sin(2 * math.pi * t / 4.32) ** 2
        for tg, a in self.GUSTS:
            if t >= tg:
                amp += min(3.5, abs(a) / 5.0) * math.exp(-(t - tg) / 0.5)
        dx = 0.0
        if 11.7 <= t < 12.8:                                   # Tornado jagt das Banner nach links aus dem Bild
            dx = -1250 * _smooth((t - 11.7) / 1.1) ** 1.5
            amp = 5.5
        elif 12.8 <= t < 13.6:
            return
        elif 13.6 <= t < 14.7:                                 # kommt von rechts zurück, flattert aus
            u = (t - 13.6) / 1.1
            dx = 1250 * (1 - _smooth(u)) ** 1.5
            amp = 1.5 + 4.0 * (1 - u)
        flag, pad = self._flag(self.g['logo_img'], amp, t)
        canvas.paste(flag, (int(lx + dx), ly - pad), flag)

    def draw_badge(self, canvas, f):
        t = f / float(self.fps)
        bx, by, bw, bh = self.g['badge_rect']
        img = self.g['badge_img']
        cx0, cy0 = bx + bw / 2, by + bh / 2
        x, y, spin = cx0, cy0, None
        if 7.0 <= t < 8.6:                                      # eingesaugt: kreist spinnend um den Trichter und steigt auf
            st = self.twister(t)
            if st is None:
                return
            xc, yb, Ht, wt = st
            u = _smooth((t - 7.0) / 0.5)
            a = 2 * math.pi * 2.6 * (t - 7.0)
            r = (20 + wt * 0.35) * u
            ox, oy = xc + r * math.cos(a), yb - Ht * 0.12 - Ht * 0.45 * ((t - 7.0) / 1.6) + 0.16 * r * math.sin(a)
            x, y = cx0 + (ox - cx0) * u, cy0 + (oy - cy0) * u
            spin = a
        elif 8.6 <= t < 9.8:                                    # weggeschleudert
            st = self.twister(8.6)
            xc, yb, Ht, wt = st
            a = 2 * math.pi * 2.6 * 1.6
            r = 20 + wt * 0.35
            x0, y0 = xc + r * math.cos(a), yb - Ht * 0.12 - Ht * 0.45 + 0.16 * r * math.sin(a)
            tau = t - 8.6
            x, y = x0 + 900 * tau + 400 * tau * tau, y0 - 250 * tau + 200 * tau * tau
            spin = a + 2 * math.pi * 4 * tau
            if x > self.W + 400:
                return
        elif 9.8 <= t < 10.6:
            return
        elif 10.6 <= t < 11.6:                                  # kommt vom Wind zurück gewirbelt und landet
            u = (t - 10.6) / 1.0
            e = _smooth(u)
            x = -300 + (cx0 + 300) * e
            y = cy0 - 220 * math.sin(math.pi * e) * (1 - e) + (-14 * math.exp(-8 * (u - 0.8)) * abs(math.cos(16 * (u - 0.8))) if u > 0.8 else 0)
            spin = 2 * math.pi * 3 * (1 - e)
        elif 11.6 <= t < 12.0:
            s3 = t - 11.6
            y = cy0 - 10 * math.exp(-8 * s3) * abs(math.cos(18 * s3))
        if spin is not None:                                    # Münzdrehung: Breite folgt |cos|, Schild wirkt dreidimensional
            wcur = max(6, int(bw * abs(math.cos(spin))))
            img = img.resize((wcur, bh), Image.NEAREST)
        canvas.paste(img, (int(x - img.width / 2), int(y - img.height / 2)), img)

    # ───────── Opener und Schluss: Sturmstoß ─────────
    def _storm_burst(self, out, tau, ts):
        """Speedlines und spiralig nach außen wirbelnde Blätter, tau = Zeit seit dem Stoß (mit kleinem Vorlauf, damit schon das erste Bild gefüllt ist)."""
        from PIL import ImageDraw
        cx, cy = self.cx, self.cy
        U = self.U
        if tau < 0.5:                                                                   # Speedlines (kurz)
            ov = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
            dr = ImageDraw.Draw(ov)
            cols = ((255, 255, 255), (214, 210, 255), (170, 160, 245))
            for ln in self.lines:
                head = 140 + ln['v'] * (1 - math.exp(-4 * tau)) / 4
                tail = max(110, head - ln['L'] * min(1.0, tau / 0.25))
                if head > 1700:
                    continue
                x0, y0 = cx + math.cos(ln['a']) * tail, cy + math.sin(ln['a']) * tail
                x1, y1 = cx + math.cos(ln['a']) * head, cy + math.sin(ln['a']) * head
                dr.line([(round(x0 / U) * U, round(y0 / U) * U), (round(x1 / U) * U, round(y1 / U) * U)], fill=cols[ln['col']] + (255,), width=U)
            out.alpha_composite(ov)
        for b in self.burst:                                                             # Blätter
            r = b['s'] * (1 - math.exp(-3.5 * tau)) / 3.5 + 90
            ang = b['a'] + b['k'] * (1 - math.exp(-2.5 * tau))
            x, y = cx + math.cos(ang) * r, cy + math.sin(ang) * r * 1.05
            if x < -120 or x > self.W + 120 or y < -120 or y > self.H + 120:
                continue
            self._put(out, b['kind'], b['var'], int(ts * 14 + b['tum']), b['px'], x, y)

    PRE = 0.06                                                                           # Vorlauf: schon das erste Bild zeigt den Stoß

    def opener_fx(self, img, f, t_gust=None):
        ts = f / float(self.fps)
        if ts >= 1.4:
            return img
        out = img.convert('RGBA')
        self._storm_burst(out, ts + self.PRE, ts)
        return out.convert('RGB')

    def closer_fx(self, img, f):
        """Letzte 0,8 s: Blätter und Speedlines ziehen sich zum Zentrum zusammen und das Bild hellt auf → geht nahtlos in den Sturmstoß des ersten Bilds über."""
        t = f / float(self.fps)
        if t < self.D - 0.8:
            return img
        out = img.convert('RGBA')
        self._storm_burst(out, (self.D - t) + self.PRE, t)
        u = (t - (self.D - 0.8)) / 0.8
        a = 0.42 * u * u                                                                  # Aufhellen wie der Blitz des Punch im ersten Bild
        if a > 0:
            out = Image.blend(out, Image.new('RGBA', out.size, (255, 255, 255, 255)), a)
        return out.convert('RGB')
