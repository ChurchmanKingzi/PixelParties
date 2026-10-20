'use strict';
// W29a · Entscheidung Al (21.10.2026, Antwort auf die offene Webbed-Frage aus W27a): „Webbed negiert NICHT Attachments!" – wie bei Frozen/Stunned/Negated liegen Spell-Anhängsel
// auch bei verwebtem Träger nicht still: das Klick-Tor (getActivatableEquips + doActivateEquipEffect) lässt Prayer bei Frozen, Stunned, Webbed und Negated durch.
// Webbed negiert nur Abilities und das Handeln des Helden selbst. Gegenprobe: eine Ausrüstung mit Klick-Effekt (Cloak of Edge) bleibt bei Frozen/Stunned/Webbed gesperrt.
// Aufruf: node docs/niche-tests/repro/W29/a-03-webbed-negiert-keine-attachments.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [name, status] of [['ohne Status', null], ['gefroren', 'frozen'], ['betäubt', 'stunned'], ['negiert', 'negated'], ['verwebt (Webbed)', 'webbed']]) {
    for (const seat of [0, 1]) {
      R.section(`Prayer (Anhängsel), Träger ${name}, Sitz ${seat}`);
      const t = await H.fresh({ hand: seat === 0 ? [['Prayer', 'Fighting', 'Fighting'], []] : [[], ['Prayer', 'Fighting', 'Fighting']], hp: 800, phase: 2, active: seat });
      t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === seat && v.heroIdx === 0); return [(h || valid[0]).id]; };
      await t.play(seat, 'Prayer', { hero: 0, phase: 3 }); t.phase(2);
      if (status) t.heroStatus(seat, 0, status);
      t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: d.eligibleIndices.map(i => ({ handIndex: i, cardName: t.pile(seat, 'hand')[i] })) }) });
      t.policy.confirm = false;
      const liste = t.engine.getActivatableEquips(seat).filter(e => e.cardName === 'Prayer');
      R.check('getActivatableEquips bietet Prayer an (canActivate)', liste.length === 1 && liste[0].canActivate, liste);
      const hand0 = t.pile(seat, 'hand').length;
      await t.activateEquip(seat, 0, 0);
      const abgeworfen = t.pile(seat, 'discardPile').filter(c => c === 'Fighting').length;
      R.check('Server-Tor: Prayer wirkt (2 Abilities abgeworfen, 2 gezogen)', abgeworfen === 2 && t.pile(seat, 'hand').length === hand0, { abgeworfen, hand: [hand0, t.pile(seat, 'hand').length] });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  for (const [name, status, gesperrt] of [['ohne Status', null, false], ['gefroren', 'frozen', true], ['betäubt', 'stunned', true], ['verwebt (Webbed)', 'webbed', true]]) {
    R.section(`Gegenprobe Ausrüstung (Cloak of Edge), Träger ${name}`);
    const t = await H.fresh({ hand: [[], []], hp: 800, phase: 2 });
    t.put(0, 0, 0, 'Cloak of Edge');
    if (status) t.heroStatus(0, 0, status);
    const atk0 = t.hero(0, 0).atk;
    const liste = t.engine.getActivatableEquips(0).filter(e => e.cardName === 'Cloak of Edge' && e.canActivate);
    R.check(`getActivatableEquips: Cloak of Edge ${gesperrt ? 'nicht aktivierbar' : 'aktivierbar'}`, gesperrt ? liste.length === 0 : liste.length === 1, liste);
    await t.activateEquip(0, 0, 0);
    R.check(`Server-Tor: Cloak of Edge ${gesperrt ? 'bleibt gesperrt (ATK unverändert)' : 'wirkt (+20 ATK)'}`, t.hero(0, 0).atk === (gesperrt ? atk0 : atk0 + 20), { atk0, atk: t.hero(0, 0).atk });
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
