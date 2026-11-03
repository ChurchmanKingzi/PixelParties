"""Eis-Show für „Broghan, the Frozen Guardian of the North“: aus seinem einen roten Auge zucken rote Lichtblitze, Eiswolken ziehen auf,
das Interface friert nach und nach ein – und am Ende entlädt sich alles in einem Schlag (500 Schaden, wie auf der Karte). Spannungsbogen:

   0.0 –  1.3  HOOK     Blitz aus dem Auge: rote Lichtstrahlen in alle Richtungen, Wolkenfetzen fliegen aus seinem Kopf, Druckwelle
   1.3 –  5.0  AUFZIEHEN die Eiswolken ziehen nacheinander von den Rändern herein (je ein Windstoß), Schnee setzt ein, erste Warnblitze lassen Wolken rot aufleuchten
   5.0 –  9.0  FROST    ein Blitz trifft das Banner: es friert von der Einschlagstelle aus ein (Eiszapfen, Schnee auf der Oberkante), Herzschlag, Vignette wächst
   9.0 – 13.0  STURM    Hagel; Blitze von Wolke zu Wolke; ein Kettenblitz trifft das Link-Schild und friert es in einen Eisblock
  13.0 – 16.8  KÄLTE    Frost kriecht von den Ecken über den Kartenrahmen, die Wolken schließen sich zu einem Wirbel um die Karte, das Auge glüht immer heller
  17.0 – 18.6  SCHLAG   ein Sternblitz aus dem Auge sprengt alles Eis, die Wolken fliegen weg, „500“
  18.6 –   D   RÜCKKEHR die Scherben fallen, das Link-Schild setzt sich wieder zusammen, das Auge lädt sich neu auf → nahtlos in den Hook

Alle Methoden entsprechen der API von windfx.WindShow / alicefx.AliceShow (draw_behind/draw_front/draw_logo/draw_badge/plate_dx/sprite_dx/opener_fx/closer_fx/post_fx/sfx_events).
Alle Effekte liegen auf dem Pixelraster von Broghans Sprite (gleiche Pixelgröße), das Licht fällt – wie überall – von oben rechts."""
import math

import numpy as np
from PIL import Image, ImageDraw


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


HL, MID, LOW, DEEP = (244, 250, 255), (220, 236, 255), (185, 211, 245), (144, 141, 198)    # Palette der Wolken im Sprite
STORM = (84, 96, 156)
BOLT, BOLT_L, BOLT_HOT = (255, 40, 58), (255, 120, 132), (255, 236, 232)


def mix3(a, b, k):
    return tuple(int(round(a[i] + (b[i] - a[i]) * k)) for i in range(3))


