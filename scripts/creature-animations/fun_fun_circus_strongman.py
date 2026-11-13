# -*- coding: utf-8 -*-
"""Idle-Animation für „Fun-Fun Circus Strongman“ (Creature) — der Zirkus-Kraftmensch mit Zylinder-/Totenkopfmaske, nacktem Oberkörper, gestreifter Hose, der mit dem erhobenen linken Arm eine Hantel stemmt (rechts hängt eine Kette).

Quelle: src/fun-fun-circus-strongman.png (29×29 px, 116 Farben; das Komposit der fünf Ebenen) und die Einzelebenen src/fun-fun-circus-strongman-L18/L19/L20/L21/L22.png (gleiches Raster, damit Verdecktes vollständig vorliegt).
PICK: [["MotiveMoe", 18, 1], ["MotiveMoe", 19, 1], ["MotiveMoe", 20, "alle Pixel"], ["MotiveMoe", 21, 2], ["MotiveMoe", 22, 1]]
  Ebenen der Datei MotiveMoe (hoher Index = weiter hinten): 18 „Fun-Fun Strongman #4“ = Kette; 19 „#1“ = Totenkopfmaske; 20 „Fun-Fun Strongman“ = Körper mit Kopf, Rumpf, rechtem Arm, Hose, Füßen und der erhobenen Faust (schwebt im Bild frei);
  21 (Figur 2, 19×23 px) = die Hantel; 22 „#3“ = der erhobene Unterarm. Die Ebene 21 enthält außerdem drei „10T“-Gewichte (Kulisse) — sie gehören nicht zur Figur. Ebene 20 hat in der Treffersuche gefehlt (Figur ist über
  mehrere Ebenen verteilt): Kompositprobe gegen die Karte Fun_Fun_Circus_Strongman.png: Ebenen 18+19+20 passen zu 100 % bei (26,17); Hantel + Unterarm kamen aus dem Abgleich der Nachbarebenen (Regel 20).
  Quelle vollständig; die Karte zeigt Luftballons, Gras und 10T-Gewichte (Kulisse).

Aufruf:   python3 fun_fun_circus_strongman.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/fun-fun-circus-strongman.png + .json

Was im Sprite ist (x, y im 29×29-Sprite):
* HANTEL (Ebene 21, Eisen!): oben ein schwarzes Gewicht (x 10–17, y 0–4, graue Lichter (74,74,74)), von dort eine dünne schwarze Stange schräg nach links unten (x 8–10, y 5–14) bis zum unteren Gewicht (x 0–8, y 14–20) mit weißer „1T“-Beschriftung. Die Stange liegt hinter der Faust.
* ERHOBENER ARM: Faust (Ebene 20, x 3–8, y 8–11, braun/hautfarben, Umriss (49,24,0)) und Unterarm/Bizeps (Ebene 22, x 3–9, y 12–18), der hinter dem Rumpf endet (Ellenbogen bei x 8–9, y 17–18).
* KOPF (Ebene 20, x 11–19, y 5–14): Haarschopf/Stirn, helle Brille/Augenpartie; darüber die TOTENKOPFMASKE (Ebene 19, x 11–18, y 6–14): grau/weiß mit schwarzen Augenhöhlen, weißem Gebiss — bleibt fest am Kopf (Regel 21).
* RUMPF (x 10–20, y 12–19): nackter Oberkörper in Hautfarben-Verlauf (viele Töne), braune Hosenträger/Brustbehaarung, Gürtel; HOSE (x 9–20, y 19–25): schwarz-weiße Längsstreifen; FÜSSE (y 26–28): zwei braune Stiefel mit hautfarbener Sohle (x 9–13 und 16–20).
* RECHTER ARM (x 21–25, y 13–23): hängend, Faust unten (x 22–25, y 19–23).
* KETTE (Ebene 18, Metall, grau (57,57,54)/(109,109,101)/(143,143,132)): von der rechten Hand (x 21–27, y 18–25) hinunter und als Schlinge über den Boden vor den Füßen (x 5–27, y 24–28).
Metall: Hantelgewichte und Kette → nur dort Lichtband/Glitzer (Regel 14); Haut, Hose, Stiefel, Maske glänzen nicht. Keine Partikel, kein Feuer.

Ablauf (72 Frames à 62 ms = 4,46 s, nahtlos):
* HANTEL STEMMEN (Periode 24, drei Hübe je Schleife): Faust + Unterarm + Hantel (starr, Ebenen 20-Faust/22/21 gemeinsam) heben sich zusätzlich zum Körper (Atmen) um höchstens 1 px relativ zu Kopf und Rumpf (Runde 3: vorher bis 2 px → Lücke zwischen oberem Gewicht und Kopf; bei 1 px wird nur die verdeckte unterste Gewichtszeile frei, das Gewicht berührt den Kopf weiter); die Stange bleibt in der Faust, der Unterarm taucht hinter den Rumpf.
* ATMEN (Periode 36, bis 2 px): die Hosenzeile 22 wird bis zu 2× eingefügt (Texturmischung); Kopf mit Maske, Brust und der rechte Arm (starr) steigen, Hose/Füße bleiben; die Hantel steigt mit, die Kette am rechten Arm (samt Kettenende bis y 25) folgt dem Arm komplett (Runde 3: die untersten Endpixel blieben zurück).
* FÜSSE: stehen völlig fest (Runde 4: das frühere Fußtippen ist auf Nutzerwunsch entfernt).
* METALL: ein Lichtband läuft über das obere Hantelgewicht (Frames 6–15) und das untere (Frames 36–45), ein Lichtband über die Kette am Boden (Frames 56–67); je ein Glitzerstern am oberen Gewicht (Frames 22–26) und am unteren (Frames 52–56) — sie sitzen am Eisen und gehen mit der Hantel.
* Kein Kopfwiegen seitlich (Regel 17), kein Schweben (Regel 18).
Frame 0 = Original (Ruhepose). Ergänzungen: keine (die Ebenen liegen vollständig vor; der Arm taucht hinter den Rumpf, der unter der Faust ungezeichnete Teil der Stange ist in Ebene 21 vorhanden).
"""
import sys

