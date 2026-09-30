# -*- coding: utf-8 -*-
"""Theme „Chrome Swarm“ (Archetyp Cybug) → public/music/bgm_theme_cybug.ogg

Kalt-elektronischer Insektenschwarm in f-Phrygisch (F Ges As B C Des Es), 156 BPM, 72 Takte
(110,8 s), nahtlos loopbar. Rein synthetisch: Square-Sequenzer-Läufe in 16teln (Bitcrush-Roboter),
Sägezahn-Lead, 32tel-Triller als „Summen“ (Flügelschlag/Modulation), Acid-Bass im 3+3+2-Raster,
Four-on-the-floor mit Clap und metallischem Cowbell-Beat. Das Schwarm-Motiv (Grundton – Halbton-
Nachbar – Grundton – Terz – Quinte) läuft über alle Akkorde; der phrygische Halbton (F–Ges) ist
die Bedrohung, der Ges-Akkord vor F-Moll die „Kontrolle“ des Hive-Mind.

Aufbau (Takte, 0-basiert):
   0– 7  Intro        Kick, Hats, Sequenzer solo, ab Takt 4 Acid-Bass, Clap und Motiv-Fragment
   8–23  Schwarm A    Motiv im Sägezahn-Lead über Fm-Fm-Ges-Fm-Fm-Esm-Des-Ges; zweiter Durchgang
                      mit Crystal-Pings, Triller-Summen und Sub-Bass
  24–39  Aufbau B     Sequenzer in 16teln über steigender Harmonik, Lead/Sequenzer im Wechsel,
                      Summ-Triller wachsen, Sweeps, Stabs, Toms
  40–55  Höhepunkt C  Hymne in Lead + Charang in Oktaven, Motiv als Square-Ostinato darunter,
                      doppelte Kick, Crash alle 4 Takte
  56–63  Störung D    Break: Herzschlag-Kick, Glitch-Pings, Sequenzer-Rest, Sweep steigt
  64–71  Rückführung E  Riser + Snare-Wirbel über b-Moll/Es-Moll/Des → Ges (phrygischer Halbton-
                      Schritt) → Sprung auf Takt 0 (F-Moll), keine Schlusskadenz
Aufruf:  python3 scripts/music/theme_cybug.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 156, 72                       # 72 × 4 × 60/156 = 110,8 s
song = Song(bpm=BPM, bars=BARS)
song.inst('bass',   'sbass2',    100, 62)
song.inst('sub',    'squarebass', 84, 64)
song.inst('seq',    'square',     70, 44)   # Sequenzer (Bitcrush-Roboter)
song.inst('lead',   'saw',        84, 76)
song.inst('lead2',  'charang',    72, 52)
song.inst('buzz',   'sbrass2',    58, 84)   # Summen: 32tel-Triller
song.inst('pad',    'synstr2',    60, 64)
song.inst('sweep',  'sweep',      66, 64)
song.inst('glitch', 'scifi',      66, 30)
song.inst('hit',    'hit',        90, 64)
song.inst('crystal','crystal',    62, 90)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
SCALE = {F, Gb, Ab, Bb, C, Db, Eb}        # f-Phrygisch
CH = {'Fm': [F, Ab, C], 'Gb': [Gb, Bb, Db], 'Ebm': [Eb, Gb, Bb], 'Db': [Db, F, Ab],
      'Bbm': [Bb, Db, F], 'Ab': [Ab, C, Eb]}
ROOT = {'Fm': F, 'Gb': Gb, 'Ebm': Eb, 'Db': Db, 'Bbm': Bb, 'Ab': Ab}
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
def bassroot(ch): pc = ROOT[ch]; return n(pc, 2) if pc in (Db, Eb) else n(pc, 1)
def tones(ch, lo, hi): return [p for p in range(lo, hi + 1) if p % 12 in CH[ch]]
def scale_up(p): return min(q for q in range(p + 1, p + 4) if q % 12 in SCALE)   # nächster Skalenton darüber

# Schwarm-Motiv je Akkord: (Grundton, Nachbar, Terz, Quinte)
MOT = {'Fm': ('F5', 'Gb5', 'Ab5', 'C6'), 'Gb': ('Gb5', 'Ab5', 'Bb5', 'Db6'), 'Ebm': ('Eb5', 'F5', 'Gb5', 'Bb5'),
       'Db': ('Db5', 'Eb5', 'F5', 'Ab5'), 'Bbm': ('Bb4', 'C5', 'Db5', 'F5'), 'Ab': ('Ab5', 'Bb5', 'C6', 'Eb6')}
def motif(ch, tail='hold'):
    r, nb, th, top = MOT[ch]
    a = [(0, .25, r), (.25, .25, nb), (.5, .25, r), (.75, .25, th), (1, .5, top), (1.5, .25, th), (1.75, .25, r),
         (2, .25, r), (2.25, .25, nb), (2.5, .25, r), (2.75, .25, th)]
    return a + ([(3, 1, top)] if tail == 'hold' else [(3, .5, th), (3.5, .5, nb)])
def check(notes, b=0):
    for off, dur, p in notes: assert nt(p) % 12 in SCALE, (b, p)

def line(b, notes, insts, vels, shift=0):
    check(notes, b)
    for off, dur, p in notes:
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.9, nt(p) + shift, v + (6 if off == 0 else 0))

# ---- Bausteine -------------------------------------------------------------------------------
def bassline(b, ch, vel=100, sparse=False):
    """Acid-Bass im 3+3+2-Raster (16tel-Schritte 0,3,6,8,11,14), Oktavsprünge auf 2 und 10."""
    r = bassroot(ch); s = song.bar(b)
    for st in ((0, 8) if sparse else (0, 3, 6, 8, 11, 14)):
        song.add('bass', s + st * .25, .22, r, vel + (10 if st == 0 else 0))
    if not sparse:
        for st in (2, 10): song.add('bass', s + st * .25, .2, r + 12, vel - 18)
        song.add('bass', s + 13 * .25, .2, r + 7, vel - 26)
def sub(b, ch, vel=84):
    for off in (0, 2): song.add('sub', song.bar(b) + off, 1.9, bassroot(ch), vel)
def seqr(b, ch, vel, pat=0, lo=60, hi=79):
    """Roboter-Sequenzer: 16 Schritte über Akkordtöne, starr im Raster."""
    pool = tones(ch, lo, hi); P = [[0, 0, 1, 0, 2, 0, 1, 0], [0, 1, 2, 1, 0, 2, 3, 2], [0, 0, 3, 0, 1, 1, 4, 1]][pat]
    for i in range(16):
        song.add('seq', song.bar(b) + i * .25, .2, pool[P[i % 8] % len(pool)], vel + (10 if i % 4 == 0 else 0))
def trill(b, ch, vel, bars=1, lo=72, hi=88):
    """Summen: 32tel-Triller zwischen Akkordton und nächstem Skalenton."""
    p = tones(ch, lo, hi)[0]; q = scale_up(p)
    for i in range(32 * bars): song.add('buzz', song.bar(b) + i * .125, .11, p if i % 2 == 0 else q, vel + (8 if i % 8 == 0 else 0))
def pad(b, ch, vel, bars=1):
    for p in tones(ch, 55, 70)[:3]: song.add('pad', song.bar(b), 4 * bars - .05, p, vel)
def ping(b, ch, vel):
    pool = tones(ch, 84, 100)
    for i, off in enumerate((0.5, 1.25, 2, 2.75, 3.5)): song.add('crystal', song.bar(b) + off, .2, pool[(i * 2) % len(pool)], vel)
def drums(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'intro':
        for i in range(4): d(i, KICK, 112)
        for i in range(16): d(i * .25, HAT, 112 if i % 4 == 2 else 92 if i % 2 == 0 else 76)
        d(1.5, COWBELL, 84)
    elif kind == 'A':
        for i in range(4): d(i, KICK, 114)
        d(1, CLAP, 108); d(3, CLAP, 112); d(1, SNARE, 90); d(3, SNARE, 94)
        for i in range(16): d(i * .25, HAT, 114 if i % 4 == 2 else 92 if i % 2 == 0 else 76)
        for off in (.5, 1.5, 2.5, 3.5): d(off, COWBELL, 78)
        d(3.75, SIDESTICK, 80)
    elif kind == 'B':
        for i in range(4): d(i, KICK, 116)
        d(2.75, KICK, 96); d(1, CLAP, 112); d(3, CLAP, 116); d(1, SNARE, 100); d(3, SNARE, 104)
        for i in range(16): d(i * .25, HAT, 118 if i % 4 == 2 else 96 if i % 2 == 0 else 80)
        for off in (.5, 1.5, 2.5, 3.5): d(off, COWBELL, 88)
        d(3.25, TOM_M, 86)
    elif kind == 'C':
        for i in range(4): d(i, KICK, 118)
        for off in (.75, 1.75, 2.75, 3.5): d(off, KICK, 96)
        d(1, CLAP, 116); d(3, CLAP, 118); d(1, SNARE, 108); d(3, SNARE, 112)
        for i in range(16): d(i * .25, HAT, 122 if i % 4 == 2 else 100 if i % 2 == 0 else 84)
        for off in (.5, 1.5, 2.5, 3.5): d(off, COWBELL, 94)
        d(2.5, TOM_L, 92); d(3.25, TOM_M, 94)
    elif kind == 'beat':                   # Herzschlag im Break
        d(0, KICK, 108); d(1.5, KICK, 92); d(2, KICK, 104); d(3.5, SIDESTICK, 96)
        for off in (1, 3): d(off, CLAP, 92)
        for i in range(8): d(i * .5, HAT, 110 if i % 2 else 92)
def fill(b, big=False):
    s = song.bar(b)
    for i in range(8): song.dr(s + 2 + i * .25, [TOM_H, TOM_HH, TOM_M, TOM_L][i // 2], ramp(i, 8, 90, 120), .2)
    if big:
        for i in range(8): song.dr(s + 1 + i * .125, SNARE, ramp(i, 8, 70, 108), .1)
    song.dr(s + 3.75, KICK, 118)
def roll(b, a, z, v0, v1):
    cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(song.bar(b) + a + i * .25, SNARE, ramp(i, cnt, v0, v1), .15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, .5)
def stab(b, beat, ch, vel=110, dur=.5):
    for p in tones(ch, 48, 65)[:3] + [tones(ch, 60, 77)[0]]: song.add('hit', song.bar(b) + beat, dur, p, vel)
def riser(b, bars, root_p, v0, v1):
    """Sweep-Riser: Halbtonschritte aufwärts (chromatisches Aufheulen), lange Töne."""
    steps = bars * 4
    for i in range(steps): song.add('sweep', song.bar(b) + i, 0.95, root_p + i, ramp(i, steps, v0, v1))

# ==== Arrangement ==============================================================================
# ---- Intro (0–7): Fm Fm Gb Fm | Fm Fm Ebm Gb ----------------------------------------------------
CH_I = ['Fm', 'Fm', 'Gb', 'Fm', 'Fm', 'Fm', 'Ebm', 'Gb']
crash(0, 100); stab(0, 0, 'Fm', 100, 1.5)
for i, ch in enumerate(CH_I):
    b = i; drums(b, 'intro', .95 + i * .02); seqr(b, ch, 66 + i * 2, pat=0 if i < 4 else 1); pad(b, ch, 44 + i * 3)
    if i >= 4:
        bassline(b, ch, 84 + (i - 4) * 4, sparse=(i == 4)); sub(b, ch, 70)
        for off in (1, 3): song.dr(song.bar(b) + off, CLAP, 90 + (i - 4) * 4)
    if i in (6, 7): line(b, motif(ch, 'tail'), ['lead'], [86 + (i - 6) * 6])
fill(7, big=True); roll(7, 0, 1, 70, 100)

# ---- Schwarm A (8–23): Fm Fm Gb Fm | Fm Ebm Db Gb -------------------------------------------------
CH_A = ['Fm', 'Fm', 'Gb', 'Fm', 'Fm', 'Ebm', 'Db', 'Gb']
crash(8, 112); stab(8, 0, 'Fm', 110, 1.0)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; second = i >= 8
    drums(b, 'A', 1.0 + (.05 if second else 0)); bassline(b, ch, 100 + (4 if second else 0)); sub(b, ch, 78)
    seqr(b, ch, 58 + (8 if second else 0), pat=1, lo=55, hi=70)
    line(b, motif(ch, 'tail' if k in (3, 7) else 'hold'), ['lead'] + (['lead2'] if second else []), [96, 66])
    pad(b, ch, 50 + (8 if second else 0))
    if second: ping(b, ch, 70); trill(b, ch, 46 + (k // 2) * 4)
    if k == 7: fill(b)
fill(23, big=True); roll(23, 0, 2, 70, 104)

# ---- Aufbau B (24–39): Bbm Gb Ab Fm | Bbm Gb Ebm Gb  //  Db Ab Bbm Gb | Db Ebm Gb Gb --------------
CH_B = ['Bbm', 'Gb', 'Ab', 'Fm', 'Bbm', 'Gb', 'Ebm', 'Gb', 'Db', 'Ab', 'Bbm', 'Gb', 'Db', 'Ebm', 'Gb', 'Gb']
crash(24, 114); crash(32, 116); stab(24, 0, 'Bbm', 112, 1.0); stab(32, 0, 'Db', 114, 1.0)
for i in range(16):
    b = 24 + i; ch = CH_B[i]; second = i >= 8
    drums(b, 'B', 1.0 + (.05 if second else 0)); bassline(b, ch, 104); sub(b, ch, 82)
    seqr(b, ch, 74 + (6 if second else 0), pat=2 if second else 1, lo=60, hi=79)
    pad(b, ch, 58); trill(b, ch, 50 + (i % 8) * 4, lo=72 + (0 if not second else 5), hi=88)
    if i % 2 == 0: line(b, motif(ch, 'hold'), ['lead'] + (['lead2'] if second else []), [98, 70])
    else: ping(b, ch, 74)
    if i % 4 == 3: fill(b)
    if i in (7, 15): riser(b - 3, 4, n(F, 4), 40, 92)
fill(39, big=True); roll(39, 0, 3, 80, 118)

# ---- Höhepunkt C (40–55): Hymne über Fm Db Ab Ebm | Fm Db Gb Gb ------------------------------------
CH_C = ['Fm', 'Db', 'Ab', 'Ebm', 'Fm', 'Db', 'Gb', 'Gb']
HYMN = [
    [(0,1.5,'C6'),(1.5,.5,'Ab5'),(2,1,'F5'),(3,1,'Ab5')],
    [(0,1.5,'Ab5'),(1.5,.5,'F5'),(2,1,'Db5'),(3,1,'F5')],
    [(0,1,'C6'),(1,1,'Eb6'),(2,1.5,'C6'),(3.5,.5,'Ab5')],
    [(0,1,'Bb5'),(1,.5,'Gb5'),(1.5,.5,'Bb5'),(2,2,'Eb6')],
    [(0,1.5,'F6'),(1.5,.5,'Eb6'),(2,1,'C6'),(3,1,'Ab5')],
    [(0,1,'Db6'),(1,1,'Ab5'),(2,1,'F5'),(3,1,'Ab5')],
    [(0,1,'Bb5'),(1,1,'Db6'),(2,1,'Gb6'),(3,1,'Db6')],
    [(0,.5,'Db6'),(.5,.5,'Bb5'),(1,.5,'Gb5'),(1.5,.5,'Bb5'),(2,1,'Ab5'),(3,1,'Gb5')],
]
crash(40, 122); stab(40, 0, 'Fm', 118, 1.5); crash(48, 118); stab(48, 0, 'Fm', 116, 1.0)
for i in range(16):
    b = 40 + i; k = i % 8; ch = CH_C[k]; second = i >= 8
    drums(b, 'C', 1.0 + (.04 if second else 0)); bassline(b, ch, 108); sub(b, ch, 86)
    line(b, HYMN[k], ['lead', 'lead2'], [100, 84], shift=0)
    if second: line(b, HYMN[k], ['lead2'], [70], shift=12)
    seqr(b, ch, 66, pat=0, lo=55, hi=70); pad(b, ch, 66)
    if i % 2 == 1 or second: trill(b, ch, 54, lo=76, hi=90)
    if i % 4 == 0 and i not in (0, 8): crash(b, 104)
    if i % 4 == 3: fill(b)
fill(55, big=True); roll(55, 0, 3, 90, 127)

# ---- Störung D (56–63): Break mit Herzschlag ---------------------------------------------------------
CH_D = ['Fm', 'Fm', 'Gb', 'Gb', 'Fm', 'Fm', 'Ebm', 'Gb']
crash(56, 100)
for i, ch in enumerate(CH_D):
    b = 56 + i
    drums(b, 'beat', .95 + i * .02); bassline(b, ch, 92 + i * 2, sparse=(i < 4)); sub(b, ch, 76)
    seqr(b, ch, 58 + i * 3, pat=0 if i < 4 else 2, lo=60, hi=79); pad(b, ch, 46 + i * 3)
    ping(b, ch, 58 + i * 3)
    if i >= 4: line(b, motif(ch, 'tail'), ['lead'], [84 + i * 2]); trill(b, ch, 44 + i * 4)
    if i < 4:
        for off, pn in ((0.75, n(F, 6)), (2.25, n(Ab, 6)), (3.5, n(C, 7))): song.add('glitch', song.bar(b) + off, .15, pn, 76)
fill(63)

# ---- Rückführung E (64–71): Bbm Bbm Ebm Ebm Db Db Gb Gb → F-Moll -------------------------------------
CH_E = ['Bbm', 'Bbm', 'Ebm', 'Ebm', 'Db', 'Db', 'Gb', 'Gb']
crash(64, 108); stab(64, 0, 'Bbm', 112, 1.0)
riser(64, 8, n(F, 3), 40, 100)
for i, ch in enumerate(CH_E):
    b = 64 + i
    if i < 4: drums(b, 'B', .95 + i * .03)
    else: roll(b, 0, 4, 60 + (i - 4) * 10, 90 + (i - 4) * 12)
    if i >= 4:
        for j in range(4): song.dr(song.bar(b) + j, KICK, 112)
    bassline(b, ch, 100 + i * 2); sub(b, ch, 84)
    seqr(b, ch, 70 + i * 3, pat=2, lo=60, hi=79); pad(b, ch, 60 + i * 3); trill(b, ch, 52 + i * 5, lo=76, hi=90)
    if i % 2 == 0: line(b, motif(ch, 'hold'), ['lead'], [92 + i * 2])
    if i in (3, 5): fill(b)
line(71, [(0,.25,'Gb5'),(.25,.25,'Bb5'),(.5,.25,'Db6'),(.75,.25,'Gb6'),(1,1,'Db6'),(2,1.6,'Bb5')], ['lead', 'lead2'], [108, 84])
fill(71, big=True)

# ---- Rendern ----------------------------------------------------------------------------------
sf2, out = cli_paths('bgm_theme_cybug.ogg')
song.render(sf2, out)
