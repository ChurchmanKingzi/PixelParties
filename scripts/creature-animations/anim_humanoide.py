# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Humanoide“ (Personen, Soldaten, Zauberer, Elfen, Zwerge …).

Baut auf anim_lib auf (nur ganze Pixel, kein Alpha, nur Farben des Sprites) und ergänzt, was fast jede menschenähnliche
Figur braucht. Alle Funktionen arbeiten auf RGBA-Feldern der VOLLEN Leinwand (vorher L.platz benutzen), damit nichts
abgeschnitten wird.

    welle01(i, n, versatz)              0…1, sanft (Kosinus) — Grundlage für Atmen/Wippen, nahtlos bei ganzzahligem n
    stufe(i, n, hoch, versatz)          ganzzahlige Stufe 0…hoch aus welle01 (Atem, Kopfwippen)
    folge(i, start, werte, n)           Ereignis-Fenster: werte[k] im Frame start+k, sonst None (Blinzeln, Ohrzucken, Funkeln)
    takt(i, n, start, laenge)           1, wenn Frame i im Fenster [start, start+laenge) (alle n Frames wiederholt), sonst 0 —
                                        z. B. Windstöße für Haarsträhnen: pro Strähne ein um 2 Frames versetztes Fenster = laufende Welle
    laubwelle(s, i, n, wellenlaenge, zyklen)  fortlaufende Welle 0…1 über die Diagonale s = x + 0,6·y (läuft mit i nach s+), mit Hüllkurve
                                        sin²(π·i/n) → in Frame 0 und am Schleifenende überall 0 (Ruhepose), dazwischen kräftig;
                                        `zyklen` volle Wellenperioden pro Schleife. Für wogendes Laub/Haar/Umhang.
    zeilen_versatz(a, off, {zeile: dx})   ganze Zeilen (Spritezeilen) waagerecht verschieben (Hutspitze/Zipfel biegt sich); Unterschied benachbarter
                                        Zeilen ≤ 1 und gleich bei einpixeligen Spitzenzeilen halten, sonst bleibt nur ein Eckkontakt
    bereich_versatz(a, off, {zeile: dx}, x0, x1)   wie zeilen_versatz, aber nur die Pixel mit x0 ≤ x ≤ x1 (eine von mehreren Röhren/Antennen in derselben Zeile)
    rand_dehnen(a, off, {zeile: d}, seite)   Umhang/Fahne spreizt sich: in jeder Zeile rücken alle Pixel außerhalb des innersten (Anker) um d px nach außen
                                        (seite 'l' = nach links, 'r' = nach rechts), die Lücke dazwischen wird mit der Farbe des anliegenden Pixels gefüllt —
                                        die Zeile bleibt am Anker durchgehend 4-verbunden (nichts reißt ab)
    spalten_versatz(a, off, {spalte: (dy, y0, y1)})   Spalte x nur in den Zeilen y0…y1 senkrecht verschieben (Krempenende flattert)
    umrissfarben(spr)                   Menge der Farben, die im Original an der Außenkante (4-Nachbar leer) liegen (Randpixel-Test, Regel 16)
    kantenmaske(a)                      Maske der Randpixel einer Ebene (mindestens ein 4-Nachbar leer)
    kontur_schliessen(a, erlaubt, farbe)  Randpixel in Nicht-Umrissfarbe (z. B. durch Scherung/Versatz freigelegt) werden in `farbe` gesetzt → Kontur in jeder Pose geschlossen
    farbe_stufe(farbe, rampe, stufen)   Farbe um `stufen` Stufen auf einer Rampe (dunkel → hell, Farben des Sprites) verschieben
    lichtband(a, maske, off, i, n, start, dauer, rampe, stufen, breite, achse, kern)
                                        Rule 12: diagonales Lichtband wandert über die Pixel von `maske` (Metall, Gold, Rahmen): die Pixel
                                        im Band sind `stufen` (im Kern `kern`) Stufen heller auf der Farbrampe
    stern4(a, x, y, stufe, kern, arm1, arm2, off)  vierzackiger Glitzer-Stern AM Objekt (Mitte + 4 Arme, stufe 0/1/2)
    boe_mitte(i, n, start, laenge, von, bis)  Mitte einer diagonalen Windfront (Koordinate s = x + neigung·y), die im Fenster von `von`
                                        nach `bis` wandert, sonst None. Laub-/Umhang-Böe: erst die Spitzen oben, die Wellenfront läuft
                                        nach unten (Saum), „Spitze hinterher".
    boe_aktiv(x, y, mitte, breite, neigung)   gehört (x, y) gerade zur Front?
    heller(a, bedingung, rampe, off)    Pixel, deren Farbe in `rampe` (dunkel → hell) steht, um eine Stufe aufhellen (Laubglanz)
    setze(a, {(x, y): farbe}, off)      einzelne Pixel setzen (Alpha 255); farbe None = Pixel löschen
    pixel_von(a, [(x, y), …], off)      Farben der Pixel lesen (RGB-Tupel oder None)
    atmen(a, brustzeile, halszeile, brust, kopf)
                                        Oberkörper hebt sich: Zeile „brustzeile“ wird `brust`-mal, Zeile „halszeile“ (Hals)
                                        `kopf`-mal zusätzlich eingefügt; alles darüber steigt, alles darunter (Beine, Boden,
                                        Waffe am Boden) bleibt stehen. Der Kopf läuft der Brust nach (Sekundärbewegung).
    klecks(a, x, y, groesse, kern, rand) kleines Funkeln als runder Klecks: 1 = Punkt, 2 = 2×2 (keine Kreuz-/Rautenform)
    eckkontakte(frame)                  Menge der Pixelpaare, die sich NUR über eine Ecke berühren (beide gemeinsamen Nachbarpixel leer):
                                        lesen sich als Lücke (Regel 11). Frames mit Eckkontakten vergleichen, die Frame 0 nicht hat.
    ruhepose(frame, spr, off)           Pflichtkontrolle: Frame 0 muss dem Original entsprechen (Regel 9); gibt Abweichungen
    kontaktbogen(pfad, frames, idx, …)  Schlüsselposen groß als Bild (Regel 10)
