'use strict';
// W47a · Punkt 5 · Al, 22.10.2026: „Ja, soll Spell-Schaden sein" — der 200-Schaden-Rückschlag von Spike Trap ist Spell-Schaden (Schadenstyp `decay_spell` = Schule der Karte, vorher `'other'`).
// Die Folgen ergeben sich aus dem Typ: Spell-Leser (Corpse Explosion: „defeated by an Attack or Spell"), Spell-Immunität (Anti Magic blockt weiter), Surprise-Fenster des Angreifers („hit by a Spell"),
// Dark Ocean (schützt nur Kreaturen — Held-Rückschlag unberührt). Gegenproben: die Negation der Attack/des Spells und der Gegner-Konter (2 Karten abwerfen) bleiben unverändert.
// Exit 1 auf der Basis 70453312, Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W47/a-03-spike-trap-rueckschlag-ist-spell-schaden.js   (Exit 0 = korrekt)
const { H, loadCardEffect, szene, angeboten, surprise, waehleHeld } = require('./_w47.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

/** `me` hält Spike Trap an Held 0; `op` wirkt Fireball von Held 0 auf Held 0 von me. `o.hp` = HP des Angreifer-Helden (op:0). */
async function lauf(me, op, setup, o = {}) {
  const t = await szene(me, op);
  if (o.hp) t.hero(op, 0).hp = o.hp;
  t.putSurprise(me, 0, 'Spike Trap'); t.grantFor(me, 0, 'Spike Trap');
  t.addHand(op, 'Fireball');
  if (setup) await setup(t);
  t.targetFn = waehleHeld(me, 0);
  const r = await t.play(op, 'Fireball', { hero: 0 });
  return { t, r };
}
const dmg = (t) => t.logs.filter(l => l.type === 'damage' && l.data.source === 'Spike Trap');

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} hält Spike Trap, Sitz ${op} greift mit Fireball an`);
    {   // Schadenstyp
      const { t, r } = await lauf(me, op);
      const d = dmg(t);
      R.check('der Rückschlag trifft den Angreifer-Helden mit 200 Schaden, Typ Spell-Schaden (decay_spell)', d.length === 1 && d[0].data.amount === 200 && d[0].data.damageType === 'decay_spell' && t.hp(op, 0) === 600, { d: d.map(x => x.data), hp: t.hp(op, 0) });
      R.check('der Fireball ist negiert (Held 0 von me unversehrt), Spike Trap in der Ablage, sauber', t.hp(me, 0) === 800 && t.pile(me, 'discardPile').includes('Spike Trap') && sauber(t) && r === true, { hp: t.hp(me, 0), e: t.errors, a: t.audit() });
    }
    {   // Corpse Explosion (Spell-Leser: „a target is defeated by an Attack or Spell") — der Rückschlag besiegt den Angreifer
      const { t } = await lauf(me, op, (t) => { t.addHand(op, 'Corpse Explosion'); for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, 'Corpse Explosion'); }, { hp: 150 });
      R.check('Corpse Explosion reagiert auf das Besiegen durch den Spike-Trap-Rückschlag (Spell-Schaden)', t.prompts.some(p => p.pi === op && p.d.title === 'Corpse Explosion'), t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('Corpse Explosion: 50 Schaden auf alle Ziele des Gegners (Helden von me)', t.hp(me, 1) === 750 && t.hp(me, 2) === 750 && t.hp(op, 0) === 0, { hp: [t.hp(me, 0), t.hp(me, 1), t.hp(me, 2)], op0: t.hp(op, 0) });
    }
    {   // Surprise-Fenster des Angreifers: „hit by a Spell" — der Rückschlag öffnet es jetzt (Typ 'other' tat das nie)
      const { t } = await lauf(me, op, (t) => { t.putSurprise(op, 0, 'Booby Trap'); t.grantFor(op, 0, 'Booby Trap'); });
      R.check('Booby Trap des Angreifers (op:0) antwortet auf den Spell-Rückschlag („hit by a Spell")', surprise(t, op, 'Booby Trap'), t.logs.filter(l => l.type === 'surprise_activated').map(l => l.data.card + '@' + l.data.player));
      R.check('Rekursion endet (kein Hänger): sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    {   // Spell-Immunität: Anti Magic (Stufe ≥ 2) am Angreifer — der Rückschlag ist ein Spell der Stufe 2 und wird geblockt (blockte schon vorher über den Kartennamen)
      const { t } = await lauf(me, op, (t) => { t.hero(op, 0).buffs = t.hero(op, 0).buffs || {}; t.hero(op, 0).buffs.magic_immune = { level: 3, source: 'Anti Magic' }; });
      R.check('Anti Magic (Stufe 3) am Angreifer: der Rückschlag richtet keinen Schaden an', t.hp(op, 0) === 800, t.hp(op, 0));
    }
    {   // Dark Ocean schützt nur Kreaturen — der Held-Rückschlag bleibt
      const { t } = await lauf(me, op, (t) => { t.putArea(op, 'Dark Ocean'); });
      R.check('Dark Ocean: der Rückschlag auf den Helden kommt durch (600)', t.hp(op, 0) === 600, t.hp(op, 0));
    }
    {   // Gegner-Konter: 2 Karten abwerfen negiert Spike Trap (unverändert)
      const { t } = await lauf(me, op, (t) => { t.addHand(op, 'ZZ Filler'); t.addHand(op, 'ZZ Filler'); t.script.push({ match: d => d.type === 'confirm' && d.title === 'Spike Trap', answer: () => ({ confirmed: true }) }); });
      R.check('Konter (2 Karten abwerfen): kein Rückschlag, der Fireball trifft (Held 0 von me 650)', dmg(t).length === 0 && t.hp(op, 0) === 800 && t.hp(me, 0) === 650, { d: dmg(t).length, op: t.hp(op, 0), me: t.hp(me, 0) });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
