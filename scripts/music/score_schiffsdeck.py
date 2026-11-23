# -*- coding: utf-8 -*-
"""Kampagnen-Score · Schiffsdeck → public/music/bgm_score_schiffsdeck.ogg                       Titel: „Wind in the Sails“

Ein Schiffsdeck bei gutem Wind: Seeluft, Weite, Gischt, eine Mannschaft, die singt. Shanty-Jig in D-Dur (mit mixolydischem C — der „Seemanns-Klang“), **6/8** (zwei Schläge mit je drei Triolenachteln),
Akkordeon + Fiedel + Pfeife als Melodie, Nylon-Gitarre im Jig-Wechselschlag, Kontrabass, Rahmentrommel (Toms) wie ein Fuß, der den Takt stampft; Schiffsglocke, Wellen-Schwellen (Wind-Pad per Pitch-Bend),
Gang-Rufe „Hey-ho!“ (Oohs/Choir).

  • **Ohrwurm** (Refrain a): „dum-dum-dum da-da-DA“ — drei Wiederholer, dann ein Sprung, jeden Takt eine Stufe auf der Schifffahrt-Progression D – C – G – A.
  • **Strophe b** erzählt in großen Bögen (Akkordeon), **Bridge** ist die Nachtwache: lange Fiedel-Töne über Bm – G – D – A, das Schiff gleitet ruhig dahin.
  • Leitmotiv „Freunde“ (Do–Re–Mi–Sol–La–Sol) in der Intro (Pfeife) und im Outro (Fiedel).
Form (64 Takte ≈ 1:25): Intro 4 · Refrain 8 · Strophe 8 · Refrain 8 · Bridge 8 · Strophe voll 8 · Hey-ho 8 · Refrain +2 8 · Outro 4
Ausklang auf A (Dominante) → zurück in die D-Dur-Intro.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE
from score_kit import Kit, T3

BPM, BARS = 92, 64
song = Song(BPM, BARS, beats_per_bar=2)
CH = {'D': (2, 'M'), 'C': (0, 'M'), 'G': (7, 'M'), 'A': (9, 'M'), 'Bm': (11, 'm'), 'Em': (4, 'm')}
kit = Kit(song, CH, seed=1492, tonic_pc=2)
hv, rng = kit.hv, kit.rng

song.inst('accordion', 'accordion', vol=84, pan=44)
song.inst('violin', 'violin', vol=84, pan=78)
song.inst('whistle', 'whistle', vol=80, pan=62)
song.inst('guitar', 'guitar', vol=82, pan=28)
song.inst('bass', 'acbass', vol=96, pan=62)
song.inst('oohs', 'oohs', vol=72, pan=68)
song.inst('choir', 'choir', vol=70, pan=56)
song.inst('bell', 'bell', vol=66, pan=88)
song.inst('sweep', 'sweep', vol=44, pan=64)
song.inst('harp', 'harp', vol=70, pan=36)
song.inst('glock', 'glock', vol=58, pan=92)
song.inst('timp', 'timp', vol=84, pan=64)
kit.bend_setup('sweep')

# ═══ Material (D-Dur, mixolydisch gefärbt) ═══════════════════════════════════════════════════════
A_CH = ['D', 'C', 'G', 'A', 'D', 'C', 'G', 'D']
A_CH_OPEN = ['D', 'C', 'G', 'A', 'D', 'C', 'G', 'A']
HOOK = [
    [('D5', T3), ('D5', T3), ('D5', T3), ('A4', T3), ('D5', T3), ('F#5', T3)],
    [('E5', T3), ('E5', T3), ('E5', T3), ('C5', T3), ('E5', T3), ('G5', T3)],
    [('D5', T3), ('D5', T3), ('D5', T3), ('B4', T3), ('D5', T3), ('G5', T3)],
    [('E5', 2 * T3), ('C#5', T3), ('A4', 3 * T3)],
    [('D5', T3), ('D5', T3), ('D5', T3), ('A4', T3), ('D5', T3), ('F#5', T3)],
    [('E5', T3), ('E5', T3), ('E5', T3), ('C5', T3), ('E5', T3), ('G5', T3)],
    [('B4', T3), ('D5', T3), ('G5', T3), ('F#5', 2 * T3), ('E5', T3)],
    [('D5', 3 * T3), ('A4', 3 * T3)],
]
HOOK_OPEN_END = [('E5', 3 * T3), ('C#5', 3 * T3)]
V_CH = ['D', 'C', 'G', 'A', 'D', 'Bm', 'G', 'A']
VERSE = [
    [('F#5', 2 * T3), ('A5', T3), ('F#5', 2 * T3), ('D5', T3)],
    [('E5', 2 * T3), ('G5', T3), ('E5', 2 * T3), ('C5', T3)],
    [('D5', 2 * T3), ('G5', T3), ('B5', 2 * T3), ('G5', T3)],
    [('A5', 3 * T3), ('E5', 3 * T3)],
    [('F#5', 2 * T3), ('A5', T3), ('F#5', 2 * T3), ('D5', T3)],
    [('D5', 2 * T3), ('F#5', T3), ('B5', 2 * T3), ('A5', T3)],
    [('G5', 2 * T3), ('F#5', T3), ('E5', 2 * T3), ('D5', T3)],
    [('C#5', 3 * T3), ('E5', 3 * T3)],
]
BR_CH = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'A', 'A']
BRIDGE = [
    [('F#5', 2)], [('G5', 1), ('B5', 1)], [('A5', 2)], [('E5', 1), ('C#5', 1)],
    [('D6', 2)], [('B5', 1), ('G5', 1)], [('A5', 1), ('E5', 1)], [('E5', 2)],
]

# ═══ Bausteine ═══════════════════════════════════════════════════════════════════════════════════
def waves(bar0, nbars, vel=40, shift=0):
    """Wellen: Wind-Pad schwillt über je vier Takte an und ab (Pitch-Bend), dazu eine tiefe Pauken-Dünung."""
    for k in range(0, nbars, 4):
        kit.glide('sweep', song.bar(bar0 + k), 6.0, pn('D5') + shift, vel, -3.0, 4.0, steps=24)
        kit.glide('sweep', song.bar(bar0 + k) + 6.0, 2.0, pn('D5') + shift + 4, vel - 6, 4.0, -5.0, steps=12)
        song.add('timp', song.bar(bar0 + k), 3.5, pn('D2') + 12, 40 + vel // 3)

def bell(bar0, nbars, every=4, vel=62, shift=0):
    for k in range(0, nbars, every):
        song.add('bell', song.bar(bar0 + k), 1.9, pn('A5') + shift, vel); song.add('bell', song.bar(bar0 + k) + 1, 1.9, pn('D6') + shift, vel - 8)

def heyho(bar0, ks, chords, shift=0, vel=100):
    """Gang-Ruf „Hey-ho!“ auf den Schlägen 1 und 2 (Chor + Oohs) mit Klatschen."""
    for k in ks:
        t = song.bar(bar0 + k)
        T = kit.tones(chords[k], 4, shift)
        for beat, o in ((0, 0), (1, 0)):
            for m in T[:3]: song.add('choir', t + beat, 0.4, m + o, hv(vel)); song.add('oohs', t + beat, 0.4, m - 12 + o, hv(vel - 12))
            song.dr(t + beat, CLAP, 100, 0.12)

def refrain(bar0, shift=0, vel=94, end_open=False, full=False):
    mel = HOOK[:7] + [HOOK_OPEN_END if end_open else HOOK[7]]
    chords = A_CH_OPEN if end_open else A_CH
    kit.mel('whistle', bar0, mel, shift=shift, vel=vel, legato=.9)
    kit.mel('violin', bar0, mel, shift=shift, vel=vel - 14, legato=.9)
    kit.mel('accordion', bar0, mel, shift=shift, vel=vel - 22, octave=-1, legato=.9)
    kit.strum(bar0, chords, shift=shift, vel=72, style='jig')
    kit.bass(bar0, chords, shift=shift, vel=94, style='jig')
    kit.drums(bar0, 8, style='jig', level=1.05)
    bell(bar0, 8, every=4, shift=shift)
    if full:
        kit.mel('glock', bar0, mel, shift=shift, vel=vel - 36, octave=1, legato=.7)
        heyho(bar0, (3, 7), chords, shift=shift)
    return chords

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Wellen, Glocke, die Pfeife stellt das Leitmotiv „Freunde“ vor, die Gitarre fällt im Jig ein ──────────────────
waves(b, 4, vel=44)
bell(b, 4, every=2, vel=58)
t0 = song.bar(b + 2)
for off, d in LEITMOTIVE['freunde']:
    song.add('whistle', t0, d * .92, pn('D5') + off, hv(92)); t0 += d
kit.strum(b + 1, ['D', 'D', 'C'], vel=62, style='jig')
kit.bass(b + 1, ['D', 'D', 'C'], vel=86, style='jig')
kit.drums(b + 2, 2, style='jig', level=0.9, fills=False, crash=False)
b += 4

# ── Refrain (8): der Ohrwurm — Pfeife, Fiedel, Akkordeon (tiefer), Gitarre, Rahmentrommel; offen auf A ─────────────────────────
refrain(b, end_open=True)
waves(b, 8, vel=34)
b += 8

# ── Strophe (8): das Akkordeon erzählt in großen Bögen, die Fiedel antwortet in Terzen ───────────────────────────────────
kit.mel('accordion', b, VERSE, vel=88, legato=.95)
kit.mel('violin', b, VERSE, vel=66, harm=-2, legato=.95)
kit.strum(b, V_CH, vel=66, style='jig')
kit.bass(b, V_CH, vel=90, style='jig')
kit.drums(b, 8, style='jig', level=0.95)
kit.arp(b, V_CH, vel=38, inst='harp', steps=6, step=T3, pattern=(0, 2, 4, 3, 4, 2))
b += 8

# ── Refrain (8): geschlossen auf D, Hey-ho in Takt 4 und 8 ──────────────────────────────────────────────────────────────
refrain(b, full=True)
b += 8

# ── Bridge — die Nachtwache (8): lange Fiedel-Töne, Pfeife darüber, Harfe, Wellen; leiser Jig ─────────────────────────────────
kit.mel('violin', b, BRIDGE, vel=86, legato=1.0)
kit.mel('whistle', b, BRIDGE, vel=60, octave=1, legato=1.0, delay=0.0)
kit.mel('accordion', b, BRIDGE, vel=54, octave=-1, legato=1.0)
kit.strum(b, BR_CH, vel=52, style='jig')
kit.bass(b, BR_CH, vel=80, style='jig')
kit.arp(b, BR_CH, vel=48, inst='harp', steps=6, step=T3, pattern=(0, 2, 4, 3, 4, 2))
kit.drums(b, 8, style='jig', level=0.7, fills=False)
waves(b, 8, vel=46)
bell(b, 8, every=2, vel=56)
kit.roll(b + 7, 0.5, 2, 44, 100)
b += 8

# ── Strophe voll (8): Akkordeon + Fiedel + Pfeife zusammen, Gitarre und Trommel kräftiger ───────────────────────────────────────
kit.mel('accordion', b, VERSE, vel=94, legato=.95)
kit.mel('violin', b, VERSE, vel=80, legato=.95, octave=0)
kit.mel('whistle', b, VERSE, vel=70, octave=1, legato=.9)
kit.strum(b, V_CH, vel=74, style='jig')
kit.bass(b, V_CH, vel=96, style='jig')
kit.drums(b, 8, style='jig', level=1.1)
kit.arp(b, V_CH, vel=44, inst='harp', steps=6, step=T3, pattern=(0, 2, 4, 3, 4, 2))
bell(b, 8, every=4, vel=62)
b += 8

# ── Hey-ho (8): Mannschaft singt — Gang-Rufe auf jedem Takt, der Refrain in Fiedel und Pfeife, volle Trommel ─────────────────────
kit.mel('violin', b, HOOK[:7] + [HOOK[7]], vel=90, octave=1, legato=.85)
kit.mel('whistle', b, HOOK[:7] + [HOOK[7]], vel=80, legato=.85)
kit.mel('accordion', b, HOOK[:7] + [HOOK[7]], vel=72, octave=-1, legato=.85)
kit.strum(b, A_CH, vel=78, style='jig')
kit.bass(b, A_CH, vel=98, style='jig')
kit.drums(b, 8, style='jig', level=1.15)
heyho(b, range(8), A_CH, vel=92)
bell(b, 8, every=2, vel=64)
b += 8

# ── Refrain +2 (8): E-Dur — alles, die Schiffsglocke, das Glockenspiel, Hey-ho; Ganzschluss ────────────────────────────────────
refrain(b, shift=2, vel=100, full=True)
heyho(b, (0, 2, 4, 6), A_CH, shift=2, vel=96)
b += 8

# ── Outro (4): A (Dominante zur D-Dur-Intro) — das Leitmotiv „Freunde“ in der Fiedel, Glocke, Wellen verebben ─────────────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('violin', t0, d * .92, pn('A4') + off, hv(90)); t0 += d
kit.strum(b, ['A', 'A', 'A'], vel=66, style='jig')
kit.bass(b, ['A', 'A', 'A'], vel=84, style='jig')
kit.drums(b, 3, style='jig', level=0.85, fills=False, crash=False)
bell(b, 4, every=2, vel=60)
kit.glide('sweep', song.bar(b + 1), 6.0, pn('A4'), 44, 4.0, -8.0, steps=24)
song.dr(song.bar(b + 3), CLAP, 100, 0.12); song.dr(song.bar(b + 3) + 1, CLAP, 100, 0.12)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_schiffsdeck.ogg')
    song.render(sf2, out, target_rms=0.25, saturate=False, compress=True, air_cut=0.0)
