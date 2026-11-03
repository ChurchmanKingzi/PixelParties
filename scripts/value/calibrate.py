#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kalibrierung eines schon trainierten Wertnetzes nachholen (Platt: z' = a·z + b auf den Roh-Logits).

    python3 scripts/value/calibrate.py --data data/training/combined/dataset --net data/training/combined/net-d7

Dieselbe Aufteilung wie beim Training (gleicher `--seed`, `--holdout-decks`, `--val-frac`): angepasst wird an den Validierungsspielen
bekannter Decks; die ungesehenen Decks sind der ehrliche Test. Schreibt `calib: {a, b}` in `net.json` (nur mit `--write`).
`cards/effects/_value-net.js` liest es und liefert `logitCal` zusätzlich zum Roh-Logit.
"""
import argparse
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import train as T  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--net', required=True)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--holdout-decks', type=int, default=4)
    ap.add_argument('--val-frac', type=float, default=0.1)
    ap.add_argument('--write', action='store_true', help='Ergebnis in net.json eintragen')
    args = ap.parse_args()

    data = T.Data(args.data)
    p, head = T.load_net(args.net)
    dim, nh = head['dim'], len(head['hidden'])
    rng = np.random.default_rng(args.seed)
    _, val_idx, test_idx, held = T.make_split(data, rng, args.holdout_decks, args.val_frac)
    print(f'Holdout-Decks: {[data.m["decks"][i] for i in held]} · Validierung {len(val_idx)} · ungesehene Decks {len(test_idx)}')

    z = {}
    for name, idx in (('Validierung (bekannte Decks)', val_idx), ('Ungesehene Decks', test_idx)):
        z[name] = (idx, T.evaluate(p, data, idx, dim, nh)[:, 0].astype(np.float64))
    idx, zv = z['Validierung (bekannte Decks)']
    a, b = T.fit_platt(zv, data.y[idx])
    print(f"Platt: z' = {a:.3f}·z {b:+.3f}")
    for name, (idx, zz) in z.items():
        y = data.y[idx]
        p0, p1 = T.sigmoid(zz), T.sigmoid(a * zz + b)
        e0, w0 = T.calibration(p0, y)
        e1, w1 = T.calibration(p1, y)
        print(f'  {name}: mittlere Abweichung {e0:.1f} → {e1:.1f} Pp, größte Klasse {w0:.1f} → {w1:.1f} Pp, '
              f'Log-Loss {T.logloss(p0, y):.4f} → {T.logloss(p1, y):.4f}, AUC {T.auc(zz, y):.4f} (unverändert, monoton)')

    if args.write:
        head['calib'] = {'a': a, 'b': b}
        with open(os.path.join(args.net, 'net.json'), 'w', encoding='utf-8') as f:
            json.dump(head, f, ensure_ascii=False)
        print(f'→ {args.net}/net.json')


if __name__ == '__main__':
    main()
