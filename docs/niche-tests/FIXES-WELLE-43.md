# Fix-Welle 43 – Hardy Slime: Taunt nur für Attacks, Spells und Creature effects

Al hat die drei Rückfragen aus [FIXES-WELLE-42.md](FIXES-WELLE-42.md) beantwortet (22.10.2026). Ein Agent (**W43a**) hat sie umgesetzt; Zweig `wave43/W43a` ist zusammengeführt. Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 43 / W43a"; Repros `docs/niche-tests/repro/W43/a-01`, `a-02`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Reichweite des Taunts | „NUR Attacks, Spells und Creature effects, mit der Einschränkung, dass sie Hardy Slime selbst treffen können sollen. Den Effekttext ändern … zu ‚all Attacks, Spells and Creature effects, if possible.'" | **Kartentext** `data/cards.json`: „…with all Attacks, Spells and Creature effects they use until your next turn, if possible." (zählt als Balancing/Patchnote). **Engine:** zentrale Prüfung `engine.tauntGiltFuerQuelle(quelle)`, aufgerufen von allen Taunt-Wegen über `_applyForcesTargetingFilter(…, quelle)`; Quellenart aus `sourceEffectKind` (wie Challenge, Martyry, Anti-Magnet, Alleria), also zählen auch Broghan, Brackle, Arthor, Heragas, Kohta, Alice, Javelin Throw, Sword in a Bottle, Crusader's, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw und Alluring Light. Eine Creature-Surprise zählt als Creature effect; eine schon auf dem Brett liegende Area-/Anhang-Karte löst keinen Taunt aus; unbekannte Quelle: Taunt wie bisher. Nur Spötter mit Deklaration `tauntNurAttackSpellKreatur` sind betroffen (`hardy-slime.js`); Deepsea Horror Clown und Doomed Town Guard bleiben „alle Zielwahlen". Die Einschränkung „Slime muss selbst ein mögliches Ziel sein" (W41a/W42a) bleibt. Quelle je Weg: `promptDamageTarget`/`promptMultiTarget` (Angreifer-Quelle bzw. Karte), `promptEffectTarget`/`ctx.promptTarget` (neuer Helfer `_tauntQuelleFuer`: ausdrückliche Quelle → auflösende Surprise (`_surpriseLauf`) → Titelkarte → wirkende Karte), `normalizeValidTargets` und Reopen in `doConfirmPotion` (Karte der Sitzung) |
| Chain Lightning, Bottled Lightning, Cardinal Beast Qinglong | „Nein, Taunt-Effekte wirken hier nicht (also korrekt as-is)." | Ist-Zustand, kein Code-Eingriff; `W43/a-02` belegt beide Sitze: die Kettenwahl bietet alle eigenen Ziele inklusive Slime an |
| Alluring Light × Kunagi × Hardy Slime | „Ja" | Ist-Zustand, jetzt belegt (`W43/a-02`, beide Sitze): der Kunagi-Besitzer darf bei der Neuwahl nur den Slime wählen, die eigenen Wahlen des Light-Spielers sind frei; Gegenprobe ohne Taunt grün |

## Quellen-Einordnung (Taunt jetzt ja/nein; belegt in `W43/a-01`)

* **Ja:** Attack-Karten; Spells (Fireball, Sun Beam, The White Army, Cure aus der Hand); als Attack/Spell zählende Effekte (Broghan, Brackle, Arthor, Heragas, Kohta, Alice, Javelin Throw, Sword in a Bottle, Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light × Kunagi); Creature effects (Skeleton Archer, Baihu, Zhuque, Bomblebee, Dive Bomblebee, Cheeky Monkee, Lovely Teddy, Heli Troopers, Spirit of the Forbidden Grimoire, 500 Piranhas, Water Golem, Afflicted Vermin, Debt-O-Tron).
* **Nein (vorher ja):** Artefakt-Effekte (Book of Doom, Ushabti of the Great Pharaoh), Tränke (Poison Vial, Acid Vial …), Equip-Effekte (Pocket Catapult, Future Tech Bazooka), Abilities (Occultism, Diplomacy, Singing), Heldeneffekte ohne Attack-/Spell-Wertung (Siphem, Locke, Pes'zet, Swampborne und Deep-Drowned Waflav), Surprises, die keine Kreatur sind (Gold Trap, Jumpscare, Bluff), Reaktions-Artefakte (Bomb Arrow, Racket Arrow), Dauer-/Trigger-Effekte von Area-/Anhang-Karten auf dem Brett (Acid Rain, Anti Magic Enchantment).

## Ergebnis in Zahlen

* Repros: **alle 1208 Repros grün** (vorher 1206; 2 neue: `a-01` 252 Prüfungen, auf der Basis 72 ✗; `a-02` 28 Prüfungen), 0 Rückschritte; kein altes Repro umgestellt.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Skilltest-E2E: wie im Ausgangsstand; mit `NODE_PATH` grün: cards, draw-cards, sacrifice.
* Dauerfeuer: 44 Läufe über 20 Karten, beide Seiten, 0 Unterschiede.
* Keine `Bugfix-Note` (Balancing-Änderung des Kartentexts, kein Fehler).

## Offene Rückfragen an Al

Alle sechs sind beantwortet und in [FIXES-WELLE-44.md](FIXES-WELLE-44.md) umgesetzt (dort stehen die neuen Rückfragen).
