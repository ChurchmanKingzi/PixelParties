# -*- coding: utf-8 -*-
"""Theme-Battle-Track „Council of War“ (Archetyp War Counselors) → public/music/bgm_theme_warcounselors.ogg

Antike griechische Stadtstaaten im Kriegsrat: a-Phrygisch mit dorischer Aufhellung im Höhepunkt,
122 BPM, 60 Takte (118,0 s), nahtlos loopbar. Zwei Auloi (Oboe + Flöte) in Parallelterzen,
Lyra (Harfe), Fagott-Marsch, Pauken, Phalanx-Trommeln (Snare, Toms, Kick als Schildschlag) und
ein Bordun auf a–e. Dramaturgie nach den Karten: sechs verschiedene „War Counselors“ (Censpartan,
Cykyran, Gorinthian, Harpthenean, Minocrete, Thebinxan) beraten sich – im Ratsabschnitt setzen
sechs Stimmen (Oboe, Flöte, Klarinette, Fagott, Hörner, Trompete) nacheinander mit demselben
Motiv ein (Kanon); je mehr Berater, desto stärker der Marsch („War Council Gathering Place“).

Aufbau (Takte, 0-basiert):
   0– 7  Intro         Bordun, Fagott-Marsch, Pauken/Toms, Pizzicato-Schritt, Lyra, Aulos-Ruf
   8–23  Thema A       zwei Auloi in Terzen über Am–B–Am–Gm | F–Gm–B–E5 (a-phrygisch); 2. Durchgang
                       mit Hörnern, Streichern und Lyra-16teln
  24–31  Kriegsrat     Kanon: sechs Stimmen setzen im Takt-Abstand mit dem Ratsmotiv ein, Chor
  32–39  Aufmarsch C1  Thema A als Blech-Unisono (Trompete/Posaune/Aulos), volle Phalanx
  40–47  Sieg C2       dorische Wendung (fis, h): Am–D–G–Em, Hymne mit Chor und Blech
  48–55  Rückblick     Lyra und Aulos, leiser Marsch, Flöte/Klarinette treten wieder dazu
  56–59  Rückführung   Paukenwirbel, Snare-Crescendo, Ratsmotiv im Blech → zurück auf Takt 0

Harmonie: A-phrygisch (A B♭ C D E F G) bzw. dorisch (A H C D E Fis G); Loop endet auf E-Quinte
(Halbschluss, keine Schlusskadenz).
Aufruf:  python3 scripts/music/theme_warcounselors.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 122, 60                       # 60 × 4 × 60/122 = 118,0 s
song = Song(bpm=BPM, bars=BARS)

song.inst('contra',   'contra',   84, 64)   # Bordun
song.inst('bassoon',  'bassoon',  98, 58)   # Marsch-Bass / Kanon
song.inst('timp',     'timp',     96, 64)
song.inst('pizz',     'pizz',     84, 40)
song.inst('strings',  'strings',  74, 44)
song.inst('harp',     'harp',     92, 88)   # Lyra
song.inst('oboe',     'oboe',     92, 66)   # Aulos I
song.inst('flute',    'flute',    84, 76)   # Aulos II
song.inst('clarinet', 'clarinet', 80, 50)
song.inst('horns',    'horns',    84, 36)
song.inst('trumpet',  'trumpet',  88, 72)
song.inst('brass',    'brass',    78, 82)
song.inst('choir',    'choir',    76, 64)
song.inst('hit',      'hit',      96, 64)   # Schildschlag

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'F#': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
PHR = {A, Bb, C, D, E, F, G}              # a-Phrygisch
DOR = {A, B, C, D, E, Gb, G}              # a-Dorisch

# Akkord → Tonklassen (Grundton zuerst)
CH = {'Am': (A, C, E), 'Bb': (Bb, D, F), 'Gm': (G, Bb, D), 'F': (F, A, C), 'E5': (E, B, E),
      'D': (D, Gb, A), 'G': (G, B, D), 'Em': (E, G, B)}
def root2(ch): return n(CH[ch][0], 2)                                   # 36–47
def contra_p(ch):
    p = root2(ch) - 12; return p if p >= 28 else root2(ch)
def up(pc, base):
    p = n(pc, 3)
    while p < base: p += 12
    return p
def voicing(ch, base=None):
    t = CH[ch]; b = base if base else n(t[0], 3)
    ps = [up(t[0], b)]
    for pc in t[1:]:
        p = up(pc, ps[-1] + 1); ps.append(p)
    return ps

# ---- Begleit-Bausteine ---------------------------------------------------------------------
def drone(b, ch, vel=80):
    song.add('contra', song.bar(b), 3.97, contra_p(ch), vel)

def march_bass(b, ch, kind='q', vel=98):
    r = root2(ch); f = r + 7; s = song.bar(b)
    if kind == 'q':
        for off, p, v in ((0, r, vel + 8), (1, r, vel - 8), (2, f if ch != 'E5' else r, vel), (3, r, vel - 8)):
            song.add('bassoon', s + off, 0.8, p, v)
    else:                                          # 8tel-Gallop (Aufmarsch)
        for i in range(8): song.add('bassoon', s + i * 0.5, 0.4, r if i != 6 else f, vel + (8 if i % 4 == 0 else 0))

def timp(b, ch, kind='q', vel=96, v1=None):
    s = song.bar(b); p = root2(ch)
    if kind == 'q':
        for off in (0, 2): song.add('timp', s + off, 0.5, p, vel)
    elif kind == 'gallop':
        for off, v in ((0, 0), (1, -8), (1.5, -14), (2, -2), (3, -8), (3.5, -14)): song.add('timp', s + off, 0.4, p, vel + v)
    else:
        for i in range(16): song.add('timp', s + i * 0.25, 0.25, p, vel + ((v1 or vel) - vel) * i / 15)

def pizz_step(b, ch, vel=80):                     # Hoplitenschritt: Akkord auf 2 und 4, Grundton auf 1 und 3
    v = voicing(ch, n(CH[ch][0], 3) + 12 * (CH[ch][0] < 5))
    for off in (1, 3):
        for p in v: song.add('pizz', song.bar(b) + off, 0.4, p, vel)
    song.add('pizz', song.bar(b), 0.4, root2(ch) + 12, vel + 6); song.add('pizz', song.bar(b) + 2, 0.4, root2(ch) + 12, vel)

def strings_stac(b, ch, vel=74):
    v = voicing(ch, n(CH[ch][0], 3) + 12 * (CH[ch][0] < 5))
    for i in range(8):
        for p in (v[0], v[1] if i % 2 else v[2]): song.add('strings', song.bar(b) + i * 0.5, 0.4, p, vel + (8 if i % 4 == 0 else 0))

def lyra(b, ch, level=1, vel=84):
    v = voicing(ch, n(CH[ch][0], 3) + 12 * (CH[ch][0] < 5))
    cyc = [v[0], v[1], v[2], v[0] + 12, v[2], v[1], v[2] + 0, v[1] + 12] if level == 1 else \
          [v[0], v[1], v[2], v[0] + 12, v[1] + 12, v[2] + 12, v[1] + 12, v[0] + 12]
    step = 0.5 if level == 1 else 0.25
    for i in range(int(4 / step)):
        p = cyc[i % 8]
        song.add('harp', song.bar(b) + i * step, step * 1.6, p, vel + (8 if i % (8 if level == 1 else 16) == 0 else 0) - (6 if i % 2 else 0))

def pad(b, ch, inst='horns', vel=70):
    v = voicing(ch, n(CH[ch][0], 3) + 12 * (CH[ch][0] < 5))
    for p in v: song.add(inst, song.bar(b), 3.97, p, vel)

def hit(b, ch, vel=112, dur=0.9):
    v = voicing(ch, n(CH[ch][0], 3))
    for p in (v[0] - 12, v[0], v[1], v[2]): song.add('hit', song.bar(b), dur, p, vel)

# ---- Melodie -----------------------------------------------------------------------------------
def line(b, notes, insts, vels, scale, shift=0):
    for off, dur, p in notes:
        assert (nt(p) % 12) in scale, p
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.93, nt(p) + shift, v)

def third_below(notes, scale_list, steps=2):
    """Zweite Aulos-Stimme: Parallele eine Terz tiefer im Tonvorrat (steps Leiterstufen)."""
    out = []
    for off, dur, p in notes:
        m = nt(p); pcs = sorted(scale_list)
        k = m
        cnt = 0
        while cnt < steps:
            k -= 1
            if k % 12 in scale_list: cnt += 1
        out.append((off, dur, k))
    return out

def line_midi(b, notes, inst, vel, scale):
    for off, dur, k in notes:
        assert k % 12 in scale
        song.add(inst, song.bar(b) + off, dur * 0.93, k, vel)

CH_A = ['Am', 'Bb', 'Am', 'Gm', 'F', 'Gm', 'Bb', 'E5']
MEL_A = [
    [(0, .5, 'A4'), (.5, .5, 'A4'), (1, 1, 'C5'), (2, 1, 'E5'), (3, .5, 'D5'), (3.5, .5, 'C5')],
    [(0, 1, 'D5'), (1, 1, 'Bb4'), (2, 1.5, 'F5'), (3.5, .5, 'D5')],
    [(0, .5, 'A4'), (.5, .5, 'A4'), (1, 1, 'C5'), (2, 1, 'E5'), (3, 1, 'A5')],
    [(0, 1.5, 'G5'), (1.5, .5, 'E5'), (2, 1, 'D5'), (3, 1, 'C5')],
    [(0, 1, 'C5'), (1, 1, 'F5'), (2, 1, 'A5'), (3, 1, 'F5')],
    [(0, 1, 'G5'), (1, 1, 'E5'), (2, 1, 'D5'), (3, 1, 'C5')],
    [(0, 1, 'D5'), (1, 1, 'F5'), (2, 1, 'Bb5'), (3, 1, 'A5')],
    [(0, 2, 'E5'), (2, 1, 'D5'), (3, 1, 'C5')],
]
CELL = [(0, .5, 'A4'), (.5, .5, 'C5'), (1, 1, 'E5'), (2, .5, 'D5'), (2.5, .5, 'C5'), (3, 1, 'A4')]     # Ratsmotiv
CH_D = ['Am', 'D', 'G', 'Em', 'Am', 'D', 'Em', 'E5']
MEL_D = [
    [(0, .5, 'A4'), (.5, .5, 'A4'), (1, 1, 'C5'), (2, 1, 'E5'), (3, 1, 'A5')],
    [(0, 1, 'A5'), (1, 1, 'F#5'), (2, 1, 'D5'), (3, 1, 'F#5')],
    [(0, 1, 'G5'), (1, 1, 'B4'), (2, 1, 'D5'), (3, 1, 'G5')],
    [(0, 1.5, 'E5'), (1.5, .5, 'G5'), (2, 1, 'B5'), (3, 1, 'G5')],
    [(0, .5, 'A4'), (.5, .5, 'A4'), (1, 1, 'C5'), (2, 1, 'E5'), (3, 1, 'A5')],
    [(0, 1, 'F#5'), (1, 1, 'A5'), (2, 1, 'F#5'), (3, 1, 'D5')],
    [(0, 1, 'E5'), (1, 1, 'G5'), (2, 1, 'B5'), (3, 1, 'A5')],
    [(0, 1.5, 'G5'), (1.5, .5, 'E5'), (2, 2, 'B4')],
]

# ---- Schlagzeug ---------------------------------------------------------------------------------
TOMS = [TOM_H, TOM_HH, TOM_M, TOM_L]
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, vel * v)
    if kind == 'lite':
        d(0, KICK, 108); d(2, KICK, 100); d(1, SNARE, 90); d(3, SNARE, 96); d(3.5, SNARE, 66)
        for i in (0.5, 1.5, 2.5): d(i, SIDESTICK, 70)
        d(0, TOM_L, 84); d(2, TOM_L, 80)
    elif kind == 'march':
        d(0, KICK, 112); d(2, KICK, 104); d(0, TOM_L, 90); d(2, TOM_L, 84)
        for off, vel in ((0.5, 66), (1, 104), (1.5, 66), (1.75, 60), (2.5, 66), (3, 106), (3.5, 68), (3.75, 62)): d(off, SNARE, vel)
        for i in range(8): d(i * 0.5, HAT, 100 if i % 2 == 0 else 84)
        d(1, SIDESTICK, 76); d(3, SIDESTICK, 78)
    elif kind == 'phalanx':
        for off, vel in ((0, 116), (1, 100), (2, 108), (3, 100)): d(off, KICK, vel)
        for off, vel in ((1, 110), (1.5, 76), (2.5, 78), (3, 112), (3.5, 80), (3.75, 70)): d(off, SNARE, vel)
        d(0, TOM_L, 100); d(0.5, TOM_M, 88); d(2, TOM_L, 100); d(2.75, TOM_M, 88)
        d(1, CLAP, 82); d(3, CLAP, 86)
        for i in range(8): d(i * 0.5, HAT, 106 if i % 2 == 0 else 88)
        d(2.5, COWBELL, 78)
    elif kind == 'soft':
        d(0, KICK, 92); d(2, KICK, 84); d(1, SIDESTICK, 84); d(3, SIDESTICK, 88); d(3.5, SNARE, 60)
        for i in range(8): d(i * 0.5, HAT, 92 if i % 2 == 0 else 76)
def fill(b, big=False):
    s = song.bar(b)
    if big:
        for i in range(8): song.dr(s + 1.5 + i * 0.25, SNARE, 66 + i * 7, 0.12)
    else:
        for i in range(4): song.dr(s + 2.0 + i * 0.5, SNARE, 78 + i * 8, 0.15)
    for i in range(8): song.dr(s + 2.0 + i * 0.25 if not big else s + 2.5 + i * 0.1875, TOMS[min(3, i // 2)], 88 + i * 4, 0.2)
    song.dr(s + 3.75, KICK, 118)
def roll(b, a, z, v0, v1):
    s = song.bar(b) + a; cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, v0 + (v1 - v0) * i / max(1, cnt - 1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ==== Arrangement ===============================================================================
# ---- Intro 0–7 ------------------------------------------------------------------------------------
CH_I = ['Am', 'Am', 'Bb', 'Am', 'Am', 'Bb', 'Gm', 'E5']
for i, ch in enumerate(CH_I):
    drone(i, ch, 74 + i * 2)
    march_bass(i, ch, 'q', 90 + i * 2)
    timp(i, ch, 'q', 92 + i * 2)
    pizz_step(i, ch, 74 + i * 2)
    groove(i, 'lite' if i < 4 else 'march', 0.95 + i * 0.01)
    if i >= 4: lyra(i, ch, 1, 74 + (i - 4) * 4)
    if i >= 2: pad(i, ch, 'horns', 56 + i * 3)
hit(0, 'Am', 112, 1.4); crash(0, 108)
line(6, [(0, .5, 'A4'), (.5, .5, 'C5'), (1, 1, 'E5'), (2, 2, 'D5')], ['oboe'], [92], PHR)
line(7, [(0, .5, 'A4'), (.5, .5, 'C5'), (1, 1, 'E5'), (2, 2, 'A5')], ['oboe', 'flute'], [98, 80], PHR)
fill(3); fill(7, True)

# ---- Thema A 8–23 ----------------------------------------------------------------------------------
crash(8, 110); hit(8, 'Am', 106, 0.8)
for i in range(16):
    b, k, second = 8 + i, i % 8, i >= 8
    ch = CH_A[k]
    drone(b, ch, 78 + (4 if second else 0))
    march_bass(b, ch, 'q', 98 + (4 if second else 0))
    timp(b, ch, 'q', 96)
    groove(b, 'march', 1.0 + (0.05 if second else 0))
    lyra(b, ch, 2 if second else 1, 80)
    mel = MEL_A[k]
    line(b, mel, ['oboe'], [96 if second else 92], PHR)
    line_midi(b, third_below(mel, PHR), 'flute', 82 if second else 78, PHR)
    if second:
        pad(b, ch, 'horns', 72); strings_stac(b, ch, 66)
    else:
        pizz_step(b, ch, 76)
fill(15); fill(23, True)

# ---- Kriegsrat 24–31: Kanon, sechs Berater ------------------------------------------------------------
CH_K = ['Am', 'Bb', 'Am', 'Gm', 'Am', 'Bb', 'Gm', 'E5']
VOICES = [('oboe', 0, 92), ('flute', 0, 84), ('clarinet', -12, 84), ('bassoon', -24, 90), ('horns', -12, 84), ('trumpet', 0, 88)]
crash(24, 112); hit(24, 'Am', 112, 1.0)
for i, ch in enumerate(CH_K):
    b = 24 + i
    drone(b, ch, 84)
    timp(b, ch, 'gallop' if i >= 3 else 'q', 96)
    groove(b, 'march', 1.08)
    lyra(b, ch, 1, 78)
    if i < 3: march_bass(b, ch, 'q', 100)
    for j, (inst, sh, vel) in enumerate(VOICES):
        if i >= j: line(b, CELL, [inst], [vel + i], PHR, sh)         # Einsätze im Takt-Abstand
    if i >= 2: pad(b, ch, 'choir', 60 + i * 5)
    if i >= 1: pizz_step(b, ch, 76)
roll(30, 2, 4, 60, 100); roll(31, 0, 3.5, 80, 124); fill(31, True)

# ---- Aufmarsch C1 32–39: Thema A als Blech-Unisono (a-phrygisch) ---------------------------------------
crash(32, 118); hit(32, 'Am', 120, 1.2)
for i in range(8):
    b, ch = 32 + i, CH_A[i]
    drone(b, ch, 90)
    march_bass(b, ch, 'g', 102)
    timp(b, ch, 'gallop', 102)
    groove(b, 'phalanx', 1.0)
    strings_stac(b, ch, 78)
    pad(b, ch, 'horns', 78); pad(b, ch, 'choir', 74)
    lyra(b, ch, 2, 78)
    mel = MEL_A[i]
    line(b, mel, ['trumpet', 'oboe', 'brass'], [98, 90, 78], PHR)
    line_midi(b, third_below(mel, PHR), 'flute', 84, PHR)
fill(35); fill(39, True)

# ---- Sieg C2 40–47: dorische Wendung ----------------------------------------------------------------------
crash(40, 120); hit(40, 'Am', 122, 1.2)
for i in range(8):
    b, ch = 40 + i, CH_D[i]
    drone(b, ch, 92)
    march_bass(b, ch, 'g', 104)
    timp(b, ch, 'gallop', 104)
    groove(b, 'phalanx', 1.06)
    strings_stac(b, ch, 80)
    pad(b, ch, 'horns', 82); pad(b, ch, 'choir', 82)
    lyra(b, ch, 2, 80)
    mel = MEL_D[i]
    line(b, mel, ['trumpet', 'oboe', 'brass'], [104, 92, 84], DOR)
    line_midi(b, third_below(mel, DOR), 'flute', 86, DOR)
    if i in (4,): crash(b, 104)
fill(43); fill(47, True)

# ---- Rückblick 48–55 -------------------------------------------------------------------------------------------
crash(48, 100)
for i in range(8):
    b, ch = 48 + i, CH_A[i]
    drone(b, ch, 76)
    march_bass(b, ch, 'q', 90)
    timp(b, ch, 'q', 84)
    groove(b, 'soft', 1.0)
    lyra(b, ch, 2 if i >= 4 else 1, 84)
    mel = MEL_A[i]
    line(b, mel, ['oboe'], [88 + i], PHR)
    if i >= 4:
        line_midi(b, third_below(mel, PHR), 'flute', 74 + i, PHR)
        pad(b, ch, 'horns', 56 + (i - 4) * 6); pizz_step(b, ch, 74)
    if i >= 6: pad(b, ch, 'choir', 56 + (i - 6) * 8)
fill(55)

# ---- Rückführung 56–59: Wirbel, Ratsmotiv im Blech, Sprung zum Intro ---------------------------------------------------
CH_R = ['Bb', 'Gm', 'Bb', 'E5']
crash(56, 108); hit(56, 'Bb', 112, 1.0)
for i, ch in enumerate(CH_R):
    b = 56 + i
    drone(b, ch, 84 + i * 3)
    march_bass(b, ch, 'g', 96 + i * 3)
    timp(b, ch, 'roll' if i >= 2 else 'gallop', 96 + i * 4, 122 if i >= 2 else None)
    strings_stac(b, ch, 66 + i * 6)
    pad(b, ch, 'horns', 66 + i * 6); pad(b, ch, 'choir', 60 + i * 7)
    if i < 2: groove(b, 'phalanx', 0.95)
    else: roll(b, 0, 4, 55 + (i - 2) * 14, 88 + (i - 2) * 18)
line(56, CELL, ['trumpet', 'brass'], [96, 80], PHR)
line(58, CELL, ['trumpet', 'brass', 'oboe'], [100, 84, 90], PHR)
line(59, [(0, .5, 'A4'), (.5, .5, 'C5'), (1, 1, 'E5'), (2, 1, 'A5')], ['trumpet', 'oboe'], [106, 92], PHR)
fill(57); fill(59, True)

sf2, out = cli_paths('bgm_theme_warcounselors.ogg')
song.render(sf2, out)
