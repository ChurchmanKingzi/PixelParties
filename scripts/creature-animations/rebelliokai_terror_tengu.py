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

RUNDE 3 (Nutzer: „soll mit den Flügeln schlagen und fliegen!“ — Flügel öffnen und schlagen, Figur schwebt/fliegt): die Flügel sind NICHT mehr nur angelegt.
Ablauf (60 Frames à 80 ms = 4,8 s, nahtlos; Frame 0 = Original, Flügel angelegt):
* FLÜGELSCHLAG (4 Schläge je Schleife, 15 Frames = 1,2 s je Schlag): die Flügel klappen aus der angelegten Haltung (Frame 0 und kurz danach) in 7 Frames auf — jeder Flügel schwingt als Ganzes um die Schulter ((6|6) links, (17|6) rechts, hinter dem
  Kopf; Achse zur Flügelspitze 103° bzw. 77°) um 132° bis schräg nach oben außen (ca. 55° über der Waagerechten, Flügelspitze bis ca. 17 px neben/über dem Körper), gehen in 5,5 Frames kräftig wieder nach unten und liegen dann 1,5 Frames angelegt. Die Spitze hinkt der Wurzel um
  1,5 Frames hinterher und biegt sich dabei durch (anim_flieger_r2.biege = Rückwärtsabbildung um eine gekrümmte Achse, Nächster-Nachbar, keine Mischfarben, Feder-Streifen bleiben Streifen).
  Der Flügel ist im Sprite teils von Fäusten/Kragen und Wange verdeckt: diese Stellen wurden senkrecht mit der Flügelfarbe der Spalte darüber fertiggezeichnet (Federstreifen laufen senkrecht), damit beim Aufklappen keine Lücken entstehen
  (siehe Ergänzungen). Die Schulter (Flügelpixel im Umkreis von 4,2 px um das Gelenk) bleibt am Kopf stehen und hebt sich nur mit der Figur; freiliegende Ränder bekommen die Umrissfarbe (8,10,9) (R.kontur_je_teil).
* SCHWEBEN: die Figur fliegt — beim Aufklappen sinkt sie bis 2 px, beim Abschlag steigt sie wieder (Frame 0 = Original); die Beine/Stiefel (y ≥ 22) hängen nach (1 Frame, bis 1 px seitlich, Periode 30).
* BLINZELN (Frames 22–24 und 46–48): die Iris-/Augenpixel nehmen die Hautfarben der Umgebung an, die obere Lidzeile wird zu (0,0,0): ein dunkler Strich. (Das alte Atmen und die „Federspitzen flickern“ entfallen — die Flügel bewegen sich jetzt als Ganzes.)
Fest: Kapuze und Kamm, Nase, Kragen, Hände, Rock. Alle Bewegungen laufen auf der vollen Leinwand (ClipError statt Abschneiden). Nur ganze Pixel, nur Quellfarben.
Ergänzungen: unter Fäusten/Armen/Wange liegende Flügelpixel (nur im Flügel-Layer, im Ruhebild verdeckt): in jeder Spalte x 0–6 (links) bzw. 17–23 (rechts) die verdeckten Zeilen (y 2–20, wo das Sprite einen Nicht-Flügel-Pixel hat) mit der Farbe des nächsten
Flügelpixels derselben Spalte darüber (sonst darunter) — es entstehen nur Flügelfarben (8,10,9)/(19,24,22)/(31,40,39)/(39,48,47).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_rebel as R
import anim_flieger_r2 as R2
import anim_flieger_r3 as R3

N, MS = 60, 80
BEAT = 15                                              # Flügelschlag: 4 pro Schleife
PAD_L, PAD_R, PAD_T, PAD_B = 14, 14, 12, 5

spr = L.lade('rebelliokai-terror-tengu')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
f = lambda x, y: R.farbe(spr, x, y)

FLUEGEL_FARBEN = [(8, 10, 9), (19, 24, 22), (31, 40, 39), (39, 48, 47)]
UMRISS_FLUEGEL = (8, 10, 9)
ERLAUBT = set(Hm.umrissfarben(spr))
HAUT_AUSSEN, HAUT_MITTE, LID = f(8, 9), f(11, 9), f(10, 8)           # (87,35,29), (100,51,46), schwarz (0,0,0)
UMRISS_KOERPER = f(8, 25)
wing_c = L.farbmaske(spr, FLUEGEL_FARBEN)

PIV = {'l': (6.0, 6.0), 'r': (17.0, 6.0)}                # Schultergelenke (Sprite)
ANG0 = {'l': math.radians(103.0), 'r': math.radians(77.0)}
LAENGE = 16.0
SWEEP = math.radians(132.0)
LAG = 1.5
R_SCHULTER = 4.2


def fluegel_maske(seite):
    m = wing_c & ((xx <= 11) if seite == 'l' else (xx >= 12))
    # den Flügel ohne Randausreißer: nur y 1–21
    m &= (yy >= 1) & (yy <= 21)
    return m


