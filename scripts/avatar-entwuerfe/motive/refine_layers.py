# -*- coding: utf-8 -*-
"""Wählt je Karte die Motiv-Ebene, die das Szenenbild (inkl. Figur) am genauesten zeigt.

Die grobe Suche (locate_cards.py) findet nur die Stelle; in den Sichtbar-Ebenen derselben Datei steckt aber
dieselbe Szene in vielen Bearbeitungsständen (teils ohne Figur). Hier wird die beste Ebene pro Karte bestimmt."""
import os, sys, json, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import neue_avatare as N
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from picks import PICKS

todo = {}
for pid, card, *_ in PICKS:
    i = N.IDX[N.norm(card)]
    for rank, (sc, m, f, idx, name, x, y) in enumerate(N.LOC[str(i)][:3]):
        if sc <= 0.02:
            todo.setdefault(f, []).append((i, m, x, y, rank))
best = {}
for f, jobs in todo.items():
    meta = json.load(open(f'{N.E}/{f}/layers.json'))['layers']
    tmpl = {}
    for (i, m, x, y, rank) in jobs:
        tmpl[(i, m, x, y)] = N.card_native(i, m)
    for l in meta:
        if 'bw' not in l or l['bw'] < 150 or l['bh'] < 100:
            continue
        c = np.array(Image.open(f'{N.E}/{f}/crops/{l["index"]:04d}.png').convert('RGBA'))
        for (i, m, x, y), t in tmpl.items():
            th, tw = t.shape[:2]
            for dy in range(-3, 4):
                for dx in range(-3, 4):
                    X, Y = x + dx - l['bx'], y + dy - l['by']
                    if X < 0 or Y < 0 or Y + th > c.shape[0] or X + tw > c.shape[1]:
                        continue
                    w = c[Y:Y + th, X:X + tw]
                    if (w[..., 3] < 255).mean() > 0.02:
                        continue
                    e = float(((w[..., :3].astype(np.float32) - t) ** 2).mean() / 255 ** 2)
                    if i not in best or e < best[i][0]:
                        best[i] = (e, f, l['index'], m, x + dx, y + dy)
    print(f, len(jobs), flush=True)
json.dump({str(k): v for k, v in best.items()}, open('/home/user/refine_layers.json', 'w'))
print('fertig', len(best))
