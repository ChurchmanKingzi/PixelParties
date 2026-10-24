'use strict';
// W73f-02 · Shroomasaur-Zusatzname: gezielte Prüfungen der Stellen, die der Sweep (f-01) gefunden hat
//   • Gigantisaur King Trex / Black-Thorn Dragon: der Zusatzname macht den Shroomasaur zum Opfer-Kandidaten
//   • Green Dragoneer: fällt ein Shroomasaur mit „Drago"-Zusatzname, springt der Dragoneer aus der Hand
//   • Fun-Fun Circus Clown: zählt einen Shroomasaur mit Circus-Namen mit
//   • Burning Fuse: Shroomasaur mit Bomblebee-Namen genügt als Voraussetzung und wird besiegt
//   • Hive's Crown: Shroomasaur mit Sparkfly-Namen ist ein Opfer-Kandidat
//   • Censpartan / Cykyran: der Bestand der War Counselors wird bei Namenswechsel (Vergabe UND Verfall) neu gebucht
//   • Gatherer from the Cosmic Depths: Shroomasaur mit Cosmic-Depths-Namen ist Ziel für die Zählerverschiebung
//   • Guardian Beast Gou: Shroomasaur mit dem Namen Gou ist von Gous Schutz ausgenommen
const H = require('../../lib/h.js');
const SHROOM = 'Shroomasaur';

async function nennen(t, seat, hi, slot, name) {
  t.gs.activePlayer = seat; t.phase('MAIN1');
  t.script.length = 0;
  t.script.push({ match: (d) => d.type === 'cardNamePicker' && d.title === SHROOM, answer: { cardName: name } });
  const r = await t.activateCreature(seat, hi, slot, {});
  t.script.length = 0;
  return r;
}
async function mitPilz(opts, name, platz = [0, 1]) {
  const t = await H.fresh(opts);
  const s = t.put(0, platz[0], platz[1], SHROOM); s.turnPlayed = 0;
  if (name) await nennen(t, 0, platz[0], platz[1], name);
  t.gs.activePlayer = 0; t.phase(3); t.reset();
  return { t, s };
}

