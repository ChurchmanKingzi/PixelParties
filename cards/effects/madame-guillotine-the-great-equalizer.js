'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Madame Guillotine, the Great Equalizer"  (v1349, neuer Text)
//  Hero — 500 HP, 100 ATK (Leadership, Magic Arts)
//
//  "During your opponent's turn, whenever your opponent performs an
//   Action, places a Creature or uses the active effect of a Hero or
//   Ability, choose any Ability attached to any Hero they control and
//   delete it. Abilities deleted by this effect cannot leave the Deleted
//   Pile. At the end of the turn, return all Abilities deleted by this
//   effect to their original Ability Zones."
//
//  ALS RULINGS (24.9.):
//   • EIN Vorgang = EIN Ausloeser. Adventurousness (Action UND Aktiv-
//     effekt einer Ability) loest einmal aus. Create Illusion dagegen
//     sind ZWEI Vorgaenge (der Spell ist eine Aktion, das Platzieren ein
//     eigenes Ereignis) — zwei Ausloeser.
//   • „Performs an Action" zaehlt Reactions mit, das Aktivieren einer
//     Surprise nicht.
//   • ALLE Abilities, auch solche in Support Zones (Xal, Xalibur, Cloak
//     of Edge) — sie kehren in genau diese Support Zone zurueck.
//   • Eine Kopie je Ausloeser (Stufe −1).
//   • EINE KARTE = HOECHSTENS EIN AUSLOESER (Als Ruling 24.9.). Resilient
//     Monkee wird platziert UND ist eine Zusatzaktion — einmal. Create
//     Illusion loest zweimal aus, aber nur, weil die platzierte Creature
//     eine ZWEITE Karte ist. Umgesetzt ueber einen Merker an der
//     Creature-Instanz (`_guillotineZug`), den Platzieren und Aktion
//     beide setzen und beide pruefen.
//   • Surprise-Creatures, die sich selbst platzieren (Jumper Spider &
//     Co.), zaehlen als Platzieren (`onSurpriseCreaturePlaced`) — das
//     Aktivieren der Surprise selbst weiterhin nicht.
//
//  DIE HOOKS — und warum jeder Vorgang genau einmal zaehlt:
//   • `onAnyActionResolved` — NUR Attack/Spell/Creature. Aktionen, die
//     ein Helden- oder Ability-Effekt sind, meldet ZUSAETZLICH
//     `onActiveEffectUsed`; die zaehlen dort, einmal.
//   • `onReactionResolved` — Reaction-Attacks/-Spells/-Creatures.
//   • `onActiveEffectUsed` (v1349) — Helden- und Ability-Aktiveffekte,
//     mit und ohne Aktionskosten.
//   • `onCardEnterZone` mit `_isPlacement` — eine Creature wird in eine
//     Support Zone des Gegners platziert.
//
//  DER ZUSTAND (Verwahrung, Siegel, Rueckkehr) liegt NICHT hier, sondern
//  in `_ability-verwahrung-shared.js` + Engine: er muss weiterlaufen, wenn
//  Madame im selben Zug faellt oder stummgeschaltet wird.
// ═══════════════════════════════════════════
const { hasCardType } = require('./_hooks');
const { verwahren } = require('./_ability-verwahrung-shared');

const CARD_NAME = 'Madame Guillotine, the Great Equalizer';
const SCHULEN = new Set(['Fighting', 'Destruction Magic', 'Decay Magic', 'Support Magic', 'Magic Arts', 'Summoning Magic']);

/** Hat DIESE Creature-Instanz in diesem Zug schon ausgeloest? Setzt den Merker. */
function karteSchonGezaehlt(engine, inst) {
  if (!inst || typeof inst !== 'object') return false;
  const zug = engine.gs.turn || 0;
  if (inst._guillotineZug === zug) return true;
  inst._guillotineZug = zug;
  return false;
}

/** Laeuft der Zug des Gegners, und ist der Ausloeser der Gegner? */
function gegnerHandelt(ctx, spieler) {
  const pi = ctx.cardOwner;
  const opp = pi === 0 ? 1 : 0;
  return ctx._engine.gs.activePlayer === opp && spieler === opp;
}

