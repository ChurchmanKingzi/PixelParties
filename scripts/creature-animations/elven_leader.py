# -*- coding: utf-8 -*-
"""Idle-Animation für „Elven Leader“ (Creature) — die Elfe im Blätterumhang in der Mitte des Kartenmotivs.

Quelle: src/elven-leader.png (15×26 px, 21 Farben).
PICK: [["MotiveGrailWar", 555, 3]]      (Ebene „Elven Leader“, Figur 3; Figur 1 und 2 sind die beiden Bogenelfen links/rechts
                                         daneben = der „Elven Archer“, gespiegelt — gehören nicht zu diesem Sprite)

Aufruf:   python3 elven_leader.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/elven-leader.png + .json

Was im Sprite ist (x, y im 15×26-Sprite):
* Blätterkapuze/-haar (y 0–14, links x 1–4, rechts x 10–14): Laubmuster in vier Grünstufen
  A (77,109,44) < C (94,149,21) < D (151,203,66) < E (175,232,91).
* Gesicht (y 7–13): Hautfarben H/L/I/P/M. Augen je 2×2: links (5–6, 9–10), rechts (9–10, 9–10): hellblau (5/10, 9), weiß (5/10, 10),
  schwarze Pupille (6/9, 9), grüne Iris (6/9, 10); schwarze Wimpern/Brauen (5,8) und (10,8). Mundwinkel/Kinnschatten dunkelbraun (5,12), (10,12).
* Spitze Ohren links (1,5–8)+(2,7–8) und rechts (13–14,7–8): dunkler Umriss mit Haut, schauen aus dem Laub (bleiben fest, weil sie
  größtenteils vom Laub verdeckt sind).
* Hals/Kragen (6–9, 13–14), Hände seitlich am Körper (links 1–2, 15–18; rechts 12–13, 16–17, mit dunklem Umriss), braune Riemen/Gürtel
  (dunkelbraun B (49,24,0), y 15–19), Hose braun-grau (4–10, 19–24) mit schwarzem Spalt zwischen den Beinen (7–8, 21–24), Stiefel F (46,45,36)
  (3–6 und 9–12, y 24–25), Laubsaum des Umhangs links (x 0–4) und rechts (x 11–14), y 19–23.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Die Brust hebt sich zuerst um 1 px (Hosenzeile 20 wird einmal doppelt
  eingefügt: Kapuze, Gesicht, Arme, Umhang steigen, Beine/Stiefel bleiben), der Kopf läuft 3 Frames nach und hebt sich um ein weiteres px
  (Halszeile 14 verlängert) — Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0 (das ist zugleich das leichte Nicken).
* Laubwogen: Eine fortlaufende Welle läuft dreimal pro Schleife (Periode 16 Frames) diagonal (s = x + 0,6·y) von links oben nach rechts
  unten über Kapuze und Umhang, mit weicher Hüllkurve (in Frame 0 überall 0). Auf der Welle (a) stehen Blattspitzen am Rand der Kapuze
  (Oberkante, Seiten, 1–2 px lang, `KETTEN`, aus der Randlinie des Sprites errechnet, jede 4-verbunden mit dem Rand, in A/C/D) und (b) ist
  das Laub eine bzw. zwei Stufen der vorhandenen Grünrampe heller.
* Saum wedelt: Die äußeren Blätter des Umhangsaums (y 20–23) spreizen sich auf beiden Seiten abwechselnd 1–2 px nach außen (links und
  rechts gegenphasig, von oben nach unten mit Verzögerung), ebenfalls dreimal pro Schleife.
* Blinzeln (Frames 20–22 und 41–43): Lid über der oberen Augenreihe, dann zu (schwarzer Strich auf Zeile 10).
* Blick: kurz nach links (Frames 8–13: linkes Auge tauscht Pupille/Iris mit Hellblau/Weiß) und später nach rechts (Frames 31–35, rechtes Auge).
* Acht Blätter lösen sich vom Umhang und segeln langsam herab (4 links, 4 rechts; 3 Ovale 'o' und 5 Funken 'k', L.puff_ebene, wachsen/schrumpfen,
  Farben der Grünrampe, hinter der Figur, über die Schleife gleichmäßig versetzt).
Frame 0 = Original (Ruhepose), die Blätter ausgenommen. Kontrolle: anim_humanoide.ruhepose; Nähte: anim_humanoide.eckkontakte.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine nötig (nichts wird verschoben, nur Pixel am Rand/Saum dazugesetzt, Kopf/Arme fahren gemeinsam; Gesicht und Hände bleiben).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 10, 10, 6, 3

spr = L.lade('elven-leader')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
vorhanden = L.deckend(spr)

A, C, D, E = (77, 109, 44), (94, 149, 21), (151, 203, 66), (175, 232, 91)       # Laubrampe dunkel → hell
RAMPE = [A, C, D, E]
HAUT, SCHWARZ = (246, 189, 123), (0, 0, 0)
HELLBLAU, WEISS, IRIS = (172, 213, 255), (246, 255, 255), (41, 123, 0)

# Blinzeln: halb = obere Augenreihe von der Haut (Lid) bedeckt; zu = zusätzlich schwarzer Strich auf Zeile 10
LID = {(5, 9): HAUT, (6, 9): HAUT, (9, 9): HAUT, (10, 9): HAUT}
AUGE_ZU = {**LID, (5, 10): SCHWARZ, (6, 10): SCHWARZ, (9, 10): SCHWARZ, (10, 10): SCHWARZ}
# Blick zur Seite: im Ruhezustand liegen beide Pupillen innen (links x 6, rechts x 9). Blick nach links: linkes Auge tauscht die
# Spalten (Pupille + Iris nach außen auf x 5, Hellblau/Weiß nach innen); Blick nach rechts: rechtes Auge (Pupille auf x 10).
BLICK_LINKS = {(5, 9): SCHWARZ, (6, 9): HELLBLAU, (5, 10): IRIS, (6, 10): WEISS}
BLICK_RECHTS = {(9, 9): HELLBLAU, (10, 9): SCHWARZ, (9, 10): WEISS, (10, 10): IRIS}


def farbe_fuer(x, y, spitze):
    """Spitzenfarbe aus der Grünrampe, deterministisch (erstes Pixel dunkler, Spitze heller)."""
    h = (x * 5 + y * 3) % 4
    erst = (A, C, A, C)[h]
    zweit = (C, D, D, A)[h]
    return erst if spitze == 0 else zweit


def baue_ketten():
    """Blattspitzen-Ketten (je 2 Pixel nach außen) an der Randlinie des Sprites. Jede Kette hängt 4-verbunden am Rand."""
    ketten = []
    top = [x for x in range(2, 14) if vorhanden[:5, x].any()]
    for x in top:
        yt = int(np.nonzero(vorhanden[:, x])[0].min())
        if yt <= 3:
            ketten.append([(x, yt - 1), (x, yt - 2)])
    for y in (1, 2, 3, 4, 10, 11, 12):                      # links (Ohr-/Armzeilen 5–9 und ab 13 bleiben aus)
        xs = np.nonzero(vorhanden[y])[0]
        ketten.append([(int(xs.min()) - 1, y), (int(xs.min()) - 2, y)])
    for y in (1, 2, 3, 4, 5, 6, 10, 11, 12):                # rechts
        xs = np.nonzero(vorhanden[y])[0]
        ketten.append([(int(xs.max()) + 1, y), (int(xs.max()) + 2, y)])
    out = []
    for ch in ketten:
        (x0, y0), (x1, y1) = ch
        assert not (0 <= x0 < sw and 0 <= y0 < sh and vorhanden[y0, x0]) and not (0 <= x1 < sw and 0 <= y1 < sh and vorhanden[y1, x1])
        dx, dy = x0 - x1, y0 - y1                            # Richtung nach innen (vom zweiten zum ersten Pixel)
        nb = (x0 + dx, y0 + dy)                              # das Randpixel, an dem die Kette hängt
        assert 0 <= nb[0] < sw and 0 <= nb[1] < sh and vorhanden[nb[1], nb[0]], ('Kette ohne Randpixel', ch)
        out.append({'px': [(x0, y0, farbe_fuer(x0, y0, 0)), (x1, y1, farbe_fuer(x1, y1, 1))], 's': x0 + 0.6 * y0})
    return out


KETTEN = baue_ketten()

# Saum (Zeilen 20–23, unterhalb der Atemzeile, daher nach dem Atmen gesetzt): äußerstes Blatt je Zeile, Kette 2 px nach außen
SAUM_MAX = {20: 1, 21: 2, 22: 2, 23: 2}                      # maximale Länge je Zeile (oben kürzer)
SAUM = {'l': [], 'r': []}
for r in SAUM_MAX:
    xs = np.nonzero(vorhanden[r, :])[0]
    # äußerste Laubpixel (Zeile 23: Stiefelumriss F liegt innen, Laub außen) — links xs.min(), rechts xs.max()
    xl, xr = int(xs.min()), int(xs.max())
    SAUM['l'].append((r, xl, [(xl - 1, r), (xl - 2, r)]))
    SAUM['r'].append((r, xr, [(xr + 1, r), (xr + 2, r)]))
for seite in SAUM.values():
    for (r, xe, pixel) in seite:
        assert vorhanden[r, xe] and not any(0 <= x < sw and vorhanden[r, x] for x, _ in pixel)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def saum_stufe(r, i, seite):
    """Länge (0–2) der Saumspitze in Zeile r: gegenphasige Welle links/rechts, 3 Zyklen pro Schleife, von oben nach unten verzögert."""
    env = math.sin(math.pi * i / N) ** 2
    ph = L.sinus(i, N / 3.0) - (r - 20) * 0.7 + (0.0 if seite == 'l' else math.pi)
    v = env * max(0.0, math.sin(ph))
    return 0 if v < 0.2 else (1 if v < 0.6 else 2)


def frame(i, blaetter=True):
    k = teil(vorhanden)
    # --- Laubwogen: Welle über die Diagonale s = x + 0,6·y ---
    Hm.heller(k, lambda x, y: Hm.laubwelle(x + 0.6 * y, i, N, 11.0, 3) > 0.55, RAMPE, OFF)
    Hm.heller(k, lambda x, y: Hm.laubwelle(x + 0.6 * y, i, N, 11.0, 3) > 0.88, RAMPE, OFF)
    for ch in KETTEN:
        v = Hm.laubwelle(ch['s'], i, N, 9.0, 3)
        n = 0 if v < 0.22 else (1 if v < 0.62 else 2)
        if n:
            Hm.setze(k, {(x, y): c for (x, y, c) in ch['px'][:n]}, OFF)
    # --- Blinzeln, Blick ---
    bl = Hm.folge(i, 20, [LID, AUGE_ZU, LID], N) or Hm.folge(i, 41, [LID, AUGE_ZU, LID], N)
    if bl:
        Hm.setze(k, bl, OFF)
    if Hm.takt(i, N, 8, 6):
        Hm.setze(k, BLICK_LINKS, OFF)
    if Hm.takt(i, N, 31, 5):
        Hm.setze(k, BLICK_RECHTS, OFF)
    # --- Auf und ab: Brust zuerst (Hosenzeile 20), Kopf 3 Frames später (Halszeile 14) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 20, PAD_T + 14, brust, kopf)
    # --- Saum wedelt (Zeilen 20–23 liegen nach dem Atmen an ihrem Platz) ---
    for seite, liste in SAUM.items():
        for (r, xe, pixel) in liste:
            n = min(SAUM_MAX[r], saum_stufe(r, i, seite))
            if n:
                col = (C, D)
                Hm.setze(k, {(x, y): col[j] for j, (x, y) in enumerate(pixel[:n])}, OFF)
    ebenen = []
    if blaetter:
        # acht Blätter: vier links, vier rechts; 'o' = Oval, 'k' = Funke; Lebensdauer = Schleife, gleichmäßig versetzt
        links = [dict(x=PAD_L - 3, y=PAD_T + 3, vx=-1, vy=17, off=0, form='o', wackeln=1.5),
                 dict(x=PAD_L - 5, y=PAD_T + 9, vx=1, vy=14, off=12, form='k', wackeln=2),
                 dict(x=PAD_L - 2, y=PAD_T + 12, vx=-2, vy=12, off=24, form='k', wackeln=1.5),
                 dict(x=PAD_L - 5, y=PAD_T + 2, vx=0, vy=19, off=36, form='k', wackeln=2)]
        rechts = [dict(x=PAD_L + 17, y=PAD_T + 5, vx=1, vy=16, off=6, form='o', wackeln=1.5),
                  dict(x=PAD_L + 19, y=PAD_T + 10, vx=-1, vy=13, off=18, form='k', wackeln=2),
                  dict(x=PAD_L + 16, y=PAD_T + 13, vx=2, vy=11, off=30, form='o', wackeln=1.5),
                  dict(x=PAD_L + 19, y=PAD_T + 1, vx=0, vy=18, off=42, form='k', wackeln=2)]
        ovale = [p for p in links + rechts if p['form'] == 'o']
        funken = [p for p in links + rechts if p['form'] == 'k']
        ebenen.append((L.puff_ebene(H, W, i, N, ovale, {'c': D, 'r': C}), 0, 0))
        ebenen.append((L.puff_ebene(H, W, i, N, funken, {'c': E, 'r': D}), 0, 0))
    ebenen.append((k, 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frame(0, blaetter=False), spr, OFF)
    print('Ruhepose (ohne Blätter) weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    ohne = [frame(i, blaetter=False) for i in range(N)]
    e0 = Hm.eckkontakte(ohne[0])
    neu = {i: sorted(Hm.eckkontakte(f) - e0) for i, f in enumerate(ohne) if Hm.eckkontakte(f) - e0}
    print('neue Eckkontakte (Figur ohne Blätter) gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('elven-leader', 'Elven Leader', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/elven-leader-strip.png', frames, spalten=12, scale=5)
