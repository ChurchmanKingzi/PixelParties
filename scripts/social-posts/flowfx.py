"""Mizune-Show: der ruhige Wassermagier. Einmal pro Zug spült er eine eigene Surprise weg (Whirlpool) und zieht dafür Karten: 1 Karte, +1 wenn der Held sie aktivieren könnte, +1 wenn sie aufgedeckt war.
Am Ende findet er das erste seiner drei Geschwister (Kazena). Der Whirlpool und der Kartenzug sind Nachbauten der echten Spiel-Animationen (gamefx.py). Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

WATER = [(40, 90, 150), (60, 140, 215), (130, 210, 245), (230, 250, 255)]


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class FlowShow(CaptionMixin):
    CW, CH = 180, 252
    SLOT_X = [330, 540, 750]
    SLOT_Y = 1762
    HAND = (110, 1762)
    DECK = (975, 1762)
    SMALL = (120, 168)
    ACTS = [dict(T=1.0, slot=0, up=False, n=1), dict(T=6.8, slot=1, up=False, n=2), dict(T=11.4, slot=2, up=True, n=3)]
    HAND0 = 2
    T_SIB = 17.0
    CAPTIONS = [
        (0.2, 2.6, '*Silent Water Mizune* is on his way...'),
        (2.8, 6.6, 'Once per turn he *flushes* one of his own *Surprises* away - and *draws* a card.'),
        (6.8, 11.2, 'The hero could have *activated* it? *One more* card!'),
        (11.4, 16.0, 'And a *face-up* Surprise gives *another* - up to *3 cards* from one Surprise.'),
        (16.2, 20.6, '*Mizune* clears the way, calm and patient - his *siblings* are waiting to be found.'),
    ]
    SND = {
        'slot':   [('placement', -10)],
        'flush':  [('elem_water', -5), ('pull_circle', -10)],
        'draw':   [('draw', -5)],
        'flip':   [('reveal', -6)],
        'sib':    [('ability_activate', -6), ('elem_wind', -8)],
        'ping':   [('ping', -9)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self._cache = {}
        self.K = 14.0 / self.gp
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        cb = Image.open(geom['cardback_path']).convert('RGB')

        def mkback(w, h):
            wu, hu = w // U, h // U
            inner = ImageEnhance.Color(ImageEnhance.Contrast(cb.resize((wu - 2, hu - 3), Image.BOX)).enhance(1.35)).enhance(1.5).convert('RGBA')
            c = Image.new('RGBA', (wu, hu), (255, 150, 40, 255))
            c.paste(inner, (1, 1))
            return c.resize((wu * U, hu * U), Image.NEAREST)
        self.back = mkback(self.CW, self.CH)
        self.small = mkback(*self.SMALL)
        self.faces = [ld('s%d' % (i + 1)).resize((self.CW, self.CH), Image.BOX) for i in range(3)]
        self.kaz = ld('kazena')
        for a in self.ACTS:
            a['t_whirl'] = a['T'] + 0.3
            a['t_gone'] = a['T'] + 0.6
            a['t_draw'] = a['T'] + 1.3
        self.hand_events = []                                                          # (Landezeit)
        for a in self.ACTS:
            a['land'] = [a['t_draw'] + 0.2 * k + 0.5 for k in range(a['n'])]
            self.hand_events += a['land']
        self.FLASHES = (0.0,)
        self.SHOCKS = (0.0, self.T_SIB)
        self.TENSION_SHAKES = [(0.0, 7), (self.T_SIB, 7)] + [(a['t_whirl'] + 0.5, 5) for a in self.ACTS]
        self.T_GUST = 0.0
        self._fx = {}

    # ───────── Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def _ci(self, x, y):
        a, b = self._cp(x, y)
        return gamefx.rd(a), gamefx.rd(b)

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

    def hand_n(self, t):
        return self.HAND0 + sum(1 for x in self.hand_events if t >= x)

    def _card_at(self, canvas, im, x, y):
        U = self.U
        canvas.paste(im, (int(round((x - im.width / 2) / U) * U), int(round((y - im.height / 2) / U) * U)), im)

    def _dissolve(self, im, u, key):
        k = (key, int(u * 16))
        if k not in self._cache:
            U = self.U
            w, h = im.size
            a = np.asarray(im).copy()
            yy, xx = np.mgrid[0:h, 0:w]
            thr = np.array(gamefx.BAY8)[((yy // U) % 8), ((xx // U) % 8)] / 64.0
            a[..., 3] = np.where(thr >= int(u * 16) / 16.0, a[..., 3], 0)
            self._cache[k] = Image.fromarray(a, 'RGBA')
        return self._cache[k]

    # ───────── Wasser ─────────
    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        gp = self.gp
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        g = gamefx.R1(m)
        y0 = 1480
        # Wasserfläche: ruhige Wellenbänder (Dither), langsam fließend
        for r in range(0, (self.H - y0) // 26 + 1):
            y = y0 + r * 26
            depth = r / float((self.H - y0) / 26.0)
            col = WATER[0] if depth > 0.4 else WATER[1]
            n = 7
            for k in range(n):
                x = (k * 63 + r * 37 + t * (14 + r * 3)) % (self.W + 120) - 60
                ln = 5 + (k + r) % 5
                cx, cy = self._ci(x, y + 6 * math.sin(t * 0.8 + k + r))
                for i in range(ln):
                    g.put(cx + i, cy, col, 0.30 if depth > 0.4 else 0.40)
        # Ringe: Tropfen fallen aufs Wasser
        for k in range(10):
            t0 = 0.6 + k * 1.9
            u = (t - t0) / 1.8
            if 0 <= u < 1:
                x = 90 + ((k * 331) % 900)
                y = y0 + 80 + ((k * 197) % 300)
                cx, cy = self._ci(x, y)
                R = gamefx.rd(2 + gamefx.ease(u) * 9)
                for a in range(0, 360, 12):
                    an = math.radians(a)
                    if u > 0.6 and ((a // 12 + int(t * 20)) & 1):
                        continue
                    g.put(cx + math.cos(an) * R, cy + math.sin(an) * R * 0.4, WATER[2], 0.9)

    # ───────── Surprises ─────────
    def _slot_alive(self, k, t):
        for a in self.ACTS:
            if a['slot'] == k and t >= a['t_gone']:
                return False
        return True

    def _draw_slots(self, canvas, d, t):
        U, gp = self.U, self.gp
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        for k, x in enumerate(self.SLOT_X):
            ts = 0.4 + 0.15 * k
            if t < ts:
                continue
            a = [aa for aa in self.ACTS if aa['slot'] == k][0]
            up = ease_out((t - ts) / 0.3)
            y = self.SLOT_Y + 200 * (1 - up)
            if t < a['t_gone']:
                im = self.faces[k] if a['up'] else self.back
                if a['t_whirl'] <= t < a['t_gone']:                                      # wird weggespült: löst sich auf und wird zur Mitte gezogen
                    u = (t - a['t_whirl']) / 0.3
                    im = self._dissolve(im, kl01(u), ('dis', k))
                self._card_at(canvas, im, x, y)
                self.draw_text(canvas, 'SURPRISE', 2, (x, y - 146), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
            else:
                x0, y0 = x - self.CW / 2, self.SLOT_Y - self.CH / 2                      # leerer Platz
                for q in range(0, self.CW, 28):
                    self.pix_rect(d, x0 + q, y0, x0 + q + 13, y0 + 3, (90, 140, 190)); self.pix_rect(d, x0 + q, y0 + self.CH - 4, x0 + q + 13, y0 + self.CH - 1, (90, 140, 190))
                for q in range(0, self.CH, 28):
                    self.pix_rect(d, x0, y0 + q, x0 + 3, y0 + q + 13, (90, 140, 190)); self.pix_rect(d, x0 + self.CW - 4, y0 + q, x0 + self.CW - 1, y0 + q + 13, (90, 140, 190))
            # Beschriftung: was diese Surprise bringt
            if t >= a['T'] and t < a['T'] + 2.6 and int(t * 6) % 2 == 0:
                self.draw_text(canvas, 'DRAW %d' % a['n'], 5, (x, self.SLOT_Y - 170), color=GOLD_HL, outline=(20, 10, 30), shadow=None)
        for a in self.ACTS:
            if a['up'] and a['T'] - 0.4 <= t < a['T'] + 0.4 and int(t * 8) % 2 == 0:
                self.draw_text(canvas, 'FACE-UP', 3, (self.SLOT_X[a['slot']], self.SLOT_Y + 160), color=(170, 230, 255), outline=None, shadow=(10, 40, 70))
        # Whirlpools
        for i, a in enumerate(self.ACTS):
            key = ('wp', i)
            if key not in self._fx:
                cx, cy = self._ci(self.SLOT_X[a['slot']], self.SLOT_Y)
                self._fx[key] = gamefx.Whirlpool(cx, cy, scale=0.3 * self.K, salt=11 + i)
            self._fx[key].draw(m, t - a['t_whirl'])

    # ───────── Karten ziehen ─────────
    def _draw_draws(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        gp = self.gp
        # Stapel: Deck und Hand
        for k in range(3):
            canvas.paste(self.small, (int(self.DECK[0] - self.small.width / 2 + 4 * k), int(self.DECK[1] - self.small.height / 2 - 4 * k)), self.small)
        n = self.hand_n(t)
        for k in range(n):
            canvas.paste(self.small, (int(self.HAND[0] - self.small.width / 2 + 7 * (k % 8)), int(self.HAND[1] - self.small.height / 2 - 9 * (k % 8))), self.small)
        for i, a in enumerate(self.ACTS):
            for k in range(a['n']):
                key = ('zug', i, k)
                if key not in self._cache:
                    self._cache[key] = gamefx.Zug(self._cp(*self.DECK), self._cp(self.HAND[0], self.HAND[1] - 40), dauer=0.5, cw=self.SMALL[0] / float(gp), bogen=-200 / gp,
                                                  salt=70 + i * 7 + k, farbe=gamefx.hexc('#66b6ff'))
                z = self._cache[key]
                dt = t - (a['t_draw'] + 0.2 * k)
                if 0 <= dt < z.ende:
                    z.draw(m, dt)
                    if dt < z.dauer:
                        px, py = z.pos(dt)
                        self._card_at(canvas, self.small, px * gp + self.ox, py * gp + self.oy)

    # ───────── Geschwister ─────────
    def _draw_siblings(self, canvas, d, t):
        if t < self.T_SIB - 0.6:
            return
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        self.draw_text(canvas, 'SIBLINGS', 3, (540, 60), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        cx0 = 540 - 130
        for k in range(3):
            x = cx0 + 130 * k
            self.pix_rect(d, x - 52, 90, x + 52, 214, (20, 10, 40))
            col = (110, 190, 255) if k == 0 and t >= self.T_SIB else (90, 100, 130)
            for (a, b, c, e) in ((x - 52, 90, x + 52, 93), (x - 52, 211, x + 52, 214), (x - 52, 90, x - 49, 214), (x + 49, 90, x + 52, 214)):
                self.pix_rect(d, a, b, c, e, col)
            if k == 0 and t >= self.T_SIB:
                ic = self.kaz.resize((self.kaz.width * 3, self.kaz.height * 3), Image.NEAREST)
                u = ease_out((t - self.T_SIB) / 0.4)
                canvas.paste(ic, (int(x - ic.width / 2), int(152 - ic.height / 2 + 30 * (1 - u))), ic)
            else:
                self.draw_text(canvas, '?', 7, (x, 152), color=(150, 160, 190), outline=None, shadow=(20, 10, 30))
        tau = t - self.T_SIB
        if 0 <= tau < 0.8:
            cx, cy = self._ci(cx0, 152)
            g = gamefx.R1(m)
            r = gamefx.rd(gamefx.ease(tau / 0.6) * 12)
            g.ring(cx, cy, max(0, r - 2), r, WATER[3], 1.0)
        if self.T_SIB + 0.5 <= t < self.T_SIB + 2.5 and int(t * 6) % 2 == 0:
            self.draw_text(canvas, 'KAZENA FOUND!', 4, (540, 260), color=GOLD_HL, outline=(20, 10, 30), shadow=None)
        if t >= self.T_SIB + 0.5:
            self.draw_text(canvas, '1/3', 4, (540, 232 if False else 240), color=(170, 230, 255), outline=None, shadow=(10, 40, 70)) if not (self.T_SIB + 0.5 <= t < self.T_SIB + 2.5 and int(t * 6) % 2 == 0) else None

    # ───────── Zähler ─────────
    def _draw_hud(self, canvas, d, t):
        self.draw_text(canvas, 'HAND', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(self.hand_n(t)), 9, (125, 140), color=GOLD, outline=None, shadow=(60, 30, 0))
        if t < self.T_SIB - 0.6:
            self.draw_text(canvas, 'DRAWN', 3, (955, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
            self.draw_text(canvas, '+%d' % (self.hand_n(t) - self.HAND0), 9, (950, 140), color=(170, 230, 255), outline=None, shadow=(10, 40, 70))

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_slots(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_draws(canvas, d, t)
        self._draw_siblings(canvas, d, t)
        self._draw_hud(canvas, d, t)
        self._draw_caption(canvas, ImageDraw.Draw(canvas), t)

    # ───────── Interface ─────────
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
                fl = max(fl, 0.4 * math.exp(-(t - tg) / 0.08))
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
        for k in range(3):
            add(0.4 + 0.15 * k, 'slot')
        for a in self.ACTS:
            if a['up']:
                add(a['T'] - 0.1, 'flip')
            add(a['t_whirl'], 'flush')
            for k in range(a['n']):
                add(a['t_draw'] + 0.2 * k, 'draw')
            add(a['T'], 'ping')
        add(self.T_SIB, 'sib')
        ev.append((D - 1.0, 'ascension', -9, 1.2))
        return sorted(ev)


def kl01(u):
    return max(0.0, min(1.0, u))