async function fallbeil(ctx, anlass) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const opp = pi === 0 ? 1 : 0;
  if (gs.result) return;
  // v1375: Abilities eines temporaer gesteuerten Helden sind unberuehrbar
  // (Love-Shot-Errata) — sie stehen gar nicht erst zur Wahl.
  const ziele = engine.getAbilityTargets(opp).filter(t =>
    !(t.zoneKind === 'ability' || t.type === 'ability')
    || !engine.istTemporaerGesteuert(gs.players[t.owner]?.heroes?.[t.heroIdx]));
  if (ziele.length === 0) return;                 // Leerlauf: kein Auftritt

  const ids = await engine.promptEffectTarget(pi, ziele, {
    title: CARD_NAME, source: CARD_NAME,
    description: `Your opponent ${anlass}. Choose an Ability attached to one of their Heroes and delete it until the end of the turn.`,
    confirmLabel: '⚔️ Execute!', confirmClass: 'btn-danger',
    maxTotal: 1, cancellable: false,
  });
  const gewaehlt = ziele.find(t => t.id === (ids || [])[0]) || ziele[0];
  if (!gewaehlt) return;

  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
  const heldName = gs.players[opp]?.heroes?.[gewaehlt.heroIdx]?.name || null;
  engine._broadcastEvent('play_zone_animation', {
    type: 'guillotine_drop', owner: opp, heroIdx: gewaehlt.heroIdx, zoneSlot: gewaehlt.slotIdx,
    ...(gewaehlt.zoneKind === 'support' ? {} : { zoneType: 'ability' }),
  });
  await engine._delay(520);
  const ok = await verwahren(engine, gewaehlt, { quelle: CARD_NAME, quelleBesitzer: pi });
  if (ok) {
    engine.log('guillotine_delete', {
      player: gs.players[pi]?.username, card: CARD_NAME,
      target: gewaehlt.cardName, hero: heldName,
    });
  }
  engine.sync();
}

/** CPU: die Kopie, deren Verlust dem Gegner in diesem Zug am meisten schadet. */
function cpuWahl(engine, ziele) {
  let best = null, bestWert = -Infinity;
  for (const t of ziele) {
    const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    let wert = 0;
    if (hero?.name && hero.hp > 0) wert += 10;                 // lebender Held handelt noch
    if (SCHULEN.has(t.cardName)) wert += 4;                    // Zauberschule: sperrt Karten
    wert += (t.level || 1);                                    // hohe Stufe = hohe Karten
    if ((t.level || 1) === 1) wert += 1.5;                     // letzte Kopie: Schule ganz weg
    if (wert > bestWert) { bestWert = wert; best = t; }
  }
  return best;
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onAnyActionResolved: async (ctx) => {
      if (!gegnerHandelt(ctx, ctx.playerIdx)) return;
      const t = String(ctx.actionType || '');
      if (t !== 'spell' && t !== 'attack' && t !== 'creature') return;
      if (t === 'creature' && karteSchonGezaehlt(ctx._engine, ctx.playedCard)) return;
      await fallbeil(ctx, 'performed an Action');
    },
    onReactionResolved: async (ctx) => {
      if (!gegnerHandelt(ctx, ctx.playerIdx)) return;
      const t = String(ctx.actionType || '');
      if (t !== 'spell' && t !== 'attack' && t !== 'creature') return;
      await fallbeil(ctx, 'performed an Action');
    },
    onActiveEffectUsed: async (ctx) => {
      if (!gegnerHandelt(ctx, ctx.playerIdx)) return;
      await fallbeil(ctx, ctx.kind === 'hero' ? "used a Hero's active effect" : "used an Ability's active effect");
    },
    onCardEnterZone: async (ctx) => {
      if (!ctx._isPlacement || ctx.toZone !== 'support' || ctx._verwahrungRueckkehr) return;
      const inst = ctx.enteringCard;
      if (!inst || inst.faceDown) return;
      const seite = inst.controller ?? inst.owner;
      if (!gegnerHandelt(ctx, seite)) return;
      const cd = ctx._engine.getEffectiveCardData?.(inst) || ctx._engine._getCardDB()[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;
      if (karteSchonGezaehlt(ctx._engine, inst)) return;
      await fallbeil(ctx, 'placed a Creature');
    },
    // Surprise-Creature platziert sich selbst (Jumper Spider, Pure Advantage
    // Camel …): der Engine-Zweig feuert dafuer kein `_isPlacement`, aber
    // diesen eigenen Hook.
    onSurpriseCreaturePlaced: async (ctx) => {
      const inst = ctx.cardInstance;
      if (!gegnerHandelt(ctx, ctx.surpriseOwner)) return;
      if (karteSchonGezaehlt(ctx._engine, inst)) return;
      await fallbeil(ctx, 'placed a Creature');
    },
  },

  cpuResponse(engine, kind, p) {
    if (kind !== 'effectTarget') return undefined;
    const quelle = p?.config?.source || p?.config?.title || p?.source || p?.title;
    if (quelle !== CARD_NAME) return undefined;
    const best = cpuWahl(engine, (p.validTargets || []).filter(t => !t.ineligible));
    return best ? [best.id] : undefined;
  },
};
