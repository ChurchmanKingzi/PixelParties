// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Prototypes"
//  Artifact (Normal, Cost 0)
//
//  "While this card is in your discard pile, you may once per turn
//   change its name to that of any other card until the end of this
//   turn."
//
//  ── Die letzte Karte des Archetyps, und die einzige mit einem
//     wirklich fehlenden Mechanismus ──────────────────────────────────
//  Jeder Aktivierungsweg des Spiels lief bisher über Hand, Feld,
//  Ability- oder Area-Zonen. Eine Karte, die AUS DER ABLAGE heraus
//  etwas tut, gab es nicht. Dafür ist der Vertrag `discardEffect` /
//  `canActivateDiscardEffect` / `onDiscardEffect` da (v582) — bewusst
//  parallel zu `equipEffect` benannt.
//
//  ── Die Kette, diesmal VORHER aufgeschrieben ───────────────────────
//  Nach der Control-Device-Lehre („eine neue Fähigkeit braucht die
//  GANZE Kette, ich habe drei Glieder gebaut und das vierte vergessen"):
//    ① diese Karte
//    ② `engine.getActivatableDiscardCards(pi)` — der Sammler
//    ③ `activatableDiscard` im Zustandsversand (beide Projektionen)
//    ④ `doActivateDiscardEffect` + Socket-Route im Server
//    ⑤ Anzeige und Klick im Ablage-Dialog (`PileSearchModal`)
//
//  ── Der Namenswähler ───────────────────────────────────────────────
//  [Als Hinweis 22.8.: „Schau dir Luck an — die Karte hat bereits einen
//   'name any card'-Picker."] Genau der: `promptGeneric` mit
//  `type: 'cardNamePicker'`. Client-Komponente und Warteanzeige für den
//  Gegner sind fertig; hier wird nur die Namensliste anders gefiltert.
//
//  ── „to that of ANY OTHER card" ────────────────────────────────────
//  Wörtlich jede andere Karte, nicht nur „Future Tech"-Karten: man darf
//  Prototypes also auch auf einen Namen ausserhalb des Archetyps
//  setzen. Ausgeschlossen ist nur der eigene Name („any OTHER card") —
//  und Tokens, die es als eigenständige Karte nicht gibt.
//
//  ── Die Umbenennung selbst ─────────────────────────────────────────
//  `setzeAblageAlias` aus dem gemeinsamen Modul, also derselbe Topf,
//  den Copy Device benutzt und den `zaehleInAblage` liest. Die
//  Basiszahl regelt, dass der Alias nur zählt, solange die Trägerkarte
//  wirklich in der Ablage liegt.
//
//  ★ Prototypes ist beim Setzen bereits DORT — die Basiszahl muss also
//  eine Kopie WENIGER sein als vorhanden, sonst schliefe der eigene
//  Alias sofort ein. Deshalb `basisOffset: -1`.
//
//  ── Einmal pro Zug, pro INSTANZ ────────────────────────────────────
//  „you may once per turn" ohne „You can only … 1 … per turn" ist die
//  WEICHE Form (Konvention seit v249): jede Kopie in der Ablage darf
//  einmal. Sperre deshalb über die Instanz-Id.
// ═══════════════════════════════════════════

const { setzeAblageAlias } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Prototypes';

/** Rundensperre je Instanz — weiche HOPT. */
function schluessel(inst) {
  return `ft-prototypes:${inst.id}`;
}

/** Alle Namen, auf die umbenannt werden darf. */
function waehlbareNamen(engine) {
  const cardDB = engine._getCardDB();
  return Object.keys(cardDB).filter((n) => {
    if (n === CARD_NAME) return false;              // „any OTHER card"
    const cd = cardDB[n];
    if (!cd) return false;
    // Tokens werden von Effekten erzeugt und existieren als Karte
    // nicht — als Name taugen sie nicht (dieselbe Ausnahme wie bei Luck).
    if (String(cd.cardType || '').split('/').includes('Token')) return false;
    return true;
  }).sort((a, b) => a.localeCompare(b));
}

