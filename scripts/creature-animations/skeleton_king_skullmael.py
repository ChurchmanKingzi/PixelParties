# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton King Skullmael“ (Creature) — Skelettkönig mit goldener Flammenkrone, goldenen Schulterstücken und seinem Greatsword.

Quelle: src/skeleton-king-skullmael.png (29×23 px, 30 Farben) = Ebene „Skullmael“ (Motive.xcf, Ebene 428, 20×23, Figur 1) + Ebene „Ebene #590“ (Ebene 429, 19×16, Figur 1 = das Schwert);
beide Ebenen zusammen ergeben genau die Figur der Kartenkunst (Skeleton_King_Skullmael.png, Pixelabgleich 100 %). Das Schwert liegt UNTER dem König (die linke Hand verdeckt den Griff bei (9–10, 5–8),
der Schritt die Klingenspitze bei (16–18, 16–18)). Damit beim Heben nichts Verdecktes fehlt, liegen die beiden Ebenen zusätzlich einzeln in src/ (…-koenig.png, 20×23, Versatz (9,0); …-schwert.png, 19×16, Versatz (0,3)).
PICK: [["Motive", 428, 1], ["Motive", 429, 1]]
Nicht benutzt: Ebene 420 „Skullmaels Greatsword“ (47×22, das Seitenprofil-Schwert einer anderen Pose), Ebene 427, Totenkopf-und-Knochen-Haufen der Kunst (Kulisse).

Aufruf:   python3 skeleton_king_skullmael.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-king-skullmael.png + .json

Was ist was (x, y im 29×23-Sprite):
* KRONE (x 14–24, y 0–5): goldene Flammenzacken (213,98,16)/(255,180,24)/(255,222,90) auf dunklem Braun (115,41,16); SCHÄDEL (x 15–23, y 3–9): dunkle Augenhöhlen (15,15,15), zwei ROTE AUGEN (163,0,0) bei (17,6) und (20,6),
  weißes Nasenbein (217,217,217) (18–19,6), dunkelroter offener MUND (79,0,0)/(125,0,0)/(163,0,0)/(102,0,0) bei (17–20, 8–9).
* SCHULTERSTÜCKE: goldene Sonnenpauldrons links (x 9–12, y 3–6) und rechts (x 25–28, y 3–6) (braun/orange/gelb), darunter die ARME als weiße Knochenstreifen (x 10–13 bzw. 24–27, y 7–10), die nach unten an den
  Rumpf anschließen. Die linke Hand hält das Schwert am Griff (verdeckt es bei (9–10, 5–8)).
* RUMPF (x 13–25, y 10–18): Rippenbögen (169…229,229,229) in Schwarz (31,31,31), Becken y 18–19, Beine/Füße y 19–22 mit goldenen STIEFELN (255,180,24)/(213,98,16) (x 14–18 bzw. 20–24, y 19–22).
* SCHWERT (x 0–18, y 3–18): großer goldener Sonnenknauf/Parierstange (108,46,17)/(255,198,0)/(255,219,0) mit rotem Edelstein (172,0,0)/(131,0,0) bei (5–6, 8–9) (x 0–9, y 3–13), weiße Klinge (218,218,206)/(229,229,229)/
  (255,255,255) diagonal nach rechts unten bis (17, 18).
Glanz/Glitzer (Regel 12/14) NUR bei Gold und Metall: Krone, Schulterstücke, Stiefel, Knauf (Gold), Klinge (Stahl), roter Edelstein im Knauf. Knochen, Schädel und Rippen glänzen nicht. Kein Feuer.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original):
* ATMEN (Periode 24, zweimal pro Schleife, 0 → 1 → 2 → 1 → 0 Stufen; Runde 3: VERTEILT statt an einer einzigen Stelle): je Stufe werden Zeilen an verschiedenen Stellen eingefügt (Texturmischung, L.streck_zeile) —
  Stufe 1: Rippenzeile y 13; Stufe 2: Zeile y 11 (Schultern/Arme) und y 16 (untere Rippen). Alles darüber hebt sich (Krone, Schädel, Pauldrons, Arme), Beine/Füße bleiben; jedes Pixel wandert nur monoton mit der Stufe.
