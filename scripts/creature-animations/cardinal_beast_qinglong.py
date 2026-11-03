# -*- coding: utf-8 -*-
"""Idle-Animation für „Cardinal Beast Qinglong“ (Creature) — der Azurdrache des Ostens: ein langer, blassblauer Wolken-/Sturmdrache mit schwarzem Umriss, dessen Kopf vorn links über einem
gehörnten Schädel schwebt; um ihn zucken Blitze.

Quellen: src/cardinal-beast-qinglong.png (Drache + Schädel, 64×54 px, 12 Farben) und src/cardinal-beast-qinglong-blitze.png (die Blitze auf der 80×73-Leinwand der Karte, 8 Farben).
PICK: [["Motive", 1548, 1], ["Motive", 1546, "im Drachen enthalten"], ["Motive", 1547, "Blitze"], ["Motive", 1544, "gelber Blitz"]]
      Gewählt wurde die Ebene „QINLONG #1“ (1548, 64×54 px): der fertig umrandete Drache INKLUSIVE Schädel/Hörnern (Ebene „QINLONG #4“, 1546, ist derselbe Schädel einzeln).
      Der Treffer des Suchlaufs (Ebene 1545 „QINLONG #6“) ist dieselbe Figur in der weich ausgeblendeten Kartenvariante (10 % durchsichtig, Dither-Innenfläche, Schweif läuft per Alpha-Verlauf
      aus, kein Umriss) — das ergäbe halbtransparente Pixel; 1548 ist die saubere Pixelart-Fassung mit geschlossenem schwarzem Umriss. Ebene 1549 („QINLONG“) sind die dunklen Sturmwolken des
      Hintergrunds, Ebene 1543 („QINLONG #2“) zwei blaue Bögen — beides Szene, nicht verwendet.
Quelle vollständig: ja (Drache mit Kopf, Schädel, Schweif, Blitze); die Blitze sind in der Kunst Teil der Karte und deshalb als eigene Ebene (Datei -blitze) mit dabei.

Aufruf:   python3 cardinal_beast_qinglong.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cardinal-beast-qinglong.png + .json

Identifikation (Drache, x/y im 64×54-Sprite; die Leinwand der Karte beginnt 7 px links und 3 px oberhalb):
* KÖRPER (x 6–63, y 0–38): langer Schlangenleib mit schwarzem Umriss (0,0,0); Füllung blassblau (197,211,219), Schattenband mittelblau (131,170,195), Lichter (230,252,255); er kommt vom Kopf links
  unten, zieht nach rechts und steigt als breiter Schweif (x 43–63) senkrecht nach oben, dessen Ende (y 0–8) sich spitz nach links auszieht.
* KOPF (x 6–22, y 19–37): runder Kopf; die zornigen AUGEN (x 8–11 und 17–20, y 29–35) sind zwei kleine X-Zeichen aus Dunkelgrau/Rosa/Weiß ((93,82,90)/(221,204,208)/(255,255,255)) — sie lesen
  sich als Augen, bleiben aber fest (kein Blinzeln: Rückfrage-Punkt).
* SCHÄDEL (x 0–27, y 33–53): hellgrauer, gehörnter Schädel/Kiefer (128,128,128)/(179,179,179)/(204,204,204)/(242,242,242) mit zwei nach oben gebogenen weißen Hörnern (x 0–2 und 25–27, y 33–41);
  er hängt unter dem Kopf.
* BLITZE (Datei -blitze, 80×73): drei lange, verzweigte cyanfarbene Blitzstämme ((0,255,255) mit weißen Kernen) links, in der Mitte und rechts; links davor ein dicker gelber Blitz
  ((255,221,128)/(237,187,92)/(254,255,218)) mit kleinen Cyan-Funken.
Metall/Gold/Edelsteine: keine (Knochenschädel) → kein Glanz (Regel 14).

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos):
* DER DRACHE SCHWEBT UND SCHLÄNGELT: der ganze Drache hebt/senkt sich ±1 px (Periode 24); darüber läuft eine Welle vom Kopf zum Schweif: jede Spalte rechts vom Hals (x ≥ 22) wandert senkrecht
  um bis zu ±3 px am Schweifende (Periode 24, Wellenlauf, Spalten 4-verbunden), Kopf und Schädel bleiben als Block beisammen. Der Drache fliegt, deshalb darf er schweben.
* SCHWEIFSPITZE: die oberen Zeilen des Schweifs (y 0–18) schwenken zusätzlich waagerecht bis ±2 px (Periode 16, Gefälle ≤ 1 px je Zeile), die ausgezogene Spitze peitscht mit.
* BLITZE (Regel 15 gilt nur für Feuer; Blitze sind harte Ein/Aus-Blitze in Pixelart): jeder Blitzstamm leuchtet nur kurz in zuckenden Schüben auf und ist sonst aus — links Frames 0–3, 5–6, 27–30;
  Mitte 0–3, 15–17, 36–40; rechts 0–4, 21–24, 43–46; der gelbe Blitz samt Cyan-Funken 0–2, 4–5, 31–34. In Frame 0 sind alle Blitze an (Original).
Keine zusätzlichen Partikel. Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quellen.
Zuschnitt: symmetrisch um die Ruhefigur (Drache + Blitze); die Welle darf den Frame höchstens 3 px vergrößern.
Ergänzungen: keine (die Blitze liegen hinter dem Drachen; die wenigen Blitzpixel, die er in der Ruhepose verdeckt, fehlen auch in der Kunst).
"""
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image

