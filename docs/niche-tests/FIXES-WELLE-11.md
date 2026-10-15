# Fix-Welle 11 – Einzelfragen 56–85 und Rückfragen aus Welle 10

Al hat die 9 Rückfragen aus Welle 10 und die Einzelfragen 56–85 beantwortet; drei Agenten haben sie umgesetzt: W11a (`wave11/W11a` 9158dd0: Equip-Fenster, War Counselors, Sandy Blob, Beschwörer-agiert, Thuly, Priester, Golden Vermin), W11b (`wave11/W11b` 4052ffb: Gift, Rusting Crystal, Erste-Runden-Immunität, 500 Piranhas, Squire, Angler Angel, Grimoire) und W11c (`wave11/W11c` ff4f56c: Drill Sergeant, Lawn Gnome, Mausoleum Worm, Horned Demon, Jiggles, Gleichstand). Alle Zweige sind zusammengeführt (einziger Konflikt: `CARD_API.md`).

## Entscheidungen von Al (verbindlich, in `CARD_API.md` verankert)

| Frage | Entscheidung / Umsetzung |
|---|---|
| R1 Anhängsel und Equip-Fenster | Spell-/Attack-Anhängsel (Curse, Stoneskin …) öffnen das Equip-Fenster von Afflicted Pests und Cybug LOCUST; der Wirker gilt als Anleger |
| R2 Powder Keg | öffnet es nicht |
| R3 War Council Gathering Place | 8 Gold erst, wenn der Ratgeber-Effekt sein Ziel bestätigt hat, aber vor der Auflösung (Harpthenean sieht den reduzierten Goldstand); bei Abbruch nie Gold abgezogen; alle 6 Ratgeber |
| R4 Sandy Blob | löst nur bei wirklich feuernden On-Summon-Effekten aus; abgelehntes „you may" und leeres Suchen lösen nicht aus (Stempel `summonEffektFizzelt(…, {stumm:true})`, ~60 Skripte) |
| R5 Beschwörer agiert | Reaction-Creatures und Effekte, die „summon" sagen, brauchen einen aktionsfähigen Helden (Hilfsfunktion `heroAgiert`); „place" nicht (z. B. Monster Nest) |
| R6 Anti Magic Enchantment | jedes angelegte Artefakt zählt; der Kontrolleur des Artefakts negiert |
| R7 / R9 | Waflav-Zielliste korrekt; Stormblade-Zyklus bleibt |
| R8 Selbst-Platzierungen | zählen als „Kreatur beschworen/platziert in diesem Zug" (Zähler), verbrauchen die Aktion nicht (per Repro abgesichert) |
| Q56 Bloom (Continent/Maniacal) | Gift-Heilung = voller Wert inklusive Paraseed-Boni, reihenfolgeunabhängig |
| Q58 Rusting Crystal | zwei Kopien verteuern einander (je 30), „does not stack" bleibt |
| Q59 Afflicted Pests | löst bei Abilities nicht aus; Kartentext präzisiert: „…equips or attaches a card into a Hero's Support Zone." |
| Q61 Thuly | auch Helden-Opfer (Hook `onHeroSacrificed`) |
| Q62 Priester | Gift-/Brand-Ticks zählen als „takes damage" bei allen |
| Q66 / B-05 Erste-Runden-Immunität | schützt auch vor vorteilhaften/zustandsändernden Nicht-Schadens-Effekten, die gegen den Geschützten uneinsetzbar sind (Flag `blockedByFirstTurnProtection`, 11 Karten) |
| Q69 500 Piranhas | Schaden am Ende des Zuges des aktuellen permanenten Kontrolleurs des Helden |
| Q70 Candlestick Squire | normale Beschwörung möglich (Prompt Special/Normal) |
| Q71 / Q81 Angler Angel | verstärkt alle Treffer eines Mehrfach-Effekts (beide Salven des Assault Eagle, Jiggles, Land Sharks) |
| Q72 500 Piranhas | belegte Opferzone → erste freie Zone desselben Helden, sonst Ablage |
| Q73 Grimoire / Kohta | dürfen Effekte wiederholen (Ist-Zustand) |
| Q74 Drill Sergeant gestohlen | legt beim Helden, unter dem er liegt |
| Q75 / Q79 Lawn Gnome | Borger/Dieb wählt die Stufe normal; eine Stufenänderung je Zug insgesamt (Hand + Brett); Kartentext: „…change this card's level in your hand or on the board while you control it to any level from 0 to 3." |
| Q76 Golden Vermin | Grundeinkommen unberührt; Wealth, Semi u. ä. Zusatzeinkommen darf er auslösen (Hook `onIncomeBonusGain`) |
| Q77 Mr. Jiggles | wählt sich **nie selbst** (auch geliehen nicht) – Ist-Zustand; eine Fehlinterpretation meinerseits wurde per Revert-Commit zurückgenommen |
| Q80 Mausoleum Worm | „play 1 per turn" gilt für Hand und Ablage zusammen |
| Q82 Horned Demon geliehen | Counter am Ende des Zuges des aktuellen Kontrolleurs (Ist-Zustand) |
| Q85 Gleichstand | wenn nichts anderes steht, gewinnt der Karten-Wirker (`_kartenWirker`); Kartenklauseln haben Vorrang; ohne Karte bleibt Sitz-Standard |

