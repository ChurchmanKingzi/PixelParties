# -*- coding: utf-8 -*-
"""Idle-Animation für „Tuscan Artist“ (Creature) — der Künstler mit dem Gemälde als Kopf, der sein Bild malt.

Quelle: src/tuscan-artist.png (24×37 px, 27 Farben).
PICK: [["MotiveGrailWar", 198, 1]]      (Ebene „Tuscan Artist“, Figur 1)

Aufruf:   python3 tuscan_artist.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/tuscan-artist.png + .json

Was im Sprite ist (x, y im 24×37-Sprite):
* KOPF = ein gerahmtes Gemälde (x 6–19, y 0–12): goldener Rahmen (hell G (232,200,136) oben/unten, Seiten P/F, Schatten O/J, dunkle Außenkante S (103,64,32) links,
  Q (63,31,15) rechts), darin ein Windrad-Bild (x 8–17, y 3–10): links rot H, oben blau W/T, rechts grün X/M, unten rechts orange L, in der Mitte ein graulila Fleck R.
  Der Künstler hat KEIN Gesicht — keine Augen/Brauen.
* Schwarzer Kragen/Halstuch (x 5–15, y 12–19) unter dem Bild, graue Puffärmel-Schultern (x 2–5 und 16–22, y 13–20).
* Arme: kurze Ärmel, unten nackte braune Unterarme/Hände (J/Y/a) links (2–5, 21–25) und rechts (19–22, 21–25); die linke Hand hält einen PINSEL (x 3–6, y 26–31: Griff grau D/B,
  Zwinge/Spitze hell V/Z bei (4–5,30), dunkle Umrisse A). Die rechte Hand ist leer.
* Overall/Anzug grau (y 20–34), Beine ab Zeile 34 getrennt, Schuhe mit silbernen/weißen Kappen (Z/V, y 35).

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos) — der Künstler MALT sein Gemälde:
* Der SICHTBARE Arm bleibt, wo er ist: die linke Hand und der Pinsel hängen unverändert wie im Sprite (sie steigen nur mit dem Körper beim Auf und ab). Es wird KEIN Arm gezeichnet.
  Der malende Arm ist der vorgestreckte, vom Körper verdeckte rechte Arm — er wird nur ANGEDEUTET: eine kleine Pinselspitze (3 Kernpixel in Quellfarben: Stielgrau (161,147,144), Zwinge V (189,189,189),
  Borsten Z (225,215,217), dazu ein A-Umriss) taucht links am Rand des Rahmens auf, tupft und taucht wieder ab. Sie liegt auf der Zeile der gerade bemalten Farbzeile (Bildzeilen 4 … 9) und steigt mit dem Bild.
* Mal-Rhythmus (Frames 5–45): Frame 5/6 die Spitze schwebt heran (x 3 → 4), Frames 7–24 sechs Tupfer von oben nach unten (Zeilen 4 → 9), pro Tupfer 3 Frames: Spitze am Rahmenrand (x 5), TUPFEN (x 6, die Spitze
  liegt 1 px über der dunklen Rahmenkante), zurück (x 5). Im Tupf-Frame färbt sich die Farbzeile (x 8–10) um: Zeile 4 blau→grün, 5 blau→orange, 6 rot→blau, 7 rot→grün, 8 rot→orange, 9 rot→blau.
  Frames 25–42: derselbe Weg von unten nach oben, dabei werden die Zeilen wieder in den Originalfarben übermalt. Frames 43/44 die Spitze schwebt ab (x 4 → 3), 45–47 keine Spitze, Frame 48 = Frame 0 (nahtlos).
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (Zeile 32 des Anzugs wird einmal doppelt eingefügt: Schultern, Arme, Pinsel und Bild steigen, Beine/Schuhe bleiben),
  das Bild läuft 3 Frames nach und hebt sich um ein weiteres px (Zeile 13, Schulterlinie, wird verlängert): Bild 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Gold glänzt (Regel 14: Gold/Metall): ein Lichtband läuft zweimal pro Schleife diagonal über den Rahmen (Frames 2–15 und 26–39, 1–2 Stufen heller auf der Goldrampe); je ein vierzackiger Glitzer-Stern an
  der Außenkante des Rahmens (oben links Frames 8–11, rechte Kante 22–25, oben rechts 36–39). Die silbernen Schuhkappen glänzen: ein heller Pixel Z wandert viermal pro Schleife über die Kappen.
KEINE Partikel (Farbtupfer entfernt), KEIN Windrad (durch das Malen ersetzt).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 5, 6, 7, 3

spr = L.lade('tuscan-artist')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


# Farben des Sprites
Z, V, UMRISS = f(7, 35), f(8, 35), f(3, 28)         # Z (225,215,217) weiß, V (189,189,189) silber, A (23,21,22) Umriss
HAUT_J, HAUT_Y = f(2, 21), f(3, 23)                 # J (156,105,62) Hautbraun, Y (245,203,161) Hautlicht
GOLD = [(63, 31, 15), (103, 64, 32), (136, 95, 49), (156, 105, 62), (175, 127, 64), (199, 159, 97), (232, 200, 136)]
G_HELL, P_GOLD = GOLD[-1], GOLD[-2]

# Rahmen: Goldpixel im Kopfbereich (Zeilen 0–12, x 6–19)
rahmen = np.zeros((sh, sw), bool)
for _y in range(0, 13):
    for _x in range(6, 20):
        if vorhanden[_y, _x] and tuple(int(v) for v in spr[_y, _x, :3]) in GOLD:
            rahmen[_y, _x] = True

KANTE0 = Hm.kantenmaske(spr)
ERLAUBT = Hm.umrissfarben(spr)                       # Farben der Außenkante im Original (Regel 16)
rahmen &= ~KANTE0                                    # Lichtband nur auf Innenpixel des Rahmens, die Randpixel (Umriss) bleiben unverändert

koerper = vorhanden                                   # der ganze Körper inkl. linker Hand und Pinsel bleibt unverändert

# Malzellen (x 8–10): Zeile, Farbe vorher (Original), Farbe nachher
ZELLEN = [(4, f(8, 4), f(12, 9) if False else f(16, 5)),         # blau → grün (M)
          (5, f(8, 5), f(12, 9)),                                # blau → orange (L)
          (6, f(8, 6), f(8, 4)),                                 # rot → blau (T)
          (7, f(8, 7), f(16, 5)),                                # rot → grün
          (8, f(8, 8), f(12, 9)),                                # rot → orange
          (9, f(8, 9), f(8, 4))]                                 # rot → blau
ZELLE_X = (8, 9, 10)

# Schuhkappen: Z wandert von außen nach innen
KAPPE_L = [(7, 35), (8, 35), (9, 35), (10, 35)]
KAPPE_R = [(17, 35), (16, 35), (15, 35), (14, 35)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def pinsel_pose(i):
    """(zelle, xt) der angedeuteten Pinselspitze in Frame i oder None: zelle = Index der Farbzeile (Bildzeile ZELLEN[zelle][0]), xt = x der Borstenspitze (Sprite)."""
    if i in (5, 6):
        return 0, i - 2                                     # schwebt heran (x 3, 4)
    if 7 <= i <= 24:
        return (i - 7) // 3, (5, 6, 5)[(i - 7) % 3]         # Tupfer vorwärts: Rand, TUPFEN, zurück
    if 25 <= i <= 42:
        return 5 - (i - 25) // 3, (5, 6, 5)[(i - 25) % 3]    # Tupfer rückwärts
    if i in (43, 44):
        return 0, 47 - i                                    # schwebt ab (x 4, 3)
    return None


def tupf_frame(i):
    """Der Frame, in dem die Spitze auftupft (x 6), sonst None."""
    p = pinsel_pose(i)
    return p[0] if p and p[1] == 6 else None


def gemalt(i, c):
    """Ist Zelle c in Frame i umgefärbt? (vom Auftupf-Frame der Vorwärtsstriche bis zum Auftupf-Frame der Rückwärtsstriche)"""
    vor = 7 + 3 * c + 1
    rueck = 25 + 3 * (5 - c) + 1
    return vor <= i < rueck


STIEL, FERRULE = (161, 147, 144), V                          # Pinsel-Farben des Sprites (Stiel, Zwinge); Borsten = Z
SPITZE = [(-2, STIEL), (-1, FERRULE), (0, Z)]                # (Versatz zur Borstenspitze, Farbe): Pinsel zeigt nach rechts zum Rahmen


def spitze_pixel(zeile, xt):
    """Kernpixel + Umriss der Pinselspitze (Spritekoordinaten); Umriss A links, oben und unten (und rechts, solange nicht am Rahmen)."""
    kern = {(xt + dx, zeile): c for dx, c in SPITZE}
    ring = {}
    for x in range(xt - 2, xt + 1):
        ring[(x, zeile - 1)] = UMRISS
        ring[(x, zeile + 1)] = UMRISS
    ring[(xt - 3, zeile)] = UMRISS
    ring[(xt + 1, zeile)] = UMRISS
    return kern, ring


def frame(i):
    k = teil(koerper)
    gl = L.leer(H, W)                                        # Glitzer-Sterne (liegen als Effekt über der Figur)
    # --- Gemälde: bemalte Zellen ---
    for c, (zy, alt, neu) in enumerate(ZELLEN):
        if gemalt(i, c):
            Hm.setze(k, {(x, zy): neu for x in ZELLE_X}, OFF)
    # --- Gold glänzt: Lichtband (zweimal pro Schleife, nur Innenpixel) + Glitzer-Sterne am Rahmen ---
    for start in (2, 26):
        Hm.lichtband(k, rahmen, OFF, i, N, start, 14, GOLD, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    for (sx, sy, start) in ((6, 0, 8), (20, 6, 22), (19, 0, 36)):
        st = Hm.folge(i, start, [0, 1, 2, 1], N)
        Hm.stern4(gl, sx, sy, st, Z, G_HELL, P_GOLD, OFF)
    # --- Schuhkappen (Silber): Z wandert ---
    for kappe, start in ((KAPPE_L, 14), (KAPPE_R, 38), (KAPPE_L, 34), (KAPPE_R, 6)):
        j = Hm.folge(i, start, [0, 0, 1, 1, 2, 2, 3, 3], N)
        if j is not None:
            Hm.setze(k, {kappe[0]: V, kappe[j]: Z}, OFF)
    # --- Auf und ab: Brust zuerst (Zeile 32), Bild 3 Frames später (Zeile 13) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 32, PAD_T + 13, brust, kopf)
    gl = Hm.atmen(gl, PAD_T + 32, PAD_T + 13, brust, kopf)
    # --- Pinselspitze des (verdeckten) rechten Malarms: nach dem Atmen, steigt mit dem Bild; Umriss nur dort, wo kein Figurenpixel liegt ---
    pinsel = L.leer(H, W)
    p = pinsel_pose(i)
    if p:
        kern, ring = spitze_pixel(ZELLEN[p[0]][0], p[1])
        dyb = -(brust + kopf)
        belegt = k[..., 3] > 0
        ring = {(x, y): c for (x, y), c in ring.items()
                if not (0 <= y + PAD_T + dyb < H and 0 <= x + PAD_L < W and belegt[y + PAD_T + dyb, x + PAD_L])}
        Hm.setze(pinsel, {**ring, **{(x, y): c for (x, y), c in kern.items()}}, (OFF[0], OFF[1] + dyb))
    fig = L.zusammen(H, W, [(k, 0, 0), (pinsel, 0, 0)])
    Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)                # Regel 16: Außenkante in jeder Pose in Umrissfarbe
    return L.zusammen(H, W, [(fig, 0, 0), (gl, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', {i: v for i, v in neu.items()} if neu else 'keine')
    L.speichern('tuscan-artist', 'Tuscan Artist', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/tuscan-artist-strip.png', frames, spalten=12, scale=4)
