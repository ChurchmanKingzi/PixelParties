"""Null-Show: der Magierschlächter. Seine lila Void-Klinge negiert die Effekte jedes Ziels, das er trifft (2 Runden); die Magier können nichts mehr wirken.
Als Startfähigkeit Interference halbiert er Schaden von Flächenzaubern (aufgerundet) – seine Verbündeten haben dieses Glück nicht (Flame Avalanche).
Der Wurf der Klinge, der Schnitt, die Flame Avalanche und die Aufladung der Zauber sind Nachbauten der echten Spiel-Animationen (gamefx.py). Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageOps

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

VOID = dict(creme=gamefx.hexc('#f0d8ff'), tinte=gamefx.hexc('#12101f'), hblau=gamefx.hexc('#c58cf0'), blau=gamefx.hexc('#9544d5'), gelb=gamefx.hexc('#c58cf0'), orange=gamefx.hexc('#9544d5'),
            rot=gamefx.hexc('#3b1a5a'))
V = [gamefx.hexc(h) for h in ('#3b1a5a', '#9544d5', '#c58cf0', '#f0d8ff')]
PURPLE_T = (200, 150, 255)


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class VoidShow(CaptionMixin):
    T_ACT = [3.2, 7.1, 11.0, 14.9]
    CW, CH = 180, 252
    OW, OH = 160, 224
    EX = [270, 540, 810]
    EN_Y = 128
    TIP = (80, 650)                                                                    # Spitze der Void-Klinge
    TC = (540, 700)                                                                    # Mitte von Null
    CR_X, CR_Y = [260, 820], 1752                                                      # Nulls Support-Kreaturen
    HP0 = 450
    CAPTIONS = [
        (1.0, 3.1, 'Meet *Null*, the *Mage Slayer*. His *void blade* negates whatever it hits!'),
        (3.2, 6.9, 'Hit by the blade, and *all effects* are negated for *2 turns*.'),
        (7.0, 10.9, 'No effects, no *spells*. Try again, mage!'),
        (11.0, 14.8, 'An *area spell*? His *Interference* halves it. His allies? Not so lucky.'),
        (14.9, 18.3, 'One more cut, and the whole team of *mages* is *silenced*.'),
        (18.5, 20.8, 'Null: *zero* spells, *zero* problems!'),
    ]
    SND = {
        'open':   [('elem_dark', -5), ('heavy_impact', -4)],
        'enemy':  [('placement', -10)],
        'place':  [('placement', -8)],
        'throw':  [('projectile', -8)],
        'slash':  [('slash', -4), ('damage', -8)],
        'negate': [('negate', -5), ('debuff', -8)],
        'fizzle': [('status_remove', -7)],
        'aoe':    [('elem_fire', -4), ('heavy_impact', -3), ('damage', -6)],
        'die':    [('creature_destroyed', -5)],
        'half':   [('negate', -9)],
        'ping':   [('ping', -9)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self._cache = {}
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        ow, oh = self.OW // U, self.OH // U
        pix = lambda im: im.convert('RGB').resize((ow, oh), Image.BOX).resize((ow * U, oh * U), Image.NEAREST).convert('RGBA')
        self.en = [pix(ld(n)) for n in ('e-ida', 'e-solrym', 'e-archibald')]
        self.en_gray = []
        for im in self.en:
            gimg = ImageOps.grayscale(im.convert('RGB'))
            gimg = ImageOps.autocontrast(gimg)
            col = ImageOps.colorize(gimg, (20, 10, 35), (200, 190, 215))
            self.en_gray.append(col.convert('RGBA'))
        sm = lambda im: im.resize((self.CW, self.CH), Image.BOX)
        self.cr = [sm(ld('c-wolflesia')), sm(ld('c-skeletonpriest'))]
        self.t_in = [T - 0.5 for T in self.T_ACT[:3]]
        self.t_throw = [T + 0.5 for T in self.T_ACT[:2]] + [None, self.T_ACT[3] + 0.5]
        self.FL = 0.5                                                                  # Flugzeit der Klinge
        self.imp = {0: self.T_ACT[0] + 1.0, 1: self.T_ACT[1] + 1.0, 3: self.T_ACT[3] + 1.0}  # Treffer der Klinge (Akt → Zeit)
        self.neg_t = [self.imp[0], self.imp[1], self.imp[3]]                          # Ida, Sol Rym, Archibald negiert
        self.t_aoe = self.T_ACT[2] + 0.5
        self.t_aoe_hit = self.t_aoe + 0.75
        self.t_cr_in = [2.0, 2.3]
        self.FLASHES = (0.0, self.imp[0], self.imp[1], self.t_aoe_hit, self.imp[3])
        self.SHOCKS = (0.0, self.t_aoe_hit, self.T_ACT[3] + 1.9)
        self.TENSION_SHAKES = [(t, 6) for t in self.FLASHES]
        self.T_GUST = 0.0
        self._fx = {}
        self._build_tiles()

    # ───────── Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def _ci(self, x, y):
        a, b = self._cp(x, y)
        return gamefx.rd(a), gamefx.rd(b)

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

    def hp(self, t):
        return self.HP0 - (75 if t >= self.t_aoe_hit else 0)

    def n_negated(self, t):
        return sum(1 for x in self.neg_t if t >= x)

    # ───────── Gegner ─────────
    def _build_tiles(self):
        rng = np.random.default_rng(5)
        gp = self.gp
        self.tiles = []
        for im in self.cr:
            ts = []
            w, h = im.size
            for ty in range(0, h, gp):
                for tx in range(0, w, gp):
                    cx, cy = tx + gp / 2 - w / 2, ty + gp / 2 - h / 2
                    n = math.hypot(cx, cy) or 1.0
                    sp = rng.uniform(160, 520)
                    ts.append(dict(img=im.crop((tx, ty, tx + gp, ty + gp)), x=tx - w / 2, y=ty - h / 2, vx=cx / n * sp + rng.uniform(-60, 60), vy=cy / n * sp * 0.8 - rng.uniform(100, 360),
                                   life=rng.uniform(0.7, 1.1)))
            self.tiles.append(ts)

    def _draw_enemies(self, canvas, d, t):
        U = self.U
        for i in range(3):
            if t < self.t_in[i]:
                continue
            y = self.EN_Y - 220 * (1 - ease_out((t - self.t_in[i]) / 0.3))
            neg = t >= self.neg_t[i]
            im = self.en_gray[i] if neg else self.en[i]
            sh = 0
            if 0 <= t - self.neg_t[i] < 0.4:
                sh = 8 if int(t * 30) % 2 else -8
            canvas.paste(im, (int(round((self.EX[i] - im.width / 2 + sh) / U) * U), int(round((y - im.height / 2) / U) * U)), im)

    def _draw_status(self, canvas, d, t):
        """Negiert (2 Runden): lila Dither-Blase, kreisende Pixel, Beschriftung."""
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        for i in range(3):
            if t < self.neg_t[i]:
                continue
            cx, cy = self._ci(self.EX[i], self.EN_Y)
            tau = t - self.neg_t[i]
            if tau < 0.6:
                g.ring(cx, cy, max(0, gamefx.rd(gamefx.ease(tau / 0.4) * 11) - 2), gamefx.rd(gamefx.ease(tau / 0.4) * 11), V[3], 1.0)
            g.disc(cx, cy, 9, V[1], 0.22)
            g.ring(cx, cy, 8, 9, V[2], 0.5)
            for k in range(6):
                an = t * 3 + k * math.pi / 3
                g.block(gamefx.rd(cx + math.cos(an) * 9), gamefx.rd(cy + math.sin(an) * 9 * 0.9), 1, 1, V[3] if k % 2 else V[2])
            if tau >= 0.4:
                self.draw_text(canvas, 'NEGATED', 2, (self.EX[i], self.EN_Y + 132), color=PURPLE_T, outline=None, shadow=(20, 10, 40))
                self.draw_text(canvas, '2 TURNS', 2, (self.EX[i], self.EN_Y + 156), color=(255, 255, 255), outline=None, shadow=(20, 10, 40))

    # ───────── Angriffe ─────────
    def _fxs(self):
        if self._fx:
            return self._fx
        A = self._ci(*self.TIP)
        fx = {}
        for i, key in ((0, 0), (1, 1), (3, 2)):
            B = self._ci(self.EX[key], self.EN_Y)
            fx[('blade', i)] = gamefx.Geschoss('schwert', A, B, self.FL / 0.85, t0=0.0, R=9, salt=11 + i, pal=[V[3], V[2], V[1], V[0]], ramp=[V[3], V[2], V[1], V[0]])
            fx[('cut', i)] = gamefx.Schnitt(B[0], B[1], 15, krit=True, salt=21 + i, pal=VOID, direction=(-0.6, 0.8))
        fx['ida'] = gamefx.Feuerball(self._ci(self.EX[0], self.EN_Y), self._ci(self.EX[0], self.EN_Y + 5), tA=0.9, k=0.45, salt=5)
        fx['sol'] = gamefx.Kettenblitz(self._ci(self.EX[1], self.EN_Y), self._ci(self.EX[1], self.EN_Y + 5), step=2, k=0.5, salt=9, entlade=False)
        targets = [self._ci(*self.TC), self._ci(self.CR_X[0], self.CR_Y), self._ci(self.CR_X[1], self.CR_Y)]
        fx['aoe'] = gamefx.FlameAvalanche(self._ci(self.EX[2], self.EN_Y + 90), targets, salt=7)
        self._fx = fx
        return fx

    def _draw_attacks(self, canvas, d, t):
        fx = self._fxs()
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        for i in (0, 1, 3):
            t0 = self.imp[i] - self.FL
            if t >= t0 - 0.2:
                fx[('blade', i)].draw(m, t - t0)
            fx[('cut', i)].draw(m, t - self.imp[i])
            if t0 - 0.25 <= t < t0:                                                    # Klinge lädt auf: lila Funken an der Spitze
                self._tip_sparks(m, t - (t0 - 0.25))
        # Zauberversuche scheitern: Aufladen, dann Fizzle
        for i, key in ((0, 'ida'), (1, 'sol')):
            T = self.T_ACT[i] + 1.9
            dt = t - T
            if 0 <= dt < 0.45:
                if key == 'ida':
                    fx[key]._laden(m, dt * 0.66)
                else:
                    fx[key].laden(m, dt, 0.45)
            f_dt = t - (T + 0.45)
            if 0 <= f_dt < 1.0:
                cx, cy = self._ci(self.EX[i], self.EN_Y)
                g = gamefx.R1(m)
                for k in range(10):                                                    # Funken fallen ausgebrannt herunter
                    x = cx + (gamefx.H(40 + i, k) - 0.5) * 8
                    y = cy + 2 + f_dt * (10 + gamefx.H(41 + i, k) * 20) * 1.0 + 0.5 * 60 * f_dt * f_dt
                    if f_dt > 0.6 and ((k + int(t * 30)) & 1):
                        continue
                    g.block(gamefx.rd(x), gamefx.rd(y), 1, 1, V[1 + k % 3] if k % 2 else (150, 150, 165))
                if f_dt < 0.8:
                    g.line(cx - 3, cy - 3, cx + 3, cy + 3, V[3], 1, 2)
                    g.line(cx - 3, cy + 3, cx + 3, cy - 3, V[3], 1, 2)
        if self.t_aoe <= t < self.t_aoe + 3.0:
            fx['aoe'].draw(m, t - self.t_aoe)

    def _tip_sparks(self, m, dt):
        cx, cy = self._ci(*self.TIP)
        for q in range(12):
            ph = ((dt / 0.2) + gamefx.H(q, 3)) % 1.0
            an = gamefx.H(q, 5) * math.pi * 2
            r = (4 + gamefx.H(q, 7) * 7) * (1 - ph)
            m.rect(gamefx.rd(cx + math.cos(an) * r), gamefx.rd(cy + math.sin(an) * r), 1, 1, V[1 + q % 3])

    # ───────── Support-Kreaturen und Interference ─────────
    def _draw_creatures(self, canvas, d, t):
        gp, U = self.gp, self.U
        for k in range(2):
            t0 = self.t_cr_in[k]
            if t < t0:
                continue
            tk = self.t_aoe_hit + 0.15 * k
            if t < tk:
                u = ease_out((t - t0) / 0.4)
                y0 = int(round((self.CR_Y - self.CH / 2 + 330 * (1 - u)) / U) * U)
                if t - t0 >= 0.05:
                    canvas.paste(self.cr[k], (int(self.CR_X[k] - self.CW / 2), y0), self.cr[k])
            else:
                tau = t - tk
                for p in self.tiles[k]:
                    if tau >= p['life']:
                        continue
                    if tau > p['life'] * 0.7 and (int(t * 30) & 1):
                        continue
                    x = self.CR_X[k] + p['x'] + p['vx'] * tau
                    y = self.CR_Y + p['y'] + p['vy'] * tau + 0.5 * 1100 * tau * tau
                    canvas.paste(p['img'], (int(round((x - self.ox) / gp) * gp + self.ox), int(round((y - self.oy) / gp) * gp + self.oy)), p['img'])
        # Zahlen
        tau = t - self.t_aoe_hit
        if 0 <= tau < 1.6:
            for k in range(2):
                self.draw_text(canvas, '150', 6, (self.CR_X[k], self.CR_Y - 170 - int(60 * smooth(tau / 1.2))), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)
            y = 560 - 40 * smooth(tau / 1.6)
            if tau < 0.4:
                self.draw_text(canvas, '150', 8, (820, y), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)
            else:
                self.draw_text(canvas, '75', 8, (820, y), color=(150, 230, 255), outline=(20, 60, 90), shadow=None)
                if tau < 1.4:
                    self.draw_text(canvas, 'INTERFERENCE', 3, (820, y + 90), color=GOLD_HL, outline=None, shadow=(60, 30, 0))
        if 0.4 <= tau < 0.65:                                                          # Halbierung: Schildring um Null
            m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
            X, Y = self._ci(*self.TC)
            m.ring(X, Y, gamefx.rd(gamefx.ease((tau - 0.4) / 0.25) * 22), 2, V[2], True)

    # ───────── Zähler ─────────
    def _draw_hud(self, canvas, d, t):
        hp = self.hp(t)
        self.draw_text(canvas, 'NULL HP', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(hp), 9, (125, 140), color=(255, 255, 255), outline=None, shadow=(40, 10, 80))
        n = self.n_negated(t)
        if n:
            self.draw_text(canvas, 'NEGATED', 3, (955, 74), color=PURPLE_T, outline=None, shadow=(20, 10, 40))
            self.draw_text(canvas, '%d/3' % n, 9, (955, 140), color=PURPLE_T if n < 3 else (255, 255, 255), outline=None, shadow=(40, 10, 80))
        for T in (self.T_ACT[3] + 1.9,):
            if T <= t < self.D - 0.8 and int(t * 6) % 2 == 0:
                self.draw_text(canvas, 'ALL NEGATED!', 5, (540, 1000), color=PURPLE_T, outline=(20, 10, 40), shadow=None)

    def _draw_finale(self, canvas, d, t):
        tau = t - (self.T_ACT[3] + 1.9)
        if not (0 <= tau < 1.4):
            return
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        X, Y = self._ci(*self.TC)
        for k in range(3):
            dt = tau - 0.15 * k
            if 0 <= dt < 0.9:
                m.ring(X, Y, gamefx.rd(gamefx.ease(dt / 0.8) * (30 + 12 * k)), 2 if dt < 0.15 else 1, V[3 - k], k > 0)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_enemies(canvas, d, t)
        self._draw_creatures(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_status(canvas, d, t)
        self._draw_attacks(canvas, d, t)
        self._draw_finale(canvas, d, t)
        self._draw_hud(canvas, d, t)
        self._draw_caption(canvas, ImageDraw.Draw(canvas), t)

    # ───────── Interface ─────────
    def draw_behind(self, canvas, f):
        return

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

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t + (item[2] if len(item) > 2 else 0.0), item[0], item[1]) + tuple(item[3:]))
        add(0.0, 'open')
        for k in range(2):
            add(self.t_cr_in[k], 'place')
        for i in range(3):
            add(self.t_in[i], 'enemy')
        for i in (0, 1, 3):
            add(self.imp[i] - self.FL, 'throw'); add(self.imp[i], 'slash'); add(self.imp[i] + 0.05, 'negate')
        for i in (0, 1):
            add(self.T_ACT[i] + 2.35, 'fizzle')
        add(self.t_aoe_hit - 0.2, 'aoe'); add(self.t_aoe_hit + 0.1, 'die'); add(self.t_aoe_hit + 0.25, 'die'); add(self.t_aoe_hit + 0.4, 'half')
        for k in range(3):
            add(self.T_ACT[3] + 1.9 + 0.15 * k, 'ping')
        ev.append((D - 1.0, 'ascension', -9, 1.2))
        return sorted(ev)
