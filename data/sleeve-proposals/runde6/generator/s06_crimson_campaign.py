# -*- coding: utf-8 -*-
"""06 Crimson Campaign – Gegner „Bloody King Zi“, Held: Timeless King Zi (Base-Version).
Kriegskarte im Stil seiner Base-Karte: Timeless King Zi steht wie eine Königsfigur auf einer Lichtung seiner
verschneiten Insel im blutroten Abendlicht; hinter ihm (unten) seine goldenen Heeresmarken, vor ihm (oben, am
Waldrand) die blutrot umgefärbten Marken des Gegners.

Quellen (MotiveGrailWar.xcf):
  Ebene 487 „Zi“: Base-Zi mit Sternumhang (26×28), in Sichtbar #169 (Ebene 30, Kartenbild „Timeless King Zi“,
      Lage 227,108) sichtbar (99 %, Kartenszene leicht abgedunkelt).
  Ebene 483 „Zi #3“: die gekreuzten Speermarken seiner Kartenszene (eine davon, viermal gesetzt, zwei umgefärbt).
  Ebene 510 „Ebene #386“: verschneite Inselkarte, Ausschnitt x274–399/y85–260 (angeschnittene Berge links oben
      durch Schnee derselben Karte ersetzt), rötlich getönt.
Selbst gezeichnet: Tönung/Randabdunklung, Schatten.

Skalierung:
  Karte, Marken, Schatten – 2× (125×175)
  Zi                      – 5× (50×70)
"""
import math, random
from a_util import *  # noqa
import numpy as np

B = 'MotiveGrailWar'
zi = sprite('o06_zi', B, [487])                               # Base-Zi mit Sternumhang (26×28), = Sichtbar #169
marks = parts(compose(B, [483]), dil=1)                       # „Zi #3“: vier Heeresmarken (gekreuzte Speere) seiner Karte
snowmap = compose(B, [510], crop=False)                      # „Ebene #386“: verschneite Inselkarte

# ---- Ebene 1: Kriegskarte (2×, 125×175) ------------------------------------------------------
W2, H2 = 125, 175
MX, MY = 274, 85                                             # sechseckige Lichtung im verschneiten Wald
p2 = snowmap[MY:MY + H2, MX:MX + W2].copy()
p2[..., 3] = 255
# angeschnittene Berggruppe links oben durch Schnee derselben Karte (Stelle 40 px weiter rechts) ersetzen
cc = p2[..., :3].astype(int)
brown = (cc[..., 0] > cc[..., 2] + 25)
brown[40:] = False; brown[:, 40:] = False
p2[brown] = snowmap[MY:MY + H2, MX + 40:MX + 40 + W2][brown]
p2[..., 3] = 255
# blutrotes Abendlicht auf dem Schnee: Farben zu Karmin hin verschieben, Ränder dunkler
for y in range(H2):
    for x in range(W2):
        r, g, b = [int(v) for v in p2[y, x, :3]]
        d = math.hypot((x + 0.5 - W2 / 2) / (W2 / 2), (y + 0.5 - H2 / 2) / (H2 / 2))
        f = 1.0 - 0.28 * max(0.0, d - 0.45) / 0.55
        p2[y, x, :3] = (min(255, int(r * 1.0 * f)), int(g * 0.74 * f), int(b * 0.80 * f))
# Heeresmarken: unten Zis goldene Marken, oben die gegnerischen, blutrot umgefärbt
gold = marks[0]
gc = gold[..., :3].astype(int)
blue = (gc[..., 2] > gc[..., 0] + 30)
warm = (gc[..., 0] > gc[..., 2] + 20)
enemy = hsv_shift(gold, dh=-40, ds=1.2, dv=0.85, mask=warm)     # Gold → Blutrot
enemy = hsv_shift(enemy, dh=130, ds=1.0, dv=0.7, mask=blue)     # blaues Kreuz → dunkles Karmin
m2 = rgba(W2, H2)
put(m2, enemy, 6, 4); put(m2, enemy, W2 - 6 - 45, 4)
put(m2, gold, 6, H2 - 4 - 43); put(m2, gold, W2 - 6 - 45, H2 - 4 - 43)
# Bodenschatten unter Zi (Füße bei 250er-y 275 → 2×-Reihe 137)
shadow_ellipse(p2, 62.5, 137.5, 16, 3, col=(60, 20, 40), a=0.45)
cv = Canvas(250, 350)
blit(cv, p2, 2)
blit(cv, m2, 2)

# ---- Ebene 2: Zi (5×, 50×70) ----------------------------------------------------------------------
W5, H5 = 50, 70
p5 = rgba(W5, H5)
ZX, ZY = (W5 - zi.shape[1]) // 2, 55 - zi.shape[0]
put(p5, zi, ZX, ZY)
blit(cv, p5, 5, 0, 0)
print(save(cv, '06_crimson_campaign.png'))
print(preview('06_crimson_campaign.png', 'cosmic', 'ice', 'ruby', 'sapphire'))
