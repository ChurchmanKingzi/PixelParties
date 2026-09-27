# -*- coding: utf-8 -*-
"""38 Thing in the Hull – Luftbild, nah am Bug: das Holzschiff fährt nachts bugvoran durch schwarzes Wasser,
unter dem Kiel breitet sich der riesige Schatten eines Kraken aus, dessen Arme links und rechts am Rumpf
entlang greifen; ein gewaltiger Tentakel steigt links aus dem Meer, legt sich über die Reling und krümmt
die Spitze vor den Kapitän, der mit hochgerissenen Armen auf dem Vordeck steht; aus der Ladeluke dahinter
glühen rote Augen, Tentakel quellen heraus.

Quellen (MotiveIndia.xcf, Karten „Panicking Captain“ (Sichtbar #63 [25]) und „The Thing in the Hull“):
  Ebene 396 „Ebene #24“ (Rumpf) + 394 „Ebene #45“ + 395 „Ebene #2“ (Deck) – Bughälfte, um 180° gedreht
  Ebene 385 „Panicking Captain #3“ – großer Tentakel (nur das große Teil), um 90° gedreht; nachbearbeitet:
      Volumen-Schattierung zum Rand hin und Saugnäpfe entlang der Innenseite der Krümmung (Palette des Sprites)
  Ebenen 383 (Hut) + 384 (Arme) + 387 (Körper) + 388 (Schatten) – Kapitän (geprüft gegen Sichtbar #63,
      kleiner Zündfunken aus 384 entfernt)
  Ebene 390 „The Thing in the Hull“ – Augen + Tentakel in der Luke (Lage zur Luke wie in Sichtbar #30)
  Ebene 403 „Hintergrund-Kopie“ – Meereskachel
Selbst gezeichnet: Krakenschatten unter Wasser, Kielwasser, Schaum.

Skalierung: EIN Raster 2× (125×175 Zellen) für alles – Meer, Schatten, Schiff, Kapitän, Tentakel, Schaum.
"""
import sys, os, math
from common import *  # noqa  (Runde-4-common zuerst laden)
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'runde3', 'generator'))
from a_util import lowres, blow  # noqa

B = 'MotiveIndia'
G = 2
lo = lowres(G)                                   # 125×175
W, H = lo.w, lo.h
FOAM, FOAM2 = (150, 176, 190), (96, 124, 142)     # Schaum (aufgehellte Meeresfarben)

ship = sprite('h38_ship', B, [394, 395, 396])
tent = sorted(parts(sprite('h38_tentacle', B, [385]), dil=1), key=lambda p: -p.shape[0] * p.shape[1])[0]
capt_all = sprite('h38_captain', B, [383, 384, 387, 388])
capt = sorted(parts(capt_all, dil=0), key=lambda p: -p.shape[0] * p.shape[1])[0]
hull_thing = sprite('h38_hullthing', B, [390], box=(430, 240, 490, 277))   # Ursprung (438,243)

# --- Meer (Periode 76 senkrecht, waagrecht gespiegelt verbreitert) ---------------------------------
sea = widen(layer(B, 403)[130:206, 330:505, :3], W)
for y in range(H):
    lo.a[y] = sea[y % 76]

# --- Schiff: Bug nach oben, Bugspitze knapp unter dem oberen Rand ----------------------------------------
S = rot90(ship, 2)
SX, SY = (W - S.shape[1]) // 2, 12
Sm = np.zeros((H, W), bool)
ys_, xs_ = np.where(S[..., 3] > 0)
ok = (ys_ + SY < H) & (xs_ + SX >= 0) & (xs_ + SX < W)
Sm[ys_[ok] + SY, xs_[ok] + SX] = True

# --- Krakenschatten unter Wasser (selbst gezeichnet): Leib unter dem Bug, Arme an den Flanken ----------
DARK = np.array((2, 7, 12))
def shade(x, y, t):
    if 0 <= x < W and 0 <= y < H and not Sm[y, x] and t > BAYER4[y % 4, x % 4]:
        lo.a[y, x] = (lo.a[y, x] * 0.3 + DARK * 0.7).astype(np.uint8)
MX, MY = 62, 30
for y in range(H):
    for x in range(W):
        d = ((x - MX) / 58) ** 2 + ((y - MY) / 44) ** 2
        if d < 1: shade(x, y, min(1, (1 - d) * 2.4))
