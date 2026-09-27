# -*- coding: utf-8 -*-
"""Sleeve 05 – Mondduell der Idej-Lords.

Vor einem riesigen Vollmond kreuzen Nobunakin (rot, mit der geschwungenen Klinge) und
Todugawin (violett, mit Stangenwaffe) auf einem Hügel aus Kirschblüten die Waffen; eine rote
Schnittspur („Idej Sword – Muras“) zieht quer durch den Mond. Kirschbäume rahmen die Szene.
Quellen (MotiveJapan.xcf): Ebene #34 [150] + #41 [152] + #39 [154] + #40 [155] (Nobunakin mit
Klinge), ARBEITE HIER [224] (Todugawin mit Stangenwaffe), Ebene #17 [183] (Kirschbäume),
Ebene #13 [245] (Blütenboden), Ebene #49 [189] (Schnittspur), Ebene #75 [52] (Blütenblätter).
Nachthimmel und Mond: selbst erstellt (geditherter Verlauf / Scheibe).
"""
from a_util import *  # noqa

B = 'MotiveJapan'
cv = Canvas(250, 350)

nob = sprite('a05_nobunakin', B, [150, 152, 154, 155])
todu = sprite('a05_todugawin', B, [224])
pairs = parts(sprite('a05_cherries', B, [174]), dil=0)        # zwei Baumpaare
grove = parts(sprite('a05_cherries3', B, [181]), dil=0)[0]      # Dreiergruppe
bank = layer(B, 245)
slash = sprite('a05_slash', B, [189])
petals = [q for q in parts(sprite('a05_petals', B, [52]), dil=0) if q.shape[0] * q.shape[1] >= 4]
print(nob.shape, todu.shape, [t.shape for t in pairs], grove.shape)

# --- Nachthimmel + Mond ---------------------------------------------------------------------------
vgrad(cv, 0, 260, [(8, 8, 30), (18, 20, 58), (40, 34, 90), (70, 44, 104)])
MX, MY, MR = 112, 138, 78
glow(cv, MX, MY, MR * 1.45, (200, 190, 255), 0.3)
for y in range(MY - MR, MY + MR):
    for x in range(MX - MR, MX + MR):
        d = math.hypot(x + .5 - MX, y + .5 - MY)
        if d < MR and 0 <= x < 250 and 0 <= y < 350:
            # Rand etwas dunkler (gedithert), Mondfarbe aus Himmel/Wolken der Japan-Karten
            t = d / MR
            c = (246, 240, 214) if t + (BAYER4[y % 4, x % 4] - .5) * .3 < 0.8 else (222, 212, 196)
            cv.a[y, x] = c

# Schnittspur quer durch den Mond
put(cv, slash, -36, 30, 2)

# --- Kirschbäume (Rahmen, Tiefe) ------------------------------------------------------------------
put(cv, darken(grove, 0.4), 125 - grove.shape[1], 262, 2, anchor='bl')
put(cv, darken(pairs[0], 0.55), -70, 262, 3, anchor='bl')
put(cv, darken(pairs[1], 0.55), 250 - pairs[1].shape[1] * 3 + 60, 258, 3, anchor='bl', fl=True)

# --- Blütenhügel -----------------------------------------------------------------------------------
hill = bank[99:160, 130:255].copy(); hill[..., 3] = 255
put(cv, darken(hill, 0.8), 0, 244, 2)

# --- Kämpfer ---------------------------------------------------------------------------------------
OUT = (20, 6, 24)
put(cv, outline(nob, OUT), 6, 336, 5, anchor='bl', shadow=0.4, sdx=1, sdy=0)
tod_o = outline(todu, OUT)
put(cv, tod_o, 250 - tod_o.shape[1] * 5 + 28, 350, 5, anchor='bl', shadow=0.4, sdx=1, sdy=0)

for (x, y), i in zip([(20, 40), (200, 60), (230, 150), (180, 20), (40, 190), (206, 214), (14, 120)],
                     [3, 11, 25, 40, 57, 70, 90]):
    put(cv, petals[i % len(petals)], x, y, 2)

frame(cv, [(10, 6, 20), (90, 40, 110), (230, 200, 150), (10, 6, 20)])
print(save(cv, '05_idej_mondduell.png'))