## Zahlen (zusammengeführter Stand)

* Repros: **532 grün** von 818 (Welle 10: 490 von 795); 19 weitere Befunde behoben, **0 Rückschritte**, 0 Abstürze/Timeouts; die neuen W11-Repros (`W11/a-*`, `b-*`, `c-*`) sind grün.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot). Skilltest-E2E: rot nur battle, lobby, prep, seats, target. Dauerfeuer über alle Karten: keine neu auffälligen Läufe.

## Rückfragen an Al (ja/nein)

**Aus W11a:** (1) Sandy Blob löst heute auch bei ~45 Kreaturen ohne On-Summon-Text aus (Skript hat einen onPlay-Hook für anderes, z. B. Archer, Spinnen, Albrecht, Priest of Luna, Censpartan) – soll er dort nie auslösen? (2) Blockiert auch ein nur „effekt-negierter" Held (Decisive Defeat, Weakening Crystal) jedes „summon" per Effekt (umgesetzt ja, wie `canHeroSummon`)? (3) Anti Magic Enchantment auf einem gegnerischen Artefakt: negiert der Kontrolleur des Artefakts (jetzt) oder der AME-Spieler? (4) Foresta-HP-Kosten (Held bei 1 HP „geopfert") lösen jetzt Thuly aus – gewollt?

**Aus W11b:** (5) Grimoire/Kohta dürfen auch einen Effekt nutzen, dessen EIGENES Limit erschöpft ist (3-Headed Giant bei 3/3, Analyzer mit beiden Optionen)? (heute nein) (6) Zwei-Seiten-Karten (Market Crash, The Sacred Jewel) in Zug 1 komplett unspielbar (jetzt) oder nur die geschützte Seite überspringen? (7) Rioting Village (globale Area, verdoppelt ATK aller Helden): geschützte Helden in Zug 1 ausnehmen? (8) Elven Leader („Repeat this effect"): jede Wiederholung +50 durch Angler (heute nur der erste Schlag, Ruling 20.8.)? (9) Piranhas: Landet die Karte per Q72(c) in der Ablage, ist die Rundengrenze verbraucht (jetzt ja) – soll sie frei bleiben? (10) Piranhas: Steht der Wirtsheld auf meiner Seite (Opfer war meine gestohlene Kreatur), fällt der Schaden am Ende MEINER Züge – richtig? (11) B-06 (16 reine Schaden-/Status-Karten ohne Zielwahl, in Zug 1 spielbar und verbraucht) war nicht Teil von Q66 – soll das Flag-Prinzip auch dort greifen?

**Aus W11c:** (12) Mausoleum Worm: soll „play 1 per turn" auch Effekte sperren, die einen Wurm aufs Brett platzieren (z. B. The Master's Key)? (heute nur Stempel) (13) Gleichstand ohne jede Karte (z. B. Statusticks beider Seiten am Zugende): soll der Zugspieler gewinnen? (heute verliert Sitz 0) (14) Lawn Gnome: soll die Einmal-Grenze auch gelten, wenn er im selben Zug vom Brett zurück auf die Hand geht? (heute nein)
