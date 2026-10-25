# Equip-Audit Darion (geteilte Equip-Zone) — Partition P6 (gemeinsame Bausteine `_*.js`, `_engine.js`, ein paar Ability-Skripte)

Tests: `docs/niche-tests/repro/W75/h-P6-01 … h-P6-11` (jeder Test schlägt auf dem Ausgangsstand f0b4e03 fehl, wo ein Fehler vorlag; `h-P6-11` ist ein Regressionstest).
Klassen: A Auswahl/Entfernen · B Zählen/Bedingungen · C Anlegen per Effekt · D ganze Zonen/Kontrolle/Tod · E Equip-Skript/Hooks/Kopien. „irrelevant" = fasst keine Nicht-Kreaturen-Karten in Support Zonen an.

| Datei | Klassen | Befund | Test |
|---|---|---|---|
| `_engine.js` | A B C D E | behoben: (1) `_disambiguateStackedTargets` fragte bei reinen Platz-Zielen (Zonenwahl für ein NEUES Equip, `cardName ''`) „welches Equip?" · (2) Ability-Ziel „Cloak of Edge" im Stapel löste dieselbe Rückfrage aus · (3) `getArtifactTargets`: Cloak (zählt als Ability) im Stapel — war sie die unterste Karte, fielen Club/Crown als Equip-Ziele weg (Weapon Storm …); jetzt ausgeschlossen · (4) `getCrossSidePlayableArtifacts`: Darions Stapel zählt als Platz · (5) `getActivatableEquipsCrossSide`: je Instanz (`instId`), zweite Kopie im Stapel war nie aktivierbar · (6) Ausrüstungs-Reaktion (Bow) und Zielschutz-Reaktion (Jetpack/Weathercock): gleichnamige Kopien — es galt immer die erste Instanz · (7) `istEquipArtifact` erkennt Moana-Instrumente („Artifact/Creature") · (8) Kreaturen-Ziele im Equip-Stapel (Moana): `kreaturImPlatz`, ein Ziel je Platz mit `_erlaubteInstanzen` nur für Kreaturen; Kreatur-Ziele fragen nur unter Kreaturen · (9) `entferneNameAmPlatz`/`_stapelNr`: bei gleichnamigen Equips verschwindet der Namens-Eintrag der abgehenden Instanz (nicht der erste) · (10) `applyRedirectWindows`: Umleitung auf einen Stapel fragt nach der Karte, falls der Umleiter nicht gefragt hat · (11) Gate-Schild-Text zählt alle Karten der Zone. Übrige Stellen (Heldentod-Aufräumen, `actionMoveCard`, `actionTransferAttachment`, `safePlaceInSupport`, `sendBoardCardToDiscard`, `deleteHero`, Smug-Coin-Schutz, `getFreeSideEquipArtifacts`, `hasLegalEquipHero`, `getActivatableEquips`) geprüft: ok | h-P6-01, 02, 03, 06, 07, 09, 10, 11 |
| `server.js` (nur gelesen) | A C E | offen (nicht geändert): `doActivateEquipEffect` `_crossInst` ignoriert `instId` → zweite Control-Device-Kopie im Stapel ließe sich trotz Engine-Eintrag nicht aktivieren. `doPlayArtifact` (Pflicht-Platz), Artefakt-Ziele (`doConfirmPotion`) ok | h-P6-03 (Engine-Teil) |
| `_equip-shared.js` | C D | behoben: `umhaengFreieZonen` ließ ein zweites Equip desselben Zuges nicht in den reservierten Stapelplatz (Fridge) / `fuehreUmhaengenAus` legte mehrere Equips auf verschiedene freie Zonen eines Darion (Fridge, Ceremony); jetzt ein Platz. Entfernen nutzt `entferneNameAmPlatz` | h-P6-05, 10 |
| `_equip-stack-shared.js` | alle | ok (Referenz; `hatStapelPlatz` wird jetzt auch von der Cross-Side-Prüfung benutzt) | h-P6-03 |
| `_orchestra-shared.js` | C | ok (`equipDestinations`/`equipArtifactToHero` lesen `equipPflichtPlatz`) | a-01, a-06 |
| `_lolek-shared.js` | C | ok (`chooseAndEquip`: eigene Zonenwahl; die Rückfrage-Falle ist jetzt im Engine-Teil behoben) | h-P6-01 |
| `_free-artifact-shared.js` | C | ok (`legeAn` über `equipDestinations`/`equipArtifactToHero`) | – |
| `_ability-cost-shared.js` | A B | ok nach Engine-Fix (3): `sendables` fand bei einer Cloak als unterster Karte keine Equips | h-P6-02 |
| `_targeting-shared.js` | A | ok (ein Ziel je Platz mit `_erlaubteInstanzen`) | g-02 |
| `_sparkfly-shared.js` | A | behoben: Entfernen aus dem Stapel über `entferneNameAmPlatz`; `collectNonHeroBoardTargets` liefert je Karte ein Ziel mit gleicher ID (die Engine fragt trotzdem korrekt, Treffer = gleiches Objekt) | h-P6-10, g-02 |
| `_mischief-militia-shared.js` | A | behoben: `enumerateFreezableNonFrozenTargets` bot JEDE Support-Karte (auch Ausrüstung, im Stapel mit derselben ID) als Freeze-Ziel an (Mischief Invasion); jetzt nur Kreaturen | h-P6-04 |
| `_slippery-shared.js` | – | irrelevant (nur Kreaturen-Bewegung) | – |
| `_alice-shared.js` | D | ok (`stackAt`/`canShareInto` nur Kreaturen; ein Equip-Stapel wird nie als Alice-Zone geteilt) | – |
| `_attachment-shared.js` | C | ok (Anhängsel brauchen eine echte freie Zone; Darions Stapel gilt nicht als frei — gewollt, Anhängsel sind keine Artifacts) | – |
| `_puppets-shared.js` | – | irrelevant (Luck/Preserve nur auf Kreaturen) | – |
| `_pollution-shared.js` | B | irrelevant („freie Zonen" wörtlich gezählt; Darion schafft eher mehr freie Zonen) | – |
| `_deepsea-shared.js` | A D | irrelevant (Bounce/Tausch nur Kreaturen; `zoneFreiNachKostenzahlung` schließt Stapel aus) | – |
| `_crusader-shared.js` | C | irrelevant (nur Cecilia kann Crusader's tragen, nie Darion) | – |
| `_idej-shared.js` | C | irrelevant (nur Idej-Helden) | – |
| `_race-boat-shared.js`, `_diver-helmet-shared.js`, `_cute-shared.js`, `_lunatic-shared.js`, `_fiona-shared.js`, `_kohta-shared.js`, `_riffel-shared.js`, `_molinda-shared.js`, `_monia-shared.js`, `_arthor-shared.js` | B E | ok (zählen/prüfen je Instanz, nicht je Zone; Aufstiegs-Helden sind nie Darion) | – |
| `_cosmic-shared.js` | A | offen/Hinweis: `allBoardTargets` (Analyzer: „another card on the board") liefert jede Stapelkarte mit gleicher ID; das Skript `analyzer-from-the-cosmic-depths.js` findet das Ziel per ID erneut (`allTargets.find`) und trifft nach der Rückfrage die FALSCHE (erste) Karte (im Simulator bestätigt: Crown gewählt, Change Counter landet auf Club) → dort `engine.stapelWahlFuer` lesen (Skript nicht in P6) | – |
| `_waflav-shared.js`, `_guardian-beasts-shared.js`, `_frost-shared.js`, `_bleed-shared.js`, `_dream-lander-shared.js` | A | ok (Kreaturen-Ziele; Ausrüstung wird ausgefiltert; Moana-Kreatur im Stapel über den Engine-Fix) | h-P6-09 |
| `_target-dim-shared.js` | A | ok (Anzeige, je Platz ein ausgegrauter Eintrag) | – |
| `_hooks.js`, `_loader.js`, `_TEMPLATE.js`, `_action-shared.js`, `_card-played-shared.js`, `_potion-draw-trigger-shared.js`, `_deck-top-shared.js`, `_gained-effects-shared.js`, `_future-tech-shared.js`, `_ability-verwahrung-shared.js` | – | irrelevant (Verträge/Verteiler/Abwurf-Signale ohne Zonen-Zählung; `heroCanBeEquipped` ohne Platzbezug) | – |
| `_cpu.js` | B C | behoben: `pickHeroForEquip` sah einen Darion mit Stapel und vollem Brett nicht als Träger (CPU legte nie ein weiteres Equip); `_test.pickHeroForEquip` exportiert. Übrige Slot-Zählungen sind Kreaturen-/Telemetrie-bezogen | h-P6-08 |
| `_deck-profile.js` | B | behoben: `boardPairBonus` las nur `slot[0]` — im Stapel zählt jede Karte (je Name einmal) | – |
| `_train-recorder.js` | B | behoben: Paar-Statistik (`boardPairs`) nahm nur `slot[0]`, wie oben | – |
| `_demo-recorder.js` | – | irrelevant (Aufzeichnung) | – |
| `biomancy-token.js`, `cannibalism.js`, `premonition.js`, `smugness.js`, `occultism.js` | A | irrelevant (Kreaturen-Ziele; Equips sind keine Ziele) | – |
| `diplomacy.js` | A | ok nach Engine-Fix (8): ein Moana-Instrument im Stapel fragt nur unter Kreaturen | h-P6-09 |
| `singing.js` | A | behoben: suchte die Kreatur am Platz über die erste Instanz → eine Moana-Kreatur weiter hinten im Stapel wurde übersehen (`kreaturImPlatz`) | – |
| `charme.js` | A | ok nach Engine-Fix (2): Support-Ability „Cloak of Edge" als Charme-Ziel löste die Equip-Rückfrage aus | h-P6-02 |

## Annahmen / Fragen an Al
* Cloak of Edge im Stapel: sie wird beim Anlegen in den Stapel gelegt (sie ist beim Ausrüsten ein Artifact), zählt dort aber weiter als Ability (kein Artifact-Ziel). Alternativ: Cloak teilt die Zone nicht mit.
* Zwei gleiche Equips mit „first time every turn"/„once per turn"-Effekt (Jetpack, Bow): jede Kopie hat ihr eigenes Fenster (HOPT je Instanz).
* Mischief-Invasion/Freeze: Ausrüstung ist kein Ziel (wie bei „any target on the board" nach Welle 10).
