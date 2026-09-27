# Block E – Sleeves 27–32, 55–56 (Runde 3b; Quellen v. a. MotiveMoe.xcf / MotiveBoons.xcf)

NN | Titel | Idee | Quellen | Skalierung
---|---|---|---|---
27 | Riss im Himmel (neu, ersetzt „Idol Live“ – Konzert-Doppelung) | Der Taghimmel bricht auf: dunkelroter Strudel mit rot glühenden Sprüngen, der Himmel ringsum verdunkelt sich, vier niedliche Wesen purzeln heraus, unten eine kleine Himmelsinsel als Maßstab | MotiveMoe: Hintergrund [553], Hole in the Sky #2 [360] (Sprünge, 2× gesetzt), Hole in the Sky #1 [359] (Wesen), Kleine Insel [447]; Strudel selbst gezeichnet (5 Rotstufen, Dithering) | alles 3× (natives Raster 84×117, als Ganzes verdreifacht)
28 | Fun-Fun Manege | Im rot-weißen Zelt präsentiert der Totenkopf-Direktor (Vordergrund) seine Artisten: Masken-Elefant jetzt auf seiner Zirkustrommel, Clown auf dem Ball, Strongman jetzt komplett mit Keule, Hand und Kette („1T“-Aufschrift übermalt); Ballons an der Kuppel | MotiveMoe: Director [25, 27, 28], Elephant [10–14] + Trommel aus [15], Strongman [17, 18, 19, 21] + Keule aus [20], Clown [36], Ballons aus [23]; Zelt/Manege/Licht selbst gezeichnet | Zelt, Manege, Licht, Ballons, Artisten 3×; Direktor 6× (angeschnittener Vordergrund)
29 | Drachenflug | Blue-Ice Dragon und Sorbereus ziehen über eine Himmelsinsel mit Wolkenbank, auf der Green und Red Dragoneer stehen (Eisatem entfernt – traf vorher nichts) | MotiveMoe: Hintergrund [553], Ebene #64 [122] (Wolken), Kleine Insel [447], Blue-Ice Dragon [203], Sorbereus [299], Green Dragoneer #1 [2], Red Dragoneer [5] | alles 3× (vorher 1×/2×/3×/4×/5× gemischt)
30 | Besuch aus der Tiefe | Nachts: rote Sonne und Mutterschiff im All, Life-Searcher ziehen mit grünen Strahlen Gartenzwerg und Cheerleader-Häschen von einer kleinen Himmelsinsel | MotiveBoons: Ebene #21 [4], #35 [25], #36 [22] (+ Strahlform #37 [23]); MotiveMoe: Hintergrund [553], Kleine Insel [447], Inconspicuous Lawn [212], Cheering Rabbit [442] (Pompom ergänzt, s. u.) | alles 2× (vorher Insel/Himmel 1×, Schiff 3×)
31 | Phönix-Aufstieg | Prinzessin Mary in Phönixgestalt vor rot abgesetztem Flammenkranz und Strahlenkranz im rosa Himmel, unter ihr die Säulen des Tempelplatzes, Feuervögel begleiten sie (gedrehter „Blutstropfen“-Schweif entfernt) | MotiveMoe: Hintergrund-Kopie #1 [556], Mary-Kopie + Mary #1 [486, 487], Mary #3 [488], Relic-Insel [478], Ebene #105 [220]; Strahlen gedithert | alles 3× (vorher 1×/2×/3× gemischt)
32 | Leiter zum Himmel | Vertigo-Blick über die Inselkante: Leiter ins Nichts, Kletterer steigt herauf; der Himmelsarchäologe gräbt jetzt links vom Pfad auf festem Gras (Spitzhacke im Boden statt über der Kante), Fledermaus-Häschen unter der Insel | MotiveMoe: Hausinsel + Ladder to the Sky [457, 449], Mine Mine Mine [459] (grabender Archäologe), Hintergrund [553], Ebene #64 [122], Cute Bunny #1 [429] | alles 3× (vorher Himmel 1×, Häschen 2×/1×)
55 | Zwei Schnitterinnen (neu) | Licht und Schatten: Lizbeth (goldene Sense) und ihr dunkles Gegenstück (rote Sense) stehen wappenartig gespiegelt vorn im Mittelgang, die Sensenblätter rahmen den Altar; dahinter die abgedunkelte Kathedrale mit Orgel und Lichtsäulen | MotiveBoons: Ebene #12 [62] (Kathedrale, eingebackene Nebenfigur per Spiegelung entfernt), Ebene #13 + #15 [60, 59] (Lizbeth, Funkenstriche der Sense entfernt), Ebene #16 [57] | Kathedrale 2× (Hintergrund), Schnitterinnen 5× (Vordergrund am unteren Rand)
56 | Der Herzbogen (neu) | Stillleben bei Nacht: der Heart-Shaped Bow ruht auf dem Altarstein im Säulenheiligtum, hinter ihm eine Orakel-Statue; nur der Altar liegt im Licht (6 harte Helligkeitsstufen), rosa Herzen steigen auf | MotiveMoe: Relic-Insel [478], Ebene #8 [145] (Statuen), Heart-Shaped Bow [467], Ebene #2 [468] (Herzen) – Originallage wie Szene „Sichtbar #14“ | alles 3×

## Regel-B-Prüfung (Vollständigkeit)
Werkzeug: `generator/e_util.py` – `scenes_for` (Szene, in der die Figur vorkommt), `extra_layers` (ALLE Ebenen der
Datei, deren Pixel im Szenenabzug innerhalb der erweiterten Figurenbox sichtbar sind) und `compare`
(Szene | Sprite nebeneinander). Befunde:
- 30 Cheering Rabbit: kein Vorlagen-Fehler, sondern Zuschnitt – die Ebene zeigt drei Häschen, beim rechten
  wurde vorher an Spalte 48 abgeschnitten, der linke Pompom verlor 3 Spalten (und liegt teils hinter dem Pompom
  des mittleren Häschens). Figur ist symmetrisch → linke Arm-/Pompom-Hälfte aus der rechten gespiegelt.
- 28 Strongman: Keule (Teil von Ebene 20), Hand (21) und Kette (17) fehlten; Elefant: Trommel (Teil von 15) fehlte.
- 55 Lizbeth: Sense ist eigene Ebene (59), ergänzt; Funkenstriche der Sense in der Szene unsichtbar → entfernt.
- Geprüft und vollständig: Director, Clown, Mary, Blue-Ice Dragon (+Atem 204 bewusst weggelassen), Sorbereus,
  Green/Red Dragoneer, Gartenzwerg, Mutterschiff, Invasoren, Archäologe (459), Leiter/Kletterer, Hole-Wesen (359),
  dunkle Schnitterin (57), Herzbogen (467).

Hilfen: `generator/e_util.py` (`upcanvas`/`small_canvas`: Szene im groben Raster bauen und als Ganzes skalieren →
einheitliche Pixelgröße inkl. Dithering/Vignette). Sprites: generator/sprites3/e27_…–e56_…. Skripte:
s27_riss_im_himmel.py, s28_circus.py, s29_dragons.py, s30_abduction.py, s31_phoenix.py, s32_ladder.py,
s55_zwei_schnitterinnen.py, s56_herzbogen.py.
