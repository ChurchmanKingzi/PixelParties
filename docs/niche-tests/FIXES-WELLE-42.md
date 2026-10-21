# Fix-Welle 42 – Antworten auf die W41a-Rückfragen

Al hat die fünf Rückfragen aus [FIXES-WELLE-41.md](FIXES-WELLE-41.md) beantwortet (22.10.2026). Ein Agent (**W42a**, Zweig `wave42/W42a`) hat sie umgesetzt. Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 42 / W42a"; Repros `docs/niche-tests/repro/W42/a-01`, `a-02`.

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Kohta × Kunagi | „Nein, verbraucht es nicht, ebenso wenig, wie normale Attacks mit Karten Zusatzaktionen mit Kunagi kosten. Die Aktion des ersten Schlags reicht." | W41a zurückgenommen: die Wiederholung kostet bei Kohta keine (Zusatz-)Aktion. Prinzip für alle Quellen: Aktion/Ausspielen (Gold, Handkarte, Aktion) wird bei der Wiederholung nie erneut bezahlt |
| Sword in a Bottle, Alluring Light, Javelin Throw | „Korrekt, man muss keine extra Handkarten abwerfen und auch Gold nicht mehrfach zahlen." | Ist-Zustand bleibt (nur In-Effekt-Kosten, Javelin Throw: weiteres Equip); abgesichert in `W42/a-02` |
| Sacrificial Dagger | „Stopp – Sacrificial Dagger hatte ich falsch im Kopf. Der hat gar keine Kosten, ‚when you sacrifice a target' ist lediglich seine Aktivierungsbedingung. Heißt, die zweite Aktivierung kostet NICHTS extra!" | W41a zurückgenommen: die Wiederholung des Dolchs verlangt kein weiteres Opfer. Prüfung aller wiederholbaren Quellen gegen ihren Kartentext: **Bamboo Staff** („when a card is added from your discard pile …") ist ebenfalls nur eine Bedingung → ebenfalls kostenlos (W41a zurückgenommen); **Brackle, Infected Greatmaw** („sacrifice … to …") und **Javelin Throw** (Equip in die Ablage im Effekt) sind Preise → bleiben. Alle anderen (Broghan, Arthor, Heragas, Crusader's ×4, Sword in a Bottle, Alluring Light) haben keinen Preis. Tabelle: CARD_API.md |
| Kunagi-Angebot | „Ja, das genügt" | Ist-Zustand: Abbruch der Kosten-/Zielwahl = Ablehnen; abgesichert in `W42/a-02` |
| Hardy Slime | „Ja, die sollen abgedeckt sein. Nur, wenn *Hardy Slime selbst* kein mögliches Ziel ist, greift der Taunt nicht." | Der Taunt sitzt jetzt auch im Flaschenhals `promptEffectTarget` (`engine.markiereTauntGesperrte`; markiert statt zu beschneiden, rechnet nur über wählbare Ziele) und im erneut geöffneten Ziel-Fenster von `doConfirmPotion`. `W42/a-01` |

Umgestellte alte Repros: `W41/a-02` (Dagger, Bamboo Staff, Kohta: Wiederholung ohne Zusatzkosten, Ablehnen am Zielfenster), `W40/a-03` (zurück in die W40a-Form, ohne die W41a-Ergänzungen für Opfer/Ablagekarten/Zusatzaktionen). Alle anderen Repros unverändert.

## Offene Rückfragen an Al

Alle drei sind beantwortet und in [FIXES-WELLE-43.md](FIXES-WELLE-43.md) umgesetzt (dort stehen die neuen Rückfragen).
