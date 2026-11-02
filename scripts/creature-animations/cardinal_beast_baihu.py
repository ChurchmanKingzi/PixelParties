# -*- coding: utf-8 -*-
"""Idle-Animation für „Cardinal Beast Baihu“ (Creature) — der Weiße Tiger des Westens: frontal sitzender weißer Tiger mit Spitzohren, roten Augen, geöffnetem Maul voller Reißzähne,
zottigem Brustfell und je zwei langen, gezackten violetten Schmuckfedern/Schnurrhaar-Fächern an beiden Kopfseiten.

Quelle: src/cardinal-beast-baihu.png (48×40 px, 26 Farben).
PICK: [["MotiveGrailWar", 7, 1]]      (Ebene „Baihu #1“, Figur 1; Ebene 430 Figur 16 war ein 12×12-Fehltreffer)
Quelle vollständig: ja (Kopf, Ohren, Schmuckfächer, Brustfell, beide Vorderbeine mit Krallenstrichen in einer Ebene).

Aufruf:   python3 cardinal_beast_baihu.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cardinal-beast-baihu.png + .json

Identifikation (x, y im 48×40-Sprite, die Figur ist spiegelsymmetrisch um x = 23,5):
* OHREN (links x 14–20, rechts x 27–33, y 0–4): violette Spitzohren (109,87,154)/(170,153,229)/(184,172,217) mit dunklem Rand (45,30,65), innen hell.
* KOPF (x 14–33, y 5–20): weiß/hellgrau (229,230,237)/(207,208,216)/(165,164,185) mit violetten Stirn- und Wangenzeichen (146,121,189)/(109,87,154); dunkler Stirnbogen (66,61,93) bei y 5;
  AUGEN: links (18–21, 11–13), rechts (26–29, 11–13): zornige Schlitzaugen in Dunkelrot (111,43,57)/(156,73,81)/(123,8,24) mit rosa Glanzpunkt (248,221,233) bei (19,12)/(28,12);
  NASE (x 22–25, y 16): dunkle Nasenlinie (94,94,110) mit Spitze; MAUL (x 19–29, y 19–22): dunkelrot (51,5,0)/(90,8,0)/(123,8,24) mit weißen Reißzähnen (209,217,217)/(246,255,255).
* SCHMUCKFÄCHER (links x 0–13, rechts x 34–47): je zwei waagerechte, gezackte violette Federbündel — oberes y 10–15 (Wurzel an der Wange, x 14–17), unteres y 17–20 (Wurzel x 13–17) — mit hellen
  Segmenten (170,153,229)/(229,230,237)/(184,172,217); sie sind Haar-/Federschmuck, keine Beine.
* BRUSTFELL (x 11–36, y 21–27): breiter weißer Kragen aus Zottelfell (229,230,237)/(207,208,216)/(165,164,185) mit grauem Rand (99,98,114).
* VORDERBEINE/PFOTEN (links x 9–20, rechts x 27–38, y 28–38): violette Beine (109,87,154)/(146,121,189)/(170,153,229); KRALLENSTRICHE: dünne graue Diagonalen (107,110,121)/(65,64,71)/(140,140,156) um die
  Pfoten (x 7–11 / 36–40, y 27–39); sie bleiben fest.
Fest bleiben: Gesicht (außer Blinzeln), Maul, Beine, Krallenstriche.

Ablauf (48 Frames à 80 ms = 3,84 s, nahtlos):
* ATMEN (zweistufig): Kopf, Ohren und beide Fächerwurzeln steigen in zwei Stufen um bis zu 2 px (Kragenzeile 25 wird 1–2× eingefügt, mit Nachbartextur gemischt); Beine/Krallen bleiben am Boden.
* SCHMUCKFÄCHER (vier unabhängige Bewegungen): jedes Bündel schlägt mit der Spitze bis ±1,7 px auf und ab (Kippen der Spalten um die Wurzel, 4-verbunden): oben links Periode 24, unten links 16 (gegenläufig),
  oben rechts 48, unten rechts 12 (gegenläufig) — Wurzeln (x 14–17 / 30–33) bleiben stehen, die Federtextur wird nur verschoben, nie kopiert.
* OHRZUCKEN: linkes Ohr (Frames 8–13) und rechtes Ohr (Frames 30–35) klappen mit der oberen Hälfte 1 px nach außen und zurück (Zeilenversatz, Umriss wandert mit).
* BLINZELN: Frames 20–22 und 42–44 (Augenschlitz schließt sich zu einer dunklen Linie, Lid = Fellgrau (165,164,185)).
Frame 0 = Ruhepose (Original). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (Fächer und Ohren behalten ihre Wurzel an der Wange; nichts Verdecktes wird freigelegt).
"""
import os
import sys

