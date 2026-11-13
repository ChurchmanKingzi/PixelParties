# -*- coding: utf-8 -*-
"""Idle-Animation für „Fun-Fun Circus Elephant“ (Creature) — der graue Elefantenkopf mit Elfenbeinstoßzähnen, Totenkopf-Maske, blutenden Ohren und einem Bündel Luftballons, auf einem gestreiften Zirkuspodest.

Quelle: src/fun-fun-circus-elephant.png (48×69 px, 38 Farben).
PICK: [["MotiveMoe", 11, 1], ["MotiveMoe", 12, 1], ["MotiveMoe", 13, 2], ["MotiveMoe", 14, 1], ["MotiveMoe", 15, 1], ["MotiveMoe", 16, 8]]
  = die Ebenen „Fun-Fun Elephant #3 / #2 / #1 / (ohne Nr.) / #5 / #4“ der Datei MotiveMoe an ihrer Stelle in der Ebenenmitte (xcf-Koordinaten (225,93)–(272,161)); Ebene 14 = Kopf mit Ohren und Stoßzähnen,
  Ebene 13 = Blutspuren, Ebene 12 = Maske in der Stirn, Ebene 11 = Mundpartie, Ebene 15 = Rüsselspitze/Kiefer, Ebene 16 (Fun-Fun Elephant #4) = Ballons, Fäden und das gestreifte Podest.
  Die Ebenen 9 und 10 (grau/schwarz, unsichtbar) bleiben weg: auf der Karte (Fun_Fun_Circus_Elephant.png) ist das Podest bunt gestreift. Die Karte schneidet den Sprite oben und unten an (Kartenfenster 76×51), der Sprite ist vollständig.
  Rundherum auf der Ebene liegen nur weitere Einzelballons und Feuerwerk (Kulisse) — nicht Teil der Figur.

Aufruf:   python3 fun_fun_circus_elephant.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/fun-fun-circus-elephant.png + .json

Was im Sprite ist (x, y im 48×69-Sprite):
* BALLONBÜNDEL (y 0–21): zwölf Ballons (Lila, Hellblau, Grün, Rot, Gelb, Hellgrün) mit Glanzfleck und dunklen Fäden (54,54,54) bei x 21, 25, 29, 33, 37 (und 15): Die Fäden laufen zu den Ohren/zum Kopf.
* OHREN (links x 0–14, rechts x 33–47, y 18–33): große graue Ohren mit hellem Rand; Blutspuren (119,0,0)/(88,0,0) an den unteren Kanten.
* KOPF (x 11–36, y 22–59): grauer Elefantenkopf mit tiefen Schatten, schwarze Augenhöhlen/Maske in der Stirn (x 19–27, y 31–40, mit weißem Pixel und blutroten Tränenspuren x 18/19 und 28/29),
  Rüssel in der Mitte, zwei Stoßzähne (Elfenbein (245,203,161)/(239,161,95)/(156,105,62), y 42–51), unten Kiefer mit weißen ZÄHNEN (y 58–59, „jj“ weiß/grau).
* BLUTSTROPFEN (x 5–10 und 38–43, y 34–66): senkrechte gestrichelte Tropfenspuren, unten Blutlachen (y 67–68).
* PODEST (x 15–32, y 60–68): grauer Rand, goldrote Kante (Gold (255,180,0)/(255,210,102)), darunter violett-blau gestreifte Blende (Muster der Periode 4).
Metall/Gold/Edelstein: nur die Goldkante am Podest (zu klein, Regel 14 → kein Glanz); Elfenbein/Stein/Ballons glänzen nicht. Partikel: keine (nur die schon vorhandenen Tropfen laufen). Augenhöhlen/Maske bleiben fest (Regel 21: nicht raten).

Ablauf (72 Frames à 70 ms = 5,04 s, nahtlos; schwere Figur → langsam):
* Atmen (Periode 36, 1 px; Runde 4): Kopf, Ohren, Stoßzähne, RÜSSEL (starr, als Einheit; er hängt in der Mitte herab und biegt unten nach rechts, y 38–57) und das Ballonbündel heben sich starr um 1 px; die FÜSSE mit Zehennägeln (Ebene 15, y 54–59, liegt hinter dem Rüssel; src/…-L15.png) und das Podest bleiben stehen. Keine kopierte Zeile mehr quer durch den Rüsselbogen (vorher wurde Zeile 54 bis zu 2× eingefügt → der untere Bogen wurde dick). Freigelegt und fertiggezeichnet: Zeile 53, x 11–21 (linkes Bein, aus den Beinzeilen 52/53 gemischt) und Zeile 56, x 25–33 (Schatten unter dem Rüsselbogen in der dunklen Fußfarbe).
* Ohren schlagen (links Periode 24, rechts Periode 36 — unabhängig): jede Spalte der äußeren Ohrhälfte (x ≤ 9 bzw. x ≥ 38) wandert um round(±2 · Abstand/10) senkrecht (starres Kippen um die Ohrmitte, Gefälle ≤ 1 px je Spalte; der Kopfansatz bleibt), die Blutspuren am Ohr gehen mit.
* Ballonbündel schwankt (Periode 72): jede Zeile oberhalb von y 18 rückt waagerecht bis ±2 px (oben am meisten, unten bleibt es am Faden), die oberen Fadenstücke gehen mit.
* Blut tropft: in jeder Tropfenspur (x 5–9, 38–43; y 34 bis zum letzten Tropfen) laufen die Tropfen zyklisch abwärts (eine volle Spurlänge je Schleife, je Spur andere Länge → andere Geschwindigkeit), oben erscheinen sie wieder an der Ohrkante; die Lachen bleiben.
* Podest: STATISCH (Runde 3, Nutzer: die Farbe des Podiums soll nicht wie ein Film laufen). Nur einzelne Glühbirnen der Goldkante (Pixel (17,61), (21,61), (26,61), (29,61), (23,60)) blitzen nacheinander je 4 Frames auf
  (dunkelgold → gold → hellgold → gold → zurück; Farben aus dem Sprite), nie mehr als eine zugleich.
Frame 0 = Original (Ruhepose). Ergänzungen: keine (nichts Verdecktes wird freigelegt: Ohren/Ballons laufen vor Hintergrund).
"""
import sys

