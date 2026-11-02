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
    'monia':     ['ROM', 'SET2', 'SET02', 'MOE'],          # MOE = „Rise of Monia“ (Cool Rescuer Monia steht in PP MOE)
    'future':    ['DRF', 'SET3', 'SET03'],
    'world1':    ['MS1', 'MS01', 'MSAZ', 'MSEG', 'MSGB'],
    'world2':    ['MS2', 'MS02', 'MS3', 'MS03', 'MSIN', 'MSHW', 'MSRU', 'MSJP', 'MSCH'],
    'community': ['MBS', 'MBS1'],
}
# „Trials and Tribulations“ = alles, was in keinem anderen Set-Pack landet (ART, THW, WAW, SOB, SOD, DD, GBT, CROSS, DIB, ASQ, CRESTMAS, ...)


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
            ok = pack_of_set(norm_set(c['setID'])) == pack
        if ok:
            out.append(c)
    return out


def art(name):
    v = ART_INDEX.get(name)
    if not v:
        return None
    p = os.path.join(ROOT, 'data', 'card-art', 'native', v['id'] + '.png')
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None


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
