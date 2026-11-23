# -*- coding: utf-8 -*-
"""Kampagnen-Score · Markt → public/music/bgm_score_markt.ogg                              Titel: „Haggle & Barter“

Ein Markt: Stände, Rufe, Feilschen, Gerüche, Gedränge, ständig Bewegung. A-Moll (harmonisch, mit dem Leitton Gis), 120 BPM, 4/4: Klarinette (Schlangenbeschwörer-Wendungen) und Akkordeon feilschen miteinander,
Nylon-Gitarre zupft wie eine Laute (Oud-Ersatz), Marimba und Xylophon klappern wie Münzen, Hand-Trommeln und Tamburin treiben, Flöte wirbelt, Glockenspiel klimpert wie Münzen in der Kasse.

  • **Ohrwurm** (A): ein punktierter Kern („Dah-dah-da DAAH da-da“, 3+3+2 Sechzehntel-Gruppierung) auf Am – E – Am – E | Dm – Am – E – Am; mit Leitton Gis, kurzem Aufstieg, rhythmisch markant — man klopft mit.
  • **B** (Feilschen): Frage und Antwort im Zwei-Schläge-Wechsel zwischen Klarinette und Akkordeon, jeder will das letzte Wort; Schluss mit Wirbel.
  • **C** (Marktplatz-Hochstimmung): Dur-Aufhellung (C – G – Am – E | F – C – G – E), die Flöte tanzt, alle klatschen; **Finale** einen Ganzton höher (H-Moll).
  • Leitmotiv „Freunde“ (Do–Re–Mi–Sol–La–Sol) in der Intro (Marimba) und im Outro (Klarinette) — dieser Markt ist ein Stück Heimat.
Form (48 Takte ≈ 1:36): Intro 4 · A 8 · B 8 · A' 8 · C 8 · A'' +2 8 · Outro 4
Ausklang auf E (Dominante) → zurück in die A-Moll-Intro.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE
from score_kit import Kit

BPM, BARS = 120, 48
song = Song(BPM, BARS)
CH = {'Am': (9, 'm'), 'E': (4, 'M'), 'Dm': (2, 'm'), 'C': (0, 'M'), 'G': (7, 'M'), 'F': (5, 'M'), 'Bm': (11, 'm'), 'F#': (6, 'M')}
kit = Kit(song, CH, seed=1001, tonic_pc=9)
hv, rng = kit.hv, kit.rng

song.inst('clarinet', 'clarinet', vol=88, pan=44)
song.inst('accordion', 'accordion', vol=80, pan=78)
song.inst('guitar', 'guitar', vol=80, pan=24)
song.inst('marimba', 'marimba', vol=76, pan=36)
song.inst('xylo', 'xylo', vol=64, pan=90)
song.inst('flute', 'flute', vol=76, pan=84)
song.inst('bass', 'acbass', vol=94, pan=62)
song.inst('pizz', 'pizz', vol=62, pan=30)
song.inst('glock', 'glock', vol=58, pan=92)
song.inst('oohs', 'oohs', vol=50, pan=70)
song.inst('violin', 'violin', vol=66, pan=60)
song.inst('bassoon', 'bassoon', vol=64, pan=52)

A_CH = ['Am', 'E', 'Am', 'E', 'Dm', 'Am', 'E', 'Am']
A_MEL = [
    [('E5', .75), ('A5', .75), ('B5', .5), ('C6', 1), ('B5', .5), ('A5', .5)],
    [('G#5', .75), ('B5', .75), ('C6', .5), ('D6', 1), ('C6', .5), ('B5', .5)],
    [('E5', .75), ('A5', .75), ('B5', .5), ('C6', 1), ('E6', .5), ('D6', .5)],
    [('C6', .75), ('B5', .75), ('G#5', .5), ('E5', 2)],
    [('D5', .75), ('F5', .75), ('A5', .5), ('D6', 1), ('C6', .5), ('A5', .5)],
    [('C6', .75), ('B5', .75), ('A5', .5), ('E5', 2)],
    [('G#5', .75), ('B5', .75), ('E6', .5), ('D6', 1), ('B5', .5), ('G#5', .5)],
    [('A5', 2), (None, 2)],
]
A_OPEN = A_MEL[:7] + [[('B5', 1), ('G#5', 1), ('E5', 2)]]
B_CH = ['Am', 'Am', 'Dm', 'Dm', 'E', 'E', 'Am', 'E']
B_TALK = [   # (Instrument, Noten) zwei Slots à 2 Schläge — das Feilschen
    [('clarinet', [('A5', .5), ('C6', .5), ('B5', .5), ('A5', .5)]), ('accordion', [('E5', .5), ('G#5', .5), ('A5', .5), ('E5', .5)])],
    [('clarinet', [('A5', .5), ('C6', .5), ('E6', 1)]), ('accordion', [('D6', .5), ('C6', .5), ('A5', 1)])],
    [('clarinet', [('D6', .5), ('F6', .5), ('E6', .5), ('D6', .5)]), ('accordion', [('A5', .5), ('C6', .5), ('D6', .5), ('A5', .5)])],
    [('flute', [('F6', .5), ('E6', .5), ('D6', 1)]), ('clarinet', [('C6', .5), ('B5', .5), ('A5', 1)])],
    [('accordion', [('G#5', .5), ('B5', .5), ('E6', .5), ('B5', .5)]), ('clarinet', [('G#5', .5), ('B5', .5), ('E6', 1)])],
    [('clarinet', [('D6', .5), ('B5', .5), ('G#5', .5), ('E5', .5)]), ('accordion', [('B5', 1), ('G#5', 1)])],
    [('clarinet', [('A5', .5), ('C6', .5), ('E6', 1)]), ('flute', [('A6', 1), ('E6', 1)])],
    [('accordion', [('B5', 1), ('G#5', 1)]), ('clarinet', [('E5', 2)])],
]
C_CH = ['C', 'G', 'Am', 'E', 'F', 'C', 'G', 'E']
C_MEL = [
    [('E5', .5), ('G5', .5), ('C6', 1), ('B5', .5), ('G5', .5), ('E5', 1)],
    [('D5', .5), ('G5', .5), ('B5', 1), ('A5', .5), ('G5', .5), ('D5', 1)],
    [('C5', .5), ('E5', .5), ('A5', 1), ('G5', .5), ('E5', .5), ('C5', 1)],
    [('G#5', 1), ('B5', 1), ('E6', 2)],
    [('A5', .5), ('C6', .5), ('F6', 1), ('E6', .5), ('C6', .5), ('A5', 1)],
    [('G5', .5), ('C6', .5), ('E6', 1), ('D6', .5), ('C6', .5), ('G5', 1)],
    [('B5', .5), ('D6', .5), ('G6', 1), ('F#6', .5), ('D6', .5), ('B5', 1)],
    [('G#5', 1), ('B5', 1), ('E6', 1), ('G#5', 1)],
]

def hand_drums(bar0, nbars, level=1.0, crash=True, fills=True):
    """Hand-Trommeln: Tief auf 1 und 3&, hoch auf 2 und 4, Tamburin-Sechzehntel — Marktgetrommel."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        song.dr(t, TOM_L, int(100 * L), 0.15); song.dr(t + 1.5, TOM_L, int(84 * L), 0.12); song.dr(t + 2.5, TOM_L, int(92 * L), 0.12)
        song.dr(t + 1, TOM_H, int(90 * L), 0.12); song.dr(t + 3, TOM_H, int(94 * L), 0.12); song.dr(t + 3.5, TOM_M, int(76 * L), 0.1)
        song.dr(t, KICK, int(80 * L), 0.15)
        for i in range(16): song.dr(t + i * 0.25, HAT, int((70 if i % 4 == 0 else (54 if i % 2 == 0 else 40)) * L), 0.04)
        if k == 0 and crash: song.dr(t, CRASH, int(86 * L), 1.2)
        if fills and k % 4 == 3:
            for j in range(4): song.dr(t + 2.5 + j * 0.375, (TOM_H, TOM_M, TOM_M, TOM_L)[j], int((74 + 6 * j) * L), 0.12)

