# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Yang“ (Creature) — der Schafs-Wächter (Yang): ein dunkelhäutiger Krieger mit großen violetten Widderhörnern (Ring über dem Kopf), roter Schärpe,
ausgebreiteten Armen und zwei schwebenden Armbrüsten links und rechts.

Quelle: src/guardian-beast-yang.png (68×33 px, 44 Farben) — von Hand aus den xcf-Ebenen zusammengesetzt (creature_show.py legt die beiden gleichen Armbrüste übereinander).
PICK: [["MotiveGuardianBeasts", 62, 1], ["MotiveGuardianBeasts", 61, 1], ["MotiveGuardianBeasts", 61, 2]]
      (Ebene „Yang #1“ = die Figur, Ebene „Yang #2“ = beide Armbrüste (21×19 px, Abstand zur Figur −24 / +23 px, in der Kartenkunst so angeordnet);
      nicht verwendet: Ebene 60 „Yang #3“ (die schwarzen Bodenschatten unter den Armbrüsten, 80 % durchsichtig = Szene) und Ebene 63 „Yang“ (dieselbe Figur, hält eine Armbrust im Anschlag).)
Quelle vollständig: ja (Figur + beide Armbrüste); die Karte zeigt zusätzlich nur Rahmen/Hintergrund.

Aufruf:   python3 guardian_beast_yang.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-yang.png + .json

Identifikation (x, y im 68×33-Sprite):
* ARMBRÜSTE (links x 0–20, rechts x 47–67, y 1–16): braune Holzschäfte (118,68,34)/(98,56,28)/(62,35,17) mit schwarzem Umriss, oben die Bogenarme (schwarz/braun), von den Bogenspitzen
  laufen graue/weiße Sehnen (229,229,229)/(172,172,172)/(115,115,109) schräg zum Schaft; sie schweben (in der Kunst mit Bodenschatten darunter) — sie werden nicht gehalten.
* HÖRNER (x 24–44, y 3–17): zwei große violette Widderhörner (143,100,180)/(222,175,243)/(243,215,253) mit dunklem Rand (47,16,73), die sich als Ring über dem Kopf schließen.
* KOPF (x 29–39, y 10–19): graue/weiße Haube oder Haare (172,172,172)/(229,229,229)/(211,211,201) (y 10–15), dunkles Gesicht (70,61,54)/(88,78,68); AUGEN: links (31, 17–18), rechts (36, 17–18):
  hellblauer Pixel (172,213,255) über weißem (246,255,255), daneben dunkelrote Iris (78,23,18) bei (32,18)/(35,18).
* SCHÄRPE/KRAGEN (x 29–38, y 20–24): dunkelrot (104,14,20)/(118,26,32)/(131,31,40), V-förmig; ARME: ausgebreitete schwarze Ärmel (x 24–29 links, 38–43 rechts, y 22–25) mit violetten Manschetten
  (186,147,228)/(143,121,168) bei (26,24)/(41,24).
* GÜRTEL (x 30–36, y 25–26): violetter Gürtel (143,100,180) mit goldenem Edelstein/Schnalle (207,179,35)/(219,190,37)/(242,239,76) bei (33–34, 25–26).
* HOSE/BEINE (x 28–38, y 27–32): weiß/grau (211,211,201)/(241,242,237), schwarze Stiefel.
Fest bleiben: Hörner (Horn/Knochen: kein Glanz), Gesicht außer Blinzeln, Hose, Stiefel.

Ablauf (48 Frames à 80 ms = 3,84 s, nahtlos):
* ATMEN: Kopf, Hörner, Schärpe und Arme heben sich in einer Stufe um 1 px (Hosenzeile 27 wird einmal eingefügt, mit Nachbartextur gemischt); Gürtel und Beine bleiben.
* ARME: die Ärmel/Hände (links x 24–27, rechts x 40–43) heben und senken sich 1 px (Spaltenversatz, gegenläufig, Perioden 24 und 32).
* SCHWEBENDE ARMBRÜSTE: jede Armbrust schwebt in einer langsamen Auf-und-ab-Bewegung (±1 px; links Periode 32, rechts Periode 24, gegenläufig — in der Kunst schweben sie über dem Boden);
  zusätzlich federn die Bogenarme (Spitzen ±1 px gegenüber dem Schaft, die Sehnen laufen mit; links Periode 16, rechts Periode 12).
* BLINZELN: Frames 22–24 (Lid = Gesichtsfarbe (70,61,54), erst die obere Reihe, dann beide).
* GOLD GLÄNZT (Regel 12): ein Lichtband läuft (Frames 4–11) über den goldenen Gürtelstein (eine Stufe auf der Goldrampe); ein vierzackiger Stern blitzt bei (34,25) in den Frames 34–38.
Frame 0 = Ruhepose (Original). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine.
Annahme: Die Armbrüste gehören zur Figur (Kartenkunst, Waffen = Bestandteile); sie sind schwebend dargestellt und dürfen deshalb leicht auf- und abschweben (Regel 18 gilt für Bodenwesen).
"""
import os
import sys

import numpy as np

import anim_gbb as G
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen

N, MS = 48, 80
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 3

spr = L.lade('guardian-beast-yang')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (0, 0, 0)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


GESICHT = (70, 61, 54)
AUGEN = {'o': [(31, 17), (36, 17)], 'u': [(31, 18), (32, 18), (35, 18), (36, 18)]}
GOLD = [(207, 179, 35), (219, 190, 37), (242, 239, 76)]
GOLD_M = vorhanden & L.farbmaske(spr, GOLD)

bow_l = vorhanden & (xx <= 21)
bow_r = vorhanden & (xx >= 46)
figur = vorhanden & ~bow_l & ~bow_r
arm_l = figur & (xx <= 27) & (yy >= 22) & (yy <= 25)
arm_r = figur & (xx >= 40) & (yy >= 22) & (yy <= 25)
rumpf_m = figur & ~arm_l & ~arm_r


def ebene(m, dx=0, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L + dx, PAD_T + dy)


def armbrust(m, i, periode_bob, periode_flex, vorz, pivot_x):
    a = ebene(m)
    # Federn der Bogenarme: Spalten außerhalb des Schafts wandern gegenüber dem Schaft (Spitze am meisten)
    ph = L.sinus(i, periode_flex)
    dys = {}
    for x in range(sw):
        if not a[:, PAD_L + x, 3].any():
            continue
        d = abs(x - pivot_x)
        if d > 2:
            dys[PAD_L + x] = int(round(1.4 * np.sin(ph) * min(1.0, (d - 2) / 6.0)))
    a = G.spalten_dy(a, dys)
    bob = int(round(1.0 * vorz * np.sin(L.sinus(i, periode_bob))))
    return L.versetze(a, 0, bob)


def frame(i):
    r = int(round(0.5 - 0.5 * np.cos(L.sinus(i, N))))                             # Atemhub 0/1
    # ── Figur ──
    kp = ebene(rumpf_m)
    Hm.lichtband(kp, GOLD_M, OFF, i, N, 4, 8, GOLD, stufen=1, breite=2.4, achse=(1.0, 1.0))
    st = Hm.folge(i, 34, [0, 1, 1, 0], N)
    if st is not None:
        Hm.stern4(kp, 34, 25, st, (253, 254, 249), GOLD[2], GOLD[2], OFF)
    k = Hm.folge(i, 22, [1, 2, 1], N)
    if k:
        Hm.setze(kp, {p: GESICHT for p in (AUGEN['o'] + (AUGEN['u'] if k == 2 else []))}, OFF)
    kp = TX.streck_zeile(kp, PAD_T + 27, r)
    # ── Arme: Hände heben/senken 1 px ──
    al, ar = ebene(arm_l), ebene(arm_r)
    dl = int(round(np.sin(L.sinus(i, 24)) * 1.2))
    dr = int(round(np.sin(L.sinus(i, 32)) * 1.2))
    al = L.versetze(al, 0, -r)
    ar = L.versetze(ar, 0, -r)
    al = G.spalten_dy(al, {PAD_L + x: dl for x in range(24, 28)})
    ar = G.spalten_dy(ar, {PAD_L + x: dr for x in range(40, 44)})
    # ── Armbrüste ──
    bl = armbrust(bow_l, i, 32, 16, 1, 9.5)
    br = armbrust(bow_r, i, 24, 12, -1, 57.5)
    fig = L.zusammen(H, W, [(bl, 0, 0), (br, 0, 0), (kp, 0, 0), (al, 0, 0), (ar, 0, 0)])
    G.rand_schliessen(fig, ERLAUBT, UMRISS)
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('guardian-beast-yang', 'Guardian Beast Yang', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/guardian-beast-yang-strip.png', frames, spalten=8, scale=4)
