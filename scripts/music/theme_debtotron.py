# -*- coding: utf-8 -*-
"""Battle-Theme „Interest Rate Inferno“ (Debt-O-Tron) → public/music/bgm_theme_debtotron.ogg

Gnadenlos getakteter Inkasso-Roboter-Marsch in h-Moll (mit Leitton ais über Fis-Dur), 140 BPM,
64 Takte (109,7 s), nahtlos loopbar. Marimba-Sequenzer (Lochkarten-16tel), Kuhglocke + Sidestick
als Stempeluhr, Kassenklingeln in Glockenspiel/Bell, Firmen-Fanfare in Blech, Quadrat-Bass.
Das Schuldenmotiv (h-h-d-fis: drei Schritte hinauf, „der Zins steigt“) wird in B mit jedem
Takt eine Stufe höher gestapelt; der Sequenzer beschleunigt von Achteln auf 16tel.

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Stempeluhr (Cowbell/Sidestick), Sequenzer in Achteln, Quadrat-Bass, Blech-Stempelschläge
   8–23  Thema A        Firmen-Fanfare (Blech), Kassen-Klingeln, Posaunen-Gegenstimme im 2. Durchgang
  24–39  Zinseszins B   Wurzeln steigen (h cis d e fis g a fis), Motiv steigt mit, Sequenzer 16tel, Bass 16tel, Pad
  40–55  Höhepunkt C    volles Blech + Quadrat-Lead, Terzparallelen, Vier-auf-den-Boden, Kassenklingeln
  56–63  Rückführung D  Sequenzer + Uhr allein, Fis-Orgelpunkt, Riser → Takt 0
Aufruf:  python3 scripts/music/theme_debtotron.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 140, 64                      # 64 × 4 × 60/140 = 109,7 s
song = Song(bpm=BPM, bars=BARS)
song.inst('bass',   'squarebass', 100, 60)
song.inst('seq',    'marimba',     96, 40)
song.inst('seq2',   'marimba',     84, 90)
song.inst('coin',   'glock',       90, 96)
song.inst('bell',   'bell',        82, 30)
song.inst('brass',  'brass',       88, 66)
song.inst('sbrass', 'sbrass',      86, 50)
song.inst('trom',   'trombone',    86, 84)
song.inst('lead',   'square',      78, 74)
song.inst('pad',    'poly',        70, 56)
song.inst('muted',  'muted',       90, 36)
song.inst('hit',    'hit',         96, 64)
song.inst('timp',   'timp',        90, 64)

PCS = {B, Db, D, E, Gb, G, A}                   # h-Moll natürlich (Db = cis, Gb = fis)
SC = [m for m in range(24, 108) if m % 12 in PCS]
def st(m, k): return SC[SC.index(m) + k]
NM = {'C': C, 'D': D, 'E': E, 'F': F, 'G': G, 'A': A, 'B': B}
def nt(s):                                       # 'F#5' → MIDI
    pc = NM[s[0]] + (1 if s[1] == '#' else 0); return n(pc % 12, int(s[-1]))
def mel_ok(m): assert m % 12 in PCS | {Bb}, m; return m
# Akkorde: Grundton-Pitchclass, Intervalle
CHD = {'Bm': (B, (0, 3, 7)), 'G': (G, (0, 4, 7)), 'D': (D, (0, 4, 7)), 'A': (A, (0, 4, 7)), 'Em': (E, (0, 3, 7)),
       'Fs': (Gb, (0, 4, 7)), 'Fsm': (Gb, (0, 3, 7)), 'Csd': (Db, (0, 3, 6))}
def rootb(ch): pc = CHD[ch][0]; return 36 + pc if pc <= 6 else 24 + pc      # Oktave 1–2
def base(ch, lo): pc = CHD[ch][0]; return lo + ((pc - lo) % 12)
def tones(ch, lo): r = base(ch, lo); return [r + i for i in CHD[ch][1]]
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

def bass(b, ch, kind, vel=100):
    s = song.bar(b); r = rootb(ch)
    if kind == 'q':                              # Vierteln, Marsch
        for i in range(4): song.add('bass', s + i, 0.8, r, vel + (8 if i == 0 else 0))
    elif kind == 'e':                            # Achtel-Pump mit Oktave
        for i in range(8): song.add('bass', s + i * 0.5, 0.4, r + (12 if i % 4 == 3 else 0), vel + (8 if i % 4 == 0 else 0))
    elif kind == 's':                            # 16tel-Motor
        for i in range(16): song.add('bass', s + i * 0.25, 0.22, r + (12 if i % 8 == 6 else 0), vel + (10 if i % 4 == 0 else -6))
def seq(b, ch, level, vel=80, inst='seq'):
    """Sequenzer: 1 = Achtel Grundton/Quinte, 2 = 16tel-Lochkarte, 3 = 16tel mit Terz/Oktavsprüngen."""
    s = song.bar(b); t = tones(ch, 48); r, th, f = t
    if level == 1: cyc, step = [r, f, r + 12, f], 0.5
    elif level == 2: cyc, step = [r, r + 12, f, r + 12] * 4, 0.25
    else: cyc, step = [r, r + 12, f, r + 12, r, r + 12, f, r + 12, r, r + 12, th + 12, r + 12, r, f, r + 12, f + 12], 0.25
    for i in range(int(4 / step)): song.add(inst, s + i * step, step * 0.8, cyc[i % len(cyc)], vel + (12 if i % 4 == 0 else 0))
def pad(b, ch, vel=64):
    for p in tones(ch, 55): song.add('pad', song.bar(b), 3.95, p, vel)
def coin(b, ch, vel=90, dense=False):
    """Kassenklingeln: zwei schnelle Glockentöne (Grundton/Quinte, Oktave 6)."""
    s = song.bar(b); t = tones(ch, 72)
    song.add('coin', s + 3.5, 0.3, t[2] + 12, vel); song.add('coin', s + 3.75, 0.5, t[0] + 24, vel + 8)
    if dense: song.add('coin', s + 1.5, 0.3, t[1] + 12, vel - 10); song.add('coin', s + 1.75, 0.5, t[2] + 12, vel - 4)
def stab(b, ch, vel=88):
    for p in tones(ch, 60): song.add('muted', song.bar(b) + 1.5, 0.4, p, vel); song.add('muted', song.bar(b) + 3.5, 0.4, p, vel - 6)
def stamp(b, beat, ch, vel=110):
    for p in tones(ch, 48) + [base(ch, 60)]: song.add('hit', song.bar(b) + beat, 0.7, p, vel)
def timp(b, ch, vel=96):
    p = rootb(ch) + (12 if rootb(ch) < 38 else 0)
    for off in (0, 2): song.add('timp', song.bar(b) + off, 0.5, p, vel)
def line(b, notes, insts, vels, shift=0):
    for off, d, p in notes:
        m = mel_ok(nt(p) if isinstance(p, str) else p) + shift
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, d * 0.92, m, v)

# ---- Schlagzeug: Marsch, Uhr, Kuhglocke ------------------------------------------------------
TOMS = [TOM_H, TOM_HH, TOM_M, TOM_L]
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'clock':                          # Intro / Rückführung: Stempeluhr
        for off in (0, 2): d(off, KICK, 108)
        for off in (1, 3): d(off, SNARE, 100)
        for i in range(8): d(i * 0.5, COWBELL, 96 if i % 2 == 0 else 74)
        for i in range(16): d(i * 0.25, SIDESTICK, 78 if i % 4 == 0 else 58)
        d(3.75, SNARE, 84)
    elif kind == 'A':
        for off, vel in ((0, 112), (1.5, 90), (2, 108), (3.5, 92)): d(off, KICK, vel)
        d(1, SNARE, 106); d(3, SNARE, 110); d(1, CLAP, 84); d(3, CLAP, 88)
        for i in range(8): d(i * 0.5, HAT, 110 if i % 2 == 0 else 90)
        d(0.5, COWBELL, 84); d(2.5, COWBELL, 84); d(1.75, SNARE, 66); d(3.75, SNARE, 72)
    elif kind == 'B':
        for i in range(4): d(i, KICK, 108 + (6 if i == 0 else 0))
        d(1, SNARE, 110); d(3, SNARE, 114); d(1, CLAP, 90); d(3, CLAP, 94)
        for i in range(16): d(i * 0.25, SNARE, 60 if i % 2 else 76) if i not in (4, 12) else None
        for i in range(8): d(i * 0.5, HAT, 112 if i % 2 == 0 else 92)
        d(0.5, COWBELL, 92); d(2.5, COWBELL, 92)
    elif kind == 'C':
        for i in range(4): d(i, KICK, 116)
        d(2.5, KICK, 100); d(3.75, KICK, 96)
        d(1, SNARE, 118); d(3, SNARE, 120); d(1, CLAP, 96); d(3, CLAP, 100)
        for i in range(8): d(i * 0.5, RIDE, 118 if i % 2 == 0 else 100)
        for off in (0.5, 1.5, 2.5, 3.5): d(off, COWBELL, 90)
        d(2.75, TOM_M, 94); d(3.5, TOM_L, 96)
def fill(b, big=False):
    s = song.bar(b)
    if big:
        for i in range(8): song.dr(s + 1.5 + i * 0.25, SNARE, ramp(i, 8, 70, 114), 0.12)
    for i in range(8): song.dr(s + 2.0 + i * 0.25 if not big else s + 2.5 + i * 0.1875, TOMS[min(3, i // 2)], ramp(i, 8, 92, 120), 0.2)
    song.dr(s + 3.75, KICK, 118)
def snare_roll(b, a, z, v0, v1):
    s = song.bar(b) + a; cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Melodien ---------------------------------------------------------------------------------
CH_A = ['Bm', 'Bm', 'G', 'G', 'Em', 'Fs', 'Bm', 'Fs']
MEL_A = [
    [(0, .5, 'B4'), (.5, .5, 'B4'), (1, 1, 'D5'), (2, 2, 'F#5')],
    [(0, .5, 'E5'), (.5, .5, 'D5'), (1, .5, 'C#5'), (1.5, .5, 'D5'), (2, 2, 'B4')],
    [(0, .5, 'G4'), (.5, .5, 'G4'), (1, 1, 'B4'), (2, 2, 'D5')],
    [(0, .5, 'E5'), (.5, .5, 'D5'), (1, 1, 'B4'), (2, 2, 'G4')],
    [(0, .5, 'E5'), (.5, .5, 'E5'), (1, 1, 'G5'), (2, 2, 'B5')],
    [(0, 1, 'C#5'), (1, 1, 'F#5'), (2, 1, 'A#5'), (3, 1, 'F#5')],
    [(0, 1, 'D5'), (1, 1, 'F#5'), (2, 1, 'B5'), (3, 1, 'A5')],
    [(0, 1, 'F#5'), (1, 1, 'E5'), (2, 1, 'C#5'), (3, 1, 'A#4')],
]
CH_B = ['Bm', 'Csd', 'D', 'Em', 'Fsm', 'G', 'A', 'Fs']
SH_B = [0, 1, 2, 3, 4, 5, 6, 4]
def mel_b(k, hi=0):
    r = st(nt('B4'), SH_B[k]) + 12 * hi
    if k == 7: return [(0, 1, nt('C#5') + 12 * hi), (1, 1, nt('F#5') + 12 * hi), (2, 1, nt('A#5') + 12 * hi), (3, 1, nt('C#6') + 12 * hi)]
    return [(0, .5, r), (.5, .5, r), (1, 1, st(r, 2)), (2, 2, st(r, 4))]
CH_C = ['Bm', 'G', 'D', 'A', 'Em', 'G', 'Fs', 'Fs']
MEL_C = [
    [(0, .5, 'B4'), (.5, .5, 'B4'), (1, .5, 'D5'), (1.5, .5, 'F#5'), (2, 2, 'B5')],
    [(0, .5, 'G5'), (.5, .5, 'F#5'), (1, .5, 'E5'), (1.5, .5, 'D5'), (2, 1, 'B4'), (3, 1, 'D5')],
    [(0, .5, 'F#5'), (.5, .5, 'F#5'), (1, .5, 'A5'), (1.5, .5, 'F#5'), (2, 2, 'D6')],
    [(0, .5, 'C#6'), (.5, .5, 'B5'), (1, .5, 'A5'), (1.5, .5, 'G5'), (2, 1, 'E5'), (3, 1, 'A5')],
    [(0, .5, 'E5'), (.5, .5, 'E5'), (1, .5, 'G5'), (1.5, .5, 'B5'), (2, 2, 'E6')],
    [(0, 1, 'D6'), (1, 1, 'B5'), (2, 1, 'G5'), (3, 1, 'B5')],
    [(0, 1, 'C#6'), (1, 1, 'A#5'), (2, 1, 'F#5'), (3, 1, 'A#5')],
    [(0, 1.5, 'C#6'), (1.5, .5, 'A#5'), (2, 2, 'F#5')],
]

# ==== Arrangement ==============================================================================
# Intro 0–7: Bm Bm G G Em Em Fs Fs
CH_I = ['Bm', 'Bm', 'G', 'G', 'Em', 'Em', 'Fs', 'Fs']
stamp(0, 0, 'Bm', 112); crash(0, 108)
for b, ch in enumerate(CH_I):
    bass(b, ch, 'q' if b < 4 else 'e', 92 + b * 2)
    seq(b, ch, 1, 74 + b * 3); groove(b, 'clock', 1.0 + b * 0.02)
    if b >= 2: coin(b, ch, 84)
    if b >= 4: stab(b, ch, 86); pad(b, ch, 50 + (b - 4) * 6); timp(b, ch, 90)
stamp(4, 0, 'Em', 108)
line(7, [(0, .5, 'B4'), (.5, .5, 'B4'), (1, 1, 'D5'), (2, 2, 'F#5')], ['brass', 'sbrass'], [92, 84])
snare_roll(7, 0, 3.5, 60, 116); fill(7, big=True)

# Thema A 8–23
stamp(8, 0, 'Bm', 116); crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; sec = i >= 8
    bass(b, ch, 'e', 100); seq(b, ch, 2, 78 + (6 if sec else 0)); seq(b, ch, 1, 58, 'seq2')
    groove(b, 'A', 1.0 + (0.05 if sec else 0)); timp(b, ch, 96)
    line(b, MEL_A[k], ['brass', 'sbrass'] + (['lead'] if sec else []), [96, 86, 74])
    coin(b, ch, 88, dense=sec); stab(b, ch, 74)
    pad(b, ch, 58 + (8 if sec else 0))
    if sec:
        t = tones(ch, 48)
        for j, p in enumerate((t[0], t[2])): song.add('trom', song.bar(b) + j * 2, 1.9, p, 84)
fill(15); crash(16, 104); snare_roll(22, 2, 4, 60, 100); snare_roll(23, 0, 3, 80, 122); fill(23, big=True)

# Zinseszins B 24–39
stamp(24, 0, 'Bm', 118); crash(24, 114); stamp(32, 0, 'Bm', 120); crash(32, 116)
for i in range(16):
    b, k = 24 + i, i % 8; ch = CH_B[k]; sec = i >= 8
    bass(b, ch, 's', 100); seq(b, ch, 3, 84 + (6 if sec else 0)); seq(b, ch, 2, 60, 'seq2')
    groove(b, 'B', 1.0 + (0.05 if sec else 0)); timp(b, ch, 98)
    line(b, mel_b(k, 0), ['brass', 'sbrass'] + (['lead'] if sec else []), [96, 88, 76])
    if sec: line(b, mel_b(k, 1), ['coin'], [70])
    pad(b, ch, 68 + k * 2); coin(b, ch, 90, dense=True); stab(b, ch, 78)
    if sec:
        t = tones(ch, 48)
        for j, p in enumerate((t[0], t[2])): song.add('trom', song.bar(b) + j * 2, 1.9, p, 88)
fill(31); fill(35); snare_roll(38, 0, 4, 60, 104); snare_roll(39, 0, 3, 92, 127); fill(39, big=True)

# Höhepunkt C 40–55
stamp(40, 0, 'Bm', 124); crash(40, 120); stamp(48, 0, 'Bm', 120); crash(48, 118)
for i in range(16):
    b, k = 40 + i, i % 8; ch = CH_C[k]; sec = i >= 8
    bass(b, ch, 's', 106); seq(b, ch, 3, 84); seq(b, ch, 2, 62, 'seq2')
    groove(b, 'C', 1.0 + (0.04 if sec else 0)); timp(b, ch, 104)
    line(b, MEL_C[k], ['brass', 'sbrass', 'lead'], [102, 94, 80])
    if sec:                                        # Terzparallele (diatonisch) im Blech
        for off, d, p in MEL_C[k]:
            m = nt(p)
            if m in SC: song.add('trom', song.bar(b) + off, d * 0.92, st(m, -2) - 12 + 12, 90)
    pad(b, ch, 84); coin(b, ch, 96, dense=True); stab(b, ch, 84)
    t = tones(ch, 48)
    for j, p in enumerate((t[0], t[2])): song.add('trom', song.bar(b) + j * 2, 1.9, p, 90)
    if k % 4 == 0 and b not in (40, 48): crash(b, 100)
fill(43); fill(47); fill(51)
snare_roll(54, 0, 4, 70, 110); snare_roll(55, 0, 3, 100, 127); fill(55, big=True)

# Rückführung D 56–63: Bm G Em Fs | Bm Em Fs Fs
CH_D = ['Bm', 'G', 'Em', 'Fs', 'Bm', 'Em', 'Fs', 'Fs']
crash(56, 100)
for i, ch in enumerate(CH_D):
    b = 56 + i
    bass(b, ch, 'e' if i < 4 else 's', 94 + i * 2)
    seq(b, ch, 2 if i < 4 else 3, 76 + i * 3); groove(b, 'clock', 1.05)
    pad(b, ch, 56 + i * 4); coin(b, ch, 84 + i * 2, dense=i >= 4); timp(b, ch, 90 + i * 2)
    if i >= 4: stab(b, ch, 84)
line(60, MEL_A[0], ['brass'], [88]); line(61, MEL_A[1], ['brass'], [88])
line(62, [(0, 1, 'C#5'), (1, 1, 'F#5'), (2, 1, 'A#5'), (3, 1, 'F#5')], ['brass', 'lead'], [96, 80])
line(63, [(0, .25, 'F#4'), (.25, .25, 'A#4'), (.5, .25, 'C#5'), (.75, .25, 'F#5'), (1, 1, 'A#5'), (2, 1.6, 'C#6')], ['brass', 'sbrass'], [104, 92])
snare_roll(62, 2, 4, 70, 100); snare_roll(63, 0, 3, 90, 124); fill(59); fill(63, big=True)

sf2, out = cli_paths('bgm_theme_debtotron.ogg')
song.render(sf2, out)
