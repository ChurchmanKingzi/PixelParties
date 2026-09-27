# -*- coding: utf-8 -*-
"""Sleeve 04 – Nächtliche Yokai-Parade (Hyakki Yagyō der Rebelliokai).

Unter violettem Nachthimmel zieht die Rebelliokai-Bande über die rote Bogenbrücke: die Bakus
trippeln auf der Brücke, der Tengu schwebt mit seinem Fächer voraus, vorne am Ufer aus
Kirschblüten tanzen Tanuki, Kitsune (mit Fuchsfeuer-Schwänzen) und der Oni mit seiner
Keule. Brücke und Himmel spiegeln sich dunkel im Fluss, Blütenblätter wehen.
Quellen (MotiveJapan.xcf): Ebene #137 [246] (Nachthimmel), Brücke [84], Ebene #13 [245]
(Kirschblüten-Ufer), Ebene #75 [52] (Blütenblätter), Backup Bakus [30], Ebene #171 [209] +
Ebene #173 [205] (Tengu + Fächer), Kitsune [223] + Ebene #129 [222] (Fuchsfeuer), Tanuki [182],
Ebene #115 [107] + Ebene #118 [101] (Oni + Keule), Kirin [166].
Wasser: gespiegelter, abgedunkelter Himmel/Brücke (selbst erstellt).
"""
from a_util import *  # noqa

B = 'MotiveJapan'
cv = Canvas(250, 350)

sky = layer(B, 246)[220:460, 181:460]               # 279×240 violetter Himmel
bridge = sprite('a04_bridge', B, [84])
bank = layer(B, 245)
petals = sprite('a04_petals', B, [52])
bakus = [p for p in parts(sprite('a04_bakus', B, [30]), dil=1) if p.shape == (20, 20, 4)]
tengu = sprite('a04_tengu', B, [209, 205])
kitsune = sprite('a04_kitsune', B, [223, 222])
tanuki = sprite('a04_tanuki', B, [182])
oni = sprite('a04_oni', B, [107, 101])
kirin = sprite('a04_kirin', B, [166])
print('bakus', [b.shape for b in bakus], 'tengu', tengu.shape, 'oni', oni.shape)

# --- Himmel ------------------------------------------------------------------------------------
HOR = 196                                            # Wasserlinie
blit_rgb(cv, darken(sky[0:100, 40:165], 0.78), 0, 0, 2)

# --- Brücke (2×) ---------------------------------------------------------------------------------
BX, BY = 16, HOR - bridge.shape[0] * 2 + 10
# Bakus laufen über die Brücke (zwischen hinterem und vorderem Geländer ist kein eigener Layer →
# Figuren hinter die Brücke setzen, Köpfe schauen über das Geländer)
deck = []
walkers = [(kirin, 1)] + [(b, 0) for b in bakus[:3]]
xs = [BX + 150, BX + 110, BX + 80, BX + 50]
for (bk, _), x in zip(walkers, xs):
    # Höhe der Brückenoberkante an dieser Stelle (erste deckende Zeile der Spalte)
    col = (x - BX) // 2
    top = np.where(bridge[:, min(col, bridge.shape[1] - 1), 3] > 0)[0].min()
    deck.append((bk, x, BY + top * 2 + 10))
for bk, x, y in deck:
    put(cv, bk, x, y, 2, anchor='b', fl=True)
put(cv, bridge, BX, BY, 2)

# --- Wasser: Spiegelung von Himmel + Brücke --------------------------------------------------------
refl = cv.a[HOR - (350 - HOR):HOR][::-1].copy()
water = (refl.astype(float) * 0.45 + np.array([10, 10, 40]) * 0.55).astype(np.uint8)
cv.a[HOR:350] = water[:350 - HOR]
# waagerechte Wellenlinien (Dither), heller Himmelston
for y in range(HOR + 2, 350, 5):
    for x in range(250):
        if (x // 3 + y) % 7 in (0, 1): cv.a[y, x] = (np.array(cv.a[y, x], float) * 0.6 + np.array([150, 120, 220]) * 0.4).astype(np.uint8)

# --- Tengu schwebt voraus ---------------------------------------------------------------------------
put(cv, tengu, 120, 8, 3)

# --- Ufer mit Kirschblüten ----------------------------------------------------------------------------
shore = bank[99:160, 0:125].copy()                    # Grasrand + Blütenteppich
shore[..., 3] = 255
put(cv, shore, 0, 262, 2)

# --- Vordergrund-Parade ---------------------------------------------------------------------------------
put(cv, kitsune, 58, 322, 4, anchor='b', shadow=0.4)
put(cv, oni, 190, 334, 4, anchor='b', shadow=0.4)
put(cv, tanuki, 116, 352, 4, anchor='b', shadow=0.4)

# Blütenblätter wehen quer durchs Bild
pp_ = [q for q in parts(petals, dil=0) if q.shape[0] * q.shape[1] >= 4]
rng = np.random.RandomState(7)
spots = [(20, 60), (60, 84), (96, 40), (30, 150), (214, 150), (238, 124), (80, 176), (100, 226),
         (150, 120), (116, 250 - 90), (10, 110), (190, 180)]
for (x, y), i in zip(spots, rng.choice(len(pp_), len(spots), replace=False)):
    put(cv, pp_[i], x, y, 2)

frame(cv, [(14, 4, 20), (140, 30, 40), (240, 150, 190), (14, 4, 20)])
print(save(cv, '04_yokai_parade.png'))
