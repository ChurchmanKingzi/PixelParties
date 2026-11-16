# -*- coding: utf-8 -*-
"""Idle-Animation für „Foresta, the Guard“ (Creature) — steinerner Saurier-Wächter mit bewachsenem Rücken; er steht schwer atmend Wache, der Gliederschwanz pendelt, Blätter fallen.

PICK: [["MotiveGrailWar", 556, "Ebene „Foresta“ (74×51 px, ganze Figur)"]]
Nicht verwendet: Ebene 557 (halbtransparenter Bodenschatten), 555/554 (andere Karten). Abgleich mit data/card-art/native/Foresta_the_Guard.png: gleiche Figur (Karte schneidet den Schwanz rechts ab).

Identifikation (74×51): Steinkopf (x 0–20, y 0–19) mit zwei Augen (grüne Iris x 3–4 und 9–10, y 5–7, heller Augenrand), offenes Maul mit hellen Zähnen (oben y 11–13, unten y 14–16;
das Maulinnere ist in der Quelle durchsichtig und bleibt so). Rücken: sandfarbener Kragen/Panzer (x 20–50, y 5–20), darauf Blattbüschel (grün, x 22–52, y 0–19).
Steinrumpf (x 20–48, y 15–30), zwei Hakenarme links (x 7–25, y 19–45), zwei Beine (x 25–45, y 28–43) mit Steinfüßen (y 43–50). Gliederschwanz nach rechts (x 48–73, y 19–30,
Steinglieder), am Schwanzende ein kleiner Spross (Blätter x 68–72, y 18–21, sandfarbener Ansatz y 22–24) und ein Stachel nach unten (x 68–70, y 28–35).
Kein Glanz (Stein/Blätter).

Ablauf (72 Frames à 80 ms = 5,8 s, schweres Wesen → langsam). Frame 0 = Original:
* Atmen/Stand (Periode 36): in den Beinen (Zeile 34, nur Bein-Ebene) wird eine texturierte Zeile eingefügt (TX.streck_zeile); Kopf, Rumpf, Arme, Rücken und Schwanz heben sich starr 1 px,
  die Füße stehen. Arme und Schwanz werden nicht gestreckt.
* Schwanz pendelt (Periode 72): die Glieder gehen starr in zwei Stufen mit (x ≥ 58: 1 px, Endglied x ≥ 66 samt Spross und Stachel: 2 px) auf und ab; Stufen an Gliedgrenzen (Umrissspalten).
* Spross am Schwanzende wippt: die beiden obersten Blattzeilen 1 px zur Seite (Periode 24, nur zeitweise).
* Blinzeln (Frames 20–22 und 56–58): Iris → Steinfarbe des Lids.
* Maul schließen/öffnen (Runde 8): der Unterkiefer (x 2–14, y 14–19) ist eine eigene Ebene HINTER dem Oberkiefer. Pose „zu“: vorn (x ≤ 11) 2 px hoch, hinten (x 12–13) 1 px,
  Gelenk (x 14) fest; die unteren Zähne (ungerade x) greifen in die Lücken der oberen (gerade x). Im geschlossenen Zustand werden die verbleibenden Zahnlücken (x 3–14, y 12–14)
  zu dunklen Fugen in der Umrissfarbe – kein Hintergrund zwischen den Zähnen. Ablauf: Frames 8–39 langsam zu und wieder auf (12–35 geschlossen), danach viermal kurzes Schnappen.
* Arme (Runde 8): beide Hakenarme ab dem Ellbogen (y ≥ 26/27, links vom Rumpf) heben sich als EINE starre Einheit vor dem Oberarm/Rumpf um 1–2 px und senken sich wieder
  (Periode 36, in der Ausatem-Phase: Frames 24–35 und 60–71) – nichts wird gestreckt, es wird nichts freigelegt (darunter liegt nur Hintergrund bzw. der überlappte Oberarm).
* Zwei 2×2-Blätter (Grüntöne der Büsche) lösen sich nacheinander vom Rücken und trudeln zu Boden.
Ergänzungen: keine. An den Schwanzstufen freiliegende Innenpixel bekommen die Umrissfarbe (41,32,25).
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n8 as N8

N, MS = 72, 80
sz = N8.Szene('foresta-the-guard', (3, 3, 4, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
PL, PT = sz.PL, sz.PT
UMRISS, STEIN = (41, 32, 25), (133, 127, 111)
GRUEN1, GRUEN2 = (163, 183, 130), (99, 111, 71)
M_BEIN = ((yy >= 31) & (yy <= 42) & (xx >= 24)) | ((yy >= 43) & (xx >= 19))
M_SCHWANZ = (xx >= 53) | ((xx >= 49) & (yy >= 20))
M_SPROSS = (xx >= 66) & (yy <= 19)
BEIN = sz.teil(M_BEIN)
SCHWANZ = sz.teil(M_SCHWANZ & ~M_SPROSS)
SPROSS = sz.teil(M_SPROSS)
# Runde 8: Unterkiefer und Arme als eigene Posen-Ebenen
M_KIEFER = (xx <= 13) & (yy >= 14) & (yy <= 19) & (xx >= 2)
M_KIEFER |= (xx == 14) & (yy >= 15) & (yy <= 18)
M_ARM = ((yy == 26) & (xx >= 13) & (xx <= 14)) | ((yy >= 27) & (yy <= 31) & (xx <= 17)) | ((yy >= 32) & (yy <= 45) & (xx <= 19)) | ((yy >= 34) & (yy <= 42) & (xx <= 21))
KIEFER = sz.teil(M_KIEFER)
ARM = sz.teil(M_ARM & ~M_BEIN)
OBEN = sz.teil(~M_BEIN & ~M_SCHWANZ & ~M_KIEFER & ~M_ARM)
ZAHN = (209, 198, 178)
#          0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35
MAUL_F = (0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 1, 2, 2, 1, 0)      # Kiefer-Hub je Bild (Periode 72: erste Hälfte lang zu, zweite Hälfte zweimal schnappen)
ARM_F = (0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)       # Arme heben (Periode 36)


def kiefer(k):
    """Unterkiefer-Pose: vorn (x ≤ 11) k px hoch, hinten (x 12–13) höchstens 1 px, Gelenk (x 14) fest – starre Stufen, nichts gestreckt."""
    if not k:
        return KIEFER
    return N8.spalten_versatz(KIEFER, lambda x: -(k if x - PL <= 11 else (1 if x - PL <= 13 else 0)))
M_IRIS = sz.voll(sz.ist((170, 187, 151), (93, 96, 65), (131, 136, 106), (60, 63, 32)) & (yy >= 5) & (yy <= 7) & (xx <= 11))
RAND_FARBEN = [UMRISS, (39, 54, 15), (68, 44, 20), (209, 198, 178), (192, 162, 124)]
TEST_EBENEN = ('figur',)
BLATT = [dict(x=PL + 50, y=PT + 15, weg=31, off=-6, wackeln=2, schw=2, leben=30),
         dict(x=PL + 53, y=PT + 16, weg=30, off=-41, wackeln=-2, schw=2, leben=30)]


def schwanz_dy(a):
    def f(x):
        xs = x - PL
        w = 1.0 if xs >= 66 else (0.5 if xs >= 58 else 0.0)
        v = int(abs(a) * w + 0.01)
        return v if a > 0 else -v
    return f


def blaetter(i):
    e = L.leer(sz.H, sz.W)
    for b, farbe in zip(BLATT, (GRUEN1, GRUEN2)):
        k = i + b['off']
        if 0 <= k < b['leben']:
            e2 = N8.blasen(sz.H, sz.W, k, b['leben'], [dict(b, off=0)], farbe)
            e[e2[..., 3] > 0] = e2[e2[..., 3] > 0]
    return e


def frame(i, nur=None):
    n = N8.stufe(i, 36, 8, 16)
    a = N8.sinus_px(i, 72, 2)
    bein = TX.streck_zeile(BEIN, PT + 34, n)
    oben = OBEN
    if 20 <= i <= 22 or 56 <= i <= 58:
        oben = OBEN.copy(); oben[M_IRIS, :3] = STEIN
    f = schwanz_dy(a)
    spross = SPROSS
    if N8.stufe(i, 24, 10, 6) and i < 48:
        spross = N8.zeilen_versatz(SPROSS, {PT + 18: 1, PT + 19: 1})
    schwanz = L.zusammen(sz.H, sz.W, [(N8.spalten_versatz(SCHWANZ, f), 0, 0), (N8.spalten_versatz(spross, f), 0, 0)])
    mk = MAUL_F[(i // 2) % 36] if i < 40 else MAUL_F[20 + (i - 40) % 16] if i < 72 else 0
    ak = ARM_F[(i - 16) % 36]                      # Arme heben sich in der Ausatem-Phase (nicht gleichzeitig mit dem Atemhub)
    kopf = L.zusammen(sz.H, sz.W, [(kiefer(mk), 0, 0), (oben, 0, 0), (ARM, 0, -ak)])      # Kiefer HINTER den oberen Zähnen, Arme VOR dem Körper
    if mk == 2:                                      # Maul zu: verbliebene Zahnlücken sind dunkle Fugen (kein Hintergrund zwischen den Zähnen)
        luecke = ~(kopf[..., 3] > 0) & sz.voll((xx >= 3) & (xx <= 14) & (yy >= 12) & (yy <= 14))
        kopf[luecke] = UMRISS + (255,)
    figur = L.zusammen(sz.H, sz.W, [(bein, 0, 0), (schwanz, 0, -n), (kopf, 0, -n)])
    figur = N8.kontur_schliessen(figur, RAND_FARBEN, UMRISS, maske=sz.voll((xx >= 50) & (yy >= 16)))
    if nur:
        return figur
    return L.zusammen(sz.H, sz.W, [(figur, 0, 0), (blaetter(i), 0, 0)])


if __name__ == '__main__':
    N8.fertig('foresta-the-guard', 'Foresta, the Guard', frame, N, MS, spr, check=[0, 12, 21, 30, 47, 60], zoom=6, spalten=3)
