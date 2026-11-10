"""Thorad-Show: die 90er-Version von Thor. Gewitter im Hintergrund, Wowhalla legt jede Runde eine Karte auf den Coolness Stack (+40 Schaden je Karte),
am Ende wird Modnir (Hammer of Coolness) vom Stack ausgerüstet. Angriffe sind Nachbauten der echten Spiel-Animationen (gamefx.py): Kettenblitz, Hammerwurf, Hammer-Aufprall.
Gleiche Schnittstelle wie WebShow / ArmsShow."""
import math

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class CoolShow(CaptionMixin):
    T_ACT = [3.4, 7.3, 11.2, 15.1]
    T_WOW = 2.4
    CW, CH = 180, 252
    WOW_X, ROW_Y = 170, 1752
    STACK_X0, STACK_DX = 420, 105
    EN_X, EN_Y = 540, 140
    OW, OH = 176, 246
    ATK0, PER = 80, 40
    HP0 = 500
    DMG = [120, 160, 200, 300]
    STACK = ['s-hipdall', 's-wowkyrie', 's-swagdri', 's-modnir']
    NAMES = ['HIPDALL', 'WOWKYRIE', 'SWAGDRI', 'MODNIR']
    CAPTIONS = [
        (1.0, 3.3, "Yo! It's *Thorad*, the *Strength of Coolness* - totally radical, dude!"),
        (3.4, 7.2, 'Every card in his *Coolness Stack* adds *40* damage. Bodacious!'),
        (7.3, 11.1, 'Two cards? That is *160*. Talk to the hand!'),
        (11.2, 15.0, 'Three cards - *200* damage! No way! Way!'),
        (15.1, 18.7, 'Modnir on top? Booyah! Hammer time - *300*, and it is all *Coolness*!'),
        (18.9, 21.3, 'Stay *cool*. Thorad is *all that*. Not!'),
    ]
    SND = {
        'open':   [('heavy_impact', -3), ('elem_lightning', -5)],
        'thunder': [('elem_lightning', -13)],
        'whoosh': [('booster_card_whoosh', -8)],
        'place':  [('placement', -8)],
        'zap':    [('elem_lightning', -4), ('damage', -7)],
        'buff':   [('buff', -7)],
        'throw':  [('projectile', -8)],
        'smash':  [('heavy_impact', -3), ('elem_lightning', -5), ('damage', -6)],
        'ko':     [('hero_death', -8)],
        'enemy':  [('placement', -10)],
        'ping':   [('ping', -9)],
        'equip':  [('ability_activate', -8)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self.home = geom['home']
        self.actor_fn = geom['actor_fn']
        self._cache = {}
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        sm = lambda im: im.resize((self.CW, self.CH), Image.BOX)
        self.wow = sm(ld('wowhalla'))
        self.cards = [sm(ld(n)) for n in self.STACK]
        ow, oh = self.OW // U, self.OH // U
        im = ld('e-hatusbal').convert('RGB').resize((ow, oh), Image.BOX)
        a = np.asarray(im).astype(np.float32)
        hit = np.clip(a * np.array([1.0, 0.35, 0.35]) + np.array([70, 0, 0]), 0, 255).astype(np.uint8)
        self.en = Image.fromarray(a.astype(np.uint8), 'RGB').resize((ow * U, oh * U), Image.NEAREST).convert('RGBA')
        self.en_hit = Image.fromarray(hit, 'RGB').resize((ow * U, oh * U), Image.NEAREST).convert('RGBA')
        hx, hy = self.home
        self.tc = (hx, hy - 170)
        self.hand = (hx + 175, hy - 215)
        self.land = [T + 0.4 for T in self.T_ACT]
        self.t_equip = self.T_ACT[3] + 2.0
        self.imp = [T + 1.8 for T in self.T_ACT[:3]] + [self.T_ACT[3] + 2.87]
        self.atk_steps = [(T + 1.0, self.PER, '+40', GOLD_HL) for T in self.T_ACT]
        self.atk_steps += [(self.t_equip, 100, '+100', GOLD_HL), (self.t_equip, -self.PER, '-40', (255, 120, 120))]
        self.FLASHES = tuple([0.0] + list(self.imp))
        self.SHOCKS = tuple([0.0] + [s[0] for s in self.atk_steps[:4]])
        self.TENSION_SHAKES = [(t, 7 if i == 0 else 5) for i, t in enumerate(self.SHOCKS)]
        self.T_GUST = 0.0
        self._fx = {}
        self._build_tiles()
        self._build_sky()
        self._build_storm()

    # ───────── Raster / Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

    def stack_x(self, k):
        return self.STACK_X0 + k * self.STACK_DX

    def n_stack(self, t):
        n = sum(1 for lt in self.land if t >= lt + 0.4)
        if t >= self.t_equip - 0.5:
            n -= 1
        return n

    def atk(self, t):
        v = self.ATK0
        for tt, b, lab, col in self.atk_steps:
            if t >= tt:
                v += b
        return v

    def atk_changed(self, t):
        return any(0 <= t - s[0] < 0.45 for s in self.atk_steps)

    def hp(self, t):
        v = self.HP0
        for i, im in enumerate(self.imp):
            if t >= im:
                v -= self.DMG[i]
        return max(0, v)

    # ───────── Pose ─────────
    def pose_at(self, t):
        for i in range(3):
            T = self.T_ACT[i]
            if T + 1.35 <= t < T + 2.3:
                return 0
        T = self.T_ACT[3]
        if T + 2.25 <= t < T + 3.1:
            return 0
        return None

    def hide_sprite(self, f):
        return self.pose_at(f / float(self.fps)) is not None

    # ───────── Gewitterhimmel ─────────
    def _build_sky(self):
        gp, W = self.gp, self.W
        gw, gh = W // gp + 2, 560 // gp + 1
        yy, xx = np.mgrid[0:gh, 0:gw].astype(np.float32)
        rng = np.random.default_rng(11)
        dens = np.zeros((gh, gw), np.float32)
        for _ in range(16):
            cx, cy = rng.uniform(0, gw), rng.uniform(0, gh * 0.45)
            rx, ry = rng.uniform(8, 20), rng.uniform(3, 7)
            dens += np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)) * rng.uniform(0.5, 1.0)
        dens *= 1.0 - np.clip(yy / gh, 0, 1) * 0.55
        bay = np.array(gamefx.BAY4, np.float32).reshape(4, 4)
        thr = (bay[(np.arange(gh) % 4)[:, None], (np.arange(gw) % 4)[None, :]] + 0.5) / 16.0
        lo = dens > thr * 1.2
        hi = dens > thr * 2.1 + 0.25
        col = np.zeros((gh, gw, 4), np.uint8)
        col[lo] = (52, 40, 84, 255)
        col[hi] = (84, 74, 120, 255)
        im = Image.fromarray(col, 'RGBA').resize((gw * gp, gh * gp), Image.NEAREST)
        self.sky = Image.new('RGBA', (W, self.H), (0, 0, 0, 0))
        self.sky.paste(im, (self.ox % gp - gp, self.oy % gp - gp), im)
        mk = (thr < 0.34).astype(np.uint8) * 255                                         # Blitzlicht: Schachbrett-Dither über dem Himmel
        m = Image.fromarray(mk, 'L').resize((gw * gp, gh * gp), Image.NEAREST)
        self.flash_mask = Image.new('L', (W, self.H), 0)
        self.flash_mask.paste(m, (self.ox % gp - gp, self.oy % gp - gp))

    def _build_storm(self):
        """Hintergrundblitze: (Zeit, Kettenblitz-Objekt, Auftreffzeit)."""
        xs = [110, 960, 230, 880, 70, 1000, 330, 790, 160, 920, 260, 840]
        self.bolts = []
        for k in range(24):
            t = 0.9 + 0.82 * k + 0.2 * gamefx.H(7, k)
            x = xs[k % len(xs)] + int((gamefx.H(8, k) - 0.5) * 60)
            yb = 700 + int(gamefx.H(9, k) * 800)
            A = self._cp(x + (gamefx.H(10, k) - 0.5) * 200, -50)
            B = self._cp(x, yb)
            kb = gamefx.Kettenblitz(A, B, step=k, k=0.32, salt=100 + k, entlade=False)
            self.bolts.append((t, kb))
        c = self._cp(*self.tc)
        top = self._cp(self.tc[0] + 10, self.tc[1] - 230)
        self.intro_bolt = (0.1, gamefx.Kettenblitz(self._cp(self.tc[0] - 60, -60), top, step=3, k=0.6, salt=55, entlade=False))

    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        canvas.alpha_composite(self.sky)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        flash = False
        for tb, kb in self.bolts + [self.intro_bolt]:
            dt = t - tb
            if 0 <= dt < kb.ENDE:
                kb.draw(m, dt)
                if gamefx.LT <= dt < gamefx.LT + 0.1:
                    flash = True
        if flash:
            canvas.paste(Image.new('RGBA', canvas.size, (179, 216, 249, 255)), (0, 0), self.flash_mask)

    def storm_times(self):
        return [tb + gamefx.LT for tb, kb in self.bolts] + [self.intro_bolt[0] + gamefx.LT]

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

    def post_fx(self, img, f):
        t = f / float(self.fps)
        fl = 0.0
        for tg in self.FLASHES:
            if 0 <= t - tg < 0.25:
                fl = max(fl, (0.4 if tg == 0.0 else 0.22) * math.exp(-(t - tg) / 0.08))
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

    # ───────── Gegner ─────────
    def _build_tiles(self):
        rng = np.random.default_rng(3)
        gp = self.gp
        self.tiles = []
        w, h = self.en.size
        for ty in range(0, h, gp):
            for tx in range(0, w, gp):
                cx, cy = tx + gp / 2 - w / 2, ty + gp / 2 - h / 2
                n = math.hypot(cx, cy) or 1.0
                sp = rng.uniform(160, 520)
                self.tiles.append(dict(img=self.en.crop((tx, ty, tx + gp, ty + gp)), x=tx - w / 2, y=ty - h / 2, vx=cx / n * sp + rng.uniform(-60, 60),
                                       vy=cy / n * sp * 0.8 - rng.uniform(100, 360), life=rng.uniform(0.7, 1.1)))

    def _draw_enemy(self, canvas, d, t):
        t_in = self.T_ACT[0] - 0.5
        if t < t_in:
            return
        gp, U = self.gp, self.U
        cx, cy = self.EN_X, self.EN_Y
        t_sh = self.imp[3] + 0.12
        if t < t_sh:
            y = cy - 220 * (1 - ease_out((t - t_in) / 0.3))
            hit = any(0 <= t - im < 0.4 for im in self.imp[:3]) or (self.imp[3] <= t < t_sh)
            im = self.en_hit if (hit and int(t * 15) % 2 == 0) else self.en
            sh = (8 if int(t * 30) % 2 else -8) if hit else 0
            canvas.paste(im, (int(round((cx - im.width / 2 + sh) / U) * U), int(round((y - im.height / 2) / U) * U)), im)
            return
        tau = t - t_sh
        for p in self.tiles:
            if tau >= p['life']:
                continue
            if tau > p['life'] * 0.7 and (int(t * 30) & 1):
                continue
            x = cx + p['x'] + p['vx'] * tau
            y = cy + p['y'] + p['vy'] * tau + 0.5 * 1100 * tau * tau
            canvas.paste(p['img'], (int(round((x - self.ox) / gp) * gp + self.ox), int(round((y - self.oy) / gp) * gp + self.oy)), p['img'])

    # ───────── Karten unten: Wowhalla und Coolness Stack ─────────
    def _draw_cards(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        C = gamefx.C30
        gp = self.gp
        # Wowhalla landet
        if t >= self.T_WOW:
            u = ease_out((t - self.T_WOW) / 0.4)
            y0 = int(round((self.ROW_Y - self.CH / 2 + 330 * (1 - u)) / self.U) * self.U)
            if t - self.T_WOW >= 0.07:
                canvas.paste(self.wow, (int(self.WOW_X - self.CW / 2), y0), self.wow)
                if t - self.T_WOW >= 0.4:
                    self.draw_text(canvas, 'WOWHALLA', 2, (self.WOW_X, y0 - 16), color=GOLD_HL if t - self.T_WOW < 1.2 else (255, 255, 255), outline=None, shadow=(20, 10, 30))
            self._ring_at(m, self.WOW_X, self.ROW_Y, t - (self.T_WOW + 0.4))
        # Coolness Stack
        n_show = sum(1 for lt in self.land if t >= lt)
        if t >= self.land[0]:
            self.draw_text(canvas, 'COOLNESS STACK', 2, (self.stack_x(1) + 50, self.ROW_Y - 160), color=(150, 230, 255), outline=None, shadow=(10, 40, 70))
            n = self.n_stack(t)
            self.draw_text(canvas, 'x%d' % n, 6, (self.stack_x(3) + 190, self.ROW_Y - 20), color=GOLD_HL, outline=(20, 10, 30), shadow=None)
        for k in range(4):
            tl = self.land[k]
            if t < tl:
                continue
            if k == 3 and t >= self.t_equip - 0.5:
                u = (t - (self.t_equip - 0.5)) / 0.5                                     # Modnir fliegt zu Thorad
                if u >= 1:
                    continue
                e = smooth(u)
                x = self.stack_x(3) + (self.tc[0] - self.stack_x(3)) * e
                y = self.ROW_Y + (self.tc[1] - self.ROW_Y) * e - 260 * math.sin(math.pi * e)
            else:
                u = ease_out((t - tl) / 0.4)
                x = self.stack_x(k) + 420 * (1 - u)
                y = self.ROW_Y
            if t - tl < 0.05:
                continue
            canvas.paste(self.cards[k], (int(round((x - self.CW / 2) / self.U) * self.U), int(round((y - self.CH / 2) / self.U) * self.U)), self.cards[k])
            self._ring_at(m, self.stack_x(k), self.ROW_Y, t - (tl + 0.4))
        # Modnir-Aufnahme
        tau = t - self.t_equip
        if 0 <= tau < 0.6:
            X, Y = self._cp(*self.tc)
            X, Y = gamefx.rd(X), gamefx.rd(Y)
            m.ring(X, Y, gamefx.rd(gamefx.ease(tau / 0.4) * 14), 2 if tau < 0.1 else 1, C['creme'], False)
            if tau > 0.05:
                m.ring(X, Y, gamefx.rd(gamefx.ease((tau - 0.05) / 0.5) * 22), 1, C['gelb'], True)
        # Finale: alle Karten leuchten der Reihe nach
        xs = [self.WOW_X] + [self.stack_x(k) for k in range(3)]
        for i, x in enumerate(xs):
            self._ring_at(m, x, self.ROW_Y, t - (self.T_ACT[3] + 3.2 + 0.28 * i), big=True)

    def _ring_at(self, m, x, y, tau, big=False):
        if not (0 <= tau < 0.6):
            return
        C = gamefx.C30
        X, Y = self._cp(x, y)
        X, Y = gamefx.rd(X), gamefx.rd(Y)
        m.ring(X, Y, gamefx.rd(gamefx.ease(tau / 0.4) * 12), 2 if tau < 0.1 else 1, C['creme'], False)
        if tau > 0.05:
            m.ring(X, Y, gamefx.rd(gamefx.ease((tau - 0.05) / 0.5) * 17), 1, C['gelb'], True)

    # ───────── +40 / +100 fliegen in den Zähler ─────────
    def _draw_tokens(self, canvas, d, t):
        for i, (t_a, b, label, col) in enumerate(self.atk_steps):
            t_s = t_a - 0.45
            if not (t_s <= t < t_a):
                continue
            if i < 4:
                x0, y0 = self.stack_x(i), self.ROW_Y - 150
            else:
                x0, y0 = self.tc[0], self.tc[1] + (0 if b > 0 else 60)
            x1, y1 = 125, 140
            u = ease_out((t - t_s) / 0.45)
            x = x0 + (x1 - x0) * u
            y = y0 + (y1 - y0) * u - 380 * math.sin(math.pi * u)
            x, y = int(round(x / self.U) * self.U), int(round(y / self.U) * self.U)
            self.draw_text(canvas, label, 6, (x, y), color=col, outline=(20, 10, 30), shadow=None)

    # ───────── Angriffe ─────────
    def _fxs(self, i):
        if i in self._fx:
            return self._fx[i]
        A = self._cp(*self.hand)
        B = self._cp(self.EN_X, self.EN_Y)
        Bi = (gamefx.rd(B[0]), gamefx.rd(B[1]))
        L = []
        if i < 3:
            kb = gamefx.Kettenblitz((gamefx.rd(A[0]), gamefx.rd(A[1])), Bi, step=i + 1, k=0.62, salt=200 + i, entlade=True)
            L.append(('start', 1.5, kb))
        else:
            fl = 0.55
            L.append(('plain', 0, gamefx.Geschoss('hammer', A, B, fl, t0=2.4, R=10, salt=9)))
            land = 2.4 + fl * 0.85
            L.append(('start', land, gamefx.HammerHit(Bi[0], Bi[1], self.OW / float(self.gp), salt=13)))
            top = self._cp(self.EN_X, -60)
            L.append(('start', land - gamefx.LT, gamefx.Kettenblitz((gamefx.rd(top[0]), gamefx.rd(top[1])), Bi, step=7, k=0.62, salt=222, entlade=False)))
        self._fx[i] = L
        return L

    def _draw_attacks(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        for i, T in enumerate(self.T_ACT):
            tau = t - T
            if not (1.0 <= tau < 4.6):
                continue
            for kind, ts, obj in self._fxs(i):
                if kind == 'plain':
                    obj.draw(m, tau)
                else:
                    obj.draw(m, tau - ts)

    # ───────── Pose und Auftritt ─────────
    def _draw_pose(self, canvas, d, t):
        p = self.pose_at(t)
        if p is None:
            return
        im, pad, cxf, foot = self.actor_fn('pose', p)
        gp = self.gp
        x, y = self.home
        fx = self.ox + int(round((x - cxf * gp - self.ox) / gp)) * gp
        fy = self.oy + int(round((y - foot * gp - self.oy) / gp)) * gp
        canvas.paste(im, (fx - pad + self.sprite_dx(int(t * self.fps)), fy - pad), im)

    def _draw_charge(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        if not hasattr(self, '_ch'):
            c = self._cp(*self.tc)
            self._ch = gamefx.Feuerball((gamefx.rd(c[0]), gamefx.rd(c[1])), (gamefx.rd(c[0]), gamefx.rd(c[1]) - 1), tA=0.9, k=0.55, salt=5)
        for s in self.atk_steps:
            if s[1] > 0:
                dt = t - (s[0] - 0.3)
                if 0 <= dt < 0.3:
                    self._ch._laden(m, dt)

    # ───────── Zähler ─────────
    def _draw_hud(self, canvas, d, t):
        a = self.atk(t)
        col = (255, 255, 255) if (self.atk_changed(t) and int(t * 15) % 2 == 0) else GOLD
        self.draw_text(canvas, 'ATTACK', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(a), 9, (125, 140), color=col, outline=None, shadow=(60, 30, 0))
        if self.T_ACT[0] - 0.5 <= t < self.imp[3] + 0.9:
            hp = self.hp(t)
            self.draw_text(canvas, 'ENEMY HP', 3, (955, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
            self.draw_text(canvas, str(hp), 9, (955, 140), color=(255, 110, 110) if hp <= 20 else (255, 255, 255), outline=None, shadow=(70, 10, 10))
        for i, imp in enumerate(self.imp):
            tau = t - imp
            if 0 <= tau < 0.9:
                self.draw_text(canvas, str(self.DMG[i]), 8, (self.EN_X + 250, 200 - 80 * smooth(tau / 0.9)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)
        if self.T_ACT[3] + 3.1 <= t < self.D - 0.8 and int(t * 6) % 2 == 0:
            self.draw_text(canvas, 'SO COOL!', 4, (125, 206), color=(150, 230, 255), outline=None, shadow=(10, 40, 70))

    def _draw_stack_strike(self, canvas, d, t):
        """Blitz schlägt in die neue Stack-Karte ein (Kettenblitz, wie im Spiel)."""
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        for k, T in enumerate(self.T_ACT):
            dt = t - (self.land[k] - gamefx.LT)
            if not (0 <= dt < 1.3):
                continue
            key = ('strike', k)
            if key not in self._fx:
                x = self.stack_x(k)
                self._fx[key] = gamefx.Kettenblitz(tuple(gamefx.rd(v) for v in self._cp(x - 40, -60)), tuple(gamefx.rd(v) for v in self._cp(x, self.ROW_Y - 90)), step=k + 5, k=0.4, salt=300 + k, entlade=False)
            self._fx[key].draw(m, dt)
        dt = t - (self.T_WOW - gamefx.LT + 0.4)
        if 0 <= dt < 1.3:
            if 'wstrike' not in self._fx:
                self._fx['wstrike'] = gamefx.Kettenblitz(tuple(gamefx.rd(v) for v in self._cp(self.WOW_X - 40, -60)), tuple(gamefx.rd(v) for v in self._cp(self.WOW_X, self.ROW_Y - 90)), step=9, k=0.4, salt=311, entlade=False)
            self._fx['wstrike'].draw(m, dt)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_enemy(canvas, d, t)
        self._draw_cards(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_stack_strike(canvas, d, t)
        self._draw_charge(canvas, d, t)
        self._draw_pose(canvas, d, t)
        self._draw_attacks(canvas, d, t)
        self._draw_tokens(canvas, d, t)
        self._draw_hud(canvas, d, t)
        self._draw_caption(canvas, ImageDraw.Draw(canvas), t)

    # ───────── Soundeffekte (public/sounds): gleiche Aktion = gleicher Sound ─────────
    def sfx_events(self):
        D = self.D
        ev = []

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t + (item[2] if len(item) > 2 else 0.0), item[0], item[1]) + tuple(item[3:]))
        add(0.0, 'open')
        for k, ts in enumerate(self.storm_times()[:-1]):
            if k % 2 == 0 and ts < D - 1.5:
                add(ts, 'thunder')
        add(self.T_WOW, 'whoosh'); add(self.T_WOW + 0.4, 'place'); add(self.T_WOW + 0.4, 'thunder')
        add(self.T_ACT[0] - 0.4, 'enemy')
        for i, T in enumerate(self.T_ACT):
            add(T, 'whoosh'); add(T + 0.4, 'place'); add(T + 0.4, 'thunder')
            add(T + 1.0, 'buff')
        add(self.t_equip - 0.5, 'whoosh'); add(self.t_equip, 'equip'); add(self.t_equip, 'buff')
        for i in range(3):
            add(self.imp[i], 'zap')
        add(self.T_ACT[3] + 2.4, 'throw')
        add(self.imp[3], 'smash')
        add(self.imp[3] + 0.12, 'ko')
        for i in range(4):
            add(self.T_ACT[3] + 3.2 + 0.28 * i, 'ping')
        ev.append((D - 1.0, 'ascension', -9, 1.2))
        return sorted(ev)
