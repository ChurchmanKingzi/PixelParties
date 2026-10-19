# Fix-Welle 17/18 – Antworten auf die Rückfragen der Welle 16 und die letzten großen Fälle

Al hat das Go für die restlichen Fälle gegeben und die 17 Rückfragen aus [FIXES-WELLE-16.md](FIXES-WELLE-16.md) beantwortet (19.10.2026). Sechs Agenten haben gearbeitet: **W17a** (Kazena, Willy, Piranha-Ersetzen-Regel, Diver, Scrap Plow), **W17b** (Golden Wings), **W17c** (Bow of the Hunt Goddess), **W17d** (Love Shot), **W18a** (Swagdri, Relic Hammer, Divine Gift of Rain/Skill), **W18b** (Anti Magic Zone, Guard Change, Dark Ocean, Repro-Umstellungen). Alle Zweige `wave17/*` und `wave18/*` sind zusammengeführt (Konflikte nur am Ende von `CARD_API.md`, alle Abschnitte behalten).

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Kazena (H02-22) | „Doch, Kazenas Effekt KANN bei leerem Deck aktiviert werden – und führt dann zu Niederlage durch Deck-Out." | Aktivierbar, Folge Deck-Out beim Ziehen (die Engine löste das schon aus; Repro auf die neue Regel umgestellt) |
| Willy (H04-08) | „Ja, wenn Willy irgendwie ‚deaktiviert' ist, ist das Handlimit wieder da." | Handlimit-Freiheit folgt Willys Zustand (tot, gefroren, betäubt, negiert) |
| Pollution Piranha (A01-20) | „… generelle Regel für ALLE Creatures, die andere Karten in Support Zonen ersetzen … NUR für Zonen, in denen exakt eine Karte liegt." | `zoneFreiNachKostenzahlung`; Piranha und Gigantisaur King Trex nutzen den Ersetzen-Vertrag; alle vorhandenen Ersetzen-Karten (Teocuilatl-Trio, Suspicious Monster, Egg of God, Blue-Ice Dragon, Foresta, Dragon Pilot, Dark Deepsea God, Deepsea-Linie) nehmen nur noch Zonen mit genau einer Karte (Alice-Stapel bleiben unberührt) |
| Magic Modifier / Doomsday Bomb / Cosmic Depths / Snobbit | „Ja" / „Ja, die Schadenswert der Attacke ist egal" / „Das ist okay" / „Ja" | Ist-Zustand bestätigt, per Repro abgesichert |
| Steam Dwarf Diver (A03-06) | „… bei <=100 HP (current oder max) gar nicht aktivierbar" | Nicht aktivierbar bei ≤ 100 aktuellen oder max. HP |
| Scrap Plow (A03-16) | „… gilt grundsätzlich für Effekte, die ‚any card on the board that is not a Hero' treffen können" | Verdeckte Surprises wählbar; Coolness Overcharge, Tengu Windstorm, Ralzish, Sparkfly Worker/Queen auf klickbare ID `surprise-<Seite>-<Held>` angeglichen |
| Golden Wings (A01-25) | (Go für zu große Fälle) | Eigene Marke `_gwImmune`, zentrale Prüfung `kreaturGegnerEffektImmun`: nur Quellen des Gegners wirken nicht; eigene Effekte wirken; unbekannte Quelle bleibt geschützt; Cardinal Beasts unverändert |
| Bow of the Hunt Goddess (F01-17) | (Go) | Neue Reaktionsquelle „Ausrüstung am kontrollierten Helden" im Ketten-Kern (~80 Zeilen, ohne Bow vollständig stumm); Pfeil aus dem Deck, Kosten, einmal pro Zug |
| Love Shot (S02-15) | (Go) | Heldenwahl und Nachguss nach Kontrolleur; vom Gegner kontrollierter eigener Held wird angeboten (temporäre Charme-Marke) |
| Resistance blockt eigene Spell-Anhänge | „Ja" | Ist-Zustand |
| Fire Bomb am Helden | „Nein" | Ist-Zustand (Ability-Removal wird nicht geblockt) |
| Inheritance Ceremony vs. Resistance | „Nein" | Ist-Zustand |
| Swagdri (A04-30) | „Ja, deleten" | Von Swagdri ausgespielte Ausrüstung wird dauerhaft in den Gelöscht-Stapel umgeleitet, wenn sie in die Ablage ginge (endet bei Hand/Deck) |
| Skeleton Bard (A05-19b) | „Ja" | Darf ein diesen Zug beschworenes Skelett wählen (Ist-Zustand, Repro umgestellt) |
| Big Gwen + Grinning Cat (A08-06) | „Nein" | Nicht spielbar (Ist-Zustand, Repro umgestellt) |
| Dominance + Paraseed (A08-12) | „Einnisten" | Ist-Zustand, Repro umgestellt |
| Grave Worm | „Nicht auslösen, außer eine eigene Creature geht in den eigenen Discard, wo der Wurm wartet" | Ist-Zustand, Mini-Repro |
| Relic Hammer (C04-05) | „Auch der Gegner ohne Hammer-Spirit bekommt den Buff einmal pro Runde." | Irgendein wirksamer Spirit genügt; Haste für die erste Kreatur jedes Spielers pro eigenem Zug |
| Divine Gift of Rain (R01-05) | „Nur eigene Ziele werden beschützt!" | Bei Karten, die auch fremde Ziele treffen, bekommt jedes eigene Ziel Effekt-Immunität; Ziele des Wirkers werden weiter getroffen (nur eigene Ziele → ganze Karte negiert); Schwesterkarten laut Text unverändert; `W15/a-r7` angepasst |
| Divine Gift of Skill (S01-04) | „The user ist der Zauberwirker." | Magic-Arts-Stufe des Wirkers entscheidet |
| Such-Sperre (S01-27) | „Nein, nur Deck -> Hand" | Ist-Zustand, Repro umgestellt |
| Anti Magic Zone | „Wiederbelebte (oder z.B. via Teleport Powder zurückkehrende) Heroes bekommen automatisch den Status/Debuff und können nicht casten!" | `amzFensterAufHeldAnwenden` bei Wiederbelebung, Extra Life, Aufstieg aus dem Tod, Teleportation Powder, Quetzahuitl |
| Mission + Victory Phoenix Cannon | „Gesperrt ist korrekt, Mission verbietet ALLE anderen additional Actions!" | Ist-Zustand |
| Guard Change | „Ja, sie dürfen bewegt werden (und eigene in die Zonen temporär gestohlener Heroes)…" | Alle kontrollierten Kreaturen, Zielzonen auch bei übernommenen Helden; Seitenwechsel setzt `crossSideControlled`; Client-Antwort mit `destOwner` |
| Ida | „Nein" | Nur Holy Selection abbrechbar (Ist-Zustand) |
| Dark Ocean | „Ja, decay_spell ist eine Form von Spell und sollte damit durchkommen" | `attack`, `spell` und jeder `*_spell`-Typ kommt durch |

