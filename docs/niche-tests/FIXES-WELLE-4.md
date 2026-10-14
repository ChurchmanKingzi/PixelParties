# Fix-Welle 4 – Antworten a–i umgesetzt

Al hat die offenen Fragen aus [FIXES-WELLE-3.md](FIXES-WELLE-3.md) beantwortet; zwei Agenten (W4a: Negation/Skalierung, W4b: Kosten) haben sie umgesetzt. Zweige `wave4/W4a`, `wave4/W4b` sind in `claude/beautiful-mendel-eb61lv` zusammengeführt (ohne Konflikte).

## Entscheidungen von Al (verbindlich, in `CARD_API.md` verankert)

| Thema | Entscheidung |
|---|---|
| a) „effects negated" (Locke, Null, Crusader's Hookshot, Bishop of Kings [B], Water Golem) | Nur **Effekt** negiert, Abilities **nicht** (leichte Form, Marke `effectOnly`). v1114-Standard (`negated` ohne Marke) bleibt die harte Form |
| b) Skalierung unter Stowaway | Magic Arts → Stufe 0 (Royal Treasury ohne Bonus); gilt für **alle** Scaling-Karten |
| Zusatz 1 | **Jede** Ability-Negierung (Stowaway, harte Standardform wie Sparky Slime/Silence) setzt Skalierung auf 0; reine Effekt-Negierung nicht |
| Zusatz 2 | Unter Ability-Negierung haben auch Love Shot, Lizbeth & Co. **keinen Zugriff** auf die betreffenden Abilities (Level-Bypass, Zählung, geborgene Abilities) |
| c) Interference | Wirkt als Ability, solange die Abilities nicht negiert sind (also auch unter leichter Form) |
| d) Staff of Illusions | Stufe-0-Kreatur erlaubt, wenn die Kosten dafür 0 sind (auch unter 10 Gold) |
| e)–h) Kosten bei Ganz-Negierung | Bleiben bezahlt und werden dafür **vor dem Reaktionsfenster** gezahlt: Soul Transmigration, Weapon Unleashing, Token-Karten (A01-17), Tribut-Kreaturen, Artefakt-Opfer, Rebelliokai-Karten, Teocuilatl-Trio/Suspicious Monster/Deepsea-Tausch, Angry/Sickly Cheese |
| Deepsea-Tausch | Wird die neue Kreatur negiert, bleibt die ursprüngliche (zurückgegebene) Karte auf der Hand, die neue ist negiert |
| Kirin/Tengu/Kappa | Kostenkarte vor der ersten Zielwahl, danach nicht abbrechbar – gewollt |
| i) Tharxian Horse | Weitere Kopien dürfen gesetzt werden, nach der ersten Aktivierung wird aber nie mehr eine aktiviert (war schon so) |

## W4a – Negation und Skalierung (`wave4/W4a`, a33a416)

* **A:** Neue Marke `effectOnly` für die fünf Karten; `_isHeroAbilityPassiveSilenced`, `isHeroIncapacitated`, `heroMeetsLevelReq`, Weisheitskosten und Client (Level-Spiegel, Badge-Text) behandeln sie wie die leichte Form.
* **B/Zusatz 1:** Helfer `engine.heroAbilityLevelsBlanked` und `engine.heroSchoolLevel`; `_getCandidateAbilityZoneSets` und `effectiveSchoolLevelForCaster` lesen bei harter Form Stufe 0. ~30 Karten mit Rohzugriffen einzeln umgestellt (Royal Treasury, Army of the Cute, Capture, Create Illusion, Haste, Heal, Stealth, Fireshield, Stranglehold, Biomancy …).
* **Zusatz 2:** Love Shot, Thieving Strike (`canBypassLevelReq`), Difficulty Lever, Weapon Unleashing, Sarcophagus of Sealed Magic, Communication Device; **neu gefunden und behoben:** ein hart negierter Held konnte seine Abilities noch aktivieren (nur Stowaway-Wirt war gesperrt) – jetzt `doActivateAbility`/`doActivateFreeAbility` und Client-Ausgrauung für alle harten Negierungen. Lizbeth war schon richtig.
* **C/D:** `interferenceLevel` prüft `_isHeroAbilityPassiveSilenced`; Staff of Illusions: Vorprüfung „mind. 10 Gold" nur noch, wenn keine wählbare Kreatur effektiv Stufe 0 hat.
* Bewusst nicht geändert (nur Zustand, kein Ability-Zugriff): Forbidden Curse of Aging, Holy Selection, Yukana, Divine Gift of Equality, Crusader's Arm-Cannon, Weird Doll, Magic Amethyst, Noble Mummy Guards, Weapon Absorption. Karten mit „Heroes with at least …"-Text ohne Skript (Arms Trade, Kai, Rosie, Wise Village Elder, Possessed Blade, Spell Shackle …) sind nicht prüfbar; neue Skripte sollen `heroSchoolLevel`/`heroAbilityLevelsBlanked` nutzen.

