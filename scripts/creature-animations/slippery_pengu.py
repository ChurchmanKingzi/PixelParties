# -*- coding: utf-8 -*-
"""Idle-Animation für „Slippery Pengu“ (Creature) — der auf dem Bauch rutschende Pinguin. Runde 3: er RUTSCHT nach links und rechts (und dreht sich dabei um).

Nutzerkorrektur (wörtlich): „Pengu sollte, wie die meisten Slipperies, nach links und rechts sliden.“

Quelle: src/slippery-pengu.png (42×18 px, 125 Farben, deckend) — Ebene „Pengu“ (xcf Motive, 50×21) mit Dithering (4×4-Bayer) statt Halbtransparenz: die Ebene hat hinten (rechts) einen unscharf auslaufenden
Rutschschweif (Alpha 25–230) und einen halbtransparent verschmierten Flügel; per Regel 22 deckend gemacht: Alpha ≥ 150 → deckend, 70–150 → Schachbrett-Dither nach Alpha, darunter weg
(Pixel behalten ihre RGB-Farbe aus der Ebene; Farben also alle aus der Quelle). Die Nachbarebene 823 „Ebene #337“ (104×22, Fahrtstreifen) bleibt weg.
PICK: [["Motive", 822, "ganze Ebene, Alpha → Dither (Schwelle 150/70)"]]      (Karte Slippery_Pengu.png: Pinguin rutscht nach links, Schweif läuft aus dem Bild)

Aufruf:   python3 slippery_pengu.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slippery-pengu.png + .json

Was im Sprite ist (x, y im 42×18-Sprite):
* KOPF (x 0–14, y 6–13): dunkle Kopfkappe A/B/E (46,45,50)/(23,23,23)/(29,29,29), Schnabel L (122,65,35) bei (2–5, 11) auslaufend nach links mit dunkler Spitze B (0–1, 11);
  AUGE = zwei helle grauen Pixel (164,165,160) bei (9, 8) und (9, 9); gelber (233,189,18) und orangefarbener (172,66,6) Halsfleck H/R bei (14–16, 9–13).
* BAUCH (x 14–31, y 9–16): cremefarbene Bauchfedern D (221,215,189) im Wechsel mit grauen C (167,164,159), unten dunkler Saum B/K.
* RÜCKEN/FLÜGEL: dunkler Rücken A/E; der nach hinten oben weggestreckte Flügel (x 21–35, y 0–8) mit auslaufendem Dither; dahinter der Schweif (x 31–41, y 8–17) ebenfalls mit Dither.
Bleibt fest: Kopf mit Schnabel, Bauchfedern, Halsfleck. Material: Federn — KEIN Glanz (Regel 14).

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos), alle Bewegungen unabhängig:
* RUTSCHEN (neu): der GANZE Pinguin samt Flügel, Schweif und Schneestaub gleitet ganzzahlig über das Eis — Frames 0–11 nach links (bis −8 px, sanft anfahrend/bremsend, er blickt nach links = Originalrichtung), kurzer
  [Runde 4: KEINE Spiegelung mehr, siehe BAHN unten; der folgende Text beschreibt Runde 3] Halt, dann (Frame 13) wird der Sprite horizontal gespiegelt und er gleitet Frames 15–30 nach rechts (bis +8 px; der Schweif/Staub liegt jetzt links, also wieder HINTER ihm), Halt, Rückspiegeln (Frame 33) und
  Frames 34–47 zurück zur Mitte (links gerichtet). Frame 0 = Original. Die Leinwand ist links/rechts gleich breit (Spiegeln um die Mitte). Keine Gehbewegung, nichts verformt sich dabei.
* Flügel schlägt (Periode 16): die Flügelspalten (y ≤ 8, x ≥ 21) heben/senken sich bis ±2 px (am Ende am stärksten, Spalten am Körper bleiben), die Lücke zum Rücken wird durch `fuell` gefüllt (Flügel bleibt am Rumpf).
* Schweif wedelt (Periode 12): die Schweifspalten (x ≥ 31, y ≥ 8) wandern bis ±1 px senkrecht; die Bauchunterkante bleibt am Boden (Zeile 17).
* Atmen (Periode 24): Zeile 12 des Rumpfs wird einmal doppelt (Mischtextur) — Kopf, Rücken, Flügel steigen 1 px; der Bauch/Boden bleibt (der Pinguin liegt auf dem Eis).
* Blinzeln (alle 2,4 s, 2 Frames): die hellen Augenpixel (9,8)/(9,9) werden zur Kopffarbe A.
* Schneestaub (5 Wölkchen ≥ 2×2, Farben D/C): stäubt hinter dem Pinguin (rechts) vom Eis auf und steigt langsam auf.
Ergänzungen: keine gemalten Pixel außer dem Blinzeln (Quellfarbe A). Frame 0 = Original (Staub ausgenommen).
"""
import math
import random
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_rutsch as R

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 18, 18, 6, 3          # links/rechts gleich (Spiegeln um die Mitte): Rutschweg ±8 px + Schneestaub
TEST_EBENEN = ('koerper',)

