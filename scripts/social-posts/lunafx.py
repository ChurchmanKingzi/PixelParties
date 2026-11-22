"""Luna-Pele-Show: Hohepriesterin der Flame Fairy Luna, tanzt für die Feuersäulen. Wird ein Ziel vergiftet, brennt es auch (für den Rest des Spiels), und jedes Mal, wenn ein Ziel verbrannt wird, zieht sie
eine Karte (bis zu 4-mal pro Zug) - Enabler UND Payoff für Burn-Decks. Ein „Poisoned Well“ vergiftet drei Gegner: drei Brände, drei Karten. Ein „Poison Vial“ auf eine Creature: die vierte Karte (Obergrenze).
Die Feuersäulen (`flame_pillars` aus app-fx-12 samt Pixelflamme `ppFx1Flamme` aus app-fx-1), die Gift-Blasen (poison_vial / poison_tick, app-fx-23) und der Kartenzug (Zug, gamefx.py) sind Nachbauten
der echten Spiel-Animationen; die Statussymbole (Brand-Flamme, Gift-Tropfen) stammen aus der Statusanzeige (app-fx-52). Gleiche Schnittstelle wie WebShow."""
import math
import zlib

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

FLAME_PAL = [(204, 43, 0), (248, 116, 32), (250, 213, 74), (255, 251, 210)]
FUSS = [(255, 73, 26), (249, 172, 32), (247, 247, 173)]
VIOLET = (200, 130, 255)
FIRE_T = (255, 160, 80)
BURN_ICON = ['...r...', '..rro..', '..roo..', '.rooyo.', '.rooyo.', 'rooyyyo', 'rooycyo', '.ooyyo.', '..rooo.']
POISON_ICON = ['...e...', '...E...', '..EEe..', '.EEEEe.', 'EEHEEee', 'EEHEEee', 'EEEEeee', '.EEEee.', '..eee..']
ICOL = {'r': (192, 20, 28), 'o': (248, 116, 32), 'y': (250, 213, 74), 'c': (255, 251, 210), 'e': (45, 130, 60), 'E': (70, 190, 80), 'H': (170, 240, 150)}
SCHAEDEL = ['.WWW.', 'WKWKW', 'WWWWW', '.WWW.', '.W.W.']


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def flamme(g, cx, by, B, H, a, seed):
    """Pixelflamme (ppFx1Flamme): Fuß bei by, Spitze oben; Breite B, Höhe H in Zellen; innen heiß, außen rot, Übergänge im Bayer-Raster."""
    cx, by = gamefx.rd(cx), gamefx.rd(by)
    B, H = max(2.0, B), max(2.0, H)
    for j in range(gamefx.rd(H)):
        v = j / H
        hw = (B / 2) * ((0.8 + v * 0.9) if v < 0.22 else (1 - (v - 0.22) / 0.78) ** 0.8)
        if hw < 0.45:
            continue
        kurve = gamefx.rd(math.sin(v * 3.2 + seed) * B * 0.1 * v)
        y, hr = by - j, int(math.ceil(hw))
        for i in range(-hr, hr + 1):
            nx = abs(i) / hw
            if nx > 1:
                continue
            heat = (1 - nx * 0.9) * (1 - v * 0.65) + (gamefx.bayer(cx + i, y) - 0.5) * 0.3
            g.put(cx + i + kurve, y, FLAME_PAL[3 if heat > 0.62 else 2 if heat > 0.42 else 1 if heat > 0.2 else 0], a)


