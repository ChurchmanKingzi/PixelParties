"""Netz-Show für „Alleria, the Queen of Spiders“: sie spannt ein Netz über das ganze Bild, legt Surprises verdeckt aus und aktiviert sie genau dann, wenn die Gegner
angreifen. Oben stehen die drei gegnerischen Helden (verdeckt, um 180° gedreht), unten Allerias Surprise-Zone mit drei verdeckten Karten, bewacht von Spinnen
(Spinnen-Sprites „spodders“ aus PixelPartiesSprites). Spannungsbogen:

   0.0 –  1.3  HOOK     das Netz wächst Ring um Ring aus Alleria heraus, Spinnen laufen an den Speichen nach außen
   1.3 –  3.8  AUFBAU   drei Surprises werden verdeckt in die Surprise-Zone gelegt (je eine Spinne wacht), die gegnerischen Helden fallen oben ins Bild
   3.8 –  8.4  AKT 1    Feuerball des linken Helden → „Crimson Web“: der Angriff wird negiert, der Angreifer in ein Netz gesponnen und kann nicht mehr handeln
   8.4 – 13.0  AKT 2    Blitz des mittleren Helden trifft Alleria → „Jumper Spider“: 2 Karten ziehen, die Spinne springt in die Support-Zone
  13.0 – 17.6  AKT 3    Pfeile des rechten Helden → „Spider Avalanche“: eine Spinnenlawine schlägt bei allen Gegnern ein (20 × Anzahl der Spinnen)
  17.6 – 19.6  FINALE   alle Spinnen sammeln sich im Netz, die Karten werden wieder verdeckt
  19.6 –   D   ABGANG   das Netz zieht sich zusammen → nahtlos in den Hook

Jede Surprise-Aktivierung lässt Alleria 1 Karte ziehen (ihr Passiv). Die Surprises sind die echten Karten (Kartenrenderer des Spiels).
Alle Methoden entsprechen der API von cosmosfx.CosmosShow."""
import math

import numpy as np
from PIL import Image, ImageDraw


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


WEB, WEB_DK = (236, 232, 246), (172, 166, 196)
RED, RED_DK = (222, 40, 70), (120, 10, 30)
GOLD, GOLD_HL = (255, 214, 64), (255, 244, 170)


