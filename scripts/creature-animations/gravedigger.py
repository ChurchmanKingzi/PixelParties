# -*- coding: utf-8 -*-
"""Idle-Animation für „Gravedigger“ (Creature) — vermummter, bärtiger Totengräber kniet nach rechts gewandt; er greift mit dem Arm zum Spaten, der neben ihm im Boden steckt,
sticht ein, hebt Erde heraus und wirft sie weg.

PICK: [["MotiveDeri", 161, "Ebene „Gravedigger“, nur die Figur mit Spaten (Ausschnitt x 0–24, y 5–26); die acht Grabkreuze derselben Ebene sind Beiwerk"]]
Abgleich mit public/cardgen/art/Gravedigger.webp (Kartenkunst: dieselbe Figur links neben den Gräbern). Quelle vollständig.

Identifikation (25×22), nach Nutzer-Rückmeldung Runde 9 NEU gelesen:
* schwarze Kapuze (x 5–9, y 0–10), Gesicht im Profil nach rechts (Haut x 8–13, y 1–9), EIN sichtbares Auge (hellblau (11,6), weiß (11,7), Pupille (12,6)/(12,7), Braue (11,5)).
* BART: das Graue unter dem Gesicht ((13,8), (12–13,9), (12,10), Rand x 14) – gehört starr zum Kopf. KOPF UND BART BEWEGEN SICH NIE (alles mit y ≤ 10 bleibt in jedem Frame
  pixelgleich; `assert` in frame()).
* ARM: liegt darunter. Oberarm von der Schulter (Kragenband y 11–12) zum Ellbogen ((7–8, 13–14)), UNTERARM = das helle waagerechte Band auf dem Schoß (x 8–12, y 14–15,
  2 px stark, oben (104)/(80) hell, unten (80)/(64)), Ärmelende = Umriss (13, 14–15). Eine Hand ist nicht gezeichnet (steckt im Ärmel).
* graue Kutte, kniend (x 0–14, y 8–21). SPATEN: steckt in der Quelle NEBEN ihm im Boden (Stiel dunkelbraun diagonal (14,12) → (19,16), Blatt x 16–24, y 13–19) – er hält ihn nicht.

Ablauf (60 Frames à 70 ms = 4,2 s, zwei Spatenstiche je Schleife). Frame 0 = Original (Arm auf dem Schoß, Spaten steckt):
  Ruhe → Unterarm hebt sich (H) → Ärmelende fasst das Stielende (G) → Stich (Spaten +1/+1 entlang des Stiels, Blatt versinkt) → zurück → herausheben (+1/−1, +2/−2: Blatt
  VOLLSTÄNDIG über dem Boden) und Erde wegwerfen (drei 2×2-Brocken im Bogen nach rechts) → zurück in den Boden → zweiter Stich + Wurf → loslassen, Arm zurück auf den Schoß,
  Ruhe mit Blinzeln. Der Spaten bewegt sich NUR, solange das Ärmelende am Stielende liegt, und immer als starre Einheit; der Unterarm ist in jeder Pose eine eigene Pose
  (ARM_POSEN: 5 Spalten à 2 px + Ärmelende, gleiche Dicke und Farben wie im Original, 1 px Umriss), nichts wird gestreckt. Kein Atmen/Strecken des Oberkörpers mehr.
Ergänzungen (selbst fertiggezeichnet):
* Blattende (in der Quelle im Boden): Zeilen y 19–21 des Blatts in Blattfarben und Blattumriss (wie Runde 8). In Ruhe verdeckt der Boden (Zeilen > 19) das Ende.
* Schoß unter dem Unterarm (x 8–13, y 14–15): Kuttenfläche (40,40,40) mit Faltenlicht (64,64,64) in Fortsetzung von Zeile 16, Kuttenrand (12, 14–15) als Umriss.
Erdbrocken in der Erdfarbe (63,31,15) der Grabhügel derselben Ebene (dokumentierte Ausnahme, erlaubt=…), Unterkante Stielfarbe.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n9 as N9

N, MS = 60, 70
sz = N9.Szene('gravedigger', (3, 9, 5, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
STIEL = sz.ist((23, 8, 11), (37, 17, 10))
BLATT = (xx >= 16) & (yy >= 13) & sz.da
SPATEN_M = STIEL | BLATT
ERDE, ERDE2 = (63, 31, 15), (37, 17, 10)
HAUT, LID = (246, 189, 123), (0, 0, 0)
TEST_EBENEN = ('figur',)

_sp = np.where(SPATEN_M[..., None], spr, 0).astype(np.uint8)
# Blattende, das in der Quelle im Boden steckt (dort endet das Blatt mit der geraden Schnittlinie y 19): selbst fertiggezeichnet – Blattfläche bis y 20 fortgesetzt,
# gerundete Spitze y 21, Umriss (18,18,16), Flächenfarben des Blatts. In Ruhe verdeckt der Boden (Zeilen > 19) das Ende wieder → Frame 0 = Original.
_O, _A, _B, _C = (18, 18, 16), (62, 62, 53), (110, 111, 95), (44, 43, 38)
_sp = np.pad(_sp, ((0, 3), (0, 0), (0, 0)))
for y, zeile in ((19, {17: _O, 18: _A, 19: _A, 20: _B, 21: _C, 22: _B, 23: _B, 24: _O}), (20, {18: _O, 19: _A, 20: _A, 21: _B, 22: _B, 23: _O}),
                 (21, {19: _O, 20: _O, 21: _O, 22: _O})):
    for x, c in zeile.items():
        _sp[y, x] = c + (255,)
SPATEN = L.platz(_sp, sz.H, sz.W, sz.PL, sz.PT)
BODEN = sz.PT + 19                                 # Bodenlinie des Blatts: was tiefer liegt, steckt in der Erde


def spaten(dx, dy):
    """Spaten starr verschoben; unter der Bodenlinie abgeschnitten, die Schnittzeile wird Umriss (wie in der Quelle)."""
    a = N9.starr(SPATEN, dx, dy).copy()
    schnitt = (a[BODEN + 1, :, 3] > 0) & (a[BODEN, :, 3] > 0)
    a[BODEN, schnitt, :3] = _O
    a[BODEN + 1:] = 0
    return a
KOERPER = sz.teil(~SPATEN_M)

# ---------------------------------------------------------------- Arm
UMR, KUTTE, FALTE = (32, 32, 32), (40, 40, 40), (64, 64, 64)
_ohne = spr.copy()                                  # Schoß unter dem Unterarm fertiggezeichnet
for _y in (14, 15):
    for _x in range(8, 12):
        _ohne[_y, _x, :3] = KUTTE
    _ohne[_y, 12, :3] = UMR
    _ohne[_y, 13] = 0
for _x in (9, 10):
    _ohne[15, _x, :3] = FALTE
KOERPER_OHNE_ARM = sz.teil(~SPATEN_M, quelle=_ohne)
ARM_FARBEN = [((80, 80, 80), (64, 64, 64)), ((104, 104, 104), (80, 80, 80)), ((104, 104, 104), (80, 80, 80)), ((104, 104, 104), (80, 80, 80)), ((64, 64, 64), (64, 64, 64))]
# Pose: (x der ersten Unterarm-Spalte, [obere Zeile je Spalte: 5 Unterarm-Spalten + Ärmelende]); jede Spalte ist 2 px hoch. Ellbogen wandert mit dem Oberarm leicht vor.
ARM_POSEN = {
    'H':  (8, [14, 14, 14, 13, 13, 13]),            # halb gehoben, noch nicht am Stiel
    'G':  (9, [14, 14, 13, 13, 12, 12]),            # Ärmelende auf dem Stielende (14,12)
    'S':  (10, [14, 14, 14, 13, 13, 13]),           # Stich: Spaten (+1,+1)
    'L1': (10, [14, 13, 13, 12, 12, 11]),           # heben: Spaten (+1,−1)
    'L2': (11, [13, 13, 12, 12, 11, 10]),           # herausgehoben: Spaten (+2,−2)
}
SPATEN_LAGE = {'R': (0, 0), 'H': (0, 0), 'G': (0, 0), 'S': (1, 1), 'L1': (1, -1), 'L2': (2, -2)}


def arm(f, name):
    """Unterarm-Pose über den fertigen Frame legen. Kopf und Bart (y ≤ 10, x ≤ 14) werden nie berührt."""
    x0, tops = ARM_POSEN[name]
    pix, rand = {}, set()
    for k, t in enumerate(tops):
        x = x0 + k
        o, u = ARM_FARBEN[k] if k < 5 else (UMR, UMR)
        pix[(x, t)], pix[(x, t + 1)] = o, u
    for (x, y) in pix:
        rand |= {(x, y - 1), (x, y + 2), (x + 1, y), (x - 1, y)}
    for (x, y) in rand - set(pix):                  # 1 px Umriss: oben immer (wie im Original über dem Unterarm), sonst nur gegen den Hintergrund
        if y <= 10 and x <= 14:
            continue
        Y, X = sz.PT + y, sz.PL + x
        if not f[Y, X, 3] or ((x, y + 1) in pix and y >= 11):
            f[Y, X] = UMR + (255,)
    for (x, y), c in pix.items():
        assert not (y <= 10 and x <= 14)
        f[sz.PT + y, sz.PL + x] = c + (255,)
    return f


#        Ruhe      heben  fassen     Stich       zurück   heben     Wurf        senken    zurück   Stich       zurück   heben     Wurf        senken    los           Ruhe
ABLAUF = ['R'] * 4 + ['H'] * 2 + ['G'] * 2 + ['S'] * 5 + ['G'] * 2 + ['L1'] * 2 + ['L2'] * 6 + ['L1'] * 2 + ['G'] * 2 + ['S'] * 5 + ['G'] * 2 + ['L1'] * 2 + ['L2'] * 6 + ['L1'] * 2 + ['G'] * 3 + ['H'] * 2 + ['R'] * 11
assert len(ABLAUF) == N
WURF = [k for k in range(N) if ABLAUF[k] == 'L2' and ABLAUF[k - 1] != 'L2']
BROCKEN = [dict(x=sz.PL + 23, y=sz.PT + 9, vx=0.55, vy=-1.0, g=0.17, start=s + 1, dauer=11) for s in WURF] + \
          [dict(x=sz.PL + 21, y=sz.PT + 10, vx=0.30, vy=-1.2, g=0.18, start=s + 2, dauer=11) for s in WURF] + \
          [dict(x=sz.PL + 24, y=sz.PT + 10, vx=0.85, vy=-0.7, g=0.15, start=s + 2, dauer=10) for s in WURF]
BLINZELN = (53, 54)
KOPF = (slice(0, sz.PT + 11), slice(0, sz.PL + 15))


def frame(i, nur=None):
    name = ABLAUF[i % N]
    d = SPATEN_LAGE[name]
    k = KOERPER if name == 'R' else KOERPER_OHNE_ARM
    if i in BLINZELN:
        k = k.copy()
        k[sz.PT + 6, sz.PL + 11, :3] = HAUT; k[sz.PT + 7, sz.PL + 11, :3] = LID; k[sz.PT + 6, sz.PL + 12, :3] = (221, 170, 110)
    f = L.zusammen(sz.H, sz.W, [(spaten(*d), 0, 0), (k, 0, 0)])
    if name != 'R':
        f = arm(f, name)
    if i not in BLINZELN:                           # Kopf und Bart sind in jedem Frame pixelgleich mit der Quelle
        assert np.array_equal(f[KOPF], KOERPER[KOPF])
    if not nur:
        f = L.zusammen(sz.H, sz.W, [(f, 0, 0), (N9.brocken(sz.H, sz.W, i, BROCKEN, ERDE, ERDE2), 0, 0)])
    return f


if __name__ == '__main__':
    N9.fertig('gravedigger', 'Gravedigger', frame, N, MS, spr, erlaubt=[ERDE], check=[0, 4, 6, 9, 15, 17, 19, 22, 54], zoom=16)
