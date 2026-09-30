# -*- coding: utf-8 -*-
"""Theme „The Archer's Journey“ (Archetyp Arrows) → public/music/bgm_theme_arrows.ogg

Heldenreise in G-Mixolydisch (später Dur), 132 BPM, 60 Takte (109,1 s), nahtlos loopbar.
Eine einsame Flöte ruft zum Aufbruch, ein Horn antwortet; darunter läuft von Anfang an der
Reiter-Galopp (Achtel + zwei Sechzehntel je Schlag: Streicher, Pauken, Bass) – wie Pferdehufe.
Das Hauptmotiv (Quintsprung D–G, dann absteigend) trägt alle Abschnitte: als Ruf (Intro), als
Abenteuer-Thema (Horn, dann Flöte/Violine), als düstere Moll-Fassung in der Prüfung und als
Hymne im Triumph. Pfeil-Klänge: Harfen-Arpeggien (Bogensehne), Sidestick/Toms.

Aufbau (Takte, 0-basiert):
   0– 7  Aufbruch      Flöte solo-Ruf, Horn-Antwort, Galopp leise, Harfe, sanfter Puls
   8–23  Thema A       Horn trägt das Thema (Galopp-Streicher, Pauken), 2. Durchgang Flöte+Violine,
                       Horn-Gegenstimme, Chor-Andeutung
  24–39  Prüfung B     e-Moll (Es-Aeolisch): Oboe/Trompete, Posaune, Tremolo, harte Toms, 2. Durchgang
                       mit Blech und Chor; endet auf der Dominante D
  40–55  Triumph C     G-Dur-Hymne: Trompete+Flöte+Violine, Chor, Horn-Stöße, volles Schlagzeug
  56–63→ Rückkehr D    4 Takte: Flöte erinnert sich, Galopp beruhigt sich, Pauken-Wirbel → Sprung zum Anfang
Harmonie: G F C G Em F Dm G | Em C Am D | G F C G Em F C D | ... Der Loop endet auf der Dominante
(Leitton Fis führt zurück zum G der Flöte) – keine Schlusskadenz.
Aufruf:  python3 scripts/music/theme_arrows.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 132, 60                       # 60 × 4 × 60/132 = 109,1 s
song = Song(bpm=BPM, bars=BARS)
song.inst('bass',    'acbass',  100, 60)
song.inst('timp',    'timp',     96, 64)
song.inst('gallop',  'strings',  78, 44)  # Reiter-Galopp
song.inst('pizz',    'pizz',     80, 84)
song.inst('harp',    'harp',     86, 30)
song.inst('flute',   'flute',    88, 74)
song.inst('oboe',    'oboe',     84, 58)
song.inst('violin',  'violin',   82, 80)
song.inst('horns',   'horns',    90, 38)
song.inst('trumpet', 'trumpet',  88, 68)
song.inst('brass',   'brass',    78, 52)
song.inst('trombone','trombone', 88, 78)
song.inst('tremolo', 'tremolo',  72, 88)
song.inst('choir',   'choir',    84, 64)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s):                                   # 'Gb5' → MIDI, 'C#5' wird als 'Gb5' etc. geschrieben
    return n(NAMES[s[:-1]], int(s[-1]))
# Akkorde: Grundton-Tonklasse, Terz
CH = {'G': (G, 4), 'F': (F, 4), 'C': (C, 4), 'D': (D, 4), 'Dm': (D, 3), 'Em': (E, 3), 'Am': (A, 3), 'Bm': (B, 3)}
def tones(ch, base):                         # Dreiklang ab base (Grundton in base..base+11)
    pc, t = CH[ch]; r = base + ((pc - base) % 12); return [r, r + t, r + 7]
def bass_root(ch): return 28 + ((CH[ch][0] - 28) % 12)
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

# Skalen zur Kontrolle (Tonklassen)
MIXO = {G, A, B, C, D, E, F}                 # G-Mixolydisch
MINOR = {E, Gb, G, A, B, C, D}               # e-Moll (= G-Dur)
HYMN = MIXO | {Gb}                           # Triumph: Dur + b7
def check(notes, scale, where):
    for off, dur, p in notes:
        assert nt(p) % 12 in scale, f'{where}: {p} nicht in Skala'

# ---- Bausteine -------------------------------------------------------------------------------
def gallop(b, ch, vel, inst='gallop', base=48):
    r, t, f = tones(ch, base)
    for k in range(4):
        s = song.bar(b) + k
        song.add(inst, s, 0.46, r, vel + 8); song.add(inst, s + 0.5, 0.23, f, vel - 4); song.add(inst, s + 0.75, 0.23, t if k % 2 else r + 12, vel - 4)
def harp(b, ch, vel, base=55):
    r, t, f = tones(ch, base); seq = [r, t, f, r + 12, f, t, r + 12, f]
    for i, p in enumerate(seq): song.add('harp', song.bar(b) + i * 0.5, 0.9, p, vel + (8 if i % 4 == 0 else 0))
def bass(b, ch, vel, style='q'):
    r = bass_root(ch); s = song.bar(b)
    if style == 'q':
        for off, p, v in ((0, r, 6), (1, r, -8), (2, r + 7, 0), (3, r, -8)): song.add('bass', s + off, 0.9, p, vel + v)
    else:                                    # Achtel-Drive
        for i in range(8): song.add('bass', s + i * 0.5, 0.45, r if i % 4 != 3 else r + 12, vel + (6 if i % 4 == 0 else -6))
def timp(b, ch, vel, kind='gallop'):
    p = 36 + CH[ch][0]; s = song.bar(b)
    if kind == 'q':
        for off in (0, 2): song.add('timp', s + off, 0.5, p, vel)
    elif kind == 'gallop':
        for off, v in ((0, 0), (1, -8), (1.5, -14), (2, -2), (3, -8), (3.5, -14)): song.add('timp', s + off, 0.4, p, vel + v)
    else:
        for i in range(16): song.add('timp', s + i * 0.25, 0.25, p, ramp(i, 16, vel - 30, vel))
def pad(inst, b, ch, vel, base=55, dur=3.95):
    for p in tones(ch, base): song.add(inst, song.bar(b), dur, p, vel)
def horn_counter(b, ch, vel):
    tr, th, f = tones(ch, 55)
    song.add('horns', song.bar(b), 1.95, th, vel); song.add('horns', song.bar(b) + 2, 1.95, f, vel)
def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        for inst, v in zip(insts, vels):
            sh = shift[inst] if isinstance(shift, dict) else shift
            song.add(inst, song.bar(b) + off, dur * 0.94, nt(p) + sh, v)
def crash(b, vel=110): song.dr(song.bar(b), CRASH, vel, 0.5)
def tomfill(b, vel0=84):
    for i, tm in enumerate([TOM_H, TOM_HH, TOM_M, TOM_M, TOM_L, TOM_L]):
        song.dr(song.bar(b) + 2.0 + i * 0.33, tm, ramp(i, 6, vel0, 116), 0.2)
    song.dr(song.bar(b) + 3.9, KICK, 116)
def snare_roll(b, start, end, v0, v1):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'soft':
        for off, vel in ((0, 88), (2, 80)): d(off, KICK, vel)
        d(1, SIDESTICK, 88); d(3, SIDESTICK, 92)
        for i in range(8): d(i * 0.5, HAT, 106 if i % 2 == 0 else 90)
    elif kind == 'A':
        for off, vel in ((0, 108), (2, 98), (2.75, 84)): d(off, KICK, vel)
        d(1, SNARE, 100); d(3, SNARE, 104); d(1.5, SIDESTICK, 80)
        for i in range(8): d(i * 0.5, HAT, 108 if i % 2 == 0 else 92)
    elif kind == 'B':                        # Prüfung: hart, Toms auf den Zählzeiten
        for off, vel in ((0, 116), (1, 100), (2, 110), (3, 100)): d(off, KICK, vel)
        d(1, SNARE, 110); d(3, SNARE, 114); d(1, CLAP, 84); d(3, CLAP, 88)
        d(0.5, TOM_L, 84); d(2.5, TOM_M, 92); d(3.5, TOM_L, 94)
        for i in range(8): d(i * 0.5, HAT, 100 if i % 2 == 0 else 84)
    elif kind == 'C':
        for off, vel in ((0, 118), (1.5, 98), (2, 108), (3.5, 100)): d(off, KICK, vel)
        d(1, SNARE, 112); d(3, SNARE, 116); d(1, CLAP, 82); d(3, CLAP, 86)
        for i in range(8): d(i * 0.5, RIDE, 108 if i % 2 == 0 else 92)
        d(2.5, TOM_M, 88); d(3.75, TOM_L, 92)

# ---- Melodien --------------------------------------------------------------------------------
CH_A = ['G', 'F', 'C', 'G', 'Em', 'F', 'Dm', 'G']
INTRO = [
    [(0, 2, 'D5'), (2, 2, 'G5')], [(0, 2, 'C5'), (2, 2, 'F5')],
    [(0, 2, 'E5'), (2, 1.5, 'G5'), (3.5, 0.5, 'A5')], [(0, 4, 'G5')],
    [(0, 2, 'B4'), (2, 2, 'E5')], [(0, 2, 'A4'), (2, 2, 'C5')],
    [(0, 2, 'F5'), (2, 2, 'A5')], [(0, 3, 'D5'), (3, 1, 'D5')]]
MEL_A = [
    [(0, 1, 'D5'), (1, 1.5, 'G5'), (2.5, 0.5, 'F5'), (3, 1, 'D5')],
    [(0, 1, 'C5'), (1, 1.5, 'F5'), (2.5, 0.5, 'E5'), (3, 1, 'C5')],
    [(0, 1, 'E5'), (1, 1.5, 'G5'), (2.5, 0.5, 'A5'), (3, 1, 'G5')],
    [(0, 2, 'A5'), (2, 1, 'G5'), (3, 1, 'D5')],
    [(0, 1, 'B4'), (1, 1, 'E5'), (2, 1.5, 'G5'), (3.5, 0.5, 'D5')],
    [(0, 1, 'A4'), (1, 1, 'C5'), (2, 1.5, 'F5'), (3.5, 0.5, 'E5')],
    [(0, 1, 'D5'), (1, 1, 'F5'), (2, 1, 'A5'), (3, 1, 'F5')],
    [(0, 1.5, 'D5'), (1.5, 0.5, 'E5'), (2, 1, 'D5'), (3, 1, 'B4')]]
CH_B = ['Em', 'C', 'Am', 'D', 'Em', 'C', 'D', 'Bm']
CH_B2 = ['Em', 'C', 'Am', 'D', 'Em', 'C', 'D', 'D']
MEL_B = [
    [(0, 1, 'E5'), (1, .5, 'E5'), (1.5, .5, 'G5'), (2, 1.5, 'B5'), (3.5, .5, 'A5')],
    [(0, 1, 'G5'), (1, .5, 'G5'), (1.5, .5, 'E5'), (2, 2, 'C5')],
    [(0, 1, 'A4'), (1, .5, 'A4'), (1.5, .5, 'C5'), (2, 1.5, 'E5'), (3.5, .5, 'D5')],
    [(0, 1, 'Gb5'), (1, 1, 'A5'), (2, 2, 'Gb5')],
    [(0, 1, 'E5'), (1, .5, 'E5'), (1.5, .5, 'G5'), (2, 1.5, 'B5'), (3.5, .5, 'A5')],
    [(0, 1, 'G5'), (1, .5, 'E5'), (1.5, .5, 'G5'), (2, 2, 'E5')],
    [(0, 1, 'A5'), (1, 1, 'Gb5'), (2, 1, 'D5'), (3, 1, 'A4')],
    [(0, 2, 'B4'), (2, 1, 'D5'), (3, 1, 'Gb5')]]
CH_C1 = ['G', 'F', 'C', 'G', 'Em', 'F', 'C', 'D']
MEL_C1 = [
    [(0, 1, 'G4'), (1, 1, 'D5'), (2, 2, 'G5')],
    [(0, 1, 'A4'), (1, 1, 'C5'), (2, 2, 'F5')],
    [(0, 1, 'C5'), (1, 1, 'E5'), (2, 1.5, 'G5'), (3.5, .5, 'A5')],
    [(0, 3, 'B5'), (3, 1, 'A5')],
    [(0, 1.5, 'G5'), (1.5, .5, 'Gb5'), (2, 2, 'E5')],
    [(0, 1.5, 'A5'), (1.5, .5, 'G5'), (2, 1, 'F5'), (3, 1, 'C5')],
    [(0, 1, 'E5'), (1, 1, 'G5'), (2, 2, 'C6')],
    [(0, 1, 'A5'), (1, 1, 'Gb5'), (2, 1, 'D5'), (3, 1, 'A4')]]
CH_C2 = ['G', 'D', 'Em', 'C', 'Am', 'C', 'D', 'D']
MEL_C2 = [
    [(0, .5, 'D5'), (.5, .5, 'G5'), (1, 1, 'B5'), (2, 1.5, 'G5'), (3.5, .5, 'D5')],
    [(0, 1, 'A5'), (1, 1, 'Gb5'), (2, 2, 'D5')],
    [(0, .5, 'E5'), (.5, .5, 'G5'), (1, 1, 'B5'), (2, 2, 'G5')],
    [(0, 1, 'E5'), (1, 1, 'G5'), (2, 2, 'C6')],
    [(0, 1, 'A5'), (1, 1, 'C6'), (2, 1.5, 'B5'), (3.5, .5, 'A5')],
    [(0, 1, 'G5'), (1, 1, 'E5'), (2, 2, 'G5')],
    [(0, 1, 'A5'), (1, 1, 'Gb5'), (2, 1, 'A5'), (3, 1, 'D6')],
    [(0, 2, 'A5'), (2, 2, 'D5')]]
CH_D = ['C', 'F', 'D', 'D']
MEL_D = [[(0, 2, 'E5'), (2, 2, 'G5')], [(0, 2, 'C5'), (2, 2, 'A5')], [(0, 2, 'A5'), (2, 2, 'Gb5')], [(0, 4, 'A4')]]
for m, sc, w in ((INTRO, MIXO, 'Intro'), (MEL_A, MIXO, 'A'), (MEL_B, MINOR, 'B'), (MEL_C1, HYMN, 'C1'), (MEL_C2, HYMN, 'C2'), (MEL_D, HYMN, 'D')):
    for bar in m: check(bar, sc, w)

# ==== Arrangement ===========================================================================
# ---- Aufbruch (0–7) ---------------------------------------------------------------------------
for i in range(8):
    b, ch = i, CH_A[i]; v = i / 7
    line(b, INTRO[i], ['flute'], [82 + int(8 * v)])
    bass(b, ch, 84 + int(8 * v), 'q')
    gallop(b, ch, 60 + int(10 * v), 'gallop', 48)
    timp(b, ch, 80 + int(8 * v), 'q')
    harp(b, ch, 72 + int(8 * v))
    groove(b, 'soft', 1.0 + 0.08 * v)
    if i >= 4: horn_counter(b, ch, 74 + 3 * (i - 4))
    if i >= 4: song.add('pizz', song.bar(b) + 1.5, 0.3, tones(ch, 60)[2], 84)
song.dr(0, CRASH, 100, 0.5); tomfill(6, 80); snare_roll(7, 1.5, 4, 70, 112); tomfill(7, 96)

# ---- Thema A (8–23) ---------------------------------------------------------------------------
crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; second = i >= 8
    bass(b, ch, 96 + (4 if second else 0), 'q')
    timp(b, ch, 94 + (4 if second else 0), 'gallop')
    gallop(b, ch, 68 + (8 if second else 0))
    harp(b, ch, 74)
    groove(b, 'A', 1.0 + (0.05 if second else 0))
    if not second:
        line(b, MEL_A[k], ['horns', 'flute'], [92, 66], {'horns': -12, 'flute': 0})
    else:
        line(b, MEL_A[k], ['flute', 'violin', 'horns'], [88, 80, 66], {'flute': 0, 'violin': 0, 'horns': -12})
        horn_counter(b, ch, 74)
        if k >= 4: pad('choir', b, ch, 52 + (k - 4) * 6, 55)
        song.add('pizz', song.bar(b) + 1.5, 0.3, tones(ch, 60)[2], 88)
tomfill(15, 88); crash(16, 104); snare_roll(22, 2, 4, 60, 100); snare_roll(23, 0, 3.5, 80, 124); tomfill(23, 100)

# ---- Prüfung B (24–39) ------------------------------------------------------------------------
crash(24, 116); crash(32, 116)
for i in range(16):
    b, k = 24 + i, i % 8; second = i >= 8
    ch = (CH_B2 if second else CH_B)[k]
    bass(b, ch, 100 + (4 if second else 0), 'e')
    timp(b, ch, 100, 'gallop')
    gallop(b, ch, 74 + (6 if second else 0), 'gallop', 48)
    pad('tremolo', b, ch, 58 + (10 if second else 0), 60)
    groove(b, 'B', 1.0 + (0.05 if second else 0))
    r = 36 + CH[ch][0]
    for off, d_ in ((0, 0.5), (0.5, 0.25), (0.75, 0.25), (1, 1.0)): song.add('trombone', song.bar(b) + off, d_ * 0.9, r + 12, 88 + (6 if second else 0))
    if not second:
        line(b, MEL_B[k], ['oboe', 'violin'], [90, 62], 0)
    else:
        line(b, MEL_B[k], ['trumpet', 'oboe', 'brass'], [96, 76, 78], {'trumpet': 0, 'oboe': 0, 'brass': -12})
        pad('choir', b, ch, 70, 55)
        song.add('pizz', song.bar(b) + 2.5, 0.3, tones(ch, 60)[1], 92)
tomfill(31, 90); tomfill(35, 96)
snare_roll(38, 0, 4, 60, 104); snare_roll(39, 0, 3.5, 90, 127); tomfill(39, 106)

# ---- Triumph C (40–55) ------------------------------------------------------------------------
crash(40, 122); crash(48, 120)
for i in range(16):
    b, k = 40 + i, i % 8; second = i >= 8
    ch = (CH_C2 if second else CH_C1)[k]; mel = (MEL_C2 if second else MEL_C1)[k]
    bass(b, ch, 104, 'e' if second else 'q')
    timp(b, ch, 104, 'gallop')
    gallop(b, ch, 84, 'gallop', 48)
    harp(b, ch, 78, 60)
    pad('choir', b, ch, 88 + (4 if second else 0), 55)
    groove(b, 'C', 1.0 + (0.04 if second else 0))
    line(b, mel, ['trumpet', 'flute', 'violin', 'brass'], [98, 84, 84, 80], {'trumpet': 0, 'flute': 0, 'violin': 0, 'brass': -12})
    tr, th, f = tones(ch, 55)
    for off in (0, 1.5, 3): song.add('horns', song.bar(b) + off, 0.8, f, 78 + (8 if off == 0 else 0))
    if k % 4 == 0 and b not in (40, 48): crash(b, 100)
tomfill(43, 92); tomfill(47, 96); tomfill(51, 96)
snare_roll(54, 0, 4, 70, 110); snare_roll(55, 0, 3.5, 100, 127); tomfill(55, 108)

# ---- Rückkehr D (56–59) -----------------------------------------------------------------------
crash(56, 96)
for i in range(4):
    b, ch = 56 + i, CH_D[i]
    bass(b, ch, 90, 'q'); gallop(b, ch, 70 - i * 2); harp(b, ch, 78)
    timp(b, ch, 88, 'q' if i < 3 else 'roll')
    groove(b, 'soft', 1.05)
    line(b, MEL_D[i], ['flute', 'horns'], [86, 60], {'flute': 0, 'horns': -12})
    pad('tremolo', b, ch, 54 + 4 * i, 60)
snare_roll(59, 1, 4, 50, 100); tomfill(59, 90)

sf2, out = cli_paths('bgm_theme_arrows.ogg')
song.render(sf2, out)
