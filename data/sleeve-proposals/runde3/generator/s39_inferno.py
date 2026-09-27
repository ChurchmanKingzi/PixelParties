# -*- coding: utf-8 -*-
"""Sleeve 39 – „Inferno“: Blick von oben schräg in den Höllentrichter. Konzentrische Terrassen (Kreise) werden
nach unten enger; auf jeder Terrasse ihre Bewohner, Dante steigt hinab, am Grund der Dämon aus „Demons Gate“
im Lavasee.
  Rand: Dante und ein Horned Demon als Torwächter
  Erster Kreis (Limbo): die drei kahlen Seelen aus „First Circle“, grauer Fels
  Zweiter Kreis (Wollust): die Mädchen aus „Second Circle“ vor dem violetten Herzfries-Mauerwerk, dazwischen
     der wandernde Dante (ebenfalls aus „Second Circle“)
  Grund: Dämon aus „Demons Gate“ zwischen Flammen („Fireball #3“) über dem Lavasee

Quellen (Motive.xcf):
  496 „First Circle“, 403 „Second Circle“, 503 „DANTE“, 573 „Horned Demon“, 1496 „Demons Gate“,
  1536 „Fireball #3“ (Flammen), Texturen: 1044 „Hell“ (Felskacheln 16×16), 510 „Ebene #524“ (grauer Fels),
  404 „Ebene #605“ (violettes Mauerwerk, Herzfries), 1550 „Lava“.
"""
import math
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
K = 3
cv = Canvas(W2, H2)

hell = layer(B, 1044)[118:358, 100:409, :3]
dark_t = hell[0:16, 272:288]                    # dunkle Felskachel
red_t = hell[80:96, 32:48]                      # rote Pflasterkachel
gray = layer(B, 510)[65:305, 129:420, :3]
purple = layer(B, 404)[58:298, 100:409, :3]
lava = layer(B, 1550)[0:240, 100:420, :3]


def tile(t, w, h, ox=0, oy=0):
    th, tw = t.shape[:2]
    return t[(np.arange(h)[:, None] + oy) % th, (np.arange(w)[None, :] + ox) % tw]


YY, XX = np.mgrid[0:H2, 0:W2]
CX = 124.5


def ell(cy, rx, ry):
    return ((XX - CX) / rx) ** 2 + ((YY - cy) / ry) ** 2 <= 1.0


def put(mask, img, shade=None):
    """img (H2×W2×3) in mask setzen; shade(y, x)->Faktor."""
    im = img.astype(float)
    if shade is not None: im = im * shade[..., None]
    cv.a[mask] = im[mask].clip(0, 255).astype(np.uint8)


# ---------- Geometrie (Öffnung O_k, Boden F_k = O_k um Wandhöhe h_k nach unten verschoben)
RIM = 104                     # Oberkante der ersten Öffnung
O1 = (RIM + 104, 121, 104)    # cy, rx, ry
H1 = 36
O2 = (O1[0] + 38, 88, 76)
H2w = 32
O3 = (O2[0] + 34, 54, 46)
H3 = 30

o1 = ell(*O1); f1 = ell(O1[0] + H1, O1[1], O1[2])
o2 = ell(*O2) & o1; f2 = ell(O2[0] + H2w, O2[1], O2[2])
o3 = ell(*O3) & o2; f3 = ell(O3[0] + H3, O3[1], O3[2])

# Rand (Erdoberfläche): rote Pflasterkachel, nach oben dunkel
rim_img = tile(red_t, W2, H2)
dist = np.sqrt(((XX - CX) / O1[1]) ** 2 + ((YY - O1[0]) / O1[2]) ** 2) - 1
put(~o1, rim_img, np.clip(0.95 - 1.6 * dist, 0.22, 0.95))
# Kreis 1: Wand grau (oben dunkel), Boden heller grau
wall1 = mirror_tile(gray[:, :], W2, H2)
put(o1 & ~f1, wall1, 0.3 + 0.3 * np.clip((YY - (O1[0] - O1[2])) / H1, 0, 1))
put(o1 & f1, mirror_tile(gray[0:40, 0:120], W2, H2), np.full((H2, W2), 1.25))
# Kreis 2: Wand = Herzfries + dunkles Mauerwerk, Boden helles violettes Mauerwerk
w2 = np.concatenate([purple[26:62], (purple[165:235] * 0.55).astype(np.uint8)], 0)[:, :W2]
wall2 = np.zeros((H2, W2, 3), np.uint8)
top2 = O2[0] - O2[2] - 2
for y in range(H2):
    wall2[y] = w2[(y - top2) % w2.shape[0]] if y >= top2 else w2[0]
