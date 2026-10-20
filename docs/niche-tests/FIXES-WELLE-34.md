# Fix-Welle 34 – Antworten auf die W32a-Rückfragen, Guardian Beast Hu

Al hat die vier Rückfragen aus [FIXES-WELLE-25-33.md](FIXES-WELLE-25-33.md) beantwortet und Hu „nachziehen" lassen (22.10.2026). Ein Agent (**W34a**) hat sie umgesetzt; Zweig `wave34/W34a` ist zusammengeführt (keine Konflikte). Details und Verträge: `cards/effects/CARD_API.md`, Abschnitt „Welle 34 / W34a"; Repros `docs/niche-tests/repro/W34/a-00 … a-05`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Guardian Beast Hu | „Hu nachziehen" („any Hero you control" nach aktueller Kontrolle) | Neuer Helfer `engine._zusatzaktionsHelden(pi)`: eigene Spalte ohne abgegebene Helden plus übernommene Gegnerhelden (temporär und dauerhaft). Prompt trägt `fremdeHelden`, Antwort `heroOwner`; der Server nimmt einen fremden Helden nur an, wenn der Prompt ihn für genau diese Karte angeboten hat. Client (`app-board.jsx`): Klick, Heldenwahl, Drag&Drop (Kreaturen nur per Klick). Alle weiteren Nutzer von `performImmediateActionAnyHero` (The Master's Plan, Lunar Eclipse, Off Duty, Dream Dust, Shamanic Curse, Spider Dance, Loving Puppet Pavi, Traveler from the Future, The Third Circle of Hell) laufen durch dieselbe Sammlung |
| Alluring Light: gezwungener Held geblockt, wenn er nicht angreifen kann | „Ja, ist korrekt" | Der Ist-Zustand war entgegen der Doku **nicht** geblockt (`casterCheck: false`, ein gefrorener Held schlug zu). Jetzt: nur angriffsfähige Gegnerhelden wählbar; kann keiner angreifen, ist die Karte unspielbar; wird der Held zwischen Wahl und Treffer gesperrt, verpufft der Angriff |
| Alice und Spell-Reaktionen | Silence ja, MOE Shield ja, Magic Mirror funktioniert, Shamanic Curse nein (Spell kann nicht zum Discard), Storm Ring löst bei einem Ziel nicht aus | Silence liest die virtuelle Spell-Kette (`alsSpellKette`, Kettenglieder mit Marke `zaehltAlsArt`), Shamanic Curse schließt sie aus (Gegenprobe echter Spell: reagiert); Storm Ring behält „mehr als 1 Ziel". Nebenwirkung: Stealthy Pursuit und Idej Projector reagieren ebenfalls auf Alice |
| Kartentext „that is not a Creature" | „superfluous, Relikt aus der Zeit, als Creatures Spells waren – wo sonst gefunden, weg damit" | `data/cards.json`: **Silence** („plays a Spell."), **Clone** („Normal Attack or Spell,"), **Tushu, the Knowledge Keeper** („Normal Non-Creature Spell" → „Normal Spell", bei der systematischen Suche gefunden). Bewusst belassen: Rebelliokai Kind Kitsune („card from your discard pile that is not a Creature") und Soul Transmigration Ritual („except Creatures") – dort geht es um Kartenwahl, nicht um Spells. Kein Code schließt Creatures per Textfilter aus Spell-Prüfungen aus |
| Zähler und Sperren | „Ja, die zählen!" | `engine.zaehleAlsArt` zählt einen Treffer genau einmal (aus `alsAttackKette`, dem neuen `alsSpellKette` und Arthor). Zähler: `attacksPlayedThisTurn`, `heroesAttackedThisTurn`, `hero._attacksThisTurn`, `spellsPlayedThisTurn`; neuer Hook `onEffectCountedAsArt` (Mirjam), Log `effect_counted_as_spell` (Fire Bolts). `heroKannAngreifen` prüft zusätzlich Berserk-Limit, Knife Throw, `blocksCardPlay` (Rioting Village), `canPlayCard`; neu `heroKannZaubern` (Nulled, Magic Silenced, Frightened, Berserk, `_spellLockTurn`, Trial of …, Kogarasu). Angepasst u. a.: Berserk, Knife Throw, Rioting Village, Quick Attack, Amazing Finding, Blow of the Venom Snake, Ferocious Tiger Kick, Strong Ox Headbutt, Muscle Training, Idej Sword – Muras, Punch in the Box, Mirjam, Teleportal, Silence, Fire Bolts, Null Zone, Anti Magic Zone, Howling in the Night. Bewusst nicht: Ghuanjun und Archibald (namensbasiert), Swellpnir und Soul Shard Ba (Aktionsökonomie) |
| Dark Ocean | „Ja, generell darf man unter Dark Ocean immer auf *seine eigenen* Creatures reagieren, nur nicht auf gegnerische" | Elf Hand-Reaktionsfenster sperrten pauschal bei jeder Creature-Quelle; die Sperre hängt jetzt am Reagierenden (`darkOceanBlocksReaction`): gesperrt ist nur, wer auf eine Creature eines anderen Kontrolleurs reagiert. Kettenfenster, Surprise-Tor, Post-Target-Fenster und Greatmaw-Treffer waren schon korrekt |

Umgestellter alter Repro: `W30/a-02` (Abschnitt „harte Negierung": ein hart negierter Held ist als gezwungener Angreifer nicht mehr wählbar).

## Ergebnis in Zahlen

* Repros: **alle 1163 Repros grün** (vorher 1157; 6 neue), **0 Rückschritte**, keine Abstürze oder Timeouts (Voll-Lauf nach dem Zusammenführen bestätigt).
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Skilltest-E2E (Lauf des Agenten): rot nur battle, lobby, prep, seats, target; `cards.test.js` unter Last einmal rot, einzeln grün.
* Dauerfeuer: 25 betroffene Karten × beide Seiten, 0 Abweichungen zur Basis.
* **Nicht geprüft:** die geänderten Klick- und Drag-Pfade von Hu im Browser (`app-board.jsx`; nur Build-Check `check-bundles.js` grün).

## Offene Rückfragen an Al

Alle vier sind beantwortet und in [FIXES-WELLE-35.md](FIXES-WELLE-35.md) umgesetzt (dort stehen die neuen Rückfragen).
