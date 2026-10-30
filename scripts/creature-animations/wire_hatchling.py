# -*- coding: utf-8 -*-
"""Idle-Animation für „Wire Hatchling“ (Creature) — Regeln 14/15/16 (Metall glänzt, sonst nichts; kein Feuer).

PICK: [["MotiveGrailWar", 587, 1]]
Quelle: src/wire-hatchling.png — Küken mit Drahtspulen-Körper (28×20 px, 13 Farben) aus MotiveGrailWar.xcf, Ebene 587 („Wire Hatchling“), Figur 1; vollständig deckend (Alpha nur 255),
Maßstab 1 (deckt sich mit der Kartenkunst, nichts ging bei der Extraktion verloren; der braune Baumstumpf rechts daneben ist Hintergrund).

Aufruf:   python3 wire_hatchling.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/wire-hatchling.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y):
* Kopf (x 0–12, y 0–10): gelbes Küken ((250,244,72)/(249,251,154)/(238,231,65)/(224,198,31)) mit olivem Umriss (62,61,42), zwei Fühler/Öhrchen oben (x 3–5 und x 8–10, y 0–1),
  grünen Augen ((155,205,106)/(186,231,145)/(110,130,89)/(207,231,185); links (3–4, 5–6), rechts (7–8, 5–6)) und einem Schnabel nach links (x 0–4, y 7–8).
* Körper (x 3–21, y 10–19): eine Drahtspule aus grauem Metall — dunkle Wicklungen (42,42,42) im Wechsel mit Glanzbändern (101,96,100)/(123,124,122)/(173,173,174), die Wicklungen rücken Zeile für Zeile nach links.
* Flügel (x 16–21, y 7–13): ein kleiner gelber Federstreifen mit olivem Umriss, der schräg nach rechts oben aus dem Körper wächst (19 Pixel, liegt über dem Körper).
* Schwanz (x 20–27, y 9–17): ein Drahtkabel, das rechts hochgebogen in einem Stecker (x 23–27, y 9–13: zwei Zinken oben, Steckerkörper (x 24–26)) endet.

Ablauf (48 Frames à 60 ms = 2,88 s):
* Durchgehender Flügelschlag (Periode 6, achtmal pro Schleife): der Federstreifen dreht sich um seine Wurzel (17,12) von steil nach oben (−55°) bis leicht abgesenkt (+15°); Abschlag schneller als Aufschlag.
  Frame 0 steht in Ruhelage (Original). Wo der Flügel den Körper verdeckte, liegt dunkle Wicklungsfarbe (siehe Ergänzungen).
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12), das Küken hängt wie an einer Feder: auf dem höchsten Punkt streckt sich die Spule um 1 Zeile (eine Wicklung wird verdoppelt).
* Fühler wippen (Periode 24): die beiden Spitzen schwingen versetzt ±1 px seitlich.
* Der Stecker am Schwanz pendelt (Periode 24) um seine Wurzel, bis 1–2 px seitlich — die Zeilen bleiben 4-verbunden.
* Blinzeln: Augen schließen sich für 3 Frames (Lid = Gelb des Kopfes) bei Frame 21–23.
* Glanz nur auf dem Metall (Regel 14): ein dezentes Lichtband (eine Stufe heller) läuft alle 24 Frames über die grauen Wicklungen und den Stecker. Kopf, Flügel und Rand glänzen nicht.
* Kein Feuer, keine Partikel.

Ergänzungen (verdeckte Teile, Regel 2): Der Federstreifen verdeckt im Original vier Körperpixel der Wicklung ((16,12), (17,12), (17,13), (18,13)); sie sind in der dunklen Wicklungsfarbe (42,42,42) ergänzt, die Körperkante läuft
damit als saubere Treppe unter dem Flügel durch. Im Ruhebild (Frame 0) liegt der Flügel darüber, das Bild ist pixelgleich zum Original.
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px freier Rand, zentriert), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Fühlerschwung, Steckerpendel und Flügeldrehung können Innenfarbe an die Kante legen → F.umranden setzt dort den Umriss (Kopf/Flügel (62,61,42), Stecker (42,42,42)); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 10, 10, 10, 10                  # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('wire-hatchling')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

DUNKEL = (42, 42, 42)                                         # dunkle Wicklung = Körperumriss
OLIV = (62, 61, 42)                                           # Umriss des Kükens / Federstreifens
GELB = (250, 244, 72)                                         # Hauptgelb des Kopfes (Lid)
METALL = [(101, 96, 100), (123, 124, 122), (173, 173, 174)]   # Glanzbänder der Spule, dunkel → hell
AUGEN = [(155, 205, 106), (186, 231, 145), (110, 130, 89), (207, 231, 185)]

# Teilebenen (Sprite-Koordinaten)
FLUEGEL_PX = [(21, 7), (20, 8), (21, 8), (19, 9), (20, 9), (21, 9), (18, 10), (19, 10), (20, 10), (17, 11), (18, 11), (19, 11), (20, 11),
              (16, 12), (17, 12), (18, 12), (19, 12), (17, 13), (18, 13)]
m_fluegel = np.zeros((sh, sw), bool)
for (x, y) in FLUEGEL_PX:
    m_fluegel[y, x] = True
assert (m_fluegel & ~vorhanden).sum() == 0
ERGAENZT = {(16, 12): DUNKEL, (17, 12): DUNKEL, (17, 13): DUNKEL, (18, 13): DUNKEL}      # unter dem Federstreifen verdeckte Wicklung
m_stecker = vorhanden & (xx >= 22) & (yy >= 9) & (yy <= 14)
m_ohr_l = vorhanden & (yy <= 1) & (xx <= 6)
m_ohr_r = vorhanden & (yy <= 1) & (xx >= 7)
m_augen = vorhanden & L.farbmaske(spr, AUGEN)
assert int(m_augen.sum()) == 7
m_rest = vorhanden & ~m_fluegel & ~m_stecker & ~m_ohr_l & ~m_ohr_r
metall_maske = L.farbmaske(spr, METALL) & ~F.kanten(spr)
UMRISS = F.umriss_farben(spr)

spr_erg, m_erg = F.ergaenzen(spr, ERGAENZT)                    # Körper mit ergänzten Pixeln (nur Körperebene)


def ebene(maske, quelle=None):
    return F.ebene(spr if quelle is None else quelle, maske, H, W, PAD_L, PAD_T)


P_FL = ebene(m_fluegel)
P_ST = ebene(m_stecker)
P_OL = ebene(m_ohr_l)
P_OR = ebene(m_ohr_r)
P_KP = ebene(m_rest | m_erg, spr_erg)                          # Körper + ergänzte Wicklungspixel (Kopf, Spule, Kabel)
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_KP, P_ST, P_OL, P_OR, P_FL)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()

THETA_C, THETA_A = math.radians(-20.0), math.radians(35.0)    # Drehwinkel −55° … +15° (Ruhe 0°)
THETA_P0 = math.asin(-THETA_C / THETA_A)
PIV = (PAD_L + 17.5, PAD_T + 12.0)                             # Flügelwurzel
Y_STRECK = PAD_T + 16                                          # Wicklung, die beim Strecken verdoppelt wird
Y_STECKER = PAD_T + 14                                         # Stecker pendelt um diese Zeile (Kabelansatz)
BLINZ = {21, 22, 23}


def streck_unten(a, zeile, n):
    """Zeile `zeile` n-mal zusätzlich einfügen: alles oberhalb bleibt, alles darunter rückt nach unten."""
    if n == 0:
        return a.copy()
    h = a.shape[0]
    if a[h - n:, :, 3].any():
        raise L.ClipError('streck_unten würde belegte Zeilen am unteren Rand abschneiden')
    rows = list(range(zeile + 1)) + [zeile] * n + list(range(zeile + 1, h - n))
    return a[rows].copy()


def schiebe_zeilen(a, dx_je_zeile):
    """Einzelne Zeilen (Leinwand-y → dx) waagerecht verschieben."""
    out = a.copy()
    h, w = a.shape[:2]
    for y, dx in dx_je_zeile.items():
        if not dx:
            continue
        xs_ = np.nonzero(a[y, :, 3])[0]
        if not len(xs_):
            continue
        if xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde aus der Leinwand geschoben')
        out[y] = 0
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out


def frame(i, partikel=True, effekte=True):
    u = lambda t: (1 - math.cos(2 * math.pi * t / (N / 4))) / 2     # Bob: Periode 12
    bob = -int(round(2 * u(i)))                                # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)
    streck = 1 if bob == -2 else 0                             # auf dem höchsten Punkt streckt sich die Spule
    ph = L.sinus(i, N / 8)                                     # Flügelschlag: achtmal pro Schleife (Periode 6)

    fl, st, ol, orr, kp = P_FL.copy(), P_ST.copy(), P_OL.copy(), P_OR.copy(), P_KP.copy()
    if effekte:
        F.lichtband(kp, metall_maske, PAD_L, PAD_T, i, N // 2, 4, 10, METALL, stufen=1, breite=3.0, achse=(1.0, 0.8))
        F.lichtband(st, metall_maske, PAD_L, PAD_T, i, N // 2, 4, 10, METALL, stufen=1, breite=3.0, achse=(1.0, 0.8))
        if i in BLINZ:
            for y, x in zip(*np.nonzero(m_augen)):
                kp[PAD_T + y, PAD_L + x, :3] = GELB

    # Flügelschlag: Federstreifen dreht sich um seine Wurzel
    ph2 = ph + 0.4 * math.sin(ph)                              # Abschlag schneller als Aufschlag
    theta = THETA_C + THETA_A * math.sin(ph2 + THETA_P0)
    fl = F.drehen(fl, PIV[0], PIV[1], theta, glatt=True)

    # Fühler wippen (Periode 24, rechter Fühler versetzt): Spitze (Zeile 0) schwingt weiter als Zeile 1
    def wippe(a, phase):
        s = math.sin(phase)
        return schiebe_zeilen(a, {PAD_T: int(round(1.4 * s)), PAD_T + 1: int(round(0.6 * s))})
    ol = wippe(ol, L.sinus(i, N / 2))
    orr = wippe(orr, L.sinus(i, N / 2, 1.7))

    # Stecker pendelt um den Kabelansatz (Zeilen über der Pivotzeile): kopfüber gespiegelt, damit zeilen_pendel (nur Zeilen UNTER dem Pivot) greift
    stf = st[::-1].copy()
    stf = F.zeilen_pendel(stf, H - 1 - Y_STECKER, 2.0, L.sinus(i, N / 2, 0.9), 1.0)
    st = stf[::-1].copy()

    kp = streck_unten(kp, Y_STRECK, streck)                    # Spule streckt sich
    fl, st, ol, orr, kp = (L.versetze(a, 0, bob) for a in (fl, st, ol, orr, kp))
    f = L.zusammen(H, W, [(kp, 0, 0), (st, 0, 0), (ol, 0, 0), (orr, 0, 0), (fl, 0, 0)])
    F.umranden(f, [ol, orr, fl], UMRISS, OLIV, OLIV, OLIV)                     # Randpixel-Test (Regel 16)
    F.umranden(f, [st, kp], UMRISS, DUNKEL, DUNKEL, DUNKEL)
    return f


def zuschneiden(frames, rand=2):
    """Frame auf die Figur zuschneiden und zentrieren: Vereinigung aller Frames + `rand` px."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()) - rand, int(ys.min()) - rand, int(xs.max()) + rand, int(ys.max()) + rand
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()))
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('wire-hatchling', 'Wire Hatchling', frames, MS, prev)
    if prev:
        L.streifen(prev + '/wire-hatchling-strip.png', frames, spalten=8, scale=6)
