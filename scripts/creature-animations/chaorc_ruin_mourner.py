# -*- coding: utf-8 -*-
"""Idle-Animation für „Chaorc Ruin Mourner“ (Creature) — der trauernde Chaorc in der violetten Robe, umgeben von Totenschädeln und Knochen.

Quelle: src/chaorc-ruin-mourner.png (32×33 px, 23 Farben).
PICK: [["MotiveHawaii", 111, 1], ["MotiveHawaii", 110, 1]]      (Ebene 111 „Ruin Mourner“ (26×33 px) = die violette Figur mit den Knochen; Ebene 110 (Figur 1 = zwei Schädel, 32×17 px) liegt in der Kunst obenauf:
  Schädel 1 über dem Kopf, Schädel 2 rechts. Lage aus der Kartenkunst Chaorc_Ruin_Mourner.png (Ebene 111 bei (26,11), Ebene 110 bei (27,14)): das zusammengesetzte Bild trifft die Kunst zu 100 %.
  Nicht verwendet: die Feuerwand rechts, die Treppe links, die Kiste oben. Die Quelle ist vollständig; verdeckt ist nur der obere Teil des Gesichts unter Schädel 1 (siehe Ergänzung).
Aufruf:   python3 chaorc_ruin_mourner.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/chaorc-ruin-mourner.png + .json

Was im Sprite ist (x, y im 32×33-Sprite):
* SCHÄDEL 1 (x 1–21, y 1–11): großer grauweißer Schädel mit Hörnern/Knochenkrone oben (y 0–4), zwei schwarzen Augenhöhlen (9,8–9),(10,9) und (15,9),(16,8–9), Nasenloch (11–14,10) und Kiefer/Zähnen unten (y 10–11); an seiner linken Seite ein Knochenstück (x 0–5, y 11–14).
* SCHÄDEL 2 (x 17–31, y 9–19): zweiter Schädel rechts mit schwarzen Augenhöhlen (20,14–15),(21,15) und (25,14–15),(24,15); an seinem Kinn hängt eine kleine Wirbelsäule/ein Knochen schräg nach links unten (x 20–24, y 20–23).
* CHAORC (x 3–19, y 11–25): violette Kapuzenrobe in Marineblau (23,16,44)/(45,26,70) und Violett (73,39,107)/(103,52,142)/(129,67,173), Gesicht (x 6–17, y 12–16) mit zwei hellblauen Augen
  (184,255,255)/(91,255,255) bei (9,12),(9,13) und (16,12); schwarze Punkte (11,13),(14,13); graue Gürtel/Rippenbänder (40,40,40)…(176,176,176) quer über den Bauch (x 6–16, y 17–21).
* KNOCHEN: ein Knochenstück hängt links unten von der Robe (x 2–6, y 23–28), ein gekreuztes Knochenpaar schwebt darunter (x 8–16, y 27–32, eigene Insel).
Metall/Edelstein: nichts → KEIN Glanz (Knochen, Stoff; Regel 14). Kein Feuer, keine Partikel.

RUNDE 4: Das Knochenstück links unten (x 2–6, y 23–28) liegt am Boden und ist NICHT mehr animiert (vorher pendelte es); der Kreuzknochen darunter bleibt ebenfalls still.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; Ebenen: Robe, Schädelgruppe, Wirbel, linkes Knochenstück, Kreuzknochen):
* Atmen der Robe (Periode 24, zweimal pro Schleife): die Robenzeile 22 wird einmal doppelt eingefügt (L.streck_zeile, Texturmischung): Kopf, Brust und Gürtel steigen 1 px, der Saum (y 23–25) bleibt.
* Knochenhut (beide Schädel samt Krone/Knochenstück, `schaedel`) sitzt starr am Kopf: er hebt und senkt sich EXAKT gleichzeitig mit dem Kopf der Robe (b = 0/1 des Atmens, Hut −b) und hat keine eigene Bewegung mehr
  (Nutzerkorrektur Runde 3: „der Knochenhut soll sich nicht unabhängig vom Kopf bewegen“). Das frühere Schweben (Periode 16) samt Füllpixeln unter dem Kiefer entfällt.
* Wirbel am Kinn von Schädel 2 schwingt (Periode 12, viermal pro Schleife): der dünne Knochen (x 20–24, y 20–23) wandert starr 0 → +1 → 0 → −1 px waagerecht (nur starr, damit der schmale Umriss nicht reißt), er hängt am Schädel und hebt sich mit ihm (mit dem Kopf).
* Linkes Knochenstück an der Robe pendelt (Periode 16 versetzt): Zeilen 24–28 wandern waagerecht (Gelenk Zeile 23, Spitze bis ±2 px), Zeile 23 bleibt an der Robe.
* Kreuzknochen (der unten liegende Knochen, x 8–16, y 27–32): bewegt sich GAR NICHT (Nutzerkorrektur Runde 3). Annahme: gemeint ist dieser Knochen; das Knochenstück links an der Robe (x 2–6) pendelt weiter an seiner Aufhängung.
* Blinzeln der drei hellblauen Augenpixel (Frames 21–23 und 41–43): sie nehmen das Marineblau (45,26,70) der Kapuze an (Lid = Umgebungsfarbe).
Frame 0 = Original (Ruhepose); Kontrolle: anim_humanoide.ruhepose. Randpixel-Test (Regel 16): Kontur in Umrissfarbe, zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (Hut und Robe heben sich gleichzeitig, es entsteht keine Lücke mehr).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_untote as U

N, MS = 48, 70
GP = 6

spr = L.lade('chaorc-ruin-mourner')
sh, sw = spr.shape[:2]
H, W = sh + 2 * GP, sw + 2 * GP
OFF = (GP, GP)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (49, 24, 0)
MARINE, DUNKEL_I = (23, 16, 44), (45, 26, 70)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


PUR = {(23, 16, 44), (103, 52, 142), (73, 39, 107), (45, 26, 70), (129, 67, 173), (184, 255, 255), (91, 255, 255), (13, 0, 0)}
BRAUN = {(49, 24, 0), (35, 17, 5), (58, 37, 23)}
purpur = np.array([[bool(vorhanden[y, x]) and f(x, y) in PUR for x in range(sw)] for y in range(sh)])
grau = vorhanden & ~purpur
# Robe: violette Pixel (y ≥ 11), die dunklen Bauchbänder (y 16–22, x 5–17) und die schwarzen Gesichtspunkte
robe = purpur & (yy >= 11)
robe |= grau & (yy >= 16) & (yy <= 22) & (xx >= 5) & (xx <= 17)
robe |= vorhanden & (yy >= 12) & (yy <= 16) & (xx >= 6) & (xx <= 17) & (np.array([[f(x, y) == (0, 0, 0) if vorhanden[y, x] else False for x in range(sw)] for y in range(sh)]))
kreuz = np.zeros((sh, sw), bool)
kreuz[27:, 8:17] = True
kreuz &= vorhanden & grau | (kreuz & vorhanden & ~robe)
kreuz &= vorhanden
knochen_l = vorhanden & ~robe & (xx <= 6) & (yy >= 23) & (yy <= 28)
wirbel = vorhanden & ~robe & ~kreuz & (xx >= 20) & (xx <= 24) & (yy >= 20) & (yy <= 23)
# Runde 4: das Umrisspixel (7,25) gehört zum liegenden Knochen (es wanderte bisher mit dem Schädel hoch); die braun/grauen Saumstücke (11–12, 23–24) und (18, 21–23) liegen unter der
# Atemzeile 22 bzw. am Saum und bleiben stehen (bisher hoben sie sich mit dem Schädel und rissen bei (18,23) ein Loch in die Robe); siehe `strebe`.
knochen_l[25, 7] = True
saum = np.zeros((sh, sw), bool)
for (_x, _y) in [(11, 23), (11, 24), (12, 23), (12, 24), (18, 21), (18, 22), (18, 23)]:
    saum[_y, _x] = True
assert (saum & vorhanden & ~robe & ~kreuz & ~knochen_l & ~wirbel).sum() == 7 and vorhanden[25, 7] and not robe[25, 7]
strebe = np.zeros((sh, sw), bool)                # der braune Strich (18, 21–23) kreuzt die Atemzeile: er hebt sich mit dem Oberkörper, sein unterstes Pixel bleibt zusätzlich stehen (wird 1 px länger, kein Loch)
strebe[21:24, 18] = True
schaedel = vorhanden & ~robe & ~kreuz & ~knochen_l & ~wirbel & ~saum
assert (robe | kreuz | knochen_l | wirbel | schaedel | saum).sum() == vorhanden.sum()
assert not (robe & schaedel).any() and not (robe & knochen_l).any() and not (kreuz & robe).any()

AUGEN = [(9, 12), (9, 13), (16, 12)]
for p in AUGEN:
    assert f(*p) in ((184, 255, 255), (91, 255, 255))


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GP, GP)


def frame_gross(i, nur=None):
    # Robe: Blinzeln, Atmen
    r = teil(robe)
    if Hm.folge(i, 21, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(r, {p: DUNKEL_I for p in AUGEN}, OFF)
    b = 1 if Hm.welle01(i, 24) > 0.5 else 0
    if b:
        r = L.streck_zeile(r, GP + 22, b)
    # Knochenhut (beide Schädel samt Krone) sitzt am Kopf: er hebt sich EXAKT mit dem Kopf der Robe (kein eigenes Schweben, Nutzerkorrektur Runde 3)
    sk = -b
    s = L.versetze(teil(schaedel), 0, sk)
    # Wirbel am Kinn von Schädel 2: pendelt waagerecht, hängt am Schädel (hebt sich mit ihm)
    sw_ = math.sin(L.sinus(i, 12))
    w = L.versetze(teil(wirbel), 1 if sw_ > 0.5 else (-1 if sw_ < -0.5 else 0), sk)
    # linkes Knochenstück an der Robe: pendelt
    # Runde 4 (Nutzer: „der untere linke Knochen soll nicht animiert sein, der liegt am Boden“): das Knochenstück links unten (x 2–6, y 23–28) bleibt völlig still
    kl = teil(knochen_l)
    # unten liegender Kreuzknochen: bewegt sich gar nicht (Nutzerkorrektur Runde 3)
    kz = teil(kreuz)
    fr = L.zusammen(H, W, [(r, 0, 0), (teil(saum), 0, 0), (L.versetze(teil(strebe), 0, sk), 0, 0), (kz, 0, 0), (kl, 0, 0), (s, 0, 0), (w, 0, 0)])
    return Hm.kontur_schliessen(fr, ERLAUBT, UMRISS)


def _box():
    fr = [frame_gross(i) for i in range(N)]
    return U.zuschnitt(fr, fr, (GP, GP, GP + sw, GP + sh), zugabe=2, rand=2)


BOX = _box()


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    BX, BY = GP - BOX[0], GP - BOX[1]
    diff = Hm.ruhepose(frames[0], spr, (BX, BY))
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('chaorc-ruin-mourner', 'Chaorc Ruin Mourner', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/chaorc-ruin-mourner-strip.png', frames, spalten=12, scale=5)
