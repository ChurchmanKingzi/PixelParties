"""Alice-Show für „Alice, the Puppeteer Girl“: ihre Mr. Jiggles (weiße Stoffpüppchen mit roten Augen, aus ihrem Sprite) tanzen an Fäden um sie,
das Interface wird zur Marionette, und die Püppchen schießen dünne rote Laser aus den Augen – mit Spannungsbogen:

   0.0 –  1.3  HOOK     Blitz, Druckwelle; Alice' eigenes Mr. Jiggles im Sprite schießt einen Laser-Fächer aus seinen Augen
   1.3 –  5.0  RUF      die sieben äußeren Mr. Jiggles erscheinen erst bei ihrem Spawn-Sound – samt Faden, der von Alice' Hand mitwächst
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

    def eye_cells(self, idx):
        """Zellen (Spalte, Zeile) der beiden Augen im 15×16-Rahmen des Frames idx (nicht gespiegelt; Wackeln, Stauchen und Scherung eingerechnet)."""
        a = self._arr(idx, 0, False)
        ys, xs = np.where((a[..., 0] == 210) & (a[..., 1] == 0) & (a[..., 2] == 0) & (a[..., 3] > 0))
        pts = sorted(zip(xs.tolist(), ys.tolist()))
        if len(pts) < 2:
            return [(5, 8), (8, 8)]
        mid = sum(p[0] for p in pts) / len(pts)
        out = []
        for side in (lambda x: x <= mid, lambda x: x > mid):
            g = [p for p in pts if side(p[0])]
            out.append((sum(p[0] for p in g) / len(g), sum(p[1] for p in g) / len(g)))
        return out

    def top_row(self, idx):
        """Oberste belegte Zeile der Kopfmitte (Fadenansatz) im 16-Zeilen-Rahmen des Frames idx."""
        a = self._arr(idx, 0, False)
        col = a[:, 7, 3] > 0                                                             # Mitte des 15 Spalten breiten Rahmens
        return int(np.argmax(col)) if col.any() else 4

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
    ANCHORS = [(-440, 70), (440, 70), (-440, -230), (440, -230), (-400, 480), (400, 480), (0, 690)]
    PX = 14                                                                        # dieselbe Pixelgröße wie Alice' Sprite (und ihre Fäden)
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
        self.ox, self.oy, self.gp = geom['grid']                                          # Raster des Sprites (Ursprung und Pixelgröße)
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
        self.F1, self.F2 = round(0.45 * D) / D, round(0.6 * D) / D                       # ganzzahlige Schwebezyklen je Video → nahtloser Loop
        # Hook-/Schluss-Laser: je Auge ein Laser mit eigener Drehrichtung
        self.hook = [dict(th=rng.uniform(0, 2 * math.pi), om=rng.uniform(-2.2, 2.2)) for _ in range(14)]
        self.seyes = geom['sprite_eyes_fn']                                               # Augenpixel des Sprite-Püppchens je Frame (Bildschirmkoordinaten)

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

    def limp_amount(self, i, t):
        """Schlaffheit 0 (aufgezogen) … 1 (hängt schlaff): nur nach der Salve (ab 18,0 s)."""
        return smooth((t - 18.0) / 0.5) if t >= 18.0 else 0.0

    def puppet(self, i, t):
        """(x, y, Ladestufe, blinzelt, feuert, schlaff) der Puppe i – oder None, solange sie nicht da ist (sie erscheint erst bei ihrem Spawn-Sound)."""
        ta = self.t_app[i]
        leave = 20.0 + 0.1 * i
        if t < ta or t >= leave + 0.7:
            return None
        ax, ay = self.cx + self.ANCHORS[i][0], self.cy + self.ANCHORS[i][1]
        ph = self.ph[i]
        hx, hy = self.hands[0 if self.ANCHORS[i][0] <= 0 else 1]
        x = ax + 16 * math.sin(2 * math.pi * (t * self.F1 + ph))
        y = ay + 20 * math.sin(2 * math.pi * (t * self.F2 + ph * 1.3))
        ru = smooth((t - 15.8) / 0.7) * (1.0 - smooth((t - 18.0) / 0.3))
        if ru > 0:                                                                       # Finale: Kreis um die Karte
            rx, ry = self.ring_pos(i, t)
            x, y = x + (rx - x) * ru, y + (ry - y) * ru
        limp = self.limp_amount(i, t)
        y += 90 * limp + (14 * math.sin(6 * (t - 18.0) + i) * math.exp(-1.5 * (t - 18.0)) if 18.0 <= t < 19.5 else 0.0)
        if t < ta + 0.6:                                                                 # Spawn: fliegt von Alice' Hand an seinen Platz (Faden wächst mit), Überschwingen
            u = ease_out_back((t - ta) / 0.6)
            x, y = hx + (x - hx) * u, hy + (y - hy) * u
        if t >= leave:                                                                   # Ende: die Fäden ziehen sie zurück in die Hand
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
        if ta <= t < ta + 0.3:                                                           # Spawn: die Augen leuchten auf
            charge, fire = 3, False
        blink = (int(t * 2.2 + ph * 7) % 9 == 0) and charge == 0
        return x, y, charge, blink, fire, limp

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
    LASER = (255, 40, 58)
    LASER_HOT = (255, 232, 232)

    def _beam(self, canvas, p0, p1, power=1.0):
        """Dünner roter Laser im Pixelraster des Sprites: eine Zelle (14 px) breit, beginnt in der Zelle des Auges (p0) und läuft bis zum Ziel (p1) bzw. zum Bildrand."""
        gp, ox, oy = self.gp, self.ox, self.oy
        c0 = (int(math.floor((p0[0] - ox) / gp)), int(math.floor((p0[1] - oy) / gp)))
        c1 = (int(math.floor((p1[0] - ox) / gp)), int(math.floor((p1[1] - oy) / gp)))
        n = max(abs(c1[0] - c0[0]), abs(c1[1] - c0[1]))
        d = ImageDraw.Draw(canvas)
        last = None
        for k in range(n + 1):
            u = k / float(n) if n else 0.0
            ci, cj = int(round(c0[0] + (c1[0] - c0[0]) * u)), int(round(c0[1] + (c1[1] - c0[1]) * u))
            if (ci, cj) == last:
                continue
            last = (ci, cj)
            x, y = ox + ci * gp, oy + cj * gp
            if x < -gp or x > self.W or y < -gp or y > self.H:
                if k > 2:
                    break
                continue
            col = self.LASER_HOT if k == 0 else self.LASER
            d.rectangle([x, y, x + gp - 1, y + gp - 1], fill=col + (255,))

    def _spark(self, canvas, x, y, r=3):
        U = self.U
        d = ImageDraw.Draw(canvas)
        for k in range(1, r + 1):
            d.rectangle([x - k * U, y - U // 2, x + k * U, y + U // 2], fill=(255, 235, 235, 255))
            d.rectangle([x - U // 2, y - k * U, x + U // 2, y + k * U], fill=(255, 235, 235, 255))
        d.rectangle([x - U, y - U, x + U, y + U], fill=(255, 60, 70, 255))

    STRING_COLORS = ((75, 1, 117), (154, 47, 231))                                    # dunkel / hell wie im Sprite

    def _string(self, canvas, a, b, sag, own=None):
        """Faden wie in Alice' Sprite: Quadrate in der Pixelgröße des Sprites auf seinem Raster, dunkel und hell im Wechsel.
        own = (Bild, left, top) des eigenen Püppchens: dort bleibt das Püppchen über dem Faden."""
        gp, ox, oy = self.gp, self.ox, self.oy
        n = max(8, int(math.hypot(b[0] - a[0], b[1] - a[1]) / (gp * 0.4)))
        cells = []
        for k in range(n + 1):
            u = k / float(n)
            x = a[0] + (b[0] - a[0]) * u
            y = a[1] + (b[1] - a[1]) * u + sag * 4 * u * (1 - u)
            c = (int(math.floor((x - ox) / gp)), int(math.floor((y - oy) / gp)))
            if not cells or cells[-1] != c:
                cells.append(c)
        for k, (ci, cj) in enumerate(cells):
            col = self.STRING_COLORS[k % 2]
            x0, y0 = int(ox + ci * gp), int(oy + cj * gp)
            box = (x0, y0, x0 + gp, y0 + gp)
            mask = None
            if own is not None:
                im, ol, ot = own
                if x0 < ol + im.width and x0 + gp > ol and y0 < ot + im.height and y0 + gp > ot:
                    al = Image.new('L', (gp, gp), 0)
                    al.paste(im.getchannel('A'), (int(ol) - x0, int(ot) - y0))
                    mask = al.point(lambda v: 255 if v < 128 else 0)                      # nur dort zeichnen, wo das Püppchen nicht ist
            canvas.paste(col, box, mask)

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

    def _placements(self, t):
        """Püppchen platzieren (auf dem Raster des Sprites); die Fäden enden genau an der Kopfmitte des jeweiligen Frames."""
        pos, place = {}, {}
        gp = self.gp
        for i in range(self.N):
            st = self.puppet(i, t)
            if st is None:
                continue
            pos[i] = st
            x, y, charge, blink, fire, limp = st
            idx = int(t * 14 + self.ph[i] * 8)
            im = self.j.stamp(idx, 3 if fire else charge, blink, self.PX, mirror=self.ANCHORS[i][0] > 0)
            left = self.ox + round((x - im.width / 2 - self.ox) / gp) * gp
            top = self.oy + round((y - im.height + 6 * self.PX - self.oy) / gp) * gp
            attach = (left + 7.5 * self.PX, top + (self.j.top_row(idx) + 0.5) * self.PX)
            mir = self.ANCHORS[i][0] > 0
            eyes = []
            for (ec, er) in self.j.eye_cells(idx):                                        # Augenpixel des gezeigten Frames (gespiegelt, wenn das Püppchen gespiegelt ist)
                col = 14 - int(ec) if mir else int(ec)
                eyes.append((left + (col + 0.5) * self.PX, top + (int(er) + 0.5) * self.PX))
            place[i] = (im, left, top, attach, eyes)
        return pos, place

    def _draw_strings(self, canvas, t, pos, place):
        """Alle Fäden (Püppchen, Banner, zurückkehrendes Link-Schild): über allem, nur nicht über ihrem eigenen Mr. Jiggles; jeder beginnt in einer Hand von Alice."""
        hdx = self.sprite_dx(int(t * self.fps))
        hands = [(h[0] + hdx, h[1]) for h in self.hands]
        for i, st in pos.items():
            hand = hands[0 if self.ANCHORS[i][0] <= 0 else 1]
            attach = place[i][3]
            limp = st[5]
            dist = math.hypot(attach[0] - hand[0], attach[1] - hand[1])
            self._string(canvas, hand, attach, sag=(0.06 + 0.4 * limp) * dist * (0.2 + 0.8 * limp) + 14 * limp, own=(place[i][0], place[i][1], place[i][2]))
        # Banner-Fäden (Alice bewegt das Banner)
        bdx, bdy, bsh, bstr = self.banner_state(t)
        if bstr:
            lx, ly, lw, lh = self.g['logo_rect']
            self._string(canvas, hands[0], (lx + 90 + bdx, ly + lh + bdy), 20)
            self._string(canvas, hands[1], (lx + lw - 90 + bdx, ly + lh + bdy), 20)
        # Rückkehr des Link-Schilds an Fäden
        bst = self.badge_state(t)
        if bst is not None and 15.4 <= t < 16.2:
            bx, by, bw, bh = self.g['badge_rect']
            (ldx, ldy, _), (rdx, rdy, _), _, _ = bst
            self._string(canvas, hands[0], (bx + bw * 0.25 + ldx, by + bh / 2), 30)
            self._string(canvas, hands[1], (bx + bw * 0.75 + rdx, by + bh / 2), 30)


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
        pos, place = self._placements(t)
        # Püppchen (über den Fäden)
        for i in sorted(pos, key=lambda k: pos[k][1]):
            im, left, top, attach, _eyes = place[i]
            canvas.paste(im, (int(left), int(top)), im)
        # Laser (über den Püppchen, damit man sieht, dass sie am Augenpixel beginnen): jeder startet in der Zelle eines Augenpixels und ist daran gebunden
        bx, by, bw, bh = self.g['badge_rect']
        lx, ly, lw, lh = self.g['logo_rect']
        for t0, t1, p, tg in self.SHOTS:
            if t0 <= t < t1 and p in pos:
                if tg == 'badge':
                    tgt = (bx + bw / 2 + (8 if p == 5 else -8), by + bh / 2)
                elif tg == 'strL':
                    tgt = ((self.hands[0][0] + lx + 90) / 2, (self.hands[0][1] + ly + lh) / 2)
                elif tg == 'strR':
                    tgt = ((self.hands[1][0] + lx + lw - 90) / 2, (self.hands[1][1] + ly + lh) / 2)
                else:
                    tgt = tg
                for e in place[p][4]:
                    self._beam(canvas, e, tgt)
                if int(t * 24) % 2 == 0:
                    self._spark(canvas, int(tgt[0]), int(tgt[1]), 2)
        if 17.2 <= t < 18.0:                                                              # Finale: Dauerfeuer auf einen Punkt
            for i in pos:
                for e in place[i][4]:
                    self._beam(canvas, e, self.T)
            self._spark(canvas, int(self.T[0]), int(self.T[1]), 3 + int((t - 17.2) * 6))
        if t < 1.3 or t >= self.D - 1.0:                                                  # Hook und Rückkehr: Laser-Fächer aus den Augen von Alice' eigenem Mr. Jiggles im Sprite
            te = t if t < 1.3 else self.D - t
            reach = 2800 * (1.0 - smooth((te - 1.0) / 0.3))
            if reach > 0:
                for side, e in enumerate(self.seyes(t)):
                    e = (e[0] + self.sprite_dx(int(t * self.fps)), e[1])
                    for k in range(7):
                        h = self.hook[(side * 7 + k) % len(self.hook)]
                        th = h['th'] + h['om'] * te
                        self._beam(canvas, e, (e[0] + math.cos(th) * reach, e[1] + math.sin(th) * reach))
        self._draw_strings(canvas, t, pos, place)                                          # Fäden zuletzt: über allem außer ihrem eigenen Püppchen
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

    # ───────── Opener (Hook) und Schluss: die Laser kommen aus den Augen der Püppchen (siehe draw_front), hier nur der Blitz ─────────
    def opener_fx(self, img, f, t_gust=None):
        return img

    def closer_fx(self, img, f):
        t = f / float(self.fps)
        if t < self.D - 1.0:
            return img
        u = (t - (self.D - 1.0)) / 1.0
        a = 0.42 * u * u                                                                  # Aufhellen wie der Blitz des Punch im ersten Bild
        return Image.blend(img.convert('RGB'), Image.new('RGB', img.size, (255, 255, 255)), a) if a > 0 else img

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
