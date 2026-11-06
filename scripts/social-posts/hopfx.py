"""Hüpf-Show für „Ghuanjun, the Undead Martial Artist“: ein Jiang Shi, der nie stillsteht. Er springt ununterbrochen durchs Bild (Takt = 0,72 s, passend zum Theme)
und trifft mit 1-2-3-Kombos zwei Trainingspuppen: schwache Treffer (je 80), dafür viele Bonus-Aktionen – und die Puppen sinken nie unter 1 LP.

   0.0 –  1.4  HOOK     drei Geisterschläge hintereinander: Ochse, Schlange, Tiger („1-2-3“), Ghuanjun steht noch auf der Karte
   1.4 –  2.9  AUFWÄRMEN Ghuanjun hüpft von der Karte in die Arena, die Puppen (mit „999“) fallen links und rechts herein
   2.9 – 15.8  RUNDEN 1–9 je Runde eine Kombo im Halbtakt (0,36 s je Sprung): Ochsen-Kopfstoß (Aktion), Giftschlangen-Hieb (Bonus-Aktion), Tigeraxttritt
                        (Bonus-Aktion), dann ein Sprung in die Mitte; die Treffer wechseln zwischen den Puppen, die Anzeigen zählen 999 → 39
  ab 14.4              die 13. Treffer jeder Puppe müssten sie zerstören – ihre LP bleiben bei 1
  15.8 – 18.4  RAUSCH   Ghuanjun hüpft im Viertelakt wie von Sinnen, die Puppen zerplatzen, er landet wieder auf der Karte (Sprite der Karte übernimmt) → Loop

Alle Sprites (Puppen, Geisterköpfe, Posen, Knochen) stammen aus PixelPartiesSprites bzw. dem Spiel; alles auf dem Pixelraster von Ghuanjuns Sprite (die Geisterköpfe halb so groß)."""
import math

import numpy as np
from PIL import Image, ImageDraw

BEAT = 0.72
HB = BEAT / 2.0                                                                   # Halbtakt: ein Sprung = 0,36 s


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


FONT35 = {
    '0': ("111", "101", "101", "101", "111"), '1': ("010", "110", "010", "010", "111"), '2': ("111", "001", "111", "100", "111"),
    '3': ("111", "001", "111", "001", "111"), '4': ("101", "101", "111", "001", "001"), '5': ("111", "100", "111", "001", "111"),
    '6': ("111", "100", "111", "101", "111"), '7': ("111", "001", "001", "001", "001"), '8': ("111", "101", "111", "101", "111"),
    '9': ("111", "101", "111", "001", "111"),
}
GOLD, GOLD_HL = (255, 214, 64), (255, 244, 170)
ATTACKS = [('OX HEADBUTT', (255, 150, 60)), ('VENOM SNAKE', (110, 230, 90)), ('TIGER AXE KICK', (255, 190, 40))]


def load_img(p):
    return Image.open(p).convert('RGBA')


