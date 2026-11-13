"""Portierungen echter Spiel-Animationen (Pixelart-Canvas, Trailer-Look) nach Python – Zeile für Zeile aus dem Quelltext des Spiels übernommen:

  • Feuerball      `ppFx30Feuerball`   (public/app-fx-30.jsx)  Aufladen, Flug mit Flammenzungen und Partikelstrom, Einschlag mit Ringen, Strahlen, Funken, Brand und Rauch
  • Kettenblitz    `ppFx28Kettenblitz` (public/app-fx-28.jsx)  gezackter vierschichtiger Blitz mit Abzweigungen, Entladung/Einschlag, Funken, Nachglühen
  • Sandstrahl     `ppFx30Sand`        (public/app-fx-30.jsx)  Körner, Schlieren und Staubkanal von der Düse zum Ziel

Alles in Rasterzellen (Rasterzelle = Pixel des Heroes, hier die Zelle des Hero-Sprites), harte Kanten, feste Palette, 30 Bilder/s, keine Alpha-Überblendung.
Die Zufallszahlen sind (wie im Spiel) ein Ganzzahl-Hash; das `salt` ist hier fest, damit jedes Reel gleich aussieht.
Alle Funktionen malen ein Bild zur Zeit t (Sekunden seit Start der Animation) mit einem `Cells`-Maler auf ein PIL-Bild."""
import math

import numpy as np

from PIL import ImageDraw


def _imul(a, b):
    return (a * b) & 0xFFFFFFFF


def H(a, b):
    """Ganzzahl-Hash → 0..1 (ppFx30H / ppFx28H)."""
    a = int(a) & 0xFFFFFFFF
    b = int(b) & 0xFFFFFFFF
    h = _imul(a ^ 0x9E3779B9, 0x85EBCA6B) ^ _imul((b + 0x7F4A7C15) & 0xFFFFFFFF, 0xC2B2AE35)
    h ^= h >> 15
    h = _imul(h, 0x2C1B3C6D)
    h ^= h >> 12
    h = _imul(h, 0x297A2D39)
    h ^= h >> 15
    return (h & 0xFFFFFFFF) / 4294967296.0


def rd(v):
    return int(math.floor(v + 0.5))                                                    # Math.round


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def kl(v, a, b):
    return max(a, min(b, v))


def Fl(x):
    return int(math.floor(x * 30 + 1e-4))


