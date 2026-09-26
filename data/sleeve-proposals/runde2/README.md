# Sleeve-Entwürfe – Runde 2

Zehn neue Sleeve-Vorschläge (750×1050), **ausschließlich aus Kartenbildern gebaut**: Figuren und
Hintergründe werden aus den Karten ausgeschnitten, auf ihr natives Pixelraster zurückgerechnet und dann
ganzzahlig skaliert, gespiegelt, gekachelt, umgefärbt oder neu angeordnet. Neu hinzu kommen nur Rahmen,
Schriftzüge (Spiel-Schrift „Pixel Intv“) und einfache Linien (Fäden).

Die Bilder liegen hier zur Auswahl, **nicht** in `data/shop/sleeves/`. Übersicht: `00_overview.png`.

| Nr. | Sleeve | Verwendete Karten |
|---|---|---|
| 01 | **Guardian Zodiac** – die zwölf Guardian Beasts als Tierkreis-Medaillons (Ratte oben, im Uhrzeigersinn), Yin-Yang in der Mitte | alle 12 „Guardian Beast …“, Charm of Balance (Yin-Yang, Steinboden), Guard Duty (Ziegelband), Guardian Beast Tu (Labyrinthmuster) |
| 02 | **Army of the Cute** – Mini vor Molindas Mosaik-Herz, umschwirrt von geflügelten Katzen und Fledermaus-Hasen | Pink Sky, Cute Angel Molinda (Herz, kleine Herzen), Cute Annoyance Mini, Army of the Cute, Cute Bunny |
| 03 | **Puppet Theater** – Tri Ad & Tri Fecta auf ihren Brücken, sechs Puppets an Fäden, Laki unter dem Regenbogen | alle 6 Puppet-Karten, Tri Ad the Puppet Mistress, Tri Fecta the Puppet Master (Vorhang, Bordüre, Bühne, Fadenfarben) |
| 04 | **Spider Nest** – Crimson Skull Spider am roten Faden in der Netzmitte, dazu Baby-, Brain-, Diamond- und Cute Spider | Trapping (Netz, Viertel gespiegelt), Crimson Skull Spider, Brain/Diamond/Cute Spider, Spider Hive (Höhlenboden) |
| 05 | **Pharaoh Tomb** – Grabwand mit dem Auge von Ren, Totenmaske, Ushabti, Mumienwächtern, Anubis und Urnen | Ushabti of the Great Pharaoh, The Eye of Ren, Soul Shard Ren, Noble Mummy Guards, Soul Shard Khet, Sarcophagus of Sealed Magic |
| 06 | **Slippery Slope** – die Slippery-Kreaturen rutschen mit ihren Schlieren übers gestreifte Eis | Slippery Pengu, Polar, Snowman, Whoolmoth, Skates, Snobbit, Ice (Wasserloch), Streifenmuster aus Slippery Polar |
| 07 | **Gigantisaurs Comic** – Comicseite mit vier Panels | Gigantisaur Pteranos, Raptoren (auch Blätterdach), Triceras, Spinor |
| 08 | **Detective Board** – Ermittlungswand von Great Detective Doq; seine Lupe vergrößert den Monkee-Dieb | Kaito Sid the Phantom Thief, Rakah the Loan Shark, Devlin the Masked Butcher, Criminal Monkee, Black Marketeer, Great Detective Doq (Lupe, Ziegelwand), Fadenfarben aus Crimson Skull Spider |
| 09 | **Cycling Demons** – das Pentagramm der Beschwörung, an seinen Spitzen die fünf Cycling Demons | Summoning Circle (Linien, Kerzen, Pflaster), Bouldor/Herbithorn/Hydrogen/Infernous/Serpentous Demon |
| 10 | **Divine Balance** – die goldene Waage vor Strahlenkranz und Nebel, Sonne und Mond halten sich die Waage | Divine Gift of Balance (Waage, Nebel), Divine Awakening (Strahlenkranz), The Cosmic Depths (Sterne, Mond), Light Ball (Sonne) |

## Generator

`generator/` enthält die Skripte (Python 3 mit Pillow, NumPy, OpenCV). Aus `generator/` ausführen,
z. B. `python3 s03_puppets.py`; das PNG landet in diesem Ordner.

- `kit.py` – gemeinsame Werkzeuge: natives Kartenraster (nutzt `../../generator/pp.py`), Freistellen per
  Flood-Fill (`cutf`), Farbregel (`cutrule`), Farbproben (`cut2`), Fäden entfernen (`string_mask`),
  Medaillons (`disc`), Spiegeln/Kacheln, Umfärben, Speichern
- `s01_zodiac.py` … `s10_balance.py` – je ein Sleeve
