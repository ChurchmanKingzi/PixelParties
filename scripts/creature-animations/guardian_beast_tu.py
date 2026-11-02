# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Tu“ (Creature) — die Hasen-Göttin (Tu): lange rosa Schlappohren, weißes Gesicht mit roten Augen, goldene Kette, fliederfarbenes Kleid.

Quelle: src/guardian-beast-tu.png (26×27 px, 38 Farben).
PICK: [["MotiveGuardianBeasts", 109, 1]]      (Ebene „Tu-Kopie“, Figur 1)
Quelle vollständig: ja für die Figur selbst. NICHT verwendet: Ebene 110 „Tu“ (Schleier/Flügel, 70 % durchsichtig, weich verlaufend, 26×37) und Ebene 111 (Schattenfleck am Boden) — beides sind
Weichzeichner-/Alpha-Effekte der Kartenkunst und würden gegen die Pixelart-Regel (kein Alpha, keine weichen Verläufe) verstoßen; Rückfrage-Punkt für den Spielgestalter (siehe Bericht).

Aufruf:   python3 guardian_beast_tu.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-tu.png + .json

Identifikation (x, y im 26×27-Sprite):
* OHREN (links x 0–5, rechts x 20–25, y 2–8): lange rosa Schlappohren (225,147,163)/(208,135,150)/(198,127,142) mit dunkelbraunem Umriss (97,57,58), vom Kopf schräg nach außen unten hängend.
* KOPF (x 6–19, y 0–10): weißes/cremefarbenes Gesicht (241,232,215), schwarze Brauen (0,0,0) bei (9–11, 3) und (15–17, 3); AUGEN je 2×2: links (10–11, 4–5), rechts (14–15, 4–5): weiß (242,242,242)/(255,255,255)
  außen, dunkelrote Iris (113,32,41)/(156,59,67) innen; Mund (55,49,37) bei (12–13, 7); Haar/Fell rosabraun (173,139,140)/(189,151,148) mit Umriss (101,80,79) an den Kopfseiten.
* SCHULTERN/KRAGEN (x 7–18, y 10–14): graue Schulterrüschen (177,173,183), lila Kragen (122,102,161)/(93,70,114).
* GOLDKETTE (x 9–16, y 12–15): V-förmige Kette aus Gold (143,130,52)/(191,174,68) mit Anhänger bei (12–13, 13–15) und weißem Glanzpunkt (12,14); darüber/darunter dunkelrote Zierstücke (104,42,47)/(143,61,67).
* ARME (links x 3–7, rechts x 18–22, y 14–20): rosabraune Arme mit dunklem Umriss, hängen schräg nach außen.
* KLEID (x 8–17, y 15–25): flieder/weiß (225,209,238)/(203,172,229) mit Falten, dunkler Spalt in der Mitte; BEINE (y 21–26): lila Strümpfe, braune Stiefel (101,80,79).
Nicht bewegt bleiben: Gesicht (außer Blinzeln), Kleid, Beine.

