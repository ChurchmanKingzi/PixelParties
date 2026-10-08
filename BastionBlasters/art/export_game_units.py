"""Exporter der Einheiten-Atlanten fuer den spielbaren Prototyp (Vertrag: game/ASSET_SPEC.md, Abschnitt 1).

Aufruf (aus art/):  python3 -I export_game_units.py

Schreibt   game/public/assets/units_a.png   (Teamfarbe A, Karmesin)
           game/public/assets/units_b.png   (identisches Layout, swap_team angewendet, Teal)
           game/public/assets/units.json    (ein JSON fuer beide Atlanten)
und die Kontaktboegen (x3, Schluessel als Beschriftung, Anker markiert)  art/out/game_assets/units_*.png

Ablauf
  1. Alle pack_*.py werden importiert (wie cards.main()). Fuer jede der 77 Einheitenkarten wird das Diorama
     (cards_art.ART / art_for) einmal gerendert, waehrend unit_at / prop_at / World.draw und alle Sprite-Funktionen
     der Projekt-Module aufzeichnen, welche Sprites gezeichnet wurden. Die Originale werden danach wiederhergestellt.
  2. Der Held jeder Karte ist der groesste aufgezeichnete Einheiten-Sprite (spr_* oder eine der Alt-Einheiten), gleich ob er
     per unit_at, prop_at, World.draw gezeichnet oder nur erzeugt wurde (US-09); HERO_OVERRIDE koennte eine andere Funktion
     erzwingen (bleibt leer: der Rekorder findet alle 77 Helden, auf den Kontaktboegen geprueft). Die Sprite-Funktion wird mit
     den aufgezeichneten Argumenten, aber anim='idle' (IDLE_OVERRIDE fuer Einheiten ohne 'idle') und f=0 / f=1 erneut aufgerufen.
  3. Rahmen werden auf die Bounding Box der deckenden Pixel gestutzt. Anker = Fusspunkt: Mitte der Zeichenflaeche und unterste
     deckende Zeile des Ruhebildes (alle Posen einer Einheit behalten denselben Bodenabstand), bei Schwebenden (HOVER) die
     Stelle des Bodenschattens im Diorama (darf unter dem Rahmen liegen).
  4. Projektile, Effekte, Rangabzeichen und Schatten werden hier selbst gezeichnet (Master-Palette, Licht links oben).
  5. Atlas packen (Regalpacker, 1 px Abstand), Team-B-Atlas per swap_team, Palette pruefen, JSON + Kontaktboegen schreiben.
"""
from __future__ import annotations

import functools
import glob
import importlib
import inspect
import json
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

from pixl import (Canvas, World, RAMPS, INK, WHITE, ellipse, thick_line, poly, palette_violations, upscale, label_font,
                  hexrgb)
from scenekit import swap_team
import cards_art
import assets_units

OUT_ASSETS = os.path.join(ROOT, 'game', 'public', 'assets')
OUT_SHEETS = os.path.join(HERE, 'out', 'game_assets')
ATLAS_W = 1024
SCALE = 3                                   # Kontaktboegen x3

CARD_IDS = ([f'UA-{i:02d}' for i in range(1, 19)] + [f'US-{i:02d}' for i in range(1, 24)] +
            [f'UV-{i:02d}' for i in range(1, 18)] + [f'UZ-{i:02d}' for i in range(1, 20)])


# =========================================================================== Aufzeichnen der Dioramen

# Alt-Einheiten (assets_units.py), die nicht spr_* heissen
UNIT_FUNCS = {'skeleton', 'goblin', 'pumpkin', 'bear', 'guard', 'witch', 'catapult', 'builder'}
# spr_*-Funktionen, die in Dioramen vorkommen, aber nie der Held sind (Gegner, Geschosse, Kulisse)
NOT_HERO = {'spr_raider', 'spr_angel', 'spr_meteor', 'spr_zep_bomb', 'spr_shell', 'spr_chunk', 'spr_whale_ball',
            'spr_splinter', 'spr_cracked_gate', 'spr_slab', 'spr_molehill', 'spr_dirt_hole', 'spr_dirt_lip',
            'spr_crate_loot', 'spr_bat'}
# Module, deren Sprite-Funktionen beim Aufzeichnen umhuellt werden
def _is_wrap_module(name: str) -> bool:
    return name.startswith('pack_') or name.startswith('assets_') or name in ('landscape', 'cards_art')


class Recorder:
    """Patcht unit_at / prop_at / World.draw und alle Canvas-liefernden Funktionen der Projekt-Module (reversibel)."""

    def __init__(self):
        self.events = []        # ('unit'|'prop'|'draw', sprite, x, y, flip, team_swap, extra)
        self.log = []           # (fn, args, kwargs, canvas) in Aufrufreihenfolge
        self.gen = {}           # id(canvas) -> (fn, args, kwargs, canvas)
        self._depth = 0
        self._undo = []         # (dict, name, original)
        self._orig_draw = None

    def _wrap_gen(self, orig):
        rec = self

        @functools.wraps(orig)
        def wrapper(*a, **k):
            r = orig(*a, **k)
            if isinstance(r, Canvas):
                rec.gen[id(r)] = (orig, a, k, r)
                rec.log.append((orig, a, k, r))
            return r
        return wrapper

    def install(self):
        mods = {}
        for n, m in list(sys.modules.items()):
            f = getattr(m, '__file__', None)
            if f and n != '__main__' and os.path.dirname(os.path.abspath(f)) == HERE:
                mods[n] = m
        orig_unit_at, orig_prop_at = cards_art.unit_at, cards_art.prop_at
        self._orig_draw = World.draw
        rec = self

        def unit_at(world, spr, foot_x, foot_y, flip=False, team_swap=False, sh=(9, 3)):
            rec.events.append(('unit', spr, foot_x, foot_y, flip, team_swap, sh))
            rec._depth += 1
            try:
                return orig_unit_at(world, spr, foot_x, foot_y, flip, team_swap, sh)
            finally:
                rec._depth -= 1

        def prop_at(world, spr, foot_x, foot_y, flip=False):
            rec.events.append(('prop', spr, foot_x, foot_y, flip, False, None))
            rec._depth += 1
            try:
                return orig_prop_at(world, spr, foot_x, foot_y, flip)
            finally:
                rec._depth -= 1

        orig_draw = self._orig_draw

        def draw(world, sprite, x, y, key, flip=False):
            if rec._depth == 0:
                rec.events.append(('draw', sprite, x, y, flip, False, key))
            return orig_draw(world, sprite, x, y, key, flip)

        wrappers = {}
        for n, m in mods.items():
            if not _is_wrap_module(n):
                continue
            for name, obj in list(vars(m).items()):
                if inspect.isfunction(obj) and _is_wrap_module(obj.__module__) and obj not in (orig_unit_at, orig_prop_at):
                    wrappers.setdefault(obj, self._wrap_gen(obj))
        for n, m in mods.items():
            d = vars(m)
            for name, obj in list(d.items()):
                if inspect.isfunction(obj) and obj in wrappers:
                    self._undo.append((d, name, obj))
                    d[name] = wrappers[obj]
                elif obj is orig_unit_at:
                    self._undo.append((d, name, obj))
                    d[name] = unit_at
                elif obj is orig_prop_at:
                    self._undo.append((d, name, obj))
                    d[name] = prop_at
        World.draw = draw

    def uninstall(self):
        for d, name, obj in reversed(self._undo):
            d[name] = obj
        self._undo.clear()
        World.draw = self._orig_draw

    def run(self, cid):
        self.events.clear()
        self.log.clear()
        self.gen.clear()
        cards_art.art_for(cid)
        return list(self.events), list(self.log)