* LACHEN (Runde 3, Nutzer: „soll lachen, sein Mund ist standardmäßig offen“): zwei Lachsalven je Schleife (Frame 6–17 und 30–41, je drei Takte à 4 Frames); der Mund klappt im Takt weit auf (rote Mundzeile y 9 wird vier Pixel breit,
  dazu zwei Pixel am Kinn (18–19, 10), der Kopf mit Schultern, Armen und Schwertgriff ruckt dabei 1 px hoch: Zeile 11 wird zusätzlich eingefügt) und fast zu (nur die obere Mundzeile y 8 bleibt rot). Zwischen den Salven bleibt der Mund wie im Original offen.
* SCHWERT (Runde 3): Knauf und Griff (Gold, Rubin) steigen STARR mit der haltenden Hand; die Klinge hängt oben starr am Griff und streckt sich darunter an denselben Zeilen wie der Körper; die SCHWARZEN Pixel (11–12, 18), wo
  die Klinge im Boden steckt, bleiben in allen 48 Frames unbewegt (geprüft). Das Pendeln der Klingenspitze ist entfernt (eine im Boden steckende Klinge schlenkert nicht). Das Lichtband hellt keine Randpixel der Klinge mehr auf
  (sonst bekam die schwarze Spitze zwei Frames lang ein zusätzliches Pixel).
* LICHTBAND (Periode 48, zweimal pro Schleife versetzt): ein diagonales Band wandert über das GOLD (Krone, Pauldrons, Knauf, Stiefel), danach ein zweites über die KLINGE; eine Stufe heller auf der Farbrampe des Sprites.
* GLITZERSTERNE (kleine Vierzack-Sterne, Mitte weiß, Arme hellgelb, 1 → 2 → 2 → 1 → 0 Stufen, am Objekt): Krone (22,2), linkes Schulterstück (11,4), Knauf (4,5), rechter Pauldron (27,5), Stiefel (15,21) und (23,21).
* AUGEN blinzeln (Frames 12–14 und 35–37): die roten Augenpixel nehmen die Farbe der Augenhöhle (15,15,15) an.
Kein Kopfneigen, keine seitliche Verlagerung (Regel 17; das Lachen ruckelt nur senkrecht); die Füße bleiben am Boden (Regel 18). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Pixel; Randpixel-Test (Regel 16) mit `U.kontur_schliessen`.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_untote2 as V

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 6, 3
KOENIG_OFF, SCHWERT_OFF = (9, 0), (0, 3)

spr = L.lade('skeleton-king-skullmael')
koenig = L.lade('skeleton-king-skullmael-koenig')
schwert = L.lade('skeleton-king-skullmael-schwert')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (31, 31, 31)
AUGEN = [(17, 6), (20, 6)]
assert all(col(x, y) == (163, 0, 0) for (x, y) in AUGEN)
HOEHLE = (15, 15, 15)

GOLD = {(213, 98, 16): (255, 161, 0), (255, 161, 0): (255, 180, 24), (255, 180, 24): (255, 198, 0), (255, 198, 0): (255, 219, 0), (255, 219, 0): (255, 222, 90)}
STAHL = {(193, 193, 197): (218, 218, 206), (218, 218, 206): (229, 229, 229), (229, 229, 229): (255, 255, 255), (169, 169, 169): (188, 188, 188)}


def layer_pts(a, off, farben):
    """Pixel (Sprite-Koordinaten) einer Teil-Ebene, deren Farbe in `farben` steht."""
    pts = []
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y, x, 3] and tuple(int(v) for v in a[y, x, :3]) in farben:
                pts.append((x + off[0], y + off[1]))
    return pts


