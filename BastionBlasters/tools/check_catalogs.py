"""Prüft die Design-Dokumente: Tabellenspalten, IDs, Querverweise, Abschnittsverweise, Statistik.
Aufruf: python3 tools/check_catalogs.py"""
import re, sys, collections, io
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = [ROOT/'GDD.md', ROOT/'GDD-Praesentation-Technik.md', ROOT/'katalog/01-gebaeude.md',
         ROOT/'katalog/02-einheiten.md', ROOT/'katalog/03-kerne-und-weltlaunen.md']
if (ROOT/'README.md').exists():
    FILES.append(ROOT/'README.md')

problems = []
texts = {f: f.read_text(encoding='utf-8') for f in FILES}

# 1) table column consistency
def split_row(line):
    s = line.strip()
    if s.startswith('|'): s = s[1:]
    if s.endswith('|'): s = s[:-1]
    cells, cur, i = [], '', 0
    while i < len(s):
        if s[i] == '\\' and i + 1 < len(s) and s[i+1] == '|':
            cur += '|'; i += 2; continue
        if s[i] == '|':
            cells.append(cur); cur = ''
        else:
            cur += s[i]
        i += 1
    cells.append(cur)
    return [c.strip() for c in cells]

rows_by_file = {}
for f, t in texts.items():
    lines = t.splitlines()
    in_code = False
    i = 0
    tables = []
    while i < len(lines):
        ln = lines[i]
        if ln.strip().startswith('```'):
            in_code = not in_code
            i += 1; continue
        if not in_code and ln.strip().startswith('|') and i + 1 < len(lines) and re.match(r'^\s*\|[\s:\-|]+\|\s*$', lines[i+1]):
            hdr = split_row(ln)
            j = i + 2
            rows = []
            while j < len(lines) and lines[j].strip().startswith('|'):
                rows.append((j + 1, split_row(lines[j])))
                j += 1
            for (no, r) in rows:
                if len(r) != len(hdr):
                    problems.append(f'{f.name}:{no}: {len(r)} Zellen statt {len(hdr)}')
            tables.append((hdr, rows))
            i = j
            continue
        i += 1
    rows_by_file[f] = tables

# 2) IDs
ID_RE = re.compile(r'^(B[STHWFPUAC]|U[ASVZ]|KE|WL|CK)-\d{2}$')
defined = collections.OrderedDict()
for f in (ROOT/'katalog/01-gebaeude.md', ROOT/'katalog/02-einheiten.md', ROOT/'katalog/03-kerne-und-weltlaunen.md'):
    for hdr, rows in rows_by_file[f]:
        for no, r in rows:
            first = r[0]
            if ID_RE.match(first):
                if first in defined and first.startswith('KE'):
                    continue
                if first in defined:
                    problems.append(f'Doppelte ID {first} ({f.name}:{no})')
                defined[first] = (f.name, no, r, hdr)

cnt = collections.Counter(k[:2] for k in defined)
print('IDs je Präfix:', dict(cnt))

# 3) referenced IDs exist
REF_RE = re.compile(r'\b((?:B[STHWFPUAC]|U[ASVZ]|KE|WL|CK)-\d{2})\b')
for f, t in texts.items():
    for no, ln in enumerate(t.splitlines(), 1):
        for m in REF_RE.finditer(ln):
            if m.group(1) not in defined:
                problems.append(f'Unbekannte ID {m.group(1)} in {f.name}:{no}')

# 4) section refs
heads = {}
for f in (ROOT/'GDD.md', ROOT/'GDD-Praesentation-Technik.md'):
    nums = set()
    for ln in texts[f].splitlines():
        m = re.match(r'^(#{2,3})\s+(\d+(?:\.\d+)?)\.?\s', ln)
        if m: nums.add(m.group(2))
    heads[f.name] = nums
allnums = set().union(*heads.values())
for f, t in texts.items():
    for no, ln in enumerate(t.splitlines(), 1):
        for m in re.finditer(r'§\s?(\d+(?:\.\d+)?)', ln):
            if m.group(1) not in allnums:
                problems.append(f'Unbekannter Abschnitt §{m.group(1)} in {f.name}:{no}')

# 4b) englische Namen: vorhanden und eindeutig
names_en = collections.Counter()
for k, (fn, no, r, hdr) in defined.items():
    if 'Name (EN)' in hdr:
        en = re.sub(r'\*', '', r[hdr.index('Name (EN)')]).strip()
        if not en:
            problems.append(f'Leerer englischer Name: {k}')
        names_en[en] += 1
for en, n in names_en.items():
    if n > 1:
        problems.append(f'Englischer Name doppelt: {en}')
print('Englische Namen:', sum(names_en.values()))

# 5) statistics
b = [(k, v) for k, v in defined.items() if k.startswith('B')]
u = [(k, v) for k, v in defined.items() if k.startswith('U')]

def tier_of(cell):
    m = re.search(r'\b(IV|III|II|I)\b', cell)
    return m.group(1) if m else '?'

# buildings: column 3 is "T" (index 3)
tier_b = collections.Counter()
for k, (fn, no, r, hdr) in b:
    tier_b[tier_of(r[hdr.index('T')])] += 1
print('Gebäude gesamt', len(b), 'Tiers', dict(tier_b))
cats_b = collections.Counter(k[:2] for k, _ in b)
print('Gebäude je Kategorie', dict(cats_b))

lines_u = collections.Counter(); tier_u = collections.Counter(); cat_u = collections.Counter()
for k, (fn, no, r, hdr) in u:
    li = r[hdr.index('Linie · T')]
    line, _, tier = li.partition('·')
    lines_u[line.strip()] += 1
    tier_u[tier.strip()] += 1
    cat_u[k[:2]] += 1
print('Einheiten gesamt', len(u), 'je Kategorie', dict(cat_u))
print('Einheiten je Tier', dict(tier_u))
print('Einheiten je Linie', dict(lines_u))

# 6) lines in GDD table vs. BF buildings
gdd_lines = set()
for hdr, rows in rows_by_file[ROOT/'GDD.md']:
    if hdr and hdr[0] == 'Linie':
        for no, r in rows:
            gdd_lines.add(re.sub(r'\*', '', r[0]).strip())
bf_lines = set()
for k, (fn, no, r, hdr) in b:
    if k.startswith('BF'):
        bf_lines.add(re.sub(r'\*', '', r[hdr.index('Schaltet frei')]).strip())
print('GDD-Linien', sorted(gdd_lines))
print('BF-Linien ', sorted(bf_lines))
unit_lines = set(lines_u)
if not unit_lines <= gdd_lines:
    problems.append(f'Unbekannte Linien bei Einheiten: {unit_lines - gdd_lines}')
if gdd_lines - {'Basis'} != bf_lines:
    problems.append(f'Linien GDD vs BF unterschiedlich: {gdd_lines - {"Basis"} ^ bf_lines}')

# 7) stray placeholders / escapes
for f, t in texts.items():
    for tok in ('\\u00', '\\U000', '&auml;', '&ouml;', '&uuml;', 'TODO', 'XXX'):
        if tok in t:
            problems.append(f'Verdächtiges Token {tok!r} in {f.name}')

print()
if problems:
    print('PROBLEME:')
    for p in problems: print(' -', p)
    sys.exit(1)
print('OK: keine Probleme gefunden')
