# Avatar-Generator

**Regel: Avatare werden ausschließlich aus den Motiven (Repo PixelPartiesSprites, `*.xcf` via Git LFS) gebaut – nie aus
den Kartenbildern (`cards/`), die sind vom Kartenprogramm interpoliert und damit verschwommen.**

- `picks.py` – Liste der neuen Avatare: (ID, Kartenname, cx, cy[, Kantenlänge]). Die Karte dient nur dazu, die Szene in den
  Motiven zu finden; cx/cy (Mittelpunkt) und Kantenlänge sind in Kartenraster-Einheiten (152×99), Standard 64 = 32 Motiv-Pixel.
- `motive/` – Werkzeuge: Ebenen exportieren (`export_xcf.py`), Szenen der Karten finden (`locate_cards.py`), beste Ebene je Karte
  (`refine_layers.py`), Avatare bauen (`neue_avatare.py`), bestehende Avatare in den Motiven wiederfinden
  (`find_avatars.py`, `scenes_for.py`, `frames_for.py`, `build_replacements.py`). Siehe `motive/README.md`.
- Ausgabe: `data/shop/avatar-entwuerfe/motiv/` (nicht eingecheckt), übernommene Avatare liegen in `data/shop/avatars/`.
  Der Shop liest das Verzeichnis automatisch ein.

## Gegner-Avatare (erster CPU-Sieg)

Jeder CPU-Gegner hat als Avatar das Portrait seines Helden (der quadratische Mittelausschnitt der Szene, den das Spiel auch als
CPU-Avatar zeigt). Der **erste Sieg** gegen ihn schaltet den Avatar frei (`cpu-avatars.js`, Zuordnung `data/shop/cpu-avatars.json`).
Die Bilder liegen in `data/shop/avatars/` (wie alle Avatare) und stehen nicht im Shop-Katalog.

- `motive/cpu_gegner.py` – Gegner und Portrait-Helden aus `data/SampleDecks`.
- `motive/cpu_avatare.py` – baut Bilder und `cpu-avatars.json` aus den Motiv-Szenen. Vorher für die Helden-Karten
  `locate_cards.py` und `refine_layers.py` laufen lassen (`REFINE_EXTRA=$(python3 cpu_avatare.py --helden)`).
- Gegner ohne Bild (Szene in den Motiven nicht sauber gefunden): Vacarn, Alleria, Beato, Toras, Baaliel, Sol Rym, Nero Zira, Reiza,
  Bakhm, Stellan, Layn, Archibald, Chaos-Diamond (kein Kartenbild), Argos (nur Hintergrund). Sobald ein Bild in `data/shop/avatars/`
  liegt und in `cpu-avatars.json` steht, ist der Avatar aktiv.
- Shop-Avatare, die denselben Helden zeigen wie ein Gegner-Avatar, wurden entfernt (18 Stück).
