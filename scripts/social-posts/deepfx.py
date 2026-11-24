"""Siphem-Show: der Tiefsee-Dämon, befallen von etwas Unbeschreiblichem. Die Tiefsee rührt sich: Menschen am Strand verschwinden, eine unheimliche Lichtsäule steht über dem Meer, und die Albtraum-Kreaturen
morphen ineinander. Jedes Mal, wenn Karten von seiner Seite zurück auf die Hand gehen (hier: ein Deepsea-Wesen ersetzt das andere im selben Platz), bekommt Siphem einen Deepsea Counter. Einmal pro Zug gibt er
beliebig viele ab und schlägt mit 50 Schaden je Counter zu.
Der rote Orbitallaser (`orbital_laser_red`, app-fx-14: Ladekugel, Strahl, Einschlagblitz, Glutfunken) und der Kartenzug (Zug, gamefx.py) sind Nachbauten der echten Spiel-Animationen. Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

TEAL = (60, 190, 190)
TEAL_D = (20, 80, 95)
INK = (8, 22, 32)
RED = (254, 81, 84)
LASER_KERN = [(249, 179, 179), (254, 116, 118), (233, 47, 56), (192, 20, 28), (140, 0, 20)]
LASER_RAND = [(254, 81, 84), (192, 20, 28), (91, 1, 2)]
LASER_BLITZ = [(192, 20, 28), (254, 81, 84), (250, 229, 235), (255, 255, 255)]
LASER_KUGEL = dict(schein=(192, 20, 28), rand=(120, 0, 20), mitte=(240, 50, 50), licht=(240, 191, 188))
ORB = ['.ccc.', 'cwwwc', 'cwbwc', 'cwwwc', '.ccc.']
ORB_COL = {'c': (60, 190, 190), 'w': (190, 245, 240), 'b': (20, 80, 95)}


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class DeepShow(CaptionMixin):
    CAP_SCALE = 5
    CW, CH = 180, 252
    SMALL = (120, 168)
    SLOT_X = [330, 540, 750]
    SLOT_Y = 1752
    HAND = (110, 1752)
    OPP = (925, 900)                                                                  # Gegner-Held (Heragas)
    OW, OH = 150, 210
    HP0 = 450
    # Erstes Auftauchen: (Zeit, Slot, Karte)
    CREATURES = ['zombie', 'skeleton', 'stein', 'mummy', 'werewolf', 'siren']
    CARD_OF = {k: i for i, k in enumerate(CREATURES)}                                 # Kartenbild je Wesen (für den Flug auf die Hand)
    CPX = 5                                                                           # Pixelgröße der Kreatur-Sprites
    SLOTW, SLOTH, SLOT_FOOT = 320, 320, 1868
    INIT = [(1.0, 0, 'zombie'), (1.4, 1, 'skeleton'), (1.8, 2, 'stein')]
    # Morphs: (Zeit, Slot, von, nach) - das alte Wesen geht auf die Hand, Siphem bekommt 1 Counter
    MORPH = [(8.0, 0, 'zombie', 'mummy'), (9.2, 1, 'skeleton', 'werewolf'), (10.4, 2, 'stein', 'siren'), (11.6, 0, 'mummy', 'zombie'),
             (15.4, 1, 'werewolf', 'skeleton'), (16.6, 2, 'siren', 'stein'), (17.8, 0, 'zombie', 'mummy')]
    FIRE = [(14.0, 4, 200), (19.2, 3, 150)]                                           # (Start, verbrauchte Counter, Schaden)
    VANISH = [3.6, 4.8, 6.0]                                                          # Strandgänger verschwinden
    BEACH = [('kit', 400), ('codumbus', 540), ('kent', 680)]
    BPX = 4
    HEIGHT = {'kit': 33, 'codumbus': 33, 'kent': 33}
    CAPTIONS = [
        (0.2, 3.0, '*Siphem*, the Deepsea Demon, awakens.'),
        (3.2, 7.4, 'People vanish at the shore - and a *strange light* rises from the sea.'),
        (7.6, 12.4, 'Deepsea creatures *morph* into each other - each swap gives a *Counter*.'),
        (12.6, 18.0, 'Spend the Counters: *50 damage each*, in a single blow.'),
        (18.2, 22.2, 'Something unspeakable has *claimed him*.'),
        (22.4, 25.7, 'The deep *stirs*...'),
    ]
    SND = {
        'ink':    [('pull_circle', -10), ('placement', -8)],
        'morph':  [('debuff', -9), ('pull_swell', -12)],
        'fly':    [('booster_card_whoosh', -9)],
        'counter': [('buff', -8)],
        'laser':  [('orbital_laser', -5)],
        'hit':    [('heavy_impact', -3), ('damage', -6)],
        'vanish': [('pull_circle', -8), ('elem_dark', -10)],
        'pillar': [('booster_buildup', -12)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self.actor_fn = geom['actor_fn']
        self.per = geom['per']
        self.fms, self.fn = geom['frame_ms'], geom['frame_n']
        self._cache = {}
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        self.faces = [ld('c%d' % (i + 1)).resize((self.CW, self.CH), Image.BOX) for i in range(6)]
        self.smalls = [ld('c%d' % (i + 1)).resize(self.SMALL, Image.BOX) for i in range(6)]
        self.opp = ld('c7').resize((self.OW, self.OH), Image.BOX)
        self.back = None
        self.MORPH_T = 0.8                                                            # Dauer des Morphens
        self.FLY_T = 0.5
        self.t_counter = [m[0] + self.MORPH_T * 0.5 + 0.5 for m in self.MORPH]       # das alte Wesen landet in der Hand
        self.t_imp = [f[0] + 0.54 for f in self.FIRE]
        self.FLASHES = (0.0,)
        self.SHOCKS = (0.0,) + tuple(self.t_imp)
        self.TENSION_SHAKES = [(0.0, 5)] + [(m[0] + 0.3, 5) for m in self.MORPH] + [(t, 10) for t in self.t_imp] + [(t, 4) for t in self.VANISH]
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

    def _sprite_img(self, key, t):
        """Animiertes Kreatur-Sprite (Umriss wie bei den Helden), Füße unten mittig auf einer festen Fläche SLOTW × SLOTH."""
        idx = int(t * 1000.0 / self.fms[key]) % self.fn[key]
        k = ('sp', key, idx)
        if k not in self._cache:
            im, pad, cxf, foot = self.actor_fn(key, idx)
            c = Image.new('RGBA', (self.SLOTW, self.SLOTH), (0, 0, 0, 0))
            px = self.CPX
            x0 = int(round((self.SLOTW / 2 - cxf * px - pad) / self.U) * self.U)
            y0 = int(round((self.SLOTH - 8 - foot * px - pad) / self.U) * self.U)
            c.paste(im, (x0, y0), im)
            self._cache[k] = c
        return self._cache[k], idx

    def _morph(self, a_k, b_k, u, t):
        """Das eine Wesen verläuft ins andere (beide animiert): Bayer-Mischung, dazu waagerechte Streifen, die seitlich verrutschen (Glitch), Farbversatz."""
        q = int(u * 14)
        A, ia = self._sprite_img(a_k, t)
        B, ib = self._sprite_img(b_k, t)
        k = ('mo', a_k, b_k, q, ia, ib)
        if k not in self._cache:
            U = self.U
            a_, b_ = np.asarray(A), np.asarray(B)
            h, w = a_.shape[:2]
            yy, xx = np.mgrid[0:h, 0:w]
            thr = np.array(gamefx.BAY8)[((yy // U) % 8), ((xx // U) % 8)] / 64.0
            uu = q / 14.0
            out = np.where((thr < uu)[..., None], b_, a_).copy()
            amp = math.sin(math.pi * uu)
            band = 14
            for by in range(0, h, band):
                sh = int(round((gamefx.H(len(a_k) * 7 + len(b_k), by + q) - 0.5) * 2 * 26 * amp / U)) * U
                if sh:
                    out[by:by + band] = np.roll(out[by:by + band], sh, axis=1)
            self._cache[k] = Image.fromarray(out, 'RGBA')
        return self._cache[k]

    def counters(self, t):
        n = sum(1 for tc in self.t_counter if t >= tc)
        for (tf, k, dmg), ti in zip(self.FIRE, self.t_imp):
            if t >= ti:
                n -= k
        return max(0, n)

    def opp_hp(self, t):
        h = self.HP0
        for (tf, k, dmg), ti in zip(self.FIRE, self.t_imp):
            if t >= ti + 0.3:
                h -= dmg
        return h

    def hand_n(self, t):
        return 2 + sum(1 for tc in self.t_counter if t >= tc)

    def n_missing(self, t):
        return sum(1 for v in self.VANISH if t >= v + 0.3)

    # ───────── Hintergrund: Tiefsee, Tentakel, Lichtsäule ─────────
    def _tentacle(self, g, base_x, side, salt, t, grow):
        """Ein Pixel-Tentakel steigt vom unteren Rand auf: dunkler Körper, helle Kante, Saugnäpfe."""
        gp = self.gp
        n = 46
        L = (34 + 30 * gamefx.H(salt, 3)) * grow
        bx = (base_x - self.ox) / gp
        by = (self.H + 20 - self.oy) / gp
        px_, py_ = bx, by
        for i in range(n):
            s = i / float(n)
            if s * 1.0 > grow:
                break
            ang = -math.pi / 2 + side * (0.25 + 0.5 * s) + 0.5 * math.sin(s * 5 + t * 1.2 + salt) * (0.4 + s)
            seg = L / n * 1.4
            px_ += math.cos(ang) * seg
            py_ += math.sin(ang) * seg
            r = max(1.0, 6.5 * (1 - s) + 1.0)
            g.disc(px_, py_, r + 1, (6, 30, 40), 1.0)                                  # dunkle Kontur
            g.disc(px_, py_, r, (28, 84, 98), 1.0)
            g.disc(px_ + side * r * 0.2, py_ - r * 0.1, r * 0.6, (44, 118, 130), 1.0)
            g.put(px_ - r * 0.6, py_ - r * 0.5, (110, 210, 205), 0.9)
            if i % 3 == 1:                                                            # Saugnäpfe
                g.disc(px_ - side * r * 0.4, py_ + r * 0.2, 1, (190, 250, 240), 1.0)

    def _beam_thin(self, g, x_cell, y0, y1, a, t):
        for Y in range(int(y0), int(y1)):
            f = (Y - y0) / max(1.0, (y1 - y0))
            ri = 0 if f < 0.4 else 1 if f < 0.75 else 2
            ki = 0 if f < 0.3 else 2 if f < 0.7 else 3
            flick = 0.85 + 0.15 * math.sin(t * 9 + Y * 0.3)
            g.block(x_cell - 3, Y, 7, 1, LASER_RAND[ri], a * 0.3 * flick)
            g.block(x_cell - 1, Y, 3, 1, LASER_RAND[ri], a * 0.5 * flick)
            g.put(x_cell, Y, LASER_KERN[ki], a * flick)

    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        gp = self.gp
        # Wellenbänder (tintenschwarz, petrol)
        y0 = 1440
        cols = [(10, 36, 48), (14, 60, 72), (6, 20, 30)]
        for r in range(0, (self.H - y0) // 30 + 1):
            y = y0 + r * 30
            depth = r / float((self.H - y0) / 30.0)
            for k in range(6):
                x = (k * 73 + r * 41 + t * (12 + r * 3)) % (self.W + 160) - 80
                ln = 6 + (k + r) % 6
                cx, cy = self._ci(x, y + 8 * math.sin(t * 0.8 + k + r))
                for i in range(ln):
                    g.put(cx + i, cy, cols[(k + r) % 3], 0.3 + 0.25 * depth)
        for k in range(16):                                                           # Blasen steigen auf
            u = (t * 0.22 + k * 0.137) % 1.0
            x = 40 + (k * 211) % 1000
            sx, sy = self._ci(x + 12 * math.sin(t * 1.6 + k), self.H - u * 700)
            if int(t * 6 + k) % 4:
                g.disc(sx, sy, 1 + (k % 2), (120, 220, 215), 0.5 * (1 - u))
        # Tentakel an den Rändern, wachsen mit der Zeit
        grow = min(1.0, 0.5 + t / 24.0)
        for i, (bx, side) in enumerate([(30, 1), (120, 1), (1050, -1), (960, -1), (230, 1), (860, -1)]):
            self._tentacle(g, bx, side, 5 + i * 3, t, grow * (0.55 + 0.1 * (i % 3)))
        # unheimliche Lichtsäule über dem Meer (links), wächst ab 5,0 s
        if t >= 5.0:
            u = smooth((t - 5.0) / 1.6)
            xc = (150 - self.ox) / gp
            top = (1440 - u * 1300 - self.oy) / gp
            self._beam_thin(g, xc, top, (1480 - self.oy) / gp, 0.6 + 0.3 * math.sin(t * 2.3), t)

    # ───────── Orbitallaser (app-fx-14) ─────────
    def _laser(self, m, tau, key):
        """Rote Ladekugel oben, Strahl von oben aufs Ziel, Einschlagblitz, Glutfunken; tau in Sekunden seit Start."""
        if tau < 0 or tau > 1.0:
            return
        g = gamefx.R1(m)
        gp = self.gp
        cx, cy = self._ci(*self.OPP)
        y_top = int((20 - self.oy) / gp)
        ms = tau * 1000.0
        bu = (ms - 260) / 520.0
        if 0 <= bu <= 1:
            L = cy - y_top + 3
            frac = (bu / 0.25) ** 0.7 if bu < 0.25 else 1.0
            op = (bu / 0.25) if bu < 0.25 else (1.0 if bu < 0.75 else 1 - (bu - 0.75) / 0.25)
            op = max(0.0, min(1.0, op)) * (0.95 if bu >= 0.25 else 1.0)
            for Y in range(y_top, int(y_top + L * frac)):
                f = (Y - y_top) / float(max(1, L))
                ki = 0 if f < 0.1 else 1 if f < 0.3 else 2 if f < 0.6 else 3 if f < 0.85 else 4
                ri = 0 if f < 0.4 else 1 if f < 0.75 else 2
                g.block(cx - 5, Y, 11, 1, LASER_RAND[ri], op * 0.35)
                g.block(cx - 3, Y, 7, 1, LASER_RAND[ri], op * 0.35)
                g.block(cx - 1, Y, 3, 1, LASER_KERN[ki], op)
                g.put(cx, Y, LASER_KERN[max(0, ki - 1)], op)
        ku = ms / 260.0
        kr = 5 * (0.3 + 0.95 * smooth(ku / 0.6) if ku < 0.6 else (1.25 - 0.25 * (ku - 0.6) / 0.4 if ku < 1 else 1.0))
        ka = (min(1.0, ku / 0.6) if ku < 1 else 0.95) * (1.0 if ms <= 780 else max(0.0, 1 - (ms - 780) / 120.0))
        if ka > 0.04:
            ky = y_top + 1
            g.disc(cx, ky, kr + 2, LASER_KUGEL['schein'], ka * 0.4)
            g.disc(cx, ky, kr, LASER_KUGEL['rand'], ka)
            g.disc(cx, ky, kr * 0.75, LASER_KUGEL['mitte'], ka)
            g.disc(cx - kr * 0.25, ky - kr * 0.25, max(1, kr * 0.3), LASER_KUGEL['licht'], ka)
        iu = (ms - 540) / 460.0
        if 0 <= iu <= 1:
            sc = 0.35 + 0.85 * smooth(iu / 0.25) if iu < 0.25 else (1.2 + 0.35 * (iu - 0.25) / 0.35 if iu < 0.6 else 1.55 + 0.35 * (iu - 0.6) / 0.4)
            a = (iu / 0.25) if iu < 0.25 else (1 - 0.25 * (iu - 0.25) / 0.35 if iu < 0.6 else 0.75 * (1 - (iu - 0.6) / 0.4))
            R = 9.0 * sc
            for j in range(-int(R) - 1, int(R) + 2):
                for i in range(-int(R) - 1, int(R) + 2):
                    d = math.hypot(i, j) / R
                    if d <= 1:
                        ci = 3 if d < 0.25 else 2 if d < 0.5 else 1 if d < 0.8 else 0
                        g.put(cx + i, cy + j, LASER_BLITZ[ci], min(1.0, a * (1.2 - d)))
        for i in range(14):
            delay = 0.26 + 0.14 * gamefx.H(key, i * 4 + 1)
            dur = 0.42 + 0.24 * gamefx.H(key, i * 4 + 2)
            k = (tau - delay) / dur
            if 0 <= k <= 1:
                ang = gamefx.H(key, i * 4 + 3) * 6.283
                dist = 12 + 22 * gamefx.H(key, i * 4 + 4)
                e = 1 - (1 - k) ** 3
                a = (k / 0.25) if k < 0.25 else 1 - ((k - 0.25) / 0.75) ** 0.5
                n = max(1, int(round((2 + 3 * gamefx.H(key, i * 4 + 5)) * (1 - 0.8 * e))))
                g.block(cx + math.cos(ang) * dist * e - n / 2, cy + math.sin(ang) * dist * e - n / 2, n, n, [(250, 229, 235), (240, 50, 50), (240, 50, 50)][i % 3], max(0.0, a))

    # ───────── Karten, Hand, Gegner ─────────
    def _small(self):
        if self.back is None:
            cb = Image.open(self.g['cardback_path']).convert('RGB')
            U = self.U
            wu, hu = self.SMALL[0] // U, self.SMALL[1] // U
            inner = cb.resize((wu - 2, hu - 3), Image.BOX).convert('RGBA')
            c = Image.new('RGBA', (wu, hu), (60, 190, 190, 255))
            c.paste(inner, (1, 1))
            self.back = c.resize((wu * U, hu * U), Image.NEAREST)
        return self.back

    def _slot_card(self, k, t):
        """(Kartenbild, Phase) im Platz k zur Zeit t; None, wenn noch leer."""
        cur = None
        for (ti, sl, ci) in self.INIT:
            if sl == k and t >= ti:
                cur = ('card', ci, ti)
        if cur is None:
            return None
        ci = cur[1]
        for (tm, sl, a, b) in self.MORPH:
            if sl != k:
                continue
            if t >= tm + self.MORPH_T:
                ci = b
            elif t >= tm:
                return ('morph', a, b, (t - tm) / self.MORPH_T)
        return ('card', ci, cur[2])

    def _draw_cards(self, canvas, d, t):
        gp, U = self.gp, self.U
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        g = gamefx.R1(m)
        small = self._small()
        for k in range(self.hand_n(t)):
            canvas.paste(small, (int(self.HAND[0] - small.width / 2 + 7 * (k % 8)), int(self.HAND[1] - small.height / 2 - 9 * (k % 8))), small)
        self.draw_text(canvas, 'HAND', 3, (self.HAND[0] + 10, self.HAND[1] - 118), color=(255, 255, 255), outline=None, shadow=(10, 20, 30))
        for k, x in enumerate(self.SLOT_X):
            st = self._slot_card(k, t)
            if st is None:
                continue
            ox0, oy0 = int(round((x - self.SLOTW / 2) / U) * U), self.SLOT_FOOT - self.SLOTH
            # Tintenlache unter den Füßen
            cxs, cys = self._ci(x, self.SLOT_FOOT - 6)
            for j in range(-3, 4):
                for i in range(-12, 13):
                    if (i / 12.0) ** 2 + (j / 3.0) ** 2 <= 1:
                        g.put(cxs + i, cys + j, INK if (i + j) % 2 else (14, 60, 72), 0.9)
            if st[0] == 'card':
                key, t0 = st[1], st[2]
                im, _ = self._sprite_img(key, t)
                name = key
                for (ti, sl, c0) in self.INIT:
                    if sl == k and 0 <= t - ti < 0.7:                                  # erstes Auftauchen: Dither-Einblendung mit Tintenring
                        im = self._dissolve(im, 1.0 - (t - ti) / 0.7, ('init', c0, int(t * 1000.0 / self.fms[c0]) % self.fn[c0], int((t - ti) * 16)))
                        for i, col in enumerate([(120, 220, 215), TEAL, TEAL_D]):
                            r = gamefx.rd(gamefx.ease(max(0.0, t - ti - 0.07 * i) / 0.7) * 11)
                            if r > 0:
                                g.ring(cxs, cys, max(0, r - 1), r, col, 1.0)
            else:
                _, a, b, u = st
                im = self._morph(a, b, u, t)
                name = a if u < 0.5 else b
            canvas.paste(im, (ox0, oy0), im)
            self.draw_text(canvas, name.upper(), 3, (x, 1640), color=(190, 245, 240), outline=None, shadow=(6, 24, 32))
        # alte Wesen fliegen auf die Hand
        for i, (tm, sl, a, b) in enumerate(self.MORPH):
            ts = tm + self.MORPH_T * 0.5
            key = ('zug', i)
            if key not in self._cache:
                self._cache[key] = gamefx.Zug(self._cp(self.SLOT_X[sl], self.SLOT_Y), self._cp(self.HAND[0], self.HAND[1] - 30), dauer=self.FLY_T, cw=self.SMALL[0] / float(gp), bogen=-180 / gp, salt=40 + i,
                                              farbe=gamefx.hexc('#78dcd7'))
            z = self._cache[key]
            dt = t - ts
            if 0 <= dt < z.ende:
                z.draw(m, dt)
                if dt < z.dauer:
                    px, py = z.pos(dt)
                    self._card_at(canvas, self.smalls[self.CARD_OF[a]], px * gp + self.ox, py * gp + self.oy)
        # Gegner (Heragas)
        if t >= 12.6:
            u = min(1.0, (t - 12.6) / 0.6)
            im = self._dissolve(self.opp, 1.0 - u, ('opp',)) if u < 1 else self.opp
            dx = 0
            for ti in self.t_imp:
                if 0 <= t - ti < 0.5:
                    dx = 8 if int(t * 30) % 2 else -8
            self._card_at(canvas, im, self.OPP[0] + dx, self.OPP[1])
            self.draw_text(canvas, 'OPPONENT', 3, (self.OPP[0], self.OPP[1] - 124), color=(255, 140, 140), outline=None, shadow=(20, 10, 30))
            hot = any(0 <= t - ti - 0.3 < 0.5 and int(t * 15) % 2 == 0 for ti in self.t_imp)
            self.draw_text(canvas, '%d HP' % self.opp_hp(t), 3, (self.OPP[0], self.OPP[1] + 128), color=(255, 255, 255) if hot else GOLD, outline=None, shadow=(60, 30, 0))
        # Laser
        for i, (tf, k, dmg) in enumerate(self.FIRE):
            self._laser(m, t - tf, 200 + i)
            tau = t - (self.t_imp[i] + 0.1)
            if 0 <= tau < 1.0:
                self.draw_text(canvas, '-%d' % dmg, 9, (self.OPP[0] - 190, self.OPP[1] - 20 - 80 * smooth(tau / 1.0)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)

    # ───────── Strandgänger (Sprites oben) ─────────
    def _draw_beach(self, canvas, d, t):
        U = self.U
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        if t < 0.4:
            return
        self.draw_text(canvas, 'SHORE', 3, (540, 58), color=(255, 255, 255), outline=None, shadow=(10, 20, 30))
        for i, (key, x) in enumerate(self.BEACH):
            tv = self.VANISH[i]
            idx = int(t * 1000.0 / 90)
            im, pad, cxf, foot = self.actor_fn(key, idx)
            px = self.BPX
            x0 = int(round((x - cxf * px - pad) / U) * U)
            y0 = int(round((215 - foot * px - pad) / U) * U)
            if t < tv:
                canvas.paste(im, (x0, y0), im)
            elif t < tv + 0.9:
                u = (t - tv) / 0.9
                canvas.paste(self._dissolve(im, u, ('bv', key, idx % 48, int(u * 16))), (x0, y0), self._dissolve(im, u, ('bv', key, idx % 48, int(u * 16))))
                cxs, cys = self._ci(x, 215)
                for q, col in enumerate([(120, 220, 215), TEAL, INK]):
                    r = gamefx.rd(gamefx.ease(max(0.0, (t - tv) - 0.08 * q) / 0.8) * 9)
                    if r > 0:
                        g.ring(cxs, cys, max(0, r - 1), r, col, 1.0)
            # Sandstrich unter den Füßen
            if t < tv + 0.9:
                self.pix_rect(d, x - 60, 217, x + 60, 223, (170, 140, 90))
                self.pix_rect(d, x - 60, 224, x + 60, 228, (110, 90, 60))

    # ───────── Zähler ─────────
    def _draw_hud(self, canvas, d, t):
        n = self.counters(t)
        self.draw_text(canvas, 'COUNTERS', 3, (140, 74), color=(255, 255, 255), outline=None, shadow=(10, 20, 30))
        hot = any(0 <= t - tc < 0.45 and int(t * 15) % 2 == 0 for tc in self.t_counter)
        for j, row in enumerate(ORB):
            for i, ch in enumerate(row):
                if ch != '.':
                    self.pix_rect(d, 66 + i * 7, 112 + j * 7, 66 + i * 7 + 6, 112 + j * 7 + 6, ORB_COL[ch])
        self.draw_text(canvas, str(n), 9, (160, 140), color=(255, 255, 255) if hot else TEAL, outline=None, shadow=(10, 50, 60))
        self.draw_text(canvas, 'MISSING', 3, (940, 74), color=(255, 255, 255), outline=None, shadow=(10, 20, 30))
        self.draw_text(canvas, str(self.n_missing(t)), 9, (950, 140), color=RED, outline=None, shadow=(70, 10, 20))

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_beach(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_cards(canvas, d, t)
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
        for ti in self.t_imp:
            if 0 <= t - ti < 0.25:
                fl = max(fl, 0.3 * math.exp(-(t - ti) / 0.08))
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
                e = (t, item[0], item[1])
                if rate and item[0] == 'buff':
                    e = e + (rate,)
                ev.append(e)
        for (ti, sl, ci) in self.INIT:
            add(ti, 'ink')
        for i, (tm, sl, a, b) in enumerate(self.MORPH):
            add(tm, 'morph'); add(tm + self.MORPH_T * 0.5, 'fly'); add(self.t_counter[i], 'counter', 0.85 + 0.07 * (i % 5))
        for tf in [f[0] for f in self.FIRE]:
            add(tf, 'laser')
        for ti in self.t_imp:
            add(ti, 'hit')
        for tv in self.VANISH:
            add(tv, 'vanish')
        add(5.0, 'pillar')
        return sorted(ev)
