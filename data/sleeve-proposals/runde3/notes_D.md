# Block D – Sleeves 20–26 + 54 (Quelle: MotiveGrailWar.xcf)

Runde 3b: Alle Sleeves werden jetzt im nativen Raster komponiert (Leinwand 250/k × 350/k) und erst am Ende
ganzzahlig hochskaliert (`native()` / `finish()` in generator/d_util.py). Damit hat jedes Element – Hintergrund,
Figuren, Effekte, Dithering, Schatten – dieselbe Pixelgröße. Keine gemischten Skalierungen mehr.

NN | Titel | Idee | Quellen | Skalierung
---|---|---|---|---
20 | Trex Breach | Der Gigantisaurier-König mit Flammenkrone bricht durch das zertrümmerte Burgtor: Rumpf und Schwanz noch im dunklen Torgang, Kopf vor dem rechten Turm, Füße auf dem Weg (Staub, Schatten). Zinnenquader und Torbretter fliegen, Stadtwache und Bürger fliehen | 706 Schloss Front (Fassade, Weg, Trümmer), 513 Trex + 512 Flammenkrone (lt. Szene „Sichtbar #120“ Teil der Figur), 676 Doomed Town Guard, 593 Ebene #52; Bruchkante/Dunkel/Staub selbst gezeichnet | alles 2× (Burg, T-Rex, Figuren, Trümmer, Effekte)
21 | Skulltop Storm | Skulltop-Burg auf dem Gigantisaurier-Schädel in der Gewitternacht, Blitz schlägt in die goldene Turmspitze, Schneeregen, vereister Grat, Nachtschnee | 490 Skulltop Castle, 496 Gigantisaur Skull (Lage wie im Motiv), 476 Eisgrat (nachtblau, Hänge umgefärbt); Himmel, Wolken, Blitz, Regen, Schneefeld selbst gezeichnet | alles 3× (Blitz und Regen jetzt 1 natives Pixel = 3×)
22 | The Summoning | Kellergewölbe: auf dem Holzpodest glüht der Beschwörungskreis magenta, Entladungen springen von den Kerzen zum Energiekern, darüber schwebt der Geist des Super-Killing-Messers; vorn steht Kohta mit Anleitung und Messer | 697 Beschwörungsraum Keller (Kreis magenta umgefärbt, abgedunkelt), 664 Knife Spirit, 565 Summoning Instructions, 482 Zi #4 (Funkeln); Licht/Entladungen selbst gezeichnet | alles 3×
23 | Generals' Duel | Tharx steht in der Loggia des Tempels (Original-Lage aus der xcf, Beine hinter der Brüstung) und zeigt auf Garius, der unten rechts mit Schild und Speer steht; vorn die Legion von hinten, dem Tempel zugewandt (Anordnung wie auf Garius' Karte) | 226 Tempel mit Loggia (Dach entfernt), 224 Tharx-Kopie, 216 Garius, 214 Legionäre, 228 Himmel/Wolken/Pflaster | alles 3× (Legion vorn nicht mehr kleiner als die Generäle)
24 | Crossing the Alps | Kartenansicht eines vereisten Passes im Schneetreiben: oben ziehen zwei Lastelefanten über den Grat, am Hang kommt der Sandrüssel-Elefant herab (Spuren im Schnee), vorn führt Hatusbal im roten Mantel | 476 Eisklippe/Schneefeld, 205 Taunting Elephant (Läufer ohne Krone, Hatusbal), 199 Trunk Sand (nur der Elefant), 711 Funkeln als Flocken | alles 3×; drei verschiedene Elefanten-Sprites statt sieben gleicher
25 | Blackstache's Bow | Blackstache steht wie auf seiner Karte vorn auf dem Bugspriet und reckt den Säbel übers Meer; am Bug wacht der Doomed Pirate, Möwen kreisen, eine Meeresschildkröte zieht vorbei | 328 Meer, 325 Schiff (Bug + Bugspriet), 323 Blackstache, 559 Doomed Pirate, 121 Möwen, 542 Populated Island Turtle | alles 3× (Kapitän, Crew, Schiff, Meer, Tiere gleich)
26 | Weapon Storm | Xal im roten Glühen seiner Rüstkammer entfesselt den Waffensturm: sechs verschiedene Waffen (2 Schwerter, 2 Hellebarden, 2 Pfeile) schießen gestaffelt mit Tempo-Linien nach oben – keine Kachel-Kopien mehr | 401 XAL, 402 Weapon Storm (Schwert + Hellebarde einzeln freigestellt), 397 Ebene #283 (Schwert, Pfeil, Hellebarde), 390 Pfeil, 694 Quadermauer (rot getönt); Glühen/Boden/Tempo-Linien selbst gezeichnet | alles 3×
54 | Witching Hour | Nacht über der Waldhütte: Fenster und offene Tür glühen warm, die Hexe mit Besen steht im Lichtschein auf der Schwelle, der Elfendruide kommt mit grün leuchtender Kugel den Waldweg herauf, Glühwürmchen | 596 Cottage (nachtblau umgefärbt), 107 Hexe, 139 Elven Druid; Nachtfärbung, Fenster-/Türlicht, Lichtkegel, Kugelschein, Glühwürmchen selbst gezeichnet | alles 2×

Vollständigkeit (Regel B) geprüft über `card_region_layers` der jeweiligen „Sichtbar“-Szene: T-Rex bekam seine
Flammenkrone (512) zurück; Xal/Weapon Storm (Szene #106/#79), Hatusbal (#115), Taunting Elephant (#31), Trunk
Sand (#118), Hexe (#146), Garius (#109), Flintlock/Doomed Pirate, Doomed Town Guard ohne weitere Teilebenen.
Blackstaches gelbe Funken (322) sind ein Karteneffekt und bewusst weggelassen.

Hilfsfunktionen: generator/d_util.py. Sprites: generator/sprites3/d2*.png, d54*.png.
