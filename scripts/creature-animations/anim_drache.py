# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Drachen & Dinos“ (Drachen, Drachenwesen, Saurier) — baut auf anim_lib/anim_tiere auf, ändert nichts daran.

Alles Pixelart: nur ganze Pixel, kein Alpha, nur Farben des Sprites.

    abschnitt(spr, maske, h, w, pl, pt)           Teil des Sprites ausschneiden und sofort auf die volle Leinwand legen (ClipError statt stillem Abschneiden)
    stufe(i, n, fenster)                          0…1 innerhalb eines Fensters (Frames), sonst None — für Bewegungen, die nur zeitweise laufen
    huell(u, p=0.6)                               sanfter Berg 0…1…0 über u ∈ [0, 1]
    blinzeln(i, start)                            Blinzelphase 0 (offen) / 1 (halb) / 2 (zu) für Frame i, wenn das Blinzeln bei `start` beginnt
    spalten_schieben(a, grenzen, dy)              Spalten wandern als Ganzes senkrecht (Rumpf-/Kopf-/Flügelteile): dy je Spalte aus einer Funktion
    fluegel_asym(a, pivot_x, ph, hoch, runter, …) Flügelschlag mit ungleichen Ausschlägen (hoch/runter) → (Ebene, Versatz je Spalte)
    schwanz_biegen(a, pivot_x, amp, phase, …)     Schwanz/Flügel an der Spaltenachse: senkrechter Versatz wächst zur Spitze (max. 1 px Gefälle je Spalte,
                                                  damit die Kontur zusammenhängt); die Spitze (starrer Anhang, z. B. Dornenfächer) wandert unverändert
    glut_farben(a, maske, rampe, i, n, ...)       Flackern einer Glutfläche: Pixel wechseln um eine Rampenstufe (laufende Welle von unten nach oben)
    bild_zoom(pfad, frames, nummern, x0, y0, x1, y1, scale)   Nahaufnahme mehrerer Frames (Prüfbilder)
    ebenen_bild(pfad, ebenen, scale)              Einzelne Ebenen (dict name → RGBA) nebeneinander (jedes bewegte Teil allein)
"""
import math

import numpy as np
from PIL import Image, ImageDraw

import anim_lib as L


def abschnitt(spr, maske, h, w, pl, pt):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, h, w, pl, pt)


def stufe(i, n, fenster):
    """Fenster = [(start, ende), …] in Frames (ende ausgeschlossen, darf über n hinausgehen → läuft über das Schleifenende). Rückgabe 0…1 im Fenster, sonst None."""
    for s, e in fenster:
        for off in (0, n, -n):
            if s + off <= i < e + off:
                return (i - (s + off)) / float(e - s)
    return None


def huell(u, p=0.6):
    return 0.0 if u is None else math.sin(math.pi * u) ** p


def blinzeln(i, start):
    """0 offen, 1 halb, 2 zu: start → halb, start+1 → zu, start+2 → zu, start+3 → halb (nahtlos modulo der Schleife muss der Aufrufer selbst sorgen)."""
    k = i - start
    return {0: 1, 1: 2, 2: 2, 3: 1}.get(k, 0)


def spalten_schieben(a, dy_fn, fuell=None):
    """Jede Spalte x von `a` wandert als Ganzes senkrecht um dy_fn(x) (Leinwandspalte → ganze Zahl; positiv = nach unten). Es wird nichts kopiert.
    fuell: Bool-Maske der Leinwand (Rumpf darunter). Hebt sich eine Spalte (dy < 0) und liegt unter ihrem untersten Pixel Rumpf, wird die Lücke mit
    dem untersten Pixel der Spalte gefüllt (das Teil bleibt am Rumpf angewachsen)."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for x in range(w):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        dy = int(dy_fn(x))
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
        if fuell is not None and dy < 0:
            yb = int(ys.max())
            if yb + 1 < h and fuell[yb + 1, x]:
                for y in range(yb + dy + 1, yb + 1):
                    if not out[y, x, 3]:
                        out[y, x] = a[yb, x]
    return out


