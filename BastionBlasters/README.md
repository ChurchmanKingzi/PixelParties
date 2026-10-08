# Bastion Blasters

Pixelart-Duell zweier verrückter Festungen im Querschnitt: Bastion bauen, Truppen wählen, alle zwei Wellen hält die Zeit an und beide Spieler rüsten nach. Ziel: die gegnerische Bastion mit Artillerie zerstören **oder** mit Sturmtruppen erobern.

> **Eigenständiges Projekt.** Dieser Ordner hat nichts mit dem Spiel zu tun, in dessen Repository er gerade liegt. Er berührt keine Dateien außerhalb von `BastionBlasters/` und lässt sich unverändert in ein eigenes Repository kopieren.

**Stand:** Schritt 1 — GDD v0.1 mit Kartenkatalogen. Noch kein Code.

## Dateien

| Datei | Inhalt |
|---|---|
| [`GDD.md`](GDD.md) | **Teil 1 — Spieldesign:** Vision, Welt, Spielablauf, Bastion, Karten- und Ziehsystem, Truppen, Kampfsystem, Erfahrung, Kerne. |
| [`GDD-Praesentation-Technik.md`](GDD-Praesentation-Technik.md) | **Teil 2:** Pixel-Art-Richtlinien (Dithering, Palette), Regie des Zeitstopp-Übergangs, UI-Wireframes, Audio, Technik, Balancing, Roadmap, Risiken, **offene Fragen**, Glossar, Tuning-Tabelle, Datenformat. |
| [`katalog/01-gebaeude.md`](katalog/01-gebaeude.md) | **77 Bauteile** (Mauern, Türme, Heilung, Werkstätten, Freischalt-Räume, Plattformen, Utility, Abwehr, Chaos). |
| [`katalog/02-einheiten.md`](katalog/02-einheiten.md) | **77 Einheiten:** 18 Artillerie, 23 Sturm, 17 Verteidiger, 19 Zivilisten. |
| [`katalog/03-kerne-und-weltlaunen.md`](katalog/03-kerne-und-weltlaunen.md) | 9 Kern-Typen, 13 Welt-Launen, 8 Chaos-Karten, 6 Baustile. |

## Die wichtigsten Regeln in zehn Zeilen

1. **Querschnitt-Raster** (max. 8 × 6 Zellen, Start 6 × 4). Der Kern sitzt in der Mitte, die Kernkammer ist ein begehbarer 2 × 2-Raum.
2. **Bauteile sind Karten** mit Tier I–IV. Bastionen entstehen aus einem zufälligen Loadout (14 Karten), später zieht man in jeder Pause 5 Karten und behält 3.
3. **Truppen-Kontingent** (5–8 Plätze). Jede Karte hat *Soll* (Zielstärke) und *Nachschub* (pro Welle); die Truppen spawnen kontinuierlich nach. Doppelte Karten werten auf (★).
4. **Vier Kategorien:** Artillerie (auf Geschützplätzen, beschießt Bauteile), Sturm (dringt ein, tötet Zivilisten, erobert), Verteidiger (nur in der Bastion, sperrt die Eroberung), Zivilisten (heilen, reparieren, verstärken).
5. **Beschuss mit Exposition:** Geschosse treffen nur die jeweils äußerste Zelle ihrer Flugbahn. Zerstörte Zellen werden Breschen und öffnen den Weg zum Kern.
6. **Personal:** Räume brauchen Bürger. Wer Zivilisten tötet, legt die Bastion lahm.
7. **Rückzugsregel:** Sturmtruppen unter 50 % HP laufen zur Heilquelle der Bastion; gibt es keine, kämpfen sie mit Todesmut bis zum Tod.
8. **Erfahrung für alle** (Zeit, Schaden, Heilung, Reparatur). Ränge R0–R5, Talent ab R3. Rückzug und Wiederkehr lohnen sich.
9. **Zeitstopp nach je zwei Wellen:** Die Welt friert in Dither-Frost ein, die Kamera taucht in die Bastion, man zieht und baut, danach taut alles exakt am selben Zustand wieder auf.
10. **Zwei Siege:** Kern zerstört (Explosion) oder Kernkammer erobert (Banner, Palette-Swap).

## Wie geht es weiter?

1. Die **offenen Fragen** in Teil 2 §14 beantworten (jede hat einen Default, mit dem ich weiterarbeite).
2. **M0:** Kataloge als JSON/YAML exportieren (Format: Teil 2, Anhang B) und die Tuning-Tabelle als Datei anlegen.
3. **M1:** Kampf-Greybox mit Platzhalter-Grafik und Bot-gegen-Bot-Partie (Roadmap: Teil 2 §13.2).

Legende im Dokument: 🟦 aus dem Grobkonzept · 🟨 Ergänzung/Vorschlag (streichbar) · ❓ offene Frage · ⚙ Tuning-Wert.
