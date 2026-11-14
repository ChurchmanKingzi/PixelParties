"""Kazena-Show: die stürmische Rebellin. Sie zieht einmal pro Zug bis zur vollen Hand (7 Karten) – danach fegt der Sturm um die Hand und blockiert jedes weitere Ziehen.
Der Kartenzug (Schweif, Abheb-Funken, Schockringe) ist der Nachbau der echten Spiel-Animation (gamefx.Zug). Nebel, Windstreifen, Blätter und der Wirbel um die Hand sind Pixelart auf dem Hero-Raster.
Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

WIND = [(170, 230, 215), (210, 250, 240), (255, 255, 255)]
LEAF = [(60, 150, 70), (150, 210, 90), (230, 200, 90)]


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class StormShow(CaptionMixin):
    T1, T2, T3 = 3.4, 7.2, 11.4
    HW, HH = 130, 182                                                                  # Handkarte
    HX0, HDX, HY = 165, 125, 1745                                                      # Slots: x_i = 165 + 125 i (Mitte 540)
    DECK = (965, 700)
    BORD = (540, 780)                                                                  # gespielte Karten fliegen zum Helden
    CAPTIONS = [
        (0.9, 3.3, 'Kazena left her strict family in the dead of night - *free as the wind*.'),
        (3.4, 7.1, 'Once per turn she draws until her hand is *full* - *7 cards*!'),
        (7.2, 11.3, 'But then the *storm* sweeps around her hand - no more drawing this turn!'),
        (11.4, 15.1, 'Next turn - play some cards, and *draw until 7* again!'),
        (15.2, 18.5, '*Kazena* gives you a full hand - and the wind keeps the rest out.'),
        (18.6, 20.0, 'A *storming* rebel. Totally *free*!'),
    ]
    SND = {
        'wind':   [('elem_wind', -7)],
        'draw':   [('draw', -5)],
        'block':  [('ui_error', -9)],
        'play':   [('placement', -9)],
        'ping':   [('ping', -9)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self._cache = {}
        cb = Image.open(geom['cardback_path']).convert('RGB')
        w, h = self.HW // U, self.HH // U
        inner = ImageEnhance.Color(ImageEnhance.Contrast(cb.resize((w - 2, h - 3), Image.BOX)).enhance(1.35)).enhance(1.5).convert('RGBA')
        c = Image.new('RGBA', (w, h), (255, 150, 40, 255))
        c.paste(inner, (1, 1))
        self.back = c.resize((w * U, h * U), Image.NEAREST)
        self.rng = np.random.default_rng(seed)
        # Zeitplan der Hand: je Slot Intervalle (von, bis), bis=None: bleibt
        self.fill = [[(0.7, None)] for _ in range(7)]
        self.fill[2] = []
        for i in range(2, 7):
            self.fill[i] = []
        self.flights = []                                                              # Kartenflüge: dict(kind, slot, t0, zug, ...)
        for k in range(5):                                                             # Akt 1: Ziehen bis 7
            s = 2 + k
            t0 = self.T1 + 0.2 * k
            self._add_draw(s, t0)
        for k, s in enumerate((6, 5, 4, 3)):                                           # Akt 3: Karten ausspielen, dann wieder bis 7 ziehen
            t0 = self.T3 + 0.2 + 0.15 * k
            self._add_play(s, t0)
        for k, s in enumerate((3, 4, 5, 6)):
            self._add_draw(s, self.T3 + 1.5 + 0.2 * k)
        for t0, n in ((self.T2 + 0.9, 2), (self.T2 + 2.2, 1)):                         # Akt 2: Versuche, mehr zu ziehen
            for k in range(n):
                self._add_block(t0 + 0.14 * k, 6 - k)
        self.lock_iv = [(self.T1 + 0.2 * 4 + 0.5, self.T3 + 0.1), (self.T3 + 1.5 + 0.2 * 3 + 0.5, D + 1)]
        self.t_full = [self.lock_iv[0][0], self.lock_iv[1][0]]
        self.SHOCKS = (0.0, self.t_full[0], self.t_full[1])
        self.TENSION_SHAKES = [(t, 7 if i == 0 else 5) for i, t in enumerate(self.SHOCKS)]
        self.FLASHES = (0.0,)
        self.T_GUST = 0.0
        self._build_fog()
        self._build_wind()

    # ───────── Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def slot_xy(self, i):
        return self.HX0 + self.HDX * i, self.HY

    def _zug(self, a, b, dur, salt, bogen=0.0):
        A, B = self._cp(*a), self._cp(*b)
        return gamefx.Zug(A, B, dauer=dur, cw=self.HW / float(self.gp), bogen=bogen / self.gp, salt=salt, farbe=gamefx.hexc('#fbe181'))

    def _add_draw(self, slot, t0):
        z = self._zug(self.DECK, self.slot_xy(slot), 0.5, 100 + slot * 13 + int(t0 * 10), bogen=-120)
        self.flights.append(dict(kind='draw', slot=slot, t0=t0, zug=z))
        self.fill[slot].append((t0 + 0.5, None))

    def _add_play(self, slot, t0):
        z = self._zug(self.slot_xy(slot), self.BORD, 0.45, 200 + slot, bogen=0)
        self.flights.append(dict(kind='play', slot=slot, t0=t0, zug=z))
        # Slot wird beim Abflug leer
        iv = self.fill[slot]
        if iv and iv[-1][1] is None:
            iv[-1] = (iv[-1][0], t0)

    def _add_block(self, t0, slot):
        z = self._zug(self.DECK, self.slot_xy(slot), 0.5, 300 + slot + int(t0 * 7), bogen=-120)
        self.flights.append(dict(kind='block', slot=slot, t0=t0, zug=z))

    def hand_n(self, t):
        n = 0
        for i in range(7):
            for a, b in self.fill[i]:
                if t >= a and (b is None or t < b):
                    n += 1
        return n

    def locked(self, t):
        return any(a <= t < b for a, b in self.lock_iv)

    def wind(self, t):
        """Windstärke 0..1: ruhig am Anfang, steigt beim Ziehen, Spitze bei voller Hand, ruht zwischen den Zügen."""
        base = 0.18 + 0.12 * smooth((t - 1.0) / 2.0)
        if t >= self.T1 - 0.3:
            base = max(base, 0.45 * smooth((t - (self.T1 - 0.3)) / 1.4))
        if self.locked(t):
            base = 1.0
        if self.T3 - 0.4 <= t < self.T3 + 1.4:
            base = 0.3
        return base

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

    # ───────── Nebel ─────────
    def _build_fog(self):
        gp = self.gp
        gw, gh = self.W // gp + 6, self.H // gp + 2
        yy, xx = np.mgrid[0:gh, 0:gw].astype(np.float32)
        dens = np.zeros((gh, gw), np.float32)
        rng = np.random.default_rng(21)
        for _ in range(26):
            cx, cy = rng.uniform(0, gw), rng.uniform(gh * 0.05, gh * 0.95)
            rx, ry = rng.uniform(10, 26), rng.uniform(1.5, 4.5)
            dens += np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)) * rng.uniform(0.4, 0.9)
        bay = np.array(gamefx.BAY4, np.float32).reshape(4, 4)
        thr = (bay[(np.arange(gh) % 4)[:, None], (np.arange(gw) % 4)[None, :]] + 0.5) / 16.0
        lo = dens > thr * 1.6 + 0.1
        col = np.zeros((gh, gw, 4), np.uint8)
        col[lo] = (150, 190, 190, 255)
        self.fog = Image.fromarray(col, 'RGBA').resize((gw * gp, gh * gp), Image.NEAREST)

    def _draw_fog(self, canvas, t):
        gp = self.gp
        off = int(t * 22 / gp) * gp                                                    # Nebel zieht langsam nach rechts
        w = self.fog.width
        x0 = -((off) % (w - self.W - 2 * gp)) - gp
        a = 1.0 if t < 3.0 else max(0.35, 1.0 - (t - 3.0) / 3.0)                       # der Sturm reißt den Nebel auf
        if a >= 0.99:
            canvas.alpha_composite(self.fog, (int(x0), -gp)) if False else canvas.paste(self.fog, (int(x0), -gp), self.fog)
        else:
            f2 = self._cache.get(('fog', int(a * 10)))
            if f2 is None:
                arr = np.asarray(self.fog).copy()
                keep = (np.indices(arr.shape[:2]).sum(axis=0) // 1) % 10 < int(a * 10)
                arr[..., 3] = np.where(keep, arr[..., 3], 0)
                f2 = Image.fromarray(arr, 'RGBA')
                self._cache[('fog', int(a * 10))] = f2
            canvas.paste(f2, (int(x0), -gp), f2)

    # ───────── Wind: Streifen, Blätter, Wirbel ─────────
    def _build_wind(self):
        rng = np.random.default_rng(5)
        self.streaks = [dict(y=rng.uniform(0, self.H), x=rng.uniform(0, self.W), v=rng.uniform(700, 1400), ln=int(rng.integers(5, 13)), dy=rng.uniform(0.05, 0.22),
                             c=int(rng.integers(0, 3)), th=rng.uniform(0, 1)) for _ in range(46)]
        self.leaves = [dict(y=rng.uniform(100, self.H - 100), x=rng.uniform(0, self.W), v=rng.uniform(380, 760), ph=rng.uniform(0, 6.3), amp=rng.uniform(30, 90),
                            c=int(rng.integers(0, 3)), th=rng.uniform(0, 1)) for _ in range(20)]

    def _draw_streaks(self, canvas, t):
        w = self.wind(t)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        n = int(8 + 38 * w)
        for k, s in enumerate(self.streaks[:n]):
            sp = s['v'] * (0.5 + w)
            x = (s['x'] + sp * t) % (self.W + 400) - 200
            y = s['y'] + s['dy'] * (x + 200) * 0.0 + 20 * math.sin(t * 2 + k)
            cx, cy = self._cp(x, y)
            g.line(gamefx.rd(cx), gamefx.rd(cy), gamefx.rd(cx + s['ln'] * (0.6 + w)), gamefx.rd(cy + s['ln'] * s['dy'] * 0.6), WIND[s['c']], 0.7)

    def _draw_leaves(self, canvas, t):
        w = self.wind(t)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        n = int(3 + 17 * w)
        for k, l in enumerate(self.leaves[:n]):
            sp = l['v'] * (0.6 + 1.1 * w)
            x = (l['x'] + sp * t) % (self.W + 300) - 150
            y = l['y'] + l['amp'] * math.sin(t * (2.0 + w * 3) + l['ph'])
            cx, cy = self._cp(x, y)
            cx, cy = gamefx.rd(cx), gamefx.rd(cy)
            col = LEAF[l['c']]
            fr = int(t * 8 + k) % 2
            m.rect(cx, cy, 2, 1, col)
            m.rect(cx + (1 if fr else 0), cy + 1, 2 if fr else 1, 1, LEAF[(l['c'] + 1) % 3])

    def _draw_vortex(self, canvas, t):
        """Der Sturm kreist um die volle Hand: Windteilchen auf einer flachen Ellipse mit Schweif."""
        if not self.locked(t):
            return
        a0 = next(a for a, b in self.lock_iv if a <= t < b)
        grow = smooth((t - a0) / 0.5)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        cx0, cy0 = 540, self.HY - 10
        rx, ry = 520 * grow, 150 * grow
        for k in range(44):
            th0 = t * 5.2 + k * 2 * math.pi / 44
            for j in range(5):
                th = th0 - j * 0.09
                x = cx0 + math.cos(th) * rx * (1 + 0.05 * math.sin(k * 3 + t))
                y = cy0 + math.sin(th) * ry * (1 + 0.1 * math.sin(k + t * 2))
                cx, cy = self._cp(x, y)
                col = WIND[2] if j == 0 else WIND[1] if j < 3 else WIND[0]
                g.put(gamefx.rd(cx), gamefx.rd(cy), col, 1.0 if j < 3 else 0.6)

    # ───────── Hand, Deck, Flüge ─────────
    def _draw_hand(self, canvas, d, t):
        U = self.U
        # leere Slots als gestrichelte Umrisse
        for i in range(7):
            x, y = self.slot_xy(i)
            x0, y0 = int(x - self.HW / 2), int(y - self.HH / 2)
            filled = any(a <= t and (b is None or t < b) for a, b in self.fill[i])
            if filled:
                if t < 0.7 + 0.3 and i < 2:
                    continue
                canvas.paste(self.back, (int(round(x0 / U) * U), int(round(y0 / U) * U)), self.back)
            elif t >= 0.7:
                if int(t * 3) % 2 == 0 or True:
                    for k in range(0, self.HW, 28):
                        self.pix_rect(d, x0 + k, y0, x0 + k + 13, y0 + 3, (110, 140, 150)); self.pix_rect(d, x0 + k, y0 + self.HH - 4, x0 + k + 13, y0 + self.HH - 1, (110, 140, 150))
                    for k in range(0, self.HH, 28):
                        self.pix_rect(d, x0, y0 + k, x0 + 3, y0 + k + 13, (110, 140, 150)); self.pix_rect(d, x0 + self.HW - 4, y0 + k, x0 + self.HW - 1, y0 + k + 13, (110, 140, 150))
        # Deck
        if t >= 2.4:
            for k in range(3):
                canvas.paste(self.back, (int(self.DECK[0] - self.back.width / 2 + 4 * k), int(self.DECK[1] - self.back.height / 2 - 4 * k)), self.back)
            self.draw_text(canvas, 'DECK', 2, (self.DECK[0], self.DECK[1] + self.back.height / 2 + 24), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))

    def _draw_flights(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        U, gp = self.U, self.gp
        for f in self.flights:
            dt = t - f['t0']
            z = f['zug']
            if dt < 0 or dt >= z.ende:
                continue
            if f['kind'] == 'block':
                # Der Wind erfasst die Karte auf halber Strecke: sie treibt seitlich weg und blinkt aus
                tc = 0.26
                if dt < tc:
                    z.draw(m, dt) if False else None
                    px, py = z.pos(dt)
                    self._card_at(canvas, px * gp + self.ox, py * gp + self.oy)
                    self._trail_only(m, z, dt)
                else:
                    px, py = z.pos(tc)
                    u = dt - tc
                    x = px * gp + self.ox + 640 * u * (1.0 + u)
                    y = py * gp + self.oy - 80 * u + 40 * math.sin(u * 14)
                    if u < 0.5 and int(t * 30) % 2 == 0:
                        self._card_at(canvas, x, y)
                    self._wisp(m, x, y, t)
                if 0.35 <= dt < 1.3 and int(t * 6) % 2 == 0:
                    self.draw_text(canvas, 'BLOCKED!', 4, (540, 1470), color=(170, 230, 255), outline=(10, 40, 60), shadow=None)
                continue
            z.draw(m, dt)
            if dt < z.dauer:
                px, py = z.pos(dt)
                self._card_at(canvas, px * gp + self.ox, py * gp + self.oy)

    def _trail_only(self, m, z, dt):
        saved = z.ringe
        z.ringe = False
        z.draw(m, dt)
        z.ringe = saved

    def _wisp(self, m, x, y, t):
        cx, cy = self._cp(x, y)
        for k in range(8):
            ox = -k * 2 - gamefx.H(k, 3) * 2
            oy = (gamefx.H(k, 5) - 0.5) * 5
            if ((k + int(t * 30)) & 1) == 0:
                m.rect(gamefx.rd(cx + ox), gamefx.rd(cy + oy), 1, 1, WIND[k % 3])

    def _card_at(self, canvas, x, y):
        U = self.U
        canvas.paste(self.back, (int(round((x - self.back.width / 2) / U) * U), int(round((y - self.back.height / 2) / U) * U)), self.back)

    # ───────── Zähler, Beschriftungen ─────────
    def _draw_hud(self, canvas, d, t):
        n = self.hand_n(t)
        self.draw_text(canvas, 'HAND', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, '%d/7' % n, 9, (125, 140), color=GOLD if n < 7 else (170, 255, 190), outline=None, shadow=(10, 50, 20))
        self.draw_text(canvas, 'DRAW', 3, (955, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        if self.locked(t):
            if int(t * 4) % 2 == 0:
                self.draw_text(canvas, 'LOCKED', 6, (955, 140), color=(255, 110, 110), outline=None, shadow=(70, 10, 10))
        else:
            self.draw_text(canvas, 'READY', 6, (955, 140), color=(170, 255, 190), outline=None, shadow=(10, 50, 20))
        for T in (self.T1 - 0.05, self.T3 + 1.45):
            if T <= t < T + 1.1 and int(t * 8) % 2 == 0:
                self.draw_text(canvas, 'DRAW UP TO 7!', 5, (540, 1000), color=GOLD_HL, outline=(20, 10, 30), shadow=None)
        if self.T3 - 0.3 <= t < self.T3 + 0.7 and int(t * 6) % 2 == 0:
            self.draw_text(canvas, 'NEXT TURN', 6, (540, 1000), color=(255, 255, 255), outline=(20, 10, 30), shadow=None)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_leaves(canvas, t)
        self._draw_hand(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_flights(canvas, d, t)
        self._draw_vortex(canvas, t)
        self._draw_hud(canvas, d, t)
        self._draw_caption(canvas, ImageDraw.Draw(canvas), t)

    # ───────── Interface ─────────
    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        self._draw_fog(canvas, t)
        self._draw_streaks(canvas, t)

    def draw_logo(self, canvas, f):
        lx, ly, lw, lh = self.g['logo_rect']
        canvas.paste(self.g['logo_img'], (int(lx), int(ly)), self.g['logo_img'])

    def draw_badge(self, canvas, f):
        bx, by, bw, bh = self.g['badge_rect']
        canvas.paste(self.g['badge_img'], (bx, by), self.g['badge_img'])

    def plate_dx(self, f):
        t = f / float(self.fps)
        dx = 0.0
        for tg, a in self.TENSION_SHAKES:
            tau = t - tg
            if tau >= 0:
                dx += a * math.exp(-tau / 0.25) * math.cos(2 * math.pi * 5 * tau)
        return int(round(dx / self.U)) * self.U

    def sprite_dx(self, f):
        return int(round(0.4 * self.plate_dx(f) / self.U)) * self.U

    def hide_sprite(self, f):
        return False

    def post_fx(self, img, f):
        t = f / float(self.fps)
        fl = 0.0
        for tg in self.FLASHES:
            if 0 <= t - tg < 0.25:
                fl = max(fl, 0.35 * math.exp(-(t - tg) / 0.08))
        if fl <= 0:
            return img
        arr = np.asarray(img).astype(np.float32)
        arr = arr * (1 - fl) + 255.0 * fl
        return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')

    def opener_fx(self, img, f, t_gust=None):
        return img

    def closer_fx(self, img, f):
        t = f / float(self.fps)
        if t < self.D - 1.0:
            return img
        a = 0.42 * ((t - (self.D - 1.0)) / 1.0) ** 2
        return Image.blend(img.convert('RGB'), Image.new('RGB', img.size, (255, 255, 255)), a) if a > 0 else img

    # ───────── Soundeffekte ─────────
    def sfx_events(self):
        D = self.D
        ev = []

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t + (item[2] if len(item) > 2 else 0.0), item[0], item[1]) + tuple(item[3:]))
        add(0.3, 'wind')
        for fl in self.flights:
            t0 = fl['t0']
            if fl['kind'] == 'draw':
                add(t0, 'draw')
            elif fl['kind'] == 'play':
                add(t0, 'play')
            else:
                add(t0 + 0.05, 'draw'); add(t0 + 0.3, 'block')
        for tf in self.t_full:
            add(tf - 0.2, 'wind'); add(tf, 'ping')
        ev.append((D - 1.0, 'ascension', -9, 1.2))
        return sorted(ev)