def coins(bar0, nbars, shift=0, vel=50):
    """Münzen: kurze Glockenspiel-/Xylophon-Klimper, zufällig."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        for _ in range(2):
            song.add(rng.choice(('glock', 'xylo')), t + rng.choice((0.25, 0.75, 1.5, 2.25, 3.0, 3.5)), 0.25, pn(rng.choice(('A6', 'C7', 'E7', 'B6', 'G#6'))) + shift, hv(vel))

def lute(bar0, chords, shift=0, vel=62):
    """Nylon-Gitarre wie eine Laute: punktierte Achtel-Arpeggien (3+3+2)."""
    for k, ch in enumerate(chords):
        T = kit.tones(ch, 3, shift)
        t = song.bar(bar0 + k)
        notes = (T[0] + 12, T[2], T[1] + 12, T[0] + 12, T[2], T[1] + 12, T[0] + 12, T[2])
        pos = (0, .5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5)
        for i in range(8): song.add('guitar', t + pos[i], 0.5, notes[i], hv(vel + (10 if i in (0, 3, 6) else 0)))

def a_section(bar0, shift=0, vel=92, open_end=False, full=False):
    mel = A_OPEN if open_end else A_MEL
    kit.mel('clarinet', bar0, mel, shift=shift, vel=vel, legato=.85)
    kit.mel('accordion', bar0, mel, shift=shift, vel=vel - 22, octave=-1, legato=.85)
    lute(bar0, A_CH, shift=shift)
    kit.bass(bar0, A_CH, shift=shift, vel=92, style='push')
    hand_drums(bar0, 8, level=1.0 if not full else 1.1)
    coins(bar0, 8, shift=shift)
    if full:
        kit.mel('marimba', bar0, mel, shift=shift, vel=vel - 24, octave=1, legato=.4)
        kit.mel('flute', bar0, mel, shift=shift, vel=vel - 22, octave=1, legato=.8)
        kit.mel('violin', bar0, mel, shift=shift, vel=vel - 36, octave=0, legato=.8)

b = 0
# ── Intro (4): Marktgeräusche — Hand-Trommeln, Münzen, die Marimba stellt das Leitmotiv „Freunde“ vor, die Laute zupft ─────────────────────────
hand_drums(b, 4, level=0.8, crash=False, fills=False)
coins(b, 4, vel=48)
t0 = song.bar(b + 1)
for off, d in LEITMOTIVE['freunde']:
    song.add('marimba', t0, d * .6, pn('A4') + off - 1 if off in (4, 9) else pn('A4') + off, hv(88)); t0 += d
lute(b + 2, ['Am', 'E'], vel=56)
kit.bass(b + 2, ['Am', 'E'], vel=82, style='push')
b += 4

# ── A (8): der punktierte Ohrwurm — Klarinette, Akkordeon eine Oktave tiefer, Laute, Hand-Trommeln ───────────────────────────────────────────────
a_section(b)
b += 8

# ── B (8): Feilschen — Frage und Antwort zwischen Klarinette, Akkordeon und Flöte; Wirbel am Ende ────────────────────────────────────────────────
for k, slots in enumerate(B_TALK):
    for slot, (inst, notes) in enumerate(slots):
        tt = song.bar(b + k) + slot * 2.0
        for name, dur in notes:
            song.add(inst, tt, max(0.1, dur * .85), pn(name), hv(92 if inst == 'clarinet' else 84)); tt += dur
lute(b, B_CH, vel=56)
kit.bass(b, B_CH, vel=88, style='push')
hand_drums(b, 8, level=0.95)
coins(b, 8, vel=54)
kit.pad(b, B_CH, vel=30, inst='violin')
kit.roll(b + 7, 2, 4, 44, 104)
b += 8

# ── A' (8): voll — Marimba, Flöte, Geige; offenes Ende (Gis–E) ───────────────────────────────────────────────────────────────────────────────────
a_section(b, vel=96, open_end=True, full=True)
b += 8

# ── C (8): Marktplatz-Hochstimmung — Dur-Aufhellung, Flöte tanzt, alle klatschen ────────────────────────────────────────────────────────────────
kit.mel('flute', b, C_MEL, vel=88, legato=.85)
kit.mel('accordion', b, C_MEL, vel=72, harm=-2, legato=.85)
kit.mel('marimba', b, C_MEL, vel=64, octave=1, legato=.4)
kit.mel('oohs', b, C_MEL, vel=46)
lute(b, C_CH, vel=64)
kit.bass(b, C_CH, vel=92, style='push')
hand_drums(b, 8, level=1.05)
for k in range(8):
    for beat in (1, 3): song.dr(song.bar(b + k) + beat, CLAP, 86, 0.12)
coins(b, 8, vel=56)
b += 8

# ── A'' +2 (8): H-Moll — alles; Ganzschluss ──────────────────────────────────────────────────────────────────────────────────────────────────────
a_section(b, shift=2, vel=102, full=True)
song.dr(song.bar(b + 7), CRASH, 98, 1.2)
b += 8

# ── Outro (4): E (Dominante zur A-Moll-Intro) — das Leitmotiv „Freunde“ in der Klarinette, Münzen, Trommeln dünnen aus ────────────────────────────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('clarinet', t0, d * .92, pn('E5') + off - (1 if off in (4, 9) else 0), hv(84)); t0 += d
lute(b, ['E', 'E', 'E'], vel=58)
kit.bass(b, ['E', 'E', 'E'], vel=82, style='half')
hand_drums(b, 3, level=0.8, crash=False, fills=False)
coins(b, 4, vel=56)
song.dr(song.bar(b + 3) + 2.0, CLAP, 96, 0.12); song.dr(song.bar(b + 3) + 3.0, CLAP, 100, 0.12)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_markt.ogg')
    song.render(sf2, out, target_rms=0.24, saturate=False, compress=True, air_cut=0.0)
