"""Key-Show: die verfluchte Diebin. Spielt der Gegner ein Artefakt aus der Hand, zahlt sie Gold in Höhe seiner Kosten, negiert es und holt es in ihre eigene Hand – der Besitzer zahlt nichts.
Dritter Akt: ein verfluchtes Artefakt (Forbidden Grimoire) – sie greift trotzdem zu und legt sich mit Mächten an, die sie nicht versteht.
Der Kartenflug (Schweif, Abheb-Funken, Schockringe) ist der Nachbau der echten Spiel-Animation (gamefx.Zug). Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

COIN = [gamefx.hexc(h) for h in ('#b62600', '#ee6428', '#f29a3e', '#fad54a', '#fffbd2')]
CURSE = [(20, 10, 36), (90, 30, 130), (160, 80, 220), (230, 190, 255)]


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class ThiefShow(CaptionMixin):
    CW, CH = 150, 210
    HAND_X, HAND_Y = [300, 540, 780], 1752
    EN_X, EN_Y = 540, 140
    OW, OH = 176, 246
    PLAY = (735, 150)                                                                  # gespieltes Artefakt neben dem gegnerischen Helden
    T_ACT = [1.0, 7.0, 11.4]
    COSTS = [10, 12, 10]
    GOLD0 = 40
    CAPTIONS = [
        (0.2, 2.6, '*Key*, the Cursed Thief, is on the prowl...'),
        (2.8, 6.8, 'Enemy plays an *Artifact*? She pays its *cost*, negates it - and steals it into her own hand!'),
        (7.0, 11.0, 'Once per turn - and the owner *pays nothing* at all.'),
        (11.2, 15.0, 'But some things are *cursed*... and *Key* grabs them anyway!'),
        (15.2, 19.0, 'Powers she does not understand - she takes them all the same.'),
        (19.2, 21.4, '*Key* takes what she wants.'),
    ]
    SND = {
        'play':    [('placement', -8)],
        'coin':    [('shop_purchase', -8)],
        'negate':  [('negate', -6)],
        'whoosh':  [('booster_card_whoosh', -8)],
        'steal':   [('draw', -5), ('ping', -9)],
        'turn':    [('turn_start', -9)],
        'curse':   [('elem_dark', -5), ('debuff', -7)],
        'pulse':   [('doom_tick', -9)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self._cache = {}
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        self.arts = [ld('a%d' % (i + 1)).resize((self.CW, self.CH), Image.BOX) for i in range(3)]
        ow, oh = self.OW // U, self.OH // U
        self.en = ld('e-toras').convert('RGB').resize((ow, oh), Image.BOX).resize((ow * U, oh * U), Image.NEAREST).convert('RGBA')
        self.hand = (self.ox + 15 * self.gp, self.oy + 21 * self.gp)                    # Hand mit dem Glitzern
        self.head = (self.ox + 11 * self.gp, self.oy + 4 * self.gp)
        self.chest = (self.ox + 11 * self.gp, self.oy + 17 * self.gp)
        self.t_curse = self.T_ACT[2] + 3.2
        self.FLASHES = tuple([0.0] + [T + 2.0 for T in self.T_ACT])
        self.SHOCKS = (0.0, self.t_curse)
        self.TENSION_SHAKES = [(t, 6) for t in self.FLASHES] + [(self.t_curse, 9)]
        self.T_GUST = 0.0
        self._cache = {}

    # ───────── Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def _ci(self, x, y):
        a, b = self._cp(x, y)
        return gamefx.rd(a), gamefx.rd(b)

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

    def gold(self, t):
        v = self.GOLD0
        for i, T in enumerate(self.T_ACT):
            if t >= T + 1.9:
                v -= self.COSTS[i]
        return v

    def stolen(self, t):
        return sum(1 for T in self.T_ACT if t >= T + 3.0)

    # ───────── Zug-Objekte ─────────
    def _zug(self, key, a, b, dur, salt, bogen=0.0):
        if key not in self._cache:
            self._cache[key] = gamefx.Zug(self._cp(*a), self._cp(*b), dauer=dur, cw=self.CW / float(self.gp), bogen=bogen / self.gp, salt=salt, farbe=gamefx.hexc('#fbe181'))
        return self._cache[key]

    def _card_at(self, canvas, im, x, y):
        U = self.U
        canvas.paste(im, (int(round((x - im.width / 2) / U) * U), int(round((y - im.height / 2) / U) * U)), im)

    # ───────── Gegner ─────────
    def _draw_enemy(self, canvas, d, t):
        if t < 0.3:
            return
        U = self.U
        y = self.EN_Y - 220 * (1 - ease_out((t - 0.3) / 0.3))
        canvas.paste(self.en, (int(round((self.EN_X - self.en.width / 2) / U) * U), int(round((y - self.en.height / 2) / U) * U)), self.en)

    # ───────── Ein Diebstahl ─────────
    def _draw_theft(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        gp = self.gp
        for i, T in enumerate(self.T_ACT):
            tau = t - T
            if tau < 0 or tau > 3.2 + (0 if i < 2 else 0):
                if not (i < 3 and tau >= 3.2):
                    continue
            slot = self.HAND_X[i]
            im = self.arts[i]
            if tau < 3.2:
                if tau < 0.45:                                                         # Gegner spielt das Artefakt
                    z = self._zug(('play', i), (self.EN_X, self.EN_Y + 60), self.PLAY, 0.4, 70 + i)
                    z.draw(m, tau)
                    px, py = z.pos(min(tau, z.dauer))
                    self._card_at(canvas, im, px * gp + self.ox, py * gp + self.oy)
                elif tau < 2.4:                                                         # schwebt in der Kette, wird bezahlt und negiert
                    bob = 4 * math.sin(tau * 6)
                    self._card_at(canvas, im, self.PLAY[0], self.PLAY[1] + bob)
                    if tau >= 2.0:
                        self._negated(canvas, d, m, g, i, tau - 2.0)
                elif tau < 3.0:                                                         # Key zieht es an einem Faden zu sich
                    z = self._zug(('steal', i), self.PLAY, (slot, self.HAND_Y), 0.6, 90 + i, bogen=-80)
                    dt = tau - 2.4
                    z.draw(m, dt)
                    px, py = z.pos(min(dt, z.dauer))
                    X, Y = px * gp + self.ox, py * gp + self.oy
                    self._lasso(g, X, Y, t)
                    self._card_at(canvas, im, X, Y)
                else:
                    self._card_at(canvas, im, slot, self.HAND_Y)
                # Münzen fliegen vom Goldzähler zur Karte (1,4 – 1,9 s)
                if 1.4 <= tau < 1.9:
                    self._coins(canvas, d, tau - 1.4, i)
            else:
                self._card_at(canvas, im, slot, self.HAND_Y)
        # alle bereits gestohlenen Karten bleiben liegen
        for i, T in enumerate(self.T_ACT):
            if t >= T + 3.2:
                pass

    def _coins(self, canvas, d, u, i):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        n = max(3, min(6, self.COSTS[i] // 3))
        for k in range(n):
            uk = (u / 0.5 - k * 0.12)
            if not (0 <= uk <= 1):
                continue
            x = 125 + (self.PLAY[0] - 125) * uk
            y = 260 + (self.PLAY[1] - 260) * uk - 220 * math.sin(math.pi * uk)
            cx, cy = self._ci(x, y)
            self._coin(g, cx, cy, int(u * 20 + k) % 2)

    def _coin(self, g, cx, cy, fl):
        g.disc(cx, cy, 2, COIN[0], 1.0)
        g.disc(cx, cy, 1, COIN[3 if not fl else 2], 1.0)
        g.put(cx - 1, cy - 1, COIN[4], 1.0)

    def _lasso(self, g, X, Y, t):
        a = self._ci(*self.hand)
        b = self._ci(X, Y)
        n = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1)
        for k in range(int(n) + 1):
            if ((k - int(t * 20)) % 3) == 0:
                continue
            u = k / float(n)
            x = gamefx.rd(a[0] + (b[0] - a[0]) * u)
            y = gamefx.rd(a[1] + (b[1] - a[1]) * u + math.sin(u * math.pi) * 4)
            g.put(x, y, COIN[3] if k % 2 else COIN[4], 1.0)

    def _negated(self, canvas, d, m, g, i, tau):
        cx, cy = self._ci(*self.PLAY)
        if tau < 0.4:
            r = gamefx.rd(gamefx.ease(tau / 0.3) * 9)
            g.ring(cx, cy, max(0, r - 2), r, CURSE[3], 1.0)
        g.disc(cx, cy, 7, CURSE[1], 0.28)
        g.line(cx - 5, cy - 6, cx + 5, cy + 6, CURSE[3], 1.0, 2)
        g.line(cx - 5, cy + 6, cx + 5, cy - 6, CURSE[3], 1.0, 2)
        if int((tau) * 10) % 2 == 0:
            self.draw_text(canvas, 'NEGATED', 3, (self.PLAY[0], self.PLAY[1] + 135), color=(200, 160, 255), outline=None, shadow=(20, 10, 40))
        self.draw_text(canvas, 'OWNER PAYS 0', 2, (self.PLAY[0], self.PLAY[1] + 160), color=(255, 255, 255), outline=None, shadow=(20, 10, 40))

    # ───────── Fluch ─────────
    def _bez(self, u):
        (x0, y0), (x2, y2) = (self.HAND_X[2], self.HAND_Y - 100), self.chest
        x1, y1 = 900, 1150
        a, b, c = (1 - u) ** 2, 2 * u * (1 - u), u * u
        return a * x0 + b * x1 + c * x2, a * y0 + b * y1 + c * y2

    def _draw_curse(self, canvas, d, t):
        tau = t - self.t_curse
        if not (0 <= tau < 4.2):
            return
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        grow = smooth(tau / 1.2)
        # dunkle Ranken kriechen vom Grimoire zu Key
        n = 56
        for i in range(int(n * grow)):
            u = i / float(n - 1)
            wob = math.sin(u * 14 + t * 6) * 12 * (1 - abs(2 * u - 1))
            x, y = self._bez(u)
            cx, cy = self._ci(x + wob, y)
            if ((i - int(t * 16)) % 4) == 0:
                continue
            g.block(cx, cy, 1, 1, CURSE[1 + (i % 3)], 1.0)
            if i % 5 == 0:
                g.block(cx + 1, cy - 1, 1, 1, CURSE[3], 1.0)
        # Grimoire pulsiert
        gx, gy = self._ci(self.HAND_X[2], self.HAND_Y)
        r = 8 + int(2 * math.sin(t * 8))
        g.disc(gx, gy, r, CURSE[1], 0.22)
        g.ring(gx, gy, r - 1, r, CURSE[2], 0.6)
        # Key: erschrocken, aber unbeeindruckt
        if tau >= 0.8 and int(t * 5) % 2 == 0:
            self.draw_text(canvas, '?!', 8, (self.head[0] + 70, self.head[1] - 50), color=(255, 255, 255), outline=(60, 20, 90), shadow=None)
        if tau < 3.0 and int(t * 6) % 2 == 0:
            self.draw_text(canvas, 'CURSED!', 6, (540, 1000), color=(200, 140, 255), outline=(20, 10, 40), shadow=None)

    # ───────── Zähler ─────────
    def _draw_hud(self, canvas, d, t):
        self.draw_text(canvas, 'GOLD', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        gold = self.gold(t)
        ch = any(0 <= t - (T + 1.9) < 0.45 for T in self.T_ACT)
        self.draw_text(canvas, str(gold), 9, (125, 140), color=(255, 255, 255) if (ch and int(t * 15) % 2 == 0) else GOLD, outline=None, shadow=(60, 30, 0))
        self.draw_text(canvas, 'STOLEN', 3, (955, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        n = self.stolen(t)
        self.draw_text(canvas, '%d/3' % n, 9, (955, 140), color=(200, 160, 255) if n < 3 else (255, 255, 255), outline=None, shadow=(40, 10, 80))
        for T in self.T_ACT[1:]:
            if T - 0.5 <= t < T + 0.3 and int(t * 8) % 2 == 0:
                self.draw_text(canvas, 'NEXT TURN', 6, (540, 1000), color=(255, 255, 255), outline=(20, 10, 30), shadow=None)
        for i, T in enumerate(self.T_ACT):
            if T + 3.0 <= t < T + 3.8 and int(t * 8) % 2 == 0:
                self.draw_text(canvas, 'STOLEN!', 5, (self.HAND_X[i], self.HAND_Y - 160), color=GOLD_HL, outline=(20, 10, 30), shadow=None)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_enemy(canvas, d, t)
        self._draw_theft(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_curse(canvas, d, t)
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
                fl = max(fl, (0.4 if tg == 0.0 else 0.18) * math.exp(-(t - tg) / 0.08))
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
        for i, T in enumerate(self.T_ACT):
            add(T, 'play')
            for k in range(3):
                add(T + 1.4 + 0.15 * k, 'coin')
            add(T + 2.0, 'negate'); add(T + 2.4, 'whoosh'); add(T + 3.0, 'steal')
            if i > 0:
                add(T - 0.4, 'turn')
        add(self.t_curse, 'curse')
        for k in range(8):
            add(self.t_curse + 0.5 + 0.5 * k, 'pulse')
        ev.append((D - 1.0, 'ascension', -9, 1.2))
        return sorted(ev)
