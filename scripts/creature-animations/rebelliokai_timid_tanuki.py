# -*- coding: utf-8 -*-
"""Idle-Animation für „Rebelliokai Timid Tanuki“ (Creature) — der weinende Tanuki (Marderhund): beide Arme erschrocken nach oben gerissen, großer roter Mund, Tränen, gestreifter Schwanz rechts.

Quelle: src/rebelliokai-timid-tanuki.png (30×29 px, 22 Farben).
PICK: [["MotiveJapan", 182, 1]]      (Ebene „Tanuki“, Figur 1, same 0,877 — die Kirschblüten der Kunst liegen über der Figur; die Ebenen 175 („Ebene #88“, eine Variante mit nur einem erhobenen Arm) und 177 („Tanuki-Kopie“, Kopie derselben Zeichnung) bleiben ungenutzt)
Quelle vollständig: ja (ganze Figur mit beiden Armen, Schwanz, Beinen und Füßen; nichts verdeckt).

Aufruf:   python3 rebelliokai_timid_tanuki.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rebelliokai-timid-tanuki.png + .json

Was im Sprite ist (x, y im 30×29-Sprite):
* OHREN (x 9–12 und 16–20, y 0–3): kleine rundliche Ohren, braun (143,80,60)/(104,53,32) mit hellem Innenohr (146,105,80) und dunklem Rand (48,7,6).
* GESICHT (x 9–20, y 4–12): braunes Fell mit hellerem Maul (176,122,86)/(219,182,156); zwei große weiße AUGEN (255,255,255) mit je einer schwarzen Pupille (0,0,0) bei (13,7) und (16,7); unter dem Auge je zwei cyanfarbene TRÄNEN-Pixel
  (136,255,255) über (45,255,255) bei (11,7–8) und (18,7–8) — der Tanuki weint; schwarze Nase (14,8)(13–14,9); weit offener roter Mund (71,0,0)/(139,0,0)/(170,0,0) bei (13–17, 10–11).
* ARME: links (x 0–8, y 4–12) und rechts (x 22–29, y 4–11) erschrocken hochgerissen, schräge braune Bänder mit dunklen Pfoten (12,1,1)/(48,7,6)/(94,43,44) oben außen.
* KÖRPER (x 7–21, y 12–23): cremefarbener Bauch (231,208,170)/(219,182,156) mit rotem Bauchnabel-Fleck (174,67,50)/(67,14,15) bei (13–16, 17–20), braune Flanken; Beine/Füße (x 9–20, y 23–28).
* SCHWANZ (x 22–27, y 11–22): gestreift in dunklem Violett/Braun (39,17,25)/(66,30,45)/(94,43,44) mit orangem Fleck (171,97,62) bei (25,15–16), hängt rechts am Körper.
Kein Metall/Gold/Edelstein, kein Feuer → kein Glanz, keine Partikel.

Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos; Frame 0 = Original; Bodenwesen — die Füße bleiben unten):
* ARME FLATTERN: beide erhobenen Arme zittern aufgeregt: jede Spalte der Armbänder wandert senkrecht, je weiter außen (Pfote), desto mehr (bis 2 px, Gefälle ≤ 0,25 px je Spalte, Nachlauf zur Pfote); links 3 Schwünge je Schleife, rechts 4 — nie im Gleichschritt.
* TRÄNEN: beide Augen weinen fortlaufend: je Zyklus bildet sich eine Träne unter dem Auge (oberes Pixel), ruht an der Originalstelle, rollt dann zwei Schritte die Wange hinab und ist weg; links dauert ein Zyklus 15, rechts 20 Frames (nie im Gleichschritt);
  die Wange wird aus den Originalfarben wiederhergestellt.
* SCHLUCHZEN (Brust hüpft): in zwei Schluchzanfällen (Frames 8–15 und 38–45) hebt sich Kopf und Oberkörper alle 2 Frames um 1 px (die Zeile 22, Bauchsaum, wird eingefügt; die Arme steigen starr mit), dazwischen atmet er langsam (2× je Schleife).
* OHREN ZUCKEN: das linke Ohr (Zeilen 0–1) rückt 1 px nach außen (Frames 18–21), das rechte (Frames 48–51).
* SCHWANZ SCHWINGT: die Zeilen 15–22 des Schwanzes pendeln nach außen (rechts), je weiter unten, desto mehr (1–2 px); der Ansatz (y 11–14) bleibt am Körper.
* BLINZELN (Frames 28–30 und 52–54): die weißen Augenpixel und die Pupillen nehmen die Fellfarbe (143,80,60) an; die Tränen bleiben.
Fest: Mund, Nase, Bauch, Beine, Pfotenform. Alle Bewegungen laufen auf der vollen Leinwand (ClipError statt Abschneiden). Nur ganze Pixel, nur Quellfarben.
Ergänzungen: keine gemalten Pixel (die Wange unter den Tränen wird aus Quellfarben der Nachbarpixel hergestellt: (11,7)→Augenweiß (255,255,255), (11,8)/(18,8)→Fell (104,53,32), darunter die Originalpixel).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_rebel as R

N, MS = 60, 70
PAD_L, PAD_R, PAD_T, PAD_B = 2, 4, 3, 2

spr = L.lade('rebelliokai-timid-tanuki')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
f = lambda x, y: R.farbe(spr, x, y)

ERLAUBT = set(Hm.umrissfarben(spr))
UMRISS = f(9, 4)                                                    # (48,7,6)
FELL = f(10, 12)                                                    # (104,53,32)? wird unten geprüft
WEISS, PUPILLE = f(12, 5), f(13, 7)
LIDFARBE = f(10, 9)                                                 # Fellbraun (104,53,32)
TR_OBEN, TR_UNTEN = f(11, 7), f(11, 8)                              # (136,255,255), (45,255,255)
assert TR_OBEN == (136, 255, 255) and TR_UNTEN == (45, 255, 255)

arm_l = vorhanden & (xx <= 8) & (yy <= 12)
arm_r = vorhanden & (xx >= 22) & (yy <= 11)
schwanz = vorhanden & (xx >= 22) & (yy >= 12)
ohr_l = vorhanden & (xx <= 13) & (yy <= 1) & (xx >= 9)
ohr_r = vorhanden & (xx >= 16) & (yy <= 1) & (xx <= 21)
rumpf = vorhanden & ~arm_l & ~arm_r & ~schwanz & ~ohr_l & ~ohr_r
AUGEN = [(11, 5), (12, 5), (13, 5), (11, 6), (12, 6), (13, 6), (12, 7), (13, 7), (16, 5), (17, 5), (16, 6), (17, 6), (18, 6), (16, 7), (17, 7)]
LOCH0 = R.loecher(L.platz(spr, H, W, *OFF))

# Tränenzyklen: 0 = bildet sich (nur oberes Pixel), 1 = Ruhe (Original), 2/3 = rollt die Wange hinab, 4 = weg
TR_L = [0, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 4, 4]
TR_R = [0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4]


def traene(a, x, ph, oben_fuell, unten_fuell):
    """Tränenphase ph an Spalte x setzen; (x,7) und (x,8) werden aus Quellfarben wiederhergestellt."""
    if ph == 1:
        return
    ersatz = {(x, 7): oben_fuell, (x, 8): unten_fuell}
    if ph == 0:
        ersatz[(x, 7)] = TR_OBEN
    elif ph == 2:
        ersatz[(x, 8)] = TR_OBEN
        ersatz[(x, 9)] = TR_UNTEN
    elif ph == 3:
        ersatz[(x, 9)] = TR_OBEN
        ersatz[(x, 10)] = TR_UNTEN
    Hm.setze(a, ersatz, OFF)


def frame(i):
    # Atmen / Schluchzen: b = 1 → Oberkörper 1 px höher
    atem = Hm.stufe(i, N / 2, 1)
    schl = 1 if (Hm.folge(i, 8, [0, 1, 1, 0, 0, 1, 1, 0], N) or Hm.folge(i, 38, [0, 1, 1, 0, 0, 1, 1, 0], N)) else 0
    b = 1 if (atem or schl) else 0
    k = R.teil(spr, rumpf, H, W, OFF)
    al = R.teil(spr, arm_l, H, W, OFF)
    ar = R.teil(spr, arm_r, H, W, OFF)
    sw_ = R.teil(spr, schwanz, H, W, OFF)
    ol = R.teil(spr, ohr_l, H, W, OFF)
    orr = R.teil(spr, ohr_r, H, W, OFF)
    # Tränen
    traene(k, 11, TR_L[(i + 1) % len(TR_L)], WEISS if False else f(12, 5), f(10, 9))
    traene(k, 18, TR_R[(i + 1) % len(TR_R)], f(17, 6), f(17, 9))
    # Blinzeln
    if Hm.folge(i, 28, [1, 1, 1], N) or Hm.folge(i, 52, [1, 1, 1], N):
        Hm.setze(k, {p: LIDFARBE for p in AUGEN}, OFF)
    # Arme flattern (Spaltenversatz um die Schulter)
    al = R.spalten_pendel(al, PAD_L + 9, 2.0, L.sinus(i, N / 3), lauf=0.8, ruhe0=True)
    ar = R.spalten_pendel(ar, PAD_L + 21, 2.0, L.sinus(i, N / 4), lauf=0.8, ruhe0=True, versatz=1.5)
    # Ohren zucken nach außen
    if Hm.folge(i, 18, [1, 1, 1, 1], N):
        Hm.zeilen_versatz(ol, OFF, {0: -1, 1: -1})
    if Hm.folge(i, 48, [1, 1, 1, 1], N):
        Hm.zeilen_versatz(orr, OFF, {0: 1, 1: 1})
    # Schwanz schwingt nach außen
    u = 0.5 * (1 - math.cos(L.sinus(i, N / 3)))
    u = 0.7 * u + 0.3 * 0.5 * (1 - math.cos(L.sinus(i, N / 5)))
    sw_ = R.zeilen_pendel(sw_, PAD_T + 14, 1.8 * min(1.0, u), math.pi / 2)
    if b:
        k = L.streck_zeile(k, PAD_T + 22, 1)
        al, ar, ol, orr = (L.versetze(e, 0, -1) for e in (al, ar, ol, orr))
        sw_ = L.streck_zeile(sw_, PAD_T + 22, 1)
    fig, etik = R.schichten(H, W, [(sw_, 'schwanz'), (k, 'rumpf'), (al, 'arm'), (ar, 'arm'), (ol, 'rumpf'), (orr, 'rumpf')])
    fig, _br = R.verbinde(fig)
    R.neue_loecher_fuellen(fig, LOCH0, ERLAUBT)
    R.kontur_je_teil(fig, etik, ERLAUBT, {}, standard=UMRISS)
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = R.vorschau_arg()
    R.abschluss('rebelliokai-timid-tanuki', 'Rebelliokai Timid Tanuki', frames, MS, spr, OFF, prev)
