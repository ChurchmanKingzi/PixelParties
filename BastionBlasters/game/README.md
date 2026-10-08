# Bastion Blasters — Kampf-Prototyp (v0.4)

Spielbarer Prototyp des Kerns: Loadout (10/7), Erstaufbau, automatische Schlacht, Zeitstopp alle zwei Wellen mit frischer 5/3-Hand, beide Siegbedingungen (Kern zerstört oder Kernkammer erobert). Mensch gegen Bot oder Bot gegen Bot zum Zuschauen. TypeScript, Vite und PixiJS; die Simulation ist deterministisch und läuft ohne Browser in Node.

**Spielen:** als Artifact (eine einzige HTML-Datei mit eingebetteten Grafiken, siehe unten) oder lokal mit `npm run dev`.

## Befehle

```bash
cd game
npm install
npm run dev                      # Entwicklungsserver (http://localhost:5173)
npm run build && node tools/embed.mjs   # dist/ und dist/artifact.html (Einzeldatei, ca. 5,4 MB)
npm run sim -- --seed 1 --games 20      # Bot gegen Bot im Terminal (Siegquoten, Matchlänge, Statistik)
npm test                         # Determinismus- und Rauchtests der Simulation
npm run data                     # cards.gen.json aus den Katalogen neu erzeugen (tools/build_game_data.py)
node tools/playtest.mjs http://localhost:5173/ ./shots watch   # Chromium-Test mit Screenshots (playwright-core)
```

Die Grafiken kommen aus der Pixel-Werkstatt (`../art`): `export_game_units.py`, `export_game_rooms.py`, `export_game_world.py` schreiben nach `public/assets/` und `public/cards/`; der Vertrag steht in [`ASSET_SPEC.md`](ASSET_SPEC.md).

## Bedienung

| Aktion | Eingabe |
|---|---|
| Karte spielen | Karte im Tray anklicken (Bauteile: danach auf den Baugrund klicken); beim Überfahren wächst die Handkarte, darüber erscheint eine große Vorschau mit erklärten Begriffen |
| Begriffe erklären | Unterstrichene Wörter (Inspektor, Statusliste) und die Begriffsfelder auf der großen Kartenvorschau zeigen beim Überfahren die Erklärung aus dem Glossar |
| Bauteil drehen | Mausrad (solange ein nicht quadratisches Gebäude in der Hand ist), R oder Rechtsklick; Esc bricht ab |
| Mauerkarten | Maus nahe an eine Mauer, bis zu 4 zusammenhängende Segmente werden markiert |
| Hof erweitern | „+ Courtyard cell“, dann leere Zellen neben dem Hof anklicken (16 im Erstaufbau, 6 je Zeitstopp) |
| Kapazität | Seitenleiste „Capacity“: Bürger-Limit (Dwelling +3) und Kontingent-Plätze (5, +1 je Zeitstopp, +½ je Einheiten-Raum) mit Aufschlüsselung |
| Fundament | In der Bauphase gibt es 12 kostenlose Zusatz-Bau-Karten (Tab „Foundation“ im Tray): Räume, Fallen, Türme für das Labyrinth zum Kern |
| Untersuchen | Zeile „Doing“ im Inspektor sagt, was die Einheit tut; ein gelber Zielstrich zeigt ihr Ziel; der Eroberungsring über der Kernkammer zeigt Fortschritt, Rate und wer sperrt |
| Umbau | Bauteil anklicken, „Pick up and move“ (im Zeitstopp ein Bauteil) |
| Duplikat | Karte einer schon stehenden Bau-Karte spielen wertet sie auf (★) |
| Kontingent | Troop-Karten anklicken; ist es voll, den zu ersetzenden Eintrag in der Seitenleiste anklicken; Wachzone und Zielpriorität pro Eintrag |
| Kamera | Mausrad zoomt, Ziehen verschiebt, F = ganze Karte |
| Tempo | ⏸, 1×, 2×, 4×, 8× (Tasten Leertaste, 1–4) |
| Ton | Lautsprecher-Knopf in der Kopfleiste (Klick = stumm, Überfahren = Regler für Master, Musik, SFX), Taste M; Einstellungen bleiben gespeichert |
| Untersuchen | Einheit oder Gebäude anklicken; Artillerie zeigt ihre Reichweite |

