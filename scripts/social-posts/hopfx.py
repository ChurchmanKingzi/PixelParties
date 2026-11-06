"""Hüpf-Show für „Ghuanjun, the Undead Martial Artist“: ein Jiang Shi, der nie stillsteht. Er springt ununterbrochen durchs Bild (Takt = 0,72 s, passend zum Theme)
und trifft mit 1-2-3-Kombos zwei Trainingspuppen: schwache Treffer (je 80), dafür viele Bonus-Aktionen – und die Puppen sinken nie unter 1 LP.

   0.0 –  1.4  HOOK     drei Geisterschläge hintereinander: Ochse, Schlange, Tiger („1-2-3“), Ghuanjun steht noch auf der Karte
   1.4 –  4.3  AUFWÄRMEN Ghuanjun hüpft von der Karte in die Arena, die Puppen (mit „400“) fallen links und rechts herein
   4.3 – 14.4  RUNDEN 1–3 je Runde eine Kombo: Ochsen-Kopfstoß (Aktion), Giftschlangen-Hieb (Bonus-Aktion), Tigeraxttritt (Bonus-Aktion);
                        die Treffer wechseln zwischen den Puppen, zwischen den Runden hüpft er in die Mitte; die Anzeigen der Puppen zählen 400 → 80
  14.4 – 15.8  RUNDE 4  die letzten Treffer: die 6. Treffer jeder Puppe müssten sie zerstören – ihre LP bleiben bei 1
  15.8 – 18.0  RAUSCH   Ghuanjun hüpft im Halbtakt wie von Sinnen, „NEVER STOPS!“, die Puppen zerplatzen
  18.0 –   D   RÜCKKEHR er landet wieder auf der Karte (Sprite der Karte übernimmt) → nahtlos in den Hook

Alle Sprites (Puppen, Geisterköpfe, Posen, Knochen) stammen aus PixelPartiesSprites bzw. dem Spiel; alles auf dem Pixelraster von Ghuanjuns Sprite (die Geisterköpfe halb so groß)."""
import math

import numpy as np
from PIL import Image, ImageDraw

