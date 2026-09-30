# -*- coding: utf-8 -*-
"""33 Volley at Dusk – Gegner „Pew-Pew!“ (sample-Structure Deck Pew-Pew), Held: Bow Sniper Darge (Base).

Idee: Abenddämmerung auf einer Felsnase hoch über einem Tal (bewusst NICHT die Deri-Mauer seiner Karte, die Sleeve 41
nutzt): Darge steht links mit seinem Bogen am Rand; seine Pfeile fliegen waagrecht vom Bogen weg über das Tal nach
rechts auf genau EIN Ziel – den Gegner aus der Cover-Karte „Angelfeather Arrow“, der drüben auf einer Felsnadel
steht. Der Angelfeather Arrow hat ihn samt weißer Flugspur schon durchbohrt (Anordnung wie im Kartenbild), Flammen-
und Giftpfeil sind noch unterwegs – jeder weitere „Arrow“ auf dasselbe Ziel macht Darges Angriff stärker.

Quellen:
  MotiveDeri.xcf Ebene 248 „Darge“ + mittlerer Bogen aus Ebene 244 „Darge #1“ (x 244–248) – Base-Darge, geprüft
                 gegen Szene 53 (Kartenbild „Bow Sniper Darge“, Lage 203,273; dort hinter den Zinnen verdeckt, das
                 Sprite ist vollständig).
  Motive.xcf     Szene 85 „Sichtbar #300“ (Karte Angelfeather Arrow): Ebene 1108 (Gegner), 1107 linker Teil (weißer
                 Federpfeil), 1109 (weiße Flugspur, weiches Alpha je 2×-Pixel) in Originalanordnung zusammengesetzt;
                 Ebene 1105 rechter Teil (Flammenpfeil der Karte Flame Arrow), 1102 (Poisoned Arrow).
                 Szene 88 (Karte Flame Arrow) – Gras-Kachel 16×16; Ebene 1286 „Dark Land“ – Felskachel.
Selbst gezeichnet: Abendhimmel, Wolkenstreifen, Hügelstaffeln, Form von Felsnase und Felsnadel, kurze Flugstriche
hinter Flammen- und Giftpfeil, Lichtschein, Bodenschatten.

Skalierung (Tiefenebenen):
  Hintergrund: Himmel, Wolken, Tal, Felsnadel, Ziel, fliegende Pfeile, Flugspur – 2× (125×175)
                (über dem Tal = weiter weg; Ziel 38×70 px, Pfeile 44–50 px lang)
  Vordergrund: Felsnase, Darge, Schatten                                      – 4× (63×88); Darge 88×112 px
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
    return a[272:330, 219:276].copy()             # Fenster ab (219,272)


darge = cached('o33_darge_win', _darge)          # 57×58, Fenster ab (219,272)


def _hit():
    arrow = layer('Motive', 1107).copy(); arrow[:, 190:] = 0            # nur der Federpfeil, nicht die Flügel
    a = compose('Motive', [1108], crop=False)
    a = xcfkit.over(a, arrow)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    trail = layer('Motive', 1109)
    out = xcfkit.over(trail, a)                                        # Flugspur liegt unter Gegner und Pfeil
    out[..., 3] = np.maximum(a[..., 3], trail[..., 3])
    return out[112:152, 140:186].copy()                               # Fenster ab (140,112)


hit = cached('o33_hit_win', _hit)                                      # Gegner, Angelfeather Arrow, Spur
flame_arrow = cached('o33_flame_arrow', lambda: parts(layer('Motive', 1105), dil=1)[1])
poison_arrow = cached('o33_poison_arrow', lambda: parts(layer('Motive', 1102), dil=1)[0])
grass = cached('o33_grass', lambda: layer('Motive', 88)[66:82, 240:256].copy())

# ---------------- Hintergrund 2× (125×175) ------------------------------------------------------------------
bw, bh = grid(2)
bg = rgba(bw, bh, (0, 0, 0))
bands(bg, 0, 118, [(18, 20, 52), (34, 30, 78), (70, 44, 98), (132, 64, 100), (196, 100, 88), (236, 150, 92)],
      soft=0.5)
bg[118:] = (236, 150, 92, 255)
glow(bg, 98, 112, 40, (255, 196, 120), 0.45, ry=24)              # Resthelligkeit rechts am Horizont
for _ in range(20):
    x, y = rnd.randrange(3, bw - 3), rnd.randrange(3, 36)
    bg[y, x, :3] = (200, 200, 235) if rnd.random() < .4 else (120, 110, 170)
# flache Wolkenstreifen
for cx, cy, w, col in [(30, 46, 26, (150, 80, 116)), (88, 38, 30, (140, 76, 116)), (70, 62, 22, (190, 104, 110)),
                       (18, 74, 18, (214, 120, 104)), (104, 80, 20, (230, 140, 104))]:
    for x in range(int(cx - w / 2), int(cx + w / 2)):
        if 0 <= x < bw:
            bg[cy, x, :3] = col
    for x in range(int(cx - w / 2) + 4, int(cx + w / 2) - 3):
        if 0 <= x < bw:
            bg[cy - 1, x, :3] = col
# Tal in mehreren Hügelstaffeln bis zum unteren Rand (die Pfeile fliegen über das Tal auf uns zu)
RIDGES = [(100, 17.0, 6, 0.6, (120, 64, 92)), (110, 11.0, 5, 2.1, (92, 50, 82)), (124, 14.0, 6, 4.0, (70, 40, 72)),
          (140, 19.0, 7, 1.3, (54, 32, 62)), (158, 13.0, 6, 3.3, (40, 26, 52))]
for base, per, amp, ph, col in RIDGES:
    for x in range(bw):
        hy = base - amp * math.sin(x / per + ph) - 2 * math.sin(x / 5.0 + ph)
        for y in range(max(0, int(hy)), bh):
            bg[y, x, :3] = col
    for x in range(bw):                                          # Lichtsaum auf der Kammlinie (Gegenlicht rechts)
        hy = int(base - amp * math.sin(x / per + ph) - 2 * math.sin(x / 5.0 + ph))
        if 0 <= hy < bh and x > 40 and (x + hy) % 2 == 0:
            bg[hy, x, :3] = (np.array(col) * 1.35).clip(0, 255).astype(np.uint8)
glow(bg, 98, 112, 40, (255, 170, 110), 0.2, ry=30)

# ---------------- Felsnadel mit dem Ziel, fliegende Pfeile (2×, jenseits des Tals) -------------------------------
rockB = cached('o33_rock', lambda: layer('Motive', 1286)[180:212, 244:284].copy())[..., :3].astype(float)
TOP = 103                                                        # Standfläche der Felsnadel (2×) → y 206
for y in range(TOP, bh):
    d = y - TOP
    x0 = 86 - int(d * 0.16) - (1 if (y // 4) % 2 else 0)
    x1 = 104 + int(d * 0.14) + (1 if (y // 6) % 2 else 0)
    for x in range(x0, min(bw, x1)):
        c = rockB[y % 32, x % 40] * np.array([0.8, 0.62, 0.7]) * 0.6
        if x <= x0 + 1: c = c * 1.5 + np.array([36, 16, 0])         # Abendlicht auf der linken Kante
        if d == 0: c = c * 1.4
        bg[y, x, :3] = c.clip(0, 255).astype(np.uint8)
# Gegner mit durchbohrendem Angelfeather Arrow und Flugspur (Originalanordnung), Füße auf der Felsnadel
HX, HY = 72, TOP - (150 - 112)                                   # Fenster (140,112) → Spalte 72
for y in range(hit.shape[0]):
    for x in range(hit.shape[1]):
        X, Y = HX + x, HY + y
        al = hit[y, x, 3] / 255
        if al > 0 and 0 <= X < bw and 0 <= Y < bh:
            q = math.floor(al * 4 + BAYER[Y % 4, X % 4] * 0.999) / 4
            if q > 0: bg[Y, X, :3] = (bg[Y, X, :3] * (1 - q) + hit[y, x, :3] * q).astype(np.uint8)
shade_ellipse(bg, HX + (163 - 140), TOP + 0.3, 8, 1.2, 0.5)


def streak(y, x0, x1, col):
    for x in range(x0, x1):
        if (x - x0) % 3 != 2 and 0 <= x < bw: bg[y, x, :3] = col


# Flammenpfeil (oben) und Giftpfeil (unten) auf dem Weg vom Bogen zum Ziel, mit kurzen Flugstrichen
FA = (61, 73); PA = (58, 90)
streak(FA[1] + 5, FA[0] - 12, FA[0] - 1, (250, 190, 120))
streak(FA[1] + 7, FA[0] - 8, FA[0] - 1, (230, 150, 100))
streak(PA[1] + 3, PA[0] - 12, PA[0] - 1, (170, 220, 150))
put(bg, flame_arrow, FA[0], FA[1])
put(bg, poison_arrow, PA[0], PA[1])
glow(bg, FA[0] + 19, FA[1] + 5, 9, (255, 190, 90), 0.4)

# ---------------- Vordergrund 4× (63×88): Felsvorsprung, Darge, Pfeile --------------------------------------------
fw, fh = grid(4)
ground = rgba(fw, fh)
GX0 = 0                                                          # Fenster-Ursprung (219,272) → Spalte 0
GY0 = 22                                                         # → Zeile 22 (y 88)
FEET = GY0 + (302 - 272)                                         # Fußzeile 52 → y 208
g = grass[..., :3].astype(float)
rock = cached('o33_rock', lambda: layer('Motive', 1286)[180:212, 244:284].copy())
r = rock[..., :3].astype(float)
for y in range(FEET - 1, fh):
    d = y - FEET
    xr = max(6 + (1 if (y // 5) % 2 else 0), 33 - int(d * 3.2) + (1 if d == 2 else 0))          # Felsnase, fällt steil zur linken Felswand ab
    for x in range(0, max(0, xr)):
        if d <= 1:                                                   # Grasnarbe oben auf dem Vorsprung
            tx = x % 16; c = g[(y * 3) % 16, tx] * 1.8 * np.array([1.1, 1.0, 0.9])
            if d == -1 and x > xr - 3: continue
        else:
            c = r[y % 32, x % 40] * np.array([1.0, 0.86, 0.8]) * (0.95 - 0.02 * d)
            if x >= xr - 1: c = c * 1.35 + np.array([40, 20, 0])    # Gegenlicht an der Kante
        ground[y, x] = list(c.clip(0, 255).astype(np.uint8)) + [255]
shade_ellipse(ground, GX0 + (236 - 219) + 0.5, FEET + 0.2, 11, 1.3, 0.55)

fig = rgba(fw, fh)
put(fig, darge, GX0, GY0)

st = Stack()
st.add(bg, 2)
st.add(ground, 4, ox=0)
st.add(fig, 4, ox=0)
save(st.canvas(), '33_volley_at_dusk.png')
if __name__ == '__main__':
    print(preview('33_volley_at_dusk.png', 'twist', 'bronze', 'emerald', 'amber'))
