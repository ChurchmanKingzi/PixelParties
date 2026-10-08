"""Exporter: Raum-Innenansichten fuer den spielbaren Prototyp (game/public/assets/rooms.png + rooms.json).

Aufruf (aus art/):  python3 -I export_game_rooms.py

Fuer jede der 39 Raum-Karten (daten/cards.json, bauart == 'raum') entsteht je Ausrichtung ein Sprite aus Boden + Moebeln
(ohne Waende, Tueren, Wanddeko, Personen, Einheiten). Der Sprite deckt genau die Modulflaeche ab (cols*32 x rows*32, Anker 0,0).
Rechteckige Raeume bekommen beide Ausrichtungen (<ID>@3x2 und <ID>@2x3; das gedrehte Modul wird neu eingerichtet, kein gedrehtes
Bitmap), quadratische nur einen Schluessel. Plattform-Raeume tragen zusaetzlich "slots" (Geschuetzplaetze, modulrelativ).

Vorgehen
  1. Die Themes (Boden + furnish-Funktion) werden aus den Dioramen der Karten ausgelesen: mini_castle wird dazu in cards_art und in allen
     Packs ersetzt, der erste Aufruf je Karte wird protokolliert und abgebrochen, danach alles zurueckgesetzt. Die ersten fuenf Raeume
     (K, S, W, B, Z) nutzen die eingebauten Buchstaben (hier kopiert, ohne Wanddeko), BP-06 hat im Diorama kein Theme (eigenes unten).
  2. furnish(ctx) laeuft gegen einen Aufnahme-Kontext (RecCtx): Wanddeko (ctx.decor, Zeichenaufrufe auf Wandhoehe) entfaellt, Moebel und
     Bodendekor werden als Ops mitgeschrieben. Danach wird wie mini_castle ohne draw_walls/wall_shadows zusammengesetzt (Boden -50,
     Bodendekor -49, Moebel y + h + key_add) und die Modulflaeche ausgegeben.
  3. Moebel, die ueber die Nordkante ragen (Schrank, Regale), werden samt ihrer Gruppe nach unten ins Modul geschoben, statt abgeschnitten
     zu werden. Fuer das gedrehte Modul gilt, in dieser Reihenfolge: (a) die furnish-Funktion des Themes mit dem gedrehten Mass, wenn
     sie ohne Verschiebung, Abschneiden oder neue Ueberlappung aufgeht; (b) die Moebelgruppen der Grundausrichtung mit gespiegelten
     Mitten neu eingepasst; (c) eine Handeinrichtung (MANUAL) mit denselben Sprites; (d) nur Boden. Methode je Frame steht im Vorschaubild.
Reihenfolge, Zufall und Dateien sind deterministisch (zwei Laeufe liefern byte-identische Dateien).
"""
from __future__ import annotations

import glob
import importlib
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
sys.path.insert(0, HERE)

from pixl import Canvas, World, RAMPS, palette_violations, label_font, hexrgb, round_rect   # noqa: E402
import cards_art                                                                                    # noqa: E402
from castle import FloorTiles, CELL, T                                                               # noqa: E402

OUT_DIR = os.path.join(ROOT, 'game', 'public', 'assets')
SHEET_DIR = os.path.join(HERE, 'out', 'game_assets')
ATLAS_W = 1024                      # Atlasbreite (Vorgabe: hoechstens 2048)
PAD = 1                             # transparenter Rand zwischen Frames
SCALE = 3                           # Vorschau-Kontaktbogen


# =========================================================================== Katalog


def load_rooms():
    """alle Karten mit bauart == 'raum' in Dateireihenfolge: [(id, name_en, cols, rows)]"""
    cards = json.load(open(os.path.join(ROOT, 'daten', 'cards.json'), encoding='utf-8'))
    rooms = []
    for c in cards:
        if c.get('bauart') != 'raum':
            continue
        cols, rows = (int(v) for v in c['masse'].replace('x', '×').split('×'))
        rooms.append((c['id'], c['name_en'], cols, rows))
    return rooms


# =========================================================================== Themes aus den Dioramen auslesen


class _Stop(Exception):
    pass


def load_packs():
    """importiert alle art/pack_*.py (wie cards.main), sie tragen ihre Dioramen in cards_art.ART ein"""
    for f in sorted(glob.glob(os.path.join(HERE, 'pack_*.py'))):
        importlib.import_module(os.path.basename(f)[:-3])


def record_diorama_calls(card_ids):
    """Ruft ART[id]() mit ersetztem mini_castle auf und liest den ersten Aufruf: {id: dict(rows, themes)}.
    Der Aufruf wird sofort abgebrochen; das Original wird in allen Modulen wiederhergestellt."""
    orig = cards_art.mini_castle
    seen = []

    def fake(rows, ox, oy, world, team='teamA', gates=(), tw=None, themes=None):
        seen.append({'rows': list(rows), 'themes': themes})
        raise _Stop()

    patched = [m for n, m in sorted(sys.modules.items())
               if m is not None and (n == 'cards_art' or n.startswith('pack_')) and getattr(m, 'mini_castle', None) is orig]
    out = {}
    try:
        for m in patched:
            m.mini_castle = fake
        for cid in card_ids:
            seen.clear()
            fn = cards_art.ART.get(cid)
            if fn is None:
                out[cid] = None
                continue
            try:
                fn()
            except _Stop:
                pass
            out[cid] = seen[0] if seen else None
    finally:
        for m in patched:
            m.mini_castle = orig
    return out


# =========================================================================== Moebel aufnehmen (statt direkt zeichnen)

VIRT = 32               # virtueller Modulursprung: wie in den Dioramen (Plan mit 1 Zelle Rand), damit die Tiefenschluessel gleich bleiben


