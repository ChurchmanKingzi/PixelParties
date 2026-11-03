# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Horror Clown“ (Creature).

Quelle: src/deepsea-horror-clown.png — Ebene „Horror Clown“ (66×50 px) aus MotiveDeepsea.xcf (Ebene 305). Die Ebene ist gegen die Kartenkunst (data/card-art/native/Deepsea_Horror_Clown.png) abgeglichen:
Clown links, Luftballons darüber, rechts die leuchtende Geisterfigur — alles liegt auf dieser einen Ebene (der Treffer-Suchlauf fand die Ebene nicht, weil die Kunst blau getönt ist; Nachbarebenen 304 „Mummy“,
306 „Ebene #28“ sind andere Motive). Die Ebene ist halbtransparent gemalt (Luftballons Alpha 127, Hutkrone und Geisterkörper teils 100–255, dazu ein weicher Leuchtschein um die Lampe); für die Animation
voll deckend gemacht (Regel 22): alle Pixel mit Alpha ≥ 100 → 255 (RGB unverändert), der weiche Schein (Alpha < 100) entfällt; 322 Fast-Doppelfarben der weichen Ränder wurden auf die nächste Hauptfarbe
der Ebene eingerastet (≤ 24 RGB-Abstand; 325 → 88 Farben). Kein Pixel hat eine Farbe außerhalb der Ebene.
PICK: [["MotiveDeepsea", 305, 1]]   (Alpha-Schwelle 100, Farben der Ebene)

Aufruf:   python3 deepsea_horror_clown.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-horror-clown.png + .json

Was ist was (x/y im Sprite):
* Der Clown (x 5–29, y 0–47, steht am Boden): Luftballontraube über dem Kopf (drei bis vier blaue Ballons, x 0–22, y 0–24, Rand (35,79,161), Füllung (57,124,194), Glanzstreifen (122,192,224) — Gummi,
  also kein Funkeln), darunter die graublaue Hutkrone (y 19–24) mit blauem Hutband (0,32,123) und orange/gelben Streifen (230,131,16)/(255,205,49) bei y 24; das Gesicht (x 16–24, y 25–30) ist dunkel (21,39,49)/(32,57,64)
  mit zwei weißen Kreuz-Augen (246,255,255): links (17–19, 26–28), rechts (22–23, 26–28), roter Nase (229,0,0) mit rosa Punkt (229,94,94) bei (20–21, 28–29); links vom Kopf ein schwarzer Fleck (x 11–15, y 24–30), den ich
  nicht sicher deuten kann (Haar/Hutklappe) und deshalb fest lasse. Rumpf (x 12–28, y 28–42) in Teal (51,93,119)/(77,137,154) mit brauner Weste (121,59,59)/(61,29,29), grünen Hosen/Stiefeln (21,43,21)/(31,63,31)
  (y 37–43), dunkler Fußkante (13,16,49) bei y 43 und einem schwarzen Bodenschatten (0,0,0) bei y 46–48 (fest).
* Der rechte Ballon (x 26–38, y 13–25) hängt an einer Schnur (9 Pixel, (28,14,14) und schwarz) bei (32,26) … (28,34), die in der rechten Hand endet.
* Rechts davon eine leuchtende Geisterfigur (x 40–65, y 20–49): Kopf-Haken links oben mit der hellen Lampe (159,222,211) bei (42–47, 22–28), Körper in Teal/Dunkelblau mit weißem 2×2-Auge (245,254,254) bei (50–51, 33–34) und eine
  federige Schwanzflosse rechts (x ≥ 57).
Fest bleiben: Hutkrone, Streifen, Gesicht außer den Lidern, schwarzer Fleck, Bodenschatten, die Form der Geisterfigur im Kern.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original, Blasen ausgenommen):
* Atmen in zwei Schritten (Brust zuerst, Kopf hinterher): eine Zeile im Rumpf (y 36) und eine unter dem Gesicht (y 31) werden eingefügt (`L.streck_zeile`, texturgemischt), Periode 24 mit 3 Frames Nachlauf; der Kopf samt Hut und
  Ballontraube hebt sich dabei bis 2 px, die Füße bleiben am Boden. Der Kopf bewegt sich nie seitlich.
* Ballontraube schwebt zusätzlich 0/1 px höher (Periode 16, dreimal pro Schleife); die unter der Hutkrone verdeckten Ballonzeilen sind mit der Ballonfüllung (57,124,194) fertiggezeichnet (siehe Ergänzungen).
* Rechter Ballon wippt ±1 px (Periode 16); die Schnur wird Pixel für Pixel neu gezogen (oben am Ballon, unten an der Hand, die mit dem Rumpf atmet), bleibt immer 8-verbunden.
* Blinzeln beider Kreuz-Augen (Lid = Gesichtsfarbe (21,39,49)): zweimal (Frame 14–17 und 38–41).
* Geisterfigur: sanftes Schweben ±1 px (Periode 32), Schwanzflosse flattert (Spaltenwelle bis ±2 px, Periode 12, hinkt der Wurzel x 57 nach), die Lampe leuchtet gleichmäßig (Runde 3: kein Pulsieren/„Blinzeln“ des Lichts mehr),
  das weiße Auge blinzelt (Lid = (55,98,122)) bei Frame 20–22.