def fluegel_fertig(seite):
    """Vollständiger Flügel (verdeckte Stellen senkrecht fertiggezeichnet) als Maske + Farbfeld im Sprite-Raster."""
    m = fluegel_maske(seite)
    xs = range(0, 7) if seite == 'l' else range(17, 24)
    a = np.zeros_like(spr)
    a[m] = spr[m]
    for x in xs:
        spalte = np.nonzero(m[:, x])[0]
        if not len(spalte):
            continue
        for y in range(spalte.min(), spalte.max() + 1):
            if m[y, x] or not vorhanden[y, x]:
                continue
            # verdeckt: Farbe des nächsten Flügelpixels derselben Spalte (darüber, sonst darunter)
            oben = [yy_ for yy_ in range(y - 1, -1, -1) if m[yy_, x]]
            unten = [yy_ for yy_ in range(y + 1, sh) if m[yy_, x]]
            q = oben[0] if oben else unten[0]
            a[y, x] = spr[q, x]
    return a


sch_m = {}
for seite in 'lr':
    px_, py_ = PIV[seite]
    sch_m[seite] = fluegel_maske(seite) & ((xx - px_) ** 2 + (yy - py_) ** 2 <= R_SCHULTER ** 2)
WING = {s_: fluegel_fertig(s_) for s_ in 'lr'}
WING_ROT = {}
for seite in 'lr':
    a = WING[seite].copy()
    a[sch_m[seite]] = 0
    WING_ROT[seite] = L.platz(a, H, W, *OFF)
koerper_m = vorhanden & ~(wing_c & ((xx <= 11) | (xx >= 12))) | sch_m['l'] | sch_m['r']
koerper_m &= vorhanden
KOERPER = R.teil(spr, koerper_m, H, W, OFF)
BEINE_Y = 22                                            # ab hier hängen Stiefel/Rock nach
# Ruhepose prüfen: Flügel (unverdreht) unter dem Körper ergibt das Original
_t = L.zusammen(H, W, [(WING_ROT['l'], 0, 0), (WING_ROT['r'], 0, 0), (KOERPER, 0, 0)])
assert (_t[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()

AUGE_L, AUGE_R = [(9, 8), (9, 9), (10, 9)], [(14, 8), (14, 9), (13, 9)]


def oeffnung(t):
    """0 = angelegt … 1 = ganz geöffnet. Aufklappen 7 Frames (u 1–8), kräftiger Abschlag 5,5 Frames (u 8–13,5), danach 1,5 Frames angelegt (und eines davor)."""
    u = t % BEAT
    if u < 1.0 or u >= 13.5:
        return 0.0
    if u < 8.0:
        return 0.5 - 0.5 * math.cos(math.pi * (u - 1.0) / 7.0)
    return 0.5 + 0.5 * math.cos(math.pi * (u - 8.0) / 5.5)


def delta(seite, s, t):
    fl = min(1.0, max(0.0, s / LAENGE))
    d = SWEEP * oeffnung(t - LAG * fl)
    return d if seite == 'l' else -d


def fluegel(seite, t):
    px_, py_ = PIV[seite]
    return R2.biege(WING_ROT[seite], (PAD_L + px_, PAD_T + py_), ANG0[seite], LAENGE, lambda s: delta(seite, s, t), s_min=-8.0)


def bob(t):
    """Beim Aufklappen sinkt die Figur bis 2 px, beim Abschlag steigt sie wieder (1 Frame nachlaufend); Frame 0 = 0."""
    return int(round(2.0 * oeffnung(t - 1.0)))


def frame(i):
    b = bob(i)
    k = KOERPER.copy()
    if Hm.folge(i, 22, [1, 1, 1], N) or Hm.folge(i, 46, [1, 1, 1], N):                       # Blinzeln
        Hm.setze(k, {(9, 8): LID, (14, 8): LID, (9, 9): HAUT_AUSSEN, (14, 9): HAUT_AUSSEN, (10, 9): HAUT_MITTE, (13, 9): HAUT_MITTE}, OFF)
    # Beine hängen nach (Zeilen ab BEINE_Y pendeln seitlich, 1 Frame hinterher)
    oben_, unten_ = k.copy(), k.copy()
    oben_[PAD_T + BEINE_Y:] = 0
    unten_[:PAD_T + BEINE_Y] = 0
    unten_ = R.zeilen_pendel(unten_, PAD_T + BEINE_Y, 1.2, L.sinus(i - 1.0, N / 2.0), lauf=0.5, ruhe0=True)
    fl_l, fl_r = fluegel('l', i), fluegel('r', i)
    fig, etik = R.schichten(H, W, [(L.versetze(fl_l, 0, b), 'fluegel'), (L.versetze(fl_r, 0, b), 'fluegel'), (L.versetze(oben_, 0, b), 'koerper'), (L.versetze(unten_, 0, b), 'koerper')])
    fig = R3.luecken_fuellen(fig, 6, ausser=np.roll(LOCH0, b, axis=0))
    R.kontur_je_teil(fig, etik, ERLAUBT, {'fluegel': UMRISS_FLUEGEL, 'koerper': UMRISS_FLUEGEL}, standard=UMRISS_FLUEGEL)
    return fig


LOCH0 = R3.eingeschlossen(L.platz(spr, H, W, *OFF)[..., 3] > 0)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = R.vorschau_arg()
    R.abschluss('rebelliokai-terror-tengu', 'Rebelliokai Terror Tengu', frames, MS, spr, OFF, prev)
