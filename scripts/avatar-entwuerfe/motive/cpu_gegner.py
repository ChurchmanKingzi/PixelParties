# -*- coding: utf-8 -*-
"""Liste der CPU-Gegner (Sample-/Structure-Decks) mit ihrem Portrait-Helden.

Das Spiel zeigt als CPU-Avatar den mittleren Helden (sonst den ersten vorhandenen) – gleiche Regel wie `portraetHeld`
in public/app-board.jsx. Als Skript: Liste auf der Konsole."""
import os, re, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())

def slug(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')

def gegner():
    out = []
    d = os.path.join(ROOT, 'data', 'SampleDecks')
    for f in sorted(os.listdir(d)):
        if not f.endswith('.txt'):
            continue
        lines = open(os.path.join(d, f), encoding='utf-8').read().splitlines()
        if not lines or 'PIXEL PARTIES DECK' not in lines[0]:
            continue
        name, heroes, sec = f[:-4], [], None
        for ln in lines[1:]:
            ln = ln.strip()
            if ln.startswith('Name:'): name = ln[5:].strip()
            elif ln == '== HEROES ==': sec = 'h'
            elif ln.startswith('=='): sec = None
            elif sec == 'h' and ln: heroes.append(None if ln == '(empty)' else ln)
        hero = (heroes[1] if len(heroes) > 1 else None) or next((h for h in heroes if h), None)
        out.append({'deckId': 'sample-' + f[:-4], 'deck': name, 'hero': hero})
    return out

if __name__ == '__main__':
    g = gegner()
    for e in g: print(e['deckId'], '|', e['hero'])
