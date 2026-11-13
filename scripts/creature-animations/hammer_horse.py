# -*- coding: utf-8 -*-
"""Idle-Animation für „Hammer Horse“ (Creature) — schwarzes Pferd, dessen Kopf ein Hammer ist; es hebt den Hammerkopf und schlägt ihn zweimal auf den Boden.

PICK: [["MotiveDeri", 61, "Ebene „Hammer Horse“: Pferd ohne die schwarzen Risslinien (32×22 px)"]]
Die Ebene (50×48) enthält außer dem Pferd die Risse im Boden (reines Schwarz (0,0,0), rechts und unter der Figur) – Beiwerk der Szene, beim Ausschneiden entfernt (alle (0,0,0)-Pixel außer
der Pupille x 26–27, y 11–12). Für die Karte gibt es keine Kartenkunst unter data/card-art/native (kein Abgleich möglich); die Ebene trägt den Kartennamen.

Identifikation (32×22): schwarzer Pferderumpf x 1–21 (y 7–13, graue Lichter), vier Beine (x 3–5, 8–10, 15–17, 18–20; y 13–21, helle Hufpixel), Schweif links (x 0–2, y 11–18, Umrissfarbe).
Hals (x 20–22, y 9–12) geht in den Kopf über. Der Kopf ist ein senkrecht stehender Hammer (x 20–31, y 0–21): oben die helle, spitze Stirn/Mähne (y 0–8), darunter das Auge
(weiß-türkis x 26–27, y 9–10, schwarze Pupille y 11–12), der gestreifte Nasenrücken (y 13–19) und unten die breite Schlagfläche (x 22–31, y 19–21), die auf dem Boden steht.
Kein Glanz (dunkles Tier, Stein/Eisen unklar → weggelassen).

Ablauf (64 Frames à 70 ms = 4,5 s). Frame 0 = Original:
* Hammerschlag, zweimal je Schleife (Frames 26–39 und 42–53): der Hammerkopf hebt sich als starre Einheit in Stufen um 3 px (beim zweiten Mal 2 px), verharrt kurz und fährt in einem
  Bild auf den Boden zurück. Er bleibt am Hals angewachsen (Hals bleibt am Rumpf; frei werdende Innenpixel an der Halsnaht bekommen die Hammer-Umrissfarbe). Beim Aufschlag springen links
  und rechts der Schlagfläche 2×2-Steinkrümel (Grautöne der Quelle) weg; der Rumpf sackt beim Aufschlag nicht ein (Hufe bleiben am Boden).
* Atmen (Periode 32, nur Rumpf-Ebene): Zeile 12 wird texturiert gestreckt (TX.streck_zeile), der Rücken hebt sich 1 px; Beine und Hammer bleiben stehen.
* Schweif pendelt: die unteren drei Zeilen 1 px zum Körper hin (Periode 16, nicht während des Schlags).
* Blinzeln (Frames 8–10): das Lid (Kopffarbe (61,71,70)) schließt sich von oben über die hellen Augenpixel.
Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n8 as N8

N, MS = 64, 70
sz = N8.Szene('hammer-horse', (5, 10, 5, 3))
spr = sz.spr
xx, yy = sz.xx, sz.yy
PL, PT = sz.PL, sz.PT
KONTUR_H, LID = (34, 42, 44), (61, 71, 70)
KRUEMEL1, KRUEMEL2 = (70, 70, 70), (89, 94, 100)
M_HAMMER = (xx >= 23) | ((xx == 22) & (yy >= 19)) | ((xx >= 20) & (yy <= 3))
M_SCHWEIF = (xx <= 0) & (yy >= 16)
HAMMER = sz.teil(M_HAMMER)
SCHWEIF = sz.teil(M_SCHWEIF)
RUMPF = sz.teil(~M_HAMMER & ~M_SCHWEIF)
RAND = [(5, 5, 5), KONTUR_H]
TEST_EBENEN = ('figur',)
HUB = {26: 1, 27: 1, 28: 2, 29: 2, 30: 3, 31: 3, 32: 3, 33: 3, 34: 3, 35: 3, 36: 3, 37: 1,
       42: 1, 43: 1, 44: 2, 45: 2, 46: 2, 47: 2, 48: 2, 49: 2, 50: 1}
SCHLAG = (38, 51)                                           # Frames, in denen der Hammer aufschlägt
KRUEMEL = []
for s0 in SCHLAG:
    KRUEMEL += [dict(x=PL + 20, y=PT + 19, dx=-4, dy=-5, fall=6, leben=7, periode=N, off=s0, farbe=KRUEMEL1),
                dict(x=PL + 33, y=PT + 19, dx=4, dy=-6, fall=7, leben=8, periode=N, off=s0, farbe=KRUEMEL2),
                dict(x=PL + 32, y=PT + 20, dx=2, dy=-3, fall=3, leben=6, periode=N, off=s0 + 1, farbe=KRUEMEL1)]


def frame(i, nur=None):
    k = HUB.get(i, 0)
    n = N8.stufe(i, 32, 2, 14)
    rumpf = TX.streck_zeile(RUMPF, PT + 12, n)
    hammer = HAMMER
    if 8 <= i <= 10:
        hammer = HAMMER.copy()
        for y in ((9,), (9, 10), (9,))[i - 8]:
            hammer[PT + y, PL + 26:PL + 28, :3] = LID
    pendel = 1 if (i < 24 or i >= 56) and (i % 16) >= 8 else 0
    f = L.zusammen(sz.H, sz.W, [(SCHWEIF, pendel, 0), (rumpf, 0, 0), (hammer, 0, -k)])
    if k:
        f = N8.kontur_schliessen(f, RAND, KONTUR_H, maske=sz.voll((xx >= 22) & (xx <= 24) & (yy <= 14)))
    if not nur:
        f = L.zusammen(sz.H, sz.W, [(f, 0, 0), (N8.koerner(sz.H, sz.W, i, KRUEMEL), 0, 0)])
    return f


if __name__ == '__main__':
    N8.fertig('hammer-horse', 'Hammer Horse', frame, N, MS, spr, check=[0, 9, 12, 28, 33, 38, 40, 47], zoom=12, spalten=4)
