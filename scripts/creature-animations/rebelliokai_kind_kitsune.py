# -*- coding: utf-8 -*-
"""Idle-Animation für „Rebelliokai Kind Kitsune“ (Creature) — der weiße Fuchs mit den geschlossenen „^ ^“-Augen, großen Ohren und drei rot-orangen Schweifen.

Quelle: src/rebelliokai-kind-kitsune.png (37×36 px, 14 Farben) = die zusammengesetzte Figur; dazu die beiden Ebenen getrennt auf derselben 37×36-Leinwand:
src/rebelliokai-kind-kitsune-fuchs.png (der ganze Fuchs inkl. der unter den Schweifen verdeckten Ohr-/Wangenpixel) und src/rebelliokai-kind-kitsune-schweife.png (die drei Schweife).
Beide zusammen (Schweife über dem Fuchs) ergeben exakt das Composite (geprüft: gleich).
PICK: [["MotiveJapan", 223, 1], ["MotiveJapan", 222, 1], ["MotiveJapan", 222, 2], ["MotiveJapan", 222, 3]]
      (Ebene 223 „Kitsune“ = Fuchs, 26×29 px, in der Kunst bei (26,4); Ebene 222 „Ebene #129“ = die drei Schweife, Figuren 1/2/3, in der Kunst um (22,−3) versetzt — der obere Schweif ragt dort 3 px über den Kartenrand,
      in der Ebene ist er vollständig; der automatische Treffer-Lauf kennt nur Figur 2 und 3. Die Kirschblüten, das Dach und der Himmel der Kunst gehören nicht zur Figur.)
Quelle vollständig: ja — alle Teile des Fuchses und alle drei Schweife; die vom oberen Schweif verdeckte Ohrspitze (Pixel (9–12, 7–10)) und die von den Schweifen verdeckten Wangen-/Ohrpixel liegen in der Fuchs-Ebene vor.

Aufruf:   python3 rebelliokai_kind_kitsune.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rebelliokai-kind-kitsune.png + .json

Was im Sprite ist (x, y im 37×36-Sprite):
* OHREN: links ein langes, spitzes Ohr (x 9–15, y 7–16; die obere Hälfte steckt unter dem oberen Schweif), rechts ein breites, nach rechts hängendes Ohr (x 17–28, y 11–20), hellgrau/weiß (199,220,208)/(219,242,229)/(240,250,236) mit dunkel-lila Umriss (62,53,70).
* KOPF (x 10–21, y 17–27): weißes Fell, die AUGEN sind zwei geschlossene, lachende „^“ aus je drei schwarzen Pixeln (0,0,0) bei (13,22)(12,23)(14,23) und (18,22)(17,23)(19,23) — kein Blinzeln nötig (sie sind schon zu); Schnauze/Nase dunkellila (62,53,70)/(127,112,138) bei (14–16, 24–25);
  weiße Wangenbüschel (255,255,255) bei (10,23–24) und (21,23–24); links ein diagonales Fellbüschel (x 4–11, y 17–24).
* KÖRPER (x 10–21, y 25–31) mit kleinem lila-grauem Brustband (127,112,138)/(105,79,98) und zwei Beinen (y 32–35).
* DREI SCHWEIFE in Rot/Orange: oben (x 5–15, y 0–11; zwei Spitzen), rechts (x 22–36, y 11–25) und links unten (x 0–10, y 18–31): Umriss (110,39,39), Körper (179,56,49)/(234,79,54), Lichter (245,125,74); die Schweife sind dunkelorange FLAMMEN (Fuchsfeuer): sie werden mit dem Feuermodul anim_feuer2.py als Feuer animiert (Nutzerkorrektur, Runde 3).
Kein Metall/Gold/Edelstein → KEIN Glanz. Keine Partikel.

Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos; Frame 0 = Original; ein Bodenwesen: die Füße bleiben am Boden):
* DREI SCHWEIF-FLAMMEN (Runde 4, „richtige Feuer-Animation“, anim_feuer3): klassischer Flammenzyklus, 10 Posen à 2 Frames (3 Zyklen je Schleife). Jeder Schweif = eine große Hauptflamme + zwei phasenversetzte Seitenzungen, Fluss vom Ansatz
  zur Spitze wie gemalt (oben nach oben, rechts nach rechts, links nach unten links); Farbbänder der Quelle: dunkler Umriss (110,39,39) außen → (179,56,49) → (234,79,54) → heller Kern (245,125,74) am Ansatz. Bäuche wandern zur Spitze,
  nur beim oberen Schweif schnüren sich die Spitzen ab und steigen als kleine Fetzen auf (seitlich/unten laufen die Zungen nur spitz aus, damit nichts „herabfällt“). Keine Einzelfunken mehr.
* OHREN: das linke Ohr wippt die Spitze (Zeilen y 7–12) 1 px seitlich (zweimal je Schleife), das rechte Ohr hebt/senkt seine Außenhälfte (Spalten x ≥ 22) bis 1 px (dreimal je Schleife, andere Phase).
* ATMEN (3× je Schleife, je 10 Frames oben): die Rumpfzeile 28 wird einmal doppelt eingefügt (Texturmischung): Kopf, Ohren und die Schweif-Ansätze steigen 1 px (Schweife starr mit), die Beine bleiben am Boden.
Fest: Gesicht (die „^“-Augen und Nase), Beine, Brustband. Alle Bewegungen laufen auf der vollen Leinwand (ClipError statt Abschneiden). Nur ganze Pixel, nur Quellfarben.
Ergänzungen: keine gemalten Pixel (nur Pixel aus der Fuchs-Ebene werden sichtbar, plus Brückenpixel der Kontur-Schließung in Umrissfarbe).
"""
import math
import sys

