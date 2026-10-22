# Fix-Welle 51 – Generischer Equip-Gained-Hook, Ricochet-Senkungen

Al hat die Rückfragen aus [FIXES-WELLE-50.md](FIXES-WELLE-50.md) beantwortet (22.10.2026). Ein Agent (**W51a**, Zweig `wave51/W51a`, zusammengeführt) hat sie umgesetzt. Details und Tabellen: `cards/effects/CARD_API.md`, Abschnitt „Welle 51 / W51a"; Repros `docs/niche-tests/repro/W51/a-01`, `a-02`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| **Umhängen öffnet das Pests-Fenster** (auch für Anhängsel) | „Ein Umhängen soll auch das ‚on Equip/Attachment gained'-Fenster für Pests öffnen – generisch, künftige Karten sollen sich einfach anhängen können." | Neuer generischer Hook `HOOKS.ON_EQUIP_GAINED = 'onEquipGained'`, gefeuert nur von `engine.fireEquipGained(inst, {anleger, isMove, fromOwner, fromHeroIdx, source})` (zuerst Hook, dann Surprise-Fenster `surpriseEquipTrigger`). Alle Wege laufen darüber: Anlegen, Fridge, Ceremony (Equip-Teil und Anhängsel), Cybug LOCUST, Secret Spell Book (`actionTransferAttachment`, Option `anleger`). Nutzlast und Anhängen (Surprise: `surpriseEquipTrigger`; Passive/offene Lauscher: `hooks.onEquipGained`; Hand-Reaktionen: `activeIn:['hand']`) in CARD_API. Anti Magic Enchantment lauscht jetzt auf den Hook |
| **Wer legt an?** | Der Gegner des Fridge-Users kann Pests aktivieren, egal wessen Heroes ausgerüstet werden | Ausführender von Fridge/Ceremony = Ausrüstender (so schon seit W50a), jetzt auch für Anhängsel |
| **Ceremony-Equips lösen andere Beobachter aus** | „Ja, das passt" | Bleibt; Anti Magic Enchantment wird bei umgehängten Equips jetzt tatsächlich angeboten (vorher nicht) |
| **Ricochet: Senkung vs. Schild** | Als Schild gilt nur Zusatz-HP/Puffer (Nao, the Barrier Princess u. ä.); alles, was den eingehenden Schaden selbst verringert, ist eine Senkung und schwächt auch die Folgetreffer. Harpyformer Choir, Dichotomy, Aquatic Shield, Cloud in a Bottle, Johanna = Senkung | Harpyformer Choir und der Aquatic-Shield-Rider (Held und Kreatur) von Schild auf Senkung umgestellt; Cloud in a Bottle (Held und nicht tödliche Kreatur) geht jetzt in den Kettenbetrag ein; Dichotomy/Johanna waren schon Senkungen (jetzt belegt). Schild bleiben nur Deckel/Böden/Zusatz-HP (Immortal, `capAtHPMinus1`, Smug Coin, Half Moon, Prophecy, Minocrete, Paraseed Zombie, Nao-artig). Zuordnungstabelle mit Begründung in CARD_API |

Hinweis: Anhängsel beim Umhängen lösen den Hook und das Pests-Fenster aus, aber NICHT die `onCardEnterZone`-Zähler (Luck, Fiona-Aszension …), weil Umhängen kein Spielen ist.

Umgestellte alte Repros: `W49/a-03`, `W50/a-02`, `W50/a-01`, Kommentar in `W49/a-02` (Dateinamen unverändert, damit `repro-status.json` konsistent bleibt).

## Ergebnis in Zahlen

* Repros: **alle 1243 grün** (vorher 1241; 2 neue, beide auf dem alten Stand rot), 0 Rückschritte.
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* E2E (mit `NODE_PATH`): cards, draw-cards, sacrifice, artifacts grün.
* `Bugfix-Note`-Zeilen: Inheritance Ceremony, Slippery Fridge, Anti Magic Enchantment, Cybug LOCUST, Secret Spell Book, Ricochet, Harpyformer Choir, Cloud in a Bottle.

## Offene Befunde / Rückfragen

1. **Taio / Toras** führen ihre Boni nicht mit, wenn ein Equip per Fridge/Ceremony umgehängt wird (Bonus bleibt stehen, am Ziel fehlt er; Ursache `_onlyCard` bei Leave/Enter). Wird in Welle 51b als Fehler behoben.
2. **Cybug LOCUST / Secret Spell Book** öffnen beim Umhängen jetzt ebenfalls das Equip-Fenster (Ausrüstender = Ausführender); die Pests des ursprünglich Ausrüstenden kann also auf eine LOCUST-Umleitung reagieren. Gewollt?
3. **Cloud in a Bottle** halbiert weiter per Wiederherstellung nach dem Treffer (nur der Kettenbetrag wird halbiert). Reicht das, oder soll die Halbierung vor Schaden und Schilden liegen (würde Reihenfolge-Effekte z. B. mit Immortal ändern)?
