# Fix-Welle 14 – Rückfragen aus Welle 13 (1–12) und Einzelfragen 150–179

Al hat die zwölf Rückfragen der Welle 13 und die letzten 18 Einzelfragen (150–179) beantwortet (16.10.2026). Drei Agenten haben sie umgesetzt (W14a: Rückfragen 1–12; W14b: 150, 151, 152, 153, 156, 159, 161, 162, 163; W14c: 165, 168–171, 173, 174, 176, 179). Die Zweige `wave14/W14a|b|c` sind in `claude/beautiful-mendel-eb61lv` zusammengeführt; der einzige Konflikt lag am Dateiende von `CARD_API.md` (beide Abschnitte behalten).

## Entscheidungen von Al und Umsetzung

### W14a – Rückfragen aus Welle 13

| # | Entscheidung von Al | Ergebnis |
|---|---|---|
| 1 | Creature-Effekte mit Action-Kosten sind gesperrt, wenn die **Kreatur selbst** Frozen/Stunned/Negated ist (nicht der Wirtsheld) | Ist-Zustand stimmte; Repro `a-q1` (Spawn Mother, Plant Golem, Creepy Clown) |
| 2 | Wirker mit mitten in der Kette negierten Abilities fizzelt weiter | Ist-Zustand; Repro `a-q2` |
| 3 | Nicolas-Sperre auch, wenn er schon vor dem ersten Trank fiel | Ist-Zustand; Repro `a-q3` |
| 4 | Zis Spell ist **unabbrechbar**; er MUSS ausgeführt werden, falls möglich, sonst Ablage | Umgesetzt über `_forcedCommitPlayer` (nur `onPlay`); Gegner behält seinen Abbruch; unmöglicher Guss fizzelt, „Einmal pro Spiel" bleibt frei |
| 5 | Resistance blockt auch **eigene** Effekte – aber nicht das normale „Ability per turn", nur Anlegen per Effekt | Umgesetzt: Standard-Spielaktion und Effekt getrennt (`attachAbilityFromHand`, `equipArtifactToHero`) |
| 6 | Insta-Kill-Defeat prallt an Resistance ab | Zentral in `actionDefeatHero` (Midnight Assault, Decapitating Strike, Kohta, Lunatic Golem, Hand of Death); Opfer/Kosten und Eigenfolgen (Gobbo, Companion-Bruch) nicht geblockt |
| 7 | Heldenpassive, die den eigenen Helden aufbauen, prallen ab | Styx, Rha'Bi, Maya, Luna Kiai, Chaorc Pyre Grill Master verdrahtet (Goff, Wolflesia, Stellin, Clausss, Antonia, Vullary, Smugbeth sind Kreaturen → keine Änderung) |
| 8 | Omikrons Illusion bekommt Layns +100 HP | Ist-Zustand; Repro `a-q8` |
| 9 | Als Standard-Spielaktion nur permanent kontrollierter Held; per Effekt (Pressed Skill) alle eigenen Helden | Umgesetzt (`canAttachAbilityToHero(…, {byEffect:true})`); Regel in `CARD_API.md` |
| 10 | Cloud in a Bottle auch bei tödlichem Schaden (Helden und Kreaturen), halbiert den vollen Treffer | Umgesetzt; Overkill kann trotzdem tödlich bleiben |
| 11 | Immunität gegen jeden Status negiert auch Crystal | Umgesetzt (Petrification Break, `negative_status_immune`, Light Ball, `negate_immune`); A08-28 grün; Karian wie in W13c |
| 12 | „When…, …" + „only once per turn" gewollt (ein Cloudy Slime pro Spieler pro Runde) | Ist-Zustand; Repro `a-q12` |

### W14b

