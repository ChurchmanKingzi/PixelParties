'use strict';
// W63a-05 · Bewegen in geteilte Zonen, Teil 2 (Al, 22.10.2026, Rueckfrage 4 aus Welle 62): Memory Blast, Jumper Spider, Paraseed Greenhouse, Puppets, kein On-Summon
//
// Al: „Solange der Effekt aktiv ist, darf eine Creature auch IN eine geteilte Zone bewegt werden … Puppets bleiben unbeweglich. Bewegen loest nie On-Summon aus."
// Szene (je Sitz): Held 0 / Zone A = [X]; alle uebrigen Zonen voll (volles Brett); Held 1 = Alice.
//   1 Memory Blast       Eine ehemals MEINE Kreatur X beim Gegner (originalOwner = ich): „permanently regain control" → sie kehrt in die geteilte Zone A zurueck (Stapel x2), ohne Alice: Brett voll → nichts
//   2 Jumper Spider      Beim Zugbeginn holt sich die Zugspielerin die gegnerische Jumper Spider in die Zone ihrer eigenen Spinne (Stapel x2); ohne Alice: bleibt beim Gegner
//   3 kein On-Summon     Die Transfers rufen `onPlay`/On-Summon nicht auf (`_isMove`)
//   4 Puppet             actionMoveCard eines Puppets in eine andere Zone bleibt blockiert (auch mit Alice)
//   5 Paraseed Greenhouse  Umzug einer Paraseed in die Zone einer gleichnamigen Paraseed eines anderen Helden: angeboten (shared), Stapel x2, Quelle leer
// Beide Sitze. Exit 0 = korrekt.
const L = require('../../lib/alice-brett.js');
const { H, brett, zoneA, instIn, ohneStapel, gesamt, sicher } = L;
const CB = 'Cute Bunny';
const sauber = (t) => t.errors.length === 0 && ohneStapel(t).length === 0;

