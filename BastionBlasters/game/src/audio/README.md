# Audio-Schicht (SFX + Musik)

Alles wird zur Laufzeit per Web Audio API synthetisiert: keine Audiodateien, kein `fetch`, keine Worker, kein `eval`
(läuft auch unter strenger CSP als Einzeldatei-Artifact). Ohne `AudioContext` (Node, Headless, alte Browser) sind alle
Methoden No-Ops. Die Sim wird nie berührt: Audio liest nur `SimEvent`s und nutzt eigenen Zufall (`Math.random` bzw. `rng.ts`).

## Einbindung

```ts
import { audio } from './audio/audio';
import { createAudioControls } from './audio/controls';

// einmal bei der ersten Nutzergeste (idempotent, setzt auch einen pausierten Kontext fort)
window.addEventListener('pointerdown', () => audio.unlock());
window.addEventListener('keydown', () => audio.unlock());

audio.onEvent(e);            // für jedes SimEvent (scene.ts handleEvent)
audio.ui('click');           // UI-Klänge
audio.setSpeed(4);           // 0 = Pause (Musik dumpfer), 1/2/4/8
audio.setMood('battle');     // 'menu'|'build'|'battle'|'pause'|'victory'|'defeat'|'off'
audio.setListener(x, y);     // Kameramitte in Zellen (Standard: Kartenmitte 28/14)
audio.setViewer(0);          // optional: eigenes Team, eigene Ereignisse etwas lauter
topBar.append(createAudioControls());   // Mute-Knopf + Regler-Popover
```

Lautstärke: `audio.volume` (`{master, music, sfx, muted}`, Standard 0.8 / 0.35 / 0.7 / false), `setVolume(part, v)`,
`setMuted(b)`, `toggleMute()`, `onChange(cb)` (liefert die Abmelde-Funktion). Gespeichert unter `localStorage['bb.audio']`
(jeder Zugriff in `try/catch`, funktioniert ohne Storage). Die Regler wirken mit der Kurve `v^1.5`.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `audio.ts` | Singleton `audio` (`AudioEngine`), Master-Kette, Event-Zuordnung, Rate-Limit, Polyphonie, Raumklang, Lautstärke/Speicher |
| `sfx.ts` | SFX-Rezepte (`SFX`), Metadaten (`META`: Priorität, Hall, Pegel), `startSfx()` |
| `synth.ts` | Bausteine: Rauschpuffer, Impulsantwort für Hall, Pulswellen, ADSR, `Rack` (Töne/Rauschen) und `Voice` (Pan, Tiefpass, Hallsend, Aufräumen) |
| `music.ts` | `MusicPlayer`: Lookahead-Scheduler, Ebenen mit Überblendung, Tempo-/Pausenkopplung |
| `compose.ts` | Generative Stücke je Stimmung (Abschnitte, Akkordfolgen, Motive mit Variationen, Seeds) |
| `theory.ts` | Tonleitern, Akkorde, Stimmführung, Motiv-Erzeugung und -Variation, `Score` |
| `instruments.ts` | Musik-Instrumente (Chip-Lead, Pluck, Pad, Bass, Blech, Glocke, Schlagwerk) und Mischpult-Standardwerte |
| `controls.ts` | `createAudioControls()`: Mute-Knopf (`title="Sound (M)"`) und Popover mit Reglern, Klassen `bbau-*` |
| `rng.ts` | `mulberry32`, `hash32` |
| `audio.test.ts` | Vitest: No-Op ohne Kontext, Speicher, Rate-Limit, Stücke |

Klangtests mit Messwerten: `node tools/audiotest.mjs [outdir]` (Chromium, `OfflineAudioContext`, schreibt WAV-Belege).

## Signalfluss

```
Voice (SFX) -> Tiefpass (Entfernung) -> Pan -> sfxBus ----------\
                                   \-> Hall-Send (sfxRevIn) --\  \
Musik-Ebene -> Instrumentenbus -> Echo/Hall -> Muffle -> musicBus +-> pre -> Kompressor -> Soft-Clip -> master -> Ausgang
                          \-> Hall-Send (musRevIn) -> Convolver -/
```

* Kompressor: Schwelle -16 dB, Verhältnis 5:1; danach ein Soft-Clip (`WaveShaper`), der garantiert unter 1,0 bleibt.
* Hall: ein `ConvolverNode` mit selbst erzeugter Impulsantwort (1,8 s, Stereo), zwei Sends (SFX und Musik) damit die Regler auch den Hallanteil skalieren.
* Jede Stimme räumt sich selbst auf (`onended` -> `disconnect`); zusätzlich entsorgt ein Sweep Stimmen, die ihr Ende überschritten haben.

## Raumklang, Tempo, Limits

* Weltposition in Zellen (Karte 56 x 28): Pan = `clamp(dx / 20) * 0.85`, Lautstärke `1 / (1 + (d / 34)^1.6)`, Tiefpass `18 kHz * exp(-d / 38)`, mehr Hall mit Abstand.
* Polyphonie: höchstens 24 gleichzeitige Stimmen; ist alles belegt, verdrängt ein wichtigerer Klang (Priorität in `META`) die leiseste, ältere Stimme, sonst wird er verworfen.
* Rate-Limit (`RATE` in `audio.ts`): gleiche Art innerhalb 40 ms nur einmal; je Kategorie z. B. Treffer max. 12/s, Abschüsse und Einschläge 14/s, Tode 9/s, Zerstörung 6/s.
* Tempo > 1x: Obergrenzen skalieren mit `speed^-0.4`, Pegel mit `1 / (1 + 0.1 (speed-1))`, Hüllkurven werden kürzer.
* Musik koppelt an das Tempo (+4 % je Verdopplung, nur Kampfstück); `setSpeed(0)` dämpft die Musik per Tiefpass (650 Hz, im Zeitstopp-Stück 2,8 kHz) statt sie auszuschalten.

