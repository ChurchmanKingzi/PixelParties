# Fix-Welle 49 – Elixir of Strength, Ricochet, Afflicted Pests, Prototypes, Magic Ruby, Thalia, Surprise Party, Gather Intel, Symbol-Umbruch

Al hat am 22.10.2026 eine Liste kleiner Änderungen gegeben. Umsetzung durch drei Agenten (**W49a**, **W49b**, **W49c**, Zweige `wave49a/W49a` … zusammengeführt) plus zwei direkte Änderungen. Details: `cards/effects/CARD_API.md`, Abschnitte „Welle 49 / W49a" und „W49b"; Repros `docs/niche-tests/repro/W49/a-01 … a-06`, `b-01`.

## Entscheidungen von Al und Umsetzung

| Karte / Thema | Wunsch von Al | Ergebnis |
|---|---|---|
| **Elixir of Strength** | Bonus 100 → 150 | `EMPOWERED_STRIKE_BONUS` = 150, Kartentext angepasst (Balancing, keine Bugfix-Note) |
| **Ricochet** | Gibt die Hälfte des **vollen** verursachten Schadens weiter (inkl. Elixir-/Pfeil-Boni) | Kettenschaden aus dem tatsächlich verursachten Gesamtschaden (`opts.kettenFolge/vollOut`) |
| **Afflicted Pests** | Soll auch bei Anhängseln (Divine Gift of Coolness u. a.) auslösen | Alle Anlegewege geprüft; Fenster-Lücken bei Gate to the Armory, Overcharge, Initiation Ritual, Tempeluna geschlossen |
| **Future Tech Prototypes** | Neuer letzter Satz: beliebig viele Prototypes, aber je Kartenname (kopierter Name) max. einer pro Zug | Marke `gs.hoptUsed['ft-prototypes-name:<Spieler>:<Name>']`; Text in `cards.json` |
| **Magic Ruby** | „You can only play 1 "Magic Ruby" per turn." | Hartes Limit pro Zug, Text ergänzt |
| **Thalia, the Fun Fairy** | „You can only activate 1 copy of each Support Spell per turn." | Sperre `thaliaSupportSperre`/`thaliaNotiereSupportZauber`; Text mit Support-Symbol |
| **Surprise Party** | Neuer Text: 5-Karten-Grenze, Zug endet immer sofort, Kreaturen mit „nur"-Beschwörungsbedingung (Foresta …) sind keine legalen Ziele; Flug-Optik | Umgesetzt (W49b); Flug in die Support Zone in Zonengröße |
| **Gather Intel** | Stufe 0 → 2 | `cards.json` (Balancing) |
| **Kartenbild-Umbruch** | „[Decay] or [Support] Spells" soll zusammenbleiben, ähnlich bei anderen Karten, mit den kleinen Symbolen | `public/card-render.js`: allgemeine Regel `GLUE_SYM_RE` klebt „Symbol(e) + Spell(s)" per NBSP zusammen (nach der Symbolisierung, damit „Support Magic" nicht kaputtgeht); zusätzlich per-Karte `glue` in `data/card-render.json` (Thalia) |

## Ergebnis in Zahlen

* Repros: **alle 1237 grün** (vorher 1230; 7 neue), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand); `check-bundles` grün.
* Skilltest-E2E (mit `NODE_PATH`): cards, draw-cards, sacrifice, artifacts grün.
* Kartenbilder Thalia/Rafflesia/Junshi per Playwright geprüft.

## Nicht getestet / Hinweise

* Der „ganz negiert"-Rollback und die Support-Reaktion im echten Kettenfenster (Thalia) sind im Harness nicht abbildbar; Divine Awakening / Anti Magic Enchantment / Tempeluna-Pests nur teilweise testbar.

## Offene Rückfragen an Al

1. **Ricochet:** Sollen Senkungen/Schilde des Vorgängerziels mitgegeben werden? Aktuell nur Erhöhungen. Und dürfen dauerhafte Pfeil-Boni beim Folgetreffer erneut wirken? Aktuell nein.
2. **Slippery Fridge vs. Inheritance Ceremony:** Unterscheidung der Anlegefenster so gewollt?
3. **Tempeluna / Initiation Ritual** öffnen jetzt das Pests-Fenster – so gewollt?
4. **Thalia** zählt auch Support-Reaktionen und Zweitwürfe, und nur solange sie aktiv ist – korrekt?
5. **Surprise Party:** Plant Golem/Elusive Hind sind keine legalen Ziele (werden in die Zonen des Nutzers gelegt), Ifrit ausgeschlossen; Kreaturen mit alternativer Beschwörung (Archer, Spiders …) bleiben legale Ziele – so gewollt?
