# -*- coding: utf-8 -*-
"""Idle-Animation für „Cardinal Beast Xuanwu“ (Creature) — die Schwarze Schildkröte des Nordens: eine große Schildkröte mit dunklem Plattenpanzer, vier kräftigen Beinen, gehörntem Kopf mit
offenem Maul voller Reißzähne und einem hellblauen Tuch am Hals.

Quelle: src/cardinal-beast-xuanwu.png (52×29 px, 28 Farben).
PICK: [["MotiveRussia", 5, "Xuanwu #1"]]      (von Hand aus dem Ebenen-Dump genommen: der Treffer-Suchlauf (creature_show.py) findet für diese Karte wegen der Schnee-/Blautönung der Kartenkunst
      nur Fehltreffer; die Ebenen heißen aber „Xuanwu“ — Ebene 5 „Xuanwu #1“ (52×30 px) ist die Schildkröte mit gehörntem Kopf, wie sie die Karte zeigt;
      Ebene 6 „Xuanwu“ ist dieselbe Schildkröte mit hornlosem Kopf, Ebene 3 „Xuanwu #2“ eine weiße Kugel mit schwarzen Zeichen (Szene), Ebene 4 „Xuanwu #3“ und 2 „Xuanwumon“ weiche
      Schneeschleier (Alpha-Verläufe, in der Kunst über dem Panzer — nicht verwendet).)
Quelle vollständig: ja (Kopf, Hals, Panzer, vier Beine); die beiden unteren Beinzeilen sind in der Ebene Alpha-Verlauf (Beine versinken im Schnee): Zeile 28 (Alpha 177) wurde deckend übernommen,
Zeile 29 (Alpha 68) entfällt.

Aufruf:   python3 cardinal_beast_xuanwu.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cardinal-beast-xuanwu.png + .json

Identifikation (x, y im 52×29-Sprite):
* PANZER (x 0–37, y 6–25): flacher, abgestufter Plattenpanzer in Dunkelbraun/Grau (37,31,27)/(63,52,47)/(79,67,58)/(103,94,83)/(117,107,101), unterteilt durch senkrechte Nähte (x 14, 23, 32)
  und zwei Plattenreihen (y 7–13 und y 15–19); unten zwei Beinansätze/Rand (y 20–25).
* BEINE (x 7–11, 23–27, 37–41 u. a., y 20–28): braune Beine (73,53,37)/(103,81,61)/(124,96,69)/(170,144,112)/(197,171,134) mit hellerer Vorderkante; vier Beine (zwei sind teilweise vom Panzer verdeckt).
* HALS (x 33–42, y 9–27): schräg nach vorn aufsteigender Hals mit hellblauem Tuch (196,212,225)/(152,179,193)/(109,142,149)/(32,53,62) (y 14–22) und schwarzem Schattenfleck (0,0,0) bei (33–36, 19–23).
* KOPF (x 41–51, y 6–14): gehörnter Kopf, schwarze spitze Ohren/Hörner (24,19,21)/(77,77,77)/(56,50,54) bei x 40–43 und 48–51 (y 0–5); Gesicht (170,144,112)/(196,174,141), rosa Wangen (255,173,173) bei (44,8–9) und (48,9);
  schwarze Augenpunkte bei (45,8) und (48,8) (und Brauen (44,7)/(49,7)) — sie lesen sich uneindeutig, deshalb bleiben die Augen fest (kein Blinzeln); MAUL (x 45–49, y 11–13) offen: weiße Reißzähne (255,255,255)
  bei (45,11–12) und (49,11–12), dunkelrote Rachenfläche (51,0,0)/(91,0,0)/(111,0,0).
Nicht bewegt bleiben: Beine, Gesicht, Tuch, Panzerränder unten (y ≥ 19).

Ablauf (64 Frames à 80 ms = 5,12 s, nahtlos; bewusst langsam — schwere Figur):
* ATMEN (zweistufig, langsam): Panzer, Hals und Kopf (alles oberhalb von Zeile 19) heben sich in zwei Stufen um bis zu 2 px (Zeile 18 wird 1–2× eingefügt, mit Nachbartextur gemischt); Beine und Panzerunterkante bleiben am Boden.
* OHRENZUCKEN: das linke Ohr (Frames 14–19) und das rechte Ohr (Frames 42–47) kippen mit den oberen drei Zeilen 1 px nach außen und zurück.
* ATEMDUNST (kalte Luft, runde Wölkchen ≥ 2×2, steigen langsam auf): drei kleine Dunstwölkchen (2×2 → 3×3 → 2×2, nie kleiner) steigen vor dem Maul auf und treiben leicht nach vorn (Farben: Weiß (255,255,255) und Eisblau (196,212,225) des Sprites).
Frame 0 = Ruhepose (Original, Dunst ausgenommen). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Zuschnitt: der Frame ist auf die Figur zugeschnitten, symmetrisch um die Ruhefigur; der Dunst darf ihn höchstens 12 px vergrößern.
Ergänzungen: keine.
"""
import os
import sys

