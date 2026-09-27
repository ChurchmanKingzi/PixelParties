# -*- coding: utf-8 -*-
"""27 Lure of the Abyss – Licht in der Tiefsee: in völliger Schwärze leuchtet nur die Laterne der Greatmaw Siren
(Anglerfisch-Hai mit blondem Haar). Ein verliebtes Fischchen (Herz-Auge) schwimmt ahnungslos auf das Licht
und das offene Maul zu, ein zweites folgt aus dem Dunkel. Nur was nah an der Laterne ist, wird beleuchtet.

Quellen (MotiveDeepsea.xcf):
  Ebene 84 „Greatmaw Siren“ – Karte „Greatmaw Siren“ (eine der zwei identischen Figuren der Ebene)
  Ebene 85 „Ebene #199“ – die zwei blauen Fischchen (mit Herz-Auge und normal) derselben Karte
Selbst gezeichnet: Tiefseeschwärze, Lichthof der Laterne, Schwebeteilchen („Meeresschnee“).
Beleuchtung: Helligkeit je Rasterzelle nach Abstand zur Laterne, quantisiert und geordnet gedithert.

Skalierung: EIN Raster für alles – 3× (84×117-Raster): Siren, Fische, Licht, Hintergrund.
"""
from s26_30_fkit import *  # noqa

D = 'MotiveDeepsea'
K = 3
E = Ebene(K)                        # 84 × 117
Wd, Hd = E.w, E.h

siren = parts(sprite('f27_siren84', D, [84]), dil=1)[0]           # 45 × 62, Maul links, Laterne links oben
fish = parts(sprite('f27_l85', D, [85]), dil=1, minpx=2)          # [Herz-Fisch (Blick rechts), normaler Fisch]
heart = [f for f in fish if (f[..., 0] > 200).any() and (f[..., 2] > 200).any()][0]
plain = [f for f in fish if f is not heart][0]

SX, SY = 16, 49                     # Lage der Siren (oben links)
# Laternenspitze im Sprite finden (rote Pixel ganz oben links)
r = siren[..., 0].astype(int); g = siren[..., 1].astype(int)
ys, xs = np.where((r > 150) & (g < 90) & (siren[..., 3] > 0) & (np.arange(siren.shape[1])[None, :] < 8))
LX, LY = SX + xs.mean() + 0.5, SY + ys.mean() + 0.5

def light(x, y):
    d = math.hypot(x + .5 - LX, y + .5 - LY)
    return max(0.0, min(1.0, 1.2 - d / 36.0))

# --- Tiefsee: fast schwarz, Lichthof um die Laterne ----------------------------------------------------------
abyss = [(3, 4, 12), (6, 8, 20), (11, 12, 30), (20, 16, 40), (34, 20, 48), (54, 26, 56), (80, 34, 64), (112, 44, 72)]
for y in range(Hd):
    for x in range(Wd):
        d = math.hypot(x + .5 - LX, y + .5 - LY)
        t = max(0.0, 1 - d / 30.0) ** 1.9 * (len(abyss) - 1) + 0.9 * (1 - y / Hd)
        i = int(min(len(abyss) - 1, math.floor(t + B4[y % 4, x % 4] * 0.999)))
        E.a[y, x, :3] = abyss[i]; E.a[y, x, 3] = 255

# Meeresschnee (einzelne Zellen), heller nahe am Licht
rng = np.random.RandomState(27)
for _ in range(70):
    x, y = rng.randint(0, Wd), rng.randint(0, Hd)
    l = light(x, y)
    if l < 0.05 and rng.rand() < 0.6: continue
    E.a[y, x, :3] = mix((24, 30, 56), (200, 150, 150), l)

def lit(s, ox, oy, floor=0.08):
    """Sprite nach Abstand zur Laterne abdunkeln (Stufen, geordnet gedithert)."""
    out = s.copy()
    for j in range(s.shape[0]):
        for i in range(s.shape[1]):
            if s[j, i, 3] == 0: continue
            l = max(floor, light(ox + i, oy + j))
            q = min(1.0, math.floor(l * 6 + B4[(oy + j) % 4, (ox + i) % 4]) / 6)
            out[j, i, :3] = (s[j, i, :3].astype(float) * (0.1 + 0.9 * q) + np.array([6, 4, 14]) * (1 - q)).astype(np.uint8)
            # Rotstich des Laternenlichts
            if q > 0: out[j, i, :3] = mix(out[j, i, :3], (255, 120, 120), 0.10 * q)
    return out

# --- zweiter Fisch weit oben rechts im Dunkel (schwimmt nach links, aufs Licht zu) --------------------------------
F2X, F2Y = 55, 15
E.paste(lit(flip(plain), F2X, F2Y, floor=0.22), F2X, F2Y)

# --- Siren ------------------------------------------------------------------------------------------------------
S = lit(siren, SX, SY, floor=0.16)
# Laterne selbst voll leuchtend
m = (siren[..., 0] > 150) & (siren[..., 1] < 90) & (np.arange(siren.shape[1])[None, :] < 8)
S[m, :3] = siren[m, :3]
# Angelschnur der Laterne (schwarz) im Lichtschein leicht aufhellen, damit sie sichtbar bleibt
line = (siren[..., :3].max(-1) < 30) & (siren[..., 3] > 0) & (np.arange(siren.shape[0])[:, None] < 9)
S[line, :3] = (92, 52, 70)
E.paste(S, SX, SY)
# Laternen-Kern: hellster Punkt
E.px(int(LX), int(LY), (255, 214, 200))

# --- verliebter Fisch direkt über der Laterne (Blick nach links unten aufs Licht) -------------------------------
F1X, F1Y = 25, 32
E.paste(lit(flip(heart), F1X, F1Y, floor=0.3), F1X, F1Y)

cv = Canvas(W, H)
onto(cv, E)
print(save(cv, '27_lure_of_the_abyss.png'))
