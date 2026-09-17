// ═══════════════════════════════════════════
//  CARD EFFECT: „Sas'Za, the Snaka Adventurer"
//  Hero — Adventurousness / Hunting, 450 HP / 80 ATK   (banned)
//
//  "Up to 3 times per turn, when a Creature is defeated by its
//   opponent's card or effect, draw cards equal to that Creature's
//   level. You may add your Creatures that are defeated by an
//   opponent's card or effect back to your hand instead of sending them
//   to the discard pile."
//
//  ── ZWEI HAELFTEN MIT VERSCHIEDENER REICHWEITE ────────────────────
//  Der Text sieht symmetrisch aus, ist es aber nicht — und das ist die
//  ganze Schwierigkeit dieser Karte:
//
//  ① ZIEHEN: „when A Creature is defeated by ITS opponent's card or
//     effect". Kein „your". Gemeint ist JEDE Kreatur, gemessen an IHREM
//     eigenen Gegner.
//     ★ Al 14.9. ausdruecklich: „Der Draw-Effekt triggert auch fuer
//     GEGNERISCHE Creatures, wenn sie vom Sas'Za-Spieler besiegt werden
//     (also von deren Gegner)." Sas'Za zieht also in beide Richtungen:
//     wenn der Gegner eigene Kreaturen abraeumt UND wenn Sas'Zas
//     Spieler gegnerische abraeumt.
//
//  ② IN DIE HAND: „YOUR Creatures that are defeated by AN OPPONENT's
//     card or effect". Hier steht „your" — nur die eigenen, und nur
//     wenn der Gegner sie erledigt hat. Ein eigenes Opfer (Sacrifice)
//     gibt also nichts zurueck.
//
//  ── „UP TO 3 TIMES PER TURN" ──────────────────────────────────────
//  Die Grenze gehoert dem ZIEHEN, nicht dem Handrueckholen — der
//  Nebensatz steht im ersten Satz. Gezaehlt werden AUSLOESUNGEN, nicht
//  gezogene Karten; eine Stufe-3-Kreatur zieht drei Karten und
//  verbraucht trotzdem nur eine der drei Gelegenheiten.
//
//  ── WARUM ZWEI VERSCHIEDENE HOOKS ─────────────────────────────────
//  • `onCreatureDeathClaim` fuer das Handrueckholen: das Fenster laeuft
//    VOR der Ablage, die Karte macht dort also gar keinen Zwischenstopp
//    (Hunting-Muster, v679b). Ein Anspruch wird mit `_deathClaim`
//    gestempelt.
//  • `onCreatureDeath` fuer das Ziehen: der Zug soll erst laufen, wenn
//    der Tod feststeht — sonst zoege man fuer eine Kreatur, die ein
//    Anspruch noch wegschnappt.
// ═══════════════════════════════════════════

const { usesLeft, spendUse } = require('./_charges');

const CARD_NAME = "Sas'Za, the Snaka Adventurer";
const MAX_ZIEHUNGEN = 3;
// ★★ v1147 (Al 17.9.): der EINHEITLICHE Zaehler fuer „up to X times per
// turn" (v417-Regel, `_charges.js`) statt eines eigenen `hoptUsed`-
// Schluessels. Er haengt am HELDENOBJEKT; ueber `chargesPerTurn` +
// `chargeKey` zeigt der Client die verbleibenden Ziehungen am Helden an.
const USE_KEY = 'SasZaDraw';

/**
 * Die Sas'Za, zu der DIESER Hook gehoert — lebend und nicht
 * stummgeschaltet — oder null.
 */
function eigeneSasZa(ctx) {
  const engine = ctx._engine;
  const inst = ctx.card;
  const pi = ctx.cardOwner;
  const hi = inst?.heroIdx;
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (hero?.name !== CARD_NAME || hero.hp <= 0) return null;
  if (engine._isHeroEffectSilenced(pi, hi)) return null;
  return { hero, pi, hi };
}

/** Auftritt beim Ausloesen — dieselbe Bauart wie „Cute Meanie Melissa". */
async function auftritt(engine, pi, hi) {
  await engine.showTriggeredEffect(CARD_NAME);
  engine._broadcastEvent('play_zone_animation', {
    type: 'equip_flash', owner: pi, heroIdx: hi, zoneSlot: -1,
  });
}

