# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Tiere“ (Vierbeiner, Reptilien, Krabbler, Meerestiere).

Baut auf anim_lib auf (nur ganze Pixel, kein Alpha, nur Farben des Sprites). Alle Funktionen arbeiten auf Ebenen,
die bereits auf der VOLLEN Leinwand liegen (L.platz) — so schneidet nichts still ab (ClipError).

    umriss_regeln(spr, umriss_farben)          # welche Umrissfarbe gehört zu welcher Füllfarbe? (aus dem Sprite abgeleitet)
    haengend_schwingen(teil, blocker, ...)     # Schwanz/Zipfel schwingt (Zeilenversatz mit Nachlauf), Umriss wird NEU gezogen
    zucken_zeilen(teil, pivot_y, dx)           # Ohr/Fühler zuckt: Zeilen oberhalb des Ansatzes weichen seitlich aus
    ohr_haengend(teil, {zeile: dx}, seite)     # Schlappohr schwingt unten nach außen, bleibt am Kopf angewachsen
    pixel_tauschen(ebene, {(x, y): rgb})       # einzelne Pixel umfärben (Blinzeln, Glühen), Koordinaten = Leinwand
    funken_ebene(h, w, i, n, funken, farben)   # einzelne Glutfunken (1 px) steigen langsam auf, verglimmen flackernd
    nachbarn4(maske)                           # 4er-Dilatation
    hilfsbilder(...)                           # Prüfbilder: Schlüsselposen groß, Nahaufnahmen, Teile einzeln
