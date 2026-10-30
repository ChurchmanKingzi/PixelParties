# -*- coding: utf-8 -*-
"""Idle-Animation für „Tamed Hell Fox“ (Creature).

Quelle: src/tamed-hell-fox.png — 47×32 px, 15 Farben, aus Motive.xcf, Ebene 846 (96×73 px, trägt zwei Posen desselben Fuchses
übereinander: oben Figur 1, unten Figur 2).
PICK: [["Motive", 846, 2]]   (Figur 2 = untere Pose, offene weiße Augen — so steht er auf der Karte; Figur 1 ist dieselbe Pose
mit zugekniffenen Augenecken und gefaltetem linken Ohr und dient nur als Referenz für den Zwischenschritt beim Blinzeln.)
Gefunden über die Pixelkarte: creature_show.py kennt die Ebene nicht (die Suche lieferte nur den Menschen/Zügel „Tamed Hell Fox #1“,
Ebene 845); der Fuchs steht in der Nachbarebene 846 und stimmt farblich/formal mit der Karte überein (weiße Augenblöcke).
Es ist KEIN umgefärbter Hell Fox, sondern eine eigene Zeichnung (265 Pixel weichen vom Hell Fox ab).

Aufruf:   python3 tamed_hell_fox.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/tamed-hell-fox.png + .json

Identifikation (Sprite 47×32, Fuchs im Profil nach links, Kopf links):
* Kopf (x 0–15, y 1–16): hellbeige Schnauze/Gesicht (H/I/J/N), zwei rote Ohren mit dunklem Umriss (links x 4–7, rechts x 10–14,
  Zeilen 0–4), zwei WEISSE Augenblöcke ohne Pupille (links 2×3: x 3–4, y 9–11; rechts 3×3: x 7–9, y 9–11), Nase = fast schwarze
  Pixel an der Schnauzenspitze (0–2, 14–16), braune Wangen-/Mähnenpartie (C) hinten am Kopf, Unterkieferlinie braun (3–10, 16).
* Zwei weiße Reißzähne ragen aus dem Unterkiefer (3,17) und (6,17) — Zähne, keine Partikel: sie sitzen fest am Kiefer und
  gehen nur mit dem Kopf mit.
* Schwarzer Fleck unter dem Kinn (9–15, 15–19; L/M/O): Halsband/Schatten zwischen Kinn und Vorderbein (an dieser Stelle läuft auf
  der Karte die Leine zum Menschen) — bleibt fest am Rumpf.
* Rumpf: roter Körper mit dunklem Umriss (A), beige Bauchfellpartie (20–29, 18–21), vier Beine (vorn x 6–13 und 14–20, hinten
  x 25–35), dunkelrote Schattierung (E/G) an den Füßen. Dunkle Binnenlinien (35–37, 19–20) = Kruppen-/Schenkelkante, Füllung.
* Schwanz (x ≥ 37, Zeilen 15–31): hängt vom Rücken diagonal nach rechts unten, beige Spitze (43–46, 22–30); Binnenlinie zwischen
  rotem Schwanz und Spitze (38–42, 19–23) ist Füllung, kein Außenumriss.
* Fest: Kinn-/Halsband, Nase, Zähne, Bauchfell, Beine/Füße.

Ablauf (40 Frames à 70 ms = 2,8 s) — gleiche Mechanik wie Hell Fox, aber ein zahmer, freudiger Fuchs:
* Atmen (Periode 40): Rumpf hebt sich 1 px (Zeile 22 wird eingefügt), Füße bleiben, Kopf/Ohren/Schwanzansatz steigen mit.
* Kopfnicken (Periode 40, versetzt): Kopf senkt sich 1 px relativ zum Rumpf; die Zähne gehen mit dem Kopf.
* Ohrzucken: links Frames 6–9, rechts Frames 22–25 (Zeilen oberhalb des Ansatzes weichen 1 px nach außen aus).
* Schwanzwedeln (Periode 10 = 4× pro Schleife, schneller als beim wilden Hell Fox; Spitze läuft nach, Amplitude blendet über die
  Schleife ein/aus, Frame 0 = Original): Zeilen wandern seitlich, der Außenumriss wird neu gezogen (4-verbunden), Lücke zum Rumpf
  wird geschlossen.
* Blinzeln (Frames 30–34): die weißen Augenblöcke schließen sich in drei Stufen (Augenecken zu — aus Figur 1 des Quell-Bildes —,
  obere Zeile zu, ganz zu mit braunem Lidstrich) und öffnen sich wieder.
* Glut: vier einzelne Funken (1 px; helles Beige und Fellrot aus dem Sprite) steigen langsam vom Rücken auf, verglimmen flackernd,
  hinter dem Fuchs (anim_tiere.funken_ebene). Keine Kreuz-/Rautenformen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel nötig (Kopf liegt über dem Rumpf; der Schwanzumriss entsteht aus den Quellfarben A/C).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 40, 70
PAD_L, PAD_R, PAD_T, PAD_B = 5, 8, 7, 3

spr = L.lade('tamed-hell-fox')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
dunkel = L.farbmaske(spr, [(0, 0, 0), (26, 26, 26), (14, 8, 8)])

zaehne = vorhanden & (xx <= 8) & (yy == 17) & (spr[..., :3].min(axis=2) == 255)               # (3,17), (6,17)
kopf_alles = (vorhanden & (xx <= 15) & (yy <= 16) & ~(dunkel & (xx >= 9) & (yy >= 15))) | zaehne
ohr_l = kopf_alles & (xx <= 8) & (yy <= 4)
ohr_r = kopf_alles & (xx >= 10) & (xx <= 14) & (yy <= 4)
kopf = kopf_alles & ~ohr_l & ~ohr_r
schwanz = vorhanden & (xx >= 37)
rumpf = vorhanden & ~kopf_alles & ~schwanz

UMRISS_A, UMRISS_D = (51, 12, 12), (104, 84, 58)
HELL, FELL2, LIDSTRICH = (232, 193, 152), (224, 182, 126), UMRISS_D          # Fell (Lid) / Wange / brauner Lidstrich
AUGE_L = [(3, 9), (4, 9), (3, 10), (4, 10), (3, 11), (4, 11)]                  # weiße Augenblöcke
AUGE_R = [(7, 9), (8, 9), (9, 9), (7, 10), (8, 10), (9, 10), (7, 11), (8, 11), (9, 11)]
ECKEN = {(4, 9): HELL, (7, 9): UMRISS_D, (9, 11): FELL2}                         # Augenecken zu (Pose 1 der Quelle)
OBEN = {(3, 9): HELL, (4, 9): HELL, (7, 9): UMRISS_D, (8, 9): HELL, (9, 9): HELL, (9, 11): FELL2}
ZU = {p: HELL for p in AUGE_L + AUGE_R}
ZU.update({p: LIDSTRICH for p in [(3, 11), (4, 11), (7, 11), (8, 11), (9, 11)]})
GLUT = {'c': (232, 193, 152), 'r': (213, 71, 71)}

BAUCHZEILE = 22                                                    # hier wird beim Atmen eine Zeile eingefügt
PIVOT_SCHWANZ = 14


def px(x, y):
    return PAD_L + x, PAD_T + y


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                          # sofort auf die volle Leinwand


GLUTFUNKEN = [                                                    # Start = Rückenlinie (liegt zuerst hinter dem Körper)
    dict(x=px(19, 10)[0], y=px(19, 10)[1], vx=-1, vy=-11, off=0, farbe='c', wackeln=1),
    dict(x=px(26, 11)[0], y=px(26, 11)[1], vx=1, vy=-12, off=10, farbe='r', wackeln=1),
    dict(x=px(31, 13)[0], y=px(31, 13)[1], vx=2, vy=-11, off=20, farbe='c', wackeln=1),
    dict(x=px(23, 11)[0], y=px(23, 11)[1], vx=-1, vy=-10, off=30, farbe='r', wackeln=1),
]


def zustand(i):
    """Alle Steuergrößen eines Frames."""
    atem = 1 if 6 <= i < 26 else 0                                   # Rumpf gehoben
    nicken = 1 if 17 <= i < 23 else 0                                # Kopf relativ zum Rumpf gesenkt
    ohr_li = [0, 1, 1, 0][i - 6] if 6 <= i < 10 else 0
    ohr_re = [0, 1, 1, 0][i - 22] if 22 <= i < 26 else 0
    ph20 = L.sinus(i, 10)                                            # Wedeln: 4× pro Schleife
    glueh = 0
    lid = {30: 1, 31: 2, 32: 3, 33: 2, 34: 1}.get(i, 0)
    env = 0.5 - 0.5 * math.cos(L.sinus(i, N))                        # Schwanzamplitude: 0 bei Frame 0
    return atem, nicken, ohr_li, ohr_re, ph20, glueh, lid, env


def frame(i, nur=None):
    atem, nicken, ohr_li, ohr_re, ph20, glueh, lid, env = zustand(i)
    z = PAD_T + BAUCHZEILE
    r = L.platz(L.trenne(spr, rumpf)[0], H, W, PAD_L, PAD_T)
    r = L.streck_zeile(r, z, atem)
    s = L.streck_zeile(teil(schwanz), z, atem)
    s = T.haengend_schwingen(s, L.deckend(r), PAD_T + PIVOT_SCHWANZ - atem, 3.8, ph20, [UMRISS_A, UMRISS_D],
                             lauf=1.6, potenz=1.1, huelle=env)
    k = teil(kopf)
    # Augen: Blinzeln (Stufen 1 = Ecken zu, 2 = obere Zeile zu, 3 = zu)
    if lid:
        stufe = {1: ECKEN, 2: OBEN, 3: ZU}[lid]
        k = T.pixel_tauschen(k, {px(*p): c for p, c in stufe.items()})
    dy_kopf = -atem + nicken
    k = L.versetze(k, 0, dy_kopf)
    ol = L.versetze(T.zucken_zeilen(teil(ohr_l), PAD_T + 5, -1.2 * ohr_li), 0, dy_kopf)
    orr = L.versetze(T.zucken_zeilen(teil(ohr_r), PAD_T + 5, 1.2 * ohr_re), 0, dy_kopf)
    glut = T.funken_ebene(H, W, i, N, GLUTFUNKEN, GLUT)
    ebenen = {'glut': glut, 'schwanz': s, 'rumpf': r, 'kopf': k, 'ohr_l': ol, 'ohr_r': orr}
    if nur is not None:
        return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in nur])
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in ('glut', 'schwanz', 'rumpf', 'kopf', 'ohr_l', 'ohr_r')])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    quelle = np.zeros((H, W, 4), np.uint8)
    quelle[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] = spr
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('tamed-hell-fox', 'Tamed Hell Fox', frames, MS, prev)
    if prev:
        L.streifen(prev + '/tamed-hell-fox-strip.png', frames, spalten=10, scale=4)
