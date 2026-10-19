# Fix-Welle 16 – Antworten Welle 15 und die restlichen roten Repros

Al hat die Rückfragen der Welle 15 beantwortet und das Go für „die restlichen Fälle" gegeben (19.10.2026). Sieben Agenten haben gearbeitet: **W16a** setzt Als sechs Antworten um, **W16b–g** haben die 220 noch roten Repros nach Gruppen abgearbeitet (A01–A03, A04–A06, A07–A09/C01–C03, C04–C05/F01–F03, H01–H04/M01–M02, R01–R02/S01–S03). Jeder Befund wurde eingeordnet: (1) echter Fehler mit eindeutiger Erwartung → behoben, (2) Repro falsch oder überholt → Repro korrigiert, (3) Regelfrage ohne Ruling → nicht geändert, Frage an Al, (4) zu groß → nicht geändert. Zweige `wave16/W16a–g` sind in `claude/beautiful-mendel-eb61lv` zusammengeführt (Konflikte nur am Ende von `CARD_API.md` – alle Abschnitte behalten – sowie je ein kleiner Konflikt in `_engine.js`: Status-Fenster W16b/W16d, Dark-Ocean-Block W16e/W16g, beide Seiten übernommen).

## Antworten von Al zu Welle 15 (W16a, umgesetzt)

| # | Antwort von Al | Ergebnis |
|---|---|---|
| 1 | Smoke Vial, Cute Conversion, Mass Routing, Pink Sky öffnen die Hand-Reaktionsfenster: „Ja" | Umgesetzt (Divine Gift of Rain, Barrier of Faith, MOE Shield, Storm Ring, Golden Wings je nach Kartenart); Repro `a-1` |
| 2 | „Attachments ja, Ability-Removal wie Fire Bomb nicht, die zielt nicht auf den Hero, sondern die Ability selbst!" | Resistance blockt Ausrüstung-Entfernen (Disarm, Entfernen-Teil von Pressure Projectile) und Spell-Anhänge (`placeAttachment`: Curse, Overheal Shock, Light Ball …); Fire Bomb u. ä. ungeblockt; Repro `a-2` |
| 3 | Abgefangenes Anlegen verbraucht den Einmal-Einsatz: „Ja!" | Angeglichen (Riffel, Weapon Collecting Wight, Lolek, Training A, Waflav); Repro `a-3` |
| 4 | Aufstiegsbonus nicht abfangen: „Nein, von keinem" | Resistance-Abfrage in `performAscensionBonus`/Chuck entfernt; Repro `a-4` |
| 5 | Kopien-Rabatt im Client: „… dann nur die rabattierte Karte!" | `getHeroPlayableCards` liefert `kopien` je Handindex, Client leuchtet nur die rabattierte Kopie; Repro `a-5` |
| 6 | Geliehener Held: „Lies die Hand des aktuellen Kontrolleurs" | Stufenprüfung, Rabatt, Wisdom-Kosten lesen die Hand des Kontrolleurs; Repro `a-6` |

## Ergebnis der restlichen roten Repros

| Gruppe | Agent | rot vorher | behoben / Repro korrigiert | bleibt rot |
|---|---|---|---|---|
| A01–A03 | W16b | 39 | 36 (+ H01-24) | A01-20 (Frage), A01-25 Golden Wings (zu groß), A02-35 (über W16e/F03-08 mit behoben) |
| A04–A06 | W16c | 32 | 30 | A04-30, A05-19b (Fragen) |
| A07–A09, C01–C03 | W16d | 35 | 33 | A08-06, A08-12 (Fragen) |
| C04–C05, F01–F03 | W16e | 36 | 34 (+ A02-35) | C04-05 (Frage), F01-17 Bow of the Hunt Goddess (zu groß) |
| H01–H04, M01–M02 | W16f | 39 | 37 | H02-22 Kazena (Frage), H01-24 (von W16b mit behoben) |
| R01–R02, S01–S03 | W16g | 39 | 35 | R01-05, S01-04, S01-27 (Fragen), S02-15 Love Shot Teil 2 (zu groß) |

Die Befundtabellen je Repro stehen in `cards/effects/CARD_API.md` in den Abschnitten „Welle 16 / W16a … W16g" (Einordnung 1–4 je Befund). Neue, wirksame Engine-Verträge (Auswahl): Hook `onTargetsDefeated`, Schutzfenster `beforeCreatureAffected` auch für Statuswurf und Negierung (`applyCreatureStatus`, `actionNegateCreature`), `discardOp`, `onRevive`, `onSummonEffectRepeated`, `afterCreatureHeal`, `eintrittsLimitErreicht`, `uebernahmeUnzulaessig`, `schoolLevelMitSupport`, `bypassStatusFilterOnLeave`, Kontrolle statt Brettspalte/Besitzer an rund 40 Stellen (Krates, Layn Master, Jenny, Crestina, Hammer Throw, Tears of Creation, Ralzish, Powder Keg, Sleeping Beauty, Coffee, Idol …).

## Ergebnis in Zahlen

* Repros: **948 grün von 961** (Welle 15: 699 von 919). **207 Repros von rot auf grün, 0 Rückschritte**, 42 neue Repros alle grün, keine Abstürze oder Timeouts.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot).
* Skilltest-E2E: rot nur battle, lobby, prep, seats, target (wie im Ausgangszustand).
* Dauerfeuer über alle Karten (~2 450 Läufe, beide Seiten): keine neu auffälligen Läufe.

## Noch rote Repros (13)