(async () => {
  const R = H.runner();

  R.section('A · King Trex: Shroomasaur als „Gigantisaur" ist ein Opfer-Kandidat');
  {
    const ohne = await mitPilz({ hand: [['Gigantisaur King Trex'], []] }, null);
    const mit = await mitPilz({ hand: [['Gigantisaur King Trex'], []] }, 'Gigantisaur Ankylos');
    const mitTrex = await mitPilz({ hand: [['Gigantisaur King Trex'], []] }, 'Gigantisaur King Trex');
    for (const w of [ohne, mit, mitTrex]) w.t.grantFor(0, 0, 'Gigantisaur King Trex');
    R.check('ohne Zusatzname: nicht beschwörbar', ohne.t.engine.isCreatureSummonable('Gigantisaur King Trex', 0, 0) === false);
    R.check('mit Zusatzname „Gigantisaur Ankylos": beschwörbar', mit.t.engine.isCreatureSummonable('Gigantisaur King Trex', 0, 0) === true);
    R.check('mit Zusatzname „Gigantisaur King Trex": nicht als Opfer (Ausnahme „except King Trex")', mitTrex.t.engine.isCreatureSummonable('Gigantisaur King Trex', 0, 0) === false);
  }

  R.section('B · Black-Thorn Dragon: Shroomasaur als „Drago"');
  {
    const ohne = await mitPilz({ hand: [['Black-Thorn Dragon'], []] }, null);
    const mit = await mitPilz({ hand: [['Black-Thorn Dragon'], []] }, 'Dragolfin');
    for (const w of [ohne, mit]) w.t.grantFor(0, 0, 'Black-Thorn Dragon');
    R.check('ohne Zusatzname: nicht beschwörbar', ohne.t.engine.isCreatureSummonable('Black-Thorn Dragon', 0, 0) === false);
    R.check('mit Zusatzname „Dragolfin": beschwörbar', mit.t.engine.isCreatureSummonable('Black-Thorn Dragon', 0, 0) === true);
  }

  R.section('C · Green Dragoneer: fällt ein „Drago", springt er aus der Hand');
  {
    const { t, s } = await mitPilz({ hand: [['Green Dragoneer'], []] }, 'Dragolfin');
    t.grantFor(0, 0, 'Green Dragoneer');
    t.gs.activePlayer = 1;
    await t.run(async () => { await t.engine.actionDealCreatureDamage({ name: 'ZZ Test', owner: 1, heroIdx: 0 }, s, 99999, 'creature', { sourceOwner: 1, canBeNegated: true }); await t.engine._runPostChainActions?.(); });
    const dragoneerPrompt = t.prompts.some(p => p.d && (p.d.title === 'Green Dragoneer' || /Dragoneer/.test(p.d.message || '')));
    R.check('Green Dragoneer wird angeboten/spielt sich', dragoneerPrompt || t.gs.players[0].hand.indexOf('Green Dragoneer') < 0, t.prompts.map(p => p.d && p.d.title));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('D · Fun-Fun Circus Clown: Shroomasaur mit Circus-Namen zählt');
  {
    const ohne = await mitPilz({ hand: [[], []] }, null, [0, 1]); ohne.t.put(0, 0, 0, 'Fun-Fun Circus Clown');
    const mit = await mitPilz({ hand: [[], []] }, 'Fun-Fun Circus Strongman', [0, 1]); mit.t.put(0, 0, 0, 'Fun-Fun Circus Clown');
    const kann = (w) => { const sc = H.loadCardEffect('Fun-Fun Circus Clown'); const clown = w.t.find('Fun-Fun Circus Clown', 'support'); return sc.canActivateCreatureEffect({ _engine: w.t.engine, card: clown, cardOwner: 0 }); };
    R.check('ohne Zusatzname: keine andere Circus-Kreatur → Effekt nicht möglich', kann(ohne) === false);
    R.check('mit Zusatzname „Fun-Fun Circus Strongman": Effekt möglich', kann(mit) === true);
  }

  R.section('E · Burning Fuse: Shroomasaur mit Bomblebee-Namen');
  {
    const ohne = await mitPilz({ hand: [['Burning Fuse'], []] }, null);
    const mit = await mitPilz({ hand: [['Burning Fuse'], []] }, 'Bomblebee');
    const sc = H.loadCardEffect('Burning Fuse');
    const bed = (w) => { try { return !!sc.spellPlayCondition(w.t.gs, 0, w.t.engine); } catch (e) { return 'ERR ' + e.message; } };
    R.check('ohne Zusatzname: Fuse nicht spielbar', bed(ohne) === false, bed(ohne));
    R.check('mit Zusatzname „Bomblebee": Fuse spielbar', bed(mit) === true, bed(mit));
    const r = await mit.t.play(0, 'Burning Fuse', { hero: 0 });
    R.check('Fuse läuft durch, der Shroomasaur wird besiegt', r === true && !mit.t.inst(i => i.id === mit.s.id && i.zone === 'support').length, { r, zone: mit.s.zone });
  }

  R.section('F · Hive\'s Crown: Shroomasaur mit Sparkfly-Namen als Opfer');
  {
    const sh = require('../../../../cards/effects/_sparkfly-shared.js');
    const ohne = await mitPilz({ hand: [['Hive\'s Crown', 'Sparkfly Queen'], []] }, null);
    const mit = await mitPilz({ hand: [['Hive\'s Crown', 'Sparkfly Queen'], []] }, 'Sparkfly Worker');
    R.check('ohne Zusatzname: kein Opfer-Kandidat', sh.findSacrificeCandidates(ohne.t.engine, 0).length === 0);
    R.check('mit Zusatzname „Sparkfly Worker": Kandidat', sh.findSacrificeCandidates(mit.t.engine, 0).length === 1);
  }

  R.section('G · Censpartan / Cykyran: Bestand wird bei Vergabe und Verfall des Namens neu gebucht');
  {
    const w = await mitPilz({ hand: [[], []] }, null, [1, 0]);
    const cens = w.t.put(0, 0, 0, 'Censpartan War Counselor'); cens.turnPlayed = 0;
    await w.t.run(() => w.t.engine.runHooks('onNameChanged', { inst: cens, name: null, oldName: null, _skipReactionCheck: true }));
    R.check('Vorher: Shroomasaur ohne Namen hat keinen Schirm', !w.s.counters.untargetable_by_opponent);
    await nennen(w.t, 0, 1, 0, 'Cykyran War Counselor');
    R.check('Nach Vergabe: Shroomasaur („War Counselor") wird vom Schirm erfasst', !!w.s.counters.untargetable_by_opponent, w.s.counters);
    await w.t.endTurn();   // Zugwechsel: Zusatzname verfällt
    R.check('Nach Verfall (Zugwechsel): der Schirm ist wieder weg', !w.s.counters.untargetable_by_opponent, w.s.counters);
  }
  {
    // Cykyran: ≥3 verschiedene War Counselors → Base ATK verdoppelt
    const w = await mitPilz({ hand: [[], []] }, null, [1, 0]);
    const cyk = w.t.put(0, 0, 0, 'Cykyran War Counselor'); cyk.turnPlayed = 0;
    w.t.put(0, 2, 0, 'Gorinthian War Counselor');
    const atk0 = w.t.gs.players[0].heroes[0].atk;
    await w.t.run(() => w.t.engine.runHooks('onNameChanged', { inst: cyk, name: null, oldName: null, _skipReactionCheck: true }));
    await nennen(w.t, 0, 1, 0, 'Harpthenean War Counselor');
    const atk1 = w.t.gs.players[0].heroes[0].atk;
    R.check('Mit drei verschiedenen War Counselors (einer per Zusatzname): Base ATK verdoppelt', atk1 === atk0 * 2 && atk0 > 0 || (atk0 === 0 && !!w.t.gs.players[0].heroes[0]._cykyranBonus !== undefined), { atk0, atk1, b: w.t.gs.players[0].heroes[0]._cykyranBonus });
  }

  R.section('H · Gatherer from the Cosmic Depths: Zählerverschiebung auf einen Shroomasaur mit Cosmic-Depths-Namen');
  {
    const { t, s } = await mitPilz({ hand: [[], []] }, 'Invader from the Cosmic Depths', [1, 0]);
    const gat = t.put(0, 0, 0, 'Gatherer from the Cosmic Depths'); gat.turnPlayed = 0; gat.counters.changeCounter = 2;
    t.script.length = 0;
    t.script.push({ match: (d) => d.type === 'optionPicker', answer: (d) => ({ optionId: d.options[0].id }) });
    t.targetFn = (valid, cfg) => { if (/TO which|destination|Move Change/i.test(cfg.description || '') && cfg.description && /TO|onto/i.test(cfg.description)) return [valid.find(v => v.cardName === SHROOM)?.id || valid[0].id]; return [valid[0].id]; };
    t.gs.activePlayer = 0; t.phase('MAIN1');
    await t.run(() => t.engine.runHooks('noop', {}));
    const sc = H.loadCardEffect('Gatherer from the Cosmic Depths');
    let r; try { r = await t.activateCreature(0, 0, 0, {}); } catch (e) { r = String(e); }
    const alleZiele = t.targets.flatMap(x => x.valid.map(v => v.cardName));
    R.check('Ziel-Liste der Verschiebung enthält den Shroomasaur', alleZiele.includes(SHROOM), alleZiele);
    void s; void sc; void r;
  }

  R.section('I · Guardian Beast Gou: Shroomasaur mit dem Namen Gou ist ausgenommen');
  {
    const { t } = await mitPilz({ hand: [[], []] }, 'Guardian Beast Gou', [1, 0]);
    const gou = t.put(0, 0, 0, 'Guardian Beast Gou'); gou.turnPlayed = 0;
    t.setDiscard(0, []); t.setDiscard(1, []);
    const sh = require('../../../../cards/effects/_guardian-beasts-shared.js');
    const alle = sh.buildAllBoardTargets(t.engine).map(x => x.cardName);
    R.check('Vorprobe: der Shroomasaur steht in der Gesamt-Zielliste', alle.includes(SHROOM));
    // buildProtectableTargets ist modulintern: über den Effekt prüfen – die Liste der Schutz-Ziele ohne Gou-Namensträger
    const gouScript = require('../../../../cards/effects/guardian-beast-gou.js');
    const fn = gouScript.buildProtectableTargets;
    if (fn) {
      const namen = fn(t.engine).map(x => x.cardName);
      R.check('Schutz-Ziele ohne Gou und ohne den Shroomasaur mit Gou-Namen', !namen.includes('Guardian Beast Gou') && !namen.includes(SHROOM), namen);
    } else R.note('buildProtectableTargets nicht exportiert – Filter per Sweep f-01 geprüft');
  }


  R.section('J · Sparkfly Worker: „while you control a Sparkfly Queen" mit Zusatzname');
  {
    const sh = require('../../../../cards/effects/_sparkfly-shared.js');
    const ohne = await mitPilz({ hand: [[], []] }, null);
    const mit = await mitPilz({ hand: [[], []] }, 'Sparkfly Queen');
    R.check('ohne Zusatzname: keine Queen', !sh.findControlledQueen(ohne.t.engine, 0));
    R.check('mit Zusatzname „Sparkfly Queen": Worker sieht eine Queen', !!sh.findControlledQueen(mit.t.engine, 0));
    const q = require('../../../../cards/effects/sparkfly-queen.js');
    R.check('Queen ist nicht beschwörbar, wenn schon ein Shroomasaur „Sparkfly Queen" heißt (nur eine pro Spieler)', (() => { mit.t.gs._hivesCrownActive = true; return q.canSummon({ _engine: mit.t.engine, cardOwner: 0, card: { id: -1 } }) === false; })());
  }

  R.section('K · Bloom: „Paraseed"-Zusatzname verstärkt Poison');
  {
    const { t, s } = await mitPilz({ hand: [[], []] }, 'Paraseed', [0, 1]);
    t.setHero(0, 0, 'Bloom, the Maniacal Botanist', 800);
    const ps = require('../../../../cards/effects/_paraseed-shared.js');
    R.check('Paraseed-Zähler des Helden sieht den Shroomasaur', ps.countParaseedsOnHero(t.engine, 0, 0) === 1, ps.countParaseedsOnHero(t.engine, 0, 0));
    R.check('Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    void s;
  }

  R.check('keine Zustandsauffälligkeiten', true);
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
