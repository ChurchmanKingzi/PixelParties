# -*- coding: utf-8 -*-
"""Idle-Animation für „The Nornstellar, Foretellers of Coolness“ (Creature) — drei kapuzentragende Nornen mit Sonnenbrillen, die einen goldenen Schicksalsfaden zwischen sich halten.

Quelle: src/the-nornstellar-foretellers-of-coolness.png (56×33 px, 19 Farben) = die drei Nornen + der Faden; dazu die drei Einzelebenen als src/…-links.png, …-mitte.png, …-rechts.png (gleiche Leinwand,
jede Norn vollständig, ohne den Faden davor — damit die Verdeckung unter dem Faden beim Bewegen frei wird).
PICK: [["MotiveCoolhalla", 167, 1], ["MotiveCoolhalla", 171, 1], ["MotiveCoolhalla", 171, 2]]  + Faden = xcf-Ebene 170 („Ebene #50“, 44×10 px) an Kartenposition (lx+12, ly+27)
      (Ebene 167 „#52“ = linke Norn samt weißem Zickzack, 171 „#44“ Figur 1 = mittlere, Figur 2 = rechte Norn; Ebene 166 „#56“ ist die linke Norn ohne den weißen Zickzack, 169/168 „#59/#58“ sind Faden-Varianten,
      165 „#93“ eine Kristallkugel, 162/164 Glitzersterne der Kulisse — ungenutzt.) Die Nornen stehen in der Kartenkunst so zueinander wie im Sprite (Abgleich Treffer „at“ aus merged.json); Haus, Eis und Kulisse
      der Kunst gehören nicht dazu. Die Quelle war vollständig.

Aufruf:   python3 the_nornstellar_foretellers_of_coolness.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/the-nornstellar-foretellers-of-coolness.png + .json

Was im Sprite ist (x, y im 56×33-Sprite):
* LINKE NORN (x 3–17, y 7–31): graue Kapuze/Robe (82,82,82)/(50,50,50)/(25,25,25), Gesicht im Profil nach rechts (Haut (213,164,98)/(246,189,123)), schwarze Sonnenbrille, die Hand hält den Faden bei (16,16);
  rechts davon ein WEISSER ZICKZACK (255,255,255) mit schwarzen Pixeln bei (16–22, 18–22): gehört zur Ebene der linken Norn (Schere/Nadel? — nicht sicher gedeutet: bleibt fest und wandert mit der Norn).
* MITTLERE NORN (x 18–34, y 0–24): frontal, spitze Kapuze, Sonnenbrille (y 8), Gesicht, Robe mit Mittelnaht, zwei Füße (y 24).
* RECHTE NORN (x 42–55, y 8–32): wie die linke, nach links schauend, hält die Fadenschlinge bei (42–43, 20–25).
* FADEN (Gold (255,173,0), 1 px): Zipfel unten links (0–5, 23–25), dahinter verdeckt hinter der linken Norn, dann waagerecht (x 17–35, y 16) vor dem Bauch der mittleren Norn, in einer Treppe nach rechts unten (x 35–41, y 16–23)
  zur Schlinge der rechten Norn. Der Faden ist ein dünnes Seil, kein Metall: Glanzlauf nur als hellgelbes Pixelpaar (255,246,172), kein Stern.
Kein Metall/Edelstein, kein Feuer. Köpfe/Gesichter bewegen sich nicht seitlich (Regel 17).

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos):
* ATMEN je Norn unabhängig (Fenster verschoben, damit sie nie im Gleichschritt sind): linke Frames 14–37, mittlere 6–17 und 30–41, rechte 22–45 — je eine glatte Robenzeile (links 26, Mitte 20, rechts 27) wird einmal eingefügt
  (Texturmischung): Kopf, Kapuze, Arme und Hand steigen 1 px, Füße/Saum bleiben. Der Faden hängt an den Händen: sein linkes bzw. rechtes Ende (samt Treppe und Schlinge) hebt sich mit der jeweiligen Norn.
* FADENWELLE: eine Welle läuft zweimal je Schleife über den Faden (x 19–33): wo sie ist, liegt er 1 px höher (nahtlos, 4-verbunden — Stufen bekommen senkrechte Verbinder).
* GLANZLAUF: ein hellgelbes Pixelpaar (255,246,172) wandert zweimal je Schleife (Frames 2–15 und 26–39) am Faden entlang.
* SAUM: die untersten zwei Zeilen der linken und rechten Robe schwingen ±1 px (Perioden 48 bzw. 24, links/rechts gegenläufig).
Frame 0 = Original. Die weißen Zickzack-Pixel bleiben fest. Randpixel-Test mit nur den Körper-Ebenen (der Glanzlauf auf dem 1-px-Faden zählt als Effektebene).
Ergänzungen: keine nötig — die Pixel unter dem Faden (mittlere Norn Zeile 16, rechte Norn bei (42–43, 21–24)) liegen in den Einzelebenen (src/…-mitte.png, …-rechts.png) vollständig vor.
"""
import sys

