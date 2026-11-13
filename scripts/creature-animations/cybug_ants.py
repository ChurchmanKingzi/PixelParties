# -*- coding: utf-8 -*-
"""Idle-Animation für „Cybug ANTS“ (Creature) — Trupp gepanzerter Cyber-Ameisen mit Geschützen: sie treten auf der Stelle (Beine heben, vorsetzen, zurückziehen),
die Fühler zucken, die roten Augen pulsieren, ein kurzer Glanz läuft über die Geschützrohre.

PICK: [["MotiveEgypt", 142, "ganze Ebene 113×19: drei vollständige, identische Ameisen im 38-px-Raster (die Kartenkunst zeigt denselben Trupp, links/rechts angeschnitten)"]]
Abgleich mit data/card-art/native/Cybug_ANTS.png und der Motiv-Maske (src nennt Ebene 142). Die vom Nutzer genannte „Ebene #73“ ist im Dump als Index 73 ein
8×14-Kleinteil – gemeint ist offenbar der Ebenenname; die Ameisen liegen auf Index 142. Die Ebene enthält DREI Ameisen (nicht vier); alle drei verwendet.

Identifikation (je Ameise, 37 px breit, Koordinaten der ersten): rostrote Fühler (x 8–15, y 1–4), Kopf (x 10–14, y 3–6) mit zwei roten Augen (10,6), (13,6)
(Hellrot (255,0,0), darüber Dunkelrot), zwei Geschützrohre nach links (x 0–13, y 5–11), Geschützturm nach rechts (zwei Kästen x 23–36, y 1–10, der Punkt (27,0)
ist die Turmspitze), karierter Metallleib (x 14–27, y 5–15) mit braunen Gelenken, zwei Beine: Stiel (3 px breit, y 15–16) und Kreuzfuß (5 px, y 17–18). Die drei Ameisen
unterscheiden sich in der Ebene nur in der Beinstellung (Stiel/Fuß um −1…+2 px versetzt) – diese Grundstellungen bleiben erhalten.

Ablauf (48 Frames à 70 ms = 3,4 s). Frame 0 = Original:
* Marschtritt auf der Stelle (je Bein 8 Phasen à 3 Frames): Fuß hebt sich 1 px (der Stiel verkürzt sich um seine untere Zeile) → schwingt 1 px nach vorn (links) →
  setzt auf → zieht zurück. Vorder- und Hinterbein einer Ameise im Gegentakt, die mittlere Ameise um einen halben Zyklus versetzt. Der Stiel-Ansatz bleibt am Leib.
* Fühler: die obere Fühlerhälfte (Zeilen 1–2) zuckt 1 px nach vorn (je Ameise versetzt, 3 Frames).
* Augen: das Hellrot dimmt kurz auf das Dunkelrot der Quelle (2 Frames, je Ameise versetzt) – nur in den Augenpixeln.
* Geschütz: kurzes Sparkle (Punkt → Kreuz → Punkt, 4 Frames) an einer Rohrkante je Ameise, nacheinander – Metall.
Bewusst fest: Leib und Geschütze (starr, kein Hub – die Rohre bleiben ruhig im Anschlag).
"""
import numpy as np

import anim_lib as L
import anim_n11 as G

N, MS = 48, 70
sz = G.Szene('cybug-ants', (3, 3, 4, 3))
spr = sz.spr
xx, yy = sz.xx, sz.yy
ROT, DROT, WEISS = (255, 0, 0), (150, 0, 0), (205, 205, 205)
#        Phase:  0       1        2         3        4..7
TRITT = [(0, 0), (0, 1), (-1, 1), (-1, 0), (0, 0), (0, 0), (0, 0), (0, 0)]       # (dx, gehoben)
VERSATZ = [0, 12, 0]                                                             # Frames, mittlere Ameise im Gegentakt
# Die drei Ameisen der Ebene stehen schon in leicht verschiedenen Schrittstellungen: Grundversatz (Stiel Zeile 16 + Fuß) je Bein gegenüber der ersten Ameise
GRUND = [(0, 0), (-1, 2), (1, 1)]
bein_m = sz.da & (yy >= 16)
kan = sz.spr.copy(); kan[~(sz.da & (xx <= 37))] = 0
BEIN = [np.where(((xx >= a) & (xx <= b) & (yy >= 16) & (xx <= 37))[..., None], kan, 0).astype(np.uint8) for (a, b) in ((12, 16), (22, 26))]   # Bein der ersten Ameise
DUNKEL = (51, 51, 51)
fuehler_m = sz.da & sz.ist((129, 41, 19)) & (yy <= 2)
RUMPF = sz.teil(sz.da & ~bein_m & ~fuehler_m)
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    f = RUMPF.copy()
    for k in range(3):
        x0 = 38 * k
        # Fühler
        zuck = 1 if (i - 5 - 14 * k) % N < 3 or (i - 29 - 14 * k) % N < 3 else 0
        fm = fuehler_m & (xx >= x0) & (xx < x0 + 38)
        f = G.ueber(f, G.starr(sz.teil(fm), -zuck, 0))
        # Beine
        p = ((i + VERSATZ[k]) // 3) % 8
        for n in range(2):
            dx, hoch = TRITT[(p + 4 * n) % 8]
            if GRUND[k][n] < 0:
                dx = -dx                                                         # schon vorgesetztes Bein schwingt zurück statt weiter vor
            bein = BEIN[n].copy()
            if hoch:
                bein[16:18] = bein[17:19]; bein[18] = 0                          # Stielzeile fällt weg, der Fuß rückt 1 px hoch
            lage = L.platz(bein, sz.H, sz.W, sz.PL + x0 + GRUND[k][n] + dx, sz.PT)
            f = G.ueber(f, lage)
            if hoch:                                                             # freiliegende helle Pixel der Fußoberkante → Umrissgrau
                y = sz.PT + 16
                for x in np.nonzero(lage[y, :, 3])[0]:
                    if not f[y - 1, x, 3]:
                        f[y, x, :3] = DUNKEL
        # Augen
        if (i - 18 - 9 * k) % 24 < 2:
            am = sz.voll(sz.ist(ROT) & (xx >= x0) & (xx < x0 + 38))
            f = G.farbtausch(f, am, {ROT: DROT})
        if not nur:
            s = G.funkel_folge(i, N, 10 + 14 * k, (1, 2, 2, 1))
            if s:
                G.funkel(f, sz.PL + x0 + 3, sz.PT + 6, s, WEISS)
    return f


if __name__ == '__main__':
    G.fertig('cybug-ants', 'Cybug ANTS', frame, N, MS, spr, check=[0, 3, 6, 9, 12, 19], zoom=5)
