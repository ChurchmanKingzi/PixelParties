#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Schreibt test/fixtures/value-net-parity.json: ein winziges Zufallsnetz, einige echte Beispiele aus dem Datensatz und das Ergebnis der
Python-Rechnung (train.py). `test/value-net.test.js` prüft, dass `cards/effects/_value-net.js` dieselben Zahlen liefert.

Nur nötig, wenn sich Aufbau oder Rechenweise des Netzes ändern (Merkmale, Gruppen, Schichten):
    python3 scripts/value/make-parity-fixture.py
"""
import json
import os
import sys
import tempfile
import types

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import train as T  # noqa: E402

DATA = os.path.join(ROOT, 'data', 'training', 'value', 'dataset')
OUT = os.path.join(ROOT, 'test', 'fixtures', 'value-net-parity.json')
DIM, HIDDEN = 6, [8, 4]

data = T.Data(DATA)
idx = np.array([5, 4001, 90001, 150003, 200007, 301235, 379001], dtype=np.int64)
bt = data.batch(idx, np.float64)

# Kartennummern auf 0..K-1 verdichten (die Rechnung hängt nur an den Zeilen der Einbettung, nicht an den Nummern)
used = {0}
for gb in bt['groups']:
    if gb is not None:
        used |= set(gb['ids'].tolist()) | set(gb['own'].tolist())
remap = {old: new for new, old in enumerate(sorted(used))}
for gb in bt['groups']:
    if gb is not None:
        gb['ids'] = np.array([remap[v] for v in gb['ids']])
        gb['own'] = np.array([remap[v] for v in gb['own']])

shim = types.SimpleNamespace(vocab=len(used), groups=data.groups, ng=data.ng, nglob=data.nglob, m=data.m)
p = T.init_params(shim, DIM, HIDDEN, 11)
rng = np.random.default_rng(5)
for k in p:
    if k.startswith('b'):
        p[k] = (rng.standard_normal(p[k].shape) * 0.2).astype(np.float32)
    if k.startswith('W') and k[1:].isdigit():
        p[k] = (p[k] * 4).astype(np.float32)          # größere Ausschläge, damit kein Ausgang bei 0 hängt
p64 = {k: v.astype(np.float64) for k, v in p.items()}
out, _ = T.forward(p64, shim, bt, DIM, len(HIDDEN))

with tempfile.TemporaryDirectory() as tmp:
    T.export(p, shim, DIM, HIDDEN, tmp)
    with open(os.path.join(tmp, 'net.json'), encoding='utf-8') as f:
        head = json.load(f)
    floats = np.fromfile(os.path.join(tmp, 'net.f32'), dtype='<f4').astype(np.float64)

examples = []
for b in range(bt['B']):
    sides = []
    for side in (0, 1):
        per_group = []
        for g in range(data.ng):
            gb = bt['groups'][g]
            if gb is None:
                per_group.append({'ids': [], 'own': [], 'x': []})
                continue
            m = gb['seg'] == 2 * b + side
            per_group.append({'ids': gb['ids'][m].tolist(), 'own': gb['own'][m].tolist(), 'x': gb['x'][m].reshape(-1).tolist()})
        sides.append(per_group)
    examples.append({'sides': sides, 'glob': bt['glob'][b].tolist()})
expected = [[float(o[0]), float(o[1] * T.EV_SCALE), float(o[2] * T.REM_SCALE)] for o in out]

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump({'head': head, 'floats': floats.tolist(), 'examples': examples, 'expected': expected}, f, ensure_ascii=False, separators=(',', ':'))
print(f'{OUT}: {len(examples)} Beispiele, {len(floats)} Gewichte, {os.path.getsize(OUT) / 1024:.0f} KB')
