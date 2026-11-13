# -*- coding: utf-8 -*-
"""Idle-Animation für „Gigantisaur Brachion“ (Creature) — riesiger Langhals: langsam, schwer.

PICK: [["MotiveGrailWar", 503, "ganze Ebene „Brachion“ (69×53 px, nur Alpha 0/255)"]]
Quelle: src/gigantisaur-brachion.png — Brachiosaurus im Profil, blickt nach rechts oben (69×53 px, 11 Farben). Die Ebene zeigt die ganze Figur samt Füßen (die Kartenkunst
data/card-art/native/Gigantisaur_Brachion.png schneidet die Füße unten ab; die Motiv-Maske aus data/subject-masks.json deckt sich mit der Ebene bei Versatz (3, 0)). Nichts fehlt, nichts ergänzt.

Aufruf:   python3 gigantisaur_brachion.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gigantisaur-brachion.png + .json

Identifikation (x, y im Sprite):
* Kopf (x 54–68, y 0–12): Scheitelhöcker (60–63, 0–3), zwei dunkelviolette Augen je 1×2 px (62, 4–5) und (65, 4–5), Schnauze nach rechts mit beiger Oberlippe (62–67, 7), dunkle Maullinie (62–67, 8);
  der UNTERKIEFER hängt schräg offen nach unten rechts (59–65, 8–12: beige K/J, Umriss C).
* Hals (x 37–58, y 5–22): 45°-Schräge, graue Rasterfläche, beige Kehlseite (J/K) rechts unten.
* Rumpf (x 17–43, y 22–41): grau gerastert, beiger Bauchfleck (25–33, 32–41), beige Brustkante (40–42, 22–35).
* Schwanz (x 0–16, y 28–37): läuft nach links unten spitz aus.
* Vier Beine: nahes Hinterbein (x 16–23, bis y 52), fernes Hinterbein (dunkler, violettgrau F/H, x 23–29, bis y 51), nahes Vorderbein (x 31–38, bis y 52), fernes Vorderbein (F/H, x 37–43, bis y 51).
Bleibt fest: Bauchfleck, Scheitelhöcker (starr am Kopf), Füße (außer beim Anheben des ganzen Beins).

Idle-Idee: der Langhals kaut gemächlich und pendelt mit Hals und Schwanz, tritt schwer von einem Bein aufs andere.
Ablauf (72 Frames à 80 ms = 5,76 s), alle Bewegungen unabhängig:
* Hals pendelt (1× je Schleife): der Hals biegt sich spaltenweise (Gefälle ≤ 1 px je Spalte, nichts wird gestreckt), der Kopf (x ≥ 54, samt Unterkiefer) hängt starr an der Halsspitze und wandert 2 px auf und 2 px ab.
* Kauen (zwei Folgen je drei Bisse, Frames 6–23 und 42–59): der Unterkiefer als handgezeichnete Posen offen (Original) → halb → geschlossen → halb → offen; Kiefer starr am Kopf.
* Atmen (2× je Schleife, oben in Frames 4–19 und 40–55): Zeile 40 (Bauchunterkante/Oberschenkel) wird texturiert eingefügt (anim_textur) – der ganze Rumpf samt Hals, Kopf und Schwanz hebt sich 1 px, die Füße bleiben stehen.
* Schwanz pendelt (2× je Schleife): spaltenweise Biegung, Spitze ±2 px, am Becken fest.
* Beine heben (schwer, je 10 Frames 1-1-1-2-2-2-2-1-1-1 px): aus dem glatten Mittelteil des Beins entfallen 1–2 Zeilen, Unterschenkel und Fuß rücken unverändert hoch (nahes Hinterbein ab Frame 2,
  fernes Vorderbein ab 20, nahes Vorderbein ab 38, fernes Hinterbein ab 56).
* Blinzeln (Frames 30–33 und 66–69): beide Augen, Lid in der Hautfarbe (89,80,81).
Offene Kanten an den Biege-Stufen schließt anim_tiere.umriss_schliessen mit der Umrissfarbe des Originals. Nur ganze Pixel, nur Farben der Quelle.
"""
import sys

import numpy as np

import anim_lib as L
import anim_n10 as Z
import anim_textur as TX
import anim_tiere as T
import anim_drache as D

N, MS = 72, 80
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 6, 3

spr = L.lade('gigantisaur-brachion')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

