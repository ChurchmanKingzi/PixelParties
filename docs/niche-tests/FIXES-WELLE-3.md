# Fix-Welle 3 – Als Entscheidungen umgesetzt

Nach Welle 2 hat Al eine Reihe von Regelfragen beantwortet. Fünf Agenten haben sie umgesetzt (G1, Z7b, Z7c, S1, D1); alle Zweige sind in `claude/beautiful-mendel-eb61lv` zusammengeführt.

## Entscheidungen von Al (verbindlich, in `CARD_API.md` verankert)

| Thema | Entscheidung |
|---|---|
| End-of-turn-Trigger nach Frozen/Stunned | Dürfen feuern, nachdem der Status abgelaufen ist → Ist-Zustand **gewollt** (C03-18, A03-28, H04-14 = kein Fehler) |
| Stowaway | Negiert **Abilities mit**, inklusive der Schulstufen der Spell Schools; heilbar |
| Held-Negierung allgemein | Zwei getrennte Zustände: **Effekt negiert** und **Abilities negiert**, die Karten einzeln oder zusammen vergeben können. Decisive Defeat: nur Effekt (Abilities samt Passiven laufen) |
| Goldsperre | „cannot gain or spend Gold": Nichts mit Gold-Kosten > 0 darf gespielt/aktiviert werden; Gesamtkosten 0 sind erlaubt |
| Zieh-Sperre | Aktivierungen bleiben möglich, solange der **komplette** Effekt nicht nur Ziehen ist (Triceras darf abwerfen). Gesperrt nur reine Zieher; „danach abwerfen/nicht mehr ziehen" als Nachteil des Zuges bleibt gesperrt; Alchemy gesperrt, Heinz offen, Staffs und Crystal Well offen |
| Negation und „once per turn/game" | Maßstab „Durfte die Karte resolven?": **Ganz-Negierung** (Master's Plan, Silence, Rusty Touch …) verbraucht **nichts** (auch nicht once per game/Divine Gift), gezahlte Kosten bleiben bezahlt; **Ergebnis-Negierung/Immunität/Fizzle** verbraucht. Ambush the Scout bleibt wie im Skript (Effekt negiert, Aktivierung hat aufgelöst → Slot verbraucht) |
| Kosten „to play this card" | Bleiben bei Ganz-Negierung bezahlt (Divine Gift of Sacrifice) |
| Surprises mit „once per game" | Erst die **Aktivierung** verbraucht die Grenze; mehrere Heroes dürfen dieselbe beschränkte Surprise verdeckt liegen haben |
| Reaktionen mit „opponent's" im Text | Nur dann auf Gegner-Quellen beschränkt, sonst auch auf eigene (Z3) |
| Mehrfachziel-Karte mit genau einem gewählten Ziel | Zählt für Reaktionen auf Einzelziel (Z3) |

## Zweige

| Zweig | Inhalt |
|---|---|
| `wave3/G1` | Zentraler Helfer `goldSpendBlocked`; alle Kostenwege; Client graut Gold-Karten mit `goldLocked` aus (`public/app-board.jsx`); Staff of Illusions bei Gesamtkosten 0 erlaubt; Eye-of-Ren-Log „paid: 0" |
| `wave3/S1` | Stowaway harte Negierung (Marke `abilitiesNegated`, `engine.heroAbilitiesNegated`), zwei Zustände Effekt/Abilities, Hook-Filter aufgeteilt (`_isHeroAbilityPassiveSilenced`), Client minimal (`app-board.jsx`, `app-shared.jsx`) |
| `wave3/D1` | Reine Zieher unter `drawLocked`/`handLocked` gesperrt (22 Skripte), Mischeffekte offen; Regel in `CARD_API.md` |
| `wave3/Z7b` | Umkehr der Z7-Stempelregel (`negatesWholeCard`, `onFizzledPlay`, `afterSpellPrevented`, `refundOnNegation`); 13 Repros auf die neue Regel umgeschrieben |
| `wave3/Z7c` | Opfer-Kosten bleiben bei Ganz-Negierung bezahlt (`payActivationCost` vor dem Reaktionsfenster: Divine Gift of Sacrifice, Sacrifice to Divinity, Knife Throw); Surprise-Grenze erst bei Aktivierung |

## Ergebnis in Zahlen

* Repros: **286 grün** von 703 (Welle 2: 265 von 691); **0 Rückschritte**, keine Abstürze. Die 13 von Z7b umgekehrten Repros sind keine Fehler mehr: S01-01, S01-02, S03-12, F02-10, F02-11, M02-10, A01-14, A06-29, A06-29b, A07-12, A09-17, C01-12, F01-19 (gelten jetzt als „kein Fehler / gewollt" – der Index zeigt sie noch als `✔ behoben`, weil das Repro die neue Regel prüft).
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot). `check-bundles.js` baut `public/dist` neu und vergleicht; nach einem Merge mit Client-Änderungen ist es einmal rot, dann grün.
* Skilltest-E2E: wie im Ausgangsstand (rot: battle, lobby, prep, seats, target); `cards.test.js` ist ein bekannter Zufalls-Flake (im Ausgangsstand ebenfalls ~1 von 4 rot, „Abomination wählt Gegner"); `mcts.test.js` braucht allein ~6 Min und läuft unter Last in den Timeout.
* Dauerfeuer über alle Karten: siehe Abschnitt „Endstand" unten.

## Offene Fragen an Al (ja/nein)

**S1 / Negation**
a) Locke, Null, Crusader's Hookshot, Bishop of Kings [B], Water Golem sagen im Text nur „effect(s)", der Code gibt aber die **harte** Form (Abilities weg, Ruling v1114: Standard = Heldeneffekt UND Ability-Zonen). Auf „nur Effekt" umstellen? (kippt v1114)
b) Royal Treasury (Attachment, Bonus 4/6/8 Gold nach Magic-Arts-Stufe): beim Stowaway-Wirt Stufe 0 lesen (Bonus entfällt)?
c) Interference wirkt heute bei jeder Negation nicht (Ruling „in welcher Form auch immer") – soll es bei der leichten Form (Decisive Defeat, Weakening Crystal) wirken?

**G1**
d) Staff of Illusions auch **ohne** Goldsperre: Stufe-0-Kreatur erlauben, wenn weniger als 10 Gold da sind (heute sperrt die optimistische Vorprüfung „mindestens 10 Gold")?

**Z7b/Z7c**
e) Soul Transmigration Ritual und Weapon Unleashing („to use this Spell", Opfer/Abwurf): Kosten vor dem Fenster zahlen und bei Negierung bezahlt lassen (zusammen mit A01-17: Token-Kosten von Medusa's Curse, Null Zone, Goldify, Reincarnation, Mass Multiplication, Golden Wings)?
f) Tribut-Kreaturen (500 Piranhas, Dark Deepsea God …): Kosten (`beforeSummon` nach der Kette) bei komplett negierter Beschwörung (Off Duty) bezahlt lassen?
g) Artefakt-Opferkosten (Hive's Crown, Ladder to the Sky, Remote Detonator): vor dem Fenster zahlen (bräuchte neuen Kostenhaken im Artefaktweg)?
h) Rebelliokai-Kosten (Kirin Firebreath, Tanuki Escape, Tengu Windstorm, Kappa Sword Slash) trotz Hausregel „nach der ersten Zielwahl" bei Negierung bezahlt lassen?
i) Tharxian Horse: darf nach einer Aktivierung eine weitere Kopie noch verdeckt gesetzt werden (jetzt ja), und bleiben übrig gebliebene verdeckte Kopien liegen (jetzt ja)?

**Aus Welle 2, noch offen:** Fragen 1–3 (Z1), 6–9 (Z4/Z5), 12–15 (Z6), 17–20 (Z7) in `FIXES-WELLE-2.md`; Z7-Fragen 16 (Silence & Co. verbrauchen den Slot) und Z7 18/19/20 sind teils durch die neue Regel überholt.

## Aufräumen / Hinweise

* Neue/umgeschriebene Repros: `repro/C05-creatures/12,13`, `repro/D1-ziehsperre/01,02`, `repro/Z7c/*`; 13 Z7b-Repros (siehe oben), F03-16, A08-24 (d), A07-21, A03-24, H01-18, H04-16, M01-23, R02-11 (auf die Zieh-Sperren-Regel umgestellt).
* `CARD_API.md` wurde erweitert/korrigiert: Ruling v1031 (aufgehoben, Entscheidung Welle 3, 14.10.2026), „★ Z7b", „★ Z7c", Zieh-Sperre, Goldsperre, Stowaway/zwei Zustände, `payActivationCost`-Vertrag.
* Neue „Negate that Spell"-Reaktionen brauchen das Flag `negatesWholeCard`; neue Kosten „to play this card" gehören in `payActivationCost`.