spr = L.lade('slippery-pengu')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)
yy, xx = np.mgrid[0:sh, 0:sw]
vorh = L.deckend(spr)
fluegel = vorh & (yy <= 8) & (xx >= 21)
schweif = vorh & (yy >= 8) & (xx >= 31) & ~fluegel
rumpf = vorh & ~fluegel & ~schweif
AUGE = {(9, 8): (46, 45, 50), (9, 9): (46, 45, 50)}
D_, C_ = (221, 215, 189), (167, 164, 159)


def teil(m):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T)


R_ = teil(rumpf)
FL = teil(fluegel)
SW = teil(schweif)
FUELL = (R_[..., 3] > 0)
FUELL_S = FUELL


def koerper(i):
    fl = L.spalten_welle(FL, PAD_L + 21, 2.0, L.sinus(i, 16), potenz=1.0, fuell=FUELL)
    sw_ = L.spalten_welle(SW, PAD_L + 31, 1.4, L.sinus(i, 12), potenz=1.0, fuell=FUELL)
    k = L.zusammen(H, W, [(sw_, 0, 0), (R_, 0, 0), (fl, 0, 0)])
    if Hm.folge(i, 26, [1, 1], N):
        Hm.setze(k, AUGE, OFF)
    k = TX.atmen(k, PAD_T + 12, PAD_T + 8, E.verlauf3(i, 24, 0.0, 1), 0)
    Hm.kontur_schliessen(k, ERLAUBT, (23, 23, 23))
    return k


STAUB = [dict(x=PAD_L + x, y=PAD_T + 16 + dy, vx=vx, vy=-9, off=o, form=f, wackeln=1.0, ph=p) for (x, dy, vx, o, f, p) in
         [(36, 0, 5.0, 0, 'm', 0.0), (30, 1, 4.0, 10, 'o', 0.3), (40, -1, 3.0, 20, 'o', 0.6), (34, 1, 5.0, 29, 'm', 0.1), (38, 0, 4.0, 39, 'm', 0.8)]]
STAUB_FARBEN = {'c': D_, 'r': C_}


# Rutschen (Runde 4, Regel 47: NICHT spiegeln): Pinguin blickt immer nach links (Original); 0 → −8, Halt, −8 → +8 (gleitet rückwärts zurück), Halt, +8 → 0
BAHN, _SPIEGEL = R.pfad(N, [('fahrt', -8, 13), ('halt', 2), ('fahrt', 8, 17), ('halt', 2), ('fahrt', 0, 14)])


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, STAUB, STAUB_FARBEN), 0, 0))
    ebenen.append((koerper(i), 0, 0))
    return R.verschieben(L.zusammen(H, W, ebenen), BAHN[i], False)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    print('Position je Frame:', BAHN)
    L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    L.speichern('slippery-pengu', 'Slippery Pengu', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/slippery-pengu-strip.png', frames[::2], spalten=8, scale=5)
