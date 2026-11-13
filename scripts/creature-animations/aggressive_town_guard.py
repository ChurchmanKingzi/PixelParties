# -*- coding: utf-8 -*-
"""Idle-Animation für „Aggressive Town Guard“ (Creature) — der kahle Stadtwächter in der lila Uniform, der nach links gedreht auf der Brücke steht.

Quelle: src/aggressive-town-guard.png (10×21 px).
PICK: kein eigener Ebenen-Treffer. Der Wächter ist in der Szenen-Ebene „Stadteingang“ (MotiveGrailWar 681, identisch Motive 900 „Ebene #254“) eingebacken und wurde per Farbtrennung herausgelöst
      (Fenster x 163–172, y 186–206 der Ebene; Hintergrund = die 5 Farben des Brückenholzes, keine davon kommt in der Figur vor). Die Figur steht vollständig in der Ebene (nichts abgeschnitten).
Abgleich mit der Kartenkunst public/cardgen/art/Aggressive_Town_Guard.webp (610×400, Raster 72×47): die Figur sitzt dort bei (32,12); oben links ragt der zweite Wächter (Chatty Town Guard) ins Bild.

Was im Sprite ist (x, y im 10×21-Sprite):
* KOPF (y 0–8): kahl, Haut (247,190,123)/(214,166,99)/(255,215,165), Umriss oben (24,24,24), nach links gedreht. Auge: schwarze Braue (2,4), hellblaue Iris (2,5), Augenweiß (2,6); rotbraune Nasen-/Wangenkante
  (1,5)/(1,6), Gesichtsumriss x 0; Ohr = dunkle Pixel (4,5), (4,6) mit braunem Rand (5,5), (6,6), (6,7). Kinn y 8, Hals (2–3, 9).
* UNIFORM (y 9–17): lila (66,16,123)/(82,16,156)/(49,0,99) mit weißen/lavendelfarbenen Streifen; linke Faust (1,13) Haut mit goldenem Knauf (2,13) (255,182,24) und dunkelrotem Griff (3,13) — bleibt fest
  (nicht sicher deutbar: Dolchgriff oder Schnalle); rechte Faust auf der Brust (5–6, 14).
* STIEFEL (y 18–20): schwarz mit weißer/grauer Stiefelspitze (3–6, 19).
Metall: nur der eine goldene Pixel (2,13) — zu klein für Glanz. Kein Feuer.

Idle-Idee „aggressiv“: Er schnaubt vor Wut. Ablauf (48 Frames à 62 ms ≈ 3 s, nahtlos):
* Schnelles Atmen (Periode 16, drei Atemzüge): Brust hebt sich 1 px (TX.atmen, Tunikazeile 15), Kopf geht starr mit; Stiefel bleiben stehen. Kein seitliches Kopfbewegen.
* Böser Blick (Frames 8–17 und 32–41): die Braue senkt sich — die Iris (2,5) wird schwarz, es bleibt nur das Augenweiß (2,6) als Schlitz.
* Schnauben (Frames 10–17 und 34–41): vor der Nase tritt ein 2×2-Wölkchen (Weiß/Hellgrau der Stiefelspitze) aus, zieht 3 px nach links und 1 px nach oben und verschwindet.
* Faust schütteln (Frames 20–27 und 42–47): die Faust auf der Brust (4–5, 14) ruckt 1 px hoch und zurück (Hand als Einheit; die Zeile darunter zeigt die Tunika).
* Blinzeln (Frames 27–28): Iris und Augenweiß nehmen die Hautfarbe an.
Frame 0 = Original. Ergänzungen: keine (nichts Verdecktes wird freigelegt).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX
TX.umleiten()

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 7, 7, 4, 2
TEST_EBENEN = 'figur'

spr = L.lade('aggressive-town-guard')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


HAUT = f(3, 5)
SCHWARZ = f(2, 4)
WOLKE_K, WOLKE_R = f(3, 19), f(4, 19)          # Weiß / Hellgrau der Stiefelspitze
SCHNAUB = [(-2, 6, 1), (-2, 6, 2), (-3, 6, 2), (-3, 5, 2), (-4, 5, 2), (-4, 5, 2), (-5, 4, 2), (-5, 4, 1)]   # (x, y links oben, Größe 1 = 2×1, 2 = 2×2)


def frame(i, nur=None):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    # --- böser Blick: Braue senkt sich über die Iris ---
    if Hm.folge(i, 8, [1] * 10, N) or Hm.folge(i, 32, [1] * 10, N):
        Hm.setze(k, {(2, 5): SCHWARZ}, OFF)
    # --- Blinzeln ---
    if Hm.folge(i, 27, [1, 1], N):
        Hm.setze(k, {(2, 5): HAUT, (2, 6): HAUT}, OFF)
    # --- Faust schütteln: die Faust (5–6, 14) ruckt 1 px hoch ---
    if Hm.folge(i, 20, [1, 1, 0, 0, 1, 1, 0, 0], N) or Hm.folge(i, 42, [1, 1, 0, 0, 1, 1], N):
        Hm.setze(k, {(5, 13): f(5, 14), (6, 13): f(6, 14), (5, 14): f(5, 13), (6, 14): f(6, 13)}, OFF)
    # --- schnelles Atmen ---
    k = TX.atmen(k, PAD_T + 15, PAD_T + 8, Hm.stufe(i, N / 3, 1), 0)
    if nur == 'figur':
        return k
    # --- Schnauben ---
    s = Hm.folge(i, 10, SCHNAUB, N) or Hm.folge(i, 34, SCHNAUB, N)
    if s:
        x, y, g = s
        px = {(x, y): WOLKE_K, (x + 1, y): WOLKE_R}
        if g == 2:
            px.update({(x, y + 1): WOLKE_R, (x + 1, y + 1): WOLKE_K})
        Hm.setze(k, px, OFF)
    return k


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    print('Pixel je Frame:', L.pruefe(frames, quelle=spr))
    L.speichern('aggressive-town-guard', 'Aggressive Town Guard', frames, MS, prev)