Ablauf (48 Frames à 80 ms = 3,84 s, nahtlos):
* ATMEN: Kopf, Ohren, Schultern und Oberarme heben sich in einer Stufe um 1 px (Kleidzeile 17 wird einmal eingefügt, mit Nachbartextur gemischt); Kleid und Beine bleiben.
* OHRENSCHLAG: beide Schlappohren schwingen als Ganzes auf und ab (Spaltenversatz um den Ohransatz, Spitze bis ±2 px, Periode 24, die Ohren gegenläufig).
* ARME SCHLACKERN: die Unterarme (ab Zeile 17, der Oberarm bleibt am Kleid, damit der Kleidumriss geschlossen bleibt) pendeln um den Ellbogen auswärts und zurück (Zeilenversatz mit Gefälle ≤ 1 px, die Hand bis 2 px; links Periode 24, rechts Periode 16).
* BLINZELN: Frames 30–32 (Lid = Gesichtsfarbe (241,232,215), erst obere Reihe, dann beide).
* GOLD GLÄNZT (Regel 12): ein Lichtband läuft (Frames 6–19) über die Goldkette (eine Stufe auf der Goldrampe); ein vierzackiger Stern blitzt am Anhänger (12,13) in den Frames 40–44 auf.
Frame 0 = Ruhepose (Original). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (die Arme liegen hinter dem Kleid, beim Schwingen wird nichts freigelegt, was nicht schon Körper wäre).
"""
import os
import sys

import numpy as np

import anim_amorph as A
import anim_gbb as G
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 80
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 5, 3

spr = L.lade('guardian-beast-tu')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (97, 57, 58)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


GESICHT = f(12, 4)                                                              # (241,232,215)
GOLD = [(143, 130, 52), (191, 174, 68), (204, 204, 170)]
GOLD_M = vorhanden & L.farbmaske(spr, GOLD[:2])
AUGEN = {'o': [(10, 4), (11, 4), (14, 4), (15, 4)], 'u': [(10, 5), (11, 5), (14, 5), (15, 5)]}

ohr_l = vorhanden & (xx <= 5) & (yy >= 2) & (yy <= 8)
ohr_r = vorhanden & (xx >= 20) & (yy >= 2) & (yy <= 8)
arm_l = vorhanden & (((xx <= 7) & (yy >= 14) & (yy <= 17)) | ((xx <= 6) & (yy >= 18) & (yy <= 20)))
arm_r = vorhanden & (((xx >= 18) & (yy >= 14) & (yy <= 17)) | ((xx >= 19) & (yy >= 18) & (yy <= 20)))
koerper_m = vorhanden & ~ohr_l & ~ohr_r & ~arm_l & ~arm_r


def ebene(m, dx=0, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L + dx, PAD_T + dy)


def frame(i):
    r = int(round(0.5 - 0.5 * np.cos(L.sinus(i, N))))                           # Atemhub 0/1
    # ── Körper ──
    kp = ebene(koerper_m)
    Hm.lichtband(kp, GOLD_M, OFF, i, N, 6, 14, GOLD, stufen=1, breite=3.0, achse=(1.0, 1.0))
    st = Hm.folge(i, 40, [0, 1, 1, 0], N)
    if st is not None:
        Hm.stern4(kp, 12, 13, st, (255, 255, 237), GOLD[1], GOLD[1], OFF)
    k = Hm.folge(i, 30, [1, 2, 1], N)
    if k:
        Hm.setze(kp, {p: GESICHT for p in (AUGEN['o'] + (AUGEN['u'] if k == 2 else []))}, OFF)
    kp = L.streck_zeile(kp, PAD_T + 17, r)
    # ── Ohren: Spaltenversatz um den Ohransatz ──
    ol = ebene(ohr_l)
    orr = ebene(ohr_r)
    ol = L.spalten_welle(ol, PAD_L + 6, 2.4, L.sinus(i, 24), nur_rechts=False)
    orr = L.spalten_welle(orr, PAD_L + 19, 2.4, L.sinus(i, 24, np.pi), nur_rechts=True)
    ol = L.versetze(ol, 0, -r)
    orr = L.versetze(orr, 0, -r)
    # ── Arme: Hand schwingt nach außen ──
    al, ar = ebene(arm_l), ebene(arm_r)
    s_l = 0.5 - 0.5 * np.cos(L.sinus(i, 24))
    s_r = 0.5 - 0.5 * np.cos(L.sinus(i, 16))
    al = L.streck_zeile(al, PAD_T + 17, r)
    ar = L.streck_zeile(ar, PAD_T + 17, r)
    dl = G.kappe({PAD_T + y: -int(round(2.0 * s_l * (y - 17) / 3.0)) for y in range(17, 21)})
    dr = G.kappe({PAD_T + y: int(round(2.0 * s_r * (y - 17) / 3.0)) for y in range(17, 21)})
    al, ar = G.zeilen_dx(al, dl), G.zeilen_dx(ar, dr)
    fig = L.zusammen(H, W, [(al, 0, 0), (ar, 0, 0), (ol, 0, 0), (orr, 0, 0), (kp, 0, 0)])
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
    L.speichern('guardian-beast-tu', 'Guardian Beast Tu', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/guardian-beast-tu-strip.png', frames, spalten=12, scale=5)