GOLD_K = layer_pts(koenig, KOENIG_OFF, GOLD)
GOLD_S = layer_pts(schwert, SCHWERT_OFF, GOLD)
KANTE = U.kanten(spr)                                                       # Randpixel der Figur: das Lichtband hellt sie nicht auf (die Klinge hat keinen dunklen Umriss; ein aufgehellter Randpixel
                                                                           # hätte sonst von kontur_schliessen einen zusätzlichen schwarzen Nachbarn bekommen — die schwarze Spitze im Boden wuchs)
STAHL_S = [(x, y) for (x, y) in layer_pts(schwert, SCHWERT_OFF, {(193, 193, 197), (218, 218, 206), (229, 229, 229)}) if not KANTE[y, x]]
TEST_EBENEN = 'koerper'

# Schwert in zwei Teile: Knauf/Griff (Gold + Rubin) bleibt STARR und steigt als Ganzes mit der haltenden Hand; die Klinge (Stahl + Schwarz im Boden) streckt sich unterhalb des Griffs.
STAHL_FARBEN = {(193, 193, 197), (218, 218, 206), (229, 229, 229), (255, 255, 255), (0, 0, 0)}
_stahl_m = np.zeros(schwert.shape[:2], bool)
for _y in range(schwert.shape[0]):
    for _x in range(schwert.shape[1]):
        if schwert[_y, _x, 3] and tuple(int(v) for v in schwert[_y, _x, :3]) in STAHL_FARBEN:
            _stahl_m[_y, _x] = True
KLINGE, KNAUF = L.trenne(schwert, _stahl_m)
KLINGE_AB = 12                                                              # Sprite-Zeile, ab der sich die Klinge dehnen darf (darüber hängt sie starr am Griff)


def ebene(a, off):
    return L.platz(a, H, W, OFF[0] + off[0], OFF[1] + off[1])


def stern_folge(i, start):
    return V.folge(i, N, start, [1, 2, 2, 1])


# Runde 3: Dehnung VERTEILT statt an einer einzigen Zeile. Zeilen (Sprite-Koordinaten), an denen beim Atmen je eine Zeile zusätzlich eingefügt wird;
# alles darüber hebt sich, alles darunter (Beine, Klingenspitze im Boden) bleibt stehen. Jedes Pixel wandert monoton mit der Atemstufe (kein Flackern).
STRECK_ZEILEN = {0: (), 1: (13,), 2: (11, 16)}
MUND_ROT = {'u': (79, 0, 0), 'w': (102, 0, 0)}                              # Farben des offenen Mundes im Sprite
ZAHN, KINN = (169, 169, 169), (144, 144, 144)                               # Zahn-/Wangenknochen, die der Mund beim Lachen überdeckt bzw. freigibt
assert col(18, 9) == MUND_ROT['u'] and col(19, 9) == MUND_ROT['w'] and col(17, 9) == ZAHN and col(18, 10) == KINN and col(19, 10) == KINN

LACH_START = (6, 30)                                                        # zwei Salven je Schleife (Frame 6–17 und 30–41), dazwischen bleibt der Mund wie im Original offen


def mund_stufe(i):
    """Lachen (Runde 3): 0 = Original (Mund offen), +1 = weit auf („HA“, Kopf und Schultern ruckeln 1 px hoch), −1 = fast zu („ha“, nur die obere Mundzeile bleibt rot).
    Eine Salve dauert 12 Frames und besteht aus drei Takten à 4 Frames (weit auf, weit auf, fast zu, fast zu) — der Mund klappt zügig auf und zu."""
    for st in LACH_START:
        k = i - st
        if 0 <= k < 12:
            return (1, 1, -1, -1)[k % 4]
    return 0


def zeilen_einfuegen(a, zeilen_n):
    """Jede Zeile (Sprite-Zeile → Anzahl zusätzlicher Kopien) von oben nach unten einfügen (Textur gemischt, L.streck_zeile); die Zeilen darunter bleiben stehen."""
    for y in sorted(zeilen_n):
        if zeilen_n[y]:
            a = L.streck_zeile(a, OFF[1] + y, zeilen_n[y])
    return a