class Saeule:
    """`flame_pillars`: heller Fußblitz (380 ms), 26 Flammen/Sternchen steigen 1–1,6 Kartenhöhen auf, 14 Glutfunken spritzen oben nach außen. cx, cy = Kartenmitte (Zellen), cw, ch = Kartenmaß in Zellen."""

    def __init__(self, cx, cy, cw, ch, salt=3, mul=1.6, rise=1.0):
        self.cx, self.cy, self.cw, self.ch, self.mul = cx, cy, cw, ch, mul
        fc = cw / 100.0                                                       # Zellen je Spiel-Pixel (Kartenbreite 100 px)
        self.fc = fc
        self.fl = []
        for i in range(26):
            verz = (i * 18 + gamefx.H(salt, i * 5 + 1) * 60) / 1000.0
            dau = (420 + gamefx.H(salt, i * 5 + 2) * 240) / 1000.0
            self.fl.append(dict(sx=(-cw * 0.4 + gamefx.H(salt, i * 5 + 3) * cw * 0.8), verz=verz, dau=dau, size=12 + gamefx.H(salt, i * 5 + 4) * 14, art='f' if gamefx.H(salt, i * 5 + 5) < 4 / 6.0 else 's',
                                sway=-10 + 20 * gamefx.H(salt, i * 5 + 6), rise=-(ch + gamefx.H(salt, i * 5 + 7) * ch * 0.6) * rise, seed=gamefx.H(salt, i * 5 + 8) * 6))
        self.gl = []
        for i in range(14):
            w = -math.pi / 2 + (gamefx.H(salt, i * 7 + 301) - 0.5) * 1.4
            v = (38 + gamefx.H(salt, i * 7 + 302) * 60) / 100.0 * cw
            self.gl.append(dict(dx=math.cos(w) * v, dy=math.sin(w) * v, size=3 + gamefx.H(salt, i * 7 + 303) * 4, verz=(230 + gamefx.H(salt, i * 7 + 304) * 220) / 1000.0,
                                dau=(500 + gamefx.H(salt, i * 7 + 305) * 320) / 1000.0,
                                col=[(255, 26, 26), (255, 139, 26), (249, 172, 32), (248, 202, 33), (255, 228, 105)][int(gamefx.H(salt, i * 7 + 306) * 5)]))
        self.ende = 1.1

    @staticmethod
    def _steig(u):
        return u * u * (3 - 2 * u)

    def draw(self, m, t):
        if t < 0 or t > self.ende:
            return
        g = gamefx.R1(m)
        cx, cy, cw, ch, fc = self.cx, self.cy, self.cw, self.ch, self.fc
        bk = t / 0.38
        if bk < 1:
            sx = 0.35 + (1.1 - 0.35) * min(1, bk / 0.3) if bk < 0.3 else 1.1 + (1.45 - 1.1) * (bk - 0.3) / 0.7
            a = 0.95 * (bk / 0.3) if bk < 0.3 else 0.95 * (1 - (bk - 0.3) / 0.7)
            rx, ry = cw * 0.42 * sx, ch * 0.16 * (1.15 if bk < 0.3 else 0.8)
            yy = cy + ch * 0.38
            for j in range(-int(ry) - 1, int(ry) + 2):
                for i in range(-int(rx) - 1, int(rx) + 2):
                    d = (i / rx) ** 2 + (j / ry) ** 2
                    if d <= 1:
                        lv = a * (1 - d)
                        g.put(cx + i, yy + j, FUSS[0] if d > 0.6 else FUSS[1] if d > 0.25 else FUSS[2], min(1.0, lv * 1.6))
        for p in self.fl:
            u = (t - p['verz']) / p['dau']
            if u < 0 or u > 1:
                continue
            dyc = p['rise'] * smooth(min(1.0, u * 1.15))
            dxc = p['sway'] * fc * (0 if u < 0.15 else min(1.0, (u - 0.15) / 0.55))
            sc = 0.4 + 0.85 * min(1, u / 0.15) if u < 0.15 else (1.25 - 0.25 * (u - 0.15) / 0.55 if u < 0.7 else 1 - 0.5 * (u - 0.7) / 0.3)
            a = (u / 0.15 if u < 0.15 else 1.0 if u < 0.7 else 1 - (u - 0.7) / 0.3)
            if a < 0.03:
                continue
            size = p['size'] * sc * fc * self.mul
            x = cx + p['sx'] * fc + dxc
            y = cy + ch * 0.45 + dyc
            if p['art'] == 'f':
                flamme(g, x, y, size * 0.78, size, a, p['seed'])
            else:
                for (i, j) in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                    g.put(x + i, y + j - size * 0.5, (255, 251, 210) if (i, j) == (0, 0) else (250, 213, 74), a)
        for e in self.gl:
            u = (t - e['verz']) / e['dau']
            if u < 0 or u > 1:
                continue
            f = 1 - (1 - u) ** 3
            a = u / 0.22 if u < 0.22 else 1 - (1 - (1 - (u - 0.22) / 0.78) ** 3)
            sc = 1 - 0.65 * f
            g.disc(cx + e['dx'] * f, cy - ch * 0.35 + e['dy'] * f, max(0.5, e['size'] * sc * fc * 0.7), e['col'], min(1.0, a))