"""
import math

import numpy as np
from PIL import Image, ImageDraw

import anim_lib as L


# ── Grundlagen ────────────────────────────────────────────────────────────────────────────────────────────────
def nachbarn4(m):
    """Maske plus ihre 4 Nachbarn (Kreuz-Dilatation)."""
    p = np.pad(m, 1)
    return m | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]


def rgb(a, x, y):
    return tuple(int(v) for v in a[y, x, :3])


def pixel_tauschen(ebene, pixel):
    """pixel = {(x, y): (r, g, b)} auf der Leinwand; nur auf bereits deckende Pixel anwenden (nichts wird erfunden)."""
    out = ebene.copy()
    for (x, y), c in pixel.items():
        if out[y, x, 3]:
            out[y, x, :3] = c
    return out


# ── Umriss-Regeln & hängende Teile ───────────────────────────────────────────────────────────────────────────
def umriss_regeln(a, umriss_farben, blocker=None):
    """Zerlegt eine Ebene in Füllung und Außenumriss.
    Umriss = Pixel in einer der `umriss_farben`, die mit einer 4er-Kante an freien Hintergrund grenzen (weder dieses Teil
    noch `blocker` = Maske anderer Teile). Alles andere (auch dunkle Binnenlinien!) ist Füllung.
    Rückgabe: (fuell_maske, umriss_maske, regel) — regel = {Füllfarbe: Umrissfarbe}: je Füllfarbe die Umrissfarbe, die im
    Original an ihr liegt (für Füllfarben ohne Nachbarumriss: die der ähnlichsten Füllfarbe)."""
    vor = L.deckend(a)
    sperr = vor if blocker is None else (vor | blocker)
    frei = ~sperr
    p = np.pad(frei, 1)
    an_frei = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    umriss = vor & L.farbmaske(a, umriss_farben) & an_frei
    fuell = vor & ~umriss
    zaehl = {}
    h, w = vor.shape
    for y, x in zip(*np.nonzero(fuell)):
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and umriss[yy, xx]:
                k = (rgb(a, x, y), rgb(a, xx, yy))
                zaehl[k] = zaehl.get(k, 0) + 1
    regel = {}
    for (f, u), n in sorted(zaehl.items(), key=lambda e: -e[1]):
        regel.setdefault(f, u)
    bekannt = list(regel)
    for y, x in zip(*np.nonzero(fuell)):
        f = rgb(a, x, y)
        if f not in regel and bekannt:
            regel[f] = regel[min(bekannt, key=lambda c: sum((c[i] - f[i]) ** 2 for i in range(3)))]
    return fuell, umriss, regel


def haengend_schwingen(a, blocker, pivot_y, amp, phase, umriss_farben, lauf=0.0, potenz=1.0, huelle=1.0):
    """Hängendes Teil (Schwanz, Zipfel, Flosse) schwingt seitlich. Jede Zeile der FÜLLUNG wandert um
    round(amp · f^potenz · sin(phase − lauf·f)) mit f = (y − pivot_y)/maxAbstand (unterhalb des Pivots), der Außenumriss wird
    danach um die verschobene Füllung NEU gezogen (4er-Rand, Farbe nach der Regel aus dem Original) — so reißt die Kontur an
    den Stufen nicht auf und es fehlt kein Umrisspixel.
    blocker: Maske der anderen Teile (Rumpf). Sie werden nie überschrieben; die Füllung gleitet bei Linksversatz UNTER den Rumpf, bei
    Rechtsversatz wird die Lücke zum Rumpf mit dem Randpixel der Zeile geschlossen (Teil bleibt angewachsen).
    Der Nullzustand (alle dx = 0) gibt das Original unverändert zurück."""
    h, w = a.shape[:2]
    fuell, umriss, regel = umriss_regeln(a, umriss_farben, blocker)
    vor = L.deckend(a)
    maxd = max(1, max((y - pivot_y for y in range(h) if fuell[y].any()), default=1))
    neu = np.zeros_like(a)
    dxs = {}
    for y in range(h):
        xs_ = np.nonzero(fuell[y])[0]
        if not len(xs_):
            continue
        f = max(0.0, (y - pivot_y) / maxd)
        dx = int(round(amp * (f ** potenz) * math.sin(phase - lauf * f) * huelle))
        dxs[y] = dx
        if xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs_:
            neu[y, x + dx] = a[y, x]
        x0 = int(xs_.min())
        if dx > 0 and x0 > 0 and blocker[y, x0 - 1]:           # Lücke zum Rumpf schließen
            for x in range(x0, x0 + dx):
                neu[y, x] = a[y, x0]
    if all(d == 0 for d in dxs.values()):
        return a.copy()
    # Umriss neu ziehen: 4er-Rand der verschobenen Füllung, nicht auf Rumpf und nicht auf die Füllung
    fm = L.deckend(neu)
    rand = nachbarn4(fm) & ~fm & ~blocker
    for y, x in zip(*np.nonzero(rand)):
        cand = []
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and fm[yy, xx]:
                cand.append(regel.get(rgb(neu, xx, yy), umriss_farben[0]))
        # bei mehreren Nachbarn gewinnt die häufigste Umrissfarbe
        c = max(set(cand), key=cand.count)
        neu[y, x, :3] = c
        neu[y, x, 3] = 255
    # Umrisspixel des Originals, die nicht am Außenrand lagen, aber auch keine Füllung sind (Ecken-Doppelpixel) entfallen bewusst
    return neu


def zucken_zeilen(a, pivot_y, dx_oben, anteile=None):
    """Ohr/Fühler zuckt: Zeilen oberhalb von `pivot_y` (nur Zeilen < pivot_y) weichen um dx_oben · Anteil seitlich aus.
    anteile = {Zeile: Anteil 0…1}; Standard: linear vom Ansatz (0) zur Spitze (1). Ganze Pixel, Zeilen bleiben zusammenhängend,
    solange sich benachbarte Zeilen um höchstens 1 px unterscheiden."""
    h, w = a.shape[:2]
    out = np.zeros_like(a)
    ys = [y for y in range(h) if a[y, :, 3].any()]
    top = min(ys)
    for y in ys:
        if y >= pivot_y:
            d = 0
        else:
            an = anteile.get(y) if anteile else (pivot_y - y) / max(1, pivot_y - top)
            d = int(round(dx_oben * an))
        xs_ = np.nonzero(a[y, :, 3])[0]
        if xs_.min() + d < 0 or xs_.max() + d >= w:
            raise L.ClipError(f'Zeile {y} würde um {d} px aus der Leinwand geschoben')
        for x in xs_:
            out[y, x + d] = a[y, x]
    return out


def ohr_haengend(a, profil, seite):
    """Hängendes Ohr (Schlappohr): oben am Kopf aufgehängt, einzelne Zeilen schwingen nach außen.
    profil = {Zeile: Versatz in px, Vorzeichen = Richtung}; nicht genannte Zeilen bleiben stehen (der Ansatz oben).
    Tipp: Versatz auf die untersten Zeilen gemeinsam legen (z. B. {3: d, 4: d, 5: d}), sonst entsteht eine Beule, wenn eine
    Zeile (z. B. die verjüngte Spitze) schmaler ist als die darüber.
    seite = 'links' (Ohr links vom Kopf, außen = links, d < 0) oder 'rechts' (außen = rechts, d > 0). Die Lücke zum Kopf wird mit
    dem inneren Randpixel der Zeile gefüllt (das Ohr bleibt angewachsen und wird dabei um |d| px breiter)."""
    h, w = a.shape[:2]
    out = np.zeros_like(a)
    for y in range(h):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if not len(xs_):
            continue
        d = int(profil.get(y, 0))
        if xs_.min() + d < 0 or xs_.max() + d >= w:
            raise L.ClipError(f'Ohrzeile {y} würde um {d} px aus der Leinwand geschoben')
        for x in xs_:
            out[y, x + d] = a[y, x]
        if d:
            if seite == 'links':                       # innen = rechter Rand, außen = links (d < 0)
                xi = int(xs_.max())
                for x in range(xi + d + 1, xi + 1):
                    out[y, x] = a[y, xi]
            else:                                      # innen = linker Rand, außen = rechts (d > 0)
                xi = int(xs_.min())
                for x in range(xi, xi + d):
                    out[y, x] = a[y, xi]
    return out


def huellkurve(i, n, start, laenge):
    """0…1…0 über `laenge` Frames ab `start` (Dreieck mit abgerundeter Spitze), sonst 0; läuft über das Schleifenende hinaus."""
    t = (i - start) % n
    if t >= laenge:
        return 0.0
    return math.sin(math.pi * (t + 0.5) / laenge) ** 2 if laenge > 1 else 1.0


# ── Glutfunken ───────────────────────────────────────────────────────────────────────────────────────────────
def funken_ebene(h, w, i, n, funken, farben):
    """Einzelne Glutfunken (je 1 Pixel, rund im Sinne von „Punkt“), die langsam aufsteigen. funken: Liste von
    dict(x, y, vx, vy, off, wackeln=0, farbe='c'); (x, y) Startpunkt auf der Leinwand, (vx, vy) Gesamtweg über die Lebensdauer
    (= n Frames, nahtlos), off = Phasenversatz in Frames, farbe = Schlüssel in `farben`.
    Lebenslauf t: 0–0,12 noch unsichtbar (liegt hinter dem Körper) → 0,12–0,72 sichtbar → 0,72–0,92 verglimmt flackernd
    (jedes zweite Frame) → danach aus; so gibt es am Schleifenende keinen Sprung."""
    ebene = L.leer(h, w)
    for f in funken:
        t = ((i + f.get('off', 0)) % n) / n
        if t < 0.12 or t >= 0.92 or (t >= 0.72 and (i + f.get('off', 0)) % 2):
            continue
        x = int(round(f['x'] + f.get('vx', 0) * t + f.get('wackeln', 0) * math.sin(2 * math.pi * t)))
        y = int(round(f['y'] + f.get('vy', 0) * t))
        if not (0 <= y < h and 0 <= x < w):
            raise L.ClipError(f'Funke bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
        ebene[y, x, :3] = farben[f.get('farbe', 'c')]
        ebene[y, x, 3] = 255
    return ebene


# ── Prüfbilder ─────────────────────────────────────────────────────────────────────────────────────────────────
def kontakt(pfad, tafeln, scale=10, hintergrund=(40, 30, 70), spalten=3, zoom=None):
    """Schlüsselposen groß. tafeln = [(titel, RGBA-Feld)]; zoom = (x0, y0, x1, y1) schneidet VOR dem Vergrößern aus (Nahaufnahme)."""
    ims = []
    for titel, f in tafeln:
        g = f if zoom is None else f[zoom[1]:zoom[3], zoom[0]:zoom[2]]
        im = Image.fromarray(g.astype(np.uint8)).resize((g.shape[1] * scale, g.shape[0] * scale), Image.NEAREST)
        b = Image.new('RGBA', im.size, hintergrund + (255,)); b.alpha_composite(im)
        t = Image.new('RGB', (b.width, b.height + 14), (12, 10, 20)); t.paste(b.convert('RGB'), (0, 14))
        ImageDraw.Draw(t).text((2, 1), str(titel), fill=(255, 255, 0))
        ims.append(t)
    bw = max(i.width for i in ims); bh = max(i.height for i in ims)
    zeilen = (len(ims) + spalten - 1) // spalten
    sh = Image.new('RGB', (spalten * (bw + 4), zeilen * (bh + 4)), (0, 0, 0))
    for k, im in enumerate(ims):
        sh.paste(im, ((k % spalten) * (bw + 4), (k // spalten) * (bh + 4)))
    sh.save(pfad)
    return pfad
