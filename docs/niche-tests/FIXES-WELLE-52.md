# Fix-Welle 52 – Allgemeiner Equip-Lost-Hook, Tempelunas Fee, Tokens, Anti Magic Enchantment, Lunatic Hawk

Al hat die Rückfragen aus [FIXES-WELLE-51.md](FIXES-WELLE-51.md) beantwortet (22.10.2026). Ein Agent (**W52a**, Zweig `wave52/W52a`, zusammengeführt) hat sie umgesetzt. Details und Tabellen: `cards/effects/CARD_API.md`, Abschnitt „Welle 52 / W52a"; Repros `docs/niche-tests/repro/W52/a-01 … a-05`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| **`onEquipLost` für alle Equip-Verluste** | „Gibt es einen Grund, nicht einen allgemeinen Hook für *alle* Equip-Verluste zu haben? Wenn nicht, so ändern!" | Kein guter Grund dagegen gefunden. `engine.fireEquipLost` feuert zentral (Verteiler in `runHooks`, nach jedem `onCardLeaveZone` aus einer Support Zone; nicht für Kreaturen, Tokens, Abilities). Payload plus `reason` (moved, transferred, destroyed, discarded, deleted, returnedToHand, returnedToDeck, hostDefeated, hostRemoved, other) und `isMove`. Kein Doppelfeuern; `equipZustandHooks` verdrahtet nur noch Lost/Gained. Taio, Toras, Riffel, Kohta, Lolek, Fiona, Tempeluna buchen den Abgang genau einmal über `onEquipLost`. Smug Coin und Guardian Angel (nehmen sich ohne Leave-Hook aus der Zone) rufen `fireEquipLost` direkt. Neu: Zustandskarten sehen jetzt auch Abgänge über `_onlyCard`-Pfade (Heldentod, Afflicted Pests). Die 175+ übrigen `onCardLeaveZone`-Lauscher bleiben unverändert |
| **Tempelunas Fee** | „In ihrem Effekt steht nichts davon, dass die Fee als Equip zählt – das wäre ungewollt!" | Fee ist ein **Anhängsel**, kein Equip (`counters._keinEquip`): Fridge bietet sie nicht an; Anti Magic Enchantment, Pests, LOCUST und alle Equip-Beobachter sehen kein Equip (Hook-kind `attachment`). Effekt-Gewinn/-Verlust funktioniert weiter. Tempeluna öffnet weiter kein Pests-Fenster. Initiation-Ritual-Helden bleiben „treated as an equippable Artifact" |
| **Tokens** | „Ja, [Puppet Tokens] ausnehmen! Generell sollten Tokens ausgenommen sein!" | Zentrale Erkennung `engine.isTokenCard`; Fridge, Ceremony und `actionTransferAttachment` hängen keine Tokens um (`tokenBlocked`). Tri Ad/Tri Fecta getestet. Audit anderer Bewegungseffekte (nur Skript-Durchsicht): Puppets blockt `actionMoveCard` schon über `cannotChangeSupportZone`; Guard Change, Slippery-Familie, Capture, Dark Gear arbeiten auf Creatures (Creature-Tokens zählen dort laut Kartentext mit) |
| **Cloud Pillow** | „Das passt, der Zustand soll länger leben als der eine Treffer." | Ist-Zustand bestätigt, keine Änderung |
| **Anti Magic Enchantment bei Initiation-Ritual-Helden** | „Nein, soll angeboten werden!" | `engine.istEquipArtifact` (Equipment-Artifact oder als Equip angelegter Held): AME wird für Initiation-Helden angeboten, der Schutz hängt am Helden (einmal pro Zug). Cybug LOCUST (leitet den Helden um) und Cybug RHINOCEROS (Platzierungsfenster) reagieren ebenfalls; Afflicted Pests war schon „ja". Beobachter-Matrix in CARD_API |
| **Lunatic Hawk** | Kartentext 2+: „Whenever you equip an Artifact to a Hero, its controller draws 1 card." Al: Es zieht der Spieler, an dessen Hero man anlegt (Kontrolliert P1 Hawk und legt ein Equip an einen gegnerischen Hero, zieht P2). Fridge feuert „on-equip", also triggert auch das Umhängen | Trigger ist der Hawk-Besitzer als Anlegender (Stufe 2+, Artifact inkl. Initiation-Held); gezogen wird vom aktuellen Kontrolleur des Zielhelden (Charme zählt). Umhängen per Fridge (und der Equip-Teil von Ceremony) triggert je Equip; Anhängsel und Fee zählen nicht; legt der Gegner an, passiert nichts. Umgesetzt über `onEquipGained`; das alte `onCardEnterZone`-Ziehen ist entfernt |

Angepasste alte Repros: `W51/b-03`, `W51/c-01`.

## Ergebnis in Zahlen

* Repros: **alle 1253 grün** (vorher 1248; 5 neue, auf dem alten Stand rot), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* E2E (mit `NODE_PATH`): cards, draw-cards, sacrifice, artifacts grün.
* `Bugfix-Note`-Zeilen: Tempeluna, Inheritance Ceremony, Slippery Fridge, Anti Magic Enchantment, Initiation Ritual, Cybug LOCUST, Lunatic Hawk, `_equip-shared`.

## Offene Rückfragen an Al

1. **Ceremony und Tempelunas Fee:** Soll Ceremony die Fee überhaupt als Anhängsel mitnehmen? Ist-Zustand: ja; Tempeluna verliert den Effekt, der neue Wirt gewinnt ihn nicht.
2. **Cybug RHINOCEROS:** Soll das Platzierungsfenster beim Anlegen eines Initiation-Helden öffnen? (Umgesetzt als Konsequenz von „treated as Artifact".)
3. **Future Tech Gun:** Beim erneuten Anlegen nach dem Zerstören gibt sie +40 ATK am Riffel-Träger (auch vor W52a so). Gewollt?
4. **Teleportation Powder:** Sollen die mitgenommenen Equips `onEquipLost` melden und bei der Rückkehr `onEquipGained`? Aktuell weder noch (Equips verschwinden samt Wirt ohne jeden Hook).
