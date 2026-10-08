"""Erzeugt game/src/data/cards.gen.json: strukturierte Kartenwerte für den Prototyp.

Quelle: daten/cards.json (aus den Katalogen exportiert), daten/card_text.json (englische Kartentexte).
Die deutschen Textfelder (Angriff, Schaden/Takt, Tempo ...) werden hier einmal in Zahlen übersetzt; was sich nicht
parsen lässt, steht in OVERRIDES. Aufruf:  python3 tools/build_game_data.py   (aus dem Ordner BastionBlasters/)
"""
from __future__ import annotations

import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'game', 'src', 'data', 'cards.gen.json')

TEMPO = {'kriechend': 0.8, 'langsam': 1.0, 'normal': 1.5, 'flink': 2.2, 'rasend': 3.0}
RANGE = {'Nah': 1.1, 'Kurz': 3.0, 'Mittel': 5.0, 'Weit': 8.0}
DOCTRINE = {'Jäger': 'hunter', 'Brecher': 'breaker', 'Eroberer': 'conqueror', 'Plünderer': 'looter', 'Sprenger': 'sprenger'}
ZONE = {'Tor': 'gate', 'Mitte': 'middle', 'Kernkammer': 'core'}
TRAJ = {'Flach': 'flat', 'Bogen': 'arc', 'Senkrecht': 'vertical', 'Durchschlag': 'pierce', 'Untergrund': 'under', 'Streu': 'scatter', 'Luft': 'air'}
ARMOR = {'F': 'flesh', 'P': 'plate', 'G': 'spirit', 'K': 'bone', 'Pu': 'pudding'}
MATERIAL = {'Holz': 'wood', 'Stein': 'stone', 'Metall': 'metal', 'Kristall': 'crystal', 'Organisch': 'organic', 'Pudding': 'pudding', 'Eis': 'ice'}
BAUART = {'raum': 'room', 'hof': 'yard', 'turm': 'tower', 'wand': 'wall', 'tor': 'gate'}
CAT = {'artillerie': 'artillery', 'sturm': 'assault', 'verteidiger': 'defender', 'zivilist': 'civilian', 'bau': 'building'}


def num(s: str) -> float:
    return float(s.replace(',', '.'))


def parse_attack(c):
    """'12 E / 1,1 s · Nah' u. ä. -> dict(dmg, dtype, interval, range, hits, ...)"""
    s = c.get('angriff', '')
    out = {'dmg': 0.0, 'dtype': 'W', 'interval': 1.0, 'range': 1.1, 'hits': 1}
    if not s:
        return out
    m = re.match(r'^(?:(\d+) × )?(\d+(?:,\d+)?)(?: \(zufällige Art\))?(?: ([WFEBGA]))? / (\d+(?:,\d+)?) s', s)
    if m:
        if m.group(1):
            out['hits'] = int(m.group(1))
        out['dmg'] = num(m.group(2))
        out['dtype'] = m.group(3) or ('R' if 'zufällige Art' in s else 'W')
        out['interval'] = num(m.group(4))
    else:
        m2 = re.match(r'^(?:Feueratem|Gatling) (\d+(?:,\d+)?) ([WFEBGA]) / (\d+(?:,\d+)?) s', s)
        if m2:
            out['dmg'], out['dtype'], out['interval'] = num(m2.group(1)), m2.group(2), num(m2.group(3))
        else:
            m3 = re.match(r'^Explosion: (\d+) ([WFEBGA])', s)
            if m3:
                out['dmg'], out['dtype'] = num(m3.group(1)), m3.group(2)
            else:
                m4 = re.match(r'^Schlucken: (\d+) ([WFEBGA])', s)
                if m4:
                    out['dmg'], out['dtype'] = num(m4.group(1)), m4.group(2)
                else:
                    print('  ? Angriff nicht lesbar:', c['id'], s, file=sys.stderr)
    rm = re.search(r'· (Nah|Kurz|Mittel|Weit)', s)
    if rm:
        out['range'] = RANGE[rm.group(1)]
    cone = re.search(r'Kegel (\d)', s)
    if cone:
        out['cone'] = int(cone.group(1))
        out['range'] = float(cone.group(1))
    area = re.search(r'Fläche (\d)', s)
    if area:
        out['area'] = int(area.group(1))
    return out


def parse_artillery(c):
    s = c['schaden_takt']
    out = {'count': 1, 'structDmg': 0.0, 'personDmg': 0.0, 'dtype': 'W', 'splash': 0, 'interval': 6.0}
    m = re.match(r'^(\d+) × \((\d+) ([WFEBGA]) / (\d+) ([WFEBGA])\) · (\d+(?:,\d+)?) s', s)
    if m:
        out.update(count=int(m.group(1)), structDmg=num(m.group(2)), dtype=m.group(3), personDmg=num(m.group(4)), interval=num(m.group(6)))
        return out
    m = re.match(r'^(\d+) ([WFEBGA]) / (\d+) ?([WFEBGA])?(?: \((?:Splash|Radius) (\d)\))? · (\d+(?:,\d+)?) s', s)
    if not m:
        print('  ? Artillerie nicht lesbar:', c['id'], s, file=sys.stderr)
        return out
    out.update(structDmg=num(m.group(1)), dtype=m.group(2), personDmg=num(m.group(3)), interval=num(m.group(6)))
    if m.group(5):
        out['splash'] = int(m.group(5))
    return out