import cv2
import numpy as np
from PIL import Image

import anim_feuer3 as F3
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
import anim_rebel as R

N, MS = 60, 70
PAD_L, PAD_R, PAD_T, PAD_B = 7, 10, 12, 4

spr = L.lade('rebelliokai-kind-kitsune')
fuchs = L.lade('rebelliokai-kind-kitsune-fuchs')
schweife = L.lade('rebelliokai-kind-kitsune-schweife')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
f = lambda x, y: R.farbe(spr, x, y)

_chk = fuchs.copy()
_chk[schweife[..., 3] > 0] = schweife[schweife[..., 3] > 0]
assert (_chk == spr).all(), 'Fuchs + Schweife müssen das Composite ergeben'

ERLAUBT = set(Hm.umrissfarben(spr))
UMRISS_FUCHS, UMRISS_SCHWEIF = (62, 53, 70), (110, 39, 39)
n_, lab = cv2.connectedComponents((schweife[..., 3] > 0).astype(np.uint8), connectivity=8)
assert n_ - 1 == 3
t_oben, t_rechts, t_links = (lab == lab[5, 7]), (lab == lab[22, 30]), (lab == lab[25, 3])
fox = fuchs[..., 3] > 0
ohr_l_spitze = fox & (xx <= 14) & (yy <= 12)
ohr_r_aussen = fox & (xx >= 22) & (yy <= 20) & (yy >= 11)
fox_rest = fox & ~ohr_l_spitze & ~ohr_r_aussen
LOCH0 = R.loecher(L.platz(spr, H, W, *OFF))


# --- Schweif-Flammen (anim_feuer2) ---
def lay0(quelle, maske):
    t, _ = L.trenne(quelle, maske)
    return L.platz(t, H, W, OFF[0], OFF[1])


FUCHS_M = np.zeros((H, W), bool)
FUCHS_M[OFF[1]:OFF[1] + sh, OFF[0]:OFF[0] + sw] = fox
# Runde 4 (anim_feuer3): jeder Schweif ist eine Fuchsfeuer-Flamme — eine große Hauptflamme + zwei phasenversetzte Seitenzungen, Fluss vom Ansatz zur Spitze (wie gemalt: oben nach oben, rechts nach rechts, links nach unten links)
RAMPE_S = [UMRISS_SCHWEIF, (179, 56, 49), (234, 79, 54), (245, 125, 74)]
_F = lambda x, y, l, b, **k: F3.Flamme(OFF[0] + x, OFF[1] + y, l, b, **k)
_B = [(1.0, 1.0), (0.9, 0.8), (0.62, 0.52), (0.36, 0.28)]              # dünner dunkler Rand (1 px), kräftiger roter Körper, heller Kern am Ansatz — wie die gemalten Schweife
S_OBEN = [_F(10.3, 11.0, 12, 5.2, richtung=(-0.08, -1), fuss=1.0, bauch=0.5, schlag=0.9, phase=0.0, baender=_B, welle=9),
          _F(6.8, 8.5, 8, 2.8, richtung=(-0.35, -1), phase=0.4, baender=_B), _F(13.4, 8.5, 9, 2.8, richtung=(0.15, -1), phase=0.7, baender=_B)]
S_RECHTS = [_F(24.0, 19.5, 13, 5.2, richtung=(1, 0.18), fuss=1.0, bauch=0.5, schlag=0.9, phase=0.35, baender=_B, fetzen=False, welle=9),
            _F(27.0, 16.6, 8, 2.8, richtung=(1, -0.05), phase=0.75, baender=_B, fetzen=False), _F(26.5, 22.5, 9, 2.8, richtung=(1, 0.4), phase=0.05, baender=_B, fetzen=False)]
