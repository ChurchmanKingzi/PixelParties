# -*- coding: utf-8 -*-
"""Theme-Battle-Track „Strings of Fate“ (Puppets) → public/music/bgm_theme_puppets.ogg

Marionettentheater im Kampf: f-Moll, 118 BPM, 56 Takte (113,9 s), nahtlos loopbar.
Spieluhr-Kinderlied im Moll (Glockenspiel/Kalimba), Cembalo-Staccato, Harfen-Fäden und
Pizzicato; ruckartige Stopps („Fäden werden gezogen“) und steife Marsch-Rhythmik mit
Rimshots und Holzblock. Gerade Sechzehntel, abgehackt – bewusst kein Swing.

Aufbau (Takte, 0-basiert):
   0– 7  Intro         Spieluhr-Arpeggio (f–c–as–c), Pizzicato, steifer Marsch, erste Ruck-Pausen
   8–23  Thema A       Kinderlied in Glockenspiel + Kalimba, Cembalo-Staccato, Harfe zupft Fäden,
                       zweiter Durchgang mit Streicher-Staccato und Kalliope-Gegenstimme
  24–39  Steigerung B  Dur-Trübung (Des, Ces), Kalliope führt, Melodie synkopiert & steigt;
                       Marimba-Ostinato, Toms, Klarinette; zweiter Durchgang mit Streicher-Zuckungen
  40–51  Höhepunkt C   Lied in Kalliope + Glocke + Marimba + Oboe, alles hart abgehackt, Chor „oohs“
  52–55  Rückführung D Spieluhr läuft aus, Dominant (C) hält, Fäden-Läufe der Harfe → Intro

Harmonie: f-Moll (harmonisch, e als Leitton), Des, B-Moll, C-Dur-Dominante, Halbschluss am Ende.
Aufruf:  python3 scripts/music/theme_puppets.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 118, 56                      # 56 × 4 × 60/118 = 113,9 s
song = Song(bpm=BPM, bars=BARS)
song.inst('bass',    'pizz',    100, 60)
song.inst('contra',  'contra',   74, 64)
song.inst('harpsi',  'harpsichord', 90, 40)
song.inst('glock',   'glock',    92, 74)
song.inst('kalimba', 'kalimba',  86, 54)
song.inst('harp',    'harp',     84, 88)
song.inst('calliope','calliope', 84, 66)
song.inst('marimba', 'marimba',  90, 30)
song.inst('strings', 'strings',  74, 46)
song.inst('clar',    'clarinet', 78, 84)
song.inst('oboe',    'oboe',     80, 60)
song.inst('oohs',    'oohs',     72, 64)
song.inst('bell',    'bell',     88, 70)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
SCALE = {5, 7, 8, 10, 0, 1, 3, 4}         # f-Moll natürlich + e (Leitton)
CH = {'Fm': (F, 3), 'Db': (Db, 4), 'Bbm': (Bb, 3), 'C': (C, 4), 'Ab': (Ab, 4), 'Eb': (Eb, 4), 'Gm': (G, 3), 'Cm': (C, 3)}
def root(ch, o): return n(CH[ch][0], o)
def tones(ch, o): r = root(ch, o); return [r, r + CH[ch][1], r + 7]

def mel(b, notes, insts, vels, shift=0):
    for st, du, p in notes:
        m = nt(p) + shift
        assert (m % 12) in SCALE, (b, p)
        for i, v in zip(insts, vels): song.add(i, song.bar(b) + st, du * 0.8, m, v)   # abgehackt: 80 % der Länge

CH_I = ['Fm', 'Fm', 'Db', 'Db', 'Bbm', 'Fm', 'C', 'C']
CH_A = ['Fm', 'Fm', 'Db', 'Db', 'Bbm', 'Fm', 'C', 'C']
CH_B = ['Fm', 'Ab', 'Db', 'Eb', 'Bbm', 'Fm', 'C', 'C']
CH_C = ['Fm', 'Ab', 'Db', 'Eb', 'Bbm', 'Ab', 'Db', 'C', 'Fm', 'Db', 'C', 'C']
CH_D = ['Bbm', 'Db', 'C', 'C']

MEL_A = [
    [(0,.5,'F5'),(.5,.5,'F5'),(1,.5,'C5'),(1.5,.5,'C5'),(2,.5,'Db5'),(2.5,.5,'Db5'),(3,1,'C5')],
    [(0,.5,'Ab4'),(.5,.5,'Ab4'),(1,.5,'G4'),(1.5,.5,'G4'),(2,1,'F4')],
    [(0,.5,'Db5'),(.5,.5,'Db5'),(1,.5,'Ab4'),(1.5,.5,'Ab4'),(2,.5,'Bb4'),(2.5,.5,'Bb4'),(3,1,'Ab4')],
    [(0,.5,'F4'),(.5,.5,'F4'),(1,.5,'Eb4'),(1.5,.5,'Eb4'),(2,1,'Db4')],
    [(0,.5,'Db5'),(.5,.5,'Db5'),(1,.5,'F5'),(1.5,.5,'F5'),(2,.5,'Eb5'),(2.5,.5,'Eb5'),(3,1,'Db5')],
    [(0,.5,'C5'),(.5,.5,'C5'),(1,.5,'Bb4'),(1.5,.5,'Bb4'),(2,1,'Ab4'),(3,1,'C5')],
    [(0,.5,'G4'),(.5,.5,'G4'),(1,.5,'C5'),(1.5,.5,'C5'),(2,.5,'E5'),(2.5,.5,'E5'),(3,1,'G5')],
    [(0,.5,'G5'),(.5,.5,'F5'),(1,1,'E5'),(2,2,'C5')],
]
# B: höher, synkopiert, Sequenz aufwärts über Fm Ab Db Eb | Bbm Fm C C
MEL_B = [
    [(0,.75,'C5'),(.75,.75,'F5'),(1.5,.5,'Ab5'),(2,.75,'C6'),(2.75,.25,'Bb5'),(3,1,'Ab5')],
    [(0,.75,'Eb5'),(.75,.75,'Ab5'),(1.5,.5,'C6'),(2,.75,'Eb6'),(2.75,.25,'C6'),(3,1,'Ab5')],
    [(0,.75,'F5'),(.75,.75,'Ab5'),(1.5,.5,'Db6'),(2,.75,'F6'),(2.75,.25,'Eb6'),(3,1,'Db6')],
    [(0,.75,'G5'),(.75,.75,'Bb5'),(1.5,.5,'Eb6'),(2,.75,'G6'),(2.75,.25,'F6'),(3,1,'Eb6')],
    [(0,1,'Db6'),(1,.5,'C6'),(1.5,.5,'Bb5'),(2,1,'Db6'),(3,.5,'F6'),(3.5,.5,'Db6')],
    [(0,1,'C6'),(1,.5,'Bb5'),(1.5,.5,'Ab5'),(2,1,'C6'),(3,1,'F5')],
    [(0,.5,'G5'),(.5,.5,'C6'),(1,.5,'E6'),(1.5,.5,'G6'),(2,1,'E6'),(3,1,'C6')],
    [(0,.5,'G5'),(.5,.5,'F5'),(1,.5,'E5'),(1.5,.5,'F5'),(2,1,'G5'),(3,1,'E5')],
]

def T(x): return x
# ---- Bausteine ---------------------------------------------------------------------------------
def bass(b, ch, nxt, vel=96, stop=False):
    s = song.bar(b); r = root(ch, 2)
    song.add('bass', s, 0.4, r, vel + 8)
    if not stop:
        song.add('bass', s + 1, 0.4, r + 7, vel - 8); song.add('bass', s + 2, 0.4, r + 12 if r < 44 else r, vel); song.add('bass', s + 3, 0.4, r + 7, vel - 8)
        song.add('bass', s + 3.5, 0.3, root(nxt, 2) + (1 if root(nxt, 2) < r else -1), vel - 26)
    else: song.add('bass', s + 3.75, 0.2, root(nxt, 2), vel - 10)

def pedal(b, ch, vel=68, stop=False):
    r = root(ch, 1); r = r + 12 if r < 28 else r
    song.add('contra', song.bar(b), 1.9 if stop else 3.9, r, vel)

def harpsi(b, ch, vel=84, stop=False):
    """Staccato-Akkorde 16tel-versetzt: Zuckungen der Puppe."""
    s = song.bar(b); tt = tones(ch, 4)
    offs = (0.5, 1.5, 2.25, 3.5) if not stop else (0.5, 1.5)
    for off in offs:
        for p in tt: song.add('harpsi', s + off, 0.18, p, vel + (6 if off == 0.5 else 0))

def musicbox(b, ch, vel=80, base=5):
    """Spieluhr-Arpeggio in 16teln: Grundton, Quinte, Terz, Quinte, Oktave … (Kamm-Tonfolge)."""
    s = song.bar(b); tt = tones(ch, base); cyc = [tt[0], tt[2], tt[1], tt[2], tt[0] + 12, tt[2], tt[1], tt[2]]
    for i in range(16): song.add('glock', s + i * 0.25, 0.22, cyc[i % 8], vel - (12 if i % 2 else 0) + (8 if i % 8 == 0 else 0))

def harp(b, ch, vel=78, up=True):
    s = song.bar(b); tt = tones(ch, 3) + tones(ch, 4)
    seq = tt if up else tt[::-1]
    for i, p in enumerate(seq): song.add('harp', s + 2 + i * 0.25 if i < 6 else s + 3.5, 0.5, p, vel + i * 2)

def marimba(b, ch, vel=86):
    s = song.bar(b); r = root(ch, 3); tt = [r, r + 7, r + CH[ch][1], r + 7]
    for i in range(8): song.add('marimba', s + i * 0.5, 0.3, tt[i % 4] + (12 if i % 4 == 2 else 0), vel + (8 if i % 4 == 0 else 0))

def strings_jerk(b, ch, vel=78, stop=False):
    s = song.bar(b)
    offs = (0, 0.75, 1.5, 2.5, 3.25) if not stop else (0, 0.75, 1.5)
    for off in offs:
        for p in tones(ch, 4): song.add('strings', s + off, 0.2, p, vel + (8 if off == 0 else 0))

def oohs(b, ch, vel=66):
    for p in tones(ch, 4): song.add('oohs', song.bar(b), 3.9, p, vel)

# ---- Schlagzeug ---------------------------------------------------------------------------------
def groove(b, kind, v=1.0, stop=False):
    """stop=True: Takt endet mit „Fadenriss“ – ab Beat 3 Stille, nur Schlussklick auf 4-und."""
    s = song.bar(b)
    def d(off, note, vel):
        if stop and 2.0 <= off < 3.75: return
        song.dr(s + off, note, min(127, vel * v))
    if kind == 'A':
        d(0, KICK, 108); d(2, KICK, 96); d(1, SIDESTICK, 116); d(3, SIDESTICK, 116); d(1, CLAP, 66); d(3, CLAP, 72)
        for i in range(8): d(i * 0.5, HAT, 100 if i % 2 == 0 else 84)
        for off in (0.75, 1.75, 2.75, 3.75): d(off, 77, 92)             # hölzerne Schritte
    elif kind == 'B':
        d(0, KICK, 114); d(0.75, KICK, 84); d(2, KICK, 106); d(2.75, KICK, 88)
        d(1, SNARE, 106); d(3, SNARE, 112); d(1, SIDESTICK, 100); d(3, SIDESTICK, 100)
        for i in range(16): d(i * 0.25, HAT, 104 if i % 4 == 0 else 88 if i % 2 == 0 else 74)
        for off in (0.5, 1.5, 2.5, 3.5): d(off, 76, 94)
    elif kind == 'C':
        for off, vv in ((0, 118), (1.5, 96), (2, 110), (2.75, 92), (3.5, 100)): d(off, KICK, vv)
        for off in (1, 3): d(off, SNARE, 116); d(off, CLAP, 92)
        for i in range(16): d(i * 0.25, HAT, 108 if i % 4 == 0 else 92 if i % 2 == 0 else 78)
        for off in (0.5, 1.5, 2.5, 3.5): d(off, 76, 100)
        d(0, COWBELL, 84); d(2, COWBELL, 78)
    elif kind == 'soft':
        d(0, KICK, 92); d(2, KICK, 80); d(1, SIDESTICK, 100); d(3, SIDESTICK, 100)
        for i in range(8): d(i * 0.5, HAT, 96 if i % 2 == 0 else 80)
        for off in (0.75, 2.75): d(off, 77, 86)
    if stop: song.dr(s + 3.75, SIDESTICK, 118)                          # Ruck: Schlussklick

def fill(b, big=False):
    s = song.bar(b); toms = [TOM_H, TOM_HH, TOM_M, TOM_L]
    for i in range(8): song.dr(s + 2 + i * 0.25, toms[min(3, i // 2)], 88 + i * 4, 0.2)
    if big:
        for i in range(8): song.dr(s + 1 + i * 0.125, SNARE, 66 + i * 7, 0.1)
    song.dr(s + 3.75, KICK, 118)

def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.6)
def snare_roll(b, start, v0, v1):
    s = song.bar(b) + start; cnt = int((4 - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, v0 + (v1 - v0) * i / max(1, cnt - 1), 0.12)

# ==== Arrangement ===========================================================================
# ---- Intro 0–7 ----------------------------------------------------------------------------------
for i, ch in enumerate(CH_I):
    b = i; nx = CH_I[(i + 1) % 8]; stop = (i == 3)
    pedal(b, ch, 66 + i * 2, stop); bass(b, ch, nx, 90 + i * 2, stop)
    musicbox(b, ch, 88 + i)
    harpsi(b, ch, 74 + i * 3, stop)
    groove(b, 'soft' if i < 4 else 'A', 1.0, stop)
    if i >= 4: kal = tones(ch, 5); [song.add('kalimba', song.bar(b) + o, 0.3, kal[j], 80) for j, o in enumerate((0, 1, 2))]
    if i >= 4: harp(b, ch, 70 + i * 2)
crash(0, 106); snare_roll(7, 0, 60, 108); fill(7, True)

# ---- Thema A 8–23 -------------------------------------------------------------------------------
crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; nx = CH_A[(k + 1) % 8]; sec = i >= 8
    stop = (k in (1, 3))                                         # Ruck-Pausen nach den Liedzeilen
    pedal(b, ch, 74, stop); bass(b, ch, nx, 96, stop)
    harpsi(b, ch, 84, stop)
    groove(b, 'A' if not sec else 'B', 1.0, stop)
    mel(b, MEL_A[k], ['glock', 'kalimba'], [98, 82], shift=0)
    harp(b, ch, 74, up=(k % 2 == 0)) if not stop else None
    if sec:
        strings_jerk(b, ch, 74, stop)
        mel(b, MEL_A[k], ['calliope'], [70], shift=-12)
for b in (15, 19): fill(b)
fill(23, True); snare_roll(23, 0, 60, 108)

# ---- Steigerung B 24–39 -----------------------------------------------------------------------
crash(24, 114); crash(32, 116)
for i in range(16):
    b, k = 24 + i, i % 8; ch = CH_B[k]; nx = CH_B[(k + 1) % 8]; sec = i >= 8
    stop = (k == 7 and not sec) or (k == 3 and sec)
    pedal(b, ch, 82, stop); bass(b, ch, nx, 100, stop)
    harpsi(b, ch, 84, stop); marimba(b, ch, 84 if not sec else 92) if not stop else None
    groove(b, 'B', 1.0 if not sec else 1.05, stop)
    mel(b, MEL_B[k], ['calliope', 'glock'], [92, 84])
    if sec:
        strings_jerk(b, ch, 80, stop); mel(b, MEL_B[k], ['clar'], [76], shift=-12)
    if k % 4 == 0: harp(b, ch, 80, up=True)
fill(31); fill(35); snare_roll(38, 0, 60, 100); snare_roll(39, 0, 90, 127); fill(39, True)

# ---- Höhepunkt C 40–51 ---------------------------------------------------------------------------
crash(40, 120); crash(48, 116)
for i in range(12):
    b = 40 + i; ch = CH_C[i]; nx = CH_C[(i + 1) % 12]; stop = (i == 7)
    pedal(b, ch, 90, stop); bass(b, ch, nx, 106, stop)
    harpsi(b, ch, 90, stop); strings_jerk(b, ch, 84, stop); marimba(b, ch, 96) if not stop else None
    groove(b, 'C', 1.0, stop); oohs(b, ch, 70)
    m = MEL_A[i] if i < 8 else MEL_B[i - 8 + 4]
    mel(b, m, ['calliope', 'bell', 'oboe'], [100, 90, 74])
    mel(b, m, ['kalimba'], [86], shift=12)
    if i % 4 == 0 and i not in (0, 8): crash(b, 100)
fill(43); fill(47); fill(51, True); snare_roll(51, 0, 80, 122)

# ---- Rückführung D 52–55 --------------------------------------------------------------------------
crash(52, 104)
for i in range(4):
    b = 52 + i; ch = CH_D[i]; nx = CH_D[(i + 1) % 4] if i < 3 else 'Fm'
    pedal(b, ch, 80); bass(b, ch, nx, 94)
    harpsi(b, ch, 80); musicbox(b, ch, 84 + i * 3, base=5)
    groove(b, 'A', 1.0); oohs(b, ch, 56 + i * 6); harp(b, ch, 78 + i * 3)
mel(52, MEL_A[4], ['glock'], [92]); mel(53, MEL_A[5], ['glock'], [94]); mel(54, MEL_A[6], ['glock'], [98])
mel(55, [(0,.5,'G5'),(.5,.5,'F5'),(1,1,'E5'),(2,2,'C5')], ['glock', 'kalimba'], [104, 88])
fill(53); snare_roll(54, 2, 60, 100); fill(55, True)

sf2, out = cli_paths('bgm_theme_puppets.ogg')
song.render(sf2, out)