(async () => {
  const R = H.runner();
  for (const s of [0, 1]) {
    const g = 1 - s;
    // ── 1 · Memory Blast ────────────────────────────────────────────────────────────────────────
    for (const alice of [true, false]) {
      R.section(`Sitz ${s}: Memory Blast holt meine Kreatur zurueck — ${alice ? 'mit' : 'ohne'} Alice (volles Brett)`);
      const t = await brett(s, { hand: ['Memory Blast'], alice, fuellen: true, zonen: [[CB]] });
      t.setAbilities(s, 0, [['Destruction Magic', 'Destruction Magic'], [], []]);
      const beute = t.put(g, 0, 0, CB); beute.turnPlayed = 1;
      beute.originalOwner = s;   // vom Gegner (dauerhaft) uebernommen: Kontrolle und Besitz beim Gegner, ursprünglicher Eigentümer ich
      t.targetFn = (valid) => { const v = valid.find(q => q.type === 'equip' && q.owner === g && q.heroIdx === 0 && q.slotIdx === 0) || valid[0]; return [v.id]; };
      const vor = gesamt(t, s);
      const r = await t.play(s, 'Memory Blast', { hero: 0 });
      if (alice) {
        R.check('Zauber wird gespielt', r === true, sicher(r));
        R.check('die Kreatur steht jetzt im Stapel von Zone A (x2, 2 Instanzen bei Sitz)', zoneA(t, s).length === 2 && instIn(t, s, 0, 0, CB) === 2, { a: zoneA(t, s), pos: [beute.owner, beute.heroIdx, beute.zoneSlot] });
        R.check('die Zone beim Gegner ist leer', zoneA(t, g).length === 0 && instIn(t, g, 0, 0) === 0, zoneA(t, g));
        R.check('Kontrolle und Besitz wieder bei mir', beute.owner === s && beute.controller === s, [beute.owner, beute.controller]);
        R.check('genau eine Kreatur mehr auf meiner Seite', gesamt(t, s) === vor + 1, { vor, nach: gesamt(t, s) });
      } else {
        R.check('ohne Alice und ohne freie Zone passiert nichts (Kreatur bleibt beim Gegner, Zone A unveraendert)', zoneA(t, s).length === 1 && beute.heroIdx === 0 && gesamt(t, s) === vor, { r: sicher(r), a: zoneA(t, s) });
      }
      R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
    }

    // ── 2 · Jumper Spider ───────────────────────────────────────────────────────────────────────
    for (const alice of [true, false]) {
      R.section(`Sitz ${s}: Jumper Spider wechselt beim Zugbeginn die Seite — ${alice ? 'mit' : 'ohne'} Alice (volles Brett)`);
      const JS = 'Jumper Spider';
      const t = await brett(s, { alice, fuellen: true, zonen: [[JS]] });
      const fremd = t.put(g, 0, 0, JS); fremd.turnPlayed = 1;
      t.engine.isCpuPlayer = () => false;
      let onPlayGerufen = 0;
      const hook0 = t.engine.runHooks.bind(t.engine);
      t.engine.runHooks = (name, ctx, ...rest) => { if (name === 'onPlay' && ctx && ctx.card && ctx.card.id === fremd.id) onPlayGerufen++; return hook0(name, ctx, ...rest); };
      await t.turnStart(s);
      if (alice) {
        R.check('die gegnerische Spinne steht jetzt im Stapel der eigenen (Zone A, x2)', zoneA(t, s).length === 2 && instIn(t, s, 0, 0, JS) === 2, { a: zoneA(t, s), pos: [fremd.owner, fremd.heroIdx, fremd.zoneSlot] });
        R.check('die Zone beim Gegner ist leer, Kontrolle bei der Zugspielerin', zoneA(t, g).length === 0 && (fremd.controller ?? fremd.owner) === s, { g: zoneA(t, g), c: fremd.controller });
        R.check('kein On-Summon (onPlay) beim Seitenwechsel', onPlayGerufen === 0, onPlayGerufen);
      } else {
        R.check('ohne Alice und ohne freie Zone bleibt die Spinne beim Gegner', zoneA(t, s).length === 1 && zoneA(t, g).length === 1, { a: zoneA(t, s), g: zoneA(t, g) });
      }
      R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
    }

    // ── 3 · Puppet bleibt unbeweglich ───────────────────────────────────────────────────────────
    R.section(`Sitz ${s}: Puppet 'Cannot be moved to a different Support Zone' (mit Alice)`);
    {
      const PUP = 'Clever Puppet Saras';
      const t = await brett(s, { fuellen: true, zonen: [[PUP]], extra: [[2, 0, [PUP]]] });
      const quelle = t.inst(c => c.zone === 'support' && c.owner === s && c.heroIdx === 2 && c.zoneSlot === 0)[0];
      await t.run(() => t.engine.actionMoveCard(quelle, 'support', 0, 0, { source: { name: 'Guard Change', owner: s, controller: s } }));
      R.check('Puppet bleibt in seiner Zone (Held 2 / Slot 1), kein Stapel in Zone A', quelle.heroIdx === 2 && quelle.zoneSlot === 0 && zoneA(t, s).length === 1 && zoneA(t, s, 2, 0).length === 1, { pos: [quelle.heroIdx, quelle.zoneSlot], a: zoneA(t, s) });
      R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
    }

    // ── 4 · Paraseed Greenhouse (Umzug) ─────────────────────────────────────────────────────────
    for (const alice of [true, false]) {
      R.section(`Sitz ${s}: Paraseed Greenhouse zieht eine Paraseed in die Zone der gleichnamigen — ${alice ? 'mit' : 'ohne'} Alice (volles Brett)`);
      const PS = 'Paraseed';
      const t = await brett(s, { alice, fuellen: true, hand: [H.INERT.filler], deck: [H.INERT.filler, H.INERT.filler], zonen: [[PS]], extra: [[2, 0, [PS]]] });
      t.putArea(s, 'Paraseed Greenhouse');
      for (const i of t.inst(c => c.name === PS)) i.turnPlayed = 1;
      const quelle = t.inst(c => c.zone === 'support' && c.owner === s && c.heroIdx === 2 && c.zoneSlot === 0)[0];
      const angebote = [];
      t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: H.INERT.filler, handIndex: 0 }) });
      t.targetFn = (valid) => { const v = valid.find(q => q.type === 'equip' && q.owner === s && q.heroIdx === 2 && q.slotIdx === 0); return v ? [v.id] : null; };
      t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { angebote.push(d.zones.map(z => `${z.owner}:${z.heroIdx}/${z.slotIdx}${z.shared ? 's' : ''}`)); const z = d.zones.find(q => q.owner === s && q.heroIdx === 0 && q.slotIdx === 0) || d.zones.find(q => q.owner === g) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
      t.phase(2);
      const r = await t.run(() => t.engine.activateAreaEffect(s, s, 'Paraseed Greenhouse'));
      if (alice) {
        R.check('Zone A wird als geteiltes Ziel angeboten und steht vorn', angebote[0] && angebote[0][0] === `${s}:0/0s`, angebote);
        R.check('die Paraseed steht jetzt im Stapel von Zone A (x2, 2 Instanzen)', zoneA(t, s).length === 2 && instIn(t, s, 0, 0, PS) === 2, { a: zoneA(t, s), r: sicher(r), angebote });
        R.check('Quell-Zone (Held 2 / Slot 1) leer', zoneA(t, s, 2, 0).length === 0 && instIn(t, s, 2, 0) === 0, zoneA(t, s, 2, 0));
        R.check('kein On-Summon (Umzug, kein Beschwoeren): Instanz bleibt dieselbe', quelle.heroIdx === 0 && quelle.zoneSlot === 0, [quelle.heroIdx, quelle.zoneSlot]);
      } else {
        R.check('ohne Alice: Zone A wird nicht angeboten, eigene Seite bleibt unveraendert', !angebote.flat().some(z => z.startsWith(`${s}:0/0`)) && zoneA(t, s).length === 1 && instIn(t, s, 0, 0, PS) === 1, { r: sicher(r), angebote });
      }
      R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('ABSTURZ ' + (e && e.stack) + '\n'); process.exit(1); });
