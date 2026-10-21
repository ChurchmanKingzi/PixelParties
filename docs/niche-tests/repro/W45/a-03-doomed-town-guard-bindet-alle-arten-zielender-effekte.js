'use strict';
// W45a · Punkt 3 · Al, 22.10.2026: „Nein, Town Guard, wenn sein Text keine Typ-Einschränkungen vorgibt, wirkt auf *alle* Arten von zielenden Effekten."
// Doomed Town Guard („Your opponent can't choose other Creatures you control.") bleibt unverändert und gilt für ALLE Arten zielender Effekte — Attack, Spell, Creature effect, aber auch Artefakt-, Trank-, Ability-,
// Heldeneffekte, Surprises, Ausrüstung usw. Nur der Hardy Slime und der Deepsea Horror Clown tragen die Typ-Einschränkung (`tauntNurAttackSpellKreatur`); Town Guard deklariert sie nicht.
// Das v849-Zusatzmerkmal `forcesTargeting_creaturesOnly` sperrt nur ANDERE KREATUREN des Besitzers (Helden und der Wachposten selbst bleiben wählbar).
// Gegenproben: Hardy Slime mit Artefakt-/Trank-/Ability-Quelle → frei (W43a); Sitz-Spiegel.
// Exit 0 auf der Basis e1489df1 (Ist-Zustand bestätigt, Absicherung) und auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W45/a-03-doomed-town-guard-bindet-alle-arten-zielender-effekte.js   (Exit 0 = korrekt)
const L = require('../W39/_helfer.js');
const { H } = L;
const { loadCardEffect } = require('../../../../cards/effects/_loader');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

