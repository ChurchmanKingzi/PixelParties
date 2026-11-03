# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Pirate“ (Creature).

Quelle: src/deepsea-pirate.png — linker Teil (x 0–20, 311 Pixel, 13 Farben) der Ebene „Pirate“ (41×32 px) aus MotiveDeepsea.xcf (Ebene 310; in der Kartenkunst blau getönt, daher vom Treffer-Suchlauf
nur als „getönt“ geführt, direkt aus dem Dump genommen). Gegen die Kartenkunst (data/card-art/native/Deepsea_Pirate.png) abgeglichen: gleiche Form, Lage und Größe.
PICK: [["MotiveDeepsea", 310, 1]]   (nur x ≤ 20; Ebene vollständig deckend, Alpha 0/255)
Rechts davon liegt auf derselben Ebene ein flacher, grünlich gesprenkelter Brocken (x 21–40, y 17–31, mit schwarzer Querfuge bei y 23 — vermutlich Truhe/Wrackteil) — das ist Beiwerk, kein Teil des Piraten, und wurde
nicht in den Sprite übernommen (Annahme, siehe Bericht).
Der Torso zwischen den Armen (x 6–12, y 14–16) hat in der Ebene Alpha 0 (der Künstler hat ihn ausradiert, das Gespenst ist dort durchsichtig) und bleibt leer — auch in der Kartenkunst ist dort Wasser zu sehen.

Aufruf:   python3 deepsea_pirate.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-pirate.png + .json

Was ist was (x/y im Sprite, 21×24):
* Ein ertrunkener Zombie-Pirat in Teal-Schachbrett (51,93,119)/(77,137,154) mit dunklem Umriss (33,43,70): violetter Kopfschal/Bandana (x 4–15, y 0–5, Farben (49,0,98)/(106,32,172)/(148,74,213)/(172,123,238)/(213,180,255)) mit zwei
  flatternden Knotenenden links (x 1–4, y 6–8) und rechts (x 15–18, y 6–8); Gesicht (x 3–16, y 5–12): ein weißes 2×2-Auge (255,255,255) bei (7–8, 6–7), rechts davon eine schwarze Augenklappe (0,0,0) (x 11–15, y 3–8, mit Riemen),
  ein schwarzer Grinsemund (x 7–12, y 9–11) mit zwei weißen Hauerzähnen bei x 8 und x 11 (y 10–11).
* Arme: der linke hängt als Block (x 0–5, y 12–17), der rechte läuft diagonal nach rechts unten (x 13–20, y 12–19) und endet in einem weißen Haken-Ring (255,255,255): vier Pixel (17,18), (16,19), (18,19), (17,20) (Metall).
* Unten Rumpfrest/Beine (x 4–14, y 17–23): zwei Beine (links x 5–8, rechts x 10–14), dazwischen eine dunkle Spalte (13,16,49) (x 9–10, y 20–22).
Fest bleiben: Gesichtsform, Augenklappe, Armform, Kopftuch samt Knotenenden.

RUNDE 3 (Nutzer-Feedback): „die vier weißen Pixel unten rechts sollen ein Sparkle-Effekt sein, dadurch ersetzen. Sein lila Kopftuch soll nicht so seltsam ‚rotieren‘.“
  * Die vier weißen Pixel (17,18)/(16,19)/(18,19)/(17,20) (der „Haken-Ring“ am rechten Arm = in der Vorlage ein gemalter Glitzer-Rhombus) sind aus dem Sprite ENTFERNT und durch einen kurzen, normalen Sparkle-Partikel ersetzt
    (Metall/Haken: Regel 12/14/34): Mitte (17,19) → Kreuz mit 1-px-Armen → Kreuz mit 2-px-Armen → Kreuz 1 px → Mitte → weg (5 Frames, weiß (255,255,255) aus dem Sprite), zweimal je Schleife (Frame 14 und 38), dazwischen lange Pause;
    Arme zeichnen nur auf leere Felder (der Arm bei (19,19) bleibt unberührt). Frei gewordene Kante am Arm schließt `U.kontur_schliessen` mit der Umrissfarbe (33,43,70) bei (18,18).
  * Das Kopftuch „rotierte“, weil die beiden Knotenenden (links/rechts) gegenläufig ±1 px senkrecht schwangen: diese Bewegung ist ENTFERNT; die Knotenenden stehen fest und heben sich nur starr mit dem Kopf (Atmen).
Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original ohne Haken-Ring, Blase/Sparkle ausgenommen):
* Atmen: alles oberhalb der Schulterzeile y 12 (Kopf, Schal, Knoten) hebt sich 1 px (die Schulterzeile wird texturgemischt einmal eingefügt, `L.streck_zeile`), Periode 24; die Arme laufen unten weiter, Beine und Füße bleiben am Boden.
  Der Kopf bewegt sich nie seitlich.
