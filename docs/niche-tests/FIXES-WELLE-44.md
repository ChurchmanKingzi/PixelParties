# Fix-Welle 44 – Taunt: Surprises nach cardType, Deepsea Horror Clown

Al hat die sechs Rückfragen aus [FIXES-WELLE-43.md](FIXES-WELLE-43.md) beantwortet (22.10.2026). Ein Agent (**W44a**) hat sie umgesetzt; Zweig `wave44/W44a` ist zusammengeführt. Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 44 / W44a"; Repros `docs/niche-tests/repro/W44/a-01 … a-03`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Surprises und Taunt | „Bluff müsste eine Attack sein, kein Spell. Aber ja, generell gilt: Eine Surprise, die Ziele wählt oder irgendwie affected, gilt als Attack, Spell oder Creature (eben je nach cardType)." | `engine.tauntGiltFuerQuelle` ordnet eine Quelle der Zone `surprise` jetzt nach ihrem `cardType` in `data/cards.json` ein: Attack → Attack, Spell → Spell, Creature → Creature effect; alle drei binden den Taunt (Bluff ist in den Kartendaten schon „Attack"). Damit müssen Gold Trap und Jumpscare den Hardy Slime wählen, wenn er ein mögliches Ziel ist; ebenso Booby Trap, Firewall, Toxic Trap, Mountain Tear River, Aquatic Spear/Arrows u. a. (vollständige Tabelle in `CARD_API.md`). Ein anderer Typ (Shield of Wisdom, Artifact) bleibt außerhalb. Die Quellenverdrahtung (`_surpriseLauf`, `_tauntQuelleFuer`) war schon richtig. Repro `a-02` (Exit 1 auf der Basis) |
| Artefakte mit Subtyp Creature (Debt-O-Tron, Scrap Plow, Powder Keg, Pollution Spewer) | „Ja, die gelten, solange sie auf dem Board sind, als Creatures mit Creature-Effekten." | Ist-Zustand bestätigt, abgesichert (`a-03`) |
| Singing, Lovely Teddy, Spirit of the Forbidden Grimoire | „Ja, da gelten jeweils die Creatures, die ihre Effekte ‚aktiviert bekommen' als die Verursacher; … per Booby Trap eine eigene, per Lovely Teddy besessene Creature treffen." | Ist-Zustand bestätigt, kein Fix nötig, `a-01` (beide Sitze): Der Teddy-Nutzer borgt die gegnerische Skeleton Archer und lässt sie auf den Booby-Trap-Helden schießen – Booby Trap trifft die Archer (100 Schaden, besiegt, Ablage ihres Besitzers), der Effekt wird negiert, der Held bleibt unversehrt; dasselbe mit Singing und dem Geist |
| Deepsea Horror Clown | „Ja, und füge beiden auch ‚Creature effects' hinzu, genau wie beim Slime." | Kartentext `data/cards.json`: „…must choose it as the target of all Attacks, Spells and Creature effects they use during their next turn, if possible." (Balancing/Patchnote); `deepsea-horror-clown.js` deklariert `tauntNurAttackSpellKreatur`. Doomed Town Guard unverändert (kein „Attacks and Spells"-Wortlaut) |
| Bomb Arrow, Racket Arrow | „Nein, die gehören NICHT zum Attack, das sind eigene separate Artifact-Effekte und umgehen damit den Taunt." | Ist-Zustand bestätigt, mit Gegenprobe abgesichert (`a-03`) |
| Spell/Area, Spell/Attachment auf dem Brett | „Korrekt, ja." | Ist-Zustand bestätigt (`a-03` Teil 6) |

Umgestellter alter Repro: `W43/a-01` (nur die Zellen Gold Trap, Jumpscare, Bluff als Quelle und der Clown-mit-Trank-Fall; alle anderen Zellen unverändert).

## Ergebnis in Zahlen

* Repros: **alle 1211 Repros grün** (vorher 1208; 3 neue), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* Skilltest-E2E: wie im Ausgangsstand; mit `NODE_PATH` grün: cards, draw-cards, sacrifice.
* Dauerfeuer: 13 Karten × 2 Seiten (Taunt-Variante bei Hardy Slime und Clown), 0 Unterschiede.
* `Bugfix-Note` im Commit: Gold Trap und Jumpscare müssen jetzt den Hardy Slime wählen, wenn er ein mögliches Ziel ist.

## Offene Rückfragen an Al (Ja/Nein)

1. **Shield of Wisdom** hat den cardType Artifact (Subtyp Surprise), daher bindet seine Umleitungs-Zielwahl den Taunt nicht. Passt das, oder soll auch sie binden?
2. **Challenge, Martyry, Anti-Magnet, Alleria und Empty Armor** leiten die Zielwahl einer Surprise (Gold Trap, Jumpscare, Mountain Tear River …) heute nicht um, weil `sourceEffectKind` für eine auflösende Surprise `'surprise'` liefert. Sollen sie nach demselben Grundsatz „Surprise zählt nach cardType" auch Surprise-Zielwahlen umleiten?
3. **Doomed Town Guard:** Meintest du mit „beiden" Hardy Slime und Deepsea Horror Clown (so umgesetzt), oder auch ihn? Sein Text „Your opponent can't choose other Creatures you control" hat keinen „Attacks and Spells"-Wortlaut.
