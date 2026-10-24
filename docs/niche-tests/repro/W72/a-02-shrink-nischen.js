'use strict';
// W72a-02 · Shrink — Nischen: Boni, die die Hook-Runde umgehen, Rider, Reihenfolge, Teleport, Kontrollwechsel
const H = require('../../lib/h.js');
const CARD = 'Shrink';
const isHero = (v, owner, hi) => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);
const tragen = (t, seat, hi, name = CARD) => (t.gs.players[seat].supportZones[hi] || []).filter(z => (z || []).includes(name)).length;
async function anlegen(t, caster, seat, hi, name = CARD) {
  t.targetFn = (valid) => { const v = valid.find(x => isHero(x, seat, hi)); return v ? [v.id] : undefined; };
  const hand = t.pile(caster, 'hand').slice(); const i0 = hand.indexOf(name); if (i0 >= 0) hand.splice(i0, 1);
  t.setHand(caster, [name]);
  const r = await t.play(caster, name, { hero: 0 });
  t.setHand(caster, hand);
  t.targetFn = null;
  return r;
}
const setAtk = (t, seat, hi, atk) => { t.gs.players[seat].heroes[hi].atk = atk; t.gs.players[seat].heroes[hi].baseAtk = atk; };
async function spiele(t, seat, hi, karte, zielId) {
  t.targetFn = (valid) => { const v = valid.find(x => x.id === zielId(valid)); return v ? [v.id] : undefined; };
  t.setHand(seat, [karte]);
  const r = await t.play(seat, karte, { hero: hi });
  t.targetFn = null;
  return r;
}
const heldId = (owner, hi) => (valid) => (valid.find(v => isHero(v, owner, hi)) || {}).id;

(async () => {
  const R = H.runner();

  R.section('A · Boni, die an den Hooks vorbeilaufen (Niu-Stoß, Pfeile) heben „becomes 1" nicht');
  {
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 1, 0, 0);
    setAtk(t, 0, 0, 250);
    await t.run(() => t.engine.actionAddBuff(t.hero(0, 0), 0, 0, 'niu_enhanced', { sourceOwner: 0, totalDamage: 50, stacks: 1 }));
    await spiele(t, 0, 0, 'Attack', heldId(1, 1));
    R.check('Niu-Bonus +50 am geschrumpften Angreifer: trotzdem 1', t.hp(1, 1) === 799, t.hp(1, 1));
    R.check('der Niu-Stoß ist verbraucht (Buff weg)', !t.hero(0, 0).buffs?.niu_enhanced, t.hero(0, 0).buffs);
  }
  {
    // Gegenprobe: ohne Shrink schlägt der Niu-Bonus durch
    const t = await H.fresh({ hand: [['Attack'], []] });
    setAtk(t, 0, 0, 250);
    await t.run(() => t.engine.actionAddBuff(t.hero(0, 0), 0, 0, 'niu_enhanced', { sourceOwner: 0, totalDamage: 50, stacks: 1 }));
    await spiele(t, 0, 0, 'Attack', heldId(1, 1));
    R.check('Gegenprobe ohne Shrink: 250 + 50', t.hp(1, 1) === 500, t.hp(1, 1));
  }

  R.section('B · Attack mit Rider: der Rider bleibt, nur der Schaden wird 1');
  {
    const t = await H.fresh({ hand: [['Heavy Hit'], []] });
    await anlegen(t, 1, 0, 0);
    setAtk(t, 0, 0, 250);
    t.grantFor(0, 0, 'Heavy Hit');
    const r = await spiele(t, 0, 0, 'Heavy Hit', heldId(1, 1));
    R.check('Heavy Hit gespielt', r === true, r);
    R.check('Schaden 1 …', t.hp(1, 1) === 799, t.hp(1, 1));
    R.check('… aber die Betäubung kommt an (Rider ≠ Schaden)', !!t.hero(1, 1).statuses.stunned, t.hero(1, 1).statuses);
  }
  {
    const t = await H.fresh({ hand: [['Heavy Hit'], []] });
    await anlegen(t, 0, 1, 1);
    setAtk(t, 0, 0, 100);
    t.grantFor(0, 0, 'Heavy Hit');
    await spiele(t, 0, 0, 'Heavy Hit', heldId(1, 1));
    R.check('Heavy Hit gegen Shrink-Held: 200 Schaden', t.hp(1, 1) === 600, t.hp(1, 1));
  }

  R.section('C · Schadens-Obergrenzen und Immunitäten des Ziels gelten weiter');
  {
    // Ziel mit „kann nicht verringert werden"-Schutz? → Stoneskin am Ziel + geschrumpfter Angreifer + Cloudy: Betrag nie negativ
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 1, 0, 0);
    await anlegen(t, 0, 1, 1, 'Stoneskin');
    setAtk(t, 0, 0, 250);
    await t.run(() => t.engine.actionAddBuff(t.hero(1, 1), 1, 1, 'cloudy', { sourceOwner: 1, source: 'Test' }));
    await spiele(t, 0, 0, 'Attack', heldId(1, 1));
    R.check('Shrink-Angreifer + Stoneskin + Cloudy am Ziel: kein negativer/überhöhter Schaden', t.hp(1, 1) === 800 && t.errors.length === 0, [t.hp(1, 1), t.errors]);
  }

  R.section('D · Teleport: Status und Wirkung folgen der Karte (Support Zone bleibt)');
  {
    const t = await H.fresh({ hand: [['Teleport', 'Attack'], []] });
    await anlegen(t, 1, 0, 0);                             // Sitz 0, Held 0 trägt Shrink
    R.check('Vorbedingung: Held 0 geschrumpft', !!t.hero(0, 0).statuses.shrunk);
    t.targetFn = (valid) => [valid.find(v => isHero(v, 0, 0)).id, valid.find(v => isHero(v, 0, 1)).id];
    t.setHand(0, ['Teleport']);
    await t.play(0, 'Teleport', { hero: 2 });
    t.targetFn = null;
    const nameAt0 = t.hero(0, 0).name, nameAt1 = t.hero(0, 1).name;
    R.check('Helden getauscht', nameAt0 !== nameAt1);
    R.check('die Karte liegt weiter in Spalte 0 und der HELD IN SPALTE 0 trägt den Status (Held 1 nicht)', tragen(t, 0, 0) === 1 && !!t.hero(0, 0).statuses.shrunk && !t.hero(0, 1).statuses.shrunk, [t.hero(0, 0).statuses, t.hero(0, 1).statuses]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('E · Zustand');
  {
    const t = await H.fresh({ hand: [['Attack'], []] });
    await anlegen(t, 1, 0, 0);
    setAtk(t, 0, 0, 250);
    await spiele(t, 0, 0, 'Attack', heldId(1, 1));
    await t.endTurn();
    R.check('nach Zugwechsel: Status bleibt (dauerhaft)', !!t.hero(0, 0).statuses.shrunk);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