import anim_amorph as A
import anim_flieger_b as FB
import anim_gbb as G
import anim_humanoide as Hm
import anim_lib as L
import anim_untote as U

N, MS = 48, 70
GPL, GPR, GPT, GPB = 8, 8, 8, 8
DX, DY = 7, 3                                                                  # Lage des Drachen auf der 80×73-Kartenleinwand

spr = L.lade('cardinal-beast-qinglong')
BLITZ = np.array(Image.open(os.path.join(L.SRC, 'cardinal-beast-qinglong-blitze.png')).convert('RGBA'))
sh, sw = spr.shape[:2]
KH, KW = BLITZ.shape[:2]
H, W = KH + GPT + GPB, KW + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
UMRISS = (0, 0, 0)
ERLAUBT = Hm.umrissfarben(spr)

SCHAEDEL_ALT = (vorhanden & L.farbmaske(spr, [(128, 128, 128), (179, 179, 179), (204, 204, 204), (242, 242, 242)]))
BART_Y0 = 51                                                                   # ab dieser Sprite-Zeile ersetzt der selbstgezeichnete Rauschebart die Kinnspitze (Zeile 51 Abschlussumriss + Stiel (11,52–53))
SCHAEDEL = SCHAEDEL_ALT & (yy < BART_Y0)
KOERPER = vorhanden & ~SCHAEDEL_ALT
HALS_X = 22


def teil(m):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, GPL + DX, GPT + DY)


KOERPER0, SCHAEDEL0 = teil(KOERPER), teil(SCHAEDEL)

# ── Blitze: Zusammenhangskomponenten der Blitzebene, nach Lage/Farbe zu vier Gruppen geordnet ──
n_, lab, st, _ = cv2.connectedComponentsWithStats((BLITZ[..., 3] > 0).astype(np.uint8), connectivity=8)
GELB_C = [(237, 187, 92), (254, 255, 218), (255, 221, 128)]
gelb_m = L.farbmaske(BLITZ, GELB_C)
grp = np.zeros((KH, KW), np.int8)                                              # 1 links, 2 gelb+Funken, 3 Mitte, 4 rechts
for k in range(1, n_):
    comp = lab == k
    cx = st[k, 0] + st[k, 2] / 2.0
    if st[k, 4] > 200:
        grp[comp] = 1 if cx < 30 else (3 if cx < 60 else 4)
    else:
        grp[comp] = 2
