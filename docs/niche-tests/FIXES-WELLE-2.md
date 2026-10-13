# Fix-Welle 2 – die großen Ursachenklassen

Auftrag von Al: „mach jetzt mit den großen Ursachenklassen weiter". Sieben Agenten (Z1–Z7) haben je eine Klasse im Engine-Kern bearbeitet, jeweils in eigener Arbeitskopie; die Zweige sind zusammengeführt (vier kleine Konflikte bei Albrecht, Candlestick Squire, Pteranos, Raptoren – Z6 und Z7 hatten dieselbe Ziehsperre-Prüfung doppelt gebaut; Z6-Fassung übernommen, Z7-Hooks bleiben).

## Ergebnis in Zahlen

| | vor Welle 2 | nach Welle 2 |
|---|---|---|
| Repros, Fehler tritt NICHT mehr auf (Exit 0) | 113 | **265** |
| Repros, Fehler tritt noch auf (Exit 1) | 578 | 426 |
| Rückschritte (zuvor grün, jetzt rot) | – | **0** |
| Abstürze / Zeitüberschreitungen | – | 0 |

Regressionsschutz auf dem **zusammengeführten** Stand: alle 44 `scripts/check-*.js` wie vorher (nur `check-scope.js` war schon vorher rot); alle 30 Skilltest-E2E-Tests wie im Ausgangsstand (rot in beiden: battle, lobby, prep, seats, target); Dauerfeuer über **alle** Karten (4 Teile, ~2 440 Läufe): 20 auffällige Läufe vorher, 17 nachher, **keine neu auffällige**; Kaltstart-Batterie (10 Varianten × alle Karten, ~25 000 Läufe): keine neuen Fehler, Abbrüche oder Kartenverluste durch die Fixes – die Abweichungen zur ursprünglichen Phase-A-Datei (52 Einträge bei Tränken/Artefakten und Teleportation Powder) kommen vom inzwischen angepassten Harness; der Stand *vor allen Fixes* (ae85c9d) liefert bei den geprüften Beispielen dasselbe wie der heutige.

## Die sieben Klassen

| Klasse | Zweig / Commit | Repros behoben | Lösung (Kern) |
|---|---|---|---|
| **Z1** Besitzer / Brettseite / Kontrolleur | `wave2/Z1` `1466319` | 39 | Einheitliches Modell: *Brettseite* (`physicalSide`: in wessen `supportZones`) für Ziel-IDs, Zonen, Animationen; *Kontrolleur* (`controller ?? owner`) für „you control"/Prompts/„my-enemy"; *Besitzer* (`originalOwner`) für Ablage/Deck/Rückkehr. Neue Helfer `kontrolleurVon`, `kartenBesitzerVon`, `kreaturAnBrett`, `kreaturPasstZurSeite`, `kreaturZiel`; `getCreatureTargets`, `promptDamageTarget`/`-MultiTarget`, `collectAoeCreatureTargets` zählen nach Kontrolle; Held-Passive über `heroesControlledBy`. |
| **Z2** Negation / Immunität / Zugende | `wave2/Z2` `d81fe72` | 11 | Effekt-Immunität endet mit der laufenden Auflösung (`endeEffektImmunitaeten`); Anhängsel-Negierung wird nicht am Zugende geräumt (Ruling v1114); geteilte Zähler nur vom letzten Halter geräumt (kurze Negation löscht keine lange mehr); Zhu-Skip lässt Fristen verfallen; Weakening Crystal legt sofort wieder an; Sparky Slime/Null Zone über Fristen. |
| **Z3** Zielwahl-Schutz & Fenster | `wave2/Z3` `3699256` | 4 | `promptEffectTarget`/`normalizeValidTargets` wenden `untargetable_by_opponent`, `guardsCreatureChoice`, `untargetable_all` an; Ersatzquelle `_umgebungsQuelle` öffnet Post-Target-Fenster auch ohne `sourceCard` (Gegner-Lock entscheidet allein die reagierende Karte, nach Als Vorgabe); `promptMultiTarget` ruft Umleitungsfenster (je Ziel einzeln, Ruling 31.8.); Surprise-Fenster behandelt `'equip'`-Kreaturen als Kreatur. Genau ein gewähltes Ziel aus Mehrfachziel-Zauber zählt als Einzelziel (Al: ja). |
| **Z4** aufgelöste Karte in der Hand | `wave2/Z4` `847407c` | 9 | `handIndicesWithoutResolving(ps)`; `actionStealFromHand`, `actionPromptForceDiscard`, `shuffleBackEligibleHandSlots` lassen die auflösende Karte aus; neuer Hook `ON_HAND_GREW`; Client (`public/`) unverändert. |
| **Z5** `currentHp`-Rückfall & Token-Konvention | `wave2/Z5` `0909ceb` | 12 | `engine.creatureCurrentHp(inst)` (currentHp → maxHp → gedruckte HP); `engine.isTokenCard(inst)` + drei Netze (Tokens nie in Hand/Deck/Ablage → Gelöscht-Stapel); in `CARD_API.md` dokumentiert. |
| **Z6** Sperren auf Nebenwegen | `wave2/Z6` `837e80b` | 60 | Zentrale Prüfer `drawBlockedFor`, `isDiscardOutHardLocked`, `getSummonBlockedFor`, `_gainState`, erweiterte `_handPlayLockedFor`/`_cardBlockedBySearchLock`; Beschwörungssperre im Effekt-Trichter; direkte Deck-Splices über `takeFromPile`/`deckEntnahme`; `doActivateFreeAbility`/`doUsePotion`/`summon_ushabti` prüfen Sperren hart. |
| **Z7** Einmal-Stempel | `wave2/Z7` `ee9d1ed` | 21 | Negierte/fizzelnde Karte aus der Hand gilt als gespielt (`_noteNegatedPlay`, Ruling v1031); Hook `onNegatedPlay` in 44 Skripten; `oncePerGame` stempelt automatisch; Abbruch durch den Spieler stempelt nie; Server-Tore für Artefakte/Tränke; `_castSpellImmediately` prüft `oncePerGame` immer. |

