#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Schreibt alle Unicode-Emojis (Folgen eingeschlossen) nach alle-emoji.json — Eingabe fuer extract.js (PE_ALLE=1).

    pip install emoji && python3 scripts/pixel-emoji/emoji-liste.py

Je Eintrag: `k` kanonischer Schluessel (Codepunkte der VOLL qualifizierten Folge, hex, mit '-'), `s` die Folge,
`a` Aliase (weniger qualifizierte Schreibweisen derselben Folge, ohne FE0F: so tippen Leute sie oft). Reihenfolge = Unicode-Reihenfolge der Bibliothek.
"""
import io, json, os
import emoji
D = emoji.EMOJI_DATA
def schluessel(s): return '-'.join('%X' % ord(c) for c in s)
def ohne_vs(s): return s.replace('️', '')
gruppen = {}
for s, v in D.items():
    gruppen.setdefault(ohne_vs(s), []).append((v['status'], s))
STATUS_VOLL = 2   # emoji-Bibliothek: 1 component, 2 fully_qualified, 3 minimally_qualified, 4 unqualified
out = []
for key, mitglieder in gruppen.items():
    voll = [s for st, s in mitglieder if st in (1, 2)]
    kanon = voll[0] if voll else sorted(mitglieder, key=lambda m: -len(m[1]))[0][1]
    alias = sorted({s for st, s in mitglieder if s != kanon})
    out.append({'k': schluessel(kanon), 's': kanon, 'a': alias})
io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'alle-emoji.json'), 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
print(len(out), 'Emojis (kanonisch),', sum(len(e['a']) for e in out), 'Aliase, emoji-Bibliothek', emoji.__version__)
