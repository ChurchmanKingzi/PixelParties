# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Krieger“ (War Counselors, Priester, Greis, Aristokrat): gerüstete bzw. bekleidete Humanoide, die auf
anim_humanoide aufbauen. Jede Figur hat ihre eigene Bewegung — dieses Modul enthält nur das, was alle brauchen:

    Szene(slug, pad)            lädt src/<slug>.png, legt die volle Leinwand fest (Rand l, t, r, b), bietet f(x, y), ebene(maske, dx, dy)
    fenster(i, n, start, laenge)  k im Ereignisfenster (nahtlos modulo n) oder None
    huepf(i, n, start, laenge, hoch)  ganzzahliger Ausschlag 0 … hoch … 0 innerhalb eines Fensters (sin), sonst 0 (nahtlos, Frame 0 = 0)
    sinus_int(i, n, amp, versatz)  ganzzahlig gerundete Sinusbewegung (nahtlos)
    gefaelle(zeilen, d)         Zeilenversatz-Wörterbuch {zeile: dx} mit Gefälle ≤ 1 px je Zeile (oben d, nach unten auslaufend auf 0) — Federbusch, Zipfel
    bob(a, zeile, n)            Atmen/Wippen: Zeile `zeile` n-mal zusätzlich einfügen (L.streck_zeile mit Texturmischung); alles darüber steigt
    blinzeln(a, off, {(x, y): lidfarbe})   Augenpixel nehmen die Lidfarbe an
    kontur(a, erlaubt, wahl)    Randpixel in Nicht-Umrissfarbe auf passende Umrissfarbe setzen (Regel 16)
    abschluss(...)              Standard-Hauptprogramm: Ruhepose, L.pruefe, Eckkontakte, Speichern, Kontaktbogen
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import os
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L


class Szene:
    def __init__(self, slug, pad):
        self.slug = slug
        self.spr = L.lade(slug)
        self.sh, self.sw = self.spr.shape[:2]
        self.pl, self.pt, self.pr, self.pb = pad
        self.H, self.W = self.sh + self.pt + self.pb, self.sw + self.pl + self.pr
        self.OFF = (self.pl, self.pt)
        self.yy, self.xx = np.mgrid[0:self.sh, 0:self.sw]
        self.vor = L.deckend(self.spr)
        self.ERLAUBT = Hm.umrissfarben(self.spr)

    def f(self, x, y):
        return tuple(int(v) for v in self.spr[y, x, :3])

    def farben_in(self, region, farben):
        """Maske: Pixel in `region` (bool-Feld), deren Farbe in `farben` steht."""
        m = np.zeros((self.sh, self.sw), bool)
        for y, x in zip(*np.nonzero(region & self.vor)):
            if self.f(x, y) in farben:
                m[y, x] = True
        return m

    def ebene(self, maske, dx=0, dy=0):
        t, _ = L.trenne(self.spr, maske)
        return L.platz(t, self.H, self.W, self.pl + dx, self.pt + dy)

    def leer(self):
        return L.leer(self.H, self.W)

    def rechteck(self, x0, y0, x1, y1):
        """Maske x0 ≤ x ≤ x1, y0 ≤ y ≤ y1 (inklusive)."""
        return (self.xx >= x0) & (self.xx <= x1) & (self.yy >= y0) & (self.yy <= y1)


def fenster(i, n, start, laenge):
    k = (i - start) % n
    return k if 0 <= k < laenge else None


def huepf(i, n, start, laenge, hoch):
    """0 … hoch … 0 innerhalb des Fensters [start, start+laenge) (nahtlos modulo n), außerhalb 0."""
    k = fenster(i, n, start, laenge)
    if k is None:
        return 0
    return int(round(hoch * math.sin(math.pi * (k + 0.5) / laenge)))


def sinus_int(i, n, amp, versatz=0.0):
    return int(round(amp * math.sin(L.sinus(i, n, versatz))))


def gefaelle(zeilen, d):
    """{zeile: dx}: die oberste Zeile wandert um d, nach unten läuft der Versatz auf 0 aus (Gefälle ≤ 1 px je Zeile)."""
    n = len(zeilen)
    return {z: int(round(d * (n - j) / n)) for j, z in enumerate(zeilen)}


def bob(a, zeile, n, mischen=True):
    """Wippen: Leinwandzeile `zeile` wird n-mal zusätzlich eingefügt, alles darüber steigt um n.
    mischen=True: L.streck_zeile (Texturmischung mit der ähnlichsten Nachbarzeile). mischen=False: schlichte Wiederholung — nur für Zeilen ohne
    Textur, deren Nachbarzeile sonst Haut/Edelstein in die Zeile ziehen würde (Hals neben Robe, Juwel neben Robe)."""
    if not n:
        return a
    if mischen:
        return L.streck_zeile(a, zeile, n)
    if a[:n, :, 3].any():
        raise L.ClipError(f'bob würde {n} belegte Zeile(n) am oberen Rand abschneiden')
    h = a.shape[0]
    rows = list(range(zeile)) + [zeile] * (n + 1) + list(range(zeile + 1, h))
    return a[rows[n:]].copy()


def kontur(a, erlaubt, wahl):
    """Regel 16: jedes Randpixel (4-Nachbar leer), dessen Farbe keine Umrissfarbe des Originals ist, bekommt die Farbe wahl(farbe, x, y) — so bleibt die Kontur in jeder Pose geschlossen
    und der neue Umriss passt zur Umgebung (roter Federbusch → dunkles Rot, nicht Schwarz)."""
    kk = Hm.kantenmaske(a)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in a[y, x, :3])
        if c not in erlaubt:
            a[y, x, :3] = wahl(c, x, y)
    return a


def blinzeln(a, off, pixel):
    return Hm.setze(a, pixel, off)


def pixel_loop(frames):
    """Pixelzahl je Frame (für die Kontrolle)."""
    return [int((f[..., 3] > 0).sum()) for f in frames]


def abschluss(sz, frame, N, MS, karte, slug, vorschau=None, extra=None, strip=True):
    frames = [frame(i) for i in range(N)]
    diff = Hm.ruhepose(frames[0], sz.spr, sz.OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=sz.spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern(slug, karte, frames, MS, vorschau, extra=extra)
    if vorschau and strip:
        os.makedirs(vorschau, exist_ok=True)
        L.streifen(vorschau + '/' + slug + '-strip.png', frames, spalten=12, scale=6)
    return frames


def vorschau_pfad():
    return sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
