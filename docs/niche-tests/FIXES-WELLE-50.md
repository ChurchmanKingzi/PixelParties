# Fix-Welle 50 – Ricochet, Fridge/Ceremony, Tempeluna, Surprise Party

Al hat die Rückfragen aus [FIXES-WELLE-49.md](FIXES-WELLE-49.md) beantwortet (22.10.2026). Ein Agent (**W50a**, Zweig `wave50/W50a`, zusammengeführt) hat sie umgesetzt. Details und Tabellen: `cards/effects/CARD_API.md`, Abschnitt „Welle 50 / W50a"; Repros `docs/niche-tests/repro/W50/a-01 … a-04`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| **Ricochet** | Folgetreffer = aufgerundete Hälfte des ECHTEN angerichteten Schadens: Senkungen geben sich weiter, Schilde nicht; Pfeil-Boni nur im ersten Hit. Wird der Schaden irgendwo auf 0 reduziert, sind alle Folgetreffer 0, treffen aber weiter (On-Hit-Effekte wie Flame Arrow). On-Hit-Effekte auf „the target" treffen ALLE Ziele der Kette | Die Engine führt neben dem echten Betrag einen Kettenbetrag mit (`_kettenProjektion`/`_kettenSenkung`): Senkungen (Cloudy, Hook-Abzüge, Johanna, Spectral Armor, Interference …) laufen in beide, Schilde nur in den echten Betrag; Negation/Immunität setzt den Kettenbetrag auf 0. Flame Arrow auf allen Zielen war schon so (Repro belegt). Zuordnungstabelle in CARD_API. `a-01` |
| **Slippery Fridge / Inheritance Ceremony** | Der Equip-Artifact-Teil funktioniert bei Ceremony wie bei Fridge; Fridge geht zwischen zwei Helden eines beliebigen Spielers (auch gegnerisch), Ceremony nur zwischen eigenen | Gemeinsamer Baustein in `_equip-shared.js` (Equip-Erkennung inkl. Initiation-Helden/Tempeluna-Feen, „1 je Held"-Regel, gesperrte Zonen nicht frei, gleichzeitiger Wechsel mit `_isMove`, Equip-Fenster/Pests mit dem Ausführenden als Ausrüstendem). Fridge: Pests-Fenster öffnete für den falschen Spieler, Zonenprüfung hatte eine Lücke – behoben. Anhängsel-Teil und HP-Transfer von Ceremony unverändert. `a-02` |
| **Tempeluna / Initiation Ritual** | Initiation Ritual ja (Held als Equip-Artifact), Tempeluna nein | Pests-Fenster bei Tempeluna entfernt, Initiation Ritual unverändert. `a-03` |
| **Surprise Party** | Plant Golem/Hind werden übersprungen, es wird weiter gegraben (oder bei 5 abgebrochen); übersprungene Karten werden zurück ins Deck gemischt | Der Code tat das schon (die Formulierung „in die Zonen des Nutzers gelegt" in FIXES-49 war falsch). Übersprungene Karten zählen für die 5er-Grenze, werden zurückgemischt, der Zug endet immer. `a-04` |
| **Thalia „Zweitwürfe"** | Rückfrage von Al zur Wortwahl | Gemeint: jede Aktivierung eines Support Spells zählt als Kopie (auch zweiter Cast, Support-Reaktionen aus der Hand); Ist-Zustand |

Umgestellte alte Repros: `W49/a-02` (Cloudy auf Position 2 gibt sich weiter), `W49/a-03` („Ceremony ist kein Anlegen" gilt nur noch für Anhängsel), Kommentar in `W49/b-01`.

## Ergebnis in Zahlen

* Repros: siehe `repro-status.json` / `INDEX.md` (4 neue Repros in W50).
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* `Bugfix-Note`-Zeilen: Ricochet, Inheritance Ceremony, Slippery Fridge, Tempeluna, Petrification Break, Spectral Armor, Johanna.

## Offene Rückfragen an Al

1. **Ceremony-Anhängsel** (Energy Aura, Curse …): Sollen sie beim Umhängen weiter KEIN Pests-Fenster öffnen, obwohl das Anlegen per Hand es tut? (Aktuell: still.)
2. **Wer legt an?** Beim Umhängen ist der Ausführende von Fridge/Ceremony der „Ausrüstende": Bei einer Fridge auf gegnerische Equips öffnet also die Pests des Gegners, nicht die eigene. Passt das?
3. **Ceremony-Equips** lösen jetzt auch andere Beobachter aus (Reaktionskarten, Anti Magic Enchantment, Platzierungs-Surprises); die alte Vorgabe vom 12.10. gilt nur noch für Anhängsel. Passt das?
4. **Ricochet, Schild vs. Senkung:** Ein Einmal-Schild oder Deckel, der den GANZEN Treffer schluckt, gibt trotzdem die Hälfte des Betrags VOR dem Schild weiter; nur echte Negation/Immunität macht alles danach 0. Aquatic Shield (Rider) und Harpyformer Choir („next damage reduced by X") zählen als Schild, nicht als Senkung. So gewollt?
5. **Ricochet, Johanna / Cloud in a Bottle:** Johannas Umleitung der Hälfte zählt als Senkung; Cloud in a Bottle am Helden halbiert erst nach dem Treffer und senkt den Kettenbetrag nicht. Richtig?
