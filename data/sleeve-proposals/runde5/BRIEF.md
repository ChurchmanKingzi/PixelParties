# Auftrag: Helden-Sleeves für Pixel Parties (Runde 5)

Eine Reihe von Sleeves, die jeweils EINEN Helden in den Mittelpunkt stellen. Es gelten ALLE Regeln aus
`../runde4/BRIEF.md` (bitte vollständig lesen: nur vorhandene Grafik, Effekte selbst zeichnen, kein Text,
einheitliche Pixelgröße je Tiefenebene, vollständige Figuren, korrekte Positionierung/Logik, ausgewogene
Komposition, Fäden 1 px hell/dunkel, Rahmenzone ~22 px frei halten, Werkzeuge, Ablieferung). Zusätzlich:

## Helden-Regeln (Nutzer-Vorgaben, VERBINDLICH)
1. **Immer die Base-Version** des Helden – keine Ascended-Heroes, keine Skins, keine Varianten.
   Ausgeschlossen sind z. B.: Monia Bot, Cool Birthday Girl Monia, „Monia Skin“, Slimonia, Chibi-Monia,
   „Ascended Champion“ / Champion, the Eye of the Storm, Alice, the Transfer Student / „Transfer Alice“,
   „Blackport Mini“ und alle anderen Umfärbungen/Kostüme. Maßgeblich ist das Kartenbild der Base-Karte in
   /home/user/PixelParties/cards/ (Heldenkarten haben ein eigenes Layout: das Bild liegt etwa in x 100–650,
   y 130–590; `findcards.py` findet sie deshalb nicht immer zuverlässig).
2. **Der Held ist das Hauptmotiv**: groß, präsent, klar lesbar (typisch 4×–6×), pixelgenau vollständig aus den
   xcf-Ebenen zusammengesetzt und gegen das Kartenbild/die Sichtbar-Szene geprüft (Waffen, Umhänge, Effekte,
   Accessoires, die auf der Base-Karte zu sehen sind, gehören dazu). Keine anderen Figuren gleich groß daneben.
3. **Charakter zeigen**: Umgebung, Requisiten und Nebenfiguren sollen erzählen, wer der Held ist – seine
   Fähigkeiten (Kartentext, Starting Abilities), seine Heimat, typische Karten/Kreaturen, die zu ihm gehören.
   Kartentexte: /home/user/PixelParties/data/cards.json. Suche passende Begleit-Karten (gleicher Name im Text,
   gleiches Thema) und nutze deren Grafik. Keine Szene, die einer bestehenden Sleeve-Idee gleicht.
4. Die Reihe soll zusammenpassen, aber jedes Sleeve eine eigene Bildidee haben (Porträt, Action-Szene,
   Ruhemoment …). Rahmen-Vorschlag passend zum Helden.

## Bekannte Fundstellen (Kartenszene = „Sichtbar“-Ebene mit dem Kartenbild; bitte selbst verifizieren)
- Cool Rescuer Monia: Kartenbild zeigt Monia mit grünen Düsen-Flügeln vor einem Herz; Ebenen „Monia“,
  „Monia #1/#2“, „Monia-Kopie“ in MotiveMoe (ca. 508–512) – prüfen, welche die Base-Version ist
  (NICHT 502 „Monia Skin“, 503 „Slimonia“, 303–305 „Birthday Monia“); evtl. auch MotiveRussia 218 „MONIA“.
- Broghan, the Frozen Guardian of the North: MotiveGrailWar, Szene 108 (Lage 233,97), Ebenen 472/473 „Broghan“.
- Kyli, the Deceptive Sapling: MotiveGrailWar, Szene 147 (Lage 237,48), Ebene 149 „Kyli“.
- Champion, the Stormbringer: MotiveJapan, Szene 1 (Lage 307,237), Ebene 121 „Champion“
  (NICHT MotiveHawaii 178 „Ascended Champion“).
- Cute Annoyance Mini: MotiveMoe, Szene 101 (Lage 100,259), Ebenen 494–499 „Mini …“ (Base prüfen).
- Alice, the Puppeteer Girl: MotiveBritain, Szene 5 (Lage 218,288), Ebenen „Alice #4/#6/#7“ (8, 58, 59).

## Ablieferung
Wie in Runde 4, aber im Ordner `runde5/`: `runde5/NN_kurzname.png` (750×1050, ohne Rahmen),
`runde5/generator/sNN_kurzname.py`, Sprite-Keys mit Präfix `hNN_`, Notizzeile in `runde5/notes.md`
(per `cat >> notes.md <<'EOF'` anhängen, nie überschreiben):
`NN | English Name | Held | Idee | Skalierung | Quellen | Rahmen: form/palette/stein[/stein2]`.
Keine git-Befehle, keine Dateien außerhalb von runde5/ ändern.
