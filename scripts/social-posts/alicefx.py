"""Alice-Show für „Alice, the Puppeteer Girl“: ihre Mr. Jiggles (weiße Stoffpüppchen mit roten Augen, aus ihrem Sprite) tanzen an Fäden um sie,
das Interface wird zur Marionette, und die Püppchen schießen dünne rote Laser aus den Augen – mit Spannungsbogen:

   0.0 –  1.6  HOOK     rote Laser-Spinne über dem Bild, Blitz, Druckwelle
   1.6 –  5.0  RUF      sieben Mr. Jiggles fliegen von Alice' Händen auf ihre Plätze (Sprungfeder-Wackeln, Fäden werden gespannt)
   5.0 –  8.6  PUPPEN   Alice lässt das Banner an Fäden tanzen (ruckelnd, wie eine Marionette), Herzschlag, rote Vignette wächst
   8.6 – 12.6  PROBE    Augen glühen auf, erste Probeschüsse an den Bildrand, dann durchtrennen zwei Laser die Banner-Fäden
  12.6 – 16.0  ZIEL     zwei Laser (je 100) zerschneiden das Link-Schild; die Hälften kommen an Fäden zurück
  16.0 – 18.0  FINALE   alle sieben Püppchen kreisen, die Augen laden sich auf, ein Dauerfeuer bündelt sich auf einen Punkt
  18.0 – 19.4  SALVE    Sprengung, „350“ (= 50 × 7 Kreaturen, passend zum Kartentext), die Püppchen hängen schlaff
  19.4 –   D   RÜCKKEHR Fäden ziehen sie zu den Händen zurück, die Laser-Spinne baut sich auf → nahtlos in den Hook

Alle Methoden entsprechen der API von windfx.WindShow (draw_behind/draw_front/draw_logo/draw_badge/plate_dx/sprite_dx/opener_fx/closer_fx/sfx_events)."""
import math

import numpy as np
from PIL import Image, ImageDraw


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ease_out_back(x):
    x = min(1.0, max(0.0, x))
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


class Jiggles:
    """Mr. Jiggles, animiert: Sprungfeder-Wackeln (Strecken/Stauchen + Scherung), Augenglühen in vier Stufen, Blinzeln."""
    EYES = ((4, 3), (4, 6))                                                            # (Zeile, Spalte) der Augenpixel im Original
    CHARGE = [(210, 0, 0), (255, 50, 40), (255, 130, 120), (255, 236, 232)]
    STRETCH = (0.0, 0.14, 0.26, 0.12, -0.08, -0.2, -0.1, 0.0)
    SHEAR = (0, 0, 1, 1, 0, -1, -1, 0)

    def __init__(self, path):
        self.base = np.asarray(Image.open(path).convert('RGBA')).copy()
        self._cache = {}

    def _arr(self, idx, charge, blink):
        a = self.base.copy()
        for (y, x) in self.EYES:
            if blink:
                a[y, x] = (50, 51, 50, 255)
            else:
                a[y, x] = self.CHARGE[charge] + (255,)
                if charge >= 2:                                                        # Glühen: Nachbarpixel färben sich rot
                    for dy, dx in ((0, -1), (0, 1), (-1, 0)):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < a.shape[0] and 0 <= xx < a.shape[1] and a[yy, xx, 3] and tuple(a[yy, xx, :3]) in ((209, 211, 208), (252, 255, 251), (165, 167, 164)):
                            a[yy, xx, :3] = (255, 150, 150) if charge == 2 else (255, 80, 80)
        h, w = a.shape[:2]
        nh = max(8, int(round(h * (1 + self.STRETCH[idx % 8]))))
        src = np.minimum(h - 1, (np.arange(nh) * h / nh).astype(int))
        b = a[src]
        H_, W_ = 16, 15
        out = np.zeros((H_, W_, 4), dtype=np.uint8)
        for y in range(nh):
            dx = int(round(self.SHEAR[idx % 8] * (nh - 1 - y) / max(1.0, nh - 1) * 1.5))      # oben mehr Versatz, Füße bleiben stehen
            out[H_ - nh + y, 2 + dx:2 + dx + w] = b[y]
        return out

    def stamp(self, idx, charge, blink, px, mirror=False):
        key = (idx % 8, charge, blink, px, mirror)
        if key not in self._cache:
            im = Image.fromarray(self._arr(idx, charge, blink), 'RGBA')
            if mirror:
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            self._cache[key] = im.resize((im.width * px, im.height * px), Image.NEAREST)
        return self._cache[key]


