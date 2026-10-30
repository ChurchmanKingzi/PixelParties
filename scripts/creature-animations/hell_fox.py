# -*- coding: utf-8 -*-
"""Idle-Animation für „Hell Fox“ (Creature) — Version 2 (lebendiger).

Quelle: src/hell-fox.png — Ebene „Hell Fox“ (48×32 px, 17 Farben) aus Motive.xcf.
PICK: [["Motive", 848, 1]]

Aufruf:   python3 hell_fox.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/hell-fox.png + .json

Identifikation (Sprite 48×32, Fuchs im Profil nach links, Kopf links):
* Kopf (x 0–15, y 0–16): hellbeige Schnauze/Gesicht (G/I/J/M), zwei Ohren oben (links x 4–7, rechts x 10–14, Zeilen 0–4, rot mit
  dunklem Umriss), zwei rote Augen (je 3 Pixel: links (3,10) (3,11) (4,11), rechts (8,10) (7,11) (8,11); Farben O/Q = leuchtendes
  Rot), Nase = fast schwarze Pixel an der Schnauzenspitze (0–2, 14–16), braune Mähne/Wangenfell (D) an der Kopfrückseite
  (x 13–16), rosa-rote Fellmarke (9,9) (9,10) neben dem rechten Auge.
* Schwarzer Fleck unter dem Kinn (9–15, 15–19; K/N/L): Halsband/Schatten zwischen Kinn und Vorderbein (beim zahmen Fuchs hängt hier
  die Leine) — bleibt fest am Rumpf.
* Rumpf: roter Körper mit dunklem Umriss (A), hellbeige Bauchfellpartie (20–29, 18–21), vier Beine (zwei vorn: x 6–13 und 14–20;
  zwei hinten: x 25–35), dunkelrote Schattierung (E/H) an den Füßen.
* Schwanz (x ≥ 37, Zeilen 15–31): hängt vom Rücken diagonal nach rechts unten und endet in einer hellbeigen Spitze (45–47, 22–30);
  die dunklen Pixel bei (43–44, 23) und (45, 22) sind die Binnenlinie zwischen rotem Schwanz und beiger Spitze (Füllung, kein Umriss).

Ablauf (48 Frames à 65 ms = 3,12 s), alle Bewegungen unabhängig, nie länger als wenige Frames ohne Bewegung:
* Atmen, zweistufig (Periode 16, 3× pro Schleife): Brust/Vorderkörper steigt bis 2 px (0 → 1 → 2 → 1 → 0), der Hinterkörper bis 1 px; der Kopf folgt
  der Brust 3 Frames später (beim Einatmen zuerst die Brust, dann der Kopf). Spaltenweise eingefügte Zeilen (Zeile 22) heben den
  Körper, die Füße bleiben am Boden.
* Wiegen/Gewichtsverlagerung (Periode 48): Der Körper kippt langsam um ±1 px — vorn tiefer/hinten höher und umgekehrt; die Beine
  werden dabei spaltenweise etwas länger/kürzer (Vorderbeine x ≤ 20 gemeinsam, Hinterbeine x ≥ 24 gemeinsam, Bauch dazwischen).
* Schnüffeln: der Kopf senkt sich 1 px relativ zum Körper, 7× pro Schleife (Doppelnicker).
* Ohrzucken: jedes Ohr 4× pro Schleife (links Frames 2/14/27/38, rechts 8/20/33/44), Spitze bis 1 px nach außen (kleiner, dafür öfter).
* Schwanzwedeln (Periode 12 = 4× pro Schleife, Amplitude bis ±5 px, Spitze schleudert nach, Frame 0 = Original): die Zeilen wandern
  seitlich; je weiter die Spitze ausschlägt, desto mehr steigt sie (bis 2 Zeilen entfallen, der Schwanz bleibt gleich lang), der Außenumriss wird neu gezogen (4-verbunden), die Lücke zum Rumpf wird geschlossen.
* Vorderpfote (linkes Vorderbein im Bild) scharrt: das Bein wird um bis zu 2 px kürzer (Zeilen 27–28 entfallen), Frames 16–20 und 38–40.
* Augenglühen (Periode 12, schnell): dunkler → normal → heller → Maximum (alle drei Pixel Q plus vier rosa Glutpixel (P) auf der
  Haut neben den Augen, Hof) → normal; alle Farben aus dem Sprite.
* Blinzeln zweimal (Frames 13–15 und 37–39): oberes Augenpixel wird Fell, dann beide Augen als dunkler Lidstrich, dann halb offen.
* Glut/Funken (11 Partikel, alle langsam aufsteigend): Funken und kleine Glutwölkchen (Formen k/s/o/m, Kern hell-/beigerot, Rand rosa-
  rot) steigen vom Rücken und von der Schwanzspitze auf (die Schwanzfunken starten an der gerade schwingenden Spitze); Lebenslauf:
  Funke → Klecks → Wölkchen → schrumpft → Funke flackert → aus, am Schleifenende ist nichts sichtbar, kein Sprung. Hinter dem Fuchs.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Randpixel-Korrektur (Regel 16): Wo beim Bewegen (Ohrzucken, Wiegen/Atmen-Stufen im Rücken, Schwanz, gehobene Pfote) eine Füllfarbe an freien Hintergrund
grenzen würde, wird dort ein Umrisspixel ergänzt (anim_tiere.umriss_schliessen; Farbe aus dem Original, Füllfarbe → Umrissfarbe). Nur Umrisspixel
kommen hinzu; Bewegung, Frames, Perioden und Partikel sind unverändert.

Ergänzungen: keine gemalten Pixel nötig — der Kopf liegt über dem Rumpf (nur Absenken, nie über den Rumpf hinaus), die Beine werden
nur um duplizierte/entfernte Zeilen verändert, der Schwanzumriss entsteht aus Quellfarben (A/D), siehe anim_tiere.haengend_schwingen.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 6, 11, 10, 3

spr = L.lade('hell-fox')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
dunkel = L.farbmaske(spr, [(0, 0, 0), (26, 26, 26), (14, 8, 8)])

kopf_alles = vorhanden & (xx <= 15) & (yy <= 16) & ~(dunkel & (xx >= 9) & (yy >= 15))
ohr_l = kopf_alles & (xx <= 8) & (yy <= 4)
ohr_r = kopf_alles & (xx >= 10) & (xx <= 14) & (yy <= 4)
kopf = kopf_alles & ~ohr_l & ~ohr_r
schwanz = vorhanden & (xx >= 37)
pfote = vorhanden & (xx <= 13) & (yy >= 27)                       # unterer Teil des linken Vorderbeins (Zeilen 27–30)
rumpf = vorhanden & ~kopf_alles & ~schwanz & ~pfote

UMRISS_A, UMRISS_D = (37, 10, 10), (104, 84, 58)
HELL, DUNKEL = (232, 193, 152), UMRISS_D                         # Fell (Lid) / brauner Lidstrich
AUGEN_O, AUGEN_Q, ROSA = (196, 26, 26), (255, 34, 34), (227, 76, 76)
AUGE_L = [(3, 10), (3, 11), (4, 11)]
AUGE_R = [(8, 10), (7, 11), (8, 11)]
HOF = [(4, 10), (5, 11), (7, 10), (9, 11)]                       # Hautpixel neben den Augen (Hell Fox glüht dort rosa)
GLUT = {'rot': ((255, 34, 34), (196, 26, 26)),                   # Kern knallrot, Rand dunkleres Rot
        'glut': ((232, 193, 152), (227, 76, 76))}                # Kern beige (heiß), Rand rosarot

TEST_EBENEN = ['schwanz', 'rumpf', 'pfote', 'kopf', 'ohr_l', 'ohr_r']                 # Körper-Ebenen ohne Partikel (für randtest.py)
RAND = T.rand_farben(spr)                                         # Umrissfarben der Quelle (Randpixel-Test, Regel 16)
REGEL = T.umriss_regeln(spr, RAND)[2]                             # Füllfarbe → Umrissfarbe aus dem Original
BAUCHZEILE = 22                                                    # hier werden beim Atmen/Wiegen Zeilen eingefügt/entfernt
PIVOT_SCHWANZ = 14
SCHWANZ_AMP, SCHWANZ_LAUF = 5.4, 2.2                                # Schwanzspitze: bis ±5 px, die Welle läuft zur Spitze
NICKEN = [(4, 3), (9, 2), (18, 3), (23, 2), (30, 3), (35, 2), (43, 3)]     # (Start, Länge): Schnüffeln
OHR_L, OHR_R = (2, 14, 27, 38), (8, 20, 33, 44)                   # Startframes der Ohrzucker (je 4 Frames)
BLINZELN = (13, 37)                                                # Startframes (3 Frames: halb, zu, halb)
PFOTE = {16: 1, 17: 2, 18: 1, 19: 2, 20: 1, 38: 1, 39: 2, 40: 1}  # Scharren: Beinzeilen, die entfallen


def px(x, y):
    return PAD_L + x, PAD_T + y


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                          # sofort auf die volle Leinwand


def hub(i):
    """(kf, kr): eingefügte Zeilen vorn (Brust/Vorderbeine) und hinten (Hüfte/Hinterbeine) — Atmen (Periode 16, zweistufig) plus
    Wiegen (Periode 48: Gewicht vorn → vorn 1 px tiefer, hinten 1 px höher; Gewicht hinten → hinten 1 px tiefer)."""
    b = 0.5 - 0.5 * math.cos(L.sinus(i % N, 16))
    bf = 0 if b < 0.25 else (1 if b < 0.75 else 2)
    br = 1 if b > 0.5 else 0
    wiegen = int(round(1.2 * math.sin(L.sinus(i % N, N))))
    if wiegen > 0:
        kf, kr = bf - 1, br
    elif wiegen < 0:
        kf, kr = bf, br - 1
    else:
        kf, kr = bf, br
    kf = max(kr - 2, min(kr + 2, kf))                              # Neigung vorn/hinten höchstens 2 px (sonst reißt der Bauchfleck)
    return kf, kr


def k_von_x(kf, kr):
    def k(x):                                                      # x = Leinwandspalte
        sx = x - PAD_L
        if sx <= 20:
            return kf
        if sx >= 24:
            return kr
        return int(round(kf + (kr - kf) * (sx - 20) / 4.0))        # nur Bauch dazwischen
    return k


def schwanz_ebene(i):
    kf, kr = hub(i)
    z = PAD_T + BAUCHZEILE
    s = T.spalten_hub(teil(schwanz), z, lambda x: kr)
    r = T.spalten_hub(teil(rumpf), z, k_von_x(kf, kr))
    env = min(1.0, min(i, N - i) / 5.0)                            # Schwanzamplitude: 0 bei Frame 0, nach 5 Frames voll
    ph = L.sinus(i, 12)
    # Pendel statt Dehnen: je weiter die Spitze ausschlägt, desto mehr steigt sie (Zeilen 24… entfallen) — der Schwanz behält seine Länge
    ausschlag = SCHWANZ_AMP * env * math.sin(ph - SCHWANZ_LAUF)
    zeilen_weg = int(round(0.3 * abs(ausschlag)))
    s = L.heben_unten(s, PAD_T + 23 + zeilen_weg, zeilen_weg)
    return T.haengend_schwingen(s, L.deckend(r), PAD_T + PIVOT_SCHWANZ - kr, SCHWANZ_AMP, ph, [UMRISS_A, UMRISS_D],
                                lauf=SCHWANZ_LAUF, potenz=1.3, huelle=env, satt_y=PAD_T + 26), r


SCHWANZ_EB = [schwanz_ebene(i) for i in range(N)]


def spitze(i):
    """Schwanzspitze (Leinwandkoordinate) in Frame i: rechtester Pixel in den untersten Zeilen."""
    s = SCHWANZ_EB[i % N][0]
    ys, xs_ = np.nonzero(s[PAD_T + 25:, :, 3])
    k = int(np.argmax(xs_))
    return int(xs_[k]), int(ys[k]) + PAD_T + 25


def partikel():
    p = []
    # vom Rücken (Startpunkte an der Rückenlinie, zunächst hinter dem Körper verborgen)
    for (x, y, off, form, farbe, vx, w) in [(23, 11, 0, 'o', 'glut', 1, 1.2), (26, 11, 7, 'k', 'rot', 0, 1.0), (29, 12, 14, 's', 'rot', 1, 1.3),
                                           (32, 13, 21, 'k', 'glut', 1, 1.0), (25, 11, 28, 'm', 'glut', -1, 1.4), (28, 12, 35, 'k', 'rot', 1, 1.0),
                                           (31, 13, 41, 's', 'glut', 1, 1.2)]:
        p.append(dict(x=PAD_L + x, y=PAD_T + y, vx=vx, vy=-12, off=off, form=form, farbe=farbe, wackeln=w, ph=off * 0.5))
    # von der Schwanzspitze: Startpunkt = Spitze im Spawn-Frame (Frame, in dem t = 0 ist)
    for (off, form, farbe, vx) in [(3, 'k', 'glut', 1), (17, 's', 'glut', 1), (31, 'k', 'rot', 2), (44, 'o', 'glut', 1)]:
        sx, sy = spitze((-off) % N)
        p.append(dict(x=sx, y=sy, vx=vx, vy=-10, off=off, form=form, farbe=farbe, wackeln=1.0, ph=off * 0.7))
    return p


GLUTFUNKEN = partikel()


def zustand(i):
    kf, kr = hub(i)
    kopf_hub = min(kf, hub(i - 3)[0])                                 # Kopf folgt der Brust 3 Frames später (nie über den Rumpf hinaus)
    nicken = 1 if any((i - s) % N < l for s, l in NICKEN) else 0
    ohr_li = max(T.huellkurve(i, N, s, 4) for s in OHR_L)
    ohr_re = max(T.huellkurve(i, N, s, 4) for s in OHR_R)
    sg = math.sin(L.sinus(i, 12))
    glueh = 2 if sg > 0.85 else (1 if sg > 0.35 else (-1 if sg < -0.6 else 0))
    lid = 0
    for s in BLINZELN:
        if 0 <= i - s < 3:
            lid = (1, 2, 1)[i - s]
    return kf, kr, kopf_hub, nicken, ohr_li, ohr_re, glueh, lid, PFOTE.get(i, 0)


EAR_ANT = {0: 1.0, 1: 0.9, 2: 0.65, 3: 0.3, 4: 0.1}


def frame(i, nur=None):
    kf, kr, kopf_hub, nicken, ohr_li, ohr_re, glueh, lid, pf = zustand(i)
    s, r = SCHWANZ_EB[i]
    p = L.heben_unten(teil(pfote), PAD_T + 26 + pf, pf)
    k = teil(kopf)
    # Augen: Glühen (Hof), Blinzeln
    if glueh > 0:
        k = T.pixel_tauschen(k, {px(*q): AUGEN_Q for q in AUGE_L + AUGE_R})
        if glueh > 1:
            k = T.pixel_tauschen(k, {px(*q): ROSA for q in HOF})
    elif glueh < 0:
        k = T.pixel_tauschen(k, {px(*q): AUGEN_O for q in AUGE_L + AUGE_R})
    if lid >= 1:
        k = T.pixel_tauschen(k, {px(*AUGE_L[0]): HELL, px(*AUGE_R[0]): HELL})
    if lid == 2:
        k = T.pixel_tauschen(k, {px(*q): DUNKEL for q in (AUGE_L[1], AUGE_L[2], AUGE_R[1], AUGE_R[2])})
    dy_kopf = -kopf_hub + nicken
    k = L.versetze(k, 0, dy_kopf)
    ant = {PAD_T + y: a for y, a in EAR_ANT.items()}
    ol = L.versetze(T.zucken_zeilen(teil(ohr_l), PAD_T + 5, -1.2 * ohr_li, ant), 0, dy_kopf)
    orr = L.versetze(T.zucken_zeilen(teil(ohr_r), PAD_T + 5, 1.2 * ohr_re, ant), 0, dy_kopf)
    glut = T.funken_ebene(H, W, i, N, GLUTFUNKEN, GLUT)
    ebenen = {'glut': glut, 'schwanz': s, 'rumpf': r, 'pfote': p, 'kopf': k, 'ohr_l': ol, 'ohr_r': orr}
    wahl = nur or ('glut', 'schwanz', 'rumpf', 'pfote', 'kopf', 'ohr_l', 'ohr_r')
    koerper_ = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl if n != 'glut'])
    koerper_ = T.umriss_schliessen(koerper_, RAND, REGEL)             # nur Umrisspixel ergänzen, wo eine Füllfarbe frei läge (Ohrbasis, Schwanz, Pfote)
    return L.zusammen(H, W, [(ebenen['glut'], 0, 0)] * ('glut' in wahl) + [(koerper_, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('hell-fox', 'Hell Fox', frames, MS, prev)
    if prev:
        L.streifen(prev + '/hell-fox-strip.png', frames, spalten=12, scale=3)