S_LINKS = [_F(8.5, 20.0, 13, 5.2, richtung=(-0.55, 1), fuss=1.0, bauch=0.5, schlag=0.9, phase=0.65, baender=_B, fetzen=False, welle=9),
           _F(4.5, 21.5, 8, 2.8, richtung=(-0.8, 1), phase=0.05, baender=_B, fetzen=False), _F(8.6, 23.5, 8, 2.6, richtung=(-0.1, 1), phase=0.35, baender=_B, fetzen=False)]
# Runde 5: schneller/lebhafter (15 Posen à 1 Frame, Welle 2× je Zyklus ≈ 0,5 s; 4 Zyklen je Schleife) und LÜCKENLOS an den Schweifspitzen („Lücken zwischen Schwanzspitzen und Flammen“):
# Die drei weißen Teile sind die Schweife, die Flammen sitzen wie gemalt ÜBER ihren Spitzen. Je Schweif (a) eigene Feuer-Ebene, die jede Bewegung „ihres“ Schweifs ganzzahlig mitmacht
# (oben: Spitze 1 px seitlich; rechts: Außenhälfte 1 px hoch; Atmen), und (b) ein fester Flammenfuß aus der gemalten Schweif-Ebene (ANSATZ: alle gemalten Flammenpixel über dem Fuchs
# + die nicht umrissfarbenen im Umkreis von 2 px), der ÜBER die Schweifspitze gelegt wird wie im Original — die bewegte Flamme schließt dahinter in jedem Frame an.
FEUER_T = [F3.Feuer(H, W, fl, RAMPE_S, posen=15, halten=1) for fl in (S_OBEN, S_RECHTS, S_LINKS)]


def _ansatz(m_schweif):
    ueber = m_schweif & fox
    nah = cv2.dilate(ueber.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    hell = m_schweif & ~L.farbmaske(schweife, [UMRISS_SCHWEIF])
    return lay0(schweife, ueber | (nah & hell))


ANSATZ = [_ansatz(m) for m in (t_oben, t_rechts, t_links)]


def lay(quelle, maske, dy=0):
    t, _ = L.trenne(quelle, maske)
    return L.platz(t, H, W, OFF[0], OFF[1] + dy)


def frame(i, nur=None):
    b = 1 if Hm.takt(i, N / 3, 4, 10) else 0                         # Atem: je 20-Frame-Periode 10 Frames oben (Frame 0 = unten)
    k = lay(fuchs, fox_rest)
    ol = lay(fuchs, ohr_l_spitze)
    orr = lay(fuchs, ohr_r_aussen)
    # Ohren
    s1 = math.sin(L.sinus(i, N / 2))
    ol = Hm.zeilen_versatz(ol, OFF, {y: (1 if s1 > 0.5 else 0) for y in range(7, 13)})
    s3 = math.sin(L.sinus(i, N / 3) - 1.0)
    orr = R.spalten_staffel(orr, PAD_L + 21, [0, 0, 1, 1, 1, 1, 1, 1, 1], -1 if s3 > 0.5 else 0)
    if b:
        k = TX.streck_zeile(k, PAD_T + 28, 1)
        ol, orr = (L.versetze(e, 0, -1) for e in (ol, orr))
    vers = [(1 if s1 > 0.5 else 0, -b), (0, -b - (1 if s3 > 0.5 else 0)), (0, -b)]            # (dx, dy) je Schweif: oben, rechts, links
    hinten, vorn = [], []
    for fe, an, (dx, dy) in zip(FEUER_T, ANSATZ, vers):
        e = fe.ebene(i, dx=dx, dy=dy)
        hinten.append((e, 'schweif'))
        vorn.append((L.versetze(an, dx, dy) if (dx or dy) else an, 'schweif'))
    fig, etik = R.schichten(H, W, hinten + [(k, 'fuchs'), (ol, 'fuchs'), (orr, 'fuchs')] + vorn)        # Flammen hinter dem Fuchs, Flammenfuß über der Schweifspitze
    fig, _br = R.verbinde(fig)                                       # Teile, die nur über eine Pixelecke hängen (dünne Schweifspitzen), werden 4-verbunden
    R.neue_loecher_fuellen(fig, LOCH0, ERLAUBT, max_groesse=4)
    R.kontur_je_teil(fig, etik, ERLAUBT, {'fuchs': UMRISS_FUCHS, 'schweif': UMRISS_SCHWEIF}, standard=UMRISS_SCHWEIF)
    if nur == 'koerper':
        return fig
    return fig


TEST_EBENEN = 'koerper'

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = R.vorschau_arg()
    R.abschluss('rebelliokai-kind-kitsune', 'Rebelliokai Kind Kitsune', frames, MS, spr, OFF, prev)