BEAT = 0.72


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
    KEYS = [(2, 'H', None), (3, 'M', None), (4, 'L', None), (5, 'R', None), (6, 'L', 0), (7, 'R', 1), (8, 'L', 2), (9, 'M', None),
            (10, 'R', 3), (11, 'L', 4), (12, 'R', 5), (13, 'M', None), (14, 'L', 6), (15, 'R', 7), (16, 'L', 8), (17, 'M', None),
            (18, 'R', 9), (19, 'L', 10), (20, 'R', 11), (21, 'M', None), (21.5, 'L2', None), (22, 'R2', None), (22.5, 'M', None),
            (23, 'L3', None), (23.5, 'R3', None), (24, 'M', None), (25, 'H', None)]
    DUMMY_X = {'L': 125, 'R': 955}
    DUMMY_BASE = 1800
    HP0, DMG = 400, 80

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
        self._cache = {}
        rng = np.random.default_rng(seed)
        yy, xx = np.mgrid[0:H, 0:W]
        rr = np.hypot((xx - W / 2) / (W * 0.62), (yy - H * 0.5) / (H * 0.55))
        self.vig = np.clip((rr - 0.45) / 0.8, 0, 1).astype(np.float32) ** 1.3
        self.kf = [(b * BEAT, spot, hit) for (b, spot, hit) in self.KEYS]
        self.hits = []                                                                   # (Zeit, Seite, Angriff, laufende Nr.)
        for i, (t, spot, hit) in enumerate(self.kf):
            if hit is not None:
                self.hits.append((t, 'L' if spot == 'L' else 'R', hit % 3, hit))
        self.sh_bones = [[dict(a=rng.uniform(-2.6, -0.5), v=rng.uniform(350, 800), k=int(rng.integers(len(self.bones)))) for _ in range(6)] for _ in self.hits]
        self.t_in = {'L': 1.9, 'R': 2.2}                                                # Puppen fallen herein
        self.t_out = 18.0 - 1.2                                                         # Puppen zerplatzen (15.8 → 16.8)
        self.t_burst = 15.9
        self.turn_starts = [self.hits[i][0] for i in (0, 3, 6, 9)]
        self.dust = []
        for i, (t, spot, hit) in enumerate(self.kf[1:], 1):
            self.dust.append((t, self._spot(spot)[0]))
        self.SHOCKS = tuple([0.0] + [self.hits[i][0] for i in (0, 3, 6, 9, 11)])
        self.TENSION_SHAKES = [(0.0, 8)] + [(h[0], 7) for h in self.hits]
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

    def stamp(self, im, key, scale=None, alpha=None, white=0.0):
        k = (key, scale or self.gp, alpha, white)
        if k not in self._cache:
            s = scale or self.gp
            a = np.asarray(im).astype(np.float32).copy()
            if white:
                a[..., :3] = a[..., :3] * (1 - white) + 255 * white
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
        return BEAT * 2 <= t < BEAT * 25

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
                arc = 250 if dt >= 0.7 else 120
                if s1 == 'H':
                    arc = 380
                if s0 == 'H':
                    arc = 380
                x = p0[0] + (p1[0] - p0[0]) * u
                y = p0[1] + (p1[1] - p0[1]) * u - arc * math.sin(math.pi * u)
                if h1 is not None and t >= t1 - 0.26:
                    return x, y, 'pose', h1 % 3, s1.startswith('R')
                if h0 is not None and t < t0 + 0.2:
                    return x, y, 'pose', h0 % 3, s0.startswith('R')
                return x, y, 'idle', int(t * self.fps / 2) % 24, False
        return None

    # ───────── Puppen ─────────
    def hp(self, side, t):
        n = sum(1 for (th, sd, a, k) in self.hits if sd == side and t >= th)
        return max(1, self.HP0 - self.DMG * n), n

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
        s = self.stamp(im, ('dm', hp), white=flash) if flash == 0 else self.stamp(im, ('dmf', hp), white=flash)
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
                name = ATTACKS[a][0]
                if tau < 0.7:
                    self.draw_text(canvas, name, 3, (x + (150 if sd == 'L' else -150), 1180 - 60 * smooth(u)), color=ATTACKS[a][1], outline=None, shadow=(20, 10, 10))
        for sd in ('L', 'R'):                                                            # HP bleibt bei 1
            hit_t = None
            for (th, s2, a, k) in self.hits:
                if s2 == sd and self.HP0 - self.DMG * (sum(1 for (t3, s3, a3, k3) in self.hits if s3 == sd and t3 <= th)) <= 0:
                    hit_t = th if hit_t is None else hit_t
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
                lit[i] = t >= ts + i * BEAT
            turn_txt = 'TURN %d' % turn
            if t >= ts + 2 * BEAT + 1.6 and turn < 4:
                lit = [False, False, False]
        else:
            turn_txt = 'READY'
        if t >= BEAT * 20 + 1.2:
            lit = [True, True, True]
        labels = ('ACTION', 'BONUS', 'BONUS')
        for i in range(3):
            x = 360 + 180 * i
            col = GOLD if lit[i] else (110, 100, 120)
            sh = (60, 30, 0) if lit[i] else (30, 25, 35)
            self.draw_text(canvas, str(i + 1), 9, (x, 112), color=col, outline=None, shadow=sh)
            self.draw_text(canvas, labels[i], 3, (x, 178), color=(255, 120, 100) if (lit[i] and i > 0) else (200, 200, 210) if lit[i] else (110, 100, 120), outline=None, shadow=(20, 10, 20))
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
        self._draw_hit_fx(canvas, d, t)
        self._draw_hud(canvas, t)
        if BEAT * 21 <= t < BEAT * 25 - 0.2:
            if int(t * 12) % 2 == 0:
                self.draw_text(canvas, 'NEVER STOPS!', 10, (self.W / 2, 1100), color=(255, 255, 255), outline=(255, 90, 90), shadow=(40, 0, 10))

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
        'hop':     [('placement', -16)],                                                # jede Landung
        'bonus':   [('buff', -9)],                                                      # Bonus-Aktion
        'num':     [('ping', -10)],                                                     # eine Zahl der Kombo leuchtet
        'turn':    [('turn_start', -8)],
        'clamp':   [('negate', -6)],                                                    # LP bleiben bei 1
        'drop':    [('placement', -8)],
        'burst':   [('creature_destroyed', -6)],
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
            if k % 3 > 0:
                add(th + 0.1, 'bonus')
            ev.append((th + 0.05, 'ping', -10))
            if k % 3 == 0:
                add(th - 0.3, 'turn')
            if self.HP0 - self.DMG * sum(1 for h in self.hits if h[1] == sd and h[0] <= th) <= 0:
                add(th + 0.12, 'clamp')
        add(self.t_burst, 'burst'); add(self.t_burst, 'explode')
        ev.append((D - 0.8, 'ascension', -9, 1.2))
        return sorted(ev)
