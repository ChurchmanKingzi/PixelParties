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

## Nachträge W51b / W51c (22.10.2026)

Al hat die Rückfragen zu W51a beantwortet: Cybug LOCUST & Co. müssen genau prüfen, WER anlegt und WESSEN Held betroffen ist (Kartentext); Cloud in a Bottle soll den Schaden direkt halbieren („falls du keinen guten Grund findest"); Cloud Pillow prüfen. Zwei Agenten haben das umgesetzt (Zweige `wave51/W51b`, `wave51/W51c`, zusammengeführt; Details in CARD_API „Welle 51 / W51b" und „W51c").

| Thema | Ergebnis |
|---|---|
| **Taio / Toras & Co. beim Umhängen (W51b, Fehler aus W49/W50)** | Fridge, Ceremony und `actionTransferAttachment` meldeten Leave/Enter nur an die bewegte Karte (Ruling „Umhängen ist kein Spielen"); Heldenpassive, die einen Zustand ans Ausgerüstet-Sein hängen, sahen deshalb weder Abgang noch Ankunft (Bonus blieb am Quellhelden stehen, am Ziel fehlte er). Lösung: neuer Hook `onEquipLost` (`engine.fireEquipLost`) plus `onEquipGained` mit `isMove`; Vertragsstück `equipZustandHooks(hooks)` in `_hooks.js` verdrahtet beides mit denselben Handlern wie Enter/Leave. Umgestellt: Taio, Toras, Future Tech Gunslinger Riffel, Kohta, Lolek, Fiona (Aufstiegs-Bereitschaft), Tempeluna. Zusatzfund Taio: In der Spiegelpartie buchte beim normalen Zerstören eines Equips der gleichnamige Taio des Gegners seinen Bonus ab (behoben). Differenz-Sweep (269 Skripte, 94 Equips, ~100 000 Paarungen) zeigt keine weiteren echten Unterschiede. Zähler (Luck u. a.) bleiben beim Umhängen stumm |
| **Wer legt an, wessen Held (W51c)** | Audit-Tabelle Karte | Textbedingung | Skriptbedingung in CARD_API. LOCUST, Pests, Anti Magic Enchantment setzten den Text schon korrekt um (auch Charme/Übernahme, Fridge, Ceremony, Control Device, Curse). Der eigentliche Fehler: `_orchestra-shared.equipArtifactToHero` (The Weather Orchestra, Deepsea Treasure, Lolek, Free-Artifact-Karten) meldete bei einem fremden Helden dessen Gastgeber als Anlegenden → Pests/LOCUST des Orchester-Spielers feuerten auf die eigene Aktion, die des Gegners nicht; Cybug RHINOCEROS und Lunatic Hawk sahen den falschen Platzierer. Behoben (`_equipAnleger: pi`) |
| **Cloud in a Bottle (W51c)** | Es gab keinen zwingenden Grund für die Wiederherstellung nach dem Treffer (die Karte wurde ursprünglich wie ein Nach-Schaden-Wächter gebaut; W13 Q134 / W14 Q10 übernahmen die Bauform). Jetzt wird „Cloudy" (Faktor 0,5, derselbe wie Cloud Pillow) VOR der Schadensberechnung aufgelegt; die Pipeline halbiert aufgerundet im Multiplikatoren-Durchgang, danach greifen Einmal-Schilde, Flat-Boni, Deckel, HP-Böden. Neues frühes Vor-Schaden-Hand-Fenster (`preDamageEarly`). Marken, Wiederherstellung, Nach-Schaden- und Pre-Defeat-Fenster der Karte entfernt; Rulings (tödlicher/Overkill-Schaden halbiert, Kreaturen, kein Cloudy für Gefallene) bleiben. Beispiele Vorher→Nachher: Immortal 100 HP/500 Schaden 50 → 1 HP; Einmal-Schild −100 bei 300 Schaden 700 → 750 HP; unaufhaltbarer Schaden (Tempeste, Ida) wird nicht mehr angeboten |
| **Cloud Pillow** | Kein Sonderweg: legt nur den Cloudy-Buff auf, die Pipeline halbiert direkt (belegt in `W51/c-02`). Auch sonst kein Karte mit „Schaden anwenden, dann HP zurückgeben" als Senkung (Fireshield, Spiky Armor, Punch in the Box, Corpse Explosion, Decapitating Strike geben Schaden zurück, senken ihn nicht) |

Repros: `W51/b-01` (Taio/Toras), `b-02` (Aufstiegs-Bereitschaft), `b-03` (Hook-Vertrag), `c-01` (Equip-Fenster, wer legt an), `c-02` (Cloud echtes Halbieren); `W51/a-01` angepasst (Cloud am Angreifer an Position 2: echter Treffer 25 statt 50). Hilfsbibliothek `docs/niche-tests/lib/umhaengen.js`.

## Ergebnis in Zahlen

* Repros: **alle 1248 grün** (vorher 1241; 7 neue, auf dem alten Stand rot), 0 Rückschritte (nach W51a: 1243).
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand).
* E2E (mit `NODE_PATH`): cards, draw-cards, sacrifice, artifacts grün.
* `Bugfix-Note`-Zeilen: Inheritance Ceremony, Slippery Fridge, Anti Magic Enchantment, Cybug LOCUST, Secret Spell Book, Ricochet, Harpyformer Choir, Cloud in a Bottle.

## Offene Rückfragen an Al (nach W51a–c)

1. **Cybug LOCUST / Secret Spell Book beim Umhängen:** beantwortet – LOCUST feuert nur, wenn der Gegner an SEINEN Held anlegt (Umsetzung ist so; Audit W51c).
2. **`onEquipLost`** feuert bewusst nur beim Umhängen; alle anderen Abgänge laufen weiter über `onCardLeaveZone`. So lassen (ja) oder für jeden Equip-Abgang (dann müssten rund 175 Leave-Lauscher einzeln geprüft werden)?
3. **Tempelunas angelegte Fee** ist per Fridge/Ceremony umhängbar (Hero-Karte, behandelt als Equip): Tempeluna verliert den Effekt, der neue Wirt gewinnt ihn nicht. Gewollt, oder soll die Fee nicht umhängbar sein?
4. **Puppet Tokens** („Cannot be moved to a different Support Zone"): Die Ceremony hängt sie trotzdem um, Tri Ad und Tri Fecta merken den Abgang nicht. Soll die Ceremony Tokens vom Umhängen ausnehmen?
5. **Cloud Pillow:** Ein über das Zielfenster aufgelegtes Cloudy gilt auch dann, wenn der Zauber den Helden danach nicht mehr trifft (vorher nur, wenn der Treffer ankam). Ja?
6. **Anti Magic Enchantment** wird bei einem per Initiation Ritual angelegten Helden („treated as an equippable Artifact") nicht angeboten (Ist-Zustand). So lassen?
7. **Lunatic Hawk:** Bei Equip an einen fremd kontrollierten Helden zieht der Ausrüstende (Ist-Zustand); ein Umhängen per Fridge/Ceremony zählt nicht als „you equip". Passt beides?

