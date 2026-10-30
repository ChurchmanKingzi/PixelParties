# -*- coding: utf-8 -*-
"""Idle-Animation für „Chaorc Pyre Grill Master“ (Creature) — der rotkapuzige Grillmeister mit dem Spieß am Scheiterhaufen.

Quelle (zusammengesetzt aus drei Ebenen derselben Datei, Positionen aus der Kartenkunst Chaorc_Pyre_Grill_Master.png abgeglichen):
PICK: [["MotiveHawaii", 123, 1], ["MotiveHawaii", 129, 1], ["MotiveHawaii", 122, 1]]
  * Ebene 123 (50×33 px): das Feuer (Flammenfächer, 4 Farben) bei (12, 0) im 62×41-Sprite  → src/chaorc-pyre-grill-master-feuer.png
  * Ebene 129 (16×20 px): der Koch (rote Kapuzenfigur) bei (0, 21)                           → src/chaorc-pyre-grill-master-koch.png
  * Ebene 122 (12×8 px): ein Stück des Spießes; der Spieß besteht in der Kunst aus drei überlappenden Kopien bei (10,28), (14,26), (18,24) → src/…-spiess.png
  Der zusammengesetzte Sprite (Ruhepose) liegt als src/chaorc-pyre-grill-master.png (62×41 px, 22 Farben). Nicht verwendet: die Grillspieße unter dem Feuer und
  die Ebenen 127/128 (zweite Flammenpose, kleine Köche) — Beiwerk der Kartenkunst.
Aufruf:   python3 chaorc_pyre_grill_master.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/chaorc-pyre-grill-master.png + .json

Was im Sprite ist (x, y im 62×41-Sprite):
* FEUER (x 12–61, y 0–32): ein breiter Flammenfächer in vier Farben: Rot (202,44,41) = Außenhaut/Spitzen, Orange (244,123,34), Gelb (246,231,14), Creme (247,245,184) = heller Kern.
  Oben gezackt (Zungenspitzen), innen ein kreuzförmiges helles Muster, unten läuft er auf einer Linie bei y ≈ 29–31 aus.
* KOCH (x 0–15, y 21–40): rote Kapuzenfigur; Kapuze mit spitzem Zipfel links (Zeile 25–26), dunkle Gesichtsöffnung rechts ((10–11, 25–26) schwarz), Robe in Dunkelrot (38,0,0)…(161,0,0)
  mit grauen Gürteln/Trägern (38,38,38)/(54,54,54) und braunem Saum (y 37–38). Umriss (38,0,0). Ein Gesicht/Auge ist NICHT erkennbar (schwarze Öffnung) → kein Blinzeln.
* SPIESS (x 4–29, y 21–36): schräger brauner Stab (Umriss (39,22,23), Holz (144,79,44), Licht (172,134,79)), vom Bauch des Kochs ins Feuer.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* FEUER wie Feuer (Regel 15, volle Form, Modul anim_feuer.py): Der Fächer wird aus 16 Flammenzungen (alle 3 px, Fuß = Unterkante der Spalte, Höhe = Spaltenhöhe des Originals) NEU gezeichnet.
  Jede Zunge hat fünf Farbschichten (Rot-Außenhaut, Rot, Orange, Gelb, Creme-Kern) mit EIGENER Höhe, Breite und Seitenverschiebung je Pose; die Kerne wandern auf und ab und hin und her,
  die ganze Zunge biegt sich, wächst und schrumpft, schmale Zungen spalten ihre Spitze und verschmelzen wieder. Jede Zunge hat eine eigene Folge aus 12 Posen zu 2–3 Frames (gegeneinander versetzt,
  nahtlos über 48 Frames). Fällt eine hohe Zunge zurück, reißt ihre Spitze ab und steigt als runder Funke (1 px) auf, kühlt dabei ab (hell → gelb → orange → rot). Randpixel der Flamme sind immer
  Rot (Regel 16). Kein Lichtband, keine Sterne, kein Glitzern (Regel 14/15). Das Feuer wird neu gezeichnet und weicht daher schon in Frame 0 vom Original ab.
* Auf und ab des Kochs (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (Robenzeile 12 des Kochs wird einmal doppelt eingefügt), die Kapuze läuft 3 Frames nach und hebt sich um
  ein weiteres px (Zeile 8 verlängert): Kapuze 0 → 1 → 2 → 1 → 0 px, Körper 0 → 1 → 0. Der Spieß steigt mit der Brust (Hand am Bauch).
* Spieß wird geschoben/gedreht: Der Spieß gleitet entlang seiner Achse (je Schritt 2 px nach rechts, 1 px nach oben) hin und her (0 → 2 → 0 Schritte, Periode 24, gegen den Auf-und-ab-Takt versetzt),
  so „rührt“ der Koch im Feuer; er liegt wie im Original vor Koch und Feuer (Koch und Feuer liegen darunter vollständig, daher keine Lücken).
* Funken (Feuer) siehe oben. Keine weiteren Partikel. Dünne schräge Spitzen, die nur über eine Pixelecke hingen (≤ 40 px), bekommen ein rotes Brückenpixel (4-Verbund).
Frame 0 = Ruhepose bis auf das neu gezeichnete Feuer. Kontrolle: anim_humanoide.ruhepose (Koch), Randpixel-Test (randtest.py).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (der Koch liegt vollständig als eigene Ebene vor; der Spieß ist drei Kopien der Originalebene).
"""
import sys

