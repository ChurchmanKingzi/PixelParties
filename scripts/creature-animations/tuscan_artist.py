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
* Frame 0 = Ruhepose (Original). Frames 1–6: Der linke Arm hebt sich seitlich (links neben der Schulter) vom Hüftpinsel zum Bild; der Pinsel dreht sich dabei in die Waagerechte
  (Spitze nach rechts) und streicht am Rahmen entlang nach oben. Frames 7–24: sechs Tupfer-/Pinselstriche von oben nach unten am linken Bildrand — pro Strich 3 Frames
  (heranführen, auftupfen = Pinsel 1 px nach rechts, zurück); im Auftupf-Frame färbt sich die Farbzeile (x 8–10) um: Zeile 4 blau→grün, 5 blau→orange, 6 rot→blau, 7 rot→grün, 8 rot→orange,
  9 rot→blau. Frames 25–42: derselbe Weg von unten nach oben, dabei übermalt der Künstler die Zeilen wieder in den Originalfarben. Frames 43–47: der Arm senkt sich zurück zur Hüfte,
  der Pinsel hängt wieder; Frame 48 = Frame 0 (nahtlos).
* Der Arm ist neu gezeichnet (nur Quellfarben: Hautbraun J/Y, Hand/Pinsel aus dem Sprite): Hand und Pinsel sind die Original-Pixel (der Pinsel gedreht), der Arm eine 3 px breite Linie
  von der Schulter (links neben dem Puffärmel) zur Hand (unten grauer Ärmel A|B|C, ab dem Ellbogen brauner Unterarm J|Y|J). Ergänzt wird der Körperumriss, der sonst vom Pinsel verdeckt war: (6,26) … (6,31) in Umrissfarbe A (23,21,22); um den bewegten Arm läuft automatisch ein A-Umriss (Regel 16).
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (Zeile 32 des Anzugs wird einmal doppelt eingefügt: Schultern, Arme, Pinsel und Bild steigen, Beine/Schuhe bleiben),
  das Bild läuft 3 Frames nach und hebt sich um ein weiteres px (Zeile 13, Schulterlinie, wird verlängert): Bild 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0. Der Malarm folgt dem Bild (Hand und Pinsel
  steigen mit dem Gemälde, der Unterarm streckt sich dabei).
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
PAD_L, PAD_R, PAD_T, PAD_B = 8, 6, 9, 3

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
ARMEL_B, ARMEL_C = f(4, 27) if False else (124, 112, 112), (91, 82, 83)     # Ärmel grau (Puffärmel-Farben B/C des Sprites)
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

# Linke Hand (Hautfarben J/Y/a in x ≤ 5, y 21–25) und Pinsel (x 3–6, y 26–31)
HAND = {(x, y): f(x, y) for y in range(21, 26) for x in range(0, 6) if vorhanden[y, x] and f(x, y) in (HAUT_J, HAUT_Y, f(4, 25))}
PINSEL = {}
for _y in range(26, 32):
    for _x in range(3, 7):
        if not vorhanden[_y, _x]:
            continue
        if _y in (26, 27) and _x in (4, 5, 6):
            PINSEL[(_x, _y)] = f(_x, _y)
        elif _y in (28, 29, 30):
            PINSEL[(_x, _y)] = f(_x, _y)
        elif _y == 31 and _x in (4, 5, 6):
            PINSEL[(_x, _y)] = f(_x, _y)
hand_m = np.zeros((sh, sw), bool)
for (px, py) in list(HAND) + list(PINSEL):
    hand_m[py, px] = True
koerper = vorhanden & ~hand_m
# Ergänzung: Körperumriss links, den der Pinsel verdeckt hat (nur sichtbar, wenn der Pinsel weg ist; im Ruhezustand liegt der Pinsel darüber)
ERGAENZUNG = {(6, y): UMRISS for y in range(26, 32)}
for (ex, ey) in ERGAENZUNG:
    assert not koerper[ey, ex] or True

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


def pose(i):
    """(k, zelle, dab): k = Hubstufe des Arms 0 (Hüfte) … 6 (am Bild); zelle = Index der gerade bearbeiteten Zelle oder None; dab = 1 beim Auftupfen."""
    if i == 0:
        return 0, None, 0
    if i <= 6:
        return i, None, 0
    if i <= 24:
        c = (i - 7) // 3
        return 6, c, 1 if (i - 7) % 3 == 1 else 0
    if i <= 42:
        c = 5 - (i - 25) // 3
        return 6, c, 1 if (i - 25) % 3 == 1 else 0
    return 48 - i, None, 0                                  # 43…47 → k = 5 … 1


