# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Long“ (Creature, Archetyp Guardian Beasts) — der Drachen-Wächter (Zeichen „Long“ = Drache): grüner Schuppenkopf mit goldenem Geweih, goldene Schulterplatten, Klauen und ein Feuerstrahl aus dem Maul.

Quelle: src/guardian-beast-long.png (26×37 px, 38 Farben) — die Figur ohne Flamme. Die Flamme der Kartenkunst (Ebene 104, 23×48 px, vier Farben) wird NICHT kopiert, sondern mit dem Feuermodul anim_feuer.py neu gezeichnet (Regel 15/29).
PICK: [["MotiveGuardianBeasts", 105, "Ganze Ebene"], ["MotiveGuardianBeasts", 104, "Flamme (nur Farben/Form als Vorlage)"]]      (Ebene „Long-Kopie“ = Drache mit Geweih und Klauen, Ebene „Long #1“ = Feuerstrahl; die Ebene „Long“ (106) ist eine
andere Pose desselben Wächters mit geschlossenem Maul und Helm, ohne Geweih; Ebene 102 „Ebene #10“ ist eine Reihe kleiner Flammen, die zu anderen Karten gehört)
Abgleich mit der Kartenkunst Guardian_Beast_Long.png (76×51): die Karte zeigt Ebene 105 (Geweih, Klauen) mit dem Feuerstrahl (Ebene 104) vom Maul bis zum Kartenrand, die Flamme liegt vor dem Körper. Die Suche fand für diese Karte keinen
Treffer in der Datei (die Flamme verdeckt die Figur), daher direkt aus dem Ebenen-Dump. Die Quelle war damit vollständig (Figur) + Flamme als Beiwerk, das zum Wesen gehört (Verbrennen).

Aufruf:   python3 guardian_beast_long.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-long.png + .json

Identifikation (x, y im 26×37-Sprite):
* GEWEIH (x 0–8 und 17–25, y 0–9): große goldolive Geweihzacken (102,98,50)/(175,171,98)/(207,204,125)/(246,245,155) mit schwarzen Lücken (10,8,0); Horn/Knochen → kein Glanz.
* KOPF (x 9–16, y 3–12): graue Kappe (61,73,69)/(123,127,128)/(144,151,153)/(164,167,163), grünes Schuppengesicht (84,122,98)/(96,136,111)/(115,163,133) mit dunklem Rand (15,42,3), rote Augen: weiß (243,243,243) bei (10,7)/(11,8) bzw. (15,7)/(14,8)
  mit dunkelroten Rändern (79,18,18) bei (10,8–9)/(15,8–9) und rosa Pupillen (153,78,74) bei (11,9)/(14,9).
* MAUL/HALS (x 10–15, y 11–18): weißgraue Kiefer mit Zähnen (213,213,213)/(243,243,243)/(123,123,123), schwarzer Rachen (0,0,0) bei (12–13,12–13), darunter goldene Kehle (223,191,108)/(249,220,136)/(148,131,82) bei (12–13,15–17).
* SCHULTERPLATTEN (x 4–8 und 17–21, y 18–22): goldene Pauldrons (103,79,0)/(163,138,46)/(223,196,83)/(249,235,126) mit braunem Rand (49,24,0) → Metall/Gold, glänzt.
* BRUST (y 19–23): violetter Latz (62,45,94)/(90,61,146)/(122,86,194)/(153,121,221); ARME (x 2–7 und 18–23, y 23–28): grüne Schuppenarme (84,122,98)/(115,163,133), die Hände enden in weißen Klauenspitzen (240,239,242) bei (3,25), (2,26), (7,26), (1,27), (4,27), (7,27),
  (1,28), (4,28), (5,29) und gespiegelt rechts.
* BAUCHPLATTE (x 9–16, y 24–31): goldener Panzer (223,191,108)/(190,155,71)/(120,104,59)/(249,220,136) mit braunem Rand (84,62,33) → Gold, glänzt.
* BEINE (y 31–36): grüne Schuppenbeine (84,122,98)/(115,163,133) mit dunklem Rand (15,42,3) und weißen Zehenkrallen (250,253,247) bei (4–7,34–36)/(18–21,34–36).
* FLAMME (Vorlage Ebene 104): von (12–13,13) aus ein Feuerkegel nach unten (Spitze am Maul, wird breiter bis x 1–22), Farben Creme (247,245,184), Gelb (246,231,14), Orange (244,123,34), Rot (202,44,41).
Gold im Sprite: Schulterplatten und Bauchplatte → nur sie glänzen (Regel 12/14); Geweih, Schuppen, Klauen nicht.

Ablauf (48 Frames à 64 ms = 3,07 s, nahtlos):
* Feuerstrahl (anim_feuer, unverändert benutzt): fünf Zungen (Mitte hoch bis zum Maul, je zwei Seitenzungen niedriger) mit je 12 Posen à 2–3 Frames, Farbe Creme-Kern → Gelb → Orange → Rotrand; die feste Maulöffnung/Kiefer/Gesicht ist als `sperre`
  geschützt. Das untere Ende franst aus (Zungenränder, kurze Tropfen) und kleine Funken fallen nach unten (Feuerfunken, Regel 15/25). Der Strahl hebt sich beim Atmen mit dem Kopf.
* Atmen (Periode 24, zwei Atemzüge): die Bauchplattenzeile 30 wird einmal doppelt eingefügt, Kopf, Geweih, Schultern und Arme steigen 1 px, die Beine bleiben.
* Geweih zuckt: die äußeren Zackenspitzen (Zeilen 0–2) der linken (Frames 6–13) und später der rechten Seite (Frames 28–35) knicken 1 px zur Seite und zurück (Nähte 4-verbunden).
* Klauen spielen: die weißen Klauenspitzen der linken Hand (Frames 14–21) und später der rechten Hand (Frames 38–45) rutschen ruckhaft 1 px nach unten und zurück.
* Blinzeln (Frames 19–21 und 41–43): die weißen und roten Augenpixel nehmen die grüne Gesichtsfarbe an.
* Gold glänzt (Regel 12/14): Lichtband über Schulterplatten und Bauchplatte (Frames 6–17 und 30–41), Glitzersterne an den Schulterplatten (Frames 20–23 links, 44–47 rechts).
Frame 0 = Original + Feuerstrahl (Ruhepose der Figur = Original; die Flamme ist neu gezeichnet und deshalb ausgenommen). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16, nur Körper-Ebenen).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle bzw. der Flammenvorlage (Ebene 104).
Ergänzungen: keine für den Körper (nichts Verdecktes wird freigelegt); der Feuerstrahl ist neu gezeichnet.
"""
import random
import sys

import numpy as np
from PIL import Image

import anim_feuer as FEU
import anim_gb as G
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 64
PAD = (3, 3, 3, 11)
sz = G.Szene('guardian-beast-long', PAD)
spr, OFF, H, W, f = sz.spr, sz.off, sz.H, sz.W, sz.f
PL, PT = sz.PL, sz.PT

ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)      # Farben der Flammenvorlage (Ebene 104)
ERLAUBT_FEUER = [ROT, ORANGE, GELB, CREME]
RAMPE = {'rand': ROT, 'rot': ORANGE, 'orange': GELB, 'gelb': GELB, 'hell': CREME}      # rote Außenhaut, orange Rand, gelber Körper, cremefarbener Kern (am Maul hell, nicht rot)

GRUEN = f(12, 6)                                                 # (84,122,98) Gesichtsgrün
UMRISS = f(7, 2)                                                 # (15,42,3)
GOLD = [(103, 79, 0), (120, 104, 59), (148, 131, 82), (163, 138, 46), (190, 155, 71), (223, 196, 83), (223, 191, 108), (249, 220, 136), (249, 235, 126)]
AUGEN = [(10, 7), (11, 8), (10, 8), (10, 9), (11, 9), (15, 7), (14, 8), (15, 8), (15, 9), (14, 9)]

geweih_l = sz.maske(0, 0, 8, 7) | sz.maske(0, 8, 6, 9)
geweih_r = sz.maske(17, 0, 25, 7) | sz.maske(19, 8, 25, 9)
klauen_farbe = f(3, 25)                                          # (240,239,242)
klauen_l = sz.vorhanden & L.farbmaske(spr, [klauen_farbe]) & (sz.xx <= 8) & (sz.yy >= 25)
klauen_r = sz.vorhanden & L.farbmaske(spr, [klauen_farbe]) & (sz.xx >= 17) & (sz.yy >= 25)
koerper = sz.vorhanden & ~geweih_l & ~geweih_r & ~klauen_l & ~klauen_r
m_gold = sz.vorhanden & L.farbmaske(spr, GOLD) & (sz.yy >= 18) & (sz.yy <= 30)

# --- Feuerstrahl ---
SPERRE = np.zeros((H, W), bool)
sp = sz.vorhanden & ((sz.yy <= 13) | ((sz.yy <= 18) & ((sz.xx <= 11) | (sz.xx >= 14))) | ((sz.yy >= 14) & (sz.yy <= 29) & ((sz.xx <= 7) | (sz.xx >= 18) | ((sz.yy <= 24) & ((sz.xx == 8) | (sz.xx == 17))))))
SPERRE[PT:PT + sz.sh, PL:PL + sz.sw] = sp
BASIS = PT + 38
ZUNGEN = [FEU.Zunge(12.5 + PL, BASIS, 24.5, 3.0),
          FEU.Zunge(9.9 + PL, BASIS, 20.0, 2.5), FEU.Zunge(15.1 + PL, BASIS, 20.0, 2.5),
          FEU.Zunge(7.2 + PL, BASIS, 15.0, 2.2), FEU.Zunge(17.8 + PL, BASIS, 15.0, 2.2),
          FEU.Zunge(4.8 + PL, BASIS, 9.5, 1.9), FEU.Zunge(20.2 + PL, BASIS, 9.5, 1.9),
          FEU.Zunge(12.5 + PL, BASIS - 15, 10.0, 1.8)]          # kurze helle Zunge: Kern des Strahls direkt am Maul
FEUER = FEU.Feuer(H, W, ZUNGEN, RAMPE, n=N, seed=5, posen=12, amplitude=0.55, sperre=SPERRE)


def ausfransen(fl, i):
    """Unteres Ende des Strahls: die Basiszeile franst aus (Lücken je Pose, wechselt alle 2–3 Frames) und kurze Tropfen hängen darunter."""
    rnd = random.Random(100 + i // 2)
    ys = np.nonzero(fl[:, :, 3].any(axis=1))[0]
    if not len(ys):
        return fl
    yb = int(ys.max())
    for dy in (0, 1):
        y = yb - dy
        for x in np.nonzero(fl[y, :, 3])[0]:
            if rnd.random() < (0.45 if dy == 0 else 0.2):
                fl[y, x] = 0
    return fl


def luecken(fl, fig, sperre, basis):
    """Lücken im Strahl schließen (alles in Leinwandkoordinaten NACH dem Atemhub):
    * schmale Lücken (≤ 2 px) zwischen Flammenpixeln derselben Zeile (Farbe des linken Nachbarn, Rot → Gelb), nicht auf geschützten Pixeln,
    * Körperpixel mitten im Strahl (zwischen dem äußersten linken und rechten Flammenpixel der Zeile) und die Rumpfmitte unten (x 8–17),
    * einzelne Lücken, die von ≥ 3 Flammenpixeln umgeben sind.
    Zwischen den Zungen soll kein Körperpixel hindurchscheinen (die Flamme liegt vor dem Körper)."""
    gelb = np.array([*GELB, 255], np.uint8)
    for y in range(fl.shape[0]):
        xs = np.nonzero(fl[y, :, 3])[0]
        for a, b in zip(xs[:-1], xs[1:]):
            if 1 < b - a <= 3:
                for x in range(a + 1, b):
                    if not sperre[y, x]:
                        fl[y, x] = fl[y, a] if tuple(fl[y, a, :3]) != ROT else gelb
    for y in range(PT + 12, basis + 1):
        xs = np.nonzero(fl[y, :, 3])[0]
        if len(xs) >= 2:
            for x in range(int(xs.min()) + 1, int(xs.max())):
                if not fl[y, x, 3] and fig[y, x, 3] and not sperre[y, x]:
                    fl[y, x] = gelb
    for y in range(PT + 24, basis + 1):
        for x in range(PL + 8, PL + 18):
            if not fl[y, x, 3] and fig[y, x, 3] and not sperre[y, x]:
                fl[y, x] = gelb
    for _ in range(2):
        m = fl[..., 3] > 0
        p = np.pad(m, 1)
        n = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        for y, x in zip(*np.nonzero(~m & (n >= 3) & ~sperre)):
            if y < basis + 1:
                fl[y, x] = gelb
    return fl


EMBER = [(8.0, 3, -1), (12.0, 15, 1), (15.5, 26, -1), (18.5, 37, 1), (10.5, 42, 1)]       # (x im Sprite, Startframe, Drift)
EMBER_LEBEN = 12


def embers(i, dy):
    """Funken fallen vom unteren Strahlende (Feuerfunken, Regel 15): 1 px, Farbe cremefarben → gelb → orange → rot, 6 px Weg in 12 Frames."""
    e = L.leer(H, W)
    for (x0, start, dr) in EMBER:
        a = (i - start) % N
        if a >= EMBER_LEBEN:
            continue
        x = int(round(x0 + PL + dr * a / 6.0))
        y = BASIS + dy + 1 + int(round(0.5 * a))
        c = [CREME, GELB, ORANGE, ROT][min(3, a * 4 // EMBER_LEBEN)]
        e[y, x, :3] = c
        e[y, x, 3] = 255
    return e


def frame(i, nur=None):
    k = sz.ebene(koerper)
    ge_l, ge_r = sz.ebene(geweih_l), sz.ebene(geweih_r)
    kl_l, kl_r = sz.ebene(klauen_l), sz.ebene(klauen_r)
    # --- Blinzeln ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        sz.setze(k, {p: GRUEN for p in AUGEN})
    # --- Gold glänzt ---
    Hm.lichtband(k, m_gold, OFF, i, N, 6, 12, GOLD, stufen=1, breite=2.6, achse=(1.0, 1.0), kern=2)
    Hm.lichtband(k, m_gold, OFF, i, N, 30, 12, GOLD, stufen=1, breite=2.6, achse=(-1.0, 1.0), kern=2)
    for (x, y), start in (((6, 20), 20), ((19, 20), 44)):
        s = Hm.folge(i, start, [0, 1, 1, 0], N)
        if s is not None:
            Hm.stern4(k, x, y, s, klauen_farbe, klauen_farbe, off=OFF)
    # --- Geweih zuckt: äußere Zacken (Zeilen 0–2) knicken zur Seite ---
    for ge, start, sgn, (x0, x1) in ((ge_l, 6, 1, (-3, 4)), (ge_r, 28, -1, (21, 25))):
        d = Hm.folge(i, start, [1, 1, 1, 0, 1, 1, 0, 0], N)
        if d:
            sz.bereich(ge, {0: sgn, 1: sgn}, x0, x1)
    # --- Klauen rutschen ---
    dl = 1 if Hm.folge(i, 14, [1, 1, 0, 1, 1, 0, 0, 0], N) else 0
    dr = 1 if Hm.folge(i, 38, [1, 1, 0, 1, 1, 0, 0, 0], N) else 0
    kl_l, kl_r = L.versetze(kl_l, 0, dl), L.versetze(kl_r, 0, dr)
    # --- Atmen ---
    brust = Hm.stufe(i, N / 2, 1)
    k, ge_l, ge_r, kl_l, kl_r = sz.atmen([k, ge_l, ge_r, kl_l, kl_r], 30, brust)
    fig = L.zusammen(H, W, [(kl_l, 0, 0), (kl_r, 0, 0), (ge_l, 0, 0), (ge_r, 0, 0), (k, 0, 0)])
    fig = sz.kontur(fig, UMRISS)
    if nur == 'koerper':
        return fig
    fl = L.versetze(FEUER.ebene(i), 0, -brust)                   # der Strahl hebt sich mit dem Maul
    sp_i = L.versetze(np.dstack([SPERRE] * 4).astype(np.uint8), 0, -brust)[..., 0] > 0
    fl = luecken(fl, fig, sp_i, BASIS - brust)
    fl = ausfransen(fl, i)
    return L.zusammen(H, W, [(fig, 0, 0), (fl, 0, 0), (embers(i, -brust), 0, 0)])


TEST_EBENEN = 'koerper'

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    G.abschluss(sz, frames, 'guardian-beast-long', 'Guardian Beast Long', MS, prev, erlaubt=ERLAUBT_FEUER, ruhe0=frame(0, nur='koerper'))
