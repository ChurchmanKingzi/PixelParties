# -*- coding: utf-8 -*-
"""Kampagnen-Score · Cafeteria → public/music/bgm_score_cafeteria.ogg                        Titel: „Lunch Rush“

Mittagspause in der Cafeteria: Stimmengewirr, Geschirrklirren, überall Gespräche, gute Laune, Gedränge. Swing-Jazz in B-Dur, 138 BPM, 4/4 mit Triolen-Achteln (Swing): gedämpfte Trompete und Klarinette als
Plaudernde, Klavier-Comping, Vibraphon, Gitarre in Vierteln („Freddie Green“), Kontrabass im Gehen, Besen-Schlagzeug. Das Marimba/Xylophon „schwatzt“ in kurzen Fragmenten, das Glockenspiel klirrt wie Teller.

  • **Ohrwurm** (A): „doo-bee-doo“ — zwei swingende Achtel-Paare, dann ein Sprung (B♭5–G5–D5 …), über der Jazz-Standard-Progression B♭ – Gm – Cm – F7 (I–vi–ii–V), die man nach einmal Hören mitsummt.
  • **B** (Bridge): ein ruhigerer Gang durch die Schlange (Es – Cm – F7 – B♭), Klavier-Solo mit Klarinette; **Shout** (A''): alle gemeinsam, Vibraphon verdoppelt.
  • Leitmotiv „Freunde“ (Do–Re–Mi–Sol–La–Sol) als Klavier-Intro und als Tag am Ende.
Form (56 Takte ≈ 1:37): Intro 4 · A 8 · A' 8 · B 8 · A'' (Shout) 8 · B' 8 · A''' 8 · Outro 4
Ausklang auf F7 (Dominante) → zurück in die B-Dur-Intro.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE
from score_kit import Kit, T3

BPM, BARS = 138, 56
song = Song(BPM, BARS)
CH = {'Bb': (10, 'M'), 'Gm': (7, 'm'), 'Cm': (0, 'm'), 'F7': (5, '7'), 'Eb': (3, 'M'), 'Dm': (2, 'm')}
kit = Kit(song, CH, seed=1215, tonic_pc=10)
hv, rng = kit.hv, kit.rng

song.inst('muted', 'muted', vol=88, pan=44)
song.inst('clarinet', 'clarinet', vol=84, pan=78)
song.inst('vibes', 'vibes', vol=74, pan=88)
song.inst('piano', 'piano', vol=78, pan=54)
song.inst('guitar', 'cleangtr', vol=62, pan=24)
song.inst('bass', 'acbass', vol=98, pan=62)
song.inst('marimba', 'marimba', vol=70, pan=36)
song.inst('xylo', 'xylo', vol=60, pan=94)
song.inst('glock', 'glock', vol=56, pan=70)
song.inst('oohs', 'oohs', vol=52, pan=70)

A_CH = ['Bb', 'Gm', 'Cm', 'F7', 'Bb', 'Gm', 'Cm', 'F7']
A_MEL = [
    [('F5', 2 * T3), ('F5', T3), ('D5', 2 * T3), ('F5', T3), ('Bb5', 1), (None, 1)],
    [('G5', 2 * T3), ('G5', T3), ('D5', 2 * T3), ('G5', T3), ('Bb5', 1), (None, 1)],
    [('Eb5', 2 * T3), ('Eb5', T3), ('C5', 2 * T3), ('Eb5', T3), ('G5', 1), (None, 1)],
    [('F5', 2 * T3), ('A5', T3), ('C6', 2 * T3), ('A5', T3), ('F5', 2)],
    [('F5', 2 * T3), ('F5', T3), ('D5', 2 * T3), ('F5', T3), ('Bb5', 1), (None, 1)],
    [('G5', 2 * T3), ('Bb5', T3), ('D6', 2 * T3), ('Bb5', T3), ('G5', 2)],
    [('C6', 2 * T3), ('Bb5', T3), ('G5', 2 * T3), ('Eb5', T3), ('C5', 2)],
    [('A5', 2 * T3), ('G5', T3), ('F5', 2 * T3), ('E5', T3), ('F5', 1), (None, 1)],
]
B_CH = ['Eb', 'Cm', 'F7', 'Bb', 'Eb', 'Cm', 'F7', 'F7']
B_MEL = [
    [('G5', 2), ('Bb5', 1), ('G5', 1)],
    [('Eb5', 2 * T3), ('G5', T3), ('C6', 2 * T3), ('G5', T3), ('Eb5', 2)],
    [('A5', 2 * T3), ('C6', T3), ('Eb6', 2 * T3), ('C6', T3), ('A5', 2)],
    [('D6', 3), ('Bb5', 1)],
    [('G5', 2), ('Bb5', 1), ('G5', 1)],
    [('G5', 1), ('Eb5', 1), ('C5', 2)],
    [('A5', 1), ('C6', 1), ('Eb6', 1), ('D6', 1)],
    [('C6', 2), (None, 2)],
]

def comp(bar0, chords, vel=58):
    """Klavier-Comping: synkopierte Akkorde auf den Triolen-Offbeats (Swing)."""
    for k, ch in enumerate(chords):
        T = kit.tones(ch, 4)
        t = song.bar(bar0 + k)
        for pos in (2 * T3, 2.0 + 2 * T3, 3.0 + 2 * T3):
            for m in (T[1], T[2], T[0] + 12): song.add('piano', t + pos, 0.4, m, hv(vel))

def freddie(bar0, chords, vel=54):
    """Gitarre: kurze Akkorde auf jeder Zählzeit."""
    for k, ch in enumerate(chords):
        T = kit.tones(ch, 3)
        t = song.bar(bar0 + k)
        for i in range(4):
            for m in (T[0] + 12, T[1] + 12, T[2] + 12): song.add('guitar', t + i, 0.35, m, hv(vel + (8 if i in (1, 3) else 0)))

def chatter(bar0, nbars, vel=62, every=2):
    """Das Schwatzen: kurze Marimba-/Xylophon-Fragmente (Pentatonik) am Taktende; dazu Tellerklirren im Glockenspiel."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        if k % every == every - 1:
            n = rng.choice((('F5', 'Bb5', 'D6'), ('G5', 'C6', 'Eb6'), ('D5', 'F5', 'A5')))
            for i, name in enumerate(n): song.add(rng.choice(('marimba', 'xylo')), t + 2.667 + i * T3, T3 * .8, pn(name), hv(vel))
        if rng.random() < 0.5:
            song.add('glock', t + rng.choice((0.667, 1.667, 3.333)), 0.3, pn(rng.choice(('F7', 'Bb6', 'D7'))), hv(48))

