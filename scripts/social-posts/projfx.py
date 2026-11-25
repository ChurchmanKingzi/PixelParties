"""Idej-Lord-Daiyo-Show: ein Kriegsherr aus einer anderen Dimension, der in dieser Welt nur als Projektion existiert - Licht, das man nicht greifen kann. Zu Spielbeginn hängen 3 „Idej Projection“ an ihm;
jede negiert, wenn er Schaden nehmen würde, den ganzen Schaden samt Effekten. Seine Klinge, Idej Sword - Kogarasu, ist sein persönliches Schwert (bei Daiyo kostenlos).
Die grüne Hologramm-Kuppel mit Ringen, Blitz, Rasterlinien und Schild-Zeichen (`idej_projection_absorb`, app-fx-4), Feuerball, Pfeile, Schnitt und Schwurf (gamefx.py) sind Nachbauten der echten
Spiel-Animationen. Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

GRUEN = dict(dunkel=(44, 160, 88), mitte=(76, 235, 112), ring=(102, 255, 162), blitz=(104, 253, 193), hell=(179, 249, 207), weiss=(229, 250, 231))
SCHILD = None


def _schild():
    rows = []
    for y in range(15):
        row = ''
        for x in range(13):
            dx = abs(x - 6)
            hw = 6 if y < 9 else 14 - y
            if dx > hw:
                row += '.'
            elif y == 0 or dx == hw:
                row += 'o'
            elif dx == 0 and y < 11:
                row += 'w'
            else:
                row += 'l' if (x < 6 and y < 8) else 'g'
        rows.append(row)
    return rows


SCHILD = _schild()
GLYPH_PAL = {'o': GRUEN['dunkel'], 'g': GRUEN['mitte'], 'l': GRUEN['hell'], 'w': GRUEN['weiss']}


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class ProjShow(CaptionMixin):
    CAP_SCALE = 5
    SMALL = (120, 168)
    PW, PH = 112, 157
    PROJ_X = 125
    PROJ_Y = [560, 750, 940]                                                           # die drei angehängten Projektionen (links)
    DECK = (975, 1752)
    HAND = (110, 1752)
    OPP = (925, 500)
    OW, OH = 150, 210
    OHP0 = 350
    HERO = (540, 720)
    T_ATT = [0.8, 1.2, 1.6]                                                            # Projektionen fliegen aus dem Deck an
    ATK = [4.6, 9.0, 12.6]                                                             # drei Angriffe des Gegners
    ABS = [5.6, 10.0, 13.5]                                                            # Zeitpunkt der Absorption (Kuppel)
    NAMES = ['FIREBALL', 'ARROWS', 'SLASH']
    T_SWORD = 14.6                                                                     # Kogarasu fliegt zu Daiyo
    STRIKE = [(17.4, 120), (20.4, 120)]                                                # (Start, Schaden) der Gegenschläge
    CAPTIONS = [
        (0.2, 3.0, '*Idej Lord Daiyo* - a warlord from beyond.'),
        (3.2, 7.6, 'He exists here only as a *projection* - *light* that cannot be touched.'),
        (7.8, 12.4, 'Each *Projection* negates a hit - *all damage* and *all effects*.'),
        (12.6, 17.2, 'Like every Idej, he carries a *sword* of great power.'),
        (17.4, 22.0, 'Hard to hurt - and *harder to stop*.'),
        (22.2, 25.7, 'The *warlord* from another dimension.'),
    ]
    SND = {
        'whoosh': [('booster_card_whoosh', -8)],
        'land':   [('placement', -8), ('pull_sparkle', -11)],
        'fire':   [('elem_fire', -6), ('spell_cast', -9)],
        'arrow':  [('projectile', -7)],
        'slash':  [('slash', -5)],
        'absorb': [('negate', -4), ('ability_activate', -9), ('pull_sparkle', -9)],
        'equip':  [('ability_activate', -6), ('placement', -8)],
        'strike': [('slash', -4), ('critical_strike', -8), ('damage', -7)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self.actor_fn = geom['actor_fn']
        self.sprite_origin = geom['sprite_origin']
        self._cache = {}
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        self.proj_s = self._holo(ld('c1').resize(self.SMALL, Image.BOX))
        self.proj_l = self._holo(ld('c1').resize((self.PW, self.PH), Image.BOX))
        self.sword_s = ld('c2').resize(self.SMALL, Image.BOX)
        self.sword_l = ld('c2').resize((180, 252), Image.BOX)
        self.opp = ld('c3').resize((self.OW, self.OH), Image.BOX)
        self.back = None
        self.t_land = [t + 0.5 for t in self.T_ATT]
        self.t_abs_end = [a + 0.9 for a in self.ABS]
        self.FLASHES = (0.0,)
        self.SHOCKS = (0.0,) + tuple(self.ABS)
        self.TENSION_SHAKES = [(0.0, 5)] + [(a, 6) for a in self.ABS] + [(s[0] + 0.6, 8) for s in self.STRIKE]
        self.T_GUST = 0.0
        self._fx = {}

    # ───────── Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def _ci(self, x, y):
        a, b = self._cp(x, y)
        return gamefx.rd(a), gamefx.rd(b)

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

    def _card_at(self, canvas, im, x, y):
        U = self.U
        canvas.paste(im, (int(round((x - im.width / 2) / U) * U), int(round((y - im.height / 2) / U) * U)), im)

    def _holo(self, im):
        """Hologramm-Fassung einer Karte: grün getönt, Rasterlinien (jede dritte Zeile dunkel)."""
        a = np.asarray(im).astype(np.float32)
        g = np.array(GRUEN['mitte'], np.float32)
        lum = a[..., :3].mean(axis=2, keepdims=True) / 255.0
        a[..., :3] = np.clip(lum * 0.55 * 255 + g * 0.55 * (0.35 + lum * 0.65), 0, 255)
        h = a.shape[0]
        for y in range(0, h, 12):
            a[y:y + 4, :, :3] *= 0.55
        return Image.fromarray(a.astype(np.uint8), 'RGBA')

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

    def n_proj(self, t):
        n = sum(1 for tl in self.t_land if t >= tl)
        n -= sum(1 for a in self.ABS if t >= a)
        return max(0, n)

    def opp_hp(self, t):
        h = self.OHP0
        for ts, dmg in self.STRIKE:
            if t >= ts + 0.9:
                h -= dmg
        return h

    # ───────── Hintergrund: Lichtraster (Dimension) ─────────
    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        cx, cy = self._ci(self.HERO[0], self.HERO[1])
        # waagerechte Lichtbahnen, die langsam wandern (Projektionsstrahl von oben)
        for k in range(10):
            y = ((k * 0.11 + t * 0.05) % 1.0)
            Y = gamefx.rd(8 + y * 160)
            ln = 30 + (k * 13) % 40
            X0 = gamefx.rd((k * 47) % 90 - 10 + 8 * math.sin(t * 0.7 + k))
            for i in range(ln):
                g.put(X0 + i, Y, GRUEN['dunkel'], 0.22)
        # senkrechte Strahlen im Rand (Hologramm-Projektor)
        for k in range(8):
            x = 18 + (k * 17) % 90
            ph = (t * 0.35 + k * 0.19) % 1.0
            for Y in range(gamefx.rd(10 + ph * 40), gamefx.rd(10 + ph * 40) + 26):
                g.put(x, Y, GRUEN['ring'], 0.18 + 0.2 * ((Y % 3) == 0))
        # Funken wie Pixelstaub, der aus dem Licht steigt
        for k in range(26):
            u = (t * 0.2 + k * 0.1) % 1.0
            sx, sy = self._ci(30 + (k * 197) % 1020 + 10 * math.sin(t + k), self.H - u * 1500)
            if int(t * 6 + k) % 3:
                g.put(sx, sy, GRUEN['hell'], 0.7 * (1 - u))

    # ───────── Hologramm-Überlagerung auf Daiyo (Rasterlinien, Flackern) ─────────
    def _holo_overlay(self, canvas, t, dx):
        idx = int(t * 1000.0 / 90)
        im, pad = self.actor_fn('daiyo', idx)
        a = np.asarray(im)[..., 3] > 0
        h, w = a.shape
        U = self.U
        ov = np.zeros((h, w, 4), np.uint8)
        yy = np.arange(h)[:, None]
        xx = np.arange(w)[None, :]
        lines = (((yy // U) % 4 == 0) & (((xx // U) + (yy // U)) % 2 == 0)) & a
        ov[lines] = (4, 34, 20, 255)
        # Flackerbänder: ab und zu ein heller Streifen (Störung der Projektion)
        ph = (t * 0.6) % 1.0
        if ph < 0.12 or any(0 <= t - a_ < 0.4 for a_ in self.ABS):
            by = int(((t * 7) % 1.0) * h)
            band = (yy >= by) & (yy < by + 3 * U) & a
            ov[band] = (*GRUEN['hell'], 255)
        o = Image.fromarray(ov, 'RGBA')
        sx, sy = self.sprite_origin
        canvas.paste(o, (int(sx + dx - pad), int(sy - pad)), o)

    # ───────── Kuppel: idej_projection_absorb (app-fx-4) ─────────
    def _dome(self, m, tau):
        if tau < 0 or tau > 1.0:
            return
        g = gamefx.R1(m)
        cx, cy = self._ci(self.HERO[0], self.HERO[1] + 10)
        base = 22.0
        ms = tau * 1000.0
        for i, mm in enumerate((1.7, 2.3, 2.9)):                                       # drei Ringe
            k = (ms - i * 110) / 900.0
            if 0 <= k <= 1:
                sc = 0.12 + 1.38 * (1 - (1 - k) ** 2)
                a = k / 0.18 * 0.95 if k < 0.18 else 0.95 * (1 - (k - 0.18) / 0.82)
                r = base * mm / 2 * sc
                if r >= 1.5:
                    g.ring(cx, cy, r - 1, r, GRUEN['ring'], max(0.0, a))
                    if r > 4:
                        g.ring(cx, cy, r - 2.2, r - 1, GRUEN['mitte'], max(0.0, a) * 0.45)
        fk = ms / 340.0                                                                # Blitz
        if fk <= 1:
            sc = 0.3 + 0.7 * (fk / 0.35) if fk < 0.35 else 1 + 0.35 * (fk - 0.35) / 0.65
            a = fk / 0.35 if fk < 0.35 else 1 - (fk - 0.35) / 0.65
            r = base * 1.1 * sc * 0.75
            for j in range(-int(r) - 1, int(r) + 2):
                for i in range(-int(r) - 1, int(r) + 2):
                    d = math.hypot(i, j) / r
                    if d <= 1:
                        g.put(cx + i, cy + j, GRUEN['weiss'] if d < 0.3 else GRUEN['blitz'] if d < 0.6 else GRUEN['mitte'], min(1.0, max(0.0, a) * (1.2 - d)))
        dk = ms / 880.0                                                                # Kuppel mit Rasterlinien
        if dk <= 1:
            sc = (0.18 + 1.0 * (dk / 0.22)) if dk < 0.22 else (1.18 - 0.2 * (dk - 0.22) / 0.28 if dk < 0.5 else 0.98 + 0.32 * (dk - 0.5) / 0.5)
            a = (dk / 0.22) if dk < 0.22 else (1.0 if dk < 0.5 else 1 - (dk - 0.5) / 0.5)
            R = base * 0.95 * sc
            if R >= 2:
                for j in range(-int(R), int(R) + 1):
                    hb = math.sqrt(max(0.0, R * R - j * j))
                    for i in range(-int(hb), int(hb) + 1):
                        d = math.hypot(i, j) / R
                        col = GRUEN['blitz'] if d < 0.45 else GRUEN['mitte'] if d < 0.78 else GRUEN['dunkel']
                        g.put(cx + i, cy + j, col, a * 0.45 * (1.0 - d * 0.4))
                    if j % 2 == 0:
                        for i in range(-int(hb), int(hb) + 1):
                            g.put(cx + i, cy + j, GRUEN['hell'], a * 0.3)
                g.ring(cx, cy, R - 1, R, GRUEN['hell'], a)
        gk = ms / 880.0                                                                # Schild-Zeichen
        if gk <= 1:
            a = gk / 0.28 if gk < 0.28 else 1.0 if gk < 0.6 else 1 - (gk - 0.6) / 0.4
            for jj, row in enumerate(SCHILD):
                for ii, ch in enumerate(row):
                    if ch != '.':
                        g.put(cx + ii - 6, cy + jj - 7, GLYPH_PAL[ch], max(0.0, min(1.0, a)))

    # ───────── Karten, Angriffe, Schwert ─────────
    def _small(self):
        if self.back is None:
            cb = Image.open(self.g['cardback_path']).convert('RGB')
            U = self.U
            wu, hu = self.SMALL[0] // U, self.SMALL[1] // U
            inner = cb.resize((wu - 2, hu - 3), Image.BOX).convert('RGBA')
            c = Image.new('RGBA', (wu, hu), (76, 235, 112, 255))
            c.paste(inner, (1, 1))
            self.back = c.resize((wu * U, hu * U), Image.NEAREST)
        return self.back

    def _zug(self, key, A, B, salt, farbe, dur=0.5, cw=None):
        if key not in self._cache:
            self._cache[key] = gamefx.Zug(self._cp(*A), self._cp(*B), dauer=dur, cw=(cw or self.SMALL[0]) / float(self.gp), bogen=-200 / self.gp, salt=salt, farbe=gamefx.hexc(farbe))
        return self._cache[key]

    def _attack_fx(self):
        if 'fx' in self._fx:
            return self._fx['fx']
        gp = self.gp
        A = self._ci(*self.OPP)
        B = self._ci(self.HERO[0] + 30, self.HERO[1] - 10)
        Bk = self._ci(self.HERO[0] + 140, self.HERO[1] - 10)                          # der Ball bleibt an der Kuppel hängen
        fb = gamefx.Feuerball(A, Bk, tA=0.9, k=0.8, salt=31, stop=0.9 * 0.92, kill=0.9 * 0.92 + 0.05)
        arrows = []
        for k in range(4):
            a = self._cp(self.OPP[0] - 40, self.OPP[1] + (k - 1.5) * 30)
            b = self._cp(self.HERO[0] + 120, self.HERO[1] - 40 + (k - 1.5) * 40)
            arrows.append(gamefx.Geschoss('pfeil', a, b, 0.8, t0=0.05 * k, R=7, schweif=False, salt=6 + k, va=1))
        hit = gamefx.Schnitt(gamefx.rd(self._cp(self.HERO[0] + 40, self.HERO[1])[0]), gamefx.rd(self._cp(self.HERO[0] + 40, self.HERO[1])[1]), 22, krit=True, salt=51, direction=(-0.6, 0.8))
        sw = []
        for i in range(2):
            A2 = self._cp(self.HERO[0] + 160, self.HERO[1] - 120)
            B2 = self._cp(self.OPP[0], self.OPP[1])
            sw.append(gamefx.Geschoss('schwert', A2, B2, 0.55, t0=0.0, R=10, salt=70 + i,
                                      pal=[GRUEN['dunkel'], GRUEN['mitte'], GRUEN['hell'], GRUEN['weiss']], ramp=[GRUEN['weiss'], GRUEN['hell'], GRUEN['mitte'], GRUEN['dunkel']]))
        cut = [gamefx.Schnitt(gamefx.rd(self._cp(*self.OPP)[0]), gamefx.rd(self._cp(*self.OPP)[1]), self.OH / float(gp), krit=True, salt=91 + i,
                              pal=dict(creme=GRUEN['weiss'], tinte=(8, 40, 24), hblau=GRUEN['hell'], blau=GRUEN['mitte'], gelb=GRUEN['blitz'], orange=GRUEN['dunkel'], rot=GRUEN['ring']))
               for i in range(2)]
        self._fx['fx'] = (fb, arrows, hit, sw, cut)
        return self._fx['fx']

    def _draw_stage(self, canvas, d, t):
        gp, U = self.gp, self.U
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        fb, arrows, hit, sw, cut = self._attack_fx()
        small = self._small()
        # Deck rechts, Hand links (unten)
        for k in range(4):
            canvas.paste(small, (int(self.DECK[0] - small.width / 2 + 4 * k), int(self.DECK[1] - small.height / 2 - 4 * k)), small)
        self.draw_text(canvas, 'DECK', 3, (self.DECK[0], self.DECK[1] - 118), color=(255, 255, 255), outline=None, shadow=(5, 30, 20))
        if t < self.T_SWORD:
            canvas.paste(small, (int(self.HAND[0] - small.width / 2), int(self.HAND[1] - small.height / 2)), small)
            self.draw_text(canvas, 'HAND', 3, (self.HAND[0] + 10, self.HAND[1] - 118), color=(255, 255, 255), outline=None, shadow=(5, 30, 20))
        # Projektionen fliegen an
        for i, ta in enumerate(self.T_ATT):
            z = self._zug(('pf', i), self.DECK, (self.PROJ_X, self.PROJ_Y[i]), 20 + i, '#66ffa2')
            dt = t - ta
            if 0 <= dt < z.ende:
                z.draw(m, dt)
                if dt < z.dauer:
                    px, py = z.pos(dt)
                    self._card_at(canvas, self.proj_s, px * gp + self.ox, py * gp + self.oy)
        # angehängte Projektionen (links), die am Ende des Zuges verbraucht werden
        for i in range(3):
            if t < self.t_land[i]:
                continue
            tc = self.ABS[i] - 0.5
            if t < tc:
                bob = int(round(5 * math.sin(t * 2.0 + i) / U)) * U
                self._card_at(canvas, self.proj_l, self.PROJ_X, self.PROJ_Y[i] + bob)
            elif t < self.ABS[i]:                                                      # fliegt zu Daiyo
                z = self._zug(('pc', i), (self.PROJ_X, self.PROJ_Y[i]), (self.HERO[0], self.HERO[1]), 40 + i, '#b3f9cf', dur=0.5, cw=self.PW)
                dt = t - tc
                z.draw(m, dt)
                if dt < z.dauer:
                    px, py = z.pos(dt)
                    self._card_at(canvas, self.proj_l, px * gp + self.ox, py * gp + self.oy)
        self.draw_text(canvas, 'PROJECTIONS', 2, (self.PROJ_X, 460), color=GRUEN['hell'], outline=None, shadow=(5, 40, 20)) if self.n_proj(t) else None
        # Gegner
        dxo = 0
        for ts, dmg in self.STRIKE:
            if 0 <= t - ts - 0.9 < 0.5:
                dxo = 8 if int(t * 30) % 2 else -8
        self._card_at(canvas, self.opp, self.OPP[0] + dxo, self.OPP[1])
        self.draw_text(canvas, 'OPPONENT', 3, (self.OPP[0], self.OPP[1] - 124), color=(255, 140, 140), outline=None, shadow=(20, 10, 30))
        hot = any(0 <= t - ts - 0.9 < 0.5 and int(t * 15) % 2 == 0 for ts, dmg in self.STRIKE)
        self.draw_text(canvas, '%d HP' % self.opp_hp(t), 3, (self.OPP[0], self.OPP[1] + 128), color=(255, 255, 255) if hot else GOLD, outline=None, shadow=(60, 30, 0))
        # Angriffe des Gegners
        for i, ta in enumerate(self.ATK):
            tau = t - ta
            if 0 <= tau < 1.2:
                self.draw_text(canvas, self.NAMES[i] + '!', 4, (self.OPP[0], self.OPP[1] + 176), color=(255, 120, 130), outline=None, shadow=(60, 10, 20)) if int(t * 10) % 2 == 0 else None
        tau = t - self.ATK[0]
        if 0 <= tau < 1.6:
            fb.draw(m, tau)
        for k, a_ in enumerate(arrows):
            if t >= self.ATK[1]:
                a_.draw(m, t - self.ATK[1])
        if t >= self.ATK[2] + 0.3 and t < self.ATK[2] + 1.4:
            hit.draw(m, t - self.ATK[2] - 0.3)
        # Absorption
        for i, ta in enumerate(self.ABS):
            self._dome(m, t - ta)
            tau = t - (ta + 0.1)
            if 0 <= tau < 1.2:
                self.draw_text(canvas, 'NEGATED', 5, (self.HERO[0] + 20, self.HERO[1] - 300 - 40 * smooth(tau / 1.2)), color=GRUEN['hell'], outline=(5, 50, 30), shadow=None)
                self.draw_text(canvas, '0', 9, (self.HERO[0] + 230, self.HERO[1] - 250 - 40 * smooth(tau / 1.2)), color=(255, 244, 220), outline=(40, 160, 90), shadow=None)
        # Schwert: Karte fliegt zu Daiyo, danach liegt sie unten in der Mitte
        z = self._zug(('sw',), self.HAND, (self.HERO[0], self.HERO[1] + 60), 60, '#e5fae7')
        dt = t - self.T_SWORD
        if 0 <= dt < z.ende:
            z.draw(m, dt)
            if dt < z.dauer:
                px, py = z.pos(dt)
                self._card_at(canvas, self.sword_s, px * gp + self.ox, py * gp + self.oy)
        t_eq = self.T_SWORD + 0.5
        if t >= t_eq:
            u = min(1.0, (t - t_eq) / 0.6)
            im = self._dissolve(self.sword_l, 1.0 - u, ('swl',)) if u < 1 else self.sword_l
            self._card_at(canvas, im, 540, 1752)
            self.draw_text(canvas, 'EQUIPPED - COST 0', 3, (540, 1620), color=GRUEN['hell'], outline=None, shadow=(5, 40, 20))
            tau = t - t_eq
            if 0 <= tau < 0.9:
                c = self._ci(self.HERO[0], self.HERO[1])
                g = gamefx.R1(m)
                for i, col in enumerate([GRUEN['weiss'], GRUEN['hell'], GRUEN['mitte']]):
                    r = gamefx.rd(gamefx.ease(max(0.0, tau - 0.08 * i) / 0.8) * 24)
                    if r > 0:
                        g.ring(c[0], c[1], max(0, r - 2), r, col, 1.0)
        # Gegenschläge mit dem Schwert
        for i, (ts, dmg) in enumerate(self.STRIKE):
            tau = t - ts
            if 0 <= tau < 0.6:
                sw[i].draw(m, tau)
            if 0.5 <= tau < 1.7:
                cut[i].draw(m, tau - 0.5)
            tau2 = t - (ts + 0.9)
            if 0 <= tau2 < 1.0:
                self.draw_text(canvas, '-%d' % dmg, 9, (self.OPP[0] - 200, self.OPP[1] - 20 - 70 * smooth(tau2 / 1.0)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)

    # ───────── Zähler ─────────
    def _draw_hud(self, canvas, d, t):
        n = self.n_proj(t)
        self.draw_text(canvas, 'PROJECTIONS', 3, (190, 74), color=(255, 255, 255), outline=None, shadow=(5, 30, 20))
        hot = any(0 <= t - x < 0.5 and int(t * 15) % 2 == 0 for x in self.t_land + list(self.ABS))
        self.draw_text(canvas, str(n), 9, (125, 140), color=(255, 255, 255) if hot else GRUEN['mitte'], outline=None, shadow=(10, 60, 30))
        self.draw_text(canvas, 'DAMAGE TAKEN', 3, (880, 74), color=(255, 255, 255), outline=None, shadow=(5, 30, 20))
        self.draw_text(canvas, '0', 9, (950, 140), color=GRUEN['hell'], outline=None, shadow=(10, 60, 30))

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._holo_overlay(canvas, t, self.sprite_dx(f))
        d = ImageDraw.Draw(canvas)
        self._draw_stage(canvas, d, t)
        self._draw_hud(canvas, ImageDraw.Draw(canvas), t)
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
                fl = max(fl, 0.4 * math.exp(-(t - tg) / 0.08))
        for ta in self.ABS:
            if 0 <= t - ta < 0.2:
                fl = max(fl, 0.25 * math.exp(-(t - ta) / 0.06))
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

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t, item[0], item[1]) + tuple(item[2:]))
        for ta in self.T_ATT:
            add(ta, 'whoosh'); add(ta + 0.5, 'land')
        add(self.ATK[0], 'fire'); add(self.ATK[1], 'arrow'); add(self.ATK[2], 'slash')
        for ta in self.ABS:
            add(ta, 'absorb')
        add(self.T_SWORD, 'whoosh'); add(self.T_SWORD + 0.5, 'equip')
        for ts, dmg in self.STRIKE:
            add(ts, 'whoosh'); add(ts + 0.9, 'strike')
        return sorted(ev)
