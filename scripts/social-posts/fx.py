"""Themen-Partikel um den Sprite (Giftwolken, Funken, Herzen, …), nahtlos loopend, im Pixel-Stil (Dithering statt Alpha)."""
import math
import random

from PIL import ImageDraw

from pxcommon import INK, U, WHITE, mix, cell_visible

# Paletten: [Kontur, Schatten, Mitte, Licht]
PAL = {
    'poison': [(38, 14, 70), (82, 38, 138), (128, 74, 192), (190, 140, 238)],
    'poison_bubble': [(70, 30, 120), (140, 90, 205), (210, 170, 255), (240, 225, 255)],
    'smoke': [(24, 20, 30), (58, 50, 62), (96, 88, 100), (142, 134, 146)],
    'fire': [(120, 20, 10), (214, 70, 20), (255, 150, 30), (255, 226, 110)],
    'dust': [(70, 52, 34), (122, 96, 64), (176, 148, 104), (226, 204, 160)],
    'heal': [(150, 40, 90), (226, 80, 140), (255, 140, 190), (255, 220, 235)],
    'gold': [(120, 80, 10), (214, 160, 30), (255, 214, 80), (255, 245, 190)],
    'arcane': [(30, 20, 100), (70, 60, 200), (120, 150, 255), (200, 235, 255)],
    'ecto': [(10, 50, 40), (30, 110, 90), (80, 190, 150), (190, 250, 220)],
    'leafgreen': [(20, 70, 20), (50, 140, 40), (110, 200, 70), (200, 250, 150)],
    'water': [(10, 50, 110), (30, 110, 190), (90, 180, 240), (220, 245, 255)],
    'storm_smoke': [(20, 24, 40), (50, 56, 80), (90, 100, 130), (150, 160, 190)],
    'shadow': [(14, 8, 30), (40, 20, 70), (80, 45, 120), (150, 110, 190)],
    'pinkwing': [(120, 40, 140), (200, 90, 200), (255, 150, 230), (255, 230, 250)],
    'holy_white': [(150, 140, 175), (214, 208, 232), (246, 243, 252), (255, 255, 255)],
    'ice': [(30, 70, 120), (90, 160, 220), (170, 220, 250), (240, 252, 255)],
}

# Theme → Emitter-Liste (mote = kleine Lichtfunken, cross = Kreuz-Funkeln, feather = fallende Feder). kind: gas (kleine Schwaden) | gasfloor (Schwaden am Boden) | fog (Bodennebel) | cloud | bubble | ember | spark | heart | flake | orb
THEMES = {
    'poison': [('gasfloor', 'poison', 22), ('gas', 'poison', 70), ('bubble', 'poison_bubble', 8), ('spark', 'poison_bubble', 4)],
    'fire':   [('cloud', 'smoke', 5), ('ember', 'fire', 18), ('spark', 'gold', 4)],
    'explosion': [('boom', 'fire', 11), ('gas', 'smoke', 26), ('ember', 'fire', 20), ('spark', 'gold', 4)],
    'heal':   [('heart', 'heal', 8), ('spark', 'gold', 10)],
    'arcane': [('orb', 'arcane', 9), ('spark', 'arcane', 8)],
    'fight':  [('cloud', 'dust', 5), ('spark', 'gold', 10)],
    'ice':    [('flake', 'ice', 16), ('spark', 'ice', 6)],
    'necro':  [('gas', 'ecto', 44), ('orb', 'ecto', 6), ('spark', 'ecto', 6)],
    'nature': [('leaf', 'leafgreen', 16), ('mote', 'leafgreen', 34), ('spark', 'gold', 5)],
    'water':  [('bubble', 'water', 18), ('gas', 'water', 18), ('spark', 'water', 6)],
    'storm':  [('bolt', 'gold', 6), ('gas', 'storm_smoke', 30), ('spark', 'gold', 6)],
    'shadow': [('gas', 'shadow', 46), ('spark', 'shadow', 8)],
    'dust':   [('gas', 'dust', 42), ('mote', 'dust', 24)],
    'butterfly': [('butterfly', 'pinkwing', 9), ('mote', 'heal', 24), ('spark', 'pinkwing', 5)],
    'holy':   [('beam', 'gold', 5), ('mote', 'gold', 64), ('orb', 'gold', 6), ('feather', 'holy_white', 14), ('cross', 'gold', 10), ('spark', 'holy_white', 7)],
    'stars':  [('spark', 'gold', 12), ('spark', 'arcane', 8)],
}