## W4b – Kosten vor dem Fenster (`wave4/W4b`, 693ba95)

* Je Kartenart ein Kostenhaken **vor** dem Kettenfenster: Zauber/Attacks `payActivationCost(ctx)`, Kreaturen neu `paySummonCost(ctx)` (`ctx._summonKosten`), Artefakte neu `payArtifactCost(...)` (5. Argument an `resolve`). Läuft der Haken nicht (Effekt-Beschwörung, Gratis-Spiel), zahlt die Karte wie früher selbst. Nach der Zahlung sind folgende Wahlen nicht mehr abbrechbar (Ausnahme Cold Coffin).
* Betroffene Karten: E (Soul Transmigration Ritual, Weapon Unleashing, Medusa's Curse, Null Zone, Goldify, Reincarnation, Mass Multiplication, Golden Wings; A01-17 und A01-03 behoben), F (500 Piranhas, Dark Deepsea God, Blue-Ice Dragon, Foresta, Egg of God, Steam Dwarf Dragon Pilot, King Trex, Chimera, Pollution Piranha), G (Hive's Crown, Ladder to the Sky, Remote Detonator), H (Kirin Firebreath, Tanuki Escape, Tengu Windstorm, Kappa Sword Slash), Deepsea-Tausch (17 Skripte), Archer/Guardian/Warrior of Teocuilatl, Suspicious Monster, Angry/Sickly Cheese.
* Tauschplätze bleiben bis zur Landung der neuen Kreatur gehalten (`engine.haltePlatzFuerTausch`/`isSwapSlotHeld`), damit Corpse Cannibal & Co. den Platz im Fenster nicht wegschnappen (eine Zeile in `chaorc-corpse-cannibal.js`).
* Eingriffe außerhalb des Auftrags: `goldify.js` (`spellPlayCondition` verlangt eine echte Kreatur mit Level als Ziel), Repro `A01-pollution/03` auf die neue Regel umgestellt (Kartenwahl nach Zahlung nicht abbrechbar).
* Unverändert (nicht gefragt): Temple of Sacrifice (optionales Opfer) und Basketskull (Doom Counter) zahlen weiter erst beim Auflösen; ein Deepsea-Tausch mit nicht tauschbarem Bewohner (in diesem Zug beschworen) bricht ab, die Karte bleibt auf der Hand.
* Bekannte Grenzfälle: Belegt im Fenster ein Effekt den freigeopferten Platz, bleibt die Karte bei bezahlten Kosten auf der Hand; eine andere Beschwörung im Fenster kann den Tribut-Stempel `_tributePaid` verbrauchen.

## Ergebnis in Zahlen (zusammengeführter Stand)

* Repros: **313 grün** von 725 (Welle 3: 286 von 703); **0 Rückschritte**, keine Abstürze/Timeouts; 22 neue Repros (`W4-neg/01–11`, `W4-kosten/E1–E3, F1, F2, G1, H1, I1, J1, J2, K1`) bei den beiden Agenten bereits gegen den Ausgangsstand rot gemessen, A01-03, A01-17, F03-13, M02-03 (Thieving Strike) und M02-09 zusätzlich behoben.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot); Skilltest-E2E (30 Dateien) identisch (rot: battle, lobby, prep, seats, target); Dauerfeuer über alle Karten (~2 440 Läufe): **keine neu auffälligen Läufe** gegenüber dem Ausgangsstand.

## Offene Fragen an Al

Keine neuen aus Welle 4. Offen bleiben die Fragen aus [FIXES-WELLE-1.md](FIXES-WELLE-1.md) und [FIXES-WELLE-2.md](FIXES-WELLE-2.md) (Z1: 1–3; Z4/Z5: 6–9; Z6: 12–15; Z7: 17–20, teils überholt) sowie die 409 B-Befunde nach Ursachenklassen.