module.exports = {
  activeIn: ['hero'],

  // Ladungsanzeige (v1147): „Up to 3 times per turn" am Helden.
  chargesPerTurn: MAX_ZIEHUNGEN,
  chargeKey: USE_KEY,

  hooks: {
    /**
     * ② Anspruch: eigene Kreatur, vom Gegner erledigt → auf die Hand
     * statt in die Ablage. Optional („You may").
     */
    onCreatureDeathClaim: async (ctx) => {
      const engine = ctx._engine;
      const eigen = eigeneSasZa(ctx);
      if (!eigen) return;
      const { pi, hi } = eigen;

      const tot = ctx.creature;
      if (!tot) return;
      // „YOUR Creatures" — der Kontrolleur zur Todeszeit.
      const seite = tot.controller ?? tot.owner;
      if (seite !== pi) return;
      // „defeated by AN OPPONENT's card or effect"
      const quelle = ctx.source;
      const verursacher = (quelle && typeof quelle === 'object')
        ? (quelle.controller ?? quelle.owner) : null;
      if (typeof verursacher !== 'number' || verursacher === pi) return;

      // Ein frueherer Anspruch (Hunting, Paraseed) gewinnt — wer zuerst
      // stempelt, bekommt den Kadaver.
      const inst = engine.cardInstances.find(c => c.id === tot.instId);
      if (!inst || inst._deathClaim) return;

      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        showCard: tot.name,
        message: `Add ${tot.name} back to your hand instead of your discard pile?`,
        confirmLabel: '🐍 To hand!',
        cancelLabel: 'Discard',
        cancellable: true,
      });
      if (!ja || ja.cancelled || ja.confirmed === false) return;
      if (inst._deathClaim) return;   // waehrend der Abfrage weggeschnappt

      // ★★ v1147: Auftritt erst NACH dem Ja (v736: nie vor der letzten
      // Abbruchstelle).
      await auftritt(engine, pi, hi);
      inst._deathClaim = { to: 'hand', name: tot.name, owner: pi, by: CARD_NAME };
      engine.log('sasza_to_hand', {
        player: engine.gs.players[pi]?.username, creature: tot.name,
      });
    },

    /**
     * ① Ziehen: JEDE Kreatur, die von IHREM Gegner erledigt wurde —
     * egal auf welcher Seite sie lag (Als Ruling 14.9.).
     */
    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      const eigen = eigeneSasZa(ctx);
      if (!eigen) return;
      const { hero, pi, hi } = eigen;

      const tot = ctx.creature;
      if (!tot) return;
      const seite = tot.controller ?? tot.owner;
      const quelle = ctx.source;
      const verursacher = (quelle && typeof quelle === 'object')
        ? (quelle.controller ?? quelle.owner) : null;
      if (typeof verursacher !== 'number') return;
      // „by ITS opponent" — gemessen an der Seite der KREATUR, nicht an
      // Sas'Zas Seite. Genau das macht den Effekt beidseitig.
      if (verursacher === seite) return;

      const zaehler = { key: USE_KEY, max: MAX_ZIEHUNGEN };
      if (usesLeft(hero, engine.gs, zaehler) <= 0) return;

      const cd = engine._getCardDB()[tot.name];
      const stufe = cd?.level || 0;
      if (stufe <= 0) return;                 // Stufe 0 → nichts zu ziehen

      // ★ Gezaehlt wird die AUSLOESUNG, nicht die Kartenzahl.
      spendUse(hero, engine.gs, zaehler);

      await auftritt(engine, pi, hi);
      await engine.actionDrawCards(pi, stufe, { source: CARD_NAME });
      engine.log('sasza_draw', {
        player: engine.gs.players[pi]?.username,
        creature: tot.name, level: stufe,
        genutzt: MAX_ZIEHUNGEN - usesLeft(hero, engine.gs, zaehler), von: MAX_ZIEHUNGEN,
      });
      engine.sync();
    },
  },

  /** CPU: die Karte zurueckzuholen ist immer besser als die Ablage. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type !== 'confirm') return undefined;
    return { confirmed: true };
  },
};
