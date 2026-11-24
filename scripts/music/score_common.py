# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine des Kampagnen-Scores (nicht der Kampf-Themes).

Der Score soll in sich stimmig klingen und viele Orte und Stimmungen abdecken. Damit er das tut, folgen alle Score-Tracks denselben Regeln:

  • **Hausklang** (immer dieselbe SoundFont): Holzbläser (Pfeife, Flöte, Klarinette, Mundharmonika, Oboe, Fagott), Zupf-/Schlaginstrumente (Nylon-Gitarre, Clean-Gitarre, Klavier,
    Marimba, Xylophon, Glockenspiel, Vibraphon, Harfe), Streicher (Ensemble, Pizzicato, Violine, Cello/Kontrabass), Stimmen (Oohs, Choir), Blech sparsam (Horn, Posaune, Trompete).
    Warm, akustisch, handgemacht — keine Kampf-Härte (Verzerrung, Dauer-Sechzehntel-Orkane), sondern Melodie.
  • **Ohrwurm-Regeln**: eine Hauptmelodie pro Track, die man summen kann (Umfang höchstens eine Dezime, meist Stufen + ein Sprung; ein kurzer, rhythmisch markanter
    Kern von 4 bis 6 Tönen, der wiederholt und dabei stufenweise versetzt wird); Strophe = sprechend/synkopiert, Refrain = gesungen/breit; ein zweites Thema oder Bridge als Gegenpol.
  • **Leitmotive** (siehe LEITMOTIVE unten): wiederkehrende Kerne, die in anderen Tracks zitiert werden (Intro, Bridge, Outro) — so hängen die Orte klanglich zusammen.
  • **Jeder Track loopt nahtlos** (ganze Takte, Ausklang auf die Dominante/Leitton-Akkord, der in den Anfang führt; `lib.Song.render` prüft die Naht).
  • Namenskonvention: Datei `public/music/bgm_score_<slug>.ogg`; in Kampagnen-Szenen als `music: 'score_<slug>'` (siehe `public/campaign/scenes/*.js`).
"""
import random

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

def pn(s):
    """Notenname → MIDI-Nummer (C4 = 60): 'F#5', 'Bb3'."""
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

# Leitmotive als (Halbtöne über dem Grundton, Dauer in Schlägen) — in jeder Tonart verwendbar.
LEITMOTIVE = {
    # „Freunde“: aufsteigende Dur-Tonleiterstufen 1–2–3–5, dann 6–5 (Do–Re–Mi–Sol–La–Sol). Wärme, Zusammenhalt, Aufbruch.
    'freunde': [(0, .5), (2, .5), (4, .5), (7, .5), (9, 1), (7, 1)],
}

def motif(name, tonic_midi):
    """Leitmotiv als Liste (Tonhöhe MIDI, Dauer)."""
    return [(tonic_midi + off, d) for off, d in LEITMOTIVE[name]]

QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10), 'sus': (0, 5, 7), 'M7': (0, 4, 7, 11), 'm7': (0, 3, 7, 10)}

def make_tones(chord_table):
    def tones(ch, oct_, shift=0):
        root, q = chord_table[ch]
        r = (root + shift) % 12 + 12 * (oct_ + 1)
        return [r + i for i in QUAL[q]]
    return tones

def make_hv(seed):
    rng = random.Random(seed)
    def hv(v): return int(max(1, min(127, v + rng.randint(-3, 3))))
    return rng, hv

MAJOR = (0, 2, 4, 5, 7, 9, 11)
def scale_step(midi, tonic_pc, steps):
    """Diatonisch (Dur) um `steps` Stufen verschieben — für Terz-Harmonien; außerhalb der Tonleiter ~1,5 Halbtöne pro Stufe."""
    pcs = {(tonic_pc + d) % 12 for d in MAJOR}
    if midi % 12 not in pcs: return midi + int(steps * 1.5)
    notes = [p for p in range(0, 128) if p % 12 in pcs]
    return notes[notes.index(midi) + steps]
