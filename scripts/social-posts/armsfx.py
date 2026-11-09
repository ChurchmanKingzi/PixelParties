"""Toras-Show: der Meister aller Waffen. Jede Waffe mit anderem Namen gibt +40 Angriff (plus ihren eigenen Bonus); Toras trifft immer genau ein Ziel.
Vier Akte: Legendary Sword (Schwertwurf + Schnitt), Sacred Hammer (Hammerwurf + Aufprall), Heart-Shaped Bow (Pfeilsalve), Explosivo's Sword (Schwertwurf + Explosion).
Alle Angriffe sind Nachbauten der echten Spiel-Animationen (gamefx.py). Gleiche Schnittstelle wie WebShow."""
import math

import numpy as np
from PIL import Image, ImageDraw

import gamefx
from capfx import CaptionMixin, GOLD, GOLD_HL


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


CREME, INK = (255, 251, 210), (18, 16, 31)


class ArmsShow(CaptionMixin):
    T_ACT = [3.4, 7.3, 11.2, 15.1]
    CW, CH = 180, 252
    SLOT_X = [210, 430, 650, 870]
    SLOT_Y = 1752
    EN_X, EN_Y = 540, 140
    OW, OH = 176, 246
    # (Karte, Name im Video, Bonus der Waffe, Wurfform, Pose beim Wurf)
    WEAPONS = [('w-legendary', 'LEGENDARY SWORD', 10, 'schwert', 2), ('w-hammer', 'SACRED HAMMER', 30, 'hammer', 3),
               ('w-bow', 'HEART BOW', 10, 'pfeil', 4), ('w-explosivo', 'EXPLOSIVO', 10, 'schwert', 2)]
    ENEMIES = [('e-daiyo', 100), ('e-quetz', 200), ('e-hel', 250), ('e-solrym', 300)]
    ATK0 = 120
    THROW, FLIGHT = 1.45, 0.55                                                           # Wurf beginnt T + 1,45 s, Flugzeit 0,55 s (Landung bei 85 %)
    POSE_OVERHEAT = (0, 1)

    CAPTIONS = [
        (1.1, 3.3, 'Toras wields *every weapon* - and each *different* one makes him stronger!'),
        (3.4, 7.2, 'A *sword*! +40 Attack for the new Artifact, plus 10 from the blade!'),
        (7.3, 11.1, 'A *hammer*? +40 again - it has a *different name*!'),
        (11.2, 15.0, 'A *bow*, too! Toras can use *any weapon*.'),
        (15.1, 18.6, "And *Explosivo's Sword* to finish it. *340* damage - to just 1 target!"),
        (18.8, 21.3, '*Master of all Weapons* - the more different, the deadlier!'),
    ]
    SND = {
        'open':   [('heavy_impact', -3)],
        'whoosh': [('booster_card_whoosh', -8)],
        'place':  [('placement', -8)],
        'buff':   [('buff', -7)],
        'throw':  [('projectile', -8)],
        'slash':  [('slash', -4), ('damage', -7)],
        'smash':  [('heavy_impact', -3), ('damage', -6)],
        'arrow':  [('damage', -9)],
        'boom':   [('heavy_impact', -2), ('elem_fire', -6)],
        'ko':     [('hero_death', -8)],
        'enemy':  [('placement', -10)],
        'ping':   [('ping', -9)],
    }

    def __init__(self, W, H, U, fps, loop, geom, D, seed=8):
        self.W, self.H, self.U, self.fps, self.loop, self.D = W, H, U, fps, loop, D
        self.g = geom
        self.ox, self.oy, self.gp = geom['grid']
        self.draw_text = geom['draw_text']
        self.home = geom['home']
        self.actor_fn = geom['actor_fn']
        self._cache = {}
        base = geom['assets_dir']
        ld = lambda n: Image.open('%s/%s.png' % (base, n)).convert('RGBA')
        self.cards = [ld(w[0]).resize((self.CW, self.CH), Image.BOX) for w in self.WEAPONS]
        ow, oh = self.OW // U, self.OH // U
        self.en = [ld(n).convert('RGB').resize((ow, oh), Image.BOX).resize((ow * U, oh * U), Image.NEAREST).convert('RGBA') for n, hp in self.ENEMIES]
        hx, hy = self.home
        self.tc = (hx, hy - 200)                                                         # Mitte von Toras
        self.hand = (hx + 190, hy - 250)                                                 # Wurfhand
        self.hp = [e[1] for e in self.ENEMIES]
        self.atk_steps = []                                                              # (Zeit, Betrag, Farbe)
        for i, w in enumerate(self.WEAPONS):
            T = self.T_ACT[i]
            self.atk_steps.append((T + 1.0, 40)); self.atk_steps.append((T + 1.2, w[2]))
        self.dmg = []
        a = self.ATK0
        for i, w in enumerate(self.WEAPONS):
            a += 40 + w[2]
            self.dmg.append(a)
        self.imp = [self.impact_t(i) for i in range(4)]
        self.FLASHES = tuple([0.0] + list(self.imp))                                      # Bildblitz beim Einschlag
        self.SHOCKS = tuple([0.0] + [T + 1.0 for T in self.T_ACT])                        # Druckwelle um Toras, wenn der Angriff steigt
        self.TENSION_SHAKES = [(t, 7 if i == 0 else 5) for i, t in enumerate(self.SHOCKS)]
        self.T_GUST = 0.0
        self._fx = {}
        self._build_tiles()

    # ───────── Raster / Hilfen ─────────
    def _cp(self, x, y):
        return ((x - self.ox) / self.gp, (y - self.oy) / self.gp)

    def pix_rect(self, d, x0, y0, x1, y1, col):
        d.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=tuple(col) + (255,))

    def impact_t(self, i):
        T = self.T_ACT[i]
        return T + self.THROW + self.FLIGHT * 0.85 + (0.16 if i == 2 else 0.0)

    def atk(self, t):
        v = self.ATK0
        for tt, b in self.atk_steps:
            if t >= tt:
                v += b
        return v

    def atk_changed(self, t):
        return any(0 <= t - tt < 0.45 for tt, b in self.atk_steps)

    # ───────── Zeitplan ─────────
    def pose_at(self, t):
        """Pose-Index (0/1 Überhitzung, 2 Schwert, 3 Hammer, 4 Kampf) oder None (Karten-Sprite)."""
        for i, T in enumerate(self.T_ACT):
            if T + 0.5 <= t < T + self.THROW - 0.07:
                return self.POSE_OVERHEAT[int(t * 8) % 2]
            if T + self.THROW - 0.07 <= t < T + self.THROW + 0.7:
                return self.WEAPONS[i][4]
        return None

    def hide_sprite(self, f):
        return self.pose_at(f / float(self.fps)) is not None

    # ───────── Interface ─────────
    def draw_behind(self, canvas, f):
        return

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

    def post_fx(self, img, f):
        t = f / float(self.fps)
        fl = 0.0
        for tg in self.FLASHES:
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

    # ───────── Zerspringende Gegnerkarte ─────────
    def _build_tiles(self):
        rng = np.random.default_rng(3)
        gp = self.gp
        self.tiles = []
        for i, im in enumerate(self.en):
            ts = []
            w, h = im.size
            for ty in range(0, h, gp):
                for tx in range(0, w, gp):
                    cx, cy = tx + gp / 2 - w / 2, ty + gp / 2 - h / 2
                    n = math.hypot(cx, cy) or 1.0
                    sp = rng.uniform(160, 520)
                    ts.append(dict(img=im.crop((tx, ty, tx + gp, ty + gp)), x=tx - w / 2, y=ty - h / 2, vx=cx / n * sp + rng.uniform(-60, 60), vy=cy / n * sp * 0.8 - rng.uniform(100, 360),
                                   life=rng.uniform(0.7, 1.1)))
            self.tiles.append(ts)

    def _draw_enemy(self, canvas, d, t, i):
        T = self.T_ACT[i]
        t_in, imp = T - 0.5, self.imp[i]
        if t < t_in:
            return
        gp, U = self.gp, self.U
        im = self.en[i]
        cx, cy = self.EN_X, self.EN_Y
        t_sh = imp + 0.12
        if t < t_sh:
            y = cy - 220 * (1 - ease_out((t - t_in) / 0.3))
            hit = imp <= t < t_sh
            sh = (8 if int(t * 30) % 2 else -8) if hit else 0
            canvas.paste(im, (int(round((cx - im.width / 2 + sh) / U) * U), int(round((y - im.height / 2) / U) * U)), im)
            return
        tau = t - t_sh
        for p in self.tiles[i]:
            if tau >= p['life']:
                continue
            if tau > p['life'] * 0.7 and (int(t * 30) & 1):
                continue
            x = cx + p['x'] + p['vx'] * tau
            y = cy + p['y'] + p['vy'] * tau + 0.5 * 1100 * tau * tau
            canvas.paste(p['img'], (int(round((x - self.ox) / gp) * gp + self.ox), int(round((y - self.oy) / gp) * gp + self.oy)), p['img'])

    # ───────── Waffenkarten ─────────
    def _draw_slots(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        C = gamefx.C30
        for i, x in enumerate(self.SLOT_X):
            T = self.T_ACT[i]
            if t < T:
                continue
            u = ease_out((t - T) / 0.4)
            y0 = self.SLOT_Y - self.CH / 2 + 330 * (1 - u)
            y0 = int(round(y0 / self.U) * self.U)
            x0 = int(x - self.CW / 2)
            if t - T < 0.07:
                continue
            canvas.paste(self.cards[i], (x0, y0), self.cards[i])
            if t - T >= 0.4:
                self.draw_text(canvas, self.WEAPONS[i][1], 2, (x, y0 - 16), color=GOLD_HL if t - T < 1.2 else (255, 255, 255), outline=None, shadow=(20, 10, 30))
            tau = t - (T + 0.4)                                                          # eingerastet: Ringe, Rahmen blinkt
            if 0 <= tau < 0.6:
                X, Y = self._cp(x, self.SLOT_Y)
                X, Y = gamefx.rd(X), gamefx.rd(Y)
                m.ring(X, Y, gamefx.rd(gamefx.ease(tau / 0.4) * 12), 2 if tau < 0.1 else 1, C['creme'], False)
                if tau > 0.05:
                    m.ring(X, Y, gamefx.rd(gamefx.ease((tau - 0.05) / 0.5) * 17), 1, C['gelb'], True)
            if 0 <= tau < 0.4 and int(t * 15) % 2 == 0:
                gp = self.gp
                a, b = x0 - 2 * gp, y0 - 2 * gp
                c2, e2 = x0 + self.CW + 2 * gp, y0 + self.CH + 2 * gp
                for (p0, p1, p2, p3) in ((a, b, c2, b + gp - 1), (a, e2 - gp, c2, e2 - 1), (a, b, a + gp - 1, e2), (c2 - gp, b, c2 - 1, e2)):
                    self.pix_rect(d, p0, p1, p2, p3, GOLD_HL)
        # Finale: alle Waffen leuchten der Reihe nach auf
        for i, x in enumerate(self.SLOT_X):
            tau = t - (self.T_ACT[3] + 3.1 + 0.28 * i)
            if 0 <= tau < 0.5:
                X, Y = self._cp(x, self.SLOT_Y)
                X, Y = gamefx.rd(X), gamefx.rd(Y)
                m.ring(X, Y, gamefx.rd(gamefx.ease(tau / 0.35) * 15), 2 if tau < 0.1 else 1, C['creme'], False)
                if tau > 0.04:
                    m.ring(X, Y, gamefx.rd(gamefx.ease((tau - 0.04) / 0.45) * 22), 1, C['gelb'], True)

    # ───────── +40 / +Bonus fliegen in den Zähler ─────────
    def _draw_tokens(self, canvas, d, t):
        for i, w in enumerate(self.WEAPONS):
            T = self.T_ACT[i]
            for k, (t_a, label, col) in enumerate(((T + 1.0, '+40', GOLD_HL), (T + 1.2, '+%d' % w[2], (255, 255, 255)))):
                t_s = t_a - 0.45
                if not (t_s <= t < t_a):
                    continue
                u = ease_out((t - t_s) / 0.45)
                x0, y0 = self.SLOT_X[i], self.SLOT_Y - 150
                x1, y1 = 125, 140
                x = x0 + (x1 - x0) * u
                y = y0 + (y1 - y0) * u - 380 * math.sin(math.pi * u)
                x, y = int(round(x / self.U) * self.U), int(round(y / self.U) * self.U)
                self.draw_text(canvas, label, 6, (x, y), color=col, outline=(20, 10, 30), shadow=None)

    # ───────── Angriffe (Nachbauten der Spiel-Animationen) ─────────
    def _fxs(self, i):
        """Effekte je Akt: Liste von Objekten mit .draw(m, T) in Sekunden seit T_ACT[i] (einmal gebaut)."""
        if i in self._fx:
            return self._fx[i]
        gp = self.gp
        A = self._cp(*self.hand)
        B = self._cp(self.EN_X, self.EN_Y)
        t0 = self.THROW
        fl = self.FLIGHT
        ow = self.OW / float(gp)
        oh = self.OH / float(gp)
        L = []
        if i == 0:
            L.append(gamefx.Geschoss('schwert', A, B, fl, t0=t0, R=9, salt=3))
            L.append(('shift', t0 + fl * 0.85, gamefx.Schnitt(gamefx.rd(B[0]), gamefx.rd(B[1]), 14, krit=True, salt=21)))
        elif i == 1:
            L.append(gamefx.Geschoss('hammer', A, B, fl, t0=t0, R=9, salt=4))
            L.append(('shift', t0 + fl * 0.85, gamefx.HammerHit(gamefx.rd(B[0]), gamefx.rd(B[1]), ow, salt=9)))
        elif i == 2:
            for k in range(5):
                off = (k - 2)
                a = (A[0] + off * 0.7, A[1] + abs(off) * 0.8)
                b = (B[0] + off * 2.0, B[1] + ((k * 5) % 3 - 1) * 3.0)
                gs = gamefx.Geschoss('pfeil', a, b, fl, t0=t0 + 0.04 * k, R=7, schweif=False, salt=6 + k, va=1)
                L.append(gs)
                L.append(('shift', gs.landung(), gamefx.Schnitt(gamefx.rd(b[0]), gamefx.rd(b[1]), 5, krit=False, salt=31 + k)))
        else:
            L.append(gamefx.Geschoss('schwert', A, B, fl, t0=t0, R=10, salt=7))
            fb = gamefx.Feuerball((B[0], B[1]), (B[0], B[1]), tA=0.0, k=0.4, gr=1.0, salt=77)
            L.append(('boom', t0 + fl * 0.85, fb))
        self._fx[i] = L
        return L

    def _draw_attacks(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        for i, T in enumerate(self.T_ACT):
            tau = t - T
            if not (self.THROW - 0.1 <= tau < self.THROW + 2.0):
                continue
            for e in self._fxs(i):
                if isinstance(e, tuple):
                    kind, t_start, obj = e
                    dt = tau - t_start
                    if dt < 0:
                        continue
                    if kind == 'boom':
                        if dt < obj.ENDE:
                            obj._einschlag(m, dt)
                    else:
                        obj.draw(m, dt)
                else:
                    e.draw(m, tau)

    # ───────── Finale: Waffensturm (alle Waffenarten fliegen durchs Bild) ─────────
    STORM_T = 18.9

    def _storm(self):
        if hasattr(self, '_st'):
            return self._st
        arts = ['schwert', 'axt', 'dolch', 'dreizack', 'hammer', 'pfeil', 'schwert', 'axt', 'dreizack', 'dolch', 'hammer', 'pfeil', 'schwert', 'axt', 'dolch', 'dreizack']
        L = []
        for k, art in enumerate(arts):
            x = 80 + (k * 997 % 920)
            A = self._cp(x, 1500 + (k % 3) * 60)
            B = self._cp(x + (k % 5 - 2) * 70, -80)
            L.append(gamefx.Geschoss(art, A, B, 1.0, t0=0.07 * k, R=8 if art != 'dreizack' else 9, salt=40 + k, va=1))
        self._st = L
        return L

    def _draw_storm(self, canvas, d, t):
        tau = t - self.STORM_T
        if not (0 <= tau < 2.2):
            return
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        for g in self._storm():
            g.draw(m, tau)

    # ───────── Aufladen und Pose ─────────
    def _draw_charge(self, canvas, d, t):
        m = gamefx.Cells(canvas, self.ox, self.oy, self.gp)
        if not hasattr(self, '_ch'):
            c = self._cp(*self.tc)
            self._ch = gamefx.Feuerball((gamefx.rd(c[0]), gamefx.rd(c[1])), (gamefx.rd(c[0]), gamefx.rd(c[1]) - 1), tA=0.9, k=0.62, salt=5)
        for tt, b in self.atk_steps:
            dt = t - (tt - 0.3)
            if 0 <= dt < 0.3:
                self._ch._laden(m, dt)
        tau = t - 0.1                                                                    # Eröffnung: Toras' Schnitt
        if 0 <= tau < 1.2:
            if not hasattr(self, '_intro'):
                c = self._cp(*self.tc)
                self._intro = gamefx.Schnitt(gamefx.rd(c[0]), gamefx.rd(c[1]), 15, krit=True, direction=(0.6, 0.8), salt=15)
            self._intro.draw(m, tau)

    def _draw_pose(self, canvas, d, t):
        p = self.pose_at(t)
        if p is None:
            return
        im, pad, cxf, foot = self.actor_fn('pose', p)
        gp = self.gp
        x, y = self.home
        fx = self.ox + int(round((x - cxf * gp - self.ox) / gp)) * gp
        fy = self.oy + int(round((y - foot * gp - self.oy) / gp)) * gp
        canvas.paste(im, (fx - pad + self.sprite_dx(int(t * self.fps)), fy - pad), im)

    # ───────── Zähler ─────────
    def _draw_hud(self, canvas, d, t):
        a = self.atk(t)
        col = (255, 255, 255) if (self.atk_changed(t) and int(t * 15) % 2 == 0) else GOLD
        self.draw_text(canvas, 'ATTACK', 3, (125, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
        self.draw_text(canvas, str(a), 9, (125, 140), color=col, outline=None, shadow=(60, 30, 0))
        for i, T in enumerate(self.T_ACT):
            if T - 0.5 <= t < self.imp[i] + 0.9:
                hp = self.hp[i] if t < self.imp[i] else 0
                self.draw_text(canvas, 'ENEMY HP', 3, (955, 74), color=(255, 255, 255), outline=None, shadow=(20, 10, 30))
                self.draw_text(canvas, str(hp), 9, (955, 140), color=(255, 110, 110) if hp == 0 else (255, 255, 255), outline=None, shadow=(70, 10, 10))
        for i, imp in enumerate(self.imp):
            tau = t - imp
            if 0 <= tau < 0.9:
                self.draw_text(canvas, str(self.dmg[i]), 8, (self.EN_X + 250, 200 - 80 * smooth(tau / 0.9)), color=(255, 244, 220), outline=(210, 20, 40), shadow=None)
        if self.T_ACT[3] + 3.0 <= t < self.D - 0.8 and int(t * 6) % 2 == 0:
            self.draw_text(canvas, 'MAX!', 4, (125, 206), color=(255, 90, 90), outline=None, shadow=(40, 10, 10))

    def draw_front(self, canvas, f):
        t = f / float(self.fps)
        d = ImageDraw.Draw(canvas)
        for i in range(4):
            self._draw_enemy(canvas, d, t, i)
        self._draw_slots(canvas, d, t)
        d = ImageDraw.Draw(canvas)
        self._draw_charge(canvas, d, t)
        self._draw_pose(canvas, d, t)
        self._draw_attacks(canvas, d, t)
        self._draw_tokens(canvas, d, t)
        self._draw_storm(canvas, d, t)
        self._draw_hud(canvas, d, t)
        self._draw_caption(canvas, ImageDraw.Draw(canvas), t)

    # ───────── Soundeffekte (public/sounds): gleiche Aktion = gleicher Sound ─────────
    def sfx_events(self):
        D = self.D
        ev = []

        def add(t, kind):
            for item in self.SND[kind]:
                ev.append((t + (item[2] if len(item) > 2 else 0.0), item[0], item[1]) + tuple(item[3:]))
        add(0.0, 'open')
        for i, T in enumerate(self.T_ACT):
            add(T - 0.4, 'enemy'); add(T, 'whoosh'); add(T + 0.4, 'place')
            add(T + 1.0, 'buff'); add(T + 1.2, 'buff')
            add(T + self.THROW, 'throw')
            imp = self.imp[i]
            if i == 0:
                add(imp, 'slash')
            elif i == 1:
                add(imp, 'smash')
            elif i == 2:
                for k in range(5):
                    add(imp - 0.16 + 0.04 * k, 'arrow')
            else:
                add(imp, 'boom')
            add(imp + 0.12, 'ko')
        for i in range(4):
            add(self.T_ACT[3] + 3.1 + 0.28 * i, 'ping')
        for k in range(16):
            add(self.STORM_T + 0.07 * k, 'throw')
        ev.append((D - 1.0, 'ascension', -9, 1.2))
        return sorted(ev)
