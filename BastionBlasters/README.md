# Bastion Blasters

Pixelart-Duell zweier verrückter Festungen in schräger Draufsicht: Fraktions-Kern wählen, Bastion bauen, Truppen wählen, alle zwei Wellen hält die Zeit an und beide Spieler ziehen eine frische Hand. Ziel: die gegnerische Bastion mit Artillerie zerstören **oder** mit Sturmtruppen erobern.

> **Eigenständiges Projekt.** Dieser Ordner hat nichts mit dem Spiel zu tun, in dessen Repository er gerade liegt. Er berührt keine Dateien außerhalb von `BastionBlasters/` und lässt sich unverändert in ein eigenes Repository kopieren.

**Stand:** GDD **v0.5** (modulare Bastionen, große Karte, Hof-Bauteile) mit Kartenkatalogen, Pixelart-Stilprobe und **ersten 17 Karten**. Noch kein Spielcode. Tech-Stack entschieden: Web (TypeScript, Vite, PixiJS).

## Dateien

| Datei | Inhalt |
|---|---|
| [`GDD.md`](GDD.md) | **Teil 1 — Spieldesign:** Vision, Welt, Spielablauf, Bastion (modularer Grundriss), Karten- und Ziehsystem, Truppen, Kampfsystem, Erfahrung, Fraktions-Kerne. |
| [`GDD-Praesentation-Technik.md`](GDD-Praesentation-Technik.md) | **Teil 2:** 16-Bit-Pixelart-Richtlinien (Dithering, Palette), Regie des Zeitstopp-Übergangs, UI-Wireframes, Audio, Technik-Vergleich, Balancing, Roadmap, Risiken, Fragen und Entscheidungen, Glossar, Tuning-Tabelle, Datenformat, Entscheidungsprotokoll. |
| [`katalog/01-gebaeude.md`](katalog/01-gebaeude.md) | **77 Bauteile** als Module, Turmzellen, Objekte und Wandkarten (Mauern, Türme, Heilung, Werkstätten, Freischalt-Räume, Plattformen, Utility, Abwehr, Chaos). |
| [`katalog/02-einheiten.md`](katalog/02-einheiten.md) | **77 Einheiten:** 18 Artillerie, 23 Sturm, 17 Verteidiger, 19 Zivilisten. |
| [`NOMENCLATURE.md`](NOMENCLATURE.md) | **Strenge Nomenklatur (englisch):** Spielbegriffe, Regeltext-Grammatik, Zahlenformate, Kartenaufbau. Erzeugt aus `daten/keywords.json`. |
| [`daten/`](daten) | **Maschinenlesbare Daten:** `cards.json` (alle 154 Karten, erzeugt aus den Katalogen mit `tools/export_cards.py`), `keywords.json` (Glossar), `card_text.json` (englische Kartentexte der ersten 17 Karten). |
| [`tools/`](tools) | Export (`export_cards.py`), Glossar-Helfer, **Linter** für die Nomenklatur (`lint_card_text.py`), Generator für `NOMENCLATURE.md`, Prüfung der Design-Dokumente (`check_catalogs.py`). |
| [`art/`](art) | **Pixel-Werkstatt:** Python-Code für alle Grafiken, Kartenrenderer; Ergebnisse in `art/out/` (Szenen, Einheiten, `karten/`). |
| [`katalog/03-kerne-und-weltlaunen.md`](katalog/03-kerne-und-weltlaunen.md) | **12 Fraktions-Kerne** in 4 Archetypen, 13 Welt-Launen, 8 Chaos-Karten, 6 Baustile. |

## Die wichtigsten Regeln in zehn Zeilen

1. **Modulare Bastion** in schräger Draufsicht auf einem **Baugrund von 16 × 16 Zellen** (Karte 56 × 28 Zellen). Start: **Kernhof 6 × 6** mit dem Kern in der Mitte und einem Tor; daran legt man **Module** (Räume ab 2 × 2, Türme, Objekte) und **Hofzellen** an, jede Bastion bekommt ihre eigene Form. **Mauern entstehen automatisch** auf den Zellkanten (dünn, 8 px); Wandkarten verbessern bis zu 4 Segmente.
2. **Fraktions-Kerne:** 12 Kerne in 4 Archetypen (Belagerer, Stürmer, Bollwerk, Tüftler) mit Passive, aktiver Fähigkeit, Linien-Affinität, kostenlosem Kern-Anbau und einer Schwäche.
3. **Ziehen:** Zu Beginn 10 ziehen, 7 behalten. Bei **jedem Zeitstopp eine komplett frische Hand**: 5 ziehen, 3 behalten; was nicht gespielt wird, verfällt.
4. **Truppen-Kontingent** (5–8 Plätze). Jede Karte hat *Soll* (Zielstärke) und *Nachschub* (pro Welle); die Truppen spawnen kontinuierlich nach. Doppelte Karten werten auf (★).
5. **Vier Kategorien:** Artillerie (auf Geschützplätzen, beschießt Bauteile), Sturm (dringt ein, tötet Zivilisten, erobert), Verteidiger (nur in der Bastion, sperren die Eroberung), Zivilisten (heilen, reparieren, verstärken).
6. **Beschuss:** Flach-Geschosse brauchen eine freie Schusslinie und tragen Mauern ab; Bogen- und Senkrecht-Geschosse treffen jede Zelle in Reichweite, kündigen sich aber per Zielschatten an. Reichweiten 26 / 34 / 42 / 50 Zellen: Frühe Geschütze erreichen den Kern des Gegners (≈ 30 Zellen) nicht.
7. **Personal:** Räume brauchen Bürger. Wer Zivilisten tötet, legt die Bastion lahm.
8. **Rückzugsregel:** Sturmtruppen unter 50 % HP laufen zur Heilquelle der Bastion; gibt es keine, kämpfen sie mit Todesmut bis zum Tod.
9. **Erfahrung für alle** (Zeit, Schaden, Heilung, Reparatur). Ränge R0–R5, Talent ab R3. Rückzug und Wiederkehr lohnen sich.
10. **Zwei Siege:** Kern zerstört (Explosion) oder Kernkammer erobert (Banner, Palette-Swap). Zwischen den Wellen friert die Welt in Dither-Frost ein, die Kamera taucht in die Bastion, danach taut alles exakt am selben Zustand wieder auf.

## Wie geht es weiter?

1. Restliche **Fragen** in Teil 2 §14 beantworten (alle haben einen Default, mit dem ich weiterarbeite).
2. **M1 — Pixel-Werkstatt & Stilprobe:** Pipeline für 16-Bit-Pixelart; die **Stilprobe v0.3** (große Karte, zwei modulare Burgen, Landschaft, Einheiten) und die **ersten 17 Karten** (`art/out/cards_overview.png`) liegen zur Freigabe vor (siehe `art/README.md`).
3. **M2 — Kampf-Greybox:** Bot-gegen-Bot-Partie mit Platzhalter-Grafik (Roadmap: Teil 2 §13.2).

Legende im Dokument: 🟦 aus dem Grobkonzept · 🟨 Ergänzung/Vorschlag (streichbar) · ❓ offene Frage · ✔ entschieden · ⚙ Tuning-Wert.