class AliceShow:
    SHOCKS = (0.0, 13.8, 18.0)
    T_GUST = 0.0
    N = 7
    ANCHORS = [(-390, 170), (390, 170), (-445, -120), (445, -120), (-330, 500), (330, 500), (0, 650)]
    PX = 11
    # (Start, Ende, Puppe, Ziel) der Laser; Ziel: (x, y) oder 'badge'/'point'
    SHOTS = [(9.0, 9.4, 2, (30, 330)), (9.6, 10.0, 3, (1050, 520)), (10.2, 10.6, 4, (30, 1480)),
             (10.6, 10.95, 0, 'strL'), (10.6, 10.95, 1, 'strR'),
             (13.0, 13.9, 4, 'badge'), (13.1, 13.9, 5, 'badge')]
    TENSION_SHAKES = [(9.0, 6), (9.6, 6), (10.2, 6), (10.6, 14), (13.0, 8), (13.8, 16), (18.0, 22)]

    def __init__(self, W, H, U, fps, loop, geom, D, seed=9):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.cx, self.cy = geom['alice_c']
        self.hands = geom['hands']
        self.draw_text, self.INK, self.WHITE = geom['draw_text'], geom['ink'], geom['white']
        self.j = Jiggles(geom['jiggles_path'])
        rng = np.random.default_rng(seed)
        self.ph = [rng.uniform(0, 1) for _ in range(self.N)]
        self.t_app = [2.0 + 0.3 * i for i in range(self.N)]
        # Hook-Laser: Geraden durch Punkte nahe Alice, rotierend
        self.web = [dict(c=(self.cx + rng.uniform(-260, 260), self.cy + rng.uniform(-320, 320)), th=rng.uniform(0, math.pi), om=rng.uniform(-2.0, 2.0)) for _ in range(15)]
        yy, xx = np.mgrid[0:H, 0:W]
        rr = np.hypot((xx - W / 2) / (W * 0.62), (yy - H * 0.5) / (H * 0.55))
        self.vig = np.clip((rr - 0.45) / 0.8, 0, 1).astype(np.float32) ** 1.3
        self.T = (W / 2, 1390)                                                           # Zielpunkt der Salve (Namensschild)

    # ───────── Zeitleisten ─────────
    def tension(self, t):
        if t < 4.8 or t >= 19.4:
            return 0.0
        if t < 18.0:
            return smooth((t - 4.8) / 13.2)
        return 1.0 - 0.4 * smooth((t - 18.0) / 1.4)

    def ring_pos(self, i, t):
        a = 2 * math.pi * i / self.N + 0.9 * (t - 15.8)
        return (self.W / 2 + 470 * math.cos(a), 930 + 300 * math.sin(a))

    def puppet(self, i, t):
        """(x, y, sichtbar, Ladestufe, blinzelt, feuert, schlaff) der Puppe i."""
        ta = self.t_app[i]
        leave = 20.0 + 0.1 * i
        if t < ta or t >= leave + 0.7:
            return None
        ax, ay = self.cx + self.ANCHORS[i][0], self.cy + self.ANCHORS[i][1]
        ph = self.ph[i]
        hx, hy = self.hands[0 if self.ANCHORS[i][0] <= 0 else 1]
        x = ax + 16 * math.sin(2 * math.pi * (t * 0.45 + ph))
        y = ay + 20 * math.sin(2 * math.pi * (t * 0.6 + ph * 1.3))
        ru = smooth((t - 15.8) / 0.7)
        if ru > 0:                                                                       # Finale: Kreis um die Karte
            rx, ry = self.ring_pos(i, t)
            x, y = x + (rx - x) * ru, y + (ry - y) * ru
        limp = smooth((t - 18.0) / 0.5)
        if t >= 18.0:                                                                    # schlaff: hängen tiefer, schwingen aus
            y = y + 70 * limp + 14 * math.sin(6 * (t - 18.0) + i) * math.exp(-1.5 * (t - 18.0))
        if t < ta + 0.6:                                                                 # kommen von der Hand mit Überschwingen
            u = ease_out_back((t - ta) / 0.6)
            x, y = hx + (x - hx) * u, hy + (y - hy) * u
        if t >= leave:                                                                   # Fäden ziehen sie zur Hand zurück
            u = smooth((t - leave) / 0.7)
            x, y = x + (hx - x) * u, y + (hy - y) * u
        charge, fire = 0, False
        for t0, t1, p, tg in self.SHOTS:
            if p == i and t0 - 0.5 <= t < t1 + 0.25:
                charge = 1 + min(2, int((t - (t0 - 0.5)) / 0.25)) if t < t0 else (3 if t < t1 else 1)
                fire = t0 <= t < t1
        if 16.0 <= t < 18.0:
            charge = max(charge, 1 + min(2, int((t - 16.0) / 0.7)))
            fire = fire or t >= 17.2
        if t >= 18.0:
            charge, fire = 0, False
        blink = (int(t * 2.2 + ph * 7) % 9 == 0) and charge == 0
        return x, y, charge, blink, fire, limp

    def eyes(self, x, y):
        px = self.PX
        return [(x - 1.5 * px, y - 1.5 * px), (x + 1.5 * px, y - 1.5 * px)]

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

    # ───────── Zeichenhelfer ─────────
    def _beam(self, canvas, p0, p1, power=1.0):
        """Dünner roter Laser: Glühen, roter Strahl, heller Kern."""
        x0, y0 = p0
        x1, y1 = p1
        pad = 12
        bx0, by0 = int(min(x0, x1)) - pad, int(min(y0, y1)) - pad
        bx1, by1 = int(max(x0, x1)) + pad, int(max(y0, y1)) + pad
        bx0, by0, bx1, by1 = max(0, bx0), max(0, by0), min(self.W, bx1), min(self.H, by1)
        if bx1 <= bx0 or by1 <= by0:
            return
        ov = Image.new('RGBA', (bx1 - bx0, by1 - by0), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        a, b = (x0 - bx0, y0 - by0), (x1 - bx0, y1 - by0)
        d.line([a, b], fill=(255, 40, 60, int(70 * power)), width=11)
        d.line([a, b], fill=(255, 40, 55, 255), width=max(3, int(5 * power)))
        d.line([a, b], fill=(255, 225, 225, 255), width=2)
        canvas.alpha_composite(ov, (bx0, by0))

    def _spark(self, canvas, x, y, r=3):
        U = self.U
        d = ImageDraw.Draw(canvas)
        for k in range(1, r + 1):
            d.rectangle([x - k * U, y - U // 2, x + k * U, y + U // 2], fill=(255, 235, 235, 255))
            d.rectangle([x - U // 2, y - k * U, x + U // 2, y + k * U], fill=(255, 235, 235, 255))
        d.rectangle([x - U, y - U, x + U, y + U], fill=(255, 60, 70, 255))

    def _string(self, canvas, a, b, sag):
        """Dünner lila Faden (wie im Sprite) mit Durchhang."""
        d = ImageDraw.Draw(canvas)
        pts = []
        for k in range(21):
            u = k / 20.0
            pts.append((a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + sag * 4 * u * (1 - u)))
        d.line(pts, fill=(120, 30, 190, 255), width=3)
        d.line([(x + 1, y - 1) for x, y in pts], fill=(190, 110, 255, 255), width=1)

    # ───────── Interface-Zustände ─────────
    def banner_state(self, t):
        """(dx, dy, Scherung, Fäden sichtbar)"""
        if t < 5.2:
            return 0.0, 0.0, 0.0, 5.0 <= t
        if t < 10.7:
            ramp = smooth((t - 5.2) / 1.0)
            st = int(t * 6)
            return 70 * math.sin(st * 1.7) * ramp, 26 * math.sin(st * 2.3 + 1.0) * ramp, 0.05 * math.sin(st * 1.1) * ramp, True
        s = t - 10.7
        st = int(10.7 * 6)
        k = math.exp(-5 * s) * math.cos(16 * s)                                       # gekappt: federt auf seinen Platz zurück
        return 70 * math.sin(st * 1.7) * k, 26 * math.sin(st * 2.3 + 1.0) * k + 40 * math.exp(-6 * s) * abs(math.cos(10 * s)), 0.05 * k, False

    def badge_state(self, t):
        """(Hälfte links (dx, dy, Scherung), Hälfte rechts, sichtbar, Schild ganz)"""
        if t < 13.0:
            return None
        if t < 13.8:                                                                      # zittert unter dem Beschuss
            j = int(t * 30) % 2 * 2 - 1
            return (j * 4, 0, 0), (-j * 4, 0, 0), True, True
        s = t - 13.8
        if s < 1.1:                                                                       # in zwei Hälften zerschnitten, fallen weg
            return (-260 * s, 500 * s * s, -0.25 * s), (260 * s, 500 * s * s, 0.25 * s), True, False
        if t < 15.4:
            return None
        if t < 16.2:                                                                      # kommen an Fäden zurück
            u = 1 - smooth((t - 15.4) / 0.8)
            return (-420 * u, 0, 0), (420 * u, 0, 0), True, False
        s = t - 16.2
        b = -12 * math.exp(-8 * s) * abs(math.cos(16 * s))
        return (0, b, 0), (0, b, 0), True, s > 0.0

    # ───────── Zeichnen ─────────
    def draw_behind(self, canvas, f):
        pass

    def _shear(self, im, shear):
        if not shear:
            return im, 0
        h = im.height
        pad = int(abs(shear) * h) + 2
        return im.transform((im.width + 2 * pad, h), Image.AFFINE, (1, shear, -pad - shear * h / 2, 0, 1, 0), resample=Image.NEAREST), pad

    def draw_logo(self, canvas, f):
        t = f / float(self.fps)
        lx, ly, lw, lh = self.g['logo_rect']
        dx, dy, shear, strings = self.banner_state(t)
        im, pad = self._shear(self.g['logo_img'], shear)
        canvas.paste(im, (int(lx + dx - pad), int(ly + dy)), im)

    def draw_badge(self, canvas, f):
        t = f / float(self.fps)
        bx, by, bw, bh = self.g['badge_rect']
        st = self.badge_state(t)
        img = self.g['badge_img']
        if st is None:
            if t < 13.0 or t >= 16.2:
                canvas.paste(img, (bx, by), img)
            return
        (ldx, ldy, lsh), (rdx, rdy, rsh), vis, whole = st
        if whole and ldx == 0 and rdx == 0:
            canvas.paste(img, (bx, by + int(ldy)), img)
            return
        half = bw // 2
        left, right = img.crop((0, 0, half, bh)), img.crop((half, 0, bw, bh))
        for part, (dx, dy, sh), x0 in ((left, (ldx, ldy, lsh), bx), (right, (rdx, rdy, rsh), bx + half)):
            im, pad = self._shear(part, sh)
            canvas.paste(im, (int(x0 + dx - pad), int(by + dy)), im)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        W, H, U = self.W, self.H, self.U
        # Fäden zu den Püppchen (zuerst, damit sie hinter den Püppchen liegen)
        pos = {}
        for i in range(self.N):
            st = self.puppet(i, t)
            if st is None:
                continue
            pos[i] = st
            x, y, charge, blink, fire, limp = st
            hand = self.hands[0 if self.ANCHORS[i][0] <= 0 else 1]
            top = (x, y - 5.5 * self.PX)
            taut = 1.0 - 0.9 * limp
            dist = math.hypot(top[0] - hand[0], top[1] - hand[1])
            self._string(canvas, hand, top, sag=(0.06 + 0.4 * limp) * dist * (1 - 0.8 * taut) + 14 * limp)
        # Banner-Fäden (Alice bewegt das Banner)
        bdx, bdy, bsh, bstr = self.banner_state(t)
        if bstr:
            lx, ly, lw, lh = self.g['logo_rect']
            self._string(canvas, self.hands[0], (lx + 90 + bdx, ly + lh + bdy), 20)
            self._string(canvas, self.hands[1], (lx + lw - 90 + bdx, ly + lh + bdy), 20)
        # Rückkehr des Link-Schilds an Fäden
        bst = self.badge_state(t)
        if bst is not None and 15.4 <= t < 16.2:
            bx, by, bw, bh = self.g['badge_rect']
            (ldx, ldy, _), (rdx, rdy, _), _, _ = bst
            self._string(canvas, self.hands[0], (bx + bw * 0.25 + ldx, by + bh / 2), 30)
            self._string(canvas, self.hands[1], (bx + bw * 0.75 + rdx, by + bh / 2), 30)
        # Laser
        for t0, t1, p, tg in self.SHOTS:
            if t0 <= t < t1 and p in pos:
                x, y = pos[p][0], pos[p][1]
                bx, by, bw, bh = self.g['badge_rect']
                lx, ly, lw, lh = self.g['logo_rect']
                if tg == 'badge':
                    tgt = (bx + bw / 2 + (8 if p == 5 else -8), by + bh / 2)
                elif tg == 'strL':
                    tgt = ((self.hands[0][0] + lx + 90) / 2, (self.hands[0][1] + ly + lh) / 2)
                elif tg == 'strR':
                    tgt = ((self.hands[1][0] + lx + lw - 90) / 2, (self.hands[1][1] + ly + lh) / 2)
                else:
                    tgt = tg
                pw = 1.0 - 0.3 * ((t - t0) / (t1 - t0))
                for e in self.eyes(x, y):
                    self._beam(canvas, e, tgt, pw)
                if int(t * 24) % 2 == 0:
                    self._spark(canvas, int(tgt[0]), int(tgt[1]), 2)
        if 17.2 <= t < 18.0:                                                              # Finale: Dauerfeuer auf einen Punkt
            for i, st in pos.items():
                for e in self.eyes(st[0], st[1]):
                    self._beam(canvas, e, self.T, 0.8 + 0.2 * math.sin(t * 40))
            self._spark(canvas, int(self.T[0]), int(self.T[1]), 3 + int((t - 17.2) * 6))
        # Püppchen (über den Fäden und Lasern)
        for i in sorted(pos, key=lambda k: pos[k][1]):
            x, y, charge, blink, fire, limp = pos[i]
            idx = int(t * 14 + self.ph[i] * 8)
            im = self.j.stamp(idx, 3 if fire else charge, blink, self.PX, mirror=self.ANCHORS[i][0] > 0)
            canvas.paste(im, (int(x - im.width / 2), int(y - im.height + 6 * self.PX)), im)
        # Schadenszahlen
        for tn, txt, (nx, ny) in ((13.45, '-100', (self.g['badge_rect'][0] + 120, self.g['badge_rect'][1] - 30)),
                                  (13.6, '-100', (self.g['badge_rect'][0] + self.g['badge_rect'][2] - 120, self.g['badge_rect'][1] - 30))):
            if tn <= t < tn + 1.0:
                u = (t - tn) / 1.0
                if int(t * 20) % 2 == 0 or u < 0.7:
                    self.draw_text(canvas, txt, 6, (nx, ny - 70 * smooth(u)), color=(255, 244, 244), outline=(200, 20, 40), shadow=None)
        if 18.0 <= t < 19.4:
            u = (t - 18.0) / 1.4
            self.draw_text(canvas, '350', 14, (self.T[0], self.T[1] - 140 * smooth(u) - 60), color=(255, 248, 248), outline=(210, 20, 40), shadow=(60, 0, 10))

    # ───────── Bild-Nachbearbeitung: rote Vignette (Spannung) ─────────
    def post_fx(self, img, f):
        t = f / float(self.fps)
        k = self.tension(t)
        if k <= 0:
            return img
        beat = 0.5 + 0.5 * math.sin(2 * math.pi * t * (0.9 + 1.6 * k))                # Herzschlag, wird schneller
        a = (0.14 + 0.3 * k) * (0.75 + 0.25 * beat)
        arr = np.asarray(img).astype(np.float32)
        m = (self.vig * a)[..., None]
        arr = arr * (1 - m) + np.array([150, 0, 20], dtype=np.float32) * m
        return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')

    # ───────── Opener (Hook) und Schluss ─────────
    def _web(self, img, ts, strength=1.0):
        out = img.convert('RGBA')
        if ts >= 1.3:
            return out
        k = max(0.0, 1.0 - ts / 1.2) * strength
        d_ = 2400
        for ln in self.web:
            th = ln['th'] + ln['om'] * ts
            cx, cy = ln['c']
            dx, dy = math.cos(th) * d_, math.sin(th) * d_
            self._beam(out, (cx - dx, cy - dy), (cx + dx, cy + dy), 0.5 + 0.8 * k)
        return out

    def opener_fx(self, img, f, t_gust=None):
        ts = f / float(self.fps)
        if ts >= 1.3:
            return img
        return self._web(img, ts).convert('RGB')

    def closer_fx(self, img, f):
        t = f / float(self.fps)
        if t < self.D - 1.0:
            return img
        out = self._web(img, self.D - t)
        u = (t - (self.D - 1.0)) / 1.0
        a = 0.42 * u * u
        if a > 0:
            out = Image.blend(out, Image.new('RGBA', out.size, (255, 255, 255, 255)), a)
        return out.convert('RGB')

    # ───────── Soundeffekte (public/sounds): gleiche Aktion = gleicher Sound ─────────
    SND = {
        'explode': [('heavy_impact', -2), ('elem_wind', -8, 0.10)],
        'summon':  [('summon', -7)],                                                    # ein Püppchen erscheint
        'laser':   [('laser', -9)],                                                     # jeder Laserschuss
        'hit':     [('damage', -6)],                                                    # Treffer
        'cut':     [('slash', -4)],                                                     # Faden/Schild wird zerschnitten
        'lift':    [('draw', -5)],                                                      # Fäden ziehen/zurückbringen
        'land':    [('placement', -6)],
        'charge':  [('ascension', -8)],
        'beat':    [('doom_tick', -10)],
        'number':  [('gold_gain', -9)],
    }

    def sfx_events(self):
        D = self.D
        ev = []

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t + (item[2] if len(item) > 2 else 0.0), item[0], item[1]))
        ev.append((0.0, 'jumpscare', -6)); ev.append((0.05, 'laser', -7, 1.0, 1.2))     # Hook
        for i in range(self.N):
            add(self.t_app[i], 'summon')
        add(5.0, 'lift')                                                                 # Banner wird an Fäden genommen
        t = 5.3
        while t < 17.9:                                                                  # Herzschlag, wird dichter
            ev.append((t, 'doom_tick', -10))
            t += max(0.45, 0.9 - 0.03 * (t - 5.3))
        for t0, t1, p, tg in self.SHOTS:
            ev.append((t0, 'laser', -9, 1.0, 1.0))
            add(t0 + 0.2, 'hit')
        add(10.7, 'cut'); add(11.0, 'land')                                              # Banner-Fäden durchtrennt, fällt zurück
        add(13.5, 'number'); add(13.6, 'number')                                         # -100 -100
        add(13.8, 'cut'); add(15.4, 'lift'); add(16.2, 'land')                           # Link-Schild zerschnitten und zurückgeholt
        add(16.0, 'charge')                                                              # Finale lädt sich auf
        ev.append((17.2, 'laser', -7, 1.0, 1.4))
        add(18.0, 'explode'); ev.append((18.05, 'critical_strike', -6)); add(18.2, 'number')
        add(20.0, 'lift'); ev.append((D - 0.9, 'laser', -10, 1.0, 0.9))                  # Rückkehr in den Hook
        return sorted(ev)
