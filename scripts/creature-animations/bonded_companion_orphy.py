# -*- coding: utf-8 -*-
"""Idle-Animation für „Bonded Companion Orphy“ (Creature).

Quelle: src/bonded-companion-orphy.png — Orphy, das limonengrüne Wesen mit Regenbogenflügel und roter E-Gitarre (30×34 px, 498 px, ~80 Farben) aus der Ebene 690 „Orphy“ von Motive.xcf,
Figur 1; mit der Kartenkunst (data/card-art/native/Bonded_Companion_Orphy.png: Mitte links, Pixel für Pixel gleich) abgeglichen. Die Figur der Ebene (44×34, 713 px) enthält zusätzlich die
Heldin mit grünen Haaren (x 30–43; sie hängt über das Gitarrenhals-Ende an Orphy); sie ist ein Held und gehört nicht zur Creature, daher von Hand abgeschnitten (Spalten 0–29).
PICK: [["Motive", 690, 1]]   (Figur 1 der Ebene, nur Spalten 0–29 = Orphy mit Gitarre; die Datei in src/ ist dieser Ausschnitt)

Aufruf:   python3 bonded_companion_orphy.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/bonded-companion-orphy.png + .json

Identifikation (Sprite 30×34, Orphy von vorn mit Gitarre):
* Antenne (x 11–20, Zeilen 0–12): hoher grüner Stiel mit blauer Feder (Blautöne) oben rechts.
* Gesicht (x 10–17, Zeilen 13–22): limonengrün (98e525), dunkelgrüner Mittelstreifen (x 13–15); Augen je 2×2: links (12–13, 16–17), rechts (15–16, 16–17) — links weiß, rechts gelb;
  Mund = dunkelroter Block (12–16, 19–20) (oben 5 breit, unten 3 breit).
* Flügel: links Regenbogen (rot–orange–gelb, x 0–9, Zeilen 16–31, zwei Lappen oben/unten); rechts ein violetter Flügel (x 18–24, Zeilen 15–28, zwei Lappen), halb hinter der Gitarre.
* Gitarre (rot, Körper x 8–17, Zeilen 25–33; Hals grau-schwarz mit Bundstäbchen schräg nach rechts oben bis (29,14)): sitzt vor dem Rumpf und den Flügeln.
* Kein Glanz: die Gitarre ist roter Lack, Hals und Tonabnehmer sind grau-weiß — nicht eindeutig Metall (Regel 14), also fest/matt. Keine Partikel.
Bleibt fest: Gesichtsmuster, Gitarre.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Flügelschlag (Periode 12, 4× pro Schleife, durchgehend): jede Flügelspalte wandert senkrecht, je weiter vom Körper desto mehr (Spitze ca. −4 … +4 px); beide Flügel gleichzeitig; Ansatz am
  Körper bleibt. Der Gitarrenhals bleibt vor dem violetten Flügel.
* Schweben/Bob: der ganze Orphy hebt sich beim Abschlag um 1 px, Flügel und Gitarre gehen mit.
* Antenne wiegt (Periode 16, 3× pro Schleife): die Antennenzeilen oberhalb von Zeile 13 wandern seitlich, je höher desto mehr (Spitze bis ±2 px), mit Phasenverzug zur Spitze.
* Blinzeln (Frames 14–17 und 38–41): die Augen schließen sich in der Gesichtsfarbe (links limone, rechts dunkelgrün), erst die untere Augenzeile, dann beide, dann wieder auf.
* Blick (Frames 3–9 und 26–32): beide Augen schauen zur Seite: weiße und gelbe Augenspalte tauschen (nur die Augen).
* Mund (Frames 10–11, 20–21, 34–35, 44–45): die untere Mundzeile schließt sich kurz (Singen).
* Randpixel-Korrektur (Regel 16): anim_tiere.umriss_schliessen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16); sonst keine gemalten Pixel.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 3, 3

spr = L.lade('bonded-companion-orphy')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
r_, g_, b_ = (spr[..., k].astype(int) for k in range(3))

purpur = vorhanden & (b_ > g_ + 15) & (r_ >= g_ - 3) & (b_ >= r_ - 5) & (g_ < 130)          # Violett inkl. dunkler Schattenstufen (Blau der Feder hat r < g)
fl_l = vorhanden & (((xx <= 8) & (yy >= 15)) | ((xx == 9) & (yy >= 25)))
fl_r = (purpur & (xx >= 18) & (yy >= 14)) | ((xx == 23) & (yy == 27))              # + einzelnes dunkelrotes Randpixel (23,27) am unteren Lappen
_n, _lab = cv2.connectedComponents(fl_r.astype(np.uint8), connectivity=4)
for _k in range(1, _n):                                          # einzelne Streupixel der Farbregel (Halsschatten) gehören nicht zum Flügel
    if (_lab == _k).sum() < 5:
        fl_r &= ~(_lab == _k)
antenne = vorhanden & (yy <= 12)
koerper = vorhanden & ~fl_l & ~fl_r & ~antenne

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

LIMONE = (152, 229, 37)                                          # linke Augenumgebung
GRUEN_O, GRUEN_U = (16, 141, 11), (63, 163, 59)                  # rechte Augenumgebung (Zeile 16 / 17)
AUGE_L = [(12, 16), (13, 16), (12, 17), (13, 17)]
AUGE_R = [(15, 16), (16, 16), (15, 17), (16, 17)]
BLINK = {14: 1, 15: 2, 16: 2, 17: 1, 38: 1, 39: 2, 40: 2, 41: 1}     # 1 = nur untere Zeile zu, 2 = beide Zeilen zu
BLICK = set(range(3, 10)) | set(range(26, 33))
MUND_ZU = {10, 11, 20, 21, 34, 35, 44, 45}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def setze(k, x, y, farbe):
    k[PAD_T + y, PAD_L + x, :3] = farbe
    k[PAD_T + y, PAD_L + x, 3] = 255


def orig(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


def biegen(a, pivot, amp, phase, potenz=1.0, bias=0.0):
    """Wie L.spalten_welle (Spalte wandert um round((amp · sin(phase) + bias) · Abstandsanteil^potenz)), aber die äußerste Spalte bekommt den Anteil
    ihrer Nachbarspalte: einzelne Umrisspixel an der Flügelspitze blieben sonst nur diagonal hängen."""
    out = L.leer(*a.shape[:2])
    h = a.shape[0]
    cols = [x for x in range(a.shape[1]) if a[:, x, 3].any()]
    maxd = max(abs(x - pivot) for x in cols)
    for x in cols:
        frac = min(abs(x - pivot), maxd - 1) / float(maxd)
        dy = int(round((amp * math.sin(phase) + bias) * frac ** potenz))
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


def antenne_wiegen(a, pivot_y, amp, i):
    """Zeilenscherung der Antenne: Zeile y wandert um round(amp · f · sin(2π i/16 + 0,1 − 0,35 f)), f = (Pivot − y)/größter Abstand."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    ys = [y for y in range(h) if a[y, :, 3].any()]
    maxd = max(pivot_y - y for y in ys)
    for y in ys:
        f = (pivot_y - y) / float(maxd)
        dx = int(round(amp * f * math.sin(2 * math.pi * i / 16.0 + 0.1 - 0.35 * f)))
        xs_ = np.nonzero(a[y, :, 3])[0]
        if xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand geschoben')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out