def hexc(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


class Cells:
    """Rastermaler: Zellkoordinaten (x, y) → Pixel auf dem Raster (ox, oy, gp) des Hero-Sprites."""

    def __init__(self, img, ox, oy, gp):
        self.d = ImageDraw.Draw(img)
        self.ox, self.oy, self.gp = ox, oy, gp
        self.W, self.H = img.size
        self.alpha = (255,) if 'A' in img.mode else ()

    def rect(self, x, y, w, h, c):
        gp = self.gp
        x0, y0 = self.ox + x * gp, self.oy + y * gp
        x1, y1 = x0 + w * gp, y0 + h * gp
        if x1 <= 0 or y1 <= 0 or x0 >= self.W or y0 >= self.H or w <= 0 or h <= 0:
            return
        self.d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=tuple(c) + self.alpha)

    def disc(self, X, Y, r, c):
        for yy in range(-r, r + 1):
            xr = rd(math.sqrt(max(0, r * r + r * 0.6 - yy * yy)))
            self.rect(X - xr, Y + yy, 2 * xr + 1, 1, c)

    def linie(self, x0, y0, x1, y1, th, c):
        o = th // 2
        x0 -= o; y0 -= o; x1 -= o; y1 -= o
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        for _ in range(500):
            self.rect(x0, y0, th, th, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def ring(self, cx, cy, r, th, c, dither):
        x, y, err = r, 0, 1 - r
        while x >= y:
            if not dither or ((cx + x + cy + y) & 1) == 0:
                self.rect(cx + x, cy + y, th, th, c); self.rect(cx - x, cy - y, th, th, c)
            if not dither or ((cx + y + cy + x) & 1) == 0:
                self.rect(cx + y, cy + x, th, th, c); self.rect(cx - y, cy - x, th, th, c)
            if not dither or ((cx - y + cy + x) & 1) == 0:
                self.rect(cx - y, cy + x, th, th, c); self.rect(cx + y, cy - x, th, th, c)
            if not dither or ((cx - x + cy + y) & 1) == 0:
                self.rect(cx - x, cy + y, th, th, c); self.rect(cx + x, cy - y, th, th, c)
            y += 1
            if err < 0:
                err += 2 * y + 1
            else:
                x -= 1
                err += 2 * (y - x) + 1


C30 = dict(creme=hexc('#fffbd2'), gelb=hexc('#ffe23d'), org=hexc('#ff9a1a'), rot=hexc('#fe5154'), dunkel=hexc('#8b0d0d'),
           tinte=hexc('#12101f'), rauch=hexc('#3e3e51'), asche=hexc('#59606e'), grau=hexc('#9aa3b6'))
NACH = 1.25


# ═════════════════════════════ Feuerball ═════════════════════════════
class Feuerball:
    """A, B = Quelle und Ziel in Rasterzellen; tA = Landezeit (s); k = Maßstab (Kartenbreite in Zellen / 40); gr = Größe (1 = Fireball)."""

    def __init__(self, A, B, tA=0.9, k=0.94, gr=1.0, salt=31337, stop=None, kill=None):
        self.stop = tA if stop is None else stop                                         # Flug endet hier (z. B. im Netz gefangen)
        self.kill = (tA + 0.02) if kill is None else kill
        self.AX, self.AY = rd(A[0]), rd(A[1])
        self.BX, self.BY = rd(B[0]), rd(B[1])
        self.tA, self.k, self.gr, self.salt = tA, k, gr, salt
        dist = math.hypot(self.BX - self.AX, self.BY - self.AY) or 1.0
        self.fx, self.fy = (self.BX - self.AX) / dist, (self.BY - self.AY) / dist
        self.ENDE = tA + NACH
        self.kb = max(k, 0.65)
        self.R0 = 12 * self.kb * gr
        self.fun = []
        for i in range(100):
            an = H(salt + 11, i) * math.pi * 2
            sp = (70 + H(salt + 12, i) * 300) * k
            self.fun.append(dict(vx=math.cos(an) * sp, vy=math.sin(an) * sp * 0.8, life=0.3 + H(salt + 13, i) * 0.5, plus=H(salt + 14, i) < 0.3,
                                 sz=2 if H(salt + 15, i) < 0.4 else 1, c=[C30['creme'], C30['gelb'], C30['org'], C30['rot']][int(H(salt + 16, i) * 4)]))

    def radius(self, t):
        return max(2, rd(3 * self.kb + (self.R0 - 3 * self.kb) * kl(t / 0.2, 0, 1)))

    def kopf(self, t):
        u = kl(min(t, self.stop) / self.tA, 0, 1)
        e = u ** 1.5
        return (self.AX + (self.BX - self.AX) * e, self.AY + (self.BY - self.AY) * e - 5 * self.kb * math.sin(math.pi * e))

    def draw(self, m, t):
        t = Fl(max(0.0, t)) / 30.0
        if t >= max(self.ENDE, self.kill + 0.7):
            return
        self._laden(m, t)
        if t < self.kill + 0.66:
            self._ball(m, t)
        if self.stop >= self.tA and t >= self.tA:
            self._einschlag(m, t - self.tA)

    def _ball(self, m, t):
        C = C30
        RAMP = [C['creme'], C['gelb'], C['org'], C['rot'], C['dunkel']]
        tq = Fl(t) / 30.0
        f = Fl(t) >> 1
        RATE = 30
        tA, kb, salt = self.tA, self.kb, self.salt
        for kk in range(int(math.ceil(0.66 * RATE)), -1, -1):
            for j in range(3):
                te = tq - kk / float(RATE)
                if te < 0 or te > self.stop:
                    continue
                id_ = rd(te * RATE) * 3 + j + salt % 977
                age = t - te
                life = 0.28 + 0.36 * H(id_, 1)
                u = age / life
                if u >= 1:
                    continue
                hx, hy = self.kopf(te)
                Rt = self.radius(te)
                a = H(id_, 2) * math.pi * 2
                rr = math.sqrt(H(id_, 3)) * Rt * 0.8
                px = hx + math.cos(a) * rr + math.sin(age * 15 + id_) * Rt * 0.32 * u
                py = hy + math.sin(a) * rr * 0.8 - (16 + 34 * H(id_, 4)) * kb * age * (1 + u * 0.8)
                rad = max(1, rd(Rt * (0.1 + 0.2 * H(id_, 5)) * (1 - u * 0.8)))
                v = u + (H(id_, 6) - 0.5) * 0.22
                m.disc(rd(px), rd(py), rad, RAMP[0] if v < 0.06 else RAMP[1] if v < 0.3 else RAMP[2] if v < 0.55 else RAMP[3] if v < 0.8 else RAMP[4])
        if t > self.kill:
            return
        hx, hy = self.kopf(t)
        hx0, hy0 = self.kopf(max(0.0, t - 0.05))
        R = self.radius(t)
        X, Y = rd(hx), rd(hy)
        ux, uy = hx - hx0, hy - hy0
        ul = math.hypot(ux, uy)
        if ul < 0.3:
            ux, uy = self.fx, self.fy
        else:
            ux /= ul; uy /= ul

        def zunge(bx0, by0, dx, dy, ln, w0, seed):
            N = max(2, rd(ln))
            for s in range(N):
                v = s / float(N)
                w = max(1, rd(w0 * (1 - v) ** 0.8))
                wob = math.sin(s * 0.5 + f * 1.3 + seed) * R * 0.22 * v
                x = rd(bx0 + dx * s - dy * wob)
                y = rd(by0 + dy * s + dx * wob)
                m.rect(x - w, y - w, 2 * w + 1, 2 * w + 1, C['gelb'] if v < 0.25 else C['org'] if v < 0.55 else C['rot'] if v < 0.85 else C['dunkel'])
                if v < 0.5 and w > 1:
                    m.rect(x - (w >> 1), y - (w >> 1), w + 1, w + 1, C['creme'] if v < 0.22 else C['gelb'])
        for j in range(-3, 4):
            ang = math.atan2(-uy, -ux) + j * 0.32 + (H(j + 40, f) - 0.5) * 0.3
            ln = R * (1.7 + 1.8 * H(j + 50, f)) * (1 - abs(j) * 0.13)
            zunge(X + math.cos(ang) * R * 0.3, Y + math.sin(ang) * R * 0.3, math.cos(ang), math.sin(ang) - 0.15, ln, R * 0.42 * (1 - abs(j) * 0.14), j * 3)
        for q in range(7):
            an = H(q, f) * math.pi * 2
            off = R * 0.4 * H(q + 9, f)
            m.disc(rd(X + math.cos(an) * off), rd(Y + math.sin(an) * off * 0.9), rd(R * (0.62 + 0.18 * H(q + 20, f))), C['rot'] if q % 2 else C['dunkel'])
        for col, fr, adv in ((C['rot'], 0.7, 0.0), (C['org'], 0.58, 0.12), (C['gelb'], 0.42, 0.2), (C['creme'], 0.22, 0.27)):
            m.disc(rd(X + ux * R * adv + (H(rd(fr * 10), f) - 0.5) * R * 0.2), rd(Y + uy * R * adv + (H(rd(fr * 10) + 5, f) - 0.5) * R * 0.2), max(1, rd(R * fr)), col)

    def _laden(self, m, t):
        if t > 0.3:
            return
        FL5 = [C30['creme'], C30['gelb'], C30['org'], C30['rot']]
        w = Fl(t)
        salt, k = self.salt, self.k
        for q in range(14):
            t0 = H(q + salt % 31, 3) * 0.16
            life = 0.14
            d = t - t0
            if d < 0 or d >= life:
                continue
            an = H(q, 5 + salt % 13) * math.pi * 2
            r = (14 + H(q, 7) * 22) * k * (1 - d / life)
            x = rd(self.AX + math.cos(an) * r)
            y = rd(self.AY + math.sin(an) * r * 0.85)
            m.rect(x, y, 1 if q % 3 else 2, 1 if q % 3 else 2, FL5[(q + w) % 4])

    def _einschlag(self, m, dt):
        C = C30
        k, salt = self.k, self.salt
        X, Y = self.BX, self.BY
        if dt < 0.9:
            m.ring(X, Y, rd(ease(dt / 0.35) * 70 * k), max(2, rd(5 * k)) if dt < 0.12 else max(1, rd(2 * k)), C['creme'], False)
            if dt > 0.04:
                m.ring(X, Y, rd(ease((dt - 0.04) / 0.45) * 54 * k), max(1, rd(3 * k)), C['gelb'], False)
            if dt > 0.08:
                m.ring(X, Y, rd(ease((dt - 0.08) / 0.6) * 110 * k), max(1, rd(3 * k)), C['org'], True)
            if dt > 0.18:
                m.ring(X, Y, rd(ease((dt - 0.18) / 0.65) * 140 * k), max(1, rd(2 * k)), C['rot'], True)
        if dt < 0.3:
            L = ease(min(1.0, dt / 0.1)) * (1 - max(0.0, (dt - 0.1) / 0.2))
            for r in range(24):
                an = r * math.pi / 12 + 0.1
                ln = L * (60 if r % 2 else 120) * k
                ex, ey = rd(X + math.cos(an) * ln), rd(Y + math.sin(an) * ln)
                m.linie(X, Y, ex, ey, max(2, rd(7 * k)), C['tinte'])
                m.linie(X, Y, ex, ey, max(1, rd(4 * k)), C['creme'] if r % 3 == 0 else C['org'] if r % 2 else C['gelb'])
            m.disc(X, Y, max(2, rd(14 * k * L)), C['creme'])
        for q in self.fun:
            if dt >= q['life'] or (dt > q['life'] * 0.7 and Fl(dt) % 2):
                continue
            br = 1 - 0.55 * (dt / q['life'])
            x = rd(X + q['vx'] * dt * br)
            y = rd(Y + q['vy'] * dt * br + 140 * k * dt * dt)
            if q['plus']:
                m.rect(x - 1, y, 3, 1, q['c']); m.rect(x, y - 1, 1, 3, q['c'])
            else:
                m.rect(x, y, q['sz'], q['sz'], q['c'])
        if 0.05 < dt < 1.2:
            keep = 1 if dt < 0.5 else max(0.0, 1 - (dt - 0.5) / 0.7)
            w = Fl(dt)
            for c in range(6):
                for p in range(5):
                    id_ = c * 31 + p * 7 + (w >> 1) * 3 + salt % 101
                    if H(id_, 77) > keep:
                        continue
                    age = ((w + p * 2 + c) % 12) / 12.0
                    x = rd(X + (c - 2.5) * 11 * k + (H(id_, 2) - 0.5) * 6 * k)
                    y = rd(Y + 4 * k - age * (22 + H(id_, 3) * 22) * k)
                    sz = max(1, rd((2 + 2 * H(id_, 4)) * k * (1 - age * 0.7)))
                    m.rect(x - (sz >> 1), y - sz, sz, sz, C['gelb'] if age < 0.25 else C['org'] if age < 0.55 else C['rot'] if age < 0.85 else C['dunkel'])
        if 0.3 < dt < 1.25:
            w = Fl(dt) >> 1
            for p in range(7):
                id_ = p * 13 + w * 5 + salt % 53
                age = ((dt - 0.3) * 1.1 + H(p, 8)) % 1
                x = rd(X + (H(id_, 1) - 0.5) * 40 * k)
                y = rd(Y - 6 * k - age * 30 * k)
                sz = max(2, rd((3 + 2 * age) * k))
                m.rect(x, y, sz, sz, C['rauch'] if age < 0.4 else C['asche'] if age < 0.75 else C['grau'])


# ═════════════════════════════ Kettenblitz ═════════════════════════════
C28 = dict(creme=hexc('#fffbd2'), gelb=hexc('#ffe23d'), hell=hexc('#b3d8f9'), blau=hexc('#4580f6'), dunkel=hexc('#14285a'))
LT = 0.30


class Kettenblitz:
    def __init__(self, A, B, step=0, k=0.94, salt=4242, entlade=True):
        self.AX, self.AY = rd(A[0]), rd(A[1])
        self.BX, self.BY = rd(B[0]), rd(B[1])
        self.step, self.k, self.salt, self.entlade = step, k, salt, entlade
        self.ENDE = LT + 1.3
        cols = [C28['gelb'], C28['creme'], C28['hell'], C28['gelb'], C28['creme']]
        self.teile = []
        AX, AY, BX, BY = self.AX, self.AY, self.BX, self.BY
        for i in range(60):
            an = H(salt, 10 + i) * math.pi * 2
            sp = (50 + H(salt, 200 + i) * 190) * k
            self.teile.append(dict(t0=LT, life=0.3 + H(salt, 400 + i) * 0.45, x=BX, y=BY, vx=math.cos(an) * sp, vy=math.sin(an) * sp, ay=220 * k,
                                   plus=H(salt, 600 + i) < 0.3, sz=2 if H(salt, 800 + i) < 0.4 else 1, c=cols[int(H(salt, 1000 + i) * len(cols))]))
        for i in range(24):
            f = H(salt, 1200 + i)
            self.teile.append(dict(t0=LT + H(salt, 1400 + i) * 0.2, life=0.25 + H(salt, 1600 + i) * 0.3, x=AX + (BX - AX) * f, y=AY + (BY - AY) * f,
                                   vx=(H(salt, 1800 + i) - 0.5) * 60 * k, vy=(H(salt, 2000 + i) - 0.5) * 60 * k, ay=100 * k, plus=H(salt, 2200 + i) < 0.3, sz=1,
                                   c=cols[int(H(salt, 2400 + i) * len(cols))]))
        for i in range(18):
            self.teile.append(dict(t0=LT + 0.1 + H(salt, 2600 + i) * 0.3, life=0.5 + H(salt, 2800 + i) * 0.4, x=BX + (H(salt, 3000 + i) - 0.5) * 20 * k,
                                   y=BY + (10 + H(salt, 3200 + i) * 10) * k, vx=(H(salt, 3400 + i) - 0.5) * 14 * k, vy=-(14 + H(salt, 3600 + i) * 34) * k, ay=0,
                                   plus=True, sz=1, c=cols[int(H(salt, 3800 + i) * len(cols))]))

    def laden(self, m, t, dauer):
        """Funken laufen an der Quelle zusammen, bevor der Blitz einschlägt (t = Zeit seit Beginn des Aufladens)."""
        if t < 0 or t >= dauer:
            return
        cols = [C28['creme'], C28['hell'], C28['blau'], C28['gelb']]
        w = Fl(t)
        for q in range(16):
            ph = ((t / 0.22) + H(q, 3)) % 1.0
            an = H(q, 5) * math.pi * 2
            r = (10 + H(q, 7) * 18) * self.k * (1 - ph)
            m.rect(rd(self.AX + math.cos(an) * r), rd(self.AY + math.sin(an) * r * 0.85), 1 if q % 3 else 2, 1 if q % 3 else 2, cols[(q + w) % 4])
        if (w >> 1) % 2 == 0:
            m.disc(rd(self.AX), rd(self.AY), max(1, rd(2 * self.k + 3 * t / dauer)), C28['creme'])

    def _blitz(self, m, seed, th, frac):
        C = C28
        AX, AY, BX, BY, k = self.AX, self.AY, self.BX, self.BY, self.k
        dick = max(2, rd(7 * k)); amp = 14 * k; seg = max(3, 6 * k); glimm = max(4, rd(9 * k))
        dx, dy = BX - AX, BY - AY
        ln = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / ln, dx / ln
        n = max(6, rd(ln / seg))
        pts = [(AX, AY)]
        for i in range(1, n):
            f = i / float(n)
            off = (H(seed, i) - 0.5) * 2 * amp * math.sqrt(math.sin(math.pi * f))
            pts.append((rd(AX + dx * f + nx * off), rd(AY + dy * f + ny * off)))
        pts.append((BX, BY))
        spitze = len(pts) - 1
        if frac < 1:
            spitze = max(1, int(math.ceil(len(pts) * frac)) - 1)
            pts = pts[:spitze + 1]
        gt = th + glimm
        cnt = 0
        for i in range(len(pts) - 1):
            x0, y0 = pts[i]
            x1, y1 = pts[i + 1]
            ddx, ddy = abs(x1 - x0), -abs(y1 - y0)
            sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
            err = ddx + ddy
            for _ in range(300):
                if (cnt & 3) < 2:
                    m.rect(x0 - gt // 2, y0 - gt // 2, gt, gt, C['dunkel'])
                cnt += 1
                if x0 == x1 and y0 == y1:
                    break
                e2 = 2 * err
                if e2 >= ddy:
                    err += ddy; x0 += sx
                if e2 <= ddx:
                    err += ddx; y0 += sy
        for c, w in ((C['dunkel'], th + 4), (C['blau'], th + 2), (C['hell'], th), (C['creme'], max(1, th - 2))):
            for i in range(len(pts) - 1):
                m.linie(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c)
        ang0 = math.atan2(dy, dx)
        nb = 5 if frac < 1 else 8
        for b in range(nb):
            idx = int(math.floor(n * (0.1 + 0.8 * H(seed, 50 + b))))
            if idx > spitze:
                continue
            px, py = pts[min(len(pts) - 1, idx)]
            ang = ang0 + (-1 if H(seed, 60 + b) < 0.5 else 1) * (0.5 + H(seed, 70 + b) * 0.7)
            bl = (16 + H(seed, 80 + b) * 34) * k
            qx, qy = px, py
            for j in range(1, 5):
                a2 = ang + (H(seed, 90 + b * 7 + j) - 0.5) * 0.9
                x2, y2 = rd(px + math.cos(a2) * bl * j / 4), rd(py + math.sin(a2) * bl * j / 4)
                m.linie(qx, qy, x2, y2, 2, C['blau']); m.linie(qx, qy, x2, y2, 1, C['creme'])
                qx, qy = x2, y2

    def _strahlen(self, m, X, Y, dt, rN, ring_hell, drehung, rayT):
        C, k = C28, self.k
        m.ring(X, Y, rd(ease(dt / 0.4) * 40 * k * (0.9 if ring_hell else 1)), max(1, rd(3 * k)) if dt < 0.1 else 1, C['creme'], False)
        if dt > 0.05 - (0.01 if ring_hell else 0):
            m.ring(X, Y, rd(ease((dt - 0.05) / 0.4) * 28 * k), max(1, rd(2 * k)), C['gelb'], False)
        if ring_hell and dt > 0.08:
            m.ring(X, Y, rd(ease((dt - 0.08) / 0.45) * 50 * k), max(1, rd(2 * k)), C['hell'], True)
        if dt < rayT:
            L = ease(dt / (rayT / 2)) if dt < rayT / 2 else 1 - (dt - rayT / 2) / (rayT / 2)
            for r in range(rN):
                an = r * math.pi * 2 / rN + drehung
                ln = L * (34 if r % 2 else 60) * k
                m.linie(X, Y, rd(X + math.cos(an) * ln), rd(Y + math.sin(an) * ln), max(1, rd((2 if r % 2 else 3) * k)), C['gelb'] if r % 2 else C['creme'])

    def draw(self, m, t):
        t = Fl(max(0.0, t)) / 30.0
        if t >= self.ENDE:
            return
        C, k, step, salt = C28, self.k, self.step, self.salt
        dick = max(2, rd(7 * k))
        if self.entlade and t < 0.5:
            self._strahlen(m, self.AX, self.AY, t, 20, False, 0.2, 0.16)
        if 0 <= t <= LT + 0.34 and not (t > LT + 0.2 and Fl(t) % 2):
            th = dick if t < LT + 0.08 else max(2, rd(4 * k)) if t < LT + 0.2 else max(1, rd(2 * k))
            self._blitz(m, step * 100 + (salt % 7) * 1000 + Fl(t) // 2, th, min(1.0, t / LT))
        dh = t - LT
        if 0 <= dh < 0.55:
            self._strahlen(m, self.BX, self.BY, dh, 16, True, step * 0.4, 0.14)
        if 0.12 <= dh <= 1.0:
            w = Fl(dh) // 2
            for q in range(3):
                if H(step * 10 + q + salt, w + 400) > 0.7 - 0.5 * min(1.0, (dh - 0.12) / 0.8):
                    continue
                a0 = H(q + salt, w + 410) * math.pi * 2
                ln = (8 + H(q + salt, w + 420) * 14) * k
                r0 = 8 * k
                qx, qy = self.BX + math.cos(a0) * r0, self.BY + math.sin(a0) * r0
                for j in range(1, 4):
                    a2 = a0 + (H(q + salt, w * 5 + j) - 0.5) * 1.2
                    x2, y2 = rd(self.BX + math.cos(a2) * (r0 + ln * j / 3)), rd(self.BY + math.sin(a2) * (r0 + ln * j / 3))
                    m.linie(rd(qx), rd(qy), x2, y2, 1, C['hell'])
                    qx, qy = x2, y2
        for q in self.teile:
            d = t - q['t0']
            if d < 0 or d >= q['life'] or (d > q['life'] * 0.7 and Fl(d) % 2):
                continue
            x = rd(q['x'] + q['vx'] * d)
            y = rd(q['y'] + q['vy'] * d + 0.5 * q['ay'] * d * d)
            if q['plus']:
                m.rect(x - 1, y, 3, 1, q['c']); m.rect(x, y - 1, 1, 3, q['c'])
            else:
                m.rect(x, y, q['sz'], q['sz'], q['c'])


# ═════════════════════════════ Sandstrahl ═════════════════════════════
SAND = [hexc('#f9ecb3'), hexc('#e0c085'), hexc('#ca874e'), hexc('#9d612f')]


class Sandstrahl:
    """A, B in Bildschirmpixeln des Reels; gp = Rasterzelle des Reels; `u` rechnet die Bildschirmmaße des Spiels (Hero-Pixel ≈ 2,8 px) auf das Reel um."""

    def __init__(self, A, B, gp, dur=950, salt=777, s_game=2.8, dichte=1.0):
        self.ax, self.ay = A
        self.bx, self.by = B
        self.gp = gp
        u = gp / s_game
        self.u = u
        dist = math.hypot(self.bx - self.ax, self.by - self.ay) or 1.0
        self.dist = dist
        self.ux, self.uy = (self.bx - self.ax) / dist, (self.by - self.ay) / dist
        nx, ny = -self.uy, self.ux
        self.dauer = dur
        strom = rd(dur * 0.7)
        self.ENDE = (strom + 400) / 1000.0 + 0.05

        def gauss(id_, q):
            return (H(id_, q) + H(id_, q + 1) + H(id_, q + 2)) / 3 - 0.5
        self.kor, self.sch = [], []
        ax, ay, bx, by, ux, uy = self.ax, self.ay, self.bx, self.by, self.ux, self.uy
        for i in range(int(280 * dichte)):
            id_ = i + salt * 7
            start, ende = gauss(id_, 1) * 10 * u, gauss(id_, 4) * 64 * u
            self.kor.append(dict(x=ax + nx * start + ux * H(id_, 7) * 14 * u, y=ay + ny * start + uy * H(id_, 8) * 14 * u, dx=(bx - ax) + nx * (ende - start), dy=(by - ay) + ny * (ende - start),
                                 g=max(1, rd((1 + rd(H(id_, 9) * 25) / 10.0) / s_game)), c=SAND[int(H(id_, 10) * 4)], verzug=rd(H(id_, 11) * strom), flug=rd(240 + H(id_, 12) * 150), id=id_))
        for i in range(int(34 * dichte)):
            id_ = i + 5000 + salt * 3
            start, ende = gauss(id_, 1) * 8 * u, gauss(id_, 4) * 44 * u
            self.sch.append(dict(x=ax + nx * start, y=ay + ny * start, dx=(bx - ax) + nx * (ende - start), dy=(by - ay) + ny * (ende - start), l=(8 + H(id_, 7) * 14) * u,
                                 verzug=rd(H(id_, 8) * strom), flug=rd(200 + H(id_, 9) * 90), id=id_))
        self.kanal = [dict(p=H(i + salt, 21), q=(H(i + salt, 22) - 0.5) * 24 * u, id=i + 900) for i in range(int(70 * dichte))]

    @staticmethod
    def _deck(u):
        if u <= 0 or u >= 1:
            return 0.0
        return u / 0.1 if u < 0.1 else (1 - 0.05 * ((u - 0.1) / 0.75) if u < 0.85 else 0.95 * (1 - (u - 0.85) / 0.15))

    def draw(self, m, t):
        t = Fl(max(0.0, t)) / 30.0
        if t >= self.ENDE:
            return
        ms = t * 1000
        gp, ox, oy = m.gp, m.ox, m.oy
        P = lambda x, y: ((x - ox) / gp, (y - oy) / gp)
        ku = ms / self.dauer
        ka = 0.0 if (ku <= 0 or ku >= 1) else (ku / 0.15 if ku < 0.15 else (1 - 0.2 * ((ku - 0.15) / 0.55) if ku < 0.7 else 0.8 * (1 - (ku - 0.7) / 0.3)))
        if ka > 0.02:
            w = Fl(t) >> 1
            for kk in self.kanal:
                if H(kk['id'] + w * 13, 33) > ka * 0.55:
                    continue
                X, Y = P(self.ax + self.ux * self.dist * kk['p'] + (-self.uy) * kk['q'], self.ay + self.uy * self.dist * kk['p'] + self.ux * kk['q'])
                m.rect(rd(X), rd(Y), 1, 1, SAND[1])
        for k in self.sch:
            u = (ms - k['verzug']) / k['flug']
            a = self._deck(u)
            if a <= 0 or H(k['id'], 5) > a:
                continue
            X, Y = P(k['x'] + k['dx'] * u, k['y'] + k['dy'] * u)
            X0, Y0 = P(k['x'] + k['dx'] * u - self.ux * k['l'], k['y'] + k['dy'] * u - self.uy * k['l'])
            m.linie(rd(X0), rd(Y0), rd(X), rd(Y), 1, SAND[0])
        for k in self.kor:
            u = (ms - k['verzug']) / k['flug']
            a = self._deck(u)
            if a <= 0 or H(k['id'], 5) > a:
                continue
            X, Y = P(k['x'] + k['dx'] * u, k['y'] + k['dy'] * u)
            m.rect(rd(X), rd(Y), k['g'], k['g'], k['c'])


# ═════════════════════════════ gemeinsame Zellen-Pinsel mit Dither (ppR1Pinsel) ═════════════════════════════
BAY4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def bayer(x, y):
    return (BAY4[int(y) & 3][int(x) & 3] + 0.5) / 16.0


class R1:
    """Nachbau des Pinsels `ppR1Pinsel` (app-board.jsx): put/block/disc/ring/line in Rasterzellen, Deckung < 1 = Bayer-Dither, nie Alpha."""

    def __init__(self, m):
        self.m = m

    def put(self, x, y, c, a=1.0):
        X, Y = rd(x), rd(y)
        if a <= 0 or (a < 1 and bayer(X, Y) >= a):
            return
        self.m.rect(X, Y, 1, 1, c)

    def block(self, x, y, w, h, c, a=1.0):
        x, y = rd(x), rd(y)
        if a >= 1:
            self.m.rect(x, y, w, h, c)
            return
        for j in range(h):
            for i in range(w):
                self.put(x + i, y + j, c, a)

    def disc(self, cx, cy, r, c, a=1.0):
        cx, cy = rd(cx), rd(cy)
        R = int(math.ceil(r))
        r2 = r * r + r * 0.6
        for j in range(-R, R + 1):
            for i in range(-R, R + 1):
                if i * i + j * j <= r2:
                    self.put(cx + i, cy + j, c, a)

    def ring(self, cx, cy, r0, r1, c, a=1.0):
        cx, cy = rd(cx), rd(cy)
        R = int(math.ceil(r1))
        o2, i2 = r1 * r1 + r1 * 0.6, r0 * r0 + r0 * 0.6
        for j in range(-R, R + 1):
            for i in range(-R, R + 1):
                d = i * i + j * j
                if i2 < d <= o2:
                    self.put(cx + i, cy + j, c, a)

    def line(self, x0, y0, x1, y1, c, a=1.0, dicke=1):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(int(n) + 1):
            x = rd(x0 + (x1 - x0) * (k / float(n)))
            y = rd(y0 + (y1 - y0) * (k / float(n)))
            if dicke <= 1:
                self.put(x, y, c, a)
            else:
                o = (dicke - 1) // 2
                self.block(x - o, y - o, dicke, dicke, c, a)


C31 = dict(creme=hexc('#fffbd2'), tinte=hexc('#12101f'), hblau=hexc('#b3d8f9'), blau=hexc('#4580f6'), gelb=hexc('#ffe23d'), orange=hexc('#ff9a1a'), rot=hexc('#fe5154'))
BILD = 1.0 / 30


# ═════════════════════════════ Schnitt (`critical_slash`, app-fx-31) ═════════════════════════════
class Schnitt:
    """cx, cy = Mitte des Ziels (Zellen), hh = Höhe des Ziels in Zellen (Maßstab des Effekts). krit = dreifacher Schnitt (critical_slash), sonst Quick Slash."""

    def __init__(self, cx, cy, hh, krit=True, direction=(-0.6, 0.8), salt=11, pal=None):
        self.pal = pal or C31
        self.cx, self.cy, self.hh, self.krit, self.dir, self.salt = cx, cy, hh, krit, direction, salt
        self.ende = 1.1 if krit else 0.52
        C = self.pal
        farben = [C['creme'], C['hblau'], C['blau'], C['creme']] if krit else [C['creme'], C['hblau'], C['creme'], C['gelb']]
        n = 46 if krit else 16
        self.sp = []
        for i in range(n):
            an = H(salt, i * 7 + 1) * math.pi * 2
            v = (90 if krit else 50) + H(salt, i * 7 + 2) * (330 if krit else 160)
            self.sp.append(dict(t0=H(salt, i * 7 + 3) * 0.06, leben=0.3 + H(salt, i * 7 + 4) * (0.45 if krit else 0.25), vx=math.cos(an) * v, vy=math.sin(an) * v * 0.7,
                                plus=H(salt, i * 7 + 5) < 0.3, gross=2 if H(salt, i * 7 + 6) < 0.4 else 1, farbe=farben[int(H(salt, i * 7 + 7) * 4)]))

    def _band(self, g, ax, ay, bx, by, anteil, dick):
        C = self.pal
        D = math.hypot(bx - ax, by - ay)
        L = D * anteil
        if L < 1:
            return
        ux, uy = (bx - ax) / D, (by - ay) / D
        nx, ny = -uy, ux
        n = int(math.ceil(L * 1.6))
        for i in range(n + 1):
            f = i / float(n)
            hw = max(0.5, (dick / 2.0) * (math.sin(math.pi * min(1.0, f)) ** 0.6))
            px, py = ax + ux * L * f, ay + uy * L * f
            reich = hw + 2
            q = -reich
            while q <= reich + 1e-6:
                d = abs(q)
                g.put(px + nx * q, py + ny * q, C['creme'] if d <= hw else C['hblau'] if d <= hw + 1.2 else C['tinte'])
                q += 0.6

    def _ring(self, g, cx, cy, r, dicke, farbe, grob):
        if r >= 1:
            g.ring(cx, cy, max(0, r - dicke), r, farbe, 0.5 if grob else 1)

    def _faecher(self, g, cx, cy, laenge, anzahl, dreh, kurz):
        C = self.pal
        for r in range(anzahl):
            an = r * math.pi * 2 / anzahl + dreh
            ln = laenge * (0.5 if r % 2 else 1)
            x1, y1 = cx + math.cos(an) * ln, cy + math.sin(an) * ln
            g.line(rd(cx), rd(cy), rd(x1), rd(y1), C['tinte'], 1, 3)
            g.line(rd(cx), rd(cy), rd(x1), rd(y1), kurz if r % 2 else (C['creme'] if r % 3 == 0 else C['hblau']), 1, 1)

    def draw(self, m, t):
        if t < 0 or t >= self.ende:
            return
        g = R1(m)
        C = self.pal
        q = int(math.floor(t / BILD + 1e-6))
        dt = t
        cx, cy, hh, krit = self.cx, self.cy, self.hh, self.krit
        if q < 3:
            g.disc(cx, cy, hh * (0.5 if krit else 0.32), C['creme'], [1, 0.55, 0.25][q])
        dx, dy = self.dir
        nx, ny = -dy, dx
        hl = hh * (1.05 if krit else 0.86)
        Ax, Ay, Bx, By = cx - dx * hl, cy - dy * hl, cx + dx * hl, cy + dy * hl
        if krit:
            if q < 13:
                anteil = (q + 1) / 3.0 if q < 3 else 1.0
                dick = 7 if q < 7 else 4 if q < 10 else 2
                if not (q >= 8 and q % 2):
                    self._band(g, Ax, Ay, Bx, By, anteil, dick)
                if 1 <= q < 9:
                    o1x, o1y = nx * hh * 0.2 + dx * hh * 0.02, ny * hh * 0.2 + dy * hh * 0.02
                    o2x, o2y = -nx * hh * 0.25, -ny * hh * 0.25
                    a = min(1.0, q / 3.0)
                    self._band(g, Ax + o1x, Ay + o1y, Bx + o1x, By + o1y, a, 4)
                    self._band(g, Ax + o2x, Ay + o2y, Bx + o2x, By + o2y, a, 2)
        elif q < 10:
            anteil = (q + 1) / 3.0 if q < 3 else 1.0
            dick = 5 if q < 5 else 3 if q < 8 else 1
            if not (q >= 5 and q % 2):
                self._band(g, Ax, Ay, Bx, By, anteil, dick)
            if 1 <= q < 6:
                self._band(g, Ax + hh * 0.2, Ay - hh * 0.06, Bx + hh * 0.2, By - hh * 0.06, min(1.0, q / 3.0), 2)
        k = 1.0 if krit else 0.7
        if krit:
            if dt < 0.8:
                self._ring(g, cx, cy, rd(ease(dt / 0.35) * hh * 0.95), 3 if dt < 0.1 else 1.5, C['creme'], False)
                if dt > 0.04:
                    self._ring(g, cx, cy, rd(ease((dt - 0.04) / 0.5) * hh * 1.45), 2, C['hblau'], True)
                if dt > 0.1:
                    self._ring(g, cx, cy, rd(ease((dt - 0.1) / 0.6) * hh * 1.85), 1.5, C['blau'], True)
            if dt < 0.3:
                L = ease(dt / 0.1) * (1 - max(0.0, (dt - 0.1) / 0.2))
                self._faecher(g, cx, cy, L * hh * 1.0, 12, 0.2, C['hblau'])
        else:
            if dt < 0.3 * k + 0.1:
                self._ring(g, cx, cy, rd(ease(dt / 0.25) * hh * 0.6), 2 if dt < 0.08 else 1, C['creme'], False)
                if dt > 0.03:
                    self._ring(g, cx, cy, rd(ease((dt - 0.03) / 0.25) * hh * 0.42), 1, C['hblau'], True)
        sc = hh / 40.0
        for s in self.sp:
            u = (dt - s['t0']) / s['leben']
            if u < 0 or u > 1:
                continue
            e = 1 - (1 - u) ** 2
            x, y = cx + s['vx'] * e / 3.0 * sc, cy + s['vy'] * e / 3.0 * sc
            if u > 0.75 and (q & 1):
                continue
            f = s['farbe']
            if s['plus']:
                g.put(x, y, f); g.put(x - 1, y, f); g.put(x + 1, y, f); g.put(x, y - 1, f); g.put(x, y + 1, f)
            else:
                g.block(x, y, s['gross'], s['gross'], f)


# ═════════════════════════════ Hammer-Aufprall (app-fx-57, Magic Hammer, Heftigkeit 1,0) ═════════════════════════════
C57 = dict(tinte=hexc('#12101f'), creme=hexc('#fffbd2'), weiss=hexc('#ffffff'), gelb=hexc('#ffe23d'), org=hexc('#ff9a1a'), funke=hexc('#f0f075'), grau=hexc('#9aa3b6'),
           rauch=hexc('#3e3e51'), nacht=hexc('#08060c'), sand=hexc('#c5b7a0'), sandD=hexc('#a89370'), sandDD=hexc('#886c44'), stein=hexc('#7f7f7f'), steinH=hexc('#b9b9b9'),
           steinD=hexc('#535353'), erde=hexc('#9d612f'), erdeD=hexc('#5a341a'))


class HammerHit:
    """Aufprall des Hammers (Starburst im Hit-Stop, Druckwellen, Funken, Brocken, Staub). cx, cy = Aufschlagpunkt (Zellen), tw = Breite des Ziels in Zellen."""

    def __init__(self, cx, cy, tw, salt=7, I=1.0, flat=0.85):
        C = C57
        self.cx, self.cy, self.tw, self.I, self.flat = cx, cy, tw, I, flat
        self.stop, self.ende = 7, (7 + 14 + 8) / 30.0 + 0.3
        s = salt
        self.W0 = max(tw * 1.75 * 0.8, tw * 1.3)
        self.tips = [dict(a=(i + (H(s, i + 600) - 0.5) * 0.5) / 12 * math.pi * 2, r=0.75 + H(s, i + 610) * 0.5) for i in range(12)]
        self.sp = []
        for i in range(30):
            a = -math.pi * (0.05 + H(s, i + 200) * 0.9)
            self.sp.append(dict(vx=math.cos(a) * (1 + H(s, i + 210) * 2.4) * tw * 2.0 * I, vy=math.sin(a) * (1 + H(s, i + 220) * 2.0) * tw * 1.6 * I,
                                life=6 + H(s, i + 230) * 8, kreuz=H(s, i + 240) < 0.3, c=[C['creme'], C['gelb'], C['weiss'], C['funke']][int(H(s, i + 250) * 4)]))
        cols = [C['stein'], C['steinH'], C['steinD'], C['erde'], C['sandD'], C['erdeD']]
        self.de = []
        for i in range(22):
            side = 1 if i % 2 else -1
            self.de.append(dict(a=(0 if side > 0 else math.pi) + (H(s, i + 100) - 0.5) * 1.7, vh=(0.5 + H(s, i + 110)) * tw * 1.4 * (0.5 + 0.6 * I),
                                vv=(0.8 + H(s, i + 120)) * tw * 1.5 * (0.5 + 0.6 * I), sz=3 if H(s, i + 130) < 0.3 else 2, c=cols[int(H(s, i + 140) * 6)]))
        self.pu = [dict(a=(i + H(s, i + 150) * 0.8) / 26 * math.pi * 2, r0=2 + H(s, i + 170) * 2, r1=4 + H(s, i + 180) * 5, rise=6 + H(s, i + 190) * 10, id=i) for i in range(26)]

    def _burst(self, m, Ro, pal, rot):
        TP = math.pi * 2
        NL = 128
        N = len(self.tips)
        V = []
        for i in range(N):
            V.append(((self.tips[i]['a'] + rot) % TP, Ro * self.tips[i]['r']))
            V.append(((self.tips[i]['a'] + rot + math.pi / N) % TP, Ro * 0.46))
        V.sort()
        lut = []
        seg = 0
        for q in range(NL):
            th = q / float(NL) * TP
            while seg < len(V) - 1 and V[seg + 1][0] <= th:
                seg += 1
            a, b = V[seg], V[(seg + 1) % len(V)]
            a1 = b[0]
            if a1 <= a[0]:
                a1 += TP
            lut.append(a[1] + (b[1] - a[1]) * kl((th - a[0]) / (a1 - a[0] or 1), 0, 1))
        R = int(math.ceil(Ro * 1.3))
        SQ = 0.8
        for j in range(-R, R + 1):
            for i in range(-R, R + 1):
                dx, dy = i + 0.5, (j + 0.5) / SQ
                d2 = dx * dx + dy * dy
                if d2 > Ro * Ro * 1.7:
                    continue
                th = math.atan2(dy, dx)
                if th < 0:
                    th += TP
                r = lut[int(th / TP * NL) % NL]
                d = math.sqrt(d2)
                if d > r:
                    continue
                m.rect(rd(self.cx + i), rd(self.cy + j), 1, 1, pal[0] if d > r - 1.4 else pal[3] if d < r * 0.38 else pal[2] if d < r * 0.7 else pal[1])

    def _dith(self, m, cx, cy, rx, ry, lv, c):
        if lv <= 0 or rx < 0.5 or ry < 0.5:
            return
        for y in range(int(math.floor(cy - ry)), int(math.ceil(cy + ry)) + 1):
            b = (y - cy) / ry
            if b * b > 1:
                continue
            for x in range(int(math.floor(cx - rx)), int(math.ceil(cx + rx)) + 1):
                a = (x - cx) / rx
                if a * a + b * b > 1:
                    continue
                if lv >= 16 or BAY4[y & 3][x & 3] < lv:
                    m.rect(x, y, 1, 1, c)

    def _ell(self, m, cx, cy, rx, ry, th, c, dither):
        n = max(16, rd(max(rx, ry) * 6))
        lx = ly = None
        for k in range(n):
            a = k / float(n) * math.pi * 2
            x, y = rd(cx + math.cos(a) * rx), rd(cy + math.sin(a) * ry)
            if (x, y) == (lx, ly):
                continue
            lx, ly = x, y
            if dither and ((x + y) & 1):
                continue
            m.rect(x, y, th, th, c)

    def draw(self, m, t):
        f = Fl(max(0.0, t))
        if f > 7 + 14 + 10:
            return
        C = C57
        I, tw, W0, flat = self.I, self.tw, self.W0, self.flat
        cx, cy = self.cx, self.cy
        if f < self.stop:
            hh = f
            szs = [0.85, 1.15, 1.0, 0.85, 0.7, 0.5, 0.3]
            Ro = tw * 2.3 * szs[min(hh, 6)] * 0.62
            self._burst(m, Ro, [C['tinte'], C['org'], C['gelb'], C['creme']], 0)
            self._burst(m, Ro * 0.62, [C['tinte'], C['gelb'], C['creme'], C['weiss']], math.pi / 10)
            lvA = rd(12 * (0.66 ** hh) * (0.3 + 0.7 * math.sqrt(I)))
            rr = W0 * 1.6 * (0.9 + 0.15 * hh) * 0.62
            self._dith(m, cx, cy, rr, rr * flat * 0.8, lvA, C['creme'])
            if hh < 3:
                self._dith(m, cx, cy, W0 * 0.45 * 0.62, W0 * 0.45 * 0.62 * flat * 0.8, 16, C['weiss'])
        ti = f
        rings = [(0, 9, 0.8 + 0.7, C['creme'], False), (1, 11, 2.0, C['gelb'], True), (3, 13, 2.2 + 0.3, C['sandD'], True)]
        for t0, life, K, col, dit in rings:
            tt = ti - t0
            if tt < 0 or tt > life:
                continue
            r1 = rd(ease(tt / float(life)) * W0 * K * 0.62)
            if r1 > 0:
                self._ell(m, cx, cy, r1, rd(r1 * flat), 2 if (t0 == 0 and tt < 3) else 1, col, dit)
        if 4 <= ti <= 18:
            tt = ti - 4
            r1 = rd(ease(tt / 14.0) * W0 * 3.4 * 0.62)
            self._ell(m, cx, cy, r1, rd(r1 * flat), 1, C['creme'], True)
        if f < self.stop:
            hh = f
            Lr = W0 * 2.2 * 0.62 * [0.6, 1, 0.9, 0.75, 0.6, 0.45, 0.3][min(6, hh)]
            g = R1(m)
            for r in range(20):
                an = r * math.pi / 10 + 0.1
                ln = Lr * (0.55 if r % 2 else 1)
                ex, ey = cx + math.cos(an) * ln, cy + math.sin(an) * ln * flat
                g.line(rd(cx), rd(cy), rd(ex), rd(ey), C['tinte'], 1, 3)
                g.line(rd(cx), rd(cy), rd(ex), rd(ey), C['creme'] if r % 2 == 0 else C['gelb'], 1, 1)
        for p in self.pu:
            age = ti - (p['id'] % 3)
            life = 20
            if age < 0 or age >= life:
                continue
            e = ease(age / float(life))
            kk = max(0.6, tw / 40.0)
            r = (p['r0'] * 0.8 + (p['r1'] - p['r0'] * 0.8) * e) * kk * 1.2
            dist = tw * 0.4 + W0 * 0.62 * (0.5 + 0.9) * e
            x = cx + math.cos(p['a']) * dist
            y = cy + math.sin(p['a']) * dist * flat - (3 + p['rise'] * e) * kk
            lv = rd(11 * (1 - age / float(life)))
            if lv <= 0:
                continue
            g = R1(m)
            g.disc(x + r * 0.2, y + r * 0.25, max(1, rd(r)), C['rauch'], lv / 16.0)
            g.disc(x, y, max(1, rd(r * 0.9)), C['sandDD'], lv / 16.0)
            g.disc(x - r * 0.25, y - r * 0.3, max(1, rd(r * 0.55)), C['sand'], lv / 16.0)
        gg = 0.9 * (tw / 40.0)
        for b in self.de:
            life = 28
            if ti >= life:
                continue
            hgt = b['vv'] * (ti / 30.0) * 3.2 - gg * 0.5 * ti * ti * 1.05
            fly = ti / 30.0 * 3.2
            if hgt < 0:
                hgt = 0
            x = cx + math.cos(b['a']) * tw * 0.6 + math.cos(b['a']) * b['vh'] * min(1.0, fly) * 0.45
            y = cy + math.sin(b['a']) * b['vh'] * min(1.0, fly) * 0.3 - hgt * 0.45
            if ti > life - 7 and (ti & 1):
                continue
            sz = b['sz']
            m.rect(rd(x), rd(y), sz, sz, b['c']); m.rect(rd(x), rd(y), max(1, sz - 1), 1, C['creme'])
        for s in self.sp:
            if ti >= s['life'] or (ti > s['life'] * 0.65 and (ti & 1)):
                continue
            x = cx + (s['vx'] * ti / 30.0) * 0.42
            y = cy + (-s['vy'] * ti / 30.0) * 0.42 - 0.5 * 0 + 0.5 * 40 * (ti / 30.0) ** 2 * 0.42
            if s['kreuz']:
                m.rect(rd(x) - 1, rd(y), 3, 1, s['c']); m.rect(rd(x), rd(y) - 1, 1, 3, s['c'])
            else:
                vx, vy = s['vx'] * 0.42 / 30.0, -s['vy'] * 0.42 / 30.0
                R1(m).line(rd(x), rd(y), rd(x - vx * 1.8), rd(y - vy * 1.8), s['c'], 1, 1)
                m.rect(rd(x), rd(y), 1, 1, s['c'])


# ═════════════════════════════ Geschosse (app-fx-38: Schwert, Hammer, Pfeil, Axt, Dolch, Dreizack) ═════════════════════════════
C38 = dict(creme=hexc('#fffbd2'), gelb=hexc('#ffe23d'), org=hexc('#ff9a1a'), rot=hexc('#fe5154'), tinte=hexc('#12101f'), rauch=hexc('#3e3e51'), asche=hexc('#59606e'),
           grau=hexc('#9aa3b6'), hell=hexc('#d2d2db'), weiss=hexc('#ffffff'), braun=hexc('#9d612f'), braunH=hexc('#ca874e'), gold=hexc('#c79e05'))


def _scheibe(u, v, cx, cy, r):
    a, b = u - cx, v - cy
    return a * a + b * b <= r * r


def _streifen(u, v, u0, u1, v0, v1):
    return u0 <= u <= u1 and v0 <= v <= v1


def _dreieck(u, v, ax, ay, bx, by, cx, cy):
    d1 = (u - bx) * (ay - by) - (ax - bx) * (v - by)
    d2 = (u - cx) * (by - cy) - (bx - cx) * (v - cy)
    d3 = (u - ax) * (cy - ay) - (cx - ax) * (v - ay)
    return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))


def _f_schwert(u, v, R, va):
    if _dreieck(u, v, 0.85 * R, -0.22 * R - 0.4, 1.0 * R, 0, 0.85 * R, 0.22 * R + 0.4): return 1
    if _streifen(u, v, -0.15 * R, 0.85 * R, -0.22 * R - 0.4, 0.22 * R + 0.4): return 2 if v > 0 else 1
    if _streifen(u, v, -0.3 * R, -0.1 * R, -0.55 * R, 0.55 * R): return 3
    if _streifen(u, v, -0.85 * R, -0.3 * R, -0.5, 0.5): return 4
    if _scheibe(u, v, -0.95 * R, 0, 0.5 + 0.1 * R): return 3
    return 0


def _f_hammer(u, v, R, va):
    if _streifen(u, v, 0.3 * R, 0.9 * R, -0.45 * R, 0.45 * R): return 2 if v < -0.2 * R else (4 if u > 0.7 * R else 1)
    if _streifen(u, v, -0.9 * R, 0.3 * R, -0.5, 0.5): return 3
    return 0


def _f_pfeil(u, v, R, va):
    hw = max(1.6, R * 0.2)
    schaft = 4 if (va & 1) else 2
    if _dreieck(u, v, 0.55 * R, -hw, 1.0 * R, 0, 0.55 * R, hw): return 1
    if _streifen(u, v, -0.7 * R, 0.6 * R, -0.5, 0.5): return schaft
    if _dreieck(u, v, -1.0 * R, -hw, -0.62 * R, 0, -1.0 * R, hw): return 3
    if _dreieck(u, v, -0.8 * R, -hw, -0.42 * R, 0, -0.8 * R, hw): return 2
    return 0


def _f_axt(u, v, R, va):
    if _streifen(u, v, -0.9 * R, 0.8 * R, -0.5, 0.5): return 3
    a, b = (u - 0.35 * R) / (0.35 * R), v / (0.85 * R)
    if a * a + b * b <= 1 and u >= 0.15 * R: return 2 if v < -0.3 * R else (4 if u > 0.55 * R else 1)
    return 0


def _f_dolch(u, v, R, va):
    if _dreieck(u, v, 0.2 * R, -0.26 * R - 0.4, 1.0 * R, 0, 0.2 * R, 0.26 * R + 0.4): return 2 if v > 0 else 1
    if _streifen(u, v, -0.05 * R, 0.2 * R, -0.5 * R, 0.5 * R): return 3
    if _streifen(u, v, -0.8 * R, -0.05 * R, -0.5, 0.5): return 4
    return 0


def _f_dreizack(u, v, R, va):
    if _streifen(u, v, -0.9 * R, 0.5 * R, -0.5, 0.5): return 4
    if _streifen(u, v, 0.4 * R, 0.55 * R, -0.55 * R, 0.55 * R): return 3
    if _streifen(u, v, 0.5 * R, 1.0 * R, -0.5, 0.5): return 1
    if _streifen(u, v, 0.5 * R, 0.9 * R, -0.58 * R - 0.5, -0.58 * R + 0.5) or _streifen(u, v, 0.5 * R, 0.9 * R, 0.58 * R - 0.5, 0.58 * R + 0.5): return 2
    return 0


FORMEN = dict(
    schwert=(_f_schwert, True, ['hell', 'grau', 'gold', 'braun']), hammer=(_f_hammer, False, ['grau', 'hell', 'braun', 'asche']),
    pfeil=(_f_pfeil, True, ['hell', 'grau', 'asche', 'braunH']), axt=(_f_axt, True, ['grau', 'hell', 'braun', 'asche']),
    dolch=(_f_dolch, True, ['hell', 'grau', 'gold', 'braun']), dreizack=(_f_dreizack, True, ['gold', 'gelb', 'org', 'braun']))
_GITTER = {}


def gitter(art, R, wi, va):
    key = (art, R, wi, va)
    if key in _GITTER:
        return _GITTER[key]
    f, rot, pal = FORMEN[art]
    ext = int(math.ceil(R * 1.15 + 3))
    N = 2 * ext + 1
    ca, sa = math.cos(math.radians(wi)), math.sin(math.radians(wi))
    c = [[0] * N for _ in range(N)]
    for y in range(N):
        for x in range(N):
            dx, dy = x - ext, y - ext
            c[y][x] = f(dx * ca + dy * sa, -dx * sa + dy * ca, R, va)
    out = [row[:] for row in c]
    for y in range(N):
        for x in range(N):
            if c[y][x]:
                continue
            if (x > 0 and c[y][x - 1]) or (x < N - 1 and c[y][x + 1]) or (y > 0 and c[y - 1][x]) or (y < N - 1 and c[y + 1][x]):
                out[y][x] = 255
    res = dict(N=N, ext=ext, c=out, pal=[C38[n] for n in pal])
    _GITTER[key] = res
    return res


RAMPE_GLUT = [C38['creme'], C38['gelb'], C38['org'], C38['rot']]


class Geschoss:
    """Ein Wurfgeschoss wie `ppFx38`: erst kurz sichtbar an der Quelle (10 %), dann anfahrend (ease-in) zum Ziel (bis 85 %), dort blinkt es aus. A, B in Zellen; dur in s."""

    def __init__(self, art, A, B, dur, t0=0.0, R=8, schweif=True, salt=5, va=0, pal=None, ramp=None):
        self.pal, self.ramp = pal, ramp
        self.art, self.AX, self.AY, self.BX, self.BY = art, A[0], A[1], B[0], B[1]
        self.dur, self.t0, self.R, self.schweif, self.id, self.va = dur, t0, R, schweif, salt * 977, va
        self.wi = rd(math.degrees(math.atan2(self.BY - self.AY, self.BX - self.AX)))
        self.ende = t0 + dur + 0.2

    def lage(self, ms):
        u = ms / (self.dur * 1000.0)
        e = 0.0 if u <= 0.1 else (1.0 if u >= 0.85 else ((u - 0.1) / 0.75) ** 1.7)
        return self.AX + (self.BX - self.AX) * e, self.AY + (self.BY - self.AY) * e

    def landung(self):
        return self.t0 + self.dur * 0.85

    def draw(self, m, T):
        ms = (T - self.t0) * 1000.0
        if ms < 0 or ms > self.dur * 1000 + 200:
            return
        frame = Fl(T)
        u = ms / (self.dur * 1000.0)
        X0, Y0 = self.lage(ms)
        X, Y = rd(X0), rd(Y0)
        if self.schweif and ms > 0:
            lebt, slot0 = 280.0, int(math.floor(ms / 25.0))
            for k in range(14):
                s = slot0 - k
                tb = s * 25.0
                a = ms - tb
                if s < 0 or a < 0 or a > lebt:
                    continue
                bx2, by2 = self.lage(tb)
                uu = a / lebt
                sz = 2 if (uu < 0.5 and self.R > 6) else 1
                px = rd(bx2 + (H(s + self.id, 1) - 0.5) * self.R * 0.9)
                py = rd(by2 + (H(s + self.id, 2) - 0.5) * self.R * 0.9 - uu * 3)
                if uu > 0.65 and ((px + py + frame) & 1):
                    continue
                m.rect(px, py, sz, sz, (self.ramp or RAMPE_GLUT)[min(3, int(uu * 4))])
        if u > 0.85 and (frame & 1):
            return
        if ms < 66 and (frame & 1):
            return
        f, rot, pal = FORMEN[self.art]
        wi = self.wi
        if self.art == 'hammer':
            wi = (frame * 36) % 360
        elif not rot:
            wi = 0
        g = gitter(self.art, self.R, wi, self.va)
        N, e = g['N'], g['ext']
        for y in range(N):
            for x in range(N):
                k = g['c'][y][x]
                if k:
                    m.rect(X - e + x, Y - e + y, 1, 1, C38['tinte'] if k == 255 else (self.pal or g['pal'])[k - 1])


# ═════════════════════════════ Heldentod (app-fx-32): die Figur zerspringt in ihre Pixel ═════════════════════════════
def _bayer8():
    def bay(n):
        if n == 1:
            return [[0]]
        m, s = bay(n // 2), n // 2
        return [[4 * m[y % s][x % s] + [[0, 2], [3, 1]][y // s][x // s] for x in range(n)] for y in range(n)]
    return bay(8)


BAY8 = _bayer8()
C32 = dict(creme=hexc('#fffbd2'), grau=hexc('#9aa3b6'), asche=hexc('#59606e'), rauch=hexc('#3e3e51'), dunkel=hexc('#08060c'), orange=hexc('#ff9a1a'), gelb=hexc('#ffe23d'), rot=hexc('#ff491a'))
HALT32, DAUER32 = 4 / 30.0, 0.95
WACKELN32 = [1, -1, 0.6, -0.8]


class HeroDeath:
    """Nachbau von `ppFx32` (Heldentod): Anhalten und Aufblitzen, dann zerfällt die Figur von unten nach oben, jedes Sprite-Pixel fliegt in seiner Farbe auseinander;
    Bodenringe, Funken, Rauch. Eine Zelle = ein Sprite-Pixel (Raster der Figur). frame = RGBA-Bild des Sprite-Frames (PIL), Maße im Frame-Raster."""

    def __init__(self, frame, mitte_x, fuss_y, zw=20, salt=5):
        arr = np.asarray(frame.convert('RGBA'))
        fh, fw = arr.shape[:2]
        ys, xs = np.where(arr[..., 3] >= 96)
        self.y0, self.y1 = int(ys.min()), int(ys.max()) + 1
        self.mx, self.fy, self.zw = mitte_x, fuss_y, zw
        mag = max(0.7, min(2.5, fh / 45.0))
        self.mag = mag
        grav = 100 * mag
        hoehe = max(1, self.y1 - self.y0)
        self.P = []
        ende = 0.0
        for i, (y, x) in enumerate(zip(ys.tolist(), xs.tolist())):
            hy = kl((y + 0.5 - self.y0) / hoehe, 0, 1)
            sc = 0.6 * (1 - hy) + 0.4 * BAY8[y & 7][x & 7] / 64.0
            ts = HALT32 + sc * DAUER32
            vx = ((x + 0.5 - mitte_x) * 0.25 + (H(salt, i * 5 + 1) - 0.5) * 16) * mag
            vy = -(6 + H(salt, i * 5 + 2) * 45) * mag
            flo = max(fuss_y + 1 - 1, y)
            dis = max(0.0, vy * vy + 2 * grav * (flo - y))
            tl = (-vy + math.sqrt(dis)) / grav
            life = min(0.7 + H(salt, i * 5 + 3) * 0.7, tl + 0.16)
            r = H(salt, i * 5 + 4)
            sz = max(1, rd(0.5 if r < 0.45 else (1 if r < 0.9 else 1.5)))
            c = tuple(int(v) for v in arr[y, x, :3])
            self.P.append((x, y, c, ts, vx, vy, flo, tl, life, sz))
            ende = max(ende, ts + life)
        self.grav = grav
        self.rauch = []
        nR = rd(18 * (1 if len(self.P) > 300 else 0.7))
        for i in range(nR):
            t0 = HALT32 + (i / float(nR)) * (DAUER32 + 0.15) + H(salt, 900 + i) * 0.04
            life = 1.0 + H(salt, 950 + i) * 0.8
            self.rauch.append(dict(t0=t0, life=life, x=mitte_x + (H(salt, 1000 + i) - 0.5) * zw * 0.8, y=fuss_y - H(salt, 1050 + i) * fh * 0.25,
                                   vx=(H(salt, 1100 + i) - 0.5) * 8, vy=-(3 + H(salt, 1150 + i) * 6), sz=3 if H(salt, 1200 + i) < 0.5 else 2))
            ende = max(ende, t0 + life)
        self.funken = []
        nF = rd(16 * min(1.5, mag))
        for i in range(nF):
            an = H(salt, 1300 + i) * math.pi * 2
            sp = (30 + H(salt, 1350 + i) * 70) * mag
            self.funken.append(dict(t0=HALT32 + H(salt, 1400 + i) * 0.16, life=0.32 + H(salt, 1450 + i) * 0.32, x=mitte_x + (H(salt, 1500 + i) - 0.5) * zw * 0.5,
                                    y=self.y0 + hoehe * (0.2 + H(salt, 1550 + i) * 0.6), vx=math.cos(an) * sp, vy=math.sin(an) * sp * 0.8 - 20 * mag, plus=H(salt, 1600 + i) < 0.3))
            ende = max(ende, HALT32 + 0.16 + 0.64)
        self.ende = ende + 1 / 30.0

    def draw(self, m, t, tint=None):
        if t < 0 or t >= self.ende:
            return
        f = Fl(t)
        C = C32
        cx, cy = rd(self.mx), rd(self.fy)
        for k in range(4):
            dt = t - (HALT32 + k * 0.25)
            if dt < 0 or dt >= 0.45:
                continue
            R = self.zw * (0.8 + 0.06 * k)
            r1 = rd(ease(dt / 0.45) * R)
            self._ell(m, cx, cy, r1, rd(r1 * 0.3), C["grau"], False)
            if dt > 0.08:
                r2 = rd(ease((dt - 0.08) / 0.4) * R * 0.75)
                self._ell(m, cx, cy, r2, rd(r2 * 0.3), C['asche'], True)
        for r in self.rauch:
            dt = t - r['t0']
            if dt < 0 or dt >= r['life']:
                continue
            u = dt / r['life']
            px, py = rd(r['x'] + r['vx'] * dt), rd(r['y'] + r['vy'] * dt)
            if u > 0.6 and BAY8[py & 7][px & 7] < ((u - 0.6) / 0.4) * 64:
                continue
            m.rect(px, py, r['sz'], r['sz'], [C['grau'], C['asche'], C['rauch'], C['dunkel']][min(3, int(u * 4))])
        du = kl((t - HALT32) / DAUER32, 0, 1)
        ox = rd(([1, -1, 2, -2][f] if f < 4 else WACKELN32[f % 4] * 2 * (1 - du)))
        blitz = f < 2
        for (x, y, c, ts, vx, vy, flo, tl, life, sz) in self.P:
            dt = t - ts
            if dt < 0:
                m.rect(x + ox, y, 1, 1, C['creme'] if blitz else (tint or c))
                continue
            if dt >= life:
                continue
            ds = tl if dt > tl else dt
            fx = x + vx * ds
            fy = min(flo, y + vy * ds + 0.5 * self.grav * ds * ds)
            px = rd(fx + 0.5 - sz / 2.0 + ox * (1 - min(1.0, dt / 0.2)))
            py = rd(fy + 0.5 - sz / 2.0)
            u = dt / life
            if u > 0.62 and BAY8[py & 7][px & 7] < ((u - 0.62) / 0.38) * 64:
                continue
            m.rect(px, py, sz, sz, tint or c)
        for s in self.funken:
            dt = t - s['t0']
            if dt < 0 or dt >= s['life']:
                continue
            u = dt / s['life']
            if u > 0.5 and ((f + int(s['x'] * 7)) & 1):
                continue
            px, py = rd(s['x'] + s['vx'] * dt), rd(s['y'] + s['vy'] * dt + 60 * dt * dt)
            col = [C['creme'], C['gelb'], C['orange'], C['rot']][min(3, int(u * 4))]
            if s['plus']:
                m.rect(px - 1, py, 3, 1, col); m.rect(px, py - 1, 1, 3, col)
            else:
                m.rect(px, py, 1, 1, col)

    def _ell(self, m, cx, cy, rx, ry, col, schach):
        if rx < 1:
            return
        n = max(12, int(math.ceil(rx * 5)))
        lx = ly = None
        for i in range(n):
            a = i / float(n) * math.pi * 2
            x, y = cx + rd(math.cos(a) * rx), cy + rd(math.sin(a) * ry)
            if (x, y) == (lx, ly):
                continue
            lx, ly = x, y
            if schach and ((x + y) & 1):
                continue
            m.rect(x, y, 1, 1, col)


# ═════════════════════════════ Flame Avalanche (app-board.jsx, `flame_avalanche`) ═════════════════════════════
FLAMME = [hexc(h) for h in ('#fffbd2', '#ffd066', '#ff491a', '#8f0000', '#ff9a1a', '#cc2b00')]


class FlameAvalanche:
    """Flächenzauber: Flammenfunken schießen vom Wirker O auf alle Ziele (Kreuz aus vier Tönen, 2 × 9 Hüpfer), am Ziel schlagen drei Pixel-Sterne ein, am Wirker blitzt ein Mündungsfeuer
    aus gestapelten Quadratringen, das Brett bebt. O und ziele in Zellen; ausgabe: .draw(m, t) mit t in Sekunden seit Start."""

    def __init__(self, O, ziele, salt=3, dauer=1.6):
        self.O, self.ziele, self.dauer = O, ziele, dauer
        self.ende = 3.0
        cnt = [0]

        def r():
            cnt[0] += 1
            return H(salt, cnt[0])
        flug = 520
        je = max(4, min(9, 66 // len(ziele)))
        self.bahnen, self.treffer = [], []
        for zi, z in enumerate(ziele):
            sp = math.hypot(z[0] - O[0], z[1] - O[1])
            for i in range(je):
                zx = z[0] + (r() - 0.5) * max(16, sp * 0.26)
                zy = z[1] + (r() - 0.5) * max(11, sp * 0.17)
                self.bahnen.append(dict(zx=zx, zy=zy, mx=(O[0] + zx) / 2 + (r() - 0.5) * sp * 0.22, my=(O[1] + zy) / 2 + (r() - 0.5) * sp * 0.18 - sp * 0.06, gross=r() > 0.55,
                                        verzug=rd(zi * 20 + i * (r() * 40 + 18)), laenge=rd(flug * (0.75 + r() * 0.55))))
            for k in range(3):
                self.treffer.append(dict(zx=z[0] + (r() - 0.5) * 7, zy=z[1] + (r() - 0.5) * 7, at=rd(flug * 0.9 + zi * 20 + k * (je * 11))))

    def draw(self, m, t):
        if t < 0 or t >= self.ende:
            return
        ms = t * 1000.0
        C = FLAMME
        dauer = self.dauer * 1000.0
        bx = by = 0
        bk = (ms - 60) / (dauer * 0.5)
        if 0 <= bk < 1:
            bx, by = [(0, 0), (-1, 1), (1, -1), (-1, -1), (1, 1), (0, 0)][min(5, int(bk * 6))]
        OX, OY = self.O[0] + bx, self.O[1] + by
        mk = ms / (dauer * 0.6)
        if 0 <= mk < 1:
            def sq(q, c):
                m.rect(OX - q, OY - q, 2 * q + 1, 2 * q + 1, c)
            if mk < 0.85:
                r1, r2, c2 = (5, 8, C[5]) if mk < 0.25 else (8, 12, C[5]) if mk < 0.55 else (7, 9, C[3])
                sq(r2, c2); sq(r1, C[4])
            else:
                sq(4, C[2])
            sq(3, C[0])
        for b in self.bahnen:
            k = (ms - b['verzug']) / float(b['laenge'])
            if k < 0 or k >= 1:
                continue
            seg = 0 if k < 0.5 else 1
            u = int(((k - seg * 0.5) / 0.5) * 9) / 9.0
            if seg == 0:
                x0, y0, x1, y1 = 0, 0, b['mx'] - self.O[0], b['my'] - self.O[1]
            else:
                x0, y0, x1, y1 = b['mx'] - self.O[0], b['my'] - self.O[1], b['zx'] - self.O[0], b['zy'] - self.O[1]
            px, py = rd(OX + x0 + (x1 - x0) * u), rd(OY + y0 + (y1 - y0) * u)
            z = 2 if b['gross'] else 1
            m.rect(px - z, py - z, 2 * z + 1, 2 * z + 1, C[2])
            m.rect(px - z, py, 2 * z + 1, 1, C[1]); m.rect(px, py - z, 1, 2 * z + 1, C[1])
            m.rect(px, py, 1, 1, C[0])
            for a, c in ((2 * z, 0), (-2 * z, 0), (0, 2 * z), (0, -2 * z)):
                m.rect(px + a, py + c, 1, 1, C[3])
        for e in self.treffer:
            k = (ms - e['at']) / 360.0
            if k < 0 or k >= 1:
                continue
            zx, zy = rd(e['zx'] + bx), rd(e['zy'] + by)
            z = 2

            def add(x, y, f):
                m.rect(zx + x * z, zy + y * z, z, z, f)
            if k < 0.34:
                add(0, 0, C[0])
                for x, y in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    add(x, y, C[1])
            elif k < 0.68:
                add(0, 0, C[1])
                for x, y in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    add(x, y, C[4]); add(2 * x, 2 * y, C[2])
                for x, y in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
                    add(x, y, C[2])
            else:
                for x, y in ((2, 1), (-2, 1), (1, -2), (-1, 2), (3, 0), (-3, 0), (0, 3), (0, -3)):
                    add(x, y, C[3])
                add(0, 0, C[2])
