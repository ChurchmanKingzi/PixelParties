# -*- coding: utf-8 -*-
"""Idle-Animation für „Rebelliokai Terror Tengu“ (Creature) — der Tengu mit grauer Kapuze, langer roter Nase und den schwarzen, um den Körper gelegten Flügeln.

Quelle: src/rebelliokai-terror-tengu.png (24×26 px, 25 Farben).
PICK: [["MotiveJapan", 200, 1]]      (Ebene „Ebene #99“, Figur 1, same 1,0; Ebene 199 ist dieselbe Figur ohne die roten Hände — Variante, ungenutzt)
Quelle vollständig: ja (komplette Figur samt Füßen, nichts verdeckt).
NICHT enthalten: der große Fächer (Ebenen 197/198/201/205, rosa-beige mit Goldrand), der in der Karte rechts oben über dem Flügel schwebt. Die Karte zeigt ihn weder in einer der Ebenen deckungsgleich (beste Übereinstimmung 46 %, er ist dort offenbar
in einem Effekt verwischt), noch hängt er sichtbar an der Hand: seine Stange verschwindet hinter dem Flügel → ich lasse ihn weg (Unsicherheit: gehört der Fächer zur Figur?).

Aufruf:   python3 rebelliokai_terror_tengu.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rebelliokai-terror-tengu.png + .json

Was im Sprite ist (x, y im 24×26-Sprite):
* KAPUZE/HELM (x 7–16, y 0–9): grau (112,105,94)/(152,152,152)/(182,182,170)/(119,119,119) mit dunklem Rand (51,51,51); oben drei kleine Zacken (10,1)(12,0–1)(14,1) (Federkamm).
* GESICHT (x 7–16, y 7–12): dunkelrote Haut (58,21,19)/(87,35,29)/(100,51,46)/(75,31,32); die AUGEN: schwarze Lidpixel (0,0,0) bei (9,7)(14,7)(10,8)(13,8), hellblaue Iris (172,213,255) bei (9,8)(14,8), weißes Auge (246,255,255) bei (9,9)(14,9), pfirsichfarbenes (249,203,152) bei (10,9)(13,9);
  lange, rote NASE (x 11–12, y 9–16) in (117,42,38)/(175,70,58)/(201,102,92) — Tengu-Schnabelnase.
* SCHAL/KRAGEN (y 13–18): brauner Schalstreifen (38,33,26) über die Schultern (y 13), darunter ein grauer Federkragen (182,182,170)/(112,105,94)/(109,109,109) (y 14–18) mit hellen Schulterstücken (5,14)(5,15) und (18,14)(18,15).
* HÄNDE: rote Fäuste (201,102,92)/(175,70,58) mit dunkelrotem Rand (75,31,32) bei (2–4, 13–16) und (19–21, 13–16), vor den Flügeln.
* RUMPF/ROCK (x 7–16, y 17–25): braun (56,49,38)/(38,33,26) mit grauen Gürtelstücken (109,109,109)/(73,73,73)/(112,105,94) (y 20–21) und grauen Stiefelspitzen (y 23–24); zwei Füße (y 25).
* FLÜGEL (x 0–6 links, 17–23 rechts, y 1–21): schwarz-grüne Federn (8,10,9)/(31,40,39)/(19,24,22)/(39,48,47) mit senkrechten Federstreifen; sie sind um den Körper gelegt (nicht ausgebreitet) und enden unten in Spitzen (y 17–21).
Der Tengu STEHT (Füße am Boden, Flügel angelegt) → er schwebt nicht; kein Metall/Gold/Edelstein → KEIN Glanz; kein Feuer; keine Partikel.

Ablauf (60 Frames à 80 ms = 4,8 s, nahtlos; Frame 0 = Original):
* FLÜGELSPITZEN WEHEN: die Spitzen beider Flügel (Zeilen 17–21) pendeln nach außen (links nach links, rechts nach rechts, nie zum Körper): jede Zeile wandert waagerecht um bis 2 px, je weiter unten, desto mehr (Gefälle ≤ 0,4 px je Zeile,
  Nachlauf zur Spitze); links 3, rechts 2 Schwünge je Schleife, gegeneinander versetzt.
* FEDERSPITZEN FLICKERN: die oberste Flügelzeile (y 1) rückt kurz 1 px nach außen (links Frames 8–13, rechts 34–39, 52–55 usw.), wie ein Aufstellen der Federn.
* ATMEN (2× je Schleife): die Rockzeile 19 wird einmal doppelt eingefügt (gleichmäßige braune Zeile): Kopf, Kragen, Hände und Flügel steigen 1 px, Beine bleiben stehen.
* BLINZELN (Frames 22–24 und 46–48): die Iris-/Augenpixel nehmen die Hautfarben der Umgebung an ((87,35,29)/(100,51,46)), die obere Lidzeile wird zu (0,0,0): ein dunkler Strich.
Fest: Kapuze und Kamm, Nase, Kragen, Rock, Füße. Alle Bewegungen laufen auf der vollen Leinwand (ClipError statt Abschneiden). Nur ganze Pixel, nur Quellfarben.
Ergänzungen: keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_rebel as R

N, MS = 60, 80
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 3, 2

spr = L.lade('rebelliokai-terror-tengu')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
f = lambda x, y: R.farbe(spr, x, y)

ERLAUBT = set(Hm.umrissfarben(spr))
UMRISS_FLUEGEL, UMRISS_KOERPER = f(0, 5), f(8, 25)
HAUT_AUSSEN, HAUT_MITTE, LID = f(8, 9), f(11, 9), f(10, 8)           # (87,35,29), (100,51,46), schwarz (0,0,0)
AUGE_L, AUGE_R = [(9, 8), (9, 9), (10, 9)], [(14, 8), (14, 9), (13, 9)]
schwanz_l = vorhanden & (xx <= 6) & (yy >= 17)
schwanz_r = vorhanden & (xx >= 18) & (yy >= 17)
rumpf = vorhanden & ~schwanz_l & ~schwanz_r
LOCH0 = R.loecher(L.platz(spr, H, W, *OFF))


def frame(i):
    b = Hm.stufe(i, N / 2, 1)
    k = R.teil(spr, rumpf, H, W, OFF)
    tl = R.teil(spr, schwanz_l, H, W, OFF)
    tr = R.teil(spr, schwanz_r, H, W, OFF)
    # Flügelspitzen wehen nach außen
    def aus(i_, per, vers, amp):
        s = (math.sin(L.sinus(i_, per) + vers) - math.sin(vers)) / 2.0          # 0 bei Frame 0
        return max(0.0, -s) * amp * 2 if s < 0 else 0.0
    sl = (math.sin(L.sinus(i, N / 3) + 0.9) - math.sin(0.9)) / 2.0
    sr = (math.sin(L.sinus(i, N / 2) + 2.0) - math.sin(2.0)) / 2.0
    tl = R.zeilen_pendel(tl, PAD_T + 16, 2.3 * max(0.0, -sl) * 2 + 0.0, math.pi / 2, lauf=0.0)
    tr = R.zeilen_pendel(tr, PAD_T + 16, -2.3 * max(0.0, -sr) * 2 + 0.0, math.pi / 2, lauf=0.0)
    # Federspitzen flickern
    if Hm.folge(i, 8, [1] * 6, N):
        Hm.bereich_versatz(k, OFF, {1: -1}, 0, 6)
    if Hm.folge(i, 34, [1] * 6, N) or Hm.folge(i, 52, [1] * 4, N):
        Hm.bereich_versatz(k, OFF, {1: 1}, 17, 23)
    # Blinzeln
    if Hm.folge(i, 22, [1, 1, 1], N) or Hm.folge(i, 46, [1, 1, 1], N):
        Hm.setze(k, {(9, 8): LID, (14, 8): LID, (9, 9): HAUT_AUSSEN, (14, 9): HAUT_AUSSEN, (10, 9): HAUT_MITTE, (13, 9): HAUT_MITTE}, OFF)
    if b:
        k, tl, tr = (L.streck_zeile(e, PAD_T + 19, 1) for e in (k, tl, tr))
    fig, etik = R.schichten(H, W, [(tl, 'fluegel'), (tr, 'fluegel'), (k, 'koerper')])
    R.neue_loecher_fuellen(fig, LOCH0, ERLAUBT)
    R.kontur_je_teil(fig, etik, ERLAUBT, {'fluegel': UMRISS_FLUEGEL, 'koerper': UMRISS_KOERPER}, standard=UMRISS_KOERPER)
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = R.vorschau_arg()
    R.abschluss('rebelliokai-terror-tengu', 'Rebelliokai Terror Tengu', frames, MS, spr, OFF, prev)
