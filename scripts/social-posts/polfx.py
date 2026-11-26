"""Victorica-Show: die Eternal Empress. Ihre Magie hebelt die Regeln der Magie aus - aber sie saugt dabei so viel natürliches Mana aus der Umgebung, dass graue, magielose Verschmutzung zurückbleibt (Pollution Tokens in den
freien Support Zones). Mit Eraser Beam (3 Tokens, besiegt ein Ziel) und Rain of Death (löscht alle Zusatz-Abilities) hat sie ihr Empire erweitert, mit Reincarnation (2 Tokens) ihre Liebsten zurückgeholt - und
einen Berg Verschmutzung angehäuft: jeder Token senkt die maximale Handgröße um 1. Einmal pro Zug darf sie einen (nicht in diesem Zug gelegten) Token entfernen.
Eraser Beam (app-board.jsx `onEraserBeam`: Ladekugel, Strahl mit Kern, Schein und Blitzbögen, Einschlagriss, Glut), Pollution Place und Pollution verdunstet (`pollution_evaporate`, app-fx-6), Rain of Death (app-fx-6)
und Angel Revival (Reincarnation, app-fx-9) sind Nachbauten der echten Spiel-Animationen. Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL

LILA = (149, 68, 213)
LILA_D = (71, 17, 126)
LILA_DD = (26, 10, 58)
LAV = (214, 179, 249)
RED = (240, 50, 50)
RED_D = (190, 20, 30)
RED_DD = (82, 10, 12)
PALE = (250, 229, 235)
SKULL = ['.WWW.', 'WWWWW', 'WKWKW', 'WWWWW', '.WSW.', '.W.W.']
DROP = ['.D.', '.R.', 'RRR', 'RHR', '.R.']
SKCOL = {'W': (230, 230, 230), 'S': (168, 168, 168), 'K': (58, 0, 0), 'D': (120, 0, 0), 'R': (190, 14, 14), 'H': (255, 102, 102)}


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


class PollutionShow(CaptionMixin):
    CAP_SCALE = 5
    HERO = (540, 700)
    HAND_Y = 640                                                                       # Hände (Ursprung von Strahl und Ladekugel)
    OPP = (925, 480)
    ALLY = (125, 720)
    CW, CH = 150, 210
    TW, TH = 130, 182
    SLOT_Y = 1752
    SLOT_X = [165 + 150 * i for i in range(6)]
    T_CH, T_BEAM, T_IMP = 0.8, 1.15, 1.45                                              # Eraser Beam
    T_RAIN = 12.6
    T_ALLY = 15.4
    T_REV = 17.6
    # Token-Ereignisse: (Zeit, +1 = gelegt / -1 = verdunstet)
    TOK = [(2.0, 1), (2.3, 1), (2.6, 1), (6.6, -1), (13.8, 1), (16.6, 1), (16.9, 1), (20.4, -1)]
    CAPTIONS = [
        (0.2, 3.0, '*Victorica*, the Eternal Empress.'),
        (3.2, 7.6, 'Her spells break the rules of magic - and *drain the land of mana*.'),
        (7.8, 12.4, 'Every spell leaves behind gray, lifeless *Pollution*.'),
        (12.6, 17.4, 'She conquered with *Eraser Beam* and *Rain of Death*...'),
        (17.6, 22.2, '...and saved her loved ones with *Reincarnation*.'),
        (22.4, 25.7, 'Now the *Bretonnia Empire* must clean up...'),
    ]
    SND = {
        'charge': [('elem_dark', -8)],
        'beam':   [('orbital_laser', -5)],
        'hit':    [('heavy_impact', -4), ('damage', -7)],
        'place':  [('placement', -7), ('debuff', -11)],
        'evap':   [('status_remove', -8), ('pull_sparkle', -12)],
        'rain':   [('elem_dark', -7), ('poison', -9)],
        'revive': [('revive', -6), ('heal', -9), ('pull_sparkle', -9)],
        'drain':  [('pull_swell', -12)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self._cache = {}
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        self.token = ld('token').resize((self.TW, self.TH), Image.BOX)
        self.opp = ld('opp').resize((self.CW, self.CH), Image.BOX)
        self.ally = ld('ally').resize((self.CW, self.CH), Image.BOX)
        self.ally_dead = self._gray(self.ally)
        # Slots belegen: Ereignisse in Reihenfolge abarbeiten
        self.slot_events = []                                                          # (Zeit, Art, Slot)
        occ = [False] * 6
        for (t, d) in self.TOK:
            if d > 0:
                s = occ.index(False)
                occ[s] = True
            else:
                s = max(i for i, o in enumerate(occ) if o)
                occ[s] = False
            self.slot_events.append((t, d, s))
        self.FLASHES = (0.0,)
        self.SHOCKS = (0.0, self.T_IMP, self.T_RAIN + 0.3, self.T_REV)
        self.TENSION_SHAKES = [(0.0, 5), (self.T_IMP, 10), (self.T_RAIN + 0.3, 6), (self.T_REV, 6)] + [(t, 4) for (t, d) in self.TOK if d > 0]
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

    def _card_at(self, canvas, im, x, y):
        U = self.U
        canvas.paste(im, (int(round((x - im.width / 2) / U) * U), int(round((y - im.height / 2) / U) * U)), im)

    def _gray(self, im):
        a = np.asarray(im).astype(np.float32)
        lum = (a[..., :3] * np.array([0.3, 0.59, 0.11])).sum(axis=2, keepdims=True)
        a[..., :3] = lum * 0.55
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

    def n_tok(self, t):
        return sum(d for (tt, d) in self.TOK if t >= tt)

    def n_smooth(self, t):
        n = 0.0
        for (tt, d) in self.TOK:
            n += d * smooth((t - tt) / 1.0)
        return n

    def _sprite(self, g, rows, pal, cx, cy, sc=1, a=1.0):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == '.':
                    continue
                for qa in range(sc):
                    for qb in range(sc):
                        g.put(cx + (i - len(row) / 2.0) * sc + qa, cy + (j - len(rows) / 2.0) * sc + qb, pal[ch], a)

    # ───────── Kacheln (Gegner zerbirst) ─────────
    def _build_tiles(self):
        rng = np.random.default_rng(5)
        self.tiles = []
        w, h = self.opp.size
        step = 14
        for ty in range(0, h, step):
            for tx in range(0, w, step):
                cx, cy = tx + step / 2 - w / 2, ty + step / 2 - h / 2
                n = math.hypot(cx, cy) or 1.0
                sp = rng.uniform(160, 520)
                self.tiles.append(dict(img=self.opp.crop((tx, ty, tx + step, ty + step)), x=tx - w / 2, y=ty - h / 2, vx=cx / n * sp, vy=cy / n * sp * 0.8 - rng.uniform(100, 360), life=rng.uniform(0.7, 1.1)))

    # ───────── Hintergrund: Mana-Strudel, graue Flecken ─────────
    def draw_behind(self, canvas, f):
        t = f / float(self.fps)
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        g = gamefx.R1(m)
        hx, hy = self._ci(self.HERO[0], self.HERO[1])
        # Mana wird aus der Umgebung gesogen: bunte Funken fliegen beim Zauber zu Victorica, dahinter bleibt grauer Staub
        for (a, b) in [(0.4, 1.4), (12.0, 13.0), (16.0, 17.2)]:
            if not (a <= t < b + 0.8):
                continue
            for k in range(46):
                dl = 0.4 * gamefx.H(int(a * 10), k)
                u = (t - a - dl) / 0.8
                if not (0 <= u < 1):
                    continue
                ang = gamefx.H(int(a * 10) + 1, k) * 6.283
                r0 = 24 + 34 * gamefx.H(int(a * 10) + 2, k)
                e = u * u
                px_, py_ = hx + math.cos(ang) * r0 * (1 - e), hy + math.sin(ang) * r0 * 1.3 * (1 - e)
                col = [(255, 150, 210), (130, 220, 255), (255, 230, 120), (190, 160, 255)][k % 4]
                g.put(px_, py_, col, 1.0); g.put(px_ + 1, py_, col, 0.8)
        # graue Staubflecken, je Token mehr
        amt = self.n_smooth(t)
        for k in range(int(10 * max(0.0, amt) + 0.5)):
            x = 20 + (k * 389) % 1040
            y = 200 + (k * 613) % 1500
            sx, sy = self._ci(x + 8 * math.sin(t * 0.7 + k), y + 6 * math.cos(t * 0.5 + k))
            col = (92, 92, 104) if k % 2 else (70, 70, 84)
            g.put(sx, sy, col, 0.9); g.put(sx + 1, sy, col, 0.7); g.put(sx, sy + 1, col, 0.7)

    # ───────── Eraser Beam ─────────
    def _eraser(self, canvas, m, t):
        g = gamefx.R1(m)
        A = self._ci(self.HERO[0], self.HAND_Y)
        B = self._ci(*self.OPP)
        ang = math.atan2(B[1] - A[1], B[0] - A[0])
        L = math.hypot(B[0] - A[0], B[1] - A[1])
        nx, ny = -math.sin(ang), math.cos(ang)
        # Ladekugel
        tc = t - self.T_CH
        if 0 <= tc < 0.5:
            u = tc / 0.5
            sc = 0.3 + 1.1 * smooth(u / 0.35) if u < 0.35 else (1.4 - 0.2 * (u - 0.35) / 0.35 if u < 0.7 else 1.2 - 0.3 * (u - 0.7) / 0.3)
            a = min(1.0, u / 0.35) if u < 0.7 else 1 - (u - 0.7) / 0.3
            r = 5 * sc
            g.disc(A[0], A[1], r + 3, RED_DD, a * 0.5)
            g.disc(A[0], A[1], r + 1, RED_D, a * 0.8)
            g.disc(A[0], A[1], r, RED, a)
            g.disc(A[0], A[1], r * 0.45, PALE, a)
        tb = t - self.T_BEAM
        if 0 <= tb < 1.0:
            u = tb / 1.0
            core_a = u / 0.25 if u < 0.25 else (1.0 if u < 0.75 else 1 - (u - 0.75) / 0.25)
            out_a = (u / 0.3 * 0.9) if u < 0.3 else (0.9 - 0.2 * (u - 0.3) / 0.4 if u < 0.7 else 0.7 * (1 - (u - 0.7) / 0.3))
            n = int(L)
            for i in range(n):
                x = A[0] + math.cos(ang) * i
                y = A[1] + math.sin(ang) * i
                for o in range(-5, 6):                                                 # äußerer Schein (breit, gedithert)
                    g.put(x + nx * o, y + ny * o, RED_D if abs(o) > 2 else RED, max(0.0, out_a) * 0.35)
                for o in range(-1, 2):                                                 # Kern
                    g.put(x + nx * o, y + ny * o, PALE if o == 0 else RED, max(0.0, core_a))
            # Blitzbögen entlang des Strahls (flackern im 30-Hz-Takt)
            fr = int(t * 30)
            for k in range(5):
                px = A[0]; py = A[1]
                seg = 14
                for s in range(1, seg + 1):
                    f1 = s / seg
                    off = (gamefx.H(fr * 7 + k, s) - 0.5) * 9 * math.sin(math.pi * f1)
                    qx = A[0] + math.cos(ang) * L * f1 + nx * off
                    qy = A[1] + math.sin(ang) * L * f1 + ny * off
                    g.line(px, py, qx, qy, PALE if k % 2 else RED, max(0.0, core_a) * 0.9)
                    px, py = qx, qy
        # Einschlag: dunkelroter Riss und Glut
        ti = t - self.T_IMP
        if 0 <= ti < 1.2:
            u = ti / 1.2
            sc = 0.2 + 1.6 * smooth(u / 0.35) if u < 0.35 else 1.8 + 1.2 * (u - 0.35) / 0.65
            a = (u / 0.35) if u < 0.35 else 1 - (u - 0.35) / 0.65
            r = 4.2 * sc
            g.disc(B[0], B[1], r, RED_DD, max(0.0, a) * 0.7)
            g.disc(B[0], B[1], r * 0.65, RED_D, max(0.0, a) * 0.8)
            g.disc(B[0], B[1], r * 0.3, PALE, max(0.0, a))
            for k in range(22):
                an = gamefx.H(11, k) * 6.283
                d = (6 + 20 * gamefx.H(12, k)) * smooth(u)
                g.put(B[0] + math.cos(an) * d, B[1] + math.sin(an) * d, (255, 130, 60) if k % 3 else PALE, max(0.0, 1 - u))
            for k in range(8):                                                         # Rauch
                g.disc(B[0] + (gamefx.H(13, k) - 0.5) * 12, B[1] - u * 14 - k, 2 + k % 3, (60, 60, 70), 0.35 * (1 - u))

    # ───────── Pollution Place / Verdunstung ─────────
    def _place_fx(self, m, tau, x, y, key):
        if tau < 0 or tau > 1.2:
            return
        g = gamefx.R1(m)
        cx, cy = self._ci(x, y)
        w, h = self.TW / self.gp, self.TH / self.gp
        u = tau / 1.1
        o = (u / 0.4) if u < 0.4 else (1.0 - 0.15 * (u - 0.4) / 0.4 if u < 0.8 else 0.85 * (1 - (u - 0.8) / 0.2))
        sc = 0.4 + 0.65 * smooth(u / 0.4) if u < 0.4 else 1.05
        W, Hh = w * sc, h * sc
        for j in range(-int(Hh / 2) - 1, int(Hh / 2) + 2):
            for i in range(-int(W / 2) - 1, int(W / 2) + 2):
                d = max(abs(i) / max(0.5, W / 2), abs(j) / max(0.5, Hh / 2))
                if d <= 1.2:
                    g.put(cx + i, cy + j, LILA_D if d > 0.8 else LILA_DD, max(0.0, o) * (0.85 - d * 0.3))
        ru = (tau - 0.1) / 0.7                                                         # Siegel
        if 0 <= ru <= 1:
            r = 3 + 6 * ru
            g.ring(cx, cy, max(0, r - 1), r, LAV, (1 - ru))
        for k in range(10):                                                            # Tropfen
            du = (tau - 0.05 * k) / 0.8
            if 0 <= du < 1:
                an = gamefx.H(key, k) * 6.283
                d = (3 + 7 * gamefx.H(key + 1, k)) * (1 - (1 - du) ** 2)
                g.disc(cx + math.cos(an) * d, cy + math.sin(an) * d + 1.5 * du, 1 + (k % 2), LILA_D, 1 - du)
        for k in range(12):
            du = (tau - 0.03 * k) / 0.7
            if 0 <= du < 1:
                an = gamefx.H(key + 2, k) * 6.283
                d = (3 + 8 * gamefx.H(key + 3, k)) * (1 - (1 - du) ** 2)
                g.put(cx + math.cos(an) * d, cy + math.sin(an) * d - du * 2, [LAV, LILA, LILA_DD][k % 3], 1 - du)

    def _evap_fx(self, m, tau, x, y, key):
        if tau < 0 or tau > 1.0:
            return
        g = gamefx.R1(m)
        cx, cy = self._ci(x, y)
        w, h = self.TW / self.gp, self.TH / self.gp
        u = tau / 0.85
        if u <= 1:
            sk = 1 - 0.6 * u
            op = 0.9 - 0.3 * u if u < 0.4 else 0.6 * (1 - (u - 0.4) / 0.6)
            for j in range(-int(h * sk / 2) - 1, int(h * sk / 2) + 2):
                for i in range(-int(w * sk / 2) - 1, int(w * sk / 2) + 2):
                    d = max(abs(i) / max(0.5, w * sk / 2), abs(j) / max(0.5, h * sk / 2))
                    if d <= 1:
                        g.put(cx + i, cy + j, LILA_D if d > 0.6 else LILA_DD, max(0.0, op))
        for k in range(8):                                                             # Dunstflecken steigen auf
            du = (tau - 0.03 * k) / 0.8
            if 0 <= du < 1:
                px = cx + (gamefx.H(key, k) - 0.5) * w * 0.8
                py = cy - du * 12 - k
                g.disc(px, py, 1.5 + 2.5 * du, LAV if k % 2 else LILA, 0.7 * (1 - du))
        for k in range(10):
            du = (tau - 0.02 * k) / 0.7
            if 0 <= du < 1:
                an = -math.pi / 2 + (gamefx.H(key + 5, k) - 0.5) * 1.6
                d = (4 + 10 * gamefx.H(key + 6, k)) * du
                g.put(cx + math.cos(an) * d, cy + math.sin(an) * d, PALE if k % 3 == 0 else LAV, 1 - du)

    # ───────── Rain of Death ─────────
    def _rain(self, m, tau, canvas):
        if tau < 0 or tau > 1.5:
            return
        g = gamefx.R1(m)
        cx, cy = self._ci(540, 900)
        u = (tau - 0.1) / 1.2
        if 0 <= u <= 1:                                                                # dunkelroter Nebel
            sk = 0.5 + 0.8 * smooth(u / 0.3) if u < 0.3 else 1.1 + 0.4 * (u - 0.3) / 0.7
            op = u / 0.3 if u < 0.3 else (1 - 0.15 * (u - 0.3) / 0.4 if u < 0.7 else 0.85 * (1 - (u - 0.7) / 0.3))
            R = 34 * sk
            for j in range(-int(R * 0.8), int(R * 0.8) + 1):
                for i in range(-int(R), int(R) + 1):
                    d = math.hypot(i / R, j / (R * 0.8))
                    if d <= 1:
                        g.put(cx + i, cy + j, (120, 0, 0) if d < 0.5 else RED_DD, max(0.0, op) * (0.55 - 0.45 * d))
        for k in range(90):
            dl = 0.9 * gamefx.H(21, k)
            du = (tau - dl) / (0.55 + 0.4 * gamefx.H(22, k))
            if 0 <= du <= 1:
                x = 150 + 780 * gamefx.H(23, k)
                y = 150 + 1350 * (du * du)
                sx, sy = self._ci(x, y)
                kind = k % 3
                op = 1.0 if du < 0.8 else 1 - (du - 0.8) / 0.2
                if kind == 0:
                    self._sprite(g, SKULL, SKCOL, sx, sy, 2, op)
                elif kind == 1:
                    self._sprite(g, DROP, SKCOL, sx, sy, 2, op)
                else:
                    g.put(sx, sy, (190, 14, 14), op); g.put(sx + 1, sy, (190, 14, 14), op)
        if tau > 0.9:
            for k in range(30):                                                       # Spritzer am Boden
                x = 150 + 780 * gamefx.H(31, k)
                sx, sy = self._ci(x, 1500 + 20 * gamefx.H(32, k))
                du = (tau - 0.9 - 0.02 * k) / 0.5
                if 0 <= du < 1:
                    g.disc(sx, sy - du * 3, 1, (190, 14, 14), 1 - du)

    # ───────── Reincarnation (Angel Revival) ─────────
    def _angel(self, g, cx, cy, n, a):
        r = max(1.5, n * 0.27)
        for sgn in (-1, 1):
            g.disc(cx + sgn * r * 1.55, cy + 0.2, r * 0.95, (179, 232, 249), a)
            g.disc(cx + sgn * r * 1.55, cy, r * 0.6, (255, 255, 255), a)
        g.ring(cx, cy - r * 1.3, r * 0.6, r * 0.95, (250, 213, 74), a)
        g.disc(cx, cy, r + 0.5, (249, 172, 32), a)
        g.disc(cx, cy, r - 0.1, (255, 228, 105), a)
        if r >= 2:
            g.put(cx - r * 0.4, cy - 0.2, (110, 68, 33), a); g.put(cx + r * 0.4, cy - 0.2, (110, 68, 33), a)

    def _revival(self, m, tau, x, y):
        if tau < 0 or tau > 1.6:
            return
        g = gamefx.R1(m)
        cx, cy = self._ci(x, y)
        for (st, du, R) in [(0.25, 0.9, 12.0), (0.25, 0.7, 7.0)]:
            k = (tau - st) / du
            if 0 <= k <= 1:
                sc = 0.3 + 1.7 * (1 - (1 - k) ** 2)
                a = 1 - 0.3 * k * 2 if k < 0.5 else 0.7 * (1 - (k - 0.5) / 0.5)
                r = R * sc
                for j in range(-int(r), int(r) + 1):
                    for i in range(-int(r), int(r) + 1):
                        d = math.hypot(i, j) / r
                        if d <= 1:
                            g.put(cx + i, cy + j, (255, 251, 210) if d < 0.4 else (250, 213, 74) if d < 0.75 else (249, 236, 179), max(0.0, a) * (1.0 - d) * 1.2)
        for k in range(12):
            dl = 0.1 + 0.5 * gamefx.H(41, k)
            u = (tau - dl) / (0.7 + 0.5 * gamefx.H(42, k))
            if 0 <= u <= 1:
                px = cx + (gamefx.H(43, k) - 0.5) * 22
                py = cy - u * (8 + 14 * gamefx.H(44, k))
                self._angel(g, px, py, 4 + 5 * gamefx.H(45, k), min(1.0, u * 4) * (1 - max(0.0, (u - 0.7) / 0.3)))
        for k in range(20):
            dl = 0.2 + 0.6 * gamefx.H(46, k)
            u = (tau - dl) / (0.5 + 0.5 * gamefx.H(47, k))
            if 0 <= u <= 1:
                an = gamefx.H(48, k) * 6.283
                d = (6 + 14 * gamefx.H(49, k)) * u
                g.put(cx + math.cos(an) * d, cy + math.sin(an) * d - u * 6, (255, 255, 255) if k % 2 else (255, 228, 105), 1 - u)

    # ───────── Bühne ─────────
    def _draw_stage(self, canvas, d, t):
        gp, U = self.gp, self.U
        m = gamefx.Cells(canvas, self.ox, self.oy, gp)
        # Gegner (Baaliel): wird vom Eraser Beam besiegt
        if t < self.T_IMP + 0.1:
            self._card_at(canvas, self.opp, *self.OPP)
            self.draw_text(canvas, 'OPPONENT', 3, (self.OPP[0], self.OPP[1] - 124), color=(255, 140, 140), outline=None, shadow=(20, 10, 30))
        else:
            tau = t - (self.T_IMP + 0.1)
            for p in self.tiles:
                if tau >= p['life']:
                    continue
                if tau > p['life'] * 0.7 and (int(t * 30) & 1):
                    continue
                x = self.OPP[0] + p['x'] + p['vx'] * tau
                y = self.OPP[1] + p['y'] + p['vy'] * tau + 0.5 * 1100 * tau * tau
                canvas.paste(p['img'], (int(round(x / U) * U), int(round(y / U) * U)), p['img'])
            if 0.1 < tau < 1.8 and int(t * 6) % 2 == 0:
                self.draw_text(canvas, 'DEFEATED', 3, (self.OPP[0], self.OPP[1] - 124), color=(255, 120, 150), outline=None, shadow=(20, 10, 30))
        self._eraser(canvas, m, t)
        # Token-Slots
        for i, x in enumerate(self.SLOT_X):
            x0, y0 = x - self.TW / 2, self.SLOT_Y - self.TH / 2
            for q in range(0, self.TW, 26):
                self.pix_rect(d, x0 + q, y0, x0 + q + 11, y0 + 3, (110, 100, 130)); self.pix_rect(d, x0 + q, y0 + self.TH - 4, x0 + q + 11, y0 + self.TH - 1, (110, 100, 130))
            for q in range(0, self.TH, 26):
                self.pix_rect(d, x0, y0 + q, x0 + 3, y0 + q + 11, (110, 100, 130)); self.pix_rect(d, x0 + self.TW - 4, y0 + q, x0 + self.TW - 1, y0 + q + 11, (110, 100, 130))
        occ = {}
        for (te, dd, s) in self.slot_events:
            if t >= te:
                occ[s] = (dd > 0, te)
        for (te, dd, s) in self.slot_events:
            if dd > 0:
                tau = t - te
                self._place_fx(m, tau, self.SLOT_X[s], self.SLOT_Y, 60 + s)
            else:
                tau = t - te
                self._evap_fx(m, tau, self.SLOT_X[s], self.SLOT_Y, 80 + s)
        for s in range(6):
            if s in occ and occ[s][0]:
                te = occ[s][1]
                im = self.token
                if t < te + 0.5:
                    im = self._dissolve(self.token, 1.0 - (t - te) / 0.5, ('tk', s, int((t - te) * 16)))
                self._card_at(canvas, im, self.SLOT_X[s], self.SLOT_Y)
            elif s in occ and not occ[s][0]:
                te = occ[s][1]
                if t < te + 0.6:
                    self._card_at(canvas, self._dissolve(self.token, (t - te) / 0.6, ('tkx', s, int((t - te) * 16))), self.SLOT_X[s], self.SLOT_Y)
        self.draw_text(canvas, 'SUPPORT ZONES', 2, (540, 1620), color=(190, 180, 210), outline=None, shadow=(20, 10, 30))
        # Rain of Death
        self._rain(m, t - self.T_RAIN, canvas)
        if self.T_RAIN + 1.0 <= t < self.T_RAIN + 2.6 and int(t * 6) % 2 == 0:
            self.draw_text(canvas, 'ABILITIES DELETED', 4, (540, 1010), color=(255, 120, 130), outline=(40, 0, 0), shadow=None)
        # Verbündete: besiegt, dann Reincarnation
        if t >= self.T_ALLY:
            u = min(1.0, (t - self.T_ALLY) / 0.6)
            if t < self.T_REV:
                im = self._dissolve(self.ally_dead, 1.0 - u, ('ad', int(u * 16))) if u < 1 else self.ally_dead
                self._card_at(canvas, im, *self.ALLY)
                if int(t * 4) % 2 == 0:
                    self.draw_text(canvas, 'DEFEATED', 3, (self.ALLY[0], self.ALLY[1] - 124), color=(190, 190, 200), outline=None, shadow=(20, 10, 30))
            else:
                self._card_at(canvas, self.ally, *self.ALLY)
                self.draw_text(canvas, 'REVIVED', 3, (self.ALLY[0], self.ALLY[1] - 124), color=GOLD_HL, outline=None, shadow=(60, 30, 0))
        self._revival(m, t - self.T_REV, *self.ALLY)

    # ───────── Zähler ─────────
    def _draw_hud(self, canvas, d, t):
        n = self.n_tok(t)
        hot = any(0 <= t - te < 0.45 and int(t * 15) % 2 == 0 for (te, dd) in self.TOK)
        self.draw_text(canvas, 'POLLUTION', 4, (170, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(n), 9, (125, 140), color=(255, 255, 255) if hot else (190, 190, 210), outline=None, shadow=(30, 30, 50))
        self.draw_text(canvas, 'MAX HAND', 4, (900, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(max(1, 7 - n)), 9, (950, 140), color=GOLD if n == 0 else (255, 150, 150), outline=None, shadow=(60, 30, 0))

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
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
        """Die Welt ergraut mit jedem Token: Entsättigung, zum Rand hin stärker, die Karte in der Mitte hält sich länger."""
        t = f / float(self.fps)
        fl = 0.0
        for tg in self.FLASHES:
            if 0 <= t - tg < 0.25:
                fl = max(fl, 0.4 * math.exp(-(t - tg) / 0.08))
        for ti in (self.T_IMP, self.T_REV):
            if 0 <= t - ti < 0.2:
                fl = max(fl, 0.25 * math.exp(-(t - ti) / 0.06))
        amt = min(0.85, 0.16 * max(0.0, self.n_smooth(t)))
        if fl <= 0 and amt <= 0.01:
            return img
        arr = np.asarray(img).astype(np.float32)
        if amt > 0.01:
            h, w = arr.shape[:2]
            if 'gw' not in self._cache:
                yy, xx = np.mgrid[0:h, 0:w]
                r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - 900) / 900.0) ** 2)
                self._cache['gw'] = (0.45 + 0.55 * np.clip(r, 0, 1))[..., None].astype(np.float32)
            wgt = np.clip(amt * self._cache['gw'] * 1.15, 0, 1)
            lum = (arr * np.array([0.3, 0.59, 0.11], np.float32)).sum(axis=2, keepdims=True)
            arr = arr * (1 - wgt) + (lum * 0.9) * wgt
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

    # ───────── Soundeffekte ─────────
    def sfx_events(self):
        D = self.D
        ev = []

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t, item[0], item[1]) + tuple(item[2:]))
        add(self.T_CH, 'charge'); add(self.T_BEAM, 'beam'); add(self.T_IMP, 'hit')
        for (te, dd, s) in self.slot_events:
            add(te, 'place' if dd > 0 else 'evap')
        add(self.T_RAIN, 'rain'); add(self.T_REV, 'revive')
        for a in (0.4, 12.0, 16.0):
            add(a, 'drain')
        return sorted(ev)