## Aufbau

```
src/sim/      deterministische Simulation (30 Hz, seedbasiert, keine Browser-Abhängigkeit)
  world.ts        Zustand, Raster, Kanten, Räumliche Suche
  bastion.ts      Kernhof, Module, Auto-Mauern auf Zellkanten, Türen, Platzierungsprüfung
  nav.ts          A* mit Kantenblockade und Zerstörungskosten, Schusslinie
  units.ts        Einheiten, Status, Schaden, Heilung, Tod, XP und Ränge
  ai.ts           Verhalten: Sturm (Doktrinen), Verteidiger (Zonen, Leine), Zivilisten, Bürger, Rückzug
  combat.ts       Nah-/Fernkampf, Strukturschaden, Artillerie (7 Flugbahnen), Projektile, Einschläge
  systems.ts      Personal, Eroberung, Gebiete, Wellen und Spawns, Kern, Wahnsinn, Sieg
  bfx.ts          Gebäudewirkungen (Heilung, Türme, Spawn-Boni, Fallen, Chaos-Räume, Artillerie-Modifikatoren)
  unitfx.ts       Fähigkeiten der Einheitenkarten;  artfx.ts  Artillerie-Zusatzwirkungen
  draw.ts, commands.ts, match.ts, bot.ts   Ziehen, Befehle, Spielablauf, Bot
src/render/   PixiJS-Darstellung (Atlanten, Bastionen, Einheiten, Geschosse, Effekte, Kamera)
src/audio/    prozedurale SFX und Musik per Web Audio, keine Dateien (siehe src/audio/README.md); Selbsttest: node tools/audiotest.mjs
src/ui/       DOM-Oberfläche (Menü, Loadout, Tray, Seitenleiste, HUD, Inspektor); keywords.ts = Glossar-Tooltips und große Kartenvorschau
tools/        headless.ts (Bot-Sim), build_game_data (../tools), embed.mjs, playtest.mjs
```

Die Karten sind datengetrieben: `src/data/cards.gen.json` entsteht aus den Katalogen (`../tools/build_game_data.py`). Was sich nicht aus den Katalogfeldern ablesen lässt, steht je Karte in `unitfx.ts`, `bfx.ts` und `artfx.ts`. Im Inspektor steht bei jeder Karte, ob ihre Wirkung voll, teilweise oder nur als Werte umgesetzt ist.

## Annahmen des Prototyps (bitte prüfen)