def a_section(bar0, lead='muted', second=None, vel=90, full=False):
    kit.mel(lead, bar0, A_MEL, vel=vel, legato=.88)
    if second: kit.mel(second, bar0, A_MEL, vel=vel - 18, harm=-2, legato=.88)
    if full:
        kit.mel('vibes', bar0, A_MEL, vel=vel - 24, octave=0, legato=.8)
        kit.mel('oohs', bar0, A_MEL, vel=48, octave=0)
    kit.bass(bar0, A_CH, vel=92, style='walk')
    comp(bar0, A_CH)
    freddie(bar0, A_CH)
    kit.drums(bar0, 8, style='swing', level=1.0 if not full else 1.12, fills=False)
    chatter(bar0, 8)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): das Leitmotiv „Freunde“ im Klavier, Besen und Bass setzen ein, Gedränge-Fill ───────────────────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('piano', t0, d * .92, pn('Bb4') + off, hv(84)); song.add('piano', t0, d * .92, pn('Bb3') + off, hv(66)); t0 += d
kit.bass(b + 1, ['Eb', 'F7', 'F7'], vel=84, style='walk')
kit.drums(b + 1, 3, style='swing', level=0.8, fills=False)
comp(b + 1, ['Eb', 'F7', 'F7'], vel=48)
freddie(b + 2, ['F7', 'F7'], vel=48)
for j in range(4): song.dr(song.bar(b + 3) + 2.0 + j * 0.5, SNARE, 52 + 14 * j, 0.1)
b += 4

