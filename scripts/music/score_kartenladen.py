# -*- coding: utf-8 -*-
"""Kampagnen-Score · Kartenladen / Shop-Interface → public/music/bgm_score_kartenladen.ogg                  Titel: „Treasure Browser“

Ein Kartenladen und die Shop-Oberfläche: stöbern, staunen, Schätze entdecken, ohne Hast. Dieser Track läuft lange im Hintergrund eines Menüs, darum bleibt er **unaufdringlich**: wenige Stimmen, keine harten
Akzente, ein sanfter Puls, eine einprägsame, aber leise Melodie. Es-Dur, 96 BPM, 4/4. Harfe, Glockenspiel/Spieluhr und Marimba plaudern leise miteinander, Flöte und Streicher breiten Wärme aus,
ein weicher Kontrabass, ein Hauch Percussion (Shaker, Rimshot); an Abschnittsgrenzen glitzert eine kleine „Münz“-Geste (zwei Glockenspielnoten) — ein leises Kassenklingeln.

  • **Ohrwurm** (A): ein freundliches Auf und Ab („G–B♭–G–F–E♭“, dann Sprung) über Es – Cm – As – B♭ | Es – Gm – As – B♭, zweimal leicht variiert; leise genug für Stunden im Menü, markant genug, um hängenzubleiben.
  • **B**: dieselbe Gestalt auf As – Es – Fm – B♭, die Marimba spielt Vorhaltsketten wie Karten, die man durchblättert.
  • **Bridge**: nur Harfe und Spieluhr — die Vitrine mit den seltenen Karten.
  • Leitmotiv „Freunde“ (Do–Re–Mi–Sol–La–Sol) als Spieluhr-Intro und im Outro.
Form (36 Takte ≈ 1:30): Intro 4 · A 8 · B 8 · A' 8 · Bridge 4 · Outro 4
Ausklang auf B♭ (Dominante) → zurück in die Es-Dur-Intro.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE
from score_kit import Kit

BPM, BARS = 96, 36
song = Song(BPM, BARS)
CH = {'Eb': (3, 'M'), 'Cm': (0, 'm'), 'Ab': (8, 'M'), 'Bb': (10, 'M'), 'Gm': (7, 'm'), 'Fm': (5, 'm')}
kit = Kit(song, CH, seed=1818, tonic_pc=3)
hv, rng = kit.hv, kit.rng

song.inst('harp', 'harp', vol=80, pan=34)
song.inst('glock', 'glock', vol=72, pan=88)
song.inst('marimba', 'marimba', vol=74, pan=46)
song.inst('flute', 'flute', vol=66, pan=78)
song.inst('guitar', 'guitar', vol=58, pan=22)
song.inst('bass', 'acbass', vol=78, pan=62)
song.inst('strings', 'slowstr', vol=42, pan=62)
song.inst('oohs', 'oohs', vol=42, pan=70)
song.inst('pizz', 'pizz', vol=58, pan=30)
song.inst('vibes', 'vibes', vol=60, pan=70)

A_CH = ['Eb', 'Cm', 'Ab', 'Bb', 'Eb', 'Gm', 'Ab', 'Bb']
A_MEL = [
    [('G5', 1), ('Bb5', 1), ('G5', .5), ('F5', .5), ('Eb5', 1)],
    [('Eb5', 1), ('G5', 1), ('C6', 2)],
    [('C6', 1), ('Eb6', 1), ('C6', .5), ('Bb5', .5), ('Ab5', 1)],
    [('Bb5', 2), ('D6', 1), ('F6', 1)],
    [('G5', 1), ('Bb5', 1), ('Eb6', 2)],
    [('D6', 1), ('Bb5', 1), ('G5', 2)],
    [('Ab5', 1), ('C6', 1), ('Eb6', 1), ('C6', 1)],
    [('D6', 2), ('Bb5', 2)],
]
A_CLOSE = A_MEL[:7] + [[('Bb5', 1), ('G5', 1), ('Eb5', 2)]]
A_CH_CLOSE = A_CH[:7] + ['Eb']
B_CH = ['Ab', 'Eb', 'Fm', 'Bb', 'Ab', 'Eb', 'Fm', 'Bb']
B_MEL = [
    [('C6', 2), ('Eb6', 2)], [('G5', 2), ('Bb5', 2)], [('F5', 1), ('Ab5', 1), ('C6', 2)], [('Bb5', 2), ('D6', 2)],
    [('C6', 1), ('Eb6', 1), ('Ab6', 2)], [('G6', 1.5), ('Eb6', .5), ('Bb5', 2)], [('Ab5', 1), ('C6', 1), ('F6', 2)], [('D6', 3), (None, 1)],
]
BR_CH = ['Ab', 'Eb', 'Fm', 'Bb']
BR_MEL = [[('Eb6', 2), ('C6', 2)], [('Bb5', 2), ('G5', 2)], [('Ab5', 2), ('C6', 2)], [('D6', 3), (None, 1)]]

def pulse(bar0, chords, vel=46):
    """Sanfter Puls: Shaker auf Achteln, ein Rimshot auf 4, Bass auf 1 und 3."""
    for k, ch in enumerate(chords):
        t = song.bar(bar0 + k)
        for i in range(8): song.dr(t + i * 0.5, HAT, int((vel + 10) if i % 2 else vel), 0.05)
        song.dr(t + 3, SIDESTICK, int(vel + 14), 0.1)

def pizz_walk(bar0, chords, vel=54):
    for k, ch in enumerate(chords):
        T = kit.tones(ch, 4)
        t = song.bar(bar0 + k)
        for i, m in enumerate((T[0], T[2], T[1], T[2])): song.add('pizz', t + i, 0.2, m + (12 if i % 2 else 0), hv(vel + (6 if i == 0 else 0)))

def coin(beat, shift=0, vel=70):
    """Kleines Kassenklingeln: zwei Glockenspielnoten (Quinte aufwärts)."""
    song.add('glock', beat, 0.35, pn('Bb6') + shift, vel); song.add('glock', beat + 0.25, 0.6, pn('Eb7') + shift, vel + 4)

def sparkle(bar0, nbars, vel=46):
    for k in range(nbars):
        if k % 2 == 1:
            song.add('glock', song.bar(bar0 + k) + rng.choice((0.5, 1.5, 2.5, 3.5)), 0.4, pn(rng.choice(('G6', 'Bb6', 'Eb7', 'C7', 'D7'))), hv(vel))

b = 0
# ── Intro (4): die Spieluhr stellt das Leitmotiv „Freunde“ vor, Harfenperlen, ein Münzklingeln — der Laden öffnet ─────────────────────────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('glock', t0, d * .8, pn('Eb6') + off, hv(70)); t0 += d
kit.arp(b, ['Eb', 'Eb', 'Cm', 'Bb'], vel=44, inst='harp', steps=8, step=0.5, pattern=(0, 2, 4, 3, 4, 2, 0, 2))
kit.bass(b + 1, ['Eb', 'Cm', 'Bb'], vel=62, style='half')
pulse(b + 2, ['Eb', 'Bb'], vel=40)
coin(song.bar(b + 3) + 2.0)
b += 4

# ── A (8): die freundliche Melodie in Marimba und Harfe, Flöte darüber leise, Pizzicato-Gang, sanfter Puls ─────────────────────────────────────
kit.mel('marimba', b, A_MEL, vel=76, legato=.6)
kit.mel('harp', b, A_MEL, vel=54, octave=1, legato=.9)
kit.mel('flute', b, A_MEL, vel=46, octave=1, legato=.95)
kit.arp(b, A_CH, vel=40, inst='guitar', steps=8, step=0.5, pattern=(0, 2, 4, 3, 4, 2, 0, 2))
kit.bass(b, A_CH, vel=74, style='half')
pizz_walk(b, A_CH, vel=44)
pulse(b, A_CH)
kit.pad(b, A_CH, vel=28, inst='strings')
sparkle(b, 8)
coin(song.bar(b + 7) + 2.0, vel=60)
b += 8

# ── B (8): Karten durchblättern — Marimba-Vorhaltsketten, Flöte singt, Vibraphon glänzt ─────────────────────────────────────────────────────────
kit.mel('flute', b, B_MEL, vel=70, legato=1.0)
kit.mel('marimba', b, B_MEL, vel=62, octave=0, legato=.5, harm=-2)
kit.mel('vibes', b, B_MEL, vel=48, octave=1, legato=.8)
kit.arp(b, B_CH, vel=46, inst='harp', steps=8, step=0.5, pattern=(0, 2, 4, 3, 4, 2, 0, 2))
kit.bass(b, B_CH, vel=74, style='half')
pizz_walk(b, B_CH, vel=40)
pulse(b, B_CH)
kit.pad(b, B_CH, vel=32, inst='strings')
sparkle(b, 8, vel=44)
coin(song.bar(b + 7) + 2.0, vel=60)
b += 8

# ── A' (8): Marimba + Flöte in Oktaven, Oohs summen, Streicher breiter; geschlossen auf Es ────────────────────────────────────────────────────────
kit.mel('marimba', b, A_CLOSE, vel=78, legato=.6)
kit.mel('flute', b, A_CLOSE, vel=56, octave=1, legato=.95)
kit.mel('harp', b, A_CLOSE, vel=52, octave=1, legato=.9)
kit.mel('oohs', b, A_CLOSE, vel=40, legato=1.0)
kit.arp(b, A_CH_CLOSE, vel=44, inst='guitar', steps=8, step=0.5, pattern=(0, 2, 4, 3, 4, 2, 0, 2))
kit.bass(b, A_CH_CLOSE, vel=76, style='half')
pizz_walk(b, A_CH_CLOSE, vel=46)
pulse(b, A_CH_CLOSE, vel=48)
kit.pad(b, A_CH_CLOSE, vel=34, inst='strings')
sparkle(b, 8, vel=48)
b += 8

# ── Bridge (4): die Vitrine mit den seltenen Karten — nur Harfe und Spieluhr, ein langer Ton in der Flöte ─────────────────────────────────────────
kit.mel('glock', b, BR_MEL, vel=64, legato=1.0)
kit.mel('flute', b, BR_MEL, vel=46, octave=0, legato=1.0, harm=-2)
kit.arp(b, BR_CH, vel=46, inst='harp', steps=8, step=0.5, pattern=(0, 2, 4, 5, 4, 2, 4, 2))
kit.bass(b, BR_CH, vel=64, style='half')
kit.pad(b, BR_CH, vel=30, inst='strings')
coin(song.bar(b + 3) + 2.0, vel=66)
b += 4

# ── Outro (4): B♭ (Dominante zur Es-Dur-Intro) — das Leitmotiv „Freunde“ in der Flöte, ein letztes Münzklingeln ─────────────────────────────────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('flute', t0, d * .95, pn('Bb4') + off, hv(60)); t0 += d
kit.arp(b, ['Bb', 'Bb', 'Bb'], vel=40, inst='harp', steps=8, step=0.5, pattern=(0, 2, 4, 3, 4, 2, 0, 2))
kit.bass(b, ['Bb', 'Bb', 'Bb'], vel=62, style='half')
pulse(b, ['Bb', 'Bb', 'Bb'], vel=36)
coin(song.bar(b + 3) + 1.0, vel=64)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_kartenladen.ogg')
    song.render(sf2, out, target_rms=0.2, saturate=False, compress=True, air_cut=0.0)
