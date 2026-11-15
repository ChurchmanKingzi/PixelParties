"""Nero Zira-Show: der gefühlskalte Mastermind. Jede Creature, die er in eine Support Zone legt, ist eine Schachfigur und beschleunigt seinen Boot-Vorgang: +30 Angriff, dauerhaft (bis zu 5-mal je Zug).
Der Kartenzug (Schweif, Abheb-Funken, Schockringe) und der Kettenblitz sind Nachbauten der echten Spiel-Animationen (gamefx.py). Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

CYAN = (150, 230, 255)
PINK = (255, 130, 160)


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class BootShow(CaptionMixin):
    CW, CH = 170, 238
    SLOT_X = [230, 540, 850]
    SLOT_Y = 1752
    START = (1150, 1500)                                                               # Figuren kommen von rechts unten ins Feld
    EN_X, EN_Y = 540, 140
    OW, OH = 176, 246
    ATK0, PER = 70, 30
    # Zug k: (Zeit, Slot, opfert die Figur im Slot?)
    PLACE = [(1.0, 0, False), (2.4, 1, False), (3.8, 2, False), (6.8, 0, True), (8.4, 1, True)]
    T_ATTACK = 11.0
    CAPTIONS = [
        (1.0, 6.0, 'Every *Creature* he places is a chess piece - and speeds up his *booting process*.'),
        (6.2, 10.6, '*+30 Attack* each, permanently - up to *5 times* per turn, even if he has to *sacrifice* a piece.'),
        (10.8, 14.4, 'Boot complete. Attack *220*. Checkmate.'),
        (14.6, 20.6, '*Nero Zira*, the Mastermind - no feelings, only *correct decisions*.'),
    ]
    SND = {
        'whoosh': [('booster_card_whoosh', -8)],
        'place':  [('placement', -7)],
        'buff':   [('buff', -8)],
        'sac':    [('creature_destroyed', -6)],
        'online': [('ability_activate', -6), ('heavy_impact', -6)],
        'zap':    [('elem_lightning', -4), ('damage', -7)],
        'ko':     [('creature_destroyed', -5)],
        'enemy':  [('placement', -10)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self.eyes_fn = geom['eyes_fn']
        self._cache = {}
        self.K = 14.0 / self.gp                                                        # Zellenzahlen der Effekte auf die Rasterzelle von Nero umrechnen
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        self.cards = [ld('c%d' % (i + 1)).resize((self.CW, self.CH), Image.BOX) for i in range(5)]
        ow, oh = self.OW // U, self.OH // U
        self.en = ld('e-quetz').convert('RGB').resize((ow, oh), Image.BOX).resize((ow * U, oh * U), Image.NEAREST).convert('RGBA')
        self.t_land = [t + 0.5 for t, s, sac in self.PLACE]
        self.t_arr = [t + 1.0 for t, s, sac in self.PLACE]                              # +30 kommt im Zähler an, Boot-Stufe steigt
        self.t_online = self.t_arr[-1] + 0.5
        self.t_imp = self.T_ATTACK + 0.5
        self.t_ko = self.t_imp + 0.12
        self.FLASHES = (0.0, self.t_imp)
        self.SHOCKS = (0.0, self.t_online)
        self.TENSION_SHAKES = [(t, 6) for t in self.t_arr] + [(self.t_imp, 8)]
        self.T_GUST = 0.0
        self._fx = {}
        self.hand = (self.ox + 86 * self.gp, self.oy + 44 * self.gp)                    # Hand des rechten Arms
        self.chest = (self.ox + 48.5 * self.gp, self.oy + 42.5 * self.gp)               # Kern in der Brust
        self._build_tiles()

    # ───────── Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def _ci(self, x, y):
        a, b = self._cp(x, y)
        return gamefx.rd(a), gamefx.rd(b)

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

    def stage(self, t):
        return sum(1 for ta in self.t_arr if t >= ta)

    def atk(self, t):
        return self.ATK0 + self.PER * self.stage(t)

    def atk_changed(self, t):
        return any(0 <= t - ta < 0.45 for ta in self.t_arr)

    # ───────── Schachbrett ─────────
    def _draw_board(self, canvas, d, t):
        """Schachbrett unter den Support Zones: dunkle und helle Felder, mit den Slots als Figurenfelder."""
        sq = 106
        y0 = 1560
        x0 = (self.W - 10 * sq) // 2
        for r in range(4):
            for c in range(10):
                col = (46, 46, 60) if (r + c) % 2 == 0 else (84, 86, 104)
                self.pix_rect(d, x0 + c * sq, y0 + r * sq, x0 + (c + 1) * sq - 1, y0 + (r + 1) * sq - 1, col)

    # ───────── Figuren (Creature-Karten) ─────────
    def _build_tiles(self):
        rng = np.random.default_rng(7)
        gp = self.gp
        self.tiles = []
        for im in self.cards:
            ts = []
            w, h = im.size
            step = 14
            for ty in range(0, h, step):
                for tx in range(0, w, step):
                    cx, cy = tx + step / 2 - w / 2, ty + step / 2 - h / 2
                    n = math.hypot(cx, cy) or 1.0
                    sp = rng.uniform(160, 520)
                    ts.append(dict(img=im.crop((tx, ty, tx + step, ty + step)), x=tx - w / 2, y=ty - h / 2, vx=cx / n * sp + rng.uniform(-60, 60), vy=cy / n * sp * 0.8 - rng.uniform(100, 360),
                                   life=rng.uniform(0.7, 1.1)))
            self.tiles.append(ts)

    def _zug(self, k):
        key = ('zug', k)
        if key not in self._cache:
            t0, slot, sac = self.PLACE[k]
            A = self._cp(*self.START)
            B = self._cp(self.SLOT_X[slot], self.SLOT_Y)
            self._cache[key] = gamefx.Zug(A, B, dauer=0.5, cw=self.CW / float(self.gp), bogen=0, salt=50 + k, farbe=gamefx.hexc('#fbe181'))
        return self._cache[key]

    def _draw_pieces(self, canvas, d, t):
        gp, U = self.gp, self.U
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        for k, (t0, slot, sac) in enumerate(self.PLACE):
            if t < t0:
                continue
            z = self._zug(k)
            dt = t - t0
            # Verdrängt: der nächste Zug auf denselben Slot opfert diese Figur
            gone = None
            for k2 in range(k + 1, 5):
                if self.PLACE[k2][1] == slot:
                    gone = self.PLACE[k2][0] - 0.1
                    break
            if gone is not None and t >= gone:
                tau = t - gone
                for p in self.tiles[k]:
                    if tau >= p['life']:
                        continue
                    if tau > p['life'] * 0.7 and (int(t * 30) & 1):
                        continue
                    x = self.SLOT_X[slot] + p['x'] + p['vx'] * tau
                    y = self.SLOT_Y + p['y'] + p['vy'] * tau + 0.5 * 1100 * tau * tau
                    canvas.paste(p['img'], (int(round(x / U) * U), int(round(y / U) * U)), p['img'])
                continue
            z.draw(m, dt)
            if dt < z.dauer:
                px, py = z.pos(dt)
                x, y = px * gp + self.ox, py * gp + self.oy
            else:
                x, y = self.SLOT_X[slot], self.SLOT_Y
            canvas.paste(self.cards[k], (int(round((x - self.CW / 2) / U) * U), int(round((y - self.CH / 2) / U) * U)), self.cards[k])

    # ───────── Booten: Augen, Kern, Zähler ─────────
    def _draw_glow(self, canvas, d, t):
        s = self.stage(t)
        if s == 0:
            return
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        f = int(t * self.fps) // self.g['per']
        eyes = self.eyes_fn(f)
        col = [None, PINK, PINK, (255, 80, 90), (255, 60, 60), (255, 255, 255)][s]
        sz = 2 if s < 3 else 3
        for (ex, ey) in eyes:
            m.rect(gamefx.rd(ex) - sz // 2, gamefx.rd(ey) - sz // 2, sz, sz, col)
            if s >= 3 and int(t * 6) % 2 == 0:
                m.rect(gamefx.rd(ex) - sz, gamefx.rd(ey), 2 * sz + 1, 1, col)
        cx, cy = self._ci(*self.chest)                                                  # Kern pulsiert
        pulse = 1 + (int(t * 5) % 2)
        m.rect(cx - pulse, cy - pulse, 2 * pulse + 1, 2 * pulse + 1, col)
        for ta in self.t_arr:                                                           # Ringe beim Hochfahren
            tau = t - ta
            if 0 <= tau < 0.5:
                m.ring(cx, cy, gamefx.rd(gamefx.ease(tau / 0.4) * 9 * self.K), 2 if tau < 0.1 else 1, gamefx.C30['creme'], False)
                if tau > 0.05:
                    m.ring(cx, cy, gamefx.rd(gamefx.ease((tau - 0.05) / 0.45) * 13 * self.K), 1, col, True)

    def _draw_tokens(self, canvas, d, t):
        for k, (t0, slot, sac) in enumerate(self.PLACE):
            t_a = self.t_arr[k]
            t_s = t_a - 0.45
            if not (t_s <= t < t_a):
                continue
            x0, y0 = self.SLOT_X[slot], self.SLOT_Y - 150
            x1, y1 = 125, 140
            u = ease_out((t - t_s) / 0.45)
            x = x0 + (x1 - x0) * u
            y = y0 + (y1 - y0) * u - 380 * math.sin(math.pi * u)
            self.draw_text(canvas, '+30', 6, (int(round(x / self.U) * self.U), int(round(y / self.U) * self.U)), color=GOLD_HL, outline=(20, 10, 30), shadow=None)

    def _draw_hud(self, canvas, d, t):
        a = self.atk(t)
        col = (255, 255, 255) if (self.atk_changed(t) and int(t * 15) % 2 == 0) else GOLD
        self.draw_text(canvas, 'ATTACK', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(a), 9, (125, 140), color=col, outline=None, shadow=(60, 30, 0))
        s = self.stage(t)
        self.draw_text(canvas, 'BOOT', 3, (955, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        x0, y0, w, h = 790, 108, 250, 38
        self.pix_rect(d, x0 - 6, y0 - 6, x0 + w + 5, y0 + h + 5, (20, 10, 30))
        for i in range(5):
            sx0 = x0 + i * (w // 5)
            fill = (255, 255, 255) if (i == s - 1 and self.atk_changed(t) and int(t * 15) % 2 == 0) else CYAN if s < 5 else (255, 120, 140)
            if i < s:
                self.pix_rect(d, sx0 + 2, y0, sx0 + w // 5 - 4, y0 + h - 1, fill)
            else:
                self.pix_rect(d, sx0 + 2, y0 + h - 6, sx0 + w // 5 - 4, y0 + h - 1, (60, 80, 90))
        if t >= self.PLACE[0][0]:
            if s >= 5 and int(t * 5) % 2 == 0:
                self.draw_text(canvas, 'ONLINE', 4, (955, 190), color=(255, 120, 140), outline=None, shadow=(60, 10, 20))
            elif s < 5:
                self.draw_text(canvas, '%d%%' % (20 * s), 3, (955, 190), color=CYAN, outline=None, shadow=(10, 40, 60))
        # Gegner
        if self.T_ATTACK - 0.5 <= t < self.t_ko:
            self.draw_text(canvas, '200 HP', 2, (self.EN_X, self.EN_Y + 138), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        tau = t - self.t_imp
        if 0 <= tau < 1.0:
            self.draw_text(canvas, '220', 9, (self.EN_X + 260, 200 - 80 * smooth(tau / 1.0)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)
        if self.t_ko + 0.2 <= t < self.t_ko + 2.0 and int(t * 6) % 2 == 0:
            self.draw_text(canvas, 'CHECKMATE', 6, (540, 1000), color=GOLD_HL, outline=(20, 10, 30), shadow=None)

    # ───────── Angriff ─────────
    def _draw_attack(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        if 'kb' not in self._fx:
            A = self._ci(*self.hand)
            B = self._ci(self.EN_X, self.EN_Y)
            self._fx['kb'] = gamefx.Kettenblitz(A, B, step=2, k=0.8, salt=77, entlade=True)
        tb = self.t_imp - gamefx.LT
        if t >= tb:
            self._fx['kb'].draw(m, t - tb)

    def _draw_enemy(self, canvas, d, t):
        t_in = self.T_ATTACK - 0.5
        if t < t_in:
            return
        U = self.U
        if t < self.t_ko:
            y = self.EN_Y - 220 * (1 - ease_out((t - t_in) / 0.3))
            sh = (8 if int(t * 30) % 2 else -8) if t >= self.t_imp else 0
            canvas.paste(self.en, (int(round((self.EN_X - self.en.width / 2 + sh) / U) * U), int(round((y - self.en.height / 2) / U) * U)), self.en)
            return
        if not hasattr(self, '_etiles'):
            rng = np.random.default_rng(3)
            w, h = self.en.size
            self._etiles = []
            for ty in range(0, h, 14):
                for tx in range(0, w, 14):
                    cx, cy = tx + 7 - w / 2, ty + 7 - h / 2
                    n = math.hypot(cx, cy) or 1.0
                    sp = rng.uniform(160, 520)
                    self._etiles.append(dict(img=self.en.crop((tx, ty, tx + 14, ty + 14)), x=tx - w / 2, y=ty - h / 2, vx=cx / n * sp, vy=cy / n * sp * 0.8 - rng.uniform(100, 360), life=rng.uniform(0.7, 1.1)))
        tau = t - self.t_ko
        for p in self._etiles:
            if tau >= p['life']:
                continue
            if tau > p['life'] * 0.7 and (int(t * 30) & 1):
                continue
            x = self.EN_X + p['x'] + p['vx'] * tau
            y = self.EN_Y + p['y'] + p['vy'] * tau + 0.5 * 1100 * tau * tau
            canvas.paste(p['img'], (int(round(x / U) * U), int(round(y / U) * U)), p['img'])

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_enemy(canvas, d, t)
        self._draw_pieces(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_glow(canvas, d, t)
        self._draw_attack(canvas, d, t)
        self._draw_tokens(canvas, d, t)
        self._draw_hud(canvas, d, t)
        self._draw_caption(canvas, ImageDraw.Draw(canvas), t)

    # ───────── Interface ─────────
    def draw_behind(self, canvas, f):
        self._draw_board(canvas, ImageDraw.Draw(canvas), f / float(self.fps))

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
                fl = max(fl, (0.4 if tg == 0.0 else 0.2) * math.exp(-(t - tg) / 0.08))
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

        def add(t, kind, rate=None):
            for item in self.SND[kind]:
                e = (t + (item[2] if len(item) > 2 else 0.0), item[0], item[1])
                if rate and item[0] in ('buff',):
                    e = e + (rate,)
                else:
                    e = e + tuple(item[3:])
                ev.append(e)
        for k, (t0, slot, sac) in enumerate(self.PLACE):
            add(t0, 'whoosh'); add(self.t_land[k], 'place'); add(self.t_arr[k], 'buff', 1.0 + 0.1 * k)
            if sac:
                add(t0 - 0.1, 'sac')
        add(self.t_online, 'online')
        add(self.T_ATTACK - 0.5, 'enemy')
        add(self.t_imp, 'zap'); add(self.t_ko, 'ko')
        ev.append((D - 1.0, 'ascension', -9, 1.2))
        return sorted(ev)
