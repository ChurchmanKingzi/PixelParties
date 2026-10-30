# -*- coding: utf-8 -*-
"""Idle-Animation für „Future Tech Drone“ (Creature) — Regeln 14/15/16 (Metall glänzt, Feuer flackert, sonst nichts).

PICK: [["MotiveGN", 500, 1]]
Quelle: src/future-tech-drone.png — Schwebedrohne von oben (17×13 px, 15 Farben) aus MotiveGN.xcf, Ebene 500 („Ebene #31“), Figur 1; vollständig deckend (Alpha nur 255), nichts ging bei der Extraktion verloren.

Aufruf:   python3 future_tech_drone.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/future-tech-drone.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y; Drohne mit zwei Schubdüsen, schwebend):
* Gehäuse (x 5–11, y 0–12): schwarzer Rahmen (0,0,0), oben ein graues Querband (56,57,55) (y 0–1, x 1–15), in der Mitte eine graue Linse ((90,90,90)/(113,113,113)/(146,146,146)/(43,43,43)) mit rotem
  Leuchtauge ((40,0,0)/(65,0,0)/(145,0,0)/(255,0,0)/(255,68,68), x 7–9, y 4–9); unten zwei kurze Standbeine (5,11–12) und (11,11–12).
* Zwei Schubflammen (links x 1–6, rechts x 10–15, y 2–8) in den Farben der Flammenfolge: rote Außenhaut (202,44,41), orange (244,123,34), gelber Kern (246,231,14), cremeweißer Kern (247,245,184) —
  die Flamme ist oben (am Gehäuse) am breitesten und heißesten und läuft nach unten spitz zu: Düsenstrahl NACH UNTEN.

Ablauf (48 Frames à 60 ms = 2,88 s):
* Feuer (Regel 15) mit dem Modul anim_feuer.py (unverändert benutzt): beide Düsenflammen werden neu gezeichnet — verschachtelte Zungen aus fünf Farbschichten (Außenhaut/rot, orange, gelb, cremeweißer Kern),
  jede Schicht mit eigener Höhe, Breite und seitlicher Verschiebung je Pose; die Zungen biegen sich, wachsen und schrumpfen, je Zunge eine eigene Posenfolge (12 Posen à 2–3 Frames, nahtlos).
  Weil die Flamme nach unten brennt, läuft das Modul auf einer senkrecht gespiegelten Leinwand (Fuß oben am Gehäuse) und das Ergebnis wird zurückgespiegelt; abgerissene Spitzen fallen als Funken (1 px, Feuerfunken)
  nach unten und kühlen ab (cremeweiß → gelb → orange → rot). Das Gehäuse und die Flammenfüße (Zeile 2) stehen fest. Frame 0 weicht in der Flamme vom Original ab (neu gezeichnet), das Gehäuse ist exakt das Original.
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12) mit Flamme und Funken; die Standbeine bleiben am Gehäuse.
* Glanz nur auf dem Metall (Regel 14): ein dezentes Lichtband (eine Stufe heller) läuft alle 24 Frames über die grauen Gehäuseflächen (Querband und Linsenrahmen). Rand, Flammen und Auge glänzen nicht.
* Das rote Leuchtauge pulsiert im Takt der Bob-Periode (eine Stufe heller/dunkler auf der Rot-Rampe, Warnlampe), Rand bleibt unverändert. Keine Flügel im Sprite (die Flammen sind die Antriebe), keine weiteren Partikel.

Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px Rand, zentriert); die Funken gehören zum Feuer und sind in der Vereinigung enthalten.
Randpixel-Test (Regel 16): Gehäuse in Frame i bleibt unverändert; Flammenränder sind die Umrissfarbe `rand` des Feuermoduls (202,44,41); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_feuer as FEU

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 6, 14                     # Arbeitsleinwand (am Ende zugeschnitten); unten Platz für Düsenflammen und Funken

spr = L.lade('future-tech-drone')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

FLAMME_FARBEN = [(202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)]
flamme_alt = vorhanden & L.farbmaske(spr, FLAMME_FARBEN)
koerper = vorhanden & ~flamme_alt
assert int(flamme_alt.sum()) == 70

ROT_RAMPE = [(40, 0, 0), (65, 0, 0), (145, 0, 0), (255, 0, 0), (255, 68, 68)]               # Leuchtauge, dunkel → hell
METALL = [(43, 43, 43), (56, 57, 55), (90, 90, 90), (113, 113, 113), (146, 146, 146)]
auge = L.farbmaske(spr, ROT_RAMPE) & koerper & ~F.kanten(spr)
metall_maske = L.farbmaske(spr, METALL) & koerper & ~F.kanten(spr)
UMRISS = F.umriss_farben(spr)

# ── Feuer (anim_feuer), senkrecht gespiegelt gerechnet ───────────────────────────────────────────────────────────────────────
RAMPE = {'rand': (202, 44, 41), 'rot': (202, 44, 41), 'orange': (244, 123, 34), 'gelb': (246, 231, 14), 'hell': (247, 245, 184)}
FUSS = 2                                                     # Fußzeile der Flammen im Sprite (direkt unter dem grauen Querband)
fest = np.zeros((H, W), bool)
fest[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] = koerper
FEUER = FEU.Feuer(H, W, [FEU.Zunge(PAD_L + 3.5, (H - 1) - (PAD_T + FUSS), 6.5, 3.0), FEU.Zunge(PAD_L + 12.5, (H - 1) - (PAD_T + FUSS), 6.5, 3.0)],
                  RAMPE, n=N, seed=5, posen=12, amplitude=1.0, sperre=fest[::-1].copy())


def bob_von(i):
    return -int(round(2 * (1 - math.cos(2 * math.pi * i / (N / 4))) / 2))     # 0 → −1 → −2 → −1 → 0 (nur nach oben)


def frame(i, partikel=True, effekte=True):
    bob = bob_von(i)
    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    if effekte:
        st = [0, 0, 0, 0, 1, 1, 1, 0, -1, -1, 0, 0][i % 12]                 # Leuchtauge pulsiert
        if st:
            for y, x in zip(*np.nonzero(auge)):
                kp[PAD_T + y, PAD_L + x, :3] = F.heller(kp[PAD_T + y, PAD_L + x, :3], ROT_RAMPE, st)
        F.lichtband(kp, metall_maske, PAD_L, PAD_T, i, N // 2, 6, 9, METALL, stufen=1, breite=3.0, achse=(1.0, 0.7))
    kp = L.versetze(kp, 0, bob)
    flammen = FEUER.ebene(i)[::-1].copy()                                      # zurückgespiegelt: Flamme brennt nach unten
    flammen = L.versetze(flammen, 0, bob)
    f = L.zusammen(H, W, [(flammen, 0, 0), (kp, 0, 0)])
    if partikel:
        funken = FEUER.funken(i, dy=lambda fr: -bob_von(fr))[::-1].copy()
        f = L.zusammen(H, W, [(f, 0, 0), (funken, 0, 0)])
    return f


def zuschneiden(frames, rand=2):
    """Frame auf die Figur zuschneiden und zentrieren: Vereinigung aller Frames + `rand` px."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()) - rand, int(ys.min()) - rand, int(xs.max()) + rand, int(ys.max()) + rand
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()))
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('future-tech-drone', 'Future Tech Drone', frames, MS, prev)
    if prev:
        L.streifen(prev + '/future-tech-drone-strip.png', frames, spalten=8, scale=8)