class HopShow:
    SPOTS = {'L': (335, 1790), 'R': (745, 1790), 'M': (540, 1790), 'L2': (430, 1790), 'R2': (650, 1790), 'L3': (270, 1790), 'R3': (810, 1790)}
    # Reihenfolge der Angriffe je Runde (0 = Ochse, 1 = Schlange, 2 = Tiger): jede Runde anders, der Ochse nie als dritter
    ORDERS = [(0, 1, 2), (2, 0, 1), (1, 0, 2), (0, 2, 1), (2, 0, 1), (1, 0, 2), (2, 0, 1), (0, 1, 2), (0, 2, 1)]
    STARTS = ['L', 'L', 'R', 'L', 'R', 'R', 'R', 'L', 'R']                              # Puppe des ersten Treffers (danach wechselt er: X, Y, X)
    HAND0 = {'L': 12, 'R': 5}                                                           # Handkarten der Puppen zu Beginn

    @classmethod
    def _keys(cls):
        """(Zeit in Takten, Ort, Trefferzahl). Ein Sprung = ein Halbtakt; 9 Runden à 3 Treffer + 1 Mittelsprung, danach im Viertelakt wie von Sinnen."""
        k = [(2, 'H', None), (2.5, 'M', None), (3, 'L', None), (3.5, 'R', None)]
        n = 0
        for i in range(9):
            base = 4 + 2 * i
            first = cls.STARTS[i]
            other = 'R' if first == 'L' else 'L'
            for j in range(3):
                k.append((base + 0.5 * j, first if j % 2 == 0 else other, n))
                n += 1
            k.append((base + 1.5, 'M', None))
        t0 = 4 + 2 * 9
        for j, spot in enumerate(('L2', 'R2', 'M', 'L3', 'R3', 'L2', 'R2', 'M')):
            k.append((t0 + 0.25 * (j + 1), spot, None))
        k.append((t0 + 2.5, 'M', None))
        k.append((t0 + 3.5, 'H', None))
        return k

    KEYS = None
    DUMMY_X = {'L': 125, 'R': 955}
    DUMMY_BASE = 1800
    HP0, DMG = 999, 80

    def __init__(self, W, H, U, fps, loop, geom, D, seed=4):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self.home = geom['home']                                                       # (x Mitte, y Fuß) des Karten-Sprites
        self.actor_fn = geom['actor_fn']                                                # (art, idx) → (Bild, pad), art = 'idle' | 'pose'
        self.pose_n = 3
        base = geom['assets_dir']
        self.spirits = []                                                                # die Geisterköpfe sind in 4-/5-px-Blöcken gemalt: auf Blockgröße 1 reduziert, dann ein Block = eine Zelle (14 px)
        for n, f_ in (('ox', 4), ('snake', 5), ('tiger', 5)):
            im_ = load_img('%s/%s.png' % (base, n))
            self.spirits.append(im_.resize((im_.width // f_, im_.height // f_), Image.NEAREST))
        self.dummy = np.asarray(load_img('%s/dummy.png' % base)).copy()
        self.bones = [load_img('%s/bone-%d.png' % (base, i)) for i in (0, 3, 4, 5)]
        from PIL import ImageEnhance
        cb = Image.open(geom['cardback_path']).convert('RGB').resize((6, 9), Image.BOX)
        cb = ImageEnhance.Color(ImageEnhance.Contrast(cb).enhance(1.35)).enhance(1.5).convert('RGBA')
        card = Image.new('RGBA', (8, 11), (255, 150, 40, 255))
        card.paste(cb, (1, 1))
        self.mini = card.transpose(Image.ROTATE_180)                                     # Handkarte der Puppen (Kartenrücken auf dem Layout-Raster U), um 180° gedreht: die Puppe sitzt Ghuanjun gegenüber
        self._cache = {}
        rng = np.random.default_rng(seed)
        yy, xx = np.mgrid[0:H, 0:W]
        rr = np.hypot((xx - W / 2) / (W * 0.62), (yy - H * 0.5) / (H * 0.55))
        self.vig = np.clip((rr - 0.45) / 0.8, 0, 1).astype(np.float32) ** 1.3
        self.kf = [(b * BEAT, spot, hit) for (b, spot, hit) in self._keys()]
        self.hits = []                                                                   # (Zeit, Seite, Angriff, laufende Nr.)
        self.att, self.eff = {}, {}
        stun_prev = {'L': False, 'R': False}
        for i in range(9):
            stun_now = {'L': False, 'R': False}
            for j in range(3):
                k_ = 3 * i + j
                t_, spot_, _h = [q for q in self.kf if q[2] == k_][0]
                side = 'L' if spot_ == 'L' else 'R'
                a_ = self.ORDERS[i][j]
                e = dict(a=a_, pos=j, turn=i, side=side)
                if a_ == 0:                                                              # Ochse: Gegner verliert 1 Handkarte, als zweiter Angriff 2
                    e['cards'] = 1 if j == 0 else 2
                elif a_ == 1:                                                            # Schlange: 1 / 2 / 3 Gift-Stapel je nach Platz
                    e['stacks'] = j + 1
                else:                                                                    # Tiger: als zweiter heilt er Ghuanjun, sonst Betäubung für die Runde
                    if j == 1:
                        e['heal'] = True
                    elif j == 0 and stun_prev[side]:
                        e['immune'] = True                                               # war die Puppe schon letzte Runde betäubt, wirkt der erste Tiger nicht
                    else:
                        e['stun'] = True
                        stun_now[side] = True
                self.att[k_] = a_
                self.eff[k_] = e
                self.hits.append((t_, side, a_, k_))
            stun_prev = stun_now
        self.turn_starts = [self.hits[3 * i][0] for i in range(9)]
        self.ticks = []                                                                  # Gift-Schaden nach jeder Kombo: (Zeit, Seite, Stapel, Schaden = 30 × Stapel)
        for i in range(9):
            t_tick = self.turn_starts[i] + 3 * HB + 0.0
            for sd in ('L', 'R'):
                st_ = sum(e['stacks'] for k_, e in self.eff.items() if e['side'] == sd and 'stacks' in e and self.hits[k_][0] <= t_tick)
                if st_:
                    self.ticks.append((t_tick, sd, st_, 30 * st_))
        self.stuns = []                                                                  # (Seite, von, bis): bis zum Ende der Runde
        for k_, e in self.eff.items():
            if e.get('stun'):
                th = self.hits[k_][0]
                nxt = self.turn_starts[e['turn'] + 1] if e['turn'] + 1 < 9 else th + 1.4
                self.stuns.append((e['side'], th, nxt))
        self.sh_bones = [[dict(a=rng.uniform(-2.6, -0.5), v=rng.uniform(350, 800), k=int(rng.integers(len(self.bones)))) for _ in range(6)] for _ in self.hits]
        self.t_in = {'L': 1.65, 'R': 1.95}                                                # Puppen fallen herein
        self.t_burst = (4 + 2 * 9) * BEAT                                               # Puppen zerplatzen, wenn die letzte Runde vorbei ist
        self.dust = []
        for i, (t, spot, hit) in enumerate(self.kf[1:], 1):
            self.dust.append((t, self._spot(spot)[0]))
        self.SHOCKS = tuple([0.0] + [self.hits[i][0] for i in (0, 6, 12, 18, 24)])
        self.TENSION_SHAKES = [(0.0, 8)] + [(h[0], 5) for h in self.hits]
        self.T_GUST = 0.0

    # ───────── Raster ─────────
    def cell(self, x, y):
        return int(math.floor((x - self.ox) / self.gp)), int(math.floor((y - self.oy) / self.gp))

    def cpos(self, ci, cj):
        return self.ox + ci * self.gp, self.oy + cj * self.gp

    def rect(self, d, ci, cj, col):
        x, y = self.cpos(ci, cj)
        if -self.gp < x < self.W and -self.gp < y < self.H:
            d.rectangle([x, y, x + self.gp - 1, y + self.gp - 1], fill=tuple(col) + ((255,) if len(col) == 3 else ()))

    def stamp(self, im, key, scale=None, alpha=None, white=0.0, tint=None, tamt=0.0):
        k = (key, scale or self.gp, alpha, white, tint, round(tamt, 2))
        if k not in self._cache:
            s = scale or self.gp
            a = np.asarray(im).astype(np.float32).copy()
            if white:
                a[..., :3] = a[..., :3] * (1 - white) + 255 * white
            if tint is not None and tamt:
                a[..., :3] = a[..., :3] * (1 - tamt) + np.array(tint, dtype=np.float32) * tamt
            if alpha is not None:
                a[..., 3] *= alpha
            out = Image.fromarray(a.astype(np.uint8), 'RGBA')
            self._cache[k] = out.resize((out.width * s, out.height * s), Image.NEAREST)
        return self._cache[k]

    # ───────── Bahn des Springers ─────────
    def _spot(self, name):
        if name == 'H':
            return self.home
        return self.SPOTS[name]

    def hide_sprite(self, f):
        """Der Kartensprite verschwindet, solange der Springer unterwegs ist."""
        t = f / float(self.fps)
        return self.kf[0][0] <= t < self.kf[-1][0]

    def actor_state(self, t):
        """(x Mitte, y Fuß, Art, Index, gespiegelt) oder None, solange er auf der Karte steht."""
        kf = self.kf
        if t < kf[0][0] or t >= kf[-1][0]:
            return None
        for i in range(len(kf) - 1):
            t0, s0, h0 = kf[i]
            t1, s1, h1 = kf[i + 1]
            if t0 <= t < t1:
                u = (t - t0) / (t1 - t0)
                p0, p1 = self._spot(s0), self._spot(s1)
                dt = t1 - t0
                arc = 250 if dt >= 0.7 else 120 if dt >= 0.3 else 70
                if s1 == 'H':
                    arc = 380
                if s0 == 'H':
                    arc = 380
                x = p0[0] + (p1[0] - p0[0]) * u
                y = p0[1] + (p1[1] - p0[1]) * u - arc * math.sin(math.pi * u)
                if h1 is not None and t >= t1 - 0.26:
                    return x, y, 'pose', self.att[h1], s1.startswith('R')
                if h0 is not None and t < t0 + 0.2:
                    return x, y, 'pose', self.att[h0], s0.startswith('R')
                return x, y, 'idle', int(t * self.fps / 2) % 24, False
        return None

    # ───────── Puppen ─────────
    def hp(self, side, t):
        n = sum(1 for (th, sd, a, k) in self.hits if sd == side and t >= th)
        poison = sum(dm for (tt, sd, st, dm) in self.ticks if sd == side and t >= tt)
        return max(1, self.HP0 - self.DMG * n - poison), n

    def clamp_time(self, side):
        """Zeitpunkt, an dem die LP der Puppe zum ersten Mal auf 1 gehalten werden."""
        ev = [(th, self.DMG) for (th, sd, a, k) in self.hits if sd == side] + [(tt, dm) for (tt, sd, st, dm) in self.ticks if sd == side]
        tot = 0
        for tt, dm in sorted(ev):
            tot += dm
            if self.HP0 - tot <= 0:
                return tt
        return None

    def stacks(self, side, t):
        return sum(e['stacks'] for k, e in self.eff.items() if e['side'] == side and 'stacks' in e and t >= self.hits[k][0])

    def hand(self, side, t):
        return self.HAND0[side] - sum(e['cards'] for k, e in self.eff.items() if e['side'] == side and 'cards' in e and t >= self.hits[k][0] + 0.1)

    def stunned(self, side, t):
        return any(sd == side and a <= t < b for (sd, a, b) in self.stuns)

    def _dummy_arr(self, hp):
        key = ('dummy', hp)
        if key in self._cache:
            return self._cache[key]
        a = self.dummy.copy()
        red = (230, 20, 20, 255)
        a[4:9, 4:15] = (0, 0, 0, 255)
        txt = str(hp)
        for n, ch in enumerate(txt[::-1]):
            c0 = 12 - 4 * n
            for r, row in enumerate(FONT35[ch]):
                for c, v in enumerate(row):
                    if v == '1':
                        a[4 + r, c0 + c] = red
        self._cache[key] = a
        return a

    def _dummy_y(self, side, t):
        ti = self.t_in[side]
        if t < ti:
            return None
        if t >= self.t_burst:
            return None
        u = (t - ti) / 0.5
        if u < 1.0:
            return self.DUMMY_BASE - 1000 * (1 - ease_out(u)) ** 1
        return self.DUMMY_BASE

    def _draw_dummy(self, canvas, d, side, t):
        y = self._dummy_y(side, t)
        h = self.dummy.shape[0]
        x = self.DUMMY_X[side]
        hp, n = self.hp(side, t)
        arr = self._dummy_arr(hp)
        flash = 0.0
        shake = 0
        for (th, sd, a, k) in self.hits:
            if sd == side and 0 <= t - th < 0.3:
                shake = (1 if int((t - th) * 30) % 2 else -1) if (t - th) < 0.25 else 0
                flash = 0.8 if (t - th) < 0.07 else 0.0
        if y is None:
            if self.t_burst <= t < self.t_burst + 1.0:                                  # zerplatzt in Pixel
                self._burst_dummy(d, side, t, arr)
            return
        im = Image.fromarray(arr, 'RGBA')
        amt = 0.38 if self.stacks(side, t) > 0 else 0.0                                  # Poisoned wie im Spiel: lila Tönung (149, 68, 213), 38 %, nur auf den Pixeln der Figur
        s = self.stamp(im, ('dm', hp), white=flash, tint=(149, 68, 213), tamt=amt) if flash == 0 else self.stamp(im, ('dmf', hp), white=flash, tint=(149, 68, 213), tamt=amt)
        ci = self.cell(x, 0)[0] - im.width // 2 + shake
        cj = self.cell(0, y)[1] - h + 1
        px_, py_ = self.cpos(ci, cj)
        canvas.paste(s, (px_, py_), s)
        if y >= self.DUMMY_BASE and t < self.t_in[side] + 0.6:                          # Staub beim Aufprall
            u = (t - self.t_in[side] - 0.5) / 0.1
        self._dummy_ci = (ci, cj)

    def _burst_dummy(self, d, side, t, arr):
        tau = t - self.t_burst
        h, w = arr.shape[:2]
        x = self.DUMMY_X[side]
        ci0 = self.cell(x, 0)[0] - w // 2
        cj0 = self.cell(0, self.DUMMY_BASE)[1] - h + 1
        rng = np.random.default_rng(5 if side == 'L' else 6)
        ys, xs = np.where(arr[..., 3] > 20)
        for n in range(len(xs)):
            vx, vy = rng.uniform(-20, 20), rng.uniform(-30, -6)
            px_ = ci0 + int(xs[n]) + vx * tau
            py_ = cj0 + int(ys[n]) + vy * tau + 55 * tau * tau
            if tau > 0.7 and (n + int(t * 24)) % 2:
                continue
            self.rect(d, int(px_), int(py_), tuple(int(v) for v in arr[ys[n], xs[n], :3]))

    # ───────── Zeichnen ─────────
    def draw_behind(self, canvas, f):
        pass

    def draw_logo(self, canvas, f):
        lx, ly, lw, lh = self.g['logo_rect']
        canvas.paste(self.g['logo_img'], (int(lx), int(ly)), self.g['logo_img'])

    def draw_badge(self, canvas, f):
        bx, by, bw, bh = self.g['badge_rect']
        canvas.paste(self.g['badge_img'], (bx, by), self.g['badge_img'])

    def _draw_actor(self, canvas, t):
        st = self.actor_state(t)
        if st is None:
            return
        for k, a in ((3, 0.12), (2, 0.22), (1, 0.4)):                                    # Nachbilder: er ist ständig in Bewegung
            ts = t - 0.05 * k
            s2 = self.actor_state(ts)
            if s2 is not None:
                self._paste_actor(canvas, s2, a)
        self._paste_actor(canvas, st, 1.0)

    def _paste_actor(self, canvas, st, alpha):
        x, y, art, idx, mir = st
        im, pad, cxf, foot = self.actor_fn(art, idx)
        if alpha < 1.0:
            key = ('act', art, idx, alpha)
            if key not in self._cache:
                a = np.asarray(im).astype(np.float32).copy()
                a[..., 3] *= alpha
                self._cache[key] = Image.fromarray(a.astype(np.uint8), 'RGBA')
            im = self._cache[key]
        if mir:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        gp = self.gp
        fx = self.ox + int(round((x - cxf * gp - self.ox) / gp)) * gp                  # Rasterzelle der Bildecke (gleiches Raster wie der Kartensprite)
        fy = self.oy + int(round((y - foot * gp - self.oy) / gp)) * gp
        canvas.paste(im, (fx - pad, fy - pad), im)

    def _draw_spirits(self, canvas, t):
        """Geisterköpfe (Ochse, Schlange, Tiger) blitzen bei jedem Angriff über der getroffenen Puppe auf; im Hook erscheinen alle drei nacheinander."""
        evs = [(th, self.DUMMY_X[sd], 1090, a) for (th, sd, a, k) in self.hits] + [(0.0, 200, 640, 0), (0.36, 880, 640, 1), (0.72, 540, 480, 2)]
        for (th, x, y, a) in evs:
            tau = t - th
            if not (0 <= tau < 0.42):
                continue
            if tau > 0.22 and int(tau * 30) % 2 == 1:
                continue
            s = self.stamp(self.spirits[a], ('sp', a))
            sc = 1.0 + 0.5 * (1 - ease_out(tau / 0.12)) if tau < 0.12 else 1.0
            canvas.paste(s, (int(x - s.width / 2), int(y - s.height / 2)), s)

    def _effect_text(self, e):
        if 'cards' in e:
            return ('-%d CARD%s' % (e['cards'], 'S' if e['cards'] > 1 else ''), (255, 120, 120))
        if 'stacks' in e:
            return ('+%d POISON' % e['stacks'], (110, 230, 90))
        if e.get('stun'):
            return ('STUN', (255, 230, 80))
        if e.get('immune'):
            return ('STUN IMMUNE', (150, 190, 255))
        return (None, None)

    POISON_ICON = ['...e...', '...E...', '..EEe..', '.EEEEe.', 'EEHEEee', 'EEHEEee', 'EEEEeee', '.EEEee.', '..eee..']       # Gift-Symbol des Spiels (app-fx-52, ICON.poison)
    POISON_COL = {'e': (32, 172, 55), 'E': (26, 255, 115), 'H': (102, 255, 113)}
    SKULL = ["..WWWW..", ".WWWWWW.", "WWWWWWWW", "WKKWWKKW", "WKKWWKKW", ".WWWWWW.", "..WKWK..", "..WWWW.."]

    def _draw_status(self, canvas, d, t):
        """Über jeder Puppe: Handkarten (Fächer), Gift (Symbol mit „xN“, lila Tönung, aufsteigende Schädel wie im Spiel), Betäubung (Sterne)."""
        U = self.U
        for side in ('L', 'R'):
            y = self._dummy_y(side, t)
            if y is None or y < self.DUMMY_BASE:
                continue
            x = self.DUMMY_X[side]
            n = self.hand(side, t)
            show = min(n, 6)
            sm = self.stamp(self.mini, ('mini',), scale=U)
            for i in range(show):                                                         # Gegnerhand: verdeckt, um 180° gedreht, als Fächer
                cx = x + (i - (show - 1) / 2.0) * 30
                cy = 1140 + abs(i - (show - 1) / 2.0) * 7
                canvas.paste(sm, (int(round((cx - sm.width / 2) / U) * U), int(round((cy - sm.height / 2) / U) * U)), sm)
            self.draw_text(canvas, 'HAND %d' % n, 3, (x, 1213), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
            st = self.stacks(side, t)
            if st:
                ix, iy = int(round((x - 74) / U) * U), 1236                               # Gift-Symbol + „x12“ (wie am Helden im Spiel)
                for j, row in enumerate(self.POISON_ICON):
                    for i, ch in enumerate(row):
                        if ch != '.':
                            d.rectangle([ix + i * U, iy + j * U, ix + i * U + U - 1, iy + j * U + U - 1], fill=self.POISON_COL[ch] + (255,))
                for j in range(-1, len(self.POISON_ICON) + 1):                              # dunkle Kontur
                    for i in range(-1, 8):
                        filled = lambda a_, b_: 0 <= b_ < 9 and 0 <= a_ < 7 and self.POISON_ICON[b_][a_] != '.'
                        if not filled(i, j) and (filled(i + 1, j) or filled(i - 1, j) or filled(i, j + 1) or filled(i, j - 1)):
                            d.rectangle([ix + i * U, iy + j * U, ix + i * U + U - 1, iy + j * U + U - 1], fill=(18, 16, 31, 255))
                self.draw_text(canvas, 'x%d' % st, 4, (x + 24, 1268), color=(229, 245, 250), outline=(18, 16, 31), shadow=None)
                for i in range(5):                                                        # fünf kleine Schädel steigen über der Figur auf
                    life = 2.2 + 1.2 * ((i * 37) % 10) / 10.0
                    ph = ((t - (i / 5.0) * 2.6) % life) / life
                    if ph < 0.1 or ph > 0.9 or (ph > 0.75 and int(t * 20 + i) % 2):
                        continue
                    sx_ = x - 110 + 220 * ((i + 0.4) / 5.0)
                    sy_ = 1268 + 0.4 * 532 + 40 - 90 * ph
                    ci0 = int(round((sx_ - 4 * U) / U) * U)
                    cj0 = int(round((sy_ - 4 * U) / U) * U)
                    for j2, row in enumerate(self.SKULL):
                        for i2, ch in enumerate(row):
                            if ch != '.':
                                d.rectangle([ci0 + i2 * U, cj0 + j2 * U, ci0 + i2 * U + U - 1, cj0 + j2 * U + U - 1], fill=((255, 251, 210) if ch == 'W' else (18, 16, 31)) + (255,))
            if self.stunned(side, t):
                cx, cy = x, 1268 - 34
                for i in range(3):
                    a = t * 9 + i * 2.094
                    ci, cj = self.cell(cx + math.cos(a) * 70, cy + math.sin(a) * 16)
                    for (da, db) in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                        self.rect(d, ci + da, cj + db, (255, 230, 80) if (da, db) != (0, 0) else (255, 255, 200))
                if int(t * 6) % 2 == 0:
                    self.draw_text(canvas, 'STUN', 3, (x, 1186), color=(255, 230, 80), outline=None, shadow=(60, 40, 0))
        # Gift-Tick nach der Kombo: lila Blitz und Blasen (wie `poison_tick` im Spiel), dann Schaden = 30 × Stapel
        for (tt, sd, st, dm) in self.ticks:
            tau = t - tt
            if not (0 <= tau < 0.9) or self._dummy_y(sd, t) is None:
                continue
            x = self.DUMMY_X[sd]
            if tau < 0.3:
                r = 9 * ease_out(tau / 0.3)
                for a_i in range(16):
                    ang = 2 * math.pi * a_i / 16
                    ci, cj = self.cell(x + math.cos(ang) * r * self.gp, 1560 + math.sin(ang) * r * self.gp * 1.3)
                    self.rect(d, ci, cj, (102, 24, 180))
            for b in range(14):
                rb = np.random.default_rng(b * 7 + int(tt * 10))
                xo, sz = rb.uniform(-70, 70), rb.integers(1, 3)
                delay, dur = rb.uniform(0, 0.25), rb.uniform(0.4, 0.8)
                u = (tau - delay) / dur
                if 0 <= u < 1:
                    col = [(149, 68, 213), (112, 45, 179), (184, 102, 255), (102, 24, 180), (201, 138, 255)][b % 5]
                    bi, bj = self.cell(x + xo, 1620 - 280 * u)
                    for da in range(sz):
                        for db in range(sz):
                            self.rect(d, bi + da, bj + db, col)
            if tau < 0.9:                                                               # Giftschaden grün, oben bei den normalen Schadenszahlen
                self.draw_text(canvas, str(dm), 8, (x + (110 if sd == 'L' else -110), 1175 - 110 * smooth(tau / 0.9)), color=(26, 255, 115), outline=(22, 121, 39), shadow=None)

    def _draw_hit_fx(self, canvas, d, t):
        for n, (th, sd, a, k) in enumerate(self.hits):
            tau = t - th
            if not (0 <= tau < 1.0):
                continue
            x = self.DUMMY_X[sd]
            y = 1450
            if tau < 0.25:                                                              # Aufprallstern
                r = 7 * ease_out(tau / 0.25)
                for j in range(10):
                    ang = 2 * math.pi * j / 10 + 0.3
                    ci, cj = self.cell(x + math.cos(ang) * 40, y + math.sin(ang) * 40)
                    for s in range(2, int(r) + 2):
                        self.rect(d, ci + int(round(math.cos(ang) * s)), cj + int(round(math.sin(ang) * s)), (255, 255, 255) if s < 4 else ATTACKS[a][1])
            for b in self.sh_bones[n]:                                                  # Knochen und Schädel fliegen weg
                vx, vy = math.cos(b['a']) * b['v'] * (1 if sd == 'R' else -1) * -1, math.sin(b['a']) * b['v']
                px_, py_ = x + vx * tau * 0.5 + (160 if sd == 'L' else -160) * 0, y + vy * tau + 900 * tau * tau
                if py_ > self.H or tau > 0.9:
                    continue
                im = self.bones[b['k']]
                s = self.stamp(im, ('bn', b['k']), scale=self.U)
                canvas.paste(s, (int(px_), int(py_)), s)
            if tau < 0.9:                                                                # Schadenszahl
                u = tau / 0.9
                self.draw_text(canvas, str(self.DMG), 8, (x + (110 if sd == 'L' else -110), 1250 - 130 * smooth(u)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)
                if self.hp(sd, th)[0] <= 1 and tau < 0.8:                                    # LP werden auf 1 gehalten
                    self.draw_text(canvas, 'HP 1', 3, (x + (110 if sd == 'L' else -110), 1296 - 130 * smooth(u)), color=GOLD_HL, outline=None, shadow=(60, 30, 0))
                txt, col = self._effect_text(self.eff[k])
                if txt and tau < 0.8:
                    self.draw_text(canvas, txt, 3, (x + (150 if sd == 'L' else -150), 1180 - 60 * smooth(u)), color=col, outline=None, shadow=(20, 10, 10))
            e = self.eff[k]
            if 'cards' in e and tau < 1.0:                                               # Ochse: die Puppe verliert Handkarten
                for c in range(e['cards']):
                    dirx = 1 if sd == 'L' else -1
                    vx, vy = dirx * (260 + 140 * c), -560 - 90 * c
                    cx_, cy_ = x + vx * tau, 1330 + vy * tau + 0.5 * 1500 * tau * tau
                    sm = self.stamp(self.mini, ('mini',), scale=self.U)
                    canvas.paste(sm, (int(cx_ - sm.width / 2), int(cy_ - sm.height / 2)), sm)
            if e.get('heal') and tau < 1.0:                                              # Tiger (zweiter Angriff): Ghuanjun wird geheilt
                st_ = self.actor_state(t)
                if st_ is not None:
                    ax, ay = st_[0], st_[1] - 230
                    for i in range(9):
                        ph = (tau * 1.3 + i * 0.11) % 1.0
                        hx, hy = ax + math.sin(i * 2.3) * 120, ay - 40 + 150 * (1 - ph) - 90 * tau
                        ci, cj = self.cell(hx, hy)
                        for (da, db) in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                            self.rect(d, ci + da, cj + db, (90, 255, 120) if (da, db) != (0, 0) else (230, 255, 230))
                    self.draw_text(canvas, 'HEAL', 4, (ax, ay - 110 - 40 * tau), color=(110, 255, 140), outline=None, shadow=(10, 60, 20))
        for sd in ('L', 'R'):                                                            # HP bleibt bei 1
            hit_t = self.clamp_time(sd)
            if hit_t is not None and 0 <= t - hit_t < 1.2:
                x = self.DUMMY_X[sd]
                if int(t * 14) % 2 == 0:
                    self.draw_text(canvas, 'HP STAYS 1!', 4, (x + (160 if sd == 'L' else -160), 1330), color=GOLD_HL, outline=(176, 80, 0), shadow=(30, 10, 0))

    def _draw_hud(self, canvas, t):
        """Oben: 1-2-3 der Kombo, Aktion/Bonus-Aktion, Runde."""
        turn = 0
        for i, ts in enumerate(self.turn_starts):
            if t >= ts - 0.4:
                turn = i + 1
        lit = [False, False, False]
        if t < BEAT * 2:                                                                 # Hook: das 1-2-3 als Ouvertüre
            for i, th in enumerate((0.0, 0.36, 0.72)):
                lit[i] = t >= th
            turn_txt = None
        elif turn:
            ts = self.turn_starts[turn - 1]
            for i in range(3):
                lit[i] = t >= ts + i * HB
            turn_txt = 'TURN %d' % turn
        else:
            turn_txt = 'READY'
        if t >= self.hits[-1][0] + 0.3:
            lit = [True, True, True]
        order = (0, 1, 2) if t < BEAT * 2 else self.ORDERS[max(0, min(turn, 9) - 1)]
        names = ('OX', 'SNAKE', 'TIGER')
        for i in range(3):
            x = 360 + 180 * i
            col = GOLD if lit[i] else (110, 100, 120)
            sh = (60, 30, 0) if lit[i] else (30, 25, 35)
            self.draw_text(canvas, str(i + 1), 9, (x, 108), color=col, outline=None, shadow=sh)
            if lit[i]:
                self.draw_text(canvas, names[order[i]], 3, (x, 166), color=ATTACKS[order[i]][1], outline=None, shadow=(20, 10, 20))
                self.draw_text(canvas, 'ACTION' if i == 0 else 'BONUS', 2, (x, 192), color=(200, 200, 210) if i == 0 else (255, 120, 100), outline=None, shadow=(20, 10, 20))
            else:
                self.draw_text(canvas, 'ACTION' if i == 0 else 'BONUS', 3, (x, 172), color=(110, 100, 120), outline=None, shadow=(20, 10, 20))
        if turn_txt:
            self.draw_text(canvas, turn_txt, 4, (125, 90), color=(255, 120, 100), outline=None, shadow=(30, 10, 20))
        n_hits = sum(1 for h in self.hits if t >= h[0])
        if n_hits:
            self.draw_text(canvas, 'HITS %d' % n_hits, 4, (955, 90), color=(255, 255, 255), outline=None, shadow=(30, 10, 20))

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        for side in ('L', 'R'):
            self._draw_dummy(canvas, d, side, t)
        self._draw_spirits(canvas, t)
        self._draw_actor(canvas, t)
        d = ImageDraw.Draw(canvas)
        # Landestaub
        for (tl, xl) in self.dust:
            tau = t - tl
            if 0 <= tau < 0.35:
                for j in range(6):
                    ang = math.pi * (0.1 + 0.8 * j / 5.0)
                    r = 2 + 6 * ease_out(tau / 0.35)
                    ci, cj = self.cell(xl + 90 * math.cos(ang) * (1 if j % 2 else -1) * 0.3, 1796)
                    self.rect(d, ci + int(round(math.cos(ang) * r * (1 if j % 2 else -1))), cj - int(round(math.sin(ang) * r * 0.6)), (200, 190, 170))
        self._draw_status(canvas, d, t)
        self._draw_hit_fx(canvas, d, t)
        self._draw_hud(canvas, t)

    # ───────── Bild-Nachbearbeitung ─────────
    def plate_dx(self, f):
        t = f / float(self.fps)
        dx = 0.0
        for tg, a in self.TENSION_SHAKES:
            tau = t - tg
            if tau >= 0:
                dx += a * math.exp(-tau / 0.2) * math.cos(2 * math.pi * 6 * tau)
        return int(round(dx / self.U)) * self.U

    def sprite_dx(self, f):
        return int(round(0.4 * self.plate_dx(f) / self.U)) * self.U

    def post_fx(self, img, f):
        t = f / float(self.fps)
        fl = 0.0
        for th in [0.0, 0.36, 0.72] + [h[0] for h in self.hits]:
            if 0 <= t - th < 0.12:
                fl = max(fl, 0.3 * math.exp(-(t - th) / 0.04))
        if fl <= 0:
            return img
        arr = np.asarray(img).astype(np.float32)
        arr = arr * (1 - fl) + 255.0 * fl
        return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')

    def opener_fx(self, img, f, t_gust=None):
        return img

    def closer_fx(self, img, f):
        t = f / float(self.fps)
        if t < self.D - 0.7:
            return img
        a = 0.35 * ((t - (self.D - 0.7)) / 0.7) ** 2
        return Image.blend(img.convert('RGB'), Image.new('RGB', img.size, (255, 255, 255)), a) if a > 0 else img

    # ───────── Soundeffekte (public/sounds): gleiche Aktion = gleicher Sound ─────────
    SND = {
        'explode': [('heavy_impact', -2), ('elem_wind', -8, 0.10)],
        'hit':     [('damage', -6)],                                                    # jeder Treffer
        'ox':      [('attack_ram', -5)],
        'snake':   [('poison', -7)],
        'tiger':   [('slash', -5)],
        'hop':     [('placement', -19)],                                                # jede Landung
        'bonus':   [('buff', -9)],                                                      # Bonus-Aktion
        'num':     [('ping', -10)],                                                     # eine Zahl der Kombo leuchtet
        'turn':    [('turn_start', -8)],
        'clamp':   [('negate', -6)],                                                    # LP bleiben bei 1
        'drop':    [('placement', -8)],
        'burst':   [('creature_destroyed', -6)],
        'discard': [('discard', -6)],                                                   # die Puppe verliert Handkarten
        'heal':    [('heal', -6)],                                                      # Ghuanjun wird geheilt
        'stun':    [('debuff', -7)],                                                    # Betäubung
        'resist':  [('negate', -9)],
        'tick':    [('poison', -7)],                                                    # Gift-Schaden nach der Kombo                                                    # Betäubung wirkt nicht
    }

    def sfx_events(self):
        D = self.D
        ev = []

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t + (item[2] if len(item) > 2 else 0.0), item[0], item[1]))
        add(0.0, 'explode')
        for i, th in enumerate((0.0, 0.36, 0.72)):                                      # Hook: 1-2-3
            add(th, ('ox', 'snake', 'tiger')[i]); add(th + 0.02, 'num')
        add(self.t_in['L'] + 0.4, 'drop'); add(self.t_in['R'] + 0.4, 'drop')
        for (t, spot, hit) in self.kf[1:]:
            add(t, 'hop')
        for n, (th, sd, a, k) in enumerate(self.hits):
            add(th, ('ox', 'snake', 'tiger')[a]); add(th + 0.04, 'hit')
            e = self.eff[k]
            if e['pos'] > 0:
                add(th + 0.1, 'bonus')
            if 'cards' in e:
                add(th + 0.12, 'discard')
            if e.get('heal'):
                add(th + 0.12, 'heal')
            if e.get('stun'):
                add(th + 0.12, 'stun')
            if e.get('immune'):
                add(th + 0.12, 'resist')
            ev.append((th + 0.05, 'ping', -10))
            if self.eff[k]['pos'] == 0:
                add(th - 0.3, 'turn')
            if self.HP0 - self.DMG * sum(1 for h in self.hits if h[1] == sd and h[0] <= th) <= 0:
                add(th + 0.12, 'clamp')
        for (tt, sd, st, dm) in self.ticks:
            add(tt, 'tick')
        add(self.t_burst, 'burst'); add(self.t_burst, 'explode')
        ev.append((D - 0.8, 'ascension', -9, 1.2))
        return sorted(ev)
