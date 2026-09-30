# -*- coding: utf-8 -*-
"""Theme-Battle-Track „Lullaby of the Abyss“ (Archetyp Deepsea) → public/music/bgm_theme_deepsea.ogg

Klassischer Horror-Kampf in b-Moll, 104 BPM, 56 Takte (129,2 s), nahtlos loopbar.
Eine verstimmte Spieluhr (Glockenspiel + um ~30 Cent verstimmte Glocke) spielt ein Wiegenlied
(F–Es–Des–B …), darunter tiefe Pfeifenorgel, ein Herzschlag-Puls (Pauken „lub-dub“ + Toms),
gleitende Streicher-Cluster (Pitch-Bend-Glissandi, kleine Sekunden) und plötzliche Orchester-Schocks.
Harmonik: b-Moll mit Neapolitaner (Ces/H-Dur) und Tritonus-Akkord (E-Dur gegen den B-Orgelpunkt).
Im Mittelteil spielt die Kalliope einen schiefen Clown-Jahrmarkt-Walzer im 3/4-Takt, der sich als
Polymetrik (3 gegen 4) über den 4/4-Herzschlag legt (12 Takte 4/4 = 16 Walzertakte).

Aufbau (Takte, 0-basiert):
   0– 7  Intro     Herzschlag, Orgel-Orgelpunkt, Streicher-Glissandi, Spieluhr-Motiv setzt ein
   8–23  Thema A   Spieluhr-Wiegenlied (2 x 8 Takte), Orgel, Cluster; ab Takt 16 Tremolo, Chor, Toms
  24–35  B Walzer  Clown-Walzer (Kalliope, verstimmte Orgel, Tuba) gegen den 4/4-Puls, Tritonus-Orgelpunkt
  36–51  C Höhepunkt  Wiegenlied in Violine + Spieluhr, Chor-Cluster, Orgel voll, Walzer im Hintergrund,
                      Schocks (Hits, Crash, Violin-Kreischen)
  52–55  D Rückführung  leise Spieluhr, Dominante F, Tom-Wirbel → Sprung auf Takt 0
Aufruf:  python3 scripts/music/theme_deepsea.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import mido

BPM, BARS = 104, 56                       # 56 × 4 × 60/104 = 129,2 s
song = Song(bpm=BPM, bars=BARS)

song.inst('contra',   'contra',      92, 64)
song.inst('organ',    'pipeorgan',   84, 60)
song.inst('timp',     'timp',        98, 64)
song.inst('glock',    'glock',       92, 58)   # Spieluhr
song.inst('bell',     'bell',        70, 72)   # verstimmte Spieluhr-Schicht
song.inst('gliss',    'slowstr',     80, 40)   # Cluster + Glissandi
song.inst('tremolo',  'tremolo',     70, 88)
song.inst('calliope', 'calliope',    76, 76)   # Clown-Walzer
song.inst('tuba',     'tuba',        86, 50)
song.inst('organ2',   'organ2',      66, 34)   # schiefe Walzer-„Pah“
song.inst('choir',    'oohs',        80, 64)
song.inst('hit',      'hit',        100, 64)
song.inst('violin',   'violin',      86, 82)
song.inst('bassoon',  'bassoon',     80, 46)

NAMES = {'C': C, 'Db': Db, 'C#': Db, 'D': D, 'Eb': Eb, 'D#': Eb, 'E': E, 'F': F, 'Gb': Gb, 'F#': Gb,
         'G': G, 'Ab': Ab, 'G#': Ab, 'A': A, 'Bb': Bb, 'A#': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))

# Skala: b-Moll natürlich + kleine Sekunde (H), Tritonus (E), Leitton (A)
SCALE = {Bb, C, Db, Eb, F, Gb, Ab, B, E, A}
CH = {'Bbm': (Bb, [0, 3, 7]), 'Gb': (Gb, [0, 4, 7]), 'Ebm': (Eb, [0, 3, 7]), 'F': (F, [0, 4, 7]),
      'B': (B, [0, 4, 7]), 'E': (E, [0, 4, 7]), 'Db': (Db, [0, 4, 7])}
def tones(ch, lo):
    root, iv = CH[ch]
    return sorted(lo + ((root + i - lo) % 12) for i in iv)
def rootb(ch): return 36 + CH[ch][0]
def contra_p(ch):
    p = rootb(ch); return p - 12 if p - 12 >= 28 else p
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

# ---- Pitch-Bend (Verstimmung, Glissandi) -------------------------------------------
def bend(name, beat, val):
    ch = song.ch[name][0]
    song.ev.append((int(round(beat * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, val))))))
bend('bell', 0, -1300)                        # ca. -32 Cent: verstimmte Spieluhr
bend('organ2', 0, -1900)                      # ca. -46 Cent: schiefer Jahrmarkt
song.cc('gliss', 0, 101, 0); song.cc('gliss', 0, 100, 0); song.cc('gliss', 0, 6, 12)   # Bend-Range 12 Halbtöne
song.cc('violin', 0, 101, 0); song.cc('violin', 0, 100, 0); song.cc('violin', 0, 6, 12)
SEMI = 8192 / 12
def glide(name, beat, dur, pitch, vel, s0, s1, steps=14):
    """Note mit Glissando von s0 bis s1 Halbtönen (relativ zur Tonhöhe)."""
    for i in range(steps + 1): bend(name, beat + dur * i / steps, (s0 + (s1 - s0) * i / steps) * SEMI)
    song.add(name, beat, dur, pitch, vel)
    bend(name, beat + dur + 0.03, 0)

# ---- Bausteine -----------------------------------------------------------------------
def org(b, ch, vel, lo=48):
    for p in tones(ch, lo): song.add('organ', song.bar(b), 3.98, p, vel)
def pedal(b, ch, vel): song.add('contra', song.bar(b), 3.98, contra_p(ch), vel)
def pedal_pc(b, pc, vel): song.add('contra', song.bar(b), 3.98, 36 + pc - 12 if 36 + pc - 12 >= 28 else 36 + pc, vel)
def heart(b, ch, vel):
    """Herzschlag: Pauken „lub-dub“ auf 1 und 3."""
    s = song.bar(b); p = rootb(ch)
    for off in (0, 2):
        song.add('timp', s + off, 0.4, p, vel); song.add('timp', s + off + 0.75, 0.3, p, vel - 14)
def cluster(b, ch, vel, inst='gliss'):
    r = rootb(ch) + 12
    for p in (r, r + 1, r + 7, r + 8): song.add(inst, song.bar(b), 3.95, p, vel)
def sweep(b, beat, dur, ch, vel, up=True):
    """Streicher-Glissando (gleitender Cluster, Halbtöne)."""
    r = rootb(ch) + 12
    for k, p in enumerate((r, r + 1, r + 6)):
        glide('gliss', song.bar(b) + beat, dur, p, vel, -3 if up else 2, 0 if up else -2)
def tremolo(b, ch, vel):
    for p in tones(ch, 60): song.add('tremolo', song.bar(b), 3.98, p, vel)
def choir(b, ch, vel):
    for p in tones(ch, 60): song.add('choir', song.bar(b), 3.98, p, vel)
    song.add('choir', song.bar(b), 3.98, tones(ch, 60)[0] + 1, vel - 12)      # kleine Sekunde als Reibung
def shock(b, beat, ch, vel=118, screech=True):
    s = song.bar(b) + beat
    r = rootb(ch) + 12
    for p in (r - 12, r, r + 6, r + 7, r + 13): song.add('hit', s, 0.9, p, vel)
    song.dr(s, CRASH, 112, 0.6); song.dr(s, KICK, 120)
    if screech: glide('violin', s, 1.2, r + 24, 100, -2, 0)
def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        for inst, v in zip(insts, vels):
            m = nt(p) + shift
            assert m % 12 in SCALE, (b, p)
            song.add(inst, song.bar(b) + off, dur * 0.94, m, v)

# ---- Schlagzeug --------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'A':                                   # Herzschlag + Toms
        for off in (0, 2): d(off, KICK, 112); d(off + 0.75, KICK, 92)
        d(1, TOM_L, 92); d(3, TOM_M, 88); d(3.5, TOM_L, 76)
        for i in range(8): d(i * 0.5, HAT, 100 if i % 2 == 0 else 82)
    elif kind == 'B':                                 # Toms treiben, Snare-Schlag auf 4
        for off in (0, 2): d(off, KICK, 116); d(off + 0.75, KICK, 96)
        d(1, TOM_L, 100); d(1.5, TOM_L, 84); d(3, SNARE, 108); d(2.5, TOM_M, 90); d(3.5, TOM_H, 88)
        for i in range(8): d(i * 0.5, HAT, 104 if i % 2 == 0 else 86)
    elif kind == 'C':                                 # Höhepunkt
        for off in (0, 2): d(off, KICK, 120); d(off + 0.75, KICK, 100)
        d(1, SNARE, 112); d(3, SNARE, 116); d(1, TOM_L, 96); d(2.5, TOM_M, 100); d(3.5, TOM_H, 100)
        for i in range(8): d(i * 0.5, RIDE, 108 if i % 2 == 0 else 88)
        d(0, CRASH, 90)
def fill(b, big=False):
    s = song.bar(b); toms = [TOM_H, TOM_HH, TOM_M, TOM_L]
    for i in range(8): song.dr(s + 2.0 + i * 0.25, toms[min(3, i // 2)], ramp(i, 8, 84, 118), 0.2)
    if big:
        for i in range(8): song.dr(s + 1.0 + i * 0.125, SNARE, ramp(i, 8, 60, 100), 0.1)
    song.dr(s + 3.75, KICK, 118)
def snare_roll(b, start, end, v0, v1):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)

# ---- Melodien ------------------------------------------------------------------------------
CHORDS_A1 = ['Bbm', 'Bbm', 'Gb', 'Gb', 'Ebm', 'B', 'F', 'F']
MEL_A1 = [
    [(0, 1.5, 'F5'), (1.5, .5, 'Eb5'), (2, 1, 'Db5'), (3, 1, 'Bb4')],
    [(0, 1.5, 'Db5'), (1.5, .5, 'Eb5'), (2, 2, 'F5')],
    [(0, 1.5, 'Gb5'), (1.5, .5, 'F5'), (2, 1, 'Eb5'), (3, 1, 'Db5')],
    [(0, 1, 'Bb4'), (1, 1, 'Db5'), (2, 2, 'Gb5')],
    [(0, 1.5, 'Gb5'), (1.5, .5, 'F5'), (2, 1, 'Eb5'), (3, 1, 'Bb4')],
    [(0, 2, 'E5'), (2, 1, 'Eb5'), (3, 1, 'Gb5')],
    [(0, 1.5, 'A5'), (1.5, .5, 'F5'), (2, 1, 'Db5'), (3, 1, 'A4')],
    [(0, 2, 'C5'), (2, 2, 'A4')],
]
CHORDS_A2 = ['Bbm', 'Db', 'Ebm', 'E', 'Bbm', 'Gb', 'B', 'F']
MEL_A2 = [
    [(0, 1.5, 'F5'), (1.5, .5, 'Gb5'), (2, 1, 'F5'), (3, 1, 'Db5')],
    [(0, 1.5, 'F5'), (1.5, .5, 'Ab5'), (2, 2, 'F5')],
    [(0, 1.5, 'Gb5'), (1.5, .5, 'Bb5'), (2, 2, 'Gb5')],
    [(0, 1.5, 'Ab5'), (1.5, .5, 'B5'), (2, 1, 'Ab5'), (3, 1, 'E5')],
    [(0, 1, 'F5'), (1, 1, 'Db5'), (2, 1, 'Bb4'), (3, 1, 'F4')],
    [(0, 1.5, 'Gb5'), (1.5, .5, 'Eb5'), (2, 2, 'Bb4')],
    [(0, 1.5, 'Gb5'), (1.5, .5, 'E5'), (2, 2, 'Eb5')],
    [(0, 1, 'C5'), (1, 1, 'A4'), (2, 2, 'C5')],
]
# Clown-Walzer: 16 Walzertakte zu je 3 Vierteln (Beat, Dauer, Ton)
WCH = ['Bbm', 'Bbm', 'F', 'Bbm', 'Gb', 'Gb', 'E', 'E', 'Bbm', 'Bbm', 'B', 'B', 'Ebm', 'F', 'B', 'F']
WMEL = [
    [(0, 1, 'F5'), (1, 1, 'Eb5'), (2, 1, 'Db5')], [(0, 2, 'Bb4'), (2, 1, 'Db5')],
    [(0, 1, 'C5'), (1, 1, 'A4'), (2, 1, 'C5')], [(0, 2, 'F5'), (2, 1, 'Db5')],
    [(0, 1, 'Gb5'), (1, 1, 'F5'), (2, 1, 'Eb5')], [(0, 2, 'Db5'), (2, 1, 'Bb4')],
    [(0, 1, 'E5'), (1, 1, 'Ab5'), (2, 1, 'B5')], [(0, 2, 'Ab5'), (2, 1, 'E5')],
    [(0, 1, 'F5'), (1, 1, 'Eb5'), (2, 1, 'Db5')], [(0, 1, 'Db5'), (1, 1, 'F5'), (2, 1, 'Bb5')],
    [(0, 1, 'Gb5'), (1, 1, 'Eb5'), (2, 1, 'B4')], [(0, 2, 'E5'), (2, 1, 'Eb5')],
    [(0, 1, 'Gb5'), (1, 1, 'Bb5'), (2, 1, 'Gb5')], [(0, 1, 'A5'), (1, 1, 'F5'), (2, 1, 'C5')],
    [(0, 1.5, 'Gb5'), (1.5, .5, 'E5'), (2, 1, 'Eb5')], [(0, 2, 'C5'), (2, 1, 'A4')],
]
def waltz(b0, nbars, mel_vel, full=True, first=0):
    """Walzer über nbars 4/4-Takte (nbars*4/3 Walzertakte)."""
    for w in range(nbars * 4 // 3):
        s = song.bar(b0) + 3 * w; ch = WCH[(first + w) % 16]
        if full: song.add('tuba', s, 1.2, contra_p(ch) + 12, 92)
        for off in (1, 2):
            for p in tones(ch, 55): song.add('organ2', s + off, 0.8, p, 70 if full else 52)
        for off, dur, p in WMEL[(first + w) % 16]:
            assert nt(p) % 12 in SCALE
            song.add('calliope', s + off, dur * 0.9, nt(p), mel_vel)
            if full: song.add('bell', s + off, dur * 0.9, nt(p) + 12, 56)

# ==== Arrangement ==========================================================================
# ---- Intro (0–7) ---------------------------------------------------------------------------
CHORDS_I = ['Bbm'] * 4 + ['Bbm', 'Bbm', 'B', 'F']
shock(0, 0, 'Bbm', 96, screech=False)
for b, ch in enumerate(CHORDS_I):
    pedal(b, ch, 84 + b * 2); org(b, ch, 64 + b * 4); heart(b, ch, 90 + b * 3)
    groove(b, 'A', 0.94 + b * 0.02)
    tremolo(b, ch, 46 + b * 5) if b >= 2 else None
    if b in (0, 4): sweep(b, 0.0, 3.9, ch, 70, up=(b == 0))
    if b >= 4: cluster(b, ch, 60)
line(2, MEL_A1[0], ['glock', 'bell'], [74, 56]); line(3, MEL_A1[1], ['glock', 'bell'], [74, 56])
line(4, MEL_A1[0], ['glock', 'bell'], [84, 64]); line(5, MEL_A1[1], ['glock', 'bell'], [84, 64])
line(6, MEL_A1[5], ['glock', 'bell'], [88, 68]); line(7, MEL_A1[6], ['glock', 'bell'], [88, 68])
fill(3); fill(7, big=True)

# ---- Thema A (8–23) -----------------------------------------------------------------------
for i in range(16):
    b, k, sec = 8 + i, i % 8, i // 8
    ch = (CHORDS_A1 if sec == 0 else CHORDS_A2)[k]
    mel = (MEL_A1 if sec == 0 else MEL_A2)[k]
    pedal(b, ch, 90); org(b, ch, 74 + 4 * sec); heart(b, ch, 96)
    groove(b, 'A' if sec == 0 else 'B', 1.0)
    line(b, mel, ['glock', 'bell'], [92, 70])
    cluster(b, ch, 58 + 8 * sec)
    if sec == 1:
        tremolo(b, ch, 60 + k * 3)
        if k >= 4: choir(b, ch, 50 + (k - 4) * 8)
    if k == 3 and sec == 0: sweep(b, 0.0, 3.9, ch, 66, up=False)
    if k == 7: sweep(b, 0.0, 3.9, ch, 70, up=True)
shock(14, 3.5, 'F', 108, screech=False)
fill(15); shock(22, 3, 'F', 112); fill(23, big=True)
snare_roll(23, 0, 2, 50, 80)

# ---- B Clown-Walzer (24–35) ------------------------------------------------------------------
for b in range(24, 36):
    pcs = E if 28 <= b <= 30 else Bb
    pedal_pc(b, pcs, 92)
    heart(b, 'Bbm', 94)
    groove(b, 'A' if b < 32 else 'B', 1.0)
    if b >= 32: tremolo(b, 'Bbm', 56 + (b - 32) * 8)
waltz(24, 12, 90)
crash = lambda b, v: song.dr(song.bar(b), CRASH, v, 0.5)
crash(24, 108)
for b in (27, 30): song.add('bassoon', song.bar(b), 3.9, nt('Bb2') if b == 27 else nt('E2'), 84)
sweep(30, 0.0, 3.9, 'E', 74, up=True)
fill(29)
snare_roll(34, 0, 4, 60, 100); snare_roll(35, 0, 3, 90, 126); fill(35, big=True)

# ---- C Höhepunkt (36–51) -----------------------------------------------------------------------
crash(36, 118); shock(36, 0, 'Bbm', 122)
for i in range(16):
    b, k, sec = 36 + i, i % 8, i // 8
    ch = (CHORDS_A1 if sec == 0 else CHORDS_A2)[k]
    if sec == 1 and k in (1, 2, 5): ch = (['Bbm', 'B', 'E', 'Gb', 'Ebm', 'Gb', 'B', 'F'])[k] if False else ch
    mel = (MEL_A1 if sec == 0 else MEL_A2)[k]
    pedal(b, ch, 96); org(b, ch, 86); heart(b, ch, 104)
    groove(b, 'C', 1.0 + 0.04 * sec)
    line(b, mel, ['violin', 'glock', 'bell'], [96, 84, 66])
    line(b, mel, ['choir'], [58], shift=-12) if k % 2 == 0 else None
    tremolo(b, ch, 74); choir(b, ch, 74 + 6 * sec); cluster(b, ch, 68)
    if k in (3, 7): song.add('bassoon', song.bar(b), 3.9, contra_p(ch) + 12, 88)
waltz(36, 12, 62, full=False, first=0)
shock(43, 2, 'E', 116); shock(51, 3, 'F', 120)
fill(39); fill(47); fill(43); crash(44, 106)
snare_roll(50, 0, 4, 70, 106); snare_roll(51, 0, 3, 96, 127); fill(51, big=True)

# ---- D Rückführung (52–55) ---------------------------------------------------------------------
CHORDS_D = ['Bbm', 'Gb', 'B', 'F']
for i, ch in enumerate(CHORDS_D):
    b = 52 + i
    pedal(b, ch, 88); org(b, ch, 74 - i * 2); heart(b, ch, 94)
    groove(b, 'B', 0.98)
    tremolo(b, ch, 58 + i * 6); cluster(b, ch, 60 + i * 4)
    line(b, MEL_A1[[0, 2, 5, 6][i]], ['glock', 'bell'], [82, 62])
    if i >= 2: choir(b, ch, 50 + i * 6)
crash(52, 104); sweep(55, 0.0, 3.9, 'F', 76, up=True)
snare_roll(55, 0, 3.5, 60, 118); fill(55, big=True)

sf2, out = cli_paths('bgm_theme_deepsea.ogg')
song.render(sf2, out)
