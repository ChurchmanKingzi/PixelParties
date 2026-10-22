# Fix-Welle 57 – ATK-Buchführung beim Tod und bei der Wiederbelebung

Randfund aus [Welle 56](FIXES-WELLE-55.md) (Nachtrag W56a): Ein verfluchter Held mit ATK-Ausrüstung behielt beim Tod einen ATK-Überhang. Behoben vom Agenten **W57a** (Zweig `wave57/W57a`, zusammengeführt); Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 57 / W57a"; Repro `docs/niche-tests/repro/W57/a-01`. Grundsatz von Al seit Welle 53: ATK-Boni liegen pro Equip-Instanz genau einmal und nur beim aktuellen Träger; der Zustand nach jeder Sequenz entspricht dem eines direkt so aufgebauten Helden.

## Befund und Umsetzung

| Befund | Behebung |
|---|---|
| `handleHeroDeathCleanup` leerte `statuses` zuerst; der Abzug der danach abgelegten ATK-Ausrüstung traf die sichtbare ATK (0, geklemmt) statt des Fluch-Zwischenspeichers; der Abgang der Curse-Karte gab dann den alten Gesamtwert samt Club zurück (ATK 70 statt 40, auch nach der Wiederbelebung). Abhängig von der Instanz-Reihenfolge. Betroffen: alle 21 ATK-Equips, Taio/Toras, Zuwachs-Helden mit Club (Cloak, Nero, Rakah, Mirjam, Chaorc, Wavilion), Gegnerseite, Extra-Life-Weg | Neuer Baustein `_fluchAtkAufloesen(hero, ownerIdx, heroIdx)` (löst den Status `cursed` auf, gibt den Zwischenspeicher über den Trichter `_applyHeroAtkDelta` zurück, kein `onStatusRemoved`); `handleHeroDeathCleanup` ruft ihn als Allererstes auf, `actionReviveHero` als Sicherheitsnetz. Reihenfolge der Todes-Hooks, `onHeroKO`, Surprise-Fenster und der Chuck/Bloom-Aufstieg innerhalb `onHeroKO` bleiben unverändert |
| Fluch ohne Karte (nur Status): niemand gab den Zwischenspeicher zurück (Besiegter und Wiederbelebter bei ATK 0) | Ebenfalls über `_fluchAtkAufloesen` |
| `_syncHeroAtkAura` übersprang Helden mit `hp <= 0`: mit Rioting Village blieb nach dem Ablegen der Ausrüstung die verdoppelte Hälfte als Überhang stehen (auch beim Wiederbelebten, ohne Fluch); Aura-Wechsel im Tod wurde nie nachgezogen | Ausnahme `hp <= 0` entfällt (nur namenlose Plätze bleiben ausgenommen) |

Übrige Buchungswege waren korrekt (Fighting, `permAtkDelta`, befristete Gaben, Cykyran, Cloak, zweiter Tod, Laser Cannon, Core/Gun, Heilen des Fluchs). Alte Notiz W56/a-01 (D) ist jetzt eine echte Prüfung.

## Ergebnis in Zahlen

* Repros: **alle 1263 grün** (vorher 1262; 1 neues mit 200 Prüfungen, auf dem alten Stand 94 rot), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand); `check-atk-funnel.js` grün.
* E2E (mit `NODE_PATH`): cards, draw-cards, sacrifice, artifacts grün.
* `Bugfix-Note`: `_engine`.

## Offene Rückfragen an Al

1. **Core/Gun bei Heldentod:** Ancient Tech Infinite Energy Core und Future Tech Gun an anderen Helden rechnen bei einem Heldentod erst am Ende der Aktion (`onAnyActionResolved`) oder zu Zugbeginn nach, weil das Todes-Aufräumen die Ausrüstung direkt in die Ablage legt, ohne Hook. Mitten im Todesablauf (z. B. ein weiterer Treffer derselben Kette) lesen sie noch die alte Ablage. Soll das Aufräumen die Ablage-Wächter (`onDiscard`) sofort benachrichtigen? (Würde die Hook-Reihenfolge ändern.)
2. **Besiegter Held folgt der Aura** (Rioting Village), damit die Wiederbelebung nie einen Überhang trägt. So lassen?
