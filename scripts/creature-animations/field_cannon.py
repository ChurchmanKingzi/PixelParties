# -*- coding: utf-8 -*-
"""Idle-Animation für „Field Cannon“ (Creature).

Quelle: src/field-cannon.png — Ebene „Ebene #48“ (21×48 px, 625 Pixel, alle deckend, 25 Farben) aus MotiveDeri.xcf (Ebene 170; der Treffer-Suchlauf führt sie als zwei „Figuren“, direkt aus dem Dump genommen).
Gegen die Kartenkunst abgeglichen (data/card-art/native/Field_Cannon.png, 96×65; die Ebene liegt bei (24, 27), Korrelation 0,9995): gleiche Form, Position und Größe.
PICK: [["MotiveDeri", 170, 1]]

Aufruf:   python3 field_cannon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/field-cannon.png + .json

Was ist was (x/y im Sprite):
* Rechts die KANONE (x 13–47, y 1–20): ein schwarz-grauer Eisenlauf (26,26,26)/(46,46,46)/(61,61,61)/(92,92,92) mit Rautenmuster oben rechts, dessen Mündung nach rechts zeigt (Lauf liegt leicht schräg, Heck links tiefer),
  davor ein braunes Rad (130,84,44)/(107,69,36)/(168,109,57) mit grauer Nabe (x 27–37, y 10–20).
* Am Heck links (x 14–19, y 3–13) sitzt die LUNTE: eine dünne dunkle Schnur (15,8)–(18,13), die oben brennt: eine kleine gelbe Flamme (255,255,0) mit hellem Kern (255,255,203) bei (14–16, 3–7) (Feuer, Regel 15).
* Links daneben steht ein eigenes Gerät (x 0–10, y 0–19, nicht mit der Kanone verbunden): oben ein runder grauer Kopf (x 1–9, y 1–8) mit „n“-Bogen, darunter ein schwarz-weißer Zickzack-Schaft — ich lese es als Ladestock/Wischer
  (Sponge/Rammer) der Kanone; es ist Zubehör, kein Lebewesen.
Fest bleiben: Rad, Mittelstück des Laufs (x 27–38), Schaftform des Wischers, Lunte (starr).

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Flamme und Funken ausgenommen):
* Mündung nickt (Periode 48, einmal pro Schleife): die Mündung (x ≥ 39) hebt sich bis 2 px und senkt sich; Rad und Lauf-Rumpf (x 18–38) stehen.
  Die Mündungsspalten verschieben sich gestaffelt in 3er-Gruppen (Abstand zum Rad; kein 1-px-Zacken an der Oberkante), der Lauf ist mehr als 2 Zeilen dick, so bleibt er im 4er-Zusammenhang.
* Die Lunte (x ≤ 17, starr) mit der Flamme wippt unabhängig ±1 px (Periode 16, dreimal pro Schleife); sie bleibt an der Heckkante des Laufs (x 18) in Kontakt.
* Brennende Lunte (Regel 15): die Flamme (Gelb (255,255,0) mit hellem Kern (255,255,203); mehr Farben hat der Sprite nicht, Rand/Rot/Orange im Modul gleich Gelb) wird mit anim_feuer.py NEU gezeichnet, Fuß fest auf der Lunte,
  Spitzen reißen als runde Funken ab; die Flamme steigt/sinkt mit der Lunte. Frame 0 weicht in der Flamme vom Original ab (acht Pixel → kleine bewegte Flamme); der Rest ist exakt das Original.
* Der Wischer nickt: der Kopf (y 0–8) schiebt sich als Block 1 px nach links/rechts (Periode 24, zweimal pro Schleife), der Schaft steht.
* Glanz auf dem Eisenlauf (Regel 14: Metall): ein Lichtband läuft diagonal über den Lauf (zweimal pro Schleife, Start Frame 4 und 28, 14 Frames, zwei Stufen heller auf der Rampe der Grautöne des Laufs); Rad und Wischer glänzen nicht.
Keine zusätzlichen Partikel (nur die zur Flamme gehörenden Funken). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Randfarben der Quelle) am Gerät und der Kanone; die Flammenränder sind die Randfarbe Gelb der Quelle.
ERGÄNZUNG: keine gemalten Pixel außer der neu gezeichneten Flamme (Farben der Quelle).
Zuschnitt: der Frame ist auf die Figur (samt Flamme und abgerissenen Funken) zugeschnitten, symmetrisch um die Ruhefigur; die Funken vergrößern ihn höchstens 2 px darüber hinaus, dazu 1 px leerer Rand.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_feuer as FEU

N, MS = 48, 65
GPL, GPR, GPT, GPB = 7, 7, 10, 5

spr = L.lade('field-cannon')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (0, 0, 0)
GELB, HELL = (255, 255, 0), (255, 255, 203)
assert KONTUR in UMRISS

flamme_alt = np.array([[bool(vorhanden[y, x]) and col(x, y) in (GELB, HELL) for x in range(sw)] for y in range(sh)])
assert flamme_alt.sum() == 8
wischer = vorhanden & (xx <= 10)
wischer_kopf = wischer & (yy <= 8)
wischer_schaft = wischer & (yy >= 9)
kanone = vorhanden & (xx >= 11) & ~flamme_alt
heck = kanone & (xx <= 26)
mitte = kanone & (xx >= 27) & (xx <= 38)
front = kanone & (xx >= 39)
assert (wischer | kanone | flamme_alt).sum() == vorhanden.sum() and not (wischer & kanone).any()

# --- Flamme an der Lunte (anim_feuer): nur Gelb und helles Gelb stehen im Sprite ---
RAMPE = {'rand': GELB, 'rot': GELB, 'orange': GELB, 'gelb': GELB, 'hell': HELL}
SPERRE = np.zeros((H, W), bool)
SPERRE[GPT:GPT + sh, GPL:GPL + sw] = kanone & (xx <= 17) & (yy <= 8)       # nur das oberste Lunten-Pixel (15, 8) trägt die Flamme (die schräge Lunte darunter bleibt unberührt: anim_feuer würde sie sonst mit Brückenpixeln 4-verbinden)
ZUNGEN = [FEU.Zunge(15.0 + GPL, 7 + GPT, 5.5, 1.8)]
FEUER = FEU.Feuer(H, W, ZUNGEN, RAMPE, n=N, seed=3, posen=12, amplitude=0.7, sperre=SPERRE)

# --- Glanz auf dem Lauf (Eisen) ---
LAUF = kanone & (xx >= 18) & ~((xx >= 27) & (xx <= 37) & (yy >= 10)) & ~U.kanten(spr)     # ohne Lunte, ohne das Rad und ohne die Umrisspixel am Rand (sonst verliert der Umriss Kontrast)
GRAU = sorted({col(x, y) for y in range(sh) for x in range(sw) if LAUF[y, x] and col(x, y)[0] == col(x, y)[1] == col(x, y)[2]}, key=lambda c: sum(c))
RAMPE_B = {c: GRAU[min(len(GRAU) - 1, k + 2)] for k, c in enumerate(GRAU)}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


KOPF_A, SCHAFT_A, KANONE_A = teil(wischer_kopf), teil(wischer_schaft), teil(kanone)


def front_wippe(a, s):
    """Mündungsspalten (x ≥ 39) heben sich gestaffelt in 3er-Gruppen (kein 1-px-Zacken an der Oberkante): Versatz round(2·s·Gruppe/3), aufwärts positiv."""
    out = L.leer(*a.shape[:2])
    cols = [x for x in range(a.shape[1]) if a[:, x, 3].any()]
    x0 = min(cols)
    for x in cols:
        g = (x - x0) // 3 + 1
        dy = -int(round(2.0 * s * min(g, 3) / 3.0))
        for y in np.nonzero(a[:, x, 3])[0]:
            out[y + dy, x] = a[y, x]
    return out


def frame_gross(i, nur=None):
    s = sinz(i, 48)
    heck_dy = -int(round(1.0 * sinz(i, 16)))                      # Lunte samt Flamme wippt ±1 px (Periode 16, unabhängig von der Mündung)
    ka = KANONE_A.copy()
    # Lichtband über den Lauf (zwei Stufen heller auf der Grau-Rampe), in Quellkoordinaten vor dem Versatz
    for start in (4, 28):
        j = i - start
        if 0 <= j <= 13:
            d = 24 + 3 * j
            for y in range(sh):
                for x in range(sw):
                    if LAUF[y, x] and d <= x + y < d + 4 and col(x, y) in RAMPE_B:
                        ka[GPT + y, GPL + x, :3] = RAMPE_B[col(x, y)]
    he, mi, fa = ka.copy(), ka.copy(), ka.copy()
    he[:, GPL + 18:] = 0                                         # Lunte (x ≤ 17, starr als Ganzes)
    mi[:, :GPL + 18] = 0
    mi[:, GPL + 39:] = 0                                         # Lauf-Rumpf samt Rad (x 18–38) steht
    fa[:, :GPL + 39] = 0                                         # Mündung (x ≥ 39) wippt
    fr = front_wippe(fa, s)
    # Wischer-Kopf nickt
    kx = int(round(sinz(i, 24)))
    kopf = L.versetze(KOPF_A, kx, 0)
    geraet = L.zusammen(H, W, [(SCHAFT_A, 0, 0), (kopf, 0, 0)])
    geraet = U.kontur_schliessen(geraet, UMRISS, KONTUR)
    kan = L.zusammen(H, W, [(he, 0, heck_dy), (mi, 0, 0), (fr, 0, 0)])
    kan = U.kontur_schliessen(kan, UMRISS, KONTUR)
    fl = L.versetze(FEUER.ebene(i), 0, heck_dy)
    funken = FEUER.funken(i, dy=heck_dy, leben=8)
    return L.zusammen(H, W, [(geraet, 0, 0), (kan, 0, 0), (fl, 0, 0), (funken, 0, 0)])


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur (Funken dürfen den Frame höchstens 2 px vergrößern; sie gehören zur Flamme)
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i) for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('field-cannon', 'Field Cannon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/field-cannon-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
