# -*- coding: utf-8 -*-
"""Werkzeugkasten für die Kampagnen-Score-Tracks (siehe score_common.py für die Regeln).

`Kit(song, chord_table, seed)` bündelt die wiederkehrenden Begleit-Bausteine, damit jeder Track nur noch Melodie, Akkorde und Arrangement festlegt:
Melodie-Setzen mit Terz-Harmonien/Verzögerung (Kanon), Basslinien, Gitarren-/Klavier-Begleitmuster, Pads, Schlagzeug-Stile (Folk, Swing, Walzer, Bossa, Calypso, Jig, Polka, Lo-Fi, Ballade),
Wirbel, Glitzer, Läufe. Takte werden über `song.bar(n)` und `song.bpb` (Schläge je Takt) gezählt; Rhythmen sind für 4/4, 3/4, 2/4 und 6/8 (als 2 Schläge mit je drei Triolen) definiert.
"""
import random
from lib import *
from score_common import pn, make_tones, make_hv, scale_step

T3 = 1.0 / 3.0

class Kit:
    def __init__(self, song, chord_table, seed=1, tonic_pc=0):
        self.song, self.tones, self.tonic_pc = song, make_tones(chord_table), tonic_pc
        self.rng, self.hv = make_hv(seed)

    # ── Melodie ───────────────────────────────────────────────────────────────────────────────
    def mel(self, inst, bar0, bars, shift=0, vel=88, octave=0, legato=.92, harm=None, delay=0.0, stretch=1.0, interval=0, min_dur=0.1):
        """Liste von Takten (je Liste aus (Notenname|None, Dauer)). harm=-2: diatonische Terz darunter; delay: Kanon-Versatz in Schlägen."""
        song = self.song
        tpc = (self.tonic_pc + shift) % 12
        t = song.bar(bar0) + delay
        for bar in bars:
            for name, dur in bar:
                d = dur * stretch
                if name is not None:
                    p = pn(name) + shift + 12 * octave + interval
                    if harm: p = scale_step(p, tpc, harm)
                    song.add(inst, t, max(min_dur, d * legato), p, self.hv(vel))
                t += d

    def seq(self, inst, beat0, notes, shift=0, vel=88, octave=0, legato=.92):
        """Notenfolge ab Beat (über Taktgrenzen)."""
        t = beat0
        for name, dur in notes:
            if name is not None:
                self.song.add(inst, t, max(0.1, dur * legato), pn(name) + shift + 12 * octave, self.hv(vel))
            t += dur

    # ── Hilfen ────────────────────────────────────────────────────────────────────────────────
    def root(self, ch, shift=0, oct_=1, lo=28, hi=46):
        r = self.tones(ch, oct_, shift)[0]
        while r < lo: r += 12
        while r > hi: r -= 12
        return r

    def bass(self, bar0, chords, shift=0, vel=92, style='pump', inst='bass'):
        """pump (4/4: Grundton, Quinte auf 2&, Grundton, Anschleichton) · walk (4/4: Viertelgang) · half (halbe Noten) · oompah (3/4/2/4: Grundton auf 1) · pedal (ganze Note) · bossa · jig (6/8)."""
        song, hv = self.song, self.hv
        for k, ch in enumerate(chords):
            r = self.root(ch, shift)
            nxt = self.root(chords[(k + 1) % len(chords)], shift)
            T = self.tones(ch, 1, shift)
            third = T[1] + (12 if T[1] < 28 else 0)
            fifth = r + 7
            t = song.bar(bar0 + k)
            app = nxt - 1 if nxt > r else nxt + 1
            if style == 'pump':
                song.add(inst, t, .95, r, hv(vel + 8)); song.add(inst, t + 1.5, .45, fifth, hv(vel - 8))
                song.add(inst, t + 2, .95, r, hv(vel)); song.add(inst, t + 3.5, .45, app, hv(vel - 12))
            elif style == 'walk':
                song.add(inst, t, .95, r, hv(vel + 6)); song.add(inst, t + 1, .95, third if third < r + 12 else r + 4, hv(vel - 4))
                song.add(inst, t + 2, .95, fifth, hv(vel)); song.add(inst, t + 3, .95, app, hv(vel - 6))
            elif style == 'half':
                song.add(inst, t, 1.9, r, hv(vel + 4)); song.add(inst, t + 2, 1.9, fifth, hv(vel - 6))
            elif style == 'oompah':
                song.add(inst, t, .9, r, hv(vel + 6))
            elif style == 'pedal':
                song.add(inst, t, song.bpb - .05, r, hv(vel))
            elif style == 'bossa':
                song.add(inst, t, 1.4, r, hv(vel + 4)); song.add(inst, t + 1.5, .9, fifth, hv(vel - 6)); song.add(inst, t + 2.5, 1.2, r, hv(vel))
            elif style == 'jig':
                song.add(inst, t, 0.9, r, hv(vel + 6)); song.add(inst, t + 1, 0.9, fifth if k % 2 == 0 else r + 12 - 5 + 5, hv(vel - 4))
            elif style == 'polka':
                song.add(inst, t, 0.45, r, hv(vel + 6)); song.add(inst, t + 1, 0.45, fifth, hv(vel - 6))
            elif style == 'push':
                song.add(inst, t, .95, r, hv(vel + 6)); song.add(inst, t + 1.5, .45, r, hv(vel - 8)); song.add(inst, t + 2.5, .45, fifth, hv(vel - 6)); song.add(inst, t + 3.5, .45, app, hv(vel - 10))

    def chord_notes(self, ch, oct_, shift=0, n=5):
        T = self.tones(ch, oct_, shift)
        base = (T[0], T[2], T[0] + 12, T[1] + 12, T[2] + 12)
        return base[:n]

    def strum(self, bar0, chords, shift=0, vel=70, style='folk', inst='guitar', oct_=3):
        """Gitarren-Begleitmuster. folk (4/4 Wechselschlag) · light (nur Ab auf 1 und 3) · waltz (3/4) · bossa · calypso · jig (6/8) · polka (2/4) · offbeat (Auftakt-Achtel)."""
        song, hv = self.song, self.hv
        pats = {
            'folk':    ((0, 1.0, 1.0), (1, .5, .8), (1.5, .5, .65), (2.5, .5, .65), (3, .5, .85), (3.5, .5, .65)),
            'light':   ((0, 1.5, 1.0), (2, 1.5, .85)),
            'waltz':   ((0, 1.0, 1.0), (1, .8, .7), (2, .8, .7)),
            'bossa':   ((0, .9, 1.0), (1.5, .45, .7), (2, .9, .85), (3, .45, .65), (3.5, .45, .7)),
            'calypso': ((0, .5, 1.0), (.75, .4, .6), (1.5, .45, .85), (2.5, .45, .7), (3, .5, .85), (3.5, .4, .6)),
            'jig':     ((0, .6, 1.0), (T3, .3, .6), (2 * T3, .3, .6), (1, .6, .85), (1 + T3, .3, .6), (1 + 2 * T3, .3, .6)),
            'polka':   ((0, .4, .9), (.5, .4, .8), (1, .4, .9), (1.5, .4, .8)),
            'offbeat': ((.5, .35, .9), (1.5, .35, .9), (2.5, .35, .9), (3.5, .35, .9)),
            'two':     ((0, 1.0, 1.0), (1, .8, .8)),
        }[style]
        for k, ch in enumerate(chords):
            notes = self.chord_notes(ch, oct_, shift)
            t = song.bar(bar0 + k)
            for beat, dur, f in pats:
                for j, m in enumerate(notes):
                    song.add(inst, t + beat + j * 0.012, dur + 0.1, m, hv(int(vel * f)))

    def arp(self, bar0, chords, shift=0, vel=52, inst='cleangtr', oct_=4, steps=8, step=0.5, pattern=(0, 2, 4, 3, 4, 2, 0, 2)):
        """Arpeggio: Index in (Grundton, Terz, Quinte, Oktave, Terz+12, Quinte+12)."""
        song, hv = self.song, self.hv
        for k, ch in enumerate(chords):
            T = self.tones(ch, oct_, shift)
            ext = (T[0], T[1], T[2], T[0] + 12, T[1] + 12, T[2] + 12)
            t = song.bar(bar0 + k)
            for i in range(steps):
                song.add(inst, t + i * step, step * .9, ext[pattern[i % len(pattern)] % 6], hv(vel + (8 if i % 2 == 0 else 0)))

    def pad(self, bar0, chords, shift=0, vel=44, inst='strings', oct_=3, notes=3):
        song = self.song
        for k, ch in enumerate(chords):
            T = self.tones(ch, oct_, shift)
            ext = (T[0], T[1], T[2], T[0] + 12)
            for m in ext[:notes]: song.add(inst, song.bar(bar0 + k), song.bpb - 0.05, m, vel)

    def piano(self, bar0, chords, shift=0, vel=60, style='offbeat', inst='piano', oct_=4):
        """offbeat (Achtel-Auftakte 4/4) · block (Akkord auf 1 und 3) · ballad (Bass + Akkord-Arpeggio in Achteln)."""
        song, hv = self.song, self.hv
        for k, ch in enumerate(chords):
            T = self.tones(ch, oct_, shift)
            t = song.bar(bar0 + k)
            if style == 'offbeat':
                for i in range(int(song.bpb)):
                    for m in (T[1], T[2], T[0] + 12): song.add(inst, t + 0.5 + i, 0.3, m, hv(vel))
            elif style == 'block':
                for beat in (0, 2):
                    for m in (T[0], T[1], T[2]): song.add(inst, t + beat, 1.6, m, hv(vel))
            elif style == 'ballad':
                for i, m in enumerate((T[0] - 12, T[2] - 12, T[0], T[1], T[2], T[1], T[0], T[1])):
                    song.add(inst, t + i * 0.5, 0.9 if i < 2 else 0.6, m, hv(vel + (6 if i == 0 else 0)))
            elif style == 'waltz':
                song.add(inst, t, 0.9, T[0] - 12, hv(vel + 6))
                for beat in (1, 2):
                    for m in (T[1], T[2], T[0] + 12): song.add(inst, t + beat, 0.7, m, hv(vel - 8))

    # ── Schlagzeug ────────────────────────────────────────────────────────────────────────────
    def drums(self, bar0, nbars, style='folk', level=1.0, fills=True, crash=True, fill_every=4):
        """folk · chorus · light · swing (Triolen-Hi-Hat, Besen-Snare) · waltz · bossa · calypso · jig (6/8, 2 Schläge) · polka (2/4) · lofi · soft · pulse."""
        song = self.song
        L = level
        for k in range(nbars):
            t = song.bar(bar0 + k)
            if style in ('folk', 'chorus', 'light'):
                song.dr(t, KICK, int(96 * L), 0.2); song.dr(t + 2, KICK, int(88 * L), 0.2)
                for beat in (1, 3): song.dr(t + beat, SIDESTICK if style == 'light' else CLAP, int((80 if style == 'light' else 100) * L), 0.12)
                if style == 'chorus':
                    song.dr(t + 1.5, KICK, int(78 * L), 0.15); song.dr(t + 3.5, KICK, int(74 * L), 0.15)
                    for i in range(16): song.dr(t + i * 0.25, HAT, int((74 if i % 4 == 0 else (58 if i % 2 == 0 else 44)) * L), 0.05)
                    for i in range(4): song.dr(t + 0.5 + i, OHAT, int(70 * L), 0.12)
                else:
                    for i in range(8): song.dr(t + i * 0.5, HAT, int((76 if i % 2 else 56) * L), 0.05)
            elif style == 'swing':
                song.dr(t, KICK, int(62 * L), 0.15); song.dr(t + 2, KICK, int(56 * L), 0.15)
                for beat in (0, 1, 2, 3): song.dr(t + beat, HAT, int(78 * L), 0.08); song.dr(t + beat + 2 * T3, HAT, int(60 * L), 0.08)
                for beat in (1, 3): song.dr(t + beat, SIDESTICK, int(72 * L), 0.1)
                song.dr(t + 1 + T3 * 2, SNARE, int(34 * L), 0.06)
            elif style == 'waltz':
                song.dr(t, KICK, int(88 * L), 0.2)
                for beat in (1, 2): song.dr(t + beat, SIDESTICK, int(72 * L), 0.1)
                for i in range(6): song.dr(t + i * 0.5, HAT, int((66 if i % 2 else 50) * L), 0.05)
            elif style == 'bossa':
                for beat, v in ((0, 90), (1.5, 70), (2, 84), (3.5, 70)): song.dr(t + beat, KICK, int(v * L), 0.15)
                for beat in (0.5, 1, 2, 3, 3.5): song.dr(t + beat, SIDESTICK, int(70 * L), 0.1)
                for i in range(8): song.dr(t + i * 0.5, HAT, int((62 if i % 2 else 46) * L), 0.05)
            elif style == 'calypso':
                for beat, v in ((0, 92), (2.5, 78)): song.dr(t + beat, KICK, int(v * L), 0.15)
                for beat in (1, 3): song.dr(t + beat, CLAP, int(86 * L), 0.12)
                for i in range(8): song.dr(t + i * 0.5, HAT, int((74 if i % 2 else 52) * L), 0.05)
                song.dr(t + 1.5, TOM_M, int(66 * L), 0.1); song.dr(t + 3.5, TOM_L, int(70 * L), 0.1)
            elif style == 'jig':
                song.dr(t, KICK, int(98 * L), 0.2); song.dr(t + 1, TOM_L, int(86 * L), 0.2)
                for beat in (0, 1):
                    for j in range(3): song.dr(t + beat + j * T3, HAT, int((80 if j == 0 else 58) * L), 0.05)
                song.dr(t + 1, CLAP, int(76 * L), 0.12)
            elif style == 'polka':
                song.dr(t, KICK, int(98 * L), 0.15); song.dr(t + 1, SNARE, int(90 * L), 0.12)
                song.dr(t + 0.5, HAT, int(70 * L), 0.06); song.dr(t + 1.5, HAT, int(74 * L), 0.06)
            elif style == 'lofi':
                song.dr(t, KICK, int(84 * L), 0.2); song.dr(t + 1.75, KICK, int(66 * L), 0.15); song.dr(t + 2, SIDESTICK, int(70 * L), 0.1)
                song.dr(t + 1, SNARE, int(52 * L), 0.1); song.dr(t + 3, SNARE, int(66 * L), 0.1)
                for i in range(8): song.dr(t + i * 0.5, HAT, int((54 if i % 2 else 40) * L), 0.05)
            elif style == 'soft':
                song.dr(t, KICK, int(62 * L), 0.2)
                for beat in range(int(song.bpb)): song.dr(t + beat, HAT, int(46 * L), 0.05)
            elif style == 'pulse':
                for beat in range(int(song.bpb)): song.dr(t + beat, KICK if beat % 2 == 0 else SIDESTICK, int(70 * L), 0.12)
            if k == 0 and crash and style in ('chorus', 'calypso'): song.dr(t, CRASH, int(90 * L), 1.6)
            if fills and fill_every and k % fill_every == fill_every - 1 and style in ('folk', 'chorus', 'light', 'calypso', 'bossa', 'lofi', 'polka'):
                b0 = song.bpb - 1.5
                for j in range(4): song.dr(t + b0 + j * 0.375, (TOM_H, TOM_M, TOM_M, TOM_L)[j], int((72 + 6 * j) * L), 0.12)

    def roll(self, bar0, start, end, v0=44, v1=108):
        t0 = self.song.bar(bar0) + start
        n = int((end - start) * 4)
        for i in range(n): self.song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

    def sparkle(self, bar0, nbars, shift=0, vel=54, notes=('D6', 'G6', 'B6', 'E6', 'A6'), per_bar=2, inst='glock'):
        song, rng, hv = self.song, self.rng, self.hv
        slots = [i * 0.5 for i in range(int(song.bpb * 2))]
        for k in range(nbars):
            t = song.bar(bar0 + k)
            for _ in range(per_bar):
                song.add(inst, t + rng.choice(slots), 0.35, pn(rng.choice(notes)) + shift, hv(vel))

    def run(self, beat, notes, step=0.25, shift=0, vel=70, inst='flute', legato=1.0):
        """Schneller Lauf: Liste von Notennamen."""
        for i, n in enumerate(notes): self.song.add(inst, beat + i * step, step * legato, pn(n) + shift, self.hv(vel + i))

    def hit(self, beat, chord, shift=0, vel=96, dur=0.8, insts=('guitar', 'piano'), oct_=3):
        T = self.tones(chord, oct_, shift)
        for inst in insts:
            for m in T: self.song.add(inst, beat, dur, m, vel)

    # ── Pitch-Bend (±12 Halbtöne): Gleiter, Wind, Wellen ──────────────────────────────────────
    def bend_setup(self, *names):
        for name in names:
            ch = self.song.ch[name][0]
            for cc, v in ((101, 0), (100, 0), (6, 12), (38, 0), (101, 127), (100, 127)):
                self.song.ev.append((0, -2, mido.Message('control_change', channel=ch, control=cc, value=v)))

    def glide(self, name, beat, dur, pitch, vel, lo=-4.0, hi=0.0, steps=16):
        """Eine Note, deren Tonhöhe in `dur` Schlägen von lo nach hi Halbtönen gleitet (bend_setup(name) vorher aufrufen)."""
        ch = self.song.ch[name][0]
        self.song.add(name, beat, dur + 0.2, pitch, vel)
        for i in range(steps + 1):
            f = i / steps
            self.song.ev.append((int(round((beat + dur * f) * TPB)), 0,
                                 mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, (lo + (hi - lo) * f) / 12.0 * 8192))))))
        self.song.ev.append((int(round((beat + dur + 0.25) * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=0)))