Regelfragen: A01-20, A04-30, A05-19b, A08-06, A08-12, C04-05, H02-22, R01-05, S01-04, S01-27. Zu groß: A01-25 (Golden Wings, ca. 2–3 h), F01-17 (Bow of the Hunt Goddess, ca. 0,5–1 Tag), S02-15 Teil 2 (Love Shot, ca. 1–1,5 Tage).

## Entscheidungen von Al nach Welle 16 (zur Umsetzung in Welle 17)

| Thema | Antwort von Al |
|---|---|
| Kazena (H02-22) | „Doch, Kazenas Effekt KANN bei leerem Deck aktiviert werden – und führt dann zu Niederlage durch Deck-Out." |
| Willy (H04-08) | „Ja, wenn Willy irgendwie ‚deaktiviert' ist, ist das Handlimit wieder da." |
| Pollution Piranha (A01-20) | „Ja. Das ist eine generelle Regel für ALLE Creatures, die andere Karten in Support Zonen ersetzen. Aber ACHTUNG: … ‚Alice, the Transfer Student' … darf dieses Replacement NUR für Zonen gelten, in denen exakt eine Karte liegt." |
| Magic Modifier (A03-03) | „Ja" (nur die aufgedeckte Kopie) |
| Doomsday Bomb (A03-13) | „Ja, die Schadenswert der Attacke ist egal" (zündet auch bei ATK 0) |
| Cosmic Depths (A02-23) | „Das ist okay" (zurückgemischte Karte suchbar) |
| Steam Dwarf Diver (A03-06) | „Der Diver sollte bei <=100 HP (current oder max) gar nicht aktivierbar sein!" |
| Scrap Plow (A03-16) | „Ja, das gilt grundsätzlich für Effekte, die ‚any card on the board that is not a Hero' treffen können" (verdeckte Surprises wählbar) |
| Slippery Snobbit (A02-05) | „Ja" (Slippery Fridge zählt) |

## Offene Rückfragen an Al (Ja/Nein)

**W16a (Resistance):** (1) Soll Resistance auch EIGENE vorteilhafte Spell-Anhänge am eigenen Resistance-Helden blocken (Light Ball, Regeneration, Castling)? (jetzt: ja, Folge von „blockt eigene Effekte") (2) Soll Fire Bomb am Helden blocken, wenn es Ausrüstung zerstört? (jetzt: nein) (3) Soll Resistance am Zielhelden das Verschieben von Anhängen/Ausrüstung durch Inheritance Ceremony abfangen? (nicht angefasst)

**W16c:** (4) Swagdri (A04-30): Soll eine ausgespielte Ausrüstung auch später, wenn sie das Brett verlässt, in den Gelöscht-Stapel statt in die Ablage? (jetzt: Ablage) (5) Skeleton Bard (A05-19b): Darf er ein Skelett wählen, das diesen Zug beschworen wurde? (jetzt: ja)

**W16d:** (6) Big Gwen Guard + Grinning Cat (A08-06): Soll der Abwurf der Katze als Kosten bezahlbar sein, sodass die Sperre wegfällt und Big Gwen beschworen wird? (jetzt: nein, abgelehnt) (7) Trial of Dominance + Paraseed (A08-12): Sollen von Dominance besiegte Paraseeds gelöscht werden statt sich einzunisten? (jetzt: einnisten) (8) Grave Worm (C03-07): Soll eine geliehene Kreatur, die in die Ablage ihres Besitzers geht, den Wurm NICHT auslösen? (jetzt: ja, löst nicht aus)

**W16e:** (9) Spirit of the Relic Hammer (C04-05): Soll auch der Gegner ohne eigenen Spirit die Haste für seine erste Kreatur bekommen? (jetzt: nein)

**W16g:** (10) Divine Gift of Rain (R01-05): Soll Rain bei beidseitigen Flächenzaubern (Armageddon, Cataclysm, Snowstorm Mischief) nur die Wirkung auf die Ziele des Reagierenden negieren, statt den ganzen Zauber? (jetzt: ganzer Zauber) (11) Divine Gift of Skill (S01-04): Soll „the user" der wirkende Held sein (dessen Magic-Arts-Stufe zählt)? (jetzt: die Stufe des gewählten Helden) (12) Such-Sperre (S01-27, Cats of the Pharaoh): Soll „cannot search" auch Deck-Suchen sperren, die aufs Brett führen (Create Illusion, Create Secret Room, Divine Gift of the Deepsea)? (jetzt: nein) (13) Anti Magic Zone: Darf ein im Fenster wiederbelebter Held ebenfalls keine Zauber wirken? (jetzt: nein) (14) Mission + Victory Phoenix Cannon: Soll der Folgezauber eine Mission-Ladung verbrauchen, statt unter Mission gesperrt zu sein? (jetzt: gesperrt) (15) Guard Change: Sollen gestohlene Kreaturen in freie Zonen meiner Helden ziehen dürfen? (jetzt: nicht angeboten) (16) Ida: Sollen auch die Flächenwahl (`actionAoeHit`) und Laser Volley abbrechbar sein? (jetzt: nur Holy Selection) (17) Dark Ocean: Soll auch `decay_spell` (Forbidden Zone) durchkommen? (jetzt: nein)

**Zur Kenntnis (Auslegungen der Agenten):** Thorad (A04-14) liest „single target" wie Frog Race Boat – Mehrziel-Zauber geben ihm den Bonus nicht mehr; Cute Familiar + Wildur (A04-18) analog zur Phoenix-Regel. Nicht angefasst: `heat-wave.js` hat dasselbe `immune`-Muster wie Arcane Lamp; Magic Amethyst und Golden Apple sind nicht auf Kontrolle umgestellt; Bill setzt `_isEffectEquip` nicht.