class Op:
    """eine Zeichenoperation eines Moduls in modulrelativen Pixeln: kind = 'prop' | 'floor' | 'shadow'"""
    __slots__ = ('kind', 'spr', 'x', 'y', 'key_add', 'flip', 'args')

    def __init__(self, kind, spr=None, x=0, y=0, key_add=0, flip=False, args=()):
        self.kind, self.spr, self.x, self.y, self.key_add, self.flip, self.args = kind, spr, int(x), int(y), key_add, flip, args

    def copy(self):
        return Op(self.kind, self.spr, self.x, self.y, self.key_add, self.flip, self.args)


class _RecWorld:
    """`ctx.world` der Aufnahme: Zeichenaufrufe auf Wandhoehe (Wanddeko) werden verworfen, alles andere ist Wandbau und wird ebenfalls
    ignoriert (kommt nur im Geschuetzdeck vor: Schanzkleid statt Steinwaenden)"""

    def draw(self, sprite, x, y, key, flip=False):
        return None

    def __getattr__(self, name):
        raise AttributeError(f'ctx.world.{name} wird im Innenraum-Export nicht unterstuetzt')


class RecCtx:
    """Aufnahme-Kontext fuer furnish(ctx): gleiche Schnittstelle wie castle.FurnishCtx, schreibt aber nur Ops mit.
    decor() (Wanddeko) wird verworfen; platform() sammelt Geschuetzplaetze (modulrelativ)."""

    def __init__(self, W, H, door='S'):
        self.X0 = self.Y0 = VIRT
        self.W, self.H = W, H
        self.P = cards_art.props_for('teamA')
        self.door_side = door
        self.north_door = door == 'N'
        self.wall_base = VIRT + T // 2
        self.world = _RecWorld()
        self.ops, self.slots = [], []

    def decor(self, spr, cx):
        pass

    def prop(self, spr, x, y, key_add=0, flip=False):
        self.ops.append(Op('prop', spr, int(x) - VIRT, int(y) - VIRT, key_add, flip))

    def floor_deco(self, spr, x, y):
        self.ops.append(Op('floor', spr, int(x) - VIRT, int(y) - VIRT))

    def platform(self, x, y):
        self.slots.append((int(x) - VIRT, int(y) - VIRT))

    def shadow(self, cx, cy, rx, ry):
        """Bodenschatten (scenekit.shadow) unter einem schwebenden Objekt; Mitte modulrelativ"""
        self.ops.append(Op('shadow', args=(int(cx), int(cy), rx, ry)))


class _Swap:
    """ersetzt waehrend der Aufnahme Sprite-Funktionen eines Packs (z. B. 'AR.apprentice' -> None = weglassen)"""

    def __init__(self, furnish, swaps):
        self.todo = []
        for name, repl in (swaps or {}).items():
            if '.' in name:
                head, attr = name.split('.')
                self.todo.append((furnish.__globals__[head].__dict__, attr, repl))
            else:
                self.todo.append((furnish.__globals__, name, repl))
        self.saved = []

    def __enter__(self):
        for d, k, repl in self.todo:
            self.saved.append((d, k, d[k]))
            d[k] = (lambda *a, **kw: _EMPTY) if repl is None else repl
        return self

    def __exit__(self, *exc):
        for d, k, old in reversed(self.saved):
            d[k] = old
        return False


_EMPTY = Canvas(1, 1)                                         # vollstaendig transparent: zeichnet nichts


def capture(spec, W, H, door='S'):
    """furnish-Funktion des Raums mit Modulmass W x H (px) aufrufen; liefert (Ops ohne leere Sprites, Geschuetzplaetze)"""
    ctx = RecCtx(W, H, door)
    with _Swap(spec['furnish'], spec.get('swaps')):
        spec['furnish'](ctx)
        if spec.get('extra'):
            spec['extra'](ctx, spec['furnish'].__globals__)
    # leere Sprites und Moebel, die in mini_castle nie sichtbar waeren (Tiefenschluessel unter dem Boden, z. B. key_add=-200 der
    # Teppiche in K und W), entfallen
    ops = [op for op in ctx.ops
           if op.spr is not _EMPTY and not (op.kind == 'prop' and VIRT + op.y + op.spr.h + op.key_add < -50)]
    return ops, list(ctx.slots)


# =========================================================================== Layout-Werkzeuge (Einpassen, Gruppen, Konflikte)

_MET = {}


def met(spr):
    """(Sprite, Alphamaske, sichtbare Box (x0, y0, x1, y1), Zahl sichtbarer Pixel); Cache haelt den Sprite fest (id-Wiederverwendung)"""
    m = _MET.get(id(spr))
    if m is None or m[0] is not spr:
        a = spr.px[:, :, 3] > 0
        ys, xs = np.nonzero(a)
        box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1) if len(xs) else (0, 0, 0, 0)
        m = (spr, a, box, int(a.sum()))
        _MET[id(spr)] = m
    return m


def obox(op):
    """sichtbare Box des Sprites in Modulkoordinaten (flip beruecksichtigt)"""
    _, _, (x0, y0, x1, y1), _ = met(op.spr)
    if op.flip:
        x0, x1 = op.spr.w - x1, op.spr.w - x0
    return (op.x + x0, op.y + y0, op.x + x1, op.y + y1)


def _mask(op):
    a = met(op.spr)[1]
    return a[:, ::-1] if op.flip else a