def gesicht(k, i):
    lid = BLINK.get(i, 0)
    if lid:
        zeilen = (17,) if lid == 1 else (16, 17)
        for y in zeilen:
            for x in (12, 13):
                setze(k, x, y, LIMONE)
            for x in (15, 16):
                setze(k, x, y, GRUEN_O if y == 16 else GRUEN_U)
    elif i in BLICK:
        for (xl, xr) in ((12, 13), (15, 16)):                    # weiße und gelbe Augenspalte tauschen
            for y in (16, 17):
                a, b = orig(xl, y), orig(xr, y)
                setze(k, xl, y, b)
                setze(k, xr, y, a)
    if i in MUND_ZU:
        for x in (13, 14, 15):
            setze(k, x, 20, orig(x, 21))                         # untere Mundzeile = Gesichtsfarbe darunter


def frame(i, nur=None):
    ph = L.sinus(i, 12)
    dy = int(round(-0.9 * math.sin(ph)))                         # Schweben: Abschlag → Körper hebt sich
    k = teil(koerper)
    gesicht(k, i)
    fl = biegen(teil(fl_l), PAD_L + 9, 4.2, ph, potenz=1.0, bias=0.4)
    fr_ = biegen(teil(fl_r), PAD_L + 17, 3.4, ph, potenz=1.0, bias=0.3)
    an = antenne_wiegen(teil(antenne), PAD_T + 13, 2.0, i)
    ebenen = {'fl_l': fl, 'fl_r': fr_, 'koerper': k, 'antenne': an}
    wahl = nur or ('fl_l', 'fl_r', 'koerper', 'antenne')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, dy) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('bonded-companion-orphy', 'Bonded Companion Orphy', frames, MS, prev)
    if prev:
        L.streifen(prev + '/bonded-companion-orphy-strip.png', frames, spalten=12, scale=5)
