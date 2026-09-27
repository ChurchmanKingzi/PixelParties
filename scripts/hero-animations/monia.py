# -*- coding: utf-8 -*-
"""Idle-Animation für Cool Rescuer Monia (Sprite aus MotiveMoe.xcf).

Ebenen: Körper („Monia“ ohne das alte Düsenfeuer) und das Jetpack-Feuer aus
„Monia #2“, deckungsgleich in src/cool-rescuer-monia-{body,flames}.png.
* Sie schwebt auf ihrem Jetpack: sanftes Auf und Ab (0..2 px).
* Das Düsenfeuer lodert: jede Spalte der Flamme wird pro Frame zufällig
  gestreckt/gestaucht (Spitzen züngeln), der helle Kern flackert, beim
  Aufsteigen ist das Feuer länger.
* Der weiße Glitzerstern an ihrem Kopf ist richtig animiert: er wächst,
  wechselt zwischen +- und x-Form und zieht sich wieder zusammen.
* Ihre Beine schlackern leicht (die Füße schwingen abwechselnd 1 px aus).
* Ihr Seitenzopf (oben rechts, über dem blauen Haarband) wippt leicht und
  hängt der Schwebebewegung etwas nach: die Spitze pendelt 1 px, der Ansatz
  bleibt fest.
* Sie zwinkert: im Sprite ist ihr rechtes Auge ein geschlossener Strich – es
  wird hier offen gezeichnet (wie das linke) und schließt sich einmal pro
  Loop zum Zwinkern.

Varianten (gleicher Aufbau, gleicher Ausschnitt; Aufruf: python3 monia.py <tag> [ms] [variante]):
  hero        Cool Rescuer Monia
  delusional  Skin Delusional Monia
  lightning   Skin Lightning-Fast Monia (Ausschnitt 1 Zeile höher -> DY = 1)
  birthday    Hero Cool Birthday Girl Monia
Bei den Varianten wird der Glitzerstern allgemein entfernt (Stern-Pixel mit
der häufigsten Nachbarfarbe gefüllt bzw. außen transparent), das offene
rechte Auge übernimmt die Farben des linken.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import fill_pinholes

from collections import Counter

VARIANTS = {'hero': ('cool-rescuer-monia', 0, 'monia'), 'delusional': ('delusional-monia', 0, 'delusional_monia'),
            'lightning': ('lightning-fast-monia', 1, 'lightning_monia'),
            'birthday': ('cool-birthday-girl-monia', 0, 'birthday_monia')}
VARIANT = next((v for v in sys.argv[2:] if v in VARIANTS), 'hero')
SLUG, DY, PREFIX = VARIANTS[VARIANT]
BODY = np.array(Image.open(f'src/{SLUG}-body.png').convert('RGBA')).astype(int)
FIRE = np.array(Image.open(f'src/{SLUG}-flames.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
P, PT, PB = 3, 3, 8
H, W = SH + PT + PB, SW + 2 * P
N = 32
CORE = [rgb('f7f5b8'), rgb('f6e70e'), rgb('f47b22'), rgb('ca2c29')]
FIRE_TOP = int(np.nonzero(FIRE[:, :, 3])[0].min())

# Glitzerstern im Sprite entfernen (darunter Haar bzw. Kontur ergänzen)
STAR_C = (20, 8 + DY)
STAR_PX = [(20, 6), (20, 7), (18, 8), (19, 8), (21, 8), (22, 8), (20, 9), (20, 10)]
if VARIANT == 'hero':                                # von Hand ergänzt (abgenommen)
    HAIR, HAIR_OUT = rgb('002e5a'), rgb('001a33')
    for (x, y), c in {(20, 6): HAIR, (20, 7): HAIR, (18, 8): HAIR, (19, 8): rgb('014483'),
                      (21, 8): None, (22, 8): None, (20, 9): HAIR_OUT, (20, 10): HAIR_OUT}.items():
        BODY[y, x] = c if c else (0, 0, 0, 0)
else:                                                # allgemein: häufigste Nachbarfarbe
    star = {(x, y + DY) for x, y in STAR_PX if tuple(BODY[y + DY, x]) == rgb('ffffff')}
    fill = {}
    for x, y in star:
        nb = [tuple(int(v) for v in BODY[y + dy, x + dx]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
              if (x + dx, y + dy) not in star and BODY[y + dy, x + dx, 3]]
        fill[(x, y)] = Counter(nb).most_common(1)[0][0] if len(nb) >= 2 else (0, 0, 0, 0)
    for (x, y), c in fill.items():
        BODY[y, x] = c
WHITE, CYAN = rgb('ffffff'), rgb('b4f6ff')
# Stern-Phasen: (Armlänge +, Armlänge x)
STAR = [(0, 0), (1, 0), (2, 0), (3, 1), (2, 1), (1, 2), (0, 2), (0, 1)]   # 16 Frames: teilt N
# rechtes Auge offen (Farben wie das linke Auge); Original = Zwinkern
EYE_OPEN = {(16 + dx, y + DY): tuple(int(v) for v in BODY[y + DY, 12 + dx]) for dx in (0, 1) for y in (9, 10)}
EYE_WINK = {p: tuple(int(v) for v in BODY[p[1], p[0]]) for p in EYE_OPEN}
WINK = range(20, 25)
# Seitenzopf: Spitze (Zeilen 0–1) und Mittelstück (Zeile 2, rechts vom Kopf)
TAIL = {(x, y) for y in range(0, 3 + DY) for x in range(17, 23)
        if BODY[y, x, 3] and (y <= 1 + DY or x >= 19)}


def tail_shift(i, y):
    s = math.sin(2 * math.pi * i / 16 - 1.6)          # hängt dem Schweben nach
    y -= DY
    return (int(round(1.2 * s)) if y <= 1 else (1 if s > 0.85 else -1 if s < -0.85 else 0),
            1 if y <= 1 and math.cos(2 * math.pi * i / 16 - 1.6) > 0.8 else 0)


# Beine: Füße (Zeilen 23–25), links x10–13, rechts x14–17
FEET_Y = range(23 + DY, 26 + DY)


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def hover(i):
    return int(round(1 - math.cos(2 * math.pi * i / 16)))       # 0..2 (nach oben)


def frame(i):
    out = np.zeros((H, W, 4), int)
    up = hover(i)
    rising = math.sin(2 * math.pi * i / 16) > 0
    oy = PT - up + 2
    # Feuer (hinter dem Körper): spaltenweise gestreckt
    for x in range(SW):
        col = [y for y in range(SH) if FIRE[y, x, 3]]
        if not col:
            continue
        y0, y1 = min(col), max(col)
        n = y1 - y0 + 1
        grow = 1.0 + 0.25 * rnd(x, i) + (0.3 if rising else 0.0) - 0.12 * rnd(x + 40, i)
        m = max(1, int(round(n * grow)))
        for j in range(m):
            sy = y0 + min(n - 1, int(j * n / m))
            if not FIRE[sy, x, 3]:
                continue
            c = tuple(FIRE[sy, x])
            if c in CORE[:3] and rnd(x * 13 + sy, i) > 0.7:          # Kern flackert
                c = CORE[max(0, CORE.index(c) - 1)] if rnd(x, i + 9) > 0.5 else CORE[CORE.index(c) + 1]
            yy = y0 + j + oy
            if 0 <= yy < H:
                out[yy, x + P] = c
    for (x, y), c in (EYE_WINK if i in WINK else EYE_OPEN).items():
        BODY[y, x] = c
    # Körper, Füße schlackern gegenläufig
    ph = 2 * math.pi * i / 16
    dl = -1 if math.sin(ph) > 0.5 else 0
    dr = 1 if math.sin(ph + math.pi) > 0.5 else 0
    for y in range(SH):
        for x in range(SW):
            if not BODY[y, x, 3]:
                continue
            dx = ddy = 0
            if y in FEET_Y and 10 <= x <= 17:
                dx = dl if x <= 13 else dr
            if (x, y) in TAIL:
                continue
            out[y + oy + ddy, x + P + dx] = BODY[y, x]
    for x, y in sorted(TAIL, key=lambda p: -p[1]):     # Zopf zuletzt, Spitze obenauf
        dx, ddy = tail_shift(i, y)
        out[y + oy + ddy, x + P + dx] = BODY[y, x]
    fill_pinholes(out)                                  # keine Lücke am Zopfansatz
    # Glitzerstern
    plus, diag = STAR[(i // 2) % len(STAR)]
    cx, cy = STAR_C[0] + P, STAR_C[1] + oy
    out[cy, cx] = WHITE if (plus or diag) else CYAN
    for d in range(1, plus + 1):
        for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
            out[cy + dy, cx + dx] = WHITE if d < plus else CYAN
    for d in range(1, diag + 1):
        for dx, dy in ((d, d), (-d, d), (d, -d), (-d, -d)):
            out[cy + dy, cx + dx] = WHITE if d < diag else CYAN
    fill_pinholes(out)                                  # Lücken zwischen Stern und Haar
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 70
    save_outputs(f'{PREFIX}_idle_{tag}', frames, ms, scale=8, check_edges=True)