* Partikel (hinter den Figuren): drei Blasen steigen über der Lampe auf (Kern (159,222,211), Rand (77,137,154)), zwei Blasen links vom Clown (Kern (77,137,154), Rand (51,93,119)); runde Wölkchen 2×2 → 3×3 → 2×2 (`U.wolke_ebene`).
Kein Glanz (Regel 14: Gummi, Stoff, Haut), kein Feuer (die Lampe ist ein Leuchtorgan wie bei Deepsea Skeleton). Randpixel-Test (Regel 16): `U.kontur_schliessen` in jeder Pose.
Ergänzungen: Ballonfüllung (57,124,194) in den Zeilen 19–24 unter der Hutkrone (x 6–24, nur dort, wo die Hutkrone Pixel hat; im Ruhebild verdeckt) und bis zu 2 zusätzliche Schnurpixel in den Posen, in denen sich Ballon/Hand
voneinander entfernen (Farbe der Schnur). Annahme: die Geisterfigur gehört zur Karte (sie liegt auf derselben Ebene wie der Clown) und wird mitanimiert.
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiefsee as T
import anim_untote as U

N, MS = 48, 70
spr = L.lade('deepsea-horror-clown')
S = T.Szene('deepsea-horror-clown', 'Deepsea Horror Clown', spr, N, MS, rand=(5, 5, 6, 5))
sh, sw, H, W = S.sh, S.sw, S.H, S.W
xx, yy, vorhanden, UMRISS = S.xx, S.yy, S.vorhanden, S.UMRISS
GPL, GPT = S.GPL, S.GPT
P = S.P
KONTUR = (13, 16, 49)
col = S.col

STR_T, STR_K = (28, 14, 14), (0, 0, 0)
FACE = (21, 39, 49)
LID_G = (55, 98, 122)
BALLON = (57, 124, 194)

R_, G_, B_ = spr[..., 0].astype(int), spr[..., 1].astype(int), spr[..., 2].astype(int)
BLAU = vorhanden & (B_ >= 125) & (B_ - R_ >= 60) & (R_ <= 135)
STRING_PTS = [(32, 26), (32, 27), (32, 28), (31, 29), (31, 30), (30, 31), (30, 32), (29, 33), (28, 34)]
assert all(col(x, y) in (STR_T, STR_K) for x, y in STRING_PTS)
STRING = np.zeros((sh, sw), bool)
for x, y in STRING_PTS:
    STRING[y, x] = True
BAL_R = BLAU & (xx >= 26) & (xx <= 40) & (yy <= 25)
GH = vorhanden & (xx >= 40) & ~BAL_R
CL = vorhanden & ~GH & ~BAL_R & ~STRING
assert (CL | GH | BAL_R | STRING).sum() == vorhanden.sum()

# Ballontraube: blaue Pixel links oben; unter der Hutkrone verdeckte Zeilen fertigzeichnen
BAL_L = CL & BLAU & (xx <= 25) & (yy <= 24)
hut = CL & ~BAL_L & (yy >= 19) & (yy <= 24) & (xx >= 6) & (xx <= 24)
ERG = []
ext = np.zeros((sh, sw), bool)
for x in range(6, 25):
    for y in range(19, 25):
        if hut[y, x] and (BAL_L[y - 1, x] or ext[y - 1, x]):
            ext[y, x] = True
            ERG.append((x, y))
BAL_L_ext = BAL_L.copy()
CLOWN_REST = CL & ~BAL_L
bal_l = S.teil(BAL_L)
for (x, y) in ERG:
    bal_l[GPT + y, GPL + x, :3] = BALLON
    bal_l[GPT + y, GPL + x, 3] = 255
clown_rest = S.teil(CLOWN_REST)
bal_r = S.teil(BAL_R)

# Geister-Teile
FLOSSE = GH & (xx >= 57)
LAMPE = GH & ((spr[..., :3] == (159, 222, 211)).all(-1))
AUGE_G = [(50, 33), (50, 34), (51, 33), (51, 34)]
assert all(col(x, y) == (245, 254, 254) for x, y in AUGE_G)
GKOERPER = GH & ~FLOSSE
fl_ebene = S.teil(FLOSSE)
gk_ebene = S.teil(GKOERPER)