# ── A (8): gedämpfte Trompete erzählt ────────────────────────────────────────────────────────────────────────────
a_section(b, lead='muted')
b += 8

# ── A' (8): die Klarinette übernimmt, die Trompete antwortet in Terzen; das Vibraphon klingt mit ────────────────────────────────
a_section(b, lead='clarinet', second='muted', vel=88)
kit.mel('vibes', b, A_MEL, vel=60, octave=0, legato=.8)
b += 8

# ── B (8): Bridge — die Schlange rückt vor: Klavier führt, Klarinette antwortet; leichterer Swing ───────────────────────────────────
kit.mel('piano', b, B_MEL, vel=86, legato=.9)
kit.mel('clarinet', b, B_MEL, vel=66, octave=0, harm=-2, legato=.9)
kit.mel('vibes', b, B_MEL, vel=54, octave=1, legato=.8)
kit.bass(b, B_CH, vel=90, style='walk')
freddie(b, B_CH, vel=50)
kit.drums(b, 8, style='swing', level=0.9, fills=False)
chatter(b, 8, vel=56)
for j in range(4): song.dr(song.bar(b + 7) + 2.0 + j * 0.5, SNARE, 52 + 14 * j, 0.1)
b += 8

# ── A'' Shout (8): alle gemeinsam, Vibraphon und Oohs doppeln, Trompete oben, Klarinette in Terzen ───────────────────────────────────
a_section(b, lead='muted', second='clarinet', vel=100, full=True)
b += 8

# ── B' (8): Bridge nochmal, jetzt die Trompete vorn, Klavier füllt ──────────────────────────────────────────────────────────────
kit.mel('muted', b, B_MEL, vel=88, legato=.9)
kit.mel('vibes', b, B_MEL, vel=58, octave=0, legato=.8)
kit.mel('piano', b, B_MEL, vel=64, octave=-1, legato=.9)
kit.bass(b, B_CH, vel=92, style='walk')
freddie(b, B_CH, vel=52)
kit.drums(b, 8, style='swing', level=1.0, fills=False)
chatter(b, 8, vel=58)
for j in range(4): song.dr(song.bar(b + 7) + 2.0 + j * 0.5, SNARE, 56 + 14 * j, 0.1)
b += 8

# ── A''' (8): Schluss-Shout — alles, Ganzschluss auf B♭ ────────────────────────────────────────────────────────────────────────
final = A_MEL[:7] + [[('F5', 1), ('D5', 1), ('Bb4', 2)]]
fch = A_CH[:7] + ['Bb']
kit.mel('muted', b, final, vel=102, legato=.88)
kit.mel('clarinet', b, final, vel=84, harm=-2, legato=.88)
kit.mel('vibes', b, final, vel=78, legato=.8)
kit.mel('oohs', b, final, vel=50)
kit.bass(b, fch, vel=94, style='walk')
comp(b, fch, vel=62)
freddie(b, fch, vel=58)
kit.drums(b, 8, style='swing', level=1.15, fills=False)
chatter(b, 8, vel=62)
b += 8

# ── Outro (4): F7 (Dominante zur B-Dur-Intro) — Tag: das Leitmotiv „Freunde“ in der Klarinette, Teller klirren ───────────────────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('clarinet', t0, d * .92, pn('F5') + off, hv(86)); t0 += d
kit.bass(b, ['F7', 'F7', 'F7'], vel=84, style='half')
comp(b, ['F7', 'F7', 'F7'], vel=52)
kit.drums(b, 3, style='swing', level=0.85, fills=False)
for i, n in enumerate(('F6', 'A6', 'C7', 'Eb7')): song.add('glock', song.bar(b + 3) + 0.5 + i * 0.5, 0.4, pn(n), hv(64))
for j in range(4): song.dr(song.bar(b + 3) + 2.0 + j * 0.5, SNARE, 52 + 16 * j, 0.1)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_cafeteria.ogg')
    song.render(sf2, out, target_rms=0.24, saturate=False, compress=True, air_cut=0.0)
