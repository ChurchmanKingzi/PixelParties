'use strict';
// N2-07 · Emergency Spell Armor erkennt einen als Spell geltenden HELDEN-Effekt (Alice) nicht
// Kartentext (Emergency Spell Armor): „Play this Spell immediately when a Hero you control that can use it with more than 1 HP would be defeated by a Spell or Creature effect.
//   Your Hero's current and max HP drop to 1 instead and you may draw 2 cards."
// Kartentext (Alice, the Puppeteer Girl): „… deal 50 damage to it times the number of Creatures you control that were not summoned this turn. This is treated as this Hero hitting the target with a Destruction Magic Spell."
// Ruling Q108 (Welle 12): Alices Effekt gilt als Destruction-Magic-Spell der Stufe 0 (Anti Magic blockt ihn; `engine._spellLevelAlsQuelle`, Skriptvertrag `treatedAsSpell`).
// Erwartung: Ein tödlicher Alice-Treffer auf einen Helden mit Emergency Spell Armor auf der Hand löst die Karte aus (Held bleibt auf 1 HP), wie bei jedem Spell.
// Beobachtet: Kein Fenster, der Held stirbt. Frost Rune, Firewall, Jumpscare und Fireshield erkennen dieselbe Quelle als Spell (`isAttackSpellOrCreatureSource`, damageType '*_spell');
//   emergency-spell-armor.js `spellOrCreatureSource` fragt nur den Kartentyp des Quellnamens in der Kartendatenbank ab (Alice ist dort ein Held).
// Gegenprobe: ein echter Zauber (Burning Finger) löst aus; ein Heldeneffekt ohne Spell-Status (Siphem) löst NICHT aus (richtig).
const H = require('../../lib/h.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} wirkt Alice, Sitz ${op} hält Emergency Spell Armor (Ziel mit 100 HP)`);
    {
      const t = await H.fresh({ hand: me === 0 ? [[], ['Emergency Spell Armor']] : [['Emergency Spell Armor'], []], deckSize: 30 });
      t.grantFor(op, 0, 'Emergency Spell Armor');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.setHero(me, 0, 'Alice, the Puppeteer Girl', 800);
      for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; }
      t.hero(op, 0).hp = 100;
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
      const r = await t.activateHero(me, 0);
      R.check('Alice-Effekt gewirkt (150 Schaden)', r === true, r);
      R.check('Emergency Spell Armor wird angeboten', gefragt(t, 'Emergency Spell Armor') >= 1, gefragt(t, 'Emergency Spell Armor'));
      R.check('Held lebt mit 1 HP (current und max)', t.hp(op, 0) === 1 && t.hero(op, 0).maxHp === 1, [t.hp(op, 0), t.hero(op, 0).maxHp]);
    }
    R.section(`Gegenprobe Sitz ${op}: ein echter Zauber (Burning Finger) löst Emergency Spell Armor aus`);
    {
      const t = await H.fresh({ hand: me === 0 ? [['Burning Finger'], ['Emergency Spell Armor']] : [['Emergency Spell Armor'], ['Burning Finger']], deckSize: 30 });
      t.grantFor(op, 0, 'Emergency Spell Armor');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.hero(op, 0).hp = 100;
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
      await t.play(me, 'Burning Finger', { hero: 0 });
      R.check('Held lebt mit 1 HP', t.hp(op, 0) === 1, t.hp(op, 0));
    }
  }
  R.section('Gegenprobe: ein Heldeneffekt ohne Spell-Status (Siphem, Typ hero) löst Emergency Spell Armor NICHT aus');
  {
    const t = await H.fresh({ hand: [[], ['Emergency Spell Armor']], deckSize: 30 });
    t.grantFor(1, 0, 'Emergency Spell Armor');
    t.script.push({ match: d => d.title === 'Emergency Spell Armor', answer: () => ({ confirmed: true }) });
    t.setHero(0, 0, 'Siphem, the Deepsea Demon', 800); t.hero(0, 0).deepseaCounters = 3;
    t.script.push({ match: d => /Siphem/.test(d.title || ''), answer: (d) => { const o = (d.options || []).find(x => /3/.test(x.id)); return o ? { optionId: o.id } : undefined; } });
    t.hero(1, 0).hp = 100;
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.activateHero(0, 0);
    R.check('keine Abfrage, Held besiegt (richtig: kein Spell/Creature-Effekt)', gefragt(t, 'Emergency Spell Armor') === 0 && t.hp(1, 0) === 0, [gefragt(t, 'Emergency Spell Armor'), t.hp(1, 0)]);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