grp[gelb_m] = 2
FUNKEN_M = (grp == 2) & ~gelb_m                                                # die kleinen Cyan-Funken um den gelben Blitz (zucken weiter ein/aus)
BLITZ_G = {g: L.platz(np.where(((grp == g) & ~gelb_m)[..., None], BLITZ, 0).astype(np.uint8), H, W, GPL, GPT) for g in (1, 2, 3, 4)}
GELB0 = L.platz(np.where(gelb_m[..., None], BLITZ, 0).astype(np.uint8), H, W, GPL, GPT)   # der gelbe Blitz gehört fest zum Sprite (liegt VOR dem Kopf, bleibt immer sichtbar)
AN = {1: {0, 1, 2, 3, 5, 6, 27, 28, 29, 30},
      2: {0, 1, 2, 4, 5, 31, 32, 33, 34},
      3: {0, 1, 2, 3, 15, 16, 17, 36, 37, 38, 39, 40},
      4: {0, 1, 2, 3, 4, 21, 22, 23, 24, 43, 44, 45, 46}}


# ── Rauschebart (Nutzer-Feedback Runde 3: „Den Bart sollst du nach unten selbstständig weiterzeichnen, ein langer weißer Rauschebart!“) ──
# Die graue Kinnspitze des Schädels (Sprite-Zeilen 45–51) ist der Bart. Er wird ab Zeile 51 selbst weitergezeichnet: ein langer, zottiger Strang (Sprite-Zeilen 51–72), der unten in drei
# Locken ausläuft. Farben nur aus dem Schädel (Umriss (128,128,128), Schatten (179,179,179), Fläche (204,204,204), Licht (242,242,242)). Er weht: eine Welle läuft vom Kinn zu den Spitzen
# (Zeilenversatz, Gefälle ≤ 1 px je Zeile), die drei Locken schwingen zusätzlich einzeln (≤ 1 px, nie dichter als 1 px Abstand → Umrisse werden nie doppelt/dick).
BART_J, BART_K, BART_L, BART_I = (128, 128, 128), (179, 179, 179), (204, 204, 204), (242, 242, 242)
BART_R = 22                                                                     # Zeilen 51 … 72
# Ruhepose: je Zeile Liste (Locke, xl, xr); Stamm = Locke 0 (r ≤ 11), danach drei Locken 0 (links), 1 (Mitte), 2 (rechts)
BART_ROHE = {0: [(0, 10, 17)], 1: [(0, 10, 17)], 2: [(0, 9, 18)], 3: [(0, 9, 18)], 4: [(0, 8, 18)], 5: [(0, 8, 19)], 6: [(0, 8, 19)], 7: [(0, 8, 18)], 8: [(0, 8, 19)],
             9: [(0, 8, 19)], 10: [(0, 8, 19)], 11: [(0, 8, 19)],
             12: [(0, 8, 10), (1, 12, 15), (2, 17, 19)], 13: [(0, 8, 10), (1, 12, 15), (2, 17, 19)], 14: [(0, 8, 10), (1, 12, 15), (2, 17, 19)],
             15: [(0, 8, 10), (1, 12, 15), (2, 17, 19)], 16: [(0, 9, 10), (1, 12, 15), (2, 17, 18)], 17: [(0, 9, 10), (1, 13, 15), (2, 17, 18)],
             18: [(0, 9, 9), (1, 13, 15), (2, 18, 18)], 19: [(0, 9, 9), (1, 13, 14)], 20: [(1, 13, 14)], 21: [(1, 13, 13)]}


