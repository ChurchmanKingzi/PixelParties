# Auftrag: Runde-2-Sleeves auf aktuellen Qualitätsstand bringen

Die acht Sleeves in `data/sleeve-proposals/runde2/` (01 Guardian Zodiac, 03 Puppet Theater, 04 Spider Nest,
05 Pharaoh Tomb, 07 Gigantisaurs Comic, 08 Detective Board, 09 Cycling Demons, 10 Divine Balance) stammen aus einer
früheren Runde und sollen jetzt die Qualität der Runde 3 erreichen. **Lies zuerst
`data/sleeve-proposals/runde3/BRIEF.md` komplett** – alle Regeln dort gelten, besonders der Abschnitt „Runde 3b“
(A einheitliche Pixelgröße = Ausschlusskriterium, B vollständige Figuren, C korrekte Positionierung,
D eigene Effekte statt zweckentfremdeter Sprites, E Halbtransparenz nur für Geister/Spiegelungen). Kein Text.

## Was sich ändern soll
- **Sprites aus den xcf-Ebenen** statt aus Kartenbildern, wo die Figur als Ebene existiert (Export unter
  `/home/user/sprites_export/`, Kontaktbögen unter `/tmp/claude-0/-home-user-PixelParties/957fee25-d4dc-57bc-9138-a88ef389536d/scratchpad/cat/`,
  Karten in Szenen finden: `python3 /home/user/sprites_export/findcards.py <Datei> "<Karte>"`).
  Nur wo es eine Figur nachweislich nicht als Ebene gibt, darf sie aus dem Kartenbild kommen – dann sauber.
- **Einheitliche Pixelgröße je Tiefenebene.** Bewährt: jede Tiefenebene auf ihrem eigenen groben Raster bauen
  (Canvas 250/k × 350/k) und erst am Ende ganzzahlig hochskalieren. Keine 1-px-Linien auf dem 250er-Raster neben
  2×/3×-Sprites (auch Fäden, Ringe, Rahmenlinien nicht!), keine gemischten Größen nebeneinander.
- **Keine eigenen Rahmen/Randlinien** ins Bild zeichnen – die Rahmen kommen später einheitlich per Skript.
- Komposition wie bei den Nutzer-Favoriten (runde3: 07_porthole, 13_count_of_the_deep, 34_blood_eclipse,
  43_cybug_case): klares Hauptmotiv, ruhiger Hintergrund, Tiefenstaffelung.

## Nutzer-Feedback zu Runde 2 (verbindlich)
- **Detective Board (08) ist der Favorit** – Konzept, Anordnung und Stimmung beibehalten, nur technisch
  angleichen (Pixelgrößen: Fäden/Nadeln/Polaroid-Ränder im selben Raster wie die Fotos, Lupe vollständig,
  Fotos weiterhin pixelgenau aus den Kartenszenen).
- Spider Nest (04) „passt so“ – nur technisch angleichen.
- Pharaoh Tomb (05): Die Tafel mit dem Auge soll die **Mauertextur** behalten (nicht Wüste/Sand).
- Puppet Theater (03): **Alle Fäden** der Puppen müssen mit einem der beiden Puppenspieler (Tri Ad links,
  Tri Fecta rechts) verbunden sein.
- Divine Balance (10): Die Fassung **mit Strahlenkranz und Nebel** gefiel am besten (nicht die Galaxie-Variante).
- Guardian Zodiac (01), Gigantisaurs Comic (07), Cycling Demons (09) sind noch weitgehend aus Kartenbildern
  gebaut und brauchen die größte Überarbeitung. Beim Comic fehlen Pteranos und Spinor als xcf-Ebenen.
  Bei den Cycling Demons fehlen Hydrogen und Serpentous als Ebenen.

## Technik
- Arbeite in `data/sleeve-proposals/runde2/generator/`; bestehende Skripte `s01_zodiac.py`, `s03_puppets.py`,
  `s04_spiders.py`, `s05_egypt.py`, `s07_comic.py`, `s08_detective.py`, `s09_demons.py`, `s10_balance.py`
  überarbeiten (Dateiname des PNG bleibt gleich). Werkzeuge: `kit.py`, `xcfkit.py` (dort `sprite`, `compose`,
  `parts`, `part_at`, `scene_sprite`, `scenes_with`, `scene_layers`, `card_region_layers` …). Die Runde-3-Hilfsdateien
  (`runde3/generator/*_util.py`) darfst du lesen und Ideen übernehmen, aber nicht verändern.
- Sprite-Cache-Keys mit Präfix `r2_<nr>_…` (in `generator/sprites2/`), damit die Skripte ohne xcf laufen.
- Ausgabe 750×1050 PNG. Jedes Ergebnis selbst ansehen und verbessern, bis es wirklich gut ist.
- Keine git-Befehle, nichts außerhalb von `runde2/` ändern, fremde Sleeves nicht anfassen.
- Am Ende eine Zeile pro Sleeve in `runde2/notes_R2b.md` anhängen (Nr | Titel | Änderungen | Skalierung | Quellen)
  und eine kurze Zusammenfassung mit Restschwächen zurückmelden.