class Cloud:
    """Pixelwolke: Zellmaske aus verschmolzenen Ellipsen mit flacher Unterseite, Licht von oben rechts."""

    def __init__(self, w, h, rng):
        self.w, self.h = w, h
        m = np.zeros((h, w), dtype=bool)
        n = max(3, w // 4)
        lumps = []
        for k in range(n):
            rx = rng.uniform(w * 0.14, w * 0.26)
            ry = rng.uniform(h * 0.35, h * 0.62)
            cx = rx + (w - 2 * rx) * (k / max(1, n - 1)) + rng.uniform(-1, 1)
            cy = h - 1 - ry * rng.uniform(0.25, 0.8)
            lumps.append((cx, cy, rx, ry))
        for j in range(h):
            for i in range(w):
                if any(((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2 <= 1.0 for cx, cy, rx, ry in lumps):
                    m[j, i] = True
        self.m = m

    def cells(self):
        m, h, w = self.m, self.h, self.w

        def at(j, i):
            return 0 <= j < h and 0 <= i < w and m[j, i]
        out = []
        for j in range(h):
            for i in range(w):
                if not m[j, i]:
                    continue
                if not at(j - 1, i) or not at(j, i + 1) or not at(j - 1, i + 1):
                    kind = 0                                                           # Licht: Kanten nach oben/rechts
                elif not at(j + 1, i) or not at(j, i - 1):
                    kind = 2                                                           # Schatten: Kanten nach unten/links
                elif (i * 3 + j * 5) % 7 == 0:
                    kind = 3
                else:
                    kind = 1
                out.append((i, j, kind))
        return out


class IceShow:
    SHOCKS = (0.0, 5.2, 10.6, 17.0)
    T_GUST = 0.0
    T_FB, T_FS, T_FP = 5.2, 10.6, 12.0                                                 # Frostbeginn: Banner, Link-Schild, Kartenrahmen
    T_STRIKE = 17.0
    T_BACK = 19.4                                                                      # Link-Schild setzt sich wieder zusammen (bis 20,2)
    TENSION_SHAKES = [(5.2, 8), (10.6, 8), (17.0, 28)]
    # (Heimat x, y, Breite, Höhe in Zellen, Eintrittszeit, Startseite, Ebene)
    CLOUDS = [
        (250, 250, 20, 7, 1.5, 'L', 'back'), (850, 170, 18, 7, 1.8, 'R', 'back'), (560, 80, 16, 6, 2.1, 'T', 'back'),
        (60, 800, 14, 6, 2.4, 'L', 'back'), (1020, 1000, 15, 6, 2.7, 'R', 'back'), (80, 1250, 16, 6, 3.0, 'L', 'back'),
        (1000, 1330, 16, 6, 3.3, 'R', 'back'), (200, 1700, 20, 7, 3.6, 'L', 'back'), (880, 1760, 20, 7, 3.9, 'R', 'back'),
        (540, 1850, 18, 6, 4.2, 'B', 'back'),
        (70, 560, 12, 5, 3.2, 'L', 'front'), (1010, 700, 12, 5, 3.6, 'R', 'front'), (40, 1100, 11, 5, 4.4, 'L', 'front'), (1030, 1180, 12, 5, 4.7, 'R', 'front'),
    ]
    RING = (540, 880, 480, 560)                                                        # Wolkenwirbel um die Karte (Mitte, Radien)

    def __init__(self, W, H, U, fps, loop, geom, D, seed=11):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.eye_fn = geom['eye_fn']
        self.draw_text = geom['draw_text']
        rng = np.random.default_rng(seed)
        self.clouds = [Cloud(c[2], c[3], rng) for c in self.CLOUDS]
        self.cloud_cells = [c.cells() for c in self.clouds]
        self.cph = [rng.uniform(0, 1) for _ in self.CLOUDS]
        self.ring_a0 = [2 * math.pi * k / len(self.CLOUDS) for k in range(len(self.CLOUDS))]
        yy, xx = np.mgrid[0:H, 0:W]
        rr = np.hypot((xx - W / 2) / (W * 0.62), (yy - H * 0.5) / (H * 0.55))
        self.vig = np.clip((rr - 0.45) / 0.8, 0, 1).astype(np.float32) ** 1.3
        # Schnee/Hagel: Rang = ab welcher Sturmstärke die Flocke sichtbar ist
        self.NF = 150
        self.fl = [dict(x=rng.uniform(0, W), y=rng.uniform(0, H + 200), v=rng.uniform(110, 270), sw=rng.uniform(8, 30), ph=rng.uniform(0, 6.3),
                        hail=rng.uniform() < 0.3, rank=k / float(self.NF)) for k in range(self.NF)]
        # Hook: rote Lichtstrahlen und Wolkenfetzen
        self.hook = [dict(th=rng.uniform(0, 2 * math.pi), om=rng.uniform(-1.6, 1.6)) for _ in range(12)]
        self.puffs = [dict(th=rng.uniform(0, 2 * math.pi), v=rng.uniform(700, 1500), w=int(rng.integers(4, 7)), h=int(rng.integers(3, 5))) for _ in range(14)]
        self.puff_clouds = [Cloud(p['w'], p['h'], rng) for p in self.puffs]
        self.puff_cells = [c.cells() for c in self.puff_clouds]
        self.rays = [2 * math.pi * k / 14 + rng.uniform(-0.12, 0.12) for k in range(14)]
        self.bnoise = rng.random((-(-geom['badge_rect'][3] // self.U), -(-geom['badge_rect'][2] // self.U)))
        self._build_bolts()
        self._build_ice()

    # ───────── Raster ─────────
    def cell(self, x, y):
        return int(math.floor((x - self.ox) / self.gp)), int(math.floor((y - self.oy) / self.gp))

    def cpos(self, ci, cj):
        return self.ox + ci * self.gp, self.oy + cj * self.gp

    def rect(self, d, ci, cj, col):
        x, y = self.cpos(ci, cj)
        d.rectangle([x, y, x + self.gp - 1, y + self.gp - 1], fill=tuple(col) + (255,))

    def eye(self, t):
        e = self.eye_fn(t)
        return e[0] + self.sprite_dx(int(t * self.fps)), e[1]

    # ───────── Eis (Banner, Link-Schild, Kartenrahmen): alle Eisstücke sind Rasterzellen mit Gefrierzeit ─────────
    def _build_ice(self):
        gp = self.gp
        self.ice = []                                                                   # (ci, cj, t_gefroren, (r,g,b,a), gruppe)

        def hh(ci, cj, k=0):
            return ((ci * 73856093) ^ (cj * 19349663) ^ (k * 83492791)) % 1000 / 1000.0

        def add_object(cov, tf0, dur, hit, grp, tint_a):
            hx, hy = hit                                                                # Gefrieren breitet sich von der Einschlagstelle aus
            dmax = max(math.hypot(self.cpos(ci, cj)[0] - hx, self.cpos(ci, cj)[1] - hy) for ci, cj in cov) or 1.0
            for (ci, cj) in cov:
                x, y = self.cpos(ci, cj)
                tc = tf0 + dur * (math.hypot(x - hx, y - hy) / dmax) ** 0.8
                up, dn, lf, rt = (ci, cj - 1) in cov, (ci, cj + 1) in cov, (ci - 1, cj) in cov, (ci + 1, cj) in cov
                if not (up and dn and lf and rt):
                    col = (244, 250, 255, 255) if (not up or not rt) else (185, 211, 245, 255)
                elif (ci + cj) % 11 in (0, 1):
                    col = (244, 250, 255, 95)                                          # Glanzstreifen (Licht von oben rechts)
                elif hh(ci, cj) < 0.12:
                    col = (235, 245, 255, 120)
                elif hh(ci, cj, 1) < 0.1:
                    col = (110, 150, 215, 90)
                else:
                    col = (170, 210, 250, tint_a)
                self.ice.append((ci, cj, tc, col, grp))
                if not dn and hh(ci, cj, 2) < 0.32:                                     # Eiszapfen
                    for k in range(1, 2 + int(hh(ci, cj, 3) * 4)):
                        self.ice.append((ci, cj + k, tc + 0.14 * k, (244, 250, 255, 255) if k % 2 else (185, 211, 245, 255), grp))
                if not up and hh(ci, cj, 4) < 0.7:                                      # Schneehaube (wächst mit dem Sturm)
                    self.ice.append((ci, cj - 1, tc + 0.3, (244, 250, 255, 255), grp))
                    if hh(ci, cj, 5) < 0.4:
                        self.ice.append((ci, cj - 2, tc + 1.6 + 2.5 * hh(ci, cj, 6), (244, 250, 255, 255), grp))
        lx, ly, lw, lh = self.g['logo_rect']
        a = np.asarray(self.g['logo_img'].convert('RGBA'))[..., 3] > 128
        ci0, cj0 = self.cell(lx, ly)
        ci1, cj1 = self.cell(lx + lw - 1, ly + lh - 1)
        cov = set()
        for cj in range(cj0, cj1 + 1):
            for ci in range(ci0, ci1 + 1):
                x, y = self.cpos(ci, cj)
                xa, ya = int(max(0, x - lx)), int(max(0, y - ly))
                xb, yb = int(min(lw, x + gp - lx)), int(min(lh, y + gp - ly))
                if xb > xa and yb > ya and a[ya:yb, xa:xb].mean() >= 0.5:
                    cov.add((ci, cj))
        add_object(cov, self.T_FB, 0.9, (self.W / 2, ly + lh), 'banner', 62)
        bx, by, bw, bh = self.g['badge_rect']                                           # Link-Schild: Eisblock mit einer Zelle Rand
        ci0, cj0 = self.cell(bx, by)
        ci1, cj1 = self.cell(bx + bw - 1, by + bh - 1)
        covb = {(ci, cj) for cj in range(cj0 - 1, cj1 + 2) for ci in range(ci0 - 1, ci1 + 2)}
        add_object(covb, self.T_FS, 0.5, (bx + bw * 0.7, by), 'badge', 58)
        px, py, pw, ph = self.g['plate_rect']                                           # Kartenrahmen: Frost kriecht von den Ecken
        ci0, cj0 = self.cell(px, py)
        ci1, cj1 = self.cell(px + pw - 1, py + ph - 1)
        corners = [(ci0, cj0), (ci1, cj0), (ci0, cj1), (ci1, cj1)]
        for cj in range(cj0, cj1 + 1):
            for ci in range(ci0, ci1 + 1):
                dd = min(ci - ci0, ci1 - ci, cj - cj0, cj1 - cj)
                if dd > 2:
                    continue
                dc = min(math.hypot(ci - c[0], cj - c[1]) for c in corners)
                tc = self.T_FP + 3.4 * min(1.0, dc / 38.0)
                if hh(ci, cj, 7) < 0.30 + 0.12 * dd:
                    continue
                col = (244, 250, 255, 235) if dd == 0 else (185, 211, 245, 210) if dd == 1 else (150, 190, 240, 170)
                self.ice.append((ci, cj, tc, col, 'plate'))
                if dd == 0 and hh(ci, cj, 8) < 0.22:                                     # Frostzacken nach außen
                    for k in range(1, 2 + int(hh(ci, cj, 9) * 2)):
                        ox_ = -k if ci - ci0 < 3 else k if ci1 - ci < 3 else 0
                        oy_ = (-k if cj - cj0 < 3 else k if cj1 - cj < 3 else 0) if ox_ == 0 else 0
                        if ox_ or oy_:
                            self.ice.append((ci + ox_, cj + oy_, tc + 0.1 * k, (244, 250, 255, 255), 'plate'))
        self.ice.sort(key=lambda e: e[2])
        ev = self.eye(0.0)
        self.shard = []                                                                  # (Startzeit des Zerspringens, vx, vy)
        for k, (ci, cj, tc, col, grp) in enumerate(self.ice):
            x, y = self.cpos(ci, cj)
            r = np.random.default_rng(1000 + k)
            ang = math.atan2(y - ev[1], x - ev[0]) + r.uniform(-0.35, 0.35)
            sp = r.uniform(450, 1500)
            self.shard.append((self.T_STRIKE + 0.05 + math.hypot(x - ev[0], y - ev[1]) / 2600.0, math.cos(ang) * sp, math.sin(ang) * sp - 300))

    # ───────── Blitze ─────────
    @staticmethod
    def _bolt_cells(c0, c1, seed):
        rng = np.random.default_rng(seed)
        n = max(abs(c1[0] - c0[0]), abs(c1[1] - c0[1]))
        if n == 0:
            return [c0]
        dx, dy = (c1[0] - c0[0]) / float(n), (c1[1] - c0[1]) / float(n)
        nx, ny = -dy, dx
        pts, j = [], 0.0
        for k in range(0, n + 1, 3):
            j = max(-3.5, min(3.5, j + rng.uniform(-1.8, 1.8)))
            pts.append((c0[0] + dx * k + nx * j * (1 - (k / float(n)) ** 3), c0[1] + dy * k + ny * j * (1 - (k / float(n)) ** 3)))
        pts.append((c1[0], c1[1]))
        cells = []
        for a, b in zip(pts[:-1], pts[1:]):
            m = int(max(abs(b[0] - a[0]), abs(b[1] - a[1])))
            for s in range(m + 1):
                u = s / float(m) if m else 0.0
                c = (int(round(a[0] + (b[0] - a[0]) * u)), int(round(a[1] + (b[1] - a[1]) * u)))
                if not cells or cells[-1] != c:
                    cells.append(c)
        return cells

    def _build_bolts(self):
        """Blitze: (t0, Dauer, Quelle, Ziel); Quelle/Ziel: 'eye', ('cloud', i), ('pt', x, y), ('ring', i)."""
        B = []
        for t0, i in ((2.7, 0), (3.4, 3), (4.1, 1), (4.6, 4)):                         # Warnblitze
            B.append((t0, 0.28, 'eye', ('cloud', i)))
        B.append((self.T_FB, 0.45, 'eye', ('pt', self.W / 2, self.g['logo_rect'][1] + self.g['logo_rect'][3])))      # Banner gefriert
        k, t = 0, 6.4
        seq = [2, 0, 3, 1, 4, 10, 11, 3]
        while t < 10.2:
            s = seq[k % len(seq)]
            B.append((t, 0.3, 'eye', ('cloud', s)))
            if k % 3 == 1:
                B.append((t + 0.12, 0.3, ('cloud', s), ('cloud', 5 if s in (3, 10, 0) else 6)))   # Wolke zu Wolke
            k += 1
            t += 0.7
        bx, by, bw, bh = self.g['badge_rect']
        B.append((self.T_FS - 0.1, 0.3, 'eye', ('cloud', 4)))                           # Kettenblitz: Auge → Wolke → Link-Schild
        B.append((self.T_FS, 0.5, ('cloud', 6), ('pt', bx + bw * 0.7, by + bh / 2)))
        t = 11.2
        while t < 14.4:
            B.append((t, 0.28, 'eye', ('cloud', seq[k % len(seq)])))
            k += 1
            t += 0.5
        t = 14.5
        while t < 16.8:                                                                  # Wirbel: Blitze in die kreisenden Wolken
            B.append((t, 0.22, 'eye', ('ring', k % len(self.CLOUDS))))
            k += 1
            t += 0.25
        self.bolts = sorted(B, key=lambda b: b[0])

    # ───────── Zeitleisten ─────────
    def storm(self, t):
        """Sturmstärke 0…1 (Schnee, Wolkenfarbe)."""
        if t < 1.5 or t >= 18.2:
            return 0.0
        if t < 17.0:
            return smooth((t - 1.5) / 6.0)
        return 1.0 - smooth((t - 17.0) / 1.2)

    def tension(self, t):
        if t < 4.8 or t >= 19.4:
            return 0.0
        if t < 17.0:
            return smooth((t - 4.8) / 12.2)
        return 1.0 - 0.5 * smooth((t - 17.0) / 2.4)

    def glow(self, t):
        D = self.D
        if t < 1.3:
            g = 1.0 - 0.45 * smooth(t / 1.3)
        elif t < 5.0:
            g = 0.28 + 0.08 * math.sin(2 * math.pi * t / 1.1)
        elif t < 13.0:
            g = 0.36 + 0.14 * math.sin(2 * math.pi * t * (0.9 + 0.7 * smooth((t - 5) / 8)))
        elif t < 17.0:
            g = 0.45 + 0.5 * smooth((t - 13.0) / 3.8) + 0.07 * math.sin(2 * math.pi * t * 4.0)
        elif t < 18.4:
            g = 1.0 - 0.5 * smooth((t - 17.0) / 1.4)
        elif t < 20.6:
            g = 0.5 - 0.3 * smooth((t - 18.4) / 2.2)
        else:
            g = 0.2 + 0.8 * smooth((t - 20.6) / (D - 20.6))
        for t0, dur, src, dst in self.bolts:                                             # Aufblitzen mit jedem Blitz aus dem Auge
            if src == 'eye' and t0 <= t < t0 + 0.35:
                g += 0.45 * math.exp(-(t - t0) / 0.12)
        return max(0.0, min(1.0, g))

    def plate_dx(self, f):
        t = f / float(self.fps)
        dx = 0.0
        for tg, a in self.TENSION_SHAKES:
            tau = t - tg
            if tau >= 0:
                dx += a * math.exp(-tau / 0.25) * math.cos(2 * math.pi * 5 * tau)
        if 15.8 <= t < 17.0:                                                             # die Karte bebt vor dem Schlag
            dx += 7 * (1 if int(t * 30) % 2 else -1)
        return int(round(dx / self.U)) * self.U

    def sprite_dx(self, f):
        return int(round(0.4 * self.plate_dx(f) / self.U)) * self.U

    # ───────── Wolken ─────────
    def _ring_angle(self, i, t):
        conv = smooth((t - 14.4) / 2.4)
        return self.ring_a0[i] + 1.8 * (t - 14.4) * (0.4 + 0.6 * conv)

    def cloud_pos(self, i, t):
        """Mittelpunkt der Wolke i (x, y) oder None, wenn sie noch nicht da/schon weg ist."""
        hx, hy, w, h, te, side, layer = self.CLOUDS[i]
        gp = self.gp
        sx0, sy0 = {'L': (-w * gp - 100, hy), 'R': (self.W + w * gp + 100, hy), 'T': (hx, -300), 'B': (hx, self.H + 300)}[side]
        if t < te:
            return None
        u = ease_out((t - te) / 1.6)
        x, y = sx0 + (hx - sx0) * u, sy0 + (hy - sy0) * u
        ph = self.cph[i]
        x += 26 * math.sin(2 * math.pi * (t / 9.0 + ph)) * u
        y += 10 * math.sin(2 * math.pi * (t / 6.5 + ph * 1.7)) * u
        cx, cy, rx, ry = self.RING
        conv = smooth((t - 14.4) / 2.4)
        if conv > 0:                                                                     # Wirbel um die Karte
            a = self._ring_angle(i, t)
            x, y = x + (cx + rx * math.cos(a) - x) * conv, y + (cy + ry * math.sin(a) - y) * conv
        if t >= self.T_STRIKE + 0.05:                                                    # Schlag: die Wolken fliegen nach außen weg
            dxv, dyv = x - self.W / 2, y - 880
            n = math.hypot(dxv, dyv) or 1.0
            k = 2200 * smooth((t - self.T_STRIKE - 0.05) / 1.1)
            x, y = x + dxv / n * k, y + dyv / n * k
            if t > self.T_STRIKE + 1.3:
                return None
        return x, y

    def cloud_front(self, i, t):
        """Front-Wolken immer vorn; im Wirbel liegt die untere Hälfte vor der Karte."""
        if self.CLOUDS[i][6] == 'front':
            return True
        if smooth((t - 14.4) / 2.4) < 0.6:
            return False
        return math.sin(self._ring_angle(i, t)) > 0.3

    def cloud_lit(self, i, t):
        """Rotes Aufleuchten, wenn ein Blitz die Wolke trifft oder verlässt."""
        v = 0.0
        for t0, dur, src, dst in self.bolts:
            if t0 <= t < t0 + 0.5 and (src == ('cloud', i) or dst == ('cloud', i) or dst == ('ring', i)):
                v = max(v, math.exp(-(t - t0) / 0.18))
        return v

    def _draw_cloud(self, d, i, t):
        pos = self.cloud_pos(i, t)
        if pos is None:
            return
        cl, gp = self.clouds[i], self.gp
        c0, r0 = self.cell(pos[0] - cl.w * gp / 2, pos[1] - cl.h * gp / 2)
        dark = 0.55 * smooth((t - 3.0) / 10.0) * (1.0 - smooth((t - 17.0) / 0.6))
        lit = self.cloud_lit(i, t)
        for (ci, cj, kind) in self.cloud_cells[i]:
            col = (HL, MID, LOW, MID)[kind] if kind != 2 else mix3(LOW, DEEP, 0.55)
            if dark:
                col = mix3(col, STORM, dark * (0.45 if kind == 0 else 1.0))
            if lit > 0.05:
                col = mix3(col, (255, 90, 100), 0.7 * lit * (0.6 if kind == 0 else 1.0))
            x, y = self.cpos(c0 + ci, r0 + cj)
            if -gp < x < self.W and -gp < y < self.H:
                d.rectangle([x, y, x + gp - 1, y + gp - 1], fill=col + (255,))

    # ───────── Zeichnen ─────────
    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        for i in range(len(self.CLOUDS)):
            if not self.cloud_front(i, t):
                self._draw_cloud(d, i, t)

    def draw_logo(self, canvas, f):
        lx, ly, lw, lh = self.g['logo_rect']
        im = self.g['logo_img']
        canvas.paste(im, (int(lx), int(ly)), im)

    def draw_badge(self, canvas, f):
        t = f / float(self.fps)
        bx, by, bw, bh = self.g['badge_rect']
        img = self.g['badge_img']
        if self.T_STRIKE + 0.2 <= t < self.T_BACK:
            return
        if self.T_BACK <= t < self.T_BACK + 0.8:                                           # setzt sich Pixel für Pixel wieder zusammen
            m = np.repeat(np.repeat(((self.bnoise < (t - self.T_BACK) / 0.8) * 255).astype(np.uint8), self.U, axis=0), self.U, axis=1)[:bh, :bw]
            im2 = img.copy()
            im2.putalpha(Image.fromarray((np.asarray(img.split()[3]).astype(np.uint16) * m // 255).astype(np.uint8), 'L'))
            canvas.paste(im2, (bx, by), im2)
            return
        canvas.paste(img, (bx, by), img)

    def _ice_layer(self, t):
        if not (self.T_FB <= t < self.T_STRIKE + 2.6):
            return None
        layer = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        gp = self.gp
        for k, (ci, cj, tc, col, grp) in enumerate(self.ice):
            if t < tc:
                break
            ts, vx, vy = self.shard[k]
            x, y = self.cpos(ci, cj)
            if t < ts:
                d.rectangle([x, y, x + gp - 1, y + gp - 1], fill=col)
                continue
            tau = t - ts
            if tau > 1.7:
                continue
            sx, sy = x + vx * tau, y + vy * tau + 0.5 * 1700 * tau * tau
            if sx < -gp or sx > self.W or sy > self.H:
                continue
            if tau > 1.0 and int(t * 24 + k) % 2:
                continue
            s = gp if tau < 0.9 else gp // 2
            d.rectangle([int(sx), int(sy), int(sx) + s - 1, int(sy) + s - 1], fill=(244, 250, 255, 255) if col[3] >= 200 else (185, 211, 245, 255))
        return layer

    def _bolt_pos(self, ep, t):
        if ep == 'eye':
            return self.eye(t)
        if ep[0] in ('cloud', 'ring'):
            return self.cloud_pos(ep[1], t)
        return (ep[1], ep[2])

    def _draw_bolt(self, d, p0, p1, seed):
        for k, c in enumerate(self._bolt_cells(self.cell(*p0), self.cell(*p1), seed)):
            col = BOLT_HOT if k < 2 else (BOLT_L if (k // 3) % 3 == 1 else BOLT)
            x, y = self.cpos(*c)
            if -self.gp < x < self.W and -self.gp < y < self.H:
                d.rectangle([x, y, x + self.gp - 1, y + self.gp - 1], fill=col + (255,))

    def _glow(self, canvas, t):
        g = self.glow(t)
        if g <= 0.02:
            return
        ex, ey = self.eye(t)
        c0, r0 = self.cell(ex, ey)
        R = int(3 + 9 * g)
        layer = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        for dj in range(-R, R + 1):
            for di in range(-R, R + 1):
                r = math.hypot(di, dj)
                if r > R:
                    continue
                col = (255, 236, 232, int(235 * min(1, g * 1.2))) if r <= R * 0.32 else (255, 70, 80, int(150 * g)) if r <= R * 0.6 else (255, 40, 58, int(70 * g))
                x, y = self.cpos(c0 + di, r0 + dj)
                d.rectangle([x, y, x + self.gp - 1, y + self.gp - 1], fill=col)
        canvas.alpha_composite(layer)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        W, H, gp = self.W, self.H, self.gp
        layer = self._ice_layer(t)                                                       # 1) Eis auf Banner, Link-Schild, Kartenrahmen
        if layer is not None:
            canvas.alpha_composite(layer)
        d = ImageDraw.Draw(canvas)
        for i in range(len(self.CLOUDS)):                                                # 2) Wolken vor der Karte
            if self.cloud_front(i, t):
                self._draw_cloud(d, i, t)
        ex, ey = self.eye(t)
        if t < 1.5:                                                                      # 3) Hook: Wolkenfetzen fliegen aus dem Kopf
            for k, p in enumerate(self.puffs):
                dist = p['v'] * (1 - math.exp(-1.2 * t)) / 1.2
                if t > 1.0 and int(t * 24 + k) % 2:
                    continue
                cl = self.puff_clouds[k]
                c0, r0 = self.cell(ex + math.cos(p['th']) * dist - cl.w * gp / 2, ey + math.sin(p['th']) * dist - cl.h * gp / 2)
                for (ci, cj, kind) in self.puff_cells[k]:
                    col = (HL, MID, LOW, MID)[kind] if kind != 2 else mix3(LOW, DEEP, 0.55)
                    x, y = self.cpos(c0 + ci, r0 + cj)
                    if -gp < x < W and -gp < y < H:
                        d.rectangle([x, y, x + gp - 1, y + gp - 1], fill=col + (255,))
        S = self.storm(t)                                                                # 4) Schnee und Hagel
        if S > 0:
            wind = 40 + 160 * S
            for p in self.fl:
                if p['rank'] >= S:
                    continue
                y = (p['y'] + p['v'] * (1 + 0.8 * S) * t) % (H + 200) - 100
                x = (p['x'] + wind * t * 0.35 + p['sw'] * math.sin(1.7 * t + p['ph'])) % W
                ci, cj = self.cell(x, y)
                if p['hail'] and t >= 9.0:
                    self.rect(d, ci, cj, HL)
                    self.rect(d, ci - 1, cj - 2, LOW)
                else:
                    self.rect(d, ci, cj, HL if int(p['ph'] * 5) % 2 else LOW)
        self._glow(canvas, t)                                                            # 5) rotes Leuchten
        d = ImageDraw.Draw(canvas)
        step = int(t * self.fps / 2)                                                     # 6) Blitze (neu gewürfelt alle 2 Videoframes)
        if t < 1.3:                                                                      # Hook: rote Lichtstrahlen in alle Richtungen
            reach = 3000 * (1.0 - smooth((t - 0.8) / 0.5))
            for k, h_ in enumerate(self.hook):
                th = h_['th'] + h_['om'] * t
                if reach > 0 and (step + k) % 3 != 2:
                    self._draw_bolt(d, (ex, ey), (ex + math.cos(th) * reach, ey + math.sin(th) * reach), 500 + k * 31 + step)
        if t >= self.D - 0.9:                                                            # Rückkehr: das Auge sprüht schon wieder Funken (→ Hook)
            u = (t - (self.D - 0.9)) / 0.9
            for k, h_ in enumerate(self.hook[:7]):
                th = h_['th'] + h_['om'] * (t - self.D)
                if (step + k) % 2 == 0:
                    r_ = 160 + 900 * u * u
                    self._draw_bolt(d, (ex, ey), (ex + math.cos(th) * r_, ey + math.sin(th) * r_), 800 + k * 17 + step)
        for bi, (t0, dur, src, dst) in enumerate(self.bolts):
            if t0 <= t < t0 + dur and step % 3 != 2:
                p0, p1 = self._bolt_pos(src, t), self._bolt_pos(dst, t)
                if p0 is None or p1 is None:
                    continue
                self._draw_bolt(d, p0, p1, 3000 + bi * 7 + step)
                if int(t * 24) % 2 == 0:                                                 # Einschlagfunke
                    c, r = self.cell(*p1)
                    for k in range(1, 3):
                        for (a_, b_) in ((k, 0), (-k, 0), (0, k), (0, -k)):
                            self.rect(d, c + a_, r + b_, BOLT_HOT)
        T0 = self.T_STRIKE                                                               # 7) Schlag: Sternblitz aus dem Auge
        if T0 <= t < T0 + 1.5:
            u = (t - T0) / 1.5
            reach = 3200 * smooth((t - T0) / 0.22)
            half = 1 if u < 0.4 else 0
            c0 = self.cell(ex, ey)
            for k, th in enumerate(self.rays):
                th2 = th + 0.15 * (t - T0)
                if u > 0.55 and (int(t * 24) + k) % 2:
                    continue
                c1 = self.cell(ex + math.cos(th2) * reach, ey + math.sin(th2) * reach)
                n = max(abs(c1[0] - c0[0]), abs(c1[1] - c0[1]))
                for s in range(n + 1):
                    ci = int(round(c0[0] + (c1[0] - c0[0]) * s / float(n or 1)))
                    cj = int(round(c0[1] + (c1[1] - c0[1]) * s / float(n or 1)))
                    x, y = self.cpos(ci, cj)
                    if not (-3 * gp < x < W + 2 * gp and -3 * gp < y < H + 2 * gp):
                        break
                    col = BOLT_HOT if (s < 7 or half) else BOLT
                    d.rectangle([x - half * gp, y - half * gp, x + gp * (1 + half) - 1, y + gp * (1 + half) - 1], fill=col + (255,))
        if T0 + 0.15 <= t < T0 + 2.0:                                                    # 8) Schaden
            u = (t - T0 - 0.15) / 1.85
            if int(t * 20) % 2 == 0 or u < 0.7:
                self.draw_text(canvas, '500', 14, (W / 2, 470 - 120 * smooth(u)), color=(255, 248, 248), outline=(210, 20, 40), shadow=(60, 0, 10))

    # ───────── Bild-Nachbearbeitung ─────────
    def post_fx(self, img, f):
        t = f / float(self.fps)
        k, S = self.tension(t), self.storm(t)
        fl = 0.75 * math.exp(-(t - self.T_STRIKE) / 0.14) if self.T_STRIKE <= t < self.T_STRIKE + 0.7 else 0.0
        if k <= 0 and S <= 0 and fl <= 0:
            return img
        arr = np.asarray(img).astype(np.float32)
        if S > 0:                                                                        # eisblauer Rand
            m = (self.vig * (0.12 + 0.3 * S))[..., None]
            arr = arr * (1 - m) + np.array([70, 130, 220], dtype=np.float32) * m
        if k > 0:                                                                        # rote Spannung, Herzschlag wird schneller
            beat = 0.5 + 0.5 * math.sin(2 * math.pi * t * (0.9 + 1.6 * k))
            m = (self.vig * (0.36 * k * k * (0.7 + 0.3 * beat)))[..., None]
            arr = arr * (1 - m) + np.array([150, 0, 20], dtype=np.float32) * m
        if fl > 0:
            arr = arr * (1 - fl) + 255.0 * fl
        return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')

    def opener_fx(self, img, f, t_gust=None):
        return img

    def closer_fx(self, img, f):
        t = f / float(self.fps)
        if t < self.D - 1.0:
            return img
        a = 0.42 * ((t - (self.D - 1.0)) / 1.0) ** 2                                      # Aufhellen wie der Blitz im ersten Bild
        return Image.blend(img.convert('RGB'), Image.new('RGB', img.size, (255, 255, 255)), a) if a > 0 else img

    # ───────── Soundeffekte (public/sounds): gleiche Aktion = gleicher Sound ─────────
    SND = {
        'explode': [('heavy_impact', -2), ('elem_wind', -8, 0.10)],
        'bolt':    [('elem_lightning', -9)],                                              # jeder Blitz
        'gust':    [('elem_wind', -12)],                                                  # eine Wolke zieht herein
        'freeze':  [('elem_ice', -5)],                                                    # etwas friert ein
        'shatter': [('creature_destroyed', -6)],                                          # Eis zerspringt
        'charge':  [('ascension', -8)],
        'number':  [('gold_gain', -9)],
        'land':    [('placement', -6)],                                                   # Link-Schild ist wieder da
    }

    def sfx_events(self):
        D = self.D
        ev = []

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t + (item[2] if len(item) > 2 else 0.0), item[0], item[1]))
        add(0.0, 'explode'); add(0.02, 'bolt')                                           # Hook
        for c in self.CLOUDS:
            add(c[4], 'gust')
        last = -1.0
        for t0, dur, src, dst in self.bolts:
            if t0 - last >= 0.2:
                add(t0, 'bolt')
                last = t0
        add(self.T_FB + 0.05, 'freeze'); add(self.T_FS + 0.05, 'freeze'); add(self.T_FP, 'freeze')
        t = 5.3
        while t < 16.9:                                                                  # Herzschlag, wird dichter
            ev.append((t, 'doom_tick', -10))
            t += max(0.4, 0.9 - 0.03 * (t - 5.3))
        add(13.0, 'charge')
        add(self.T_STRIKE, 'explode'); ev.append((self.T_STRIKE + 0.05, 'critical_strike', -6)); add(self.T_STRIKE + 0.1, 'bolt')
        add(self.T_STRIKE + 0.12, 'shatter'); add(self.T_STRIKE + 0.45, 'shatter'); add(self.T_STRIKE + 0.15, 'number')
        add(self.T_BACK + 0.8, 'land')
        ev.append((D - 1.0, 'ascension', -9, 1.2)); add(D - 0.3, 'bolt')                # Rückkehr in den Hook
        return sorted(ev)