def import_packs():
    for f in sorted(glob.glob(os.path.join(HERE, 'pack_*.py'))):
        importlib.import_module(os.path.basename(f)[:-3])


def is_hero_fn(fn) -> bool:
    n = fn.__name__
    return (n.startswith('spr_') or n in UNIT_FUNCS) and n not in NOT_HERO


class Hero:
    """Aufgezeichneter Held einer Karte: Sprite-Funktion + Argumente + wie er gefunden wurde."""

    def __init__(self, cid, fn, args, kwargs, canvas, source, draw_xy):
        self.cid, self.fn, self.args, self.kwargs = cid, fn, args, kwargs
        self.canvas, self.source, self.draw_xy = canvas, source, draw_xy

    def call(self, anim=None, f=0):
        params = inspect.signature(self.fn).parameters
        kw = dict(inspect.signature(self.fn).bind_partial(*self.args, **self.kwargs).arguments)
        if anim is not None and 'anim' in params:
            kw['anim'] = anim
        if 'f' in params:
            kw['f'] = f
        return self.fn(**kw)


def find_hero(cid, events, log, override=None):
    """Held = groesster aufgezeichneter Einheiten-Sprite. Reihenfolge: gezeichnet (unit_at/prop_at/draw), sonst nur erzeugt."""
    rec_gen = {}
    for (fn, a, k, cv) in log:
        rec_gen[id(cv)] = (fn, a, k, cv)
    best = None
    for (kind, spr, x, y, fl, ts, extra) in events:
        g = rec_gen.get(id(spr))
        if not g or not is_hero_fn(g[0]):
            continue
        if override and g[0].__name__ != override:
            continue
        area = spr.w * spr.h
        if best is None or area > best[0]:
            xy = (int(x - spr.w // 2), int(y - spr.h + 1)) if kind in ('unit', 'prop') else (int(x), int(y))
            best = (area, g, kind, xy)
    if best is None:                                # nur erzeugt, nie ueber unit_at/draw gezeichnet (z. B. US-09)
        for (fn, a, k, cv) in log:
            if not is_hero_fn(fn) or (override and fn.__name__ != override):
                continue
            area = cv.w * cv.h
            if best is None or area > best[0]:
                best = (area, (fn, a, k, cv), 'call', None)
    if best is None:
        return None
    _, (fn, a, k, cv), kind, xy = best
    return Hero(cid, fn, a, k, cv, kind, xy)


# =========================================================================== Rahmen, Trimmen, Anker

PALETTE = {tuple(int(v) for v in c) for r in RAMPS.values() for c in r} | {tuple(INK), tuple(WHITE)}
PALETTE_LIST = sorted(PALETTE)


class Frame:
    """Ein Atlas-Rahmen: gestutzte Zeichenflaeche + Anker (in Rahmenpixeln, darf ausserhalb liegen)."""

    def __init__(self, key, cv, ax, ay):
        self.key, self.cv, self.ax, self.ay = key, cv, ax, ay

    @property
    def w(self):
        return self.cv.w

    @property
    def h(self):
        return self.cv.h


SNAPPED = []        # Rahmen, in denen Farben ausserhalb der Master-Palette auf die naechste Palettenfarbe gezogen wurden


def clean(cv: Canvas, key='?') -> Canvas:
    """Alpha nur 0 oder 255 (Teiltransparenz entfernt, unsichtbare Pixel = 0) und nur Master-Palette (Notnagel)."""
    out = cv.copy()
    vis = out.px[:, :, 3] >= 128
    out.px[~vis] = 0
    out.rid[~vis] = -1
    out.px[vis, 3] = 255
    snapped = False
    for y, x in zip(*np.nonzero(vis)):
        col = tuple(int(v) for v in out.px[y, x, :3])
        if col not in PALETTE:
            near = min(PALETTE_LIST, key=lambda q: (q[0] - col[0]) ** 2 + (q[1] - col[1]) ** 2 + (q[2] - col[2]) ** 2)
            out.px[y, x, :3] = near
            snapped = True
    if snapped:
        SNAPPED.append(key)
    return out


def bbox(cv: Canvas):
    ys, xs = np.nonzero(cv.px[:, :, 3] > 0)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def crop(cv: Canvas, x0, y0, x1, y1) -> Canvas:
    out = Canvas(x1 - x0 + 1, y1 - y0 + 1)
    out.px[:] = cv.px[y0:y1 + 1, x0:x1 + 1]
    out.rid[:] = cv.rid[y0:y1 + 1, x0:x1 + 1]
    return out


def trim_frame(key, cv, fx, fy) -> Frame:
    """Auf die Bounding Box der deckenden Pixel stutzen; (fx, fy) = Anker in Koordinaten der Zeichenflaeche."""
    cv = clean(cv, key)
    bb = bbox(cv)
    if bb is None:
        return Frame(key, Canvas(1, 1), 0, 0)
    x0, y0, x1, y1 = bb
    return Frame(key, crop(cv, x0, y0, x1, y1), fx - x0, fy - y0)


def group_frames(prefix, canvases, start=0):
    """Mehrbild-Gruppe (Geschoss, Effekt): alle Bilder auf dieselbe Vereinigungs-Bounding-Box gestutzt (gleiche Groesse),
    Anker = Mitte. Schluessel <prefix>#n."""
    canvases = [clean(cv, f'{prefix}#{start + n}') for n, cv in enumerate(canvases)]
    boxes = [bbox(cv) for cv in canvases]
    boxes = [b for b in boxes if b]
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    out = []
    for n, cv in enumerate(canvases):
        cr = crop(cv, x0, y0, x1, y1)
        out.append(Frame(f'{prefix}#{start + n}', cr, cr.w // 2, cr.h // 2))
    return out


# =========================================================================== Helden der Karten

# Karten, bei denen der aufgezeichnete groesste Einheiten-Sprite nicht der Held ist: Karte -> Name der Sprite-Funktion.
# Leer: der erweiterte Rekorder (World.draw + Aufrufprotokoll) findet bei allen 77 Karten den richtigen Helden.
HERO_OVERRIDE: dict = {}

# Ruhepose je Karte: (anim, (f0, f1)). Standard: ('idle', (0, 1)).
IDLE_OVERRIDE = {
    'UA-01': ('load', (0, 1)),          # Katapult hat nur 'load' (still) und 'fire'
    'US-03': ('run', (1, 3)),           # Kuerbis hat nur 'run'; f=1 und f=3 stehen (Schritt 0), nur der Zuender flackert
    'US-06': ('slide', (0, 1)),         # Rutsch-Baer: nur 'slide'
    'UV-02': ('awake', (0, 1)),         # Diorama zeigt den erwachten Kauz (Augen glimmen); 'idle' waere die ruhende Statue
    'UZ-01': ('stir', (0, 1)),          # Kraeuterhexe: nur 'stir'
}

# Schwebende Einheiten: Anker = Stelle des Bodenschattens, in Pixeln der Zeichenflaeche des Sprites
# (aus dem Diorama abgelesen: Schattenpunkt minus Zeichenposition; darf unterhalb des Sprites liegen).
HOVER = {
    'UA-09': (36, 68),      # shadow(w, 42, 86) bei Sprite (6, 18)
    'UA-14': (32, 57),      # blob_shadow(w, 76, 64) bei Sprite (44, 7)
    'US-09': (20, 62),      # blob_shadow(w, 66, 80) bei Sprite (66 - w//2, 60 - h)
    'US-18': (34, 76),      # shadow(w, 74, 88) bei Sprite (40, 12)
    'US-19': (32, 72),      # shadow(w, 48, 84) bei Sprite (16, 12)
    'US-22': (40, 80),      # shadow(w, 52, 86) bei Sprite (12, 6)
    'UZ-13': (22, 56),      # shadow(w, 66, 74) bei Sprite (44, 18)
}

# Optionale Zusatzposen: Karte -> [(Posenname im Schluessel, anim-Argument der Sprite-Funktion, Bildzahl oder None)].
# Schluessel <ID>@<Pose>#n. None = Bildzahl aus der Periode des f-Zyklus (hoechstens 6 sonst 4).
# Die Bildzahlen folgen den UNITS-Tabellen / f-Modulos der Sprite-Funktionen (z. B. attack = f % 3).
POSES = {
    'UA-01': [('fire', 'fire', 3)],                       # Ausholen, Abwurf, Rueckschwung
    'UA-10': [('fire', 'fire', None)],
    'UA-13': [('fire', 'fire', None)],
    'UA-14': [('drop', 'drop', None)],
    'US-01': [('walk', 'walk', 4), ('attack', 'attack', 3)],
    'US-02': [('walk', 'walk', 4), ('attack', 'attack', 3)],
    'US-03': [('walk', 'run', 4)],
    'US-04': [('crouch', 'crouch', None)],
    'US-06': [('walk', 'slide', 3)],
    'US-12': [('hop', 'hop', 3)],
    'US-14': [('charged', 'charged', 4)],
    'UV-01': [('attack', 'attack', 3)],
    'UV-02': [('dormant', 'idle', 1)],                     # die ruhende Statue (Held = erwacht)
    'UV-11': [('breath', 'breath', None)],
    'UV-15': [('gulp', 'gulp', None)],
    'UV-17': [('sweep', 'sweep', 3)],
    'UZ-02': [('work', 'work', 3)],
    'UZ-03': [('hammer', 'hammer', 3)],
}


def idle_pad(h: Hero) -> int:
    """Leere Zeilen unter dem untersten deckenden Pixel im Ruhebild f=0 (0 bei fast allen Einheiten)."""
    if not hasattr(h, '_pad'):
        anim, fs = IDLE_OVERRIDE.get(h.cid, ('idle', (0, 1)))
        cv = h.call(anim, fs[0])
        h._pad = cv.h - 1 - bbox(clean(cv))[3]
    return h._pad


def hero_anchor(h: Hero, cv):
    """Anker in Koordinaten der Zeichenflaeche: Schwebende = Schattenpunkt (HOVER), sonst Mitte der Fuesse und unterste
    deckende Zeile des Ruhebildes (alle Posen derselben Einheit nutzen denselben Abstand zum Boden der Zeichenflaeche)."""
    return HOVER.get(h.cid, (cv.w // 2, cv.h - 1 - idle_pad(h)))


def hero_frames(h: Hero):
    """Zwei Ruhe-Rahmen <ID>#0, <ID>#1 des Helden."""
    anim, fs = IDLE_OVERRIDE.get(h.cid, ('idle', (0, 1)))
    out = []
    for n, f in enumerate(fs):
        cv = h.call(anim, f)
        out.append(trim_frame(f'{h.cid}#{n}', cv, *hero_anchor(h, cv)))
    return out


def cycle_length(h: Hero, anim, span=24):
    """Kleinste Periode p (1, 2, 3, 4, 5, 6, 8, 12) des f-Zyklus einer Pose, gemessen an den Pixeln."""
    imgs = [h.call(anim, f).px for f in range(span)]
    for p in (1, 2, 3, 4, 5, 6, 8, 12):
        if all(np.array_equal(imgs[f], imgs[f + p]) for f in range(span - p)):
            return p
    return 4


def pose_frames(h: Hero):
    """Optionale Posen <ID>@<Pose>#n (nur wenn sie sich von der Ruhepose unterscheiden)."""
    out = []
    idle_anim, idle_fs = IDLE_OVERRIDE.get(h.cid, ('idle', (0, 1)))
    idle_px = [h.call(idle_anim, f).px for f in idle_fs]
    for pose, anim, n in POSES.get(h.cid, []):
        if n is None:
            p = cycle_length(h, anim)
            n = p if p <= 6 else 4
        frames = [h.call(anim, f) for f in range(n)]
        if all(any(np.array_equal(cv.px, ip) for ip in idle_px) for cv in frames):
            continue                                       # nichts Neues gegenueber der Ruhepose
        for k, cv in enumerate(frames):
            out.append(trim_frame(f'{h.cid}@{pose}#{k}', cv, *hero_anchor(h, cv)))
    return out


# =========================================================================== Selbst gezeichnete Sprites
# Geschosse (proj.*), Effekte (fx.*), Schatten. Auf ungeraden Zeichenflaechen um die Mitte gezeichnet, nach rechts
# gerichtet, Licht links oben, Master-Palette, Sel-Out. Mehrbild-Gruppen werden auf eine gemeinsame Box gestutzt.

C49 = 24                     # Zentrum der 49 x 49 Explosionsflaeche


def px(c, x, y, ramp, i):
    c.put_ramp(x, y, ramp, i)


def pts(c, ramp, i, *xy):
    for (x, y) in xy:
        c.put_ramp(x, y, ramp, i)


# --------------------------------------------------------------------------- Geschosse


def proj_stone(f=0):
    c = Canvas(21, 21)
    ellipse(c, 10.5, 10.5, 4.8, 4.6, 'stone', lo=1, hi=5, ambient=0.14)
    for (x, y) in ((((13, 13), (12, 14), (14, 11)), ((8, 14), (9, 15), (13, 10)))[f % 2]):
        px(c, x, y, 'stone', 1)
    pts(c, 'bone', 5, (8, 8), (9, 7), (8, 9))
    c.outline()
    return c


def proj_bomb(f=0):
    c = Canvas(21, 21)
    ellipse(c, 10.5, 12.5, 4.5, 4.4, 'coal', lo=1, hi=4, ambient=0.2)
    pts(c, 'coal', 5, (8, 10), (9, 9), (8, 11))
    pts(c, 'stone', 3, (8, 12), (9, 10))
    c.rect(9, 7, 11, 7, 'metal', 3)                           # Kappe
    pts(c, 'metal', 5, (9, 7))
    pts(c, 'dirt', 4, (10, 6), (9, 5))                        # Lunte
    if f % 2 == 0:
        pts(c, 'gold', 5, (9, 4))
        pts(c, 'fire', 4, (10, 4), (8, 4), (9, 3))
        px(c, 9, 4, 'bone', 5)
    else:
        pts(c, 'bone', 5, (9, 4), (10, 3))
        pts(c, 'gold', 4, (8, 4), (9, 3), (11, 4))
    c.outline()
    return c


def proj_arrow(f=0):
    c = Canvas(21, 21)
    for x in range(5, 13):                                    # Schaft
        px(c, x, 10, 'wood', 4 if x % 4 else 5)
        px(c, x, 11, 'wood', 2)
    pts(c, 'teamA', 4, (4, 8), (5, 8), (5, 9), (6, 9))        # Befiederung in Teamfarbe
    pts(c, 'teamA', 3, (4, 13), (5, 13), (5, 12), (6, 12))
    pts(c, 'teamA', 5, (4, 8), (5, 9))
    pts(c, 'teamA', 2, (4, 13), (6, 12))
    pts(c, 'teamA', 3, (7, 10), (7, 11))
    for (x, y, i) in ((12, 8, 4), (13, 8, 4), (12, 9, 5), (13, 9, 4), (14, 9, 4), (12, 10, 5), (13, 10, 5), (14, 10, 4), (15, 10, 4),
                      (16, 10, 5), (12, 11, 3), (13, 11, 3), (14, 11, 3), (15, 11, 3), (12, 12, 2), (13, 12, 2), (14, 12, 2),
                      (12, 13, 2)):
        px(c, x, y, 'metal', i)
    c.outline()
    return c


def proj_bolt(f=0):
    c = Canvas(21, 21)
    path = ([(4, 12), (7, 8), (9, 12), (12, 8), (13, 11), (16, 9)],
            [(4, 9), (6, 12), (9, 8), (11, 12), (14, 9), (16, 11)])[f % 2]
    for (a, b) in zip(path, path[1:]):
        c.line(a[0], a[1], b[0], b[1], 'ice', 3)
        c.line(a[0], a[1] + 1, b[0], b[1] + 1, 'ice', 3)
    for (a, b) in zip(path, path[1:]):
        c.line(a[0], a[1], b[0], b[1], 'ice', 5)
    c.outline()
    return c


def proj_fire(f=0):
    c = Canvas(21, 21)
    for x in range(4, 11):                                    # zackiger Schweif nach links, Kopf rechts
        half = 0.8 + 3.2 * (x - 4) / 7.0
        dy = int(round(0.9 * math.sin(x * 1.1 + f * 2.6)))
        for y in range(int(10 + dy - half), int(10 + dy + half) + 1):
            edge = abs(y - (10 + dy)) >= half - 1.0
            px(c, x, y, 'fire', 2 if edge else (3 if abs(y - (10 + dy)) > half * 0.45 else 4))
    ellipse(c, 12.5, 10.5, 4.5, 4.3, 'fire', lo=2, hi=5, ambient=0.2)
    ellipse(c, 12.5, 10.5, 2.3, 2.3, 'gold', lo=4, hi=5, ambient=0.3)
    pts(c, 'bone', 5, (12, 9), (11, 9))
    if f % 2 == 0:
        pts(c, 'gold', 5, (5, 6), (7, 5))
        px(c, 4, 13, 'fire', 4)
    else:
        pts(c, 'gold', 5, (6, 14), (8, 15))
        px(c, 4, 7, 'fire', 4)
    c.outline(dark=1, lit=2)
    return c


def proj_ice(f=0):
    c = Canvas(21, 21)
    poly(c, [(4, 10.5), (10, 7), (17, 10.5)], 'ice', flat=4)           # facettierter Splitter, Spitze rechts
    poly(c, [(4, 10.5), (17, 10.5), (10, 14)], 'ice', flat=2)
    poly(c, [(10, 7), (14, 9), (10, 10.5)], 'ice', flat=5)
    poly(c, [(10, 14), (14, 12), (10, 10.5)], 'ice', flat=3)
    for x in range(5, 17):
        px(c, x, 10, 'ice', 3 if x < 10 else 4)
    pts(c, 'ice', 5, (7, 9), (8, 9), (9, 8), (11, 8), (12, 8), (13, 9), (16, 10))
    pts(c, 'ice', 1, (6, 12), (7, 12), (8, 13))
    c.outline()
    if f % 2 == 0:
        pts(c, 'bone', 5, (6, 5), (5, 4), (7, 4))
    else:
        pts(c, 'bone', 5, (6, 15), (5, 14), (7, 14))
    return c


def proj_poison(f=0):
    c = Canvas(21, 21)
    blobs = (((8, 9, 2.2), (12, 8, 1.9), (12, 12, 2.4), (7, 13, 1.7)),
             ((8, 8, 2.0), (12, 9, 2.2), (11, 13, 2.0), (7, 12, 1.9)))[f % 2]
    for (bx, by, r) in blobs:
        ellipse(c, bx + 0.5, by + 0.5, r, r, 'slime', lo=1, hi=5, ambient=0.22)
        px(c, int(bx - r * 0.4), int(by - r * 0.4), 'slime', 5)
    pts(c, 'leaf', 4, (15, 10), (4, 11))
    pts(c, 'leaf', 3, (10, 15), (14, 15) if f % 2 else (10, 5))
    c.outline()
    return c


def proj_arcane(f=0):
    c = Canvas(21, 21)
    ellipse(c, 10.5, 10.5, 4.4, 4.4, 'purple', lo=1, hi=5, ambient=0.2)
    ellipse(c, 10.5, 10.5, 2.0, 2.0, 'purple', lo=4, hi=5, ambient=0.3)
    pts(c, 'bone', 5, (9, 9), (10, 9), (9, 10))
    if f % 2 == 0:
        pts(c, 'gold', 5, (15, 5), (15, 4), (15, 6), (14, 5), (16, 5))
        pts(c, 'purple', 4, (5, 13), (4, 14))
    else:
        pts(c, 'gold', 5, (5, 15), (5, 14), (5, 16), (4, 15), (6, 15))
        pts(c, 'purple', 4, (15, 6), (16, 5))
    c.outline()
    return c


def proj_ink(f=0):
    c = Canvas(21, 21)
    poly(c, [(5, 10), (9, 7), (9, 14)], 'coal', lo=1, hi=3, flat=2)
    ellipse(c, 11.5, 10.5, 4.6, 4.0, 'coal', lo=1, hi=4, ambient=0.18)
    pts(c, 'coal', 2, *(((4, 10), (5, 11)), ((4, 11), (5, 9)))[f % 2])
    pts(c, 'purple', 3, (10, 8), (9, 9))
    pts(c, 'purple', 4, (10, 8))
    pts(c, 'coal', 4, (11, 8), (12, 8))
    c.outline()
    return c


def proj_goo(f=0):
    c = Canvas(21, 21)
    ellipse(c, 12.5, 10.5, 4.6, 4.2, 'slime', lo=1, hi=5, ambient=0.2)
    pts(c, 'slime', 5, (11, 8), (12, 8), (10, 9))
    pts(c, 'slime', 3, (5, 9 + f % 2), (6, 10), (7, 10), (8, 10), (9, 10))
    pts(c, 'slime', 2, (6, 11), (7, 11), (8, 11))
    pts(c, 'slime', 4, (3, 12 - f % 2 * 2), (4, 8 + f % 2 * 2))
    c.outline()
    return c


def proj_fish(f=0):
    c = Canvas(21, 21)
    ellipse(c, 10.5, 10.5, 5.2, 3.0, 'ice', lo=1, hi=5, ambient=0.2)
    tail = ([(6, 10.5), (3, 7), (4, 10.5), (3, 14)], [(6, 10.5), (3, 9), (4, 11), (3, 13)])[f % 2]
    poly(c, tail, 'ice', lo=2, hi=4)
    poly(c, [(8, 8), (10, 5), (13, 8)], 'ice', lo=2, hi=4)
    for x in range(7, 15):
        px(c, x, 12, 'bone', 4 if x % 2 else 3)
    pts(c, 'bone', 5, (8, 9), (9, 8))
    px(c, 13, 9, 'coal', 1)
    px(c, 14, 11, 'ice', 1)
    c.outline()
    return c


def proj_egg(f=0):
    import pixl
    c = Canvas(21, 21)
    ang = math.radians((-35, 35)[f % 2])
    ca, sa = math.cos(ang), math.sin(ang)
    ru, rv = 5.4, 4.0
    for y in range(3, 18):
        for x in range(3, 18):
            dx, dy = x + 0.5 - 10.5, y + 0.5 - 10.5
            u, v = dx * ca + dy * sa, -dx * sa + dy * ca
            w = rv * (1.0 - 0.22 * u / ru)
            if (u / ru) ** 2 + (v / w) ** 2 <= 1.0:
                L = pixl.sphere_L(max(-0.95, min(0.95, dx / 5.6)) * 0.9, max(-0.95, min(0.95, dy / 5.6)) * 0.9, 0.2)
                c.put_ramp(x, y, 'bone', pixl.quant(L, 2, 5, x, y))
    for (x, y) in (((12, 12), (9, 13), (13, 9)), ((12, 13), (8, 12), (12, 8)))[f % 2]:
        px(c, x, y, 'dirt', 3)
    c.outline()
    return c


def proj_shell(f=0):
    c = Canvas(21, 21)
    ellipse(c, 10.5, 10.5, 5.3, 5.2, 'metal', lo=0, hi=4, ambient=0.1)
    pts(c, 'metal', 5, (8, 7), (9, 7), (8, 8), (7, 8))
    px(c, 8, 7, 'bone', 5)
    if f % 2:
        pts(c, 'metal', 1, (12, 12), (13, 11), (12, 13))
    else:
        pts(c, 'metal', 1, (13, 12), (12, 13), (13, 13))
    pts(c, 'metal', 3, (12, 8), (13, 9))
    c.outline()
    return c


PROJ = [
    ('stone', proj_stone, 2), ('bomb', proj_bomb, 2), ('arrow', proj_arrow, 1), ('bolt', proj_bolt, 2), ('fire', proj_fire, 2),
    ('ice', proj_ice, 2), ('poison', proj_poison, 2), ('arcane', proj_arcane, 2), ('ink', proj_ink, 2), ('goo', proj_goo, 2),
    ('fish', proj_fish, 2), ('egg', proj_egg, 2), ('shell', proj_shell, 2),
]


# --------------------------------------------------------------------------- Effekte


def fx_spark(f=0):
    c = Canvas(15, 15)
    m = 7
    if f == 0:
        pts(c, 'gold', 5, (m - 1, m), (m + 1, m), (m, m - 1), (m, m + 1))
        px(c, m, m, 'bone', 5)
    elif f == 1:
        px(c, m, m, 'bone', 5)
        for d in (1, 2):
            for (dx, dy) in ((d, 0), (-d, 0), (0, d), (0, -d)):
                px(c, m + dx, m + dy, 'gold', 5 if d == 1 else 4)
        pts(c, 'fire', 4, (m + 1, m + 1), (m - 1, m - 1), (m + 1, m - 1), (m - 1, m + 1))
    elif f == 2:
        px(c, m, m, 'gold', 5)
        for d in (3, 4, 5):
            for (dx, dy) in ((d, 0), (-d, 0), (0, d), (0, -d)):
                px(c, m + dx, m + dy, 'gold', 4 if d < 5 else 3)
        pts(c, 'fire', 4, (m + 2, m + 2), (m - 2, m - 2), (m + 2, m - 2), (m - 2, m + 2))
        pts(c, 'fire', 3, (m + 3, m + 3), (m - 3, m - 3), (m + 3, m - 3), (m - 3, m + 3))
    else:
        pts(c, 'gold', 3, (m + 5, m), (m - 5, m + 1), (m, m - 6), (m + 1, m + 5))
        pts(c, 'fire', 3, (m + 4, m - 4), (m - 4, m + 4), (m - 4, m - 4), (m + 4, m + 4))
        pts(c, 'fire', 2, (m + 6, m - 2), (m - 6, m + 2), (m + 2, m + 6), (m - 2, m - 6))
    return c


def _blob_union(c, circles, ramp, lo, hi, ambient=0.18, dissolve=0.0):
    """Wolke aus Kreisen (cx, cy, r): jeder Pixel nimmt die Kugelschattierung des vordersten Kreises.
    dissolve 0..1: Anteil, der per Bayer-Dither wegfaellt (Verwehen)."""
    import pixl
    best = {}
    for (cx, cy, r) in circles:
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                nx, ny = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
                d = nx * nx + ny * ny
                if d > 1.0 or not c.inb(x, y):
                    continue
                z = math.sqrt(1 - d)
                if (x, y) not in best or z > best[(x, y)][0]:
                    best[(x, y)] = (z, nx, ny)
    for (x, y), (z, nx, ny) in best.items():
        if dissolve and pixl.BAYER4[y % 4, x % 4] < dissolve:
            continue
        L = pixl.sphere_L(nx * 0.9, ny * 0.9, ambient)
        c.put_ramp(x, y, ramp, pixl.quant(L, lo, hi, x, y))


def fx_puff(f=0):
    c = Canvas(27, 27)
    m = 13
    sets = [
        [(m, m + 2, 4.0), (m - 3, m + 3, 2.8), (m + 3, m + 3, 2.6)],
        [(m, m + 1, 5.4), (m - 4, m + 3, 3.8), (m + 4, m + 3, 3.6), (m, m - 2, 3.6)],
        [(m, m, 6.4), (m - 5, m + 3, 4.6), (m + 5, m + 2, 4.4), (m - 1, m - 4, 4.2), (m + 3, m - 3, 3.4)],
        [(m, m, 7.6), (m - 6, m + 3, 5.2), (m + 6, m + 2, 5.0), (m - 2, m - 5, 4.6), (m + 4, m - 5, 3.8)],
    ]
    _blob_union(c, sets[f % 4], 'stone', 2, 5, ambient=0.2, dissolve=(0.0, 0.0, 0.2, 0.45)[f % 4])
    c.outline(dark=1, lit=3)
    return c


def _jag(theta, r0, ph, amp=0.16):
    return r0 * (1.0 + amp * math.sin(5 * theta + ph) + 0.55 * amp * math.sin(9 * theta + 2 * ph + 1.0))


def fx_explosion(f=0):
    """5 Bilder: Blitz, Feuerball, grosser Ball, Rauchring, Rauch (bis 47 px)."""
    c = Canvas(49, 49)
    m = C49
    rng = random.Random(77)
    R = (6.0, 11.0, 15.0, 17.5, 17.5)[f]
    for y in range(49):
        for x in range(49):
            dx, dy = x + 0.5 - (m + 0.5), y + 0.5 - (m + 0.5)
            r = math.hypot(dx, dy)
            th = math.atan2(dy, dx)
            rr = _jag(th, R, 0.9 + f * 0.37, 0.16 if f < 3 else 0.2)
            t = r / rr
            lit = (-dx - dy) / (2.0 * rr + 1e-6)                    # >0 oben links
            chk = (x + y) % 2 == 0
            if f == 0:
                if t <= 1.0:
                    px(c, x, y, 'bone' if t < 0.45 else 'gold', 5 if t < 0.45 else (5 if t < 0.75 else 4))
            elif f in (1, 2):
                if t <= 1.0:
                    u = t - 0.12 * lit
                    if u < 0.22:
                        px(c, x, y, 'bone', 5)
                    elif u < 0.42:
                        px(c, x, y, 'gold', 5)
                    elif u < 0.58:
                        px(c, x, y, 'gold', 4 if not (0.5 < u and chk) else 5)
                    elif u < 0.74:
                        px(c, x, y, 'fire', 4 if (u < 0.66 or chk) else 3)
                    elif u < 0.9:
                        px(c, x, y, 'fire', 3 if (u < 0.82 or chk) else 2)
                    else:
                        px(c, x, y, 'fire', 2 if chk or u < 0.96 else 1)
                elif f == 2 and t <= 1.12 and chk and rng.random() < 0.85:
                    px(c, x, y, 'coal', 2)                            # erste Rauchkruste am Rand
            elif f == 3:
                if t <= 0.62:
                    u = t / 0.62 - 0.12 * lit
                    if u < 0.35:
                        px(c, x, y, 'gold', 4 if chk else 5)
                    elif u < 0.7:
                        px(c, x, y, 'fire', 4 if chk else 3)
                    else:
                        px(c, x, y, 'fire', 3 if chk else 2)
                elif t <= 1.0:
                    u = (t - 0.62) / 0.38
                    if (chk or u < 0.45) and not (u > 0.6 and (x * 3 + y * 5) % 4 == 0):
                        px(c, x, y, 'coal', 3 if u < 0.5 else 2)
                    elif chk and u < 0.8:
                        px(c, x, y, 'fire', 2)
            else:
                if t <= 1.0 and chk and (x * 5 + y * 3) % 7 > 1:
                    u = t - 0.15 * lit
                    px(c, x, y, 'stone', 3 if u < 0.55 else 2)
    # Funken / Glut
    spark_n = (0, 5, 8, 10, 7)[f]
    for k in range(spark_n):
        th = rng.uniform(0, 2 * math.pi)
        rr = R * rng.uniform(1.0, 1.3) + 1
        x, y = int(m + rr * math.cos(th)), int(m + rr * math.sin(th))
        if c.inb(x, y) and not c.alpha(x, y):
            px(c, x, y, 'gold' if k % 2 else 'fire', 5 if k % 3 == 0 else 4)
    if f in (1, 2):
        c.outline(dark=0, lit=1)
    return c


def fx_heal(f=0):
    c = Canvas(15, 15)
    m = 7
    L = (3, 4, 4)[f % 3]
    cells = set()
    for d in range(-L, L + 1):                                   # Plus mit 3 px breiten Armen
        for t in (-1, 0, 1):
            cells.add((m + d, m + t))
            cells.add((m + t, m + d))
    for (x, y) in cells:
        s = (x - m) + (y - m)
        px(c, x, y, 'leaf', 5 if s <= -2 else (4 if s <= 1 else 3))
    px(c, m, m, 'leaf', 5)
    if f == 2:                                                    # verblasst: Schachbrett-Loecher
        for (x, y) in cells:
            if (x + y) % 2 == 0 and abs(x - m) + abs(y - m) >= 3:
                c.clear_pixel(x, y)
    c.outline(dark=0, lit=1)
    if f == 1:
        pts(c, 'bone', 5, (m + 4, m - 4), (m - 5, m + 4))
    if f == 2:
        pts(c, 'leaf', 5, (m + 4, m - 5), (m - 5, m + 3), (m + 5, m + 2))
    return c


def fx_star(f=0):
    c = Canvas(11, 11)
    m = 5
    if f % 2 == 0:
        shape = ["...#...", "...#...", "..###..", "#######", "..###..", "...#...", "...#..."]
    else:
        shape = ["#.....#", ".#...#.", "..###..", "..###..", "..###..", ".#...#.", "#.....#"]
    for y, row in enumerate(shape):
        for x, ch in enumerate(row):
            if ch == '#':
                dx, dy = x - 3, y - 3
                idx = 5 if dx + dy <= -1 else (4 if dx + dy <= 1 else 3)
                px(c, m - 3 + x, m - 3 + y, 'gold', idx)
    px(c, m, m, 'bone', 5)
    c.outline(dark=0, lit=1)
    return c


def fx_bones(f=0):
    c = Canvas(29, 19)
    thick_line(c, 4, 14, 24, 15, 2.6, 'bone', lo=1, hi=4)            # Knochenhaufen: drei Knochen
    thick_line(c, 6, 16, 22, 11, 2.4, 'bone', lo=2, hi=5)
    thick_line(c, 5, 11, 20, 16, 2.2, 'bone', lo=1, hi=4)
    for (x, y) in ((3, 13), (3, 15), (4, 17), (25, 14), (25, 16), (23, 10), (24, 12), (5, 10), (4, 12)):
        px(c, x, y, 'bone', 4)                                        # Gelenkknubbel
    ellipse(c, 14.5, 7.5, 5.2, 4.7, 'bone', lo=2, hi=5, flatness=0.15)    # Schaedel
    c.rect(11, 9, 17, 11, 'bone', 3)
    c.rect(11, 6, 12, 8, 'coal', 1)
    c.rect(16, 6, 17, 8, 'coal', 1)
    px(c, 14, 9, 'coal', 2)
    px(c, 15, 9, 'coal', 2)
    for x in (11, 13, 15, 17):
        px(c, x, 11, 'bone', 2)
    pts(c, 'bone', 5, (12, 4), (13, 3), (11, 5))
    for k in range(4):                                                # Rippenbogen rechts
        px(c, 21 + k, 8 + (1 if k in (1, 2) else 0), 'bone', 3 if k % 2 else 4)
    c.outline()
    return c


def fx_confetti(f=0):
    c = Canvas(37, 37)
    m = 18
    rng = random.Random(5)
    cols = (('teamA', 4), ('gold', 5), ('ice', 4), ('leaf', 4), ('purple', 4), ('fire', 4), ('skin', 4), ('slime', 4))
    n = 24
    for k in range(n):
        a = 2 * math.pi * k / n + rng.uniform(-0.2, 0.2)
        sp = rng.uniform(0.55, 1.0)
        r = (3.0 + 4.2 * f) * sp + 1
        fall = 0.9 * f * f * (0.6 + sp * 0.5)
        x, y = int(round(m + r * math.cos(a))), int(round(m + r * math.sin(a) * 0.9 + fall))
        if f == 3 and k % 3 == 0:
            continue
        ramp, idx = cols[k % len(cols)]
        shape = (k + f) % 3
        px(c, x, y, ramp, idx)
        if shape == 0:
            px(c, x + 1, y, ramp, idx - 1)
        elif shape == 1:
            px(c, x, y + 1, ramp, idx - 1)
        else:
            pts(c, ramp, idx - 1, (x + 1, y), (x, y + 1), (x + 1, y + 1))
    return c


def _ascii(c, rows, legend, ox=0, oy=0):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in legend:
                ramp, idx = legend[ch]
                c.put_ramp(ox + x, oy + y, ramp, idx)


def fx_drop(f=0):
    c = Canvas(13, 13)
    m = 6
    leg = {'a': ('sky', 5), 'b': ('sky', 4), 'c': ('sky', 3), 'd': ('sky', 2), 'w': ('bone', 5)}
    if f == 0:                                                     # fallender Tropfen
        _ascii(c, ["..a..", "..b..", ".abb.", "wbbbc", "abbcc", ".bcc."], leg, m - 2, m - 3)
    elif f == 1:                                                   # Aufprall: breit und flach
        _ascii(c, ["..ab..", ".abbc.", "abbbcc", "dcccdd"], leg, m - 3, m - 1)
    else:                                                          # Spritzer-Krone
        _ascii(c, ["a.......a", "b..a.a..b", ".b..b..b.", "..abbbbc.", ".abbbbccd", "dccccddd."][0:6], leg, m - 4, m - 3)
    c.outline(dark=1, lit=3)
    return c


def fx_flame(f=0):
    c = Canvas(15, 19)
    m = 7
    sway = (-1, 0, 1)[f % 3]
    for y in range(2, 17):
        t = (16 - y) / 14.0                                         # 0 unten, 1 Spitze
        half = 4.6 * (1 - t) ** 0.75 * (1 + 0.25 * math.sin(y * 1.1 + f * 2.1)) + 0.4
        cx = m + sway * t * 2.4 * (1 if f != 1 else 0)
        for x in range(int(cx - half - 1), int(cx + half) + 2):
            d = abs(x + 0.5 - cx - 0.5)
            if d <= half:
                u = d / (half + 0.01)
                col = 5 if (u < 0.25 and t < 0.6) else (4 if u < 0.6 else 3)
                if u > 0.85:
                    col = 2
                px(c, x, y, 'fire' if col < 5 else 'gold', col if col < 5 else 5)
    for y in range(9, 16):                                           # heller Kern
        for x in range(m - 1, m + 2):
            if c.alpha(x, y) and abs(x - m) <= max(0, (y - 8) // 3):
                px(c, x, y, 'gold', 5 if y > 11 else 4)
    px(c, m, 14, 'bone', 5)
    c.outline(dark=1, lit=2)
    return c


def fx_snow(f=0):
    c = Canvas(11, 11)
    m = 5
    if f % 2 == 0:
        arms = [(0, -1), (0, 1), (-1, 0), (1, 0)]
        for d in (1, 2, 3):
            for (dx, dy) in arms:
                px(c, m + dx * d, m + dy * d, 'ice', 5 if d < 3 else 4)
        for (dx, dy) in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
            px(c, m + dx * 2, m + dy * 2, 'ice', 4)
        px(c, m, m, 'bone', 5)
    else:
        for (dx, dy) in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
            for d in (1, 2):
                px(c, m + dx * d, m + dy * d, 'ice', 5 if d == 1 else 4)
        px(c, m, m, 'bone', 5)
    return c


FX = [('spark', fx_spark, 4), ('puff', fx_puff, 4), ('explosion', fx_explosion, 5), ('heal', fx_heal, 3), ('star', fx_star, 2),
      ('bones', fx_bones, 1), ('confetti', fx_confetti, 4), ('drop', fx_drop, 3), ('flame', fx_flame, 3), ('snow', fx_snow, 2)]


# --------------------------------------------------------------------------- Schatten


def spr_shadow():
    """16 x 6 weicher Ellipsenschatten wie scenekit.shadow: Kern voll, Rand Schachbrett-Dither. Nur coal-Toene."""
    c = Canvas(16, 6)
    for y in range(6):
        for x in range(16):
            d = ((x + 0.5 - 8.0) / 8.0) ** 2 + ((y + 0.5 - 3.0) / 3.0) ** 2
            if d <= 1.0 and (d < 0.45 or (x + y) % 2 == 0):
                c.put_ramp(x, y, 'coal', 1)
    return c


# =========================================================================== Kontaktboegen


def draw_sheet(frames, path, cols=6):
    """Kontaktbogen x3: Rahmen am Anker ausgerichtet, Anker als Kreuz, Bodenlinie, Schluessel als Beschriftung."""
    if not frames:
        return
    L = max(f.ax for f in frames) + 2
    R = max(f.w - f.ax for f in frames) + 2
    T = max(f.ay for f in frames) + 2
    B = max(f.h - f.ay for f in frames) + 2
    if L + R < 56:                                   # Beschriftung braucht Platz
        extra = 56 - (L + R)
        L += extra // 2
        R += extra - extra // 2
    cw, ch = (L + R) * SCALE, (T + B) * SCALE
    pad, lab = 6, 16
    rows = (len(frames) + cols - 1) // cols
    img = Image.new('RGBA', (cols * (cw + pad) + pad, rows * (ch + lab + pad) + pad), hexrgb('#2b2540') + (255,))
    d = ImageDraw.Draw(img)
    font = label_font(11)
    for i, f in enumerate(frames):
        r, c = divmod(i, cols)
        ox, oy = pad + c * (cw + pad), pad + r * (ch + lab + pad)
        d.rectangle([ox, oy, ox + cw - 1, oy + ch - 1], fill=hexrgb('#383250') + (255,))
        gy = oy + T * SCALE + SCALE // 2                                    # Bodenlinie auf Hoehe des Ankers
        d.line([ox, gy, ox + cw - 1, gy], fill=hexrgb('#4a4468') + (255,))
        tile = upscale(f.cv.to_image(), SCALE)
        img.alpha_composite(tile, (ox + (L - f.ax) * SCALE, oy + (T - f.ay) * SCALE))
        axp, ayp = ox + L * SCALE + SCALE // 2, oy + T * SCALE + SCALE // 2
        d.line([axp - 3, ayp, axp + 3, ayp], fill=(255, 0, 255, 255))
        d.line([axp, ayp - 3, axp, ayp + 3], fill=(255, 0, 255, 255))
        d.text((ox + 2, oy + ch + 1), f.key, fill=(235, 230, 245, 255), font=font)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)


# =========================================================================== Atlas


def pack(frames, width=ATLAS_W):
    """Regalpacker: nach Hoehe sortiert, 1 px Abstand (auch zum Rand). Liefert {key: (x, y)} und die Atlas-Hoehe."""
    order = sorted(frames, key=lambda f: (-f.h, -f.w, f.key))
    pos, x, y, row_h = {}, 1, 1, 0
    for f in order:
        if x + f.w + 1 > width:
            x, y, row_h = 1, y + row_h + 1, 0
        pos[f.key] = (x, y)
        x += f.w + 1
        row_h = max(row_h, f.h)
    return pos, y + row_h + 1


def render_atlas(frames, pos, height, team_b=False):
    img = np.zeros((height, ATLAS_W, 4), np.uint8)
    for f in frames:
        cv = swap_team(f.cv) if team_b else f.cv
        x, y = pos[f.key]
        img[y:y + f.h, x:x + f.w] = cv.px
    return Image.fromarray(img, 'RGBA')


def write_json(path, frames, pos):
    lines = ['{', ' "image": "units_a.png",', ' "frames": {']
    for i, f in enumerate(frames):
        x, y = pos[f.key]
        e = json.dumps({'x': x, 'y': y, 'w': f.w, 'h': f.h, 'ax': int(f.ax), 'ay': int(f.ay)}, separators=(', ', ': '))
        lines.append(f'  {json.dumps(f.key)}: {e}' + (',' if i < len(frames) - 1 else ''))
    lines += [' }', '}']
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(lines) + '\n')


CITIZEN_KINDS = ('cloth', 'dirt', 'ice', 'leaf', 'slime', 'teamA')      # alle Buerger-Haut/Kleidertypen der Dioramen


def build_frames(heroes):
    """Alle Rahmen in fester Reihenfolge: (Haupt-Rahmen, Posen-Rahmen)."""
    main_frames, pose_list = [], []
    for cid in CARD_IDS:
        main_frames += hero_frames(heroes[cid])
    for n, kind in enumerate(CITIZEN_KINDS):
        for f in (0, 1):
            cv = assets_units.citizen(kind, f)
            main_frames.append(trim_frame(f'citizen.{n}#{f}', cv, cv.w // 2, cv.h - 1))
    for name, fn, nfr in PROJ:
        main_frames += group_frames(f'proj.{name}', [fn(f) for f in range(nfr)])
    for name, fn, nfr in FX:
        main_frames += group_frames(f'fx.{name}', [fn(f) for f in range(nfr)])
    for r in range(1, 6):
        cv = assets_units.rank_badge(r)
        fr = trim_frame(f'rank.{r}', cv, 0, 0)
        fr.ax, fr.ay = fr.w // 2, fr.h // 2
        main_frames.append(fr)
    main_frames.append(group_frames('shadow', [spr_shadow()])[0])
    main_frames[-1].key = 'shadow'
    for cid in CARD_IDS:
        pose_list += pose_frames(heroes[cid])
    return main_frames, pose_list


def sheets(main_frames, pose_list):
    by = {f.key: f for f in main_frames}
    for k in range(0, len(CARD_IDS), 12):
        ids = CARD_IDS[k:k + 12]
        part = [by[f'{cid}#{n}'] for cid in ids for n in (0, 1)]
        draw_sheet(part, os.path.join(OUT_SHEETS, f'units_heroes_{k // 12 + 1}.png'), cols=6)
    draw_sheet([f for f in main_frames if f.key.startswith('citizen.')] + [f for f in main_frames if f.key.startswith('rank.')]
               + [by['shadow']], os.path.join(OUT_SHEETS, 'units_citizens_rank.png'), cols=8)
    draw_sheet([f for f in main_frames if f.key.startswith('proj.')], os.path.join(OUT_SHEETS, 'units_proj.png'), cols=8)
    draw_sheet([f for f in main_frames if f.key.startswith('fx.')], os.path.join(OUT_SHEETS, 'units_fx.png'), cols=6)
    for k in range(0, len(pose_list), 36):
        draw_sheet(pose_list[k:k + 36], os.path.join(OUT_SHEETS, f'units_poses_{k // 36 + 1}.png'), cols=6)


def main():
    import_packs()
    rec = Recorder()
    rec.install()
    heroes = {}
    try:
        for cid in CARD_IDS:
            ev, lg = rec.run(cid)
            heroes[cid] = find_hero(cid, ev, lg, HERO_OVERRIDE.get(cid))
    finally:
        rec.uninstall()
    missing = [c for c in CARD_IDS if heroes[c] is None]
    if missing:
        raise SystemExit(f'kein Held gefunden fuer {missing}')
    main_frames, pose_list = build_frames(heroes)
    frames = main_frames + pose_list
    keys = [f.key for f in frames]
    assert len(keys) == len(set(keys)), 'doppelte Schluessel'
    pos, height = pack(frames)
    os.makedirs(OUT_ASSETS, exist_ok=True)
    img_a = render_atlas(frames, pos, height)
    img_b = render_atlas(frames, pos, height, team_b=True)
    for name, im in (('units_a.png', img_a), ('units_b.png', img_b)):
        bad = palette_violations(im)
        a = np.array(im)[:, :, 3]
        assert bad == 0, f'{name}: {bad} Farben ausserhalb der Master-Palette'
        assert set(np.unique(a).tolist()) <= {0, 255}, f'{name}: Teiltransparenz'
        im.save(os.path.join(OUT_ASSETS, name))
    write_json(os.path.join(OUT_ASSETS, 'units.json'), frames, pos)
    sheets(main_frames, pose_list)
    if SNAPPED:
        print('Palette-Notnagel angewendet bei:', sorted(set(SNAPPED)))
    n_hero = sum(1 for f in main_frames if f.key[:2] in ('UA', 'US', 'UV', 'UZ'))
    print(f'{len(frames)} Rahmen ({n_hero} Helden-Rahmen, {len(pose_list)} Posen-Rahmen), Atlas {ATLAS_W} x {height}')


if __name__ == '__main__':
    main()
