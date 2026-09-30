# -*- coding: utf-8 -*-
"""Battle-Theme „Spore Symphony“ (Archetyp Paraseed) → public/music/bgm_theme_paraseed.ogg

Verseuchte Botanik in h-Moll (phrygische Halbton-Färbung C und Dominante Fis-Dur), 120 BPM,
60 Takte (120,0 s), nahtlos loopbar. Drei wuchernde Ostinati mit teilerfremden Zykluslängen
(Marimba 5, Kalimba 7, Harfe 3 Sechzehntel/Achtel) driften gegeneinander wie Ranken – die
Ansteckung: Alle 8 Takte kommt eine Stimme dazu (Marimba → Kalimba → Harfe + feuchter Bass →
Fagott-Thema → Zombie-Chor + Tremolo → Sporenpads + Oboe → Höhepunkt mit Orchester-Hits).
Das Kriech-Motiv (h–c–h–d, Halbton-Schleichen) ist das Thema des Fagotts und wandert später in
Oboe und Chor („Zombie“). Beat: dumpfes Tom-Pulsen, Sidestick-Backbeat, Cowbell-Tick.

Aufbau (Takte, 0-basiert):
   0– 7  Saat        Marimba-Ostinato allein + Toms/Kick, Bass-Puls
   8–15  Keim        + Kalimba (anderer Zyklus), Sidestick
  16–23  Wurzel      + Harfe, feuchter Bass (Squarebass) + Kontrabass
  24–31  Thema       + Fagott mit Kriech-Motiv
  32–39  Befall      + Zombie-Chor (Oohs) + Tremolo-Streicher, Clap-Backbeat
  40–47  Sporenwolke + Sporenpads (Atmos/Warm), Oboe übernimmt das Motiv, Choir
  48–55  Höhepunkt   alles, Hits, Fagott + Oboe + Chor im Unisono, Toms-Wirbel
  56–59  Rückführung Ausdünnen auf Marimba + Toms, Wirbel → Sprung zurück auf Takt 0

Harmonie (8-Takt-Zyklus): Bm | Bm | G | G | Em | Bm | G | F#. Dominante (Fis-Dur mit Ais) am Ende
jedes Zyklus zieht zurück nach h-Moll, der Loop endet auf F# (Halbschluss).
Aufruf:  python3 scripts/music/theme_paraseed.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 120, 60                        # 60 × 4 × 60/120 = 120,0 s
song = Song(bpm=BPM, bars=BARS)
rnd = random.Random(13)

song.inst('contra',  'contra',   80, 64)
song.inst('bass',    'squarebass', 86, 60)
song.inst('marimba', 'marimba',  96, 30)
song.inst('kalimba', 'kalimba',  92, 96)
song.inst('harp',    'harp',     84, 52)
song.inst('bassoon', 'bassoon',  92, 44)
song.inst('oboe',    'oboe',     84, 78)
song.inst('choir',   'oohs',     80, 64)
song.inst('tremolo', 'tremolo',  66, 88)
song.inst('pad',     'atmos',    66, 36)
song.inst('pad2',    'warm',     60, 92)
song.inst('hit',     'hit',      92, 64)
song.inst('bell',    'crystal',  52, 74)

# Akkord → (Grundton, Intervalle)
CH = {'Bm': (B, (0, 3, 7, 10)), 'G': (G, (0, 4, 7, 11)), 'Em': (E, (0, 3, 7, 10)), 'F#': (Gb, (0, 4, 7, 10))}
SCALE = {B, Db, D, E, Gb, G, A, C, Bb}      # h-Moll + phrygisches C + Leitton Ais (B) der Dominante
def chk(p):
    assert p % 12 in SCALE, f'Ton außerhalb der Skala: {p}'
    return p
def tones(ch, octv):
    r, iv = CH[ch]; base = n(r, octv)
    return [base + i for i in iv]
def rootn(ch, octv): return n(CH[ch][0], octv)
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
NAMES = {'C': C, 'C#': Db, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'F#': Gb, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'A#': Bb, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))

CYC = ['Bm', 'Bm', 'G', 'G', 'Em', 'Bm', 'G', 'F#']
prog = (CYC * 8)[:BARS]
assert len(prog) == BARS

# ---- Ostinati: Zyklen mit teilerfremder Länge, je 8-Takt-Block neu gestartet ---------------
def ostinato(inst, b0, cycle_len, step, order, octv, vel, dur_f=0.8):
    """Läuft über 8 Takte; Ton = Akkordton nach `order`, Akkord nach Takt der Position."""
    total = int(8 * 4 / step)
    for k in range(total):
        pos = b0 * 4 + k * step; bar = int(pos // 4)
        if bar >= BARS: break
        t = tones(prog[bar], octv) + [tones(prog[bar], octv)[0] + 12]
        idx = order[k % cycle_len]
        song.add(inst, pos, step * dur_f, chk(t[idx]), vel + (10 if k % cycle_len == 0 else 0) + rnd.randint(-4, 4))

MARIMBA = lambda b0, vel=88: ostinato('marimba', b0, 5, 0.25, [0, 2, 1, 3, 2], 4, vel)
KALIMBA = lambda b0, vel=84: ostinato('kalimba', b0, 7, 0.25, [3, 1, 2, 0, 4, 2, 1], 5, vel)
HARP    = lambda b0, vel=76: ostinato('harp', b0, 3, 0.5, [0, 1, 2], 3, vel, 1.6)

# ---- Bässe ------------------------------------------------------------------------------
def wet_bass(b, ch, vel=88):
    s = song.bar(b); r = rootn(ch, 2)
    for off, d, o in ((0, .75, 0), (1.5, .5, 0), (2, .75, 0), (3, .5, 7 if ch != 'F#' else 4), (3.5, .5, 0)):
        song.add('bass', s + off, d, chk(r + o), vel + (8 if off == 0 else 0))
def contra(b, ch, vel=78): song.add('contra', song.bar(b), 3.9, rootn(ch, 1), vel)

# ---- Thema: Kriech-Motiv (h–c–h–d, Halbton-Schleichen) -----------------------------------
# Melodie je Takt des 8-Takt-Zyklus (Bm Bm G G Em Bm G F#)
THEME = [
    [(0, 1, 'B3'), (1, .5, 'C4'), (1.5, .5, 'B3'), (2, 1.5, 'D4'), (3.5, .5, 'C4')],
    [(0, 1, 'B3'), (1, .5, 'C4'), (1.5, .5, 'B3'), (2, 1, 'F#4'), (3, 1, 'D4')],
    [(0, 1, 'G3'), (1, .5, 'A3'), (1.5, .5, 'G3'), (2, 1.5, 'B3'), (3.5, .5, 'A3')],
    [(0, 1, 'G3'), (1, .5, 'A3'), (1.5, .5, 'G3'), (2, 1, 'D4'), (3, 1, 'B3')],
    [(0, 1, 'E4'), (1, .5, 'F#4'), (1.5, .5, 'G4'), (2, 1, 'F#4'), (3, 1, 'E4')],
    [(0, 1, 'D4'), (1, .5, 'C4'), (1.5, .5, 'B3'), (2, 2, 'F#4')],
    [(0, .5, 'G4'), (.5, .5, 'F#4'), (1, 1, 'D4'), (2, 1, 'B3'), (3, 1, 'D4')],
    [(0, 1, 'C#4'), (1, 1, 'A#3'), (2, 1, 'C#4'), (3, .5, 'F#4'), (3.5, .5, 'A#3')],
]
def theme(b0, inst, oct_shift=0, vel=88, bars=8):
    for i, notes in enumerate(THEME[:bars]):
        for off, dur, p in notes:
            song.add(inst, song.bar(b0 + i) + off, dur * 0.95, chk(nt(p) + oct_shift), vel + (6 if off % 1 == 0 else 0))

def choir(b, ch, vel=78):
    for p in tones(ch, 4)[:3]: song.add('choir', song.bar(b), 3.95, chk(p), vel)
def tremolo(b, ch, vel=66):
    for p in tones(ch, 4)[:3]: song.add('tremolo', song.bar(b), 3.95, chk(p), vel)
def pads(b, ch, vel=62):
    for p in tones(ch, 3)[:3]: song.add('pad', song.bar(b), 3.95, chk(p), vel)
    for p in tones(ch, 5)[1:4]: song.add('pad2', song.bar(b), 3.95, chk(p), vel - 6)
def spore(b, ch, vel=56):                                   # Sporen: hohe Kristalltropfen
    t = tones(ch, 6)
    for off in (0.75, 1.75, 2.5, 3.25):
        if rnd.random() < 0.7: song.add('bell', song.bar(b) + off, .3, chk(rnd.choice(t)), vel + rnd.randint(-6, 6))
def hit(b, beat, ch, vel=104):
    for p in (rootn(ch, 2), rootn(ch, 3), rootn(ch, 3) + 7): song.add('hit', song.bar(b) + beat, .9, chk(p), vel)

# ---- Schlagzeug -----------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    for off, vel in ((0, 116), (1.75, 92), (2.5, 100)): d(off, KICK, vel)
    d(0.75, TOM_L, 82); d(3.25, TOM_L, 86)                         # dumpfes Pulsen
    d(1, SIDESTICK if kind < 3 else SNARE, 100 if kind < 3 else 104)
    d(3, SIDESTICK if kind < 3 else SNARE, 104 if kind < 3 else 108)
    if kind >= 3: d(3, CLAP, 92)
    for i in range(8): d(i * 0.5, HAT, 100 if i % 2 == 0 else 80)
    d(2, COWBELL, 66); d(3.5, COWBELL, 58)
    if kind >= 4:
        d(1.5, TOM_M, 92); d(2.75, TOM_H, 94); d(3.75, TOM_HH, 96)
def fill(b, big=False):
    s = song.bar(b); toms = [TOM_HH, TOM_H, TOM_M, TOM_L]
    for i in range(8): song.dr(s + 2 + i * .25, toms[min(3, i // 2)], ramp(i, 8, 84, 118), .2)
    if big:
        for i in range(8): song.dr(s + 1 + i * .125, SNARE, ramp(i, 8, 66, 104), .1)
    song.dr(s + 3.75, KICK, 118)

# ===== Komposition: alle 8 Takte kommt eine Stimme dazu =============================
for b in range(BARS):
    ch = prog[b]; blk = b // 8
    groove(b, 1 if blk == 0 else 2 if blk < 4 else 3 if blk < 6 else 4, 0.95 if b < 8 else 1.0)
    if b >= 56:
        wet_bass(b, ch, 84); continue
    if blk == 0: wet_bass(b, ch, 78)
    if blk >= 1: wet_bass(b, ch, 84)
    if blk >= 2: contra(b, ch)
    if blk >= 4: choir(b, ch, 74); tremolo(b, ch, 62)
    if blk >= 5: pads(b, ch, 60); spore(b, ch)
for blk in range(7):
    b0 = blk * 8
    MARIMBA(b0, 90 if blk < 6 else 96)
    if blk >= 1: KALIMBA(b0, 84)
    if blk >= 2: HARP(b0, 78)
# Rückführung: Marimba/Kalimba ausdünnen bis auf Marimba (Takte 56–59 ohne Kalimba/Harfe → Anfang)
MARIMBA(56, 88)
theme(24, 'bassoon', 0, 92)                       # Fagott: erstes Kriech-Motiv
theme(32, 'bassoon', 0, 94)
theme(40, 'oboe', 12, 88); theme(40, 'bassoon', 0, 84)
theme(48, 'oboe', 12, 94); theme(48, 'bassoon', 0, 96); theme(48, 'choir', 12, 70)
theme(56, 'bassoon', 0, 82, bars=2)         # Rückführung: Motiv-Anfang leise im Fagott
# Höhepunkt: Hits, Fills, Crashs
for b in (48, 52): hit(b, 0, prog[b], 108)
hit(51, 2, prog[51], 100); hit(55, 3.5, 'F#', 104)
for b in (7, 15, 23, 31, 39, 47): fill(b, big=(b in (31, 47)))
fill(55, True); fill(59, True)
for b in (8, 24, 32, 40, 48): song.dr(song.bar(b), CRASH, 108, 1.0)
song.dr(song.bar(0), CRASH, 100, 1.0)

sf2, out = cli_paths('bgm_theme_paraseed.ogg')
song.render(sf2, out)