import numpy as np

import anim_flieger_b as FB
import anim_gbb as G
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 80
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 6, 3

spr = L.lade('cardinal-beast-baihu')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (45, 30, 65)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


FELL = f(23, 12)                                                                # (207,208,216)
LID = f(20, 14)                                                                 # Fellgrau/Lila
LID = (165, 164, 185)
AUGE_DUNKEL = f(20, 12)                                                         # (68,31,48)
AUGE_L = {'o': [(18, 11), (19, 11)], 'm': [(18, 12), (19, 12), (20, 12), (21, 12)], 'u': [(18, 13), (19, 13), (20, 13), (21, 13)]}
AUGE_R = {'o': [(29, 11), (28, 11)], 'm': [(29, 12), (28, 12), (27, 12), (26, 12)], 'u': [(29, 13), (28, 13), (27, 13), (26, 13)]}

fl_ol = vorhanden & (xx <= 13) & (yy <= 15)
fl_ul = vorhanden & (xx <= 13) & (yy >= 16) & (yy <= 21)
fl_or = vorhanden & (xx >= 34) & (yy <= 15)
fl_ur = vorhanden & (xx >= 34) & (yy >= 16) & (yy <= 21)
faecher = fl_ol | fl_ul | fl_or | fl_ur
ohr_l = vorhanden & ~faecher & (xx <= 20) & (yy <= 3)
ohr_r = vorhanden & ~faecher & (xx >= 27) & (yy <= 3)
beine_m = vorhanden & ~faecher & (yy >= 26)
kopf_m = vorhanden & ~faecher & ~ohr_l & ~ohr_r & (yy <= 25)


def ebene(m, dx=0, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L + dx, PAD_T + dy)


def ohr_dx(i, start, vorz):
    w = Hm.folge(i, start, [0, 1, 1, 1, 1, 0], N)
    return 0 if not w else vorz * w


def fach(m, i, periode, vorz, pivot_x):
    """Schmuckfächer schlägt: Spalten wandern senkrecht, je weiter außen desto mehr (Kippen um die Wurzel, Spitze bis ±1,7 px); in Frame 0 überall 0."""
    a = ebene(m)
    ph = L.sinus(i, periode)

    def dy(fr):
        return 1.7 * vorz * fr * np.sin(ph)
    return FB.spalten_schub_4verbunden(a, PAD_L + pivot_x, dy)


def frame(i):
    r = int(round(2 * (0.5 - 0.5 * np.cos(L.sinus(i, N)))))                      # Atemhub 0…2
    # ── Kopf mit Brustfell: Blinzeln, dann Atmen ──
    kp = ebene(kopf_m)
    k = Hm.folge(i, 20, [1, 2, 1], N) or Hm.folge(i, 42, [1, 2, 1], N)
    if k:
        for A_ in (AUGE_L, AUGE_R):
            pix = {p: LID for p in A_['o']}
            if k == 2:
                pix.update({p: LID for p in A_['u']})
                pix.update({p: AUGE_DUNKEL for p in A_['m']})
            Hm.setze(kp, pix, OFF)
    kp = L.streck_zeile(kp, PAD_T + 25, r)
    # ── Ohren ──
    ol, orr = ebene(ohr_l), ebene(ohr_r)
    for lay, vorz, start in ((ol, -1, 8), (orr, 1, 30)):
        d = ohr_dx(i, start, vorz)
        if d:
            lay[:] = G.zeilen_dx(lay, {PAD_T + y: (d if y <= 1 else 0) for y in range(0, 4)})
    ol, orr = L.versetze(ol, 0, -r), L.versetze(orr, 0, -r)
    # ── Schmuckfächer ──
    a_ol = L.versetze(fach(fl_ol, i, 24, 1, 14), 0, -r)
    a_ul = L.versetze(fach(fl_ul, i, 16, -1, 14), 0, -r)
    a_or = L.versetze(fach(fl_or, i, 48, 1, 33), 0, -r)
    a_ur = L.versetze(fach(fl_ur, i, 12, -1, 33), 0, -r)
    bn = ebene(beine_m)
    fig = L.zusammen(H, W, [(a_ol, 0, 0), (a_ul, 0, 0), (a_or, 0, 0), (a_ur, 0, 0), (bn, 0, 0), (kp, 0, 0), (ol, 0, 0), (orr, 0, 0)])
    G.rand_schliessen(fig, ERLAUBT, UMRISS)
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
    L.speichern('cardinal-beast-baihu', 'Cardinal Beast Baihu', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/cardinal-beast-baihu-strip.png', frames, spalten=8, scale=4)
