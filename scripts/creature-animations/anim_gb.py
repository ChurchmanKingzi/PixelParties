# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der „Guardian Beasts“ (Gou, Hou, Hu, Ji, Long, Ma) — kleine Pixelfiguren (20–37 px) mit Rüstung/Robe.

Baut auf anim_lib / anim_humanoide auf (nur ganze Pixel, kein Alpha, nur Quellfarben). Nichts hier ändert fremde Module.

    sz = Szene(slug, (pad_l, pad_r, pad_t, pad_b))      Sprite laden, Leinwand + Versatz festlegen
    sz.f(x, y)                                          Farbe (RGB-Tupel) des Sprite-Pixels
    sz.maske(x0, y0, x1, y1, farben=None)               Maske (inkl. Grenzen) der vorhandenen Sprite-Pixel, optional nur bestimmte Farben
    sz.ebene(m, dx=0, dy=0)                             Teilebene auf voller Leinwand (Sprite-Koordinaten + Rand)
    sz.setze(a, {(x,y): farbe})                         Pixel in Sprite-Koordinaten setzen (None = löschen)
    sz.zeilen(a, {y: dx})                               ganze Zeilen waagerecht verschieben (Sprite-Zeilen)
    sz.bereich(a, {y: dx}, x0, x1)                      wie zeilen, nur x0 ≤ x ≤ x1
    sz.atmen(layers, naht, n)                           Zeile `naht` (Sprite-Zeile) n-mal zusätzlich einfügen: alles darüber steigt n px
    sz.kontur(fig, farbe)                               Randpixel in Nicht-Umrissfarbe auf `farbe` setzen (Regel 16)
    abschluss(sz, frames, slug, karte, ms, prev, n_loop, extra=None, rampen=...)   Pflichtprüfungen + Speichern + Vorschau
"""
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
        self.PL, self.PR, self.PT, self.PB = pad
        self.H, self.W = self.sh + self.PT + self.PB, self.sw + self.PL + self.PR
        self.off = (self.PL, self.PT)
        self.yy, self.xx = np.mgrid[0:self.sh, 0:self.sw]
        self.vorhanden = L.deckend(self.spr)
        self.erlaubt = Hm.umrissfarben(self.spr)

    def f(self, x, y):
        return tuple(int(v) for v in self.spr[y, x, :3])

    def maske(self, x0, y0, x1, y1, farben=None):
        m = self.vorhanden & (self.xx >= x0) & (self.xx <= x1) & (self.yy >= y0) & (self.yy <= y1)
        if farben is not None:
            fm = L.farbmaske(self.spr, farben)
            m &= fm
        return m

    def punkte(self, pts):
        m = np.zeros((self.sh, self.sw), bool)
        for (x, y) in pts:
            if self.vorhanden[y, x]:
                m[y, x] = True
        return m

    def ebene(self, m, dx=0, dy=0):
        t, _ = L.trenne(self.spr, m)
        return L.platz(t, self.H, self.W, self.PL + dx, self.PT + dy)

    def setze(self, a, pixel):
        return Hm.setze(a, pixel, self.off)

    def zeilen(self, a, dd):
        return Hm.zeilen_versatz(a, self.off, dd)

    def bereich(self, a, dd, x0, x1):
        return Hm.bereich_versatz(a, self.off, dd, x0, x1)

    def atmen(self, layers, naht, n):
        """Zeile `naht` (Sprite-Zeile) wird n-mal zusätzlich in jede Ebene eingefügt; alles darüber steigt n px (Füße bleiben)."""
        if not n:
            return layers
        return [L.streck_zeile(a, self.PT + naht, n) for a in layers]

    def kontur(self, fig, farbe):
        kk = Hm.kantenmaske(fig)
        for y, x in zip(*np.nonzero(kk)):
            c = tuple(int(v) for v in fig[y, x, :3])
            if c not in self.erlaubt:
                fig[y, x, :3] = farbe
        return fig

    def kontur_ebenen(self, fig, ebenen, standard):
        """Wie kontur, aber je Teilebene eine eigene Umrissfarbe: `ebenen` = [(Ebene, farbe), …] (erste mit deckendem Pixel gewinnt),
        sonst `standard`. Für Teile mit eigener Kontur (Flügel mit olivgoldenem Rand, Körper mit dunkelbraunem Umriss)."""
        kk = Hm.kantenmaske(fig)
        for y, x in zip(*np.nonzero(kk)):
            c = tuple(int(v) for v in fig[y, x, :3])
            if c in self.erlaubt:
                continue
            farbe = standard
            for eb, fb in ebenen:
                if eb[y, x, 3]:
                    farbe = fb
                    break
            fig[y, x, :3] = farbe
        return fig


def abschluss(sz, frames, slug, karte, ms, prev, rampen=(), erlaubt=(), extra=None, ruhe0=None, strip_scale=6):
    """Pflichtprüfungen (Ruhepose, L.pruefe, Eckkontakte) und Speichern; Vorschau-GIF + Kontaktbogen nach `prev`."""
    diff = Hm.ruhepose(frames[0] if ruhe0 is None else ruhe0, sz.spr, sz.off)      # ruhe0: Frame 0 nur des Körpers (Figuren mit neu gezeichnetem Feuer)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=sz.spr, erlaubt=erlaubt)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern(slug, karte, frames, ms, prev, extra=extra)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/' + slug + '-strip.png', frames, spalten=12, scale=strip_scale)
