# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe n3 (Greatmaw-Haie, Piranhas, Angler Angel, Cybug Centipede/Rhinoceros/Scarab).
Baut auf anim_lib auf, ändert es nicht. Alles Pixelart: nur ganze Pixel, kein Alpha, nur Quellfarben.

    sinz(i, per, ph)                       # sin über eine Periode von `per` Frames
    Buehne(spr, pad)                       # Leinwand mit Rand; teil(maske) legt eine Ebene sofort auf die volle Leinwand
    gleiten(i, n, ax, ay, ...)             # ganzzahliger Versatz der GANZEN Figur (weiches Schwimmen/Treiben), bei Frame 0 genau (0, 0)
    scher_spalten(a, pivot_x, spitze, seite)   # saubere Flossen-/Schwanzpose: Spalten jenseits des Gelenks wandern senkrecht, Gefälle ≤ 1 px je Spalte,
                                               # jede Spalte bleibt, wie sie ist (nichts wird gestreckt, kein Umriss wird dicker)
    scher_zeilen(a, pivot_y, spitze, seite)    # dasselbe für hängende/aufragende Teile (Zeilen wandern waagerecht)
    pose(i, per, stufen, ph)               # gehaltene Posen statt Sinus-Gummi: Sinus auf ganze Stufen gerastet
    zuschneiden(frames, rand)              # alle Frames gemeinsam auf die Figur zuschneiden (Randabstand `rand`)
    loecher(frame, erlaubt)                # Testhilfe: von außen nicht erreichbare transparente Pixel (Lücken in der Figur)
"""
import math

import numpy as np

import anim_lib as L


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


def pose(i, per, stufen, ph=0.0, scharf=1.0):
    """Sinus der Periode `per`, auf ganze Stufen −stufen…+stufen gerastet, bei Frame 0 gleich 0 (ph verschiebt die übrigen Frames nicht:
    gemessen gegen Frame 0). scharf > 1 hält die Endposen länger (Flossenschlag mit Halt), bleibt aber weich im Übergang."""
    def f(k):
        s = math.sin(2 * math.pi * k / per + ph)
        s = math.copysign(abs(s) ** (1.0 / scharf), s)
        return s
    return int(round(stufen * (f(i) - f(0))))


def gleiten(i, n, ax=1.5, ay=1.0, kx=1, ky=1, phx=0.0, phy=0.0):
    """Weiches Treiben der ganzen Figur: (dx, dy) ganzzahlig, Schleife über n Frames, Frame 0 = (0, 0)."""
    dx = ax * (math.sin(2 * math.pi * kx * i / n + phx) - math.sin(phx))
    dy = ay * (math.sin(2 * math.pi * ky * i / n + phy) - math.sin(phy))
    return int(round(dx)), int(round(dy))


class Buehne:
    def __init__(self, spr, pad_l, pad_r, pad_t, pad_b):
        self.spr = spr
        self.sh, self.sw = spr.shape[:2]
        self.pl, self.pt = pad_l, pad_t
        self.H, self.W = self.sh + pad_t + pad_b, self.sw + pad_l + pad_r
        self.yy, self.xx = np.mgrid[0:self.sh, 0:self.sw]
        self.da = L.deckend(spr)

    def teil(self, maske):
        t, _ = L.trenne(self.spr, maske & self.da)
        return L.platz(t, self.H, self.W, self.pl, self.pt)

    def leer(self):
        return L.leer(self.H, self.W)

    def setze(self, a, x, y, farbe):
        a[self.pt + y, self.pl + x, :3] = farbe
        a[self.pt + y, self.pl + x, 3] = 255

    def loesche(self, a, x, y):
        a[self.pt + y, self.pl + x] = 0


def scher_spalten(a, pivot_x, spitze, seite=1, potenz=1.0, ende=None):
    """Spalten auf der Seite `seite` (+1 rechts, −1 links) des Gelenks pivot_x wandern senkrecht um round(spitze · (Abstand/Länge)^potenz).
    Spalten diesseits des Gelenks bleiben stehen. `ende`: Spalte, an der der volle Ausschlag erreicht ist (Standard: äußerste belegte)."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    cols = [x for x in range(w) if a[:, x, 3].any()]
    if not cols:
        return out
    aussen = ende if ende is not None else (max(cols) if seite > 0 else min(cols))
    laenge = max(1, abs(aussen - pivot_x))
    for x in cols:
        d = (x - pivot_x) * seite
        dy = 0
        if d > 0:
            dy = int(round(spitze * min(1.0, d / laenge) ** potenz))
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand geschoben')
        out[ys + dy, x] = a[ys, x]
    return out


