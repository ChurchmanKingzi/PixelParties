# -*- coding: utf-8 -*-
"""Idle-Animation für „Fun-Fun Circus Director“ (Creature) — der rote Zirkusdirektor-Dämon: Zylinder mit roter Hutband, geschwungene Hörner, rotes Gesicht hinter einer Totenkopfmaske, roter Frack, weiße Fliege, schwarze Hose.

Quelle: src/fun-fun-circus-director.png (16×30 px; Komposit, seit Runde 3 mit KORREKTER Transparenz, siehe unten) und die Einzelebenen src/fun-fun-circus-director-L26/L27/L28/L29.png (gleiches Raster).
PICK: [["MotiveMoe", 26, 1], ["MotiveMoe", 27, 1], ["MotiveMoe", 28, 1], ["MotiveMoe", 29, 1]]
  Ebenen der Datei MotiveMoe (niedriger Index = oben): 26 „Fun-Fun Director #2“ = Zylinder; 27 „#3“ = schwarzer Schatten der Hutkrempe im Gesicht; 28 „#1“ = Totenkopfmaske; 29 „Fun-Fun Director“ = Körper
  (Hörner, Kopf, Frack, Hose). Nur Ebene 26 kam aus der Treffersuche („Fun-Fun Director #2“, 100 %), die anderen drei aus den Nachbarebenen (Regel 20). Karte: Fun_Fun_Circus_Director.png (Figur bei (30,16), 94,8 % wegen des roten Glühens der Kunst).
  Die übrigen Ebenen (30–33: Bühne/Vorhang/Clown-Porträt/Blutmuster) sind Kulisse.

RUNDE 3 (Nutzer: „Director sieht nicht korrekt aus, da fehlt eine Ebene oder ist eine Ebene zu viel oder eine Transparenz falsch“): Die Ebene 27 „Fun-Fun Director #3“ (Hutschatten im Gesicht) hat in der xcf nur 50 % Deckkraft (op 127), wurde aber
  bisher voll schwarz eingerechnet (Gesicht/Maske unter der Krempe wirkten schwarz verhangen). Abgleich gegen die Karte Fun_Fun_Circus_Director.png an (30,16): mit 100 % stimmen 94,8 % der Pixel, mit 50 % alle (mittlerer Fehler 4,5). Das Skript setzt den Sprite jetzt selbst
  aus den vier Ebenen zusammen (`komposit()`): Körper 29, Maske 28, Schatten 27 (schwarz zu 50 % über Maske/Körper, vorgemischt: (unter + schwarz)/2, ganze Pixel, kein Alpha), Zylinder 26; Reihenfolge und Vollständigkeit der Ebenen stimmen mit der Karte überein
  (keine Ebene fehlt, keine ist zu viel). Neue Mischfarben (32,33,32), (79,79,79), (110,110,110), (128,128,128) = Maskenfarben zu 50 % abgedunkelt. src/fun-fun-circus-director.png wurde mit diesem Komposit neu geschrieben.

Aufruf:   python3 fun_fun_circus_director.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/fun-fun-circus-director.png + .json

Was im Sprite ist (x, y im 16×30-Sprite):
* ZYLINDER (Ebene 26, x 0–15, y 0–11): schwarzer Hut (x 4–11) mit dunklen Grautönen, breites Hutband in Rot (y 8–9; drei Rotstufen (130,5,1)/(205,1,0)/(255,64,62)), Krempe (y 10–11).
* HÖRNER (Ebene 29, x 0–5 und 10–15, y 3–9): zwei geschwungene Hörner in Graugrün (118,129,113)/(160,172,160)/(70,70,58), hinter dem Hut, am Kopf angewachsen.
* KOPF (Ebene 29, x 4–11, y 8–16): rotes Gesicht (124,25,19), weiße Augen, kleine goldene Zahnspitzen (217,169,87) bei (4,16)/(11,16) und (5,17)/(10,17) (Gold!); darüber der SCHATTEN der Krempe (Ebene 27, y 12–13) und die TOTENKOPFMASKE (Ebene 28, x 4–11, y 10–19: grau/weiß/schwarz mit weißem Gebiss).
* FRACK (Ebene 29, y 17–26): schwarzer Rock, leuchtend roter Kragen/Ärmel (130,0,0)/(226,1,5): linker Ärmel x 2–4, rechter x 11–13 (y 18–23), weiße Fliege/Hemd (249,249,251) (x 6–9, y 18–23).
* HOSE/STIEFEL (y 24–29): schwarz mit grauen Lichtern.
Gold: nur die zwei Paar Zahnspitzen → ein kurzes Funkeln (Regel 14); Stoff, Hut, Horn, Maske glänzen nicht. Hörner/Maske/Gesicht bleiben fest (Regel 1/21: nicht geraten). Keine Partikel, kein Feuer.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos):
* ATMEN (Periode 16, drei Atemzüge je Schleife): die Hosenzeile 26 wird einmal eingefügt: Körper, Kopf, Maske, Hörner, Hut steigen 1 px, Stiefel bleiben.
* VERBEUGUNG (Runde 4, Frames 6–25, siehe BOGEN): Die Kopfgruppe (Zylinder, Hörner, Gesicht, Maske, Krempenschatten) ist EIN starrer Block — der Zylinder bewegt sich nie mehr unabhängig vom Kopf (das frühere Hutlüpfen ist entfernt).
  Der Block neigt sich in sauberen Stufen 1 → 2 → 3 px nach vorn/unten über die Brust, zuletzt sinken die Schultern 1 px (Rumpfzeile 23 entfällt); die HAND vor der Brust (weiß (8–9,21), grau (8–9,22) — Nutzer: das ist seine Hand,
  er verbeugt sich theatralisch) geht starr mit dem Rumpf mit und bleibt sichtbar. Halten (Frames 11–20), dann aufrichten (Schultern zuerst). Nichts wird gestreckt oder verschmiert, nur ganze Blöcke verschoben.
* ÄRMEL: beide Frackärmel pendeln nach der Verbeugung kurz einwärts (starre Zeilenverschiebung der Ärmel-Enden um 1 px; links Frames 34–43, rechts 38–45).
* FUNKELN: die goldenen Zahnspitzen links blitzen weiß (Frames 30–31 und 44–45), rechts (Frames 40–41 und 3–4).
Frame 0 = Original (Ruhepose). Ergänzungen: keine (der Kopfblock liegt vor dem Rumpf und deckt ihn in jeder Pose).
"""
import sys

