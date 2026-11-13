# -*- coding: utf-8 -*-
"""Idle-Animation für „Great Immortal Hydra“ (Creature) — dreiköpfige Hydra mit großen Ringhörnern: die Köpfe wiegen sich langsam und unabhängig voneinander.

PICK: [["MotiveSteamDwarfs", 359, "Ebene „Hydra“: linker und rechter Kopf samt Hälsen (97×59 px, deckend)"], ["MotiveSteamDwarfs", 351, "Ebene #296: mittlerer Kopf samt Hals (44×65 px, deckend), liegt davor"]]
Die Ebenen 360 und 352 sind dieselben Zeichnungen mit nach unten auslaufendem Alpha (Nebel der Karte) – verwendet werden die deckenden Fassungen 359/351 (Brief: Halbtransparentes deckend).
Quelle: src/great-immortal-hydra.png (99×70 px, 17 Farben) = alle drei Teile; die Teile einzeln (gleiche Leinwand): src/great-immortal-hydra_links.png, _mitte.png, _rechts.png
(Ebene 359 bei x 41/42 in linken und rechten Hals getrennt). So liegt unter dem mittleren Kopf die volle Zeichnung der beiden anderen Hälse – beim Wiegen wird nichts Leeres frei.
Ergänzt (am Karten-/Ebenenrand abgeschnitten, Hornfarbe (255,255,221)): die oberen Spitzen der beiden Hörner des linken Kopfs – (4,1) (5,0) (6,0) und (28,1) (27,0) (26,0) –
und der rechte Bogen des Ringhorns am rechten Kopf – (97,19) (97,20) (98,21…26) (97,27) (97,28) (96,29).

Aufruf:   python3 great_immortal_hydra.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/great-immortal-hydra.png + .json

Identifikation (x, y im Sprite):
* Linker Kopf (x 8–24, y 20–43), frontal: zwei rote Augen mit rosa Lichtpunkt (10–13, 28–30) und (18–21, 28–30), zwei weiße Fangzähne am Kinn (13 und 19, y 42–43); sein Hals steigt hinter dem Kopf
  auf und fällt rechts ab (x 22–40). Zwei dünne, weit geschwungene Hörner (gelb → creme): links (x 0–12, y 0–25), rechts (x 20–32, y 0–26).
* Mittlerer Kopf (x 39–58, y 24–48), frontal: rote Augen (42–45, 30–32) (50–53, 30–32), aufgerissenes Maul mit dunkelrotem Rachen (C), weißen Eckzähnen und Zahnreihen (Q; y 40–46), Kinn (45–51, 47);
  Hals links daneben (x 29–41), dunkle Schultern bis y 69. Hörner: links (x 32–41, y 6–29), rechts (x 55–62, y 5–27).
* Rechter Kopf (x 66–82, y 18–39), im Profil nach links unten: ein rotes Auge (75–77, 26–30); die weißen Pixel vor dem Maul (x 71–76, y 32–39) sind nicht sicher zu deuten (Zunge/Geifer/Zähne) und
  bleiben starr am Kopf. Hals als Bogen links daneben (x 43–76). Ringhorn (x 73–98, y 15–33).
* Die Unterkanten der Hälse sind in der Quelle ausgefranst (sie tauchen aus dem Nebel auf) und bleiben so.
Bleibt fest: Hörner (starr am jeweiligen Kopf), Zähne, die weißen Pixel am rechten Kopf.

Idle-Idee: die drei Köpfe wiegen sich wie Schlangen langsam hin und her und heben/senken sich, jeder in seinem Takt; der mittlere schnappt, die Augen glimmen.
Ablauf (72 Frames à 80 ms = 5,76 s), je Kopf unabhängig:
* Wiegen (1× je Schleife, um je ein Drittel versetzt): Kopf samt Hörnern und oberem Hals wandert STARR ±2 px seitlich; der Halsfuß bleibt stehen, dazwischen biegt sich der Hals zeilenweise
  (Gefälle ≤ 1 px je Zeile, nichts wird gestreckt).
* Heben (2× je Schleife, versetzt): eine Zeile im dunklen Halsfuß wird texturiert eingefügt (anim_textur) – Kopf und Hals heben sich 1 px.
* Mittlerer Kopf schnappt (Frames 20–31 und 56–61): aus dem Rachen entfallen 1–2 Zeilen, untere Zahnreihe und Kinn rücken unverändert hoch (Pose); unter dem Kinn wird der dort
  ohnehin gezeichnete Hals des rechten Kopfs sichtbar (keine Lücke).
* Augen glimmen (je Kopf 2× je Schleife, 4 Frames): die Augenpixel werden eine Stufe dunkler (rosa → rot → dunkelrot) – nur innerhalb der Augenpixel.
Offene Kanten an den Biegestufen schließt anim_tiere.umriss_schliessen (Umrissfarbe (0,20,0)); die ausgefransten Unterkanten sind davon ausgenommen. Nur ganze Pixel, nur Farben der Quelle.
"""
import os
import sys

import numpy as np
from PIL import Image

import anim_lib as L
import anim_n10 as Z
import anim_textur as TX
import anim_tiere as T

N, MS = 72, 80
PAD = 4