def stufen_spalten(a, stufen, schritt=1):
    """Handgesetzte Pose: ab jeder Spalte in `stufen` (Leinwand-x, aufsteigend; bei negativen Werten: bis einschließlich |x| von rechts her)
    wandern alle Spalten rechts davon um `schritt` weiter (senkrecht). So fallen die Stufen der Scherung auf Stellen, an denen der Umriss
    ohnehin stuft (kein Zickzack)."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for x in range(w):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        dy = schritt * sum(1 for s in stufen if (x >= s if s >= 0 else x <= -s))
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand geschoben')
        out[ys + dy, x] = a[ys, x]
    return out


def stufen_zeilen(a, stufen, schritt=1):
    """Wie stufen_spalten, für Zeilen: ab jeder Zeile in `stufen` (negativ: bis einschließlich |y| von unten her) wandern die Zeilen waagerecht."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for y in range(h):
        xs = np.nonzero(a[y, :, 3])[0]
        if not len(xs):
            continue
        dx = schritt * sum(1 for s in stufen if (y >= s if s >= 0 else y <= -s))
        if xs.min() + dx < 0 or xs.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand geschoben')
        out[y, xs + dx] = a[y, xs]
    return out


def scher_zeilen(a, pivot_y, spitze, seite=1, potenz=1.0, ende=None):
    """Zeilen auf der Seite `seite` (+1 unten, −1 oben) des Gelenks pivot_y wandern waagerecht um round(spitze · (Abstand/Länge)^potenz)."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    rows = [y for y in range(h) if a[y, :, 3].any()]
    if not rows:
        return out
    aussen = ende if ende is not None else (max(rows) if seite > 0 else min(rows))
    laenge = max(1, abs(aussen - pivot_y))
    for y in rows:
        d = (y - pivot_y) * seite
        dx = 0
        if d > 0:
            dx = int(round(spitze * min(1.0, d / laenge) ** potenz))
        xs = np.nonzero(a[y, :, 3])[0]
        if xs.min() + dx < 0 or xs.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand geschoben')
        out[y, xs + dx] = a[y, xs]
    return out


def zuschneiden(frames, rand=2):
    """Alle Frames gemeinsam auf die Hülle aller deckenden Pixel zuschneiden (Rand `rand` ringsum)."""
    alle = np.zeros(frames[0].shape[:2], bool)
    for f in frames:
        alle |= f[..., 3] > 0
    ys, xs = np.nonzero(alle)
    y0, y1, x0, x1 = ys.min() - rand, ys.max() + 1 + rand, xs.min() - rand, xs.max() + 1 + rand
    assert y0 >= 0 and x0 >= 0 and y1 <= alle.shape[0] and x1 <= alle.shape[1], 'Bühnenrand zu klein für den Zuschnitt'
    return [f[y0:y1, x0:x1].copy() for f in frames], (x0, y0)


def loecher(frame):
    """Transparente Pixel, die von außen (4er-Nachbarschaft) nicht erreichbar sind → Maske (Lücken in der Figur)."""
    frei = frame[..., 3] == 0
    h, w = frei.shape
    aussen = np.zeros_like(frei)
    stapel = [(y, x) for y in range(h) for x in (0, w - 1) if frei[y, x]] + [(y, x) for x in range(w) for y in (0, h - 1) if frei[y, x]]
    for y, x in stapel:
        aussen[y, x] = True
    while stapel:
        y, x = stapel.pop()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and frei[ny, nx] and not aussen[ny, nx]:
                aussen[ny, nx] = True
                stapel.append((ny, nx))
    return frei & ~aussen


def rand_farben(spr):
    """Farben, die im Quell-Sprite an der Außenkante vorkommen (Umrissfarben)."""
    m = spr[..., 3] > 0
    p = np.pad(m, 1)
    kante = m & ((~p[:-2, 1:-1]) | (~p[2:, 1:-1]) | (~p[1:-1, :-2]) | (~p[1:-1, 2:]))
    return {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(kante))}


def umriss_flicken(frame, rand, farbe, wo=None):
    """Randpixel-Regel: liegt nach einer Scherung ein Innenpixel frei an der Außenkante (4er-Nachbar transparent) und hat keine Umrissfarbe,
    wird es in der Umrissfarbe `farbe` gezeichnet (der Umriss läuft dort eine Stufe weiter; nichts wird dicker, es kommt kein Pixel hinzu).
    wo: optionale Maske, auf die sich das Flicken beschränkt."""
    m = frame[..., 3] > 0
    p = np.pad(m, 1)
    kante = m & ((~p[:-2, 1:-1]) | (~p[2:, 1:-1]) | (~p[1:-1, :-2]) | (~p[1:-1, 2:]))
    if wo is not None:
        kante &= wo
    out = frame
    for y, x in zip(*np.nonzero(kante)):
        if tuple(int(v) for v in frame[y, x, :3]) not in rand:
            out[y, x, :3] = farbe
    return out


def fertig(slug, karte, bild, n, ms, quelle, argv, erlaubt=(), extra=None, schluessel=None):
    """Rendern, zuschneiden, prüfen, speichern (+ Vorschau-GIF und Kontaktbogen, wenn --preview <ordner> übergeben wurde)."""
    frames, _ = zuschneiden([bild(i) for i in range(n)])
    pix = L.pruefe(frames, quelle=quelle, erlaubt=list(erlaubt))
    prev = argv[argv.index('--preview') + 1] if '--preview' in argv else None
    L.speichern(slug, karte, frames, ms, prev, extra=extra)
    if prev:
        ks = schluessel or list(range(0, n, max(1, n // 12)))
        L.streifen(prev + '/' + slug + '-strip.png', [frames[k] for k in ks], spalten=6, scale=max(3, min(8, 220 // max(frames[0].shape[:2]))))
    return frames, pix
