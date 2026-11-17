# -*- coding: utf-8 -*-
"""Idle-Animation für „Rebelliokai Backup Bakus“ (Creature) — das kleine grüne Baku mit den gefiederten Fächer-Ohren.

Quelle: src/rebelliokai-backup-bakus.png (20×20 px, 15 Farben).
PICK: [["MotiveJapan", 30, 1]]      (Ebene „Backup Bakus“, Figur 1 = das mittlere der drei Bakus der Karte; Ebene 135 „Ebene #124“ enthält dasselbe Baku sauber, Ebene 136 nur seine linke Hälfte —
Figur 1 ist links/rechts symmetrisch. Die beiden äußeren Bakus (Figur 2/3) sind weitgehend dieselbe Zeichnung. Die Knochen/Blut-Ebene unter den Bakus gehört nicht zur Figur.)
Quelle vollständig: ja (komplette Figur samt Füßen, nichts verdeckt).

Aufruf:   python3 rebelliokai_backup_bakus.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rebelliokai-backup-bakus.png + .json

Was im Sprite ist (x, y im 20×20-Sprite):
* FÄCHER-OHREN (x 0–6 links, 13–19 rechts, y 0–10): je ein grüner Blattfächer mit drei grauvioletten Federrippen (147,146,180)/(89,84,107)/(70,59,73) und dunkelblauem Umriss (23,24,42):
  eine obere Rippe (x 2–5, y 0–2), eine mittlere (x 0–4, y 3–5), eine untere (x 2–5, y 8–10). Der grüne Blattgrund sitzt am Kopf (x 5–8, y 2–9).
* KOPF (x 6–13, y 5–10): mittelgrüne Stirn; AUGEN: je ein dreipixeliger dunkler Winkel (23,12,0) mit dunkelblauem Pixel (6,66,102) bei (8,8)(7,9)(8,9) und (11,8)(12,9)(11,9).
* CYANFARBENE PIXEL (7,10)(7,11) und (12,10)(12,11) direkt unter den Augen, je hell (170,255,255) über (0,255,255). Ich lese sie als Glanz-/Tränenstrich und lasse sie bewusst FEST (Regel 1/21: nichts raten).
* STOSSZÄHNE/ZÄHNE: je zwei cremefarbene Pixel (218,207,179)/(243,241,220) bei (7,13)(7,14) und (12,13)(12,14) — fest.
* RÜSSEL/SCHNAUZE (x 8–11, y 10–17): grün schattierte Mittelbahn (95,142,100)/(120,160,126)/(78,118,91), fest.
* KÖRPER (x 5–14, y 11–19) dunkelgrün mit dunklem Umriss (28,34,20); zwei Füße unten (6–7, 19) und (12–13, 19).
Kein Metall, Gold oder Edelstein im Sprite (die grauen Rippen sind Federn/Knochen) → KEIN Glanz (Regel 14). Kein Feuer, keine Partikel.

RUNDE 3 (Nutzer: „sollte mit seinen Ohren fliegen wie Dumbo“): die Ohren schlagen jetzt kräftig wie Flügel, der Körper schwebt.
Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; Frame 0 = Original):
* OHRENSCHLAG (4 Schläge je Schleife, 12 Frames = 840 ms je Schlag, beide Ohren gleichzeitig wie Dumbo): jedes Ohr schwingt um den Ohransatz am Kopf (Spalte 5 links, Spalte 14 rechts) — die Ohrspitzen schlagen bis 5 px nach oben (über den Kopf) und
  bis 5 px nach unten (Ohren hängen), Frame 0 = Mittellage = Original. Vorher flatterte das Ohr nur als starrer Block um ±1 px. Technik: Scherung — jede Ohrspalte (x 0–4 bzw. 15–19) wandert als Ganzes senkrecht um round(5 · Abstand/5 · Schlag) px, das Gefälle
  beträgt höchstens 1 px je Spalte (≈ 45° Kippung der Rippen), nichts wird kopiert oder gestreckt; die dünnen Rippen bleiben 8-verbunden (F.fluegel_welle zusammenhang=True), die zur Wurzel hin angrenzende Spalte wird bei Abriss mitgeführt. Der grüne Blattgrund
  (x ≥ 5 bzw. x ≤ 14) bleibt am Kopf stehen; Löcher werden mit der Nachbarfarbe geschlossen, fehlende Umrisspixel in der Ohr-Umrissfarbe (23,24,42) ergänzt. Eine echte Drehung (Rückwärtsabbildung) wurde getestet und verworfen: die 1–2 px dünnen Rippen zerfielen dabei in Punkte.
* SCHWEBEN: der ganze Körper sinkt beim Aufschlag der Ohren bis 2 px und steigt beim Abschlag (Periode 12, 1 Frame nachlaufend); die Füße berühren dabei den Boden nicht mehr (er fliegt).
* BLINZELN (Frames 17–19 und 38–40): die dunklen Augenpixel nehmen die Stirnfarbe an, ein 2-px-Lidstrich (23,12,0) bleibt bei (7–8,9) und (11–12,9); die cyanfarbenen Striche bleiben. (Das Atmen entfällt.)
Fest: Gesicht, Rüssel, Zähne, cyanfarbene Striche. Kein Glanz, keine Partikel. Alle Bewegungen laufen auf der vollen Leinwand (ClipError statt Abschneiden). Nur ganze Pixel, nur Quellfarben.
Ergänzungen: keine gemalten Pixel außer Umrisspixeln (Regel 16).
"""
import math
import sys

