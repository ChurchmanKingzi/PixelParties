# -*- coding: utf-8 -*-
"""Theme-Track „Four Winds Convergence“ (Cardinal Beasts) → public/music/bgm_theme_cardinalbeasts.ogg

Die vier Himmelsbestien Baihu (Weißer Tiger, Westen, Metall), Qinglong (Azurdrache, Osten, Holz),
Xuanwu (Schwarze Schildkröte, Norden, Wasser) und Zhuque (Zinnobervogel, Süden, Feuer) über einem
gemeinsamen, majestätischen Thema. Chinesische Fünftonleitern (Pentatonik), 112 BPM, 56 Takte
(120,0 s), nahtlos loopbar. Erhu-artige Violine, Guzheng-Koto, Harfe, Flöte, Gongs (Crash + Pauke +
Röhrenglocke), Chor, Blech.

Aufbau (Takte, 0-basiert):
   0– 3  Intro           Gong, Herzschlag-Pauke/Toms, Streicher-Ostinato, Erhu-Ruf
   4–11  Thema           Erhu + Koto: das gemeinsame Thema in D-Pentatonik (D E Fis A H), Chor ab Takt 8
  12–19  Baihu (Metall)  h-Moll-Pentatonik: staccato Blech, Röhrenglocken-Schläge, synkopierter Tigersprung
  20–27  Qinglong (Holz) G-Dur-Pentatonik: Flöte + fließende Harfenwellen (Drachenschlangenlinie)
  28–35  Xuanwu (Wasser) e-Moll-Pentatonik: halbe Zeit, tiefe Tuba/Streicher, Marimba-Tropfen, Pauke
  36–43  Zhuque (Feuer)  A-Dur-Pentatonik: Trompete + Xylophon 16tel-Läufe, Galopp, Chor hoch
  44–51  Konvergenz     Thema in Vollbesetzung, alle vier Bestien-Schichten übereinander
  52–55  Rückführung    E–E–A–A (Dominante), Snare-Wirbel, Ruf → Takt 0

Harmonie: nur Pentatonik-Töne (Melodien als Skalenstufen → garantiert skalenrein); Akkorde sind
Quinten (Grundton–Quinte–Oktave), Farbe kommt aus Melodie und Instrumentierung. Der Loop endet auf
der Dominante (A) und fällt nach D zurück; keine Schlusskadenz.
Aufruf:  python3 scripts/music/theme_cardinalbeasts.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 112, 56                       # 56 × 4 × 60/112 = 120,0 s
song = Song(bpm=BPM, bars=BARS)

song.inst('timp',    'timp',     94, 64)
song.inst('contra',  'contra',   86, 64)
song.inst('bass',    'bass2',    96, 58)
song.inst('strings', 'strings',  76, 40)
song.inst('violin',  'violin',   92, 70)    # Erhu-artig
song.inst('koto',    'koto',     88, 86)    # Guzheng
song.inst('harp',    'harp',     82, 42)
song.inst('flute',   'flute',    90, 74)
song.inst('trumpet', 'trumpet',  88, 64)
song.inst('brass',   'brass',    84, 54)
song.inst('tuba',    'tuba',     90, 78)
song.inst('choir',   'choir',    84, 64)
song.inst('marimba', 'marimba',  86, 90)
song.inst('xylo',    'xylo',     84, 36)
song.inst('bell',    'bell',     84, 56)    # Gong-Ersatz

class Pent:
    """Fünftonleiter; Stufe k → MIDI-Note (k=0 Grundton bei `base`, 5 = Oktave)."""
    def __init__(self, base, minor=False):
        self.base = base; self.iv = [0, 3, 5, 7, 10] if minor else [0, 2, 4, 7, 9]
        self.pcs = {(base + i) % 12 for i in self.iv}
    def d(self, k): return self.base + 12 * (k // 5) + self.iv[k % 5]
    def idx(self, pc):                                   # tiefste Stufe ≥ 0 mit Tonhöhenklasse pc
        return next(k for k in range(5) if self.d(k) % 12 == pc)
D_ = Pent(n(D, 4));  B_ = Pent(n(B, 3), True);  G_ = Pent(n(G, 3))
E_ = Pent(n(E, 3), True);  A_ = Pent(n(A, 3))

def rootb(pc): return 36 + pc
def r3(pc): return 48 + pc
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
def chk(pc, sc): assert pc in sc.pcs and (pc + 7) % 12 in sc.pcs, (pc, sc.base)

def line(b, notes, insts, vels, sc, shift=0):
    for off, dur, k in notes:
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.94, sc.d(k) + shift, v)

def pedal(b, pc, vel=84): song.add('contra', song.bar(b), 3.98, rootb(pc) - 12 if rootb(pc) - 12 >= 28 else rootb(pc), vel)

def bass(b, pc, kind, vel=96):
    s, r = song.bar(b), rootb(pc)
    pats = {
        'n':     [(0, 0, 8), (1, 0, -6), (1.5, 12, 0), (2, 0, 2), (3, 0, -6), (3.5, 7, -2)],
        'tiger': [(0, 0, 10), (0.75, 0, -6), (1, 0, 0), (1.5, 12, 0), (2, 0, 4), (2.75, 0, -6), (3, 7, 0), (3.5, 0, -4)],
        'wave':  [(i * 0.5, 7 if i % 2 else 0, 6 if i % 4 == 0 else -4) for i in range(8)],
        'turtle':[(0, 0, 12), (1.5, 0, -8), (2, 7, 4), (3.5, 0, -6)],
        'fire':  [(i * 0.5, 12 if i % 2 else 0, 8 if i % 4 == 0 else -2) for i in range(8)],
    }[kind]
    for off, o, v in pats: song.add('bass', s + off, 0.42 if kind != 'turtle' else 1.2, r + o, vel + v)

def timp(b, pc, kind='q', vel=94):
    s, p = song.bar(b), rootb(pc)
    if kind == 'q':
        for off in (0, 2): song.add('timp', s + off, 0.6, p, vel)
    elif kind == 'heart':
        for off, v in ((0, 0), (0.5, -14), (2, -4), (2.5, -16)): song.add('timp', s + off, 0.4, p, vel + v)
    elif kind == 'gallop':
        for off, v in ((0, 0), (1, -6), (1.5, -12), (2, -2), (3, -6), (3.5, -12)): song.add('timp', s + off, 0.4, p, vel + v)
    elif kind == 'slow':
        song.add('timp', s, 1.8, p, vel); song.add('timp', s + 2.5, 1.2, p, vel - 12)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * 0.25, 0.25, p, ramp(i, 16, vel - 30, vel + 12))

def ostinato(b, pc, step=0.5, vel=66, inst='strings'):
    """Staccato-Ostinato Grundton–Quinte (Achtel oder 16tel)."""
    s, r = song.bar(b), r3(pc); cnt = int(4 / step)
    for i in range(cnt): song.add(inst, s + i * step, step * 0.7, r + (7 if i % 4 in (1, 3) else 0) + (12 if i % 4 == 2 else 0), vel + (8 if i % 4 == 0 else 0))

def pad(b, pc, vel=80, inst='choir', oct_=12):
    r = r3(pc) + oct_
    for p in (r, r + 7, r + 12): song.add(inst, song.bar(b), 3.98, p, vel)

def dragon(b, pc, sc, vel=74, inst='harp'):
    """Drachen-Welle: 16tel-Skalenlauf auf-ab ab dem Akkordgrundton."""
    k0 = sc.idx(pc) + 5
    for i, o in enumerate([0, 1, 2, 3, 2, 3, 4, 5, 4, 5, 6, 7, 6, 5, 4, 3]):
        song.add(inst, song.bar(b) + i * 0.25, 0.25, sc.d(k0 + o), vel + (8 if i % 4 == 0 else 0))

def gong(b, vel=104):
    song.dr(song.bar(b), CRASH, vel, 0.6)
    song.add('bell', song.bar(b), 3.8, n(D, 3), vel - 8); song.add('bell', song.bar(b), 3.8, n(A, 3), vel - 16)

# ---- Schlagzeug ---------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'T':                       # Thema: würdiger Schritt
        d(0, KICK, 112); d(2, KICK, 100); d(2.75, KICK, 84); d(1, SNARE, 100); d(3, SNARE, 104); d(1, SIDESTICK, 84); d(3, SIDESTICK, 88)
        for i in range(8): d(i * 0.5, HAT, 100 if i % 2 == 0 else 80)
        d(2.5, TOM_M, 92); d(3.5, TOM_L, 96)
    elif kind == 'W':                     # Tiger: Sprung, synkopiert
        for off, vel in ((0, 116), (0.75, 92), (2, 106), (2.75, 96)): d(off, KICK, vel)
        d(1, SNARE, 110); d(3, SNARE, 114); d(1, CLAP, 90); d(3, CLAP, 94)
        for i in range(8): d(i * 0.5, HAT, 104 if i % 2 == 0 else 84)
        d(1.5, TOM_L, 100); d(3.5, TOM_M, 96); d(3.75, TOM_H, 96)
    elif kind == 'Wd':                    # Drache: fließend, Tom-Kaskaden
        d(0, KICK, 110); d(2, KICK, 100); d(1, SNARE, 96); d(3, SNARE, 100)
        for i in range(16): d(i * 0.25, HAT, 100 if i % 4 == 0 else (84 if i % 2 == 0 else 68))
        for i, t in enumerate((TOM_H, TOM_HH, TOM_M, TOM_L)): d(3 + i * 0.25, t, 88 + i * 4)
    elif kind == 'Wt':                    # Schildkröte: halbe Zeit, schwer
        d(0, KICK, 118); d(3.5, KICK, 96); d(2, SNARE, 120); d(2, CLAP, 96); d(1.5, TOM_L, 100); d(2.75, TOM_L, 94)
        for i in range(4): d(i, HAT, 104 if i % 2 == 0 else 84)
        if b % 2 == 0: d(0, CRASH, 86)
    elif kind == 'F':                     # Vogel: Galopp
        for off in (0, 1, 2, 2.5, 3): d(off, KICK, 108 if off in (0, 2) else 92)
        d(1, SNARE, 108); d(3, SNARE, 112)
        for off in (0.5, 1.5, 2.5, 3.5): d(off, CLAP, 76)
        for i in range(16): d(i * 0.25, HAT, 104 if i % 4 == 0 else (86 if i % 2 == 0 else 72))
        d(3.5, TOM_M, 96); d(3.75, TOM_L, 100)
    elif kind == 'C':                     # Konvergenz: alles
        for off, vel in ((0, 118), (1.5, 94), (2, 108), (2.75, 96), (3.5, 100)): d(off, KICK, vel)
        d(1, SNARE, 114); d(3, SNARE, 116); d(1, CLAP, 90); d(3, CLAP, 92)
        for i in range(16): d(i * 0.25, HAT, 104 if i % 4 == 0 else (86 if i % 2 == 0 else 72))
        d(2.5, TOM_M, 96); d(3.75, TOM_L, 100)
        if b % 2 == 0: d(0, CRASH, 96)
    elif kind == 'soft':
        d(0, KICK, 96); d(2, KICK, 90); d(1, SIDESTICK, 84); d(3, SIDESTICK, 88)
        for i in range(8): d(i * 0.5, HAT, 92 if i % 2 == 0 else 74)

def fill(b, big=False):
    s = song.bar(b); toms = [TOM_H, TOM_HH, TOM_M, TOM_L]
    for i in range(8): song.dr(s + 2 + i * 0.25, toms[min(3, i // 2)] if not big else toms[i % 4], ramp(i, 8, 88, 120), 0.2)
    song.dr(s + 3.75, KICK, 118)

def snare_roll(b, start, end, v0, v1):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)

# ---- Melodien (Skalenstufen) -----------------------------------------------------------------
CH_T = [D, B, A, E, D, B, A, E]
MEL_T = [                                         # Thema in D-Pentatonik (0 = D4)
    [(0, 1.5, 3), (1.5, .5, 5), (2, 2, 6)],
    [(0, 1, 7), (1, 1, 6), (2, 2, 5)],
    [(0, 1.5, 4), (1.5, .5, 5), (2, 1, 6), (3, 1, 5)],
    [(0, 1, 4), (1, 1, 3), (2, 2, 1)],
    [(0, 1.5, 5), (1.5, .5, 6), (2, 2, 7)],
    [(0, 1, 8), (1, 1, 7), (2, 1, 6), (3, 1, 5)],
    [(0, 1, 6), (1, 1, 7), (2, 1.5, 8), (3.5, .5, 7)],
    [(0, 2, 6), (2, 2, 3)],
]
CH_W = [B, B, D, E, B, D, E, A]
MEL_W = [                                         # Baihu, h-Moll-Pentatonik (0 = H3)
    [(0, .5, 5), (.75, .25, 5), (1, .5, 5), (1.5, .5, 6), (2, 1, 7), (3, 1, 5)],
    [(0, .5, 5), (.75, .25, 5), (1, .5, 5), (1.5, .5, 4), (2, 2, 3)],
    [(0, .5, 6), (.75, .25, 6), (1, .5, 6), (1.5, .5, 7), (2, 1, 8), (3, 1, 7)],
    [(0, .5, 7), (.75, .25, 7), (1, .5, 7), (1.5, .5, 6), (2, 2, 5)],
    [(0, .5, 7), (.75, .25, 7), (1, .5, 7), (1.5, .5, 8), (2, 1, 9), (3, 1, 8)],
    [(0, 1, 8), (1, 1, 7), (2, 1, 6), (3, 1, 5)],
    [(0, .5, 7), (.75, .25, 7), (1, .5, 7), (1.5, .5, 6), (2, 1, 5), (3, 1, 3)],
    [(0, 3, 5), (3, 1, 3)],
]
CH_Q = [G, E, D, A, G, E, D, A]
MEL_Q = [                                         # Qinglong, G-Dur-Pentatonik (0 = G3)
    [(0, .5, 5), (.5, .5, 6), (1, .5, 7), (1.5, .5, 8), (2, 1.5, 9), (3.5, .5, 8)],
    [(0, .5, 7), (.5, .5, 6), (1, .5, 5), (1.5, .5, 4), (2, 2, 5)],
    [(0, .5, 6), (.5, .5, 7), (1, .5, 8), (1.5, .5, 9), (2, 1.5, 10), (3.5, .5, 9)],
    [(0, .5, 8), (.5, .5, 7), (1, .5, 6), (1.5, .5, 5), (2, 2, 6)],
    [(0, .5, 5), (.5, .5, 7), (1, .5, 8), (1.5, .5, 9), (2, 1, 10), (3, 1, 8)],
    [(0, .5, 9), (.5, .5, 8), (1, .5, 7), (1.5, .5, 6), (2, 1, 7), (3, 1, 5)],
    [(0, 1, 8), (1, .5, 9), (1.5, .5, 8), (2, 1, 7), (3, 1, 6)],
    [(0, 1, 6), (1, 1, 5), (2, 2, 4)],
]
CH_X = [E, G, D, A, E, G, A, E]
MEL_X = [                                         # Xuanwu, e-Moll-Pentatonik (0 = E3)
    [(0, 2, 5), (2, 1, 6), (3, 1, 5)],
    [(0, 3, 6), (3, 1, 7)],
    [(0, 2, 8), (2, 2, 7)],
    [(0, 2, 6), (2, 1, 5), (3, 1, 3)],
    [(0, 2, 5), (2, 1, 6), (3, 1, 7)],
    [(0, 1, 8), (1, 1, 7), (2, 2, 6)],
    [(0, 1, 7), (1, 1, 8), (2, 2, 9)],
    [(0, 3, 8), (3, 1, 6)],
]
CH_Z = [A, Gb, E, B, A, Gb, E, B]
MEL_Z = [                                         # Zhuque, A-Dur-Pentatonik (0 = A3)
    [(0, .25, 5), (.25, .25, 6), (.5, .25, 7), (.75, .25, 8), (1, .5, 9), (1.5, .5, 8), (2, 1, 10), (3, 1, 8)],
    [(0, .25, 9), (.25, .25, 8), (.5, .25, 7), (.75, .25, 6), (1, .5, 5), (1.5, .5, 6), (2, 2, 4)],
    [(0, .25, 7), (.25, .25, 8), (.5, .25, 9), (.75, .25, 10), (1, 1, 9), (2, .5, 8), (2.5, .5, 7), (3, 1, 8)],
    [(0, 1, 6), (1, .5, 7), (1.5, .5, 8), (2, .5, 9), (2.5, .5, 8), (3, 1, 6)],
    [(0, .25, 8), (.25, .25, 9), (.5, .25, 10), (.75, .25, 11), (1, .5, 10), (1.5, .5, 9), (2, 1, 8), (3, 1, 10)],
    [(0, .5, 9), (.5, .5, 8), (1, .5, 7), (1.5, .5, 6), (2, 1, 9), (3, 1, 7)],
    [(0, .25, 8), (.25, .25, 9), (.5, .25, 10), (.75, .25, 11), (1, 1, 11), (2, 2, 10)],
    [(0, .25, 10), (.25, .25, 9), (.5, .25, 8), (.75, .25, 7), (1, 1, 6), (2, 2, 8)],
]
for chs, sc in ((CH_T, D_), (CH_W, B_), (CH_Q, G_), (CH_X, E_), (CH_Z, A_)):
    for c in chs: chk(c, sc)

# ==== Arrangement ============================================================================
# ---- Intro 0–3 (D, D, A, A) ---------------------------------------------------------------
for b, pc in enumerate([D, D, A, A]):
    pedal(b, pc, 80 + b * 3); bass(b, pc, 'n', 88 + b * 3); timp(b, pc, 'heart', 92 + b * 2)
    ostinato(b, pc, 0.5, 60 + b * 5); groove(b, 'T', 0.86 + b * 0.04)
    if b >= 2: pad(b, pc, 56 + (b - 2) * 12)
gong(0, 112); line(2, [(0, 2, 5), (2, 2, 7)], ['violin'], [86], D_); line(3, [(0, 1, 6), (1, 1, 5), (2, 2, 3)], ['violin'], [90], D_)
song.add('koto', song.bar(0), 0.4, n(D, 5), 80)
fill(3)

# ---- Thema 4–11 ---------------------------------------------------------------------------
gong(4, 110)
for i in range(8):
    b, pc = 4 + i, CH_T[i]
    pedal(b, pc, 84); bass(b, pc, 'n', 96); timp(b, pc, 'q', 96); ostinato(b, pc, 0.5, 66)
    groove(b, 'T', 1.0)
    line(b, MEL_T[i], ['violin', 'koto'], [96, 80], D_)
    if i >= 4: pad(b, pc, 60 + (i - 4) * 6)
    song.add('harp', song.bar(b) + 3.5, 0.4, r3(pc) + 19, 72)
fill(11, True)

# ---- Baihu (Metall) 12–19 ------------------------------------------------------------------
gong(12, 118)
for i in range(8):
    b, pc = 12 + i, CH_W[i]
    pedal(b, pc, 90); bass(b, pc, 'tiger', 102); timp(b, pc, 'gallop', 100)
    ostinato(b, pc, 0.25, 62 + (i // 4) * 6); groove(b, 'W', 1.0 + (0.04 if i >= 4 else 0))
    line(b, MEL_W[i], ['trumpet', 'brass'], [98, 86], B_)
    song.add('bell', song.bar(b), 0.9, r3(pc) + 24, 88)                       # Metall-Schlag
    if i >= 4: pad(b, pc, 66)
fill(15); fill(19, True)

# ---- Qinglong (Holz) 20–27 ------------------------------------------------------------------
gong(20, 112)
for i in range(8):
    b, pc = 20 + i, CH_Q[i]
    pedal(b, pc, 84); bass(b, pc, 'wave', 94); timp(b, pc, 'q', 92)
    dragon(b, pc, G_, 76 + (i // 4) * 6); groove(b, 'Wd', 1.0)
    line(b, MEL_Q[i], ['flute', 'violin'], [98, 76], G_)
    pad(b, pc, 58 + (i // 4) * 10, 'strings', 12)
    if i >= 4: pad(b, pc, 62)
fill(23); fill(27, True)

# ---- Xuanwu (Wasser) 28–35 -------------------------------------------------------------------
gong(28, 118)
for i in range(8):
    b, pc = 28 + i, CH_X[i]
    pedal(b, pc, 96); bass(b, pc, 'turtle', 104); timp(b, pc, 'slow', 104)
    groove(b, 'Wt', 1.02); pad(b, pc, 72 + (i // 4) * 8, 'strings', 0); pad(b, pc, 66 + (i // 4) * 8)
    line(b, MEL_X[i], ['tuba', 'strings', 'violin'], [100, 84, 80], E_)
    for j in range(8):                                                       # Wassertropfen
        k = [10, 8, 9, 7, 10, 9, 8, 7][(j + i) % 8]
        song.add('marimba', song.bar(b) + j * 0.5 + 0.25, 0.3, E_.d(k), 78 + (8 if j % 4 == 0 else 0))
fill(31); fill(35, True)

# ---- Zhuque (Feuer) 36–43 ---------------------------------------------------------------------
gong(36, 118)
for i in range(8):
    b, pc = 36 + i, CH_Z[i]
    pedal(b, pc, 90); bass(b, pc, 'fire', 100); timp(b, pc, 'gallop', 100)
    ostinato(b, pc, 0.25, 68 + (i // 4) * 6); groove(b, 'F', 1.0 + (0.05 if i >= 4 else 0))
    line(b, MEL_Z[i], ['trumpet', 'xylo'], [100, 86], A_)
    if i >= 4: line(b, MEL_Z[i], ['brass'], [84], A_, -12)
    pad(b, pc, 74 + (i // 4) * 10)
    song.add('brass', song.bar(b) + 3.5, 0.45, r3(pc) + 12, 90)
fill(39); fill(43, True)
snare_roll(43, 0, 2, 60, 90)

# ---- Konvergenz 44–51: Thema in Vollbesetzung + vier Bestien-Schichten -------------------------
gong(44, 122)
for i in range(8):
    b, pc = 44 + i, CH_T[i]
    pedal(b, pc, 96); bass(b, pc, 'tiger', 106); timp(b, pc, 'gallop', 104)
    ostinato(b, pc, 0.25, 76); groove(b, 'C', 1.0 + (0.04 if i >= 4 else 0))
    line(b, MEL_T[i], ['trumpet', 'brass', 'violin', 'flute'], [100, 90, 88, 84], D_)
    line(b, MEL_T[i], ['tuba'], [92], D_, -12)
    dragon(b, pc, D_, 70, 'harp')                                            # Drache
    song.add('bell', song.bar(b), 0.9, r3(pc) + 24, 90)                      # Tiger/Metall
    for j in range(8): song.add('marimba', song.bar(b) + j * 0.5 + 0.25, 0.3, D_.d([10, 9, 8, 7, 10, 9, 8, 7][j]), 74)   # Wasser
    song.add('xylo', song.bar(b) + 3, 0.25, D_.d(9), 84); song.add('xylo', song.bar(b) + 3.25, 0.25, D_.d(10), 88)  # Feuer
    pad(b, pc, 88 + (i // 4) * 6); pad(b, pc, 70, 'strings', 0)
fill(47); fill(51, True)

# ---- Rückführung 52–55: E E A A → D ---------------------------------------------------------------
for i, pc in enumerate([E, E, A, A]):
    b = 52 + i
    pedal(b, pc, 94); bass(b, pc, 'tiger', 104); timp(b, pc, 'roll' if i == 3 else 'gallop', 102)
    ostinato(b, pc, 0.25, 74 + i * 3); pad(b, pc, 78 + i * 4); pad(b, pc, 66, 'strings', 0)
    if i < 2: groove(b, 'C', 0.96)
    else: snare_roll(b, 0, 4, 60 + (i - 2) * 22, 96 + (i - 2) * 24)
line(52, [(0, 1, 5), (1, 1, 7), (2, 2, 8)], ['trumpet', 'brass', 'flute'], [98, 86, 82], D_)
line(53, [(0, 1, 7), (1, 1, 6), (2, 2, 5)], ['trumpet', 'brass', 'flute'], [98, 86, 82], D_)
line(54, [(0, .5, 3), (.5, .5, 4), (1, .5, 5), (1.5, .5, 6), (2, 1, 7), (3, 1, 8)], ['trumpet', 'brass', 'violin'], [102, 90, 86], D_)
line(55, [(0, .25, 5), (.25, .25, 6), (.5, .25, 7), (.75, .25, 8), (1, 1, 9), (2, 1.6, 8)], ['trumpet', 'violin'], [106, 92], D_)
fill(55, True)

sf2, out = cli_paths('bgm_theme_cardinalbeasts.ogg')
song.render(sf2, out)