- **Kernkammer = 4 × 4 Zellen** (Kern plus Ring von einer Zelle) im Kernhof; GDD nennt 2 × 2. Dort wird erobert, dort stehen Verteidiger der Zone „Core Chamber“.
- Ein Standardkern, **keine Fraktions-Kerne**, keine Kern-Fähigkeit, kein Kern-Anbau.
- **Zeitstopps:** Der Kampfabschnitt vor dem n-ten Zeitstopp hat 2 + n Wellen (40 s Abstand), die Abschnitte werden also immer länger. Wahnsinn ab 11:00, Himmelsriss ab 16:00.
- **Kontingent:** 5 Plätze, +1 je Zeitstopp, +½ je gebautem Einheiten-Raum (Freischalt-Gruppe), höchstens 16.
- **Zivilisten-Pool:** 2 eigene Plätze für Zivilisten, +1 mit jedem Zeitstopp (max. 8); sie konkurrieren nicht mehr mit den Kampfplätzen. Ersetzen nur innerhalb des Pools.
- **Aufholhilfe (Comeback aid):** Beim Zeitstopp wird der Zustand beider Bastionen (Kern, Bauwerk, Eroberungsdruck) verglichen. Wer zurückliegt, bekommt je nach Abstand (ab 12 %, 25 %, 40 %): mehr behaltene Karten, Neuwurf, bessere Karten, 1–3 kostenlose Ruinen-Wiederaufbauten (grün umrandet, Inspektor → Rebuild) und +15–50 % XP. Anzeige in „Capacity“. Ruinen lassen sich nicht mehr aufnehmen.
- **Fundament:** 12 kostenlose Bau-Karten zum Start (7 Räume, 2 Fallen, 2 Türme, 1 frei), unverbaute verfallen. Räume und Türme dürfen schlichte Hofzellen überbauen, solange der Weg Tor → Kernkammer offen bleibt. Mauerbruch kostet im Wegfinder 6 + HP/12, Angreifer folgen also eher dem Labyrinth.
- **Eroberung:** 1,5 %/s je Eindringling in der Kammer (max. 6), Abbau 3 %/s; Eindringlinge ohne Ziel zertrümmern den Kern; Verteidiger in der Kammer sperren die Eroberung.
- **Layout:** Kernhof (6 × 6) hinten im Baugrund, ein 8 Zellen langer Zufahrtsgang (1 Zelle breit) führt zum Haupttor an der Front. Davor und daneben ist freier Baugrund für Räume, Türme und Hofzellen.
- Räume müssen mit mindestens einer Kante an den Hof **oder an einen angeschlossenen Raum** grenzen; die Tür liegt zum Hof, sonst zum Nachbarraum (Reihenfolge Süd, Ost, West, Nord). Ein Raum, an dem andere hängen, lässt sich erst aufnehmen, wenn diese weg sind.
- Wandkarten wirken auf bis zu 4 zusammenhängende Segmente (ab der angeklickten Kante). Das Tor wird durch BS-07 ersetzt.
- Einheiten-Fernangriffe und Turmschüsse treffen sofort; nur Artillerie fliegt als echtes Geschoss.
- **Nicht umgesetzt:** Rank-3-Talente, Fraktions-Kerne und Welt-Launen, Chaos-Karten, Dragon Egg (BC-03), Red Button (BC-09), Rutschen und Eilgang-Richtung (BU-07), Fallensteller (UZ-10), Nebel/Sichtverdeckung beim Aufbau (beide Bastionen sind immer sichtbar).
- Zeitgeber im Prototyp: Aufbau 180 s, Zeitstopp 60 s (im Menü wählbar, GDD: 120 s / 25 s).
- **Ton:** SFX zu fast allen Ereignissen (20 Abschussfamilien, 13 Einschläge, Tod, Bruch, Rang, Heilung, Wellenhorn) und sechs Musikstücke (Menü, Aufbau, Kampf, Zeitstopp, Sieg, Niederlage) werden zur Laufzeit synthetisiert. Pegel und Charakter sind gemessen, aber nicht nach Gehör abgenommen: bitte Rückmeldung zu Lautstärke und Musikgeschmack.
- Einheiten tragen eine Umrandung und einen Fußring in der Teamfarbe (P1 rot, P2 türkis); beim Herauszoomen wird die Umrandung dicker.

## Bot-Statistik (24 Partien, Seeds 100–123, v0.3)

P1 11 : P2 13 (symmetrisch im Rahmen der Streuung), mittlere Matchlänge 14,2 min (Ziel 10–16), Siege durch Zerstörung : Eroberung = 17 : 7, kein Remis. Die Bots bauen jetzt ein Labyrinth (Riegel mit Umweg im Zufahrtsgang, Fallen, Türme) und stellen einen Verteidiger in die Kernkammer. Rund die Hälfte der „Zerstörung“-Siege fällt erst in den Himmelsriss (ab 16:00): Die Bot-Angriffe kommen tröpfchenweise im Labyrinth zum Erliegen, ein menschlicher Spieler sollte schneller durchbrechen. Stellschrauben: Eroberungsrate, Labyrinth-Bau der Bots, Wegkosten für Mauerbruch, Artillerie-Reichweite zum Kern (GDD §12).
