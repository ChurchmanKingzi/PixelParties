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


def zeilen_pendel(a, pivot_y, amp, phase, potenz=1.0, lauf=0.0, richtung=1, ruhe0=False, versatz=0.0):
    """Jede Zeile wandert waagerecht um round(amp·frac^potenz·sin(phase − lauf·frac)); frac = Abstand/maxAbstand vom Pivot (richtung 1 = unterhalb, -1 = oberhalb).
    Der Unterschied benachbarter Zeilen bleibt klein, so reißt nichts ab. Nur Pixel auf der gegebenen Seite des Pivots bewegen sich.
    ruhe0=True: von der Welle wird ihr Wert bei phase=0 abgezogen (Frame 0 = Ruhepose auch mit lauf/versatz)."""
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
            wert = math.sin(phase + versatz - lauf * frac) - (math.sin(versatz - lauf * frac) if ruhe0 else 0.0)
            dx = int(round(amp * (frac ** potenz) * wert))
        if xs.min() + dx < 0 or xs.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs:
            out[y, x + dx] = a[y, x]
    return out


def spalten_pendel(a, pivot_x, amp, phase, potenz=1.0, lauf=0.0, seite=0, bias=0.0, ruhe0=False, versatz=0.0):
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
            wert = math.sin(phase + versatz - lauf * frac) - (math.sin(versatz - lauf * frac) if ruhe0 else 0.0)
            dy = int(round((amp * wert + bias) * (frac ** potenz)))
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


def spalten_staffel(a, pivot_x, faktoren, amp):
    """Spaltenversatz in Gruppen (Fächer-/Flügelspitzen ohne 1-px-Zacken): die Spalte im Abstand d vom Pivot wandert um round(amp·faktoren[d]) senkrecht
    (positiv = nach unten); faktoren ist eine Liste (Index = Abstand, danach gilt der letzte Wert). Spalten gleicher Gruppe bleiben als Block zusammen."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for x in range(w):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        d = abs(x - pivot_x)
        dy = int(round(amp * faktoren[min(d, len(faktoren) - 1)]))
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
    import cv2
    def _komp(fr, c):
        return cv2.connectedComponents((fr[..., 3] > 0).astype(np.uint8), connectivity=c)[0] - 1
    k8_0, k4_0 = _komp(frames[0], 8), _komp(frames[0], 4)
    mehr8 = {i: _komp(g, 8) for i, g in enumerate(frames) if _komp(g, 8) > k8_0}
    mehr4 = {i: _komp(g, 4) for i, g in enumerate(frames) if _komp(g, 4) > k4_0}
    print(f'Zusammenhangskomponenten Frame 0: 8er {k8_0}, 4er {k4_0}; Frames mit mehr (abgerissene Teile): 8er {mehr8 if mehr8 else "keine"}, 4er {dict(list(mehr4.items())[:8]) if mehr4 else "keine"}')
    l0 = loecher(frames[0])
    neue = {i: sorted(loecher(g) - l0) for i, g in enumerate(frames) if loecher(g) - l0}
    print('neue eingeschlossene Löcher gegenüber Frame 0:', {i: v[:6] for i, v in list(neue.items())[:10]} if neue else 'keine')
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


def kette(punkte, farben, verschiebung, weiche=None):
    """Dünne Linie (Schnurrhaar, Band, Ranke) als Pixelkette neu zeichnen. punkte = [(x, y), …] von der freien Spitze zum Anker, farben = Farbe je Punkt,
    verschiebung = [(dx, dy), …] je Punkt. Zwischen zwei Punkten, die nach der Verschiebung weiter als 1 px (Chebyshev) auseinanderliegen, werden Brückenpixel
    (Bresenham, Farbe des vorderen Punkts) gesetzt: die Linie bleibt zusammenhängend. Gibt {(x, y): Farbe}."""
    out = {}
    q = [(x + d[0], y + d[1]) for (x, y), d in zip(punkte, verschiebung)]
    for k, p in enumerate(q):
        out[p] = farben[k]
        if k:
            a, b = q[k - 1], p
            n = max(abs(b[0] - a[0]), abs(b[1] - a[1]))
            for s in range(1, n):
                px = int(round(a[0] + (b[0] - a[0]) * s / n))
                py = int(round(a[1] + (b[1] - a[1]) * s / n))
                out.setdefault((px, py), farben[k - 1])
    return out


def schichten(H, W, ebenen):
    """Ebenen übereinanderlegen (zuerst = unten). ebenen = [(RGBA-Ebene, Etikett), …]. Gibt (Frame, Etikettenkarte) zurück; die Karte hält je Pixel
    das Etikett der Ebene, die es zuletzt geschrieben hat (None = leer). Zum Schließen der Kontur je Teil (kontur_je_teil)."""
    fig = L.leer(H, W)
    etik = np.full((H, W), None, object)
    for a, name in ebenen:
        m = a[..., 3] > 0
        fig[m] = a[m]
        etik[m] = name
    return fig, etik


def kontur_je_teil(fig, etik, erlaubt, farben, standard=None):
    """Regel 16: jedes Randpixel (4-Nachbar leer) in einer Farbe, die nicht zu den Umrissfarben der Quelle (`erlaubt`) gehört, bekommt die Umrissfarbe seines Teils
    (farben = {Etikett: (r, g, b)}). Gibt die Liste der geänderten Pixel zurück."""
    kk = Hm.kantenmaske(fig)
    geaendert = []
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c in erlaubt:
            continue
        neu = farben.get(etik[y, x], standard)
        if neu is not None:
            fig[y, x, :3] = neu
            geaendert.append((int(x), int(y)))
    return geaendert


def loecher(frame):
    """Eingeschlossene leere Flächen (nicht über 4-Nachbarn mit dem Leinwandrand verbunden) als Menge von (x, y). Ein Loch, das Frame 0 nicht hat, ist meist ein Fehler
    (Lücke zwischen verschobenem Teil und Körper)."""
    import cv2
    leer = (frame[..., 3] == 0).astype(np.uint8)
    n, lab = cv2.connectedComponents(leer, connectivity=4)
    rand = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    out = set()
    for y, x in zip(*np.nonzero(leer)):
        if lab[y, x] not in rand:
            out.add((int(x), int(y)))
    return out


def neue_loecher_fuellen(fig, loch0, erlaubt=None, max_groesse=2):
    """Kleine (≤ max_groesse px) eingeschlossene Leerstellen, die in Frame 0 nicht vorkamen (z. B. 1-px-Taschen zwischen einem verschobenen Blatt und dem Körper), mit der häufigsten
    Farbe der 4-Nachbarn füllen (bevorzugt Umrissfarben `erlaubt`). Gibt die gefüllten Pixel zurück."""
    import cv2
    alle = loecher(fig) - loch0
    if not alle:
        return []
    m = np.zeros(fig.shape[:2], np.uint8)
    for (x, y) in alle:
        m[y, x] = 1
    n, lab = cv2.connectedComponents(m, connectivity=4)
    neu = sorted((x, y) for (x, y) in alle if int((lab == lab[y, x]).sum()) <= max_groesse)
    for (x, y) in neu:
        zaehl = {}
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            X, Y = x + dx, y + dy
            if 0 <= X < fig.shape[1] and 0 <= Y < fig.shape[0] and fig[Y, X, 3]:
                c = tuple(int(v) for v in fig[Y, X, :3])
                zaehl[c] = zaehl.get(c, 0) + (3 if (erlaubt and c in erlaubt) else 1)
        if zaehl:
            c = max(zaehl, key=zaehl.get)
            fig[y, x, :3] = c
            fig[y, x, 3] = 255
    return neu
