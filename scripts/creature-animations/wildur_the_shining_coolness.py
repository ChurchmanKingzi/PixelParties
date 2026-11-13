# -*- coding: utf-8 -*-
"""Idle-Animation für „Wildur, the Shining Coolness“ (Creature) — der glatzköpfige Strahlemann mit schwarzer Sonnenbrille, der ein blaues Handtuch vor sich hält.

Quelle: src/wildur-the-shining-coolness.png (16×20 px, 13 Farben) = Ruhebild, zusammengesetzt aus drei Ebenen (jeweils als eigenes PNG in src/, gleiche Leinwand 16×20):
PICK: [["MotiveCoolhalla", 153, 1], ["MotiveCoolhalla", 152, 1], ["MotiveCoolhalla", 151, 1]]
  * …-koerper.png = Ebene 153 „Ebene #68“: der ganze Mann (Glatze, Sonnenbrille, nackter Oberkörper, Unterhose, Beine, Füße) – auch das, was das Handtuch verdeckt.
  * …-tuch.png    = Ebene 152 „Ebene #69“: das blaue Handtuch (x 0–15, y 9–18) mit zwei hellen Längsstreifen (x 4 und x 11).
  * …-haende.png  = Ebene 151 „Ebene #70“: die beiden Hände an den Tuchrändern (x 0–2 und x 13–15, y 12–15).
  Ebene 150 „Ebene #71“ (weißer Lichtreflex auf Brille/Gesicht, in der xcf halbtransparent) und die große Lichtkreuz-Ebene 149 sind der „Shining“-Effekt der Kunst; daraus stammt nur die Farbe Weiß (255,255,255)
  für den Brillenglanz (dokumentierte Ausnahme, in pruefe freigegeben). Abgleich mit Wildur_the_Shining_Coolness.png: Mann schaut hinter dem Dachfirst hervor, Handtuch und Hände wie hier. Quelle vollständig.

Was im Sprite ist (x, y): GLATZE (x 3–12, y 0–2, Glanzlicht (245,222,180) bei (6–7,1)); schwarze AUGENBRAUEN (x 4–6 und 9–11, y 3); SONNENBRILLE schwarz (x 3–12, y 5 und x 4–6/9–11, y 6); Nase (241,205,139) (7–8, 6–7);
Kinn/Hals (y 7–9); Schultern/Brust (y 10, zwischen den Tuchecken); HANDTUCH (y 9–18); HÄNDE; FÜSSE (y 19).

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos, Frame 0 = Original):
* BRILLENGLANZ (Idle-Idee „Shining Coolness“): ein weißer Lichtstreif läuft schräg über beide Gläser (Frames 6–12), danach blitzt ein kurzer Sparkle an der Brillenecke (Frames 13–16); Frames 34–37 ein zweiter
  kurzer Sparkle am anderen Glas. Die Brille blinzelt nicht (Regel 21).
* HANDTUCH ZUPFEN: Tuch + beide Hände heben sich als starre Einheit 1 px (Frames 22–29) und kurz noch einmal (Frames 40–43); darunter werden die Schienbeine der Körper-Ebene sichtbar (nichts erfunden).
* ATMEN: der Körper hebt sich 1 px (Frames 12–23 und 36–47 … je einmal pro halber Schleife); die eingefügte, texturierte Zeile (anim_textur) liegt bei y 12 HINTER dem Handtuch, sichtbar hebt sich nur Kopf/Schulter.
  Kopf nie seitlich. Füße bleiben am Boden.
Ergänzungen: keine (Verdecktes kommt aus der Körper-Ebene der Quelle). Farben: Quelle + Weiß (255,255,255) aus Ebene 150.
"""
import numpy as np

import anim_cool as C
import anim_lib as L
import anim_n1 as N1
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
SLUG = 'wildur-the-shining-coolness'
spr = L.lade(SLUG)
PL, PT, PR, PB = 4, 5, 4, 3
OFF = (PL, PT)
sh, sw = spr.shape[:2]
H, W = sh + PT + PB, sw + PL + PR
E_K, E_T, E_H = (L.platz(L.lade(SLUG + '-' + n), H, W, PL, PT) for n in ('koerper', 'tuch', 'haende'))
WEISS = (255, 255, 255)
GLAS = [(x, y) for y in range(5, 7) for x in range(3, 13) if tuple(spr[y, x, :3]) == (0, 0, 0)]
KOERPERFARBEN = sorted({tuple(int(v) for v in p[:3]) for p in L.lade(SLUG + '-koerper').reshape(-1, 4) if p[3]})   # Farben der (teils verdeckten) Körper-Ebene der Quelle
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    k = E_K.copy()
    if nur != 'koerper':
        t = i - 6
        if 0 <= t <= 6:                                   # Lichtstreif (2 px breit, schräg) über die Gläser
            for (x, y) in GLAS:
                if x + y - 8 in (2 * t, 2 * t + 1):
                    k[PT + y, PL + x, :3] = WEISS
    n = 1 if (i % 24) >= 12 else 0
    k = TX.streck_zeile(k, PT + 12, n)
    z = 1 if (22 <= i <= 29 or 40 <= i <= 43) else 0
    f = L.zusammen(H, W, [(k, 0, 0), (E_T, 0, -z), (E_H, 0, -z)])
    if nur != 'koerper':
        for (x, y, s0) in ((3, 5, 13), (12, 5, 34)):
            st = {0: 0, 1: 1, 2: 1, 3: 0}.get(i - s0)
            N1.funkel(f, PL + x, PT + y - n, st, WEISS, WEISS, nur_leer=False)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss(SLUG, 'Wildur, the Shining Coolness', frames, MS, spr, OFF, C.vorschau_arg(), erlaubt=[WEISS] + KOERPERFARBEN, ecken=False)
