"""Linter für die strenge Nomenklatur der Kartentexte (siehe NOMENCLATURE.md).

Prüft daten/card_text.json gegen daten/keywords.json und daten/cards.json.
Aufruf: python3 tools/lint_card_text.py      Rückgabe 1 bei Verstößen.
"""
from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glossary

ROOT = glossary.ROOT
TEXTS = json.load(open(os.path.join(ROOT, 'daten', 'card_text.json'), encoding='utf-8'))
CARDS = {c['id']: c for c in json.load(open(os.path.join(ROOT, 'daten', 'cards.json'), encoding='utf-8'))}

ICONS = {'heart', 'sword', 'sword_fire', 'sword_ice', 'sword_lightning', 'sword_poison', 'sword_arcane', 'clock', 'target', 'boot', 'person', 'reinforce', 'room', 'tower', 'yard', 'wall', 'plus', 'cannon'}
FORBIDDEN = {'cheap', 'powerful', 'mighty', 'huge', 'tiny', 'very', 'quickly', 'slowly', 'nice', 'brave', 'fierce', 'mass',
             'strong', 'weak', 'massive', 'incredibly', 'extremely', 'also', 'simply', 'just', 'basically', 'greatly'}
# großgeschriebene Wörter, die auch ohne Glossareintrag erlaubt sind (Einheiten und Kürzel)
EXTRA_CAPS = {'HP', 'XP', 'HP/s', 'XP/s'}
STAT_WORDS = glossary.all_terms()
GENERIC_SUBJECTS = {'Allies', 'Enemies', 'Units', 'Buildings', 'Citizens'}
TRIGGER_WORDS = {'On', 'Every', 'While', 'Once', 'At', 'Each', 'After', 'Entering', 'Aura'}
ABBR = set(glossary.abbreviations())


def strip_bold(t):
    return re.sub(r'\*\*(.+?)\*\*', '', t)


def check_text(cid, field, text, problems):
    where = f'{cid}.{field}'
    if not text:
        return
    # Explizit fett nur als Fähigkeitsname direkt am Satzanfang, gefolgt von ':'
    for m in re.finditer(r'\*\*(.+?)\*\*', text):
        before = text[:m.start()]
        after = text[m.end():]
        if not (before == '' or before.endswith('. ')) or not re.match(r'( \([^)]*\))?:', after):
            problems.append(f'{where}: Fett von Hand nur für Fähigkeitsnamen am Satzanfang ("**Name**:" oder "**Name** (Bedingung):"): {m.group(0)}')
    plain = strip_bold(text)
    if not text.rstrip().endswith('.') and not text.rstrip().endswith('”'):
        problems.append(f'{where}: Text endet nicht mit einem Punkt')
    low = plain.lower()
    for w in re.findall(r"[a-z']+", low):
        if w in FORBIDDEN:
            problems.append(f'{where}: Ausschmückendes Wort "{w}" (nur mechanische Aussagen)')
    if re.search(r'\d s\b', plain):
        problems.append(f'{where}: Einheit "s" ohne Leerzeichen schreiben (4s)')
    if re.search(r'\d %', plain):
        problems.append(f'{where}: Prozent ohne Leerzeichen schreiben (30%)')
    if re.search(r'\d,\d', plain):
        problems.append(f'{where}: Dezimalpunkt statt Komma (1.2)')
    if re.search(r'(?<![\w])-\d', plain):
        problems.append(f'{where}: Minuszeichen "−" (U+2212) statt Bindestrich vor Zahlen')
    if '≈' in plain or '~' in plain:
        problems.append(f'{where}: Keine ungefähren Werte ("≈", "~"), exakte Zahl angeben')
    # "Name: ..." am Satzanfang: Ein Name aus 1-3 großgeschriebenen Wörtern ist ein Fähigkeitsname und muss fett sein.
    # Auslöser ("On kill:"), Glossarbegriffe ("Block:", "Aura (...)") und Zielbeschreibungen ("Allies:") sind ausgenommen.
    for sent in re.split(r'(?<=\.) ', text):
        m = re.match(r'^([A-Z][\w\-]*(?: [A-Z][\w\-]*){0,2})( \([^)]*\))?: ', sent)
        if m and not sent.startswith('**'):
            name = m.group(1)
            first = name.split(' ')[0]
            clause = (first in TRIGGER_WORDS or first in GENERIC_SUBJECTS or name in STAT_WORDS
                      or first in STAT_WORDS or (first.endswith('s') and first[:-1] in STAT_WORDS))
            if not clause:
                problems.append(f'{where}: Fähigkeitsname "{name}" muss fett sein (**{name}**)')
    # Großgeschriebene Wörter außerhalb von Satzanfängen müssen Glossarbegriffe sein
    toks = re.findall(r"[\w/'’×%−+.:()—-]+", plain)
    prev = ''
    for t in toks:
        word = re.sub(r'^[(]+|[).,:;]+$', '', t)
        if word and word[0].isupper() and prev and not prev.endswith(('.', ':')) and prev != '':
            base = word
            ok = (base in STAT_WORDS or base in EXTRA_CAPS or (base.endswith('s') and base[:-1] in STAT_WORDS)
                  or (base.endswith('es') and base[:-2] in STAT_WORDS))
            # Mehrwortbegriffe: Teile erlauben, wenn der Begriff im Text vorkommt
            if not ok:
                for term in STAT_WORDS:
                    parts = term.split(' ')
                    stems = {base, re.sub(r'(es|s)$', '', base)}
                    if ' ' in term and stems & set(parts) and term in plain:
                        ok = True
                        break
            if not ok:
                problems.append(f'{where}: "{word}" ist kein Glossarbegriff (Großschreibung nur für Begriffe aus keywords.json)')
        prev = t
    # Abschnitte fett: alles, was fett wird, muss im Glossar oder ein Fähigkeitsname sein (per Konstruktion erfüllt)