AUGE_C = [(18, 26), (17, 27), (18, 27), (19, 27), (18, 28), (23, 26), (22, 27), (23, 27), (23, 28)]
assert all(col(x, y) == (246, 255, 255) or col(x, y) == (245, 254, 254) for x, y in AUGE_C)
BLINZ_C = {14: 1, 15: 2, 16: 2, 17: 1, 38: 1, 39: 2, 40: 2, 41: 1}
BLINZ_G = {20: 1, 21: 1, 22: 1}


def schnur(y_top, y_bot):
    """Schnur neu ziehen: oben bei (32, y_top) am Ballon, unten bei (28, y_bot) an der Hand; die Ruheform wird auf die neue Länge gedehnt (Zeilen
    der Vorlage per Abbildung), Nachbarzeilen bleiben ≤ 1 px auseinander (8-verbunden)."""
    n_src = len(STRING_PTS)
    n_new = y_bot - y_top + 1
    out = []
    lastx = None
    for k in range(n_new):
        j = int(round(k * (n_src - 1) / max(1, n_new - 1)))
        x, _ = STRING_PTS[j]
        c = col(*STRING_PTS[j])
        if lastx is not None:
            x = max(lastx - 1, min(lastx + 1, x))
        out.append((x, y_top + k, c))
        lastx = x
    return out


def frame_gross(i, nur=None):
    # --- Atmen: Brust (y 36) zuerst, Kopf (y 31) 3 Frames später ---
    n1 = U.stufe(i, 24, 1)
    n2 = U.stufe(i, 24, 1, versatz=-L.sinus(3, 24))
    cl = clown_rest.copy()
    # Blinzeln
    st = BLINZ_C.get(i, 0)
    if st:
        for (x, y) in AUGE_C:
            if st == 2 or y <= 27:
                cl[GPT + y, GPL + x, :3] = FACE
    if n2:
        cl = L.streck_zeile(cl, GPT + 31, n2)
    if n1:
        cl = L.streck_zeile(cl, GPT + 36, n1)
    hub = n1 + n2
    # Ballontraube: Atem + zusätzlich 0/1 px höher
    up = U.stufe(i, 16, 1)
    bl = L.versetze(bal_l, 0, -hub - up)
    # Ballon rechts wippt, Schnur neu
    dyb = int(round(1.0 * T.sinz(i, 16)))
    br = L.versetze(bal_r, 0, dyb)
    hand_y = 34 - n1
    pts = schnur(26 + dyb, hand_y)
    sn = L.leer(H, W)
    for (x, y, c) in pts:
        sn[GPT + y, GPL + x, :3] = c
        sn[GPT + y, GPL + x, 3] = 255
    # Geisterfigur
    gdy = int(round(1.0 * T.sinz(i, 32)))
    gk = gk_ebene.copy()
    stg = BLINZ_G.get(i, 0)
    if stg:
        for (x, y) in AUGE_G:
            gk[GPT + y, GPL + x, :3] = LID_G
    # Runde 3 (Nutzer-Feedback): das Licht der Geisterfigur (Lampe) soll NICHT „blinzeln“ → keine Pulsbewegung mehr, die Lampe leuchtet gleichmäßig (Originalfarben).
    fl = T.fluegel(fl_ebene, GPL + 57, 2.0, i, 12, lag=1.0, potenz=1.0)
    geist = L.zusammen(H, W, [(fl, 0, gdy), (gk, 0, gdy)])
    # Clown-Körper liegt über den Ballons (Hutkrone vor der Traube)
    f = L.zusammen(H, W, [(bl, 0, 0), (br, 0, 0), (sn, 0, 0), (geist, 0, 0), (cl, 0, 0)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    luft = {'c': (159, 222, 211), 'r': (77, 137, 154)}
    blase = {'c': (77, 137, 154), 'r': (51, 93, 119)}
    p1 = U.wolke_ebene(H, W, i, 48, [dict(x=P(45, 19)[0], y=P(45, 19)[1], vx=1, vy=-11, off=0, wackeln=0.8),
                                      dict(x=P(52, 17)[0], y=P(52, 17)[1], vx=-1, vy=-11, off=16, wackeln=0.8),
                                      dict(x=P(58, 15)[0], y=P(58, 15)[1], vx=1, vy=-10, off=32, wackeln=0.8)], luft)
    p2 = U.wolke_ebene(H, W, i, 48, [dict(x=P(6, 44)[0], y=P(6, 44)[1], vx=0, vy=-14, off=8, wackeln=0.6),
                                      dict(x=P(3, 46)[0], y=P(3, 46)[1], vx=0, vy=-14, off=32, wackeln=0.6)], blase)
    return L.zusammen(H, W, [(p1, 0, 0), (p2, 0, 0), (f, 0, 0)])


S.bauen(frame_gross)
frame = S.frame
TEST_EBENEN = 'koerper'            # Randpixel-Test nur für die Figur (ohne Blasen)

if __name__ == '__main__':
    S.main([0, 3, 6, 9, 12, 15, 18, 21])