(Die Einzelbefunde je Klasse stehen in den Commit-Nachrichten der Zweige und im Index: Spalte „Repro" zeigt `✔ behoben` / `✗ offen`.)

## Noch offen aus den Klassen (bewusst, meist Regelfrage)

* **Z1:** A01-30 (Einmal-Stempel am Platz, Teil von Z7), A01-33 (b), A09-03, C01-10 (Angler Angel verstärkt nur das erste Ziel eines Flächenschlags), C03-20 (Lesart offen).
* **Z2:** C03-18 / A03-28 / H04-14 (Status läuft vor den Zugende-Hooks ab), C05-10 (Stowaway negiert nur den Heldeneffekt, nicht die Abilities – harte Form bräuchte Client-Änderung).
* **Z4:** S02-20 (Draw zählt sich selbst als abgeworfen – Skriptkopf nennt das „safe"), R02-15 Teil b (Wisdom-Abwurf).
* **Z6:** H01-11, A07-23 (Ska-Teil), A08-24 (b) – Such-Sperre bei Deck-Suchen, die nicht auf die Hand führen (Ruling „die vier Gruppen"); A09-11, A07-21, A03-24, H01-18, H02-22, M01-23, R02-11, S03-24 (Voice in your Head), A06-21/-24, A07-23 (Shanty) und weitere Regelfragen.
* **Z7:** A04-27 (Cute Dog), A01-28 (Reincarnation), H04-05 (Saya), A01-16 (Magic Mirror), A01-17 (Token-Kosten bei Negation; 6 Karten), Name-weite Stempel (F02-06, A03-18, C04-02, C03-15, C01-02).

## Fragen an Al (ja/nein) – neu aus Welle 2

Beantwortet (und eingearbeitet): Z3-1 „Gegner-Lock nur wenn der Kartentext 'opponent's' sagt"; Z3-2 „genau ein gewähltes Ziel aus Mehrfachziel-Wahl zählt als Einzelziel".

**Z1**
1. C03-20 Moonlight Butterfly: gestohlener Falter auf die Hand des Kontrolleurs, 150 Schaden auf den Helden gegenüber dem Kontrolleur?
2. A09-15 Elven Rider / Cycling Demons: stirbt eine gestohlene Karte auf der Besitzerseite, entfällt der Nachfolger (so umgesetzt) – oder seitenfremd in die alte Zone des Besitzers?
3. A02-37 DDG-Tribut: nur geliehene Kreaturen (`stolenBy`) ausschließen? (Per Plant Golem/Cross-Side auf der Gegenseite liegende eigene Kreaturen zählen aktuell als Tribut.)

**Z2**
4. C03-18/A03-28/H04-14: soll ein den ganzen Zug gefrorener/betäubter/negierter Held/Kreatur seinen „Am Ende deines Zuges"-Effekt noch auslösen? (Ist-Zustand ja; „nein" hieße größerer Umbau in `switchTurn`.)
5. C05-10: Stowaway soll „Hero's effect **and Abilities** are negated" – harte Form (Ability-Zonen aus, Lv>0 unspielbar, heilbar)? Braucht Client-Änderungen.

**Z4**
6. R02-15 Teil b: soll der durch Shamanic Curse erhöhte Level bei Wisdom-Helden den Zusatz-Abwurf tatsächlich kosten?
7. S02-20: soll die gerade gespielte Draw als abgeworfene Handkarte gelten (Cute-Bunny-Schwelle, Archibald)? (Ist-Zustand ja.)

**Z5**
8. Dürfen Tokens, die per Effekt „auf die Hand/ins Deck" sollen (Gold Trap, Chasing the Legend, Shapeshift, Dive Bomblebee, Missing People, Tengu Windstorm), angeboten und dann still gelöscht werden, statt nicht wählbar zu sein?
9. Soll ein Biomancy-/Boulder-Token, der „zurück auf die Hand" geht, gelöscht werden (so umgesetzt), oder die Potion auf die Hand kommen?

**Z6**
10. A09-11: Goldsperre (Golden Arrow) auch für Gold-Kosten von Karten und Reaktionsartefakten?
11. Reine Zieh-Aktivierungen bei `drawLocked` unaktivierbar (Triceras, Pteranos, Raptoren, Tu, Techno, Drone, Money Printer, Elana, Champion, Kazena, Alchemy, Leadership, Inventing, Prayer)?
12. S03-24 Voice in your Head: Zusatzaktion als Nutzen, oder unspielbar unter Hand-/Zieh-Sperre wie Supply Chain?
13. A06-21 Pawn Sacrifice / A06-24 Thebinxan unter Hand-Sperre aktivierbar?
14. Such-Sperre bei Alex, Ska, Greenhouse (Deck-Suche ohne Hand-Ziel) bewusst nicht? (so gelesen)
15. A07-23 Shanty ohne zweite Handkarte nicht aktivierbar?

**Z7**
16. Soll ein von Silence & Co. negierter „You can only play 1 … per turn/game"-Zauber/-Artefakt den Slot verbrauchen? (einheitlich „ja" umgesetzt)
17. A04-27 Cute Dog: schon ein abgelehntes Angebot verbraucht den Einmal-pro-Zug-Platz?
18. A01-28 Reincarnation „einmal pro Spiel": je Spieler statt je Held?
19. H04-05 Sayas Zweitguss: „once per game"-Klauseln beachten? (Ruling v1277 spricht dagegen)
20. A01-17 Token-Kosten bei Negation (Medusa's Curse, Null Zone, Goldify, Reincarnation, Mass Multiplication, Golden Wings): bezahlt bleiben wie bei Cold Coffin/Eraser Beam?

## Hinweise

* `cards/effects/CARD_API.md` wurde in Welle 2 um Abschnitte zu Immunitäts-Lebensdauer, geteilten Zählern, Zhu-Skip, Anhängsel-Negierung, Hand ohne auflösende Karte, `currentHp`/Token-Konvention, Sperren-Prüfern und den Einmal-Stempeln („★ Z7": neue „only play 1 per turn"-Karten müssen `onNegatedPlay` ergänzen) erweitert.
* Einzelne Repros waren selbst falsch gebaut und wurden angepasst: A01-34, S03-04 (b), A06-07, M01/05, F03-19, M01-13, A02-22.
* Nicht geändert: der Client (`public/`) – alle Änderungen sind serverseitig.
