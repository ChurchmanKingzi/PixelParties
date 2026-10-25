'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Wendy, the Shy Girl"  (W74c)
//  Creature / Reaction (Summoning Magic Lv1, 50 HP)
//
//  „You may immediately summon this Creature as an additional Action when you add a card from your side of the board to your hand. You may once per turn add this Creature
//   you control back to your hand. If you do, the next Spell you use this turn has its level reduced by 3. You can only control 1 "Wendy, the Shy Girl"."
//
//  ① AUS DER HAND (Hook `onBoardCardToHand`, activeIn 'hand')
//     „A card from your side of the board" = jede Karte, die aus einer Zone der EIGENEN Brettseite (Support/Ability/Surprise Zone) in die EIGENE Hand wandert — über den zentralen Move
//     (`actionMoveCard`) UND über die Sonderwege (Deepsea-Bounce/-Swap, Rückgabe-Baustein …; Engine `handZugangSync` mit `von: 'brett'`/`vonInst`). Gelöschte Karten (Ankhota) kommen nie auf
//     die Hand. Auch Wendy selbst zählt (ihre eigene Rückkehr bietet sie erneut an — der Riegel unten verhindert die Endlosschleife). Angebot: Ja/Nein, Zonenwahl, Beschwörung als
//     Zusatzaktion über `sofortAusHandBeschwoeren` (tauglicher Held, Sperren, „You can only control 1").
//  ② AKTIVE WIRKUNG (einmal pro Zug): Wendy geht auf die Hand zurück; der NÄCHSTE Spell dieses Zuges kostet 3 Level weniger (`engine.spellRabattVormerken` → `_applyCardLevelReductions`).
//     Der Einmal-Riegel hängt am SPIELER und Namen (`hoptUsed['wendy-back:pi']`), nicht an der Instanz — ein neu beschworenes Mädchen holt sich keinen zweiten Rabatt im selben Zug.
//  ③ NUR EINE: `beforeSummon` + `canSummon`.
// ═══════════════════════════════════════════
const { sofortAusHandBeschwoeren } = require('./_summon-eligibility');
const { returnSupportCreatureToHand } = require('./_deepsea-shared');
const { kontrolliert } = require('./_double-shared');

const CARD_NAME = 'Wendy, the Shy Girl';
const RABATT = 3;
const HAND_ZONEN = new Set(['support', 'ability', 'surprise']);

const riegel = (pi) => `wendy-back:${pi}`;
const riegelBenutzt = (gs, pi) => gs.hoptUsed?.[riegel(pi)] === gs.turn;

async function handAngebot(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  if (ctx.cardZone !== 'hand') return;
  const pi = ctx.card.owner;
  if (ctx.handSeite !== pi || ctx.vonSeite !== pi) return;
  if (ctx.quelleSeite != null && ctx.quelleSeite !== pi) return;   // when YOU add: ein Effekt des Gegners, der meine Karte zurueckschickt, ist kein eigenes Hinzufuegen      // „your side of the board" → „your hand"
  if (!HAND_ZONEN.has(ctx.vonZone)) return;
  // Eine Offerte je Ereignis: mehrere Wendys auf der Hand sehen denselben Kontext; die erste fragt, die Übrigen sind durch „only control 1" ohnehin gesperrt.
  if (ctx._wendyAngebot) return;
  ctx._wendyAngebot = true;
  const ps = gs.players[pi];
  if (!ps || !(ps.hand || []).includes(CARD_NAME)) return;
  if (kontrolliert(engine, pi, CARD_NAME)) return;

  const ja = await engine.promptGeneric(pi, {
    type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
    message: `${ctx.bewegtName} went back to your hand. Summon ${CARD_NAME} from your hand as an additional Action?`,
    confirmLabel: '🙈 Summon!', cancelLabel: 'No', cancellable: true,
  });
  if (!engine._confirmSaidYes(ja)) return;
  const ok = await sofortAusHandBeschwoeren(engine, pi, CARD_NAME, {
    source: CARD_NAME,
    nachZonenwahl: () => engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi }),
  });
  if (ok) engine.sync();
}

module.exports = {
  activeIn: ['hand', 'support'],
  creatureEffect: true,

  // „You can only control 1" — für jede Beschwörung.
  async beforeSummon(ctx) { return !kontrolliert(ctx._engine, ctx.cardOwner, CARD_NAME); },
  canSummon(ctx) {
    const engine = ctx._engine;
    return !(engine.cardInstances || []).some(c => c.id !== ctx.card.id && c.zone === 'support' && !c.faceDown
      && (c.controller ?? c.owner) === ctx.cardOwner && engine.instHatName(c, CARD_NAME));
  },

  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
    return !riegelBenutzt(ctx._engine.gs, inst.controller ?? inst.owner);
  },

  /** „add this Creature you control back to your hand. If you do, the next Spell you use this turn has its level reduced by 3." */
  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    const pi = inst.controller ?? inst.owner;
    if (!inst || inst.zone !== 'support' || riegelBenutzt(gs, pi)) return false;
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[riegel(pi)] = gs.turn;
    await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: inst });
    const r = await returnSupportCreatureToHand(engine, inst, CARD_NAME, { sourceOwner: pi, animationType: 'summon', selbst: true });
    if (!r?.returned) { delete gs.hoptUsed[riegel(pi)]; return false; }   // nichts passiert (z. B. immun) → der Riegel bleibt frei
    // Gelöscht statt zurückgenommen (Ankhota)? Dann „add back" ist nicht geschehen → kein Rabatt.
    if (inst._ankhotaGeloescht) return true;
    engine.spellRabattVormerken(pi, RABATT, CARD_NAME);
    engine.log('wendy_discount', { player: gs.players[pi]?.username, amount: RABATT });
    engine.sync();
    return true;
  },

  hooks: {
    onBoardCardToHand: async (ctx) => handAngebot(ctx),
  },
};
