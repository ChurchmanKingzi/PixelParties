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
    kacheln(frames, x0, x1, y0, y1, sc)        Ausschnitt mehrerer Frames nebeneinander, ganzzahlig vergrößert (Nahaufnahme für Nähte)
    stapeln(bilder)                            PIL-Bilder untereinander zu einem Kontrollbild
"""
import math

import numpy as np
from PIL import Image

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


def spalte_dy(a, pivot_x, amp, phase, x, potenz=1.0, bias=0.0, lauf=0.0, nur_rechts=None):
    """Senkrechter Versatz der Spalte x — exakt die Rechnung von L.spalten_welle (gleiches maxd aus der Ebene `a`)."""
    h, w = a.shape[:2]
    maxd = max(1, max(abs(c - pivot_x) for c in range(w) if a[:, c, 3].any()))
    d = x - pivot_x
    if nur_rechts is True and d < 0 or nur_rechts is False and d > 0:
        return 0
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


def kacheln(frames, x0, x1, y0, y1, sc, hintergrund=(40, 30, 70)):
    """Ausschnitt [x0,x1)×[y0,y1) (Leinwandkoordinaten) jedes Frames nebeneinander, Nächster-Nachbar um `sc` vergrößert."""
    tiles = []
    for f in frames:
        c = f[y0:y1, x0:x1]
        bg = Image.new('RGBA', (c.shape[1], c.shape[0]), hintergrund + (255,))
        bg.alpha_composite(Image.fromarray(c.astype(np.uint8)))
        tiles.append(bg.resize((c.shape[1] * sc, c.shape[0] * sc), Image.NEAREST).convert('RGB'))
    w = sum(t.width + 6 for t in tiles) - 6
    out = Image.new('RGB', (w, tiles[0].height), (12, 10, 20))
    x = 0
    for t in tiles:
        out.paste(t, (x, 0))
        x += t.width + 6
    return out


def stapeln(bilder):
    w = max(b.width for b in bilder)
    h = sum(b.height + 8 for b in bilder) - 8
    out = Image.new('RGB', (w, h), (12, 10, 20))
    y = 0
    for b in bilder:
        out.paste(b, (0, y))
        y += b.height + 8
    return out
