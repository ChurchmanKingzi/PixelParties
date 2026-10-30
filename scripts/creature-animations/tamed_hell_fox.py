# -*- coding: utf-8 -*-
"""Idle-Animation für „Tamed Hell Fox“ (Creature) — Version 2 (lebendiger).

Quelle: src/tamed-hell-fox.png — 47×32 px, 15 Farben, aus Motive.xcf, Ebene 846 (96×73 px, trägt zwei Posen desselben Fuchses
übereinander: oben Figur 1, unten Figur 2).
PICK: [["Motive", 846, 2]]   (Figur 2 = untere Pose, offene weiße Augen — so steht er auf der Karte; Figur 1 ist dieselbe Pose
mit zugekniffenen Augenecken und gefaltetem linken Ohr und dient nur als Referenz für den Zwischenschritt beim Blinzeln.)
Gefunden über die Pixelkarte: creature_show.py kennt die Ebene nicht (die Suche lieferte nur den Menschen/Zügel „Tamed Hell Fox #1“,
Ebene 845); der Fuchs steht in der Nachbarebene 846. Es ist KEIN umgefärbter Hell Fox, sondern eine eigene Zeichnung.

Aufruf:   python3 tamed_hell_fox.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/tamed-hell-fox.png + .json

Identifikation (Sprite 47×32, Fuchs im Profil nach links, Kopf links):
* Kopf (x 0–15, y 1–16): hellbeige Schnauze/Gesicht (H/I/J/N), zwei rote Ohren mit dunklem Umriss (links x 4–7, rechts x 10–14,
  Zeilen 1–4), zwei WEISSE Augenblöcke ohne Pupille (links 2×3: x 3–4, y 9–11; rechts 3×3: x 7–9, y 9–11), Nase = fast schwarze
  Pixel an der Schnauzenspitze (0–2, 14–16), braune Wangen-/Mähnenpartie (C) hinten am Kopf, Unterkieferlinie braun (3–10, 16).
* Zwei weiße Reißzähne ragen aus dem Unterkiefer (3,17) und (6,17) — Zähne, keine Partikel: sie sitzen fest am Kiefer und
  gehen nur mit dem Kopf mit.
* Schwarzer Fleck unter dem Kinn (9–15, 15–19; L/M/O): Halsband/Schatten zwischen Kinn und Vorderbein (an dieser Stelle läuft auf
  der Karte die Leine zum Menschen) — bleibt fest am Rumpf.
* Rumpf: roter Körper mit dunklem Umriss (A), beige Bauchfellpartie (20–29, 18–21), vier Beine (vorn x 6–13 und 14–20, hinten
  x 25–35, die Beinpaare berühren sich), dunkelrote Schattierung (E/G) an den Füßen. Dunkle Binnenlinien (35–37, 19–20) = Kruppen-/
  Schenkelkante, Füllung.
* Schwanz (x ≥ 37, Zeilen 15–31): hängt vom Rücken diagonal nach rechts unten, beige Spitze (43–46, 22–30); Binnenlinie zwischen
  rotem Schwanz und Spitze (38–42, 19–23) ist Füllung, kein Außenumriss.
* Fest: Kinn-/Halsband, Nase, Zähne, Bauchfell, Füße.

Ablauf (48 Frames à 65 ms = 3,12 s) — gleiche Mechanik wie Hell Fox, aber freudiger (Schwanz schneller), Ereignisse zeitversetzt:
* Atmen, zweistufig (Periode 16, 3× pro Schleife): Brust/Vorderkörper steigt bis 2 px, der Hinterkörper bis 1 px; der Kopf folgt der
  Brust 3 Frames später. Spaltenweise eingefügte Zeilen (Zeile 22) heben den Körper, die Füße bleiben am Boden.
* Wiegen/Gewichtsverlagerung (Periode 48): Körper kippt um ±1 px (vorn tiefer oder hinten tiefer), Beine werden spaltenweise länger/
  kürzer; Neigung vorn/hinten höchstens 2 px.
* Schnüffeln: Kopf senkt sich 1 px relativ zum Körper, 7× pro Schleife; die Zähne gehen mit dem Kopf.
* Ohrzucken: jedes Ohr 4× pro Schleife, Spitze bis 1 px nach außen.
* Schwanzwedeln (Periode 8 = 6× pro Schleife, Spitze schleudert nach, Amplitude bis ±5 px, Frame 0 = Original): Zeilen wandern
  seitlich, die Spitze (ab Zeile 26) bewegt sich starr als Block, je weiter der Ausschlag, desto mehr steigt sie (Zeilen entfallen,
  der Schwanz behält seine Länge); der Außenumriss wird neu gezogen (4-verbunden), die Lücke zum Rumpf geschlossen.
* Blinzeln zweimal (Frames 11–15 und 33–37): die weißen Augenblöcke schließen sich in Stufen (Augenecken zu — aus Figur 1 des
  Quell-Bildes —, obere Zeile zu, ganz zu mit braunem Lidstrich) und öffnen sich wieder.
* Glut/Funken (11 Partikel, langsam aufsteigend): Funken und kleine Glutwölkchen (Formen k/s/o/m; Kern hellbeige oder rot, Rand
  rot/rosarot, nur Spritefarben) vom Rücken und von der Schwanzspitze; Lebenslauf Funke → Klecks → Wölkchen → schrumpft → Funke
  flackert → aus, am Schleifenende nichts sichtbar. Hinter dem Fuchs.
* Keine Vorderpfote: die Beinpaare des Sprites berühren sich (gemeinsame Umrisslinie); ein gehobener Fuß würde dem Nachbarbein den
  Umriss nehmen (hier müsste gemalt werden) — bewusst weggelassen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Randpixel-Korrektur (Regel 16): Wo beim Bewegen (Ohrzucken, Wiegen/Atmen-Stufen im Rücken, Schwanz, gehobene Pfote) eine Füllfarbe an freien Hintergrund
grenzen würde, wird dort ein Umrisspixel ergänzt (anim_tiere.umriss_schliessen; Farbe aus dem Original, Füllfarbe → Umrissfarbe). Nur Umrisspixel
kommen hinzu; Bewegung, Frames, Perioden und Partikel sind unverändert.

Ergänzungen: keine gemalten Pixel nötig (Kopf liegt über dem Rumpf; der Schwanzumriss entsteht aus den Quellfarben A/C).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 6, 11, 10, 3

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
pfote = np.zeros_like(vorhanden)                                 # keine Pfotenbewegung (Beine berühren sich, siehe Kopf)
rumpf = vorhanden & ~kopf_alles & ~schwanz & ~pfote

UMRISS_A, UMRISS_D = (51, 12, 12), (104, 84, 58)
HELL, FELL2, LIDSTRICH = (232, 193, 152), (224, 182, 126), UMRISS_D          # Fell (Lid) / Wange / brauner Lidstrich
AUGE_L = [(3, 9), (4, 9), (3, 10), (4, 10), (3, 11), (4, 11)]                  # weiße Augenblöcke
AUGE_R = [(7, 9), (8, 9), (9, 9), (7, 10), (8, 10), (9, 10), (7, 11), (8, 11), (9, 11)]
ECKEN = {(4, 9): HELL, (7, 9): UMRISS_D, (9, 11): FELL2}                         # Augenecken zu (Pose 1 der Quelle)
OBEN = {(3, 9): HELL, (4, 9): HELL, (7, 9): UMRISS_D, (8, 9): HELL, (9, 9): HELL, (9, 11): FELL2}
ZU = {p: HELL for p in AUGE_L + AUGE_R}
ZU.update({p: LIDSTRICH for p in [(3, 11), (4, 11), (7, 11), (8, 11), (9, 11)]})
GLUT = {'rot': ((213, 71, 71), (137, 32, 32)),                   # Kern Fellrot, Rand dunkelrot
        'glut': ((232, 193, 152), (213, 71, 71))}                # Kern beige (heiß), Rand Fellrot

TEST_EBENEN = ['schwanz', 'rumpf', 'pfote', 'kopf', 'ohr_l', 'ohr_r']                 # Körper-Ebenen ohne Partikel (für randtest.py)
RAND = T.rand_farben(spr)                                         # Umrissfarben der Quelle (Randpixel-Test, Regel 16)
REGEL = T.umriss_regeln(spr, RAND)[2]                             # Füllfarbe → Umrissfarbe aus dem Original
BAUCHZEILE = 22                                                    # hier werden beim Atmen/Wiegen Zeilen eingefügt/entfernt
PIVOT_SCHWANZ = 14
SCHWANZ_AMP, SCHWANZ_LAUF = 5.4, 2.2                                # Schwanzspitze: bis ±5 px, die Welle läuft zur Spitze
NICKEN = [(2, 3), (8, 2), (15, 3), (24, 2), (29, 3), (36, 2), (41, 3)]     # (Start, Länge): Schnüffeln
OHR_L, OHR_R = (5, 17, 30, 41), (11, 23, 36, 44)                   # Startframes der Ohrzucker (je 4 Frames)
BLINZELN = (11, 33)                                                # Startframes (5 Frames: Ecken, oben, zu, oben, Ecken)
PFOTE = {}                                                         # keine Pfotenbewegung


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
    ph = L.sinus(i, 8)                                              # Wedeln: 6× pro Schleife (freudiger Fuchs)
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
    glueh = 0
    lid = 0
    for s in BLINZELN:
        if 0 <= i - s < 5:
            lid = (1, 2, 3, 2, 1)[i - s]
    return kf, kr, kopf_hub, nicken, ohr_li, ohr_re, glueh, lid, PFOTE.get(i, 0)


EAR_ANT = {0: 1.0, 1: 0.9, 2: 0.65, 3: 0.3, 4: 0.1}


def frame(i, nur=None):
    kf, kr, kopf_hub, nicken, ohr_li, ohr_re, glueh, lid, pf = zustand(i)
    s, r = SCHWANZ_EB[i]
    p = L.heben_unten(teil(pfote), PAD_T + 26 + pf, pf)
    k = teil(kopf)
    # Augen: Blinzeln (Stufen 1 = Ecken zu, 2 = obere Zeile zu, 3 = zu)
    if lid:
        stufe = {1: ECKEN, 2: OBEN, 3: ZU}[lid]
        k = T.pixel_tauschen(k, {px(*p_): c for p_, c in stufe.items()})
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
    L.speichern('tamed-hell-fox', 'Tamed Hell Fox', frames, MS, prev)
    if prev:
        L.streifen(prev + '/tamed-hell-fox-strip.png', frames, spalten=12, scale=3)
