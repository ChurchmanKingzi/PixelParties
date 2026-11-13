# -*- coding: utf-8 -*-
"""Idle-Animation für „Cavalry“ (Creature) — Lanzenreiterin auf braunem Pferd, wartet auf den Angriffsbefehl: das Pferd scharrt mit dem Huf und schlägt mit dem Schweif.

PICK: [["MotiveDeri", 162, "Ebene „Cavalry“, oberste Reiterin (zusammenhängende Figur bei x 32–65, y 4–33); sie ist die einzige der sieben, die keine andere berührt/überdeckt"]]
Abgleich mit data/card-art/native/Cavalry.png (Reitergruppe gegen Speerreihe; die Speerträger rechts und die übrigen Reiter sind nicht Teil des Sprites). Quelle vollständig.

Identifikation (34×30): Reiterin im Profil nach rechts, langes schwarzes Haar (x 8–18, y 0–10), Gesicht (x 13–16, y 4–9), EIN Auge (hellblau (14,6), weiß (14,7)),
dunkle Rüstung (x 9–17, y 9–20), Stiefel mit hellem Steigbügel (15,19). Lanze waagerecht (Schaft y 14, x 7–25; Eisenspitze x 24–33, y 12–16; Metallfuß x 3–8, y 13–15) mit
weißem Wimpel am Lanzenende (x 0–9, y 9–15, dunkelgrüner Umriss). Pferd: Kopf mit Zaumzeug (x 18–25, y 7–15), Ohr ((20,7), (19–22,8)), Rumpf (y 16–23), Schweif (dunkel, x 3–5,
y 20–28), Hinterbein (x 7–9, y 24–29), Vorderbein (x 16–18, y 24–29, grauer Huf (17,28)), abgewandtes Vorderbein (x 20–22, y 24–28). Kopf der Reiterin bleibt fest zum Körper.

Ablauf (60 Frames à 75 ms = 4,5 s). Frame 0 = Original:
* Pferd atmet (Periode 30): Ross und Reiterin heben sich als Ganzes 1 px (texturierte Zeile in den Beinen bei y 25, TX.streck_zeile) – Hufe bleiben am Boden.
* Scharren: das Vorderbein hebt den Huf zweimal kurz 1–2 px (Bein wird kürzer, L.heben_unten; Frames 36–45).
* Schweif schlägt nach links aus (Zeilenversatz 1–2 px ab y 25, Frames 20–26 und 50–54).
* Wimpel flattert (die äußeren Spalten x ≤ 2 gehen 1 px hoch/runter, Periode 10) – die Lanze selbst bleibt starr.
* Ohrzucken (Frames 14–15, 44–45), Blinzeln (Frames 5–6).
Ergänzungen: keine dauerhaften; beim Ohrzucken wird (20,8) zur Umrissfarbe (49,24,0); hängt der Wimpel 1 px tiefer, bleibt die Umrissecke (2,12) (dunkelgrün) stehen.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n9 as N9

N, MS = 60, 75
sz = N9.Szene('cavalry', (4, 3, 4, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
SCHWEIF_M = (xx >= 4) & (xx <= 5) & (yy >= 24) & sz.da
BEIN_M = (xx >= 16) & (xx <= 18) & (yy >= 24) & sz.da
WIMPEL_M = (xx <= 2) & (yy >= 9) & (yy <= 15) & sz.da
REST_M = sz.da & ~SCHWEIF_M & ~BEIN_M & ~WIMPEL_M
SCHWEIF, BEIN, WIMPEL, REST = sz.teil(SCHWEIF_M), sz.teil(BEIN_M), sz.teil(WIMPEL_M), sz.teil(REST_M)
UMRISS, HAUT = (49, 24, 0), (246, 189, 123)
FLATTER = (0, 0, -1, -1, -1, 0, 0, 1, 1, 1)
TEST_EBENEN = ('figur',)


def schweif(st):
    if not st:
        return SCHWEIF
    out = L.leer(sz.H, sz.W)
    for y in range(24, 29):
        dx = 0
        if st == 1 and y >= 26:
            dx = -1
        if st == 2:
            dx = -2 if y >= 27 else (-1 if y >= 25 else 0)
        out[sz.PT + y] = np.roll(SCHWEIF[sz.PT + y], dx, axis=0)
    return out


def frame(i, nur=None):
    n = N9.stufe(i, 30, 8, 14)
    huf = N9.huelle(i, N, 36, (1, 2, 2, 1, 0, 0, 1, 2, 1))
    sw = N9.huelle(i, N, 20, (1, 1, 2, 2, 2, 1, 1)) or N9.huelle(i, N, 50, (1, 1, 2, 1, 1))
    r = REST.copy()
    px = lambda x, y, c: r.__setitem__((sz.PT + y, sz.PL + x), tuple(c) + (255,))
    if i in (14, 15, 44, 45):
        r[sz.PT + 7, sz.PL + 20] = 0; px(20, 8, UMRISS)
    if i in (5, 6):
        px(14, 6, HAUT); px(15, 6, HAUT); px(14, 7, (0, 0, 0)); px(15, 7, (0, 0, 0))
    bein = L.heben_unten(BEIN, sz.PT + 26, huf)
    fl = FLATTER[i % 10]
    if fl > 0:                                       # Wimpel unten: die Umrissecke (2,12) bleibt stehen, sonst läge (3,12) weiß am Rand
        px(2, 12, (2, 25, 3))
    f = L.zusammen(sz.H, sz.W, [(schweif(sw), 0, 0), (r, 0, 0), (bein, 0, 0), (WIMPEL, 0, fl)])
    return TX.streck_zeile(f, sz.PT + 25, n)


if __name__ == '__main__':
    N9.fertig('cavalry', 'Cavalry', frame, N, MS, spr, check=[0, 3, 8, 14, 22, 37, 38, 5], zoom=12, )
