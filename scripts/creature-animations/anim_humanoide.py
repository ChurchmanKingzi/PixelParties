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
    if kopf:
        a = L.streck_zeile(a, halszeile - brust, kopf)
    return a


def klecks(a, x, y, groesse, kern, rand, off=(0, 0)):
    """Funkeln als runder Klecks (Spritekoordinaten, Ecke oben links): groesse 1 = ein Pixel (kern),
    2 = 2×2 (kern oben links, rand sonst). Bewusst KEINE Kreuz-/Rautenform."""
    if groesse == 1:
        setze(a, {(x, y): kern}, off)
    elif groesse >= 2:
        setze(a, {(x, y): kern, (x + 1, y): rand, (x, y + 1): rand, (x + 1, y + 1): rand}, off)
    return a


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
