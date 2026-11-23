# -*- coding: utf-8 -*-
"""Kampagnen-Score · Plaza → public/music/bgm_score_plaza.ogg                             Titel: „Sunday at the Fountain“

Eine Plaza: ein weiter Stadtplatz mit Brunnen, Tauben, Straßenmusikern, Menschen, die sich treffen; offen, festlich, ein wenig südländisch. A-Dur (mit mixolydischem G), 112 BPM, 4/4:
Trompete (offen, hell) ruft, Akkordeon antwortet, Nylon-Gitarre im Bossa-Wechselschlag, gezupfte Clean-Gitarre, Kontrabass, Hand-Trommeln und Tamburin; Glockenspiel und Harfe wie Wasserperlen des Brunnens.

  • **Ohrwurm** (A): ein Fanfaren-Ruf („E–E–A–Cis–H“) der Trompete über A – E – Fis-Moll – D | A – E – D – E; das Akkordeon antwortet in der Terz darunter; kurz, hell, öffentlich — man singt ihn mit, ohne es zu merken.
  • **B** (Straßenmusiker): synkopierte Flöten-/Akkordeon-Linie über Fis-Moll – D – A – E (zweimal), das Publikum klatscht.
  • **C** (Gitarrensolo): ruhiger Mittelteil, Akkordeon trägt, Clean-Gitarre perlt; **Finale** einen Ganzton höher (H-Dur), alles gemeinsam.
  • Leitmotiv „Freunde“ (Do–Re–Mi–Sol–La–Sol) als Trompetenfanfare der Intro und im Outro (Flöte).
Form (48 Takte ≈ 1:42): Intro 4 · A 8 · B 8 · A' 8 · C 8 · A'' +2 8 · Outro 4
Ausklang auf E (Dominante) → zurück in die A-Dur-Intro.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE
from score_kit import Kit

BPM, BARS = 112, 48
song = Song(BPM, BARS)
CH = {'A': (9, 'M'), 'E': (4, 'M'), 'F#m': (6, 'm'), 'D': (2, 'M'), 'Bm': (11, 'm')}
kit = Kit(song, CH, seed=1492, tonic_pc=9)
hv, rng = kit.hv, kit.rng

song.inst('trumpet', 'trumpet', vol=86, pan=60)
song.inst('accordion', 'accordion', vol=78, pan=42)
song.inst('flute', 'flute', vol=76, pan=84)
song.inst('guitar', 'guitar', vol=80, pan=24)
song.inst('cleangtr', 'cleangtr', vol=62, pan=96)
song.inst('bass', 'acbass', vol=94, pan=62)
song.inst('pizz', 'pizz', vol=64, pan=34)
song.inst('glock', 'glock', vol=60, pan=90)
song.inst('harp', 'harp', vol=70, pan=36)
song.inst('oohs', 'oohs', vol=56, pan=70)
song.inst('horn', 'horns', vol=60, pan=52)
song.inst('violin', 'violin', vol=68, pan=76)

A_CH = ['A', 'E', 'F#m', 'D', 'A', 'E', 'D', 'E']
A_MEL = [
    [('E5', .5), ('E5', .5), ('A5', 1), ('C#6', 1), ('B5', 1)],
    [('B5', .5), ('B5', .5), ('G#5', 1), ('E5', 1), ('G#5', 1)],
    [('A5', .5), ('A5', .5), ('C#6', 1), ('F#6', 1), ('E6', 1)],
    [('D6', 1), ('C#6', 1), ('B5', 1), ('A5', 1)],
    [('E5', .5), ('E5', .5), ('A5', 1), ('C#6', 1), ('E6', 1)],
    [('D6', .5), ('D6', .5), ('B5', 1), ('G#5', 1), ('B5', 1)],
    [('A5', 1), ('D6', 1), ('F#6', 1), ('E6', 1)],
    [('B5', 2), ('G#5', 1), ('E5', 1)],
]
A_CLOSE = A_MEL[:7] + [[('A5', 3), (None, 1)]]
A_CH_CLOSE = A_CH[:7] + ['A']
B_CH = ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'A', 'E']
B_MEL = [
    [('C#6', 1.5), ('A5', .5), ('F#5', 2)], [('D6', 1.5), ('B5', .5), ('A5', 2)], [('C#6', 1), ('E6', 1), ('A6', 2)], [('G#6', 2), ('E6', 2)],
    [('C#6', 1.5), ('A5', .5), ('F#5', 2)], [('D6', 1.5), ('F#6', .5), ('A6', 2)], [('E6', 1), ('C#6', 1), ('A5', 2)], [('B5', 3), (None, 1)],
]
C_CH = ['D', 'A', 'Bm', 'E', 'D', 'A', 'E', 'E']
C_MEL = [[('F#5', 2), ('A5', 2)], [('E5', 2), ('A5', 2)], [('D5', 2), ('F#5', 2)], [('G#5', 3), (None, 1)],
         [('A5', 2), ('D6', 2)], [('C#6', 2), ('E6', 2)], [('B5', 2), ('D6', 2)], [('B5', 3), (None, 1)]]

def fountain(bar0, nbars, shift=0, vel=52):
    """Brunnen: Harfen-/Glockenspiel-Wasserperlen (A-Dur-Pentatonik), zufällig und leise."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        for _ in range(3):
            song.add(rng.choice(('harp', 'glock')), t + rng.choice((0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75)), 0.5,
                     pn(rng.choice(('A6', 'B6', 'C#7', 'E7', 'F#6', 'E6'))) + shift, hv(vel))