import numpy as np

import anim_cool as C
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)

N, MS = 48, 75
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 3, 3

SLUG = 'the-nornstellar-foretellers-of-coolness'
spr = L.lade(SLUG)
LAGEN = {n: L.lade(SLUG + '-' + n) for n in ('links', 'mitte', 'rechts')}
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
GOLD, HELL = (255, 173, 0), (255, 246, 172)
DESC = [(35, 17), (36, 17), (36, 18), (37, 18), (37, 19), (38, 19), (38, 20), (39, 20), (40, 21), (41, 21), (41, 22), (41, 23)]
SCHLINGE = [(42, 20), (42, 21), (43, 21), (43, 22), (43, 23), (43, 24), (42, 24), (42, 25)]
ZIPFEL = [(0, 25), (1, 25), (2, 25), (2, 24), (3, 24), (4, 24), (4, 23), (5, 23)]
TEST_EBENEN = 'koerper'


def faden(i, dyl, dyr, mit_glanz=True):
    a = L.leer(H, W)
    ys = {}
    for x in range(17, 36):
        t = (x - 17) / 18.0
        basis = 16 + int(np.floor((1 - t) * dyl + t * dyr + 0.5))
        bump = int(round(Hm.laubwelle(x, i, N, 12.0, 2))) if 19 <= x <= 33 else 0
        ys[x] = basis - bump
    pix = [(x, ys[x]) for x in range(17, 36)]
    for x in range(17, 35):                                           # senkrechte Verbinder an Stufen
        for y in range(min(ys[x], ys[x + 1]), max(ys[x], ys[x + 1]) + 1):
            pix.append((x + 1, y))
    rest = [(x, y + dyr) for (x, y) in DESC + SCHLINGE]
    pix += rest + ZIPFEL
    for (x, y) in pix:
        Hm.setze(a, {(x, y): GOLD}, OFF)
    if mit_glanz:
        weg = [(x, ys[x]) for x in range(17, 36)] + [(x, y + dyr) for (x, y) in DESC]
        for start in (2, 26):
            k = (i - start) % N
            if k < 14:
                p = int(k * len(weg) / 14.0)
                for q in (p, p + 1):
                    if q < len(weg):
                        Hm.setze(a, {weg[q]: HELL}, OFF)
    return a


def norn(name, zeile, n_atem, saum_zeilen, saum_dx):
    a = L.platz(LAGEN[name], H, W, PAD_L, PAD_T)
    if saum_dx:
        Hm.zeilen_versatz(a, OFF, {y: saum_dx for y in saum_zeilen})
    return TX.streck_zeile(a, PAD_T + zeile, n_atem) if n_atem else a


def frame(i, nur=None):
    nl = 1 if Hm.folge(i, 14, [1] * 24, N) else 0
    nm = 1 if (Hm.folge(i, 6, [1] * 12, N) or Hm.folge(i, 30, [1] * 12, N)) else 0
    nr = 1 if Hm.folge(i, 22, [1] * 24, N) else 0
    sl = int(round(np.sin(L.sinus(i, N))))
    sr = -int(round(np.sin(L.sinus(i, N / 2))))
    links = norn('links', 26, nl, (30, 31), sl)
    mitte = norn('mitte', 20, nm, (), 0)
    rechts = norn('rechts', 27, nr, (31, 32), sr)
    fad = faden(i, -nl, -nr, mit_glanz=(nur != 'koerper'))
    return L.zusammen(H, W, [(mitte, 0, 0), (rechts, 0, 0), (fad, 0, 0), (links, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss(SLUG, 'The Nornstellar, Foretellers of Coolness', frames, MS, spr, OFF, C.vorschau_arg())
