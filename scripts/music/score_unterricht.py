# -*- coding: utf-8 -*-
"""Kampagnen-Score · Unterrichtsstunde → public/music/bgm_score_unterricht.ogg                    Titel: „Class Is in Session“

Eine Unterrichtsstunde: wach, neugierig, ein bisschen verspielt — ein Raum, in dem etwas gelernt wird. Konzept: **Frage und Antwort**. Die Klarinette ist die Lehrkraft (ruft eine Frage), das Marimba
sind die Schüler (antworten, erst zögerlich, dann sicher). F-Dur, 104 BPM, 4/4. Pizzicato tickt wie eine Wanduhr, Fagott und Kontrabass gehen ruhig voran, Klavier und Glockenspiel (Schulklingel) setzen Akzente.

  • **Ohrwurm** (A): „Wer-weiß-die-Ant-wort?“ — vier Achtel und eine lange Note als Frage (Klarinette), dieselbe Form als Antwort einen Schritt höher (Marimba); jede zweite Frage steigt.
  • **B** (Konzentration): fließende Achtel in Moll-Färbung (Gm – C – F – Dm), die Flöte übernimmt, alle arbeiten.
  • **C** (Tagtraum): die Uhr wird langsam, die Harfe perlt, lange Flötentöne — draußen scheint die Sonne; die Aufmerksamkeit wandert.
  • Leitmotiv „Freunde“ in der Klingel der Intro und im Outro (Flöte).
Form (48 Takte ≈ 1:50): Intro 4 · A 8 · B 8 · A' 8 · C 8 · A'' 8 · Outro 4
Ausklang auf C (Dominante) → zurück in die F-Dur-Intro.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE
from score_kit import Kit, T3

BPM, BARS = 104, 48
song = Song(BPM, BARS)
CH = {'F': (5, 'M'), 'Dm': (2, 'm'), 'Bb': (10, 'M'), 'C': (0, 'M'), 'Gm': (7, 'm'), 'Am': (9, 'm')}
kit = Kit(song, CH, seed=2024, tonic_pc=5)
hv, rng = kit.hv, kit.rng

song.inst('clarinet', 'clarinet', vol=88, pan=42)        # die Lehrkraft
song.inst('marimba', 'marimba', vol=86, pan=78)          # die Schüler
song.inst('flute', 'flute', vol=82, pan=84)
song.inst('pizz', 'pizz', vol=78, pan=28)                # Wanduhr
song.inst('piano', 'piano', vol=70, pan=50)
song.inst('bassoon', 'bassoon', vol=74, pan=56)
song.inst('bass', 'acbass', vol=90, pan=62)
song.inst('glock', 'glock', vol=70, pan=90)              # Klingel
song.inst('harp', 'harp', vol=74, pan=36)
song.inst('strings', 'slowstr', vol=60, pan=66)
song.inst('guitar', 'guitar', vol=66, pan=22)
song.inst('oohs', 'oohs', vol=60, pan=70)
song.inst('xylo', 'xylo', vol=64, pan=72)

# ═══ Material (F-Dur) ═════════════════════════════════════════════════════════════════════════════
A_CH = ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C']
A_CALL = [   # Frage (Klarinette) / Antwort (Marimba), abwechselnd je ein Takt
    [('A4', .5), ('A4', .5), ('C5', .5), ('A4', .5), ('F5', 1.5), (None, .5)],
    [(None, .5), ('D5', .5), ('F5', .5), ('A5', .5), ('G5', 1), ('F5', 1)],
    [('Bb4', .5), ('Bb4', .5), ('D5', .5), ('Bb4', .5), ('G5', 1.5), (None, .5)],
    [(None, .5), ('E5', .5), ('G5', .5), ('Bb5', .5), ('A5', 1), ('G5', 1)],
    [('A4', .5), ('A4', .5), ('C5', .5), ('A4', .5), ('F5', 1.5), (None, .5)],
    [(None, .5), ('D5', .5), ('F5', .5), ('A5', .5), ('D6', 2)],
    [('D5', .5), ('D5', .5), ('F5', .5), ('D5', .5), ('Bb5', 1), ('A5', 1)],
    [('G5', 1), ('E5', 1), ('C5', 2)],
]
B_CH = ['Gm', 'C', 'F', 'Dm', 'Gm', 'C', 'F', 'C']
B_MEL = [
    [('G5', .5), ('F5', .5), ('G5', .5), ('A5', .5), ('Bb5', 2)],
    [('A5', .5), ('G5', .5), ('A5', .5), ('Bb5', .5), ('C6', 2)],
    [('A5', .5), ('G5', .5), ('F5', .5), ('A5', .5), ('C6', 2)],
    [('D6', 1), ('C6', 1), ('A5', 2)],
    [('G5', .5), ('F5', .5), ('G5', .5), ('A5', .5), ('Bb5', 2)],
    [('C6', .5), ('Bb5', .5), ('A5', .5), ('G5', .5), ('E5', 2)],
    [('F5', .5), ('A5', .5), ('C6', .5), ('F6', .5), ('E6', 1), ('D6', 1)],
    [('C6', 2), ('G5', 2)],
]
C_CH = ['Bb', 'F', 'Gm', 'C', 'Bb', 'F', 'Gm', 'C']
C_MEL = [[('D6', 4)], [('C6', 4)], [('Bb5', 2), ('A5', 2)], [('G5', 3), (None, 1)],
         [('F6', 4)], [('E6', 2), ('C6', 2)], [('D6', 2), ('Bb5', 2)], [('C6', 3), (None, 1)]]

# ═══ Bausteine ═══════════════════════════════════════════════════════════════════════════════════
def clock(bar0, nbars, vel=62, slow=False):
    """Wanduhr: Pizzicato auf jeder Zählzeit (Tick hoch, Tack tief); slow: nur auf 1 und 3."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        for i in range(4):
            if slow and i % 2: continue
            song.add('pizz', t + i, 0.15, pn('C6') if i % 2 == 0 else pn('G5'), hv(vel + (8 if i % 2 == 0 else 0)))

