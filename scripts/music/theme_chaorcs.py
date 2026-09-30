# -*- coding: utf-8 -*-
"""Theme „Chaorcs“ – „Calamitusk's Rampage“ → public/music/bgm_theme_chaorcs.ogg

Chaotischer Orkkrieg in f-Moll/Phrygisch (kleine Sekunde Ges, Tritonus H, dazu bewusst schiefe Dur-Akkorde
Es und C), 146 BPM, 72 Takte (118,4 s), nahtlos loopbar. Primitive Toms und Pauken-„Kanonen“, Tuba/Posaune,
verzerrte Gitarre + Rockorgel im 3+3+2-Riff, tiefe Gebrüll-Chöre, schräge Gegenklänge (Gitarre eine kleine
Sekunde daneben), Orchester-Hits als Kanonenschüsse. Das Kriegsgeschrei-Motiv (kurz-kurz-kurz-lang, F-F-Ab-F-C)
liegt in Posaune/Blech über dem Riff.

Aufbau (Takte, 0-basiert):
   0– 7  Intro        Kriegstrommeln (Toms 3+3+2), Kanonen-Pauken, Tuba-Riff, Gitarre ab Takt 4, Posaunenruf
   8–23  Riff A       Riff Fm-Ges-Db-C (Bass/Tuba/Gitarre), Rock-Beat; ab Takt 16 Orgel, Chor und Blech-Rufe
  24–39  Teil B       Db-Es-Fm … Kraftakkorde, Gebrüll-Chor, Posaunen-Kriegsgeschrei, zweiter Durchgang mit Blech
  40–55  Höhepunkt C  Kriegsgeschrei als Hymne (Posaune + Blech + Hörner), Chor, Kanonen, schiefe Gitarre
  56–63  Break D      Tom-Gewitter, Pauken-Kanonen, Chor-Gebrüll schwillt an, Orgel-Gekreisch
  64–71  Rückkehr E   Riff A zurück, Snare-Wirbel, endet auf C (Dominante) → Sprung zum Intro
Kein Schlussakkord. Aufruf:  python3 scripts/music/theme_chaorcs.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 146, 72                        # 72 × 4 × 60/146 = 118,4 s
song = Song(bpm=BPM, bars=BARS)
song.inst('tuba',   'tuba',     100, 58)
song.inst('bass',   'bass2',     98, 66)
song.inst('timp',   'timp',     100, 64)
song.inst('gtr',    'rockgtr',   88, 40)
song.inst('gtr2',   'charang',   70, 92)   # die „schiefe“ Zweitgitarre
song.inst('organ',  'rockorgan', 76, 84)
song.inst('choir',  'choir',     92, 64)
song.inst('trom',   'trombone',  92, 72)
song.inst('brass',  'brass',     84, 54)
song.inst('horns',  'horns',     86, 34)
song.inst('hit',    'hit',      104, 64)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
# Akkord → (Grundton-Pitchclass, Tonvorrat der Akkordtöne)
CH = {'Fm': (F, {5, 8, 0}), 'Gb': (Gb, {6, 10, 1}), 'Db': (Db, {1, 5, 8}), 'Eb': (Eb, {3, 7, 10}), 'C': (C, {0, 4, 7})}
SCALE = {5, 6, 8, 10, 0, 1, 3}          # f-phrygisch (F Ges As B C Des Es)
BAD = []
def root(ch, octv): return n(CH[ch][0], octv)

RIFF_A = [(0, 0), (.5, 0), (1, 0), (1.5, 1), (2, 0), (2.5, 0), (3, 6), (3.5, 7)]              # Ges = kl. Sekunde, 6 = Tritonus
RIFF_B = [(0, 0), (.5, 0), (.75, 0), (1.5, 1), (2, 0), (2.25, 0), (3, 6), (3.5, 7)]           # 3+3+2

def riff(inst, b, ch, octv, pat, vel, power=False, dur=0.4):
    r = root(ch, octv); s = song.bar(b)
    for off, iv in pat:
        v = vel + (10 if off in (0, 1.5, 3) else -4)
        song.add(inst, s + off, dur, r + iv, v)
        if power: song.add(inst, s + off, dur, r + iv + 7, v - 8)

def tuba(b, ch, vel=100):
    r = root(ch, 2); s = song.bar(b)
    for off, iv, d in ((0, 0, 1.2), (1.5, 0, 1.2), (3, 0, 0.8), (3.5, 1 if ch == 'Fm' else 7, 0.4)): song.add('tuba', s + off, d, r + iv, vel)

def timp(b, ch, kind='cannon', vel=100):
    r = root(ch, 2); s = song.bar(b)
    if kind == 'cannon':
        for off, v in ((0, 0), (1.5, -6), (3, -2)): song.add('timp', s + off, 0.6, r, vel + v)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * 0.25, 0.25, r, 60 + i * 4)
    elif kind == 'gallop':
        for off, v in ((0, 0), (0.75, -10), (1.5, -4), (2.25, -10), (3, 0), (3.5, -8)): song.add('timp', s + off, 0.4, r, vel + v)

def choir(b, ch, vel=88, oct_=2):
    r = root(ch, oct_) + 12
    for p in (r, r + 7, r + 12): song.add('choir', song.bar(b), 3.9, p, vel)

def hit(b, beat, ch, vel=118, dur=1.0):
    r = root(ch, 2)
    for p in (r, r + 7, r + 12, r + 19): song.add('hit', song.bar(b) + beat, dur, p, vel)

def warp(b, ch, vel=80):        # schiefe Zweitgitarre: kleine Sekunde über dem Grundton, Schlussgeräusch
    r = root(ch, 4)
    for p in (r + 1, r + 8): song.add('gtr2', song.bar(b) + 3.5, 0.5, p, vel)

# Kriegsgeschrei (je Akkord): kurz-kurz-kurz-lang
def cry(ch):
    return {
        'Fm': [(0, .5, 'F4'), (.5, .5, 'F4'), (1, .5, 'Ab4'), (1.5, .5, 'F4'), (2, 1.5, 'C5'), (3.5, .5, 'Ab4')],
        'Gb': [(0, .5, 'Gb4'), (.5, .5, 'Gb4'), (1, .5, 'Bb4'), (1.5, .5, 'Gb4'), (2, 1.5, 'Db5'), (3.5, .5, 'Bb4')],
        'Db': [(0, .5, 'Db5'), (.5, .5, 'Db5'), (1, .5, 'F5'), (1.5, .5, 'Db5'), (2, 1, 'Ab4'), (3, 1, 'F4')],
        'Eb': [(0, .5, 'Eb4'), (.5, .5, 'Eb4'), (1, .5, 'G4'), (1.5, .5, 'Eb4'), (2, 1.5, 'Bb4'), (3.5, .5, 'G4')],
        'C':  [(0, .5, 'C5'), (.5, .5, 'C5'), (1, .5, 'E5'), (1.5, .5, 'C5'), (2, 1, 'G4'), (3, 1, 'E4')],
    }[ch]
def line(inst, b, ch, vel, shift=0, cut=None):
    for off, dur, name in cry(ch):
        if cut is not None and off >= cut: continue
        p = nt(name)
        if off % 1 == 0 and p % 12 not in CH[ch][1]: BAD.append((b, off, name))
        if p % 12 not in SCALE | CH[ch][1]: BAD.append((b, off, name, 'skala'))
        song.add(inst, song.bar(b) + off, dur * 0.92, p + shift, vel + (8 if off == 0 else 0))

# ---- Schlagzeug -----------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'tribal':             # Toms im 3+3+2, keine Hi-Hat
        for off, note, vel in ((0, TOM_L, 112), (1.5, TOM_L, 104), (3, TOM_M, 106), (0.75, TOM_H, 84), (2.25, TOM_H, 84), (3.5, TOM_HH, 92)): d(off, note, vel)
        d(0, KICK, 112); d(1.5, KICK, 100); d(3, KICK, 100); d(2, CLAP, 100)
    elif kind == 'rock':
        for off, vel in ((0, 116), (1.5, 100), (2, 106), (3, 102), (3.5, 92)): d(off, KICK, vel)
        d(1, SNARE, 112); d(3, SNARE, 114); d(1, CLAP, 84)
        for i in range(8): d(i * 0.5, HAT, 114 if i % 2 == 0 else 96)
        d(0, TOM_L, 84); d(1.5, TOM_L, 80); d(3, TOM_M, 84)
    elif kind == 'war':              # Höhepunkt: Snare + Toms + Crash-Viertel
        for off, vel in ((0, 120), (1.5, 104), (2, 110), (3, 106), (3.5, 96)): d(off, KICK, vel)
        d(1, SNARE, 118); d(3, SNARE, 120); d(1, CLAP, 92); d(3, CLAP, 96)
        d(0.5, TOM_H, 96); d(2.5, TOM_M, 98); d(3.75, TOM_L, 104); d(2.25, COWBELL, 90)
        for off in (0, 1, 2, 3): d(off, RIDE, 110)
def fill(b, big=False):
    s = song.bar(b)
    for i in range(8): song.dr(s + 2 + i * 0.25, (TOM_H, TOM_HH, TOM_M, TOM_L)[min(3, i // 2)], 90 + i * 4, 0.2)
    song.dr(s + 3.75, KICK, 120)
    if big:
        for i in range(8): song.dr(s + i * 0.25, SNARE, 70 + i * 6, 0.12)
def roll(b, a, z, v0, v1):
    cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(song.bar(b) + a + i * 0.25, SNARE, v0 + (v1 - v0) * i / max(1, cnt - 1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)
def toms(b, v0=90, v1=118):       # Tom-Gewitter über den ganzen Takt
    for i in range(16): song.dr(song.bar(b) + i * 0.25, (TOM_L, TOM_M, TOM_H, TOM_HH)[(i * 3 // 2) % 4], v0 + (v1 - v0) * i / 15, 0.2)

PA = ['Fm', 'Fm', 'Gb', 'Gb', 'Fm', 'Fm', 'Db', 'C']
PB = ['Db', 'Eb', 'Fm', 'Fm', 'Db', 'Gb', 'C', 'C']
PC1 = ['Fm', 'Gb', 'Fm', 'Db', 'Eb', 'Gb', 'C', 'C']
PC2 = ['Fm', 'Gb', 'Db', 'Eb', 'Fm', 'Gb', 'C', 'C']

# ---- Intro 0–7 ------------------------------------------------------------------------------
for i in range(8):
    ch = PA[i]
    groove(i, 'tribal', 0.95 + i * 0.01)
    timp(i, ch, 'cannon', 92 + i * 2)
    if i >= 2: riff('tuba', i, ch, 2, RIFF_A, 88, dur=0.5)
    if i >= 2: riff('bass', i, ch, 2, RIFF_A, 84)
    if i >= 4: riff('gtr', i, ch, 3, RIFF_A, 84, power=True); choir(i, ch, 60 + (i - 4) * 8)
hit(0, 0, 'Fm', 122, 1.6); crash(0, 110)
line('trom', 6, 'Fm', 92); line('trom', 7, 'Gb', 98)
roll(7, 1, 4, 60, 112); fill(3); fill(7, True)
# ---- Riff A 8–23 ------------------------------------------------------------------------------
hit(8, 0, 'Fm', 116, 0.9); crash(8, 114)
for i in range(16):
    b = 8 + i; ch = PA[i % 8]; second = i >= 8
    groove(b, 'rock', 1.0 + (0.05 if second else 0))
    timp(b, ch, 'cannon', 98)
    pat = RIFF_A if i % 2 == 0 else RIFF_B
    riff('tuba', b, ch, 2, pat, 96, dur=0.5); riff('bass', b, ch, 2, pat, 92)
    riff('gtr', b, ch, 3, pat, 90, power=True)
    if second:
        riff('organ', b, ch, 4, pat, 66); choir(b, ch, 78 if i % 2 == 0 else 62)
        if i % 4 == 3: line('brass', b, ch, 84, cut=2)
    if i % 4 == 3: warp(b, ch, 72)
fill(15); fill(19); roll(22, 1, 4, 60, 100); roll(23, 0, 3, 90, 126); fill(23, True)
# ---- Teil B 24–39 ------------------------------------------------------------------------------
hit(24, 0, 'Db', 118, 0.9); crash(24, 116); hit(32, 0, 'Db', 120, 0.9); crash(32, 118)
for i in range(16):
    b = 24 + i; ch = PB[i % 8]; second = i >= 8
    groove(b, 'rock', 1.05)
    timp(b, ch, 'gallop', 96)
    riff('tuba', b, ch, 2, RIFF_B, 98, dur=0.5); riff('bass', b, ch, 2, RIFF_B, 94)
    riff('gtr', b, ch, 3, RIFF_B, 92, power=True); riff('organ', b, ch, 4, RIFF_A, 70)
    choir(b, ch, 86 + (4 if second else 0))
    line('trom', b, ch, 92)
    if second: line('brass', b, ch, 82); line('horns', b, ch, 76, 12)
    if i % 4 == 3: warp(b, ch, 78)
fill(27); fill(31); fill(35); roll(38, 1, 4, 70, 108); roll(39, 0, 3, 100, 127); fill(39, True)
# ---- Höhepunkt C 40–55 --------------------------------------------------------------------------
hit(40, 0, 'Fm', 124, 1.4); crash(40, 122); hit(48, 0, 'Fm', 120, 1.0); crash(48, 120)
for i in range(16):
    b = 40 + i; second = i >= 8; ch = (PC2 if second else PC1)[i % 8]
    groove(b, 'war', 1.0 + (0.04 if second else 0))
    timp(b, ch, 'gallop', 102)
    riff('tuba', b, ch, 2, RIFF_A if i % 2 else RIFF_B, 102, dur=0.5); riff('bass', b, ch, 2, RIFF_B, 96)
    riff('gtr', b, ch, 3, RIFF_B, 94, power=True); riff('organ', b, ch, 4, RIFF_B, 72)
    choir(b, ch, 92)
    line('trom', b, ch, 100); line('brass', b, ch, 92, 12); line('horns', b, ch, 84, 0)
    if i % 2 == 1: warp(b, ch, 84)
    if i % 4 == 0 and b not in (40, 48): crash(b, 104)
    if i % 4 == 2: song.add('hit', song.bar(b) + 2.5, 0.6, root(ch, 3), 110)
fill(43); fill(47); fill(51); roll(54, 1, 4, 70, 112); roll(55, 0, 3, 100, 127); fill(55, True)
# ---- Break D 56–63 -------------------------------------------------------------------------------
crash(56, 100)
for i in range(8):
    b = 56 + i; ch = ['Fm', 'Fm', 'Gb', 'Gb', 'Fm', 'Db', 'C', 'C'][i]
    toms(b, 84 + i * 3, 104 + i * 3)
    for off in (0, 1.5, 3): song.dr(song.bar(b) + off, KICK, 112)
    if i % 2 == 0: timp(b, ch, 'cannon', 108)
    riff('tuba', b, ch, 2, RIFF_A, 90, dur=0.5)
    if i >= 2: riff('organ', b, ch, 4, RIFF_A, 60 + i * 3)
    if i >= 4: choir(b, ch, 60 + (i - 4) * 10)
    if i >= 6: riff('gtr', b, ch, 3, RIFF_B, 90, power=True)
    if i in (3, 5): hit(b, 0, ch, 112, 0.8)
line('trom', 62, 'C', 96); line('trom', 63, 'C', 102)
roll(63, 1, 4, 70, 118); fill(63, True)
# ---- Rückkehr E 64–71 ------------------------------------------------------------------------------
hit(64, 0, 'Fm', 118, 0.9); crash(64, 116)
for i in range(8):
    b = 64 + i; ch = PA[i]
    groove(b, 'rock' if i < 6 else 'tribal', 1.05)
    timp(b, ch, 'gallop' if i < 6 else 'roll', 100)
    riff('tuba', b, ch, 2, RIFF_B, 98, dur=0.5); riff('bass', b, ch, 2, RIFF_B, 94)
    riff('gtr', b, ch, 3, RIFF_B, 92, power=True)
    choir(b, ch, 70 + i * 3)
    if i >= 4: line('trom', b, ch, 90 + i * 2); line('brass', b, ch, 78)
    if i % 4 == 3: warp(b, ch, 76)
fill(67); roll(70, 1, 4, 70, 110); roll(71, 0, 3, 100, 127); fill(71, True)

assert not BAD, BAD
sf2, out = cli_paths('bgm_theme_chaorcs.ogg')
song.render(sf2, out)