import numpy as np
from PIL import Image

import anim_humanoide as Hm
import anim_lib as L
import anim_schach as Sc

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 5, 2

def lade_ebene(n):
    return np.array(Image.open(L.SRC + f'/fun-fun-circus-director-L{n}.png').convert('RGBA'))


E26, E27_ROH, E28, E29 = (lade_ebene(n) for n in (26, 27, 28, 29))


def schatten_gemischt(unter):
    """Die Schattenebene (Ebene 27) hat in der xcf nur 50 % Deckkraft (op 127): schwarz zu 50 % über der Maske (Ebene 28) bzw. dem Körper (Ebene 29). Vorgemischt (ganze Pixel,
    kein Alpha im Sprite): je Schattenpixel (unter + schwarz) / 2. Gegenprobe gegen die Karte Fun_Fun_Circus_Director.png (Figur bei (30,16)): mit 50 % stimmen alle Pixel (mittlerer Fehler 4,5), mit 100 % nur 94,8 %."""
    out = E27_ROH.copy()
    for y, x in zip(*np.nonzero(E27_ROH[..., 3])):
        u = unter[y, x, :3].astype(int)
        out[y, x, :3] = (u * (255 - 127) + E27_ROH[y, x, :3].astype(int) * 127 + 127) // 255
    return out


def komposit():
    """Sprite = Körper (29) + Maske (28) + 50-%-Schatten (27, vorgemischt) + Zylinder (26)."""
    f = np.zeros_like(E29)
    for a in (E29, E28):
        m = a[..., 3] > 0
        f[m] = a[m]
    unter = f.copy()
    sch = schatten_gemischt(unter)
    m = sch[..., 3] > 0
    f[m] = sch[m]
    m = E26[..., 3] > 0
    f[m] = E26[m]
    return f


