"""Konzert-Show für „Elana, the Rocky Rebel“: Elana ist ein Rockstar in einer mittelalterlichen Fantasywelt – und eine Draw-Unterstützerin:
Einmal pro Runde mischt sie die ganze Hand zurück ins Deck und lässt dich genauso viele Karten +1 ziehen. Spannungsbogen (jede Runde ein Akkord):

   0.0 –  1.2  HOOK     Feuerfontänen links und rechts, Scheinwerfer, Konfetti, Noten spritzen aus ihrer Gitarre
   1.2 –  4.0  EINLASS  das Publikum strömt herein (Fans mit Leuchtstäben, mittelalterliches Volk), die ersten 3 Karten fliegen vom Deck in die Hand
   3.9         RUNDE 1  Akkord: die 3 Handkarten werden ins Deck gemischt, dann zieht man 4 (die letzte, goldene Karte ist das +1)
   7.6         RUNDE 2  4 → 5
  11.3         RUNDE 3  5 → 6, immer lauter
  14.5 – 17.6  FINALE   Gitarrensolo: Dauerfeuer der Fontänen, Feuerwerk, „ROCK ON!“, die sechs Karten glühen golden
  18.4 –   D   ABGANG   letzter Akkord: die Hand wird ins Deck gefegt, das Publikum zieht ab, das Licht geht aus → nahtlos in den Hook

Alle Methoden entsprechen der API von icefx.IceShow / rootfx.RootShow. Karten, Counter und Deck liegen im freien Streifen über dem Banner.
Alle Sprites (Fans, Volk, Fontänen) stammen aus PixelPartiesSprites und stehen auf dem Pixelraster von Elanas Sprite."""
import math

import numpy as np
from PIL import Image, ImageDraw


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


def ease_in_out(x):
    return smooth(x)


GOLD, GOLD_HL, GOLD_DK = (255, 214, 64), (255, 244, 170), (176, 112, 16)
PINK, CYAN, YEL, GRN = (255, 70, 150), (60, 220, 255), (255, 220, 70), (90, 255, 120)
CONF = [PINK, CYAN, YEL, GRN, (255, 255, 255), (255, 140, 40)]
NOTE = ["..###.",
        "..#..#",
        "..#...",
        "..#...",
        "###...",
        "###...",
        ".#...."]


def load_img(path):
    return Image.open(path).convert('RGBA')


