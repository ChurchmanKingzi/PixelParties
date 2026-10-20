# Fix-Welle 24 – Befunde der Tiefentests (N1–N5), Stufe A/B

In Welle 23 wurden 174 bisher flach geprüfte Karten tief getestet (Berichte `N1-reaktionen-a.md`, `N2-reaktionen-b.md`, `N3-kreaturen.md`, `N4-archetypen.md`, `N5-sonstige.md`; **81 neue Befunde: 12 A, 49 B, 20 C**). Fünf Agenten (**W24a–e**) haben die 61 Stufe-A/B-Befunde und drei von Al inzwischen entschiedene Stufe-C-Fragen (N4) behoben. Zweige `wave24/W24a–e` sind zusammengeführt (keine Konflikte).

## Behobene Befunde (Auswahl nach Ursache)

| Gruppe | Befunde | Ergebnis |
|---|---|---|
| N1 Reaktionen A | 11 | Curse-ATK nach Heldentod (N1-01), Berserk-Held beschwört per Effekt (N1-02), Dark Deal zwei Kopien (N1-03), Corpse Explosion nach Kontrolle statt Brettseite (N1-04) und bei Besiegen ohne Schaden (N1-05, Kreaturen und Helden, nicht bei Opfer/Eigenabgang/HP-Kosten), Cure mit nur Kreatur als Ziel (N1-06), Cottage nur Kontrolleur (N1-07), Anhänge bei Effekt-Immunität des Wirts (Barrier of Faith, für alle 27 Anhangs-Karten, N1-08), Decisive Defeat mit fremder Negierung (N1-09), Curse zählt `nulled` (N1-10), Anti Magic Shield zählt Support-Zonen-Abilities (N1-15) |
| N2 Reaktionen B | 9 | Invisibility (nur Held-Schaden, N2-01), Fireshield nicht auf Heldeneffekt (N2-02), Detection öffnet Ablage-Fenster (N2-03), Emergency Spell Armor/Flooding/Glass Wall erkennen Alice/Broghan (N2-07/08), Gold Trap sieht Wealth-Zuschlag (N2-09), Idej Projection/Energy Aura beim Umhängen (N2-10/11), Energy Aura gegen Gathering Storm (N2-13) |
| N3 Kreaturen | 15 | Sarcophagus/Forest Warden/fünf Spirits nach Kontrolle (N3-01/02/03), Forbidden Grimoire wirkt für den Nutzer (N3-04), Duigno-Zweitaktion verfällt (N3-05), Slave Trader/Suspicious Monster Kartenbilanz +1 (N3-06, auch Sofort-Aktion), Elusive Hind (N3-07/18), Gangster Angel (N3-09), Biseria-Frost-Immunität (N3-10), Ellie (N3-11), Trident-Spirit-Rückholung (N3-12), Festive Werz (N3-17), Relic Hammer (N3-19), Powder Keg (N3-21) |
| N4 Archetypen | 15 + 3 entschiedene C | Silk Bridge (N4-01/18), Alleria-Marke (N4-02/04/12), Cute Spider (N4-03), Healer/Reaper/Hardy Slime nach Kontrolle (N4-05/06/07), Backup Bakus (N4-08), Bomblebee (N4-09), Reaper-Kette (N4-10), Cloudy Slime (N4-11), Sandy Blob an allen Ausstiegen (N4-14), Sparky Slime (N4-15). Von Al entschieden: **Alleria** darf auch bei genau einer Kreatur umleiten (Text sagt „target"), **Slime Rancher** verdoppelt die Einsatz-Effekte aller Slimes (Text sagt bei den Slimes nicht „you control"), **Heli Troopers**: Frost im Zug des Ziel-Besitzers endet mit diesem Zug (Ist-Zustand); Frost-Grundsatz in `CARD_API.md` dokumentiert, 22 Quellen ohne Abweichung geprüft |
| N5 Sonstige | 11 | Treacherous Crystal/Gigantisaur/Controlled Attack nach Kontrolle (N5-01/03/08), Harpyformer/Red Dragoneer unter Sperre (N5-02), Cute Camera in Hand-Reaktionsfenstern (N5-04, sieben Fenster melden jetzt `_reaktionGespielt`; Front Soldier dort ebenfalls), Cute Conversion/Cute Wings (N5-05), Potion of Greed unter `potionDrawBanned` (N5-07), The Melting vs. Cold Coffin (N5-09, neue Option `opts.unhealable`), Glimpse of the Future (N5-10), Piercer of Heavens abbrechbar (N5-11), Magic Amethyst (N5-12) |

