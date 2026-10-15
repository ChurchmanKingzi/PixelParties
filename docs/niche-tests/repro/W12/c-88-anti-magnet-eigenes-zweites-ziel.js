'use strict';
// W12 / Q88 (F01-08) · Anti-Magnet braucht ein zweites EIGENES legales Ziel (Al: „Es braucht mindestens ein zweites **eigenes** legales Ziel.")
// Kartentext: „Play this card immediately when exactly 1 target you control is chosen by an Attack, Spell or Creature effect while you control other possible targets. …
//   The Attack/Spell/effect is redirected to a different target of your opponent's choice."
// (a) Sitz 1 hat nur EINEN Helden und keine Kreaturen → nicht spielbar/keine Umleitung (Held nimmt den Schaden).
// (b) Sitz 1 hat zwei Helden → Anti-Magnet wird gespielt, der Schlag geht auf ein anderes Ziel (Wahl des Angreifers); 2 Gold bezahlt.
// (c) Sitz 1 hat einen Helden + eine eigene Kreatur → spielbar.
// (d) Sitz 1 hat nur einen Helden, aber der Angreifer hat viele Ziele → weiterhin nicht spielbar (fremde Ziele genügen nicht).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const ATTA = 'Atta, Speaker of Desires';
function pick(owner, hi) { return (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === owner && x.heroIdx === hi); return [v ? v.id : valid[0].id]; }; }
(async () => {
  const R = H.runner();
  {   // (a)+(d)
    const t = await H.fresh({ heroes: [undefined, [ATTA, null, null]], hand: [['Attack'], ['Anti-Magnet']], gold: [100, 100] });
    t.policy.confirm = true; t.targetFn = pick(1, 0);
    const hp1 = t.hp(1, 0), g1 = t.gs.players[1].gold;
    await t.play(0, 'Attack', { hero: 0 });
    R.check('(a) ohne eigenes zweites Ziel: Held nimmt den Schlag (40)', hp1 - t.hp(1, 0) === 40, hp1 - t.hp(1, 0));
    R.check('(a) Anti-Magnet nicht bezahlt/verbraucht', t.gs.players[1].gold === g1 && t.pile(1, 'hand').includes('Anti-Magnet'), { gold: t.gs.players[1].gold, hand: t.pile(1, 'hand') });
    R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {   // (b)
    const t = await H.fresh({ hand: [['Attack'], ['Anti-Magnet']], gold: [100, 100] });
    t.policy.confirm = true; t.targetFn = (valid, cfg) => (cfg && /redirect/i.test(String(cfg.title + cfg.description)) ? [valid.find(v => v.type === 'hero' && v.owner === 0).id] : pick(1, 0)(valid));
    const hp1 = t.hp(1, 0), g1 = t.gs.players[1].gold;
    await t.play(0, 'Attack', { hero: 0 });
    R.check('(b) mit zweitem eigenen Helden: Held 0 von Sitz 1 unversehrt (umgeleitet)', t.hp(1, 0) === hp1, t.hp(1, 0));
    R.check('(b) 2 Gold bezahlt, Karte verbraucht', t.gs.players[1].gold === g1 - 2 && !t.pile(1, 'hand').includes('Anti-Magnet'), { gold: t.gs.players[1].gold, hand: t.pile(1, 'hand') });
    R.check('(b) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {   // (c)
    const t = await H.fresh({ heroes: [undefined, [ATTA, null, null]], hand: [['Attack'], ['Anti-Magnet']], gold: [100, 100] });
    t.put(1, 0, 0, H.INERT.creature);
    t.policy.confirm = true; t.targetFn = (valid, cfg) => (cfg && /redirect/i.test(String(cfg.title + cfg.description)) ? [valid.find(v => v.type === 'equip' && v.owner === 0 || v.type === 'hero' && v.owner === 0).id] : pick(1, 0)(valid));
    const hp1 = t.hp(1, 0);
    await t.play(0, 'Attack', { hero: 0 });
    R.check('(c) eigene Kreatur als zweites Ziel zählt: Anti-Magnet spielbar (Held unversehrt)', t.hp(1, 0) === hp1, t.hp(1, 0));
    R.check('(c) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
