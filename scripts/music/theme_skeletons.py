# -*- coding: utf-8 -*-
"""Theme-Battle-Track „Dance of Dry Bones“ (Skeletons) → public/music/bgm_theme_skeletons.ogg

Danse macabre im Kampf: cis-Moll, 126 BPM, 60 Takte (114,3 s), nahtlos loopbar.
Triolen-Swing (Walzer-Feeling im 4/4-Gewand): klappernde Xylophon-Knochen, Pizzicato-Bass,
Cembalo-Nachschläge, Geigen-Solo mit Tritonus/Leitton-Motiv (Halbton- und übermäßige Sekunde
a–his), Grabesglocke auf cis. Holzblock/Sidestick sind die „Knochen“ im Schlagzeug.

Aufbau (Takte, 0-basiert):
   0– 7  Intro         Grabesglocke, Pizzicato, Knochenklappern (Xylophon + Holzblock), Cembalo
   8–23  Thema A       Geige: Hauptmotiv (E–Dis–Cis…), Xylophon-Gegenstimme, Fagott/Klarinette antwortet
  24–39  Steigerung B  fallender Bass (cis–h–a–gis–fis–d–gis), Geigen-Triolenketten, Tremolo-Streicher,
                       zweiter Durchgang mit Orgel, Klarinette, Xylophon-Läufen
  40–51  Höhepunkt C   Thema A in Geige + Trompete + Oboe, Chor, Orgel; volles Schlagzeug
  52–59  Rückführung D Glocken, Knochen-Läufe steigen, Halbschluss auf gis → Sprung zum Intro

Harmonie: cis-Moll (harmonisch) mit Dur-Dominante gis, bII (D) als Schauerfarbe. Kein Schluss.
Aufruf:  python3 scripts/music/theme_skeletons.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 126, 60                      # 60 × 4 × 60/126 = 114,3 s
song = Song(bpm=BPM, bars=BARS)
song.inst('contra',  'contra',  80, 64)
song.inst('bass',    'pizz',   100, 58)   # Pizzicato-Bass
song.inst('harpsi',  'harpsichord', 86, 46)  # Nachschläge
song.inst('xylo',    'xylo',    92, 76)   # klappernde Knochen
song.inst('violin',  'violin',  92, 66)   # Solo
song.inst('violin2', 'violin',  78, 44)   # Terz-Verdopplung / Ketten
song.inst('tremolo', 'tremolo', 70, 84)
song.inst('bell',    'bell',    92, 60)   # Grabesglocke
song.inst('clar',    'clarinet',80, 34)
song.inst('bassoon', 'bassoon', 84, 90)
song.inst('oboe',    'oboe',    82, 82)
song.inst('organ',   'organ2',  70, 64)
song.inst('choir',   'choir',   74, 64)
song.inst('trumpet', 'trumpet', 80, 72)

NAMES = {'C': C, 'C#': Db, 'D': D, 'D#': Eb, 'E': E, 'F': F, 'F#': Gb, 'G': G, 'G#': Ab, 'A': A, 'A#': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
SCALE = {1, 3, 4, 6, 8, 9, 11, 0}        # cis-Moll harmonisch + natürlich (h)
CH = {'C#m': (1, 3), 'F#m': (6, 3), 'G#': (8, 4), 'A': (9, 4), 'B': (11, 4), 'D': (2, 4)}
def T(x): return x / 3.0                 # Triolen-Einheit (1/3 Viertel)
def root(ch, o): return n(CH[ch][0], o)
def tones(ch, o):
    r = root(ch, o); return [r, r + CH[ch][1], r + 7]

def mel(b, notes, insts, vels, shift=0, chord=None):
    for st, du, p in notes:
        m = nt(p) + shift
        assert (m % 12) in SCALE | ({2} if chord == 'D' else set()), (b, p)
        for i, v in zip(insts, vels): song.add(i, song.bar(b) + T(st), T(du) * 0.92, m, v)

CH_I = ['C#m', 'C#m', 'F#m', 'C#m', 'A', 'A', 'G#', 'G#']
CH_A = ['C#m', 'C#m', 'F#m', 'C#m', 'A', 'G#', 'C#m', 'G#']
CH_B = ['C#m', 'B', 'A', 'G#', 'F#m', 'D', 'G#', 'G#']
CH_C = CH_A + CH_B[:4]
CH_D = ['C#m', 'C#m', 'F#m', 'F#m', 'A', 'A', 'G#', 'G#']

MEL_A = [
    [(0,2,'E5'),(2,1,'D#5'),(3,2,'C#5'),(5,1,'B4'),(6,2,'C#5'),(8,1,'E5'),(9,3,'G#5')],
    [(0,2,'F#5'),(2,1,'E5'),(3,2,'D#5'),(5,1,'C5'),(6,6,'B4')],
    [(0,2,'A5'),(2,1,'F#5'),(3,2,'A5'),(5,1,'F#5'),(6,2,'C#6'),(8,1,'A5'),(9,3,'F#5')],
    [(0,3,'E5'),(3,3,'G#5'),(6,3,'E5'),(9,3,'C#5')],
    [(0,2,'C#6'),(2,1,'B5'),(3,2,'A5'),(5,1,'E5'),(6,6,'A5')],
    [(0,2,'D#5'),(2,1,'C5'),(3,2,'D#5'),(5,1,'G#5'),(6,6,'F#5')],
    [(0,2,'E5'),(2,1,'C#5'),(3,3,'G#4'),(6,3,'C#5'),(9,3,'E5')],
    [(0,2,'D#5'),(2,1,'C5'),(3,2,'D#5'),(5,1,'G#4'),(6,6,'G#5')],
]
MEL_B = [
    [(0,3,'G#5'),(3,3,'E5'),(6,3,'G#5'),(9,3,'C#6')],
    [(0,3,'F#5'),(3,3,'D#5'),(6,3,'F#5'),(9,3,'B5')],
    [(0,3,'E5'),(3,3,'C#5'),(6,3,'E5'),(9,3,'A5')],
    [(0,3,'D#5'),(3,3,'C5'),(6,3,'D#5'),(9,2,'G#5'),(11,1,'F#5')],
    [(0,2,'A5'),(2,1,'F#5'),(3,2,'A5'),(5,1,'C#6'),(6,6,'F#5')],
    [(0,3,'F#5'),(3,3,'A5'),(6,3,'F#5'),(9,3,'D6')],
    [(0,3,'D#6'),(3,3,'C6'),(6,3,'G#5'),(9,3,'D#5')],
    [(0,3,'C5'),(3,3,'D#5'),(6,3,'G#5'),(9,3,'C6')],
]

# ---- Bausteine ----------------------------------------------------------------------------
def bass(b, ch, nxt, vel=96):
    s = song.bar(b); r = root(ch, 2); f = r + 7
    for st, p, v in ((0, r, vel + 8), (3, f, vel - 6), (6, r + 12 if r < 44 else r, vel), (9, f, vel - 8)):
        song.add('bass', s + T(st), 0.8, p, v)
    song.add('bass', s + T(11), 0.3, root(nxt, 2) - 1, vel - 20)          # chromatischer Anlauf

def pedal(b, ch, vel=70):
    r = root(ch, 1); r = r + 12 if r < 28 else r
    song.add('contra', song.bar(b), 3.95, r, vel)

def harpsi(b, ch, vel=80):
    s = song.bar(b)
    for st in (3, 9):                                           # Nachschläge auf 2 und 4
        for p in tones(ch, 4): song.add('harpsi', s + T(st), 0.45, p, vel)
    song.add('harpsi', s + T(6), 0.3, tones(ch, 3)[2] + 12, vel - 22)

def bones(b, ch, vel=88, dense=False):
    """Xylophon-Knochenklappern: Swing-Achtel über Akkordtönen, oben Oktave 5–6."""
    s = song.bar(b); tt = tones(ch, 5); cyc = [tt[0], tt[2], tt[1], tt[2]]
    pos = (0, 2, 3, 5, 6, 8, 9, 11) if dense else (0, 3, 6, 9)
    for i, st in enumerate(pos): song.add('xylo', s + T(st), 0.28, cyc[i % 4] + (12 if i % 4 == 3 and dense else 0), vel - (10 if st % 3 else 0))

def bone_run(b, start, vel0, vel1, up=True):
    """Triolenlauf (Knochenrasseln) über cis-Moll ab Beat `start` bis Taktende."""
    s = song.bar(b) + start; sc = [n(p, 5) for p in (1, 3, 4, 6, 8, 9, 11)] + [n(p, 6) for p in (1, 3, 4, 6)]
    cnt = int((4 - start) * 3)
    for i in range(cnt):
        k = i % len(sc) if up else (len(sc) - 1 - i % len(sc))
        song.add('xylo', s + i / 3.0, 0.3, sc[k], vel0 + (vel1 - vel0) * i / max(1, cnt - 1))

def tremolo(b, ch, vel=66):
    for p in tones(ch, 4): song.add('tremolo', song.bar(b), 3.95, p, vel)

def organ(b, ch, vel=66):
    for p in tones(ch, 3) + [tones(ch, 4)[0]]: song.add('organ', song.bar(b), 3.95, p, vel)

def choir(b, ch, vel=70):
    for p in tones(ch, 4): song.add('choir', song.bar(b), 3.95, p, vel)

def bell(b, p='C#', o=3, vel=96, dur=3.5): song.add('bell', song.bar(b), dur, nt(p + str(o)), vel)

# ---- Schlagzeug ----------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(st, note, vel): song.dr(s + T(st), note, min(127, vel * v))
    if kind == 'A':
        d(0, KICK, 108); d(6, KICK, 96); d(3, SIDESTICK, 112); d(9, SIDESTICK, 112); d(3, CLAP, 70); d(9, CLAP, 76)
        for st in (0, 2, 3, 5, 6, 8, 9, 11): d(st, HAT, 100 if st % 3 == 0 else 84)
        for st in (2, 5, 8, 11): d(st, 77, 84)                  # Knochen: Holzblock auf den Swing-Achteln
    elif kind == 'B':
        d(0, KICK, 114); d(3, KICK, 90); d(6, KICK, 108); d(9, KICK, 92)
        d(3, SNARE, 108); d(9, SNARE, 112); d(3, SIDESTICK, 100); d(9, SIDESTICK, 100)
        for st in (0, 2, 3, 5, 6, 8, 9, 11): d(st, HAT, 104 if st % 3 == 0 else 88)
        for st in (2, 5, 8, 11): d(st, 76, 92)
        d(0, COWBELL, 76); d(6, COWBELL, 70)
    elif kind == 'C':
        for st, vv in ((0, 118), (3, 96), (6, 110), (9, 100)): d(st, KICK, vv)
        for st in (3, 9): d(st, SNARE, 116); d(st, CLAP, 90)
        for st in (0, 2, 3, 5, 6, 8, 9, 11): d(st, RIDE, 108 if st % 3 == 0 else 92)
        for st in (2, 5, 8, 11): d(st, 77, 96)
        d(0, CRASH if False else COWBELL, 82)
    elif kind == 'soft':
        d(0, KICK, 90); d(6, KICK, 80); d(3, SIDESTICK, 96); d(9, SIDESTICK, 96)
        for st in (0, 3, 6, 9): d(st, HAT, 96)
        for st in (2, 5, 8, 11): d(st, 76, 84)

def fill(b, big=False):
    s = song.bar(b)
    toms = [TOM_H, TOM_HH, TOM_M, TOM_L]
    for i in range(6): song.dr(s + 2 + i / 3.0, toms[min(3, i * 4 // 6)], 92 + i * 4, 0.2)
    if big:
        for i in range(6): song.dr(s + i / 3.0 * 0.5 + 1.0, SNARE, 70 + i * 8, 0.12)
    song.dr(s + 3.9, KICK, 118)

def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.6)

def snare_roll(b, start, vel0, vel1):
    s = song.bar(b) + start; cnt = int((4 - start) * 3)
    for i in range(cnt): song.dr(s + i / 3.0, SNARE, vel0 + (vel1 - vel0) * i / max(1, cnt - 1), 0.15)

# ==== Arrangement ==========================================================================
# ---- Intro 0–7 ------------------------------------------------------------------------------
for i, ch in enumerate(CH_I):
    b = i; nx = CH_I[(i + 1) % 8]
    pedal(b, ch, 74); bass(b, ch, nx, 88 + i * 2); harpsi(b, ch, 76 + i * 2)
    bones(b, ch, 84 + i * 2, dense=(i >= 4))
    groove(b, 'soft' if i < 4 else 'A', 1.0)
    if i >= 4: tremolo(b, ch, 46 + (i - 4) * 8)
    if i % 4 == 0: bell(b, 'C#', 3, 104)
bell(6, 'G#', 3, 96); bell(7, 'G#', 2, 100)
# Geigen-Vorahnung: Hauptmotiv, angedeutet
mel(6, MEL_A[0][:4], ['violin'], [86]); mel(7, [(0,2,'D#5'),(2,1,'C5'),(3,2,'D#5'),(5,1,'G#4'),(6,6,'G#5')], ['violin'], [92])
crash(0, 108); bone_run(3, 2, 70, 100); bone_run(7, 2, 80, 114); fill(7, True); snare_roll(7, 0, 60, 104)

# ---- Thema A 8–23 ---------------------------------------------------------------------------
crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; nx = CH_A[(k + 1) % 8]; sec = i >= 8
    pedal(b, ch, 76); bass(b, ch, nx, 96); harpsi(b, ch, 82); bones(b, ch, 90, dense=sec)
    groove(b, 'A' if not sec else 'B', 1.0)
    mel(b, MEL_A[k], ['violin'] + (['violin2'] if sec else []), [96, 78], shift=0, chord=ch)
    if sec:
        mel(b, [(st, du, p) for st, du, p in MEL_A[k]], ['clar'], [70], shift=-12, chord=ch)  # Oktave tiefer (Klarinette)
        if k >= 4: tremolo(b, ch, 60)
    if k % 4 == 0: bell(b, 'C#', 3, 90)
bone_run(15, 2, 80, 110); fill(15); bone_run(19, 2, 80, 110, up=False); fill(23, True); snare_roll(23, 0, 60, 108)

# ---- Steigerung B 24–39 ---------------------------------------------------------------------
crash(24, 114); crash(32, 116)
for i in range(16):
    b, k = 24 + i, i % 8; ch = CH_B[k]; nx = CH_B[(k + 1) % 8]; sec = i >= 8
    pedal(b, ch, 84); bass(b, ch, nx, 100); harpsi(b, ch, 84); bones(b, ch, 92, dense=True)
    groove(b, 'B', 1.0 if not sec else 1.05)
    mel(b, MEL_B[k], ['violin', 'violin2'], [98, 80], chord=ch)
    tremolo(b, ch, 66 + (8 if sec else 0))
    if sec:
        organ(b, ch, 62); mel(b, MEL_B[k], ['clar'], [72], shift=-12, chord=ch)
        song.add('bassoon', song.bar(b), 1.9, root(ch, 2) + 12, 88); song.add('bassoon', song.bar(b) + 2, 1.9, root(ch, 2) + 19, 84)
    if k % 4 == 0: bell(b, 'C#', 3, 96)
fill(31); fill(35); bone_run(38, 1, 80, 120); snare_roll(39, 0, 70, 118); fill(39, True)

# ---- Höhepunkt C 40–51 ----------------------------------------------------------------------
crash(40, 120); crash(48, 116)
for i in range(12):
    b = 40 + i; ch = CH_C[i]; nx = CH_C[(i + 1) % 12]
    pedal(b, ch, 90); bass(b, ch, nx, 106); harpsi(b, ch, 88); bones(b, ch, 96, dense=True)
    groove(b, 'C', 1.0); choir(b, ch, 72); organ(b, ch, 66); tremolo(b, ch, 74)
    m = MEL_A[i] if i < 8 else MEL_B[i - 8]
    mel(b, m, ['violin', 'trumpet', 'oboe'], [104, 82, 78], chord=ch)
    mel(b, m, ['violin2'], [80], shift=-12, chord=ch)
    if i % 4 == 0 and i not in (0, 8): crash(b, 100)
    if i % 4 == 0: bell(b, 'C#', 3, 100)
fill(43); fill(47); fill(51, True); bone_run(50, 1, 90, 124); snare_roll(51, 0, 80, 120)

# ---- Rückführung D 52–59 --------------------------------------------------------------------
crash(52, 104)
for i in range(8):
    b = 52 + i; ch = CH_D[i]; nx = CH_D[(i + 1) % 8] if i < 7 else 'C#m'
    pedal(b, ch, 80); bass(b, ch, nx, 92); harpsi(b, ch, 78); bones(b, ch, 86 + i * 2, dense=(i >= 3))
    groove(b, 'A' if i < 6 else 'B', 1.0)
    tremolo(b, ch, 54 + i * 6); organ(b, ch, 46 + i * 3)
    if i < 4: mel(b, MEL_A[i], ['violin'], [80 + i * 2], chord=ch)
    if i % 2 == 0: bell(b, 'G#' if i == 6 else 'C#', 3, 90 + i * 2)
mel(56, [(0,3,'E5'),(3,3,'C#5'),(6,3,'E5'),(9,3,'A5')], ['violin'], [90])
mel(57, [(0,3,'D#5'),(3,3,'C5'),(6,3,'D#5'),(9,3,'G#5')], ['violin'], [94])
mel(58, [(0,3,'C6'),(3,3,'D#6'),(6,3,'C6'),(9,3,'G#5')], ['violin', 'trumpet'], [98, 76])
mel(59, [(0,2,'D#5'),(2,1,'C5'),(3,2,'D#5'),(5,1,'G#4'),(6,6,'G#5')], ['violin'], [104])
bone_run(55, 2, 80, 110); bone_run(58, 0, 84, 118); fill(55); fill(59, True); snare_roll(58, 2, 60, 104)

sf2, out = cli_paths('bgm_theme_skeletons.ogg')
song.render(sf2, out)
