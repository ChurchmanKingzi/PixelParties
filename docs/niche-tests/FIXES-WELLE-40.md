# Fix-Welle 40 – Antworten auf die W39a-Rückfragen

Al hat die fünf Rückfragen aus [FIXES-WELLE-39.md](FIXES-WELLE-39.md) beantwortet (22.10.2026). Ein Agent (**W40a**) hat sie umgesetzt; Zweig `wave40/W40a` ist zusammengeführt (keine Konflikte). Details und Verträge: `cards/effects/CARD_API.md`, Abschnitt „Welle 40 / W40a"; Repros `docs/niche-tests/repro/W40/a-01 … a-05`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Duel: „is chosen"-Reaktionen/Schutz | „Das ist korrekt, der Duel-Nutzer ‚wählt' nie den Gegner-Hero." | Ist-Zustand bleibt, abgesichert (`W39/a-06`, `a-08`, Duel-Zeilen in `W40/a-01`, `a-02`) |
| Duel: Zähler und Pfeil-Bonus | „Jeder Schlag gilt als eigene Attack, ja. Aber Arrows boosten nur EINE Attack, also würde ein Pfeil-Bonus nur den ersten Schlag buffen und dann enden." | Wurzel: `hero._armedArrows` blieb bis zum Kartenende scharf – bei Duel boosteten Arrows, Magic Topaz und Bow Sniper Darge alle drei Schläge (Poisoned Arrow 3 Stacks statt 1, Hydra Blood 9 statt 3, Golden Arrow 30 statt 10 Gold). Jetzt `clearArmedArrows` nach Schlag 1 in `duell()`; zwei weitere Lecks mit behoben (Nieht: Pfeil boostete auch die Bonus-Attack; Kunagi: Pfeil galt auch für die Wiederholung). Zusatzfix: spielt Held 1 das Duel und duelliert Held 0, hängen die Pfeile vor Schlag 1 am Duellanten (vorher verfielen sie wirkungslos). Schon korrekt: Elixir of Strength, Guardian Beast Niu, Glass Sword, Shattered Trident, Ghuanjun-Combo, Andras/Bartas/Grisgar/Whirlwind Strike/Ricochet (eine Attack, mehrere Ziele), Warhorse. Repros `a-02`, `a-05` |
| Idej Sword – Kunagi („repeat that Attack") | „Doch, Kunagi soll auch Effekte wie Broghan wiederholen können. Im Fall von Brackle wäre dafür ein zweites Opfer nötig, im Fall von Effekten wie Javelin Throw müsste ein weiteres Equip entfernt werden." | Zentral über `engine.alsAttackKette({ …, wiederhole })` / `meldeAttackAufgeloest({ …, wiederhole })`; Kunagi wiederholt in einer Schleife, solange der Schlag genau 1 Kreatur besiegt (während der Wiederholung `gs._kunagiWdh`: neues Ziel unter den Gegnern, vorheriges ausgeschlossen, keine erneute Wiederholung). Kosten je Quelle: Brackle und Infected Greatmaw ein weiteres Opfer, Javelin Throw ein weiteres Equip (Kunagi selbst wird mit angeboten); Broghan, Arthor, Heragas, Kohta, Sword in a Bottle, Crusader's, Bamboo Staff, Sacrificial Dagger, Alluring Light ohne Zusatzkosten (Stempel/Limits werden nicht doppelt verbraucht); ohne Kosten keine Wiederholung und nichts bezahlt. Repro `a-03` |
| Eraser Beam | „Attacks sollen den Stempel … GAR NICHT setzen, sondern nur Spells! Und in dem Fall würden auch solche ohne Karte (etwa Alices Effekt) den Stempel setzen und Eraser Beam verbieten." | Kartentext: „This must be the only **Spell** you play this turn" (deckt sich mit Als Entscheidung). Stempel nur durch Spells: Spell-Karten (auch Sofort-Güsse/Zusatzaktionen), Alice (Effekt ohne Karte, auch negiert) und die Karte Alluring Light selbst; nicht durch gespielte Attack-Karten, Duel und als-Attack-zählende Effekte; abgebrochene Spells stempeln nicht. Repro `a-01` |
| Alluring Light – Schutz vor Targeting | „… Beim eigenen Ziel greift kein Schutz vor Targeting wie Butterfly Cloud – aber beim gegnerischen schon. Ein per Butterfly Cloud untargetable Hero kann NICHT als der Angreifer für Alluring Light gewählt werden!" | Grundfälle (Butterfly Cloud, Invisibility, Stealth auf dem Gegnerhelden) filterte `promptEffectTarget` schon; Lücken behoben: die Schutzrechnung lief nur über die Liste der angriffsfähigen Helden (war der einzige angriffsfähige Held geschützt, war die Karte trotzdem spielbar), `spellPlayCondition` prüfte den Schutz nicht, Truth-Seeing Eye des Wirkers hob den Schutz nicht auf. Jetzt `waehlbareAngreifer` über alle lebenden Gegnerhelden, danach `heroKannAngreifen`; ohne wählbaren Angreifer ist die Karte unspielbar. Eigenes Ziel bleibt ungeschützt. Repro `a-04` |

## Ergebnis in Zahlen

* Repros: **alle 1199 Repros grün** (vorher 1194; 5 neue), 0 Rückschritte; kein altes Repro umgestellt.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Skilltest-E2E: wie im Ausgangsstand (fehlendes `socket.io-client`; mit `NODE_PATH` grün: cards, draw-cards, sacrifice).
* Dauerfeuer: 14 Karten × 2 Seiten, Fingerabdrücke identisch zur Basis, 0 Fehler.

## Offene Rückfragen an Al (Ja/Nein)

1. **Hardy Slime (Taunt) bei Alluring Light:** Greift der Taunt weder bei der Angreifer- noch bei der Opferwahl, weil der Gegner nichts wählt? (jetzt so)
2. **Kunagi × Sacrificial Dagger / Bamboo Staff:** Wiederholt Kunagi sie ohne Zusatzkosten, weil Opfer bzw. „Karte aus der Ablage" der Auslöser sind und nicht die Zahlung des Schlags? (jetzt so; bei Brackle, Greatmaw und Javelin Throw fallen die Kosten erneut an)
3. **Kunagi × Alluring Light:** Wählt der Kunagi-Besitzer (Kontrolleur des gezwungenen Helden) das neue Opfer unter den Zielen des Light-Spielers? (jetzt so)
4. **Alluring Light mit Butterfly Cloud:** Bleibt ein Butterfly-Cloud-Held als Angreifer unwählbar (Karte unspielbar), wenn die übrigen Helden nur wegen Frozen oder Stunned nicht angreifen können? (jetzt so)
5. **Duel-Pfeile:** Gehört der Pfeil-Bonus dem Duellanten, auch wenn ein anderer Held die Karte spielt? (jetzt so)
6. **Kunagi-Wiederholung und Attack-Zähler:** Soll die Wiederholung eines Effekts als eigene Attack für die Zähler (Berserk, Rioting Village, Mirjam) zählen, die Wiederholung einer Attack-Karte aber nicht, oder beides gleich? (jetzt: Effekt-Wiederholung zählt, Karten-Wiederholung wie bisher nicht)
