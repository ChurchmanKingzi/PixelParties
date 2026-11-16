"""Zi-Show: der zeitlose König. Er deckt 3 Zauber aus seinem Deck auf (Gesamtstufe höchstens 6), der Gegner wählt einen, die anderen werden gelöscht – und Zi wirkt den gewählten sofort,
egal welche Stufe er hat und ob er die Fähigkeiten dafür besitzt („vor seiner Zeit“). Hinter der Karte läuft eine Pixeluhr, beim Aufdecken steht die Zeit still.
Fireball (Feuerball) und Flame Avalanche sind Nachbauten der echten Spiel-Animationen (gamefx.py), der Kartenflug ebenso (gamefx.Zug). Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

ICE = [(60, 110, 200), (110, 170, 240), (180, 220, 255), (255, 255, 255)]


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class TimeShow(CaptionMixin):
    CW, CH = 190, 266
    SLOT_X = [250, 540, 830]
    SLOT_Y = 1700
    DECK = (965, 700)
    EX = [290, 540, 790]
    EN_Y = 140
    OW, OH = 150, 210
    TC = (540, 700)
    HP0 = 500
    # Runden: (Start, gewählter Slot, Zauber (Karten-Index), Stufen)
    ROUNDS = [dict(T=1.0, pick=0, files=['s-fireball', 's-finger', 's-oil'], lv=[2, 1, 2], pick_i=0, t_pick=3.0, t_del=4.2, t_cast=6.6, kind='fireball'),
              dict(T=11.0, pick=0, files=['s-avalanche', 's-explosion', 's-hand'], lv=[3, 2, 1], pick_i=0, t_pick=13.0, t_del=14.0, t_cast=14.8, kind='avalanche')]
    CAPTIONS = [
        (0.2, 2.6, '*Zi*, the Timeless King, claims to control *time itself*...'),
        (2.8, 6.4, 'The opponent picks *one* of his *3 Spells* - the others are *deleted*.'),
        (6.6, 10.8, 'Zi casts it *at once* - *regardless of level*, even without the right *abilities*.'),
        (11.0, 15.2, 'Next round - a *level 3* Spell? No problem. He is *ahead of time*.'),
        (15.4, 19.6, '*Zi*, the Timeless King - why wait for the *right moment*?'),
    ]
    SND = {
        'draw':   [('draw', -5)],
        'flip':   [('reveal', -6)],
        'stop':   [('ability_activate', -6), ('elem_ice', -7)],
        'pick':   [('ping', -8)],
        'del':    [('creature_destroyed', -8)],
        'cast':   [('spell_cast', -5)],
        'fire':   [('elem_fire', -5), ('heavy_impact', -4), ('damage', -7)],
        'die':    [('creature_destroyed', -5)],
        'tick':   [('doom_tick', -10)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self._cache = {}
        self.K = 14.0 / self.gp
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        sm = lambda im, w, h: im.resize((w, h), Image.BOX)
        cb = Image.open(geom['cardback_path']).convert('RGB')
        w, h = self.CW // U, self.CH // U
        inner = ImageEnhance.Color(ImageEnhance.Contrast(cb.resize((w - 2, h - 3), Image.BOX)).enhance(1.35)).enhance(1.5).convert('RGBA')
        c = Image.new('RGBA', (w, h), (255, 150, 40, 255))
        c.paste(inner, (1, 1))
        self.back = c.resize((w * U, h * U), Image.NEAREST)
        self.faces = []
        self.dark = []
        for r in self.ROUNDS:
            fs, ds = [], []
            for n in r['files']:
                im = sm(ld(n), self.CW, self.CH)
                fs.append(im)
                a = np.asarray(im).astype(np.float32).copy()
                a[..., :3] *= 0.4
                ds.append(Image.fromarray(a.astype(np.uint8), 'RGBA'))
            self.faces.append(fs)
            self.dark.append(ds)
        ow, oh = self.OW // U, self.OH // U
        pix = lambda im: im.convert('RGB').resize((ow, oh), Image.BOX).resize((ow * U, oh * U), Image.NEAREST).convert('RGBA')
        self.en = [pix(ld('e-c1')), pix(ld('e-hero')), pix(ld('e-c2'))]
        self._tiles = {}
        self.stop_iv = [(r['T'] + 0.6, r['t_cast']) for r in self.ROUNDS]
        self.FLASHES = tuple([0.0] + [r['T'] + 0.6 for r in self.ROUNDS] + [r['t_cast'] + 1.2 for r in self.ROUNDS])
        self.SHOCKS = tuple([0.0] + [r['T'] + 0.6 for r in self.ROUNDS])
        self.TENSION_SHAKES = [(t, 7) for t in self.SHOCKS] + [(r['t_cast'] + 1.2, 9) for r in self.ROUNDS]
        self.T_GUST = 0.0
        self._fx = {}
        # Gegner: Haltbarkeit
        self.t_dead = {0: self.ROUNDS[0]['t_cast'] + 1.2, 2: self.ROUNDS[1]['t_cast'] + 1.2}
        self.hp_hits = [self.ROUNDS[0]['t_cast'] + 1.2, self.ROUNDS[1]['t_cast'] + 1.2]

    # ───────── Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def _ci(self, x, y):
        a, b = self._cp(x, y)
        return gamefx.rd(a), gamefx.rd(b)

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

    def hp(self, t):
        return self.HP0 - 150 * sum(1 for x in self.hp_hits if t >= x)

    def stopped(self, t):
        return any(a <= t < b for a, b in self.stop_iv)

    def _card_at(self, canvas, im, x, y):
        U = self.U
        canvas.paste(im, (int(round((x - im.width / 2) / U) * U), int(round((y - im.height / 2) / U) * U)), im)

    def _zug(self, key, a, b, dur, salt, bogen=0.0):
        if key not in self._cache:
            self._cache[key] = gamefx.Zug(self._cp(*a), self._cp(*b), dauer=dur, cw=self.CW / float(self.gp), bogen=bogen / self.gp, salt=salt, farbe=gamefx.hexc('#b3d8f9'))
        return self._cache[key]

    def _dissolve(self, im, u):
        key = ('dis', id(im), int(u * 16))
        if key not in self._cache:
            U = self.U
            w, h = im.size
            a = np.asarray(im).copy()
            yy, xx = np.mgrid[0:h, 0:w]
            thr = np.array(gamefx.BAY8)[((yy // U) % 8), ((xx // U) % 8)] / 64.0
            a[..., 3] = np.where(thr >= int(u * 16) / 16.0, a[..., 3], 0)
            self._cache[key] = Image.fromarray(a, 'RGBA')
        return self._cache[key]

    # ───────── Uhr hinter der Karte ─────────
    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        cx, cy = self._ci(self.TC[0], self.TC[1] - 20)
        R = gamefx.rd(26 * self.K)
        for k in range(12):
            an = k * math.pi / 6 - math.pi / 2
            r0 = R - (3 if k % 3 == 0 else 2)
            g.line(gamefx.rd(cx + math.cos(an) * r0), gamefx.rd(cy + math.sin(an) * r0), gamefx.rd(cx + math.cos(an) * R), gamefx.rd(cy + math.sin(an) * R), ICE[2], 0.8, 2 if k % 3 == 0 else 1)
        g.ring(cx, cy, R, R + 1, ICE[1], 0.5)
        stopped = self.stopped(t)
        # Zeiger: normal langsam, beim Aufdecken rasend schnell zurück, beim Stillstand eingefroren
        if stopped:
            tt = [a for a, b in self.stop_iv if a <= t < b][0]
            sp = 0.0
            ang_m = -math.pi / 2 + 1.2 + (tt * 0.9)
        else:
            ang_m = -math.pi / 2 + t * 0.9
            for a, b in self.stop_iv:
                if a - 0.6 <= t < a:                                                   # Zeit läuft rückwärts, bevor sie stehen bleibt
                    ang_m -= (t - (a - 0.6)) * 18
        ang_h = -math.pi / 2 + ang_m / 12.0
        g.line(cx, cy, gamefx.rd(cx + math.cos(ang_m) * (R - 4)), gamefx.rd(cy + math.sin(ang_m) * (R - 4)), ICE[3] if stopped else ICE[2], 1.0, 2)
        g.line(cx, cy, gamefx.rd(cx + math.cos(ang_h) * (R * 0.6)), gamefx.rd(cy + math.sin(ang_h) * (R * 0.6)), ICE[2], 1.0, 3)
        g.disc(cx, cy, 2, ICE[3], 1.0)

    # ───────── Gegner ─────────
    def _draw_enemies(self, canvas, d, t):
        U = self.U
        for i in range(3):
            if t < 0.3 + 0.1 * i:
                continue
            dead = self.t_dead.get(i)
            if dead is not None and t >= dead:
                tau = t - dead
                if i not in self._tiles:
                    rng = np.random.default_rng(10 + i)
                    im = self.en[i]
                    w, h = im.size
                    ts = []
                    for ty in range(0, h, 16):
                        for tx in range(0, w, 16):
                            cx, cy = tx + 8 - w / 2, ty + 8 - h / 2
                            n = math.hypot(cx, cy) or 1.0
                            sp = rng.uniform(160, 520)
                            ts.append(dict(img=im.crop((tx, ty, tx + 16, ty + 16)), x=tx - w / 2, y=ty - h / 2, vx=cx / n * sp, vy=cy / n * sp * 0.8 - rng.uniform(100, 360), life=rng.uniform(0.7, 1.1)))
                    self._tiles[i] = ts
                for p in self._tiles[i]:
                    if tau >= p['life']:
                        continue
                    if tau > p['life'] * 0.7 and (int(t * 30) & 1):
                        continue
                    x = self.EX[i] + p['x'] + p['vx'] * tau
                    y = self.EN_Y + p['y'] + p['vy'] * tau + 0.5 * 1100 * tau * tau
                    canvas.paste(p['img'], (int(round(x / U) * U), int(round(y / U) * U)), p['img'])
                continue
            y = self.EN_Y - 220 * (1 - ease_out((t - 0.3 - 0.1 * i) / 0.3))
            hit = i == 1 and any(0 <= t - x < 0.4 for x in self.hp_hits)
            sh = (8 if int(t * 30) % 2 else -8) if hit else 0
            im = self.en[i]
            canvas.paste(im, (int(round((self.EX[i] - im.width / 2 + sh) / U) * U), int(round((y - im.height / 2) / U) * U)), im)

    # ───────── Zauberkarten ─────────
    def _draw_cards(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        U, gp = self.U, self.gp
        for ri, r in enumerate(self.ROUNDS):
            T = r['T']
            if t < T or t > r['t_cast'] + 1.6:
                continue
            if t >= T - 0.3:
                self.draw_text(canvas, 'DECK', 2, (self.DECK[0], self.DECK[1] + 150), color=(255, 255, 255), outline=None, shadow=(20, 10, 30)) if ri == 0 else None
            for k in range(3):
                t0 = T + 0.3 * k
                x1 = self.SLOT_X[k]
                z = self._zug((ri, k), self.DECK, (x1, self.SLOT_Y), 0.5, 20 + ri * 7 + k, bogen=-100)
                dt = t - t0
                if dt < 0:
                    continue
                t_flip = t0 + 0.5 + 0.6                                                # nach dem Landen kurz verdeckt, dann aufgedeckt
                is_pick = (k == r['pick_i'])
                if t >= r['t_cast'] and not is_pick:
                    continue
                if t >= r['t_del'] and not is_pick:
                    tau = t - r['t_del']
                    if tau < 1.0:
                        self._shatter(canvas, ri, k, tau, t)
                    continue
                if t >= r['t_cast'] and is_pick:
                    u = (t - r['t_cast']) / 1.2
                    if u < 1.0:
                        up = ease_out(min(1.0, (t - r['t_cast']) / 0.4))
                        x = x1 + (self.TC[0] - x1) * up
                        y = self.SLOT_Y + (self.TC[1] + 160 - self.SLOT_Y) * up
                        self._card_at(canvas, self._dissolve(self.faces[ri][k], max(0.0, (u - 0.25) / 0.75)), x, y)
                    continue
                if dt < z.dauer:
                    z.draw(m, dt)
                    px, py = z.pos(dt)
                    self._card_at(canvas, self.back, px * gp + self.ox, py * gp + self.oy)
                    continue
                if t < t_flip:
                    self._card_at(canvas, self.back, x1, self.SLOT_Y)
                    z.draw(m, dt)
                    continue
                dim = t >= r['t_pick'] and not is_pick
                self._card_at(canvas, (self.dark[ri][k] if dim else self.faces[ri][k]), x1, self.SLOT_Y)
                if 0 <= t - t_flip < 0.35:
                    cx, cy = self._ci(x1, self.SLOT_Y)
                    g.ring(cx, cy, max(0, gamefx.rd(gamefx.ease((t - t_flip) / 0.3) * 12) - 1), gamefx.rd(gamefx.ease((t - t_flip) / 0.3) * 12), ICE[3], 1.0)
                self.draw_text(canvas, 'LV %d' % r['lv'][k], 3, (x1, self.SLOT_Y - 160), color=GOLD_HL if not dim else (140, 140, 160), outline=None, shadow=(20, 10, 30))
                if is_pick and t >= r['t_pick'] and int(t * 6) % 2 == 0:               # der Gegner wählt diese Karte
                    for (a, b2, c2, e2) in ((x1 - self.CW / 2 - gp, self.SLOT_Y - self.CH / 2 - gp, x1 + self.CW / 2 + gp, self.SLOT_Y - self.CH / 2 - 1),
                                            (x1 - self.CW / 2 - gp, self.SLOT_Y + self.CH / 2, x1 + self.CW / 2 + gp, self.SLOT_Y + self.CH / 2 + gp - 1),
                                            (x1 - self.CW / 2 - gp, self.SLOT_Y - self.CH / 2, x1 - self.CW / 2 - 1, self.SLOT_Y + self.CH / 2),
                                            (x1 + self.CW / 2, self.SLOT_Y - self.CH / 2, x1 + self.CW / 2 + gp - 1, self.SLOT_Y + self.CH / 2)):
                        self.pix_rect(d, a, b2, c2, e2, GOLD_HL)
        # Beschriftungen
        for ri, r in enumerate(self.ROUNDS):
            if r['T'] + 1.9 <= t < r['t_pick'] and int(t * 6) % 2 == 0:
                self.draw_text(canvas, 'OPPONENT CHOOSES', 3, (540, self.SLOT_Y - 170), color=(255, 255, 255), outline=(20, 10, 30), shadow=None)
            if r['t_del'] <= t < r['t_del'] + 1.2:
                self.draw_text(canvas, 'DELETED', 4, (540 + (200 if r['pick_i'] == 0 else 0), self.SLOT_Y - 20), color=(255, 120, 120), outline=(60, 10, 10), shadow=None)
            if r['t_cast'] <= t < r['t_cast'] + 1.6 and int(t * 7) % 2 == 0:
                self.draw_text(canvas, 'REGARDLESS OF LEVEL', 4, (540, 1000), color=GOLD_HL, outline=(20, 10, 30), shadow=None)
            if r['T'] + 0.6 <= t < r['T'] + 1.6 and int(t * 8) % 2 == 0:
                self.draw_text(canvas, 'TIME STOP', 6, (540, 1000), color=ICE[3], outline=(20, 40, 100), shadow=None)

    def _shatter(self, canvas, ri, k, tau, t):
        key = ('shat', ri, k)
        if key not in self._cache:
            rng = np.random.default_rng(30 + ri * 5 + k)
            im = self.faces[ri][k]
            w, h = im.size
            ts = []
            for ty in range(0, h, 16):
                for tx in range(0, w, 16):
                    cx, cy = tx + 8 - w / 2, ty + 8 - h / 2
                    n = math.hypot(cx, cy) or 1.0
                    sp = rng.uniform(120, 420)
                    ts.append(dict(img=im.crop((tx, ty, tx + 16, ty + 16)), x=tx - w / 2, y=ty - h / 2, vx=cx / n * sp, vy=cy / n * sp * 0.8 - rng.uniform(100, 300), life=rng.uniform(0.6, 1.0)))
            self._cache[key] = ts
        U, gp = self.U, self.gp
        for p in self._cache[key]:
            if tau >= p['life']:
                continue
            if tau > p['life'] * 0.7 and (int(t * 30) & 1):
                continue
            x = self.SLOT_X[k] + p['x'] + p['vx'] * tau
            y = self.SLOT_Y + p['y'] + p['vy'] * tau + 0.5 * 900 * tau * tau
            canvas.paste(p['img'], (int(round(x / U) * U), int(round(y / U) * U)), p['img'])

    # ───────── Zauber ─────────
    def _fxs(self):
        if self._fx:
            return self._fx
        A = self._ci(self.TC[0], self.TC[1] - 60)
        tg = [self._ci(x, self.EN_Y) for x in self.EX]
        # Fireball: Gegnerheld und linke Kreatur
        self._fx['fb'] = [gamefx.Feuerball(A, tg[1], tA=0.9, k=0.3, gr=0.8, salt=31), gamefx.Feuerball(A, tg[0], tA=0.9, k=0.3, gr=0.8, salt=47)]
        self._fx['av'] = gamefx.FlameAvalanche(A, [tg[0], tg[1], tg[2]], salt=9)
        return self._fx

    def _draw_spells(self, canvas, d, t):
        fx = self._fxs()
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        r0, r1 = self.ROUNDS
        t0 = r0['t_cast'] + 0.3
        if t >= t0:
            for f in fx['fb']:
                f.draw(m, t - t0)
        t1 = r1['t_cast'] + 0.3
        if t >= t1:
            fx['av'].draw(m, t - t1)

    # ───────── Zähler ─────────
    def _draw_hud(self, canvas, d, t):
        tot = 0
        for r in self.ROUNDS:
            if t >= r['T']:
                tot = sum(r['lv'][:min(3, int((t - r['T']) / 0.3) + 1)])
        if t >= self.ROUNDS[0]['T']:
            self.draw_text(canvas, 'SPELL LEVELS', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
            self.draw_text(canvas, '%d/6' % tot, 9, (125, 140), color=GOLD if tot < 6 else (180, 255, 190), outline=None, shadow=(60, 30, 0))
        self.draw_text(canvas, 'ENEMY HP', 3, (955, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(self.hp(t)), 9, (965, 140), color=(255, 255, 255), outline=None, shadow=(70, 10, 10))
        for x in self.hp_hits:
            tau = t - x
            if 0 <= tau < 1.0:
                self.draw_text(canvas, '150', 9, (self.EX[1] + 250, 220 - 70 * smooth(tau / 1.0)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_enemies(canvas, d, t)
        self._draw_cards(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_spells(canvas, d, t)
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
                fl = max(fl, (0.4 if tg == 0.0 else 0.2) * math.exp(-(t - tg) / 0.08))
        arr = None
        if self.stopped(t):                                                            # Zeit steht still: Bild verblasst ins Bläulich-Graue
            arr = np.asarray(img).astype(np.float32)
            gray = arr.mean(axis=2, keepdims=True)
            arr = arr * 0.45 + gray * 0.55
            arr[..., 2] = np.minimum(255, arr[..., 2] * 1.18 + 10)
        if fl > 0:
            arr = (np.asarray(img).astype(np.float32) if arr is None else arr)
            arr = arr * (1 - fl) + 255.0 * fl
        if arr is None:
            return img
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

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t + (item[2] if len(item) > 2 else 0.0), item[0], item[1]) + tuple(item[3:]))
        for r in self.ROUNDS:
            T = r['T']
            for k in range(3):
                add(T + 0.3 * k, 'draw'); add(T + 0.3 * k + 1.1, 'flip')
            add(T + 0.6, 'stop')
            for j in range(5):
                add(T + 1.8 + 0.3 * j, 'tick')
            add(r['t_pick'], 'pick'); add(r['t_del'], 'del'); add(r['t_del'] + 0.15, 'del')
            add(r['t_cast'], 'cast'); add(r['t_cast'] + 1.2, 'fire')
        add(self.t_dead[0], 'die'); add(self.t_dead[2], 'die')
        ev.append((D - 1.0, 'ascension', -9, 1.2))
        return sorted(ev)
