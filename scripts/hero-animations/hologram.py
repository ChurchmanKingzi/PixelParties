# -*- coding: utf-8 -*-
"""Hologramm-Look für die Idej-Heroes (Projektionen).

projection(out, i, flicker, glitch, pt): das fertige Frame wird halb durchsichtig (ALPHA), eine
hellere Abtastzeile wandert mit 1,5 px/Frame nach unten (in Frame 0 noch oberhalb des Bildes), ab und
zu flackert das Bild (flicker = {Frame: Faktor}, kurz blasser) und ein 2-Zeilen-Streifen springt um
1 px zur Seite (glitch = {Frame: Sprite-Zeile}; pt = oberer Rand des Sprites im Frame).
"""
import numpy as np

ALPHA = 0.62


def projection(out, i, flicker, glitch, pt, alpha=ALPHA):
    H = out.shape[0]
    f = flicker.get(i, 1.0)
    band = (i * 1.5) % (H + 12) - 6
    g = glitch.get(i)
    if g is not None:
        g += pt
        out[g:g + 2] = np.roll(out[g:g + 2], 1, axis=1)
    for y in range(H):
        a = alpha * f * (1.35 if abs(y - band) < 1 else 1.0)
        out[y, :, 3] = np.minimum(255, out[y, :, 3] * a).astype(int)
    return out
