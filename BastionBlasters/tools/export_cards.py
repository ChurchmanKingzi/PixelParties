"""Exportiert die Kataloge (Markdown-Tabellen) nach daten/cards.json.

Die Markdown-Kataloge bleiben die Quelle der Wahrheit; dieses Skript erzeugt daraus die
maschinenlesbare Datei für Spiel, Bot-Sim und Kartenrenderer.   Aufruf:  python3 tools/export_cards.py
"""
from __future__ import annotations

import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ROMAN = {'I': 1, 'II': 2, 'III': 3, 'IV': 4}
CATS = {'BS': 'Strukturen', 'BT': 'Türme', 'BH': 'Heilung', 'BW': 'Werkstätten', 'BF': 'Freischalt-Räume',
        'BP': 'Plattformen', 'BU': 'Utility', 'BA': 'Abwehr', 'BC': 'Chaos'}
UNIT_KIND = {'UA': 'artillerie', 'US': 'sturm', 'UV': 'verteidiger', 'UZ': 'zivilist'}


KEYWORDS = json.load(open(os.path.join(ROOT, 'daten', 'keywords.json'), encoding='utf-8'))


def term(kind: str, de: str) -> str:
    """Deutscher Designbegriff -> englischer Spielbegriff (Quelle: daten/keywords.json)"""
    de = re.sub(r'\s*\(.*\)\s*$', '', de).strip()      # Zusätze wie "(Leine ×1,5)" gehören nicht zum Begriff
    for k in KEYWORDS:
        if k['kind'] == kind and k['de'].lower() == de.lower():
            return k['en']
    raise KeyError(f'{kind}: {de!r} fehlt in keywords.json')


ARMOR_DE = {'F': 'Fleisch', 'P': 'Panzer', 'G': 'Geist', 'K': 'Knochen', 'Pu': 'Pudding'}


def clean(s: str) -> str:
    return re.sub(r'\*\*', '', s).strip()


def read_tables(path):
    rows, header = [], None
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.startswith('|'):
            header = None
            continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if cells[0] == 'ID':
            header = cells
            continue
        if set(''.join(cells)) <= set('-: '):
            continue
        if header and re.match(r'^[A-Z]{2}-\d\d$', cells[0]) and len(cells) == len(header):
            rows.append(dict(zip(header, cells)))
    return rows


def num(s, default=None):
    m = re.search(r'\d+', s or '')
    return int(m.group()) if m else default


def building(r):
    cid = r['ID']
    size = r['Größe']
    bauart, _, masse = size.partition(' ')
    bauart = {'Raum': 'raum', 'Hof': 'hof', 'Turm': 'turm', 'Wand': 'wand', 'Tor': 'tor'}[bauart]
    mat, _, hp = r['Material · HP'].partition('·')
    third = r.get('Effekt') or r.get('Schaltet frei') or r.get('Geschützplätze') or ''
    fourth = r.get('Regeln / Tags') or r.get('Zusatzeffekt') or r.get('Besonderheit') or ''
    d = {
        'id': cid, 'name': clean(r['Name']), 'name_en': clean(r['Name (EN)']), 'kategorie': 'bau', 'gruppe': CATS[cid[:2]],
        'category_en': 'Building', 'group_en': term('group', CATS[cid[:2]]),
        'build_type_en': term('build_type', {'raum': 'Raum', 'hof': 'Hof', 'turm': 'Turm', 'wand': 'Wand', 'tor': 'Tor'}[bauart]),
        'material_en': term('material', mat.strip()),
        'bauart': bauart, 'masse': masse or None, 'tier': ROMAN[r['T']],
        'material': mat.strip(), 'hp': num(hp), 'hp_text': hp.strip(),
        'posten': num(r['⚙']) if r['⚙'] not in ('–', '-') else 0,
        'effekt': clean(third), 'regeln': clean(fourth), 'look': clean(r['Look']),
    }
    if cid[:2] == 'BP':
        d['geschuetzplaetze'] = num(third)
    return d


def unit(r):
    cid = r['ID']
    kind = UNIT_KIND[cid[:2]]
    linie, _, t = r['Linie · T'].partition('·')
    soll, _, nach = r['S/N'].partition('/')
    d = {'id': cid, 'name': clean(r['Name']), 'name_en': clean(r['Name (EN)']), 'kategorie': kind,
         'category_en': term('card_type', {'artillerie': 'Artillerie', 'sturm': 'Sturm', 'verteidiger': 'Verteidiger', 'zivilist': 'Zivilist'}[kind]),
         'line_en': term('line', linie), 'linie': linie.strip(), 'tier': ROMAN[t.strip()],
         'soll': int(soll), 'nachschub': int(nach), 'talent_r3': clean(r['Talent R3']), 'look': clean(r['Look'])}
    hp_rk = r['HP · RK'] if 'HP · RK' in r else r['HP']
    d['hp'] = num(hp_rk)
    if '·' in hp_rk:
        d['ruestung'] = hp_rk.split('·', 1)[1].strip().split(' ')[0]
        d['armor_en'] = term('armor', ARMOR_DE[d['ruestung']])
    if kind == 'artillerie':
        bahn, _, rw = r['Flugbahn · Reichw.'].partition('·')
        d.update({'gp': r['GP'] if r['GP'] == 'Luft' else num(r['GP']), 'flugbahn': bahn.strip(), 'trajectory_en': term('trajectory', bahn),
                  'reichweite': num(rw),
                  'schaden_takt': r['Schaden (Struktur / Person) · Takt'], 'besonderheit': clean(r['Besonderheit'])})
    elif kind == 'sturm':
        d.update({'angriff': r['Angriff · Reichweite'], 'tempo': r['Tempo'], 'doktrin': r['Doktrin'], 'doctrine_en': term('doctrine', r['Doktrin']),
                  'besonderheit': clean(r['Besonderheit'])})
    elif kind == 'verteidiger':
        d.update({'angriff': r['Angriff · Reichweite'], 'zone': r['Standardzone'], 'zone_en': term('zone', r['Standardzone']),
                  'besonderheit': clean(r['Besonderheit'])})
    else:
        d.update({'funktion': clean(r['Funktion'])})
    return d


def main():
    cards = []
    for r in read_tables(os.path.join(ROOT, 'katalog', '01-gebaeude.md')):
        cards.append(building(r))
    for r in read_tables(os.path.join(ROOT, 'katalog', '02-einheiten.md')):
        cards.append(unit(r))
    nb = sum(c['kategorie'] == 'bau' for c in cards)
    nu = len(cards) - nb
    ids = [c['id'] for c in cards]
    if nb != 77 or nu != 77 or len(set(ids)) != len(ids):
        print(f'FEHLER: {nb} Bauteile, {nu} Einheiten, {len(set(ids))} eindeutige IDs', file=sys.stderr)
        return 1
    out = os.path.join(ROOT, 'daten', 'cards.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(cards, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(cards)} Karten exportiert -> daten/cards.json ({nb} Bauteile, {nu} Einheiten)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