A_, B_, C_, G_, I_, F_, H_, J_, K_ = (22, 10, 12), (45, 28, 32), (43, 31, 33), (89, 80, 81), (105, 92, 99), (79, 65, 81), (101, 83, 96), (145, 121, 98), (189, 154, 120)
UMRISS = [A_, B_, C_]

hals_m = vorhanden & (xx >= 37) & (yy <= 20) | vorhanden & (xx >= 45)
schwanz_m = vorhanden & (xx <= 16) & (yy <= 37) & ~((xx >= 14) & (yy >= 35))
bein_nh, bein_fh = Z.bein_paar(spr, Z.maske_farben(spr, [G_, I_], 16, 43, 23, 52), Z.maske_farben(spr, [F_, H_], 23, 43, 30, 52), UMRISS, 43)
bein_nv, bein_fv = Z.bein_paar(spr, Z.maske_farben(spr, [G_, I_], 31, 43, 38, 52), Z.maske_farben(spr, [F_, H_], 37, 43, 44, 52), UMRISS, 43)
koerper = vorhanden & ~hals_m & ~schwanz_m & ~bein_nh & ~bein_nv & ~bein_fh & ~bein_fv

REGEL = T.umriss_regeln(spr, UMRISS)[2]
ATEM_ZEILE = 40
HUB = [1, 1, 1, 2, 2, 2, 2, 1, 1, 1]
BEIN_START = {'nh': 2, 'fv': 20, 'nv': 38, 'fh': 56}
AUGEN = [(62, 4), (62, 5), (65, 4), (65, 5)]

F = {'C': C_, 'K': K_, 'J': J_}
KIEFER = {
    1: Z.pose_text(['CKKJCC..',
                    '.CCKKKC.',
                    '...CCC..',
                    '........'], 59, 9, F),
    2: Z.pose_text(['CKKKKKKC',
                    '.CCCCCC.',
                    '........',
                    '........'], 59, 9, F),
}
KAU = [1, 2, 2, 1, 0, 0]                         # ein Biss: halb, zu, zu, halb, offen, offen


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def zustand(i):
    atem = 1 if (i % 36) in range(4, 20) else 0
    kau = 0
    for s in (6, 42):
        if 0 <= i - s < 18:
            kau = KAU[(i - s) % 6]
    bl = max(D.blinzeln(i, 30), D.blinzeln(i, 66))
    hals = -2.0 * Z.sinus(i, N)
    schwanz = 2.0 * Z.sinus(i, N / 2, -0.6) + 2.0 * np.sin(0.6)
    return atem, kau, bl, hals, schwanz


def frame(i, nur=None):
    atem, kau, bl, hals, schwanz = zustand(i)
    hl = teil(hals_m)
    if kau:
        Z.setze(hl, KIEFER[kau], PAD_L, PAD_T)
    if bl:
        for x, y in AUGEN:
            hl[PAD_T + y, PAD_L + x, :3] = G_
    dys = Z.biegung(PAD_L + 41, PAD_L + 68, PAD_L + 54, hals, 1.2)
    hl = Z.biegen(hl, dys)
    dys_s = Z.biegung(PAD_L + 16, PAD_L + 0, PAD_L + 0, schwanz, 1.3)
    sw_ = Z.biegen(teil(schwanz_m), dys_s)
    beine = {}
    for name, m, zeile in (('fh', bein_fh, 44), ('fv', bein_fv, 44), ('nh', bein_nh, 44), ('nv', bein_nv, 44)):
        beine[name] = L.heben_unten(teil(m), PAD_T + zeile, Z.hub(i, [BEIN_START[name]], HUB))
    ebenen = {'bein_fh': beine['fh'], 'bein_fv': beine['fv'], 'koerper': teil(koerper), 'schwanz': sw_, 'hals': hl, 'bein_nh': beine['nh'], 'bein_nv': beine['nv']}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])
    ganz = T.umriss_schliessen(ganz, UMRISS, REGEL)
    return TX.streck_zeile(ganz, PAD_T + ATEM_ZEILE, atem)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = Z.zuschneiden([frame(i) for i in range(N)])
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    print('Lücken je Frame (Original %d):' % Z.loecher(spr), sorted({Z.loecher(f) for f in frames}))
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('gigantisaur-brachion', 'Gigantisaur Brachion', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gigantisaur-brachion-strip.png', frames, spalten=12, scale=3)