import numpy as np

import anim_flieger as F
import anim_humanoide as Hm
import anim_lib as L
import anim_rebel as R
import anim_flieger_r3 as R3

N, MS = 48, 70
BEAT = 12                                         # Ohrenschlag: 4 pro Schleife
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 10, 6           # Ohrenschlag bis ≈ 5 px über/neben das Sprite, Schweben 2 px

spr = L.lade('rebelliokai-backup-bakus')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
f = lambda x, y: R.farbe(spr, x, y)

ERLAUBT = Hm.umrissfarben(spr)
UMRISS_G = f(8, 6)                                                  # (28,34,20)
UMRISS_B = f(2, 0)                                                  # (23,24,42)
STIRN = f(9, 8)                                                     # (120,160,126), Lidfarbe
AUGEN = [(8, 8), (7, 9), (8, 9), (11, 8), (12, 9), (11, 9)]
UMRISS_AUGE = f(8, 8)                                               # (23,12,0), Lidstrich


ohr_l = vorhanden & (xx <= 4) & (yy <= 10)
ohr_r = vorhanden & (xx >= sw - 5) & (yy <= 10)
rumpf = vorhanden & ~ohr_l & ~ohr_r
OHR_L = R.teil(spr, ohr_l, H, W, OFF)
OHR_R = R.teil(spr, ohr_r, H, W, OFF)
AMP = 5.0                                                          # Hub der Ohrspitze (px) nach oben und unten
KOERPER = R.teil(spr, rumpf, H, W, OFF)
LOCH0 = R3.eingeschlossen(L.platz(spr, H, W, *OFF)[..., 3] > 0)


def schlag(t):
    """−1 … +1: positiv = Ohren oben (Aufschlag), negativ = Ohren unten; 0 bei Frame 0 (Mittellage = Original)."""
    return math.sin(2 * math.pi * t / BEAT)


def hub(t):
    """Senkrechter Versatz der äußersten Ohrspalte (px, positiv = nach unten): Aufschlag (schlag > 0) hebt die Ohren."""
    return -AMP * schlag(t)


def bob(t):
    return int(round(2.0 * schlag(t - 1.0) * 1.0))             # Körper sinkt beim Aufschlag der Ohren (Frame 0: 0 bei sin(−2π/12) → −1: s.u.)


def bob0(t):
    return bob(t) - bob(0)


def frame(i, nur=None):
    k = KOERPER.copy()
    # Blinzeln: dunkle Augenpixel → Stirnfarbe
    if Hm.folge(i, 17, [1, 1, 1], N) or Hm.folge(i, 38, [1, 1, 1], N):
        Hm.setze(k, {p: STIRN for p in AUGEN}, OFF)
        Hm.setze(k, {(7, 9): UMRISS_AUGE, (8, 9): UMRISS_AUGE, (11, 9): UMRISS_AUGE, (12, 9): UMRISS_AUGE}, OFF)     # geschlossenes Lid = dunkler Strich
    amp = hub(i)
    ol = F.fluegel_welle(OHR_L, PAD_L + 5, amp, math.pi / 2, nur_rechts=False, zusammenhang=True)
    orr = F.fluegel_welle(OHR_R, PAD_L + 14, amp, math.pi / 2, nur_rechts=True, zusammenhang=True)
    b = bob0(i)
    fig = L.zusammen(H, W, [(L.versetze(ol, 0, b), 0, 0), (L.versetze(orr, 0, b), 0, 0), (L.versetze(k, 0, b), 0, 0)])
    fig = R3.luecken_fuellen(fig, 4, ausser=np.roll(LOCH0, b, axis=0))
    # Regel 16: Randpixel in Nicht-Umrissfarbe → Umriss (Ohren navy, Körper dunkelgrün)
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            ohr = (ol[y - b, x, 3] > 0 or orr[y - b, x, 3] > 0) if 0 <= y - b < H else False
            fig[y, x, :3] = UMRISS_B if ohr else UMRISS_G
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = R.vorschau_arg()
    R.abschluss('rebelliokai-backup-bakus', 'Rebelliokai Backup Bakus', frames, MS, spr, OFF, prev,
                nahaufnahmen=[('ohr', None, [0, 2, 3, 4, 6, 9, 10])])
