# -*- coding: utf-8 -*-
"""Idle-Animation für „Sky Archeologist“ (Creature) — der weißhaarige alte Archäologe im braunen Mantel schlägt mit der Spitzhacke den Boden vor sich auf.

Quelle: src/sky-archeologist.png (23×28 px, 30 Farben).
PICK: [["MotiveMoe", 466, 1]] (Ebene „Sky Archeologist“, komplett). Nachbarebene 465 („Amazing Finding“) zeigt denselben Mann von vorn mit gesenkter Hacke — andere Karte,
      nur als Lesehilfe benutzt (Hacke = starres Werkzeug: Stiel + grauer, rechtwinklig gebogener Metallkopf). Abgleich mit Sky_Archeologist.png: stimmt überein.

Was im Sprite ist (x, y im 23×28-Sprite), Figur im Profil nach rechts:
* HAAR (y 6–14, x 0–9) weiß/hellgrau, brauner Umriss (49,24,0). GESICHT (x 4–9, y 9–14): Nase/Stirn-Umriss x 9 (y 8–11), Kinn weicht zurück ((8,12), (7,13), (7,14));
  helle/graue Pixel (5–7, 11–12) = Brille/Schnurrbart, nicht sicher deutbar → fest, kein Blinzeln.
* SPITZHACKE: Stiel (3 px breit „dunkel–braun–dunkel“ (24,16,13)/(47,28,24)/(80,48,41)) vom Griffende (10,13) schräg nach oben rechts; Metallkopf (Umriss (45,45,45), Licht (160…201))
  als rechter Winkel: waagerechter Schenkel (y 0–2), senkrechter Schenkel (x 20–22), Scheitel bei (20,2).
* HAND (8–9, 13–14) am Griffende, Umriss (10,14). Der Arm selbst ist im Original nicht zu sehen (Mantel = Umrissfarbe, alles eine dunkle Fläche).
* MANTEL (y 15–22) dunkelbraun (49,24,0), gelb-oranger SCHAL (x 5–8, y 15–20), Gürteltasche grau (y 20–21), Hose (y 23–24), STIEFEL rotbraun (y 25–27), schwarzer Schuh/Schatten (7–10, 26).
  (9,16) dunkelgrauer Einzelpixel am Mantel: unklar → geht starr mit dem Oberkörper.
Metall: nur der Hackenkopf → dort (und nur dort) ein kurzes Aufblitzen beim Ausholen.

Idee: ER SCHLÄGT ZU (Nutzerwunsch Runde 8). 48 Frames à 75 ms = 3,6 s, zwei Schläge je Schleife (alle 1,8 s). Jeder Schlag (24 Frames) besteht aus von Hand gebauten SCHLÜSSELPOSEN;
in jeder Pose werden Hacke, Hand und Arm als starre Teile gleicher Dicke neu gesetzt (nichts wird gestreckt oder verbogen):
  A   Ruhe = Original (Hacke aufrecht vor der Schulter)                                    Frames 0–2, 22–23
  A2  anheben: Hacke unverändert, Griff 2 px höher/vor dem Gesicht                          3–4
  B   Stiel senkrecht, Hände vor der Stirn                                                 5–6
  C   über dem Kopf, Stiel nach hinten geneigt; Oberkörper streckt sich 1 px                7–8
  C2  ganz ausgeholt (Stiel noch flacher nach hinten), Halt + Aufblitzen am Kopf            9–11
  D1  Abschwung: Stiel senkrecht                                                           12
  D2  Abschwung: Stiel schräg nach vorn, Oberkörper beugt sich 1 px vor                     13
  E   AUFPRALL: Stiel waagerecht in Hüfthöhe, untere Hackenspitze im Boden (y 27) vor den
      Füßen; Oberkörper 1 px, Kopf 2 px vor und 1 px tiefer; 3 Frames Halt, Steinsplitter   14–16 (Splitter 14–19)
  R1  hochziehen (Stiel schräg), Oberkörper noch 1 px vorgebeugt                            17–18
  R2  fast in Ruhe (Original-Hacke 1 px tiefer/weiter vorn)                                 19–21
Steinsplitter: drei 2×2-Brocken (Grau der Tasche/Hose (131,126,121)/(90,92,80)) springen vom Aufprallpunkt in flachen Bögen weg und fallen zurück auf den Boden (6 Frames).

HACKE ALS STARRES TEIL: Die Schräglagen sind verlustfreie Spiegelungen/Transponierungen der Original-Hacke (jedes Pixel bleibt erhalten): 51° (Original), 39° (an der Nebendiagonale
gespiegelt), 129° (waagerecht gespiegelt), 141° (beides). Für den waagerechten und den senkrechten Stiel gibt es das von Hand gepixelte Raster HACKE_0 (unten; 90° = dieselbe Hacke
um 90° gedreht): Stiel wie im Original als Band dunkel–braun–dunkel, Kopf als 3 px starkes Band Umriss–Licht–Umriss, rechter Winkel mit Scheitel am Stielende, Spitzen stumpf (2 px).

SELBST FERTIGGEZEICHNET (Seitenansicht vervollständigt):
* Körper ohne Hand/Hacke: Hand (8–9, 13–14) und ihr Umriss (10,14) entfernt; (8,14) Umriss (49,24,0) schließt die Oberkante des Schals, wo die Hand lag. Kinnlinie (7,13)/(7,14)
  und Halsansatz sind im Original schon vollständig.
* ARM: in jeder Pose ein 2 px starker Ärmel in Mantelfarbe (49,24,0) von der Schulter (8,15/16 am Mantelrand) zur Hand, als Pixelkette ARME[…] je Pose von Hand gesetzt;
  HAND: 2×2 Haut wie im Original (oben (213,164,98)/(246,189,123), unten (180,123,49)) am Griffende, liegt VOR dem Stiel.
* Über dem Kopf (C, C2) liegt die Hacke HINTER dem Kopf (der hintere Schenkel verschwindet hinter dem Haar), sonst vor dem Körper.
Frame 0 = Original. Der Kopf bewegt sich nur zusammen mit dem vorgebeugten Oberkörper (Schlagbewegung, vom Nutzer verlangt).
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 75
F = G.Figur('sky-archeologist', (5, 8, 10, 2))
spr = F.spr
GRIFF = (10, 13)                                   # Griffende der Original-Hacke
hacke = F.da & (F.xx >= 10) & (F.yy <= 13) & ~((F.xx == 10) & (F.yy == 14))
hand = F.punkte([(8, 13), (9, 13), (8, 14), (9, 14), (10, 14)])
rumpf = F.da & ~hacke & ~hand
MANTEL = F.f(2, 22)
# Arm in der Ruhepose: karierter Streifen unter der Hand. Schulterzeile (7,15)/(8,15) bleibt in jeder Pose; der Rest wird beim Schlag durch den Körper darunter ersetzt.
ARM_REST = [(6, 16), (7, 16), (5, 17), (6, 17), (5, 18), (7, 18), (6, 19), (7, 19), (7, 20)]
ARM_FARBEN = [(F.f(7, 15), F.f(8, 15)), (F.f(6, 16), F.f(7, 16)), (F.f(5, 17), F.f(6, 17)), (F.f(5, 18), F.f(7, 18)), (F.f(6, 19), F.f(7, 19))]
OHNE_ARM = spr.copy()                               # Körper unter dem Arm fertiggezeichnet: Mantel, in Zeile 20 die helle Kante der Gürteltasche (wie (7,21))
for _x, _y in ARM_REST:
    OHNE_ARM[_y, _x, :3] = F.f(7, 21) if _y == 20 else MANTEL
H_O1, H_O2, H_U = F.f(8, 13), F.f(9, 13), F.f(8, 14)
BLITZ = F.f(6, 11)
STEIN1, STEIN2 = F.f(4, 20), F.f(3, 21)            # (131,126,121), (90,92,80)

# ---------------------------------------------------------------- Hacke: Lagen als {(dx, dy): Farbe} relativ zum Griffende
P51 = {(int(x) - GRIFF[0], int(y) - GRIFF[1]): F.f(x, y) for y, x in zip(*np.nonzero(hacke))}
P129 = {(-dx, dy): c for (dx, dy), c in P51.items()}
P39 = {(-dy, -dx): c for (dx, dy), c in P51.items()}
P141 = {(-dx, dy): c for (dx, dy), c in P39.items()}

# Handgepixelt (Zeichen: 4/6/5 = Stielfarben, 0 = Metall-Umriss, 1/2/3 = Metall-Licht dunkel → hell; G = Griffende, dort Stielfarbe 4).
# Dicke wie im Original: der schräge Original-Stiel ist je Zeile 3 px breit = gut 2 px stark → gerader Stiel 2 px; Kopfschenkel 3 px stark (schräg: 4 px je Zeile).
# HACKE_15: AUFPRALL — Stiel steigt vom Griff flach (1 px je 4 px) nach vorn an, der untere Schenkel des Kopfs zeigt steil nach unten (Spitze im Boden), der obere nach hinten oben.
HACKE_15 = """
.......00........
.......0110......
........0110.....
.........0120....
..........0220...
...........0220..
............0330.
..........6660330
......66564440330
..65664444...030.
G64444.......030.
44..........020..
............020..
...........020...
...........010...
..........010....
..........00.....
"""
# HACKE_90: Stiel senkrecht (Durchgangspose beim Ausholen und im Abschwung), Kopf symmetrisch über dem Stiel.
HACKE_90 = """
.......0000.......
......033330......
.....03300330.....
....0220640220....
...0220.64.0220...
..0120..64..0210..
.0110...54...0110.
.000....64....000.
........64........
........64........
........54........
........64........
........64........
........54........
........64........
........64........
........G4........
"""
FARBE = {'4': F.f(10, 13), 'G': F.f(10, 13), '6': F.f(10, 12), '5': F.f(17, 3), '0': F.f(10, 0), '1': F.f(11, 1), '2': F.f(13, 1), '3': F.f(16, 1)}


def raster(text):
    z = text.strip('\n').split('\n')
    gy, gx = next((y, r.index('G')) for y, r in enumerate(z) if 'G' in r)
    return {(x - gx, y - gy): FARBE[ch] for y, r in enumerate(z) for x, ch in enumerate(r) if ch != '.'}


P15, P90 = raster(HACKE_15), raster(HACKE_90)

# ---------------------------------------------------------------- Posen
# Name: (Hacke, Griffende (x, y), Hand-Ecke oben links (x, y), Ärmel-Pixel, Oberkörper-Versatz dx, Kopf-Zusatz (dx, dy), Strecken, Hacke hinter dem Körper)
# ARM (Runde 9): Der gelb-orange karierte Streifen IST der Arm. In jeder Schlag-Pose wird er von der festen Schulter ((7,15)/(8,15), bleibt am Rumpf) bis zur Hand neu gesetzt:
# Liste von Pixel-PAAREN (2 px stark wie im Original), von der Schulter zur Hand; Paar k bekommt die Farben der k-ten Originalzeile des Arms (ARM_FARBEN, Karomuster).
ARME = {
    'A2': [((8, 14), (9, 14)), ((9, 13), (10, 13))],
    'B':  [((8, 14), (9, 14)), ((9, 13), (10, 13)), ((10, 12), (11, 12)), ((11, 11), (12, 11))],
    'C':  [((8, 14), (9, 14)), ((9, 13), (10, 13)), ((10, 12), (11, 12)), ((11, 11), (12, 11)), ((11, 10), (12, 10))],
    'D1': [((8, 14), (9, 14)), ((9, 13), (10, 13)), ((10, 12), (11, 12)), ((11, 11), (12, 11)), ((11, 10), (12, 10))],
    'D2': [((9, 14), (10, 14)), ((10, 13), (11, 13))],
    'E':  [((9, 16), (10, 16)), ((9, 17), (10, 17)), ((10, 18), (11, 18)), ((10, 19), (11, 19))],
    'R1': [((10, 15), (10, 16)), ((11, 15), (11, 16))],
    'R2': None,                                     # Arm wie im Original (Ellbogen unten), nur Hand + Hacke 1 px tiefer/weiter vorn
}
POSEN = {
    'A':  None,
    'A2': (P51, (12, 11), (10, 11), ARME['A2'], 0, (0, 0), 0, False),
    'B':  (P90, (11, 10), (11, 9), ARME['B'], 0, (0, 0), 0, False),
    'C':  (P129, (11, 8), (11, 8), ARME['C'], 0, (0, 0), 1, True),
    'C2': (P141, (11, 8), (11, 8), ARME['C'], 0, (0, 0), 1, True),
    'D1': (P90, (11, 9), (11, 8), ARME['D1'], 0, (0, 0), 1, False),
    'D2': (P39, (13, 13), (12, 12), ARME['D2'], 1, (0, 0), 0, False),
    'E':  (P15, (11, 21), (11, 20), ARME['E'], 1, (1, 1), 0, False),
    'R1': (P39, (13, 16), (12, 15), ARME['R1'], 1, (0, 0), 0, False),
    'R2': (P51, (11, 14), (9, 14), ARME['R2'], 0, (0, 0), 0, False),
}
ABLAUF = ['A'] * 3 + ['A2'] * 2 + ['B'] * 2 + ['C'] * 2 + ['C2'] * 3 + ['D1', 'D2'] + ['E'] * 3 + ['R1'] * 2 + ['R2'] * 3 + ['A'] * 2
assert len(ABLAUF) == 24
AUFPRALL = 14                                       # Frame des Aufpralls im 24er-Takt
SPITZE = (21, 27)                                   # untere Hackenspitze im Aufprall (Sprite-Koordinaten)
# Splitter: je Frame nach dem Aufprall die obere linke Ecke der drei 2×2-Brocken (flache Bögen, landen auf dem Boden y 26–27)
SPLITTER = [
    [(19, 24), (22, 23), (24, 24)],
    [(17, 22), (22, 21), (25, 22)],
    [(16, 21), (23, 20), (26, 22)],
    [(15, 22), (23, 21), (26, 24)],
    [(14, 24), (24, 23), (27, 26)],
    [(14, 26), (24, 25), None],
]
BLITZ_XY = (1, -3)                                  # Ecke des Hackenkopfs in Pose C2 (ausgeholt)
TEST_EBENEN = ('koerper',)


def koerper(ob_dx, kopf, streck, q):
    """Körper ohne Hand und Hacke (q = Quelle mit oder ohne Ruhe-Arm); Oberkörper (Zeilen ≤ 21) um ob_dx vor, Kopf (Zeilen ≤ 14) zusätzlich um `kopf`."""
    unten = F.ebene(rumpf & (F.yy >= 22))
    ob = F.ebene(rumpf & (F.yy >= 15) & (F.yy <= 21), ob_dx, 0, quelle=q)
    F.setze(ob, {(8 + ob_dx, 14): MANTEL})
    kf = F.ebene(rumpf & (F.yy <= 14), ob_dx + kopf[0], kopf[1])
    k = G.ueber(G.ueber(unten, ob), kf)
    return F.streck(k, 22, streck)


def teil(pixel, dx, dy):
    a = L.leer(F.H, F.W)
    return F.setze(a, {(x + dx, y + dy): c for (x, y), c in pixel.items()})


def pose(name, splitter=None, blitz=None):
    if POSEN[name] is None:
        fig = F.ebene(F.da)
    else:
        hk, g, hd, arm, ob_dx, kopf, streck, hinten = POSEN[name]
        k = koerper(ob_dx, kopf, streck, spr if arm is None else OHNE_ARM)
        h = teil(hk, g[0], g[1] - streck)
        fig = G.ueber(h, k) if hinten else G.ueber(k, h)
        hx, hy = hd[0], hd[1] - streck
        armpix = {}
        for n, paar in enumerate(arm or []):
            for (x, y), c in zip(paar, ARM_FARBEN[(n + 1) % len(ARM_FARBEN)]):
                armpix[(x, y - streck)] = c
        # Umriss in Mantelfarbe, wo der Arm an den Hintergrund grenzt (1 px, wie überall am Sprite); über Figur/Hacke wird nichts übermalt
        rand = {(x + a, y + b) for (x, y) in armpix for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))} - set(armpix)
        F.setze(fig, {p: MANTEL for p in rand if not fig[p[1] + F.pt, p[0] + F.pl, 3]})
        F.setze(fig, armpix)
        F.setze(fig, {(hx, hy): H_O1, (hx + 1, hy): H_O2, (hx, hy + 1): H_U, (hx + 1, hy + 1): H_U})
        if blitz is not None:
            Hm.stern4(fig, BLITZ_XY[0], BLITZ_XY[1], blitz, BLITZ, BLITZ, off=F.OFF)
    if splitter:                                     # Splitter liegen HINTER Figur und Hacke
        sp = L.leer(F.H, F.W)
        for n, p in enumerate(splitter):
            if p:
                c = STEIN1 if n != 1 else STEIN2
                F.setze(sp, {(p[0] + a, p[1] + b): c for a in (0, 1) for b in (0, 1)})
        fig = G.ueber(sp, fig)
    return fig


def frame(i, nur=None):
    j = i % 24
    k = j - AUFPRALL
    sp = SPLITTER[k] if (0 <= k < len(SPLITTER) and not nur) else None
    bl = Hm.folge(i, 9, [0, 1, 0], N) if not nur else None
    return pose(ABLAUF[j], sp, bl)


if __name__ == '__main__':
    G.abschluss(F, 'Sky Archeologist', [frame(i) for i in range(N)], MS, extra={'faceX': F.pl + 6}, rand=False)
