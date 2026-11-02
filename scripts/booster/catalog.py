# -*- coding: utf-8 -*-
"""Katalog für die Booster-Entwürfe: Karten, Set-Zuordnung zu den Packs, Kartenmotive, Helden-Sprites."""
import json, os, re
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SPRITES = os.environ.get('PP_SPRITES') or '/home/user/pixelpartiessprites'


def _rd(p):
    return json.load(open(os.path.join(ROOT, p), encoding='utf-8'))


CARDS = _rd('data/cards.json')
ART_INDEX = _rd('data/card-art/index.json')
BY_NAME = {c['name']: c for c in CARDS}


def norm_set(s):
    """'PP MS1' -> 'MS1', 'PP SET01' -> 'SET01' ..."""
    s = (s or '').upper().replace('PP ', '').strip()
    return s.replace(' ', '')


# Set-Kennungen je Pack. Gleichwertige Schreibweisen (SET1/SET01, MS1/MS01 …) stehen mit drin.
# Kennungen, die im aktuellen cards.json (noch) nicht vorkommen, schaden nicht — sie decken künftige Karten ab.
PACK_SETS = {
    'clash':     ['COH', 'SET1', 'SET01'],
    'monia':     ['ROM', 'SET2', 'SET02', 'MOE', 'SOD'],          # MOE = „Rise of Monia“ (Cool Rescuer Monia steht in PP MOE)
    'future':    ['DRF', 'SET3', 'SET03', 'GBT', 'DD'],      # „Dreadful Future“: DRF ist nur teilweise eingetragen; GBT, DD und die Archetypen darunter gehören dazu
    'world1':    ['MS1', 'MS01', 'MSAZ', 'MSEG', 'MSGB'],
    'world2':    ['MS2', 'MS02', 'MS3', 'MS03', 'MSIN', 'MSHW', 'MSRU', 'MSJP', 'MSCH'],
    'community': ['MBS', 'MBS1'],
}
# „Trials and Tribulations“ = alles, was in keinem anderen Set-Pack landet (ART, THW, WAW, SOB, CROSS, DIB, ASQ, CRESTMAS, ...)


# Karten, die trotz anderer Set-ID zu „Dreadful Future“ gehören: Archetypen Lunatic und Guardian Beasts sowie das Kartenset um Damus, Ifrit und Armageddon
FUTURE_ARCHETYPES = {'Lunatic', 'Guardian Beasts'}
FUTURE_NAMES = {'Damus, the Prophet of Apocalypse', 'Ifrit', 'Armageddon'}


def pack_of_card(c):
    if c.get('archetype') in FUTURE_ARCHETYPES or c['name'] in FUTURE_NAMES:
        return 'future'
    return pack_of_set(norm_set(c['setID']))


def pack_of_set(norm):
    for k, v in PACK_SETS.items():
        if norm in v:
            return k
    return 'trials'


def slug(name):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', name.lower())).strip('-')


def cards_of(pack):
    out = []
    for c in CARDS:
        t = c['cardType']
        if c.get('setID') == 'PP TOKEN' or 'Token' in t:
            continue
        if pack == 'ability':
            ok = t == 'Ability'
        elif pack == 'hero':
            ok = t in ('Hero', 'Ascended Hero')
        else:
            ok = pack_of_card(c) == pack
        if ok:
            out.append(c)
    return out


def _fix_corners(im):
    """Manche Kartenbilder tragen in den Ecken ein 3x3-Dreieck in Fremdfarbe (Rahmenzuschnitt). Es wird mit dem Bildinhalt daneben überdeckt."""
    a = im.load()
    w, h = im.size
    wedge = [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (0, 2)]
    for sx, sy in ((0, 0), (1, 0), (0, 1), (1, 1)):
        def pt(dx, dy):
            x = dx if not sx else w - 1 - dx
            y = dy if not sy else h - 1 - dy
            return x, y
        cols = [a[pt(dx, dy)][:3] for dx, dy in wedge]
        mean = [sum(c[i] for c in cols) / len(cols) for i in range(3)]
        flat = all(sum(abs(c[i] - mean[i]) for i in range(3)) < 45 for c in cols)
        refs = [a[pt(dx + 3, dy + 3)][:3] for dx, dy in wedge]
        ref = [sum(c[i] for c in refs) / len(refs) for i in range(3)]
        if flat and sum(abs(mean[i] - ref[i]) for i in range(3)) > 70:
            for dx, dy in wedge:
                a[pt(dx, dy)] = a[pt(dx + 3, dy + 3)]
    return im


def art(name):
    v = ART_INDEX.get(name)
    if not v:
        return None
    p = os.path.join(ROOT, 'data', 'card-art', 'native', v['id'] + '.png')
    return _fix_corners(Image.open(p).convert('RGBA')) if os.path.exists(p) else None


_HERO_SHEETS = {}
for _f in os.listdir(os.path.join(ROOT, 'data', 'hero-animations')):
    if _f.endswith('.json'):
        try:
            _j = json.load(open(os.path.join(ROOT, 'data', 'hero-animations', _f), encoding='utf-8'))
            _HERO_SHEETS[_j.get('hero')] = _j
            if _j.get('skinOf'):
                _HERO_SHEETS.setdefault(_j['skinOf'], _j)
        except Exception:
            pass


def hero_sprite(name, frame=0):
    """Einzelbild (RGBA) der Idle-Animation eines Helden oder None."""
    j = _HERO_SHEETS.get(name)
    if not j:
        return None
    sh = Image.open(os.path.join(ROOT, 'data', 'hero-animations', j['sheet'])).convert('RGBA')
    fw, fh = j['frameWidth'], j['frameHeight']
    f = frame % j['frames']
    return sh.crop((f * fw, 0, f * fw + fw, fh))


def set_of(name):
    c = BY_NAME.get(name)
    return norm_set(c['setID']) if c else ''
