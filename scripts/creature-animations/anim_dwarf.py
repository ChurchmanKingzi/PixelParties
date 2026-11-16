# -*- coding: utf-8 -*-
"""Eigene Bausteine der Gruppe „Zwerge & Co.“ (Steam Dwarfs, Cannon Fodder, Barkeeper, Tuscan Artist) — baut auf anim_lib/anim_humanoide auf, ändert sie nicht.

    puff(h, w, i, n, puffs, farben)     Dampf-/Dunstwölkchen OHNE 1-px-Punkte (Regel 25): wächst von 2×2 über die volle Form (5×3 bzw. 7×5) und schrumpft wieder auf 2×2;
                                        puffs: Liste von dict(x, y, vx, vy, off, form='m'|'l'|'o', wackeln=0), farben = {'c': Kern, 'r': Rand}; nahtlos (Lebensdauer = n Frames)
    puff_pfad(h, w, i, n, puffs, farben)  wie puff, aber der Ursprung eines Wölkchens ist der Ort der Quelle (Rohröffnung) ZUM ZEITPUNKT SEINER ENTSTEHUNG: puffs[k]['quelle'] = f(frame) -> (x, y)
                                        (die Quelle darf mit Atmen/Rohrzittern wandern; bereits ausgestoßene Wölkchen bleiben auf ihrem Weg), vx/vy = Gesamtweg über die Lebensdauer
"""
import math

import numpy as np

import anim_lib as L

KETTE = {'m': ['s', 'm'], 'o': ['s', 'o'], 'l': ['s', 'm', 'l'], 's': ['s']}


def puff(h, w, i, n, puffs, farben):
    ebene = L.leer(h, w)
    for pf in puffs:
        t = ((i + pf.get('off', 0)) % n) / n
        cx = pf['x'] + pf.get('vx', 0) * t + pf.get('wackeln', 0) * math.sin(2 * math.pi * t)
        cy = pf['y'] + pf.get('vy', 0) * t
        cx, cy = int(round(cx)), int(round(cy))
        form = pf.get('form', 'm')
        kette = KETTE[form]
        u = min(t, 1 - t) / 0.5                                                 # 0 … 1 … 0
        if u < 0.12:
            continue                                                            # zu klein: Wölkchen noch/nicht mehr da (kein 1-px-Punkt)
        j = min(len(kette) - 1, int(u * len(kette) * 1.15))
        for (dx, dy, k) in L.PUFF_FORMEN[kette[j]]:
            x, y = cx + dx, cy + dy
            if not (0 <= y < h and 0 <= x < w):
                raise L.ClipError(f'Partikel bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
            ebene[y, x, :3] = farben[k]
            ebene[y, x, 3] = 255
    return ebene


def puff_pfad(h, w, i, n, puffs, farben):
    """Wie puff, aber `quelle(frame) -> (x, y)` liefert den Ursprung zum Entstehungszeitpunkt (Frame i - Alter); (x, y) wird dann nicht benötigt."""
    ebene = L.leer(h, w)
    for pf in puffs:
        t = ((i + pf.get('off', 0)) % n) / n
        alter = int(round(t * n))
        ox, oy = pf['quelle'](i - alter) if 'quelle' in pf else (pf['x'], pf['y'])
        cx = ox + pf.get('vx', 0) * t + pf.get('wackeln', 0) * math.sin(2 * math.pi * t)
        cy = oy + pf.get('vy', 0) * t
        cx, cy = int(round(cx)), int(round(cy))
        kette = KETTE[pf.get('form', 'm')]
        u = min(t, 1 - t) / 0.5
        if u < 0.12:
            continue
        j = min(len(kette) - 1, int(u * len(kette) * 1.15))
        for (dx, dy, k) in L.PUFF_FORMEN[kette[j]]:
            x, y = cx + dx, cy + dy
            if not (0 <= y < h and 0 <= x < w):
                raise L.ClipError(f'Partikel bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
            ebene[y, x, :3] = farben[k]
            ebene[y, x, 3] = 255
    return ebene
