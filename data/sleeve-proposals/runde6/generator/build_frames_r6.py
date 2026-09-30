# -*- coding: utf-8 -*-
"""Erzeugt frames_r6.json aus den Notizen (notes_*.md: Name + Rahmen) und der Gegnerliste im BRIEF (Deck-ID).
Aufruf: python3 build_frames_r6.py"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(HERE, '..')
decks = {}
for l in open(os.path.join(R, 'BRIEF.md'), encoding='utf-8'):
    m = re.match(r'(\d\d) \| `([^`]+)` \|', l)
    if m:
        decks[m.group(1)] = m.group(2)
rows = {}
for f in sorted(os.listdir(R)):
    if not f.startswith('notes_'):
        continue
    for l in open(os.path.join(R, f), encoding='utf-8'):
        m = re.match(r'\s*(\d\d)\s*\|\s*([^|]+?)\s*\|', l)
        fr = re.search(r'Rahmen:\s*([\w/]+)', l)
        if m and fr and m.group(1) in decks:
            rows[m.group(1)] = (m.group(2), fr.group(1).split('/'))
out = {}
for nn in sorted(decks):
    png = [p for p in os.listdir(R) if p.startswith(nn + '_') and p.endswith('.png')]
    assert len(png) == 1 and nn in rows, (nn, png)
    name, fr = rows[nn]
    out[png[0]] = [name, fr[0], fr[1], fr[2], fr[3] if len(fr) > 3 else None, decks[nn]]
with open(os.path.join(HERE, 'frames_r6.json'), 'w', encoding='utf-8') as fh:
    json.dump(out, fh, ensure_ascii=False, indent=1)
print(len(out), 'Einträge')