ABILITY_THEME = {
    'Decay Magic': 'poison', 'Destruction Magic': 'fire', 'Support Magic': 'heal', 'Friendship': 'heal',
    'Summoning Magic': 'arcane', 'Magic Arts': 'stars', 'Fighting': 'fight',
}
KEYWORDS = [('poison', 'poison'), ('burn', 'fire'), ('freez', 'ice'), ('frozen', 'ice'), ('heal', 'heal')]


def themes_for(card, override=None):
    """Themen eines Heroes: ausdrückliche Vorgabe → Schlagwörter im Effekttext → Start-Fähigkeiten."""
    if override:
        return [t for t in override if t in THEMES]
    found = []
    text = (card.get('effect') or '').lower()
    for kw, th in KEYWORDS:
        if kw in text and th not in found:
            found.append(th)
    for key in ('startingAbility1', 'startingAbility2'):
        th = ABILITY_THEME.get(card.get(key))
        if th and th not in found:
            found.append(th)
    return (found or ['stars'])[:2]


# ── Stempel (Zellen → Palettenindex) ──────────────────────────────────────────
_STAMPS = {}


def cloud_stamp(r, seed, soft=False):
    key = ('cloud', r, seed, soft)
    if key in _STAMPS:
        return _STAMPS[key]
    rnd = random.Random(seed * 131 + r)
    discs = [(0, 0, r)]
    for _ in range(rnd.choice([2, 3, 3])):
        ang = rnd.random() * 2 * math.pi
        dist = r * rnd.uniform(0.55, 0.85)
        discs.append((round(math.cos(ang) * dist), round(math.sin(ang) * dist * 0.7), max(2, round(r * rnd.uniform(0.5, 0.75)))))
    cells = set()
    for cx, cy, rr in discs:
        for j in range(-rr, rr + 1):
            for i in range(-rr, rr + 1):
                if i * i + j * j <= rr * rr + rr * 0.4:
                    cells.add((cx + i, cy + j))
    out = {}
    for (i, j) in cells:
        edge = any(n not in cells for n in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)))
        lit = (-i * 0.55 - j * 0.85) / (r * 1.4)
        if soft:                       # Gas: keine dunkle Kontur, nur drei Töne
            idx = 3 if lit > 0.35 else (2 if lit > -0.35 else 1)
        elif edge:
            idx = 0 if lit < 0.2 else 1
        else:
            idx = 3 if lit > 0.5 else (2 if lit > -0.15 else 1)
        out[(i, j)] = idx
    _STAMPS[key] = out
    return out


def bubble_stamp(r):
    key = ('bubble', r)
    if key in _STAMPS:
        return _STAMPS[key]
    out = {}
    for j in range(-r - 1, r + 2):
        for i in range(-r - 1, r + 2):
            d = math.hypot(i, j)
            if r - 0.7 <= d <= r + 0.5:
                out[(i, j)] = 2
    out[(-(r - 1) if r > 1 else -1, -(r - 1) if r > 1 else -1)] = 3
    _STAMPS[key] = out
    return out


HEART = ['.XX.XX.', 'XHXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']


def heart_stamp():
    out = {}
    for j, row in enumerate(HEART):
        for i, ch in enumerate(row):
            if ch == 'X':
                out[(i - 3, j - 3)] = 2
            elif ch == 'H':
                out[(i - 3, j - 3)] = 3
    for (i, j) in list(out):
        for n in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
            if n not in out:
                out[n] = 0
    return out


def orb_stamp():
    out = {}
    for j in range(-2, 3):
        for i in range(-2, 3):
            if abs(i) + abs(j) == 2:
                out[(i, j)] = 0
            elif abs(i) + abs(j) < 2:
                out[(i, j)] = 3 if (i, j) == (0, 0) else 2
    return out


FIRE_RAMP = [(255, 250, 224), (255, 220, 90), (255, 150, 30), (222, 60, 20), (110, 36, 24)]


def fire_color(c):
    """c ∈ [0,1]: 0 = Kern (weißgelb) … 1 = Rand/Abkühlung (dunkelrot)."""
    c = min(max(c, 0.0), 0.999) * (len(FIRE_RAMP) - 1)
    i = int(c)
    return FIRE_RAMP[i + 1] if c - i > 0.5 else FIRE_RAMP[i]


