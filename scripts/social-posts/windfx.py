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
