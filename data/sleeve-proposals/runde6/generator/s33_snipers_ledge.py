# -*- coding: utf-8 -*-
"""33 Sniper's Ledge – Gegner „Pew-Pew!“ (sample-Structure Deck Pew-Pew), Held: Bow Sniper Darge (Base).

Idee (Freiluft, Nutzerwunsch „auf eine Klippe ins Freie“): In der Abenddämmerung steht Darge groß und frontal mit
seinem Bogen auf der grasbewachsenen Kante einer Felsnase, die von links ins Bild ragt und rechts steil ins weite Tal
abbricht – der Scharfschütze auf seinem Aussichtsposten. Hinter ihm glüht der Abendhimmel über gestaffelten
Hügelketten, die Abbruchkante fängt das letzte Licht. Keine fliegenden Pfeile (seine Pose schießt nach vorn).

Quellen:
  MotiveDeri.xcf Ebene 248 „Darge“ + mittlerer Bogen aus Ebene 244 „Darge #1“ (x 244–248) – Base-Darge, geprüft
                 gegen Szene 53 (Kartenbild „Bow Sniper Darge“, Lage 203,273; dort bis zu den Knien hinter Zinnen,
                 das Sprite ist vollständig).
  Motive.xcf     Szene 88 „Sichtbar #297“ (Karte Flame Arrow) – Gras-Kachel 16×16 (gespiegelt gekachelt);
                 Ebene 1286 „Dark Land“ – Felskachel 40×32.
Selbst gezeichnet: Abendhimmel, Wolkenstreifen, Hügelketten, Umriss der Felsnase, Gegenlicht-Saum, Bodenschatten.

Skalierung (Tiefenebenen):
  Hintergrund: Himmel, Wolken, Hügelketten, Tal     – 2× (125×175)
  Mittelgrund: Felsnase mit Grasnarbe, Schatten      – 3× (84×117)
  Vordergrund: Darge                                  – 6× (42×59); Darge 138×162 px, Füße y 264, Gesichtsmitte x = 375/750
"""
import math, random
import numpy as np
from kit_f import *  # noqa

D = 'MotiveDeri'
rnd = random.Random(33)


def _darge():
    a = compose(D, [248], crop=False)
    bow = layer(D, 244).copy(); bow[:, :244] = 0; bow[:, 249:] = 0
    a = xcfkit.over(bow, a)                       # Darge liegt über dem Bogen (Stapel: 244 unter 248)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    return trim(a[272:330, 219:276].copy())


darge = cached('o33_darge', _darge)
grass = cached('o33_grass', lambda: layer('Motive', 88)[66:82, 240:256].copy())
rock = cached('o33_rock', lambda: layer('Motive', 1286)[180:212, 244:284].copy())

# ---------------- Hintergrund 2× (125×175) ------------------------------------------------------------------
bw, bh = grid(2)
bg = rgba(bw, bh, (0, 0, 0))
bands(bg, 0, 120, [(18, 20, 52), (34, 30, 78), (70, 44, 98), (132, 64, 100), (196, 100, 88), (236, 150, 92)],
      soft=0.5)
bg[120:] = (236, 150, 92, 255)
glow(bg, 92, 104, 40, (255, 196, 120), 0.45, ry=26)             # Resthelligkeit rechts am Horizont
for _ in range(22):
    x, y = rnd.randrange(3, bw - 3), rnd.randrange(3, 38)
    bg[y, x, :3] = (200, 200, 235) if rnd.random() < .4 else (120, 110, 170)
for cx, cy, w, col in [(28, 44, 26, (150, 80, 116)), (92, 36, 30, (140, 76, 116)), (74, 60, 22, (190, 104, 110)),
                       (20, 74, 18, (214, 120, 104)), (104, 80, 20, (230, 140, 104))]:
    for x in range(int(cx - w / 2), int(cx + w / 2)):
        if 0 <= x < bw: bg[cy, x, :3] = col
    for x in range(int(cx - w / 2) + 4, int(cx + w / 2) - 3):
        if 0 <= x < bw: bg[cy - 1, x, :3] = col
RIDGES = [(104, 17.0, 6, 0.6, (120, 64, 92)), (114, 11.0, 5, 2.1, (92, 50, 82)), (128, 14.0, 6, 4.0, (70, 40, 72)),
          (144, 19.0, 7, 1.3, (54, 32, 62)), (162, 13.0, 6, 3.3, (40, 26, 52))]
for base, per, amp, ph, col in RIDGES:
    for x in range(bw):
        hy = base - amp * math.sin(x / per + ph) - 2 * math.sin(x / 5.0 + ph)
        for y in range(max(0, int(hy)), bh):
            bg[y, x, :3] = col
    for x in range(bw):                                          # Lichtsaum auf der Kammlinie (Gegenlicht rechts)
        hy = int(base - amp * math.sin(x / per + ph) - 2 * math.sin(x / 5.0 + ph))
        if 0 <= hy < bh and x > 40 and (x + hy) % 2 == 0:
            bg[hy, x, :3] = (np.array(col) * 1.35).clip(0, 255).astype(np.uint8)

# ---------------- Mittelgrund 3× (84×117): Felsnase ---------------------------------------------------------------
mw, mh = grid(3)
mg = rgba(mw, mh)
TOP = 88                                                         # Kuppe (3×) → y 264
g = grass[..., :3].astype(float)
r = rock[..., :3].astype(float)
for y in range(TOP - 2, mh):
    d = y - TOP
    # Felsnase ragt von links ins Bild; rechts bricht die Klippe steil (leicht unterschnitten) ins Tal ab
    xr = 68 - max(0, d) * 0.42 - (1 if (y // 4) % 2 else 0) - (2 if (y // 9) % 3 == 1 else 0)
    for x in range(mw):
        if x > xr: continue
        crest = TOP - 1 + (1.6 * ((x - xr + 6) / 6) ** 2 if x > xr - 6 else 0) + (0.8 if x < 8 else 0)
        if y < crest: continue
        if y - crest < 3:                                        # Grasnarbe
            tx, ty = x % 32, y % 32
            tx = tx if tx < 16 else 31 - tx; ty = ty if ty < 16 else 31 - ty
            c = g[ty, tx] * 1.9 * np.array([1.08, 1.0, 0.9])
            if y - crest < 1: c = c * 1.2 + np.array([40, 22, 0])   # Gegenlicht-Saum auf der Kante
        else:
            c = r[y % 32, x % 40] * np.array([1.0, 0.84, 0.8]) * (1.0 - 0.02 * (y - TOP))
            if x > xr - 2: c = c * 1.35 + np.array([44, 20, 0])  # Abendlicht auf der Abbruchkante
        mg[y, x] = list(c.clip(0, 255).astype(np.uint8)) + [255]
shade_ellipse(mg, 42.5, TOP + 1.2, 17, 1.4, 0.55)                # Bodenschatten unter Darge

# ---------------- Vordergrund 6× (42×59): Darge -------------------------------------------------------------------
fw, fh = grid(6)
fg = rgba(fw, fh)
DF = 44                                                          # Füße → y 264
DX = (fw - darge.shape[1]) // 2
put(fg, darge, DX, DF - darge.shape[0])

OX = -25                                                         # Gesichtsmitte (Sprite-x 16,0 zwischen den Augen) → x 125 (250er) = 375 (750er)
st = Stack()
st.add(bg, 2)
st.add(mg, 3)
st.add(fg, 6, ox=OX)
save(st.canvas(), '33_snipers_ledge.png')
if __name__ == '__main__':
    print(preview('33_snipers_ledge.png', 'twist', 'bronze', 'emerald', 'amber'))
