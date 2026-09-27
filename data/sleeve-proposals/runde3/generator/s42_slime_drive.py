# -*- coding: utf-8 -*-
"""Sleeve 42 – „Slime Drive“ (Runde 3b überarbeitet): Der Slime Rancher treibt seine Herde auf dem Waldweg auf
uns zu. Vorneweg der gekrönte Shiny Slime, dahinter dicht gedrängt Hardy, Fiery, Icy, Rocky, Sparky, Slimy und
Darky, über der Herde flattert der Cloudy Slime; der Rancher in der Kutte bildet das Schlusslicht.

Skalierung (Regel A): ALLES 3× – Waldkarte (Bäume, Weg, Holzsteg), alle Slimes und der Rancher; es ist die
Draufsicht der Spielkarte, in der Figuren und Kacheln im selben Maßstab stehen. Nur die Schatten sind flach
gedrückte Silhouetten im selben Raster.

Vollständigkeit (Regel B): alle Slimes pixelgleich in ihren Kartenszenen (Sichtbar #131/#141/#142/#125, match ≥ 0.98);
der Rancher (match 0.78 in Sichtbar #141) wird dort nur von davorstehenden Slimes überdeckt – Ebene vollständig.

Quellen (Motive.xcf): 456 „Slime Rancher“, 447 „Shiny Slime“, 449 „Hardy Slime“, 454 „Slimy Slime“,
459 „Cloudy Slime“, 462 „Rocky Slime“, 466 „Fiery Slime“, 469 „Icy Slime“, 532 „Sparky Slime“, 535 „Darky Slime“,
1142 „Wald“ (Karte).
"""
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
K = 3
cv = Canvas(W2, H2)

wald = layer(B, 1142)[:, :, :3]
X0, Y0 = 284, 96                                  # Ausschnitt der Waldkarte (Weg in der Bildmitte)
bg = wald[Y0:Y0 + H2 // K + 1, X0:X0 + W2 // K + 1]
cv.a[:] = up(rgba(bg), K)[:H2, :W2, :3]

sl = {n: lay(B, i) for n, i in dict(rancher=456, shiny=447, hardy=449, slimy=454, cloudy=459, rocky=462,
                                     fiery=466, icy=469, sparky=532, darky=535).items()}
for n, s in sl.items():
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'g42_%s.png' % n))


def shadow(u, cx, feet):
    """flacher Schatten: Silhouette auf ein Drittel der Höhe gestaucht (Zeilen im 3er-Raster)"""
    sh = silhouette(u, (16, 26, 8))
    rows = [r for r in range(0, sh.shape[0], K * 3)]
    sh = np.concatenate([sh[r:r + K] for r in rows], 0)
    cv.paste(sh, cx - sh.shape[1] // 2 + K, feet - sh.shape[0] // 2 - K, alpha=0.45)


placed = []


def put(name, cx, feet, fl=False, sh=True):
    s = sl[name]
    if fl: s = flip(s)
    u = up(s, K)
    placed.append((feet, name, u, cx, sh))


# von hinten (oben) nach vorn (unten); Füße im 3er-Raster
put('rancher', 150, 150)
put('darky', 96, 168)
put('slimy', 186, 186)
put('rocky', 120, 204, fl=True)
put('sparky', 186, 234)
put('icy', 72, 236)
put('fiery', 130, 266)
put('hardy', 196, 300, fl=True)
put('shiny', 104, 318)
for feet, name, u, cx, shd in sorted(placed, key=lambda t: t[0]):
    if shd: shadow(u, cx, feet)
    cv.paste(u, cx - u.shape[1] // 2, feet - u.shape[0])

# Cloudy Slime schwebt über der Herde (Schatten weit darunter auf dem Weg)
c = up(flip(sl['cloudy']), K)
shadow(c, 54, 150)
cv.paste(c, 54 - c.shape[1] // 2, 66)

vignette(cv, 0.3, 0.65)
print(save(cv, '42_slime_drive.png'))
