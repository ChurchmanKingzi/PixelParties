// ═══════════════════════════════════════════
//  CARD EFFECT: "Trial of Knowledge"
//  Spell (Magic Arts Lv1, Normal, Trials)
//
//  "You cannot play other Attacks or Spells the turn you play this
//   card. For the rest of the game, the levels of all \"Trial of\"
//   Spells you play become 0 and cannot be increased by other
//   effects. You can only play 1 \"Trial of Knowledge\" per game."
//
//  Das ist die einzige der fuenf Pruefungen mit einer DAUERWIRKUNG.
//  Nach ihr braucht keine weitere Pruefung mehr eine Schulstufe —
//  der ganze Archetyp wird auf einen Schlag ohne Ability spielbar.
//
//  ── Wie eine abgelegte Karte weiterwirkt ──
//  ★ 18.8., nach Als Befund „tut aktuell scheinbar gar nichts?":
//  Fuer einen SPELL geht das Muster von `ladder-to-the-sky.js` NICHT.
//  Ladder ist ein Artifact und darf seine eigene Instanz in den
//  Discard umzonen; ein Spell dagegen wird nach der Aufloesung ueber
//  seine id abgeraeumt (`_untrackCard`, server.js ~7156) — egal, in
//  welcher Zone die Instanz gerade steht. Das Umzonen war damit
//  wirkungslos, und die ganze Dauerwirkung existierte nie.
//  Deshalb legt die Karte eine EIGENE Marker-Instanz im Discard an:
//  eine zweite Instanz mit eigener id, die der Server nicht kennt und
//  folglich nicht abraeumt. Sie ist dort aktiv (`activeIn: ['discard',
//  'deleted']`) und liefert die Reduktion. Damit braucht es
//  keinen Spielerzustand, der bei jedem Rundenbeginn neu behauptet
//  werden muesste, und keine Aenderung an der Engine: die vorhandene
//  Sammelstelle `_applyCardLevelReductions` fragt jede aktive Instanz
//  nach `reduceCardLevel`, und diese hier ist ab sofort dabei.
//  `deleted` steht mit in der Liste, weil Karten aus dem Discard
//  nachtraeglich geloescht werden koennen — die Dauerwirkung soll das
//  ueberleben.
//
//  ── Warum die Reduktion 99 zurueckgibt und nicht die Kartenstufe ──
//  Die Engine rechnet `max(0, Stufe − Summe der Reduktionen)`, und die
//  ERHOEHUNGEN laufen VORHER: Mana Absorbing Crystal legt in
//  `effectiveCardLevel` Schritt (3) noch +1 drauf. Gaebe ich die
//  gedruckte Stufe zurueck, bliebe unter dem Kristall eine 1 stehen —
//  „cannot be increased by other effects" waere gebrochen. Ein Betrag
//  ueber jeder erreichbaren Stufe schneidet das sauber auf 0 ab. Genau
//  das trennt diese Karte von einem gewoehnlichen Stufenrabatt.
//
//  ── Reichweite ──
//  • Nur SPELLS: der Text sagt „Trial of\" Spells". `The Final Trial`
//    ist ein Attack UND traegt den Namensteil nicht — doppelt aussen
//    vor, korrekt.
//  • Nur die EIGENE Seite: `reduceCardLevel` wird ohne
//    `globalReduceCardLevel` nur fuer Instanzen des auswertenden
//    Spielers gesammelt. Das deckt „Spells YOU play" genau ab.
//  • Auf der HAND wirkt die Karte nicht — `activeIn` schliesst die
//    Handzone aus. Erst das Ablegen schaltet die Dauerwirkung frei.
//
//  ⚠ BEKANNTE GRENZE: holt ein spaeterer Effekt diese Karte aus dem
//  Discard zurueck auf die Hand oder ins Deck, endet die Wirkung —
//  die Instanz ist dort nicht mehr aktiv. Wieder spielbar ist sie
//  wegen `oncePerGame` aber auch nicht. Bewusst so gelassen: der
//  Alternativweg (Spielerzustand + Erhoehungssperre in der Engine)
//  waere ein Eingriff in `effectiveCardLevel` fuer einen Randfall,
//  den heute keine Karte im Pool herbeifuehrt.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  TRIAL_KEYS, isTrialOfName, trialTurnIsClean, stampTrialLock,
} = require('./_trials-shared');

const CARD_NAME = 'Trial of Knowledge';
// Ueber jeder im Spiel erreichbaren Kartenstufe — siehe Kopf.
const ABSOLUTE_ZERO = 99;