def rect_inter(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    return (w, h) if w > 0 and h > 0 else (0, 0)


def union_box(boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def group_props(props):
    """Moebel, deren sichtbare Boxen sich ueberlappen (Krug auf Tresen, Schwein auf Altar), bilden eine starre Gruppe"""
    parent = list(range(len(props)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    boxes = [obox(p) for p in props]
    for i in range(len(props)):
        for j in range(i + 1, len(props)):
            if rect_inter(boxes[i], boxes[j]) != (0, 0):
                parent[find(i)] = find(j)
    out = {}
    for i in range(len(props)):
        out.setdefault(find(i), []).append(props[i])
    return [out[k] for k in sorted(out)]


def gbox(group):
    return union_box([obox(p) for p in group])


def shift(items, dx, dy):
    for p in items:
        p.x += dx
        p.y += dy


def fit_item(items, W, H):
    """verschiebt eine Gruppe von Ops (oder ein einzelnes Op) minimal ins Modul, sofern sie hineinpasst; gibt (dx, dy, passt) zurueck"""
    items = items if isinstance(items, list) else [items]
    x0, y0, x1, y1 = union_box([obox(p) for p in items])
    dx = dy = 0
    fits = (x1 - x0) <= W and (y1 - y0) <= H
    if x1 - x0 <= W:
        dx = -x0 if x0 < 0 else (W - x1 if x1 > W else 0)
    if y1 - y0 <= H:
        dy = -y0 if y0 < 0 else (H - y1 if y1 > H else 0)
    shift(items, dx, dy)
    return dx, dy, fits


def foot_box(op, fh=10):
    x0, y0, x1, y1 = obox(op)
    return (x0 + 2, max(y0, y1 - fh), x1 - 2, y1)


def conflict(a, b):
    """True, wenn zwei Moebel sich schlecht ueberlappen: Standflaechen schneiden sich oder mehr als 40 % des kleineren Sprites liegen
    aufeinander"""
    fw, fh = rect_inter(foot_box(a), foot_box(b))
    if fw >= 2 and fh >= 2:
        return True
    ba, bb = obox(a), obox(b)
    if not rect_inter(ba, bb)[0]:
        return False
    ma, mb = _mask(a), _mask(b)
    # Schnittflaeche in Sprite-Koordinaten beider Moebel
    ix0, iy0 = max(ba[0], bb[0]), max(ba[1], bb[1])
    ix1, iy1 = min(ba[2], bb[2]), min(ba[3], bb[3])
    sa = ma[iy0 - a.y:iy1 - a.y, ix0 - a.x:ix1 - a.x]
    sb = mb[iy0 - b.y:iy1 - b.y, ix0 - b.x:ix1 - b.x]
    n = int((sa & sb).sum())
    return n > 0.4 * min(met(a.spr)[3], met(b.spr)[3])


def group_conflicts(groups):
    """Paare (i, j) von Gruppen mit schlechter Ueberlappung"""
    out = []
    for i in range(len(groups)):
        for j in range(i + 1, len(groups)):
            if any(conflict(a, b) for a in groups[i] for b in groups[j]):
                out.append((i, j))
    return out


def separate(groups, W, H, iters=60):
    """schiebt Gruppen mit Konflikt auseinander (kleinste Verschiebung, die im Modul bleibt); gibt True zurueck, wenn konfliktfrei"""
    for _ in range(iters):
        bad = group_conflicts(groups)
        if not bad:
            return True
        i, j = bad[0]
        best = None
        for gi in (j, i):
            g = groups[gi]
            x0, y0, x1, y1 = gbox(g)
            for (dx, dy) in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                for step in range(1, 40):
                    mx, my = dx * step, dy * step
                    if x0 + mx < 0 or y0 + my < 0 or x1 + mx > W or y1 + my > H:
                        break
                    shift(g, mx, my)
                    clash = any(conflict(a, b) for k, h in enumerate(groups) if k != gi for a in g for b in h)
                    shift(g, -mx, -my)
                    if not clash:
                        cost = step + (0 if gi == j else 2)
                        if best is None or cost < best[0]:
                            best = (cost, gi, mx, my)
                        break
        if best is None:
            return False
        shift(groups[best[1]], best[2], best[3])
    return not group_conflicts(groups)


def clone(ops):
    return [op.copy() for op in ops]


# =========================================================================== Zusammensetzen (mini_castle ohne Waende)


def compose(tile, ops, W, H):
    """Boden (Kachel 32 x 32 wiederholt) + Ops im Tiefenpuffer wie in mini_castle (Boden -50, Bodendekor -49, Moebel y + h + key_add)"""
    from scenekit import shadow
    world = World(W, H)
    world.px[:, :, :3] = np.tile(tile, (H // CELL, W // CELL, 1))
    world.depth[:] = -50
    for op in ops:
        if op.kind == 'prop':
            world.draw(op.spr, op.x, op.y, int(op.y + VIRT + op.spr.h) + op.key_add, op.flip)
        elif op.kind == 'floor':
            world.draw(op.spr, op.x, op.y, -49)
        elif op.kind == 'shadow':
            shadow(world, *op.args)
    return world.px[:, :, :3].copy()


def _furnish_builtin(ctx, L):
    """Einrichtung der eingebauten Raumbuchstaben K, S, W, B, Z (Kopie aus castle.Castle._furnish, ohne Wanddeko)"""
    P, X0, Y0, W, Hh = ctx.P, ctx.X0, ctx.Y0, ctx.W, ctx.H
    prop = ctx.prop
    if L == 'K':
        for i in range(3):
            prop(P['bed'], X0 + 12 + i * 28, Y0 + 12)
        prop(P['herb_table'], X0 + 14, Y0 + Hh - 24)
        prop(P['plant'], X0 + W - 22, Y0 + Hh - 26)
        prop(P['rug'], X0 + W // 2 - 18, Y0 + Hh - 22, key_add=-200)
    elif L == 'S':
        prop(P['anvil'], X0 + W // 2 - 11, Y0 + 28)
        prop(P['barrel'], X0 + 10, Y0 + Hh - 24)
        prop(P['trough'], X0 + W - 34, Y0 + Hh - 22)
        prop(P['crate'], X0 + 40, Y0 + Hh - 22)
    elif L == 'W':
        prop(P['bed'], X0 + 14, Y0 + 12)
        prop(P['bed'], X0 + 44, Y0 + 12)
        prop(P['chest'], X0 + W - 28, Y0 + Hh - 22)
        prop(P['rug'], X0 + 14, Y0 + Hh - 26, key_add=-200)
    elif L == 'B':
        for i in range(3):
            prop(P['bunk'], X0 + 10 + i * 24, Y0 + 12)
        prop(P['rack'], X0 + W - 34, Y0 + Hh - 26)
    elif L == 'Z':
        prop(P['crate'], X0 + 8, Y0 + Hh - 20)
        prop(P['crate'], X0 + W - 24, Y0 + Hh - 20)
        ctx.platform(X0 + W // 2, Y0 + Hh // 2 + 8)


BUILTIN = {'BH-01': 'K', 'BW-01': 'S', 'BU-01': 'W', 'BF-01': 'B', 'BP-01': 'Z'}     # erste Charge: eingebaute Buchstaben


def make_specs(rooms, rec):
    """{id: spec} mit spec = {'letter', 'tile' (32x32x3), 'furnish' (fn(ctx)), 'swaps'}"""
    tiles = FloorTiles()
    specs = {}
    for cid, name, cols, rows in rooms:
        if cid in BUILTIN:
            L = BUILTIN[cid]
            specs[cid] = {'letter': L, 'tile': tiles.floor(L, 0, 0), 'furnish': (lambda ctx, L=L: _furnish_builtin(ctx, L))}
            continue
        r = rec.get(cid)
        if r is None:
            continue                                   # eigenes Theme in CUSTOM
        th_all = r['themes']
        L = next(k for k in th_all if any(k in row for row in r['rows']))
        th = th_all[L]
        n = sum(row.count(L) for row in r['rows'])
        if n != cols * rows:
            print(f'WARNUNG: {cid}: Diorama-Modul hat {n} Zellen, Katalog {cols}x{rows}', file=sys.stderr)
        tile = th['floor'] if th.get('floor') is not None else tiles.floor(L, 0, 0)
        specs[cid] = {'letter': L, 'tile': np.asarray(tile, np.uint8), 'furnish': th['furnish'], 'swaps': SWAPS.get(cid),
                      'extra': EXTRAS.get(cid)}
    specs.update({cid: sp for cid, sp in CUSTOM.items() if any(r[0] == cid for r in rooms)})
    return specs


# --- Sprite-Austausch: Personen, die die Themes in Moebel einbauen, kommen im Spiel als Einheiten (Posten, Patienten) und fehlen im Innenraum
def tooth_chair_empty():
    """Zahnarztstuhl aus pack_art8_chars.tooth_patient_chair ohne den Patienten (Kopie des Stuhlteils, 36 x 40)"""
    c = Canvas(36, 40)
    round_rect(c, 10, 35, 25, 39, 'metal', lo=0, hi=3, radius=2)
    c.rect(16, 31, 20, 36, 'metal', 2)
    c.rect(16, 31, 16, 36, 'metal', 4)
    c.rect(20, 31, 20, 36, 'metal', 1)
    round_rect(c, 8, 8, 28, 29, 'teamA', lo=1, hi=4, radius=4)
    round_rect(c, 11, 0, 25, 9, 'teamA', lo=2, hi=5, radius=3)
    for y in range(11, 28, 4):
        for x in range(10, 27):
            c.put_ramp(x, y, 'teamA', 2)
    for y in range(2, 28):
        c.put_ramp(9, y, 'teamA', 5)
    round_rect(c, 3, 26, 32, 33, 'teamA', lo=1, hi=4, radius=3)
    for x in range(4, 31):
        c.put_ramp(x, 26, 'teamA', 5 if x < 14 else 4)
    c.rect(1, 20, 6, 22, 'metal', 4)
    c.rect(1, 20, 6, 20, 'metal', 5)
    c.rect(29, 20, 34, 22, 'metal', 3)
    c.rect(2, 22, 3, 30, 'metal', 2)
    c.rect(31, 22, 32, 30, 'metal', 1)
    c.outline()
    return c


def armchair_empty():
    """Ohrensessel aus pack_art9_crypt.armchair_reader ohne das lesende Skelett (Kopie des Sesselteils, 36 x 36)"""
    c = Canvas(36, 36)
    round_rect(c, 3, 4, 28, 30, 'cloth', lo=0, hi=3, radius=4)
    round_rect(c, 0, 14, 7, 32, 'cloth', lo=0, hi=3, radius=2)
    round_rect(c, 25, 14, 32, 32, 'cloth', lo=0, hi=2, radius=2)
    for y in (10, 18, 26):
        for x in range(8, 24):
            if (x + y) % 4 == 0:
                c.put_ramp(x, y, 'cloth', 1)
    round_rect(c, 6, 26, 26, 33, 'cloth', lo=1, hi=4, radius=2)
    c.rect(7, 33, 25, 33, 'cloth', 0)
    c.outline()
    return c


SWAPS = {
    'BH-05': {'tooth_patient_chair': tooth_chair_empty},       # Stuhl ohne grinsenden Patienten
    'BF-02': {'AR.apprentice': None},                          # Zauberlehrling neben der Kristallkugel
    'BF-05': {'CR.armchair_reader': armchair_empty},           # Sessel ohne lesendes Skelett
    'BF-06': {'IC.penguin_clerk': None},                       # Pinguin am Empfang
    'BU-08': {'spr_clerk': None},                              # Werber am Schreibtisch
    'BP-02': {'ship_cannon': None},                            # Zierkanone auf dem ersten Platz: dort steht im Spiel die Artillerie
}


# =========================================================================== Ausrichtungen


class Layout:
    """Ergebnis einer Einrichtung: Ops, Geschuetzplaetze, Methode, Messwerte"""

    def __init__(self, ops, slots, method, info=None):
        self.ops, self.slots, self.method, self.info = ops, slots, method, info or {}


def _props(ops):
    return [op for op in ops if op.kind == 'prop']


def pair_conflicts(ops):
    """Indexpaare der Moebel (in Aufnahmereihenfolge) mit schlechter Ueberlappung"""
    props = _props(ops)
    return {(i, j) for i in range(len(props)) for j in range(i + 1, len(props)) if conflict(props[i], props[j])}


def settle(ops, W, H):
    """Moebel ins Modul bringen: Gruppen (Moebel mit ueberlappenden Boxen) und Bodendekor werden minimal verschoben, bis sie ganz im
    Modul liegen (Moebel an der Nordwand sitzen dann oben im Sprite, statt abgeschnitten zu werden). Passt eine Gruppe nicht, wird
    jedes Moebel einzeln eingepasst. Gibt Messwerte zurueck."""
    groups = group_props(_props(ops))
    unfit, mx, my = 0, 0, 0
    for g in groups:
        dx, dy, fits = fit_item(g, W, H)
        if not fits:
            for p in g:
                _, _, f1 = fit_item(p, W, H)
                unfit += 0 if f1 else 1
        mx, my = max(mx, abs(dx)), max(my, abs(dy))
    for op in ops:
        if op.kind == 'floor':
            fit_item(op, W, H)
    return {'unfit': unfit, 'move_x': mx, 'move_y': my, 'groups': len(groups), 'props': len(_props(ops))}


def judge(layout, base=None, strict=True):
    """Messwerte vervollstaendigen: neue schlechte Ueberlappungen gegenueber der Grundeinrichtung `base` (dort gewollte Ueberlappungen
    wie Krug auf Tresen zaehlen nicht); good = alles im Modul, keine neuen Konflikte, Moebel kaum verschoben"""
    pc = pair_conflicts(layout.ops)
    old = pair_conflicts(base.ops) if base is not None else set()
    layout.info['conflicts'] = len(pc - old)
    layout.info['conflicts_total'] = len(pc)
    i = layout.info
    ok = i['unfit'] == 0 and i['conflicts'] == 0
    if strict and layout.method == 'native' and base is not None:
        ok = ok and i['move_x'] <= 10 and i['move_y'] <= 24
    layout.good = ok
    return layout


def native_layout(spec, cols, rows, base=None):
    W, H = cols * CELL, rows * CELL
    ops, slots = capture(spec, W, H)
    info = settle(ops, W, H)
    return judge(Layout(ops, slots, 'native', info), base)


def adapted_layout(base, W, H):
    """Neuaufbau fuer das gedrehte Modul aus der Einrichtung `base` (Modul H x W): die Moebel-Gruppen behalten ihre Sprites
    (nichts wird gedreht), ihre Mitten werden gespiegelt (x, y) -> (y, x) und danach eingepasst/entzerrt"""
    ops = clone(base.ops)
    groups = group_props(_props(ops))
    for g in groups:
        x0, y0, x1, y1 = gbox(g)
        cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
        shift(g, int(round(cy - cx)), int(round(cx - cy)))          # neue Mitte (cy, cx)
    for op in ops:
        if op.kind == 'floor':
            x0, y0, x1, y1 = obox(op)
            cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
            op.x += int(round(cy - cx))
            op.y += int(round(cx - cy))
    info = settle(ops, W, H)
    separate(groups, W, H)
    slots = [(y, x) for (x, y) in base.slots]
    return judge(Layout(ops, slots, 'adapted', info), base)


def manual_layout(base, items, W, H, slots=None):
    """Handeinrichtung: items = [(Op-Index der Grundeinrichtung, x, y)] (linke obere Ecke); nicht genannte Ops entfallen"""
    ops = []
    for (i, x, y) in items:
        op = base.ops[i].copy()
        op.x, op.y = x, y
        ops.append(op)
    info = {'unfit': 0, 'move_x': 0, 'move_y': 0, 'groups': 0, 'props': len(_props(ops))}
    for op in ops:
        if op.kind == 'prop':
            x0, y0, x1, y1 = obox(op)
            if x0 < 0 or y0 < 0 or x1 > W or y1 > H:
                info['unfit'] += 1
    return judge(Layout(ops, list(slots if slots is not None else base.slots), 'manual', info), base)


def floor_layout(slots=()):
    lay = Layout([], list(slots), 'floor', {'conflicts': 0, 'unfit': 0})
    lay.good = True
    return lay


# =========================================================================== Ergaenzungen der Dioramen und eigene Themes

def extra_foundry(ctx, G):
    """BW-05: die Waescheleine zwischen den Pfosten samt Kanonenrohren (im Diorama nachtraeglich gezeichnet) gehoert zur Einrichtung"""
    dc = G['drying_cannon']
    ctx.prop(dc(1), ctx.X0 + 64, ctx.Y0 + 6, key_add=100)
    ctx.prop(dc(0), ctx.X0 + 60, ctx.Y0 + 26, key_add=100)


def extra_hammer(ctx, G):
    """BW-11: das Theme besteht nur aus Wanddeko; der Riesenhammer (Diorama) ist die Einrichtung: schwebt ueber seinem Schatten"""
    hm = G['TC'].giant_hammer(50, 84)
    ctx.shadow(ctx.W // 2, 88, 17, 4)
    ctx.prop(hm, ctx.X0 + (ctx.W - hm.w) // 2, ctx.Y0, key_add=60)


EXTRAS = {'BW-05': extra_foundry, 'BW-11': extra_hammer}


def floor_floating(seed=61):
    """Felsboden der Schwebenden Festung: Steinplatten mit Mooszwickeln (32 x 32, kachelbar)"""
    from assets_env import tile_cobble
    from pixl import texture_noise
    px = tile_cobble(seed, 32, base='stone', tone=(2, 3), mortar=1, hi=4).px[:, :, :3].copy()
    for y in range(32):
        for x in range(32):
            n = texture_noise(x, y, seed + 5)
            if n > 0.84:
                px[y, x] = RAMPS['grass'][3 if (x + y) % 2 else 2]
            elif n > 0.80:
                px[y, x] = RAMPS['grass'][1]
    return px


def crystal_pad():
    """Geschuetzplatz auf der Felsinsel: Steinring mit Kristalleinlage, Draufsicht (Bodendekor, 24 x 24, ohne Outline)"""
    import math
    c = Canvas(24, 24)
    cx = cy = 11.5
    for y in range(24):
        for x in range(24):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d > 11.6:
                continue
            lit = (-dx - dy) / (d + 0.01)
            if d > 10.3:
                c.put_ramp(x, y, 'stone', 0)
            elif d > 7.9:
                c.put_ramp(x, y, 'stone', 5 if lit > 0.3 else (4 if lit > -0.4 else 3))
            elif d > 7.0:
                c.put_ramp(x, y, 'stone', 1)
            else:
                idx = 4 if lit > 0.55 else (3 if lit > -0.35 else 2)
                if d > 5.2 and (x + y) % 2 == 0:
                    idx = min(5, idx + 1)
                c.put_ramp(x, y, 'ice', idx)
    for k in range(-5, 6):
        if abs(k) > 1:
            c.put_ramp(12 + k, 12, 'ice', 5)
            c.put_ramp(11 + k, 11, 'ice', 1)
            c.put_ramp(12, 12 + k, 'ice', 5)
            c.put_ramp(11, 11 + k, 'ice', 1)
    for (x, y) in ((11, 11), (12, 11), (11, 12), (12, 12)):
        c.put_ramp(x, y, 'gold', 5 if (x + y) % 2 else 4)
    return c


def pond():
    """kleiner Teich mit Steinrand: Quelle des aufwaerts fliessenden Wasserfalls (Bodendekor, 32 x 18)"""
    from pixl import ellipse
    c = Canvas(32, 18)
    ellipse(c, 15.5, 9.5, 15.5, 8.5, 'stone', lo=1, hi=5)
    ellipse(c, 15.5, 9.5, 13.2, 6.4, 'ice', lo=2, hi=5, ambient=0.3)
    for (x, y) in ((8, 8), (9, 8), (20, 11), (21, 11), (14, 6), (15, 6), (24, 7)):
        c.put_ramp(x, y, 'bone', 5)
    return c


def furnish_floating(ctx):
    """BP-06 Schwebende Festung (Raum 3x3, kein Theme im Diorama: Felsinsel als Seitenansicht): Felsplatte mit vier Geschuetzplaetzen"""
    from pack_art8_props import crystal_cluster
    X0, Y0, W, H = ctx.X0, ctx.Y0, ctx.W, ctx.H
    ctx.floor_deco(pond(), X0 + (W - 32) // 2, Y0 + 6)
    pad = crystal_pad()
    for (px, py) in ((W // 2 - 20, 40), (W // 2 + 20, 40), (W // 2 - 20, 74), (W // 2 + 20, 74)):
        ctx.floor_deco(pad, X0 + px - 12, Y0 + py - 12)
        ctx.platform(X0 + px, Y0 + py)
    ctx.prop(crystal_cluster('ice'), X0 + 4, Y0 + 2)
    ctx.prop(crystal_cluster('purple'), X0 + W - 22, Y0 + 4)
    ctx.prop(cards_art.rock(2), X0 + W // 2 - 10, Y0 + H - 22)


CUSTOM = {'BP-06': {'letter': 'F', 'tile': floor_floating(), 'furnish': furnish_floating}}


# --- Handeinrichtungen fuer das gedrehte Modul 2 x 3 (64 x 96 px), wenn weder die Einrichtung des Themes (zu breit angelegt) noch ihre
#     gespiegelte Neuaufbereitung brauchbar ist. Eintraege: (Op-Index der Aufnahme in Aufrufreihenfolge, x, y) = linke obere Ecke; die
#     Sprites sind die des Themes (nichts wird gedreht oder neu gemalt), nur ihre Plaetze sind neu.
MANUAL = {
    # --- Grundausrichtung: Moebel an der Nordwand sitzen ohne Ueberdeckung oben im Sprite
    ('BF-08', 3, 2): [(0, 13, 20), (1, 6, 38), (2, 60, 38), (3, 66, 0), (4, 3, 20), (5, 13, 24), (6, 76, 44)],
    ('BP-02', 3, 2): [(0, 10, 36), (1, 36, 36), (2, 62, 36), (3, 31, 0), (4, 70, 5), (5, 6, 7), (6, 24, 14)],
    # --- gedrehtes Modul 2 x 3
    ('BH-01', 2, 3): [(0, 6, 6), (1, 6, 34), (2, 6, 62), (3, 30, 44), (4, 44, 16)],
    ('BW-01', 2, 3): [(0, 21, 18), (1, 8, 44), (3, 38, 50), (2, 21, 78)],
    ('BW-02', 2, 3): [(3, 14, 42), (0, 2, 2), (1, 34, 2), (2, 18, 48)],
    ('BW-05', 2, 3): [(3, 19, 50), (2, 9, 2), (0, 6, 54), (1, 34, 54), (4, 8, 55), (5, 6, 75)],
    ('BW-08', 2, 3): [(2, 10, 50), (0, 4, 0), (1, 34, 0), (3, 6, 36), (4, 28, 58)],
    ('BW-09', 2, 3): [(0, 23, 10), (1, 23, 2), (3, 44, 12), (4, 4, 14), (2, 2, 58), (5, 34, 78)],
    ('BW-10', 2, 3): [(1, 14, 6), (0, 30, 46), (3, 6, 44), (2, 22, 76)],
    ('BF-05', 2, 3): [(0, 12, 6), (1, 22, 24), (2, 6, 4), (3, 38, 6), (5, 25, 30), (4, 14, 58)],
    ('BF-06', 2, 3): [(0, 20, 70), (1, 3, 0), (2, 36, 2), (3, 6, 38), (4, 4, 78), (5, 38, 82)],
    ('BU-02', 2, 3): [(4, 14, 64), (0, 6, 12), (1, 17, 4), (2, 4, 36), (3, 26, 40), (5, 16, 66), (6, 52, 78)],
    ('BU-11', 2, 3): [(0, 9, 44), (1, 4, 4), (2, 46, 4)],
    ('BC-04', 2, 3): [(2, -12, 34), (0, 3, 4), (1, 43, 4), (3, 10, 40)],
    ('BC-07', 2, 3): [(0, 6, 52), (1, 10, 10)],
    ('BC-08', 2, 3): [(0, 0, 34), (1, 10, 20), (2, 38, 20), (3, 9, 36)],
    ('BP-02', 2, 3): [(0, 36, 10), (1, 36, 40), (2, 36, 70), (3, 2, 2), (5, 4, 52), (6, 22, 56), (4, 6, 74)],
}
# Geschuetzplaetze (Mitte, modulrelativ), wo sie von dem abweichen, was platform() des Themes meldet
SLOTS = {
    ('BP-01', 3, 2): [(28, 40), (68, 40)],          # Katalog: 2 Geschuetzplaetze (das eingebaute Z meldet nur einen)
    ('BP-01', 2, 3): [(32, 26), (32, 62)],
    ('BP-02', 3, 2): [(22, 48), (48, 48), (74, 48)],
    ('BP-02', 2, 3): [(48, 22), (48, 52), (48, 82)],
}
# Erzwungene Methode je Ausrichtung ('native' | 'adapted' | 'manual' | 'floor'), wenn die Automatik nicht reicht
FORCE = {}


# =========================================================================== Raeume bauen, Atlas, Vorschau


def build_room(cid, cols, rows, spec):
    """alle Ausrichtungen eines Raums: [(Schluessel, Layout, W, H, Geschuetzplaetze)]; die Grundausrichtung (Katalogmass) zuerst"""
    out = []
    prim = native_layout(spec, cols, rows)
    W, H = cols * CELL, rows * CELL
    if (cid, cols, rows) in MANUAL:
        lay = manual_layout(prim, MANUAL[(cid, cols, rows)], W, H)
    else:
        lay = prim
    out.append((f'{cid}@{cols}x{rows}', lay, W, H, SLOTS.get((cid, cols, rows), lay.slots)))
    if cols != rows:
        rc, rr = rows, cols
        W2, H2 = rc * CELL, rr * CELL
        key = (cid, rc, rr)
        force = FORCE.get(key)
        if key in MANUAL and force in (None, 'manual'):
            lay2 = manual_layout(prim, MANUAL[key], W2, H2)
        else:
            a = native_layout(spec, rc, rr, base=prim)
            b = adapted_layout(prim, W2, H2)
            if force == 'floor':
                lay2 = floor_layout(a.slots)
            elif force == 'adapted' or (force is None and not a.good and b.good):
                lay2 = b
            elif force == 'native' or (force is None and a.good):
                lay2 = a
            else:
                lay2 = floor_layout(a.slots)
        out.append((f'{cid}@{rc}x{rr}', lay2, W2, H2, SLOTS.get(key, lay2.slots)))
    return out


def pack_atlas(frames):
    """Regalpackung: hoechste Frames zuerst, 1 px Rand; Breite ATLAS_W, Hoehe auf die naechste Zweierpotenz. frames = [(key, rgb)]"""
    order = sorted(range(len(frames)), key=lambda i: (-frames[i][1].shape[0], i))
    pos = {}
    x, y, rowh = PAD, PAD, 0
    for i in order:
        h, w = frames[i][1].shape[:2]
        if x + w + PAD > ATLAS_W:
            x, y, rowh = PAD, y + rowh + PAD, 0
        pos[i] = (x, y)
        x += w + PAD
        rowh = max(rowh, h)
    need = y + rowh + PAD
    H = 1
    while H < need:
        H *= 2
    atlas = np.zeros((H, ATLAS_W, 4), np.uint8)
    for i, (px_, py_) in pos.items():
        rgb = frames[i][1]
        h, w = rgb.shape[:2]
        atlas[py_:py_ + h, px_:px_ + w, :3] = rgb
        atlas[py_:py_ + h, px_:px_ + w, 3] = 255
    return atlas, pos


def write_json(path, frames_meta):
    lines = ['{', ' "image": "rooms.png",', ' "frames": {']
    items = []
    for key, m in frames_meta:
        entry = {'x': m['x'], 'y': m['y'], 'w': m['w'], 'h': m['h'], 'ax': 0, 'ay': 0}
        if m.get('slots'):
            entry['slots'] = [[int(a), int(b)] for a, b in m['slots']]
        items.append('  ' + json.dumps(key) + ': ' + json.dumps(entry))
    lines.append(',\n'.join(items))
    lines += [' }', '}', '']
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))


def verify(frames, meta):
    """Atlas und JSON gegenpruefen: Frame-Pixel stimmen, Raender >= 1 px, nichts ausserhalb, Palette, Alpha"""
    img = Image.open(os.path.join(OUT_DIR, 'rooms.png')).convert('RGBA')
    a = np.array(img)
    data = json.load(open(os.path.join(OUT_DIR, 'rooms.json'), encoding='utf-8'))
    assert data['image'] == 'rooms.png' and len(data['frames']) == len(frames)
    assert img.width <= 2048 and palette_violations(img) == 0 and set(np.unique(a[:, :, 3])) <= {0, 255}
    rects = []
    for key, rgb in frames:
        m = data['frames'][key]
        assert (m['w'], m['h']) == (rgb.shape[1], rgb.shape[0]) and (m['ax'], m['ay']) == (0, 0)
        assert m['w'] % CELL == 0 and m['h'] % CELL == 0
        assert np.array_equal(a[m['y']:m['y'] + m['h'], m['x']:m['x'] + m['w'], :3], rgb)
        assert (a[m['y']:m['y'] + m['h'], m['x']:m['x'] + m['w'], 3] == 255).all()
        for sx, sy in m.get('slots', []):
            assert 0 <= sx < m['w'] and 0 <= sy < m['h']
        assert m['x'] >= PAD and m['y'] >= PAD and m['x'] + m['w'] + PAD <= img.width and m['y'] + m['h'] + PAD <= img.height
        rects.append((m['x'], m['y'], m['x'] + m['w'] + PAD, m['y'] + m['h'] + PAD))      # +PAD: 1 px Luft zum Nachbarn
    for i in range(len(rects)):
        for j in range(i + 1, len(rects)):
            assert rect_inter(rects[i], rects[j]) == (0, 0), (i, j)


def contact_sheets(entries, per=5):
    """Vorschau x3: je Raum eine Zeile, beide Ausrichtungen nebeneinander, Schluessel (und Methode) als Beschriftung.
    entries = [(cid, [(key, rgb, slots, method)])]"""
    os.makedirs(SHEET_DIR, exist_ok=True)
    for old in glob.glob(os.path.join(SHEET_DIR, 'rooms_*.png')):
        os.remove(old)
    font = label_font(12)
    pad, cap = 10, 18
    paths = []
    for n, s0 in enumerate(range(0, len(entries), per)):
        chunk = entries[s0:s0 + per]
        widths = [sum(rgb.shape[1] * SCALE + pad for _, rgb, _, _ in fr) for _, fr in chunk]
        heights = [max(rgb.shape[0] * SCALE for _, rgb, _, _ in fr) + cap + pad for _, fr in chunk]
        sheet = Image.new('RGB', (max(widths) + pad, sum(heights) + pad), hexrgb('#2b2540'))
        d = ImageDraw.Draw(sheet)
        y = pad
        for (cid, fr), hh in zip(chunk, heights):
            x = pad
            for key, rgb, slots, method in fr:
                d.text((x, y), f'{key}   [{method}]' + (f'   slots {len(slots)}' if slots else ''), fill=(240, 235, 250), font=font)
                im = Image.fromarray(rgb, 'RGB').resize((rgb.shape[1] * SCALE, rgb.shape[0] * SCALE), Image.NEAREST)
                sheet.paste(im, (x, y + cap))
                for (sx, sy) in slots:                      # Geschuetzplatz-Markierung (nur Vorschau)
                    cx, cy = x + sx * SCALE, y + cap + sy * SCALE
                    d.line((cx - 7, cy, cx + 7, cy), fill=(26, 18, 38), width=5)
                    d.line((cx, cy - 7, cx, cy + 7), fill=(26, 18, 38), width=5)
                    d.line((cx - 6, cy, cx + 6, cy), fill=(255, 215, 80), width=3)
                    d.line((cx, cy - 6, cx, cy + 6), fill=(255, 215, 80), width=3)
                x += im.width + pad
            y += hh
        path = os.path.join(SHEET_DIR, f'rooms_{n + 1:02d}.png')
        sheet.save(path)
        paths.append(path)
    return paths


def main():
    rooms = load_rooms()
    assert len(rooms) == 39, f'erwartet 39 Raum-Karten, gefunden {len(rooms)}'
    load_packs()
    rec = record_diorama_calls([r[0] for r in rooms if r[0] not in BUILTIN and r[0] not in CUSTOM])
    specs = make_specs(rooms, rec)
    frames, meta_src, sheet_entries, report = [], [], [], []
    for cid, name, cols, rows in rooms:
        spec = specs[cid]
        fr_sheet = []
        for key, lay, W, H, slots in build_room(cid, cols, rows, spec):
            rgb = compose(spec['tile'], lay.ops, W, H)
            assert rgb.shape == (H, W, 3)
            frames.append((key, rgb))
            meta_src.append((key, slots))
            fr_sheet.append((key, rgb, slots, lay.method))
            report.append((key, lay.method, lay.info))
        sheet_entries.append((cid, fr_sheet))
    atlas, pos = pack_atlas(frames)
    os.makedirs(OUT_DIR, exist_ok=True)
    img = Image.fromarray(atlas, 'RGBA')
    bad = palette_violations(img)
    assert bad == 0, f'{bad} Farben ausserhalb der Master-Palette im Atlas'
    assert set(np.unique(atlas[:, :, 3])) <= {0, 255}
    img.save(os.path.join(OUT_DIR, 'rooms.png'))
    meta = []
    for i, (key, rgb) in enumerate(frames):
        h, w = rgb.shape[:2]
        meta.append((key, {'x': pos[i][0], 'y': pos[i][1], 'w': w, 'h': h, 'slots': meta_src[i][1]}))
    write_json(os.path.join(OUT_DIR, 'rooms.json'), meta)
    verify(frames, meta)
    sheets = contact_sheets(sheet_entries)
    n_rot = sum(1 for _, c, r in ((r[0], r[2], r[3]) for r in rooms) if c != r)
    print(f'{len(rooms)} Raeume, {len(frames)} Frames ({n_rot} Raeume mit zwei Ausrichtungen), Atlas {img.width}x{img.height}, Palette-Verstoesse 0')
    counts = {}
    for key, method, info in report:
        counts[method] = counts.get(method, 0) + 1
    print('Methoden:', ', '.join(f'{k} {v}' for k, v in sorted(counts.items())))
    for key, method, info in report:
        if method not in ('native', 'manual'):
            print(f'  {key:14s} {method}')
    print('Handeinrichtung:', ', '.join(k for k, m, _ in report if m == 'manual'))
    slots = [f'{k} {len(m)}' for k, m in meta_src if m]
    print('Geschuetzplaetze:', ', '.join(slots))
    print('Vorschau:', ', '.join(os.path.relpath(p, HERE) for p in sheets))


if __name__ == '__main__':
    main()
