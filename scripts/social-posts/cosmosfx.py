"""Kosmos-Show für „Argos, the Eye of the Cosmos“: das Auge beobachtet die Hand des Gegners und sammelt Change Counter – und gibt sie aus, um
„Cosmic Depths“-Kreaturen als Support Pieces zu beschwören. Spannungsbogen (jede Runde 3,6 s, passend zu den 2,4-s-Phrasen des Themes):

   0.0 –  1.3  HOOK      acht Change Counter schießen aus dem Auge, kreisen und stürzen zurück, Druckwelle
   1.3 –  2.4  AUFBAU    die vier Support-Zonen unten werden sichtbar (verdeckte Karten), links steht die Gegnerhand, rechts der Zähler
  2.4 – 16.8  RUNDEN 1–4 je Runde:  Gegnerzug  – die Gegnerhand füllt sich, für JEDE Handkarte wandert ein Change Counter ins Auge („+n“)
                                    Gegnerin spielt Karten – die Hand wird kleiner
                                    Argos’ Zug – so viele Counter verschwinden, wie der Gegner noch Handkarten hat
                                    Argos gibt X Counter aus – eine „Cosmic Depths“-Kreatur der Stufe X wird in eine Support-Zone beschworen:
                                    Analyzer (1), Gatherer (2), Life-Searcher (3), Invader (4)
  16.8 – 19.0  FINALE    der Invader bringt zwei Invader Token, die an den Rändern einschlagen, und schlägt mit 4 × 80 = 320 zu
  19.0 –   D   ABGANG    Karten, Counter und Token lösen sich auf, das Auge lädt neu → nahtlos in den Hook

Die Support Pieces sind die echten Karten (Kartenrenderer des Spiels); Counter, Zähler-Abzeichen und die Blitz-/Funkenanimation folgen dem Spiel
(`cosmic_counter_add` / `cosmic_counter_remove`, Abzeichen mit 🌌 und „×n“, Palette Lila).
Alle Methoden entsprechen der API von icefx.IceShow / rootfx.RootShow / rockfx.ConcertShow."""
import json
import math

import numpy as np
from PIL import Image, ImageDraw


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


P_DK, P_MID, P_HL, P_WH = (64, 26, 102), (112, 45, 179), (184, 102, 255), (241, 229, 250)
SPARK = (214, 187, 241)
ORB = ["...ooo...",
       "..oOOOo..",
       ".oOHHHOo.",
       "oOHHWHHOo",
       "oOHWWWHOo",
       "oOHHWHHOo",
       ".oOHHHOo.",
       "..oOOOo..",
       "...ooo..."]
ORB_COL = {'o': P_DK, 'O': P_MID, 'H': P_HL, 'W': P_WH}