module.exports = {
  // In der Ablage getrackt bleiben, damit der Sammler eine Instanz
  // findet und die Rundensperre daran hängen kann.
  activeIn: ['discard'],
  discardEffect: true,
  isTargetingArtifact: false,

  /**
   * Aus der Hand gespielt passiert NICHTS — die Karte wandert einfach
   * für 0 Gold in die Ablage. [Als Vorgabe 22.8.] Genau das ist ihr
   * Zweck: man „spielt" sie, um sie DORTHIN zu bringen, wo sie wirkt.
   *
   * ★ UND HIER LAG DER FEHLER, den Al gemeldet hat („im Discard nicht
   *   aktivierbar, kein Handler"): ohne `resolve` steigt
   *   `doUseArtifactEffect` sofort aus (`if (!script.resolve) return
   *   false;`) — die Karte liess sich gar nicht erst spielen. Und
   *   selbst wenn: der Server schiebt beim Ablegen nur den NAMEN in
   *   die Ablage, die INSTANZ bleibt bei `zone: 'hand'` stehen. Der
   *   Sammler findet dann nichts und bietet nichts an. Dieselbe Stelle
   *   wie bei Ladder to the Sky — die Instanz muss selbst umgezont
   *   werden.
   */
  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };
    const inst = engine.findCards({ owner: pi, zone: 'hand', name: CARD_NAME })[0];
    if (inst) {
      inst.zone = 'discard';
      inst.heroIdx = -1;
      inst.zoneSlot = -1;
    }
    engine.log('ft_prototypes_played', { player: ps.username });
    engine.sync();
    return { ok: true };
  },

  canActivateDiscardEffect(gs, pi, engine, inst) {
    if (!inst || inst.zone !== 'discard') return false;
    return gs.hoptUsed?.[schluessel(inst)] !== gs.turn;
  },

  async onDiscardEffect(engine, pi, inst) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps || !inst || inst.zone !== 'discard') return false;
    if (gs.hoptUsed?.[schluessel(inst)] === gs.turn) return false;

    const wahl = await engine.promptGeneric(pi, {
      type: 'cardNamePicker',
      title: CARD_NAME,
      description: 'Name any other card. This card counts as that card until the end of the turn.',
      cardNames: waehlbareNamen(engine),
      cancellable: true,
      showCard: CARD_NAME,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName) return false;
    const name = wahl.cardName;

    // Erst NACH der Zusage verbuchen — ein Abbruch kostet nichts
    // (Konvention aus CARD_API, „Verbuchen erst nach der Zusage").
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[schluessel(inst)] = gs.turn;

    // ★ `basisOffset: -1` — die Trägerkarte liegt schon in der Ablage,
    //   der Alias soll also SOFORT zählen und nicht erst, wenn eine
    //   weitere Kopie dazukommt.
    setzeAblageAlias(gs, pi, CARD_NAME, name, { basisOffset: -1, instId: inst.id });
    inst.counters = inst.counters || {};
    inst.counters._ftCopyOf = name;        // Kartenbild / Hover im Dialog
    inst.counters._identityExpiresTurn = gs.turn;

    engine._broadcastEvent('card_reveal', {
      cardName: name, playerIdx: pi, sfx: 'ability_activate',
    });
    engine.log('ft_prototypes', { player: ps.username, renamedTo: name });
    engine.sync();
    return true;
  },

  /**
   * Zugende: der geliehene Name fällt ab.
   *
   * Gerufen vom Sweep `_expireBorrowedIdentities`, NICHT über einen
   * Hook — bei gesetztem `_effectOverride` läse `getHook` die Hooks der
   * geliehenen Karte. Prototypes setzt zwar kein `_effectOverride`
   * (sie übernimmt nur den NAMEN, nicht den Effekt), trägt aber
   * denselben Ablaufstempel; damit greift derselbe Aufräumweg.
   */
  async onIdentityExpire(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst) return;
    const besitzer = inst.originalOwner ?? inst.owner;
    const { loescheAblageAlias } = require('./_future-tech-shared');
    loescheAblageAlias(gs, besitzer, CARD_NAME, inst.id);
    delete inst.counters._ftCopyOf;
    engine.log('ft_prototypes_expire', { player: gs.players[besitzer]?.username });
  },
};
