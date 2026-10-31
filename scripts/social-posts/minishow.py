"""Cat-Army-Show für „Cute Annoyance Mini“: eine einmalige Animation über das ganze Video (statt einer kurzen Schleife).

Ablauf (Sekunden; D = Gesamtdauer, das Video loopt nahtlos, weil die Katzen am Ende wieder die Wand vom ersten Bild bilden):
   0.0 –  0.5  Wand aus „Cute Cat“-Katzen verdeckt alles (erstes Bild)
   0.5 –  1.8  Die Katzen sprengen nach außen und geben Mini frei (Druckwelle)
   2.0 –  5.0  Banner-Raub: zwei Katzen tragen das „Pixel Parties“-Banner davon und bringen es schief zurück
   5.3 –  7.6  Katzen lugen hinter dem Rahmen hervor
   7.7 – 12.0  Eine Katze schubst das Link-Schild vom Tisch, schaut in die Kamera; eine andere bringt es zurück
  11.2 – 12.7  V-Formation fliegt durchs Bild
  12.0 – 16.0  24 Katzen kreisen um Mini (Befehl „attack.“ beschleunigt den Kreis)
  16.0 – 18.2  Die Katzen formen ein Herz (das schlägt) – dann Sprengung
  18.9 –  D    Alle Katzen fliegen zurück in die Wand (Umkehrung der Sprengung)
Mini kommentiert mit Sprechblasen („mine.“, „oops.“ …).
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def ease_out(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


def ease_in_out(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ease_out_back(x):
    x = min(1.0, max(0.0, x))
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def _components(img):
    a = np.asarray(img)[..., 3] > 0
    h, w = a.shape
    seen = np.zeros_like(a)
    comps = []
    for y in range(h):
        for x in range(w):
            if a[y, x] and not seen[y, x]:
                stack, pts = [(y, x)], []
                seen[y, x] = True
                while stack:
                    cy, cx = stack.pop()
                    pts.append((cy, cx))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and a[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True
                                stack.append((ny, nx))
                comps.append(pts)
    return [c for c in comps if len(c) > 8]


class CatSheet:
    """Die drei Posen der „Cute Cat“ aus assets/cute-cat.png: A/B = frontal (Flügel hoch/waagerecht, Flügelschlag), S = von der Seite (blickt nach links)."""

    def __init__(self, path):
        im = Image.open(path).convert('RGBA')
        arr = np.asarray(im)
        self.poses = {}
        for pts in _components(im):
            ys, xs = [p[0] for p in pts], [p[1] for p in pts]
            crop = Image.fromarray(arr[min(ys):max(ys) + 1, min(xs):max(xs) + 1].copy(), 'RGBA')
            mask = np.zeros(crop.size[::-1], dtype=bool)
            for y, x in pts:
                mask[y - min(ys), x - min(xs)] = True
            a = np.asarray(crop).copy()
            a[~mask] = 0                                                   # nur diese Pose (Nachbarposen im Rahmen entfernen)
            crop = Image.fromarray(a, 'RGBA')
            key = 'S' if crop.height >= 16 else None
            self.poses[(min(ys), key or ('A' if min(ys) < 20 else 'B'))] = crop
        self.poses = {k[1]: v for k, v in self.poses.items()}
        self._cache = {}

    def stamp(self, pose, px, mirror=False, rot=0):
        key = (pose, px, mirror, rot)
        if key not in self._cache:
            im = self.poses[pose]
            if mirror:
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            if rot:
                im = im.rotate(rot, expand=True)                           # Vielfache von 90° → exakt, keine Unschärfe
            self._cache[key] = im.resize((im.width * px, im.height * px), Image.NEAREST)
        return self._cache[key]


def put(canvas, im, cx, cy):
    """Bild mit Mittelpunkt (cx, cy) auf die Leinwand legen (auch teilweise außerhalb)."""
    canvas.paste(im, (int(round(cx - im.width / 2)), int(round(cy - im.height / 2))), im)


class MiniShow:
    BURST_T = 0.5                  # Sekunde der ersten Sprengung (Wand → Mini)
    BURST_LEN = 1.3                # so lange fliegen die Katzen nach außen (auch rückwärts am Ende)

    def __init__(self, cats, W, H, U, fps, D, geom, draw_text, ink, white):
        self.cats, self.W, self.H, self.U, self.fps, self.D = cats, W, H, U, fps, D
        self.g, self.draw_text, self.INK, self.WHITE = geom, draw_text, ink, white
        self.cx, self.cy = geom['center']
        rng = np.random.default_rng(11)
        # Wand: dicht gepackte Katzen, in versetzten Reihen
        self.wall = []
        row = 0
        y = -30
        while y < H + 90:
            x = (-20 if row % 2 else 40)
            while x < W + 100:
                self.wall.append(dict(x=x + rng.uniform(-8, 8), y=y + rng.uniform(-6, 6), ph=rng.uniform(0, 1), sp=rng.uniform(900, 1700),
                                      acc=rng.uniform(3000, 5200), px=7))
                x += 118
            y += 82
            row += 1
        cxs, cys = W / 2, H * 0.47
        for c in self.wall:
            d = math.hypot(c['x'] - cxs, c['y'] - cys)
            c['d'] = d
            c['dx'], c['dy'] = ((c['x'] - cxs) / d, (c['y'] - cys) / d) if d > 1 else (0.0, -1.0)
            c['delay'] = d / 1600.0 * 0.35
        self.wall.sort(key=lambda c: c['y'])
        # Orbit/Herz: 24 Katzen
        self.n_orb = 24
        self.orb_phase = [2 * math.pi * i / self.n_orb for i in range(self.n_orb)]
        self.orb_entry = [(rng.choice([-300, W + 300]), rng.uniform(100, H - 100)) for _ in range(self.n_orb)]
        pts = self._heart_points()
        self.heart = pts
        # Winkelverlauf des Orbits (Befehl „attack.“ bei 13.6 s beschleunigt)
        n = int(D * fps) + 2
        ts = np.arange(n) / fps
        w = 1.3 + 3.2 * np.exp(-(((ts - 13.7) / 0.35) ** 2))
        self.theta = np.cumsum(w) / fps
        # Sprechblasen: (von, bis, Text)
        self.bubbles = [(2.35, 3.7, 'mine.'), (6.2, 7.3, 'boo.'), (9.3, 10.6, 'oops.'), (13.5, 14.6, 'attack.'), (17.1, 18.1, 'hehe.')]

    def _heart_points(self):
        th = np.linspace(0, 2 * math.pi, 2000)
        x = 16 * np.sin(th) ** 3
        y = -(13 * np.cos(th) - 5 * np.cos(2 * th) - 2 * np.cos(3 * th) - np.cos(4 * th))     # y nach unten
        seg = np.hypot(np.diff(x), np.diff(y))
        cum = np.concatenate([[0], np.cumsum(seg)])
        out = []
        for i in range(self.n_orb):
            k = np.searchsorted(cum, cum[-1] * (i + 0.5) / self.n_orb)          # um eine halbe Schrittweite versetzt: keine Katze in der Kerbe über Mini
            out.append((float(x[k]), float(y[k] + 2.0)))
        return out

    # ───────── Katzen zeichnen ─────────
    def _pose(self, t, ph, speed=9.0):
        return 'A' if int(t * speed + ph * 7) % 2 == 0 else 'B'

    def _cat(self, canvas, t, x, y, px=7, ph=0.0, mirror=False, rot=0, pose=None, bob=4.0):
        p = pose or self._pose(t, ph)
        yy = y + bob * math.sin(2 * math.pi * (t * 1.4 + ph))
        put(canvas, self.cats.stamp(p, px, mirror, rot), x, yy)

    # ───────── Wand / Sprengung ─────────
    def _wall_pos(self, c, tau):
        """Position einer Wandkatze zur Zeit tau nach der Sprengung (tau ≤ 0 → auf dem Wandplatz)."""
        s = tau - c['delay']
        if s <= 0:
            return c['x'], c['y'], True
        dist = c['sp'] * s + 0.5 * c['acc'] * s * s
        return c['x'] + c['dx'] * dist, c['y'] + c['dy'] * dist, s < self.BURST_LEN

    def _draw_wall(self, canvas, t):
        taus = []
        if t < self.BURST_T + self.BURST_LEN + 0.2:
            taus.append(t - self.BURST_T)
        if t > self.D - self.BURST_LEN - 0.2:
            taus.append(self.D - t)
        for tau in taus:
            for c in self.wall:
                x, y, vis = self._wall_pos(c, tau)
                if not vis or x < -200 or x > self.W + 200 or y < -150 or y > self.H + 150:
                    continue
                self._cat(canvas, t, x, y, c['px'], c['ph'], pose=None, bob=3.0)

    # ───────── Banner-Raub ─────────
    def logo_state(self, t):
        """(dx, dy, Scherung) des Banners."""
        lx, ly, lw, lh = self.g['logo_rect']
        if t < 2.5:
            return 0, 0, 0.0
        away = -(lh + ly + 90)
        if t < 3.5:                                         # hochheben und weg
            u = ease_in_out((t - 2.5) / 1.0)
            return 28 * math.sin(u * math.pi), away * u, 0.04 * math.sin(u * 6)
        if t < 4.1:
            return 0, away, 0.0
        if t < 4.9:                                         # zurückbringen
            u = ease_in_out((t - 4.1) / 0.8)
            return 20 * math.sin(u * math.pi), away * (1 - u), -0.03 * math.sin(u * 5)
        s = t - 4.9                                         # fallen lassen: Federn und schief wackeln
        if s < 2.0:
            return 0, 18 * math.exp(-5 * s) * math.cos(16 * s) * (-1), 0.06 * math.exp(-2.2 * s) * math.cos(10 * s)
        return 0, 0, 0.0

    def draw_logo(self, canvas, t):
        lx, ly, lw, lh = self.g['logo_rect']
        dx, dy, shear = self.logo_state(t)
        im = self.g['logo_img']
        if shear:
            pad = int(abs(shear) * lh) + 2
            im = im.transform((lw + 2 * pad, lh), Image.AFFINE, (1, shear, -pad - shear * lh / 2, 0, 1, 0), resample=Image.NEAREST)
            lx -= pad
        canvas.paste(im, (int(lx + dx), int(ly + dy)), im)

    # ───────── Link-Schild ─────────
    def badge_state(self, t):
        """(dx, dy, Scherung, sichtbar)"""
        bx, by, bw, bh = self.g['badge_rect']
        if t < 8.9:
            return 0, 0, 0.0, True
        s = t - 8.9
        if s < 0.35:                                        # anschieben: Schild rutscht nach links
            u = ease_in_out(s / 0.35)
            return -260 * u, 0, 0.0, True
        s2 = s - 0.35
        dx = -260 - 500 * s2
        dy = 1500 * s2 * s2
        if by + dy > self.H + 100:
            vis = False
        else:
            vis = True
        if t < 11.1:
            return dx, dy, -0.25 * s2, vis
        if t < 12.0:                                        # zweite Katze bringt es zurück
            u = ease_in_out((t - 11.1) / 0.8)
            ox = -(self.W * 0.65) * (1 - u)
            oy = -(160) * math.sin(u * math.pi) - 0
            return ox, oy * 0.2 - 10 * (1 - u), 0.0, True
        s3 = t - 12.0
        return 0, -14 * math.exp(-6 * s3) * abs(math.cos(14 * s3)), 0.0, True

    def draw_badge(self, canvas, t):
        bx, by, bw, bh = self.g['badge_rect']
        dx, dy, shear, vis = self.badge_state(t)
        if not vis:
            return
        im = self.g['badge_img']
        if shear:
            pad = int(abs(shear) * bh) + 2
            im = im.transform((bw + 2 * pad, bh), Image.AFFINE, (1, shear, -pad - shear * bh / 2, 0, 1, 0), resample=Image.NEAREST)
            bx -= pad
        canvas.paste(im, (int(bx + dx), int(by + dy)), im)

    # ───────── hinter dem Rahmen (Peek-a-boo, Rückseite des Orbits) ─────────
    def draw_behind(self, canvas, t):
        px_, py_, pw, ph = self.g['plate_rect']
        peeks = [(5.3, 'top', px_ + pw * 0.22), (5.7, 'top', px_ + pw * 0.62), (6.1, 'top', px_ + pw * 0.9),
                 (6.5, 'left', py_ + ph * 0.28), (6.9, 'right', py_ + ph * 0.5), (7.2, 'left', py_ + ph * 0.72)]
        for t0, side, pos in peeks:
            s = t - t0
            if s < 0 or s > 1.5:
                continue
            u = ease_out_back(s / 0.35) if s < 0.35 else (1.0 if s < 1.0 else 1 - ease_in_out((s - 1.0) / 0.5))
            if side == 'top':
                self._cat(canvas, t, pos, py_ + 70 - 92 * u, 12, ph=pos / 300.0, bob=0)
            elif side == 'left':
                self._cat(canvas, t, px_ + 70 - 92 * u, pos, 12, ph=pos / 300.0, rot=90, bob=0)
            else:
                self._cat(canvas, t, px_ + pw - 70 + 92 * u, pos, 12, ph=pos / 300.0, rot=-90, bob=0)
        self._draw_orbit(canvas, t, back=True)

    # ───────── Orbit und Herz ─────────
    def _orbit_pos(self, i, t):
        k = min(len(self.theta) - 1, int(t * self.fps))
        a = self.orb_phase[i] + self.theta[k]
        rx, ry = 470, 230
        x, y = self.cx + rx * math.cos(a), self.cy + 40 + ry * math.sin(a)
        z = math.sin(a)
        return x, y, z

    def _heart_pos(self, i, t):
        beat = 0.0
        s = t - 17.0
        if s > 0:
            beat = 0.06 * max(0.0, math.sin(s * 2 * math.pi * 2.0)) ** 2
        hx, hy = self.heart[i]
        k = 30.0 * (1 + beat)
        return self.cx + hx * k, self.cy + 15 + hy * k

    def _orbit_state(self, i, t):
        """(x, y, z, px, sichtbar) der Katze i im Orbit/Herz."""
        t_arr = 12.0 + i * 0.045
        if t < t_arr or t > 18.9:
            return None
        if t >= 18.2:                                           # Herz sprengt
            tau = t - 18.2
            hx, hy = self._heart_pos(i, 18.2)
            d = math.hypot(hx - self.cx, hy - (self.cy + 15)) or 1.0
            dx, dy = (hx - self.cx) / d, (hy - (self.cy + 15)) / d
            dist = 900 * tau + 0.5 * 4200 * tau * tau
            x, y = hx + dx * dist, hy + dy * dist
            if x < -250 or x > self.W + 250 or y < -250 or y > self.H + 250:
                return None
            return x, y, 1.0, 8, True
        ox, oy, oz = self._orbit_pos(i, t)
        px = 6 + int(round(4 * (oz + 1) / 2))
        x, y, z = ox, oy, oz
        if t < t_arr + 0.8:                                     # fliegt vom Rand in den Kreis
            ex, ey = self.orb_entry[i]
            u = ease_out((t - t_arr) / 0.8)
            x, y = ex + (ox - ex) * u, ey + (oy - ey) * u
        if t >= 16.0:                                           # vom Kreis ins Herz
            u = ease_in_out((t - 16.0) / 0.9)
            hx, hy = self._heart_pos(i, t)
            x, y, z = ox + (hx - ox) * u, oy + (hy - oy) * u, oz + (1.0 - oz) * u
            px = int(round(px + (8 - px) * u))
        return x, y, z, px, True

    def _draw_orbit(self, canvas, t, back):
        items = []
        for i in range(self.n_orb):
            st = self._orbit_state(i, t)
            if st is None:
                continue
            x, y, z, px, _ = st
            if (z < 0) != back and not (t >= 16.0):
                continue
            if back and t >= 16.0:
                continue
            items.append((z, i, x, y, px))
        for z, i, x, y, px in sorted(items):
            self._cat(canvas, t, x, y, px, ph=i / 24.0, bob=2.0)

    # ───────── Einzel-Gags vorne ─────────
    def _draw_heist(self, canvas, t):
        lx, ly, lw, lh = self.g['logo_rect']
        dx, dy, shear, = self.logo_state(t)
        cyl = ly + lh * 0.5
        if 2.0 <= t < 5.4:
            if t < 2.5:                                       # anfliegen
                u = ease_out((t - 2.0) / 0.5)
                xl = -200 + (lx + 55 + 200) * u
                xr = self.W + 200 + (lx + lw - 55 - self.W - 200) * u
                yy = cyl
            elif t < 4.9:                                     # tragen
                xl, xr, yy = lx + 55 + dx, lx + lw - 55 + dx, cyl + dy
            else:                                             # abhauen
                u = ease_in_out((t - 4.9) / 0.5)
                xl, xr = lx + 55 - 700 * u, lx + lw - 55 + 700 * u
                yy = cyl - 260 * u
            if t < 4.9 + 0.5:
                self._cat(canvas, t, xl, yy, 11, ph=0.1, bob=3)
                self._cat(canvas, t, xr, yy, 11, ph=0.5, mirror=True, bob=3)

    def _draw_badge_cats(self, canvas, t):
        bx, by, bw, bh = self.g['badge_rect']
        bcy = by + bh / 2
        if 7.7 <= t < 10.9:                                   # Schubser
            if t < 8.3:
                u = ease_out((t - 7.7) / 0.6)
                x = self.W + 200 + (bx + bw + 130 - self.W - 200) * u
            elif t < 8.8:
                x = bx + bw + 130 + 22 * ease_in_out((t - 8.3) / 0.5)          # holt aus
            elif t < 9.0:
                x = bx + bw + 152 - 70 * ease_out((t - 8.8) / 0.2)             # Schlag
            elif t < 10.4:
                x = bx + bw + 82
            else:
                x = bx + bw + 82 + 900 * ease_in_out((t - 10.4) / 0.5)
            self._cat(canvas, t, x, bcy - 8, 11, ph=0.3, pose=('A' if t > 8.8 and t < 9.1 else None))
        if 11.1 <= t < 12.5:                                  # Lieferkatze
            dx, dy, _, _ = self.badge_state(t)
            if t < 12.0:
                self._cat(canvas, t, bx + bw / 2 + dx, bcy - 70 + dy, 11, ph=0.6, bob=2)
            else:
                u = ease_in_out((t - 12.0) / 0.5)
                self._cat(canvas, t, bx + bw / 2 + 900 * u, bcy - 70 - 250 * u, 11, ph=0.6, bob=2)

    def _draw_v(self, canvas, t):
        if not 11.2 <= t < 12.9:
            return
        u = (t - 11.2) / 1.7
        lead = -300 + (self.W + 700) * u
        for k in range(9):
            d = (k + 1) // 2
            side = 1 if k % 2 else -1
            if k == 0:
                x, y = lead, 1700
            else:
                x, y = lead - d * 125, 1700 + side * d * 62
            self._cat(canvas, t, x, y, 6, ph=k / 9.0, pose='S', mirror=True, bob=6)

    def _draw_bubble(self, canvas, t):
        for t0, t1, text in self.bubbles:
            if t0 <= t < t1:
                u = ease_out_back((t - t0) / 0.18)
                U = self.U
                scale = 7
                from_ = self.draw_text
                # Größe messen: Text auf Probefläche
                probe = Image.new('RGBA', (900, 160), (0, 0, 0, 0))
                bbox = self._text_size(text, scale)
                tw, th = bbox
                pad = 3 * U
                w, h = tw + 2 * pad, th + 2 * pad
                bx, by = self.cx + 215, self.g['card_top'] + 215
                lay = Image.new('RGBA', (w + 2 * U, h + 8 * U), (0, 0, 0, 0))
                d = ImageDraw.Draw(lay)
                ink, white = self.INK + (255,), (255, 248, 252, 255)
                # Blase mit abgeschnittenen Ecken
                d.rectangle([U, 0, w, h + U], fill=ink)
                d.rectangle([0, U, w + U, h], fill=ink)
                d.rectangle([2 * U, U, w - U, h], fill=white)
                d.rectangle([U, 2 * U, w, h - U], fill=white)
                # Schwänzchen zu Mini hin
                for k in range(3):
                    d.rectangle([2 * U + k * U, h + k * U, 4 * U + k * U + 2 * U, h + (k + 1) * U + U], fill=ink)
                for k in range(2):
                    d.rectangle([3 * U + k * U, h - U + k * U, 4 * U + k * U + U, h + (k + 1) * U - U], fill=white)
                self.draw_text(lay, text, scale, (w // 2 + U // 2, h // 2 + U // 2), color=self.INK, outline=None, shadow=None)
                if u != 1.0:
                    k = max(0.1, u)
                    lay = lay.resize((max(1, int(lay.width * k)), max(1, int(lay.height * k))), Image.NEAREST)
                canvas.paste(lay, (int(bx - lay.width / 2), int(by - lay.height)), lay)

    def _text_size(self, text, scale):
        from PIL import Image as _I
        probe = _I.new('RGBA', (1200, 200), (0, 0, 0, 0))
        self.draw_text(probe, text, scale, (0, 0), color=self.WHITE, outline=None, shadow=None, anchor='lt')
        bb = probe.getbbox()
        return (bb[2] - bb[0], bb[3] - bb[1]) if bb else (scale * 8, scale * 8)

    def draw_front(self, canvas, t):
        self._draw_orbit(canvas, t, back=False)
        self._draw_heist(canvas, t)
        self._draw_badge_cats(canvas, t)
        self._draw_v(canvas, t)
        self._draw_bubble(canvas, t)
        self._draw_wall(canvas, t)