import numpy as np

import anim_gbb as G
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)
import anim_untote as U

N, MS = 64, 80
GPL, GPR, GPT, GPB = 4, 18, 8, 4

spr = L.lade('cardinal-beast-xuanwu')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (24, 19, 21)
TEST_EBENEN = ('koerper',)

ohr_l = vorhanden & (xx >= 40) & (xx <= 43) & (yy <= 5)
ohr_r = vorhanden & (xx >= 48) & (yy <= 5)
oben_m = vorhanden & ~ohr_l & ~ohr_r & (yy <= 18)
unten_m = vorhanden & ~ohr_l & ~ohr_r & (yy >= 19)

WEISS, EIS = (255, 255, 255), (196, 212, 225)


def ebene(m, dx=0, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, GPL + dx, GPT + dy)


def ohr_dx(i, start, vorz):
    w = Hm.folge(i, start, [0, 1, 1, 1, 1, 1, 0], N)
    return 0 if not w else vorz * w


def frame_gross(i, nur=None):
    r = int(round(2 * (0.5 - 0.5 * np.cos(L.sinus(i, N)))))                      # Atemhub 0…2 (langsam)
    ob = TX.streck_zeile(ebene(oben_m), GPT + 18, r)
    ol, orr = ebene(ohr_l), ebene(ohr_r)
    for lay, vorz, start in ((ol, -1, 14), (orr, 1, 42)):
        d = ohr_dx(i, start, vorz)
        if d:
            lay[:] = G.zeilen_dx(lay, {GPT + y: (d if y <= 2 else 0) for y in range(0, 6)})
    ol, orr = L.versetze(ol, 0, -r), L.versetze(orr, 0, -r)
    un = ebene(unten_m)
    fig = L.zusammen(H, W, [(un, 0, 0), (ob, 0, 0), (ol, 0, 0), (orr, 0, 0)])
    G.rand_schliessen(fig, ERLAUBT, UMRISS)
    if not nur:
        dunst = U.wolke_ebene(H, W, i, N, [
            dict(x=GPL + sw + 1, y=GPT + 12, vx=7, vy=-6, off=0, wackeln=0.8),
            dict(x=GPL + sw + 1, y=GPT + 12, vx=7, vy=-6, off=21, wackeln=0.8),
            dict(x=GPL + sw + 1, y=GPT + 12, vx=7, vy=-6, off=43, wackeln=0.8)], {'c': WEISS, 'r': EIS})
        fig = L.zusammen(H, W, [(dunst, 0, 0), (fig, 0, 0)])
    return fig


def _frames(nur):
    return [frame_gross(i, nur) for i in range(N)]


BOX = U.zuschnitt(_frames(None), _frames(TEST_EBENEN), (GPL, GPT, GPL + sw, GPT + sh), zugabe=12, rand=2)
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr, min_rand=2)
    print('Pixel je Frame:', n)
    r0 = frame(0, nur=TEST_EBENEN)
    diff = [(x, y) for y in range(sh) for x in range(sw)
            if bool(r0[y + PAD_T, x + PAD_L, 3]) != bool(spr[y, x, 3]) or (spr[y, x, 3] and not np.array_equal(r0[y + PAD_T, x + PAD_L, :3], spr[y, x, :3]))]
    print('Ruhepose (ohne Dunst) weicht vom Original ab bei:', diff if diff else 'nichts')
    L.speichern('cardinal-beast-xuanwu', 'Cardinal Beast Xuanwu', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/cardinal-beast-xuanwu-strip.png', frames, spalten=8, scale=4)
