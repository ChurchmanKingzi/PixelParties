# -*- coding: utf-8 -*-
"""Idle-Animation für „Taunting Elephant“ (Creature) — kleiner gekrönter Elefant in Seitenansicht; er nickt spöttisch-kichernd mit dem Kopf.

PICK: [["MotiveGrailWar", 205, "Ebene „Taunting Elephant“, linke Figur (Ebenenausschnitt x 0–34; 34×25 px)"]]
Die Ebene enthält ZWEI gekrönte Elefanten. Der rechte (von vorn, roter Umhang, 24×26) ist der Held „Hatusbal“ (liegt so unter pixelpartiessprites/heroes/hatusbal-…/…_L205_taunting-elephant_24x26.png),
der linke (Seitenansicht, 34×25) ist die Creature (…/_nonhero-figures/MotiveGrailWar/MotiveGrailWar_L205_taunting-elephant_34x25.png) → der linke wird verwendet.
Für die Karte gibt es keine Kartenkunst unter data/card-art/native (kein Abgleich möglich). Nicht verwendet: Ebene 206 (halbtransparenter Schatten).

Identifikation (34×25): Rumpf x 0–22 (y 4–18), Hinterbein x 3–9, Vorderbein x 16–22 (y 17–24, helle Zehen), Schwanz an der Kruppe (x 0–1, y 12–18). Ohr x 16–21 (y 0–9),
Gesicht x 23–30 (y 4–12) mit Auge (schwarz x 25–27, y 5–8, weißer Lichtpunkt (26,8)), goldene Krone (x 21–28, y 0–3). Dunkelrotes Maul (x 24–25, y 12–13). Davor ragt schräg nach rechts
unten ein braun umrandetes, hell-orangefarbenes Teil (x 24–33, y 11–16): Stoßzahn (oder herausgestreckte Zunge – unklar) → bleibt starr am Kopf. Dahinter hängt der Rüssel (x 24–30, y 13–19).

Ablauf (64 Frames à 75 ms = 4,8 s). Frame 0 = Original:
* Atmen (Periode 32): Zeile 15 der Rumpf-Ebene wird texturiert gestreckt (TX.streck_zeile), Rücken und Kopf heben sich 1 px, die Füße stehen. Der Kopf geht starr mit.
* Spöttisches Kichern (Frames 34–49): der Kopf (Ohr, Gesicht, Krone, Rüssel, Stoßzahn als EINE starre Einheit) nickt viermal kurz 1 px nach unten. Er wird nur nach unten über den
  Rumpf geschoben (nie nach oben), deshalb entsteht keine Lücke an der Halslinie; Rüssel und Stoßzahn werden nicht verformt.
* Blinzeln (Frames 12–14): Augenpixel → Hautgrau.
* Schwanzspitze zuckt (Frames 4–7 und 56–59): das unterste Umrisspixel der Quaste schwingt 1 px zum Körper.
* Krone (Gold): ein kurzes Sparkle an der mittleren Zacke (Frames 22–26), sonst kein Glanz.
Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n8 as N8

N, MS = 64, 75
sz = N8.Szene('taunting-elephant', (4, 3, 5, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
PL, PT = sz.PL, sz.PT
HAUT, HELL = (124, 112, 112), (255, 246, 172)
GRENZE = {0: 15, 1: 15, 2: 15, 3: 15, 4: 16, 5: 16, 6: 16, 7: 16, 8: 17, 9: 19, 10: 20, 11: 21, 12: 22}          # ab dieser Spalte gehört die Zeile zum Kopf (Halslinie)
M_KOPF = np.zeros(spr.shape[:2], bool)
for y in range(sz.sh):
    M_KOPF[y, GRENZE.get(y, 24):] = True
M_SPITZE = (xx == 0) & (yy == 18)
KOPF = sz.teil(M_KOPF)
SPITZE = sz.teil(M_SPITZE)
RUMPF = sz.teil(~M_KOPF & ~M_SPITZE)
M_AUGE = sz.voll(sz.ist((0, 0, 0), (255, 255, 255)) & (xx >= 25) & (xx <= 27) & (yy >= 5) & (yy <= 8))
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    n = N8.stufe(i, 32, 4, 14)
    nick = 1 if 34 <= i < 50 and (i - 34) % 4 < 2 else 0
    rumpf = TX.streck_zeile(RUMPF, PT + 15, n)
    kopf = KOPF
    if 12 <= i <= 14:
        kopf = KOPF.copy(); kopf[M_AUGE, :3] = HAUT
    zuck = 1 if (4 <= i <= 7 or 56 <= i <= 59) else 0
    eb = [(SPITZE, zuck, 0), (rumpf, 0, 0), (kopf, 0, nick - n)]
    f = L.zusammen(sz.H, sz.W, eb)
    st = N8.funkel_folge(i, N, 22, (1, 2, 2, 1))
    if st and not nur:
        N8.funkel(f, PL + 25, PT + 0 + nick - n, st, HELL)
    return f


if __name__ == '__main__':
    N8.fertig('taunting-elephant', 'Taunting Elephant', frame, N, MS, spr, check=[0, 5, 10, 13, 23, 34, 36], zoom=12, spalten=4)
