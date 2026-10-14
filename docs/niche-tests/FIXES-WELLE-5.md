# Fix-Welle 5 – Antworten auf die offenen Fragen aus Welle 1 und 2

Al hat die liegengebliebenen Fragen aus [FIXES-WELLE-1.md](FIXES-WELLE-1.md) und [FIXES-WELLE-2.md](FIXES-WELLE-2.md) beantwortet. Zwei Agenten haben sie umgesetzt (W5a: Tokens/Besitzer/geliehene Karten, W5b: Regeln/Sperren/Stempel); Zweige `wave5/W5a` und `wave5/W5b` sind in `claude/beautiful-mendel-eb61lv` zusammengeführt (ohne Konflikte).

## Entscheidungen von Al (verbindlich, in `CARD_API.md` verankert)

| Thema | Entscheidung |
|---|---|
| Tokens, die das Brett verlassen | Verschwinden **vollständig** (kein Hand-/Deck-/Ablage-/Gelöscht-Eintrag). Liegt eine echte Karte „darunter" (Biomancy-/Boulder-Token → Potion), wird **diese** gelöscht. Tokens sind legale Ziele für „auf Hand/Deck"-Effekte; der Effekt gilt dann als ausgeführt |
| Besitzer-Regel | Karten landen **immer** in Deck/Ablage/Gelöscht-Stapel ihres **permanenten Besitzers**, durch alles (Opfer, Zerstören, Mischen, Bottom-of-deck …) |
| Dive Bomblebee | „opponent's side of the board" = Karten, die der Gegner **kontrolliert**; nie selbst kontrollierte; Karte unter das Deck ihres Besitzers |
| Missing People | Nur vom Gegner **kontrollierte** Kreaturen; leere Zielliste = nicht spielbar |
| Slippery Fridge | **Alle** Ausrüstungen übertragen ihre Boni vom alten auf den neuen Träger (genau einmal) |
| Elven Rider / Cycling Demons | Hat der temporäre Besitzer ein geeignetes Ziel, darf er den Nachfolger **seitenfremd** beschwören |
| Dark Deepsea God | Auch **geliehene** Kreaturen dürfen Tribut sein |
| Moonlight Butterfly | Gestohlener Falter auf die Hand des Kontrolleurs, 150 Schaden auf den Helden gegenüber dem Kontrolleur (wie umgesetzt) |
| Singing auf Surprise-Kreaturen (Camel, Cactus Creature …) | Nicht ausschließen; die Kreatur geht face-down in die Surprise Zone ihres Trägers (Bakhm: Support Zone), der Besitzer des Helden behält die Kontrolle |
| Magic Lamp / Birthday Present bei Ambush the Scout | Nur die zu gebende Karte geht aufs Deck, die eigenen Karten auf die Hand; „once per game" bleibt verbraucht |
| „You can only control 1" | Wird von platzierenden Karten (Army of the Cute, Glorious Rebirth, Molinda) **nicht** umgangen |
| Sun Beam / Trial of Dominance unter Ida | Wie die anderen Flächenzauber gedeckelt |
| Cool Presents | Bei Hand-/Such-Sperre der Gegnerhand **nicht aktivierbar** |
| Ghuanjun | Schaden = **aktuelle** Grund-ATK (unter Curse 0) |
| Shamanic Curse | Der erhöhte Level kostet bei Wisdom-Helden tatsächlich den Zusatz-Abwurf |
| Gespielte Karte | Ist **nie** abgeworfen (Draw zählt nicht für Cute-Bunny-Schwelle/Archibald) |
| Abgelehnte Angebote | Verbrauchen **nie** once per turn/game |
| Saya | Zweitguss beachtet once-per-turn/-game-Grenzen (Ruling v1277 überholt) |
| No Retreat! | Erkennt alle Effekte, die Karten aus Hand/Ablage/Brettseite des Aktivierenden ins Deck mischen (Mass Routing nur wenn ≥1 Kreatur betroffen) |
| Unwanted Audience | Status-immune Kreaturen immun; Monia kann reagieren |
| Sparkfly Attendant | Negierter Attendant gibt keinen Schutz mehr |
| Voice in your Head, Supply Chain, Kazena u. ä. | Unter Hand-/Zieh-Sperre nicht spielbar; gegen Tuscan Artist nur bei exakt 2 oder 3 zu ziehenden Karten |
| Pawn Sacrifice / Thebinxan | Pawn Sacrifice bleibt unter Handsperre spielbar; Thebinxan gesperrt |
| Shanty Harpyformer | Braucht zwingend eine zweite Handkarte |
| Reincarnation | „Once per game" gilt je Held (wie bisher) |
| Ohne Änderung bestätigt | A09-20 Elven-Rider-Sperre, A07-05 Dream Lander, Such-Sperre gilt nicht für Alex/Ska/Greenhouse |

## Umsetzung

**W5a (`wave5/W5a`, 4d46e41)** – neue Helfer `tokenUnterkarte`, `tokenAbgang`, `handKartenBesitzerPs` in `_engine.js`; Token-Abgang in `_addCardToState`, `actionMoveCard`, Schadens-Batch, `removeIslandZones`, `_tokenStattKarte`; 16 Hand-Splice-Stellen auf den Besitzer-Helfer umgestellt; Fridge-Batterie über 93 Ausrüstungen (nur Swellpnir hatte ein fehlendes Abzeichen); geliehene Karten (Life-Searcher, Rider/Demons, DDG, Falter).