put(o2 & ~f2, wall2, 0.45 + 0.4 * np.clip((YY - top2) / H2w, 0, 1))
put(o2 & f2, mirror_tile(purple[165:235], W2, H2, ox=8), np.full((H2, W2), 1.3))
# Grund: Wand rotes Pflaster, glühend nach unten; Lava
top3 = O3[0] - O3[2]
put(o3 & ~f3, tile(red_t, W2, H2, 3, 5), 0.35 + 0.8 * np.clip((YY - top3) / H3, 0, 1))
lv = np.zeros((H2, W2, 3), np.uint8)
lv[top3 + H3 - 4:, :] = mirror_tile(lava[150:210, 30:280], W2, H2 - (top3 + H3 - 4))
put(o3 & f3, lv)

# Kanten: helle Lippe an den Öffnungen (Vorderkante unten = Felskante)
for m, col in ((o1, (60, 20, 10)), (o2, (40, 40, 40)), (o3, (50, 10, 40))):
    edge = m & ~np.roll(m, 1, 0)                                  # obere Kante
    cv.a[edge] = (np.array(col) * 0.5).astype(np.uint8)
    edge_b = m & ~np.roll(m, -1, 0)                               # untere Kante (Vorderkante)
    cv.a[edge_b] = col
    cv.a[np.roll(edge_b, 1, 0)] = (np.array(col) * 1.8).clip(0, 255).astype(np.uint8)

# Glut über dem Lavasee
g3 = o3.copy()
lava_top = top3 + H3 - 4
dither_blend(cv, (255, 150, 40), lambda x, y: (max(0.0, 1 - abs(y - lava_top) / 34) * 0.55) if g3[y, x] else 0.0,
             y0=top3, y1=lava_top + 10)

# ---------- Figuren (von hinten nach vorn)
def stand(s, x, feet, dx=3):
    u = up(s, K)
    paste_shadow(cv, u, int(x - u.shape[1] / 2), feet - u.shape[0], dx=dx, dy=0, alpha=0.4)


# Rand
stand(lay(B, 503), 58, RIM - 2)
stand(hsv_shift(flip(lay(B, 573)), 0, 1.1, 1.35), W2 - 58, RIM - 2)

# Kreis 1: Seelen auf dem hinteren Boden (Bodenstreifen zwischen f1-Oberkante und o2-Oberkante)
souls = sorted(parts(lay(B, 496), dil=1), key=lambda s: s.shape[1])
b1 = (O1[0] + H1 - O1[2] + O2[0] - O2[2]) // 2 + 2
stand(souls[0], 36, b1 + 26)
stand(souls[-1], CX, b1 + 1)
stand(flip(souls[1]), W2 - 36, b1 + 26)

# Kreis 2
row = lay(B, 403)
rp = parts(row, dil=1)
girls_row = max(rp, key=lambda p: p.shape[1]); dante_walk = min(rp, key=lambda p: p.shape[1])
g = girls_row[:, 6 + 18 * 3: 6 + 18 * 3 + 21].copy()
g = max(parts(g, dil=0), key=lambda p: (p[..., 3] > 0).sum())
b2 = (O2[0] + H2w - O2[2] + O3[0] - O3[2]) // 2 + 2
stand(g, 72, b2 + 18)
stand(dante_walk, CX + 50, b2 + 18)

# Grund: Flammen + Dämon
flames = parts(lay(B, 1536), dil=1)[:2]
dem = up(lay(B, 1496), 2)
pit = Canvas(W2, H2); pit.a[:] = cv.a
for fl, fx in zip(flames, (CX - 36, CX + 36)):
    fu = up(fl, 2)
    pit.paste(fu, int(fx - fu.shape[1] / 2), lava_top + 14 - fu.shape[0])
dx, dy = int(CX - dem.shape[1] / 2), lava_top + 16 - dem.shape[0]
pit.paste(silhouette(dem, (40, 0, 0)), dx + 3, dy + 3, alpha=0.5)
pit.paste(dem, dx, dy)
# Lava vor dem Unterleib des Dämons
lm = o3 & f3 & (YY >= lava_top + 9)
pit.a[lm] = cv.a[lm]
# Dämon nur innerhalb der Grube sichtbar (Rand der Öffnung davor)
cv.a[o3] = pit.a[o3]
# Oberkörper darf über die hintere Kante der Grube ragen (liegt hinten, näher als Kreis 2)
above = ~o3 & (YY < O3[0]) & (np.abs(pit.a.astype(int) - cv.a.astype(int)).sum(-1) > 0)
cv.a[above] = pit.a[above]

for n, sp in dict(dante=lay(B, 503), horned=lay(B, 573), soul=souls[-1], girl=g, dante_walk=dante_walk,
                  demon=lay(B, 1496)).items():
    Image.fromarray(sp).save(os.path.join(xcfkit.CACHE, 'g39_%s.png' % n))
vignette(cv, 0.55, 0.55)
frame(cv, ((10, 0, 0), (140, 30, 10), (240, 140, 40), (10, 0, 0)))
print(save(cv, '39_inferno.png'))
