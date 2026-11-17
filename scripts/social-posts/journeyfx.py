"""Tarleinn-Show: die reisende Musikliebhaberin. Wirkt sie einen Zauber, heilt sie einen Verbündeten (40 / 80 / 150 je nach Stufe des Zaubers) – einfach durch ihre Anwesenheit.
Hinter der Karte zieht eine Landschaft vorbei (Reise), um sie schweben Noten. Heilimpuls (Säule, Einschlag, Burst), Feuerball und Kettenblitz sind Nachbauten der echten Spiel-Animationen (gamefx.py).
Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

NOTE = ["..XX", "..X.", "..X.", "XX..", "XX.."]
NOTE_COL = [(255, 214, 64), (255, 130, 190), (170, 140, 255), (110, 220, 255)]
GREEN = (170, 255, 190)


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class JourneyShow(CaptionMixin):
    CW, CH = 160, 224
    AX = [270, 540, 810]
    AY = 1700
    EN_X, EN_Y = 540, 140
    OW, OH = 160, 224
    SPELL_POS = (900, 780)
    ACTS = [dict(T=1.0, lv=1, heal=40, ally=0, name='BURNING FINGER'), dict(T=6.6, lv=2, heal=80, ally=1, name='FIREBALL'), dict(T=11.6, lv=3, heal=150, ally=2, name='CHAIN LIGHTNING')]
    HP = [(120, 400), (100, 300), (200, 500)]                                          # (HP vor dem Heilen, Maximum)
    CAPTIONS = [
        (0.2, 2.6, '*Tarleinn* the Traveler is on the road...'),
        (2.8, 6.4, 'With *two Spell Schools*, every *Spell* she casts *heals* an ally - once per turn!'),
        (6.6, 11.4, 'The higher the Spell\'s *level*, the more she heals: *40*, *80*, up to *150*!'),
        (11.6, 15.6, 'A *level 3* Spell? Her friends feel *150* better!'),
        (15.8, 20.4, '*Tarleinn* just wants to *see the world* - and her *music* cheers everyone up.'),
    ]
    SND = {
        'cast':   [('spell_cast', -6)],
        'throw':  [('projectile', -8)],
        'hit':    [('damage', -8), ('elem_fire', -8)],
        'zap':    [('elem_lightning', -5), ('damage', -8)],
        'rise':   [('elem_holy', -7)],
        'heal':   [('heal', -4)],
        'ally':   [('placement', -10)],
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
        ow, oh = self.OW // U, self.OH // U
        pix = lambda im: im.convert('RGB').resize((ow, oh), Image.BOX).resize((ow * U, oh * U), Image.NEAREST).convert('RGBA')
        self.allies = [pix(ld('a%d' % (i + 1))) for i in range(3)]
        self.en = pix(ld('e-doq'))
        self.spells = [ld('s%d' % (i + 1)).resize((190, 266), Image.BOX) for i in range(3)]
        for a in self.ACTS:
            a['t_hit'] = a['T'] + 1.0
            a['t_heal'] = a['T'] + 1.0 + gamefx.HealPulse.T_HIT
        self.FLASHES = (0.0,)
        self.SHOCKS = (0.0,)
        self.TENSION_SHAKES = [(a['t_hit'], 6) for a in self.ACTS] + [(0.0, 7)]
        self.T_GUST = 0.0
        self._fx = {}
        self._build_land()

    # ───────── Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def _ci(self, x, y):
        a, b = self._cp(x, y)
        return gamefx.rd(a), gamefx.rd(b)

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

    def hp(self, i, t):
        h, mx = self.HP[i]
        a = self.ACTS[i]
        if t >= a['t_heal']:
            h += a['heal']
        return h, mx

    # ───────── Landschaft ─────────
    def _build_land(self):
        gp = self.gp
        gw = self.W // gp + 2
        gh = self.H // gp + 1
        cols = np.arange(gw)
        defs = [(1480, 150, (36, 58, 96), (60, 90, 130), 12, (2, 5)), (1580, 95, (30, 86, 86), (50, 120, 110), 28, (3, 7)), (1700, 60, (26, 66, 52), (44, 100, 70), 60, (4, 9))]
        self.layers = []
        for base_y, amp, c0, c1, speed, (k1, k2) in defs:
            h = base_y / gp + (amp / gp) * (0.6 * np.sin(2 * np.pi * k1 * cols / gw + 0.7) + 0.4 * np.sin(2 * np.pi * k2 * cols / gw + 2.1))
            im = np.zeros((gh, gw, 4), np.uint8)
            for x in range(gw):
                y0 = int(round(h[x]))
                if y0 < gh:
                    im[y0:, x] = c0 + (255,)
                    im[y0, x] = c1 + (255,)
                    if y0 + 1 < gh and x % 2 == 0:
                        im[y0 + 1, x] = c1 + (255,)
            self.layers.append((Image.fromarray(im, 'RGBA').resize((gw * gp, gh * gp), Image.NEAREST), speed))

    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        gp, W = self.gp, self.W
        for im, speed in self.layers:
            wlen = im.width - 2 * gp
            off = int(t * speed * (1.0 if t < 14.0 else 1.0 + (t - 14.0) / 3.0) / gp) * gp
            x0 = -(off % wlen)
            canvas.paste(im, (x0, 0), im)
            canvas.paste(im, (x0 + wlen, 0), im)

    # ───────── Noten ─────────
    def _draw_notes(self, canvas, t):
        gp = self.gp
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        for k in range(10):
            t0 = k * 0.37
            life = 2.4
            u = ((t - t0) % (life * 1.0)) / life if t >= t0 else None
            if u is None:
                continue
            x = 540 + (k - 4.5) * 40 + 40 * math.sin(t * 2 + k)
            y = 620 - u * 260
            if u > 0.7 and (int(t * 30) & 1):
                continue
            cx, cy = self._ci(x, y)
            col = NOTE_COL[k % 4]
            for r, row in enumerate(NOTE):
                for c, ch in enumerate(row):
                    if ch == 'X':
                        m.rect(cx + c, cy + r, 1, 1, col)

    # ───────── Gegner und Verbündete ─────────
    def _draw_cards(self, canvas, d, t):
        U = self.U
        if t >= 0.3:
            y = self.EN_Y - 220 * (1 - ease_out((t - 0.3) / 0.3))
            sh = 0
            for a in self.ACTS:
                if 0 <= t - a['t_hit'] < 0.4:
                    sh = 8 if int(t * 30) % 2 else -8
            canvas.paste(self.en, (int(round((self.EN_X - self.en.width / 2 + sh) / U) * U), int(round((y - self.en.height / 2) / U) * U)), self.en)
        for i in range(3):
            if t < 0.5 + 0.12 * i:
                continue
            y = self.AY + 200 * (1 - ease_out((t - 0.5 - 0.12 * i) / 0.3))
            canvas.paste(self.allies[i], (int(round((self.AX[i] - self.allies[i].width / 2) / U) * U), int(round((y - self.allies[i].height / 2) / U) * U)), self.allies[i])
            if t < 0.9 + 0.12 * i:
                continue
            h, mx = self.hp(i, t)
            bw = 160
            x0, y0 = self.AX[i] - bw // 2, self.AY + 125
            self.pix_rect(d, x0 - 4, y0 - 4, x0 + bw + 3, y0 + 18 + 3, (20, 10, 30))
            a = self.ACTS[i]
            frac = h / float(mx)
            if a['t_heal'] - 0.0 <= t < a['t_heal'] + 0.6:                            # beim Heilen wächst der Balken in Stufen
                u = smooth((t - a['t_heal']) / 0.5)
                frac = (h - a['heal'] + a['heal'] * u) / float(mx)
            wf = int(round(bw * frac / self.U) * self.U)
            col = (255, 90, 90) if frac < 0.35 else GREEN
            if wf > 0:
                self.pix_rect(d, x0, y0, x0 + wf - 1, y0 + 17, col)
            self.draw_text(canvas, '%d/%d' % (h, mx), 2, (self.AX[i], y0 + 44), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))

    # ───────── Zauber ─────────
    def _fxs(self):
        if self._fx:
            return self._fx
        A = self._ci(self.TC[0], self.TC[1]) if hasattr(self, 'TC') else self._ci(540, 700)
        B = self._ci(self.EN_X, self.EN_Y + 40)
        fx = {}
        fx['f1'] = gamefx.Feuerball(A, B, tA=0.5, k=0.22, gr=0.45, salt=21)
        fx['f2'] = gamefx.Feuerball(A, B, tA=0.5, k=0.28, gr=0.8, salt=33)
        fx['c3'] = gamefx.Kettenblitz(A, B, step=2, k=0.7, salt=45, entlade=True)
        top = self._ci(540, -40)[1]
        hl = []
        for i, a in enumerate(self.ACTS):
            tx, ty = self._ci(self.AX[i], self.AY + 112)
            zx0, zy0 = self._ci(self.AX[i] - self.CW / 2, self.AY - self.CH / 2)
            zx1, zy1 = self._ci(self.AX[i] + self.CW / 2, self.AY + self.CH / 2)
            sx, sy = self._ci(540, 1000)
            hl.append(gamefx.HealPulse((sx, sy), (tx, ty), (zx0, zy0, zx1, zy1), rc=0.9, hw=max(2, int(3 * self.K)), salt=7 + i, top=top))
        fx['heal'] = hl
        self._fx = fx
        return fx

    def _draw_spells(self, canvas, d, t):
        fx = self._fxs()
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        U = self.U
        for i, a in enumerate(self.ACTS):
            tau = t - a['T']
            if 0 <= tau < 1.8:                                                          # Zauberkarte erscheint, Name und Stufe
                u = ease_out(tau / 0.3)
                x = self.SPELL_POS[0]
                y = self.SPELL_POS[1] + 120 * (1 - u)
                if tau < 1.5 or int(t * 30) % 2 == 0:
                    canvas.paste(self.spells[i], (int(round((x - 95) / U) * U), int(round((y - 133) / U) * U)), self.spells[i])
                self.draw_text(canvas, 'LEVEL %d' % a['lv'], 3, (x, y - 160), color=GOLD_HL, outline=None, shadow=(20, 10, 30))
            if i == 0:
                fx['f1'].draw(m, t - (a['T'] + 0.5)) if t >= a['T'] + 0.5 else None
            elif i == 1:
                fx['f2'].draw(m, t - (a['T'] + 0.5)) if t >= a['T'] + 0.5 else None
            else:
                if t >= a['T'] + 0.7:
                    fx['c3'].draw(m, t - (a['T'] + 0.7))
            fx['heal'][i].draw(m, t - a['t_hit'])
            tau = t - a['t_heal']
            if 0 <= tau < 1.3:
                self.draw_text(canvas, '+%d' % a['heal'], 7, (self.AX[a['ally']], self.AY - 150 - 70 * smooth(tau / 1.2)), color=GREEN, outline=(10, 60, 20), shadow=None)

    # ───────── Zähler ─────────
    def _draw_hud(self, canvas, d, t):
        n = sum(1 for a in self.ACTS if t >= a['T'])
        tot = sum(a['heal'] for a in self.ACTS if t >= a['t_heal'])
        self.draw_text(canvas, 'SPELL LV', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        lv = max([a['lv'] for a in self.ACTS if t >= a['T']] or [0])
        self.draw_text(canvas, str(lv), 9, (125, 140), color=GOLD, outline=None, shadow=(60, 30, 0))
        self.draw_text(canvas, 'HEALED', 3, (955, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(tot), 9, (950, 140), color=GREEN, outline=None, shadow=(10, 60, 20))

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_notes(canvas, t)
        self._draw_cards(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_spells(canvas, d, t)
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
        for i in range(3):
            add(0.5 + 0.12 * i, 'ally')
        for i, a in enumerate(self.ACTS):
            T = a['T']
            add(T, 'cast')
            if i < 2:
                add(T + 0.5, 'throw'); add(T + 1.0, 'hit')
            else:
                add(T + 1.0, 'zap')
            add(a['t_hit'], 'rise')
            add(a['t_heal'], 'heal')
        ev.append((D - 1.0, 'ascension', -9, 1.2))
        return sorted(ev)
