"""Portierungen echter Spiel-Animationen (Pixelart-Canvas, Trailer-Look) nach Python – Zeile für Zeile aus dem Quelltext des Spiels übernommen:

  • Feuerball      `ppFx30Feuerball`   (public/app-fx-30.jsx)  Aufladen, Flug mit Flammenzungen und Partikelstrom, Einschlag mit Ringen, Strahlen, Funken, Brand und Rauch
  • Kettenblitz    `ppFx28Kettenblitz` (public/app-fx-28.jsx)  gezackter vierschichtiger Blitz mit Abzweigungen, Entladung/Einschlag, Funken, Nachglühen
  • Sandstrahl     `ppFx30Sand`        (public/app-fx-30.jsx)  Körner, Schlieren und Staubkanal von der Düse zum Ziel

Alles in Rasterzellen (Rasterzelle = Pixel des Heroes, hier die Zelle des Hero-Sprites), harte Kanten, feste Palette, 30 Bilder/s, keine Alpha-Überblendung.
Die Zufallszahlen sind (wie im Spiel) ein Ganzzahl-Hash; das `salt` ist hier fest, damit jedes Reel gleich aussieht.
Alle Funktionen malen ein Bild zur Zeit t (Sekunden seit Start der Animation) mit einem `Cells`-Maler auf ein PIL-Bild."""
import math

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
