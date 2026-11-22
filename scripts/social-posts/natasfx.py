"""Natas-Show: der Drahtzieher der Hölle. Statt zu ziehen holt er jede Runde „The Master's Plan“ von außerhalb des Spiels auf die Hand - ein Omni-Negate, der jede Karte aus der Hand des Gegners
negiert. Jede Negation vergiftet ein Ziel (2 Stapel Poison, je 30 Schaden pro Stapel und Zug).
Die Reaktionskette (Impuls, Rahmen, X-Zeichen, rote Kacheln beim Zerbröseln = `reaction_chain_link_negated` aus app-fx-53), Plague Smoke (app-fx-15), die Gift-Blasen samt Totenköpfen
(poison_vial / poison_tick, app-fx-23) und der Kartenzug (Zug, gamefx.py) sind Nachbauten der echten Spiel-Animationen. Gleiche Schnittstelle wie WebShow."""
import math
import zlib

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

VIOLET = (200, 130, 255)
VIOLET_D = (102, 24, 180)
ROT, ROT_D, ROT_DD = (254, 81, 84), (192, 20, 28), (82, 10, 12)
NACHT = (8, 6, 12)


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


KREUZ = ['#.......#', '##.....##', '#r#...#r#', '.#r#.#r#.', '..#r#r#..', '.#r#.#r#.', '#r#...#r#', '##.....##', '#.......#']
SCHAEDEL = ['.WWW.', 'WKWKW', 'WWWWW', '.WWW.', '.W.W.']