import numpy as np
from PIL import Image

import anim_humanoide as Hm
import anim_lib as L
import anim_zirkus as Z

N, MS = 72, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 2

spr = L.lade('fun-fun-circus-elephant')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vor = L.deckend(spr)
rgb = spr[..., :3].astype(int)
bunt = (rgb.max(axis=2) - rgb.min(axis=2)) > 40
BLUT = L.farbmaske(spr, [(119, 0, 0), (88, 0, 0)]) & vor
FADEN = L.farbmaske(spr, [(54, 54, 54)]) & vor
ballon = vor & bunt & ~BLUT & (yy <= 21)
buendel = ballon | (FADEN & (yy <= 17))
podest = vor & (yy >= 60) & (xx >= 14) & (xx <= 33) & ~BLUT
_fest = vor & ~BLUT
_nb = np.zeros_like(_fest)
_nb[1:] |= _fest[:-1]; _nb[:-1] |= _fest[1:]; _nb[:, 1:] |= _fest[:, :-1]; _nb[:, :-1] |= _fest[:, 1:]
tropfen = BLUT & (yy >= 34) & (yy <= 66) & ((xx <= 9) | (xx >= 38)) & ~_nb           # frei hängende Tropfen (kein Körperpixel daneben: die Blutpixel am Stoßzahnrand bleiben stehen)
pfuetze = BLUT & (yy >= 67)
rest = vor & ~buendel & ~podest & ~tropfen & ~pfuetze
# Runde 4: FÜSSE (Ebene 15 „Fun-Fun Elephant #5“, liegt HINTER dem Kopf/Rüssel) als eigene, feste Ebene; sie liegt vollständig vor (auch der vom Rüsselbogen verdeckte Teil)
E15 = np.array(Image.open(L.SRC + '/fun-fun-circus-elephant-L15.png').convert('RGBA'))
fuss_sichtbar = L.deckend(E15) & (E15[..., :3] == spr[..., :3]).all(axis=2) & rest & (yy >= 54) & ~((yy <= 57) & (xx >= 21) & (xx <= 25))   # Rüsselende (x 21–25) gehört zum Kopf
rest = rest & ~fuss_sichtbar
_k = L.trenne(spr, rest)[0]
BEIN53, BEIN52 = _k[53].copy(), _k[52].copy()
BEIN53[22:] = 0; BEIN52[22:] = 0
ohr_l = rest & (xx <= 14) & (yy <= 33)
ohr_r = rest & (xx >= 33) & (yy <= 33)
kopf = rest & ~ohr_l & ~ohr_r
ERLAUBT = Hm.umrissfarben(L.trenne(spr, kopf | ohr_l | ohr_r | fuss_sichtbar)[0])          # Umrissfarben von Kopf + Ohren (Regel 16)
UMRISS = (23, 21, 22)
GLANZ_ZU_BASIS = {(223, 116, 116): (212, 67, 67), (196, 229, 150): (158, 212, 80), (188, 164, 229): (144, 104, 212), (147, 208, 235): (75, 177, 223), (255, 210, 102): (255, 180, 0)}

# Tropfenspuren: je Spalte (34 … letzter Tropfen)
SPUREN = {}
for x in range(sw):
    ys = np.nonzero(tropfen[:, x])[0]
    if len(ys):
        SPUREN[x] = (34, int(ys.max()))
LAUF = {x: (yb - 34 + 1) for x, (ya, yb) in SPUREN.items()}          # Spurlänge = Schritte je Schleife

# Podest: einzelne Glühbirnen (dunkelgoldene Pixel der Goldkante y 60/61) blitzen nacheinander kurz auf; Farben aus dem Sprite
LICHTER = [((17, 61), 4), ((21, 61), 17), ((26, 61), 30), ((29, 61), 43), ((23, 60), 56)]
LICHT_FOLGE = [(255, 180, 0), (255, 210, 102), (255, 210, 102), (255, 180, 0)]


