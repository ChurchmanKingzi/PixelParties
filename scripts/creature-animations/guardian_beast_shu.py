# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Shu“ (Creature) — die Ratte (Shu): ein graues Mäuschen mit großen runden Ohren, goldener Brustplatte und einem Schwanzring.

Quelle: src/guardian-beast-shu.png (23×24 px, 18 Farben).
PICK: [["MotiveGuardianBeasts", 71, 1]]      (Ebene „Shu“, Figur 1; die Karte zeigt drei Mäuse — Ebene 70 „Shu #1“ ist die Dreiergruppe (halbtransparent), die beiden
      beigen Nachbarn sind Ebene 28 „Ascended Dajan #2“ (eine andere Karte) — es wird genau das mittlere, graue Exemplar verwendet.)
Quelle vollständig: ja (Kopf, Ohren, Körper, Schwanz, Füße in einer Ebene).

Aufruf:   python3 guardian_beast_shu.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-shu.png + .json

Identifikation (x, y im 23×24-Sprite):
* OHREN (links x 0–6, rechts x 14–19, y 0–8): große runde Ohren, innen hell (215,213,221)/(238,235,238), außen dunkelgrau (90,89,94) umrandet, unten dunkel (59,59,62)/(123,124,128).
* GESICHT (x 6–14, y 4–14): Stirn weiß/hellgrau; schwarze Brauen (0,0,0) bei (7–8, 7) und (11–13, 7); AUGEN: je ein schwarzer Lidstrich (7–8, 10) bzw. (11–12, 10) darunter das Auge
  (7,11)/(8,11) bzw. (11,11)/(12,11): weiß (255,255,255) mit dunkelroter Iris (109,51,55); Schnauze weiß (228,228,228)/(205,205,205) in der Mitte (x 9–10, y 11–15).
* GOLDPLATTE (x 6–13, y 15–19): goldene Brustplatte/Schärpe (115,107,40)/(207,192,75)/(229,215,105) — Metall/Gold: bekommt Lichtband und Stern.
* ARME/PFOTEN (x 3–6 und 13–16, y 14–18): helle Pfoten (228,228,228)/(215,213,221) mit dunklem Umriss; BEINE/FÜSSE (x 4–15, y 19–23): weiße Stiefel/Pfoten mit dunkler Sohle.
* SCHWANZ (x 16–22, y 9–20): dunkler Ring (59,59,62)/(90,89,94) mit hellem Streifen (215,213,221); oben an die Wange (y 9–11) angesetzt, unten (y 18–20) an die rechte Pfote.
Nicht bewegt bleiben: Gesicht (außer Blinzeln), Pfoten, Füße.

Ablauf (48 Frames à 80 ms = 3,84 s, nahtlos):
* ATMEN: Kopf samt Ohren und Armansatz heben sich in einer Stufe um 1 px (Zeile 13, der helle Brustfell-Streifen, wird einmal eingefügt, mit Nachbartextur gemischt) — Goldplatte, Pfoten
  und Füße bleiben am Boden (nur die Ohrspitzen steigen mit).
* OHRZUCKEN: linkes Ohr (Frames 6–11 und 30–35) und rechtes Ohr (Frames 18–23 und 42–47) klappen mit der oberen Hälfte 1 px nach außen und zurück (Zeilenversatz mit Gefälle ≤ 1 px, Umriss wandert mit).
* SCHWANZRING: die Mitte des Schwanzringes (y 12–17) beult sich 1–2 px nach außen und wieder zurück (Periode 24), Ansatz oben (y ≤ 11) und unten (y ≥ 18) bleiben fest.
* BLINZELN: Frames 20–22 (Lid = Fellgrau (90,89,94), erst halb, dann ganz, dann halb).
* GOLD GLÄNZT (Regel 12): ein Lichtband läuft (Frames 4–17) über die Goldplatte (eine Stufe auf der Goldrampe); ein vierzackiger Stern blitzt bei (8,17) in den Frames 38–42.
Frame 0 = Ruhepose (Original). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt).
"""
import os
import sys

import numpy as np

import anim_amorph as A
import anim_gbb as G
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 80
PAD_L, PAD_R, PAD_T, PAD_B = 4, 5, 4, 3

spr = L.lade('guardian-beast-shu')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (59, 59, 62)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


FELL = (90, 89, 94)
GOLD = [(115, 107, 40), (207, 192, 75), (229, 215, 105)]
GOLD_M = vorhanden & L.farbmaske(spr, GOLD)
WEISS = (255, 255, 255)

schwanz_m = vorhanden & (xx >= 17) & (yy >= 9) & ~((xx == 17) & (yy == 9))        # (17,9) ist Kopfumriss unter dem Ohr: bleibt am Kopf
ohr_l = vorhanden & ~schwanz_m & (xx <= 5) & (yy <= 8)
ohr_r = vorhanden & ~schwanz_m & (xx >= 15) & (yy <= 8)
oben_m = vorhanden & ~schwanz_m & (yy <= 13)                                   # Kopf + Ohren
unten_m = vorhanden & ~schwanz_m & (yy > 13)
kopf_m = oben_m & ~ohr_l & ~ohr_r

AUGEN_L = [(7, 11), (8, 11)]
AUGEN_R = [(11, 11), (12, 11)]


def ebene(m, dx=0, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L + dx, PAD_T + dy)


def ohr_dx(i, start, vorz):
    """Ohrzucken: 0, 1, 1, 1, 1, 0 … Pixel nach außen (vorz = −1 links, +1 rechts) — Frame-Fenster [start, start+6)."""
    w = Hm.folge(i, start, [0, 1, 1, 1, 1, 0], N)
    return 0 if not w else vorz * w


SCHWANZ_AMP, SCHWANZ_N, SCHWANZ_LAG, SCHWANZ_INNEN = 2.8, 24, 0.0, 0.45        # Ausschlag der Spitze (px), Periode, Wellenlauf (rad) von Ansatz zu Spitze (0: Frame 0 = Original), Faktor nach innen (zum Kopf)


def schwanz_dx(i):
    """{Leinwandzeile: dx} des Schwanzes: Zeilenversatz wächst vom Ansatz (y 18) zur Spitze (y 9) hin (Wellenlauf: die Spitze hinkt etwas nach); die Spitze (y 9–11) als Block."""
    u = lambda y: min(1.0, max(0.0, (18 - y) / 9.0))
    def wert(y):
        s = np.sin(L.sinus(i, SCHWANZ_N) - SCHWANZ_LAG * u(y))
        if s < 0:
            s *= SCHWANZ_INNEN
        return SCHWANZ_AMP * u(y) * s
    roh = {y: wert(y) for y in range(9, 19)}
    for y in (9, 10, 11):
        roh[y] = wert(10)
    return G.kappe({PAD_T + y: int(round(v)) for y, v in roh.items()})


def frame(i):
    r = int(round(0.5 - 0.5 * np.cos(L.sinus(i, N))))                          # Atemhub 0/1 (der Hals darf nicht länger werden)
    # ── Kopf mit Ohren ──
    kopf = ebene(kopf_m)
    k = Hm.folge(i, 20, [1, 2, 1], N)
    if k:
        Hm.setze(kopf, {p: FELL for p in AUGEN_L + AUGEN_R}, OFF)
    ol, orr = ebene(ohr_l), ebene(ohr_r)
    for lay, vorz, starts in ((ol, -1, (6, 30)), (orr, 1, (18, 42))):
        d = ohr_dx(i, starts[0], vorz) or ohr_dx(i, starts[1], vorz)
        if d:
            dxs = {PAD_T + y: d if y <= 3 else 0 for y in range(0, 9)}
            lay[:] = G.zeilen_dx(lay, dxs)
    # Zusammensetzen: Kopf + Ohren einmal gemeinsam atmen lassen
    oben = L.zusammen(H, W, [(ol, 0, 0), (orr, 0, 0), (kopf, 0, 0)])
    oben = L.streck_zeile(oben, PAD_T + 13, r)
    # ── Körper (Goldplatte, Pfoten, Füße): Gold-Lichtband + Stern ──
    unten = ebene(unten_m)
    Hm.lichtband(unten, GOLD_M, OFF, i, N, 4, 14, GOLD, stufen=1, breite=3.0, achse=(1.0, 1.0))
    st = Hm.folge(i, 38, [0, 1, 1, 0], N)
    if st is not None:
        Hm.stern4(unten, 8, 17, st, WEISS, GOLD[2], GOLD[2], OFF)
    # ── Schwanz: Ansatz unten (y ≥ 18) fest, der Ring schwingt nach oben immer weiter, die Schwanzspitze (y 9–11) am weitesten ──
    sw_ = ebene(schwanz_m)
    sw_ = G.zeilen_dx(sw_, schwanz_dx(i))
    fig = L.zusammen(H, W, [(sw_, 0, 0), (unten, 0, 0), (oben, 0, 0)])
    fig, _ = A.verbinde4(fig)
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
    L.speichern('guardian-beast-shu', 'Guardian Beast Shu', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/guardian-beast-shu-strip.png', frames, spalten=12, scale=5)