def fireball_stamp(R, seed):
    """Unregelmäßiger Feuerball: Zelle → Abstand zum nächsten Kreismittelpunkt (0 Mitte … 1 Rand)."""
    key = ('fire', R, seed)
    if key in _STAMPS:
        return _STAMPS[key]
    rnd = random.Random(seed * 17 + R)
    discs = [(0.0, 0.0, float(R))]
    for _ in range(5):
        ang = rnd.random() * 2 * math.pi
        dist = R * rnd.uniform(0.45, 0.75)
        discs.append((math.cos(ang) * dist, math.sin(ang) * dist, R * rnd.uniform(0.45, 0.65)))
    out = {}
    span = int(R * 1.6) + 2
    for j in range(-span, span + 1):
        for i in range(-span, span + 1):
            best = None
            for cx, cy, rr in discs:
                t = math.hypot(i - cx, j - cy) / rr
                if best is None or t < best:
                    best = t
            if best <= 1.0:
                out[(i, j)] = best
    _STAMPS[key] = out
    return out


class ThemeFX:
    """Alle Partikel eines Heroes. `box` = deckender Sprite-Kasten (x0, y0, x1, y1) auf dem Canvas, `feet` = Standlinie."""

    def __init__(self, names, seed, box, feet, loop):
        self.loop = loop
        self.items = []
        r = random.Random(seed)
        bx0, by0, bx1, by1 = box
        cx = (bx0 + bx1) / 2
        for name in names:
            for kind, pal, count in THEMES[name]:
                for k in range(count):
                    side = r.choice([-1, 1])
                    spread = r.uniform(0.2, 1.0)
                    x0 = y0 = 0.0
                    if kind == 'boom':
                        cyc = r.choice([4, 5, 6])
                        spots = []
                        for n in range(cyc):
                            side = r.choice([-1, 1])
                            spots.append((cx + side * r.uniform(0.3, 1.0) * ((bx1 - bx0) / 2 + 170),
                                          r.uniform(by0 + 10, feet + 10), r.choice([5, 6, 8, 10]), r.randrange(1000)))
                        it = dict(rise=0, drift=0, r=1, grow=0, seed=0, sway=0, spots=spots, cycles=cyc)
                    elif kind == 'gas':
                        x0 = cx + r.uniform(-1, 1) * ((bx1 - bx0) / 2 + 150)
                        y0 = feet - r.uniform(-20, 330)
                        it = dict(rise=r.uniform(90, 210), drift=r.uniform(-40, 40), r=r.choice([1, 1, 2, 2, 3]), grow=1,
                                  seed=r.randrange(1000), sway=r.choice([1, 2, 3]) * U, amax=0.85)
                    elif kind == 'gasfloor':
                        x0 = cx + r.uniform(-1, 1) * 310
                        y0 = feet + r.uniform(-20, 30)
                        it = dict(rise=r.uniform(40, 100), drift=r.uniform(-60, 60), r=r.choice([3, 3, 4]), grow=1,
                                  seed=r.randrange(1000), sway=r.choice([1, 2]) * U, amax=0.8)
                    elif kind == 'fog':
                        x0 = cx + r.uniform(-1, 1) * 300
                        y0 = feet + r.uniform(-10, 30)
                        it = dict(rise=r.uniform(50, 120), drift=r.uniform(-50, 50), r=r.choice([5, 6]), grow=1, seed=r.randrange(1000), sway=0)
                    elif kind == 'cloud':
                        x0 = cx + side * ((bx1 - bx0) / 2 + 40) * spread + r.uniform(-30, 30)
                        y0 = feet - r.uniform(0, 80)
                        it = dict(rise=r.uniform(190, 300), drift=side * r.uniform(20, 90), r=r.choice([3, 4, 4, 5]), grow=r.choice([1, 2, 2]),
                                  seed=r.randrange(1000), sway=0)
                    elif kind == 'bubble':
                        x0 = cx + r.uniform(-0.65, 0.65) * (bx1 - bx0 + 160) / 1.2
                        y0 = feet + r.uniform(-30, 30)
                        it = dict(rise=r.uniform(260, 420), drift=0, r=r.choice([1, 2, 2, 3]), grow=0, seed=0, sway=r.choice([1, 2]) * U)
                    elif kind == 'ember':
                        x0 = cx + r.uniform(-0.55, 0.55) * (bx1 - bx0)
                        y0 = feet - r.uniform(0, 120)
                        it = dict(rise=r.uniform(260, 460), drift=r.uniform(-50, 50), r=1, grow=0, seed=0, sway=r.choice([0, 1, 2]) * U)
                    elif kind == 'heart':
                        x0 = cx + side * ((bx1 - bx0) / 2 + r.uniform(0, 70)) * spread
                        y0 = feet - r.uniform(0, 200)
                        it = dict(rise=r.uniform(180, 280), drift=side * 20, r=1, grow=0, seed=0, sway=2 * U)
                    elif kind == 'leaf':
                        x0 = cx + r.uniform(-1, 1) * ((bx1 - bx0) / 2 + 120)
                        y0 = by0 - r.uniform(0, 100)
                        it = dict(rise=-r.uniform(280, 400), drift=r.uniform(-40, 40), r=1, grow=0, seed=0, sway=r.choice([2, 3]) * U)
                    elif kind == 'butterfly':
                        x0 = cx + r.uniform(-1, 1) * ((bx1 - bx0) / 2 + 130)
                        y0 = feet - r.uniform(0, 300)
                        it = dict(rise=r.uniform(50, 130), drift=r.uniform(-60, 60), r=1, grow=0, seed=0, sway=r.choice([3, 4, 5]) * U)
                    elif kind == 'bolt':
                        cyc = r.choice([3, 4, 5])
                        spots = [(cx + r.choice([-1, 1]) * r.uniform(0.3, 1.0) * ((bx1 - bx0) / 2 + 150), by0 - r.uniform(40, 140),
                                  r.randrange(12, 26), r.randrange(1000)) for _ in range(cyc)]
                        it = dict(rise=0, drift=0, r=1, grow=0, seed=0, sway=0, spots=spots, cycles=cyc)
                    elif kind == 'mote':
                        x0 = cx + r.uniform(-1, 1) * ((bx1 - bx0) / 2 + 130)
                        y0 = feet - r.uniform(-10, 300)
                        it = dict(rise=r.uniform(70, 190), drift=r.uniform(-25, 25), r=r.choice([1, 1, 1, 2]), grow=0, seed=0, sway=r.choice([1, 2]) * U)
                    elif kind == 'beam':
                        x0 = cx + r.uniform(-1, 1) * ((bx1 - bx0) / 2 + 150)
                        y0 = by0 - 90
                        it = dict(rise=0, drift=0, r=1, grow=0, seed=0, sway=0, w=r.choice([6, 8, 10, 12]),
                                  h=int((feet - by0 + 90) / U))
                    elif kind == 'cross':
                        x0 = cx + r.uniform(-1, 1) * ((bx1 - bx0) / 2 + 110)
                        y0 = r.uniform(by0 + 30, feet)
                        it = dict(rise=r.uniform(30, 90), drift=0, r=1, grow=0, seed=0, sway=0)
                    elif kind == 'feather':
                        x0 = cx + r.uniform(-1, 1) * ((bx1 - bx0) / 2 + 100)
                        y0 = by0 - r.uniform(0, 80)
                        it = dict(rise=-r.uniform(300, 420), drift=r.uniform(-30, 30), r=1, grow=0, seed=0, sway=r.choice([2, 3]) * U)
                    elif kind == 'flake':
                        x0 = cx + r.uniform(-1, 1) * ((bx1 - bx0) / 2 + 110)
                        y0 = by0 - r.uniform(0, 100)
                        it = dict(rise=-r.uniform(260, 380), drift=r.uniform(-40, 40), r=1, grow=0, seed=0, sway=U)
                    elif kind == 'orb':
                        x0 = cx + side * ((bx1 - bx0) / 2 + r.uniform(20, 90)) * spread
                        y0 = feet - r.uniform(0, 240)
                        it = dict(rise=r.uniform(120, 220), drift=0, r=1, grow=0, seed=0, sway=3 * U)
                    else:  # spark
                        x0 = cx + r.uniform(-1, 1) * ((bx1 - bx0) / 2 + 100)
                        y0 = r.uniform(by0, feet)
                        it = dict(rise=r.uniform(60, 160), drift=0, r=1, grow=0, seed=0, sway=0)
                    it.setdefault('amax', 1.0)
                    it.update(kind=kind, pal=PAL[pal], x0=x0, y0=y0, phase=r.random())
                    it.setdefault('cycles', r.choice([1, 1, 2]))
                    self.items.append(it)

    def draw(self, layer, f):
        d = ImageDraw.Draw(layer)
        t = f / self.loop
        for p in self.items:
            if p['kind'] == 'beam':                    # Lichtschaft: pulsiert, oben hell, zur Mitte hin gedämpft, dithered
                pulse = 0.5 + 0.5 * math.sin((t * p['cycles'] + p['phase']) * 2 * math.pi)
                bx, by = int(round(p['x0'] / U)), int(round(p['y0'] / U))
                for j in range(p['h']):
                    vf = 1 - 0.8 * j / p['h']
                    for i in range(p['w']):
                        hf = 1 - abs(i + 0.5 - p['w'] / 2) / (p['w'] / 2)
                        a = (0.18 + 0.5 * pulse) * (0.3 + 0.7 * hf) * vf
                        if cell_visible(a, bx + i, by + j):
                            px, py = (bx + i) * U, (by + j) * U
                            d.rectangle([px, py, px + U - 1, py + U - 1], fill=p['pal'][3 if hf > 0.6 else 2] + (255,))
                continue
            if p['kind'] == 'boom':
                self._boom(d, p, t)
                continue
            if p['kind'] == 'bolt':
                self._bolt(d, p, t)
                continue
            u = (t * p['cycles'] + p['phase']) % 1.0
            a = min(p['amax'], u / 0.22, (1 - u) / 0.38)
            if a <= 0:
                continue
            x = p['x0'] + p['drift'] * u + (math.sin((u + p['phase']) * 2 * math.pi) * p['sway'] if p['sway'] else 0)
            y = p['y0'] - p['rise'] * u
            cx, cy = int(round(x / U)), int(round(y / U))
            kind, pal = p['kind'], p['pal']
            if kind in ('cloud', 'fog'):
                stamp = cloud_stamp(p['r'] + int(u * p['grow']), p['seed'])
            elif kind in ('gas', 'gasfloor'):
                stamp = cloud_stamp(p['r'] + int(u * p['grow']), p['seed'], soft=True)
            elif kind == 'bubble':
                stamp = bubble_stamp(p['r'])
            elif kind == 'heart':
                stamp = heart_stamp()
            elif kind == 'orb':
                stamp = orb_stamp()
            elif kind == 'mote':
                big = p['r'] > 1
                stamp = {(0, 0): 3, (1, 0): 2, (0, 1): 2, (1, 1): 2} if big else {(0, 0): 2 if int(u * 6) % 2 else 3}
            elif kind == 'cross':
                stamp = {(0, j): (3 if j == 0 else 2) for j in range(-2, 4)}
                stamp.update({(-1, 0): 2, (1, 0): 2})
            elif kind == 'leaf':
                stamp = ({(0, 0): 2, (1, 0): 3, (-1, 1): 2, (0, 1): 2, (1, 1): 2, (-1, 2): 1, (0, 2): 2} if int(u * 6) % 2 else
                         {(0, 0): 2, (1, 0): 2, (0, 1): 3, (1, 1): 2, (2, 1): 2, (1, 2): 1})
            elif kind == 'butterfly':
                if int(u * 40) % 2:
                    stamp = {(-2, -1): 2, (-1, -1): 3, (1, -1): 3, (2, -1): 2, (-2, 0): 2, (-1, 0): 2, (1, 0): 2, (2, 0): 2, (0, 0): 0, (-1, 1): 1, (1, 1): 1}
                else:
                    stamp = {(-1, -1): 3, (1, -1): 3, (-1, 0): 2, (1, 0): 2, (0, 0): 0}
            elif kind == 'feather':
                stamp = {k: 2 for k in ((2, -2), (1, -2), (1, -1), (0, -1), (0, 0), (-1, 0), (-1, 1), (-2, 1), (-2, 2))}
                stamp.update({(1, -1): 3, (0, -1): 3, (0, 0): 3, (2, -2): 3})
            elif kind in ('ember', 'flake'):
                stamp = {(0, 0): 2 if int(u * 8) % 2 else 3}
            else:                                  # spark: Plus, atmet in 4 Stufen
                s = [0, 1, 2, 1][int(u * 8) % 4]
                stamp = {(i, 0): 3 if i == 0 else 2 for i in range(-s, s + 1)}
                stamp.update({(0, j): 3 if j == 0 else 2 for j in range(-s, s + 1)})
            for (i, j), idx in stamp.items():
                gx, gy = cx + i, cy + j
                if not cell_visible(a, gx, gy):
                    continue
                px, py = gx * U, gy * U
                d.rectangle([px, py, px + U - 1, py + U - 1], fill=pal[idx] + (255,))

    def _boom(self, d, p, t):
        """Eine Explosion je Zyklus an wechselnder Stelle: Blitz → Feuerball (weiß→gelb→orange→rot) → Druckwelle, Funken, Rauch."""
        x = t * p['cycles'] + p['phase']
        n, u = int(x), x % 1.0
        sx, sy, size, seed = p['spots'][n % p['cycles']]
        cx, cy = int(round(sx / U)), int(round(sy / U))

        def cell(i, j, col):
            px, py = (cx + i) * U, (cy + j) * U
            d.rectangle([px, py, px + U - 1, py + U - 1], fill=col + (255,))

        if u < 0.7:                                    # Feuerball
            k = u / 0.7
            R = max(1, int(round(size * (0.35 + 0.85 * math.sqrt(k)))))
            a = min(1.0, (1 - k) / 0.35)
            for (i, j), rt in fireball_stamp(R, seed).items():
                if cell_visible(a, cx + i, cy + j):
                    cell(i, j, fire_color(k * 0.85 + rt * 0.4))
        if u < 0.1:                                    # Blitz: Plus aus Weiß
            s = int(size * 0.9 * (1 - u / 0.1)) + 1
            for q in range(-s, s + 1):
                cell(q, 0, WHITE)
                cell(0, q, WHITE)
        if 0.05 < u < 0.5:                             # Druckwelle
            k = (u - 0.05) / 0.45
            Rr = size * (0.7 + 2.0 * k)
            a = 0.85 * (1 - k)
            span = int(Rr) + 2
            for j in range(-span, span + 1):
                for i in range(-span, span + 1):
                    if abs(math.hypot(i, j) - Rr) < 0.65 and cell_visible(a, cx + i, cy + j):
                        cell(i, j, (255, 236, 160))
        if u < 0.65:                                   # Funken fliegen nach außen
            k = u / 0.65
            rnd = random.Random(seed)
            for q in range(9):
                ang = rnd.random() * 2 * math.pi
                dist = size * (0.6 + rnd.uniform(1.4, 2.8) * math.sqrt(k))
                if cell_visible(1 - k, cx + int(dist * math.cos(ang)), cy + int(dist * math.sin(ang))):
                    cell(int(round(dist * math.cos(ang))), int(round(dist * math.sin(ang))), (255, 226, 110) if q % 2 else (255, 150, 30))
        if u > 0.35:                                   # Rauchpuff, steigt auf
            k = (u - 0.35) / 0.65
            a = min(0.8, k / 0.3, (1 - k) / 0.5)
            R = max(2, int(size * (0.7 + 0.5 * k)))
            for (i, j), idx in cloud_stamp(R, seed, soft=True).items():
                jj = j - int(k * size * 1.2)
                if cell_visible(a, cx + i, cy + jj):
                    cell(i, jj, PAL['smoke'][idx])

    def _bolt(self, d, p, t):
        """Blitz: zackige Linie von oben, nur kurz sichtbar (erste 18 % des Zyklus), flackert."""
        x = t * p['cycles'] + p['phase']
        n, u = int(x), x % 1.0
        sx, sy, length, seed = p['spots'][n % p['cycles']]
        if u > 0.18:
            return
        rnd = random.Random(seed)
        cx, cy = int(round(sx / U)), int(round(sy / U))
        i = 0
        flick = 3 if int(u * 40) % 2 else 2
        for j in range(length):
            i += rnd.choice([-1, 0, 0, 1])
            for q, idx in ((0, 3), (-1, 2), (1, 2)):
                if q != 0 and u > 0.1:
                    continue
                px, py = (cx + i + q) * U, (cy + j) * U
                d.rectangle([px, py, px + U - 1, py + U - 1], fill=p['pal'][flick if q == 0 else 2] + (255,))
