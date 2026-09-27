# -*- coding: utf-8 -*-
"""Sleeve 19 – Matrjoschka-Turm der Dream Landers.

Die Dream Landers stehen einander auf den Schultern – und werden dabei wie Matrjoschka-Puppen
nach oben hin Stufe um Stufe kleiner (5×, 4×, 3×, 2×, 1×): unten Stellin, darauf Smug Mastermind
Antonia mit Krone, dann Vullary, Rafflesia und ganz oben der winzige Clausss. Dahinter der
verschneite Nadelwald des Nordens im Schneetreiben, ein fahler Lichtkranz hebt den Turm hervor.

Quellen (MotiveRussia.xcf):
  Stellin   = Ebene 142 „Ebene #97“          Antonia  = Ebene 218 „MONIA“
  Vullary   = Ebene 215 „MARY“               Rafflesia = Ebene 228 „RAFFLESIA“
  Clausss   = Ebene 210 „CLAUSSS“
  Wald/Schnee = Ebene 221 „Ebene #6“ (Kulisse der Dream-Lander-Karten)
  Schneeflocken = Ebene 64 „Ebene #122“ (nur deckende Pixel)
"""
from c_util import *

cv = Canvas(W, H)

# ---------- Wald im Schnee (Ebene 221), 2×, nach oben in Nachtblau
forest = tex('c19_forest', RU, 221, (560, 390, 685, 565))      # 125×175
F2 = up(np.dstack([forest, np.full(forest.shape[:2], 255, np.uint8)]), 2)[..., :3]
cv.a[:F2.shape[0]] = F2[:H, :W]
cv.a[F2.shape[0]:] = F2[-1:, :W]
shade_rows(cv, 0, 190, 0.8, 0.15, (18, 20, 52))
shade_rows(cv, 190, H, 0.15, 0.35, (18, 20, 52))

# ---------- fahler Lichtkranz hinter dem Turm (selbst erstellt, 4 Stufen, geordnetes Dithering)
CX = W // 2
for y in range(H):
    for x in range(W):
        d = math.hypot((x + .5 - CX) / 90, (y + .5 - 180) / 190)
        t = max(0.0, 1 - d)
        q = min(1.0, math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4)
        if q > 0:
            cv.a[y, x] = (cv.a[y, x] * (1 - q * 0.6) + np.array((210, 214, 250)) * q * 0.6).astype(np.uint8)

# ---------- Turm: von unten nach oben, jede Figur steht auf dem Kopf/den Schultern der darunter
figs = [('c19_stellin', [142], 5), ('c19_antonia', [218], 4), ('c19_vullary', [215], 3),
        ('c19_raff', [228], 2), ('c19_clausss', [210], 1)]
# Zeilen (nativ) über dem Gesicht, auf denen die nächste Figur mit den Füßen steht
head_top = {'c19_stellin': 4, 'c19_antonia': 5, 'c19_vullary': 3, 'c19_raff': 5, 'c19_clausss': 0}
placed = []
base = H + 10                     # Stellins Füße ragen unten aus dem Bild
for key, idx, k in figs:
    s = sprite(key, RU, idx)
    S = up(s, k)
    y = base - S.shape[0]
    x = CX - S.shape[1] // 2
    placed.append((s, S, x, y, k))
    # nächste Figur steht im oberen Teil dieser Figur (Kopf/Schultern)
    base = y + head_top[key] * k
# die obere Figur steht vor dem Kopf der unteren -> von unten nach oben malen
for s, S, x, y, k in placed:
    cv.paste(silhouette(up(outline(s), k), (14, 16, 40)), x - k + 3, y - k + 3, alpha=0.45)
    cv.paste(up(outline(s, (24, 20, 40)), k), x - k, y - k)
    cv.paste(S, x, y)

# ---------- Schneegestöber (Ebene 64, deckende Pixel), dünn
snow = layer(RU, 64) if os.path.exists(os.path.join(XK.EXP, RU)) else None
if snow is not None:
    fl = snow[..., 3] >= 250
    np.save(os.path.join(XK.CACHE, 'c19_flakes.npy'), fl[100:100 + H, 200:200 + W])
fl = np.load(os.path.join(XK.CACHE, 'c19_flakes.npy'))
ys, xs = np.nonzero(fl)
for y, x in zip(ys, xs):
    if (x * 7 + y * 3) % 6 == 0:
        cv.px(x, y, (240, 242, 255))

print(save(cv, '19_dream_tower.png'))