class CosmosShow:
    T0, TR = 2.4, 3.6                                                                   # Beginn der ersten Runde, Dauer einer Runde
    # (Karten in der Gegnerhand zu Beginn ihres Zuges, davon gespielt, ausgegebene Counter = Stufe der Kreatur)
    ROUNDS = [(5, 4, 1), (4, 2, 2), (5, 4, 3), (3, 1, 4)]
    CARDS = ['analyzer-from-the-cosmic-depths', 'gatherer-from-the-cosmic-depths', 'life-searcher-from-the-cosmic-depths', 'invader-from-the-cosmic-depths']
    T_FIN = 16.8
    CW, CH = 180, 252                                                                   # Support Pieces unten
    HAND_W, HAND_H = 98, 133                                                            # Gegnerhand oben
    SLOT_Y = 1762

    def __init__(self, W, H, U, fps, loop, geom, D, seed=2):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self.eye = geom['eye']
        base = geom['assets_dir']
        self.rng = np.random.default_rng(seed)
        yy, xx = np.mgrid[0:H, 0:W]
        rr = np.hypot((xx - W / 2) / (W * 0.62), (yy - H * 0.5) / (H * 0.55))
        self.vig = np.clip((rr - 0.45) / 0.8, 0, 1).astype(np.float32) ** 1.3
        self._cache = {}
        self.cards = [Image.open('%s/%s.png' % (base, n)).convert('RGBA').resize((self.CW, self.CH), Image.BOX) for n in self.CARDS]
        self.token = Image.open('%s/invader-token.png' % base).convert('RGBA').resize((110, 154), Image.BOX)
        from PIL import ImageEnhance
        cb = Image.open(geom['cardback_path']).convert('RGB')
        self.back_big = cb.resize((self.CW, self.CH), Image.BOX).convert('RGBA')
        inner = cb.resize((self.HAND_W // U - 2, self.HAND_H // U - 3), Image.BOX)
        inner = ImageEnhance.Color(ImageEnhance.Contrast(inner).enhance(1.35)).enhance(1.5).convert('RGBA')
        c = Image.new('RGBA', (self.HAND_W // U, self.HAND_H // U), (255, 150, 40, 255))
        c.paste(inner, (1, 1))
        self.back_hand = c.transpose(Image.ROTATE_180).resize((self.HAND_W, self.HAND_H), Image.NEAREST)   # Gegnerhand liegt um 180° gedreht
        gl = json.load(open(geom['glyph_path'], encoding='utf-8'))['1F30C']                 # 🌌 aus der Pixel-Emoji-Schrift des Spiels
        self.glyph = (gl['pal'], gl['z'])
        self._build_timeline()
        self.SHOCKS = tuple([0.0] + [self.reveal_t(r) for r in range(4)] + [self.T_FIN, self.T_FIN + 1.0])
        self.TENSION_SHAKES = [(t, 8 if i == 0 else 10) for i, t in enumerate(self.SHOCKS)]
        self.T_GUST = 0.0
        self.hook = [dict(a=2 * math.pi * k / 8 + 0.2) for k in range(8)]

    # ───────── Raster ─────────
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

    # ───────── Zeitplan: Gegnerhand, Counter-Kugeln, Support-Zonen ─────────
    def slot_x(self, i):
        return 540 + (i - 1.5) * 208

    def hand_pos(self, i, n):
        return (540 + (i - (n - 1) / 2.0) * 96, 138)

    def reveal_t(self, r):
        return self.T0 + self.TR * r + 3.15

    def ring_pos(self, idx, t):
        cx, cy = self.eye
        a = 2 * math.pi * idx / 8 + 0.45 * t
        return (cx + 380 * math.cos(a), cy + 300 * math.sin(a))

    def _build_timeline(self):
        self.hand = []                                                                  # Karten der Gegnerhand: dict(i0, t_in, t_out, slot_hist)
        self.orbs = []                                                                  # Counter-Kugeln
        self.hand_events = []                                                           # (Zeit, neue Handgröße)
        stack = []                                                                      # Ring-Indizes der vorhandenen Kugeln (von unten nach oben)
        self.counter_events = []                                                        # (Zeit, Änderung)
        self.labels = []                                                                # (von, bis, Text, Farbe)
        hand_n = 0
        for r, (n0, plays, X) in enumerate(self.ROUNDS):
            T = self.T0 + self.TR * r
            self.labels.append((T, T + 1.85, 'OPP TURN', (255, 120, 190)))
            self.labels.append((T + 1.85, T + self.TR, 'ARGOS TURN', P_HL))
            draws = n0 - hand_n
            for k in range(draws):
                self.hand_events.append((T + 0.12 * k, hand_n + k + 1))
            hand_n = n0
            for j in range(n0):                                                         # + eine Kugel je Handkarte
                t_a = T + 0.55 + 0.08 * j
                orb = dict(src=('hand', j, n0), t_in0=t_a, t_in1=t_a + 0.4, idx=len(stack), t_out0=None, kind=None, dst=None)
                stack.append(orb['idx'])
                self.orbs.append(orb)
                self.counter_events.append((t_a + 0.4, +1))
            for p in range(plays):                                                       # Gegner spielt Karten
                t_p = T + 1.3 + 0.12 * p
                self.hand_events.append((t_p, hand_n - 1))
                self.hand.append(dict(r=r, p=p, idx=hand_n - 1, t=t_p, n_before=hand_n, n0=n0))
                hand_n -= 1
            live = [o for o in self.orbs if o['t_out0'] is None]
            for q in range(hand_n):                                                      # Argos’ Zug: so viele Counter verschwinden, wie der Gegner Handkarten hat
                o = live.pop()
                o['t_out0'], o['kind'] = T + 2.0 + 0.08 * q, 'remove'
                o['t_out1'] = o['t_out0'] + 0.5
                self.counter_events.append((o['t_out0'], -1))
            for q in range(X):                                                           # Argos gibt X Counter aus
                o = live.pop()
                o['t_out0'], o['kind'] = T + 2.65 + 0.1 * q, 'spend'
                o['t_out1'] = o['t_out0'] + 0.5
                o['dst'] = (self.slot_x(r), self.SLOT_Y)
                self.counter_events.append((o['t_out0'], -1))
            stack = [o['idx'] for o in live]
        for o in self.orbs:                                                              # Finale/Abgang: übrig gebliebene Kugeln lösen sich auf
            if o['t_out0'] is None:
                o['t_out0'], o['kind'] = self.T_FIN + 2.0, 'remove'
                o['t_out1'] = o['t_out0'] + 0.5
                self.counter_events.append((o['t_out0'], -1))
        self.counter_events.sort()
        self.hand_events.sort()

    def counters(self, t):
        return sum(d for tt, d in self.counter_events if t >= tt)

    def hand_count(self, t):
        n = 0
        for tt, v in self.hand_events:
            if t >= tt:
                n = v
        if t >= self.T_FIN + 1.6:
            n = 0
        return n

    # ───────── Zeichnen: Hilfen ─────────
    def _orb(self, d, x, y, scale=1.0):
        ci, cj = self.cell(x - 4.5 * self.gp, y - 4.5 * self.gp)
        for j, row in enumerate(ORB):
            for i, ch in enumerate(row):
                if ch != '.':
                    self.rect(d, ci + i, cj + j, ORB_COL[ch])

    def _flash_add(self, d, x, y, tau):
        """`cosmic_counter_add`: lila Blitz und zehn Funken."""
        if not (0 <= tau < 0.6):
            return
        r = 5 * ease_out(tau / 0.3)
        if tau < 0.35:
            for k in range(16):
                a = 2 * math.pi * k / 16
                ci, cj = self.cell(x + math.cos(a) * r * self.gp, y + math.sin(a) * r * self.gp)
                self.rect(d, ci, cj, P_WH if tau < 0.15 else P_HL)
        for k in range(10):
            a = 2 * math.pi * k / 10
            u = ease_out(tau / 0.55)
            if tau > 0.4 and int(tau * 30 + k) % 2:
                continue
            ci, cj = self.cell(x + math.cos(a) * 62 * u, y + math.sin(a) * 62 * u)
            self.rect(d, ci, cj, SPARK)

    def _flash_remove(self, d, x, y, tau):
        """`cosmic_counter_remove`: Funken laufen nach innen, kleine Implosion."""
        if not (0 <= tau < 0.55):
            return
        for k in range(10):
            a = 2 * math.pi * k / 10
            u = 1 - ease_out(tau / 0.45)
            ci, cj = self.cell(x + math.cos(a) * 62 * u, y + math.sin(a) * 62 * u)
            self.rect(d, ci, cj, P_MID)
        if 0.4 <= tau < 0.55:
            ci, cj = self.cell(x, y)
            for (a, b) in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                self.rect(d, ci + a, cj + b, P_WH)

    def _blit(self, canvas, im, x, y):
        canvas.paste(im, (int(round(x - im.width / 2)), int(round(y - im.height / 2))), im)

    def _dissolve(self, im, p, seed=0):
        """Pixel-Auflösung (7-px-Raster): p = 1 → ganz da, 0 → weg."""
        key = ('dis', id(im), int(p * 12), seed)
        if key not in self._cache:
            w, h = im.size
            nz = np.random.default_rng(seed).random((-(-h // self.U), -(-w // self.U)))
            m = np.repeat(np.repeat(((nz < p) * 255).astype(np.uint8), self.U, axis=0), self.U, axis=1)[:h, :w]
            a = (np.asarray(im.split()[3]).astype(np.uint16) * m // 255).astype(np.uint8)
            out = im.copy()
            out.putalpha(Image.fromarray(a, 'L'))
            self._cache[key] = out
        return self._cache[key]

    # ───────── Interface ─────────
    def draw_behind(self, canvas, f):
        pass

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

    def _draw_hud(self, canvas, d, t):
        n = self.hand_count(t)
        self.draw_text(canvas, 'OPP HAND', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(n), 9, (125, 140), color=(255, 140, 200), outline=None, shadow=(60, 20, 50))
        for (a, b, txt, col) in self.labels:
            if a <= t < b:
                self.draw_text(canvas, txt, 3, (125, 206), color=col, outline=None, shadow=(20, 10, 30))
        c = self.counters(t)
        bx0, by0, bx1, by1 = 800, 92, 1030, 168                                          # Abzeichen wie am Helden im Spiel: Lila, helle Kante, 🌌 und „×n“
        self.pix_rect(d, bx0 - 4, by0 - 4, bx1 + 3, by1 + 3, (18, 16, 31))
        self.pix_rect(d, bx0, by0, bx1, by1, P_HL)
        self.pix_rect(d, bx0 + 4, by0 + 4, bx1 - 4, by1 - 4, P_MID)
        self.pix_rect(d, bx0 + 4, by0 + (by1 - by0) // 2, bx1 - 4, by1 - 4, P_DK)
        pal, z = self.glyph
        gx, gy = bx0 + 18, by0 + 14
        for j, row in enumerate(z):
            for i, ch in enumerate(row):
                if ch != '.':
                    self.pix_rect(d, gx + i * 3, gy + j * 3, gx + i * 3 + 2, gy + j * 3 + 2, tuple(int(pal[ch][k:k + 2], 16) for k in (1, 3, 5)))
        self.draw_text(canvas, 'x%d' % c, 6, (bx0 + 150, (by0 + by1) // 2), color=P_WH, outline=(18, 16, 31), shadow=None)

    def _draw_hand(self, canvas, t):
        n = self.hand_count(t)
        U = self.U
        for i in range(n):
            x, y = self.hand_pos(i, n)
            born = None
            for tt, v in self.hand_events:
                if v == i + 1 and tt <= t:
                    born = tt
            drop = 0
            if born is not None and t - born < 0.2:
                drop = -60 * (1 - (t - born) / 0.2)
            canvas.paste(self.back_hand, (int(round((x - self.HAND_W / 2) / U) * U), int(round((y + drop - self.HAND_H / 2) / U) * U)), self.back_hand)
        for h in self.hand:                                                              # gespielte Karten fliegen aufs Brett und lösen sich auf
            tau = t - h['t']
            if 0 <= tau < 0.7:
                x0, y0 = self.hand_pos(h['idx'], h['n_before'])
                u = ease_out(tau / 0.5)
                x, y = x0 + (540 - x0) * u * 0.5, y0 + (620 - y0) * u
                im = self._dissolve(self.back_hand, 1.0 - max(0.0, (tau - 0.35) / 0.35), seed=h['r'] * 7 + h['p'])
                canvas.paste(im, (int(round((x - self.HAND_W / 2) / U) * U), int(round((y - self.HAND_H / 2) / U) * U)), im)

    def _draw_slots(self, canvas, d, t):
        # Support-Zonen: Rahmen ab 1,3 s; verdeckte Karte, solange die Beschwörung läuft; danach die echte Karte
        fade = smooth((t - 1.3) / 0.8)
        gone = smooth((t - (self.T_FIN + 2.0)) / 0.8)
        if fade <= 0:
            return
        for i in range(4):
            x = self.slot_x(i)
            x0, y0 = x - self.CW / 2, self.SLOT_Y - self.CH / 2
            col = P_HL if int(t * 3) % 2 else P_MID
            for k in range(0, self.CW + 8, 14):                                          # gestrichelter Rahmen
                if int(k / 14 + i) % 2 == 0:
                    self.pix_rect(d, x0 - 6 + k, y0 - 6, x0 - 6 + k + 6, y0 - 1, col)
                    self.pix_rect(d, x0 - 6 + k, y0 + self.CH + 1, x0 - 6 + k + 6, y0 + self.CH + 6, col)
            for k in range(0, self.CH + 8, 14):
                if int(k / 14 + i) % 2 == 0:
                    self.pix_rect(d, x0 - 6, y0 - 6 + k, x0 - 1, y0 - 6 + k + 6, col)
                    self.pix_rect(d, x0 + self.CW + 1, y0 - 6 + k, x0 + self.CW + 6, y0 - 6 + k + 6, col)
            self.draw_text(canvas, 'LV %d' % (i + 1), 3, (x, y0 - 24), color=P_HL if t < self.reveal_t(i) else P_WH, outline=None, shadow=(20, 10, 30))
            tr = self.reveal_t(i)
            ts = self.T0 + self.TR * i + 2.55
            if t < ts:
                continue
            im = self.cards[i] if t >= tr else self.back_big
            if gone > 0:
                im = self._dissolve(im, 1.0 - gone, seed=40 + i)
            elif t < tr and t - ts < 0.25:
                im = self._dissolve(im, (t - ts) / 0.25, seed=30 + i)
            bob = 0
            canvas.paste(im, (int(x0), int(y0 + bob)), im)
            if t >= tr and gone <= 0:                                                    # leuchtende Kante nach der Beschwörung
                tau = t - tr
                if tau < 0.5:
                    c2 = P_WH if tau < 0.12 else P_HL
                    self.pix_rect(d, x0 - 3, y0 - 3, x0 + self.CW + 2, y0 - 1, c2)
                    self.pix_rect(d, x0 - 3, y0 + self.CH, x0 + self.CW + 2, y0 + self.CH + 2, c2)
                    self.pix_rect(d, x0 - 3, y0, x0 - 1, y0 + self.CH, c2)
                    self.pix_rect(d, x0 + self.CW, y0, x0 + self.CW + 2, y0 + self.CH, c2)
        for i in range(4):                                                               # Funkenexplosion beim Aufdecken
            tau = t - self.reveal_t(i)
            if 0 <= tau < 0.6:
                x = self.slot_x(i)
                for k in range(14):
                    a = 2 * math.pi * k / 14
                    u = ease_out(tau / 0.5)
                    ci, cj = self.cell(x + math.cos(a) * 130 * u, self.SLOT_Y + math.sin(a) * 150 * u)
                    if tau > 0.4 and (k + int(t * 30)) % 2:
                        continue
                    self.rect(d, ci, cj, P_WH if k % 2 else P_HL)

    def _draw_tokens(self, canvas, d, t):
        for k, side in enumerate((-1, 1)):                                               # Invader Token schlagen an den Rändern ein
            t0 = self.T_FIN + 0.12 * k
            tau = t - t0
            if tau < 0:
                continue
            gone = smooth((t - (self.T_FIN + 2.0)) / 0.8)
            sx, sy = self.slot_x(3), self.SLOT_Y
            ex, ey = (100 if side < 0 else 980), 930
            u = ease_out(tau / 0.55)
            x = sx + (ex - sx) * u
            y = sy + (ey - sy) * u - 220 * math.sin(math.pi * min(1.0, u))
            im = self.token if gone <= 0 else self._dissolve(self.token, 1.0 - gone, seed=70 + k)
            self._blit(canvas, im, x, y)
            if 0.5 <= tau < 1.0:
                for kk in range(10):
                    a = 2 * math.pi * kk / 10
                    r = 40 * ease_out((tau - 0.5) / 0.4)
                    ci, cj = self.cell(ex + math.cos(a) * r, ey + math.sin(a) * r)
                    self.rect(d, ci, cj, P_WH if kk % 2 else P_HL)

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        W, H = self.W, self.H
        cx, cy = self.eye
        # Hook: acht Counter schießen aus dem Auge, kreisen und stürzen zurück
        if t < 1.3:
            if t < 0.45:
                u = ease_out(t / 0.45)
            elif t < 0.95:
                u = 1.0
            else:
                u = 1 - smooth((t - 0.95) / 0.35)
            for h in self.hook:
                a = h['a'] + 3.0 * t
                self._orb(d, cx + 380 * u * math.cos(a), cy + 300 * u * math.sin(a))
            if t < 0.6:
                r = 640 * ease_out(t / 0.6)
                for k in range(64):
                    a = 2 * math.pi * k / 64
                    ci, cj = self.cell(cx + math.cos(a) * r, cy + math.sin(a) * r * 0.8)
                    self.rect(d, ci, cj, P_WH if t < 0.3 else P_HL)
        self._draw_slots(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        # Counter-Kugeln um das Auge
        for o in self.orbs:
            if t < o['t_in0']:
                continue
            ring = lambda tt: self.ring_pos(o['idx'], tt)
            if t < o['t_in1']:                                                           # von der Handkarte ins Auge
                src = self.hand_pos(o['src'][1], o['src'][2])
                u = ease_out((t - o['t_in0']) / (o['t_in1'] - o['t_in0']))
                rp = ring(t)
                self._orb(d, src[0] + (rp[0] - src[0]) * u, src[1] + (rp[1] - src[1]) * u + 0)
            elif o['t_out0'] is None or t < o['t_out0']:
                x, y = ring(t)
                self._orb(d, x, y)
            elif o['kind'] == 'spend' and t < o['t_out1']:                               # zur Support-Zone
                u = ease_out((t - o['t_out0']) / (o['t_out1'] - o['t_out0']))
                rp = ring(o['t_out0'])
                x = rp[0] + (o['dst'][0] - rp[0]) * u
                y = rp[1] + (o['dst'][1] - rp[1]) * u - 160 * math.sin(math.pi * u)
                self._orb(d, x, y)
            if t >= o['t_in1'] - 0.0 and t - o['t_in1'] < 0.6:
                self._flash_add(d, *ring(o['t_in1']), t - o['t_in1'])
            if o['t_out0'] is not None and o['kind'] == 'remove':
                if t < o['t_out0'] + 0.5 and t >= o['t_out0'] - 0.1:
                    self._flash_remove(d, *ring(o['t_out0']), t - o['t_out0'])
        self._draw_tokens(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_hand(canvas, t)
        self._draw_hud(canvas, d, t)
        # Finale: Invader schlägt zu, 4 × 80
        tf = self.T_FIN + 1.0
        if tf <= t < tf + 1.2:
            tau = t - tf
            if tau < 0.5:
                for k in range(24):
                    a = 2 * math.pi * k / 24
                    r = 520 * ease_out(tau / 0.4)
                    ci, cj = self.cell(cx + math.cos(a) * r, cy + math.sin(a) * r * 0.9)
                    self.rect(d, ci, cj, P_WH if tau < 0.2 else P_HL)
            if int(t * 16) % 2 == 0 or tau < 0.5:
                self.draw_text(canvas, '320', 14, (W / 2, 560 - 100 * smooth(tau / 1.2)), color=(255, 248, 255), outline=(112, 45, 179), shadow=(40, 10, 70))

    # ───────── Bild-Nachbearbeitung ─────────
    def post_fx(self, img, f):
        t = f / float(self.fps)
        fl = 0.0
        for tg in self.SHOCKS:
            if 0 <= t - tg < 0.25:
                fl = max(fl, (0.4 if tg in (0.0, self.T_FIN) else 0.22) * math.exp(-(t - tg) / 0.08))
        k = min(1.0, self.counters(t) / 8.0) * 0.4
        if fl <= 0 and k <= 0:
            return img
        arr = np.asarray(img).astype(np.float32)
        if k > 0:
            m = (self.vig * k)[..., None]
            arr = arr * (1 - m) + np.array(P_MID, dtype=np.float32) * m
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
        'add':     [('ping', -8, 0.0, 1.2, 0.35), ('ping', -9, 0.07, 1.6, 0.35)],        # +1 Counter: zwei kurze, aufsteigende Töne wie im Spiel
        'remove':  [('ping', -11, 0.0, 0.8, 0.4)],
        'draw':    [('draw', -6)],
        'play':    [('placement', -9)],
        'spend':   [('ability_activate', -7)],
        'summon':  [('summon', -5), ('heavy_impact', -10, 0.05)],
        'turn':    [('turn_start', -9)],
        'token':   [('summon', -9)],
        'hit':     [('critical_strike', -6), ('damage', -6, 0.05)],
    }

    def sfx_events(self):
        D = self.D
        ev = []

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t + (item[2] if len(item) > 2 else 0.0), item[0], item[1]) + tuple(item[3:]))
        add(0.0, 'explode')
        for (a, b, txt, col) in self.labels:
            if txt == 'OPP TURN' or txt == 'ARGOS TURN':
                add(a, 'turn')
        for tt, v in self.hand_events:
            if v > 0 and not any(h['t'] == tt for h in self.hand):
                add(tt, 'draw')
        for h in self.hand:
            add(h['t'], 'play')
        for o in self.orbs:
            add(o['t_in1'], 'add')
            if o['kind'] == 'remove':
                add(o['t_out0'], 'remove')
        for r, (n0, plays, X) in enumerate(self.ROUNDS):
            add(self.T0 + self.TR * r + 2.65, 'spend')
            add(self.reveal_t(r), 'summon')
        add(self.T_FIN, 'token'); add(self.T_FIN + 0.12, 'token')
        add(self.T_FIN + 1.0, 'hit')
        ev.append((D - 1.0, 'ascension', -9, 1.2))
        return sorted(ev)
