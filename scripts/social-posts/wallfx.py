"""Layn-Show: die Verteidigerin von Deri. Jede Creature, die sie beschwört, bekommt +100 HP (Mauer aus Verteidigern). Tharx, der Never-Losing General, reißt sie nieder -
da greift sie zum Relikt-Hammer ihrer Ahnen (ein Geist ist darin versiegelt), steigt auf (Master of Deri's Relic), holt bis zu 3 gleichnamige Creatures aus dem Ablagestapel zurück und schlägt zurück.
Kartenzug (Schweif, Abheb-Funken, Schockringe), Schnitt und Wurfhammer samt Hammer-Aufprall sind Nachbauten der echten Spiel-Animationen (gamefx.py). Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

CYAN = (150, 230, 255)
STONE = (110, 112, 130)


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class WallShow(CaptionMixin):
    CW, CH = 180, 252
    SMALL = (120, 168)
    SLOT_X = [330, 540, 750]
    SLOT_Y = 1762
    DISC = (110, 1762)                                                                # Ablagestapel
    HANDP = (975, 1762)                                                               # Hand
    LAYN = (540, 700)                                                                 # Mitte der Heldin (Ziel des Hammers, Start des Wurfs)
    TH_X, TH_FOOT = 540, 540                                                          # Tharx: Standlinie
    # Beschwörung: (Zeit, Slot) – jede Creature bekommt +100 HP
    SUMMON = [(1.0, 0), (1.6, 1), (2.2, 2)]
    T_TH = 6.9                                                                        # Tharx erscheint
    T_CUT = [8.3, 9.0, 9.7]                                                           # seine Hiebe auf die drei Verteidiger
    T_HAM = 11.6                                                                      # der Relikt-Hammer fliegt zu ihr
    T_ASC = 13.4                                                                      # Aufstieg
    RALLY = [14.6, 15.1, 15.6]                                                        # drei gleichnamige Creatures kehren zurück
    T_THROW = 17.4                                                                    # Hammerwurf auf Tharx
    CAPTIONS = [
        (0.2, 2.9, '*Layn, Defender of Deri* holds the walls - alone.'),
        (3.0, 6.8, 'Every *Creature* she summons gets *+100 HP* - a wall of defenders.'),
        (7.0, 11.4, '*Tharx*, the Never-Losing General, marches in. No wall has ever stood against him.'),
        (11.6, 14.4, 'Her last hope - the *Relic Hammer* of her ancestors, a *spirit* sealed inside.'),
        (14.6, 17.4, 'Ascended, she calls her *fallen* back - up to *3 Creatures* of the same name.'),
        (17.6, 21.4, '*Layn* guards *Deri* - to the very last stone.'),
    ]
    SND = {
        'whoosh': [('booster_card_whoosh', -8)],
        'place':  [('placement', -7)],
        'buff':   [('buff', -8)],
        'enter':  [('heavy_impact', -4), ('attack_ram', -10)],
        'cut':    [('slash', -4), ('creature_destroyed', -7, 0.12)],
        'equip':  [('ability_activate', -6), ('elem_holy', -8)],
        'ghost':  [('pull_swell', -9)],
        'asc':    [('ascension', -5), ('heavy_impact', -8)],
        'rally':  [('summon', -7)],
        'throw':  [('projectile', -6)],
        'hit':    [('heavy_impact', -3), ('damage', -5), ('critical_strike', -9)],
        'ping':   [('ping', -9)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self.actor_fn = geom['actor_fn']
        self.per = geom['per']
        self._cache = {}
        self.K = 14.0 / self.gp
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        face = ld('c1')
        self.face = face.resize((self.CW, self.CH), Image.BOX)
        self.small = face.resize(self.SMALL, Image.BOX)
        self.ham = ld('hammer').resize(self.SMALL, Image.BOX)
        self.ghost = ld('ghost')
        self.t_land = [t + 0.5 for t, s in self.SUMMON]
        self.t_buff = [t + 0.95 for t in self.t_land]                                   # +100 kommt bei der Karte an
        self.t_dead = [tc + 0.22 for tc in self.T_CUT]                                  # Verteidiger k fällt (Slot k)
        self.t_ham_land = self.T_HAM + 0.5
        self.t_ghost = (self.t_ham_land + 0.1, self.T_ASC)
        self.t_rl = [t + 0.5 for t in self.RALLY]
        self.FL = 0.6
        self.t_hit = self.T_THROW + self.FL * 0.85
        self.t_flee = self.t_hit + 0.5
        self.t_win = self.t_hit + 1.6
        self.FLASHES = (0.0, self.T_ASC, self.t_hit)
        self.SHOCKS = (0.0, self.T_ASC, self.t_hit)
        self.TENSION_SHAKES = ([(t, 4) for t in self.t_land] + [(self.T_TH + 0.35, 10)] + [(t + 0.1, 6) for t in self.T_CUT] + [(self.T_ASC, 9), (self.t_hit, 10)]
                               + [(t, 4) for t in self.t_rl])
        self.T_GUST = 0.0
        self._fx = {}
        self._build_tiles()

    # ───────── Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def _ci(self, x, y):
        a, b = self._cp(x, y)
        return gamefx.rd(a), gamefx.rd(b)

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

    def swap_sprite(self, f):
        """Ab dem Aufstieg steht Master of Deri's Relic auf der Karte (build-post nimmt dafür das Zweit-Sprite altSlug)."""
        return f / float(self.fps) >= self.T_ASC

    def alive(self, t):
        """Anzahl der Verteidiger auf dem Brett: erst durch die Beschwörung, dann durch Tharx' Hiebe, dann wieder durch den Ruf."""
        n = sum(1 for x in self.t_land if t >= x)
        n -= sum(1 for x in self.t_dead if t >= x)
        n += sum(1 for x in self.t_rl if t >= x)
        return n

    def _slot_state(self, k, t):
        """(Karte steht?, Phase): 0 = erste Beschwörung, 1 = nach dem Ruf."""
        if t >= self.t_rl[k]:
            return True, 1
        if self.t_land[k] <= t < self.t_dead[k]:
            return True, 0
        return False, 0

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

    def _card_at(self, canvas, im, x, y):
        U = self.U
        canvas.paste(im, (int(round((x - im.width / 2) / U) * U), int(round((y - im.height / 2) / U) * U)), im)

    # ───────── Kartentrümmer (Verteidiger fällt) ─────────
    def _build_tiles(self):
        rng = np.random.default_rng(7)
        self.tiles = []
        for k in range(3):
            ts = []
            w, h = self.face.size
            step = 14
            for ty in range(0, h, step):
                for tx in range(0, w, step):
                    cx, cy = tx + step / 2 - w / 2, ty + step / 2 - h / 2
                    n = math.hypot(cx, cy) or 1.0
                    sp = rng.uniform(160, 520)
                    ts.append(dict(img=self.face.crop((tx, ty, tx + step, ty + step)), x=tx - w / 2, y=ty - h / 2, vx=cx / n * sp + rng.uniform(-60, 60),
                                   vy=cy / n * sp * 0.8 - rng.uniform(100, 360), life=rng.uniform(0.7, 1.1)))
            self.tiles.append(ts)

    # ───────── Mauer (Hintergrund) ─────────
    def draw_behind(self, canvas, f):
        d = ImageDraw.Draw(canvas)
        t = f / float(self.fps)
        y0 = 1560
        bw, bh = 54, 36
        for r in range(0, 11):
            y = y0 + r * bh
            off = (bw // 2) if r % 2 else 0
            for c in range(-1, self.W // bw + 2):
                x = c * bw - off
                v = (r * 7 + c * 13) % 5
                col = [(52, 54, 72), (58, 60, 80), (48, 50, 66), (62, 64, 86), (54, 56, 74)][v]
                self.pix_rect(d, x, y, x + bw - 4, y + bh - 4, col)
        # Zinnen oben auf der Mauer
        for c in range(0, self.W // 90 + 1):
            self.pix_rect(d, c * 90 + 8, y0 - 26, c * 90 + 58, y0 - 1, (70, 72, 96))
        # Risse nach den Hieben
        for k, tc in enumerate(self.T_CUT):
            if t >= tc + 0.15:
                x = self.SLOT_X[k]
                for j in range(6):
                    self.pix_rect(d, x - 30 + 11 * j + (j % 2) * 4, y0 + 40 + 36 * (j % 3), x - 22 + 11 * j + (j % 2) * 4, y0 + 52 + 36 * (j % 3), (18, 16, 28))

    # ───────── Verteidiger ─────────
    def _zug(self, key, A, B, salt, farbe, dur=0.5):
        if key not in self._cache:
            self._cache[key] = gamefx.Zug(self._cp(*A), self._cp(*B), dauer=dur, cw=self.SMALL[0] / float(self.gp), bogen=-200 / self.gp, salt=salt, farbe=gamefx.hexc(farbe))
        return self._cache[key]

    def _draw_defenders(self, canvas, d, t):
        gp, U = self.gp, self.U
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        # Stapel: Hand rechts, Ablage links
        for k in range(3):
            canvas.paste(self.small, (int(self.HANDP[0] - self.small.width / 2 + 4 * k), int(self.HANDP[1] - self.small.height / 2 - 4 * k)), self.small)
        nd = sum(1 for x in self.t_dead if t >= x) - sum(1 for x in self.t_rl if t >= x)
        for k in range(max(0, nd)):
            canvas.paste(self.small, (int(self.DISC[0] - self.small.width / 2 + 5 * k), int(self.DISC[1] - self.small.height / 2 - 6 * k)), self.small)
        self.draw_text(canvas, 'DISCARD', 2, (self.DISC[0], self.DISC[1] - 112), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        # Beschwörungsflüge (vor dem ersten Mal)
        for k, (t0, slot) in enumerate(self.SUMMON):
            z = self._zug(('sum', k), self.HANDP, (self.SLOT_X[slot], self.SLOT_Y), 40 + k, '#fbe181')
            dt = t - t0
            if 0 <= dt < z.ende:
                z.draw(m, dt)
                if dt < z.dauer:
                    px, py = z.pos(dt)
                    self._card_at(canvas, self.small, px * gp + self.ox, py * gp + self.oy)
        # Rückruf aus dem Ablagestapel
        for k, t0 in enumerate(self.RALLY):
            z = self._zug(('rl', k), (self.DISC[0], self.DISC[1] - 30), (self.SLOT_X[k], self.SLOT_Y), 60 + k, '#9fe8ff')
            dt = t - t0
            if 0 <= dt < z.ende:
                z.draw(m, dt)
                if dt < z.dauer:
                    px, py = z.pos(dt)
                    self._card_at(canvas, self.small, px * gp + self.ox, py * gp + self.oy)
        # stehende Karten und HP
        for k, x in enumerate(self.SLOT_X):
            stand, ph = self._slot_state(k, t)
            if stand:
                self._card_at(canvas, self.face, x, self.SLOT_Y)
                if ph == 0:
                    hp = 150 if t >= self.t_buff[k] else 50
                    hot = 0 <= t - self.t_buff[k] < 0.5 and int(t * 15) % 2 == 0
                    col = (255, 255, 255) if hot else (GOLD_HL if hp == 150 else (255, 255, 255))
                    self.draw_text(canvas, '%d HP' % hp, 3, (x, self.SLOT_Y - 146), color=col, outline=None, shadow=(20, 10, 30))
                else:
                    self.draw_text(canvas, 'RALLIED', 2, (x, self.SLOT_Y - 146), color=CYAN, outline=None, shadow=(10, 40, 60))
            # +100 fliegt vom Zähler-Platz zur Karte
            tb = self.t_buff[k]
            if tb - 0.45 <= t < tb:
                u = ease_out((t - (tb - 0.45)) / 0.45)
                y = self.SLOT_Y - 330 + 160 * u
                self.draw_text(canvas, '+100', 6, (int(round(x / U) * U), int(round(y / U) * U)), color=GOLD_HL, outline=(20, 10, 30), shadow=None)
            # Trümmer
            td = self.t_dead[k]
            if t >= td and not (t >= self.t_rl[k]):
                tau = t - td
                for p in self.tiles[k]:
                    if tau >= p['life']:
                        continue
                    if tau > p['life'] * 0.7 and (int(t * 30) & 1):
                        continue
                    xx = x + p['x'] + p['vx'] * tau
                    yy = self.SLOT_Y + p['y'] + p['vy'] * tau + 0.5 * 1100 * tau * tau
                    canvas.paste(p['img'], (int(round(xx / U) * U), int(round(yy / U) * U)), p['img'])
        # Treffer-Zahl an den Verteidigern
        for k, tc in enumerate(self.T_CUT):
            tau = t - (tc + 0.12)
            if 0 <= tau < 0.8:
                self.draw_text(canvas, '-150', 5, (self.SLOT_X[k], self.SLOT_Y - 150 - 70 * smooth(tau / 0.8)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)

    # ───────── Tharx ─────────
    def _tharx_pos(self, t):
        """(y-Versatz, schwankt, sichtbar-Anteil 0…1)"""
        t_in = self.T_TH
        if t < t_in:
            return None
        y = -300 * (1 - ease_out((t - t_in) / 0.35))
        sh = 0
        if t >= self.t_hit and t < self.t_hit + 0.5:
            sh = 10 if int(t * 30) % 2 else -10
        if t >= self.t_flee:
            y -= 80 * smooth((t - self.t_flee) / 1.0)
        for tc in self.T_CUT:
            if 0 <= t - tc < 0.3:
                y += 24 * (1 - (t - tc) / 0.3)                                          # Ausfallschritt beim Hieb
        vis = 1.0
        if t >= self.t_flee:
            vis = 1.0 - smooth((t - self.t_flee) / 1.0)
        return y, sh, vis

    def _draw_tharx(self, canvas, d, t):
        p = self._tharx_pos(t)
        if p is None or p[2] <= 0:
            return
        dy, sh, vis = p
        idx = int(t * self.fps) // self.per
        im, pad, cxf, foot = self.actor_fn('tharx', idx)
        px = self.g['tharx_px']
        x = self.TH_X - cxf * px - pad + sh
        y = self.TH_FOOT - foot * px - pad + dy
        U = self.U
        x, y = int(round(x / U) * U), int(round(y / U) * U)
        if vis < 1.0:
            im = self._dissolve(im, vis, ('th', idx % 48, int(vis * 16)))
        canvas.paste(im, (x, y), im)

    # ───────── Angriffe: Hiebe, Hammerwurf ─────────
    def _fxs(self):
        if 'fx' in self._fx:
            return self._fx['fx']
        gp = self.gp
        cut = []
        for k in range(3):
            c = self._ci(self.SLOT_X[k], self.SLOT_Y)
            cut.append(gamefx.Schnitt(c[0], c[1], self.CH / float(gp), krit=True, direction=(-0.6, 0.8), salt=11 + k))
        A = self._cp(*self.LAYN)
        B = self._cp(self.TH_X, self.TH_FOOT - 160)
        thr = gamefx.Geschoss('hammer', A, B, self.FL, t0=0.0, R=10, salt=9)
        hit = gamefx.HammerHit(gamefx.rd(B[0]), gamefx.rd(B[1]), 30.0, salt=13)
        self._fx['fx'] = (cut, thr, hit)
        return self._fx['fx']

    def _draw_attacks(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        cut, thr, hit = self._fxs()
        for k, tc in enumerate(self.T_CUT):
            tau = t - (tc + 0.1)
            if 0 <= tau < 1.2:
                cut[k].draw(m, tau)
        if t >= self.T_THROW:
            thr.draw(m, t - self.T_THROW)
        if t >= self.t_hit:
            hit.draw(m, t - self.t_hit)

    # ───────── Hammer, Geist, Aufstieg ─────────
    def _draw_hammer(self, canvas, d, t):
        gp = self.gp
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        key = ('ham',)
        if key not in self._cache:
            self._cache[key] = gamefx.Zug(self._cp(*self.HANDP), self._cp(self.LAYN[0], self.LAYN[1] - 60), dauer=0.5, cw=self.SMALL[0] / float(gp), bogen=-260 / gp, salt=77,
                                          farbe=gamefx.hexc('#fbe181'))
        z = self._cache[key]
        dt = t - self.T_HAM
        if 0 <= dt < z.ende:
            z.draw(m, dt)
            if dt < z.dauer:
                px, py = z.pos(dt)
                self._card_at(canvas, self.ham, px * gp + self.ox, py * gp + self.oy)
        # Geist: steigt aus dem Hammer auf, löst sich im Dither
        a, b = self.t_ghost
        if a <= t < b:
            u = (t - a) / (b - a)
            px = self.g['layn_px']
            im = self.ghost.resize((self.ghost.width * px, self.ghost.height * px), Image.NEAREST)
            vis = (0.25 + 0.75 * math.sin(math.pi * min(1.0, u * 1.0))) if u < 1 else 0.0
            vis = max(0.15, min(1.0, vis))
            if int(t * 30) % 2:
                vis = max(0.1, vis - 0.15)
            im = self._dissolve(im, vis, ('gh', int(vis * 16)))
            x = self.LAYN[0] - im.width // 2
            y = self.LAYN[1] - im.height // 2 - 160 * smooth(u) + 100
            self._card_at(canvas, im, x + im.width / 2, y + im.height / 2)
        # Ringe beim Aufstieg
        tau = t - self.T_ASC
        if 0 <= tau < 0.9:
            c = self._ci(*self.LAYN)
            g = gamefx.R1(m)
            for i, col in enumerate([(255, 244, 220), (255, 226, 61), (150, 230, 255)]):
                r = gamefx.rd(gamefx.ease(max(0.0, tau - 0.08 * i) / 0.8) * 26 * self.K)
                if r > 0:
                    g.ring(c[0], c[1], max(0, r - 2), r, col, 1.0)

    # ───────── Zähler und Schilder ─────────
    def _draw_hud(self, canvas, d, t):
        self.draw_text(canvas, 'DEFENDERS', 3, (150, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        n = self.alive(t)
        self.draw_text(canvas, str(n), 9, (125, 140), color=GOLD, outline=None, shadow=(60, 30, 0))
        asc = t >= self.T_ASC
        self.draw_text(canvas, 'FORM', 3, (940, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        if asc:
            col = GOLD_HL if (t < self.T_ASC + 1.0 and int(t * 12) % 2 == 0) else CYAN
            self.draw_text(canvas, 'MASTER', 4, (930, 130), color=col, outline=None, shadow=(10, 40, 60))
        else:
            self.draw_text(canvas, 'DEFENDER', 4, (920, 130), color=GOLD, outline=None, shadow=(60, 30, 0))
        # Tharx
        if self.T_TH <= t < self.t_flee + 0.5:
            self.draw_text(canvas, 'THARX', 3, (self.TH_X, 70), color=(255, 120, 140), outline=None, shadow=(60, 10, 20))
        tau = t - self.t_hit
        if 0 <= tau < 1.0:
            self.draw_text(canvas, '110', 9, (self.TH_X + 230, 340 - 80 * smooth(tau / 1.0)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)
        if self.t_win <= t < self.t_win + 2.4 and int(t * 6) % 2 == 0:
            self.draw_text(canvas, 'THE WALL HOLDS', 6, (540, 1000), color=GOLD_HL, outline=(20, 10, 30), shadow=None)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_tharx(canvas, d, t)
        self._draw_defenders(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_hammer(canvas, d, t)
        self._draw_attacks(canvas, d, t)
        self._draw_hud(canvas, d, t)
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
                fl = max(fl, (0.4 if tg == 0.0 else 0.55 if tg == self.T_ASC else 0.25) * math.exp(-(t - tg) / 0.08))
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
                e = (t + (item[2] if len(item) > 2 and kind == 'cut' else 0.0), item[0], item[1])
                if rate and item[0] == 'buff':
                    e = e + (rate,)
                ev.append(e)
        for k, (t0, slot) in enumerate(self.SUMMON):
            add(t0, 'whoosh'); add(self.t_land[k], 'place'); add(self.t_buff[k], 'buff', 1.0 + 0.12 * k)
        add(self.T_TH + 0.3, 'enter')
        for tc in self.T_CUT:
            add(tc + 0.1, 'cut')
        add(self.T_HAM, 'whoosh'); add(self.t_ham_land, 'equip'); add(self.t_ghost[0], 'ghost'); add(self.T_ASC, 'asc')
        for k, t0 in enumerate(self.RALLY):
            add(t0, 'whoosh'); add(self.t_rl[k], 'rally')
        add(self.T_THROW, 'throw'); add(self.t_hit, 'hit')
        a, b = self.t_win, self.t_win + 2.4                                             # jedes Aufblinken des Schriftzugs
        for k in range(int(math.floor(a * 6)), int(math.ceil(b * 6)) + 1):
            if k % 2 == 0 and max(a, k / 6.0) < b:
                add(max(a, k / 6.0), 'ping')
        return sorted(ev)