def bart_zeile(r, dx_zeile, extra, i):
    """Pixel einer Bartzeile r (Liste (x, farbe)) — Stamm/Locken um dx_zeile (+ extra je Locke) verschoben; Strähnen (wellige Schattenlinien, helle Strähnchen) hängen an der Locke."""
    segs = BART_ROHE[r]
    xs = []
    for (k, xl, xr) in segs:
        e = extra.get((k, r), 0) if len(segs) > 1 else 0
        xs.append([k, xl + dx_zeile + e, xr + dx_zeile + e, e])
    for a, b in zip(xs, xs[1:]):                                               # mindestens 1 px Luft zwischen Locken (nie doppelte Umrisse)
        if b[1] - a[2] < 2:
            if b[3]:
                b[1] -= b[3]; b[2] -= b[3]
            if b[1] - a[2] < 2 and a[3]:
                a[1] -= a[3]; a[2] -= a[3]
    out = []
    for (k, xl, xr, _) in xs:
        w = xr - xl + 1
        for x in range(xl, xr + 1):
            p = x - xl
            if w == 1:
                c = BART_K
            elif w == 2:
                c = BART_J if p == 0 else BART_K
            elif p == 0:
                c = BART_J
            elif p == w - 1:
                c = BART_J if w >= 4 else BART_K
            else:
                ph = int(round(1.0 * math.sin(0.55 * r + 1.7 * k)))
                q = (p + ph) % 3
                c = BART_K if q == 0 else (BART_I if (q == 1 and (r + p) % 2 == 0) else BART_L)
            out.append((x, c))
    return out


def bart_dx(i):
    """{r: dx} Welle vom Kinn (r 0) zu den Spitzen: Amplitude wächst mit dem Abstand, die Spitzen hinken nach; Gefälle ≤ 1 px je Zeile."""
    ph = L.sinus(i, 48)
    d = {r: int(round(2.6 * ((r + 1) / BART_R) ** 1.3 * math.sin(ph - 0.22 * r))) for r in range(BART_R)}
    return G.kappe(d)


def bart_extra(i):
    """{(Locke, r): dx} Eigenschwung der drei Locken (≤ 1 px, wächst zur Spitze): links Periode 24, Mitte 16, rechts 48 — unabhängig voneinander."""
    ex = {}
    for k, per, vz in ((0, 24, -1), (1, 16, 1), (2, 48, 1)):
        sn = math.sin(L.sinus(i, per) + 0.9 * k)
        for r in range(12, BART_R):
            fr = (r - 11) / 10.0
            ex[(k, r)] = int(round(1.15 * fr * sn))
    return ex


def bart_ebene(i):
    """Rauschebart als Ebene auf der großen Leinwand (ohne Kopfbewegung `bob`)."""
    a = L.leer(H, W)
    ox, oy = GPL + DX, GPT + DY + BART_Y0
    dxs = bart_dx(i)
    ex = bart_extra(i)
    for r in range(BART_R):
        for (x, c) in bart_zeile(r, dxs[r], ex, i):
            if not (0 <= oy + r < H and 0 <= ox + x < W):
                raise L.ClipError(f'Bartpixel ({x},{r}) außerhalb der Leinwand')
            a[oy + r, ox + x, :3] = c
            a[oy + r, ox + x, 3] = 255
    a, _ = A.verbinde4(a)
    return a


# ── Gelber Blitz: fester Bestandteil des Sprites (liegt vor dem Kopf, bleibt dauerhaft sichtbar), ein Puls läuft ihn hinunter ──
GELB_STUFE = {(237, 187, 92): (255, 221, 128), (255, 221, 128): (254, 255, 218)}     # eine Stufe heller


def gelb_ebene(i):
    a = GELB0.copy()
    ys = np.nonzero(a[..., 3].any(axis=1))[0]
    y0, y1 = int(ys.min()), int(ys.max())
    t = (i % 24) / 12.0                                                         # Puls alle 24 Frames (zweimal je Schleife), läuft in 12 Frames hinab, dann Pause
    if t < 1.0:
        yc = y0 + t * (y1 - y0 + 6) - 3
        for y in range(y0, y1 + 1):
            if abs(y - yc) <= 2.0:
                for x in np.nonzero(a[y, :, 3])[0]:
                    c = tuple(int(v) for v in a[y, x, :3])
                    if c in GELB_STUFE:
                        a[y, x, :3] = GELB_STUFE[c]
    return a