* Kopftuch/Knotenenden: fest (Runde 3), heben sich nur mit dem Kopf beim Atmen.
* Linker Arm pendelt: die Zeilen unterhalb der Schulter schwingen waagerecht (≤ 1 px, Periode 24), oben fest.
* Beine heben abwechselnd 1 px (je 3 Frames, Periode 16: links Frame 3–5, rechts 11–13).
* Blinzeln des einen offenen Auges (Lid = Haut (51,93,119)): zweimal (Frame 8–10 und 31–33); die Augenklappe blinzelt nicht (Regel 21).
* Maul kaut: die schwarze Mundöffnung wird eine Zeile tiefer (schwarz bei (9–10, 11), dann auch (9–10, 12); Frame 14–23 in drei Stufen) — Hauerzähne bleiben, danach schließt sich der Mund wieder.
* Sparkle am Haken (Metall, Regel 12/14/34): kurzer Glitzer-Partikel bei (17,19), 5 Frames, zweimal je Schleife (Frame 14 und 38).
* Eine Blase steigt links unten neben dem Piraten auf (Kern (77,137,154), Rand (51,93,119); `U.wolke_ebene`, 2×2 → 3×3 → 2×2).
Kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` in jeder Pose; im Ruhebild nichts. Keine gemalten Pixel außer Lid-/Mundfarben aus der Quelle und Umrisspixeln.
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, Blase höchstens 2 px darüber hinaus, dazu 1 px leerer Rand).
"""
import numpy as np

import anim_lib as L
import anim_tiefsee as T
import anim_untote as U

N, MS = 48, 70
spr = L.lade('deepsea-pirate')
RING = [(17, 18), (16, 19), (18, 19), (17, 20)]            # Haken-Ring (4 weiße Pixel) → wird zum Sparkle-Partikel
assert all(tuple(spr[y, x, :3]) == (255, 255, 255) and spr[y, x, 3] for x, y in RING)
for (x, y) in RING:
    spr[y, x] = 0
S = T.Szene('deepsea-pirate', 'Deepsea Pirate', spr, N, MS, rand=(5, 5, 6, 5))
sh, sw, H, W = S.sh, S.sw, S.H, S.W
xx, yy, vorhanden, UMRISS = S.xx, S.yy, S.vorhanden, S.UMRISS
GPL, GPT = S.GPL, S.GPT
P = S.P
col = S.col
KONTUR = (33, 43, 70)
SCHWARZ, WEISS = (0, 0, 0), (255, 255, 255)
HAUT_B = (51, 93, 119)
LILA = {(49, 0, 98), (106, 32, 172), (148, 74, 213), (172, 123, 238), (213, 180, 255), (197, 156, 246)}

lila = L.farbmaske(spr, sorted(LILA))
KNOTEN_L = lila & (yy >= 6) & (yy <= 8) & (xx <= 4)
KNOTEN_R = lila & (yy >= 6) & (yy <= 8) & (xx >= 15)
AUGE = [(7, 6), (8, 6), (7, 7), (8, 7)]
assert all(col(x, y) == WEISS for x, y in AUGE)
ZAEHNE = [(8, 10), (8, 11), (11, 10), (11, 11)]
assert all(col(x, y) == WEISS for x, y in ZAEHNE)
HAKEN_MITTE = (17, 19)
assert not vorhanden[HAKEN_MITTE[1], HAKEN_MITTE[0]]
SPARKLE = {14 + k: st for k, st in enumerate([0, 1, 2, 1, 0])}                 # Frame → Stufe (0 = nur Mitte, 1 = Kreuz 1 px, 2 = Kreuz 2 px)
SPARKLE.update({38 + k: st for k, st in enumerate([0, 1, 2, 1, 0])})
ARM_L = vorhanden & (xx <= 5) & (yy >= 13) & (yy <= 17)
BEIN_L = vorhanden & (xx <= 8) & (yy >= 21) & (xx >= 4)
BEIN_R = vorhanden & (xx >= 11) & (xx <= 14) & (yy >= 21)
rest = vorhanden & ~KNOTEN_L & ~KNOTEN_R & ~ARM_L & ~BEIN_L & ~BEIN_R
assert not (BEIN_L & BEIN_R).any()
assert KNOTEN_L.sum() == 9 and KNOTEN_R.sum() == 9, (KNOTEN_L.sum(), KNOTEN_R.sum())

REST_A, KL_A, KR_A, ARM_A, BL_A, BR_A = (S.teil(m) for m in (rest, KNOTEN_L, KNOTEN_R, ARM_L, BEIN_L, BEIN_R))
BLINZ = {8: 1, 9: 1, 10: 1, 31: 1, 32: 1, 33: 1}
MUND = {k: 1 for k in range(14, 17)}
MUND.update({k: 2 for k in range(17, 21)})
MUND.update({k: 1 for k in range(21, 24)})


def frame_gross(i, nur=None):
    kb = REST_A.copy()
    if BLINZ.get(i):
        for (x, y) in AUGE:
            kb[GPT + y, GPL + x, :3] = HAUT_B
    m = MUND.get(i, 0)
    if m >= 1:
        for x in (9, 10):
            kb[GPT + 11, GPL + x, :3] = SCHWARZ
    if m >= 2:
        for x in (9, 10):
            kb[GPT + 12, GPL + x, :3] = SCHWARZ
    # Knotenenden des Kopftuchs stehen fest (Runde 3)
    oben = L.zusammen(H, W, [(kb, 0, 0), (KL_A, 0, 0), (KR_A, 0, 0)])
    # linker Arm pendelt (unterhalb der Schulter, oben fest)
    arm = U.haengen(ARM_A, GPT + 13, 1.0 * T.sinz(i, 24), potenz=1.0)
    # Beine heben abwechselnd
    bl_ = 1 if (i % 16) in (3, 4, 5) else 0
    br_ = 1 if (i % 16) in (11, 12, 13) else 0
    f = L.zusammen(H, W, [(oben, 0, 0), (arm, 0, 0), (BL_A, 0, -bl_), (BR_A, 0, -br_)])
    # Atmen: alles oberhalb der Schulterzeile y 12 hebt sich 1 px
    if U.stufe(i, 24, 1) == 1:
        f = L.streck_zeile(f, GPT + 12, 1)
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    # Sparkle am Haken (Partikel, vor der Figur; nur auf leere Felder)
    st = SPARKLE.get(i)
    if st is not None:
        cx, cy = GPL + HAKEN_MITTE[0], GPT + HAKEN_MITTE[1]
        pts = [(0, 0)] + ([(1, 0), (-1, 0), (0, 1), (0, -1)] if st >= 1 else []) + ([(2, 0), (-2, 0), (0, 2), (0, -2)] if st >= 2 else [])
        for (dx, dy) in pts:
            if not f[cy + dy, cx + dx, 3]:
                f[cy + dy, cx + dx, :3] = WEISS
                f[cy + dy, cx + dx, 3] = 255
    blase = U.wolke_ebene(H, W, i, 24, [dict(x=P(1, 25)[0], y=P(1, 25)[1], vx=0, vy=-7, off=0, wackeln=0.5),
                                         dict(x=P(1, 25)[0], y=P(1, 25)[1], vx=0, vy=-7, off=12, wackeln=0.5)],
                          {'c': (77, 137, 154), 'r': (51, 93, 119)})
    return L.zusammen(H, W, [(blase, 0, 0), (f, 0, 0)])


S.bauen(frame_gross)
frame = S.frame
TEST_EBENEN = 'koerper'

if __name__ == '__main__':
    S.main([0, 3, 6, 9, 12, 15, 18, 21], scale=14)