def ebene(m, dy=0):
    return L.platz(L.trenne(spr, m)[0], H, W, OFF[0], OFF[1] + dy)


def versetze_ohr(a, links, dy_spitze):
    out = L.leer(*a.shape[:2])
    for X in range(a.shape[1]):
        ys = np.nonzero(a[:, X, 3])[0]
        if not len(ys):
            continue
        x = X - OFF[0]
        f = (10 - x) / 10.0 if links else (x - 37) / 10.0
        dy = Z.rund(dy_spitze * max(0.0, f))
        if ys.min() + dy < 0 or ys.max() + dy >= a.shape[0]:
            raise L.ClipError('Ohr würde aus der Leinwand geschoben')
        out[ys + dy, X] = a[ys, X]
    return out


def frame(i, nur=None):
    import math
    hub = Hm.stufe(i, 36, 1)                      # Runde 4: starres Heben um höchstens 1 px (vorher Zeile 54 bis zu 2× kopiert → Rüsselbogen wurde dick)
    # Podest: STATISCH (Runde 3: die Streifen liefen wie ein Film). Nur einzelne Glühbirnen der Goldkante blitzen kurz auf (1 px, dunkelgold → gold → hellgold → gold → dunkelgold)
    pod = ebene(podest)
    for (lx, ly), start in LICHTER:
        c = Hm.folge(i, start, LICHT_FOLGE, N)
        if c is not None:
            Hm.setze(pod, {(lx, ly): c}, OFF)
    # Blut: Tropfen kreisen in ihrer Spur, die Lachen bleiben
    tr = ebene(tropfen)
    schritt = {x: (i * LAUF[x]) // N for x in SPUREN}
    Z.spalten_ring(tr, OFF, SPUREN, 34, 66, schritt)
    pf = ebene(pfuetze)
    # Kopf: Atmen (Mundzeile 54)
    k = L.versetze(ebene(kopf), 0, -hub)
    fuesse = L.platz(E15, H, W, OFF[0], OFF[1])
    if hub:
        # linkes Bein: die frei werdende Zeile 53 (x 11–21) bekommt die Beinzeile 53, mit Zeile 52 texturgemischt (Regel 43) — nur das Bein wird 1 px länger, der Rüssel bleibt starr
        zeile = L.misch_kopie(BEIN53, [BEIN52], 1)
        fuesse[OFF[1] + 53, OFF[0]:OFF[0] + sw][zeile[:, 3] > 0] = zeile[zeile[:, 3] > 0]
        # rechter Fuß: unter dem gehobenen Rüsselbogen wird Zeile 56 (x 25–33) frei → Schattenzeile in der dunklen Fußfarbe des linken Fußes (Zeile 55 der Ebene 15)
        for x in range(25, 34):
            if not E15[56, x, 3] and not (kopf[57, x]) and E15[57, x, 3]:
                fuesse[OFF[1] + 56, OFF[0] + x] = E15[55, 15]
        fuesse[OFF[1] + 55, OFF[0] + 34] = UMRISS + (255,)          # Fußspitze rechts: Umriss schließt die 1-px-Kerbe unter dem gehobenen Körperrand
    # Ohren: starr kippen, steigen mit dem Kopf
    dl = Z.rund(2.0 * math.sin(L.sinus(i, 24)))
    dr = Z.rund(2.0 * math.sin(L.sinus(i, 36)))
    ol = L.versetze(versetze_ohr(ebene(ohr_l), True, dl), 0, -hub)
    orr = L.versetze(versetze_ohr(ebene(ohr_r), False, dr), 0, -hub)
    # Ballonbündel: Scherung, steigt mit dem Kopf
    b = ebene(buendel)
    amp = 2.0 * math.sin(L.sinus(i, 72))
    b = Z.zeilen_scherung(b, OFF, 18, amp, 0)
    b = L.versetze(b, 0, -hub)
    kopf_ohren = Hm.kontur_schliessen(L.zusammen(H, W, [(fuesse, 0, 0), (k, 0, 0), (ol, 0, 0), (orr, 0, 0)]), ERLAUBT, UMRISS)      # Regel 16: Kontur schließen
    fig = L.zusammen(H, W, [(pod, 0, 0), (pf, 0, 0), (tr, 0, 0), (kopf_ohren, 0, 0), (b, 0, 0)])
    # Regel 16: freigelegte Glanzpunkte der Ballons am Außenrand (durch das Pendeln) bekommen die Grundfarbe ihres Ballons
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c in GLANZ_ZU_BASIS and y - OFF[1] < 24:                                    # nur im Ballonbündel (Podestrand bleibt)
            fig[y, x, :3] = GLANZ_ZU_BASIS[c]
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    import anim_schach as Sc
    Sc.lauf('fun_fun_circus_elephant', 'Fun-Fun Circus Elephant', frames, MS, prev, spr, OFF)
