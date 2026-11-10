"""Hel-Show: der gebundene Poltergeist. Sie ergreift Besitz von einer Ausrüstung (Super-Killing Knife), solange sie gebunden ist, wird jeder Schaden halbiert (aufgerundet);
verliert sie den Gegenstand, muss sie am Zugende eine Kopie neu ausrüsten (und bezahlen), sonst verliert sie den Fokus und verschwindet.
Angriffe auf Hel (Schnitt, Kettenblitz), der Wurf des Fake Legendary Sword und Hels Tod sind Nachbauten der echten Spiel-Animationen (gamefx.py). Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

GREEN = [(0, 150, 80), (26, 255, 115), (102, 255, 113), (255, 251, 210)]
CYAN = (150, 230, 255)


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class GhostShow(CaptionMixin):
    T1, T2, T3, T4 = 3.2, 7.0, 10.8, 15.0
    CW, CH = 180, 252
    KX, KY = 200, 1752
    EN_X, EN_Y = 540, 140
    OW, OH = 176, 246
    HP0, GOLD0, COST = 250, 10, 10
    CAPTIONS = [
        (1.0, 3.1, 'Meet *Hel* - a *poltergeist* who needs a *host*.'),
        (3.2, 6.9, 'At the start of the game she *possesses* an Equip - for *free*!'),
        (7.0, 10.7, 'While she is *bound*, all damage is *halved* - rounded up!'),
        (10.8, 14.9, 'Host destroyed? She must *re-equip* a copy before her turn ends - and *pay* for it!'),
        (15.0, 18.4, 'No host, no gold, no *focus* - and poof!'),
        (18.6, 21.3, 'Bring a *spare*, or Hel will *ghost* you!'),
    ]
    SND = {
        'open':    [('elem_dark', -6)],
        'flow':    [('elem_dark', -9)],
        'bind':    [('ability_activate', -7)],
        'whoosh':  [('booster_card_whoosh', -8)],
        'place':   [('placement', -8)],
        'enemy':   [('placement', -10)],
        'slash':   [('slash', -4), ('damage', -7)],
        'zap':     [('elem_lightning', -4), ('damage', -7)],
        'halve':   [('negate', -9)],
        'throw':   [('projectile', -8)],
        'destroy': [('creature_destroyed', -5), ('damage', -7)],
        'tick':    [('doom_tick', -9)],
        'pay':     [('shop_purchase', -8)],
        'death':   [('hero_death', -4)],
        'ping':    [('ping', -9)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self.frame_fn, self.per, self.nfr = geom['frame_fn'], geom['per'], geom['nframes']
        self.mid_x, self.foot_y = geom['mid_x'], geom['foot_y']
        self._cache = {}
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        sm = lambda im: im.resize((self.CW, self.CH), Image.BOX)
        self.knife = sm(ld('equip-knife'))
        self.fake = sm(ld('spell-fake'))
        U_ = U
        ow, oh = self.OW // U_, self.OH // U_
        self.en = ld('e-lizbeth').convert('RGB').resize((ow, oh), Image.BOX).resize((ow * U_, oh * U_), Image.NEAREST).convert('RGBA')
        gp = self.gp
        self.tc = (self.ox + self.mid_x * gp, self.oy + 17 * gp)                          # Mitte von Hel (Bildschirm)
        self.hand = (self.ox + 5.5 * gp, self.oy + 18.5 * gp)                              # Griff des Messers
        self.knife_top = (self.KX, self.KY - self.CH / 2 + 10)
        # Zeitplan
        self.t_land1 = self.T1 + 0.5
        self.flow = [(self.T1 + 0.9, self.T1 + 1.9), (self.T3 + 2.7, self.T3 + 3.5)]
        self.t_hit = [self.T2 + 0.9, self.T2 + 2.4]
        self.dmg = [(100, 50), (75, 38)]
        self.t_kill = [self.T3 + 0.3 + 0.9 * 0.85, self.T4 + 0.3 + 0.9 * 0.85]            # Fake Legendary Sword landet
        self.t_copy = self.T3 + 2.3                                                         # Kopie aus dem Ablagestapel
        self.t_pay = self.T3 + 2.6
        self.t_death = self.T4 + 3.3
        self.bound_iv = [(self.T1 + 1.9, self.t_kill[0]), (self.T3 + 3.5, self.t_kill[1])]
        self.FLASHES = tuple([0.0] + self.t_hit + self.t_kill + [self.t_death])
        self.SHOCKS = tuple([0.0, self.T1 + 1.9, self.T3 + 3.5])
        self.TENSION_SHAKES = [(t, 6) for t in self.FLASHES]
        self.T_GUST = 0.0
        self._fx = {}
        self._build_tiles()
        self._death = None

    # ───────── Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

    def is_bound(self, t):
        return any(a <= t < b for a, b in self.bound_iv)

    def focus(self, t):
        if t < self.T1 + 1.9:
            return 1.0
        if self.is_bound(t):
            return 1.0
        if self.T3 + 1.065 <= t < self.T3 + 3.5:                                           # Akt 3: sinkt auf 35 %, füllt sich nach dem Neu-Ausrüsten
            d0, d1 = self.t_kill[0], self.T3 + 2.4
            if t < d1:
                return 1 - 0.65 * (t - d0) / (d1 - d0)
            if t < self.T3 + 2.7:
                return 0.35
            return 0.35 + 0.65 * (t - (self.T3 + 2.7)) / 0.8
        if t >= self.t_kill[1]:
            return max(0.0, 1 - (t - self.t_kill[1]) / (self.t_death - self.t_kill[1]))
        return 1.0

    def hp(self, t):
        v = self.HP0
        for i, th in enumerate(self.t_hit):
            if t >= th:
                v -= self.dmg[i][1]
        return v

    def gold(self, t):
        return self.GOLD0 - (self.COST if t >= self.t_pay else 0)

    def hide_sprite(self, f):
        t = f / float(self.fps)
        if t >= self.t_death:
            return True
        fo = self.focus(t)
        if fo < 0.999 and not self.is_bound(t):
            return ((f * 7919) % 100) / 100.0 > 0.25 + 0.75 * fo                          # flackert: je weniger Fokus, desto öfter weg
        return False

    # ───────── Gegnerkarte, Messerkarten, Kacheln ─────────
    def _build_tiles(self):
        rng = np.random.default_rng(5)
        gp = self.gp
        self.tiles = []
        w, h = self.knife.size
        for ty in range(0, h, gp):
            for tx in range(0, w, gp):
                cx, cy = tx + gp / 2 - w / 2, ty + gp / 2 - h / 2
                n = math.hypot(cx, cy) or 1.0
                sp = rng.uniform(160, 520)
                self.tiles.append(dict(img=self.knife.crop((tx, ty, tx + gp, ty + gp)), x=tx - w / 2, y=ty - h / 2, vx=cx / n * sp + rng.uniform(-60, 60),
                                       vy=cy / n * sp * 0.8 - rng.uniform(100, 360), life=rng.uniform(0.7, 1.1)))

    def _draw_enemy(self, canvas, d, t):
        t_in = self.T2 - 0.4
        if t < t_in:
            return
        y = self.EN_Y - 220 * (1 - ease_out((t - t_in) / 0.3))
        U = self.U
        canvas.paste(self.en, (int(round((self.EN_X - self.en.width / 2) / U) * U), int(round((y - self.en.height / 2) / U) * U)), self.en)

    def _knife_card(self, canvas, d, t):
        """Messerkarte: erste Kopie landet T1+0,5, wird T3 zerstört; zweite Kopie (Ablagestapel) bis T4 zerstört; danach leerer Platz."""
        U, gp = self.U, self.gp
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        spans = [(self.t_land1, self.t_kill[0]), (self.t_copy, self.t_kill[1])]
        for k, (t0, t1) in enumerate(spans):
            if t < t0:
                continue
            if t < t1:
                u = ease_out((t - t0) / 0.4)
                x = self.KX + 420 * (1 - u)
                y0 = int(round((self.KY - self.CH / 2) / U) * U)
                if t - t0 >= 0.05:
                    canvas.paste(self.knife, (int(round((x - self.CW / 2) / U) * U), y0), self.knife)
                if t - t0 >= 0.4:
                    self.draw_text(canvas, 'SUPER-KILLING KNIFE', 1, (self.KX, y0 - 14), color=GOLD_HL if t - t0 < 1.5 else (255, 255, 255), outline=None, shadow=(20, 10, 30))
                    if self.is_bound(t):
                        self._green_frame(d, self.KX - self.CW / 2, y0, t)
            else:
                tau = t - t1
                for p in self.tiles:
                    if tau >= p['life']:
                        continue
                    if tau > p['life'] * 0.7 and (int(t * 30) & 1):
                        continue
                    x = self.KX + p['x'] + p['vx'] * tau
                    y = self.KY + p['y'] + p['vy'] * tau + 0.5 * 1100 * tau * tau
                    canvas.paste(p['img'], (int(round((x - self.ox) / gp) * gp + self.ox), int(round((y - self.oy) / gp) * gp + self.oy)), p['img'])
        if t >= self.t_kill[1] + 1.2:                                                       # leerer Platz
            x0, y0 = self.KX - self.CW / 2, self.KY - self.CH / 2
            if int(t * 4) % 2 == 0:
                for (a, b, c, e) in ((x0, y0, x0 + self.CW, y0 + gp - 1), (x0, y0 + self.CH - gp, x0 + self.CW, y0 + self.CH - 1), (x0, y0, x0 + gp - 1, y0 + self.CH), (x0 + self.CW - gp, y0, x0 + self.CW - 1, y0 + self.CH)):
                    self.pix_rect(d, a, b, c, e, (150, 60, 60))
            self.draw_text(canvas, 'NO COPY!', 3, (self.KX, self.KY), color=(255, 110, 110), outline=None, shadow=(70, 10, 10))

    def _green_frame(self, d, x0, y0, t):
        gp = self.gp
        if int(t * 6) % 2:
            return
        for (a, b, c, e) in ((x0 - gp, y0 - gp, x0 + self.CW + gp, y0 - 1), (x0 - gp, y0 + self.CH, x0 + self.CW + gp, y0 + self.CH + gp - 1),
                             (x0 - gp, y0 - gp, x0 - 1, y0 + self.CH + gp), (x0 + self.CW, y0 - gp, x0 + self.CW + gp - 1, y0 + self.CH + gp)):
            self.pix_rect(d, a, b, c, e, GREEN[1])

    # ───────── Besitz ergreifen: Faden und Irrlichter ─────────
    def _bez(self, u):
        (x0, y0), (x2, y2) = self.hand, self.knife_top
        x1, y1 = 40, 1250
        a, b, c = (1 - u) ** 2, 2 * u * (1 - u), u * u
        return a * x0 + b * x1 + c * x2, a * y0 + b * y1 + c * y2

    def _draw_tether(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        if self.is_bound(t):
            n = 46
            for i in range(n):
                u = i / float(n - 1)
                if ((i * 1.0 - t * 14) % 4) >= 1.5:
                    continue
                x, y = self._bez(u)
                cx, cy = self._cp(x, y)
                m.rect(gamefx.rd(cx), gamefx.rd(cy), 1, 1, GREEN[1] if i % 2 else GREEN[3])
        for k, (a, b) in enumerate(self.flow):                                              # Irrlichter strömen von Hel in den Gegenstand
            if not (a <= t < b + 0.6):
                continue
            for j in range(40):
                t0 = a + gamefx.H(70 + k, j) * (b - a)
                u = (t - t0) / 0.55
                if not (0 <= u <= 1):
                    continue
                x, y = self._bez(u)
                cx, cy = self._cp(x, y)
                off = (gamefx.H(80 + k, j) - 0.5) * 5 * (1 - u)
                px, py = gamefx.rd(cx + off), gamefx.rd(cy + off * 0.6 - 2 * math.sin(u * math.pi))
                sz = 2 if gamefx.H(90 + k, j) < 0.3 else 1
                m.rect(px, py, sz, sz, GREEN[int(gamefx.H(95 + k, j) * 4)])
        for tb in (self.T1 + 1.9, self.T3 + 3.5):                                          # eingerastet: grüne Ringe an der Karte
            tau = t - tb
            if 0 <= tau < 0.6:
                X, Y = self._cp(self.KX, self.KY)
                X, Y = gamefx.rd(X), gamefx.rd(Y)
                m.ring(X, Y, gamefx.rd(gamefx.ease(tau / 0.4) * 12), 2 if tau < 0.1 else 1, GREEN[1], False)
                if tau > 0.05:
                    m.ring(X, Y, gamefx.rd(gamefx.ease((tau - 0.05) / 0.5) * 17), 1, GREEN[2], True)
        for k, tk in enumerate(self.t_kill):                                               # Faden reißt
            tau = t - tk
            if 0 <= tau < 0.5:
                for i in range(20):
                    u = i / 19.0
                    if (i + int(t * 30)) % 3 == 0:
                        continue
                    x, y = self._bez(u)
                    cx, cy = self._cp(x, y)
                    m.rect(gamefx.rd(cx + (gamefx.H(110 + k, i) - 0.5) * 10 * tau * 4), gamefx.rd(cy + tau * 8 * (gamefx.H(120 + k, i) - 0.3)), 1, 1, GREEN[0] if i % 2 else GREEN[1])

    # ───────── Angriffe auf Hel, Wurf des Fake Legendary Sword ─────────
    def _fxs(self):
        if self._fx:
            return self._fx
        c = self._cp(*self.tc)
        C = (gamefx.rd(c[0]), gamefx.rd(c[1]))
        e = self._cp(self.EN_X, self.EN_Y + 100)
        E = (gamefx.rd(e[0]), gamefx.rd(e[1]))
        k = self._cp(self.KX, self.KY)
        K = (gamefx.rd(k[0]), gamefx.rd(k[1]))
        self._fx['hit1'] = gamefx.Schnitt(C[0], C[1], 16, krit=True, salt=17)
        self._fx['hit2'] = gamefx.Kettenblitz(E, C, step=3, k=0.62, salt=33, entlade=True)
        self._fx['sw'] = [gamefx.Geschoss('schwert', E, K, 0.9, t0=0.0, R=9, salt=3 + i) for i in range(2)]
        self._fx['cut'] = [gamefx.Schnitt(K[0], K[1], 10, krit=True, salt=41 + i) for i in range(2)]
        return self._fx

    def _draw_attacks(self, canvas, d, t):
        fx = self._fxs()
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        fx['hit1'].draw(m, t - self.t_hit[0])
        if t >= self.t_hit[1] - gamefx.LT:
            fx['hit2'].draw(m, t - (self.t_hit[1] - gamefx.LT))
        for i, tk in enumerate(self.t_kill):
            t0 = tk - 0.9 * 0.85
            fx['sw'][i].draw(m, t - t0)
            fx['cut'][i].draw(m, t - tk)

    # ───────── Tod ─────────
    def _draw_death(self, canvas, d, t):
        if t < self.t_death:
            return
        if self._death is None:
            fr = self.frame_fn(int(self.t_death * self.fps))
            self._death = gamefx.HeroDeath(fr, self.mid_x, self.foot_y, zw=20, salt=9)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        tau = t - self.t_death
        self._death.draw(m, tau)
        for j in range(26):                                                                 # grüne Irrlichter steigen auf
            t0 = 0.5 + gamefx.H(130, j) * 1.4
            life = 1.6 + gamefx.H(131, j) * 0.8
            u = (tau - t0) / life
            if not (0 <= u <= 1):
                continue
            x = self.mid_x + (gamefx.H(132, j) - 0.5) * 14 + 1.5 * math.sin(tau * 3 + j)
            y = self.foot_y - 6 - u * (14 + gamefx.H(133, j) * 10)
            if u > 0.6 and gamefx.BAY8[gamefx.rd(y) & 7][gamefx.rd(x) & 7] < ((u - 0.6) / 0.4) * 64:
                continue
            m.rect(gamefx.rd(x), gamefx.rd(y), 1, 1, GREEN[1 + j % 3])

    # ───────── Zahlen und Zähler ─────────
    def _draw_numbers(self, canvas, d, t):
        for i, th in enumerate(self.t_hit):
            tau = t - th
            if 0 <= tau < 1.3:
                a, b = self.dmg[i]
                y = 560 - 40 * smooth(tau / 1.3)
                if tau < 0.35:
                    self.draw_text(canvas, str(a), 8, (820, y), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)
                else:
                    self.draw_text(canvas, str(b), 8, (820, y), color=CYAN, outline=(20, 60, 90), shadow=None)
                    if tau < 1.0:
                        self.draw_text(canvas, 'HALVED', 3, (820, y + 90), color=GOLD_HL, outline=None, shadow=(60, 30, 0))
            if 0.35 <= tau < 0.55:
                m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
                X, Y = self._cp(*self.tc)
                m.ring(gamefx.rd(X), gamefx.rd(Y), gamefx.rd(gamefx.ease((tau - 0.35) / 0.2) * 14), 2, GREEN[2], True)

    def _draw_hud(self, canvas, d, t):
        hp = self.hp(t)
        self.draw_text(canvas, 'HEL HP', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(hp), 9, (125, 140), color=GREEN[2] if hp > 100 else (255, 110, 110), outline=None, shadow=(10, 50, 20))
        if t >= self.T1 + 0.5:
            self.draw_text(canvas, 'GOLD', 2, (125, 214), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
            g = self.gold(t)
            self.draw_text(canvas, str(g), 6, (125, 260), color=GOLD if g else (255, 110, 110), outline=None, shadow=(60, 30, 0))
        if t >= self.T1 + 1.9:
            fo = self.focus(t)
            self.draw_text(canvas, 'FOCUS', 3, (955, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
            x0, y0, w, h = 840, 112, 230, 40
            self.pix_rect(d, x0 - 7, y0 - 7, x0 + w + 6, y0 + h + 6, (20, 10, 30))
            self.pix_rect(d, x0 - 7, y0 - 7, x0 + w + 6, y0 - 4, (255, 255, 255)); self.pix_rect(d, x0 - 7, y0 + h + 3, x0 + w + 6, y0 + h + 6, (255, 255, 255))
            self.pix_rect(d, x0 - 7, y0 - 7, x0 - 4, y0 + h + 6, (255, 255, 255)); self.pix_rect(d, x0 + w + 3, y0 - 7, x0 + w + 6, y0 + h + 6, (255, 255, 255))
            wf = int(round(w * fo / self.U) * self.U)
            col = (255, 90, 90) if (fo < 0.4 and int(t * 8) % 2 == 0) else GREEN[1]
            if wf > 0:
                self.pix_rect(d, x0, y0, x0 + wf - 1, y0 + h - 1, col)
        for tb in (self.T3 + 2.0, self.T4 + 2.0):
            if tb <= t < tb + 0.7 and int(t * 8) % 2 == 0:
                self.draw_text(canvas, 'END OF TURN', 6, (540, 1000), color=GOLD_HL, outline=(20, 10, 30), shadow=None)
        if self.t_pay <= t < self.t_pay + 0.9:
            self.draw_text(canvas, '-%d GOLD' % self.COST, 6, (125 + int(120 * smooth((t - self.t_pay) / 0.5)), 340 + int(40 * smooth((t - self.t_pay) / 0.9))), color=(255, 214, 64), outline=(40, 20, 0), shadow=None)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_enemy(canvas, d, t)
        self._knife_card(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_tether(canvas, d, t)
        self._draw_attacks(canvas, d, t)
        self._draw_death(canvas, d, t)
        self._draw_numbers(canvas, d, t)
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
        add(self.t_land1 - 0.1, 'whoosh'); add(self.t_land1 + 0.4, 'place')
        for a, b in self.flow:
            add(a, 'flow'); add(b, 'bind')
        add(self.T2 - 0.4, 'enemy')
        add(self.t_hit[0], 'slash'); add(self.t_hit[0] + 0.35, 'halve')
        add(self.t_hit[1], 'zap'); add(self.t_hit[1] + 0.35, 'halve')
        for k, tk in enumerate(self.t_kill):
            add(tk - 0.9 * 0.85, 'throw'); add(tk, 'destroy')
            t0 = self.t_kill[k] + 1.0
            for j in range(4 if k == 0 else 6):
                add(t0 + 0.4 * j, 'tick')
        add(self.t_copy - 0.1, 'whoosh'); add(self.t_copy + 0.4, 'place'); add(self.t_pay, 'pay')
        add(self.t_death, 'death')
        ev.append((D - 1.0, 'ascension', -9, 1.2))
        return sorted(ev)