def check_stats(cid, stats, problems):
    for ic, txt in stats:
        if ic not in ICONS:
            problems.append(f'{cid}.stats: unbekanntes Symbol {ic!r}')
        for w in re.findall(r'\b[A-Z]{3}\b', txt):
            if w not in ABBR:
                problems.append(f'{cid}.stats: Kürzel {w} fehlt im Glossar (abbr)')
        if re.search(r'\d,\d', txt):
            problems.append(f'{cid}.stats: Dezimalpunkt statt Komma: {txt}')


def main():
    problems = []
    for cid, t in TEXTS.items():
        if cid not in CARDS:
            problems.append(f'{cid}: nicht in cards.json')
            continue
        check_stats(cid, t.get('stats', []), problems)
        check_text(cid, 'rules', t.get('rules', ''), problems)
        check_text(cid, 'talent', t.get('talent', ''), problems)
        for i, tr in enumerate(t.get('traits', [])):
            check_text(cid, f'traits[{i}]', tr, problems)
        fl = t.get('flavor', '')
        if not fl:
            problems.append(f'{cid}.flavor fehlt')
        if '**' in fl:
            problems.append(f'{cid}.flavor: kein Fettdruck im Flavortext')
        # Flavor gehört nicht in die Effektbox: Regeltext darf keine Erzählsätze enthalten
        if t.get('talent') and not t['talent'].startswith('**'):
            problems.append(f'{cid}.talent muss mit **Fähigkeitsname**: beginnen')
    # Namen müssen ins Namensband passen (Breite im Pixelfont)
    sys.path.insert(0, os.path.join(ROOT, 'art'))
    from pixfont import text_width
    for cid, c in CARDS.items():
        w = text_width(c['name_en'])
        if w > 136:
            problems.append(f"{cid}: Name \"{c['name_en']}\" ist {w} px breit (höchstens 136)")
    # Typzeile muss (notfalls mit engen Trennern) in die Textbreite passen
    import cards as card_renderer
    for cid, c in CARDS.items():
        if card_renderer.type_line_gap(c) is None:
            problems.append(f"{cid}: Typzeile \"{card_renderer.type_line(c)}\" ist zu breit")
    kinds = {k['kind'] for k in glossary.KEYWORDS}
    ens = [(k['kind'], k['en']) for k in glossary.KEYWORDS]
    if len(ens) != len(set(ens)):
        problems.append('keywords.json: doppelter Begriff innerhalb derselben Art')
    print(f'{len(TEXTS)} Kartentexte geprüft, {len(glossary.KEYWORDS)} Glossarbegriffe, {len(kinds)} Arten')
    if problems:
        print('PROBLEME:')
        for p in problems:
            print(' -', p)
        return 1
    print('OK: Nomenklatur eingehalten')
    return 0


if __name__ == '__main__':
    sys.exit(main())
