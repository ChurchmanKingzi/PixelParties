'use strict';
// Skeleton Bard: Zwei Bards derselben Seite dürfen sich nicht gegenseitig als Encore-Ziel prüfen (Rekursion bis zum Stack-Überlauf,
// die das `catch` in eligibleTargets schluckte — baute je Check tausende Kontexte und kostete in CPU-Partien ein Viertel der Rechenzeit).
const test = require('node:test');
const assert = require('node:assert/strict');
const bard = require('../cards/effects/skeleton-bard');

const bardInst = (id, owner = 0) => ({ id, name: 'Skeleton Bard', zone: 'support', owner, controller: owner, heroIdx: 0, zoneSlot: id, counters: {} });

function engineWith(insts) {
  const stats = { contexts: 0 };
  const engine = {
    cardInstances: insts,
    gs: { turn: 3, hoptUsed: {}, players: [{}, {}] },
    _getCardDB: () => ({ 'Skeleton Bard': { cardType: 'Creature', archetype: 'Skeletons' } }),
    isCreatureActiveEffectLocked: () => false,
    isCreatureEffectSuppressed: () => false,
    _createContext(inst) { stats.contexts++; return { _engine: engine, cardOwner: inst.owner, card: inst }; },
  };
  return { engine, stats };
}

test('zwei Skeleton Bards: kein Ziel, keine Rekursion, kein Kontext gebaut', () => {
  const insts = [bardInst(1), bardInst(2)];
  const { engine, stats } = engineWith(insts);
  assert.equal(bard.canActivateCreatureEffect({ _engine: engine, cardOwner: 0, card: insts[0] }), false);
  assert.equal(stats.contexts, 0, 'ein anderer Bard wird gar nicht erst geprüft');
});

test('drei Skeleton Bards, einer davon auf der Gegenseite: weiterhin kein Ziel und kein Stapelüberlauf', () => {
  const insts = [bardInst(1), bardInst(2), bardInst(3), bardInst(4, 1)];
  const { engine, stats } = engineWith(insts);
  for (const inst of insts) assert.equal(bard.canActivateCreatureEffect({ _engine: engine, cardOwner: inst.owner, card: inst }), false);
  assert.equal(stats.contexts, 0);
});

test('onCreatureEffect mit einem zweiten Bard auf dem Brett meldet „nichts getan"', async () => {
  const insts = [bardInst(1), bardInst(2)];
  const { engine } = engineWith(insts);
  const r = await bard.onCreatureEffect({ _engine: engine, cardOwner: 0, card: insts[0] });
  assert.equal(r, false);
});