"""
import math

import numpy as np
from PIL import Image, ImageDraw

import anim_lib as L


def welle01(i, n, versatz=0.0):
    """0 … 1, sanft: 0 bei i = 0 (Ruhepose), 1 in der Mitte der Schleife."""
    return 0.5 - 0.5 * math.cos(L.sinus(i, n, versatz))


def stufe(i, n, hoch, versatz=0.0):
    """Ganzzahlige Stufe 0 … hoch (Atemhub, Kopfwippen). Bei versatz = 0 ist Frame 0 = Ruhe (Stufe 0)."""
    return int(round(hoch * welle01(i, n, versatz)))


def folge(i, start, werte, n=None):
    """Ereignis-Fenster: im Frame start + k liefert es werte[k]; außerhalb None. Mit n (Schleifenlänge) läuft das Fenster
    auch über das Schleifenende hinweg (modulo n) — nahtlos."""
    k = (i - start) % n if n else i - start
    return werte[k] if 0 <= k < len(werte) else None


def takt(i, n, start, laenge):
    """1, wenn Frame i im Fenster [start, start + laenge) liegt (Fenster wiederholt sich alle n Frames, nahtlos), sonst 0."""
    return 1 if 0 <= (i - start) % n < laenge else 0


def laubwelle(s, i, n, wellenlaenge, zyklen):
    """Wert 0 … 1: max(0, sin(2π·(s/wellenlaenge − zyklen·i/n))) · sin²(π·i/n). Nahtlos (ganzzahlige zyklen), in Frame 0 = 0."""
    env = math.sin(math.pi * i / n) ** 2
    return env * max(0.0, math.sin(2 * math.pi * (s / wellenlaenge - zyklen * i / n)))


def zeilen_versatz(a, off, zeilen):
    for y, dx in zeilen.items():
        Y = y + off[1]
        xs = np.nonzero(a[Y, :, 3])[0]
        if not len(xs) or not dx:
            continue
        if xs.min() + dx < 0 or xs.max() + dx >= a.shape[1]:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand geschoben')
        zeile = a[Y].copy()
        a[Y] = 0
        for x in xs:
            a[Y, x + dx] = zeile[x]
    return a


def bereich_versatz(a, off, zeilen, x0, x1):
    X0, X1 = x0 + off[0], x1 + off[0]
    for y, dx in zeilen.items():
        Y = y + off[1]
        xs = [x for x in range(X0, X1 + 1) if a[Y, x, 3]]
        if not xs or not dx:
            continue
        if min(xs) + dx < 0 or max(xs) + dx >= a.shape[1]:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand geschoben')
        zeile = {x: a[Y, x].copy() for x in xs}
        for x in xs:
            a[Y, x] = 0
        for x, px in zeile.items():
            a[Y, x + dx] = px
    return a


def rand_dehnen(a, off, zeilen, seite):
    """NUTZER-FEEDBACK: Arme, Haare und Säume dürfen beim Bewegen nicht „einfach dicker“ werden (kopierte Spalte). Die seitliche
    Verbreiterung ist deshalb abgeschaltet (die Funktion lässt die Ebene unverändert); die Aufrufe bleiben im Skript stehen."""
    return a


def _rand_dehnen_alt(a, off, zeilen, seite):
    for y, d in zeilen.items():
        Y = y + off[1]
        xs = list(np.nonzero(a[Y, :, 3])[0])
        if not xs or not d:
            continue
        if seite == 'l':
            xa = max(xs)
            ausen = [x for x in xs if x < xa]
            if not ausen:
                continue
            if min(ausen) - d < 0:
                raise L.ClipError(f'Zeile {y} würde um {d} px aus der Leinwand gedehnt')
            alt = {x: a[Y, x].copy() for x in ausen}
            fuell = alt[max(ausen)]
            for x in ausen:
                a[Y, x] = 0
            for x, px in alt.items():
                a[Y, x - d] = px
            for x in range(max(ausen) - d + 1, max(ausen) + 1):
                a[Y, x] = fuell
        else:
            xa = min(xs)
            ausen = [x for x in xs if x > xa]
            if not ausen:
                continue
            if max(ausen) + d >= a.shape[1]:
                raise L.ClipError(f'Zeile {y} würde um {d} px aus der Leinwand gedehnt')
            alt = {x: a[Y, x].copy() for x in ausen}
            fuell = alt[min(ausen)]
            for x in ausen:
                a[Y, x] = 0
            for x, px in alt.items():
                a[Y, x + d] = px
            for x in range(min(ausen), min(ausen) + d):
                a[Y, x] = fuell
    return a


def rand_dehnen_innen(a, off, zeilen, seite):
    """NUTZER-FEEDBACK: abgeschaltet (siehe rand_dehnen) – die Ebene bleibt unverändert."""
    return a


def _rand_dehnen_innen_alt(a, off, zeilen, seite):
    """Wie rand_dehnen, aber der entstehende Zwischenraum wird mit dem inneren Ankerpixel der Zeile gefüllt (Hand/Ärmel),
    nicht mit dem Umrisspixel: der Umriss wandert mit dem Arm nach außen und bleibt 1 px breit (kein 2-px-Umrissblock neben dem Arm)."""
    for y, d in zeilen.items():
        Y = y + off[1]
        xs = list(np.nonzero(a[Y, :, 3])[0])
        if not xs or not d:
            continue
        if seite == 'l':
            xa = max(xs)
            ausen = [x for x in xs if x < xa]
            if not ausen:
                continue
            if min(ausen) - d < 0:
                raise L.ClipError(f'Zeile {y} würde um {d} px aus der Leinwand gedehnt')
            anker = a[Y, xa].copy()
            alt = {x: a[Y, x].copy() for x in ausen}
            for x in ausen:
                a[Y, x] = 0
            for x, px in alt.items():
                a[Y, x - d] = px
            for x in range(xa - d, xa):
                a[Y, x] = anker
        else:
            xa = min(xs)
            ausen = [x for x in xs if x > xa]
            if not ausen:
                continue
            if max(ausen) + d >= a.shape[1]:
                raise L.ClipError(f'Zeile {y} würde um {d} px aus der Leinwand gedehnt')
            anker = a[Y, xa].copy()
            alt = {x: a[Y, x].copy() for x in ausen}
            for x in ausen:
                a[Y, x] = 0
            for x, px in alt.items():
                a[Y, x + d] = px
            for x in range(xa + 1, xa + 1 + d):
                a[Y, x] = anker
    return a


def spalten_versatz(a, off, spalten):
    for x, (dy, y0, y1) in spalten.items():
        X = x + off[0]
        ys = [y for y in range(y0, y1 + 1) if a[y + off[1], X, 3]]
        if not ys or not dy:
            continue
        sp = {y: a[y + off[1], X].copy() for y in ys}
        for y in ys:
            a[y + off[1], X] = 0
        for y, px in sp.items():
            if not 0 <= y + dy + off[1] < a.shape[0]:
                raise L.ClipError(f'Spalte {x} würde aus der Leinwand geschoben')
            a[y + dy + off[1], X] = px
    return a


def kantenmaske(a):
    m = a[..., 3] > 0
    p = np.pad(m, 1)
    frei = (~p[:-2, 1:-1]) | (~p[2:, 1:-1]) | (~p[1:-1, :-2]) | (~p[1:-1, 2:])
    return m & frei


def umrissfarben(spr):
    kk = kantenmaske(spr)
    return {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(kk))}


def kontur_schliessen(a, erlaubt, farbe):
    kk = kantenmaske(a)
    for y, x in zip(*np.nonzero(kk)):
        if tuple(int(v) for v in a[y, x, :3]) not in erlaubt:
            a[y, x, :3] = farbe
    return a


def farbe_stufe(farbe, rampe, stufen):
    f = tuple(int(v) for v in farbe)
    if f not in rampe:
        return f
    return rampe[max(0, min(len(rampe) - 1, rampe.index(f) + stufen))]


def lichtband(a, maske, off, i, n, start, dauer, rampe, stufen=1, breite=2.4, achse=(1.0, 1.0), kern=None):
    """Lichtband über die Pixel von `maske` (Spritekoordinaten) im Zeitfenster [start, start+dauer) mod n. Bearbeitet `a` (Leinwand)
    an Ort und Stelle, bevor Teile verschoben werden. Nur Pixel, deren Farbe auf `rampe` steht, ändern sich."""
    k = (i - start) % n
    if k >= dauer:
        return a
    ys, xs = np.nonzero(maske)
    if not len(ys):
        return a
    u = achse[0] * xs + achse[1] * ys
    umin, umax = float(u.min()), float(u.max())
    mitte = umin - breite + (k + 0.5) / dauer * (umax - umin + 2 * breite)
    for y, x, uu in zip(ys, xs, u):
        d = abs(uu - mitte)
        if d > breite / 2.0 + 0.001:
            continue
        Y, X = int(y) + off[1], int(x) + off[0]
        if a[Y, X, 3]:
            st = kern if (kern is not None and d <= breite / 4.0) else stufen
            a[Y, X, :3] = farbe_stufe(a[Y, X, :3], rampe, st)
    return a


def stern4(a, x, y, stufe, kern, arm1, arm2=None, off=(0, 0)):
    """Vierzackiger Glitzer-Stern um (x, y) (Spritekoordinaten): stufe 0 = nur Mitte, 1 = Arme 1 px, 2 = Arme 2 px. Er sitzt am
    Objekt (Kante/Ecke) und fliegt nicht weg. stufe None = nichts."""
    if stufe is None:
        return a
    pts = {(x, y): kern}
    if stufe >= 1:
        pts.update({(x + 1, y): arm1, (x - 1, y): arm1, (x, y + 1): arm1, (x, y - 1): arm1})
    if stufe >= 2:
        a2 = arm2 or arm1
        pts.update({(x + 2, y): a2, (x - 2, y): a2, (x, y + 2): a2, (x, y - 2): a2})
    return setze(a, pts, off)


def boe_mitte(i, n, start, laenge, von, bis):
    """Mitte der Windfront im Frame i (Fenster [start, start+laenge) mod n), linear von `von` nach `bis`; außerhalb None."""
    k = (i - start) % n
    if not 0 <= k < laenge:
        return None
    return von + (bis - von) * k / max(1, laenge - 1)


def boe_aktiv(x, y, mitte, breite=1.5, neigung=0.6):
    return mitte is not None and abs(x + neigung * y - mitte) <= breite


def heller(a, bedingung, rampe, off=(0, 0)):
    """Jedes Pixel (x, y in Spritekoordinaten), für das bedingung(x, y) gilt und dessen RGB in `rampe` (dunkel → hell) steht,
    bekommt die nächsthellere Stufe der Rampe (die hellste bleibt). Nur Farben des Sprites."""
    h, w = a.shape[:2]
    idx = {tuple(c): j for j, c in enumerate(rampe)}
    for Y in range(h):
        for X in range(w):
            if not a[Y, X, 3]:
                continue
            j = idx.get(tuple(int(v) for v in a[Y, X, :3]))
            if j is not None and j + 1 < len(rampe) and bedingung(X - off[0], Y - off[1]):
                a[Y, X, :3] = rampe[j + 1]
    return a


def setze(a, pixel, off=(0, 0)):
    """{(x, y): (r, g, b)} in `a` schreiben (Spritekoordinaten + off = Leinwandkoordinaten). Farbe None löscht das Pixel."""
    h, w = a.shape[:2]
    for (x, y), c in pixel.items():
        X, Y = x + off[0], y + off[1]
        if not (0 <= X < w and 0 <= Y < h):
            raise L.ClipError(f'Pixel ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
        if c is None:
            a[Y, X] = 0
        else:
            a[Y, X, :3] = c
            a[Y, X, 3] = 255
    return a


def pixel_von(a, koordinaten, off=(0, 0)):
    return {(x, y): (tuple(int(v) for v in a[y + off[1], x + off[0], :3]) if a[y + off[1], x + off[0], 3] else None)
            for (x, y) in koordinaten}


def atmen(a, brustzeile, halszeile, brust, kopf):
    """Zweistufiges Atmen auf der vollen Leinwand (Zeilen = Leinwandzeilen).
    1. `brust` Kopien der Zeile `brustzeile` (z. B. dunkler Gürtel/Saum): alles darüber (Brust, Arme, Kopf) steigt um `brust`.
    2. `kopf` Kopien der Halszeile (nach Schritt 1 liegt sie `brust` höher): der Kopf steigt zusätzlich — er läuft der Brust nach.
    Die Zeilen darunter (Beine) bleiben unverändert. Die Leinwand behält ihre Größe; ragt etwas oben heraus, wirft anim_lib
    einen ClipError."""
    if brust:
        a = L.streck_zeile(a, brustzeile, brust)
    # NUTZER-FEEDBACK (Tobi/Kai/Healer: Hals und Kinn werden zu groß; allgemein: nicht einfach Zeilen kopieren): der zweite Schritt, bei dem die
    # Halszeile kopiert wurde und das Gesicht länger wurde, entfällt – der Kopf hebt sich nur noch mit der Brust (starr), `kopf` wird ignoriert.
    return a


def klecks(a, x, y, groesse, kern, rand, off=(0, 0)):
    """Funkeln als runder Klecks (Spritekoordinaten, Ecke oben links): groesse 1 = ein Pixel (kern),
    2 = 2×2 (kern oben links, rand sonst). Bewusst KEINE Kreuz-/Rautenform."""
    if groesse == 1:
        setze(a, {(x, y): kern}, off)
    elif groesse >= 2:
        setze(a, {(x, y): kern, (x + 1, y): rand, (x, y + 1): rand, (x + 1, y + 1): rand}, off)
    return a


def eckkontakte(frame):
    """Alle diagonal benachbarten deckenden Pixelpaare ((x1,y1),(x2,y2)), bei denen die beiden gemeinsamen orthogonalen Nachbarn
    leer sind (Berührung nur über die Ecke). Zum Aufspüren von Nähten, die sich als Lücke lesen."""
    m = frame[..., 3] > 0
    h, w = m.shape
    paare = set()
    for y in range(h - 1):
        for x in range(w):
            if not m[y, x]:
                continue
            for dx in (-1, 1):
                x2 = x + dx
                if 0 <= x2 < w and m[y + 1, x2] and not m[y, x2] and not m[y + 1, x]:
                    paare.add(((x, y), (x2, y + 1)))
    return paare


def eckkontakt_typen(frame):
    """Wie eckkontakte, aber als Zähler nach Farbpaar (RGB, RGB) statt nach Koordinaten — robust, wenn Teile des Körpers beim Atmen
    verschoben werden (dieselben Kontakte liegen dann woanders). Zum Vergleich mit Frame 0: Eintrag mit höherem Zähler = neuer Eckkontakt."""
    from collections import Counter
    z = Counter()
    for (p, q) in eckkontakte(frame):
        a = tuple(int(v) for v in frame[p[1], p[0], :3])
        b = tuple(int(v) for v in frame[q[1], q[0], :3])
        z[tuple(sorted((a, b)))] += 1
    return z


def ruhepose(frame, spr, off):
    """Vergleicht `frame` (volle Leinwand) mit dem Original-Sprite an Versatz off. Gibt die abweichenden Koordinaten zurück
    (leer = Ruhepose entspricht dem Original)."""
    sh, sw = spr.shape[:2]
    diff = []
    for y in range(frame.shape[0]):
        for x in range(frame.shape[1]):
            sx, sy = x - off[0], y - off[1]
            if 0 <= sx < sw and 0 <= sy < sh:
                o = spr[sy, sx]
            else:
                o = np.zeros(4, np.uint8)
            f = frame[y, x]
            if bool(f[3]) != bool(o[3]) or (f[3] and not np.array_equal(f[:3], o[:3])):
                diff.append((sx, sy))
    return diff


def kontaktbogen(pfad, frames, idx, scale=10, hintergrund=(40, 30, 70), beschriftung=True, ausschnitt=None):
    """Ausgewählte Frames nebeneinander, stark vergrößert (Regel 10). ausschnitt = (x0, y0, x1, y1) auf der Leinwand."""
    sel = [frames[k] for k in idx]
    if ausschnitt:
        x0, y0, x1, y1 = ausschnitt
        sel = [f[y0:y1, x0:x1] for f in sel]
    H, W = sel[0].shape[:2]
    bild = Image.new('RGB', (len(sel) * (W * scale + 6), H * scale + (14 if beschriftung else 0)), (12, 10, 20))
    d = ImageDraw.Draw(bild)
    for k, f in enumerate(sel):
        im = Image.fromarray(f.astype(np.uint8)).resize((W * scale, H * scale), Image.NEAREST)
        b = Image.new('RGBA', im.size, hintergrund + (255,)); b.alpha_composite(im)
        bild.paste(b.convert('RGB'), (k * (W * scale + 6), 0))
        if beschriftung:
            d.text((k * (W * scale + 6) + 2, H * scale + 1), f'Frame {idx[k]}', fill=(255, 255, 0))
    bild.save(pfad)
    return pfad
