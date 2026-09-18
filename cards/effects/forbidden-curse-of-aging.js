// ═══════════════════════════════════════════
//  CARD EFFECT: „Forbidden Curse of Aging"
//  Spell (Attachment, Decay Magic Lv1)
//
//  "The HP of the Hero this Spell is attached to cannot be healed, and
//   its other status effects cannot be removed. Additionally, negate
//   the effects of all "Charme" Abilities attached to it. This counts as
//   a status effect. If the target has any "Charme" Abilities attached
//   to it or has not taken any damage yet this game, this counts as an
//   additional Action."
//
//  ── ★★ v1143: DER STATUS „AGED" ──────────────────────────────────
//  Bis v1142 wirkte die Karte ohne Status, allein ueber drei Karten-
//  Vertraege, und der Badge kam ueber einen Nebenkanal, der den Client
//  nie erreichte. Jetzt nach dem Muster von „Decisive Defeat" und
//  „Curse": die Karte legt den ECHTEN Status `aged` an (Registry in
//  _hooks.js), und der Status ist der Schalter ihrer Wirkungen.
//
//    `attachmentStatus: 'aged'`          → Status; auch im Puzzle-Start
//    `blocksHostHeal: true`              → Heilung am Wirt verpufft
//    `blocksHostStatusRemoval: true`     → seine UEBRIGEN Status sind
//                                          eingefroren; `aged` selbst
//                                          bleibt entfernbar („other")
//    `negatesHostAbilities: ['Charme']`  → Charme am Wirt ist tot
//
//  Alle drei greifen nur, solange `aged` am Wirt liegt
//  (`engine._attachmentStatusHaelt`). Karte und Status sind gekoppelt
//  (`anhaengselStatusHooks`): faellt die Karte, faellt der Status; wird
//  der Status geheilt, geht die Karte in die Ablage ihres
//  urspruenglichen Besitzers.
//
//  ── DIE ZUSATZ-AKTION (Als Regel 15.9., bestaetigt 17.9.) ─────────
//  ① ANGEBOTEN wird die Karte als Zusatz-Aktion, solange mindestens ein
//     LEGALES Ziel (lebt, freie Support Zone) eine der beiden
//     Bedingungen erfuellt.
//  ② Steht eine Rueckfall-Aktion bereit (Grund-Aktion in Main Phase 1
//     bzw. Action Phase, Duigno, Zhigao, Bonus-Aktionen …), ist JEDES
//     Ziel waehlbar; sonst nur Ziele, die eine Bedingung erfuellen — die
//     uebrigen stehen AUSGEGRAUT in der Zielwahl (v1143b). Gratis-Ziele
//     leuchten gruen. Gezogen wird wie bei jedem Spell auf den WIRKER;
//     die Zielwahl oeffnet danach immer `onPlay`.
//  ③ Ein Ziel OHNE Bedingung verbraucht die naechste verfuegbare
//     Aktion — `gs._spellForcesActionConsume`, der Server bezahlt sie
//     seit v1143 wirklich: in einer Main Phase bzw. nach verbrauchter
//     Aktion ein passender Geber, sonst in Main Phase 1 die Aktion der
//     Action Phase (Sprung nach Main Phase 2). In der Action Phase vor
//     der ersten Aktion ist es die Grund-Aktion.
// ═══════════════════════════════════════════

const { attachmentHostsFor, attachToHero, anhaengselStatusHooks, setzeAnhaengselStatus } = require('./_attachment-shared');

const CARD_NAME = 'Forbidden Curse of Aging';
const STATUS_NAME = 'aged';
const NEGIERT = ['Charme'];

const statusHooks = anhaengselStatusHooks(CARD_NAME, STATUS_NAME, { heilenWirftAb: true });

/** Wieviele Stufen `ability` liegen an diesem Helden? */
function abilityStufe(gs, pi, heroIdx, ability) {
  const zonen = gs.players[pi]?.abilityZones?.[heroIdx] || [];
  for (const slot of zonen) {
    if (Array.isArray(slot) && slot[0] === ability) return slot.length;
  }
  return 0;
}

/**
 * Erfuellt DIESES ZIEL eine der beiden Gratis-Bedingungen?
 *   ① es traegt eine „Charme"-Ability (Stufe 1+), ODER
 *   ② es hat in dieser PARTIE noch keinen Schaden genommen
 *      (`_jeGetroffen`, gesetzt in `_noteDamageTaken`, nie
 *      zurueckgesetzt; im Puzzle ueber den Editor bzw. HP < max).
 */
function zielIstGratis(gs, wirtPi, wirtHi) {
  if (NEGIERT.some(a => abilityStufe(gs, wirtPi, wirtHi, a) > 0)) return true;
  const hero = gs?.players?.[wirtPi]?.heroes?.[wirtHi];
  return !!hero?.name && !hero._jeGetroffen;
}