Repro-Korrekturen (Repro maß falsch): N2-10, N4-18 (Charme Lv3 verhindert Schaden), N5-07 (leeres Potion Deck nur noch Notiz).

## Ergebnis in Zahlen

* Repros: **1096 von 1113 grün** (vorher 1011 von 1092 plus 21 neue W24-Repros); alle 61 Befund-Repros der Stufen A/B und die 3 entschiedenen N4-Fälle sind grün. **0 Rückschritte.** Rot sind genau die 17 noch offenen Stufe-C-Befunde, deren Entscheidungen jetzt vorliegen (Umsetzung in Welle 25).
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot).
* Skilltest-E2E: rot nur battle, lobby, prep, seats, target; `cards.test.js` war im Sammellauf einmal rot und ist einzeln 2 von 2 grün (Lastflake).
* Dauerfeuer über alle Karten (~2 450 Läufe, beide Seiten): keine neu auffälligen Läufe.

## Entscheidungen von Al zu den 17 Stufe-C-Befunden (Umsetzung in Welle 25)

| Befund | Antwort von Al |
|---|---|
| N1-11 Attach „to a Hero you control" | nur nach aktueller Kontrolle |
| N1-12 Dark Ocean vs. Surprises | „Ocean verhindert Surprises (cannot react to)" |
| N1-13 / N3-16 Burn-/Gift-Tick als „defeated by an opponent's card or effect" | nein |
| N1-14 Dichotomy | ja, auch Surprise-Vor-Schaden-Reduktionen verhindern |
| N1-16 Spell-Sperre | Surprise setzen ja, aktivieren (falls Spell) nein |
| N2-04 Aging | Frost/Betäubung laufen normal aus |
| N2-05 Guardian | laufend für alle Kreaturen, die zum Zeitpunkt eines möglichen Effekts kontrolliert werden |
| N2-06 Spell-Anhängsel | NICHT still legen; bei Gathering Storm und Intrude ist das ein Bug |
| N2-12 Mehrfachziel-Reihenfolge | erst Negation, dann Reaktion auf Hits |
| N2-14 Guardian Angel vs. Aging | Ist-Zustand passt |
| N3-08 Drill Sergeant | Hind und Plant Golem bei vollem Gegnerbrett nicht anbieten |
| N3-13 Place | ja, „place triggert On-Summon" als allgemeine Regel in die API |
| N3-14 Knife-Spirit | geopferte Kreaturen werden gelöscht (Ist-Zustand); Status-Schaden-Tode zählen als besiegt |
| N3-15 Drill Sergeant | liest die Hand-Stufe |
| N3-20 Relic Hammer | Spirit zählt nicht als erste Kreatur (Ist-Zustand) |
| N5-06 Chuck | ja, Anti-Magic-Immunität zählt als immun gegen diese Quelle |
| Corpse Explosion (W24a) | auch gegnerische Kreatur ohne Schaden besiegt; dauerhaft übernommener Held ohne Schaden nach Kontrolle; Cleanse bei Decisive Defeat nimmt auch die fremde Negierung mit (gewollt) |

## Offene Rückfragen an Al (Ja/Nein)

1. **Potion of Greed (N5-07):** Soll sie bei leerem Potion Deck gesperrt sein? (heute spielbar)
2. **Cute Camera (N5-04):** Soll sie in Hand-Fenstern auch angeboten werden, wenn die Quelle des Fensters unbekannt ist (z. B. Tod-Fenster)? (heute ja)
3. **Flooding (N2-08):** Soll „chosen by an Attack or Spell" auch als Attack/Spell geltende Heldeneffekte (Broghan, Alice) erfassen? (heute ja)
4. **Glass Wall (N2-08):** Soll Broghans als Attack geltender Heldeneffekt auslösen, obwohl er keine Stufe hat? (heute nein, nur Alice zählt als Stufe 0)
5. **Alleria (N4-04, Sabrina):** Soll Alleria auch für eine aus dem Deck aktivierte Surprise nicht ziehen? (heute zieht sie)
6. **Shadowy Slime (N4):** Soll „level 0 Creature from your discard pile" die wirksame Stufe (inkl. Lethe-Stempel) nutzen statt der gedruckten?
7. **Foresta, Blue-Ice Dragon, Dragon Pilot (N3-06):** vermutlich dasselbe Doppel-Platzierungs-Muster wie Slave Trader (nicht reproduziert) – Hinweis, keine Frage.