for side in (-1, 1):                                   # je drei Arme pro Seite, am Rumpf entlang nach unten
    for k, (a0, L) in enumerate(((20, 120), (45, 95), (70, 70))):
        for i in range(L):
            t = i / L
            ang = math.radians(90 - side * (a0 - 30 * t) + side * 18 * math.sin(t * 5 + k))
            x = int(round(MX + side * 30 + (22 + i) * math.cos(ang) * 0.55 * side * side * (1 if side > 0 else 1)))
            x = int(round(MX + side * (26 + i * 0.35 + 6 * math.sin(i / 9.0 + k))))
            y = int(round(MY + 10 + i * (1.2 - 0.25 * k)))
            wdt = max(1, int(6 - i / 20))
            for dx in range(-wdt, wdt + 1):
                for dy in range(-1, 2):
                    shade(x + dx, y + dy, 0.8 - t * 0.5)

# Bugwelle (1 Zelle, Schaumfarben abwechselnd) an beiden Flanken
tip_x = SX + S.shape[1] // 2
for side in (-1, 1):
    for i in range(0, 90):
        y = SY + 20 + i
        row = np.where(S[min(S.shape[0] - 1, y - SY), :, 3] > 0)[0]
        if not len(row): continue
        edge = SX + (row[0] if side < 0 else row[-1])
        x = edge + side * (2 + i // 6)
        if (i // 4) % 3 != 2 and 0 <= x < W:
            lo.px(x, y, FOAM if i % 2 == 0 else FOAM2)
lo.paste(silhouette(S, (3, 7, 12)), SX + 2, SY + 2, alpha=0.5)
lo.paste(S, SX, SY)

# --- Ding in der Luke (Luke nach Drehung: x 62–78, y 128–155 im Schiff; Versatz der Figur −6/0) ----------
lo.paste(hull_thing, SX + 62 - 6, SY + 128)

# --- Kapitän auf dem Vordeck -------------------------------------------------------------------------
CX, CY = W // 2 + 4, SY + 94
lo.paste(capt, CX - capt.shape[1] // 2, CY - capt.shape[0])

# --- großer Tentakel ------------------------------------------------------------------------------------
# Original: Ansatz mit gerader Unterkante (Wasserlinie), dicker Leib links, Spitze rechts oben.
# Um 90° im Uhrzeigersinn gedreht: Ansatz links (im Wasser neben dem Bug), Bogen über die Reling,
# Spitze zeigt nach unten auf den Kapitän.
T = rot90(tent, -1).copy()
m = T[..., 3] > 0
h, w = m.shape
# Volumen: Randzone (1–2 Zellen innen am Umriss) abdunkeln, Kernlinie leicht aufhellen
import cv2
dist = cv2.distanceTransform(np.pad(m, 1).astype(np.uint8), cv2.DIST_L2, 3)[1:-1, 1:-1]
rgb = T[..., :3].astype(float)
rgb[(dist > 0) & (dist <= 2)] *= 0.78
rgb[(dist > 2) & (dist <= 3.5)] *= 0.9
T[..., :3] = rgb.clip(0, 255).astype(np.uint8)
# Saugnäpfe: entlang der Innenkante der Krümmung (Seite zum Kapitän, rechts/unten), alle 5 Zellen,
# Farben aus dem Sprite (hell: Saugnapf-Rand des Originals, dunkel: Umrissfarbe)
cols = T[m][:, :3]
u, n = np.unique(cols, axis=0, return_counts=True)
light = tuple(int(v) for v in u[np.argmax(u.sum(1))])
darkc = tuple(int(v) for v in u[np.argmin(u.sum(1))])
inner = []
for y in range(h):
    xs = np.where(m[y])[0]
    if len(xs) and y > 8: inner.append((xs[-1] - 3, y))     # rechte Innenkante
for i, (x, y) in enumerate(inner[::5]):
    if dist[y, x] < 2.5: continue
    for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
        T[y + dy, x + dx, :3] = light
    T[y, x, :3] = darkc
TX, TY = -2, 4
lo.paste(silhouette(T, (2, 6, 12)), TX + 3, TY + 4, alpha=0.5)
lo.paste(T, TX, TY)
# Schaum an der Wasserlinie (linke gerade Kante), nur im Wasser
col0 = np.where(m[:, :3].any(1))[0]
for y in range(TY + col0.min() - 2, TY + col0.max() + 3):
    for x in (TX - 1, TX):
        if 0 <= x < W and 0 <= y < H and not Sm[y, x]:
            lo.px(x, y, FOAM if (x + y) % 2 == 0 else FOAM2)

vig = Canvas(W, H); vig.a[:] = lo.a
vignette(vig, 0.4, 0.6)
lo.a[:] = vig.a
cv = Canvas(250, 350)
blow(cv, lo, G)
print(save(cv, '38_thing_in_the_hull.png'))