/**
 * Wirtsliste. Mit bezahlbarer Rueckfall-Aktion offen, sonst auf Ziele
 * beschraenkt, die eine Bedingung erfuellen (Regel ②).
 */
function hostOpts(gs, pi, heroIdx, engine) {
  const basis = { sides: [0, 1], ownSideOnly: false };
  if (!gs || !engine) return basis;
  if (engine.hasPayableActionFor?.(pi, CARD_NAME, heroIdx)) return basis;
  return { ...basis, heroFilter: (hero, hi, side) => zielIstGratis(gs, side, hi) };
}

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'silence_seal' }, impactMs: 260 },

  requiresTarget: true,
  activeIn: ['hand', 'support'],

  attachmentStatus: STATUS_NAME,
  blocksHostHeal: true,
  blocksHostStatusRemoval: true,
  negatesHostAbilities: NEGIERT,

  /**
   * Regel ①. ★ v1143: nur LEGALE Ziele zaehlen — ein Held ohne freie
   * Support Zone kann die Karte gar nicht tragen (vorher reichte „lebt").
   */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    return attachmentHostsFor(gs, pi, engine, {
      sides: [0, 1],
      heroFilter: (hero, hi, side) => zielIstGratis(gs, side, hi),
    }).length > 0;
  },

  /** Zaehlt der Einsatz GEGEN DIESEN WIRT als Zusatz-Aktion? */
  zaehltAlsZusatzAktion(gs, wirkerPi, wirkerHi, wirtPi, wirtHi) {
    return zielIstGratis(gs, wirtPi, wirtHi);
  },

  spellPlayCondition(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine, hostOpts(gs, pi, undefined, engine)).length > 0;
  },
  // ★★ v1143b (Al 17.9.): KEIN `attachmentHosts` mehr. Der Vertrag macht
  // den Drop zum WIRT — gezogen auf einen eigenen Helden, der wirken
  // sollte, wurde der verflucht, und einen Wirker liess der Ziehweg gar
  // nicht waehlen. Ohne den Vertrag hebt der Client beim Ziehen wie bei
  // jedem Spell die moeglichen WIRKER hervor; die Zielwahl oeffnet
  // danach `onPlay` (Drop-Hinweise ignoriert).


  hooks: {
    ...statusHooks,

    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;

      // ★★ v1143b (Al 17.9.): Zielwahl mit Farben statt stillem Filter.
      //   • GRUEN: gegen dieses Ziel ist der Einsatz eine Zusatz-Aktion;
      //   • AUSGEGRAUT (nur ohne Rueckfall-Aktion): Ziele ohne Bedingung.
      // Mit Rueckfall-Aktion bleibt alles waehlbar (Regel ②).
      const rueckfall = !!engine.hasPayableActionFor?.(ctx.cardOwner, CARD_NAME, ctx.cardHeroIdx);
      const gratis = (hero, hi, side) => zielIstGratis(gs, side, hi);
      const res = await attachToHero(ctx, CARD_NAME, {
        sides: [0, 1],
        heroAccent: (hero, hi, side) => (gratis(hero, hi, side) ? 'green' : null),
        heroDim: rueckfall ? null : (hero, hi, side) => !gratis(hero, hi, side),
        ignoreDropHints: true,
        preferCaster: false,
        description: rueckfall
          ? 'Choose a Hero to become Aged. Green Heroes make this an additional Action; any other Hero costs an Action.'
          : 'Choose a Hero to become Aged. Only green Heroes are possible — they make this an additional Action.',
        confirmLabel: '⏳ Curse!', confirmClass: 'btn-danger',
        promptExtras: { greenSelect: false },
      });
      if (!res) return;

      // Der Eintritts-Hook hat `aged` bereits angelegt; hier nur der
      // Gurt, falls ein Eintrittsweg ohne `onCardEnterZone` kam.
      const wirt = gs.players[res.host.owner]?.heroes?.[res.host.heroIdx];
      if (wirt?.name && !wirt.statuses?.[STATUS_NAME]) {
        setzeAnhaengselStatus(engine, res.host.owner, res.host.heroIdx, CARD_NAME, STATUS_NAME);
      }

      // Regel ③ — jetzt steht der Wirt fest.
      if (!module.exports.zaehltAlsZusatzAktion(
            gs, ctx.cardOwner, ctx.cardHeroIdx, res.host.owner, res.host.heroIdx)) {
        gs._spellForcesActionConsume = true;
        engine.log('curse_of_aging_no_free_action', {
          player: gs.players[ctx.cardOwner]?.username,
        });
      }

      engine._broadcastEvent('play_zone_animation', {
        type: 'silence_seal', owner: res.host.owner,
        heroIdx: res.host.heroIdx, zoneSlot: -1,
      });
      engine.log('curse_of_aging_attached', {
        player: gs.players[ctx.cardOwner]?.username,
        hero: gs.players[res.host.owner]?.heroes?.[res.host.heroIdx]?.name,
      });
      engine.sync();
    },
  },
};
