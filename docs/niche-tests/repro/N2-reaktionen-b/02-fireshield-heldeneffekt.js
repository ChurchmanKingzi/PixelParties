'use strict';
// N2-02 · Fireshield reagiert auch auf Schaden aus einem aktiven HELDEN-Effekt
// Kartentext (Fireshield): „Play this Spell immediately when a Hero you control that can use it takes damage from an opponent's Attack, Spell or Creature effect and is not defeated by it.
//   Deal half that damage to the attacker as recoil (rounded up)."
// Siphem, the Deepsea Demon: aktiver Heldeneffekt, Schadenstyp 'hero' (CARD_API „Schadenstyp 'hero'", v905) — weder Attack noch Spell noch Creature-Effekt.
// Vorbild (v665/666, Als Befund 30.8., `isAttackSpellOrCreatureSource` in _hooks.js): „Helden-/Artefakt-/Trank-Effekte als Quelle lösen NICHT aus" — gilt für Frost Rune, Firewall, Flooding, Glass Wall …
// Erwartung: Der Heldeneffekt öffnet KEIN Fireshield-Fenster; der Angreifer erleidet keinen Rückstoß.
// Beobachtet: Fenster „Fireshield" geht auf, der Siphem-Held erhält 50 Rückstoß (Hälfte von 100).
// Ursache: fireshield.js `afterDamageCondition` prüft nur `source.owner`/`heroIdx`/lebender Held, nicht die Art der Quelle (Attack/Spell/Kreatur); es fehlt `isAttackSpellOrCreatureSource`.
// Gegenprobe: ein Zauber (Burning Finger) öffnet das Fenster (Text); Frost Rune ignoriert denselben Heldeneffekt.
const H = require('../../lib/h.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} wirkt, Sitz ${op} hält Fireshield`);
    {
      const t = await H.fresh({ hand: me === 0 ? [[], ['Fireshield']] : [['Fireshield'], []], deckSize: 30 });
      t.grantFor(op, 0, 'Fireshield');
      t.script.push({ match: d => d.title === 'Fireshield', answer: () => ({ confirmed: true }) });
      t.setHero(me, 0, 'Siphem, the Deepsea Demon', 800); t.hero(me, 0).deepseaCounters = 2;
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
      const r = await t.activateHero(me, 0);
      R.check('Siphem-Effekt wurde ausgeführt, Ziel verlor HP', r === true && t.hp(op, 0) < 800, [r, t.hp(op, 0)]);
      R.check('KEIN Fireshield-Fenster (Heldeneffekt ist kein Attack/Spell/Creature-Effekt)', gefragt(t, 'Fireshield') === 0, gefragt(t, 'Fireshield'));
      R.check('kein Rückstoß auf den Siphem-Helden', t.hp(me, 0) === 800, t.hp(me, 0));
    }
    R.section(`Gegenprobe Sitz ${me}: ein Zauber (Burning Finger) öffnet das Fenster`);
    {
      const t = await H.fresh({ hand: me === 0 ? [['Burning Finger'], ['Fireshield']] : [['Fireshield'], ['Burning Finger']], deckSize: 30 });
      t.grantFor(op, 0, 'Fireshield');
      t.script.push({ match: d => d.title === 'Fireshield', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
      await t.play(me, 'Burning Finger', { hero: 0 });
      R.check('Fenster geht auf, Rückstoß trifft den Zauberwirker', gefragt(t, 'Fireshield') === 1 && t.hp(me, 0) < 800, [gefragt(t, 'Fireshield'), t.hp(me, 0)]);
    }
  }
  R.section('Gegenprobe: Frost Rune ignoriert denselben Heldeneffekt');
  {
    const t = await H.fresh({ hand: [[], []], deckSize: 30 });
    t.putSurprise(1, 0, 'Frost Rune'); t.grantFor(1, 0, 'Frost Rune');
    t.setHero(0, 0, 'Siphem, the Deepsea Demon', 800); t.hero(0, 0).deepseaCounters = 2;
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.activateHero(0, 0);
    R.check('Frost Rune bleibt verdeckt', gefragt(t, 'Frost Rune') === 0 && t.gs.players[1].surpriseZones[0].includes('Frost Rune'), gefragt(t, 'Frost Rune'));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
