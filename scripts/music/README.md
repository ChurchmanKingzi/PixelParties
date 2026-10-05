# Pixel-Parties-Musik: Battle-Tracks komponieren

Alle Tracks entstehen als Python-Skript in diesem Ordner und werden mit der
Pixel-Parties-SoundFont („16-Bit Game Station“) über FluidSynth gerendert.
`lib.py` ist die gemeinsame Grundlage; `null_battle.py` (militärischer d-Moll-Marsch,
ältere Bauform) und `battle4.py`…`battle10.py` sind Beispiele.

## Aufbau eines Skripts
```python
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
song = Song(bpm=132, bars=64)              # ganze Takte, 4/4
song.inst('bass', 'sbass', vol=100, pan=60)  # Stimme anlegen (Schlüssel aus lib.INSTR)
song.add('bass', song.bar(0) + 0.5, 0.4, n(D, 2), 96)   # Stimme, Beat, Dauer (Viertel), MIDI-Note, Velocity
song.dr(song.bar(0), KICK, 110)             # Schlagzeug
sf2, out = cli_paths('bgm_theme_xyz.ogg')   # argv[1] = SoundFont, argv[2] optional Ausgabe
song.render(sf2, out)
```
Töne: `n(pc, oktave)` mit `C, Db, D, Eb, E, F, Gb, G, Ab, A, Bb, B` (0–11); `n(A, 4)` = 69.
Maximal 15 melodische Stimmen (+ Schlagzeug). Aufruf: `python3 scripts/music/<skript>.py <soundfont.sf2>`.

## Was `lib.render` erzwingt
* Länge = GANZE Takte, Ausklang der Nachlauf-Takte wird auf den Anfang gemischt →
  der Client (Gapless-Looper) loopt Sample-genau. Naht-Sprung wird gemessen, zu harte Naht bricht ab.
* Lautheit RMS ≈ 0,29 (wie alle Themes), Limiter, Vorbis-Overshoot-Korrektur.

## Anforderungen an jeden Battle-Track (WICHTIG)
1. **Es ist ein KAMPF-Track**: von Takt 1 an treibender Puls (Schlagzeug/Perkussion/Ostinato), nie
   Ambient. Auch Horror, Kinderlied oder Ballade müssen kämpfen: Bedrohung, Druck, Angriff.
2. **Das Thema muss sofort und eindeutig erkennbar sein** (Instrumente, Skala, Rhythmus, Motive, Dramaturgie
   passend zum Archetyp) — der Track lädt Spieler zum Rollenspielen ein. Lies die Karten des Archetyps in
   `data/cards.json` (Feld `archetype`), um Flair, Figuren und Mechanik zu verstehen.
3. Länge **100–140 s**, in ganzen Takten; klare Abschnitte (Intro, Thema, Steigerung, Höhepunkt,
   Rückführung), die am Ende in den Anfang zurückführen (Loop!). Keine Schlusskadenz.
4. **Wirklich komponieren**: wiedererkennbares Hauptmotiv, Gegenstimme, Bassführung, Harmoniewechsel
   (nie > 8 Takte derselben Akkord), Dynamik über Velocity und Instrumentierung, Fills an Abschnittsgrenzen.
   Melodietöne gehören zu Akkord/Tonleiter (im Skript per Assert/Check prüfen).
5. **Nicht zu leises Intro**: RMS je 8 s soll nie unter ≈ 0,15 fallen (Kampfmusik!) — Ausnahme sind
   bewusste kurze Breaks. Dynamikspanne im Track moderat (Intro ≥ 55 % des Höhepunkts).
6. Klang: Register trennen (Bass Oktave 1–2, Begleitung 3, Melodie 4–5), nicht alles in Mittellage stapeln,
   pan/vol pro Stimme setzen. **Hi-Hat, Ride, offene Hi-Hat sind in dieser SoundFont sehr leise** →
   hohe Velocity (100+) oder mit Snare/Toms/Clap/Cowbell/Woodblock (56 Cowbell, 39 Clap, 37 Sidestick) tragen.
   Prüfe jede benutzte Drum-Note einzeln auf Nicht-Stille.
7. Der Track soll sich klar von allen anderen unterscheiden (andere Tonart/Tempo/Instrumentierung/Rhythmik).
   Bereits vorhanden: null_battle (d-Moll-Marsch), battle4 F-Dur-Fanfare, battle5 Kathedrale/Orgel,
   battle6 Cyber-Synth a-Moll, battle7 Rock e-Moll, battle8 Flöte/Harfe d-Dorisch, battle9 c-Moll-Orchester,
   battle10 g-Moll-Swing/Pizzicato.
8. Kommentare/Docstring auf Deutsch, Dateien UTF-8, Umlaute direkt als Unicode (keine Escapes),
   beim Schreiben von Dateien in Python immer `encoding='utf-8'`.
9. Verifiziere numerisch (du kannst nicht hören): Skript läuft durch, RMS je 8 s, Dauer, Peak der
   dekodierten Datei ≤ 0,985, Drum-Noten hörbar, Melodie-in-Skala.

## Namen & Dateien
Ergebnis pro Track: `scripts/music/theme_<slug>.py` und `public/music/bgm_theme_<slug>.ogg`.
Der Titel steht im Docstring des Skripts und in `data/battle-tracks.json` (nicht ändern).
Nichts committen/pushen, keine anderen Dateien ändern.

## Lange Stücke (Draft-Musik u. Ä.)
Für Tracks, die nicht ein Duell, sondern eine lange Tätigkeit begleiten (z. B. Draft, 30+ Minuten):
* Länge ca. 9–11 Minuten in ganzen Takten. Der Client dekodiert jeden Track vollständig (≈ 350 kB je Sekunde),
  10 Minuten sind etwa 210 MB — nicht länger als ≈ 11 Minuten gehen.
* Der Track muss auch nach mehreren Durchläufen nicht ermüden: viele Abschnitte („Szenen“) mit wechselnder
  Tonart, Klangfarbe und Dichte; Motive werden verwandelt (Umkehrung, Dehnung, Sequenz, Gegenstimme), nicht
  wiederholt. Atempausen und Dichtewechsel sind erwünscht. Der Anfang muss zum Ende passen (Loop).
* `song.program(name, beat, instrument)` wechselt die Instrumente einer Stimme mitten im Stück — so passen mehr
  als 15 Klangfarben auf die 15 Kanäle.
* Der Render dauert länger (Minuten); Arbeitsspeicher reicht (16 GB).

## Lautheit: Sättigung oder Kompressor?
`song.render` hat zwei Lautheits-Ketten:
* Standard (`saturate=True`): weiche tanh-Sättigung, dann Limiter. Gut für schlagzeuglastige Duell-Tracks, **verzerrt aber
  spitzenreiche, akustische Klänge** (Klavier, Harfe, Zupfer, Glocken; Crest-Faktor > 10) hörbar.
* `saturate=False, compress=True`: sanfter Kompressor (3,5:1, Schwelle = Ziel-RMS) + Lookahead-Limiter — kein Verzerren.
  Für Draft-Musik und alle leiseren/akustischen Stücke verwenden (z. B. `target_rms=0.18`).
FluidSynth rendert intern in 32-Bit-Float (`-O float`); das 16-Bit-Standardformat clippte vor der Normalisierung.
