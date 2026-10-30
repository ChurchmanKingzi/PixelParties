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
* Laubbüschel (ruhig, blattartig): Es gibt KEINE durchlaufende Welle und KEINE wandernde Aufhellung. Vier feste Büschel aus je 3 Randblättern (oben links,
  rechts oben, links unten, oben rechts; `BUESCHEL`) neigen sich nacheinander je einmal pro Schleife um 1 px nach außen (9 Frames: erst das mittlere Blatt, dann die ganze
  Gruppe, dann wieder das mittlere) und kehren zurück; dazwischen ruht jedes Büschel lange. Die Blätter sind 4-verbunden mit dem Rand und haben die Umrissfarbe A (Regel 16).
* Saum wedelt dezent: Die äußeren Blätter des Umhangsaums (y 20–23) spreizen sich auf beiden Seiten abwechselnd um höchstens 1 px nach außen (links und rechts gegenphasig,
  von oben nach unten leicht verzögert, zweimal pro Schleife).
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
ERLAUBT = Hm.umrissfarben(spr)

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


def rand_pixel(typ, werte):
    """Randpixel eine Stelle außerhalb des Sprites, 4-verbunden mit dem Rand: typ 'o' = oberhalb der Spalten x (werte), 'l'/'r' = links/rechts der Zeilen y."""
    out = []
    for w in werte:
        if typ == 'o':
            yt = int(np.nonzero(vorhanden[:, w])[0].min())
            x0, y0 = w, yt - 1
        elif typ == 'l':
            x0, y0 = int(np.nonzero(vorhanden[w])[0].min()) - 1, w
        else:
            x0, y0 = int(np.nonzero(vorhanden[w])[0].max()) + 1, w
        assert not (0 <= x0 < sw and 0 <= y0 < sh and vorhanden[y0, x0])
        nb = [(x0 + dx, y0 + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        assert any(0 <= x < sw and 0 <= y < sh and vorhanden[y, x] for x, y in nb), ('Büschelblatt ohne Randpixel', x0, y0)
        out.append((x0, y0, A))                              # Außenkante des Laubs ist im Original durchgehend A (Regel 16)
    return out


# Vier Laubbüschel (je 3 Randblätter): Start-Frame und Pixelgruppe. Jedes Büschel neigt sich einmal pro Schleife (9 Frames: Mitte → ganze Gruppe 7 Frames → Mitte),
# dazwischen ruht es lange; die Büschel wechseln sich zeitlich ab (nie zwei gleichzeitig).
BUESCHEL = {
    'oben_links': (4, rand_pixel('o', (5, 6, 7))),
    'rechts_oben': (16, rand_pixel('r', (3, 4, 5))),
    'links_unten': (28, rand_pixel('l', (10, 11, 12))),
    'oben_rechts': (39, rand_pixel('o', (10, 11, 12))),
}
BUESCHEL_VERLAUF = [1, 2, 2, 2, 2, 2, 2, 2, 1]

# Saum (Zeilen 20–23, unterhalb der Atemzeile, daher nach dem Atmen gesetzt): äußerstes Blatt je Zeile, Kette 2 px nach außen
SAUM_MAX = {20: 1, 21: 1, 22: 1, 23: 1}                      # dezent: höchstens 1 px je Zeile
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
    """Länge (0–1) der Saumspitze in Zeile r: gegenphasige Welle links/rechts, 2 Zyklen pro Schleife, von oben nach unten verzögert (dezent)."""
    env = math.sin(math.pi * i / N) ** 2
    ph = L.sinus(i, N / 2.0) - (r - 20) * 0.7 + (0.0 if seite == 'l' else math.pi)
    v = env * max(0.0, math.sin(ph))
    return 0 if v < 0.45 else 1


def frame(i, blaetter=True):
    k = teil(vorhanden)
    # --- Laubbüschel: wenige feste Gruppen von Randblättern, die sich selten und langsam um 1 px nach außen neigen und zurückkehren ---
    for name, (start, gruppe) in BUESCHEL.items():
        stufe = Hm.folge(i, start, BUESCHEL_VERLAUF, N)
        if stufe:
            px = gruppe if stufe == 2 else [gruppe[len(gruppe) // 2]]
            Hm.setze(k, {(x, y): c for (x, y, c) in px}, OFF)
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
                Hm.setze(k, {(x, y): A for (x, y) in pixel[:n]}, OFF)
    Hm.kontur_schliessen(k, ERLAUBT, A)                          # Regel 16: Außenkante in jeder Pose in Umrissfarbe
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
