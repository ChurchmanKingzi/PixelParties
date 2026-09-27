# -*- coding: utf-8 -*-
"""Sleeve 04 – Yokai-Parade über die rote Brücke (Runde 3b überarbeitet).

Bei Sonnenuntergang zieht die Rebelliokai-Bande über die rote Bogenbrücke: vorneweg fliegt der Tengu
mit seinem Fächer, dahinter trippeln ein Baku, der jubelnde Tanuki, der Oni (seine Stachelkeule steht
wie auf der Karte neben ihm) und ein zweiter Baku. Unter der Brücke lauert der getarnte Kappa mit
gezogenem Schwert halb im Wasser (halbtransparent wie auf seiner Karte), das Wasser spiegelt Brücke
und Abendhimmel. Kitsune und Kirin sind entfernt (nur noch in Sleeve 06 → Doppelung aufgelöst).

Skalierung: ALLES einheitlich 3× (Szene im 3×-Raster = 84×117 Zellen): Himmel, Sonne, Brücke,
alle Figuren, Wasser, Spiegelung, Blütenblätter. Die Figuren stehen auf dem Brückendeck
(Fußlinie folgt dem Bogen), das vordere Geländer verdeckt die Füße.

Quellen (MotiveJapan.xcf): Brücke [84], Ebene #171 [209] + Ebene #173 [205] (Tengu + Fächer, geprüft
gegen Sichtbar #37), Ebene #115 [107] + Ebene #118 [101] (Oni + Keule, Sichtbar #20), Tanuki [182]
(Sichtbar #17), Backup Bakus [30] (Sichtbar #20), Kappa [42] (Karte „Rebelliokai Camouflaged Kappa“),
Ebene #75 [52] (Blütenblätter). Himmel, Sonne, Wasser und Spiegelung: selbst erstellt im 3×-Raster.
"""
from a_util import *  # noqa

B = 'MotiveJapan'
cv = Canvas(250, 350)
G = 3
lo = lowres(G)                                       # 84×117

bridge = sprite('a04_bridge', B, [84])              # 109×42
bakus = [p for p in parts(sprite('a04_bakus', B, [30]), dil=1) if p.shape == (20, 20, 4)]
tengu = sprite('a04_tengu', B, [209, 205])
tanuki = sprite('a04_tanuki', B, [182])
oni = sprite('a04_oni', B, [107])
club = sprite('a04_club', B, [101])
kappa = sprite('a04_kappa', B, [42])
petals = [q for q in parts(sprite('a04_petals', B, [52]), dil=0) if 2 <= q.shape[0] * q.shape[1] <= 6]

BX, BY = (84 - 109) // 2, 60                         # Brücke links oben (Raster)
WL = BY + 34                                         # Wasserlinie (Fuß der Pfeiler)


def deck(cx):
    """Zeile der Standfläche auf dem Brückendeck an Rasterspalte cx (Bogenform aus der Ebene gemessen)."""
    col = cx - BX
    return BY + 8 + ((col - 56) / 35.0) ** 2 * 5 + 3


# --- Abendhimmel + Sonne ---------------------------------------------------------------------------------
vgrad(lo, 0, WL, [(26, 12, 52), (70, 26, 86), (150, 50, 96), (232, 110, 80), (250, 170, 90)])
SX, SY, SR = 21, 30, 13
for y in range(SY - SR, SY + SR):
    for x in range(SX - SR, SX + SR):
        d = math.hypot(x + .5 - SX, y + .5 - SY)
        if d < SR and 0 <= x < 84 and 0 <= y < WL:
            lo.a[y, x] = (255, 214, 120) if d < SR - 2 else (252, 180, 100)
# waagerechte Wolkenstreifen vor der Sonne
for (y, x0, x1, c) in [(SY + 3, 2, 34, (200, 90, 110)), (SY + 4, 8, 44, (200, 90, 110)),
                       (SY - 5, 16, 40, (170, 70, 110)), (SY + 12, 26, 60, (190, 84, 104))]:
    lo.rect(x0, y, x1, y + 1, c)

# --- Figuren auf dem Deck (hinter dem vorderen Geländer) --------------------------------------------------------
lo.paste(bridge, BX, BY)
walkers = [(bakus[0], 11), (tanuki, 29), (oni, 49), (bakus[2], 74)]
for s, cx in walkers:
    fy = int(round(deck(cx)))
    lo.paste(s, cx - s.shape[1] // 2, fy - s.shape[0] + 1)
fy = int(round(deck(60)))
lo.paste(club, 60 - club.shape[1] // 2, fy - club.shape[0] + 1)
# vorderes Geländer (alles unterhalb der Standfläche) wieder darüber → verdeckt die Füße
front = bridge.copy()
for col in range(front.shape[1]):
    cut = int(round(deck(col + BX) - BY)) - 1
    front[:max(0, cut), col] = 0
lo.paste(front, BX, BY)

# --- Tengu fliegt voraus ------------------------------------------------------------------------------------------
lo.paste(tengu, 84 - tengu.shape[1] - 3, 3)

# --- Wasser mit Spiegelung ----------------------------------------------------------------------------------------
refl = lo.a[WL - (117 - WL):WL][::-1].astype(float)
water = refl * 0.5 + np.array([30, 20, 70]) * 0.5
lo.a[WL:] = water[:117 - WL].astype(np.uint8)
for y in range(WL + 1, 117, 3):
    for x in range(84):
        if (x + 2 * y) % 9 < 3:
            lo.a[y, x] = (lo.a[y, x] * 0.55 + np.array([255, 190, 150]) * 0.45 * (1 - (y - WL) / 60)).clip(0, 255)
lo.rect(0, WL, 84, WL + 1, (60, 30, 70))

# Kappa lauert halb im Wasser (untere Hälfte durchscheinend, Tarnung wie auf der Karte)
KX, KY = 6, WL + 3
top = kappa.copy(); top[11:] = 0
bot = kappa.copy(); bot[:11] = 0
lo.paste(bot, KX, KY, alpha=0.4)
lo.paste(top, KX, KY)
for dx in (-3, -2, 17, 18, 19):                                    # Kräuselwellen links/rechts vom Körper
    lo.px(KX + 6 + dx, KY + 11, (230, 170, 160))

# Blütenblätter
for (x, y), i in zip([(30, 10), (8, 24), (40, 30), (12, 44), (22, 4), (70, 50), (4, 60)],
                     [2, 9, 15, 22, 30, 38, 45]):
    lo.paste(petals[i % len(petals)], x, y)

blow(cv, lo, G)
print(save(cv, '04_yokai_parade.png'))