def a_section(bar0, vel=90, full=False, shift=0):
    for k in range(8):
        inst = 'clarinet' if k % 2 == 0 else 'marimba'
        kit.mel(inst, bar0 + k, [A_CALL[k]], shift=shift, vel=vel if inst == 'clarinet' else vel - 2, legato=.9 if inst == 'clarinet' else .55)
    kit.bass(bar0, A_CH, shift=shift, vel=88, style='walk')
    kit.piano(bar0, A_CH, shift=shift, vel=52, style='offbeat')
    clock(bar0, 8, vel=58)
    kit.drums(bar0, 8, style='light', level=0.85)
    if full:
        kit.mel('flute', bar0, A_CALL, shift=shift, vel=66, octave=1, legato=.7)
        kit.strum(bar0, A_CH, shift=shift, vel=56, style='light')
        kit.pad(bar0, A_CH, shift=shift, vel=38, inst='strings')
        kit.mel('xylo', bar0, [A_CALL[k] if k % 2 else [(None, 4)] for k in range(8)], shift=shift, vel=60, octave=1, legato=.5)
    bassoon_line(bar0, A_CH, shift)

def bassoon_line(bar0, chords, shift=0, vel=66):
    for k, ch in enumerate(chords):
        T = kit.tones(ch, 3, shift)
        t = song.bar(bar0 + k)
        for i, m in enumerate((T[0], T[2], T[1], T[2])): song.add('bassoon', t + i, 0.9, m, hv(vel + (6 if i == 0 else 0)))

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): die Klingel (Leitmotiv „Freunde“ im Glockenspiel), die Uhr beginnt zu ticken, Klavier und Fagott setzen ein ───────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('glock', t0, d * .92, pn('F5') + off, hv(84)); t0 += d
song.add('glock', song.bar(b + 1), 3.0, pn('F6'), 66)
clock(b + 1, 3, vel=54)
kit.piano(b + 2, ['F', 'C'], vel=50, style='block')
kit.bass(b + 2, ['F', 'C'], vel=82, style='half')
bassoon_line(b + 2, ['F', 'C'])
kit.drums(b + 2, 2, style='soft', level=0.8, fills=False)
b += 4

# ── A (8): Frage (Klarinette) und Antwort (Marimba) im Wechsel ─────────────────────────────────────────────────────
a_section(b)
b += 8

# ── B (8): Konzentration — Flöte trägt fließende Achtel, Klarinette begleitet in Terzen, Klavier arbeitet ─────────────────
kit.mel('flute', b, B_MEL, vel=86, octave=0, legato=.92)
kit.mel('clarinet', b, B_MEL, vel=66, harm=-2, legato=.92)
kit.mel('marimba', b, B_MEL, vel=62, octave=1, legato=.5)
kit.bass(b, B_CH, vel=90, style='walk')
kit.piano(b, B_CH, vel=58, style='ballad')
clock(b, 8, vel=60)
kit.drums(b, 8, style='folk', level=0.85)
kit.strum(b, B_CH, vel=58, style='folk')
bassoon_line(b, B_CH)
kit.sparkle(b, 8, vel=44, notes=('F6', 'A6', 'C7', 'G6', 'D6'), per_bar=1)
b += 8

# ── A' (8): Klavier und Streicher dazu, die „Schüler“ sicher; Flöte verdoppelt oben ────────────────────────────────────
a_section(b, vel=94, full=True)
b += 8

# ── C (8): Tagtraum — die Uhr wird langsam, die Harfe perlt, lange Flötentöne, Oohs; draußen scheint die Sonne ──────────────────
kit.mel('flute', b, C_MEL, vel=82, legato=1.0)
kit.mel('oohs', b, C_MEL, vel=54, octave=0, legato=1.0, harm=-2)
kit.arp(b, C_CH, vel=56, inst='harp', steps=8, step=0.5, pattern=(0, 2, 4, 5, 4, 2, 4, 2))
kit.pad(b, C_CH, vel=42, inst='strings')
kit.bass(b, C_CH, vel=78, style='half')
clock(b, 8, vel=44, slow=True)
kit.piano(b, C_CH, vel=44, style='block')
kit.drums(b, 8, style='soft', level=0.8)
kit.sparkle(b, 8, vel=50, notes=('F6', 'A6', 'C7', 'G6', 'D6'), per_bar=2)
b += 8

# ── A'' (8): zurück zur Aufgabe — alle, die Schüler antworten lauter, das Xylophon hüpft; geschlossen ──────────────────────────
a_section(b, vel=98, full=True)
kit.roll(b + 7, 2, 4, 44, 100)
b += 8

# ── Outro (4): C (Dominante zur F-Dur-Intro) — das Leitmotiv „Freunde“ in der Flöte, Klingel ─────────────────────────────────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('flute', t0, d * .92, pn('C5') + off, hv(86)); t0 += d
clock(b, 3, vel=54)
kit.piano(b, ['C', 'C'], vel=50, style='block')
kit.bass(b, ['C', 'C'], vel=80, style='half')
bassoon_line(b, ['C', 'C'])
kit.drums(b, 3, style='soft', level=0.8, fills=False)
song.add('glock', song.bar(b + 3), 1.5, pn('C6'), 70); song.add('glock', song.bar(b + 3) + 2, 1.5, pn('G6'), 74)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_unterricht.ogg')
    song.render(sf2, out, target_rms=0.24, saturate=False, compress=True, air_cut=0.0)