spr = L.lade('great-immortal-hydra')
TEILE = {n: np.array(Image.open(os.path.join(L.SRC, 'great-immortal-hydra_%s.png' % n)).convert('RGBA')) for n in ('links', 'mitte', 'rechts')}
sh, sw = spr.shape[:2]
H, W = sh + 2 * PAD, sw + 2 * PAD
yy, xx = np.mgrid[0:sh, 0:sw]

B_, C_, D_, E_, G_, K_, I_, M_ = (0, 20, 0), (62, 0, 0), (0, 35, 0), (0, 38, 0), (0, 64, 0), (20, 78, 20), (142, 0, 0), (164, 91, 91)
FUELL = [D_, E_, G_, K_, (0, 58, 0), (20, 55, 20), (0, 89, 0), (20, 102, 20)]
ALLE = sorted({tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]})
UMRISS = [c for c in ALLE if c not in FUELL]
REGEL = {c: B_ for c in FUELL}
FLIP = {D_: E_, E_: D_, G_: K_, K_: G_}

# je Teil: starr bis Zeile y_starr, fest ab Zeile y_fest, Hebe-Zeile, Umriss-Korrektur nur bis Zeile y_rand, Phasen
PARAM = {
    'links': dict(y_starr=44, y_fest=52, heben=53, y_rand=55, phase=0.0, heb_start=2),
    'rechts': dict(y_starr=42, y_fest=52, heben=53, y_rand=55, phase=2 * np.pi / 3, heb_start=20),
    'mitte': dict(y_starr=50, y_fest=60, heben=62, y_rand=65, phase=4 * np.pi / 3, heb_start=12),
}
AUGEN = {'links': (9, 26, 22, 31), 'mitte': (41, 29, 54, 33), 'rechts': (74, 25, 78, 31)}       # Kästen (x0, y0, x1, y1) um die Augen
GLIMM = {'links': (12, 48), 'mitte': (36, 66), 'rechts': (4, 30)}
maul_m = (TEILE['mitte'][..., 3] > 0) & (xx >= 44) & (xx <= 52) & (((yy >= 44) & (yy <= 46)) | ((yy == 47) & (xx >= 45) & (xx <= 51)))
SCHNAPP = [1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0]
SCHNAPP2 = [1, 2, 2, 2, 1, 1]


def auf(a):
    return L.platz(a, H, W, PAD, PAD)


def maul(teil, k):
    """Mittlerer Kopf: k Rachenzeilen (bis Zeile 45) entfallen, Zahnreihe (46) und Kinn (47) rücken hoch. Unter dem Kinn wird der Hals des rechten Kopfs sichtbar (liegt als volle Zeichnung darunter)."""
    if not k:
        return teil
    m, rest = L.trenne(teil, maul_m)
    m = L.heben_unten(m, 45, k)
    out = rest.copy()
    op = m[..., 3] > 0
    out[op] = m[op]
    if k == 2:
        out[45, 44] = B_ + (255,)
        out[45, 52] = B_ + (255,)
    return out


def augen_dunkler(teil, kasten):
    x0, y0, x1, y1 = kasten
    out = teil.copy()
    sub = out[y0:y1 + 1, x0:x1 + 1]
    mi = L.farbmaske(sub, [I_])
    mm = L.farbmaske(sub, [M_])
    sub[mi, :3] = C_
    sub[mm, :3] = I_
    return out


def kopf(name, i, nur_umriss=True):
    p = PARAM[name]
    a = TEILE[name]
    if name == 'mitte':
        a = maul(a, Z.hub(i, [20], SCHNAPP) or Z.hub(i, [56], SCHNAPP2))
    if any(0 <= i - s < 4 for s in GLIMM[name]):
        a = augen_dunkler(a, AUGEN[name])
    a = auf(a)
    heb = 1 if ((i - p['heb_start']) % 36) < 16 else 0
    a = TX.streck_zeile(a, PAD + p['heben'], heb)
    dx = 2.0 * np.sin(2 * np.pi * i / N + p['phase']) - 2.0 * np.sin(p['phase'])
    dx = max(-2.0, min(2.0, dx))
    roh = {}
    for y in range(0, H):
        ys = y - PAD + heb                                        # Zeile im Sprite (nach dem Heben)
        f = 1.0 if ys <= p['y_starr'] else (0.0 if ys >= p['y_fest'] else (p['y_fest'] - ys) / float(p['y_fest'] - p['y_starr']))
        roh[y] = int(round(dx * f))
    a = Z.zeilen_dx(a, Z.gefaelle(roh, H - 1))
    zu = T.umriss_schliessen(a, UMRISS, REGEL)
    grenze = PAD + p['y_rand']
    a[:grenze] = zu[:grenze]
    return a


def frame(i, nur=None):
    wahl = nur or ('links', 'rechts', 'mitte')
    return L.zusammen(H, W, [(kopf(n, i), 0, 0) for n in wahl])


TEST_EBENEN = None


if __name__ == '__main__':
    frames = Z.zuschneiden([frame(i) for i in range(N)])
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', min(n), max(n), '| Original', int(L.deckend(spr).sum()))
    f0 = frame(0)[PAD:PAD + sh, PAD:PAD + sw]
    print('Frame 0 = Original:', bool((f0 == spr).all()))
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('great-immortal-hydra', 'Great Immortal Hydra', frames, MS, prev)
    if prev:
        L.streifen(prev + '/great-immortal-hydra-strip.png', frames, spalten=12, scale=3)