## Event -> Sound

| Ereignis | Klang |
| --- | --- |
| `shot` | je Familie (`vis`, bei Stein zusätzlich Flugbahn der Karte): `shot.cannon` (flach), `shot.catapult` (Bogen), `shot.lob` (senkrecht), `shot.ballista` (durchschlagend), `shot.dig` (Untergrund), `fire`, `flame`, `bolt`, `poison`, `arcane`, `ink`, `bat`, `bomb`, `icicle`, `ice`, `meteor`, `goblin` (Wheee), `arrow`, `goo`, `fish`; Artillerie lauter als Türme, Truppen leise; Karten-Hash färbt die Tonhöhe leicht |
| `impact` | `imp.stone` (dumpf), `fire` (Fauchen + Knall), `bolt` (Zischen-Peng), `poison` (Blubbern), `arcane` (Glasschimmer), `ice`/`icicle` (Klirren), `meteor` (tiefer Boom), `dome` (Glocke + Prallen), `bomb` (Knall), `ink`/`goo` (Platsch), `bat`, `goblin` (Boing), `dust`; Radius `r` -> lauter, tiefer, länger |
| `hit` | `hit`, Wucht und Lautstärke nach `dmg` (log), stark gedrosselt |
| `death` | `citizen` (Quieken), `civilian` (Posaunen-Seufzer), `artillery` (Krachen + Klirren), `assault` (Bloop-Poof), `defender` (Klang + Poof), Knochen-Rüstung: Klappern |
| `break` | `wall`, `gate`, `module`, `core` (Krachen, Steinbrocken, beim Kern Kristallsplittern) |
| `rank` | Fanfaren-Arpeggio |
| `heal` | Glockenspiel-Plink |
| `spawn`, `fx` | Poof; `revive` Schimmer, `flame`, `bones`, `dirt`, `spark`, `Citizen`, `Hornet` |
| `text` | meist ignoriert; `dodge`, `caught!`, `reflected!`, `berserk`, `CHOMP`, `copy!`, `transmutation`, `chaos-born`, `pit!` haben kleine Klänge |
| `feed` | `Wave N`: Wellenhorn; `The gate is broken!`: Warnglocke (nur für den betroffenen Spieler, wenn `setViewer` gesetzt ist); `Shield dome breaks`; `... rebuilt`; `wishing well`; Spielende-Texte bleiben stumm (Stinger über `setMood`) |
| `setMood('pause')` aus `'battle'` | Zeitstopp-Klang (`timestop`), beim Verlassen `timeresume` |

UI (`audio.ui(name)`): `click`, `hover`, `card` (Papier), `play` (Klack + Aufwärtsakkord), `invalid` (tiefes Nope), `rotate` (Ratschen),
`tab`, `toggle`, `confirm`, `cancel`, `pause`, `speed`, `draw`, `reroll` (Würfelrasseln).

## Musik

Stücke entstehen deterministisch (fester Seed) in `compose.ts`, Takte zu 16 Sechzehnteln, Notenliste je Schritt:

| Stimmung | Tonart / Tempo | Aufbau |
| --- | --- | --- |
| `menu` | G-lydisch, 100 BPM | 4 Takte Intro, dann 32 Takte A / B / A' / C (Zupf-Melodie, Pad, Arpeggio, Spieluhr) |
| `build` | A-mixolydisch, 106 BPM, Shuffle | 40 Takte (Pfeif-Melodie, gehender Bass, Orgel, Holzblöcke) |
| `battle` | D-dorisch, 138 BPM | 48 Takte, Spannung steigt von A über B bis B2, Bruch und Aufbau vor der Wiederholung (Marsch-Schlagwerk, Puls-Bass, Chip-Lead/Blech, Arpeggien) |
| `pause` | D-lydisch, 66 BPM | 32 Takte schwebende Akkorde, Glockenspiel, Echo, Hall |
| `victory` | C-Dur, 120 BPM | Fanfare 4 s, danach ruhiger Ausklang (32 Takte, schleifenfähig) |
| `defeat` | a-Moll, 84 BPM | Seufzer 4,3 s, danach ruhiger Ausklang (32 Takte) |

Der Scheduler plant per `setInterval` (25 ms) etwa 0,25 s voraus (im Hintergrund-Tab 1,6 s) auf `AudioContext.currentTime`.
Stimmungswechsel blenden gleichmäßig (Equal-Power-Kurve) in 1,5 s über, Stinger blenden den Vorgänger in 0,45 s aus.
Eine Ebene wird erst ausgeblendet, wenn ihre Einblendung beendet ist, damit es nie Sprünge gibt.

## Neue Klänge ergänzen

1. SFX: Rezept in `SFX` (`sfx.ts`) eintragen (`v.tone({...})`, `v.noise({...})`), Metadaten in `META` ergänzen (Priorität, Hall).
2. Zuordnung: in `audio.ts` die passende `on...`-Methode erweitern (Name -> Rezept, Lautstärke, Größe/Tonhöhe) und ggf. `RATE`.
3. Musik: Instrument in `instruments.ts`, Mischpult-Standard in `DEFAULT_MIX`; Stück in `compose.ts` (Abschnitte mit Akkordfolgen und Intensität) und in `BUILDERS` registrieren.
4. `node tools/audiotest.mjs` laufen lassen (Pegel, Spitzen, Start/Ende bei 0, Spektrum, Unterscheidbarkeit) und `npx vitest run src/audio`.