class PlanShow(CaptionMixin):
    CW, CH = 180, 252                                                                 # Plan auf der Hand
    LW, LH = 180, 252                                                                 # Karten der Kette
    HAND = (150, 1752)
    DECK = (975, 1752)
    EN = (925, 500)                                                                   # Gegner-Held (Peter Röll)
    EW, EH = 150, 210
    L1 = (480, 1752)                                                                   # Kettenglied 1: die Karte des Gegners
    L2 = (700, 1752)                                                                   # Kettenglied 2: The Master's Plan
    T0 = [0.8, 6.6, 12.4]
    SP, EP, EL, RP, RL, RS, PZ = 0.4, 2.6, 3.1, 3.6, 4.1, 4.5, 5.4                    # Versatz zum Rundenbeginn
    NEGF = 12 / 30.0                                                                  # Bilder (30 Hz) mit rotem Rahmen und X, bevor die Karte zerbröselt
    T_TICK = [6.6, 12.4, 18.2]                                                        # Gift-Schaden am Zugbeginn: 60 / 120 / 180
    HP0 = 400
    CAPTIONS = [
        (0.2, 3.0, '*Natas*, the Master of Hell, pulls the strings.'),
        (3.2, 7.8, 'Each turn he *skips his draw* - and adds *The Master\'s Plan* to his hand.'),
        (8.0, 13.0, 'An *omni-negate* - whatever the opponent plays from hand is *negated*.'),
        (13.2, 18.0, 'Each negation inflicts *2 stacks of Poison* - on any target he likes.'),
        (18.2, 22.4, 'One of the Archmage\'s *five students* - and the *darkest* curser of all.'),
        (22.6, 25.7, 'The opponent will not last *another turn*.'),
    ]
    SND = {
        'turn':   [('turn_start', -10)],
        'spawn':  [('pull_reveal', -6), ('revive', -11)],
        'whoosh': [('booster_card_whoosh', -8)],
        'land':   [('placement', -8)],
        'chain':  [('chain_add', -8)],
        'ping':   [('ping', -8)],
        'negate': [('negate', -4), ('critical_strike', -12)],
        'crumble': [('discard', -8)],
        'poison': [('poison', -5), ('debuff', -10)],
        'tick':   [('poison', -9), ('damage', -8)],
        'alarm':  [('ui_error', -9)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self._cache = {}
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        self.plan_big = ld('plan').resize((self.CW, self.CH), Image.BOX)
        self.plan_l = ld('plan').resize((self.LW, self.LH), Image.BOX)
        self.enemy_cards = [ld('c%d' % (i + 1)).resize((self.LW, self.LH), Image.BOX) for i in range(3)]
        self.peter = ld('peter').resize((self.EW, self.EH), Image.BOX)
        self.back = None
        self.FLASHES = (0.0,)
        self.SHOCKS = (0.0,)
        self.TENSION_SHAKES = [(0.0, 7)] + [(T + self.RS, 7) for T in self.T0] + [(t, 5) for t in self.T_TICK]
        self.T_GUST = 0.0
        self._fx = {}
        self.t_win = self.T_TICK[2] + 4.6
        self._build_tiles()

    # ───────── Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def _ci(self, x, y):
        a, b = self._cp(x, y)
        return gamefx.rd(a), gamefx.rd(b)

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

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

    def stacks(self, t):
        return 2 * sum(1 for T in self.T0 if t >= T + self.PZ + 0.5)

    def hp(self, t):
        h = self.HP0
        for i, tt in enumerate(self.T_TICK):
            if t >= tt + 0.5:
                h -= 60 * (i + 1)
        return h

    def n_negated(self, t):
        return sum(1 for T in self.T0 if t >= T + self.RS + 0.1)

    def turn_no(self, t):
        return max(1, sum(1 for T in self.T0 if t >= T) + (1 if t >= self.T_TICK[2] else 0))

    # ───────── Hölle (Hintergrund) ─────────
    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        y0 = 1440
        cols = [(96, 20, 70), (140, 30, 80), (60, 14, 60)]
        for r in range(0, (self.H - y0) // 30 + 1):
            y = y0 + r * 30
            depth = r / float((self.H - y0) / 30.0)
            for k in range(6):
                x = (k * 71 + r * 41 - t * (20 + r * 4)) % (self.W + 160) - 80
                ln = 6 + (k + r) % 6
                cx, cy = self._ci(x, y + 8 * math.sin(t * 0.9 + k + r))
                for i in range(ln):
                    g.put(cx + i, cy, cols[(k + r) % 3], 0.22 + 0.25 * depth)
        for k in range(14):                                                           # Glut steigt auf
            u = ((t * 0.28 + k * 0.137) % 1.0)
            x = 70 + ((k * 211) % 940)
            y = self.H - u * 560
            cx, cy = self._ci(x + 14 * math.sin(t * 2 + k), y)
            if int(t * 8 + k) % 3:
                g.put(cx, cy, (255, 140, 60), 0.8 * (1 - u))

    # ───────── Plague Smoke (app-fx-15) ─────────
    def _smoke(self, g, cx, cy, tau, F, key):
        """cx, cy in Zellen; tau in s seit Start; F = Pixel je Spiel-Pixel."""
        if tau < 0 or tau > 1.0:
            return
        key = zlib.crc32(repr(key).encode())
        if ('sm', key) not in self._cache:
            n = 18
            self._cache[('sm', key)] = [dict(dx=-30 + 60 * gamefx.H(key, i * 5 + 1), dy=-15 + 30 * gamefx.H(key, i * 5 + 2), size=25 + 35 * gamefx.H(key, i * 5 + 3),
                                              delay=i * (0.34 / n) + 0.04 * gamefx.H(key, i * 5 + 4), dur=0.48 + 0.16 * gamefx.H(key, i * 5 + 5), op=0.5 + 0.4 * gamefx.H(key, i * 5 + 6)) for i in range(n)]
        cols = [(20, 20, 20), (34, 34, 34), (50, 50, 50)]
        for c in self._cache[('sm', key)]:
            u = (tau - c['delay']) / c['dur']
            if u <= 0 or u >= 1:
                continue
            if u < 0.5:
                e = smooth(u / 0.5)
                px, py, sc = c['dx'] * e, 5 + (c['dy'] - 5) * e, 0.4 + 0.6 * e
            else:
                e = smooth((u - 0.5) / 0.5)
                px, py, sc = c['dx'] * (1 + 0.3 * e), c['dy'] - 15 * e, 1 + 0.2 * e
            op = (u / 0.2 if u < 0.2 else 1.0 if u < 0.5 else 1 - (u - 0.5) / 0.5) * c['op']
            r = c['size'] * sc / 2 * F / self.gp
            X, Y = cx + px * F / self.gp, cy + py * F / self.gp
            for lv, col in enumerate(cols):
                rr = r * (1 - 0.28 * lv)
                if rr >= 0.6:
                    g.disc(X, Y, rr, col, min(1.0, op * 1.25) * 0.55)

    # ───────── Gift (app-fx-23) ─────────
    def _poison(self, canvas, g, cx, cy, tau, vial, key, F):
        if tau < 0 or tau > 1.2:
            return
        key = zlib.crc32(repr(key).encode())
        if ('po', key) not in self._cache:
            n = 12 if vial else 14
            bl = []
            for i in range(n):
                bl.append(dict(x=(-30 if vial else -25) + (60 if vial else 50) * gamefx.H(key, i * 7 + 1), size=(6 + 10 * gamefx.H(key, i * 7 + 2)) if vial else (4 + 7 * gamefx.H(key, i * 7 + 2)),
                               delay=0.2 * gamefx.H(key, i * 7 + 3), dur=(0.5 + 0.5 * gamefx.H(key, i * 7 + 4)) if vial else (0.4 + 0.4 * gamefx.H(key, i * 7 + 4)),
                               col=[(102, 24, 180), (144, 58, 230), (169, 82, 255)][int(gamefx.H(key, i * 7 + 5) * 3)], wob=-10 + 20 * gamefx.H(key, i * 7 + 6), sk=False))
            if vial:
                for i in range(5):
                    bl.append(dict(x=-20 + 40 * gamefx.H(key, i * 9 + 101), size=14, delay=0.2 + 0.3 * gamefx.H(key, i * 9 + 102), dur=0.6 + 0.4 * gamefx.H(key, i * 9 + 103),
                                   col=(149, 68, 213), wob=0, sk=True))
            self._cache[('po', key)] = bl
        # Blitz (Dither-Dichte statt Alpha)
        if tau < 0.5:
            u = tau / 0.5
            sc = 0.3 + 1.3 * u if u < 0.5 else 1.3 + (u - 0.5) * 0.6
            op = 1.0 - 0.8 * u if u < 0.5 else 0.2 * (1 - (u - 0.5) / 0.5)
            r = 20 * sc * F / self.gp
            g.disc(cx, cy, r, (102, 24, 180) if not vial else (144, 58, 230), max(0.0, op) * 0.9)
        for b in self._cache[('po', key)]:
            u = (tau - b['delay']) / b['dur']
            if u <= 0 or u >= 1:
                continue
            if u < 0.2:
                op, dy, sc = 0.9 * u / 0.2, -15 * u / 0.2, 0.5 + 0.5 * u / 0.2
            elif u < 0.6:
                e = (u - 0.2) / 0.4
                op, dy, sc = 0.9 - 0.2 * e, -15 - 30 * e, 1 + 0.1 * e
            else:
                e = (u - 0.6) / 0.4
                op, dy, sc = 0.7 * (1 - e), -45 - 35 * e, 1.1 - 0.7 * e
            d = b['size'] * sc * F / self.gp
            X = cx + (b['x'] + b['wob'] * (u - 0.5)) * F / self.gp
            Y = cy + (10 + dy - b['size'] / 2) * F / self.gp
            if b['sk']:
                if d >= 2.5:
                    g.disc(X, Y, d / 2 - 0.2, b['col'], op * 0.6)
                if d >= 3:
                    for ry, row in enumerate(SCHAEDEL):
                        for rx, ch in enumerate(row):
                            if ch != '.':
                                g.put(X + rx - 2, Y + ry - 2, (255, 255, 255) if ch == 'W' else (80, 0, 140), op)
            else:
                g.disc(X, Y, max(0.6, d / 2 - 0.2), b['col'], op)

    # ───────── Kacheln (Karte zerbröselt) ─────────
    def _build_tiles(self):
        self.tiles = {}
        step = 16
        for key, im in [('plan', self.plan_l)] + [('e%d' % i, self.enemy_cards[i]) for i in range(3)]:
            ts = []
            w, h = im.size
            for ty in range(0, h, step):
                for tx in range(0, w, step):
                    hh, h2 = gamefx.H(len(ts) * 31 + tx, 7), gamefx.H(len(ts) * 131 + ty, 99)
                    cell = im.crop((tx, ty, tx + step, ty + step))
                    red = cell.copy()
                    a = np.asarray(red).copy()
                    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
                    chk = (((yy // 8) + (xx // 8)) % 2 == 0)
                    a[chk, 0], a[chk, 1], a[chk, 2] = ROT_D
                    red = Image.fromarray(a, 'RGBA')
                    ts.append(dict(img=cell, red=red, x=tx - w / 2, y=ty - h / 2, vx=-(1.6 + hh * 3.6) * 60, vy=(-0.7 + h2 * 1.5 - (ty / step) * 0.05) * 60, life=0.13 + hh * 0.1))
            self.tiles[key] = ts

    def _crumble(self, canvas, key, cx, cy, tau, neg):
        U = self.U
        if tau < 0 or tau > 0.6:
            return
        for p in self.tiles[key]:
            lv = max(0.0, min(1.0, (tau - p['life']) / 0.1)) * 16
            if lv >= 16:
                continue
            x = cx + p['x'] + p['vx'] * tau
            y = cy + p['y'] + p['vy'] * tau + 0.5 * 900 * tau * tau
            im = p['red'] if neg else p['img']
            if lv > 0 and (int(tau * 30) % 3) < lv / 6:
                continue
            canvas.paste(im, (int(round(x / U) * U), int(round(y / U) * U)), im)

    # ───────── Kette ─────────
    def _frame(self, d, x, y, w, h, rings):
        o = 0
        for col, th in rings:
            self.pix_rect(d, x - w / 2 - o - th, y - h / 2 - o - th, x + w / 2 + o + th - 1, y - h / 2 - o - 1, col)
            self.pix_rect(d, x - w / 2 - o - th, y + h / 2 + o, x + w / 2 + o + th - 1, y + h / 2 + o + th - 1, col)
            self.pix_rect(d, x - w / 2 - o - th, y - h / 2 - o, x - w / 2 - o - 1, y + h / 2 + o - 1, col)
            self.pix_rect(d, x + w / 2 + o, y - h / 2 - o, x + w / 2 + o + th - 1, y + h / 2 + o - 1, col)
            o += th

    def _x_sprite(self, d, cx, cy, px=8):
        for j, row in enumerate(KREUZ):
            for i, ch in enumerate(row):
                if ch == '.':
                    continue
                x0 = cx + (i - 4.5) * px
                y0 = cy + (j - 4.5) * px
                self.pix_rect(d, x0, y0, x0 + px - 1, y0 + px - 1, NACHT if ch == '#' else ROT)

    def _draw_chain(self, canvas, d, t):
        gp, U = self.gp, self.U
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        gr = gamefx.R1(m)
        for k, T in enumerate(self.T0):
            t_e0, t_el = T + self.EP, T + self.EL
            t_r0, t_rl = T + self.RP, T + self.RL
            t_rs = T + self.RS
            t_neg_end = t_rs + self.NEGF
            ekey = 'e%d' % k
            # Flüge
            ze = self._zug(('ze', k), self.EN, self.L1, 100 + k, '#ff6a6a', 0.5)
            dt = t - t_e0
            if 0 <= dt < ze.ende:
                ze.draw(m, dt)
                if dt < ze.dauer:
                    px, py = ze.pos(dt)
                    self._card_at(canvas, self.enemy_cards[k], px * gp + self.ox, py * gp + self.oy)
            zp = self._zug(('zp', k), self.HAND, self.L2, 120 + k, '#c98aff', 0.5)
            dt = t - t_r0
            if 0 <= dt < zp.ende:
                zp.draw(m, dt)
                if dt < zp.dauer:
                    px, py = zp.pos(dt)
                    self._card_at(canvas, self.plan_l, px * gp + self.ox, py * gp + self.oy)
            # Glied 1: Karte des Gegners
            neg_on = t >= t_rs
            if t_el <= t < t_neg_end:
                self._card_at(canvas, self.enemy_cards[k], *self.L1)
                if not neg_on:
                    self._frame(d, self.L1[0], self.L1[1], self.LW, self.LH, [(NACHT, 4), ((255, 255, 255) if int(t * 15) % 2 else GOLD, 4)])
                else:
                    un = int((t - t_rs) * 30)
                    self._frame(d, self.L1[0], self.L1[1], self.LW, self.LH, [(NACHT, 4), (ROT if un % 2 == 0 else ROT_D, 4), (ROT_DD, 4)])
                    # rote Dither-Fläche
                    cx0, cy0 = self._ci(self.L1[0] - self.LW / 2, self.L1[1] - self.LH / 2)
                    gr.block(cx0, cy0, int(self.LW / gp), int(self.LH / gp) + 1, ROT_D, 6 / 16.0) if un >= 0 else None
                    if un >= 2:
                        self._x_sprite(d, self.L1[0], self.L1[1])
            if t >= t_neg_end:
                self._crumble(canvas, ekey, self.L1[0], self.L1[1], t - t_neg_end, True)
            # Rauch auf der negierten Karte
            if t >= t_rs:
                c = self._ci(*self.L1)
                self._smoke(gr, c[0], c[1], t - t_rs, self.LW / 80.0, ('sm1', k))
            # Glied 2: The Master's Plan
            t_plan_end = t_rs + 0.9
            if t_rl <= t < t_plan_end:
                self._card_at(canvas, self.plan_l, *self.L2)
                if t < t_rs:
                    self._frame(d, self.L2[0], self.L2[1], self.LW, self.LH, [(NACHT, 4), ((255, 255, 255) if int(t * 15) % 2 else GOLD, 4), ((90, 60, 20), 4)])
                else:
                    self._frame(d, self.L2[0], self.L2[1], self.LW, self.LH, [(NACHT, 4), ((255, 255, 255) if int(t * 15) % 2 else GOLD, 4), ((90, 60, 20), 4)])
                    if t - t_rs < 2 / 30.0:
                        cx0, cy0 = self._ci(self.L2[0] - self.LW / 2, self.L2[1] - self.LH / 2)
                        gr.block(cx0, cy0, int(self.LW / gp), int(self.LH / gp) + 1, (255, 255, 255), 0.75)
            if t >= t_plan_end:
                self._crumble(canvas, 'plan', self.L2[0], self.L2[1], t - t_plan_end, False)
            # Beschriftung
            if t_el <= t < t_rs:
                self.draw_text(canvas, 'OPPONENT PLAYS', 2, (self.L1[0], self.L1[1] - 150), color=(255, 140, 140), outline=None, shadow=(20, 10, 30))
            if t_rs <= t < t_rs + 1.2:
                tau = t - t_rs
                if int(t * 12) % 2 == 0:
                    self.draw_text(canvas, 'NEGATED', 4, (self.L1[0], self.L1[1] - 150), color=VIOLET, outline=(20, 10, 40), shadow=None)

    def _zug(self, key, A, B, salt, farbe, dur):
        if key not in self._cache:
            self._cache[key] = gamefx.Zug(self._cp(*A), self._cp(*B), dauer=dur, cw=self.LW / float(self.gp), bogen=-140 / self.gp, salt=salt, farbe=gamefx.hexc(farbe))
        return self._cache[key]

    # ───────── Hand, Resource Phase ─────────
    def _draw_hand(self, canvas, d, t):
        gp = self.gp
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        gr = gamefx.R1(m)
        # Deck rechts
        small = self._small()
        for k in range(4):
            canvas.paste(small, (int(self.DECK[0] - small.width / 2 + 4 * k), int(self.DECK[1] - small.height / 2 - 4 * k)), small)
        if not any(T <= t < T + 1.8 for T in self.T0):
            self.draw_text(canvas, 'DECK', 2, (self.DECK[0], self.DECK[1] - 112), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        for k, T in enumerate(self.T0):
            t_sp = T + self.SP
            t_go = T + self.RP                                                        # fliegt in die Kette
            # Resource Phase: Ziehen entfällt
            if T <= t < T + 1.8:
                if int(t * 6) % 2 == 0 or t >= T + 0.5:
                    self.draw_text(canvas, 'RESOURCE PHASE', 3, (540, 1572), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
                if t >= T + 0.1:
                    self.pix_rect(d, self.DECK[0] - 64, self.DECK[1] - 6, self.DECK[0] + 64, self.DECK[1] + 6, ROT)                # durchgestrichen
                    self.draw_text(canvas, 'NO DRAW', 2, (self.DECK[0], self.DECK[1] - 112), color=ROT, outline=None, shadow=(20, 10, 30))
            # Plan erscheint von außerhalb des Spiels
            if t_sp <= t < t_go + 0.01:
                tau = t - t_sp
                c = self._ci(*self.HAND)
                self._smoke(gr, c[0], c[1], tau, self.CW / 80.0, ('spawn', k))
                u = min(1.0, tau / 0.7)
                im = self._dissolve(self.plan_big, 1.0 - u, ('plan_big',)) if u < 1.0 else self.plan_big
                self._card_at(canvas, im, *self.HAND)
                # Ringe (Portal)
                if tau < 0.8:
                    for i, col in enumerate([VIOLET, (255, 255, 255)]):
                        r = gamefx.rd(gamefx.ease(max(0.0, tau - 0.1 * i) / 0.7) * 10)
                        if r > 0:
                            gr.ring(c[0], c[1] + 2, max(0, r - 1), r, col, 1.0)
                if tau < 2.0:
                    if int(t * 6) % 2 == 0:
                        self.draw_text(canvas, 'FROM OUTSIDE THE GAME', 2, (260, 1614), color=VIOLET, outline=None, shadow=(20, 10, 40))
                    elif tau >= 0.5:
                        self.draw_text(canvas, 'THE MASTER\'S PLAN', 3, (260, 1614), color=GOLD_HL, outline=None, shadow=(60, 30, 0))
                else:
                    self.draw_text(canvas, 'IN HAND', 2, (150, 1614), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))

    def _small(self):
        if self.back is None:
            cb = Image.open(self.g['cardback_path']).convert('RGB')
            U = self.U
            w, h = 120, 168
            wu, hu = w // U, h // U
            inner = cb.resize((wu - 2, hu - 3), Image.BOX).convert('RGBA')
            c = Image.new('RGBA', (wu, hu), (150, 60, 190, 255))
            c.paste(inner, (1, 1))
            self.back = c.resize((wu * U, hu * U), Image.NEAREST)
        return self.back

    # ───────── Gegner ─────────
    def _draw_enemy(self, canvas, d, t):
        gp = self.gp
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        gr = gamefx.R1(m)
        dx = 0
        for tt in self.T_TICK:
            if 0 <= t - tt < 0.4:
                dx = 8 if int(t * 30) % 2 else -8
        self._card_at(canvas, self.peter, self.EN[0] + dx, self.EN[1])
        self.draw_text(canvas, 'OPPONENT', 2, (self.EN[0], self.EN[1] - 118), color=(255, 140, 140), outline=None, shadow=(20, 10, 30))
        hp = self.hp(t)
        hit = any(0 <= t - tt - 0.5 < 0.5 and int(t * 15) % 2 == 0 for tt in self.T_TICK)
        self.draw_text(canvas, '%d HP' % hp, 3, (self.EN[0], self.EN[1] + 122), color=(255, 255, 255) if hit else GOLD, outline=None, shadow=(60, 30, 0))
        st = self.stacks(t)
        if st:
            hot = any(0 <= t - T - self.PZ - 0.5 < 0.5 and int(t * 15) % 2 == 0 for T in self.T0)
            col = (255, 255, 255) if hot else VIOLET
            for ry, row in enumerate(SCHAEDEL):
                for rx, ch in enumerate(row):
                    if ch != '.':
                        x0 = self.EN[0] - 104 + rx * 6
                        y0 = self.EN[1] + 140 + ry * 6
                        self.pix_rect(d, x0, y0, x0 + 5, y0 + 5, (255, 255, 255) if ch == 'W' else (80, 0, 140))
            self.draw_text(canvas, 'POISON %d' % st, 3, (self.EN[0] + 6, self.EN[1] + 155), color=col, outline=None, shadow=(20, 10, 40))
        # Gift-Blasen
        c = self._ci(self.EN[0], self.EN[1])
        for k, T in enumerate(self.T0):
            self._poison(canvas, gr, c[0], c[1], t - (T + self.PZ), True, ('v', k), self.EW / 80.0)
        for i, tt in enumerate(self.T_TICK):
            self._poison(canvas, gr, c[0], c[1], t - tt, False, ('t', i), self.EW / 80.0)
        for k, T in enumerate(self.T0):                                             # +2 Stapel fliegt zum Gegner
            tau = t - (T + self.PZ)
            if 0 <= tau < 0.8:
                self.draw_text(canvas, '+2', 6, (self.EN[0] - 130, self.EN[1] + 20 - 70 * smooth(tau / 0.8)), color=VIOLET, outline=(20, 10, 40), shadow=None)
        for i, tt in enumerate(self.T_TICK):
            tau = t - (tt + 0.3)
            if 0 <= tau < 0.9:
                self.draw_text(canvas, '-%d' % (60 * (i + 1)), 6, (self.EN[0] - 120, self.EN[1] - 40 - 60 * smooth(tau / 0.9)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)

    # ───────── Zähler ─────────
    def _draw_hud(self, canvas, d, t):
        self.draw_text(canvas, 'NEGATED', 3, (150, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        n = self.n_negated(t)
        self.draw_text(canvas, str(n), 9, (125, 140), color=VIOLET, outline=None, shadow=(40, 10, 80))
        self.draw_text(canvas, 'TURN', 3, (935, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(self.turn_no(t)), 9, (950, 140), color=GOLD, outline=None, shadow=(60, 30, 0))
        if self.t_win <= t < self.t_win + 3.0 and int(t * 6) % 2 == 0:
            self.draw_text(canvas, 'LETHAL NEXT TURN', 5, (540, 1000), color=GOLD_HL, outline=(20, 10, 30), shadow=None)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_enemy(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_hand(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_chain(canvas, d, t)
        self._draw_hud(canvas, ImageDraw.Draw(canvas), t)
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
                ev.append((t, item[0], item[1]) + tuple(item[2:]))
        for k, T in enumerate(self.T0):
            add(T, 'turn'); add(T + self.SP, 'spawn')
            add(T + self.EP, 'whoosh'); add(T + self.EL, 'land'); add(T + self.EL, 'chain')
            add(T + self.RP, 'whoosh'); add(T + self.RL, 'land'); add(T + self.RL, 'chain')
            add(T + self.RS, 'ping'); add(T + self.RS, 'negate'); add(T + self.RS + self.NEGF, 'crumble')
            add(T + self.PZ, 'poison')
        for tt in self.T_TICK:
            add(tt, 'tick')
        a, b = self.t_win, self.t_win + 3.0
        for k in range(int(math.floor(a * 6)), int(math.ceil(b * 6)) + 1):
            if k % 2 == 0 and max(a, k / 6.0) < b:
                add(max(a, k / 6.0), 'alarm')
        return sorted(ev)