def unit_entry(c, text):
    cat = CAT[c['kategorie']]
    e = {
        'id': c['id'], 'name': c['name_en'], 'nameDe': c['name'], 'cat': cat, 'line': c['line_en'], 'tier': c['tier'],
        'soll': c['soll'], 'nachschub': c['nachschub'], 'hp': c['hp'], 'armor': ARMOR[c['ruestung']] if c.get('ruestung') else 'flesh',
        'rules': text.get('rules', ''), 'talent': text.get('talent', ''), 'flavor': text.get('flavor', ''),
        'effectText': c.get('besonderheit') or c.get('funktion') or '',
        'talentText': c.get('talent_r3', ''),
    }
    if cat == 'artillery':
        e['gp'] = c['gp'] if isinstance(c['gp'], int) else 'air'
        e['traj'] = TRAJ[c['flugbahn']]
        e['reach'] = c['reichweite']
        e.update(parse_artillery(c))
        e['speed'] = 0.0
    else:
        e['speed'] = 1.5
        if c.get('tempo'):
            t = c['tempo']
            m = re.search(r'\((\d(?:,\d)?)\)', t)
            if m and 'langsam' in t:
                e['speed'] = num(m.group(1))
            else:
                for k, v in TEMPO.items():
                    if t.startswith(k):
                        e['speed'] = v
                        break
        if cat != 'civilian':
            e.update(parse_attack(c))
        if cat == 'assault':
            e['doctrine'] = DOCTRINE[c['doktrin']]
            e['structFactor'] = 1.0 if e['doctrine'] == 'breaker' else 0.4
        if cat == 'defender':
            z = c['zone']
            e['zone'] = ZONE[z.split(' ')[0]]
            e['structFactor'] = 0.0
        if cat == 'civilian':
            e['structFactor'] = 0.0
    return e


def building_entry(c, text):
    size = c.get('masse') or '1×1'
    m = re.match(r'^(\d)×(\d)$', size)
    cols, rows = (int(m.group(1)), int(m.group(2))) if m else (1, 1)
    e = {
        'id': c['id'], 'name': c['name_en'], 'nameDe': c['name'], 'cat': 'building', 'group': c['group_en'], 'tier': c['tier'],
        'kind': BAUART[c['bauart'].split(' ')[0]], 'cols': cols, 'rows': rows, 'material': MATERIAL[c['material']],
        'hp': c['hp'], 'posts': c.get('posten') or 0, 'gunSlots': c.get('geschuetzplaetze') or 0,
        'rules': text.get('rules', ''), 'flavor': text.get('flavor', ''), 'effectText': c.get('effekt', ''),
        'tags': c.get('regeln', ''),
    }
    if c['id'].startswith('BF-'):
        e['lineUnlock'] = c['effekt']
    return e


# Werte, die sich nicht aus den Textfeldern lesen lassen
OVERRIDES = {
    'UV-12': {'dmg': 5, 'interval': 0.2, 'range': 5.0},
    'UV-15': {'dmg': 60, 'interval': 8.0, 'range': 1.1},
    'US-03': {'interval': 1.0},
    'UV-11': {'dmg': 20, 'interval': 1.0, 'range': 3.0},
    'US-16': {'dtype': 'R'},
    'US-06': {'speed': 1.5},
    'US-05': {'structFactor': 2.5},
    'US-21': {'structFactor': 1.2},
    'US-22': {'structFactor': 1.3},
}


def main():
    cards = json.load(open(os.path.join(ROOT, 'daten', 'cards.json'), encoding='utf-8'))
    texts = json.load(open(os.path.join(ROOT, 'daten', 'card_text.json'), encoding='utf-8'))
    out = {'units': {}, 'buildings': {}}
    for c in cards:
        t = texts.get(c['id'], {})
        if c['kategorie'] == 'bau':
            out['buildings'][c['id']] = building_entry(c, t)
        else:
            e = unit_entry(c, t)
            e.update(OVERRIDES.get(c['id'], {}))
            out['units'][c['id']] = e
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f"{len(out['units'])} Einheiten, {len(out['buildings'])} Bauteile -> {os.path.relpath(OUT, ROOT)}")
    write_glossary()


def write_glossary():
    """Glossar (nur die Felder, die das Spiel zeigt) und Begriffsfelder der Kartenbilder (art/out/cards_hotspots.json)"""
    kws = json.load(open(os.path.join(ROOT, 'daten', 'keywords.json'), encoding='utf-8'))
    keep = ('en', 'kind', 'def', 'forms', 'duration', 'abbr')
    slim = [{k: v for k, v in x.items() if k in keep} for x in kws]
    d = os.path.join(ROOT, 'game', 'src', 'data')
    with open(os.path.join(d, 'keywords.gen.json'), 'w', encoding='utf-8') as f:
        json.dump(slim, f, ensure_ascii=False, separators=(',', ':'))
    hp = os.path.join(ROOT, 'art', 'out', 'cards_hotspots.json')
    if os.path.exists(hp):
        with open(hp, encoding='utf-8') as f:
            hot = json.load(f)
        with open(os.path.join(d, 'hotspots.gen.json'), 'w', encoding='utf-8') as f:
            json.dump(hot, f, ensure_ascii=False, separators=(',', ':'))
        print(f'{len(slim)} Glossarbegriffe, {sum(len(v) for v in hot.values())} Begriffsfelder -> game/src/data/')
    else:
        print('WARNUNG: art/out/cards_hotspots.json fehlt (erst art/cards.py ausführen)', file=sys.stderr)


if __name__ == '__main__':
    main()