def frame(i, nur=None):
    n = V.stufen(i, 24, 2)
    m = mund_stufe(i)
    k = ebene(koenig, KOENIG_OFF)
    s_knauf, s_klinge = ebene(KNAUF, SCHWERT_OFF), ebene(KLINGE, SCHWERT_OFF)
    # Lichtbänder (Sprite-Koordinaten, Diagonale x + y): Gold in den ersten 20 Frames, Klinge später
    d_gold = -3 + 3 * ((i - 2) % 24) if 0 <= (i - 2) % 24 < 18 else None
    d_klinge = 8 + 2 * ((i - 4) % 24) if 0 <= (i - 4) % 24 < 12 else None
    if d_gold is not None:
        V.glanz_band(k, GOLD_K, GOLD, d_gold, 3, OFF)
        V.glanz_band(s_knauf, GOLD_S, GOLD, d_gold, 3, OFF)
    if d_klinge is not None:
        V.glanz_band(s_klinge, STAHL_S, STAHL, d_klinge, 3, OFF)
    if V.fenster(i, N, 12, 3) or V.fenster(i, N, 35, 3):                     # Blinzeln
        V.setze(k, {(x + 0, y): HOEHLE for (x, y) in AUGEN}, OFF)
    if m > 0:                                                                # Lachen: Mund weit auf (eine Zeile tiefer, eine Spalte breiter je Seite)
        V.setze(k, {(17, 9): MUND_ROT['u'], (18, 9): MUND_ROT['u'], (19, 9): MUND_ROT['w'], (20, 9): MUND_ROT['w'],
                    (18, 10): MUND_ROT['u'], (19, 10): MUND_ROT['w']}, OFF)
    elif m < 0:                                                              # Lachen: Mund fast zu (untere Mundzeile wird Zahn)
        V.setze(k, {(18, 9): ZAHN, (19, 9): KINN}, OFF)
    zn = dict.fromkeys(STRECK_ZEILEN[n], 1)
    if m > 0:                                                                # Lachruck: Kopf, Schultern, Arme (und der Schwertgriff in der Hand) heben sich 1 px mehr (Halszeile 11)
        zn[11] = zn.get(11, 0) + 1
    kb = zeilen_einfuegen(k, zn)
    # Das SCHWERT (Runde 3): Knauf/Griff steigt STARR mit der haltenden Hand (um die Summe aller eingefügten Zeilen); die Klinge hängt oben starr am Griff und streckt sich unterhalb
    # (Zeilen ≥ 12) an denselben Stellen wie der Körper; ihre Spitze im Boden (die schwarzen Pixel (11–12, 18)) bleibt unbewegt. Kein Pendeln mehr: eine im Boden steckende Klinge schlenkert nicht.
    gesamt = sum(zn.values())
    zk = {}
    for y, c in zn.items():
        zk[max(y, KLINGE_AB)] = zk.get(max(y, KLINGE_AB), 0) + c
    sb = zeilen_einfuegen(s_klinge, zk)
    sk = L.versetze(s_knauf, 0, -gesamt)
    f = L.zusammen(H, W, [(sk, 0, 0), (sb, 0, 0), (kb, 0, 0)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur is None:                                                          # Glitzersterne am Gold (nach der Figur, am Objekt)
        hub = sum(zn.values())                                               # alles oberhalb der Zeile 10 hebt sich um die Summe aller eingefügten Zeilen
        for (sx, sy, st0) in ((22, 2, 4), (11, 4, 16), (4, 5, 26), (27, 5, 36), (15, 21, 9), (23, 21, 41)):
            st = stern_folge(i, st0)
            if st:
                V.stern(f, sx, sy - (hub if sy < 11 else 0), st, (255, 255, 255), (255, 222, 90), OFF)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('skeleton-king-skullmael', 'Skeleton King Skullmael', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-king-skullmael-strip.png', [frames[k] for k in range(0, N, 4)], spalten=6, scale=8)
