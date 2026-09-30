# Avatare aus den Motiven (PixelPartiesSprites)

Regel: Avatare werden NUR aus den Motiv-xcf-Dateien (Repo PixelPartiesSprites, Git LFS) gebaut, nie aus Kartenbildern
(die sind interpoliert/verschwommen).

1. `export_xcf.py <Motive…>` – Ebenen nach `/home/user/sprites_export/<Datei>/` (layers.json + crops/) exportieren
   (Python-Paket `gimpformats`; bei „old sample points“ die Stelle in GimpIOBase.py überspringen).
2. `find_avatars.py` – Original-Avatar pixelgenau (1:1) in den Ebenen suchen.
3. `scenes_for.py`, `frames_for.py` – Szenenebene mit Hintergrund und Kartenbild-Rahmen bestimmen (Karte nur zum Lokalisieren).
4. `build_replacements.py` – quadratischen Ausschnitt schneiden, ganzzahlig vergrößern.
Die Pfade sind noch auf die Session-Umgebung (/home/user/…) gesetzt.
