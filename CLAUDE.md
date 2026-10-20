# Hinweise für Agenten in diesem Repository

## Bugfixes: Fehlerbeschreibung für den Discord-Kanal (MoniaBot)

Der Bot postet nach jedem Deploy automatisch die Karten, deren Effekt-Skript (`cards/effects/*.js`) korrigiert wurde, in den Bugfix-Kanal.
**Wer einen Bug behebt, beschreibt ihn dafür in der Commit-Nachricht** – pro betroffener Karte (oder gemeinsamem Baustein `_…`) eine Zeile:

```
Bugfix-Note: <Kartenname oder _baustein> | <was genau schiefgelaufen ist, auf Englisch, ein bis zwei Sätze>
```

Beispiele:

```
Bugfix-Note: Fireball | Damage was dealt twice when the target had a shield.
Bugfix-Note: _alice-shared | Summons no longer stay on the board after their owner leaves.
```

* Schreibe es so, dass Spielerinnen und Spieler es verstehen (Auswirkung im Spiel, keine Code-Details); höchstens ca. 220 Zeichen.
* Bei einem Pull-Request mit mehreren Commits oder Squash-Merge müssen die Zeilen in der Nachricht stehen, die auf `main` landet.
* **Balancing ist kein Bugfix:** Ändert sich der Eintrag einer Karte in `data/cards.json` (Effekttext, HP, Kosten …), zählt das als Balancing-Änderung
  und erscheint nur in den Patchnotes – auch wenn dabei das Skript angepasst wurde. Wurde dabei zusätzlich ein echter Fehler behoben
  (z. B. Skript passte nicht zum Kartentext), schreibe eine `Bugfix-Note` für diese Karte; dann erscheint sie auch im Bugfix-Kanal.
* Ohne `Bugfix-Note` erscheint die Karte trotzdem (erkannt am geänderten Skript), nur ohne Erklärung.
