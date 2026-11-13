# -*- coding: utf-8 -*-
"""Idle-Animation für „Rebelliokai Oblivious Oni“ (Creature) — der blaue Oni mit drei Hörnern und roten Augen, daneben seine Eisenkeule und über ihm drei Fragezeichen.

Quelle: src/rebelliokai-oblivious-oni.png (38×61 px, 31 Farben) = die zusammengesetzte Karten-Szene der Figur; dazu die drei Ebenen getrennt auf derselben 38×61-Leinwand:
src/rebelliokai-oblivious-oni-koerper.png (Oni), -keule.png (Eisenkeule), -fragezeichen.png (drei Fragezeichen). Die drei Ebenen überlappen sich nicht (geprüft), das Composite ist ihre Summe.
PICK: [["MotiveJapan", 107, 1], ["MotiveJapan", 101, 1], ["MotiveJapan", 106, 1]]
      (Ebene 107 „Ebene #115“ = Oni, Ebene 101 = Keule, Ebene 106 = die drei Fragezeichen; in der Karte (Fragezeichen mit Rand abgeschnitten) bei (34,13) / (51,26) / (25,−7);
      Abgleich mit der Kunst mit Farbtoleranz 100 %. Die Ebenen 102/103 (Blutfleck, dunkle Wolke) und die Schwert-/Knochen-/Fleisch-Ebenen der Karte gehören nicht zur Figur.)
Quelle vollständig: ja — Oni, Keule und Fragezeichen liegen als komplette Ebenen vor (die Karte schneidet nur die Fragezeichen oben und die Keule unten ab).
ANNAHMEN: Die Keule steht neben dem Oni auf dem Boden (nicht in der Hand, sie berührt nur die Klauen) → bleibt unten stehen; die Fragezeichen sind das Namensmotiv („Oblivious“) und schweben über dem Kopf (Sprechblasen-Symbol, kein Partikel) — sie
liegen auf einer eigenen Ebene, fallen also leicht heraus, falls der Spielgestalter sie nicht im Sprite haben will (dann nur die Ebene weglassen).

Aufruf:   python3 rebelliokai_oblivious_oni.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rebelliokai-oblivious-oni.png + .json

Was im Sprite ist (x, y im 38×61-Sprite):
* ONI (x 9–26, y 20–57): blauer Körper (57,98,139)/(78,137,194)/(127,184,210) mit dunklem Umriss (32,44,65)/(24,24,24); DREI HÖRNER in Gold/Braun (196,166,101)/(144,112,46)/(101,63,31): links (x 11–15, y 21–26), mittig (x 17, y 20–22 plus Stirnplatte x 15–19, y 23–26), rechts (x 21–25, y 22–27);
  GESICHT (x 13–22, y 27–33): schwarze Brauenzeile (0,0,0) bei y 30, rote AUGEN (206,11,0) mit dunklem Nachbarpixel (17,20,28) bei (14–15,31) und (18–19,31) — beide Augen blicken nach links —,
  weiße Hauer (246,255,255)/(203,218,236) bei (15,32–33) und (18,32–33); OBERKÖRPER (x 11–23, y 34–44): breite Schultern, Rippen/Bauch in zwei Blautönen, die Arme hängen in dunklen Umrisssäulen (x 11–13 und 22–24);
  lila GÜRTEL (80,48,102)/(100,68,124) bei y 43–44; dunkler LENDENSCHURZ mit grauen Nieten (87,81,77)/(38,38,38) (x 9–26, y 44–49); zwei BEINE (x 12–22, y 49–55) mit blauen Lichtern und grauen Zehenkrallen (y 55–57).
* KEULE (x 26–37, y 33–60): oben ein grauer Eisenknauf (48,48,48)/(64,64,64)/(88,88,88) (y 33–35), ein hölzerner Griff in Orange/Braun (154,88,3)/(120,64,3)/(183,113,13)/(90,47,0) (y 36–44), unten der große, dornige Eisenkopf (y 45–60). METALL → Glanz erlaubt.
* FRAGEZEICHEN (x 0–33, y 0–25): drei weiße (255,255,255)-graue Fragezeichen, das mittlere höher; je 96 Pixel.
Kein Feuer, kein Stein, keine Partikel; Hörner/Haut glänzen nicht (Regel 14), nur das Eisen der Keule.

Ablauf (72 Frames à 80 ms = 5,76 s, nahtlos — der Oni ist schwer und träge; Frame 0 = Original):
* ATMEN zweistufig mit Nachlauf (2× je Schleife): erst hebt sich die untere Brust (die Rippenzeile y 41 wird einmal doppelt eingefügt, Texturmischung — Kopf, Hörner, Schultern und Arme steigen 1 px, Beine/Lendenschurz/Füße bleiben),
  3 Frames später die obere Brust (Rippenzeile y 37 wird einmal doppelt eingefügt: Kopf und Hörner steigen noch 1 px; Hals und Kinn werden nicht gestreckt, nur Rippenzeilen). Gesamthub 2 px.
* AUGEN wandern: die roten Pupillen springen von links nach rechts (die roten und die dunklen Pixel tauschen den Platz) und wieder zurück (Frames 18–35 blickt er nach rechts); zweimal BLINZELN (Frames 30–32 und 66–68):
  die rote Zeile y 31 nimmt die helle Hautfarbe (127,184,210) an, die schwarze Brauenzeile bleibt als Lidstrich.
* FRAGEZEICHEN hüpfen nacheinander: links (Start Frame 4), Mitte (Start 28), rechts (Start 52) — jedes hebt sich 4 Frames lang um 1 px und fällt zurück.
* KEULE glänzt (Regel 12, Eisen): zweimal je Schleife (Start 8 und 44, 16 Frames) läuft ein Lichtband über die inneren Eisenpixel des Kopfes und des Knaufs (1–2 Stufen heller auf der Rampe (48,48,48) → (64,64,64) → (88,88,88) → (128,128,128) → (203,218,236)),
  danach blitzt an einer Dornenspitze ein kleiner 4-zackiger Stern auf. Griff und Holz glänzen nicht, die Keule bleibt unten stehen.
Fest: Beine, Lendenschurz, Zehenkrallen, Keule (außer Glanz). Alle Bewegungen laufen auf der vollen Leinwand (ClipError statt Abschneiden). Nur ganze Pixel, nur Quellfarben.
Ergänzungen: keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)
import anim_rebel as R

N, MS = 72, 80
PAD_L, PAD_R, PAD_T, PAD_B = 2, 3, 3, 2

spr = L.lade('rebelliokai-oblivious-oni')
oni = L.lade('rebelliokai-oblivious-oni-koerper')
keule = L.lade('rebelliokai-oblivious-oni-keule')
fz = L.lade('rebelliokai-oblivious-oni-fragezeichen')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
f = lambda x, y: R.farbe(oni, x, y)
_chk = L.leer(sh, sw)
for e in (oni, keule, fz):
    _chk[e[..., 3] > 0] = e[e[..., 3] > 0]
assert (_chk == spr).all() and ((oni[..., 3] > 0) & (keule[..., 3] > 0)).sum() == 0

ERLAUBT = set(Hm.umrissfarben(spr))
HAUT_LICHT = f(16, 31)                                              # (127,184,210)
ROT, DUNKEL = f(14, 31), f(15, 31)                                  # (206,11,0), (17,20,28)
AUGEN_L, AUGEN_R = [(14, 31), (15, 31)], [(18, 31), (19, 31)]
UMRISS_ONI = f(13, 38)                                              # Umriss; unten per Etikett
yy, xx = np.mgrid[0:sh, 0:sw]
# --- Fragezeichen: drei Komponenten ---
import cv2
_n, _lab = cv2.connectedComponents((fz[..., 3] > 0).astype(np.uint8), connectivity=8)
fz_l, fz_m, fz_r = (_lab == _lab[18, 5]), (_lab == _lab[3, 17]), (_lab == _lab[18, 28])
assert fz_l.any() and fz_m.any() and fz_r.any()
# --- Keule: Eisen (ohne Holz) ---
EISEN = {(48, 48, 48), (64, 64, 64), (88, 88, 88), (128, 128, 128), (90, 88, 86)}
kdeck = keule[..., 3] > 0
eisen = np.zeros((sh, sw), bool)
for y in range(sh):
    for x in range(sw):
        if kdeck[y, x] and R.farbe(keule, x, y) in EISEN:
            eisen[y, x] = True
kante = Hm.kantenmaske(keule)
eisen_innen = eisen & ~kante
RAMPE = [(48, 48, 48), (64, 64, 64), (88, 88, 88), (128, 128, 128), (203, 218, 236)]
STERN = ((203, 218, 236), (203, 218, 236))                          # Kern/Arme in der hellsten Stufe (203,218,236) (Randfarbe der Quelle: Hauerspitzen)
STERN_ORT = (35, 51)
LOCH0 = R.loecher(L.platz(spr, H, W, *OFF))
KEULE_UMRISS = (48, 48, 48)
DEFAULT = {'oni': (32, 44, 65), 'keule': (48, 48, 48), 'fz': R.farbe(fz, 5, 18)}


def ebene(quelle, maske=None, dy=0):
    q = quelle if maske is None else L.trenne(quelle, maske)[0]
    return L.platz(q, H, W, OFF[0], OFF[1] + dy)


def frame(i):
    # Atmen: untere Brustzeile (y 41) zuerst, obere Brustzeile (y 37) 3 Frames später (Kopf/Hals werden nicht gestreckt)
    b1 = Hm.stufe(i, N / 2, 1)
    b2 = Hm.stufe(i - 3, N / 2, 1)
    k = ebene(oni)
    # Augen: Blickrichtung + Blinzeln
    rechts = Hm.takt(i, N, 18, 18)
    if rechts:
        Hm.setze(k, {AUGEN_L[0]: DUNKEL, AUGEN_L[1]: ROT, AUGEN_R[0]: DUNKEL, AUGEN_R[1]: ROT}, OFF)
    if Hm.folge(i, 30, [1, 1, 1], N) or Hm.folge(i, 66, [1, 1, 1], N):
        Hm.setze(k, {p: HAUT_LICHT for p in AUGEN_L + AUGEN_R}, OFF)
    # obere Brustzeile zuerst (alles darüber steigt), danach die untere
    if b2:
        k = TX.streck_zeile(k, PAD_T + 37, 1)
    if b1:
        k = TX.streck_zeile(k, PAD_T + 41, 1)
    # Keule + Glanz
    ke = ebene(keule)
    for start in (8, 44):
        k_ = (i - start) % N
        if 0 <= k_ < 16:
            ys, xs = np.nonzero(eisen_innen)
            u = xs + ys * 0.8
            mitte = u.min() - 2 + (k_ + 0.5) / 16.0 * (u.max() - u.min() + 4)
            for y, x, uu in zip(ys, xs, u):
                if abs(uu - mitte) <= 1.6:
                    c = tuple(int(v) for v in ke[y + PAD_T, x + PAD_L, :3])
                    ke[y + PAD_T, x + PAD_L, :3] = Hm.farbe_stufe(c, RAMPE, 2 if abs(uu - mitte) <= 0.8 else 1)
    st = Hm.folge(i, 24, [0, 1, 1, 0], N)
    if st is None:
        st = Hm.folge(i, 60, [0, 1, 1, 0], N)
    # Fragezeichen: hüpfen nacheinander
    def hop(start):
        return -1 if Hm.folge(i, start, [1, 1, 1, 1], N) else 0
    fl = ebene(fz, fz_l, hop(4))
    fm = ebene(fz, fz_m, hop(28))
    fr = ebene(fz, fz_r, hop(52))
    fig, etik = R.schichten(H, W, [(ke, 'keule'), (k, 'oni'), (fl, 'fz'), (fm, 'fz'), (fr, 'fz')])
    if st is not None:
        x, y = STERN_ORT
        pts = {(x, y): STERN[0]}
        if st >= 1:
            pts.update({(x + 1, y): STERN[1], (x - 1, y): STERN[1], (x, y + 1): STERN[1], (x, y - 1): STERN[1]})
        Hm.setze(fig, pts, OFF)
    R.neue_loecher_fuellen(fig, LOCH0, ERLAUBT)
    R.kontur_je_teil(fig, etik, ERLAUBT, DEFAULT)
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = R.vorschau_arg()
    R.abschluss('rebelliokai-oblivious-oni', 'Rebelliokai Oblivious Oni', frames, MS, spr, OFF, prev, check_frames=[0, 6, 12, 18, 24, 30, 36, 44, 52, 60])