def gemalt(i, c):
    """Ist Zelle c in Frame i umgefärbt? (vom Auftupf-Frame der Vorwärtsstriche bis zum Auftupf-Frame der Rückwärtsstriche)"""
    vor = 7 + 3 * c + 1
    rueck = 25 + 3 * (5 - c) + 1
    return vor <= i < rueck


def pinsel_waagerecht(c0, y0):
    """Der Pinsel um 90° gedreht (Handende links, Spitze rechts): Original (x, y) → (c0 + (y − 26), y0 + (x − 3))."""
    out = {(c0 + (y - 26), y0 + (x - 3)): c for (x, y), c in PINSEL.items()}
    for xx_ in (c0, c0 + 1):
        out.setdefault((xx_, y0), UMRISS)
    return out


def arm_zeichnen(k, c, dab, brust, kopf):
    """Pixel (Spritekoordinaten, y bereits um den Hub korrigiert) von Unterarm, Hand und Pinsel für die Pose."""
    px = {}
    if k == 0:
        # Ruhe: Original-Hand und -Pinsel, mit der Brust gehoben
        for (x, y), col in {**HAND, **PINSEL}.items():
            px[(x, y - brust)] = col
        return px
    t = k / 6.0
    hx = int(round(2 - 4 * t))
    hy = int(round(21 - 19 * t))
    if k == 6 and c is not None:
        hy = 2 + c
    hx += dab
    w = t                                                    # der Arm folgt mit wachsendem k dem Bild (Kopfhub), sonst der Brust
    dy = -(brust + int(round(kopf * w)))
    # Hand (Original-Pixel, relativ zu (2,21)) und Pinsel waagerecht (Handende rechts neben der Hand, Zeilen hy+1 … hy+4)
    for (x, y), col in HAND.items():
        px[(hx + (x - 2), hy + (y - 21) + dy)] = col
    for (x, y), col in pinsel_waagerecht(hx + 4, hy + 1).items():
        px[(x, y + dy)] = col
    # Arm: 2 px breite Linie von der Schulter (links neben dem Puffärmel, Zeile 16 − brust) zur Handunterkante: unten der graue Ärmel (B | C), ab dem Ellbogen
    # (55 %) der braune Unterarm (J | Y/J). Beide Teile aus Sprite-Farben. Die Außenkante bekommt in frame() einen A-Umriss.
    y_oben, y_unten = hy + 5 + dy, 16 - brust
    ax, bx = hx + 1.5, 2.0                                   # Handmitte unten → Schulter
    grenze = y_oben + 0.55 * (y_unten - y_oben)
    for y in range(y_oben, y_unten + 1):
        s = 0.0 if y_unten == y_oben else (y - y_oben) / float(y_unten - y_oben)
        x = int(round(ax + (bx - ax) * s))
        if y <= grenze:                                      # Unterarm (nackt)
            px[(x, y)] = HAUT_J
            px[(x + 1, y)] = HAUT_Y if (y % 2 == 0) else HAUT_J
        else:                                                # Ärmel
            px[(x, y)] = ARMEL_B
            px[(x + 1, y)] = ARMEL_C
    return px


def frame(i):
    k = teil(koerper)
    gl = L.leer(H, W)                                        # Glitzer-Sterne (liegen als Effekt über der Figur)
    for (ex, ey), col in ERGAENZUNG.items():
        Hm.setze(k, {(ex, ey): col}, OFF)
    kz, zelle, dab = pose(i)
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
    # --- Malarm (nach dem Atmen, in Leinwandkoordinaten) mit A-Umriss ---
    arm = L.leer(H, W)
    px = arm_zeichnen(kz, zelle, dab, brust, kopf)
    Hm.setze(arm, px, OFF)
    if kz:
        belegt = (k[..., 3] > 0) | (arm[..., 3] > 0)
        ring = {}
        for y, x in zip(*np.nonzero(arm[..., 3] > 0)):
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and not belegt[ny, nx]:
                    ring[(nx - PAD_L, ny - PAD_T)] = UMRISS
        Hm.setze(arm, ring, OFF)
    fig = L.zusammen(H, W, [(k, 0, 0), (arm, 0, 0)])
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
