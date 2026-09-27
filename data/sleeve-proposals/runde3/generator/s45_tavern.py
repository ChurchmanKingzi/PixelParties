# -*- coding: utf-8 -*-
"""Sleeve 45 – „Last Round“ (Runde 3b überarbeitet): Letzte Runde in der Taverne. Hinter der Theke der Wirt im
Anzug und die blonde Kellnerin vor dem Regal mit Gläsern und Flaschen; vor der Theke prostet Chuck mit dem
Bierkrug, Kohta sitzt mit seinem Glas auf dem Stuhl (seine Flasche steht auf der Theke), rechts der Alte mit dem
langen Bart auf seinem Stuhl.

Skalierung (Regel A): ALLES 3× – Tavernenraum (Regal, Theke, Hocker, Dielen aus der Raumkarte), alle Figuren,
Krüge, Flasche, Stuhl. (Die alte Fassung mischte 2×/3×/4× – verworfen.)

Vollständigkeit (Regel B), geprüft gegen die Kartenszenen:
  Wirt [991] in „Sichtbar #110“ nur von der Theke verdeckt (Ebene vollständig, inkl. Beine);
  Kellnerin [992] in „Sichtbar #303“ (0.95, Rest = davorliegende Effekt-Ebenen);
  Chuck + Alter [982] in „Sichtbar #110“ (1.0); Alter auf dem Stuhl [999] in „Sichtbar #260“ (1.0);
  Kohta [1007] in „Sichtbar #261“ (0.9, nur Tischkante davor) – Stuhl und Flasche sind Teile derselben Ebene.

Quellen (Motive.xcf): 1010 „Ebene #213“ (Tavernenraum), 991 „Chuck #1“ (Wirt), 992 „Haste #5“ (Kellnerin),
982 „Chuck“ (Chuck mit Bier), 999 „Old Couple“ (Alter auf Stuhl), 1007 „Kohta #3“ (Kohta, Stuhl, Flasche),
988 „Chuck #2“ (Krüge).
"""
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
K = 3
cv = Canvas(W2, H2)

# ---------------------------------------------------------------- Raum (3×) aus der Raumkarte
AX, AY = 226, 86                                   # linke obere Ecke des Kartenausschnitts
room = layer(B, 1010)[..., :3]
crop = room[AY:AY + H2 // K + 1, AX:AX + W2 // K + 1]
bg = up(rgba(crop), K)[:H2, :W2, :3]
cv.a[:] = bg


def Y(cy):                                          # Kartenzeile -> Bildzeile
    return (cy - (AY - 84)) * K


COUNTER = Y(71)                                     # Oberkante Theke (Kartenzeile 71)

# warmes Licht von oben links, zur Kante dunkler
dither_blend(cv, (255, 200, 110), lambda x, y: max(0.0, 1 - ((x - 70) ** 2 + (y - 40) ** 2) ** 0.5 / 170) * 0.25)


def fig(name, s):
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'g45_%s.png' % name))
    return s


host = fig('host', lay(B, 991))
maid = fig('maid', lay(B, 992))
p982 = parts(lay(B, 982), dil=0)
chuck = fig('chuck', p982[0])
p999 = parts(lay(B, 999), dil=0)
oldman = fig('oldman', p999[-1])
p1007 = parts(lay(B, 1007), dil=0)
bottle = fig('bottle', [p for p in p1007 if p.shape[:2] == (13, 5)][0])
kohta = fig('kohta', [p for p in p1007 if p.shape[:2] == (23, 17)][0])
chair = fig('chair', [p for p in p1007 if p.shape[:2] == (15, 9)][0])
mugs = parts(lay(B, 988), dil=1)

# hinter der Theke: Wirt und Kellnerin, Füße auf dem Boden hinter der Theke, von der Theke verdeckt
for s, cx in ((host, 78), (maid, 172)):
    u = up(s, K)
    cv.paste(u, cx - u.shape[1] // 2, Y(76) - u.shape[0])
cv.a[COUNTER:Y(90)] = bg[COUNTER:Y(90)]             # Theke wieder davor
# Krüge und Kohtas Flasche auf der Theke
for mg, x in zip(mugs, (24, 206)):
    u = up(mg, K); cv.paste(u, x, Y(79) - u.shape[0])
b = up(bottle, K); cv.paste(b, 132, Y(80) - b.shape[0])


def front(s, cx, feet):
    u = up(s, K)
    x, y = cx - u.shape[1] // 2, feet - u.shape[0]
    sh = silhouette(u, (30, 16, 6))
    sh = np.concatenate([sh[r:r + K] for r in range(0, sh.shape[0], 4 * K)], 0)
    cv.paste(sh, x + K, feet - sh.shape[0] + K, alpha=0.45)
    cv.paste(u, x, y)
    return x, y


FEET = 336
front(chuck, 44, FEET)
# Kohta sitzt auf seinem Stuhl (Stuhl hinter ihm, Sitzfläche auf Hüfthöhe)
cu = up(chair, K)
kx = 128
cv.paste(silhouette(cu, (30, 16, 6))[::4], kx + 12, FEET - 4, alpha=0.4)
cv.paste(cu, kx + 6, FEET - cu.shape[0])
front(kohta, kx, FEET - 3)
front(flip(oldman), 208, FEET)

vignette(cv, 0.45, 0.6)
print(save(cv, '45_tavern.png'))