def fluegel_asym(a, pivot_x, ph, hoch, runter, lauf=0.0, nur_rechts=None, potenz=1.0, zusammenhang=True, gruppen=None, fuell=None):
    """Flügelschlag mit ungleichen Ausschlägen: Spalte x wandert um round(f^potenz · g(s)), s = sin(ph − lauf·f) − sin(−lauf·f) ∈ [−2, 2], f = Abstand/größter Abstand,
    g(s) = −hoch · |s| bei s < 0 (Flügelspitze hebt sich), runter · s bei s > 0 (senkt sich). Bei ph = 0 steht jede Spalte auf ihrer Originalposition (Ruhepose).
    nur_rechts: True/False = nur eine Seite des Gelenks bewegen. zusammenhang: eine Spalte, die von ihrer Nachbarspalte zur Wurzel hin nicht mehr 4-verbunden wäre,
    übernimmt deren Versatz (dünne Spitzen reißen nicht ab).
    gruppen: [(x0, x1), …] (Leinwandspalten): alle Spalten einer Gruppe wandern gemeinsam (Versatz der mittleren Spalte) — z. B. ein Krallenfinger am Flügelrand, der sonst
    beim Schlag vom Flügel abreißt.
    fuell: Bool-Maske der Leinwand (Rumpf unter dem Flügel): hebt sich eine Spalte (dy < 0) und lag im Original unter ihrem untersten Pixel Rumpf, wird die Lücke mit dem untersten
    Pixel der Spalte gefüllt (der Flügel bleibt am Rumpf angewachsen)."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    spalten = [x for x in range(w) if a[:, x, 3].any()]
    maxd = max(1, max(abs(x - pivot_x) for x in spalten))
    dys = {}
    for x in spalten:
        d = x - pivot_x
        if nur_rechts is True and d < 0 or nur_rechts is False and d > 0:
            dys[x] = 0
            continue
        frac = abs(d) / float(maxd)
        s = math.sin(ph - lauf * frac) - math.sin(-lauf * frac)
        g = runter * s if s > 0 else hoch * s
        dys[x] = int(round(g * frac ** potenz))
    for (g0, g1) in (gruppen or []):
        mitte = (g0 + g1) // 2
        if mitte in dys:
            for x in range(g0, g1 + 1):
                if x in dys:
                    dys[x] = dys[mitte]
    if zusammenhang:
        links = sorted((x for x in dys if x < pivot_x), reverse=True)
        rechts = sorted(x for x in dys if x > pivot_x)
        for reihe, innen in ((links, 1), (rechts, -1)):
            for x in reihe:
                xi = x + innen
                if xi not in dys:
                    continue
                r0 = set(np.nonzero(a[:, x, 3])[0].tolist()), set(np.nonzero(a[:, xi, 3])[0].tolist())
                war = bool(r0[0] & r0[1])
                neu = {y + dys[x] for y in r0[0]} & {y + dys[xi] for y in r0[1]}
                if war and not neu:
                    dys[x] = dys[xi]
    for x, dy in dys.items():
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
        if fuell is not None and dy < 0:
            yb = int(ys.max())
            if yb + 1 < h and fuell[yb + 1, x]:
                for y in range(yb + dy + 1, yb + 1):
                    if not out[y, x, 3]:
                        out[y, x] = a[yb, x]
    return out, dys


def schwanz_biegen(a, pivot_x, amp, phase, lauf=0.0, richtung=1, start_x=None, spitze_ab=None, max_gefaelle=1):
    """Schwanz/Flügel an einer senkrechten Achse: Spalte x wandert senkrecht um round(amp · f · sin(phase − lauf·f)), f = Abstand/größter Abstand
    (richtung=1: der Teil liegt RECHTS vom Pivot, −1: links). Das Gefälle zwischen zwei Nachbarspalten wird auf `max_gefaelle` Pixel begrenzt
    (die Kontur reißt nicht auf). spitze_ab: ab dieser Spalte wandert alles starr mit dem Versatz der Spalte spitze_ab (z. B. ein Dornenfächer).
    Ruhelage (phase = 0 und lauf = 0) = Original. Rückgabe: Ebene."""
    h, w = a.shape[:2]
    cols = [x for x in range(w) if a[:, x, 3].any() and (x - pivot_x) * richtung > 0]
    if not cols:
        return a.copy()
    maxd = max(abs(x - pivot_x) for x in cols)
    dys = {}
    for x in sorted(cols, key=lambda c: abs(c - pivot_x)):
        xe = x if spitze_ab is None else (min(x, spitze_ab) if richtung == 1 else max(x, spitze_ab))
        f = abs(xe - pivot_x) / float(maxd)
        d = int(round(amp * f * (math.sin(phase - lauf * f) - math.sin(-lauf * f))))
        vor = x - richtung
        if vor in dys:
            d = max(dys[vor] - max_gefaelle, min(dys[vor] + max_gefaelle, d))
        dys[x] = d
    out = L.leer(h, w)
    for x in range(w):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        dy = dys.get(x, 0)
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


def glut_farben(a, maske, rampe, i, n, periode=12, hoehe=1.0, schwelle=0.55, versatz=0.0, gefaelle=(0.7, 0.9)):
    """Flackern einer Glutfläche (z. B. Feuerbauch): jedes Pixel der Maske, dessen Farbe auf der Rampe (dunkel → hell, Liste von RGB) liegt, wird je nach
    laufender Welle (steigt nach oben, Periode `periode` Frames, nahtlos wenn n ein Vielfaches ist) um eine Stufe heller oder dunkler."""
    out = a.copy()
    idx = {tuple(c): k for k, c in enumerate(rampe)}
    ys, xs = np.nonzero(maske & (a[..., 3] > 0))
    for y, x in zip(ys, xs):
        c = tuple(int(v) for v in a[y, x, :3])
        if c not in idx:
            continue
        k = idx[c]
        s = math.sin(2 * math.pi * (i / float(periode)) - y * gefaelle[1] + x * gefaelle[0] + versatz)
        if s > schwelle and k + 1 < len(rampe):
            k += 1
        elif s < -schwelle and k > 0:
            k -= 1
        out[y, x, :3] = rampe[k]
    return out


def bild_zoom(pfad, frames, nummern, x0, y0, x1, y1, scale=14, hintergrund=(40, 30, 70)):
    tiles = []
    for k in nummern:
        c = frames[k][y0:y1, x0:x1]
        bg = Image.new('RGBA', (c.shape[1], c.shape[0]), hintergrund + (255,))
        bg.alpha_composite(Image.fromarray(c.astype(np.uint8)))
        t = bg.resize((c.shape[1] * scale, c.shape[0] * scale), Image.NEAREST).convert('RGB')
        im = Image.new('RGB', (t.width, t.height + 12), (12, 10, 20))
        im.paste(t, (0, 12))
        ImageDraw.Draw(im).text((2, 0), f'F{k}', fill=(255, 255, 0))
        tiles.append(im)
    w = sum(t.width + 6 for t in tiles) - 6
    out = Image.new('RGB', (w, max(t.height for t in tiles)), (0, 0, 0))
    x = 0
    for t in tiles:
        out.paste(t, (x, 0))
        x += t.width + 6
    out.save(pfad)
    return pfad


def ebenen_bild(pfad, ebenen, scale=10, hintergrund=(40, 30, 70)):
    tiles = []
    for name, a in ebenen.items():
        bg = Image.new('RGBA', (a.shape[1], a.shape[0]), hintergrund + (255,))
        bg.alpha_composite(Image.fromarray(a.astype(np.uint8)))
        t = bg.resize((a.shape[1] * scale, a.shape[0] * scale), Image.NEAREST).convert('RGB')
        im = Image.new('RGB', (t.width, t.height + 12), (12, 10, 20))
        im.paste(t, (0, 12))
        ImageDraw.Draw(im).text((2, 0), name, fill=(255, 255, 0))
        tiles.append(im)
    w = sum(t.width + 6 for t in tiles) - 6
    out = Image.new('RGB', (w, max(t.height for t in tiles)), (0, 0, 0))
    x = 0
    for t in tiles:
        out.paste(t, (x, 0))
        x += t.width + 6
    out.save(pfad)
    return pfad