## Ergebnis in Zahlen

* Repros: **alle 986 Repros grün** (Welle 16: 948 von 961); 0 rote, 0 Rückschritte, keine Abstürze oder Timeouts. Gegenüber Welle 16 sind alle 13 roten behoben bzw. auf die bestätigte Regel umgestellt.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot; `check-bundles.js` war im parallelen Lauf einmal rot und ist allein grün).
* Skilltest-E2E: rot nur battle, lobby, prep, seats, target (wie im Ausgangszustand).
* Dauerfeuer über alle Karten (~2 450 Läufe, beide Seiten): keine neu auffälligen Läufe.

## Offene Rückfragen an Al (Ja/Nein)

1. **Tengu Windstorm / Sparkfly Worker (W17a):** Sollen sie bei „any card on the board that is not a Hero" auch die oberste Karte des Coolness Stacks anbieten (wie Coolness Overcharge, Ralzish)? (jetzt: nein)
2. **Alice-Stapel als Wurfziel (W17a):** Soll ein Wurf mit einer Mehr-Opfer-Karte (Blue-Ice, Foresta, Pilot, Egg) auf einen Alice-Stapel gar kein Wurfziel sein, auch wenn dieselbe Spalte noch eine Einzel-Zone hat? (jetzt: Stapel kein Ziel, Einzel-Zone schon)
3. **Bow of the Hunt Goddess (W17c):** Soll ein vom Bow gespielter Pfeil, der anschließend negiert wird, das „Once per turn" des Bow NICHT verbrauchen? (jetzt: verbraucht)
4. **Bow (W17c):** Soll der Bow auch angeboten werden, wenn KEIN Pfeil im Deck spielbar ist (leere Suche verbraucht den Einsatz und mischt das Deck)? (jetzt: nicht angeboten)
5. **Held unter fremder Kontrolle (W17d):** Darf ein Held, den der Gegner (dauerhaft oder temporär) kontrolliert, für seinen Besitzer noch normal Zauber und Attacken wirken? (heute: ja; bei Surprises: nein)
6. **Love Shot (W17d):** Soll Resistance/Anti Magic Enchantment an einem eigenen, vom Gegner kontrollierten Helden mein eigenes Love Shot blocken? (jetzt: ja, wie bei jedem Zielhelden)
7. **Love Shot (W17d):** Soll die Wisdom-Abwurfkostenrechnung am Ende des Gusses für Helden der Gegnerspalte die Hand des Kontrolleurs lesen? (jetzt: Hand des Helden-Besitzers; fällt nur bei Hand-Rabatten auf)
8. **Divine Gift of Rain (W18a):** Soll Rain bei Cataclysm auch die Area des Reagierenden schützen? (jetzt: nein, nur Helden und Kreaturen)
9. **Divine Gift of Skill (W18a):** Soll der Client-Tooltip der Sperre auf „the user" geändert werden? (steht noch „unless it has at least Magic Arts 1")

**Beobachtung außerhalb der Aufträge (nicht angefasst):** Rusty Touch bucht die Kosten des negierten Gliedes ein zweites Mal ein (gilt auch für Hand-Reaktionspfeile). Client-Detail: Treacherous-Crystal-Klick pulsiert auch bei einer Golden-Wings-Kreatur als einzig stiehlbarer (Server überspringt sie). Der Client-Teil von Guard Change (`destOwner`) ist nur im Code geprüft, nicht im Browser.