import numpy as np

import anim_feuer as FEU
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 6, 8, 26, 3

spr = L.lade('chaorc-pyre-grill-master')                     # zusammengesetzte Ruhepose (Referenz, Randpixel-Test)
FEUER0 = L.lade('chaorc-pyre-grill-master-feuer')
KOCH = L.lade('chaorc-pyre-grill-master-koch')
SPIESS = L.lade('chaorc-pyre-grill-master-spiess')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
KOCH_POS = (0, 21)                                           # Kochebene im Sprite
FEUER_POS = (12, 0)
SPIESS_POS = [(10, 28), (14, 26), (18, 24)]                  # drei überlappende Kopien (Reihenfolge: unten links → oben rechts)

ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
RAMPE = {'rand': ROT, 'rot': ROT, 'orange': ORANGE, 'gelb': GELB, 'hell': CREME}
KOCH_UMRISS = (38, 0, 0)
ERLAUBT_KOCH = Hm.umrissfarben(KOCH)
ERLAUBT = Hm.umrissfarben(spr)                               # Außenkantenfarben der Ruhepose (Randpixel-Test)
FEUERFARBEN = {ROT, ORANGE, GELB, CREME}

# ── Feuer: Zungen aus dem Profil des Originalfächers ──
fm = np.zeros((sh, sw), bool)
for y in range(FEUER0.shape[0]):
    for x in range(FEUER0.shape[1]):
        if FEUER0[y, x, 3]:
            fm[y + FEUER_POS[1], x + FEUER_POS[0]] = True
prof = {x: (int(np.nonzero(fm[:, x])[0].min()), int(np.nonzero(fm[:, x])[0].max())) for x in range(sw) if fm[:, x].any()}
ZUNGEN = []
for x0 in range(14, 61, 3):
    xs = [x for x in range(x0 - 1, x0 + 2) if x in prof]
    if not xs:
        continue
    oben = min(prof[x][0] for x in xs)
    unten = max(prof[x][1] for x in xs)
    ZUNGEN.append(FEU.Zunge(x0 + PAD_L, unten + PAD_T, unten - oben + 1, 3.4))
# Koch ist fest im Weg (Feuer wird nicht über ihn gezeichnet); der Spieß liegt davor und wird nicht ausgespart (Feuer darunter, kein Loch beim Gleiten)
sperre = np.zeros((H, W), bool)
for y in range(KOCH.shape[0]):
    for x in range(KOCH.shape[1]):
        if KOCH[y, x, 3]:
            sperre[y + KOCH_POS[1] + PAD_T, x + KOCH_POS[0] + PAD_L] = True
