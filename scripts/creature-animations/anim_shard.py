# -*- coding: utf-8 -*-
"""Gemeinsamer Hilfscode der Gruppe „Soul Shards“ (Skelette mit Tier-/Götterköpfen, MotiveEgypt) — baut auf anim_lib/anim_amorph auf.

    lid(fig, pix, lid_aus, eigen)                   Blinzeln: Augenpixel (y, x auf der Leinwand) werden zur umgebenden Körperfarbe (Lid)
    ebene_atmung(teil, doppeln, h, w, pad_l, pad_t, boden)
                                                    Rippenkorb-Atmung einer Teilebene: Zeilen werden mit Texturmischung eingefügt (A.koerper_pose);
                                                    gibt (Ebene, y der obersten Quellzeile, Quellzeilen je Ausgabezeile) zurück
    teil_starr(fig, pixel, dx, dy, fuell)           ein Pixelmenge (y, x) starr um (dx, dy) verschieben; freigelegte Felder bekommen die Farbe aus `fuell`
    sinus_stufen(i, n, versatz, schwelle)           Phase → Stufen (-1, 0, +1) für ganzzahlige Pendelbewegungen
"""
import math

import numpy as np

import anim_lib as L
import anim_amorph as A


def lid(fig, pix, lid_aus, eigen=None, rad=(2, 3)):
    """Blinzeln: jedes Augenpixel (y, x) von `pix` bekommt die häufigste Körperfarbe im Umkreis von 2–3 px (ohne Farben aus `lid_aus`, ohne `eigen`
    = alle Augenpixel). Lid = umgebende Körperfarbe, nichts Neues."""
    out = fig.copy()
    h, w = fig.shape[:2]
    eigen = set(eigen) if eigen is not None else set(pix)
    for (y, x) in pix:
        for r in rad:
            cnt, dist = {}, {}
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    yy, xx = y + dy, x + dx
                    if not (0 <= yy < h and 0 <= xx < w) or not fig[yy, xx, 3] or (yy, xx) in eigen:
                        continue
                    c = tuple(int(v) for v in fig[yy, xx, :3])
                    if c in lid_aus:
                        continue
                    cnt[c] = cnt.get(c, 0) + 1
                    dist[c] = min(dist.get(c, 9), max(abs(dy), abs(dx)))
            if cnt:
                out[y, x, :3] = max(cnt, key=lambda q: (cnt[q], -dist[q]))
                out[y, x, 3] = 255
                break
    return out


def ebene_atmung(teil, doppeln, h, w, pad_l, pad_t, boden):
    """Teilebene (Sprite-Format, nur Pixel dieses Teils) mit eingefügten Zeilen `doppeln` ({Quellzeile: Kopien} oder Menge) auf die Leinwand legen.
    Die Unterkante bleibt am Boden, die Oberkante wandert (Atmen: Brust hebt sich). Rückgabe: (Ebene h×w, y der obersten Quellzeile, Quellzeilen je Ausgabezeile)."""
    sh = teil.shape[0]
    k = A.zeilen_von(teil, 0, sh - 1, h, w, pad_l, pad_t)
    z, quelle = A.koerper_pose(k, doppeln=doppeln, x0=pad_l)
    ebene, top = A.auf_leinwand(z, h, boden, 0)
    return ebene, top, quelle


def teil_starr(fig, pixel, dx, dy, fuell):
    """Die Pixel `pixel` (Liste (y, x) auf der Leinwand) starr um (dx, dy) verschieben, ohne sie zu verformen. Zuerst werden ihre alten Felder mit `fuell(y, x)`
    gefüllt (None = leer), danach die Pixel an den neuen Platz gesetzt. ClipError, wenn etwas aus der Leinwand ragt."""
    out = fig.copy()
    h, w = fig.shape[:2]
    cols = [(y, x, fig[y, x].copy()) for (y, x) in pixel]
    for (y, x, _) in cols:
        f = fuell(y, x)
        if f is None:
            out[y, x] = 0
        else:
            out[y, x, :3] = f
            out[y, x, 3] = 255
    for (y, x, c) in cols:
        if not (0 <= y + dy < h and 0 <= x + dx < w):
            raise L.ClipError(f'Teil würde bei ({x + dx},{y + dy}) aus der Leinwand {w}×{h} ragen')
        out[y + dy, x + dx] = c
    return out


def sinus_stufen(i, n, versatz=0.0, schwelle=0.5):
    """Ganzzahlige Pendelstufe −1/0/+1 aus einem Sinus mit Periode n Frames (|sin| ≥ schwelle → ±1)."""
    v = math.sin(2 * math.pi * i / n + versatz)
    return 1 if v >= schwelle else -1 if v <= -schwelle else 0


def sprite_farben(spr):
    return {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}


def maske_farben(spr, *farben):
    """Bool-Maske der Pixel mit einer der Farben (nur deckende)."""
    m = np.zeros(spr.shape[:2], bool)
    for c in farben:
        m |= (spr[..., :3] == np.array(c)).all(axis=2)
    return m & (spr[..., 3] > 0)


# ── Schlangenglieder: dünne Gliedmaßen (Bandagen), die sich wellenförmig bewegen ──────────────────────────────────────

