# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Zhu“ (Creature) — das Schwein/der Keiler (Zhu): ein großer brauner Eber, der zusammengerollt am Boden liegt, links der Kopf mit der hellen Hauerkrümmung.

Quelle: src/guardian-beast-zhu.png (45×16 px, 22 Farben).
PICK: [["MotiveGuardianBeasts", 56, 1]]      (Ebene „Zhu #1“, Figur 1; Ebene 57 „Zhu“ ist dasselbe Tier aufrecht von vorn mit ausgebreiteten Armen — andere Pose, nicht verwendet)
Quelle vollständig: ja (Kopf, Hauer, Körper, Hinterhuf in einer Ebene).

Aufruf:   python3 guardian_beast_zhu.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-zhu.png + .json

Identifikation (x, y im 45×16-Sprite):
* HAUER/HORN (x 3–16, y 2–9): weiß-cremefarbene gebogene Hauerkrümmung (246,241,220)/(253,252,243)/(223,216,175) mit dunkler Kante (54,52,37); am linken Ende ein goldbrauner Aufsatz
  (193,155,65)/(168,124,32)/(128,104,59) — Horn/Knochen, kein Metall: kein Glanz.
* KOPF (x 2–13, y 9–14): braunes Fell (148,125,71)/(163,150,88), graue Schnauze (142,145,139)/(181,184,183) bei (9–13, 9–13) mit zwei schwarzen senkrechten Schlitzen bei (10, 10–11) und (12, 10–11)
  — sie lesen sich als NASENLÖCHER (nicht als Augen) und bleiben fest; darüber ein schwarzer Strich (10–12, 8).
* KÖRPER (x 14–40, y 0–15): großer Rücken/Bauch, Fell in (94,69,39)/(108,85,47)/(115,97,55)/(148,125,71)/(163,150,88) mit helleren Bändern; zum Boden hin dunkler (64,47,26); Bodenlinie y 15.
* OHR/KLAUE oben (x 22–25, y 1–3): grauer 2×2-Block (89,92,87)/(142,145,139)/(181,184,183) mit schwarzem Rand (26,26,21) — das spitze Ohr (oder Vorderhuf) an der Rückenkante.
* HINTERHUF (x 41–44, y 7–14): grauer Huf (142,145,139)/(181,184,183) mit schwarzem Rand, ragt rechts aus dem Körper; davor ein hellerer Fellstreifen (x 38–41, y 11).
Fest bleiben: Kopf mit Schnauze, Hauer, Bauch/Bodenlinie.

Ablauf (48 Frames à 80 ms = 3,84 s, nahtlos):
* ATMEN (zweistufig): der Rücken (alles rechts von x 16 oberhalb der Bodenzone) hebt sich langsam um bis zu 2 px (Zeile 9 wird 1–2× eingefügt, mit Nachbartextur gemischt, L.streck_zeile) und senkt sich
  wieder; Bauchzone und Kopf bleiben am Boden.
* HANDZUCKEN (Nutzer-Feedback Runde 3: „Outline der Hand wird teilweise dicker – niemals Outlines dicker machen“): die Hand (grauer Block samt 1 px Umriss) hebt sich in den Frames 14–19 und 36–41 um 1 px;
  ihr Umriss wandert mit und bleibt überall 1 px dick; was darunter frei wird, wird Fell (Streifenmuster der Nachbarzeile), nur (22,2) bleibt als einzelnes Umrisspixel über dem Fell.
* HUFTIPPEN: der Hinterhuf (x 41–44) tippt in den Frames 26–29 einmal 1 px nach unten auf die Bodenlinie.
Frame 0 = Ruhepose (Original). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: beim Handzucken (22,2) Umrissschwarz (26,26,21), (23,3) und (24,3) Fell (148,125,71), (25,3) Fell (163,150,88) — die Zellen unter der angehobenen Hand; sonst keine.
"""
import os
import sys

import numpy as np

import anim_amorph as A
import anim_gbb as G
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 80
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 5, 3

spr = L.lade('guardian-beast-zhu')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
SCHWARZ = (26, 26, 21)
FELL_E, FELL_F = (148, 125, 71), (163, 150, 88)                                   # Fellstreifen neben der Hand (siehe Sprite-Zeile 3/4)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ohr_m = vorhanden & (xx >= 22) & (xx <= 25) & (yy >= 1) & (yy <= 3) & ((yy <= 2) | (xx >= 23)) & (
    L.farbmaske(spr, [SCHWARZ, f(23, 1), f(24, 1), f(23, 2), f(24, 2)]))
huf_m = vorhanden & (xx >= 41) & (yy >= 7)
kopf_m = vorhanden & (xx <= 16)
koerper_m = vorhanden & ~kopf_m & ~huf_m & ~ohr_m


def ebene(m, dx=0, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L + dx, PAD_T + dy)


def frame(i):
    r = int(round(2 * (0.5 - 0.5 * np.cos(L.sinus(i, N)))))                      # Atemhub 0…2
    kp = ebene(koerper_m)
    kp = L.streck_zeile(kp, PAD_T + 9, r)
    ohr = ebene(ohr_m)
    hoch = 1 if (Hm.folge(i, 14, [1] * 6, N) or Hm.folge(i, 36, [1] * 6, N)) else 0
    if hoch:
        # Hand (Block 23–24 / 1–2 samt Umriss) um eine Zeile anheben. Der Umriss wandert mit (bleibt 1 px dick, NIE verdoppeln!); die freigelegten Zellen werden zu Fell bzw. bleiben
        # als einzelnes Umrisspixel an der Fellkante stehen: (22,2) Umriss über dem Fell (22,3); (23,3), (24,3), (25,3) Fell im Streifenmuster der Nachbarzeile (E, E, F).
        ohr = L.versetze(ohr, 0, -1)
        Hm.setze(ohr, {(22, 2): SCHWARZ, (23, 3): FELL_E, (24, 3): FELL_E, (25, 3): FELL_F}, (PAD_L, PAD_T))
    ohr = L.versetze(ohr, 0, -r)
    huf = ebene(huf_m)
    if Hm.folge(i, 26, [1, 1, 1, 1], N):
        huf = L.versetze(huf, 0, 1)
    kopf = ebene(kopf_m)
    fig = L.zusammen(H, W, [(kopf, 0, 0), (kp, 0, 0), (huf, 0, 0), (ohr, 0, 0)])
    fig, _ = A.verbinde4(fig)
    G.rand_schliessen(fig, ERLAUBT, SCHWARZ)
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('guardian-beast-zhu', 'Guardian Beast Zhu', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/guardian-beast-zhu-strip.png', frames, spalten=6, scale=6)
