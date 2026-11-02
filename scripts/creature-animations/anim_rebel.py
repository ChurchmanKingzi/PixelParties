# -*- coding: utf-8 -*-
"""Gemeinsame Hilfen der Gruppe „Rebelliokai“ (japanische Yokai: Bakus, Kappa, Kirin, Kitsune, Oni, Tengu, Tanuki) und Tuscan Mystic.

Baut auf anim_lib / anim_humanoide auf (beide unverändert). Alles auf der VOLLEN Leinwand (anim_lib wirft ClipError, nichts wird abgeschnitten),
nur ganze Pixel, nur Farben des Sprites, kein Alpha.

    farbe(spr, x, y)                       RGB-Tupel des Sprite-Pixels
    teil(spr, maske, H, W, off, dy=0)      Ebene aus den Pixeln der Maske (Spritekoordinaten) auf der Leinwand (Versatz off + dy)
    burst(i, n, start, laenge, schwingungen)   0 außerhalb des Fensters; im Fenster sin(2π·s·t)·sin²(π·t) (Frame 0 neutral, weicher Ein-/Auslauf), nahtlos über n
    huellkurve(i, n, start, laenge)        0…1…0 (sin²) im Fenster [start, start+laenge) mod n
    schritte(i, n, start, werte)           werte[k] im Frame start+k (mod n), sonst 0
    sprite_pixel(a, off, {(x, y): c})      Pixel setzen (None löscht)
    zeilen_pendel(teil, pivot_y, amp, phase, …)  wie L.zeilen_welle, aber mit „lauf“ (Phasenverzögerung nach unten)
    spalten_pendel(teil, pivot_x, amp, phase, …) wie L.spalten_welle
    kontur_zu(fig, erlaubt, farbe)         Randpixel in Nicht-Umrissfarbe → Umrissfarbe (Regel 16)
    verbinde(fig)                          Teile, die nur über eine Ecke zusammenhängen, mit Brückenpixeln 4-verbinden (anim_amorph.verbinde4)
    abschluss(...)                         Standardprüfungen + Speichern + Vorschau + Check-Bild (Schlüsselposen, ≥ 10-fach)
"""
import math
import os
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L


def farbe(spr, x, y):
    return tuple(int(v) for v in spr[y, x, :3])


def teil(spr, maske, H, W, off, dy=0, dx=0):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, off[0] + dx, off[1] + dy)


def huellkurve(i, n, start, laenge):
    k = (i - start) % n
    if k >= laenge:
        return 0.0
    return math.sin(math.pi * (k + 0.5) / laenge) ** 2


def burst(i, n, start, laenge, schwingungen=2.0):
    """Schwingung im Fenster [start, start+laenge) (mod n): sin(2π·s·t)·sin²(πt), t = (i-start)/laenge. Außerhalb 0; an den Rändern 0 (nahtlos, Ruhepose in Frame 0, wenn start > 0)."""
    k = (i - start) % n
    if k >= laenge:
        return 0.0
    t = k / float(laenge)
    return math.sin(2 * math.pi * schwingungen * t) * math.sin(math.pi * t) ** 2


def schritte(i, n, start, werte):
    k = (i - start) % n
    return werte[k] if 0 <= k < len(werte) else 0


def sprite_pixel(a, off, pixel):
    return Hm.setze(a, pixel, off)


def zeilen_pendel(a, pivot_y, amp, phase, potenz=1.0, lauf=0.0, richtung=1):
    """Jede Zeile wandert waagerecht um round(amp·frac^potenz·sin(phase − lauf·frac)); frac = Abstand/maxAbstand vom Pivot (richtung 1 = unterhalb, -1 = oberhalb).
    Der Unterschied benachbarter Zeilen bleibt klein, so reißt nichts ab. Nur Pixel auf der gegebenen Seite des Pivots bewegen sich."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    zeilen = [y for y in range(h) if a[y, :, 3].any() and (y - pivot_y) * richtung >= 0]
    maxd = max(1, max((abs(y - pivot_y) for y in zeilen), default=1))
    for y in range(h):
        xs = np.nonzero(a[y, :, 3])[0]
        if not len(xs):
            continue
        if (y - pivot_y) * richtung < 0:
            dx = 0
        else:
            frac = abs(y - pivot_y) / maxd
            dx = int(round(amp * (frac ** potenz) * math.sin(phase - lauf * frac)))
        if xs.min() + dx < 0 or xs.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs:
            out[y, x + dx] = a[y, x]
    return out


def spalten_pendel(a, pivot_x, amp, phase, potenz=1.0, lauf=0.0, seite=0, bias=0.0):
    """Jede Spalte wandert senkrecht um round((amp·sin(phase − lauf·frac) + bias)·frac^potenz); seite 0 = beide Seiten des Pivots, +1 nur rechts, -1 nur links."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    spalten = [x for x in range(w) if a[:, x, 3].any() and (seite == 0 or (x - pivot_x) * seite >= 0)]
    maxd = max(1, max((abs(x - pivot_x) for x in spalten), default=1))
    for x in range(w):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        if seite != 0 and (x - pivot_x) * seite < 0:
            dy = 0
        else:
            frac = abs(x - pivot_x) / maxd
            dy = int(round((amp * math.sin(phase - lauf * frac) + bias) * (frac ** potenz)))
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


def kontur_zu(fig, erlaubt, farbe_):
    return Hm.kontur_schliessen(fig, erlaubt, farbe_)


def verbinde(fig):
    import anim_amorph as A
    out, brueck = A.verbinde4(fig)
    return out, brueck


def schluessel_frames(frames, n_bilder=8):
    """Gleichmäßig gestreute Frame-Indizes für das Check-Bild."""
    n = len(frames)
    return sorted({int(round(k * (n - 1) / max(1, n_bilder - 1))) for k in range(n_bilder)})


def abschluss(slug, karte, frames, ms, spr, off, prev, extra_erlaubt=(), face_x=None, extra=None, nahaufnahmen=None, check_frames=None,
              check_scale=10):
    """Standardprüfungen (Ruhepose, L.pruefe, Eckkontakte), Speichern (+ GIF, Streifen) und das Check-Bild."""
    diff = Hm.ruhepose(frames[0], spr, off)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr, erlaubt=extra_erlaubt)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern(slug, karte, frames, ms, prev, face_x=face_x, extra=extra)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + f'/{slug}-strip.png', frames, spalten=12, scale=max(3, min(8, 200 // max(frames[0].shape[:2]))))
        idx = check_frames or schluessel_frames(frames, 8)
        Hm.kontaktbogen(prev + f'/{slug}-check.png', frames, idx, scale=check_scale)
        if nahaufnahmen:
            for k, (nm, box, fr) in enumerate(nahaufnahmen):
                Hm.kontaktbogen(prev + f'/{slug}-{nm}.png', frames, fr, scale=max(14, check_scale + 6), ausschnitt=box)
    return n


def vorschau_arg():
    return sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