FEUER = FEU.Feuer(H, W, ZUNGEN, RAMPE, n=N, seed=5, posen=12, amplitude=1.0, sperre=sperre)


def bruecken(fig):
    """Dünne schräge Flammenspitzen, die nur über eine Pixelecke am Rest hängen (kleine Teile ≤ 40 px), bekommen ein Brückenpixel in Außenhautrot,
    damit alles 4-verbunden bleibt (Regel 11). Gilt nur für Teile, die diagonal an das große Hauptstück grenzen."""
    import cv2
    m = (fig[..., 3] > 0).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=4)
    if n <= 2:
        return fig
    haupt = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    for c in range(1, n):
        if c == haupt or stats[c, cv2.CC_STAT_AREA] > 40:
            continue
        ys, xs = np.nonzero(lab == c)
        gefunden = False
        for y, x in zip(ys, xs):
            for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < H and 0 <= nx < W and lab[ny, nx] == haupt:
                    for by, bx in ((y, nx), (ny, x)):
                        if not fig[by, bx, 3]:
                            fig[by, bx, :3] = ROT
                            fig[by, bx, 3] = 255
                            gefunden = True
                            break
                if gefunden:
                    break
            if gefunden:
                break
        if not gefunden:                                     # kleiner Abstand (≤ 3 px): kürzester Weg (erst waagerecht, dann senkrecht) in Außenhautrot füllen
            qy, qx = np.nonzero(lab == haupt)
            beste = None
            for y, x in zip(ys, xs):
                d = np.abs(qy - y) + np.abs(qx - x)
                k = int(np.argmin(d))
                if beste is None or d[k] < beste[0]:
                    beste = (int(d[k]), (int(y), int(x)), (int(qy[k]), int(qx[k])))
            if beste and beste[0] <= 5:
                (y0, x0), (y1, x1) = beste[1], beste[2]
                weg = [(y0, x) for x in range(x0, x1, 1 if x1 > x0 else -1)] + [(y, x1) for y in range(y0, y1, 1 if y1 > y0 else -1)]
                for (wy, wx) in weg:
                    if not fig[wy, wx, 3]:
                        fig[wy, wx, :3] = ROT
                        fig[wy, wx, 3] = 255
    return fig


def spiess_ebene(dx, dy):
    e = L.leer(H, W)
    for (cx, cy) in SPIESS_POS:
        e = L.einsetzen(e, SPIESS, PAD_L + cx + dx, PAD_T + cy + dy)
    return e


def frame(i, funken=True):
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    # --- Koch: auf der vollen Leinwand, zweistufiges Auf und ab (Robenzeile 12, Kapuzenzeile 8 des Kochs) ---
    koch = L.platz(KOCH, H, W, PAD_L + KOCH_POS[0], PAD_T + KOCH_POS[1])
    koch = Hm.atmen(koch, PAD_T + KOCH_POS[1] + 12, PAD_T + KOCH_POS[1] + 8, brust, kopf)
    Hm.kontur_schliessen(koch, ERLAUBT_KOCH, KOCH_UMRISS)       # Regel 16
    # --- Spieß gleitet entlang seiner Achse (2 px rechts, 1 px hoch je Schritt), steigt mit der Brust ---
    s = int(round(2.0 * Hm.welle01(i - 6, N / 2)))              # 0 … 2 Schritte
    sp = spiess_ebene(2 * s, -s - brust)
    fig = L.zusammen(H, W, [(FEUER.ebene(i), 0, 0), (koch, 0, 0), (sp, 0, 0)])
    fig = bruecken(fig)
    # Regel 16: Randpixel in Nicht-Umrissfarbe (z. B. Flammenpixel, die an den hochgehobenen Koch grenzen) werden Umriss: Flamme → Rot, sonst Kochumriss
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = ROT if c in FEUERFARBEN else KOCH_UMRISS
    if funken:
        return L.zusammen(H, W, [(fig, 0, 0), (FEUER.funken(i), 0, 0)])
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('chaorc-pyre-grill-master', 'Chaorc Pyre Grill Master', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/chaorc-pyre-grill-master-strip.png', frames, spalten=12, scale=3)