class Gift:
    """Gift-Blasen (poison_vial / poison_tick, app-fx-23). cx, cy = Ankerpunkt (Zellen), F = Zellen je Spiel-Pixel."""

    def __init__(self, cx, cy, F, vial=True, salt=5):
        self.cx, self.cy, self.F, self.vial = cx, cy, F, vial
        n = 12 if vial else 14
        self.bl = []
        for i in range(n):
            self.bl.append(dict(x=(-30 if vial else -25) + (60 if vial else 50) * gamefx.H(salt, i * 7 + 1), size=(6 + 10 * gamefx.H(salt, i * 7 + 2)) if vial else (4 + 7 * gamefx.H(salt, i * 7 + 2)),
                                verz=0.2 * gamefx.H(salt, i * 7 + 3), dau=(0.5 + 0.5 * gamefx.H(salt, i * 7 + 4)) if vial else (0.4 + 0.4 * gamefx.H(salt, i * 7 + 4)),
                                col=[(102, 24, 180), (144, 58, 230), (169, 82, 255)][int(gamefx.H(salt, i * 7 + 5) * 3)], wob=-10 + 20 * gamefx.H(salt, i * 7 + 6), sk=False))
        if vial:
            for i in range(5):
                self.bl.append(dict(x=-20 + 40 * gamefx.H(salt, i * 9 + 101), size=14, verz=0.2 + 0.3 * gamefx.H(salt, i * 9 + 102), dau=0.6 + 0.4 * gamefx.H(salt, i * 9 + 103), col=(149, 68, 213), wob=0, sk=True))
        self.ende = 1.2

    def draw(self, m, tau):
        if tau < 0 or tau > self.ende:
            return
        g = gamefx.R1(m)
        F, cx, cy = self.F, self.cx, self.cy
        if tau < 0.5:
            u = tau / 0.5
            sc = 0.3 + 1.3 * u if u < 0.5 else 1.3 + (u - 0.5) * 0.6
            op = 1.0 - 0.8 * u if u < 0.5 else 0.2 * (1 - (u - 0.5) / 0.5)
            g.disc(cx, cy, 20 * sc * F, (144, 58, 230) if self.vial else (102, 24, 180), max(0.0, op) * 0.9)
        for b in self.bl:
            u = (tau - b['verz']) / b['dau']
            if u <= 0 or u >= 1:
                continue
            if u < 0.2:
                op, dy, sc = 0.9 * u / 0.2, -15 * u / 0.2, 0.5 + 0.5 * u / 0.2
            elif u < 0.6:
                e = (u - 0.2) / 0.4
                op, dy, sc = 0.9 - 0.2 * e, -15 - 30 * e, 1 + 0.1 * e
            else:
                e = (u - 0.6) / 0.4
                op, dy, sc = 0.7 * (1 - e), -45 - 35 * e, 1.1 - 0.7 * e
            d = b['size'] * sc * F
            X = cx + (b['x'] + b['wob'] * (u - 0.5)) * F
            Y = cy + (10 + dy - b['size'] / 2) * F
            if b['sk']:
                if d >= 2.5:
                    g.disc(X, Y, d / 2 - 0.2, b['col'], op * 0.6)
                if d >= 3:
                    for ry, row in enumerate(SCHAEDEL):
                        for rx, ch in enumerate(row):
                            if ch != '.':
                                g.put(X + rx - 2, Y + ry - 2, (255, 255, 255) if ch == 'W' else (80, 0, 140), op)
            else:
                g.disc(X, Y, max(0.6, d / 2 - 0.2), b['col'], op)