**W5b (`wave5/W5b`, 046c4f1)** – Singing-Frage geht an den Aktivierenden; Magic Lamp bei Ambush; `nurEinerSchonKontrolliert` für platzierende Karten; Ida-Deckel für Sun Beam/Trial; Cool Presents gesperrt; Ghuanjun-Formel im Angriffsfenster (`usesHeroAtk`, `usesBaseAtk`); Shamanic-Curse-Kosten; Draw nicht abgeworfen; Cute Dog stempelt erst bei Beschwörung; Saya-Zweitguss; No Retreat! mit `shufflesIntoDeckIf`/`shufflesFromBoardIntoDeck`; Monia-Fenster bei Unwanted Audience; Sparkfly-Aura lazy neu berechnet; `drawBlockedFor(engine, pi, menge)` für Voice/Kazena/Populated Island Turtle/Divine Gift of Balance; Thebinxan, Shanty.

## Ergebnis in Zahlen

* Repros: **343 grün** von 741 (Welle 4: 313 von 725); 14 weitere Befunde behoben, **0 Rückschritte**, keine Abstürze/Timeouts; die 16 neuen Repros (`W5-a/01–05`, `W5-b/B1, B2, B3, B5, B6, B7, B13, Z1–Z4`) sind alle grün und waren gegen den Ausgangsstand rot. Auf die neue Regel umgestellt: M01-05, H04-15, F01-16, H02-15, A02-37, C03-20, H01-11, A08-24, A07-23, A06-21, A01-28, S02-20(b).
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot). Skilltest-E2E: rot sind battle, lobby, prep, seats, target (wie im Ausgangszustand); `artifacts.test.js` (schon im Ausgangsstand zufällig rot) und `cards.test.js` waren im Lauf unter Last einmal rot und sind in je 3 Einzelwiederholungen grün bzw. 2 von 3 grün (`artifacts` einmal rot = bekannter Zufalls-Flake). Dauerfeuer über alle Karten (~2 440 Läufe): **keine neu auffälligen Läufe**.

## Noch offen

* **Cool Tech Jetpack (F01-12)** „the first time every turn" und **Heart-Shaped Bow (F02-06)** „einmal pro Zug und Bogen": Repros rot, nicht angefasst. Mit der Regel „abgelehnte Angebote verbrauchen nie" gilt für den Jetpack heute dasselbe wie dort; Frage an Al: gilt das auch hier?
* **Priest of Luna/Tempeste:** Kosten (5 Kreaturen mischen) werden in `beforeSummon` gezahlt, vor dem Fenster – No Retreat! kann sie daher nicht erkennen. Bräuchte einen Kostenhaken vor dem Fenster (wie in Welle 4 für andere Kreaturen).
* Meditation, Expedition, Motharch Squire, Anti Intruder System, Last Second Escape, Homecoming haben noch kein Skript; sie bekommen das No-Retreat!-Merkmal, sobald sie geschrieben werden (`CARD_API.md`, Kopf von `no-retreat.js`).
* Client: Flug-Animationen (`play_pile_transfer`) zeigen Token noch zum Stapel fliegen, obwohl nichts ankommt.
* Teil „Fenster je Karte" von A08-31 (Cool Presents) bleibt rot; von Al nicht angesprochen.
* Ghuanjun: Critical Strike (2× Grund-ATK = 160) und Massacre (+50 je Kreatur = 130) rechnen ihre eigene Formel mit der aktuellen Grund-ATK; Alternative wäre „jede Attack genau Grund-ATK". Bitte bestätigen.

## Nachträge nach dem ersten Abschluss (14.10.2026)

| Thema | Entscheidung / Umsetzung |
|---|---|
| Cool Tech Jetpack (F01-12) | Al: „Wenn ein Effekt spezifisch nur bei der ersten Instanz von etwas triggern kann, wird sie auch beim Ablehnen aufgebraucht." → Skript-Hook `consumeOnDecline` (Engine ruft ihn bei „Nein"); Jetpack verbraucht das „erste Mal" auch bei Ablehnen. Divine Gift of The Light und Gerrymander taten das schon |
| No Retreat! und die Priests | Al: „No Retreat soll die Priests erkennen!" → Priest of Luna/Tempeste (Zusatzbeschwörung, Kosten = 5 Kreaturen mischen) werden erkannt; das Fenster liegt vor den Kosten, bei Negierung bleibt der Priest auf der Hand, nichts wird gemischt/bezahlt (`isInherentAction` im Kettenkopf, `shufflesIntoDeckIf` in `_priest-shared`). Weitere Karten mit demselben Muster gibt es unter den Skripten nicht |
| Token-Optik | Al: „Das optische Token-Fliegen muss weg, stattdessen sollen sie (außer sie haben Träger-Karten wie bei Biomancy) desintegrieren." → Neues Ereignis `token_disintegrate` (aus `tokenAbgang`), `play_pile_transfer` für reine Tokens zentral unterdrückt; Client `tokenZerfallSpielen` (Pixelzerfall ~1,25 s, `prefers-reduced-motion`: 350 ms Ausblenden). Biomancy-/Boulder-Token zerfällt, die Karte darunter fliegt zum Gelöscht-Stapel |

Endstand nach den Nachträgen: **346 Repros grün von 743**, 0 Rückschritte, 0 Abstürze; `check-*.js` wie im Ausgangszustand; E2E rot nur battle, lobby, prep, seats, target; Dauerfeuer ohne neu auffällige Läufe. Der Client-Zerfall ist in echtem Chromium an einer Attrappen-Zone getestet (`scripts/skilltest-e2e/ui-token-zerfall.js`, 15 Prüfungen), nicht in einem vollständigen Spiel.

Entschieden (Al): Pollution Tokens behalten ihre eigene Verdunstung; der Token-Zerfall bekommt einen Klang (vorhandener Klang `status_remove`, Rate 0.8, in `onTokenDisintegrate`).