E27 = schatten_gemischt(np.where((E28[..., 3] > 0)[..., None], E28, E29))
spr = komposit()
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
v29 = L.deckend(E29)
ARM_L = v29 & (xx <= 4) & (yy >= 18)
ARM_R = v29 & (xx >= 11) & (yy >= 18)
KOERPER = v29 & ~ARM_L & ~ARM_R
KOPF = KOERPER & ((yy <= 16) | ((yy == 17) & (xx >= 5) & (xx <= 10)))      # Hörner, Ohren, Gesicht, Kinn
RUMPF = KOERPER & ~KOPF
GOLD = L.farbmaske(E29, [(217, 169, 87)]) & v29
GOLD_L = GOLD & (xx <= 7)
GOLD_R = GOLD & (xx >= 8)
WEISS = (249, 249, 251)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (3, 3, 1)


def eb(a, m=None, dy=0):
    t = a if m is None else L.trenne(a, m)[0]
    return L.platz(t, H, W, OFF[0], OFF[1] + dy)


# Runde 4 — VERBEUGUNG: je Frame (Kopf-Senkung dh, Schulter-Senkung dt) in ganzen Pixeln. Kopfgruppe = Zylinder + Hörner + Gesicht + Maske + Krempenschatten, IMMER starr als ein Block
# (der Zylinder bewegt sich nie unabhängig vom Kopf). Abwärts: Kopf neigt sich vor/unten über die Brust (1 → 2 → 3 px), zuletzt sinken die Schultern 1 px (Rumpfzeile 23 entfällt, der Oberkörper wird
# von vorn gesehen kürzer); die Hand vor der Brust (weiß (8–9,21), grau (8–9,22)) geht mit dem Rumpf mit. Unten hält er die Pose (die Hand bleibt sichtbar), dann richtet er sich auf (Schultern zuerst).
BOGEN = {6: (1, 0), 7: (1, 0), 8: (2, 0), 9: (2, 0), 10: (3, 0), 11: (3, 1), 12: (3, 1), 13: (3, 1), 14: (3, 1), 15: (3, 1), 16: (3, 1), 17: (3, 1), 18: (3, 1), 19: (3, 1), 20: (3, 1),
         21: (3, 0), 22: (2, 0), 23: (2, 0), 24: (1, 0), 25: (1, 0)}


def frame(i, nur=None):
    hub = Hm.stufe(i, 16, 1)
    dh, dt = BOGEN.get(i % N, (0, 0))
    # Rumpf (ohne Kopf): Atmen über die Hosenzeile 26
    kb = Hm.atmen(eb(E29, RUMPF), OFF[1] + 26, OFF[1] + 12, hub, 0)
    # Ärmel: Enden (y 21–24) pendeln einwärts
    al, ar = eb(E29, ARM_L), eb(E29, ARM_R)
    if Hm.folge(i, 34, [1] * 10, N):
        Hm.zeilen_versatz(al, OFF, {y: 1 for y in (21, 22, 23, 24)})
    if Hm.folge(i, 38, [1] * 8, N):
        Hm.zeilen_versatz(ar, OFF, {y: -1 for y in (21, 22, 23, 24)})
    al, ar = L.versetze(al, 0, -hub), L.versetze(ar, 0, -hub)
    rumpf = L.zusammen(H, W, [(kb, 0, 0), (al, 0, 0), (ar, 0, 0)])
    if dt:
        rumpf = L.streck_zeile(rumpf, OFF[1] + 23 - hub, -dt)          # Zeile 23 entfällt: Schultern, Arme und die Hand vor der Brust sinken starr um 1 px
    # Kopfgruppe: ein starrer Block
    kopf = eb(E29, KOPF)
    for s_, m in ([] if nur else ((30, GOLD_L), (40, GOLD_R), (3, GOLD_R), (44, GOLD_L))):
        if Hm.folge(i, s_, [1, 1], N):
            for y, x in zip(*np.nonzero(m)):
                kopf[y + OFF[1], x + OFF[0], :3] = WEISS
    block = L.zusammen(H, W, [(kopf, 0, 0), (eb(E28), 0, 0), (eb(E27), 0, 0), (eb(E26), 0, 0)])
    return L.zusammen(H, W, [(rumpf, 0, 0), (L.versetze(block, 0, dh - hub), 0, 0)])


TEST_EBENEN = ('koerper',)          # Randpixel-Test (randtest.py) ohne das Gold-Funkeln
FREIGELEGT = []

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('fun_fun_circus_director', 'Fun-Fun Circus Director', frames, MS, prev, spr, OFF, erlaubt=FREIGELEGT)