class FireShow(CaptionMixin):
    CW, CH = 180, 252
    SMALL = (120, 168)
    PW, PH = 150, 210
    SLOT_X = [330, 540, 750]
    SLOT_Y = 1762
    HAND = (110, 1762)
    DECK = (975, 1762)
    SP = (925, 480)                                                                   # gespielte Karte (Poisoned Well / Poison Vial)
    CR = (925, 800)                                                                   # Creature-Ziel (Slippery Snowman)
    HP0 = [400, 400, 350]
    T_W1 = 0.8                                                                        # Poisoned Well fliegt
    T_CAST1 = 2.0
    T_POI1 = 2.4
    TB = [3.6, 4.4, 5.2]                                                              # die drei Brände (Feuersäulen)
    T_W2 = 8.6                                                                        # Poison Vial fliegt
    T_CAST2 = 9.6
    T_POI2 = 10.0
    TB4 = 11.2
    TT = [14.0, 17.0, 20.0]                                                           # Gift- und Brandschaden am Zugbeginn
    DMG = 90                                                                          # 60 Burn + 30 Poison
    CAPTIONS = [
        (0.2, 3.0, '*Luna Pele*, High Priestess of the *Flame Fairy*.'),
        (3.2, 8.2, 'Whenever a target is *Poisoned*, it is also *Burned*.'),
        (8.4, 13.4, 'And each time a target is *Burned*, she *draws a card*.'),
        (13.6, 18.4, 'Burn damage ticks every turn - an *enabler* AND a *payoff*.'),
        (18.6, 22.6, 'She dances for *Luna* - and the *pillars* obey.'),
        (22.8, 25.7, 'Burn decks, *meet your priestess*.'),
    ]
    SND = {
        'whoosh': [('booster_card_whoosh', -8)],
        'cast':   [('spell_cast', -7), ('placement', -9)],
        'poison': [('poison', -6), ('debuff', -10)],
        'burn':   [('burn', -5), ('elem_fire', -9)],
        'draw':   [('draw', -5)],
        'max':    [('ability_activate', -7)],
        'tick':   [('burn', -7), ('damage', -8)],
        'melt':   [('creature_destroyed', -6)],
        'ping':   [('ping', -9)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self._cache = {}
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        self.heroes = [ld('h%d' % (i + 1)).resize((self.CW, self.CH), Image.BOX) for i in range(3)]
        self.snow = ld('snow').resize((self.PW, self.PH), Image.BOX)
        self.well = ld('well').resize((self.PW, self.PH), Image.BOX)
        self.vial = ld('vial').resize((self.PW, self.PH), Image.BOX)
        self.well_s = ld('well').resize(self.SMALL, Image.BOX)
        self.vial_s = ld('vial').resize(self.SMALL, Image.BOX)
        self.back = None
        # Zieh-Zeitpunkte (Landung)
        self.t_draw_start = [tb + 0.3 for tb in self.TB] + [self.TB4 + 0.3]
        self.t_draw = [t + 0.5 for t in self.t_draw_start]
        self.t_burn_icon = [tb + 0.4 for tb in self.TB] + [self.TB4 + 0.4]
        self.t_poi_icon = [self.T_POI1 + 0.5] * 3 + [self.T_POI2 + 0.5]
        self.FLASHES = (0.0,)
        self.SHOCKS = (0.0,)
        self.TENSION_SHAKES = [(0.0, 6)] + [(t, 5) for t in self.TB + [self.TB4]] + [(t, 6) for t in self.TT]
        self.T_GUST = 0.0
        self._fx = {}
        self.t_win = self.TT[2] + 2.9

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

    def n_draws(self, t):
        return sum(1 for x in self.t_draw if t >= x)

    def n_burned(self, t):
        return sum(1 for x in self.t_burn_icon if t >= x)

    def hp(self, i, t):
        h = self.HP0[i]
        for tt in self.TT:
            if t >= tt + 0.5:
                h -= self.DMG
        return h

    def snow_alive(self, t):
        return t < self.TT[0] + 0.1

    def _sprite(self, d, rows, x, y, px):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == '.':
                    continue
                self.pix_rect(d, x + i * px, y + j * px, x + (i + 1) * px - 1, y + (j + 1) * px - 1, ICOL[ch])

    def _icons(self, canvas, d, x, y, poison, burn, count, hot=False):
        """Statussymbole (Gift-Tropfen mit Stapelzahl, Brand-Flamme) mit dunkler Kontur."""
        px = 5
        xx = x
        for rows, on in ((POISON_ICON, poison), (BURN_ICON, burn)):
            if not on:
                continue
            for j in range(-1, len(rows) + 1):
                for i in range(-1, len(rows[0]) + 1):
                    filled = lambda a, b: 0 <= b < len(rows) and 0 <= a < len(rows[0]) and rows[b][a] != '.'
                    if not filled(i, j) and (filled(i + 1, j) or filled(i - 1, j) or filled(i, j + 1) or filled(i, j - 1)):
                        self.pix_rect(d, xx + i * px, y + j * px, xx + (i + 1) * px - 1, y + (j + 1) * px - 1, (8, 6, 12))
            self._sprite(d, rows, xx, y, px)
            xx += (len(rows[0]) + 2) * px
        if poison and count:
            self.draw_text(canvas, 'x%d' % count, 2, (xx + 4, y + 22), color=(170, 240, 150), outline=None, shadow=(10, 40, 20))

    # ───────── Hölle … nein: Glut (Hintergrund) ─────────
    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        y0 = 1440
        cols = [(120, 30, 20), (190, 60, 20), (80, 20, 24)]
        for r in range(0, (self.H - y0) // 30 + 1):
            y = y0 + r * 30
            depth = r / float((self.H - y0) / 30.0)
            for k in range(6):
                x = (k * 71 + r * 41 - t * (20 + r * 4)) % (self.W + 160) - 80
                ln = 6 + (k + r) % 6
                cx, cy = self._ci(x, y + 8 * math.sin(t * 0.9 + k + r))
                for i in range(ln):
                    g.put(cx + i, cy, cols[(k + r) % 3], 0.18 + 0.22 * depth)
        self._bg_pillars(canvas, t)
        for k in range(16):                                                           # Glut steigt auf
            u = ((t * 0.3 + k * 0.121) % 1.0)
            x = 60 + ((k * 197) % 960)
            y = self.H - u * 620
            cx, cy = self._ci(x + 14 * math.sin(t * 2 + k), y)
            if int(t * 8 + k) % 3:
                g.put(cx, cy, (255, 170, 60) if k % 2 else (255, 100, 40), 0.85 * (1 - u))

    # ───────── Hintergrund: Feuersäulen als Dauer-Spektakel (gleiche Säulen wie bei den Bränden, nur riesig und ständig neu) ─────────
    BG_PILLARS = [(55, 40, 1.25, 0.00), (150, 34, 1.15, 0.45), (235, 28, 1.35, 0.90),
                  (1025, 40, 1.30, 0.30), (930, 34, 1.20, 0.75), (845, 28, 1.10, 0.15)]       # (x, Höhe in Zellen, Periode s, Phase s)

    def _bg_pillars(self, canvas, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        gp = self.gp
        for j, (x, chc, per, ph) in enumerate(self.BG_PILLARS):
            tt = t + ph * per
            cyc, tau = int(tt // per), tt % per
            key = ('bgp', j, cyc % 5)
            if key not in self._cache:
                cwc = 14.0
                self._cache[key] = Saeule((x - self.ox) / gp, (1590 - self.oy) / gp - chc * 0.45, cwc, float(chc), salt=300 + j * 11 + (cyc % 5), mul=3.0)
            self._cache[key].draw(m, tau)

    # ───────── Ziele, Zähler ─────────
    def _small(self):
        if self.back is None:
            cb = Image.open(self.g['cardback_path']).convert('RGB')
            U = self.U
            wu, hu = self.SMALL[0] // U, self.SMALL[1] // U
            inner = cb.resize((wu - 2, hu - 3), Image.BOX).convert('RGBA')
            c = Image.new('RGBA', (wu, hu), (255, 150, 40, 255))
            c.paste(inner, (1, 1))
            self.back = c.resize((wu * U, hu * U), Image.NEAREST)
        return self.back

    def _fxs(self):
        if 'fx' in self._fx:
            return self._fx['fx']
        gp = self.gp
        pil, gift, tick = [], [], []
        for i, x in enumerate(self.SLOT_X):
            c = self._ci(x, self.SLOT_Y)
            pil.append(Saeule(c[0], c[1], self.CW / float(gp), self.CH / float(gp), salt=11 + i, mul=2.6))
            gift.append(Gift(c[0], c[1], self.CW / 100.0 / gp * 1.0, vial=True, salt=21 + i))
        cs = self._ci(*self.CR)
        pil.append(Saeule(cs[0], cs[1], self.PW / float(gp), self.PH / float(gp), salt=17, mul=2.6))
        gift.append(Gift(cs[0], cs[1], self.PW / 100.0 / gp, vial=True, salt=27))
        self._fx['fx'] = (pil, gift)
        return self._fx['fx']

    def _draw_targets(self, canvas, d, t):
        gp, U = self.gp, self.U
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        pil, gift = self._fxs()
        # Stapel: Hand links, Deck rechts
        small = self._small()
        for k in range(3):
            canvas.paste(small, (int(self.DECK[0] - small.width / 2 + 4 * k), int(self.DECK[1] - small.height / 2 - 4 * k)), small)
        for k in range(2 + self.n_draws(t)):
            canvas.paste(small, (int(self.HAND[0] - small.width / 2 + 7 * (k % 8)), int(self.HAND[1] - small.height / 2 - 9 * (k % 8))), small)
        self.draw_text(canvas, 'HAND', 2, (self.HAND[0] + 10, self.HAND[1] - 112), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, 'DECK', 2, (self.DECK[0], self.DECK[1] - 112), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        # drei Helden
        for i, x in enumerate(self.SLOT_X):
            dx = 0
            for tt in self.TT:
                if 0 <= t - tt < 0.4:
                    dx = 6 if int(t * 30) % 2 else -6
            self._card_at(canvas, self.heroes[i], x + dx, self.SLOT_Y)
            poison = t >= self.t_poi_icon[i]
            burn = t >= self.t_burn_icon[i]
            stacks = 1 + sum(1 for tt in self.TT if t >= tt + 0.5) * 0                  # Gift: ein Stapel
            hot = any(0 <= t - tt - 0.5 < 0.5 and int(t * 15) % 2 == 0 for tt in self.TT)
            self.draw_text(canvas, str(self.hp(i, t)), 3, (x - 52, self.SLOT_Y - 146), color=(255, 255, 255) if hot else GOLD, outline=None, shadow=(60, 30, 0))
            self._icons(canvas, d, x + 2, self.SLOT_Y - 166, poison, burn, 1 if poison else 0)
        # Creature (Slippery Snowman)
        t_in = self.T_W2 + 0.4
        if t_in <= t < self.TT[0] + 0.1 + 0.8:
            im = self.snow
            if t < t_in + 0.5:
                im = self._dissolve(im, 1.0 - (t - t_in) / 0.5, ('snow_in',))
            elif t >= self.TT[0] + 0.1:
                u = min(1.0, (t - self.TT[0] - 0.1) / 0.7)
                im = self._dissolve(im, u, ('snow_out',))
            self._card_at(canvas, im, *self.CR)
            if t < self.TT[0] + 0.1:
                poison = t >= self.t_poi_icon[3]
                burn = t >= self.t_burn_icon[3]
                self.draw_text(canvas, '50', 3, (self.CR[0] - 44, self.CR[1] + 128), color=GOLD, outline=None, shadow=(60, 30, 0))
                self._icons(canvas, d, self.CR[0] - 4, self.CR[1] + 108, poison, burn, 1 if poison else 0)
        # Feuersäulen
        for i, tb in enumerate(self.TB):
            pil[i].draw(m, t - tb)
        pil[3].draw(m, t - self.TB4)
        # Gift-Blasen
        for i in range(3):
            gift[i].draw(m, t - self.T_POI1)
        gift[3].draw(m, t - self.T_POI2)
        # „vergiftet → brennt“: Zeichen über dem Ziel
        for i, tb in enumerate(self.TB + [self.TB4]):
            tau = t - tb
            if 0 <= tau < 0.9:
                px = self.SLOT_X[i] if i < 3 else self.CR[0]
                py = (self.SLOT_Y - 190) if i < 3 else self.CR[1] - 150
                self.draw_text(canvas, 'BURNED!', 3, (px, py - 30 * smooth(tau / 0.9)), color=FIRE_T, outline=(60, 10, 0), shadow=None)
        # Zugbrände: Zähler und Flammen am Zugbeginn
        for ti, tt in enumerate(self.TT):
            tau = t - tt
            if not (0 <= tau < 1.2):
                continue
            for i, x in enumerate(self.SLOT_X + [self.CR[0]]):
                if i == 3 and ti > 0:
                    continue
                c = self._ci(x, self.SLOT_Y if i < 3 else self.CR[1])
                h = self.CH if i < 3 else self.PH
                w = self.CW if i < 3 else self.PW
                g = gamefx.R1(m)
                for k in range(5):
                    u = (tau - 0.06 * k) / 0.7
                    if 0 <= u < 1:
                        xx = c[0] + (k - 2) * (w / gp / 5.0)
                        hh = (2.5 + 2.5 * math.sin(math.pi * u)) * 1.6
                        flamme(g, xx, c[1] + h / gp * 0.45, hh * 0.9, hh * 1.5, 1.0 - u * 0.6, 3 + k)
                gift_t = Gift(c[0], c[1], w / 100.0 / gp, vial=False, salt=40 + ti * 5 + i)
                gift_t.draw(m, tau)
                if tau >= 0.3 and tau < 1.1 and i < 3:
                    self.draw_text(canvas, '-%d' % self.DMG, 5, (x - 90, self.SLOT_Y - 190 - 60 * smooth((tau - 0.3) / 0.8)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)
        # Ziel-Karte (gespielt)
        self._draw_played(canvas, d, t, m)

    def _draw_played(self, canvas, d, t, m):
        gp = self.gp
        for k, (t0, tc, small, big, name) in enumerate([(self.T_W1, self.T_CAST1, self.well_s, self.well, 'POISONED WELL'), (self.T_W2, self.T_CAST2, self.vial_s, self.vial, 'POISON VIAL')]):
            key = ('pf', k)
            if key not in self._cache:
                self._cache[key] = gamefx.Zug(self._cp(*self.HAND), self._cp(*self.SP), dauer=0.5, cw=self.SMALL[0] / float(gp), bogen=-260 / gp, salt=70 + k, farbe=gamefx.hexc('#c98aff'))
            z = self._cache[key]
            dt = t - t0
            if 0 <= dt < z.ende:
                z.draw(m, dt)
                if dt < z.dauer:
                    px, py = z.pos(dt)
                    self._card_at(canvas, small, px * gp + self.ox, py * gp + self.oy)
            if t0 + 0.5 <= t < tc + 0.9:
                im = big
                if t >= tc + 0.4:
                    im = self._dissolve(big, (t - tc - 0.4) / 0.5, ('pf_out', k))
                self._card_at(canvas, im, *self.SP)
                if t < tc + 0.4:
                    self.draw_text(canvas, name, 2, (self.SP[0], self.SP[1] - 122), color=VIOLET, outline=None, shadow=(20, 10, 40))
                    if t >= tc and int(t * 15) % 2 == 0:
                        self.pix_rect(ImageDraw.Draw(canvas), self.SP[0] - self.PW / 2 - 6, self.SP[1] - self.PH / 2 - 6, self.SP[0] + self.PW / 2 + 5, self.SP[1] - self.PH / 2 - 1, (255, 255, 255))
        # Kartenzug
        for i, ts in enumerate(self.t_draw_start):
            key = ('dr', i)
            if key not in self._cache:
                self._cache[key] = gamefx.Zug(self._cp(*self.DECK), self._cp(self.HAND[0], self.HAND[1] - 40), dauer=0.5, cw=self.SMALL[0] / float(gp), bogen=-200 / gp, salt=90 + i, farbe=gamefx.hexc('#ffb040'))
            z = self._cache[key]
            dt = t - ts
            if 0 <= dt < z.ende:
                z.draw(m, dt)
                if dt < z.dauer:
                    px, py = z.pos(dt)
                    self._card_at(canvas, self._small(), px * gp + self.ox, py * gp + self.oy)

    def _draw_hud(self, canvas, d, t):
        n = self.n_draws(t)
        self.draw_text(canvas, 'DRAWS', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        hot = any(0 <= t - x < 0.45 and int(t * 15) % 2 == 0 for x in self.t_draw)
        self.draw_text(canvas, str(n), 9, (105, 140), color=(255, 255, 255) if hot else GOLD, outline=None, shadow=(60, 30, 0))
        self.draw_text(canvas, 'BURNED', 3, (940, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(self.n_burned(t)), 9, (950, 140), color=FIRE_T, outline=None, shadow=(80, 20, 0))

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        self._draw_targets(canvas, d, t)
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
        add(self.T_W1, 'whoosh'); add(self.T_CAST1, 'cast'); add(self.T_POI1, 'poison')
        add(self.T_W2, 'whoosh'); add(self.T_CAST2, 'cast'); add(self.T_POI2, 'poison')
        for tb in self.TB + [self.TB4]:
            add(tb, 'burn')
        for ts, tl in zip(self.t_draw_start, self.t_draw):
            add(ts, 'whoosh'); add(tl, 'draw')
        for tt in self.TT:
            add(tt, 'tick')
        add(self.TT[0] + 0.1, 'melt')
        return sorted(ev)