| Frage | Entscheidung von Al | Ergebnis |
|---|---|---|
| Q150 Divine Gift of Time | Reagiert auf **alles**, was den Discard erreicht (auch zerstörte Equips/Attachments, genutzte Surprises) | Zentrale Meldung an den Ablage-Eintrittsstellen (`_ablageMeldung`, Hook `onCardsSentToDiscard`) |
| Q151 Divine Gift of the Guardian | Schützt alle eigenen Kreaturen; Kartentext ändern | `data/cards.json`: „Negate any damage Creatures you control would take until the beginning of your next turn." |
| Q152 Unwanted Audience | NUR aktive Effekte, passive Komponenten bleiben unberührt | Neuer Status `active_locked` (negativ, heilbar) statt `negated`; Bomb Mite bleibt unberührt; Client-Abzeichen |
| Q153 Control Device | NUR an gegnerische Helden anlegbar | `canEquipCardToHero(…, {kartenBesitzer, kontrolleur})`; Looting bietet es nur aus der Gegner-Ablage an |
| Q156 Toxic/Booby Trap | Jeder Treffer zählt, auch reines Status-Zufügen | `statusHitSurpriseWindow` (Poisoned Well, Iceage, Medusa's Curse) |
| Q159 Aurora Borealis | Löschen erst nach vollem Commit des gewählten Spells | Löschen am Zusagepunkt; Abbruch lässt alle Karten auf der Hand |
| Q161 Chaos Magic | Verbraucht immer die eigene Action; Stempel-verbrauchte Spells werden gewählt, fizzeln | Ist-Zustand bestätigt; Repro |
| Q162 Create Illusion | Gegner darf das Ziehen ablehnen | Ja/Nein-Frage; CPU nimmt an außer bei drohendem Deck-Out |
| Q163 Detection | Nur Subtype Surprise; verdeckte Nicht-Surprise wird temporär aufgedeckt und bestätigt | Über `deckSearchReveal`, danach wieder verdeckt |

### W14c

| Frage | Entscheidung von Al | Ergebnis |
|---|---|---|
| Q165 Divine Gift of Magic | Nur die eine Kopie | Pro-Handindex-Senkung; beim Ausspielen auf die gespielte Kopie umgehängt (`kopienRabattAufGespielteKopie`, wirkt auch bei Fiona genau einmal) |
| Q168 Divine Gift of The Light | Einmal pro Zug, nicht pro Hero | Stempel an der Karteninstanz |
| Q169/Q170 Last Resort, Flame Avalanche, Heat Wave | Sperre nur gegen Schaden an Gegnerzielen; Text ändern | `data/cards.json`: „You cannot deal any other damage to targets your opponent controls the turn you activate this card."; Heat Wave: eigene vorverbrannte Ziele nehmen normal Schaden |
| Q171 Hand of Death | Effekt kommt auch, wenn die Karte aus der Ablage geholt wurde | `nachholenOhneKarte` direkt nach `ON_TURN_END` |
| Q173 Poison Pollen | Momentaufnahme beim Ausspielen; frisch betäubt = kein Extra-Gift-Stack | Ist-Zustand bestätigt |
| Q174 Outbreak | Spielbar mit negiertem/geblendetem Nutzer | `_spielTrotzStatus`; echte Schulstufen zählen weiter |
| Q176 Teleportal | Mischt nach der Suche | `takeFromPile(…, {shuffle:true})` |
| Q179 Rewrite History | „place": Zustand des Helden egal | Ist-Zustand bestätigt |

Auf die neue Regel umgestellte alte Repros: `W13/a-q132`, `W13/b-q147`, `R01/07`, `R02/05`, `R02/08`, `S01/14`, `S01/16`, `W5-b/Z2`, `S02/06`, `S03/09`, `S03/27` (sowie Messfehler in `S01/16` korrigiert).

## Ergebnis in Zahlen

* Repros: **685 grün von 908** (Welle 13: 634 von 878). Gegenüber dem Stand vor der Welle: **0 Rückschritte**, 21 bestehende Repros von rot auf grün, 30 neue Repros (alle grün), keine Abstürze oder Timeouts.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot).
* Skilltest-E2E (30 Dateien) nach dem Merge: rot nur battle, lobby, prep, seats, target (wie im Ausgangszustand).
* Dauerfeuer: je Zweig vorher/nachher ohne neu auffällige Läufe (W14a 52, W14b 56, W14c 20 Läufe); nach dem Merge Vollauf über alle Karten (rund 2 450 Läufe, beide Seiten): **keine neu auffälligen Läufe** gegenüber dem Ausgangsstand.

## Neue Rückfragen an Al (Ja/Nein)

**Aus W14a**
1. Sollen auch ATK-Gewinne von Heldenpassiven/Effekten (Nero, Toras, Taio; Chaorc +40 ATK ist schon geblockt) an Resistance abprallen?
2. Soll Toughness (Max-HP-Gewinn beim normalen Anlegen) von Resistance ungeblockt bleiben, weil es zur Standard-Spielaktion gehört? (jetzt: ungeblockt)
3. Sollen die Divinity-Anleger (Sacrifice to Divinity, Quetzahuitl, Very Special Prisoner), Alex, Chuck und Muscle Training an Resistance abprallen? (noch nicht verdrahtet)
4. Soll ein Companion-Bruch (Bonded Companion geht, Held wird besiegt) von Resistance NICHT geblockt werden? (jetzt: nicht geblockt, Eigenfolge)

**Aus W14b**
5. Soll Divine Gift of Time auch anbieten, wenn die gerade gewirkte eigene Karte selbst in die Ablage geht? (jetzt: ja)
6. Soll Unwanted Audience auch Wiederholungen durch Spirit of the Forbidden Grimoire/Kohta sperren? (jetzt: ja)
7. Sollen bei Poisoned Well, Iceage und Medusa's Curse auch die weiteren Hand-Reaktionsfenster (Divine Gift of Rain, Barrier of Faith, Anti Magic Shield) aufgehen? (Befund R01-10, bisher nicht entschieden)
8. Soll Chaos Magic eine gewählte, aber fizzelnde Karte weiter als „bereits gewirkt" zählen? (jetzt: ja)

**Aus W14c**
9. Q165: Gilt „nur die eine Kopie" für die gespielte Kopie (der Rabatt zieht beim Ausspielen auf die geklickte Kopie um), nicht für eine bestimmte physische Karte – in Ordnung?
10. Soll die Schadenssperre bei Kreaturen/Helden von Besitzer/Brettseite auf **Kontrolle** umgestellt werden (Befund S02-05, `S02-spells/05` weiter rot)?