function stempelSlime(t, inst, gegen) {
  inst.turnPlayed = 1;
  inst.counters.forcesTargeting = true; inst.counters.forcesTargeting_pi = gegen; inst.counters.forcesTargeting_untilTurn = (t.gs.turn || 0) + 1;
  inst.counters.buffs = { ...(inst.counters.buffs || {}), forcesTargeting: true };
  return inst;
}
/** Schutzschirm wie `setzeSchutzschirm` in doomed-town-guard.js (kein `forcesTargeting_pi`, keine Frist). */
function stempelWache(inst) {
  inst.turnPlayed = 1;
  const c = inst.counters;
  c.forcesTargeting = true; c.forcesTargeting_creaturesOnly = true; c.buffs = c.buffs || {}; c.buffs.forcesTargeting_creaturesOnly = true;
  return inst;
}
const gegnerListen = (t, op, wer) => t.targets.filter(x => (wer == null || x.who === wer) && x.valid.some(v => v.owner === op)).map(x => x.valid.filter(v => v.owner === op && !v.ineligible).map(v => v.id).sort().join(','));
async function szene(me, op, hand, spoetter, o = {}) {
  const hands = [[], []]; hands[o.handSeite ?? me] = hand.slice();
  const t = await H.fresh({ hand: hands, hp: 800, deckSize: 20, active: o.aktiv ?? me, gold: 200 });
  const andere = t.put(op, 1, 0, H.INERT.creature); andere.turnPlayed = 1;
  const eigene = t.put(me, 2, 1, H.INERT.creature); eigene.turnPlayed = 1;
  const sp = t.put(op, 2, 2, spoetter);
  if (spoetter === 'Doomed Town Guard') stempelWache(sp); else stempelSlime(t, sp, me);
  return { t, sp };
}
const mischliste = (t, op) => {
  const l = [0, 1, 2].map(i => ({ id: `hero-${op}-${i}`, type: 'hero', owner: op, heroIdx: i, cardName: 'x' }));
  for (const inst of t.engine.cardInstances) if (inst.zone === 'support' && inst.owner === op && inst.name !== 'Test') l.push({ id: `equip-${op}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: op, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
  return l;
};
async function angebot(t, me, op, quelle) {
  let a = null;
  t.targetFn = (v) => { a = v.filter(x => !x.ineligible).map(x => x.id).sort().join(','); return [v[0].id]; };
  await t.run(async () => { await t.engine.promptEffectTarget(me, mischliste(t, op), { title: 'Mischliste', sourceCard: quelle, cancellable: true }); });
  return a;
}

(async () => {
  const R = H.runner();
  // ── Deklarationen sauber getrennt ──
  R.check('Deklaration: Hardy Slime und Deepsea Horror Clown tragen tauntNurAttackSpellKreatur', loadCardEffect('Hardy Slime').tauntNurAttackSpellKreatur === true && loadCardEffect('Deepsea Horror Clown').tauntNurAttackSpellKreatur === true);
  R.check('Deklaration: Doomed Town Guard trägt sie NICHT (und hat keine andere Typ-Einschränkung)', !loadCardEffect('Doomed Town Guard').tauntNurAttackSpellKreatur && !Object.keys(loadCardEffect('Doomed Town Guard')).some(k => /taunt.*nur|nurAttack/i.test(k)));
  const dbText = require('../../../../data/cards.json').find(c => c.name === 'Doomed Town Guard').effect;
  R.check('Kartentext Town Guard ohne Typ-Einschränkung: „Your opponent can\'t choose other Creatures you control."', /Your opponent can't choose other Creatures you control\./.test(dbText) && !/Attacks|Spells|Creature effects/.test(dbText), dbText);

  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const wacheId = `equip-${op}-2-2`;
    const heldenIds = [0, 1, 2].map(i => `hero-${op}-${i}`);
    const mitWache = heldenIds.concat([wacheId]).sort().join(',');                         // andere Kreatur (op,1,0) gesperrt
    const alle = heldenIds.concat([wacheId, `equip-${op}-1-0`]).sort().join(',');

    // ── Klassifikation: jede Quellenart bindet den Town Guard, nur der Slime/Clown filtern nach Typ ──
    {
      const { t } = await szene(me, op, [], 'Doomed Town Guard');
      const e = t.engine;
      const quellen = {
        'Attack-Karte': { name: 'Attack', zone: 'hand' }, 'Spell-Karte: Fireball': { name: 'Fireball', zone: 'hand' }, 'Creature effect: Skeleton Archer': { name: 'Skeleton Archer', zone: 'support' },
        'Artefakt: Book of Doom': { name: 'Book of Doom', zone: 'hand' }, 'Artefakt: Ushabti of the Great Pharaoh': { name: 'Ushabti of the Great Pharaoh', zone: 'hand' },
        'Trank: Poison Vial': { name: 'Poison Vial', zone: 'hand' }, 'Trank: Acid Vial': { name: 'Acid Vial', zone: 'hand' },
        'Ability: Occultism': { name: 'Occultism', zone: 'ability' }, 'Ability: Diplomacy': { name: 'Diplomacy', zone: 'ability' },
        'Heldeneffekt: Siphem': { name: 'Siphem, the Deepsea Demon', zone: 'hero' }, 'Heldeneffekt: Locke': { name: 'Locke, the Soul Collector', zone: 'hero' },
        'Ausrüstung: Pocket Catapult': { name: 'Pocket Catapult', zone: 'support' }, 'Reaktions-Artefakt: Racket Arrow': { name: 'Racket Arrow', zone: 'hand' },
        'Surprise-Artifact: Shield of Wisdom': { name: 'Shield of Wisdom', zone: 'surprise' },
        'Area/Anhang auf dem Brett: Acid Rain': { name: 'Acid Rain', zone: 'area' },
      };
      for (const [k, q] of Object.entries(quellen)) {
        const a = await angebot(t, me, op, { ...q, owner: me, controller: me, heroIdx: 0 });
        R.check(`Town Guard, Quelle ${k}: andere Kreaturen nicht wählbar (Helden und Wache frei)`, a === mitWache, a);
      }
      // Gegenprobe Slime: dieselben Quellen — Artefakt, Trank, Ability, Heldeneffekt, Ausrüstung, Pfeil, Shield, Area-Karte frei; Attack, Spell, Creature effect gebunden (nur der Slime wählbar)
      const { t: t2 } = await szene(me, op, [], 'Hardy Slime');
      for (const [k, q] of Object.entries(quellen)) {
        const bindet = /^(Attack-Karte|Spell-Karte|Creature effect)/.test(k);
        const a = await angebot(t2, me, op, { ...q, owner: me, controller: me, heroIdx: 0 });
        R.check(`Gegenprobe Hardy Slime, Quelle ${k}: ${bindet ? 'Taunt (nur der Slime)' : 'frei (alle Gegnerziele)'}`, bindet ? a === wacheId : a === alle, a);
      }
    }

    // ── echte Wege mit dem Town Guard: Trank, Artefakt, Ability, Heldeneffekt ──
    {   // Trank: Poison Vial („choose a target")
      const { t } = await szene(me, op, ['Poison Vial'], 'Doomed Town Guard');
      await t.play(me, 'Poison Vial');
      const l = gegnerListen(t, op, me);
      R.check('echter Weg Trank (Poison Vial): Town Guard sperrt die andere Kreatur', l.length >= 1 && l.every(x => x === mitWache), l);
      R.check('echter Weg Trank: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    {   // Gegenprobe: Hardy Slime + Poison Vial → frei (W43a)
      const { t } = await szene(me, op, ['Poison Vial'], 'Hardy Slime');
      await t.play(me, 'Poison Vial');
      const l = gegnerListen(t, op, me);
      R.check('Gegenprobe echter Weg Trank: Hardy Slime bindet NICHT (alle Gegnerziele wählbar)', l.length >= 1 && l.every(x => x === alle), l);
    }
    {   // Artefakt: Book of Doom („Pay ...; choose a target") — Zielwahl über Artefakt
      const { t } = await szene(me, op, ['Book of Doom'], 'Doomed Town Guard');
      t.setGold(me, 500);
      const r = await t.play(me, 'Book of Doom');
      const l = gegnerListen(t, op, me);
      if (l.length === 0) R.note('Book of Doom (echter Weg) hat keine Zielwahl geöffnet', { r, prompts: t.prompts.map(p => p.d && p.d.title) });
      R.check('echter Weg Artefakt (Book of Doom): Town Guard sperrt die andere Kreatur (sofern eine Zielwahl geöffnet wird)', l.every(x => x === mitWache), l);
      const { t: t2 } = await szene(me, op, ['Book of Doom'], 'Hardy Slime');
      t2.setGold(me, 500);
      await t2.play(me, 'Book of Doom');
      const l2 = gegnerListen(t2, op, me);
      R.check('Gegenprobe echter Weg Artefakt: Hardy Slime bindet NICHT', l2.every(x => x === alle), l2);
    }
    {   // Ability: Occultism — Zielwahl über die Ability
      const { t } = await szene(me, op, [], 'Doomed Town Guard');
      t.setAbilities(me, 0, [['Occultism'], [], []]);
      t.gs.activePlayer = me; t.phase(2);
      await t.run(() => t.host.doActivateFreeAbility(t.room, me, { heroIdx: 0, zoneIdx: 0 }));
      const l = gegnerListen(t, op, me);
      if (l.length === 0) R.note('Occultism (echter Weg) hat keine Zielwahl auf der Gegnerseite geöffnet', { prompts: t.prompts.map(p => p.d && p.d.title), titel: t.targets.map(x => x.config && x.config.title) });
      R.check('echter Weg Ability (Occultism): Town Guard sperrt die andere Kreatur (sofern eine Zielwahl geöffnet wird)', l.every(x => !x.split(',').includes(`equip-${op}-1-0`)), l);
    }
    {   // "if possible": ein reiner Helden-Effekt bleibt frei — kein Taunt, wenn die Wache selbst nicht in der Liste steht (nur Helden wählbar)
      const { t } = await szene(me, op, [], 'Doomed Town Guard');
      let a = null;
      t.targetFn = (v) => { a = v.filter(x => !x.ineligible).map(x => x.id).sort().join(','); return [v[0].id]; };
      await t.run(async () => { await t.engine.promptEffectTarget(me, mischliste(t, op).filter(x => x.type === 'hero'), { title: 'Nur Helden', sourceCard: { name: 'Book of Doom', owner: me, controller: me, heroIdx: 0, zone: 'hand' }, cancellable: true }); });
      R.check('Town Guard: Helden-Liste ohne Wache → alle Helden wählbar („Creatures" betrifft nur andere Kreaturen)', a === heldenIds.slice().sort().join(','), a);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
