# -*- coding: utf-8 -*-
"""Battle-Theme „The Weaver's Web“ (Spiders) → public/music/bgm_theme_spiders.ogg

Lauernde Spinnenjagd in e-Phrygisch (nur weiße Tasten, Halbton E–F als Bedrohung), 136 BPM,
64 Takte (112,9 s), nahtlos loopbar. Flirrende Tremolo-Streicher = Netz, huschende
Pizzicato-16tel in 3+3+2-Gruppen = Beine, Harfen-Glissandi = Fäden, das Königin-Motiv
(Grundton – Halbton – Grundton – Sekunde tiefer, kriechend) liegt tief in Fagott und Kontrabass.

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Pizzicato-Beine, Tremolo, Kontrabass/Fagott-Königinmotiv ab Takt 4, Toms
   8–23  Thema A        Violine: Spinnenmotiv E-F-E-H; Oboe-Gegenstimme, Harfen-Glissandi an den Phrasenenden
  24–39  Steigerung B   Motiv steigt diatonisch mit den Akkordwurzeln (Em F G Am F G Am Hdim), Chor, Netz-Arpeggien
  40–55  Höhepunkt C    Hörner + Violine + Oboe, Chor, Pauken, Orchester-Hits, Königin im Blech
  56–63  Rückführung D  Pizzicato/Tremolo wie im Intro, Hdim-Orgelpunkt → zurück auf Takt 0
Aufruf:  python3 scripts/music/theme_spiders.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 136, 64                      # 64 × 4 × 60/136 = 112,9 s
song = Song(bpm=BPM, bars=BARS)
song.inst('contra',  'contra',   90, 60)
song.inst('bassoon', 'bassoon',  96, 66)
song.inst('timp',    'timp',     90, 64)
song.inst('tremolo', 'tremolo',  76, 90)
song.inst('pizz',    'pizz',    100, 36)
song.inst('harp',    'harp',     90, 96)
song.inst('violin',  'violin',   92, 70)
song.inst('oboe',    'oboe',     84, 46)
song.inst('choir',   'choir',    82, 64)
song.inst('hit',     'hit',      96, 64)
song.inst('horns',   'horns',    88, 40)
song.inst('legs2',   'pizz',     88, 92)     # zweite Bein-Stimme (rechts)

PCS = {E, F, G, A, B, C, D}                     # e-Phrygisch = C-Dur-Töne
SC = [m for m in range(24, 108) if m % 12 in PCS]
def st(m, k): return SC[SC.index(m) + k]        # diatonisch um k Stufen verschieben
NM = {'C': C, 'D': D, 'E': E, 'F': F, 'G': G, 'A': A, 'B': B}
def nt(s): return n(NM[s[0]], int(s[1]))
ROOT = {'Em': E, 'F': F, 'Dm': D, 'C': C, 'Bd': B, 'Am': A, 'G': G}
def bassp(ch): pc = ROOT[ch]; return 35 if pc == B else 36 + pc
def mid(ch, lo):                                # Grundton in Lage ab lo
    pc = ROOT[ch]; return lo + ((pc - lo) % 12)
def tri(r): return [r, st(r, 2), st(r, 4)]
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
def mel_ok(m): assert m % 12 in PCS, m; return m

def queen(b, ch, inst, shift=0, vel=96):
    """Königin-Motiv: Grundton lang, Halbton/Sekunde hoch, Grundton, Sekunde tiefer (kriechend)."""
    s = song.bar(b); r = bassp(ch) + shift
    for off, d, p in ((0, 1.3, r), (1.5, 0.45, st(r, 1)), (2, 1.3, r), (3.5, 0.45, st(r, -1))):
        song.add(inst, s + off, d, p, vel + (8 if off == 0 else 0))
def contra(b, ch, vel=84): song.add('contra', song.bar(b), 3.95, bassp(ch) - 12 if bassp(ch) - 12 >= 24 else bassp(ch), vel)
def tremolo(b, ch, vel=70):
    for p in tri(mid(ch, 60)): song.add('tremolo', song.bar(b), 3.98, p, vel)
def choir(b, ch, vel=80):
    for p in tri(mid(ch, 60)): song.add('choir', song.bar(b), 3.98, p, vel)
def legs(b, ch, vel=80, inst='pizz', step=0.25):
    """Pizzicato-16tel, in 3+3+2 gruppiert akzentuiert: die huschenden Beine."""
    s = song.bar(b); r = mid(ch, 55)
    cyc = [0, 2, 4, 7, 4, 2, 0, 4]
    acc = {0, 3, 6, 8, 11, 14}
    for i in range(int(4 / step)):
        song.add(inst, s + i * step, step * 0.7, st(r, cyc[i % 8]), vel + (16 if i in acc else -6))
def web(b, ch, vel=70):
    """Harfen-Netz: auf- und absteigende Achtel-Arpeggien."""
    s = song.bar(b); r = mid(ch, 48)
    for i, k in enumerate([0, 2, 4, 7, 9, 7, 4, 2]): song.add('harp', s + i * 0.5, 0.6, st(r, k), vel + (8 if i % 4 == 0 else 0))
def gliss(b, beat, top, steps, vel=80, dur=0.125):
    p = top
    for i in range(steps): song.add('harp', song.bar(b) + beat + i * dur, 0.4, st(p, -i), ramp(i, steps, vel, vel - 20))
def gliss_up(b, beat, low, steps, vel=80, dur=0.125):
    for i in range(steps): song.add('harp', song.bar(b) + beat + i * dur, 0.4, st(low, i), ramp(i, steps, vel - 20, vel))
def timp(b, ch, kind, vel=90):
    s = song.bar(b); p = bassp(ch) + (12 if bassp(ch) < 38 else 0)
    if kind == 'q':
        for off in (0, 2.5): song.add('timp', s + off, 0.4, p, vel)
    elif kind == 'gallop':
        for off, v in ((0, 0), (1.5, -8), (2, -2), (3, -8), (3.5, -8)): song.add('timp', s + off, 0.35, p, vel + v)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * 0.25, 0.25, p, ramp(i, 16, vel - 30, vel))
def hit(b, beat, ch, vel=110):
    r = mid(ch, 48)
    for p in (r, r + 12, st(r + 12, 4)): song.add('hit', song.bar(b) + beat, 0.9, p, vel)
def line(b, notes, insts, vels, shift=0):
    for off, d, p in notes:
        m = mel_ok(nt(p) + shift) if isinstance(p, str) else mel_ok(p)
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, d * 0.94, m, v)

# ---- Schlagzeug ---------------------------------------------------------------------
TOMS = [TOM_H, TOM_HH, TOM_M, TOM_L]
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'skit':                       # Trippeln: Kick + Sidestick, Hi-Hat 16tel laut
        d(0, KICK, 104); d(2.5, KICK, 90); d(1, SIDESTICK, 100); d(3, SIDESTICK, 104); d(3.75, TOM_H, 86)
        for i in range(16): d(i * 0.25, HAT, 100 if i % 4 == 0 else 84 if i % 2 == 0 else 72)
    elif kind == 'A':
        d(0, KICK, 112); d(1.5, KICK, 90); d(2.5, KICK, 100); d(1, SNARE, 100); d(3, SNARE, 104)
        d(3.5, TOM_M, 88); d(3.75, TOM_L, 92)
        for i in range(8): d(i * 0.5, HAT, 108 if i % 2 == 0 else 88)
        d(0.75, SIDESTICK, 76); d(2.75, SIDESTICK, 80)
    elif kind == 'B':
        for off, vel in ((0, 114), (1, 96), (1.5, 92), (2.5, 104), (3.25, 94)): d(off, KICK, vel)
        d(1, SNARE, 108); d(3, SNARE, 112); d(3, CLAP, 84)
        for i in range(8): d(i * 0.5, HAT, 112 if i % 2 == 0 else 92)
        d(2, COWBELL, 70)
    elif kind == 'C':
        for off, vel in ((0, 118), (1.5, 100), (2, 108), (3.5, 104)): d(off, KICK, vel)
        d(1, SNARE, 116); d(3, SNARE, 118); d(1, CLAP, 90); d(3, CLAP, 92)
        for i in range(8): d(i * 0.5, RIDE, 118 if i % 2 == 0 else 100)
        d(2.5, TOM_M, 96); d(3.75, TOM_L, 98)
def fill(b, big=False):
    s = song.bar(b)
    if big:
        for i in range(8): song.dr(s + 1.5 + i * 0.25, SNARE, ramp(i, 8, 70, 112), 0.12)
    for i in range(8): song.dr(s + 2.0 + i * 0.25 if not big else s + 2.5 + i * 0.1875, TOMS[min(3, i // 2)], ramp(i, 8, 92, 120), 0.2)
    song.dr(s + 3.75, KICK, 118)
def snare_roll(b, a, z, v0, v1):
    s = song.bar(b) + a; cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Melodien (nur e-Phrygisch, Töne prüft mel_ok) ----------------------------------------
CH_A = ['Em', 'Em', 'F', 'F', 'Em', 'Dm', 'C', 'Bd']
MEL_A = [
    [(0, .5, 'E5'), (.5, .5, 'F5'), (1, .5, 'E5'), (1.5, .5, 'B4'), (2, 2, 'E5')],
    [(0, .5, 'G5'), (.5, .5, 'F5'), (1, .5, 'E5'), (1.5, .5, 'D5'), (2, 2, 'E5')],
    [(0, .5, 'F5'), (.5, .5, 'G5'), (1, .5, 'A5'), (1.5, .5, 'G5'), (2, 1, 'F5'), (3, 1, 'C5')],
    [(0, 1, 'A5'), (1, 1, 'G5'), (2, 2, 'F5')],
    [(0, .5, 'E5'), (.5, .5, 'F5'), (1, .5, 'E5'), (1.5, .5, 'B4'), (2, 1, 'G5'), (3, 1, 'E5')],
    [(0, .5, 'D5'), (.5, .5, 'E5'), (1, .5, 'F5'), (1.5, .5, 'E5'), (2, 2, 'D5')],
    [(0, .5, 'E5'), (.5, .5, 'G5'), (1, 1, 'C6'), (2, 1, 'B5'), (3, 1, 'G5')],
    [(0, 1, 'F5'), (1, 1, 'D5'), (2, 1, 'B4'), (3, 1, 'D5')],
]
CTR_A = [('B4', 'G4'), ('B4', 'E4'), ('A4', 'C5'), ('C5', 'A4'), ('G4', 'B4'), ('F4', 'A4'), ('G4', 'E4'), ('D4', 'B3')]  # Oboe, 2 Halbe
CH_B = ['Em', 'F', 'G', 'Am', 'F', 'G', 'Am', 'Bd']
SHIFT_B = [0, 1, 2, 3, 1, 2, 3, 4]
def mel_b(k, hi=0):
    r = st(nt('E5'), SHIFT_B[k] + hi)
    return [(0, .5, r), (.5, .5, st(r, 1)), (1, .5, r), (1.5, .5, st(r, -2)), (2, 1, st(r, 2)), (3, 1, st(r, 4))] if k < 7 else \
           [(0, 1, st(r, 1)), (1, 1, r), (2, 1, st(r, -2)), (3, 1, st(r, -3))]
CH_C1 = ['Em', 'F', 'Em', 'Dm', 'C', 'Dm', 'F', 'Bd']
CH_C2 = ['Em', 'F', 'G', 'Am', 'F', 'Dm', 'F', 'Bd']
def mel_c(ch, k, hi):
    r = mid(ch, 64) + 12 * hi
    if k == 7: return [(0, 1, st(r, 4)), (1, 1, st(r, 2)), (2, 1, r), (3, 1, st(r, 2))]
    if k % 2 == 0: return [(0, 1, st(r, 2)), (1, .5, st(r, 4)), (1.5, .5, st(r, 3)), (2, 1.5, st(r, 7)), (3.5, .5, st(r, 6))]
    return [(0, 1.5, st(r, 4)), (1.5, .5, st(r, 2)), (2, 1, st(r, 3)), (3, 1, st(r, 1))]

# ==== Arrangement ==============================================================================
# Intro 0–7
CH_I = ['Em', 'Em', 'F', 'Em', 'Em', 'Dm', 'F', 'Bd']
hit(0, 0, 'Em', 110); crash(0, 104)
for b, ch in enumerate(CH_I):
    contra(b, ch, 84 + b * 2)
    tremolo(b, ch, 80 + b * 2); choir(b, ch, 56 + b * 3)
    legs(b, ch, 84 + b * 2); legs(b, ch, 70 + b * 2, 'legs2', 0.5)
    groove(b, 'skit', 1.05 + b * 0.01)
    queen(b, ch, 'bassoon', 0, 92 + b * 2); timp(b, ch, 'q', 88 + b * 2)
    if b in (2, 3): gliss(b, 3, nt('E6'), 6, 74)
line(6, [(0, .5, 'E5'), (.5, .5, 'F5'), (1, .5, 'E5'), (1.5, .5, 'B4'), (2, 2, 'E5')], ['oboe'], [84])
line(7, [(0, .5, 'F5'), (.5, .5, 'D5'), (1, .5, 'B4'), (1.5, .5, 'D5'), (2, 2, 'B4')], ['oboe'], [90])
snare_roll(7, 0, 3.5, 60, 116); fill(7, big=True)

# Thema A 8–23
hit(8, 0, 'Em', 106); crash(8, 108)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; sec = i >= 8
    contra(b, ch, 84); queen(b, ch, 'bassoon', 0, 94)
    tremolo(b, ch, 62 + (8 if sec else 0))
    legs(b, ch, 78 + (6 if sec else 0)); legs(b, ch, 66, 'legs2', 0.5)
    timp(b, ch, 'q', 92)
    groove(b, 'A', 1.0 + (0.05 if sec else 0))
    line(b, MEL_A[k], ['violin'] + (['oboe'] if sec else []), [92, 76])
    if not sec:
        for j, p in enumerate(CTR_A[k]): song.add('oboe', song.bar(b) + j * 2, 1.9, nt(p), 70)
    if sec and k >= 4: choir(b, ch, 54 + (k - 4) * 8)
    if k in (3, 7): gliss(b, 2.5, nt('E6'), 12, 82, 0.125)
fill(15); crash(16, 100); snare_roll(22, 2, 4, 60, 100); snare_roll(23, 0, 3, 80, 122); fill(23, big=True)

# Steigerung B 24–39
hit(24, 0, 'Em', 112); crash(24, 112); hit(32, 0, 'Em', 116); crash(32, 114)
for i in range(16):
    b, k = 24 + i, i % 8; ch = CH_B[k]; sec = i >= 8
    contra(b, ch, 90); queen(b, ch, 'bassoon', 0, 100); queen(b, ch, 'horns', 12, 70 if sec else 0) if sec else None
    tremolo(b, ch, 74 + (6 if sec else 0))
    legs(b, ch, 88); legs(b, ch, 74, 'legs2', 0.25 if sec else 0.5)
    timp(b, ch, 'gallop', 96)
    groove(b, 'B', 1.0 + (0.05 if sec else 0))
    web(b, ch, 70 + (6 if sec else 0))
    line(b, mel_b(k, 1 if sec else 0), ['violin'] + (['oboe'] if sec else []), [94, 80])
    choir(b, ch, 56 + (k * 4) + (10 if sec else 0))
    if k == 7: gliss_up(b, 2, nt('E5'), 14, 88)
fill(31); fill(35); snare_roll(38, 0, 4, 60, 104); snare_roll(39, 0, 3, 92, 127); fill(39, big=True)

# Höhepunkt C 40–55
hit(40, 0, 'Em', 122); crash(40, 120); hit(48, 0, 'Em', 118); crash(48, 118)
for i in range(16):
    b, k = 40 + i, i % 8; ch = (CH_C1 if i < 8 else CH_C2)[k]; sec = i >= 8
    contra(b, ch, 94); queen(b, ch, 'bassoon', 0, 104); queen(b, ch, 'horns', 12, 90)
    tremolo(b, ch, 78); choir(b, ch, 90 + (4 if sec else 0))
    legs(b, ch, 92); legs(b, ch, 78, 'legs2', 0.25)
    timp(b, ch, 'gallop', 104)
    groove(b, 'C', 1.0 + (0.04 if sec else 0))
    web(b, ch, 66)
    line(b, mel_c(ch, k, 0), ['violin', 'oboe'], [100, 84])
    if sec: line(b, mel_c(ch, k, 1), ['violin'], [86])
    if k % 4 == 0 and b not in (40, 48): crash(b, 100)
fill(43); fill(47); fill(51)
snare_roll(54, 0, 4, 70, 110); snare_roll(55, 0, 3, 100, 127); fill(55, big=True)

# Rückführung D 56–63 (zurück zum Intro)
CH_D = ['Em', 'F', 'Em', 'Dm', 'F', 'F', 'Bd', 'Bd']
crash(56, 96)
for i, ch in enumerate(CH_D):
    b = 56 + i
    contra(b, ch, 76 + i * 2); queen(b, ch, 'bassoon', 0, 90)
    tremolo(b, ch, 64 + i * 3)
    legs(b, ch, 74 + i * 2); legs(b, ch, 62 + i * 2, 'legs2', 0.5)
    groove(b, 'skit', 1.0)
    if i < 4: timp(b, ch, 'q', 86)
    else: timp(b, ch, 'roll', 98 + (i - 4) * 5)
    if i >= 4: choir(b, ch, 54 + (i - 4) * 8)
line(56, MEL_A[0], ['oboe'], [80]); line(57, MEL_A[1], ['oboe'], [82])
line(60, [(0, 1, 'C5'), (1, 1, 'B4'), (2, 1, 'A4'), (3, 1, 'B4')], ['violin'], [92])
line(62, [(0, 1, 'F5'), (1, 1, 'D5'), (2, 1, 'B4'), (3, 1, 'D5')], ['violin'], [98])
line(63, [(0, .25, 'B4'), (.25, .25, 'D5'), (.5, .25, 'F5'), (.75, .25, 'B5'), (1, 1, 'D6'), (2, 1.6, 'B5')], ['violin'], [104])
gliss(59, 2.5, nt('E6'), 12, 84); gliss(61, 2, nt('E6'), 16, 90); gliss_up(63, 2.5, nt('B4'), 10, 90)
fill(59); snare_roll(62, 2, 4, 70, 100); snare_roll(63, 0, 3, 90, 124); fill(63, big=True)

sf2, out = cli_paths('bgm_theme_spiders.ogg')
song.render(sf2, out)
