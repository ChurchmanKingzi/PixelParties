# -*- coding: utf-8 -*-
"""Idle-Animation für „Cheering Rabbit“ (Creature).

Quelle: src/cheering-rabbit.png — der linke von drei Jubel-Hasen (30×24 px, 28 Farben) der Ebene 447 „Cheering Rabbit“ (72×27 px) aus MotiveMoe.xcf. Die Ebene zeigt drei Hasen
nebeneinander (wie auf der Karte), deren Leuchtstäbe (rechts vom linken, links vom mittleren Hasen) ineinanderlaufen. Gewählt: der LINKE — er ist als einziger vollständig und
frei (der rechte Hase ist gleich gezeichnet, der mittlere eine kleinere Pose desselben Hasen). Von Hand ausgeschnitten: Spalten 0–30 der Ebene, die wenigen Pixel des mittleren
Hasen (Ohr-/Körperumriss bei x ≥ 27 und die Stabreste unten rechts) entfernt, der eigene rechte Stab (x 20–29) bleibt komplett.
PICK: [["MotiveMoe", 447, 1]]   (Figur = linker Hase der Ebene, bbox (0,0)–(29,23); die Datei in src/ ist dieser Ausschnitt)

Aufruf:   python3 cheering_rabbit.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cheering-rabbit.png + .json

Identifikation (Sprite 30×24, weißer Hase von vorn in violettem Kleid mit je einem cyanfarbenen Leuchtstab/Pompon in jeder Hand, symmetrisch um x = 13,5):
* Ohren (Zeilen 0–4, links x 5–10, rechts x 17–22): zwei seitlich abstehende Schlappohren (brauner Umriss A, lavendelweiße Fläche B, graue Schatten C/D), nur über (10–11, 2–4) /
  (16–17, 2–4) mit dem Kopf verbunden; zwischen Ohrspitze und Wange ist Luft (Pixel (8–9, 4) frei).
* Kopf (x 9–18, Zeilen 4–11): lavendelweiß; Augen = geschlossene Lachaugen aus schwarzen Balken F (11–12,5) (15–16,5) (11–12,8) (10,6) (17,6) (15–16,7) (17,8), rechts ein
  helles Tränenpixel I (16,8); rosa Wangen L (10,9) (17,9); Schnäuzchen M/N/O/P (13–16, 9); offener Mund = dunkles G (12–14, 10) mit magentafarbener Zunge Q (13–14, 11), links/rechts
  davon lavendelweiß E.
* Körper (x 8–20, Zeilen 12–21): violett/rosa/blaues Kleid, Umrisse R/Z; unten Füße B/E (9–11, 22) (16–18, 22).
* Arme (links (6–8, 12–14), rechts (19–21, 12–14), lavendelweiß) halten je einen Stab: links x 0–7 Zeilen 7–14, rechts x 20–29 Zeilen 7–17, Cyan J / Türkis K / Marine G.
* Kein Glanz (Stoff/Fell; die Stäbe sind Plüsch-/Leuchtstoff, keine Edelsteine — Regel 14); keine Partikel. Augen sind schon geschlossen (Lachaugen) → kein Blinzeln, kein Blick.
Der rechte Pompon wurde in der Quelle doppelt gezeichnet; der untere/äußere zweite wird entfernt (s. DOPPELT im Skript).
Bleibt fest: Gesicht (außer Zunge), Kleid unter der Taille, Füße am Boden.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Jubelsprung (Periode 16, 3× pro Schleife): Hocke (Kleidzeile 19 entfernt, Oberkörper sinkt 1 px) → Absprung (Zeile 19 verdoppelt, Oberkörper streckt sich 1 px, Füße noch am Boden)
  → 2 px Höhe (Füße lösen sich 1-2-2-1) → Landung in der Hocke → Ruhe. Die Füße bleiben unten am Boden, bis der Hase wirklich abhebt.
* Stäbe schwenken (Periode 12, 4× pro Schleife): beide Arme samt Stab werden spaltenweise gebogen — je weiter vom Körper, desto höher/tiefer (Stabspitze bis ±3 px), links und rechts
  im Gegentakt. Die Armwurzel am Körper bleibt stehen, der Arm bleibt am Körperumriss.
* Ohren hängen nach: beim Absprung sacken die Ohrspitzen 1–2 px ab, beim Fallen/Landen fliegen sie 1–2 px hoch (die äußeren 4 Spalten, innen bleibt der Ansatz); zusätzlich flickt
  das linke Ohr bei Frame 12–14 und 43–45, das rechte bei 28–30 kurz nach oben.
* Zungenwackeln (Frames 9–16 und 33–40): die Zunge rutscht 1 px nach links und zurück (Q wandert auf das lavendelweiße E, das E auf den Platz von Q; sie bleibt unter dem dunklen Mund).
* Randpixel-Korrektur (Regel 16): wo das Biegen eine Füllfläche am Rand freilegt, wird ein Umrisspixel ergänzt (anim_tiere.umriss_schliessen).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16, siehe oben) und die verdoppelte Kleidzeile beim Strecken; sonst keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 4, 2

spr = L.lade('cheering-rabbit')
# Der rechte Pompon war doppelt (Rückmeldung des Spielgestalters): der untere/äußere zweite Pompon (Rest des Nachbarhasen, 20 Pixel) wird entfernt — übrig bleibt, gespiegelt zum linken, ein einzelner Pompon.
DOPPELT = [(26, 12), (27, 12), (25, 13), (26, 13), (27, 13), (22, 14), (24, 14), (25, 14), (26, 14), (27, 14), (28, 14), (24, 15), (25, 15), (26, 15), (27, 15), (25, 16), (26, 16), (26, 17), (28, 13), (29, 13)]
for _x, _y in DOPPELT:
    spr[_y, _x] = 0
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

arm_l = vorhanden & (xx <= 8) & (yy >= 7) & (yy <= 14)
arm_r = vorhanden & (((xx >= 19) & (yy >= 7) & (yy <= 14)) | ((xx >= 22) & (yy >= 15)))
ohr_l = vorhanden & (yy <= 4) & (xx <= 10) & ~((xx == 10) & (yy == 4))
ohr_r = vorhanden & (yy <= 4) & (xx >= 17) & ~((xx == 17) & (yy == 4))
koerper = vorhanden & ~arm_l & ~arm_r & ~ohr_l & ~ohr_r

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

ZEILE_STRECK = PAD_T + 19                                          # Kleidzeile, die beim Strecken/Hocken verdoppelt/entfernt wird
Q = tuple(int(v) for v in spr[11, 13, :3])                         # Zunge (217,0,255)
E_LI = tuple(int(v) for v in spr[11, 12, :3])                      # lavendelweißes Mundfeld links der Zunge
E_RE = tuple(int(v) for v in spr[11, 15, :3])

# Sprung, Periode 16: (Hub der Füße, Strecken(+)/Hocke(−) des Oberkörpers, Ohr-Nachhängen: + = Spitzen sacken, − = Spitzen fliegen hoch)
SPRUNG = [(0, 0, 0), (0, -1, -1), (0, -1, 0), (0, 1, 1), (1, 1, 1), (2, 0, 0), (2, 0, 0), (1, 0, -1),
          (0, -1, -1), (0, 0, 0), (0, 0, 0), (0, 0, 0), (0, 0, 0), (0, 0, 0), (0, 0, 0), (0, 0, 0)]
FLICK_LI = {12: -1, 13: -1, 14: 0, 43: -1, 44: -1, 45: 0}          # Ohrflick links (zusätzlich zum Nachhängen)
FLICK_RE = {28: -1, 29: -1, 30: 0}
ZUNGE = {9: 0, 10: 1, 11: 0, 12: 1, 13: 0, 14: 1, 15: 0, 16: 0, 33: 0, 34: 1, 35: 0, 36: 1, 37: 0, 38: 1, 39: 0, 40: 0}   # 1 = Zunge links


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def setze(k, x, y, farbe):
    k[PAD_T + y, PAD_L + x, :3] = farbe
    k[PAD_T + y, PAD_L + x, 3] = 255


def zustand(i):
    hub, streck, ohr = SPRUNG[i % 16]
    ohr_li = max(-1, min(1, ohr + FLICK_LI.get(i, 0)))
    ohr_re = max(-1, min(1, ohr + FLICK_RE.get(i, 0)))
    ph = L.sinus(i, 12)
    return hub, streck, ohr_li, ohr_re, ph, ZUNGE.get(i, 0)


def biegen(a, pivot, amp, phase):
    """Wie L.spalten_welle (Spalte wandert um round(amp · sin(phase) · Abstandsanteil)), aber die äußerste Spalte bekommt den Anteil ihrer Nachbarspalte: das einzelne
    Spitzenpixel des Stabs bliebe sonst bei einem Rundungsunterschied nur diagonal am Stab hängen (4er-Zusammenhang)."""
    out = L.leer(*a.shape[:2])
    h = a.shape[0]
    cols = [x for x in range(a.shape[1]) if a[:, x, 3].any()]
    maxd = max(abs(x - pivot) for x in cols)
    for x in cols:
        dy = int(round(amp * math.sin(phase) * min(abs(x - pivot), maxd - 1) / maxd))
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


def ohr_biegen(t, pivot, dy_amp):
    """Ohrspitzen wandern senkrecht: je weiter vom Ansatz (pivot), desto stärker (round(amp · Abstandsanteil)); Ansatz bleibt."""
    return L.spalten_welle(t, pivot, dy_amp, math.pi / 2)


def frame(i, nur=None):
    hub, streck, ohr_li, ohr_re, ph, zunge = zustand(i)
    k = teil(koerper)
    if zunge:                                                      # Zunge 1 px nach links (bleibt unter dem dunklen Mund (12–14, 10))
        setze(k, 12, 11, Q)
        setze(k, 14, 11, E_RE)
    k = L.streck_zeile(k, ZEILE_STRECK, streck)                    # Hocke (−1) / Strecken (+1); alles darüber bewegt sich, die Füße bleiben
    ol = ohr_biegen(teil(ohr_l), PAD_L + 10, 2.0 * ohr_li) if ohr_li else teil(ohr_l)
    orr = ohr_biegen(teil(ohr_r), PAD_L + 17, 2.0 * ohr_re) if ohr_re else teil(ohr_r)
    al = biegen(teil(arm_l), PAD_L + 9, 3.0, ph)
    ar = biegen(teil(arm_r), PAD_L + 18, 3.0, ph + math.pi)
    ebenen = {'koerper': (k, 0, 0), 'ohr_l': (ol, 0, -streck), 'ohr_r': (orr, 0, -streck), 'arm_l': (al, 0, -streck), 'arm_r': (ar, 0, -streck)}
    wahl = nur or ('koerper', 'ohr_l', 'ohr_r', 'arm_l', 'arm_r')
    ganz = L.zusammen(H, W, [(ebenen[n][0], 0, ebenen[n][2] - hub) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cheering-rabbit', 'Cheering Rabbit', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cheering-rabbit-strip.png', frames, spalten=12, scale=5)
