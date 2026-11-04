"""Wurzel-Show für „Kyli, the Deceptive Sapling“: Kyli ist der Avatar von „The Root of all Evil“ und lockt Opfer zu ihm, die dann gefressen werden.
Unten im Bild wächst das Gesicht des Root (zwei rote Augen, Schlund mit Zähnen), seine Äste ranken am Kartenrand hoch. Spannungsbogen:

   0.0 –  1.3  HOOK      Wurzeln schießen von den Rändern ins Bild, der Schlund brüllt auf, Kylis Augen flammen rot
   1.3 –  5.0  KÖDER     Kyli schickt leuchtende Lockkugeln zum Boden; die Schüler aus MotiveArcanum wandern verzaubert herbei
   5.0 –  7.0  ERWACHEN  die Augen des Root öffnen sich, „THE ROOT OF ALL EVIL“, Herzschlag, die Äste wachsen
   7.0 – 15.9  FRASS     Wurzeln packen ein Opfer nach dem anderen und ziehen es in den Schlund (Biss, Beben); der Root wächst mit jedem Opfer,
                         Banner, Kartenrahmen und Link-Schild werden von Wurzeln überwuchert; der Takt der Bisse wird dichter
  15.9 – 17.0  RAUSCH    Wirbel aus Wurzeln, das Auge glüht, rote Vignette
  17.0 – 17.8  SCHLUCK   zwei riesige Kiefer schlagen über dem ganzen Bild zusammen und öffnen sich wieder – alle Opfer sind weg, der Root rülpst
  17.8 –   D   RÜCKKEHR die Wurzeln ziehen sich zurück, das Auge lädt sich neu auf, neue Wurzeln brechen auf → nahtlos in den Hook

Alle Methoden entsprechen der API von icefx.IceShow (draw_behind/draw_front/draw_logo/draw_badge/plate_dx/sprite_dx/opener_fx/closer_fx/post_fx/sfx_events).
Alles liegt auf dem Pixelraster von Kylis Sprite (gleiche Pixelgröße), das Licht fällt von oben rechts."""
import math

import numpy as np
from PIL import Image, ImageDraw


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ease_in(x):
    x = min(1.0, max(0.0, x))
    return x * x


