"""Crestina-Show: die Schöpfungsgöttin des Kosmos. Sie hat die Fairies erschaffen (Luna, Tempeste, Maya, Thalia, Jenny), ihr oberstes Gebot ist „Habt Freude am Leben“. Im Spiel verzichtet sie in der Resource Phase
aufs Ziehen und lässt 3 verschiedene Karten von außerhalb des Spiels materialisieren: der Gegner wählt eine für ihre Hand, die anderen zwei werden aus dem Spiel entfernt, ihre Namen sind gesperrt.
Die Fairy-Sprites sind die echten Held-Sprites; Kartenzug (Zug), Schockringe und Funken sind Nachbauten der echten Spiel-Animationen (gamefx.py). Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

PINK = (255, 150, 210)
CREAM = (255, 244, 200)
LILAC = (200, 160, 255)
HEART = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...']
STAR = ['..Y..', '.YWY.', 'YWWWY', '.YWY.', '..Y..']


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class CreaShow(CaptionMixin):
    CW, CH = 180, 252
    SMALL = (120, 168)
    SLOT_X = [330, 540, 750]
    SLOT_Y = 1752
    HAND = (110, 1752)
    DECK = (975, 1752)
    EN = (925, 500)
    EW, EH = 150, 210
    HERO = (540, 700)
    # Fairies: (Schlüssel, Name, x, Standlinie y, Auftritt)
    FAIRIES = [('luna', 'LUNA', 115, 740, 1.0), ('tempeste', 'TEMPESTE', 965, 960, 1.8), ('maya', 'MAYA', 115, 1000, 2.6), ('thalia', 'THALIA', 145, 1420, 3.4), ('jenny', 'JENNY', 965, 1430, 4.2)]
    FMS = {'thalia': 80}                                                              # Bildzeit der Sheets (Standard 90 ms)
    FPX = 6
    # Runden: Resource Phase, drei Karten (Index in c1…c6), Auswahl des Gegners
    TURNS = [dict(T0=11.8, cards=[0, 1, 2], pick=1, mat=[12.4, 12.8, 13.2], hover=14.4, t_pick=16.4, t_fly=17.0, t_gone=17.6, t_lock=18.0),
             dict(T0=19.0, cards=[3, 4, 5], pick=1, mat=[19.4, 19.7, 20.0], hover=20.5, t_pick=21.6, t_fly=22.0, t_gone=22.6, t_lock=23.0)]
    CAPTIONS = [
        (0.2, 3.0, '*Fairy Queen Crestina*, the Creation Fairy.'),
        (3.2, 7.2, 'Goddess of the cosmos - she *created* the *Fairies*.'),
        (7.4, 11.4, 'Her one commandment - *enjoy life*!'),
        (11.6, 16.6, 'In her Resource Phase she may *skip her draw* - and *create* 3 cards from *outside the game*.'),
        (16.8, 21.6, 'The enemy picks *1 of 3* - the other two *vanish*, and their *names are locked*.'),
        (21.8, 25.7, 'Any card at all - the *Creation Fairy* provides.'),
    ]
    SND = {
        'create': [('booster_glitter', -8), ('pull_sparkle', -10)],
        'fairy':  [('summon', -8), ('heal', -11)],
        'turn':   [('turn_start', -10)],
        'pick':   [('ping', -8), ('ui_click', -12)],
        'whoosh': [('booster_card_whoosh', -8)],
        'land':   [('placement', -8)],
        'vanish': [('discard', -8), ('pull_shatter', -12)],
        'lock':   [('chain_add', -9)],
        'love':   [('buff', -12)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self.actor_fn = geom['actor_fn']
        self.per = geom['per']
        self._cache = {}
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        self.faces = [ld('c%d' % (i + 1)).resize((self.CW, self.CH), Image.BOX) for i in range(6)]
        self.smalls = [ld('c%d' % (i + 1)).resize(self.SMALL, Image.BOX) for i in range(6)]
        self.enemy = ld('enemy').resize((self.EW, self.EH), Image.BOX)
        self.back = None
        for t in self.TURNS:
            t['land'] = t['t_fly'] + 0.5
        self.FLASHES = (0.0,)
        self.SHOCKS = (0.0,)
        self.TENSION_SHAKES = [(0.0, 5)] + [(f[4], 4) for f in self.FAIRIES] + [(t['land'], 5) for t in self.TURNS]
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

    def hand_n(self, t):
        return 2 + sum(1 for T in self.TURNS if t >= T['land'])

    def locked(self, t):
        return 3 * sum(1 for T in self.TURNS if t >= T['t_lock'])

    # ───────── Hintergrund: Schöpfungslicht, Sterne ─────────
    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        cx, cy = self._ci(self.HERO[0], self.HERO[1] + 40)
        rot = math.floor(t * 30) / 30.0 * 0.12
        n = 16
        for k in range(n):
            a0 = rot + k * 2 * math.pi / n
            col = CREAM if k % 2 == 0 else PINK
            al = 0.34 if k % 2 == 0 else 0.26
            for r in range(10, 90):
                w = 0.07 * (1 + r / 30.0)
                for dth in (-w, 0.0, w):
                    x = cx + math.cos(a0 + dth) * r
                    y = cy + math.sin(a0 + dth) * r * 1.15
                    g.put(x, y, col, al * (1 - r / 90.0) + 0.05)
        for k in range(34):                                                           # Sterne funkeln
            x = 30 + (k * 331) % 1020
            y = 150 + (k * 577) % 1650
            ph = (t * 1.3 + k * 0.37) % 1.0
            if ph < 0.5:
                sx, sy = self._ci(x, y)
                big = ph < 0.18
                g.put(sx, sy, (255, 255, 255), 1.0)
                if big:
                    for (i, j) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        g.put(sx + i, sy + j, CREAM, 0.9)

    # ───────── Materialisieren: Lichtsäule + Ring + Sterne ─────────
    def _beam(self, canvas, m, x, y_base, y_top, tau, w_cells, key):
        """Eine Lichtsäule fällt auf den Boden bei y_base, dort Ring und aufsteigende Sterne (tau in s)."""
        if tau < 0 or tau > 1.5:
            return
        g = gamefx.R1(m)
        cx = (x - self.ox) / self.gp
        ytop = (y_top - self.oy) / self.gp
        yb = (y_base - self.oy) / self.gp
        if tau < 0.9:
            u = tau / 0.9
            wid = w_cells * (1 - u) ** 0.8 * (0.6 + 0.4 * math.sin(u * math.pi))
            a = 0.9 * (1 - u * 0.6)
            for yy in range(int(ytop), int(yb) + 1):
                for i in range(-int(wid), int(wid) + 1):
                    d = abs(i) / max(0.5, wid)
                    g.put(cx + i, yy, CREAM if d < 0.5 else PINK if d < 0.85 else LILAC, a * (1 - d * 0.5))
        for i, col in enumerate([(255, 255, 255), CREAM, PINK]):
            r = gamefx.rd(gamefx.ease(max(0.0, tau - 0.07 * i) / 0.8) * w_cells * 1.8)
            if r > 0 and tau < 0.9:
                g.ring(cx, yb, max(0, r - 1), r, col, 1.0)
        for k in range(14):
            u = (tau - 0.05 * (k % 6)) / 1.0
            if 0 < u < 1:
                px = cx + (gamefx.H(key, k * 3 + 1) - 0.5) * w_cells * 2.6
                py = yb - u * (6 + 12 * gamefx.H(key, k * 3 + 2)) * 1.2
                if int(u * 20 + k) % 2 == 0:
                    g.put(px, py, (255, 255, 255), 1.0)
                    g.put(px + 1, py, CREAM, 0.8); g.put(px - 1, py, CREAM, 0.8)

    # ───────── Fairies ─────────
    def _draw_fairies(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        px = self.FPX
        U = self.U
        for j, (key, name, x, foot, t0) in enumerate(self.FAIRIES):
            if t < t0:
                continue
            tau = t - t0
            self._beam(canvas, m, x, foot, foot - 420, tau, 4, 50 + j)
            if tau < 0.35:
                continue
            idx = int(t * 1000.0 / self.FMS.get(key, 90))
            im, pad, cxf, ft = self.actor_fn(key, idx)
            bob = int(round(6 * math.sin(t * 2.2 + j) / U)) * U
            x0 = int(round((x - cxf * px - pad) / U) * U)
            y0 = int(round((foot - ft * px - pad + bob) / U) * U)
            u = smooth((tau - 0.35) / 0.4)
            if u < 1:
                im = self._dissolve(im, 1.0 - u, ('fa', key, idx % 48, int(u * 16)))
            canvas.paste(im, (x0, y0), im)
            if tau > 0.8:
                self.draw_text(canvas, name, 2, (x, foot + 24), color=CREAM, outline=None, shadow=(60, 20, 80))
        # Herzen beim Gebot „Habt Freude am Leben“
        if 7.4 <= t < 11.8:
            for j, (key, name, x, foot, t0) in enumerate(self.FAIRIES):
                for k in range(4):
                    ts = 7.5 + k * 0.7 + j * 0.17
                    u = (t - ts) / 1.4
                    if 0 <= u < 1:
                        hx = x + 40 * math.sin(u * 5 + j + k) + (k % 2) * 36 - 18
                        hy = foot - 230 - 170 * u
                        if u > 0.7 and int(t * 20) % 2:
                            continue
                        for jj, row in enumerate(HEART):
                            for ii, ch in enumerate(row):
                                if ch == 'r':
                                    self.pix_rect(d, hx + (ii - 3) * 6, hy + (jj - 3) * 6, hx + (ii - 3) * 6 + 5, hy + (jj - 3) * 6 + 5, PINK if (ii + jj) % 3 else (255, 220, 240))

    # ───────── Runden: Materialisieren, Wahl des Gegners ─────────
    def _small(self):
        if self.back is None:
            cb = Image.open(self.g['cardback_path']).convert('RGB')
            U = self.U
            wu, hu = self.SMALL[0] // U, self.SMALL[1] // U
            inner = cb.resize((wu - 2, hu - 3), Image.BOX).convert('RGBA')
            c = Image.new('RGBA', (wu, hu), (200, 150, 255, 255))
            c.paste(inner, (1, 1))
            self.back = c.resize((wu * U, hu * U), Image.NEAREST)
        return self.back

    def _zug(self, key, A, B, salt, farbe):
        if key not in self._cache:
            self._cache[key] = gamefx.Zug(self._cp(*A), self._cp(*B), dauer=0.5, cw=self.SMALL[0] / float(self.gp), bogen=-200 / self.gp, salt=salt, farbe=gamefx.hexc(farbe))
        return self._cache[key]

    def _draw_turns(self, canvas, d, t):
        gp = self.gp
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        gr = gamefx.R1(m)
        small = self._small()
        # Stapel: Deck rechts, Hand links
        for k in range(4):
            canvas.paste(small, (int(self.DECK[0] - small.width / 2 + 4 * k), int(self.DECK[1] - small.height / 2 - 4 * k)), small)
        for k in range(self.hand_n(t)):
            canvas.paste(small, (int(self.HAND[0] - small.width / 2 + 7 * (k % 8)), int(self.HAND[1] - small.height / 2 - 9 * (k % 8))), small)
        resource_on = any(T['T0'] <= t < T['T0'] + 1.8 for T in self.TURNS)
        self.draw_text(canvas, 'HAND', 2, (self.HAND[0] + 10, self.HAND[1] - 112), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        if resource_on:
            self.draw_text(canvas, 'NO DRAW', 2, (self.DECK[0], self.DECK[1] - 112), color=(255, 90, 100), outline=None, shadow=(20, 10, 30))
            self.pix_rect(d, self.DECK[0] - 64, self.DECK[1] - 6, self.DECK[0] + 64, self.DECK[1] + 6, (255, 90, 100))
        else:
            self.draw_text(canvas, 'DECK', 2, (self.DECK[0], self.DECK[1] - 112), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        for ti, T in enumerate(self.TURNS):
            if T['T0'] <= t < T['T0'] + 1.8:
                if int(t * 6) % 2 == 0 or t >= T['T0'] + 0.5:
                    self.draw_text(canvas, 'RESOURCE PHASE', 3, (540, 1572), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
            if T['mat'][0] <= t < T['t_gone'] + 0.9 and not (t >= T['t_gone'] + 0.9):
                if t < T['t_pick']:
                    self.draw_text(canvas, 'FROM OUTSIDE THE GAME', 2, (540, 1574), color=LILAC, outline=None, shadow=(20, 10, 40))
            # Karten materialisieren
            for k in range(3):
                x = self.SLOT_X[k]
                tm = T['mat'][k]
                idx = T['cards'][k]
                chosen = (k == T['pick'])
                if t < tm:
                    continue
                self._beam(canvas, m, x, self.SLOT_Y + 100, self.SLOT_Y - 700, t - tm, 5, 10 + ti * 3 + k)
                if t < tm + 0.35:
                    continue
                im = self.faces[idx]
                u = smooth((t - tm - 0.35) / 0.4)
                if u < 1:
                    im = self._dissolve(im, 1.0 - u, ('cm', idx, int(u * 16)))
                if chosen and t >= T['t_fly']:
                    # fliegt zur Hand
                    z = self._zug(('fl', ti), (x, self.SLOT_Y), self.HAND, 30 + ti, '#ffe9a0')
                    dt = t - T['t_fly']
                    if 0 <= dt < z.ende:
                        z.draw(m, dt)
                        if dt < z.dauer:
                            px, py = z.pos(dt)
                            self._card_at(canvas, self.smalls[idx], px * gp + self.ox, py * gp + self.oy)
                    continue
                if (not chosen) and t >= T['t_gone']:
                    v = (t - T['t_gone']) / 0.8
                    if v >= 1:
                        continue
                    im = self._dissolve(self.faces[idx], v, ('gone', idx, int(v * 16)))
                    for q in range(8):                                                 # Funken beim Verschwinden
                        ang = gamefx.H(70 + k, q) * 6.28
                        r = v * (4 + 8 * gamefx.H(71 + k, q))
                        cxs, cys = self._ci(x, self.SLOT_Y)
                        if int(v * 20 + q) % 2 == 0:
                            gr.put(cxs + math.cos(ang) * r * 1.4, cys + math.sin(ang) * r, (255, 255, 255), 1.0)
                self._card_at(canvas, im, x, self.SLOT_Y)
                if t >= tm + 0.75 and t < T['t_pick']:
                    pass
                if (not chosen) and T['t_gone'] <= t < T['t_gone'] + 0.9 and int(t * 12) % 2 == 0:
                    self.draw_text(canvas, 'REMOVED', 2, (x, self.SLOT_Y - 146), color=(255, 120, 150), outline=None, shadow=(20, 10, 30))
            # Auswahl des Gegners: Rahmen springt von Karte zu Karte, rastet auf der gewählten ein
            if T['hover'] <= t < T['t_fly'] + 0.05:
                if t < T['t_pick']:
                    k = int((t - T['hover']) * 3.2) % 3
                    col = (255, 255, 255)
                else:
                    k = T['pick']
                    col = GOLD_HL if int(t * 15) % 2 == 0 else GOLD
                x = self.SLOT_X[k]
                if not (t >= T['t_fly']):
                    for o, th in ((0, 6),):
                        self.pix_rect(d, x - self.CW / 2 - 8, self.SLOT_Y - self.CH / 2 - 8, x + self.CW / 2 + 7, self.SLOT_Y - self.CH / 2 - 3, col)
                        self.pix_rect(d, x - self.CW / 2 - 8, self.SLOT_Y + self.CH / 2 + 3, x + self.CW / 2 + 7, self.SLOT_Y + self.CH / 2 + 8, col)
                        self.pix_rect(d, x - self.CW / 2 - 8, self.SLOT_Y - self.CH / 2 - 8, x - self.CW / 2 - 3, self.SLOT_Y + self.CH / 2 + 8, col)
                        self.pix_rect(d, x + self.CW / 2 + 3, self.SLOT_Y - self.CH / 2 - 8, x + self.CW / 2 + 8, self.SLOT_Y + self.CH / 2 + 8, col)
                if t >= T['t_pick']:
                    self.draw_text(canvas, 'CHOSEN', 3, (self.SLOT_X[T['pick']], self.SLOT_Y - 146), color=GOLD_HL, outline=None, shadow=(60, 30, 0))
                else:
                    self.draw_text(canvas, 'CHOOSING...', 2, (self.EN[0], self.EN[1] + 124), color=(255, 140, 140), outline=None, shadow=(20, 10, 30))
        # Ring um die Heldin bei jeder Landung
        for T in self.TURNS:
            tau = t - T['t_lock']
            if 0 <= tau < 0.9:
                c = self._ci(*self.HERO)
                for i, col in enumerate([(255, 255, 255), CREAM, PINK]):
                    r = gamefx.rd(gamefx.ease(max(0.0, tau - 0.08 * i) / 0.8) * 17)
                    if r > 0:
                        gr.ring(c[0], c[1], max(0, r - 2), r, col, 1.0)

    # ───────── Gegner ─────────
    def _draw_enemy(self, canvas, d, t):
        if t < self.TURNS[0]['T0']:
            return
        self._card_at(canvas, self.enemy, *self.EN)
        self.draw_text(canvas, 'ENEMY', 2, (self.EN[0], self.EN[1] - 118), color=(255, 140, 140), outline=None, shadow=(20, 10, 30))

    # ───────── Zähler ─────────
    def _draw_hud(self, canvas, d, t):
        self.draw_text(canvas, 'LOCKED NAMES', 3, (210, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        hot = any(0 <= t - T['t_lock'] < 0.5 and int(t * 15) % 2 == 0 for T in self.TURNS)
        self.draw_text(canvas, str(self.locked(t)), 9, (125, 140), color=(255, 255, 255) if hot else LILAC, outline=None, shadow=(50, 20, 90))
        self.draw_text(canvas, 'HAND', 3, (950, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        hot2 = any(0 <= t - T['land'] < 0.5 and int(t * 15) % 2 == 0 for T in self.TURNS)
        self.draw_text(canvas, str(self.hand_n(t)), 9, (950, 140), color=(255, 255, 255) if hot2 else GOLD, outline=None, shadow=(60, 30, 0))

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_fairies(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_enemy(canvas, d, t)
        self._draw_turns(canvas, ImageDraw.Draw(canvas), t)
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
        for (key, name, x, foot, t0) in self.FAIRIES:
            add(t0, 'create'); add(t0 + 0.4, 'fairy')
        add(7.5, 'love'); add(8.7, 'love'); add(9.9, 'love')
        for T in self.TURNS:
            add(T['T0'], 'turn')
            for tm in T['mat']:
                add(tm, 'create')
            add(T['t_pick'], 'pick'); add(T['t_fly'], 'whoosh'); add(T['land'], 'land')
            add(T['t_gone'], 'vanish'); add(T['t_lock'], 'lock')
        return sorted(ev)