def a_section(bar0, shift=0, vel=92, closed=False, full=False):
    mel = A_CLOSE if closed else A_MEL
    ch = A_CH_CLOSE if closed else A_CH
    kit.mel('trumpet', bar0, mel, shift=shift, vel=vel, legato=.85)
    kit.mel('accordion', bar0, mel, shift=shift, vel=vel - 18, harm=-2, legato=.85)
    kit.strum(bar0, ch, shift=shift, vel=72, style='bossa')
    kit.bass(bar0, ch, shift=shift, vel=92, style='bossa')
    kit.drums(bar0, 8, style='bossa', level=1.05)
    fountain(bar0, 8, shift=shift, vel=46)
    if full:
        kit.mel('flute', bar0, mel, shift=shift, vel=vel - 24, octave=1, legato=.8)
        kit.mel('horn', bar0, mel, shift=shift, vel=vel - 32, octave=-1, legato=.85)
        kit.arp(bar0, ch, shift=shift, vel=50, inst='cleangtr', steps=8, step=0.5)
        kit.mel('oohs', bar0, mel, shift=shift, vel=50)

def clap_crowd(bar0, nbars, level=1.0):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        for beat in (1, 3): song.dr(t + beat, CLAP, int(96 * level), 0.12)

b = 0
# ── Intro (4): Brunnen plätschert, die Trompete ruft das Leitmotiv „Freunde“ wie eine Fanfare, Gitarre und Hand-Trommel fallen ein ──────────
fountain(b, 4, vel=52)
t0 = song.bar(b + 1)
for off, d in LEITMOTIVE['freunde']:
    song.add('trumpet', t0, d * .9, pn('A4') + off, hv(90)); t0 += d
kit.strum(b + 2, ['D', 'E'], vel=66, style='bossa')
kit.bass(b + 2, ['D', 'E'], vel=84, style='bossa')
kit.drums(b + 2, 2, style='bossa', level=0.85, fills=False)
b += 4

# ── A (8): der Fanfaren-Ohrwurm — Trompete ruft, Akkordeon antwortet in der Terz, Bossa-Gitarre ─────────────────────────────────────────────────
a_section(b)
b += 8

# ── B (8): Straßenmusiker — Flöte und Akkordeon, synkopiert; das Publikum klatscht ────────────────────────────────────────────────────────────
kit.mel('flute', b, B_MEL, vel=86, legato=.9)
kit.mel('accordion', b, B_MEL, vel=70, harm=-2, legato=.9)
kit.mel('violin', b, B_MEL, vel=52, octave=0, legato=.9)
kit.strum(b, B_CH, vel=72, style='calypso')
kit.bass(b, B_CH, vel=92, style='push')
kit.drums(b, 8, style='calypso', level=1.0)
clap_crowd(b, 8, 0.8)
kit.arp(b, B_CH, vel=48, inst='cleangtr', steps=8, step=0.5)
fountain(b, 8, vel=44)
b += 8

# ── A' (8): voll — Flöte, Horn, Oohs, Clean-Gitarre; geschlossen auf A ─────────────────────────────────────────────────────────────────────────
a_section(b, vel=96, closed=True, full=True)
b += 8

# ── C (8): Gitarrensolo — ruhiger Mittelteil; Akkordeon trägt, Clean-Gitarre perlt, der Brunnen im Vordergrund ──────────────────────────────────────
kit.mel('accordion', b, C_MEL, vel=78, legato=1.0)
kit.mel('guitar', b, C_MEL, vel=64, octave=1, legato=.9)
kit.mel('oohs', b, C_MEL, vel=48, legato=1.0, harm=-2)
kit.arp(b, C_CH, vel=54, inst='cleangtr', steps=8, step=0.5, pattern=(0, 2, 4, 3, 4, 2, 0, 2))
kit.bass(b, C_CH, vel=84, style='half')
kit.strum(b, C_CH, vel=54, style='light')
kit.drums(b, 8, style='soft', level=0.85)
kit.pad(b, C_CH, vel=34, inst='violin')
fountain(b, 8, vel=54)
kit.roll(b + 7, 2, 4, 40, 100)
b += 8

# ── A'' +2 (8): H-Dur — alles gemeinsam; Trompete hoch, Horn, Flöte, Oohs, Klatschen; Ganzschluss ───────────────────────────────────────────────
a_section(b, shift=2, vel=102, closed=True, full=True)
clap_crowd(b, 8, 0.9)
b += 8

# ── Outro (4): E (Dominante zur A-Dur-Intro) — Leitmotiv „Freunde“ in der Flöte; Brunnen ─────────────────────────────────────────────────────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('flute', t0, d * .92, pn('E5') + off, hv(84)); t0 += d
kit.strum(b, ['E', 'E', 'E'], vel=62, style='light')
kit.bass(b, ['E', 'E', 'E'], vel=80, style='half')
kit.drums(b, 3, style='soft', level=0.8)
fountain(b, 4, vel=56)
song.dr(song.bar(b + 3) + 2.0, CLAP, 96, 0.12); song.dr(song.bar(b + 3) + 3.0, CLAP, 100, 0.12)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_plaza.ogg')
    song.render(sf2, out, target_rms=0.24, saturate=False, compress=True, air_cut=0.0)
