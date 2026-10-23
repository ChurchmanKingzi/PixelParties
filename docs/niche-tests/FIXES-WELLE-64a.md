# Fix-Welle 64 (W64a) – Alice-Folgeregeln · Forceful Revival · Inyas Buddy · „defeat" als Kill via Effekt

Umgesetzt vom Agenten **W64a** (Zweig `wave64/W64a`) als Antwort auf Als Antworten (23.10.2026) zu den Rückfragen aus Welle 63 (`FIXES-WELLE-63.md`, `-63b.md`) und die Entscheidung des Orchestrators zu Forceful Revival (`-63d`). Details, Audit-Tabellen, Verträge: `cards/effects/CARD_API.md`, Abschnitt „Welle 64 / W64a"; Repros `docs/niche-tests/repro/W64/` (Exit 0 = korrekt).

| Punkt | Entscheidung / Befund | Umsetzung |
|---|---|---|
| **A1 Army of the Cute** | Al: „Sofern der Alice-Effekt aktiv ist, ja." | Ist-Zustand schon so; per Repro bestätigt (`a-01`). |
| **A2 Elixir of Immortality** | Al: „Ja." (alte Zone → geteilt → frei) | Ist-Zustand schon so; per Repro bestätigt (`a-02`). |
| **A3 Creature-Tokens teilen** | Al: „Ja, sollen sie!" | Die zentrale Zonenfrage hatte KEINE Token-Ausnahme; die Vorab-Prüfungen der Token-Quellen zählten nur leere Zonen. Biomancy, Kyli, Lizbeth-Biomancy, Inya, Invader from / Analyzer from the Cosmic Depths: „frei ODER geteilt" (`tokenZonePossible`, `geteilteSlotsBeiderSeiten`). Mummy/Leprochaun/Boulder/Pollution: begründet nicht betroffen. `a-03`. |
| **A4 Klick-Beschwörung** | Al: freie Zone darf trotz geteilter Zone gewählt werden | Server setzte die geklickte Zone schon; der Slot-Picker bietet jetzt ALLE geteilten (vorn) und ALLE freien Zonen an (`allSummonSlots`). Auto-Wege bleiben „geteilt zuerst". `a-04`. |
| **A5 „Gleiche Zone"-Ersetzungen** | Al: Stapel-Creatures sind kein legales Ziel | Audit aller „in its place / same Zone"-Karten (CARD_API-Tabelle): schon korrekt waren Garius, Kasperov [B], Rook [W], Hive's Crown, Rottweiler, Steam Dwarf Engineer, Villager, Suspicious Monster, Divine Gift, Encounter, Shapeshift, Castle, Deepsea-Bounce, Opfer-Beschwörungen. **Behoben:** 500 Piranhas (Stapel-Opfer + Ausweichzone), Life-Searcher (Kosten bezahlt, dann Fizzle), Wiederbelebung in die Alice-Zone (Bone Dog / Extra Life / Phoenix stapeln sich zurück), `actionPlaceCreature` überschrieb belegte Zonen (Geisterinstanzen) → verweigert. `a-05`. |
| **B Forceful Revival** | Orchestrator: Kosten-/Opferwahl VOR der Animation | `engine._beschwoerungKostenVorAuftritt` + `opts.nachKostenAnim` in `summonFromDiscard`/`-Deck`/`-Pile` (Deck, Hand, Potion Deck hatten dieselbe Lücke). `W63/d-07` ohne Ausnahme grün. `b-01`. |
| **C Inya** | Al: Spell in den Discard Pile | Buddy stirbt/verlässt das Feld → Ablage des Besitzers (`tokenStapelZiel`, `tokenAbgang(…, { geloescht })`); ausdrückliches „delete" und Biomancy-/Boulder-Token bleiben beim Gelöscht-Stapel. `c-01`. |
| **D „defeat" = Kill via Effekt** | Al: umgeht Schadensimmunität | `engine.actionDefeat` (Held `actionDefeatHero`, Kreatur `actionDestroyCard`) + opt-in Wirkungs-Schutz für Helden; Eraser Beam nutzt ihn (vorher 999999 Schaden). Schadens-Schutz greift nicht mehr (Inya/Immortal/Carris/Storm Piano/Egg of God/Monkee), Effekt-Schutz weiter. Audit aller „defeat"-Karten: sonst kein Schadens-Weg. Zeitpunkt unverändert. `d-01`. |

* **Nicht angefasst:** Kartentexte (`data/cards.json`), `repro-status.json`/Index, der ZEITPUNKT des Eraser-Beam-Kills.
* **Bugfix-Notes** stehen in den Commit-Nachrichten (je Karte/Baustein).
* **Tests (Exit 0 = korrekt):** `repro/W64/a-01 … a-05, b-01, c-01, d-01` (alle auf dem Stand vor W64a rot, soweit ein Fehler behoben wird; a-01/a-02 bestätigen den Ist-Zustand), Playwright `scripts/skilltest-e2e/ui-slot-picker-alice.js`. Tabelle mit Prüfungs- und ✗-Zahlen: CARD_API „Welle 64 / W64a", Abschnitt 9.
* **Gesamtlauf** (`runall`, alle 1307 Repros inkl. der 8 neuen): 1305 × „tritt NICHT auf" (= korrekt) + 2 Zeitüberschreitungen (`W39/a-11`, `W39/a-13`: unter 4 parallelen Läufen > 120 s, auch auf dem Ausgangsstand; einzeln grün in 54 s / 38 s). `scripts/check-*.js`: alle grün außer `check-scope.js` (51 Altstellen, wie im Ausgangsstand). `node scripts/build.js --force` + `check-bundles.js` sauber. E2E `cards`/`draw-cards`/`sacrifice`/`artifacts`: grün (`cards.test.js` ist flaky — die Zufalls-Szene der Golden Abomination: Ausgangsstand 1 von 4 Läufen rot, W64a 1 von 3 Läufen rot, sonst grün), `ui-shared-zone-summon`, `ui-click-path`, `ui-slot-picker-alice` grün.

## Rückfragen an Al (Ja/Nein)

1. Zwei Fantasy Buddys **verschiedener** Zauber (Token-Name gleich, Bild verschieden): gemeinsame Zone? Derzeit nur derselbe Zauber.
2. Wiederbelebung in eine Alice-Zone (Bone Dog, Trial of Coolness, Phoenix) stapelt sich zu den Namensvettern zurück (vorher: Fizzle nach bezahlten Kosten) – gewollt?
3. Resistance blockt jetzt Eraser Beams Helden-Defeat (W14-Ruling) – ja?
4. Getriggerte Effekte mit Kostenfrage nach der Animation (Skullmael's Greatsword): in Ordnung?
5. Soll der Wirkungs-Schutz (Zielschutz, Submerged, Charmed, Anti Magic/AME, Petrified) auch Hand of Death, Decapitating Strike, Kohta, Lunatic Golem, Midnight Assault abhalten (bisher nur bei Eraser Beam)?