def _linie(a, b):
    """Pixel einer 8-verbundenen Linie zwischen a=(y, x) und b=(y, x) ohne die Endpunkte."""
    (y0, x0), (y1, x1) = a, b
    n = max(abs(y1 - y0), abs(x1 - x0))
    out = []
    for k in range(1, n):
        out.append((int(round(y0 + (y1 - y0) * k / n)), int(round(x0 + (x1 - x0) * k / n))))
    return out


class Glied:
    """Dünnes, schlangenartiges Glied (heller Kern + 1 px Umriss). Der Kern wird ab `wurzel` per Breitensuche (8-verbunden) in Wellenfronten (Tiefe t) zerlegt;
    jede Wellenfront wird als Ganzes um einen Vektor senkrecht zum Gliedverlauf verschoben (laufende Welle, Wurzel fest). Lücken zwischen Nachbarfronten
    schließen Linienpixel (Kernfarbe), der Umriss wird um den neuen Kern neu gezogen (4 Nachbarn, wie im Original) — das Glied bleibt 4-verbunden, ohne Lücken.
    pixel: Menge (y, x) aller Pixel des Glieds im Sprite (Kern + Umriss); wurzel: (y, x) eines Kernpixels am Körper."""

    def __init__(self, spr, pixel, wurzel, dunkel=((0, 0, 0), (12, 12, 12)), umriss=(12, 12, 12)):
        self.spr = spr
        self.pixel = set(pixel)
        self.umriss = umriss
        dunkel = {tuple(d) for d in dunkel}
        self.kern = {p for p in self.pixel if tuple(int(v) for v in spr[p[0], p[1], :3]) not in dunkel}
        assert wurzel in self.kern, wurzel
        tiefe = {wurzel: 0}
        order = [wurzel]
        for p in order:
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    q = (p[0] + dy, p[1] + dx)
                    if q in self.kern and q not in tiefe:
                        tiefe[q] = tiefe[p] + 1
                        order.append(q)
        assert len(tiefe) == len(self.kern), ('Kern nicht zusammenhängend', sorted(self.kern - set(tiefe)))
        self.tiefe = tiefe
        self.nmax = max(tiefe.values())
        self.fronten = [[p for p in self.kern if tiefe[p] == t] for t in range(self.nmax + 1)]
        mitte = [(sum(p[0] for p in f) / len(f), sum(p[1] for p in f) / len(f)) for f in self.fronten]
        self.normale = []
        for t in range(self.nmax + 1):
            a, b = mitte[max(0, t - 2)], mitte[min(self.nmax, t + 2)]
            ty, tx = b[0] - a[0], b[1] - a[1]
            n = math.hypot(ty, tx) or 1.0
            ty, tx = ty / n, tx / n
            self.normale.append((-ty, tx))          # (ny, nx): Tangente um 90° gedreht

    def versatz(self, amp, phase, kappa, ramp=0.45, expo=1.0):
        """Verschiebung (dy, dx) je Wellenfront: round(A(t)·sin(phase − κ·t) · Normale); A(t) wächst von 0 (Wurzel) auf amp."""
        out = []
        for t in range(self.nmax + 1):
            a = amp * min(1.0, t / max(1.0, ramp * self.nmax)) ** expo
            s = a * math.sin(phase - kappa * t)
            ny, nx = self.normale[t]
            out.append((int(round(s * ny)), int(round(s * nx))))
        return out

    def ruhe(self, versatze):
        return all(v == (0, 0) for v in versatze)

    def zeichne(self, h, w, oy, ox, versatze, neu_zeichnen=False):
        """RGBA-Ebene h×w; Spritepixel (y, x) landet bei (y + oy + dy, x + ox + dx). Bei Ruhe (alle Versätze 0) das Original."""
        e = L.leer(h, w)
        if self.ruhe(versatze) and not neu_zeichnen:
            for (y, x) in self.pixel:
                e[y + oy, x + ox] = self.spr[y, x]
            return e
        neu = {}
        for t, f in enumerate(self.fronten):
            dy, dx = versatze[t]
            for (y, x) in f:
                neu[(y + dy, x + dx)] = tuple(int(v) for v in self.spr[y, x, :3])
        # Lücken zwischen Nachbarfronten schließen (8-verbunden)
        for p in self.kern:
            for dy0 in (-1, 0, 1):
                for dx0 in (-1, 0, 1):
                    q = (p[0] + dy0, p[1] + dx0)
                    if q in self.kern and self.tiefe[q] == self.tiefe[p] + 1:
                        a = (p[0] + versatze[self.tiefe[p]][0], p[1] + versatze[self.tiefe[p]][1])
                        b = (q[0] + versatze[self.tiefe[q]][0], q[1] + versatze[self.tiefe[q]][1])
                        if max(abs(a[0] - b[0]), abs(a[1] - b[1])) > 1:
                            lin = _linie(a, b)
                            for k, r in enumerate(lin):
                                src = p if k < len(lin) / 2 else q
                                neu.setdefault(r, tuple(int(v) for v in self.spr[src[0], src[1], :3]))
        for (y, x), c in neu.items():
            e[y + oy, x + ox, :3] = c
            e[y + oy, x + ox, 3] = 255
        for (y, x) in list(neu):
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):          # Umriss: 4 Nachbarn (wie im Original-Sprite)
                r = (y + dy, x + dx)
                if r not in neu:
                    e[r[0] + oy, r[1] + ox, :3] = self.umriss
                    e[r[0] + oy, r[1] + ox, 3] = 255
        return e