import numpy as np
from PIL import Image

import anim_humanoide as Hm
import anim_lib as L
import anim_schach as Sc

N, MS = 72, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 6, 2

spr = L.lade('fun-fun-circus-strongman')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]


def lade_ebene(n):
    return np.array(Image.open(L.SRC + f'/fun-fun-circus-strongman-L{n}.png').convert('RGBA'))


E18, E19, E20, E21, E22 = (lade_ebene(n) for n in (18, 19, 20, 21, 22))
v20 = L.deckend(E20)
FAUST = v20 & (xx <= 8) & (yy <= 12)
ARM_R = v20 & (xx >= 21) & (yy >= 13)
FUSS_L = v20 & (yy >= 26) & (xx <= 14)
FUSS_R = v20 & (yy >= 26) & (xx >= 15)
RUMPF = v20 & ~FAUST & ~ARM_R & ~FUSS_L & ~FUSS_R
v18 = L.deckend(E18)
KETTE_OBEN = v18 & (xx >= 20) & ((yy <= 23) | (xx >= 24))      # Kettenende am rechten Arm komplett (auch die Pixel y 24–25 am Ende)
KETTE_REST = v18 & ~KETTE_OBEN
v21 = L.deckend(E21)
GEW_OBEN = v21 & (yy <= 4)
GEW_UNTEN = v21 & (yy >= 14)
RAMPE_EISEN = [(23, 23, 21), (38, 38, 38), (74, 74, 74), (101, 101, 101)]
RAMPE_KETTE = [(57, 57, 54), (109, 109, 101), (143, 143, 132)]
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (49, 24, 0)


def eb(a, m=None, dx=0, dy=0):
    t = a if m is None else L.trenne(a, m)[0]
    return L.platz(t, H, W, OFF[0] + dx, OFF[1] + dy)


def frame(i, nur=None):
    hub = Hm.stufe(i, 36, 2)
    pump = Hm.stufe(i, 24, 1)                     # Hantel steigt höchstens 1 px relativ zum Kopf: die verdeckte unterste Gewichtszeile (y 5) wird frei, es bleibt keine Lücke zum Kopf
    arm_dy = -hub - pump
    # Hantel + Glanz (Eisen: Lichtband, Glitzerstern), starr mit Faust und Unterarm
    db = eb(E21)
    Hm.lichtband(db, GEW_OBEN, OFF, i, N, 6, 10, RAMPE_EISEN, stufen=1, breite=2.6, achse=(1.0, 1.0), kern=2)
    Hm.lichtband(db, GEW_UNTEN, OFF, i, N, 36, 10, RAMPE_EISEN, stufen=1, breite=2.6, achse=(1.0, 1.0), kern=2)
    db = L.versetze(db, 0, arm_dy)
    unterarm = L.versetze(eb(E22), 0, arm_dy)
    faust = L.versetze(eb(E20, FAUST), 0, arm_dy)
    # Rumpf + Kopf: Atmen über die Hosenzeile 24
    rumpf = Hm.atmen(eb(E20, RUMPF), OFF[1] + 22, OFF[1] + 12, hub, 0)
    arm_r = L.versetze(eb(E20, ARM_R), 0, -hub)
    maske = L.versetze(eb(E19), 0, -hub)
    fl, fr = eb(E20, FUSS_L), eb(E20, FUSS_R)       # Runde 4: Füße stehen fest (kein Fußtippen/-wippen mehr)
    # Kette: obere Hälfte folgt der Hand, Bodenkette fest; Lichtband über die Bodenkette
    kr = eb(E18, KETTE_REST)
    Hm.lichtband(kr, KETTE_REST, OFF, i, N, 56, 12, RAMPE_KETTE, stufen=1, breite=3.0, achse=(1.0, 0.0), kern=2)
    ko = L.versetze(eb(E18, KETTE_OBEN), 0, -hub)
    fig = L.zusammen(H, W, [(unterarm, 0, 0), (db, 0, 0), (fl, 0, 0), (fr, 0, 0), (rumpf, 0, 0), (arm_r, 0, 0), (faust, 0, 0), (maske, 0, 0), (ko, 0, 0), (kr, 0, 0)])
    fig = Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)
    if not nur:
        # Glitzersterne am Eisen (nach dem Konturschluss gezeichnet), sie folgen der Hantel
        for s, (sx, sy) in ((22, (15, 1)), (52, (7, 17))):
            st = Hm.folge(i, s, [0, 1, 2, 1, 0], N)
            if st is not None:
                Hm.stern4(fig, sx, sy + arm_dy, st, (255, 255, 255), (219, 219, 219), (219, 219, 219), OFF)
    return fig


TEST_EBENEN = ('koerper',)          # Randpixel-Test (randtest.py) ohne die Glitzersterne

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('fun_fun_circus_strongman', 'Fun-Fun Circus Strongman', frames, MS, prev, spr, OFF)