module.exports = {
  oncePerGame: true,
  oncePerGameKey: TRIAL_KEYS[CARD_NAME],

  // Die Dauerwirkung haengt an der abgelegten Karte, nicht an der
  // Hand. In der Hand darf sie NICHT wirken, sonst waere sie schon
  // vor dem Spielen aktiv.
// ★★ HIER LAG DER GRUND, WARUM DIE KARTE „ueberhaupt nichts" TAT
  // (Als Befund 18.8., zweimal gemeldet).
  // `activeIn` steuert NICHT nur, wo eine Karte wirkt — `runHooks`
  // liefert einen Hook ueberhaupt nur an Instanzen aus, die in ihrer
  // aktuellen Zone aktiv sind. Beim Ausspielen liegt der Spell in der
  // HAND. Stand `hand` nicht in der Liste, wurde `onPlay` schlicht
  // uebersprungen: kein Marker, keine Animation, kein Riegel, nichts.
  // Mein Repro hat den Hook DIREKT gerufen und den Filter damit
  // umgangen — deshalb war er gruen und die Karte trotzdem tot.
  // `hand` muss also mit hinein; dass die Karte auf der Hand noch
  // nicht reduziert, sichert der Zonen-Riegel in `reduceCardLevel`.
  activeIn: ['hand', 'discard', 'deleted'],

  spellPlayCondition(gs, pi) {
    return trialTurnIsClean(gs, pi);
  },

  /**
   * Board-weite Stufen-Absenkung. Die Engine ruft das je aktiver
   * Instanz des auswertenden Spielers und zieht das Ergebnis von der
   * bereits erhoehten Stufe ab.
   */
  reduceCardLevel(cardData, engine, ownerIdx, inst /*, heroIdx, evalOpts */) {
    if (!cardData || !isTrialOfName(cardData.name)) return 0;
    if (!hasCardType(cardData, 'Spell')) return 0;
    // ★ Nur eine ABGELEGTE Pruefung wirkt. `activeIn` enthaelt seit
    // v494 auch `hand` — sonst kaeme der `onPlay`-Hook gar nicht an
    // (siehe Kopf) —, und ohne diesen Riegel wuerde eine Trial of
    // Knowledge schon auf der HAND alle anderen Pruefungen verbilligen.
    // Der Text sagt „the levels of all … Spells you play become 0"
    // ab dem Spielen, nicht ab dem Ziehen.
    const zone = inst?.zone;
    if (zone && zone !== 'discard' && zone !== 'deleted') return 0;
    return ABSOLUTE_ZERO;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      stampTrialLock(gs, pi);

      // ★ ALS VORGABE 18.8.: „Blaue Herzchen und Particles auf allen
      // 'Trial of'-Karten auf der Hand."
      // Je betroffener Handkarte eine Ausloesung, damit die Wirkung
      // sichtbar an DEN Karten haengt, die sie trifft — und nicht als
      // ein Blitz in der Mitte. `handIdx` sagt dem Client, welche
      // Handkarte gemeint ist.
      // ★★ HIER LAG DER FEHLER (Als Befund 18.8.: „Trial of Knowledge
      // tut aktuell scheinbar gar nichts?").
      // Die Dauerwirkung haengt daran, dass eine AKTIVE Instanz dieser
      // Karte im Discard steht — `_applyCardLevelReductions` fragt nur
      // getrackte Instanzen. Der Server legt nach der Aufloesung aber
      // nur den NAMEN in den Discard und ruft dann
      // `_untrackCard(inst.id)` (server.js ~7156): die Instanz ist weg,
      // und damit war die ganze Karte wirkungslos.
      // Das Umzonen der eigenen Instanz (Muster `ladder-to-the-sky.js`)
      // hilft NICHT — die wird ueber ihre id entfernt, egal wo sie
      // steht. Also legen wir eine EIGENE Marker-Instanz im Discard an;
      // die kennt der Server nicht und raeumt sie nicht weg.
      // Sie traegt denselben Namen wie der Eintrag, den der Server
      // gleich in den Discard schiebt — Karte und Instanz decken sich.
      if (engine.findCards({ owner: pi, zone: 'discard', name: CARD_NAME }).length === 0) {
        engine._trackCard(CARD_NAME, pi, 'discard', -1, -1);
      }

      // ★ Die Partikel haengen an den betroffenen HANDKARTEN — aber
      // ueber ihren NAMEN, nicht ueber den Index: Knowledge verlaesst
      // in diesem Moment selbst die Hand, alle Indizes rutschen, und
      // eine Animation traefe die falsche Karte. Der Client sucht den
      // Slot ueber `data-card-name`.
      const cardDB = engine._getCardDB();
      const namenAufDerHand = new Set();
      for (const n of (ps.hand || [])) {
        const cd = cardDB[n];
        if (!cd || !isTrialOfName(cd.name) || !hasCardType(cd, 'Spell')) continue;
        if (cd.name === CARD_NAME) continue;   // sie selbst geht ja gerade weg
        namenAufDerHand.add(cd.name);
      }
      for (const n of namenAufDerHand) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'knowledge_sparkle', owner: pi, heroIdx: -1, zoneSlot: -1,
          handCardName: n,
        });
      }
      // Liegt gerade keine Pruefung auf der Hand, bleibt ein Hinweis an
      // der Hand selbst — die Dauerwirkung gilt ja trotzdem.
      if (namenAufDerHand.size === 0) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'knowledge_sparkle', owner: pi, heroIdx: -1, zoneSlot: -1,
          zoneType: 'hand',
        });
      }

      engine.log('trial_of_knowledge', {
        player: ps.username,
        // Die Dauerwirkung haengt jetzt an der Marker-Instanz, nicht
        // mehr an der umgezonten Spielinstanz (`inst` gibt es hier
        // nicht mehr).
        anchored: engine.findCards({ owner: pi, zone: 'discard', name: CARD_NAME }).length > 0,
      });
      engine.sync();
    },
  },
};
