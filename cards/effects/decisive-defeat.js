// ═══════════════════════════════════════════
//  CARD EFFECT: „Decisive Defeat"
//  Spell (Attachment, Decay Magic Lv2)
//
//  "While this card is attached to a Hero, that Hero's effect is
//   negated. This counts as a negative status effect."
//
//  ── ZWEI VERTRAEGE, EIN GRUND ────────────────────────────────────
//  ★ WARUM NICHT EINFACH DER `negated`-STATUS? Genau daran haengt der
//  zweite Satz. `negated` ist in der Engine ausdruecklich NICHT
//  cleansbar — der Kommentar an `getCleansableStatuses` nennt ihn einen
//  „permanent lockout", dessen Aufhebung „intended card balance" brechen
//  wuerde. Decisive Defeat sagt aber ausdruecklich, dass es ALS
//  NEGATIVER STATUS ZAEHLT, also entfernbar sein soll.
//
//  Der Zustand haengt deshalb an der KARTE, nicht an einem Status:
//    `attachmentStatus: 'negated'`  → legt den ECHTEN Status an, den
//                                     der ganze Motor liest
//    `countsAsNegativeStatus: true` → eine vollflaechige Heilung raeumt
//                                    die Karte mit weg
//
//  Faellt die Karte, ist der Held im selben Moment wieder bei Sinnen —
//  kein Aufraeumen, kein Status, der haengenbleiben koennte.
//
//  ── AN BEIDE SEITEN ──────────────────────────────────────────────
//  Der Text sagt nur „a Hero", ohne Seitenangabe — anders als bei
//  „Siege" („one of YOUR Heroes"). Als Decay-Magic-Karte gehoert sie
//  offensichtlich auf einen GEGNERISCHEN Helden, verboten ist die
//  eigene Seite aber nicht.
//
//  ── AUSWAEHLBAR IN JEDER HEIL-KARTE (v1093, Als Vorgabe 14.9.) ────
//  Die Karte taucht in den Auswahllisten von Juice, Beer und Cure als
//  „Negated (Decisive Defeat)" auf — ueber den Schluessel
//  `attach:<instId>` und `engine.cleansableHeroEntries`. Wird sie
//  geheilt, EGAL WIE, faellt sie ab und geht in die Ablage ihres
//  URSPRUENGLICHEN Besitzers (`actionMoveCard` routet ueber
//  `originalOwner`).
// ═══════════════════════════════════════════

const { attachmentHostsFor, attachToHero, anhaengselStatusHooks } = require('./_attachment-shared');

const CARD_NAME = 'Decisive Defeat';

function hostOpts(gs, pi) {
  // Beide Seiten — der Kartentext nennt keine.
  return { sides: [0, 1], ownSideOnly: false };
}

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'silence_seal' }, impactMs: 260 },

  requiresTarget: true,
  activeIn: ['hand', 'support'],

  // ★★ v1113 — KORREKTUR EINER FALSCHEN GRUNDENTSCHEIDUNG (Al 15.9.:
  // „wenn ich ein Puzzle starte und ein Hero dabei Decisive Defeat
  // angelegt hat, wird dieser NICHT mit einem Effekt belegt").
  //
  // Die Karte trug bis hierher `silencesHostHero` — eine EIGENE Abfrage,
  // die `_isHeroEffectSilenced` beantwortet. Die Annahme dahinter war
  // falsch: der SPIELBETRIEB fragt sie gar nicht. Er liest
  // `hero.statuses.negated` DIREKT, an 37 Stellen in Engine, Server und
  // Client. Die Karte war damit praktisch wirkungslos — nicht nur im
  // Puzzle.
  //
  // Jetzt legt sie den ECHTEN Status an, mit dem Muster von „Weakening
  // Crystal" (v1103): `negated` bleibt global unheilbar, aber eine
  // Instanz mit `_fromAttachment` ist ausdruecklich heilbar. Damit
  // stimmt beides — die Wirkung greift ueberall, und der zweite Satz
  // („counts as a status effect") bleibt wahr.
  attachmentStatus: 'negated',
  countsAsNegativeStatus: true,
  // So heisst der Eintrag in den Auswahllisten der Heil-Karten
  // (Als Vorgabe 14.9.).
  negativeStatusLabel: 'Negated (Decisive Defeat)',
  negativeStatusIcon: '🚫',

  spellPlayCondition(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine, hostOpts(gs, pi)).length > 0;
  },
  // ★★ v1145 (Al 17.9.): KEIN `attachmentHosts` mehr — gezogen wird wie
  // bei jedem Spell auf den WIRKER, die Zielwahl oeffnet `onPlay`
  // (`ignoreDropHints`). Mit dem Vertrag wurde der Held, auf den man zog,
  // sofort zum Ziel, und einen Wirker liess der Ziehweg nicht waehlen.

  hooks: {
    // ★★ v1143: Status-Kopplung ueber den geteilten Helfer. Der alte
    // eigene `onCardLeaveZone` pruefte nicht, WELCHE Karte geht (`ctx.card`
    // ist die lauschende) — verliess irgendeine Karte irgendeine Zone,
    // nahm Decisive Defeat die Negierung zurueck. Heilen raeumt die Karte
    // weiterhin ueber ihren `attach:`-Eintrag ab (`countsAsNegativeStatus`).
    // ★ v1168: Wird die Negierung GEHEILT, faellt die Karte in die Ablage
    // ihres urspruenglichen Besitzers (mit Flug) — Als allgemeine Regel
    // fuer anhaengsel-zugefuegte Status.
    ...anhaengselStatusHooks(CARD_NAME, 'negated', { heilenWirftAb: true }),

    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;

      const res = await attachToHero(ctx, CARD_NAME, {
        ...hostOpts(gs, ctx.cardOwner),
        ignoreDropHints: true,
        preferCaster: false,
        description: "Choose a Hero — its effect is negated while this card stays attached.",
        confirmLabel: '🔗 Attach!',
      });
      if (!res) return;

      // ★ Den Status anlegen — das ist die eigentliche Wirkung.
      const wirt = gs.players[res.host.owner]?.heroes?.[res.host.heroIdx];
      if (wirt?.name) {
        if (!wirt.statuses) wirt.statuses = {};
        wirt.statuses.negated = {
          permanent: true,
          appliedTurn: gs.turn,
          _fromAttachment: CARD_NAME,
        };
        engine._heldenStatusVerursacher(wirt.statuses.negated, { appliedBy: ctx.cardOwner, source: ctx.card });   // v1399
      }

      engine._broadcastEvent('play_zone_animation', {
        // Vorhandener Stummschalt-Effekt statt eines erfundenen Namens —
        // ein unbekannter Typ tut still gar nichts (v1064-Lehre).
        type: 'silence_seal', owner: res.host.owner,
        heroIdx: res.host.heroIdx, zoneSlot: -1,
      });
      engine.log('decisive_defeat_attached', {
        player: gs.players[ctx.cardOwner]?.username,
        hero: gs.players[res.host.owner]?.heroes?.[res.host.heroIdx]?.name,
      });
      engine.sync();
    },
  },
};