def ease_out(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


BARK_HL, BARK_MID, BARK_LOW, BARK_DK, BARK_OUT = (120, 120, 120), (78, 78, 78), (46, 46, 46), (24, 24, 24), (14, 14, 14)    # Palette des Root-Sprites
EYE_R, EYE_HL, EYE_DK = (176, 22, 38), (240, 70, 70), (40, 0, 10)
TOOTH = (244, 244, 236)
LIME, LIME_DK = (222, 255, 74), (158, 181, 53)
FLESH = (44, 0, 14)

def load_arr(path):
    return np.asarray(Image.open(path).convert('RGBA')).copy()


def crop_alpha(a):
    ys, xs = np.where(a[..., 3] > 20)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()


class RootShow:
    SHOCKS = (0.0, 7.0, 17.0)
    T_GUST = 0.0
    T_JAW = 17.0                                                                       # die Kiefer schlagen zusammen
    TENSION_SHAKES = [(7.0, 10), (17.0, 30)]
    # (Auftritt, Gefressen) je Opfer
    VICT = [(2.3, 7.0), (2.8, 8.4), (3.3, 9.6), (3.8, 10.6), (4.3, 11.5), (4.8, 12.3), (6.2, 13.0), (7.5, 13.7), (8.8, 14.3), (10.0, 14.9), (11.0, 15.4), (12.0, 15.9)]

    def __init__(self, W, H, U, fps, loop, geom, D, seed=5):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.eyes_fn = geom['eyes_fn']
        self.lure_from = geom['lure_from']
        self.draw_text = geom['draw_text']
        self.rng = np.random.default_rng(seed)
        rng = self.rng
        self.c0 = self.cell(W / 2, 0)[0]                                                # Mittelspalte des Gesichts
        self.gr = self.cell(0, 1878)[1]                                                 # Bodenzeile
        yy, xx = np.mgrid[0:H, 0:W]
        rr = np.hypot((xx - W / 2) / (W * 0.62), (yy - H * 0.5) / (H * 0.55))
        self.vig = np.clip((rr - 0.45) / 0.8, 0, 1).astype(np.float32) ** 1.3
        self.root = load_arr(geom['root_path'])                                           # Sprite „The Root of all Evil“ (32 × 60) aus PixelPartiesSprites
        self.R_COL = self.c0 - 16                                                         # Spalte der linken Sprite-Kante (Mund liegt bei Sprite-Spalte 16)
        self.R_ROW = self.gr - 59                                                         # Zeile der Sprite-Oberkante (Fußzeile = Boden)
        self.R_SPLIT = 39                                                                 # ab dieser Sprite-Zeile steht der Root vor den Opfern/Labels, darüber dahinter
        self._rcache = {}
        self.vfr = {}
        base = geom['students_dir']                                                       # die Schüler aus MotiveArcanum (PixelPartiesSprites), je Figur 1–2 Lauf- und Zappel-Bilder
        def fr(n):
            return crop_alpha(load_arr('%s/%s.png' % (base, n)))
        self.vfr['blonde'] = dict(walk=[fr('blonde-walk-a'), fr('blonde-walk-b')], flail=[fr('blonde-flail-a'), fr('blonde-flail-b')], dt=0.25, hop=True)
        self.vfr['black'] = dict(walk=[fr('black-walk-a'), fr('black-walk-b')], flail=[fr('black-flail-a'), fr('black-flail-b')], dt=0.25, hop=True)
        self.vfr['alice'] = dict(walk=[fr('alice-walk-a')], flail=[fr('alice-flail-a'), fr('alice-flail-b')], dt=0.25, hop=True)
        self.vfr['orange'] = dict(walk=[fr('orange-walk-a'), fr('orange-walk-b')], flail=None, dt=0.25, hop=True)
        self.vfr['wendy'] = dict(walk=[fr('wendy-walk-a')], flail=None, dt=0.25, hop=True)
        self.kinds = [('blonde', 'black', 'alice', 'orange', 'wendy')[k % 5] for k in range(len(self.VICT))]
        self.sides = [-1 if k % 2 == 0 else 1 for k in range(len(self.VICT))]
        self._build_overgrowth()
        self.hook = [dict(x=rng.choice([0.0, 1.0]), y=rng.uniform(0.15, 1.0), th=rng.uniform(-0.5, 0.5), ph=rng.uniform(0, 6.3)) for _ in range(11)]
        self.puff = [dict(dx=rng.uniform(-110, 110), v=rng.uniform(170, 330), t0=rng.uniform(0, 0.7), r=int(rng.integers(2, 4))) for _ in range(11)]
        self.crumbs = [[(rng.uniform(-1, 1), rng.uniform(0.3, 1.0)) for _ in range(7)] for _ in self.VICT]

    # ───────── Raster ─────────
    def cell(self, x, y):
        return int(math.floor((x - self.ox) / self.gp)), int(math.floor((y - self.oy) / self.gp))

    def cpos(self, ci, cj):
        return self.ox + ci * self.gp, self.oy + cj * self.gp

    def rect(self, d, ci, cj, col):
        x, y = self.cpos(ci, cj)
        if -self.gp < x < self.W and -self.gp < y < self.H:
            d.rectangle([x, y, x + self.gp - 1, y + self.gp - 1], fill=tuple(col) + (255,))

    def eyes(self, t):
        dx = self.sprite_dx(int(t * self.fps))
        return [(e[0] + dx, e[1]) for e in self.eyes_fn(t)]

    # ───────── Überwucherung des Interface (Banner, Link-Schild, Kartenrahmen) ─────────
    def _build_overgrowth(self):
        gp = self.gp
        self.over = []                                                                   # (ci, cj, t_gewachsen, t_zurück, farbe)

        def hh(ci, cj, k=0):
            return ((ci * 73856093) ^ (cj * 19349663) ^ (k * 83492791)) % 1000 / 1000.0
        entries = []

        def add(ci, cj, order, grp, col):
            entries.append((ci, cj, order, grp, col))
        lx, ly, lw, lh = self.g['logo_rect']
        a = np.asarray(self.g['logo_img'].convert('RGBA'))[..., 3] > 128
        ci0, cj0 = self.cell(lx, ly)
        ci1, cj1 = self.cell(lx + lw - 1, ly + lh - 1)
        cov = set()
        for cj in range(cj0, cj1 + 1):
            for ci in range(ci0, ci1 + 1):
                x, y = self.cpos(ci, cj)
                xa, ya, xb, yb = int(max(0, x - lx)), int(max(0, y - ly)), int(min(lw, x + gp - lx)), int(min(lh, y + gp - ly))
                if xb > xa and yb > ya and a[ya:yb, xa:xb].mean() >= 0.5:
                    cov.add((ci, cj))
        mid = (ci0 + ci1) / 2.0
        half = max(1.0, (ci1 - ci0) / 2.0)
        for (ci, cj) in cov:                                                              # Wurzelstränge um den Rand des Banners
            up, dn, lf, rt = (ci, cj - 1) in cov, (ci, cj + 1) in cov, (ci - 1, cj) in cov, (ci + 1, cj) in cov
            o = 1.0 - abs(ci - mid) / half                                                # von den Enden zur Mitte
            if not up and hh(ci, cj) < 0.85:
                add(ci, cj - 1, o, 'banner', BARK_MID if hh(ci, cj, 1) < 0.6 else BARK_HL)
            if not dn:
                add(ci, cj + 1, o, 'banner', BARK_LOW if hh(ci, cj, 2) < 0.6 else BARK_MID)
                if hh(ci, cj, 3) < 0.3:                                                   # hängende Ranken
                    for k in range(2, 3 + int(hh(ci, cj, 4) * 4)):
                        add(ci, cj + k, o + 0.01 * k, 'banner', BARK_LOW if k % 2 else BARK_MID)
                    add(ci, cj + 2 + int(hh(ci, cj, 4) * 4), o + 0.06, 'banner', EYE_HL if hh(ci, cj, 5) < 0.5 else LIME)
            if not lf or not rt:
                add(ci + (-1 if not lf else 1), cj, o, 'banner', BARK_MID)
        bx, by, bw, bh = self.g['badge_rect']                                             # Link-Schild: Ring und zwei Kreuzranken
        ci0, cj0 = self.cell(bx, by)
        ci1, cj1 = self.cell(bx + bw - 1, by + bh - 1)
        for ci in range(ci0 - 1, ci1 + 2):
            for cj in (cj0 - 1, cj1 + 1):
                add(ci, cj, (ci - ci0) / float(ci1 - ci0 + 1), 'badge', BARK_MID if (ci + cj) % 3 else BARK_HL)
        for cj in range(cj0 - 1, cj1 + 2):
            for ci in (ci0 - 1, ci1 + 1):
                add(ci, cj, 0.5, 'badge', BARK_LOW)
        nw = ci1 - ci0
        for k in range(0, nw + 1, 6):                                                      # kurze Ranken über den Rand, der Link bleibt lesbar
            add(ci0 + k, cj0, k / float(max(1, nw)), 'badge', BARK_MID)
            add(ci0 + k, cj1, k / float(max(1, nw)), 'badge', BARK_LOW)
        add(ci0 + nw // 2, cj0 - 2, 1.0, 'badge', EYE_HL)
        px, py, pw, ph = self.g['plate_rect']                                             # Kartenrahmen: Ranken wachsen von den unteren Ecken nach oben
        ci0, cj0 = self.cell(px, py)
        ci1, cj1 = self.cell(px + pw - 1, py + ph - 1)
        corners = [(ci0, cj1), (ci1, cj1)]
        dmax = math.hypot(ci1 - ci0, cj1 - cj0)
        for cj in range(cj0, cj1 + 1):
            for ci in range(ci0, ci1 + 1):
                dd = min(ci - ci0, ci1 - ci, cj - cj0, cj1 - cj)
                if dd > 2:
                    continue
                dc = min(math.hypot(ci - c[0], cj - c[1]) for c in corners)
                if hh(ci, cj, 7) < 0.28 + 0.14 * dd:
                    continue
                add(ci, cj, min(1.0, dc / dmax), 'plate', BARK_HL if (dd == 0 and (ci > (ci0 + ci1) / 2 or cj < (cj0 + cj1) / 2)) else BARK_MID if dd < 2 else BARK_LOW)
                if dd == 0 and hh(ci, cj, 8) < 0.2:                                        # Dornen nach außen
                    ox_ = -1 if ci - ci0 < 2 else 1 if ci1 - ci < 2 else 0
                    oy_ = (-1 if cj - cj0 < 2 else 1 if cj1 - cj < 2 else 0) if ox_ == 0 else 0
                    if ox_ or oy_:
                        add(ci + ox_, cj + oy_, min(1.0, dc / dmax) + 0.01, 'plate', BARK_OUT)
                if dd == 1 and hh(ci, cj, 10) < 0.05:                                      # kleine rote Knospen-Augen
                    add(ci, cj, min(1.0, dc / dmax) + 0.01, 'plate', EYE_HL)
        T = {'banner': (9.0, 1.3), 'badge': (13.0, 0.8), 'plate': (11.0, 4.4)}
        for (ci, cj, o, grp, col) in entries:
            t0, dur = T[grp]
            tc = t0 + dur * o
            tr = 17.6 + 2.0 * (1.0 - o) * 0.9 + 0.1 * hh(ci, cj, 11)                      # zuletzt Gewachsenes verschwindet zuerst
            self.over.append((ci, cj, tc, tr, col))

    # ───────── Zeitleisten ─────────
    def tension(self, t):
        if t < 4.8 or t >= 19.0:
            return 0.0
        if t < 17.0:
            return smooth((t - 4.8) / 12.2)
        return 1.0 - 0.5 * smooth((t - 17.0) / 2.0)

    def eye_open(self, t):
        D = self.D
        if t < 0.9:
            return 1.0
        if t < 1.4:
            return 1.0 - smooth((t - 0.9) / 0.5)
        if t < 5.4:
            return 0.0
        if t < 7.0:
            return 0.5 * smooth((t - 5.4) / 1.6)
        if t < 17.0:
            return 0.5 + 0.5 * smooth((t - 7.0) / 8.0)
        if t < 18.2:
            return 1.0
        if t < D - 1.2:
            return 1.0 - 0.9 * smooth((t - 18.2) / 1.5)
        return 0.1 + 0.9 * smooth((t - (D - 1.2)) / 1.2)

    def mouth_open(self, t):
        D = self.D
        o = 0.0
        if t < 0.55:
            o = 1.0
        elif t < 0.75:
            o = 1.0 - smooth((t - 0.55) / 0.2)
        for k, (ts, te) in enumerate(self.VICT):
            if te - 0.6 <= t < te:
                o = max(o, smooth((t - (te - 0.6)) / 0.35))
            elif te <= t < te + 0.18:
                o = max(o, 1.0 - smooth((t - te) / 0.18))
        if 15.9 <= t < 17.0:                                                               # Rausch: der Schlund gähnt
            o = max(o, 0.5 + 0.5 * smooth((t - 15.9) / 1.1))
        if t >= D - 0.5:
            o = max(o, smooth((t - (D - 0.5)) / 0.4))
        return o

    def kyli_glow(self, t):
        D = self.D
        g = 0.25 + 0.1 * math.sin(2 * math.pi * t * 0.8)
        if t < 1.3:
            g = 1.0 - 0.6 * smooth(t / 1.3)
        for ts, te in self.VICT:                                                           # Aufleuchten beim Locken
            if ts - 0.5 <= t < ts - 0.5 + 0.35:
                g += 0.5 * (1 - (t - (ts - 0.5)) / 0.35)
        if 5.0 <= t < 17.0:
            g += 0.35 * smooth((t - 5.0) / 12.0)
        if 17.0 <= t < 18.0:
            g = 1.0
        elif t >= 18.0 and t < 19.5:
            g = max(0.25, 1.0 - 0.75 * smooth((t - 18.0) / 1.5))
        if t >= D - 1.2:
            g = max(g, 0.25 + 0.75 * smooth((t - (D - 1.2)) / 1.2))
        return max(0.0, min(1.0, g))

    def plate_dx(self, f):
        t = f / float(self.fps)
        dx = 0.0
        for tg, a in self.TENSION_SHAKES:
            tau = t - tg
            if tau >= 0:
                dx += a * math.exp(-tau / 0.25) * math.cos(2 * math.pi * 5 * tau)
        for ts, te in self.VICT:                                                           # jeder Biss rüttelt kurz an der Karte
            tau = t - te
            if 0 <= tau < 0.3:
                dx += 5 * math.exp(-tau / 0.1) * math.cos(2 * math.pi * 7 * tau)
        return int(round(dx / self.U)) * self.U

    def sprite_dx(self, f):
        return int(round(0.4 * self.plate_dx(f) / self.U)) * self.U

    # ───────── Opfer ─────────
    def victim_state(self, k, t):
        """(x_px, hüpft, im Griff, löst sich auf) oder None. Sie lassen sich zuerst am Bildrand anlocken (warten) und gehen erst kurz vor dem Fressen zum Root."""
        ts, te = self.VICT[k]
        if t < ts or t >= te:
            return None
        side = self.sides[k]
        W = self.W
        xs = -260 if side < 0 else W + 260
        xw = (40 + 90 * ((k // 2) % 3)) if side < 0 else W - (40 + 90 * ((k // 2) % 3))        # Warteplatz am Rand
        xg = W / 2 + side * (250 + 30 * (k % 3))                                          # Greifpunkt neben dem Root
        t_wait = ts + 1.0
        t_go = max(t_wait, te - 1.6)
        t_arr = te - 0.7
        if t < t_wait:
            return xs + (xw - xs) * ((t - ts) / 1.0), int((t - ts) * 4) % 2 == 0, False, False
        if t < t_go:
            return xw, False, False, False
        if t < t_arr:
            return xw + (xg - xw) * ((t - t_go) / (t_arr - t_go)), int((t - t_go) * 4) % 2 == 0, False, False
        return xg, False, True, t >= te - 0.35

    def _victim_arr(self, k, t, grip):
        """Aktuelles Bild des Opfers (aus den Sprites): Laufen = Bildwechsel bzw. Idle-Zyklus, im Griff zappelt es."""
        kd = self.vfr[self.kinds[k]]
        if grip and kd['flail']:
            idx, fr, lst = int(t / 0.1 + k) % 2, None, 'flail'
        else:
            dt = kd['dt'] / (3.0 if grip else 1.0)
            idx, lst = int(t / dt + k * 3) % len(kd['walk']), 'walk'
        fr = kd[lst][idx]
        mir = self.sides[k] > 0
        self._vkey = (self.kinds[k], lst, idx, mir)
        return fr[:, ::-1] if mir else fr

    def _stamp(self, arr, key):
        if key not in self._rcache:
            im = Image.fromarray(np.ascontiguousarray(arr), 'RGBA')
            self._rcache[key] = im.resize((im.width * self.gp, im.height * self.gp), Image.NEAREST)
        return self._rcache[key]

    def _victim_origin(self, k, t, arr, hop):
        st = self.victim_state(k, t)
        h, w = arr.shape[:2]
        ci = self.cell(st[0], 0)[0] - w // 2
        cj = self.gr + 1 - h - (1 if (hop and self.vfr[self.kinds[k]]['hop']) else 0)
        return ci, cj

    def _draw_victim(self, canvas, d, k, t):
        st = self.victim_state(k, t)
        if st is None:
            return
        x, hop, grip, dissolve = st
        ts, te = self.VICT[k]
        if not dissolve:
            arr = self._victim_arr(k, t, grip)
            ci, cj = self._victim_origin(k, t, arr, hop)
            wob = (1 if int(t * 14) % 2 else 0) if grip else 0
            im = self._stamp(arr, ('v',) + self._vkey)
            px_, py_ = self.cpos(ci + wob, cj)
            canvas.paste(im, (px_, py_), im)
            if not grip and int(t * 8 + k) % 2:                                            # verzaubert: kleine Lockfunken über dem Kopf
                self.rect(d, ci + arr.shape[1] // 2, cj - 2, LIME)
                self.rect(d, ci + arr.shape[1] // 2 + 2, cj - 3, LIME_DK)
            return
        # sie lösen sich Pixel für Pixel auf und werden in den Schlund gesaugt
        tf = te - 0.35
        arr = self._victim_arr(k, tf, True)
        ci, cj = self._victim_origin(k, t, arr, False)
        mc, mr = self.c0, self.gr - 8
        ys, xs = np.where(arr[..., 3] > 20)
        dist = np.hypot(xs + ci - mc, ys + cj - mr)
        order = np.argsort(np.argsort(dist))
        for n in range(len(xs)):
            u = (t - tf - 0.22 * order[n] / float(len(xs))) / 0.3
            if u >= 1.0:
                continue
            u = max(0.0, u)
            oi, oj = ci + int(xs[n]), cj + int(ys[n])
            ni = oi + (mc - oi) * ease_in(u)
            nj = oj + (mr - oj) * ease_in(u) - 5 * math.sin(math.pi * u)
            r_, g_, b_ = arr[ys[n], xs[n], :3]
            self.rect(d, int(round(ni)), int(round(nj)), (int(r_), int(g_), int(b_)))

    def _draw_tendrils(self, d, k, t):
        ts, te = self.VICT[k]
        if not (te - 0.7 <= t < te - 0.1):
            return
        st = self.victim_state(k, t)
        if st is None:
            return
        grow = smooth((t - (te - 0.7)) / 0.25)
        cx = self.cell(st[0], 0)[0]
        for sgn, off in ((-1, -4), (1, 4)):
            Hh = int(1 + 6 * grow)
            for r in range(Hh):
                ci = cx + off + int(round(1.5 * math.sin(r * 0.9 + t * 8 + sgn)))
                self.rect(d, ci, self.gr - r, BARK_MID if r % 2 else BARK_HL)
                self.rect(d, ci + 1, self.gr - r, BARK_LOW)
            self.rect(d, cx + off, self.gr - Hh, BARK_OUT)

    # ───────── Der Root (Originalsprite, Augen und Schlund werden animiert) ─────────
    def _root_arr(self, eye_lv, mouth_lv):
        a = self.root.copy()
        al = a[..., 3] > 20
        for (r0, r1, c0_, c1_, mid) in ((21, 25, 9, 15, ('row', 23)), (36, 42, 15, 19, ('col', 17))):               # Augen: oberes Auge, senkrechtes Schlitzauge
            sub = a[r0:r1 + 1, c0_:c1_ + 1]
            eye = (sub[..., 3] > 20) & (sub[..., 0] > sub[..., 1] + 15)
            ys, xs = np.where(eye)
            for y, x in zip(ys.tolist(), xs.tolist()):
                yy, xx = r0 + y, c0_ + x
                center = (yy == mid[1]) if mid[0] == 'row' else (xx == mid[1])
                if eye_lv == 0 or (eye_lv == 1 and not center):
                    a[yy, xx, :3] = BARK_DK if center else (66, 66, 66)
                elif eye_lv == 3:
                    r_, g_, b_ = a[yy, xx, :3]
                    a[yy, xx, :3] = (255, 170, 170) if g_ > 90 else (225, 24, 34) if r_ > 100 else (150, 0, 18)
        if mouth_lv > 0:                                                                  # Schlund klafft auf (nur innerhalb der Silhouette)
            hw, hh = 4.0 + 0.9 * mouth_lv, 1.3 + 1.0 * mouth_lv
            for yy in range(40, 60):
                for xx in range(32):
                    if not al[yy, xx]:
                        continue
                    e = ((xx - 15.5) / hw) ** 2 + ((yy - 51) / hh) ** 2
                    if e <= 1.0:
                        edge = e > 0.62
                        top = yy < 51
                        if edge and abs(yy - 51) >= hh * 0.55 and (xx % 2 == 0):
                            a[yy, xx, :3] = (255, 255, 255)
                        else:
                            a[yy, xx, :3] = (54, 0, 0) if (xx + yy) % 5 == 0 else (23, 0, 0)
                    elif e <= 1.5:
                        a[yy, xx, :3] = BARK_DK
        return a

    def _eye_lv(self, t):
        e = self.eye_open(t)
        return 0 if e < 0.15 else 1 if e < 0.5 else 2 if e < 0.85 else 3

    def _root_part(self, t, part):
        eye_lv, mouth_lv = self._eye_lv(t), int(round(self.mouth_open(t) * 4))
        key = ('root', eye_lv, mouth_lv)
        if key not in self._rcache:
            self._rcache[key] = self._root_arr(eye_lv, mouth_lv)
        a = self._rcache[key]
        r0, r1 = (0, self.R_SPLIT) if part == 'back' else (self.R_SPLIT, 60)
        return self._stamp(a[r0:r1], ('rp', eye_lv, mouth_lv, part)), r0

    def _paste_root(self, canvas, t, part):
        im, r0 = self._root_part(t, part)
        x, y = self.cpos(self.R_COL, self.R_ROW + r0)
        canvas.paste(im, (x, y), im)

    def root_eye_cells(self):
        return [(self.R_COL + 17, self.R_ROW + 39)]                                   # nur das Schlitzauge glüht vor dem Interface (das obere Auge liegt hinter dem Namen)

    # ───────── Zeichnen ─────────
    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        a = 0.18 + 0.5 * self.eye_open(t)                                                 # dunkelroter Schein hinter dem Root (hebt ihn vom Hintergrund ab)
        layer = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        cx, cy = self.R_COL + 16, self.R_ROW + 46
        for dj in range(-16, 17):
            for di in range(-14, 15):
                r = math.hypot(di / 14.0, dj / 16.0)
                if r > 1.0:
                    continue
                al = int(255 * a * (0.5 if r > 0.66 else 0.8 if r > 0.33 else 1.0) * 0.32)
                x, y = self.cpos(cx + di, cy + dj)
                d.rectangle([x, y, x + self.gp - 1, y + self.gp - 1], fill=(110, 10, 30, al))
        canvas.alpha_composite(layer)
        self._paste_root(canvas, t, 'back')

    def draw_logo(self, canvas, f):
        lx, ly, lw, lh = self.g['logo_rect']
        im = self.g['logo_img']
        canvas.paste(im, (int(lx), int(ly)), im)

    def draw_badge(self, canvas, f):
        bx, by, bw, bh = self.g['badge_rect']
        img = self.g['badge_img']
        canvas.paste(img, (bx, by), img)

    def _orb_pos(self, k, t):
        """Lockkugel k: fliegt von Kylis Kleid zu ihrem Opfer, schwebt vor ihm her und wird dann vom Schlund verschlungen."""
        ts, te = self.VICT[k]
        t0 = ts - 0.5
        if t < t0 or t >= te - 0.15:
            return None
        kx, ky = self.lure_from
        side = self.sides[k]
        st = self.victim_state(k, t)
        W = self.W
        if st is None:
            vx = (-150 if side < 0 else W + 150)
        else:
            vx = st[0]
        tx = vx + (-side) * 110                                                                # etwas vor ihm, zum Schlund hin
        ty = 1735 + 8 * math.sin(t * 5 + k)
        if t < ts + 0.4:
            u = ease_out((t - t0) / 0.9)
            mx, my = (kx + tx) / 2 + side * 330, ky + 260
            x = (1 - u) ** 2 * kx + 2 * (1 - u) * u * mx + u * u * tx
            y = (1 - u) ** 2 * ky + 2 * (1 - u) * u * my + u * u * ty
            return x, y
        if t < te - 0.7:
            return tx, ty
        u = ease_in((t - (te - 0.7)) / 0.55)                                                   # in den Schlund
        return tx + (W / 2 - tx) * u, ty + (1800 - ty) * u

    def _draw_orb(self, d, canvas, k, t):
        p = self._orb_pos(k, t)
        if p is None:
            return
        ci, cj = self.cell(*p)
        for (a, b) in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            self.rect(d, ci + a, cj + b, LIME_DK)
        for (a, b) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            if int(t * 10 + k) % 2:
                self.rect(d, ci + a, cj + b, (190, 215, 70))
        self.rect(d, ci, cj, (255, 255, 210))
        if int(t * 14) % 3 == 0:
            self.rect(d, ci + 1, cj - 1, (255, 255, 255))
        if int(t * 12) % 2:
            self.rect(d, ci, cj + 2, LIME_DK)

    def _glow_eyes(self, canvas, t):
        self._glow_at(canvas, [self.cpos(c[0], c[1]) for c in self.root_eye_cells()], self.eye_open(t) ** 1.5 * 0.9, centers_are_cells=True)
        self._glow_at(canvas, self.eyes(t), self.kyli_glow(t))

    def _glow_at(self, canvas, pts, g, centers_are_cells=False):
        if g <= 0.03:
            return
        layer = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        R = int(1.5 + 4 * g)
        for (ex, ey) in pts:
            c0, r0 = self.cell(ex + (self.gp / 2 if centers_are_cells else 0), ey + (self.gp / 2 if centers_are_cells else 0))
            for dj in range(-R, R + 1):
                for di in range(-R, R + 1):
                    r = math.hypot(di, dj)
                    if r > R:
                        continue
                    col = (255, 236, 232, int(230 * min(1, g * 1.2))) if r <= R * 0.34 else (255, 70, 80, int(150 * g)) if r <= R * 0.65 else (255, 40, 58, int(70 * g))
                    x, y = self.cpos(c0 + di, r0 + dj)
                    d.rectangle([x, y, x + self.gp - 1, y + self.gp - 1], fill=col)
        canvas.alpha_composite(layer)

    def _draw_hook_roots(self, d, t):
        """Hook: Wurzelpeitschen schießen von den Rändern herein und ziehen sich wieder zurück (loopt über das Ende)."""
        te = t if t < 5 else t - self.D
        if not (-0.6 <= te < 1.3):
            return
        if te < 0.45:
            L = ease_out((te + 0.6) / 1.05) * 1.0
        else:
            L = 1.0 - smooth((te - 0.5) / 0.8)
        if L <= 0:
            return
        W, H = self.W, self.H
        for k, h in enumerate(self.hook):
            sx_ = 0 if h['x'] < 0.5 else W
            sy_ = self.H * h['y']
            if k % 3 == 0:
                sx_, sy_ = W * (k / 11.0), H
            tx, ty = W / 2 + (k - 5) * 20, 1000 + (k % 4) * 90
            n = int(34 * L)
            for s in range(n):
                u = s / 34.0
                x = sx_ + (tx - sx_) * u * 0.8 + math.sin(u * 9 + h['ph'] + te * 12) * 28
                y = sy_ + (ty - sy_) * u * 0.8 + math.cos(u * 7 + h['ph']) * 24
                ci, cj = self.cell(x, y)
                th = 2 if u < 0.5 else 1
                for a in range(th):
                    self.rect(d, ci + a, cj, BARK_MID if a == 0 else BARK_LOW)
                self.rect(d, ci, cj - 1, BARK_HL) if th == 2 else None
                if s % 5 == 4:
                    self.rect(d, ci, cj + 2, BARK_OUT)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        W, H, gp = self.W, self.H, self.gp
        d = ImageDraw.Draw(canvas)
        # Überwucherung (über Banner, Link-Schild, Kartenrahmen)
        if 9.0 <= t < 20.0:
            for (ci, cj, tc, tr, col) in self.over:
                if tc <= t < tr:
                    self.rect(d, ci, cj, col)
        # Opfer, davor der untere Teil des Root, davor die Wurzeln, die sie packen
        for k in range(len(self.VICT)):
            self._draw_victim(canvas, d, k, t)
        self._paste_root(canvas, t, 'front')
        d = ImageDraw.Draw(canvas)
        for k in range(len(self.VICT)):
            self._draw_tendrils(d, k, t)
        for k in range(len(self.VICT)):                                                       # Bissfunken (Krümel)
            te = self.VICT[k][1]
            if te <= t < te + 0.5:
                tau = t - te
                for (a, b) in self.crumbs[k]:
                    self.rect(d, self.c0 + int(a * 8 + a * tau * 14), self.gr - 8 - int(b * 14 * tau - 28 * tau * tau * 0.6), LIME if b > 0.65 else BARK_HL)
        # Lockkugeln
        for k in range(len(self.VICT)):
            self._draw_orb(d, canvas, k, t)
        # Hook-Wurzeln
        self._draw_hook_roots(d, t)
        # Rülpser nach dem Schluck
        if 17.8 <= t < 19.2:
            for p in self.puff:
                tau = t - 17.8 - p['t0']
                if tau < 0 or tau > 1.2:
                    continue
                cx, cy = self.cell(W / 2 + p['dx'] + 30 * math.sin(tau * 4), 1790 - p['v'] * tau)
                r = p['r'] + int(tau * 2)
                for dj in range(-r, r + 1):
                    for di in range(-r, r + 1):
                        if di * di + dj * dj <= r * r + 1:
                            hl = (di >= 0 and dj <= 0)
                            col = LIME if hl else LIME_DK
                            if tau > 0.8 and int(t * 24 + di + dj) % 2:
                                continue
                            self.rect(d, cx + di, cy + dj, col)
        self._glow_eyes(canvas, t)
        d = ImageDraw.Draw(canvas)
        # Kiefer (Schluck): riesige Zähne von oben und unten schlagen zusammen
        T0 = self.T_JAW
        if T0 - 0.25 <= t < T0 + 0.95:
            if t < T0:
                u = ease_in((t - (T0 - 0.25)) / 0.25)
            elif t < T0 + 0.25:
                u = 1.0
            else:
                u = 1.0 - ease_out((t - (T0 + 0.25)) / 0.7)
            rows_total = (H // gp) + 2
            cover = int(u * (rows_total / 2 + 3))
            j0 = self.cell(0, 0)[1]
            ncol = W // gp + 2
            for jj in range(cover):
                for ii in range(ncol):
                    ci = self.cell(0, 0)[0] + ii
                    teeth = (jj >= cover - 2 and ii % 4 in (0, 1, 2)) or (jj == cover - 3 and ii % 4 == 1)
                    col = TOOTH if (teeth and u < 1.0 or (teeth and jj >= cover - 2)) else (FLESH if (ii + jj) % 9 else (70, 0, 20))
                    self.rect(d, ci, j0 + jj, col)
                    self.rect(d, ci, j0 + rows_total - 1 - jj, col if not teeth else TOOTH)
            if u >= 1.0 and t < T0 + 0.2:                                                       # Aufprall: Zahnreihen treffen sich
                pass

    # ───────── Bild-Nachbearbeitung ─────────
    def post_fx(self, img, f):
        t = f / float(self.fps)
        k = self.tension(t)
        fl = 0.55 * math.exp(-(t - (self.T_JAW + 0.2)) / 0.1) if self.T_JAW + 0.2 <= t < self.T_JAW + 0.7 else 0.0
        if k <= 0 and fl <= 0:
            return img
        arr = np.asarray(img).astype(np.float32)
        if k > 0:
            beat = 0.5 + 0.5 * math.sin(2 * math.pi * t * (0.9 + 1.6 * k))
            m = (self.vig * (0.1 + 0.45 * k * k * (0.7 + 0.3 * beat)))[..., None]
            arr = arr * (1 - m) + np.array([90, 0, 14], dtype=np.float32) * m
        if fl > 0:
            arr = arr * (1 - fl) + 255.0 * fl
        return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')

    def opener_fx(self, img, f, t_gust=None):
        return img

    def closer_fx(self, img, f):
        return img

    # ───────── Soundeffekte (public/sounds): gleiche Aktion = gleicher Sound ─────────
    SND = {
        'explode': [('heavy_impact', -2), ('elem_wind', -8, 0.10)],
        'lure':    [('summon', -8)],                                                      # eine Lockkugel entsteht
        'grab':    [('chain_add', -8)],                                                   # Wurzeln packen ein Opfer
        'chomp':   [('attack_ram', -6)],                                                  # Biss
        'grow':    [('elem_biomancy', -6)],                                               # etwas wird überwuchert
        'awake':   [('ability_activate', -8)],                                            # die Augen des Root öffnen sich
        'belch':   [('poison', -7)],
        'charge':  [('ascension', -8)],
    }

    def sfx_events(self):
        D = self.D
        ev = []

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t + (item[2] if len(item) > 2 else 0.0), item[0], item[1]))
        add(0.0, 'explode'); add(0.02, 'grow')                                            # Hook
        for ts, te in self.VICT:
            add(ts - 0.5, 'lure')
            add(te - 0.7, 'grab')
            add(te + 0.05, 'chomp')
        add(5.6, 'awake'); add(9.0, 'grow'); add(11.0, 'grow'); add(13.0, 'grow')
        t = 5.3
        while t < 16.9:                                                                   # Herzschlag, wird dichter
            ev.append((t, 'doom_tick', -10))
            t += max(0.4, 0.9 - 0.03 * (t - 5.3))
        add(14.5, 'charge')
        add(self.T_JAW - 0.05, 'explode'); ev.append((self.T_JAW + 0.2, 'critical_strike', -6))
        add(17.9, 'belch')
        ev.append((D - 1.0, 'ascension', -9, 1.2))                                          # Rückkehr in den Hook
        return sorted(ev)
