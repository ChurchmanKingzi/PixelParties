# -*- coding: utf-8 -*-
"""Theme „Descent Through Nine Circles“ (Hell Circles) → public/music/bgm_theme_hellcircles.ogg

Dantes Abstieg in f-Moll, 112 BPM, 56 Takte (120,0 s), nahtlos loopbar.
Das Hauptthema ist der Lamento-Bass f–e–es–d–des–c–b–(c) mit der chromatisch fallenden
Melodie f''–e''–es''–d''–des''–c''–b'–g' darüber (Pfeifenorgel, später Blech). Der
Neun-Töne-Abstieg f–e–es–d–des–c–h–b–a (neun Kreise) erklingt als Glocken-/Kristallkaskade.
Chor, Kirchenglocken (Röhrenglocken), Pauken und Streicher-Glissandi („Schreie“) tragen die
Stimmung; jeder Abschnitt liegt tiefer und finsterer als der vorige.

Aufbau (Takte, 0-basiert):
   0– 3  Intro         Glockenschläge, Herzschlag-Pauke, Orgelakkord, Posaunen-Vorahnung
   4–11  Kreis I–II    Limbo/Wollust: Orgel-Thema, Chor, Marsch-Groove
  12–19  Kreis III–IV  Völlerei/Geiz: Blech-Thema, Tremolo, erste Schreie, Gegenstimme
  20–27  Kreis V–VI    Zorn/Ketzerei: Posaune/Tuba tief, schwere Toms, Chorschläge
  28–35  Kreis VII     Gewalt: Streicher-16tel-Feuer, Galopp-Pauke, Schreie
  36–43  Kreis VIII    Betrug: Thema als Kanon (Orgel, Blech versetzt), Unruhe
  44–51  Kreis IX      Cocytus (Eis): alles, Kristall-Kaskaden, tiefster Bass, Höhepunkt
  52–55  Rückführung   Aufstieg über b-Moll–Des–C–C7, Wirbel → Sprung auf Takt 0 (f-Moll)

Harmonie: 8-taktiges Lamento über f-Moll: Fm | C/E | Fm7/Es | Ddim | Des | C | Bbm | C7.
Der Loop endet auf der Dominante C7 (Halbschluss), keine Schlusskadenz.
Melodietöne: f-Moll (harmonisch/natürlich) plus die chromatische Linie (d als Durchgang).
Aufruf:  python3 scripts/music/theme_hellcircles.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import mido

BPM, BARS = 112, 56                       # 56 × 4 × 60/112 = 120,0 s
song = Song(bpm=BPM, bars=BARS)

# ---- Stimmen -------------------------------------------------------------------------------
song.inst('contra',  'contra',   84, 64)
song.inst('bass',    'bass2',    94, 60)
song.inst('timp',    'timp',     98, 64)
song.inst('pipe',    'pipeorgan', 86, 62)
song.inst('choir',   'choir',    82, 64)
song.inst('strings', 'strings',  76, 42)
song.inst('tremolo', 'tremolo',  70, 88)
song.inst('bell',    'bell',     88, 72)
song.inst('trombone','trombone', 88, 78)
song.inst('brass',   'brass',    84, 52)
song.inst('tuba',    'tuba',     90, 50)
song.inst('shriek',  'violin',   84, 30)
song.inst('crystal', 'crystal',  74, 92)
song.inst('hit',     'hit',      98, 64)

# Pitch-Bend-Bereich der Schrei-Stimme auf ±12 Halbtöne (RPN 0)
song.cc('shriek', 0, 101, 0); song.cc('shriek', 0, 100, 0); song.cc('shriek', 0, 6, 12); song.cc('shriek', 0, 38, 0)

# ---- Harmonie: Lamento (Bass-Tonklasse, Akkordtöne) ----------------------------------------
CH8 = [(F, [F, Ab, C]), (E, [C, E, G]), (Eb, [F, Ab, C, Eb]), (D, [D, F, Ab]),
       (Db, [Db, F, Ab]), (C, [C, E, G]), (Bb, [Bb, Db, F]), (C, [C, E, G, Bb])]
SCALE = {F, G, Ab, Bb, C, Db, E, Eb, D}      # f-Moll + Leitton e + chromatischer Durchgang d
def bp(pc): return 36 + pc                                     # Bass Oktave 2
def cp(pc): return 24 + pc if 24 + pc >= 28 else 36 + pc       # Kontrabass Oktave 1–2
def pad(pcs, base=48): return sorted(base + pc for pc in pcs)
LINEP = [77, 76, 75, 74, 73, 72, 70, 67]                       # f'' e'' es'' d'' des'' c'' b' g'

def theme(k):
    """Ein Takt der Abstiegsmelodie (Punktierung, Vorwegnahme des nächsten Tons)."""
    if k == 7: return [(0, 1, 67), (1, 1, 70), (2, 1, 72), (3, 1, 76)]
    return [(0, 1.5, LINEP[k]), (1.5, 0.5, LINEP[k]), (2, 1.5, LINEP[k]), (3.5, 0.5, LINEP[k + 1])]

def put(inst, b, notes, vel, tr=0):
    for off, dur, p in notes:
        assert p % 12 in SCALE, (inst, b, p)
        song.add(inst, song.bar(b) + off, dur * 0.95, p + tr, vel)

def chord(inst, b, pcs, vel, base=48, dur=3.95, beat=0):
    for p in pad(pcs, base): song.add(inst, song.bar(b) + beat, dur, p, vel)

def shriek(b, beat, pitch, dur, s0, s1, vel=96):
    """Streicher-Schrei: Ton mit Pitch-Bend-Gleitweg von s0 nach s1 Halbtönen."""
    ch = song.ch['shriek'][0]; t0 = int(round((song.bar(b) + beat) * TPB)); t1 = int(round((song.bar(b) + beat + dur) * TPB))
    def bend(t, semi):
        v = int(max(-8192, min(8191, semi / 12 * 8192)))
        song.ev.append((t, 0, mido.Message('pitchwheel', channel=ch, pitch=v)))
    bend(t0, s0)
    song.add('shriek', song.bar(b) + beat, dur, pitch, vel)
    steps = max(2, int(dur * 8))
    for i in range(1, steps + 1): bend(t0 + (t1 - t0) * i // steps, s0 + (s1 - s0) * i / steps)
    bend(t1 + TPB // 2, 0)

def nine(b, beat=0, inst='crystal', vel=88, top=89, step=0.25):
    """Neun-Töne-Abstieg (neun Kreise): neun Halbtonschritte abwärts."""
    for i in range(9): song.add(inst, song.bar(b) + beat + i * step, step * 1.6, top - i, vel + (6 if i == 0 else 0))

# ---- Schlagzeug -----------------------------------------------------------------------------
TOMS = [TOM_H, TOM_HH, TOM_M, TOM_L]
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'march':
        for off, vel in ((0, 112), (2, 104)): d(off, KICK, vel)
        d(1, SNARE, 100); d(3, SNARE, 104); d(2.5, TOM_L, 92)
        for i in range(8): d(i * 0.5, HAT, 108 if i % 2 == 0 else 84)
    elif kind == 'heavy':
        for off, vel in ((0, 118), (1.5, 96), (2, 110), (3.5, 100)): d(off, KICK, vel)
        d(1, SNARE, 110); d(3, SNARE, 112); d(1, CLAP, 90); d(3, CLAP, 94)
        d(2.5, TOM_M, 96); d(3.75, TOM_L, 98)
        for i in range(8): d(i * 0.5, HAT, 110 if i % 2 == 0 else 88)
    elif kind == 'fire':
        for off, vel in ((0, 118), (0.75, 92), (2, 110), (2.75, 96)): d(off, KICK, vel)
        d(1, SNARE, 112); d(3, SNARE, 114); d(1.75, SNARE, 74); d(3.75, SNARE, 80)
        d(2.5, TOM_H, 90); d(3.5, TOM_M, 96)
        for i in range(8): d(i * 0.5, HAT, 112 if i % 2 == 0 else 90)
    elif kind == 'ice':
        for off in (0, 1, 2, 3): d(off, KICK, 116 if off % 2 == 0 else 102)
        d(1, SNARE, 116); d(3, SNARE, 118); d(1, CLAP, 92); d(3, CLAP, 96)
        for off in (0.5, 1.5, 2.5, 3.5): d(off, COWBELL, 78)
        d(3.25, TOM_L, 96); d(3.75, TOM_M, 98)

def fill(b, big=False):
    s = song.bar(b)
    if big:
        for i in range(8): song.dr(s + 1.5 + i * 0.25, SNARE, 70 + i * 6, 0.12)
    for i in range(8): song.dr(s + (2.5 if big else 2.0) + i * (0.1875 if big else 0.25), TOMS[min(3, i // 2)], 90 + i * 3, 0.2)
    song.dr(s + 3.75, KICK, 118)

def snare_roll(b, start, end, v0, v1):
    cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(song.bar(b) + start + i * 0.25, SNARE, v0 + (v1 - v0) * i / max(1, cnt - 1), 0.15)

def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)
def hit(b, pcs, vel=110):
    for p in pad(pcs, 36) + pad(pcs, 60): song.add('hit', song.bar(b), 0.9, p, vel)

# ---- Wiederverwendbare Begleitbausteine ------------------------------------------------------
def bass_dirge(b, k, m=1.0):
    p = bp(CH8[k][0]); s = song.bar(b)
    for off, dur, v in ((0, 1.4, 104), (1.5, 0.45, 82), (2, 1.4, 96), (3.5, 0.45, 84)): song.add('bass', s + off, dur, p, v * m)
def pedal(b, k, vel): song.add('contra', song.bar(b), 3.98, cp(CH8[k][0]), vel)
def timp(b, k, kind='q', vel=98):
    s = song.bar(b); p = bp(CH8[k][0])
    if kind == 'q':
        for off in (0, 2): song.add('timp', s + off, 0.5, p, vel)
    elif kind == 'heart':
        for off, dv in ((0, 0), (0.75, -14), (2, -4), (2.75, -14)): song.add('timp', s + off, 0.4, p, vel + dv)
    elif kind == 'gallop':
        for off, dv in ((0, 0), (1, -6), (1.5, -12), (2, -2), (3, -6), (3.5, -12)): song.add('timp', s + off, 0.4, p, vel + dv)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * 0.25, 0.25, p, vel + i * 1.5)
def tolls(b, k, vel=92):
    """Röhrenglocke: Grundton und Tritonus-Gegenschlag."""
    pc = CH8[k][0]; s = song.bar(b)
    song.add('bell', s, 3.9, 60 + pc, vel); song.add('bell', s + 2, 1.9, 60 + pc + 6 if k in (0, 2, 4) else 72 + pc, vel - 14)
def arp(b, k, vel, inst='strings'):
    pcs = CH8[k][1]; seq = sorted([60 + pc for pc in pcs] + [72 + pc for pc in pcs])
    for i in range(8): song.add(inst, song.bar(b) + i * 0.5, 0.45, seq[i % len(seq)], vel + (8 if i % 4 == 0 else 0))
def fire(b, k, vel):
    pcs = CH8[k][1]; seq = [48 + pc for pc in pcs]
    cyc = [seq[0], seq[1], seq[2], seq[1]]
    for i in range(16): song.add('strings', song.bar(b) + i * 0.25, 0.22, cyc[i % 4], vel + (10 if i % 4 == 0 else 0))
def stabs(b, k, vel):
    for off in (0, 1.5, 3): chord('pipe', b, CH8[k][1], vel + (8 if off == 0 else 0), 48, 0.8, off)
def trem(b, k, vel): chord('tremolo', b, CH8[k][1], vel, 60)

# ==== Arrangement ============================================================================
# ---- Intro (0–3): Fm Fm Db C ---------------------------------------------------------------
CH_I = [0, 0, 4, 5]
hit(0, [F, Ab, C], 116); crash(0, 108)
for i, k in enumerate(CH_I):
    b = i; m = 0.86 + i * 0.04
    tolls(b, k, 96)
    pedal(b, k, 82)
    bass_dirge(b, k, 0.9)
    timp(b, k, 'heart', 96)
    chord('pipe', b, CH8[k][1], 72 + i * 4, 48)
    trem(b, k, 56 + i * 6)
    groove(b, 'march', 0.94)
    if i >= 2: chord('choir', b, CH8[k][1], 60 + (i - 2) * 10, 60)
put('trombone', 2, [(0, 1.5, 65), (1.5, 0.5, 65), (2, 1.5, 65), (3.5, 0.5, 64)], 84)
put('trombone', 3, [(0, 1, 63), (1, 1, 65), (2, 1, 68), (3, 1, 72)], 88)
snare_roll(3, 2, 4, 60, 100); fill(3)

# ---- Kreis I–II (4–11): Orgel-Thema ---------------------------------------------------------
crash(4, 108); hit(4, [F, Ab, C], 104)
for i in range(8):
    b = 4 + i; k = i
    tolls(b, k, 84)
    pedal(b, k, 84); bass_dirge(b, k)
    timp(b, k, 'q', 96)
    groove(b, 'march', 1.0)
    put('pipe', b, theme(k), 90)
    put('pipe', b, theme(k), 60, -12)
    chord('choir', b, CH8[k][1], 68, 60)
    chord('strings', b, CH8[k][1], 56, 48)
fill(7); snare_roll(10, 2, 4, 60, 96); fill(11)

# ---- Kreis III–IV (12–19): Blech, Tremolo, erste Schreie --------------------------------------
crash(12, 112); hit(12, [F, Ab, C], 108)
for i in range(8):
    b = 12 + i; k = i
    tolls(b, k, 80)
    pedal(b, k, 88); bass_dirge(b, k, 1.04)
    timp(b, k, 'q', 100)
    groove(b, 'march', 1.06)
    put('brass', b, theme(k), 88)
    put('pipe', b, theme(k), 78, -12)
    trem(b, k, 66 + (i % 4) * 4)
    chord('choir', b, CH8[k][1], 72, 60)
    if i >= 4: arp(b, k, 60)
shriek(14, 0, 77, 2.0, 5, -3, 92); shriek(18, 0, 84, 2.0, 5, -5, 98); shriek(19, 2, 79, 1.5, 3, -4, 96)
fill(15); snare_roll(18, 2, 4, 60, 100); fill(19)

# ---- Kreis V–VI (20–27): tief, schwer ---------------------------------------------------------
crash(20, 116); hit(20, [F, Ab, C], 114)
for i in range(8):
    b = 20 + i; k = i
    pedal(b, k, 94); bass_dirge(b, k, 1.1)
    put('trombone', b, theme(k), 94, -12)
    put('tuba', b, theme(k), 84, -24)
    put('pipe', b, theme(k), 82)
    timp(b, k, 'gallop', 100)
    groove(b, 'heavy', 1.0)
    stabs(b, k, 66)
    chord('choir', b, CH8[k][1], 80 + (i // 4) * 6, 60)
    trem(b, k, 68)
    if i in (3, 7): tolls(b, k, 90)
shriek(22, 0, 89, 2.0, 2, -6, 100); shriek(26, 1, 84, 2.5, 4, -7, 102)
fill(23); fill(27, True); snare_roll(26, 2, 4, 70, 108)

# ---- Kreis VII (28–35): Gewalt, Feuer-Ostinato -------------------------------------------------
crash(28, 118); hit(28, [F, Ab, C], 118); crash(32, 112)
for i in range(8):
    b = 28 + i; k = i
    pedal(b, k, 96); bass_dirge(b, k, 1.14)
    fire(b, k, 72 + (i // 4) * 6)
    put('brass', b, theme(k), 96)
    put('pipe', b, theme(k), 84)
    put('trombone', b, theme(k), 90, -12)
    timp(b, k, 'gallop', 104)
    groove(b, 'fire', 1.0 + (i // 4) * 0.04)
    chord('choir', b, CH8[k][1], 78, 60)
    if i % 2 == 0: tolls(b, k, 84)
shriek(29, 0, 84, 1.5, 6, -1, 100); shriek(31, 0, 89, 1.5, 4, -3, 104); shriek(33, 0, 77, 1.5, 7, 0, 102); shriek(35, 0, 91, 1.5, 5, -6, 106)
fill(31); fill(35, True); snare_roll(34, 0, 4, 70, 110)

# ---- Kreis VIII (36–43): Betrug – Thema als Kanon ---------------------------------------------
crash(36, 118); hit(36, [F, Ab, C], 118)
for i in range(8):
    b = 36 + i; k = i
    pedal(b, k, 94); bass_dirge(b, k, 1.14)
    put('pipe', b, theme(k), 90)
    put('brass', b, theme((k - 1) % 8), 92)                     # Kanon im Abstand eines Taktes
    put('trombone', b, theme((k - 2) % 8), 88, -12)             # zweiter Einsatz, zwei Takte versetzt
    timp(b, k, 'gallop', 104)
    groove(b, 'heavy', 1.06)
    arp(b, k, 66, 'strings')
    trem(b, k, 72)
    chord('choir', b, CH8[k][1], 82, 60)
    if i % 4 == 0: tolls(b, k, 92)
shriek(38, 0, 84, 2.0, 6, -4, 104); shriek(40, 2, 89, 1.5, 3, -6, 104); shriek(42, 0, 91, 2.0, 7, -5, 106)
fill(39); fill(43, True); snare_roll(42, 2, 4, 70, 110)

# ---- Kreis IX (44–51): Cocytus, Eis, Höhepunkt -------------------------------------------------
crash(44, 122); hit(44, [F, Ab, C], 124); crash(48, 118)
for i in range(8):
    b = 44 + i; k = i
    pedal(b, k, 100); bass_dirge(b, k, 1.2)
    put('brass', b, theme(k), 100)
    put('trombone', b, theme(k), 96, -12)
    put('tuba', b, theme(k), 90, -24)
    put('pipe', b, theme(k), 90, 12)
    stabs(b, k, 74)
    chord('choir', b, CH8[k][1], 90, 60)
    chord('choir', b, CH8[k][1], 70, 72)
    trem(b, k, 76)
    fire(b, k, 80)
    timp(b, k, 'gallop', 108)
    groove(b, 'ice', 1.0 + (i // 4) * 0.03)
    if i % 2 == 0: nine(b, 2 if i % 4 == 0 else 0, 'crystal', 84, 89, 0.25)
    tolls(b, k, 88)
shriek(45, 2, 91, 2.0, 7, -6, 108); shriek(49, 2, 89, 2.0, 7, -6, 108); shriek(51, 0, 84, 1.5, 6, -6, 108)
fill(47); fill(51, True); snare_roll(50, 2, 4, 80, 116)

# ---- Rückführung (52–55): Aufstieg zur Dominante -----------------------------------------------
CH_R = [(Bb, [Bb, Db, F]), (Db, [Db, F, Ab]), (C, [C, E, G]), (C, [C, E, G, Bb])]
RET = [[(0, 1, 70), (1, 1, 72), (2, 1, 73), (3, 1, 77)],
       [(0, 1, 73), (1, 1, 75), (2, 1, 77), (3, 1, 80)],
       [(0, 1, 76), (1, 1, 79), (2, 1, 80), (3, 1, 79)],
       [(0, 1, 79), (1, 1, 76), (2, 1, 72), (3, 1, 76)]]
crash(52, 112); hit(52, [Bb, Db, F], 112)
for i, (bpc, pcs) in enumerate(CH_R):
    b = 52 + i
    song.add('contra', song.bar(b), 3.98, cp(bpc), 92 + i * 2); song.add('bass', song.bar(b), 3.9, bp(bpc), 100 + i * 2)
    put('brass', b, RET[i], 96 + i * 3)
    put('pipe', b, RET[i], 80, -12)
    chord('choir', b, pcs, 74 + i * 6, 60)
    for p in pad(pcs, 60): song.add('tremolo', song.bar(b), 3.98, p, 62 + i * 8)
    fire(b, [6, 4, 5, 7][i], 74 + i * 6)
    if i >= 2: timp(b, 5 if i == 2 else 7, 'roll', 96 + i * 4)
    else: timp(b, [6, 4][i], 'gallop', 100)
    if i < 2: groove(b, 'heavy', 0.96)
snare_roll(54, 0, 4, 60, 100); snare_roll(55, 0, 3.5, 90, 126); fill(55, True)
shriek(53, 0, 72, 3.5, -5, 5, 100)                              # Schrei steigt (Aufstieg)

# ---- Rendern ----------------------------------------------------------------------------------
sf2, out = cli_paths('bgm_theme_hellcircles.ogg')
song.render(sf2, out)