def welle_dy(i):
    ph = L.sinus(i, 24)
    bob = int(round(1.0 * math.sin(ph + 0.0)))
    return ph, bob


KOPF_M = KOERPER & (xx <= HALS_X)
RUMPF_M = KOERPER & (xx > HALS_X)
KOPF0, RUMPF0 = teil(KOPF_M), teil(RUMPF_M)


def drache(i):
    ph, bob = welle_dy(i)
    rp = RUMPF0
    # Schweifspitze schwenkt (Zeilen y 0–18 des Sprites), vor der Welle
    s = math.sin(L.sinus(i, 16))
    dxs = G.kappe({GPT + DY + y: int(round(2.0 * s * (18 - y) / 18.0)) for y in range(0, 19)})
    rp = G.zeilen_dx(rp, dxs)

    def dy(fr):
        return 3.0 * fr * (math.sin(ph - 1.1 * fr) + math.sin(1.1 * fr))
    rp = FB.spalten_schub_4verbunden(rp, GPL + DX + HALS_X, dy, maxd=sw - 1 - HALS_X)
    return L.zusammen(H, W, [(KOPF0, 0, 0), (rp, 0, 0)]), SCHAEDEL0, bob


def frame_gross(i, nur=None):
    kp, sk, bob = drache(i)
    dr = L.zusammen(H, W, [(sk, 0, bob), (bart_ebene(i), 0, bob), (kp, 0, bob)])
    G.rand_schliessen(dr, ERLAUBT, UMRISS)                                      # Regel 16: Spaltenstufen legen Füllfarbe an der Kante frei → Umrissschwarz (Bart/Schädel: nur Grau-Umrisse)
    ebenen = []
    if not nur:
        for g in (1, 3, 4, 2):
            if i % N in AN[g]:
                ebenen.append((BLITZ_G[g], 0, 0))
    return L.zusammen(H, W, ebenen + [(dr, 0, 0), (gelb_ebene(i), 0, bob)])


def _frames(nur):
    return [frame_gross(i, nur) for i in range(N)]


TEST_EBENEN = ('drache',)
BOX = U.zuschnitt(_frames(None), _frames(TEST_EBENEN), (GPL, GPT, GPL + KW, max(GPT + KH, GPT + DY + BART_Y0 + BART_R)), zugabe=3, rand=2)
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    quelle = np.concatenate([spr.reshape(-1, 4), BLITZ.reshape(-1, 4)]).reshape(-1, 1, 4)
    n = L.pruefe(frames, quelle=quelle, min_rand=2)
    print('Pixel je Frame:', n)
    # Ruhepose = Original (Drache + Schädel + alle Blitze)
    orig = L.leer(H, W)
    orig = L.zusammen(H, W, [(BLITZ_G[1], 0, 0), (BLITZ_G[3], 0, 0), (BLITZ_G[4], 0, 0), (BLITZ_G[2], 0, 0), (SCHAEDEL0, 0, 0), (KOERPER0, 0, 0), (GELB0, 0, 0)])
    f0 = frame_gross(0)
    bart_ab = GPT + DY + BART_Y0
    dif = (np.abs(f0.astype(int) - orig.astype(int)).sum(axis=2) > 0)
    print('Ruhepose weicht vom Original ab bei', int(dif[:bart_ab].sum()), 'Pixeln oberhalb des neuen Barts (Sprite-Zeile < %d); darunter: neuer Bart' % BART_Y0)
    L.speichern('cardinal-beast-qinglong', 'Cardinal Beast Qinglong', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/cardinal-beast-qinglong-strip.png', frames, spalten=8, scale=3)
