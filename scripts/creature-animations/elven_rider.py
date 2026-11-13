# -*- coding: utf-8 -*-
"""Idle-Animation für „Elven Rider“ (Creature) — die silberhaarige Elfe im grünen Umhang auf ihrem nachtblauen Pferd.

Quelle: src/elven-rider.png (40×32 px, 41 Farben) = Ausschnitt x 50–95 (ohne den braunen Zweig ganz links) der Ebene „Elven Rider“ (96×32 px).
PICK: [["MotiveGrailWar", 142, 1]]      (Ebene „Elven Rider“, 96×32 px: links ein kleiner brauner Stab (x 0–6, y 14–18) = Beiwerk, rechts Reiterin und Pferd samt Schweifsträhnen (x 56–95); Abgleich mit der Kartenkunst
                                          Elven_Rider.png: 98 % Pixeltreffer bei (15,10). Blumen/Büsche der Kunst gehören nicht dazu.) Die Quelle ist vollständig.
Aufruf:   python3 elven_rider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/elven-rider.png + .json

Was im Sprite ist (x, y im 40×32-Sprite):
* REITERIN (x 13–29, y 0–19): langes silbergrünes Haar (229,231,192)/(188,191,162)/(151,149,110)/(97,102,79)/(66,70,53) mit dunklem Umriss (8,18,0), die Haarmasse fällt über den Rücken nach links (x 13–21, y 9–16);
  Gesicht (x 23–28, y 5–10) in Dreiviertelansicht mit schwarzer Braue (24–27,6), EIN sichtbarem Auge 2×2 bei (25,7),(26,7),(25,8),(26,8) (hellblau + schwarz über weiß + grau), grünem Umhang (15,32,0)/(68,76,17)/(93,98,31)/(112,118,46) (x 15–27, y 11–17),
  ein hellcyanes Pixel (180,246,255) bei (26,15) (unsicher: Handschuh/Schmuck → fest); Stiefel/Fuß braun (115,41,16)/(164,74,41)/(189,90,57) bei (22–26, 18–19).
* PFERD (x 15–39, y 6–31): nachtblaues Pferd in (110,130,176)/(124,144,188)/(68,88,132)/(53,73,121), Umriss (26,45,81); Kopf rechts oben (x 29–37, y 9–17) mit goldenem Auge (205,180,68) bei (33,13),(33,14), Stirnschopf (x 30–36, y 6–9)
  und fliegender Mähne (x 35–39, y 6–12; dunkles Marineblau (18,28,63)/(30,23,69)/(67,66,119) mit zwei hellen Pixeln (212,213,247)/(246,246,246) = Sterne in der Mähne), vier Beine (x 15–17, 18–20, 27–29, 31–33) mit schwarzen Hufen (5,22,18) bei y 28–31;
  der Schweif zieht als dunkelblaue Strähnen (18,28,63) nach links (x 0–17, y 18–30).
Metall/Edelstein: nichts eindeutig (goldenes Pixelpaar am Pferdekopf = Auge → nur Blinzeln, kein Glanz; die hellen Pixel in der Mähne bleiben Teil der Mähne) → KEIN Glanz (Regel 14). Kein Feuer, keine Partikel.

RUNDE 4: Das HORN des Einhorns (violetter Schrägstrich (34,12) … (39,7) mit hellen Lichtpixeln; bisher als „Sterne in der Mähne“ mit dem Nebel verformt) ist jetzt starr am Kopf (siehe `horn`); nur die
dunkelblaue Mähne (18,28,63) dahinter fließt weiter als Nebel.

Ablauf (48 Frames à 66 ms = 3,17 s, nahtlos):
* Atmen des Pferdes (Periode 24, zweimal pro Schleife): die Rumpfzeile 23 von Pferd+Reiterin wird einmal doppelt eingefügt (L.streck_zeile, Texturmischung): Rumpf, Hals, Kopf, Reiterin steigen 1 px, die Beine/Hufe bleiben am Boden.
* NEBEL (Nutzerkorrektur Runde 3: „die Mähne bis einschließlich Schweif des Pferds soll fließend animiert sein, als bestünde sie aus dunklem Nebel“): Schweif (die dunkelblauen Strähnen (18,28,63) bei y ≥ 18, x ≤ 17) und Mähne samt Stirnschopf
  (alle dunklen Nebelpixel (18,28,63)/(30,23,69)/(67,66,119) und die zwei Sternpixel bei x ≥ 28, y ≤ 12) werden NICHT mehr als Spalten-/Zeilenwelle bewegt, sondern von einem glatten 2D-Strömungsfeld verformt (anim_orks.nebel):
  jedes Pixel wandert mit Quer- und Längsversatz (Welle läuft von der Wurzel zur Spitze, quer zur Strähne phasenverschoben → Wirbel; Quer Periode 24, Längs Periode 48, Schweif bis 3 px quer / 2,2 px längs, Mähne bis 1,7 / 1,3), die Strähnen
  dehnen und stauchen sich, ohne zu reißen (zwischen den verschobenen Nachbarpixeln wird mit einer Pixellinie verbunden). Wurzeln (am Rumpf bzw. am Pferdekopf) stehen fest bzw. heben sich mit dem Atmen mit. Im Schweif hellen sich zeitweise Strähnenpixel zum
  Pferde-Umrissblau (26,45,81) auf (Dichtestreifen laufen zur Spitze). Die Mähne liegt hinter dem Pferdekopf (verschobene Pixel verschwinden dahinter); Sterne/helles Violett am Mähnenrand bekommen eine dunkle Umhüllung (30,23,69) bzw. werden dunkel,
  damit die Außenkontur nie hell wird (Regel 16). Frame 0 = Original. Der Pferdeohr-Rand (31,9) gehört nicht mehr zur Mähne und bleibt fest.
* Haar der Reiterin weht (Periode 24, einmal pro Schleife je Böe): die unteren Zeilen des Haarvorhangs (y 12–16, nur Haarfarben) wehen bis 2 px nach links vom Umhang weg und zurück; die dadurch frei liegenden Umhangkanten bekommen die Umrissfarbe (Regel 16).
* Blinzeln der Reiterin (Frames 20–22 und 41–43): die vier Augenpixel nehmen die Hautfarbe (246,205,139) an. Das Pferd blinzelt versetzt (Frames 7–8 und 30–31): die zwei goldenen Augenpixel nehmen die Fellfarbe (110,130,176) an.
* Hufscharren (Frames 10–13 und 33–36, Hufe versetzt): das vordere linke Bein (x 31–33) bzw. das hintere linke Bein (x 15–17) hebt sich ab Zeile 26 starr um 1 px (Huf kurz angehoben) und setzt wieder auf.
Frame 0 = Original (Ruhepose); Kontrolle: anim_humanoide.ruhepose. Randpixel-Test (Regel 16): randtest.py.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Flächen; freigelegte Umhangkanten (x 21–22, y 12–16) werden zu Umrisspixeln (8,18,0) umgefärbt; freigelegte Pferderandpixel im Kopfbereich in (26,45,81); Nebelbrücken (Pixellinien in Nebelfarben) beim Dehnen.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_orks as O
import anim_untote as U

N, MS = 48, 66
GP = 7

spr = L.lade('elven-rider')
sh, sw = spr.shape[:2]
H, W = sh + 2 * GP, sw + 2 * GP
OFF = (GP, GP)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (8, 18, 0)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


NAVY_A, NAVY_B, NAVY_O, NAVY_Y = (18, 28, 63), (26, 45, 81), (30, 23, 69), (67, 66, 119)
STERN1, STERN2 = (212, 213, 247), (246, 246, 246)
HAARF = [(8, 18, 0), (97, 102, 79), (151, 149, 110), (66, 70, 53)]

schweif = L.farbmaske(spr, [NAVY_A]) & (yy >= 18) & (xx <= 17)
# Mähne samt Stirnschopf: alle dunklen Nebelpixel oben rechts am Pferdekopf (Marineblau/Violett und die zwei Sternpixel); Ohr und Kopf des Pferdes (Fellfarben, Umriss (26,45,81)) bleiben fest
# Runde 4 (Nutzer: „Das Horn des Einhorns sollte nicht so schlackern“): der violette Schrägstrich von der Stirn nach rechts oben ((34,12) … (39,7), Farben (30,23,69)/(67,66,119) mit den hellen
# Pixeln (212,213,247)) ist das HORN, kein Nebel. Es gehört nicht mehr zur Nebel-Mähne, sondern bleibt im starren Kopf (`rest`): es hebt sich nur mit dem Atmen des Pferdes, sonst völlig starr.
horn = L.farbmaske(spr, [NAVY_O, NAVY_Y, STERN1, STERN2]) & (xx >= 33) & (yy <= 12)
assert horn.sum() >= 15
maehne = L.farbmaske(spr, [NAVY_A, NAVY_O, NAVY_Y, STERN1, STERN2]) & (xx >= 28) & (yy <= 12) & ~horn
haar = L.farbmaske(spr, HAARF) & (xx <= 21) & (yy >= 12) & (yy <= 16)
bein_v = vorhanden & (xx >= 31) & (xx <= 33) & (yy >= 26)
bein_h = vorhanden & (xx >= 15) & (xx <= 17) & (yy >= 26) & ~schweif
teile = [schweif, maehne, haar, bein_v, bein_h]
for a_ in range(len(teile)):
    for b_ in range(a_ + 1, len(teile)):
        assert not (teile[a_] & teile[b_]).any(), (a_, b_)
rest = vorhanden.copy()
for t_ in teile:
    rest &= ~t_

AUGE_R = [(25, 7), (26, 7), (25, 8), (26, 8)]
LID = (246, 205, 139)
AUGE_P = [(33, 13), (33, 14)]
assert f(33, 13) == (205, 180, 68) and f(33, 14) == (205, 180, 68)
FELL = (110, 130, 176)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GP, GP)


def kontur_pferd(a, erlaubt):
    """Wie Hm.kontur_schliessen, aber am Pferd (x ≥ 26, y ≥ 8 ohne Reiterin) in der Umrissfarbe des Pferds (26,45,81) statt im Dunkelgrün der Reiterin."""
    kk = Hm.kantenmaske(a)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in a[y, x, :3])
        if c in erlaubt:
            continue
        a[y, x, :3] = NAVY_B if (x - GP >= 29 or y - GP >= 20) else UMRISS
    return a


def nebel_umhuellen(e, fest):
    """Die hellen Pixel der Mähne (Sterne, helles Violett) liegen im Original mitten im Nebel. Wandern sie an den Rand, würde die Außenkontur hell (Regel 16): Sterne bekommen dann
    dunkle Nebelpixel (30,23,69) als Umhüllung in ihre freien 4er-Nachbarfelder (frei = weder Nebel noch Pferd/Reiterin `fest`), helles Violett wird selbst dunkel."""
    h, w = e.shape[:2]
    out = e.copy()
    for y in range(h):
        for x in range(w):
            if not e[y, x, 3]:
                continue
            c = tuple(int(v) for v in e[y, x, :3])
            if c not in (STERN1, STERN2, NAVY_Y):
                continue
            frei = [(y + dy, x + dx) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)) if not e[y + dy, x + dx, 3] and not fest[y + dy, x + dx, 3]]
            if not frei:
                continue
            if c == NAVY_Y:
                out[y, x, :3] = NAVY_O
            else:
                for (yy_, xx_) in frei:
                    out[yy_, xx_, :3] = NAVY_O
                    out[yy_, xx_, 3] = 255
    return out


def frame_gross(i, nur=None):
    r = teil(rest)
    if Hm.folge(i, 20, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(r, {p: LID for p in AUGE_R}, OFF)
    if Hm.folge(i, 7, [1, 1], N) or Hm.folge(i, 30, [1, 1], N):
        Hm.setze(r, {p: FELL for p in AUGE_P}, OFF)
    b = 1 if Hm.welle01(i, 24) > 0.5 else 0
    # Beine (starr 1 px hoch, Huf scharrt)
    lv = 1 if Hm.folge(i, 10, [1, 0, 1, 1], N) else 0
    lh = 1 if Hm.folge(i, 33, [1, 0, 1, 1], N) else 0
    bv = L.versetze(teil(bein_v), 0, -lv)
    bh = L.versetze(teil(bein_h), 0, -lh)
    # Haar der Reiterin: Zeilen 12–16 wehen nach links (0 … −2), Frame 0 = Ruhe
    s = Hm.welle01(i, N)
    ha = teil(haar)
    dxz = {y: -int(round(2.0 * ((y - 11) / 5.0) * s)) for y in range(12, 17)}
    ha = Hm.zeilen_versatz(ha, OFF, dxz)
    # Atmen: Rumpf + Reiterin (ohne Beine/Schweif)
    if b:
        r = TX.streck_zeile(r, GP + 23, b)
    # Schweif und Mähne = dunkler Nebel (anim_orks.nebel): Strömungsfeld statt starrer Welle
    sc = O.nebel(teil(schweif), (GP + 17, GP + 22), (-1.0, 0.1), 17.0, i, N, **SCHWEIF_NEBEL,
                 zusatz=lambda x, y, u: (0, -b * max(0.0, 1.0 - 1.5 * u) if y < GP + 23 else 0))
    mh = O.nebel(teil(maehne), (GP + 29, GP + 11), (1.0, -0.5), 10.0, i, N, **MAEHNE_NEBEL, zusatz=lambda x, y, u: (0, -b))
    mh = nebel_umhuellen(mh, r)
    fr = L.zusammen(H, W, [(sc, 0, 0), (mh, 0, 0), (r, 0, 0), (ha, 0, -b), (bv, 0, 0), (bh, 0, 0)])
    return kontur_pferd(fr, ERLAUBT | {c for c in FOG_FARBEN})


SCHWEIF_NEBEL = dict(amp_q=3.0, amp_a=2.2, lauf=2.2, quer=0.25, k1=2, k2=1, potenz=1.0, heller=dict(nur=NAVY_A, farbe=NAVY_B, k=2, frq=6.0, quer=0.5, schwelle=1.2))
MAEHNE_NEBEL = dict(amp_q=1.7, amp_a=1.3, lauf=2.0, quer=0.35, k1=2, k2=1, potenz=1.0, phase=0.6)
FOG_FARBEN = {NAVY_A, NAVY_O, NAVY_Y, STERN1, STERN2}


def _box():
    fr = [frame_gross(i) for i in range(N)]
    return U.zuschnitt(fr, fr, (GP, GP, GP + sw, GP + sh), zugabe=2, rand=2)


BOX = _box()


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    BX, BY = GP - BOX[0], GP - BOX[1]
    diff = Hm.ruhepose(frames[0], spr, (BX, BY))
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', len(neu), 'Frames')
    L.speichern('elven-rider', 'Elven Rider', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/elven-rider-strip.png', frames, spalten=12, scale=5)
