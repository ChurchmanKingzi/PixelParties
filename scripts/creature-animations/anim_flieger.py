# -*- coding: utf-8 -*-
"""Gemeinsamer Hilfscode der Gruppe „Flieger“ (geflügelte/fliegende Creatures) — baut auf anim_lib auf.

Bausteine, die bei mehreren Fliegern gebraucht werden:

    ebene(spr, maske, h, w, pad_l, pad_t)      Teil des Sprites ausschneiden und sofort auf die volle Leinwand legen
    ergaenzen(spr, {(x, y): farbe})            fertiggezeichnete Pixel einsetzen → (Sprite-Kopie, Maske der Pixel)
    farbe_von(spr, x, y)                       RGB eines Sprite-Pixels (damit Farben nie „erfunden“ werden)
    spalte_dy(ebene, pivot_x, amp, ph, x, …)   Versatz einer Flügelspalte (gleiche Rechnung wie L.spalten_welle) — für
                                               starre Anbauteile (Edelstein, Spange), die auf dem Flügel mitwandern
    setze(ebene, pad_l, pad_t, {(x, y): farbe}, dy=0)   einzelne Pixel überschreiben (Blinzeln, Glanz, Funkeln)
    glanz_pfad(i, n, start, pfad, laenge)      welche Pfadpunkte zum Frame i „aufglänzen“ (Lichtreflex wandert an einer Linie entlang)
"""
import math

import numpy as np

import anim_lib as L


def farbe_von(spr, x, y):
    return tuple(int(v) for v in spr[y, x, :3])


def ebene(spr, maske, h, w, pad_l, pad_t):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, h, w, pad_l, pad_t)


def ergaenzen(spr, pixel):
    """Pixel {(x, y): (r, g, b)} deckend einsetzen. Gibt (Kopie, Maske der eingesetzten Pixel) zurück."""
    out = spr.copy()
    m = np.zeros(spr.shape[:2], bool)
    for (x, y), c in pixel.items():
        out[y, x, :3] = c
        out[y, x, 3] = 255
        m[y, x] = True
    return out, m


def spalte_dy(a, pivot_x, amp, phase, x, potenz=1.0, bias=0.0, lauf=0.0):
    """Senkrechter Versatz der Spalte x — exakt die Rechnung von L.spalten_welle (gleiches maxd aus der Ebene `a`)."""
    h, w = a.shape[:2]
    maxd = max(1, max(abs(c - pivot_x) for c in range(w) if a[:, c, 3].any()))
    frac = abs(x - pivot_x) / maxd
    return int(round((amp * math.sin(phase - lauf * frac) + bias) * frac ** potenz))


def setze(a, pad_l, pad_t, pixel, dy=0):
    """Pixel {(x, y): (r, g, b)} (Sprite-Koordinaten) auf der Leinwand überschreiben; die Ebene muss dort schon Pixel haben
    oder das Ziel liegt auf der Leinwand (kein Abschneiden)."""
    for (x, y), c in pixel.items():
        a[pad_t + y + dy, pad_l + x, :3] = c
        a[pad_t + y + dy, pad_l + x, 3] = 255
    return a


def glanz_pfad(i, n, start, pfad, laenge=2):
    """Index-Liste der Pfadpunkte, die im Frame i leuchten: ein Lichtreflex der Länge `laenge` wandert ab Frame `start`
    einen Punkt pro Frame den Pfad entlang und ist dann weg, bis die Schleife wieder bei `start` ankommt."""
    k = (i - start) % n
    return [j for j in range(len(pfad)) if 0 <= k - j < laenge]