class ConcertShow:
    TURNS = [(3.9, 3), (7.6, 4), (11.3, 5)]                                           # (Akkord, Handgröße davor)
    T_FIN, T_END = 14.5, 18.4
    SHOCKS = (0.0, 3.9, 7.6, 11.3, 14.5, 18.4)
    T_GUST = 0.0
    TENSION_SHAKES = [(0.0, 8), (3.9, 10), (7.6, 12), (11.3, 14), (14.5, 18), (18.4, 22)]
    DECK = (960, 138)
    CARD_W, CARD_H = 98, 133                                                           # 14 × 19 Raster-Einheiten (U)

    def __init__(self, W, H, U, fps, loop, geom, D, seed=3):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self.center = geom['center']                                                   # Elanas Gitarre
        base = geom['assets_dir']
        rng = np.random.default_rng(seed)
        yy, xx = np.mgrid[0:H, 0:W]
        rr = np.hypot((xx - W / 2) / (W * 0.62), (yy - H * 0.5) / (H * 0.55))
        self.vig = np.clip((rr - 0.45) / 0.8, 0, 1).astype(np.float32) ** 1.3
        # Sprites
        self.pyro = [load_img('%s/pyro-a.png' % base), load_img('%s/pyro-b.png' % base)]
        self.fans = [load_img('%s/fan-%d.png' % (base, i)) for i in range(6)]
        folk = ['folk-catgirl', 'folk-dwarf', 'folk-elf-red', 'folk-monk', 'folk-beast', 'folk-elf-archer', 'folk-farmer', 'folk-elf-eyepatch']
        self.folk = [load_img('%s/%s.png' % (base, n)) for n in folk]
        self._cache = {}
        self._build_cards()
        self._build_cardback(geom['cardback_path'])
        self._build_crowd(rng)
        self.chords = [0.0] + [t for t, _ in self.TURNS] + [self.T_FIN, self.T_END]
        self.notes = [[dict(th=rng.uniform(0, 6.283), v=rng.uniform(380, 900), c=CONF[int(rng.integers(len(CONF)))], big=rng.uniform() < 0.3) for _ in range(14)] for _ in self.chords]
        self.confetti = []
        for ev, n in ((0.0, 60), (3.9, 40), (7.6, 50), (11.3, 60)):
            for _ in range(n):
                self.confetti.append(dict(t0=ev + rng.uniform(0, 0.5), x=rng.uniform(0, W), vx=rng.uniform(-60, 60), vy=rng.uniform(280, 520), c=CONF[int(rng.integers(len(CONF)))], s=int(rng.integers(1, 3))))
        for _ in range(240):
            self.confetti.append(dict(t0=self.T_FIN + rng.uniform(0, 3.4), x=rng.uniform(0, W), vx=rng.uniform(-80, 80), vy=rng.uniform(300, 560), c=CONF[int(rng.integers(len(CONF)))], s=int(rng.integers(1, 3))))
        self.fw = [dict(t0=self.T_FIN + 0.35 + 0.55 * k, x=rng.uniform(80, 1000), y=rng.uniform(300, 1000), c=CONF[k % len(CONF)], ph=rng.uniform(0, 6.3)) for k in range(6)]
        self.beams = [dict(x0=x0, c=c, ph=k / 4.0) for k, (x0, c) in enumerate(((90, PINK), (380, CYAN), (700, YEL), (990, GRN)))]

    # ───────── Raster ─────────
    def cell(self, x, y):
        return int(math.floor((x - self.ox) / self.gp)), int(math.floor((y - self.oy) / self.gp))

    def cpos(self, ci, cj):
        return self.ox + ci * self.gp, self.oy + cj * self.gp

    def rect(self, d, ci, cj, col):
        x, y = self.cpos(ci, cj)
        if -self.gp < x < self.W and -self.gp < y < self.H:
            d.rectangle([x, y, x + self.gp - 1, y + self.gp - 1], fill=tuple(col) + ((255,) if len(col) == 3 else ()))

    def stamp(self, im, key, mirror=False):
        k = (key, mirror, self.gp)
        if k not in self._cache:
            src = im.transpose(Image.FLIP_LEFT_RIGHT) if mirror else im
            self._cache[k] = src.resize((src.width * self.gp, src.height * self.gp), Image.NEAREST)
        return self._cache[k]

    # ───────── Karten, Deck, Hand ─────────
    def _build_cardback(self, path):
        im = Image.open(path).convert('RGBA')
        cw, ch = self.CARD_W // self.U, self.CARD_H // self.U                          # 14 × 19 Einheiten
        from PIL import ImageEnhance
        inner = im.convert('RGB').resize((cw - 2, ch - 2), Image.BOX)                  # Kartenrücken auf dem Layout-Raster (U) neu aufgebaut
        inner = ImageEnhance.Color(ImageEnhance.Contrast(inner).enhance(1.35)).enhance(1.5).convert('RGBA')
        card = Image.new('RGBA', (cw, ch), (255, 150, 40, 255))                         # orangefarbener Rand wie auf dem Original
        card.paste(inner, (1, 1))
        for x in range(cw):
            for y in (0, ch - 1):
                card.putpixel((x, y), (255, 150, 40, 255) if (x in (0, cw - 1)) is False else (12, 10, 14, 255))
        self.back = card.resize((self.CARD_W, self.CARD_H), Image.NEAREST)
        gold = Image.new('RGBA', card.size, GOLD + (255,))
        gcard = Image.blend(card, gold, 0.55)
        for x in range(cw):                                                             # goldener Rand
            for y in (0, ch - 1):
                gcard.putpixel((x, y), GOLD_DK + (255,))
        for y in range(ch):
            for x in (0, cw - 1):
                gcard.putpixel((x, y), GOLD_DK + (255,))
        self.goldback = gcard.resize((self.CARD_W, self.CARD_H), Image.NEAREST)

    def slot(self, i, n):
        return (540 + (i - (n - 1) / 2.0) * 96, 138)

    def _build_cards(self):
        """Jede Karte hat eine Liste von Flügen (t0, t1, von, nach, Art); Art 'draw' = Deck → Hand, 'deck' = Hand → Deck."""
        self.cards = []

        def new(gold=False):
            c = dict(segs=[], gold=gold)
            self.cards.append(c)
            return c
        hand = []
        for i in range(3):                                                              # Eröffnungshand
            c = new()
            t0 = 1.6 + 0.22 * i
            c['segs'].append((t0, t0 + 0.5, self.DECK, self.slot(i, 3), 'draw'))
            hand.append(c)
        self.draw_times = [(c['segs'][0][1], 'draw') for c in hand]
        for (T, n) in self.TURNS:
            for i, c in enumerate(hand):                                                # Hand → Deck
                t0 = T + 0.25 + 0.08 * i
                c['segs'].append((t0, t0 + 0.45, self.slot(i, n), self.DECK, 'deck'))
            hand = []
            for i in range(n + 1):                                                      # n + 1 Karten ziehen, die letzte ist das +1
                c = new(gold=(i == n))
                t0 = T + 1.4 + 0.18 * i
                c['segs'].append((t0, t0 + 0.45, self.DECK, self.slot(i, n + 1), 'draw'))
                hand.append(c)
        for i, c in enumerate(hand):                                                     # Abgang: die Hand wird ins Deck gefegt
            t0 = self.T_END + 0.25 + 0.08 * i
            c['segs'].append((t0, t0 + 0.5, self.slot(i, 6), self.DECK, 'deck'))
        self.cards_final = hand

    def card_pos(self, c, t):
        """(x, y) der Karte oder None (im Deck)."""
        segs = c['segs']
        if t < segs[0][0]:
            return None
        pos = None
        for (t0, t1, p0, p1, kind) in segs:
            if t < t0:
                return pos
            if t < t1:
                u = ease_in_out((t - t0) / (t1 - t0))
                return (p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u - 70 * math.sin(math.pi * u))
            pos = None if kind == 'deck' else p1
        return pos

    def in_hand(self, c, t):
        st = False
        for (t0, t1, p0, p1, kind) in c['segs']:
            if kind == 'draw' and t >= t1:
                st = True
            if kind == 'deck' and t >= t0:
                st = False
        return st

    def hand_count(self, t):
        return sum(1 for c in self.cards if self.in_hand(c, t))

    def turn_no(self, t):
        return sum(1 for T, _ in self.TURNS if t >= T)

    # ───────── Publikum ─────────
    def _build_crowd(self, rng):
        self.crowd = []
        W = self.W
        # eine Reihe, abwechselnd Fan (von hinten, mit Leuchtstab) und mittelalterliches Volk; die Fans werden zuerst gezeichnet, das Volk steht davor
        order = [('fan', 0), ('folk', 0), ('fan', 1), ('folk', 1), ('fan', 3), ('folk', 3), ('fan', 4), ('folk', 5)]
        for k, (kind, i) in enumerate(order):
            self.crowd.append(dict(kind=kind, i=i, x=60 + 135 * k, row=0 if kind == 'fan' else 1, ta=1.3 + 0.28 * k, side=-1 if k % 2 == 0 else 1, ph=rng.uniform(0, 1)))
        for k, f in enumerate(self.crowd):
            f['tl'] = self.T_END + 0.7 + 0.09 * k

    def crowd_state(self, f, t):
        """(x_px, Hüpfhöhe_in_Zellen, läuft, Richtung) oder None."""
        W = self.W
        xs = -220 if f['side'] < 0 else W + 220
        if t < f['ta'] or t >= f['tl'] + 1.1:
            return None
        if t < f['ta'] + 0.9:
            u = ease_out((t - f['ta']) / 0.9)
            return xs + (f['x'] - xs) * u, (1 if int((t - f['ta']) * 5) % 2 == 0 else 0), True, 1 if f['side'] < 0 else -1
        if t >= f['tl']:
            u = smooth((t - f['tl']) / 1.1)
            return f['x'] + (xs - f['x']) * u, (1 if int((t - f['tl']) * 5) % 2 == 0 else 0), True, -1 if f['side'] < 0 else 1
        per = 0.64
        ph = ((t + f['ph'] * per) % per) / per
        hop = 1 if ph < 0.5 else 0
        for c in self.chords:                                                           # beim Akkord springen alle hoch
            if 0 <= t - c < 0.4:
                hop = max(hop, 3 if (t - c) < 0.2 else 2)
        if self.T_FIN <= t < self.T_END:
            hop = max(hop, 2 if int(t * 5 + f['ph'] * 3) % 2 == 0 else 1)
        return f['x'], hop, False, 0

    def _draw_crowd(self, canvas, t):
        for f in sorted(self.crowd, key=lambda q: q['row']):
            st = self.crowd_state(f, t)
            if st is None:
                continue
            x, hop, walking, dirn = st
            if f['kind'] == 'fan':
                im = self.fans[(f['i'] + int(t / 0.3)) % 6 if (not walking) else f['i']]      # die Leuchtstäbe wechseln die Farbe
                key = ('fan', (f['i'] + int(t / 0.3)) % 6 if (not walking) else f['i'])
                mirror = False
                ground = 1902
            else:
                im = self.folk[f['i']]
                key = ('folk', f['i'])
                mirror = dirn < 0 if walking else (f['i'] % 2 == 0)
                ground = 1896
            s = self.stamp(im, key, mirror)
            ci = self.cell(x, 0)[0] - im.width // 2
            cj = self.cell(0, ground)[1] - im.height - hop
            px_, py_ = self.cpos(ci, cj)
            canvas.paste(s, (px_, py_), s)

    # ───────── Bühne ─────────
    def _pyro_h(self, t):
        """Höhe der Fontänen 0…1."""
        h = 0.0
        for (a, d) in ((0.0, 1.0), (3.9, 1.1), (7.6, 1.1), (11.3, 1.1), (self.T_END, 1.0)):
            if a <= t < a + d:
                h = max(h, smooth((t - a) / 0.15) * (1 - smooth((t - (a + d - 0.35)) / 0.35)))
        if self.T_FIN <= t < self.T_END - 0.2:
            h = max(h, 0.75 + 0.25 * math.sin(2 * math.pi * t * 2.5) ** 2) * smooth((t - self.T_FIN) / 0.15)
        return h

    def _draw_pyro(self, canvas, t):
        h = self._pyro_h(t)
        if h <= 0.02:
            return
        v = int(t * 12) % 2
        for side, xc in ((0, 105), (1, 975)):
            im = self.pyro[(v + side) % 2]
            vis = max(1, int(im.height * h))
            sub = im.crop((0, 0, im.width, vis))                                         # die Fontäne steigt aus dem Boden: die Spitze bleibt immer ganz, unten wird am Boden abgeschnitten
            s = self.stamp(sub, ('pyro', (v + side) % 2, vis), mirror=bool(side))
            ci = self.cell(xc, 0)[0] - im.width // 2
            cj = self.cell(0, 1604)[1] - vis
            x, y = self.cpos(ci, cj)
            canvas.paste(s, (x, y), s)

    def _draw_beams(self, canvas, t):
        layer = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        boost = 0.0
        for c in self.chords:
            if 0 <= t - c < 0.5:
                boost = max(boost, math.exp(-(t - c) / 0.15))
        on = 1.0 if t < self.T_END + 1.2 else 1.0 - smooth((t - (self.T_END + 1.2)) / 0.8)
        for b in self.beams:
            xt = b['x0'] + 330 * math.sin(2 * math.pi * (t / 3.2 + b['ph']))
            col = b['c']
            alpha = int((80 + 70 * boost) * on)
            if alpha <= 2:
                continue
            for j in range(0, 80):
                y = j * self.gp * 1.4
                u = j / 80.0
                xc = b['x0'] + (xt - b['x0']) * u
                hw = (1.5 + 0.30 * j) * self.gp * 0.5
                x0 = int((xc - hw - self.ox) // self.gp) * self.gp + self.ox
                x1 = int((xc + hw - self.ox) // self.gp) * self.gp + self.ox
                y0 = int((y - self.oy) // self.gp) * self.gp + self.oy
                d.rectangle([x0, y0, x1, y0 + int(self.gp * 1.4) - 1], fill=col + (int(alpha * (1 - 0.6 * u)),))
        canvas.alpha_composite(layer)

    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        self._draw_beams(canvas, t)
        self._draw_pyro(canvas, t)
        self._draw_crowd(canvas, t)

    def draw_logo(self, canvas, f):
        t = f / float(self.fps)
        lx, ly, lw, lh = self.g['logo_rect']
        im = self.g['logo_img']
        bounce = 0
        for c in self.chords:
            if 0 <= t - c < 0.35:
                bounce = int(-26 * math.sin(math.pi * (t - c) / 0.35))
        if self.T_FIN <= t < self.T_END:
            bounce = -10 * abs(math.sin(2 * math.pi * t * 1.5)) if int(t * 8) % 2 else 0
        canvas.paste(im, (int(lx), int(ly + bounce)), im)

    def draw_badge(self, canvas, f):
        bx, by, bw, bh = self.g['badge_rect']
        img = self.g['badge_img']
        canvas.paste(img, (bx, by), img)

    # ───────── Vordergrund ─────────
    def _card_im(self, c, t):
        return self.goldback if c['gold'] else self.back

    def _draw_cards(self, canvas, t):
        U = self.U
        fin = self.T_FIN <= t < self.T_END
        # Deck
        jit = 0
        for (T, n) in self.TURNS:
            if T + 0.8 <= t < T + 1.4:
                jit = 6 if int(t * 22) % 2 else -6
        dx, dy = self.DECK
        for k in (2, 1, 0):
            x = int(round((dx - self.CARD_W / 2 - 4 * k * (1 if jit == 0 else 1) + (jit if k == 1 else -jit if k == 0 else 0)) / U) * U)
            y = int(round((dy - self.CARD_H / 2 - 4 * k) / U) * U)
            canvas.paste(self.back, (x, y), self.back)
        for c in self.cards:
            p = self.card_pos(c, t)
            if p is None:
                continue
            x, y = p
            if fin and self.in_hand(c, t):
                y -= 8 * abs(math.sin(2 * math.pi * (t * 1.6 + x / 300.0)))
            im = self._card_im(c, t)
            xi = int(round((x - self.CARD_W / 2) / U) * U)
            yi = int(round((y - self.CARD_H / 2) / U) * U)
            if fin and self.in_hand(c, t):                                              # goldener Schein im Finale
                glow = Image.new('RGBA', (self.CARD_W + 4 * U, self.CARD_H + 4 * U), GOLD + (0,))
                gd = ImageDraw.Draw(glow)
                a = int(70 + 50 * math.sin(2 * math.pi * t * 3))
                gd.rectangle([0, U, glow.width - 1, glow.height - U - 1], fill=GOLD + (a,))
                gd.rectangle([U, 0, glow.width - U - 1, glow.height - 1], fill=GOLD + (a,))
                canvas.alpha_composite(glow, (xi - 2 * U, yi - 2 * U))
            canvas.paste(im, (xi, yi), im)
        # Zähler
        n = self.hand_count(t)
        self.draw_text(canvas, 'HAND', 4, (125, 76), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(n), 9, (125, 150), color=GOLD, outline=None, shadow=(60, 30, 0))
        tn = self.turn_no(t)
        if tn and t < self.T_FIN:
            self.draw_text(canvas, 'TURN %d' % tn, 3, (125, 210), color=PINK, outline=None, shadow=(20, 10, 30))
        for c in self.cards:                                                              # +1: goldene Karte landet
            if c['gold']:
                tl = c['segs'][0][1]
                if tl <= t < tl + 1.0:
                    u = (t - tl) / 1.0
                    if int(t * 18) % 2 == 0 or u < 0.6:
                        self.draw_text(canvas, '+1', 8, (222, 128 - 40 * smooth(u)), color=GOLD_HL, outline=None, shadow=(176, 60, 0))

    def _draw_notes_ring(self, canvas, d, t):
        cx, cy = self.center
        for e, c in enumerate(self.chords):
            tau = t - c
            if not (0 <= tau < 1.3):
                continue
            if tau < 0.5:                                                               # Schallring aus Gitarre
                r = 700 * ease_out(tau / 0.5)
                n = 56
                for k in range(n):
                    a = 2 * math.pi * k / n
                    ci, cj = self.cell(cx + math.cos(a) * r, cy + math.sin(a) * r)
                    self.rect(d, ci, cj, (255, 255, 255) if tau < 0.25 else PINK)
            for nt in self.notes[e]:                                                    # Noten fliegen heraus
                dist = nt['v'] * (1 - math.exp(-2.2 * tau)) / 2.2
                x, y = cx + math.cos(nt['th']) * dist, cy + math.sin(nt['th']) * dist - 40 * tau
                if tau > 0.9 and int(t * 24) % 2:
                    continue
                ci, cj = self.cell(x, y)
                for j, row in enumerate(NOTE):
                    for i, ch in enumerate(row):
                        if ch == '#':
                            self.rect(d, ci + i, cj + j, nt['c'])

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        W, H, gp = self.W, self.H, self.gp
        d = ImageDraw.Draw(canvas)
        # Konfetti
        for p in self.confetti:
            tau = t - p['t0']
            if tau < 0:
                continue
            y = -40 + p['vy'] * tau
            if y > H + 20:
                continue
            x = p['x'] + p['vx'] * tau + 30 * math.sin(tau * 3 + p['x'])
            ci, cj = self.cell(x, y)
            self.rect(d, ci, cj, p['c'])
            if p['s'] == 2:
                self.rect(d, ci + 1, cj, p['c'])
        # Feuerwerk
        for fw in self.fw:
            tau = t - fw['t0']
            if 0 <= tau < 1.0:
                r = 22 * ease_out(tau / 1.0)
                n = 16
                for k in range(n):
                    a = 2 * math.pi * k / n + fw['ph']
                    for s in range(2):
                        rr = r * (1 - 0.25 * s)
                        if tau > 0.7 and int(t * 24 + k) % 2:
                            continue
                        ci, cj = self.cell(fw['x'], fw['y'])
                        self.rect(d, ci + int(round(math.cos(a) * rr)), cj + int(round(math.sin(a) * rr)) + int(5 * tau * tau * 4), fw['c'] if s == 0 else (255, 255, 255))
        self._draw_notes_ring(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_cards(canvas, t)
        # Titel im Finale
        if self.T_FIN + 0.1 <= t < self.T_FIN + 1.9:
            if int(t * 14) % 2 == 0 or t > self.T_FIN + 0.6:
                self.draw_text(canvas, 'ROCK ON!', 11, (W / 2, 1180), color=(255, 255, 255), outline=(255, 70, 150), shadow=(30, 0, 40))
        if self.T_FIN + 2.0 <= t < self.T_END - 0.2:
            if int(t * 14) % 2 == 0 or t > self.T_FIN + 2.6:
                self.draw_text(canvas, '6 CARDS!', 10, (W / 2, 1180), color=GOLD_HL, outline=(176, 80, 0), shadow=(30, 10, 0))

    # ───────── Bild-Nachbearbeitung ─────────
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

    def post_fx(self, img, f):
        t = f / float(self.fps)
        fl = 0.0
        for c in self.chords:
            if 0 <= t - c < 0.3:
                fl = max(fl, (0.45 if c in (0.0, self.T_FIN, self.T_END) else 0.28) * math.exp(-(t - c) / 0.08))
        k = 0.0
        if self.T_FIN <= t < self.T_END:
            k = 0.35
        elif t >= 1.0:
            k = 0.12
        if fl <= 0 and k <= 0:
            return img
        arr = np.asarray(img).astype(np.float32)
        if k > 0:
            m = (self.vig * k)[..., None]
            arr = arr * (1 - m) + np.array([60, 10, 90], dtype=np.float32) * m
        if fl > 0:
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
        'chord':   [('ability_activate', -5), ('critical_strike', -10)],              # Elanas Akkord = ihre Fähigkeit
        'pyro':    [('elem_fire', -8)],
        'draw':    [('draw', -4)],                                                    # Karte wird gezogen
        'tdeck':   [('placement', -10)],                                              # Karte fliegt ins Deck
        'shuffle': [('shuffle', -4)],
        'bonus':   [('gold_gain', -7), ('buff', -9)],                                 # das +1
        'turn':    [('turn_start', -8)],
        'fan':     [('ping', -12)],                                                   # ein Zuschauer kommt herein
        'cheer':   [('victory', -12)],
        'charge':  [('ascension', -8)],
    }

    def sfx_events(self):
        D = self.D
        ev = []

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t + (item[2] if len(item) > 2 else 0.0), item[0], item[1]))
        add(0.0, 'explode'); add(0.02, 'pyro')                                          # Hook
        for f_ in self.crowd:
            add(f_['ta'] + 0.5, 'fan')
        for c in self.cards:
            for (t0, t1, p0, p1, kind) in c['segs']:
                if kind == 'draw':
                    add(t1 - 0.1, 'draw')
                    if c['gold']:
                        add(t1, 'bonus')
                else:
                    add(t1 - 0.1, 'tdeck')
        for (T, n) in self.TURNS:
            add(T - 0.2, 'turn'); add(T, 'chord'); add(T + 0.05, 'pyro'); add(T + 0.8, 'shuffle')
        add(self.T_FIN - 1.0, 'charge')
        add(self.T_FIN, 'explode'); add(self.T_FIN + 0.02, 'chord'); add(self.T_FIN + 0.1, 'cheer')
        for k in range(len(self.fw)):
            add(self.T_FIN + 0.35 + 0.55 * k, 'pyro')
        add(self.T_END, 'chord'); add(self.T_END + 0.05, 'pyro')
        ev.append((D - 1.0, 'ascension', -9, 1.2))                                        # Rückkehr in den Hook
        return sorted(ev)