class WebShow:
    T_ACT = [3.8, 8.4, 13.0]
    CW, CH = 180, 252
    SLOT_X = [330, 540, 750]
    SLOT_Y = 1762
    OPP_X = [300, 540, 780]
    OPP_Y = 128
    OW, OH = 160, 224
    OPP_NAMES = ['opp-ida', 'opp-solrym', 'opp-hatusbal']                               # Ida (Feuerball), Sol Rym (Chain Lightning), Hatusbal (Sand)
    CARD_NAMES = ['crimson-web', 'jumper-spider', 'spider-avalanche', 'spider-silk-bridge']
    LABELS = ['CRIMSON WEB', 'JUMPER', 'AVALANCHE']
    SPIDER_FILES = ['spider-c06-12x8', 'spider-c07-12x8', 'spider-c10-14x8', 'spider-c11-15x9', 'spider-c12-17x13']

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self.center = geom['center']                                                    # Allerias Netzmitte
        base = geom['assets_dir']
        self.rng = np.random.default_rng(seed)
        yy, xx = np.mgrid[0:H, 0:W]
        rr = np.hypot((xx - W / 2) / (W * 0.62), (yy - H * 0.5) / (H * 0.55))
        self.vig = np.clip((rr - 0.45) / 0.8, 0, 1).astype(np.float32) ** 1.3
        self._cache = {}
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        self.cards = [ld(n).resize((self.CW, self.CH), Image.BOX) for n in self.CARD_NAMES]
        from PIL import ImageEnhance
        cb = Image.open(geom['cardback_path']).convert('RGB')
        self.back_big = cb.resize((self.CW, self.CH), Image.BOX).convert('RGBA')
        w, h = 98 // U, 133 // U
        inner = ImageEnhance.Color(ImageEnhance.Contrast(cb.resize((w - 2, h - 3), Image.BOX)).enhance(1.35)).enhance(1.5).convert('RGBA')
        c = Image.new('RGBA', (w, h), (255, 150, 40, 255))
        c.paste(inner, (1, 1))
        self.opp_back = c.transpose(Image.ROTATE_180).resize((98, 133), Image.NEAREST)        # gegnerische Helden: verdeckt, 180° gedreht
        ow, oh = self.OW // U, self.OH // U                                             # gegnerische Helden: offene Karten, 180° gedreht, Pixelraster des Reels
        self.opp_open, self.opp_hit = [], []
        for n in self.OPP_NAMES:
            im = ld(n).convert('RGB').transpose(Image.ROTATE_180).resize((ow, oh), Image.BOX)
            a = np.asarray(im).astype(np.float32)
            hit = np.clip(a * np.array([1.0, 0.35, 0.35]) + np.array([70, 0, 0]), 0, 255).astype(np.uint8)    # Treffer: rot gefärbt (feste Farbvariante, kein Alpha)
            self.opp_open.append(Image.fromarray(a.astype(np.uint8), 'RGB').resize((ow * U, oh * U), Image.NEAREST).convert('RGBA'))
            self.opp_hit.append(Image.fromarray(hit, 'RGB').resize((ow * U, oh * U), Image.NEAREST).convert('RGBA'))
        self.spiders = [self._outlined(ld(n)) for n in self.SPIDER_FILES]
        self.trap = ld('trapping')
        self._build_web()
        self.SHOCKS = tuple([0.0] + [t + 1.25 for t in self.T_ACT] + [self.T_ACT[2] + 1.9])
        self.TENSION_SHAKES = [(t, 8 if i == 0 else 11) for i, t in enumerate(self.SHOCKS)]
        self.T_GUST = 0.0
        self.spokes = [2 * math.pi * k / 14 + 0.12 for k in range(14)]
        self.rain = [dict(x=self.rng.uniform(0, W), v=self.rng.uniform(900, 1500), ph=self.rng.uniform(0, 6.3), k=int(self.rng.integers(5)), dly=self.rng.uniform(0, 0.6)) for _ in range(28)]
        self.hook_sp = [dict(a=a, k=i % 2, dly=0.05 * i) for i, a in enumerate(self.spokes[::2])]

    # ───────── Raster / Hilfen ─────────
    def cell(self, x, y):
        return int(math.floor((x - self.ox) / self.gp)), int(math.floor((y - self.oy) / self.gp))

    def cpos(self, ci, cj):
        return self.ox + ci * self.gp, self.oy + cj * self.gp

    def rect(self, d, ci, cj, col):
        x, y = self.cpos(ci, cj)
        if -self.gp < x < self.W and -self.gp < y < self.H:
            d.rectangle([x, y, x + self.gp - 1, y + self.gp - 1], fill=tuple(col) + ((255,) if len(col) == 3 else ()))

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + ((255,) if len(col) == 3 else ()))

    def _outlined(self, im):
        """Die schwarzen Spinnen werden aufgehellt (Silbergrau, rote Augen bleiben) und bekommen eine dunkle Kante, damit sie auf dunklem Grund lesbar bleiben."""
        a = np.asarray(im).copy().astype(np.float32)
        m = a[..., 3] > 20
        red = (a[..., 0] > a[..., 1] + 50) & m
        lum = a[..., :3].mean(axis=2)
        light = np.clip(70 + lum * 2.4, 0, 255)
        out_rgb = np.stack([light * 1.0, light * 0.97, light * 1.1], axis=2)
        out_rgb[red] = a[red][:, :3]
        P = 2
        p = np.pad(m, P)
        ring = p.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ring |= np.roll(np.roll(p, dy, 0), dx, 1)
        res = np.zeros(p.shape + (4,), dtype=np.uint8)
        res[ring & ~p] = (24, 18, 34, 255)
        pr = np.pad(out_rgb, ((P, P), (P, P), (0, 0)))
        res[p, :3] = np.clip(pr[p], 0, 255).astype(np.uint8)
        res[p, 3] = 255
        return Image.fromarray(res, 'RGBA')

    def stamp(self, im, key, scale=None):
        k = (key, scale or self.gp)
        if k not in self._cache:
            s = scale or self.gp
            self._cache[k] = im.resize((im.width * s, im.height * s), Image.NEAREST)
        return self._cache[k]

    def _line_cells(self, p0, p1):
        c0, c1 = self.cell(*p0), self.cell(*p1)
        n = max(abs(c1[0] - c0[0]), abs(c1[1] - c0[1]))
        out = []
        for s in range(n + 1):
            u = s / float(n or 1)
            out.append((int(round(c0[0] + (c1[0] - c0[0]) * u)), int(round(c0[1] + (c1[1] - c0[1]) * u))))
        return out

    def _draw_line(self, d, p0, p1, dotted=False):
        for k, (ci, cj) in enumerate(self._line_cells(p0, p1)):
            if dotted and k % 3 == 2:
                continue
            self.rect(d, ci, cj, WEB if k % 4 else WEB_DK)

    # ───────── Netz (hinter der Karte): Ring für Ring, damit es wachsen und beben kann ─────────
    RINGS = [90, 170, 260, 370, 500, 660, 860, 1100]

    def _build_web(self):
        cx, cy = self.center[0], 880
        self.web_c = (cx, cy)
        n = 14
        ang = [2 * math.pi * k / n + 0.12 for k in range(n)]
        self.web_layers = []
        for ri, r in enumerate(self.RINGS):
            im = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
            d = ImageDraw.Draw(im)
            pts = [(cx + 0.9 * r * math.cos(a), cy + r * math.sin(a)) for a in ang]
            for k in range(n):                                                          # Ring: Sehnen mit leichtem Durchhang
                p, q = pts[k], pts[(k + 1) % n]
                mid = ((p[0] + q[0]) / 2 * 0.95 + cx * 0.05, (p[1] + q[1]) / 2 * 0.95 + cy * 0.05)
                self._draw_line(d, p, mid, dotted=True)
                self._draw_line(d, mid, q, dotted=True)
            r0 = self.RINGS[ri - 1] if ri else 0
            for a in ang:                                                               # Speichen-Stück bis zu diesem Ring
                self._draw_line(d, (cx + 0.9 * r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + 0.9 * r * math.cos(a), cy + r * math.sin(a)))
            self.web_layers.append(im)

    def _draw_web(self, canvas, t):
        shake = 0.0
        for tg in self.SHOCKS:
            tau = t - tg
            if 0 <= tau < 0.9:
                shake += 22 * math.exp(-tau / 0.25) * math.cos(2 * math.pi * 7 * tau)
        grow = 1.0 if t >= 1.3 else t / 1.3
        out = 1.0 - smooth((t - (self.D - 1.2)) / 1.0) if t >= self.D - 1.2 else 1.0
        for ri, im in enumerate(self.web_layers):
            if grow < (ri + 1) / float(len(self.RINGS)) - 0.0 and t < 1.3:
                if grow * len(self.RINGS) < ri:
                    continue
            if out < 1.0 and ri > out * len(self.RINGS):
                continue
            dx = int(round(shake * (ri + 1) / len(self.RINGS) / self.gp)) * self.gp
            canvas.alpha_composite(im, (dx, 0)) if dx == 0 else canvas.paste(im, (dx, 0), im)

    # ───────── Interface ─────────
    def draw_behind(self, canvas, f):
        self._draw_web(canvas, f / float(self.fps))

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

    # ───────── Zeitplan der Akte ─────────
    def slot_t(self, i):
        return 1.5 + 0.5 * i                                                            # Surprise i wird verdeckt abgelegt

    def reveal_t(self, i):
        return self.T_ACT[i] + 1.25

    def drawn_events(self):
        """(Zeit, Anzahl): Allerias Passiv (+1) und Jumper Spider (+2)."""
        ev = []
        for i in range(3):
            ev.append((self.reveal_t(i) + 0.3, 1))
        ev.append((self.reveal_t(1) + 0.55, 2))
        return sorted(ev)

    def drawn(self, t):
        n = 0
        for tt, v in self.drawn_events():
            if t >= tt + 0.5:
                n += v
        return n

    def surprises(self, t):
        n = sum(1 for i in range(3) if t >= self.slot_t(i) + 0.3)
        n -= sum(1 for i in range(3) if t >= self.reveal_t(i))
        if t >= self.T_ACT[2] + 4.6:
            n = 0
        return n

    def spider_count(self, t):
        n = sum(1 for i in range(3) if t >= self.slot_t(i) + 0.5)
        if t >= self.reveal_t(1) + 0.4:
            n += 1
        return n

    # ───────── Zeichnen ─────────
    def _spider(self, canvas, k, x, y, t, flip=False):
        im = self.spiders[k]
        s = self.stamp(im, ('sp', k))
        canvas.paste(s, (int(round((x - s.width / 2) / self.gp) * self.gp), int(round((y - s.height / 2) / self.gp) * self.gp)), s)

    def _crawl_k(self, t, i=0):
        return (int(t * 8) + i) % 2                                                      # zwei Beinstellungen im Wechsel

    def _draw_opp(self, canvas, d, t):
        T = self.T_ACT[2] + 1.25
        for i, x in enumerate(self.OPP_X):
            t_in = 2.9 + 0.2 * i
            if t < t_in:
                continue
            u = ease_out((t - t_in) / 0.3)
            y = self.OPP_Y - 130 * (1 - u)
            ta = t - (T + 0.9 + 0.12 * i)                                                 # Spider Avalanche beißt zu
            hit = 0 <= ta < 0.7
            im = self.opp_hit[i] if (hit and int(t * 15) % 2 == 0) else self.opp_open[i]
            sh = (6 if int(t * 30) % 2 else -6) if hit else 0
            canvas.paste(im, (int(round((x - im.width / 2 + sh) / self.U) * self.U), int(round((y - im.height / 2) / self.U) * self.U)), im)
            if i == 0 and t >= self.reveal_t(0) + 0.4:                    # Crimson Web: der Angreifer ist eingesponnen
                self._web_ball(d, x, self.OPP_Y, 120)
                if int(t * 6) % 2:
                    self.draw_text(canvas, "CAN'T ACT", 2, (x, self.OPP_Y + 134), color=WEB, outline=None, shadow=(20, 10, 30))
                self._spider(canvas, 2, x + 60, self.OPP_Y + 10, t)
            if hit:                                                                       # Spinnen krabbeln über die Karte
                for k in range(4):
                    sx = x + (k - 1.5) * 34 + 8 * math.sin(t * 20 + k * 2)
                    sy = self.OPP_Y + (k % 2 - 0.5) * 70 + 8 * math.sin(t * 17 + k)
                    self._spider(canvas, (k + int(t * 10)) % 5, sx, sy, t)

    def _web_ball(self, d, x, y, r):
        for k in range(10):
            a = 2 * math.pi * k / 10
            self._draw_line(d, (x, y), (x + math.cos(a) * r, y + math.sin(a) * r * 1.2))
        for rr in (r * 0.4, r * 0.7, r):
            for k in range(10):
                a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
                self._draw_line(d, (x + math.cos(a0) * rr, y + math.sin(a0) * rr * 1.2), (x + math.cos(a1) * rr, y + math.sin(a1) * rr * 1.2), dotted=True)

    def _draw_slots(self, canvas, d, t):
        gone = smooth((t - (self.T_ACT[2] + 4.6)) / 0.7)
        cx, cy = self.center
        for i, x in enumerate(self.SLOT_X):
            ts = self.slot_t(i)
            if t < ts:
                continue
            x0, y0 = x - self.CW / 2, self.SLOT_Y - self.CH / 2
            tr = self.reveal_t(i)
            # Faden von Alleria zur Karte
            u = smooth((t - ts) / 0.35)
            self._draw_line(d, (cx, cy + 330), (cx + (x - cx) * u, cy + 330 + (y0 - cy - 330) * u), dotted=True)
            im = self.cards[i] if t >= tr else self.back_big
            if t < ts + 0.3:
                nz = np.random.default_rng(i).random((-(-self.CH // self.U), -(-self.CW // self.U)))
                m = np.repeat(np.repeat(((nz < (t - ts) / 0.3) * 255).astype(np.uint8), self.U, axis=0), self.U, axis=1)[:self.CH, :self.CW]
                im = im.copy()
                im.putalpha(Image.fromarray((np.asarray(im.split()[3]).astype(np.uint16) * m // 255).astype(np.uint8), 'L'))
            if gone > 0:
                key = ('gone', i, int(gone * 10))
                if key not in self._cache:
                    nz = np.random.default_rng(10 + i).random((-(-self.CH // self.U), -(-self.CW // self.U)))
                    m = np.repeat(np.repeat(((nz > gone) * 255).astype(np.uint8), self.U, axis=0), self.U, axis=1)[:self.CH, :self.CW]
                    im2 = self.cards[i].copy()
                    im2.putalpha(Image.fromarray((np.asarray(im2.split()[3]).astype(np.uint16) * m // 255).astype(np.uint8), 'L'))
                    self._cache[key] = im2
                im = self._cache[key]
            shake = 0
            if tr - 0.35 <= t < tr:
                shake = 6 if int(t * 30) % 2 else -6                                     # die Surprise zuckt kurz vor dem Aufdecken
            canvas.paste(im, (int(x0 + shake), int(y0)), im)
            if t >= tr and gone <= 0:
                self.draw_text(canvas, self.LABELS[i], 2, (x, y0 - 16), color=GOLD_HL if t - tr < 1.0 else (255, 255, 255), outline=None, shadow=(20, 10, 30))
            # Wächter-Spinne
            if t >= ts + 0.5 and gone <= 0:
                sx, sy = x - 60 + 4 * math.sin(t * 3 + i), y0 - 6
                if t >= tr and i == 1 and t > tr + 0.4:
                    continue                                                             # Jumper Spider springt davon
                if t >= tr + 0.4 and i != 1:
                    sx, sy = x + 70 + (i - 1) * 4, y0 - 6
                self._spider(canvas, 2 + (i % 2), sx, sy, t)

    EXCL = ['XXX', 'XXX', 'XXX', 'XXX', 'XXX', '...', 'XXX', 'XXX']

    def _draw_activate(self, canvas, d, t):
        """Aufmerksamkeit für aufgedeckte Surprises: goldener Rahmen blinkt und ein „!“ springt, beim Aufdecken Blitz, Ringe und Strahlen (Rasterzellen, harte Kanten)."""
        import gamefx
        C = gamefx.C30
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        gp = self.gp
        for i, x in enumerate(self.SLOT_X):
            tr = self.reveal_t(i)
            tau = t - tr
            if not (-0.5 <= tau < 0.9):
                continue
            if self.slot_t(i) + 0.3 > t:
                continue
            x0, y0 = x - self.CW / 2, self.SLOT_Y - self.CH / 2
            X, Y = self._cellpt(x, self.SLOT_Y)
            X, Y = gamefx.rd(X), gamefx.rd(Y)
            if tau < 0.35 and int(t * 15) % 2 == 0:                                       # blinkender Rahmen (4 Zellen Abstand, 1 Zelle dick)
                th = gp
                self.pix_rect(d, x0 - 2 * gp, y0 - 2 * gp, x0 + self.CW + 2 * gp, y0 - 2 * gp + th - 1, GOLD_HL)
                self.pix_rect(d, x0 - 2 * gp, y0 + self.CH + 2 * gp - th, x0 + self.CW + 2 * gp, y0 + self.CH + 2 * gp - 1, GOLD_HL)
                self.pix_rect(d, x0 - 2 * gp, y0 - 2 * gp, x0 - 2 * gp + th - 1, y0 + self.CH + 2 * gp, GOLD_HL)
                self.pix_rect(d, x0 + self.CW + 2 * gp - th, y0 - 2 * gp, x0 + self.CW + 2 * gp - 1, y0 + self.CH + 2 * gp, GOLD_HL)
            if -0.5 <= tau < 0.5:                                                          # „!“ hüpft über der Karte
                bob = -(int(t * 12) % 2) * gp
                cx, cy = self._cellpt(x, y0 - 150)
                cx, cy = gamefx.rd(cx) - 1, gamefx.rd(cy) + bob // gp
                for r, row in enumerate(self.EXCL):
                    for c, ch in enumerate(row):
                        if ch == 'X':
                            for dx in (-1, 0, 1):
                                for dy in (-1, 0, 1):
                                    if dx or dy:
                                        m.rect(cx + c + dx, cy + r + dy, 1, 1, C['tinte'])
                for r, row in enumerate(self.EXCL):
                    for c, ch in enumerate(row):
                        if ch == 'X':
                            m.rect(cx + c, cy + r, 1, 1, C['gelb'] if c == 1 or r > 5 else C['org'])
            if 0 <= tau < 0.07:                                                           # Aufdeck-Blitz: Karte kurz weiß
                self.pix_rect(d, x0, y0, x0 + self.CW - 1, y0 + self.CH - 1, (255, 255, 255))
            if 0 <= tau < 0.7:
                m.ring(X, Y, gamefx.rd(gamefx.ease(tau / 0.4) * 13), 2 if tau < 0.12 else 1, C['creme'], False)
                if tau > 0.04:
                    m.ring(X, Y, gamefx.rd(gamefx.ease((tau - 0.04) / 0.5) * 19), 1, C['gelb'], False)
                if tau > 0.1:
                    m.ring(X, Y, gamefx.rd(gamefx.ease((tau - 0.1) / 0.55) * 26), 1, C['org'], True)
            if 0 <= tau < 0.3:
                L = gamefx.ease(min(1.0, tau / 0.1)) * (1 - max(0.0, (tau - 0.1) / 0.2))
                for r in range(16):
                    an = r * math.pi / 8 + 0.2
                    ln = L * (9 if r % 2 else 17)
                    m.linie(X, Y, gamefx.rd(X + math.cos(an) * ln), gamefx.rd(Y + math.sin(an) * ln), 1 if r % 2 else 2, C['gelb'] if r % 2 else C['creme'])

    # ───────── Untertitel im Video ─────────
    CAPTIONS = [
        (1.2, 4.0, 'One trap, two traps, three traps - *Alleria* has set them all!'),
        (4.1, 8.0, 'A *Fireball*? Pfff, *negated*! Here, have a *web* instead!'),
        (8.6, 12.7, 'Ouch - *lightning*? The *Jumper Spider* jumps out for support!'),
        (13.1, 17.4, 'Throwing *sand*? Throw your *Spider Avalanche* back!'),
        (17.7, 20.4, 'Set the trap. Spring the *Surprise*!'),
    ]
    CPS = 38.0                                                                           # Schreibmaschine: Zeichen pro Sekunde

    def _tw(self, text, scale):
        tmp = Image.new('RGBA', (4, 4))
        x, y, w, h = self.draw_text(tmp, text, scale, (0, 0), color=(255, 255, 255), outline=None, shadow=None, anchor='lm')
        return w - 2 * scale

    def _cap_layout(self, idx):
        key = ('cap', idx)
        if key in self._cache:
            return self._cache[key]
        scale = 4
        maxw = 880
        text = self.CAPTIONS[idx][2]
        space = self._tw('A A', scale) - self._tw('AA', scale)
        words = []                                                                       # (Wort ohne *, gold?, Zeichenindex des Anfangs)
        gold, n = False, 0
        for raw in text.split(' '):
            pieces = []
            cur = ''
            for ch in raw:
                if ch == '*':
                    if cur:
                        pieces.append((cur, gold)); cur = ''
                    gold = not gold
                else:
                    cur += ch
            if cur:
                pieces.append((cur, gold))
            words.append(pieces)
        # Zeilen umbrechen (ein „Wort“ kann aus mehreren gefärbten Stücken bestehen, z. B. „*Fireball*?“)
        lines, cur, cw = [], [], 0
        for pieces in words:
            ww = sum(self._tw(p, scale) for p, g in pieces)
            add = ww if not cur else space + ww
            if cur and cw + add > maxw:
                lines.append((cur, cw)); cur, cw = [], 0; add = ww
            cur.append(pieces); cw += add
        lines.append((cur, cw))
        # Zeichenpositionen
        out, ci = [], 0
        for li, (ws, lw) in enumerate(lines):
            x = -lw / 2.0
            for pieces in ws:
                for p, g in pieces:
                    out.append((li, x, p, g, ci))
                    ci += len(p); x += self._tw(p, scale)
                ci += 1; x += space
        res = dict(scale=scale, lines=len(lines), items=out, width=max(lw for ws, lw in lines), total=ci)
        self._cache[key] = res
        return res

    def _draw_caption(self, canvas, d, t):
        for idx, (t0, t1, text) in enumerate(self.CAPTIONS):
            if not (t0 <= t < t1):
                continue
            L = self._cap_layout(idx)
            sc = L['scale']
            n = int((t - t0) * self.CPS)
            lh = sc * 12
            bw, bh = L['width'] + 6 * sc * 2, L['lines'] * lh + 5 * sc * 2
            cx, cy = 540, 1150
            u = self.U
            x0 = int(round((cx - bw / 2) / u) * u); y0 = int(round((cy - bh / 2) / u) * u)
            x1 = x0 + int(round(bw / u) * u); y1 = y0 + int(round(bh / u) * u)
            d.rectangle([x0 - 2 * u, y0 - 2 * u, x1 + 2 * u - 1, y1 + 2 * u - 1], fill=(20, 10, 30, 255))
            d.rectangle([x0 - 2 * u, y0 - 2 * u, x1 + 2 * u - 1, y1 + 2 * u - 1], outline=GOLD, width=u)
            d.rectangle([x0, y0, x1 - 1, y1 - 1], outline=(120, 100, 170, 255), width=max(1, u // 2))
            ty = y0 + (bh - L['lines'] * lh) // 2 + lh // 2
            for li, x, p, g, ci in L['items']:
                if ci >= n:
                    break
                shown = p[:n - ci]
                self.draw_text(canvas, shown, sc, (cx + x, ty + li * lh), color=GOLD_HL if g else (255, 255, 255), outline=None, shadow=(20, 10, 30), anchor='lm')
            return

    def _cellpt(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def _draw_attack(self, canvas, d, t):
        """Die drei Angriffe sind Python-Nachbauten der echten Spiel-Animationen (gamefx.py): Feuerball, Kettenblitz, Sandstrahl."""
        import gamefx
        cx, cy = self.center
        tgt = (cx, 690)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        T0, T1, T2 = self.T_ACT
        # Akt 1: Feuerball – bleibt im Crimson Web hängen (Flug endet beim Aufdecken)
        src0 = (self.OPP_X[0], self.OPP_Y + 105)
        if not hasattr(self, '_fb'):
            self._fb = gamefx.Feuerball(self._cellpt(*src0), self._cellpt(*tgt), tA=1.7, k=0.75, gr=0.85, stop=self.reveal_t(0) - (T0 + 0.3), kill=self.reveal_t(0) - (T0 + 0.3) + 0.45)
        tau = t - (T0 + 0.3)
        if 0 <= tau < self._fb.kill + 0.8:
            self._fb.draw(m, tau)
            if t >= self.reveal_t(0) and t < self.reveal_t(0) + 0.5:
                hx, hy = self._fb.kopf(self._fb.stop)
                px, py = self.cpos(hx, hy)
                self._web_ball(d, px, py, 110)
        # Akt 2: Kettenblitz trifft Alleria
        if not hasattr(self, '_kb'):
            self._kb = gamefx.Kettenblitz(self._cellpt(self.OPP_X[1], self.OPP_Y + 105), self._cellpt(*tgt), step=1, k=0.62)
        t_b = self.reveal_t(1) - gamefx.LT
        self._kb.laden(m, t - (T1 + 0.3), t_b - (T1 + 0.3))
        if t >= t_b:
            self._kb.draw(m, t - t_b)
        # Akt 3: Sandstrahl
        if not hasattr(self, '_sd'):
            self._sd = gamefx.Sandstrahl((self.OPP_X[2], self.OPP_Y + 105), tgt, self.gp, dur=800, dichte=2.2)
        self._sd.draw(m, t - (T2 + 0.4))
        # Schadenszahlen auf Alleria (Akt 2, 3)
        for a in (1, 2):
            tau = t - (self.T_ACT[a] + 1.25)
            if 0 <= tau < 0.9:
                self.draw_text(canvas, str(90 if a == 1 else 60), 8, (tgt[0] + 230, 660 - 100 * smooth(tau / 0.9)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)
        # Akt 1: Negation
        tau = t - self.reveal_t(0)
        if 0 <= tau < 0.9:
            self.draw_text(canvas, 'NEGATED', 6, (tgt[0], 600 - 60 * smooth(tau / 0.9)), color=WEB, outline=(90, 80, 130), shadow=None)

    def _blit(self, canvas, im, x, y):
        canvas.paste(im, (int(round(x - im.width / 2)), int(round(y - im.height / 2))), im)

    def _draw_jumper(self, canvas, d, t):
        """Akt 2: die Jumper Spider springt aus der aufgedeckten Karte in Allerias Support-Zone."""
        tr = self.reveal_t(1) + 0.4
        if t < tr:
            return
        sx, sy = self.SLOT_X[1], self.SLOT_Y - 150
        ex, ey = 960, 1130
        u = min(1.0, (t - tr) / 0.7)
        x = sx + (ex - sx) * u
        y = sy + (ey - sy) * u - 420 * math.sin(math.pi * u)
        if t >= self.T_ACT[2] + 4.6:
            return
        k = 4 if u < 1.0 else 3
        self._spider(canvas, k, x, y + (math.sin(t * 6) * 6 if u >= 1 else 0), t)

    def _draw_avalanche(self, canvas, d, t):
        T = self.T_ACT[2] + 1.25
        tau = t - T
        if not (0 <= tau < 2.4):
            return
        n = self.spider_count(t)
        for r in self.rain:                                                               # die Lawine: Spinnen stürmen nach oben in die gegnerische Seite
            u = (tau - r['dly']) / 1.1
            if u < 0 or u > 1.4:
                continue
            x0 = 200 + 680 * ((r['k'] % 5) / 4.0) + 40 * math.sin(r['ph'])
            x = x0 + (self.OPP_X[int(r['ph']) % 3] - x0) * min(1.0, u) + 40 * math.sin(tau * 8 + r['ph'])
            y = 900 + (self.OPP_Y - 900) * min(1.0, u) + 40 * math.sin(tau * 9 + r['ph'])
            self._spider(canvas, (r['k'] + int(t * 8)) % 5, x, y, t)
        for i, ox in enumerate(self.OPP_X):                                               # 20 × Anzahl der Spinnen auf jedem Gegner
            ta = tau - 0.9 - 0.12 * i
            if 0 <= ta < 1.1:
                self.draw_text(canvas, str(20 * n), 8, (ox, 270 - 70 * smooth(ta / 1.1)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)
        if 0.9 <= tau < 1.9:
            self.draw_text(canvas, '20 x %d' % n, 3, (self.W / 2, 340), color=GOLD_HL, outline=None, shadow=(40, 20, 0))

    def _draw_hud(self, canvas, d, t):
        self.draw_text(canvas, 'SURPRISES', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(self.surprises(t)), 9, (125, 140), color=GOLD, outline=None, shadow=(60, 30, 0))
        self.draw_text(canvas, 'DRAWN', 3, (955, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, '+%d' % self.drawn(t), 9, (955, 140), color=(150, 230, 255), outline=None, shadow=(10, 40, 70))
        for a, T in enumerate(self.T_ACT):
            if T <= t < T + 1.3:
                if int(t * 8) % 2 == 0:
                    self.draw_text(canvas, 'ATTACK!', 4, (125, 206), color=(255, 90, 90), outline=None, shadow=(40, 10, 10))
        for a in range(3):
            if self.reveal_t(a) - 0.05 <= t < self.reveal_t(a) + 1.4:
                self.draw_text(canvas, 'SURPRISE!', 4, (955, 206), color=GOLD_HL, outline=None, shadow=(60, 30, 0))
        # gezogene Karten fliegen in den Zähler
        for tt, v in self.drawn_events():
            tau = t - tt
            if 0 <= tau < 0.5:
                for k in range(v):
                    u = ease_out((tau - 0.06 * k) / 0.4)
                    if u <= 0:
                        continue
                    sm = self.stamp(self.opp_back.transpose(Image.ROTATE_180), ('mini',), scale=1).resize((49, 66), Image.NEAREST)
                    x = self.SLOT_X[1] + (955 - self.SLOT_X[1]) * u
                    y = self.SLOT_Y + (130 - self.SLOT_Y) * u - 120 * math.sin(math.pi * u)
                    canvas.paste(sm, (int(x - 24), int(y - 33)), sm)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        cx, cy = self.center
        # Hook: Spinnen laufen die Speichen entlang nach außen
        if t < 2.0:
            for h in self.hook_sp:
                u = (t - h['dly']) / 1.6
                if 0 <= u < 1.0:
                    r = 120 + 1100 * u
                    self._spider(canvas, 0 + (int(t * 9) + h['k']) % 2, self.web_c[0] + 0.9 * r * math.cos(h['a']), self.web_c[1] + r * math.sin(h['a']), t)
        self._draw_opp(canvas, d, t)
        self._draw_slots(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_attack(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_activate(canvas, d, t)
        self._draw_jumper(canvas, d, t)
        self._draw_avalanche(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_hud(canvas, d, t)
        # Finale: Spinnen sammeln sich im Netz
        if self.T_ACT[2] + 4.6 <= t < self.T_ACT[2] + 6.4:
            u = (t - (self.T_ACT[2] + 4.6)) / 1.8
            for i in range(10):
                a = 2 * math.pi * i / 10 + 0.3
                r = (900 * (1 - smooth(u))) + 40
                self._spider(canvas, (int(t * 8) + i) % 2, cx + 0.9 * r * math.cos(a), 880 + r * math.sin(a), t)
        self._draw_caption(canvas, ImageDraw.Draw(canvas), t)

    # ───────── Bild-Nachbearbeitung ─────────
    def post_fx(self, img, f):
        t = f / float(self.fps)
        fl = 0.0
        for tg in self.SHOCKS:
            if 0 <= t - tg < 0.25:
                fl = max(fl, (0.4 if tg == 0.0 else 0.22) * math.exp(-(t - tg) / 0.08))
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

    # ───────── Soundeffekte (public/sounds): gleiche Aktion = gleicher Sound ─────────
    SND = {
        'explode': [('heavy_impact', -2), ('elem_wind', -8, 0.10)],
        'web':     [('chain_add', -7)],                                                  # Faden/Netz
        'place':   [('placement', -8)],                                                  # Surprise wird verdeckt abgelegt, Gegner fällt ins Bild
        'attack':  [('projectile', -8)],                                                 # gegnerischer Angriff
        'hit':     [('damage', -6)],
        'negate':  [('negate', -6)],
        'reveal':  [('reveal', -4), ('ability_activate', -8, 0.05)],                    # Surprise wird aufgedeckt
        'draw':    [('draw', -5)],
        'rain':    [('heavy_impact', -6)],
        'skitter': [('ping', -16, 0.0, 0.6, 0.12)],
        'bite':    [('slash', -9, 0.0, 1.15)],                                           # Spider Avalanche beißt zu
        'warn':    [('ping', -9)],                                                       # „!“ über der Surprise                                      # Spinnenfüße
    }

    def sfx_events(self):
        D = self.D
        ev = []

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t + (item[2] if len(item) > 2 else 0.0), item[0], item[1]) + tuple(item[3:]))
        add(0.0, 'explode'); add(0.05, 'web')
        for i in range(3):
            add(self.slot_t(i), 'place'); add(self.slot_t(i) + 0.1, 'web')
            add(2.9 + 0.2 * i, 'place')
        for a, T in enumerate(self.T_ACT):
            add(T + 0.3, 'attack')
            add(self.reveal_t(a), 'reveal')
            if a == 0:
                add(self.reveal_t(a) + 0.05, 'negate'); add(self.reveal_t(a) + 0.1, 'web'); add(self.reveal_t(a) + 0.5, 'web')
            else:
                add(self.reveal_t(a) - 0.05, 'hit')
        for tt, v in self.drawn_events():
            for k in range(v):
                add(tt + 0.06 * k, 'draw')
        add(self.T_ACT[2] + 1.3, 'rain')
        for k in range(22):
            add(self.T_ACT[2] + 1.3 + 0.1 * k, 'skitter')
        for i in range(3):                                                               # jeder Gegner wird gebissen und getroffen
            tb = self.T_ACT[2] + 1.25 + 0.9 + 0.12 * i
            add(tb, 'hit'); add(tb + 0.02, 'bite'); add(tb + 0.2, 'bite')
        for a in range(3):
            add(self.reveal_t(a) - 0.4, 'warn')
        for k in range(6):
            add(0.1 * k, 'skitter')
        ev.append((D - 1.0, 'ascension', -9, 1.2))
        return sorted(ev)
