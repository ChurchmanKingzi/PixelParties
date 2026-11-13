# -*- coding: utf-8 -*-
"""Gemeinsame Hilfen der Gruppe „n4“ (Neubau-Welle 3: Black Marketeer, Front Soldier, Gerrymander, Haressassin, Informant, Mimic …).

Baut nur auf anim_lib / anim_humanoide / anim_textur auf (diese Module bleiben unverändert).

    Figur(slug, pads)                 Sprite laden, Leinwandmaße (H, W, OFF), f(x, y) = RGB eines Quellpixels
    fig.ebene(maske, dx, dy)          Teil des Sprites (Maske in Spritekoordinaten) auf die volle Leinwand legen
    fig.schliessen(a, farbe_fn)       Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (farbe_fn(x, y) in Spritekoordinaten)
    funkeln(a, x, y, k, kern, arm, off)   kurzer Sparkle (Regel 34): k = 0 Mitte, 1 Kreuz, 2 Mitte, sonst nichts – nur an Metall/Gold/Edelstein
    starr(a, off, maske, dx, dy)      Pixel einer Maske (Spritekoordinaten) auf der Leinwand als starre Einheit verschieben (Arm + Hand + Gegenstand)
    abschluss(...)                    Ruhepose-/Farb-/Rand-/Eckkontakt-Kontrolle, Sheet + JSON + GIF + Kontaktbogen
"""
import os
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L


class Figur:
    def __init__(self, slug, pad_l, pad_r, pad_t, pad_b):
        self.slug = slug
        self.spr = L.lade(slug)
        self.sh, self.sw = self.spr.shape[:2]
        self.PL, self.PR, self.PT, self.PB = pad_l, pad_r, pad_t, pad_b
        self.H, self.W = self.sh + pad_t + pad_b, self.sw + pad_l + pad_r
        self.OFF = (pad_l, pad_t)
        self.yy, self.xx = np.mgrid[0:self.sh, 0:self.sw]
        self.da = L.deckend(self.spr)
        self.erlaubt = Hm.umrissfarben(self.spr)

    def f(self, x, y):
        return tuple(int(v) for v in self.spr[y, x, :3])

    def ebene(self, maske=None, dx=0, dy=0, quelle=None):
        q = self.spr if quelle is None else quelle
        t = q if maske is None else L.trenne(q, maske)[0]
        return L.platz(t, self.H, self.W, self.PL + dx, self.PT + dy)

    def schliessen(self, a, farbe_fn, maske=None):
        kk = Hm.kantenmaske(a)
        for y, x in zip(*np.nonzero(kk)):
            if maske is not None and not maske[y, x]:
                continue
            c = tuple(int(v) for v in a[y, x, :3])
            if c not in self.erlaubt:
                a[y, x, :3] = farbe_fn(x - self.PL, y - self.PT)
        return a


def funkeln(a, x, y, k, kern, arm, off=(0, 0)):
    """Kurzer Sparkle am Objekt: k = 0 → 1 Pixel (Mitte), k = 1 → Kreuz (Mitte + 4 Arme), k = 2 → 1 Pixel; None/sonst → nichts."""
    if k is None or k not in (0, 1, 2):
        return a
    return Hm.stern4(a, x, y, 1 if k == 1 else 0, kern, arm, None, off)


def starr(a, off, maske, dx, dy):
    """Die Leinwandpixel unter `maske` (Spritekoordinaten, bool sh×sw) als starre Einheit um (dx, dy) verschieben. Gibt (rest, teil) zurück:
    rest = Leinwand ohne das Teil (Lücke bleibt leer – vorher/nachher fertigzeichnen), teil = verschobenes Teil."""
    h, w = a.shape[:2]
    m = np.zeros((h, w), bool)
    m[off[1]:off[1] + maske.shape[0], off[0]:off[0] + maske.shape[1]] = maske
    teil, rest = L.trenne(a, m & (a[..., 3] > 0))
    return rest, L.versetze(teil, dx, dy)


def abschluss(fig, karte, frames, ms, argv, spalten=12, scale=6, erlaubt=(), extra=None, strip=True):
    prev = argv[argv.index('--preview') + 1] if '--preview' in argv else None
    diff = Hm.ruhepose(frames[0], fig.spr, fig.OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=fig.spr, erlaubt=erlaubt)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern(fig.slug, karte, frames, ms, prev, extra=extra)
    if prev and strip:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/' + fig.slug + '-strip.png', frames, spalten=spalten, scale=scale)
